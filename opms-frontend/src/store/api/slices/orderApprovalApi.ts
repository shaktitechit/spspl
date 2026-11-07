import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

type ApprovalQuery = {
  order?: string;
  approval_status?: string;
  assigned_finance_user?: string;
  assigned_account_user?: string;
  is_admin_approved?: boolean | string;
};

type ApprovalMutationArg = {
  id: string;
  patch?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

export type CreateOrderApprovalPayload = {
  order: string;
  approve_immediately?: boolean;
  replace_snapshot?: boolean;
  order_items?: any[];
  approval_notes?: string;
  approved_total_amount?: number;
  approval_items?: any[];
  contact_number?: string | string[];
  whatsapp_number?: string | string[];
  contact_name?: string | string[];
  template_name?: string;
  template_components?: unknown[];
  [key: string]: any;
};

export type OrderApprovalHistoryFieldChange = {
  field: string;
  from: any;
  to: any;
  difference?: number;
};

export type OrderApprovalHistoryLineChange = {
  order_item_id?: string;
  product?: string;
  product_name: string;
  sku?: string;
  kit_parent_product?: string | null;
  change_type: "added" | "removed" | "modified";
  field_changes?: OrderApprovalHistoryFieldChange[];
  before?: Record<string, any>;
  after?: Record<string, any>;
};

export type OrderApprovalHistoryItem = {
  _id: string;
  order_approval: string;
  order: string;
  revision_number: number;
  stage: string;
  department: "sales" | "coordinator" | "admin" | "finance" | "account" | "system";
  action: string;
  changed_by?: {
    _id?: string;
    id?: string;
    name?: string;
    username?: string;
    email?: string;
    role?: string;
  } | string;
  changed_at: string;
  notes?: string;
  financials?: {
    previous_approved_total: number;
    new_approved_total: number;
    previous_ordered_total: number;
    new_ordered_total: number;
    difference_approved_total: number;
  };
  changes?: OrderApprovalHistoryLineChange[];
  snapshot?: Record<string, any>[];
  is_legacy_fallback?: boolean;
};


const orderApprovalTags = (id?: string, orderId?: string) => [
  { type: "OrderApprovals" as const, id: "LIST" },
  ...(id
    ? [
        { type: "OrderApprovals" as const, id },
        { type: "OrderApprovals" as const, id: `${id}_HISTORY` },
      ]
    : []),
  ...(orderId ? [{ type: "Order" as const, id: orderId }] : []),
  "Order" as const,
  "Orders" as const,
  "Approvals" as const,
  "FinanceQueue" as const,
  "FinanceSummary" as const,
];

const orderApprovalMutationTags = (
  result: any,
  error: any,
  arg: any,
  extraTags: any[] = []
) => {
  const approvalId = typeof arg === "string" ? arg : arg?.id;
  const orderId =
    result?.order ||
    result?.data?.order ||
    arg?.order ||
    arg?.body?.order ||
    arg?.patch?.order;
  return [
    ...orderApprovalTags(approvalId, orderId ? String(orderId) : undefined),
    ...extraTags,
  ];
};

/** `/api/order-approvals` */
export const orderApprovalApi = medicaApi.injectEndpoints({
  endpoints: (build) => ({
    listOrderApprovals: build.query<unknown, ApprovalQuery | void>({
      query: (params) => ({
        url: "order-approvals",
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "OrderApprovals", id: "LIST" }],
    }),
    listOrderApprovalsDeleted: build.query<unknown, Pick<ApprovalQuery, "order"> | void>({
      query: (params) => ({
        url: "order-approvals/deleted",
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "OrderApprovals", id: "DELETED" }],
    }),
    getOrderApproval: build.query<unknown, string>({
      query: (id) => `order-approvals/${id}`,
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: (_r, _e, id) => [{ type: "OrderApprovals", id }],
    }),
    getOrderApprovalHistory: build.query<OrderApprovalHistoryItem[], string>({
      query: (id) => `order-approvals/${id}/history`,
      transformResponse: (raw: ApiEnvelope<OrderApprovalHistoryItem[]>) =>
        unwrapEnvelope(raw),
      providesTags: (_r, _e, id) => [
        { type: "OrderApprovals", id: `${id}_HISTORY` },
      ],
    }),
    createOrderApproval: build.mutation<unknown, CreateOrderApprovalPayload>({
      query: (body) => ({
        url: "order-approvals",
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (r, e, arg) => orderApprovalMutationTags(r, e, arg),
    }),
    patchOrderApproval: build.mutation<unknown, Required<Pick<ApprovalMutationArg, "id" | "patch">>>({
      query: ({ id, patch }) => ({
        url: `order-approvals/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (r, e, arg) => orderApprovalMutationTags(r, e, arg),
    }),
    superSheetPatchOrderApproval: build.mutation<
      unknown,
      Required<Pick<ApprovalMutationArg, "id" | "patch">>
    >({
      query: ({ id, patch }) => ({
        url: `order-approvals/${id}/super-sheet`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (r, e, arg) => orderApprovalMutationTags(r, e, arg),
    }),
    approveOrderApproval: build.mutation<unknown, ApprovalMutationArg>({
      query: ({ id, body }) => ({
        url: `order-approvals/${id}/approve`,
        method: "POST",
        body: body ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (r, e, arg) => orderApprovalMutationTags(r, e, arg),
    }),
    rejectOrderApproval: build.mutation<unknown, ApprovalMutationArg>({
      query: ({ id, body }) => ({
        url: `order-approvals/${id}/reject`,
        method: "POST",
        body: body ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (r, e, arg) => orderApprovalMutationTags(r, e, arg),
    }),
    sendOrderApprovalToFinance: build.mutation<unknown, ApprovalMutationArg>({
      query: ({ id, body }) => ({
        url: `order-approvals/${id}/send-to-finance`,
        method: "POST",
        body: body ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (r, e, arg) =>
        orderApprovalMutationTags(r, e, arg, ["FinanceQueue", "FinanceSummary"]),
    }),
    sendOrderApprovalToAccount: build.mutation<unknown, ApprovalMutationArg>({
      query: ({ id, body }) => ({
        url: `order-approvals/${id}/send-to-account`,
        method: "POST",
        body: body ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (r, e, arg) =>
        orderApprovalMutationTags(r, e, arg, ["FinanceQueue", "FinanceSummary"]),
    }),
    financeAmendOrderApproval: build.mutation<unknown, ApprovalMutationArg>({
      query: ({ id, body }) => ({
        url: `order-approvals/${id}/finance-amend`,
        method: "POST",
        body: body ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (r, e, arg) => orderApprovalMutationTags(r, e, arg, ["PartyProducts"]),
    }),
    amendOrderApproval: build.mutation<unknown, ApprovalMutationArg>({
      query: ({ id, body }) => ({
        url: `order-approvals/${id}/amend`,
        method: "POST",
        body: body ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (r, e, arg) => orderApprovalMutationTags(r, e, arg),
    }),
    resolvePartialDispatchRelease: build.mutation<unknown, ApprovalMutationArg>({
      query: ({ id, body }) => ({
        url: `order-approvals/${id}/resolve-dispatch`,
        method: "POST",
        body: body ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (r, e, arg) =>
        orderApprovalMutationTags(r, e, arg, ["Dispatch", "UnbilledOrders", "Orders"]),
    }),
    deleteOrderApproval: build.mutation<unknown, string>({
      query: (id) => ({
        url: `order-approvals/${id}`,
        method: "DELETE",
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (r, e, id) =>
        orderApprovalMutationTags(r, e, id, [{ type: "OrderApprovals", id: "DELETED" }]),
    }),
    restoreOrderApproval: build.mutation<unknown, string>({
      query: (id) => ({
        url: `order-approvals/${id}/restore`,
        method: "POST",
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (r, e, id) =>
        orderApprovalMutationTags(r, e, id, [{ type: "OrderApprovals", id: "DELETED" }]),
    }),
  }),
});

export const {
  useListOrderApprovalsQuery,
  useLazyListOrderApprovalsQuery,
  useListOrderApprovalsDeletedQuery,
  useLazyListOrderApprovalsDeletedQuery,
  useGetOrderApprovalQuery,
  useLazyGetOrderApprovalQuery,
  useGetOrderApprovalHistoryQuery,
  useLazyGetOrderApprovalHistoryQuery,
  useCreateOrderApprovalMutation,
  usePatchOrderApprovalMutation,
  useSuperSheetPatchOrderApprovalMutation,
  useApproveOrderApprovalMutation,
  useRejectOrderApprovalMutation,
  useSendOrderApprovalToFinanceMutation,
  useSendOrderApprovalToAccountMutation,
  useFinanceAmendOrderApprovalMutation,
  useAmendOrderApprovalMutation,
  useResolvePartialDispatchReleaseMutation,
  useDeleteOrderApprovalMutation,
  useRestoreOrderApprovalMutation,
} = orderApprovalApi;

/** @deprecated Renamed — use the OrderApproval hooks above */
export const useListOrderFinanceApprovalsQuery = useListOrderApprovalsQuery;
export const useLazyListOrderFinanceApprovalsQuery = useLazyListOrderApprovalsQuery;
export const useGetOrderFinanceApprovalQuery = useGetOrderApprovalQuery;
export const useCreateOrderFinanceApprovalMutation = useCreateOrderApprovalMutation;
export const usePatchOrderFinanceApprovalMutation = usePatchOrderApprovalMutation;
export const useApproveOrderFinanceApprovalMutation = useApproveOrderApprovalMutation;
export const useRejectOrderFinanceApprovalMutation = useRejectOrderApprovalMutation;
export const useSendOrderFinanceApprovalToFinanceMutation = useSendOrderApprovalToFinanceMutation;
export const useFinanceAmendOrderFinanceApprovalMutation = useFinanceAmendOrderApprovalMutation;
export const useDeleteOrderFinanceApprovalMutation = useDeleteOrderApprovalMutation;
export const useRestoreOrderFinanceApprovalMutation = useRestoreOrderApprovalMutation;
