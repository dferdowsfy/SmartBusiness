// ============================================================================
// Knowledge-graph capture store (server-side).
//
// Translates capture events into property-graph nodes/edges + the aggregate
// tables (submissions, document_validations, scenario_patterns,
// rejection_intelligence). Everything is idempotent and best-effort.
//
// OBSERVATIONAL ONLY — nothing here influences requirement generation.
// ============================================================================

import { createHash } from "crypto";
import { getPool, isEnabled } from "./db";
import type {
  CaptureEvent,
  SubmissionEvent,
  ValidationEvent,
  ReadinessEvent,
} from "./types";
import type { PoolClient } from "pg";

// Mirror of data/graph_schema.sql, applied once per process (idempotent).
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS graph_nodes (
  id BIGSERIAL PRIMARY KEY, node_type TEXT NOT NULL, natural_key TEXT NOT NULL,
  label TEXT NOT NULL, props JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurrence_count BIGINT NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(), last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (node_type, natural_key));
CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON graph_nodes (node_type);
CREATE TABLE IF NOT EXISTS graph_edges (
  id BIGSERIAL PRIMARY KEY,
  from_node BIGINT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  to_node BIGINT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  rel_type TEXT NOT NULL, occurrence_count BIGINT NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(), last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_node, to_node, rel_type));
CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON graph_edges (from_node, rel_type);
CREATE INDEX IF NOT EXISTS idx_graph_edges_to ON graph_edges (to_node, rel_type);
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY, municipality TEXT, industry TEXT, business_type TEXT,
  location_type TEXT, answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb, agencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  readiness_score INTEGER, readiness_status TEXT, question_hash TEXT, requirements_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_submissions_bt ON submissions (business_type);
CREATE TABLE IF NOT EXISTS document_validations (
  id BIGSERIAL PRIMARY KEY, submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  business_type TEXT, document_type TEXT NOT NULL, validation_result TEXT, pass_fail BOOLEAN,
  confidence NUMERIC(5,2), expiration_status TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_docval_result ON document_validations (validation_result);
CREATE TABLE IF NOT EXISTS scenario_patterns (
  id BIGSERIAL PRIMARY KEY, municipality TEXT, business_type TEXT,
  question_hash TEXT NOT NULL, requirements_hash TEXT NOT NULL,
  sample_answers JSONB NOT NULL DEFAULT '{}'::jsonb, sample_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  occurrence_count BIGINT NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(), last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (municipality, business_type, question_hash, requirements_hash));
CREATE INDEX IF NOT EXISTS idx_scenario_count ON scenario_patterns (occurrence_count DESC);
CREATE TABLE IF NOT EXISTS rejection_intelligence (
  id BIGSERIAL PRIMARY KEY, business_type TEXT, issue_type TEXT NOT NULL, detail TEXT NOT NULL,
  occurrence_count BIGINT NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(), last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_type, issue_type, detail));
CREATE INDEX IF NOT EXISTS idx_rejection_count ON rejection_intelligence (occurrence_count DESC);
`;

let schemaReady: Promise<void> | null = null;
async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const pool = getPool();
    schemaReady = pool ? pool.query(SCHEMA_SQL).then(() => undefined) : Promise.resolve();
  }
  return schemaReady;
}

function hash(value: unknown): string {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

// ---- graph primitives ---------------------------------------------------

// Upsert a node by (type, natural_key); bumps occurrence_count + last_seen.
async function upsertNode(
  c: PoolClient,
  nodeType: string,
  naturalKey: string,
  label: string,
  props: Record<string, unknown> = {}
): Promise<number> {
  const { rows } = await c.query(
    `INSERT INTO graph_nodes (node_type, natural_key, label, props)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (node_type, natural_key) DO UPDATE
       SET occurrence_count = graph_nodes.occurrence_count + 1,
           last_seen = now(),
           label = EXCLUDED.label
     RETURNING id`,
    [nodeType, naturalKey, label, JSON.stringify(props)]
  );
  return rows[0].id as number;
}

// Upsert an edge; bumps occurrence_count + last_seen on repeat observations.
async function upsertEdge(c: PoolClient, from: number, to: number, rel: string): Promise<void> {
  await c.query(
    `INSERT INTO graph_edges (from_node, to_node, rel_type)
     VALUES ($1,$2,$3)
     ON CONFLICT (from_node, to_node, rel_type) DO UPDATE
       SET occurrence_count = graph_edges.occurrence_count + 1, last_seen = now()`,
    [from, to, rel]
  );
}

// ---- event handlers -----------------------------------------------------

async function captureSubmission(c: PoolClient, e: SubmissionEvent): Promise<void> {
  const answerMap: Record<string, string | boolean> = {};
  for (const a of e.answers) answerMap[a.question_id] = a.answer;
  const docList = e.requirements.map((r) => r.document);
  const agencies = [...new Set(e.requirements.map((r) => r.agency).filter(Boolean))];
  const questionHash = hash(answerMap);
  const requirementsHash = hash([...docList].sort());

  // Event-log row (insert or refresh the snapshot for this submission).
  await c.query(
    `INSERT INTO submissions
       (id, municipality, industry, business_type, location_type, answers,
        requirements, agencies, question_hash, requirements_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET
       municipality=EXCLUDED.municipality, industry=EXCLUDED.industry,
       business_type=EXCLUDED.business_type, location_type=EXCLUDED.location_type,
       answers=EXCLUDED.answers, requirements=EXCLUDED.requirements,
       agencies=EXCLUDED.agencies, question_hash=EXCLUDED.question_hash,
       requirements_hash=EXCLUDED.requirements_hash, updated_at=now()`,
    [
      e.submission_id, e.municipality ?? null, e.industry ?? null, e.business_type ?? null,
      e.location_type ?? null, JSON.stringify(answerMap),
      JSON.stringify(e.requirements.map((r) => ({ document: r.document, agency: r.agency, reason: r.reason }))),
      JSON.stringify(agencies), questionHash, requirementsHash,
    ]
  );

  // --- property graph ---
  const submissionNode = await upsertNode(c, "Submission", e.submission_id, `Submission ${e.submission_id.slice(0, 8)}`);

  let muniNode: number | null = null;
  if (e.municipality) {
    muniNode = await upsertNode(c, "Municipality", e.municipality, e.municipality);
    await upsertEdge(c, submissionNode, muniNode, "occurred_in");
  }
  let industryNode: number | null = null;
  if (e.industry) {
    industryNode = await upsertNode(c, "Industry", e.industry, e.industry);
  }
  if (e.business_type) {
    const btNode = await upsertNode(c, "BusinessType", e.business_type, e.business_type);
    await upsertEdge(c, submissionNode, btNode, "selected");
    if (industryNode) await upsertEdge(c, btNode, industryNode, "belongs_to");
  }

  // Questions + answers
  const answerNodeByQuestion: Record<string, number> = {};
  for (const a of e.answers) {
    const qNode = await upsertNode(c, "Question", a.question_id, a.question);
    await upsertEdge(c, submissionNode, qNode, "answered");
    const ansKey = `${a.question_id}=${a.answer}`;
    const aNode = await upsertNode(c, "Answer", ansKey, `${a.question} → ${a.answer}`, { question_id: a.question_id, answer: a.answer });
    await upsertEdge(c, qNode, aNode, "received");
    answerNodeByQuestion[a.question_id] = aNode;
  }

  // Rules + documents
  for (const r of e.requirements) {
    const docNode = await upsertNode(c, "Document", r.document_id || r.document, r.document, { agency: r.agency });
    await upsertEdge(c, submissionNode, docNode, "required");
    if (r.source_rule) {
      const ruleNode = await upsertNode(c, "Rule", r.source_rule, r.reason || r.source_rule);
      await upsertEdge(c, ruleNode, docNode, "requires");
      // Connect any answer that plausibly triggered this rule (best-effort:
      // all of this submission's "Yes" answers point at the triggered rules).
      for (const a of e.answers) {
        if (a.answer === true || a.answer === "Yes" || a.answer === "true") {
          const aNode = answerNodeByQuestion[a.question_id];
          if (aNode) await upsertEdge(c, aNode, ruleNode, "triggered");
        }
      }
    }
  }

  // Scenario-pattern frequency counter
  await c.query(
    `INSERT INTO scenario_patterns
       (municipality, business_type, question_hash, requirements_hash, sample_answers, sample_documents)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (municipality, business_type, question_hash, requirements_hash) DO UPDATE
       SET occurrence_count = scenario_patterns.occurrence_count + 1, last_seen = now()`,
    [
      e.municipality ?? "", e.business_type ?? "", questionHash, requirementsHash,
      JSON.stringify(answerMap), JSON.stringify(docList),
    ]
  );
}

async function captureValidation(c: PoolClient, e: ValidationEvent): Promise<void> {
  await c.query(
    `INSERT INTO document_validations
       (submission_id, business_type, document_type, validation_result, pass_fail, confidence, expiration_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [e.submission_id, e.business_type ?? null, e.document_type, e.validation_result, e.pass_fail, e.confidence, e.expiration_status]
  );

  const docNode = await upsertNode(c, "Document", e.document_type, e.document_type);
  const vrNode = await upsertNode(c, "ValidationResult", e.validation_result, e.validation_result);
  await upsertEdge(c, docNode, vrNode, "validated_as");

  // Rejection intelligence for failures / expirations.
  if (!e.pass_fail) {
    await bumpRejection(c, e.business_type ?? null, "VALIDATION_FAILURE", `${e.document_type} failed validation`);
  }
  if (e.expiration_status === "Expired") {
    await bumpRejection(c, e.business_type ?? null, "EXPIRED", `${e.document_type} expired`);
  }
}

async function captureReadiness(c: PoolClient, e: ReadinessEvent): Promise<void> {
  await c.query(
    `UPDATE submissions SET readiness_score=$2, readiness_status=$3, updated_at=now() WHERE id=$1`,
    [e.submission_id, e.score, e.status]
  );
  const subNode = await upsertNode(c, "Submission", e.submission_id, `Submission ${e.submission_id.slice(0, 8)}`);
  const band = e.score >= 90 ? "Ready (90-100)" : e.score >= 70 ? "Nearly Ready (70-89)" : e.score >= 40 ? "In Progress (40-69)" : "Early (0-39)";
  const outNode = await upsertNode(c, "ReadinessOutcome", band, band);
  await upsertEdge(c, subNode, outNode, "produced");

  for (const missing of e.missing_documents || []) {
    await bumpRejection(c, e.business_type ?? null, "MISSING_DOCUMENT", `Missing ${missing}`);
  }
}

async function bumpRejection(c: PoolClient, bt: string | null, issueType: string, detail: string): Promise<void> {
  await c.query(
    `INSERT INTO rejection_intelligence (business_type, issue_type, detail)
     VALUES ($1,$2,$3)
     ON CONFLICT (business_type, issue_type, detail) DO UPDATE
       SET occurrence_count = rejection_intelligence.occurrence_count + 1, last_seen = now()`,
    [bt ?? "", issueType, detail]
  );
}

// ---- public entry point -------------------------------------------------

export async function capture(event: CaptureEvent): Promise<{ ok: boolean; stored: boolean }> {
  if (!isEnabled()) return { ok: true, stored: false };
  const pool = getPool();
  if (!pool) return { ok: true, stored: false };
  await ensureSchema();
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    if (event.kind === "submission") await captureSubmission(c, event);
    else if (event.kind === "validation") await captureValidation(c, event);
    else if (event.kind === "readiness") await captureReadiness(c, event);
    await c.query("COMMIT");
    return { ok: true, stored: true };
  } catch (err) {
    await c.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}
