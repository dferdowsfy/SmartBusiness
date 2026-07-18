// Append-only audit trail helpers (SERVER ONLY).
import type { PoolClient } from "pg";
import { getPool } from "../graph/db";
import type { AuditEventRow } from "./types";

export interface AuditSpec {
  actor?: string | null;
  action: string;
  entityKind?: string | null;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  batchId?: string | null;
  proposalId?: string | null;
}

const params = (a: AuditSpec) => [
  a.actor ?? null,
  a.action,
  a.entityKind ?? null,
  a.entityId ?? null,
  a.before === undefined ? null : JSON.stringify(a.before),
  a.after === undefined ? null : JSON.stringify(a.after),
  a.batchId ?? null,
  a.proposalId ?? null,
];

const SQL = `INSERT INTO rk_audit_events
  (actor, action, entity_kind, entity_id, before_json, after_json, batch_id, proposal_id)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`;

export async function writeAudit(a: AuditSpec): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(SQL, params(a));
  } catch (err) {
    console.error("[rk/audit]", (err as Error).message);
  }
}

/** Same, but inside an existing transaction (throws on failure). */
export async function writeAuditTx(client: PoolClient, a: AuditSpec): Promise<void> {
  await client.query(SQL, params(a));
}

export async function listAudit(opts: { entityId?: string; batchId?: string; limit?: number } = {}): Promise<AuditEventRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const where: string[] = [];
  const vals: unknown[] = [];
  if (opts.entityId) {
    vals.push(opts.entityId);
    where.push(`entity_id = $${vals.length}`);
  }
  if (opts.batchId) {
    vals.push(opts.batchId);
    where.push(`batch_id = $${vals.length}`);
  }
  vals.push(Math.min(Math.max(opts.limit ?? 200, 1), 500));
  const sql = `SELECT * FROM rk_audit_events
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY created_at DESC LIMIT $${vals.length}`;
  return (await pool.query(sql, vals)).rows as AuditEventRow[];
}
