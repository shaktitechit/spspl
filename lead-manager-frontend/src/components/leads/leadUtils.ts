/**
 * @fileoverview Lead Management utilities: badge formatters, labels, colors, and helpers.
 * @module components/portal/shared/leads/leadUtils
 */
import {
  type LeadPriority,
  type LeadStatus,
  type LeadFollowUpType,
} from "@/store/api";

export const LEAD_STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  new: {
    label: "New",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
  },
  assigned: {
    label: "Assigned",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800",
    dot: "bg-indigo-500",
  },
  follow_up: {
    label: "Follow Up",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  quotation: {
    label: "Quotation",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
    dot: "bg-purple-500",
  },
  won: {
    label: "Won",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  lost: {
    label: "Lost",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
    dot: "bg-rose-500",
  },
  converted: {
    label: "Converted",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-800",
    dot: "bg-teal-500",
  },
};

export const LEAD_PRIORITY_CONFIG: Record<
  LeadPriority,
  { label: string; bg: string; text: string; border: string }
> = {
  low: {
    label: "Low",
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
  },
  medium: {
    label: "Medium",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  high: {
    label: "High",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  urgent: {
    label: "Urgent",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
  },
};

export const FOLLOWUP_TYPE_CONFIG: Record<
  LeadFollowUpType,
  { label: string; icon: string }
> = {
  call: { label: "Phone Call", icon: "Phone" },
  meeting: { label: "Meeting", icon: "Users" },
  email: { label: "Email", icon: "Mail" },
  whatsapp: { label: "WhatsApp", icon: "MessageSquare" },
  visit: { label: "Site Visit", icon: "MapPin" },
  demo: { label: "Product Demo", icon: "Tv" },
  note: { label: "Team Note", icon: "StickyNote" },
  other: { label: "Other", icon: "HelpCircle" },
};

export function formatCurrencyINR(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatLeadDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatLeadDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function isFollowUpOverdue(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return target < startOfToday;
}

export function isFollowUpToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  const now = new Date();
  return (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  );
}

/**
 * Standard lifecycle transitions allowed for regular sales representatives.
 * Forward progression only: passing one stage disables previous stages.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["assigned", "follow_up", "quotation", "won", "lost", "converted"],
  assigned: ["new", "follow_up", "quotation", "won", "lost", "converted"],
  follow_up: ["assigned", "quotation", "won", "lost", "converted"],
  quotation: ["follow_up", "won", "lost", "converted"],
  won: ["converted"], // No lost option after won
  lost: ["new", "assigned", "follow_up", "quotation"], // Reopening/transitions require admin
  converted: [], // Terminal
};

export type AuthUserLike = {
  _id?: string;
  id?: string;
  department?: string;
  role?: string;
  permissionCodes?: string[];
} | null | undefined;

export const LEAD_ASSIGNABLE_DEPTS = ["sales", "admin", "finance"] as const;
export type LeadAssignableDept = (typeof LEAD_ASSIGNABLE_DEPTS)[number];

export function assignFieldForDept(
  _dept?: string
): "assigned_sales" | "assigned_admin" | "assigned_finance" | null {
  return null;
}

export type LeadAssigneeLike = {
  _id: string;
  name: string;
  email?: string;
  department?: string;
} | null | undefined;

export const LEAD_DEPARTMENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "sales", label: "Sales" },
  { value: "admin", label: "Admin" },
  { value: "finance", label: "Finance" },
  { value: "dispatch", label: "Dispatch" },
  { value: "account", label: "Account" },
  { value: "operations", label: "Operations" },
];

/** Compact label for list/detail: "John Doe" or "John Doe, Jane Smith" or "Unassigned" */
export function formatLeadAssignees(lead: {
  assigned_to?: LeadAssigneeLike;
  assigned_users?: LeadAssigneeLike[];
} | null | undefined): string {
  if (!lead) return "Unassigned";
  if (Array.isArray(lead.assigned_users) && lead.assigned_users.length > 0) {
    const names = lead.assigned_users.map((u) => u?.name).filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }
  if (lead.assigned_to?.name) return lead.assigned_to.name;
  return "Unassigned";
}

/** Returns true if user has a senior role on lead manager portal (admin, manager, coordinator) */
export function isSeniorLeadRole(user: AuthUserLike): boolean {
  if (!user) return false;
  return isAdmin(user as any) || isManager(user as any) || isCoordinator(user as any);
}

/** Returns true if the user is in the admin department */
export function isAdminDept(user: AuthUserLike): boolean {
  if (!user) return false;
  return user.department === "admin" || user.role === "admin";
}

/** Returns the normalized department string for the user */
export function getUserDepartment(user: AuthUserLike): string {
  return user?.department || user?.role || "sales";
}

/** Human-readable label for a department */
export function getDeptLabel(dept: string): string {
  switch (dept?.toLowerCase()) {
    case "sales": return "Sales";
    case "admin": return "Admin";
    case "finance": return "Finance";
    case "dispatch": return "Dispatch";
    case "account": return "Account";
    case "operations": return "Operations";
    default: return dept ? dept.charAt(0).toUpperCase() + dept.slice(1) : "Sales";
  }
}

/** Checks if user can assign to a given target department */
export function canAssignToDept(user: AuthUserLike, targetDept: string): boolean {
  if (!user) return false;
  if (isLeadAdmin(user)) return true;
  // Admin (and sales/finance) only their own dept; admin is further locked to self in UI
  return getUserDepartment(user) === targetDept;
}

/**
 * Checks if a user is assigned to / has access to the lead_manager portal.
 */
export function isUserInLeadManagerPortal(user: {
  _id?: string;
  name?: string;
  department?: string;
  role?: string;
  portals?: Array<{ portal_code?: string; portal?: string; access_roles?: string[] }>;
}): boolean {
  if (!user) return false;

  if (Array.isArray(user.portals) && user.portals.length > 0) {
    const portalAccess = user.portals.find(
      (p) => p && (p.portal_code === "lead_manager" || (p as any).portal === "lead_manager")
    );
    if (portalAccess && Array.isArray(portalAccess.access_roles)) {
      return portalAccess.access_roles.some((r) =>
        ["admin", "manager", "coordinator", "executive"].includes(String(r).toLowerCase())
      );
    }
  }

  const role = String(user.role || "").toLowerCase();
  if (role === "admin" || role === "manager" || role === "coordinator" || role === "executive") return true;

  return false;
}

/** Lead Manager portal user with `admin` in access_roles (always eligible as quotation signatory). */
export function isLeadManagerPortalAdminUser(user: {
  role?: string;
  portals?: Array<{ portal_code?: string; portal?: string; access_roles?: string[] }>;
}): boolean {
  if (!user) return false;
  if (Array.isArray(user.portals)) {
    const portalAccess = user.portals.find(
      (p) => p && (p.portal_code === "lead_manager" || (p as { portal?: string }).portal === "lead_manager")
    );
    if (portalAccess && Array.isArray(portalAccess.access_roles)) {
      return portalAccess.access_roles.some((r) => String(r).toLowerCase() === "admin");
    }
  }
  const mainRole = String(user.role || "").toLowerCase();
  return mainRole === "admin" || mainRole.includes("admin");
}

/** Returns the formatted portal role for a user on lead_manager portal. */
export function getLeadManagerPortalRole(user: {
  role?: string;
  portals?: Array<{ portal_code?: string; portal?: string; access_roles?: string[] }>;
}): string {
  if (!user) return "";
  if (Array.isArray(user.portals)) {
    const portalAccess = user.portals.find(
      (p) => p && (p.portal_code === "lead_manager" || (p as any).portal === "lead_manager" || p.portal_code === "sales" || (p as any).portal === "sales")
    );
    if (portalAccess && Array.isArray(portalAccess.access_roles)) {
      const roles = portalAccess.access_roles.map((r) => String(r).toLowerCase());
      if (roles.includes("admin")) return "Admin";
      if (roles.includes("manager")) return "Manager";
      if (roles.includes("coordinator")) return "Coordinator";
      if (roles.includes("executive")) return "Executive";
    }
  }
  const mainRole = String(user.role || "").toLowerCase();
  if (mainRole === "admin" || mainRole.includes("admin")) return "Admin";
  if (mainRole === "manager" || mainRole.includes("manager")) return "Manager";
  if (mainRole === "coordinator" || mainRole.includes("coordinator")) return "Coordinator";
  if (mainRole === "executive" || mainRole.includes("executive")) return "Executive";
  return "";
}

type SignatoryUserRow = {
  _id?: string;
  id?: string;
  name?: string;
  role?: string;
  portals?: Array<{ portal_code?: string; portal?: string; access_roles?: string[] }>;
};

/**
 * Signatory dropdown: all Lead Manager portal admins + managers/coordinators in the caller's team scope.
 */
export function buildQuotationSignatoryUsers<T extends SignatoryUserRow>(
  usersList: T[],
  options: {
    filterByTeam: (list: T[]) => T[];
    withSelfInList: (list: T[], self?: T | null) => T[];
    selfUser?: T | null;
  }
): T[] {
  const { filterByTeam, withSelfInList, selfUser } = options;

  const portalAdmins = usersList.filter(
    (u) => isLeadManagerPortalAdminUser(u) || getLeadManagerPortalRole(u) === "Admin"
  );
  const teamManagers = usersList.filter((u) => {
    const role = getLeadManagerPortalRole(u);
    return role === "Manager" || role === "Coordinator";
  });
  const scopedTeam = withSelfInList(filterByTeam(teamManagers), selfUser ?? undefined);

  const byId = new Map<string, T>();
  for (const u of portalAdmins) {
    const id = String(u._id ?? u.id ?? "");
    if (id) byId.set(id, u);
  }
  for (const u of scopedTeam) {
    const id = String(u._id ?? u.id ?? "");
    if (id) byId.set(id, u);
  }

  return Array.from(byId.values()).sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

/** Display name for follow-up owner: lead assignee, quotation sales rep, or creator. */
export function getFollowUpSalesRepName(fu: {
  lead?: { assigned_to?: { name?: string } | string | null } | string | null;
  quotation?: {
    sales_person_name?: string;
    sales_person_user?: { name?: string } | string | null;
  } | string | null;
  created_by?: { name?: string } | string | null;
}): string {
  const leadObj = typeof fu.lead === "object" && fu.lead !== null ? fu.lead : null;
  if (leadObj?.assigned_to && typeof leadObj.assigned_to === "object" && leadObj.assigned_to.name) {
    return leadObj.assigned_to.name;
  }
  const quoteObj = typeof fu.quotation === "object" && fu.quotation !== null ? fu.quotation : null;
  if (quoteObj?.sales_person_name?.trim()) {
    return quoteObj.sales_person_name.trim();
  }
  const sp = quoteObj?.sales_person_user;
  if (sp && typeof sp === "object" && sp.name) {
    return sp.name;
  }
  if (fu.created_by && typeof fu.created_by === "object" && fu.created_by.name) {
    return fu.created_by.name;
  }
  return "Unassigned";
}

/** Display name for designated follow-up assignee (lead assignee or quotation sales rep). */
export function getFollowUpAssigneeName(fu: {
  lead?: {
    assigned_to?: { name?: string } | string | null;
    assigned_users?: Array<{ name?: string }>;
  } | string | null;
  quotation?: {
    sales_person_name?: string;
    sales_person_user?: { name?: string } | string | null;
  } | string | null;
}): string {
  const leadObj = typeof fu.lead === "object" && fu.lead !== null ? fu.lead : null;
  if (leadObj?.assigned_to && typeof leadObj.assigned_to === "object" && leadObj.assigned_to.name) {
    return leadObj.assigned_to.name;
  }
  if (Array.isArray(leadObj?.assigned_users) && leadObj.assigned_users.length > 0 && leadObj.assigned_users[0]?.name) {
    return leadObj.assigned_users.map((u) => u.name).filter(Boolean).join(", ");
  }
  const quoteObj = typeof fu.quotation === "object" && fu.quotation !== null ? fu.quotation : null;
  if (quoteObj?.sales_person_name?.trim()) {
    return quoteObj.sales_person_name.trim();
  }
  const sp = quoteObj?.sales_person_user;
  if (sp && typeof sp === "object" && sp.name) {
    return sp.name;
  }
  return "Unassigned";
}

/** Display name for who created the follow-up or originating lead/quotation. */
export function getFollowUpCreatorName(fu: {
  created_by?: { name?: string } | string | null;
  lead?: { created_by?: { name?: string } | string | null } | string | null;
  quotation?: { created_by?: { name?: string } | string | null } | string | null;
}): string {
  if (fu.created_by && typeof fu.created_by === "object" && fu.created_by.name) {
    return fu.created_by.name;
  }
  const leadObj = typeof fu.lead === "object" && fu.lead !== null ? fu.lead : null;
  if (leadObj?.created_by && typeof leadObj.created_by === "object" && leadObj.created_by.name) {
    return leadObj.created_by.name;
  }
  const quoteObj = typeof fu.quotation === "object" && fu.quotation !== null ? fu.quotation : null;
  if (quoteObj?.created_by && typeof quoteObj.created_by === "object" && quoteObj.created_by.name) {
    return quoteObj.created_by.name;
  }
  return "System / Unknown";
}

import { isAdmin, isCoordinator, isManager, isExecutive } from "@/utils/authStorage";

/**
 * Checks if the user is an admin for lead management (strictly checks lead_manager portal admin role).
 */
export function isLeadAdmin(user: AuthUserLike, _portalHome: string = ""): boolean {
  void _portalHome;
  return isAdmin(user as any);
}

/**
 * Checks if the user has manager role on lead_manager portal.
 */
export function isLeadManagerRole(user: AuthUserLike, _portalHome: string = ""): boolean {
  void _portalHome;
  return isManager(user as any);
}

/**
 * Checks if the user has coordinator role on lead_manager portal.
 */
export function isLeadCoordinatorRole(user: AuthUserLike, _portalHome: string = ""): boolean {
  void _portalHome;
  return isCoordinator(user as any);
}

/**
 * Checks if the user has executive role on lead_manager portal.
 */
export function isLeadExecutiveRole(user: AuthUserLike, _portalHome: string = ""): boolean {
  void _portalHome;
  return isExecutive(user as any);
}

/**
 * Checks if user can convert leads to customer / submit order (Admin or Manager).
 */
export function canConvertLead(user: AuthUserLike, portalHome: string = ""): boolean {
  return isLeadAdmin(user, portalHome) || isLeadManagerRole(user, portalHome);
}

/**
 * Checks if user can assign / reassign leads to executives.
 */
export function canAssignLead(user: AuthUserLike, portalHome: string = ""): boolean {
  return (
    isLeadAdmin(user, portalHome) ||
    isLeadManagerRole(user, portalHome) ||
    isLeadCoordinatorRole(user, portalHome)
  );
}

/**
 * Checks if user can soft-delete or restore leads.
 */
export function canDeleteLead(user: AuthUserLike, portalHome: string = ""): boolean {
  return isLeadAdmin(user, portalHome);
}

/**
 * Checks if user can configure Lead Masters (Sources, Lost reasons).
 */
export function canManageLeadMasters(user: AuthUserLike, portalHome: string = ""): boolean {
  return isLeadAdmin(user, portalHome);
}

/**
 * Checks if follow-up scheduling is permissible for the given lead status.
 * Follow-up schedule is NOT available once a lead is Won, Lost, or Converted.
 */
export function canScheduleFollowUp(status: LeadStatus | string): boolean {
  return status !== "won" && status !== "lost" && status !== "converted";
}

/**
 * Checks if quotation creation is permissible for the given lead status.
 * Quotations cannot be created once a lead is Lost.
 */
export function canCreateQuotation(status: LeadStatus | string): boolean {
  return status !== "lost";
}

export function canViewQuotationsModule(user: AuthUserLike, _portalHome: string = ""): boolean {
  void _portalHome;
  return (
    isAdmin(user as any) ||
    isManager(user as any) ||
    isCoordinator(user as any) ||
    isExecutive(user as any)
  );
}

export function canManageQuotations(user: AuthUserLike, _portalHome: string = ""): boolean {
  void _portalHome;
  return isAdmin(user as any) || isManager(user as any) || isCoordinator(user as any);
}

/**
 * Both Lead Managers and Sales Executives can view lead estimated values and pricing.
 */
export function canViewLeadPricing(user: AuthUserLike, portalHome: string = ""): boolean {
  void user;
  void portalHome;
  return true;
}

export function leadLineValue(product?: { quantity?: number; target_price?: number } | null): number {
  return Math.max(0, Number(product?.quantity || 0) * Number(product?.target_price || 0));
}

export function leadEstimatedValue(lead?: {
  estimated_value?: number | null;
  products?: Array<{ quantity?: number; target_price?: number }> | null;
} | null): number {
  const direct = Number(lead?.estimated_value || 0);
  if (direct > 0) return direct;
  if (!Array.isArray(lead?.products) || lead.products.length === 0) return 0;
  return lead.products.reduce((sum, p) => sum + leadLineValue(p), 0);
}

const STAGE_ORDER: Record<string, number> = {
  new: 0,
  assigned: 1,
  follow_up: 2,
  quotation: 3,
  won: 4,
  converted: 5,
};

/**
 * Returns the list of selectable statuses.
 */
export function getSelectableStatuses(
  currentStatus: LeadStatus,
  isAdmin: boolean
): { status: LeadStatus; isAllowed: boolean }[] {
  const modalStatuses: LeadStatus[] = [
    "new",
    "assigned",
    "follow_up",
    "quotation",
    "won",
    "lost",
    "converted",
  ];

  const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  const currentIdx = STAGE_ORDER[currentStatus];

  return modalStatuses.map((st) => {
    if (st === currentStatus) {
      return { status: st, isAllowed: false }; // Current status already set
    }

    if (isAdmin) {
      // In admin override mode, don't allow 'lost' if already 'won' or 'converted'
      if ((currentStatus === "won" || currentStatus === "converted") && st === "lost") {
        return { status: st, isAllowed: false };
      }
      return { status: st, isAllowed: true };
    }

    // After won or converted, lost option is disallowed
    if ((currentStatus === "won" || currentStatus === "converted") && st === "lost") {
      return { status: st, isAllowed: false };
    }

    // Check if target is a previous/passed stage in the linear pipeline
    const targetIdx = STAGE_ORDER[st];
    if (currentIdx !== undefined && targetIdx !== undefined && targetIdx < currentIdx) {
      return { status: st, isAllowed: false };
    }

    // Check if transition is allowed
    const isAllowed = allowedNext.includes(st);

    return {
      status: st,
      isAllowed,
    };
  });
}

