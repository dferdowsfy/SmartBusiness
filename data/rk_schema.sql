-- ============================================================================
-- SmartPR Regulatory Knowledge Graph schema (rk_* tables).
--
-- REFERENCE COPY: the runtime source of truth is
-- frontend/src/app/rk/schema.ts (ensureRkSchema applies this idempotently on
-- first use). This file exists for manual psql import / review only.
-- ============================================================================

-- ============================================================
-- Regulatory sources (bills, laws, regulations, ordinances, guidance, forms)
-- ============================================================
CREATE TABLE IF NOT EXISTS rk_regulatory_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  source_type     TEXT NOT NULL DEFAULT 'other'
                    CHECK (source_type IN ('bill','law','regulation','ordinance','guidance','form','web','other')),
  legal_status    TEXT NOT NULL DEFAULT 'proposed'
                    CHECK (legal_status IN ('proposed','introduced','under_review','approved','signed',
                                            'effective','amended','repealed','superseded')),
  citation        TEXT,
  url             TEXT,
  jurisdiction    TEXT NOT NULL DEFAULT 'PR',
  raw_text        TEXT,
  checksum        TEXT,
  effective_date  DATE,
  sections_json   JSONB,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rk_sources_status ON rk_regulatory_sources (legal_status);
CREATE INDEX IF NOT EXISTS idx_rk_sources_type ON rk_regulatory_sources (source_type);

-- ============================================================
-- Versioned property-graph nodes. id = VERSION row; entity_id = logical id.
-- data (jsonb) is canonical; edges are derived projections of it.
-- ============================================================
CREATE TABLE IF NOT EXISTS rk_nodes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id          TEXT NOT NULL,
  node_type          TEXT NOT NULL
                       CHECK (node_type IN ('municipality','industry','business_type','business_activity',
                                            'intake_question','document','rule','agency','exemption',
                                            'renewal','inspection','evidence_type')),
  label              TEXT NOT NULL,
  data               JSONB NOT NULL DEFAULT '{}'::jsonb,
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','proposed','active','superseded','archived','rolled_back')),
  version            INTEGER NOT NULL DEFAULT 1,
  supersedes_row_id  UUID REFERENCES rk_nodes(id),
  source_id          UUID REFERENCES rk_regulatory_sources(id),
  citation_section   TEXT,
  valid_from         DATE,
  valid_to           DATE,
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rk_nodes_active ON rk_nodes (entity_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_rk_nodes_type_status ON rk_nodes (node_type, status);
CREATE INDEX IF NOT EXISTS idx_rk_nodes_entity ON rk_nodes (entity_id);

-- ============================================================
-- Derived edges. Owned by a specific node VERSION row (from_node_id) so
-- version supersession/rollback never needs edge surgery.
-- ============================================================
CREATE TABLE IF NOT EXISTS rk_edges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id  UUID NOT NULL REFERENCES rk_nodes(id) ON DELETE CASCADE,
  from_entity   TEXT NOT NULL,
  to_entity     TEXT NOT NULL,
  edge_type     TEXT NOT NULL
                  CHECK (edge_type IN ('requires','applies_to','asks','belongs_to','issued_by',
                                       'derived_from','exempts','renews','inspects','depends_on')),
  data          JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_rk_edges_from ON rk_edges (from_node_id);
CREATE INDEX IF NOT EXISTS idx_rk_edges_to ON rk_edges (to_entity);

-- ============================================================
-- Change proposals: EVERY graph change (manual or AI) flows through here.
-- Nothing becomes active except via an approved publication batch.
-- ============================================================
CREATE TABLE IF NOT EXISTS rk_change_proposals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin             TEXT NOT NULL CHECK (origin IN ('manual','ai_extraction')),
  change_kind        TEXT NOT NULL CHECK (change_kind IN ('create_node','update_node','archive_node')),
  node_type          TEXT NOT NULL,
  entity_id          TEXT NOT NULL,
  base_row_id        UUID REFERENCES rk_nodes(id),
  current_json       JSONB,
  proposed_json      JSONB,
  reviewed_json      JSONB,
  classification     TEXT
                       CHECK (classification IS NULL OR classification IN
                         ('new_requirement','modified_requirement','removed_requirement','new_exemption',
                          'changed_agency_responsibility','changed_form','changed_eligibility_rule',
                          'changed_deadline','no_action_required','needs_legal_review')),
  confidence         NUMERIC(4,3),
  ai_explanation     TEXT,
  citation_section   TEXT,
  source_id          UUID REFERENCES rk_regulatory_sources(id),
  extraction_run_id  UUID,
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','ai_extracted','under_review','legal_review','accepted',
                                         'rejected','deferred','merged','conflict','published')),
  merged_into_id     UUID REFERENCES rk_change_proposals(id),
  created_by         TEXT,
  reviewed_by        TEXT,
  reviewed_at        TIMESTAMPTZ,
  review_note        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rk_proposals_status ON rk_change_proposals (status);
CREATE INDEX IF NOT EXISTS idx_rk_proposals_source ON rk_change_proposals (source_id);
CREATE INDEX IF NOT EXISTS idx_rk_proposals_entity ON rk_change_proposals (entity_id);

-- ============================================================
-- Publication batches: the ONLY path by which accepted proposals go live.
-- Batch items record exact row pointers for deterministic rollback.
-- ============================================================
CREATE TABLE IF NOT EXISTS rk_publication_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','scheduled','published','rolled_back')),
  effective_at    TIMESTAMPTZ,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  published_by    TEXT,
  published_at    TIMESTAMPTZ,
  rolled_back_by  TEXT,
  rolled_back_at  TIMESTAMPTZ,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rk_batches_status ON rk_publication_batches (status);

CREATE TABLE IF NOT EXISTS rk_publication_batch_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id           UUID NOT NULL REFERENCES rk_publication_batches(id) ON DELETE CASCADE,
  proposal_id        UUID NOT NULL REFERENCES rk_change_proposals(id),
  superseded_row_id  UUID REFERENCES rk_nodes(id),
  new_row_id         UUID REFERENCES rk_nodes(id),
  before_json        JSONB,
  after_json         JSONB,
  UNIQUE (batch_id, proposal_id)
);
CREATE INDEX IF NOT EXISTS idx_rk_batch_items_batch ON rk_publication_batch_items (batch_id);

-- ============================================================
-- Compiled knowledge-base snapshots. Exactly one active; /api/kb serves it.
-- ============================================================
CREATE TABLE IF NOT EXISTS rk_kb_snapshots (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version              INTEGER NOT NULL,
  kb_json              JSONB NOT NULL,
  compiled_from_batch  UUID REFERENCES rk_publication_batches(id),
  is_active            BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rk_snapshot_active ON rk_kb_snapshots (is_active) WHERE is_active;

-- ============================================================
-- Append-only audit trail.
-- ============================================================
CREATE TABLE IF NOT EXISTS rk_audit_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor        TEXT,
  action       TEXT NOT NULL,
  entity_kind  TEXT,
  entity_id    TEXT,
  before_json  JSONB,
  after_json   JSONB,
  batch_id     UUID,
  proposal_id  UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rk_audit_created ON rk_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rk_audit_entity ON rk_audit_events (entity_kind, entity_id);
