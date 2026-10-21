#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHARED="$ROOT/src/components/portal/shared"
cd "$SHARED"

mkdir -p shell ui/modals ui/badges ui/fulfillment hooks lib \
  parties/pages parties/modals parties/components parties/integrations \
  products/pages products/modals products/components products/integrations \
  fleet/pages fleet/modals orders/components orders/modals orders/lib orders/integrations \
  pdf/templates pdf/builders profile integrations

git_mv() {
  if [[ -e "$1" ]]; then
    git mv "$1" "$2"
  fi
}

# Nested folders → orders/*
git_mv orderList orders/list
git_mv orderDetail orders/detail

# Fleet modals (was shared/modals)
for f in modals/*; do
  [[ -e "$f" ]] || continue
  git_mv "$f" "fleet/modals/$(basename "$f")"
done
rmdir modals 2>/dev/null || true

# Shell
for f in PortalAuthGate.tsx PortalOverviewShell.tsx PortalBusyOverlay.tsx \
  PortalMutationOverlay.tsx PortalFullScreenLoader.tsx \
  portalLoaderMessages.ts portalPresentation.ts; do
  git_mv "$f" "shell/$f"
done

# UI
for f in LargeModalPortal.tsx LargeModalBackdrop.tsx ModalOverlay.tsx modalLayout.ts FilePreviewModal.tsx; do
  git_mv "$f" "ui/modals/$f"
done
for f in OrderFlagBadge.tsx OrderDueSheetBadge.tsx; do
  git_mv "$f" "ui/badges/$f"
done
for f in FulfillmentCircleStep.tsx OrderDepartmentFulfillmentPanel.tsx OrderLifecycleProgress.tsx; do
  git_mv "$f" "ui/fulfillment/$f"
done

# Hooks
for f in usePortalDashboardKpi.ts useDelayedActive.ts useMedicaApiMutationPending.ts; do
  git_mv "$f" "hooks/$f"
done

# Lib (cross-cutting)
for f in userDisplay.ts pickOrders.ts fleetDisplay.ts productRefLabel.ts kitBucketExpand.ts returnSettlement.ts; do
  git_mv "$f" "lib/$f"
done

# Orders lib
for f in orderLifecycle.ts orderLifecycleActions.ts flagTypes.ts orderLineQuantities.ts \
  orderDepartmentStages.ts orderStatusDimensions.ts orderStatusOptions.ts \
  orderAdminApprovalDisplay.ts orderAccountApprovalDisplay.ts orderLineRateDisplay.tsx; do
  git_mv "$f" "orders/lib/$f"
done

# Parties
for f in ListPartiesPage.tsx ListZonePartiesPage.tsx ZonePartiesPage.tsx PartyDetailPage.tsx; do
  git_mv "$f" "parties/pages/$f"
done
for f in PartyDetailModal.tsx BulkUploadPartiesModal.tsx ConfirmDeletePartyModal.tsx \
  ConfirmBulkDeletePartiesModal.tsx ZoneDetailModal.tsx; do
  git_mv "$f" "parties/modals/$f"
done
git_mv GoogleSheetPartiesModal.tsx parties/integrations/GoogleSheetPartiesModal.tsx
for f in PartyContactsEditor.tsx PartyContactsDisplay.tsx; do
  git_mv "$f" "parties/components/$f"
done

# Products
for f in ListProductsPage.tsx ListProductGroupsPage.tsx ListProductSubgroupsPage.tsx \
  ListProductBrandsPage.tsx ListProductManufacturersPage.tsx ListProductUnitsPage.tsx \
  ProductDetailPage.tsx GroupProductsPage.tsx SubgroupProductsPage.tsx BrandProductsPage.tsx \
  ManufacturerProductsPage.tsx; do
  git_mv "$f" "products/pages/$f"
done
for f in ProductDetailModal.tsx BulkUploadProductsModal.tsx ConfirmDeleteProductModal.tsx \
  ConfirmBulkDeleteProductsModal.tsx ConfirmRemoveKitItemModal.tsx; do
  git_mv "$f" "products/modals/$f"
done
git_mv GoogleSheetProductsModal.tsx products/integrations/GoogleSheetProductsModal.tsx
git_mv ProductKitItemsMapping.tsx products/components/ProductKitItemsMapping.tsx

# Fleet pages
for f in ListDriversPage.tsx DriverDetailPage.tsx ListVehiclesPage.tsx VehicleDetailPage.tsx \
  ListTransportAgentsPage.tsx TransportAgentDetailPage.tsx; do
  git_mv "$f" "fleet/pages/$f"
done

# PDF
for f in UnbilledOrdersPdfTemplate.tsx FinalOrderStatementPdfTemplate.tsx OrderItemsPdfTemplate.tsx \
  orderPdfLayout.tsx pdfCompanyLetterhead.tsx; do
  git_mv "$f" "pdf/templates/$f"
done
for f in buildUnbilledOrdersPdf.ts buildFinalOrderStatementPdf.ts buildOrderItemsPdf.ts \
  buildTransportAgentPdf.ts pdfVectorChrome.ts; do
  git_mv "$f" "pdf/builders/$f"
done

# Orders UI (root leftovers)
for f in OrderDetailTabsNav.tsx OrderDepartmentFlagsTab.tsx DueSheetTab.tsx RemindersTab.tsx OverviewFlagsWidget.tsx; do
  git_mv "$f" "orders/components/$f"
done
for f in ResolveFlagModal.tsx FinalOrderStatementModal.tsx ItemFulfillmentDetailsModal.tsx \
  MapOrderLinePriceModal.tsx PreviousPartyItemsModal.tsx WorkflowEmailControls.tsx; do
  git_mv "$f" "orders/modals/$f"
done
git_mv GoogleSheetAnalyticsModal.tsx orders/integrations/GoogleSheetAnalyticsModal.tsx

# Integrations + profile
git_mv GoogleSheetRemindersModal.tsx integrations/GoogleSheetRemindersModal.tsx
git_mv ProfilePage.tsx profile/ProfilePage.tsx

echo "File moves complete."
