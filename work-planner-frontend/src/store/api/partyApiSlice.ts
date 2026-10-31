import { baseApi } from "./baseApi";
import { PARTY_SERVICE_URL } from "@/lib/env";
import type {
  PartyCityRecord,
  PartyCountryRecord,
  PartyListParams,
  PartyListResponse,
  PartyRecord,
  PartyStateRecord,
  PartyShippingAddress,
  ZoneRecord,
} from "@/types/party";

export type {
  PartyCityRecord,
  PartyCountryRecord,
  PartyListParams,
  PartyListResponse,
  PartyRecord,
  PartyStateRecord,
  PartyShippingAddress,
  ZoneRecord,
};

export const partyApiSlice = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getParties: builder.query<PartyRecord[], PartyListParams | void>({
      query: (params) => {
        const query = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") query.append(k, String(v));
          });
        }
        const qStr = query.toString();
        const path = qStr ? `parties?${qStr}` : "parties";
        if (PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)) {
          return `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/${path}`;
        }
        return path;
      },
      transformResponse: (res: any) => {
        const rawData = res?.data ?? res;
        if (Array.isArray(rawData)) return rawData;
        if (rawData?.items && Array.isArray(rawData.items)) return rawData.items;
        if (rawData?.data && Array.isArray(rawData.data)) return rawData.data;
        return [];
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id, id }) => ({ type: "Party" as const, id: _id || id })),
              { type: "Party", id: "LIST" },
            ]
          : [{ type: "Party", id: "LIST" }],
    }),
    getPartyById: builder.query<PartyRecord, string>({
      query: (id) => {
        if (PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)) {
          return `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/parties/${id}`;
        }
        return `parties/${id}`;
      },
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: (_result, _error, id) => [{ type: "Party", id }],
    }),
    getPartyCountries: builder.query<PartyCountryRecord[], { limit?: number; status?: string } | void>({
      query: (params) => {
        const query = new URLSearchParams();
        query.append("limit", String(params?.limit ?? 500));
        query.append("status", params?.status ?? "active");
        const path = `party-countries?${query.toString()}`;
        if (PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)) {
          return `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/${path}`;
        }
        return path;
      },
      transformResponse: (res: any) => {
        const raw = res?.data ?? res;
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.items)) return raw.items;
        return [];
      },
      providesTags: ["Party" as const],
    }),
    getPartyStates: builder.query<
      PartyStateRecord[],
      { country_id?: string; limit?: number; status?: string } | void
    >({
      query: (params) => {
        const query = new URLSearchParams();
        if (params?.country_id) query.append("country_id", params.country_id);
        query.append("limit", String(params?.limit ?? 1000));
        query.append("status", params?.status ?? "active");
        const path = `party-states?${query.toString()}`;
        if (PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)) {
          return `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/${path}`;
        }
        return path;
      },
      transformResponse: (res: any) => {
        const raw = res?.data ?? res;
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.items)) return raw.items;
        return [];
      },
      providesTags: ["Party" as const],
    }),
    getPartyCities: builder.query<
      PartyCityRecord[],
      { state_id?: string; country_id?: string; limit?: number; status?: string } | void
    >({
      query: (params) => {
        const query = new URLSearchParams();
        if (params?.state_id) query.append("state_id", params.state_id);
        if (params?.country_id) query.append("country_id", params.country_id);
        query.append("limit", String(params?.limit ?? 5000));
        query.append("status", params?.status ?? "active");
        const path = `party-cities?${query.toString()}`;
        if (PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)) {
          return `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/${path}`;
        }
        return path;
      },
      transformResponse: (res: any) => {
        const raw = res?.data ?? res;
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.items)) return raw.items;
        return [];
      },
      providesTags: ["Party" as const],
    }),
    createParty: builder.mutation<any, any>({
      query: (body) => ({
        url: PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)
          ? `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/parties`
          : "parties",
        method: "POST",
        body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: [{ type: "Party", id: "LIST" }],
    }),
    patchParty: builder.mutation<any, { id: string; patch: any }>({
      query: ({ id, patch }) => ({
        url: PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)
          ? `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/parties/${id}`
          : `parties/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: (_result, _error, arg) => [
        { type: "Party", id: arg.id },
        { type: "Party", id: "LIST" },
      ],
    }),
    getPartyCountry: builder.query<PartyCountryRecord, string>({
      query: (id) => {
        const path = `party-countries/${id}`;
        if (PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)) {
          return `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/${path}`;
        }
        return path;
      },
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: (_r, _e, id) => [{ type: "Party" as const, id: `country-${id}` }],
    }),
    createPartyCountry: builder.mutation<PartyCountryRecord, Partial<PartyCountryRecord>>({
      query: (body) => ({
        url: PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)
          ? `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/party-countries`
          : "party-countries",
        method: "POST",
        body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: ["Party" as const],
    }),
    patchPartyCountry: builder.mutation<PartyCountryRecord, { id: string; patch: Partial<PartyCountryRecord> }>({
      query: ({ id, patch }) => ({
        url: PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)
          ? `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/party-countries/${id}`
          : `party-countries/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: ["Party" as const],
    }),
    getPartyState: builder.query<PartyStateRecord, string>({
      query: (id) => {
        const path = `party-states/${id}`;
        if (PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)) {
          return `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/${path}`;
        }
        return path;
      },
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: (_r, _e, id) => [{ type: "Party" as const, id: `state-${id}` }],
    }),
    createPartyState: builder.mutation<PartyStateRecord, Partial<PartyStateRecord>>({
      query: (body) => ({
        url: PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)
          ? `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/party-states`
          : "party-states",
        method: "POST",
        body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: ["Party" as const],
    }),
    patchPartyState: builder.mutation<PartyStateRecord, { id: string; patch: Partial<PartyStateRecord> }>({
      query: ({ id, patch }) => ({
        url: PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)
          ? `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/party-states/${id}`
          : `party-states/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: ["Party" as const],
    }),
    getPartyCity: builder.query<PartyCityRecord, string>({
      query: (id) => {
        const path = `party-cities/${id}`;
        if (PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)) {
          return `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/${path}`;
        }
        return path;
      },
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: (_r, _e, id) => [{ type: "Party" as const, id: `city-${id}` }],
    }),
    createPartyCity: builder.mutation<PartyCityRecord, Partial<PartyCityRecord>>({
      query: (body) => ({
        url: PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)
          ? `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/party-cities`
          : "party-cities",
        method: "POST",
        body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: ["Party" as const],
    }),
    patchPartyCity: builder.mutation<PartyCityRecord, { id: string; patch: Partial<PartyCityRecord> }>({
      query: ({ id, patch }) => ({
        url: PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)
          ? `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/party-cities/${id}`
          : `party-cities/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: ["Party" as const],
    }),
    listZones: builder.query<{ data: ZoneRecord[] } | ZoneRecord[], { limit?: number; status?: string } | void>({
      query: (params) => {
        const query = new URLSearchParams();
        if (params?.limit) query.append("limit", String(params.limit));
        if (params?.status) query.append("status", params.status);
        const path = `zones${query.toString() ? `?${query.toString()}` : ""}`;
        if (PARTY_SERVICE_URL && /^https?:\/\//i.test(PARTY_SERVICE_URL)) {
          return `${PARTY_SERVICE_URL.replace(/\/$/, "")}/api/${path}`;
        }
        return path;
      },
      transformResponse: (res: any) => {
        const raw = res?.data ?? res;
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.items)) return raw.items;
        return [];
      },
      providesTags: ["Party" as const],
    }),
  }),
});

export const {
  useGetPartiesQuery,
  useLazyGetPartiesQuery,
  useGetPartyByIdQuery,
  useLazyGetPartyByIdQuery,
  useGetPartyCountriesQuery,
  useLazyGetPartyCountriesQuery,
  useGetPartyStatesQuery,
  useLazyGetPartyStatesQuery,
  useGetPartyCitiesQuery,
  useLazyGetPartyCitiesQuery,
  useCreatePartyMutation,
  usePatchPartyMutation,
  useGetPartyCountryQuery,
  useCreatePartyCountryMutation,
  usePatchPartyCountryMutation,
  useGetPartyStateQuery,
  useCreatePartyStateMutation,
  usePatchPartyStateMutation,
  useGetPartyCityQuery,
  useCreatePartyCityMutation,
  usePatchPartyCityMutation,
  useListZonesQuery,
} = partyApiSlice;

// Compatibility aliases matching lead-manager / opms hooks
export const useGetPartyQuery = useGetPartyByIdQuery;
export const useLazyGetPartyQuery = useLazyGetPartyByIdQuery;
export const useListPartiesQuery = useGetPartiesQuery;
export const useLazyListPartiesQuery = useLazyGetPartiesQuery;
export const useListPartyCountriesQuery = useGetPartyCountriesQuery;
export const useListPartyStatesQuery = useGetPartyStatesQuery;
export const useListPartyCitiesQuery = useGetPartyCitiesQuery;

