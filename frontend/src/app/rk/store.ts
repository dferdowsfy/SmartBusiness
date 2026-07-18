// ============================================================================
// Regulatory Knowledge Graph — data access (SERVER ONLY, imports pg).
//
// Modes:
//   live     = active node rows only (what production users get).
//   draft    = live + open proposals NOT tied to unenacted bills ("Draft
//              Changes" working state).
//   proposed = live + open proposals derived from unenacted sources (the
//              "Proposed Future State" / bill-preview layer).
//
// Edges shown in the graph are derived in-memory from the SHOWN node data via
// the registry (so proposal overlays render consistent relationships); the
// rk_edges table is the SQL-queryable projection maintained on every write.
// ============================================================================

import { getPool } from "../graph/db";
import { ensureRkSchema } from "./schema";
import { seedRkGraphIfEmpty } from "./seed";
import { NODE_TYPE_CONFIGS } from "./registry";
import {
  ENACTED_STATUSES,
  type ChangeProposalRow,
  type GraphEdgeDTO,
  type GraphMode,
  type GraphNodeDTO,
  type GraphResponse,
  type LegalStatus,
  type NodeStatus,
  type NodeType,
  type RkEdgeRow,
  type RkNodeRow,
} from "./types";

export const OPEN_PROPOSAL_STATUSES = [
  "draft",
  "ai_extracted",
  "under_review",
  "legal_review",
  "accepted",
];

/** Schema + seed, lazily, once per process (both are individually cached). */
export async function ensureRkReady(): Promise<void> {
  await ensureRkSchema();
  await seedRkGraphIfEmpty();
}

export function isBillLayer(sourceId: string | null, legalStatus: LegalStatus | null | undefined): boolean {
  if (!sourceId) return false;
  return !legalStatus || !ENACTED_STATUSES.includes(legalStatus);
}

interface ProposalWithStatus extends ChangeProposalRow {
  source_legal_status: LegalStatus | null;
}

export async function getGraph(
  mode: GraphMode,
  opts: { types?: NodeType[]; q?: string } = {}
): Promise<GraphResponse> {
  const pool = getPool();
  if (!pool) return { enabled: false, mode, nodes: [], edges: [], counts: {} };
  await ensureRkReady();

  const active = (
    await pool.query(
      `SELECT id, entity_id, node_type, label, data, status, version, source_id
         FROM rk_nodes WHERE status = 'active'`
    )
  ).rows as Pick<RkNodeRow, "id" | "entity_id" | "node_type" | "label" | "data" | "status" | "version" | "source_id">[];

  const shown = new Map<string, GraphNodeDTO>();
  for (const r of active) {
    shown.set(r.entity_id, {
      rowId: r.id,
      entityId: r.entity_id,
      nodeType: r.node_type,
      label: r.label,
      status: r.status,
      version: r.version,
      data: r.data,
      sourceId: r.source_id,
    });
  }

  if (mode !== "live") {
    const proposals = (
      await pool.query(
        `SELECT p.*, s.legal_status AS source_legal_status
           FROM rk_change_proposals p
           LEFT JOIN rk_regulatory_sources s ON s.id = p.source_id
          WHERE p.status = ANY($1)
          ORDER BY p.updated_at ASC`,
        [OPEN_PROPOSAL_STATUSES]
      )
    ).rows as ProposalWithStatus[];

    for (const p of proposals) {
      const bill = isBillLayer(p.source_id, p.source_legal_status);
      if (mode === "draft" && bill) continue;
      if (mode === "proposed" && !bill) continue;

      const data = (p.reviewed_json ?? p.proposed_json ?? {}) as Record<string, unknown>;
      if (p.change_kind === "archive_node") {
        const existing = shown.get(p.entity_id);
        if (existing) {
          existing.status = "archived" as NodeStatus;
          existing.overlaid = true;
          existing.proposalId = p.id;
        }
        continue;
      }
      const base = shown.get(p.entity_id);
      shown.set(p.entity_id, {
        rowId: base?.rowId ?? null,
        entityId: p.entity_id,
        nodeType: p.node_type,
        label: NODE_TYPE_CONFIGS[p.node_type]?.labelOf(data) || p.entity_id,
        status: "proposed",
        version: base ? base.version : 0,
        data,
        sourceId: p.source_id,
        overlaid: true,
        proposalId: p.id,
      });
    }
  }

  // Counts reflect the full (unfiltered) shown graph.
  const counts: Record<string, number> = {};
  for (const n of shown.values()) counts[n.nodeType] = (counts[n.nodeType] ?? 0) + 1;

  // Apply filters.
  let nodes = [...shown.values()];
  if (opts.types && opts.types.length > 0) {
    const set = new Set(opts.types);
    nodes = nodes.filter((n) => set.has(n.nodeType));
  }
  if (opts.q && opts.q.trim()) {
    const q = opts.q.trim().toLowerCase();
    nodes = nodes.filter(
      (n) => n.label.toLowerCase().includes(q) || n.entityId.toLowerCase().includes(q)
    );
  }

  // Derive edges from the shown data so overlays stay consistent.
  const present = new Set(nodes.map((n) => n.entityId));
  const edges: GraphEdgeDTO[] = [];
  for (const n of nodes) {
    if (n.status === "archived") continue;
    const cfg = NODE_TYPE_CONFIGS[n.nodeType];
    if (!cfg) continue;
    for (const e of cfg.edgesOf(n.data)) {
      if (present.has(e.toEntity)) {
        edges.push({ fromEntity: n.entityId, toEntity: e.toEntity, edgeType: e.edgeType });
      }
    }
  }

  nodes.sort((a, b) => a.entityId.localeCompare(b.entityId));
  return { enabled: true, mode, nodes, edges, counts };
}

// ---------------------------------------------------------------------------
// Node detail
// ---------------------------------------------------------------------------

export interface NodeDetail {
  node: RkNodeRow | null;
  versions: RkNodeRow[];
  edgesOut: RkEdgeRow[];
  edgesIn: (RkEdgeRow & { from_label: string; from_node_type: NodeType })[];
  proposals: ChangeProposalRow[];
  source: { id: string; title: string; legal_status: LegalStatus; citation: string | null } | null;
}

export async function getNodeDetail(entityId: string): Promise<NodeDetail | null> {
  const pool = getPool();
  if (!pool) return null;
  await ensureRkReady();

  const versions = (
    await pool.query(`SELECT * FROM rk_nodes WHERE entity_id = $1 ORDER BY version DESC`, [entityId])
  ).rows as RkNodeRow[];
  if (versions.length === 0) return null;
  const node = versions.find((v) => v.status === "active") ?? versions[0];

  const [edgesOut, edgesIn, proposals, source] = await Promise.all([
    pool
      .query(`SELECT * FROM rk_edges WHERE from_node_id = $1 ORDER BY edge_type, to_entity`, [node.id])
      .then((r) => r.rows as RkEdgeRow[]),
    pool
      .query(
        `SELECT e.*, n.label AS from_label, n.node_type AS from_node_type
           FROM rk_edges e JOIN rk_nodes n ON n.id = e.from_node_id
          WHERE e.to_entity = $1 AND n.status = 'active'
          ORDER BY e.edge_type, e.from_entity`,
        [entityId]
      )
      .then((r) => r.rows as (RkEdgeRow & { from_label: string; from_node_type: NodeType })[]),
    pool
      .query(
        `SELECT p.*, s.title AS source_title, s.legal_status AS source_legal_status
           FROM rk_change_proposals p
           LEFT JOIN rk_regulatory_sources s ON s.id = p.source_id
          WHERE p.entity_id = $1
          ORDER BY p.created_at DESC LIMIT 25`,
        [entityId]
      )
      .then((r) => r.rows as ChangeProposalRow[]),
    node.source_id
      ? pool
          .query(
            `SELECT id, title, legal_status, citation FROM rk_regulatory_sources WHERE id = $1`,
            [node.source_id]
          )
          .then((r) => (r.rows[0] as NodeDetail["source"]) ?? null)
      : Promise.resolve(null),
  ]);

  return { node, versions, edgesOut, edgesIn, proposals, source };
}

// Re-export the low-level writer for callers that already import the store.
export { insertNodeVersionTx, recomputeEdgesTx, type NodeVersionSpec } from "./node-write";

/** Active node rows in compile shape. */
export async function activeCompileNodes(): Promise<
  { entityId: string; nodeType: NodeType; data: Record<string, unknown> }[]
> {
  const pool = getPool();
  if (!pool) return [];
  const rows = (
    await pool.query(`SELECT entity_id, node_type, data FROM rk_nodes WHERE status = 'active'`)
  ).rows as { entity_id: string; node_type: NodeType; data: Record<string, unknown> }[];
  return rows.map((r) => ({ entityId: r.entity_id, nodeType: r.node_type, data: r.data }));
}
