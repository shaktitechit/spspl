"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  X,
  Search,
  Download,
  SlidersHorizontal,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Phone,
  Mail,
  Building2,
  UserCheck,
  CheckCircle2,
  CalendarPlus,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  ChevronDown,
  Package,
  ShieldAlert,
  MessageSquarePlus,
  MessageSquare,
  StickyNote,
  Users,
  History,
  Send,
  Clock,
  Calendar,
} from "lucide-react";
import { LargeModalPortal } from "@/components/portal/shared/LargeModalPortal";
import { ModalOverlay } from "@/components/portal/shared/ModalOverlay";
import {
  useListLeadsQuery,
  useUpdateLeadMutation,
  useAssignLeadMutation,
  useDeleteLeadMutation,
  useBulkDeleteLeadsMutation,
  useListLeadSourcesQuery,
  useListUsersQuery,
  useCreateLeadFollowUpMutation,
  useListLeadFollowUpsQuery,
  type LeadRecord,
  type LeadStatus,
  type LeadPriority,
  type LeadProductItem,
  type LeadFollowUpType,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import {
  formatLeadDate,
  formatCurrencyINR,
  formatLeadAssignees,
  splitLeadAssignees,
  isFollowUpOverdue,
  isFollowUpToday,
  isLeadAdmin,
  canAssignLead,
  canDeleteLead,
  canScheduleFollowUp,
  canViewLeadPricing,
  leadEstimatedValue,
  ALLOWED_STATUS_TRANSITIONS,
  LEAD_STATUS_CONFIG,
  LEAD_PRIORITY_CONFIG,
  isUserInLeadManagerPortal,
  getLeadManagerPortalRole,
  getDeptLabel,
  getLeadDepartments,
  DEFAULT_INDUSTRIES,
} from "../../leadUtils";
import { useLeadDepartmentOptions } from "../../useLeadDepartmentOptions";
import { AssignLeadModal } from "./AssignLeadModal";
import { FollowUpModal } from "./FollowUpModal";
import { ConfirmDeleteLeadModal } from "./ConfirmDeleteLeadModal";
import { DownloadLeadsPreviewModal } from "./DownloadLeadsPreviewModal";

export type GoogleSheetLeadsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  portalHome?: string;
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

type LeadRow = {
  _id: string;
  lead_no: string;
  name: string;
  company_name?: string;
  departments?: string;
  phone?: string;
  email?: string;
  status: LeadStatus;
  priority: LeadPriority;
  source: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  primary_assignee_id: string;
  primary_assignee_name: string;
  secondary_assignee_ids: string[];
  secondary_assignees_name: string;
  total_quantity: number;
  estimated_value: number;
  products_list: LeadProductItem[];
  products_summary: string;
  requirement_summary: string;
  required_products: string;
  city?: string;
  state?: string;
  industry?: string;
  requirement?: string;
  next_follow_up_at?: string;
  last_remarks: string;
  lost_reason?: string;
  lost_remarks?: string;
  notes?: string;
  createdAt?: string;
  created_by_name: string;
  raw: LeadRecord;
};

type SelectedCell = {
  leadId: string;
  colKey: keyof LeadRow;
} | null;

function formatProductsSummary(products?: LeadProductItem[], requirement?: string): string {
  const parts: string[] = [];
  if (Array.isArray(products) && products.length > 0) {
    const prodLines = products.map((p) => {
      const name = p.product_name || "Product";
      const qty = Number(p.quantity || 0);
      const unit = p.unit ? ` ${p.unit}` : " pcs";
      return `${name} - ${qty}${unit}`;
    });
    parts.push(prodLines.join(", "));
  }
  if (requirement && requirement.trim()) {
    parts.push(requirement.trim());
  }
  return parts.join(" • ") || "—";
}

const COLUMNS: {
  key: keyof LeadRow;
  label: string;
  headerLetter: string;
  readonly?: boolean;
  type: "text" | "number" | "select" | "date";
  options?: string[];
  widthPdf?: number;
}[] = [
  { key: "lead_no", label: "Lead No", headerLetter: "A", readonly: true, type: "text", widthPdf: 1.2 },
  { key: "createdAt", label: "Created Date", headerLetter: "B", readonly: true, type: "text", widthPdf: 1.2 },
  { key: "company_name", label: "Organization", headerLetter: "C", type: "text", widthPdf: 1.6 },
  { key: "name", label: "Contact Person*", headerLetter: "D", type: "text", widthPdf: 1.4 },
  { key: "departments", label: "Departments", headerLetter: "E", type: "text", widthPdf: 1.3 },
  { key: "phone", label: "Phone", headerLetter: "F", type: "text", widthPdf: 1.2 },
  { key: "email", label: "Email", headerLetter: "G", type: "text", widthPdf: 1.5 },
  {
    key: "status",
    label: "Status*",
    headerLetter: "H",
    type: "select",
    options: [
      "new",
      "assigned",
      "follow_up",
      "quotation",
      "won",
      "lost",
      "converted",
    ],
    widthPdf: 1.1,
  },
  {
    key: "priority",
    label: "Priority",
    headerLetter: "I",
    type: "select",
    options: ["low", "medium", "high", "urgent"],
    widthPdf: 1.0,
  },
  { key: "source", label: "Source*", headerLetter: "J", type: "text", widthPdf: 1.2 },
  { key: "primary_assignee_name", label: "Primary Assignee", headerLetter: "K", type: "select", widthPdf: 1.4 },
  { key: "secondary_assignees_name", label: "Secondary Assignees", headerLetter: "L", type: "text", widthPdf: 1.5 },
  { key: "requirement_summary", label: "Requirement Summary & Scope", headerLetter: "M", type: "text", widthPdf: 2.0 },
  { key: "required_products", label: "Required Products", headerLetter: "N", readonly: true, type: "text", widthPdf: 1.8 },
  { key: "total_quantity", label: "Est. Qty", headerLetter: "O", type: "number", widthPdf: 0.9 },
  { key: "estimated_value", label: "Est. Value", headerLetter: "P", type: "number", widthPdf: 1.2 },
  { key: "city", label: "City", headerLetter: "Q", type: "text", widthPdf: 1.1 },
  { key: "state", label: "State", headerLetter: "R", type: "text", widthPdf: 1.1 },
  { key: "industry", label: "Industry", headerLetter: "S", type: "select", options: DEFAULT_INDUSTRIES, widthPdf: 1.4 },
  { key: "next_follow_up_at", label: "Next Follow-up", headerLetter: "T", type: "date", widthPdf: 1.3 },
  { key: "last_remarks", label: "Last Remarks", headerLetter: "U", readonly: false, type: "text", widthPdf: 2.2 },
  { key: "lost_reason", label: "Lost Reason", headerLetter: "V", type: "text", widthPdf: 1.3 },
  { key: "created_by_name", label: "Created By", headerLetter: "W", readonly: true, type: "text", widthPdf: 1.3 },
];

import { readSessionFromStorage } from "@/utils/authStorage";

type LiveAddRemarkModalProps = {
  row: LeadRow;
  open: boolean;
  onClose: () => void;
  onSuccess: (leadId: string, remarkText: string, nextFollowUpAt?: string) => void;
};

function LiveAddRemarkModal({ row, open, onClose, onSuccess }: LiveAddRemarkModalProps) {
  const [remarkType, setRemarkType] = useState<LeadFollowUpType>("note");
  const [remarkText, setRemarkText] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);

  const defaultNext = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(11, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  }, []);

  const [nextDate, setNextDate] = useState(defaultNext);
  const [showHistory, setShowHistory] = useState(false);

  const [createFollowUp, { isLoading: isSubmitting }] = useCreateLeadFollowUpMutation();
  const [updateLead] = useUpdateLeadMutation();
  const { data: followUps = [], isLoading: isLoadingHistory } = useListLeadFollowUpsQuery(
    row._id,
    { skip: !open }
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => textareaRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = remarkText.trim();
    if (!clean) {
      toast.error("Please enter a follow-up remark or note");
      return;
    }

    try {
      let scheduledIso: string | undefined = undefined;
      if (scheduleNext && nextDate) {
        scheduledIso = new Date(nextDate).toISOString();
      }

      // 1. Create the follow-up entry
      await createFollowUp({
        leadId: row._id,
        type: remarkType,
        notes: clean,
        follow_up_date: scheduledIso || new Date().toISOString(),
      }).unwrap();

      // 2. If next follow-up date was scheduled, update lead's next_follow_up_at pointer
      if (scheduledIso) {
        await updateLead({
          id: row._id,
          body: { next_follow_up_at: scheduledIso },
        }).unwrap();
      }

      toast.success("Follow-up remark recorded live!");
      onSuccess(row._id, clean, scheduledIso);
      onClose();
    } catch (err: any) {
      toast.error(mutationRejectedMessage(err) || "Failed to record follow-up remark");
    }
  };

  const TYPE_OPTIONS: Array<{ value: LeadFollowUpType; label: string; icon: any }> = [
    { value: "note", label: "Note", icon: StickyNote },
    { value: "call", label: "Call", icon: Phone },
    { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
    { value: "meeting", label: "Meeting", icon: Users },
    { value: "email", label: "Email", icon: Mail },
  ];

  return (
    <LargeModalPortal>
      <ModalOverlay onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <MessageSquarePlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Add Follow-Up Remark</span>
                  <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                    Live
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-sm">
                  Lead #{row.lead_no} • {row.company_name || row.name || "Customer"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Follow-up Touchpoint Type Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Channel / Touchpoint Type
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = remarkType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRemarkType(opt.value)}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[11px] font-semibold transition cursor-pointer ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500 shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Remark Textarea */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Follow-Up Remark / Discussion Notes <span className="text-rose-500">*</span>
              </label>
              <textarea
                ref={textareaRef}
                rows={3}
                value={remarkText}
                onChange={(e) => setRemarkText(e.target.value)}
                placeholder="Enter client conversation notes, client feedback, next steps, or latest touchpoint outcome..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:focus:bg-slate-800 resize-none"
              />
            </div>

            {/* Next Follow-Up Scheduling (Optional) */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={scheduleNext}
                  onChange={(e) => setScheduleNext(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <CalendarPlus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Schedule / Update Next Follow-Up Date
                </span>
              </label>

              {scheduleNext && (
                <div className="space-y-2 pl-6 animate-in fade-in duration-150">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        d.setHours(11, 0, 0, 0);
                        setNextDate(d.toISOString().slice(0, 16));
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                    >
                      Tomorrow 11 AM
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 3);
                        d.setHours(11, 0, 0, 0);
                        setNextDate(d.toISOString().slice(0, 16));
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                    >
                      In 3 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 7);
                        d.setHours(11, 0, 0, 0);
                        setNextDate(d.toISOString().slice(0, 16));
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                    >
                      In 1 Week
                    </button>
                  </div>
                  <input
                    type="datetime-local"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              )}
            </div>

            {/* Toggle Past Remarks History */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                <History className="h-3.5 w-3.5" />
                <span>{showHistory ? "Hide Past Remarks" : "View Past Remarks History"}</span>
                {followUps.length > 0 && (
                  <span className="rounded-full bg-slate-200/70 dark:bg-slate-700 px-1.5 text-[10px]">
                    {followUps.length}
                  </span>
                )}
              </button>

              {showHistory && (
                <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-900/60 space-y-2 text-xs">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-3 text-slate-400 text-xs gap-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading remarks...
                    </div>
                  ) : followUps.length === 0 ? (
                    <div className="text-center py-2 text-slate-400 text-[11px] italic">
                      No previous follow-up remarks recorded for this lead.
                    </div>
                  ) : (
                    followUps.map((fu) => (
                      <div
                        key={fu._id}
                        className="rounded-lg border border-slate-200/60 bg-white p-2 dark:border-slate-800 dark:bg-slate-800/80 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                            {fu.type}
                          </span>
                          <span>
                            {fu.createdAt ? formatLeadDate(fu.createdAt) : formatLeadDate(fu.follow_up_date)}
                            {fu.created_by?.name ? ` • by ${fu.created_by.name}` : ""}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-200">
                          {fu.notes || fu.outcome || "Follow-up touchpoint scheduled"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !remarkText.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Log Remark</span>
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>
    </LargeModalPortal>
  );
}

export function GoogleSheetLeadsModal({
  isOpen,
  onClose,
  onSuccess,
  portalHome = "",
}: GoogleSheetLeadsModalProps) {
  const reduxUser = useAppSelector((state) => state.auth?.user);
  const sessionUser = useMemo(() => readSessionFromStorage()?.user || null, []);
  const authUser = (reduxUser || sessionUser) as any;
  const isAdmin = isLeadAdmin(authUser, portalHome);
  const isSA = isAdmin;
  const userDept = "lead_manager";
  const showPricing = canViewLeadPricing(authUser, portalHome);
  const canDelete = canDeleteLead(authUser, portalHome);

  const visibleColumns = useMemo(() => {
    const cols = showPricing
      ? COLUMNS
      : COLUMNS.filter((c) => c.key !== "estimated_value");
    return cols.map((c, i) => ({
      ...c,
      headerLetter: String.fromCharCode(65 + i),
    }));
  }, [showPricing]);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [formulaValue, setFormulaValue] = useState<string>("");
  const [localRows, setLocalRows] = useState<LeadRow[]>([]);
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [sortConfig, setSortConfig] = useState<{
    key: keyof LeadRow;
    direction: "asc" | "desc";
  } | null>(null);

  // Filter panel state & options
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const { departmentOptions } = useLeadDepartmentOptions();
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterSalesUser, setFilterSalesUser] = useState<string>("all");
  const [filterFollowUpState, setFilterFollowUpState] = useState<string>("all");
  const [filterDatePreset, setFilterDatePreset] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filterMinQty, setFilterMinQty] = useState<string>("");
  const [filterMaxQty, setFilterMaxQty] = useState<string>("");
  const [filterCity, setFilterCity] = useState<string>("all");
  const [filterState, setFilterState] = useState<string>("all");

  const [downloadPreviewOpen, setDownloadPreviewOpen] = useState<boolean>(false);

  // Sub-modals inside sheet
  const [assignTarget, setAssignTarget] = useState<LeadRecord | null>(null);
  const [followUpTarget, setFollowUpTarget] = useState<LeadRecord | null>(null);
  const [liveRemarkTarget, setLiveRemarkTarget] = useState<LeadRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadRecord | null>(null);

  // Resizable column widths
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    lead_no: 120,
    createdAt: 130,
    company_name: 180,
    name: 160,
    departments: 150,
    phone: 130,
    email: 160,
    status: 120,
    priority: 100,
    source: 130,
    primary_assignee_name: 160,
    secondary_assignees_name: 180,
    requirement_summary: 240,
    required_products: 230,
    total_quantity: 90,
    estimated_value: 120,
    city: 110,
    state: 110,
    industry: 120,
    next_follow_up_at: 140,
    last_remarks: 260,
    lost_reason: 140,
    created_by_name: 140,
  });

  // Backend scopes: SA sees all; others only leads assigned to themselves
  const queryArgs = useMemo(() => {
    return {
      paginate: "false" as const,
    };
  }, []);

  // RTK Queries & Mutations
  const { data: leadsData, isLoading, isFetching, refetch } = useListLeadsQuery(
    queryArgs,
    { skip: !isOpen }
  );
  const { data: sources } = useListLeadSourcesQuery(undefined, { skip: !isOpen });
  const { data: usersData } = useListUsersQuery(undefined, { skip: !isOpen });

  const [updateLead] = useUpdateLeadMutation();
  const [createLeadFollowUp] = useCreateLeadFollowUpMutation();
  const [assignLead] = useAssignLeadMutation();
  const [deleteLead] = useDeleteLeadMutation();
  const [bulkDeleteLeads, { isLoading: isBulkDeleting }] = useBulkDeleteLeadsMutation();
  const [activeCellPicker, setActiveCellPicker] = useState<{
    rowId: string;
    field: "departments" | "secondary_assignees_name";
  } | null>(null);

  const rawUsers = (Array.isArray(usersData)
    ? usersData
    : (usersData as { data?: Array<{ _id: string; name: string; department?: string; portals?: Array<{ portal_code: string; access_roles?: string[] }> }> })?.data || []) as Array<{ _id: string; name: string; department?: string; portals?: Array<{ portal_code: string; access_roles?: string[] }> }>;
  const assignableUsers = useMemo(() => {
    const filtered = rawUsers.filter(isUserInLeadManagerPortal);
    return filtered.length > 0 ? filtered : rawUsers;
  }, [rawUsers]);

  // Transform backend leads into flattened LeadRow array
  const rawItems = useMemo<LeadRecord[]>(() => {
    if (!leadsData) return [];
    if (Array.isArray(leadsData)) return leadsData;
    if (Array.isArray((leadsData as any).items)) return (leadsData as any).items;
    if (Array.isArray((leadsData as any).data)) return (leadsData as any).data;
    return [];
  }, [leadsData]);

  useEffect(() => {
    if (rawItems) {
      const rows: LeadRow[] = rawItems.map((lead) => {
        const totalQty = Array.isArray(lead.products)
          ? lead.products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)
          : 0;

        const refId = (
          v: { _id: string; name?: string } | string | undefined | null
        ): string | undefined => {
          if (!v) return undefined;
          return typeof v === "object" ? v._id : String(v);
        };

        const assignedId = refId(lead.assigned_to);
        const assignedName = formatLeadAssignees(lead);
        const { primary, secondary } = splitLeadAssignees(lead);
        const primaryAssigneeId = primary?._id || "";
        const primaryAssigneeName = primary?.name || "Unassigned";
        const secondaryAssigneeIds = secondary.map((u) => u._id).filter(Boolean);
        const secondaryAssigneesName =
          secondary.map((u) => u.name).filter(Boolean).join(", ") || "—";

        const productsSummary = formatProductsSummary(lead.products, lead.requirement);
        const requiredProducts =
          Array.isArray(lead.products) && lead.products.length > 0
            ? lead.products
                .map((p: any) => `${p.product_name || p.name || "Item"} (${Number(p.quantity) || 0})`)
                .join(", ")
            : "—";
        const requirementSummary = lead.requirement || "";
        const lastRemarks = lead.last_action?.remarks
          ? [
              lead.last_action.remarks,
              lead.last_action.timestamp ? formatLeadDate(lead.last_action.timestamp) : "",
              lead.last_action.by_user?.name ? `by ${lead.last_action.by_user.name}` : "",
            ]
              .filter(Boolean)
              .join(" • ")
          : "—";
        const createdByName = getCreatedByName(lead.created_by, "System");

        return {
          _id: lead._id,
          lead_no: lead.lead_no || "—",
          name: lead.name || "",
          company_name: lead.company_name || "",
          departments: getLeadDepartments(lead).map(getDeptLabel).join(", ") || (lead.department ? getDeptLabel(lead.department) : "—"),
          phone: lead.phone || "",
          email: lead.email || "",
          status: lead.status || "new",
          priority: lead.priority || "medium",
          source: lead.source || "",
          assigned_to_id: assignedId,
          assigned_to_name: assignedName,
          primary_assignee_id: primaryAssigneeId,
          primary_assignee_name: primaryAssigneeName,
          secondary_assignee_ids: secondaryAssigneeIds,
          secondary_assignees_name: secondaryAssigneesName,
          total_quantity: totalQty,
          estimated_value: leadEstimatedValue(lead),
          products_list: lead.products || [],
          products_summary: productsSummary,
          requirement_summary: requirementSummary,
          required_products: requiredProducts,
          city: lead.billing_address?.city || "",
          state: lead.billing_address?.state || "",
          industry: lead.industry || "",
          requirement: lead.requirement || "",
          next_follow_up_at: lead.next_follow_up_at || "",
          last_remarks: lastRemarks,
          lost_reason: lead.lost_info?.lost_reason || "",
          lost_remarks: lead.lost_info?.lost_remarks || "",
          notes: lead.notes || "",
          createdAt: lead.createdAt ? formatLeadDate(lead.createdAt) : "",
          created_by_name: createdByName,
          raw: lead,
        };
      });
      setLocalRows(rows);
    }
  }, [rawItems]);

  // Sync formula bar input back to selected cell
  useEffect(() => {
    if (selectedCell) {
      const row = localRows.find((r) => r._id === selectedCell.leadId);
      if (row) {
        const val = row[selectedCell.colKey];
        setFormulaValue(val !== undefined && val !== null ? String(val) : "");
      }
    } else {
      setFormulaValue("");
    }
  }, [selectedCell, localRows]);

  // Close modal on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (assignTarget || followUpTarget || deleteTarget || liveRemarkTarget) return;
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen, onClose, assignTarget, followUpTarget, deleteTarget, liveRemarkTarget]);

  // Column Resizing handlers
  const handleResizeStart = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 120;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(70, startWidth + deltaX);
      setColWidths((prev) => ({
        ...prev,
        [colKey]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const totalWidth = useMemo(() => {
    const columnsSum = visibleColumns.reduce((sum, col) => sum + (colWidths[col.key] || 120), 0);
    const checkboxWidth = canDelete ? 48 : 0;
    return 48 + checkboxWidth + 110 + columnsSum;
  }, [colWidths, canDelete, visibleColumns]);

  // Save edited cell to backend with Access Control checks
  const saveCell = useCallback(
    async (leadId: string, colKey: keyof LeadRow, val: any) => {
      const originalRow = localRows.find((r) => r._id === leadId);
      if (!originalRow) return;

      if (originalRow.status === "converted") {
        toast.error("Converted leads cannot be edited or deleted");
        return;
      }

      // Assignment is managed via AssignLeadModal (multi-dept slots); not inline-editable
      if (
        colKey === "assigned_to_name" ||
        colKey === "primary_assignee_name" ||
        colKey === "secondary_assignees_name"
      ) {
        toast.error(
          isSA
            ? "Use the Assign button to update Sales / Admin / Finance assignees"
            : "You can only assign yourself via the Assign button"
        );
        return;
      }

      // Follow-up scheduling check for closed leads
      if (colKey === "next_follow_up_at" && !canScheduleFollowUp(originalRow.status)) {
        toast.error("Follow-up scheduling is not available for closed leads (Won, Lost, or Converted)");
        return;
      }

      // Access control check for Status transitions
      if (colKey === "status" && !isAdmin) {
        const allowed = ALLOWED_STATUS_TRANSITIONS[originalRow.status] || [];
        if (!allowed.includes(val) && val !== originalRow.status) {
          toast.error(
            `Unauthorized transition: ${originalRow.status} cannot be changed directly to ${val}`
          );
          return;
        }
      }

      if (colKey === "estimated_value" && !showPricing) {
        toast.error("Only administrators can edit lead pricing");
        return;
      }

      let parsedVal: any = val;
      if (colKey === "total_quantity" || colKey === "estimated_value") {
        parsedVal = val === "" ? 0 : Number(val);
        if (isNaN(parsedVal)) {
          toast.error("Invalid number value");
          return;
        }
      }

      if (originalRow[colKey] === parsedVal) return;

      if (colKey === "last_remarks") {
        const cleanRemark = String(parsedVal || "").trim();
        if (!cleanRemark || cleanRemark === originalRow.last_remarks) return;

        const userName = authUser?.name || "You";
        const formattedRemark = `${cleanRemark} • by ${userName}`;

        // Optimistic update
        setLocalRows((prev) =>
          prev.map((row) => {
            if (row._id !== leadId) return row;
            return {
              ...row,
              status:
                row.status === "new" || row.status === "assigned"
                  ? "follow_up"
                  : row.status,
              last_remarks: formattedRemark,
              raw: {
                ...row.raw,
                status:
                  row.raw.status === "new" || row.raw.status === "assigned"
                    ? "follow_up"
                    : row.raw.status,
                last_action: {
                  remarks: cleanRemark,
                  timestamp: new Date().toISOString(),
                  by_user: {
                    _id: String(authUser?._id || ""),
                    name: userName,
                    email: authUser?.email,
                  },
                },
              },
            };
          })
        );

        setSavingRows((prev) => ({ ...prev, [leadId]: true }));
        try {
          await createLeadFollowUp({
            leadId,
            type: "note",
            notes: cleanRemark,
            follow_up_date: new Date().toISOString(),
          }).unwrap();
          toast.success("Follow-up remark recorded live!");
          refetch();
        } catch (err: any) {
          toast.error(mutationRejectedMessage(err) || "Failed to record follow-up remark");
          refetch();
        } finally {
          setSavingRows((prev) => ({ ...prev, [leadId]: false }));
        }
        return;
      }

      // Optimistic update (keep raw sub-objects in sync so consecutive edits don't overwrite)
      setLocalRows((prev) =>
        prev.map((row) => {
          if (row._id !== leadId) return row;
          const nextRaw = { ...row.raw };
          if (colKey === "city" || colKey === "state") {
            nextRaw.billing_address = { ...(row.raw.billing_address || {}), [colKey]: parsedVal };
          } else if (colKey === "requirement_summary") {
            nextRaw.requirement = parsedVal;
          } else if (colKey === "industry") {
            nextRaw.industry = parsedVal;
          }
          return { ...row, [colKey]: parsedVal, raw: nextRaw };
        })
      );

      setSavingRows((prev) => ({ ...prev, [leadId]: true }));
      try {
        const patchPayload: Record<string, any> = {};

        if (colKey === "city" || colKey === "state") {
          patchPayload.billing_address = {
            ...(originalRow.raw.billing_address || {}),
            [colKey]: parsedVal,
          };
        } else if (colKey === "lost_reason") {
          patchPayload.lost_info = {
            ...(originalRow.raw.lost_info || {}),
            lost_reason: parsedVal,
          };
        } else if (colKey === "lost_remarks") {
          patchPayload.lost_info = {
            ...(originalRow.raw.lost_info || {}),
            lost_remarks: parsedVal,
          };
        } else if (colKey === "products_summary" || colKey === "requirement_summary") {
          patchPayload.requirement = parsedVal;
        } else if (colKey === "departments") {
          const depts = String(parsedVal || "")
            .split(",")
            .map((d) => d.trim())
            .filter((d) => d && d !== "—");
          patchPayload.department = depts.join(", ");
          patchPayload.departments = depts;
        } else {
          patchPayload[colKey] = parsedVal;
        }

        await updateLead({
          id: leadId,
          body: patchPayload,
        }).unwrap();
      } catch (err: any) {
        toast.error(mutationRejectedMessage(err) || "Failed to save update");
        refetch();
      } finally {
        setSavingRows((prev) => ({ ...prev, [leadId]: false }));
      }
    },
    [localRows, updateLead, createLeadFollowUp, authUser, refetch, isSA, isAdmin, showPricing]
  );

  // Handle remark saved from LiveAddRemarkModal
  const handleRemarkSaved = useCallback(
    (leadId: string, remarkText: string, nextFollowUpAt?: string) => {
      const userName = authUser?.name || "You";
      const formattedRemark = `${remarkText} • by ${userName}`;

      setLocalRows((prev) =>
        prev.map((row) => {
          if (row._id !== leadId) return row;
          const updatedRaw: LeadRecord = {
            ...row.raw,
            status:
              row.raw.status === "new" || row.raw.status === "assigned"
                ? "follow_up"
                : row.raw.status,
            next_follow_up_at: nextFollowUpAt || row.raw.next_follow_up_at,
            last_action: {
              remarks: remarkText,
              timestamp: new Date().toISOString(),
              by_user: {
                _id: String(authUser?._id || ""),
                name: userName,
                email: authUser?.email,
              },
            },
          };
          return {
            ...row,
            status:
              row.status === "new" || row.status === "assigned"
                ? "follow_up"
                : row.status,
            next_follow_up_at: nextFollowUpAt || row.next_follow_up_at,
            last_remarks: formattedRemark,
            raw: updatedRaw,
          };
        })
      );
      refetch();
    },
    [authUser, refetch]
  );

  // Inline Primary & Secondary Assignee update handler
  const saveAssignees = useCallback(
    async (leadId: string, nextPrimaryId: string, nextSecondaryIds: string[]) => {
      const originalRow = localRows.find((r) => r._id === leadId);
      if (!originalRow) return;
      if (originalRow.status === "converted") {
        toast.error("Converted leads cannot be edited");
        return;
      }
      if (!nextPrimaryId) {
        toast.error("Primary assignee is required");
        return;
      }

      const cleanSecondary = Array.from(
        new Set(nextSecondaryIds.filter((id) => id && id !== nextPrimaryId))
      );
      const userMap = new Map(assignableUsers.map((u) => [String(u._id), u.name]));
      const nextPrimaryName = userMap.get(nextPrimaryId) || originalRow.primary_assignee_name || "Assigned";
      const nextSecondaryName =
        cleanSecondary.map((id) => userMap.get(id)).filter(Boolean).join(", ") || "—";

      setLocalRows((prev) =>
        prev.map((row) =>
          row._id === leadId
            ? {
                ...row,
                primary_assignee_id: nextPrimaryId,
                primary_assignee_name: nextPrimaryName,
                secondary_assignee_ids: cleanSecondary,
                secondary_assignees_name: nextSecondaryName,
              }
            : row
        )
      );

      setSavingRows((prev) => ({ ...prev, [leadId]: true }));
      try {
        await assignLead({
          id: leadId,
          assigned_to: nextPrimaryId,
          assigned_users: [nextPrimaryId, ...cleanSecondary],
        }).unwrap();
        toast.success("Assignees updated");
      } catch (err: any) {
        toast.error(mutationRejectedMessage(err) || "Failed to update assignees");
        refetch();
      } finally {
        setSavingRows((prev) => ({ ...prev, [leadId]: false }));
      }
    },
    [localRows, assignableUsers, assignLead, refetch]
  );

  // Quick Delete Row (Admin only)
  const handleDeleteRow = async (leadId: string) => {
    if (!canDelete) {
      toast.error("Only administrators can delete leads");
      return;
    }
    const target = localRows.find((r) => r._id === leadId);
    if (target?.status === "converted") {
      toast.error("Converted leads cannot be deleted");
      return;
    }
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      await deleteLead(leadId).unwrap();
      toast.success("Lead deleted successfully");
      refetch();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(mutationRejectedMessage(err) || "Failed to delete lead");
    }
  };

  // Bulk Delete (Admin only)
  const handleBulkDelete = async () => {
    if (!canDelete) {
      toast.error("Only administrators can bulk delete leads");
      return;
    }
    const idsToDelete = Object.keys(selectedIds).filter(
      (id) =>
        selectedIds[id] &&
        localRows.some((r) => r._id === id && r.status !== "converted")
    );
    if (idsToDelete.length === 0) {
      toast.error("Converted leads cannot be deleted");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${idsToDelete.length} selected leads?`)) return;

    try {
      await bulkDeleteLeads(idsToDelete).unwrap();
      toast.success(`Successfully deleted ${idsToDelete.length} leads`);
      setSelectedIds({});
      refetch();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(mutationRejectedMessage(err) || "Failed to delete selected leads");
    }
  };

  // Metadata for filter options
  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    localRows.forEach((r) => {
      if (r.city && r.city.trim()) cities.add(r.city.trim());
    });
    return Array.from(cities).sort();
  }, [localRows]);

  const hasActiveFilters = useMemo(() => {
    return (
      filterStatus !== "all" ||
      filterPriority !== "all" ||
      filterDepartment !== "all" ||
      filterSource !== "all" ||
      (isSA && filterSalesUser !== "all") ||
      filterFollowUpState !== "all" ||
      filterDatePreset !== "all" ||
      filterStartDate.trim() !== "" ||
      filterEndDate.trim() !== "" ||
      filterMinQty.trim() !== "" ||
      filterMaxQty.trim() !== "" ||
      filterCity !== "all" ||
      filterState !== "all"
    );
  }, [
    filterStatus,
    filterPriority,
    filterDepartment,
    filterSource,
    filterSalesUser,
    isSA,
    filterFollowUpState,
    filterDatePreset,
    filterStartDate,
    filterEndDate,
    filterMinQty,
    filterMaxQty,
    filterCity,
    filterState,
  ]);

  const handleClearFilters = () => {
    setFilterStatus("all");
    setFilterPriority("all");
    setFilterDepartment("all");
    setFilterSource("all");
    setFilterSalesUser("all");
    setFilterFollowUpState("all");
    setFilterDatePreset("all");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterMinQty("");
    setFilterMaxQty("");
    setFilterCity("all");
    setFilterState("all");
  };

  // Filtered Rows
  const filteredRows = useMemo(() => {
    let rows = [...localRows];

    // 1. Text Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          r.lead_no?.toLowerCase().includes(q) ||
          r.name?.toLowerCase().includes(q) ||
          r.company_name?.toLowerCase().includes(q) ||
          r.departments?.toLowerCase().includes(q) ||
          r.phone?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.source?.toLowerCase().includes(q) ||
          r.assigned_to_name?.toLowerCase().includes(q) ||
          r.primary_assignee_name?.toLowerCase().includes(q) ||
          r.secondary_assignees_name?.toLowerCase().includes(q) ||
          r.city?.toLowerCase().includes(q) ||
          r.state?.toLowerCase().includes(q) ||
          r.industry?.toLowerCase().includes(q) ||
          r.products_summary?.toLowerCase().includes(q) ||
          r.requirement_summary?.toLowerCase().includes(q) ||
          r.required_products?.toLowerCase().includes(q) ||
          r.last_remarks?.toLowerCase().includes(q) ||
          r.created_by_name?.toLowerCase().includes(q) ||
          r.requirement?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q)
      );
    }

    // 2. Status Filter
    if (filterStatus !== "all") {
      rows = rows.filter((r) => r.status === filterStatus);
    }

    // 3. Priority Filter
    if (filterPriority !== "all") {
      rows = rows.filter((r) => r.priority === filterPriority);
    }

    // 3b. Department Filter
    if (filterDepartment !== "all") {
      const target = filterDepartment.toLowerCase();
      rows = rows.filter((r) => {
        const rawDepts = getLeadDepartments(r.raw);
        if (rawDepts.some((d) => d.toLowerCase() === target)) return true;
        return (r.departments || "").toLowerCase().includes(target);
      });
    }

    // 4. Source Filter
    if (filterSource !== "all") {
      rows = rows.filter((r) => r.source === filterSource);
    }

    // 5. Assigned User Filter (Admin only)
    if (isSA && filterSalesUser !== "all") {
      if (filterSalesUser === "unassigned") {
        rows = rows.filter((r) => !r.assigned_to_id);
      } else {
        rows = rows.filter((r) => r.assigned_to_id === filterSalesUser);
      }
    }

    // 6. Follow-up State Filter
    if (filterFollowUpState !== "all") {
      rows = rows.filter((r) => {
        if (!r.next_follow_up_at) return filterFollowUpState === "no_followup";
        if (filterFollowUpState === "today") return isFollowUpToday(r.next_follow_up_at);
        if (filterFollowUpState === "overdue") return isFollowUpOverdue(r.next_follow_up_at);
        if (filterFollowUpState === "upcoming") {
          return !isFollowUpToday(r.next_follow_up_at) && !isFollowUpOverdue(r.next_follow_up_at);
        }
        return true;
      });
    }

    // 7. Date Range Filter (based on raw.createdAt)
    if (filterDatePreset !== "all") {
      rows = rows.filter((r) => {
        const rawDateStr = r.raw.createdAt;
        if (!rawDateStr) return false;
        const d = new Date(rawDateStr);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (filterDatePreset === "today") {
          return d >= startOfToday;
        }
        if (filterDatePreset === "yesterday") {
          const startOfYesterday = new Date(startOfToday);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          return d >= startOfYesterday && d < startOfToday;
        }
        if (filterDatePreset === "last_7") {
          const sevenDaysAgo = new Date(startOfToday);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return d >= sevenDaysAgo;
        }
        if (filterDatePreset === "last_30") {
          const thirtyDaysAgo = new Date(startOfToday);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return d >= thirtyDaysAgo;
        }
        if (filterDatePreset === "custom") {
          if (filterStartDate) {
            const start = new Date(filterStartDate);
            if (!isNaN(start.getTime()) && d < start) return false;
          }
          if (filterEndDate) {
            const end = new Date(filterEndDate);
            if (!isNaN(end.getTime())) {
              const endOfDay = new Date(
                end.getFullYear(),
                end.getMonth(),
                end.getDate(),
                23,
                59,
                59,
                999
              );
              if (d > endOfDay) return false;
            }
          }
        }
        return true;
      });
    }

    // 8. Qty Filter
    if (filterMinQty.trim()) {
      const min = Number(filterMinQty);
      if (!isNaN(min)) rows = rows.filter((r) => (r.total_quantity || 0) >= min);
    }
    if (filterMaxQty.trim()) {
      const max = Number(filterMaxQty);
      if (!isNaN(max)) rows = rows.filter((r) => (r.total_quantity || 0) <= max);
    }

    // 9. City Filter
    if (filterCity !== "all") {
      rows = rows.filter((r) => r.city?.trim() === filterCity);
    }

    // 10. State Filter
    if (filterState !== "all") {
      rows = rows.filter((r) => r.state?.trim() === filterState);
    }

    // 11. Sorting
    if (sortConfig) {
      rows.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (valA == null || valA === "") return sortConfig.direction === "asc" ? 1 : -1;
        if (valB == null || valB === "") return sortConfig.direction === "asc" ? -1 : 1;

        if (typeof valA === "number" && typeof valB === "number") {
          return sortConfig.direction === "asc" ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        if (strA < strB) return sortConfig.direction === "asc" ? -1 : 1;
        if (strA > strB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }, [
    localRows,
    searchQuery,
    filterStatus,
    filterPriority,
    filterDepartment,
    filterSource,
    filterSalesUser,
    isSA,
    filterFollowUpState,
    filterDatePreset,
    filterStartDate,
    filterEndDate,
    filterMinQty,
    filterMaxQty,
    filterCity,
    filterState,
    sortConfig,
  ]);

  // Selection counts
  const selectedCount = useMemo(() => {
    return Object.keys(selectedIds).filter(
      (id) => selectedIds[id] && localRows.some((r) => r._id === id)
    ).length;
  }, [selectedIds, localRows]);

  const selectableRows = useMemo(
    () => filteredRows.filter((r) => r.status !== "converted"),
    [filteredRows]
  );

  const isAllSelected = useMemo(() => {
    if (selectableRows.length === 0) return false;
    return selectableRows.every((r) => selectedIds[r._id]);
  }, [selectableRows, selectedIds]);

  const handleToggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = { ...prev };
      if (isAllSelected) {
        selectableRows.forEach((r) => {
          delete next[r._id];
        });
      } else {
        selectableRows.forEach((r) => {
          next[r._id] = true;
        });
      }
      return next;
    });
  };

  // KPIs
  const totalQuantitySum = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + (r.total_quantity || 0), 0);
  }, [filteredRows]);

  const totalEstimatedValueSum = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + (Number(r.estimated_value) || 0), 0);
  }, [filteredRows]);

  const overdueCount = useMemo(() => {
    return filteredRows.filter((r) => isFollowUpOverdue(r.next_follow_up_at)).length;
  }, [filteredRows]);

  if (!isOpen) return null;

  const isSavingAny = Object.values(savingRows).some(Boolean);

  return (
    <LargeModalPortal>
      <div
        className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans select-none"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 px-4 py-2.5 shrink-0 backdrop-blur">
          <div className="flex items-center gap-3">
            {/* Google Sheets Logo */}
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  Leads Master Spreadsheet
                </span>
                {/* Role Badge */}
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isSA
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                      : "bg-primary/10 text-primary border border-primary/20"
                  }`}
                >
                  {isSA
                    ? "Admin — All Leads"
                    : "My Assigned Leads"}
                </span>

                {/* Cloud Sync Status */}
                <div className="flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  {isSavingAny ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span>Saved to Cloud</span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isSA
                  ? "Full access: edit leads, assign portal users, and manage records"
                  : "View and update leads assigned to you. Assignee is locked to yourself."}
              </p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/60"
              title="Refresh leads"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </button>

            {/* Download Button triggering Preview Modal */}
            <button
              type="button"
              onClick={() => setDownloadPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/60"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Download
            </button>

            {/* Filter Toggle */}
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                isFilterPanelOpen || hasActiveFilters
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">
                  !
                </span>
              )}
            </button>

            {/* Close Modal */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Interactive Spreadsheet View */}
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900">
            {/* Formula & Search Bar */}
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-4 py-2 shrink-0">
              {/* Search Bar */}
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in sheet (Name, No, Phone, City, Product)..."
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1 text-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Formula Bar FX */}
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center gap-1.5 border-r border-slate-200 pr-2 font-mono text-[11px] font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <span className="italic text-emerald-600 dark:text-emerald-400">fx</span>
                  <span className="min-w-[32px] text-slate-700 dark:text-slate-200">
                    {selectedCell
                      ? `${
                          visibleColumns.find((c) => c.key === selectedCell.colKey)?.headerLetter || ""
                        }${filteredRows.findIndex((r) => r._id === selectedCell.leadId) + 1}`
                      : "—"}
                  </span>
                </div>
                <input
                  type="text"
                  value={formulaValue}
                  onChange={(e) => {
                    setFormulaValue(e.target.value);
                    if (selectedCell) {
                      saveCell(selectedCell.leadId, selectedCell.colKey, e.target.value);
                    }
                  }}
                  placeholder={
                    selectedCell
                      ? `Editing ${
                          visibleColumns.find((c) => c.key === selectedCell.colKey)?.label || ""
                        }`
                      : "Select a cell to view/edit formula..."
                  }
                  disabled={
                    !selectedCell ||
                    visibleColumns.find((c) => c.key === selectedCell.colKey)?.readonly ||
                    localRows.find((r) => r._id === selectedCell.leadId)?.status === "converted" ||
                    selectedCell.colKey === "assigned_to_name" ||
                    selectedCell.colKey === "primary_assignee_name" ||
                    selectedCell.colKey === "secondary_assignees_name" ||
                    (selectedCell.colKey === "next_follow_up_at" &&
                      !canScheduleFollowUp(
                        localRows.find((r) => r._id === selectedCell.leadId)?.status || "new"
                      ))
                  }
                  className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-white disabled:opacity-50"
                />
              </div>

              {/* KPI Ribbon */}
              <div className="hidden lg:flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">Total Leads:</span>
                  <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-slate-800 dark:bg-slate-800 dark:text-white">
                    {filteredRows.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">Total Est. Qty:</span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                    {totalQuantitySum.toLocaleString()} units
                  </span>
                </div>
                {showPricing && (
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Est. Value:</span>
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300">
                      {formatCurrencyINR(totalEstimatedValueSum)}
                    </span>
                  </div>
                )}
                {overdueCount > 0 && (
                  <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>{overdueCount} Overdue</span>
                  </div>
                )}
              </div>
            </div>

            {/* Spreadsheet Grid Container */}
            <div className="flex-1 overflow-auto bg-slate-100/60 dark:bg-slate-950">
              <div style={{ minWidth: `${totalWidth}px` }} className="border-collapse">
                {/* Table Header (Letters Row) */}
                <div className="sticky top-0 z-20 flex border-b border-slate-300 bg-slate-200/90 dark:border-slate-700 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 shadow-sm">
                  {/* Corner Cell */}
                  <div className="w-12 shrink-0 border-r border-slate-300 px-2 py-1.5 text-center dark:border-slate-700 bg-slate-200 dark:bg-slate-800">
                    #
                  </div>

                  {/* Checkbox All (Admin only) */}
                  {canDelete && (
                    <div className="w-12 shrink-0 border-r border-slate-300 px-2 py-1.5 text-center dark:border-slate-700 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </div>
                  )}

                  {/* Actions Column */}
                  <div className="w-28 shrink-0 border-r border-slate-300 px-3 py-1.5 text-center dark:border-slate-700">
                    Actions
                  </div>

                  {/* Dynamic Data Columns */}
                  {visibleColumns.map((col) => {
                    const isSorted = sortConfig?.key === col.key;
                    return (
                      <div
                        key={col.key}
                        style={{ width: `${colWidths[col.key] || 120}px` }}
                        className="relative flex shrink-0 items-center justify-between border-r border-slate-300 px-2.5 py-1.5 dark:border-slate-700 hover:bg-slate-300/60 dark:hover:bg-slate-700 transition group"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSortConfig((prev) => {
                              if (prev?.key === col.key) {
                                return prev.direction === "asc"
                                  ? { key: col.key, direction: "desc" }
                                  : null;
                              }
                              return { key: col.key, direction: "asc" };
                            });
                          }}
                          className="flex items-center gap-1 text-left font-bold text-slate-800 dark:text-slate-100 truncate w-full"
                        >
                          <span className="font-mono text-[10px] text-slate-400 group-hover:text-emerald-600">
                            {col.headerLetter}
                          </span>
                          <span className="truncate">{col.label}</span>
                          {isSorted &&
                            (sortConfig.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-emerald-600" />
                            ))}
                        </button>

                        {/* Resize Handle */}
                        <div
                          onMouseDown={(e) => handleResizeStart(col.key, e)}
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Table Body Rows */}
                {isLoading ? (
                  <div className="flex h-64 items-center justify-center text-slate-400">
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin text-emerald-500" />
                    Loading leads spreadsheet...
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center text-slate-400">
                    <FileSpreadsheet className="h-10 w-10 text-slate-300 mb-2" />
                    <p className="font-semibold">No leads found in this view</p>
                    <p className="text-xs text-slate-500">
                      {isSA
                        ? "Try adjusting your search query or filters"
                        : "No leads assigned to you"}
                    </p>
                  </div>
                ) : (
                  filteredRows.map((row, rowIdx) => {
                    const isRowSelected = Boolean(selectedIds[row._id]);
                    const isOverdue = isFollowUpOverdue(row.next_follow_up_at);
                    const isToday = isFollowUpToday(row.next_follow_up_at);
                    const statusCfg = LEAD_STATUS_CONFIG[row.status];
                    const priorityCfg = LEAD_PRIORITY_CONFIG[row.priority];

                    const isRowConverted = row.status === "converted";
                    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[row.status] || [];
                    const statusOptions: LeadStatus[] = isAdmin
                      ? (visibleColumns.find((c) => c.key === "status")?.options as LeadStatus[]) || []
                      : [row.status, ...(allowedTransitions.filter((s) => s !== row.status) as LeadStatus[])];
                    const isStatusEditable = !isRowConverted && (isAdmin || allowedTransitions.length > 0);

                    return (
                      <div
                        key={row._id}
                        className={`flex border-b border-slate-200 dark:border-slate-800 text-xs transition ${
                          isRowSelected
                            ? "bg-emerald-50/70 dark:bg-emerald-950/30"
                            : rowIdx % 2 === 0
                            ? "bg-white dark:bg-slate-900"
                            : "bg-slate-50/60 dark:bg-slate-900/50"
                        } hover:bg-emerald-50/40 dark:hover:bg-slate-800/40`}
                      >
                        {/* Row Number */}
                        <div className="w-12 shrink-0 border-r border-slate-200 px-2 py-2 text-center font-mono text-[11px] text-slate-400 dark:border-slate-800 flex items-center justify-center bg-slate-100/50 dark:bg-slate-800/30">
                          {rowIdx + 1}
                        </div>

                        {/* Checkbox (Admin only) */}
                        {canDelete && (
                          <div className="w-12 shrink-0 border-r border-slate-200 px-2 py-2 text-center dark:border-slate-800 flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={isRowSelected}
                              disabled={isRowConverted}
                              onChange={() => {
                                if (isRowConverted) return;
                                setSelectedIds((prev) => ({
                                  ...prev,
                                  [row._id]: !prev[row._id],
                                }));
                              }}
                              title={isRowConverted ? "Converted leads cannot be deleted" : "Select lead"}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                            />
                          </div>
                        )}

                        {/* Row Action Buttons */}
                        <div className="w-28 shrink-0 border-r border-slate-200 px-2 py-1.5 dark:border-slate-800 flex items-center justify-center gap-1">
                          {canScheduleFollowUp(row.status) && (
                            <>
                              <button
                                type="button"
                                onClick={() => setLiveRemarkTarget(row)}
                                title="Add Follow-up Remark"
                                className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition cursor-pointer"
                              >
                                <MessageSquarePlus className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setFollowUpTarget(row.raw)}
                                title="Schedule Follow-up"
                                className="rounded p-1 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition cursor-pointer"
                              >
                                <CalendarPlus className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {!isRowConverted && (
                            <button
                              type="button"
                              onClick={() => setAssignTarget(row.raw)}
                              title={
                                isSA
                                  ? "Assign Sales / Admin / Finance"
                                  : "Assign to Me"
                              }
                              className="rounded p-1 text-primary hover:bg-primary/10"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete && !isRowConverted && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row._id)}
                              title="Delete Lead"
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Lead Cells */}
                        {visibleColumns.map((col) => {
                          const isCellSelected =
                            selectedCell?.leadId === row._id && selectedCell?.colKey === col.key;
                          const cellValue = row[col.key];

                          return (
                            <div
                              key={col.key}
                              style={{ width: `${colWidths[col.key] || 120}px` }}
                              onClick={() => setSelectedCell({ leadId: row._id, colKey: col.key })}
                              className={`relative shrink-0 border-r border-slate-200 dark:border-slate-800 px-2.5 py-1.5 flex items-center transition ${
                                isCellSelected
                                  ? "ring-2 ring-emerald-500 ring-inset bg-emerald-50/40 dark:bg-emerald-950/40 z-10 font-semibold"
                                  : ""
                              }`}
                            >
                              {/* Specific Cell Editors & Displays */}
                              {col.key === "lead_no" ? (
                                <span className="font-bold text-primary truncate">
                                  {row.lead_no}
                                </span>
                              ) : col.key === "status" ? (
                                isStatusEditable ? (
                                  <select
                                    value={row.status}
                                    onChange={(e) =>
                                      saveCell(row._id, "status", e.target.value as LeadStatus)
                                    }
                                    className={`w-full rounded px-1.5 py-0.5 text-xs font-semibold border focus:outline-none cursor-pointer ${
                                      statusCfg?.bg || "bg-slate-100"
                                    } ${statusCfg?.text || "text-slate-800"} ${
                                      statusCfg?.border || "border-slate-300"
                                    }`}
                                  >
                                    {statusOptions.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {LEAD_STATUS_CONFIG[opt]?.label || opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span
                                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                      statusCfg?.bg || "bg-slate-100"
                                    } ${statusCfg?.text || "text-slate-800"}`}
                                  >
                                    {statusCfg?.label || row.status}
                                  </span>
                                )
                              ) : col.key === "priority" ? (
                                isRowConverted ? (
                                  <span
                                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                      priorityCfg?.bg || "bg-slate-100"
                                    } ${priorityCfg?.text || "text-slate-800"}`}
                                  >
                                    {priorityCfg?.label || row.priority}
                                  </span>
                                ) : (
                                  <select
                                    value={row.priority}
                                    onChange={(e) =>
                                      saveCell(row._id, "priority", e.target.value as LeadPriority)
                                    }
                                    className={`w-full rounded px-1.5 py-0.5 text-xs font-semibold border focus:outline-none cursor-pointer ${
                                      priorityCfg?.bg || "bg-slate-100"
                                    } ${priorityCfg?.text || "text-slate-800"} ${
                                      priorityCfg?.border || "border-slate-300"
                                    }`}
                                  >
                                    {col.options?.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {LEAD_PRIORITY_CONFIG[opt as LeadPriority]?.label || opt}
                                      </option>
                                    ))}
                                  </select>
                                )
                              ) : col.key === "departments" ? (
                                (() => {
                                  const currentDepts = (row.departments && row.departments !== "—"
                                    ? row.departments.split(",").map((d) => d.trim()).filter(Boolean)
                                    : []);
                                  const isPickerOpen =
                                    activeCellPicker?.rowId === row._id &&
                                    activeCellPicker?.field === "departments";

                                  if (isRowConverted) {
                                    return (
                                      <div className="flex flex-wrap items-center gap-1 truncate w-full">
                                        {currentDepts.length > 0 ? (
                                          currentDepts.map((d, dIdx) => (
                                            <span
                                              key={dIdx}
                                              className="rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-purple-700 dark:text-purple-300 whitespace-nowrap"
                                            >
                                              {d}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-slate-400 font-normal">—</span>
                                        )}
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="relative w-full">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setActiveCellPicker(
                                            isPickerOpen
                                              ? null
                                              : { rowId: row._id, field: "departments" }
                                          )
                                        }
                                        className="flex w-full items-center justify-between gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                        title={currentDepts.join(", ") || "Select departments"}
                                      >
                                        <div className="flex flex-wrap items-center gap-1 truncate">
                                          {currentDepts.length > 0 ? (
                                            currentDepts.map((d, dIdx) => (
                                              <span
                                                key={dIdx}
                                                className="rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-purple-700 dark:text-purple-300 whitespace-nowrap"
                                              >
                                                {d}
                                              </span>
                                            ))
                                          ) : (
                                            <span className="text-slate-400 italic">Select...</span>
                                          )}
                                        </div>
                                        <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
                                      </button>

                                      {isPickerOpen && (
                                        <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                          <div className="max-h-48 overflow-y-auto space-y-0.5">
                                            {departmentOptions.map((opt) => {
                                              const checked = currentDepts.some(
                                                (d) => d.toLowerCase() === opt.value.toLowerCase()
                                              );
                                              return (
                                                <button
                                                  key={opt.value}
                                                  type="button"
                                                  onClick={() => {
                                                    const nextDepts = checked
                                                      ? currentDepts.filter(
                                                          (d) =>
                                                            d.toLowerCase() !==
                                                            opt.value.toLowerCase()
                                                        )
                                                      : [...currentDepts, opt.value];
                                                    saveCell(
                                                      row._id,
                                                      "departments",
                                                      nextDepts.join(", ")
                                                    );
                                                  }}
                                                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition cursor-pointer ${
                                                    checked
                                                      ? "bg-purple-50 font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                                                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                                  }`}
                                                >
                                                  <span className="truncate">{opt.label}</span>
                                                  {checked && <Check className="h-3.5 w-3.5 shrink-0" />}
                                                </button>
                                              );
                                            })}
                                          </div>
                                          <div className="mt-1 border-t border-slate-100 pt-1 text-right dark:border-slate-800">
                                            <button
                                              type="button"
                                              onClick={() => setActiveCellPicker(null)}
                                              className="rounded px-2 py-0.5 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 cursor-pointer"
                                            >
                                              Done
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : col.key === "source" ? (
                                isRowConverted ? (
                                  <span className="text-slate-700 dark:text-slate-300 truncate">
                                    {row.source || "—"}
                                  </span>
                                ) : (
                                  <select
                                    value={row.source}
                                    onChange={(e) => saveCell(row._id, "source", e.target.value)}
                                    className="w-full bg-transparent border-0 px-1 py-0.5 text-xs text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-800 rounded focus:ring-1 focus:ring-emerald-500 truncate"
                                  >
                                    <option value={row.source}>{row.source || "Select Source"}</option>
                                    {sources
                                      ?.filter((s) => s.name !== row.source)
                                      .map((s) => (
                                        <option key={s._id} value={s.name}>
                                          {s.name}
                                        </option>
                                      ))}
                                  </select>
                                )
                              ) : col.key === "primary_assignee_name" ? (
                                isRowConverted ? (
                                  <span
                                    className="block truncate text-slate-700 dark:text-slate-300"
                                    title={row.primary_assignee_name || "Unassigned"}
                                  >
                                    {row.primary_assignee_name || "Unassigned"}
                                  </span>
                                ) : (
                                  <select
                                    value={row.primary_assignee_id || ""}
                                    onChange={(e) => {
                                      const nextPrimaryId = e.target.value;
                                      if (!nextPrimaryId) return;
                                      saveAssignees(
                                        row._id,
                                        nextPrimaryId,
                                        row.secondary_assignee_ids.filter((id) => id !== nextPrimaryId)
                                      );
                                    }}
                                    className="w-full bg-transparent border-0 px-1 py-0.5 text-xs text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-800 rounded focus:ring-1 focus:ring-emerald-500 truncate cursor-pointer"
                                  >
                                    <option value="">Unassigned</option>
                                    {assignableUsers.map((u) => (
                                      <option key={u._id} value={u._id}>
                                        {u.name}
                                      </option>
                                    ))}
                                  </select>
                                )
                              ) : col.key === "secondary_assignees_name" ? (
                                (() => {
                                  const isPickerOpen =
                                    activeCellPicker?.rowId === row._id &&
                                    activeCellPicker?.field === "secondary_assignees_name";
                                  const secUsers = assignableUsers.filter(
                                    (u) => u._id !== row.primary_assignee_id
                                  );

                                  if (isRowConverted) {
                                    return (
                                      <span
                                        className="block truncate text-slate-700 dark:text-slate-300"
                                        title={row.secondary_assignees_name || "—"}
                                      >
                                        {row.secondary_assignees_name || "—"}
                                      </span>
                                    );
                                  }

                                  return (
                                    <div className="relative w-full">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setActiveCellPicker(
                                            isPickerOpen
                                              ? null
                                              : {
                                                  rowId: row._id,
                                                  field: "secondary_assignees_name",
                                                }
                                          )
                                        }
                                        className="flex w-full items-center justify-between gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                        title={row.secondary_assignees_name || "Select secondary assignees"}
                                      >
                                        <span className="truncate text-slate-700 dark:text-slate-300">
                                          {row.secondary_assignees_name &&
                                          row.secondary_assignees_name !== "—"
                                            ? row.secondary_assignees_name
                                            : "Select..."}
                                        </span>
                                        <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
                                      </button>

                                      {isPickerOpen && (
                                        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                          {!row.primary_assignee_id ? (
                                            <div className="px-2 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                                              Select a Primary Assignee first.
                                            </div>
                                          ) : (
                                            <div className="max-h-48 overflow-y-auto space-y-0.5">
                                              {secUsers.map((u) => {
                                                const checked = row.secondary_assignee_ids.includes(
                                                  String(u._id)
                                                );
                                                return (
                                                  <button
                                                    key={u._id}
                                                    type="button"
                                                    onClick={() => {
                                                      const uid = String(u._id);
                                                      const nextSec = checked
                                                        ? row.secondary_assignee_ids.filter(
                                                            (id) => id !== uid
                                                          )
                                                        : [...row.secondary_assignee_ids, uid];
                                                      saveAssignees(
                                                        row._id,
                                                        row.primary_assignee_id,
                                                        nextSec
                                                      );
                                                    }}
                                                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition cursor-pointer ${
                                                      checked
                                                        ? "bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                                    }`}
                                                  >
                                                    <span className="truncate">{u.name}</span>
                                                    {checked && (
                                                      <Check className="h-3.5 w-3.5 shrink-0" />
                                                    )}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}
                                          <div className="mt-1 border-t border-slate-100 pt-1 text-right dark:border-slate-800">
                                            <button
                                              type="button"
                                              onClick={() => setActiveCellPicker(null)}
                                              className="rounded px-2 py-0.5 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 cursor-pointer"
                                            >
                                              Done
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : col.key === "assigned_to_name" ? (
                                <span
                                  className="block truncate text-slate-700 dark:text-slate-300"
                                  title={String(row[col.key] || "—")}
                                >
                                  {row[col.key] || "—"}
                                </span>
                              ) : col.key === "required_products" ? (
                                <div
                                  className="w-full truncate text-xs"
                                  title={row.required_products}
                                >
                                  {row.products_list && row.products_list.length > 0 ? (
                                    <div className="flex flex-wrap items-center gap-1 truncate">
                                      {row.products_list.map((p, pIdx) => (
                                        <span
                                          key={pIdx}
                                          className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                                        >
                                          <span>{p.product_name || "Item"}</span>
                                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                            ({Number(p.quantity) || 0})
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 font-normal">—</span>
                                  )}
                                </div>
                              ) : col.key === "products_summary" ? (
                                <div className="w-full truncate text-xs">
                                  {row.products_list && row.products_list.length > 0 ? (
                                    <div className="flex flex-wrap items-center gap-1.5 truncate">
                                      {row.products_list.map((p, pIdx) => (
                                        <span
                                          key={pIdx}
                                          className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                                        >
                                          <span>{p.product_name || "Item"}</span>
                                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                            - {p.quantity} {p.unit || "pcs"}
                                          </span>
                                        </span>
                                      ))}
                                      {row.requirement && (
                                        <span className="text-[11px] text-slate-500 italic truncate max-w-[120px]">
                                          ({row.requirement})
                                        </span>
                                      )}
                                    </div>
                                  ) : row.requirement ? (
                                    <span className="text-slate-700 dark:text-slate-300 truncate">
                                      {row.requirement}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-normal">—</span>
                                  )}
                                </div>
                              ) : col.key === "next_follow_up_at" ? (
                                canScheduleFollowUp(row.status) ? (
                                  <div className="flex items-center gap-1 w-full truncate">
                                    <input
                                      type="datetime-local"
                                      value={
                                        row.next_follow_up_at
                                          ? new Date(row.next_follow_up_at).toISOString().slice(0, 16)
                                          : ""
                                      }
                                      onChange={(e) =>
                                        saveCell(
                                          row._id,
                                          "next_follow_up_at",
                                          e.target.value
                                            ? new Date(e.target.value).toISOString()
                                            : undefined
                                        )
                                      }
                                      className={`w-full bg-transparent text-xs rounded border-0 px-1 py-0.5 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-emerald-500 ${
                                        isOverdue
                                          ? "font-bold text-rose-600 dark:text-rose-400"
                                          : isToday
                                          ? "font-bold text-amber-600 dark:text-amber-400"
                                          : "text-slate-700 dark:text-slate-300"
                                      }`}
                                    />
                                    {isOverdue && (
                                      <span
                                        title="Overdue Follow-up"
                                        className="h-2 w-2 rounded-full bg-rose-500 shrink-0"
                                      />
                                    )}
                                    {isToday && (
                                      <span
                                        title="Due Today"
                                        className="h-2 w-2 rounded-full bg-amber-500 shrink-0"
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-normal truncate">
                                    {row.next_follow_up_at ? formatLeadDate(row.next_follow_up_at) : "—"}
                                  </span>
                                )
                              ) : col.key === "estimated_value" ? (
                                isRowConverted ? (
                                  <span className="truncate text-right font-semibold text-slate-800 dark:text-slate-200">
                                    {Number(row.estimated_value) > 0
                                      ? formatCurrencyINR(row.estimated_value)
                                      : "—"}
                                  </span>
                                ) : (
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={
                                      row.estimated_value !== undefined && row.estimated_value !== null
                                        ? String(row.estimated_value)
                                        : ""
                                    }
                                    onChange={(e) => {
                                      const newVal = e.target.value;
                                      setLocalRows((prev) =>
                                        prev.map((r) =>
                                          r._id === row._id
                                            ? { ...r, estimated_value: newVal === "" ? 0 : Number(newVal) }
                                            : r
                                        )
                                      );
                                    }}
                                    onBlur={(e) => saveCell(row._id, "estimated_value", e.target.value)}
                                    className="w-full bg-transparent border-0 px-1 py-0.5 text-xs text-right font-semibold text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-800 rounded focus:ring-1 focus:ring-emerald-500 truncate"
                                  />
                                )
                              ) : col.key === "createdAt" ? (
                                <span className="text-slate-500 text-[11px] truncate">
                                  {row.createdAt}
                                </span>
                              ) : col.key === "last_remarks" ? (
                                isRowConverted ? (
                                  <span
                                    className="truncate text-slate-700 dark:text-slate-300 text-xs"
                                    title={String(row.last_remarks || "—")}
                                  >
                                    {row.last_remarks || "—"}
                                  </span>
                                ) : (
                                  <div className="group/remark relative flex w-full items-center gap-1">
                                    <input
                                      type="text"
                                      value={row.last_remarks || ""}
                                      placeholder="Add remark..."
                                      onChange={(e) => {
                                        const newVal = e.target.value;
                                        setLocalRows((prev) =>
                                          prev.map((r) =>
                                            r._id === row._id ? { ...r, last_remarks: newVal } : r
                                          )
                                        );
                                      }}
                                      onBlur={(e) => saveCell(row._id, "last_remarks", e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      className="w-full bg-transparent border-0 px-1 py-0.5 text-xs text-slate-800 placeholder:text-slate-400 placeholder:italic dark:text-white focus:bg-white dark:focus:bg-slate-800 rounded focus:ring-1 focus:ring-emerald-500 truncate"
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLiveRemarkTarget(row);
                                      }}
                                      title="Open live follow-up remark composer"
                                      className="shrink-0 rounded p-0.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition cursor-pointer"
                                    >
                                      <MessageSquarePlus className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )
                              ) : col.key === "created_by_name" ? (
                                <span
                                  className="truncate text-slate-700 dark:text-slate-300 text-xs"
                                  title={String(row[col.key] || "—")}
                                >
                                  {row[col.key] || "—"}
                                </span>
                              ) : col.key === "company_name" ? (
                                isRowConverted ? (
                                  <span className="truncate font-bold text-slate-900 dark:text-white">
                                    {row.company_name || "—"}
                                  </span>
                                ) : (
                                  <input
                                    type="text"
                                    value={row.company_name || ""}
                                    onChange={(e) => {
                                      const newVal = e.target.value;
                                      setLocalRows((prev) =>
                                        prev.map((r) =>
                                          r._id === row._id ? { ...r, company_name: newVal } : r
                                        )
                                      );
                                    }}
                                    onBlur={(e) => saveCell(row._id, "company_name", e.target.value)}
                                    className="w-full bg-transparent border-0 px-1 py-0.5 text-xs font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 rounded focus:ring-1 focus:ring-emerald-500 truncate"
                                  />
                                )
                              ) : col.key === "industry" ? (
                                isRowConverted ? (
                                  <span
                                    className="truncate text-slate-700 dark:text-slate-300 text-xs"
                                    title={row.industry || "—"}
                                  >
                                    {row.industry || "—"}
                                  </span>
                                ) : (
                                  <select
                                    value={row.industry || ""}
                                    onChange={(e) =>
                                      saveCell(row._id, "industry", e.target.value)
                                    }
                                    className="w-full bg-transparent border-0 px-1 py-0.5 text-xs text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-800 rounded focus:ring-1 focus:ring-emerald-500 truncate cursor-pointer"
                                  >
                                    <option value="">— Select Industry —</option>
                                    {DEFAULT_INDUSTRIES.map((ind) => (
                                      <option key={ind} value={ind}>
                                        {ind}
                                      </option>
                                    ))}
                                    {row.industry && !DEFAULT_INDUSTRIES.includes(row.industry) && (
                                      <option value={row.industry}>{row.industry}</option>
                                    )}
                                  </select>
                                )
                              ) : isRowConverted ? (
                                <span className="truncate text-slate-700 dark:text-slate-300">
                                  {cellValue !== undefined && cellValue !== null && String(cellValue).trim()
                                    ? String(cellValue)
                                    : "—"}
                                </span>
                              ) : (
                                <input
                                  type={col.type === "number" ? "number" : "text"}
                                  value={cellValue !== undefined && cellValue !== null ? String(cellValue) : ""}
                                  onChange={(e) => {
                                    const newVal = e.target.value;
                                    setLocalRows((prev) =>
                                      prev.map((r) =>
                                        r._id === row._id ? { ...r, [col.key]: newVal } : r
                                      )
                                    );
                                  }}
                                  onBlur={(e) => saveCell(row._id, col.key, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      (e.currentTarget as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-full bg-transparent border-0 px-1 py-0.5 text-xs text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-800 rounded focus:ring-1 focus:ring-emerald-500 truncate"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bulk Action Bar (Admin only) */}
            {canDelete && selectedCount > 0 && (
              <div className="border-t border-emerald-500 bg-emerald-900 text-white px-4 py-2.5 flex items-center justify-between shadow-2xl shrink-0 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-emerald-800 px-2 py-0.5 text-xs font-bold">
                    {selectedCount} Selected
                  </span>
                  <span className="text-xs text-emerald-200">
                    Bulk actions on selected leads
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIds({})}
                    className="rounded-lg border border-white/20 px-3 py-1 text-xs font-medium text-white hover:bg-white/10"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow hover:bg-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Selected ({selectedCount})
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Filter Drawer / Panel (Right Slide-out) */}
          {isFilterPanelOpen && (
            <div className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between overflow-y-auto shadow-2xl z-30 animate-in slide-in-from-right-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Filters Panel
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFilterPanelOpen(false)}
                    className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Lead Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="all">All Statuses</option>
                    {Object.keys(LEAD_STATUS_CONFIG).map((st) => (
                      <option key={st} value={st}>
                        {LEAD_STATUS_CONFIG[st as LeadStatus]?.label || st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="all">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                {/* Department Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="all">All Departments</option>
                    {departmentOptions.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Source Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Lead Source
                  </label>
                  <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="all">All Sources</option>
                    {sources?.map((s) => (
                      <option key={s._id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assigned filter — super admin only (sees all leads) */}
                {isSA && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Assigned User
                    </label>
                    <select
                      value={filterSalesUser}
                      onChange={(e) => setFilterSalesUser(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="all">All Assignees</option>
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

                {/* Follow-up State Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Follow-up Urgency
                  </label>
                  <select
                    value={filterFollowUpState}
                    onChange={(e) => setFilterFollowUpState(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="all">All Follow-ups</option>
                    <option value="today">Due Today</option>
                    <option value="overdue">Overdue</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="no_followup">No Follow-up Scheduled</option>
                  </select>
                </div>

                {/* Date Range Preset */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Created Date Range
                  </label>
                  <select
                    value={filterDatePreset}
                    onChange={(e) => setFilterDatePreset(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last_7">Last 7 Days</option>
                    <option value="last_30">Last 30 Days</option>
                    <option value="custom">Custom Date Range</option>
                  </select>

                  {filterDatePreset === "custom" && (
                    <div className="mt-2 space-y-1.5">
                      <input
                        type="date"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <input
                        type="date"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  )}
                </div>

                {/* Quantity Range */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Est. Quantity Range
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min Qty"
                      value={filterMinQty}
                      onChange={(e) => setFilterMinQty(e.target.value)}
                      className="w-1/2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="Max Qty"
                      value={filterMaxQty}
                      onChange={(e) => setFilterMaxQty(e.target.value)}
                      className="w-1/2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Location Filter */}
                {uniqueCities.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      City
                    </label>
                    <select
                      value={filterCity}
                      onChange={(e) => setFilterCity(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="all">All Cities</option>
                      {uniqueCities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Reset Filters
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterPanelOpen(false)}
                  className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sub-modals for Action buttons inside the sheet */}
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

        {liveRemarkTarget && (
          <LiveAddRemarkModal
            row={liveRemarkTarget}
            open={Boolean(liveRemarkTarget)}
            onClose={() => setLiveRemarkTarget(null)}
            onSuccess={handleRemarkSaved}
          />
        )}

        {deleteTarget && canDelete && (
          <ConfirmDeleteLeadModal
            lead={deleteTarget}
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            onSuccess={() => refetch()}
          />
        )}

        {downloadPreviewOpen && (
          <DownloadLeadsPreviewModal
            open={downloadPreviewOpen}
            onClose={() => setDownloadPreviewOpen(false)}
            leads={filteredRows}
            availableColumns={visibleColumns.map((c) => ({
              key: c.key,
              label: c.label,
              widthPdf: c.widthPdf,
            }))}
          />
        )}
      </div>
    </LargeModalPortal>
  );
}
