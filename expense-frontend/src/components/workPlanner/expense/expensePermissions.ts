import type {
  AuthUser,
  WorkPlanExpenseRecord,
  WorkPlanTourAdvanceRecord,
} from "@/types/workPlanner";
import {
  isExpenseAdmin,
  isExpenseFinance,
  isSuperAdmin,
} from "@/utils/authStorage";

export interface ExpensePermissions {
  isAdmin: boolean;
  isFinance: boolean;
  canViewAllWorkPlannerUsers: boolean;
  canApproveClaims: boolean;
  canRejectClaims: boolean;
  canCreateAdvance: boolean;
  canApproveAdvances: boolean;
  canRejectAdvances: boolean;
  canDisburseAdvance: boolean;
  canRefundAdvance: boolean;
  canSettleClaims: boolean;
  canViewBalances: boolean;
  canViewPassbook: boolean;
  canDownloadReports: boolean;
  isElevated: boolean;
  isExecutive: boolean;
  canViewTeamExpenses: boolean;
  canViewGlobalExpenses: boolean;
}

export function getExpensePermissions(user: AuthUser | null | undefined): ExpensePermissions {
  const admin = isExpenseAdmin(user);
  const finance = isExpenseFinance(user);

  return {
    isAdmin: admin,
    isFinance: finance,
    canViewAllWorkPlannerUsers: admin || finance,
    canApproveClaims: admin,
    canRejectClaims: admin,
    canCreateAdvance: admin,
    canApproveAdvances: admin,
    canRejectAdvances: admin,
    canDisburseAdvance: finance,
    canRefundAdvance: finance,
    canSettleClaims: finance,
    canViewBalances: finance || admin,
    canViewPassbook: finance || admin,
    canDownloadReports: true,
    isElevated: admin || finance,
    isExecutive: false,
    canViewTeamExpenses: true,
    canViewGlobalExpenses: true,
  };
}

export function resolveExpenseOwnerId(expense: WorkPlanExpenseRecord): string {
  if (typeof expense.sales_user === "object" && expense.sales_user !== null) {
    return (expense.sales_user as any)._id || (expense.sales_user as any).id || "";
  }
  if (typeof expense.sales_user === "string" && expense.sales_user) {
    return expense.sales_user;
  }
  if (typeof (expense as any).work_plan === "object" && (expense as any).work_plan !== null) {
    const wpUser = (expense as any).work_plan.sales_user;
    if (typeof wpUser === "object" && wpUser !== null) {
      return wpUser._id || wpUser.id || "";
    }
    if (typeof wpUser === "string" && wpUser) {
      return wpUser;
    }
  }
  return "";
}

export function resolveAdvanceOwnerId(advance: WorkPlanTourAdvanceRecord): string {
  if (typeof advance.sales_user === "object" && advance.sales_user !== null) {
    return (advance.sales_user as any)._id || (advance.sales_user as any).id || "";
  }
  if (typeof advance.sales_user === "string" && advance.sales_user) {
    return advance.sales_user;
  }
  return "";
}

export function isSelfAction(user: AuthUser | null | undefined, targetUserId: string): boolean {
  if (!user || !user._id || !targetUserId) return false;
  if (isSuperAdmin(user)) return false;
  return String(user._id) === String(targetUserId);
}

export function canApproveExpenseRecord(
  user: AuthUser | null | undefined,
  expense: WorkPlanExpenseRecord
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canApproveClaims) return false;
  if (expense.status !== "submitted") return false;
  const ownerId = resolveExpenseOwnerId(expense);
  if (isSelfAction(user, ownerId)) return false;
  return true;
}

export function canRejectExpenseRecord(
  user: AuthUser | null | undefined,
  expense: WorkPlanExpenseRecord
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canRejectClaims) return false;
  if (expense.status !== "submitted") return false;
  const ownerId = resolveExpenseOwnerId(expense);
  if (isSelfAction(user, ownerId)) return false;
  return true;
}

export function canApproveAdvanceRecord(
  user: AuthUser | null | undefined,
  advance: WorkPlanTourAdvanceRecord
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canApproveAdvances) return false;
  if (advance.status !== "pending") return false;
  const ownerId = resolveAdvanceOwnerId(advance);
  if (isSelfAction(user, ownerId)) return false;
  return true;
}

export function canRejectAdvanceRecord(
  user: AuthUser | null | undefined,
  advance: WorkPlanTourAdvanceRecord
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canRejectAdvances) return false;
  if (advance.status !== "pending") return false;
  const ownerId = resolveAdvanceOwnerId(advance);
  if (isSelfAction(user, ownerId)) return false;
  return true;
}

export function canRefundAdvanceRecord(
  user: AuthUser | null | undefined,
  advance: WorkPlanTourAdvanceRecord
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canRefundAdvance) return false;
  if (advance.status !== "disbursed") return false;
  return true;
}

export function canDisburseAdvanceRecord(
  user: AuthUser | null | undefined,
  advance: WorkPlanTourAdvanceRecord
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canDisburseAdvance) return false;
  if (advance.status !== "approved") return false;
  const ownerId = resolveAdvanceOwnerId(advance);
  if (isSelfAction(user, ownerId)) return false;
  return true;
}

export function canSettleExpenseClaim(
  user: AuthUser | null | undefined,
  expense: WorkPlanExpenseRecord
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canSettleClaims) return false;
  if (expense.status !== "approved") return false;
  if (expense.settlement_status === "settled") return false;
  return true;
}

export function canSettleForUser(
  user: AuthUser | null | undefined,
  targetUserId?: string
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canSettleClaims) return false;
  if (targetUserId && isSelfAction(user, targetUserId)) return false;
  return true;
}
