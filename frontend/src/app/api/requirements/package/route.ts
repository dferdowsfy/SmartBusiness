// PR 7: build a submission package (preparation only — never submitted).
// POST { targetId } -> SubmissionPackage
import { isEnabled } from "../../../graph/db";
import { getCurrentUser } from "../../../../lib/supabase/server";
import { buildSubmissionPackage } from "../../../requirements/package";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });

  let body: { targetId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const targetId = String(body.targetId || "").trim();
  if (!targetId) return Response.json({ error: "targetId is required" }, { status: 400 });

  const pkg = await buildSubmissionPackage({ tenantId: user.id, targetId });
  return Response.json({ package: pkg });
}
