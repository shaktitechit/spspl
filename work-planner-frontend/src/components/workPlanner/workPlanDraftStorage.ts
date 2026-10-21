/**
 * @fileoverview Real-time Draft Storage Engine for Work Plan creation & editing.
 * Safely persists uncommitted work plans (fields, visits, tasks, manager discussions) to localStorage
 * to guard against accidental navigation, browser crashes, reloads, or connection drops.
 */

export interface WorkPlanFormDraft {
  version: number;
  salesUserId: string;
  planDate: string;
  planType: string;
  location: string;
  countryId?: string;
  countryName?: string;
  stateId?: string;
  stateName?: string;
  cityId?: string;
  cityName?: string;
  selectedCityIds?: string[];
  selectedCityNames?: string[];
  remarks: string;
  isDiscussedWithManager: boolean | null;
  discussedManagerId: string;
  discussedManagerName: string;
  discussionMethod: "on_call" | "on_direct_meeting" | "on_email" | "other";
  visits: Array<Record<string, any>>;
  works: Array<Record<string, any>>;
  lastSavedAt: string; // ISO date string
}

export function getWorkPlanDraftKey(salesUserId: string, planDate: string): string {
  const safeUser = salesUserId ? String(salesUserId).trim() : "me";
  const safeDate = planDate ? String(planDate).trim() : "nodate";
  return `wp_draft_v1_${safeUser}_${safeDate}`;
}

export function saveWorkPlanDraft(draft: Omit<WorkPlanFormDraft, "version" | "lastSavedAt">): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  if (!draft.planDate || !draft.salesUserId) return false;

  try {
    const key = getWorkPlanDraftKey(draft.salesUserId, draft.planDate);
    const fullDraft: WorkPlanFormDraft = {
      ...draft,
      version: 1,
      lastSavedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(key, JSON.stringify(fullDraft));
    return true;
  } catch (err) {
    console.warn("Failed to save work plan draft to localStorage:", err);
    return false;
  }
}

export function loadWorkPlanDraft(salesUserId: string, planDate: string): WorkPlanFormDraft | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  if (!salesUserId || !planDate) return null;

  try {
    const key = getWorkPlanDraftKey(salesUserId, planDate);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as WorkPlanFormDraft;
    if (!parsed || typeof parsed !== "object") return null;

    // Validate draft matches user and date
    if (String(parsed.salesUserId) !== String(salesUserId) || String(parsed.planDate) !== String(planDate)) {
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn("Failed to parse work plan draft from localStorage:", err);
    return null;
  }
}

export function clearWorkPlanDraft(salesUserId: string, planDate: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (!salesUserId || !planDate) return;

  try {
    const key = getWorkPlanDraftKey(salesUserId, planDate);
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn("Failed to clear work plan draft from localStorage:", err);
  }
}

export function isDraftMeaningful(draft: Partial<WorkPlanFormDraft>): boolean {
  if (!draft) return false;
  if (draft.location && draft.location.trim().length > 0) return true;
  if (draft.remarks && draft.remarks.trim().length > 0) return true;
  if (Array.isArray(draft.visits) && draft.visits.length > 0) return true;
  if (Array.isArray(draft.works) && draft.works.length > 0) return true;
  if (draft.isDiscussedWithManager) return true;
  if (draft.planType && draft.planType !== "Visits") return true;
  return false;
}

export function formatDraftTime(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}
