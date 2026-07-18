// ============================================================================
// One-time graph seeding from the bundled KB JSON (SERVER ONLY).
//
// Runs lazily the first time any rk API touches the store: if rk_nodes is
// empty, imports every kb row as an ACTIVE v1 node (data verbatim) plus
// derived agency nodes and edges. Guarded by a pg advisory lock so concurrent
// serverless instances can't double-seed; a re-check inside the lock makes it
// idempotent.
// ============================================================================

import { getPool } from "../graph/db";
import { buildSeedNodes } from "./seed-data";
import { insertNodeVersionTx } from "./node-write";
import { ensureRkSchema } from "./schema";

const SEED_LOCK_KEY = 0x726b5eed; // arbitrary app-unique constant ("rk seed")

let seeded: Promise<void> | null = null;

export function seedRkGraphIfEmpty(): Promise<void> {
  const pool = getPool();
  if (!pool) return Promise.resolve();
  if (!seeded) {
    seeded = seedOnce().catch((err) => {
      seeded = null;
      throw err;
    });
  }
  return seeded;
}

async function seedOnce(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await ensureRkSchema();

  const count = Number(
    (await pool.query(`SELECT count(*)::int AS n FROM rk_nodes`)).rows[0]?.n ?? 0
  );
  if (count > 0) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock($1)`, [SEED_LOCK_KEY]);
    // Re-check inside the lock: another instance may have just seeded.
    const inLock = Number(
      (await client.query(`SELECT count(*)::int AS n FROM rk_nodes`)).rows[0]?.n ?? 0
    );
    if (inLock > 0) {
      await client.query("COMMIT");
      return;
    }

    const nodes = buildSeedNodes();
    for (const n of nodes) {
      await insertNodeVersionTx(client, {
        entityId: n.entityId,
        nodeType: n.nodeType,
        label: n.label,
        data: n.data,
        status: "active",
        version: 1,
        createdBy: "seed:bundled-kb",
      });
    }

    await client.query(
      `INSERT INTO rk_audit_events (actor, action, entity_kind, after_json)
       VALUES ($1, $2, $3, $4)`,
      [
        "system",
        "seed_graph",
        "graph",
        JSON.stringify({ nodes: nodes.length, source: "bundled kb json" }),
      ]
    );
    await client.query("COMMIT");
    console.log(`[rk] seeded regulatory graph with ${nodes.length} nodes from bundled KB`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
