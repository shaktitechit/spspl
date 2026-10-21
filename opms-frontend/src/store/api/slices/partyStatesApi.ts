import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";
import type { PartyCountryRecord } from "./partyCountriesApi";

export type PartyStateRecord = {
  _id: string;
  name: string;
  country: string | PartyCountryRecord;
  description?: string;
  is_active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export const partyStatesApi = medicaApi.injectEndpoints({
  endpoints: (build) => ({
    listPartyStates: build.query<
      { data: PartyStateRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: "party-states",
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [{ type: "PartyStates", id: "LIST" }],
    }),
    getPartyState: build.query<PartyStateRecord, string>({
      query: (id) => `party-states/${id}`,
      transformResponse: (raw: ApiEnvelope<PartyStateRecord>) =>
        unwrapEnvelope(raw) as PartyStateRecord,
      providesTags: (_r, _e, id) => [{ type: "PartyStates", id }],
    }),
    createPartyState: build.mutation<
      PartyStateRecord,
      Partial<PartyStateRecord> & { country: string }
    >({
      query: (body) => ({ url: "party-states", method: "POST", body }),
      transformResponse: (raw: ApiEnvelope<PartyStateRecord>) =>
        unwrapEnvelope(raw) as PartyStateRecord,
      invalidatesTags: [{ type: "PartyStates", id: "LIST" }],
    }),
    patchPartyState: build.mutation<
      PartyStateRecord,
      { id: string; patch: Partial<PartyStateRecord> & { country?: string } }
    >({
      query: ({ id, patch }) => ({
        url: `party-states/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<PartyStateRecord>) =>
        unwrapEnvelope(raw) as PartyStateRecord,
      invalidatesTags: (_r, _e, arg) => [
        "PartyStates",
        { type: "PartyStates", id: arg.id },
        { type: "PartyStates", id: "LIST" },
      ],
    }),
    deletePartyState: build.mutation<{ success: boolean }, string>({
      query: (id) => ({ url: `party-states/${id}`, method: "DELETE" }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        "PartyStates",
        { type: "PartyStates", id },
        { type: "PartyStates", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListPartyStatesQuery,
  useLazyListPartyStatesQuery,
  useGetPartyStateQuery,
  useCreatePartyStateMutation,
  usePatchPartyStateMutation,
  useDeletePartyStateMutation,
} = partyStatesApi;
