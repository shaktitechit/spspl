"use client";

import ListOrdersPage from "@/components/portal/shared/orders/list/ListOrdersPage";
import { ACCOUNT_LIST_ORDERS_CONFIG } from "@/components/portal/shared/orders/list/listOrdersPageConfig";

export default function ListAccountOrdersPage() {
  return <ListOrdersPage config={ACCOUNT_LIST_ORDERS_CONFIG} />;
}
