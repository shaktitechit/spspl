import { baseApi } from "./baseApi";
import type { RoleItem } from "@/types/userManager";

export const roleApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRoles: builder.query<RoleItem[], { department?: string } | void>({
      query: (params) => ({
        url: "/api/roles",
        params: params || {},
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id, id }) => ({ type: "Role" as const, id: _id || id })),
              { type: "Role", id: "LIST" },
            ]
          : [{ type: "Role", id: "LIST" }],
    }),
    createRole: builder.mutation<RoleItem, Partial<RoleItem>>({
      query: (body) => ({
        url: "/api/roles",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Role", id: "LIST" }],
    }),
    updateRole: builder.mutation<RoleItem, { id: string; data: Partial<RoleItem> }>({
      query: ({ id, data }) => ({
        url: `/api/roles/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Role", id },
        { type: "Role", id: "LIST" },
      ],
    }),
    deleteRole: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/roles/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Role", id: "LIST" }],
    }),
  }),
});

export const {
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} = roleApiSlice;
