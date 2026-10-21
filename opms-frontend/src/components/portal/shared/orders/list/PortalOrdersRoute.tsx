"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ListOrdersPage from "./ListOrdersPage";
import {
  ACCOUNT_LIST_ORDERS_CONFIG,
  ADMIN_LIST_ORDERS_CONFIG,
  DISPATCH_LIST_ORDERS_CONFIG,
  FINANCE_LIST_ORDERS_CONFIG,
  SALES_LIST_ORDERS_CONFIG,
  SUPER_ADMIN_LIST_ORDERS_CONFIG,
  type ListOrdersPageConfig,
  type ListOrdersPortalHome,
  type ListOrdersTabId,
} from "./listOrdersPageConfig";
import {
  defaultOrderStageForPortal,
  isValidOrderStageForPortal,
  orderMasterPortalKeyFromHome,
} from "./orderMasterNav";

const CONFIG_BY_PORTAL: Record<ListOrdersPortalHome, ListOrdersPageConfig> = {
  "/admin": ADMIN_LIST_ORDERS_CONFIG,
  "/super_admin": SUPER_ADMIN_LIST_ORDERS_CONFIG,
  "/account": ACCOUNT_LIST_ORDERS_CONFIG,
  "/finance": FINANCE_LIST_ORDERS_CONFIG,
  "/dispatch": DISPATCH_LIST_ORDERS_CONFIG,
  "/sales": SALES_LIST_ORDERS_CONFIG,
};

/**
 * `/orders` redirects to the portal default process queue.
 * `/orders/:stage` loads only that process (one page per queue).
 */
export default function PortalOrdersRoute({
  portalHome,
  stage,
}: {
  portalHome: ListOrdersPortalHome;
  stage?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const config = CONFIG_BY_PORTAL[portalHome];
  const portalKey = orderMasterPortalKeyFromHome(portalHome);
  const defaultTab = portalKey
    ? defaultOrderStageForPortal(portalKey)
    : config.defaultTab;

  const legacyTab = searchParams.get("tab");
  const legacyBy = searchParams.get("by");

  const requestedStage =
    stage ||
    legacyTab ||
    (legacyBy === "priority" ? "all" : null) ||
    defaultTab;

  const processStage: ListOrdersTabId =
    portalKey && isValidOrderStageForPortal(portalKey, requestedStage)
      ? requestedStage
      : defaultTab;

  const searchString = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    let needsReplace = false;

    if (!stage) {
      needsReplace = true;
    } else if (stage !== processStage) {
      needsReplace = true;
    }

    if (legacyTab || legacyBy) {
      params.delete("tab");
      params.delete("by");
      needsReplace = true;
    }

    if (!needsReplace) return;

    const qs = params.toString();
    router.replace(
      `${portalHome}/orders/${processStage}${qs ? `?${qs}` : ""}`,
      { scroll: false },
    );
  }, [
    legacyBy,
    legacyTab,
    portalHome,
    processStage,
    router,
    searchString,
    stage,
  ]);

  if (!stage || stage !== processStage) return null;

  return (
    <ListOrdersPage
      key={processStage}
      config={config}
      processStage={processStage}
    />
  );
}
