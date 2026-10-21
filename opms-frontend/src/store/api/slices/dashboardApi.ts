import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

export type DashboardRateBucket = {
  total: number;
  sr: number;
  sra: number;
  cr: number;
};

export type DashboardLeaderboardRow = {
  name: string;
  quantity: DashboardRateBucket;
  volume: DashboardRateBucket;
  quantityKit?: DashboardRateBucket;
  volumeKit?: DashboardRateBucket;
};

export type DashboardMonthGrids = Record<string, number[]>;

export type DashboardOrdersSummary = {
  availableYears: number[];
  queueCounts: Record<string, number>;
  tabStats: Record<
    string,
    { count: number; quantity: number; kitQuantity: number; amount: number }
  >;
  monthly: {
    approved: { quantity: DashboardMonthGrids; volume: DashboardMonthGrids };
    dispatched: { quantity: DashboardMonthGrids; volume: DashboardMonthGrids };
  };
  leaderboards: {
    parties: DashboardLeaderboardRow[];
    products: DashboardLeaderboardRow[];
    salesUsers: DashboardLeaderboardRow[];
  };
  contributions: Array<{
    productId: string;
    salesUserId: string;
    partyId: string;
    quantity: number;
    volume: number;
  }>;
};

/** `/api/dashboard/*` — each mount is dept-only (`requireDepartmentOnly`); no admin pass-through on other slices. */
export const dashboardApi = medicaApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboardOrdersSummary: build.query<
      DashboardOrdersSummary,
      Record<string, string>
    >({
      query: (params) => ({ url: "dashboard/orders-summary", params }),
      transformResponse: (raw: ApiEnvelope<DashboardOrdersSummary>) =>
        unwrapEnvelope(raw),
      providesTags: [
        { type: "Dashboard", id: "ORDERS_SUMMARY" },
        { type: "Orders", id: "LIST" },
      ],
    }),
    getDashboardAdmin: build.query<unknown, void>({
      query: () => ({ url: "dashboard/admin", method: "GET" }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Dashboard", id: "admin" }],
    }),
    getDashboardSales: build.query<unknown, void>({
      query: () => ({ url: "dashboard/sales", method: "GET" }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Dashboard", id: "sales" }],
    }),
    getDashboardFinance: build.query<unknown, void>({
      query: () => ({ url: "dashboard/finance", method: "GET" }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Dashboard", id: "finance" }],
    }),
    getDashboardDispatch: build.query<unknown, void>({
      query: () => ({ url: "dashboard/dispatch", method: "GET" }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Dashboard", id: "dispatch" }],
    }),
    getDashboardAccount: build.query<unknown, void>({
      query: () => ({ url: "dashboard/account", method: "GET" }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Dashboard", id: "account" }],
    }),
    getDashboardSuper: build.query<unknown, void>({
      query: () => ({ url: "dashboard/super", method: "GET" }),
      transformResponse: (raw: ApiEnvelope<unknown>) => unwrapEnvelope(raw),
      providesTags: [{ type: "Dashboard", id: "super" }],
    }),
  }),
});

export const {
  useGetDashboardOrdersSummaryQuery,
  useGetDashboardAdminQuery,
  useGetDashboardSalesQuery,
  useGetDashboardFinanceQuery,
  useGetDashboardDispatchQuery,
  useGetDashboardAccountQuery,
  useGetDashboardSuperQuery,
} = dashboardApi;
