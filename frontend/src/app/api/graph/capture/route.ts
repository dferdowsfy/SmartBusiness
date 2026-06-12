// Knowledge-graph capture endpoint (fire-and-forget receiver).
//
// The client posts CaptureEvents here. Capture is best-effort and must NEVER
// affect the user flow: any error is swallowed and logged. When DATABASE_URL
// is not configured the store no-ops and this returns { stored: false }.
//
// If the request carries a valid Supabase session, the captured rows are tied
// to that user; otherwise they're stored anonymously (with optional claim_email
// so the user can adopt them after signing in).

import { capture } from "../../../graph/store";
import type { CaptureEvent } from "../../../graph/types";
import { getCurrentUser } from "../../../../lib/supabase/server";
import { upsertUser } from "../../../graph/auth-actions";

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

  let userId: string | null = null;
  try {
    const user = await getCurrentUser();
    if (user) {
      userId = user.id;
      // Refresh the users mirror lazily so dashboards always have a row.
      await upsertUser(user.id, user.email ?? null, (user.user_metadata?.full_name as string) || null);
    }
  } catch { /* anonymous capture still proceeds */ }

  try {
    const result = await capture(event, { userId });
    return Response.json(result);
  } catch (err) {
    console.error("[graph] capture failed:", (err as Error).message);
    return Response.json({ ok: true, stored: false });
  }
}
