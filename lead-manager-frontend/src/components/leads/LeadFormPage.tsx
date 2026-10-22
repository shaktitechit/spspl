/**
 * @fileoverview Create and Edit Lead Form page with duplicate detection, product requirement builder, and master selects.
 * @module components/portal/shared/leads/LeadFormPage
 */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Package,
  Layers,
  FileText,
  ExternalLink,
  X,
  Search,
  Check,
  Users,
  Copy,
} from "lucide-react";
import {
  useCreateLeadMutation,
  useUpdateLeadMutation,
  useGetLeadQuery,
  useCheckLeadDuplicatesMutation,
  useListLeadSourcesQuery,
  useListUsersQuery,
  useListProductsQuery,
  useListPartiesQuery,
  useCreatePartyMutation,
  usePatchPartyMutation,
  useLazyListPartiesQuery,
  useGetPartyCountriesQuery,
  useGetPartyStatesQuery,
  useGetPartyCitiesQuery,
  type LeadPriority,
  type LeadProductItem,
  type LeadContactItem,
  type LeadInputPayload,
  type DuplicateCheckResult,
} from "@/store/api";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { PortalBusyOverlay } from "@/components/portal/shared/PortalBusyOverlay";
import { useAppSelector } from "@/store/hooks";
import {
  formatCurrencyINR,
  leadLineValue,
  isUserInLeadManagerPortal,
  getLeadManagerPortalRole,
  LEAD_DEPARTMENT_OPTIONS,
  getDeptLabel,
  isSeniorLeadRole,
} from "./leadUtils";
import { isAdmin as checkIsAdmin, readSessionFromStorage } from "@/utils/authStorage";
import {
  PartySearchAutocomplete,
  pickParties,
  type PartyItem,
} from "@/components/leads/PartySearchAutocomplete";
import { syncPartyMaster } from "@/utils/syncPartyMaster";

type Props = {
  mode: "create" | "edit";
  leadId?: string;
  copyFromId?: string;
  portalHome?: string;
};

export function getFieldText(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const candidate =
      obj.name ??
      obj.product_name ??
      obj.brand_name ??
      obj.group_name ??
      obj.title ??
      obj.label ??
      obj.code ??
      obj._id;
    if (candidate !== undefined && candidate !== null && typeof candidate !== "object") {
      return String(candidate);
    }
  }
  return "";
}

type CatalogProduct = {
  _id: string;
  product_name: unknown;
  sku?: unknown;
  brand?: unknown;
  base_price?: number;
  unit?: unknown;
  product_group?: unknown;
};

interface ProductAutocompleteProps {
  products: CatalogProduct[];
  selectedId: string;
  onChange: (id: string, product?: CatalogProduct) => void;
  placeholder?: string;
  className?: string;
  showPrice?: boolean;
}

function ProductAutocomplete({
  products,
  selectedId,
  onChange,
  placeholder = "Search catalog product...",
  className = "w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white",
  showPrice = false,
}: ProductAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProduct = useMemo(() => {
    return products.find((p) => String(p._id) === String(selectedId));
  }, [products, selectedId]);

  useEffect(() => {
    if (selectedProduct) {
      const name = getFieldText(selectedProduct.product_name);
      const skuStr = getFieldText(selectedProduct.sku);
      const sku = skuStr ? ` (${skuStr})` : "";
      setSearch(`${name}${sku}`);
    } else {
      setSearch("");
    }
  }, [selectedProduct]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products.slice(0, 50);
    return products
      .filter((p) => {
        const name = getFieldText(p.product_name).toLowerCase();
        const sku = getFieldText(p.sku).toLowerCase();
        const brand = getFieldText(p.brand).toLowerCase();
        const group = getFieldText(p.product_group).toLowerCase();
        return name.includes(q) || sku.includes(q) || brand.includes(q) || group.includes(q);
      })
      .slice(0, 50);
  }, [products, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (selectedProduct) {
          const name = getFieldText(selectedProduct.product_name);
          const skuStr = getFieldText(selectedProduct.sku);
          const sku = skuStr ? ` (${skuStr})` : "";
          setSearch(`${name}${sku}`);
        } else {
          setSearch("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedProduct]);

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
            }
          }}
          placeholder={placeholder}
          className={`${className} pr-7`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-400 dark:text-slate-500">
          <Search className="h-3.5 w-3.5" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-slate-900">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
              No matching products in catalog
            </div>
          ) : (
            filtered.map((p) => {
              const id = String(p._id);
              const name = getFieldText(p.product_name);
              const skuStr = getFieldText(p.sku);
              const brandStr = getFieldText(p.brand);
              const sku = skuStr ? ` (${skuStr})` : "";
              const brand = brandStr ? ` • ${brandStr}` : "";
              const price = showPrice && p.base_price ? ` • ₹${p.base_price}` : "";
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onChange(id, p);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {name}
                    <span className="font-normal text-slate-500 dark:text-slate-400">
                      {sku}
                      {brand}
                      {price}
                    </span>
                  </div>
                  {String(selectedId) === id && (
                    <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const DEFAULT_SOURCES = [
  "Website",
  "IndiaMART",
  "TradeIndia",
  "Direct Inquiry",
  "Phone Call",
  "Email",
  "Referral",
  "Existing Customer",
  "Sales Executive",
  "Exhibition",
  "Walk-in",
  "Other",
];

export function LeadFormPage({
  mode,
  leadId,
  copyFromId: propCopyFromId,
  portalHome = "/dashboard",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryCopyFromId = searchParams?.get("copy_from") || searchParams?.get("clone") || "";
  const resolvedCopyFromId = propCopyFromId || queryCopyFromId;
  const isCopyMode = mode === "create" && Boolean(resolvedCopyFromId);
  const targetLeadId = mode === "edit" ? (leadId || "") : (isCopyMode ? resolvedCopyFromId : "");

  const reduxUser = useAppSelector((state) => state.auth.user);
  const sessionUser = useMemo(() => readSessionFromStorage()?.user || null, []);
  const authUser = (reduxUser || sessionUser) as any;
  const isAdmin = checkIsAdmin(authUser);
  const isSales = !isAdmin;

  // Fetch lead data if edit mode or copy mode
  const { data: existingLead, isLoading: loadingLead } = useGetLeadQuery(
    targetLeadId,
    { skip: !targetLeadId }
  );

  const { data: sourcesData } = useListLeadSourcesQuery();
  const { data: usersData } = useListUsersQuery();;
  const { data: productsData } = useListProductsQuery({ limit: "100" });
  const { data: partiesData } = useListPartiesQuery({ limit: "500" });
  const parties = useMemo(() => pickParties(partiesData), [partiesData]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");

  const selectedParty = useMemo(() => {
    if (!selectedPartyId) return null;
    return parties.find((p) => String(p._id ?? p.id ?? "") === String(selectedPartyId)) || null;
  }, [parties, selectedPartyId]);

  const [createLead, { isLoading: creating }] = useCreateLeadMutation();
  const [updateLead, { isLoading: updating }] = useUpdateLeadMutation();
  const [checkDuplicates] = useCheckLeadDuplicatesMutation();
  const [createParty] = useCreatePartyMutation();
  const [patchParty] = usePatchPartyMutation();
  const [fetchPartiesTrigger] = useLazyListPartiesQuery();

  // Form State
  const [name, setName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [alternatePhone, setAlternatePhone] = useState<string>("");
  const [gstNo, setGstNo] = useState<string>("");
  const [industry, setIndustry] = useState<string>("");
  const [designation, setDesignation] = useState<string>("");

  const [addressLine1, setAddressLine1] = useState<string>("");
  const [addressLine2, setAddressLine2] = useState<string>("");
  const [countryId, setCountryId] = useState<string>("");
  const [country, setCountry] = useState<string>("India");
  const [stateId, setStateId] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [cityId, setCityId] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [pincode, setPincode] = useState<string>("");

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

  // Match country name to country ID if set by text from lead or party
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

  // Match state name to state ID if set by text from lead or party
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

  // Match city name to city ID if set by text from lead or party
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

  const [requirement, setRequirement] = useState<string>("");
  const [expectedClosingDate, setExpectedClosingDate] = useState<string>("");

  const [source, setSource] = useState<string>("Website");
  const [priority, setPriority] = useState<LeadPriority>("medium");
  const [department, setDepartment] = useState<string>("sales");
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [createdBy, setCreatedBy] = useState<string>("");
  const [tagsInput, setTagsInput] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [products, setProducts] = useState<LeadProductItem[]>([]);
  const [contacts, setContacts] = useState<LeadContactItem[]>([]);

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

  const isSenior = isSeniorLeadRole(authUser);

  // Duplicate Warning State
  const [dupResult, setDupResult] = useState<DuplicateCheckResult | null>(null);

  const copyNotifiedRef = useRef(false);
  useEffect(() => {
    if (isCopyMode && existingLead && !copyNotifiedRef.current) {
      copyNotifiedRef.current = true;
      toast.info(`Pre-filled from Lead #${existingLead.lead_no} for copying`);
    }
  }, [isCopyMode, existingLead]);

  // Populate state on edit or copy
  useEffect(() => {
    if (existingLead && (mode === "edit" || isCopyMode)) {
      setName(existingLead.name || "");
      setCompanyName(existingLead.company_name || "");
      setPhone(existingLead.phone || "");
      setEmail(existingLead.email || "");
      setAlternatePhone(existingLead.alternate_phone || "");
      setIndustry(existingLead.industry || "");
      setDesignation(existingLead.designation || "");

      if (existingLead.billing_address) {
        const b = existingLead.billing_address as any;
        setAddressLine1(b.address_line_1 || "");
        setAddressLine2(b.address_line_2 || "");
        setCity(b.city || "");
        setCityId(b.city_id || "");
        setState(b.state || "");
        setStateId(b.state_id || "");
        setPincode(b.pincode || "");
        setCountry(b.country || "India");
        setCountryId(b.country_id || "");
      }

      setRequirement(existingLead.requirement || "");
      if (existingLead.expected_closing_date) {
        setExpectedClosingDate(existingLead.expected_closing_date.split("T")[0]);
      }

      setSource(existingLead.source || "Website");
      setPriority(existingLead.priority || "medium");
      setDepartment(existingLead.department || "sales");

      if (Array.isArray(existingLead.assigned_users) && existingLead.assigned_users.length > 0) {
        setAssignedUsers(
          existingLead.assigned_users.map((u) => (typeof u === "object" && u !== null ? u._id : String(u)))
        );
      } else if (existingLead.assigned_to) {
        const pId = typeof existingLead.assigned_to === "object" ? existingLead.assigned_to?._id : existingLead.assigned_to;
        setAssignedUsers(pId ? [String(pId)] : []);
      } else {
        setAssignedUsers([]);
      }

      if (isCopyMode) {
        setCreatedBy(String(authUser?._id || authUser?.id || ""));
      } else {
        const existingCreator =
          typeof existingLead.created_by === "object" && existingLead.created_by !== null
            ? existingLead.created_by._id
            : typeof existingLead.created_by === "string"
            ? existingLead.created_by
            : "";
        setCreatedBy(existingCreator || String(authUser?._id || authUser?.id || ""));
      }

      setTagsInput(Array.isArray(existingLead.tags) ? existingLead.tags.join(", ") : "");
      setNotes(existingLead.notes || "");

      if (Array.isArray(existingLead.products) && existingLead.products.length > 0) {
        setProducts(
          existingLead.products.map((p) => {
            const pObj = typeof p.product === "object" && p.product !== null ? (p.product as Record<string, unknown>) : null;
            return {
              product: pObj ? (pObj._id as string) : (typeof p.product === "string" ? p.product : undefined),
              product_name: getFieldText(p.product_name) || (pObj ? getFieldText(pObj.product_name) : "") || "",
              quantity: p.quantity || 1,
              target_price: p.target_price || 0,
              unit: getFieldText(p.unit) || (pObj ? getFieldText(pObj.unit) : "") || "pcs",
              remarks: p.remarks || "",
            };
          })
        );
      }

      const leadPartyId =
        typeof existingLead.party_id === "object" && existingLead.party_id !== null
          ? existingLead.party_id._id || ""
          : typeof existingLead.party_id === "string"
            ? existingLead.party_id
            : "";
      setSelectedPartyId(leadPartyId);
      if (typeof existingLead.party_id === "object" && existingLead.party_id !== null) {
        setGstNo((existingLead.party_id as any).gst_no || (existingLead.party_id as any).gstin || "");
      }

      if (Array.isArray(existingLead.contacts) && existingLead.contacts.length > 0) {
        setContacts(
          existingLead.contacts.map((c) => ({
            _id: c._id,
            name: c.name || "",
            department: c.department || "",
            designation: c.designation || "",
            phone: c.phone || "",
            email: c.email || "",
            alternate_phone: c.alternate_phone || "",
            is_primary: Boolean(c.is_primary),
          }))
        );
      }
    }
  }, [existingLead, mode, isCopyMode]);

  // Duplicate Check Handler
  const triggerDuplicateCheck = async () => {
    if (mode === "edit") return; // Skip in edit mode
    if (!phone && !email && !companyName) return;

    try {
      const res = await checkDuplicates({
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        company_name: companyName.trim() || undefined,
      }).unwrap();

      if (res.has_duplicates) {
        setDupResult(res);
      } else {
        setDupResult(null);
      }
    } catch (_err) {
      // Best effort check
    }
  };

  const rawUsers = useMemo(() => {
    if (Array.isArray(usersData)) return usersData;
    if (usersData && typeof usersData === "object") {
      if ("items" in usersData && Array.isArray((usersData as { items: unknown }).items)) {
        return (usersData as { items: unknown[] }).items;
      }
      if ("data" in usersData && Array.isArray((usersData as { data: unknown }).data)) {
        return (usersData as { data: unknown[] }).data;
      }
      if ("users" in usersData && Array.isArray((usersData as { users: unknown }).users)) {
        return (usersData as { users: unknown[] }).users;
      }
    }
    return [];
  }, [usersData]) as Array<{
    _id: string;
    name: string;
    email?: string;
    department?: string;
    role?: string;
    portals?: Array<{ portal_code: string; access_roles?: string[] }>;
  }>;

  useEffect(() => {
    if (mode === "create" && !createdBy && authUser) {
      setCreatedBy(String(authUser._id || authUser.id || ""));
    }
  }, [mode, createdBy, authUser]);

  const [assignSearch, setAssignSearch] = useState<string>("");

  const allPortalUsers = useMemo(() => {
    const filtered = rawUsers.filter(isUserInLeadManagerPortal);
    return filtered.length > 0 ? filtered : rawUsers;
  }, [rawUsers]);

  const filteredAssignees = useMemo(() => {
    if (!assignSearch.trim()) return allPortalUsers;
    const q = assignSearch.toLowerCase().trim();
    return allPortalUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        String(u.email || "").toLowerCase().includes(q) ||
        String(u.department || "").toLowerCase().includes(q) ||
        getDeptLabel(u.department || "").toLowerCase().includes(q)
    );
  }, [allPortalUsers, assignSearch]);

  const handleDepartmentChange = (newDept: string) => {
    setDepartment(newDept);
  };

  const toggleAssignedUser = (userId: string) => {
    setAssignedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };


  const sourcesList =
    Array.isArray(sourcesData) && sourcesData.length > 0
      ? sourcesData.map((s) => s.name)
      : DEFAULT_SOURCES;

  const productsEstimatedTotal = useMemo(
    () => Math.round(products.reduce((sum, p) => sum + leadLineValue(p), 0) * 100) / 100,
    [products]
  );

  const catalogProducts: CatalogProduct[] = useMemo(() => {
    if (Array.isArray(productsData)) return productsData as CatalogProduct[];
    if (productsData && typeof productsData === "object") {
      if ("items" in productsData && Array.isArray((productsData as { items: unknown }).items)) {
        return (productsData as { items: CatalogProduct[] }).items;
      }
      if ("data" in productsData && Array.isArray((productsData as { data: unknown }).data)) {
        return (productsData as { data: CatalogProduct[] }).data;
      }
    }
    return [];
  }, [productsData]);

  // Product Row Management
  const handleQuickAddProduct = (productId: string, productObj?: CatalogProduct) => {
    const found = productObj || catalogProducts.find((p) => p._id === productId);
    if (!found) return;

    const prodName = getFieldText(found.product_name) || "Untitled Product";
    const prodUnit = getFieldText(found.unit) || "pcs";

    setProducts((prev) => [
      ...prev,
      {
        product: found._id,
        product_name: prodName,
        quantity: 1,
        target_price: isAdmin ? Number(found.base_price || 0) : 0,
        unit: prodUnit,
        remarks: "",
      },
    ]);

    toast.success(`Added "${prodName}" to requirements`);
  };

  const handleProductSelect = (idx: number, productId: string, productObj?: CatalogProduct) => {
    const found = productObj || catalogProducts.find((p) => p._id === productId);
    if (!found) {
      setProducts((prev) => {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          product: undefined,
        };
        return copy;
      });
      return;
    }

    const prodName = getFieldText(found.product_name);
    const prodUnit = getFieldText(found.unit);

    setProducts((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        product: found._id,
        product_name: prodName || copy[idx].product_name,
        target_price: isAdmin ? Number(found.base_price || copy[idx].target_price || 0) : copy[idx].target_price || 0,
        unit: prodUnit || copy[idx].unit || "pcs",
      };
      return copy;
    });
  };

  const handleProductChange = (
    idx: number,
    field: keyof LeadProductItem,
    val: unknown
  ) => {
    setProducts((prev) => {
      const copy = [...prev];
      const nextVal =
        field === "quantity" || field === "target_price" ? Number(val) || 0 : val;
      copy[idx] = { ...copy[idx], [field]: nextVal };
      return copy;
    });
  };

  const handleRemoveProduct = (idx: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddContact = () => {
    setContacts((prev) => [
      ...prev,
      {
        name: "",
        designation: "",
        department: "",
        phone: "",
        email: "",
        alternate_phone: "",
        is_primary: false,
      },
    ]);
  };

  const handleContactChange = (
    idx: number,
    field: keyof LeadContactItem,
    val: unknown
  ) => {
    setContacts((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleRemoveContact = (idx: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSetAsPrimary = (idx: number) => {
    const target = contacts[idx];
    if (!target) return;

    // Save current primary into contacts list, replace primary with clicked contact
    const oldPrimary: LeadContactItem = {
      name: name,
      designation: designation,
      phone: phone,
      email: email,
      alternate_phone: alternatePhone,
      is_primary: false,
    };

    setName(target.name || "");
    setDesignation(target.designation || "");
    setPhone(target.phone || "");
    setEmail(target.email || "");
    setAlternatePhone(target.alternate_phone || "");

    setContacts((prev) => {
      const copy = [...prev];
      if (oldPrimary.name || oldPrimary.phone || oldPrimary.email) {
        copy[idx] = oldPrimary;
      } else {
        copy.splice(idx, 1);
      }
      return copy;
    });

    toast.success(`Set ${target.name || "Contact"} as Primary Contact`);
  };

  const handlePartySelect = (p: PartyItem | null) => {
    if (!p) {
      setSelectedPartyId("");
      return;
    }
    const pId = String(p._id ?? p.id ?? "");
    setSelectedPartyId(pId);
    setCompanyName(p.party_name || "");
    setGstNo(p.gst_no || (p as any).gstin || "");
    const primaryContact = p.contacts && p.contacts.length > 0 ? p.contacts[0] : null;
    setName(p.contact_person || primaryContact?.name || "");
    setPhone(p.mobile || p.phone || primaryContact?.phone || "");
    setAlternatePhone(primaryContact?.alternate_phone || "");
    setEmail(p.email || primaryContact?.email || "");
    setDesignation(primaryContact?.designation || primaryContact?.department || "");

    const pAddr = p.billing_address;
    setAddressLine1(pAddr?.address_line_1 || "");
    setAddressLine2(pAddr?.address_line_2 || "");

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

    if (p.contacts && p.contacts.length > 1) {
      setContacts(
        p.contacts.slice(1).map((c) => ({
          name: c.name || "",
          department: c.department || "",
          designation: c.designation || "",
          phone: c.phone || "",
          email: c.email || "",
          alternate_phone: c.alternate_phone || "",
          is_primary: false,
        }))
      );
    }

    toast.success(`Loaded details from Party Master: "${p.party_name}"`);
  };

  const handlePartyContactSwitch = (contactName: string) => {
    if (!selectedParty?.contacts) return;
    const c = selectedParty.contacts.find((ct) => ct.name === contactName);
    if (c) {
      setName(c.name || "");
      setDesignation(c.designation || c.department || "");
      if (c.phone) setPhone(c.phone);
      if (c.phone || c.alternate_phone) setAlternatePhone(c.alternate_phone || c.phone || "");
      if (c.email) setEmail(c.email);
      toast.info(`Switched primary contact to ${c.name}${c.department ? ` (${c.department})` : ""}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Contact name is required");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      toast.error("Please provide at least a phone number or email address");
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
      toast.error("City / District is required");
      return;
    }

    const assignmentFields = {
      assigned_to: assignedUsers.length > 0 ? assignedUsers[0] : (isSenior ? null : undefined),
      assigned_users: assignedUsers,
    };

    // Sync Party Master (check party master with name, contact, email, gst; create with party_type leads if not exist, or update via party service)
    let resolvedPartyId = selectedPartyId || "";
    try {
      const syncResult = await syncPartyMaster({
        partyType: "leads",
        partyId: selectedPartyId || undefined,
        partyName: companyName.trim() || name.trim(),
        contactPerson: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gst: gstNo.trim(),
        billingAddress: {
          address_line_1: addressLine1.trim() || undefined,
          address_line_2: addressLine2.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          pincode: pincode.trim() || undefined,
          country: country.trim() || "India",
          country_id: countryId || undefined,
          state_id: stateId || undefined,
          city_id: cityId || undefined,
        },
        countryId: countryId || undefined,
        stateId: stateId || undefined,
        cityId: cityId || undefined,
        contacts: contacts.map((c) => ({
          name: c.name.trim(),
          department: c.department?.trim(),
          designation: c.designation?.trim(),
          phone: c.phone?.trim(),
          email: c.email?.trim(),
          alternate_phone: c.alternate_phone?.trim(),
          is_primary: Boolean(c.is_primary),
        })),
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
          toast.success(`New Party Master created with type 'leads': ${syncResult.partyName}`);
        }
      }
    } catch (partyErr) {
      console.warn("Party master sync warning:", partyErr);
    }

    const payload: LeadInputPayload = {
      name: name.trim(),
      department: department.toLowerCase().trim(),
      created_by: isSenior && createdBy ? createdBy : undefined,
      ...(resolvedPartyId
        ? { party_id: resolvedPartyId }
        : mode === "edit"
          ? { party_id: null }
          : {}),
      company_name: companyName.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      alternate_phone: alternatePhone.trim() || undefined,
      industry: industry.trim() || undefined,
      designation: designation.trim() || undefined,
      billing_address: {
        address_line_1: addressLine1.trim() || undefined,
        address_line_2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        pincode: pincode.trim() || undefined,
        country: country.trim() || "India",
        country_id: countryId || undefined,
        state_id: stateId || undefined,
        city_id: cityId || undefined,
      },
      requirement: requirement.trim() || undefined,
      estimated_value: isAdmin ? productsEstimatedTotal : existingLead?.estimated_value,
      expected_closing_date: expectedClosingDate ? expectedClosingDate : undefined,
      source: source.trim(),
      priority,
      ...assignmentFields,
      contacts: contacts
        .filter((c) => c.name?.trim() || c.phone?.trim() || c.email?.trim())
        .map((c) => ({
          name: c.name.trim(),
          department: c.department?.trim() || undefined,
          designation: c.designation?.trim() || undefined,
          phone: c.phone?.trim() || undefined,
          email: c.email?.trim() || undefined,
          alternate_phone: c.alternate_phone?.trim() || undefined,
          is_primary: Boolean(c.is_primary),
        })),
      products: products.filter((p) => p.product_name.trim()),
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: notes.trim() || undefined,
    };

    try {
      if (mode === "create") {
        const created = await createLead(payload).unwrap();
        toast.success(
          isCopyMode
            ? `Lead #${created.lead_no} created successfully (copied from Lead #${existingLead?.lead_no})`
            : `Lead #${created.lead_no} created successfully`
        );
        router.push(`${portalHome}/leads/${created._id}`);
      } else if (leadId) {
        const updated = await updateLead({ id: leadId, body: payload }).unwrap();
        toast.success(`Lead #${updated.lead_no} updated successfully`);
        router.push(`${portalHome}/leads/${updated._id}`);
      }
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  };

  return (
    <div className="relative min-h-screen space-y-6 pb-20">
      <PortalBusyOverlay active={creating || updating || loadingLead} />

      {/* Header Banner */}
      <div className="relative shrink-0 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 shadow-sm">
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`${portalHome}/leads`}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                {isCopyMode
                  ? `Copy Lead (from #${existingLead?.lead_no || ""})`
                  : mode === "create"
                  ? "Create New Lead"
                  : `Edit Lead #${existingLead?.lead_no}`}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isCopyMode
                  ? `Pre-filled from Lead #${existingLead?.lead_no || ""}. Review details and click create.`
                  : mode === "create"
                  ? "Capture sales lead details, requirements, and assign owner"
                  : "Update lead contact info, requirements and pipeline properties"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mode === "edit" && leadId && (
              <Link
                href={`${portalHome}/leads/new?copy_from=${leadId}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                title="Create a copy of this lead"
              >
                <Copy className="h-4 w-4 text-indigo-500" />
                Copy Lead
              </Link>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={creating || updating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {mode === "create" ? (isCopyMode ? "Create Copied Lead" : "Save & Create Lead") : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Duplicate Warning Banner */}
      {dupResult && dupResult.has_duplicates && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                Potential Duplicate Records Detected
              </h4>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                We found matching records with identical phone, email, or company name. You may still proceed if this is a distinct lead.
              </p>

              {dupResult.matching_leads.length > 0 && (
                <div className="mt-2 space-y-1">
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    Existing Leads:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {dupResult.matching_leads.map((l) => (
                      <Link
                        key={l._id}
                        href={`${portalHome}/leads/${l._id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white/80 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-white dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                      >
                        #{l.lead_no} - {l.name} ({l.status})
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {dupResult.matching_parties.length > 0 && (
                <div className="mt-2 space-y-1">
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    Existing Customers in Master:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white/80 px-2 py-1 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    >
                      {dupResult.matching_parties.map((p) => (
                        <span
                          key={p._id}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white/80 px-2 py-1 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                        >
                          {p.party_name} ({p.mobile || p.email || p.district})
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDupResult(null)}
              className="text-amber-500 hover:text-amber-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Form Grid */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/10">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                1. Lead & Contact Information
              </h2>
            </div>
            {selectedParty && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                <Building2 className="h-3 w-3" />
                Party Master Linked
              </span>
            )}
          </div>

          <div className="mt-4 mb-4 rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-blue-600" />
                Search Party Master (Autofill Lead &amp; Contact)
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
            {selectedParty && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 p-2 text-xs dark:bg-slate-900/80 border border-blue-100 dark:border-white/5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">{selectedParty.party_name}</span>
                  {selectedParty.party_code && (
                    <span className="font-mono text-[10px] text-slate-500">({selectedParty.party_code})</span>
                  )}
                  {selectedParty.party_type && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold capitalize dark:bg-slate-800">
                      {selectedParty.party_type}
                    </span>
                  )}
                </div>
                {selectedParty.contacts && selectedParty.contacts.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-500">Switch Contact:</span>
                    <select
                      value={name}
                      onChange={(e) => handlePartyContactSwitch(e.target.value)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs dark:border-white/10 dark:bg-slate-800 cursor-pointer"
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Contact Person Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Rajesh Sharma"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Company / Hospital / Facility
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onBlur={triggerDuplicateCheck}
                placeholder="Apollo Hospital / MediCare Clinic"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Designation / Role
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Medical Superintendent / Purchase Head"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Industry / Domain
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Healthcare, Diagnostics, Pharma..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Primary Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={triggerDuplicateCheck}
                placeholder="+91 98765 43210"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={triggerDuplicateCheck}
                placeholder="contact@hospital.com"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Alternate Phone
              </label>
              <input
                type="tel"
                value={alternatePhone}
                onChange={(e) => setAlternatePhone(e.target.value)}
                placeholder="+91 22 1234 5678"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                GSTIN / Tax ID
              </label>
              <input
                type="text"
                value={gstNo}
                onChange={(e) => setGstNo(e.target.value.toUpperCase())}
                placeholder="27AAAAA0000A1Z5"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono uppercase text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Multiple Additional Contacts Section */}
          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Additional Contact Persons ({contacts.length})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Manage secondary decision makers, purchase managers, department heads, or technical contacts.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddContact}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Contact Person
              </button>
            </div>

            {contacts.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-white/10">
                No additional contacts added. Click &quot;Add Contact Person&quot; to add secondary contacts.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {contacts.map((c, idx) => (
                  <div
                    key={idx}
                    className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all dark:border-white/10 dark:bg-slate-800/30"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Contact Person #{idx + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleSetAsPrimary(idx)}
                          className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                          title="Swap with primary contact above"
                        >
                          Set as Primary
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(idx)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                          title="Remove Contact"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={c.name}
                          onChange={(e) => handleContactChange(idx, "name", e.target.value)}
                          placeholder="Dr. S. Mehta"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Designation / Role
                        </label>
                        <input
                          type="text"
                          value={c.designation || ""}
                          onChange={(e) => handleContactChange(idx, "designation", e.target.value)}
                          placeholder="Head of Radiology"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Department
                        </label>
                        <input
                          type="text"
                          value={c.department || ""}
                          onChange={(e) => handleContactChange(idx, "department", e.target.value)}
                          placeholder="Purchase / Radiology"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={c.phone || ""}
                          onChange={(e) => handleContactChange(idx, "phone", e.target.value)}
                          placeholder="+91 98765 00000"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={c.email || ""}
                          onChange={(e) => handleContactChange(idx, "email", e.target.value)}
                          placeholder="smehta@hospital.com"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Location */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-white/10">
            <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              2. Location & Address
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Address Line 1
              </label>
              <input
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Plot / Building, Street / Area"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Address Line 2 (Optional)
              </label>
              <input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Landmark / Floor"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Country */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white disabled:opacity-50"
              >
                <option value="">{isCountriesLoading ? "Loading countries..." : "Select Country"}</option>
                {countriesData.map((c) => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* State */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white disabled:opacity-50"
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

            {/* City */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white disabled:opacity-50"
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

            {/* Pincode */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Pincode
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="400001"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Product Requirements */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-white/10">
            <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              3. Products & Requirements
            </h2>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Requirement Description
              </label>
              <textarea
                rows={2}
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                placeholder="High-level description of client needs, specifications, or tender details..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Quick Search & Add from Catalog Bar */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 dark:border-blue-900/30 dark:bg-blue-950/20">
              <div className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1.5 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Quick Search & Add Product from Catalog
              </div>
              <ProductAutocomplete
                products={catalogProducts}
                selectedId=""
                onChange={(id, p) => handleQuickAddProduct(id, p)}
                showPrice={isAdmin}
                placeholder="Type product name, SKU, or brand to add directly..."
                className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {/* Product items table */}
            {products.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 font-bold uppercase text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 min-w-[220px]">Catalog Product Search</th>
                      <th className="px-3 py-2 min-w-[180px]">Requirement Item Name</th>
                      <th className="px-3 py-2 w-28">Required Qty</th>
                      {isAdmin && (
                        <>
                          <th className="px-3 py-2 w-32">Target Price (₹)</th>
                          <th className="px-3 py-2 w-32 text-right">Line Total</th>
                        </>
                      )}
                      <th className="px-3 py-2 w-24">Unit</th>
                      <th className="px-3 py-2 text-right w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {products.map((item, idx) => {
                      const selProdId =
                        typeof item.product === "object"
                          ? (item.product as { _id?: string })?._id || ""
                          : item.product || "";
                      return (
                        <tr key={idx}>
                          <td className="p-2">
                            <ProductAutocomplete
                              products={catalogProducts}
                              selectedId={selProdId}
                              onChange={(id, p) => handleProductSelect(idx, id, p)}
                              showPrice={isAdmin}
                              placeholder="Search catalog item..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              required
                              value={item.product_name}
                              onChange={(e) =>
                                handleProductChange(idx, "product_name", e.target.value)
                              }
                              placeholder="Product name..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                handleProductChange(
                                  idx,
                                  "quantity",
                                  Number(e.target.value) || 1
                                )
                              }
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                            />
                          </td>
                          {isAdmin && (
                            <>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.target_price || ""}
                                  onChange={(e) =>
                                    handleProductChange(idx, "target_price", e.target.value)
                                  }
                                  placeholder="0.00"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                                />
                              </td>
                              <td className="p-2 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                {formatCurrencyINR(leadLineValue(item))}
                              </td>
                            </>
                          )}
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.unit || "pcs"}
                              onChange={(e) =>
                                handleProductChange(idx, "unit", e.target.value)
                              }
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(idx)}
                              title="Remove item"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-3" : ""}`}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Total Required Quantity (Auto Sum)
                </label>
                <div className="mt-1.5 flex items-center h-[38px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 dark:border-white/10 dark:bg-slate-800/50 dark:text-white">
                  {products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0).toLocaleString()} Units / Items
                </div>
              </div>

              {isAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Estimated Deal Value (Auto Sum)
                  </label>
                  <div className="mt-1.5 flex items-center h-[38px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 dark:border-white/10 dark:bg-slate-800/50 dark:text-white">
                    {formatCurrencyINR(productsEstimatedTotal)}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Expected Closing Date
                </label>
                <input
                  type="date"
                  value={expectedClosingDate}
                  onChange={(e) => setExpectedClosingDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Management & Ownership */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-white/10">
            <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              4. Lead Management & Assignment
            </h2>
          </div>

          <div className={`mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 ${isSales ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Lead Source <span className="text-rose-500">*</span>
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              >
                {sourcesList.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as LeadPriority)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Department <span className="text-rose-500">*</span>
              </label>
              <select
                value={department}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              >
                {LEAD_DEPARTMENT_OPTIONS.map((dept) => (
                  <option key={dept.value} value={dept.value}>
                    {dept.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned To (Independent of Department) */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Assigned To ({allPortalUsers.length} Lead Manager Users Available)
                </label>
                {assignedUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAssignedUsers([])}
                    className="text-[11px] font-medium text-rose-500 hover:underline"
                  >
                    Clear All ({assignedUsers.length} selected)
                  </button>
                )}
              </div>

              {/* Instant Search Filter */}
              <div className="mt-1.5 relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Search user by name, email or department..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                />
                {assignSearch && (
                  <button
                    type="button"
                    onClick={() => setAssignSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {filteredAssignees.length === 0 ? (
                <div className="mt-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3 text-center text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
                  No Lead Manager portal users found matching your search.
                </div>
              ) : (
                <div className="mt-2 max-h-56 overflow-y-auto space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 dark:border-white/10 dark:bg-slate-800/40">
                  {filteredAssignees.map((u) => {
                    const isSelected = assignedUsers.includes(u._id);
                    const roleBadge = getLeadManagerPortalRole(u);
                    const isCurrentUser = String(u._id) === String(authUser?._id || authUser?.id);
                    const deptLabel = getDeptLabel(u.department || "") || u.department || "General";
                    return (
                      <label
                        key={u._id}
                        className={`flex items-center justify-between gap-2.5 rounded-lg p-2.5 text-xs transition cursor-pointer ${
                          isSelected
                            ? "bg-white dark:bg-slate-700 shadow-xs border border-primary/50 ring-1 ring-primary/20"
                            : "bg-white/70 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-700/70 border border-slate-200/60 dark:border-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleAssignedUser(u._id)}
                            className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-800 dark:text-slate-100">
                                {u.name}
                              </span>
                              {isCurrentUser && (
                                <span className="rounded bg-indigo-50 px-1 py-0.2 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                              {u.email && (
                                <span className="inline-flex items-center gap-1 truncate text-slate-600 dark:text-slate-300">
                                  <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{u.email}</span>
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                <Building2 className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                                Dept: {deptLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                        {roleBadge && (
                          <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            {roleBadge}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Created By: Senior Role Selection vs Executive Self-Lock */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Created By
              </label>
              {isSenior ? (
                <div className="mt-1.5">
                  <select
                    value={createdBy}
                    onChange={(e) => setCreatedBy(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                  >
                    {allPortalUsers.map((u) => {
                      const isCurrentUser = String(u._id) === String(authUser?._id || authUser?.id);
                      const roleBadge = getLeadManagerPortalRole(u);
                      return (
                        <option key={u._id} value={u._id}>
                          {u.name} {isCurrentUser ? "(You) " : ""}{roleBadge ? `• ${roleBadge}` : ""}{u.department ? ` (${getDeptLabel(u.department)})` : ""}
                        </option>
                      );
                    })}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Senior override: You can log this lead on behalf of any Lead Manager portal member.
                  </p>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-300">
                  <span className="font-semibold">{authUser?.name || "Your Profile"}</span>
                  <span className="text-[10px] text-slate-400">Auto-attributed to you</span>
                </div>
              )}
            </div>


            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tags (Comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="vip, urgent-tender, solar"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Notes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-white/10">
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              5. Internal Notes & Remarks
            </h2>
          </div>

          <div className="mt-4">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal comments, previous relationship history, or meeting highlights..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`${portalHome}/leads`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={creating || updating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {mode === "create" ? "Save & Create Lead" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
