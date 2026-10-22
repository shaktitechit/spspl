/**
 * @fileoverview Universal Quotation Form Page (Create / Edit Quotation).
 * Standalone page for generating and editing sales & lead quotations.
 * Incorporates searchable lead autocomplete and strict Lead Manager Signatory filtering.
 * @module components/portal/shared/quotations/QuotationFormPage
 */
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Save,
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
  Minus,
  X,
  Copy,
  Eye,
  Printer,
  MapPin,
} from "lucide-react";
import {
  useCreateLeadQuotationMutation,
  useUpdateLeadQuotationMutation,
  useGetLeadQuotationQuery,
  useGetLeadQuery,
  useListTermsAndConditionsQuery,
  useListProductsQuery,
  useListPartiesQuery,
  useCreatePartyMutation,
  usePatchPartyMutation,
  useLazyListPartiesQuery,
  useGetPartyCountriesQuery,
  useGetPartyStatesQuery,
  useGetPartyCitiesQuery,
  useGetCompanyInfoQuery,
  useGetBranchesQuery,
  useListUsersQuery,
  useListLeadsQuery,
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
import { PortalBusyOverlay } from "@/components/portal/shared/PortalBusyOverlay";
import { formatCurrencyINR, canCreateQuotation, canManageQuotations, isSalesDepartmentUser } from "./quotationUtils";
import {
  computeQuotationLineAmounts,
  computeQuotationTotals,
  isValidQuotationLineQuantity,
  parseQuotationLineQuantity,
  numberToIndianWords,
} from "./quotationLineMath";
import { RichTextEditor } from "./RichTextEditor";
import { RichTextDisplay } from "./RichTextDisplay";
import QuotationPdfTemplate from "./QuotationPdfTemplate";
import { getFieldText } from "@/components/leads/LeadFormPage";
import { LeadSearchAutocomplete } from "@/components/leads/LeadSearchAutocomplete";
import {
  PartySearchAutocomplete,
  pickParties,
  type PartyItem,
} from "@/components/leads/PartySearchAutocomplete";
import { syncPartyMaster } from "@/utils/syncPartyMaster";
import {
  buildQuotationSignatoryUsers,
  getLeadManagerPortalRole,
  isUserInLeadManagerPortal,
  getDeptLabel,
} from "@/components/leads/leadUtils";
import { isAdmin, isManager, readSessionFromStorage } from "@/utils/authStorage";
import { useLeadManagerTeamScope } from "@/hooks/useLeadManagerTeamScope";

type Props = {
  mode: "create" | "edit";
  quotationId?: string;
  copyFromId?: string;
  leadId?: string;
  portalHome?: string;
};

type ItemState = {
  product?: string;
  product_name: string;
  description: string;
  hsn_code: string;
  quantity: number;
  unit: string;
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


/**
 * Quick Search & Add product directly from Catalog toolbar
 */
function QuickProductSearchAndAdd({
  products,
  onAddProduct,
}: {
  products: CatalogProduct[];
  onAddProduct: (product: CatalogProduct) => void;
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
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <span>Matching Catalog Products ({filteredProducts.length})</span>
            <span className="text-[9px] text-primary font-semibold">
              Click or press Enter to add
            </span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
              No products found matching &quot;{search}&quot;
            </div>
          ) : (
            filteredProducts.map((p) => {
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
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {skuStr}
                        </span>
                      )}
                      {brandStr && (
                        <span className="rounded-full bg-blue-50 px-1.5 py-0.2 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {brandStr}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      {hsnStr && <span>HSN: {hsnStr}</span>}
                      {unitStr && <span>Unit: {unitStr}</span>}
                      {groupStr && <span>Group: {groupStr}</span>}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="font-bold text-blue-600 dark:text-blue-400">
                      ₹{price.toLocaleString("en-IN")}
                    </div>
                    <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Plus className="h-3 w-3" /> Add to Quote
                    </div>
                  </div>
                </button>
              );
            })
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
}: {
  products: CatalogProduct[];
  selectedId?: string;
  onSelect: (productId: string) => void;
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
          className="w-full rounded-lg border border-slate-200 bg-white py-1 pl-7 pr-6 text-[11px] text-slate-700 shadow-2xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
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
            <div className="px-3 py-2 text-[11px] text-slate-400">No catalog products found</div>
          ) : (
            filteredProducts.map((p) => {
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
                  className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11px] transition hover:bg-blue-50/70 dark:hover:bg-blue-950/40 cursor-pointer ${
                    isSelected
                      ? "bg-blue-50 text-blue-700 font-bold dark:bg-blue-950 dark:text-blue-300"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <span className="truncate pr-2">
                    {prodName}
                    {skuStr && <span className="text-[10px] text-slate-400 ml-1 font-mono">({skuStr})</span>}
                  </span>
                  <span className="shrink-0 font-semibold text-slate-600 dark:text-slate-300">
                    ₹{price.toLocaleString("en-IN")}
                  </span>
                </button>
              );
            })
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

export function QuotationFormPage({
  mode,
  quotationId,
  copyFromId,
  leadId,
  portalHome = "/dashboard",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedCopyFromId = copyFromId || searchParams?.get("copy_from") || searchParams?.get("clone") || undefined;
  const reduxUser = useAppSelector((state) => state.auth.user);
  const sessionUser = useMemo(() => readSessionFromStorage()?.user || null, []);
  const authUser = (reduxUser || sessionUser) as any;
  const { filterByTeam, withSelfInList, isManager, isCoordinator } = useLeadManagerTeamScope();
  const teamScopedPickers = isManager || isCoordinator;

  const isEditing = mode === "edit" && Boolean(quotationId);
  const isCopyMode = mode === "create" && Boolean(resolvedCopyFromId);
  const copyInitializedRef = useRef(false);

  const targetQuotationId = isEditing ? quotationId : isCopyMode ? resolvedCopyFromId : "";

  const { data: existingQuotation, isLoading: loadingQuotation } = useGetLeadQuotationQuery(
    targetQuotationId || "",
    { skip: !targetQuotationId }
  );

  const { data: linkedLead } = useGetLeadQuery(leadId || "", { skip: !leadId });

  const { data: productsData } = useListProductsQuery({ limit: "500" });
  const products = (
    Array.isArray(productsData)
      ? productsData
      : (productsData as { items?: unknown[] })?.items || []
  ) as CatalogProduct[];

  const { data: partiesData } = useListPartiesQuery({ limit: "500" });
  const parties = useMemo(() => pickParties(partiesData), [partiesData]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");

  const selectedParty = useMemo(() => {
    if (!selectedPartyId) return null;
    return parties.find((p) => String(p._id ?? p.id ?? "") === String(selectedPartyId)) || null;
  }, [parties, selectedPartyId]);

  const { data: companyData } = useGetCompanyInfoQuery();
  const { data: branchesData = [] } = useGetBranchesQuery();
  const branches = useMemo(() => {
    return Array.isArray(branchesData) ? branchesData : [];
  }, [branchesData]);

  const { data: usersData } = useListUsersQuery();
  const usersList = useMemo(() => {
    return (
      Array.isArray(usersData)
        ? usersData
        : (usersData as { items?: unknown[] })?.items || (usersData as { data?: unknown[] })?.data || []
    ) as Array<Record<string, unknown>>;
  }, [usersData]);

  // Signatories: all portal admins + team-scoped managers/coordinators
  const managerUsers = useMemo(() => {
    const selfRow = authUser?._id
      ? usersList.find((u: any) => String(u._id) === String(authUser._id))
      : undefined;
    return buildQuotationSignatoryUsers(usersList as Parameters<typeof buildQuotationSignatoryUsers>[0], {
      filterByTeam,
      withSelfInList,
      selfUser: selfRow as Parameters<typeof buildQuotationSignatoryUsers>[1]["selfUser"],
    });
  }, [usersList, filterByTeam, withSelfInList, authUser]);

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
  const { data: masterTermsData } = useListTermsAndConditionsQuery({ limit: 100 });
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

  const { data: leadsData } = useListLeadsQuery({ limit: 200 });
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

  const { data: quotationsData, refetch: refetchQuotations } = useListQuotationsQuery({ limit: 500 });
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

  const [selectedLeadId, setSelectedLeadId] = useState<string>(leadId || "");

  // Form State
  const [refNo, setRefNo] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [gstEnabled, setGstEnabled] = useState<boolean>(true);
  const [quotationDate, setQuotationDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [validityDays, setValidityDays] = useState(15);
  const [subject, setSubject] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [kindAttn, setKindAttn] = useState("");
  const [phone, setPhone] = useState("");
  const [cell, setCell] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [countryId, setCountryId] = useState("");
  const [country, setCountry] = useState("India");
  const [stateId, setStateId] = useState("");
  const [state, setState] = useState("");
  const [cityId, setCityId] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [message, setMessage] = useState("");

  const { data: countriesData = [], isLoading: isCountriesLoading } = useGetPartyCountriesQuery(
    { limit: 500, status: "active" }
  );

  const { data: statesData = [], isLoading: isStatesLoading } = useGetPartyStatesQuery(
    countryId ? { country_id: countryId, limit: 1000, status: "active" } : undefined,
    { skip: !countryId }
  );

  const { data: citiesData = [], isLoading: isCitiesLoading } = useGetPartyCitiesQuery(
    stateId ? { state_id: stateId, limit: 5000, status: "active" } : undefined,
    { skip: !stateId }
  );

  // Auto-select India by default if no country selected
  useEffect(() => {
    if (!countryId && countriesData.length > 0) {
      const india = countriesData.find(
        (c) =>
          c.name.trim().toLowerCase() === "india" ||
          c.iso_code?.toUpperCase() === "IN"
      );
      if (india) {
        setCountryId(india._id || india.id || "");
        setCountry(india.name);
      }
    }
  }, [countriesData, countryId]);

  // Match country name to country ID if set by text
  useEffect(() => {
    if (country && !countryId && countriesData.length > 0) {
      const cMatch = countriesData.find(
        (c) =>
          c.name.trim().toLowerCase() === country.trim().toLowerCase() ||
          c.iso_code?.toLowerCase() === country.trim().toLowerCase()
      );
      if (cMatch) {
        setCountryId(cMatch._id || cMatch.id || "");
      }
    }
  }, [countriesData, country, countryId]);

  // Match state name to state ID if set by text
  useEffect(() => {
    if (state && !stateId && statesData.length > 0) {
      const sMatch = statesData.find(
        (s) => s.name.trim().toLowerCase() === state.trim().toLowerCase()
      );
      if (sMatch) {
        setStateId(sMatch._id || sMatch.id || "");
      }
    }
  }, [statesData, state, stateId]);

  // If stateId is set but does not belong to the currently loaded states for this country, clear it
  useEffect(() => {
    if (stateId && statesData.length > 0 && !isStatesLoading) {
      const exists = statesData.some((s) => (s._id || s.id) === stateId);
      if (!exists) {
        setStateId("");
        setState("");
        setCityId("");
        setCity("");
      }
    }
  }, [statesData, stateId, isStatesLoading]);

  // Match city name to city ID if set by text
  useEffect(() => {
    if (city && !cityId && citiesData.length > 0) {
      const ciMatch = citiesData.find(
        (ci) => ci.name.trim().toLowerCase() === city.trim().toLowerCase()
      );
      if (ciMatch) {
        setCityId(ciMatch._id || ciMatch.id || "");
      }
    }
  }, [citiesData, city, cityId]);

  // If cityId is set but does not belong to the currently loaded cities for this state, clear it
  useEffect(() => {
    if (cityId && citiesData.length > 0 && !isCitiesLoading) {
      const exists = citiesData.some((ci) => (ci._id || ci.id) === cityId);
      if (!exists) {
        setCityId("");
        setCity("");
      }
    }
  }, [citiesData, cityId, isCitiesLoading]);

  // Prioritize or filter parties matching selected state/city/country
  const filteredParties = useMemo(() => {
    if (!state && !city && !country) return parties;
    const cNorm = country.toLowerCase().trim();
    const sNorm = state.toLowerCase().trim();
    const ciNorm = city.toLowerCase().trim();

    return [...parties].sort((a, b) => {
      const aCountry = (a.billing_address?.country || a.country || "").toLowerCase().trim();
      const bCountry = (b.billing_address?.country || b.country || "").toLowerCase().trim();
      const aState = (a.billing_address?.state || a.state || "").toLowerCase().trim();
      const bState = (b.billing_address?.state || b.state || "").toLowerCase().trim();
      const aCity = (a.billing_address?.city || a.district || a.city || "").toLowerCase().trim();
      const bCity = (b.billing_address?.city || b.district || b.city || "").toLowerCase().trim();

      const aScore =
        (ciNorm && aCity === ciNorm ? 4 : 0) +
        (sNorm && aState === sNorm ? 2 : 0) +
        (cNorm && aCountry === cNorm ? 1 : 0);
      const bScore =
        (ciNorm && bCity === ciNorm ? 4 : 0) +
        (sNorm && bState === sNorm ? 2 : 0) +
        (cNorm && bCountry === cNorm ? 1 : 0);
      return bScore - aScore;
    });
  }, [parties, state, city, country]);

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

  // Signatory State
  const [signatoryUserId, setSignatoryUserId] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryPhone, setSignatoryPhone] = useState("");
  const [signatoryEmail, setSignatoryEmail] = useState("");
  const [signatoryDesignation, setSignatoryDesignation] = useState("");

  // Sales Person State (Internal)
  const [salesPersonUserId, setSalesPersonUserId] = useState("");
  const [salesPersonName, setSalesPersonName] = useState("");
  const [salesPersonPhone, setSalesPersonPhone] = useState("");
  const [salesPersonEmail, setSalesPersonEmail] = useState("");
  const [salesPersonDesignation, setSalesPersonDesignation] = useState("Sales Executive");

  const [items, setItems] = useState<ItemState[]>([
    {
      product_name: "",
      description: "",
      hsn_code: "9018",
      quantity: 1,
      unit: "Nos",
      rate: 0,
      gst_rate: 5,
    },
  ]);

  const [terms, setTerms] = useState<string[]>([]);
  const [showTerms, setShowTerms] = useState(true);

  // Rich editor modal state for line item specifications
  const [richDescModalItemIdx, setRichDescModalItemIdx] = useState<number | null>(null);
  const [richDescModalText, setRichDescModalText] = useState<string>("");

  const [createQuotation, { isLoading: isCreating }] = useCreateLeadQuotationMutation();
  const [updateQuotation, { isLoading: isUpdating }] = useUpdateLeadQuotationMutation();
  const [createParty] = useCreatePartyMutation();
  const [patchParty] = usePatchPartyMutation();
  const [fetchPartiesTrigger] = useLazyListPartiesQuery();

  // Compute calculated validity expiry date
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

  const handleLeadSelect = (lId: string) => {
    setSelectedLeadId(lId);
    if (!lId) {
      setSelectedPartyId("");
      setCustomerName("");
      setKindAttn("");
      setPhone("");
      setCell("");
      setEmail("");
      setAddressLine("");
      setCountryId("");
      setCountry("India");
      setStateId("");
      setState("");
      setCityId("");
      setCity("");
      setPincode("");
      return;
    }
    const targetLead = leadsList.find((l) => l._id === lId);
    if (!targetLead) return;

    const leadPartyId = targetLead.party_id?._id || (typeof targetLead.party_id === "string" ? targetLead.party_id : "") || "";
    setSelectedPartyId(leadPartyId);

    const leadOrg =
      targetLead.company_name ||
      targetLead.party_id?.party_name ||
      `M/s. ${targetLead.name || "Customer"}`.trim();
    setCustomerName(leadOrg);
    setKindAttn(targetLead.name || targetLead.contacts?.[0]?.name || "");
    setPhone(targetLead.phone || targetLead.contacts?.[0]?.phone || "");
    setCell(targetLead.alternate_phone || targetLead.phone || targetLead.contacts?.[0]?.phone || "");
    setEmail(targetLead.email || targetLead.contacts?.[0]?.email || "");

    const b = targetLead.billing_address as any;
    const pAddr = targetLead.party_id?.billing_address as any;
    setAddressLine(
      b?.address_line_1 ||
      pAddr?.address_line_1 ||
      ""
    );
    const leadCountry = b?.country || pAddr?.country || targetLead.party_id?.country || "India";
    const leadCountryId = b?.country_id || pAddr?.country_id || targetLead.party_id?.country_id || "";
    setCountry(leadCountry);
    setCountryId(leadCountryId);

    const leadState = b?.state || pAddr?.state || targetLead.party_id?.state || "";
    const leadStateId = b?.state_id || pAddr?.state_id || targetLead.party_id?.state_id || "";
    setState(leadState);
    setStateId(leadStateId);

    const leadCity = b?.city || pAddr?.city || targetLead.party_id?.district || targetLead.party_id?.city || "";
    const leadCityId = b?.city_id || pAddr?.city_id || targetLead.party_id?.city_id || "";
    setCity(leadCity);
    setCityId(leadCityId);

    setPincode(b?.pincode || pAddr?.pincode || "");

    if (targetLead.products && targetLead.products.length > 0) {
      setItems(
        (targetLead.products as Array<{ product?: unknown; product_name?: string; remarks?: string; quantity?: number; unit?: string; target_price?: number }>).map((p) => {
          const pObj = typeof p.product === "object" && p.product !== null ? (p.product as { _id?: string; product_name?: string; unit?: string; base_price?: number }) : null;
          return {
            product: typeof p.product === "string" ? p.product : pObj?._id,
            product_name: p.product_name || pObj?.product_name || "Item / Product",
            description: p.remarks || "",
            hsn_code: "",
            quantity: p.quantity || 1,
            unit: p.unit || pObj?.unit || "Nos",
            rate: p.target_price || pObj?.base_price || 0,
            gst_rate: 18,
          };
        })
      );
      setSubject(`Offer For ${targetLead.products[0]?.product_name || "Item / Product"}`);
    } else {
      setItems([
        {
          product_name: targetLead.requirement || "Product / Service Requirement",
          description: "",
          hsn_code: "",
          quantity: 1,
          unit: "Nos",
          rate: targetLead.estimated_value || 0,
          gst_rate: 18,
        },
      ]);
      setSubject(targetLead.requirement ? `Offer For ${targetLead.requirement}` : "Quotation Proposal");
    }
  };

  const handlePartySelect = (p: PartyItem | null) => {
    if (!p) {
      setSelectedPartyId("");
      return;
    }
    const pId = String(p._id ?? p.id ?? "");
    setSelectedPartyId(pId);
    setCustomerName(p.party_name || "");
    const primaryContact = p.contacts && p.contacts.length > 0 ? p.contacts[0] : null;
    setKindAttn(p.contact_person || primaryContact?.name || "");
    setPhone(p.mobile || p.phone || primaryContact?.phone || "");
    setCell(p.mobile || primaryContact?.phone || primaryContact?.alternate_phone || "");
    setEmail(p.email || primaryContact?.email || "");
    setGstin(p.gst_no || "");

    const pAddr = p.billing_address as any;
    const addr = [pAddr?.address_line_1, pAddr?.address_line_2]
      .filter(Boolean)
      .join(", ");
    setAddressLine(addr || "");

    const pCountry = pAddr?.country || p.country || "India";
    const pCountryId = pAddr?.country_id || p.country_id || "";
    setCountry(pCountry);
    setCountryId(pCountryId);

    const pState = pAddr?.state || p.state || "";
    const pStateId = pAddr?.state_id || p.state_id || "";
    setState(pState);
    setStateId(pStateId);

    const pCity = pAddr?.city || p.district || p.city || "";
    const pCityId = pAddr?.city_id || p.city_id || "";
    setCity(pCity);
    setCityId(pCityId);

    setPincode(pAddr?.pincode || "");

    toast.success(`Loaded customer details for "${p.party_name}"`);
  };

  const handlePartyContactSwitch = (contactName: string) => {
    if (!selectedParty?.contacts) return;
    const c = selectedParty.contacts.find((ct) => ct.name === contactName);
    if (c) {
      setKindAttn(c.name || "");
      if (c.phone) setPhone(c.phone);
      if (c.phone || c.alternate_phone) setCell(c.phone || c.alternate_phone || "");
      if (c.email) setEmail(c.email);
      toast.info(`Switched contact to ${c.name}${c.department ? ` (${c.department})` : ""}`);
    }
  };

  // Populate form on edit mode, copy mode, or linked lead
  useEffect(() => {
    if (isEditing && existingQuotation) {
      const qAny = existingQuotation as any;
      setSelectedPartyId(existingQuotation.party_id || "");
      setSelectedLeadId(typeof existingQuotation.lead === "object" && existingQuotation.lead !== null ? existingQuotation.lead._id : (existingQuotation.lead || ""));
      setRefNo(existingQuotation.ref_no || "");
      setCustomerRef(qAny.customer_ref || "");
      setGstEnabled(existingQuotation.gst_enabled !== false);
      setQuotationDate(
        existingQuotation.quotation_date
          ? new Date(existingQuotation.quotation_date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setValidityDays(existingQuotation.validity_days || 15);
      setSubject(existingQuotation.subject || "");
      setCustomerName(existingQuotation.customer_name || "");
      setKindAttn(qAny.kind_attn || "");
      setPhone(existingQuotation.phone || "");
      setCell(qAny.cell || "");
      setEmail(existingQuotation.email || "");
      setGstin(qAny.gstin || "");
      const addr = (qAny.billing_address || existingQuotation.address) as any;
      if (addr) {
        setAddressLine(addr.address_line_1 || "");
        setCountry(addr.country || "India");
        setCountryId(addr.country_id || "");
        setState(addr.state || "");
        setStateId(addr.state_id || "");
        setCity(addr.city || "");
        setCityId(addr.city_id || "");
        setPincode(addr.pincode || "");
      }

      // Branch & company profile from quotation
      const qBranchId = String((existingQuotation as any).branch_id || (existingQuotation as any).company_branch_id || "");
      setSelectedBranchId(qBranchId);
      setCompanyName(existingQuotation.company_name || "");
      setCompanyRegdAddress(existingQuotation.company_regd_address || "");
      setCompanyPhone(existingQuotation.company_phone || "");
      setCompanyEmail(existingQuotation.company_email || "");
      setCompanyGstin(existingQuotation.company_gstin || "");
      setBankName(existingQuotation.bank_name || "");
      setAccountName(existingQuotation.account_name || "");
      setAccountNumber(existingQuotation.account_number || "");
      setIfscCode(existingQuotation.ifsc_code || "");
      setBankBranchName(existingQuotation.branch_name || "");
      setAccountType(existingQuotation.account_type || "");

      // Signatory from quotation
      const qSignatoryId =
        typeof existingQuotation.signatory_user === "object" && existingQuotation.signatory_user !== null
          ? (existingQuotation.signatory_user as any)?._id || ""
          : (existingQuotation.signatory_user as string) || "";
      setSignatoryUserId(qSignatoryId);
      setSignatoryName(existingQuotation.signatory_name || "");
      setSignatoryPhone(existingQuotation.signatory_phone || "");
      setSignatoryEmail(existingQuotation.signatory_email || "");
      setSignatoryDesignation(existingQuotation.signatory_designation || "");

      // Sales Person from quotation
      const qSalesPersonId =
        typeof (existingQuotation as any).sales_person_user === "object" && (existingQuotation as any).sales_person_user !== null
          ? ((existingQuotation as any).sales_person_user as any)?._id || ""
          : ((existingQuotation as any).sales_person_user as string) || "";
      setSalesPersonUserId(qSalesPersonId);
      setSalesPersonName(existingQuotation.sales_person_name || "");
      setSalesPersonPhone(existingQuotation.sales_person_phone || "");
      setSalesPersonEmail(existingQuotation.sales_person_email || "");
      setSalesPersonDesignation(existingQuotation.sales_person_designation || "Sales Executive");

      if (existingQuotation.items && existingQuotation.items.length > 0) {
        setItems(
          existingQuotation.items.map((i: any) => ({
            product: i.product?._id || i.product || undefined,
            product_name: i.product_name || "",
            description: i.description || "",
            hsn_code: i.hsn_code || "9018",
            quantity: parseQuotationLineQuantity(i.quantity, 1),
            unit: i.unit || "Nos",
            rate: Number(i.rate) || 0,
            discount_percent: Number(i.discount_percent) || 0,
            discount_amount: Number(i.discount_amount) || 0,
            gst_enabled: i.gst_enabled !== false,
            gst_rate: Number(i.gst_rate) ?? 5,
          }))
        );
      }
      setTerms(
        existingQuotation.terms_and_conditions && existingQuotation.terms_and_conditions.length > 0
          ? existingQuotation.terms_and_conditions
          : []
      );
      setMessage((existingQuotation as any).message || (existingQuotation as any).quotation_message || "");
    } else if (isCopyMode && existingQuotation && !copyInitializedRef.current) {
      copyInitializedRef.current = true;
      const qAny = existingQuotation as any;
      setSelectedPartyId(existingQuotation.party_id || "");
      setSelectedLeadId(typeof existingQuotation.lead === "object" && existingQuotation.lead !== null ? existingQuotation.lead._id : (existingQuotation.lead || ""));
      // Assign fresh next reference number and reset date to today
      setRefNo(autoNextRefNo);
      setCustomerRef(qAny.customer_ref || "");
      setGstEnabled(existingQuotation.gst_enabled !== false);
      setQuotationDate(new Date().toISOString().split("T")[0]);
      setValidityDays(existingQuotation.validity_days || 15);
      setSubject(existingQuotation.subject || "");
      setCustomerName(existingQuotation.customer_name || "");
      setKindAttn(qAny.kind_attn || "");
      setPhone(existingQuotation.phone || "");
      setCell(qAny.cell || "");
      setEmail(existingQuotation.email || "");
      setGstin(qAny.gstin || "");
      const addr = (qAny.billing_address || existingQuotation.address) as any;
      if (addr) {
        setAddressLine(addr.address_line_1 || "");
        setCountry(addr.country || "India");
        setCountryId(addr.country_id || "");
        setState(addr.state || "");
        setStateId(addr.state_id || "");
        setCity(addr.city || "");
        setCityId(addr.city_id || "");
        setPincode(addr.pincode || "");
      }

      // Branch & company profile from quotation
      const qBranchId = String((existingQuotation as any).branch_id || (existingQuotation as any).company_branch_id || "");
      setSelectedBranchId(qBranchId);
      setCompanyName(existingQuotation.company_name || "");
      setCompanyRegdAddress(existingQuotation.company_regd_address || "");
      setCompanyPhone(existingQuotation.company_phone || "");
      setCompanyEmail(existingQuotation.company_email || "");
      setCompanyGstin(existingQuotation.company_gstin || "");
      setBankName(existingQuotation.bank_name || "");
      setAccountName(existingQuotation.account_name || "");
      setAccountNumber(existingQuotation.account_number || "");
      setIfscCode(existingQuotation.ifsc_code || "");
      setBankBranchName(existingQuotation.branch_name || "");
      setAccountType(existingQuotation.account_type || "");

      // Signatory from quotation
      const qSignatoryId =
        typeof existingQuotation.signatory_user === "object" && existingQuotation.signatory_user !== null
          ? (existingQuotation.signatory_user as any)?._id || ""
          : (existingQuotation.signatory_user as string) || "";
      setSignatoryUserId(qSignatoryId);
      setSignatoryName(existingQuotation.signatory_name || "");
      setSignatoryPhone(existingQuotation.signatory_phone || "");
      setSignatoryEmail(existingQuotation.signatory_email || "");
      setSignatoryDesignation(existingQuotation.signatory_designation || "");

      // Sales Person from quotation or authUser
      const qSalesPersonId =
        typeof (existingQuotation as any).sales_person_user === "object" && (existingQuotation as any).sales_person_user !== null
          ? ((existingQuotation as any).sales_person_user as any)?._id || ""
          : ((existingQuotation as any).sales_person_user as string) || "";
      if (qSalesPersonId) {
        setSalesPersonUserId(qSalesPersonId);
        setSalesPersonName(existingQuotation.sales_person_name || "");
        setSalesPersonPhone(existingQuotation.sales_person_phone || "");
        setSalesPersonEmail(existingQuotation.sales_person_email || "");
        setSalesPersonDesignation(existingQuotation.sales_person_designation || "Sales Executive");
      } else if (authUser && isSalesDepartmentUser(authUser as any)) {
        setSalesPersonUserId(String(authUser._id || (authUser as any).id || ""));
        setSalesPersonName(String(authUser.name || authUser.email || ""));
        setSalesPersonPhone(String((authUser as any).phone || ""));
        setSalesPersonEmail(String(authUser.email || ""));
        setSalesPersonDesignation(String((authUser as any).designation || "Sales Executive"));
      }

      if (existingQuotation.items && existingQuotation.items.length > 0) {
        setItems(
          existingQuotation.items.map((i: any) => ({
            product: i.product?._id || i.product || undefined,
            product_name: i.product_name || "",
            description: i.description || "",
            hsn_code: i.hsn_code || "9018",
            quantity: parseQuotationLineQuantity(i.quantity, 1),
            unit: i.unit || "Nos",
            rate: Number(i.rate) || 0,
            discount_percent: Number(i.discount_percent) || 0,
            discount_amount: Number(i.discount_amount) || 0,
            gst_enabled: i.gst_enabled !== false,
            gst_rate: Number(i.gst_rate) ?? 5,
          }))
        );
      }
      setTerms(
        existingQuotation.terms_and_conditions && existingQuotation.terms_and_conditions.length > 0
          ? existingQuotation.terms_and_conditions
          : []
      );
      setMessage((existingQuotation as any).message || (existingQuotation as any).quotation_message || "");
      toast.info(`Pre-filled quotation copied from #${existingQuotation.quotation_no || existingQuotation.ref_no}`);
    } else if (linkedLead && !isCopyMode) {
      handleLeadSelect(linkedLead._id);
      setRefNo(autoNextRefNo);
      setMessage("");
    } else if (!isEditing && !isCopyMode) {
      setRefNo(autoNextRefNo);
      setMessage("");
      if (authUser && isSalesDepartmentUser(authUser as any)) {
        setSalesPersonUserId(String(authUser._id || (authUser as any).id || ""));
        setSalesPersonName(String(authUser.name || authUser.email || ""));
        setSalesPersonPhone(String((authUser as any).phone || ""));
        setSalesPersonEmail(String(authUser.email || ""));
        setSalesPersonDesignation(String((authUser as any).designation || "Sales Executive"));
      }
    }
  }, [isEditing, isCopyMode, existingQuotation, linkedLead, autoNextRefNo, authUser]);

  // Default to Head Office branch on new quotation when branches load
  useEffect(() => {
    if (!isEditing && !isCopyMode && !selectedBranchId && branches.length > 0) {
      const headOffice = branches.find((b) => b.is_head_office) || branches[0];
      if (headOffice) {
        handleBranchSelect(headOffice._id, false);
      }
    }
  }, [isEditing, isCopyMode, selectedBranchId, branches]);

  // If editing an existing quote that didn't have branch_id explicitly set, match branch by code, gstin, or fallback to head office
  useEffect(() => {
    if (isEditing && existingQuotation && !selectedBranchId && branches.length > 0) {
      const qAny = existingQuotation as any;
      const match =
        branches.find((b) => b.branch_code && b.branch_code === qAny.branch_code) ||
        branches.find((b) => b.taxation?.gstin && b.taxation.gstin === existingQuotation.company_gstin) ||
        branches.find((b) => b.is_head_office) ||
        branches[0];
      if (match) {
        setSelectedBranchId(match._id);
        if (!companyName) setCompanyName(existingQuotation.company_name || match.branch_name);
        if (!companyRegdAddress) setCompanyRegdAddress(existingQuotation.company_regd_address || formatBranchAddress(match));
        if (!companyPhone) setCompanyPhone(existingQuotation.company_phone || match.contact?.phone || "");
        if (!companyEmail) setCompanyEmail(existingQuotation.company_email || match.contact?.email || "");
        if (!companyGstin) setCompanyGstin(existingQuotation.company_gstin || match.taxation?.gstin || "");
      }
    }
  }, [isEditing, existingQuotation, selectedBranchId, branches]);

  const handleSelectAdminUser = (userId: string) => {
    if (!userId) {
      setSignatoryUserId("");
      setSignatoryName("");
      setSignatoryPhone("");
      setSignatoryEmail("");
      setSignatoryDesignation("");
      return;
    }
    const selected = usersList.find((u: any) => u._id === userId) as any;
    if (!selected) return;
    const roleBadge = getLeadManagerPortalRole(selected);
    setSignatoryUserId(selected._id);
    setSignatoryName(selected.name || "");
    setSignatoryPhone(selected.phone || "");
    setSignatoryEmail(selected.email || "");
    setSignatoryDesignation(
      roleBadge === "Admin"
        ? "Lead Administrator"
        : "Lead Manager"
    );
  };

  const handleSelectSalesPersonUser = (userId: string) => {
    if (!userId) {
      setSalesPersonUserId("");
      setSalesPersonName("");
      setSalesPersonPhone("");
      setSalesPersonEmail("");
      setSalesPersonDesignation("Sales Executive");
      return;
    }
    const selected = usersList.find((u: any) => String(u._id) === String(userId)) as any;
    if (!selected) return;
    setSalesPersonUserId(selected._id);
    setSalesPersonName(selected.name || selected.email || "");
    setSalesPersonPhone(selected.phone || "");
    setSalesPersonEmail(selected.email || "");
    setSalesPersonDesignation(
      selected.designation ||
        (selected.department
          ? `${selected.department.charAt(0).toUpperCase() + selected.department.slice(1)} Executive`
          : "Sales Executive")
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
      _id: quotationId || "preview-id",
      quotation_no: refNo.trim() || autoNextRefNo || "Q-PREVIEW",
      ref_no: refNo.trim() || autoNextRefNo || "Q-PREVIEW",
      customer_ref: customerRef.trim() || undefined,
      lead: selectedLeadId || leadId || "",
      party_id: selectedPartyId || undefined,
      quotation_date: quotationDate ? new Date(quotationDate).toISOString() : new Date().toISOString(),
      valid_until: validityEndDate ? new Date(validityEndDate).toISOString() : undefined,
      validity_days: Number(validityDays) || 15,
      subject: subject.trim() || "Quotation Proposal",
      customer_name: customerName.trim() || "Customer / Organization",
      kind_attn: kindAttn.trim() || undefined,
      phone: phone.trim() || undefined,
      cell: cell.trim() || undefined,
      email: email.trim() || undefined,
      gstin: gstin.trim() || undefined,
      address: {
        address_line_1: addressLine.trim() || undefined,
        city: city.trim() || undefined,
        city_id: cityId || undefined,
        state: state.trim() || undefined,
        state_id: stateId || undefined,
        country: country.trim() || "India",
        country_id: countryId || undefined,
        pincode: pincode.trim() || undefined,
      },
      items: items.map((i, idx) => {
        const calc = calculations.items[idx];
        return {
          product: i.product,
          product_name: i.product_name.trim() || "Item",
          description: i.description || "",
          hsn_code: i.hsn_code || "9018",
          quantity: parseQuotationLineQuantity(i.quantity, 1),
          unit: i.unit || "Nos",
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
      status: "draft",
      approval_status: "pending_approval",
      gst_enabled: gstEnabled,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [
    quotationId,
    refNo,
    autoNextRefNo,
    customerRef,
    selectedLeadId,
    leadId,
    selectedPartyId,
    quotationDate,
    validityEndDate,
    validityDays,
    subject,
    customerName,
    kindAttn,
    phone,
    cell,
    email,
    gstin,
    addressLine,
    city,
    cityId,
    state,
    stateId,
    country,
    countryId,
    pincode,
    items,
    gstEnabled,
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
  ]);

  const handlePrintPreview = () => {
    if (!previewContainerRef.current) return;

    // Detect if content exceeds single A4 printable page height (~1060px)
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
              ${
                isMultiPage
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
            * {
              box-sizing: border-box;
            }
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
            .rich-text-content {
              font-size: 8.5px !important;
              line-height: 1.4 !important;
              color: #1e293b !important;
            }
            .rich-text-content table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin: 4px 0 6px 0 !important;
              page-break-inside: avoid !important;
            }
            .rich-text-content th,
            .rich-text-content td {
              border: 1px solid #cbd5e1 !important;
              padding: 4px 6px !important;
              font-size: 8px !important;
              line-height: 1.3 !important;
              text-align: left !important;
              vertical-align: top !important;
            }
            .rich-text-content th {
              background-color: #f1f5f9 !important;
              font-weight: 700 !important;
              color: #0f172a !important;
            }
            .rich-text-content h1 {
              font-size: 11px !important;
              font-weight: 700 !important;
              margin: 4px 0 2px 0 !important;
              color: #0f172a !important;
            }
            .rich-text-content h2 {
              font-size: 10px !important;
              font-weight: 700 !important;
              margin: 3px 0 2px 0 !important;
              color: #0f172a !important;
            }
            .rich-text-content h3 {
              font-size: 9px !important;
              font-weight: 700 !important;
              margin: 2px 0 1px 0 !important;
              color: #0f172a !important;
            }
            .rich-text-content p {
              margin: 0 0 3px 0 !important;
            }
            .rich-text-content ul,
            .rich-text-content ol {
              margin: 2px 0 4px 0 !important;
              padding-left: 16px !important;
            }
            .rich-text-content li {
              margin-bottom: 2px !important;
            }
            .rich-text-content blockquote {
              border-left: 2px solid #94a3b8 !important;
              padding-left: 8px !important;
              margin: 3px 0 !important;
              font-style: italic !important;
            }
            .rich-text-content hr {
              border: none !important;
              border-top: 1px solid #cbd5e1 !important;
              margin: 4px 0 !important;
            }
            ${
              isMultiPage
                ? `.print-page-number::after {
              content: "Page " counter(page) " of " counter(pages);
            }`
                : `.print-page-number {
              display: none !important;
            }`
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
    }, 250);
  };

  // Product Selection handler
  const handleSelectProduct = (index: number, productId: string) => {
    if (!productId) {
      setItems((prev) =>
        prev.map((it, idx) => (idx === index ? { ...it, product: undefined } : it))
      );
      return;
    }
    const found = products.find((p) => p._id === productId);
    if (!found) return;

    const prodName = getFieldText(found.product_name) || "Catalog Item";
    const prodHsn = getFieldText(found.hsn_code) || "9018";
    const prodUnit = getFieldText(found.unit) || "Nos";

    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        return {
          ...it,
          product: found._id,
          product_name: prodName,
          hsn_code: prodHsn || it.hsn_code || "9018",
          rate: Number(found.base_price ?? found.minimum_sale_rate ?? it.rate ?? 0),
          unit: prodUnit || it.unit || "Nos",
          gst_rate: Number(found.gst_percent ?? it.gst_rate ?? 5),
        };
      })
    );
  };

  const handleQuickAddProduct = (p: CatalogProduct) => {
    const rate = Number(p.base_price ?? p.minimum_sale_rate ?? p.mrp ?? 0);
    const gstRate = Number(p.gst_percent ?? p.default_gst_rate ?? 5);
    const prodName = getFieldText(p.product_name) || "Catalog Item";
    const prodDesc = getFieldText(p.description);
    const prodHsn = getFieldText(p.hsn_code) || "9018";
    const prodUnit = getFieldText(p.unit) || "Nos";

    const newItem: ItemState = {
      product: p._id,
      product_name: prodName,
      description: prodDesc,
      hsn_code: prodHsn,
      quantity: 1,
      unit: prodUnit,
      rate,
      gst_enabled: true,
      gst_rate: gstRate,
    };

    setItems((prev) => {
      if (
        prev.length === 1 &&
        !prev[0].product &&
        (!prev[0].product_name ||
          prev[0].product_name === "Item / Product" ||
          prev[0].product_name === "Product / Service Requirement" ||
          prev[0].product_name === "Medical Equipment / Supplies" ||
          prev[0].product_name === "Fresenius Hemodialysis Machine") &&
        prev[0].rate === 0
      ) {
        return [newItem];
      }
      return [...prev, newItem];
    });

    if (!subject || subject === "Offer For Medical Equipment" || subject === "Quotation Proposal") {
      setSubject(`Offer For ${p.product_name}`);
    }

    toast.success(`Added "${p.product_name}" to quotation items`);
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        product_name: "",
        description: "",
        hsn_code: "",
        quantity: 1,
        unit: "Nos",
        rate: 0,
        gst_enabled: true,
        gst_rate: 18,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("Quotation must have at least one product item");
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
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
      setTerms((prev) => prev.filter((t) => !setLines.includes(t.trim())));
    } else {
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
      toast.error("Only managers are authorized to create or edit quotations");
      return;
    }

    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    if (!country.trim()) {
      toast.error("Country is required");
      return;
    }

    if (!state.trim()) {
      toast.error("State is required");
      return;
    }

    if (!city.trim()) {
      toast.error("City is required");
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
      toast.error("Please select an authorized Lead Manager signatory from the signatory dropdown");
      return;
    }

    const cleanedTerms = terms.map((t) => t.trim()).filter(Boolean);

    // Sync Party Master (check party master with name, contact, email, gst; create with party_type quotation if not exist, or update via party service)
    let resolvedPartyId = selectedPartyId || "";
    try {
      const syncResult = await syncPartyMaster({
        partyType: "quotation",
        partyId: selectedPartyId || undefined,
        partyName: customerName.trim(),
        contactPerson: kindAttn.trim() || undefined,
        phone: phone.trim() || cell.trim(),
        email: email.trim(),
        gst: gstin.trim(),
        billingAddress: {
          address_line_1: addressLine.trim() || undefined,
          city: city.trim() || undefined,
          city_id: cityId || undefined,
          state: state.trim() || undefined,
          state_id: stateId || undefined,
          pincode: pincode.trim() || undefined,
          country: country.trim() || "India",
          country_id: countryId || undefined,
        },
        contacts: kindAttn.trim()
          ? [
              {
                name: kindAttn.trim(),
                phone: phone.trim() || cell.trim() || undefined,
                email: email.trim() || undefined,
                is_primary: true,
              },
            ]
          : [],
        existingParties: parties,
        fetchPartiesBySearch: (q) => fetchPartiesTrigger(q).unwrap(),
        createParty: (body) => createParty(body).unwrap(),
        patchParty: (arg) => patchParty(arg).unwrap(),
      });

      if (syncResult?.partyId) {
        resolvedPartyId = syncResult.partyId;
        setSelectedPartyId(syncResult.partyId);
        if (syncResult.matched) {
          toast.info(`Party Master matched & updated: ${syncResult.partyName}`);
        } else {
          toast.success(`New Party Master created with type 'quotation': ${syncResult.partyName}`);
        }
      }
    } catch (partyErr) {
      console.warn("Party master sync warning:", partyErr);
    }

    const payload: CreateQuotationPayload & Record<string, unknown> = {
      ref_no: refNo.trim() || undefined,
      customer_ref: customerRef.trim() || undefined,
      party_id: resolvedPartyId || undefined,
      gst_enabled: gstEnabled,
      quotation_date: quotationDate ? new Date(quotationDate).toISOString() : new Date().toISOString(),
      validity_days: Number(validityDays) || 15,
      subject: subject.trim() || undefined,
      customer_name: customerName.trim(),
      kind_attn: kindAttn.trim(),
      phone: phone.trim(),
      cell: cell.trim(),
      email: email.trim(),
      gstin: gstin.trim(),
      address: {
        address_line_1: addressLine.trim(),
        city: city.trim(),
        city_id: cityId || undefined,
        state: state.trim(),
        state_id: stateId || undefined,
        pincode: pincode.trim(),
        country: country.trim() || "India",
        country_id: countryId || undefined,
      },
      items: items.map((i) => ({
        product: i.product,
        product_name: i.product_name.trim(),
        description: i.description.trim(),
        hsn_code: i.hsn_code.trim() || "9018",
        quantity: parseQuotationLineQuantity(i.quantity, 1),
        unit: i.unit.trim() || "Nos",
        rate: Number(i.rate) || 0,
        discount_percent: Number(i.discount_percent) || 0,
        discount_amount: Number(i.discount_amount) || 0,
        gst_enabled: i.gst_enabled !== false,
        gst_rate: Number(i.gst_rate) || 0,
      })),
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
      signatory_designation: signatoryDesignation.trim() || "Lead Manager",
      signatory_user: signatoryUserId || undefined,
      sales_person_name: salesPersonName.trim(),
      sales_person_phone: salesPersonPhone.trim(),
      sales_person_email: salesPersonEmail.trim(),
      sales_person_designation: salesPersonDesignation.trim() || "Sales Executive",
      sales_person_user: salesPersonUserId || undefined,
      amount_in_words: calculations.amount_in_words || numberToIndianWords(calculations.grandTotal),
    };

    const targetLeadId = selectedLeadId || leadId || "";

    try {
      if (isEditing && quotationId) {
        const res = await updateQuotation({
          quotationId,
          leadId: targetLeadId || undefined,
          body: payload as CreateQuotationPayload,
        }).unwrap();
        toast.success(`Quotation ${res.quotation_no} updated successfully`);
      } else {
        const res = await createQuotation({
          leadId: targetLeadId || undefined,
          body: payload as CreateQuotationPayload,
        }).unwrap();
        toast.success(`Quotation ${res.quotation_no} created successfully`);
      }
      router.push(`${portalHome}/quotations`);
    } catch (err: unknown) {
      toast.error(mutationRejectedMessage(err) || "Failed to save quotation");
    }
  };

  if (loadingQuotation) {
    return (
      <div className="flex h-96 items-center justify-center text-xs text-slate-500">
        <RefreshCw className="h-6 w-6 animate-spin text-primary mr-2" />
        Loading quotation details...
      </div>
    );
  }

  if (!canManageQuotations(authUser)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 mb-4">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Manager Access Required
        </h2>
        <p className="mt-2 text-xs text-slate-500 max-w-sm">
          Creating and editing quotations is limited to administrators, managers, and coordinators. You can view your assigned proposals from the quotations list.
        </p>
        <Link
          href={`${portalHome}/quotations`}
          className="mt-5 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-white shadow-md hover:bg-primary-hover transition"
        >
          Return to Quotation Master
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen space-y-6 pb-20">
      <PortalBusyOverlay active={isCreating || isUpdating} />

      {/* Header Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-white/10">
        <div className="flex items-center gap-3">
          <Link
            href={`${portalHome}/quotations`}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {isCopyMode ? (
                <Copy className="h-5 w-5 text-indigo-500" />
              ) : (
                <FileText className="h-5 w-5 text-primary" />
              )}
              {isEditing
                ? `Edit Quotation #${existingQuotation?.quotation_no || ""}`
                : isCopyMode
                ? `Copy Quotation (from #${existingQuotation?.quotation_no || existingQuotation?.ref_no || ""})`
                : "Generate Quotation"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isCopyMode
                ? `Creating a new quotation copied from #${existingQuotation?.quotation_no || existingQuotation?.ref_no || "previous quotation"}`
                : isEditing
                ? `Editing existing quotation ${existingQuotation?.quotation_no || ""} (Current v${existingQuotation?.version || 1}). Updates will save to revision history without duplicating.`
                : `Official Letterhead format proposal for ${customerName || "Customer"}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowLivePreviewModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-xs hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/60 dark:text-emerald-300 transition-colors cursor-pointer"
            title="View real-time A4 letterhead preview with PREVIEW watermark"
          >
            <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Live Preview
          </button>
          {isEditing && quotationId && (
            <Link
              href={`${portalHome}/quotations/new?copy_from=${quotationId}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 transition"
              title="Create a copy of this quotation as a new quotation"
            >
              <Copy className="h-4 w-4 text-indigo-500" />
              Copy Quotation
            </Link>
          )}
          <Link
            href={`${portalHome}/quotations`}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isCreating || isUpdating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            {isCreating || isUpdating
              ? "Saving..."
              : isEditing
              ? (existingQuotation?.status === "draft" ? "Update Quotation (v1)" : `Save Revision (v${(existingQuotation?.version || 1) + 1})`)
              : isCopyMode
              ? "Create Copied Quotation"
              : "Generate Quotation"}
          </button>
        </div>
      </div>

      {/* Main Form Body */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Copy Mode Information Banner */}
        {isCopyMode && existingQuotation && (
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 via-white to-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-slate-900 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black text-xs shadow-md shadow-indigo-600/20">
                <Copy className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Copying from Quotation #{existingQuotation.quotation_no || existingQuotation.ref_no}
                  </h4>
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-black uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    Source: v{existingQuotation.version || 1}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  All line items, specifications, addresses, and terms &amp; conditions have been copied. A fresh quotation reference will be created as a Draft proposal upon saving.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start md:self-auto rounded-xl bg-indigo-100/70 px-3 py-1.5 dark:bg-indigo-950/70 text-xs font-bold text-indigo-800 dark:text-indigo-300">
              <span>New Reference:</span>
              <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-white font-mono">{refNo || autoNextRefNo}</span>
            </div>
          </div>
        )}

        {/* Revision Information Banner for Edit Mode */}
        {isEditing && existingQuotation && (
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-slate-900 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black text-xs shadow-md shadow-indigo-600/20">
                v{existingQuotation.version || 1}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Editing Quotation #{existingQuotation.quotation_no}
                  </h4>
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-black uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    Current: v{existingQuotation.version || 1}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {existingQuotation.status !== "draft"
                    ? `Saving will archive version ${existingQuotation.version || 1} into history, update this quotation to v${(existingQuotation.version || 1) + 1}, and request signatory re-approval.`
                    : "Draft quotation content will be updated directly."}
                </p>
              </div>
            </div>
            {existingQuotation.status !== "draft" && (
              <div className="flex items-center gap-2 self-start md:self-auto rounded-xl bg-indigo-100/70 px-3 py-1.5 dark:bg-indigo-950/70 text-xs font-bold text-indigo-800 dark:text-indigo-300">
                <span>Next Revision:</span>
                <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-white">v{(existingQuotation.version || 1) + 1}</span>
              </div>
            )}
          </div>
        )}

        {/* Lead Link / Direct Selection Banner */}
        {!isEditing && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Quotation Type &amp; Link to Lead
              </label>
              {selectedLeadId && (
                <button
                  type="button"
                  onClick={() => handleLeadSelect("")}
                  className="text-xs font-bold text-rose-600 hover:underline dark:text-rose-400 cursor-pointer"
                >
                  Unlink Lead / Switch to Direct Quotation
                </button>
              )}
            </div>

            <LeadSearchAutocomplete
              leads={leadsList}
              selectedLeadId={selectedLeadId}
              onSelect={handleLeadSelect}
            />

            <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {selectedLeadId ? "✓ Linked to Lead" : "• Standalone Proposal (Direct Quotation)"}
              </span>
            </div>
          </div>
        )}

        {/* Company Branch & Letterhead Entity */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3 dark:border-white/10">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>Company Branch / Billing &amp; Letterhead Entity</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Opt the branch profile used for Header (Logo, Address, Phone, Email, GSTIN) and Footer (Bank details &amp; Signatory address).
              </p>
            </div>
            {selectedBranch && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {selectedBranch.is_head_office ? "Head Office" : "Branch Office"} • Code: {selectedBranch.branch_code}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-1 space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Opt Company Branch <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedBranchId}
                  onChange={(e) => handleBranchSelect(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-8 text-xs font-bold text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white cursor-pointer"
                >
                  <option value="" disabled>-- Select Company Branch --</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.branch_name} ({b.address?.city || b.branch_code}){b.is_head_office ? " [HQ]" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-400">
                Switching branch updates header letterhead address, contact phone/email, GSTIN, and company banking details.
              </p>
            </div>

            <div className="md:col-span-2 rounded-xl bg-slate-50/90 p-4 border border-slate-200/80 dark:bg-slate-800/60 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{companyName || "No Branch Selected"}</span>
                </div>
                {companyGstin && (
                  <span className="text-[10px] font-mono font-bold text-slate-600 bg-white dark:bg-slate-700 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">
                    GSTIN: {companyGstin}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] text-slate-600 dark:text-slate-300">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Branch Address: </span>
                  <span className="break-words">{companyRegdAddress || "Address not configured"}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Official Contact: </span>
                  <span>{[companyPhone ? `Phone: ${companyPhone}` : "", companyEmail ? `Email: ${companyEmail}` : ""].filter(Boolean).join(" • ") || "N/A"}</span>
                </div>
                <div className="sm:col-span-2 pt-2 border-t border-slate-200/60 dark:border-white/10 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px]">
                  <span><strong className="text-slate-700 dark:text-slate-200">Bank:</strong> {bankName || "N/A"}</span>
                  <span><strong className="text-slate-700 dark:text-slate-200">A/c No:</strong> <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{accountNumber || "N/A"}</span></span>
                  <span><strong className="text-slate-700 dark:text-slate-200">IFSC:</strong> <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{ifscCode || "N/A"}</span></span>
                  {bankBranchName && <span><strong className="text-slate-700 dark:text-slate-200">Branch:</strong> {bankBranchName}</span>}
                  {accountType && <span><strong className="text-slate-700 dark:text-slate-200">Type:</strong> {accountType}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reference & Proposal Subject */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Quotation Reference &amp; Proposal Subject
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ref. No.
                </label>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      refetchQuotations();
                      setRefNo(autoNextRefNo);
                      toast.info(`Next sequential reference number: ${autoNextRefNo}`);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                    title="Recalculate next sequential reference number"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Auto Pick
                  </button>
                )}
              </div>
              <input
                type="text"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="e.g. Q-1001"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white font-mono font-bold text-primary"
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Quotation Date
                </label>
                <input
                  type="date"
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Validity Date (Valid Until)</span>
                  <span className="text-[10px] text-blue-600 font-bold dark:text-blue-400">Calculated Date</span>
                </label>
                <input
                  type="date"
                  value={validityEndDate}
                  onChange={(e) => handleValidityEndDateChange(e.target.value)}
                  className="w-full rounded-xl border border-blue-200 bg-blue-50/40 px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Validity (Days)
              </label>
              <input
                type="number"
                min="1"
                max="180"
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white font-bold"
              />
              <p className="mt-1 text-[10px] text-slate-400">Defaults to 15 days validity</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject / Title
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Offer For Medical Equipment"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Customer Details */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-blue-600" />
              Customer / Recipient Information
            </div>
            {selectedParty && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-2xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                <Building2 className="h-3 w-3" />
                Party Master Linked
              </span>
            )}
          </div>

          {/* Party Master Search & Autofill Panel */}
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-blue-600" />
                Search Party Master (Autofill Customer Details)
              </label>
              {selectedParty && (
                <button
                  type="button"
                  onClick={() => handlePartySelect(null)}
                  className="text-[11px] font-bold text-rose-600 hover:underline dark:text-rose-400 cursor-pointer"
                >
                  Clear / Unlink Party
                </button>
              )}
            </div>

            <PartySearchAutocomplete
              parties={filteredParties}
              selectedPartyId={selectedPartyId}
              onSelect={handlePartySelect}
            />

            {/* Selected Party Summary & Multiple Contacts Switcher */}
            {selectedParty && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 p-2 text-xs dark:bg-slate-900/80 border border-blue-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedParty.party_name}
                  </span>
                  {selectedParty.party_code && (
                    <span className="font-mono text-[10px] text-slate-500">
                      ({selectedParty.party_code})
                    </span>
                  )}
                  {selectedParty.party_type && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600 capitalize dark:bg-slate-800 dark:text-slate-300">
                      {selectedParty.party_type}
                    </span>
                  )}
                  {selectedParty.sra === true && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      SRA
                    </span>
                  )}
                  {(selectedParty.billing_address?.city || selectedParty.district) && (
                    <span className="text-[11px] text-slate-500">
                      • {selectedParty.billing_address?.city || selectedParty.district}
                    </span>
                  )}
                </div>

                {selectedParty.contacts && selectedParty.contacts.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-500">Switch Contact:</span>
                    <select
                      value={kindAttn}
                      onChange={(e) => handlePartyContactSwitch(e.target.value)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      {selectedParty.contacts.map((c, i) => (
                        <option key={i} value={c.name || ""}>
                          {c.name} {c.department ? `(${c.department})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Customer Name / M/s. <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. M/s. Apex Super Specialty Hospital"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Customer Ref <span className="text-[10px] text-slate-400 font-normal">(Enquiry / PO Ref)</span>
              </label>
              <input
                type="text"
                value={customerRef}
                onChange={(e) => setCustomerRef(e.target.value)}
                placeholder="e.g. PO-9876 / ENQ-123"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kind Attn (Contact Person)
              </label>
              <input
                type="text"
                value={kindAttn}
                onChange={(e) => setKindAttn(e.target.value)}
                placeholder="e.g. Dr. Rajesh Sharma"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone / Tel.
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Office Landline / Phone"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mobile / Cell
              </label>
              <input
                type="text"
                value={cell}
                onChange={(e) => setCell(e.target.value)}
                placeholder="Mobile Number"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@email.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                GSTIN
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="e.g. 03ABCDE1234F1Z5"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white font-mono uppercase"
              />
            </div>

            <div className="sm:col-span-2 md:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Street Address
              </label>
              <input
                type="text"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Building / Street Address"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Country <span className="text-rose-500">*</span>
              </label>
              <select
                value={countryId}
                onChange={(e) => {
                  const cId = e.target.value;
                  setCountryId(cId);
                  const matched = countriesData.find((c) => (c._id || c.id) === cId);
                  setCountry(matched?.name || "");
                  setStateId("");
                  setState("");
                  setCityId("");
                  setCity("");
                }}
                disabled={isCountriesLoading}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white disabled:opacity-50"
              >
                <option value="">{isCountriesLoading ? "Loading countries..." : "Select Country"}</option>
                {countriesData.map((c) => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                State <span className="text-rose-500">*</span>
              </label>
              <select
                value={stateId}
                onChange={(e) => {
                  const sId = e.target.value;
                  setStateId(sId);
                  const matched = statesData.find((s) => (s._id || s.id) === sId);
                  setState(matched?.name || "");
                  setCityId("");
                  setCity("");
                }}
                disabled={!countryId || isStatesLoading}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white disabled:opacity-50"
              >
                <option value="">
                  {!countryId
                    ? "Select country first"
                    : isStatesLoading
                    ? "Loading states..."
                    : "Select State"}
                </option>
                {statesData.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.name}
                  </option>
                ))}
                {state && !statesData.some((s) => (s._id || s.id) === stateId) && (
                  <option value={stateId || state}>{state}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                City / District <span className="text-rose-500">*</span>
              </label>
              <select
                value={cityId}
                onChange={(e) => {
                  const ciId = e.target.value;
                  setCityId(ciId);
                  const matched = citiesData.find((ci) => (ci._id || ci.id) === ciId);
                  setCity(matched?.name || "");
                }}
                disabled={!stateId || isCitiesLoading}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white disabled:opacity-50"
              >
                <option value="">
                  {!stateId
                    ? "Select state first"
                    : isCitiesLoading
                    ? "Loading cities..."
                    : "Select City"}
                </option>
                {citiesData.map((ci) => (
                  <option key={ci._id || ci.id} value={ci._id || ci.id}>
                    {ci.name}
                  </option>
                ))}
                {city && !citiesData.some((ci) => (ci._id || ci.id) === cityId) && (
                  <option value={cityId || city}>{city}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pincode
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="Pincode"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Cover / Introductory Message (Above Requirements) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Introductory Message / Cover Note
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Optional cover letter / introductory message displayed directly above requirements &amp; pricing table. If empty, nothing is shown on the quotation PDF.
                </p>
              </div>
            </div>
            {message && (
              <button
                type="button"
                onClick={() => setMessage("")}
                className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline"
              >
                Clear Message
              </button>
            )}
          </div>
          <RichTextEditor
            value={message}
            onChange={(val) => setMessage(val)}
            placeholder="Write your introductory message or cover note here (e.g. 'Dear Sir, We thank you for your valued enquiry and are pleased to submit our best competitive quotation...')..."
            minHeight="110px"
          />
        </div>

        {/* Line Items Table Builder */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                Line Items &amp; Products ({items.length})
              </div>

              {/* GST Enable/Disable Checkbox */}
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 shadow-2xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition select-none">
                <input
                  type="checkbox"
                  checked={gstEnabled}
                  onChange={(e) => setGstEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-white/20 dark:bg-slate-900 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Calculate GST
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${
                    gstEnabled
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                  }`}
                >
                  {gstEnabled ? "Enabled" : "Exempt / Off"}
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
              title="Add empty row for custom non-catalog item"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Custom Item
            </button>
          </div>
          <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
            Use a <strong>negative quantity</strong> on a line to credit a return or replacement (totals and PDF reflect signed amounts).
          </p>

          {/* Quick Search & Add from Catalog */}
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              Quick Search &amp; Add Products from Catalog
            </div>
            <QuickProductSearchAndAdd
              products={products}
              onAddProduct={handleQuickAddProduct}
            />
          </div>

          <div className="space-y-3">
            {items.map((it, idx) => {
              const comp = calculations.items[idx];
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-white/10 dark:bg-slate-800/40"
                >
                  <div className="grid grid-cols-12 gap-2 items-end">
                    {/* Sr & Product Selector */}
                    <div className="col-span-12 sm:col-span-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                          {idx + 1}
                        </span>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Product Description <span className="text-rose-500">*</span>
                        </label>
                      </div>

                      {/* Searchable catalog autocomplete in row */}
                      <ProductRowAutocomplete
                        products={products}
                        selectedId={it.product}
                        onSelect={(pId) => handleSelectProduct(idx, pId)}
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
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    {/* HSN */}
                    <div className="col-span-4 sm:col-span-1">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
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
                        placeholder="9018"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white font-mono"
                      />
                    </div>

                    {/* QTY & Unit */}
                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Qty &amp; Unit
                      </label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="any"
                          title="Negative qty = return / replacement credit"
                          value={Number.isFinite(Number(it.quantity)) ? it.quantity : ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const nextQty = raw === "" ? NaN : Number(raw);
                            setItems((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, quantity: nextQty as number } : x))
                            );
                          }}
                          className={`w-16 rounded-lg border bg-white px-2 py-1.5 text-xs font-bold dark:bg-slate-900 dark:text-white ${
                            Number(it.quantity) < 0
                              ? "border-amber-400 text-amber-900 dark:border-amber-600 dark:text-amber-200"
                              : "border-slate-200 text-slate-900 dark:border-white/10"
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
                          className="w-14 rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-xs text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Rate */}
                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Rate (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.rate}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, rate: Number(e.target.value) } : x))
                          )
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    {/* Disc % */}
                    <div className="col-span-3 sm:col-span-1">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
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
                        className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-xs font-semibold text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                        placeholder="0"
                      />
                    </div>

                    {/* GST % with Inline Toggle */}
                    <div className="col-span-3 sm:col-span-1">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          GST %
                        </label>
                        <label
                          className={`inline-flex items-center gap-1 select-none ${
                            !gstEnabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
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
                            className={`text-[9px] font-bold ${
                              !gstEnabled || it.gst_enabled === false
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {!gstEnabled || it.gst_enabled === false ? "Off" : "On"}
                          </span>
                        </label>
                      </div>
                      <select
                        value={gstEnabled && it.gst_enabled !== false ? it.gst_rate : 0}
                        disabled={!gstEnabled || it.gst_enabled === false}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, gst_rate: Number(e.target.value) } : x))
                          )
                        }
                        className={`w-full rounded-lg border bg-white px-1.5 py-1.5 text-xs font-semibold text-slate-900 dark:bg-slate-900 dark:text-white ${
                          gstEnabled && it.gst_enabled !== false
                            ? "border-slate-200 dark:border-white/10"
                            : "border-slate-200 bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 opacity-60 cursor-not-allowed"
                        }`}
                        title={
                          !gstEnabled
                            ? "GST calculation is currently disabled for this quotation"
                            : it.gst_enabled === false
                            ? "GST is disabled for this line item"
                            : undefined
                        }
                      >
                        <option value={0}>No GST (0%)</option>
                        <option value={5}>5%</option>
                        <option value={8.9}>8.9%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </div>

                    {/* Delete Row */}
                    <div className="col-span-1 sm:col-span-1 flex justify-end pb-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Line breakdown */}
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-2 text-[11px] text-slate-600 dark:border-white/5 dark:text-slate-400">
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
                        className="flex-1 bg-transparent border-0 border-b border-dashed border-slate-300 py-0.5 text-[11px] focus:border-primary focus:outline-none dark:border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setRichDescModalItemIdx(idx);
                          setRichDescModalText(it.description || "");
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50/80 px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 transition cursor-pointer border border-blue-200/50 dark:border-blue-800/40 shrink-0"
                        title="Open rich text editor for detailed specifications"
                      >
                        <Sparkles className="h-3 w-3" />
                        {/<[a-z][\s\S]*>/i.test(it.description || "") ? "Rich Specs" : "Rich Editor"}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
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
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold ml-1">
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

        {/* Financial Totals Summary Box */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                Grand Total Summary
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Gross Total - Total Discount = Taxable Subtotal + Applicable GST
              </div>
            </div>

            <div className="space-y-1 text-right text-xs">
              {calculations.totalDiscount > 0 ? (
                <>
                  <div className="text-slate-600 dark:text-slate-300">
                    Gross Total: <strong>{formatCurrencyINR(calculations.totalGross)}</strong>
                  </div>
                  <div className="text-amber-600 dark:text-amber-400 font-semibold">
                    Total Discount: <strong>-{formatCurrencyINR(calculations.totalDiscount)}</strong>
                  </div>
                </>
              ) : null}
              <div className="text-slate-600 dark:text-slate-300">
                Taxable Sub Total: <strong>{formatCurrencyINR(calculations.subtotal)}</strong>
              </div>
              <div className="text-slate-600 dark:text-slate-300 flex items-center justify-end gap-1.5">
                <span>Total GST Amount:</span>
                <strong>{formatCurrencyINR(calculations.totalGst)}</strong>
                {!gstEnabled && (
                  <span className="rounded bg-slate-200/80 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Exempt / Off
                  </span>
                )}
              </div>
              {calculations.roundOff !== 0 ? (
                <div className="text-slate-600 dark:text-slate-300">
                  Round Off: <strong>{formatCurrencyINR(calculations.roundOff)}</strong>
                </div>
              ) : null}
              <div className="text-base font-extrabold text-blue-900 dark:text-blue-200 pt-1 border-t border-blue-200 dark:border-blue-900/40">
                Grand Total: {formatCurrencyINR(calculations.grandTotal)}
              </div>
            </div>
          </div>
        </div>

        {/* Sales Representative Section (All Lead Manager Portal Users) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/10">
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                Sales Representative / Sales Person (Internal Use &amp; Order Handover)
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Assign the sales representative responsible for this account from all Lead Manager portal users.
              </p>
            </div>

            {usersList.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Choose Sales Person:
                </label>
                <select
                  value={salesPersonUserId}
                  onChange={(e) => handleSelectSalesPersonUser(e.target.value)}
                  className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="">
                    -- Select Sales Person ({salesUsers.length} Lead Manager users) --
                  </option>
                  {salesUsers.map((u: any) => {
                    const dept = u.department ? getDeptLabel(u.department || "") || u.department : "";
                    const deptLabel = dept ? `[${dept}]` : "";
                    const roleBadge = getLeadManagerPortalRole(u);
                    const roleLabel = roleBadge ? `• ${roleBadge}` : (u.role ? `• ${u.role}` : "");
                    const emailLabel = u.email ? `<${u.email}>` : "";
                    const phoneLabel = u.phone ? `(${u.phone})` : "";
                    return (
                      <option key={u._id} value={u._id}>
                        {u.name || u.email} {deptLabel} {roleLabel} {emailLabel} {phoneLabel}
                      </option>
                    );
                  })}
                </select>
                {salesPersonUserId && (
                  <button
                    type="button"
                    onClick={() => handleSelectSalesPersonUser("")}
                    className="text-[11px] font-semibold text-rose-600 hover:underline dark:text-rose-400 cursor-pointer"
                    title="Clear selected sales person"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Sales Person Name
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Read-only</span>
              </div>
              <input
                type="text"
                readOnly
                value={salesPersonName}
                placeholder="Choose sales person from dropdown..."
                className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-xs text-slate-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 font-bold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Sales Role / Designation
                </label>
                <span className="text-[10px] text-emerald-600 font-bold dark:text-emerald-400">Editable</span>
              </div>
              <input
                type="text"
                value={salesPersonDesignation}
                onChange={(e) => setSalesPersonDesignation(e.target.value)}
                placeholder="e.g. Sales Executive / Account Executive"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Phone / Mobile
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Read-only</span>
              </div>
              <input
                type="text"
                readOnly
                value={salesPersonPhone}
                placeholder="Auto-filled from profile"
                className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-xs text-slate-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Read-only</span>
              </div>
              <input
                type="email"
                readOnly
                value={salesPersonEmail}
                placeholder="Auto-filled from profile"
                className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-xs text-slate-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Signatory & Admin Representative Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/10">
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                Signatory &amp; Admin Representative (Printed on PDF Letterhead)
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Select an authorized signatory from the dropdown. All Lead Manager portal admins are always listed; managers and coordinators from your reporting team are included as well. Signatory details are auto-filled and locked; only designation can be edited.
              </p>
            </div>

            {usersList.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Choose Signatory:
                </label>
                <select
                  value={signatoryUserId}
                  onChange={(e) => handleSelectAdminUser(e.target.value)}
                  className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="">
                    -- Select Authorized Signatory (Required) --
                  </option>
                  {managerUsers.map((u: any) => {
                    const roleBadge = getLeadManagerPortalRole(u);
                    return (
                      <option key={u._id} value={u._id}>
                        {u.name || u.email} {roleBadge ? `(${roleBadge})` : ""} {u.phone ? `• ${u.phone}` : ""}
                      </option>
                    );
                  })}
                </select>
                {signatoryUserId && (
                  <button
                    type="button"
                    onClick={() => handleSelectAdminUser("")}
                    className="text-[11px] font-semibold text-rose-600 hover:underline dark:text-rose-400 cursor-pointer"
                    title="Clear selected signatory"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Signatory Name <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Read-only</span>
              </div>
              <input
                type="text"
                required
                readOnly
                value={signatoryName}
                placeholder="Choose manager signatory from dropdown..."
                className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-xs text-slate-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 font-bold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Designation / Title
                </label>
                <span className="text-[10px] text-blue-600 font-bold dark:text-blue-400">Editable</span>
              </div>
              <input
                type="text"
                value={signatoryDesignation}
                onChange={(e) => setSignatoryDesignation(e.target.value)}
                placeholder="e.g. Authorized Signatory / Lead Manager"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Contact Phone / Mobile
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Read-only</span>
              </div>
              <input
                type="text"
                readOnly
                value={signatoryPhone}
                placeholder="Auto-filled from profile"
                className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-xs text-slate-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Official Email
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Read-only</span>
              </div>
              <input
                type="email"
                readOnly
                value={signatoryEmail}
                placeholder="Auto-filled from profile"
                className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-xs text-slate-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Terms & Conditions Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/10">
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                General Terms &amp; Conditions ({terms.length} Points)
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Select multiple master terms sets or edit individual condition lines printed on official proposals.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {terms.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllTerms}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:border-white/10 dark:bg-slate-800 dark:text-rose-400 cursor-pointer"
                  title="Clear all terms"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear All
                </button>
              )}
              <button
                type="button"
                onClick={handleAddTerm}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 cursor-pointer"
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
            <div className="mt-4 space-y-4">
              {/* Master Terms Sets Multi-Selector Panel */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-blue-600" />
                    Select From Terms &amp; Conditions Master ({masterTermsSets.length} Sets Available)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFilteredSets}
                      className="text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button
                      type="button"
                      onClick={handleClearAllTerms}
                      className="text-[11px] font-semibold text-slate-500 hover:underline dark:text-slate-400 cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Filter & Search Controls */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="relative flex-1 min-w-[200px]">
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
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                          termsTypeFilter === type
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {filteredTermsSets.map((set) => {
                      const status = getSetSelectionStatus(set);
                      const activeLines = getSetLines(set);
                      const isExpanded = expandedSetIds.includes(set._id);

                      return (
                        <div
                          key={set._id}
                          className={`rounded-lg border transition ${
                            status === "all"
                              ? "border-blue-500 bg-white dark:bg-slate-900 shadow-2xs"
                              : status === "partial"
                              ? "border-blue-300 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-950/40"
                              : "border-slate-200 bg-white/70 hover:bg-white dark:border-white/10 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 p-2.5">
                            <button
                              type="button"
                              onClick={() => handleToggleTermsSet(set)}
                              className="flex items-start gap-2 flex-1 text-left cursor-pointer"
                            >
                              <div className="mt-0.5 shrink-0 text-blue-600">
                                {status === "all" ? (
                                  <CheckSquare className="h-4 w-4" />
                                ) : status === "partial" ? (
                                  <div className="h-4 w-4 rounded border border-primary bg-primary flex items-center justify-center text-white">
                                    <Minus className="h-3 w-3 stroke-[3]" />
                                  </div>
                                ) : (
                                  <Square className="h-4 w-4 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                  <span>{set.title}</span>
                                  <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase shrink-0">
                                    {set.type}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {activeLines.length} {activeLines.length === 1 ? "clause" : "clauses"}
                                  {status === "partial" && " • partially selected"}
                                  {status === "all" && " • fully selected"}
                                </div>
                              </div>
                            </button>

                            {activeLines.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleToggleExpandSet(set._id)}
                                className="shrink-0 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title={isExpanded ? "Collapse clauses" : "Expand clauses"}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Expanded Individual Clauses */}
                          {isExpanded && activeLines.length > 0 && (
                            <div className="border-t border-slate-100 bg-slate-50/80 p-2 space-y-1.5 dark:border-white/5 dark:bg-slate-900/70 rounded-b-lg">
                              {activeLines.map((clause, cIdx) => {
                                const isClauseSelected = terms.some((t) => t.trim() === clause);
                                return (
                                  <button
                                    key={cIdx}
                                    type="button"
                                    onClick={() => handleToggleClause(clause)}
                                    className={`w-full flex items-start gap-2 p-1.5 rounded-md text-left text-xs transition cursor-pointer ${
                                      isClauseSelected
                                        ? "bg-blue-100/70 text-blue-900 dark:bg-blue-950/70 dark:text-white font-medium"
                                        : "hover:bg-white text-slate-700 dark:text-white dark:hover:bg-slate-800"
                                    }`}
                                  >
                                    <div className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400">
                                      {isClauseSelected ? (
                                        <CheckSquare className="h-3.5 w-3.5" />
                                      ) : (
                                        <Square className="h-3.5 w-3.5 text-slate-400" />
                                      )}
                                    </div>
                                    <div className="flex-1 text-[11px] leading-snug text-slate-800 dark:text-white">
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

              {/* Individual Condition Lines Editor */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Proposal Condition Clauses ({terms.length} Lines)</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    These clauses will be printed on the official quotation.
                  </span>
                </div>

                {terms.map((term, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 transition focus-within:border-blue-300 dark:border-white/10 dark:bg-slate-800/40"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300 mt-1">
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
                  <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl p-4 dark:border-white/10">
                    No terms and conditions selected. Choose one or multiple master sets above or click &apos;+ Add Condition&apos; to write custom terms.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions Toolbar */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => setShowLivePreviewModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700 shadow-xs hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/60 dark:text-emerald-300 transition-colors cursor-pointer"
            title="View real-time A4 letterhead preview with PREVIEW watermark"
          >
            <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Live Preview (Watermarked)
          </button>

          <div className="flex items-center gap-3">
            <Link
              href={`${portalHome}/quotations`}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              {isCreating || isUpdating
                ? "Saving..."
                : isEditing
                ? (existingQuotation?.status === "draft" ? "Update Quotation (v1)" : `Save Revision (v${(existingQuotation?.version || 1) + 1})`)
                : isCopyMode
                ? "Create Copied Quotation"
                : "Generate Quotation"}
            </button>
          </div>
        </div>
      </form>

      {/* Floating Quick Live Preview Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setShowLivePreviewModal(true)}
          className="inline-flex items-center gap-2.5 rounded-full bg-slate-900 text-white px-5 py-3 text-xs font-bold shadow-xl shadow-slate-900/30 hover:bg-slate-800 dark:bg-primary dark:hover:bg-primary-hover hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/15"
          title="Open watermarked live preview of this quotation"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <Eye className="h-4 w-4 text-emerald-400" />
          <span>Live Preview</span>
          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-black uppercase text-white shadow-xs">
            Preview
          </span>
        </button>
      </div>

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
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Live Quotation Letterhead Preview
                    </h3>
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                      WATERMARKED • PREVIEW
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Real-time draft rendering of #{refNo || autoNextRefNo || "New Proposal"} for {customerName || "Customer"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintPreview}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                  title="Print watermarked preview draft"
                >
                  <Printer className="h-3.5 w-3.5" />
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
            <div className="bg-amber-50 px-6 py-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-b border-amber-100 dark:border-amber-900/30 flex items-center justify-between flex-wrap gap-2">
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
    </div>
  );
}
