/**
 * @fileoverview Date range calculation utilities for reports and filtering.
 */
export type DateFilterPreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_week"
  | "last_week"
  | "this_month"
  | "current_month"
  | "last_month"
  | "custom";

export function toYmdString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toYmdString(start), to: toYmdString(end) };
}

export function extractRecordYmd(dateVal: unknown): string {
  if (!dateVal) return "";
  if (typeof dateVal === "string") {
    const trimmed = dateVal.trim();
    if (trimmed.length >= 10 && trimmed[4] === "-" && trimmed[7] === "-") {
      return trimmed.slice(0, 10);
    }
  }
  try {
    const d = new Date(dateVal as any);
    if (!isNaN(d.getTime())) {
      return toYmdString(d);
    }
  } catch {}
  return "";
}

export function calculateDateRange(preset: DateFilterPreset | string, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  if (preset === "custom") {
    let f = customFrom || toYmdString(now);
    let t = customTo || toYmdString(now);
    if (f > t) {
      const tmp = f;
      f = t;
      t = tmp;
    }
    return { from: f, to: t };
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
  if (preset === "7d") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { from: toYmdString(start), to: toYmdString(now) };
  }
  if (preset === "30d") {
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    return { from: toYmdString(start), to: toYmdString(now) };
  }
  if (preset === "this_week") {
    const start = new Date(now);
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return { from: toYmdString(start), to: toYmdString(now) };
  }
  if (preset === "last_week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() - 7);
    const end = new Date(now);
    end.setDate(now.getDate() - now.getDay() - 1);
    return { from: toYmdString(start), to: toYmdString(end) };
  }
  if (preset === "this_month" || preset === "current_month") {
    return getCurrentMonthRange();
  }
  if (preset === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toYmdString(start), to: toYmdString(end) };
  }
  return { from: "", to: "" };
}
