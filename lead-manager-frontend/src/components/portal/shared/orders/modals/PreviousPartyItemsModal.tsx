"use client";

import { useMemo, useState } from "react";
import {
  useListOrdersQuery,
  useGetPartyCatalogQuery,
} from "@/store/api";
import { asRecordArray } from "@/components/portal/shared/lib/records";
import { inr, fmtDate } from "@/components/portal/shared/lib/format";
import { ModalOverlay } from "@/components/portal/shared/ModalOverlay";
import {
  Search,
  History,
  BookmarkCheck,
  Plus,
  Check,
  Package,
  Calendar,
  FileText,
  Sparkles,
  X,
} from "lucide-react";

export type QuickAddProductPayload = {
  productId: string;
  product_name?: string;
  sku?: string;
  unit?: string;
  quantity: number;
  free_qty: number;
  unit_price: number;
  rate_type: "SR" | "SRA" | "CR" | "MANUAL";
  discount_percent: number;
  gst_percent: number;
  remarks?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  partyId: string;
  partyName: string;
  existingProductIds: Set<string>;
  onAddItems: (items: QuickAddProductPayload[]) => void;
};

type AggregatedHistoryItem = {
  key: string;
  productId: string;
  product_name: string;
  sku: string;
  unit: string;
  lastOrderNo: string;
  lastOrderDate: string;
  lastQuantity: number;
  lastFreeQty: number;
  lastUnitPrice: number;
  lastRateType: "SR" | "SRA" | "CR" | "MANUAL";
  lastDiscountPercent: number;
  lastGstPercent: number;
  timesOrdered: number;
  totalQtyOrdered: number;
};

export function PreviousPartyItemsModal({
  open,
  onClose,
  partyId,
  partyName,
  existingProductIds,
  onAddItems,
}: Props) {
  const [tab, setTab] = useState<"history" | "orders" | "catalog">("history");
  const [search, setSearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Record<string, QuickAddProductPayload>>({});

  const { data: ordersRaw, isLoading: loadingOrders } = useListOrdersQuery(
    { party: partyId },
    { skip: !open || !partyId }
  );

  const { data: catalogRaw, isLoading: loadingCatalog } = useGetPartyCatalogQuery(
    partyId,
    { skip: !open || !partyId }
  );

  const partyOrders = useMemo(() => {
    const all = asRecordArray(ordersRaw);
    return all
      .filter((o) => {
        const p = o.party;
        const pid =
          typeof p === "object" && p !== null
            ? String((p as { _id?: unknown })._id ?? "")
            : String(p ?? "");
        return pid === partyId;
      })
      .sort((a, b) => {
        const da = new Date(String(a.order_date ?? a.createdAt ?? 0)).getTime();
        const db = new Date(String(b.order_date ?? b.createdAt ?? 0)).getTime();
        return db - da;
      });
  }, [ordersRaw, partyId]);

  const aggregatedItems = useMemo(() => {
    const map = new Map<string, AggregatedHistoryItem>();

    for (const order of partyOrders) {
      const orderNo = String(order.order_no ?? order.order_number ?? "—");
      const orderDate = String(order.order_date ?? order.createdAt ?? "");
      const items = Array.isArray(order.order_items)
        ? (order.order_items as Record<string, unknown>[])
        : [];

      for (const item of items) {
        const prodRef = item.product;
        const pid =
          typeof prodRef === "object" && prodRef !== null
            ? String((prodRef as { _id?: unknown })._id ?? "")
            : String(prodRef ?? "");
        if (!pid) continue;

        const qty = Number(item.ordered_quantity ?? item.quantity ?? 1) || 1;
        const freeQty = Number(item.free_quantity ?? item.free_qty ?? 0) || 0;
        const price = Number(item.unit_price ?? 0) || 0;
        const rawRate = String(item.applied_rate_type ?? "SR").toUpperCase();
        const rateType: "SR" | "SRA" | "CR" =
          rawRate === "SRA" || rawRate === "CR" ? rawRate : "SR";
        const disc = Number(item.discount_percent ?? 0) || 0;
        const gst = Number(item.gst_percent ?? 18) || 0;

        const existing = map.get(pid);
        if (!existing) {
          map.set(pid, {
            key: `hist_${pid}`,
            productId: pid,
            product_name: String(
              item.product_name ??
                (typeof prodRef === "object" && prodRef !== null
                  ? (prodRef as { product_name?: unknown }).product_name
                  : "") ??
                "Product"
            ),
            sku: String(item.sku ?? ""),
            unit: String(item.unit ?? "pcs"),
            lastOrderNo: orderNo,
            lastOrderDate: orderDate,
            lastQuantity: qty,
            lastFreeQty: freeQty,
            lastUnitPrice: price,
            lastRateType: rateType,
            lastDiscountPercent: disc,
            lastGstPercent: gst,
            timesOrdered: 1,
            totalQtyOrdered: qty,
          });
        } else {
          existing.timesOrdered += 1;
          existing.totalQtyOrdered += qty;
        }
      }
    }

    return Array.from(map.values());
  }, [partyOrders]);

  const catalogItems = useMemo(() => {
    return asRecordArray(catalogRaw);
  }, [catalogRaw]);

  const q = search.trim().toLowerCase();

  const filteredAggregated = useMemo(() => {
    if (!q) return aggregatedItems;
    return aggregatedItems.filter(
      (it) =>
        it.product_name.toLowerCase().includes(q) ||
        it.sku.toLowerCase().includes(q) ||
        it.lastOrderNo.toLowerCase().includes(q)
    );
  }, [aggregatedItems, q]);

  const filteredOrders = useMemo(() => {
    if (!q) return partyOrders;
    return partyOrders.filter((o) => {
      const no = String(o.order_no ?? o.order_number ?? "").toLowerCase();
      if (no.includes(q)) return true;
      const items = Array.isArray(o.order_items)
        ? (o.order_items as Record<string, unknown>[])
        : [];
      return items.some((it) =>
        String(it.product_name ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [partyOrders, q]);

  const filteredCatalog = useMemo(() => {
    if (!q) return catalogItems;
    return catalogItems.filter((c) => {
      const prod = (c.product as Record<string, unknown>) ?? {};
      const name = String(
        c.party_product_name ?? prod.product_name ?? prod.name ?? ""
      ).toLowerCase();
      const sku = String(c.party_product_code ?? prod.sku ?? "").toLowerCase();
      return name.includes(q) || sku.includes(q);
    });
  }, [catalogItems, q]);

  if (!open) return null;

  const toggleSelect = (key: string, payload: QuickAddProductPayload) => {
    setSelectedKeys((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = payload;
      }
      return next;
    });
  };

  const handleAddSingle = (payload: QuickAddProductPayload) => {
    onAddItems([payload]);
  };

  const handleAddSelected = () => {
    const list = Object.values(selectedKeys);
    if (!list.length) return;
    onAddItems(list);
    setSelectedKeys({});
    onClose();
  };

  const handleLoadEntireOrder = (order: Record<string, unknown>) => {
    const items = Array.isArray(order.order_items)
      ? (order.order_items as Record<string, unknown>[])
      : [];
    const payloads: QuickAddProductPayload[] = [];

    for (const item of items) {
      const prodRef = item.product;
      const pid =
        typeof prodRef === "object" && prodRef !== null
          ? String((prodRef as { _id?: unknown })._id ?? "")
          : String(prodRef ?? "");
      if (!pid) continue;

      const rawRate = String(item.applied_rate_type ?? "SR").toUpperCase();
      const rateType: "SR" | "SRA" | "CR" | "MANUAL" =
        rawRate === "SRA" || rawRate === "CR" || rawRate === "MANUAL" ? (rawRate as any) : "SR";

      payloads.push({
        productId: pid,
        product_name: String(item.product_name ?? ""),
        sku: String(item.sku ?? ""),
        unit: String(item.unit ?? ""),
        quantity: Number(item.ordered_quantity ?? item.quantity ?? 1) || 1,
        free_qty: Number(item.free_quantity ?? item.free_qty ?? 0) || 0,
        unit_price: Number(item.unit_price ?? 0) || 0,
        rate_type: rateType,
        discount_percent: Number(item.discount_percent ?? 0) || 0,
        gst_percent: Number(item.gst_percent ?? 18) || 0,
        remarks: String(item.remarks ?? ""),
      });
    }

    if (payloads.length) {
      onAddItems(payloads);
      onClose();
    }
  };

  const selectedCount = Object.keys(selectedKeys).length;

  return (
    <ModalOverlay onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5">
          <h3 className="text-sm font-bold text-slate-900">
            {`Previous Products & Orders — ${partyName || "Selected Party"}`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
        {/* Top bar: Tabs + Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab("history")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                tab === "history"
                  ? "bg-white text-teal-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Previously Ordered Products ({aggregatedItems.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("orders")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                tab === "orders"
                  ? "bg-white text-teal-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Past Orders ({partyOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("catalog")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                tab === "catalog"
                  ? "bg-white text-teal-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BookmarkCheck className="h-3.5 w-3.5" />
              Mapped Party Rates ({catalogItems.length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter product, SKU or order #..."
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-8 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Tab 1: Aggregated Previously Ordered Products */}
        {tab === "history" && (
          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200">
            {loadingOrders ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Loading party order history…
              </div>
            ) : filteredAggregated.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">
                  No previously ordered products found for this party.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Check the &ldquo;Mapped Party Rates&rdquo; tab for pre-configured party catalog rates.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  <tr>
                    <th className="w-10 px-3 py-2.5 text-center">Pick</th>
                    <th className="px-3 py-2.5">Product</th>
                    <th className="px-3 py-2.5">Last Order</th>
                    <th className="px-3 py-2.5 text-center">Orders Count</th>
                    <th className="px-3 py-2.5 text-right">Last Qty</th>
                    <th className="px-3 py-2.5 text-center">Rate Type</th>
                    <th className="px-3 py-2.5 text-right">Last Price</th>
                    <th className="px-3 py-2.5 text-right">Disc %</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAggregated.map((it) => {
                    const isSelected = Boolean(selectedKeys[it.key]);
                    const alreadyInOrder = existingProductIds.has(it.productId);
                    const payload: QuickAddProductPayload = {
                      productId: it.productId,
                      product_name: it.product_name,
                      sku: it.sku,
                      unit: it.unit,
                      quantity: it.lastQuantity,
                      free_qty: it.lastFreeQty,
                      unit_price: it.lastUnitPrice,
                      rate_type: it.lastRateType,
                      discount_percent: it.lastDiscountPercent,
                      gst_percent: it.lastGstPercent,
                    };

                    return (
                      <tr
                        key={it.key}
                        onClick={() => toggleSelect(it.key, payload)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-teal-50/70"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {it.product_name}
                            </span>
                            {alreadyInOrder && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                In Order
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {it.sku ? `SKU: ${it.sku}` : ""}
                            {it.sku && it.unit ? " · " : ""}
                            {it.unit ? `Unit: ${it.unit}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-800">{it.lastOrderNo}</div>
                          <div className="text-[11px] text-slate-400">
                            {fmtDate(it.lastOrderDate)}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {it.timesOrdered}× ({it.totalQtyOrdered} total)
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                          {it.lastQuantity}
                          {it.lastFreeQty > 0 ? (
                            <span className="ml-1 text-[10px] text-teal-600">
                              (+{it.lastFreeQty} free)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            {it.lastRateType}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                          {inr(it.lastUnitPrice)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-600">
                          {it.lastDiscountPercent > 0 ? `${it.lastDiscountPercent}%` : "—"}
                        </td>
                        <td
                          className="px-3 py-2.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleAddSingle(payload)}
                            className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-100"
                          >
                            <Plus className="h-3 w-3" />
                            Add
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Past Orders (Repeat Whole Order or Pick from Specific Order) */}
        {tab === "orders" && (
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {loadingOrders ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Loading past orders…
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-lg border border-slate-200 py-12 text-center text-sm text-slate-500">
                No previous orders found for this party.
              </div>
            ) : (
              filteredOrders.map((order, idx) => {
                const oid = String(order._id ?? order.id ?? idx);
                const orderNo = String(order.order_no ?? order.order_number ?? "—");
                const orderDate = fmtDate(order.order_date ?? order.createdAt);
                const status = String(order.status ?? "draft").replace(/_/g, " ");
                const grandTotal = Number(order.grand_total ?? 0);
                const items = Array.isArray(order.order_items)
                  ? (order.order_items as Record<string, unknown>[])
                  : [];

                return (
                  <div
                    key={oid}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-900">
                          {orderNo}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Calendar className="h-3 w-3" />
                          {orderDate}
                        </span>
                        <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700 uppercase">
                          {status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-900">
                          Total: {inr(grandTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleLoadEntireOrder(order)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          <Sparkles className="h-3 w-3" />
                          Load All {items.length} Items
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 px-4 py-1">
                      {items.map((item, iIdx) => {
                        const prodRef = item.product;
                        const pid =
                          typeof prodRef === "object" && prodRef !== null
                            ? String((prodRef as { _id?: unknown })._id ?? "")
                            : String(prodRef ?? "");
                        const pName = String(item.product_name ?? "Product");
                        const qty = Number(item.ordered_quantity ?? item.quantity ?? 1) || 1;
                        const freeQty = Number(item.free_quantity ?? 0) || 0;
                        const price = Number(item.unit_price ?? 0) || 0;
                        const rawRate = String(item.applied_rate_type ?? "SR").toUpperCase();
                        const rateType: "SR" | "SRA" | "CR" =
                          rawRate === "SRA" || rawRate === "CR" ? rawRate : "SR";
                        const disc = Number(item.discount_percent ?? 0) || 0;
                        const gst = Number(item.gst_percent ?? 18) || 0;

                        return (
                          <div
                            key={`${oid}_${iIdx}`}
                            className="flex items-center justify-between gap-2 py-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-slate-800">{pName}</span>
                              {item.sku ? (
                                <span className="ml-2 text-[11px] text-slate-400">
                                  ({String(item.sku)})
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-4 text-slate-600">
                              <span>
                                Qty: <strong className="text-slate-900">{qty}</strong>
                                {freeQty > 0 ? ` (+${freeQty} free)` : ""}
                              </span>
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                {rateType}
                              </span>
                              <span className="w-24 text-right font-semibold text-slate-900">
                                {inr(price)}
                              </span>
                              { pid ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAddSingle({
                                      productId: pid,
                                      product_name: pName,
                                      sku: String(item.sku ?? ""),
                                      unit: String(item.unit ?? ""),
                                      quantity: qty,
                                      free_qty: freeQty,
                                      unit_price: price,
                                      rate_type: rateType,
                                      discount_percent: disc,
                                      gst_percent: gst,
                                      remarks: String(item.remarks ?? ""),
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-teal-700 hover:bg-teal-50"
                                >
                                  <Plus className="h-3 w-3" /> Add
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 3: Mapped Party Catalog Rates */}
        {tab === "catalog" && (
          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200">
            {loadingCatalog ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Loading mapped party catalog…
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No mapped party catalog rates found for this party.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  <tr>
                    <th className="w-10 px-3 py-2.5 text-center">Pick</th>
                    <th className="px-3 py-2.5">Product</th>
                    <th className="px-3 py-2.5 text-center">Default Rate</th>
                    <th className="px-3 py-2.5 text-right">Active Rate (₹)</th>
                    <th className="px-3 py-2.5 text-right">Min Qty</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredCatalog.map((c, idx) => {
                    const prod = (c.product as Record<string, unknown>) ?? {};
                    const pid = String(prod._id ?? prod.id ?? c.product ?? "");
                    if (!pid) return null;

                    const key = `cat_${pid}_${idx}`;
                    const pName = String(
                      c.party_product_name ?? prod.product_name ?? prod.name ?? "Product"
                    );
                    const sku = String(c.party_product_code ?? prod.sku ?? "");
                    const unit = String(c.preferred_unit ?? prod.unit ?? "pcs");
                    const rawDefRate = String(c.default_rate_type ?? "SR").toUpperCase();
                    const defRateType: "SR" | "SRA" | "CR" =
                      rawDefRate === "SRA" || rawDefRate === "CR" ? rawDefRate : "SR";

                    const rates = Array.isArray(c.rates)
                      ? (c.rates as Record<string, unknown>[])
                      : [];
                    const matchedRateObj =
                      rates.find(
                        (r) => String(r.rate_type ?? "").toUpperCase() === defRateType
                      ) ?? rates[0];

                    const price = Number(
                      matchedRateObj?.rate ?? prod.base_price ?? prod.mrp ?? 0
                    );
                    const minQty = Math.max(1, Number(c.min_order_qty ?? 1) || 1);
                    const gst = Number(prod.gst_percent ?? 18) || 0;

                    const payload: QuickAddProductPayload = {
                      productId: pid,
                      product_name: pName,
                      sku,
                      unit,
                      quantity: minQty,
                      free_qty: 0,
                      unit_price: price,
                      rate_type: defRateType,
                      discount_percent: 0,
                      gst_percent: gst,
                    };

                    const isSelected = Boolean(selectedKeys[key]);

                    return (
                      <tr
                        key={key}
                        onClick={() => toggleSelect(key, payload)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-teal-50/70" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">{pName}</div>
                          <div className="text-[11px] text-slate-400">
                            {sku ? `SKU: ${sku}` : ""}
                            {sku && unit ? " · " : ""}
                            {unit ? `Unit: ${unit}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            {defRateType}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                          {inr(price)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-600">
                          {minQty}
                        </td>
                        <td
                          className="px-3 py-2.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleAddSingle(payload)}
                            className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-100"
                          >
                            <Plus className="h-3 w-3" />
                            Add
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <div className="text-xs text-slate-500">
            {selectedCount > 0 ? (
              <span className="font-semibold text-teal-700">
                {selectedCount} product(s) selected
              </span>
            ) : (
              "Click rows to select multiple products or click + Add on any row."
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Done
            </button>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={handleAddSelected}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700"
              >
                <Check className="h-3.5 w-3.5" />
                Add {selectedCount} Selected to Order
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    </ModalOverlay>
  );
}

