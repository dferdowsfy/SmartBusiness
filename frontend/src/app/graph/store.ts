// ============================================================================
// Execution-history capture store (server-side).
//
// Writes capture events into normalized Supabase tables (submissions,
// question_responses, requirements_generated, document_validations,
// readiness_scores, scenario_patterns). Everything is best-effort and never
// affects the user flow. The JSON rules engine remains the source of truth;
// nothing here feeds back into requirement generation.
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
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY, municipality TEXT, industry TEXT, business_type TEXT,
  location_type TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_submissions_bt ON submissions (business_type);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions (created_at);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS business_structure TEXT;
CREATE TABLE IF NOT EXISTS question_responses (
  id BIGSERIAL PRIMARY KEY, submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL, question_text TEXT, answer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_qr_submission ON question_responses (submission_id);
CREATE TABLE IF NOT EXISTS requirements_generated (
  id BIGSERIAL PRIMARY KEY, submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  document_id TEXT, document_name TEXT NOT NULL, agency TEXT, reason TEXT,
  source_rule TEXT, mandatory BOOLEAN, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_rg_submission ON requirements_generated (submission_id);
CREATE INDEX IF NOT EXISTS idx_rg_document ON requirements_generated (document_name);
CREATE TABLE IF NOT EXISTS document_validations (
  id BIGSERIAL PRIMARY KEY, submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  business_type TEXT, document_type TEXT NOT NULL, validation_result TEXT, pass_fail BOOLEAN,
  confidence NUMERIC(5,2), expiration_status TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_docval_result ON document_validations (validation_result);
ALTER TABLE document_validations ADD COLUMN IF NOT EXISTS extracted_fields JSONB;
ALTER TABLE document_validations ADD COLUMN IF NOT EXISTS fields_found JSONB;
ALTER TABLE document_validations ADD COLUMN IF NOT EXISTS fields_missing JSONB;
CREATE TABLE IF NOT EXISTS readiness_scores (
  id BIGSERIAL PRIMARY KEY, submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  business_type TEXT, score INTEGER, status TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_readiness_submission ON readiness_scores (submission_id);
CREATE TABLE IF NOT EXISTS scenario_patterns (
  id BIGSERIAL PRIMARY KEY, municipality TEXT, business_type TEXT,
  question_hash TEXT NOT NULL, requirements_hash TEXT NOT NULL,
  sample_answers JSONB NOT NULL DEFAULT '{}'::jsonb, sample_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  occurrence_count BIGINT NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(), last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (municipality, business_type, question_hash, requirements_hash));
CREATE INDEX IF NOT EXISTS idx_scenario_count ON scenario_patterns (occurrence_count DESC);

CREATE OR REPLACE VIEW v_submission_history AS
  SELECT s.id, s.created_at, s.municipality, s.industry, s.business_type,
         s.business_structure, s.location_type,
         rs.score AS readiness_score, rs.status AS readiness_status,
         (SELECT COUNT(*) FROM requirements_generated rg WHERE rg.submission_id = s.id) AS document_count
  FROM submissions s
  LEFT JOIN LATERAL (
    SELECT score, status FROM readiness_scores r WHERE r.submission_id = s.id
    ORDER BY created_at DESC LIMIT 1
  ) rs ON true
  ORDER BY s.created_at DESC;

CREATE OR REPLACE VIEW v_submission_timeline AS
  SELECT submission_id, 'Submission Created' AS event, 'created' AS kind, created_at FROM submissions
  UNION ALL
  SELECT submission_id, 'Document Uploaded: ' || document_type, 'document', created_at FROM document_validations
  UNION ALL
  SELECT submission_id, 'Readiness Updated: ' || score || '%', 'readiness', created_at FROM readiness_scores;

CREATE OR REPLACE VIEW v_readiness_progression AS
  SELECT submission_id, score, status, created_at,
         ROW_NUMBER() OVER (PARTITION BY submission_id ORDER BY created_at) AS seq
  FROM readiness_scores;

CREATE OR REPLACE VIEW v_document_history AS
  SELECT dv.submission_id, dv.document_type, dv.validation_result, dv.pass_fail,
         dv.confidence, dv.expiration_status, dv.extracted_fields, dv.fields_found,
         dv.fields_missing, dv.created_at, s.business_type
  FROM document_validations dv JOIN submissions s ON s.id = dv.submission_id;

CREATE OR REPLACE VIEW v_submission_comparison AS
  SELECT s.id, s.municipality, s.industry, s.business_type, s.business_structure, s.location_type,
         rs.score AS readiness_score,
         (SELECT COUNT(*) FROM requirements_generated rg WHERE rg.submission_id = s.id) AS document_count,
         (SELECT array_agg(rg.document_name ORDER BY rg.document_name)
            FROM requirements_generated rg WHERE rg.submission_id = s.id) AS documents
  FROM submissions s
  LEFT JOIN LATERAL (
    SELECT score FROM readiness_scores r WHERE r.submission_id = s.id
    ORDER BY created_at DESC LIMIT 1
  ) rs ON true;
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

// ---- event handlers -----------------------------------------------------

async function captureSubmission(c: PoolClient, e: SubmissionEvent): Promise<void> {
  // Header row (idempotent on re-capture of the same submission id).
  await c.query(
    `INSERT INTO submissions (id, municipality, industry, business_type, business_structure, location_type)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET
       municipality=EXCLUDED.municipality, industry=EXCLUDED.industry,
       business_type=EXCLUDED.business_type, business_structure=EXCLUDED.business_structure,
       location_type=EXCLUDED.location_type, updated_at=now()`,
    [e.submission_id, e.municipality ?? null, e.industry ?? null, e.business_type ?? null, e.business_structure ?? null, e.location_type ?? null]
  );

  // Replace child rows so a re-capture stays consistent (no duplicates).
  await c.query(`DELETE FROM question_responses WHERE submission_id=$1`, [e.submission_id]);
  await c.query(`DELETE FROM requirements_generated WHERE submission_id=$1`, [e.submission_id]);

  for (const a of e.answers) {
    await c.query(
      `INSERT INTO question_responses (submission_id, question_id, question_text, answer)
       VALUES ($1,$2,$3,$4)`,
      [e.submission_id, a.question_id, a.question, String(a.answer)]
    );
  }

  for (const r of e.requirements) {
    await c.query(
      `INSERT INTO requirements_generated
         (submission_id, document_id, document_name, agency, reason, source_rule, mandatory)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [e.submission_id, r.document_id ?? null, r.document, r.agency ?? null, r.reason ?? null, r.source_rule ?? null, r.mandatory ?? null]
    );
  }

  // Scenario-pattern frequency counter.
  const answerMap: Record<string, string | boolean> = {};
  for (const a of e.answers) answerMap[a.question_id] = a.answer;
  const docList = e.requirements.map((r) => r.document);
  const questionHash = hash(answerMap);
  const requirementsHash = hash([...docList].sort());

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
       (submission_id, business_type, document_type, validation_result, pass_fail,
        confidence, expiration_status, extracted_fields, fields_found, fields_missing)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      sub(e.submission_id), e.business_type ?? null, e.document_type, e.validation_result,
      e.pass_fail, e.confidence, e.expiration_status,
      e.extracted_fields ? JSON.stringify(e.extracted_fields) : null,
      e.fields_found ? JSON.stringify(e.fields_found) : null,
      e.fields_missing ? JSON.stringify(e.fields_missing) : null,
    ]
  );
}

async function captureReadiness(c: PoolClient, e: ReadinessEvent): Promise<void> {
  await c.query(
    `INSERT INTO readiness_scores (submission_id, business_type, score, status)
     VALUES ($1,$2,$3,$4)`,
    [sub(e.submission_id), e.business_type ?? null, e.score, e.status]
  );
}

// A validation/readiness event can arrive before its submission row exists
// (rare race). Treat a missing/empty id as null so the FK stays valid.
function sub(id: string | undefined): string | null {
  return id && id.length > 0 ? id : null;
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
