/**
 * @fileoverview RTK Query API Slice for Expense Portal.
 * @module store/api/expenseApiSlice
 */
import { baseApi } from "./baseApi";
import { EXPENSE_SERVICE_URL, WORK_PLANNER_SERVICE_URL, publicExpenseApiOrigin } from "@/lib/env";
import type {
  ExpenseRecord,
  TourAdvanceRecord,
  ExpenseSettlementRecord,
  ExecutiveBalanceItem,
  ExecutivePassbookData,
  ExpenseKpiSummaryData,
  WorkPlannerUserFinancialItem,
} from "@/types/expense";

export function getExpenseApiBase(): string {
  return publicExpenseApiOrigin().replace(/\/+$/, "");
}

const API_BASE = {
  toString(): string {
    return getExpenseApiBase();
  },
};

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

  return {
    data: Array.isArray(res) ? res : [],
    total: Array.isArray(res) ? res.length : 0,
    page: 1,
    limit: 50,
    pages: 1,
  };
}

export const expenseApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // 1. Work Planner Users Directory with Financials
    getWorkPlannerUsers: builder.query<{ total: number; users: WorkPlannerUserFinancialItem[] }, { search?: string } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.search) queryParams.set("search", params.search);
        return {
          url: `${API_BASE}/api/expenses/work-planner-users?${queryParams.toString()}`,
        };
      },
      providesTags: ["WorkPlannerTeam"],
    }),

    // 2. High-level KPI Summary
    getExpenseKpis: builder.query<ExpenseKpiSummaryData, { from_date?: string; to_date?: string; sales_user?: string } | void>({
      query: (params) => {
        const q = new URLSearchParams();
        if (params?.from_date) q.set("from_date", params.from_date);
        if (params?.to_date) q.set("to_date", params.to_date);
        if (params?.sales_user && params.sales_user !== "all") q.set("sales_user", params.sales_user);
        return {
          url: `${API_BASE}/api/expenses/kpi-summary?${q.toString()}`,
        };
      },
      transformResponse: (res: any) => res?.data || res,
      providesTags: ["WorkPlanExpense", "TourAdvance", "ExpenseSettlement"],
    }),

    // 3. Expense Claims
    getExpenses: builder.query<
      { data: ExpenseRecord[]; total: number; page: number; limit: number; pages: number },
      {
        page?: number;
        limit?: number;
        sales_user?: string;
        user_id?: string;
        status?: string;
        category?: string;
        settlement_status?: string;
        from_date?: string;
        to_date?: string;
        q?: string;
        scope?: string;
        [key: string]: any;
      } | void
    >({
      query: (params) => {
        const q = new URLSearchParams();
        if (params?.page) q.set("page", String(params.page));
        if (params?.limit) q.set("limit", String(params.limit));
        const u = params?.sales_user || params?.user_id;
        if (u && u !== "all") q.set("sales_user", u);
        if (params?.status) q.set("status", params.status);
        if (params?.category && params.category !== "all") q.set("category", params.category);
        if (params?.settlement_status && params.settlement_status !== "all") q.set("settlement_status", params.settlement_status);
        const fromDate = params?.from_date || (params as any)?.from;
        if (fromDate) q.set("from_date", fromDate);
        const toDate = params?.to_date || (params as any)?.to;
        if (toDate) q.set("to_date", toDate);
        if (params?.q) q.set("q", params.q);
        if ((params as any)?.scope) q.set("scope", (params as any).scope);

        return {
          url: `${API_BASE}/api/expenses/claims?${q.toString()}`,
        };
      },
      transformResponse: normalizePaginatedResponse<ExpenseRecord>,
      providesTags: ["WorkPlanExpense"],
    }),

    getExpenseById: builder.query<ExpenseRecord, string>({
      query: (id) => ({
        url: `${API_BASE}/api/expenses/claims/${id}`,
      }),
      transformResponse: (res: any) => res?.data || res,
      providesTags: (_res, _err, id) => [{ type: "WorkPlanExpense", id }],
    }),

    createExpense: builder.mutation<ExpenseRecord, Partial<ExpenseRecord>>({
      query: (body) => ({
        url: `${API_BASE}/api/expenses/claims`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["WorkPlanExpense"],
    }),

    approveExpense: builder.mutation<ExpenseRecord, { planId?: string; expenseId: string; remarks?: string }>({
      query: ({ expenseId, remarks }) => ({
        url: `${API_BASE}/api/expenses/claims/${expenseId}/approve`,
        method: "POST",
        body: { remarks },
      }),
      invalidatesTags: ["WorkPlanExpense", "TourAdvance", "ExpenseSettlement", "WorkPlannerTeam"],
    }),

    bulkApproveExpenses: builder.mutation<{ total: number; approved_count: number }, { expense_ids: string[]; remarks?: string }>({
      query: (body) => ({
        url: `${API_BASE}/api/expenses/claims/bulk-approve`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["WorkPlanExpense", "TourAdvance", "ExpenseSettlement", "WorkPlannerTeam"],
    }),

    rejectExpense: builder.mutation<ExpenseRecord, { planId?: string; expenseId: string; rejection_reason: string }>({
      query: ({ expenseId, rejection_reason }) => ({
        url: `${API_BASE}/api/expenses/claims/${expenseId}/reject`,
        method: "POST",
        body: { rejection_reason },
      }),
      invalidatesTags: ["WorkPlanExpense", "WorkPlannerTeam"],
    }),

    addExpenseAuthorityRemark: builder.mutation<
      ExpenseRecord,
      {
        planId?: string;
        expenseId: string;
        body: {
          manager_remarks: string;
          remark?: string;
          remark_type?: string;
          priority?: string;
          expected_followup_date?: string;
        };
      }
    >({
      query: ({ expenseId, body }) => ({
        url: `${API_BASE}/api/expenses/claims/${expenseId}/authority-remarks`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["WorkPlanExpense", "SeniorRemarks", "WorkPlannerTeam"],
    }),

    updateExpenseAuthorityRemarkStatus: builder.mutation<
      ExpenseRecord,
      {
        expenseId: string;
        remark_id?: string;
        status: "resolved" | "pending_response" | "responded";
        resolution_remarks?: string;
      }
    >({
      query: ({ expenseId, ...body }) => ({
        url: `${API_BASE}/api/expenses/claims/${expenseId}/remarks/status`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["WorkPlanExpense", "SeniorRemarks", "WorkPlannerTeam"],
    }),

    // 4. Advances
    getTourAdvances: builder.query<
      { data: TourAdvanceRecord[]; total: number; page: number; limit: number; pages: number },
      {
        page?: number;
        limit?: number;
        sales_user?: string;
        user_id?: string;
        status?: string;
        from_date?: string;
        to_date?: string;
        q?: string;
        scope?: string;
        [key: string]: any;
      } | void
    >({
      query: (params) => {
        const q = new URLSearchParams();
        if (params?.page) q.set("page", String(params.page));
        if (params?.limit) q.set("limit", String(params.limit));
        const u = params?.sales_user || params?.user_id;
        if (u && u !== "all") q.set("sales_user", u);
        if (params?.status) q.set("status", params.status);
        const fromDate = params?.from_date || (params as any)?.from;
        if (fromDate) q.set("from_date", fromDate);
        const toDate = params?.to_date || (params as any)?.to;
        if (toDate) q.set("to_date", toDate);
        if (params?.q) q.set("q", params.q);
        if ((params as any)?.scope) q.set("scope", (params as any).scope);

        return {
          url: `${API_BASE}/api/expenses/advances?${q.toString()}`,
        };
      },
      transformResponse: normalizePaginatedResponse<TourAdvanceRecord>,
      providesTags: ["TourAdvance"],
    }),

    requestTourAdvance: builder.mutation<TourAdvanceRecord, any>({
      query: (body) => ({
        url: `${API_BASE}/api/expenses/advances`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["TourAdvance", "WorkPlannerTeam"],
    }),

    createTourAdvance: builder.mutation<TourAdvanceRecord, any>({
      query: (body) => ({
        url: `${API_BASE}/api/expenses/advances`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["TourAdvance", "WorkPlannerTeam"],
    }),

    approveTourAdvance: builder.mutation<TourAdvanceRecord, { advanceId: string }>({
      query: ({ advanceId }) => ({
        url: `${API_BASE}/api/expenses/advances/${advanceId}/approve`,
        method: "POST",
      }),
      invalidatesTags: ["TourAdvance", "WorkPlannerTeam"],
    }),

    rejectTourAdvance: builder.mutation<TourAdvanceRecord, { advanceId: string; rejection_reason: string }>({
      query: ({ advanceId, rejection_reason }) => ({
        url: `${API_BASE}/api/expenses/advances/${advanceId}/reject`,
        method: "POST",
        body: { rejection_reason },
      }),
      invalidatesTags: ["TourAdvance", "WorkPlannerTeam"],
    }),

    disburseTourAdvance: builder.mutation<
      TourAdvanceRecord,
      {
        advanceId: string;
        disbursed_amount: number;
        payment_method: string;
        transaction_reference?: string;
        bank_name?: string;
        disbursement_notes?: string;
        attachments?: string[];
        attachment_details?: any;
        disbursement_attachments?: string[];
        disbursement_attachment_details?: any;
        [key: string]: any;
      }
    >({
      query: ({ advanceId, ...body }) => ({
        url: `${API_BASE}/api/expenses/advances/${advanceId}/disburse`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["TourAdvance", "WorkPlanExpense", "ExpenseSettlement", "WorkPlannerTeam"],
    }),

    refundTourAdvance: builder.mutation<
      TourAdvanceRecord,
      {
        advanceId: string;
        amount: number;
        payment_method?: string;
        transaction_reference?: string;
        notes?: string;
        attachments?: string[];
        [key: string]: any;
      }
    >({
      query: ({ advanceId, ...body }) => ({
        url: `${API_BASE}/api/expenses/advances/${advanceId}/refund`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["TourAdvance", "WorkPlanExpense", "ExpenseSettlement", "WorkPlannerTeam"],
    }),

    getActiveAdvances: builder.query<TourAdvanceRecord[], string | { userId?: string } | void>({
      query: (arg) => {
        const userId = typeof arg === "object" && arg !== null ? arg.userId : arg;
        const u = userId && userId !== "all" ? `/${userId}` : "";
        return {
          url: `${API_BASE}/api/expenses/advances/active${u}`,
        };
      },
      transformResponse: (res: any) => res?.data || (Array.isArray(res) ? res : []),
      providesTags: ["TourAdvance"],
    }),

    // 5. Balances & Ledgers
    getExecutiveBalances: builder.query<{ total: number; data: ExecutiveBalanceItem[] }, { sales_user?: string } | void>({
      query: (params) => {
        const q = new URLSearchParams();
        if (params?.sales_user && params.sales_user !== "all") q.set("sales_user", params.sales_user);
        return {
          url: `${API_BASE}/api/expenses/balances?${q.toString()}`,
        };
      },
      providesTags: ["WorkPlanExpense", "TourAdvance", "ExpenseSettlement", "WorkPlannerTeam"],
    }),

    getExecutivePassbook: builder.query<ExecutivePassbookData, { userId: string; from_date?: string; to_date?: string }>({
      query: ({ userId, from_date, to_date }) => {
        const q = new URLSearchParams();
        if (from_date) q.set("from_date", from_date);
        if (to_date) q.set("to_date", to_date);
        return {
          url: `${API_BASE}/api/expenses/passbook/${userId || "me"}?${q.toString()}`,
        };
      },
      transformResponse: (res: any) => res?.data || res,
      providesTags: ["WorkPlanExpense", "TourAdvance", "ExpenseSettlement"],
    }),

    // 6. Settlements
    getExpenseSettlements: builder.query<
      { data: ExpenseSettlementRecord[]; total: number; page: number; limit: number; pages: number },
      {
        page?: number;
        limit?: number;
        sales_user?: string;
        from_date?: string;
        to_date?: string;
        q?: string;
      } | void
    >({
      query: (params) => {
        const q = new URLSearchParams();
        if (params?.page) q.set("page", String(params.page));
        if (params?.limit) q.set("limit", String(params.limit));
        const u = params?.sales_user || (params as any)?.user_id;
        if (u && u !== "all") q.set("sales_user", u);
        if ((params as any)?.status) q.set("status", (params as any).status);
        if ((params as any)?.settlement_mode && (params as any).settlement_mode !== "all") q.set("settlement_mode", (params as any).settlement_mode);
        const fromDate = params?.from_date || (params as any)?.from;
        if (fromDate) q.set("from_date", fromDate);
        const toDate = params?.to_date || (params as any)?.to;
        if (toDate) q.set("to_date", toDate);
        if (params?.q) q.set("q", params.q);
        if ((params as any)?.scope) q.set("scope", (params as any).scope);

        return {
          url: `${API_BASE}/api/expenses/settlements?${q.toString()}`,
        };
      },
      transformResponse: normalizePaginatedResponse<ExpenseSettlementRecord>,
      providesTags: ["ExpenseSettlement"],
    }),

    getExpenseSettlementById: builder.query<ExpenseSettlementRecord, string>({
      query: (id) => ({
        url: `${API_BASE}/api/expenses/settlements/${id}`,
      }),
      transformResponse: (res: any) => res?.data || res,
      providesTags: (_res, _err, id) => [{ type: "ExpenseSettlement", id }],
    }),

    createExpenseSettlement: builder.mutation<
      ExpenseSettlementRecord,
      {
        sales_user: string;
        claims?: { expense: string; amount?: number }[];
        expense_ids?: string[];
        advances?: any[];
        payment_entries?: any[];
        advance_deduction_amount?: number;
        payment_entry_deduction_amount?: number;
        settlement_mode?: "advance_deduction" | "direct_payment" | "split";
        payment_method?: string;
        transaction_reference?: string;
        bank_name?: string;
        settlement_notes?: string;
        attachments?: string[];
        attachment_details?: any;
        direct_payment_amount?: number;
        settlement_date?: string;
        [key: string]: any;
      }
    >({
      query: (body) => ({
        url: `${API_BASE}/api/expenses/settlements`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["ExpenseSettlement", "WorkPlanExpense", "TourAdvance", "WorkPlannerTeam"],
    }),

    getActivePaymentEntries: builder.query<ExpenseSettlementRecord[], string | { userId?: string } | void>({
      query: (arg) => {
        const userId = typeof arg === "object" && arg !== null ? arg.userId : arg;
        const u = userId && userId !== "all" ? `/${userId}` : "";
        return {
          url: `${API_BASE}/api/expenses/settlements/active-payments${u}`,
        };
      },
      transformResponse: (res: any) => res?.data || (Array.isArray(res) ? res : []),
      providesTags: ["ExpenseSettlement"],
    }),

    recordPaymentEntry: builder.mutation<
      ExpenseSettlementRecord,
      {
        sales_user: string;
        amount: number;
        payment_method?: string;
        transaction_reference?: string;
        bank_name?: string;
        notes?: string;
        payment_date?: string;
        attachments?: string[];
      }
    >({
      query: (body) => ({
        url: `${API_BASE}/api/expenses/payments/entry`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["ExpenseSettlement", "WorkPlanExpense", "TourAdvance", "WorkPlannerTeam"],
    }),

    // 7. File Uploads
    uploadExpenseFile: builder.mutation<{ _id: string; filename: string; url: string; original_name?: string }, FormData>({
      query: (formData) => ({
        url: `${API_BASE}/api/expenses/upload`,
        method: "POST",
        body: formData,
      }),
      transformResponse: (res: any) => res?.data || res,
    }),
  }),
});

export const {
  useGetWorkPlannerUsersQuery,
  useLazyGetWorkPlannerUsersQuery,
  useGetExpenseKpisQuery,
  useLazyGetExpenseKpisQuery,
  useGetExpensesQuery,
  useLazyGetExpensesQuery,
  useGetExpenseByIdQuery,
  useCreateExpenseMutation,
  useApproveExpenseMutation,
  useBulkApproveExpensesMutation,
  useRejectExpenseMutation,
  useAddExpenseAuthorityRemarkMutation,
  useUpdateExpenseAuthorityRemarkStatusMutation,
  useGetTourAdvancesQuery,
  useLazyGetTourAdvancesQuery,
  useRequestTourAdvanceMutation,
  useCreateTourAdvanceMutation,
  useApproveTourAdvanceMutation,
  useRejectTourAdvanceMutation,
  useDisburseTourAdvanceMutation,
  useRefundTourAdvanceMutation,
  useGetActiveAdvancesQuery,
  useGetExecutiveBalancesQuery,
  useGetExecutivePassbookQuery,
  useGetExpenseSettlementsQuery,
  useLazyGetExpenseSettlementsQuery,
  useGetExpenseSettlementByIdQuery,
  useCreateExpenseSettlementMutation,
  useRecordPaymentEntryMutation,
  useGetActivePaymentEntriesQuery,
  useUploadExpenseFileMutation,
} = expenseApiSlice;

// Compatibility aliases
export const useGetMyTeamQuery = useGetWorkPlannerUsersQuery;
export const useLazyGetMyTeamQuery = useLazyGetWorkPlannerUsersQuery;
export const useGetTeamTreeQuery = useGetWorkPlannerUsersQuery;
export const useGetMyTeamTreeQuery = useGetWorkPlannerUsersQuery;
export const useIssueDirectTourAdvanceMutation = useCreateTourAdvanceMutation;
export const useUploadExpenseReceiptMutation = useUploadExpenseFileMutation;
export const useUploadExpenseAttachmentMutation = useUploadExpenseFileMutation;
export const useGetExpenseSettlementQuery = useGetExpenseSettlementByIdQuery;
export const useGetActiveTourAdvancesQuery = useGetActiveAdvancesQuery;
export const useLazyGetActiveTourAdvancesQuery = useGetActiveAdvancesQuery;
