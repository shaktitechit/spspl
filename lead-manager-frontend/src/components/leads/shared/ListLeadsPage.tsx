/**
 * @fileoverview Lead Manager List Page with High-Density DataTable, Mobile Card View,
 * Sticky Filter Bar, Slide-Over Filter Drawer, and Floating Bulk Action Dock.
 * @module components/leads/ListLeadsPage
 */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useMemo, useCallback } from "react";
import {
  Plus,
  BarChart3,
  RefreshCw,
  Search,
  Filter,
  SlidersHorizontal,
  UserCheck,
  CalendarPlus,
  Eye,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Building2,
  CheckCircle2,
  MoreVertical,
  X,
  FileSpreadsheet,
  Loader2,
  Copy,
  Calendar,
  Layers,
  MapPin,
  CheckSquare,
  Square,
  Sparkles,
  ChevronRight,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import {
  useListLeadsQuery,
  useLazyListLeadsQuery,
  useListUsersQuery,
  useListLeadSourcesQuery,
  useListProductsQuery,
  useListPartiesQuery,
  useBulkDeleteLeadsMutation,
  type LeadRecord,
  type LeadStatus,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { toast } from "@/lib/toast";
import { TablePaginationBar } from "@/components/portal/shared/pagination/TablePaginationBar";
import { PortalBusyOverlay } from "@/components/portal/shared/PortalBusyOverlay";
import {
  formatLeadAssignees,
  splitLeadAssignees,
  formatCurrencyINR,
  formatLeadDate,
  formatLeadDateTime,
  isFollowUpOverdue,
  isFollowUpToday,
  isLeadAdmin,
  canAssignLead,
  canDeleteLead,
  canViewLeadPricing,
  leadEstimatedValue,
  LEAD_STATUS_CONFIG,
  LEAD_PRIORITY_CONFIG,
  isUserInLeadManagerPortal,
  getLeadManagerPortalRole,
  LEAD_DEPARTMENT_OPTIONS,
  getDeptLabel,
  getLeadDepartments,
} from "../leadUtils";
import { AssignLeadModal } from "./modals/AssignLeadModal";
import { FollowUpModal } from "./modals/FollowUpModal";
import { ConfirmDeleteLeadModal } from "./modals/ConfirmDeleteLeadModal";
import { GoogleSheetLeadsModal } from "./modals/GoogleSheetLeadsModal";
import { DownloadLeadsPreviewModal, type ColumnDef } from "./modals/DownloadLeadsPreviewModal";
import { LeadFilterDrawer, type MultiSelectOption } from "./LeadFilterDrawer";
import { getFieldText } from "./ProductSearchAutocomplete";
import { pickParties } from "./PartySearchAutocomplete";
import { TableSkeletonRows, CardSkeletonFeed } from "@/components/shared/Skeletons";

import { readSessionFromStorage, isManager, isCoordinator } from "@/utils/authStorage";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { useLeadManagerTeamScope } from "@/hooks/useLeadManagerTeamScope";

export type LeadScope = "organisation" | "manager" | "coordinator" | "my";

type Props = {
  portalHome?: string;
  scope?: LeadScope;
};

function getCreatedByName(createdBy: LeadRecord["created_by"], fallback = "—"): string {
  if (typeof createdBy === "object" && createdBy !== null) {
    if (createdBy.name) return createdBy.name;
    if (createdBy.email) return createdBy.email;
  }
  if (typeof createdBy === "string" && createdBy.trim()) {
    return createdBy;
  }
  return fallback;
}

const STATUS_TABS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All Leads" },
  { id: "new", label: "New" },
  { id: "assigned", label: "Assigned" },
  { id: "follow_up", label: "Follow Up" },
  { id: "quotation", label: "Quotation" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
  { id: "converted", label: "Converted" },
];

const DEFAULT_LEAD_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "lead_no", label: "Lead No*", defaultSelected: true, widthPdf: 1.2 },
  { key: "created_at_fmt", label: "Created Date*", defaultSelected: true, widthPdf: 1.2 },
  { key: "company_name", label: "Organization*", defaultSelected: true, widthPdf: 1.6 },
  { key: "name", label: "Contact Person*", defaultSelected: true, widthPdf: 1.5 },
  { key: "departments", label: "Departments*", defaultSelected: true, widthPdf: 1.3 },
  { key: "phone", label: "Phone*", defaultSelected: true, widthPdf: 1.2 },
  { key: "email", label: "Email", defaultSelected: false, widthPdf: 1.4 },
  { key: "city", label: "City", defaultSelected: false, widthPdf: 1 },
  { key: "state", label: "State", defaultSelected: false, widthPdf: 1 },
  { key: "industry", label: "Industry / Domain", defaultSelected: false, widthPdf: 1.3 },
  { key: "source", label: "Source*", defaultSelected: true, widthPdf: 1.2 },
  { key: "status", label: "Status*", defaultSelected: true, widthPdf: 1 },
  { key: "priority", label: "Priority*", defaultSelected: true, widthPdf: 1 },
  { key: "primary_assignee_name", label: "Primary Assignee*", defaultSelected: true, widthPdf: 1.3 },
  { key: "secondary_assignees_name", label: "Secondary Assignees*", defaultSelected: true, widthPdf: 1.4 },
  { key: "requirement_summary", label: "Requirement Summary & Scope*", defaultSelected: true, widthPdf: 2 },
  { key: "required_products", label: "Required Products*", defaultSelected: true, widthPdf: 1.8 },
  { key: "total_quantity", label: "Est. Qty*", defaultSelected: true, widthPdf: 0.9 },
  { key: "estimated_value_fmt", label: "Est. Value (₹)", defaultSelected: true, widthPdf: 1.3 },
  { key: "next_follow_up_at", label: "Next Follow-Up*", defaultSelected: true, widthPdf: 1.2 },
  { key: "last_remarks", label: "Last Remarks*", defaultSelected: true, widthPdf: 2 },
  { key: "created_by_name", label: "Created By*", defaultSelected: true, widthPdf: 1.3 },
];

export function ListLeadsPage({ portalHome = "/dashboard", scope }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduxUser = useAppSelector((state) => state.auth.user);
  const sessionUser = useMemo(() => readSessionFromStorage()?.user || null, []);
  const authUser = (reduxUser || sessionUser) as any;

  const [statusFilter, setStatusFilter] = useState<string[]>(() => {
    const status = searchParams.get("status") || "";
    return status && status !== "all" && STATUS_TABS.some((tab) => tab.id === status)
      ? [status]
      : [];
  });
  const [search, setSearch] = useState<string>("");
  const [contactOrgFilter, setContactOrgFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [industryFilter, setIndustryFilter] = useState<string[]>([]);
  const [primaryAssigneeFilter, setPrimaryAssigneeFilter] = useState<string[]>([]);
  const [secondaryAssigneeFilter, setSecondaryAssigneeFilter] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [createdByFilter, setCreatedByFilter] = useState<string[]>([]);
  const [minQty, setMinQty] = useState<string>("");
  const [maxQty, setMaxQty] = useState<string>("");
  const [minValue, setMinValue] = useState<string>("");
  const [maxValue, setMaxValue] = useState<string>("");
  const [followUpFrom, setFollowUpFrom] = useState<string>("");
  const [followUpTo, setFollowUpTo] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);

  // Filter popup panel toggle
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Bulk Selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkDeleteLeads, { isLoading: isBulkDeleting }] = useBulkDeleteLeadsMutation();

  // Modals state
  const [downloadModalOpen, setDownloadModalOpen] = useState<boolean>(false);
  const [downloadOnlySelected, setDownloadOnlySelected] = useState<boolean>(false);
  const [exportRawLeads, setExportRawLeads] = useState<LeadRecord[] | null>(null);
  const [fetchExportLeads, { isFetching: isExportFetching }] = useLazyListLeadsQuery();
  const [assignTarget, setAssignTarget] = useState<LeadRecord | null>(null);
  const [followUpTarget, setFollowUpTarget] = useState<LeadRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadRecord | null>(null);
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);

  const { data: sources } = useListLeadSourcesQuery();
  const { data: usersData } = useListUsersQuery();
  const { data: catalogProductsData } = useListProductsQuery({ limit: "200" });
  const { data: partiesData } = useListPartiesQuery({ limit: "200" });

  const { isAdmin: isRoleAdmin, isManager: isRoleManager, isCoordinator: isRoleCoord, isExecutive: isRoleExecutive } = useLeadManagerRole();
  const { filterByTeam, withSelfInList } = useLeadManagerTeamScope();

  const isAdmin = scope ? scope === "organisation" : isRoleAdmin || isLeadAdmin(authUser, portalHome);
  const isTeamLead = scope
    ? scope === "manager" || scope === "coordinator"
    : isRoleManager || isRoleCoord || isManager(authUser) || isCoordinator(authUser);
  const isExecutive = scope ? scope === "my" : isRoleExecutive;
  const canFilterRep = isAdmin || isTeamLead;

  const [scopeFilter, setScopeFilter] = useState<"team" | "mine">("team");
  const showPricing = canViewLeadPricing(authUser, portalHome);
  const tableColSpan = showPricing ? 18 : 17;

  const queryArgs = useMemo(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      contact_org: contactOrgFilter.length > 0 ? contactOrgFilter.join(",") : undefined,
      status: statusFilter.length > 0 ? statusFilter.join(",") : undefined,
      priority: priorityFilter.length > 0 ? priorityFilter.join(",") : undefined,
      department: departmentFilter.length > 0 ? departmentFilter.join(",") : undefined,
      source: sourceFilter.length > 0 ? sourceFilter.join(",") : undefined,
      industry: industryFilter.length > 0 ? industryFilter.join(",") : undefined,
      scope: isTeamLead ? scopeFilter : undefined,
      assigned_to:
        canFilterRep && primaryAssigneeFilter.length > 0
          ? primaryAssigneeFilter.join(",")
          : undefined,
      secondary_assignees:
        canFilterRep && secondaryAssigneeFilter.length > 0
          ? secondaryAssigneeFilter.join(",")
          : undefined,
      products: productFilter.length > 0 ? productFilter.join(",") : undefined,
      created_by:
        isAdmin && createdByFilter.length > 0 ? createdByFilter.join(",") : undefined,
      min_qty: minQty !== "" ? minQty : undefined,
      max_qty: maxQty !== "" ? maxQty : undefined,
      min_value: showPricing && minValue !== "" ? minValue : undefined,
      max_value: showPricing && maxValue !== "" ? maxValue : undefined,
      follow_up_from: followUpFrom || undefined,
      follow_up_to: followUpTo || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    }),
    [
      page,
      limit,
      search,
      contactOrgFilter,
      statusFilter,
      priorityFilter,
      departmentFilter,
      sourceFilter,
      industryFilter,
      isTeamLead,
      scopeFilter,
      canFilterRep,
      primaryAssigneeFilter,
      secondaryAssigneeFilter,
      productFilter,
      isAdmin,
      createdByFilter,
      minQty,
      maxQty,
      showPricing,
      minValue,
      maxValue,
      followUpFrom,
      followUpTo,
      fromDate,
      toDate,
    ]
  );

  const {
    data: leadsData,
    isLoading,
    isFetching,
    refetch,
  } = useListLeadsQuery(queryArgs);

  const items = leadsData?.items || [];
  const total = leadsData?.total || 0;
  const totalPages = leadsData?.totalPages || 1;

  const users = (Array.isArray(usersData)
    ? usersData
    : (usersData as { data?: Array<{ _id: string; name: string; department?: string; portals?: Array<{ portal_code: string; access_roles?: string[] }> }> })?.data || []) as Array<{ _id: string; name: string; department?: string; portals?: Array<{ portal_code: string; access_roles?: string[] }> }>;

  const assignableUsers = useMemo(() => {
    let filtered = users.filter(isUserInLeadManagerPortal);
    if (filtered.length === 0) filtered = users;
    if (isAdmin) return filtered;
    const scoped = filterByTeam(filtered);
    const selfRow = authUser?._id ? users.find((u) => String(u._id) === String(authUser._id)) : undefined;
    return withSelfInList(scoped, selfRow);
  }, [users, filterByTeam, withSelfInList, authUser, isAdmin]);

  // Formatted export data
  const formatSingleLeadForExport = useCallback((lead: LeadRecord) => {
    const assignedNames = formatLeadAssignees(lead) || "Unassigned";
    const { primary, secondary } = splitLeadAssignees(lead);
    const primaryAssigneeName = primary?.name || "Unassigned";
    const secondaryAssigneesName =
      secondary.map((u) => u.name).filter(Boolean).join(", ") || "—";
    const requiredProducts =
      Array.isArray(lead.products) && lead.products.length > 0
        ? lead.products
            .map((p: any) => `${p.product_name || p.name || "Item"} (${Number(p.quantity) || 0})`)
            .join(", ")
        : "—";
    const totalQty = Array.isArray(lead.products)
      ? lead.products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)
      : 0;
    const requirementSummary =
      [lead.requirement, lead.notes].filter(Boolean).join(" — ") || "—";
    const lastRemarks = lead.last_action?.remarks
      ? [
          lead.last_action.remarks,
          lead.last_action.timestamp ? formatLeadDate(lead.last_action.timestamp) : "",
          lead.last_action.by_user?.name ? `by ${lead.last_action.by_user.name}` : "",
        ]
          .filter(Boolean)
          .join(" • ")
      : "—";
    const party = lead.party_id;
    const contactName =
      (typeof (lead as any).name === "string" && (lead as any).name) ||
      party?.party_name ||
      (party as any)?.legal_name ||
      "N/A";
    const companyName =
      (lead as any).company_name || party?.party_name || (party as any)?.legal_name || "N/A";
    const phoneVal = (lead as any).phone || party?.mobile || "N/A";
    const emailVal = (lead as any).email || party?.email || "N/A";
    const cityVal = lead.billing_address?.city || (lead as any).city || party?.billing_address?.city || party?.district || "N/A";
    const stateVal = lead.billing_address?.state || (lead as any).state || party?.billing_address?.state || party?.state || "N/A";
    const createdDate = lead.createdAt || (lead as any).created_at;
    const createdByName = getCreatedByName(lead.created_by, "System");

    return {
      _id: lead._id,
      lead_no: lead.lead_no || `LEAD-${lead._id.slice(-6).toUpperCase()}`,
      name: contactName,
      company_name: companyName,
      phone: phoneVal,
      email: emailVal,
      city: cityVal,
      state: stateVal,
      industry: lead.industry || "—",
      source: typeof lead.source === "string" ? lead.source : (lead.source as any)?.name || "Direct",
      status: (lead.status || "new").toUpperCase(),
      priority: (lead.priority || "medium").toUpperCase(),
      department: getLeadDepartments(lead).map(getDeptLabel).join(", ") || getDeptLabel(lead.department || ""),
      departments: getLeadDepartments(lead).map(getDeptLabel).join(", ") || getDeptLabel(lead.department || ""),
      assigned_to_name: assignedNames,
      primary_assignee_name: primaryAssigneeName,
      secondary_assignees_name: secondaryAssigneesName,
      requirement_summary: requirementSummary,
      required_products: requiredProducts,
      total_quantity: totalQty,
      created_by_name: createdByName,
      estimated_value_fmt: lead.estimated_value
        ? `₹${Number(lead.estimated_value).toLocaleString("en-IN")}`
        : "₹0",
      products_summary: requiredProducts,
      next_follow_up_at: lead.next_follow_up_at ? formatLeadDate(lead.next_follow_up_at) : "None",
      last_remarks: lastRemarks,
      created_at_fmt: createdDate ? formatLeadDate(createdDate) : "N/A",
    };
  }, []);

  const formattedLeadsForExport = useMemo(() => {
    const listToFormat = exportRawLeads !== null
      ? exportRawLeads
      : downloadOnlySelected
        ? items.filter((l) => selectedLeadIds.includes(String(l._id)))
        : items;

    return listToFormat.map(formatSingleLeadForExport);
  }, [exportRawLeads, items, downloadOnlySelected, selectedLeadIds, formatSingleLeadForExport]);

  const handleOpenExportAll = async () => {
    try {
      const res = await fetchExportLeads({
        ...queryArgs,
        paginate: "false",
      }).unwrap();
      const allItems = res?.items || [];
      setExportRawLeads(allItems);
      setDownloadOnlySelected(false);
      setDownloadModalOpen(true);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to load all leads for export");
    }
  };

  const handleOpenExportSelected = async () => {
    const selectedInItems = items.filter((l) => selectedLeadIds.includes(String(l._id)));
    if (selectedInItems.length === selectedLeadIds.length) {
      setExportRawLeads(selectedInItems);
      setDownloadOnlySelected(true);
      setDownloadModalOpen(true);
      return;
    }
    try {
      const res = await fetchExportLeads({
        ...queryArgs,
        paginate: "false",
      }).unwrap();
      const allItems = res?.items || [];
      const selected = allItems.filter((l: LeadRecord) => selectedLeadIds.includes(String(l._id)));
      setExportRawLeads(selected);
      setDownloadOnlySelected(true);
      setDownloadModalOpen(true);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to load selected leads for export");
    }
  };

  const contactOrgOptions = useMemo<MultiSelectOption[]>(() => {
    const seen = new Set<string>();
    const opts: MultiSelectOption[] = [];
    const addOpt = (value: string, label: string, sublabel?: string) => {
      const key = value.trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      opts.push({ value: value.trim(), label: label.trim(), sublabel });
    };

    for (const lead of items) {
      if (lead.company_name) {
        addOpt(lead.company_name, lead.company_name, lead.name || undefined);
      } else if (lead.name) {
        addOpt(lead.name, lead.name);
      }
    }

    for (const p of pickParties(partiesData)) {
      if (p.party_name) {
        addOpt(p.party_name, p.party_name, p.contact_person || undefined);
      }
    }

    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [items, partiesData]);

  const productOptions = useMemo<MultiSelectOption[]>(() => {
    const seen = new Set<string>();
    const opts: MultiSelectOption[] = [];
    const addProd = (value: string, label: string, sublabel?: string) => {
      const key = label.trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      opts.push({ value: value.trim(), label: label.trim(), sublabel });
    };

    const rawProducts = Array.isArray(catalogProductsData)
      ? catalogProductsData
      : (catalogProductsData as { items?: any[]; data?: any[] } | undefined)?.items ||
        (catalogProductsData as { data?: any[] } | undefined)?.data ||
        [];
    for (const prod of rawProducts) {
      const name = getFieldText(prod.product_name);
      if (name) {
        addProd(name, name, getFieldText(prod.sku) || undefined);
      }
    }

    for (const lead of items) {
      if (Array.isArray(lead.products)) {
        for (const p of lead.products) {
          if (p.product_name) {
            addProd(p.product_name, p.product_name);
          }
        }
      }
    }

    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [catalogProductsData, items]);

  const clearFilters = () => {
    setSearch("");
    setContactOrgFilter([]);
    setStatusFilter([]);
    setPriorityFilter([]);
    setDepartmentFilter([]);
    setSourceFilter([]);
    setIndustryFilter([]);
    setPrimaryAssigneeFilter([]);
    setSecondaryAssigneeFilter([]);
    setProductFilter([]);
    setCreatedByFilter([]);
    setMinQty("");
    setMaxQty("");
    setMinValue("");
    setMaxValue("");
    setFollowUpFrom("");
    setFollowUpTo("");
    setFromDate("");
    setToDate("");
    setPage(1);
    setSelectedLeadIds([]);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (contactOrgFilter.length > 0) count++;
    if (statusFilter.length > 0) count++;
    if (priorityFilter.length > 0) count++;
    if (departmentFilter.length > 0) count++;
    if (sourceFilter.length > 0) count++;
    if (industryFilter.length > 0) count++;
    if (canFilterRep && primaryAssigneeFilter.length > 0) count++;
    if (canFilterRep && secondaryAssigneeFilter.length > 0) count++;
    if (productFilter.length > 0) count++;
    if (isAdmin && createdByFilter.length > 0) count++;
    if (minQty !== "" || maxQty !== "") count++;
    if (showPricing && (minValue !== "" || maxValue !== "")) count++;
    if (followUpFrom || followUpTo) count++;
    if (fromDate || toDate) count++;
    return count;
  }, [
    search,
    contactOrgFilter,
    statusFilter,
    priorityFilter,
    departmentFilter,
    sourceFilter,
    industryFilter,
    canFilterRep,
    primaryAssigneeFilter,
    secondaryAssigneeFilter,
    productFilter,
    isAdmin,
    createdByFilter,
    minQty,
    maxQty,
    showPricing,
    minValue,
    maxValue,
    followUpFrom,
    followUpTo,
    fromDate,
    toDate,
  ]);

  const hasActiveFilters = activeFilterCount > 0;

  // Selection helpers
  const isAllPageSelected =
    items.length > 0 && items.every((l) => selectedLeadIds.includes(String(l._id)));

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedLeadIds([]);
    } else {
      const pageIds = items.map((l) => String(l._id));
      setSelectedLeadIds(Array.from(new Set([...selectedLeadIds, ...pageIds])));
    }
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (!isAdmin || selectedLeadIds.length === 0) return;
    const confirmMsg = `Are you sure you want to delete ${selectedLeadIds.length} lead${
      selectedLeadIds.length > 1 ? "s" : ""
    }? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await bulkDeleteLeads(selectedLeadIds).unwrap();
      toast.success(`Successfully deleted ${selectedLeadIds.length} leads.`);
      setSelectedLeadIds([]);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete selected leads.");
    }
  };

  return (
    <div className="relative min-h-screen space-y-5 pb-24 font-sans">
      <PortalBusyOverlay active={isFetching && !isLoading} />

      {/* Top Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs transition-colors">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-black tracking-tight text-foreground">
                Lead Pipeline
              </h1>
              <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-primary">
                {isAdmin
                  ? "Global Scope"
                  : isTeamLead
                  ? scopeFilter === "team"
                    ? "Team Scope"
                    : "Personal Scope"
                  : "Personal Scope"}
              </span>
              <span className="text-xs text-muted font-mono tabular-nums">
                ({total} total lead{total !== 1 ? "s" : ""})
              </span>
            </div>
            <p className="mt-1 text-xs text-muted max-w-2xl">
              Track enquiries, assign sales representatives, qualify prospects, and drive sales conversions.
            </p>
          </div>

          {/* Action Toolbar Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold shadow-2xs transition cursor-pointer ${
                hasActiveFilters
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-border bg-card text-foreground hover:bg-surface-muted"
              }`}
              title="Filter leads"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                title="Reset all filters"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-surface-muted transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              disabled={isExportFetching}
              onClick={handleOpenExportAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs hover:bg-emerald-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {isExportFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              <span>{isExportFetching ? "Exporting..." : "Export (.xlsx)"}</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs hover:bg-emerald-500/20 transition cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Google Sheet</span>
              </button>
            )}

            <Link
              href="/dashboard/leads/follow-ups"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-surface-muted transition"
            >
              <CalendarPlus className="h-3.5 w-3.5 text-primary" />
              <span>Follow-ups</span>
            </Link>

            <Link
              href="/dashboard/leads/reports"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-surface-muted transition"
            >
              <BarChart3 className="h-3.5 w-3.5 text-indigo-500" />
              <span className="hidden sm:inline">
                {isAdmin || isTeamLead ? "Reports" : "My Reports"}
              </span>
            </Link>

            <Link
              href={`${portalHome}/leads/new`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-hover transition"
            >
              <Plus className="h-4 w-4" />
              <span>New Lead</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Team / Mine Scope Toggle for Managers & Coordinators */}
      {isTeamLead && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted">Scope:</span>
          <div className="inline-flex items-center gap-1 p-1 bg-surface-muted rounded-xl text-xs font-semibold border border-border">
            <button
              type="button"
              onClick={() => {
                setScopeFilter("team");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                scopeFilter === "team"
                  ? "bg-card text-primary shadow-xs font-bold"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Team Leads (Created or Assigned to Team)
            </button>
            <button
              type="button"
              onClick={() => {
                setScopeFilter("mine");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                scopeFilter === "mine"
                  ? "bg-card text-primary shadow-xs font-bold"
                  : "text-muted hover:text-foreground"
              }`}
            >
              My Leads (Created or Assigned to Me)
            </button>
          </div>
        </div>
      )}

      {/* DUAL-MODE VIEW: High-Density Table on Desktop (lg+), Adaptive Card Feed on Mobile (<lg) */}

      {/* 1. Desktop High-Density Table (lg+) */}
      <div className="hidden lg:block overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="border-b border-border bg-surface-muted/60 font-bold uppercase tracking-wider text-muted text-[11px]">
              <tr>
                <th className="px-3.5 py-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAllPage}
                    className="p-1 text-muted hover:text-foreground cursor-pointer"
                    title={isAllPageSelected ? "Deselect all on page" : "Select all on page"}
                  >
                    {isAllPageSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted/60" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-3 text-left">Actions</th>
                <th className="px-3 py-3">Lead No</th>
                <th className="px-3 py-3">Created</th>
                <th className="px-3.5 py-3">Contact &amp; Organization</th>
                <th className="px-3 py-3">Departments</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3">Primary Assignee</th>
                <th className="px-3 py-3">Secondary Assignees</th>
                <th className="px-3 py-3 min-w-[180px]">Requirement Summary &amp; Scope</th>
                <th className="px-3 py-3 min-w-[170px]">Required Products</th>
                <th className="px-3 py-3 text-center">Est. Qty</th>
                {showPricing && <th className="px-3 py-3 text-right">Est. Value</th>}
                <th className="px-3 py-3">Next Follow-Up</th>
                <th className="px-3 py-3 min-w-[210px]">Last Remarks</th>
                <th className="px-3 py-3">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <TableSkeletonRows rows={8} cols={tableColSpan} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="py-16 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="h-8 w-8 text-muted/50" />
                      <p className="font-bold text-foreground">No leads found matching your criteria.</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                        >
                          Clear active filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((lead) => {
                  const statusCfg = LEAD_STATUS_CONFIG[lead.status];
                  const priorityCfg = LEAD_PRIORITY_CONFIG[lead.priority];
                  const isOverdue = isFollowUpOverdue(lead.next_follow_up_at);
                  const isToday = isFollowUpToday(lead.next_follow_up_at);
                  const isLeadWon = lead.status === "won";
                  const isLeadLost = lead.status === "lost";
                  const isLeadConverted = lead.status === "converted";
                  const isLeadClosed = isLeadWon || isLeadLost || isLeadConverted;
                  const isSelected = selectedLeadIds.includes(String(lead._id));

                  return (
                    <tr
                      key={lead._id}
                      className={`transition-colors hover:bg-surface-muted/40 ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3.5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectLead(String(lead._id))}
                          className="p-1 text-muted hover:text-foreground cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4 text-muted/60" />
                          )}
                        </button>
                      </td>

                      {/* Action Buttons */}
                      <td className="px-3 py-3 text-left whitespace-nowrap">
                        <div className="flex items-center justify-start gap-1">
                          <Link
                            href={`${portalHome}/leads/${lead._id}`}
                            title="View Lead Details"
                            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>

                          {!isLeadClosed && (
                            <Link
                              href={`${portalHome}/leads/${lead._id}/edit`}
                              title="Edit Lead"
                              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          )}

                          <Link
                            href={`${portalHome}/leads/new?copy_from=${lead._id}`}
                            title="Copy Lead as New"
                            className="rounded-lg p-1.5 text-muted hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Link>

                          {!isLeadClosed && (
                            <button
                              type="button"
                              onClick={() => setFollowUpTarget(lead)}
                              title="Schedule Follow-up"
                              className="rounded-lg p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 transition cursor-pointer"
                            >
                              <CalendarPlus className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {!isLeadClosed && canAssignLead(authUser, portalHome) && (
                            <button
                              type="button"
                              onClick={() => setAssignTarget(lead)}
                              title="Assign Lead"
                              className="rounded-lg p-1.5 text-primary hover:bg-primary/10 transition cursor-pointer"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {isAdmin && !isLeadConverted && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(lead)}
                              title="Delete Lead"
                              className="rounded-lg p-1.5 text-muted hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Lead No */}
                      <td className="px-3 py-3 font-bold whitespace-nowrap">
                        <Link
                          href={`${portalHome}/leads/${lead._id}`}
                          className="text-primary hover:underline font-mono text-xs font-bold"
                        >
                          {lead.lead_no}
                        </Link>
                      </td>

                      {/* Created Date */}
                      <td className="px-3 py-3 whitespace-nowrap text-[11px] text-muted font-mono">
                        {formatLeadDate(lead.createdAt)}
                      </td>

                      {/* Contact & Organization */}
                      <td className="px-3.5 py-3 max-w-[220px]">
                        {lead.company_name ? (
                          <>
                            <div className="flex items-center gap-1 font-bold text-foreground truncate">
                              <Building2 className="h-3 w-3 shrink-0 text-muted" />
                              <span className="truncate">{lead.company_name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted truncate mt-0.5">
                              <span className="truncate">{lead.name || "Untitled Lead"}</span>
                              {lead.industry && (
                                <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                                  {lead.industry}
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5 font-bold text-foreground truncate">
                            <span className="truncate">{lead.name || "Untitled Lead"}</span>
                            {lead.industry && (
                              <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                                {lead.industry}
                              </span>
                            )}
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-1 font-mono text-[10px] text-muted mt-1">
                            <Phone className="h-2.5 w-2.5 text-muted" />
                            {lead.phone}
                          </div>
                        )}
                      </td>

                      {/* Departments */}
                      <td className="px-3 py-3">
                        {getLeadDepartments(lead).length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {getLeadDepartments(lead).map((dept) => (
                              <span
                                key={dept}
                                className="rounded-md bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300 whitespace-nowrap"
                              >
                                {getDeptLabel(dept)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted italic">—</span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="rounded-lg bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                          {lead.source}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusCfg?.bg} ${statusCfg?.text} ${statusCfg?.border}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusCfg?.dot}`} />
                          {statusCfg?.label || lead.status}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${priorityCfg?.bg} ${priorityCfg?.text} ${priorityCfg?.border}`}
                        >
                          {priorityCfg?.label || lead.priority}
                        </span>
                      </td>

                      {/* Primary Assignee & Secondary Assignees */}
                      {(() => {
                        const { primary, secondary } = splitLeadAssignees(lead);
                        const secondaryNames = secondary.map((u) => u.name).filter(Boolean);
                        return (
                          <>
                            <td className="px-3 py-3 max-w-[140px]">
                              {primary?.name ? (
                                <span className="text-[11px] font-semibold text-foreground truncate block">
                                  {primary.name}
                                </span>
                              ) : (
                                <span className="text-[11px] italic text-muted">Unassigned</span>
                              )}
                            </td>
                            <td className="px-3 py-3 max-w-[160px]">
                              {secondaryNames.length > 0 ? (
                                <div className="truncate" title={secondaryNames.join(", ")}>
                                  <span className="text-[11px] font-medium text-foreground truncate block">
                                    {secondaryNames.join(", ")}
                                  </span>
                                  {secondaryNames.length > 1 && (
                                    <span className="text-[10px] text-muted">
                                      ({secondaryNames.length} secondary)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted">—</span>
                              )}
                            </td>
                          </>
                        );
                      })()}

                      {/* Requirement Summary & Scope */}
                      <td className="px-3 py-3 max-w-[220px]">
                        {lead.requirement || lead.notes ? (
                          <div className="space-y-0.5" title={[lead.requirement, lead.notes].filter(Boolean).join(" — ")}>
                            {lead.requirement && (
                              <p className="text-[11px] font-medium text-foreground line-clamp-2">
                                {lead.requirement}
                              </p>
                            )}
                            {lead.notes && (
                              <p className="text-[10px] text-muted line-clamp-1">
                                {lead.notes}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted">—</span>
                        )}
                      </td>

                      {/* Required Products (item (qty)) */}
                      <td className="px-3 py-3 max-w-[210px]">
                        {Array.isArray(lead.products) && lead.products.length > 0 ? (
                          <div
                            className="space-y-0.5"
                            title={lead.products
                              .map((p) => `${p.product_name || "Item"} (${Number(p.quantity) || 0})`)
                              .join(", ")}
                          >
                            {lead.products.slice(0, 3).map((p, pIdx) => (
                              <div key={pIdx} className="flex items-center justify-between gap-1.5 text-[11px]">
                                <span className="truncate text-foreground font-medium">
                                  {p.product_name || "Item"}
                                </span>
                                <span className="shrink-0 font-mono text-[10px] font-semibold text-muted">
                                  ({Number(p.quantity) || 0})
                                </span>
                              </div>
                            ))}
                            {lead.products.length > 3 && (
                              <span className="text-[10px] text-primary font-semibold">
                                +{lead.products.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted">—</span>
                        )}
                      </td>

                      {/* Estimated Qty */}
                      <td className="px-3 py-3 whitespace-nowrap text-center font-mono font-bold text-foreground">
                        {(() => {
                          const totalQty = Array.isArray(lead.products)
                            ? lead.products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)
                            : 0;
                          return totalQty > 0 ? (
                            <span>{totalQty.toLocaleString()}</span>
                          ) : (
                            <span className="text-muted font-normal">—</span>
                          );
                        })()}
                      </td>

                      {/* Estimated Value */}
                      {showPricing && (
                        <td className="px-3 py-3 whitespace-nowrap text-right font-mono font-bold text-foreground">
                          {(() => {
                            const value = leadEstimatedValue(lead);
                            return value > 0 ? (
                              formatCurrencyINR(value)
                            ) : (
                              <span className="text-muted font-normal">—</span>
                            );
                          })()}
                        </td>
                      )}

                      {/* Next Follow-Up */}
                      <td className="px-3 py-3 whitespace-nowrap text-[11px]">
                        {lead.next_follow_up_at ? (
                          <span
                            className={`font-semibold ${
                              isOverdue
                                ? "text-rose-600 dark:text-rose-400 font-bold"
                                : isToday
                                ? "text-amber-600 dark:text-amber-400 font-bold"
                                : "text-muted"
                            }`}
                          >
                            {formatLeadDate(lead.next_follow_up_at)}
                            {isOverdue && " (Overdue)"}
                            {isToday && " (Today)"}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Last Action & Remarks */}
                      <td className="px-3 py-3 max-w-[240px]">
                        {lead.last_action?.remarks ? (
                          <div
                            className="space-y-0.5"
                            title={[
                              lead.last_action.remarks,
                              lead.last_action.by_user?.name ? `by ${lead.last_action.by_user.name}` : "",
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          >
                            <p className="text-[11px] text-foreground line-clamp-2">
                              {lead.last_action.remarks}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted">
                              {lead.last_action.timestamp && (
                                <span className="font-mono">
                                  {new Date(lead.last_action.timestamp).toLocaleString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                              {lead.last_action.by_user?.name && (
                                <span className="truncate font-medium text-foreground/80">
                                  • {lead.last_action.by_user.name}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted">—</span>
                        )}
                      </td>

                      {/* Created By */}
                      <td className="px-3 py-3 max-w-[140px]">
                        <span className="text-[11px] font-medium text-foreground truncate block">
                          {getCreatedByName(lead.created_by)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Desktop Pagination */}
        <div className="border-t border-border">
          <TablePaginationBar
            startEntry={total === 0 ? 0 : (page - 1) * limit + 1}
            endEntry={Math.min(page * limit, total)}
            totalEntries={total}
            itemsPerPage={limit}
            onItemsPerPageChange={(val) => {
              setLimit(val);
              setPage(1);
            }}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </div>

      {/* 2. Mobile & Tablet Adaptive Card Feed (< lg) */}
      <div className="block lg:hidden space-y-3">
        {/* Mobile Select All on Page */}
        {items.length > 0 && (
          <div className="flex items-center justify-between px-2 py-1 text-xs text-muted">
            <button
              type="button"
              onClick={toggleSelectAllPage}
              className="flex items-center gap-2 font-semibold text-foreground cursor-pointer"
            >
              {isAllPageSelected ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4 text-muted/60" />
              )}
              <span>Select all on this page ({items.length})</span>
            </button>
            <span className="font-mono text-[11px]">
              Page {page} of {totalPages}
            </span>
          </div>
        )}

        {isLoading ? (
          <CardSkeletonFeed count={4} />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted">
            <Layers className="h-8 w-8 text-muted/50 mx-auto mb-2" />
            <p className="font-bold text-foreground">No leads found matching your criteria.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Clear active filters
              </button>
            )}
          </div>
        ) : (
          items.map((lead) => {
            const statusCfg = LEAD_STATUS_CONFIG[lead.status];
            const priorityCfg = LEAD_PRIORITY_CONFIG[lead.priority];
            const isOverdue = isFollowUpOverdue(lead.next_follow_up_at);
            const isToday = isFollowUpToday(lead.next_follow_up_at);
            const isLeadWon = lead.status === "won";
            const isLeadLost = lead.status === "lost";
            const isLeadConverted = lead.status === "converted";
            const isLeadClosed = isLeadWon || isLeadLost || isLeadConverted;
            const isSelected = selectedLeadIds.includes(String(lead._id));
            const estVal = leadEstimatedValue(lead);

            return (
              <div
                key={lead._id}
                className={`rounded-2xl border bg-card p-4 shadow-xs transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {/* Card Top: Checkbox, Lead No & Badges */}
                <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSelectLead(String(lead._id))}
                      className="text-muted hover:text-foreground cursor-pointer p-0.5"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted/60" />
                      )}
                    </button>

                    <Link
                      href={`${portalHome}/leads/${lead._id}`}
                      className="font-mono text-xs font-bold text-primary hover:underline"
                    >
                      {lead.lead_no}
                    </Link>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusCfg?.bg} ${statusCfg?.text} ${statusCfg?.border}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusCfg?.dot}`} />
                      {statusCfg?.label || lead.status}
                    </span>

                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold ${priorityCfg?.bg} ${priorityCfg?.text} ${priorityCfg?.border}`}
                    >
                      {priorityCfg?.label || lead.priority}
                    </span>
                  </div>
                </div>

                {/* Card Body: Contact, Company, Dept, Phone & Mail */}
                <div className="py-3 space-y-2">
                  <Link href={`${portalHome}/leads/${lead._id}`} className="block group">
                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition truncate">
                      {lead.name || "Untitled Lead"}
                    </h3>
                    {(lead.company_name || lead.industry) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5 truncate">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        {lead.company_name && <span className="truncate">{lead.company_name}</span>}
                        {lead.company_name && lead.industry && <span>•</span>}
                        {lead.industry && (
                          <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                            {lead.industry}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>

                  {/* Contact Chips with touch-friendly links */}
                  <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-muted/60 px-2.5 py-1 text-[11px] font-semibold text-foreground hover:border-primary/40 transition"
                      >
                        <Phone className="h-3 w-3 text-primary" />
                        <span className="font-mono">{lead.phone}</span>
                      </a>
                    )}
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-muted/60 px-2.5 py-1 text-[11px] text-muted hover:text-foreground transition truncate max-w-[180px]"
                      >
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{lead.email}</span>
                      </a>
                    )}
                    {getLeadDepartments(lead).length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center">
                        {getLeadDepartments(lead).map((dept) => (
                          <span
                            key={dept}
                            className="rounded-lg bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-muted"
                          >
                            {getDeptLabel(dept)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Metrics Row: Assigned To, Next Follow-Up & Value */}
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-muted/40 p-2.5 text-xs mt-2 border border-border/50">
                    <div>
                      <span className="text-[10px] text-muted uppercase font-bold block">
                        Assigned To
                      </span>
                      <span className="font-semibold text-foreground text-xs truncate block mt-0.5">
                        {lead.assigned_users && lead.assigned_users.length > 0
                          ? lead.assigned_users.map((u) => u.name).filter(Boolean).join(", ")
                          : lead.assigned_to?.name || "Unassigned"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted uppercase font-bold block">
                        Est. Value
                      </span>
                      <span className="font-mono font-bold text-foreground text-xs block mt-0.5">
                        {showPricing && estVal > 0 ? formatCurrencyINR(estVal) : "—"}
                      </span>
                    </div>

                    {lead.next_follow_up_at && (
                      <div className="col-span-2 border-t border-border/50 pt-1.5 mt-1">
                        <span className="text-[10px] text-muted uppercase font-bold block">
                          Next Follow-Up
                        </span>
                        <span
                          className={`text-xs font-semibold mt-0.5 block ${
                            isOverdue
                              ? "text-rose-600 dark:text-rose-400 font-bold"
                              : isToday
                              ? "text-amber-600 dark:text-amber-400 font-bold"
                              : "text-foreground"
                          }`}
                        >
                          {formatLeadDate(lead.next_follow_up_at)}
                          {isOverdue && " (⚠️ Overdue)"}
                          {isToday && " (📅 Due Today)"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Action Buttons */}
                <div className="flex items-center justify-between border-t border-border/60 pt-3 gap-2">
                  <Link
                    href={`${portalHome}/leads/${lead._id}`}
                    className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-surface-muted py-2 text-xs font-bold text-foreground hover:bg-primary hover:text-white transition"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View Lead</span>
                  </Link>

                  {!isLeadClosed && (
                    <button
                      type="button"
                      onClick={() => setFollowUpTarget(lead)}
                      className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                      title="Add Follow-up"
                    >
                      <CalendarPlus className="h-4 w-4" />
                    </button>
                  )}

                  {!isLeadClosed && canAssignLead(authUser, portalHome) && (
                    <button
                      type="button"
                      onClick={() => setAssignTarget(lead)}
                      className="rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary hover:bg-primary/20 transition cursor-pointer"
                      title="Assign Lead"
                    >
                      <UserCheck className="h-4 w-4" />
                    </button>
                  )}

                  {!isLeadClosed && (
                    <Link
                      href={`${portalHome}/leads/${lead._id}/edit`}
                      className="rounded-xl border border-border bg-card p-2 text-muted hover:text-foreground hover:bg-surface-muted transition"
                      title="Edit Lead"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Pagination */}
        <div className="rounded-2xl border border-border bg-card p-3 shadow-xs">
          <TablePaginationBar
            startEntry={total === 0 ? 0 : (page - 1) * limit + 1}
            endEntry={Math.min(page * limit, total)}
            totalEntries={total}
            itemsPerPage={limit}
            onItemsPerPageChange={(val) => {
              setLimit(val);
              setPage(1);
            }}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </div>

      {/* FLOATING BULK ACTIONS DOCK */}
      {selectedLeadIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 sm:gap-3 rounded-2xl border border-border/90 bg-card/95 px-4 py-2.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 pr-2 border-r border-border">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {selectedLeadIds.length}
              </span>
              <span className="text-xs font-bold text-foreground hidden sm:inline">
                Leads Selected
              </span>
            </div>

            {/* Export Selected */}
            <button
              type="button"
              disabled={isExportFetching}
              onClick={handleOpenExportSelected}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {isExportFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              <span>{isExportFetching ? "Loading..." : "Export"}</span>
            </button>

            {/* Bulk Delete (Admin only) */}
            {isAdmin && (
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            )}

            {/* Deselect All */}
            <button
              type="button"
              onClick={() => setSelectedLeadIds([])}
              className="rounded-xl p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              title="Deselect all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* TOP HORIZONTAL FILTER POPUP PANEL */}
      <LeadFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        search={search}
        setSearch={(val) => {
          setSearch(val);
          setPage(1);
        }}
        contactOrgFilter={contactOrgFilter}
        setContactOrgFilter={(val) => {
          setContactOrgFilter(val);
          setPage(1);
        }}
        departmentFilter={departmentFilter}
        setDepartmentFilter={(val) => {
          setDepartmentFilter(val);
          setPage(1);
        }}
        sourceFilter={sourceFilter}
        setSourceFilter={(val) => {
          setSourceFilter(val);
          setPage(1);
        }}
        industryFilter={industryFilter}
        setIndustryFilter={(val) => {
          setIndustryFilter(val);
          setPage(1);
        }}
        statusFilter={statusFilter}
        setStatusFilter={(val) => {
          setStatusFilter(val);
          setPage(1);
        }}
        priorityFilter={priorityFilter}
        setPriorityFilter={(val) => {
          setPriorityFilter(val);
          setPage(1);
        }}
        primaryAssigneeFilter={primaryAssigneeFilter}
        setPrimaryAssigneeFilter={(val) => {
          setPrimaryAssigneeFilter(val);
          setPage(1);
        }}
        secondaryAssigneeFilter={secondaryAssigneeFilter}
        setSecondaryAssigneeFilter={(val) => {
          setSecondaryAssigneeFilter(val);
          setPage(1);
        }}
        productFilter={productFilter}
        setProductFilter={(val) => {
          setProductFilter(val);
          setPage(1);
        }}
        createdByFilter={createdByFilter}
        setCreatedByFilter={(val) => {
          setCreatedByFilter(val);
          setPage(1);
        }}
        minQty={minQty}
        setMinQty={(val) => {
          setMinQty(val);
          setPage(1);
        }}
        maxQty={maxQty}
        setMaxQty={(val) => {
          setMaxQty(val);
          setPage(1);
        }}
        minValue={minValue}
        setMinValue={(val) => {
          setMinValue(val);
          setPage(1);
        }}
        maxValue={maxValue}
        setMaxValue={(val) => {
          setMaxValue(val);
          setPage(1);
        }}
        followUpFrom={followUpFrom}
        setFollowUpFrom={(val) => {
          setFollowUpFrom(val);
          setPage(1);
        }}
        followUpTo={followUpTo}
        setFollowUpTo={(val) => {
          setFollowUpTo(val);
          setPage(1);
        }}
        fromDate={fromDate}
        setFromDate={(val) => {
          setFromDate(val);
          setPage(1);
        }}
        toDate={toDate}
        setToDate={(val) => {
          setToDate(val);
          setPage(1);
        }}
        onClear={clearFilters}
        contactOrgOptions={contactOrgOptions}
        productOptions={productOptions}
        sources={sources as any}
        assignableUsers={assignableUsers as any}
        allUsers={users as any}
        isAdmin={isAdmin}
        canFilterRep={canFilterRep}
        showPricing={showPricing}
        activeFilterCount={activeFilterCount}
      />

      {/* MODALS */}
      {assignTarget && canAssignLead(authUser, portalHome) && (
        <AssignLeadModal
          lead={assignTarget}
          open={Boolean(assignTarget)}
          onClose={() => setAssignTarget(null)}
          onSuccess={() => refetch()}
        />
      )}

      {followUpTarget && (
        <FollowUpModal
          lead={followUpTarget}
          open={Boolean(followUpTarget)}
          onClose={() => setFollowUpTarget(null)}
          onSuccess={() => refetch()}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteLeadModal
          lead={deleteTarget}
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => refetch()}
        />
      )}

      {sheetOpen && (
        <GoogleSheetLeadsModal
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onSuccess={() => refetch()}
          portalHome={portalHome}
        />
      )}

      {downloadModalOpen && (
        <DownloadLeadsPreviewModal
          open={downloadModalOpen}
          onClose={() => {
            setDownloadModalOpen(false);
            setDownloadOnlySelected(false);
            setExportRawLeads(null);
          }}
          leads={formattedLeadsForExport}
          availableColumns={
            showPricing
              ? DEFAULT_LEAD_EXPORT_COLUMNS
              : DEFAULT_LEAD_EXPORT_COLUMNS.filter((c) => c.key !== "estimated_value_fmt")
          }
        />
      )}
    </div>
  );
}
