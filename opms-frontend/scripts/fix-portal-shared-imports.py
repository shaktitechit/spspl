#!/usr/bin/env python3
"""Rewrite @/components/portal/shared/* import paths after folder reorg."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

# Longer prefixes first
REPLACEMENTS: list[tuple[str, str]] = [
    ("/shared/orderDetail/", "/shared/orders/detail/"),
    ("/shared/orderList/", "/shared/orders/list/"),
    ("/shared/modals/", "/shared/fleet/modals/"),
    ("/shared/PortalAuthGate", "/shared/shell/PortalAuthGate"),
    ("/shared/PortalOverviewShell", "/shared/shell/PortalOverviewShell"),
    ("/shared/PortalBusyOverlay", "/shared/shell/PortalBusyOverlay"),
    ("/shared/PortalMutationOverlay", "/shared/shell/PortalMutationOverlay"),
    ("/shared/PortalFullScreenLoader", "/shared/shell/PortalFullScreenLoader"),
    ("/shared/portalLoaderMessages", "/shared/shell/portalLoaderMessages"),
    ("/shared/portalPresentation", "/shared/shell/portalPresentation"),
    ("/shared/LargeModalPortal", "/shared/ui/modals/LargeModalPortal"),
    ("/shared/LargeModalBackdrop", "/shared/ui/modals/LargeModalBackdrop"),
    ("/shared/ModalOverlay", "/shared/ui/modals/ModalOverlay"),
    ("/shared/modalLayout", "/shared/ui/modals/modalLayout"),
    ("/shared/FilePreviewModal", "/shared/ui/modals/FilePreviewModal"),
    ("/shared/OrderFlagBadge", "/shared/ui/badges/OrderFlagBadge"),
    ("/shared/OrderDueSheetBadge", "/shared/ui/badges/OrderDueSheetBadge"),
    ("/shared/FulfillmentCircleStep", "/shared/ui/fulfillment/FulfillmentCircleStep"),
    ("/shared/OrderDepartmentFulfillmentPanel", "/shared/ui/fulfillment/OrderDepartmentFulfillmentPanel"),
    ("/shared/OrderLifecycleProgress", "/shared/ui/fulfillment/OrderLifecycleProgress"),
    ("/shared/usePortalDashboardKpi", "/shared/hooks/usePortalDashboardKpi"),
    ("/shared/useDelayedActive", "/shared/hooks/useDelayedActive"),
    ("/shared/useMedicaApiMutationPending", "/shared/hooks/useMedicaApiMutationPending"),
    ("/shared/userDisplay", "/shared/lib/userDisplay"),
    ("/shared/pickOrders", "/shared/lib/pickOrders"),
    ("/shared/fleetDisplay", "/shared/lib/fleetDisplay"),
    ("/shared/productRefLabel", "/shared/lib/productRefLabel"),
    ("/shared/kitBucketExpand", "/shared/lib/kitBucketExpand"),
    ("/shared/returnSettlement", "/shared/lib/returnSettlement"),
    ("/shared/orderLifecycleActions", "/shared/orders/lib/orderLifecycleActions"),
    ("/shared/orderLifecycle", "/shared/orders/lib/orderLifecycle"),
    ("/shared/flagTypes", "/shared/orders/lib/flagTypes"),
    ("/shared/orderLineQuantities", "/shared/orders/lib/orderLineQuantities"),
    ("/shared/orderDepartmentStages", "/shared/orders/lib/orderDepartmentStages"),
    ("/shared/orderStatusDimensions", "/shared/orders/lib/orderStatusDimensions"),
    ("/shared/orderStatusOptions", "/shared/orders/lib/orderStatusOptions"),
    ("/shared/orderAdminApprovalDisplay", "/shared/orders/lib/orderAdminApprovalDisplay"),
    ("/shared/orderAccountApprovalDisplay", "/shared/orders/lib/orderAccountApprovalDisplay"),
    ("/shared/orderLineRateDisplay", "/shared/orders/lib/orderLineRateDisplay"),
    ("/shared/ListPartiesPage", "/shared/parties/pages/ListPartiesPage"),
    ("/shared/ListZonePartiesPage", "/shared/parties/pages/ListZonePartiesPage"),
    ("/shared/ZonePartiesPage", "/shared/parties/pages/ZonePartiesPage"),
    ("/shared/PartyDetailPage", "/shared/parties/pages/PartyDetailPage"),
    ("/shared/PartyDetailModal", "/shared/parties/modals/PartyDetailModal"),
    ("/shared/BulkUploadPartiesModal", "/shared/parties/modals/BulkUploadPartiesModal"),
    ("/shared/ConfirmDeletePartyModal", "/shared/parties/modals/ConfirmDeletePartyModal"),
    ("/shared/ConfirmBulkDeletePartiesModal", "/shared/parties/modals/ConfirmBulkDeletePartiesModal"),
    ("/shared/ZoneDetailModal", "/shared/parties/modals/ZoneDetailModal"),
    ("/shared/GoogleSheetPartiesModal", "/shared/parties/integrations/GoogleSheetPartiesModal"),
    ("/shared/PartyContactsEditor", "/shared/parties/components/PartyContactsEditor"),
    ("/shared/PartyContactsDisplay", "/shared/parties/components/PartyContactsDisplay"),
    ("/shared/ListProductsPage", "/shared/products/pages/ListProductsPage"),
    ("/shared/ListProductGroupsPage", "/shared/products/pages/ListProductGroupsPage"),
    ("/shared/ListProductSubgroupsPage", "/shared/products/pages/ListProductSubgroupsPage"),
    ("/shared/ListProductBrandsPage", "/shared/products/pages/ListProductBrandsPage"),
    ("/shared/ListProductManufacturersPage", "/shared/products/pages/ListProductManufacturersPage"),
    ("/shared/ListProductUnitsPage", "/shared/products/pages/ListProductUnitsPage"),
    ("/shared/ProductDetailPage", "/shared/products/pages/ProductDetailPage"),
    ("/shared/GroupProductsPage", "/shared/products/pages/GroupProductsPage"),
    ("/shared/SubgroupProductsPage", "/shared/products/pages/SubgroupProductsPage"),
    ("/shared/BrandProductsPage", "/shared/products/pages/BrandProductsPage"),
    ("/shared/ManufacturerProductsPage", "/shared/products/pages/ManufacturerProductsPage"),
    ("/shared/ProductDetailModal", "/shared/products/modals/ProductDetailModal"),
    ("/shared/BulkUploadProductsModal", "/shared/products/modals/BulkUploadProductsModal"),
    ("/shared/ConfirmDeleteProductModal", "/shared/products/modals/ConfirmDeleteProductModal"),
    ("/shared/ConfirmBulkDeleteProductsModal", "/shared/products/modals/ConfirmBulkDeleteProductsModal"),
    ("/shared/ConfirmRemoveKitItemModal", "/shared/products/modals/ConfirmRemoveKitItemModal"),
    ("/shared/GoogleSheetProductsModal", "/shared/products/integrations/GoogleSheetProductsModal"),
    ("/shared/ProductKitItemsMapping", "/shared/products/components/ProductKitItemsMapping"),
    ("/shared/ListDriversPage", "/shared/fleet/pages/ListDriversPage"),
    ("/shared/DriverDetailPage", "/shared/fleet/pages/DriverDetailPage"),
    ("/shared/ListVehiclesPage", "/shared/fleet/pages/ListVehiclesPage"),
    ("/shared/VehicleDetailPage", "/shared/fleet/pages/VehicleDetailPage"),
    ("/shared/ListTransportAgentsPage", "/shared/fleet/pages/ListTransportAgentsPage"),
    ("/shared/TransportAgentDetailPage", "/shared/fleet/pages/TransportAgentDetailPage"),
    ("/shared/UnbilledOrdersPdfTemplate", "/shared/pdf/templates/UnbilledOrdersPdfTemplate"),
    ("/shared/FinalOrderStatementPdfTemplate", "/shared/pdf/templates/FinalOrderStatementPdfTemplate"),
    ("/shared/OrderItemsPdfTemplate", "/shared/pdf/templates/OrderItemsPdfTemplate"),
    ("/shared/orderPdfLayout", "/shared/pdf/templates/orderPdfLayout"),
    ("/shared/pdfCompanyLetterhead", "/shared/pdf/templates/pdfCompanyLetterhead"),
    ("/shared/buildUnbilledOrdersPdf", "/shared/pdf/builders/buildUnbilledOrdersPdf"),
    ("/shared/buildFinalOrderStatementPdf", "/shared/pdf/builders/buildFinalOrderStatementPdf"),
    ("/shared/buildOrderItemsPdf", "/shared/pdf/builders/buildOrderItemsPdf"),
    ("/shared/buildTransportAgentPdf", "/shared/pdf/builders/buildTransportAgentPdf"),
    ("/shared/pdfVectorChrome", "/shared/pdf/builders/pdfVectorChrome"),
    ("/shared/OrderDetailTabsNav", "/shared/orders/components/OrderDetailTabsNav"),
    ("/shared/OrderDepartmentFlagsTab", "/shared/orders/components/OrderDepartmentFlagsTab"),
    ("/shared/DueSheetTab", "/shared/orders/components/DueSheetTab"),
    ("/shared/RemindersTab", "/shared/orders/components/RemindersTab"),
    ("/shared/OverviewFlagsWidget", "/shared/orders/components/OverviewFlagsWidget"),
    ("/shared/ResolveFlagModal", "/shared/orders/modals/ResolveFlagModal"),
    ("/shared/FinalOrderStatementModal", "/shared/orders/modals/FinalOrderStatementModal"),
    ("/shared/ItemFulfillmentDetailsModal", "/shared/orders/modals/ItemFulfillmentDetailsModal"),
    ("/shared/MapOrderLinePriceModal", "/shared/orders/modals/MapOrderLinePriceModal"),
    ("/shared/PreviousPartyItemsModal", "/shared/orders/modals/PreviousPartyItemsModal"),
    ("/shared/WorkflowEmailControls", "/shared/orders/modals/WorkflowEmailControls"),
    ("/shared/GoogleSheetAnalyticsModal", "/shared/orders/integrations/GoogleSheetAnalyticsModal"),
    ("/shared/GoogleSheetRemindersModal", "/shared/integrations/GoogleSheetRemindersModal"),
    ("/shared/ProfilePage", "/shared/profile/ProfilePage"),
]

# Relative imports from portal/index and similar ./shared/X
REL_REPLACEMENTS: list[tuple[str, str]] = [
    ("./shared/orderDetail/", "./shared/orders/detail/"),
    ("./shared/orderList/", "./shared/orders/list/"),
    ("./shared/PortalAuthGate", "./shared/shell/PortalAuthGate"),
    ("./shared/PortalFullScreenLoader", "./shared/shell/PortalFullScreenLoader"),
    ("./shared/PortalBusyOverlay", "./shared/shell/PortalBusyOverlay"),
    ("./shared/PortalMutationOverlay", "./shared/shell/PortalMutationOverlay"),
    ("./shared/ListPartiesPage", "./shared/parties/pages/ListPartiesPage"),
    ("./shared/ListZonePartiesPage", "./shared/parties/pages/ListZonePartiesPage"),
    ("./shared/ZonePartiesPage", "./shared/parties/pages/ZonePartiesPage"),
    ("./shared/ZoneDetailModal", "./shared/parties/modals/ZoneDetailModal"),
    ("./shared/ListProductsPage", "./shared/products/pages/ListProductsPage"),
    ("./shared/ListProductGroupsPage", "./shared/products/pages/ListProductGroupsPage"),
    ("./shared/ListProductSubgroupsPage", "./shared/products/pages/ListProductSubgroupsPage"),
    ("./shared/ListProductBrandsPage", "./shared/products/pages/ListProductBrandsPage"),
    ("./shared/ListProductManufacturersPage", "./shared/products/pages/ListProductManufacturersPage"),
    ("./shared/GroupProductsPage", "./shared/products/pages/GroupProductsPage"),
    ("./shared/SubgroupProductsPage", "./shared/products/pages/SubgroupProductsPage"),
    ("./shared/BrandProductsPage", "./shared/products/pages/BrandProductsPage"),
    ("./shared/ManufacturerProductsPage", "./shared/products/pages/ManufacturerProductsPage"),
    ("./shared/PartyDetailPage", "./shared/parties/pages/PartyDetailPage"),
    ("./shared/ProductDetailPage", "./shared/products/pages/ProductDetailPage"),
    ("./shared/ListDriversPage", "./shared/fleet/pages/ListDriversPage"),
    ("./shared/ListVehiclesPage", "./shared/fleet/pages/ListVehiclesPage"),
    ("./shared/DriverDetailPage", "./shared/fleet/pages/DriverDetailPage"),
    ("./shared/VehicleDetailPage", "./shared/fleet/pages/VehicleDetailPage"),
    ("./shared/ListTransportAgentsPage", "./shared/fleet/pages/ListTransportAgentsPage"),
    ("./shared/TransportAgentDetailPage", "./shared/fleet/pages/TransportAgentDetailPage"),
    ("./shared/ProfilePage", "./shared/profile/ProfilePage"),
    ("./shared/PortalOverviewShell", "./shared/shell/PortalOverviewShell"),
    ("./shared/usePortalDashboardKpi", "./shared/hooks/usePortalDashboardKpi"),
    ("./shared/pickOrders", "./shared/lib/pickOrders"),
]

# shell Topbar relative
REL_SHELL = [
    ("../portal/shared/GoogleSheetRemindersModal", "../portal/shared/integrations/GoogleSheetRemindersModal"),
]


def apply_replacements(text: str, pairs: list[tuple[str, str]]) -> str:
    for old, new in pairs:
        text = text.replace(old, new)
    return text


def main() -> None:
    changed = 0
    for path in SRC.rglob("*"):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        original = path.read_text(encoding="utf-8")
        updated = apply_replacements(original, REPLACEMENTS)
        updated = apply_replacements(updated, REL_REPLACEMENTS)
        if "components/shell/" in str(path):
            updated = apply_replacements(updated, REL_SHELL)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed += 1
    print(f"Updated {changed} files under src/")


if __name__ == "__main__":
    main()
