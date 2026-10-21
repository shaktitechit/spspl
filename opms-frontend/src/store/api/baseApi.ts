import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { createServiceBaseQueryWithAuthProxy } from "@session-auth/createServiceBaseQueryWithAuthProxy";

import { publicApiOrigin } from "@/lib/env";
import { invalidateOpmsClientSession, readRefreshExpiresAtFromCookies } from "@/lib/sessionCookie";
import { AUTH_API } from "@session-auth/authApiPaths";
import {
  createRefreshAccessToken,
  type RefreshedSessionPayload,
} from "@session-auth/createRefreshAccessToken";
import { purgeLegacyAuthStorage } from "@session-auth/purgeLegacyStorage";
import { isSessionTerminated } from "@session-auth/sessionTerminator";
import { logout, setCredentials, type AuthUser } from "@/store/slices/authSlice";

type AuthSnap = {
  auth?: {
    token?: string | null;
    refreshToken?: string | null;
    refreshExpiresAt?: number | null;
    user?: AuthUser | null;
  };
};

type StoreLike = {
  getState: () => unknown;
  dispatch: (action: unknown) => unknown;
};

let boundStore: StoreLike | null = null;

function authFromStore(): NonNullable<AuthSnap["auth"]> {
  if (!boundStore) return {};
  return ((boundStore.getState() as AuthSnap).auth ?? {}) as NonNullable<AuthSnap["auth"]>;
}

function ensureStore(api: StoreLike): StoreLike {
  boundStore ??= api;
  return boundStore;
}

const refreshAccessToken = createRefreshAccessToken({
  authRefreshUrl: AUTH_API.refresh,
  cookieCredentials: true,
  getRefreshExpiresAt: () =>
    authFromStore().refreshExpiresAt ?? readRefreshExpiresAtFromCookies(),
  readFallbackUser: () => authFromStore().user ?? null,
  saveRefreshedSession: (payload: RefreshedSessionPayload) => {
    if (isSessionTerminated()) return;
    purgeLegacyAuthStorage();
    boundStore?.dispatch(
      setCredentials({
        token: payload.token,
        refreshToken: null,
        refreshExpiresAt: payload.refreshExpiresAt,
        user: payload.user as AuthUser,
      }),
    );
  },
  invalidateSession: () => {
    boundStore?.dispatch(logout());
    invalidateOpmsClientSession("/login");
  },
});

// @ts-expect-error — shared helper accepts RTK fetchBaseQuery without importing RTK in session-auth-client
const rawBaseQuery = createServiceBaseQueryWithAuthProxy(fetchBaseQuery, {
  baseUrl: `${publicApiOrigin()}/api`,
  credentials: "include",
  prepareHeaders(headers, api) {
    ensureStore(api as unknown as StoreLike);
    const token = authFromStore().token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
}) as BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

function requestUrl(args: string | FetchArgs): string {
  return typeof args === "string" ? args : args.url;
}

function skipRefresh(url: string): boolean {
  return url.includes("auth/login") || url.includes("auth/refresh");
}

function forceLogout(api: StoreLike): void {
  ensureStore(api);
  api.dispatch(logout());
  invalidateOpmsClientSession("/login");
}

const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  ensureStore(api as unknown as StoreLike);
  let result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401 && !skipRefresh(requestUrl(args))) {
    const ok = await refreshAccessToken();
    if (ok) {
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      forceLogout(api as unknown as StoreLike);
    }
  }
  return result;
};

/** Swagger / `app.js` domain tags → cache invalidation buckets. */
export const medicaApi = createApi({
  reducerPath: "medicaApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    "AuthSession",
    "Activity",
    "Approvals",
    "Attachments",
    "Collections",
    "Parties",
    "PartyProducts",
    "Dashboard",
    "Dispatch",
    "Drivers",
    "FinanceQueue",
    "FinanceSummary",
    "Flags",
    "Invoices",
    "Notifications",
    "Messages",
    "Order",
    "Orders",
    "OrderApprovals",
    "UnbilledOrders",
    "Payments",
    "Reminders",
    "TransportPlans",

    "Products",
    "ProductGroups",
    "ProductSubgroups",
    "ProductBrands",
    "ProductManufacturers",
    "ProductUnits",
    "ProductKitItems",
    "Transport",
    "TransportAgents",
    "Users",
    "Vehicles",
    "Zones",
    "PartyCountries",
    "PartyStates",
    "PartyCities",
    "CompanyInfo",
    "Lead",
    "LeadMaster",
    "LeadFollowUp",
    "LeadQuotation",
    "Quotation",
    "TermsAndConditions",
  ],
  endpoints: () => ({}),
});

export type MedicaApi = typeof medicaApi;
