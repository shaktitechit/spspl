"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Calendar, CheckCircle2, Info, Plus, Sparkles, User, X } from "lucide-react";
import type { WorkPlanWorkRecord } from "@/types/workPlanner";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import { useGetMyTeamQuery, useGetPlansQuery, useGetUserSettingsQuery } from "@/store/api/workPlannerApiSlice";
import {
  isWpAdmin,
  isWpManager,
  isWpElevated,
  hasWorkPlannerPortalAccess,
  readSessionFromStorage,
} from "@/utils/authStorage";
import { getUserWorkPlannerSettings, type CustomWorkTaskTemplate } from "@/utils/userWorkPlannerSettings";
import { formatPlanDate, formatAuditUser, formatDateTime } from "./workPlanUtils";

export type WorkFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initial?: WorkPlanWorkRecord | null;
  planDate?: string | null;
  /** Assigned executive on the parent work plan — used to scope assignment. */
  salesUserId?: string | null;
  /** ID of the plan owner — used to determine if current user is the senior */
  planOwnerId?: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void | Promise<void>;
};

interface ExecutiveUser {
  _id: string;
  id?: string;
  name: string;
  email: string;
  department?: string;
  portals?: Array<{
    portal_code?: string;
    portal?: { code?: string };
    code?: string;
    access_roles?: string[];
  }>;
}

function hasWorkPlannerAccess(u: ExecutiveUser | any, sessionUserId?: string): boolean {
  if (!u) return false;
  const uId = String(u._id || u.id || "");
  if (sessionUserId && uId === String(sessionUserId)) return true;
  return hasWorkPlannerPortalAccess(u);
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const labelClass = "mb-1.5 block text-xs font-medium text-muted";

function ymdFromPlanDate(planDate?: string | null): string {
  if (!planDate) return "";
  const trimmed = String(planDate).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeFromIso(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combinePlanDateAndTime(
  planDate: string | undefined | null,
  time: string,
): string | undefined {
  if (!time) return undefined;
  const ymd = ymdFromPlanDate(planDate) || new Date().toISOString().slice(0, 10);
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const local = new Date(`${ymd}T${normalizedTime}`);
  if (isNaN(local.getTime())) {
    const d = new Date(time);
    if (!isNaN(d.getTime())) return d.toISOString();
    return time;
  }
  return local.toISOString();
}

export function WorkFormModal({
  open,
  mode,
  initial,
  planDate,
  salesUserId,
  planOwnerId = null,
  isSaving,
  onClose,
  onSubmit,
}: WorkFormModalProps) {
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const sessionUserId = sessionUser?._id || (sessionUser as { id?: string })?.id || "";
  const adminRole = isWpAdmin(sessionUser);
  const managerRole = isWpManager(sessionUser);
  const elevatedRole = isWpElevated(sessionUser);
  const itemOwnerId = String(
    planOwnerId ||
    (initial as any)?.sales_user?._id ||
    (initial as any)?.sales_user ||
    sessionUserId ||
    ""
  );
  const isSelf = Boolean(sessionUserId && itemOwnerId && String(sessionUserId) === String(itemOwnerId));
  const isSeniorViewing = elevatedRole && !isSelf;

  // Queries for allowed executives
  const { data: usersData } = useGetUsersQuery(undefined, { skip: !open || !adminRole });
  const { data: myTeamData } = useGetMyTeamQuery(undefined, { skip: !open || adminRole || !managerRole });

  const allUsers = useMemo<ExecutiveUser[]>(() => {
    if (adminRole) return (usersData as ExecutiveUser[]) || [];
    const list: ExecutiveUser[] = [];
    const seen = new Set<string>();

    const addUser = (u: any) => {
      if (!u) return;
      const id = String(u._id || u.id || "");
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push(u as ExecutiveUser);
      }
    };

    if (sessionUser) addUser(sessionUser);
    if (Array.isArray(myTeamData?.members)) {
      myTeamData.members.forEach(addUser);
    }
    if (Array.isArray(myTeamData?.edges)) {
      myTeamData.edges.forEach((e: any) => {
        if (e.manager) addUser(e.manager);
        if (e.user) addUser(e.user);
      });
    }
    return list;
  }, [adminRole, usersData, sessionUser, myTeamData]);

  // Allowed Executives for assignment:
  // - Admin: all portal members with work_planner access
  // - Manager: himself + executives reporting to him
  // - Executive: himself only
  const allowedExecutives = useMemo<ExecutiveUser[]>(() => {
    if (!elevatedRole) {
      if (!sessionUser) return [];
      return [
        {
          _id: sessionUserId,
          id: sessionUserId,
          name: `${sessionUser.name} (Self)`,
          email: sessionUser.email,
          department: sessionUser.department,
        },
      ];
    }

    if (adminRole) {
      const list = allUsers.filter((u) => hasWorkPlannerAccess(u, sessionUserId));
      if (salesUserId && !list.some((u) => String(u._id || u.id || "") === String(salesUserId))) {
        const found = allUsers.find((u) => String(u._id || u.id || "") === String(salesUserId));
        if (found) list.push(found);
      }
      return list;
    }

    const myTeamMembers = (myTeamData?.members || []) as Array<{ _id?: string; id?: string }>;
    const teamIdSet = new Set<string>(
      myTeamMembers.map((m) => String(m._id || m.id || ""))
    );
    if (sessionUserId) {
      teamIdSet.add(String(sessionUserId));
    }
    if (salesUserId) {
      teamIdSet.add(String(salesUserId));
    }
    return allUsers.filter((u) => teamIdSet.has(String(u._id || u.id || "")));
  }, [allUsers, sessionUser, sessionUserId, adminRole, elevatedRole, myTeamData, salesUserId]);

  // Modal internal editable states
  const [internalPlanDate, setInternalPlanDate] = useState<string>(
    () => ymdFromPlanDate(planDate) || new Date().toISOString().slice(0, 10)
  );
  const [internalSalesUserId, setInternalSalesUserId] = useState<string>(
    () => salesUserId || sessionUserId || ""
  );

  const effectiveSalesUserId = internalSalesUserId || sessionUserId || "";
  const { data: plansData, isFetching: isCheckingPlan } = useGetPlansQuery(
    {
      sales_user: effectiveSalesUserId,
      date: internalPlanDate,
      limit: 1,
    },
    { skip: !open || !internalPlanDate || !effectiveSalesUserId }
  );

  const existingPlan = useMemo(() => {
    const list = plansData?.data || [];
    return list.find((p) => !(p as any).deletedAt && !String(p._id || p.id).startsWith("standalone"));
  }, [plansData]);
  const planCompleted = existingPlan?.status === "completed";

  // Fetch custom task templates configured for this executive
  const { data: dbUserSettings } = useGetUserSettingsQuery(effectiveSalesUserId, {
    skip: !open || !effectiveSalesUserId,
  });
  const customTemplates = useMemo<CustomWorkTaskTemplate[]>(() => {
    if (dbUserSettings?.customWorkTemplates && Array.isArray(dbUserSettings.customWorkTemplates)) {
      return dbUserSettings.customWorkTemplates as CustomWorkTaskTemplate[];
    }
    if (effectiveSalesUserId) {
      return (getUserWorkPlannerSettings(effectiveSalesUserId).customWorkTemplates || []) as CustomWorkTaskTemplate[];
    }
    return [];
  }, [dbUserSettings, effectiveSalesUserId]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [managerRemarks, setManagerRemarks] = useState("");
  const [plannedStartTime, setPlannedStartTime] = useState("");
  const [plannedEndTime, setPlannedEndTime] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Only re-initialize when modal transitions from closed to open or when initial record changes
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && (!prevOpenRef.current || initial)) {
      setInternalPlanDate(ymdFromPlanDate(planDate) || new Date().toISOString().slice(0, 10));
      const targetSalesUser =
        (typeof initial?.sales_user === "object"
          ? (initial.sales_user as any)?._id || (initial.sales_user as any)?.id
          : typeof initial?.sales_user === "string"
          ? initial.sales_user
          : "") ||
        salesUserId ||
        sessionUserId ||
        "";
      setInternalSalesUserId(targetSalesUser);
      if (initial) {
        setTitle(initial.title || "");
        setDescription(initial.description || "");
        setManagerRemarks(initial.manager_remarks || "");
        setPlannedStartTime(timeFromIso(initial.planned_start_time));
        setPlannedEndTime(timeFromIso(initial.planned_end_time));
      } else {
        setTitle("");
        setDescription("");
        setManagerRemarks("");
        setPlannedStartTime("");
        setPlannedEndTime("");
      }
      setErrors({});
    }
    prevOpenRef.current = open;
  }, [open, initial, planDate, salesUserId, sessionUserId]);

  if (!open) return null;

  function handleSave() {
    if (planCompleted) return;
    const errs: Record<string, string> = {};
    if (!internalPlanDate) {
      errs.planDate = "Plan date is required";
    }
    if (!title.trim()) {
      errs.title = "Task title/description is required";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    onSubmit({
      planDate: internalPlanDate,
      salesUserId: internalSalesUserId || sessionUserId,
      title: title.trim(),
      description: description.trim() || undefined,
      manager_remarks: managerRemarks.trim() || undefined,
      planned_start_time: combinePlanDateAndTime(internalPlanDate, plannedStartTime),
      planned_end_time: combinePlanDateAndTime(internalPlanDate, plannedEndTime),
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="presentation"
      onClick={() => !isSaving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-lg max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between border-b border-border px-4 sm:px-5 py-3 sm:py-4 bg-surface-muted/30 shrink-0">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              {mode === "create" ? "Add Work Task" : "Edit Work Task"}
            </h2>
            <p className="text-[11px] sm:text-xs text-muted">
              {adminRole
                ? "Portal Admin — Assign task for any portal member"
                : managerRole
                ? "Portal Manager — Assign task for yourself or reporting team"
                : "Schedule your work task details"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 px-4 sm:px-5 py-3.5 sm:py-4">
          {/* Date & Executive Assignment Bar within Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-muted/60 rounded-xl border border-border">
            <div>
              <label className={labelClass}>
                <Calendar className="inline h-3.5 w-3.5 mr-1 text-primary" />
                Plan Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={internalPlanDate}
                onChange={(e) => setInternalPlanDate(e.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
              {errors.planDate && (
                <p className="mt-1 text-xs text-rose-500">{errors.planDate}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>
                <User className="inline h-3.5 w-3.5 mr-1 text-primary" />
                Assign Executive / Team Member <span className="text-rose-500">*</span>
              </label>
              {elevatedRole ? (
                <select
                  value={internalSalesUserId}
                  onChange={(e) => setInternalSalesUserId(e.target.value)}
                  disabled={isSaving}
                  className={inputClass}
                >
                  {allowedExecutives.map((exec) => (
                    <option key={exec._id || exec.id} value={exec._id || exec.id}>
                      {exec.name} {exec._id === sessionUserId ? "(Self)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground">
                  {sessionUser?.name || "Self"} (Executive)
                </div>
              )}
            </div>
          </div>

          {/* Work Plan Detection Banner */}
          {internalPlanDate && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                planCompleted
                  ? "border-rose-500/40 bg-rose-50/80 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300"
                  : existingPlan
                  ? "border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300"
                  : "border-border bg-surface-muted/40 text-muted"
              }`}
            >
              {isCheckingPlan ? (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Checking for work plan…</span>
                </div>
              ) : planCompleted ? (
                <>
                  <Info className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <div>
                    <span className="font-semibold text-rose-900 dark:text-rose-200">
                      Work plan completed:
                    </span>{" "}
                    The work plan for {formatPlanDate(internalPlanDate)} is completed. New tasks cannot be added to this day.
                  </div>
                </>
              ) : existingPlan ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                      Work Plan Found ({existingPlan.status || "planned"}):
                    </span>{" "}
                    This task will be automatically added to the work plan for{" "}
                    {formatPlanDate(internalPlanDate)}.
                  </div>
                </>
              ) : (
                <>
                  <Info className="h-4 w-4 shrink-0 text-muted" />
                  <div>
                    <span className="font-medium text-foreground">No work plan for this date:</span>{" "}
                    This task will be created as a standalone task.
                  </div>
                </>
              )}
            </div>
          )}

          {/* Quick-fill Custom Work Task Templates */}
          {customTemplates.length > 0 && mode === "create" && (
            <div className="space-y-1.5 p-3 rounded-xl border border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Quick Fill from Custom Task Templates ({customTemplates.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {customTemplates.map((tpl: CustomWorkTaskTemplate) => (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setTitle(tpl.title);
                      if (tpl.description) setDescription(tpl.description);
                      if (tpl.planned_start_time) setPlannedStartTime(tpl.planned_start_time);
                      if (tpl.planned_end_time) setPlannedEndTime(tpl.planned_end_time);
                      setErrors((prev) => ({ ...prev, title: "" }));
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary hover:bg-surface-muted transition cursor-pointer"
                  >
                    <Plus className="h-3 w-3 text-primary" />
                    <span>{tpl.title}</span>
                    {tpl.planned_start_time && (
                      <span className="text-[10px] text-muted">
                        ({tpl.planned_start_time}{tpl.planned_end_time ? `-${tpl.planned_end_time}` : ""})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>
              Task Title / Core Objective <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Quotation review, Client follow-up call, Product documentation..."
              disabled={isSaving}
              className={inputClass}
            />
            {errors.title && (
              <p className="mt-1 text-xs text-rose-500">{errors.title}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Task Description &amp; Details</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description, deliverables, or action points..."
              disabled={isSaving}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Planned Start Time</label>
              <input
                type="time"
                value={plannedStartTime}
                onChange={(e) => setPlannedStartTime(e.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Planned End Time</label>
              <input
                type="time"
                value={plannedEndTime}
                onChange={(e) => setPlannedEndTime(e.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 border-t border-border px-4 sm:px-5 py-3 sm:py-3.5 bg-surface-muted/30 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-full sm:w-auto rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-[0.98] transition cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isCheckingPlan || planCompleted}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover active:scale-[0.98] shadow-md transition cursor-pointer"
          >
            {isSaving ? "Saving…" : mode === "create" ? "Add Task" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkFormModal;
