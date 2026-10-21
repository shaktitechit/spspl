import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";
import { PARTY_SERVICE_URL } from "@/lib/env";

export type PartyCountryRecord = {
  _id?: string;
  id?: string;
  name: string;
  iso_code?: string;
  phone_code?: string;
  currency?: string;
  status?: string;
};

export type PartyStateRecord = {
  _id?: string;
  id?: string;
  country: string;
  name: string;
  state_code?: string;
  status?: string;
};

export type PartyCityRecord = {
  _id?: string;
  id?: string;
  state: string;
  country?: string;
  name: string;
  district?: string;
  status?: string;
};

/** Common write fields for create/patch/bulk party payloads. */
export type PartyWriteBody = {
  party_type?: string;
  party_name?: string;
  contact_person?: string;
  mobile?: string;
  email?: string;
  contacts?: unknown[];
  gst_no?: string;
  drug_license_no?: string;
  billing_address?: Record<string, unknown>;
  shipping_address?: Record<string, unknown>;
  district?: string;
  state?: string;
  city?: string;
  country?: string;
  country_id?: string;
  state_id?: string;
  city_id?: string;
  payment_terms?: string;
  is_active?: boolean;
  is_featured?: boolean;
  sra?: boolean;
  sra_from_date?: string | null;
  sra_to_date?: string | null;
  [key: string]: unknown;
};

export type PartyListParams = {
  search?: string;
  type?: string;
  status?: string;
  /** Filter featured parties: `"true"` | `"false"` | `"all"` */
  is_featured?: string;
  paginate?: string;
  page?: string;
  limit?: string;
  [key: string]: string | undefined;
};

/** Party Service API — soft-delete + restore via RBAC. */
export const partiesApi = medicaApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (build) => ({
    listParties: build.query<unknown, PartyListParams | void>({
      query: (params) => ({
        url: `${PARTY_SERVICE_URL}/api/parties`,
        params: { status: "all", ...params },
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Parties", id: "LIST" }],
    }),
    listPartiesDeleted: build.query<unknown, PartyListParams | void>({
      query: (params) => ({
        url: `${PARTY_SERVICE_URL}/api/parties/deleted`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Parties", id: "DELETED" }],
    }),
    getParty: build.query<unknown, string>({
      query: (id) => `${PARTY_SERVICE_URL}/api/parties/${id}`,
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: (_r, _e, id) => [{ type: "Parties", id }],
    }),
    createParty: build.mutation<unknown, PartyWriteBody>({
      query: (body) => ({ url: `${PARTY_SERVICE_URL}/api/parties`, method: "POST", body }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: ["Parties"],
    }),
    patchParty: build.mutation<
      unknown,
      { id: string; patch: PartyWriteBody }
    >({
      query: ({ id, patch }) => ({
        url: `${PARTY_SERVICE_URL}/api/parties/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, arg) => [
        "Parties",
        { type: "Parties", id: arg.id },
      ],
    }),
    deleteParty: build.mutation<unknown, string>({
      query: (id) => ({ url: `${PARTY_SERVICE_URL}/api/parties/${id}`, method: "DELETE" }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        "Parties",
        { type: "Parties", id },
        { type: "Parties", id: "LIST" },
        { type: "Parties", id: "DELETED" },
      ],
    }),
    restoreParty: build.mutation<unknown, string>({
      query: (id) => ({ url: `${PARTY_SERVICE_URL}/api/parties/${id}/restore`, method: "POST" }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        "Parties",
        { type: "Parties", id },
        { type: "Parties", id: "LIST" },
        { type: "Parties", id: "DELETED" },
      ],
    }),
    bulkCreateParty: build.mutation<unknown, PartyWriteBody[]>({
      query: (body) => ({ url: `${PARTY_SERVICE_URL}/api/parties/bulk`, method: "POST", body }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: ["Parties"],
    }),
    bulkDeleteParties: build.mutation<unknown, string[]>({
      query: (ids) => ({
        url: `${PARTY_SERVICE_URL}/api/parties/bulk-delete`,
        method: "POST",
        body: { ids },
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: ["Parties"],
    }),
    getPartyCountries: build.query<
      PartyCountryRecord[],
      { limit?: number; status?: string } | void
    >({
      query: (params) => {
        const query = new URLSearchParams();
        query.append("limit", String(params?.limit ?? 500));
        query.append("status", params?.status ?? "active");
        return {
          url: `${PARTY_SERVICE_URL}/api/party-countries?${query.toString()}`,
        };
      },
      transformResponse: (res: any) => {
        const raw = unwrapEnvelope(res) ?? res;
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.items)) return raw.items;
        return [];
      },
      providesTags: [{ type: "Parties", id: "COUNTRIES" }],
    }),
    getPartyStates: build.query<
      PartyStateRecord[],
      { country_id?: string; limit?: number; status?: string } | void
    >({
      query: (params) => {
        const query = new URLSearchParams();
        if (params?.country_id) query.append("country_id", params.country_id);
        query.append("limit", String(params?.limit ?? 1000));
        query.append("status", params?.status ?? "active");
        return {
          url: `${PARTY_SERVICE_URL}/api/party-states?${query.toString()}`,
        };
      },
      transformResponse: (res: any) => {
        const raw = unwrapEnvelope(res) ?? res;
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.items)) return raw.items;
        return [];
      },
      providesTags: [{ type: "Parties", id: "STATES" }],
    }),
    getPartyCities: build.query<
      PartyCityRecord[],
      { state_id?: string; country_id?: string; limit?: number; status?: string } | void
    >({
      query: (params) => {
        const query = new URLSearchParams();
        if (params?.state_id) query.append("state_id", params.state_id);
        if (params?.country_id) query.append("country_id", params.country_id);
        query.append("limit", String(params?.limit ?? 5000));
        query.append("status", params?.status ?? "active");
        return {
          url: `${PARTY_SERVICE_URL}/api/party-cities?${query.toString()}`,
        };
      },
      transformResponse: (res: any) => {
        const raw = unwrapEnvelope(res) ?? res;
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.items)) return raw.items;
        return [];
      },
      providesTags: [{ type: "Parties", id: "CITIES" }],
    }),
  }),
});

export const {
  useListPartiesQuery,
  useLazyListPartiesQuery,
  useListPartiesDeletedQuery,
  useLazyListPartiesDeletedQuery,
  useGetPartyQuery,
  useLazyGetPartyQuery,
  useCreatePartyMutation,
  usePatchPartyMutation,
  useDeletePartyMutation,
  useRestorePartyMutation,
  useBulkCreatePartyMutation,
  useBulkDeletePartiesMutation,
  useGetPartyCountriesQuery,
  useLazyGetPartyCountriesQuery,
  useGetPartyStatesQuery,
  useLazyGetPartyStatesQuery,
  useGetPartyCitiesQuery,
  useLazyGetPartyCitiesQuery,
} = partiesApi;

export const useGetPartiesQuery = useListPartiesQuery;
export const useGetPartyByIdQuery = useGetPartyQuery;
export const useLazyGetPartyByIdQuery = useLazyGetPartyQuery;
