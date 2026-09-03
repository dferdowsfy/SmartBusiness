// Signed, ownership-checked download for an uploaded evidence document. The
// `evidence` Supabase Storage bucket is private and RLS-scoped to
// `auth.uid()` on the first path segment (see data/compliance_workspace_schema.sql);
// this route additionally never signs a URL for a row the requesting user
// does not own, so a guessed evidence id can't leak someone else's file.

import { getPool, isEnabled } from "../../../../graph/db";
import { createSupabaseServer, getCurrentUser } from "../../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });
  const pool = getPool();
  if (!pool) return Response.json({ error: "no_database" }, { status: 503 });

  const { rows } = await pool.query<{ storage_path: string | null; original_filename: string }>(
    `SELECT storage_path, original_filename FROM evidence WHERE id = $1 AND user_id = $2`,
    [id, user.id]
  );
  const row = rows[0];
  if (!row || !row.storage_path) return Response.json({ error: "not_found" }, { status: 404 });

  const supabase = await createSupabaseServer();
  if (!supabase) return Response.json({ error: "storage_unavailable" }, { status: 503 });
  const { data, error } = await supabase.storage.from("evidence").createSignedUrl(row.storage_path, 300);
  if (error || !data) {
    console.error("[evidence-download]", error?.message);
    return Response.json({ error: "sign_failed" }, { status: 503 });
  }
  return Response.json({ url: data.signedUrl, filename: row.original_filename });
}
