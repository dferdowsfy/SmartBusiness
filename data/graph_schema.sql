-- ============================================================================
-- SmartPR Knowledge Graph Capture Layer
--
-- OBSERVATIONAL ONLY. This schema records what happened during real business
-- scenarios. It NEVER modifies the rules engine and NEVER creates rules.
--
-- Design:
--   * graph_nodes / graph_edges  -> the property graph (typed nodes + relations)
--   * submissions                -> one row per processed scenario (event log)
--   * document_validations       -> per-uploaded-document validation outcomes
--   * scenario_patterns          -> frequency of (municipality + business type +
--                                   answers + requirements) combinations
--   * rejection_intelligence     -> recurring missing docs / validation failures
--
-- Every relationship and pattern carries an occurrence_count that increments
-- automatically, so the graph "learns" common patterns over time.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Property graph
-- ---------------------------------------------------------------------------

-- Node types: Municipality, Industry, BusinessType, Question, Answer, Rule,
-- Document, Submission, ValidationResult, ReadinessOutcome
CREATE TABLE IF NOT EXISTS graph_nodes (
  id               BIGSERIAL PRIMARY KEY,
  node_type        TEXT NOT NULL,
  natural_key      TEXT NOT NULL,           -- stable identity within a node_type
  label            TEXT NOT NULL,           -- human-readable display label
  props            JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurrence_count BIGINT NOT NULL DEFAULT 1,
  first_seen       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (node_type, natural_key)
);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON graph_nodes (node_type);

-- Relationship types: occurred_in, selected, answered, received, triggered,
-- requires, validated_as, produced, belongs_to
CREATE TABLE IF NOT EXISTS graph_edges (
  id               BIGSERIAL PRIMARY KEY,
  from_node        BIGINT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  to_node          BIGINT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  rel_type         TEXT NOT NULL,
  occurrence_count BIGINT NOT NULL DEFAULT 1,
  first_seen       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_node, to_node, rel_type)
);
CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON graph_edges (from_node, rel_type);
CREATE INDEX IF NOT EXISTS idx_graph_edges_to   ON graph_edges (to_node, rel_type);

-- ---------------------------------------------------------------------------
-- Event log: one row per processed scenario
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
  id                UUID PRIMARY KEY,        -- client-generated correlation id
  municipality      TEXT,
  industry          TEXT,
  business_type     TEXT,
  location_type     TEXT,
  answers           JSONB NOT NULL DEFAULT '{}'::jsonb,
  requirements      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{document, agency, reason}]
  agencies          JSONB NOT NULL DEFAULT '[]'::jsonb,
  readiness_score   INTEGER,
  readiness_status  TEXT,
  question_hash     TEXT,
  requirements_hash TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submissions_muni ON submissions (municipality);
CREATE INDEX IF NOT EXISTS idx_submissions_bt   ON submissions (business_type);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions (created_at);

-- ---------------------------------------------------------------------------
-- Document validation outcomes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_validations (
  id                BIGSERIAL PRIMARY KEY,
  submission_id     UUID REFERENCES submissions(id) ON DELETE CASCADE,
  business_type     TEXT,
  document_type     TEXT NOT NULL,
  validation_result TEXT,                    -- PASS | NEEDS_REVIEW | FAIL
  pass_fail         BOOLEAN,
  confidence        NUMERIC(5,2),            -- 0..100
  expiration_status TEXT,                    -- Valid | Expired | Unknown
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docval_doc ON document_validations (document_type);
CREATE INDEX IF NOT EXISTS idx_docval_result ON document_validations (validation_result);

-- ---------------------------------------------------------------------------
-- Scenario patterns: how often a full scenario combination appears
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scenario_patterns (
  id                BIGSERIAL PRIMARY KEY,
  municipality      TEXT,
  business_type     TEXT,
  question_hash     TEXT NOT NULL,           -- hash of the answer set
  requirements_hash TEXT NOT NULL,           -- hash of the resulting document set
  sample_answers    JSONB NOT NULL DEFAULT '{}'::jsonb,
  sample_documents  JSONB NOT NULL DEFAULT '[]'::jsonb,
  occurrence_count  BIGINT NOT NULL DEFAULT 1,
  first_seen        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (municipality, business_type, question_hash, requirements_hash)
);
CREATE INDEX IF NOT EXISTS idx_scenario_bt ON scenario_patterns (business_type);
CREATE INDEX IF NOT EXISTS idx_scenario_muni ON scenario_patterns (municipality);
CREATE INDEX IF NOT EXISTS idx_scenario_count ON scenario_patterns (occurrence_count DESC);

-- ---------------------------------------------------------------------------
-- Rejection intelligence: recurring problems (future compliance intelligence)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rejection_intelligence (
  id               BIGSERIAL PRIMARY KEY,
  business_type    TEXT,
  issue_type       TEXT NOT NULL,            -- MISSING_DOCUMENT | VALIDATION_FAILURE | EXPIRED
  detail           TEXT NOT NULL,            -- e.g. "Missing CFPM"
  occurrence_count BIGINT NOT NULL DEFAULT 1,
  first_seen       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_type, issue_type, detail)
);
CREATE INDEX IF NOT EXISTS idx_rejection_count ON rejection_intelligence (occurrence_count DESC);

-- ---------------------------------------------------------------------------
-- Common-pattern views
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_common_business_types AS
  SELECT business_type, COUNT(*) AS submissions
  FROM submissions WHERE business_type IS NOT NULL
  GROUP BY business_type ORDER BY submissions DESC;

CREATE OR REPLACE VIEW v_common_documents AS
  SELECT (d.value->>'document') AS document,
         (d.value->>'agency')   AS agency,
         COUNT(*)               AS times_required
  FROM submissions s, jsonb_array_elements(s.requirements) AS d(value)
  GROUP BY 1, 2 ORDER BY times_required DESC;

CREATE OR REPLACE VIEW v_common_validation_failures AS
  SELECT document_type, COUNT(*) AS failures
  FROM document_validations
  WHERE pass_fail = false
  GROUP BY document_type ORDER BY failures DESC;

CREATE OR REPLACE VIEW v_requirements_by_municipality AS
  SELECT municipality, COUNT(*) AS submissions,
         ROUND(AVG(jsonb_array_length(requirements)), 1) AS avg_documents
  FROM submissions WHERE municipality IS NOT NULL
  GROUP BY municipality ORDER BY avg_documents DESC;

CREATE OR REPLACE VIEW v_top_scenarios AS
  SELECT municipality, business_type, occurrence_count,
         sample_answers, sample_documents, last_seen
  FROM scenario_patterns ORDER BY occurrence_count DESC;
