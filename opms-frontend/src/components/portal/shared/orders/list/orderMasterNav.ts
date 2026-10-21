import { SALES_ORDER_TABS } from "@/components/portal/sales/orderUtils";

import type { ListOrdersPortalHome, ListOrdersTabId } from "./listOrdersPageConfig";
import {
  ADMIN_LIST_ORDERS_CONFIG,
  ACCOUNT_LIST_ORDERS_CONFIG,
  DISPATCH_LIST_ORDERS_CONFIG,
  FINANCE_LIST_ORDERS_CONFIG,
  SALES_LIST_ORDERS_CONFIG,
  SUPER_ADMIN_LIST_ORDERS_CONFIG,
} from "./listOrdersPageConfig";
import {
  isOrderWorkflowTabCategory,
  ORDER_WORKFLOW_TABS,
  ORDER_WORKFLOW_TAB_LABELS,
} from "./orderWorkflowTabs";

/** NavIcon keys in `NavIcon.tsx` for Order Master queue links. */
const STAGE_NAV_ICON: Record<string, string> = {
  all: "Columns2",
  draft: "FileEdit",
  pending_admin_approval: "ShieldCheck",
  due_sheet_pending: "FileEdit",
  pending_finance_approval: "ShieldCheck",
  pending_account_approval: "ShieldCheck",
  open_dispatched: "PackageOpen",
  transport_pending: "Truck",
  in_transit: "MapPin",
  closed_delivered: "BadgeCheck",
  on_hold: "AlarmClock",
  cancelled: "ShieldBan",
  rejected: "AlertCircle",
};

/** Mirrors {@link PORTALS} in `portalNav.ts` (avoid importing to prevent cycles). */
export type OrderMasterPortalKey =
  | "admin"
  | "sales"
  | "finance"
  | "dispatch"
  | "super_admin"
  | "account";

const PORTAL_HOME: Record<OrderMasterPortalKey, ListOrdersPortalHome> = {
  admin: "/admin",
  super_admin: "/super_admin",
  account: "/account",
  finance: "/finance",
  dispatch: "/dispatch",
  sales: "/sales",
};

const CONFIG_BY_PORTAL: Record<
  OrderMasterPortalKey,
  { defaultTab: ListOrdersTabId; includeDraftTab: boolean }
> = {
  admin: {
    defaultTab: ADMIN_LIST_ORDERS_CONFIG.defaultTab,
    includeDraftTab: false,
  },
  super_admin: {
    defaultTab: SUPER_ADMIN_LIST_ORDERS_CONFIG.defaultTab,
    includeDraftTab: false,
  },
  account: {
    defaultTab: ACCOUNT_LIST_ORDERS_CONFIG.defaultTab,
    includeDraftTab: false,
  },
  finance: {
    defaultTab: FINANCE_LIST_ORDERS_CONFIG.defaultTab,
    includeDraftTab: false,
  },
  dispatch: {
    defaultTab: DISPATCH_LIST_ORDERS_CONFIG.defaultTab,
    includeDraftTab: false,
  },
  sales: {
    defaultTab: SALES_LIST_ORDERS_CONFIG.defaultTab,
    includeDraftTab: true,
  },
};

export type OrderMasterQueue = {
  id: ListOrdersTabId;
  label: string;
  icon: string;
};

export function orderMasterQueuesForPortal(
  portal: OrderMasterPortalKey,
): OrderMasterQueue[] {
  const { includeDraftTab } = CONFIG_BY_PORTAL[portal];
  const tabs = includeDraftTab ? SALES_ORDER_TABS : ORDER_WORKFLOW_TABS;
  return tabs.map((tab) => ({
    id: tab.id as ListOrdersTabId,
    label: tab.label,
    icon: STAGE_NAV_ICON[tab.id] ?? "FolderOpen",
  }));
}


export function portalHomeForPortal(
  portal: OrderMasterPortalKey,
): ListOrdersPortalHome {
  return PORTAL_HOME[portal];
}

export function defaultOrderStageForPortal(
  portal: OrderMasterPortalKey,
): ListOrdersTabId {
  return CONFIG_BY_PORTAL[portal].defaultTab;
}

export function isValidOrderStageForPortal(
  portal: OrderMasterPortalKey,
  stageId: string,
): stageId is ListOrdersTabId {
  const { includeDraftTab } = CONFIG_BY_PORTAL[portal];
  if (includeDraftTab && stageId === "draft") return true;
  return isOrderWorkflowTabCategory(stageId);
}

export function resolveOrderStageLabel(
  portal: OrderMasterPortalKey,
  stageId: string,
): string | null {
  const queues = orderMasterQueuesForPortal(portal);
  const hit = queues.find((q) => q.id === stageId);
  if (hit) return hit.label;
  if (isOrderWorkflowTabCategory(stageId)) {
    return ORDER_WORKFLOW_TAB_LABELS[stageId];
  }
  return null;
}

export type OrderMasterNavChild = {
  label: string;
  icon: string;
  segment: string;
};

export function buildOrderMasterNavChildren(
  portal: OrderMasterPortalKey,
): OrderMasterNavChild[] {
  return orderMasterQueuesForPortal(portal).map((q) => ({
    label: q.label,
    icon: q.icon,
    segment: q.id,
  }));
}

/** Prebuilt Order Master dropdown items per portal (for `portalNav.ts`). */
export const ORDER_MASTER_NAV_CHILDREN_BY_PORTAL: Record<
  OrderMasterPortalKey,
  readonly OrderMasterNavChild[]
> = {
  admin: buildOrderMasterNavChildren("admin"),
  super_admin: buildOrderMasterNavChildren("super_admin"),
  account: buildOrderMasterNavChildren("account"),
  finance: buildOrderMasterNavChildren("finance"),
  dispatch: buildOrderMasterNavChildren("dispatch"),
  sales: buildOrderMasterNavChildren("sales"),
};

export type PortalNavChildLink = {
  segment?: string;
  query?: string;
};

export function portalNavChildHref(
  parentHref: string,
  child: PortalNavChildLink,
): string {
  const base = child.segment
    ? `${parentHref}/${child.segment}`
    : parentHref;
  if (!child.query) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${child.query}`;
}

export function isPortalNavChildActive(
  pathname: string,
  searchParams: { get(name: string): string | null },
  parentHref: string,
  child: PortalNavChildLink,
  parentActive: boolean,
): boolean {
  const href = portalNavChildHref(parentHref, child);
  if (child.segment) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (!child.query) return parentActive && pathname === parentHref;
  if (!parentActive) return false;
  const [qKey, qVal] = child.query.split("=");
  if (!qKey || qVal === undefined) return false;
  return searchParams.get(qKey) === qVal;
}

export function orderMasterPortalKeyFromHome(
  portalHome: ListOrdersPortalHome,
): OrderMasterPortalKey | null {
  for (const [key, home] of Object.entries(PORTAL_HOME) as [
    OrderMasterPortalKey,
    ListOrdersPortalHome,
  ][]) {
    if (home === portalHome) return key;
  }
  return null;
}

