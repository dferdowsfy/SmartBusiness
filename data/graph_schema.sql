-- ============================================================================
-- SmartPR Execution-History & Capture Schema (Supabase / Postgres)
--
-- Supabase stores ONLY execution history + capture data. The JSON knowledge
-- base remains the single source of truth for municipalities, industries,
-- business types, questions, rules, and documents. Nothing here feeds back
-- into requirement generation — the rules engine stays authoritative.
--
-- Tables:
--   submissions            one row per completed intake
--   question_responses     the answers given for a submission
--   requirements_generated the documents the engine produced for a submission
--   document_validations   per-document validation outcomes
--   readiness_scores       readiness score history per submission
--   scenario_patterns      frequency of recurring scenario combinations
-- ============================================================================

CREATE TABLE IF NOT EXISTS submissions (
  id                 UUID PRIMARY KEY,        -- client-generated correlation id
  municipality       TEXT,
  industry           TEXT,
  business_type      TEXT,
  business_structure TEXT,
  location_type      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submissions_bt   ON submissions (business_type);
CREATE INDEX IF NOT EXISTS idx_submissions_muni ON submissions (municipality);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions (created_at);

CREATE TABLE IF NOT EXISTS question_responses (
  id            BIGSERIAL PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  question_id   TEXT NOT NULL,
  question_text TEXT,
  answer        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qr_submission ON question_responses (submission_id);
CREATE INDEX IF NOT EXISTS idx_qr_question   ON question_responses (question_id);

CREATE TABLE IF NOT EXISTS requirements_generated (
  id            BIGSERIAL PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  document_id   TEXT,
  document_name TEXT NOT NULL,
  agency        TEXT,
  reason        TEXT,
  source_rule   TEXT,
  mandatory     BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rg_submission ON requirements_generated (submission_id);
CREATE INDEX IF NOT EXISTS idx_rg_document   ON requirements_generated (document_name);

CREATE TABLE IF NOT EXISTS document_validations (
  id                BIGSERIAL PRIMARY KEY,
  submission_id     UUID REFERENCES submissions(id) ON DELETE CASCADE,
  business_type     TEXT,
  document_type     TEXT NOT NULL,
  validation_result TEXT,                      -- PASS | NEEDS_REVIEW | FAIL
  pass_fail         BOOLEAN,
  confidence        NUMERIC(5,2),              -- 0..100
  expiration_status TEXT,                      -- Valid | Expired | Unknown
  extracted_fields  JSONB,                     -- all candidate fields extracted
  fields_found      JSONB,                     -- labels of fields present
  fields_missing    JSONB,                     -- labels of required fields absent
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docval_doc    ON document_validations (document_type);
CREATE INDEX IF NOT EXISTS idx_docval_result ON document_validations (validation_result);

CREATE TABLE IF NOT EXISTS readiness_scores (
  id            BIGSERIAL PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  business_type TEXT,
  score         INTEGER,
  status        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_readiness_submission ON readiness_scores (submission_id);

CREATE TABLE IF NOT EXISTS scenario_patterns (
  id                BIGSERIAL PRIMARY KEY,
  municipality      TEXT,
  business_type     TEXT,
  question_hash     TEXT NOT NULL,
  requirements_hash TEXT NOT NULL,
  sample_answers    JSONB NOT NULL DEFAULT '{}'::jsonb,
  sample_documents  JSONB NOT NULL DEFAULT '[]'::jsonb,
  occurrence_count  BIGINT NOT NULL DEFAULT 1,
  first_seen        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (municipality, business_type, question_hash, requirements_hash)
);
CREATE INDEX IF NOT EXISTS idx_scenario_count ON scenario_patterns (occurrence_count DESC);

-- ---------------------------------------------------------------------------
-- Phase 3: Submission History & Intelligence views
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_submission_history AS
  SELECT s.id, s.created_at, s.municipality, s.industry, s.business_type,
         s.business_structure, s.location_type,
         rs.score AS readiness_score, rs.status AS readiness_status,
         (SELECT COUNT(*) FROM requirements_generated rg WHERE rg.submission_id = s.id) AS document_count
  FROM submissions s
  LEFT JOIN LATERAL (SELECT score, status FROM readiness_scores r WHERE r.submission_id = s.id
                     ORDER BY created_at DESC LIMIT 1) rs ON true
  ORDER BY s.created_at DESC;

CREATE OR REPLACE VIEW v_submission_timeline AS
  SELECT submission_id, 'Submission Created' AS event, 'created' AS kind, created_at FROM submissions
  UNION ALL SELECT submission_id, 'Document Uploaded: ' || document_type, 'document', created_at FROM document_validations
  UNION ALL SELECT submission_id, 'Readiness Updated: ' || score || '%', 'readiness', created_at FROM readiness_scores;

CREATE OR REPLACE VIEW v_readiness_progression AS
  SELECT submission_id, score, status, created_at,
         ROW_NUMBER() OVER (PARTITION BY submission_id ORDER BY created_at) AS seq
  FROM readiness_scores;

CREATE OR REPLACE VIEW v_document_history AS
  SELECT dv.submission_id, dv.document_type, dv.validation_result, dv.pass_fail, dv.confidence,
         dv.expiration_status, dv.extracted_fields, dv.fields_found, dv.fields_missing, dv.created_at,
         s.business_type
  FROM document_validations dv JOIN submissions s ON s.id = dv.submission_id;

CREATE OR REPLACE VIEW v_submission_comparison AS
  SELECT s.id, s.municipality, s.industry, s.business_type, s.business_structure, s.location_type,
         rs.score AS readiness_score,
         (SELECT COUNT(*) FROM requirements_generated rg WHERE rg.submission_id = s.id) AS document_count,
         (SELECT array_agg(rg.document_name ORDER BY rg.document_name)
            FROM requirements_generated rg WHERE rg.submission_id = s.id) AS documents
  FROM submissions s
  LEFT JOIN LATERAL (SELECT score FROM readiness_scores r WHERE r.submission_id = s.id
                     ORDER BY created_at DESC LIMIT 1) rs ON true;
