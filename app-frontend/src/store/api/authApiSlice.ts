import { baseApi } from "./baseApi";
import { AUTH_API } from "@session-auth/authApiPaths";
import type { AuthUser, UserSession } from "@/types/leadManager";

type LoginApiResponse = {
  success?: boolean;
  token?: string;
  refreshToken?: string;
  refreshExpiresIn?: number;
  user?: AuthUser;
  data?: { token?: string; refreshToken?: string; refreshExpiresIn?: number; user?: AuthUser };
};

function normalizeSession(raw: LoginApiResponse): UserSession {
  const token = raw.token || raw.data?.token || "";
  const refreshExpiresIn = raw.refreshExpiresIn || raw.data?.refreshExpiresIn;
  const user = raw.user || raw.data?.user;
  if (!token || !user) {
    throw new Error("Invalid login response");
  }
  return {
    token,
    refreshExpiresIn,
    refreshExpiresAt: refreshExpiresIn ? Date.now() + refreshExpiresIn * 1000 : undefined,
    user,
  };
}

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
      transformResponse: (raw: LoginApiResponse) => normalizeSession(raw),
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
