"use client";

import { useParams } from "next/navigation";

import PortalOrdersRoute from "@/components/portal/shared/orders/list/PortalOrdersRoute";
import { portalHomeForPortal } from "@/components/portal/shared/orders/list/orderMasterNav";
import { isPortalKey } from "@/constants/portalNav";

/** `/portal/orders` → default queue via {@link PortalOrdersRoute}. */
export default function PortalOrdersIndexPage() {
  const params = useParams();
  const portal = String(params.portal ?? "");

  if (!isPortalKey(portal)) return null;

  return <PortalOrdersRoute portalHome={portalHomeForPortal(portal)} />;
}
