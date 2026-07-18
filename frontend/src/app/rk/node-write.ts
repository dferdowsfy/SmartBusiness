// ============================================================================
// Low-level node-version writer + derived-edge maintenance (SERVER ONLY).
// Shared by seed.ts and batches.ts; kept separate from store.ts to avoid an
// import cycle (store -> seed -> writer).
// ============================================================================

import type { PoolClient } from "pg";
import { NODE_TYPE_CONFIGS } from "./registry";
import type { NodeStatus, NodeType } from "./types";

export interface NodeVersionSpec {
  entityId: string;
  nodeType: NodeType;
  label: string;
  data: Record<string, unknown>;
  status: NodeStatus;
  version: number;
  supersedesRowId?: string | null;
  sourceId?: string | null;
  citationSection?: string | null;
  validFrom?: string | null;
  createdBy?: string | null;
}

export async function insertNodeVersionTx(client: PoolClient, spec: NodeVersionSpec): Promise<string> {
  const res = await client.query(
    `INSERT INTO rk_nodes
       (entity_id, node_type, label, data, status, version, supersedes_row_id,
        source_id, citation_section, valid_from, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      spec.entityId,
      spec.nodeType,
      spec.label,
      JSON.stringify(spec.data),
      spec.status,
      spec.version,
      spec.supersedesRowId ?? null,
      spec.sourceId ?? null,
      spec.citationSection ?? null,
      spec.validFrom ?? null,
      spec.createdBy ?? null,
    ]
  );
  const rowId = res.rows[0].id as string;
  await recomputeEdgesTx(client, rowId, spec.entityId, spec.nodeType, spec.data);
  return rowId;
}

export async function recomputeEdgesTx(
  client: PoolClient,
  rowId: string,
  entityId: string,
  nodeType: NodeType,
  data: Record<string, unknown>
): Promise<void> {
  await client.query(`DELETE FROM rk_edges WHERE from_node_id = $1`, [rowId]);
  const cfg = NODE_TYPE_CONFIGS[nodeType];
  if (!cfg) return;
  const edges = cfg.edgesOf(data);
  if (edges.length === 0) return;
  const values: string[] = [];
  const params: unknown[] = [];
  edges.forEach((e, i) => {
    values.push(`($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`);
    params.push(rowId, entityId, e.toEntity, e.edgeType);
  });
  await client.query(
    `INSERT INTO rk_edges (from_node_id, from_entity, to_entity, edge_type) VALUES ${values.join(",")}`,
    params
  );
}
