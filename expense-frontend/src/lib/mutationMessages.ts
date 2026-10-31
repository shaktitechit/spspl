/** Derive readable copy from RTK Query injected endpoint names. */

/** User-facing toast when an RTK mutation succeeds (unless suppressed). */
export function mutationSuccessCopy(endpointName: string): string {
  const lower = endpointName.toLowerCase();

  if (lower.includes("delete")) return "Deleted";
  if (lower.includes("restore")) return "Restored";
  if (lower.startsWith("create") || lower.includes("create")) return "Created";
  if (
    lower.includes("patch") ||
    lower.includes("update") ||
    lower.includes("transition") ||
    lower.includes("edit") ||
    lower.includes("followup") ||
    lower.startsWith("mark")
  ) {
    return "Saved";
  }
  return "Done";
}

/**
 * Parses RTK Query mutation rejected actions or unwrap() rejects into a string.
 */
export function mutationRejectedMessage(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "Something went wrong";

  const p = payload as Record<string, unknown>;

  if ("error" in p && typeof p.error === "string" && p.error.trim()) {
    return p.error;
  }

  if ("data" in p && p.data !== undefined && p.data !== null) {
    const raw = payload as any;
    if (raw.data && typeof raw.data === "object") {
      const body = raw.data as { message?: unknown; error?: { message?: unknown } };
      if (typeof body.error?.message === "string" && body.error.message.trim()) {
        return body.error.message;
      }
      if (typeof body.message === "string" && body.message.trim()) {
        return body.message;
      }
    }
  }

  const status = typeof p.status === "number" ? p.status : null;
  if (status !== null) {
    if (status === 401) return "Session expired or unauthorized";
    if (status === 403) return "Forbidden: insufficient permissions";
    if (status === 404) return "Resource not found";
    if (status >= 500) return "Server error occurred. Please try again.";
  }

  if ("message" in p && typeof p.message === "string" && p.message.trim()) {
    return p.message;
  }

  return "An unexpected error occurred";
}

