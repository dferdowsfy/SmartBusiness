// PR 10: admin review queue. GET lists items; POST applies an action.
// GET  -> { items }
// POST { action, itemId } -> { ok, message }
import { isEnabled } from "../../../graph/db";
import { getCurrentUser } from "../../../../lib/supabase/server";
import { listAdminReviewQueue, applyAdminAction, type AdminAction } from "../../../requirements/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ items: [] });
  const items = await listAdminReviewQueue();
  return Response.json({ items });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });

  let body: { action?: AdminAction; itemId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.action || !body.itemId) {
    return Response.json({ error: "action and itemId are required" }, { status: 400 });
  }
  const result = await applyAdminAction({ action: body.action, itemId: body.itemId, adminUserId: user.id });
  return Response.json(result);
}
