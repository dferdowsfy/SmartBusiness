// PR 2: resolve required forms for a target after intake.
// POST { targetId, stateOrTerritory?, municipality?, businessType?, activityType?, intake? }
import { isEnabled } from "../../../graph/db";
import { getCurrentUser } from "../../../../lib/supabase/server";
import { resolveRequirements } from "../../../requirements/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ forms: [], reason: "no_database" });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const targetId = String(body.targetId || "").trim();
  if (!targetId) return Response.json({ error: "targetId is required" }, { status: 400 });

  try {
    const forms = await resolveRequirements({
      tenantId: user.id, // no separate tenant model yet; scope to the user
      targetId,
      userId: user.id,
      stateOrTerritory: (body.stateOrTerritory as string) ?? null,
      municipality: (body.municipality as string) ?? null,
      businessType: (body.businessType as string) ?? null,
      activityType: (body.activityType as string) ?? null,
      intake: (body.intake as Record<string, unknown>) ?? undefined,
    });
    return Response.json({ forms });
  } catch (err) {
    console.error("[requirements/resolve] failed:", (err as Error).message);
    return Response.json({ error: "resolve_failed" }, { status: 500 });
  }
}
