import { getPool, isEnabled } from "../../../../graph/db";
import { ensureSchema } from "../../../../graph/store";
import { getCurrentUser } from "../../../../../lib/supabase/server";
import { determineObligations } from "../../../../compliance/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  const pool = getPool();
  if (!pool) return Response.json({ error: "Database unavailable." }, { status: 503 });
  let body: { profile?: Record<string, unknown>; answers?: Record<string, unknown> };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const profile = body.profile ?? {};
  if (!String(profile.name || profile.legal_name || "").trim()) {
    return Response.json({ error: "Business legal name is required." }, { status: 400 });
  }
  if (!String(profile.municipality || "").trim() || !String(profile.business_type || "").trim()) {
    return Response.json({ error: "Municipality and business type are required before requirements can be determined." }, { status: 400 });
  }
  try {
    await ensureSchema();
    const result = await determineObligations(pool, profile, body.answers ?? {});
    return Response.json(result);
  } catch (error) {
    console.error("[business-import-preview]", (error as Error).message);
    return Response.json({ error: "Could not determine obligations." }, { status: 500 });
  }
}
