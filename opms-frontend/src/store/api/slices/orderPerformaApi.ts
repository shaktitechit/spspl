import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

export type OrderPerformaData = {
  _id?: string;
  order: string;
  order_no: string;
  company_id?: string | null;
  sales_person: string;
  freight_charges: string;
  orc: string;
  transport: string;
  dispatch_date: string | null;
  ship_to_address: string;
  payment_terms: string;
  customer_type: string;
  installation_required: string;
  gst_concession: string;
  margin_sheet_attached: string;
  kyc_status: string;
  remarks: string;
  po_attachment?: string | null;
  cost_sheet_attachment?: string | null;
  aadhaar_attachment?: string | null;
  pan_attachment?: string | null;
  gst_attachment?: string | null;
  po_document?: Record<string, unknown> | null;
  cost_sheet_document?: Record<string, unknown> | null;
  aadhaar_document?: Record<string, unknown> | null;
  pan_document?: Record<string, unknown> | null;
  gst_document?: Record<string, unknown> | null;
  kyc_documents?: Record<string, unknown>[];
  is_locked?: boolean;
  lock_reason?: string;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
};

export const orderPerformaApi = medicaApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (build) => ({
    getOrderPerforma: build.query<OrderPerformaData, string>({
      query: (orderId) => ({
        url: `orders/${orderId}/performa`,
      }),
      transformResponse: (raw: ApiEnvelope<OrderPerformaData>) => unwrapEnvelope(raw),
      providesTags: (_res, _err, orderId) => [
        { type: "Order", id: orderId },
        { type: "Orders", id: orderId },
        { type: "OrderPerforma", id: orderId },
      ],
    }),
    updateOrderPerforma: build.mutation<
      OrderPerformaData,
      { orderId: string; data: Partial<OrderPerformaData> }
    >({
      query: ({ orderId, data }) => ({
        url: `orders/${orderId}/performa`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (raw: ApiEnvelope<OrderPerformaData>) => unwrapEnvelope(raw),
      invalidatesTags: (_res, _err, { orderId }) => [
        { type: "Order", id: orderId },
        { type: "Orders", id: "LIST" },
        { type: "OrderPerforma", id: orderId },
      ],
    }),
  }),
});

export const {
  useGetOrderPerformaQuery,
  useLazyGetOrderPerformaQuery,
  useUpdateOrderPerformaMutation,
} = orderPerformaApi;
