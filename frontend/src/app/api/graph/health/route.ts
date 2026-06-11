// Knowledge-graph health check.
//
// Lets you confirm, in one request, that DATABASE_URL is set, the database is
// reachable, and the capture tables exist (with current row counts). Safe to
// call anytime — read-only, and returns a clear status when no DB is configured.

import { getPool, isEnabled } from "../../../graph/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLES = [
  "submissions",
  "question_responses",
  "requirements_generated",
  "document_validations",
  "readiness_scores",
  "scenario_patterns",
];

export async function GET() {
  if (!isEnabled()) {
    return Response.json({
      connected: false,
      configured: false,
      message: "DATABASE_URL is not set. Capture is a safe no-op until it is configured.",
    });
  }

  const pool = getPool();
  if (!pool) {
    return Response.json({ connected: false, configured: true, message: "Could not initialize the connection pool." }, { status: 500 });
  }

  try {
    const tables: Record<string, number | "missing"> = {};
    for (const t of TABLES) {
      try {
        // Identifier is from a fixed allow-list above, never user input.
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
        tables[t] = rows[0].n as number;
      } catch {
        tables[t] = "missing";
      }
    }
    const allPresent = TABLES.every((t) => tables[t] !== "missing");
    return Response.json({
      connected: true,
      configured: true,
      tablesReady: allPresent,
      message: allPresent
        ? "Connected. All capture tables exist."
        : "Connected. Tables will be created automatically on the first captured event.",
      tables,
    });
  } catch (err) {
    return Response.json(
      { connected: false, configured: true, message: "Connection failed: " + (err as Error).message },
      { status: 500 }
    );
  }
}
