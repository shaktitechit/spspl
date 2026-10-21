import { baseApi } from "./baseApi";
import { PARTY_SERVICE_URL } from "@/lib/env";
import type {
  PartyCityRecord,
  PartyCountryRecord,
  PartyListParams,
  PartyListResponse,
  PartyRecord,
  PartyStateRecord,
} from "@/types/party";

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
} = partyApiSlice;

