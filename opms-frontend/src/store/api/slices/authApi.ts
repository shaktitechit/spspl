import { medicaApi } from "../baseApi";
import { applySessionAfterAuth, persistSessionMarksFromAuth } from "@/lib/sessionCookie";
import { AUTH_API } from "@session-auth/authApiPaths";
import { setCredentials, setUser } from "../../slices/authSlice";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResult = {
  token: string;
  refreshToken?: string;
  refreshExpiresIn?: number;
  user: Record<string, unknown>;
};

type AuthSnap = {
  auth: {
    token: string | null;
    refreshToken?: string | null;
    refreshExpiresAt?: number | null;
    user: unknown;
  };
};

/** `/api/auth` */
export const authApi = medicaApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<LoginResult, LoginPayload>({
      query: (body) => ({
        url: AUTH_API.login,
        method: "POST",
        credentials: "include",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<LoginResult>) => unwrapEnvelope(raw),
      invalidatesTags: ["AuthSession"],
      async onQueryStarted(_body, api) {
        try {
          const { data } = await api.queryFulfilled;
          const refreshExpiresAt = data.refreshExpiresIn
            ? Date.now() + data.refreshExpiresIn * 1000
            : null;
          applySessionAfterAuth();
          api.dispatch(
            setCredentials({
              token: data.token,
              refreshToken: null,
              refreshExpiresAt,
              user: data.user,
            }),
          );
          const root = api.getState() as unknown as AuthSnap;
          persistSessionMarksFromAuth({
            token: root?.auth?.token ?? null,
            refreshExpiresAt: root?.auth?.refreshExpiresAt ?? null,
            user: root?.auth?.user ?? null,
          });
        } catch {
          /* unchanged on failure */
        }
      },
    }),
    /** `GET /api/auth/me`. */
    getAuthMe: build.query<Record<string, unknown>, void>({
      query: () => ({ url: AUTH_API.me, method: "GET", credentials: "include" }),
      transformResponse: (raw: ApiEnvelope<Record<string, unknown>>) =>
        unwrapEnvelope(raw),
      providesTags: ["AuthSession"],
      async onQueryStarted(_body, api) {
        try {
          const { data } = await api.queryFulfilled;
          api.dispatch(setUser(data));
          const root = api.getState() as unknown as AuthSnap;
          persistSessionMarksFromAuth({
            token: root?.auth?.token ?? null,
            refreshExpiresAt: root?.auth?.refreshExpiresAt ?? null,
            user: root?.auth?.user ?? null,
          });
        } catch {
          /* callers may redirect on 401 */
        }
      },
    }),
  }),
});

export const { useLoginMutation, useGetAuthMeQuery, useLazyGetAuthMeQuery } =
  authApi;
