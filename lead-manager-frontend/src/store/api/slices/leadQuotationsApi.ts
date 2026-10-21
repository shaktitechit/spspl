/**
 * @fileoverview RTK Query API slice for Lead Quotations.
 * @module store/api/slices/leadQuotationsApi
 */
import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

export type QuotationStatus = "draft" | "pending_approval" | "approved" | "sent" | "in_negotiation" | "accepted" | "rejected" | "expired" | "on_hold" | "converted";
export type QuotationApprovalStatus = "pending_approval" | "approved" | "rejected";

export type LeadQuotationItem = {
  _id?: string;
  product?: string;
  product_name: string;
  description?: string;
  hsn_code?: string;
  quantity: number;
  unit?: string;
  rate: number;
  discount_percent?: number;
  discount_amount?: number;
  taxable_amount: number;
  gst_enabled?: boolean;
  gst_rate: number;
  cgst_rate?: number;
  cgst_amount?: number;
  sgst_rate?: number;
  sgst_amount?: number;
  igst_rate?: number;
  igst_amount?: number;
  total_gst_amount: number;
  line_total: number;
};

export type QuotationRevisionSnapshot = {
  _id?: string;
  version: number;
  quotation_no?: string;
  ref_no?: string;
  customer_ref?: string;
  quotation_date?: string;
  valid_until?: string;
  validity_days?: number;
  subject?: string;
  message?: string;
  quotation_message?: string;
  customer_name?: string;
  kind_attn?: string;
  phone?: string;
  cell?: string;
  email?: string;
  gstin?: string;
  address?: {
    address_line_1?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    country_id?: string;
    state_id?: string;
    city_id?: string;
  };
  items?: LeadQuotationItem[];
  subtotal?: number;
  total_discount?: number;
  gst_enabled?: boolean;
  total_gst?: number;
  round_off?: number;
  grand_total?: number;
  amount_in_words?: string;
  terms_and_conditions?: string[];
  branch_id?: string;
  branch_code?: string;
  company_branch_name?: string;
  company_name?: string;
  company_regd_address?: string;
  company_phone?: string;
  company_email?: string;
  company_gstin?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch_name?: string;
  account_type?: string;
  signatory_name?: string;
  signatory_phone?: string;
  signatory_email?: string;
  signatory_designation?: string;
  signatory_user?: { _id: string; name?: string; email?: string; department?: string; phone?: string; designation?: string } | null;
  sales_person_name?: string;
  sales_person_phone?: string;
  sales_person_email?: string;
  sales_person_designation?: string;
  sales_person_user?: { _id: string; name?: string; email?: string; department?: string; phone?: string; designation?: string } | null;
  status?: string;
  approval_status?: string;
  approved_by?: { _id: string; name?: string; email?: string } | null;
  approved_at?: string | null;
  saved_by?: { _id: string; name?: string; email?: string } | null;
  saved_at?: string;
  change_summary?: string;
};

export type QuotationVersionComparison = {
  from_version: number;
  to_version: number;
  from_saved_at?: string;
  to_saved_at?: string;
  from_saved_by?: { _id: string; name?: string; email?: string } | null;
  to_saved_by?: { _id: string; name?: string; email?: string } | null;
  financial_comparison: {
    subtotal_from: number;
    subtotal_to: number;
    subtotal_delta: number;
    discount_from: number;
    discount_to: number;
    discount_delta: number;
    gst_from: number;
    gst_to: number;
    gst_delta: number;
    grand_total_from: number;
    grand_total_to: number;
    grand_total_delta: number;
  };
  items_comparison: Array<{
    status: 'added' | 'removed' | 'modified' | 'unchanged';
    product_name: string;
    from: LeadQuotationItem | null;
    to: LeadQuotationItem | null;
    diff?: {
      quantity_delta: number;
      rate_delta: number;
      discount_delta: number;
      line_total_delta: number;
    };
  }>;
  terms_from: string[];
  terms_to: string[];
};

export type LeadQuotationRecord = {
  _id: string;
  quotation_no: string;
  ref_no?: string;
  customer_ref?: string;
  lead: string | {
    _id: string;
    lead_no?: string;
    organization_name?: string;
    status?: string;
    first_name?: string;
    last_name?: string;
  };
  party_id?: string;
  quotation_date: string;
  valid_until?: string;
  validity_days?: number;
  subject?: string;
  customer_name?: string;
  kind_attn?: string;
  phone?: string;
  cell?: string;
  email?: string;
  gstin?: string;
  address?: {
    address_line_1?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    country_id?: string;
    state_id?: string;
    city_id?: string;
  };
  items: LeadQuotationItem[];
  total_discount?: number;
  subtotal: number;
  gst_enabled?: boolean;
  total_gst: number;
  round_off?: number;
  grand_total: number;
  amount_in_words?: string;
  payment_terms?: string;
  message?: string;
  quotation_message?: string;
  terms_and_conditions?: string[];
  company_branch_id?: string;
  branch_id?: string;
  company_branch_code?: string;
  branch_code?: string;
  company_branch_name?: string;
  company_name?: string;
  company_regd_address?: string;
  company_phone?: string;
  company_email?: string;
  company_gstin?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch_name?: string;
  account_type?: string;
  signatory_name?: string;
  signatory_phone?: string;
  signatory_email?: string;
  signatory_designation?: string;
  signatory_user?: string | { _id: string; name?: string; email?: string; department?: string; phone?: string; designation?: string };
  sales_person_name?: string;
  sales_person_phone?: string;
  sales_person_email?: string;
  sales_person_designation?: string;
  sales_person_user?: string | { _id: string; name?: string; email?: string; department?: string; phone?: string; designation?: string };
  approval_status?: QuotationApprovalStatus;
  approved_at?: string;
  approved_by?: string | { _id: string; name?: string };
  rejection_reason?: string;
  status: QuotationStatus;
  version?: number;
  revision_of?: string | LeadQuotationRecord;
  is_historical_snapshot?: boolean;
  revision_history?: QuotationRevisionSnapshot[];
  lost_reason?: string;
  proforma_issued_at?: string;
  customer_po_number?: string;
  customer_po_date?: string;
  advance_amount?: number;
  payment_mode?: string;
  payment_reference?: string;
  proforma_details?: LeadQuotationProformaDetails;
  conversion?: {
    converted_at?: string;
    converted_by?: string | { _id: string; name?: string; email?: string; department?: string };
    party_id?: string | { _id: string; party_name?: string };
    order_id?: string | { _id: string; order_no?: string; status?: string; grand_total?: number };
    customer_po_number?: string;
    customer_po_date?: string;
    advance_amount?: number;
    payment_mode?: string;
    payment_reference?: string;
    notes?: string;
  };
  next_follow_up_at?: string;
  last_follow_up_at?: string;
  expiry_alert_sent_at?: string;
  validity_extension_history?: Array<{
    _id?: string;
    extended_at: string;
    extended_by?: string | { _id: string; name?: string; email?: string; department?: string };
    previous_valid_until?: string;
    new_valid_until?: string;
    reason?: string;
  }>;
  created_by?: {
    _id: string;
    name?: string;
    email?: string;
    department?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type LeadQuotationProformaDetails = {
  proforma_no?: string;
  invoice_date?: string;
  customer_po_number?: string;
  customer_po_date?: string;
  sales_person?: string;
  orc?: string;
  dispatch_date?: string;
  freight_charges?: string;
  payment_terms?: string;
  transport?: string;
  ship_to_address?: string;
  customer_type?: string;
  installation_required?: string;
  gst_concession?: string;
  margin_sheet_attached?: string;
  kyc_status?: string;
  remarks?: string;
  message?: string;
  generated_at?: string;
  generated_by?: string | { _id: string; name?: string; email?: string; department?: string };
};

export type LeadQuotationFollowUp = {
  _id: string;
  quotation?: string | LeadQuotationRecord;
  lead?: string | { _id: string; lead_no?: string; organization_name?: string };
  follow_up_date: string;
  follow_up_time?: string;
  type: "call" | "meeting" | "email" | "whatsapp" | "visit" | "demo" | "other";
  notes?: string;
  outcome?: string;
  status: "pending" | "completed" | "cancelled" | "rescheduled";
  next_follow_up_date?: string;
  completed_at?: string;
  completed_by?: { _id: string; name?: string; email?: string };
  created_by: { _id: string; name?: string; email?: string };
  createdAt: string;
  updatedAt: string;
};

export type ScheduleQuotationFollowUpPayload = {
  follow_up_date: string;
  follow_up_time?: string;
  type?: "call" | "meeting" | "email" | "whatsapp" | "visit" | "demo" | "other";
  notes?: string;
};

export type CompleteQuotationFollowUpPayload = {
  outcome: string;
  next_follow_up_date?: string;
  next_follow_up_time?: string;
  next_type?: "call" | "meeting" | "email" | "whatsapp" | "visit" | "demo" | "other";
  next_notes?: string;
};

export type CreateQuotationPayload = {
  quotation_no?: string;
  ref_no?: string;
  customer_ref?: string;
  party_id?: string;
  gst_enabled?: boolean;
  quotation_date?: string;
  valid_until?: string;
  validity_days?: number;
  subject?: string;
  customer_name?: string;
  kind_attn?: string;
  phone?: string;
  cell?: string;
  email?: string;
  gstin?: string;
  address?: {
    address_line_1?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    country_id?: string;
    state_id?: string;
    city_id?: string;
  };
  items: Array<{
    product?: string;
    product_name: string;
    description?: string;
    hsn_code?: string;
    quantity: number;
    unit?: string;
    rate: number;
    gst_enabled?: boolean;
    gst_rate: number;
    igst_rate?: number;
  }>;
  terms_and_conditions?: string[];
  message?: string;
  quotation_message?: string;
  company_branch_id?: string;
  branch_id?: string;
  company_branch_code?: string;
  branch_code?: string;
  company_branch_name?: string;
  company_name?: string;
  company_regd_address?: string;
  company_phone?: string;
  company_email?: string;
  company_gstin?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch_name?: string;
  account_type?: string;
  signatory_name?: string;
  signatory_phone?: string;
  signatory_email?: string;
  signatory_designation?: string;
  signatory_user?: string;
  sales_person_name?: string;
  sales_person_phone?: string;
  sales_person_email?: string;
  sales_person_designation?: string;
  sales_person_user?: string;
  approval_status?: QuotationApprovalStatus;
  status?: QuotationStatus;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  amount_in_words?: string;
  notes?: string;
};

export type UpdateQuotationPayload = Partial<CreateQuotationPayload>;

export type ConvertQuotationPayload = {
  conversion_type?: "new_customer" | "existing_customer";
  party_id?: string;
  party_name?: string;
  gst_no?: string;
  drug_license_no?: string;
  payment_terms?: string;
  customer_po_number?: string;
  customer_po_date?: string;
  advance_amount?: number;
  payment_mode?: string;
  payment_reference?: string;
  billing_address?: {
    address_line_1?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    country_id?: string;
    state_id?: string;
    city_id?: string;
  };
  shipping_address?: {
    address_line_1?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    country_id?: string;
    state_id?: string;
    city_id?: string;
  };
  party_data?: Record<string, any>;
  order_data?: {
    order_date?: string;
    delivery_date?: string;
    customer_po_number?: string;
    customer_po_date?: string;
    advance_amount?: number;
    payment_mode?: string;
    payment_reference?: string;
    remarks?: string;
    assigned_sales_user?: string;
  };
  assigned_sales_user?: string;
  order_items?: Array<{
    product?: string;
    productId?: string;
    product_name?: string;
    sku?: string;
    unit?: string;
    quantity: number;
    unit_price: number;
    applied_rate_type?: "SR" | "SRA" | "CR";
    discount_percent?: number;
    discount_amount?: number;
    gst_percent?: number;
    remarks?: string;
  }>;
  notes?: string;
};

export type ExtendQuotationValidityPayload = {
  validity_days?: number;
  valid_until?: string;
  reason?: string;
  restore_status?: QuotationStatus;
};

export const leadQuotationsApi = medicaApi.injectEndpoints({
  endpoints: (build) => ({
    listLeadQuotations: build.query<LeadQuotationRecord[], string>({
      query: (leadId) => ({
        url: `/leads/${leadId}/quotations`,
        method: "GET",
      }),
      transformResponse: (raw: ApiEnvelope<LeadQuotationRecord[]>) =>
        unwrapEnvelope(raw) ?? [],
      providesTags: (_res, _err, leadId) => [
        { type: "LeadQuotation", id: `LEAD_${leadId}` },
      ],
    }),

    getLeadQuotation: build.query<LeadQuotationRecord, string>({
      query: (quotationId) => ({
        url: `/leads/quotations/${quotationId}`,
        method: "GET",
      }),
      transformResponse: (raw: ApiEnvelope<LeadQuotationRecord>) =>
        unwrapEnvelope(raw) as LeadQuotationRecord,
      providesTags: (_res, _err, id) => [{ type: "LeadQuotation", id }],
    }),

    createLeadQuotation: build.mutation<
      LeadQuotationRecord,
      { leadId?: string; body: CreateQuotationPayload }
    >({
      query: ({ leadId, body }) =>
        leadId
          ? {
              url: `/leads/${leadId}/quotations`,
              method: "POST",
              body,
            }
          : {
              // Standalone / direct quotation (no lead)
              url: "/quotations",
              method: "POST",
              body,
            },
      transformResponse: (raw: ApiEnvelope<LeadQuotationRecord>) =>
        unwrapEnvelope(raw) as LeadQuotationRecord,
      invalidatesTags: (_res, _err, { leadId }) => [
        { type: "Quotation", id: "LIST" },
        ...(leadId
          ? [
              { type: "LeadQuotation" as const, id: `LEAD_${leadId}` },
              { type: "Lead" as const, id: leadId },
              { type: "Lead" as const, id: "LIST" },
            ]
          : []),
        "Activity",
      ],
    }),

    updateLeadQuotation: build.mutation<
      LeadQuotationRecord,
      { quotationId: string; leadId?: string; body: UpdateQuotationPayload }
    >({
      query: ({ quotationId, body }) => ({
        url: `/leads/quotations/${quotationId}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<LeadQuotationRecord>) =>
        unwrapEnvelope(raw) as LeadQuotationRecord,
      invalidatesTags: (_res, _err, { quotationId, leadId }) => [
        { type: "LeadQuotation", id: quotationId },
        ...(leadId ? [{ type: "LeadQuotation" as const, id: `LEAD_${leadId}` }] : []),
        ...(leadId ? [{ type: "Lead" as const, id: leadId }] : []),
        ...(leadId ? [{ type: "Lead" as const, id: "LIST" }] : []),
        "Activity",
      ],
    }),

    submitLeadQuotationForApproval: build.mutation<
      LeadQuotationRecord,
      { quotationId: string; leadId?: string }
    >({
      query: ({ quotationId }) => ({
        url: `/leads/quotations/${quotationId}/submit-for-approval`,
        method: "POST",
      }),
      transformResponse: (raw: ApiEnvelope<LeadQuotationRecord>) =>
        unwrapEnvelope(raw) as LeadQuotationRecord,
      invalidatesTags: (_res, _err, { quotationId, leadId }) => [
        { type: "LeadQuotation", id: quotationId },
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        ...(leadId ? [{ type: "LeadQuotation" as const, id: `LEAD_${leadId}` }] : []),
        "Activity",
      ],
    }),

    approveLeadQuotation: build.mutation<
      LeadQuotationRecord,
      { quotationId: string; leadId?: string }
    >({
      query: ({ quotationId }) => ({
        url: `/leads/quotations/${quotationId}/approve`,
        method: "POST",
      }),
      transformResponse: (raw: ApiEnvelope<LeadQuotationRecord>) =>
        unwrapEnvelope(raw) as LeadQuotationRecord,
      invalidatesTags: (_res, _err, { quotationId, leadId }) => [
        { type: "LeadQuotation", id: quotationId },
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        ...(leadId ? [{ type: "LeadQuotation" as const, id: `LEAD_${leadId}` }] : []),
        "Activity",
      ],
    }),

    rejectLeadQuotation: build.mutation<
      LeadQuotationRecord,
      { quotationId: string; leadId?: string; reason?: string; rejection_reason?: string }
    >({
      query: ({ quotationId, reason, rejection_reason }) => ({
        url: `/leads/quotations/${quotationId}/reject`,
        method: "POST",
        body: { reason: reason || rejection_reason },
      }),
      transformResponse: (raw: ApiEnvelope<LeadQuotationRecord>) =>
        unwrapEnvelope(raw) as LeadQuotationRecord,
      invalidatesTags: (_res, _err, { quotationId, leadId }) => [
        { type: "LeadQuotation", id: quotationId },
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        ...(leadId ? [{ type: "LeadQuotation" as const, id: `LEAD_${leadId}` }] : []),
        "Activity",
      ],
    }),

    extendQuotationValidity: build.mutation<
      LeadQuotationRecord,
      { quotationId: string; leadId?: string; body: ExtendQuotationValidityPayload }
    >({
      query: ({ quotationId, body }) => ({
        url: `/quotations/${quotationId}/extend-validity`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<LeadQuotationRecord>) =>
        unwrapEnvelope(raw) as LeadQuotationRecord,
      invalidatesTags: (_res, _err, { quotationId, leadId }) => [
        { type: "LeadQuotation", id: quotationId },
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        { type: "Quotation", id: "DASHBOARD_STATS" },
        ...(leadId ? [{ type: "LeadQuotation" as const, id: `LEAD_${leadId}` }] : []),
        ...(leadId ? [{ type: "Lead" as const, id: leadId }] : []),
        "Activity",
      ],
    }),

    convertQuotation: build.mutation<
      { quotation: LeadQuotationRecord; order?: any; party_id?: string },
      { quotationId: string; leadId?: string; body: ConvertQuotationPayload }
    >({
      query: ({ quotationId, body }) => ({
        url: `/quotations/${quotationId}/convert`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<{ quotation: LeadQuotationRecord; order?: any; party_id?: string }>) =>
        unwrapEnvelope(raw) as { quotation: LeadQuotationRecord; order?: any; party_id?: string },
      invalidatesTags: (_res, _err, { quotationId, leadId }) => [
        { type: "LeadQuotation", id: quotationId },
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        "Orders",
        "Parties",
        ...(leadId
          ? [
              { type: "LeadQuotation" as const, id: `LEAD_${leadId}` },
              { type: "Lead" as const, id: leadId },
              { type: "Lead" as const, id: "LIST" },
            ]
          : []),
        "Activity",
      ],
    }),

    getDefaultQuotationTerms: build.query<string[], void>({
      query: () => ({
        url: "/leads/quotations/default-terms",
        method: "GET",
      }),
      transformResponse: (raw: ApiEnvelope<string[]>) =>
        (unwrapEnvelope(raw) as string[]) || [],
      providesTags: ["CompanyInfo"],
    }),

    deleteLeadQuotation: build.mutation<
      { success: boolean },
      { quotationId: string; leadId: string }
    >({
      query: ({ quotationId }) => ({
        url: `/leads/quotations/${quotationId}`,
        method: "DELETE",
      }),
      transformResponse: (raw: ApiEnvelope<{ success: boolean }>) =>
        unwrapEnvelope(raw) as { success: boolean },
      invalidatesTags: (_res, _err, { quotationId, leadId }) => [
        { type: "LeadQuotation", id: quotationId },
        { type: "LeadQuotation", id: `LEAD_${leadId}` },
        { type: "Lead", id: leadId },
        "Activity",
      ],
    }),

    listQuotationFollowUps: build.query<LeadQuotationFollowUp[], string>({
      query: (quotationId) => ({
        url: `/quotations/${quotationId}/follow-ups`,
        method: "GET",
      }),
      transformResponse: (raw: ApiEnvelope<LeadQuotationFollowUp[]>) =>
        unwrapEnvelope(raw) ?? [],
      providesTags: (_res, _err, id) => [
        { type: "LeadQuotation", id: `FOLLOWUPS_${id}` },
        { type: "LeadQuotation", id },
      ],
    }),

    scheduleQuotationFollowUp: build.mutation<
      LeadQuotationFollowUp,
      { quotationId: string; leadId?: string; data: ScheduleQuotationFollowUpPayload }
    >({
      query: ({ quotationId, data }) => ({
        url: `/quotations/${quotationId}/follow-ups`,
        method: "POST",
        body: data,
      }),
      transformResponse: (raw: ApiEnvelope<LeadQuotationFollowUp>) =>
        unwrapEnvelope(raw) as LeadQuotationFollowUp,
      invalidatesTags: (_res, _err, { quotationId, leadId }) => [
        { type: "LeadQuotation", id: `FOLLOWUPS_${quotationId}` },
        { type: "LeadQuotation", id: quotationId },
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        ...(leadId ? [{ type: "LeadQuotation" as const, id: `LEAD_${leadId}` }] : []),
        ...(leadId ? [{ type: "Lead" as const, id: leadId }] : []),
        "Activity",
      ],
    }),

    completeQuotationFollowUp: build.mutation<
      { completed: LeadQuotationFollowUp; next?: LeadQuotationFollowUp },
      { followUpId: string; quotationId: string; leadId?: string; data: CompleteQuotationFollowUpPayload }
    >({
      query: ({ followUpId, data }) => ({
        url: `/quotations/follow-ups/${followUpId}/complete`,
        method: "PATCH",
        body: data,
      }),
      transformResponse: (raw: ApiEnvelope<{ completed: LeadQuotationFollowUp; next?: LeadQuotationFollowUp }>) =>
        unwrapEnvelope(raw) as { completed: LeadQuotationFollowUp; next?: LeadQuotationFollowUp },
      invalidatesTags: (_res, _err, { quotationId, leadId }) => [
        { type: "LeadQuotation", id: `FOLLOWUPS_${quotationId}` },
        { type: "LeadQuotation", id: quotationId },
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        ...(leadId ? [{ type: "LeadQuotation" as const, id: `LEAD_${leadId}` }] : []),
        ...(leadId ? [{ type: "Lead" as const, id: leadId }] : []),
        "Activity",
      ],
    }),

    reviseQuotation: build.mutation<
      LeadQuotationRecord,
      { quotationId: string; leadId?: string }
    >({
      query: ({ quotationId }) => ({
        url: `/quotations/${quotationId}/revise`,
        method: "POST",
      }),
      transformResponse: (raw: ApiEnvelope<LeadQuotationRecord>) =>
        unwrapEnvelope(raw) as LeadQuotationRecord,
      invalidatesTags: (_res, _err, { leadId }) => [
        { type: "Quotation", id: "LIST" },
        ...(leadId
          ? [
              { type: "LeadQuotation" as const, id: `LEAD_${leadId}` },
              { type: "Lead" as const, id: leadId },
            ]
          : []),
        "Activity",
      ],
    }),

    getQuotationVersion: build.query<
      LeadQuotationRecord,
      { quotationId: string; version: number }
    >({
      query: ({ quotationId, version }) => ({
        url: `/quotations/${quotationId}/versions/${version}`,
      }),
      transformResponse: (raw: ApiEnvelope<LeadQuotationRecord>) =>
        unwrapEnvelope(raw) as LeadQuotationRecord,
      providesTags: (_res, _err, { quotationId, version }) => [
        { type: "LeadQuotation", id: `${quotationId}_v${version}` },
      ],
    }),

    compareQuotationVersions: build.query<
      QuotationVersionComparison,
      { quotationId: string; fromVersion: number; toVersion: number }
    >({
      query: ({ quotationId, fromVersion, toVersion }) => ({
        url: `/quotations/${quotationId}/compare?from=${fromVersion}&to=${toVersion}`,
      }),
      transformResponse: (raw: ApiEnvelope<QuotationVersionComparison>) =>
        unwrapEnvelope(raw) as QuotationVersionComparison,
    }),

    getQuotationDashboardStats: build.query<
      {
        total_quotations: number;
        draft_count: number;
        pending_approval_count: number;
        approved_count: number;
        sent_count: number;
        in_negotiation_count: number;
        active_pipeline_count?: number;
        active_pipeline_value?: number;
        accepted_count: number;
        rejected_count: number;
        expired_count?: number;
        total_quoted_value: number;
        total_won_value: number;
        total_discount_value: number;
        total_expired_value?: number;
        avg_discount_percent: number;
        win_rate: number;
      },
      { from?: string; to?: string; startDate?: string; endDate?: string } | void
    >({
      query: (params) => ({
        url: "/quotations/dashboard-stats",
        method: "GET",
        params: params || undefined,
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [
        { type: "Quotation" as const, id: "DASHBOARD_STATS" },
        { type: "Quotation" as const, id: "LIST" },
      ],
    }),

    markQuotationProformaIssued: build.mutation<LeadQuotationRecord, string>({
      query: (quotationId) => ({
        url: `/quotations/${quotationId}/proforma-issued`,
        method: "POST",
      }),
      transformResponse: (raw: ApiEnvelope<LeadQuotationRecord>) =>
        unwrapEnvelope(raw) as LeadQuotationRecord,
      invalidatesTags: (_res, _err, id) => [
        { type: "LeadQuotation", id },
        { type: "Quotation", id },
        { type: "Quotation", id: "LIST" },
        "Activity",
      ],
    }),

    saveQuotationProforma: build.mutation<
      LeadQuotationRecord,
      { quotationId: string; body: LeadQuotationProformaDetails }
    >({
      query: ({ quotationId, body }) => ({
        url: `/quotations/${quotationId}/proforma`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<LeadQuotationRecord>) =>
        unwrapEnvelope(raw) as LeadQuotationRecord,
      invalidatesTags: (_res, _err, { quotationId }) => [
        { type: "LeadQuotation", id: quotationId },
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        "Activity",
      ],
    }),

    // Quotation Analytics & Reports Endpoints
    getQuotationReportSummary: build.query<QuotationReportSummary, QuotationReportQueryParams | void>({
      query: (params) => ({
        url: "/quotations/reports/summary",
        method: "GET",
        params: params || undefined,
      }),
      transformResponse: (raw: ApiEnvelope<QuotationReportSummary>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Quotation" as const, id: "REPORTS_SUMMARY" }],
    }),

    getQuotationReportSalesPerformance: build.query<QuotationSalesPerformanceRep[], QuotationReportQueryParams | void>({
      query: (params) => ({
        url: "/quotations/reports/sales-performance",
        method: "GET",
        params: params || undefined,
      }),
      transformResponse: (raw: ApiEnvelope<QuotationSalesPerformanceRep[]>) =>
        (unwrapEnvelope(raw) as QuotationSalesPerformanceRep[]) || [],
      providesTags: [{ type: "Quotation" as const, id: "REPORTS_PERFORMANCE" }],
    }),

    getQuotationReportMonthlyTrends: build.query<QuotationMonthlyTrend[], QuotationReportQueryParams | void>({
      query: (params) => ({
        url: "/quotations/reports/monthly-trends",
        method: "GET",
        params: params || undefined,
      }),
      transformResponse: (raw: ApiEnvelope<QuotationMonthlyTrend[]>) =>
        (unwrapEnvelope(raw) as QuotationMonthlyTrend[]) || [],
      providesTags: [{ type: "Quotation" as const, id: "REPORTS_TRENDS" }],
    }),

    getQuotationReportProductBreakdown: build.query<QuotationProductPerformance[], QuotationReportQueryParams | void>({
      query: (params) => ({
        url: "/quotations/reports/product-breakdown",
        method: "GET",
        params: params || undefined,
      }),
      transformResponse: (raw: ApiEnvelope<QuotationProductPerformance[]>) =>
        (unwrapEnvelope(raw) as QuotationProductPerformance[]) || [],
      providesTags: [{ type: "Quotation" as const, id: "REPORTS_PRODUCTS" }],
    }),

    getQuotationReportFunnel: build.query<QuotationConversionFunnel, QuotationReportQueryParams | void>({
      query: (params) => ({
        url: "/quotations/reports/funnel",
        method: "GET",
        params: params || undefined,
      }),
      transformResponse: (raw: ApiEnvelope<QuotationConversionFunnel>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Quotation" as const, id: "REPORTS_FUNNEL" }],
    }),
  }),
});

export type QuotationReportSummary = {
  total_quotations: number;
  total_gross_value: number;
  total_discount_value: number;
  total_net_value: number;
  avg_discount_percent: number;
  avg_deal_size: number;
  avg_won_deal_size: number;
  won_deals: {
    count: number;
    value: number;
    win_rate: number;
  };
  converted_orders: {
    count: number;
    value: number;
    conversion_rate: number;
    overall_conversion_rate: number;
  };
  active_negotiations: {
    count: number;
    value: number;
  };
  status_breakdown: Record<string, { count: number; value: number }>;
};

export type QuotationSalesPerformanceRep = {
  user_id?: string | null;
  name: string;
  email: string;
  department: string;
  total_quotations: number;
  total_quoted_value: number;
  total_discount_value: number;
  total_gross_value: number;
  won_count: number;
  won_value: number;
  converted_count: number;
  converted_value: number;
  expired_count: number;
  expired_value: number;
  rejected_count: number;
  rejected_value: number;
  pending_count: number;
  in_negotiation_count: number;
  win_rate: number;
  avg_discount_percent: number;
};

export type QuotationMonthlyTrend = {
  period_key: string;
  period_label: string;
  total_quotations: number;
  total_quoted_value: number;
  won_count: number;
  won_value: number;
  converted_count: number;
  converted_value: number;
  expired_count: number;
  expired_value: number;
  rejected_count: number;
};

export type QuotationProductPerformance = {
  product_name: string;
  hsn_code?: string;
  unit?: string;
  times_quoted: number;
  total_quantity: number;
  total_quoted_value: number;
  total_discount_value: number;
  won_quantity: number;
  won_value: number;
  converted_quantity: number;
  converted_value: number;
  avg_unit_price: number;
};

export type QuotationConversionFunnel = {
  funnel: Array<{
    stage: string;
    key: string;
    count: number;
    value: number;
    percentage: number;
    description: string;
  }>;
  drop_offs: {
    expired: { count: number; value: number };
    rejected: { count: number; value: number };
    on_hold: { count: number; value: number };
  };
};

export type QuotationReportQueryParams = {
  from?: string;
  to?: string;
  startDate?: string;
  endDate?: string;
  period?: "today" | "this_week" | "this_month" | "last_month" | "this_quarter" | "this_year" | "all_time" | string;
  sales_person?: string;
  status?: string;
};

export const {
  useListLeadQuotationsQuery,
  useGetLeadQuotationQuery,
  useGetDefaultQuotationTermsQuery,
  useCreateLeadQuotationMutation,
  useUpdateLeadQuotationMutation,
  useSubmitLeadQuotationForApprovalMutation,
  useApproveLeadQuotationMutation,
  useRejectLeadQuotationMutation,
  useExtendQuotationValidityMutation,
  useConvertQuotationMutation,
  useMarkQuotationProformaIssuedMutation,
  useSaveQuotationProformaMutation,
  useDeleteLeadQuotationMutation,
  useListQuotationFollowUpsQuery,
  useScheduleQuotationFollowUpMutation,
  useCompleteQuotationFollowUpMutation,
  useReviseQuotationMutation,
  useGetQuotationVersionQuery,
  useLazyGetQuotationVersionQuery,
  useCompareQuotationVersionsQuery,
  useLazyCompareQuotationVersionsQuery,
  useGetQuotationDashboardStatsQuery,
  useGetQuotationReportSummaryQuery,
  useGetQuotationReportSalesPerformanceQuery,
  useGetQuotationReportMonthlyTrendsQuery,
  useGetQuotationReportProductBreakdownQuery,
  useGetQuotationReportFunnelQuery,
} = leadQuotationsApi;

