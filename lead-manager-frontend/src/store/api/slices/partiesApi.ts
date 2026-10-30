import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";
import { PARTY_SERVICE_URL } from "@/lib/env";

export type PartyCountryRecord = {
  _id: string;
  id?: string;
  name: string;
  iso_code?: string;
  phone_code?: string;
  currency?: string;
  description?: string;
  status?: string;
  is_active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PartyStateRecord = {
  _id: string;
  id?: string;
  country: string | PartyCountryRecord;
  name: string;
  state_code?: string;
  description?: string;
  status?: string;
  is_active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PartyCityRecord = {
  _id: string;
  id?: string;
  state: string | PartyStateRecord;
  country?: string;
  name: string;
  district?: string;
  description?: string;
  status?: string;
  is_active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ZoneRecord = {
  _id: string;
  name: string;
  description?: string;
  is_active: boolean;
  parties?: any[];
  sales_persons?: any[];
  createdAt?: string;
  updatedAt?: string;
};

export type PartyShippingAddress = {
  _id?: string;
  id?: string;
  label?: string;
  recipient_name?: string;
  phone?: string;
  gst_no?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  is_default?: boolean;
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
  shipping_addresses?: PartyShippingAddress[];
  district?: string;
  state?: string;
  city?: string;
  country?: string;
  country_id?: string | null;
  state_id?: string | null;
  city_id?: string | null;
  zone_id?: string | null;
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
    listPartyCountries: build.query<
      { data: PartyCountryRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: `${PARTY_SERVICE_URL}/api/party-countries`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [
        { type: "PartyCountries", id: "LIST" },
        { type: "Parties", id: "COUNTRIES" },
      ],
    }),
    getPartyCountry: build.query<PartyCountryRecord, string>({
      query: (id) => `${PARTY_SERVICE_URL}/api/party-countries/${id}`,
      transformResponse: (raw: ApiEnvelope<PartyCountryRecord>) =>
        unwrapEnvelope(raw) as PartyCountryRecord,
      providesTags: (_r, _e, id) => [{ type: "PartyCountries", id }],
    }),
    createPartyCountry: build.mutation<PartyCountryRecord, Partial<PartyCountryRecord>>({
      query: (body) => ({
        url: `${PARTY_SERVICE_URL}/api/party-countries`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<PartyCountryRecord>) =>
        unwrapEnvelope(raw) as PartyCountryRecord,
      invalidatesTags: [
        { type: "PartyCountries", id: "LIST" },
        { type: "Parties", id: "COUNTRIES" },
      ],
    }),
    patchPartyCountry: build.mutation<
      PartyCountryRecord,
      { id: string; patch: Partial<PartyCountryRecord> }
    >({
      query: ({ id, patch }) => ({
        url: `${PARTY_SERVICE_URL}/api/party-countries/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<PartyCountryRecord>) =>
        unwrapEnvelope(raw) as PartyCountryRecord,
      invalidatesTags: (_r, _e, arg) => [
        "PartyCountries",
        { type: "PartyCountries", id: arg.id },
        { type: "PartyCountries", id: "LIST" },
        { type: "Parties", id: "COUNTRIES" },
      ],
    }),
    deletePartyCountry: build.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `${PARTY_SERVICE_URL}/api/party-countries/${id}`,
        method: "DELETE",
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        "PartyCountries",
        { type: "PartyCountries", id },
        { type: "PartyCountries", id: "LIST" },
        { type: "Parties", id: "COUNTRIES" },
      ],
    }),
    listPartyStates: build.query<
      { data: PartyStateRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: `${PARTY_SERVICE_URL}/api/party-states`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [
        { type: "PartyStates", id: "LIST" },
        { type: "Parties", id: "STATES" },
      ],
    }),
    getPartyState: build.query<PartyStateRecord, string>({
      query: (id) => `${PARTY_SERVICE_URL}/api/party-states/${id}`,
      transformResponse: (raw: ApiEnvelope<PartyStateRecord>) =>
        unwrapEnvelope(raw) as PartyStateRecord,
      providesTags: (_r, _e, id) => [{ type: "PartyStates", id }],
    }),
    createPartyState: build.mutation<
      PartyStateRecord,
      Partial<PartyStateRecord> & { country: string }
    >({
      query: (body) => ({
        url: `${PARTY_SERVICE_URL}/api/party-states`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<PartyStateRecord>) =>
        unwrapEnvelope(raw) as PartyStateRecord,
      invalidatesTags: [
        { type: "PartyStates", id: "LIST" },
        { type: "Parties", id: "STATES" },
      ],
    }),
    patchPartyState: build.mutation<
      PartyStateRecord,
      { id: string; patch: Partial<PartyStateRecord> & { country?: string } }
    >({
      query: ({ id, patch }) => ({
        url: `${PARTY_SERVICE_URL}/api/party-states/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<PartyStateRecord>) =>
        unwrapEnvelope(raw) as PartyStateRecord,
      invalidatesTags: (_r, _e, arg) => [
        "PartyStates",
        { type: "PartyStates", id: arg.id },
        { type: "PartyStates", id: "LIST" },
        { type: "Parties", id: "STATES" },
      ],
    }),
    deletePartyState: build.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `${PARTY_SERVICE_URL}/api/party-states/${id}`,
        method: "DELETE",
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        "PartyStates",
        { type: "PartyStates", id },
        { type: "PartyStates", id: "LIST" },
        { type: "Parties", id: "STATES" },
      ],
    }),
    listPartyCities: build.query<
      { data: PartyCityRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: `${PARTY_SERVICE_URL}/api/party-cities`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [
        { type: "PartyCities", id: "LIST" },
        { type: "Parties", id: "CITIES" },
      ],
    }),
    getPartyCity: build.query<PartyCityRecord, string>({
      query: (id) => `${PARTY_SERVICE_URL}/api/party-cities/${id}`,
      transformResponse: (raw: ApiEnvelope<PartyCityRecord>) =>
        unwrapEnvelope(raw) as PartyCityRecord,
      providesTags: (_r, _e, id) => [{ type: "PartyCities", id }],
    }),
    createPartyCity: build.mutation<
      PartyCityRecord,
      Partial<PartyCityRecord> & { state: string }
    >({
      query: (body) => ({
        url: `${PARTY_SERVICE_URL}/api/party-cities`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<PartyCityRecord>) =>
        unwrapEnvelope(raw) as PartyCityRecord,
      invalidatesTags: [
        { type: "PartyCities", id: "LIST" },
        { type: "Parties", id: "CITIES" },
      ],
    }),
    patchPartyCity: build.mutation<
      PartyCityRecord,
      { id: string; patch: Partial<PartyCityRecord> & { state?: string } }
    >({
      query: ({ id, patch }) => ({
        url: `${PARTY_SERVICE_URL}/api/party-cities/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<PartyCityRecord>) =>
        unwrapEnvelope(raw) as PartyCityRecord,
      invalidatesTags: (_r, _e, arg) => [
        "PartyCities",
        { type: "PartyCities", id: arg.id },
        { type: "PartyCities", id: "LIST" },
        { type: "Parties", id: "CITIES" },
      ],
    }),
    deletePartyCity: build.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `${PARTY_SERVICE_URL}/api/party-cities/${id}`,
        method: "DELETE",
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        "PartyCities",
        { type: "PartyCities", id },
        { type: "PartyCities", id: "LIST" },
        { type: "Parties", id: "CITIES" },
      ],
    }),
    listZones: build.query<
      { data: ZoneRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: `${PARTY_SERVICE_URL}/api/zones`,
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Zones", id: "LIST" }],
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
  useListPartyCountriesQuery,
  useLazyListPartyCountriesQuery,
  useGetPartyCountryQuery,
  useCreatePartyCountryMutation,
  usePatchPartyCountryMutation,
  useDeletePartyCountryMutation,
  useListPartyStatesQuery,
  useLazyListPartyStatesQuery,
  useGetPartyStateQuery,
  useCreatePartyStateMutation,
  usePatchPartyStateMutation,
  useDeletePartyStateMutation,
  useListPartyCitiesQuery,
  useLazyListPartyCitiesQuery,
  useGetPartyCityQuery,
  useCreatePartyCityMutation,
  usePatchPartyCityMutation,
  useDeletePartyCityMutation,
  useListZonesQuery,
  useLazyListZonesQuery,
} = partiesApi;

export const useGetPartiesQuery = useListPartiesQuery;
export const useGetPartyByIdQuery = useGetPartyQuery;
export const useLazyGetPartyByIdQuery = useLazyGetPartyQuery;
