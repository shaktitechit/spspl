/**
 * @fileoverview RTK Query API slice for Quotations module (/api/quotations).
 * @module store/api/slices/quotationsApi
 */
import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";
import type {
  QuotationStatus,
  LeadQuotationItem,
  LeadQuotationRecord,
  CreateQuotationPayload,
  UpdateQuotationPayload,
} from "./leadQuotationsApi";

export type QuotationItem = LeadQuotationItem;
export type QuotationRecord = LeadQuotationRecord;

export type ListQuotationsQueryParams = {
  lead?: string;
  unlinked?: boolean | string;
  status?: string;
  search?: string;
  department?: string;
  scope?: string;
  page?: number;
  limit?: number | "all";
  all?: boolean | string;
  paginate?: boolean | string;
  validity?: string;
  lead_source?: string;
  min_amount?: string | number;
  max_amount?: string | number;
  from_date?: string;
  to_date?: string;
  signatory?: string;
  primary_rep?: string;
  secondary_rep?: string;
  created_by?: string;
};

export type ListQuotationsResponse = Array<QuotationRecord> & {
  quotations: QuotationRecord[];
  items: QuotationRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export const quotationsApi = medicaApi.injectEndpoints({
  endpoints: (build) => ({
    listQuotations: build.query<ListQuotationsResponse, ListQuotationsQueryParams | void>({
      query: (params) => ({
        url: "/quotations",
        method: "GET",
        params: params || undefined,
      }),
      transformResponse: (raw: any): ListQuotationsResponse => {
        const rawData = raw && typeof raw === "object" && "data" in raw ? raw.data : raw;
        const list: QuotationRecord[] = Array.isArray(rawData)
          ? rawData
          : (rawData as any)?.quotations || (rawData as any)?.items || [];
        const rawPagination = raw?.pagination || (rawData as any)?.pagination;

        const total = typeof rawPagination?.total === "number" ? rawPagination.total : list.length;
        const page = typeof rawPagination?.page === "number" ? rawPagination.page : 1;
        const limit = typeof rawPagination?.limit === "number" ? rawPagination.limit : (list.length || 10);
        const totalPages =
          typeof rawPagination?.totalPages === "number"
            ? rawPagination.totalPages
            : Math.max(1, Math.ceil(total / (limit || 10)));

        const paginationObj = { total, page, limit, totalPages };

        const result: any = [...list];
        result.quotations = list;
        result.items = list;
        result.pagination = paginationObj;
        result.total = total;
        result.page = page;
        result.limit = limit;
        result.totalPages = totalPages;

        return result as ListQuotationsResponse;
      },
      providesTags: (result) =>
        result && Array.isArray(result)
          ? [
              ...result.map(({ _id }) => ({ type: "Quotation" as const, id: _id })),
              { type: "Quotation", id: "LIST" },
            ]
          : [{ type: "Quotation", id: "LIST" }],
    }),

    getQuotation: build.query<QuotationRecord, string>({
      query: (quotationId) => ({
        url: `/quotations/${quotationId}`,
        method: "GET",
      }),
      transformResponse: (raw: ApiEnvelope<QuotationRecord>) =>
        unwrapEnvelope(raw) as QuotationRecord,
      providesTags: (_res, _err, id) => [{ type: "Quotation", id }],
    }),

    createQuotation: build.mutation<QuotationRecord, CreateQuotationPayload & { lead?: string }>({
      query: (body) => ({
        url: "/quotations",
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<QuotationRecord>) =>
        unwrapEnvelope(raw) as QuotationRecord,
      invalidatesTags: (_res, _err, payload) => [
        { type: "Quotation", id: "LIST" },
        { type: "LeadQuotation", id: `LEAD_${payload.lead}` },
        ...(payload.lead ? [{ type: "Lead" as const, id: payload.lead }] : []),
        { type: "Lead", id: "LIST" },
        "Activity",
      ],
    }),

    updateQuotation: build.mutation<
      QuotationRecord,
      { quotationId: string; body: UpdateQuotationPayload & { lead?: string } }
    >({
      query: ({ quotationId, body }) => ({
        url: `/quotations/${quotationId}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<QuotationRecord>) =>
        unwrapEnvelope(raw) as QuotationRecord,
      invalidatesTags: (_res, _err, { quotationId, body }) => [
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        { type: "LeadQuotation", id: quotationId },
        ...(body.lead ? [{ type: "Lead" as const, id: body.lead }] : []),
        "Activity",
      ],
    }),

    submitQuotationForApproval: build.mutation<QuotationRecord, { quotationId: string }>({
      query: ({ quotationId }) => ({
        url: `/quotations/${quotationId}/submit-for-approval`,
        method: "POST",
      }),
      transformResponse: (raw: ApiEnvelope<QuotationRecord>) =>
        unwrapEnvelope(raw) as QuotationRecord,
      invalidatesTags: (_res, _err, { quotationId }) => [
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        { type: "LeadQuotation", id: quotationId },
        "Activity",
      ],
    }),

    approveQuotation: build.mutation<QuotationRecord, { quotationId: string }>({
      query: ({ quotationId }) => ({
        url: `/quotations/${quotationId}/approve`,
        method: "POST",
      }),
      transformResponse: (raw: ApiEnvelope<QuotationRecord>) =>
        unwrapEnvelope(raw) as QuotationRecord,
      invalidatesTags: (_res, _err, { quotationId }) => [
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        { type: "LeadQuotation", id: quotationId },
        "Activity",
      ],
    }),

    rejectQuotation: build.mutation<
      QuotationRecord,
      { quotationId: string; reason?: string; rejection_reason?: string }
    >({
      query: ({ quotationId, reason, rejection_reason }) => ({
        url: `/quotations/${quotationId}/reject`,
        method: "POST",
        body: { reason: reason || rejection_reason },
      }),
      transformResponse: (raw: ApiEnvelope<QuotationRecord>) =>
        unwrapEnvelope(raw) as QuotationRecord,
      invalidatesTags: (_res, _err, { quotationId }) => [
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        { type: "LeadQuotation", id: quotationId },
        "Activity",
      ],
    }),

    getQuotationsDefaultTerms: build.query<string[], void>({
      query: () => ({
        url: "/quotations/default-terms",
        method: "GET",
      }),
      transformResponse: (raw: ApiEnvelope<string[]>) =>
        (unwrapEnvelope(raw) as string[]) || [],
      providesTags: ["CompanyInfo"],
    }),

    deleteQuotation: build.mutation<
      { success: boolean },
      { quotationId: string; leadId?: string }
    >({
      query: ({ quotationId }) => ({
        url: `/quotations/${quotationId}`,
        method: "DELETE",
      }),
      transformResponse: (raw: ApiEnvelope<{ success: boolean }>) =>
        unwrapEnvelope(raw) as { success: boolean },
      invalidatesTags: (_res, _err, { quotationId, leadId }) => [
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        { type: "LeadQuotation", id: quotationId },
        ...(leadId ? [{ type: "Lead" as const, id: leadId }] : []),
        "Activity",
      ],
    }),

    linkQuotation: build.mutation<
      { quotation: QuotationRecord; lead: any },
      { quotationId: string; leadId: string }
    >({
      query: ({ quotationId, leadId }) => ({
        url: `/quotations/${quotationId}/link-lead`,
        method: "POST",
        body: { lead_id: leadId },
      }),
      transformResponse: (raw: ApiEnvelope<{ quotation: QuotationRecord; lead: any }>) =>
        unwrapEnvelope(raw),
      invalidatesTags: (_res, _err, { quotationId, leadId }) => [
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        { type: "LeadQuotation", id: quotationId },
        { type: "LeadQuotation", id: `LEAD_${leadId}` },
        { type: "Lead", id: leadId },
        { type: "Lead", id: "LIST" },
        "Activity",
      ],
    }),

    unlinkQuotation: build.mutation<
      { quotation: QuotationRecord },
      { quotationId: string; leadId?: string }
    >({
      query: ({ quotationId }) => ({
        url: `/quotations/${quotationId}/unlink-lead`,
        method: "POST",
      }),
      transformResponse: (raw: ApiEnvelope<{ quotation: QuotationRecord }>) =>
        unwrapEnvelope(raw),
      invalidatesTags: (_res, _err, { quotationId, leadId }) => [
        { type: "Quotation", id: quotationId },
        { type: "Quotation", id: "LIST" },
        { type: "LeadQuotation", id: quotationId },
        ...(leadId ? [{ type: "LeadQuotation" as const, id: `LEAD_${leadId}` }] : []),
        ...(leadId ? [{ type: "Lead" as const, id: leadId }] : []),
        { type: "Lead", id: "LIST" },
        "Activity",
      ],
    }),
  }),
});

export const {
  useListQuotationsQuery,
  useLazyListQuotationsQuery,
  useGetQuotationQuery,
  useCreateQuotationMutation,
  useUpdateQuotationMutation,
  useSubmitQuotationForApprovalMutation,
  useApproveQuotationMutation,
  useRejectQuotationMutation,
  useDeleteQuotationMutation,
  useGetQuotationsDefaultTermsQuery,
  useLinkQuotationMutation,
  useUnlinkQuotationMutation,
} = quotationsApi;
