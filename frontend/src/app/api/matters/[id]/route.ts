import { getPool } from "../../../graph/db";
import { ensureSchema } from "../../../graph/store";
import { getCurrentUser } from "../../../../lib/supabase/server";
import { MATTER_STATUSES, type MatterStatus } from "../../../compliance/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const pool = getPool();
  if (!pool) return Response.json({ error: "Database unavailable." }, { status: 503 });
  let body: { status?: MatterStatus; title?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (body.status && !MATTER_STATUSES.includes(body.status)) {
    return Response.json({ error: "Invalid matter status." }, { status: 400 });
  }
  await ensureSchema();
  const result = await pool.query(
    `UPDATE matters SET
       status = COALESCE($3, status), title = COALESCE(NULLIF($4,''), title),
       completed_at = CASE WHEN $3 = 'COMPLETED' THEN COALESCE(completed_at, now())
                           WHEN $3 IS NOT NULL THEN NULL ELSE completed_at END,
       updated_at = now()
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, user.id, body.status ?? null, body.title?.trim() ?? null]
  );
  if (!result.rows[0]) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ matter: result.rows[0] });
}
