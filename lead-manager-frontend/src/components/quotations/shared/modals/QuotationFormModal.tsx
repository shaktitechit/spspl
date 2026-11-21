import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  Calculator,
  FileText,
  Building2,
  UserCheck,
  ShieldCheck,
  RefreshCw,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  Search,
  Check,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Minus,
  Copy,
  MapPin,
  Eye,
  Printer,
  Pencil,
  CheckCircle2,
} from "lucide-react";

type FieldStatus = "active" | "filled" | "empty";

const QUOTATION_FORM_STEPS = [
  { id: 1 as const, title: "Proposal & Customer" },
  { id: 2 as const, title: "Items & Pricing" },
  { id: 3 as const, title: "Team & Signatory" },
  { id: 4 as const, title: "Terms & Submit" },
];
import {
  useCreateLeadQuotationMutation,
  useUpdateLeadQuotationMutation,
  useListTermsAndConditionsQuery,
  useGetLeadQuery,
  useGetCompanyInfoQuery,
  useGetBranchesQuery,
  useListUsersQuery,
  useListLeadsQuery,
  useListProductsQuery,
  useListQuotationsQuery,
  type LeadRecord,
  type LeadQuotationRecord,
  type CreateQuotationPayload,
  type TermsAndConditionsRecord,
  type BranchRecord,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { formatCurrencyINR, canCreateQuotation, canManageQuotations, isSalesDepartmentUser } from "../../quotationUtils";
import {
  computeQuotationLineAmounts,
  computeQuotationTotals,
  isValidQuotationLineQuantity,
  parseQuotationLineQuantity,
  numberToIndianWords,
} from "../../quotationLineMath";
import { RichTextEditor } from "../RichTextEditor";
import { RichTextDisplay } from "../RichTextDisplay";
import QuotationPdfTemplate from "../QuotationPdfTemplate";
import { ProductDetailModal } from "@/components/portal/shared/products/modals/ProductDetailModal";
import { PartyDetailModal } from "@/components/portal/shared/parties/modals/PartyDetailModal";
import { getFieldText } from "@/components/leads/shared/LeadFormPage";
import { splitLeadAssignees } from "@/components/leads/leadUtils";
import {
  getLeadManagerPortalRole,
  isUserInLeadManagerPortal,
  getDeptLabel,
  getLeadDepartments,
} from "@/components/leads/leadUtils";
import { useLeadDepartmentOptions } from "@/components/leads/useLeadDepartmentOptions";
import { isAdmin, isManager } from "@/utils/authStorage";

type Props = {
  lead?: LeadRecord | null;
  quotation?: LeadQuotationRecord | null;
  isCopy?: boolean;
  open: boolean;
  onClose: () => void;
  onSuccess?: (quotation: LeadQuotationRecord) => void;
  portalHome?: string;
};

type ItemState = {
  product?: string;
  product_name: string;
  description: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  mrp?: number;
  rate: number;
  discount_percent?: number;
  discount_amount?: number;
  gst_rate: number;
  gst_enabled?: boolean;
};

export type CatalogProduct = {
  _id: string;
  product_name: unknown;
  sku?: unknown;
  hsn_code?: unknown;
  base_price?: number;
  minimum_sale_rate?: number;
  mrp?: number;
  gst_percent?: number;
  default_gst_rate?: number;
  brand?: unknown;
  manufacturer?: unknown;
  product_group?: unknown;
  description?: unknown;
  unit?: unknown;
};

export type PartyItem = {
  _id?: string;
  id?: string;
  party_name?: string;
  party_code?: string;
  party_type?: "customer" | "supplier" | "both" | string;
  contact_person?: string;
  mobile?: string;
  phone?: string;
  email?: string;
  contacts?: Array<{
    name?: string;
    department?: string;
    phone?: string;
    email?: string;
    alternate_phone?: string;
  }>;
  gst_no?: string;
  billing_address?: {
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  district?: string;
  state?: string;
  sra?: boolean;
};

/**
 * Generates the default professional introductory cover note for a quotation proposal.
 * Dynamically references the quotation subject/title.
 */
export function buildDefaultIntroductoryNote(subjectTitle?: string): string {
  const cleanSubject = (subjectTitle || "").trim();
  if (cleanSubject) {
    return `<p>Dear Sir/Madam,</p><p>We thank you for your valued enquiry regarding <strong>${cleanSubject}</strong> and are pleased to submit our best competitive quotation as detailed below:</p>`;
  }
  return `<p>Dear Sir/Madam,</p><p>We thank you for your valued enquiry and are pleased to submit our best competitive quotation as detailed below:</p>`;
}

/**
 * Checks if a given message matches the standard default introductory note pattern.
 */
export function isDefaultIntroductoryNote(msg?: string): boolean {
  if (!msg || !msg.trim()) return true;
  const stripped = msg.replace(/<[^>]*>/g, "").trim().toLowerCase();
  return (
    stripped.includes("we thank you for your valued enquiry") &&
    (stripped.includes("pleased to submit our best competitive quotation") ||
      stripped.includes("pleased to submit our quotation"))
  );
}

function pickParties(raw: unknown): PartyItem[] {
  if (Array.isArray(raw)) return raw as PartyItem[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as PartyItem[];
    if (Array.isArray(o.data)) return o.data as PartyItem[];
    if (Array.isArray(o.parties)) return o.parties as PartyItem[];
  }
  return [];
}

/**
 * Searchable Autocomplete for Party Master directory
 */
function PartySearchAutocomplete({
  parties,
  selectedPartyId,
  onSelect,
  onQuickAdd,
}: {
  parties: PartyItem[];
  selectedPartyId: string;
  onSelect: (party: PartyItem | null) => void;
  onQuickAdd?: (searchName: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedParty = useMemo(() => {
    if (!selectedPartyId) return null;
    return parties.find((p) => String(p._id ?? p.id ?? "") === String(selectedPartyId)) || null;
  }, [parties, selectedPartyId]);

  const filteredParties = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return parties.slice(0, 50);
    return parties.filter((p) => {
      const name = String(p.party_name || "").toLowerCase();
      const code = String(p.party_code || "").toLowerCase();
      const person = String(p.contact_person || "").toLowerCase();
      const mobile = String(p.mobile || p.phone || "").toLowerCase();
      const email = String(p.email || "").toLowerCase();
      const city = String(p.billing_address?.city || p.district || "").toLowerCase();
      const gst = String(p.gst_no || "").toLowerCase();
      return (
        name.includes(q) ||
        code.includes(q) ||
        person.includes(q) ||
        mobile.includes(q) ||
        email.includes(q) ||
        city.includes(q) ||
        gst.includes(q)
      );
    }).slice(0, 50);
  }, [parties, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filteredParties.length > 0) {
                onSelect(filteredParties[0]);
                setIsOpen(false);
                setSearch("");
              }
            } else if (e.key === "Escape") {
              setIsOpen(false);
            }
          }}
          placeholder={
            selectedParty
              ? `Linked: ${selectedParty.party_name} (Search to change party...)`
              : "Search Party Master by party name, contact person, mobile, city, GSTIN..."
          }
          className="w-full rounded-xl border border-primary/30 bg-white py-2 pl-9 pr-8 text-xs font-semibold text-slate-800 placeholder-slate-400 shadow-2xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
        />
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-primary">
          <Search className="h-3.5 w-3.5" />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setIsOpen(false);
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-white/10 dark:bg-slate-900">
          <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <span>Party Master Directory ({filteredParties.length} found)</span>
            <span className="text-[9px] text-slate-400 lowercase">click to select & autofill</span>
          </div>
          {filteredParties.length === 0 ? (
            <div className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <div>No matching parties found for &quot;{search}&quot;</div>
              {onQuickAdd && (
                <button
                  type="button"
                  onClick={() => {
                    const nameToUse = search.trim();
                    setIsOpen(false);
                    setSearch("");
                    onQuickAdd(nameToUse);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary-hover transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  + Quick Add Party {search.trim() ? `"${search.trim()}"` : ""}
                </button>
              )}
            </div>
          ) : (
            <>
              {filteredParties.map((p) => {
                const id = String(p._id ?? p.id ?? "");
                const isSelected = id === selectedPartyId;
                const location = [p.billing_address?.city || p.district, p.billing_address?.state || p.state]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onSelect(p);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full flex-col px-3 py-2 text-left text-xs transition border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-primary/10 cursor-pointer ${isSelected
                      ? "bg-primary/15 font-medium text-primary"
                      : "text-slate-800 dark:text-slate-200"
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {p.party_name}
                        </span>
                        {p.party_code && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {p.party_code}
                          </span>
                        )}
                        {p.party_type && (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-xs font-semibold text-slate-600 capitalize dark:bg-slate-800 dark:text-slate-300">
                            {p.party_type}
                          </span>
                        )}
                        {p.sra === true && (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            SRA
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {(p.contact_person || (p.contacts && p.contacts[0]?.name)) && (
                        <span>👤 {p.contact_person || p.contacts?.[0]?.name}</span>
                      )}
                      {(p.mobile || p.phone || (p.contacts && p.contacts[0]?.phone)) && (
                        <span>📞 {p.mobile || p.phone || p.contacts?.[0]?.phone}</span>
                      )}
                      {location && <span>📍 {location}</span>}
                      {p.gst_no && <span className="font-mono text-xs">GST: {p.gst_no}</span>}
                    </div>
                  </button>
                );
              })}
              {onQuickAdd && (
                <div className="border-t border-slate-100 dark:border-white/10 p-1.5 bg-slate-50/60 dark:bg-slate-800/50">
                  <button
                    type="button"
                    onClick={() => {
                      const nameToUse = search.trim();
                      setIsOpen(false);
                      setSearch("");
                      onQuickAdd(nameToUse);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    + Quick Add New Party {search.trim() ? `"${search.trim()}"` : ""}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Quick Search & Add product directly from Catalog toolbar
 */
function QuickProductSearchAndAdd({
  products,
  onAddProduct,
  onQuickAdd,
}: {
  products: CatalogProduct[];
  onAddProduct: (product: CatalogProduct) => void;
  onQuickAdd?: (searchName: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return products
      .filter((p) => {
        const name = getFieldText(p.product_name).toLowerCase();
        const sku = getFieldText(p.sku).toLowerCase();
        const brand = getFieldText(p.brand).toLowerCase();
        const mfr = getFieldText(p.manufacturer).toLowerCase();
        const group = getFieldText(p.product_group).toLowerCase();
        const hsn = getFieldText(p.hsn_code).toLowerCase();
        return (
          name.includes(q) ||
          sku.includes(q) ||
          brand.includes(q) ||
          mfr.includes(q) ||
          group.includes(q) ||
          hsn.includes(q)
        );
      })
      .slice(0, 30);
  }, [products, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (p: CatalogProduct) => {
    onAddProduct(p);
    setSearch("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (search.trim()) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filteredProducts.length > 0) {
                handleSelect(filteredProducts[0]);
              }
            } else if (e.key === "Escape") {
              setIsOpen(false);
            }
          }}
          placeholder="🔍 Quick search product from catalog to add (type product name, SKU, brand)..."
          className="w-full rounded-xl border border-primary/30 bg-white py-2 pl-9 pr-8 text-xs font-semibold text-slate-800 placeholder-slate-400 shadow-2xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
        />
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setIsOpen(false);
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && search.trim().length > 0 && (
        <div className="absolute left-0 right-0 z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-white/10 dark:bg-slate-900">
          <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <span>Matching Catalog Products ({filteredProducts.length})</span>
            <span className="text-[9px] text-primary font-semibold">
              Click or press Enter to add
            </span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <div>No products found matching &quot;{search}&quot;</div>
              {onQuickAdd && (
                <button
                  type="button"
                  onClick={() => {
                    const nameToUse = search.trim();
                    setIsOpen(false);
                    setSearch("");
                    onQuickAdd(nameToUse);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary-hover transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  + Quick Add Product &quot;{search.trim()}&quot;
                </button>
              )}
            </div>
          ) : (
            <>
              {filteredProducts.map((p) => {
                const price = p.base_price ?? p.minimum_sale_rate ?? p.mrp ?? 0;
                const prodName = getFieldText(p.product_name);
                const skuStr = getFieldText(p.sku);
                const brandStr = getFieldText(p.brand);
                const hsnStr = getFieldText(p.hsn_code);
                const unitStr = getFieldText(p.unit);
                const groupStr = getFieldText(p.product_group);
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs transition border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {prodName}
                        </span>
                        {skuStr && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {skuStr}
                          </span>
                        )}
                        {brandStr && (
                          <span className="rounded-full bg-blue-50 px-1.5 py-0.2 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            {brandStr}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        {hsnStr && <span>HSN: {hsnStr}</span>}
                        {unitStr && <span>Unit: {unitStr}</span>}
                        {groupStr && <span>Group: {groupStr}</span>}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-bold text-blue-600 dark:text-blue-400">
                        ₹{price.toLocaleString("en-IN")}
                      </div>
                      <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Plus className="h-3 w-3" /> Add to Quote
                      </div>
                    </div>
                  </button>
                );
              })}
              {onQuickAdd && (
                <div className="border-t border-slate-100 dark:border-white/10 p-1.5 bg-slate-50/60 dark:bg-slate-800/50">
                  <button
                    type="button"
                    onClick={() => {
                      const nameToUse = search.trim();
                      setIsOpen(false);
                      setSearch("");
                      onQuickAdd(nameToUse);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    + Quick Add New Product {search.trim() ? `"${search.trim()}"` : ""}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Searchable Product Selector used inside each line item row
 */
function ProductRowAutocomplete({
  products,
  selectedId,
  onSelect,
  onQuickAdd,
}: {
  products: CatalogProduct[];
  selectedId?: string;
  onSelect: (productId: string) => void;
  onQuickAdd?: (searchName: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProduct = useMemo(() => {
    if (!selectedId) return null;
    return products.find((p) => p._id === selectedId) || null;
  }, [products, selectedId]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products.slice(0, 30);
    return products
      .filter((p) => {
        const name = getFieldText(p.product_name).toLowerCase();
        const sku = getFieldText(p.sku).toLowerCase();
        const brand = getFieldText(p.brand).toLowerCase();
        return name.includes(q) || sku.includes(q) || brand.includes(q);
      })
      .slice(0, 30);
  }, [products, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full mb-1">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filteredProducts.length > 0) {
                onSelect(filteredProducts[0]._id);
                setSearch("");
                setIsOpen(false);
              }
            } else if (e.key === "Escape") {
              setIsOpen(false);
            }
          }}
          placeholder={
            selectedProduct
              ? `Catalog: ${getFieldText(selectedProduct.product_name)} (${getFieldText(selectedProduct.sku) || "Linked"})`
              : "Search & link catalog product..."
          }
          className="w-full rounded-lg border border-slate-200 bg-white py-1 pl-7 pr-6 text-xs text-slate-700 shadow-2xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
        />
        <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-slate-400">
          <Search className="h-3 w-3" />
        </div>
        {selectedProduct && (
          <button
            type="button"
            onClick={() => {
              onSelect("");
              setSearch("");
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-rose-500 cursor-pointer"
            title="Unlink catalog product"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-slate-900">
          <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <span>Select Catalog Item ({filteredProducts.length})</span>
            <span className="text-[9px] text-slate-400">scroll or type to search</span>
          </div>
          {filteredProducts.length === 0 ? (
            <div className="px-3 py-2.5 text-center text-xs text-slate-400 space-y-1.5">
              <div>No catalog products found</div>
              {onQuickAdd && (
                <button
                  type="button"
                  onClick={() => {
                    const nameToUse = search.trim();
                    setIsOpen(false);
                    setSearch("");
                    onQuickAdd(nameToUse);
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-white hover:bg-primary-hover transition cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  + Quick Add Product {search.trim() ? `"${search.trim()}"` : ""}
                </button>
              )}
            </div>
          ) : (
            <>
              {filteredProducts.map((p) => {
                const isSelected = p._id === selectedId;
                const price = p.base_price ?? p.minimum_sale_rate ?? p.mrp ?? 0;
                const prodName = getFieldText(p.product_name);
                const skuStr = getFieldText(p.sku);
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => {
                      onSelect(p._id);
                      setSearch("");
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs transition hover:bg-blue-50/70 dark:hover:bg-blue-950/40 cursor-pointer ${isSelected ? "bg-blue-50 text-blue-700 font-bold dark:bg-blue-950 dark:text-blue-300" : "text-slate-700 dark:text-slate-200"
                      }`}
                  >
                    <span className="truncate pr-2">
                      {prodName}
                      {skuStr && <span className="text-xs text-slate-400 ml-1 font-mono">({skuStr})</span>}
                    </span>
                    <span className="shrink-0 font-semibold text-slate-600 dark:text-slate-300">
                      ₹{price.toLocaleString("en-IN")}
                    </span>
                  </button>
                );
              })}
              {onQuickAdd && (
                <div className="border-t border-slate-100 dark:border-white/10 p-1 bg-slate-50/60 dark:bg-slate-800/50">
                  <button
                    type="button"
                    onClick={() => {
                      const nameToUse = search.trim();
                      setIsOpen(false);
                      setSearch("");
                      onQuickAdd(nameToUse);
                    }}
                    className="flex w-full items-center justify-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    + Quick Add New Product {search.trim() ? `"${search.trim()}"` : ""}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function computeNextRefNo(existingQuotations: LeadQuotationRecord[]): string {
  let maxSeq = 1000;
  if (Array.isArray(existingQuotations) && existingQuotations.length > 0) {
    for (const q of existingQuotations) {
      const ref = q.ref_no || q.quotation_no || "";
      const matches = String(ref).match(/(\d+)/g);
      if (matches && matches.length > 0) {
        const num = parseInt(matches[matches.length - 1], 10);
        if (!Number.isNaN(num) && num < 1000000 && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }
  return `Q-${maxSeq + 1}`;
}

export function QuotationFormModal({
  lead,
  quotation,
  isCopy = false,
  open,
  onClose,
  onSuccess,
}: Props) {
  const isEditing = Boolean(quotation?._id) && !isCopy;
  const isCopyMode = Boolean(quotation?._id) && Boolean(isCopy);
  const authUser = useAppSelector((state) => state.auth.user);

  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [syncedLeadSections, setSyncedLeadSections] = useState<string[]>([]);
  const [isSyncingLead, setIsSyncingLead] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductRowIdx, setEditingProductRowIdx] = useState<number | null>(null);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);

  const [activeField, setActiveField] = useState<string | null>(null);

  const getFieldStatus = (val: any, fieldId: string): FieldStatus => {
    if (activeField === fieldId) return "active";
    if (val !== undefined && val !== null && String(val).trim() !== "" && val !== 0) {
      return "filled";
    }
    return "empty";
  };

  const getInputClass = (status: FieldStatus, isLocked = false, isSelect = false) => {
    if (isLocked) {
      return "w-full rounded-xl border border-slate-200/80 bg-slate-100/90 px-3 py-2 text-sm text-slate-500 cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-400";
    }

    const base = "w-full rounded-xl px-3 py-2 text-sm transition-all duration-150 focus:outline-none";

    if (status === "active") {
      return `${base} border-2 border-blue-500 bg-blue-50/20 text-blue-700 font-medium ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-950/25 dark:text-blue-300`;
    }
    if (status === "filled") {
      return `${base} border border-emerald-500/70 bg-emerald-50/15 text-emerald-700 font-medium hover:border-emerald-500 dark:border-emerald-500/60 dark:bg-emerald-950/20 dark:text-emerald-300`;
    }
    // empty
    return `${base} border border-slate-200 bg-white text-slate-500 placeholder:text-slate-400 hover:border-slate-300 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400 dark:placeholder:text-slate-500 dark:hover:border-white/20`;
  };

  const getLabelClass = (status: FieldStatus) => {
    if (status === "active") return "text-blue-600 dark:text-blue-400 font-semibold";
    if (status === "filled") return "text-emerald-700 dark:text-emerald-400 font-semibold";
    return "text-slate-500 dark:text-slate-400 font-semibold";
  };

  const renderFieldStatusBadge = (status: FieldStatus, isRequired = false) => {
    if (status === "active") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          Active
        </span>
      );
    }
    if (status === "filled") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          Filled
        </span>
      );
    }
    return isRequired ? (
      <span className="text-[10px] font-medium text-rose-500 dark:text-rose-400">Required</span>
    ) : (
      <span className="text-[10px] text-slate-400 dark:text-slate-500">Optional</span>
    );
  };

  useEffect(() => {
    if (open) setCurrentStep(1);
  }, [open]);

  const { data: companyData } = useGetCompanyInfoQuery(undefined, { skip: !open });
  const { data: branchesData = [] } = useGetBranchesQuery(undefined, { skip: !open });
  const branches = useMemo(() => {
    return Array.isArray(branchesData) ? branchesData : [];
  }, [branchesData]);

  const { data: usersData } = useListUsersQuery();
  const usersList = useMemo(() => {
    return (
      Array.isArray(usersData)
        ? usersData
        : (usersData as { items?: unknown[] })?.items || (usersData as { data?: unknown[] })?.data || []
    ) as Array<{ _id: string; name: string; email: string; phone?: string; department?: string; is_active?: boolean }>;
  }, [usersData]);

  // Sales rep picker: list all Lead Manager portal users
  const salesUsers = useMemo(() => {
    const portalUsers = (usersList as Array<{
      _id: string;
      name: string;
      email?: string;
      phone?: string;
      department?: string;
      role?: string;
      portals?: Array<{ portal_code: string; access_roles?: string[] }>;
    }>).filter(isUserInLeadManagerPortal);
    return portalUsers.length > 0 ? portalUsers : (usersList as Array<any>);
  }, [usersList]);

  // Master Terms & Conditions sets list for multi-selection
  const { data: masterTermsData } = useListTermsAndConditionsQuery(
    { limit: 100 },
    { skip: !open }
  );

  const masterTermsSets: TermsAndConditionsRecord[] = useMemo(() => {
    if (!masterTermsData) return [];
    if (Array.isArray(masterTermsData.terms_and_conditions)) {
      return masterTermsData.terms_and_conditions;
    }
    return [];
  }, [masterTermsData]);

  const [termsSearch, setTermsSearch] = useState("");
  const [termsTypeFilter, setTermsTypeFilter] = useState<string>("all");
  const [expandedSetIds, setExpandedSetIds] = useState<string[]>([]);

  const { data: leadsData } = useListLeadsQuery({ limit: 200 }, { skip: !open });
  const leadsList = useMemo(() => {
    if (Array.isArray(leadsData)) return leadsData;
    if (leadsData && typeof leadsData === "object" && "items" in leadsData) {
      return (leadsData as { items: LeadRecord[] }).items || [];
    }
    if (leadsData && typeof leadsData === "object" && "leads" in leadsData) {
      return (leadsData as { leads: LeadRecord[] }).leads || [];
    }
    return [];
  }, [leadsData]);

  const { data: productsMasterData, refetch: refetchProductsMaster } = useListProductsQuery(
    { limit: "200" },
    { skip: !open }
  );
  const productMasterList = useMemo(() => {
    if (Array.isArray(productsMasterData)) return productsMasterData as CatalogProduct[];
    if (productsMasterData && typeof productsMasterData === "object") {
      if ("items" in productsMasterData && Array.isArray((productsMasterData as { items: unknown }).items)) {
        return (productsMasterData as { items: CatalogProduct[] }).items;
      }
      if ("products" in productsMasterData && Array.isArray((productsMasterData as { products: unknown }).products)) {
        return (productsMasterData as { products: CatalogProduct[] }).products;
      }
      if ("data" in productsMasterData && Array.isArray((productsMasterData as { data: unknown }).data)) {
        return (productsMasterData as { data: CatalogProduct[] }).data;
      }
    }
    return [];
  }, [productsMasterData]);

  const resolveProductMasterFields = (
    productId?: string,
    productName?: string,
    populatedObj?: { sku?: unknown; description?: unknown; mrp?: unknown } | null
  ): { sku: string; description: string; mrp?: number } => {
    const directSku = populatedObj?.sku ? getFieldText(populatedObj.sku) : "";
    const directDesc = populatedObj?.description ? getFieldText(populatedObj.description) : "";
    const directMrp =
      populatedObj && populatedObj.mrp != null && populatedObj.mrp !== "" ? Number(populatedObj.mrp) : undefined;
    const normId = productId ? String(productId) : "";
    const normName = (productName || "").trim().toLowerCase();
    const matched = productMasterList.find(
      (p) =>
        (normId && String(p._id) === normId) ||
        (normName && getFieldText(p.product_name).trim().toLowerCase() === normName)
    );
    return {
      sku: directSku || (matched?.sku ? getFieldText(matched.sku) : ""),
      description: directDesc || (matched?.description ? getFieldText(matched.description) : ""),
      mrp: directMrp ?? (matched?.mrp != null ? Number(matched.mrp) : undefined),
    };
  };

  const handleProductMasterUpdated = (updated: Record<string, unknown>) => {
    const newProd =
      updated && typeof updated === "object" && "data" in updated && updated.data && typeof updated.data === "object"
        ? (updated.data as Record<string, unknown>)
        : updated;
    const pId = String(newProd._id ?? newProd.id ?? editingProductId ?? "");
    if (!pId) return;

    refetchProductsMaster();
    const nextName = getFieldText(newProd.product_name);
    const nextSku = getFieldText(newProd.sku);
    const nextDesc = getFieldText(newProd.description);
    const nextUnit = getFieldText(newProd.unit);
    const nextPrice = typeof newProd.base_price === "number" ? newProd.base_price : Number(newProd.base_price || 0);

    setItems((prev) =>
      prev.map((it, idx) => {
        if (String(it.product || "") !== pId && idx !== editingProductRowIdx) return it;
        return {
          ...it,
          product: pId,
          product_name: nextName || it.product_name,
          hsn_code: nextSku || it.hsn_code,
          description: nextDesc || it.description,
          unit: nextUnit || it.unit,
          rate: !it.rate && nextPrice ? nextPrice : it.rate,
        };
      })
    );

    setEditingProductId(null);
    setEditingProductRowIdx(null);
  };

  const handlePartyMasterUpdated = (updated: Record<string, unknown>) => {
    const newParty =
      updated && typeof updated === "object" && "data" in updated && updated.data && typeof updated.data === "object"
        ? (updated.data as Record<string, any>)
        : (updated as Record<string, any>);
    const pId = String(newParty._id ?? newParty.id ?? editingPartyId ?? "");
    if (!pId) return;

    setSelectedPartyId(pId);
    const contacts = Array.isArray(newParty.contacts) ? newParty.contacts : [];
    const primaryContact = contacts[0] || {};
    const billing = newParty.billing_address && typeof newParty.billing_address === "object" ? newParty.billing_address : {};

    if (newParty.party_name) setCustomerName(String(newParty.party_name));
    const nextAttn = newParty.contact_person || primaryContact.name;
    if (nextAttn) setKindAttn(String(nextAttn));
    const nextPhone = newParty.mobile || newParty.phone || primaryContact.phone;
    if (nextPhone) setPhone(String(nextPhone));
    if (newParty.mobile || newParty.phone) setCell(String(newParty.mobile || newParty.phone));
    const nextEmail = newParty.email || primaryContact.email;
    if (nextEmail) setEmail(String(nextEmail));
    const nextGstin = newParty.gst_no || newParty.gstin;
    if (nextGstin !== undefined) setGstin(String(nextGstin || ""));
    if (billing.address_line_1) setAddressLine(String(billing.address_line_1));
    const nextCity = billing.city || newParty.district;
    if (nextCity) setCity(String(nextCity));
    const nextState = billing.state || newParty.state;
    if (nextState) setState(String(nextState));
    if (billing.pincode) setPincode(String(billing.pincode));

    if (effectiveLeadId) {
      refetchParentLead();
    }
    setEditingPartyId(null);
  };

  const { data: quotationsData, refetch: refetchQuotations } = useListQuotationsQuery(
    { limit: 500 },
    { skip: !open }
  );

  const existingQuotations = useMemo(() => {
    if (Array.isArray(quotationsData)) return quotationsData;
    if (quotationsData && typeof quotationsData === "object" && "quotations" in quotationsData) {
      return (quotationsData as { quotations: LeadQuotationRecord[] }).quotations || [];
    }
    return [];
  }, [quotationsData]);

  const autoNextRefNo = useMemo(() => {
    return computeNextRefNo(existingQuotations);
  }, [existingQuotations]);

  const [selectedLeadId, setSelectedLeadId] = useState<string>("");

  const effectiveLeadId =
    lead?._id ||
    (typeof quotation?.lead === "object" && quotation.lead !== null
      ? quotation.lead._id
      : (quotation?.lead as string)) ||
    selectedLeadId ||
    "";
  const {
    data: freshParentLead,
    refetch: refetchParentLead,
    isFetching: isFetchingParentLead,
  } = useGetLeadQuery(effectiveLeadId, {
    skip: !open || !effectiveLeadId,
    refetchOnMountOrArgChange: true,
  });
  const resolvedLead = freshParentLead || lead || null;

  const handleLeadSelect = (lId: string) => {
    setSelectedLeadId(lId);
    if (!lId) {
      setSelectedPartyId("");
      setSelectedDepartments([]);
      setCustomerName("");
      setKindAttn("");
      setPhone("");
      setCell("");
      setEmail("");
      setAddressLine("");
      setCity("");
      setState("");
      setPincode("");
      return;
    }
    const targetLead = leadsList.find((l) => l._id === lId);
    if (!targetLead) return;

    const leadPartyId =
      (targetLead.party_id && typeof targetLead.party_id === "object"
        ? (targetLead.party_id as any)._id
        : typeof targetLead.party_id === "string"
          ? targetLead.party_id
          : "") || "";
    setSelectedPartyId(leadPartyId);

    const leadDepts = getLeadDepartments(targetLead as any);
    if (leadDepts.length > 0) {
      setSelectedDepartments(leadDepts);
    }

    const leadOrg =
      targetLead.company_name ||
      targetLead.party_id?.party_name ||
      `M/s. ${targetLead.name || "Customer"}`.trim();
    setCustomerName(leadOrg);
    setKindAttn(targetLead.name || targetLead.contacts?.[0]?.name || "");
    setPhone(targetLead.phone || targetLead.contacts?.[0]?.phone || "");
    setCell(targetLead.alternate_phone || targetLead.phone || targetLead.contacts?.[0]?.phone || "");
    setEmail(targetLead.email || targetLead.contacts?.[0]?.email || "");
    setAddressLine(
      targetLead.billing_address?.address_line_1 ||
      targetLead.party_id?.billing_address?.address_line_1 ||
      ""
    );
    setCity(targetLead.billing_address?.city || targetLead.party_id?.district || "");
    setState(targetLead.billing_address?.state || targetLead.party_id?.state || "");
    setPincode(targetLead.billing_address?.pincode || "");
    applyLeadSalesPersons(targetLead);

    if (targetLead.products && targetLead.products.length > 0) {
      setItems(
        (targetLead.products as Array<{ product?: unknown; product_name?: string; remarks?: string; quantity?: number; unit?: string; target_price?: number }>).map((p) => {
          const pObj = typeof p.product === "object" && p.product !== null ? (p.product as { _id?: string; product_name?: string; sku?: unknown; description?: unknown; unit?: string; base_price?: number }) : null;
          const pId = typeof p.product === "string" ? p.product : pObj?._id;
          const pName = p.product_name || pObj?.product_name || "Item / Product";
          const masterFields = resolveProductMasterFields(pId, pName, pObj);
          return {
            product: pId,
            product_name: pName,
            description: p.remarks || masterFields.description,
            hsn_code: masterFields.sku,
            quantity: p.quantity || 1,
            unit: p.unit || pObj?.unit || "Nos",
            rate: p.target_price || pObj?.base_price || 0,
            gst_rate: 18,
          };
        })
      );
      const nextSub = `Offer For ${targetLead.products[0]?.product_name || "Item / Product"}`;
      setSubject(nextSub);
      if (!userClearedMessageRef.current && (!isMessageCustomizedRef.current || isDefaultIntroductoryNote(messageRef.current))) {
        setMessage(buildDefaultIntroductoryNote(nextSub));
      }
    } else {
      setItems([]);
      const nextSub = targetLead.requirement ? `Offer For ${targetLead.requirement}` : "Quotation Proposal";
      setSubject(nextSub);
      if (!userClearedMessageRef.current && (!isMessageCustomizedRef.current || isDefaultIntroductoryNote(messageRef.current))) {
        setMessage(buildDefaultIntroductoryNote(nextSub));
      }
    }
  };

  // Form State
  const [refNo, setRefNo] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [quotationDate, setQuotationDate] = useState("");
  const [validityDays, setValidityDays] = useState<number | string>("");

  // Compute calculated validity expiry date (Quotation Date + Validity Days)
  const validityEndDate = useMemo(() => {
    if (!quotationDate) return "";
    try {
      const d = new Date(quotationDate);
      if (isNaN(d.getTime())) return "";
      d.setDate(d.getDate() + (Number(validityDays) || 15));
      return d.toISOString().split("T")[0];
    } catch {
      return "";
    }
  }, [quotationDate, validityDays]);

  const handleValidityEndDateChange = (eDateStr: string) => {
    if (!eDateStr || !quotationDate) return;
    try {
      const start = new Date(quotationDate);
      const end = new Date(eDateStr);
      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        setValidityDays(diffDays);
      }
    } catch {
      // ignore
    }
  };
  const [subject, setSubject] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [kindAttn, setKindAttn] = useState("");
  const [phone, setPhone] = useState("");
  const [cell, setCell] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  // Visibility toggles for PDF
  const [showKindAttn, setShowKindAttn] = useState(true);
  const [showCustomerRef, setShowCustomerRef] = useState(true);
  const [showCell, setShowCell] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showEmail, setShowEmail] = useState(true);
  const [showGstin, setShowGstin] = useState(true);
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [message, setMessage] = useState("");

  const isMessageCustomizedRef = useRef(false);
  const userClearedMessageRef = useRef(false);
  const messageRef = useRef(message);
  messageRef.current = message;

  const handleSubjectChange = (newSubject: string) => {
    setSubject(newSubject);
    if (!userClearedMessageRef.current && (!isMessageCustomizedRef.current || isDefaultIntroductoryNote(messageRef.current))) {
      setMessage(buildDefaultIntroductoryNote(newSubject));
    }
  };

  useEffect(() => {
    if (userClearedMessageRef.current) return;
    if (!isMessageCustomizedRef.current || isDefaultIntroductoryNote(messageRef.current)) {
      setMessage(buildDefaultIntroductoryNote(subject));
    }
  }, [subject]);

  // Company Branch & Letterhead State
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyRegdAddress, setCompanyRegdAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankBranchName, setBankBranchName] = useState("");
  const [accountType, setAccountType] = useState("");

  const selectedBranch = useMemo(() => {
    if (!branches.length) return null;
    if (selectedBranchId) {
      return branches.find((b) => String(b._id) === String(selectedBranchId)) || null;
    }
    return null;
  }, [branches, selectedBranchId]);

  const formatBranchAddress = (branch?: BranchRecord | null) => {
    if (!branch?.address) return "";
    const addr = branch.address;
    const parts = [
      addr.street,
      addr.landmark,
      addr.city,
      addr.state ? (addr.pincode ? `${addr.state} - ${addr.pincode}` : addr.state) : addr.pincode,
      addr.country || "India",
    ].filter(Boolean);
    return parts.join(", ");
  };

  const handleBranchSelect = (branchId: string, manualUserAction = true) => {
    setSelectedBranchId(branchId);
    if (!branchId) return;
    const branch = branches.find((b) => String(b._id) === String(branchId));
    if (!branch) return;

    const formattedAddr = formatBranchAddress(branch);
    const cName = branch.branch_name || companyData?.trade_name || companyData?.legal_name || "Medica Enterprises";
    setCompanyName(cName);
    setCompanyRegdAddress(formattedAddr);
    setCompanyPhone(branch.contact?.phone || branch.contact?.alternate_phone || companyData?.phone || "");
    setCompanyEmail(branch.contact?.email || branch.contact?.billing_email || companyData?.email || "");
    setCompanyGstin(branch.taxation?.gstin || companyData?.gstin || "");

    const primaryBank = branch.banking?.find((b) => b.is_primary) || branch.banking?.[0];
    if (primaryBank) {
      setBankName(primaryBank.bank_name || "");
      setAccountName(primaryBank.account_name || cName);
      setAccountNumber(primaryBank.account_number || "");
      setIfscCode(primaryBank.ifsc_code || "");
      setBankBranchName(primaryBank.branch_name || "");
      setAccountType(primaryBank.account_type || "Current Account");
    } else if (companyData) {
      setBankName(companyData.bank_name || "");
      setAccountName(companyData.account_name || cName);
      setAccountNumber(companyData.account_number || "");
      setIfscCode(companyData.ifsc_code || "");
      setBankBranchName(companyData.branch_name || "");
      setAccountType(companyData.account_type || "Current Account");
    }

    if (manualUserAction) {
      toast.info(`Branch switched to: ${branch.branch_name}`);
    }
  };

  // Signatory State (Assigned Admin User info printed on PDF)
  const [signatoryUserId, setSignatoryUserId] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryPhone, setSignatoryPhone] = useState("");
  const [signatoryEmail, setSignatoryEmail] = useState("");
  const [signatoryDesignation, setSignatoryDesignation] = useState("");

  // Signatory users list: all users of this Lead Manager portal (without senior/team-senior restrictions)
  const signatoryUsers = useMemo(() => {
    const portalUsers = (usersList as Array<{
      _id: string;
      name: string;
      email?: string;
      phone?: string;
      department?: string;
      designation?: string;
      role?: string;
      is_active?: boolean;
      portals?: Array<{ portal_code: string; access_roles?: string[] }>;
    }>).filter((u) => isUserInLeadManagerPortal(u) && u.is_active !== false);

    const baseList = portalUsers.length > 0 ? portalUsers : (usersList as Array<any>);

    const byId = new Map<string, any>();
    for (const u of baseList) {
      if (u._id) byId.set(String(u._id), u);
    }
    if (signatoryUserId && !byId.has(String(signatoryUserId))) {
      const current = usersList.find((u) => String(u._id) === String(signatoryUserId));
      if (current) byId.set(String(current._id), current);
    }

    return Array.from(byId.values()).sort((a, b) =>
      String(a.name || a.email || "").localeCompare(String(b.name || b.email || ""))
    );
  }, [usersList, signatoryUserId]);

  // Sales Person State (Internal)
  const [salesPersonUserId, setSalesPersonUserId] = useState("");
  const [salesPersonName, setSalesPersonName] = useState("");
  const [salesPersonPhone, setSalesPersonPhone] = useState("");
  const [salesPersonEmail, setSalesPersonEmail] = useState("");
  const [salesPersonDesignation, setSalesPersonDesignation] = useState("");
  const [secondarySalesPersons, setSecondarySalesPersons] = useState<
    Array<{
      user: string;
      name: string;
      phone: string;
      email: string;
      designation: string;
    }>
  >([]);

  // Departments State (Internal Purpose)
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const { departmentOptions } = useLeadDepartmentOptions(selectedDepartments);

  const toggleDepartment = (dept: string) => {
    setSelectedDepartments((prev) => {
      if (prev.includes(dept)) {
        return prev.filter((d) => d !== dept);
      }
      return [...prev, dept];
    });
  };

  const [items, setItems] = useState<ItemState[]>([]);

  const [terms, setTerms] = useState<string[]>([]);
  const [showTerms, setShowTerms] = useState(true);
  const [gstEnabled, setGstEnabled] = useState<boolean>(true);
  const [showMrp, setShowMrp] = useState<boolean>(false);

  // Rich editor modal state for line item specifications
  const [richDescModalItemIdx, setRichDescModalItemIdx] = useState<number | null>(null);
  const [richDescModalText, setRichDescModalText] = useState<string>("");

  const [createQuotation, { isLoading: isCreating }] = useCreateLeadQuotationMutation();
  const [updateQuotation, { isLoading: isUpdating }] = useUpdateLeadQuotationMutation();

  // Populate or reset form
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!open) return;

    if (quotation) {
      setSelectedPartyId(quotation.party_id || "");
      setSelectedLeadId(typeof quotation.lead === "object" && quotation.lead !== null ? quotation.lead._id : (quotation.lead || ""));
      setRefNo(isCopyMode ? autoNextRefNo : (quotation.ref_no || ""));
      setCustomerRef(quotation.customer_ref || "");
      setQuotationDate(
        isCopyMode
          ? new Date().toISOString().split("T")[0]
          : quotation.quotation_date
            ? new Date(quotation.quotation_date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
      );
      setValidityDays(quotation.validity_days || 15);
      setSubject(quotation.subject || "");
      setCustomerName(quotation.customer_name || "");
      setKindAttn(quotation.kind_attn || "");
      setPhone(quotation.phone || "");
      setCell(quotation.cell || "");
      setEmail(quotation.email || "");
      setGstin(quotation.gstin || "");
      setShowKindAttn(quotation.show_kind_attn !== false);
      setShowCustomerRef(quotation.show_customer_ref !== false);
      setShowCell(quotation.show_cell !== false);
      setShowPhone(quotation.show_phone !== false);
      setShowEmail(quotation.show_email !== false);
      setShowGstin(quotation.show_gstin !== false);
      setAddressLine(quotation.address?.address_line_1 || "");
      setCity(quotation.address?.city || "");
      setState(quotation.address?.state || "");
      setPincode(quotation.address?.pincode || "");

      // Branch & company profile from quotation
      const qBranchId = String((quotation as any).branch_id || (quotation as any).company_branch_id || "");
      setSelectedBranchId(qBranchId);
      setCompanyName(quotation.company_name || "");
      setCompanyRegdAddress(quotation.company_regd_address || "");
      setCompanyPhone(quotation.company_phone || "");
      setCompanyEmail(quotation.company_email || "");
      setCompanyGstin(quotation.company_gstin || "");
      setBankName(quotation.bank_name || "");
      setAccountName(quotation.account_name || "");
      setAccountNumber(quotation.account_number || "");
      setIfscCode(quotation.ifsc_code || "");
      setBankBranchName(quotation.branch_name || "");
      setAccountType(quotation.account_type || "");

      // Signatory from quotation
      const qSignatoryId =
        typeof quotation.signatory_user === "object" && quotation.signatory_user !== null
          ? (quotation.signatory_user as any)?._id || ""
          : (quotation.signatory_user as string) || "";
      setSignatoryUserId(qSignatoryId);
      setSignatoryName(quotation.signatory_name || "");
      setSignatoryPhone(quotation.signatory_phone || "");
      setSignatoryEmail(quotation.signatory_email || "");
      setSignatoryDesignation(quotation.signatory_designation || "");
      setGstEnabled((quotation as any).gst_enabled !== false);
      setShowMrp(Boolean((quotation as any).show_mrp));

      // Sales Person from quotation
      const qSalesPersonId =
        typeof (quotation as any).sales_person_user === "object" && (quotation as any).sales_person_user !== null
          ? ((quotation as any).sales_person_user as any)?._id || ""
          : ((quotation as any).sales_person_user as string) || "";
      setSalesPersonUserId(qSalesPersonId);
      setSalesPersonName(quotation.sales_person_name || "");
      setSalesPersonPhone(quotation.sales_person_phone || "");
      setSalesPersonEmail(quotation.sales_person_email || "");
      setSalesPersonDesignation(quotation.sales_person_designation || "Sales Executive");
      setSecondarySalesPersons(
        Array.isArray(quotation.secondary_sales_persons)
          ? quotation.secondary_sales_persons
            .map((s) => {
              const uObj = typeof s.user === "object" && s.user !== null ? s.user : null;
              const uid = uObj?._id || (typeof s.user === "string" ? s.user : "");
              return {
                user: String(uid || ""),
                name: s.name || uObj?.name || "",
                phone: s.phone || uObj?.phone || "",
                email: s.email || uObj?.email || "",
                designation: s.designation || uObj?.designation || "Sales Executive",
              };
            })
            .filter((s) => s.user && s.user !== qSalesPersonId)
          : []
      );

      const qDepts = getLeadDepartments(quotation as any);
      if (qDepts.length > 0) {
        setSelectedDepartments(qDepts);
      }

      if (quotation.items && quotation.items.length > 0) {
        setItems(
          quotation.items.map((i) => {
            const masterFields = resolveProductMasterFields(i.product, i.product_name);
            return {
              product: i.product,
              product_name: i.product_name,
              description: i.description || masterFields.description,
              hsn_code: i.hsn_code || masterFields.sku,
              quantity: i.quantity || 1,
              unit: i.unit || "Nos",
              mrp: (i as any).mrp != null ? Number((i as any).mrp) : masterFields.mrp,
              rate: i.rate || 0,
              discount_percent: Number(i.discount_percent) || 0,
              discount_amount: Number(i.discount_amount) || 0,
              gst_enabled: (i as any).gst_enabled !== false,
              gst_rate: i.gst_rate ?? 5,
            };
          })
        );
      } else {
        setItems([]);
      }
      setTerms(
        quotation.terms_and_conditions && quotation.terms_and_conditions.length > 0
          ? quotation.terms_and_conditions
          : []
      );
      const existingMsg = (quotation as any).message || (quotation as any).quotation_message || "";
      if (existingMsg) {
        setMessage(existingMsg);
        isMessageCustomizedRef.current = !isDefaultIntroductoryNote(existingMsg);
        userClearedMessageRef.current = false;
      } else {
        setMessage(buildDefaultIntroductoryNote(quotation.subject || ""));
        isMessageCustomizedRef.current = false;
        userClearedMessageRef.current = false;
      }
    } else if (lead) {
      // New quotation from Lead
      setSelectedLeadId(lead._id);
      const leadPartyId =
        (lead.party_id && typeof lead.party_id === "object"
          ? (lead.party_id as any)._id
          : typeof lead.party_id === "string"
            ? lead.party_id
            : "") || "";
      setSelectedPartyId(leadPartyId);

      const leadDepts = getLeadDepartments(lead as any);
      if (leadDepts.length > 0) {
        setSelectedDepartments(leadDepts);
      }
      setRefNo(autoNextRefNo);
      setCustomerRef("");
      setQuotationDate(new Date().toISOString().split("T")[0]);
      setValidityDays(15);
      const leadOrg =
        lead.company_name ||
        lead.party_id?.party_name ||
        `M/s. ${lead.name || "Customer"}`.trim();
      setCustomerName(leadOrg);
      setKindAttn(lead.name || lead.contacts?.[0]?.name || "");
      setPhone(lead.phone || lead.contacts?.[0]?.phone || "");
      setCell(lead.alternate_phone || lead.phone || lead.contacts?.[0]?.phone || "");
      setEmail(lead.email || lead.contacts?.[0]?.email || "");
      setGstin("");
      setShowKindAttn(true);
      setShowCustomerRef(true);
      setShowCell(true);
      setShowPhone(true);
      setShowEmail(true);
      setShowGstin(true);
      setAddressLine(
        lead.billing_address?.address_line_1 ||
        lead.party_id?.billing_address?.address_line_1 ||
        ""
      );
      setCity(lead.billing_address?.city || lead.party_id?.district || "");
      setState(lead.billing_address?.state || lead.party_id?.state || "");
      setPincode(lead.billing_address?.pincode || "");

      // Signatory initially blank, only filled after selecting
      setSignatoryUserId("");
      setSignatoryName("");
      setSignatoryPhone("");
      setSignatoryEmail("");
      setSignatoryDesignation("");

      applyLeadSalesPersons(lead);

      // Initial line items from lead products if available
      let initSubject = "";
      if (lead.products && lead.products.length > 0) {
        setItems(
          lead.products.map((p) => {
            const pObj = typeof p.product === "object" && p.product !== null ? (p.product as any) : null;
            const pId = typeof p.product === "string" ? p.product : pObj?._id;
            const pName = p.product_name || pObj?.product_name || "Item / Product";
            const masterFields = resolveProductMasterFields(pId, pName, pObj);
            return {
              product: pId,
              product_name: pName,
              description: p.remarks || masterFields.description,
              hsn_code: masterFields.sku,
              quantity: p.quantity || 1,
              unit: p.unit || pObj?.unit || "Nos",
              mrp: pObj?.mrp != null ? Number(pObj.mrp) : masterFields.mrp,
              rate: p.target_price || pObj?.base_price || 0,
              gst_rate: 18,
            };
          })
        );
        initSubject = `Offer For ${lead.products[0]?.product_name || "Item / Product"}`;
        setSubject(initSubject);
      } else {
        setItems([]);
        initSubject = lead.requirement ? `Offer For ${lead.requirement}` : "Quotation Proposal";
        setSubject(initSubject);
      }
      setGstEnabled(true);
      setShowMrp(false);
      setTerms([]);
      setMessage(buildDefaultIntroductoryNote(initSubject));
      isMessageCustomizedRef.current = false;
      userClearedMessageRef.current = false;
    } else {
      setSelectedLeadId("");
      setSelectedPartyId("");
      setSelectedDepartments([]);
      setSelectedBranchId("");
      setCompanyName("");
      setCompanyRegdAddress("");
      setCompanyPhone("");
      setCompanyEmail("");
      setCompanyGstin("");
      setBankName("");
      setAccountName("");
      setAccountNumber("");
      setIfscCode("");
      setBankBranchName("");
      setAccountType("");
      setRefNo(autoNextRefNo);
      setCustomerRef("");
      setQuotationDate(new Date().toISOString().split("T")[0]);
      setValidityDays("");
      setCustomerName("");
      setKindAttn("");
      setPhone("");
      setCell("");
      setEmail("");
      setGstin("");
      setShowKindAttn(true);
      setShowCustomerRef(true);
      setShowCell(true);
      setShowPhone(true);
      setShowEmail(true);
      setShowGstin(true);
      setAddressLine("");
      setCity("");
      setState("");
      setPincode("");
      // Signatory initially blank, only filled after selecting
      setSignatoryUserId("");
      setSignatoryName("");
      setSignatoryPhone("");
      setSignatoryEmail("");
      setSignatoryDesignation("");

      applyLeadSalesPersons(null);

      setItems([]);
      setGstEnabled(true);
      setShowMrp(false);
      setSubject("");
      setTerms([]);
      setMessage(buildDefaultIntroductoryNote(""));
      isMessageCustomizedRef.current = false;
      userClearedMessageRef.current = false;
    }
  }, [open, quotation, lead, autoNextRefNo, authUser]);

  // Recheck parent lead changes when opening in Update mode & sync latest lead data
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!open || !isEditing || !quotation || !resolvedLead) {
      if (!open) setSyncedLeadSections([]);
      return;
    }

    const changed: string[] = [];

    // 1. Customer / Party & Address sync
    const leadPartyId =
      (resolvedLead.party_id && typeof resolvedLead.party_id === "object"
        ? (resolvedLead.party_id as any)._id
        : typeof resolvedLead.party_id === "string"
          ? resolvedLead.party_id
          : "") || "";
    const leadOrg =
      resolvedLead.company_name ||
      resolvedLead.party_id?.party_name ||
      `M/s. ${resolvedLead.name || "Customer"}`.trim();
    const leadAttn = resolvedLead.name || resolvedLead.contacts?.[0]?.name || "";
    const leadPhone = resolvedLead.phone || resolvedLead.contacts?.[0]?.phone || "";
    const leadCell = resolvedLead.alternate_phone || resolvedLead.phone || resolvedLead.contacts?.[0]?.phone || "";
    const leadEmail = resolvedLead.email || resolvedLead.contacts?.[0]?.email || "";
    const leadAddr =
      resolvedLead.billing_address?.address_line_1 ||
      resolvedLead.party_id?.billing_address?.address_line_1 ||
      "";
    const leadCity = resolvedLead.billing_address?.city || resolvedLead.party_id?.district || "";
    const leadState = resolvedLead.billing_address?.state || resolvedLead.party_id?.state || "";
    const leadPincode = resolvedLead.billing_address?.pincode || "";

    if (
      leadPartyId !== String(quotation.party_id || "") ||
      leadOrg !== String(quotation.customer_name || "") ||
      leadAttn !== String(quotation.kind_attn || "") ||
      leadPhone !== String(quotation.phone || "") ||
      leadEmail !== String(quotation.email || "") ||
      leadAddr !== String(quotation.address?.address_line_1 || "") ||
      leadCity !== String(quotation.address?.city || "") ||
      leadState !== String(quotation.address?.state || "") ||
      leadPincode !== String(quotation.address?.pincode || "")
    ) {
      setSelectedPartyId(leadPartyId);
      setCustomerName(leadOrg);
      setKindAttn(leadAttn);
      setPhone(leadPhone);
      setCell(leadCell);
      setEmail(leadEmail);
      setAddressLine(leadAddr);
      setCity(leadCity);
      setState(leadState);
      setPincode(leadPincode);
      changed.push("Customer & Address");
    }

    // 3. Primary & Secondary Sales Representatives sync
    const { primary: leadPrimary, secondary: leadSecondary } = splitLeadAssignees(resolvedLead as any);
    const leadPrimaryId = leadPrimary?._id ? String(leadPrimary._id) : "";
    const qPrimaryId =
      typeof (quotation as any).sales_person_user === "object" && (quotation as any).sales_person_user !== null
        ? String(((quotation as any).sales_person_user as any)?._id || "")
        : String((quotation as any).sales_person_user || "");
    const leadSecIds = leadSecondary.map((u) => String(u._id)).sort().join(",");
    const qSecIds = (quotation.secondary_sales_persons || [])
      .map((s) =>
        typeof s.user === "object" && s.user !== null ? String((s.user as any)?._id || "") : String(s.user || "")
      )
      .filter(Boolean)
      .sort()
      .join(",");

    if (leadPrimaryId !== qPrimaryId || leadSecIds !== qSecIds) {
      applyLeadSalesPersons(resolvedLead);
      changed.push("Sales Representatives");
    }

    // 4. Departments sync
    const leadDepts = getLeadDepartments(resolvedLead as any);
    const quoteDepts = getLeadDepartments(quotation as any);
    if (leadDepts.length > 0 && leadDepts.slice().sort().join(",") !== quoteDepts.slice().sort().join(",")) {
      setSelectedDepartments(leadDepts);
      changed.push("Departments");
    }

    setSyncedLeadSections(changed);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, isEditing, quotation, resolvedLead]);

  // Backfill empty HSN/SKU and description from product master once loaded
  useEffect(() => {
    if (!open || productMasterList.length === 0) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setItems((prev) => {
      let updated = false;
      const next = prev.map((it) => {
        const needsSku = !it.hsn_code || !it.hsn_code.trim();
        const needsDesc = !it.description || !it.description.trim();
        const needsMrp = (it.mrp == null || it.mrp === 0);
        const masterFields = resolveProductMasterFields(it.product, it.product_name);
        const nextSku = needsSku && masterFields.sku ? masterFields.sku : it.hsn_code;
        const nextDesc = needsDesc && masterFields.description ? masterFields.description : it.description;
        const nextMrp = needsMrp && masterFields.mrp != null ? masterFields.mrp : it.mrp;
        if (nextSku === it.hsn_code && nextDesc === it.description && nextMrp === it.mrp) return it;
        updated = true;
        return { ...it, hsn_code: nextSku, description: nextDesc, mrp: nextMrp };
      });
      return updated ? next : prev;
    });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, productMasterList]);

  const handleSyncFromLead = async () => {
    if (!effectiveLeadId) return;
    setIsSyncingLead(true);
    try {
      const res = await refetchParentLead();
      const latestLead = (res?.data as LeadRecord | undefined) || resolvedLead;
      if (!latestLead) {
        toast.error("Could not load parent lead details");
        return;
      }

      const changed: string[] = [];

      // 1. Customer / Party & Address sync against current form values
      const leadPartyId =
        (latestLead.party_id && typeof latestLead.party_id === "object"
          ? (latestLead.party_id as any)._id
          : typeof latestLead.party_id === "string"
            ? latestLead.party_id
            : "") || "";
      const leadOrg =
        latestLead.company_name ||
        latestLead.party_id?.party_name ||
        `M/s. ${latestLead.name || "Customer"}`.trim();
      const leadAttn = latestLead.name || latestLead.contacts?.[0]?.name || "";
      const leadPhone = latestLead.phone || latestLead.contacts?.[0]?.phone || "";
      const leadCell =
        latestLead.alternate_phone || latestLead.phone || latestLead.contacts?.[0]?.phone || "";
      const leadEmail = latestLead.email || latestLead.contacts?.[0]?.email || "";
      const leadAddr =
        latestLead.billing_address?.address_line_1 ||
        latestLead.party_id?.billing_address?.address_line_1 ||
        "";
      const leadCity = latestLead.billing_address?.city || latestLead.party_id?.district || "";
      const leadState = latestLead.billing_address?.state || latestLead.party_id?.state || "";
      const leadPincode = latestLead.billing_address?.pincode || "";

      if (
        leadPartyId !== String(selectedPartyId || "") ||
        leadOrg !== String(customerName || "") ||
        leadAttn !== String(kindAttn || "") ||
        leadPhone !== String(phone || "") ||
        leadCell !== String(cell || "") ||
        leadEmail !== String(email || "") ||
        leadAddr !== String(addressLine || "") ||
        leadCity !== String(city || "") ||
        leadState !== String(state || "") ||
        leadPincode !== String(pincode || "")
      ) {
        setSelectedPartyId(leadPartyId);
        setCustomerName(leadOrg);
        setKindAttn(leadAttn);
        setPhone(leadPhone);
        setCell(leadCell);
        setEmail(leadEmail);
        setAddressLine(leadAddr);
        setCity(leadCity);
        setState(leadState);
        setPincode(leadPincode);
        changed.push("Customer & Address");
      }

      // 2. Products / Line Items sync (preserve existing pricing/specs for matching products)
      if (Array.isArray(latestLead.products) && latestLead.products.length > 0) {
        const syncedItems: ItemState[] = latestLead.products.map((p) => {
          const pObj = typeof p.product === "object" && p.product !== null ? (p.product as any) : null;
          const pId = typeof p.product === "string" ? p.product : pObj?._id;
          const pName = p.product_name || pObj?.product_name || "Item / Product";
          const matched = items.find(
            (qi) =>
              (pId && String(qi.product || "") === String(pId)) ||
              qi.product_name.trim().toLowerCase() === pName.trim().toLowerCase()
          );
          const masterFields = resolveProductMasterFields(pId, pName, pObj);
          return {
            product: pId,
            product_name: pName,
            description: matched?.description || p.remarks || masterFields.description,
            hsn_code: matched?.hsn_code || masterFields.sku,
            quantity: p.quantity || matched?.quantity || 1,
            unit: p.unit || pObj?.unit || matched?.unit || "Nos",
            rate: matched?.rate ?? p.target_price ?? pObj?.base_price ?? 0,
            discount_percent: Number(matched?.discount_percent) || 0,
            discount_amount: Number(matched?.discount_amount) || 0,
            gst_enabled: (matched as any)?.gst_enabled !== false,
            gst_rate: matched?.gst_rate ?? 18,
          };
        });

        const leadSig = syncedItems
          .map((i) => `${i.product || ""}|${i.product_name}|${i.quantity}|${i.unit}`)
          .join(";;");
        const curSig = items
          .map((i) => `${i.product || ""}|${i.product_name}|${i.quantity}|${i.unit}`)
          .join(";;");
        if (leadSig !== curSig) {
          setItems(syncedItems);
          changed.push("Products");
        }
      } else if (Array.isArray(latestLead.products) && latestLead.products.length === 0) {
        if (items.length > 0) {
          setItems([]);
          changed.push("Products");
        }
      }

      // 3. Primary & Secondary Sales Representatives sync
      const { primary: leadPrimary, secondary: leadSecondary } = splitLeadAssignees(latestLead as any);
      const leadPrimaryId = leadPrimary?._id ? String(leadPrimary._id) : "";
      const leadSecIds = leadSecondary.map((u) => String(u._id)).sort().join(",");
      const curSecIds = secondarySalesPersons
        .map((s) => String(s.user || ""))
        .filter(Boolean)
        .sort()
        .join(",");

      if (leadPrimaryId !== String(salesPersonUserId || "") || leadSecIds !== curSecIds) {
        applyLeadSalesPersons(latestLead);
        changed.push("Sales Representatives");
      }

      // 4. Departments sync
      const leadDepts = getLeadDepartments(latestLead as any);
      if (
        leadDepts.length > 0 &&
        leadDepts.slice().sort().join(",") !== selectedDepartments.slice().sort().join(",")
      ) {
        setSelectedDepartments(leadDepts);
        changed.push("Departments");
      }

      if (changed.length > 0) {
        setSyncedLeadSections(changed);
        toast.success(`Synced from Lead: ${changed.join(", ")}`);
      } else {
        toast.info("Quotation is already in sync with the parent Lead");
      }
    } catch {
      toast.error("Failed to sync latest changes from parent Lead");
    } finally {
      setIsSyncingLead(false);
    }
  };

  // If editing an existing quote that didn't have branch_id explicitly set, match branch by code, gstin, or fallback to head office
  useEffect(() => {
    if (quotation && !selectedBranchId && branches.length > 0 && open) {
      const qAny = quotation as any;
      const match =
        branches.find((b) => b.branch_code && b.branch_code === qAny.branch_code) ||
        branches.find((b) => b.taxation?.gstin && b.taxation.gstin === quotation.company_gstin) ||
        branches.find((b) => b.is_head_office) ||
        branches[0];
      if (match) {
        setSelectedBranchId(match._id);
        if (!companyName) setCompanyName(quotation.company_name || match.branch_name);
        if (!companyRegdAddress) setCompanyRegdAddress(quotation.company_regd_address || formatBranchAddress(match));
        if (!companyPhone) setCompanyPhone(quotation.company_phone || match.contact?.phone || "");
        if (!companyEmail) setCompanyEmail(quotation.company_email || match.contact?.email || "");
        if (!companyGstin) setCompanyGstin(quotation.company_gstin || match.taxation?.gstin || "");
      }
    }
  }, [quotation, selectedBranchId, branches, open]);

  const handleSelectAdminUser = (userId: string) => {
    if (!userId) {
      setSignatoryUserId("");
      setSignatoryName("");
      setSignatoryPhone("");
      setSignatoryEmail("");
      setSignatoryDesignation("");
      return;
    }
    const selected = usersList.find((u) => u._id === userId);
    if (!selected) return;
    const roleBadge = getLeadManagerPortalRole(selected as any);
    setSignatoryUserId(selected._id);
    setSignatoryName(selected.name || "");
    setSignatoryPhone(selected.phone || "");
    setSignatoryEmail(selected.email || "");
    setSignatoryDesignation(
      (selected as any).designation ||
      (roleBadge === "Admin"
        ? "Lead Administrator"
        : roleBadge === "Manager"
        ? "Lead Manager"
        : roleBadge === "Coordinator"
        ? "Lead Coordinator"
        : roleBadge === "Executive"
        ? "Sales Executive"
        : "Authorized Signatory")
    );
  };

  const applyLeadSalesPersons = (targetLead: LeadRecord | null | undefined) => {
    const { primary, secondary } = splitLeadAssignees(targetLead as any);
    if (primary?._id) {
      const fullPrimary = (usersList.find((u) => String(u._id) === String(primary._id)) as any) || primary;
      setSalesPersonUserId(String(fullPrimary._id || primary._id));
      setSalesPersonName(String(fullPrimary.name || fullPrimary.email || ""));
      setSalesPersonPhone(String(fullPrimary.phone || ""));
      setSalesPersonEmail(String(fullPrimary.email || ""));
      setSalesPersonDesignation(
        String(
          fullPrimary.designation ||
          (fullPrimary.department
            ? `${fullPrimary.department.charAt(0).toUpperCase() + fullPrimary.department.slice(1)} Executive`
            : "Sales Executive")
        )
      );
    } else if (authUser && isSalesDepartmentUser(authUser as any)) {
      setSalesPersonUserId(String(authUser._id || (authUser as any).id || ""));
      setSalesPersonName(String(authUser.name || authUser.email || ""));
      setSalesPersonPhone(String((authUser as any).phone || ""));
      setSalesPersonEmail(String(authUser.email || ""));
      setSalesPersonDesignation(String((authUser as any).designation || "Sales Executive"));
    } else {
      setSalesPersonUserId("");
      setSalesPersonName("");
      setSalesPersonPhone("");
      setSalesPersonEmail("");
      setSalesPersonDesignation("");
    }

    const primaryId = primary?._id ? String(primary._id) : "";
    setSecondarySalesPersons(
      secondary
        .filter((u) => u._id && String(u._id) !== primaryId)
        .map((u) => {
          const full = (usersList.find((usr) => String(usr._id) === String(u._id)) as any) || u;
          return {
            user: String(full._id || u._id),
            name: String(full.name || full.email || ""),
            phone: String(full.phone || ""),
            email: String(full.email || ""),
            designation: String(
              full.designation ||
              (full.department
                ? `${full.department.charAt(0).toUpperCase() + full.department.slice(1)} Executive`
                : "Sales Executive")
            ),
          };
        })
    );
  };

  const calculations = useMemo(() => {
    const totals = computeQuotationTotals(items, { gstEnabled });
    return {
      items: totals.computedItems.map(({ item, gross, discPercent, discAmt, taxable, gstAmt, lineTotal }) => ({
        ...item,
        gross,
        discPercent,
        discAmt,
        taxable,
        gstAmt,
        lineTotal,
      })),
      totalGross: totals.totalGross,
      totalDiscount: totals.totalDiscount,
      subtotal: totals.subtotal,
      totalGst: totals.totalGst,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      amount_in_words: totals.amount_in_words || numberToIndianWords(totals.grandTotal),
    };
  }, [items, gstEnabled]);

  // Live Preview State & dynamic LeadQuotationRecord object
  const [showLivePreviewModal, setShowLivePreviewModal] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const previewQuotationRecord: LeadQuotationRecord = useMemo(() => {
    return {
      _id: quotation?._id || "preview-id",
      quotation_no: refNo.trim() || autoNextRefNo || "Q-PREVIEW",
      ref_no: refNo.trim() || autoNextRefNo || "Q-PREVIEW",
      customer_ref: customerRef.trim() || undefined,
      show_customer_ref: showCustomerRef,
      lead: selectedLeadId || lead?._id || "",
      party_id: selectedPartyId || undefined,
      quotation_date: quotationDate ? new Date(quotationDate).toISOString() : new Date().toISOString(),
      valid_until: validityEndDate ? new Date(validityEndDate).toISOString() : undefined,
      validity_days: Number(validityDays) || 15,
      subject: subject.trim() || "Quotation Proposal",
      customer_name: customerName.trim() || "Customer / Organization",
      kind_attn: kindAttn.trim() || undefined,
      show_kind_attn: showKindAttn,
      phone: phone.trim() || undefined,
      show_phone: showPhone,
      cell: cell.trim() || undefined,
      show_cell: showCell,
      email: email.trim() || undefined,
      show_email: showEmail,
      gstin: gstin.trim() || undefined,
      show_gstin: showGstin,
      address: {
        address_line_1: addressLine.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        country: "India",
        pincode: pincode.trim() || undefined,
      },
      items: items.map((i, idx) => {
        const calc = calculations.items[idx];
        return {
          product: i.product,
          product_name: i.product_name.trim() || "Item",
          description: i.description || "",
          hsn_code: i.hsn_code || "",
          quantity: parseQuotationLineQuantity(i.quantity, 1),
          unit: i.unit || "Nos",
          mrp: i.mrp ?? resolveProductMasterFields(i.product, i.product_name).mrp,
          rate: Number(i.rate) || 0,
          discount_percent: Number(i.discount_percent) || 0,
          discount_amount: Number(i.discount_amount) || 0,
          taxable_amount: calc?.taxable ?? 0,
          gst_enabled: i.gst_enabled !== false,
          gst_rate: Number(i.gst_rate) || 0,
          total_gst_amount: calc?.gstAmt ?? 0,
          line_total: calc?.lineTotal ?? 0,
        };
      }),
      total_discount: calculations.totalDiscount,
      subtotal: calculations.subtotal,
      total_gst: calculations.totalGst,
      round_off: calculations.roundOff,
      grand_total: calculations.grandTotal,
      amount_in_words: calculations.amount_in_words || numberToIndianWords(calculations.grandTotal),
      message: message || undefined,
      quotation_message: message || undefined,
      terms_and_conditions: terms.filter(Boolean),
      branch_id: selectedBranchId || undefined,
      branch_code: branches.find((b) => String(b._id) === String(selectedBranchId))?.branch_code || undefined,
      company_branch_name: companyName || undefined,
      company_name: companyName || undefined,
      company_regd_address: companyRegdAddress || undefined,
      company_phone: companyPhone || undefined,
      company_email: companyEmail || undefined,
      company_gstin: companyGstin || undefined,
      bank_name: bankName || undefined,
      account_name: accountName || undefined,
      account_number: accountNumber || undefined,
      ifsc_code: ifscCode || undefined,
      branch_name: bankBranchName || undefined,
      account_type: accountType || undefined,
      signatory_name: signatoryName.trim() || "Authorized Signatory",
      signatory_phone: signatoryPhone.trim() || undefined,
      signatory_email: signatoryEmail.trim() || undefined,
      signatory_designation: signatoryDesignation.trim() || "Lead Manager",
      signatory_user: signatoryUserId || undefined,
      sales_person_name: salesPersonName.trim() || undefined,
      sales_person_phone: salesPersonPhone.trim() || undefined,
      sales_person_email: salesPersonEmail.trim() || undefined,
      sales_person_designation: salesPersonDesignation.trim() || "Sales Executive",
      sales_person_user: salesPersonUserId || undefined,
      secondary_sales_persons: secondarySalesPersons,
      department: selectedDepartments.join(", "),
      departments: selectedDepartments,
      status: "draft",
      approval_status: "pending_approval",
      gst_enabled: gstEnabled,
      show_mrp: showMrp,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [
    quotation?._id,
    refNo,
    autoNextRefNo,
    customerRef,
    showCustomerRef,
    selectedLeadId,
    lead?._id,
    selectedPartyId,
    quotationDate,
    validityEndDate,
    validityDays,
    subject,
    customerName,
    kindAttn,
    showKindAttn,
    phone,
    showPhone,
    cell,
    showCell,
    email,
    showEmail,
    gstin,
    showGstin,
    addressLine,
    city,
    state,
    pincode,
    items,
    gstEnabled,
    showMrp,
    calculations,
    terms,
    message,
    selectedBranchId,
    branches,
    companyName,
    companyRegdAddress,
    companyPhone,
    companyEmail,
    companyGstin,
    bankName,
    accountName,
    accountNumber,
    ifscCode,
    bankBranchName,
    accountType,
    signatoryName,
    signatoryPhone,
    signatoryEmail,
    signatoryDesignation,
    signatoryUserId,
    salesPersonName,
    salesPersonPhone,
    salesPersonEmail,
    salesPersonDesignation,
    salesPersonUserId,
    secondarySalesPersons,
    selectedDepartments,
  ]);

  const handlePrintPreview = () => {
    if (!previewContainerRef.current) return;
    const isMultiPage = (previewContainerRef.current.scrollHeight || 0) > 1060;
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Preview_Quotation_${refNo || autoNextRefNo || "Draft"}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm;
              ${isMultiPage
        ? `@bottom-center {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 7.5pt;
                font-weight: 700;
                color: #334155;
              }`
        : `@bottom-center {
                content: none;
              }`
      }
            }
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #0f172a;
              font-family: Arial, Helvetica, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            #quotation-pdf-root {
              width: 100% !important;
              max-width: 794px !important;
              margin: 0 auto !important;
              padding: 0 !important;
              box-shadow: none !important;
              background: #ffffff !important;
            }
            .rich-text-content { font-size: 8.5px !important; line-height: 1.4 !important; color: #1e293b !important; }
            .rich-text-content table { width: 100% !important; border-collapse: collapse !important; margin: 4px 0 6px 0 !important; page-break-inside: avoid !important; }
            .rich-text-content th, .rich-text-content td { border: 1px solid #cbd5e1 !important; padding: 4px 6px !important; font-size: 8px !important; line-height: 1.3 !important; text-align: left !important; vertical-align: top !important; }
            .rich-text-content th { background-color: #f1f5f9 !important; font-weight: 700 !important; color: #0f172a !important; }
            .rich-text-content p { margin: 0 0 3px 0 !important; }
            .rich-text-content ul, .rich-text-content ol { margin: 2px 0 4px 0 !important; padding-left: 16px !important; }
            ${isMultiPage
        ? `.print-page-number::after { content: "Page " counter(page) " of " counter(pages); }`
        : `.print-page-number { display: none !important; }`
      }
          </style>
        </head>
        <body class="${isMultiPage ? "multi-page" : "single-page"}">
          ${previewContainerRef.current.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (err) {
        console.error("Print preview error:", err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 1000);
      }
    }, 350);
  };

  const handleTermChange = (index: number, val: string) => {
    setTerms((prev) => prev.map((t, idx) => (idx === index ? val : t)));
  };

  const filteredTermsSets = useMemo(() => {
    return masterTermsSets.filter((set) => {
      if (termsTypeFilter !== "all" && set.type !== termsTypeFilter) {
        return false;
      }
      if (!termsSearch.trim()) return true;
      const q = termsSearch.toLowerCase().trim();
      const titleMatch = set.title?.toLowerCase().includes(q);
      const codeMatch = set.code?.toLowerCase().includes(q);
      const textMatch = (set.terms_text || []).some((t) =>
        t.text?.toLowerCase().includes(q)
      );
      return titleMatch || codeMatch || textMatch;
    });
  }, [masterTermsSets, termsTypeFilter, termsSearch]);

  const getSetLines = (set: TermsAndConditionsRecord): string[] => {
    return (set.terms_text || [])
      .filter((t) => t.is_active !== false && t.text && t.text.trim())
      .map((t) => t.text.trim());
  };

  const getSetSelectionStatus = (set: TermsAndConditionsRecord): "none" | "all" | "partial" => {
    const lines = getSetLines(set);
    if (lines.length === 0) return "none";
    const presentCount = lines.filter((l) => terms.some((t) => t.trim() === l)).length;
    if (presentCount === lines.length) return "all";
    if (presentCount > 0) return "partial";
    return "none";
  };

  const handleToggleTermsSet = (set: TermsAndConditionsRecord) => {
    const setLines = getSetLines(set);
    if (setLines.length === 0) return;
    const status = getSetSelectionStatus(set);

    if (status === "all") {
      // Deselecting: remove all lines belonging to this set
      setTerms((prev) => prev.filter((t) => !setLines.includes(t.trim())));
    } else {
      // Selecting: add all missing lines from this set
      setTerms((prev) => {
        const existing = new Set(prev.map((t) => t.trim()));
        const toAdd = setLines.filter((l) => !existing.has(l));
        return [...prev, ...toAdd];
      });
    }
  };

  const handleToggleClause = (clauseText: string) => {
    const trimmed = clauseText.trim();
    if (!trimmed) return;
    setTerms((prev) => {
      const exists = prev.some((t) => t.trim() === trimmed);
      if (exists) {
        return prev.filter((t) => t.trim() !== trimmed);
      } else {
        return [...prev, trimmed];
      }
    });
  };

  const handleToggleExpandSet = (setId: string) => {
    setExpandedSetIds((prev) =>
      prev.includes(setId) ? prev.filter((id) => id !== setId) : [...prev, setId]
    );
  };

  const handleSelectAllFilteredSets = () => {
    const linesToAdd: string[] = [];
    filteredTermsSets.forEach((set) => {
      getSetLines(set).forEach((l) => {
        if (!linesToAdd.includes(l)) {
          linesToAdd.push(l);
        }
      });
    });
    setTerms((prev) => {
      const existing = new Set(prev.map((t) => t.trim()));
      const toAdd = linesToAdd.filter((l) => !existing.has(l));
      return [...prev, ...toAdd];
    });
  };

  const handleClearAllTerms = () => {
    setTerms([]);
  };

  const handleAddTerm = () => {
    setTerms((prev) => [...prev, "New Condition: Enter terms details here."]);
  };

  const handleRemoveTerm = (index: number) => {
    setTerms((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManageQuotations(authUser)) {
      toast.error("Only administrators, managers, and coordinators are authorized to create or edit quotations");
      return;
    }

    if (!isEditing && lead && !canCreateQuotation(lead.status)) {
      toast.error(`Quotations cannot be generated for leads in '${lead.status}' status`);
      return;
    }

    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    if (items.some((i) => !i.product_name.trim())) {
      toast.error("All line items must have a product name");
      return;
    }

    if (items.some((i) => !isValidQuotationLineQuantity(parseQuotationLineQuantity(i.quantity, NaN)))) {
      toast.error("Each line needs a non-zero quantity (use negative qty for returns or replacements)");
      return;
    }

    if (!signatoryName.trim()) {
      toast.error("Please select an authorized signatory from the signatory dropdown");
      return;
    }

    if (selectedDepartments.length === 0) {
      toast.error("Please select at least one department for internal purpose");
      return;
    }

    const cleanedTerms = terms.map((t) => t.trim()).filter(Boolean);

    const payload: CreateQuotationPayload = {
      ref_no: refNo.trim() || undefined,
      customer_ref: customerRef.trim() || undefined,
      show_customer_ref: showCustomerRef,
      party_id: selectedPartyId || undefined,
      quotation_date: quotationDate ? new Date(quotationDate).toISOString() : new Date().toISOString(),
      validity_days: Number(validityDays) || 15,
      subject: subject.trim() || undefined,
      customer_name: customerName.trim(),
      kind_attn: kindAttn.trim(),
      show_kind_attn: showKindAttn,
      phone: phone.trim(),
      show_phone: showPhone,
      cell: cell.trim(),
      show_cell: showCell,
      email: email.trim(),
      show_email: showEmail,
      gstin: gstin.trim(),
      show_gstin: showGstin,
      address: {
        address_line_1: addressLine.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        country: "India",
      },
      items: items.map((i) => ({
        product: i.product,
        product_name: i.product_name.trim(),
        description: i.description.trim(),
        hsn_code: i.hsn_code.trim() || "",
        quantity: parseQuotationLineQuantity(i.quantity, 1),
        unit: i.unit.trim() || "Nos",
        mrp: i.mrp != null ? Number(i.mrp) : resolveProductMasterFields(i.product, i.product_name).mrp,
        rate: Number(i.rate) || 0,
        discount_percent: Number(i.discount_percent) || 0,
        discount_amount: Number(i.discount_amount) || 0,
        gst_enabled: i.gst_enabled !== false,
        gst_rate: Number(i.gst_rate) || 0,
      })),
      gst_enabled: gstEnabled,
      show_mrp: showMrp,
      terms_and_conditions: cleanedTerms,
      message: message.trim() || undefined,
      quotation_message: message.trim() || undefined,
      branch_id: selectedBranchId || undefined,
      branch_code: branches.find((b) => String(b._id) === String(selectedBranchId))?.branch_code || undefined,
      company_branch_name: companyName || undefined,
      company_name: companyName.trim() || undefined,
      company_regd_address: companyRegdAddress.trim() || undefined,
      company_phone: companyPhone.trim() || undefined,
      company_email: companyEmail.trim() || undefined,
      company_gstin: companyGstin.trim() || undefined,
      bank_name: bankName.trim() || undefined,
      account_name: accountName.trim() || undefined,
      account_number: accountNumber.trim() || undefined,
      ifsc_code: ifscCode.trim() || undefined,
      branch_name: bankBranchName.trim() || undefined,
      account_type: accountType.trim() || undefined,
      signatory_name: signatoryName.trim(),
      signatory_phone: signatoryPhone.trim(),
      signatory_email: signatoryEmail.trim(),
      signatory_designation: signatoryDesignation.trim() || "Authorized Signatory",
      signatory_user: signatoryUserId || undefined,
      sales_person_name: salesPersonName.trim(),
      sales_person_phone: salesPersonPhone.trim(),
      sales_person_email: salesPersonEmail.trim(),
      sales_person_designation: salesPersonDesignation.trim() || "Sales Executive",
      sales_person_user: salesPersonUserId || undefined,
      secondary_sales_persons: secondarySalesPersons.filter(
        (s) => s.user && String(s.user) !== String(salesPersonUserId || "")
      ),
      department: selectedDepartments.join(", "),
      departments: selectedDepartments,
      amount_in_words: calculations.amount_in_words || numberToIndianWords(calculations.grandTotal),
    };

    const targetLeadId =
      selectedLeadId ||
      lead?._id ||
      (typeof quotation?.lead === "object" && quotation.lead !== null
        ? quotation.lead._id
        : (quotation?.lead as string)) ||
      "";

    try {
      if (isEditing && quotation?._id) {
        const res = await updateQuotation({
          quotationId: quotation._id,
          leadId: targetLeadId || undefined,
          body: payload,
        }).unwrap();
        toast.success(`Quotation ${res.quotation_no} updated successfully`);
        onSuccess?.(res);
      } else {
        const res = await createQuotation({
          leadId: targetLeadId || undefined,
          body: payload,
        }).unwrap();
        toast.success(`Quotation ${res.quotation_no} created successfully`);
        onSuccess?.(res);
      }
      onClose();
    } catch (err: unknown) {
      toast.error(mutationRejectedMessage(err) || "Failed to save quotation");
    }
  };

  if (!open) return null;

  if (!canManageQuotations(authUser)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
        <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Administrator Access Required
          </h3>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Only administrators (Admin, Super Admin, and Finance) are authorized to create or edit quotations.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900">
      <div className="relative flex h-full w-full flex-col bg-white dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              {isCopyMode ? <Copy className="h-5 w-5 text-indigo-500" /> : <FileText className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEditing
                  ? `Edit Quotation #${quotation?.quotation_no}`
                  : isCopyMode
                    ? `Copy Quotation (from #${quotation?.quotation_no || quotation?.ref_no})`
                    : "Generate Quotation"}
              </h3>
              <p className="text-sm text-slate-500">
                {isCopyMode
                  ? `Creating a new quotation copied from #${quotation?.quotation_no || quotation?.ref_no || "previous quotation"}`
                  : `Official Letterhead format quotation for ${customerName || lead?.name || "Customer"}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {effectiveLeadId && (
              <button
                type="button"
                onClick={handleSyncFromLead}
                disabled={isSyncingLead || isFetchingParentLead}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3.5 py-2 text-sm font-bold text-indigo-700 shadow-2xs transition hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50 cursor-pointer"
                title="Re-fetch and sync latest Customer, Products, Sales Representatives & Departments from parent Lead"
              >
                <RefreshCw
                  className={`h-4 w-4 text-indigo-600 dark:text-indigo-400 ${isSyncingLead || isFetchingParentLead ? "animate-spin" : ""
                    }`}
                />
                <span>{isSyncingLead || isFetchingParentLead ? "Syncing..." : "Sync from Lead"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowLivePreviewModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-sm font-bold text-emerald-700 shadow-2xs transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 cursor-pointer"
              title="View real-time A4 letterhead preview with PREVIEW watermark"
            >
              <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Live Preview</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Multi-Step Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          {/* Stepper Bar */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-3 dark:border-white/10 dark:bg-slate-900/70">
            <div className="flex flex-wrap items-center gap-2">
              {QUOTATION_FORM_STEPS.map((step, idx) => {
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                return (
                  <React.Fragment key={step.id}>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(step.id)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition cursor-pointer ${isActive
                        ? "bg-primary text-white shadow-sm"
                        : isCompleted
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-white/10 dark:hover:bg-slate-700"
                        }`}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isActive
                          ? "bg-white/20 text-white"
                          : isCompleted
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                      >
                        {isCompleted ? <Check className="h-3 w-3" /> : step.id}
                      </span>
                      <span>{step.title}</span>
                    </button>
                    {idx < QUOTATION_FORM_STEPS.length - 1 && (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 hidden sm:block" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Step {currentStep} of {QUOTATION_FORM_STEPS.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {isCopyMode && quotation && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-200 flex items-center gap-2.5">
                <Copy className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span>
                  Creating a new quotation copied from <strong>#{quotation.quotation_no || quotation.ref_no}</strong>. Line items, addresses, and terms &amp; conditions have been pre-filled.
                </span>
              </div>
            )}

            {!canManageQuotations(authUser) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Only administrators (Admin, Super Admin, and Finance) are authorized to create or update quotations.</span>
              </div>
            )}

            {isEditing && syncedLeadSections.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-center gap-2.5">
                <RefreshCw className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  <strong>Synced latest changes from parent Lead:</strong> {syncedLeadSections.join(", ")}. Review and save to create the updated quotation version.
                </span>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                {/* Lead Link / Direct Selection Banner */}
                {!isEditing && !lead && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-3.5">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <label className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 shrink-0 ${getLabelClass(getFieldStatus(selectedLeadId, "selectedLeadId"))}`}>
                        <Building2 className="h-4 w-4" />
                        Quotation Type &amp; Lead Link Source
                      </label>
                      <div className="flex flex-1 sm:justify-end items-center gap-3">
                        <select
                          value={selectedLeadId}
                          onChange={(e) => handleLeadSelect(e.target.value)}
                          onFocus={() => setActiveField("selectedLeadId")}
                          onBlur={() => setActiveField(null)}
                          className={`flex-1 max-w-md ${getInputClass(getFieldStatus(selectedLeadId, "selectedLeadId"))} cursor-pointer font-semibold`}
                        >
                          <option value="">-- Direct Quotation (Standalone Proposal) --</option>
                          {leadsList.map((l) => (
                            <option key={l._id} value={l._id}>
                              Link to Lead: {l.company_name || l.name || "Lead"} ({l.organization_name || l.lead_no || "Active"})
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium shrink-0">
                          {selectedLeadId ? "✓ Linked to Lead" : "• Standalone Proposal"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2-Column Side-by-Side: Left = Proposal & Entity, Right = Customer */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  {/* Left Column: Proposal & Letterhead Entity */}
                  <div className="space-y-4">
                    {/* Company Branch & Letterhead Profile */}
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-900">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-slate-100 pb-2 dark:border-white/10">
                        <div className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>Letterhead &amp; Billing Branch</span>
                        </div>
                        {selectedBranch && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {selectedBranch.is_head_office ? "Head Office" : "Branch Office"} • Code: {selectedBranch.branch_code}
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(selectedBranchId, "selectedBranchId"))}`}>
                              Opt Company Branch <span className="text-rose-500">*</span>
                            </label>
                            {renderFieldStatusBadge(getFieldStatus(selectedBranchId, "selectedBranchId"), true)}
                          </div>
                          <div className="relative">
                            <select
                              value={selectedBranchId}
                              onChange={(e) => handleBranchSelect(e.target.value)}
                              onFocus={() => setActiveField("selectedBranchId")}
                              onBlur={() => setActiveField(null)}
                              className={`w-full appearance-none pr-8 font-bold cursor-pointer ${getInputClass(getFieldStatus(selectedBranchId, "selectedBranchId"))}`}
                            >
                              <option value="">-- Select Company Branch --</option>
                              {branches.map((b) => (
                                <option key={b._id} value={b._id}>
                                  {b.branch_name} ({b.address?.city || b.branch_code}){b.is_head_office ? " [HQ]" : ""}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                          </div>
                          <p className="text-xs text-slate-400">
                            Autofills letterhead address, phone, email, GSTIN, and company banking coordinates.
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50/90 p-3 border border-slate-200/80 dark:bg-slate-800/60 dark:border-white/10 text-xs space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>{companyName || "No Branch Selected"}</span>
                            </div>
                            {companyGstin && (
                              <span className="font-mono text-xs font-bold text-slate-600 bg-white dark:bg-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10">
                                GSTIN: {companyGstin}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-600 dark:text-slate-300">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">Address: </span>
                            <span>{companyRegdAddress || "Not configured"}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs pt-1.5 border-t border-slate-200/60 dark:border-white/10">
                            <span><strong>Bank:</strong> {bankName || "N/A"}</span>
                            <span><strong>A/c No:</strong> <span className="font-mono text-blue-600 dark:text-blue-400">{accountNumber || "N/A"}</span></span>
                            <span><strong>IFSC:</strong> <span className="font-mono text-blue-600 dark:text-blue-400">{ifscCode || "N/A"}</span></span>
                            {bankBranchName && <span><strong>Branch:</strong> {bankBranchName}</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Proposal & Reference Details */}
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-900 space-y-3">
                      <div className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-white/10">
                        <Building2 className="h-4 w-4 text-primary" />
                        Proposal &amp; Reference Details
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(refNo, "refNo"))}`}>
                              Ref. No.
                            </label>
                            <div className="flex items-center gap-2">
                              {renderFieldStatusBadge(getFieldStatus(refNo, "refNo"), false)}
                              {!isEditing && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    refetchQuotations();
                                    setRefNo(autoNextRefNo);
                                    toast.info(`Next sequential reference number: ${autoNextRefNo}`);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                                  title="Recalculate next sequential reference number"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  Auto Pick
                                </button>
                              )}
                            </div>
                          </div>
                          <input
                            type="text"
                            value={refNo}
                            onChange={(e) => setRefNo(e.target.value)}
                            onFocus={() => setActiveField("refNo")}
                            onBlur={() => setActiveField(null)}
                            placeholder="e.g. Q-1001"
                            className={`${getInputClass(getFieldStatus(refNo, "refNo"))} font-mono font-bold text-primary`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(quotationDate, "quotationDate"))}`}>
                              Quotation Date
                            </label>
                            {renderFieldStatusBadge(getFieldStatus(quotationDate, "quotationDate"), false)}
                          </div>
                          <input
                            type="date"
                            value={quotationDate}
                            onChange={(e) => setQuotationDate(e.target.value)}
                            onFocus={() => setActiveField("quotationDate")}
                            onBlur={() => setActiveField(null)}
                            className={getInputClass(getFieldStatus(quotationDate, "quotationDate"))}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(validityDays, "validityDays"))}`}>
                              Validity (Days)
                            </label>
                            {renderFieldStatusBadge(getFieldStatus(validityDays, "validityDays"), false)}
                          </div>
                          <input
                            type="number"
                            min="1"
                            max="180"
                            value={validityDays}
                            onChange={(e) => setValidityDays(e.target.value === "" ? "" : Number(e.target.value))}
                            onFocus={() => setActiveField("validityDays")}
                            onBlur={() => setActiveField(null)}
                            placeholder="e.g. 15"
                            className={`${getInputClass(getFieldStatus(validityDays, "validityDays"))} font-bold`}
                          />
                          <p className="mt-0.5 text-xs text-slate-400">Defaults to 15 days validity</p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(validityEndDate, "validityEndDate"))} flex items-center justify-between w-full`}>
                              <span>Validity Date</span>
                              <span className="text-xs text-blue-600 font-bold dark:text-blue-400">Valid Until</span>
                            </label>
                          </div>
                          <input
                            type="date"
                            value={validityEndDate}
                            onChange={(e) => handleValidityEndDateChange(e.target.value)}
                            onFocus={() => setActiveField("validityEndDate")}
                            onBlur={() => setActiveField(null)}
                            className={`${getInputClass(getFieldStatus(validityEndDate, "validityEndDate"))} font-semibold`}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(subject, "subject"))}`}>
                              Subject / Title
                            </label>
                            {renderFieldStatusBadge(getFieldStatus(subject, "subject"), false)}
                          </div>
                          <input
                            type="text"
                            value={subject}
                            onChange={(e) => handleSubjectChange(e.target.value)}
                            onFocus={() => setActiveField("subject")}
                            onBlur={() => setActiveField(null)}
                            placeholder="e.g. Offer For Medical Equipment"
                            className={`${getInputClass(getFieldStatus(subject, "subject"))} font-semibold`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Customer Details */}
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-900 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-white/10">
                        <div className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-blue-600" />
                          <span>Customer / Recipient Information</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {(selectedPartyId ||
                            (resolvedLead?.party_id &&
                              typeof resolvedLead.party_id === "object" &&
                              (resolvedLead.party_id as any)._id) ||
                            (typeof resolvedLead?.party_id === "string" && resolvedLead.party_id)) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const pId =
                                    selectedPartyId ||
                                    (typeof resolvedLead?.party_id === "object" && resolvedLead?.party_id !== null
                                      ? String((resolvedLead.party_id as any)._id || "")
                                      : typeof resolvedLead?.party_id === "string"
                                        ? resolvedLead.party_id
                                        : "");
                                  if (pId) setEditingPartyId(pId);
                                }}
                                title="Update Party in Master"
                                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300 cursor-pointer"
                              >
                                <Pencil className="h-3 w-3" />
                                Update Party
                              </button>
                            )}
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            <Building2 className="h-3 w-3" />
                            Auto-fetched from Lead
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(customerName, "customerName"))}`}>
                              Customer Name / M/s. <span className="text-rose-500">*</span>
                            </label>
                            {renderFieldStatusBadge(getFieldStatus(customerName, "customerName"), true)}
                          </div>
                          <input
                            type="text"
                            required
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            onFocus={() => setActiveField("customerName")}
                            onBlur={() => setActiveField(null)}
                            placeholder="e.g. M/s. Apex Super Specialty Hospital"
                            className={`${getInputClass(getFieldStatus(customerName, "customerName"))} font-bold`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(customerRef, "customerRef"))}`}>
                              Customer Ref <span className="text-xs text-slate-400 font-normal">(Enquiry / PO Ref)</span>
                            </label>
                            <div className="flex items-center gap-2">
                              {renderFieldStatusBadge(getFieldStatus(customerRef, "customerRef"), false)}
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs select-none">
                                <input
                                  type="checkbox"
                                  checked={showCustomerRef}
                                  onChange={(e) => setShowCustomerRef(e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 dark:border-white/20 dark:bg-slate-800"
                                />
                                <span className={showCustomerRef ? "text-slate-500 dark:text-slate-400" : "text-amber-600 dark:text-amber-400 font-medium"}>
                                  {showCustomerRef ? "Show in PDF" : "Hidden in PDF"}
                                </span>
                              </label>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={customerRef}
                            onChange={(e) => setCustomerRef(e.target.value)}
                            onFocus={() => setActiveField("customerRef")}
                            onBlur={() => setActiveField(null)}
                            placeholder="e.g. PO-9876 / ENQ-123"
                            className={`${getInputClass(getFieldStatus(customerRef, "customerRef"))} font-mono font-bold ${!showCustomerRef ? "border-dashed border-amber-300/80 bg-amber-50/20 dark:border-amber-500/30 dark:bg-amber-950/10" : ""}`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(kindAttn, "kindAttn"))}`}>
                              Kind Attn (Contact Person)
                            </label>
                            <div className="flex items-center gap-2">
                              {renderFieldStatusBadge(getFieldStatus(kindAttn, "kindAttn"), false)}
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs select-none">
                                <input
                                  type="checkbox"
                                  checked={showKindAttn}
                                  onChange={(e) => setShowKindAttn(e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 dark:border-white/20 dark:bg-slate-800"
                                />
                                <span className={showKindAttn ? "text-slate-500 dark:text-slate-400" : "text-amber-600 dark:text-amber-400 font-medium"}>
                                  {showKindAttn ? "Show in PDF" : "Hidden in PDF"}
                                </span>
                              </label>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={kindAttn}
                            onChange={(e) => setKindAttn(e.target.value)}
                            onFocus={() => setActiveField("kindAttn")}
                            onBlur={() => setActiveField(null)}
                            placeholder="e.g. Dr. Rajesh Sharma"
                            className={`${getInputClass(getFieldStatus(kindAttn, "kindAttn"))} ${!showKindAttn ? "border-dashed border-amber-300/80 bg-amber-50/20 dark:border-amber-500/30 dark:bg-amber-950/10" : ""}`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(cell, "cell"))}`}>
                              Mobile / Cell
                            </label>
                            <div className="flex items-center gap-2">
                              {renderFieldStatusBadge(getFieldStatus(cell, "cell"), false)}
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs select-none">
                                <input
                                  type="checkbox"
                                  checked={showCell}
                                  onChange={(e) => setShowCell(e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 dark:border-white/20 dark:bg-slate-800"
                                />
                                <span className={showCell ? "text-slate-500 dark:text-slate-400" : "text-amber-600 dark:text-amber-400 font-medium"}>
                                  {showCell ? "Show in PDF" : "Hidden in PDF"}
                                </span>
                              </label>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={cell}
                            onChange={(e) => setCell(e.target.value)}
                            onFocus={() => setActiveField("cell")}
                            onBlur={() => setActiveField(null)}
                            placeholder="Mobile Number"
                            className={`${getInputClass(getFieldStatus(cell, "cell"))} ${!showCell ? "border-dashed border-amber-300/80 bg-amber-50/20 dark:border-amber-500/30 dark:bg-amber-950/10" : ""}`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(phone, "phone"))}`}>
                              Phone / Tel.
                            </label>
                            <div className="flex items-center gap-2">
                              {renderFieldStatusBadge(getFieldStatus(phone, "phone"), false)}
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs select-none">
                                <input
                                  type="checkbox"
                                  checked={showPhone}
                                  onChange={(e) => setShowPhone(e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 dark:border-white/20 dark:bg-slate-800"
                                />
                                <span className={showPhone ? "text-slate-500 dark:text-slate-400" : "text-amber-600 dark:text-amber-400 font-medium"}>
                                  {showPhone ? "Show in PDF" : "Hidden in PDF"}
                                </span>
                              </label>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            onFocus={() => setActiveField("phone")}
                            onBlur={() => setActiveField(null)}
                            placeholder="Office Landline / Phone"
                            className={`${getInputClass(getFieldStatus(phone, "phone"))} ${!showPhone ? "border-dashed border-amber-300/80 bg-amber-50/20 dark:border-amber-500/30 dark:bg-amber-950/10" : ""}`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(email, "email"))}`}>
                              Email Address
                            </label>
                            <div className="flex items-center gap-2">
                              {renderFieldStatusBadge(getFieldStatus(email, "email"), false)}
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs select-none">
                                <input
                                  type="checkbox"
                                  checked={showEmail}
                                  onChange={(e) => setShowEmail(e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 dark:border-white/20 dark:bg-slate-800"
                                />
                                <span className={showEmail ? "text-slate-500 dark:text-slate-400" : "text-amber-600 dark:text-amber-400 font-medium"}>
                                  {showEmail ? "Show in PDF" : "Hidden in PDF"}
                                </span>
                              </label>
                            </div>
                          </div>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onFocus={() => setActiveField("email")}
                            onBlur={() => setActiveField(null)}
                            placeholder="customer@email.com"
                            className={`${getInputClass(getFieldStatus(email, "email"))} ${!showEmail ? "border-dashed border-amber-300/80 bg-amber-50/20 dark:border-amber-500/30 dark:bg-amber-950/10" : ""}`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(gstin, "gstin"))}`}>
                              GSTIN
                            </label>
                            <div className="flex items-center gap-2">
                              {renderFieldStatusBadge(getFieldStatus(gstin, "gstin"), false)}
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs select-none">
                                <input
                                  type="checkbox"
                                  checked={showGstin}
                                  onChange={(e) => setShowGstin(e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 dark:border-white/20 dark:bg-slate-800"
                                />
                                <span className={showGstin ? "text-slate-500 dark:text-slate-400" : "text-amber-600 dark:text-amber-400 font-medium"}>
                                  {showGstin ? "Show in PDF" : "Hidden in PDF"}
                                </span>
                              </label>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={gstin}
                            onChange={(e) => setGstin(e.target.value.toUpperCase())}
                            onFocus={() => setActiveField("gstin")}
                            onBlur={() => setActiveField(null)}
                            placeholder="e.g. 03ABCDE1234F1Z5"
                            className={`${getInputClass(getFieldStatus(gstin, "gstin"))} font-mono uppercase ${!showGstin ? "border-dashed border-amber-300/80 bg-amber-50/20 dark:border-amber-500/30 dark:bg-amber-950/10" : ""}`}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-sm ${getLabelClass(getFieldStatus(addressLine, "addressLine"))}`}>
                              Street Address
                            </label>
                            {renderFieldStatusBadge(getFieldStatus(addressLine, "addressLine"), false)}
                          </div>
                          <input
                            type="text"
                            value={addressLine}
                            onChange={(e) => setAddressLine(e.target.value)}
                            onFocus={() => setActiveField("addressLine")}
                            onBlur={() => setActiveField(null)}
                            placeholder="Building / Street Address"
                            className={getInputClass(getFieldStatus(addressLine, "addressLine"))}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className={`block text-sm ${getLabelClass(getFieldStatus(city, "city"))}`}>
                                City
                              </label>
                            </div>
                            <input
                              type="text"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              onFocus={() => setActiveField("city")}
                              onBlur={() => setActiveField(null)}
                              placeholder="City"
                              className={getInputClass(getFieldStatus(city, "city"))}
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className={`block text-sm ${getLabelClass(getFieldStatus(state, "state"))}`}>
                                State
                              </label>
                            </div>
                            <input
                              type="text"
                              value={state}
                              onChange={(e) => setState(e.target.value)}
                              onFocus={() => setActiveField("state")}
                              onBlur={() => setActiveField(null)}
                              placeholder="State"
                              className={getInputClass(getFieldStatus(state, "state"))}
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className={`block text-sm ${getLabelClass(getFieldStatus(pincode, "pincode"))}`}>
                                Pincode
                              </label>
                            </div>
                            <input
                              type="text"
                              value={pincode}
                              onChange={(e) => setPincode(e.target.value)}
                              onFocus={() => setActiveField("pincode")}
                              onBlur={() => setActiveField(null)}
                              placeholder="Pincode"
                              className={getInputClass(getFieldStatus(pincode, "pincode"))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left Column: Line Items (Wide) */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                  {/* Line Items Table */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-900 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/10">
                      <div className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 flex items-center gap-1.5">
                        <Calculator className="h-4 w-4 text-blue-600" />
                        <span>Line Items &amp; Products ({items.length})</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <input
                            type="checkbox"
                            checked={showMrp}
                            onChange={(e) => setShowMrp(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span>Show MRP</span>
                          {showMrp && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                              On
                            </span>
                          )}
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <input
                            type="checkbox"
                            checked={gstEnabled}
                            onChange={(e) => setGstEnabled(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span>Calculate GST</span>
                          {!gstEnabled && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                              Exempt / Off
                            </span>
                          )}
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setItems((prev) => [
                              ...prev,
                              {
                                product_name: "",
                                description: "",
                                hsn_code: "",
                                quantity: 1,
                                unit: "Nos",
                                rate: 0,
                                discount_percent: 0,
                                discount_amount: 0,
                                gst_enabled: true,
                                gst_rate: 18,
                              },
                            ])
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-bold text-white shadow-2xs hover:bg-primary-hover transition cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Item</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {items.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-slate-800/40 dark:text-slate-400 space-y-2.5">
                          <p>
                            No line items yet. Click <strong>Add Item</strong> to add products or{" "}
                            <strong>Sync from Lead</strong> to pull from the parent Lead.
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setItems([
                                {
                                  product_name: "",
                                  description: "",
                                  hsn_code: "",
                                  quantity: 1,
                                  unit: "Nos",
                                  rate: 0,
                                  discount_percent: 0,
                                  discount_amount: 0,
                                  gst_enabled: true,
                                  gst_rate: 18,
                                },
                              ])
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add Line Item</span>
                          </button>
                        </div>
                      )}
                      {items.map((it, idx) => {
                        const comp = calculations.items[idx];
                        const linkedProductId =
                          it.product ||
                          productMasterList.find(
                            (p) =>
                              getFieldText(p.product_name).trim().toLowerCase() ===
                              it.product_name.trim().toLowerCase()
                          )?._id ||
                          "";
                        const masterFields = resolveProductMasterFields(linkedProductId, it.product_name);
                        const resolvedMrp = it.mrp != null && it.mrp > 0 ? it.mrp : masterFields.mrp;
                        return (
                          <div
                            key={idx}
                            className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-white/10 dark:bg-slate-800/40"
                          >
                            <div className="grid grid-cols-12 gap-2 items-end">
                              {/* Sr & Product Selector */}
                              <div className={`col-span-12 ${showMrp ? "sm:col-span-3" : "sm:col-span-4"}`}>
                                <div className="flex items-center justify-between gap-1.5 mb-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                                      {idx + 1}
                                    </span>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                      Product Description <span className="text-rose-500">*</span>
                                    </label>
                                    {showMrp && resolvedMrp != null && resolvedMrp > 0 && (
                                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                        MRP: ₹{formatCurrencyINR(resolvedMrp)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {linkedProductId && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingProductId(linkedProductId);
                                          setEditingProductRowIdx(idx);
                                        }}
                                        title="Update Product in Master"
                                        className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300 cursor-pointer"
                                      >
                                        <Pencil className="h-2.5 w-2.5" />
                                        Update Product
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setItems((prev) => prev.filter((_, i) => i !== idx))
                                      }
                                      title="Remove line item"
                                      className="inline-flex items-center gap-0.5 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer"
                                    >
                                      <Trash2 className="h-2.5 w-2.5" />
                                      Remove
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <ProductRowAutocomplete
                                    products={productMasterList}
                                    selectedId={linkedProductId}
                                    onSelect={(prodId) => {
                                      const found = productMasterList.find((p) => String(p._id) === String(prodId));
                                      if (!found) return;
                                      const nextName = getFieldText(found.product_name) || "Item / Product";
                                      const nextSku = getFieldText(found.sku);
                                      const nextDesc = getFieldText(found.description);
                                      const nextUnit = getFieldText(found.unit) || "Nos";
                                      const nextRate = Number(found.base_price) || 0;
                                      const nextGst = Number(found.gst_percent ?? found.default_gst_rate ?? 18);
                                      setItems((prev) =>
                                        prev.map((x, i) =>
                                          i === idx
                                            ? {
                                                ...x,
                                                product: String(found._id),
                                                product_name: nextName,
                                                hsn_code: nextSku || x.hsn_code,
                                                description: nextDesc || x.description,
                                                unit: nextUnit,
                                                mrp: found.mrp != null ? Number(found.mrp) : undefined,
                                                rate: nextRate || x.rate,
                                                gst_rate: Number.isFinite(nextGst) ? nextGst : x.gst_rate,
                                              }
                                            : x
                                        )
                                      );
                                    }}
                                  />
                                  <input
                                    type="text"
                                    required
                                    value={it.product_name}
                                    onChange={(e) =>
                                      setItems((prev) =>
                                        prev.map((x, i) => (i === idx ? { ...x, product_name: e.target.value } : x))
                                      )
                                    }
                                    placeholder="Enter item name..."
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
                                  />
                                </div>
                              </div>

                              {/* HSN */}
                              <div className="col-span-4 sm:col-span-1">
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                  HSN/SAC
                                </label>
                                <input
                                  type="text"
                                  value={it.hsn_code}
                                  onChange={(e) =>
                                    setItems((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, hsn_code: e.target.value } : x))
                                    )
                                  }
                                  placeholder="SKU / HSN"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white font-mono"
                                />
                              </div>

                              {/* QTY & Unit */}
                              <div className="col-span-4 sm:col-span-2">
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                  Qty &amp; Unit
                                </label>
                                <div className="flex gap-1">
                                  <input
                                    type="number"
                                    step="any"
                                    title="Negative qty = return / replacement credit"
                                    value={Number.isFinite(Number(it.quantity)) ? it.quantity : ""}
                                    onChange={(e) => {
                                      const v = parseQuotationLineQuantity(e.target.value);
                                      setItems((prev) =>
                                        prev.map((x, i) => (i === idx ? { ...x, quantity: v } : x))
                                      );
                                    }}
                                    className={`w-14 rounded-lg border px-2 py-2 text-sm font-bold ${!isValidQuotationLineQuantity(it.quantity)
                                      ? "border-rose-400 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                                      : Number(it.quantity) < 0
                                        ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                                        : "border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                                      }`}
                                  />
                                  <input
                                    type="text"
                                    value={it.unit}
                                    onChange={(e) =>
                                      setItems((prev) =>
                                        prev.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x))
                                      )
                                    }
                                    placeholder="Nos"
                                    className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                                  />
                                </div>
                                {Number(it.quantity) < 0 && (
                                  <p className="mt-0.5 text-[9.5px] font-semibold text-amber-700 dark:text-amber-300">
                                    Return / credit item
                                  </p>
                                )}
                              </div>

                              {/* MRP (shown when Show MRP is toggled) */}
                              {showMrp && (
                                <div className="col-span-4 sm:col-span-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                      MRP (₹)
                                    </label>
                                    {masterFields.mrp != null && masterFields.mrp > 0 && (
                                      <span
                                        className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400"
                                        title="Fetched from Product Master"
                                      >
                                        Master
                                      </span>
                                    )}
                                  </div>
                                  <input
                                    type="number"
                                    step="any"
                                    value={it.mrp != null && it.mrp > 0 ? it.mrp : (masterFields.mrp || "")}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? 0 : Number(e.target.value);
                                      setItems((prev) =>
                                        prev.map((x, i) => (i === idx ? { ...x, mrp: val } : x))
                                      );
                                    }}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-indigo-200 bg-indigo-50/40 px-2.5 py-2 text-sm font-bold text-indigo-950 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-200 font-mono"
                                  />
                                </div>
                              )}

                              {/* Rate */}
                              <div className="col-span-4 sm:col-span-2">
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                  Rate (₹)
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  value={it.rate}
                                  onChange={(e) =>
                                    setItems((prev) =>
                                      prev.map((x, i) =>
                                        i === idx ? { ...x, rate: Math.max(0, Number(e.target.value) || 0) } : x
                                      )
                                    )
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-bold text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white font-mono"
                                  placeholder="0.00"
                                />
                              </div>

                              {/* Disc % */}
                              <div className="col-span-4 sm:col-span-1">
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                  Disc %
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={it.discount_percent ?? 0}
                                  onChange={(e) => {
                                    const p = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                                    const amt = computeQuotationLineAmounts({
                                      ...it,
                                      discount_percent: p,
                                      discount_amount: 0,
                                    }).discAmt;
                                    setItems((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, discount_percent: p, discount_amount: amt } : x))
                                    );
                                  }}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                                  placeholder="0"
                                />
                              </div>

                              {/* GST % with Inline Toggle */}
                              <div className="col-span-3 sm:col-span-1">
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    GST %
                                  </label>
                                  <label
                                    className={`inline-flex items-center gap-1 select-none ${!gstEnabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                      }`}
                                    title={
                                      !gstEnabled
                                        ? "GST is disabled at quotation level"
                                        : it.gst_enabled === false
                                          ? "GST disabled for this item (click to enable)"
                                          : "GST enabled for this item (click to disable)"
                                    }
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={!gstEnabled}
                                      checked={gstEnabled && it.gst_enabled !== false}
                                      onChange={(e) => {
                                        setItems((prev) =>
                                          prev.map((x, i) =>
                                            i === idx ? { ...x, gst_enabled: e.target.checked } : x
                                          )
                                        );
                                      }}
                                      className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                                    />
                                    <span
                                      className={`text-[9px] font-bold ${!gstEnabled || it.gst_enabled === false
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-emerald-600 dark:text-emerald-400"
                                        }`}
                                    >
                                      {!gstEnabled || it.gst_enabled === false ? "Off" : "On"}
                                    </span>
                                  </label>
                                </div>
                                <select
                                  disabled={!gstEnabled || it.gst_enabled === false}
                                  value={gstEnabled && it.gst_enabled !== false ? it.gst_rate : 0}
                                  onChange={(e) =>
                                    setItems((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, gst_rate: Number(e.target.value) } : x))
                                    )
                                  }
                                  className={`w-full rounded-lg border bg-white px-2 py-2 text-sm font-semibold text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white ${!gstEnabled || it.gst_enabled === false
                                    ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400"
                                    : "border-slate-200"
                                    }`}
                                  title={
                                    !gstEnabled
                                      ? "GST calculation is currently disabled for this quotation"
                                      : it.gst_enabled === false
                                        ? "GST is disabled for this line item"
                                        : undefined
                                  }
                                >
                                  <option value={0}>0%</option>
                                  <option value={5}>5%</option>
                                  <option value={12}>12%</option>
                                  <option value={18}>18%</option>
                                  <option value={28}>28%</option>
                                </select>
                              </div>

                              {/* Line Total */}
                              <div className="col-span-5 sm:col-span-1 text-right">
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                  Amount
                                </label>
                                <div className="text-xs font-bold text-slate-900 dark:text-white py-1.5 font-mono">
                                  {formatCurrencyINR(comp?.lineTotal || 0)}
                                </div>
                              </div>
                            </div>

                            {/* Line breakdown */}
                            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-2 text-xs text-slate-600 dark:border-white/5 dark:text-slate-400">
                              <div className="flex-1 min-w-[220px] flex items-center gap-2">
                                <input
                                  type="text"
                                  value={it.description}
                                  onChange={(e) =>
                                    setItems((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x))
                                    )
                                  }
                                  placeholder="Technical specifications / extra notes..."
                                  className="flex-1 bg-transparent border-0 border-b border-dashed border-slate-300 py-0.5 text-xs focus:border-primary focus:outline-none dark:border-slate-700"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRichDescModalItemIdx(idx);
                                    setRichDescModalText(it.description || "");
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md bg-blue-50/80 px-2 py-0.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 transition cursor-pointer border border-blue-200/50 dark:border-blue-800/40 shrink-0"
                                  title="Open rich text editor for detailed specifications"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  {/<[a-z][\s\S]*>/i.test(it.description || "") ? "Rich Specs" : "Rich Editor"}
                                </button>
                              </div>
                              <div className="flex flex-wrap items-center gap-3">
                                {showMrp && (resolvedMrp || 0) > 0 && (
                                  <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                    MRP: {formatCurrencyINR(resolvedMrp || 0)}
                                  </span>
                                )}
                                <span>
                                  Gross: <strong>{formatCurrencyINR(comp?.gross || 0)}</strong>
                                </span>
                                {(comp?.discAmt || 0) > 0 ? (
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                    Disc: -{formatCurrencyINR(comp?.discAmt || 0)} ({comp?.discPercent}%)
                                  </span>
                                ) : null}
                                <span>
                                  Taxable: <strong>{formatCurrencyINR(comp?.taxable || 0)}</strong>
                                </span>
                                <span>
                                  GST: <strong>{!gstEnabled || it.gst_enabled === false || !comp?.gstAmt ? "—" : formatCurrencyINR(comp?.gstAmt || 0)}</strong>
                                  {(!gstEnabled || it.gst_enabled === false) && (
                                    <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold ml-1">
                                      (Exempt)
                                    </span>
                                  )}
                                </span>
                                <span className="text-blue-700 dark:text-blue-400 font-bold">
                                  Total: {formatCurrencyINR(comp?.lineTotal || 0)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Pricing & Cover Note (Sticky on desktop) */}
                <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-0 space-y-4">
                  {/* Financial Totals Summary Box */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-2xs dark:border-blue-900/40 dark:bg-blue-950/20 space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-200/60 pb-2 dark:border-blue-900/40">
                      <div className="text-sm font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                        <Calculator className="h-4 w-4 text-blue-600" />
                        Pricing &amp; Grand Total
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                        {items.length} {items.length === 1 ? "Item" : "Items"}
                      </span>
                    </div>

                    {/* Prominent Grand Total Display */}
                    <div className="rounded-xl bg-white/90 p-3.5 border border-blue-200 shadow-2xs dark:bg-slate-900/90 dark:border-blue-900/40 space-y-1">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Grand Total (INR)
                      </div>
                      <div className="text-3xl font-black text-blue-900 dark:text-blue-200 font-mono">
                        {formatCurrencyINR(calculations.grandTotal)}
                      </div>
                      {calculations.grandTotal > 0 && (
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 capitalize italic leading-tight pt-0.5">
                          ₹ {numberToIndianWords(calculations.grandTotal)}
                        </div>
                      )}
                    </div>

                    {/* Breakdown */}
                    <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 border-t border-blue-200/60 pt-2.5 dark:border-blue-900/40">
                      {calculations.totalDiscount > 0 ? (
                        <>
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span>Gross Total:</span>
                            <strong>{formatCurrencyINR(calculations.totalGross)}</strong>
                          </div>
                          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 font-semibold">
                            <span>Total Discount:</span>
                            <strong>-{formatCurrencyINR(calculations.totalDiscount)}</strong>
                          </div>
                        </>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <span>Taxable Sub Total:</span>
                        <strong>{formatCurrencyINR(calculations.subtotal)}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Total GST Amount:</span>
                        <span className="font-bold">
                          {formatCurrencyINR(calculations.totalGst)}
                          {!gstEnabled && <span className="text-xs text-amber-600 ml-1 font-semibold">(Exempt / Off)</span>}
                        </span>
                      </div>
                      {calculations.roundOff !== 0 ? (
                        <div className="flex items-center justify-between">
                          <span>Round Off:</span>
                          <strong>{formatCurrencyINR(calculations.roundOff)}</strong>
                        </div>
                      ) : null}
                    </div>

                    <div className="text-xs text-slate-400 dark:text-slate-500 pt-1.5 border-t border-blue-200/40 dark:border-blue-900/30">
                      Gross Total - Total Discount = Taxable Subtotal + Applicable GST
                    </div>
                  </div>

                  {/* Cover / Introductory Message (Above Requirements) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-900 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-white/10">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                          Introductory Note (Cover)
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        {isMessageCustomizedRef.current && (
                          <button
                            type="button"
                            onClick={() => {
                              isMessageCustomizedRef.current = false;
                              userClearedMessageRef.current = false;
                              setMessage(buildDefaultIntroductoryNote(subject));
                              toast.info("Introductory note synced with subject");
                            }}
                            className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                            title="Regenerate default note from current Subject"
                          >
                            Sync with Subject
                          </button>
                        )}
                        {message ? (
                          <button
                            type="button"
                            onClick={() => {
                              userClearedMessageRef.current = true;
                              isMessageCustomizedRef.current = true;
                              setMessage("");
                            }}
                            className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                          >
                            Clear Message
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              userClearedMessageRef.current = false;
                              isMessageCustomizedRef.current = false;
                              setMessage(buildDefaultIntroductoryNote(subject));
                            }}
                            className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                          >
                            + Add Default Note
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Default cover note displayed directly above requirements &amp; pricing on official letterhead (dynamically reflects Subject/Title).
                    </p>
                    <RichTextEditor
                      value={message}
                      onChange={(val) => {
                        setMessage(val);
                        if (!isDefaultIntroductoryNote(val)) {
                          isMessageCustomizedRef.current = true;
                        }
                      }}
                      placeholder="Write your introductory message or cover note here (e.g. 'Dear Sir, We thank you for your valued enquiry...')..."
                      minHeight="85px"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {/* Left Column: Team (Sales Reps + Departments) */}
                <div className="space-y-4">
                  {/* Sales Representative Section */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-900 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/10">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                          <UserCheck className="h-4 w-4 text-emerald-600" />
                          Sales Representatives (Internal)
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Auto-fetched from parent lead assignees.
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Auto-fetched from Lead
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Sales Person Name
                          </label>
                          <span className="text-xs text-slate-400 font-medium">Read-only</span>
                        </div>
                        <input
                          type="text"
                          readOnly
                          value={salesPersonName}
                          placeholder="Sales person..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-sm text-slate-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 font-bold"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className={`block text-sm ${getLabelClass(getFieldStatus(salesPersonDesignation, "salesPersonDesignation"))}`}>
                            Sales Role / Designation
                          </label>
                          {renderFieldStatusBadge(getFieldStatus(salesPersonDesignation, "salesPersonDesignation"), false)}
                        </div>
                        <input
                          type="text"
                          value={salesPersonDesignation}
                          onChange={(e) => setSalesPersonDesignation(e.target.value)}
                          onFocus={() => setActiveField("salesPersonDesignation")}
                          onBlur={() => setActiveField(null)}
                          placeholder="e.g. Sales Executive"
                          className={getInputClass(getFieldStatus(salesPersonDesignation, "salesPersonDesignation"))}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Phone / Mobile
                          </label>
                          <span className="text-xs text-slate-400 font-medium">Read-only</span>
                        </div>
                        <input
                          type="text"
                          readOnly
                          value={salesPersonPhone}
                          placeholder="Auto-filled from profile"
                          className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-sm text-slate-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 font-medium"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Email
                          </label>
                          <span className="text-xs text-slate-400 font-medium">Read-only</span>
                        </div>
                        <input
                          type="email"
                          readOnly
                          value={salesPersonEmail}
                          placeholder="Auto-filled from profile"
                          className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-sm text-slate-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 font-medium"
                        />
                      </div>
                    </div>

                    {/* Secondary Sales Representatives (Multiple) */}
                    <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
                        <span>Secondary Sales Representatives ({secondarySalesPersons.length})</span>
                        <span className="text-xs font-normal text-slate-400">Order Handover / Team</span>
                      </div>
                      {secondarySalesPersons.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {secondarySalesPersons.map((sec) => (
                            <span
                              key={sec.user}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs dark:border-emerald-900/50 dark:bg-slate-800 dark:text-slate-100"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span>{sec.name || sec.email}</span>
                              {sec.designation && (
                                <span className="text-xs font-medium text-slate-400">
                                  • {sec.designation}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs italic text-slate-400">
                          No secondary sales representatives assigned on the parent lead.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Internal Departments Section */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-900 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/10">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                          <Layers className="h-4 w-4 text-purple-600" />
                          Departments (Internal Routing) <span className="text-rose-500">*</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Classify quotation under departments for routing and reports.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedDepartments.length < departmentOptions.length ? (
                          <button
                            type="button"
                            onClick={() => setSelectedDepartments(departmentOptions.map((d) => d.value))}
                            className="text-xs font-medium text-purple-600 hover:underline dark:text-purple-400 cursor-pointer"
                          >
                            Select All
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedDepartments([])}
                            className="text-xs font-medium text-rose-500 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                        {selectedDepartments.length > 0 && (
                          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                            {selectedDepartments.length} selected
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {departmentOptions.map((dept) => {
                        const isSelected = selectedDepartments.includes(dept.value);
                        return (
                          <button
                            key={dept.value}
                            type="button"
                            onClick={() => toggleDepartment(dept.value)}
                            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium transition cursor-pointer text-left ${isSelected
                              ? "border-emerald-500 bg-emerald-50/25 text-emerald-700 font-bold ring-1 ring-emerald-300 shadow-xs dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500 dark:ring-emerald-900"
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/60"
                              }`}
                          >
                            <span className="truncate">{dept.label}</span>
                            {isSelected ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Plus className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-60" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {selectedDepartments.length === 0 && (
                      <p className="text-xs font-medium text-slate-400">
                        Optional: Select departments for internal classification &amp; routing.
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Column: Signatory */}
                <div className="space-y-4">
                  {/* Signatory / Admin Representative Section */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-900 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/10">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                          <ShieldCheck className="h-4 w-4 text-blue-600" />
                          Signatory Representative (Printed on PDF)
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Authorized signatory printed on the official proposal letterhead.
                        </p>
                      </div>
                    </div>

                    {/* Selector for admin/finance/signatory users */}
                    {usersList.length > 0 && (
                      <div className="space-y-1.5 rounded-xl bg-slate-50/70 p-2.5 border border-slate-200 dark:bg-slate-800/40 dark:border-white/10">
                        <div className="flex items-center justify-between">
                          <label className={`text-sm ${getLabelClass(getFieldStatus(signatoryUserId, "signatoryUserId"))}`}>
                            Choose Authorized Signatory: <span className="text-rose-500">*</span>
                          </label>
                          <div className="flex items-center gap-2">
                            {renderFieldStatusBadge(getFieldStatus(signatoryUserId, "signatoryUserId"), true)}
                            {signatoryUserId && (
                              <button
                                type="button"
                                onClick={() => handleSelectAdminUser("")}
                                className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400 cursor-pointer"
                                title="Clear selected signatory"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                        <select
                          value={signatoryUserId}
                          onChange={(e) => handleSelectAdminUser(e.target.value)}
                          onFocus={() => setActiveField("signatoryUserId")}
                          onBlur={() => setActiveField(null)}
                          className={`w-full ${getInputClass(getFieldStatus(signatoryUserId, "signatoryUserId"))} font-bold cursor-pointer`}
                        >
                          <option value="">
                            -- Select Authorized Signatory (Required) --
                          </option>
                          {signatoryUsers.map((u: any) => {
                            const roleBadge = getLeadManagerPortalRole(u);
                            return (
                              <option key={u._id} value={u._id}>
                                {u.name || u.email} {roleBadge ? `(${roleBadge})` : ""} {u.phone ? `• ${u.phone}` : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Signatory Name <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-xs text-slate-400 font-medium">Read-only</span>
                        </div>
                        <input
                          type="text"
                          required
                          readOnly
                          value={signatoryName}
                          placeholder="Choose signatory above..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-sm text-slate-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 font-bold"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className={`block text-sm ${getLabelClass(getFieldStatus(signatoryDesignation, "signatoryDesignation"))}`}>
                            Designation / Title
                          </label>
                          {renderFieldStatusBadge(getFieldStatus(signatoryDesignation, "signatoryDesignation"), false)}
                        </div>
                        <input
                          type="text"
                          value={signatoryDesignation}
                          onChange={(e) => setSignatoryDesignation(e.target.value)}
                          onFocus={() => setActiveField("signatoryDesignation")}
                          onBlur={() => setActiveField(null)}
                          placeholder="e.g. Authorized Signatory / Director"
                          className={getInputClass(getFieldStatus(signatoryDesignation, "signatoryDesignation"))}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Contact Phone / Mobile
                          </label>
                          <span className="text-xs text-slate-400 font-medium">Read-only</span>
                        </div>
                        <input
                          type="text"
                          readOnly
                          value={signatoryPhone}
                          placeholder="Auto-filled from profile"
                          className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-sm text-slate-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 font-medium"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Official Email
                          </label>
                          <span className="text-xs text-slate-400 font-medium">Read-only</span>
                        </div>
                        <input
                          type="email"
                          readOnly
                          value={signatoryEmail}
                          placeholder="Auto-filled from profile"
                          className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-sm text-slate-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 font-medium"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/80 dark:bg-slate-800/60 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">Letterhead Notice: </span>
                      This signatory&apos;s name, designation, and official coordinates will be printed on the bottom right of the quotation PDF letterhead.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left Column: Terms & Conditions (Wide) */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2.5 dark:border-white/10">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                          <FileText className="h-4 w-4 text-blue-600" />
                          General Terms &amp; Conditions ({terms.length} Points)
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Select master sets or edit individual condition lines printed on the PDF letterhead.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {terms.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllTerms}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-white/10 dark:bg-slate-800 dark:text-rose-400 cursor-pointer"
                            title="Clear all terms"
                          >
                            <Trash2 className="h-3 w-3" />
                            Clear All
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleAddTerm}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                          Add Condition
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowTerms((p) => !p)}
                          className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-400 ml-1 cursor-pointer"
                        >
                          {showTerms ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>

                    {showTerms && (
                      <div className="mt-3.5 space-y-4">
                        {/* Master Terms Sets Multi-Selector Panel */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                            <label className="text-sm font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5 text-blue-600" />
                              Select From Master Sets ({masterTermsSets.length} Available)
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleSelectAllFilteredSets}
                                className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                              >
                                Select All
                              </button>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <button
                                type="button"
                                onClick={handleClearAllTerms}
                                className="text-xs font-semibold text-slate-500 hover:underline dark:text-slate-400 cursor-pointer"
                              >
                                Deselect All
                              </button>
                            </div>
                          </div>

                          {/* Filter & Search Controls */}
                          <div className="flex flex-wrap items-center gap-2 mb-2.5">
                            <div className="relative flex-1 min-w-[180px]">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                              <input
                                type="text"
                                value={termsSearch}
                                onChange={(e) => setTermsSearch(e.target.value)}
                                placeholder="Search terms sets or clauses..."
                                className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
                              />
                            </div>
                            <div className="flex items-center gap-1 overflow-x-auto">
                              {(["all", "quotation", "order", "invoice", "general"] as const).map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setTermsTypeFilter(type)}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${termsTypeFilter === type
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "bg-white/80 text-slate-600 hover:bg-white dark:bg-slate-800/80 dark:text-slate-300 border border-slate-200 dark:border-white/10"
                                    }`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          {filteredTermsSets.length === 0 ? (
                            <div className="text-xs text-slate-500 py-3 text-center bg-white/50 rounded-lg dark:bg-slate-900/40">
                              No matching terms sets found. Try adjusting your search or category filter.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                              {filteredTermsSets.map((set) => {
                                const status = getSetSelectionStatus(set);
                                const activeLines = getSetLines(set);
                                const isExpanded = expandedSetIds.includes(set._id);

                                return (
                                  <div
                                    key={set._id}
                                    className={`rounded-lg border transition ${status === "all"
                                      ? "border-blue-500 bg-white dark:bg-slate-900 shadow-2xs"
                                      : status === "partial"
                                        ? "border-blue-300 bg-white/90 dark:bg-slate-900/90"
                                        : "border-slate-200 bg-white/60 hover:bg-white dark:border-white/10 dark:bg-slate-900/50"
                                      }`}
                                  >
                                    <div className="flex items-center justify-between p-2.5 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleTermsSet(set)}
                                        className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer"
                                      >
                                        <div className="shrink-0 text-blue-600 dark:text-blue-400">
                                          {status === "all" ? (
                                            <CheckSquare className="h-4 w-4" />
                                          ) : status === "partial" ? (
                                            <div className="relative">
                                              <Square className="h-4 w-4 text-blue-400" />
                                              <div className="absolute inset-1 bg-blue-500 rounded-xs" />
                                            </div>
                                          ) : (
                                            <Square className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                            {set.title}
                                          </div>
                                          <div className="text-xs text-slate-400 flex items-center gap-1.5">
                                            <span className="capitalize">{set.type || "general"}</span>
                                            <span>•</span>
                                            <span>{activeLines.length} clause(s)</span>
                                            {set.is_default && (
                                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 px-1 rounded">
                                                Default
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleExpandSet(set._id)}
                                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                                        title={isExpanded ? "Collapse clauses" : "Expand clauses"}
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="h-3.5 w-3.5" />
                                        ) : (
                                          <ChevronDown className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </div>

                                    {/* Expanded Individual Clauses */}
                                    {isExpanded && activeLines.length > 0 && (
                                      <div className="border-t border-slate-100 bg-slate-50/50 p-2 space-y-1.5 dark:border-white/5 dark:bg-slate-800/30">
                                        {activeLines.map((clause, cIdx) => {
                                          const selected = terms.some((t) => t.trim() === clause);
                                          return (
                                            <button
                                              key={cIdx}
                                              type="button"
                                              onClick={() => handleToggleClause(clause)}
                                              className="w-full flex items-start gap-2 p-1.5 text-left rounded hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                                            >
                                              <div className="shrink-0 mt-0.5 text-blue-600">
                                                {selected ? (
                                                  <CheckSquare className="h-3 w-3" />
                                                ) : (
                                                  <Square className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                                                )}
                                              </div>
                                              <div className="flex-1 text-xs leading-snug text-slate-800 dark:text-white">
                                                <RichTextDisplay content={clause} className="dark:text-white dark:[&_*]:!text-white" />
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Individual Condition Lines Editor (Printed on official PDF) */}
                        <div className="space-y-2.5">
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>Proposal Condition Clauses ({terms.length} Lines)</span>
                            <span className="text-xs font-normal text-slate-400">
                              These clauses will be printed on the official quotation letterhead.
                            </span>
                          </div>

                          {terms.map((term, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 transition focus-within:border-blue-300 dark:border-white/10 dark:bg-slate-800/40"
                            >
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300 mt-1">
                                {idx + 1}
                              </span>
                              <div className="flex-1 text-slate-900 dark:text-white">
                                <RichTextEditor
                                  value={term}
                                  onChange={(html) => handleTermChange(idx, html)}
                                  placeholder={`Condition Line ${idx + 1}...`}
                                  minHeight="50px"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveTerm(idx)}
                                className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 cursor-pointer mt-1"
                                title="Delete Condition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}

                          {terms.length === 0 && (
                            <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl p-4 dark:border-white/10">
                              No terms and conditions selected. Choose one or multiple master sets above or click &apos;+ Add Condition&apos; to write custom terms.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Submit & Proposal Review (Sticky on desktop) */}
                <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-0 space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2 dark:border-emerald-900/40">
                      <div className="text-sm font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                        <CheckSquare className="h-4 w-4 text-emerald-600" />
                        Quotation Summary &amp; Submit
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                        Step 4 of 4
                      </span>
                    </div>

                    {/* Snapshot Card */}
                    <div className="rounded-xl bg-white/90 p-3 border border-emerald-200 dark:bg-slate-900/90 dark:border-emerald-900/40 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Quotation Ref:</span>
                        <span className="font-mono font-bold text-primary">{refNo || "Auto Assigned"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Date:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{quotationDate}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Customer:</span>
                        <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                          {customerName || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Validity:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {validityDays} Days ({validityEndDate})
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/5">
                        <span className="text-slate-500 dark:text-slate-400">Total Items:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{items.length} Product(s)</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-emerald-100 dark:border-emerald-900/30">
                        <span className="font-bold text-slate-800 dark:text-slate-200">Grand Total:</span>
                        <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                          {formatCurrencyINR(calculations.grandTotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/5 text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Signatory:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                          {signatoryName || <span className="text-rose-500 font-bold">Required</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Terms Clauses:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{terms.length} Points</span>
                      </div>
                    </div>

                    {/* Readiness checklist */}
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        {customerName ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                        )}
                        <span>Customer name: {customerName ? "Ready" : "Missing"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        {items.length > 0 ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                        )}
                        <span>Line items: {items.length > 0 ? `${items.length} items configured` : "No items added"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        {signatoryName ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                        )}
                        <span>Signatory: {signatoryName ? "Selected" : "Missing selection"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        {selectedDepartments.length > 0 ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                        )}
                        <span>Department: {selectedDepartments.length > 0 ? `${selectedDepartments.length} selected` : "Missing"}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40">
                      <button
                        type="button"
                        onClick={() => setShowLivePreviewModal(true)}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Live Letterhead Preview</span>
                      </button>

                      <button
                        type="submit"
                        disabled={isCreating || isUpdating || !canManageQuotations(authUser)}
                        title={!canManageQuotations(authUser) ? "Only authorized representatives can create quotations" : undefined}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isCreating || isUpdating
                          ? "Saving..."
                          : isEditing
                            ? "Update Quotation"
                            : isCopyMode
                              ? "Create Copied Quotation"
                              : "Generate Quotation"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Actions Footer */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-white/10 dark:bg-slate-900">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowLivePreviewModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-sm font-bold text-emerald-700 shadow-2xs transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 cursor-pointer"
                title="View real-time A4 letterhead preview with PREVIEW watermark"
              >
                <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Live Preview</span>
              </button>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </button>
              )}
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s))}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-hover cursor-pointer"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isCreating || isUpdating || !canManageQuotations(authUser)}
                  title={!canManageQuotations(authUser) ? "Only authorized representatives can create quotations" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isCreating || isUpdating
                    ? "Saving..."
                    : isEditing
                      ? "Update Quotation"
                      : isCopyMode
                        ? "Create Copied Quotation"
                        : "Generate Quotation"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Modal: Rich Editor for Line Item Specifications */}
      {richDescModalItemIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-white/10 dark:bg-slate-800/60">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Product Specifications &amp; Scope (Rich Editor)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {items[richDescModalItemIdx]?.product_name || `Line Item #${richDescModalItemIdx + 1}`} • Use bold, bullets, tables, highlights, or links
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRichDescModalItemIdx(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <RichTextEditor
                value={richDescModalText}
                onChange={setRichDescModalText}
                placeholder="Enter detailed technical specifications, dimensions, features, tables, scope of supply, standard compliance..."
                minHeight="240px"
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-3.5 dark:border-white/10 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setRichDescModalItemIdx(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setItems((prev) =>
                    prev.map((x, i) => (i === richDescModalItemIdx ? { ...x, description: richDescModalText } : x))
                  );
                  setRichDescModalItemIdx(null);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 hover:opacity-95 transition cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                Apply Specifications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Modal (Watermarked as PREVIEW) */}
      {showLivePreviewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 sm:p-6 backdrop-blur-xs">
          <div className="relative flex max-h-[96vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 overflow-hidden">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-3.5 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Live Quotation Letterhead Preview
                    </h3>
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                      WATERMARKED • PREVIEW
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time draft rendering of #{refNo || autoNextRefNo || "New Proposal"} for {customerName || "Customer"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintPreview}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                  title="Print watermarked preview draft"
                >
                  <Printer className="h-4 w-4" />
                  Print Preview
                </button>
                <button
                  type="button"
                  onClick={() => setShowLivePreviewModal(false)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  title="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Live Indicator Notice Bar */}
            <div className="bg-amber-50 px-6 py-2.5 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-b border-amber-100 dark:border-amber-900/30 flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <strong>Live Dynamic Preview:</strong> Form changes are instantly rendered on this letterhead.
              </span>
              <span className="font-semibold text-rose-700 dark:text-rose-400">
                Watermarked draft — Official quote is generated upon saving.
              </span>
            </div>

            {/* Scrollable Letterhead Area - Centered A4 Sheet */}
            <div className="flex-1 overflow-y-auto bg-slate-100/70 p-4 sm:p-8 dark:bg-slate-950/60 flex justify-center items-start">
              <div
                ref={previewContainerRef}
                className="w-full max-w-[794px] bg-white shadow-xl rounded-md overflow-hidden flex justify-center relative"
              >
                <QuotationPdfTemplate
                  quotation={previewQuotationRecord}
                  portalLabel="Lead Manager"
                  watermark="PREVIEW"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Product Modal */}
      <ProductDetailModal
        productId={editingProductId}
        create={false}
        open={Boolean(editingProductId)}
        overlayClassName="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
        onSuccess={handleProductMasterUpdated}
        onClose={() => {
          setEditingProductId(null);
          setEditingProductRowIdx(null);
        }}
      />

      {/* Update Party Modal */}
      <PartyDetailModal
        partyId={editingPartyId}
        create={false}
        open={Boolean(editingPartyId)}
        overlayClassName="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
        onSuccess={handlePartyMasterUpdated}
        onClose={() => setEditingPartyId(null)}
      />

    </div>
  );
}
