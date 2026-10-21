"use client";

import ListOrdersPage from "@/components/portal/shared/orders/list/ListOrdersPage";
import {
  ADMIN_LIST_ORDERS_CONFIG,
  SUPER_ADMIN_LIST_ORDERS_CONFIG,
} from "@/components/portal/shared/orders/list/listOrdersPageConfig";

type ListAdminOrdersPageProps = {
  /** Portal base path for links and navigation (default "/admin"). */
  portalHome?: "/admin" | "/super_admin";
};

export default function ListAdminOrdersPage({
  portalHome = "/admin",
}: ListAdminOrdersPageProps = {}) {
  return (
    <ListOrdersPage
      config={
        portalHome === "/super_admin"
          ? SUPER_ADMIN_LIST_ORDERS_CONFIG
          : ADMIN_LIST_ORDERS_CONFIG
      }
    />
  );
}
