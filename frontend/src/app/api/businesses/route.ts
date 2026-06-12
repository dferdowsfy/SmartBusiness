// List + create the signed-in user's businesses.

import { randomUUID } from "crypto";
import { getPool, isEnabled } from "../../graph/db";
import { ensureSchema } from "../../graph/store";
import { getCurrentUser } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ businesses: [] });
  const pool = getPool();
  if (!pool) return Response.json({ businesses: [] });
  await ensureSchema();
  try {
    // Each business is enriched with the latest readiness score across its
    // submissions, plus a count of submissions, so the listing reads at a glance.
    const { rows } = await pool.query(
      `SELECT b.id, b.name, b.notes, b.created_at, b.archived,
              (SELECT COUNT(*) FROM submissions s WHERE s.business_id = b.id) AS submission_count,
              (SELECT s.id FROM submissions s WHERE s.business_id = b.id
                 ORDER BY s.created_at DESC LIMIT 1) AS latest_submission_id,
              (SELECT rs.score FROM readiness_scores rs
                 JOIN submissions s ON s.id = rs.submission_id
                 WHERE s.business_id = b.id
                 ORDER BY rs.created_at DESC LIMIT 1) AS readiness_score
       FROM businesses b WHERE b.user_id = $1 AND b.archived = false
       ORDER BY b.created_at DESC`,
      [user.id]
    );
    return Response.json({ businesses: rows });
  } catch (err) {
    console.error("[businesses] list failed:", (err as Error).message);
    return Response.json({ businesses: [], error: "query_failed" });
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });
  const pool = getPool();
  if (!pool) return Response.json({ error: "no_database" }, { status: 503 });

  let body: { name?: string; notes?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "bad_json" }, { status: 400 }); }
  const name = (body.name || "").trim();
  if (!name) return Response.json({ error: "name_required" }, { status: 400 });
  await ensureSchema();

  try {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO businesses (id, user_id, name, notes) VALUES ($1,$2,$3,$4)`,
      [id, user.id, name, body.notes ?? null]
    );
    return Response.json({ id, name, notes: body.notes ?? null });
  } catch (err) {
    console.error("[businesses] create failed:", (err as Error).message);
    return Response.json({ error: "create_failed" }, { status: 500 });
  }
}
