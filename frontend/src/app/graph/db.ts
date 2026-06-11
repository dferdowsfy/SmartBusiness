// ============================================================================
// Postgres connection for the knowledge-graph capture layer.
//
// Storage is OPTIONAL: if DATABASE_URL is not set, isEnabled() returns false
// and every capture call becomes a safe no-op. This lets the app run (and the
// rules engine stay authoritative) with or without a database — capture simply
// turns on the moment a DATABASE_URL exists.
// ============================================================================

import { Pool } from "pg";

let pool: Pool | null = null;

export function isEnabled(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getPool(): Pool | null {
  if (!isEnabled()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Hosted Postgres (Supabase/Neon) typically requires SSL.
      ssl: process.env.PGSSL_DISABLE ? undefined : { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    });
    pool.on("error", (err) => {
      // Never let a pool error crash the server; capture is best-effort.
      console.error("[graph] pool error:", err.message);
    });
  }
  return pool;
}

export async function query<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
  const p = getPool();
  if (!p) return [];
  const res = await p.query(text, params);
  return res.rows as T[];
}
