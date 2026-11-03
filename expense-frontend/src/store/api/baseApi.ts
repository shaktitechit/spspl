import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { createServiceBaseQueryWithAuthProxy } from "@session-auth/createServiceBaseQueryWithAuthProxy";
import {
  invalidateLocalSession,
  readSessionFromStorage,
  refreshAccessToken,
} from "@/utils/authStorage";
import { EXPENSE_SERVICE_URL, publicExpenseApiOrigin } from "@/lib/env";

function normalizeRequestArgs(args: string | FetchArgs): string | FetchArgs {
  const origin = publicExpenseApiOrigin().replace(/\/+$/, "");
  if (typeof window === "undefined" || origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return args;
  }
  if (typeof args === "string") {
    if (
      args.startsWith("http://localhost:7015") ||
      args.startsWith("http://127.0.0.1:7015") ||
      args.startsWith("http://expense-backend:7015")
    ) {
      return args.replace(/^https?:\/\/[^/]+/, origin);
    }
    return args;
  }
  if (args && typeof args.url === "string") {
    if (
      args.url.startsWith("http://localhost:7015") ||
      args.url.startsWith("http://127.0.0.1:7015") ||
      args.url.startsWith("http://expense-backend:7015")
    ) {
      return {
        ...args,
        url: args.url.replace(/^https?:\/\/[^/]+/, origin),
      };
    }
  }
  return args;
}

// @ts-expect-error — shared helper accepts RTK fetchBaseQuery without importing RTK in session-auth-client
const rawBaseQuery = createServiceBaseQueryWithAuthProxy(fetchBaseQuery, {
  baseUrl: `${EXPENSE_SERVICE_URL}/api`,
  credentials: "include",
  prepareHeaders(headers) {
    const session = readSessionFromStorage();
    if (session?.token) {
      headers.set("Authorization", `Bearer ${session.token}`);
    }
    return headers;
  },
}) as BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

function requestUrl(args: string | FetchArgs): string {
  return typeof args === "string" ? args : args.url;
}

function skipRefresh(url: string): boolean {
  return url.includes("auth/login") || url.includes("auth/refresh");
}

export { refreshAccessToken };

const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  rawArgs,
  api,
  extraOptions,
) => {
  const args = normalizeRequestArgs(rawArgs);
  let result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401 && !skipRefresh(requestUrl(args))) {
    const ok = await refreshAccessToken();
    if (ok) {
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      invalidateLocalSession("/");
    }
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    "AuthSession",
    "CompanyInfo",
    "WorkPlan",
    "WorkPlannerStats",
    "WorkPlannerTeam",
    "Expense",
    "WorkPlanExpense",
    "TourAdvance",
    "ExpenseSettlement",
    "ExecutiveBalance",
    "ExecutivePassbook",
    "Product",
    "Party",
    "Lead",
    "PowerFacility",
    "PowerEnquiry",
    "Notifications",
    "WorkPlanAnalytics",
    "WorkPlanAiAnalysis",
    "WorkPlanTeamAnalytics",
    "WorkPlanDraft",
    "SeniorRemarks",
    "UserNotes",
    "HelpDesk",
    "UserEmailPreferences",
  ],
  endpoints: () => ({}),
});
