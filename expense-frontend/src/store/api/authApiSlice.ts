import { baseApi } from "./baseApi";
import { AUTH_SERVICE_URL } from "@/lib/env";
import { AUTH_API } from "@session-auth/authApiPaths";
import type { AuthUser, UserSession } from "@/types/workPlanner";

const authServiceApi = `${AUTH_SERVICE_URL.replace(/\/+$/, "")}/api`;

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
    getUsers: builder.query<
      Array<{
        _id: string;
        id?: string;
        name: string;
        email: string;
        department?: string;
        roles?: unknown;
        role_codes?: unknown;
        role_names?: unknown;
        portals?: unknown;
      }>,
      void
    >({
      query: () => `${authServiceApi}/users`,
      transformResponse: (res: any) => res.data || res || [],
    }),
  }),
});

export const {
  useLoginMutation,
  useGetMeQuery,
  useChangePasswordMutation,
  useGetUsersQuery,
} = authApiSlice;
