// Submission history list. Reads v_submission_history (most recent first).
// Read-only; returns empty when no DATABASE_URL is configured.

import { query, isEnabled } from "../../graph/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isEnabled()) return Response.json({ enabled: false, submissions: [] });
  try {
    const submissions = await query(
      `SELECT id, created_at, municipality, industry, business_type, business_structure,
              location_type, readiness_score, readiness_status, document_count
       FROM v_submission_history LIMIT 200`
    );
    return Response.json({ enabled: true, submissions });
  } catch (err) {
    console.error("[history] list failed:", (err as Error).message);
    return Response.json({ enabled: true, submissions: [], error: "query_failed" });
  }
}
