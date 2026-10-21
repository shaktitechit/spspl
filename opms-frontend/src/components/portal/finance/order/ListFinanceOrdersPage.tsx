"use client";

import ListOrdersPage from "@/components/portal/shared/orders/list/ListOrdersPage";
import { FINANCE_LIST_ORDERS_CONFIG } from "@/components/portal/shared/orders/list/listOrdersPageConfig";

export default function ListFinanceOrdersPage() {
  return <ListOrdersPage config={FINANCE_LIST_ORDERS_CONFIG} />;
}
