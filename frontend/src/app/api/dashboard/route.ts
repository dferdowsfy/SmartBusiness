// Personal dashboard metrics for the signed-in user:
//   businesses count, submissions count, average readiness, documents uploaded,
//   recent activity (most recent events across the user's submissions).

import { getPool, isEnabled } from "../../graph/db";
import { getCurrentUser } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ enabled: false });
  const pool = getPool();
  if (!pool) return Response.json({ enabled: false });

  try {
    const [bizCount, subCount, docCount, avgRow, recent, businesses] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM businesses WHERE user_id = $1 AND archived = false`, [user.id]),
      pool.query(`SELECT COUNT(*)::int AS n FROM submissions WHERE user_id = $1`, [user.id]),
      pool.query(`SELECT COUNT(*)::int AS n FROM document_validations WHERE user_id = $1`, [user.id]),
      pool.query(
        `SELECT ROUND(AVG(latest.score))::int AS avg FROM (
           SELECT DISTINCT ON (s.id) r.score
           FROM submissions s JOIN readiness_scores r ON r.submission_id = s.id
           WHERE s.user_id = $1 ORDER BY s.id, r.created_at DESC
         ) latest`, [user.id]),
      pool.query(
        `SELECT t.event, t.kind, t.created_at, t.submission_id
           FROM v_submission_timeline t
           JOIN submissions s ON s.id = t.submission_id
          WHERE s.user_id = $1
          ORDER BY t.created_at DESC LIMIT 12`, [user.id]),
      pool.query(
        `SELECT b.id, b.name,
                (SELECT rs.score FROM readiness_scores rs
                   JOIN submissions s ON s.id = rs.submission_id
                   WHERE s.business_id = b.id
                   ORDER BY rs.created_at DESC LIMIT 1) AS readiness_score
         FROM businesses b
         WHERE b.user_id = $1 AND b.archived = false
         ORDER BY b.created_at DESC LIMIT 6`, [user.id]),
    ]);

    return Response.json({
      enabled: true,
      user: { id: user.id, email: user.email, name: user.user_metadata?.full_name || null },
      metrics: {
        businesses: bizCount.rows[0]?.n || 0,
        submissions: subCount.rows[0]?.n || 0,
        documents: docCount.rows[0]?.n || 0,
        avgReadiness: avgRow.rows[0]?.avg ?? null,
      },
      recent: recent.rows,
      businesses: businesses.rows,
    });
  } catch (err) {
    console.error("[dashboard] query failed:", (err as Error).message);
    return Response.json({ enabled: true, error: "query_failed" });
  }
}
