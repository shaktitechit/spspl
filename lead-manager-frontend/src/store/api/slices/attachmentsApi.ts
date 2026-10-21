/**
 * @fileoverview RTK Query API slice for lead/quotation attachments.
 * Attachment `url` is a fresh file-manager (fapi) presigned view URL — open directly in the browser.
 * @module store/api/slices/attachmentsApi
 */
import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

export type AttachmentUploadedBy = {
  _id?: string;
  name?: string;
  email?: string;
};

export type AttachmentRecord = {
  _id: string;
  /** File-management service fileId */
  filename?: string;
  original_name: string;
  file_name?: string;
  mime_type?: string;
  size?: number;
  storage_path?: string;
  /** Fresh file-manager presigned view URL (resolved by backend on read) */
  url?: string;
  entity_type?: string;
  entity_id?: string;
  remarks?: string;
  uploaded_by?: AttachmentUploadedBy;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type AttachmentListParams = {
  entity_type?: string;
  entity_id?: string;
};

function asAttachmentList(data: unknown): AttachmentRecord[] {
  if (Array.isArray(data)) return data as AttachmentRecord[];
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: AttachmentRecord[] }).items;
  }
  return [];
}

/** `/api/attachments` — uploads go through lead-manager → file-manager API */
export const attachmentsApi = medicaApi.injectEndpoints({
  endpoints: (build) => ({
    listAttachments: build.query<AttachmentRecord[], AttachmentListParams | void>({
      query: (params) => ({
        url: "attachments",
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) =>
        asAttachmentList(unwrapEnvelope(raw)),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: "Attachments" as const, id: _id })),
              { type: "Attachments", id: "LIST" },
            ]
          : [{ type: "Attachments", id: "LIST" }],
    }),
    listAttachmentsDeleted: build.query<AttachmentRecord[], AttachmentListParams | void>({
      query: (params) => ({
        url: "attachments/deleted",
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) =>
        asAttachmentList(unwrapEnvelope(raw)),
      providesTags: [{ type: "Attachments", id: "DELETED" }],
    }),
    getAttachment: build.query<AttachmentRecord, string>({
      query: (id) => `attachments/${id}`,
      transformResponse: (raw: ApiEnvelope<AttachmentRecord>) => unwrapEnvelope(raw),
      providesTags: (_r, _e, id) => [{ type: "Attachments", id }],
    }),
    createAttachment: build.mutation<AttachmentRecord, FormData>({
      query: (body) => ({ url: "attachments", method: "POST", body }),
      transformResponse: (raw: ApiEnvelope<AttachmentRecord>) => unwrapEnvelope(raw),
      invalidatesTags: [{ type: "Attachments", id: "LIST" }],
    }),
    deleteAttachment: build.mutation<AttachmentRecord, string>({
      query: (id) => ({ url: `attachments/${id}`, method: "DELETE" }),
      transformResponse: (raw: ApiEnvelope<AttachmentRecord>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        { type: "Attachments", id },
        { type: "Attachments", id: "LIST" },
        { type: "Attachments", id: "DELETED" },
      ],
    }),
    restoreAttachment: build.mutation<AttachmentRecord, string>({
      query: (id) => ({
        url: `attachments/${id}/restore`,
        method: "POST",
      }),
      transformResponse: (raw: ApiEnvelope<AttachmentRecord>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, id) => [
        { type: "Attachments", id },
        { type: "Attachments", id: "LIST" },
        { type: "Attachments", id: "DELETED" },
      ],
    }),
  }),
});

export const {
  useListAttachmentsQuery,
  useLazyListAttachmentsQuery,
  useListAttachmentsDeletedQuery,
  useLazyListAttachmentsDeletedQuery,
  useGetAttachmentQuery,
  useLazyGetAttachmentQuery,
  useCreateAttachmentMutation,
  useDeleteAttachmentMutation,
  useRestoreAttachmentMutation,
} = attachmentsApi;
