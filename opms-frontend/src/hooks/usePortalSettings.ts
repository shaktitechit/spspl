"use client";

import { useGetPortalSettingsQuery } from "@/store/api";

export function usePortalSettings() {
  const { data, isLoading, isFetching, refetch } = useGetPortalSettingsQuery();

  const workflow = data?.workflow_settings;
  const system = data?.system_settings;

  return {
    settings: data,
    isLoading: isLoading || isFetching,
    refetch,
    // System Settings
    systemSettings: system,
    platformName: system?.platform_name ?? "Medica OPMS",
    currencySymbol: system?.currency_symbol ?? "₹",
    isMaintenanceMode: Boolean(system?.maintenance_mode),
    // Workflow Switches
    isPerformaEnabled: workflow?.performa_invoice_enabled ?? true,
    isCostSheetEnabled: workflow?.cost_sheet_enabled ?? true,
    isKycEnabled: workflow?.kyc_verification_enabled ?? true,
    isPOEnabled: workflow?.purchase_order_enabled ?? true,
    isBuyBackEnabled: workflow?.buy_back_enabled ?? false,
    buyBackConfig: workflow?.buy_back_config,
    // Access Role Control
    roleAccessSettings: data?.role_access_settings,
    canSalesMapQuantity: data?.role_access_settings?.sales_mapping?.can_see_and_map_quantity ?? true,
    canSalesMapVolume: data?.role_access_settings?.sales_mapping?.can_see_and_map_volume ?? false,
    canSalesMapPrice: data?.role_access_settings?.sales_mapping?.can_see_and_map_price ?? false,
  };
}

