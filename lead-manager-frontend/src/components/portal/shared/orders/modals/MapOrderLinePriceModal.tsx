"use client";

import { useEffect, useMemo, useState } from "react";
import { DollarSign, Package, X, AlertTriangle, Lock } from "lucide-react";

import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { toast } from "@/lib/toast";
import {
  useAddPartyProductRateMutation,
  useCreatePartyProductMutation,
  usePatchPartyProductMutation,
  useGetPartyProductQuery,
  useGetPartyQuery,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { usePortalSettings } from "@/hooks/usePortalSettings";
import { LargeModalPortal } from "@/components/portal/shared/LargeModalPortal";

function isSalesOrExecutive(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;
  const u = user as any;
  const dept = String(u.department?.code || u.department?.name || u.department || "").toLowerCase();
  if (dept === "sales") return true;
  const roles = [
    ...(Array.isArray(u.roles) ? u.roles : []),
    ...(Array.isArray(u.role_codes) ? u.role_codes : []),
    ...(Array.isArray(u.access_roles) ? u.access_roles : []),
  ].map((r: any) => String(typeof r === "object" ? r.code || r.name : r).toLowerCase());
  if (roles.includes("admin") || roles.includes("super_admin") || roles.includes("superadmin")) {
    return false;
  }
  if (roles.some((r) => r === "sales" || r === "sales_executive" || r === "executive" || r.includes("executive"))) {
    return true;
  }
  if (Array.isArray(u.portals)) {
    for (const p of u.portals) {
      const pRoles = (Array.isArray(p.access_roles) ? p.access_roles : [p.access_role, p.role]).filter(Boolean);
      if (pRoles.some((r: any) => ["admin", "super_admin"].includes(String(r).toLowerCase()))) return false;
      if (pRoles.some((r: any) => ["sales", "sales_executive", "executive"].includes(String(r).toLowerCase()))) return true;
    }
  }
  return false;
}

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-white/15 dark:bg-slate-950 dark:text-slate-50";

function defaultValidityEnd(): string {
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  return nextYear.toISOString().split("T")[0];
}

function normalizeRateType(appliedRateType: string): string {
  const t = String(appliedRateType || "SR").toUpperCase();
  if (t === "MANUAL") return "SR";
  if (["SR", "SRA", "CR"].includes(t)) return t;
  return "SR";
}

function toDateString(v: unknown): string {
  if (v == null || v === "") return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

export type MapOrderLinePriceTarget = {
  productId: string;
  productName: string;
  sku?: string;
  appliedRateType: string;
  unitPrice?: number;
  mappingId: string | null;
  isMapped: boolean;
  hasRate: boolean;
};

export type MapOrderLinePriceSuccess = {
  productId: string;
  appliedRateType: string;
  negotiatedRate: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  partyId: string;
  target: MapOrderLinePriceTarget | null;
  onSuccess?: (result: MapOrderLinePriceSuccess) => void;
};

export function MapOrderLinePriceModal({
  open,
  onClose,
  partyId,
  target,
  onSuccess,
}: Props) {
  const [createMapping, { isLoading: isCreating }] = useCreatePartyProductMutation();
  const [addRate, { isLoading: isAddingRate }] = useAddPartyProductRateMutation();
  const [patchMapping, { isLoading: isPatchingMapping }] = usePatchPartyProductMutation();

  const isExistingMapping = Boolean(target?.mappingId);

  const { data: mappingDetail } = useGetPartyProductQuery(
    target?.mappingId ?? "",
    { skip: !target?.mappingId || !open },
  );

  const { data: partyDetail } = useGetPartyQuery(partyId, {
    skip: !partyId || !open,
  });

  const currentUser = useAppSelector((s) => s.auth.user);
  const isSales = isSalesOrExecutive(currentUser);
  const { canSalesMapQuantity, canSalesMapVolume, canSalesMapPrice } = usePortalSettings();
  const priceRestricted = isSales && !canSalesMapPrice;
  const quantityRestricted = isSales && !canSalesMapQuantity;
  const volumeRestricted = isSales && !canSalesMapVolume;

  const [priority, setPriority] = useState("100");
  const [expectedOrderQuantity, setExpectedOrderQuantity] = useState("0");
  const [isOrderable, setIsOrderable] = useState(true);
  const [mappingRemarks, setMappingRemarks] = useState(
    "Mapped from order conversion",
  );

  const rateType = useMemo(
    () => (target ? normalizeRateType(target.appliedRateType) : "SR"),
    [target],
  );
  const [rate, setRate] = useState("");
  const [minQty, setMinQty] = useState("1");
  const [maxQty, setMaxQty] = useState("999999");
  const [validityStart, setValidityStart] = useState(() =>
    new Date().toISOString().split("T")[0],
  );
  const [validityEnd, setValidityEnd] = useState(defaultValidityEnd);
  const [rateRemarks, setRateRemarks] = useState("");

  const busy = isCreating || isAddingRate || isPatchingMapping;

  useEffect(() => {
    if (!open || !target) return;
    setRate(
      target.unitPrice != null && Number(target.unitPrice) > 0
        ? String(target.unitPrice)
        : "",
    );

    const pObj = partyDetail as any;
    if (rateType === "SRA" && pObj && pObj.sra === true) {
      setValidityStart(
        toDateString(pObj.sra_from_date) || new Date().toISOString().split("T")[0],
      );
      setValidityEnd(toDateString(pObj.sra_to_date) || defaultValidityEnd());
    } else {
      setValidityStart(new Date().toISOString().split("T")[0]);
      setValidityEnd(defaultValidityEnd());
    }

    setRateRemarks("");

    if (isExistingMapping && mappingDetail) {
      const md = mappingDetail as any;
      setMappingRemarks(md.remarks || "");
      setPriority(String(md.priority ?? "100"));
      setIsOrderable(md.is_orderable !== false);
      setExpectedOrderQuantity(String(md.expected_order_quantity ?? "0"));
    } else {
      setMappingRemarks("Mapped from order conversion");
      setPriority("100");
      setIsOrderable(true);
      setExpectedOrderQuantity("0");
    }

    setMinQty("1");
    setMaxQty("999999");
  }, [open, target, isExistingMapping, mappingDetail, partyDetail, rateType]);

  if (!open || !target) return null;

  const resetAndClose = () => {
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (priceRestricted) {
      toast.error("Sales role is not authorized to map or modify prices.");
      return;
    }
    if (!partyId || !target.productId) {
      toast.error("Party and product are required.");
      return;
    }
    if (!rate || Number(rate) < 0) {
      toast.error("Please enter a valid negotiated price.");
      return;
    }
    if (new Date(validityStart) >= new Date(validityEnd)) {
      toast.error("Validity start must be before validity end.");
      return;
    }

    const ratePayload = {
      party: partyId,
      product: target.productId,
      rate_type: rateType,
      rate: Number(rate),
      min_qty: Number(minQty) || 1,
      max_qty: Number(maxQty) || 999999,
      validity_start: validityStart,
      validity_end: validityEnd,
      remarks: rateRemarks.trim() || "Negotiated from order line",
    };

    try {
      if (isExistingMapping && target.mappingId) {
        await patchMapping({
          id: target.mappingId,
          patch: {
            priority: Number(priority) || 100,
            expected_order_quantity: Number(expectedOrderQuantity) || 0,
            is_orderable: isOrderable,
            remarks: mappingRemarks.trim(),
          },
        }).unwrap();

        await addRate({
          id: target.mappingId,
          body: ratePayload,
        }).unwrap();
        toast.success("Negotiated rate and mapping updated successfully.");
      } else {
        await createMapping({
          party: partyId,
          product: target.productId,
          priority: Number(priority) || 100,
          expected_order_quantity: Number(expectedOrderQuantity) || 0,
          is_orderable: isOrderable,
          remarks: mappingRemarks.trim(),
          rates: [ratePayload],
        }).unwrap();
        toast.success("Product mapped with negotiated rate.");
      }
      onSuccess?.({
        productId: target.productId,
        appliedRateType: rateType,
        negotiatedRate: Number(rate),
      });
      resetAndClose();
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  };

  const title = isExistingMapping ? "Map price (add rate)" : "Map product & price";
  const submitLabel = isExistingMapping ? "Save rate" : "Map product";

  return (
    <LargeModalPortal>
      <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
        <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-5 dark:border-white/5">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
              <Package className="h-5 w-5 text-blue-500" />
              {title}
            </h3>
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded-full p-1 transition hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex-1 space-y-4 overflow-y-auto p-5"
          >
            {priceRestricted && (
              <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>Access Restricted:</strong> Price mapping is disabled for the Sales role by Super Admin. You cannot enter or update negotiated rates.
                </span>
              </div>
            )}
            {quantityRestricted && (
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/90 p-3 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span>Quantity mapping is locked to system defaults for Sales role.</span>
              </div>
            )}
            {volumeRestricted && (
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/90 p-3 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span>Volume tier threshold mapping (min/max qty) is locked for Sales role.</span>
              </div>
            )}

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-white/5 dark:bg-white/5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Order line
              </div>
              <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-50">
                {target.productName}
              </div>
              {target.sku ? (
                <div className="mt-0.5 font-mono text-xs text-slate-500">
                  SKU {target.sku}
                </div>
              ) : null}
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Rate type on order: <b>{rateType}</b>
                {target.unitPrice != null ? (
                  <>
                    {" "}
                    · Current line price: <b>{target.unitPrice}</b>
                  </>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                Mapping configuration
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Mapping priority
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Expected Order Qty (EOQ) {quantityRestricted && <span className="text-[10px] text-amber-600 dark:text-amber-400">(Locked)</span>}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={expectedOrderQuantity}
                    onChange={(e) => setExpectedOrderQuantity(e.target.value)}
                    disabled={quantityRestricted}
                    className={`${inputClass} ${quantityRestricted ? "bg-slate-100 cursor-not-allowed text-slate-500 dark:bg-slate-800" : ""}`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex h-full items-end pb-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={isOrderable}
                      onChange={(e) => setIsOrderable(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Is orderable
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Mapping remarks
                </label>
                <textarea
                  rows={2}
                  value={mappingRemarks}
                  onChange={(e) => setMappingRemarks(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Approved under party contract"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <DollarSign className="h-4 w-4 text-blue-500" />
                Negotiated rate
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Rate type
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={rateType}
                    className={`${inputClass} bg-slate-100 dark:bg-slate-950/80`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Negotiated price (₹) {priceRestricted && <span className="text-[10px] text-amber-600 dark:text-amber-400">(Restricted)</span>}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    disabled={priceRestricted}
                    required
                    placeholder={priceRestricted ? "Price mapping disabled" : "e.g. 450.00"}
                    className={`${inputClass} ${priceRestricted ? "bg-slate-100 cursor-not-allowed text-slate-500 dark:bg-slate-800" : ""}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Min quantity {volumeRestricted && <span className="text-[10px] text-amber-600 dark:text-amber-400">(Default: 1)</span>}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={minQty}
                    onChange={(e) => setMinQty(e.target.value)}
                    disabled={volumeRestricted}
                    className={`${inputClass} ${volumeRestricted ? "bg-slate-100 cursor-not-allowed text-slate-500 dark:bg-slate-800" : ""}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Max quantity {volumeRestricted && <span className="text-[10px] text-amber-600 dark:text-amber-400">(Default: 999999)</span>}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxQty}
                    onChange={(e) => setMaxQty(e.target.value)}
                    disabled={volumeRestricted}
                    className={`${inputClass} ${volumeRestricted ? "bg-slate-100 cursor-not-allowed text-slate-500 dark:bg-slate-800" : ""}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Validity start
                  </label>
                  <input
                    type="date"
                    value={validityStart}
                    onChange={(e) => setValidityStart(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Validity end
                  </label>
                  <input
                    type="date"
                    value={validityEnd}
                    onChange={(e) => setValidityEnd(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Rate remarks
                </label>
                <textarea
                  rows={2}
                  value={rateRemarks}
                  onChange={(e) => setRateRemarks(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Q3 promotional pricing"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-white/5">
              <button
                type="button"
                onClick={resetAndClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || priceRestricted}
                title={priceRestricted ? "Price mapping is restricted for Sales by Super Admin" : undefined}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Saving..." : priceRestricted ? "Price Mapping Restricted" : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </LargeModalPortal>
  );
}
