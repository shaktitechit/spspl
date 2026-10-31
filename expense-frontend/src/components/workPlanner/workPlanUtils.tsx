/**
 * @fileoverview Formatting and presentation utilities for Expense Portal.
 * @module components/workPlanner/workPlanUtils
 */
import React from "react";

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
  { key: "draft", label: "Draft" },
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
