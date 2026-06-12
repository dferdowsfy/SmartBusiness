// Single business: detail (with submissions + readiness timeline) and delete.

import { getPool, isEnabled } from "../../../graph/db";
import { getCurrentUser } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });
  const pool = getPool();
  if (!pool) return Response.json({ error: "no_database" }, { status: 503 });

  try {
    const { rows: bizRows } = await pool.query(
      `SELECT id, name, notes, created_at FROM businesses WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );
    const business = bizRows[0];
    if (!business) return Response.json({ error: "not_found" }, { status: 404 });

    const { rows: submissions } = await pool.query(
      `SELECT s.id, s.created_at, s.municipality, s.business_type, s.business_structure,
              s.location_type, rs.score AS readiness_score, rs.status AS readiness_status
         FROM submissions s
         LEFT JOIN LATERAL (SELECT score, status FROM readiness_scores r WHERE r.submission_id = s.id
                            ORDER BY created_at DESC LIMIT 1) rs ON true
        WHERE s.business_id = $1 AND s.user_id = $2 ORDER BY s.created_at DESC`,
      [id, user.id]
    );
    const { rows: deliverables } = await pool.query(
      `SELECT id, kind, filename, generated_at, size_bytes, submission_id
         FROM deliverables WHERE business_id = $1 AND user_id = $2 ORDER BY generated_at DESC`,
      [id, user.id]
    );
    return Response.json({ business, submissions, deliverables });
  } catch (err) {
    console.error("[businesses] detail failed:", (err as Error).message);
    return Response.json({ error: "query_failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const pool = getPool();
  if (!pool) return Response.json({ error: "no_database" }, { status: 503 });
  try {
    // Soft delete keeps the user's compliance record intact.
    const { rowCount } = await pool.query(
      `UPDATE businesses SET archived = true WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );
    if (!rowCount) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ archived: true });
  } catch (err) {
    console.error("[businesses] archive failed:", (err as Error).message);
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }
}
