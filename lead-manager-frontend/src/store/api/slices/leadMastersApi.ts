/**
 * @fileoverview RTK Query API slice for Lead Masters (Sources and Lost Reasons).
 * @module store/api/slices/leadMastersApi
 */
import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

export type LeadSourceRecord = {
  _id: string;
  id?: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  is_system: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LeadLostReasonRecord = {
  _id: string;
  id?: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  is_system: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LeadDepartmentRecord = {
  _id: string;
  id?: string;
  name: string;
  code?: string;
  description?: string;
  sort_order?: number;
  is_active: boolean;
  is_system: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export const leadMastersApi = medicaApi.injectEndpoints({
  overrideExisting: false,
  endpoints: (build) => ({
    listLeadSources: build.query<LeadSourceRecord[], void>({
      query: () => "/lead-masters/sources",
      transformResponse: (res: ApiEnvelope<LeadSourceRecord[]>) => unwrapEnvelope(res),
      providesTags: [{ type: "LeadMaster" as const, id: "SOURCES" }],
    }),

    createLeadSource: build.mutation<LeadSourceRecord, Partial<LeadSourceRecord>>({
      query: (body) => ({
        url: "/lead-masters/sources",
        method: "POST",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadSourceRecord>) => unwrapEnvelope(res),
      invalidatesTags: [{ type: "LeadMaster", id: "SOURCES" }],
    }),

    updateLeadSource: build.mutation<
      LeadSourceRecord,
      { id: string; body: Partial<LeadSourceRecord> }
    >({
      query: ({ id, body }) => ({
        url: `/lead-masters/sources/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadSourceRecord>) => unwrapEnvelope(res),
      invalidatesTags: [{ type: "LeadMaster", id: "SOURCES" }],
    }),

    deleteLeadSource: build.mutation<{ _id: string }, string>({
      query: (id) => ({
        url: `/lead-masters/sources/${id}`,
        method: "DELETE",
      }),
      transformResponse: (res: ApiEnvelope<{ _id: string }>) => unwrapEnvelope(res),
      invalidatesTags: [{ type: "LeadMaster", id: "SOURCES" }],
    }),

    listLeadLostReasons: build.query<LeadLostReasonRecord[], void>({
      query: () => "/lead-masters/lost-reasons",
      transformResponse: (res: ApiEnvelope<LeadLostReasonRecord[]>) => unwrapEnvelope(res),
      providesTags: [{ type: "LeadMaster" as const, id: "LOST_REASONS" }],
    }),

    createLeadLostReason: build.mutation<LeadLostReasonRecord, Partial<LeadLostReasonRecord>>({
      query: (body) => ({
        url: "/lead-masters/lost-reasons",
        method: "POST",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadLostReasonRecord>) => unwrapEnvelope(res),
      invalidatesTags: [{ type: "LeadMaster", id: "LOST_REASONS" }],
    }),

    updateLeadLostReason: build.mutation<
      LeadLostReasonRecord,
      { id: string; body: Partial<LeadLostReasonRecord> }
    >({
      query: ({ id, body }) => ({
        url: `/lead-masters/lost-reasons/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadLostReasonRecord>) => unwrapEnvelope(res),
      invalidatesTags: [{ type: "LeadMaster", id: "LOST_REASONS" }],
    }),

    deleteLeadLostReason: build.mutation<{ _id: string }, string>({
      query: (id) => ({
        url: `/lead-masters/lost-reasons/${id}`,
        method: "DELETE",
      }),
      transformResponse: (res: ApiEnvelope<{ _id: string }>) => unwrapEnvelope(res),
      invalidatesTags: [{ type: "LeadMaster", id: "LOST_REASONS" }],
    }),

    listLeadDepartments: build.query<LeadDepartmentRecord[], void>({
      query: () => "/lead-masters/departments",
      transformResponse: (res: ApiEnvelope<LeadDepartmentRecord[]>) => unwrapEnvelope(res),
      providesTags: [{ type: "LeadMaster" as const, id: "DEPARTMENTS" }],
    }),

    createLeadDepartment: build.mutation<LeadDepartmentRecord, Partial<LeadDepartmentRecord>>({
      query: (body) => ({
        url: "/lead-masters/departments",
        method: "POST",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadDepartmentRecord>) => unwrapEnvelope(res),
      invalidatesTags: [{ type: "LeadMaster", id: "DEPARTMENTS" }],
    }),

    updateLeadDepartment: build.mutation<
      LeadDepartmentRecord,
      { id: string; body: Partial<LeadDepartmentRecord> }
    >({
      query: ({ id, body }) => ({
        url: `/lead-masters/departments/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: ApiEnvelope<LeadDepartmentRecord>) => unwrapEnvelope(res),
      invalidatesTags: [{ type: "LeadMaster", id: "DEPARTMENTS" }],
    }),

    deleteLeadDepartment: build.mutation<{ _id: string }, string>({
      query: (id) => ({
        url: `/lead-masters/departments/${id}`,
        method: "DELETE",
      }),
      transformResponse: (res: ApiEnvelope<{ _id: string }>) => unwrapEnvelope(res),
      invalidatesTags: [{ type: "LeadMaster", id: "DEPARTMENTS" }],
    }),
  }),
});

export const {
  useListLeadSourcesQuery,
  useCreateLeadSourceMutation,
  useUpdateLeadSourceMutation,
  useDeleteLeadSourceMutation,
  useListLeadLostReasonsQuery,
  useCreateLeadLostReasonMutation,
  useUpdateLeadLostReasonMutation,
  useDeleteLeadLostReasonMutation,
  useListLeadDepartmentsQuery,
  useCreateLeadDepartmentMutation,
  useUpdateLeadDepartmentMutation,
  useDeleteLeadDepartmentMutation,
} = leadMastersApi;
