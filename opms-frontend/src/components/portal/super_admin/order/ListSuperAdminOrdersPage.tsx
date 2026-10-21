"use client";

import ListOrdersPage from "@/components/portal/shared/orders/list/ListOrdersPage";
import { SUPER_ADMIN_LIST_ORDERS_CONFIG } from "@/components/portal/shared/orders/list/listOrdersPageConfig";

export default function ListSuperAdminOrdersPage() {
  return <ListOrdersPage config={SUPER_ADMIN_LIST_ORDERS_CONFIG} />;
}
