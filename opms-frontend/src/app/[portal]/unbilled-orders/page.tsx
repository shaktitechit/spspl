"use client";

import { notFound, useParams } from "next/navigation";

import { UnbilledOrdersPage } from "@/components/portal";
import { isPortalKey, type PortalKey } from "@/constants/portalNav";

const UNBILLED_ALLOWED_PORTALS = new Set<PortalKey>([
  "admin",
  "coordinator",
  "finance",
  "account",
  "super_admin",
]);

export default function PortalUnbilledOrdersRoutePage() {
  const params = useParams();
  const portal = String(params?.portal ?? "");

  if (!isPortalKey(portal) || !UNBILLED_ALLOWED_PORTALS.has(portal)) {
    notFound();
  }

  const portalLabel =
    portal.charAt(0).toUpperCase() + portal.slice(1);

  return (
    <UnbilledOrdersPage
      portalHome={`/${portal}`}
      portalLabel={portalLabel}
    />
  );
}

