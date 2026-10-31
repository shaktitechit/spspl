"use client";

import { useMemo } from "react";
import { useListZonesQuery, type ZoneRecord } from "@/store/api";
import { buildPartyZoneResolver } from "@/lib/partyZone";

export function usePartyZonesCatalog(enabled = true, status: "active" | "all" = "active") {
  const { data, isLoading } = useListZonesQuery(
    { limit: 1000, status },
    { skip: !enabled },
  );
  const zones = useMemo<ZoneRecord[]>(
    () => (Array.isArray(data) ? data : Array.isArray((data as any)?.data) ? (data as any).data : []),
    [data]
  );
  const resolver = useMemo(() => buildPartyZoneResolver(zones), [zones]);
  return { zones, resolver, isLoading };
}

