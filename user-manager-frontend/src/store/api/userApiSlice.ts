import { baseApi } from "./baseApi";
import type { AuthUser } from "@/types/userManager";

export const userApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<{ users: AuthUser[]; total?: number }, Record<string, any> | void>({
      query: (params) => ({
        url: "/api/users",
        params: params || {},
      }),
      providesTags: (result) =>
        result?.users
          ? [
              ...result.users.map(({ _id, id }) => ({ type: "User" as const, id: _id || id })),
              { type: "User", id: "LIST" },
            ]
          : [{ type: "User", id: "LIST" }],
    }),
    getUser: builder.query<AuthUser, string>({
      query: (id) => `/api/users/${id}`,
      providesTags: (_result, _error, id) => [{ type: "User", id }],
    }),
    createUser: builder.mutation<AuthUser, Partial<AuthUser>>({
      query: (body) => ({
        url: "/api/users",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),
    updateUser: builder.mutation<AuthUser, { id: string; data: Partial<AuthUser> }>({
      query: ({ id, data }) => ({
        url: `/api/users/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),
    deleteUser: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/users/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = userApiSlice;
