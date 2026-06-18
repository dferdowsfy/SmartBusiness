// PR 3: list required forms for a target. GET ?targetId=...
import { isEnabled } from "../../../graph/db";
import { getCurrentUser } from "../../../../lib/supabase/server";
import { listRequiredForms } from "../../../requirements/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ forms: [] });

  const targetId = new URL(request.url).searchParams.get("targetId");
  if (!targetId) return Response.json({ error: "targetId is required" }, { status: 400 });

  try {
    const forms = await listRequiredForms(targetId);
    return Response.json({ forms });
  } catch (err) {
    console.error("[requirements/forms] failed:", (err as Error).message);
    return Response.json({ forms: [], error: "query_failed" });
  }
}
