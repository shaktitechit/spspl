/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, Truck, MapPin, RotateCw } from "lucide-react";

import { useShellNav } from "@/components/shell/shell-nav-context";
import {
  OrderHeaderSummary,
  renderWorkflowStatusBadge,
} from "./components/OrderHeaderSummary";
import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { Button } from "@/components/ui/Button";
import {
  buildPartyNameById,
  buildPartySraById,
  checkOrderPartySra,
  pickList as pickPartyList,
  resolveOrderCounterparty,
} from "@/components/portal/sales/partyDisplay";
import { isOrderClosed } from "@/components/portal/sales/orderUtils";
import {
  filterAccountApprovalsForUser,
  idFromRef,
} from "@/components/portal/shared/orders/detail/accountDispatchAvailability";
import {
  FINANCE_ORDER_TAB_LABELS,
  getFinanceOrderTabCategory,
  type FinanceOrderTabCategory,
} from "@/components/portal/finance/financeOrderUtils";
import {
  buildOrderWorkflowCategoryOptions,
  isFulfillmentComplete,
} from "@/components/portal/shared/orders/list/orderWorkflowTabs";
import { withAdminApprovalQuantities } from "@/components/portal/shared/orders/lib/orderAdminApprovalDisplay";
import { OrderDetailTabsNav } from "@/components/portal/shared/orders/components/OrderDetailTabsNav";
import { deriveOrderWorkflowStatus } from "@/components/portal/shared/orders/lib/orderLifecycle";
import { computeOrderLifecycleActionCaps } from "@/components/portal/shared/orders/lib/orderLifecycleActions";
import { ItemFulfillmentDetailsModal } from "@/components/portal/shared/orders/modals/ItemFulfillmentDetailsModal";
import {
  OrderFulfillmentPipelineStrip,
  buildOrderFulfillmentPipelineSteps,
  DEFAULT_ORDER_PIPELINE_ICONS,
} from "@/components/portal/shared/ui/fulfillment/FulfillmentCircleStep";
import { computeDepartmentStageBoxes } from "@/components/portal/shared/orders/lib/orderDepartmentStages";
import FinalOrderStatementModal from "@/components/portal/shared/orders/modals/FinalOrderStatementModal";
import { PortalBusyOverlay } from "@/components/portal/shared/shell/PortalBusyOverlay";
import { buildUserNameById } from "@/components/portal/shared/lib/userDisplay";
import {
  WorkflowEmailControls,
  type WorkflowEmailOptions,
} from "@/components/portal/shared/orders/modals/WorkflowEmailControls";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { toast } from "@/lib/toast";
import { useAppSelector } from "@/store/hooks";
import {
  useApproveOrderApprovalMutation,
  useCreateOrderApprovalMutation,
  useGetOrderFulfillmentQuery,
  useGetOrderQuery,
  useGetPartyQuery,
  useListAttachmentsQuery,
  useListDispatchesQuery,
  useListEligibleTransportOrdersQuery,
  useListFlagsQuery,
  useListOrderApprovalsQuery,
  useListOrderDeliveriesQuery,
  useListOrderDueSheetsQuery,
  useListOrderReturnsQuery,
  useListPartiesQuery,
  useListRemindersQuery,
  useListTransportAgentsQuery,
  useListTransportsQuery,
  useListUsersQuery,
  usePatchDispatchMutation,
  usePatchOrderMutation,
  usePatchTransportMutation,
  useTransitionOrderMutation,
} from "@/store/api";
import { useGetOrderPerformaQuery } from "@/store/api/slices/orderPerformaApi";

import { agentLabel } from "@/components/portal/shared/transportPlanner/transportPlanUtils";
import { OrderDetailTabContent } from "./OrderDetailTabContent";
import OrderDetailsModal from "./modals/OrderDetailsModal";
import PartyDetailsModal from "./modals/PartyDetailsModal";
import UpdatePartyAddressModal from "./modals/UpdatePartyAddressModal";
import TransportPlanModal from "./modals/TransportPlanModal";
import { mobileTabIcon } from "./orderDetailMobileIcons";
import {
  detailRefId,
  filterAttachmentsByVisibility,
  formatDateShort,
  MOBILE_TAB_SHORT_LABELS,
  pickList,
  pickOrderAttachments,
  renderPriorityBadge,
  TAB_LABELS,
} from "./orderDetailUtils";
import {
  hasHeaderAction,
  type OrderDetailTabId,
  type OrderDetailsPageConfig,
} from "./orderDetailsPageConfig";
import { usePortalSettings } from "@/hooks/usePortalSettings";

function readId(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  return String(row._id ?? row.id ?? "");
}

export default function OrderDetailsPage({
  orderId,
  config,
}: {
  orderId: string;
  config: OrderDetailsPageConfig;
}) {
  const router = useRouter();
  const { setHeaderExtra } = useShellNav();
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = useMemo(
    () => String(currentUser?._id ?? currentUser?.id ?? ""),
    [currentUser],
  );

  const { isPerformaEnabled, isCostSheetEnabled, isKycEnabled, isPOEnabled } =
    usePortalSettings();

  const effectiveTabs = useMemo(() => {
    return config.tabs.filter((t) => {
      if (t === "performa" && !isPerformaEnabled) return false;
      if (t === "cost_sheet" && !isCostSheetEnabled) return false;
      if (t === "kyc" && !isKycEnabled) return false;
      if (t === "po" && !isPOEnabled) return false;
      return true;
    });
  }, [config.tabs, isPerformaEnabled, isCostSheetEnabled, isKycEnabled, isPOEnabled]);

  const needsApprovals =
    Boolean(config.approvalsMode) ||
    config.dispatchesMode === "dispatch_ops";
  const needsDeliveries = effectiveTabs.includes("deliveries");
  const needsReturns = effectiveTabs.includes("returns");
  const needsReminders = effectiveTabs.includes("reminders");
  const needsDueSheets = effectiveTabs.includes("due_sheet");
  const needsPerforma = effectiveTabs.includes("performa");
  const needsFinanceExtras = config.approvalsMode === "finance";
  const needsAdminApprovals = config.approvalsMode === "admin";
  const needsDispatchOps =
    config.dispatchesMode === "dispatch_ops" ||
    config.transportsMode === "dispatch_ops";

  const { data, isLoading, isFetching, isError, refetch } =
    useGetOrderQuery(orderId);
  const partiesQ = useListPartiesQuery({});
  const usersQ = useListUsersQuery({});
  const fulfillmentQ = useGetOrderFulfillmentQuery(orderId);
  const dispatchesQ = useListDispatchesQuery({ order: orderId });
  const transportsQ = useListTransportsQuery({ order: orderId });
  const deliveriesQ = useListOrderDeliveriesQuery(
    { order: orderId },
    { skip: !needsDeliveries },
  );
  const returnsQ = useListOrderReturnsQuery(
    { order: orderId },
    { skip: !needsReturns },
  );
  const approvalsQ = useListOrderApprovalsQuery(
    { order: orderId },
    { skip: !orderId || !needsApprovals },
  );
  const financeApprovalsQ = useListOrderApprovalsQuery(
    { order: orderId, is_admin_approved: true },
    { skip: !orderId || !needsFinanceExtras },
  );
  const adminApprovalsQ = useListOrderApprovalsQuery(
    { order: orderId },
    { skip: !orderId || !needsAdminApprovals },
  );
  const financeAssignedApprovalsQ = useListOrderApprovalsQuery(
    { order: orderId, assigned_finance_user: currentUserId },
    { skip: !orderId || !currentUserId || !needsFinanceExtras },
  );
  const remindersQ = useListRemindersQuery(
    { order: orderId },
    { skip: !orderId || !needsReminders },
  );
  const dueSheetsQ = useListOrderDueSheetsQuery(
    { order: orderId },
    { skip: !orderId || !needsDueSheets },
  );
  const attachQ = useListAttachmentsQuery({
    entity_type: "order",
    entity_id: orderId,
  });
  const flagsQ = useListFlagsQuery({ order: orderId });
  const performaQ = useGetOrderPerformaQuery(orderId, {
    skip: !orderId || !needsPerforma,
  });

  const detail =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;
  const status = deriveOrderWorkflowStatus(detail);

  const [transitionOrder, { isLoading: isSubmitting }] =
    useTransitionOrderMutation();
  const [patchOrder, { isLoading: isPatching }] = usePatchOrderMutation();
  const [patchDispatch, { isLoading: isPatchingDispatch }] =
    usePatchDispatchMutation();
  const [patchTransport, { isLoading: isPatchingTransport }] =
    usePatchTransportMutation();
  const [createFinanceApproval] = useCreateOrderApprovalMutation();
  const [approveFinanceApproval] = useApproveOrderApprovalMutation();

  const [transitioningTo, setTransitioningTo] = useState<string | null>(null);
  const [transitionRemarks, setTransitionRemarks] = useState("");
  const [transitionEmailOptions, setTransitionEmailOptions] = useState<WorkflowEmailOptions>({
    send_email: false,
    send_to_party: false,
    recipients: [],
  });
  const [confirmResolveOpen, setConfirmResolveOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<OrderDetailTabId>(
    config.defaultTab,
  );
  const [mobileTabOpen, setMobileTabOpen] = useState(false);
  const [isFulfillmentModalOpen, setIsFulfillmentModalOpen] = useState(false);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const [isPartyDetailsModalOpen, setIsPartyDetailsModalOpen] = useState(false);
  const [isUpdateAddressModalOpen, setIsUpdateAddressModalOpen] = useState(false);
  const [isTransportPlanModalOpen, setIsTransportPlanModalOpen] = useState(false);
  const [isFinalStatementOpen, setIsFinalStatementOpen] = useState(false);

  const userNameById = useMemo(
    () => buildUserNameById(usersQ.data),
    [usersQ.data],
  );
  const users = useMemo(
    () => pickList(usersQ.data) as Record<string, unknown>[],
    [usersQ.data],
  );

  const resolveUser = useCallback(
    (userVal: unknown): { name: string; phone: string } => {
      if (!userVal) return { name: "—", phone: "" };
      if (typeof userVal === "object" && userVal !== null) {
        const u = userVal as Record<string, unknown>;
        if (u.name || u.phone) {
          return {
            name: String(u.name || u.username || "—"),
            phone: String(u.phone || ""),
          };
        }
      }
      const userId =
        typeof userVal === "string"
          ? userVal
          : String(
              (userVal as { _id?: unknown; id?: unknown } | null)?._id ??
                (userVal as { id?: unknown } | null)?.id ??
                "",
            );
      if (!userId) return { name: "—", phone: "" };
      const found = users.find((u) => String(u._id ?? u.id ?? "") === userId);
      if (found) {
        return {
          name: String(found.name || found.username || "—"),
          phone: String(found.phone || ""),
        };
      }
      return { name: "—", phone: "" };
    },
    [users],
  );

  const createdBy = useMemo(() => {
    const id = detailRefId(detail?.created_by);
    return (id && userNameById[id]) || "Admin";
  }, [detail, userNameById]);

  const fulfillmentSnapshot = useMemo(
    () =>
      fulfillmentQ.data && typeof fulfillmentQ.data === "object"
        ? (fulfillmentQ.data as Record<string, unknown>)
        : null,
    [fulfillmentQ.data],
  );

  const isAssignedToMe = useMemo(() => {
    if (!detail || !currentUserId) return false;
    if (idFromRef(detail.assigned_account_user) === currentUserId) return true;
    const dept = String(
      detail.current_department ?? detail.pending_with_role ?? "",
    );
    return (
      dept === "account" && idFromRef(detail.current_assignee) === currentUserId
    );
  }, [detail, currentUserId]);

  const currentPartyId = useMemo(() => {
    if (!detail) return "";
    const p =
      detail.party ??
      detail.customer ??
      detail.party_id ??
      detail.partyId ??
      detail.customer_id ??
      detail.customerId;
    return detailRefId(p);
  }, [detail]);

  const resolvedPartyRecord = useMemo(() => {
    const list = pickList(partiesQ.data);
    if (currentPartyId) {
      const match = list.find((p) => String(p._id ?? p.id ?? "") === currentPartyId);
      if (match) return match;
    }
    const nameToMatch = String(
      detail?.party_name || detail?.customer_name || ""
    ).trim().toLowerCase();
    if (nameToMatch) {
      const match = list.find(
        (p) => String(p.party_name || "").trim().toLowerCase() === nameToMatch
      );
      if (match) return match;
    }
    if (detail?.party && typeof detail.party === "object" && !Array.isArray(detail.party)) {
      return detail.party as Record<string, unknown>;
    }
    if (detail?.customer && typeof detail.customer === "object" && !Array.isArray(detail.customer)) {
      return detail.customer as Record<string, unknown>;
    }
    return null;
  }, [partiesQ.data, currentPartyId, detail]);

  const effectivePartyId = useMemo(() => {
    if (currentPartyId) return currentPartyId;
    return resolvedPartyRecord ? String(resolvedPartyRecord._id ?? resolvedPartyRecord.id ?? "") : "";
  }, [currentPartyId, resolvedPartyRecord]);

  const legacyCustomerId = useMemo(() => {
    if (!resolvedPartyRecord?.legacy_customer) return "";
    return detailRefId(resolvedPartyRecord.legacy_customer);
  }, [resolvedPartyRecord]);

  const partyDetailQ = useGetPartyQuery(effectivePartyId, {
    skip: !effectivePartyId,
  });
  const partyAttachmentsQ = useListAttachmentsQuery(
    { entity_type: "party", entity_id: effectivePartyId },
    { skip: !effectivePartyId },
  );
  const customerAttachmentsQ = useListAttachmentsQuery(
    { entity_type: "customer", entity_id: effectivePartyId },
    { skip: !effectivePartyId },
  );
  const legacyCustomerAttachmentsQ = useListAttachmentsQuery(
    { entity_type: "customer", entity_id: legacyCustomerId },
    { skip: !legacyCustomerId },
  );

  const eligibleTransportQ = useListEligibleTransportOrdersQuery(
    { limit: 200 },
    { skip: !orderId },
  );

  const dispatches = useMemo(
    () => pickList(dispatchesQ.data),
    [dispatchesQ.data],
  );
  const transports = useMemo(
    () => pickList(transportsQ.data),
    [transportsQ.data],
  );

  const agentsQ = useListTransportAgentsQuery({});

  const agentNameById = useMemo(() => {
    const map = new Map<string, string>();
    const list = pickList(agentsQ.data);
    for (const a of list) {
      if (!a || typeof a !== "object") continue;
      const id = String(a._id || a.id || "");
      const name = String(a.agent_name || a.agent_code || "");
      if (id && name && !/^[0-9a-fA-F]{24}$/.test(name)) {
        map.set(id, name);
      }
    }
    return map;
  }, [agentsQ.data]);

  const resolveAgentName = useCallback(
    (agentVal: unknown): string => {
      if (!agentVal) return "";
      if (typeof agentVal === "object" && agentVal !== null) {
        const obj = agentVal as Record<string, unknown>;
        const name = String(obj.agent_name || obj.agent_code || "");
        if (name && !/^[0-9a-fA-F]{24}$/.test(name)) return name;
      }
      const rawId =
        typeof agentVal === "string"
          ? agentVal
          : String((agentVal as { _id?: unknown; id?: unknown })?._id ?? (agentVal as { id?: unknown })?.id ?? "");
      if (rawId && agentNameById.has(rawId)) {
        return agentNameById.get(rawId)!;
      }
      const label = agentLabel(agentVal as any);
      if (label && label !== "—" && !/^[0-9a-fA-F]{24}$/.test(label)) {
        return label;
      }
      return "";
    },
    [agentNameById],
  );

  const activeTransportInfo = useMemo(() => {
    // Check direct transports list first
    for (const t of transports) {
      if (!t || typeof t !== "object") continue;
      const row = t as Record<string, unknown>;
      if (row.shipment_status === "cancelled" || row.status === "cancelled") continue;
      const agent = row.transport_agent;
      const date = row.dispatch_date || row.expected_delivery_date;
      const resolvedName = resolveAgentName(agent);
      if (resolvedName || date) {
        return {
          agentName: resolvedName || undefined,
          scheduledDate: date ? String(date) : undefined,
        };
      }
    }

    // Check transport plan / eligible orders enrichment
    const eligibleOrders = eligibleTransportQ.data?.data ?? [];
    const match = eligibleOrders.find((r) => String(r._id || r.id || "") === orderId);
    if (match) {
      const plan = match.transport_plan;
      const shipment = match.transport;
      if (plan || shipment) {
        const agent = shipment?.transport_agent || plan?.transport_agent;
        const date = shipment?.dispatch_date || plan?.plan_date;
        const resolvedName = resolveAgentName(agent);
        if (resolvedName || date) {
          return {
            agentName: resolvedName || undefined,
            scheduledDate: date ? String(date) : undefined,
          };
        }
      }
    }

    return null;
  }, [transports, eligibleTransportQ.data, orderId, resolveAgentName]);
  const deliveries = useMemo(
    () => pickList(deliveriesQ.data),
    [deliveriesQ.data],
  );
  const returns = useMemo(() => pickList(returnsQ.data), [returnsQ.data]);
  const accountApprovals = useMemo(
    () => filterAccountApprovalsForUser(pickList(approvalsQ.data)),
    [approvalsQ.data],
  );

  const attachmentsList = useMemo(() => {
    const all = pickOrderAttachments(attachQ.data, orderId);
    return filterAttachmentsByVisibility(all, config.attachmentVisibility);
  }, [attachQ.data, orderId, config.attachmentVisibility]);

  const attachCount = attachmentsList.length;
  const remindersCount = useMemo(
    () => pickList(remindersQ.data).length,
    [remindersQ.data],
  );
  const dueSheetsCount = useMemo(
    () => pickList(dueSheetsQ.data).length,
    [dueSheetsQ.data],
  );
  const rawFlags = useMemo(
    () => pickList(flagsQ.data) as Record<string, unknown>[],
    [flagsQ.data],
  );

  const orderItems = useMemo(() => {
    if (!detail || !Array.isArray(detail.order_items)) return [];
    return detail.order_items as Record<string, unknown>[];
  }, [detail]);

  const adminReadOnlyItems = useMemo(() => {
    if (!needsAdminApprovals) return orderItems;
    return withAdminApprovalQuantities(
      orderItems,
      pickList(adminApprovalsQ.data),
    );
  }, [needsAdminApprovals, orderItems, adminApprovalsQ.data]);

  const financeAssignedCount = useMemo(() => {
    return pickList(financeAssignedApprovalsQ.data).filter((app) => {
      const assigneeId =
        typeof app.assigned_finance_user === "string"
          ? app.assigned_finance_user
          : String(
              (
                app.assigned_finance_user as
                  | { _id?: unknown; id?: unknown }
                  | undefined
              )?._id ??
                (app.assigned_finance_user as { id?: unknown } | undefined)
                  ?.id ??
                "",
            );
      return assigneeId && assigneeId === currentUserId;
    }).length;
  }, [financeAssignedApprovalsQ.data, currentUserId]);

  const categoryOptions = useMemo(
    () =>
      buildOrderWorkflowCategoryOptions({
        transports: pickPartyList(transportsQ.data),
        dispatches: pickPartyList(dispatchesQ.data),
      }),
    [transportsQ.data, dispatchesQ.data],
  );
  const workflowTabCategory = useMemo(
    () =>
      config.showFinanceWorkflowBadge
        ? getFinanceOrderTabCategory(detail, categoryOptions)
        : null,
    [config.showFinanceWorkflowBadge, detail, categoryOptions],
  );

  const totalApproved = useMemo(() => {
    if (!detail || !Array.isArray(detail.order_items)) return 0;
    return detail.order_items.reduce(
      (sum, item: any) => sum + Number(item.approved_quantity ?? 0),
      0,
    );
  }, [detail]);
  const hasRemainingQty = useMemo(() => {
    if (!detail || !Array.isArray(detail.order_items)) return false;
    return detail.order_items.some((item: any) => {
      const approvedSoFar = Number(item.approved_quantity ?? 0);
      const remainingQty = Math.max(
        0,
        Number(item.sales_approved_quantity ?? 0) - approvedSoFar,
      );
      return remainingQty > 0;
    });
  }, [detail]);

  const handleRefetch = useCallback(() => {
    refetch();
    if (!fulfillmentQ.isUninitialized) fulfillmentQ.refetch();
    if (!attachQ.isUninitialized) attachQ.refetch();
    if (!dispatchesQ.isUninitialized) void dispatchesQ.refetch();
    if (!transportsQ.isUninitialized) void transportsQ.refetch();
    if (!deliveriesQ.isUninitialized) void deliveriesQ.refetch();
    if (!returnsQ.isUninitialized) void returnsQ.refetch();
    if (!approvalsQ.isUninitialized) void approvalsQ.refetch();
    if (!financeApprovalsQ.isUninitialized) void financeApprovalsQ.refetch();
    if (!adminApprovalsQ.isUninitialized) void adminApprovalsQ.refetch();
    if (!financeAssignedApprovalsQ.isUninitialized)
      void financeAssignedApprovalsQ.refetch();
    if (!remindersQ.isUninitialized) void remindersQ.refetch();
    if (!dueSheetsQ.isUninitialized) void dueSheetsQ.refetch();
    if (!flagsQ.isUninitialized) void flagsQ.refetch();
    if (!performaQ.isUninitialized) void performaQ.refetch();
  }, [
    refetch,
    fulfillmentQ,
    attachQ,
    dispatchesQ,
    transportsQ,
    deliveriesQ,
    returnsQ,
    approvalsQ,
    financeApprovalsQ,
    adminApprovalsQ,
    financeAssignedApprovalsQ,
    remindersQ,
    dueSheetsQ,
    flagsQ,
    performaQ,
  ]);

  const handleResolveOrder = useCallback(async () => {
    if (!detail || !Array.isArray(detail.order_items)) return;
    try {
      const updatedItems = detail.order_items.map((item: any) => ({
        ...item,
        ordered_quantity: Number(item.approved_quantity ?? 0),
        quantity: Number(item.approved_quantity ?? 0),
      }));
      await patchOrder({
        id: orderId,
        patch: { order_items: updatedItems },
      }).unwrap();
      await transitionOrder({
        id: orderId,
        body: {
          next_status: "fully_finance_approved",
          remarks: "Resolved partial release to match approved quantities",
        },
      }).unwrap();
      toast.success("Order resolved to approved quantities.");
      setConfirmResolveOpen(false);
      handleRefetch();
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  }, [detail, orderId, patchOrder, transitionOrder, handleRefetch]);

  const handleUpdateDispatchStatus = useCallback(
    async (dispatchId: string, nextStatus: string) => {
      try {
        await patchDispatch({
          id: dispatchId,
          patch: { status: nextStatus },
        }).unwrap();
        toast.success(
          `Dispatch status updated to ${nextStatus.replace("_", " ")}`,
        );
        handleRefetch();
      } catch (err) {
        toast.error(mutationRejectedMessage(err));
      }
    },
    [patchDispatch, handleRefetch],
  );

  const handleUpdateTransportStatus = useCallback(
    async (
      transportId: string,
      nextStatus: string,
      remarks?: string,
      suppressToast?: boolean,
    ) => {
      try {
        await patchTransport({
          id: transportId,
          patch: { status: nextStatus, ...(remarks ? { remarks } : {}) },
        }).unwrap();
        const refreshed = await refetch();
        const order = refreshed.data as Record<string, unknown> | undefined;
        const orderClosed = isOrderClosed(order);
        if (!suppressToast && !orderClosed) {
          toast.success(
            `Transport status updated to ${nextStatus.replace(/_/g, " ")}`,
          );
        }
        handleRefetch();
      } catch (err) {
        toast.error(mutationRejectedMessage(err));
      }
    },
    [patchTransport, refetch, handleRefetch],
  );

  const handleTransition = useCallback(
    async (nextStatus: string) => {
      if (nextStatus === "finance_rejected" && !transitionRemarks.trim()) {
        toast.error("Rejection reason is required.");
        return;
      }
      try {
        // Cancel / reject must only update workflow + status — never rewrite
        // order / line quantities via finance approval create/decide.
        if (
          config.approvalsMode === "finance" &&
          nextStatus === "finance_approved"
        ) {
          const approvalItems = orderItems
            .map((line) => {
              const ordered = Number(
                line.ordered_quantity ?? line.quantity ?? 0,
              );
              const alreadyApproved = Number(line.approved_quantity || 0);
              const remaining = Math.max(0, ordered - alreadyApproved);
              const approveQty = remaining > 0 ? remaining : ordered;
              if (approveQty <= 0) return null;
              return {
                order_item_id: line._id,
                approved_quantity: approveQty,
                approval_status:
                  approveQty >= ordered
                    ? "fully_approved"
                    : "partially_approved",
              };
            })
            .filter(Boolean);

          const approval = await createFinanceApproval({
            order: orderId,
            approval_status: "pending_review",
            approval_notes: transitionRemarks.trim() || undefined,
            approval_items: approvalItems,
            email_options: transitionEmailOptions,
          }).unwrap();
          const approvalId = readId(approval);
          if (!approvalId)
            throw new Error("Finance approval id missing from response");

          await approveFinanceApproval({
            id: approvalId,
            body: {
              approval_notes: transitionRemarks.trim() || undefined,
              email_options: transitionEmailOptions,
            },
          }).unwrap();
        } else {
          await transitionOrder({
            id: orderId,
            body: {
              next_status: nextStatus,
              remarks: transitionRemarks.trim() || undefined,
              ...(nextStatus === "finance_rejected"
                ? { rejection_reason: transitionRemarks.trim() }
                : {}),
              email_options: transitionEmailOptions,
            },
          }).unwrap();
        }
        toast.success(
          `Order successfully transitioned to ${nextStatus.split("_").join(" ")}`,
        );
        setTransitioningTo(null);
        setTransitionRemarks("");
        setTransitionEmailOptions({ send_email: false, send_to_party: false, recipients: [] });
        handleRefetch();
      } catch (rejected) {
        toast.error(mutationRejectedMessage(rejected));
      }
    },
    [
      config.approvalsMode,
      orderId,
      transitionRemarks,
      transitionEmailOptions,
      transitionOrder,
      handleRefetch,
      orderItems,
      createFinanceApproval,
      approveFinanceApproval,
    ],
  );

  const partyNameById = useMemo(
    () => buildPartyNameById(partiesQ.data),
    [partiesQ.data],
  );
  const partySraById = useMemo(
    () => buildPartySraById(partiesQ.data),
    [partiesQ.data],
  );
  const custLabel = detail
    ? resolveOrderCounterparty(detail, partyNameById)
    : "—";
  const orderNo = detail
    ? String(
        detail.order_no || detail.order_number || `ID: ${orderId.slice(0, 8)}`,
      )
    : "";

  const stageBoxes = useMemo(
    () =>
      computeDepartmentStageBoxes(detail, fulfillmentSnapshot, {
        returns,
        dispatches,
      }),
    [detail, fulfillmentSnapshot, returns, dispatches],
  );

  const orderKpis = useMemo(() => {
    const totals =
      fulfillmentSnapshot?.totals &&
      typeof fulfillmentSnapshot.totals === "object"
        ? (fulfillmentSnapshot.totals as Record<string, unknown>)
        : null;
    const totalQty = Number(
      totals?.ordered ??
        orderItems.reduce(
          (sum, line) =>
            sum + Number(line.ordered_quantity ?? line.quantity ?? 0),
          0,
        ),
    );
    const adminApprovedQty = Number(
      totals?.salesApproved ??
        orderItems.reduce((sum, line) => {
          const sales = Number(line.sales_approved_quantity ?? 0);
          if (sales > 0) return sum + sales;
          return sum + Number(line.approved_quantity || 0);
        }, 0),
    );
    const financeApprovedQty = Number(
      totals?.approved ??
        orderItems.reduce(
          (sum, line) => sum + Number(line.approved_quantity || 0),
          0,
        ),
    );
    const dispatchedQty = Number(
      totals?.dispatched ??
        orderItems.reduce(
          (sum, line) => sum + Number(line.dispatched_quantity || 0),
          0,
        ),
    );
    return { totalQty, adminApprovedQty, financeApprovedQty, dispatchedQty };
  }, [fulfillmentSnapshot, orderItems]);

  const pipelineSteps = useMemo(
    () =>
      buildOrderFulfillmentPipelineSteps(
        stageBoxes,
        DEFAULT_ORDER_PIPELINE_ICONS,
        { defaultTotal: orderKpis.totalQty },
      ),
    [stageBoxes, orderKpis.totalQty],
  );

  const canShowFinalStatement = useMemo(
    () => isFulfillmentComplete(detail),
    [detail],
  );

  const sharedLifecycleCaps = useMemo(
    () => computeOrderLifecycleActionCaps({ status, dispatches }),
    [status, dispatches],
  );

  const canHold = sharedLifecycleCaps.canHold;
  const canCancel = sharedLifecycleCaps.canCancel;
  const canReject = sharedLifecycleCaps.canReject;
  const lockReason = sharedLifecycleCaps.lockReason;

  const adminAllowedTransitions = useMemo(() => {
    if (status === "draft") return ["submitted", "cancelled"];
    if (status === "submitted")
      return ["sales_approved", "finance_review", "on_hold", "cancelled"];
    if (status === "sales_approved")
      return ["finance_review", "on_hold", "cancelled"];
    if (status === "on_hold") return ["submitted", "finance_review", "cancelled"];
    if (status === "finance_rejected") return ["submitted", "cancelled"];
    return [];
  }, [status]);

  const canResume = useMemo(() => {
    if (!hasHeaderAction(config, "resume") || !config.resumeTargetStatus)
      return false;
    if (config.approvalsMode === "admin") {
      return adminAllowedTransitions.includes(config.resumeTargetStatus);
    }
    if (config.approvalsMode === "finance") {
      return status === "on_hold" && !sharedLifecycleCaps.hasSubmittedDispatch;
    }
    if (config.lifecycleCapsMode === "dispatch") {
      return status === "on_hold";
    }
    return false;
  }, [
    config,
    adminAllowedTransitions,
    status,
    sharedLifecycleCaps.hasSubmittedDispatch,
  ]);

  const resumeLabel = useMemo(() => {
    if (config.approvalsMode === "admin") {
      if (status === "draft") return "Submit Order";
      if (status === "finance_rejected") return "Resubmit Order";
      if (status === "on_hold") return "Resume Order";
      return "Submit / Resume Order";
    }
    return "Resume";
  }, [config.approvalsMode, status]);

  const busy = isSubmitting || isPatching;

  const performaRecord = performaQ.data;
  const orderPerformaField =
    detail?.order_performa ??
    (detail as any)?.performa ??
    (detail as any)?.proforma_details;

  const hasPerforma = useMemo(() => {
    if (performaRecord?._id && !performaRecord.is_default) {
      return true;
    }
    if (orderPerformaField) {
      if (typeof orderPerformaField === "string" && orderPerformaField.trim().length > 0) {
        return true;
      }
      if (typeof orderPerformaField === "object" && orderPerformaField !== null) {
        const perfObj = orderPerformaField as Record<string, unknown>;
        if (perfObj._id && !perfObj.is_default) {
          return true;
        }
        if (
          perfObj.sales_person ||
          perfObj.dispatch_date ||
          perfObj.transport ||
          perfObj.po_attachment ||
          perfObj.cost_sheet_attachment
        ) {
          return true;
        }
      }
    }
    if (performaRecord?._id) {
      return true;
    }
    return false;
  }, [performaRecord, orderPerformaField]);

  const performaCount = hasPerforma ? 1 : 0;

  const tabCounts = useMemo(() => {
    const poCount = attachmentsList.filter((a) => {
      const c = String(a.category || "").toLowerCase();
      const r = String(a.remarks || "").toLowerCase();
      const n = String(a.original_name || a.file_name || "").toLowerCase();
      return c === "po" || r.startsWith("[po]") || n.startsWith("po_");
    }).length;

    const costSheetCount = attachmentsList.filter((a) => {
      const c = String(a.category || "").toLowerCase();
      const r = String(a.remarks || "").toLowerCase();
      const n = String(a.original_name || a.file_name || "").toLowerCase();
      return c === "cost_sheet" || r.startsWith("[cost_sheet]") || n.includes("cost_sheet") || n.includes("costsheet");
    }).length;

    const kycPartyDocs = [
      ...pickList(partyAttachmentsQ.data),
      ...pickList(customerAttachmentsQ.data),
      ...pickList(legacyCustomerAttachmentsQ.data),
    ];
    const seenKycDocIds = new Set<string>();
    const deduplicatedPartyDocs: Record<string, unknown>[] = [];
    for (const doc of kycPartyDocs) {
      const id = String(doc._id ?? doc.id ?? "");
      if (id && !seenKycDocIds.has(id)) {
        seenKycDocIds.add(id);
        deduplicatedPartyDocs.push(doc);
      } else if (!id) {
        deduplicatedPartyDocs.push(doc);
      }
    }

    const kycOrderDocs = attachmentsList.filter((a) => {
      const c = String(a.category || "").toLowerCase();
      const r = String(a.remarks || "").toLowerCase();
      const n = String(a.original_name || a.file_name || "").toLowerCase();
      return (
        c.startsWith("kyc") ||
        c.includes("aadhaar") ||
        c.includes("pan") ||
        c.includes("gst") ||
        r.includes("kyc") ||
        r.includes("aadhaar") ||
        r.includes("adhaar") ||
        r.includes("pan") ||
        r.includes("gst") ||
        n.includes("kyc") ||
        n.includes("aadhaar") ||
        n.includes("adhaar") ||
        n.includes("pan") ||
        n.includes("gst")
      );
    });

    const partyObj = (
      resolvedPartyRecord ||
      (partyDetailQ.data && typeof partyDetailQ.data === "object" && !Array.isArray(partyDetailQ.data)
        ? (partyDetailQ.data as Record<string, unknown>)
        : null) ||
      (detail?.party && typeof detail.party === "object" && !Array.isArray(detail.party)
        ? (detail.party as Record<string, unknown>)
        : null) ||
      (detail?.customer && typeof detail.customer === "object" && !Array.isArray(detail.customer)
        ? (detail.customer as Record<string, unknown>)
        : null)
    ) as Record<string, unknown> | undefined;

    let registeredFieldCount = 0;
    const gstVal =
      partyObj?.gst_no ||
      partyObj?.gstin ||
      (detail as Record<string, unknown> | null)?.gst_no ||
      (detail as Record<string, unknown> | null)?.gstin;
    if (gstVal) registeredFieldCount++;

    const panVal =
      partyObj?.pan ||
      partyObj?.pan_no ||
      (detail as Record<string, unknown> | null)?.pan ||
      (detail as Record<string, unknown> | null)?.pan_no;
    if (panVal) registeredFieldCount++;

    const dlVal = partyObj?.drug_license_no || partyObj?.drug_license;
    if (dlVal) registeredFieldCount++;

    const aadhVal = partyObj?.aadhaar_number || partyObj?.aadhaar_no;
    if (aadhVal) registeredFieldCount++;

    const kycStatusVal = String(
      partyObj?.kyc_status ??
      (detail?.proforma_details as Record<string, unknown> | undefined)?.kyc_status ??
      ""
    ).toLowerCase();

    const isKycVerified = Boolean(
      partyObj?.kyc_verified ||
      partyObj?.is_kyc_verified ||
      kycStatusVal === "verified" ||
      (kycStatusVal && kycStatusVal !== "na" && kycStatusVal !== "rejected")
    );

    const hasPartyKycFields = Boolean(
      registeredFieldCount > 0 ||
      isKycVerified ||
      (partyObj?.billing_address as Record<string, unknown> | undefined)?.gst_no ||
      (partyObj?.shipping_address as Record<string, unknown> | undefined)?.gst_no
    );

    const totalKycDocs = deduplicatedPartyDocs.length + kycOrderDocs.length;
    const kycCount =
      totalKycDocs > 0
        ? totalKycDocs
        : registeredFieldCount > 0
          ? registeredFieldCount
          : hasPartyKycFields
            ? 1
            : 0;

    const map: Partial<Record<OrderDetailTabId, number>> = {
      approvals:
        config.approvalsMode === "finance"
          ? financeAssignedCount
          : config.approvalsMode === "admin"
            ? pickList(adminApprovalsQ.data).length
            : accountApprovals.length,
      po: poCount > 0 ? 1 : 0,
      performa: performaCount,
      cost_sheet: costSheetCount > 0 ? 1 : 0,
      due_sheet: dueSheetsCount,
      kyc: kycCount,
      dispatches: dispatches.length,
      transports: transports.length,
      deliveries: deliveries.length,
      returns: returns.length,
      flags: rawFlags.filter((f) => f.status === "open").length,
      attachments: attachCount,
      reminders: remindersCount,
      communication: 0,
    };
    return map;
  }, [
    config.approvalsMode,
    financeAssignedCount,
    adminApprovalsQ.data,
    accountApprovals.length,
    attachmentsList,
    dispatches.length,
    transports.length,
    deliveries.length,
    returns.length,
    dueSheetsCount,
    rawFlags,
    attachCount,
    remindersCount,
    resolvedPartyRecord,
    partyDetailQ.data,
    partyAttachmentsQ.data,
    customerAttachmentsQ.data,
    legacyCustomerAttachmentsQ.data,
    detail,
    performaCount,
  ]);

  useEffect(() => {
    if (!effectiveTabs.includes(activeTab) && effectiveTabs.length > 0) {
      setActiveTab(effectiveTabs[0]);
    }
  }, [effectiveTabs, activeTab]);

  const desktopTabs = useMemo(
    () =>
      effectiveTabs.map((id) => {
        const count = tabCounts[id] ?? 0;
        return {
          id,
          name:
            id === "approvals" && config.approvalsMode === "admin"
              ? "Order Approval"
              : TAB_LABELS[id] ?? id,
          count,
          hasData: count > 0,
          dangerBadge: id === "flags",
        };
      }),
    [effectiveTabs, config.approvalsMode, tabCounts],
  );

  const partyData = (partyDetailQ.data || resolvedPartyRecord) as Record<string, unknown> | undefined;
  const partyMobile = partyData ? String(partyData.mobile ?? "") : undefined;
  const partyEmail = partyData ? String(partyData.email ?? "") : undefined;

  const tabContentProps = {
    config,
    activeTab,
    orderId,
    detail: detail as Record<string, unknown>,
    orderItems,
    status,
    partyLabel: custLabel,
    isAssignedToMe,
    adminReadOnlyItems,
    flagsQ,
    rawFlags,
    userNameById,
    attachments: attachmentsList,
    attachmentsLoading: attachQ.isFetching,
    refetchOrder: handleRefetch,
    dispatches,
    transports,
    returns,
    dispatchesFetching: dispatchesQ.isFetching,
    transportsFetching: transportsQ.isFetching,
    returnsFetching: returnsQ.isFetching,
    isPatchingDispatch: needsDispatchOps ? isPatchingDispatch : undefined,
    isPatchingTransport: needsDispatchOps ? isPatchingTransport : undefined,
    onUpdateDispatchStatus: needsDispatchOps
      ? handleUpdateDispatchStatus
      : undefined,
    onUpdateTransportStatus: needsDispatchOps
      ? handleUpdateTransportStatus
      : undefined,
    expectedDeliveryDate: detail?.expected_delivery_date
      ? String(detail.expected_delivery_date)
      : undefined,
    shippingAddress: partyData?.shipping_address,
    partyMobile,
    partyEmail,
    orderNo,
  };

  useEffect(() => {
    if (!detail) {
      setHeaderExtra(null);
      return;
    }
    setHeaderExtra(
      <OrderHeaderSummary
        orderNo={orderNo}
        custLabel={custLabel}
        orderDate={detail.order_date}
        edd={detail.expected_delivery_date}
        isSra={Boolean(
          checkOrderPartySra(detail, partySraById) ||
            (partyDetailQ.data as any)?.sra === true,
        )}
        priority={
          typeof detail.priority === "string" ? detail.priority : "normal"
        }
        workflowCategory={workflowTabCategory}
        showFinanceWorkflowBadge={config.showFinanceWorkflowBadge}
        pipelineSteps={pipelineSteps}
      />,
    );
    return () => {
      setHeaderExtra(null);
    };
  }, [
    detail,
    orderNo,
    custLabel,
    partySraById,
    partyDetailQ.data,
    workflowTabCategory,
    config.showFinanceWorkflowBadge,
    pipelineSteps,
    setHeaderExtra,
  ]);

  if (isError || (!isLoading && !detail)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4 font-sans">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-2" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Failed to load order
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          The order record could not be found or you have insufficient access
          permissions.
        </p>
        <button
          type="button"
          onClick={() => router.push(config.ordersListPath)}
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-650 hover:underline dark:text-blue-400"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  if (!detail) {
    return <PortalBusyOverlay active message="Loading order details…" />;
  }

  return (
    <div className="h-[calc(100vh-150px)] md:h-[calc(100vh-160px)] flex flex-col min-h-0 overflow-hidden space-y-0 pb-20 md:pb-0 font-sans select-none">
      {transitioningTo && (
        <LargeModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
            <div className="w-full max-w-md rounded-xl border border-slate-200/90 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 capitalize">
                Transition to {transitioningTo.replace(/_/g, " ")}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {transitioningTo === "finance_rejected"
                  ? "Please specify the reason for rejection (required)."
                  : "Confirm transition and add comments."}
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 font-sans">
                    {transitioningTo === "finance_rejected"
                      ? "Rejection Reason (Required)"
                      : "Remarks / Action Notes (Optional)"}
                  </label>
                  <textarea
                    value={transitionRemarks}
                    onChange={(e) => setTransitionRemarks(e.target.value)}
                    rows={3}
                    className="w-full mt-1.5 rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 dark:border-white/15 dark:bg-slate-955 dark:text-slate-50 font-sans"
                    placeholder={
                      transitioningTo === "finance_rejected"
                        ? "Type rejection reason..."
                        : "Provide notes for this transition..."
                    }
                  />
                </div>

                <WorkflowEmailControls
                  order={detail}
                  scope={
                    transitioningTo === "finance_rejected"
                      ? "finance_reject"
                      : transitioningTo === "account_rejected"
                        ? "account_reject"
                        : transitioningTo === "on_hold"
                          ? "on_hold"
                          : transitioningTo === "cancelled"
                            ? "cancelled"
                            : transitioningTo === "delivered"
                              ? "delivered"
                              : transitioningTo === "in_transit"
                                ? "in_transit"
                                : "generic"
                  }
                  value={transitionEmailOptions}
                  onChange={setTransitionEmailOptions}
                />
              </div>
              <div className="mt-6 flex justify-end gap-3 font-sans font-medium">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTransitioningTo(null);
                    setTransitionRemarks("");
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={() => void handleTransition(transitioningTo)}>
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        </LargeModalPortal>
      )}

      {confirmResolveOpen && (
        <LargeModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
            <div className="w-full max-w-md rounded-xl border border-slate-200/90 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Confirm Resolve Partial Release
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                This will set ordered quantities to the approved amounts and mark
                the order as fully finance approved.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setConfirmResolveOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => void handleResolveOrder()}>
                  Confirm Resolve
                </Button>
              </div>
            </div>
          </div>
        </LargeModalPortal>
      )}

      <ItemFulfillmentDetailsModal
        isOpen={isFulfillmentModalOpen}
        onClose={() => setIsFulfillmentModalOpen(false)}
        order={detail}
        fulfillmentSnapshot={fulfillmentSnapshot}
        returns={returns}
        dispatches={dispatches}
      />

      <OrderDetailsModal
        isOpen={isOrderDetailsModalOpen}
        onClose={() => setIsOrderDetailsModalOpen(false)}
        detail={detail}
        createdBy={createdBy}
        resolveUser={resolveUser}
        activeTransportInfo={activeTransportInfo}
        onEditAddress={() => setIsUpdateAddressModalOpen(true)}
      />

      <PartyDetailsModal
        isOpen={isPartyDetailsModalOpen}
        onClose={() => setIsPartyDetailsModalOpen(false)}
        isFetching={partyDetailQ.isFetching}
        isError={partyDetailQ.isError}
        partyData={partyDetailQ.data}
        custLabel={custLabel}
        onEditAddress={() => setIsUpdateAddressModalOpen(true)}
      />

      <UpdatePartyAddressModal
        isOpen={isUpdateAddressModalOpen}
        onClose={() => setIsUpdateAddressModalOpen(false)}
        partyId={effectivePartyId || currentPartyId}
        orderId={orderId}
        isLocked={isOrderClosed(status)}
        partyName={custLabel}
        initialBillingAddress={
          (detail?.billing_address as Record<string, unknown>) ||
          ((partyDetailQ.data as Record<string, unknown>)?.billing_address as Record<string, unknown>) ||
          (((detail?.party || detail?.customer) as Record<string, unknown>)?.billing_address as Record<string, unknown>)
        }
        initialShippingAddress={
          (detail?.shipping_address as Record<string, unknown>) ||
          ((partyDetailQ.data as Record<string, unknown>)?.shipping_address as Record<string, unknown>) ||
          (((detail?.party || detail?.customer) as Record<string, unknown>)?.shipping_address as Record<string, unknown>)
        }
        shippingAddresses={
          ((partyDetailQ.data as any)?.shipping_addresses as any[]) || []
        }
        onSuccess={() => {
          void partyDetailQ.refetch();
          handleRefetch();
        }}
      />

      <TransportPlanModal
        isOpen={isTransportPlanModalOpen}
        onClose={() => setIsTransportPlanModalOpen(false)}
        orderId={orderId}
        orderNo={orderNo}
        custLabel={custLabel}
      />

      {hasHeaderAction(config, "final_statement") && (
        <FinalOrderStatementModal
          orderId={orderId}
          isOpen={isFinalStatementOpen}
          onClose={() => setIsFinalStatementOpen(false)}
          portalLabel={config.portalLabel}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-shrink-0 mb-1.5">
          <div className="rounded-lg border border-slate-200/80 bg-white p-2 shadow-xs dark:border-white/10 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
              {/* Back button & Breadcrumbs */}
              <div className="flex items-center gap-1.5 text-2xs text-slate-500 dark:text-slate-400 shrink-0">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20 transition cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Back</span>
                </button>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => router.push(config.ordersListPath)}
                  className="font-medium text-blue-650 hover:underline dark:text-blue-400"
                >
                  Orders
                </button>
                <span>/</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Details
                </span>
                <span className="ml-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wider text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  {config.portalLabel}
                </span>
              </div>

              {/* Unified Top Action Panel */}
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 font-sans font-medium text-2xs">
                {/* Order Info */}
                <button
                  type="button"
                  onClick={() => setIsOrderDetailsModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-white px-2 py-1 text-2xs font-semibold text-slate-700 shadow-xs transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/5 cursor-pointer active:scale-[0.97]"
                >
                  <span>Order Info</span>
                </button>

                {/* Party Info */}
                <button
                  type="button"
                  onClick={() => setIsPartyDetailsModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-white px-2 py-1 text-2xs font-semibold text-slate-700 shadow-xs transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/5 cursor-pointer active:scale-[0.97]"
                >
                  <span>Party Info</span>
                </button>

                {/* Address (renamed from "Update Billing & Shipping Address") */}
                <button
                  type="button"
                  disabled={!effectivePartyId && !currentPartyId && !orderId}
                  onClick={() => setIsUpdateAddressModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50/80 hover:bg-blue-100/90 px-2 py-1 text-2xs font-semibold text-blue-800 shadow-xs transition dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50 cursor-pointer active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                  title={effectivePartyId || currentPartyId || orderId ? "Update billing & shipping addresses" : "No party or order linked"}
                >
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>Address</span>
                </button>

                {/* Details (Fulfillment Details) */}
                <button
                  type="button"
                  onClick={() => setIsFulfillmentModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 hover:bg-amber-100/80 px-2 py-1 text-2xs font-semibold text-amber-800 shadow-xs transition dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50 cursor-pointer active:scale-[0.97]"
                  title="Fulfillment details"
                >
                  <span>Details</span>
                </button>

                {/* Refresh */}
                <button
                  type="button"
                  onClick={handleRefetch}
                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 hover:bg-white p-1 text-slate-600 shadow-xs transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/5 cursor-pointer active:scale-[0.97]"
                  title="Refresh order"
                >
                  <RotateCw className="h-3 w-3" />
                </button>

                {/* Transport Plan (if unassigned) */}
                {!(activeTransportInfo?.agentName || activeTransportInfo?.scheduledDate) && (
                  <button
                    type="button"
                    onClick={() => setIsTransportPlanModalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 hover:bg-amber-100/80 px-2 py-1 text-2xs font-semibold text-amber-800 shadow-xs transition dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50 cursor-pointer active:scale-[0.98]"
                  >
                    <Truck className="h-3 w-3" />
                    <span>Transport Plan</span>
                  </button>
                )}

                {/* Active Transport Info Chip (if assigned) */}
                {(activeTransportInfo?.agentName || activeTransportInfo?.scheduledDate) && (
                  <div className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-2xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 ring-1 ring-inset ring-amber-600/25 shadow-xs">
                    <Truck className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                      {activeTransportInfo.agentName ? (
                        <span>Agent: <b>{activeTransportInfo.agentName}</b></span>
                      ) : null}
                      {activeTransportInfo.scheduledDate ? (
                        <span>
                          {activeTransportInfo.agentName ? " • " : ""}Dispatch: <b>{formatDateShort(activeTransportInfo.scheduledDate)}</b>
                        </span>
                      ) : null}
                    </span>
                  </div>
                )}

                {/* Resolve Order */}
                {hasHeaderAction(config, "resolve_order") &&
                  totalApproved > 0 &&
                  hasRemainingQty && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmResolveOpen(true)}
                      className="rounded-md bg-indigo-600 px-2 py-1 text-2xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98] cursor-pointer"
                    >
                      Resolve Order
                    </button>
                  )}

                {/* Hold */}
                {hasHeaderAction(config, "hold") && (
                  <button
                    type="button"
                    disabled={!canHold || busy}
                    title={lockReason}
                    onClick={() => setTransitioningTo("on_hold")}
                    className="rounded-md bg-amber-600 px-2 py-1 text-2xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98] cursor-pointer"
                  >
                    Hold
                  </button>
                )}

                {/* Resume */}
                {hasHeaderAction(config, "resume") &&
                  config.resumeTargetStatus && (
                    <button
                      type="button"
                      disabled={!canResume || busy}
                      onClick={() =>
                        setTransitioningTo(config.resumeTargetStatus!)
                      }
                      className="rounded-md bg-blue-600 px-2 py-1 text-2xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98] cursor-pointer"
                    >
                      {resumeLabel}
                    </button>
                  )}

                {/* Reject */}
                {hasHeaderAction(config, "reject") && (
                  <button
                    type="button"
                    disabled={!canReject || busy}
                    title={lockReason}
                    onClick={() => setTransitioningTo("finance_rejected")}
                    className="rounded-md bg-rose-600 px-2 py-1 text-2xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98] cursor-pointer"
                  >
                    Reject
                  </button>
                )}

                {/* Cancel */}
                {hasHeaderAction(config, "cancel") && (
                  <button
                    type="button"
                    disabled={!canCancel || busy}
                    title={lockReason}
                    onClick={() => setTransitioningTo("cancelled")}
                    className="rounded-md bg-rose-600 px-2 py-1 text-2xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98] cursor-pointer"
                  >
                    Cancel
                  </button>
                )}

                {/* Final Order Statement */}
                {hasHeaderAction(config, "final_statement") &&
                  canShowFinalStatement && (
                    <button
                      type="button"
                      onClick={() => setIsFinalStatementOpen(true)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80 px-2 py-1 text-2xs font-semibold text-emerald-800 shadow-xs transition dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50 cursor-pointer active:scale-[0.97]"
                    >
                      <span>Final Order Statement</span>
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:block flex-1 min-h-0 overflow-y-auto pr-1">
          <OrderDetailTabContent {...tabContentProps} />
        </div>

        <div className="hidden md:block mb-0 flex-shrink-0 border-t border-slate-800 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md px-2 py-1 [&_nav]:pb-0 shadow-lg">
          <OrderDetailTabsNav
            className="!mb-0 !rounded-none !border-0 !bg-transparent !p-0"
            tabs={desktopTabs}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as OrderDetailTabId)}
            variant="dark"
          />
        </div>

        {mobileTabOpen && (
          <div className="md:hidden fixed inset-0 z-[60] flex flex-col bg-white dark:bg-slate-900 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 sticky top-0 z-10">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-550 capitalize">
                {TAB_LABELS[activeTab] ?? activeTab}
              </h2>
              <button
                type="button"
                onClick={() => setMobileTabOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition active:scale-95"
                aria-label="Close panel"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-24">
              <OrderDetailTabContent {...tabContentProps} />
            </div>
          </div>
        )}

        {!isFetching && !isError && detail && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md px-2 pb-safe">
            <nav className="flex items-stretch justify-around overflow-x-auto">
              {effectiveTabs.map((tabId) => {
                const isActive = activeTab === tabId && mobileTabOpen;
                const count = tabCounts[tabId] ?? 0;
                const hasData = count > 0;
                const dangerBadge = tabId === "flags";
                return (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => {
                      if (activeTab === tabId && mobileTabOpen) {
                        setMobileTabOpen(false);
                      } else {
                        setActiveTab(tabId);
                        setMobileTabOpen(true);
                      }
                    }}
                    className={`relative flex flex-col items-center justify-center gap-0.5 py-2 px-2 flex-1 min-w-0 transition-colors ${
                      isActive
                        ? "text-white"
                        : hasData
                          ? "text-slate-300 hover:text-white"
                          : "text-slate-500 hover:text-slate-400"
                    }`}
                  >
                    <span
                      className={`relative transition-transform ${isActive ? "scale-110" : ""}`}
                    >
                      {mobileTabIcon(tabId)}
                      <span
                        className={`absolute -top-1.5 -right-2 min-w-[1rem] h-3.5 flex items-center justify-center rounded-full px-1 text-3xs font-bold ring-1 ring-slate-900 ${
                          hasData
                            ? dangerBadge
                              ? "bg-rose-500 text-white"
                              : "bg-emerald-500 text-slate-950 font-extrabold"
                            : "bg-slate-800 text-slate-500 ring-slate-700/60"
                        }`}
                      >
                        {count}
                      </span>
                    </span>
                    <span
                      className={`text-2xs font-semibold leading-none truncate max-w-full ${
                        isActive
                          ? "text-white font-bold"
                          : hasData
                            ? "text-slate-300"
                            : "text-slate-500"
                      }`}
                    >
                      {MOBILE_TAB_SHORT_LABELS[tabId] ?? tabId}
                    </span>
                    {isActive && (
                      <span className="absolute top-0 left-2 right-2 h-0.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
