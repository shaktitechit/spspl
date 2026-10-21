/**
 * useNotificationStream
 *
 * Opens a Server-Sent Events connection to `/api/notifications/stream`.
 * When the server pushes a `notification` event, it calls `onNew()` directly
 * so the caller can trigger a refetch immediately.
 *
 * Features:
 * - Auto-reconnects with exponential back-off (up to 30 s) on disconnect / error
 * - Stops when the user logs out (no token)
 * - Cleans up properly on unmount
 */
"use client";

import { useEffect, useRef } from "react";
import { publicNotificationServiceOrigin } from "@/lib/env";

const BASE_DELAY = 1_500; // ms
const MAX_DELAY = 30_000; // ms

/**
 * @param token  - Auth JWT from Redux store / storage. Pass null/undefined when logged out.
 * @param onNew  - Callback fired whenever a new `notification` SSE event arrives.
 */
export function useNotificationStream(
  token: string | null | undefined,
  onNew: () => void
) {
  const onNewRef = useRef(onNew);
  useEffect(() => {
    onNewRef.current = onNew;
  });

  const esRef = useRef<EventSource | null>(null);
  const retryDelay = useRef(BASE_DELAY);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);

  useEffect(() => {
    unmounted.current = false;

    if (!token) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    function connect() {
      if (unmounted.current) return;

      const url = `${publicNotificationServiceOrigin()}/api/notifications/stream?token=${encodeURIComponent(
        token as string
      )}`;
      const es = new EventSource(url);

      esRef.current = es;

      es.addEventListener("connected", () => {
        retryDelay.current = BASE_DELAY;
      });

      es.addEventListener("notification", () => {
        onNewRef.current();
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (unmounted.current) return;

        const delay = retryDelay.current;
        retryDelay.current = Math.min(delay * 2, MAX_DELAY);
        reconnectTimer.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      esRef.current?.close();
      esRef.current = null;
    };
  }, [token]);
}
