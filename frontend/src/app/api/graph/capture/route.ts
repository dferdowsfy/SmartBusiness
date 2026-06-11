// Knowledge-graph capture endpoint (fire-and-forget receiver).
//
// The client posts CaptureEvents here. Capture is best-effort and must NEVER
// affect the user flow: any error is swallowed and logged. When DATABASE_URL
// is not configured the store no-ops and this returns { stored: false }.

import { capture } from "../../../graph/store";
import type { CaptureEvent } from "../../../graph/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let event: CaptureEvent;
  try {
    event = (await request.json()) as CaptureEvent;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!event || !("kind" in event) || !("submission_id" in event)) {
    return Response.json({ ok: false, error: "Missing kind/submission_id" }, { status: 400 });
  }

  try {
    const result = await capture(event);
    return Response.json(result);
  } catch (err) {
    // Observational layer — never surface failures to the caller.
    console.error("[graph] capture failed:", (err as Error).message);
    return Response.json({ ok: true, stored: false });
  }
}
