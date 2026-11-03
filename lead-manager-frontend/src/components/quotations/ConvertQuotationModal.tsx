"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  useListPartiesQuery,
  useListProductsQuery,
  useListUsersQuery,
  useCheckPartyLineRatesQuery,
  useCreateAttachmentMutation,
  useConvertQuotationMutation,
  useUpdateOrderPerformaMutation,
  type LeadQuotationRecord,
  type CheckOrderRatesItem,
} from "@/store/api";
import { asRecordArray } from "@/components/portal/shared/lib/records";
import { inr } from "@/components/portal/shared/lib/format";
import { useAppSelector } from "@/store/hooks";
import { toast } from "sonner";
import {
  Trash2,
  Plus,
  Search,
  ChevronDown,
  Check,
  Building2,
  UserCheck,
  Package,
  X,
  History,
  FileText,
  ArrowRight,
  ArrowLeft,
  Tag,
  Loader2,
} from "lucide-react";
import {
  PreviousPartyItemsModal,
  type QuickAddProductPayload,
} from "@/components/portal/shared/orders/modals/PreviousPartyItemsModal";
import {
  PerformaInvoiceFields,
  INITIAL_PERFORMA_STATE,
  type PerformaFormState,
} from "@/components/portal/shared/orders/performa/PerformaInvoiceFields";
import {
  OrderAddressSelector,
  type OrderAddressRecord,
} from "@/components/portal/shared/orders/addresses/OrderAddressSelector";
import { PartyDetailModal } from "@/components/portal/shared/parties/modals/PartyDetailModal";
import { ProductDetailModal } from "@/components/portal/shared/products/modals/ProductDetailModal";
import {
  WorkflowEmailControls,
  type WorkflowEmailOptions,
} from "@/components/portal/shared/orders/modals/WorkflowEmailControls";
import { LargeModalPortal } from "@/components/portal/shared/LargeModalPortal";
import {
  MapOrderLinePriceModal,
  type MapOrderLinePriceTarget,
  type MapOrderLinePriceSuccess,
} from "@/components/portal/shared/orders/modals/MapOrderLinePriceModal";
import {
  LineRateStatusBadge,
  rateLookupKey,
  resolveLineUnitPrice,
  resolveRateDisplayStatus,
} from "@/components/portal/shared/orders/lib/orderLineRateDisplay";
import { usePortalSettings } from "@/hooks/usePortalSettings";

function formatMoney(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export interface ConvertQuotationModalProps {
  quotation: LeadQuotationRecord;
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: {
    quotation: LeadQuotationRecord;
    order?: any;
    party_id?: string;
  }) => void;
}

type LineRow = {
  productId: string;
  product_name?: string;
  sku?: string;
  brand?: string;
  manufacturer?: string;
  product_group?: string;
  product_subgroup?: string;
  unit?: string;
  quantity: number;
  free_qty: number;
  unit_price: number;
  rate_type: "SR" | "SRA" | "CR";
  discount_percent: number;
  discount_amount: number;
  gst_percent: number;
  remarks?: string;
  pricing_reference?: string;
  pricing_validity_start?: string;
  pricing_validity_end?: string;
  manual_price_override?: boolean;
  approval_required?: boolean;
  approval_reason?: string;
  rate_mapped?: boolean;
};

function PartyAutocomplete({
  parties,
  value,
  onChange,
  onQuickAdd,
}: {
  parties: Record<string, unknown>[];
  value: string;
  onChange: (id: string) => void;
  onQuickAdd?: (searchQuery: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => parties.find((p) => String(p._id ?? p.id) === value),
    [parties, value],
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return parties.slice(0, 60);
    const lq = q.toLowerCase();
    return parties
      .filter(
        (p) =>
          String(p.party_name ?? p.name ?? "")
            .toLowerCase()
            .includes(lq) ||
          String(p.gst_no ?? "").toLowerCase().includes(lq) ||
          String(p.mobile ?? "").toLowerCase().includes(lq) ||
          String(p.district ?? p.state ?? "")
            .toLowerCase()
            .includes(lq),
      )
      .slice(0, 60);
  }, [parties, q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-[38px] w-full cursor-pointer items-center justify-between rounded-md border bg-white px-3 py-1.5 text-sm transition-all ${open
            ? "border-teal-500 ring-2 ring-teal-500/15"
            : "border-slate-300 hover:border-slate-400"
          }`}
      >
        {selected ? (
          <div className="flex min-w-0 items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-teal-600" />
            <div className="min-w-0">
              <span className="block truncate font-medium text-slate-900">
                {String(selected.party_name ?? selected.name ?? selected._id)}
              </span>
              <span className="block truncate text-[11px] text-slate-500">
                {[
                  selected.party_type
                    ? String(selected.party_type).toUpperCase()
                    : null,
                  selected.district || selected.state
                    ? `${selected.district ?? ""}${selected.district && selected.state ? ", " : ""}${selected.state ?? ""}`
                    : null,
                  selected.gst_no ? `GST: ${selected.gst_no}` : null,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-slate-400">
            Search party by name, GST, city or mobile...
          </span>
        )}
        <ChevronDown
          className={`ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center border-b border-slate-100 px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type party name, GSTIN, city or phone..."
              className="w-full bg-transparent text-xs text-slate-900 focus:outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No matching parties found
              </div>
            ) : (
              filtered.map((p) => {
                const id = String(p._id ?? p.id);
                const isSelected = id === value;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onChange(id);
                      setOpen(false);
                      setQ("");
                    }}
                    className={`flex w-full items-start justify-between rounded-md px-3 py-2 text-left text-xs transition-colors ${isSelected
                        ? "bg-teal-50/80 text-teal-900"
                        : "text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-900">
                        {String(p.party_name ?? p.name ?? id)}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                        {Boolean(p.party_type) && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 font-medium text-slate-600 uppercase">
                            {String(p.party_type)}
                          </span>
                        )}
                        {Boolean(p.district || p.state) && (
                          <span>
                            {[p.district, p.state].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {Boolean(p.gst_no) && <span>GST: {String(p.gst_no)}</span>}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    )}
                  </button>
                );
              })
            )}
          </div>
          {onQuickAdd && (
            <div className="border-t border-slate-100 bg-slate-50/80 p-1.5">
              <button
                type="button"
                onClick={() => {
                  const currentQ = q.trim();
                  setOpen(false);
                  setQ("");
                  onQuickAdd(currentQ);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-teal-700"
              >
                <Plus className="h-3.5 w-3.5" />
                {q.trim() ? `Quick Add "${q.trim()}"` : "Quick Add New Party"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SalesAutocomplete({
  users,
  value,
  onChange,
}: {
  users: Record<string, unknown>[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => users.find((u) => String(u._id ?? u.id) === value),
    [users, value],
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return users;
    const lq = q.toLowerCase();
    return users.filter(
      (u) =>
        String(u.name ?? u.username ?? "")
          .toLowerCase()
          .includes(lq) ||
        String(u.email ?? "").toLowerCase().includes(lq) ||
        String(u.department ?? "").toLowerCase().includes(lq),
    );
  }, [users, q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-[38px] w-full cursor-pointer items-center justify-between rounded-md border bg-white px-3 py-1.5 text-sm transition-all ${open
            ? "border-teal-500 ring-2 ring-teal-500/15"
            : "border-slate-300 hover:border-slate-400"
          }`}
      >
        {selected ? (
          <div className="flex min-w-0 items-center gap-2">
            <UserCheck className="h-4 w-4 shrink-0 text-teal-600" />
            <div className="min-w-0">
              <span className="block truncate font-medium text-slate-900">
                {String(selected.name || selected.username || selected.email)}
              </span>
              <span className="block truncate text-[11px] text-slate-500">
                {[
                  selected.department
                    ? String(selected.department).toUpperCase()
                    : "SALES",
                  selected.email ? String(selected.email) : null,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-slate-400">Select sales representative...</span>
        )}
        <ChevronDown
          className={`ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center border-b border-slate-100 px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search sales rep..."
              className="w-full bg-transparent text-xs text-slate-900 focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No users found
              </div>
            ) : (
              filtered.map((u) => {
                const id = String(u._id ?? u.id);
                const isSelected = id === value;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onChange(id);
                      setOpen(false);
                      setQ("");
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors ${isSelected
                        ? "bg-teal-50/80 text-teal-900"
                        : "text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-900">
                        {String(u.name || u.username || u.email)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {String(u.email ?? "")}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-teal-600" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductAutocomplete({
  products,
  value,
  fallbackName,
  onChange,
  onQuickAdd,
}: {
  products: Record<string, unknown>[];
  value: string;
  fallbackName?: string;
  onChange: (id: string) => void;
  onQuickAdd?: (searchQuery: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => products.find((p) => String(p._id ?? p.id) === value),
    [products, value],
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return products.slice(0, 60);
    const lq = q.toLowerCase();
    return products
      .filter(
        (p) =>
          String(p.product_name ?? p.name ?? "")
            .toLowerCase()
            .includes(lq) ||
          String(p.sku ?? "").toLowerCase().includes(lq) ||
          String(p.generic_name ?? "").toLowerCase().includes(lq) ||
          String(p.brand ?? "").toLowerCase().includes(lq),
      )
      .slice(0, 60);
  }, [products, q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-[34px] w-full cursor-pointer items-center justify-between rounded border bg-white px-2.5 py-1 text-xs transition-all ${open
            ? "border-teal-500 ring-2 ring-teal-500/15"
            : "border-slate-300 hover:border-slate-400"
          }`}
      >
        {selected ? (
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900">
              {String(selected.product_name ?? selected.name ?? selected._id)}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500">
              {Boolean(selected.sku) && <span>SKU: {String(selected.sku)}</span>}
              {Boolean(selected.unit) && (
                <span>
                  Unit:{" "}
                  {typeof selected.unit === "object"
                    ? String((selected.unit as any).name ?? "")
                    : String(selected.unit)}
                </span>
              )}
              <span>GST: {Number(selected.gst_percent ?? 18)}%</span>
            </div>
          </div>
        ) : fallbackName ? (
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900">{fallbackName}</div>
            <div className="text-[10px] text-amber-600">
              Click to link or quick-add to product master
            </div>
          </div>
        ) : (
          <span className="text-slate-400">
            Search product by name, SKU or brand...
          </span>
        )}
        <ChevronDown
          className={`ml-1.5 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-full min-w-[320px] rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center border-b border-slate-100 px-3 py-2">
            <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type product name, SKU or generic name..."
              className="w-full bg-transparent text-xs text-slate-900 focus:outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No matching products found
              </div>
            ) : (
              filtered.map((p) => {
                const id = String(p._id ?? p.id);
                const isSelected = id === value;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onChange(id);
                      setOpen(false);
                      setQ("");
                    }}
                    className={`flex w-full items-start justify-between rounded-md px-3 py-2 text-left text-xs transition-colors ${isSelected
                        ? "bg-teal-50/80 text-teal-900"
                        : "text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                        <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="">
                          {String(p.product_name ?? p.name ?? id)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500">
                        {Boolean(p.sku) && <span>SKU: {String(p.sku)}</span>}
                        <span>SR: {inr(Number(p.base_price ?? 0))}</span>
                        {Boolean(p.mrp) && (
                          <span>MRP: {inr(Number(p.mrp ?? 0))}</span>
                        )}
                        <span>GST: {Number(p.gst_percent ?? 18)}%</span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    )}
                  </button>
                );
              })
            )}
          </div>
          {onQuickAdd && (
            <div className="border-t border-slate-100 bg-slate-50/80 p-1.5">
              <button
                type="button"
                onClick={() => {
                  const currentQ = q.trim();
                  setOpen(false);
                  setQ("");
                  onQuickAdd(currentQ);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-teal-700"
              >
                <Plus className="h-3.5 w-3.5" />
                {q.trim() ? `Quick Add "${q.trim()}"` : "Quick Add New Product"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ConvertQuotationModal({
  quotation,
  open,
  onClose,
  onSuccess,
}: ConvertQuotationModalProps) {
  const currentUser = useAppSelector((s) => s.auth.user);
  const { data: partiesRaw } = useListPartiesQuery({ paginate: "false" });
  const { data: productsRaw } = useListProductsQuery({ paginate: "false" });
  const { data: usersRaw } = useListUsersQuery();

  const [convertQuotation, { isLoading: isConverting }] =
    useConvertQuotationMutation();
  const [createAttachment] = useCreateAttachmentMutation();
  const [updateOrderPerforma] = useUpdateOrderPerformaMutation();

  const parties = useMemo(() => asRecordArray(partiesRaw), [partiesRaw]);
  const products = useMemo(() => asRecordArray(productsRaw), [productsRaw]);
  const salesUsers = useMemo(() => {
    const all = asRecordArray(usersRaw);
    return all.filter((u) => {
      if (u.is_active === false) return false;
      const dept = String(u.department ?? "").toLowerCase();
      if (dept === "sales" || dept === "admin" || dept === "super_admin")
        return true;
      const portals = u.portals as Record<string, any> | undefined;
      const roles: string[] = [
        ...(Array.isArray(portals?.opms?.access_roles)
          ? portals.opms.access_roles
          : []),
        ...(Array.isArray(portals?.lead_manager?.access_roles)
          ? portals.lead_manager.access_roles
          : []),
      ].map((r) => String(r).toLowerCase());
      return (
        roles.includes("sales") ||
        roles.includes("admin") ||
        roles.includes("super_admin") ||
        roles.includes("manager") ||
        roles.includes("executive") ||
        roles.includes("coordinator")
      );
    });
  }, [usersRaw]);

  const {
    isPerformaEnabled,
    isCostSheetEnabled,
    isKycEnabled,
    isPOEnabled,
    isBuyBackEnabled,
    canSalesMapQuantity,
    canSalesMapPrice,
  } = usePortalSettings();

  const isSales = useMemo(() => {
    if (!currentUser || typeof currentUser !== "object") return false;
    const u = currentUser as any;
    const dept = String(u.department?.code || u.department?.name || u.department || "").toLowerCase();
    if (dept === "sales") return true;
    const roles = [
      ...(Array.isArray(u.roles) ? u.roles : []),
      ...(Array.isArray(u.role_codes) ? u.role_codes : []),
      ...(Array.isArray(u.access_roles) ? u.access_roles : []),
    ].map((r: any) => String(typeof r === "object" ? r.code || r.name : r).toLowerCase());
    if (roles.includes("admin") || roles.includes("super_admin") || roles.includes("superadmin")) return false;
    return roles.some((r) => r === "sales" || r === "sales_executive" || r === "executive" || r.includes("executive"));
  }, [currentUser]);

  const priceRestricted = isSales && !canSalesMapPrice;
  const quantityRestricted = isSales && !canSalesMapQuantity;

  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (!isPerformaEnabled && step === 2) {
      setStep(1);
    }
  }, [isPerformaEnabled, step]);
  const [partyId, setPartyId] = useState("");
  const [prevItemsModalOpen, setPrevItemsModalOpen] = useState(false);
  const [quickAddPartyOpen, setQuickAddPartyOpen] = useState(false);
  const [quickPartyInitialName, setQuickPartyInitialName] = useState("");
  const [quickAddProductLineIndex, setQuickAddProductLineIndex] = useState<
    number | null
  >(null);
  const [quickProductInitialName, setQuickProductInitialName] = useState("");
  const [mapPriceModalTarget, setMapPriceModalTarget] =
    useState<MapOrderLinePriceTarget | null>(null);
  const [mapPriceLineIndex, setMapPriceLineIndex] = useState<number | null>(
    null,
  );
  const [billingAddress, setBillingAddress] =
    useState<OrderAddressRecord | null>(null);
  const [shippingAddress, setShippingAddress] =
    useState<OrderAddressRecord | null>(null);
  const [saveShippingToParty, setSaveShippingToParty] = useState(false);
  const [orderDate, setOrderDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [expectedDate, setExpectedDate] = useState("");
  const [assignedSales, setAssignedSales] = useState("");
  const [remarks, setRemarks] = useState("");
  const [performa, setPerforma] = useState<PerformaFormState>(
    INITIAL_PERFORMA_STATE,
  );
  const [emailOptions, setEmailOptions] = useState<WorkflowEmailOptions>({
    send_email: true,
    send_to_party: false,
    recipients: [],
  });
  const [lines, setLines] = useState<LineRow[]>([
    {
      productId: "",
      quantity: 1,
      free_qty: 0,
      unit_price: 0,
      rate_type: "SR",
      discount_percent: 0,
      discount_amount: 0,
      gst_percent: 18,
      remarks: "",
    },
  ]);

  const lineRateCheckInput = useMemo(() => {
    if (!partyId) return null;
    const items = lines
      .filter((l) => l.productId)
      .map((l) => ({
        product: l.productId,
        applied_rate_type: l.rate_type || "SR",
        product_name: l.product_name,
        sku: l.sku,
        unit_price: l.unit_price,
      }));
    if (!items.length) return null;
    return { party: partyId, items };
  }, [partyId, lines]);

  const rateCheckQ = useCheckPartyLineRatesQuery(lineRateCheckInput!, {
    skip: !lineRateCheckInput,
  });

  const rateItemByLine = useMemo(() => {
    const map = new Map<string, CheckOrderRatesItem>();
    for (const item of rateCheckQ.data?.items ?? []) {
      map.set(rateLookupKey(item.product, item.applied_rate_type), item);
    }
    return map;
  }, [rateCheckQ.data]);

  const resolvePriceForLine = useCallback(
    (
      productId: string,
      rateType: string,
      catalogProduct: Record<string, unknown> | undefined,
    ) => {
      const rateItem = productId
        ? rateItemByLine.get(rateLookupKey(productId, rateType))
        : undefined;
      return resolveLineUnitPrice(rateItem, catalogProduct as any, rateType);
    },
    [rateItemByLine],
  );

  // Sync line prices when active negotiated party rates exist and line price is 0
  useEffect(() => {
    if (!rateCheckQ.data?.items?.length) return;
    setLines((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (!row.productId) return row;
        const rateItem = rateItemByLine.get(
          rateLookupKey(row.productId, row.rate_type || "SR"),
        );
        if (!rateItem?.hasRate || rateItem.currentMappedRate == null) return row;
        const negotiated = Number(rateItem.currentMappedRate);
        if (!Number.isFinite(negotiated)) return row;
        const nextPrice = row.unit_price > 0 ? row.unit_price : negotiated;
        const nextRef = rateItem.rateId || row.pricing_reference;
        const nextVs = rateItem.validityStart || row.pricing_validity_start;
        const nextVe = rateItem.validityEnd || row.pricing_validity_end;
        if (
          row.unit_price === nextPrice &&
          row.pricing_reference === nextRef &&
          row.pricing_validity_start === nextVs &&
          row.pricing_validity_end === nextVe
        ) {
          return row;
        }
        changed = true;
        return {
          ...row,
          unit_price: nextPrice,
          pricing_reference: nextRef || undefined,
          pricing_validity_start: nextVs || undefined,
          pricing_validity_end: nextVe || undefined,
          rate_mapped: true,
        };
      });
      return changed ? next : prev;
    });
  }, [rateCheckQ.data, rateItemByLine]);

  const initializedRef = useRef<string | null>(null);

  // Reset initializedRef when modal closes
  useEffect(() => {
    if (!open) {
      initializedRef.current = null;
    }
  }, [open]);

  // Prefill form from Quotation when modal opens
  useEffect(() => {
    if (!open || !quotation) return;
    const initKey = `${quotation._id}_${parties.length > 0 ? "p" : "0"}_${products.length > 0 ? "pr" : "0"}_${salesUsers.length > 0 ? "u" : "0"}`;
    if (initializedRef.current === initKey) return;
    initializedRef.current = initKey;

    setStep(1);

    // 1. Resolve Party from quotation
    let resolvedPartyId = "";
    if (quotation.party_id) {
      const pid =
        typeof quotation.party_id === "object"
          ? String((quotation.party_id as any)._id || "")
          : String(quotation.party_id);
      if (parties.some((p) => String(p._id ?? p.id) === pid)) {
        resolvedPartyId = pid;
      }
    }
    if (!resolvedPartyId && parties.length > 0) {
      const qGst = (quotation.gstin || "").trim().toUpperCase();
      const qName = (quotation.customer_name || "").trim().toLowerCase();
      const matched = parties.find((p) => {
        const pGst = String(p.gst_no || "").trim().toUpperCase();
        const pName = String(p.party_name || p.name || "")
          .trim()
          .toLowerCase();
        if (qGst && pGst && qGst === pGst) return true;
        if (qName && pName && qName === pName) return true;
        return false;
      });
      if (matched) {
        resolvedPartyId = String(matched._id ?? matched.id);
      }
    }
    setPartyId(resolvedPartyId);

    // 2. Dates & Remarks
    const todayStr = new Date().toISOString().split("T")[0];
    setOrderDate(todayStr);
    if (quotation.valid_until) {
      const vu = new Date(quotation.valid_until);
      if (!Number.isNaN(vu.getTime()) && vu >= new Date(todayStr)) {
        setExpectedDate(vu.toISOString().split("T")[0]);
      } else {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        setExpectedDate(nextWeek.toISOString().split("T")[0]);
      }
    } else {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      setExpectedDate(nextWeek.toISOString().split("T")[0]);
    }

    setRemarks(
      quotation.subject || `Converted from Quotation #${quotation.quotation_no}`,
    );

    // 3. Sales Rep
    let initialSalesId = "";
    const spUser = quotation.sales_person_user;
    if (spUser) {
      initialSalesId =
        typeof spUser === "object"
          ? String(spUser._id || "")
          : String(spUser);
    }
    if (!initialSalesId && quotation.sales_person_name && salesUsers.length > 0) {
      const spName = quotation.sales_person_name.trim().toLowerCase();
      const matchedUser = salesUsers.find(
        (u) =>
          String(u.name || u.username || "")
            .trim()
            .toLowerCase() === spName,
      );
      if (matchedUser) {
        initialSalesId = String(matchedUser._id ?? matchedUser.id);
      }
    }
    if (!initialSalesId && quotation.created_by?._id) {
      initialSalesId = String(quotation.created_by._id);
    }
    if (!initialSalesId && currentUser?.id) {
      initialSalesId = String(currentUser.id);
    }
    setAssignedSales(initialSalesId);

    // 4. Line Items from Quotation
    if (Array.isArray(quotation.items) && quotation.items.length > 0) {
      const initialLines: LineRow[] = quotation.items.map((it) => {
        let prodId = it.product ? String(it.product) : "";
        let matchedProd: Record<string, unknown> | undefined;
        if (prodId && products.length > 0) {
          matchedProd = products.find(
            (p) => String(p._id ?? p.id) === prodId,
          );
        }
        if (!matchedProd && it.product_name && products.length > 0) {
          const targetName = it.product_name.trim().toLowerCase();
          matchedProd = products.find(
            (p) =>
              String(p.product_name ?? p.name ?? "")
                .trim()
                .toLowerCase() === targetName,
          );
          if (matchedProd) {
            prodId = String(matchedProd._id ?? matchedProd.id);
          }
        }

        const getLabel = (v: unknown) =>
          typeof v === "object" && v !== null
            ? String((v as { name?: unknown }).name ?? "")
            : String(v ?? "");

        const qty = Math.max(1, Number(it.quantity) || 1);
        const rate = Math.max(0, Number(it.rate) || 0);
        const discPct = Math.max(0, Number(it.discount_percent ?? 0));
        const discAmt =
          discPct > 0
            ? (qty * rate * discPct) / 100
            : Math.max(0, Number(it.discount_amount ?? 0));
        const gstPct = Number(
          it.gst_rate ?? matchedProd?.gst_percent ?? 18,
        );

        return {
          productId: prodId,
          product_name:
            String(matchedProd?.product_name ?? matchedProd?.name ?? "") ||
            it.product_name,
          sku: String(matchedProd?.sku ?? ""),
          brand: matchedProd ? getLabel(matchedProd.brand) : undefined,
          manufacturer: matchedProd
            ? getLabel(matchedProd.manufacturer)
            : undefined,
          product_group: matchedProd
            ? getLabel(matchedProd.product_group)
            : undefined,
          product_subgroup: matchedProd
            ? getLabel(matchedProd.product_subgroup)
            : undefined,
          unit:
            (matchedProd ? getLabel(matchedProd.unit) : "") ||
            it.unit ||
            "Nos",
          quantity: qty,
          free_qty: 0,
          unit_price: rate,
          rate_type: "SR",
          discount_percent: discPct,
          discount_amount: discAmt,
          gst_percent: gstPct,
          remarks: it.description || "",
          rate_mapped: false,
        };
      });

      setLines(initialLines);
    }
  }, [
    open,
    quotation,
    parties,
    products,
    salesUsers,
    currentUser?.id,
  ]);

  // Auto-populate performa defaults when party, sales rep, shipping address, or expected delivery date changes
  useEffect(() => {
    const selectedPartyObj = parties.find(
      (p) => String(p._id ?? p.id) === partyId,
    );
    const selectedSalesObj = salesUsers.find(
      (u) => String(u._id ?? u.id) === assignedSales,
    );

    const salesName = selectedSalesObj
      ? String(
        selectedSalesObj.name ||
        selectedSalesObj.username ||
        selectedSalesObj.email ||
        "",
      )
      : quotation?.sales_person_name || "";

    let shipAddr = "";
    const addrSource =
      shippingAddress ||
      billingAddress ||
      (selectedPartyObj?.shipping_address as Record<string, any> | undefined) ||
      (selectedPartyObj?.billing_address as Record<string, any> | undefined) ||
      quotation?.address;

    if (addrSource && typeof addrSource === "object") {
      const a = addrSource as Record<string, any>;
      shipAddr = [
        a.recipient_name,
        a.address_line_1 || a.address1 || a.line1 || a.street,
        a.address_line_2 || a.address2 || a.line2,
        a.city,
        a.state,
        a.pin_code || a.pincode || a.zip,
        a.country,
      ]
        .filter(Boolean)
        .join(", ");
    }

    const pTerms = selectedPartyObj?.payment_terms
      ? String(selectedPartyObj.payment_terms)
      : quotation?.payment_terms || "";
    const rawPartyType = String(selectedPartyObj?.party_type || "")
      .toLowerCase()
      .trim();
    const mappedCustomerType =
      rawPartyType === "hospital"
        ? "Hospital"
        : rawPartyType === "dealer"
          ? "Dealer"
          : rawPartyType === "distributor"
            ? "Distributor"
            : rawPartyType === "institutional"
              ? "Institutional"
              : rawPartyType === "government" || rawPartyType === "govt"
                ? "Government"
                : "Direct Customer";

    setPerforma((prev) => ({
      ...prev,
      sales_person: salesName || prev.sales_person,
      ship_to_address: shipAddr || prev.ship_to_address,
      payment_terms: pTerms || prev.payment_terms || "30 days",
      customer_type: selectedPartyObj ? mappedCustomerType : prev.customer_type,
      dispatch_date: expectedDate || prev.dispatch_date,
    }));
  }, [
    partyId,
    assignedSales,
    expectedDate,
    parties,
    salesUsers,
    shippingAddress,
    billingAddress,
    quotation,
  ]);

  const handlePartyChange = (newPartyId: string) => {
    setPartyId(newPartyId);
  };

  const handleProductChange = (index: number, productId: string) => {
    const p = products.find((x) => String(x._id ?? x.id) === productId);
    if (!p) return;

    const getLabel = (v: unknown) =>
      typeof v === "object" && v !== null
        ? String((v as { name?: unknown }).name ?? "")
        : String(v ?? "");

    const currentLine = lines[index];
    const rateType = currentLine.rate_type || "SR";
    const resolvedPrice = resolvePriceForLine(productId, rateType, p);

    const nextLine: LineRow = {
      ...currentLine,
      productId,
      product_name: String(p.product_name ?? p.name ?? ""),
      sku: String(p.sku ?? ""),
      brand: getLabel(p.brand),
      manufacturer: getLabel(p.manufacturer),
      product_group: getLabel(p.product_group),
      product_subgroup: getLabel(p.product_subgroup),
      unit: getLabel(p.unit),
      unit_price: resolvedPrice,
      gst_percent: Number(p.gst_percent ?? 18),
      rate_type: rateType,
      pricing_reference: undefined,
      pricing_validity_start: undefined,
      pricing_validity_end: undefined,
      manual_price_override: false,
      approval_required: false,
      approval_reason: "",
      rate_mapped: false,
    };

    setLines((prev) => prev.map((l, i) => (i === index ? nextLine : l)));
  };

  const handleRateTypeChange = (
    index: number,
    newRateType: "SR" | "SRA" | "CR",
  ) => {
    const line = lines[index];
    const p = products.find(
      (x) => String(x._id ?? x.id) === String(line.productId),
    );
    const price = resolvePriceForLine(line.productId, newRateType, p);
    setLines((prev) =>
      prev.map((l, i) =>
        i === index ? { ...l, rate_type: newRateType, unit_price: price } : l,
      ),
    );
  };

  const updateLine = (index: number, patch: Partial<LineRow>) => {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  };

  const openMapPriceModalForLine = (index: number) => {
    if (priceRestricted) {
      toast.error("Price mapping is restricted for Sales by Super Admin.");
      return;
    }
    if (!partyId) {
      toast.error("Please select a party first");
      return;
    }
    const line = lines[index];
    if (!line?.productId) {
      toast.error("Please select a product on this line first");
      return;
    }
    const prod = products.find(
      (p) => String(p._id ?? p.id) === line.productId,
    );
    const prodName = String(
      line.product_name ?? prod?.product_name ?? prod?.name ?? "Product",
    );
    const prodSku = String(line.sku ?? prod?.sku ?? "");
    const suggestedPrice =
      Number(line.unit_price) > 0
        ? Number(line.unit_price)
        : Number(prod?.base_price ?? prod?.mrp ?? 0);

    const rateItem = rateItemByLine.get(
      rateLookupKey(line.productId, line.rate_type || "SR"),
    );

    setMapPriceLineIndex(index);
    setMapPriceModalTarget({
      productId: line.productId,
      productName: prodName,
      sku: prodSku || undefined,
      appliedRateType: line.rate_type || "SR",
      unitPrice: suggestedPrice,
      mappingId: rateItem?.mappingId ?? null,
      isMapped: Boolean(rateItem?.isMapped),
      hasRate: Boolean(rateItem?.hasRate),
    });
  };

  const handleMapPriceSuccess = useCallback(
    (result: MapOrderLinePriceSuccess) => {
      setLines((prev) =>
        prev.map((row, idx) => {
          if (
            idx === mapPriceLineIndex ||
            (row.productId === result.productId &&
              (row.rate_type || "SR") === result.appliedRateType)
          ) {
            return {
              ...row,
              unit_price: result.negotiatedRate,
              rate_type: result.appliedRateType as "SR" | "SRA" | "CR",
              rate_mapped: true,
              approval_required: false,
            };
          }
          return row;
        }),
      );
      setMapPriceModalTarget(null);
      setMapPriceLineIndex(null);
      if (!rateCheckQ.isUninitialized) {
        void rateCheckQ.refetch();
      }
    },
    [mapPriceLineIndex, rateCheckQ],
  );

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        productId: "",
        quantity: 1,
        free_qty: 0,
        unit_price: 0,
        rate_type: "SR",
        discount_percent: 0,
        discount_amount: 0,
        gst_percent: 18,
        remarks: "",
      },
    ]);
  };

  const handleAddPreviousItems = (itemsToAdd: QuickAddProductPayload[]) => {
    if (!itemsToAdd.length) return;

    const getLabel = (v: unknown) =>
      typeof v === "object" && v !== null
        ? String((v as { name?: unknown }).name ?? "")
        : String(v ?? "");

    const resolvedNewRows: LineRow[] = itemsToAdd.map((item) => {
      const p = products.find(
        (x) => String(x._id ?? x.id) === item.productId,
      );
      const rateType: "SR" | "SRA" | "CR" = item.rate_type || "SR";
      const resolvedPrice =
        Number(item.unit_price) > 0
          ? Number(item.unit_price)
          : resolvePriceForLine(item.productId, rateType, p);

      return {
        productId: item.productId,
        product_name:
          item.product_name || String(p?.product_name ?? p?.name ?? ""),
        sku: item.sku || String(p?.sku ?? ""),
        brand: p ? getLabel(p.brand) : undefined,
        manufacturer: p ? getLabel(p.manufacturer) : undefined,
        product_group: p ? getLabel(p.product_group) : undefined,
        product_subgroup: p ? getLabel(p.product_subgroup) : undefined,
        unit: item.unit || (p ? getLabel(p.unit) : "pcs"),
        quantity: Math.max(1, Number(item.quantity) || 1),
        free_qty: Math.max(0, Number(item.free_qty) || 0),
        unit_price: resolvedPrice,
        rate_type: rateType,
        discount_percent: Math.max(0, Number(item.discount_percent) || 0),
        discount_amount: 0,
        gst_percent: Number(item.gst_percent ?? p?.gst_percent ?? 18),
        remarks: item.remarks || "",
        rate_mapped: false,
        approval_required: false,
      };
    });

    setLines((prev) => {
      const nonEmpty = prev.filter((l) => Boolean(l.productId));
      const merged = [...nonEmpty];

      for (const nr of resolvedNewRows) {
        const existingIdx = merged.findIndex(
          (m) => m.productId === nr.productId && m.rate_type === nr.rate_type,
        );
        if (existingIdx >= 0) {
          merged[existingIdx] = {
            ...merged[existingIdx],
            quantity: merged[existingIdx].quantity + nr.quantity,
            free_qty: merged[existingIdx].free_qty + nr.free_qty,
          };
        } else {
          merged.push(nr);
        }
      }

      return merged.length > 0 ? merged : prev;
    });

    toast.success(`Added ${resolvedNewRows.length} product(s) to order`);
  };

  const removeLine = (index: number) => {
    setLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
    );
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTaxable = 0;
    let totalGst = 0;

    for (const l of lines) {
      if (!l.productId) continue;
      const gross = l.quantity * l.unit_price;
      const disc =
        l.discount_percent > 0
          ? (gross * l.discount_percent) / 100
          : l.discount_amount;
      const taxable = Math.max(0, gross - disc);
      const gst = (taxable * (l.gst_percent || 0)) / 100;

      subtotal += gross;
      totalDiscount += disc;
      totalTaxable += taxable;
      totalGst += gst;
    }

    const grandTotal = totalTaxable + totalGst;
    return { subtotal, totalDiscount, totalTaxable, totalGst, grandTotal };
  }, [lines]);

  const allItemsNegotiated = useMemo(() => {
    const active = lines.filter((l) => l.productId && l.quantity > 0);
    if (active.length === 0) return false;
    return active.every((l) => {
      const rateItem = rateItemByLine.get(
        rateLookupKey(l.productId, l.rate_type || "SR"),
      );
      return resolveRateDisplayStatus(rateItem, l.unit_price) === "negotiated";
    });
  }, [lines, rateItemByLine]);

  const validateStep1 = () => {
    if (!partyId) {
      toast.error("Please select a party");
      return false;
    }
    if (!orderDate) {
      toast.error("Please select an order date");
      return false;
    }
    if (!expectedDate) {
      toast.error("Please select an expected delivery date");
      return false;
    }
    if (!assignedSales) {
      toast.error("Please select a Sales Representative");
      return false;
    }
    const validLines = lines.filter((l) => l.productId && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error("Add at least one product line");
      return false;
    }
    const unmappedLines = validLines.filter((l) => {
      const rateItem = rateItemByLine.get(
        rateLookupKey(l.productId, l.rate_type || "SR"),
      );
      return resolveRateDisplayStatus(rateItem, l.unit_price) !== "negotiated";
    });
    if (unmappedLines.length > 0) {
      toast.error(
        `${unmappedLines.length} item(s) do not have a valid negotiated rate. Click "Map Rate" on each line first.`,
      );
      return false;
    }
    return true;
  };

  const handleGoToStep2 = () => {
    if (!validateStep1()) return;
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!validateStep1()) return;
    const validLines = lines.filter((l) => l.productId && l.quantity > 0);

    try {
      const leadId =
        typeof quotation.lead === "object"
          ? quotation.lead?._id
          : quotation.lead;

      const res = await convertQuotation({
        quotationId: quotation._id,
        leadId: leadId || undefined,
        body: {
          conversion_type: "existing_customer",
          party_id: partyId,
          billing_address: billingAddress || undefined,
          shipping_address: shippingAddress || undefined,
          save_shipping_to_party: saveShippingToParty,
          assigned_sales_user: assignedSales,
          order_data: {
            order_date: orderDate,
            delivery_date: expectedDate,
            expected_delivery_date: expectedDate,
            remarks: remarks || undefined,
            assigned_sales_user: assignedSales,
          },
          order_items: validLines.map((l) => {
            const p = products.find(
              (x) => String(x._id ?? x.id) === l.productId,
            );
            const gross = l.quantity * l.unit_price;
            const discAmt =
              l.discount_percent > 0
                ? (gross * l.discount_percent) / 100
                : l.discount_amount;
            return {
              product: l.productId,
              product_name:
                l.product_name || String(p?.product_name ?? p?.name ?? ""),
              sku: l.sku || String(p?.sku ?? ""),
              brand: l.brand,
              manufacturer: l.manufacturer,
              product_group: l.product_group,
              product_subgroup: l.product_subgroup,
              unit: l.unit || String(p?.unit ?? "pcs"),
              quantity: l.quantity,
              ordered_quantity: l.quantity,
              free_quantity: l.free_qty || 0,
              unit_price: l.unit_price,
              applied_rate_type: l.rate_type,
              pricing_reference: l.pricing_reference,
              pricing_validity_start: l.pricing_validity_start,
              pricing_validity_end: l.pricing_validity_end,
              manual_price_override: l.manual_price_override,
              approval_required: l.approval_required,
              approval_reason: l.approval_reason,
              discount_percent: l.discount_percent,
              discount_amount: discAmt,
              gst_percent: l.gst_percent,
              remarks: l.remarks,
            };
          }),
          performa: {
            sales_person: performa.sales_person,
            freight_charges: performa.freight_charges,
            orc: performa.orc,
            transport: performa.transport,
            dispatch_date: performa.dispatch_date || expectedDate || null,
            ship_to_address: performa.ship_to_address,
            payment_terms: performa.payment_terms,
            customer_type: performa.customer_type,
            installation_required: performa.installation_required,
            gst_concession: performa.gst_concession,
            margin_sheet_attached: performa.cost_sheet_file
              ? "Attached"
              : performa.margin_sheet_attached,
            kyc_status:
              performa.aadhaar_file ||
                performa.pan_file ||
                performa.gst_file ||
                (performa.kyc_files && performa.kyc_files.length > 0)
                ? "Attached"
                : performa.kyc_status,
            remarks: performa.remarks || remarks || "",
          },
          email_options: emailOptions,
          notes: remarks || undefined,
        },
      }).unwrap();

      const createdOrder = res?.order as Record<string, any> | undefined;
      const createdOrderId = String(
        createdOrder?._id ?? createdOrder?.id ?? "",
      );

      // Upload Performa / Order attachments if selected
      if (createdOrderId) {
        const targetPartyId =
          partyId ||
          String(
            (createdOrder as any)?.party?._id ??
              (createdOrder as any)?.party ??
              (createdOrder as any)?.party_id ??
              "",
          );

        let poAttId: string | undefined;
        let costSheetAttId: string | undefined;
        let aadhaarAttId: string | undefined;
        let panAttId: string | undefined;
        let gstAttId: string | undefined;

        if (isPOEnabled && performa.po_file) {
          try {
            const fd = new FormData();
            fd.append("file", performa.po_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", createdOrderId);
            fd.append("category", "po");
            fd.append("remarks", "[PO] Purchase Order");
            const att = await createAttachment(fd).unwrap();
            poAttId = String((att as any)?._id ?? (att as any)?.id ?? "");
          } catch {
            toast.error("Order created, but PO attachment upload failed.");
          }
        }

        if (isCostSheetEnabled && performa.cost_sheet_file) {
          try {
            const fd = new FormData();
            fd.append("file", performa.cost_sheet_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", createdOrderId);
            fd.append("category", "cost_sheet");
            fd.append("remarks", "[COST_SHEET] Margin / Cost Sheet");
            const att = await createAttachment(fd).unwrap();
            costSheetAttId = String(
              (att as any)?._id ?? (att as any)?.id ?? "",
            );
          } catch {
            toast.error(
              "Order created, but Cost Sheet attachment upload failed.",
            );
          }
        }

        if (isKycEnabled && performa.aadhaar_file) {
          try {
            const fd = new FormData();
            fd.append("file", performa.aadhaar_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", createdOrderId);
            fd.append("category", "kyc_aadhaar");
            fd.append("remarks", "[KYC] Aadhaar Card");
            const att = await createAttachment(fd).unwrap();
            aadhaarAttId = String((att as any)?._id ?? (att as any)?.id ?? "");
          } catch {
            toast.error("Order created, but Aadhaar attachment upload failed.");
          }

          if (targetPartyId) {
            try {
              const pfd = new FormData();
              pfd.append("file", performa.aadhaar_file);
              pfd.append("entity_type", "party");
              pfd.append("entity_id", targetPartyId);
              pfd.append("category", "kyc_aadhaar");
              pfd.append("remarks", "[KYC] Aadhaar Card from Order");
              await createAttachment(pfd).unwrap();
            } catch {
              // Non-blocking mirror to party
            }
          }
        }

        if (isKycEnabled && performa.pan_file) {
          try {
            const fd = new FormData();
            fd.append("file", performa.pan_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", createdOrderId);
            fd.append("category", "kyc_pan");
            fd.append("remarks", "[KYC] PAN Card");
            const att = await createAttachment(fd).unwrap();
            panAttId = String((att as any)?._id ?? (att as any)?.id ?? "");
          } catch {
            toast.error("Order created, but PAN attachment upload failed.");
          }

          if (targetPartyId) {
            try {
              const pfd = new FormData();
              pfd.append("file", performa.pan_file);
              pfd.append("entity_type", "party");
              pfd.append("entity_id", targetPartyId);
              pfd.append("category", "kyc_pan");
              pfd.append("remarks", "[KYC] PAN Card from Order");
              await createAttachment(pfd).unwrap();
            } catch {
              // Non-blocking mirror to party
            }
          }
        }

        if (isKycEnabled && performa.gst_file) {
          try {
            const fd = new FormData();
            fd.append("file", performa.gst_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", createdOrderId);
            fd.append("category", "kyc_gst");
            fd.append("remarks", "[KYC] GST Certificate");
            const att = await createAttachment(fd).unwrap();
            gstAttId = String((att as any)?._id ?? (att as any)?.id ?? "");
          } catch {
            toast.error("Order created, but GST attachment upload failed.");
          }

          if (targetPartyId) {
            try {
              const pfd = new FormData();
              pfd.append("file", performa.gst_file);
              pfd.append("entity_type", "party");
              pfd.append("entity_id", targetPartyId);
              pfd.append("category", "kyc_gst");
              pfd.append("remarks", "[KYC] GST Certificate from Order");
              await createAttachment(pfd).unwrap();
            } catch {
              // Non-blocking mirror to party
            }
          }
        }

        if (isKycEnabled && performa.kyc_files && performa.kyc_files.length > 0) {
          for (const kf of performa.kyc_files) {
            try {
              const fd = new FormData();
              fd.append("file", kf);
              fd.append("entity_type", "order");
              fd.append("entity_id", createdOrderId);
              fd.append("category", "kyc");
              fd.append("remarks", `[KYC] ${kf.name}`);
              await createAttachment(fd).unwrap();
            } catch {
              toast.error(`Failed to upload KYC document: ${kf.name}`);
            }

            if (targetPartyId) {
              try {
                const pfd = new FormData();
                pfd.append("file", kf);
                pfd.append("entity_type", "party");
                pfd.append("entity_id", targetPartyId);
                pfd.append("category", "kyc");
                pfd.append("remarks", `[KYC] ${kf.name} from Order`);
                await createAttachment(pfd).unwrap();
              } catch {
                // Non-blocking mirror to party
              }
            }
          }
        }

        if (
          isPerformaEnabled &&
          (poAttId ||
            costSheetAttId ||
            aadhaarAttId ||
            panAttId ||
            gstAttId ||
            (performa.kyc_files && performa.kyc_files.length > 0))
        ) {
          const {
            po_file: _po,
            cost_sheet_file: _cs,
            aadhaar_file: _aadh,
            pan_file: _pan,
            gst_file: _gst,
            kyc_files: _kyc,
            ...cleanPerforma
          } = performa;

          await updateOrderPerforma({
            orderId: createdOrderId,
            data: {
              ...cleanPerforma,
              dispatch_date: performa.dispatch_date || expectedDate || null,
              po_attachment: poAttId || undefined,
              cost_sheet_attachment: costSheetAttId || undefined,
              aadhaar_attachment: aadhaarAttId || undefined,
              pan_attachment: panAttId || undefined,
              gst_attachment: gstAttId || undefined,
              margin_sheet_attached: costSheetAttId
                ? "Attached"
                : performa.margin_sheet_attached,
              kyc_status:
                aadhaarAttId ||
                  panAttId ||
                  gstAttId ||
                  (performa.kyc_files && performa.kyc_files.length > 0)
                  ? "Attached"
                  : performa.kyc_status,
            },
          }).catch(() => { });
        }
      }

      toast.success(
        `Quotation converted to Order ${createdOrder?.order_no ? `#${createdOrder.order_no}` : ""} successfully!`,
      );
      onSuccess?.(res);
      onClose();
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      toast.error(err.data?.message || "Failed to convert quotation to order");
    }
  };

  const selectedParty = useMemo(
    () => parties.find((p) => String(p._id ?? p.id) === partyId),
    [parties, partyId],
  );

  const existingProductIds = useMemo(
    () => new Set(lines.map((l) => l.productId).filter(Boolean)),
    [lines],
  );

  if (!open) return null;

  return (
    <LargeModalPortal>
      <div className="fixed inset-0 z-[120] flex bg-slate-900/50 backdrop-blur-[1px]">
        <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50 shadow-2xl">
          {/* Top Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-slate-900">
                  Convert Quotation to Order
                </h2>
                <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 font-mono text-xs font-semibold text-teal-800">
                  {quotation.ref_no || quotation.quotation_no}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Create and submit a new order from this quotation for approval
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step Tabs Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${step === 1
                    ? "bg-teal-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
              >
                {isPerformaEnabled && (
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${step === 1
                        ? "bg-white text-teal-700"
                        : "bg-slate-300 text-slate-700"
                      }`}
                  >
                    1
                  </span>
                )}
                Order Details & Items
              </button>

              {isPerformaEnabled && (
                <>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={handleGoToStep2}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${step === 2
                        ? "bg-teal-600 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${step === 2
                          ? "bg-white text-teal-700"
                          : "bg-slate-300 text-slate-700"
                        }`}
                    >
                      2
                    </span>
                    <FileText className="h-3.5 w-3.5" />
                    Performa Invoice
                  </button>
                </>
              )}
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              {!isPerformaEnabled
                ? "Select party, products & quantities"
                : step === 1
                ? "Step 1 of 2: Select party, products & quantities"
                : "Step 2 of 2: Fill Performa Invoice & compliance documents"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {step === 1 ? (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Party & Dates */}
                  <div className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-slate-900">
                          Party & Dates
                        </h2>
                        {!partyId && quotation.customer_name && (
                          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                            Quotation Client: {quotation.customer_name}
                          </span>
                        )}
                      </div>
                      {partyId && (
                        <button
                          type="button"
                          onClick={() => setPrevItemsModalOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-1.5 text-xs font-semibold text-teal-700 shadow-2xs transition-colors hover:bg-teal-100"
                        >
                          <History className="h-3.5 w-3.5" />
                          Past Party Orders
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <div className="md:col-span-2">
                        <div className="mb-1 flex items-center justify-between">
                          <label className="block text-xs font-medium text-slate-700">
                            Select Party *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickPartyInitialName(
                                quotation.customer_name || "",
                              );
                              setQuickAddPartyOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700"
                          >
                            <Plus className="h-3 w-3" /> Quick Add Party
                          </button>
                        </div>
                        <PartyAutocomplete
                          parties={parties}
                          value={partyId}
                          onChange={(id) => void handlePartyChange(id)}
                          onQuickAdd={(searchQuery) => {
                            setQuickPartyInitialName(
                              searchQuery || quotation.customer_name || "",
                            );
                            setQuickAddPartyOpen(true);
                          }}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          Order Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={orderDate}
                          onChange={(e) => setOrderDate(e.target.value)}
                          className="h-[38px] w-full rounded-md border border-slate-300 px-3 text-xs focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          Expected Delivery Date *
                        </label>
                        <input
                          type="date"
                          required
                          min={orderDate}
                          value={expectedDate}
                          onChange={(e) => setExpectedDate(e.target.value)}
                          className="h-[38px] w-full rounded-md border border-slate-300 px-3 text-xs focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Billing & Shipping Address Selector */}
                  {selectedParty && (
                    <OrderAddressSelector
                      selectedParty={selectedParty as Record<string, any>}
                      billingAddress={billingAddress}
                      onChangeBillingAddress={setBillingAddress}
                      shippingAddress={shippingAddress}
                      onChangeShippingAddress={setShippingAddress}
                      saveShippingToParty={saveShippingToParty}
                      onChangeSaveShippingToParty={setSaveShippingToParty}
                    />
                  )}

                  {/* Line Items */}
                  <div className="rounded-lg border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
                      <h2 className="text-sm font-semibold text-slate-900">
                        Line Items ({lines.filter((l) => l.productId).length})
                      </h2>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const emptyIdx = lines.findIndex(
                              (l) => !l.productId,
                            );
                            setQuickAddProductLineIndex(
                              emptyIdx >= 0 ? emptyIdx : lines.length,
                            );
                            setQuickProductInitialName("");
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Plus className="h-3.5 w-3.5 text-teal-600" /> Quick
                          Add Product
                        </button>
                        <button
                          type="button"
                          onClick={addLine}
                          className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Item
                        </button>
                      </div>
                    </div>

                    <div className="w-full overflow-x-visible">
                      <table className="w-full table-fixed text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                          <tr>
                            <th className="w-[28%] px-3 py-2.5">Product</th>
                            <th className="w-[8%] px-1.5 py-2.5 text-center">
                              Rate
                            </th>
                            <th className="w-[8%] px-1.5 py-2.5 text-center">
                              Qty
                            </th>
                            <th className="w-[8%] px-1.5 py-2.5 text-center">
                              Free
                            </th>
                            <th className="w-[13%] px-1.5 py-2.5 text-right">
                              Price (₹)
                            </th>
                            <th className="w-[9%] px-1.5 py-2.5 text-right">
                              Disc %
                            </th>
                            <th className="w-[8%] px-1.5 py-2.5 text-right">
                              GST %
                            </th>
                            <th className="w-[13%] px-2 py-2.5 text-right">
                              Total (₹)
                            </th>
                            <th className="w-[5%] px-1.5 py-2.5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lines.map((line, i) => {
                            const gross = line.quantity * line.unit_price;
                            const disc =
                              line.discount_percent > 0
                                ? (gross * line.discount_percent) / 100
                                : line.discount_amount;
                            const taxable = Math.max(0, gross - disc);
                            const gst =
                              (taxable * (line.gst_percent || 0)) / 100;
                            const lineTotal = taxable + gst;
                            const rateItem = line.productId
                              ? rateItemByLine.get(
                                  rateLookupKey(
                                    line.productId,
                                    line.rate_type || "SR",
                                  ),
                                )
                              : undefined;
                            const rateUiState = resolveRateDisplayStatus(
                              rateItem,
                              line.unit_price,
                            );

                            return (
                              <tr
                                key={i}
                                className="align-top hover:bg-slate-50/50"
                              >
                                <td className="px-3 py-2.5">
                                  <ProductAutocomplete
                                    products={products}
                                    value={line.productId}
                                    fallbackName={line.product_name}
                                    onChange={(pid) =>
                                      void handleProductChange(i, pid)
                                    }
                                    onQuickAdd={(searchQuery) => {
                                      setQuickProductInitialName(searchQuery);
                                      setQuickAddProductLineIndex(i);
                                    }}
                                  />
                                  {line.productId && (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                      <LineRateStatusBadge
                                        status={rateUiState}
                                        rateItem={rateItem}
                                        formatMoney={formatMoney}
                                      />
                                      <button
                                        type="button"
                                        disabled={!partyId || priceRestricted}
                                        onClick={() =>
                                          openMapPriceModalForLine(i)
                                        }
                                        title={
                                          priceRestricted
                                            ? "Price mapping is restricted for Sales by Super Admin"
                                            : !partyId
                                            ? "Select a party first"
                                            : "Create or renew party product rate"
                                        }
                                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-40 ${
                                          priceRestricted
                                            ? "border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                                            : rateUiState === "negotiated"
                                            ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                            : "bg-teal-600 text-white shadow-2xs hover:bg-teal-700"
                                        }`}
                                      >
                                        <Tag className="h-2.5 w-2.5" />
                                        {priceRestricted
                                          ? "Restricted"
                                          : rateUiState === "negotiated"
                                          ? "Update Rate"
                                          : rateUiState === "expired"
                                            ? "Renew Rate"
                                            : "Map Rate"}
                                      </button>
                                    </div>
                                  )}
                                  <input
                                    type="text"
                                    placeholder="Item remarks (optional)..."
                                    value={line.remarks ?? ""}
                                    onChange={(e) =>
                                      updateLine(i, {
                                        remarks: e.target.value,
                                      })
                                    }
                                    className="mt-1.5 h-7 w-full rounded border border-slate-200 bg-slate-50/70 px-2 text-[11px] text-slate-600 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none"
                                  />
                                </td>
                                <td className="px-1.5 py-2.5">
                                  <select
                                    value={line.rate_type}
                                    onChange={(e) =>
                                      void handleRateTypeChange(
                                        i,
                                        e.target.value as "SR" | "SRA" | "CR",
                                      )
                                    }
                                    className="h-[34px] w-full rounded border border-slate-300 bg-white px-1 text-center text-xs font-medium focus:border-teal-500 focus:outline-none"
                                  >
                                    <option value="SR">SR</option>
                                    <option value="SRA">SRA</option>
                                    <option value="CR">CR</option>
                                  </select>
                                </td>
                                <td className="px-1.5 py-2.5">
                                  <input
                                    type="number"
                                    min={1}
                                    value={
                                      line.quantity === 0 ? "" : line.quantity
                                    }
                                    placeholder="1"
                                    disabled={quantityRestricted}
                                    title={quantityRestricted ? "Quantity mapping is locked to default for Sales by Super Admin" : undefined}
                                    onFocus={(e) => e.currentTarget.select()}
                                    onChange={(e) =>
                                      updateLine(i, {
                                        quantity:
                                          e.target.value === ""
                                            ? 0
                                            : Math.max(
                                              0,
                                              Number(e.target.value),
                                            ),
                                      })
                                    }
                                    onBlur={() => {
                                      if (!line.quantity || line.quantity < 1) {
                                        updateLine(i, { quantity: 1 });
                                      }
                                    }}
                                    className={`h-[34px] w-full rounded border px-1.5 text-center text-xs focus:border-teal-500 focus:outline-none ${
                                      quantityRestricted
                                        ? "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                                        : "border-slate-300"
                                    }`}
                                  />
                                </td>
                                <td className="px-1.5 py-2.5">
                                  <input
                                    type="number"
                                    min={0}
                                    value={
                                      line.free_qty === 0 ? "" : line.free_qty
                                    }
                                    placeholder="0"
                                    onFocus={(e) => e.currentTarget.select()}
                                    onChange={(e) =>
                                      updateLine(i, {
                                        free_qty:
                                          e.target.value === ""
                                            ? 0
                                            : Math.max(
                                              0,
                                              Number(e.target.value),
                                            ),
                                      })
                                    }
                                    className="h-[34px] w-full rounded border border-slate-300 px-1.5 text-center text-xs focus:border-teal-500 focus:outline-none"
                                  />
                                </td>
                                <td className="px-1.5 py-2.5">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={
                                      line.unit_price === 0
                                        ? ""
                                        : line.unit_price
                                    }
                                    placeholder="0"
                                    disabled={priceRestricted}
                                    title={priceRestricted ? "Price editing is disabled for Sales by Super Admin" : undefined}
                                    onFocus={(e) => e.currentTarget.select()}
                                    onChange={(e) =>
                                      updateLine(i, {
                                        unit_price:
                                          e.target.value === ""
                                            ? 0
                                            : Math.max(
                                              0,
                                              Number(e.target.value),
                                            ),
                                      })
                                    }
                                    className={`h-[34px] w-full rounded border px-1.5 text-right text-xs focus:border-teal-500 focus:outline-none ${
                                      priceRestricted
                                        ? "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                                        : line.productId &&
                                        rateUiState !== "negotiated"
                                        ? "border-rose-300 bg-rose-50/40 text-rose-900"
                                        : "border-slate-300"
                                    }`}
                                  />
                                </td>
                                <td className="px-1.5 py-2.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.1"
                                    value={
                                      line.discount_percent === 0
                                        ? ""
                                        : line.discount_percent
                                    }
                                    placeholder="0"
                                    onFocus={(e) => e.currentTarget.select()}
                                    onChange={(e) =>
                                      updateLine(i, {
                                        discount_percent:
                                          e.target.value === ""
                                            ? 0
                                            : Math.max(
                                              0,
                                              Number(e.target.value),
                                            ),
                                      })
                                    }
                                    className="h-[34px] w-full rounded border border-slate-300 px-1.5 text-right text-xs focus:border-teal-500 focus:outline-none"
                                  />
                                </td>
                                <td className="px-1.5 py-2.5 text-right font-medium text-slate-600">
                                  <div className="flex h-[34px] items-center justify-end">
                                    {line.gst_percent}%
                                  </div>
                                </td>
                                <td className="px-2 py-2.5 text-right font-semibold text-slate-900">
                                  <div className="flex h-[34px] items-center justify-end">
                                    {inr(lineTotal)}
                                  </div>
                                </td>
                                <td className="px-1.5 py-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeLine(i)}
                                    disabled={lines.length <= 1}
                                    className="inline-flex h-[34px] items-center justify-center rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="border-t border-slate-100 px-5 py-3">
                      <button
                        type="button"
                        onClick={addLine}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add another item
                      </button>
                    </div>
                  </div>

                  {/* Email Notification Controls */}
                  <div className="rounded-lg border border-slate-200 bg-white p-5">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      Email Notification Settings
                    </h2>
                    <WorkflowEmailControls
                      scope="order_submit"
                      party={selectedParty as Record<string, any> | undefined}
                      users={asRecordArray(usersRaw)}
                      value={emailOptions}
                      onChange={setEmailOptions}
                    />
                  </div>

                  {/* Remarks */}
                  <div className="rounded-lg border border-slate-200 bg-white p-5">
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Order Remarks (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add any special delivery or billing instructions..."
                      className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Right Column: Assignment & Summary */}
                <div className="space-y-6">
                  <div className="rounded-lg border border-slate-200 bg-white p-5">
                    <h2 className="mb-4 border-b border-slate-100 pb-3 text-sm font-semibold text-slate-900">
                      Assignment
                    </h2>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Sales Representative *
                      </label>
                      <SalesAutocomplete
                        users={salesUsers}
                        value={assignedSales}
                        onChange={setAssignedSales}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-5">
                    <h2 className="mb-4 border-b border-slate-100 pb-3 text-sm font-semibold text-slate-900">
                      Order Summary
                    </h2>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Total Items</span>
                        <span className="font-medium text-slate-900">
                          {lines.filter((l) => l.productId).length}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-medium text-slate-900">
                          {inr(totals.subtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Discount</span>
                        <span className="font-medium text-emerald-700">
                          -{inr(totals.totalDiscount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Taxable Amount</span>
                        <span className="font-medium text-slate-900">
                          {inr(totals.totalTaxable)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>GST (Estimated)</span>
                        <span className="font-medium text-slate-900">
                          {inr(totals.totalGst)}
                        </span>
                      </div>
                      <div className="border-t border-slate-200 pt-2.5">
                        <div className="flex justify-between text-sm font-bold text-slate-900">
                          <span>Estimated Total</span>
                          <span className="text-teal-700">
                            {inr(totals.grandTotal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!assignedSales && (
                      <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                        Select a Sales Representative before proceeding.
                      </p>
                    )}

                    {!allItemsNegotiated &&
                      lines.some((l) => l.productId) && (
                        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-800">
                          All products must have an active{" "}
                          <strong>Negotiated</strong> rate before creating the
                          order. Click <strong>Map Rate</strong> on unmapped
                          lines.
                        </p>
                      )}

                    {isPerformaEnabled ? (
                      <>
                        <button
                          type="button"
                          onClick={handleGoToStep2}
                          disabled={
                            isConverting || !assignedSales || !allItemsNegotiated
                          }
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                        >
                          Next: Performa Invoice
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleSubmit()}
                          disabled={
                            isConverting || !assignedSales || !allItemsNegotiated
                          }
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        >
                          {isConverting && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}
                          {isConverting
                            ? "Creating & Submitting..."
                            : "Or create & submit without Performa"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={
                          isConverting || !assignedSales || !allItemsNegotiated
                        }
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                      >
                        {isConverting && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        {isConverting
                          ? "Creating & Submitting..."
                          : "Convert Quotation to Order"}
                        {!isConverting && <ArrowRight className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* STEP 2: PERFORMA INVOICE */
              <div className="mx-auto max-w-5xl space-y-5">
                {/* Order Quick Overview Banner */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-teal-200 bg-teal-50/60 px-5 py-3.5">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-teal-800">
                      Step 2: Performa Invoice Details
                    </div>
                    <p className="mt-0.5 text-xs text-teal-700">
                      Review & fill commercial terms
                      {isPOEnabled || isCostSheetEnabled || isKycEnabled
                        ? ", and upload verification documents before submitting."
                        : " before submitting."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Party: </span>
                      <strong className="text-slate-900">
                        {String(
                          selectedParty?.party_name ??
                          selectedParty?.name ??
                          quotation.customer_name ??
                          "—",
                        )}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Sales Rep: </span>
                      <strong className="text-slate-900">
                        {performa.sales_person || "—"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Total: </span>
                      <strong className="text-teal-700">
                        {inr(totals.grandTotal)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Performa Invoice Fields */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                  <PerformaInvoiceFields
                    value={performa}
                    onChange={setPerforma}
                    disabled={isConverting}
                    showFileUploads={true}
                  />

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      disabled={isConverting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to Order Items
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={isConverting}
                        className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                      >
                        {isConverting && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        <Check className="h-4 w-4" />
                        {isConverting
                          ? "Creating & Submitting Order..."
                          : "Create & Submit Order"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Previous Party Items & Orders Modal */}
      <PreviousPartyItemsModal
        open={prevItemsModalOpen}
        onClose={() => setPrevItemsModalOpen(false)}
        partyId={partyId}
        partyName={String(
          selectedParty?.party_name ?? selectedParty?.name ?? "",
        )}
        existingProductIds={existingProductIds}
        onAddItems={(items) => void handleAddPreviousItems(items)}
      />

      {/* Quick Add Party Modal */}
      {quickAddPartyOpen && (
        <PartyDetailModal
          partyId={null}
          create
          open
          initialName={quickPartyInitialName}
          onClose={() => {
            setQuickAddPartyOpen(false);
            setQuickPartyInitialName("");
          }}
          onSuccess={(createdParty) => {
            const newId = String(createdParty._id ?? createdParty.id ?? "");
            if (newId) {
              void handlePartyChange(newId);
            }
          }}
        />
      )}

      {/* Quick Add Product Modal */}
      {quickAddProductLineIndex !== null && (
        <ProductDetailModal
          productId={null}
          create
          open
          initialName={quickProductInitialName}
          onClose={() => {
            setQuickAddProductLineIndex(null);
            setQuickProductInitialName("");
          }}
          onSuccess={(createdProduct) => {
            const newPid = String(
              createdProduct._id ?? createdProduct.id ?? "",
            );
            const targetIdx = quickAddProductLineIndex;
            setQuickAddProductLineIndex(null);
            setQuickProductInitialName("");
            if (!newPid || targetIdx === null) return;

            const getLabel = (v: unknown) =>
              typeof v === "object" && v !== null
                ? String((v as { name?: unknown }).name ?? "")
                : String(v ?? "");

            const newRow: LineRow = {
              productId: newPid,
              product_name: String(
                createdProduct.product_name ?? createdProduct.name ?? "",
              ),
              sku: String(createdProduct.sku ?? ""),
              brand: getLabel(createdProduct.brand),
              manufacturer: getLabel(createdProduct.manufacturer),
              product_group: getLabel(createdProduct.product_group),
              product_subgroup: getLabel(createdProduct.product_subgroup),
              unit: getLabel(createdProduct.unit) || "pcs",
              quantity: 1,
              free_qty: 0,
              unit_price: 0,
              rate_type: "SR",
              discount_percent: 0,
              discount_amount: 0,
              gst_percent: Number(createdProduct.gst_percent ?? 18),
              remarks: "",
              rate_mapped: false,
              approval_required: true,
              approval_reason:
                "No active rate mapped for this party/product",
            };

            setLines((prev) => {
              if (targetIdx < prev.length) {
                return prev.map((l, idx) =>
                  idx === targetIdx ? { ...newRow, quantity: l.quantity || 1 } : l,
                );
              }
              return [...prev, newRow];
            });
          }}
        />
      )}

      <MapOrderLinePriceModal
        open={Boolean(mapPriceModalTarget)}
        onClose={() => {
          setMapPriceModalTarget(null);
          setMapPriceLineIndex(null);
        }}
        partyId={partyId}
        target={mapPriceModalTarget}
        onSuccess={handleMapPriceSuccess}
      />
    </LargeModalPortal>
  );
}

export default ConvertQuotationModal;
