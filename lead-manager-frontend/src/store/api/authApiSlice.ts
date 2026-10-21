import { baseApi } from "./baseApi";
import { AUTH_API } from "@session-auth/authApiPaths";
import type { AuthUser, UserSession } from "@/types/leadManager";

export const authApiSlice = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    login: builder.mutation<UserSession, { email?: string; password?: string }>({
      query: (credentials) => ({
        url: AUTH_API.login,
        method: "POST",
        credentials: "include",
        body: credentials,
      }),
      invalidatesTags: ["AuthSession"],
    }),
    getMe: builder.query<{ user: AuthUser }, void>({
      query: () => ({ url: AUTH_API.me, credentials: "include" as const }),
      transformResponse: (raw: { user?: AuthUser; data?: AuthUser }) => ({
        user: raw.user || raw.data!,
      }),
      providesTags: ["AuthSession"],
    }),
    changePassword: builder.mutation<
      { success: boolean; message?: string },
      { currentPassword: string; newPassword: string }
    >({
      query: (body) => ({
        url: "/api/auth/change-password",
        method: "POST",
        credentials: "include",
        body,
      }),
    }),
  }),
});

export const { useLoginMutation, useGetMeQuery, useChangePasswordMutation } =
  authApiSlice;
