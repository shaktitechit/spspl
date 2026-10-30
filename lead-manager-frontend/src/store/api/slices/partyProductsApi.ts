import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";
import { PARTY_SERVICE_URL } from "@/lib/env";

export interface CheckOrderRatesItem {
  product: string;
  product_name: string;
  sku?: string;
  applied_rate_type: string;
  unit_price: number;
  isMapped: boolean;
  mappingId: string | null;
  hasRate: boolean;
  rateId: string | null;
  currentMappedRate: number | null;
  isRateExpired?: boolean;
  validityStart?: string | null;
  validityEnd?: string | null;
}

export interface CheckOrderRatesResponse {
  orderId?: string;
  party: string;
  party_name: string;
  items: CheckOrderRatesItem[];
}

export interface CheckPartyLineRatesRequest {
  party: string;
  items: Array<{
    product: string;
    applied_rate_type: string;
    product_name?: string;
    sku?: string;
    unit_price?: number;
  }>;
}

export interface MapPartyOrderProductRateRequest {
  orderId?: string;
  party?: string;
  productId: string;
  applied_rate_type: string;
  rate: number;
}

export interface MapPartyOrderProductRateResponse {
  mappingId: string;
  rateId: string;
  rate: number;
}

/** `/api/party-products` and `/api/party-order-products-rate` — manage party product mappings and rates. */
export const partyProductsApi = medicaApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (build) => ({
    listPartyProducts: build.query<
      unknown,
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: `${PARTY_SERVICE_URL}/api/party-products`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "PartyProducts", id: "LIST" }],
    }),
    listPartyProductsDeleted: build.query<
      unknown,
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: `${PARTY_SERVICE_URL}/api/party-products/deleted`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "PartyProducts", id: "DELETED" }],
    }),
    getPartyProduct: build.query<unknown, string>({
      query: (id) => `${PARTY_SERVICE_URL}/api/party-products/${id}`,
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: (_r, _e, id) => [{ type: "PartyProducts", id }],
    }),
    getPartyCatalog: build.query<unknown, string>({
      query: (partyId) => ({
        url: `${PARTY_SERVICE_URL}/api/party-products`,
        params: { party: partyId },
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: (_r, _e, partyId) => [
        { type: "PartyProducts", id: `catalog-${partyId}` },
      ],
    }),
    createPartyProduct: build.mutation<unknown, Record<string, unknown>>({
      query: (body) => ({
        url: `${PARTY_SERVICE_URL}/api/party-products`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: ["PartyProducts"],
    }),
    patchPartyProduct: build.mutation<
      unknown,
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `${PARTY_SERVICE_URL}/api/party-products/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, arg) => [
        "PartyProducts",
        { type: "PartyProducts", id: arg.id },
      ],
    }),
    deletePartyProduct: build.mutation<unknown, string>({
      query: (id) => ({
        url: `${PARTY_SERVICE_URL}/api/party-products/${id}`,
        method: "DELETE",
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        "PartyProducts",
        { type: "PartyProducts", id },
        { type: "PartyProducts", id: "LIST" },
        { type: "PartyProducts", id: "DELETED" },
      ],
    }),
    restorePartyProduct: build.mutation<unknown, string>({
      query: (id) => ({
        url: `${PARTY_SERVICE_URL}/api/party-products/${id}/restore`,
        method: "POST",
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        "PartyProducts",
        { type: "PartyProducts", id },
        { type: "PartyProducts", id: "LIST" },
        { type: "PartyProducts", id: "DELETED" },
      ],
    }),
    addPartyProductRate: build.mutation<
      unknown,
      { id: string; body: Record<string, unknown> }
    >({
      query: ({ id, body }) => ({
        url: `${PARTY_SERVICE_URL}/api/party-products/${id}/rates`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: () => ["PartyProducts"],
    }),
    updatePartyProductRate: build.mutation<
      unknown,
      { rateId: string; patch: Record<string, unknown> }
    >({
      query: ({ rateId, patch }) => ({
        url: `${PARTY_SERVICE_URL}/api/party-products/rates/${rateId}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: ["PartyProducts"],
    }),
    deletePartyProductRate: build.mutation<unknown, string>({
      query: (rateId) => ({
        url: `${PARTY_SERVICE_URL}/api/party-products/rates/${rateId}`,
        method: "DELETE",
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: ["PartyProducts"],
    }),
    approvePartyProductRate: build.mutation<unknown, string>({
      query: (rateId) => ({
        url: `${PARTY_SERVICE_URL}/api/party-products/rates/${rateId}/approve`,
        method: "POST",
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: ["PartyProducts"],
    }),
    checkOrderRates: build.query<CheckOrderRatesResponse, string>({
      query: (orderId) =>
        `${PARTY_SERVICE_URL}/api/party-order-products-rate/check/${orderId}`,
      transformResponse: (raw: ApiEnvelope<CheckOrderRatesResponse>) =>
        unwrapEnvelope(raw),
      providesTags: (_r, _e, id) => [
        { type: "PartyProducts", id },
        { type: "PartyProducts", id: `order-rates-${id}` },
      ],
    }),
    checkPartyLineRates: build.query<
      CheckOrderRatesResponse,
      CheckPartyLineRatesRequest
    >({
      query: (body) => ({
        url: `${PARTY_SERVICE_URL}/api/party-order-products-rate/check-lines`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<CheckOrderRatesResponse>) =>
        unwrapEnvelope(raw),
      providesTags: (_r, _e, arg) => [
        { type: "PartyProducts", id: `check-lines-${arg.party}` },
      ],
      serializeQueryArgs: ({ queryArgs }) => {
        const itemsKey = (queryArgs.items ?? [])
          .map((i) => `${i.product}:${i.applied_rate_type}`)
          .sort()
          .join("|");
        return `${queryArgs.party}::${itemsKey}`;
      },
    }),
    mapPartyOrderProductRate: build.mutation<
      MapPartyOrderProductRateResponse,
      MapPartyOrderProductRateRequest
    >({
      query: (body) => ({
        url: `${PARTY_SERVICE_URL}/api/party-order-products-rate/map`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<MapPartyOrderProductRateResponse>) =>
        unwrapEnvelope(raw),
      invalidatesTags: ["PartyProducts"],
    }),
  }),
});

export const {
  useListPartyProductsQuery,
  useLazyListPartyProductsQuery,
  useListPartyProductsDeletedQuery,
  useLazyListPartyProductsDeletedQuery,
  useGetPartyProductQuery,
  useLazyGetPartyProductQuery,
  useGetPartyCatalogQuery,
  useCreatePartyProductMutation,
  usePatchPartyProductMutation,
  useDeletePartyProductMutation,
  useRestorePartyProductMutation,
  useAddPartyProductRateMutation,
  useUpdatePartyProductRateMutation,
  useDeletePartyProductRateMutation,
  useApprovePartyProductRateMutation,
  useCheckOrderRatesQuery,
  useCheckPartyLineRatesQuery,
  useMapPartyOrderProductRateMutation,
} = partyProductsApi;
