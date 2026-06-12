// Workflow snapshots — opaque JSON blob the user can save mid-flow and reload
// later. Save & Resume in its truest form.

import { getPool, isEnabled } from "../../../graph/db";
import { ensureSchema } from "../../../graph/store";
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
  await ensureSchema();
  try {
    const { rows } = await pool.query(
      `SELECT submission_id, state, updated_at, business_id
         FROM workflow_snapshots WHERE submission_id = $1 AND user_id = $2`,
      [id, user.id]
    );
    if (!rows[0]) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json(rows[0]);
  } catch (err) {
    console.error("[snapshots] load failed:", (err as Error).message);
    return Response.json({ error: "query_failed" }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });
  const pool = getPool();
  if (!pool) return Response.json({ error: "no_database" }, { status: 503 });
  let body: { state?: unknown; business_id?: string | null };
  try { body = await req.json(); } catch { return Response.json({ error: "bad_json" }, { status: 400 }); }
  try {
    await pool.query(
      `INSERT INTO workflow_snapshots (submission_id, user_id, business_id, state, updated_at)
       VALUES ($1,$2,$3,$4, now())
       ON CONFLICT (submission_id) DO UPDATE SET
         state = EXCLUDED.state, business_id = EXCLUDED.business_id, updated_at = now()`,
      [id, user.id, body.business_id ?? null, JSON.stringify(body.state ?? {})]
    );
    return Response.json({ saved: true });
  } catch (err) {
    console.error("[snapshots] save failed:", (err as Error).message);
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
}
