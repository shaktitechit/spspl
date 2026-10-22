/**
 * @fileoverview Lead Manager List Page with High-Density DataTable, Mobile Card View,
 * Sticky Filter Bar, Slide-Over Filter Drawer, and Floating Bulk Action Dock.
 * @module components/leads/ListLeadsPage
 */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useMemo } from "react";
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
  useListUsersQuery,
  useListLeadSourcesQuery,
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
} from "./leadUtils";
import { AssignLeadModal } from "./AssignLeadModal";
import { FollowUpModal } from "./FollowUpModal";
import { ConfirmDeleteLeadModal } from "./ConfirmDeleteLeadModal";
import { GoogleSheetLeadsModal } from "./GoogleSheetLeadsModal";
import { BulkUploadLeadsModal } from "./BulkUploadLeadsModal";
import { DownloadLeadsPreviewModal, type ColumnDef } from "./DownloadLeadsPreviewModal";
import { LeadFilterDrawer } from "./LeadFilterDrawer";
import { TableSkeletonRows, CardSkeletonFeed } from "@/components/shared/Skeletons";

import { readSessionFromStorage, isManager, isCoordinator } from "@/utils/authStorage";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import { useLeadManagerTeamScope } from "@/hooks/useLeadManagerTeamScope";

type Props = {
  portalHome?: string;
};

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
  { key: "name", label: "Contact Person*", defaultSelected: true, widthPdf: 1.5 },
  { key: "company_name", label: "Company / Clinic*", defaultSelected: true, widthPdf: 1.6 },
  { key: "phone", label: "Phone*", defaultSelected: true, widthPdf: 1.2 },
  { key: "email", label: "Email", defaultSelected: false, widthPdf: 1.4 },
  { key: "city", label: "City*", defaultSelected: true, widthPdf: 1 },
  { key: "state", label: "State", defaultSelected: false, widthPdf: 1 },
  { key: "source", label: "Source", defaultSelected: true, widthPdf: 1.2 },
  { key: "status", label: "Status*", defaultSelected: true, widthPdf: 1 },
  { key: "priority", label: "Priority*", defaultSelected: true, widthPdf: 1 },
  { key: "department", label: "Department", defaultSelected: true, widthPdf: 1.1 },
  { key: "assigned_to_name", label: "Assigned To*", defaultSelected: true, widthPdf: 1.3 },
  { key: "estimated_value_fmt", label: "Est. Value (₹)", defaultSelected: true, widthPdf: 1.3 },
  { key: "products_summary", label: "Products / Requirement", defaultSelected: false, widthPdf: 2 },
  { key: "next_follow_up_at", label: "Next Follow-Up", defaultSelected: true, widthPdf: 1.2 },
  { key: "created_by_name", label: "Created By", defaultSelected: true, widthPdf: 1.3 },
  { key: "created_at_fmt", label: "Created Date", defaultSelected: false, widthPdf: 1.2 },
];

export function ListLeadsPage({ portalHome = "/dashboard" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduxUser = useAppSelector((state) => state.auth.user);
  const sessionUser = useMemo(() => readSessionFromStorage()?.user || null, []);
  const authUser = (reduxUser || sessionUser) as any;

  const [activeTab, setActiveTab] = useState<string>(() => {
    const status = searchParams.get("status") || "all";
    return STATUS_TABS.some((tab) => tab.id === status) ? status : "all";
  });
  const [search, setSearch] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [salesUserFilter, setSalesUserFilter] = useState<string>("all");
  const [createdByFilter, setCreatedByFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [followUpFilter, setFollowUpFilter] = useState<"today" | "overdue" | "upcoming" | "">("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);

  // Filter drawer toggle
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Bulk Selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkDeleteLeads, { isLoading: isBulkDeleting }] = useBulkDeleteLeadsMutation();

  // Modals state
  const [downloadModalOpen, setDownloadModalOpen] = useState<boolean>(false);
  const [downloadOnlySelected, setDownloadOnlySelected] = useState<boolean>(false);
  const [assignTarget, setAssignTarget] = useState<LeadRecord | null>(null);
  const [followUpTarget, setFollowUpTarget] = useState<LeadRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadRecord | null>(null);
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState<boolean>(false);

  const { data: sources } = useListLeadSourcesQuery();
  const { data: usersData } = useListUsersQuery();

  const { isAdmin: isRoleAdmin, isManager: isRoleManager, isCoordinator: isRoleCoord, isExecutive } = useLeadManagerRole();
  const { filterByTeam, withSelfInList } = useLeadManagerTeamScope();

  const isAdmin = isRoleAdmin || isLeadAdmin(authUser, portalHome);
  const isTeamLead = isRoleManager || isRoleCoord || isManager(authUser) || isCoordinator(authUser);
  const canFilterRep = isAdmin || isTeamLead;

  const [scopeFilter, setScopeFilter] = useState<"team" | "mine">("team");
  const showPricing = canViewLeadPricing(authUser, portalHome);
  const tableColSpan = showPricing ? 14 : 13;

  const queryArgs = useMemo(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: activeTab !== "all" ? activeTab : undefined,
      priority: priorityFilter !== "all" ? priorityFilter : undefined,
      department: departmentFilter !== "all" ? departmentFilter : undefined,
      source: sourceFilter !== "all" ? sourceFilter : undefined,
      scope: isTeamLead ? scopeFilter : undefined,
      assigned_to: canFilterRep && salesUserFilter !== "all" ? salesUserFilter : undefined,
      created_by: isAdmin && createdByFilter !== "all" ? createdByFilter : undefined,
      city: cityFilter.trim() || undefined,
      follow_up_filter: followUpFilter || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    }),
    [
      page,
      limit,
      search,
      activeTab,
      priorityFilter,
      departmentFilter,
      sourceFilter,
      isTeamLead,
      scopeFilter,
      canFilterRep,
      salesUserFilter,
      isAdmin,
      createdByFilter,
      cityFilter,
      followUpFilter,
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
  const formattedLeadsForExport = useMemo(() => {
    const listToFormat = downloadOnlySelected
      ? items.filter((l) => selectedLeadIds.includes(String(l._id)))
      : items;

    return listToFormat.map((lead: LeadRecord) => {
      const assignedNames = formatLeadAssignees(lead) || "Unassigned";
      const productsSummary =
        (lead.products || [])
          .map((p: any) => p.product_name || p.name || "")
          .filter(Boolean)
          .join(", ") ||
        (lead as any).requirement_details ||
        (lead as any).products_interested ||
        "N/A";
      const party = lead.party_id;
      const contactName =
        (typeof (lead as any).name === "string" && (lead as any).name) ||
        party?.party_name ||
        (party as any)?.legal_name ||
        "N/A";
      const companyName =
        party?.party_name || (lead as any).company_name || (party as any)?.legal_name || "N/A";
      const phoneVal = (lead as any).phone || party?.mobile || "N/A";
      const emailVal = (lead as any).email || party?.email || "N/A";
      const cityVal = party?.district || party?.billing_address?.city || (lead as any).city || "N/A";
      const stateVal = party?.state || party?.billing_address?.state || (lead as any).state || "N/A";
      const createdDate = lead.createdAt || (lead as any).created_at;
      const createdByName =
        typeof lead.created_by === "object" && lead.created_by?.name
          ? lead.created_by.name
          : typeof lead.created_by === "object" && lead.created_by?.email
          ? lead.created_by.email
          : typeof lead.created_by === "string" && lead.created_by
          ? lead.created_by
          : "System";

      return {
        _id: lead._id,
        lead_no: lead.lead_no || `LEAD-${lead._id.slice(-6).toUpperCase()}`,
        name: contactName,
        company_name: companyName,
        phone: phoneVal,
        email: emailVal,
        city: cityVal,
        state: stateVal,
        source: typeof lead.source === "string" ? lead.source : (lead.source as any)?.name || "Direct",
        status: (lead.status || "new").toUpperCase(),
        priority: (lead.priority || "medium").toUpperCase(),
        department: getDeptLabel(lead.department || "sales"),
        assigned_to_name: assignedNames,
        created_by_name: createdByName,
        estimated_value_fmt: lead.estimated_value
          ? `₹${Number(lead.estimated_value).toLocaleString("en-IN")}`
          : "₹0",
        products_summary: productsSummary,
        next_follow_up_at: lead.next_follow_up_at ? formatLeadDate(lead.next_follow_up_at) : "None",
        created_at_fmt: createdDate ? formatLeadDate(createdDate) : "N/A",
      };
    });
  }, [items, downloadOnlySelected, selectedLeadIds]);

  const clearFilters = () => {
    setSearch("");
    setPriorityFilter("all");
    setDepartmentFilter("all");
    setSourceFilter("all");
    setSalesUserFilter("all");
    setCreatedByFilter("all");
    setCityFilter("");
    setFollowUpFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
    setSelectedLeadIds([]);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (priorityFilter !== "all") count++;
    if (departmentFilter !== "all") count++;
    if (sourceFilter !== "all") count++;
    if (salesUserFilter !== "all") count++;
    if (isAdmin && createdByFilter !== "all") count++;
    if (cityFilter.trim()) count++;
    if (followUpFilter) count++;
    if (fromDate) count++;
    if (toDate) count++;
    return count;
  }, [
    search,
    priorityFilter,
    departmentFilter,
    sourceFilter,
    salesUserFilter,
    isAdmin,
    createdByFilter,
    cityFilter,
    followUpFilter,
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
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-surface-muted transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDownloadOnlySelected(false);
                setDownloadModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs hover:bg-emerald-500/20 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export (.xlsx)</span>
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setBulkUploadOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 shadow-2xs hover:bg-indigo-500/20 transition cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Bulk Upload</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs hover:bg-emerald-500/20 transition cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Google Sheet</span>
                </button>
              </>
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

      {/* Sticky Control Bar: Status Tabs, Search & Filter Trigger */}
      <div className="sticky top-0 z-20 space-y-3 rounded-2xl border border-border bg-card/95 p-3.5 backdrop-blur-md shadow-sm transition-colors">
        {/* Status Horizontal Tabs */}
        <div className="flex overflow-x-auto scrollbar-none border-b border-border/70 pb-2 gap-1.5">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                  setSelectedLeadIds([]);
                }}
                className={`whitespace-nowrap px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                  isActive
                    ? "bg-primary text-white shadow-2xs"
                    : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search, Filter Drawer Trigger & Quick Clear */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Lead No, Contact Name, Company, Phone, Email, Requirement..."
              className="w-full rounded-xl border border-border bg-surface-muted/50 pl-9 pr-9 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-muted hover:text-foreground p-0.5 rounded cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Filter Drawer Trigger Button */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-2xs transition cursor-pointer ${
                hasActiveFilters
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-border bg-card text-foreground hover:bg-surface-muted"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
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
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

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
                <th className="px-3 py-3">Lead No</th>
                <th className="px-3.5 py-3">Contact &amp; Organization</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3">Assigned To</th>
                <th className="px-3 py-3 text-center">Est. Qty</th>
                {showPricing && <th className="px-3 py-3 text-right">Est. Value</th>}
                <th className="px-3 py-3">Next Follow-Up</th>
                <th className="px-3 py-3">Created</th>
                <th className="px-3.5 py-3 text-right">Actions</th>
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

                      {/* Lead No */}
                      <td className="px-3 py-3 font-bold whitespace-nowrap">
                        <Link
                          href={`${portalHome}/leads/${lead._id}`}
                          className="text-primary hover:underline font-mono text-xs font-bold"
                        >
                          {lead.lead_no}
                        </Link>
                      </td>

                      {/* Contact & Company */}
                      <td className="px-3.5 py-3 max-w-[240px]">
                        <div className="font-bold text-foreground truncate">
                          {lead.name || "Untitled Lead"}
                        </div>
                        {lead.company_name && (
                          <div className="flex items-center gap-1 text-[11px] text-muted truncate mt-0.5">
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{lead.company_name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[11px] text-muted mt-1">
                          {lead.phone && (
                            <span className="flex items-center gap-1 font-mono text-[10px]">
                              <Phone className="h-2.5 w-2.5 text-muted" />
                              {lead.phone}
                            </span>
                          )}
                          {lead.department && (
                            <span className="rounded bg-surface-muted border border-border px-1 py-0.2 text-[9px] font-semibold text-muted">
                              {getDeptLabel(lead.department)}
                            </span>
                          )}
                        </div>
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

                      {/* Assigned To */}
                      <td className="px-3 py-3 max-w-[160px]">
                        {lead.assigned_users && lead.assigned_users.length > 0 ? (
                          <div className="truncate">
                            <span className="text-[11px] font-semibold text-foreground truncate block">
                              {lead.assigned_users.map((u) => u.name).filter(Boolean).join(", ")}
                            </span>
                            {lead.assigned_users.length > 1 && (
                              <span className="text-[10px] text-muted">
                                ({lead.assigned_users.length} assigned)
                              </span>
                            )}
                          </div>
                        ) : lead.assigned_to?.name ? (
                          <span className="text-[11px] font-semibold text-foreground truncate block">
                            {lead.assigned_to.name}
                          </span>
                        ) : (
                          <span className="text-[11px] italic text-muted">Unassigned</span>
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

                      {/* Created Date */}
                      <td className="px-3 py-3 whitespace-nowrap text-[11px] text-muted font-mono">
                        {formatLeadDate(lead.createdAt)}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
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
                    {lead.company_name && (
                      <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5 truncate">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{lead.company_name}</span>
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
                    {lead.department && (
                      <span className="rounded-lg bg-surface-muted px-2 py-1 text-[10px] font-bold text-muted">
                        {getDeptLabel(lead.department)}
                      </span>
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
              onClick={() => {
                setDownloadOnlySelected(true);
                setDownloadModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export</span>
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

      {/* SLIDE-OVER FILTER DRAWER */}
      <LeadFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        priorityFilter={priorityFilter}
        setPriorityFilter={(val) => {
          setPriorityFilter(val);
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
        salesUserFilter={salesUserFilter}
        setSalesUserFilter={(val) => {
          setSalesUserFilter(val);
          setPage(1);
        }}
        createdByFilter={createdByFilter}
        setCreatedByFilter={(val) => {
          setCreatedByFilter(val);
          setPage(1);
        }}
        cityFilter={cityFilter}
        setCityFilter={(val) => {
          setCityFilter(val);
          setPage(1);
        }}
        followUpFilter={followUpFilter}
        setFollowUpFilter={(val) => {
          setFollowUpFilter(val);
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
        sources={sources as any}
        assignableUsers={assignableUsers as any}
        allUsers={users as any}
        isAdmin={isAdmin}
        canFilterRep={canFilterRep}
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

      {bulkUploadOpen && (
        <BulkUploadLeadsModal
          isOpen={bulkUploadOpen}
          onClose={() => setBulkUploadOpen(false)}
        />
      )}

      {downloadModalOpen && (
        <DownloadLeadsPreviewModal
          open={downloadModalOpen}
          onClose={() => {
            setDownloadModalOpen(false);
            setDownloadOnlySelected(false);
          }}
          leads={formattedLeadsForExport}
          availableColumns={DEFAULT_LEAD_EXPORT_COLUMNS}
        />
      )}
    </div>
  );
}
