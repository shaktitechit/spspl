import {
  ORDER_MASTER_NAV_CHILDREN_BY_PORTAL,
  resolveOrderStageLabel,
  type OrderMasterPortalKey,
} from "@/components/portal/shared/orders/list/orderMasterNav";

/**
 * Role portal navigation — paths are `/portal` plus optional segments (`/sales/my-orders`).
 * `icon` keys map to {@link NAV_ICON_MAP} in `components/shell/NavIcon.tsx`.
 */
export const PORTALS = [
  "admin",
  "sales",
  "finance",
  "dispatch",
  "super_admin",
  "account",
] as const;

export type PortalKey = (typeof PORTALS)[number];

export type PortalNavChild = {
  label: string;
  /** Matches a key from `NAV_ICON_MAP` in `NavIcon.tsx`. */
  icon: string;
  /** Extra path after the parent href, e.g. `pending_admin_approval` for `/admin/orders/...`. */
  segment?: string;
  /** Optional search, e.g. `view=parties` on master list pages. */
  query?: string;
};

export type PortalNavLeaf = {
  /** URL segments after `/portal` (none = overview at `/portal`). */
  segments: readonly string[];
  label: string;
  /** Matches a key from `NAV_ICON_MAP` in `NavIcon.tsx`. */
  icon: string;
  /** Dropdown sub-items; first child is the default view. */
  children?: readonly PortalNavChild[];
};

export const PORTAL_NAV: Record<PortalKey, readonly PortalNavLeaf[]> = {
  admin: [
    { segments: [], label: "Overview", icon: "LayoutDashboard" },
    {
      segments: ["orders"],
      label: "Order Master",
      icon: "ClipboardList",
      children: ORDER_MASTER_NAV_CHILDREN_BY_PORTAL.admin,
    },
    { segments: ["create-order"], label: "Create Order", icon: "FilePlus" },

    {
      segments: ["parties"],
      label: "Party Master",
      icon: "Users",
      children: [
        { label: "Master Party List", query: "view=parties", icon: "Users" },
        { label: "Zone Management List", query: "view=zones", icon: "Map" },
        { label: "Country List", query: "view=countries", icon: "Landmark" },
        { label: "State List", query: "view=states", icon: "MapPin" },
        { label: "City List", query: "view=cities", icon: "Building2" },
      ],
    },
    {
      segments: ["products"],
      label: "Product Master",
      icon: "Package",
      children: [
        { label: "Master Product List", query: "view=products", icon: "Package" },
        { label: "Product Group List", query: "view=groups", icon: "Boxes" },
        { label: "Product Subgroup List", query: "view=subgroups", icon: "FolderOpen" },
        { label: "Product Brand List", query: "view=brands", icon: "Building2" },
        { label: "Product Manufacturer List", query: "view=manufacturers", icon: "Landmark" },
        { label: "Product Unit List", query: "view=units", icon: "Ruler" },
      ],
    },
    { segments: ["transport-agents"], label: "Transport Agent Master", icon: "Building2" },
    { segments: ["transport-planner"], label: "Transport Planner", icon: "Truck" },
  ],
  sales: [
    { segments: [], label: "Overview", icon: "LayoutDashboard" },
    {
      segments: ["orders"],
      label: "Order Master",
      icon: "ClipboardList",
      children: ORDER_MASTER_NAV_CHILDREN_BY_PORTAL.sales,
    },
    { segments: ["create-order"], label: "Create Order", icon: "FilePlus" },

  ],
  finance: [
    { segments: [], label: "Overview", icon: "LayoutDashboard" },
    {
      segments: ["orders"],
      label: "Order Master",
      icon: "ClipboardCheck",
      children: ORDER_MASTER_NAV_CHILDREN_BY_PORTAL.finance,
    },
    { segments: ["create-order"], label: "Create Order", icon: "FilePlus" },

    {
      segments: ["parties"],
      label: "Party Master",
      icon: "Users",
      children: [
        { label: "Master Party List", query: "view=parties", icon: "Users" },
        { label: "Zone Management List", query: "view=zones", icon: "Map" },
        { label: "Country List", query: "view=countries", icon: "Landmark" },
        { label: "State List", query: "view=states", icon: "MapPin" },
        { label: "City List", query: "view=cities", icon: "Building2" },
      ],
    },
    {
      segments: ["products"],
      label: "Product Master",
      icon: "Package",
      children: [
        { label: "Master Product List", query: "view=products", icon: "Package" },
        { label: "Product Group List", query: "view=groups", icon: "Boxes" },
        { label: "Product Subgroup List", query: "view=subgroups", icon: "FolderOpen" },
        { label: "Product Brand List", query: "view=brands", icon: "Building2" },
        { label: "Product Manufacturer List", query: "view=manufacturers", icon: "Landmark" },
        { label: "Product Unit List", query: "view=units", icon: "Ruler" },
      ],
    },
    { segments: ["transport-agents"], label: "Transport Agent Master", icon: "Building2" },
    { segments: ["transport-planner"], label: "Transport Planner", icon: "Truck" },
  ],
  account: [
    { segments: [], label: "Overview", icon: "LayoutDashboard" },
    {
      segments: ["orders"],
      label: "Order Master",
      icon: "ClipboardCheck",
      children: ORDER_MASTER_NAV_CHILDREN_BY_PORTAL.account,
    },
    { segments: ["create-order"], label: "Create Order", icon: "FilePlus" },
    {
      segments: ["parties"],
      label: "Party Master",
      icon: "Users",
      children: [
        { label: "Master Party List", query: "view=parties", icon: "Users" },
        { label: "Zone Management List", query: "view=zones", icon: "Map" },
        { label: "Country List", query: "view=countries", icon: "Landmark" },
        { label: "State List", query: "view=states", icon: "MapPin" },
        { label: "City List", query: "view=cities", icon: "Building2" },
      ],
    },
    {
      segments: ["products"],
      label: "Product Master",
      icon: "Package",
      children: [
        { label: "Master Product List", query: "view=products", icon: "Package" },
        { label: "Product Group List", query: "view=groups", icon: "Boxes" },
        { label: "Product Subgroup List", query: "view=subgroups", icon: "FolderOpen" },
        { label: "Product Brand List", query: "view=brands", icon: "Building2" },
        { label: "Product Manufacturer List", query: "view=manufacturers", icon: "Landmark" },
        { label: "Product Unit List", query: "view=units", icon: "Ruler" },
      ],
    },
    { segments: ["transport-agents"], label: "Transport Agent Master", icon: "Building2" },
    { segments: ["transport-planner"], label: "Transport Planner", icon: "Truck" },
  ],
  dispatch: [
    { segments: [], label: "Overview", icon: "LayoutDashboard" },
    {
      segments: ["orders"],
      label: "Order Master",
      icon: "Inbox",
      children: ORDER_MASTER_NAV_CHILDREN_BY_PORTAL.dispatch,
    },
    { segments: ["transport-agents"], label: "Transport Agents", icon: "Building2" },
    { segments: ["transport-planner"], label: "Transport Planner", icon: "Truck" },
  ],
  super_admin: [
    { segments: [], label: "Overview", icon: "LayoutDashboard" },
    {
      segments: ["orders"],
      label: "Order Master",
      icon: "ClipboardList",
      children: ORDER_MASTER_NAV_CHILDREN_BY_PORTAL.super_admin,
    },
    { segments: ["create-order"], label: "Create Order", icon: "FilePlus" },

    {
      segments: ["parties"],
      label: "Party Master",
      icon: "Building2",
      children: [
        { label: "Master Party List", query: "view=parties", icon: "Users" },
        { label: "Zone Management List", query: "view=zones", icon: "Map" },
        { label: "Country List", query: "view=countries", icon: "Landmark" },
        { label: "State List", query: "view=states", icon: "MapPin" },
        { label: "City List", query: "view=cities", icon: "Building2" },
      ],
    },
    {
      segments: ["products"],
      label: "Product Master",
      icon: "Package",
      children: [
        { label: "Master Product List", query: "view=products", icon: "Package" },
        { label: "Product Group List", query: "view=groups", icon: "Boxes" },
        { label: "Product Subgroup List", query: "view=subgroups", icon: "FolderOpen" },
        { label: "Product Brand List", query: "view=brands", icon: "Building2" },
        { label: "Product Manufacturer List", query: "view=manufacturers", icon: "Landmark" },
        { label: "Product Unit List", query: "view=units", icon: "Ruler" },
      ],
    },
    { segments: ["transport-agents"], label: "Transport Agent Master", icon: "Building2" },
    { segments: ["transport-planner"], label: "Transport Planner", icon: "Truck" },
  ],
};

export function isPortalKey(x: string): x is PortalKey {
  return (PORTALS as readonly string[]).includes(x);
}

export function portalHref(
  portal: PortalKey,
  segments: readonly string[],
): string {
  if (!segments.length) return `/${portal}`;
  return `/${portal}/${segments.join("/")}`;
}

/** Title for the current path; falls back to humanized last segment. */
export function resolvePortalPageTitle(
  portal: PortalKey,
  rest: readonly string[] | undefined,
): string {
  const pathSegs = rest ?? [];
  const leaves = PORTAL_NAV[portal];
  if (
    pathSegs[0] === "orders" &&
    pathSegs.length >= 2 &&
    isPortalKey(portal)
  ) {
    const queueLabel = resolveOrderStageLabel(
      portal as OrderMasterPortalKey,
      pathSegs[1],
    );
    if (queueLabel) return queueLabel;
  }

  const hit = leaves.find(
    (l) =>
      l.segments.length === pathSegs.length &&
      l.segments.every((s, i) => s === pathSegs[i]),
  );
  if (hit) return hit.label;
  if (!pathSegs.length) return "Overview";
  return pathSegs[pathSegs.length - 1]
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function isNavLeafActive(
  portal: string,
  leaf: PortalNavLeaf,
  pathname: string,
): boolean {
  if (!isPortalKey(portal)) return false;
  const href = portalHref(portal, leaf.segments);
  if (pathname === href) return true;
  if (href !== `/${portal}` && pathname.startsWith(`${href}/`)) return true;

  // Custom rule: make Orders active when viewing /order/*
  if (leaf.segments[0] === "orders" && pathname.startsWith(`/${portal}/order/`)) {
    return true;
  }
  return false;
}
