import { baseApi } from "./baseApi";
import type { Portal } from "@/types/userManager";

export const portalApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPortals: builder.query<Portal[], void>({
      query: () => "/api/portals",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id, id }) => ({ type: "Portal" as const, id: _id || id })),
              { type: "Portal", id: "LIST" },
            ]
          : [{ type: "Portal", id: "LIST" }],
    }),
    createPortal: builder.mutation<Portal, Partial<Portal>>({
      query: (body) => ({
        url: "/api/portals",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Portal", id: "LIST" }],
    }),
    updatePortal: builder.mutation<Portal, { id: string; data: Partial<Portal> }>({
      query: ({ id, data }) => ({
        url: `/api/portals/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Portal", id },
        { type: "Portal", id: "LIST" },
      ],
    }),
    deletePortal: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/portals/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Portal", id: "LIST" }],
    }),
  }),
});

export const {
  useGetPortalsQuery,
  useCreatePortalMutation,
  useUpdatePortalMutation,
  useDeletePortalMutation,
} = portalApiSlice;
