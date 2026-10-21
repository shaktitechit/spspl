/**
 * @fileoverview Utility functions for Quotations module.
 * @module components/portal/shared/quotations/quotationUtils
 */

export function formatCurrencyINR(amount: number): string {
  if (amount == null || isNaN(amount)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

import { isAdmin, isCoordinator, isManager, isExecutive, readSessionFromStorage } from "@/utils/authStorage";

/** Read-only quotation module access (list, detail, follow-ups, self-scoped reports). */
export function canViewQuotations(user?: any): boolean {
  return isAdmin(user) || isManager(user) || isCoordinator(user) || isExecutive(user);
}

export function canManageQuotations(
  user?: any
): boolean {
  return isAdmin(user) || isManager(user) || isCoordinator(user);
}

export function canConvertQuotation(
  user?: any
): boolean {
  if (!user) {
    const s = readSessionFromStorage();
    user = s?.user || null;
  }
  return isAdmin(user) || isManager(user) || isCoordinator(user);
}

export function canCreateQuotation(
  leadStatusOrUser?: string | { department?: string; role?: string } | null,
  leadStatus?: string
): boolean {
  if (typeof leadStatusOrUser === "string") {
    return leadStatusOrUser !== "lost";
  }
  if (!leadStatusOrUser) return false;
  if (!canManageQuotations(leadStatusOrUser)) return false;
  if (leadStatus && leadStatus === "lost") return false;
  return true;
}

export type QuotationUserRef = {
  _id?: string;
  email?: string;
  department?: string;
  name?: string;
  role?: string;
  roles?: Array<any>;
  phone?: string;
  designation?: string;
  portals?: Array<{ portal_code?: string; portal?: string; access_roles?: string[] }>;
  is_active?: boolean;
};

export type QuotationLike = {
  _id?: string;
  status?: string;
  approval_status?: string;
  signatory_user?: string | QuotationUserRef | null;
  signatory_email?: string;
  signatory_name?: string;
  signatory_phone?: string;
  signatory_designation?: string;
  sales_person_user?: string | QuotationUserRef | null;
  sales_person_email?: string;
  sales_person_name?: string;
  sales_person_phone?: string;
  sales_person_designation?: string;
};

import { getLeadManagerPortalRole } from "@/components/leads/leadUtils";

/**
 * Filter users who belong to the Sales/Lead Management department or have sales/coordinator/manager roles.
 */
export function isSalesDepartmentUser(user?: {
  _id?: string;
  name?: string;
  department?: string;
  role?: string;
  roles?: Array<any>;
  portals?: Array<{ portal_code?: string; portal?: string; access_roles?: string[] }>;
  is_active?: boolean;
} | null): boolean {
  if (!user || user.is_active === false) return false;

  const roleBadge = getLeadManagerPortalRole(user as any);
  if (roleBadge) return true;

  const dept = String(user.department || "").toLowerCase().trim();
  const role = String(user.role || "").toLowerCase().trim();

  const isSalesDept = dept === "sales" || dept.includes("sales") || dept.includes("lead");
  const isSalesRole =
    role === "sales" ||
    role.includes("sales") ||
    role.includes("coordinator") ||
    role.includes("lead") ||
    role === "sales_executive" ||
    role === "sales_manager" ||
    role === "sales_coordinator" ||
    role === "coordinator" ||
    role === "executive" ||
    role === "manager" ||
    role === "admin" ||
    role === "sales_rep" ||
    role === "sales_officer";

  const hasSalesInRoles =
    Array.isArray(user.roles) &&
    user.roles.some((r: any) => {
      const rName = typeof r === "string" ? r : r?.name || r?.code || "";
      const lower = String(rName).toLowerCase();
      return (
        lower.includes("sales") ||
        lower.includes("coordinator") ||
        lower.includes("lead") ||
        lower.includes("manager") ||
        lower.includes("executive") ||
        lower.includes("admin")
      );
    });

  const hasSalesPortal =
    Array.isArray(user.portals) &&
    user.portals.some((p) => {
      const code = String(p?.portal_code || (p as any)?.portal || "").toLowerCase();
      const roles = (p?.access_roles || []).map((r) => String(r).toLowerCase());
      return (
        code === "sales" ||
        code === "lead_manager" ||
        roles.some((r) => ["admin", "manager", "coordinator", "executive", "sales"].includes(r))
      );
    });

  return isSalesDept || isSalesRole || hasSalesInRoles || hasSalesPortal;
}

export function isStrictSignatory(
  user?: QuotationUserRef | null,
  quotation?: QuotationLike | null
): boolean {
  if (!user) {
    const s = readSessionFromStorage();
    user = s?.user || null;
  }
  if (!user || !quotation) return false;

  const userId = user._id || (user as any).id;
  const sigUserId =
    typeof quotation.signatory_user === "object" && quotation.signatory_user !== null
      ? quotation.signatory_user._id || (quotation.signatory_user as any).id
      : (quotation.signatory_user as string);

  if (sigUserId && userId && String(sigUserId) === String(userId)) {
    return true;
  }

  if (
    quotation.signatory_email &&
    user.email &&
    quotation.signatory_email.toLowerCase().trim() === user.email.toLowerCase().trim()
  ) {
    return true;
  }

  return false;
}

export function isAssignedSignatory(
  user?: QuotationUserRef | null,
  quotation?: QuotationLike | null
): boolean {
  if (!user) {
    const s = readSessionFromStorage();
    user = s?.user || null;
  }
  if (!user || !quotation) return false;

  // Admin can give approval to any quotation even if not listed as signatory
  if (isAdmin(user as any)) {
    return true;
  }

  return isStrictSignatory(user, quotation);
}

export function isQuotationApproved(quotation?: QuotationLike | null): boolean {
  if (!quotation) return false;
  return (
    quotation.approval_status === "approved" ||
    quotation.status === "approved" ||
    quotation.status === "sent" ||
    quotation.status === "accepted"
  );
}

export function canViewQuotationPdf(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  if (!quotation) return false;
  if (isAssignedSignatory(user, quotation)) return true;
  return isQuotationApproved(quotation);
}

export function canEmailQuotation(quotation?: QuotationLike | null): boolean {
  if (!quotation) return false;
  if (
    quotation.status === "converted" ||
    quotation.status === "accepted" ||
    quotation.status === "rejected" ||
    quotation.status === "expired" ||
    quotation.status === "draft" ||
    quotation.status === "pending_approval"
  ) {
    return false;
  }
  return isQuotationApproved(quotation);
}

export function canEditQuotation(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  if (!user || !quotation) return false;
  if (quotation.status === "converted") return false;
  return isAdmin(user as any) || isQuotationCreator(user, quotation);
}

export function isQuotationCreator(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  if (!user || !quotation) return false;
  if (!quotation.created_by) return true;

  const userId = user._id || (user as any).id;
  const creatorId =
    typeof quotation.created_by === "object" && quotation.created_by !== null
      ? quotation.created_by._id
      : (quotation.created_by as string);

  if (creatorId && userId && String(creatorId) === String(userId)) {
    return true;
  }

  const creatorEmail =
    typeof quotation.created_by === "object" && quotation.created_by !== null
      ? quotation.created_by.email
      : undefined;

  if (creatorEmail && user.email && creatorEmail.toLowerCase().trim() === user.email.toLowerCase().trim()) {
    return true;
  }

  return false;
}

export function isQuotationSalesRepresentative(
  user?: QuotationUserRef | null,
  quotation?: QuotationLike | null
): boolean {
  if (!user || !quotation) return false;
  const userId = user._id || (user as any).id;
  const sp = quotation.sales_person_user;
  const spId =
    sp && typeof sp === "object" ? sp._id || (sp as any).id : (sp as string | undefined);
  if (spId && userId && String(spId) === String(userId)) return true;
  if (
    quotation.sales_person_email &&
    user.email &&
    quotation.sales_person_email.toLowerCase().trim() === user.email.toLowerCase().trim()
  ) {
    return true;
  }
  return false;
}

export function isQuotationVisible(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  if (!quotation) return false;
  if (!user) return false;

  if (canManageQuotations(user as any)) {
    return true;
  }

  return (
    isQuotationCreator(user, quotation) ||
    isStrictSignatory(user, quotation) ||
    isQuotationSalesRepresentative(user, quotation)
  );
}

/** Mark accepted / on hold / resume — managers or anyone tied to the quote as creator or sales rep. */
export function canUpdateQuotationStatus(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  if (!user || !quotation) return false;
  return (
    canManageQuotations(user as any) ||
    isQuotationCreator(user, quotation) ||
    isQuotationSalesRepresentative(user, quotation)
  );
}

export function canSubmitForApproval(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  if (!user) {
    const s = readSessionFromStorage();
    user = s?.user || null;
  }
  if (!quotation) return false;
  if (quotation.status !== "draft") return false;
  return isQuotationCreator(user, quotation);
}

export function isDraftVisible(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  return isQuotationVisible(user, quotation);
}

export function isQuotationRosterVisible(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  if (!quotation) return false;
  if (!user) {
    const s = readSessionFromStorage();
    user = s?.user || null;
  }
  if (!user) return false;

  if (canManageQuotations(user as any)) {
    return true;
  }

  return (
    isQuotationCreator(user, quotation) ||
    isStrictSignatory(user, quotation) ||
    isQuotationSalesRepresentative(user, quotation)
  );
}

export function isQuotationExpired(
  quotation?: (QuotationLike & { valid_until?: string | Date }) | null
): boolean {
  if (!quotation) return false;
  if (quotation.status === "expired") return true;
  if (quotation.status === "converted" || quotation.status === "rejected") return false;
  if (!quotation.valid_until) return false;

  const validUntilDate = new Date(quotation.valid_until);
  if (isNaN(validUntilDate.getTime())) return false;

  const now = new Date();
  return validUntilDate.getTime() < now.getTime();
}

export function isQuotationExpiringSoon(
  quotation?: (QuotationLike & { valid_until?: string | Date }) | null,
  withinDays = 2
): boolean {
  if (!quotation) return false;
  if (isQuotationExpired(quotation)) return false;
  if (quotation.status === "converted" || quotation.status === "rejected" || quotation.status === "draft") return false;
  if (!quotation.valid_until) return false;

  const validUntilDate = new Date(quotation.valid_until);
  if (isNaN(validUntilDate.getTime())) return false;

  const now = new Date();
  const diffMs = validUntilDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays > 0 && diffDays <= withinDays;
}

export function getQuotationExpiryInfo(
  quotation?: (QuotationLike & { valid_until?: string | Date }) | null
): {
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number;
  label: string;
  badgeClass: string;
} {
  if (!quotation || !quotation.valid_until) {
    return {
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: 999,
      label: "No validity date",
      badgeClass: "",
    };
  }

  const validUntilDate = new Date(quotation.valid_until);
  if (isNaN(validUntilDate.getTime())) {
    return {
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: 999,
      label: "Invalid date",
      badgeClass: "",
    };
  }

  const now = new Date();
  const isExpired = quotation.status === "expired" || (validUntilDate.getTime() < now.getTime() && quotation.status !== "converted" && quotation.status !== "rejected");
  const diffMs = validUntilDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isExpiringSoon = !isExpired && quotation.status !== "converted" && quotation.status !== "rejected" && daysRemaining <= 2 && daysRemaining >= 0;

  if (isExpired) {
    return {
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining,
      label: "Expired",
      badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300/60",
    };
  }

  if (isExpiringSoon) {
    return {
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining,
      label: daysRemaining === 0 ? "Expires Today" : `Expires in ${daysRemaining}d`,
      badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60 animate-pulse",
    };
  }

  return {
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining,
    label: `Valid (${daysRemaining}d left)`,
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
}

