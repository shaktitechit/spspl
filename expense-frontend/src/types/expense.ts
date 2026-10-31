/**
 * @fileoverview TypeScript definitions for Expense Portal domain.
 * @module types/expense
 */

export type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected";

export type ExpenseCategory =
  | "Travel"
  | "Accommodation"
  | "Food"
  | "Communication"
  | "Client Entertainment"
  | "Marketing"
  | "Office"
  | "Miscellaneous";

export type TravelSubCategory =
  | "Cab"
  | "Auto"
  | "Bus"
  | "Bike Ride"
  | "Private Bike"
  | "Train"
  | "Flight"
  | "Parking"
  | "Toll";

export type ExpensePaymentMode =
  | "Cash"
  | "UPI"
  | "Card"
  | "Bank Transfer"
  | "Company Card";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Travel",
  "Accommodation",
  "Food",
  "Communication",
  "Client Entertainment",
  "Marketing",
  "Office",
  "Miscellaneous",
];

export const TRAVEL_SUB_CATEGORIES: TravelSubCategory[] = [
  "Cab",
  "Auto",
  "Bus",
  "Bike Ride",
  "Private Bike",
  "Train",
  "Flight",
  "Parking",
  "Toll",
];

export const EXPENSE_PAYMENT_MODES: ExpensePaymentMode[] = [
  "Cash",
  "UPI",
  "Card",
  "Bank Transfer",
  "Company Card",
];

export interface ExpenseAttachment {
  _id?: string;
  id?: string;
  attachment_id?: string;
  original_name?: string;
  file_name?: string;
  filename?: string;
  name?: string;
  mime_type?: string;
  mime?: string;
  size?: number;
  url?: string;
  file_url?: string;
  [key: string]: any;
}

export interface UserSummary {
  _id: string;
  id?: string;
  name: string;
  email: string;
  department?: string;
  phone?: string;
  wp_role?: string;
  wp_roles?: string[];
}

export interface ExpenseRecord {
  _id?: string;
  id?: string;
  sales_user?: string | UserSummary;
  work_plan?: any;
  work_plan_visit?: any;
  expense_date: string;
  category: ExpenseCategory | string;
  sub_category?: string;
  amount: number;
  payment_mode: ExpensePaymentMode | string;
  vendor_name?: string;
  bill_number?: string;
  bill_date?: string;
  description?: string;
  receipt_attachment?: string | ExpenseAttachment;
  attachments?: (string | ExpenseAttachment)[];
  start_reading?: number;
  closing_reading?: number;
  total_km?: number;
  rate_per_km?: number;
  start_reading_image?: string | ExpenseAttachment;
  end_reading_image?: string | ExpenseAttachment;
  status: ExpenseStatus;
  approved_by?: string | UserSummary;
  approved_at?: string;
  rejection_reason?: string;
  manager_remarks?: string;
  settled_amount?: number;
  settlement_status?: "unsettled" | "partially_settled" | "settled";
  settlement_id?: any;
  attachment_details?: any[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export type TourAdvanceStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "disbursed"
  | "settled"
  | "recovered"
  | "refunded";

export interface TourAdvanceRecord {
  _id: string;
  id?: string;
  advance_number: string;
  sales_user: string | UserSummary;
  work_plan?: any;
  request_date: string;
  amount: number;
  purpose: string;
  notes?: string;
  status: TourAdvanceStatus;
  approved_by?: string | UserSummary;
  approved_at?: string;
  rejection_reason?: string;
  disbursed_amount?: number;
  remaining_balance?: number;
  settled_amount?: number;
  refunded_amount?: number;
  disbursed_by?: string | UserSummary;
  disbursed_at?: string;
  payment_method?: string;
  transaction_reference?: string;
  bank_name?: string;
  disbursement_notes?: string;
  attachments?: (string | ExpenseAttachment)[];
  refunded_at?: string;
  refunded_by?: string | UserSummary;
  refund_notes?: string;
  refund_reference?: string;
  attachment_details?: any[];
  disbursement_attachments?: any[];
  disbursement_attachment_details?: any[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface SettlementClaimItem {
  expense: string | ExpenseRecord;
  amount: number;
  category?: string;
  description?: string;
  expense_date?: string;
}

export interface SettlementAdvanceItem {
  advance: string | TourAdvanceRecord;
  deducted_amount: number;
  advance_number?: string;
}

export interface SettlementPaymentEntryItem {
  payment_entry: string | ExpenseSettlementRecord | any;
  deducted_amount: number;
  payment_number?: string;
}

export interface ExpenseSettlementRecord {
  _id: string;
  id?: string;
  settlement_number: string;
  sales_user: string | UserSummary;
  settlement_date: string;
  claims: SettlementClaimItem[];
  advances: SettlementAdvanceItem[];
  payment_entries?: SettlementPaymentEntryItem[];
  total_claim_amount: number;
  advance_deduction_amount: number;
  payment_entry_deduction_amount?: number;
  direct_payment_amount: number;
  remaining_balance?: number;
  settled_amount?: number;
  settlement_mode: "advance_deduction" | "direct_payment" | "split" | "payment_entry" | string;
  payment_method: string;
  transaction_reference?: string;
  bank_name?: string;
  settlement_notes?: string;
  attachments?: (string | ExpenseAttachment)[];
  attachment_details?: any[];
  settled_by: string | UserSummary;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface ExecutiveBalanceItem {
  sales_user: UserSummary;
  active_advance_balance: number;
  total_advances_disbursed: number;
  active_advances_count: number;
  active_advance_count?: number;
  unsettled_approved_claims: number;
  unsettled_approved_claims_amount?: number;
  unsettled_approved_count: number;
  unsettled_approved_claims_count?: number;
  total_settled_amount: number;
  total_settled_claims_amount?: number;
  net_balance: number;
  net_position?: number;
  position: string;
  position_status?: string;
  [key: string]: any;
}

export interface PassbookEntry {
  id?: string;
  _id?: string;
  date?: string;
  entry_type?: string;
  type?: string;
  category?: string;
  sub_category?: string;
  reference_number?: string;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  payment_method?: string;
  transaction_reference?: string;
  debit?: number;
  credit?: number;
  balance?: number;
  status?: string;
  running_balance?: number;
  [key: string]: any;
}

export type PassbookLedgerEntry = PassbookEntry;

export interface ExecutivePassbookData {
  user?: UserSummary | any;
  summary?: {
    total_entries?: number;
    current_running_balance?: number;
    position?: string;
    total_advances?: number;
    total_claims?: number;
    total_settled?: number;
    [key: string]: any;
  };
  entries?: PassbookEntry[];
  current_advance_balance?: number;
  current_claim_receivable?: number;
  current_net_position?: number;
  opening_balance?: number;
  closing_balance?: number;
  totals?: any;
  [key: string]: any;
}

export interface ExpenseKpiSummaryData {
  pending_approval_claims: number;
  pending_approval_amount: number;
  approved_unsettled_claims: number;
  approved_unsettled_amount: number;
  pending_advances_count: number;
  pending_advances_amount: number;
  approved_advances_count: number;
  approved_advances_amount: number;
  active_advances_count: number;
  active_advances_balance: number;
  total_disbursed_advances_amount: number;
  total_settled_claims_amount: number;
  net_financial_position?: number;
  position_type?: "company_payable" | "advance_receivable" | "settled";
  pending_approval?: { amount: number; count: number };
  approved_unsettled?: { amount: number; count: number };
  active_tour_advances?: { amount: number; count: number };
  [key: string]: any;
}

export interface WorkPlannerUserFinancialItem {
  _id: string;
  name: string;
  email: string;
  department: string;
  phone: string;
  wp_role: string;
  wp_roles: string[];
  metrics: {
    pending_approval_count: number;
    pending_approval_amount: number;
    approved_unsettled_count: number;
    approved_unsettled_amount: number;
    pending_advances_count: number;
    pending_advances_amount: number;
    approved_advances_count: number;
    approved_advances_amount: number;
    active_advances_count: number;
    active_advances_balance: number;
    total_disbursed_amount: number;
    total_settled_amount: number;
    net_balance: number;
    position_type: "company_payable" | "advance_receivable" | "settled";
  };
}

export interface UserPortalAccess {
  portal?: string | { _id: string; code: string; name: string };
  portal_code?: string;
  access_roles?: string[];
  roles?: string[];
}

export interface AuthUser {
  _id: string;
  id?: string;
  name: string;
  email: string;
  department?: string;
  role?: string;
  roles?: any[];
  role_codes?: string[];
  portals?: UserPortalAccess[];
  is_active?: boolean;
}

export type ThemeColor = "violet" | "indigo" | "blue" | "emerald" | "rose" | "amber";

export const THEME_COLORS: { name: ThemeColor; label: string }[] = [
  { name: "emerald", label: "Emerald" },
  { name: "violet", label: "Violet" },
  { name: "indigo", label: "Indigo" },
  { name: "blue", label: "Blue" },
  { name: "rose", label: "Rose" },
  { name: "amber", label: "Amber" },
];

export interface UserSession {
  user: AuthUser;
  token: string;
  refreshToken?: string;
  refreshExpiresAt?: number;
}

export const WORK_PLAN_EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
export const WORK_PLAN_TRAVEL_SUB_CATEGORIES = TRAVEL_SUB_CATEGORIES;
export const WORK_PLAN_EXPENSE_PAYMENT_MODES = EXPENSE_PAYMENT_MODES;

export type ExpenseAttachmentItem = ExpenseAttachment;

// Aliases for compatibility
export type WorkPlanExpenseRecord = ExpenseRecord;
export type WorkPlanTourAdvanceRecord = TourAdvanceRecord;
export type WorkPlanExpenseSettlementRecord = ExpenseSettlementRecord;
export type WorkPlanExpenseCategory = ExpenseCategory;
export type WorkPlanExpensePaymentMode = ExpensePaymentMode;
export type WorkPlanExpenseTravelSubCategory = TravelSubCategory;
export type WorkPlanVisitRecord = any;
export type WorkPlanExpenseAttachment = ExpenseAttachment;
export type SeniorRemarkFeedItem = any;
