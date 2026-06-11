// ============================================================================
// Client-side fire-and-forget capture helper.
//
// Sends CaptureEvents to /api/graph/capture without ever blocking or breaking
// the user flow. Failures are swallowed. Uses keepalive so events still flush
// if the user navigates away.
// ============================================================================

import type { CaptureEvent } from "./types";

export function captureEvent(event: CaptureEvent): void {
  try {
    // Don't await — observational, must not add latency to the UX.
    void fetch("/api/graph/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never throw from capture */
  }
}

// Generate a correlation id for a submission lifecycle.
export function newSubmissionId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return "sub-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
