export type WorkPlanStatus =
  | "draft"
  | "planned"
  | "submitted"
  | "approved"
  | "rejected"
  | "completed";

export type WorkPlanVisitStatus =
  | "created"
  | "pending"
  | "in_progress"
  | "checked_in"
  | "checked_out"
  | "completed"
  | "cancelled"
  | "skipped"
  | "rescheduled";

export type WorkPlanVisitPartyType =
  | "existing"
  | "existing_lead"
  | "facility"
  | "enquiry"
  | "new_party"
  | "new_lead";

export type WorkPlanExpenseStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected";

export type WorkPlanExpenseCategory =
  | "Travel"
  | "Accommodation"
  | "Food"
  | "Communication"
  | "Client Entertainment"
  | "Marketing"
  | "Office"
  | "Miscellaneous";

export type WorkPlanExpenseTravelSubCategory =
  | "Cab"
  | "Auto"
  | "Bus"
  | "Bike Ride"
  | "Private Bike"
  | "Train"
  | "Parking";

export type WorkPlanExpensePaymentMode =
  | "Cash"
  | "UPI"
  | "Card"
  | "Bank Transfer"
  | "Company Card";

export const WORK_PLAN_EXPENSE_CATEGORIES: WorkPlanExpenseCategory[] = [
  "Travel",
  "Accommodation",
  "Food",
  "Communication",
  "Client Entertainment",
  "Marketing",
  "Office",
  "Miscellaneous",
];

export const WORK_PLAN_TRAVEL_SUB_CATEGORIES: WorkPlanExpenseTravelSubCategory[] = [
  "Cab",
  "Auto",
  "Bus",
  "Bike Ride",
  "Private Bike",
  "Train",
  "Parking",
];

export const WORK_PLAN_EXPENSE_PAYMENT_MODES: WorkPlanExpensePaymentMode[] = [
  "Cash",
  "UPI",
  "Card",
  "Bank Transfer",
  "Company Card",
];

export type WorkPlanExpenseAttachment = {
  _id: string;
  original_name?: string;
  file_name?: string;
  mime_type?: string;
  url?: string;
  key?: string;
};

export type WorkPlanExpenseRecord = {
  _id?: string;
  id?: string;
  work_plan?:
    | string
    | {
        _id?: string;
        id?: string;
        plan_date?: string;
        location?: string;
        status?: WorkPlanStatus;
        sales_user?:
          | string
          | {
              _id?: string;
              name?: string;
              email?: string;
              department?: string;
            };
      };
  work_plan_visit?:
    | string
    | {
        _id?: string;
        id?: string;
        sequence?: number;
        party_type?: string;
        party_name?: string;
        contact_person?: string;
        party?: { _id?: string; party_name?: string };
      };
  work_plan_id?: string;
  sales_user?: string | { _id?: string; name?: string; email?: string };
  expense_date: string;

  category: WorkPlanExpenseCategory;
  sub_category?: string;
  amount: number;
  payment_mode: WorkPlanExpensePaymentMode;
  vendor_name?: string;
  bill_number?: string;
  bill_date?: string;
  description?: string;
  receipt_attachment?: WorkPlanExpenseAttachment | string | null;
  attachments?: (WorkPlanExpenseAttachment | string)[] | null;
  start_reading?: number;
  closing_reading?: number;
  total_km?: number;
  rate_per_km?: number;
  start_reading_image?: WorkPlanExpenseAttachment | string | null;
  end_reading_image?: WorkPlanExpenseAttachment | string | null;
  status: WorkPlanExpenseStatus;
  settled_amount?: number;
  settlement_status?: "unsettled" | "partially_settled" | "settled";
  settlement_id?: string;
  approved_by?: { _id?: string; name?: string; email?: string } | string;
  approved_at?: string;
  rejection_reason?: string;
  manager_remarks?: string;
  authority_remarks?: AuthorityRemarkItem[];
  created_by?: { _id?: string; name?: string; email?: string } | string;
  createdAt?: string;
  updatedAt?: string;
};

export type ExpenseAttachmentItem = {
  _id?: string;
  attachment_id?: string;
  file_id?: string;
  filename?: string;
  original_name?: string;
  mime_type?: string;
  size?: number;
  url?: string;
};

export type TourAdvanceStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "disbursed"
  | "settled"
  | "recovered"
  | "refunded";

export type TourAdvanceRefundItem = {
  _id?: string;
  amount: number;
  refund_date?: string;
  payment_method?: string;
  transaction_reference?: string;
  notes?: string;
  attachments?: string[] | any[];
  attachment_details?: ExpenseAttachmentItem[];
  accepted_by?: { _id?: string; name?: string; email?: string } | string;
  accepted_at?: string;
};

export type WorkPlanTourAdvanceRecord = {
  _id?: string;
  id?: string;
  advance_number: string;
  sales_user: string | { _id: string; name: string; email: string; department?: string; phone?: string };
  work_plan?: string | { _id: string; plan_date?: string; title?: string };
  request_date: string;
  amount: number;
  purpose: string;
  notes?: string;
  status: TourAdvanceStatus;
  approved_by?: { _id: string; name: string; email?: string } | string;
  approved_at?: string;
  rejection_reason?: string;
  disbursed_amount?: number;
  disbursed_by?: { _id: string; name: string; email?: string } | string;
  disbursed_at?: string;
  payment_method?: string;
  transaction_reference?: string;
  bank_name?: string;
  disbursement_notes?: string;
  attachments?: string[] | any[];
  attachment_details?: ExpenseAttachmentItem[];
  disbursement_attachments?: string[] | any[];
  disbursement_attachment_details?: ExpenseAttachmentItem[];
  settled_amount?: number;
  remaining_balance?: number;
  refunded_amount?: number;
  refunds?: TourAdvanceRefundItem[];
  createdAt?: string;
  updatedAt?: string;
};

export type SettlementMode = "advance_deduction" | "direct_payment" | "split";

export type SettlementClaimItem = {
  expense: string | WorkPlanExpenseRecord;
  amount: number;
  category?: string;
  description?: string;
  expense_date?: string;
};

export type SettlementAdvanceItem = {
  advance: string | WorkPlanTourAdvanceRecord;
  deducted_amount: number;
  advance_number?: string;
};

export type WorkPlanExpenseSettlementRecord = {
  _id?: string;
  id?: string;
  settlement_number: string;
  sales_user: string | { _id: string; name: string; email: string; department?: string; phone?: string };
  settlement_date: string;
  claims: SettlementClaimItem[];
  advances: SettlementAdvanceItem[];
  total_claim_amount: number;
  advance_deduction_amount: number;
  direct_payment_amount: number;
  settlement_mode: SettlementMode;
  payment_method?: string;
  transaction_reference?: string;
  bank_name?: string;
  settlement_notes?: string;
  attachments?: string[] | any[];
  attachment_details?: ExpenseAttachmentItem[];
  settled_by: { _id: string; name: string; email?: string } | string;
  settled_at: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ExecutiveBalanceItem = {
  sales_user: { _id: string; name: string; email: string; department?: string; phone?: string };
  active_advance_balance: number;
  active_advance_count: number;
  unsettled_approved_claims_amount: number;
  unsettled_approved_claims_count: number;
  total_settled_claims_amount: number;
  total_settled_claims_count: number;
  net_position: number;
  position_status: "due_to_employee" | "due_to_company" | "balanced";
};

export type PassbookLedgerEntry = {
  id: string;
  entry_type: "advance_disbursement" | "advance_refund" | "expense_approved" | "settlement_voucher";
  date: string;
  reference: string;
  title: string;
  amount: number;
  advance_deduction_amount?: number;
  direct_payment_amount?: number;
  impact_advance_balance: number;
  impact_claim_receivable: number;
  running_advance_balance: number;
  running_claim_receivable: number;
  running_net_position: number;
  payment_method?: string;
  transaction_reference?: string;
  actor_name?: string;
  details?: string;
  attachments?: string[] | any[];
  attachment_details?: ExpenseAttachmentItem[];
};

export type ExecutivePassbookData = {
  sales_user: { _id: string; name: string; email: string; department?: string; phone?: string };
  current_advance_balance: number;
  current_claim_receivable: number;
  current_net_position: number;
  entries: PassbookLedgerEntry[];
};

export type ExpenseKpiSummaryData = {
  total_claims_logged: { amount: number; count: number };
  pending_approval: { amount: number; count: number };
  approved_unsettled: { amount: number; count: number };
  active_tour_advances: { amount: number; count: number };
  settled_this_month: { amount: number; count: number };
};

export type AuthorityRemarkType = "instruction" | "appreciation" | "objection";
export type AuthorityRemarkPriority = "low" | "medium" | "high" | "urgent";
export type AuthorityRemarkStatus = "pending_response" | "responded" | "resolved";
export type FollowupActionStatus =
  | "in_progress"
  | "completed"
  | "clarification_provided"
  | "need_help"
  | "acknowledged";

export type FollowupAttachmentItem = {
  _id?: string;
  attachment_id?: string;
  filename?: string;
  original_name?: string;
  mime_type?: string;
  size?: number;
  url?: string;
};

export type FollowupRemarkItem = {
  _id?: string;
  response: string;
  user?: string | { _id: string; name?: string; email?: string; department?: string };
  user_name?: string;
  role?: string;
  action_status?: FollowupActionStatus;
  attachments?: (FollowupAttachmentItem | string)[];
  attachment_details?: FollowupAttachmentItem[];
  created_at?: string;
};

export type AuthorityRemarkItem = {
  _id?: string;
  remark: string;
  user?: string | { _id: string; name?: string; email?: string; department?: string };
  user_name?: string;
  role?: string;
  remark_type?: AuthorityRemarkType;
  priority?: AuthorityRemarkPriority;
  expected_followup_date?: string;
  status?: AuthorityRemarkStatus;
  followup_remarks?: FollowupRemarkItem[];
  resolution_remarks?: string;
  resolved_at?: string;
  resolved_by?: string | { _id: string; name?: string; email?: string };
  resolved_by_name?: string;
  created_at?: string;
};

export type SeniorRemarkFeedItem = {
  id: string;
  remark_id: string;
  target_type: "plan" | "visit" | "task" | "expense";
  plan_id: string;
  target_id: string;
  plan_date?: string;
  title: string;
  location?: string;
  sales_user: {
    _id: string;
    name: string;
    email?: string;
  };
  senior_user: {
    _id: string;
    name: string;
    role?: string;
  };
  remark: string;
  remark_type: AuthorityRemarkType;
  priority: AuthorityRemarkPriority;
  expected_followup_date?: string | null;
  status: AuthorityRemarkStatus;
  followup_remarks: FollowupRemarkItem[];
  resolution_remarks?: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolved_by_name?: string;
  created_at: string;
};

export type SeniorRemarksStats = {
  total: number;
  appreciation_count: number;
  objection_count: number;
  instruction_count: number;
  pending_response_count: number;
  responded_count: number;
  resolved_count: number;
};

export type WorkPlanVisitRecord = {
  _id?: string;
  id?: string;
  work_plan?: string;
  sales_user?:
    | string
    | {
        _id?: string;
        id?: string;
        name?: string;
        email?: string;
        department?: string;
      };
  plan_date?: string;
  sequence: number;
  party_type?: WorkPlanVisitPartyType;
  party?:
    | string
    | {
        _id?: string;
        party_name?: string;
        mobile?: string;
        email?: string;
        contact_person?: string;
        contacts?: Array<{
          contact_person?: string;
          contact_number?: string;
          contact_email?: string;
        }>;
        billing_address?: unknown;
        shipping_address?: unknown;
      };
  party_name?: string;
  contact_person?: string;
  contact_number?: string;
  phone?: string;
  contact_email?: string;

  contacts?: Array<{
    contact_person?: string;
    contact_number?: string;
    contact_email?: string;
  }>;
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  country_id?: string;
  state_id?: string;
  city_id?: string;
  planned_start_time?: string;
  planned_end_time?: string;
  purpose?: string;
  notes?: string;
  status: WorkPlanVisitStatus;
  actual_check_in?: string;
  actual_check_out?: string;
  check_in_selfie_url?: string;
  check_out_selfie_url?: string;
  outcome_selfie_url?: string;
  check_in_lat?: number;
  check_in_lng?: number;
  check_in_address?: string;
  check_out_lat?: number;
  check_out_lng?: number;
  check_out_address?: string;
  check_in_time?: string;
  check_out_time?: string;
  outcome?: string;
  pending_remarks?: string;
  in_progress_remarks?: string;
  manager_remarks?: string;
  authority_remarks?: AuthorityRemarkItem[];
  meeting_with_doctor?: boolean;
  meeting_with_purchase?: boolean;
  meeting_with_finance?: boolean;
  meeting_with_engineer?: boolean;
  new_product_introduced?: boolean;
  order_received?: boolean;
  next_followup_date?: string;
  rescheduled_date?: string;
  created_by?: string | { _id?: string; name?: string; email?: string; role?: string };
  created_by_role?: string;
  updated_by?: string | { _id?: string; name?: string; email?: string; role?: string };
  updated_by_role?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkPlanWorkRecord = {
  _id?: string;
  id?: string;
  work_plan?: string;
  sales_user?:
    | string
    | {
        _id?: string;
        id?: string;
        name?: string;
        email?: string;
        department?: string;
      };
  plan_date?: string;
  sequence: number;
  title: string;
  description?: string;
  planned_start_time?: string;
  planned_end_time?: string;
  status: "created" | "pending" | "in_progress" | "completed" | "cancelled" | "skipped" | "rescheduled";
  completion_remarks?: string;
  pending_remarks?: string;
  in_progress_remarks?: string;
  manager_remarks?: string;
  rescheduled_date?: string;
  authority_remarks?: AuthorityRemarkItem[];
  outcome?: string;
  work_type?: "default" | "optional" | string;
  is_default_task?: boolean;
  is_template_task?: boolean;
  created_by?: string | { _id?: string; name?: string; email?: string; role?: string };
  created_by_role?: string;
  updated_by?: string | { _id?: string; name?: string; email?: string; role?: string };
  updated_by_role?: string;
  createdAt?: string;
  updatedAt?: string;
};


export type WorkPlanRecord = {
  _id?: string;
  id?: string;
  is_standalone?: boolean;
  company_id?: string;
  plan_date: string;
  sales_user?:
    | string
    | {
        _id?: string;
        id?: string;
        name?: string;
        email?: string;
        department?: string;
      };
  status: WorkPlanStatus;
  plan_type?: "Visits" | "Tasks & Visits" | "Leave" | "Work From Home" | "Work From Office";
  remarks?: string;
  manager_remarks?: string;
  authority_remarks?: AuthorityRemarkItem[];
  location?: string;
  country_id?: string;
  state_id?: string;
  city_id?: string;
  city_ids?: string[];
  country?: string;
  state?: string;
  city?: string;
  cities?: string[];
  is_discussed_with_manager?: boolean;
  discussed_manager_id?: string | { _id?: string; name?: string; email?: string };
  discussed_manager_name?: string;
  discussion_method?: "on_call" | "on_direct_meeting" | "on_email" | "other";
  submitted_at?: string;
  approved_by?: string | { _id?: string; name?: string; email?: string };
  approved_at?: string;
  rejection_reason?: string;
  visit_count?: number;
  work_count?: number;
  visits?: WorkPlanVisitRecord[];
  works?: WorkPlanWorkRecord[];
  expenses?: WorkPlanExpenseRecord[];
  expense_total?: number;
  expense_approved_total?: number;
  visit_expense_totals?: Record<string, number>;
  day_end?: WorkPlanDayEnd;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkPlanDayEndAttachment = {
  _id: string;
  original_name?: string;
  file_name?: string;
  mime_type?: string;
  size?: number;
  url?: string;
};

export type WorkPlanDayEnd = {
  completed_at?: string;
  from_email?: string;
  to_email?: string;
  cc_emails?: string[];
  subject?: string;
  body_html?: string;
  attachments?: WorkPlanDayEndAttachment[];
};

export type DayEndDraftResponse = {
  plan_id: string;
  plan_date: string;
  from: string;
  from_email: string;
  to: string;
  cc: string[];
  subject: string;
  body_html: string;
  managers: Array<{
    _id: string;
    name: string;
    email: string;
    department?: string;
  }>;
};

export type DayEndPayload = {
  from_email?: string;
  to_email: string;
  cc_emails?: string[];
  subject: string;
  body_html: string;
  attachment_ids?: string[];
};

export type WorkPlannerStats = {
  total_plans: number;
  today_plans: number;
  pending_approval: number;
  approved: number;
  completed: number;
  rejected: number;
  average_visits: number;
  average_works: number;
  total_visits: number;
  total_works: number;
  by_status: Record<string, number>;
  by_plan_type: Record<string, number>;
  monthly_trend: Array<{ year: number; month: number; count: number }>;
  expense_total: number;
  expense_pending_approval: number;
  expense_approved_count: number;
  expense_monthly_trend: Array<{ year: number; month: number; amount: number; count: number }>;
};

export const THEME_COLORS = [
  { name: "violet", label: "Violet", bg: "bg-purple-600", border: "border-purple-500", text: "text-purple-400" },
  { name: "indigo", label: "Indigo", bg: "bg-indigo-600", border: "border-indigo-500", text: "text-indigo-400" },
  { name: "blue", label: "Blue", bg: "bg-blue-600", border: "border-blue-500", text: "text-blue-400" },
  { name: "emerald", label: "Emerald", bg: "bg-emerald-600", border: "border-emerald-500", text: "text-emerald-400" },
  { name: "rose", label: "Rose", bg: "bg-rose-600", border: "border-rose-500", text: "text-rose-400" },
  { name: "amber", label: "Amber", bg: "bg-amber-600", border: "border-amber-500", text: "text-amber-400" },
] as const;

export type ThemeColor = (typeof THEME_COLORS)[number]["name"];

export type UserPortalAccess = {
  portal_code: string;
  access_roles: string[];
};

export type AuthUser = {
  _id: string;
  name: string;
  email: string;
  department: string;
  roles?: string[];
  role_codes?: string[];
  role_names?: string[];
  portals?: UserPortalAccess[];
};

export type UserSession = {
  token: string;
  refreshToken?: string;
  /** Unix ms when the refresh token expires. Cookie lifetime follows this. */
  refreshExpiresAt?: number;
  refreshExpiresIn?: number;
  user: AuthUser;
};

export interface UserNoteReminder {
  enabled: boolean;
  remind_at?: string | null;
  notify_app?: boolean;
  notify_email?: boolean;
  is_sent?: boolean;
  sent_at?: string | null;
}

export interface UserNoteContact {
  contact_person?: string;
  contact_number?: string;
}

export interface UserNoteRecord {
  _id: string;
  id?: string;
  user: string | { _id: string; name: string; email: string };
  company_id?: string;
  type: "task" | "visit" | "general";
  title: string;
  description?: string;
  content?: string;
  color?: "default" | "emerald" | "blue" | "amber" | "rose" | "purple";
  category?: string;
  tags?: string[];
  is_pinned?: boolean;
  is_archived?: boolean;

  // Task-specific
  priority?: "low" | "medium" | "high" | "urgent";
  target_date?: string | null;
  is_completed?: boolean;
  completed_at?: string | null;

  // Visit-specific
  party?: string | { _id: string; party_name?: string; legal_name?: string; city?: string; state?: string; district?: string } | null;
  party_name?: string;
  party_type?: "existing" | "new_party" | "new_lead";
  contact_person?: string;
  contact_number?: string;
  contacts?: UserNoteContact[];
  locality?: string;
  city?: string;
  purpose?: string;
  planned_time?: string;

  // Work Plan Conversion Link
  is_converted_to_work_plan?: boolean;
  work_plan?: string | { _id: string; plan_date?: string; status?: string; plan_type?: string; location?: string } | null;
  work_plan_item_id?: string | null;
  work_plan_date?: string | null;
  converted_at?: string | null;

  // Reminder
  reminder?: UserNoteReminder;

  createdAt: string;
  updatedAt: string;
}

export interface UserNoteKpis {
  total: number;
  tasks: number;
  visits: number;
  general: number;
  pending: number;
  converted: number;
  reminders: number;
}

export interface BulkConvertToWorkPlanPayload {
  note_ids: string[];
  target_date: string;
}

export interface MarkNotesConvertedPayload {
  note_ids: string[];
  work_plan_id?: string;
  work_plan_date?: string;
}

export interface UserEmailPreferences {
  user?: string;
  master_email_enabled: boolean;

  // 1. Work Plan Lifecycle
  work_plan_created: boolean;
  work_plan_completed: boolean;
  work_plan_approved: boolean;
  work_plan_rejected: boolean;

  // 2. Directives, Remarks & Collaboration
  directive_assigned: boolean;
  directive_resolved: boolean;

  // 3. Scheduled Reminders & Daily Digests
  morning_plan_reminder: boolean;
  morning_manager_digest: boolean;
  evening_day_end_reminder: boolean;
  evening_manager_digest: boolean;
  personal_note_reminder: boolean;

  // 4. Expenses, Advances & Settlements
  expense_submitted: boolean;
  expense_status_update: boolean;
  tour_advance_requested: boolean;
  tour_advance_status: boolean;
  tour_advance_disbursed: boolean;
  expense_settlement: boolean;

  // 5. Help Desk & Support Requests
  help_ticket_tagged: boolean;
  help_ticket_reply: boolean;
  help_ticket_solution: boolean;
  help_ticket_status: boolean;

  updatedAt?: string;
}


