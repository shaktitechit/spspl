import { AUTH_BROADCAST_CHANNEL } from "./constants";

let sessionTerminated = false;

export function isSessionTerminated(): boolean {
  return sessionTerminated;
}

export function markSessionTerminated(): void {
  sessionTerminated = true;
}

export function resetSessionTerminated(): void {
  sessionTerminated = false;
}

export function broadcastAuthLogout(): void {
  if (typeof window === "undefined") return;
  try {
    new BroadcastChannel(AUTH_BROADCAST_CHANNEL).postMessage({ type: "logout" });
  } catch {
    /* ignore */
  }
}

export function subscribeAuthLogout(onLogout: () => void): void {
  if (typeof window === "undefined") return;
  try {
    const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type === "logout") onLogout();
    };
  } catch {
    /* ignore */
  }
}
