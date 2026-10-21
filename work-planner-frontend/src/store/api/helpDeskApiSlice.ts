/**
 * @fileoverview RTK Query API Slice for Help Desk module.
 * @module store/api/helpDeskApiSlice
 */

import { baseApi } from "./baseApi";
import type {
  HelpTicketRecord,
  HelpTicketReply,
  HelpTicketAttachment,
  HelpDeskStats,
  CreateHelpTicketPayload,
  AddHelpReplyPayload,
  ProposeSolutionPayload,
  ResolveTicketPayload,
  ReopenTicketPayload,
} from "@/types/helpDesk";

export interface ListHelpTicketsParams {
  scope?: "tagged" | "created" | "all" | "needs_my_approval";
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface ListHelpTicketsResponse {
  success: boolean;
  data: HelpTicketRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const helpDeskApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getHelpDeskStats: builder.query<HelpDeskStats, void>({
      query: () => "/help-desk/stats",
      transformResponse: (res: { success: boolean; data: HelpDeskStats }) => res.data,
      providesTags: ["HelpDesk"],
    }),

    getHelpTickets: builder.query<ListHelpTicketsResponse, ListHelpTicketsParams | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.scope) queryParams.set("scope", params.scope);
        if (params?.status) queryParams.set("status", params.status);
        if (params?.priority) queryParams.set("priority", params.priority);
        if (params?.category) queryParams.set("category", params.category);
        if (params?.search) queryParams.set("search", params.search);
        if (params?.from) queryParams.set("from", params.from);
        if (params?.to) queryParams.set("to", params.to);
        if (params?.page) queryParams.set("page", String(params.page));
        if (params?.limit) queryParams.set("limit", String(params.limit));

        const qs = queryParams.toString();
        return `/help-desk/tickets${qs ? `?${qs}` : ""}`;
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: "HelpDesk" as const, id: _id })),
              { type: "HelpDesk", id: "LIST" },
            ]
          : [{ type: "HelpDesk", id: "LIST" }],
    }),

    getHelpTicketById: builder.query<HelpTicketRecord, string>({
      query: (id) => `/help-desk/tickets/${id}`,
      transformResponse: (res: { success: boolean; data: HelpTicketRecord }) => res.data,
      providesTags: (result, error, id) => [{ type: "HelpDesk", id }],
    }),

    createHelpTicket: builder.mutation<HelpTicketRecord, CreateHelpTicketPayload>({
      query: (body) => ({
        url: "/help-desk/tickets",
        method: "POST",
        body,
      }),
      transformResponse: (res: { success: boolean; data: HelpTicketRecord }) => res.data,
      invalidatesTags: [{ type: "HelpDesk", id: "LIST" }, "HelpDesk"],
    }),

    addHelpReply: builder.mutation<HelpTicketReply, { ticketId: string; body: AddHelpReplyPayload }>({
      query: ({ ticketId, body }) => ({
        url: `/help-desk/tickets/${ticketId}/replies`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { success: boolean; data: HelpTicketReply }) => res.data,
      invalidatesTags: (result, error, { ticketId }) => [
        { type: "HelpDesk", id: ticketId },
        { type: "HelpDesk", id: "LIST" },
      ],
    }),

    tagCollaborators: builder.mutation<HelpTicketRecord, { ticketId: string; user_ids: string[] }>({
      query: ({ ticketId, user_ids }) => ({
        url: `/help-desk/tickets/${ticketId}/tag-users`,
        method: "POST",
        body: { user_ids },
      }),
      transformResponse: (res: { success: boolean; data: HelpTicketRecord }) => res.data,
      invalidatesTags: (result, error, { ticketId }) => [
        { type: "HelpDesk", id: ticketId },
        { type: "HelpDesk", id: "LIST" },
      ],
    }),

    acknowledgeHelpTicket: builder.mutation<HelpTicketRecord, string>({
      query: (ticketId) => ({
        url: `/help-desk/tickets/${ticketId}/acknowledge`,
        method: "POST",
      }),
      transformResponse: (res: { success: boolean; data: HelpTicketRecord }) => res.data,
      invalidatesTags: (result, error, ticketId) => [
        { type: "HelpDesk", id: ticketId },
        { type: "HelpDesk", id: "LIST" },
        "HelpDesk",
      ],
    }),

    proposeHelpSolution: builder.mutation<HelpTicketRecord, { ticketId: string; body: ProposeSolutionPayload }>({
      query: ({ ticketId, body }) => ({
        url: `/help-desk/tickets/${ticketId}/propose-solution`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { success: boolean; data: HelpTicketRecord }) => res.data,
      invalidatesTags: (result, error, { ticketId }) => [
        { type: "HelpDesk", id: ticketId },
        { type: "HelpDesk", id: "LIST" },
        "HelpDesk",
      ],
    }),

    resolveHelpTicket: builder.mutation<HelpTicketRecord, { ticketId: string; body: ResolveTicketPayload }>({
      query: ({ ticketId, body }) => ({
        url: `/help-desk/tickets/${ticketId}/resolve`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { success: boolean; data: HelpTicketRecord }) => res.data,
      invalidatesTags: (result, error, { ticketId }) => [
        { type: "HelpDesk", id: ticketId },
        { type: "HelpDesk", id: "LIST" },
        "HelpDesk",
      ],
    }),

    reopenHelpTicket: builder.mutation<HelpTicketRecord, { ticketId: string; body: ReopenTicketPayload }>({
      query: ({ ticketId, body }) => ({
        url: `/help-desk/tickets/${ticketId}/reopen`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { success: boolean; data: HelpTicketRecord }) => res.data,
      invalidatesTags: (result, error, { ticketId }) => [
        { type: "HelpDesk", id: ticketId },
        { type: "HelpDesk", id: "LIST" },
        "HelpDesk",
      ],
    }),

    cancelHelpTicket: builder.mutation<HelpTicketRecord, { ticketId: string; reason?: string }>({
      query: ({ ticketId, reason }) => ({
        url: `/help-desk/tickets/${ticketId}/cancel`,
        method: "POST",
        body: { reason },
      }),
      transformResponse: (res: { success: boolean; data: HelpTicketRecord }) => res.data,
      invalidatesTags: (result, error, { ticketId }) => [
        { type: "HelpDesk", id: ticketId },
        { type: "HelpDesk", id: "LIST" },
        "HelpDesk",
      ],
    }),

    uploadHelpDeskAttachment: builder.mutation<HelpTicketAttachment, FormData>({
      query: (body) => ({
        url: "/help-desk/attachments/upload",
        method: "POST",
        body,
      }),
      transformResponse: (res: { success: boolean; data: HelpTicketAttachment }) => res.data,
    }),

    markTicketAsRead: builder.mutation<{ success: boolean; ticket_id: string; last_read_at: string; unseen_count: number }, string>({
      query: (ticketId) => ({
        url: `/help-desk/tickets/${ticketId}/read`,
        method: "POST",
      }),
      async onQueryStarted(ticketId, { dispatch, queryFulfilled }) {
        // Optimistically update tickets list to set unseen_messages_count to 0
        const patchResult = dispatch(
          helpDeskApiSlice.util.updateQueryData("getHelpTickets", undefined as any, (draft) => {
            if (draft?.data) {
              const ticket = draft.data.find((t) => t._id === ticketId);
              if (ticket) {
                ticket.unseen_messages_count = 0;
              }
            }
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
      invalidatesTags: (result, error, ticketId) => [
        { type: "HelpDesk", id: ticketId },
      ],
    }),

    getHelpDeskUsers: builder.query<
      Array<{
        _id: string;
        id?: string;
        name: string;
        email: string;
        department?: string | { name?: string };
        roles?: unknown;
        role_codes?: unknown;
        portals?: unknown;
        wp_role?: string;
      }>,
      void
    >({
      query: () => "/help-desk/users",
      transformResponse: (res: { success: boolean; data: any[] }) => res.data || [],
    }),
  }),
});

export const {
  useGetHelpDeskStatsQuery,
  useGetHelpTicketsQuery,
  useLazyGetHelpTicketsQuery,
  useGetHelpTicketByIdQuery,
  useLazyGetHelpTicketByIdQuery,
  useCreateHelpTicketMutation,
  useAddHelpReplyMutation,
  useTagCollaboratorsMutation,
  useAcknowledgeHelpTicketMutation,
  useProposeHelpSolutionMutation,
  useResolveHelpTicketMutation,
  useReopenHelpTicketMutation,
  useCancelHelpTicketMutation,
  useUploadHelpDeskAttachmentMutation,
  useMarkTicketAsReadMutation,
  useGetHelpDeskUsersQuery,
} = helpDeskApiSlice;

