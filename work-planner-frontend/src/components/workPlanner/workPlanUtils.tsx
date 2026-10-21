import React from "react";
import type { WorkPlanStatus, WorkPlanVisitStatus } from "@/types/workPlanner";

export function formatLocalityCity(addressStr?: string): string {
  if (!addressStr || typeof addressStr !== "string") return "";
  const clean = addressStr.trim();
  if (!clean) return "";

  const parts = clean.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const filtered = parts.filter((p) => !/^\d{5,6}$/.test(p) && p.toLowerCase() !== "india");
    if (filtered.length >= 2) {
      return `${filtered[0]}, ${filtered[1]}`;
    }
    return filtered[0] || clean;
  }
  return clean;
}

export function getVisitLocationDisplay(
  address?: string | null,
  lat?: number | null,
  lng?: number | null
): string {
  if (address && typeof address === "string" && address.trim()) {
    const formatted = formatLocalityCity(address);
    if (formatted) return formatted;
  }
  if (typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng)) {
    return `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
  }
  return "Location Recorded";
}

export const WORK_PLAN_STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "planned", label: "Planned" },
  { id: "completed", label: "Completed" },
] as const;

export const WORK_PLAN_TYPE_TABS = [
  { id: "all", label: "All types" },
  { id: "Visits", label: "Visits" },
  { id: "Tasks & Visits", label: "Tasks & Visits" },
  { id: "Leave", label: "Leave" },
  { id: "Work From Home", label: "Work From Home" },
  { id: "Work From Office", label: "Work From Office" },
] as const;

export function stripHtml(html?: string | null): string {
  if (!html) return "";
  if (typeof html !== "string") return String(html);
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;

  const withNewlines = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n");

  const clean = withNewlines.replace(/<[^>]+>/g, "").trim();
  if (typeof document !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(clean, "text/html");
      return doc.documentElement.textContent || clean;
    } catch {
      // fallback
    }
  }
  return clean
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

export function planTypeOf(planType?: string | null): string {
  return (planType && String(planType).trim()) || "";
}

export function isVisitsPlan(planType?: string | null): boolean {
  const t = planTypeOf(planType);
  if (!t) return false;
  return t === "Visits" || t === "Field Visit" || t === "Tasks & Visits";
}

export function isWorkTaskPlan(planType?: string | null): boolean {
  const t = planTypeOf(planType);
  if (!t) return false;
  return t === "Work From Home" || t === "Work From Office" || t === "Tasks & Visits";
}

export function isBothTasksAndVisitsPlan(planType?: string | null): boolean {
  const t = planTypeOf(planType);
  if (!t) return false;
  return t === "Tasks & Visits";
}

export function isLeavePlan(planType?: string | null): boolean {
  const t = planTypeOf(planType);
  if (!t) return false;
  return t === "Leave";
}

export function isSunday(d?: Date | string | null): boolean {
  if (!d) return false;
  const target = typeof d === "string" ? new Date(d) : d;
  if (isNaN(target.getTime())) return false;
  return target.getDay() === 0;
}

export function planTypeShort(planType?: string | null): string {
  const t = planTypeOf(planType);
  if (t === "Work From Home") return "WFH";
  if (t === "Work From Office") return "WFO";
  if (t === "Tasks & Visits") return "Tasks & Visits";
  return t;
}

export function planActivityLabel(plan: {
  plan_type?: string | null;
  visit_count?: number;
  work_count?: number;
  visits?: unknown[];
  works?: unknown[];
}): string {
  const type = planTypeOf(plan.plan_type);
  if (type === "Leave") return "Leave";
  const vCount =
    Number(plan.visit_count) ||
    (Array.isArray(plan.visits) ? plan.visits.length : 0) ||
    0;
  const wCount =
    Number(plan.work_count) ||
    (Array.isArray(plan.works) ? plan.works.length : 0) ||
    0;
  if (type === "Tasks & Visits") {
    return `${vCount} visit${vCount === 1 ? "" : "s"}, ${wCount} task${wCount === 1 ? "" : "s"}`;
  }
  if (isWorkTaskPlan(type)) {
    return `${wCount} task${wCount === 1 ? "" : "s"}`;
  }
  if (isVisitsPlan(type)) {
    return `${vCount} visit${vCount === 1 ? "" : "s"}`;
  }
  if (vCount > 0 && wCount > 0) {
    return `${vCount} visit${vCount === 1 ? "" : "s"}, ${wCount} task${wCount === 1 ? "" : "s"}`;
  }
  if (wCount > 0) {
    return `${wCount} task${wCount === 1 ? "" : "s"}`;
  }
  return `${vCount} visit${vCount === 1 ? "" : "s"}`;
}

export const WORK_PLAN_EXPENSE_STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "submitted", label: "Pending Approval" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
] as const;

export function formatPlanDate(dateVal: unknown): string {
  if (!dateVal) return "—";
  const d = new Date(String(dateVal));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function isPlanDate3DaysExpired(_planDate?: string | Date | null): boolean {
  // 3-day expiry provision removed for tasks and visits
  return false;
}

export function formatDateTime(dateVal: unknown): string {
  if (!dateVal) return "—";
  const d = new Date(String(dateVal));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(dateVal: unknown): string {
  if (!dateVal) return "—";
  const d = new Date(String(dateVal));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(amountVal: unknown): string {
  const num = Number(amountVal) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num);
}

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  da: "Daily Allowance (DA)",
  stay: "Hotel & Lodging Stay",
  travel: "Field Travel & Transit",
  conveyance: "Local Conveyance",
  other: "Other Expense",
};

export function salesUserLabel(
  salesUser: string | { _id?: string; name?: string; email?: string } | undefined,
  lookup?: Array<{ id?: string; _id?: string; name?: string }> | Record<string, string>
): string {
  if (!salesUser) return "—";
  if (typeof salesUser === "object" && salesUser !== null) {
    if (salesUser.name && salesUser.name.trim()) return salesUser.name.trim();
    if (salesUser.email && salesUser.email.trim()) return salesUser.email.trim();
    const id = salesUser._id;
    if (id && lookup) {
      if (Array.isArray(lookup)) {
        const match = lookup.find((u) => (u.id || u._id) === id);
        if (match?.name) return match.name;
      } else if (lookup[id]) {
        return lookup[id];
      }
    }
    return salesUser._id || "—";
  }
  if (typeof salesUser === "string") {
    const trimmed = salesUser.trim();
    if (lookup) {
      if (Array.isArray(lookup)) {
        const match = lookup.find((u) => (u.id || u._id) === trimmed);
        if (match?.name) return match.name;
      } else if (lookup[trimmed]) {
        return lookup[trimmed];
      }
    }
    return trimmed;
  }
  return "—";
}

export function partyLabel(
  party: string | { _id?: string; party_name?: string } | undefined,
  fallbackName?: string,
): string {
  if (fallbackName && fallbackName.trim()) return fallbackName.trim();
  if (!party) return "—";
  if (typeof party === "string") return party;
  return party.party_name || party._id || "—";
}

export function visitPartyLabel(visit: {
  party?: string | { _id?: string; party_name?: string };
  party_name?: string;
  party_type?: string;
}): string {
  const name = partyLabel(visit.party, visit.party_name);
  if (visit.party_type === "new_party") return `${name} (New party)`;
  if (visit.party_type === "new_lead") return `${name} (New lead)`;
  return name;
}

export function planIdOf(row: { _id?: string; id?: string } | null | undefined): string {
  if (!row) return "";
  return String(row._id || row.id || "");
}

export function renderPlanStatusBadge(status: string | undefined) {
  const s = (status || "planned") as WorkPlanStatus;
  const map: Record<
    WorkPlanStatus,
    { wrap: string; dot: string; label: string }
  > = {
    draft: {
      wrap: "text-muted bg-surface-muted ring-border",
      dot: "bg-muted",
      label: "Draft",
    },
    planned: {
      wrap: "text-blue-500 bg-blue-500/10 ring-blue-500/20",
      dot: "bg-blue-500",
      label: "Planned",
    },
    submitted: {
      wrap: "text-primary bg-primary/10 ring-primary/20",
      dot: "bg-primary",
      label: "Pending Approval",
    },
    approved: {
      wrap: "text-emerald-500 bg-emerald-500/10 ring-emerald-500/20",
      dot: "bg-emerald-500",
      label: "Approved",
    },
    rejected: {
      wrap: "text-rose-500 bg-rose-500/10 ring-rose-500/20",
      dot: "bg-rose-500",
      label: "Rejected",
    },
    completed: {
      wrap: "text-emerald-500 bg-emerald-500/10 ring-emerald-500/20",
      dot: "bg-emerald-500",
      label: "Completed",
    },
  };
  const meta = map[s] || map.planned;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ring-1 ring-inset ${meta.wrap}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function renderExpenseStatusBadge(status: string | undefined) {
  const s = status || "draft";
  const map: Record<string, { wrap: string; label: string }> = {
    draft: {
      wrap: "bg-surface-muted text-muted ring-border",
      label: "Draft",
    },
    submitted: {
      wrap: "bg-primary/10 text-primary ring-primary/20",
      label: "Pending Approval",
    },
    approved: {
      wrap: "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20",
      label: "Approved",
    },
    rejected: {
      wrap: "bg-rose-500/10 text-rose-500 ring-rose-500/20",
      label: "Rejected",
    },
  };
  const meta = map[s] || map.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${meta.wrap}`}
    >
      {meta.label}
    </span>
  );
}

function isMongoId(val?: string | null): boolean {
  if (!val || typeof val !== "string") return false;
  return /^[0-9a-fA-F]{24}$/.test(val.trim());
}

export function formatAuditUser(
  user?: string | { _id?: string; name?: string; email?: string; role?: string } | null,
  roleField?: string,
): string {
  if (!user && !roleField) return "";
  let name = "";
  let role = roleField || "";

  if (isMongoId(role)) {
    role = "";
  }

  if (typeof user === "string") {
    if (!isMongoId(user)) {
      name = user;
    }
  } else if (user && typeof user === "object") {
    name = user.name || user.email || "";
    if (isMongoId(name)) name = "";
    if (!role && user.role && !isMongoId(user.role)) {
      role = user.role;
    }
  }

  if (!name && !role) return "";
  if (name && role) return `${name} (${role})`;
  return name || role;
}

export function isDayEndEligible(
  visits: Array<{ status?: string }> = [],
  works: Array<{ status?: string }> = [],
): boolean {
  const allowedStatuses = new Set(["pending", "in_progress", "completed"]);
  
  if (visits.length === 0 && works.length === 0) {
    return true;
  }

  const allVisitsEligible = visits.every((v) => v.status && allowedStatuses.has(v.status));
  const allWorksEligible = works.every((w) => w.status && allowedStatuses.has(w.status));

  return allVisitsEligible && allWorksEligible;
}

export function renderVisitStatusBadge(status: string | undefined) {
  const s = (status || "created") as WorkPlanVisitStatus;
  const labels: Record<WorkPlanVisitStatus, string> = {
    created: "Created",
    pending: "Pending",
    in_progress: "In Progress",
    checked_in: "Checked In",
    checked_out: "Checked Out",
    completed: "Completed",
    cancelled: "Cancelled",
    skipped: "Skipped",
    rescheduled: "Rescheduled",
  };
  const tones: Record<WorkPlanVisitStatus, string> = {
    created: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
    pending: "bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-slate-500/20",
    in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
    checked_in: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20",
    checked_out: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
    completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
    cancelled: "bg-rose-500/10 text-rose-500 ring-rose-500/20",
    skipped: "bg-surface-muted text-muted ring-border",
    rescheduled: "bg-purple-500/10 text-purple-500 ring-purple-500/20",
  };
  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ring-1 ring-inset ${tones[s] || tones.created}`}
    >
      {labels[s] || s}
    </span>
  );
}

export function renderWorkStatusBadge(status: string | undefined) {
  const s = status || "created";
  const map: Record<string, { wrap: string; label: string }> = {
    created: {
      wrap: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
      label: "Created",
    },
    pending: {
      wrap: "bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-slate-500/20",
      label: "Pending",
    },
    in_progress: {
      wrap: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
      label: "In Progress",
    },
    completed: {
      wrap: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
      label: "Completed",
    },
    cancelled: {
      wrap: "bg-rose-500/10 text-rose-500 ring-rose-500/20",
      label: "Cancelled",
    },
  };
  const meta = map[s] || map.created;
  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ring-1 ring-inset ${meta.wrap}`}
    >
      {meta.label}
    </span>
  );
}

export function canEditPlan(
  status: string | undefined,
  opts?: { isAdmin?: boolean },
): boolean {
  if (opts?.isAdmin) {
    return true;
  }
  const s = status || "planned";
  return s === "planned" || s === "draft" || s === "rejected";
}

export const EXPENSE_ADD_WINDOW_DAYS = 3;

export function canAddExpenseForPlanDate(
  planDate: unknown,
  now: Date = new Date(),
): boolean {
  if (!planDate) return false;
  const pDate = new Date(String(planDate));
  if (Number.isNaN(pDate.getTime())) return false;

  const pYear = pDate.getUTCFullYear();
  const pMonth = pDate.getUTCMonth();
  const pDay = pDate.getUTCDate();

  const nDate = new Date(now);
  const nYear = nDate.getFullYear();
  const nMonth = nDate.getMonth();
  const nDay = nDate.getDate();

  const start = new Date(Date.UTC(pYear, pMonth, pDay, 0, 0, 0, 0));
  const end = new Date(Date.UTC(pYear, pMonth, pDay + (EXPENSE_ADD_WINDOW_DAYS - 1), 23, 59, 59, 999));
  const current = new Date(Date.UTC(nYear, nMonth, nDay, 12, 0, 0, 0));

  return current.getTime() >= start.getTime() && current.getTime() <= end.getTime();
}

export function isWindowEnded(
  planDate: unknown,
  now: Date = new Date(),
): boolean {
  if (!planDate) return false;
  const pDate = new Date(String(planDate));
  if (Number.isNaN(pDate.getTime())) return false;

  const pYear = pDate.getUTCFullYear();
  const pMonth = pDate.getUTCMonth();
  const pDay = pDate.getUTCDate();

  const nDate = new Date(now);
  const nYear = nDate.getFullYear();
  const nMonth = nDate.getMonth();
  const nDay = nDate.getDate();

  const end = new Date(
    Date.UTC(pYear, pMonth, pDay + (EXPENSE_ADD_WINDOW_DAYS - 1), 23, 59, 59, 999)
  );
  const current = new Date(Date.UTC(nYear, nMonth, nDay, 12, 0, 0, 0));

  return current.getTime() > end.getTime();
}

const WINDOW_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "June",
  "July",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];

function formatWindowDate(d: Date): string {
  const day = d.getUTCDate();
  const month = WINDOW_MONTH_NAMES[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function planItemWindowHint(
  item: "Expenses" | "Visits" | "Tasks" | "Work plans",
  planDate: unknown,
  action: string = item === "Expenses" ? "added" : "completed"
): string {
  if (!planDate) {
    return `${item} can only be ${action} from the work plan day through the next 2 days (3 days total). Earlier or later entries are not allowed.`;
  }
  const pDate = new Date(String(planDate));
  if (Number.isNaN(pDate.getTime())) {
    return `${item} can only be ${action} from the work plan day through the next 2 days (3 days total). Earlier or later entries are not allowed.`;
  }
  const start = new Date(
    Date.UTC(pDate.getUTCFullYear(), pDate.getUTCMonth(), pDate.getUTCDate())
  );
  const end = new Date(
    Date.UTC(pDate.getUTCFullYear(), pDate.getUTCMonth(), pDate.getUTCDate() + 2)
  );

  return `${item} can only be ${action} from ${formatWindowDate(start)} through ${formatWindowDate(end)} (3 days total). Earlier or later entries are not allowed.`;
}

export function expenseAddWindowHint(planDate: unknown): string {
  return planItemWindowHint("Expenses", planDate, "added");
}

export function visitWindowHint(planDate: unknown): string {
  return planItemWindowHint("Visits", planDate, "completed");
}

export function taskWindowHint(planDate: unknown): string {
  return planItemWindowHint("Tasks", planDate, "completed");
}

export function workPlanWindowHint(planDate: unknown): string {
  return planItemWindowHint("Work plans", planDate, "completed");
}

export function formatDiscussionMethod(method?: string | null): string {
  if (!method) return "—";
  switch (method) {
    case "on_call":
      return "On Call";
    case "on_direct_meeting":
      return "Direct Meeting";
    case "on_email":
      return "On Email";
    case "other":
      return "Other";
    default:
      return method.replace(/_/g, " ");
  }
}
