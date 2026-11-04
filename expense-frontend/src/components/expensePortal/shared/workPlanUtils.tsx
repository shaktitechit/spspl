/**
 * @fileoverview Formatting and presentation utilities for Expense Portal.
 * @module components/workPlanner/workPlanUtils
 */
import React from "react";
import { Briefcase, MapPin, CheckSquare, Navigation } from "lucide-react";

export function formatCurrency(amount: number | string | null | undefined): string {
  const n = Number(amount);
  if (Number.isNaN(n) || n === 0) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatPlanDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  try {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateInput);
  }
}

export function formatDateTime(dateVal: unknown): string {
  if (!dateVal) return "—";
  const d = new Date(String(dateVal));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
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
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function salesUserLabel(user: any, executiveOptions?: Array<{ id: string; name: string }>): string {
  if (!user) return "Unassigned";

  // If user is a string (ID or name)
  if (typeof user === "string") {
    if (executiveOptions && Array.isArray(executiveOptions)) {
      const found = executiveOptions.find((o) => o.id === user);
      if (found) return found.name;
    }
    return user;
  }

  // If user is an object
  if (typeof user === "object") {
    if (user.name) return user.name;
    if (user.email) return user.email;
    if (user.sales_user) return salesUserLabel(user.sales_user, executiveOptions);
    if (user.work_plan) return salesUserLabel(user.work_plan.sales_user || user.work_plan, executiveOptions);
    const rawId = user._id || user.id;
    if (rawId) {
      const strId = String(rawId);
      if (executiveOptions && Array.isArray(executiveOptions)) {
        const found = executiveOptions.find((o) => o.id === strId);
        if (found) return found.name;
      }
      return strId;
    }
  }

  return "Unassigned";
}

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  Travel: "Travel & Transport",
  Accommodation: "Hotel & Lodging",
  Food: "Food & Daily Allowance",
  Communication: "Phone & Internet",
  "Client Entertainment": "Client Hospitality",
  Marketing: "Marketing & Promo",
  Office: "Stationery & Office",
  Miscellaneous: "Miscellaneous",
};

export function getExpenseCategoryLabel(cat: string): string {
  return EXPENSE_CATEGORY_LABELS[cat] || cat || "General";
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const WORK_PLAN_EXPENSE_STATUS_TABS = [
  { key: "all", label: "All Claims" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export function getStatusBadgeClasses(status: string): string {
  const s = String(status || "").toLowerCase();
  if (s === "approved" || s === "settled" || s === "completed") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
  }
  if (s === "submitted" || s === "pending") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
  }
  if (s === "rejected" || s === "cancelled") {
    return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
  }
  if (s === "disbursed") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
  }
  return "bg-surface-muted text-muted-foreground border border-border";
}

export function renderExpenseStatusBadge(status: string): React.ReactNode {
  const classes = getStatusBadgeClasses(status);
  const text = String(status || "").charAt(0).toUpperCase() + String(status || "").slice(1);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${classes}`}>
      {text}
    </span>
  );
}

export function formatWorkPlanTasksVisits(wp: any): string {
  if (!wp || typeof wp !== "object") return "";
  const planType = String(wp.plan_type || "");
  const visits = Number(wp.visit_count ?? 0);
  const tasks = Number(wp.work_count ?? wp.task_count ?? 0);

  if (planType === "Visits") {
    return `${visits} ${visits === 1 ? "visit" : "visits"}`;
  }
  if (planType === "Tasks & Visits") {
    return `${tasks} ${tasks === 1 ? "task" : "tasks"}, ${visits} ${visits === 1 ? "visit" : "visits"}`;
  }
  if (planType === "Tasks") {
    return `${tasks} ${tasks === 1 ? "task" : "tasks"}`;
  }

  // Other types (Work From Office, Work From Home, Leave)
  if (tasks > 0 && visits > 0) {
    return `${tasks} ${tasks === 1 ? "task" : "tasks"}, ${visits} ${visits === 1 ? "visit" : "visits"}`;
  }
  if (visits > 0) {
    return `${visits} ${visits === 1 ? "visit" : "visits"}`;
  }
  if (tasks > 0) {
    return `${tasks} ${tasks === 1 ? "task" : "tasks"}`;
  }
  return "";
}

export function formatWorkPlanLocation(wp: any): string {
  if (!wp || typeof wp !== "object") return "—";
  return (wp.location || "").trim() || "—";
}

export function formatWorkPlanSummaryText(wp: any): string {
  if (!wp || typeof wp !== "object") return "—";
  const planType = wp.plan_type || "Visits";
  const tasksVisits = formatWorkPlanTasksVisits(wp);
  const loc = (wp.location || "").trim();

  const parts: string[] = [planType];
  if (tasksVisits) {
    parts.push(`(${tasksVisits})`);
  }
  if (loc) {
    parts.push(`· ${loc}`);
  }
  return parts.join(" ");
}

export function renderWorkPlanBadge(wp: any): React.ReactNode {
  if (!wp || typeof wp !== "object") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted italic bg-surface-muted/50 border border-border/50">
        No Day Plan
      </span>
    );
  }

  const planType = wp.plan_type || "Visits";
  const visits = Number(wp.visit_count ?? 0);
  const tasks = Number(wp.work_count ?? wp.task_count ?? 0);
  const location = (wp.location || "").trim();

  let typeBadgeColor = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
  if (planType === "Visits") {
    typeBadgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
  } else if (planType === "Tasks & Visits") {
    typeBadgeColor = "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800";
  } else if (planType === "Leave") {
    typeBadgeColor = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
  }

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {/* Plan Type */}
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${typeBadgeColor}`}>
        <Briefcase className="h-3 w-3 shrink-0" />
        {planType}
      </span>

      {/* Visits */}
      {(planType === "Visits" || planType === "Tasks & Visits" || visits > 0) && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-muted text-foreground border border-border">
          <MapPin className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-bold">{visits}</span> {visits === 1 ? "visit" : "visits"}
        </span>
      )}

      {/* Tasks */}
      {(planType === "Tasks & Visits" || planType === "Tasks" || tasks > 0) && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-muted text-foreground border border-border">
          <CheckSquare className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-bold">{tasks}</span> {tasks === 1 ? "task" : "tasks"}
        </span>
      )}

      {/* Location */}
      {location ? (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-muted text-muted-foreground border border-border">
          <Navigation className="h-3 w-3 text-amber-500 shrink-0" />
          <span className="truncate max-w-[130px]">{location}</span>
        </span>
      ) : null}
    </div>
  );
}
