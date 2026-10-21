/** Legacy localStorage session keys — removed on cookie-only auth. */
export const LEGACY_SESSION_STORAGE_KEYS = [
  "shakti.app.session",
  "shakti.lead_manager.session",
  "medica.auth",
  "shakti.user_manager.session",
  "shakti.work_planner.session",
] as const;

export function purgeLegacyAuthStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_SESSION_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
