"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Mail,
  Loader2,
  RotateCcw,
  Save,
  CalendarDays,
  MessageSquareText,
  Clock,
  Receipt,
  LifeBuoy,
  ShieldCheck,
  Check,
  AlertCircle,
  Filter,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetMyEmailPreferencesQuery,
  useUpdateMyEmailPreferencesMutation,
  useResetMyEmailPreferencesMutation,
} from "@/store/api/workPlannerApiSlice";
import { isWpAdmin, isWpManager, isWpCoordinator, isExecutive, roleLabel } from "@/utils/authStorage";
import type { AuthUser, UserEmailPreferences } from "@/types/workPlanner";

type TargetRole = "executive" | "manager" | "all";

interface PreferenceItem {
  key: keyof Omit<UserEmailPreferences, "user" | "updatedAt" | "master_email_enabled">;
  label: string;
  description: string;
  targetRole: TargetRole;
  scopeBadge: string;
}

interface PreferenceGroup {
  id: string;
  title: string;
  description: string;
  icon: typeof CalendarDays;
  items: PreferenceItem[];
}

const ALL_PREFERENCE_GROUPS: PreferenceGroup[] = [
  {
    id: "work_plan",
    title: "Work Plan Lifecycle & Approvals",
    description: "Daily planning submissions, completions, approval notices, and revision requests",
    icon: CalendarDays,
    items: [
      {
        key: "work_plan_created",
        label: "Team Member Work Plan Submitted",
        description: "Receive email when an executive submits a new daily work plan for your review",
        targetRole: "manager",
        scopeBadge: "Manager / Coordinator",
      },
      {
        key: "work_plan_completed",
        label: "Team Member Day End Report Submitted",
        description: "Receive email when an executive submits their completed visits and day-end report",
        targetRole: "manager",
        scopeBadge: "Manager / Coordinator",
      },
      {
        key: "work_plan_approved",
        label: "My Work Plan Approved",
        description: "Receive confirmation email when your reporting manager approves your daily work plan",
        targetRole: "executive",
        scopeBadge: "Executive / Submitter",
      },
      {
        key: "work_plan_rejected",
        label: "My Work Plan Returned / Revision Needed",
        description: "Receive alert with manager feedback when your work plan is rejected or needs changes",
        targetRole: "executive",
        scopeBadge: "Executive / Submitter",
      },
    ],
  },
  {
    id: "directives",
    title: "Directives, Remarks & Follow-ups",
    description: "Authority directives on visits, tasks, and junior follow-up replies",
    icon: MessageSquareText,
    items: [
      {
        key: "directive_assigned",
        label: "New Authority Directive / Instruction",
        description: "Receive email when a senior authority or manager assigns instructions on your plan",
        targetRole: "executive",
        scopeBadge: "Executive / Submitter",
      },
      {
        key: "directive_resolved",
        label: "Directive Response & Resolution",
        description: "Receive email when a team member responds to or resolves an authority directive",
        targetRole: "all",
        scopeBadge: "All Collaborators",
      },
    ],
  },
  {
    id: "reminders",
    title: "Scheduled Reminders & Daily Digests",
    description: "Automated morning attendance reminders, evening day-end digests, and scratchpad alerts",
    icon: Clock,
    items: [
      {
        key: "morning_plan_reminder",
        label: "11:30 AM Morning Plan Reminder",
        description: "Reminder sent if you have not submitted your planned visits and tasks for today",
        targetRole: "executive",
        scopeBadge: "Executive / Submitter",
      },
      {
        key: "morning_manager_digest",
        label: "11:30 AM Morning Team Digest",
        description: "Daily summary sent to managers listing team members who haven't planned their work for today",
        targetRole: "manager",
        scopeBadge: "Manager / Admin",
      },
      {
        key: "evening_day_end_reminder",
        label: "6:30 PM Evening Day End Reminder",
        description: "Reminder sent if your daily visits/tasks are incomplete before day end",
        targetRole: "executive",
        scopeBadge: "Executive / Submitter",
      },
      {
        key: "evening_manager_digest",
        label: "6:30 PM Evening Team Day End Digest",
        description: "Daily summary sent to managers listing team members with pending day-end reports",
        targetRole: "manager",
        scopeBadge: "Manager / Admin",
      },
      {
        key: "personal_note_reminder",
        label: "Personal Scratchpad & Note Reminders",
        description: "Scheduled time-based reminder emails for notes created in your private scratchpad",
        targetRole: "all",
        scopeBadge: "All Users",
      },
    ],
  },
  {
    id: "expenses",
    title: "Expenses, Travel Advances & Settlements",
    description: "Claim submissions, tour travel advances, disbursements, and settlement vouchers",
    icon: Receipt,
    items: [
      {
        key: "expense_submitted",
        label: "Team Member Expense Claims Logged",
        description: "Notification sent to managers when a team member logs daily expense claims for approval",
        targetRole: "manager",
        scopeBadge: "Manager / Admin",
      },
      {
        key: "expense_status_update",
        label: "My Expense Claim Approval / Rejection",
        description: "Receive status updates when your submitted expense claims are approved or rejected",
        targetRole: "executive",
        scopeBadge: "Executive / Submitter",
      },
      {
        key: "tour_advance_requested",
        label: "Team Member Tour Advance Requested",
        description: "Notification sent to managers when a team member requests a tour advance",
        targetRole: "manager",
        scopeBadge: "Manager / Admin",
      },
      {
        key: "tour_advance_status",
        label: "My Tour Advance Approval / Rejection",
        description: "Receive status notice when your tour advance request is approved or rejected",
        targetRole: "executive",
        scopeBadge: "Executive / Submitter",
      },
      {
        key: "tour_advance_disbursed",
        label: "Advance Funds Disbursed & Credits",
        description: "Receipt notice when funds are credited to you or unused balance is refunded",
        targetRole: "executive",
        scopeBadge: "Executive / Submitter",
      },
      {
        key: "expense_settlement",
        label: "Tour Expense Settlement Vouchers",
        description: "Final settlement breakdown and adjustments against outstanding tour advances",
        targetRole: "executive",
        scopeBadge: "Executive / Submitter",
      },
    ],
  },
  {
    id: "help_desk",
    title: "Help Desk & Support Tickets",
    description: "Collaborative problem-solving, tags, replies, and solution deliverables",
    icon: LifeBuoy,
    items: [
      {
        key: "help_ticket_tagged",
        label: "Tagged in a Help Request",
        description: "Receive email when a team member tags you to assist with a ticket or requirement",
        targetRole: "all",
        scopeBadge: "All Users",
      },
      {
        key: "help_ticket_reply",
        label: "Discussion Replies & Comments",
        description: "Receive notification when someone replies on a ticket thread you are part of",
        targetRole: "all",
        scopeBadge: "All Users",
      },
      {
        key: "help_ticket_solution",
        label: "Proposed Solution Deliverables",
        description: "Alert when a collaborator proposes a solution for your ticket verification",
        targetRole: "all",
        scopeBadge: "All Users",
      },
      {
        key: "help_ticket_status",
        label: "Ticket Resolved / Reopened",
        description: "Updates when a help ticket is officially verified & closed or reopened for changes",
        targetRole: "all",
        scopeBadge: "All Users",
      },
    ],
  },
];

export function EmailPreferencesPanel({ user }: { user?: AuthUser | null }) {
  const { data: serverPreferences, isLoading } = useGetMyEmailPreferencesQuery();
  const [updatePreferences, { isLoading: isUpdating }] = useUpdateMyEmailPreferencesMutation();
  const [resetPreferences, { isLoading: isResetting }] = useResetMyEmailPreferencesMutation();

  const [formData, setFormData] = useState<UserEmailPreferences | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Role detection
  const isAdmin = isWpAdmin(user);
  const isMgr = isWpManager(user) || isWpCoordinator(user);
  const isExec = isExecutive(user) || (!isAdmin && !isMgr);
  const currentRoleName = roleLabel(user);

  // Filter mode: By default, tailor by role unless Admin/Manager toggles "Show All"
  const [showAllOptions, setShowAllOptions] = useState<boolean>(isAdmin);

  useEffect(() => {
    if (serverPreferences) {
      setFormData(serverPreferences);
      setHasChanges(false);
    }
  }, [serverPreferences]);

  // Filter preference groups based on role scope
  const visibleGroups = useMemo(() => {
    return ALL_PREFERENCE_GROUPS.map((group) => {
      const filteredItems = group.items.filter((item) => {
        if (showAllOptions || isAdmin) return true;
        if (item.targetRole === "all") return true;
        if (isMgr && (item.targetRole === "manager" || item.targetRole === "executive")) return true;
        if (isExec && item.targetRole === "executive") return true;
        return false;
      });

      return {
        ...group,
        items: filteredItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [showAllOptions, isAdmin, isMgr, isExec]);

  function handleToggle(key: keyof UserEmailPreferences) {
    if (!formData) return;
    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: !prev[key],
      };
    });
    setHasChanges(true);
  }

  function handleSetAll(enable: boolean) {
    if (!formData) return;
    setFormData((prev) => {
      if (!prev) return prev;
      const next = { ...prev, master_email_enabled: enable };
      visibleGroups.forEach((group) => {
        group.items.forEach((item) => {
          (next as any)[item.key] = enable;
        });
      });
      return next;
    });
    setHasChanges(true);
  }

  function handleGroupSetAll(group: PreferenceGroup, enable: boolean) {
    if (!formData) return;
    setFormData((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      group.items.forEach((item) => {
        (next as any)[item.key] = enable;
      });
      return next;
    });
    setHasChanges(true);
  }

  async function handleSave() {
    if (!formData) return;
    try {
      await updatePreferences(formData).unwrap();
      toast.success("Email notification preferences saved successfully");
      setHasChanges(false);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string }; message?: string })?.data?.message ||
        (err as { message?: string })?.message ||
        "Failed to save preferences";
      toast.error(msg);
    }
  }

  async function handleReset() {
    try {
      const result = await resetPreferences().unwrap();
      setFormData(result);
      setHasChanges(false);
      toast.success("Email preferences reset to defaults (All Enabled)");
    } catch (err: unknown) {
      toast.error("Failed to reset email preferences");
    }
  }

  if (isLoading || !formData) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-16 text-muted gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-semibold">Loading email preferences…</p>
      </div>
    );
  }

  const isMasterEnabled = formData.master_email_enabled !== false;

  return (
    <div className="space-y-6 max-w-4xl font-sans">
      {/* ── Top Bar / Master Switch Card ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition ${
                isMasterEnabled
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-surface-muted text-muted border border-border"
              }`}
            >
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-foreground">Email Notification Center</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wide border border-primary/20">
                  <UserCheck className="h-3 w-3" />
                  {currentRoleName} Scope
                </span>
                {isMasterEnabled ? (
                  <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide">
                    Active
                  </span>
                ) : (
                  <span className="rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide">
                    Paused
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                {isExec
                  ? "Configured for your field sales & executive responsibilities. Only notifications relevant to your role are displayed."
                  : isMgr
                  ? "Configured for your managerial & supervisory responsibilities across team submissions and digests."
                  : "Full administrative notification scope across all OPMS portals and automated services."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <button
              type="button"
              onClick={() => handleToggle("master_email_enabled")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                isMasterEnabled ? "bg-primary" : "bg-surface-muted border-border"
              }`}
              role="switch"
              aria-checked={isMasterEnabled}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isMasterEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-xs font-bold text-foreground">
              {isMasterEnabled ? "Emails Enabled" : "Master Paused"}
            </span>
          </div>
        </div>

        {!isMasterEnabled ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 flex items-center gap-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              <strong>Master switch is paused:</strong> You will not receive any operational or reminder emails until you re-enable the master toggle above. (Security OTPs remain active).
            </span>
          </div>
        ) : null}

        {/* Global Quick Action & Role Filter Strip */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted font-semibold text-[11px] uppercase tracking-wider">Quick Actions:</span>
            <button
              type="button"
              onClick={() => handleSetAll(true)}
              className="px-2.5 py-1 rounded-lg bg-surface-muted hover:bg-surface-muted/80 text-foreground font-semibold text-[11px] transition border border-border"
            >
              Check All
            </button>
            <button
              type="button"
              onClick={() => handleSetAll(false)}
              className="px-2.5 py-1 rounded-lg bg-surface-muted hover:bg-surface-muted/80 text-foreground font-semibold text-[11px] transition border border-border"
            >
              Uncheck All
            </button>

            {/* Elevated Scope Filter Toggle for Managers / Admins */}
            {(isMgr || isAdmin) ? (
              <button
                type="button"
                onClick={() => setShowAllOptions(!showAllOptions)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                  showAllOptions
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-surface-muted text-muted hover:text-foreground border-border"
                }`}
              >
                <Filter className="h-3 w-3" />
                {showAllOptions ? "Showing All Roles" : "Role Scope: Tailored"}
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={isResetting || isUpdating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-surface-muted text-muted hover:text-foreground font-semibold text-xs transition"
            >
              {isResetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isUpdating || isResetting}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-xs transition shadow-sm ${
                hasChanges
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-surface-muted text-muted cursor-not-allowed border border-border"
              }`}
            >
              {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Preferences
            </button>
          </div>
        </div>
      </div>

      {/* ── Categorized Checkbox Sections ── */}
      <div className="space-y-5">
        {visibleGroups.map((group) => {
          const Icon = group.icon;
          const allGroupChecked = group.items.every((item) => formData[item.key] !== false);
          const noneGroupChecked = group.items.every((item) => formData[item.key] === false);

          return (
            <div
              key={group.id}
              className={`rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm transition ${
                !isMasterEnabled ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3.5 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{group.title}</h3>
                    <p className="text-[11px] text-muted">{group.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleGroupSetAll(group, true)}
                    disabled={allGroupChecked}
                    className="text-[10px] font-bold text-primary hover:underline px-1.5 py-0.5 disabled:opacity-40"
                  >
                    Select All
                  </button>
                  <span className="text-muted text-[10px]">•</span>
                  <button
                    type="button"
                    onClick={() => handleGroupSetAll(group, false)}
                    disabled={noneGroupChecked}
                    className="text-[10px] font-bold text-muted hover:text-foreground px-1.5 py-0.5 disabled:opacity-40"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map((item) => {
                  const isChecked = formData[item.key] !== false && isMasterEnabled;

                  return (
                    <label
                      key={item.key}
                      onClick={() => handleToggle(item.key)}
                      className={`relative flex items-start gap-3 p-3.5 rounded-xl border transition cursor-pointer select-none ${
                        isChecked
                          ? "border-primary/30 bg-primary/5 shadow-xs"
                          : "border-border bg-surface-muted/30 hover:bg-surface-muted/60"
                      }`}
                    >
                      <div className="pt-0.5 shrink-0">
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                            isChecked
                              ? "bg-primary border-primary text-primary-foreground shadow-xs"
                              : "border-border bg-card"
                          }`}
                        >
                          {isChecked ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
                        </div>
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <p
                            className={`text-xs font-bold leading-tight truncate ${
                              isChecked ? "text-foreground" : "text-muted"
                            }`}
                          >
                            {item.label}
                          </p>
                          {showAllOptions || isAdmin ? (
                            <span className="rounded-md bg-surface-muted border border-border px-1.5 py-0.5 text-[9px] font-mono font-semibold text-muted shrink-0">
                              {item.scopeBadge}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-muted leading-normal line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ── Mandatory Account & Security Box ── */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-border pb-3.5 mb-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Mandatory Security & Account Emails</h3>
              <p className="text-[11px] text-muted">Required system notices that are always delivered for compliance & safety</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-border bg-surface-muted/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Password Reset & Security OTPs</span>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 uppercase">
                  Always On
                </span>
              </div>
              <p className="text-[11px] text-muted">Verification codes, one-time passwords, and password recovery links.</p>
            </div>

            <div className="p-3 rounded-xl border border-border bg-surface-muted/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Account Welcome & Credential Invites</span>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 uppercase">
                  Always On
                </span>
              </div>
              <p className="text-[11px] text-muted">Initial onboarding email with temporary login access credentials.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Save Floating Bar if changes exist ── */}
      {hasChanges ? (
        <div className="sticky bottom-6 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-md p-4 shadow-lg flex items-center justify-between gap-4 z-20">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-bold text-foreground">You have unsaved email preference changes.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (serverPreferences) {
                  setFormData(serverPreferences);
                  setHasChanges(false);
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-border bg-surface-muted hover:bg-surface-muted/80 text-foreground font-semibold text-xs transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isUpdating}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition shadow-sm"
            >
              {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Changes
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
