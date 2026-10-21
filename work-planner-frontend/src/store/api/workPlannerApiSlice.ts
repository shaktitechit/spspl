import { baseApi } from "./baseApi";
import { WORK_PLANNER_SERVICE_URL } from "@/lib/env";
import type {
  DayEndDraftResponse,
  DayEndPayload,
  WorkPlanDayEndAttachment,
  WorkPlanExpenseRecord,
  WorkPlanRecord,
  WorkPlannerStats,
  SeniorRemarkFeedItem,
  SeniorRemarksStats,
  UserNoteRecord,
  UserNoteKpis,
  BulkConvertToWorkPlanPayload,
  MarkNotesConvertedPayload,
  WorkPlanTourAdvanceRecord,
  WorkPlanExpenseSettlementRecord,
  ExecutiveBalanceItem,
  ExecutivePassbookData,
  ExpenseKpiSummaryData,
  UserEmailPreferences,
} from "@/types/workPlanner";

function normalizePaginatedResponse<T>(res: any): {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
} {
  if (!res) {
    return { data: [], total: 0, page: 1, limit: 50, pages: 1 };
  }

  // Handle nested standard express wrapper res = { success: true, data: { total, page, limit, pages, data: [...] } }
  const payload = res.data !== undefined && res.success !== undefined ? res.data : res;

  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.data)) {
      const total = payload.total ?? payload.data.length;
      const limit = payload.limit ?? 50;
      return {
        data: payload.data,
        total,
        page: payload.page ?? 1,
        limit,
        pages: payload.pages ?? (limit > 0 ? Math.ceil(total / limit) : 1),
      };
    }
    if (Array.isArray(payload)) {
      return {
        data: payload,
        total: payload.length,
        page: 1,
        limit: payload.length || 50,
        pages: 1,
      };
    }
  }

  if (Array.isArray(res)) {
    return {
      data: res,
      total: res.length,
      page: 1,
      limit: res.length || 50,
      pages: 1,
    };
  }

  return { data: [], total: 0, page: 1, limit: 50, pages: 1 };
}

export const workPlannerApiSlice = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getPlans: builder.query<
      { data: WorkPlanRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | boolean | undefined> | void
    >({
      query: (params) => {
        const query = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") query.append(k, String(v));
          });
        }
        return `${WORK_PLANNER_SERVICE_URL}/api/work-planner?${query.toString()}`;
      },
      transformResponse: (res: any) => normalizePaginatedResponse<WorkPlanRecord>(res),
      providesTags: (result) => {
        const list = Array.isArray(result?.data) ? result.data : [];
        return [
          ...list.map(({ _id, id }) => ({ type: "WorkPlan" as const, id: _id || id })),
          { type: "WorkPlan", id: "LIST" },
        ];
      },
    }),
    getStats: builder.query<WorkPlannerStats, Record<string, string | number | undefined> | void>({
      query: (params) => {
        const query = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") query.append(k, String(v));
          });
        }
        return `${WORK_PLANNER_SERVICE_URL}/api/work-planner/stats?${query.toString()}`;
      },
      transformResponse: (res: any) => res.data || res,
      providesTags: ["WorkPlannerStats"],
    }),
    getPlan: builder.query<WorkPlanRecord, string>({
      query: (id) => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${id}`,
      transformResponse: (res: any) => res.data || res,
      providesTags: (_result, _error, id) => [{ type: "WorkPlan", id }],
    }),
    createPlan: builder.mutation<WorkPlanRecord, Partial<WorkPlanRecord>>({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner`,
        method: "POST",
        body,
      }),
      transformResponse: (res: any) => res.data || res,
      invalidatesTags: [{ type: "WorkPlan", id: "LIST" }, "WorkPlannerStats"],
    }),
    updatePlan: builder.mutation<WorkPlanRecord, { id: string; body: Partial<WorkPlanRecord> }>({
      query: ({ id, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: any) => res.data || res,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "WorkPlan", id },
        { type: "WorkPlan", id: "LIST" },
        "WorkPlannerStats",
      ],
    }),
    deletePlan: builder.mutation<WorkPlanRecord, string>({
      query: (id) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${id}`,
        method: "DELETE",
      }),
      transformResponse: (res: any) => res.data || res,
      invalidatesTags: [{ type: "WorkPlan", id: "LIST" }, "WorkPlan", "UserNotes", "WorkPlannerStats"],
    }),
    submitPlan: builder.mutation<WorkPlanRecord, { id: string; body?: any } | string>({
      query: (arg) => {
        const id = typeof arg === "string" ? arg : arg.id;
        const body = typeof arg === "string" ? undefined : arg.body;
        return {
          url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${id}/submit`,
          method: "POST",
          body,
        };
      },
      transformResponse: (res: any) => res.data || res,
      invalidatesTags: (_result, _error, arg) => {
        const id = typeof arg === "string" ? arg : arg.id;
        return [{ type: "WorkPlan", id }, { type: "WorkPlan", id: "LIST" }, "WorkPlannerStats"];
      },
    }),
    approvePlan: builder.mutation<WorkPlanRecord, string>({
      query: (id) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${id}/approve`,
        method: "POST",
      }),
      transformResponse: (res: any) => res.data || res,
      invalidatesTags: (_result, _error, id) => [{ type: "WorkPlan", id }, { type: "WorkPlan", id: "LIST" }, "WorkPlannerStats"],
    }),
    rejectPlan: builder.mutation<WorkPlanRecord, { id: string; rejection_reason: string }>({
      query: ({ id, rejection_reason }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${id}/reject`,
        method: "POST",
        body: { rejection_reason },
      }),
      transformResponse: (res: any) => res.data || res,
      invalidatesTags: (_result, _error, { id }) => [{ type: "WorkPlan", id }, { type: "WorkPlan", id: "LIST" }, "WorkPlannerStats"],
    }),
    completePlan: builder.mutation<
      WorkPlanRecord,
      string | { id: string; body?: DayEndPayload }
    >({
      query: (arg) => {
        const id = typeof arg === "string" ? arg : arg.id;
        const body = typeof arg === "string" ? undefined : arg.body;
        return {
          url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${id}/complete`,
          method: "POST",
          body,
        };
      },
      transformResponse: (res: any) => res.data || res,
      invalidatesTags: (_result, _error, arg) => {
        const id = typeof arg === "string" ? arg : arg.id;
        return [{ type: "WorkPlan", id }, { type: "WorkPlan", id: "LIST" }, "WorkPlannerStats"];
      },
    }),
    getDayEndDraft: builder.query<DayEndDraftResponse, string>({
      query: (id) => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${id}/day-end-draft`,
      transformResponse: (res: any) => res.data || res,
      providesTags: (_result, _error, id) => [{ type: "WorkPlan", id }],
    }),
    uploadWorkPlanAttachment: builder.mutation<WorkPlanDayEndAttachment, FormData>({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/attachments/upload`,
        method: "POST",
        body,
      }),
      transformResponse: (res: any) => res.data || res,
    }),
    // Visits
    addVisit: builder.mutation<WorkPlanRecord, { planId: string; body: unknown }>({
      query: ({ planId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/visits`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "WorkPlannerStats"],
    }),
    updateVisit: builder.mutation<WorkPlanRecord, { planId: string; visitId: string; body: unknown }>({
      query: ({ planId, visitId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/visits/${visitId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "WorkPlannerStats"],
    }),
    removeVisit: builder.mutation<WorkPlanRecord, { planId: string; visitId: string }>({
      query: ({ planId, visitId }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/visits/${visitId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { planId }) => [
        { type: "WorkPlan", id: planId },
        "WorkPlan",
        "UserNotes",
        "WorkPlannerStats",
      ],
    }),
    checkIn: builder.mutation<WorkPlanRecord, { planId: string; visitId: string; body?: unknown }>({
      query: ({ planId, visitId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/visits/${visitId}/check-in`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "WorkPlannerStats"],
    }),
    checkOut: builder.mutation<WorkPlanRecord, { planId: string; visitId: string; body?: unknown }>({
      query: ({ planId, visitId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/visits/${visitId}/check-out`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "WorkPlannerStats"],
    }),
    completeVisit: builder.mutation<WorkPlanRecord, { planId: string; visitId: string; body: unknown }>({
      query: ({ planId, visitId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/visits/${visitId}/complete`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "WorkPlannerStats"],
    }),
    scheduleNextVisit: builder.mutation<WorkPlanRecord, { planId: string; visitId: string; plan_date: string }>({
      query: ({ planId, visitId, plan_date }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/visits/${visitId}/schedule-next`,
        method: "POST",
        body: { plan_date },
      }),
      invalidatesTags: [{ type: "WorkPlan", id: "LIST" }, "WorkPlannerStats"],
    }),
    // Standalone Visits
    addStandaloneVisit: builder.mutation<any, { body: unknown }>({
      query: ({ body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/standalone-visits`,
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "WorkPlan", id: "LIST" }, "WorkPlannerStats"],
    }),
    updateStandaloneVisit: builder.mutation<any, { visitId: string; body: unknown }>({
      query: ({ visitId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/standalone-visits/${visitId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: [{ type: "WorkPlan", id: "LIST" }, "WorkPlannerStats"],
    }),
    removeStandaloneVisit: builder.mutation<any, { visitId: string }>({
      query: ({ visitId }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/standalone-visits/${visitId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "WorkPlan", id: "LIST" }, "WorkPlannerStats"],
    }),
    // Standalone Works
    addStandaloneWork: builder.mutation<any, { body: unknown }>({
      query: ({ body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/standalone-works`,
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "WorkPlan", id: "LIST" }, "WorkPlannerStats"],
    }),
    updateStandaloneWork: builder.mutation<any, { workId: string; body: unknown }>({
      query: ({ workId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/standalone-works/${workId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: [{ type: "WorkPlan", id: "LIST" }, "WorkPlannerStats"],
    }),
    removeStandaloneWork: builder.mutation<any, { workId: string }>({
      query: ({ workId }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/standalone-works/${workId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "WorkPlan", id: "LIST" }, "WorkPlannerStats"],
    }),
    // Works
    addWork: builder.mutation<WorkPlanRecord, { planId: string; body: unknown }>({
      query: ({ planId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/works`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "WorkPlannerStats"],
    }),
    updateWork: builder.mutation<WorkPlanRecord, { planId: string; workId: string; body: unknown }>({
      query: ({ planId, workId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/works/${workId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "WorkPlannerStats"],
    }),
    removeWork: builder.mutation<WorkPlanRecord, { planId: string; workId: string }>({
      query: ({ planId, workId }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/works/${workId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { planId }) => [
        { type: "WorkPlan", id: planId },
        "WorkPlan",
        "UserNotes",
        "WorkPlannerStats",
      ],
    }),
    // Expenses
    getExpenses: builder.query<
      { data: WorkPlanExpenseRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => {
        const query = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") query.append(k, String(v));
          });
        }
        return `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses?${query.toString()}`;
      },
      transformResponse: (res: any) => normalizePaginatedResponse<WorkPlanExpenseRecord>(res),
      providesTags: (result) => {
        const list = Array.isArray(result?.data) ? result.data : [];
        return [
          ...list.map(({ _id, id }) => ({ type: "Expense" as const, id: _id || id })),
          "Expense",
        ];
      },
    }),
    addExpense: builder.mutation<WorkPlanRecord, { planId: string; body: unknown }>({
      query: ({ planId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/expenses`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "Expense", "WorkPlannerStats"],
    }),
    updateExpense: builder.mutation<WorkPlanRecord, { planId: string; expenseId: string; body: unknown }>({
      query: ({ planId, expenseId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/expenses/${expenseId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "Expense", "WorkPlannerStats"],
    }),
    removeExpense: builder.mutation<WorkPlanRecord, { planId: string; expenseId: string }>({
      query: ({ planId, expenseId }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/expenses/${expenseId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "Expense", "WorkPlannerStats"],
    }),
    submitExpense: builder.mutation<WorkPlanRecord, { planId: string; expenseId: string }>({
      query: ({ planId, expenseId }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/expenses/${expenseId}/submit`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "Expense", "WorkPlannerStats"],
    }),
    approveExpense: builder.mutation<WorkPlanRecord, { planId: string; expenseId: string }>({
      query: ({ planId, expenseId }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/expenses/${expenseId}/approve`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "Expense", "WorkPlannerStats"],
    }),
    rejectExpense: builder.mutation<WorkPlanRecord, { planId: string; expenseId: string; rejection_reason: string }>({
      query: ({ planId, expenseId, rejection_reason }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/expenses/${expenseId}/reject`,
        method: "POST",
        body: { rejection_reason },
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "Expense", "WorkPlannerStats"],
    }),
    submitAllExpenses: builder.mutation<WorkPlanRecord, { planId: string }>({
      query: ({ planId }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/expenses/submit-all`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "Expense", "WorkPlannerStats"],
    }),
    approveAllExpenses: builder.mutation<WorkPlanRecord, { planId: string }>({
      query: ({ planId }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/expenses/approve-all`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "Expense", "WorkPlannerStats"],
    }),
    rejectAllExpenses: builder.mutation<WorkPlanRecord, { planId: string; rejection_reason: string }>({
      query: ({ planId, rejection_reason }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/expenses/reject-all`,
        method: "POST",
        body: { rejection_reason },
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "Expense", "WorkPlannerStats"],
    }),
    uploadExpenseReceipt: builder.mutation<any, FormData>({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/upload`,
        method: "POST",
        body,
      }),
      transformResponse: (res: any) => res.data || res,
    }),
    getExpenseKpis: builder.query<ExpenseKpiSummaryData, Record<string, string | number | undefined> | void>({
      query: (params) => {
        const query = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") query.append(k, String(v));
          });
        }
        return `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/kpi-summary?${query.toString()}`;
      },
      transformResponse: (res: any) => res.data || res,
      providesTags: ["Expense", "TourAdvance", "ExpenseSettlement", "ExecutiveBalance"],
    }),
    getTourAdvances: builder.query<
      { data: WorkPlanTourAdvanceRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => {
        const query = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") query.append(k, String(v));
          });
        }
        return `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/advances?${query.toString()}`;
      },
      transformResponse: (res: any) => normalizePaginatedResponse<WorkPlanTourAdvanceRecord>(res),
      providesTags: (result) => {
        const list = Array.isArray(result?.data) ? result.data : [];
        return [
          ...list.map(({ _id, id }) => ({ type: "TourAdvance" as const, id: _id || id })),
          "TourAdvance",
        ];
      },
    }),
    requestTourAdvance: builder.mutation<
      WorkPlanTourAdvanceRecord,
      {
        amount: number;
        purpose: string;
        notes?: string;
        work_plan?: string;
        request_date?: string;
        attachments?: string[];
        attachment_details?: any[];
        sales_user?: string;
      }
    >({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/advances`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["TourAdvance", "ExecutiveBalance", "ExecutivePassbook", "WorkPlannerStats"],
    }),
    issueDirectTourAdvance: builder.mutation<
      WorkPlanTourAdvanceRecord,
      {
        sales_user: string;
        amount: number;
        purpose: string;
        request_date?: string;
        notes?: string;
        payment_method?: string;
        transaction_reference?: string;
        bank_name?: string;
        disbursement_notes?: string;
        attachments?: string[];
        attachment_details?: any[];
        disbursement_attachments?: string[];
        disbursement_attachment_details?: any[];
      }
    >({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/advances/issue`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["TourAdvance", "ExecutiveBalance", "ExecutivePassbook", "WorkPlannerStats"],
    }),
    approveTourAdvance: builder.mutation<WorkPlanTourAdvanceRecord, { advanceId: string }>({
      query: ({ advanceId }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/advances/${advanceId}/approve`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { advanceId }) => [
        { type: "TourAdvance", id: advanceId },
        "TourAdvance",
        "ExecutiveBalance",
        "ExecutivePassbook",
      ],
    }),
    rejectTourAdvance: builder.mutation<WorkPlanTourAdvanceRecord, { advanceId: string; rejection_reason: string }>({
      query: ({ advanceId, rejection_reason }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/advances/${advanceId}/reject`,
        method: "POST",
        body: { rejection_reason },
      }),
      invalidatesTags: (_result, _error, { advanceId }) => [
        { type: "TourAdvance", id: advanceId },
        "TourAdvance",
        "ExecutiveBalance",
      ],
    }),
    disburseTourAdvance: builder.mutation<
      WorkPlanTourAdvanceRecord,
      {
        advanceId: string;
        disbursed_amount?: number;
        payment_method: string;
        transaction_reference?: string;
        bank_name?: string;
        disbursement_notes?: string;
        attachments?: string[];
        attachment_details?: any[];
        disbursement_attachments?: string[];
        disbursement_attachment_details?: any[];
      }
    >({
      query: ({ advanceId, ...body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/advances/${advanceId}/disburse`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { advanceId }) => [
        { type: "TourAdvance", id: advanceId },
        "TourAdvance",
        "ExecutiveBalance",
        "ExecutivePassbook",
      ],
    }),
    refundTourAdvance: builder.mutation<
      WorkPlanTourAdvanceRecord,
      {
        advanceId: string;
        amount: number;
        payment_method?: string;
        transaction_reference?: string;
        notes?: string;
        attachments?: string[];
        attachment_details?: any[];
      }
    >({
      query: ({ advanceId, ...body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/advances/${advanceId}/refund`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { advanceId }) => [
        { type: "TourAdvance", id: advanceId },
        "TourAdvance",
        "ExecutiveBalance",
        "ExecutivePassbook",
      ],
    }),
    uploadExpenseAttachment: builder.mutation<
      any,
      FormData
    >({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/upload`,
        method: "POST",
        body,
      }),
      transformResponse: (res: any) => res.data || res,
    }),
    getActiveTourAdvances: builder.query<{ data: WorkPlanTourAdvanceRecord[]; total_active_balance: number }, { userId?: string } | void>({
      query: (params) => {
        const query = new URLSearchParams();
        if (params?.userId) query.append("userId", params.userId);
        return `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/advances/active?${query.toString()}`;
      },
      transformResponse: (res: any) => res.data || res,
      providesTags: ["TourAdvance"],
    }),
    getExpenseSettlements: builder.query<
      { data: WorkPlanExpenseSettlementRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => {
        const query = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") query.append(k, String(v));
          });
        }
        return `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/settlements?${query.toString()}`;
      },
      transformResponse: (res: any) => normalizePaginatedResponse<WorkPlanExpenseSettlementRecord>(res),
      providesTags: (result) => {
        const list = Array.isArray(result?.data) ? result.data : [];
        return [
          ...list.map(({ _id, id }) => ({ type: "ExpenseSettlement" as const, id: _id || id })),
          "ExpenseSettlement",
        ];
      },
    }),
    getExpenseSettlement: builder.query<WorkPlanExpenseSettlementRecord, string>({
      query: (id) => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/settlements/${id}`,
      transformResponse: (res: any) => res.data || res,
      providesTags: (_result, _error, id) => [{ type: "ExpenseSettlement", id }],
    }),
    createExpenseSettlement: builder.mutation<
      WorkPlanExpenseSettlementRecord,
      {
        sales_user: string;
        settlement_date?: string;
        expense_ids: string[];
        advances?: Array<{ advance_id: string; deducted_amount: number }>;
        direct_payment_amount?: number;
        payment_method?: string;
        transaction_reference?: string;
        bank_name?: string;
        settlement_notes?: string;
        attachments?: string[];
        attachment_details?: any[];
      }
    >({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/settlements`,
        method: "POST",
        body,
      }),
      invalidatesTags: [
        "ExpenseSettlement",
        "Expense",
        "TourAdvance",
        "ExecutiveBalance",
        "ExecutivePassbook",
        "WorkPlan",
        "WorkPlannerStats",
      ],
    }),
    getExecutiveBalances: builder.query<
      { data: ExecutiveBalanceItem[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => {
        const query = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") query.append(k, String(v));
          });
        }
        return `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/balances?${query.toString()}`;
      },
      transformResponse: (res: any) => normalizePaginatedResponse<ExecutiveBalanceItem>(res),
      providesTags: ["ExecutiveBalance"],
    }),
    getExecutivePassbook: builder.query<
      ExecutivePassbookData,
      { userId: string; from_date?: string; to_date?: string }
    >({
      query: ({ userId, from_date, to_date }) => {
        const query = new URLSearchParams();
        if (from_date) query.append("from_date", from_date);
        if (to_date) query.append("to_date", to_date);
        return `${WORK_PLANNER_SERVICE_URL}/api/work-planner/expenses/passbook/${userId}?${query.toString()}`;
      },
      transformResponse: (res: any) => res.data || res,
      providesTags: (_result, _error, { userId }) => [
        { type: "ExecutivePassbook", id: userId },
        "ExecutivePassbook",
      ],
    }),
    getUserSettings: builder.query<any, string>({
      query: (userId) => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/user-settings/${userId}`,
      transformResponse: (res: any) => res.data || res,
      providesTags: (_result, _error, userId) => [{ type: "WorkPlan" as const, id: `USER_SETTINGS_${userId}` }],
    }),
    updateUserSettings: builder.mutation<any, { userId: string; body: any }>({
      query: ({ userId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/user-settings/${userId}`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: any) => res.data || res,
      invalidatesTags: (_result, _error, { userId }) => [{ type: "WorkPlan" as const, id: `USER_SETTINGS_${userId}` }],
    }),
    getUserTasks: builder.query<any, string>({
      query: (userId) => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/user-tasks/${userId}`,
      transformResponse: (res: any) => res.data || res,
      providesTags: (_result, _error, userId) => [{ type: "WorkPlan" as const, id: `USER_TASKS_${userId}` }],
    }),
    updateUserTasks: builder.mutation<any, { userId: string; body: any }>({
      query: ({ userId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/user-tasks/${userId}`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: any) => res.data || res,
      invalidatesTags: (_result, _error, { userId }) => [
        { type: "WorkPlan" as const, id: `USER_TASKS_${userId}` },
        { type: "WorkPlan" as const, id: "USER_TASKS_SUMMARY" },
      ],
    }),
    getUserTasksSummary: builder.query<Record<string, { count: number; defaultCount: number; updatedAt?: string }>, void>({
      query: () => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/user-tasks/summary`,
      transformResponse: (res: any) => res.data || res,
      providesTags: [{ type: "WorkPlan" as const, id: "USER_TASKS_SUMMARY" }],
    }),
    getUserVisitTemplate: builder.query<any, string>({
      query: (userId) => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/user-visit-template/${userId}`,
      transformResponse: (res: any) => res.data || res,
      providesTags: (_result, _error, userId) => [{ type: "WorkPlan" as const, id: `USER_VISIT_TEMPLATE_${userId}` }],
    }),
    updateUserVisitTemplate: builder.mutation<any, { userId: string; body: any }>({
      query: ({ userId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/user-visit-template/${userId}`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: any) => res.data || res,
      invalidatesTags: (_result, _error, { userId }) => [
        { type: "WorkPlan" as const, id: `USER_VISIT_TEMPLATE_${userId}` },
        { type: "WorkPlan" as const, id: "USER_VISIT_TEMPLATES_SUMMARY" },
      ],
    }),
    getUserVisitTemplatesSummary: builder.query<Record<string, { hasTemplate: boolean; createCount: number; outcomeCount: number; updatedAt?: string }>, void>({
      query: () => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/user-visit-templates/summary`,
      transformResponse: (res: any) => res.data || res,
      providesTags: [{ type: "WorkPlan" as const, id: "USER_VISIT_TEMPLATES_SUMMARY" }],
    }),
    getTeamTree: builder.query<any, void>({
      query: () => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/team/tree`,
      transformResponse: (res: any) => res.data || res,
      providesTags: ["WorkPlannerTeam"],
    }),
    getMyTeam: builder.query<any, void>({
      query: () => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/team/my-team`,
      transformResponse: (res: any) => res.data || res,
      providesTags: ["WorkPlannerTeam"],
    }),
    getTeamMembers: builder.query<any, void>({
      query: () => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/team/members`,
      transformResponse: (res: any) => res.data || res,
      providesTags: ["WorkPlannerTeam"],
    }),
    getEligibleManagers: builder.query<any[], void>({
      query: () => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/eligible-managers`,
      transformResponse: (res: any) => res.data || [],
      providesTags: ["WorkPlannerTeam"],
    }),
    upsertTeamEdge: builder.mutation<any, { subordinate: string; manager: string }>({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/team/edges`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: any) => res.data || res,
      invalidatesTags: (_result, _error, arg) => [
        "WorkPlannerTeam",
        { type: "WorkPlan" as const, id: `USER_SETTINGS_${arg.subordinate}` },
      ],
    }),
    removeTeamEdge: builder.mutation<any, string | { subordinateId: string; managerId?: string }>({
      query: (arg) => {
        const subordinateId = typeof arg === "string" ? arg : arg.subordinateId;
        const managerId = typeof arg === "object" ? arg.managerId : undefined;
        return {
          url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/team/edges/${subordinateId}${
            managerId ? `?manager=${encodeURIComponent(managerId)}` : ""
          }`,
          method: "DELETE",
        };
      },
      transformResponse: (res: any) => res.data || res,
      invalidatesTags: (_result, _error, arg) => {
        const subordinateId = typeof arg === "string" ? arg : arg.subordinateId;
        return [
          "WorkPlannerTeam",
          { type: "WorkPlan" as const, id: `USER_SETTINGS_${subordinateId}` },
        ];
      },
    }),
    addWorkPlanAuthorityRemark: builder.mutation<WorkPlanRecord, { planId: string; body: { manager_remarks: string } }>({
      query: ({ planId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/authority-remarks`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "WorkPlannerStats"],
    }),
    addVisitAuthorityRemark: builder.mutation<WorkPlanRecord, { planId: string; visitId: string; body: { manager_remarks: string } }>({
      query: ({ planId, visitId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/visits/${visitId}/authority-remarks`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "WorkPlannerStats"],
    }),
    addWorkAuthorityRemark: builder.mutation<WorkPlanRecord, { planId: string; workId: string; body: { manager_remarks: string } }>({
      query: ({ planId, workId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/works/${workId}/authority-remarks`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "WorkPlannerStats"],
    }),
    addExpenseAuthorityRemark: builder.mutation<any, { planId: string; expenseId: string; body: { manager_remarks: string; remark?: string; remark_type?: string; priority?: string; expected_followup_date?: string } }>({
      query: ({ planId, expenseId, body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/${planId}/expenses/${expenseId}/authority-remarks`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { planId }) => [{ type: "WorkPlan", id: planId }, "Expense", "SeniorRemarks", "WorkPlannerStats"],
    }),
    getCaliberAnalytics: builder.query<
      any,
      { sales_user?: string; user_id?: string; from?: string; to?: string; plan_id?: string; force?: boolean } | void
    >({
      query: (params) => {
        const query = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") query.append(k, String(v));
          });
        }
        return `${WORK_PLANNER_SERVICE_URL}/api/work-planner/analytics/caliber?${query.toString()}`;
      },
      transformResponse: (res: any) => res.data || res,
      providesTags: ["WorkPlanAnalytics"],
    }),
    regenerateCaliberAnalytics: builder.mutation<
      any,
      { sales_user?: string; user_id?: string; from?: string; to?: string; plan_id?: string }
    >({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/analytics/caliber/regenerate`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["WorkPlanAnalytics"],
    }),
    getSinglePlanAiAnalysis: builder.query<any, { planId: string; force?: boolean }>({
      query: ({ planId, force }) =>
        `${WORK_PLANNER_SERVICE_URL}/api/work-planner/analytics/plan/${planId}/ai-analysis${force ? "?force=true" : ""}`,
      transformResponse: (res: any) => res.data || res,
      providesTags: (_result, _error, { planId }) => [{ type: "WorkPlanAiAnalysis", id: planId }],
    }),
    getTeamAnalyticsOverview: builder.query<any[], { from?: string; to?: string } | void>({
      query: (params) => {
        const query = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") query.append(k, String(v));
          });
        }
        return `${WORK_PLANNER_SERVICE_URL}/api/work-planner/analytics/team-overview?${query.toString()}`;
      },
      transformResponse: (res: any) => res.data || res,
      providesTags: ["WorkPlanTeamAnalytics"],
    }),
    getWorkPlanDraft: builder.query<any, { sales_user?: string; plan_date: string }>({
      query: ({ sales_user, plan_date }) => {
        const query = new URLSearchParams();
        if (sales_user) query.append("sales_user", sales_user);
        if (plan_date) query.append("plan_date", plan_date);
        return `${WORK_PLANNER_SERVICE_URL}/api/work-planner/drafts?${query.toString()}`;
      },
      transformResponse: (res: any) => res.data || res,
      providesTags: ["WorkPlanDraft"],
    }),
    saveWorkPlanDraft: builder.mutation<any, Record<string, any>>({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/drafts`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: any) => res.data || res,
      invalidatesTags: ["WorkPlanDraft"],
    }),
    deleteWorkPlanDraft: builder.mutation<any, { sales_user?: string; plan_date: string }>({
      query: ({ sales_user, plan_date }) => {
        const query = new URLSearchParams();
        if (sales_user) query.append("sales_user", sales_user);
        if (plan_date) query.append("plan_date", plan_date);
        return {
          url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/drafts?${query.toString()}`,
          method: "DELETE",
        };
      },
      invalidatesTags: ["WorkPlanDraft"],
    }),
    getSeniorRemarksFeed: builder.query<
      { items: SeniorRemarkFeedItem[]; stats: SeniorRemarksStats },
      Record<string, any> | void
    >({
      query: (params) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/senior-remarks`,
        params: params || {},
      }),
      transformResponse: (res: any) => {
        const payload = res?.data !== undefined ? res.data : res;
        const stats = res?.stats || {
          total: Array.isArray(payload) ? payload.length : 0,
          appreciation_count: 0,
          objection_count: 0,
          instruction_count: 0,
          pending_response_count: 0,
          responded_count: 0,
          resolved_count: 0,
        };
        return {
          items: Array.isArray(payload) ? payload : [],
          stats,
        };
      },
      providesTags: ["SeniorRemarks", "WorkPlan"],
    }),
    addJuniorFollowup: builder.mutation<
      { success: boolean; remark: any },
      {
        target_type: "plan" | "visit" | "task" | "expense";
        target_id: string;
        remark_id?: string;
        response: string;
        action_status?: string;
        attachments?: string[];
        attachment_details?: any[];
      }
    >({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/senior-remarks/followup`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["SeniorRemarks", "WorkPlan", "Expense"],
    }),
    updateSeniorRemarkStatus: builder.mutation<
      { success: boolean; remark: any },
      {
        target_type: "plan" | "visit" | "task" | "expense";
        target_id: string;
        remark_id?: string;
        status: string;
        resolution_remarks?: string;
      }
    >({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/senior-remarks/status`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["SeniorRemarks", "WorkPlan", "Expense"],
    }),
    getNotes: builder.query<UserNoteRecord[], Record<string, any> | void>({
      query: (params) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/notes`,
        params: params || {},
      }),
      transformResponse: (res: any) => {
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.data)) return res.data;
        return [];
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id, id }) => ({ type: "UserNotes" as const, id: _id || id })),
              { type: "UserNotes", id: "LIST" },
            ]
          : [{ type: "UserNotes", id: "LIST" }],
    }),
    getNotesKpis: builder.query<UserNoteKpis, void>({
      query: () => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/notes/kpis`,
      transformResponse: (res: any) => (res?.data !== undefined ? res.data : res),
      providesTags: [{ type: "UserNotes", id: "LIST" }],
    }),
    getNote: builder.query<UserNoteRecord, string>({
      query: (id) => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/notes/${id}`,
      transformResponse: (res: any) => (res?.data !== undefined ? res.data : res),
      providesTags: (_result, _error, id) => [{ type: "UserNotes", id }],
    }),
    createNote: builder.mutation<UserNoteRecord, Partial<UserNoteRecord>>({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/notes`,
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "UserNotes", id: "LIST" }],
    }),
    updateNote: builder.mutation<UserNoteRecord, { id: string } & Partial<UserNoteRecord>>({
      query: ({ id, ...body }) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/notes/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "UserNotes", id },
        { type: "UserNotes", id: "LIST" },
      ],
    }),
    deleteNote: builder.mutation<{ success: boolean; message?: string }, string>({
      query: (id) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/notes/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "UserNotes", id: "LIST" }],
    }),
    togglePinNote: builder.mutation<UserNoteRecord, string>({
      query: (id) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/notes/${id}/toggle-pin`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "UserNotes", id },
        { type: "UserNotes", id: "LIST" },
      ],
    }),
    toggleArchiveNote: builder.mutation<UserNoteRecord, string>({
      query: (id) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/notes/${id}/toggle-archive`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "UserNotes", id },
        { type: "UserNotes", id: "LIST" },
      ],
    }),
    toggleCompleteNote: builder.mutation<UserNoteRecord, string>({
      query: (id) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/notes/${id}/toggle-complete`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "UserNotes", id },
        { type: "UserNotes", id: "LIST" },
      ],
    }),
    bulkConvertToWorkPlan: builder.mutation<
      {
        success: boolean;
        message: string;
        work_plan_id: string;
        plan_date: string;
        converted_count: number;
        converted_note_ids: string[];
      },
      BulkConvertToWorkPlanPayload
    >({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/notes/bulk-convert`,
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "UserNotes", id: "LIST" },
        "WorkPlan",
        "WorkPlanDraft",
      ],
    }),
    markNotesConverted: builder.mutation<
      { success: boolean; count: number; message?: string },
      MarkNotesConvertedPayload
    >({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/notes/mark-converted`,
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "UserNotes", id: "LIST" }],
    }),
    getMyEmailPreferences: builder.query<UserEmailPreferences, void>({
      query: () => `${WORK_PLANNER_SERVICE_URL}/api/work-planner/email-preferences/me`,
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: [{ type: "UserEmailPreferences" as any, id: "ME" }],
    }),
    updateMyEmailPreferences: builder.mutation<UserEmailPreferences, Partial<UserEmailPreferences>>({
      query: (body) => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/email-preferences/me`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: [{ type: "UserEmailPreferences" as any, id: "ME" }],
    }),
    resetMyEmailPreferences: builder.mutation<UserEmailPreferences, void>({
      query: () => ({
        url: `${WORK_PLANNER_SERVICE_URL}/api/work-planner/email-preferences/me/reset`,
        method: "POST",
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: [{ type: "UserEmailPreferences" as any, id: "ME" }],
    }),
  }),
});

export const {
  useGetPlansQuery,
  useLazyGetPlansQuery,
  useGetStatsQuery,
  useGetPlanQuery,
  useLazyGetPlanQuery,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useDeletePlanMutation,
  useSubmitPlanMutation,
  useApprovePlanMutation,
  useRejectPlanMutation,
  useCompletePlanMutation,
  useAddVisitMutation,
  useUpdateVisitMutation,
  useRemoveVisitMutation,
  useAddStandaloneVisitMutation,
  useUpdateStandaloneVisitMutation,
  useRemoveStandaloneVisitMutation,
  useCheckInMutation,
  useCheckOutMutation,
  useCompleteVisitMutation,
  useScheduleNextVisitMutation,
  useAddWorkMutation,
  useUpdateWorkMutation,
  useRemoveWorkMutation,
  useAddStandaloneWorkMutation,
  useUpdateStandaloneWorkMutation,
  useRemoveStandaloneWorkMutation,
  useGetExpensesQuery,
  useLazyGetExpensesQuery,
  useAddExpenseMutation,
  useUpdateExpenseMutation,
  useRemoveExpenseMutation,
  useSubmitExpenseMutation,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
  useSubmitAllExpensesMutation,
  useApproveAllExpensesMutation,
  useRejectAllExpensesMutation,
  useUploadExpenseReceiptMutation,
  useGetExpenseKpisQuery,
  useLazyGetExpenseKpisQuery,
  useGetTourAdvancesQuery,
  useLazyGetTourAdvancesQuery,
  useRequestTourAdvanceMutation,
  useIssueDirectTourAdvanceMutation,
  useApproveTourAdvanceMutation,
  useRejectTourAdvanceMutation,
  useDisburseTourAdvanceMutation,
  useRefundTourAdvanceMutation,
  useUploadExpenseAttachmentMutation,
  useGetActiveTourAdvancesQuery,
  useLazyGetActiveTourAdvancesQuery,
  useGetExpenseSettlementsQuery,
  useLazyGetExpenseSettlementsQuery,
  useGetExpenseSettlementQuery,
  useLazyGetExpenseSettlementQuery,
  useCreateExpenseSettlementMutation,
  useGetExecutiveBalancesQuery,
  useLazyGetExecutiveBalancesQuery,
  useGetExecutivePassbookQuery,
  useLazyGetExecutivePassbookQuery,
  useGetDayEndDraftQuery,
  useLazyGetDayEndDraftQuery,
  useUploadWorkPlanAttachmentMutation,
  useGetUserSettingsQuery,
  useUpdateUserSettingsMutation,
  useGetUserTasksQuery,
  useLazyGetUserTasksQuery,
  useUpdateUserTasksMutation,
  useGetUserTasksSummaryQuery,
  useGetUserVisitTemplateQuery,
  useLazyGetUserVisitTemplateQuery,
  useUpdateUserVisitTemplateMutation,
  useGetUserVisitTemplatesSummaryQuery,
  useGetTeamTreeQuery,
  useGetMyTeamQuery,
  useGetTeamMembersQuery,
  useGetEligibleManagersQuery,
  useUpsertTeamEdgeMutation,
  useRemoveTeamEdgeMutation,
  useAddWorkPlanAuthorityRemarkMutation,
  useAddVisitAuthorityRemarkMutation,
  useAddWorkAuthorityRemarkMutation,
  useAddExpenseAuthorityRemarkMutation,
  useGetCaliberAnalyticsQuery,
  useLazyGetCaliberAnalyticsQuery,
  useRegenerateCaliberAnalyticsMutation,
  useGetSinglePlanAiAnalysisQuery,
  useLazyGetSinglePlanAiAnalysisQuery,
  useGetTeamAnalyticsOverviewQuery,
  useLazyGetTeamAnalyticsOverviewQuery,
  useGetWorkPlanDraftQuery,
  useLazyGetWorkPlanDraftQuery,
  useSaveWorkPlanDraftMutation,
  useDeleteWorkPlanDraftMutation,
  useGetSeniorRemarksFeedQuery,
  useLazyGetSeniorRemarksFeedQuery,
  useAddJuniorFollowupMutation,
  useUpdateSeniorRemarkStatusMutation,
  useGetNotesQuery,
  useLazyGetNotesQuery,
  useGetNotesKpisQuery,
  useGetNoteQuery,
  useLazyGetNoteQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  useTogglePinNoteMutation,
  useToggleArchiveNoteMutation,
  useToggleCompleteNoteMutation,
  useBulkConvertToWorkPlanMutation,
  useMarkNotesConvertedMutation,
  useGetMyEmailPreferencesQuery,
  useLazyGetMyEmailPreferencesQuery,
  useUpdateMyEmailPreferencesMutation,
  useResetMyEmailPreferencesMutation,
} = workPlannerApiSlice;
