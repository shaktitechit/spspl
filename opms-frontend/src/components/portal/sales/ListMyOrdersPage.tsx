"use client";

import { useMemo } from "react";
import ListOrdersPage from "@/components/portal/shared/orders/list/ListOrdersPage";
import { SALES_LIST_ORDERS_CONFIG } from "@/components/portal/shared/orders/list/listOrdersPageConfig";
import { usePortalSettings } from "@/hooks/usePortalSettings";

export default function ListMyOrdersPage() {
  const { canSalesMapVolume } = usePortalSettings();

  const config = useMemo(
    () => ({
      ...SALES_LIST_ORDERS_CONFIG,
      showPricing: canSalesMapVolume,
    }),
    [canSalesMapVolume]
  );

  return <ListOrdersPage config={config} />;
}
