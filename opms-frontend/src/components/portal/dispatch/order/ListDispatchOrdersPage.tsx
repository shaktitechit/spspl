"use client";

import ListOrdersPage from "@/components/portal/shared/orders/list/ListOrdersPage";
import { DISPATCH_LIST_ORDERS_CONFIG } from "@/components/portal/shared/orders/list/listOrdersPageConfig";

export default function ListDispatchOrdersPage() {
  return <ListOrdersPage config={DISPATCH_LIST_ORDERS_CONFIG} />;
}
