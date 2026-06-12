// Submission history list. User-scoped: only returns the signed-in user's
// own submissions. Supports ?business=<id> to filter to one business.

import { query, isEnabled } from "../../graph/db";
import { getCurrentUser } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isEnabled()) return Response.json({ enabled: false, submissions: [] });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const businessId = url.searchParams.get("business");
  try {
    const params: unknown[] = [user.id];
    let where = `user_id = $1`;
    if (businessId) {
      params.push(businessId);
      where += ` AND business_id = $2`;
    }
    const submissions = await query(
      `SELECT id, created_at, municipality, industry, business_type, business_structure,
              location_type, business_name, business_id, readiness_score, readiness_status, document_count
       FROM v_submission_history WHERE ${where} LIMIT 200`,
      params
    );
    return Response.json({ enabled: true, submissions });
  } catch (err) {
    console.error("[history] list failed:", (err as Error).message);
    return Response.json({ enabled: true, submissions: [], error: "query_failed" });
  }
}
