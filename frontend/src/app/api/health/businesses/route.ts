// Diagnostic endpoint for the businesses flow. Reports: auth configured,
// user signed in, database reachable, compliance tables present, row count.
// Safe to call any time — read-only.

import { getPool, isEnabled } from "../../../graph/db";
import { ensureSchema } from "../../../graph/store";
import { getCurrentUser, isAuthConfigured } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, unknown> = {
    auth_configured: isAuthConfigured(),
    database_configured: isEnabled(),
  };

  let user;
  try { user = await getCurrentUser(); } catch (e) { out.auth_error = (e as Error).message; }
  out.signed_in = !!user;
  if (user) out.user_id = user.id;

  if (!isEnabled()) return Response.json(out);
  const pool = getPool();
  if (!pool) { out.pool = "missing"; return Response.json(out); }

  try {
    await ensureSchema();
    out.schema_ready = true;
  } catch (e) {
    out.schema_error = (e as Error).message;
    return Response.json(out);
  }

  try {
    const requiredTables = [
      "users",
      "workspaces",
      "workspace_members",
      "businesses",
      "matters",
      "obligations",
      "evidence",
      "notifications",
      "workflow_snapshots",
    ] as const;
    const tableCheck = await pool.query<{ table_name: string; present: boolean }>(
      `SELECT table_name, to_regclass('public.' || table_name) IS NOT NULL AS present
       FROM unnest($1::text[]) AS table_name`,
      [requiredTables]
    );
    out.compliance_tables = Object.fromEntries(
      tableCheck.rows.map(({ table_name, present }) => [table_name, present])
    );
    out.compliance_schema_ready = tableCheck.rows.every(({ present }) => present);

    const { rows } = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM businesses`);
    out.businesses_table = true;
    out.total_businesses = rows[0]?.n ?? 0;

    if (user) {
      const mine = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM businesses WHERE user_id = $1`, [user.id]);
      out.my_businesses = mine.rows[0]?.n ?? 0;
    }
  } catch (e) {
    out.query_error = (e as Error).message;
  }

  return Response.json(out);
}
