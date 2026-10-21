"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Trash2, Truck, Plus, CheckCircle2, AlertCircle } from "lucide-react";

import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { Button } from "@/components/ui/Button";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { toast } from "@/lib/toast";
import {
  useAddTransportPlanOrdersMutation,
  useCreateTransportPlanMutation,
  useGetOrderQuery,
  useGetTransportPlanQuery,
  useListDispatchesQuery,
  useListProductsQuery,
  useListTransportAgentsQuery,
  useListTransportPlansQuery,
  usePatchTransportPlanMutation,
  useRemoveTransportPlanOrderMutation,
} from "@/store/api";
import {
  collectLogisticsQuantityLines,
  computeOrderPlanLogistics,
  formatPlanLogisticsSummary,
  pickDispatchList,
  type PlanLogisticsResult,
} from "@/components/portal/shared/orders/logistics/planOrderLogistics";
import { DispatchLogisticsBreakdownTable } from "@/components/portal/shared/orders/logistics/DispatchLogisticsBreakdownTable";

interface TransportPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNo?: string;
  custLabel?: string;
}

function planIdOf(plan: unknown): string {
  if (!plan || typeof plan !== "object") return "";
  const o = plan as Record<string, unknown>;
  return String(o._id ?? o.id ?? "");
}

function refId(val: unknown): string {
  if (!val) return "";
  if (typeof val === "object") {
    const o = val as Record<string, unknown>;
    return String(o._id ?? o.id ?? "");
  }
  return String(val);
}

export default function TransportPlanModal({
  isOpen,
  onClose,
  orderId,
  orderNo,
  custLabel,
}: TransportPlanModalProps) {
  const [dispatchDate, setDispatchDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [agentId, setAgentId] = useState("");
  const [activePlanId, setActivePlanId] = useState("");

  const agentsQ = useListTransportAgentsQuery({ status: "active" }, { skip: !isOpen });

  const orderQ = useGetOrderQuery(orderId, { skip: !isOpen || !orderId });
  const orderRecord =
    orderQ.data && typeof orderQ.data === "object" && !Array.isArray(orderQ.data)
      ? (orderQ.data as Record<string, unknown>)
      : null;

  const dispatchesQ = useListDispatchesQuery(
    { order: orderId },
    { skip: !isOpen || !orderId },
  );

  const logisticsQtyMeta = useMemo(() => {
    if (!orderRecord) return { source: "order" as const, lines: [] };
    const orderItems = Array.isArray(orderRecord.order_items)
      ? (orderRecord.order_items as Record<string, unknown>[])
      : [];
    return collectLogisticsQuantityLines(orderRecord, dispatchesQ.data, orderItems);
  }, [orderRecord, dispatchesQ.data]);

  const productListParams = useMemo(() => {
    const ids = [...new Set(logisticsQtyMeta.lines.map((l) => l.productId).filter(Boolean))];
    const skus = [
      ...new Set(
        logisticsQtyMeta.lines
          .map((l) => (l.sku ? String(l.sku).trim().toUpperCase() : ""))
          .filter(Boolean),
      ),
    ];
    if (!ids.length && !skus.length) return undefined;
    if (ids.length) return { ids: ids.join(",") };
    return { skus: skus.join(",") };
  }, [logisticsQtyMeta.lines]);

  const productsQ = useListProductsQuery(productListParams, {
    skip: !isOpen || !productListParams,
  });

  const currentOrderLogistics = useMemo((): PlanLogisticsResult => {
    if (!orderRecord) return { items: [], warnings: [] };
    return computeOrderPlanLogistics(orderRecord, productsQ.data, dispatchesQ.data);
  }, [orderRecord, productsQ.data, dispatchesQ.data]);

  const dispatchPreviewCount = useMemo(
    () => pickDispatchList(dispatchesQ.data).filter((d) => d.deletedAt == null).length,
    [dispatchesQ.data],
  );

  const logisticsLoading =
    (orderQ.isLoading && !orderRecord) ||
    (dispatchesQ.isLoading && dispatchesQ.data === undefined) ||
    (Boolean(productListParams) && productsQ.isLoading && productsQ.data === undefined);

  const datePlansQ = useListTransportPlansQuery(
    dispatchDate ? { date: dispatchDate, limit: 20 } : undefined,
    { skip: !isOpen || !dispatchDate }
  );

  const agents = useMemo(() => {
    const raw = agentsQ.data;
    if (Array.isArray(raw)) return raw;
    return [];
  }, [agentsQ.data]);

  // Sync active plan when dispatch date or transport agent changes
  useEffect(() => {
    if (!isOpen || !dispatchDate) return;
    const plans = datePlansQ.data?.data ?? [];
    if (!agentId) {
      if (plans.length > 0) {
        const first = plans.find((p) => p.status !== "cancelled") || plans[0];
        const matchAgent =
          typeof first.transport_agent === "object"
            ? first.transport_agent?._id
            : first.transport_agent;
        if (matchAgent) setAgentId(String(matchAgent));
        setActivePlanId(planIdOf(first));
      } else {
        setActivePlanId("");
      }
      return;
    }

    const match = plans.find((p) => {
      const ag =
        typeof p.transport_agent === "object"
          ? p.transport_agent?._id
          : p.transport_agent;
      return String(ag ?? "") === agentId && p.status !== "cancelled";
    });

    if (match) {
      setActivePlanId(planIdOf(match));
    } else {
      setActivePlanId("");
    }
  }, [isOpen, dispatchDate, agentId, datePlansQ.data]);

  const planQ = useGetTransportPlanQuery(activePlanId, {
    skip: !isOpen || !activePlanId,
  });

  const [createPlan, { isLoading: isCreating }] = useCreateTransportPlanMutation();
  const [addOrders, { isLoading: isAdding }] = useAddTransportPlanOrdersMutation();
  const [removeOrder, { isLoading: isRemoving }] = useRemoveTransportPlanOrderMutation();
  const [patchPlan, { isLoading: isPatching }] = usePatchTransportPlanMutation();

  const isBusy = isCreating || isAdding || isRemoving || isPatching;

  const planOrders = useMemo(() => {
    if (!activePlanId || !planQ.data?.orders) return [];
    return planQ.data.orders.filter((o) => o.status !== "cancelled");
  }, [activePlanId, planQ.data]);

  const planLogisticsTotals = useMemo(() => {
    let weight = 0;
    let packed = 0;
    let open = 0;
    let hasWeight = false;
    let hasPacked = false;
    let hasOpen = false;
    for (const line of planOrders) {
      if (line.weight != null && Number.isFinite(Number(line.weight))) {
        weight += Number(line.weight);
        hasWeight = true;
      }
      if (line.packed_boxes != null && Number.isFinite(Number(line.packed_boxes))) {
        packed += Number(line.packed_boxes);
        hasPacked = true;
      } else if (line.packages != null && Number.isFinite(Number(line.packages))) {
        packed += Number(line.packages);
        hasPacked = true;
      }
      if (line.open_boxes != null && Number.isFinite(Number(line.open_boxes))) {
        open += Number(line.open_boxes);
        hasOpen = true;
      }
    }
    return {
      weight: hasWeight ? Math.round(weight * 100) / 100 : undefined,
      packed_boxes: hasPacked ? packed : undefined,
      open_boxes: hasOpen ? open : undefined,
    };
  }, [planOrders]);

  const isCurrentOrderInPlan = useMemo(() => {
    if (!orderId || !planOrders.length) return false;
    return planOrders.some((po) => refId(po.order) === orderId);
  }, [orderId, planOrders]);

  const handleAssignOrCreate = async () => {
    if (!dispatchDate) {
      toast.error("Dispatch date is required");
      return;
    }
    if (!agentId) {
      toast.error("Transport agent is required");
      return;
    }

    try {
      if (activePlanId) {
        // Add current order to existing transport plan
        if (isCurrentOrderInPlan) {
          toast.info("Order is already in this transport plan.");
          return;
        }
        await addOrders({
          id: activePlanId,
          items: [{ order_id: orderId, dispatch_id: "" }],
        }).unwrap();
        toast.success("Order added to transport plan successfully!");
        void planQ.refetch();
        void datePlansQ.refetch();
        void orderQ.refetch();
        void dispatchesQ.refetch();
      } else {
        // Create new plan and add current order
        const created = await createPlan({
          plan_date: dispatchDate,
          transport_agent: agentId,
          items: [{ order_id: orderId, dispatch_id: "" }],
        }).unwrap();
        const newId = planIdOf(created);
        setActivePlanId(newId);
        toast.success("New transport plan created with this order!");
        void datePlansQ.refetch();
      }
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  };

  const handleRemoveOrder = async (planOrderId: string) => {
    if (!activePlanId) return;
    try {
      await removeOrder({ id: activePlanId, planOrderId }).unwrap();
      toast.success("Order removed from transport plan.");
      void planQ.refetch();
      void datePlansQ.refetch();
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  };

  if (!isOpen) return null;

  return (
    <LargeModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
        <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900 transition-all max-h-[85vh] flex flex-col font-sans select-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                  Transport Plan Assignment
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Order: <span className="font-semibold text-blue-600 dark:text-blue-400">{orderNo || orderId.slice(0, 8)}</span>
                  {custLabel ? ` • ${custLabel}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-500 dark:hover:bg-white/5 cursor-pointer transition"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form Content */}
          <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
            {/* Form Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200/80 dark:border-white/10">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dispatch Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transport Agent <span className="text-red-500">*</span>
                </label>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">Select Transport Agent...</option>
                  {agents.map((ag: any) => (
                    <option key={ag._id || ag.id} value={ag._id || ag.id}>
                      {ag.agent_name || ag.name} {ag.agent_code ? `(${ag.agent_code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 p-3 text-xs dark:border-white/10 dark:bg-slate-800/40">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Estimated for this order
                {!logisticsLoading && logisticsQtyMeta.source === "dispatch" ? (
                  <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">
                    (from dispatch lines)
                  </span>
                ) : null}
              </p>
              {logisticsLoading ? (
                <p className="mt-1 text-slate-500">Calculating from dispatches and product master…</p>
              ) : null}
              {!logisticsLoading &&
              (currentOrderLogistics.warnings[0] === "No dispatched or remaining quantity to preview" ||
                currentOrderLogistics.warnings[0] === "No shippable quantity on order lines") ? (
                <p className="mt-1 text-amber-700 dark:text-amber-400">
                  No dispatch lines or remaining order quantity to preview.
                  {dispatchPreviewCount > 0
                    ? ` Found ${dispatchPreviewCount} dispatch record(s) on this order — open one and ensure line quantities are set, then submit the dispatch.`
                    : " Create and submit a dispatch first, or check approved qty vs dispatched on order lines."}
                </p>
              ) : !logisticsLoading ? (
                <div className="mt-3">
                  <DispatchLogisticsBreakdownTable
                    result={currentOrderLogistics}
                    title={
                      logisticsQtyMeta.source === "dispatch"
                        ? "Dispatched items on this order"
                        : "Order lines to ship"
                    }
                    emptyMessage="No line items with shippable quantity."
                  />
                  {(currentOrderLogistics.items ?? []).length > 0 ? (
                    <p className="mt-2 text-2xs tabular-nums text-slate-600 dark:text-slate-400">
                      Summary: {formatPlanLogisticsSummary(currentOrderLogistics)}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {activePlanId &&
              (planLogisticsTotals.weight != null ||
                planLogisticsTotals.packed_boxes != null ||
                planLogisticsTotals.open_boxes != null) ? (
                <p className="mt-2 border-t border-slate-200/80 pt-2 text-2xs text-slate-600 dark:border-white/10 dark:text-slate-400">
                  Plan total:{" "}
                  <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                    {planLogisticsTotals.weight ?? "—"} kg · {planLogisticsTotals.packed_boxes ?? "—"} packed ·{" "}
                    {planLogisticsTotals.open_boxes ?? "—"} open
                  </span>
                </p>
              ) : null}
            </div>

            {/* Plan Status Banner & Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-xs">
              <div className="text-xs">
                {activePlanId ? (
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      Existing Plan Found ({planOrders.length} order{planOrders.length !== 1 ? "s" : ""})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>No transport plan on this date for selected agent. A new plan will be created.</span>
                  </div>
                )}
                {isCurrentOrderInPlan && (
                  <p className="mt-0.5 text-2xs text-blue-600 dark:text-blue-400 font-medium">
                    ✓ Current order is already added in this transport plan.
                  </p>
                )}
              </div>

              <Button
                disabled={isBusy || !dispatchDate || !agentId || isCurrentOrderInPlan}
                onClick={() => void handleAssignOrCreate()}
                className="shrink-0"
                size="sm"
              >
                {isBusy ? (
                  "Processing..."
                ) : activePlanId ? (
                  <>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add to Plan
                  </>
                ) : (
                  <>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Plan & Add
                  </>
                )}
              </Button>
            </div>

            {/* List of Orders in Transport Plan */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Orders in Transport Plan ({planOrders.length})</span>
                {planQ.data?.status && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    Status: {planQ.data.status}
                  </span>
                )}
              </h4>

              {planQ.isFetching ? (
                <div className="p-6 text-center text-xs text-slate-500">Loading plan orders...</div>
              ) : planOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 rounded-lg border border-dashed border-slate-200 dark:border-white/10">
                  No orders currently in this transport plan.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border rounded-lg border-slate-200/90 dark:divide-white/5 dark:border-white/10 overflow-hidden max-h-56 overflow-y-auto">
                  {planOrders.map((line) => {
                    const lineOrd = line.order && typeof line.order === "object" ? line.order : null;
                    const lineParty = lineOrd?.party && typeof lineOrd.party === "object" ? lineOrd.party : null;
                    const linePartyName = lineParty?.party_name || "—";
                    const isSelf = refId(line.order) === orderId;
                    const lineWeight =
                      line.weight != null
                        ? line.weight
                        : isSelf
                          ? currentOrderLogistics.weight
                          : undefined;
                    const linePacked =
                      line.packed_boxes != null
                        ? line.packed_boxes
                        : line.packages != null
                          ? line.packages
                          : isSelf
                            ? currentOrderLogistics.packed_boxes
                            : undefined;
                    const lineOpen =
                      line.open_boxes != null
                        ? line.open_boxes
                        : isSelf
                          ? currentOrderLogistics.open_boxes
                          : undefined;

                    return (
                      <div
                        key={line._id || line.id}
                        className={`flex items-center justify-between p-2.5 text-xs transition ${
                          isSelf
                            ? "bg-blue-50/70 dark:bg-blue-950/30 font-medium"
                            : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {lineOrd?.order_no || "Order"}
                            </span>
                            {isSelf && (
                              <span className="rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 text-2xs px-1.5 py-0.5 font-bold">
                                Current
                              </span>
                            )}
                            <span className="text-2xs text-slate-500">
                              Status: {line.status || "pending"}
                            </span>
                          </div>
                          <p className="truncate text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {linePartyName} {lineParty?.shipping_address?.city ? `• ${lineParty.shipping_address.city}` : ""}
                          </p>
                          {(lineWeight != null || linePacked != null || lineOpen != null) && (
                            <p className="text-2xs tabular-nums text-slate-600 dark:text-slate-400 mt-0.5">
                              {lineWeight != null ? `${lineWeight} kg` : "— kg"}
                              {" · "}
                              {linePacked != null ? `${linePacked} packed` : "— packed"}
                              {" · "}
                              {lineOpen != null ? `${lineOpen} open` : "— open"}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => line._id && void handleRemoveOrder(line._id)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          title="Remove from plan"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </LargeModalPortal>
  );
}
