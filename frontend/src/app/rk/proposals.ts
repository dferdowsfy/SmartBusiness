// ============================================================================
// Change proposals (SERVER ONLY).
//
// EVERY graph change — manual edit or AI extraction — becomes a proposal row.
// Nothing touches active nodes here: proposals only go live when a publication
// batch containing them is approved and published (batches.ts).
// ============================================================================

import { getPool } from "../graph/db";
import { labelForNode, validateNodeData } from "./registry";
import { ensureRkReady } from "./store";
import { writeAudit } from "./audit";
import type {
  ChangeKind,
  ChangeProposalRow,
  NodeType,
  ProposalClassification,
  ProposalStatus,
  RkNodeRow,
} from "./types";

const DEFAULT_CLASSIFICATION: Record<ChangeKind, ProposalClassification> = {
  create_node: "new_requirement",
  update_node: "modified_requirement",
  archive_node: "removed_requirement",
};

export interface CreateProposalInput {
  origin: "manual" | "ai_extraction";
  changeKind: ChangeKind;
  nodeType: NodeType;
  /** required for update/archive; generated for create when omitted */
  entityId?: string;
  /** proposed node data (canonical shape); ignored for archive */
  data?: Record<string, unknown>;
  classification?: ProposalClassification;
  confidence?: number | null;
  aiExplanation?: string | null;
  citationSection?: string | null;
  sourceId?: string | null;
  extractionRunId?: string | null;
  note?: string | null;
  actor?: string | null;
  /** initial status; manual edits go straight to under_review */
  status?: ProposalStatus;
}

export async function createProposal(input: CreateProposalInput): Promise<{ ok: boolean; proposal?: ChangeProposalRow; message?: string }> {
  const pool = getPool();
  if (!pool) return { ok: false, message: "no_database" };
  await ensureRkReady();

  let entityId = input.entityId?.trim() || "";
  let baseRow: RkNodeRow | null = null;

  // Manual proposals must be structurally valid up front; AI extractions may
  // be incomplete (they're re-validated at accept time in the review screen).
  const strict = input.origin === "manual";

  if (input.changeKind === "create_node") {
    if (!input.data) return { ok: false, message: "data is required for create_node" };
    const problems = strict ? validateNodeData(input.nodeType, input.data) : [];
    if (problems.length) return { ok: false, message: problems.join(" ") };
    if (!entityId) {
      entityId = String(input.data.id ?? "").trim();
    }
    if (!entityId) return { ok: false, message: "entity id is required" };
    const exists = await pool.query(`SELECT 1 FROM rk_nodes WHERE entity_id = $1 LIMIT 1`, [entityId]);
    if ((exists.rowCount ?? 0) > 0) {
      return { ok: false, message: `entity id ${entityId} already exists — use an update instead` };
    }
  } else {
    if (!entityId) return { ok: false, message: "entityId is required" };
    baseRow =
      ((
        await pool.query(`SELECT * FROM rk_nodes WHERE entity_id = $1 AND status = 'active' LIMIT 1`, [entityId])
      ).rows[0] as RkNodeRow | undefined) ?? null;
    if (!baseRow) return { ok: false, message: `no active node for ${entityId}` };
    if (input.changeKind === "update_node") {
      if (!input.data) return { ok: false, message: "data is required for update_node" };
      const problems = strict ? validateNodeData(input.nodeType, input.data) : [];
      if (problems.length) return { ok: false, message: problems.join(" ") };
    }
  }

  // The canonical data always carries its own id (kb-JSON convention).
  const proposedData = input.data ? { ...input.data, id: entityId } : null;

  const res = await pool.query(
    `INSERT INTO rk_change_proposals
       (origin, change_kind, node_type, entity_id, base_row_id, current_json, proposed_json,
        classification, confidence, ai_explanation, citation_section, source_id,
        extraction_run_id, status, created_by, review_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      input.origin,
      input.changeKind,
      input.nodeType,
      entityId,
      baseRow?.id ?? null,
      baseRow ? JSON.stringify(baseRow.data) : null,
      proposedData ? JSON.stringify(proposedData) : null,
      input.classification ?? DEFAULT_CLASSIFICATION[input.changeKind],
      input.confidence ?? (input.origin === "manual" ? 1 : null),
      input.aiExplanation ?? null,
      input.citationSection ?? null,
      input.sourceId ?? null,
      input.extractionRunId ?? null,
      input.status ?? (input.origin === "manual" ? "under_review" : "ai_extracted"),
      input.actor ?? null,
      input.note ?? null,
    ]
  );
  const proposal = res.rows[0] as ChangeProposalRow;

  await writeAudit({
    actor: input.actor,
    action: `proposal_created:${input.changeKind}`,
    entityKind: input.nodeType,
    entityId,
    before: baseRow?.data ?? null,
    after: proposedData,
    proposalId: proposal.id,
  });

  return { ok: true, proposal };
}

export async function listProposals(
  opts: { status?: string; sourceId?: string; nodeType?: string; entityId?: string } = {}
): Promise<ChangeProposalRow[]> {
  const pool = getPool();
  if (!pool) return [];
  await ensureRkReady();
  const where: string[] = [];
  const vals: unknown[] = [];
  const add = (clause: string, v: unknown) => {
    vals.push(v);
    where.push(clause.replace("?", `$${vals.length}`));
  };
  if (opts.status) add(`p.status = ?`, opts.status);
  if (opts.sourceId) add(`p.source_id = ?`, opts.sourceId);
  if (opts.nodeType) add(`p.node_type = ?`, opts.nodeType);
  if (opts.entityId) add(`p.entity_id = ?`, opts.entityId);
  const sql = `
    SELECT p.*, s.title AS source_title, s.legal_status AS source_legal_status
      FROM rk_change_proposals p
      LEFT JOIN rk_regulatory_sources s ON s.id = p.source_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY p.created_at DESC
     LIMIT 500`;
  return (await pool.query(sql, vals)).rows as ChangeProposalRow[];
}

/** Suggest a unique entity id for a new node (server-side check included). */
export async function uniqueEntityId(nodeType: NodeType, base: string): Promise<string> {
  const pool = getPool();
  if (!pool) return base;
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    const exists = await pool.query(`SELECT 1 FROM rk_nodes WHERE entity_id = $1 LIMIT 1`, [candidate]);
    const pending = await pool.query(
      `SELECT 1 FROM rk_change_proposals WHERE entity_id = $1 AND status NOT IN ('rejected','merged') LIMIT 1`,
      [candidate]
    );
    if ((exists.rowCount ?? 0) === 0 && (pending.rowCount ?? 0) === 0) return candidate;
    candidate = `${base}_${i}`;
  }
  return `${base}_${Date.now().toString(36).toUpperCase()}`;
}

export function proposalLabel(p: ChangeProposalRow): string {
  const data = (p.reviewed_json ?? p.proposed_json ?? p.current_json ?? {}) as Record<string, unknown>;
  return labelForNode(p.node_type, data) || p.entity_id;
}
