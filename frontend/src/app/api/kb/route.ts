// Public: serve the ACTIVE published knowledge-base snapshot.
//
// The live intake fetches this on mount and swaps it into the client KB;
// when there is no database or no published snapshot yet, it returns
// { source: "static" } and the app keeps the bundled KB — today's behavior.
// Only explicitly published snapshots are ever served (never a live compile).
import { getPool, isEnabled } from "../../graph/db";
import { ensureRkSchema } from "../../rk/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (!isEnabled()) return Response.json({ source: "static", reason: "no_database" }, { headers });
  try {
    await ensureRkSchema();
    const pool = getPool()!;
    const row = (
      await pool.query(`SELECT version, kb_json FROM rk_kb_snapshots WHERE is_active LIMIT 1`)
    ).rows[0] as { version: number; kb_json: unknown } | undefined;
    if (!row) return Response.json({ source: "static", reason: "no_published_snapshot" }, { headers });
    return Response.json({ source: "snapshot", version: row.version, kb: row.kb_json }, { headers });
  } catch (err) {
    console.error("[api/kb]", (err as Error).message);
    return Response.json({ source: "static", reason: "error" }, { headers });
  }
}
