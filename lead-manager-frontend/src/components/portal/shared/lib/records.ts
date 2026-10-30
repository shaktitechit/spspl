export function asRecordArray(raw: unknown): Record<string, unknown>[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (Array.isArray(obj.items)) return obj.items as Record<string, unknown>[];
    if (Array.isArray(obj.results)) return obj.results as Record<string, unknown>[];
    if (Array.isArray(obj.orders)) return obj.orders as Record<string, unknown>[];
    if (Array.isArray(obj.parties)) return obj.parties as Record<string, unknown>[];
    if (Array.isArray(obj.products)) return obj.products as Record<string, unknown>[];
    if (Array.isArray(obj.users)) return obj.users as Record<string, unknown>[];
  }
  return [];
}

