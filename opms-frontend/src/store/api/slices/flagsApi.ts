import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

export type OpmsMember = {
  _id: string;
  name: string;
  email: string;
  department: string;
  opms_role: string;
  is_active: boolean;
};

export type FlagMessageAttachment = {
  attachment_id?: string;
  fileId?: string;
  original_name: string;
  file_url: string;
  view_url?: string;
  download_url?: string;
  mime_type?: string;
  size_bytes?: number;
};

export type FlagMessageRecord = {
  _id: string;
  flag: string;
  order: string;
  sender: {
    _id: string;
    name: string;
    email?: string;
    department?: string;
  } | string;
  sender_name: string;
  sender_role?: string;
  sender_department?: string;
  message_type: "text" | "status_change" | "system_event" | "file";
  content: string;
  status_change?: {
    from_status?: string;
    to_status?: string;
  };
  attachments?: FlagMessageAttachment[];
  mentions?: string[];
  read_by?: { user: string; read_at: string }[];
  createdAt: string;
  updatedAt: string;
};

/** `/api/flags` — order/issue flags suite & chat loop. */
export const flagsApi = medicaApi.injectEndpoints({
  endpoints: (build) => ({
    listOpmsMembers: build.query<OpmsMember[], void>({
      query: () => ({ url: "flags/members", method: "GET" }),
      transformResponse: (raw: ApiEnvelope<OpmsMember[]>) => unwrapEnvelope(raw) as OpmsMember[],
      providesTags: [{ type: "Flags", id: "MEMBERS" }],
    }),
    listFlags: build.query<unknown, Record<string, string | undefined> | void>({
      query: (params) => ({
        url: "flags",
        params: params ?? {},
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Flags", id: "LIST" }],
    }),
    getFlag: build.query<unknown, string>({
      query: (id) => `flags/${id}`,
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: (_r, _e, id) => [{ type: "Flags", id }],
    }),
    createFlag: build.mutation<unknown, Record<string, unknown>>({
      query: (body) => ({ url: "flags", method: "POST", body }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: ["Flags", "Orders"],
    }),
    patchFlag: build.mutation<
      unknown,
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `flags/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, arg) => [
        "Flags",
        { type: "Flags", id: arg.id },
        "Orders",
      ],
    }),
    listFlagMessages: build.query<FlagMessageRecord[], string>({
      query: (flagId) => `flags/${flagId}/messages`,
      transformResponse: (raw: ApiEnvelope<FlagMessageRecord[]>) =>
        unwrapEnvelope(raw) as FlagMessageRecord[],
      providesTags: (_r, _e, id) => [{ type: "FlagMessages", id }],
    }),
    createFlagMessage: build.mutation<
      FlagMessageRecord,
      { flagId: string; content?: string; message_type?: string; attachments?: any[] }
    >({
      query: ({ flagId, ...body }) => ({
        url: `flags/${flagId}/messages`,
        method: "POST",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<FlagMessageRecord>) =>
        unwrapEnvelope(raw) as FlagMessageRecord,
      invalidatesTags: (_r, _e, arg) => [
        { type: "FlagMessages", id: arg.flagId },
        "Flags",
      ],
    }),
    uploadFlagChatFile: build.mutation<
      {
        attachment_id: string;
        fileId: string;
        original_name: string;
        mime_type: string;
        size_bytes: number;
        view_url: string;
        download_url: string;
        file_url: string;
      },
      { flagId: string; file: File }
    >({
      query: ({ flagId, file }) => {
        const formData = new FormData();
        formData.append("file", file);
        return {
          url: `flags/${flagId}/upload`,
          method: "POST",
          body: formData,
        };
      },
      transformResponse: (raw: ApiEnvelope<any>) => unwrapEnvelope(raw),
    }),
    updateFlagStatus: build.mutation<
      unknown,
      { id: string; status: string; resolution_note?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `flags/${id}/status`,
        method: "PATCH",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      invalidatesTags: (_r, _e, arg) => [
        "Flags",
        { type: "Flags", id: arg.id },
        { type: "FlagMessages", id: arg.id },
        "Orders",
      ],
    }),
  }),
});

export const {
  useListOpmsMembersQuery,
  useLazyListOpmsMembersQuery,
  useListFlagsQuery,
  useLazyListFlagsQuery,
  useGetFlagQuery,
  useLazyGetFlagQuery,
  useCreateFlagMutation,
  usePatchFlagMutation,
  useListFlagMessagesQuery,
  useLazyListFlagMessagesQuery,
  useCreateFlagMessageMutation,
  useUploadFlagChatFileMutation,
  useUpdateFlagStatusMutation,
} = flagsApi;

