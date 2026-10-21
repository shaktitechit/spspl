import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";
import type { PartyStateRecord } from "./partyStatesApi";

export type PartyCityRecord = {
  _id: string;
  name: string;
  state: string | PartyStateRecord;
  description?: string;
  is_active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export const partyCitiesApi = medicaApi.injectEndpoints({
  endpoints: (build) => ({
    listPartyCities: build.query<
      { data: PartyCityRecord[]; total: number; page: number; limit: number; pages: number },
      Record<string, string | number | undefined> | void
    >({
      query: (params) => ({
        url: "party-cities",
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      providesTags: [{ type: "PartyCities", id: "LIST" }],
    }),
    getPartyCity: build.query<PartyCityRecord, string>({
      query: (id) => `party-cities/${id}`,
      transformResponse: (raw: ApiEnvelope<PartyCityRecord>) =>
        unwrapEnvelope(raw) as PartyCityRecord,
      providesTags: (_r, _e, id) => [{ type: "PartyCities", id }],
    }),
    createPartyCity: build.mutation<
      PartyCityRecord,
      Partial<PartyCityRecord> & { state: string }
    >({
      query: (body) => ({ url: "party-cities", method: "POST", body }),
      transformResponse: (raw: ApiEnvelope<PartyCityRecord>) =>
        unwrapEnvelope(raw) as PartyCityRecord,
      invalidatesTags: [{ type: "PartyCities", id: "LIST" }],
    }),
    patchPartyCity: build.mutation<
      PartyCityRecord,
      { id: string; patch: Partial<PartyCityRecord> & { state?: string } }
    >({
      query: ({ id, patch }) => ({
        url: `party-cities/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<PartyCityRecord>) =>
        unwrapEnvelope(raw) as PartyCityRecord,
      invalidatesTags: (_r, _e, arg) => [
        "PartyCities",
        { type: "PartyCities", id: arg.id },
        { type: "PartyCities", id: "LIST" },
      ],
    }),
    deletePartyCity: build.mutation<{ success: boolean }, string>({
      query: (id) => ({ url: `party-cities/${id}`, method: "DELETE" }),
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        "PartyCities",
        { type: "PartyCities", id },
        { type: "PartyCities", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListPartyCitiesQuery,
  useLazyListPartyCitiesQuery,
  useGetPartyCityQuery,
  useCreatePartyCityMutation,
  usePatchPartyCityMutation,
  useDeletePartyCityMutation,
} = partyCitiesApi;
