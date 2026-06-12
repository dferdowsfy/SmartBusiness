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
  if (!user) return Response.json({ error: "Not signed in. Please sign in and try again." }, { status: 401 });
  if (!isEnabled()) {
    return Response.json({ error: "DATABASE_URL is not configured on the server." }, { status: 503 });
  }
  const pool = getPool();
  if (!pool) return Response.json({ error: "Could not connect to the database." }, { status: 503 });

  let body: { name?: string; notes?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const name = (body.name || "").trim();
  if (!name) return Response.json({ error: "Business name is required." }, { status: 400 });

  // Bootstrap schema (idempotent). Surface any failure so the UI can show it.
  try {
    await ensureSchema();
  } catch (err) {
    console.error("[businesses] schema bootstrap failed:", (err as Error).message);
    return Response.json({ error: "Database schema setup failed: " + (err as Error).message }, { status: 500 });
  }

  try {
    const id = randomUUID();
    // Also persist the user mirror so dashboards always have a row, even if
    // the user hits this endpoint before triggering any other capture.
    await pool.query(
      `INSERT INTO users (id, email, name, last_login) VALUES ($1,$2,$3, now())
       ON CONFLICT (id) DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email), last_login = now()`,
      [user.id, user.email ?? null, (user.user_metadata?.full_name as string) || null]
    ).catch((e) => console.error("[businesses] user upsert (non-fatal):", (e as Error).message));

    await pool.query(
      `INSERT INTO businesses (id, user_id, name, notes) VALUES ($1,$2,$3,$4)`,
      [id, user.id, name, body.notes ?? null]
    );
    return Response.json({ id, name, notes: body.notes ?? null });
  } catch (err) {
    const msg = (err as Error).message || "Unknown database error";
    console.error("[businesses] create failed:", msg);
    return Response.json({ error: "Could not save business: " + msg }, { status: 500 });
  }
}
