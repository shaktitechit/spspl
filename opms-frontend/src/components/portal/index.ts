export {
  PortalAuthGate,
  PortalSectionPlaceholder,
} from "./shared/shell/PortalAuthGate";

export { PortalFullScreenLoader } from "./shared/shell/PortalFullScreenLoader";
export { PortalBusyOverlay, usePortalBusy } from "./shared/shell/PortalBusyOverlay";
export { PortalMutationOverlay } from "./shared/shell/PortalMutationOverlay";

export { default as PortalOverview } from "./PortalOverview";

export { PORTAL_OVERVIEW_BY_KEY } from "./portalOverviewRegistry";

export { default as AdminOverview } from "./admin/AdminOverview";
export { default as ListAdminOrdersPage } from "./admin/order/ListAdminOrdersPage";
export { default as AdminCreateOrderPage } from "./admin/AdminCreateOrderPage";
export { default as ListPartiesPage } from "./shared/parties/pages/ListPartiesPage";
export { default as ListZonePartiesPage } from "./shared/parties/pages/ListZonePartiesPage";
export { default as ZonePartiesPage } from "./shared/parties/pages/ZonePartiesPage";
export { default as ZoneDetailModal } from "./shared/parties/modals/ZoneDetailModal";
export { default as ListPartyCountriesPage } from "./shared/parties/pages/ListPartyCountriesPage";
export { default as ListPartyStatesPage } from "./shared/parties/pages/ListPartyStatesPage";
export { default as ListPartyCitiesPage } from "./shared/parties/pages/ListPartyCitiesPage";
export { default as ListProductsPage } from "./shared/products/pages/ListProductsPage";
export { default as ListProductGroupsPage } from "./shared/products/pages/ListProductGroupsPage";
export { default as ListProductSubgroupsPage } from "./shared/products/pages/ListProductSubgroupsPage";
export { default as ListProductBrandsPage } from "./shared/products/pages/ListProductBrandsPage";
export { default as ListProductManufacturersPage } from "./shared/products/pages/ListProductManufacturersPage";
export { default as GroupProductsPage } from "./shared/products/pages/GroupProductsPage";
export { default as SubgroupProductsPage } from "./shared/products/pages/SubgroupProductsPage";
export { default as BrandProductsPage } from "./shared/products/pages/BrandProductsPage";
export { default as ManufacturerProductsPage } from "./shared/products/pages/ManufacturerProductsPage";
export { default as PartyDetailPage } from "./shared/parties/pages/PartyDetailPage";
export { default as ProductDetailPage } from "./shared/products/pages/ProductDetailPage";
export { default as SalesOverview } from "./sales/SalesOverview";
export { default as SalesCreateOrderPage } from "./sales/CreateOrderPage";
export { default as ListMyOrdersPage } from "./sales/ListMyOrdersPage";
export { default as ListTransportPlansPage } from "./shared/transportPlanner/ListTransportPlansPage";


export { default as TransportPlanFormPage } from "./shared/transportPlanner/TransportPlanFormPage";
export { default as TransportPlanDetailPage } from "./shared/transportPlanner/TransportPlanDetailPage";
export { default as TransportPlanCalendarPage } from "./shared/transportPlanner/TransportPlanCalendarPage";
export { default as TransportPlannerStatsWidgets } from "./shared/transportPlanner/TransportPlannerStatsWidgets";

export { default as FinanceOverview } from "./finance/FinanceOverview";
export { default as ListFinanceOrdersPage } from "./finance/order/ListFinanceOrdersPage";
export { default as FinanceCreateOrderPage } from "./finance/FinanceCreateOrderPage";

export { default as AccountOverview } from "./account/AccountOverview";
export { default as ListAccountOrdersPage } from "./account/order/ListAccountOrdersPage";
export { default as AccountOrderDetail } from "./account/order/AccountOrderDetail";
export { default as AccountCreateOrderPage } from "./account/AccountCreateOrderPage";

export { default as DispatchOverview } from "./dispatch/DispatchOverview";
export { default as ListDispatchOrdersPage } from "./dispatch/order/ListDispatchOrdersPage";
export { default as ListDriversPage } from "./shared/fleet/pages/ListDriversPage";
export { default as ListVehiclesPage } from "./shared/fleet/pages/ListVehiclesPage";
export { default as DriverDetailPage } from "./shared/fleet/pages/DriverDetailPage";
export { default as VehicleDetailPage } from "./shared/fleet/pages/VehicleDetailPage";
export { default as ListTransportAgentsPage } from "./shared/fleet/pages/ListTransportAgentsPage";
export { default as TransportAgentDetailPage } from "./shared/fleet/pages/TransportAgentDetailPage";

// Super Admin portal pages
export { default as SuperAdminOverview } from "./super_admin/SuperAdminOverview";
export { default as SuperAdminOrdersPage } from "./super_admin/SuperAdminOrdersPage";
export { default as ListSuperAdminOrdersPage } from "./super_admin/order/ListSuperAdminOrdersPage";
export { default as SuperAdminOrderDetail } from "./super_admin/order/SuperAdminOrderDetail";
export { default as SuperAdminCreateOrderPage } from "./super_admin/SuperAdminCreateOrderPage";

export { default as ProfilePage } from "./shared/profile/ProfilePage";
export { default as PortalOverviewShell } from "./shared/shell/PortalOverviewShell";
export { usePortalDashboardKpi } from "./shared/hooks/usePortalDashboardKpi";
export { pickOrders } from "./shared/lib/pickOrders";

/** @deprecated Prefer importing {@link DashboardShell} from `@/components/shell`. */
export { DashboardShell, PortalShell } from "@/components/shell";
