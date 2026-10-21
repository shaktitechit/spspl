/**
 * @fileoverview Lead Manager List Page with DataTable, server-side filters, status tabs, and lifecycle actions.
 * @module components/portal/shared/leads/ListLeadsPage
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
} from "lucide-react";
import {
  useListLeadsQuery,
  useListUsersQuery,
  useListLeadSourcesQuery,
  type LeadRecord,
  type LeadStatus,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
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
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Modals state
  const [downloadModalOpen, setDownloadModalOpen] = useState<boolean>(false);
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
  const tableColSpan = showPricing ? 13 : 12;

  const authUserId = authUser?._id
    ? String(authUser._id)
    : authUser?.id
    ? String(authUser.id)
    : undefined;

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

  const formattedLeadsForExport = useMemo(() => {
    return items.map((lead: LeadRecord) => {
      const assignedNames = formatLeadAssignees(lead) || "Unassigned";
      const productsSummary = (lead.products || [])
        .map((p: any) => p.product_name || p.name || "")
        .filter(Boolean)
        .join(", ") || (lead as any).requirement_details || (lead as any).products_interested || "N/A";
      const party = lead.party_id;
      const contactName =
        (typeof (lead as any).name === "string" && (lead as any).name) ||
        party?.party_name ||
        (party as any)?.legal_name ||
        "N/A";
      const companyName = party?.party_name || (lead as any).company_name || (party as any)?.legal_name || "N/A";
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
        estimated_value_fmt: lead.estimated_value ? `₹${Number(lead.estimated_value).toLocaleString("en-IN")}` : "₹0",
        products_summary: productsSummary,
        next_follow_up_at: lead.next_follow_up_at ? formatLeadDate(lead.next_follow_up_at) : "None",
        created_at_fmt: createdDate ? formatLeadDate(createdDate) : "N/A",
      };
    });
  }, [items]);

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
  };

  const hasActiveFilters =
    Boolean(search) ||
    priorityFilter !== "all" ||
    departmentFilter !== "all" ||
    sourceFilter !== "all" ||
    salesUserFilter !== "all" ||
    (isAdmin && createdByFilter !== "all") ||
    Boolean(cityFilter) ||
    Boolean(followUpFilter) ||
    Boolean(fromDate) ||
    Boolean(toDate);

  return (
    <div className="relative min-h-screen space-y-6 pb-20">
      <PortalBusyOverlay active={isFetching && !isLoading} />

      {/* Header Banner */}
      <div className="relative shrink-0 overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-2.5 shadow-sm">
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Lead Manager
              </h1>
              <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-primary">
                {isAdmin
                  ? "All Leads (Global)"
                  : isTeamLead
                  ? (scopeFilter === "team" ? "Team Leads" : "My Leads")
                  : "My Leads"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAdmin
                ? "Global lead management — track all company inquiries, assignments, and conversions."
                : isTeamLead
                ? "Team lead management — track leads created by or assigned to your team members."
                : "Personal lead pipeline — track leads assigned to you or created by you."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setDownloadModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-xs transition hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Export Leads (.xlsx)
            </button>
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setBulkUploadOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 shadow-xs transition hover:bg-indigo-100 dark:border-indigo-500/20 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  Bulk Upload
                </button>
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-xs transition hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Google Sheet
                </button>
              </>
            )}

            <Link
              href="/dashboard/leads/follow-ups"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <CalendarPlus className="h-3.5 w-3.5 text-teal-500" />
              Follow-ups
            </Link>

            <Link
              href="/dashboard/leads/reports"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <BarChart3 className="h-3.5 w-3.5 text-indigo-500" />
              {isAdmin || isTeamLead ? "Team Sales Reports" : "My Reports"}
            </Link>

            <Link
              href={`${portalHome}/leads/new`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" />
              Create Lead
            </Link>
          </div>
        </div>
      </div>

      {/* Team / Mine Scope Toggle for Managers & Coordinators */}
      {isTeamLead && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">View Scope:</span>
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold border border-slate-200/80 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setScopeFilter("team");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                scopeFilter === "team"
                  ? "bg-white dark:bg-slate-700 text-primary shadow-xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
              className={`px-3 py-1.5 rounded-lg transition-all ${
                scopeFilter === "mine"
                  ? "bg-white dark:bg-slate-700 text-primary shadow-xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              My Leads (Created or Assigned to Me)
            </button>
          </div>
        </div>
      )}

      {/* Status Tab Strip */}
      <div className="flex overflow-x-auto border-b border-slate-200 dark:border-white/10">
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
              className={`whitespace-nowrap px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
                isActive
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search & Quick Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Lead No, Contact Name, Company, Phone, Email..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-4 py-2 text-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none dark:border-white/10 dark:bg-slate-800/40 dark:text-white dark:focus:bg-slate-800"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition ${
                showFilters || hasActiveFilters
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                  !
                </span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Filters */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/10">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Priority
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Department
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              >
                <option value="all">All Departments</option>
                {LEAD_DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Lead Source
              </label>
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              >
                <option value="all">All Sources</option>
                {sources?.map((s) => (
                  <option key={s._id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {canFilterRep && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Assigned To
                </label>
                <select
                  value={salesUserFilter}
                  onChange={(e) => {
                    setSalesUserFilter(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                >
                  <option value="all">{isAdmin ? "All Users" : "All Team Members"}</option>
                  <option value="unassigned">Unassigned Only</option>
                  {assignableUsers.map((u) => {
                    const roleBadge = getLeadManagerPortalRole(u);
                    return (
                      <option key={u._id} value={u._id}>
                        {u.name} {roleBadge ? `(${roleBadge})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {isAdmin && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Created By
                </label>
                <select
                  value={createdByFilter}
                  onChange={(e) => {
                    setCreatedByFilter(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                >
                  <option value="all">All Creators</option>
                  {users
                    .filter(isUserInLeadManagerPortal)
                    .map((u) => {
                      const roleBadge = getLeadManagerPortalRole(u);
                      return (
                        <option key={u._id} value={u._id}>
                          {u.name} {roleBadge ? `(${roleBadge})` : ""}
                        </option>
                      );
                    })}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Follow-up State
              </label>
              <select
                value={followUpFilter}
                onChange={(e) => {
                  setFollowUpFilter(e.target.value as "" | "today" | "overdue" | "upcoming");
                  setPage(1);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              >
                <option value="">All Follow-up States</option>
                <option value="today">Follow-up Today</option>
                <option value="overdue">Overdue Follow-up</option>
                <option value="upcoming">Upcoming Follow-up</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                City / Location
              </label>
              <input
                type="text"
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Mumbai, Pune, Delhi..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Created From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Created To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Leads Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Lead No</th>
                <th className="px-4 py-3">Lead / Company</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3 text-center">Est. Qty</th>
                {showPricing && <th className="px-4 py-3 text-right">Est. Value</th>}
                <th className="px-4 py-3">Next Follow-up</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={tableColSpan} className="py-12 text-center text-slate-400">
                    Loading leads...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="py-12 text-center text-slate-400">
                    No leads found matching your criteria.
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

                  return (
                    <tr
                      key={lead._id}
                      className="transition hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                    >
                      {/* Lead No */}
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <Link
                          href={`${portalHome}/leads/${lead._id}`}
                          className="text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {lead.lead_no}
                        </Link>
                      </td>

                      {/* Lead Name / Company */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {lead.name}
                        </div>
                        {lead.company_name && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <Building2 className="h-3 w-3" />
                            {lead.company_name}
                          </div>
                        )}
                        {lead.department && (
                          <div className="mt-1">
                            <span className="inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                              {getDeptLabel(lead.department)}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3 text-[11px]">
                        {lead.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {lead.phone}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <Mail className="h-3 w-3 text-slate-400" />
                            {lead.email}
                          </div>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {lead.source}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusCfg?.bg} ${statusCfg?.text} ${statusCfg?.border}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusCfg?.dot}`} />
                          {statusCfg?.label || lead.status}
                        </span>
                      </td>

                      {/* Priority Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${priorityCfg?.bg} ${priorityCfg?.text} ${priorityCfg?.border}`}
                        >
                          {priorityCfg?.label || lead.priority}
                        </span>
                      </td>

                      {/* Assigned To */}
                      <td className="px-4 py-3">
                        {lead.assigned_users && lead.assigned_users.length > 0 ? (
                          <div>
                            <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                              {lead.assigned_users.map((u) => u.name).filter(Boolean).join(", ")}
                            </div>
                            {lead.assigned_users.length > 1 && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                ({lead.assigned_users.length} members)
                              </span>
                            )}
                          </div>
                        ) : lead.assigned_to?.name ? (
                          <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                            {lead.assigned_to.name}
                          </div>
                        ) : (
                          <span className="text-[11px] italic text-slate-400">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Estimated Quantity */}
                      <td className="px-4 py-3 whitespace-nowrap text-center font-bold text-slate-900 dark:text-white">
                        {(() => {
                          const totalQty = Array.isArray(lead.products)
                            ? lead.products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)
                            : 0;
                          return totalQty > 0 ? (
                            <span>
                              {totalQty.toLocaleString()}{" "}
                              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                {lead.products && lead.products.length === 1 && lead.products[0].unit
                                  ? lead.products[0].unit
                                  : "pcs"}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          );
                        })()}
                      </td>

                      {showPricing && (
                        <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-slate-900 dark:text-white">
                          {(() => {
                            const value = leadEstimatedValue(lead);
                            return value > 0 ? (
                              formatCurrencyINR(value)
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            );
                          })()}
                        </td>
                      )}

                      {/* Next Follow-up */}
                      <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                        {lead.next_follow_up_at ? (
                          <span
                            className={`font-semibold ${
                              isOverdue
                                ? "text-rose-600 dark:text-rose-400"
                                : isToday
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {formatLeadDate(lead.next_follow_up_at)}
                            {isOverdue && " (Overdue)"}
                            {isToday && " (Today)"}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Created By */}
                      <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                        {typeof lead.created_by === "object" && lead.created_by?.name ? (
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {lead.created_by.name}
                            </span>
                            {lead.created_by.department && (
                              <span className="block text-[10px] text-slate-400">
                                {lead.created_by.department}
                              </span>
                            )}
                          </div>
                        ) : typeof lead.created_by === "object" && lead.created_by?.email ? (
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {lead.created_by.email}
                          </span>
                        ) : typeof lead.created_by === "string" && lead.created_by ? (
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {lead.created_by}
                          </span>
                        ) : (
                          <span className="text-slate-400">System</span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-500">
                        {formatLeadDate(lead.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`${portalHome}/leads/${lead._id}`}
                            title="View Lead Details"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {!isLeadClosed && (
                            <Link
                              href={`${portalHome}/leads/${lead._id}/edit`}
                              title="Edit Lead"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}

                          <Link
                            href={`${portalHome}/leads/new?copy_from=${lead._id}`}
                            title="Copy Lead as New"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400"
                          >
                            <Copy className="h-4 w-4" />
                          </Link>

                          {!isLeadClosed && (
                            <button
                              type="button"
                              onClick={() => setFollowUpTarget(lead)}
                              title="Add Follow-up"
                              className="rounded-lg p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                            >
                              <CalendarPlus className="h-4 w-4" />
                            </button>
                          )}

                          {!isLeadClosed && canAssignLead(authUser, portalHome) && (
                            <button
                              type="button"
                              onClick={() => setAssignTarget(lead)}
                              title="Assign Lead"
                              className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          )}

                          {isAdmin && !isLeadConverted && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(lead)}
                              title="Delete Lead"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                            >
                              <Trash2 className="h-4 w-4" />
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

        {/* Pagination Bar */}
        <div className="border-t border-slate-100 dark:border-white/10">
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

      {/* Modals */}
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
          onClose={() => setDownloadModalOpen(false)}
          leads={formattedLeadsForExport}
          availableColumns={DEFAULT_LEAD_EXPORT_COLUMNS}
        />
      )}
    </div>
  );
}

