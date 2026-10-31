/**
 * @fileoverview Date range calculation utilities for reports and filtering.
 */
export type DateFilterPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

export function toYmdString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function calculateDateRange(preset: DateFilterPreset, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  if (preset === "custom") {
    return { from: customFrom || toYmdString(now), to: customTo || toYmdString(now) };
  }
  if (preset === "today") {
    const s = toYmdString(now);
    return { from: s, to: s };
  }
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const s = toYmdString(y);
    return { from: s, to: s };
  }
  if (preset === "this_week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return { from: toYmdString(start), to: toYmdString(now) };
  }
  if (preset === "last_week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() - 7);
    const end = new Date(now);
    end.setDate(now.getDate() - now.getDay() - 1);
    return { from: toYmdString(start), to: toYmdString(end) };
  }
  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toYmdString(start), to: toYmdString(now) };
  }
  if (preset === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toYmdString(start), to: toYmdString(end) };
  }
  return { from: "", to: "" };
}
