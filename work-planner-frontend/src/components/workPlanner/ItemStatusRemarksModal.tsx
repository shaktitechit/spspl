"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Send,
  ClipboardCheck,
  Check,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Camera,
  MapPin,
} from "lucide-react";
import { DayEndRichEditor } from "./DayEndRichEditor";
import { formatDateTime, formatLocalityCity, getVisitLocationDisplay, stripHtml } from "./workPlanUtils";
import { readSessionFromStorage, isWpElevated, roleLabel } from "@/utils/authStorage";
import { resolvePublicAssetUrl, withFileAccessToken } from "@/lib/env";
import type { AuthorityRemarkItem, WorkPlanVisitRecord } from "@/types/workPlanner";
import { useUploadWorkPlanAttachmentMutation } from "@/store/api/workPlannerApiSlice";
import { toast } from "sonner";

export type WorkflowStatus =
  | "created"
  | "pending"
  | "in_progress"
  | "checked_in"
  | "checked_out"
  | "completed";

export type CompleteVisitAnswers = {
  meeting_with_doctor: boolean;
  meeting_with_purchase: boolean;
  meeting_with_finance: boolean;
  meeting_with_engineer: boolean;
  new_product_introduced: boolean;
  order_received: boolean;
};

export const VISIT_COMPLETION_QUESTIONS: Array<{
  key: keyof CompleteVisitAnswers;
  label: string;
}> = [
  { key: "meeting_with_doctor", label: "Meeting with doctor?" },
  { key: "meeting_with_purchase", label: "Meeting with purchase?" },
  { key: "meeting_with_finance", label: "Meeting with finance?" },
  { key: "meeting_with_engineer", label: "Meeting with engineer/technician?" },
  { key: "new_product_introduced", label: "New product introduced?" },
  { key: "order_received", label: "Order received?" },
];

export interface ItemStatusRemarksModalProps {
  open: boolean;
  itemType: "visit" | "task";
  title: string;
  currentStatus: string;
  initialPendingRemarks?: string;
  initialInProgressRemarks?: string;
  initialOutcome?: string;
  initialManagerRemarks?: string;
  initialRescheduledDate?: string;
  authorityRemarksHistory?: AuthorityRemarkItem[];
  planOwnerId?: string;
  initialVisitAnswers?: Partial<CompleteVisitAnswers>;
  visitRecord?: WorkPlanVisitRecord;
  isSaving?: boolean;
  onClose: () => void;
  onConfirm: (data: {
    status: WorkflowStatus;
    remarks: string;
    managerRemarks?: string;
    rescheduledDate?: string;
    visitAnswers?: CompleteVisitAnswers;
    selfieUrl?: string;
    lat?: number;
    lng?: number;
    address?: string;
  }) => Promise<void> | void;
}

export function ItemStatusRemarksModal({
  open,
  itemType,
  title,
  currentStatus,
  initialPendingRemarks = "",
  initialInProgressRemarks = "",
  initialOutcome = "",
  initialManagerRemarks = "",
  initialRescheduledDate = "",
  authorityRemarksHistory = [],
  planOwnerId = "",
  initialVisitAnswers,
  visitRecord,
  isSaving = false,
  onClose,
  onConfirm,
}: ItemStatusRemarksModalProps) {
  const sessionUser = readSessionFromStorage()?.user;
  const elevatedRole = isWpElevated(sessionUser);
  const currentUserId = String(sessionUser?._id || (sessionUser as any)?.id || "");
  const itemOwnerId = String(
    planOwnerId ||
    (visitRecord as any)?.sales_user?._id ||
    (visitRecord as any)?.sales_user ||
    ""
  );
  const isSelf = Boolean(currentUserId && itemOwnerId && currentUserId === itemOwnerId);
  const isSeniorViewing = elevatedRole && !isSelf;
  const currentRoleName = roleLabel(sessionUser);

  const isVisit = itemType === "visit";

  const sessionToken = readSessionFromStorage()?.token;

  // Determine default selected target status (defaulting to next logical stage or current status)
  const defaultSelectedStatus = (): WorkflowStatus => {
    const s = String(currentStatus || "").toLowerCase() as WorkflowStatus;
    if (isVisit && (s === "created" || s === "pending")) return "checked_in";
    if (isVisit && s === "checked_in") return "completed";
    if (s === "created" || s === "pending") return "in_progress";
    if (s === "in_progress") return "completed";
    if (s === "completed") return "completed";
    return "completed";
  };

  const [selectedStatus, setSelectedStatus] = useState<WorkflowStatus>(defaultSelectedStatus);
  const [remarks, setRemarks] = useState("");
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geoAddressStr, setGeoAddressStr] = useState<string>("");
  const [geoTimeStr, setGeoTimeStr] = useState<string>("");
  const [uploadAttachmentMut, { isLoading: isUploadingSelfie }] = useUploadWorkPlanAttachmentMutation();
  const [visitAnswers, setVisitAnswers] = useState<Record<keyof CompleteVisitAnswers, boolean | null>>({
    meeting_with_doctor: null,
    meeting_with_purchase: null,
    meeting_with_finance: null,
    meeting_with_engineer: null,
    new_product_introduced: null,
    order_received: null,
  });

  // Sync initial values when modal opens
  useEffect(() => {
    if (open) {
      const initStatus = defaultSelectedStatus();
      setSelectedStatus(initStatus);
      setSelfieFile(null);
      setSelfiePreview(null);
      setGeoTimeStr(new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }));
      if (typeof window !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setGeoLat(lat);
            setGeoLng(lng);
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
              .then((res) => res.json())
              .then((data) => {
                if (data?.display_name) {
                  setGeoAddressStr(data.display_name);
                }
              })
              .catch(() => {});
          },
          () => {},
          { enableHighAccuracy: true, timeout: 6000 }
        );
      }
      if (initStatus === "pending") {
        setRemarks(initialPendingRemarks || "");
      } else if (initStatus === "in_progress") {
        setRemarks(initialInProgressRemarks || "");
      } else {
        setRemarks(initialOutcome || "");
      }

      setVisitAnswers({
        meeting_with_doctor:
          typeof initialVisitAnswers?.meeting_with_doctor === "boolean"
            ? initialVisitAnswers.meeting_with_doctor
            : null,
        meeting_with_purchase:
          typeof initialVisitAnswers?.meeting_with_purchase === "boolean"
            ? initialVisitAnswers.meeting_with_purchase
            : null,
        meeting_with_finance:
          typeof initialVisitAnswers?.meeting_with_finance === "boolean"
            ? initialVisitAnswers.meeting_with_finance
            : null,
        meeting_with_engineer:
          typeof initialVisitAnswers?.meeting_with_engineer === "boolean"
            ? initialVisitAnswers.meeting_with_engineer
            : null,
        new_product_introduced:
          typeof initialVisitAnswers?.new_product_introduced === "boolean"
            ? initialVisitAnswers.new_product_introduced
            : null,
        order_received:
          typeof initialVisitAnswers?.order_received === "boolean"
            ? initialVisitAnswers.order_received
            : null,
      });
    }
  }, [
    open,
    currentStatus,
    initialPendingRemarks,
    initialInProgressRemarks,
    initialOutcome,
    initialManagerRemarks,
    initialVisitAnswers,
  ]);

  // Update prefilled remarks when target status changes
  const handleStatusChange = (newStatus: WorkflowStatus) => {
    setSelectedStatus(newStatus);
    if (newStatus === "pending") {
      setRemarks(initialPendingRemarks || "");
    } else if (newStatus === "in_progress") {
      setRemarks(initialInProgressRemarks || "");
    } else if (newStatus === "completed") {
      setRemarks(initialOutcome || "");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If visit is being completed, ensure mandatory checklist questions are answered
    if (isVisit && selectedStatus === "completed") {
      const unanswered = VISIT_COMPLETION_QUESTIONS.find((q) => visitAnswers[q.key] === null);
      if (unanswered) {
        toast.error(`Please answer checklist question: "${unanswered.label}"`);
        return;
      }
    }

    const cleanText = stripHtml(remarks).trim();

    if (!cleanText && !elevatedRole) {
      toast.error(
        selectedStatus === "completed"
          ? "Please provide outcome or completion remarks"
          : selectedStatus === "pending"
          ? "Please enter pending remarks / reason"
          : "Please enter status remarks or execution notes"
      );
      return;
    }

    try {
      const finalAnswers: CompleteVisitAnswers | undefined =
        isVisit && selectedStatus === "completed"
          ? {
              meeting_with_doctor: Boolean(visitAnswers.meeting_with_doctor),
              meeting_with_purchase: Boolean(visitAnswers.meeting_with_purchase),
              meeting_with_finance: Boolean(visitAnswers.meeting_with_finance),
              meeting_with_engineer: Boolean(visitAnswers.meeting_with_engineer),
              new_product_introduced: Boolean(visitAnswers.new_product_introduced),
              order_received: Boolean(visitAnswers.order_received),
            }
          : undefined;

      let uploadedSelfieUrl: string | undefined = undefined;
      if (selfieFile) {
        try {
          const formData = new FormData();
          formData.append("file", selfieFile);
          const res = await uploadAttachmentMut(formData).unwrap();
          uploadedSelfieUrl = res.url || res.file_name;
        } catch (err) {
          console.error("Web selfie upload failed", err);
        }
      }

      await onConfirm({
        status: selectedStatus,
        remarks: remarks.trim() || (elevatedRole ? `Status updated by ${currentRoleName}` : ""),
        visitAnswers: finalAnswers,
        selfieUrl: uploadedSelfieUrl,
        lat: geoLat || undefined,
        lng: geoLng || undefined,
        address: geoAddressStr || undefined,
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status & remarks");
    }
  };

  if (!open) return null;

  // Status options tailored based on itemType and elevated authority level
  const STATUS_OPTIONS: Array<{
    id: WorkflowStatus;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = isVisit
    ? elevatedRole
      ? [
          {
            id: "created",
            label: "Created / Planned",
            description: "Reset or keep visit as scheduled/created",
            icon: <Sparkles className="h-4 w-4 text-sky-500" />,
          },
          {
            id: "pending",
            label: "Pending",
            description: "Postpone or mark on hold with pending reason",
            icon: <Clock className="h-4 w-4 text-slate-500" />,
          },
          {
            id: "in_progress",
            label: "In Progress",
            description: "Field visit is currently active or underway",
            icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
          },
          {
            id: "completed",
            label: "Completed",
            description: "Mark visit completed with outcome checklist & notes",
            icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          },
        ]
      : [
          {
            id: "checked_in",
            label: "Check In",
            description: "Log check-in time & selfie at the visit site",
            icon: <UserCheck className="h-4 w-4 text-indigo-500" />,
          },
          {
            id: "completed",
            label: "Completed (Outcome)",
            description: "Complete visit with outcome checklist & notes",
            icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          },
        ]
    : elevatedRole
    ? [
        {
          id: "created",
          label: "Created / Open",
          description: "Keep task in open/initial state",
          icon: <Sparkles className="h-4 w-4 text-sky-500" />,
        },
        {
          id: "pending",
          label: "Pending",
          description: "Mark task pending or on hold",
          icon: <Clock className="h-4 w-4 text-slate-500" />,
        },
        {
          id: "in_progress",
          label: "In Progress",
          description: "Task is currently active and being worked on",
          icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
        },
        {
          id: "completed",
          label: "Completed",
          description: "Successfully finished with final outcome & notes",
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        },
      ]
    : [
        {
          id: "pending",
          label: "Pending",
          description: "Postpone or mark on hold with pending reason",
          icon: <Clock className="h-4 w-4 text-slate-500" />,
        },
        {
          id: "in_progress",
          label: "In Progress",
          description: "Task is currently active or underway",
          icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
        },
        {
          id: "completed",
          label: "Completed",
          description: "Successfully finished with final outcome & notes",
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 font-sans animate-in fade-in duration-150">
      <div className="w-full sm:max-w-xl max-h-[94vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 overflow-hidden">
        {/* Mobile Drag Indicator Handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 sm:px-6 py-3.5 sm:py-4 shrink-0 bg-card">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                  {currentStatus === "completed" ? "Edit Remarks" : "Update Status"}
                </h2>
                <span className="rounded bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-muted uppercase shrink-0">
                  {isVisit ? "Visit" : "Task"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-muted truncate max-w-xs mt-0.5">
                {title}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground active:scale-95 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
            {/* Workflow Progress Breadcrumb */}
            <div className="rounded-xl border border-border bg-surface-muted/50 p-3 text-xs space-y-2">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                Workflow Progression
              </div>
              <div className="flex items-center justify-between gap-1 overflow-x-auto">
                <span
                  className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap ${
                    currentStatus === "created"
                      ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                      : "text-muted"
                  }`}
                >
                  1. Created
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
                <span
                  className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap ${
                    selectedStatus === "pending" || currentStatus === "pending"
                      ? "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/20"
                      : "text-muted"
                  }`}
                >
                  2. Pending
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
                <span
                  className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap ${
                    selectedStatus === "in_progress" || currentStatus === "in_progress"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                      : "text-muted"
                  }`}
                >
                  3. In Progress
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
                <span
                  className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap ${
                    selectedStatus === "completed" || currentStatus === "completed"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "text-muted"
                  }`}
                >
                  4. Completed
                </span>
              </div>
            </div>

            {/* Target Status Selection Cards */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Select Target Status Stage <span className="text-rose-500">*</span>
              </label>
              <div className="grid gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = selectedStatus === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleStatusChange(opt.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left transition cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-2xs"
                          : "border-border bg-card hover:bg-surface-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="shrink-0">{opt.icon}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                              {opt.label}
                            </span>
                            {isSelected && (
                              <span className="rounded bg-primary px-1.5 py-0.2 text-[10px] font-bold text-primary-foreground">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted">{opt.description}</p>
                        </div>
                      </div>

                      <div className="h-4 w-4 rounded-full border border-border flex items-center justify-center shrink-0">
                        {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mandatory Visit Checklist Form (in case of Visit + Completed status) */}
            {isVisit && selectedStatus === "completed" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-foreground">
                      Mandatory Visit Checklist Questions
                    </span>
                  </div>
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    Required
                  </span>
                </div>
                <p className="text-[11px] text-muted leading-tight">
                  Please specify responses for all checklist questions before marking this visit completed.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {VISIT_COMPLETION_QUESTIONS.map((q) => {
                    const val = visitAnswers[q.key];
                    return (
                      <div
                        key={q.key}
                        className={`flex flex-col justify-between rounded-lg border p-2.5 transition ${
                          val === null
                            ? "border-border bg-card"
                            : val === true
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : "border-border bg-surface-muted/40"
                        }`}
                      >
                        <span className="text-xs font-medium text-foreground mb-2">
                          {q.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              setVisitAnswers((prev) => ({ ...prev, [q.key]: true }))
                            }
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer ${
                              val === true
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-card border border-border text-foreground hover:bg-surface-muted"
                            }`}
                          >
                            {val === true && <Check className="h-3.5 w-3.5" />}
                            Yes
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              setVisitAnswers((prev) => ({ ...prev, [q.key]: false }))
                            }
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer ${
                              val === false
                                ? "bg-slate-700 dark:bg-slate-600 text-white shadow-xs"
                                : "bg-card border border-border text-foreground hover:bg-surface-muted"
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Client Selfie & Geolocation Inspection Section for Visits */}
            {isVisit && (
              <div className="rounded-xl border border-border bg-surface-muted/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Camera className="h-4 w-4 text-primary" />
                    <span>
                      {isSeniorViewing
                        ? "Senior Inspection — Client Selfies & Geolocation"
                        : "Client Selfie & Geolocation Verification"}
                    </span>
                  </div>
                  {!isSeniorViewing && selfiePreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelfieFile(null);
                        setSelfiePreview(null);
                      }}
                      className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Preview Cards for Existing or Newly Captured Selfies */}
                {(() => {
                  const rawCheckIn = visitRecord?.check_in_selfie_url;
                  const checkInUrl = rawCheckIn ? withFileAccessToken(resolvePublicAssetUrl(rawCheckIn), sessionToken) : "";
                  const rawCheckOut = visitRecord?.check_out_selfie_url || visitRecord?.outcome_selfie_url;
                  const checkOutUrl = rawCheckOut ? withFileAccessToken(resolvePublicAssetUrl(rawCheckOut), sessionToken) : "";
                  const hasExisting = Boolean(checkInUrl || checkOutUrl);

                  if (isSeniorViewing) {
                    if (!hasExisting) {
                      return (
                        <div className="rounded-lg border border-border bg-card p-3 text-center text-xs text-muted">
                          ℹ️ No Client Selfie uploaded by executive for this visit yet.
                        </div>
                      );
                    }
                    return (
                      <div className="flex flex-wrap items-center gap-3">
                        {checkInUrl && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-muted">Check-In Selfie</span>
                            <div className="relative group w-44 h-40 rounded-xl overflow-hidden border border-border shadow-xs bg-black">
                              <img
                                src={checkInUrl}
                                alt="Check In Selfie"
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200 cursor-pointer"
                                onClick={() => window.open(checkInUrl, "_blank")}
                              />
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/75 to-transparent p-2 text-[10px] text-white flex flex-col gap-0.5">
                                <div className="flex items-center gap-1 text-amber-300 font-bold">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  <span>{visitRecord?.actual_check_in ? new Date(visitRecord.actual_check_in).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Timestamp Verified"}</span>
                                </div>
                                <div className="flex items-center gap-1 text-sky-300 font-semibold truncate">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{getVisitLocationDisplay(visitRecord?.check_in_address || visitRecord?.check_out_address || visitRecord?.address, visitRecord?.check_in_lat ?? visitRecord?.check_out_lat, visitRecord?.check_in_lng ?? visitRecord?.check_out_lng)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {checkOutUrl && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-muted">Check-Out Selfie</span>
                            <div className="relative group w-44 h-40 rounded-xl overflow-hidden border border-border shadow-xs bg-black">
                              <img
                                src={checkOutUrl}
                                alt="Check Out Selfie"
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200 cursor-pointer"
                                onClick={() => window.open(checkOutUrl, "_blank")}
                              />
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/75 to-transparent p-2 text-[10px] text-white flex flex-col gap-0.5">
                                <div className="flex items-center gap-1 text-amber-300 font-bold">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  <span>{visitRecord?.actual_check_out ? new Date(visitRecord.actual_check_out).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Timestamp Verified"}</span>
                                </div>
                                <div className="flex items-center gap-1 text-sky-300 font-semibold truncate">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{getVisitLocationDisplay(visitRecord?.check_out_address || visitRecord?.check_in_address || visitRecord?.address, visitRecord?.check_out_lat ?? visitRecord?.check_in_lat, visitRecord?.check_out_lng ?? visitRecord?.check_in_lng)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Junior View: Allow Selfie Capture/Upload + Preview
                  return (
                    <div className="space-y-3">
                      {selfiePreview ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="relative group w-48 h-44 rounded-xl overflow-hidden border border-primary shadow-sm bg-black">
                            <img src={selfiePreview} alt="Selfie preview" className="w-full h-full object-cover" />
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/75 to-transparent p-2 text-[10px] text-white flex flex-col gap-0.5">
                              <div className="flex items-center gap-1 text-amber-300 font-bold">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>{geoTimeStr || new Date().toLocaleString("en-GB")}</span>
                              </div>
                              <div className="flex items-center gap-1 text-sky-300 font-semibold truncate">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {geoAddressStr ? geoAddressStr : geoLat && geoLng ? `Lat: ${geoLat.toFixed(4)}, Lng: ${geoLng.toFixed(4)}` : "GPS Location Captured"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="text-[11px] font-medium text-muted">Verified Client Selfie Preview</span>
                        </div>
                      ) : (selectedStatus === "checked_in" || selectedStatus === "completed" || selectedStatus === "checked_out") ? (
                        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-border hover:border-primary rounded-xl cursor-pointer bg-card hover:bg-surface-muted transition gap-1.5 text-center">
                          <Camera className="h-6 w-6 text-primary" />
                          <span className="text-xs font-bold text-foreground">Take / Attach Selfie with Client</span>
                          <span className="text-[10px] text-muted">Click to capture photo using camera or file</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="user"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setSelfieFile(file);
                              setSelfiePreview(URL.createObjectURL(file));
                              setGeoTimeStr(new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }));
                              if (navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(
                                  (pos) => {
                                    const lat = pos.coords.latitude;
                                    const lng = pos.coords.longitude;
                                    setGeoLat(lat);
                                    setGeoLng(lng);
                                    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
                                      .then((res) => res.json())
                                      .then((data) => {
                                        if (data?.display_name) {
                                          setGeoAddressStr(data.display_name);
                                        }
                                      })
                                      .catch(() => {});
                                  },
                                  (err) => console.log("Geo error", err),
                                  { enableHighAccuracy: true, timeout: 5000 }
                                );
                              }
                            }}
                          />
                        </label>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Dynamic Remarks Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>
                  {selectedStatus === "completed"
                    ? isVisit
                      ? "Outcome & Summary Notes"
                      : "Outcome & Final Completion Remarks"
                    : selectedStatus === "pending"
                    ? "Pending Remarks / Delay Reason"
                    : selectedStatus === "created"
                    ? "Initial Notes / Objectives"
                    : "In-Progress Status Remarks"}
                  {!elevatedRole && <span className="text-rose-500"> *</span>}
                </span>
                {elevatedRole && (
                  <span className="text-[11px] text-muted font-normal">
                    (Executive field)
                  </span>
                )}
              </label>
              <DayEndRichEditor
                value={remarks}
                onChange={setRemarks}
                minHeight="110px"
                placeholder={
                  selectedStatus === "completed"
                    ? isVisit
                      ? "What was discussed? Next steps, meeting takeaways, or decisions..."
                      : "Describe the outcome, meeting takeaways, key decisions, or task output..."
                    : selectedStatus === "pending"
                    ? "State reason for keeping this item pending / on hold..."
                    : "Provide status update, meeting details, or notes..."
                }
              />
            </div>

            {/* Read-only Senior Directive Callout for Guidance */}
            {initialManagerRemarks ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-primary">
                    Active Senior Directive / Supervisory Instruction
                  </span>
                </div>
                <div className="text-xs text-foreground whitespace-pre-line">
                  {stripHtml(initialManagerRemarks)}
                </div>
              </div>
            ) : null}

            {/* Senior Remarks History — read-only reference */}
            {Array.isArray(authorityRemarksHistory) && authorityRemarksHistory.length > 0 && (
              <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-bold text-foreground">
                    Senior Remarks History ({authorityRemarksHistory.length})
                  </h4>
                </div>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {authorityRemarksHistory.map((item, idx) => {
                    const authorName = item.user_name || (typeof item.user === "object" ? item.user?.name : "Senior Authority");
                    const role = item.role || "Senior Authority";
                    const roleLower = String(role).toLowerCase();
                    const badgeTone =
                      roleLower.includes("admin")
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        : roleLower.includes("coordinator")
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : "bg-primary/15 text-primary border-primary/20";

                    return (
                      <div
                        key={item._id || idx}
                        className="rounded-lg border border-border bg-card p-2.5 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground">{authorName}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${badgeTone}`}>
                              {role}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted">
                            {formatDateTime(item.created_at)}
                          </span>
                        </div>
                        <div
                          className="text-muted text-[11px] prose prose-xs dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: item.remark }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-border shrink-0 bg-surface-muted/30">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="w-full sm:w-auto rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground active:scale-[0.98] transition cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md active:scale-[0.98] disabled:opacity-50 transition cursor-pointer ${
                selectedStatus === "completed"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-primary hover:bg-primary-hover"
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  {currentStatus === "completed"
                    ? "Update Remarks & Outcome"
                    : selectedStatus === "completed" && isVisit
                    ? "Complete Visit"
                    : "Update Status & Remarks"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
