import { AUTH_API } from "./authApiPaths";
import {
  broadcastAuthLogout,
  isSessionTerminated,
  markSessionTerminated,
} from "./sessionTerminator";

export type PerformLogoutOptions = {
  logoutUrl?: string;
  redirectTo: string;
  clearLocal: () => void;
};

/**
 * Full sign-out: revoke refresh on auth-service (clears HttpOnly cookies via proxy),
 * then clear client-visible cookies and hard-navigate so middleware cannot silently re-login.
 */
export async function performLogout(options: PerformLogoutOptions): Promise<void> {
  if (typeof window === "undefined") return;

  const redirectTo = options.redirectTo;

  if (isSessionTerminated()) {
    window.location.assign(redirectTo);
    return;
  }

  markSessionTerminated();
  broadcastAuthLogout();

  try {
    await fetch(options.logoutUrl ?? AUTH_API.logout, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    /* still clear local session */
  }

  options.clearLocal();
  window.location.assign(redirectTo);
}
