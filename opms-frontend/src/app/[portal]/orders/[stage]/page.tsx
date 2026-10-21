"use client";

import { useParams } from "next/navigation";

import PortalOrdersRoute from "@/components/portal/shared/orders/list/PortalOrdersRoute";
import { portalHomeForPortal } from "@/components/portal/shared/orders/list/orderMasterNav";
import { isPortalKey } from "@/constants/portalNav";

/** Dedicated route segment per process queue (same UI as catch-all `orders/:stage`). */
export default function PortalOrdersStagePage() {
  const params = useParams();
  const portal = String(params.portal ?? "");
  const stage = String(params.stage ?? "");

  if (!isPortalKey(portal)) return null;

  return (
    <PortalOrdersRoute
      portalHome={portalHomeForPortal(portal)}
      stage={stage}
    />
  );
}
