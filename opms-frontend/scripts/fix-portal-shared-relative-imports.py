#!/usr/bin/env python3
"""Fix relative imports broken after portal/shared reorg."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHARED = ROOT / "src/components/portal/shared"

ALIAS = "@/components/portal/shared"

# Applied to every file under SHARED (except ui/modals for LargeModalPortal same-dir imports)
GLOBAL_SUBS = [
    ('from "./LargeModalPortal"', f'from "{ALIAS}/ui/modals/LargeModalPortal"'),
    ('from "../orderList/', 'from "../orders/list/'),
    ('from "./orderList/', 'from "../../orders/list/'),  # parties/pages, products/pages
    ('from "../orderDetail/', 'from "../detail/'),
    ('from "./orderList/orderWorkflowTabs"', f'from "{ALIAS}/orders/list/orderWorkflowTabs"'),
    ('from "./orderList/', 'from "../../orders/list/'),
]

# Path-specific: (substring in path, old, new)
PATH_SUBS: list[tuple[str, str, str]] = [
    ("/fleet/pages/", 'from "./modals/', 'from "../modals/'),
    ("/fleet/pages/", 'from "./fleetDisplay"', f'from "{ALIAS}/lib/fleetDisplay"'),
    ("/fleet/pages/", 'from "./buildTransportAgentPdf"', f'from "{ALIAS}/pdf/builders/buildTransportAgentPdf"'),
    ("/fleet/pages/", 'from "./pdfCompanyLetterhead"', f'from "{ALIAS}/pdf/templates/pdfCompanyLetterhead"'),
    ("/fleet/modals/", 'from "../fleetDisplay"', f'from "{ALIAS}/lib/fleetDisplay"'),
    ("/parties/pages/ListZonePartiesPage", 'from "./ZoneDetailModal"', 'from "../modals/ZoneDetailModal"'),
    ("/parties/pages/PartyDetailPage", 'from "./PartyContactsDisplay"', 'from "../components/PartyContactsDisplay"'),
    ("/parties/pages/PartyDetailPage", 'from "./PartyDetailModal"', 'from "../modals/PartyDetailModal"'),
    ("/products/pages/ProductDetailPage", 'from "./ProductDetailModal"', 'from "../modals/ProductDetailModal"'),
    ("/products/pages/ProductDetailPage", 'from "./productRefLabel"', f'from "{ALIAS}/lib/productRefLabel"'),
    ("/products/pages/ListProductsPage", 'from "./productRefLabel"', f'from "{ALIAS}/lib/productRefLabel"'),
    ("/products/modals/ProductDetailModal", 'from "./productRefLabel"', f'from "{ALIAS}/lib/productRefLabel"'),
    ("/products/integrations/GoogleSheetProductsModal", 'from "./productRefLabel"', f'from "{ALIAS}/lib/productRefLabel"'),
    ("/products/integrations/GoogleSheetProductsModal", 'from "./ProductKitItemsMapping"', 'from "../components/ProductKitItemsMapping"'),
    ("/products/integrations/GoogleSheetProductsModal", 'from "./kitBucketExpand"', f'from "{ALIAS}/lib/kitBucketExpand"'),
    ("/products/components/ProductKitItemsMapping", 'from "./ConfirmRemoveKitItemModal"', 'from "../modals/ConfirmRemoveKitItemModal"'),
    ("/shell/PortalOverviewShell", 'from "./pickOrders"', 'from "../lib/pickOrders"'),
    ("/ui/fulfillment/OrderLifecycleProgress", 'from "./orderLifecycle"', 'from "../../orders/lib/orderLifecycle"'),
    ("/ui/fulfillment/OrderDepartmentFulfillmentPanel", 'from "./orderList/orderWorkflowTabs"', 'from "../../orders/list/orderWorkflowTabs"'),
    ("/orders/lib/orderDepartmentStages", 'from "./returnSettlement"', f'from "{ALIAS}/lib/returnSettlement"'),
    ("/orders/lib/orderDepartmentStages", 'from "./orderList/orderWorkflowTabs"', 'from "../list/orderWorkflowTabs"'),
    ("/pdf/builders/", 'from "./pdfCompanyLetterhead"', 'from "../templates/pdfCompanyLetterhead"'),
    ("/pdf/builders/", 'from "./OrderItemsPdfTemplate"', 'from "../templates/OrderItemsPdfTemplate"'),
    ("/pdf/builders/", 'from "./FinalOrderStatementPdfTemplate"', 'from "../templates/FinalOrderStatementPdfTemplate"'),
    ("/pdf/builders/", 'from "./UnbilledOrdersPdfTemplate"', 'from "../templates/UnbilledOrdersPdfTemplate"'),
]


def fix_file(path: Path) -> bool:
    rel = str(path.relative_to(SHARED)).replace("\\", "/")
    text = path.read_text(encoding="utf-8")
    original = text

    for old, new in GLOBAL_SUBS:
        if "/ui/modals/" in rel and "LargeModalPortal" in old:
            continue
        text = text.replace(old, new)

    for needle, old, new in PATH_SUBS:
        if needle in f"/{rel}":
            text = text.replace(old, new)

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = 0
    for path in SHARED.rglob("*"):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        if fix_file(path):
            changed += 1
    print(f"Fixed relative imports in {changed} files")


if __name__ == "__main__":
    main()
