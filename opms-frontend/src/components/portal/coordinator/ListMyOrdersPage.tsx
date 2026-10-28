"use client";

import ListOrdersPage from "@/components/portal/shared/orders/list/ListOrdersPage";
import { COORDINATOR_LIST_ORDERS_CONFIG } from "@/components/portal/shared/orders/list/listOrdersPageConfig";

export default function ListMyOrdersPage() {
  return <ListOrdersPage config={COORDINATOR_LIST_ORDERS_CONFIG} />;
}
