/**
 * @fileoverview RTK Query API slice for Lead Management.
 * @module store/api/slices/leadsApi
 */
import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

export type LeadStatus =
  | "new"
  | "assigned"
  | "follow_up"
  | "quotation"
  | "won"
  | "lost"
  | "converted";

export type LeadPriority = "low" | "medium" | "high" | "urgent";

export type BulkUploadLeadsResult = {
  total: number;
  createdCount: number;
  errorCount: number;
  createdLeads: LeadRecord[];
  errors: Array<{ index: number; row: number; name?: string; error: string }>;
};


export type LeadFollowUpType =
  | "call"
  | "meeting"
  | "email"
  | "whatsapp"
  | "visit"
  | "demo"
  | "note"
  | "other";

export type LeadFollowUpStatus = "pending" | "completed" | "cancelled" | "rescheduled";

export type LeadProductItem = {
  _id?: string;
  product?: {
    _id: string;
    product_name: string;
    sku?: string;
    base_price?: number;
    unit?: string;
  } | string;
  product_name: string;
  quantity: number;
  target_price: number;
  unit?: string;
  remarks?: string;
};

export type LeadContactItem = {
  _id?: string;
  id?: string;
  name: string;
  department?: string;
  designation?: string;
  phone?: string;
  email?: string;
  alternate_phone?: string;
  is_primary?: boolean;
};

export type LeadAddress = {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  country_id?: string;
  state_id?: string;
  city_id?: string;
};

export type LeadQualification = {
  requirement_confirmed?: boolean;
  budget_available?: boolean;
  decision_maker_known?: boolean;
  purchase_timeline?: string;
  competition?: string;
  qualification_notes?: string;
  qualified_at?: string;
  qualified_by?: { _id: string; name: string; email: string };
};

export type LeadLostInfo = {
  lost_reason?: string;
  lost_reason_id?: { _id: string; name: string; code?: string };
  lost_remarks?: string;
  lost_at?: string;
  lost_by?: { _id: string; name: string };
};

export type LeadConversion = {
  converted_at?: string;
  converted_by?: { _id: string; name: string };
  conversion_type?: "existing_customer" | "new_customer" | "quotation" | "order";
  party_id?: { _id: string; party_name: string; mobile?: string; email?: string } | string;
  order_id?: { _id: string; order_no: string; grand_total?: number; status?: string } | string;
  quotation_id?: string;
  notes?: string;
};

export type LeadRecord = {
  _id: string;
  id?: string;
  company_id?: string;
  lead_no: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  alternate_phone?: string;
  contacts?: LeadContactItem[];
  industry?: string;
  designation?: string;
  billing_address?: LeadAddress;
  requirement?: string;
  estimated_value?: number;
  expected_closing_date?: string;
  source: string;
  source_id?: { _id: string; name: string };
  status: LeadStatus;
  priority: LeadPriority;
  assigned_to?: { _id: string; name: string; email: string; phone?: string; department?: string };
  assigned_by?: { _id: string; name: string; email: string };
  assigned_at?: string;
  party_id?: {
    _id: string;
    party_name: string;
    mobile?: string;
    email?: string;
    district?: string;
    state?: string;
    billing_address?: LeadAddress;
  };
  contact_person_id?: string;
  products?: LeadProductItem[];
  notes?: string;
  tags?: string[];
  qualification?: LeadQualification;
  lost_info?: LeadLostInfo;
  conversion?: LeadConversion;
  department?: string;
  assigned_users?: Array<{ _id: string; name: string; email?: string; phone?: string; department?: string }>;
  last_contacted_at?: string;
  next_follow_up_at?: string;
  last_activity_at?: string;
  created_by?: { _id: string; name: string; email?: string; department?: string } | string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type LeadInputPayload = Omit<
  Partial<LeadRecord>,
  | "assigned_to"
  | "assigned_users"
  | "created_by"
  | "source_id"
  | "party_id"
  | "contact_person_id"
> & {
  assigned_to?: string | null | { _id: string; name?: string; email?: string; phone?: string; department?: string };
  assigned_users?: string[];
  department?: string;
  created_by?: string;
  source_id?: string | { _id: string; name?: string };
  party_id?: string | null | { _id: string; party_name?: string };
  contact_person_id?: string;
  contacts?: LeadContactItem[];
};

export type FollowUpActionRecord = {
  _id?: string;
  author: { _id: string; name: string; email?: string; department?: string };
  action_type: "comment" | "call_attempt" | "status_change" | "reschedule" | "requirement_update" | string;
  message: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type LeadFollowUpRecord = {
  _id: string;
  id?: string;
  lead?: {
    _id: string;
    lead_no?: string;
    name?: string;
    company_name?: string;
    phone?: string;
    email?: string;
    status?: LeadStatus;
    priority?: LeadPriority;
    assigned_to?: { _id: string; name: string };
    assigned_users?: Array<{ _id: string; name: string }>;
    created_by?: { _id: string; name: string } | string;
    party_id?: { _id?: string; party_name?: string; legal_name?: string };
    contacts?: Array<{ name?: string; phone?: string; email?: string; designation?: string }>;
  } | string | null;
  quotation?: {
    _id: string;
    quotation_no?: string;
    version?: number;
    grand_total?: number;
    status?: string;
    customer_name?: string;
    kind_attn?: string;
    phone?: string;
    email?: string;
    subject?: string;
    party_id?: string | { _id?: string; party_name?: string };
    sales_person_user?: string | { _id?: string; name?: string; email?: string };
    sales_person_name?: string;
    created_by?: string | { _id?: string; name?: string };
  } | string | null;
  follow_up_date: string;
  follow_up_time?: string;
  type: LeadFollowUpType;
  notes?: string;
  outcome?: string;
  status: LeadFollowUpStatus;
  next_follow_up_date?: string;
  completed_at?: string;
  completed_by?: { _id: string; name: string; email: string };
  created_by: { _id: string; name: string; email: string };
  actions?: FollowUpActionRecord[];
  createdAt?: string;
  updatedAt?: string;
};

export interface UrgentFollowUpsSummary {
  total_urgent: number;
  overdue_count: number;
  today_count: number;
  upcoming_soon_count: number;
  quote_count: number;
  lead_count: number;
  overdue: LeadFollowUpRecord[];
  due_today: LeadFollowUpRecord[];
  upcoming_soon: LeadFollowUpRecord[];
}

export type LeadTimelineEntry = {
  _id: string;
  kind: "activity" | "attachment" | "follow_up";
  action: string;
  message: string;
  actor?: { _id: string; name: string; email?: string; department?: string } | null;
  timestamp: string;
  details?: unknown;
  attachment?: unknown;
  followUp?: LeadFollowUpRecord;
};

export type DuplicateCheckResult = {
  has_duplicates: boolean;
  matching_leads: Array<{
    _id: string;
    lead_no: string;
    name: string;
    company_name?: string;
    phone?: string;
    email?: string;
    status: string;
    priority: string;
    assigned_to?: { _id: string; name: string };
  }>;
  matching_parties: Array<{
    _id: string;
    party_name: string;
    party_type: string;
    mobile?: string;
    email?: string;
    district?: string;
    state?: string;
    gst_no?: string;
  }>;
};

export type LeadDashboardStats = {
  totalLeads: number;
  total_leads?: number;
  newLeads: number;
  followUpLeads?: number;
  assignedLeads?: number;
  contactedLeads?: number;
  qualifiedLeads?: number;
  quotationLeads?: number;
  negotiationLeads?: number;
  wonLeads: number;
  lostLeads: number;
  convertedLeads: number;
  followUpsToday: number;
  overdueFollowUps: number;
  totalPipelineValue: number;
  totalWonValue: number;
  totalPipelineQuantity?: number;
  totalWonQuantity?: number;
  win_rate?: number;
  conversion_rate?: number;
  avg_deal_size?: number;
  won_deals?: {
    count: number;
    value: number;
    win_rate?: number;
  };
  converted_accounts?: {
    count: number;
    value: number;
    conversion_rate?: number;
  };
  active_pipeline?: {
    count: number;
    value: number;
    quantity?: number;
  };
};

export type LeadFunnelStage = {
  key: string;
  label: string;
  count: number;
  quantity?: number;
  estimated_value: number;
  percentage: number;
};

export type LeadSalesPerformance = {
  user_id: string;
  name: string;
  email: string;
  department?: string;
  total_leads: number;
  qualified_leads: number;
  quotations: number;
  won_leads: number;
  lost_leads: number;
  win_rate?: number;
  conversion_rate: number;
  pipeline_qty?: number;
  pipeline_quantity?: number;
  won_qty?: number;
  won_quantity?: number;
  lost_qty?: number;
  lost_quantity?: number;
  pipeline_value: number;
  won_value: number;
  avg_lead_value: number;
  completed_followups: number;
  overdue_followups: number;
};

export type LeadReportQueryParams = {
  period?: string;
  startDate?: string;
  endDate?: string;
  start_date?: string;
  end_date?: string;
  from?: string;
  to?: string;
  assigned_to?: string;
  sales_person?: string;
  status?: string;
};

export type LeadMonthlyTrend = {
  period_key: string;
  period_label: string;
  total_leads: number;
  pipeline_value: number;
  won_count: number;
  won_value: number;
  converted_count: number;
  converted_value: number;
  lost_count: number;
  lost_value: number;
  quotation_count: number;
};

export type LeadProductPerformance = {
  product_name: string;
  unit: string;
  times_inquired: number;
  total_quantity: number;
  total_estimated_value: number;
  won_quantity: number;
  won_value: number;
  converted_quantity: number;
  converted_value: number;
  avg_unit_price?: number;
};

export type LeadSourcePerformance = {
  source: string;
  total_leads: number;
  qualified_leads: number;
  won_leads: number;
  lost_leads: number;
  conversion_rate: number;
  pipeline_qty?: number;
  pipeline_quantity?: number;
  won_qty?: number;
  won_quantity?: number;
  lost_qty?: number;
  lost_quantity?: number;
  pipeline_value: number;
  won_value: number;
};

export type FollowUpReportSummary = {
  total_followups: number;
  completed_count: number;
  pending_count: number;
  cancelled_count: number;
  rescheduled_count: number;
  overdue_count: number;
  due_today_count: number;
  upcoming_count: number;
  on_time_completed_count: number;
  on_time_rate: number;
  completion_rate: number;
  lead_followups_count: number;
  quotation_followups_count: number;
};

export type FollowUpChannelBreakdown = {
  type: string;
  label: string;
  total_count: number;
  completed_count: number;
  pending_count: number;
  overdue_count: number;
  completion_rate: number;
  share_percent: number;
};

export type FollowUpOutcomeBreakdown = {
  outcome: string;
  count: number;
  percent: number;
};

export type FollowUpRepScorecard = {
  user_id: string;
  name: string;
  email: string;
  department: string;
  total_scheduled: number;
  completed: number;
  on_time: number;
  pending: number;
  overdue: number;
  lead_count: number;
  quotation_count: number;
  on_time_rate: number;
  completion_rate: number;
};

export type FollowUpDailyTrend = {
  date: string;
  scheduled: number;
  completed: number;
  overdue: number;
  pending: number;
};

export type FollowUpDetailedRecord = {
  _id: string;
  entity_type: "lead" | "quotation";
  entity_ref_no: string;
  lead_id?: string | null;
  quotation_id?: string | null;
  customer_name: string;
  company_name: string;
  phone: string;
  email: string;
  city: string;
  rep_name: string;
  creator_name?: string;
  type: LeadFollowUpType;
  status: LeadFollowUpStatus;
  display_status: string;
  follow_up_date: string | null;
  follow_up_time: string;
  completed_at: string | null;
  outcome: string;
  notes: string;
  commercial_value: number;
};

export type FollowUpReportData = {
  summary: FollowUpReportSummary;
  channel_breakdown: FollowUpChannelBreakdown[];
  outcome_breakdown: FollowUpOutcomeBreakdown[];
  rep_scorecard: FollowUpRepScorecard[];
  daily_trends: FollowUpDailyTrend[];
  detailed_records: FollowUpDetailedRecord[];
};

export type FollowUpReportQueryParams = {
  from_date?: string;
  to_date?: string;
  period?: "today" | "this_week" | "this_month" | "this_quarter" | "all" | string;
  assigned_to?: string;
  entity_type?: "all" | "lead" | "quotation" | string;
  type?: string;
  status?: string;
};

export type ListLeadsQueryArgs = {
  page?: number;
  limit?: number;
  paginate?: string;
  search?: string;
  status?: string;
  priority?: string;
  source?: string;
  assigned_to?: string;
  assigned_dept?: string;
  scope?: string;
  city?: string;
  state?: string;
  department?: string;
  created_by?: string;
  from_date?: string;
  to_date?: string;
  follow_up_filter?: "today" | "overdue" | "upcoming";
  min_value?: number;
  max_value?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ListLeadsResponse = {
  items: LeadRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const leadsApi = medicaApi.injectEndpoints({
  overrideExisting: false,
  endpoints: (build) => ({
    listLeads: build.query<ListLeadsResponse, ListLeadsQueryArgs | void>({
      query: (params) => ({
        url: "/leads",
        params: params || undefined,
      }),
      transformResponse: (res: ApiEnvelope<ListLeadsResponse>) => unwrapEnvelope(res),
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map((i) => ({ type: "Lead" as const, id: i._id })),
              { type: "Lead" as const, id: "LIST" },
            ]
          : [{ type: "Lead" as const, id: "LIST" }],
    }),

    getLead: build.query<LeadRecord, string>({
      query: (id) => `/leads/${id}`,
      transformResponse: (res: ApiEnvelope<LeadRecord>) => unwrapEnvelope(res),
      providesTags: (_res, _err, id) => [{ type: "Lead" as const, id }],
    }),

    createLead: build.mutation<LeadRecord, LeadInputPayload>({
      query: (body) => ({
        url: "/leads",
        method: "POST",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadRecord>) => unwrapEnvelope(res),
      invalidatesTags: [{ type: "Lead", id: "LIST" }],
    }),

    updateLead: build.mutation<LeadRecord, { id: string; body: LeadInputPayload }>({
      query: ({ id, body }) => ({
        url: `/leads/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadRecord>) => unwrapEnvelope(res),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Lead", id },
        { type: "Lead", id: "LIST" },
      ],
    }),

    deleteLead: build.mutation<{ _id: string }, string>({
      query: (id) => ({
        url: `/leads/${id}`,
        method: "DELETE",
      }),
      transformResponse: (res: ApiEnvelope<{ _id: string }>) => unwrapEnvelope(res),
      invalidatesTags: [{ type: "Lead", id: "LIST" }],
    }),

    bulkDeleteLeads: build.mutation<{ count: number; deletedIds: string[] }, string[]>({
      query: (ids) => ({
        url: "/leads/bulk",
        method: "DELETE",
        body: { ids },
      }),
      transformResponse: (res: ApiEnvelope<{ count: number; deletedIds: string[] }>) =>
        unwrapEnvelope(res),
      invalidatesTags: [{ type: "Lead", id: "LIST" }],
    }),

    bulkUploadLeads: build.mutation<BulkUploadLeadsResult, { leads: Partial<LeadInputPayload>[] }>({
      query: (body) => ({
        url: "/leads/bulk-upload",
        method: "POST",
        body,
      }),
      transformResponse: (res: ApiEnvelope<BulkUploadLeadsResult>) => unwrapEnvelope(res),
      invalidatesTags: [{ type: "Lead", id: "LIST" }],
    }),


    restoreLead: build.mutation<{ _id: string }, string>({
      query: (id) => ({
        url: `/leads/${id}/restore`,
        method: "POST",
      }),
      transformResponse: (res: ApiEnvelope<{ _id: string }>) => unwrapEnvelope(res),
      invalidatesTags: [{ type: "Lead", id: "LIST" }],
    }),

    checkLeadDuplicates: build.mutation<
      DuplicateCheckResult,
      { phone?: string; email?: string; company_name?: string }
    >({
      query: (body) => ({
        url: "/leads/check-duplicates",
        method: "POST",
        body,
      }),
      transformResponse: (res: ApiEnvelope<DuplicateCheckResult>) => unwrapEnvelope(res),
    }),

    assignLead: build.mutation<
      LeadRecord,
      {
        id: string;
        assigned_to?: string;
        assigned_users?: string[];
        department?: string;
        notes?: string;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/leads/${id}/assign`,
        method: "POST",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadRecord>) => unwrapEnvelope(res),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Lead", id },
        { type: "Lead", id: "LIST" },
      ],
    }),

    changeLeadStatus: build.mutation<
      LeadRecord,
      { id: string; status: LeadStatus; remarks?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/leads/${id}/status`,
        method: "POST",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadRecord>) => unwrapEnvelope(res),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Lead", id },
        { type: "Lead", id: "LIST" },
      ],
    }),

    qualifyLead: build.mutation<LeadRecord, { id: string; qualification: LeadQualification }>({
      query: ({ id, qualification }) => ({
        url: `/leads/${id}/qualify`,
        method: "POST",
        body: qualification,
      }),
      transformResponse: (res: ApiEnvelope<LeadRecord>) => unwrapEnvelope(res),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Lead", id },
        { type: "Lead", id: "LIST" },
      ],
    }),

    markLeadLost: build.mutation<
      LeadRecord,
      { id: string; lost_reason: string; lost_remarks?: string; lost_reason_id?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/leads/${id}/mark-lost`,
        method: "POST",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadRecord>) => unwrapEnvelope(res),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Lead", id },
        { type: "Lead", id: "LIST" },
      ],
    }),

    convertLead: build.mutation<
      LeadRecord,
      {
        id: string;
        conversion_type?: "existing_customer" | "new_customer" | "quotation" | "order";
        party_id?: string;
        party_name?: string;
        gst_no?: string;
        drug_license_no?: string;
        payment_terms?: string;
        create_order?: boolean;
        notes?: string;
        quotation_id?: string;
        party_data?: Record<string, unknown>;
        order_items?: Array<{
          product?: string;
          productId?: string;
          product_name: string;
          quantity: number;
          unit?: string;
          applied_rate_type?: string;
          unit_price?: number;
          discount_percent?: number;
          discount_amount?: number;
          gst_percent?: number;
          remarks?: string;
        }>;
        order_data?: {
          order_date?: string;
          delivery_date?: string;
          remarks?: string;
        };
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/leads/${id}/convert`,
        method: "POST",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadRecord>) => unwrapEnvelope(res),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Lead", id },
        { type: "Lead", id: "LIST" },
        { type: "LeadQuotation", id: `LEAD_${id}` },
        { type: "Parties", id: "LIST" },
        { type: "Orders", id: "LIST" },
      ],
    }),

    getLeadTimeline: build.query<LeadTimelineEntry[], string>({
      query: (id) => `/leads/${id}/timeline`,
      transformResponse: (res: ApiEnvelope<LeadTimelineEntry[]>) => unwrapEnvelope(res),
      providesTags: (_res, _err, id) => [{ type: "Lead" as const, id: `TIMELINE_${id}` }],
    }),

    listLeadFollowUps: build.query<LeadFollowUpRecord[], string>({
      query: (leadId) => `/leads/${leadId}/follow-ups`,
      transformResponse: (res: ApiEnvelope<LeadFollowUpRecord[]>) => unwrapEnvelope(res),
      providesTags: (_res, _err, leadId) => [
        { type: "LeadFollowUp" as const, id: `LEAD_${leadId}` },
      ],
    }),

    createLeadFollowUp: build.mutation<
      LeadFollowUpRecord,
      {
        leadId: string;
        follow_up_date?: string;
        follow_up_time?: string;
        type: LeadFollowUpType;
        notes?: string;
      }
    >({
      query: ({ leadId, ...body }) => ({
        url: `/leads/${leadId}/follow-ups`,
        method: "POST",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadFollowUpRecord>) => unwrapEnvelope(res),
      invalidatesTags: (_res, _err, { leadId }) => [
        { type: "LeadFollowUp", id: `LEAD_${leadId}` },
        { type: "Lead", id: leadId },
        { type: "Lead", id: "LIST" },
      ],
    }),

    completeLeadFollowUp: build.mutation<
      { completed: LeadFollowUpRecord; next?: LeadFollowUpRecord | null },
      {
        followUpId: string;
        leadId?: string;
        outcome: string;
        next_follow_up_date?: string;
        next_follow_up_time?: string;
        next_type?: LeadFollowUpType;
        next_notes?: string;
      }
    >({
      query: ({ followUpId, ...body }) => ({
        url: `/leads/follow-ups/${followUpId}/complete`,
        method: "PUT",
        body,
      }),
      transformResponse: (
        res: ApiEnvelope<{ completed: LeadFollowUpRecord; next?: LeadFollowUpRecord | null }>
      ) => unwrapEnvelope(res),
      invalidatesTags: (_res, _err, { leadId }) => [
        { type: "LeadFollowUp", id: leadId ? `LEAD_${leadId}` : "LIST" },
        { type: "Lead", id: leadId || "LIST" },
        { type: "Lead", id: "LIST" },
      ],
    }),

    addLeadFollowUpAction: build.mutation<
      LeadFollowUpRecord,
      {
        followUpId: string;
        leadId?: string;
        message: string;
        action_type?: string;
        metadata?: Record<string, unknown>;
      }
    >({
      query: ({ followUpId, leadId: _lid, ...body }) => ({
        url: `/leads/follow-ups/${followUpId}/actions`,
        method: "POST",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadFollowUpRecord>) => unwrapEnvelope(res),
      invalidatesTags: (_res, _err, { leadId, followUpId }) => [
        { type: "LeadFollowUp", id: leadId ? `LEAD_${leadId}` : "LIST" },
        { type: "LeadFollowUp", id: followUpId },
        { type: "Lead", id: leadId || "LIST" },
      ],
    }),

    getLeadFollowUpCalendar: build.query<
      LeadFollowUpRecord[],
      {
        from_date?: string;
        to_date?: string;
        status?: string;
        type?: string;
        scope?: string;
        assigned_to?: string;
        created_by?: string;
        entity_type?: string;
      } | void
    >({
      query: (params) => ({
        url: "/leads/follow-ups/calendar",
        params: params || undefined,
      }),
      transformResponse: (res: ApiEnvelope<LeadFollowUpRecord[]>) => unwrapEnvelope(res),
      providesTags: [{ type: "LeadFollowUp" as const, id: "CALENDAR" }],
    }),

    runTodaysFollowUpReminders: build.mutation<
      {
        kind?: string;
        dateLabel?: string;
        digestDate?: string;
        recipientCount: number;
        followUpCount: number;
        skipped?: number;
      },
      { force?: boolean } | void
    >({
      query: (args) => ({
        url: "/leads/follow-ups/reminders/today",
        method: "POST",
        params: args?.force ? { force: "1" } : undefined,
      }),
      transformResponse: (
        res: ApiEnvelope<{
          kind?: string;
          dateLabel?: string;
          digestDate?: string;
          recipientCount: number;
          followUpCount: number;
          skipped?: number;
        }>
      ) => unwrapEnvelope(res),
    }),

    runOverdueFollowUpReminders: build.mutation<
      {
        kind?: string;
        dateLabel?: string;
        digestDate?: string;
        recipientCount: number;
        followUpCount: number;
        skipped?: number;
      },
      { force?: boolean } | void
    >({
      query: (args) => ({
        url: "/leads/follow-ups/reminders/overdue",
        method: "POST",
        params: args?.force ? { force: "1" } : undefined,
      }),
      transformResponse: (
        res: ApiEnvelope<{
          kind?: string;
          dateLabel?: string;
          digestDate?: string;
          recipientCount: number;
          followUpCount: number;
          skipped?: number;
        }>
      ) => unwrapEnvelope(res),
    }),

    getLeadDashboardStats: build.query<
      LeadDashboardStats,
      LeadReportQueryParams | void
    >({
      query: (params) => ({
        url: "/leads/reports/dashboard",
        params: params || undefined,
      }),
      transformResponse: (res: ApiEnvelope<LeadDashboardStats>) => unwrapEnvelope(res),
      providesTags: [{ type: "Lead" as const, id: "DASHBOARD_STATS" }],
    }),

    getLeadSalesFunnel: build.query<
      { total_leads: number; stages: LeadFunnelStage[]; drop_offs?: { lost?: { count: number; value: number } } },
      LeadReportQueryParams | void
    >({
      query: (params) => ({
        url: "/leads/reports/funnel",
        params: params || undefined,
      }),
      transformResponse: (res: ApiEnvelope<{ total_leads: number; stages: LeadFunnelStage[]; drop_offs?: { lost?: { count: number; value: number } } }>) =>
        unwrapEnvelope(res),
      providesTags: [{ type: "Lead" as const, id: "FUNNEL" }],
    }),

    getLeadSalesPerformance: build.query<
      LeadSalesPerformance[],
      LeadReportQueryParams | void
    >({
      query: (params) => ({
        url: "/leads/reports/sales-performance",
        params: params || undefined,
      }),
      transformResponse: (res: ApiEnvelope<LeadSalesPerformance[]>) => unwrapEnvelope(res),
      providesTags: [{ type: "Lead" as const, id: "SALES_PERFORMANCE" }],
    }),

    getLeadSourcePerformance: build.query<
      LeadSourcePerformance[],
      LeadReportQueryParams | void
    >({
      query: (params) => ({
        url: "/leads/reports/source-performance",
        params: params || undefined,
      }),
      transformResponse: (res: ApiEnvelope<LeadSourcePerformance[]>) => unwrapEnvelope(res),
      providesTags: [{ type: "Lead" as const, id: "SOURCE_PERFORMANCE" }],
    }),

    getLeadMonthlyTrends: build.query<
      LeadMonthlyTrend[],
      LeadReportQueryParams | void
    >({
      query: (params) => ({
        url: "/leads/reports/monthly-trends",
        params: params || undefined,
      }),
      transformResponse: (res: ApiEnvelope<LeadMonthlyTrend[]>) => unwrapEnvelope(res),
      providesTags: [{ type: "Lead" as const, id: "MONTHLY_TRENDS" }],
    }),

    getLeadProductBreakdown: build.query<
      LeadProductPerformance[],
      LeadReportQueryParams | void
    >({
      query: (params) => ({
        url: "/leads/reports/products",
        params: params || undefined,
      }),
      transformResponse: (res: ApiEnvelope<LeadProductPerformance[]>) => unwrapEnvelope(res),
      providesTags: [{ type: "Lead" as const, id: "PRODUCT_BREAKDOWN" }],
    }),

    getUrgentFollowUpsSummary: build.query<UrgentFollowUpsSummary, { tz?: string } | void>({
      query: (params) => ({
        url: "/leads/follow-ups/urgent-summary",
        params: params || undefined,
      }),
      transformResponse: (res: ApiEnvelope<UrgentFollowUpsSummary>) => unwrapEnvelope(res),
      providesTags: [
        { type: "LeadFollowUp" as const, id: "URGENT_SUMMARY" },
        { type: "LeadQuotation" as const, id: "LIST" },
      ],
    }),

    getFollowUpAnalyticsReport: build.query<
      FollowUpReportData,
      FollowUpReportQueryParams | void
    >({
      query: (params) => ({
        url: "/leads/reports/follow-ups",
        params: params || undefined,
      }),
      transformResponse: (res: ApiEnvelope<FollowUpReportData>) => unwrapEnvelope(res),
      providesTags: [
        { type: "LeadFollowUp" as const, id: "REPORT" },
        { type: "Lead" as const, id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListLeadsQuery,
  useGetLeadQuery,
  useCreateLeadMutation,
  useUpdateLeadMutation,
  useDeleteLeadMutation,
  useBulkDeleteLeadsMutation,
  useBulkUploadLeadsMutation,
  useRestoreLeadMutation,

  useCheckLeadDuplicatesMutation,
  useAssignLeadMutation,
  useChangeLeadStatusMutation,
  useQualifyLeadMutation,
  useMarkLeadLostMutation,
  useConvertLeadMutation,
  useGetLeadTimelineQuery,
  useListLeadFollowUpsQuery,
  useCreateLeadFollowUpMutation,
  useCompleteLeadFollowUpMutation,
  useAddLeadFollowUpActionMutation,
  useGetLeadFollowUpCalendarQuery,
  useGetUrgentFollowUpsSummaryQuery,
  useGetFollowUpAnalyticsReportQuery,
  useRunTodaysFollowUpRemindersMutation,
  useRunOverdueFollowUpRemindersMutation,
  useGetLeadDashboardStatsQuery,
  useGetLeadSalesFunnelQuery,
  useGetLeadSalesPerformanceQuery,
  useGetLeadSourcePerformanceQuery,
  useGetLeadMonthlyTrendsQuery,
  useGetLeadProductBreakdownQuery,
} = leadsApi;
