// ============================================================================
// Impact analysis (SERVER ONLY): what changes if these proposals publish?
//
// Compiles TWO in-memory knowledge bases — current active graph vs active
// graph + selected proposals — diffs them, and runs the pure rules engine on
// a sample scenario (default: Restaurant · San Juan) to show the old result
// and the proposed new result side by side. Read-only: nothing is persisted.
// ============================================================================

import { getPool } from "../graph/db";
import { runRulesEngine, type EngineResult, type KnowledgeBase } from "../rulesEngine";
import { compileKb, type CompileNode } from "./compile";
import { NODE_TYPE_CONFIGS, labelForNode } from "./registry";
import { ensureRkReady } from "./store";
import type { ChangeProposalRow, CompiledKb, NodeType } from "./types";

export interface ImpactScenario {
  municipality: string;
  businessType: string;
  answers: Record<string, boolean | string>;
}

export interface DiffEntry {
  id: string;
  label: string;
}
export interface CollectionDiff {
  added: DiffEntry[];
  removed: DiffEntry[];
  changed: DiffEntry[];
}

export interface ImpactResult {
  ok: boolean;
  message?: string;
  proposalsConsidered?: number;
  diff?: Record<string, CollectionDiff>;
  affectedBusinessTypes?: string[];
  affectedMunicipalities?: string[];
  readinessChanges?: boolean;
  conflicts?: string[];
  invalidRefs?: string[];
  scenario?: { input: ImpactScenario; before: EngineResult; after: EngineResult };
}

const s = (v: unknown): string => (typeof v === "string" ? v : "");

export async function runImpact(input: {
  proposalIds?: string[];
  batchId?: string;
  scenario?: Partial<ImpactScenario>;
}): Promise<ImpactResult> {
  const pool = getPool();
  if (!pool) return { ok: false, message: "no_database" };
  await ensureRkReady();

  // -- Select the proposals to preview -------------------------------------
  let proposals: ChangeProposalRow[];
  if (input.batchId) {
    proposals = (
      await pool.query(
        `SELECT p.* FROM rk_change_proposals p
          JOIN rk_publication_batch_items i ON i.proposal_id = p.id
         WHERE i.batch_id = $1`,
        [input.batchId]
      )
    ).rows as ChangeProposalRow[];
  } else if (input.proposalIds?.length) {
    proposals = (
      await pool.query(`SELECT * FROM rk_change_proposals WHERE id = ANY($1)`, [input.proposalIds])
    ).rows as ChangeProposalRow[];
  } else {
    proposals = (
      await pool.query(`SELECT * FROM rk_change_proposals WHERE status = 'accepted'`)
    ).rows as ChangeProposalRow[];
  }

  // -- Build before/after node sets -----------------------------------------
  const activeRows = (
    await pool.query(`SELECT entity_id, node_type, data FROM rk_nodes WHERE status = 'active'`)
  ).rows as { entity_id: string; node_type: NodeType; data: Record<string, unknown> }[];
  const before = new Map<string, CompileNode>(
    activeRows.map((r) => [r.entity_id, { entityId: r.entity_id, nodeType: r.node_type, data: r.data }])
  );
  const after = new Map(before);

  const conflicts: string[] = [];
  const touched = new Set<string>();
  for (const p of proposals) {
    if (touched.has(p.entity_id)) conflicts.push(`multiple selected proposals target ${p.entity_id}`);
    touched.add(p.entity_id);
    const data = (p.reviewed_json ?? p.proposed_json) as Record<string, unknown> | null;
    if (p.change_kind === "archive_node") {
      after.delete(p.entity_id);
    } else if (data) {
      after.set(p.entity_id, { entityId: p.entity_id, nodeType: p.node_type, data });
    }
  }

  const kbBefore = compileKb([...before.values()], { version: 0, batchId: null });
  const kbAfter = compileKb([...after.values()], { version: 0, batchId: null });

  // -- Collection diffs ------------------------------------------------------
  const diff: Record<string, CollectionDiff> = {};
  const collections: (keyof Pick<CompiledKb, "municipalities" | "businessTypes" | "questions" | "documents" | "rules">)[] = [
    "municipalities", "businessTypes", "questions", "documents", "rules",
  ];
  const typeOf: Record<string, NodeType> = {
    municipalities: "municipality",
    businessTypes: "business_type",
    questions: "intake_question",
    documents: "document",
    rules: "rule",
  };
  for (const col of collections) {
    const a = new Map((kbBefore[col] as Record<string, unknown>[]).map((r) => [String(r.id), r]));
    const b = new Map((kbAfter[col] as Record<string, unknown>[]).map((r) => [String(r.id), r]));
    const entry: CollectionDiff = { added: [], removed: [], changed: [] };
    const lbl = (r: Record<string, unknown>) => labelForNode(typeOf[col], r);
    for (const [id, row] of b) {
      if (!a.has(id)) entry.added.push({ id, label: lbl(row) });
      else if (JSON.stringify(a.get(id)) !== JSON.stringify(row)) entry.changed.push({ id, label: lbl(row) });
    }
    for (const [id, row] of a) if (!b.has(id)) entry.removed.push({ id, label: lbl(row) });
    diff[col] = entry;
  }

  // -- Affected business types / municipalities (from touched rules) --------
  const btById = new Map((kbAfter.businessTypes as Record<string, unknown>[]).map((b) => [String(b.id), s(b.name)]));
  const affectedBts = new Set<string>();
  const affectedFlags = new Set<string>();
  const ruleTouched = [...diff.rules.added, ...diff.rules.changed, ...diff.rules.removed].map((e) => e.id);
  const allRules = new Map(
    [...(kbBefore.rules as Record<string, unknown>[]), ...(kbAfter.rules as Record<string, unknown>[])].map((r) => [String(r.id), r])
  );
  for (const id of ruleTouched) {
    const r = allRules.get(id);
    if (!r) continue;
    const bt = s(r.business_type_id);
    if (bt) affectedBts.add(btById.get(bt) ?? bt);
    else if (s(r.rule_type) === "municipality") affectedBts.add("All business types");
    const flag = s(r.municipality_flag);
    if (flag) affectedFlags.add(flag);
  }
  const affectedMunicipalities = new Set<string>(
    diff.municipalities.changed.concat(diff.municipalities.added, diff.municipalities.removed).map((e) => e.label)
  );
  if (affectedFlags.size > 0) {
    for (const m of kbAfter.municipalities as Record<string, unknown>[]) {
      const flags = Array.isArray(m.flags) ? (m.flags as string[]) : [];
      if (flags.some((f) => affectedFlags.has(f))) affectedMunicipalities.add(s(m.name));
    }
  }
  if (ruleTouched.some((id) => s(allRules.get(id)?.rule_type) === "municipality")) {
    affectedMunicipalities.add("All municipalities (baseline rule)");
  }

  // -- Readiness-scoring changes ---------------------------------------------
  const readinessChanges =
    JSON.stringify(kbBefore.docMeta.weights) !== JSON.stringify(kbAfter.docMeta.weights) ||
    JSON.stringify(kbBefore.docMeta.recommended) !== JSON.stringify(kbAfter.docMeta.recommended) ||
    diff.documents.added.length > 0 ||
    diff.documents.removed.length > 0 ||
    diff.rules.added.length > 0 ||
    diff.rules.removed.length > 0;

  // -- Relationship integrity in the AFTER graph ------------------------------
  const invalidRefs: string[] = [];
  const afterIds = new Set(after.keys());
  for (const n of after.values()) {
    const cfg = NODE_TYPE_CONFIGS[n.nodeType];
    if (!cfg) continue;
    for (const e of cfg.edgesOf(n.data)) {
      if (e.toEntity && !afterIds.has(e.toEntity)) {
        invalidRefs.push(`${n.entityId} → ${e.edgeType} → ${e.toEntity} (missing after publish)`);
      }
    }
  }

  // -- Sample scenario (test mode) --------------------------------------------
  const scenario: ImpactScenario = {
    municipality: input.scenario?.municipality || "San Juan",
    businessType: input.scenario?.businessType || "Restaurant",
    answers: input.scenario?.answers || {},
  };
  const engineInput = {
    municipalityName: scenario.municipality,
    businessTypeName: scenario.businessType,
    answers: scenario.answers,
  };
  const beforeRun = runRulesEngine(kbBefore as unknown as KnowledgeBase, engineInput);
  const afterRun = runRulesEngine(kbAfter as unknown as KnowledgeBase, engineInput);

  return {
    ok: true,
    proposalsConsidered: proposals.length,
    diff,
    affectedBusinessTypes: [...affectedBts].sort(),
    affectedMunicipalities: [...affectedMunicipalities].sort(),
    readinessChanges,
    conflicts,
    invalidRefs: invalidRefs.slice(0, 50),
    scenario: { input: scenario, before: beforeRun, after: afterRun },
  };
}
