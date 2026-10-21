import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

export type PartyCountryRecord = {
  _id: string;
  name: string;
  iso_code?: string;
  description?: string;
  is_active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export const partyCountriesApi = medicaApi.injectEndpoints({
  endpoints: (build) => ({
    listPartyCountries: build.query<
      { data: PartyCountryRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: "party-countries",
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [{ type: "PartyCountries", id: "LIST" }],
    }),
    getPartyCountry: build.query<PartyCountryRecord, string>({
      query: (id) => `party-countries/${id}`,
      transformResponse: (raw: ApiEnvelope<PartyCountryRecord>) =>
        unwrapEnvelope(raw) as PartyCountryRecord,
      providesTags: (_r, _e, id) => [{ type: "PartyCountries", id }],
    }),
    createPartyCountry: build.mutation<PartyCountryRecord, Partial<PartyCountryRecord>>({
      query: (body) => ({ url: "party-countries", method: "POST", body }),
      transformResponse: (raw: ApiEnvelope<PartyCountryRecord>) =>
        unwrapEnvelope(raw) as PartyCountryRecord,
      invalidatesTags: [{ type: "PartyCountries", id: "LIST" }],
    }),
    patchPartyCountry: build.mutation<
      PartyCountryRecord,
      { id: string; patch: Partial<PartyCountryRecord> }
    >({
      query: ({ id, patch }) => ({
        url: `party-countries/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<PartyCountryRecord>) =>
        unwrapEnvelope(raw) as PartyCountryRecord,
      invalidatesTags: (_r, _e, arg) => [
        "PartyCountries",
        { type: "PartyCountries", id: arg.id },
        { type: "PartyCountries", id: "LIST" },
      ],
    }),
    deletePartyCountry: build.mutation<{ success: boolean }, string>({
      query: (id) => ({ url: `party-countries/${id}`, method: "DELETE" }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        "PartyCountries",
        { type: "PartyCountries", id },
        { type: "PartyCountries", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListPartyCountriesQuery,
  useLazyListPartyCountriesQuery,
  useGetPartyCountryQuery,
  useCreatePartyCountryMutation,
  usePatchPartyCountryMutation,
  useDeletePartyCountryMutation,
} = partyCountriesApi;
