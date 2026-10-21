import type { ZoneRecord } from "@/store/api";

export function normalizeZoneName(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildPartyZoneResolver(zones: ZoneRecord[]) {
  const active = zones.filter((z) => z.is_active !== false);
  const byNorm = new Map<string, ZoneRecord>();
  for (const z of active) {
    byNorm.set(normalizeZoneName(z.name), z);
  }

  return {
    resolveFromName(name: string | undefined): ZoneRecord | null {
      const n = normalizeZoneName(name);
      if (!n) return null;
      return byNorm.get(n) || null;
    },
    resolveFromId(id: string | undefined): ZoneRecord | null {
      if (!id) return null;
      return active.find((z) => z._id === id) || null;
    },
    zoneNames: active.map((z) => z.name).sort(),
    zones: active,
  };
}
