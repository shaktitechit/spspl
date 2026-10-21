import type {
  AuthUser,
  WorkPlanExpenseRecord,
  WorkPlanTourAdvanceRecord,
} from "@/types/workPlanner";
import {
  isWpAdmin,
  isWpCoordinator,
  isWpElevated,
  isWpManager,
} from "@/utils/authStorage";

export interface ExpensePermissions {
  isExecutive: boolean;
  isCoordinator: boolean;
  isManager: boolean;
  isAdmin: boolean;
  isElevated: boolean;
  canViewOwnExpenses: boolean;
  canViewTeamExpenses: boolean;
  canViewGlobalExpenses: boolean;
  canCreateExpense: boolean;
  canRequestAdvance: boolean;
  canReviewSubordinates: boolean;
  canApproveClaims: boolean;
  canDisburseAdvance: boolean;
  canSettleClaims: boolean;
  canAcceptRefunds: boolean;
  canViewBalances: boolean;
  canViewPassbook: boolean;
  canDownloadReports: boolean;
}

export function getExpensePermissions(user: AuthUser | null | undefined): ExpensePermissions {
  const admin = isWpAdmin(user);
  const manager = isWpManager(user);
  const coordinator = isWpCoordinator(user);
  const elevated = isWpElevated(user);
  const executive = !elevated;

  return {
    isExecutive: executive,
    isCoordinator: coordinator,
    isManager: manager,
    isAdmin: admin,
    isElevated: elevated,
    canViewOwnExpenses: true,
    canViewTeamExpenses: elevated,
    canViewGlobalExpenses: admin,
    canCreateExpense: true,
    canRequestAdvance: true,
    canReviewSubordinates: elevated,
    canApproveClaims: manager || admin,
    canDisburseAdvance: manager || admin,
    canSettleClaims: manager || admin,
    canAcceptRefunds: manager || admin,
    canViewBalances: elevated,
    canViewPassbook: true,
    canDownloadReports: true,
  };
}

export function resolveExpenseOwnerId(expense: WorkPlanExpenseRecord): string {
  if (typeof expense.sales_user === "object" && expense.sales_user !== null) {
    return (expense.sales_user as any)._id || (expense.sales_user as any).id || "";
  }
  if (typeof expense.sales_user === "string" && expense.sales_user) {
    return expense.sales_user;
  }
  if (typeof expense.created_by === "object" && expense.created_by !== null) {
    return (expense.created_by as any)._id || "";
  }
  if (typeof expense.created_by === "string" && expense.created_by) {
    return expense.created_by;
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

/**
 * Segregation of duties / Maker-Checker predicate:
 * Non-admin users cannot approve, disburse, or settle their own claims/advances.
 * Work Planner Admins have full operational authority and can manage their own finances.
 */
export function isSelfAction(user: AuthUser | null | undefined, targetUserId: string): boolean {
  if (!user || !user._id || !targetUserId) return false;
  if (isWpAdmin(user)) return false; // Admin can manage their own finances
  return String(user._id) === String(targetUserId);
}

export function canApproveExpenseRecord(
  user: AuthUser | null | undefined,
  expense: WorkPlanExpenseRecord
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canApproveClaims) return false;
  const ownerId = resolveExpenseOwnerId(expense);
  if (isSelfAction(user, ownerId)) return false; // Maker-checker
  return expense.status === "submitted";
}

export function canRejectExpenseRecord(
  user: AuthUser | null | undefined,
  expense: WorkPlanExpenseRecord
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canApproveClaims) return false;
  const ownerId = resolveExpenseOwnerId(expense);
  if (isSelfAction(user, ownerId)) return false; // Maker-checker
  return expense.status === "submitted";
}

export function canApproveAdvanceRecord(
  user: AuthUser | null | undefined,
  advance: WorkPlanTourAdvanceRecord
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canApproveClaims) return false;
  const ownerId = resolveAdvanceOwnerId(advance);
  if (isSelfAction(user, ownerId)) return false; // Maker-checker
  return advance.status === "pending";
}

export function canRejectAdvanceRecord(
  user: AuthUser | null | undefined,
  advance: WorkPlanTourAdvanceRecord
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canApproveClaims) return false;
  const ownerId = resolveAdvanceOwnerId(advance);
  if (isSelfAction(user, ownerId)) return false; // Maker-checker
  return advance.status === "pending";
}

export function canDisburseAdvanceRecord(
  user: AuthUser | null | undefined,
  advance: WorkPlanTourAdvanceRecord
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canDisburseAdvance) return false;
  const ownerId = resolveAdvanceOwnerId(advance);
  if (isSelfAction(user, ownerId)) return false; // Maker-checker
  return advance.status === "approved";
}

export function canRefundAdvanceRecord(
  user: AuthUser | null | undefined,
  advance: WorkPlanTourAdvanceRecord
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canAcceptRefunds) return false;
  const ownerId = resolveAdvanceOwnerId(advance);
  if (isSelfAction(user, ownerId)) return false; // Maker-checker
  const rem = advance.remaining_balance ?? (advance.disbursed_amount ?? advance.amount);
  return (advance.status === "disbursed" || advance.status === "recovered") && rem > 0;
}

export function canSettleForUser(
  user: AuthUser | null | undefined,
  targetUserId: string
): boolean {
  const perms = getExpensePermissions(user);
  if (!perms.canSettleClaims) return false;
  if (isSelfAction(user, targetUserId)) return false; // Maker-checker
  return true;
}
