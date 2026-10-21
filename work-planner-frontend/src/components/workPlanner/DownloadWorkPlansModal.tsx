"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Download,
  FileSpreadsheet,
  Filter,
  Search,
  RefreshCw,
  Calendar,
  Layers,
  ShieldCheck,
  Building2,
  Table,
  CheckCircle,
  Clock,
  MapPin,
  UserCheck,
  Phone,
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  CornerDownRight,
  MessageSquare,
  CalendarClock,
} from "lucide-react";
import { useLazyGetPlansQuery, useGetMyTeamQuery, useGetTeamTreeQuery } from "@/store/api/workPlannerApiSlice";
import type { WorkPlanRecord, WorkPlanVisitRecord, WorkPlanWorkRecord, AuthorityRemarkItem } from "@/types/workPlanner";
import {
  formatDiscussionMethod,
  formatPlanDate,
  salesUserLabel,
  renderPlanStatusBadge,
  WORK_PLAN_STATUS_TABS,
  WORK_PLAN_TYPE_TABS,
  formatTime,
  renderVisitStatusBadge,
  stripHtml,
} from "./workPlanUtils";
import { calculateDateRange, type DateFilterPreset, toYmdString } from "./DashboardDateFilter";
import { usePdfCompanyLetterhead } from "./pdfCompanyLetterhead";
import { downloadPdfReport } from "./exportPdfReport";
import { downloadExcelReport } from "./exportExcelReport";
import { readSessionFromStorage, isWpAdmin, isWpManager, isWpElevated } from "@/utils/authStorage";
import { Network } from "lucide-react";

function formatSupervisoryRemarks(
  managerRemarks?: string,
  authorityRemarks?: AuthorityRemarkItem[]
): string {
  const parts: string[] = [];
  if (managerRemarks && managerRemarks.trim()) {
    parts.push(`Senior: ${stripHtml(managerRemarks.trim())}`);
  }
  if (authorityRemarks && authorityRemarks.length > 0) {
    authorityRemarks.forEach((ar) => {
      const roleStr = ar.role ? `[${ar.role.toUpperCase()}] ` : "";
      const userStr = ar.user_name || "Senior";
      const remText = stripHtml(ar.remark || "").trim();
      if (remText) {
        parts.push(`${roleStr}${userStr}: ${remText}`);
      }
    });
  }
  return parts.join(" | ");
}

function renderSupervisoryRemarksCell(
  managerRemarks?: string,
  authorityRemarks?: AuthorityRemarkItem[]
) {
  const hasManager = Boolean(managerRemarks && managerRemarks.trim());
  const hasAuth = Boolean(authorityRemarks && authorityRemarks.length > 0);

  if (!hasManager && !hasAuth) {
    return <span className="text-muted/60">—</span>;
  }

  return (
    <div className="space-y-1 max-w-[280px]">
      {hasManager && (
        <div className="flex items-start gap-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">
          <ShieldCheck className="h-3 w-3 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
          <span className="truncate">
            <strong>Senior:</strong> {stripHtml(managerRemarks!)}
          </span>
        </div>
      )}
      {hasAuth &&
        authorityRemarks!.map((ar, idx) => (
          <div
            key={ar._id || `auth-${idx}`}
            className="flex items-start gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] text-purple-700 dark:text-purple-300 font-medium"
          >
            <ShieldCheck className="h-3 w-3 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
            <span className="truncate">
              <strong>[{ar.role ? ar.role.toUpperCase() : "SENIOR"} {ar.user_name || ""}]:</strong>{" "}
              {stripHtml(ar.remark || "")}
            </span>
          </div>
        ))}
    </div>
  );
}

export type DownloadWorkPlansModalProps = {
  open: boolean;
  plans?: WorkPlanRecord[];
  onClose: () => void;
};

type ReportDatePreset = "all" | DateFilterPreset;
type ActivityTypeFilter = "all" | "visits" | "tasks";

export function DownloadWorkPlansModal({
  open,
  plans: initialPlans = [],
  onClose,
}: DownloadWorkPlansModalProps) {
  const letterhead = usePdfCompanyLetterhead();
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const adminRole = isWpAdmin(sessionUser);
  const managerRole = isWpManager(sessionUser);
  const elevatedRole = isWpElevated(sessionUser);

  const [downloading, setDownloading] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<WorkPlanRecord[]>([]);

  // Filter Panel Toggle & States
  const [showFilterPanel, setShowFilterPanel] = useState(true);
  const [datePreset, setDatePreset] = useState<ReportDatePreset>("all");
  const todayYmd = toYmdString(new Date());
  const [customFrom, setCustomFrom] = useState(todayYmd);
  const [customTo, setCustomTo] = useState(todayYmd);
  const [planTypeFilter, setPlanTypeFilter] = useState("all");
  const [activityTypeFilter, setActivityTypeFilter] = useState<ActivityTypeFilter>("all");
  const [itemStatusFilter, setItemStatusFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [partyTitleFilter, setPartyTitleFilter] = useState("");
  const [contactDetailsFilter, setContactDetailsFilter] = useState("");
  const [locationCityFilter, setLocationCityFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [executiveFilter, setExecutiveFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"tree" | "flat">("tree");

  // Team tree queries (elevated users only)
  const { data: tree } = useGetTeamTreeQuery(undefined, { skip: !adminRole });
  const { data: myTeamData } = useGetMyTeamQuery(undefined, { skip: !elevatedRole || adminRole });

  // Build team options for the dropdown
  const teamOptions = useMemo<Array<{ id: string; name: string; memberIds: string[] }>>(() => {
    if (!elevatedRole) return [];
    if (adminRole) {
      const mgrs = [...(tree?.managers || []), ...(tree?.coordinators || [])] as Array<{ _id?: string; id?: string; name: string; report_ids?: string[] }>;
      return mgrs.map((m) => {
        const mId = String(m._id || m.id || "");
        const reportIds = (m.report_ids || []).map(String);
        return { id: mId, name: `${m.name}'s Team`, memberIds: [mId, ...reportIds] };
      });
    }
    if (elevatedRole && !adminRole && sessionUser?._id) {
      const myTeamMembers = (myTeamData?.members || []) as Array<{ _id?: string; id?: string }>;
      const memberIds = [String(sessionUser._id), ...myTeamMembers.map((m) => String(m._id || m.id || ""))];
      return [{ id: String(sessionUser._id), name: "My Reporting Team", memberIds }];
    }
    return [];
  }, [adminRole, elevatedRole, tree, myTeamData, sessionUser]);

  // Selected team's member IDs ("all" = no constraint)
  const selectedTeamMemberIds = useMemo<Set<string> | null>(() => {
    if (teamFilter === "all") return null;
    const found = teamOptions.find((t) => t.id === teamFilter);
    return found ? new Set(found.memberIds) : null;
  }, [teamFilter, teamOptions]);

  // Expand / Collapse state for Parent Work Plans (Map of planId -> boolean)
  const [collapsedPlanIds, setCollapsedPlanIds] = useState<Record<string, boolean>>({});
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [fetchPlans] = useLazyGetPlansQuery();

  // Fetch report data including detailed visits & works with multi-page loop
  const loadReportData = async () => {
    if (!open) return;
    setLoading(true);
    try {
      let page = 1;
      let totalPages = 1;
      let accumulatedPlans: WorkPlanRecord[] = [];

      do {
        const params: Record<string, string | number | boolean | undefined> = {
          page,
          limit: 200,
          include_visits: "true",
          include_works: "true",
        };

        if (datePreset !== "all") {
          const range = calculateDateRange(datePreset as DateFilterPreset, customFrom, customTo);
          params.from = range.from;
          params.to = range.to;
        }
        if (statusFilter !== "all") params.status = statusFilter;
        if (planTypeFilter !== "all") params.plan_type = planTypeFilter;

        const res = await fetchPlans(params).unwrap();
        const data = res.data || [];
        accumulatedPlans = accumulatedPlans.concat(data);
        totalPages = res.pages || 1;
        page++;
      } while (page <= totalPages && page <= 20);

      setPlans(accumulatedPlans);
    } catch (err) {
      console.error("Failed to fetch work plans report data:", err);
      if (initialPlans && initialPlans.length > 0) {
        setPlans(initialPlans);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadReportData();
    }
  }, [open, datePreset, customFrom, customTo, statusFilter, planTypeFilter]);

  // Reset Filters Handler
  const resetFilters = () => {
    setDatePreset("all");
    setCustomFrom(todayYmd);
    setCustomTo(todayYmd);
    setPlanTypeFilter("all");
    setActivityTypeFilter("all");
    setItemStatusFilter("all");
    setStatusFilter("all");
    setPartyTitleFilter("");
    setContactDetailsFilter("");
    setLocationCityFilter("");
    setTeamFilter("all");
    setExecutiveFilter("");
    setSearchQuery("");
  };

  // Toggle Collapse Single Plan
  const togglePlanCollapse = (planId: string) => {
    setCollapsedPlanIds((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  // Toggle Collapse All
  const toggleCollapseAll = () => {
    const nextState = !allCollapsed;
    setAllCollapsed(nextState);
    const newCollapsedMap: Record<string, boolean> = {};
    plans.forEach((p) => {
      const id = p._id || p.id || "";
      if (id) newCollapsedMap[id] = nextState;
    });
    setCollapsedPlanIds(newCollapsedMap);
  };

  // Processed Work Plans with their Field Visits and Tasks
  const filteredPlanTree = useMemo(() => {
    return plans
      .map((plan) => {
        const planId = plan._id || plan.id || "";
        const planDate = plan.plan_date || "";
        const salesUser = plan.sales_user;
        const planType = plan.plan_type || "Visits";
        const planStatus = plan.status || "planned";
        const planLocation = plan.location || "";
        const planRemarks = plan.remarks || "";

        const partyTitleQuery = partyTitleFilter.trim().toLowerCase();
        const contactQuery = contactDetailsFilter.trim().toLowerCase();

        // Check Location / City Filter
        if (
          locationCityFilter.trim() &&
          !planLocation.toLowerCase().includes(locationCityFilter.trim().toLowerCase())
        ) {
          return null;
        }

        // Check Team Filter (scope by selected team's member IDs)
        if (selectedTeamMemberIds !== null) {
          const salesUserId = typeof salesUser === "object" && salesUser !== null
            ? String((salesUser as any)._id || (salesUser as any).id || "")
            : String(salesUser || "");
          if (!selectedTeamMemberIds.has(salesUserId)) {
            return null;
          }
        }

        // Check Executive Filter
        if (
          executiveFilter.trim() &&
          !salesUserLabel(salesUser).toLowerCase().includes(executiveFilter.trim().toLowerCase())
        ) {
          return null;
        }

        // Process Visits
        const rawVisits: WorkPlanVisitRecord[] = activityTypeFilter === "tasks" ? [] : (plan.visits || []);
        const visits = rawVisits
          .map((v, vIdx) => {
            const partyObj = typeof v.party === "object" && v.party !== null ? (v.party as Record<string, unknown>) : null;
            const partyName = v.party_name || (partyObj?.party_name as string) || "Visit";
            
            const visitContacts = Array.isArray(v.contacts) && v.contacts.length > 0
              ? v.contacts
              : (v.contact_person || v.contact_number || (partyObj?.contact_person as string) || (partyObj?.mobile as string))
                ? [
                    {
                      contact_person: v.contact_person || (partyObj?.contact_person as string) || "",
                      contact_number: v.contact_number || (partyObj?.mobile as string) || "",
                      contact_email: v.contact_email || (partyObj?.email as string) || "",
                    },
                  ]
                : [];

            const contactInfo = visitContacts.length > 0
              ? visitContacts
                  .map((c) => [c.contact_person, c.contact_number].filter(Boolean).join(" · "))
                  .filter(Boolean)
                  .join(" | ") || "—"
              : "—";
            const billingAddr = partyObj?.billing_address as { city?: string } | undefined;
            const address = v.address || billingAddr?.city || planLocation;

            const startTime = v.planned_start_time ? formatTime(v.planned_start_time) : "";
            const endTime = v.planned_end_time ? formatTime(v.planned_end_time) : "";
            const plannedTime = startTime || endTime ? `${startTime} - ${endTime}` : "Not set";

            const checkInTime = v.actual_check_in ? formatTime(v.actual_check_in) : (v.check_in_time || "");
            const checkOutTime = v.actual_check_out ? formatTime(v.actual_check_out) : (v.check_out_time || "");
            const actualTime = checkInTime || checkOutTime ? `In: ${checkInTime} / Out: ${checkOutTime}` : "—";

            // Checklist indicators
            const checklist = [];
            if (v.meeting_with_doctor) checklist.push("Doctor: Yes");
            if (v.meeting_with_purchase) checklist.push("Purchase: Yes");
            if (v.meeting_with_finance) checklist.push("Finance: Yes");
            if (v.meeting_with_engineer) checklist.push("Engineer: Yes");
            if (v.new_product_introduced) checklist.push("New Product: Yes");
            if (v.order_received) checklist.push("Order Received: Yes");
            const checklistNotes = checklist.length > 0 ? checklist.join(" | ") : "—";

            const managerRemarks = v.manager_remarks || "";
            const authorityRemarks = v.authority_remarks || [];
            const rescheduledDate = v.rescheduled_date || "";
            const supervisoryRemarks = formatSupervisoryRemarks(managerRemarks, authorityRemarks);

            return {
              id: v._id || v.id || `v-${planId}-${vIdx}`,
              sequence: v.sequence ?? vIdx + 1,
              partyName,
              contactInfo,
              address: address || "—",
              plannedTime,
              actualTime,
              actualCheckIn: checkInTime,
              actualCheckOut: checkOutTime,
              status: v.status || "created",
              outcome: v.outcome || "—",
              checklistNotes,
              purpose: v.purpose || "Field Visit",
              notes: v.notes || "",
              completionRemarks: v.outcome || "",
              pendingRemarks: v.pending_remarks || "",
              inProgressRemarks: v.in_progress_remarks || "",
              nextFollowupDate: v.next_followup_date || "",
              meetingWithDoctor: Boolean(v.meeting_with_doctor),
              meetingWithPurchase: Boolean(v.meeting_with_purchase),
              meetingWithFinance: Boolean(v.meeting_with_finance),
              meetingWithEngineer: Boolean(v.meeting_with_engineer),
              newProductIntroduced: Boolean(v.new_product_introduced),
              orderReceived: Boolean(v.order_received),
              managerRemarks,
              authorityRemarks,
              rescheduledDate,
              supervisoryRemarks,
            };
          })
          .filter((v) => {
            if (itemStatusFilter !== "all" && v.status.toLowerCase() !== itemStatusFilter.toLowerCase()) {
              return false;
            }
            if (partyTitleQuery && !v.partyName.toLowerCase().includes(partyTitleQuery)) {
              return false;
            }
            if (
              contactQuery &&
              !v.contactInfo.toLowerCase().includes(contactQuery) &&
              !v.address.toLowerCase().includes(contactQuery)
            ) {
              return false;
            }
            return true;
          });

        // Process Work Tasks
        const rawWorks: WorkPlanWorkRecord[] = activityTypeFilter === "visits" ? [] : (plan.works || []);
        const tasks = rawWorks
          .map((w, wIdx) => {
            const startTime = w.planned_start_time ? formatTime(w.planned_start_time) : "";
            const endTime = w.planned_end_time ? formatTime(w.planned_end_time) : "";
            const plannedTime = startTime || endTime ? `${startTime} - ${endTime}` : "Not set";

            const managerRemarks = w.manager_remarks || "";
            const authorityRemarks = w.authority_remarks || [];
            const rescheduledDate = w.rescheduled_date || "";
            const supervisoryRemarks = formatSupervisoryRemarks(managerRemarks, authorityRemarks);

            return {
              id: w._id || w.id || `w-${planId}-${wIdx}`,
              sequence: w.sequence ?? wIdx + 1,
              title: w.title || `Task #${wIdx + 1}`,
              description: w.description || "Work Task",
              plannedTime,
              status: w.status || "created",
              remarks: w.completion_remarks || w.outcome || "—",
              completionRemarks: w.completion_remarks || w.outcome || "",
              pendingRemarks: w.pending_remarks || "",
              inProgressRemarks: w.in_progress_remarks || "",
              outcome: w.outcome || w.completion_remarks || "",
              managerRemarks,
              authorityRemarks,
              rescheduledDate,
              supervisoryRemarks,
            };
          })
          .filter((w) => {
            if (itemStatusFilter !== "all" && w.status.toLowerCase() !== itemStatusFilter.toLowerCase()) {
              return false;
            }
            if (partyTitleQuery && !w.title.toLowerCase().includes(partyTitleQuery)) {
              return false;
            }
            if (
              contactQuery &&
              !w.description.toLowerCase().includes(contactQuery) &&
              !w.remarks.toLowerCase().includes(contactQuery)
            ) {
              return false;
            }
            return true;
          });

        // If activityTypeFilter is specifically "visits" and plan has no matching visits, exclude plan
        if (activityTypeFilter === "visits" && visits.length === 0) {
          return null;
        }

        // If activityTypeFilter is specifically "tasks" and plan has no matching tasks, exclude plan
        if (activityTypeFilter === "tasks" && tasks.length === 0) {
          return null;
        }

        // If itemStatusFilter is active and plan has 0 matching visits and 0 matching tasks, exclude plan
        if (itemStatusFilter !== "all" && visits.length === 0 && tasks.length === 0) {
          return null;
        }

        // If partyTitleQuery or contactQuery is active and plan has no matching visits/tasks, check plan details
        if ((partyTitleQuery || contactQuery) && visits.length === 0 && tasks.length === 0) {
          return null;
        }

        const planManagerRemarks = plan.manager_remarks || "";
        const planAuthorityRemarks = plan.authority_remarks || [];
        const planSupervisoryRemarks = formatSupervisoryRemarks(planManagerRemarks, planAuthorityRemarks);

        // Global Search Filter matching Plan, Visit or Task fields
        const q = searchQuery.trim().toLowerCase();
        let matchesSearch = true;
        if (q) {
          const userStr = salesUserLabel(salesUser).toLowerCase();
          const locStr = planLocation.toLowerCase();
          const remStr = planRemarks.toLowerCase();
          const dtStr = formatPlanDate(planDate).toLowerCase();
          const typeStr = planType.toLowerCase();

          const discMgr = (
            plan.discussed_manager_name ||
            (typeof plan.discussed_manager_id === "object"
              ? plan.discussed_manager_id?.name
              : "") ||
            ""
          ).toLowerCase();
          const discMethod = (plan.discussion_method || "").toLowerCase();

          const planMatch =
            userStr.includes(q) ||
            locStr.includes(q) ||
            remStr.includes(q) ||
            dtStr.includes(q) ||
            typeStr.includes(q) ||
            discMgr.includes(q) ||
            discMethod.includes(q) ||
            planSupervisoryRemarks.toLowerCase().includes(q);

          const visitMatch = visits.some(
            (v) =>
              v.partyName.toLowerCase().includes(q) ||
              v.contactInfo.toLowerCase().includes(q) ||
              v.address.toLowerCase().includes(q) ||
              v.outcome.toLowerCase().includes(q) ||
              v.checklistNotes.toLowerCase().includes(q) ||
              v.supervisoryRemarks.toLowerCase().includes(q) ||
              v.rescheduledDate.toLowerCase().includes(q)
          );

          const taskMatch = tasks.some(
            (w) =>
              w.title.toLowerCase().includes(q) ||
              w.description.toLowerCase().includes(q) ||
              w.remarks.toLowerCase().includes(q) ||
              w.supervisoryRemarks.toLowerCase().includes(q) ||
              w.rescheduledDate.toLowerCase().includes(q)
          );

          matchesSearch = planMatch || visitMatch || taskMatch;
        }

        if (!matchesSearch) return null;

        return {
          planId,
          planDate,
          salesUser,
          planType,
          planStatus,
          planLocation,
          planRemarks,
          managerRemarks: planManagerRemarks,
          authorityRemarks: planAuthorityRemarks,
          supervisoryRemarks: planSupervisoryRemarks,
          isDiscussedWithManager: Boolean(plan.is_discussed_with_manager),
          discussedManagerName:
            plan.discussed_manager_name ||
            (typeof plan.discussed_manager_id === "object"
              ? plan.discussed_manager_id?.name
              : "") ||
            "",
          discussionMethod: plan.discussion_method || "",
          visits,
          tasks,
          totalVisits: plan.visit_count ?? (plan.visits?.length || 0),
          totalTasks: plan.work_count ?? (plan.works?.length || 0),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [
    plans,
    activityTypeFilter,
    itemStatusFilter,
    locationCityFilter,
    selectedTeamMemberIds,
    executiveFilter,
    partyTitleFilter,
    contactDetailsFilter,
    searchQuery,
  ]);

  // Overall Metrics Summary
  const summaryMetrics = useMemo(() => {
    const totalPlans = filteredPlanTree.length;
    const totalVisits = filteredPlanTree.reduce(
      (sum, p) => sum + p.visits.length,
      0
    );
    const totalTasks = filteredPlanTree.reduce(
      (sum, p) => sum + p.tasks.length,
      0
    );
    const completedPlans = filteredPlanTree.filter((p) => p.planStatus === "completed").length;
    return { totalPlans, totalVisits, totalTasks, completedPlans };
  }, [filteredPlanTree]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (datePreset !== "all") count++;
    if (planTypeFilter !== "all") count++;
    if (activityTypeFilter !== "all") count++;
    if (itemStatusFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    if (partyTitleFilter.trim()) count++;
    if (contactDetailsFilter.trim()) count++;
    if (locationCityFilter.trim()) count++;
    if (teamFilter !== "all") count++;
    if (executiveFilter.trim()) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [
    datePreset,
    planTypeFilter,
    activityTypeFilter,
    itemStatusFilter,
    statusFilter,
    partyTitleFilter,
    contactDetailsFilter,
    locationCityFilter,
    teamFilter,
    executiveFilter,
    searchQuery,
  ]);

  if (!open) return null;

  // Export Hierarchical Work Plans CSV with fully expanded columns
  function exportCsv() {
    setDownloading(true);
    try {
      const headers = [
        "Row Index",
        "Record Level",
        "Plan Date",
        "Sales Executive",
        "Parent Plan Location",
        "Plan Type",
        "Activity / Purpose / Title",
        "Contact Person & Phone",
        "Visit Address / Location",
        "Discussed With Manager",
        "Discussed Manager",
        "Discussion Method",
        "Planned Time",
        "Actual Check-In",
        "Actual Check-Out",
        "Rescheduled Date",
        "Status",
        "Visit Purpose / Task Objective",
        "Notes & Description",
        "Outcome",
        "Completion Remarks",
        "In-Progress Remarks",
        "Pending Remarks",
        "Next Follow-Up Date",
        "Senior Remarks",
        "Meeting With Doctor",
        "Meeting With Purchase",
        "Meeting With Finance",
        "Meeting With Engineer",
        "New Product Introduced",
        "Order Received",
      ];

      const csvEscape = (val: unknown) => {
        if (val == null) return '""';
        const s = stripHtml(String(val)).trim();
        return `"${s.replace(/"/g, '""')}"`;
      };

      const rows: string[] = [];

      filteredPlanTree.forEach((p, pIdx) => {
        const planIndex = pIdx + 1;
        const execName = salesUserLabel(p.salesUser);
        const parentLocation = p.planLocation || "—";

        // 1. Work Plan Row
        rows.push([
          csvEscape(planIndex),
          csvEscape("WORK PLAN"),
          csvEscape(formatPlanDate(p.planDate)),
          csvEscape(execName),
          csvEscape(parentLocation),
          csvEscape(p.planType),
          csvEscape(`${p.planType} Plan (${p.totalVisits} Visits, ${p.totalTasks} Tasks)`),
          csvEscape("N/A"),
          csvEscape("N/A"),
          csvEscape(p.isDiscussedWithManager ? "Yes" : "No"),
          csvEscape(p.discussedManagerName || (p.isDiscussedWithManager ? "Manager" : "—")),
          csvEscape(p.isDiscussedWithManager ? formatDiscussionMethod(p.discussionMethod) : "—"),
          csvEscape("Full Day"),
          csvEscape("N/A"),
          csvEscape("N/A"),
          csvEscape("—"),
          csvEscape(p.planStatus),
          csvEscape(p.planRemarks || "—"),
          csvEscape(p.planRemarks || "—"),
          csvEscape(p.planStatus === "completed" ? "Completed" : "—"),
          csvEscape(p.planRemarks || "—"),
          csvEscape("N/A"),
          csvEscape("N/A"),
          csvEscape("N/A"),
          csvEscape(p.supervisoryRemarks || "—"),
          csvEscape("N/A"),
          csvEscape("N/A"),
          csvEscape("N/A"),
          csvEscape("N/A"),
          csvEscape("N/A"),
          csvEscape("N/A"),
        ].join(","));

        // 2. Field Visits Rows
        p.visits.forEach((v, vIdx) => {
          rows.push([
            csvEscape(`${planIndex}.${vIdx + 1}`),
            csvEscape("FIELD VISIT"),
            csvEscape(formatPlanDate(p.planDate)),
            csvEscape(execName),
            csvEscape(parentLocation),
            csvEscape("Field Visit"),
            csvEscape(v.partyName),
            csvEscape(v.contactInfo),
            csvEscape(v.address),
            csvEscape("N/A"),
            csvEscape("N/A"),
            csvEscape("N/A"),
            csvEscape(v.plannedTime),
            csvEscape(v.actualCheckIn || "—"),
            csvEscape(v.actualCheckOut || "—"),
            csvEscape(v.rescheduledDate || "—"),
            csvEscape(v.status),
            csvEscape(v.purpose || "Field Visit"),
            csvEscape(v.notes || "—"),
            csvEscape(v.outcome || "—"),
            csvEscape(v.completionRemarks || v.outcome || "—"),
            csvEscape(v.inProgressRemarks || "—"),
            csvEscape(v.pendingRemarks || "—"),
            csvEscape(v.nextFollowupDate || "—"),
            csvEscape(v.supervisoryRemarks || "—"),
            csvEscape(v.meetingWithDoctor ? "Yes" : "No"),
            csvEscape(v.meetingWithPurchase ? "Yes" : "No"),
            csvEscape(v.meetingWithFinance ? "Yes" : "No"),
            csvEscape(v.meetingWithEngineer ? "Yes" : "No"),
            csvEscape(v.newProductIntroduced ? "Yes" : "No"),
            csvEscape(v.orderReceived ? "Yes" : "No"),
          ].join(","));
        });

        // 3. Work Tasks Rows
        p.tasks.forEach((w, wIdx) => {
          rows.push([
            csvEscape(`${planIndex}.${p.visits.length + wIdx + 1}`),
            csvEscape("WORK TASK"),
            csvEscape(formatPlanDate(p.planDate)),
            csvEscape(execName),
            csvEscape(parentLocation),
            csvEscape("Work Task"),
            csvEscape(w.title),
            csvEscape("N/A"),
            csvEscape("N/A"),
            csvEscape("N/A"),
            csvEscape("N/A"),
            csvEscape("N/A"),
            csvEscape(w.plannedTime),
            csvEscape("N/A"),
            csvEscape("N/A"),
            csvEscape(w.rescheduledDate || "—"),
            csvEscape(w.status),
            csvEscape(w.title),
            csvEscape(w.description || "—"),
            csvEscape(w.outcome || w.remarks || "—"),
            csvEscape(w.completionRemarks || w.remarks || "—"),
            csvEscape(w.inProgressRemarks || "—"),
            csvEscape(w.pendingRemarks || "—"),
            csvEscape("N/A"),
            csvEscape(w.supervisoryRemarks || "—"),
            csvEscape("N/A"),
            csvEscape("N/A"),
            csvEscape("N/A"),
            csvEscape("N/A"),
            csvEscape("N/A"),
            csvEscape("N/A"),
          ].join(","));
        });
      });

      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `work_plans_hierarchy_report_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export CSV failed:", err);
    } finally {
      setDownloading(false);
    }
  }

  async function exportExcel() {
    setDownloadingExcel(true);
    try {
      const rows: Array<Record<string, string | number | null | undefined>> = [];
      let planIndex = 0;

      filteredPlanTree.forEach((p) => {
        planIndex += 1;
        const execName = salesUserLabel(p.salesUser);
        const parentLocation = p.planLocation || "—";

        const discSummary = p.isDiscussedWithManager
          ? `Discussed with ${p.discussedManagerName || "Manager"} (${formatDiscussionMethod(p.discussionMethod)})`
          : "";

        // 1. Work Plan Row
        rows.push({
          hierarchyId: `${planIndex}`,
          rowType: "WORK PLAN",
          date: formatPlanDate(p.planDate),
          executive: execName,
          parentPlanLocation: parentLocation,
          planType: p.planType,
          activity: p.planType === "Visits" ? `Visits Plan (${p.visits.length} Visits)` : `${p.planType} Plan (${p.tasks.length} Tasks)`,
          contacts: "N/A",
          visitAddress: "N/A",
          discussedWithManager: p.isDiscussedWithManager ? "Yes" : "No",
          discussedManagerName: p.discussedManagerName || (p.isDiscussedWithManager ? "Manager" : "—"),
          discussionMethod: p.isDiscussedWithManager ? formatDiscussionMethod(p.discussionMethod) : "—",
          plannedTime: "Full Day",
          actualCheckIn: "N/A",
          actualCheckOut: "N/A",
          rescheduledDate: "—",
          status: p.planStatus.toUpperCase(),
          purpose: stripHtml(p.planRemarks) || "—",
          description: [stripHtml(p.planRemarks), discSummary].filter(Boolean).join(" | ") || "—",
          outcome: p.planStatus === "completed" ? "Completed" : "—",
          completionRemarks: stripHtml(p.planRemarks) || "—",
          inProgressRemarks: "N/A",
          pendingRemarks: "N/A",
          nextFollowupDate: "N/A",
          supervisoryRemarks: p.supervisoryRemarks || "—",
          meetingDoctor: "N/A",
          meetingPurchase: "N/A",
          meetingFinance: "N/A",
          meetingEngineer: "N/A",
          newProductIntroduced: "N/A",
          orderReceived: "N/A",
        });

        // 2. Field Visits Rows
        p.visits.forEach((v, vIdx) => {
          rows.push({
            hierarchyId: `${planIndex}.${vIdx + 1}`,
            rowType: "FIELD VISIT",
            date: formatPlanDate(p.planDate),
            executive: execName,
            parentPlanLocation: parentLocation,
            planType: "Field Visit",
            activity: `Field Visit: ${v.partyName}`,
            contacts: v.contactInfo || "—",
            visitAddress: v.address || "—",
            discussedWithManager: "N/A",
            discussedManagerName: "N/A",
            discussionMethod: "N/A",
            plannedTime: v.plannedTime || "—",
            actualCheckIn: v.actualCheckIn || "—",
            actualCheckOut: v.actualCheckOut || "—",
            rescheduledDate: v.rescheduledDate || "—",
            status: v.status.toUpperCase(),
            purpose: stripHtml(v.purpose) || "Field Visit",
            description: stripHtml(v.notes) || "—",
            outcome: stripHtml(v.outcome) || "—",
            completionRemarks: stripHtml(v.completionRemarks || v.outcome) || "—",
            inProgressRemarks: stripHtml(v.inProgressRemarks) || "—",
            pendingRemarks: stripHtml(v.pendingRemarks) || "—",
            nextFollowupDate: v.nextFollowupDate || "—",
            supervisoryRemarks: v.supervisoryRemarks || "—",
            meetingDoctor: v.meetingWithDoctor ? "Yes" : "No",
            meetingPurchase: v.meetingWithPurchase ? "Yes" : "No",
            meetingFinance: v.meetingWithFinance ? "Yes" : "No",
            meetingEngineer: v.meetingWithEngineer ? "Yes" : "No",
            newProductIntroduced: v.newProductIntroduced ? "Yes" : "No",
            orderReceived: v.orderReceived ? "Yes" : "No",
          });
        });

        // 3. Work Tasks Rows
        p.tasks.forEach((w, wIdx) => {
          rows.push({
            hierarchyId: `${planIndex}.${p.visits.length + wIdx + 1}`,
            rowType: "WORK TASK",
            date: formatPlanDate(p.planDate),
            executive: execName,
            parentPlanLocation: parentLocation,
            planType: "Work Task",
            activity: `Work Task: ${w.title}`,
            contacts: "N/A",
            visitAddress: "N/A",
            discussedWithManager: "N/A",
            discussedManagerName: "N/A",
            discussionMethod: "N/A",
            plannedTime: w.plannedTime || "—",
            actualCheckIn: "N/A",
            actualCheckOut: "N/A",
            rescheduledDate: w.rescheduledDate || "—",
            status: w.status.toUpperCase(),
            purpose: stripHtml(w.title) || "Work Task",
            description: stripHtml(w.description) || "—",
            outcome: stripHtml(w.outcome || w.remarks) || "—",
            completionRemarks: stripHtml(w.completionRemarks || w.remarks) || "—",
            inProgressRemarks: stripHtml(w.inProgressRemarks) || "—",
            pendingRemarks: stripHtml(w.pendingRemarks) || "—",
            nextFollowupDate: "N/A",
            supervisoryRemarks: w.supervisoryRemarks || "—",
            meetingDoctor: "N/A",
            meetingPurchase: "N/A",
            meetingFinance: "N/A",
            meetingEngineer: "N/A",
            newProductIntroduced: "N/A",
            orderReceived: "N/A",
          });
        });
      });

      downloadExcelReport({
        filename: `work_plans_report_${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: "Work Plans Tree",
        title: "Work Plans Master Report",
        columns: [
          { key: "hierarchyId", label: "#" },
          { key: "rowType", label: "Record Level" },
          { key: "date", label: "Plan Date" },
          { key: "executive", label: "Executive / Representative" },
          { key: "parentPlanLocation", label: "Parent Plan Location" },
          { key: "planType", label: "Plan Type" },
          { key: "activity", label: "Activity / Purpose / Title" },
          { key: "contacts", label: "Contact Person & Phone" },
          { key: "visitAddress", label: "Visit Address / Location" },
          { key: "discussedWithManager", label: "Discussed With Manager" },
          { key: "discussedManagerName", label: "Discussed Manager" },
          { key: "discussionMethod", label: "Discussion Method" },
          { key: "plannedTime", label: "Schedule / Planned Time" },
          { key: "actualCheckIn", label: "Actual Check-In" },
          { key: "actualCheckOut", label: "Actual Check-Out" },
          { key: "rescheduledDate", label: "Rescheduled Date" },
          { key: "status", label: "Status" },
          { key: "purpose", label: "Visit Purpose / Task Objective" },
          { key: "description", label: "Notes & Description" },
          { key: "outcome", label: "Outcome" },
          { key: "completionRemarks", label: "Completion Remarks" },
          { key: "inProgressRemarks", label: "In-Progress Remarks" },
          { key: "pendingRemarks", label: "Pending Remarks" },
          { key: "nextFollowupDate", label: "Next Follow-Up Date" },
          { key: "supervisoryRemarks", label: "Senior Supervisory Remarks" },
          { key: "meetingDoctor", label: "Meeting With Doctor" },
          { key: "meetingPurchase", label: "Meeting With Purchase" },
          { key: "meetingFinance", label: "Meeting With Finance" },
          { key: "meetingEngineer", label: "Meeting With Engineer" },
          { key: "newProductIntroduced", label: "New Product Introduced" },
          { key: "orderReceived", label: "Order Received" },
        ],
        rows,
      });
    } catch (err) {
      console.error("Export Excel failed:", err);
    } finally {
      setDownloadingExcel(false);
    }
  }

  async function exportPdf() {
    setDownloadingPdf(true);
    try {
      const rows: Array<Record<string, string | number | null | undefined>> = [];
      let planIndex = 0;

      filteredPlanTree.forEach((p) => {
        planIndex += 1;
        const execName = salesUserLabel(p.salesUser);
        const parentLocation = p.planLocation || "—";

        // 1. Work Plan Row
        const discSummary = p.isDiscussedWithManager
          ? `Discussed with ${p.discussedManagerName || "Manager"} (${formatDiscussionMethod(p.discussionMethod)})`
          : "";
        rows.push({
          _rowType: "WORK PLAN",
          hierarchyId: `${planIndex}`,
          rowType: "WORK PLAN",
          date: formatPlanDate(p.planDate),
          executive: execName,
          parentPlanLocation: parentLocation,
          activity: p.planType === "Visits" ? `Visits Plan (${p.visits.length} Visits)` : `${p.planType} Plan (${p.tasks.length} Tasks)`,
          details: [p.planRemarks, discSummary].filter(Boolean).join(" | ") || "—",
          plannedTime: "Full Day",
          status: p.planStatus.toUpperCase(),
          remarks: [p.planRemarks, discSummary].filter(Boolean).join(" | ") || "—",
          supervisoryRemarks: p.supervisoryRemarks || "—",
        });

        // 2. Field Visits Rows
        p.visits.forEach((v, vIdx) => {
          const outcomeText = v.outcome ? stripHtml(v.outcome) : "";
          const notesText = v.checklistNotes ? stripHtml(v.checklistNotes) : "";
          const timeDisplay = v.rescheduledDate
            ? `${v.plannedTime || "—"} (Resch: ${v.rescheduledDate})`
            : (v.plannedTime || "—");
          rows.push({
            _rowType: "FIELD VISIT",
            hierarchyId: `${planIndex}.${vIdx + 1}`,
            rowType: "FIELD VISIT",
            date: formatPlanDate(p.planDate),
            executive: execName,
            parentPlanLocation: parentLocation,
            activity: `Field Visit: ${v.partyName}`,
            details: `${v.contactInfo ? v.contactInfo + " | " : ""}${v.address}`,
            plannedTime: timeDisplay,
            status: v.status.toUpperCase(),
            remarks: `${outcomeText ? "Outcome: " + outcomeText : ""}${notesText ? " Notes: " + notesText : ""}` || "—",
            supervisoryRemarks: v.supervisoryRemarks || "—",
          });
        });

        // 3. Work Tasks Rows
        p.tasks.forEach((w, wIdx) => {
          const timeDisplay = w.rescheduledDate
            ? `${w.plannedTime || "—"} (Resch: ${w.rescheduledDate})`
            : (w.plannedTime || "—");
          rows.push({
            _rowType: "WORK TASK",
            hierarchyId: `${planIndex}.${p.visits.length + wIdx + 1}`,
            rowType: "WORK TASK",
            date: formatPlanDate(p.planDate),
            executive: execName,
            parentPlanLocation: parentLocation,
            activity: `Work Task: ${w.title}`,
            details: stripHtml(w.description) || "—",
            plannedTime: timeDisplay,
            status: w.status.toUpperCase(),
            remarks: stripHtml(w.remarks) || "—",
            supervisoryRemarks: w.supervisoryRemarks || "—",
          });
        });
      });

      const user = readSessionFromStorage()?.user;
      const downloadedBy = user?.name ? `${user.name} (${user.email || user.department || "Executive"})` : user?.email || "System User";
      const timestamp = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

      const activeFilterPanel: Array<{ label: string; value: string }> = [
        { label: "Date Filter", value: datePreset === "custom" ? `${customFrom} to ${customTo}` : datePreset.toUpperCase() },
        { label: "Plan Type", value: planTypeFilter === "all" ? "All Types" : planTypeFilter },
        { label: "Activity / Items", value: activityTypeFilter === "all" ? "All (Visits & Tasks)" : activityTypeFilter === "visits" ? "Field Visits Only" : "Work Tasks Only" },
        { label: "Item Status", value: itemStatusFilter === "all" ? "All Item Statuses" : itemStatusFilter.toUpperCase() },
        { label: "Plan Status", value: statusFilter === "all" ? "All Statuses" : statusFilter.toUpperCase() },
        { label: "Party / Task Title", value: partyTitleFilter.trim() || "All" },
        { label: "Contact / Address", value: contactDetailsFilter.trim() || "All" },
        { label: "Location / City", value: locationCityFilter.trim() || "All Locations" },
        { label: "Executive", value: executiveFilter.trim() || "All Representatives" },
        { label: "Search Query", value: searchQuery.trim() || "None" },
      ];

      await downloadPdfReport({
        letterhead,
        filename: `work_plans_report_${new Date().toISOString().slice(0, 10)}.pdf`,
        title: "Work Plans Master Report",
        subtitle: `Work Plans & Field Activity Master Sheet`,
        downloadedBy,
        timestamp,
        filterPanel: activeFilterPanel,
        metadata: [
          { label: "Total Work Plans", value: String(summaryMetrics.totalPlans) },
          { label: "Field Visits", value: String(summaryMetrics.totalVisits) },
          { label: "Work Tasks", value: String(summaryMetrics.totalTasks) },
        ],
        columns: [
          { key: "hierarchyId", label: "#", width: 0.5, align: "left" },
          { key: "rowType", label: "Type", width: 0.8, align: "left" },
          { key: "date", label: "Date", width: 0.8, align: "left" },
          { key: "executive", label: "Sales Executive", width: 1.2, align: "left" },
          { key: "parentPlanLocation", label: "Plan Location", width: 1.1, align: "left" },
          { key: "activity", label: "Activity / Title / Party", width: 1.7, align: "left" },
          { key: "details", label: "Details / Address", width: 1.5, align: "left" },
          { key: "plannedTime", label: "Schedule / Time", width: 1.0, align: "center" },
          { key: "status", label: "Status", width: 0.8, align: "center" },
          { key: "remarks", label: "Remarks / Outcome", width: 1.3, align: "left" },
          { key: "supervisoryRemarks", label: "Senior Remarks", width: 1.5, align: "left" },
        ],
        rows,
      });
    } catch (err) {
      console.error("Export PDF failed:", err);
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full h-full max-w-[98vw] max-h-[96vh] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Google Sheet Header Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border bg-surface-muted/40 px-4 sm:px-5 py-3 sm:py-3.5 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                  Work Plans Master Report (Work Plans & Field Activity View)
                </h2>
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Google Sheet Tree Mode
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted truncate">
                Displaying {summaryMetrics.totalPlans} Work Plans with {summaryMetrics.totalVisits} Field Visits and {summaryMetrics.totalTasks} Work Tasks
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("tree")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold active:scale-95 transition ${
                  viewMode === "tree"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Tree
              </button>
              <button
                type="button"
                onClick={() => setViewMode("flat")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold active:scale-95 transition ${
                  viewMode === "flat"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Table className="h-3.5 w-3.5" />
                Flat
              </button>
            </div>

            {viewMode === "tree" && (
              <button
                type="button"
                onClick={toggleCollapseAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition"
              >
                <FolderOpen className="h-3.5 w-3.5 text-primary" />
                {allCollapsed ? "Expand" : "Collapse"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowFilterPanel((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold active:scale-95 transition ${
                showFilterPanel
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:bg-surface-muted"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
              {activeFiltersCount > 0 && (
                <span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.2 text-[10px] font-bold text-primary-foreground">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={loadReportData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition disabled:opacity-50"
              title="Refresh sheet data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              disabled={downloading || filteredPlanTree.length === 0}
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 active:scale-95 disabled:opacity-50 transition shadow-xs"
            >
              <Download className="h-4 w-4" />
              {downloading ? "Exporting…" : "CSV"}
            </button>
            <button
              type="button"
              disabled={downloadingExcel || filteredPlanTree.length === 0}
              onClick={exportExcel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-600 text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition shadow-xs"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {downloadingExcel ? "Generating…" : "Excel"}
            </button>
            <button
              type="button"
              disabled={downloadingPdf || filteredPlanTree.length === 0}
              onClick={exportPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 active:scale-95 disabled:opacity-50 transition shadow-xs"
            >
              <Download className="h-4 w-4" />
              {downloadingPdf ? "Generating…" : "PDF"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground active:scale-90 transition ml-auto sm:ml-0"
              title="Close report modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Dedicated Expandable Filter Panel */}
        {showFilterPanel && (
          <div className="border-b border-border bg-card p-4 space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Work Plan & Field Activity Filter Panel
                </h4>
                {activeFiltersCount > 0 && (
                  <span className="text-[11px] text-muted">({activeFiltersCount} active filters)</span>
                )}
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs text-rose-500 hover:underline font-semibold"
              >
                <RotateCcw className="h-3 w-3" /> Reset All Filters
              </button>
            </div>

            {/* Filter Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* 1. Plan Date Range */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Plan Date</label>
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value as ReportDatePreset)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="current_month">Current Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {/* 2. Plan Type */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Plan Type</label>
                <select
                  value={planTypeFilter}
                  onChange={(e) => setPlanTypeFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="all">All Plan Types</option>
                  <option value="Visits">Visits</option>
                  <option value="Leave">Leave</option>
                  <option value="Work From Home">Work From Home</option>
                  <option value="Work From Office">Work From Office</option>
                </select>
              </div>

              {/* 3. Visits & Tasks Activity Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Visits &amp; Tasks</label>
                <select
                  value={activityTypeFilter}
                  onChange={(e) => setActivityTypeFilter(e.target.value as ActivityTypeFilter)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary font-medium text-cyan-600 dark:text-cyan-400"
                >
                  <option value="all">All (Visits &amp; Tasks)</option>
                  <option value="visits">Field Visits Only</option>
                  <option value="tasks">Work Tasks Only</option>
                </select>
              </div>

              {/* 4. Visit / Task Item Status */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Visit / Task Status</label>
                <select
                  value={itemStatusFilter}
                  onChange={(e) => setItemStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="all">All Item Statuses</option>
                  <option value="created">Created</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* 5. Overall Plan Status */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Overall Plan Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="all">All Plan Statuses</option>
                  <option value="planned">Planned</option>
                  <option value="submitted">Submitted (Pending Approval)</option>
                  <option value="approved">Approved</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* 6. Location / City */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Location / City</label>
                <input
                  type="text"
                  placeholder="e.g. Indore, Bhopal..."
                  value={locationCityFilter}
                  onChange={(e) => setLocationCityFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* 7. Party Name & Task Title Search */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Party Name &amp; Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Fortis, AIIMS, Demo..."
                  value={partyTitleFilter}
                  onChange={(e) => setPartyTitleFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* 8. Contact Details & Address Search */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Contact Details &amp; Address</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Verma, 98260..."
                  value={contactDetailsFilter}
                  onChange={(e) => setContactDetailsFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* 9. Team Filter (elevated users only) */}
              {elevatedRole && teamOptions.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted flex items-center gap-1">
                    <Network className="h-3 w-3" /> Team
                  </label>
                  <select
                    value={teamFilter}
                    onChange={(e) => {
                      setTeamFilter(e.target.value);
                      setExecutiveFilter("");
                    }}
                    className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="all">All Teams</option>
                    {teamOptions.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 10. Sales Executive Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Sales Executive</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul, executive@..."
                  value={executiveFilter}
                  onChange={(e) => setExecutiveFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Custom Dates & Search Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {datePreset === "custom" && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs">
                  <span className="text-muted text-[11px] font-semibold">From Date:</span>
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="bg-transparent text-foreground outline-none text-xs"
                  />
                  <span className="text-muted text-[11px] font-semibold ml-2">To Date:</span>
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="bg-transparent text-foreground outline-none text-xs"
                  />
                </div>
              )}

              <div className="relative min-w-[280px] flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Search executive, party name, contact, task, outcome, remarks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Work Plan + Visits / Tasks Table */}
        <div className="flex-1 overflow-auto bg-card">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-xs text-muted gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              Loading work plans & items…
            </div>
          ) : filteredPlanTree.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-muted p-6 text-center">
              <Table className="h-10 w-10 text-muted/50 mb-2" />
              <p className="text-sm font-semibold text-foreground">No matching work plans found</p>
              <p className="text-xs text-muted mt-1">Try resetting or broadening your filters.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-border bg-surface-muted/90 text-[11px] font-bold text-muted uppercase tracking-wider select-none sticky top-0 z-10 shadow-xs">
                  <th className="w-14 border-r border-border px-3 py-2 text-center bg-surface-muted">
                    #
                  </th>
                  <th className="border-r border-border px-3 py-2 w-36">
                    <span className="text-[9px] text-muted/70 block">A</span>
                    Plan Date
                  </th>
                  <th className="border-r border-border px-3 py-2 w-44">
                    <span className="text-[9px] text-muted/70 block">B</span>
                    Sales Executive
                  </th>
                  <th className="border-r border-border px-3 py-2 w-32">
                    <span className="text-[9px] text-muted/70 block">C</span>
                    Plan / Activity
                  </th>
                  <th className="border-r border-border px-3 py-2 w-52">
                    <span className="text-[9px] text-muted/70 block">D</span>
                    Party / Task Title
                  </th>
                  <th className="border-r border-border px-3 py-2 w-48">
                    <span className="text-[9px] text-muted/70 block">E</span>
                    Contact / Details
                  </th>
                  <th className="border-r border-border px-3 py-2 w-48">
                    <span className="text-[9px] text-muted/70 block">F</span>
                    Parent Location &amp; Visit Address
                  </th>
                  <th className="border-r border-border px-3 py-2 w-40">
                    <span className="text-[9px] text-muted/70 block">G</span>
                    Time / Schedule
                  </th>
                  <th className="border-r border-border px-3 py-2 w-32">
                    <span className="text-[9px] text-muted/70 block">H</span>
                    Status
                  </th>
                  <th className="border-r border-border px-3 py-2 min-w-[180px]">
                    <span className="text-[9px] text-muted/70 block">I</span>
                    Outcome / Remarks
                  </th>
                  <th className="border-r border-border px-3 py-2 min-w-[220px]">
                    <span className="text-[9px] text-muted/70 block">J</span>
                    Manager &amp; Authority Remarks
                  </th>
                  <th className="px-3 py-2 min-w-[160px]">
                    <span className="text-[9px] text-muted/70 block">K</span>
                    Meeting Checklist
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {viewMode === "tree" ? (
                  filteredPlanTree.map((p, pIdx) => {
                    const parentId = p.planId || `p-${pIdx}`;
                    const isCollapsed = Boolean(collapsedPlanIds[parentId]);
                    const parentRowIndex = pIdx + 1;
                    const totalItems = p.visits.length + p.tasks.length;

                    return (
                      <tbody key={parentId} className="contents">
                        {/* WORK PLAN ROW */}
                        <tr className="border-t-2 border-b border-border bg-surface-muted/90 font-semibold text-foreground hover:bg-surface-muted transition select-none">
                          {/* 0. Index & Toggle */}
                          <td className="border-r border-border px-3 py-2.5 text-center font-mono font-bold bg-surface-muted/60">
                            <button
                              type="button"
                              onClick={() => togglePlanCollapse(parentId)}
                              className="flex items-center justify-center gap-1 w-full text-foreground hover:text-primary cursor-pointer"
                              title={isCollapsed ? "Expand visits & tasks" : "Collapse visits & tasks"}
                            >
                              {totalItems > 0 ? (
                                isCollapsed ? (
                                  <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-primary shrink-0" />
                                )
                              ) : null}
                              <span>{parentRowIndex}</span>
                            </button>
                          </td>

                          {/* 1. Plan Date */}
                          <td className="border-r border-border px-3 py-2.5 font-bold text-foreground whitespace-nowrap">
                            {formatPlanDate(p.planDate)}
                          </td>

                          {/* 2. Sales Executive */}
                          <td className="border-r border-border px-3 py-2.5 font-bold text-foreground whitespace-nowrap">
                            <div>{salesUserLabel(p.salesUser)}</div>
                            {p.isDiscussedWithManager && (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                                <MessageSquare className="h-3 w-3 shrink-0 inline" />
                                <span>Discussed ({p.discussedManagerName || "Manager"})</span>
                              </div>
                            )}
                          </td>

                          {/* 3. Plan Type */}
                          <td className="border-r border-border px-3 py-2.5 whitespace-nowrap">
                            <span className="rounded bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-bold">
                              {p.planType} Plan
                            </span>
                          </td>

                          {/* 4. Summary Title */}
                          <td className="border-r border-border px-3 py-2.5 font-bold text-foreground truncate max-w-[200px]">
                            {p.planType === "Leave"
                              ? "Leave Day"
                              : `${p.totalVisits} Visits · ${p.totalTasks} Tasks`}
                          </td>

                          {/* 5. Contact Details / Plan Remarks */}
                          <td className="border-r border-border px-3 py-2.5 text-muted text-xs truncate max-w-[180px]">
                            {p.planRemarks || "—"}
                          </td>

                          {/* 6. Parent Plan Location */}
                          <td className="border-r border-border px-3 py-2.5 font-semibold text-foreground truncate max-w-[180px]">
                            <div className="flex items-center gap-1.5 text-primary dark:text-primary">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                              <span>{p.planLocation || "—"}</span>
                            </div>
                          </td>

                          {/* 7. Time */}
                          <td className="border-r border-border px-3 py-2.5 text-muted font-mono text-[11px]">
                            Full Day
                          </td>

                          {/* 8. Overall Status */}
                          <td className="border-r border-border px-3 py-2.5 whitespace-nowrap">
                            {renderPlanStatusBadge(p.planStatus)}
                          </td>

                          {/* 9. Remarks & Outcomes */}
                          <td className="border-r border-border px-3 py-2.5 text-foreground truncate max-w-[220px]">
                            {p.planRemarks || "—"}
                          </td>

                          {/* 10. Manager & Senior Authority Remarks */}
                          <td className="border-r border-border px-3 py-2.5">
                            {renderSupervisoryRemarksCell(p.managerRemarks, p.authorityRemarks)}
                          </td>

                          {/* 11. Checklist */}
                          <td className="px-3 py-2.5 text-muted text-[11px]">
                            {totalItems > 0
                              ? `${p.visits.length} visits, ${p.tasks.length} tasks`
                              : "No items"}
                          </td>
                        </tr>

                        {/* VISITS & TASKS ROWS (rendered when not collapsed) */}
                        {!isCollapsed && (
                          <>
                            {/* Field Visits */}
                            {p.visits.map((v, vIdx) => (
                              <tr
                                key={v.id}
                                className="bg-card hover:bg-surface-muted/60 transition border-b border-border/50"
                              >
                                {/* 0. Item Index */}
                                <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono text-[11px] bg-surface-muted/30 pl-4">
                                  {parentRowIndex}.{vIdx + 1}
                                </td>

                                {/* 1. Plan Date */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[11px] whitespace-nowrap">
                                  {formatPlanDate(p.planDate)}
                                </td>

                                {/* 2. Executive */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted truncate text-[11px]">
                                  {salesUserLabel(p.salesUser)}
                                </td>

                                {/* 3. Activity Type (Indented) */}
                                <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap pl-4">
                                  <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 text-[10px] font-bold">
                                    <CornerDownRight className="h-3 w-3 shrink-0" />
                                    Visit #{v.sequence}
                                  </span>
                                </td>

                                {/* 4. Party Name */}
                                <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground truncate max-w-[200px]">
                                  {v.partyName}
                                </td>

                                {/* 5. Contact Info */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted truncate max-w-[200px]">
                                  {v.contactInfo}
                                </td>

                                {/* 6. Location (Visit Address + Parent Plan Location) */}
                                <td className="border-r border-border/60 px-3 py-2 text-foreground truncate max-w-[180px]">
                                  <div className="font-medium text-xs truncate">{v.address || "—"}</div>
                                  {p.planLocation && (
                                    <div className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                                      <MapPin className="h-2.5 w-2.5 shrink-0 text-muted/70" />
                                      <span className="truncate">Plan: {p.planLocation}</span>
                                    </div>
                                  )}
                                </td>

                                {/* 7. Planned & Actual Time + Rescheduled Date */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[10px]">
                                  <div>{v.plannedTime}</div>
                                  {v.rescheduledDate && (
                                    <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                      <CalendarClock className="h-3 w-3 shrink-0" />
                                      Rescheduled: {v.rescheduledDate}
                                    </div>
                                  )}
                                  {v.actualTime !== "—" && (
                                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">{v.actualTime}</div>
                                  )}
                                </td>

                                {/* 8. Visit Status */}
                                <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                                  {renderVisitStatusBadge(v.status)}
                                </td>

                                {/* 9. Visit Outcome */}
                                <td className="border-r border-border/60 px-3 py-2 font-medium text-foreground truncate max-w-[250px]">
                                  {v.outcome}
                                </td>

                                {/* 10. Manager & Senior Authority Remarks */}
                                <td className="border-r border-border/60 px-3 py-2">
                                  {renderSupervisoryRemarksCell(v.managerRemarks, v.authorityRemarks)}
                                </td>

                                {/* 11. Doctor/Purchase Checklist Notes */}
                                <td className="px-3 py-2 text-muted truncate max-w-[200px] text-[10px]">
                                  {v.checklistNotes}
                                </td>
                              </tr>
                            ))}

                            {/* Work Tasks */}
                            {p.tasks.map((w, wIdx) => (
                              <tr
                                key={w.id}
                                className="bg-card hover:bg-surface-muted/60 transition border-b border-border/50"
                              >
                                {/* 0. Item Index */}
                                <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono text-[11px] bg-surface-muted/30 pl-4">
                                  {parentRowIndex}.{p.visits.length + wIdx + 1}
                                </td>

                                {/* 1. Plan Date */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[11px] whitespace-nowrap">
                                  {formatPlanDate(p.planDate)}
                                </td>

                                {/* 2. Executive */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted truncate text-[11px]">
                                  {salesUserLabel(p.salesUser)}
                                </td>

                                {/* 3. Activity Type (Indented) */}
                                <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap pl-4">
                                  <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[10px] font-bold">
                                    <CornerDownRight className="h-3 w-3 shrink-0" />
                                    Task #{w.sequence}
                                  </span>
                                </td>

                                {/* 4. Task Title */}
                                <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground truncate max-w-[200px]">
                                  {w.title}
                                </td>

                                {/* 5. Task Description */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted truncate max-w-[200px]">
                                  {w.description}
                                </td>

                                {/* 6. Parent Plan Location */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted truncate max-w-[180px]">
                                  <div className="flex items-center gap-1 text-xs">
                                    <MapPin className="h-3 w-3 shrink-0 text-muted/70" />
                                    <span className="truncate">Plan: {p.planLocation || "Office / Remote"}</span>
                                  </div>
                                </td>

                                {/* 7. Time + Rescheduled Date */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[10px]">
                                  <div>{w.plannedTime}</div>
                                  {w.rescheduledDate && (
                                    <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                      <CalendarClock className="h-3 w-3 shrink-0" />
                                      Rescheduled: {w.rescheduledDate}
                                    </div>
                                  )}
                                </td>

                                {/* 8. Task Status */}
                                <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                                  <span
                                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                      w.status === "completed"
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    }`}
                                  >
                                    {w.status}
                                  </span>
                                </td>

                                {/* 9. Task Completion Remarks / Outcome */}
                                <td className="border-r border-border/60 px-3 py-2 font-medium text-foreground truncate max-w-[250px]">
                                  {w.remarks}
                                </td>

                                {/* 10. Manager & Senior Authority Remarks */}
                                <td className="border-r border-border/60 px-3 py-2">
                                  {renderSupervisoryRemarksCell(w.managerRemarks, w.authorityRemarks)}
                                </td>

                                {/* 11. Checklist */}
                                <td className="px-3 py-2 text-muted text-[10px]">
                                  N/A
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                      </tbody>
                    );
                  })
                ) : (
                  /* FLAT ACTIVITY LIST VIEW */
                  filteredPlanTree.flatMap((p, pIdx) => {
                    const parentRowIndex = pIdx + 1;
                    const items = [];

                    // If plan has no visits and no tasks (e.g. Leave or empty day)
                    if (p.visits.length === 0 && p.tasks.length === 0) {
                      items.push(
                        <tr key={`flat-p-${p.planId}`} className="bg-card hover:bg-surface-muted/60 transition border-b border-border/50">
                          <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono text-[11px]">{parentRowIndex}</td>
                          <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground whitespace-nowrap">{formatPlanDate(p.planDate)}</td>
                          <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground whitespace-nowrap">{salesUserLabel(p.salesUser)}</td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                            <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">{p.planType} Plan</span>
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground">{p.planType === "Leave" ? "Leave Day" : "No plan activities"}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted">{p.planRemarks || "—"}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-primary font-semibold">
                            <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.planLocation || "—"}</div>
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[10px]">Full Day</td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">{renderPlanStatusBadge(p.planStatus)}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-foreground font-medium">{p.planRemarks || "—"}</td>
                          <td className="border-r border-border/60 px-3 py-2">{renderSupervisoryRemarksCell(p.managerRemarks, p.authorityRemarks)}</td>
                          <td className="px-3 py-2 text-muted text-[10px]">N/A</td>
                        </tr>
                      );
                    }

                    // Flat Visits
                    p.visits.forEach((v, vIdx) => {
                      items.push(
                        <tr key={`flat-v-${v.id}`} className="bg-card hover:bg-surface-muted/60 transition border-b border-border/50">
                          <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono text-[11px]">{parentRowIndex}.{vIdx + 1}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-foreground font-semibold whitespace-nowrap">{formatPlanDate(p.planDate)}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-foreground font-semibold whitespace-nowrap">{salesUserLabel(p.salesUser)}</td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                            <span className="rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 text-[10px] font-bold">Field Visit #{v.sequence}</span>
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground max-w-[200px] truncate">{v.partyName}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted max-w-[200px] truncate">{v.contactInfo}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-foreground max-w-[180px] truncate">
                            <div className="font-medium text-xs truncate">{v.address || "—"}</div>
                            {p.planLocation && (
                              <div className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                                <MapPin className="h-2.5 w-2.5 shrink-0 text-muted/70" />
                                <span className="truncate">Plan: {p.planLocation}</span>
                              </div>
                            )}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[10px]">
                            <div>{v.plannedTime}</div>
                            {v.rescheduledDate && (
                              <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                <CalendarClock className="h-3 w-3 shrink-0" />
                                Rescheduled: {v.rescheduledDate}
                              </div>
                            )}
                            {v.actualTime !== "—" && <div className="text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">{v.actualTime}</div>}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">{renderVisitStatusBadge(v.status)}</td>
                          <td className="border-r border-border/60 px-3 py-2 font-medium text-foreground max-w-[250px] truncate">{v.outcome}</td>
                          <td className="border-r border-border/60 px-3 py-2">{renderSupervisoryRemarksCell(v.managerRemarks, v.authorityRemarks)}</td>
                          <td className="px-3 py-2 text-muted max-w-[200px] truncate text-[10px]">{v.checklistNotes}</td>
                        </tr>
                      );
                    });

                    // Flat Tasks
                    p.tasks.forEach((w, wIdx) => {
                      items.push(
                        <tr key={`flat-w-${w.id}`} className="bg-card hover:bg-surface-muted/60 transition border-b border-border/50">
                          <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono text-[11px]">{parentRowIndex}.{p.visits.length + wIdx + 1}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-foreground font-semibold whitespace-nowrap">{formatPlanDate(p.planDate)}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-foreground font-semibold whitespace-nowrap">{salesUserLabel(p.salesUser)}</td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                            <span className="rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[10px] font-bold">Work Task #{w.sequence}</span>
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground max-w-[200px] truncate">{w.title}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted max-w-[200px] truncate">{w.description}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted max-w-[180px] truncate">
                            <div className="flex items-center gap-1 text-xs">
                              <MapPin className="h-3 w-3 shrink-0 text-muted/70" />
                              <span className="truncate">Plan: {p.planLocation || "Office / Remote"}</span>
                            </div>
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[10px]">
                            <div>{w.plannedTime}</div>
                            {w.rescheduledDate && (
                              <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                <CalendarClock className="h-3 w-3 shrink-0" />
                                Rescheduled: {w.rescheduledDate}
                              </div>
                            )}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                            <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${w.status === "completed" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
                              {w.status}
                            </span>
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 font-medium text-foreground max-w-[250px] truncate">{w.remarks}</td>
                          <td className="border-r border-border/60 px-3 py-2">{renderSupervisoryRemarksCell(w.managerRemarks, w.authorityRemarks)}</td>
                          <td className="px-3 py-2 text-muted text-[10px]">N/A</td>
                        </tr>
                      );
                    });

                    return items;
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Spreadsheet Status Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted/50 px-5 py-3 text-xs">
          <div className="flex items-center gap-4 text-muted">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Sheet Tree Active
            </span>
            <span>Total Work Plans: <strong className="text-foreground">{summaryMetrics.totalPlans}</strong></span>
            <span>Field Visits: <strong className="text-cyan-600 dark:text-cyan-400">{summaryMetrics.totalVisits}</strong></span>
            <span>Work Tasks: <strong className="text-purple-600 dark:text-purple-400">{summaryMetrics.totalTasks}</strong></span>
            <span>Completed Plans: <strong className="text-emerald-600 dark:text-emerald-400">{summaryMetrics.completedPlans}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded bg-card border border-border px-2.5 py-1 text-[11px] font-bold text-muted">
              Sheet1: Work Plans & Field Activity
            </span>
            <button
              type="button"
              disabled={downloading || filteredPlanTree.length === 0}
              onClick={exportCsv}
              className="inline-flex items-center gap-1 rounded bg-surface-muted border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-card disabled:opacity-50 transition"
            >
              <Download className="h-3.5 w-3.5 text-muted" />
              Export CSV
            </button>
            <button
              type="button"
              disabled={downloadingExcel || filteredPlanTree.length === 0}
              onClick={exportExcel}
              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DownloadWorkPlansModal;
