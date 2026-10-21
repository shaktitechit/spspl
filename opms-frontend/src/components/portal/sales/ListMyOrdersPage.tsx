"use client";

import ListOrdersPage from "@/components/portal/shared/orders/list/ListOrdersPage";
import { SALES_LIST_ORDERS_CONFIG } from "@/components/portal/shared/orders/list/listOrdersPageConfig";

export default function ListMyOrdersPage() {
  return <ListOrdersPage config={SALES_LIST_ORDERS_CONFIG} />;
}
