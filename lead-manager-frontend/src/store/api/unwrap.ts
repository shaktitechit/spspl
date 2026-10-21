/** Medica `{ success: true, data }` envelopes from `backend` controllers. */

export interface ApiEnvelope<T = unknown> {
  success?: boolean;
  data: T;
  message?: string;
}

/** Safe unwrap function supporting both `{ success: true, data: T }` and flat `{ token, user }` responses. */
export function unwrapEnvelope<T>(raw: any): T {
  if (raw && typeof raw === "object" && "data" in raw && raw.data !== undefined) {
    return raw.data as T;
  }
  return raw as T;
}
