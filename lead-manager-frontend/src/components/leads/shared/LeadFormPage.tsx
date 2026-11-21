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
  MapPin,
  Package,
  Layers,
  FileText,
  ExternalLink,
  X,
  Search,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Pencil,
  Lock,
} from "lucide-react";
import {
  useCreateLeadMutation,
  useUpdateLeadMutation,
  useGetLeadQuery,
  useCheckLeadDuplicatesMutation,
  useListLeadSourcesQuery,
  useCreateLeadDepartmentMutation,
  useListUsersQuery,
  useListProductsQuery,
  useListPartiesQuery,
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
  getDeptLabel,
  isSeniorLeadRole,
  canAssignLead,
  canQuickAddProduct,
  DEFAULT_INDUSTRIES,
} from "../leadUtils";
import { useLeadDepartmentOptions } from "../useLeadDepartmentOptions";
import { isAdmin as checkIsAdmin, readSessionFromStorage } from "@/utils/authStorage";
import {
  PartySearchAutocomplete,
  pickParties,
  type PartyItem,
} from "@/components/leads/shared/PartySearchAutocomplete";
import {
  ProductSearchAutocomplete,
  getFieldText,
  type CatalogProduct,
} from "@/components/leads/shared/ProductSearchAutocomplete";
import { PartyDetailModal } from "@/components/portal/shared/parties/modals/PartyDetailModal";
import { ProductDetailModal } from "@/components/portal/shared/products/modals/ProductDetailModal";
import PartyCountryDetailModal from "@/components/portal/shared/parties/modals/PartyCountryDetailModal";
import PartyStateDetailModal from "@/components/portal/shared/parties/modals/PartyStateDetailModal";
import PartyCityDetailModal from "@/components/portal/shared/parties/modals/PartyCityDetailModal";
import { LeadMastersModal } from "@/components/leads/shared/modals/LeadMastersModal";

type Props = {
  mode: "create" | "edit";
  leadId?: string;
  copyFromId?: string;
  portalHome?: string;
};

export { getFieldText };

const CARD_CLASS =
  "rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-slate-900";
const CARD_HEADER_CLASS =
  "flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2.5 dark:border-white/10";
const LABEL_CLASS = "block text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight transition-colors duration-150";
const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-500 placeholder:text-slate-400 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-400";
const SELECT_CLASS =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-500 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-400 disabled:opacity-50";
const LOCKED_INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-slate-200 bg-slate-100/90 px-2.5 py-1.5 text-sm text-emerald-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-emerald-400 font-medium";
const LOCKED_SELECT_CLASS =
  "mt-1 w-full rounded-lg border border-slate-200 bg-slate-100/90 px-2.5 py-1.5 text-sm text-emerald-700 shadow-xs cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-emerald-400 font-medium disabled:opacity-70";

type FieldStatus = "active" | "filled" | "empty";

const getLabelClass = (status: FieldStatus) => {
  const base = "block text-xs font-semibold leading-tight transition-colors duration-150";
  if (status === "active") {
    return `${base} text-blue-600 dark:text-blue-400`;
  }
  if (status === "filled") {
    return `${base} text-emerald-700 dark:text-emerald-400`;
  }
  return `${base} text-slate-500 dark:text-slate-400`;
};

const getInputClass = (status: FieldStatus, isLocked = false, isSelect = false) => {
  if (isLocked) {
    return isSelect ? LOCKED_SELECT_CLASS : LOCKED_INPUT_CLASS;
  }
  const base = "mt-1 w-full rounded-lg px-2.5 py-1.5 text-sm shadow-xs transition-all duration-150 focus:outline-none";
  if (status === "active") {
    return `${base} border-2 border-blue-500 bg-blue-50/20 text-blue-700 font-medium ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-950/25 dark:text-blue-300`;
  }
  if (status === "filled") {
    return `${base} border border-emerald-500/70 bg-emerald-50/15 text-emerald-700 font-medium hover:border-emerald-500 dark:border-emerald-500/60 dark:bg-emerald-950/20 dark:text-emerald-300`;
  }
  return `${base} border border-slate-200 bg-white text-slate-500 placeholder:text-slate-400 hover:border-slate-300 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400 dark:placeholder:text-slate-500 ${isSelect ? "disabled:opacity-50" : ""}`;
};

const renderFieldStatusBadge = (status: FieldStatus, isRequired = false) => {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
        Active
      </span>
    );
  }
  if (status === "filled") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
        <Check className="h-2.5 w-2.5 stroke-[3]" />
        Filled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
      {isRequired ? "Required" : "Optional"}
    </span>
  );
};

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

  // Fetch lead data if edit mode or copy mode
  const { data: existingLead, isLoading: loadingLead } = useGetLeadQuery(
    targetLeadId,
    { skip: !targetLeadId }
  );

  const { data: sourcesData } = useListLeadSourcesQuery();
  const { data: usersData } = useListUsersQuery();
  const { data: productsData, refetch: refetchProducts } = useListProductsQuery({ limit: "100" });
  const { data: partiesData, refetch: refetchParties } = useListPartiesQuery({ limit: "500" });
  const [locallyAddedParties, setLocallyAddedParties] = useState<PartyItem[]>([]);
  const [locallyAddedProducts, setLocallyAddedProducts] = useState<CatalogProduct[]>([]);

  const parties = useMemo(() => {
    const rawList = pickParties(partiesData);
    const merged = [...locallyAddedParties, ...rawList];
    const seen = new Set<string>();
    return merged.filter((p) => {
      const id = String(p._id ?? p.id ?? "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [partiesData, locallyAddedParties]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");

  // Quick Add Modal States
  const [quickPartyModalOpen, setQuickPartyModalOpen] = useState(false);
  const [quickPartyInitialName, setQuickPartyInitialName] = useState("");
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [quickProductModalOpen, setQuickProductModalOpen] = useState(false);
  const [quickProductInitialName, setQuickProductInitialName] = useState("");
  const [quickProductTargetRowIdx, setQuickProductTargetRowIdx] = useState<number | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductRowIdx, setEditingProductRowIdx] = useState<number | null>(null);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [stateModalOpen, setStateModalOpen] = useState(false);
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [leadMastersModalOpen, setLeadMastersModalOpen] = useState(false);

  const selectedParty = useMemo(() => {
    if (!selectedPartyId) return null;
    return parties.find((p) => String(p._id ?? p.id ?? "") === String(selectedPartyId)) || null;
  }, [parties, selectedPartyId]);

  const [createLead, { isLoading: creating }] = useCreateLeadMutation();
  const [updateLead, { isLoading: updating }] = useUpdateLeadMutation();
  const [checkDuplicates] = useCheckLeadDuplicatesMutation();
  const isPartyLocked = Boolean(selectedPartyId);

  // Form State
  const [name, setName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [alternatePhone, setAlternatePhone] = useState<string>("");
  const [gstNo, setGstNo] = useState<string>("");
  const [industry, setIndustry] = useState<string>("");
  const [isCustomIndustry, setIsCustomIndustry] = useState<boolean>(false);
  const [designation, setDesignation] = useState<string>("");

  const [addressLine1, setAddressLine1] = useState<string>("");
  const [addressLine2, setAddressLine2] = useState<string>("");
  const [countryId, setCountryId] = useState<string>("");
  const [country, setCountry] = useState<string>("");
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

  const [source, setSource] = useState<string>("");
  const [priority, setPriority] = useState<LeadPriority | "">("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const { departmentOptions } = useLeadDepartmentOptions(selectedDepartments);
  const [createLeadDepartment, { isLoading: isCreatingDepartment }] = useCreateLeadDepartmentMutation();
  const [quickDeptOpen, setQuickDeptOpen] = useState(false);
  const [quickDeptName, setQuickDeptName] = useState("");
  const [createdBy, setCreatedBy] = useState<string>("");
  const [tagsInput, setTagsInput] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Active / Focused field tracker for human-friendly color guidance
  const [activeField, setActiveField] = useState<string | null>(null);

  const getFieldStatus = (val: unknown, fieldId: string): FieldStatus => {
    if (activeField === fieldId) return "active";
    if (Array.isArray(val)) return val.length > 0 ? "filled" : "empty";
    if (typeof val === "number") return val > 0 ? "filled" : "empty";
    if (typeof val === "string") return val.trim().length > 0 ? "filled" : "empty";
    return Boolean(val) ? "filled" : "empty";
  };

  const [products, setProducts] = useState<LeadProductItem[]>([]);
  const [contacts, setContacts] = useState<LeadContactItem[]>([]);
  const [showAdditionalContacts, setShowAdditionalContacts] = useState<boolean>(false);

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
  const canQuickAdd = canQuickAddProduct(authUser);
  const canAssign = canAssignLead(authUser, portalHome);
  const [primaryAssigneeId, setPrimaryAssigneeId] = useState<string>("");
  const [secondaryAssigneeIds, setSecondaryAssigneeIds] = useState<string[]>([]);
  const [secondarySearch, setSecondarySearch] = useState<string>("");

  const effectivePrimaryId = canAssign
    ? primaryAssigneeId
    : (
      primaryAssigneeId ||
      (typeof existingLead?.assigned_to === "object"
        ? existingLead?.assigned_to?._id
        : existingLead?.assigned_to) ||
      String(authUser?._id || authUser?.id || "")
    );

  const handlePrimaryAssigneeChange = (userId: string) => {
    setPrimaryAssigneeId(userId);
    if (userId) {
      setSecondaryAssigneeIds((prev) => prev.filter((id) => id !== userId));
    }
  };

  const toggleSecondaryAssignee = (userId: string) => {
    if (userId === effectivePrimaryId) return;
    setSecondaryAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

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
        setCountry(b.country || "");
        setCountryId(b.country_id || "");
      }

      setRequirement(existingLead.requirement || "");
      if (existingLead.expected_closing_date) {
        setExpectedClosingDate(existingLead.expected_closing_date.split("T")[0]);
      }

      setSource(existingLead.source || "");
      setPriority(existingLead.priority || "");
      let existingDepts: string[] = [];
      if (Array.isArray(existingLead.departments) && existingLead.departments.length > 0) {
        existingDepts = existingLead.departments.filter(Boolean);
      } else if (existingLead.department) {
        existingDepts = existingLead.department.split(",").map((d) => d.trim()).filter(Boolean);
      }
      setSelectedDepartments(existingDepts);

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

      const rawAssigned = Array.isArray(existingLead.assigned_users)
        ? existingLead.assigned_users
          .map((u: any) => (typeof u === "object" && u !== null ? u._id : String(u)))
          .filter(Boolean)
        : [];
      const explicitPrimary =
        typeof existingLead.assigned_to === "object" && existingLead.assigned_to !== null
          ? existingLead.assigned_to._id || ""
          : typeof existingLead.assigned_to === "string"
            ? existingLead.assigned_to
            : "";
      const resolvedPrimary = isCopyMode && !canAssign
        ? String(authUser?._id || authUser?.id || "")
        : (explicitPrimary || rawAssigned[0] || (!canAssign ? String(authUser?._id || authUser?.id || "") : ""));
      setPrimaryAssigneeId(resolvedPrimary);
      setSecondaryAssigneeIds([...new Set(rawAssigned.filter((id) => id && id !== resolvedPrimary))]);

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
        setShowAdditionalContacts(true);
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
    if (mode === "create" && authUser) {
      if (!createdBy) {
        setCreatedBy(String(authUser._id || authUser.id || ""));
      }
      if (!canAssign && !primaryAssigneeId) {
        setPrimaryAssigneeId(String(authUser._id || authUser.id || ""));
      }
    }
  }, [mode, createdBy, authUser, canAssign, primaryAssigneeId]);

  const allPortalUsers = useMemo(() => {
    const filtered = rawUsers.filter(isUserInLeadManagerPortal);
    return filtered.length > 0 ? filtered : rawUsers;
  }, [rawUsers]);

  const primaryUserDisplay = useMemo(() => {
    if (!effectivePrimaryId) return null;
    return (
      allPortalUsers.find((u) => String(u._id) === String(effectivePrimaryId)) ||
      (String(authUser?._id || authUser?.id || "") === String(effectivePrimaryId) ? authUser : null)
    );
  }, [allPortalUsers, effectivePrimaryId, authUser]);

  const filteredSecondaryUsers = useMemo(() => {
    if (!secondarySearch.trim()) return allPortalUsers;
    const q = secondarySearch.toLowerCase().trim();
    return allPortalUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        String(u.email || "").toLowerCase().includes(q) ||
        String(u.department || "").toLowerCase().includes(q) ||
        getDeptLabel(u.department || "").toLowerCase().includes(q)
    );
  }, [allPortalUsers, secondarySearch]);

  const toggleDepartment = (deptValue: string) => {
    setSelectedDepartments((prev) =>
      prev.includes(deptValue) ? prev.filter((d) => d !== deptValue) : [...prev, deptValue]
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
    let rawList: CatalogProduct[] = [];
    if (Array.isArray(productsData)) rawList = productsData as CatalogProduct[];
    else if (productsData && typeof productsData === "object") {
      if ("items" in productsData && Array.isArray((productsData as { items: unknown }).items)) {
        rawList = (productsData as { items: CatalogProduct[] }).items;
      } else if ("data" in productsData && Array.isArray((productsData as { data: unknown }).data)) {
        rawList = (productsData as { data: CatalogProduct[] }).data;
      }
    }
    const merged = [...locallyAddedProducts, ...rawList];
    const seen = new Set<string>();
    return merged.filter((p) => {
      const id = String(p._id ?? "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [productsData, locallyAddedProducts]);

  // Quick Add Handlers
  const openQuickPartyModal = (initialName = "") => {
    setQuickPartyInitialName(initialName);
    setQuickPartyModalOpen(true);
  };

  const handlePartyCreated = (created: Record<string, unknown>) => {
    const newParty =
      created && typeof created === "object" && "data" in created && created.data && typeof created.data === "object"
        ? (created.data as Record<string, unknown>)
        : created;
    const pId = String(newParty._id ?? newParty.id ?? "");
    if (!pId) return;

    const partyItem = newParty as unknown as PartyItem;
    setLocallyAddedParties((prev) => [partyItem, ...prev]);
    handlePartySelect(partyItem);
  };

  const handlePartyUpdated = (updated: Record<string, unknown>) => {
    const newParty =
      updated && typeof updated === "object" && "data" in updated && updated.data && typeof updated.data === "object"
        ? (updated.data as Record<string, unknown>)
        : updated;
    const pId = String(newParty._id ?? newParty.id ?? editingPartyId ?? "");
    if (!pId) return;

    const partyItem = newParty as unknown as PartyItem;
    setLocallyAddedParties((prev) => [
      partyItem,
      ...prev.filter((p) => String(p._id ?? p.id ?? "") !== pId),
    ]);
    refetchParties();
    handlePartySelect(partyItem);
    setEditingPartyId(null);
  };

  const openQuickProductModal = (targetRowIdx: number | null = null, initialName = "") => {
    if (!canQuickAdd) return;
    setQuickProductTargetRowIdx(targetRowIdx);
    setQuickProductInitialName(initialName);
    setQuickProductModalOpen(true);
  };

  const handleProductCreated = (created: Record<string, unknown>) => {
    const newProd =
      created && typeof created === "object" && "data" in created && created.data && typeof created.data === "object"
        ? (created.data as Record<string, unknown>)
        : created;
    const pId = String(newProd._id ?? newProd.id ?? "");
    if (!pId) return;

    const prodItem: CatalogProduct = {
      _id: pId,
      product_name: newProd.product_name,
      sku: newProd.sku,
      brand: newProd.brand,
      base_price: typeof newProd.base_price === "number" ? newProd.base_price : Number(newProd.base_price || 0),
      unit: newProd.unit,
      product_group: newProd.product_group,
    };

    setLocallyAddedProducts((prev) => [prodItem, ...prev]);

    if (quickProductTargetRowIdx !== null) {
      handleProductSelect(quickProductTargetRowIdx, pId, prodItem);
    } else {
      handleQuickAddProduct(pId, prodItem);
    }
    setQuickProductTargetRowIdx(null);
  };

  const handleProductUpdated = (updated: Record<string, unknown>) => {
    const newProd =
      updated && typeof updated === "object" && "data" in updated && updated.data && typeof updated.data === "object"
        ? (updated.data as Record<string, unknown>)
        : updated;
    const pId = String(newProd._id ?? newProd.id ?? editingProductId ?? "");
    if (!pId) return;

    const prodItem: CatalogProduct = {
      _id: pId,
      product_name: newProd.product_name,
      sku: newProd.sku,
      brand: newProd.brand,
      base_price: typeof newProd.base_price === "number" ? newProd.base_price : Number(newProd.base_price || 0),
      unit: newProd.unit,
      product_group: newProd.product_group,
    };

    setLocallyAddedProducts((prev) => [prodItem, ...prev.filter((p) => String(p._id) !== pId)]);
    refetchProducts();

    const prodName = getFieldText(prodItem.product_name);
    const prodUnit = getFieldText(prodItem.unit);
    setProducts((prev) =>
      prev.map((row, idx) => {
        const rowProdId =
          typeof row.product === "object" && row.product !== null
            ? String((row.product as { _id?: string })._id || "")
            : String(row.product || "");
        if (rowProdId !== pId && idx !== editingProductRowIdx) return row;
        return {
          ...row,
          product: pId,
          product_name: prodName || row.product_name,
          unit: prodUnit || row.unit,
          target_price:
            !row.target_price && prodItem.base_price
              ? prodItem.base_price
              : row.target_price,
        };
      })
    );

    setEditingProductId(null);
    setEditingProductRowIdx(null);
  };

  const handleAddBlankProductRow = () => {
    setProducts((prev) => [
      ...prev,
      {
        product: undefined,
        product_name: "",
        quantity: 1,
        target_price: 0,
        unit: "pcs",
        remarks: "",
      },
    ]);
  };

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
    setShowAdditionalContacts(true);
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
    if (selectedDepartments.length === 0) {
      toast.error("Please select at least one department");
      return;
    }
    if (!source.trim()) {
      toast.error("Lead source is required");
      return;
    }

    const cleanSecondary = secondaryAssigneeIds.filter((id) => id && id !== effectivePrimaryId);
    const assignedUsersPayload = effectivePrimaryId
      ? [effectivePrimaryId, ...cleanSecondary]
      : cleanSecondary;

    const assignmentFields = canAssign
      ? {
        assigned_to: effectivePrimaryId || (mode === "edit" ? null : undefined),
        assigned_users:
          assignedUsersPayload.length > 0
            ? assignedUsersPayload
            : mode === "edit"
              ? []
              : undefined,
      }
      : {
        ...(effectivePrimaryId ? { assigned_to: effectivePrimaryId } : {}),
        assigned_users: assignedUsersPayload,
      };

    const resolvedPartyId = selectedPartyId || "";

    const payload: LeadInputPayload = {
      name: name.trim(),
      department: selectedDepartments.join(", "),
      departments: selectedDepartments,
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
        country: country.trim() || undefined,
        country_id: countryId || undefined,
        state_id: stateId || undefined,
        city_id: cityId || undefined,
      },
      requirement: requirement.trim() || undefined,
      estimated_value: isAdmin ? productsEstimatedTotal : existingLead?.estimated_value,
      expected_closing_date: expectedClosingDate ? expectedClosingDate : undefined,
      source: source.trim(),
      priority: (priority as LeadPriority) || "medium",
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

  // Human-Friendly Form Completion Guide Computations
  const filledContactCount = [name, companyName, phone, email, alternatePhone, designation, industry, gstNo].filter((v) => Boolean(v && v.trim())).length;
  const filledLocationCount = [addressLine1, addressLine2, countryId, stateId, cityId, pincode].filter((v) => Boolean(v && v.trim())).length;
  const filledPipelineCount = [
    selectedDepartments.length > 0,
    Boolean(source && source.trim()),
    Boolean(priority),
    Boolean(expectedClosingDate),
    Boolean(tagsInput && tagsInput.trim()),
    Boolean(createdBy),
    Boolean(primaryAssigneeId || effectivePrimaryId),
  ].filter(Boolean).length;
  const filledProductCount = [Boolean(requirement && requirement.trim()), products.length > 0].filter(Boolean).length;
  const filledNotesCount = notes.trim().length > 0 ? 1 : 0;

  const totalFilled = filledContactCount + filledLocationCount + filledPipelineCount + filledProductCount + filledNotesCount;
  const totalFields = 24;

  const mandatoryChecks = [
    Boolean(name.trim()),
    Boolean(phone.trim() || email.trim()),
    Boolean(country.trim()),
    Boolean(state.trim()),
    Boolean(city.trim()),
    selectedDepartments.length > 0,
    Boolean(source.trim()),
  ];
  const mandatoryCount = mandatoryChecks.filter(Boolean).length;

  const isContactActive = ["name", "companyName", "phone", "email", "alternatePhone", "designation", "industry", "gstNo"].includes(activeField || "");
  const isLocationActive = ["addressLine1", "addressLine2", "country", "state", "city", "pincode"].includes(activeField || "");
  const isPipelineActive = ["source", "priority", "expectedClosingDate", "tagsInput", "createdBy", "primaryAssignee", "departments"].includes(activeField || "");
  const isProductActive = ["requirement", "product"].includes(activeField || "");
  const isNotesActive = activeField === "notes";

  const getActiveFieldLabel = (f: string | null) => {
    switch (f) {
      case "name": return "Contact Name";
      case "companyName": return "Company Name";
      case "phone": return "Phone";
      case "email": return "Email";
      case "alternatePhone": return "Alt Phone";
      case "designation": return "Designation";
      case "industry": return "Industry";
      case "gstNo": return "GSTIN";
      case "addressLine1": return "Address 1";
      case "addressLine2": return "Address 2";
      case "country": return "Country";
      case "state": return "State";
      case "city": return "City";
      case "pincode": return "Pincode";
      case "departments": return "Departments";
      case "source": return "Lead Source";
      case "priority": return "Priority";
      case "expectedClosingDate": return "Closing Date";
      case "tagsInput": return "Tags";
      case "createdBy": return "Created By";
      case "primaryAssignee": return "Primary Assignee";
      case "requirement": return "Requirement";
      case "notes": return "Internal Notes";
      default: return f || "None";
    }
  };

  return (
    <div className="relative space-y-2 pb-4">
      <PortalBusyOverlay active={creating || updating || loadingLead} />

      {/* Header Banner */}
      <div className="relative shrink-0 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2 shadow-xs">
        <div className="relative flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <Link
              href={`${portalHome}/leads`}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex flex-wrap items-baseline gap-x-2.5">
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                {isCopyMode
                  ? `Copy Lead (from #${existingLead?.lead_no || ""})`
                  : mode === "create"
                    ? "Create New Lead"
                    : `Edit Lead #${existingLead?.lead_no}`}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isCopyMode
                  ? `Pre-filled from Lead #${existingLead?.lead_no || ""}. Review and create.`
                  : mode === "create"
                    ? "Fill contact, location, pipeline & requirements in one screen"
                    : "Update lead contact info, requirements and pipeline properties"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mode === "edit" && leadId && (
              <Link
                href={`${portalHome}/leads/new?copy_from=${leadId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                title="Create a copy of this lead"
              >
                <Copy className="h-3.5 w-3.5 text-indigo-500" />
                Copy Lead
              </Link>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={creating || updating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-white shadow-xs transition hover:bg-primary-hover disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {mode === "create" ? (isCopyMode ? "Create Copied Lead" : "Save Lead") : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Duplicate Warning Banner */}
      {dupResult && dupResult.has_duplicates && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                Potential Duplicate Records Detected
              </h4>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                We found matching records with identical phone, email, or company name. You may still proceed if this is a distinct lead.
              </p>

              {dupResult.matching_leads.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    Existing Leads:
                  </span>
                  {dupResult.matching_leads.map((l) => (
                    <Link
                      key={l._id}
                      href={`${portalHome}/leads/${l._id}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white/80 px-2 py-0.5 text-xs font-semibold text-amber-900 hover:bg-white dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    >
                      #{l.lead_no} - {l.name} ({l.status})
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              )}

              {dupResult.matching_parties.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    Existing Customers in Master:
                  </span>
                  {dupResult.matching_parties.map((p) => (
                    <span
                      key={p._id}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white/80 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    >
                      {p.party_name} ({p.mobile || p.email || p.district})
                    </span>
                  ))}
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

      {/* Main Form - Single Screen 2-Column Responsive Layout */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
          {/* LEFT COLUMN: Contact Information & Location Address (6 cols) */}
          <div className="lg:col-span-6 space-y-2">
            {/* Card 1: Lead & Contact Information */}
            <div id="section-lead-contact" className={CARD_CLASS}>
              <div className={CARD_HEADER_CLASS}>
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    1. Lead &amp; Contact Information
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {selectedParty && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      <Building2 className="h-3 w-3" />
                      Party Linked
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    isContactActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                      : filledContactCount > 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-white/10"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      isContactActive ? "bg-blue-500 animate-pulse" : filledContactCount > 0 ? "bg-emerald-500" : "bg-slate-400"
                    }`} />
                    {isContactActive ? "Active" : `${filledContactCount}/8 Filled`}
                  </span>
                </div>
              </div>

              {/* Party Master Search / Autofill Panel */}
              <div className="mb-2 rounded-lg border border-blue-100 bg-blue-50/30 p-2 dark:border-blue-900/30 dark:bg-blue-950/20">
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1">
                    <Search className="h-3.5 w-3.5 text-blue-600" />
                    Party Master (Autofill)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openQuickPartyModal(companyName || "")}
                      className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Quick Add</span>
                    </button>
                    {selectedParty && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingPartyId(selectedPartyId)}
                          title="Update Party in Master"
                          className="inline-flex items-center gap-0.5 rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Update</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePartySelect(null)}
                          className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Unlink
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <PartySearchAutocomplete
                  parties={filteredParties}
                  selectedPartyId={selectedPartyId}
                  onSelect={handlePartySelect}
                  onQuickAdd={openQuickPartyModal}
                />
                {selectedParty && (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5 rounded-md bg-white/80 px-2 py-1 text-xs dark:bg-slate-900/80 border border-blue-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-bold text-slate-900 dark:text-white truncate">{selectedParty.party_name}</span>
                      {selectedParty.party_code && (
                        <span className="font-mono text-[10px] text-slate-500">({selectedParty.party_code})</span>
                      )}
                    </div>
                    {selectedParty.contacts && selectedParty.contacts.length > 1 && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-slate-500">Switch:</span>
                        <select
                          value={name}
                          onChange={(e) => handlePartyContactSwitch(e.target.value)}
                          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs dark:border-white/10 dark:bg-slate-800"
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
                {isPartyLocked && (
                  <div className="mt-1.5 flex items-center justify-between gap-1 rounded bg-blue-100/60 px-2.5 py-1 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Lock className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                      Party &amp; address fields are locked to Master. Click &quot;Update&quot; to modify or &quot;Unlink&quot; to edit freely.
                    </span>
                  </div>
                )}
              </div>

              {/* Main Contact Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(name, "name"))}>
                      Contact Person Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1">
                      {isPartyLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(name, "name"), true)}
                    </div>
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => setActiveField("name")}
                    onBlur={() => setActiveField(null)}
                    readOnly={isPartyLocked}
                    placeholder="e.g. Dr. Rajesh Sharma"
                    className={getInputClass(getFieldStatus(name, "name"), isPartyLocked)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(companyName, "companyName"))}>
                      Company / Organization
                    </label>
                    <div className="flex items-center gap-1">
                      {isPartyLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(companyName, "companyName"), false)}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    onFocus={() => setActiveField("companyName")}
                    onBlur={() => {
                      setActiveField(null);
                      triggerDuplicateCheck();
                    }}
                    readOnly={isPartyLocked}
                    placeholder="e.g. Apollo Hospital / Tech Corp"
                    className={getInputClass(getFieldStatus(companyName, "companyName"), isPartyLocked)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(phone, "phone"))}>
                      Primary Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1">
                      {isPartyLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(phone, "phone"), true)}
                    </div>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onFocus={() => setActiveField("phone")}
                    onBlur={() => {
                      setActiveField(null);
                      triggerDuplicateCheck();
                    }}
                    readOnly={isPartyLocked}
                    placeholder="+91 98765 43210"
                    className={getInputClass(getFieldStatus(phone, "phone"), isPartyLocked)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(email, "email"))}>
                      Email Address
                    </label>
                    <div className="flex items-center gap-1">
                      {isPartyLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(email, "email"), false)}
                    </div>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setActiveField("email")}
                    onBlur={() => {
                      setActiveField(null);
                      triggerDuplicateCheck();
                    }}
                    readOnly={isPartyLocked}
                    placeholder="contact@company.com"
                    className={getInputClass(getFieldStatus(email, "email"), isPartyLocked)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(alternatePhone, "alternatePhone"))}>
                      Alternate Phone
                    </label>
                    <div className="flex items-center gap-1">
                      {isPartyLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(alternatePhone, "alternatePhone"), false)}
                    </div>
                  </div>
                  <input
                    type="tel"
                    value={alternatePhone}
                    onChange={(e) => setAlternatePhone(e.target.value)}
                    onFocus={() => setActiveField("alternatePhone")}
                    onBlur={() => setActiveField(null)}
                    readOnly={isPartyLocked}
                    placeholder="+91 22 1234 5678"
                    className={getInputClass(getFieldStatus(alternatePhone, "alternatePhone"), isPartyLocked)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(designation, "designation"))}>
                      Designation / Role
                    </label>
                    <div className="flex items-center gap-1">
                      {isPartyLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(designation, "designation"), false)}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    onFocus={() => setActiveField("designation")}
                    onBlur={() => setActiveField(null)}
                    readOnly={isPartyLocked}
                    placeholder="e.g. Purchase Head"
                    className={getInputClass(getFieldStatus(designation, "designation"), isPartyLocked)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(industry, "industry"))}>
                      Industry / Domain
                    </label>
                    <div className="flex items-center gap-1.5">
                      {isCustomIndustry ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomIndustry(false);
                            setIndustry("");
                          }}
                          className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                        >
                          Choose from list
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsCustomIndustry(true)}
                          className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                        >
                          +Custom
                        </button>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(industry, "industry"), false)}
                    </div>
                  </div>
                  {isCustomIndustry ? (
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      onFocus={() => setActiveField("industry")}
                      onBlur={() => setActiveField(null)}
                      placeholder="e.g. Healthcare, Manufacturing"
                      autoFocus
                      className={getInputClass(getFieldStatus(industry, "industry"))}
                    />
                  ) : (
                    <select
                      value={industry}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setIsCustomIndustry(true);
                          setIndustry("");
                        } else {
                          setIndustry(e.target.value);
                        }
                      }}
                      onFocus={() => setActiveField("industry")}
                      onBlur={() => setActiveField(null)}
                      className={getInputClass(getFieldStatus(industry, "industry"), false, true)}
                    >
                      <option value="">Select Industry / Domain</option>
                      {DEFAULT_INDUSTRIES.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
                      ))}
                      {industry && !DEFAULT_INDUSTRIES.includes(industry) && (
                        <option value={industry}>{industry}</option>
                      )}
                      <option value="__custom__">+ Enter Custom Industry...</option>
                    </select>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(gstNo, "gstNo"))}>
                      GSTIN / Tax ID
                    </label>
                    <div className="flex items-center gap-1">
                      {isPartyLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(gstNo, "gstNo"), false)}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={gstNo}
                    onChange={(e) => setGstNo(e.target.value.toUpperCase())}
                    onFocus={() => setActiveField("gstNo")}
                    onBlur={() => setActiveField(null)}
                    readOnly={isPartyLocked}
                    placeholder="27AAAAA0000A1Z5"
                    className={isPartyLocked ? LOCKED_INPUT_CLASS : `${getInputClass(getFieldStatus(gstNo, "gstNo"))} font-mono uppercase`}
                  />
                </div>
              </div>

              {/* Collapsible Additional Contacts */}
              <div className="mt-2.5 border-t border-slate-100 pt-2 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowAdditionalContacts((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showAdditionalContacts ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    <span>Additional Contacts ({contacts.length})</span>
                  </button>
                  {!isPartyLocked ? (
                    <button
                      type="button"
                      onClick={handleAddContact}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Contact</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Locked to Master</span>
                  )}
                </div>

                {showAdditionalContacts && contacts.length > 0 && (
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-0.5">
                    {contacts.map((c, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-2 dark:border-white/10 dark:bg-slate-800/40"
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/50 dark:border-white/5">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            #{idx + 1} {c.name || "New Contact"}
                          </span>
                          {!isPartyLocked && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSetAsPrimary(idx)}
                                className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                              >
                                Make Primary
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveContact(idx)}
                                className="text-slate-400 hover:text-rose-600"
                                title="Remove"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          <input
                            type="text"
                            value={c.name}
                            onChange={(e) => handleContactChange(idx, "name", e.target.value)}
                            readOnly={isPartyLocked}
                            placeholder="Full Name"
                            className={isPartyLocked ? "w-full rounded-md border border-slate-200 bg-slate-100/90 px-2.5 py-1 text-xs text-slate-700 cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300" : "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"}
                          />
                          <input
                            type="text"
                            value={c.designation || ""}
                            onChange={(e) => handleContactChange(idx, "designation", e.target.value)}
                            readOnly={isPartyLocked}
                            placeholder="Designation"
                            className={isPartyLocked ? "w-full rounded-md border border-slate-200 bg-slate-100/90 px-2.5 py-1 text-xs text-slate-700 cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300" : "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"}
                          />
                          <input
                            type="tel"
                            value={c.phone || ""}
                            onChange={(e) => handleContactChange(idx, "phone", e.target.value)}
                            readOnly={isPartyLocked}
                            placeholder="Phone"
                            className={isPartyLocked ? "w-full rounded-md border border-slate-200 bg-slate-100/90 px-2.5 py-1 text-xs text-slate-700 cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300" : "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"}
                          />
                          <input
                            type="email"
                            value={c.email || ""}
                            onChange={(e) => handleContactChange(idx, "email", e.target.value)}
                            readOnly={isPartyLocked}
                            placeholder="Email"
                            className={isPartyLocked ? "w-full rounded-md border border-slate-200 bg-slate-100/90 px-2.5 py-1 text-xs text-slate-700 cursor-not-allowed dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300" : "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Location & Address */}
            <div id="section-address-location" className={CARD_CLASS}>
              <div className={CARD_HEADER_CLASS}>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    2. Location &amp; Address
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {isPartyLocked && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    isLocationActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                      : filledLocationCount > 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-white/10"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      isLocationActive ? "bg-blue-500 animate-pulse" : filledLocationCount > 0 ? "bg-emerald-500" : "bg-slate-400"
                    }`} />
                    {isLocationActive ? "Active" : `${filledLocationCount}/6 Filled`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(addressLine1, "addressLine1"))}>
                      Address Line 1
                    </label>
                    <div className="flex items-center gap-1">
                      {isPartyLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(addressLine1, "addressLine1"), false)}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    onFocus={() => setActiveField("addressLine1")}
                    onBlur={() => setActiveField(null)}
                    readOnly={isPartyLocked}
                    placeholder="Plot / Building, Street / Area"
                    className={getInputClass(getFieldStatus(addressLine1, "addressLine1"), isPartyLocked)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(addressLine2, "addressLine2"))}>
                      Address Line 2 (Optional)
                    </label>
                    <div className="flex items-center gap-1">
                      {isPartyLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(addressLine2, "addressLine2"), false)}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    onFocus={() => setActiveField("addressLine2")}
                    onBlur={() => setActiveField(null)}
                    readOnly={isPartyLocked}
                    placeholder="Landmark / Floor"
                    className={getInputClass(getFieldStatus(addressLine2, "addressLine2"), isPartyLocked)}
                  />
                </div>
              </div>

              <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {/* Country */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(countryId, "country"))}>
                      Country <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      {!isPartyLocked && (
                        <button
                          type="button"
                          onClick={() => setCountryModalOpen(true)}
                          className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                        >
                          +Add
                        </button>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(countryId, "country"), true)}
                    </div>
                  </div>
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
                    onFocus={() => setActiveField("country")}
                    onBlur={() => setActiveField(null)}
                    disabled={isPartyLocked || isCountriesLoading}
                    className={getInputClass(getFieldStatus(countryId, "country"), isPartyLocked, true)}
                  >
                    <option value="">{isCountriesLoading ? "..." : "Select Country"}</option>
                    {countriesData.map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* State */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(stateId, "state"))}>
                      State <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      {!isPartyLocked && (
                        <button
                          type="button"
                          onClick={() => setStateModalOpen(true)}
                          disabled={!countryId}
                          className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-40 dark:text-blue-400 cursor-pointer"
                        >
                          +Add
                        </button>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(stateId, "state"), true)}
                    </div>
                  </div>
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
                    onFocus={() => setActiveField("state")}
                    onBlur={() => setActiveField(null)}
                    disabled={isPartyLocked || !countryId || isStatesLoading}
                    className={getInputClass(getFieldStatus(stateId, "state"), isPartyLocked, true)}
                  >
                    <option value="">
                      {!countryId ? "Select Country First" : isStatesLoading ? "..." : "Select State"}
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
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(cityId, "city"))}>
                      City <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      {!isPartyLocked && (
                        <button
                          type="button"
                          onClick={() => setCityModalOpen(true)}
                          disabled={!stateId}
                          className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-40 dark:text-blue-400 cursor-pointer"
                        >
                          +Add
                        </button>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(cityId, "city"), true)}
                    </div>
                  </div>
                  <select
                    value={cityId}
                    onChange={(e) => {
                      const ciId = e.target.value;
                      setCityId(ciId);
                      const matched = citiesData.find((ci) => (ci._id || ci.id) === ciId);
                      setCity(matched?.name || "");
                    }}
                    onFocus={() => setActiveField("city")}
                    onBlur={() => setActiveField(null)}
                    disabled={isPartyLocked || !stateId || isCitiesLoading}
                    className={getInputClass(getFieldStatus(cityId, "city"), isPartyLocked, true)}
                  >
                    <option value="">
                      {!stateId ? "Select State First" : isCitiesLoading ? "..." : "Select City"}
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
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(pincode, "pincode"))}>
                      Pincode
                    </label>
                    <div className="flex items-center gap-1">
                      {isPartyLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                      {renderFieldStatusBadge(getFieldStatus(pincode, "pincode"), false)}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    onFocus={() => setActiveField("pincode")}
                    onBlur={() => setActiveField(null)}
                    readOnly={isPartyLocked}
                    placeholder="e.g. 400001"
                    className={getInputClass(getFieldStatus(pincode, "pincode"), isPartyLocked)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Classification & Pipeline + Products & Requirements + Internal Notes (6 cols) */}
          <div className="lg:col-span-6 space-y-2">
            {/* Card 3: Department & Classification */}
            <div id="section-classification-pipeline" className={CARD_CLASS}>
              <div className={CARD_HEADER_CLASS}>
                <div className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    3. Classification &amp; Pipeline
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    isPipelineActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                      : filledPipelineCount > 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-white/10"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      isPipelineActive ? "bg-blue-500 animate-pulse" : filledPipelineCount > 0 ? "bg-emerald-500" : "bg-slate-400"
                    }`} />
                    {isPipelineActive ? "Active" : `${filledPipelineCount}/7 Filled`}
                  </span>
                </div>
              </div>

              {/* Department Multi-Select Pills */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={getLabelClass(getFieldStatus(selectedDepartments, "departments"))}>
                    Department(s) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickDeptOpen((v) => !v)}
                      className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Quick Add</span>
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    {selectedDepartments.length < departmentOptions.length ? (
                      <button
                        type="button"
                        onClick={() => setSelectedDepartments(departmentOptions.map((d) => d.value))}
                        className="text-xs font-medium text-primary hover:underline cursor-pointer"
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
                    {renderFieldStatusBadge(getFieldStatus(selectedDepartments, "departments"), true)}
                  </div>
                </div>
                {quickDeptOpen && (
                  <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/60 p-2 dark:border-blue-800/60 dark:bg-blue-950/30">
                    <input
                      type="text"
                      value={quickDeptName}
                      onChange={(e) => setQuickDeptName(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const trimmed = quickDeptName.trim();
                          if (!trimmed || isCreatingDepartment) return;
                          try {
                            const created = await createLeadDepartment({ name: trimmed }).unwrap();
                            const deptName = created?.name || trimmed;
                            setSelectedDepartments((prev) =>
                              prev.includes(deptName) ? prev : [...prev, deptName]
                            );
                            setQuickDeptName("");
                            setQuickDeptOpen(false);
                            toast.success(`Department '${deptName}' added`);
                          } catch (err) {
                            toast.error(mutationRejectedMessage(err));
                          }
                        }
                      }}
                      placeholder="New department name..."
                      className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={isCreatingDepartment || !quickDeptName.trim()}
                      onClick={async () => {
                        const trimmed = quickDeptName.trim();
                        if (!trimmed) return;
                        try {
                          const created = await createLeadDepartment({ name: trimmed }).unwrap();
                          const deptName = created?.name || trimmed;
                          setSelectedDepartments((prev) =>
                            prev.includes(deptName) ? prev : [...prev, deptName]
                          );
                          setQuickDeptName("");
                          setQuickDeptOpen(false);
                          toast.success(`Department '${deptName}' added`);
                        } catch (err) {
                          toast.error(mutationRejectedMessage(err));
                        }
                      }}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
                    >
                      {isCreatingDepartment ? "Adding..." : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickDeptOpen(false);
                        setQuickDeptName("");
                      }}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {departmentOptions.map((dept) => {
                    const isSelected = selectedDepartments.includes(dept.value);
                    return (
                      <button
                        key={dept.value}
                        type="button"
                        onClick={() => toggleDepartment(dept.value)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-blue-400"
                        }`}
                      >
                        <span
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm text-[10px] ${
                            isSelected
                              ? "bg-emerald-600 text-white"
                              : "border border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        </span>
                        <span>{dept.label}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedDepartments.length === 0 && (
                  <p className="mt-0.5 text-xs font-medium text-rose-500">
                    Please select at least one department.
                  </p>
                )}
              </div>

              {/* Source, Priority, Expected Date, Tags, Created By */}
              <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(source, "source"))}>
                      Lead Source <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setLeadMastersModalOpen(true)}
                        className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                      >
                        +Add
                      </button>
                      {renderFieldStatusBadge(getFieldStatus(source, "source"), true)}
                    </div>
                  </div>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    onFocus={() => setActiveField("source")}
                    onBlur={() => setActiveField(null)}
                    className={getInputClass(getFieldStatus(source, "source"), false, true)}
                  >
                    <option value="">Select Lead Source</option>
                    {sourcesList.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(priority, "priority"))}>
                      Priority
                    </label>
                    {renderFieldStatusBadge(getFieldStatus(priority, "priority"), false)}
                  </div>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as LeadPriority)}
                    onFocus={() => setActiveField("priority")}
                    onBlur={() => setActiveField(null)}
                    className={getInputClass(getFieldStatus(priority, "priority"), false, true)}
                  >
                    <option value="">Select Priority</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(expectedClosingDate, "expectedClosingDate"))}>
                      Expected Closing Date
                    </label>
                    {renderFieldStatusBadge(getFieldStatus(expectedClosingDate, "expectedClosingDate"), false)}
                  </div>
                  <input
                    type="date"
                    value={expectedClosingDate}
                    onChange={(e) => setExpectedClosingDate(e.target.value)}
                    onFocus={() => setActiveField("expectedClosingDate")}
                    onBlur={() => setActiveField(null)}
                    className={getInputClass(getFieldStatus(expectedClosingDate, "expectedClosingDate"))}
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(tagsInput, "tagsInput"))}>
                      Tags (Comma separated)
                    </label>
                    {renderFieldStatusBadge(getFieldStatus(tagsInput, "tagsInput"), false)}
                  </div>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    onFocus={() => setActiveField("tagsInput")}
                    onBlur={() => setActiveField(null)}
                    placeholder="vip, urgent-tender, solar"
                    className={getInputClass(getFieldStatus(tagsInput, "tagsInput"))}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(createdBy, "createdBy"))}>
                      Created By
                    </label>
                    {renderFieldStatusBadge(getFieldStatus(createdBy, "createdBy"), false)}
                  </div>
                  {isSenior ? (
                    <select
                      value={createdBy}
                      onChange={(e) => setCreatedBy(e.target.value)}
                      onFocus={() => setActiveField("createdBy")}
                      onBlur={() => setActiveField(null)}
                      className={getInputClass(getFieldStatus(createdBy, "createdBy"), false, true)}
                    >
                      <option value="">Select Creator</option>
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
                  ) : (
                    <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-300">
                      <span className="font-semibold truncate">{authUser?.name || "Your Profile"}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">Self</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment Section (Primary & Secondary) */}
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 border-t border-slate-100 pt-2.5 dark:border-white/10">
                {/* Column 1: Primary Assignee */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(effectivePrimaryId, "primaryAssignee"))}>
                      Primary Assignee
                    </label>
                    {canAssign ? (
                      renderFieldStatusBadge(getFieldStatus(primaryAssigneeId, "primaryAssignee"), false)
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                        <Lock className="h-2.5 w-2.5 text-slate-400" />
                        Fixed
                      </span>
                    )}
                  </div>
                  {canAssign ? (
                    <select
                      value={primaryAssigneeId}
                      onChange={(e) => handlePrimaryAssigneeChange(e.target.value)}
                      onFocus={() => setActiveField("primaryAssignee")}
                      onBlur={() => setActiveField(null)}
                      className={getInputClass(getFieldStatus(primaryAssigneeId, "primaryAssignee"), false, true)}
                    >
                      <option value="">Unassigned</option>
                      {allPortalUsers.map((u) => {
                        const isCurrentUser = String(u._id) === String(authUser?._id || authUser?.id);
                        const roleBadge = getLeadManagerPortalRole(u);
                        return (
                          <option key={u._id} value={u._id}>
                            {u.name} {isCurrentUser ? "(You) " : ""}
                            {roleBadge ? `• ${roleBadge}` : ""}
                            {u.department ? ` (${getDeptLabel(u.department)})` : ""}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-300">
                      <span className="font-semibold truncate">
                        {primaryUserDisplay?.name || authUser?.name || "Self (Primary)"}
                        {String(primaryUserDisplay?._id || "") === String(authUser?._id || authUser?.id || "") ? " (You)" : ""}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                        <Lock className="h-3 w-3 text-slate-400" />
                        Primary
                      </span>
                    </div>
                  )}
                </div>

                {/* Column 2: Secondary Assignees */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className={getLabelClass(getFieldStatus(secondaryAssigneeIds, "secondaryAssignee"))}>
                      Secondary Assignees
                      {secondaryAssigneeIds.length > 0 && (
                        <span className="ml-1 font-normal text-slate-400">
                          ({secondaryAssigneeIds.length})
                        </span>
                      )}
                    </label>
                    {secondaryAssigneeIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSecondaryAssigneeIds([])}
                        className="text-xs font-medium text-rose-500 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {allPortalUsers.length > 6 && (
                    <div className="mt-1 mb-1 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-slate-800">
                      <Search className="h-3 w-3 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        value={secondarySearch}
                        onChange={(e) => setSecondarySearch(e.target.value)}
                        placeholder="Filter assignees..."
                        className="w-full bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200"
                      />
                      {secondarySearch && (
                        <button
                          type="button"
                          onClick={() => setSecondarySearch("")}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 space-y-0.5 dark:border-white/10 dark:bg-slate-800">
                    {filteredSecondaryUsers.map((u) => {
                      const uId = String(u._id);
                      const isPrimary = uId === String(effectivePrimaryId);
                      const isSelected = secondaryAssigneeIds.includes(uId);
                      const roleBadge = getLeadManagerPortalRole(u);
                      return (
                        <label
                          key={uId}
                          className={`flex items-center justify-between gap-1.5 rounded px-2 py-1 text-xs transition ${isPrimary
                            ? "opacity-45 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40"
                            : isSelected
                              ? "bg-blue-50 text-blue-700 font-semibold cursor-pointer dark:bg-blue-950/40 dark:text-blue-300"
                              : "text-slate-700 hover:bg-slate-50 cursor-pointer dark:text-slate-300 dark:hover:bg-white/5"
                            }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isPrimary}
                              onChange={() => toggleSecondaryAssignee(uId)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span className="truncate">{u.name}</span>
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {isPrimary ? "Primary" : roleBadge || ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Products & Requirements */}
            <div id="section-products-requirements" className={CARD_CLASS}>
              <div className={CARD_HEADER_CLASS}>
                <div className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    4. Products &amp; Requirements
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    isProductActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                      : filledProductCount > 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-white/10"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      isProductActive ? "bg-blue-500 animate-pulse" : filledProductCount > 0 ? "bg-emerald-500" : "bg-slate-400"
                    }`} />
                    {isProductActive ? "Active" : `${filledProductCount}/2 Filled`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {canQuickAdd && (
                      <button
                        type="button"
                        onClick={() => openQuickProductModal(null, "")}
                        className="inline-flex items-center gap-0.5 rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-100/70 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Quick Add</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddBlankProductRow}
                      className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Item</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Requirement Description */}
              <div>
                <div className="flex items-center justify-between">
                  <label className={getLabelClass(getFieldStatus(requirement, "requirement"))}>
                    Requirement Description
                  </label>
                  {renderFieldStatusBadge(getFieldStatus(requirement, "requirement"), false)}
                </div>
                <input
                  type="text"
                  value={requirement}
                  onChange={(e) => setRequirement(e.target.value)}
                  onFocus={() => setActiveField("requirement")}
                  onBlur={() => setActiveField(null)}
                  placeholder="High-level description of client needs or tender specifications..."
                  className={getInputClass(getFieldStatus(requirement, "requirement"))}
                />
              </div>

              {/* Quick Search & Add from Catalog Bar */}
              <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/30 p-2 dark:border-blue-900/30 dark:bg-blue-950/20">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                  <Search className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Search Catalog &amp; Add Item</span>
                </div>
                <ProductSearchAutocomplete
                  products={catalogProducts}
                  selectedId=""
                  onChange={(id, p) => handleQuickAddProduct(id, p)}
                  onQuickAdd={canQuickAdd ? (searchName) => openQuickProductModal(null, searchName) : undefined}
                  showPrice={isAdmin}
                  placeholder="Type product name, SKU, or brand to add directly..."
                  className="w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 shadow-xs focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </div>

              {/* Product items table */}
              {products.length > 0 && (
                <div className="mt-2 overflow-x-auto max-h-40 overflow-y-auto rounded-lg border border-slate-100 dark:border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 font-bold uppercase text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 min-w-[150px]">Catalog Product</th>
                        <th className="px-2 py-1.5 min-w-[130px]">Item Name</th>
                        <th className="px-2 py-1.5 w-16">Qty</th>
                        {isAdmin && (
                          <>
                            <th className="px-2 py-1.5 w-24">Price (₹)</th>
                            <th className="px-2 py-1.5 w-24 text-right">Total</th>
                          </>
                        )}
                        <th className="px-2 py-1.5 w-16">Unit</th>
                        <th className="px-2 py-1.5 text-right w-16">Actions</th>
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
                            <td className="p-1">
                              <ProductSearchAutocomplete
                                products={catalogProducts}
                                selectedId={selProdId}
                                onChange={(id, p) => handleProductSelect(idx, id, p)}
                                onQuickAdd={canQuickAdd ? (searchName) => openQuickProductModal(idx, searchName) : undefined}
                                showPrice={isAdmin}
                                placeholder="Search..."
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="text"
                                required
                                value={item.product_name}
                                onChange={(e) =>
                                   handleProductChange(idx, "product_name", e.target.value)
                                }
                                placeholder="Item name..."
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                              />
                            </td>
                            <td className="p-1">
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
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                              />
                            </td>
                            {isAdmin && (
                              <>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={item.target_price || ""}
                                    onChange={(e) =>
                                      handleProductChange(idx, "target_price", e.target.value)
                                    }
                                    placeholder="0"
                                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                                  />
                                </td>
                                <td className="p-1 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap text-xs">
                                  {formatCurrencyINR(leadLineValue(item))}
                                </td>
                              </>
                            )}
                            <td className="p-1">
                              <input
                                type="text"
                                value={item.unit || "pcs"}
                                onChange={(e) =>
                                  handleProductChange(idx, "unit", e.target.value)
                                }
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                              />
                            </td>
                            <td className="p-1 text-right">
                              <div className="inline-flex items-center justify-end gap-0.5">
                                {selProdId && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingProductId(selProdId);
                                      setEditingProductRowIdx(idx);
                                    }}
                                    title="Update Product in Master"
                                    className="rounded p-1 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-400 cursor-pointer"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProduct(idx)}
                                  title="Remove item"
                                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary Row */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/50">
                <span>
                  Total Qty: <strong className="text-slate-900 dark:text-white">{products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0).toLocaleString()}</strong> Units
                </span>
                {isAdmin && (
                  <span>
                    Est. Value: <strong className="text-slate-900 dark:text-white">{formatCurrencyINR(productsEstimatedTotal)}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Card 5: Internal Notes */}
            <div id="section-internal-notes" className={CARD_CLASS}>
              <div className={CARD_HEADER_CLASS}>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    5. Internal Notes &amp; Remarks
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    isNotesActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                      : filledNotesCount > 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-white/10"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      isNotesActive ? "bg-blue-500 animate-pulse" : filledNotesCount > 0 ? "bg-emerald-500" : "bg-slate-400"
                    }`} />
                    {isNotesActive ? "Active" : `${filledNotesCount}/1 Filled`}
                  </span>
                </div>
              </div>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onFocus={() => setActiveField("notes")}
                onBlur={() => setActiveField(null)}
                placeholder="Internal comments, previous relationship history, or meeting highlights..."
                className={getInputClass(getFieldStatus(notes, "notes"))}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Link
            href={`${portalHome}/leads`}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={creating || updating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-xs transition hover:bg-primary-hover disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {mode === "create" ? (isCopyMode ? "Create Copied Lead" : "Save Lead") : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Quick Add Party Modal */}
      <PartyDetailModal
        partyId={null}
        create={true}
        open={quickPartyModalOpen}
        initialName={quickPartyInitialName}
        onSuccess={handlePartyCreated}
        onClose={() => {
          setQuickPartyModalOpen(false);
          setQuickPartyInitialName("");
        }}
      />

      {/* Update Party Modal */}
      <PartyDetailModal
        partyId={editingPartyId}
        create={false}
        open={Boolean(editingPartyId)}
        onSuccess={handlePartyUpdated}
        onClose={() => setEditingPartyId(null)}
      />

      {/* Quick Add Product Modal */}
      <ProductDetailModal
        productId={null}
        create={true}
        open={quickProductModalOpen}
        initialName={quickProductInitialName}
        onSuccess={handleProductCreated}
        onClose={() => {
          setQuickProductModalOpen(false);
          setQuickProductInitialName("");
          setQuickProductTargetRowIdx(null);
        }}
      />

      {/* Update Product Modal */}
      <ProductDetailModal
        productId={editingProductId}
        create={false}
        open={Boolean(editingProductId)}
        onSuccess={handleProductUpdated}
        onClose={() => {
          setEditingProductId(null);
          setEditingProductRowIdx(null);
        }}
      />

      {/* Quick Add Country Modal */}
      {countryModalOpen && (
        <PartyCountryDetailModal
          create={true}
          onClose={() => setCountryModalOpen(false)}
          onSuccess={(createdCountry) => {
            const cId = createdCountry._id || createdCountry.id || "";
            if (cId) {
              setCountryId(cId);
              setCountry(createdCountry.name);
              setStateId("");
              setState("");
              setCityId("");
              setCity("");
            }
          }}
        />
      )}

      {/* Quick Add State Modal */}
      {stateModalOpen && (
        <PartyStateDetailModal
          create={true}
          defaultCountryId={countryId}
          defaultCountryName={country}
          onClose={() => setStateModalOpen(false)}
          onSuccess={(createdState) => {
            const sId = createdState._id || createdState.id || "";
            if (sId) {
              setStateId(sId);
              setState(createdState.name);
              setCityId("");
              setCity("");
            }
          }}
        />
      )}

      {/* Quick Add City Modal */}
      {cityModalOpen && (
        <PartyCityDetailModal
          create={true}
          defaultCountryId={countryId}
          defaultStateId={stateId}
          defaultStateName={state}
          onClose={() => setCityModalOpen(false)}
          onSuccess={(createdCity) => {
            const ciId = createdCity._id || createdCity.id || "";
            if (ciId) {
              setCityId(ciId);
              setCity(createdCity.name);
            }
          }}
        />
      )}

      {/* Quick Add Lead Source / Stage Masters Modal */}
      <LeadMastersModal
        isOpen={leadMastersModalOpen}
        onClose={() => setLeadMastersModalOpen(false)}
      />
    </div>
  );
}
