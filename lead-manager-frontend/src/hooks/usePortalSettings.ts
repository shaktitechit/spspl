"use client";

import { useGetWorkflowFlagsQuery } from "@/store/api";

export function usePortalSettings() {
  const { data, isLoading, isFetching, refetch } = useGetWorkflowFlagsQuery();

  return {
    flags: data,
    isLoading: isLoading || isFetching,
    refetch,
    // Workflow Switches
    isPerformaEnabled: data?.performa_invoice_enabled ?? true,
    isCostSheetEnabled: data?.cost_sheet_enabled ?? true,
    isKycEnabled: data?.kyc_verification_enabled ?? true,
    isPOEnabled: data?.purchase_order_enabled ?? true,
    isBuyBackEnabled: data?.buy_back_enabled ?? false,
    buyBackConfig: data?.buy_back_config,
    // Access Role Control
    roleAccessSettings: data?.role_access_settings,
    canSalesMapQuantity: data?.role_access_settings?.sales_mapping?.can_see_and_map_quantity ?? true,
    canSalesMapVolume: data?.role_access_settings?.sales_mapping?.can_see_and_map_volume ?? false,
    canSalesMapPrice: data?.role_access_settings?.sales_mapping?.can_see_and_map_price ?? false,
  };
}
