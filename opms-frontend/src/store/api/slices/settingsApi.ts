import { medicaApi } from "../baseApi";
import { unwrapEnvelope, type ApiEnvelope } from "../unwrap";

export type SystemSettingsData = {
  platform_name: string;
  support_email: string;
  currency: string;
  currency_symbol: string;
  timezone: string;
  order_prefix: string;
  fiscal_year_suffix: boolean;
  maintenance_mode: boolean;
  maintenance_message: string;
  session_timeout_minutes: number;
  email_alerts_enabled: boolean;
  in_app_notifications_enabled: boolean;
};

export type BuyBackConfigData = {
  require_inspection: boolean;
  auto_credit_ledger: boolean;
  default_valuation_rate: number;
  terms: string;
};

export type WorkflowSettingsData = {
  performa_invoice_enabled: boolean;
  cost_sheet_enabled: boolean;
  kyc_verification_enabled: boolean;
  purchase_order_enabled: boolean;
  buy_back_enabled: boolean;
  buy_back_config?: BuyBackConfigData;
};

export type SalesMappingAccessData = {
  can_see_and_map_quantity: boolean;
  can_see_and_map_volume: boolean;
  can_see_and_map_price: boolean;
};

export type RoleAccessSettingsData = {
  sales_mapping: SalesMappingAccessData;
};

export type PortalSettingsData = {
  _id?: string;
  key?: string;
  system_settings: SystemSettingsData;
  workflow_settings: WorkflowSettingsData;
  role_access_settings?: RoleAccessSettingsData;
  updated_by?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const settingsApi = medicaApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (build) => ({
    getPortalSettings: build.query<PortalSettingsData, void>({
      query: () => ({
        url: "settings/portal",
      }),
      transformResponse: (raw: ApiEnvelope<PortalSettingsData>) => unwrapEnvelope(raw),
      providesTags: ["PortalSettings"],
    }),

    getWorkflowFlags: build.query<WorkflowSettingsData, void>({
      query: () => ({
        url: "settings/workflow-flags",
      }),
      transformResponse: (raw: ApiEnvelope<WorkflowSettingsData>) => unwrapEnvelope(raw),
      providesTags: ["PortalSettings"],
    }),

    updatePortalSettings: build.mutation<
      PortalSettingsData,
      Partial<PortalSettingsData>
    >({
      query: (body) => ({
        url: "settings/portal",
        method: "PUT",
        body,
      }),
      transformResponse: (raw: ApiEnvelope<PortalSettingsData>) => unwrapEnvelope(raw),
      invalidatesTags: ["PortalSettings"],
    }),
  }),
});

export const {
  useGetPortalSettingsQuery,
  useLazyGetPortalSettingsQuery,
  useGetWorkflowFlagsQuery,
  useUpdatePortalSettingsMutation,
} = settingsApi;

