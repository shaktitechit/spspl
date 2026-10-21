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
import { WORK_PLANNER_SERVICE_URL } from "@/lib/env";

// @ts-expect-error — shared helper accepts RTK fetchBaseQuery without importing RTK in session-auth-client
const rawBaseQuery = createServiceBaseQueryWithAuthProxy(fetchBaseQuery, {
  baseUrl: `${WORK_PLANNER_SERVICE_URL}/api`,
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
  args,
  api,
  extraOptions,
) => {
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
