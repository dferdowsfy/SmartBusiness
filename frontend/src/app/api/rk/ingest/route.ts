// Run the regulatory ingestion pipeline on a stored source.
// POST { sourceId } -> { runId, sections, businessSections, skippedConstruction,
//                        proposalsCreated, usedAI }
// AI extracts and PROPOSES only — nothing is published without human review.
import { isCurrentUserAdmin } from "../../../../lib/admin";
import { getCurrentUser } from "../../../../lib/supabase/server";
import { isEnabled } from "../../../graph/db";
import { runIngestion } from "../../../rk/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });

  let body: { sourceId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.sourceId) return Response.json({ error: "sourceId is required" }, { status: 400 });

  const user = await getCurrentUser();
  try {
    const result = await runIngestion(body.sourceId, user?.email ?? null);
    if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
    return Response.json(result);
  } catch (err) {
    console.error("[rk/ingest]", err);
    return Response.json({ error: "ingestion_failed", message: (err as Error).message }, { status: 500 });
  }
}
