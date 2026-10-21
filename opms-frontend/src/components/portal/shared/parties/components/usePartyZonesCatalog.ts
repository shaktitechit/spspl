"use client";

import { useMemo } from "react";
import { useListZonesQuery } from "@/store/api";
import { buildPartyZoneResolver } from "@/lib/partyZone";

export function usePartyZonesCatalog(enabled = true, status: "active" | "all" = "active") {
  const { data, isLoading } = useListZonesQuery(
    { limit: 1000, status },
    { skip: !enabled },
  );
  const zones = useMemo(() => (Array.isArray(data?.data) ? data.data : []), [data]);
  const resolver = useMemo(() => buildPartyZoneResolver(zones), [zones]);
  return { zones, resolver, isLoading };
}
