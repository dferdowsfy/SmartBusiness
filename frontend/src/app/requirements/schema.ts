// ============================================================================
// Idempotent schema bootstrap for the Requirement Monitoring & Fillable
// Documents system. Mirrors data/requirements_schema.sql and follows the same
// pattern as src/app/graph/store.ts: applied once per process, best-effort,
// safe no-op when DATABASE_URL is unset.
//
// Tables: requirement_rules, requirement_documents, form_templates,
//         user_form_instances, requirement_monitoring_runs,
//         requirement_change_events  (+ v_admin_review_queue).
// ============================================================================

import { getPool } from "../graph/db";

// Keep this in sync with data/requirements_schema.sql.
const REQUIREMENTS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS requirement_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID,
  jurisdiction_country  TEXT NOT NULL DEFAULT 'US',
  state_or_territory    TEXT,
  municipality          TEXT,
  county                TEXT,
  agency_name           TEXT,
  business_type         TEXT,
  activity_type         TEXT,
  entity_type           TEXT,
  requirement_category  TEXT,
  requirement_name      TEXT,
  description           TEXT,
  official_source_url   TEXT,
  source_domain         TEXT,
  confidence_score      NUMERIC(5,2),
  status                TEXT NOT NULL DEFAULT 'needs_review'
                          CHECK (status IN ('active','needs_review','deprecated','superseded')),
  effective_date        DATE,
  last_checked_at       TIMESTAMPTZ,
  last_changed_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reqrules_jurisdiction
  ON requirement_rules (state_or_territory, municipality, business_type);
CREATE INDEX IF NOT EXISTS idx_reqrules_activity ON requirement_rules (activity_type);
CREATE INDEX IF NOT EXISTS idx_reqrules_status   ON requirement_rules (status);
CREATE INDEX IF NOT EXISTS idx_reqrules_tenant   ON requirement_rules (tenant_id);
CREATE INDEX IF NOT EXISTS idx_reqrules_domain   ON requirement_rules (source_domain);

CREATE TABLE IF NOT EXISTS requirement_documents (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_rule_id       UUID REFERENCES requirement_rules(id) ON DELETE CASCADE,
  document_title            TEXT,
  document_type             TEXT
                              CHECK (document_type IN (
                                'application','permit_form','license_form','inspection_request',
                                'certification_request','affidavit','checklist','guide',
                                'manual','instructions','renewal_form','supporting_document',
                                'regulation','circular_letter','administrative_order','policy',
                                'reference_material','application_form','fee_schedule','zoning_document',
                                'tax_registration','license_requirement','inspection_requirement',
                                'supporting_document_template','portal_instruction','other')),
  source_url                TEXT,
  source_file_url           TEXT,
  storage_path              TEXT,
  extracted_text_path       TEXT,
  generated_schema_path     TEXT,
  rendered_template_path    TEXT,
  checksum                  TEXT,
  file_type                 TEXT,
  language                  TEXT,
  version_label             TEXT,
  detected_effective_date   DATE,
  detected_last_updated_date DATE,
  last_modified             TIMESTAMPTZ,
  scope                     TEXT CHECK (scope IN ('statewide','municipality_specific')),
  canonical_requirement_code TEXT,
  metadata_json             JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                    TEXT NOT NULL DEFAULT 'needs_review'
                              CHECK (status IN ('active','needs_review','deprecated','superseded')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reqdocs_rule     ON requirement_documents (requirement_rule_id);
CREATE INDEX IF NOT EXISTS idx_reqdocs_status   ON requirement_documents (status);
CREATE INDEX IF NOT EXISTS idx_reqdocs_checksum ON requirement_documents (checksum);

ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS extracted_text_path TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS generated_schema_path TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS rendered_template_path TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS last_modified TIMESTAMPTZ;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS canonical_requirement_code TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_reqdocs_type     ON requirement_documents (document_type);

CREATE TABLE IF NOT EXISTS form_templates (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_document_id  UUID REFERENCES requirement_documents(id) ON DELETE CASCADE,
  template_name            TEXT,
  template_version         INTEGER NOT NULL DEFAULT 1,
  render_mode              TEXT NOT NULL DEFAULT 'native_ui'
                             CHECK (render_mode IN ('native_ui','pdf_overlay','hybrid','external_only')),
  schema_json              JSONB NOT NULL DEFAULT '{}'::jsonb,
  field_mappings_json      JSONB,
  validation_rules_json    JSONB,
  output_pdf_template_path TEXT,
  status                   TEXT NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','active','needs_review','deprecated')),
  approved_by              UUID,
  approved_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_formtpl_document ON form_templates (requirement_document_id);
CREATE INDEX IF NOT EXISTS idx_formtpl_status   ON form_templates (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_formtpl_active_per_doc
  ON form_templates (requirement_document_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS user_form_instances (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL,
  target_id              UUID NOT NULL,
  user_id                UUID NOT NULL,
  requirement_rule_id    UUID REFERENCES requirement_rules(id) ON DELETE SET NULL,
  form_template_id       UUID REFERENCES form_templates(id) ON DELETE SET NULL,
  status                 TEXT NOT NULL DEFAULT 'not_started'
                           CHECK (status IN ('not_started','in_progress','needs_review','complete','approved','rejected')),
  form_data_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_result_json JSONB,
  generated_pdf_path     TEXT,
  completed_at           TIMESTAMPTZ,
  approved_by            UUID,
  approved_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_userforms_target   ON user_form_instances (target_id);
CREATE INDEX IF NOT EXISTS idx_userforms_user     ON user_form_instances (user_id);
CREATE INDEX IF NOT EXISTS idx_userforms_tenant   ON user_form_instances (tenant_id);
CREATE INDEX IF NOT EXISTS idx_userforms_template ON user_form_instances (form_template_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_userforms_target_template
  ON user_form_instances (target_id, form_template_id);

CREATE TABLE IF NOT EXISTS requirement_monitoring_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id           UUID REFERENCES requirement_rules(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued','running','completed','failed','needs_review')),
  source_url        TEXT,
  previous_checksum TEXT,
  new_checksum      TEXT,
  change_detected   BOOLEAN NOT NULL DEFAULT false,
  change_summary    TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_monruns_rule    ON requirement_monitoring_runs (rule_id);
CREATE INDEX IF NOT EXISTS idx_monruns_status  ON requirement_monitoring_runs (status);
CREATE INDEX IF NOT EXISTS idx_monruns_created ON requirement_monitoring_runs (created_at);

CREATE TABLE IF NOT EXISTS requirement_change_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id           UUID REFERENCES requirement_rules(id) ON DELETE CASCADE,
  document_id       UUID REFERENCES requirement_documents(id) ON DELETE SET NULL,
  monitoring_run_id UUID REFERENCES requirement_monitoring_runs(id) ON DELETE SET NULL,
  change_type       TEXT NOT NULL
                      CHECK (change_type IN (
                        'document_update','document_removed','document_replaced','new_form_discovered',
                        'new_requirement','removed_requirement','form_updated','fee_updated',
                        'checklist_updated','source_unavailable','language_changed',
                        'manual_review_required')),
  old_value         JSONB,
  new_value         JSONB,
  summary           TEXT,
  severity          TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','reviewed','accepted','rejected')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_changeevents_rule     ON requirement_change_events (rule_id);
CREATE INDEX IF NOT EXISTS idx_changeevents_status   ON requirement_change_events (status);
CREATE INDEX IF NOT EXISTS idx_changeevents_severity ON requirement_change_events (severity);
CREATE INDEX IF NOT EXISTS idx_changeevents_run      ON requirement_change_events (monitoring_run_id);


CREATE TABLE IF NOT EXISTS forms_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_code TEXT NOT NULL,
  requirement_name TEXT,
  agency TEXT,
  municipality TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('statewide','municipality_specific')),
  primary_document_id UUID REFERENCES requirement_documents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'needs_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requirement_code, municipality, primary_document_id)
);
CREATE INDEX IF NOT EXISTS idx_forms_registry_requirement ON forms_registry (requirement_code, municipality, status);

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES requirement_documents(id) ON DELETE CASCADE,
  version_label TEXT,
  source_url TEXT,
  download_url TEXT,
  storage_path TEXT,
  checksum TEXT NOT NULL,
  last_modified TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, checksum)
);
CREATE INDEX IF NOT EXISTS idx_docversions_document ON document_versions (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docversions_checksum ON document_versions (checksum);

CREATE TABLE IF NOT EXISTS document_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_document_id UUID REFERENCES requirement_documents(id) ON DELETE CASCADE,
  child_document_id UUID REFERENCES requirement_documents(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_document_id, child_document_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS document_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES requirement_documents(id) ON DELETE CASCADE,
  source_url TEXT,
  last_seen_at TIMESTAMPTZ,
  last_checksum TEXT,
  last_modified TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  observation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docmonitor_document ON document_monitoring (document_id, last_seen_at DESC);

CREATE OR REPLACE VIEW v_admin_review_queue AS
  SELECT 'rule'::text AS item_kind, r.id AS item_id, r.requirement_name AS title,
         r.status, r.confidence_score, r.source_domain, r.official_source_url AS source_url,
         NULL::text AS source_file_url, r.agency_name, r.municipality, NULL::text AS document_type,
         NULL::text AS canonical_requirement_code, '{}'::jsonb AS metadata_json, r.updated_at
    FROM requirement_rules r WHERE r.status = 'needs_review'
  UNION ALL
  SELECT 'document'::text, d.id, d.document_title, d.status, NULL::numeric,
         NULL::text, d.source_url, d.source_file_url, r.agency_name, r.municipality, d.document_type,
         d.canonical_requirement_code, d.metadata_json, d.updated_at
    FROM requirement_documents d LEFT JOIN requirement_rules r ON r.id = d.requirement_rule_id
   WHERE d.status = 'needs_review'
  UNION ALL
  SELECT 'template'::text, t.id, t.template_name, t.status, NULL::numeric,
         NULL::text, d.source_url, d.source_file_url, r.agency_name, r.municipality, d.document_type,
         d.canonical_requirement_code, jsonb_build_object('render_mode', t.render_mode, 'template_version', t.template_version), t.updated_at
    FROM form_templates t
    LEFT JOIN requirement_documents d ON d.id = t.requirement_document_id
    LEFT JOIN requirement_rules r ON r.id = d.requirement_rule_id
   WHERE t.status IN ('draft','needs_review')
  UNION ALL
  SELECT 'change_event'::text, e.id, e.summary, e.status, NULL::numeric,
         NULL::text, COALESCE(d.source_url, r.official_source_url), d.source_file_url, r.agency_name, r.municipality, d.document_type,
         d.canonical_requirement_code, jsonb_build_object('old_value', e.old_value, 'new_value', e.new_value, 'change_type', e.change_type, 'severity', e.severity), e.created_at
    FROM requirement_change_events e
    LEFT JOIN requirement_documents d ON d.id = e.document_id
    LEFT JOIN requirement_rules r ON r.id = e.rule_id
   WHERE e.status = 'open';
`;

// Keep this in sync with data/government_artifacts_schema.sql.
// Additive extensions for the government-artifact engine (forms/artifacts):
// artifact classification, population method, template provenance, the
// municipality adapter table and per-instance population results.
const GOVERNMENT_ARTIFACTS_SCHEMA_SQL = `
-- ============================================================================
-- SmartPR Government Artifact Engine — schema extensions (Supabase / Postgres)
--
-- Additive only. Extends the existing Requirement Intelligence Layer
-- (data/requirements_schema.sql) with the metadata the artifact engine needs:
--
--   * what KIND of artifact satisfies a requirement (official PDF, DOCX,
--     genericized municipal template, portal submission, issued certificate,
--     supporting evidence),
--   * HOW SmartPR populates it (acroform, pdf_overlay, docx_merge,
--     structured_portal_data, none),
--   * WHERE the canonical original lives and what its checksum is,
--   * WHICH municipality implementation satisfies a municipal requirement.
--
-- Mirrored in src/app/requirements/schema.ts so it is applied idempotently at
-- runtime, exactly like the base schema.
--
-- Guardrails encoded here rather than left to convention:
--   * a genericized municipal template can never be registered as a
--     municipality's official form (municipality_form_implementations CHECK),
--   * a new document version arrives needs_review and does NOT carry the prior
--     version's coordinate mappings (document_versions.mapping_status).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. requirement_documents — artifact classification for the source document.
-- ----------------------------------------------------------------------------
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS artifact_type TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS agency TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS municipality TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS form_code TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS revision TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS source_status TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS official_source_url TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS population_method TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS submission_channel TEXT;
ALTER TABLE requirement_documents ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE requirement_documents ADD CONSTRAINT chk_reqdocs_artifact_type
    CHECK (artifact_type IS NULL OR artifact_type IN (
      'official_pdf_form','official_docx_form','genericized_municipal_template',
      'portal_submission','issued_certificate','supporting_evidence'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE requirement_documents ADD CONSTRAINT chk_reqdocs_population_method
    CHECK (population_method IS NULL OR population_method IN (
      'acroform','pdf_overlay','docx_merge','structured_portal_data','none'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE requirement_documents ADD CONSTRAINT chk_reqdocs_source_status
    CHECK (source_status IS NULL OR source_status IN (
      'official_source','genericized_working_copy','pending_source'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_reqdocs_form_code  ON requirement_documents (form_code);
CREATE INDEX IF NOT EXISTS idx_reqdocs_artifact   ON requirement_documents (artifact_type);
CREATE INDEX IF NOT EXISTS idx_reqdocs_muni       ON requirement_documents (municipality);

-- ----------------------------------------------------------------------------
-- 2. forms_registry — the catalog row per artifact.
-- ----------------------------------------------------------------------------
ALTER TABLE forms_registry ADD COLUMN IF NOT EXISTS form_code TEXT;
ALTER TABLE forms_registry ADD COLUMN IF NOT EXISTS artifact_type TEXT;
ALTER TABLE forms_registry ADD COLUMN IF NOT EXISTS population_method TEXT;
ALTER TABLE forms_registry ADD COLUMN IF NOT EXISTS submission_channel TEXT;
ALTER TABLE forms_registry ADD COLUMN IF NOT EXISTS source_status TEXT;
ALTER TABLE forms_registry ADD COLUMN IF NOT EXISTS revision TEXT;
ALTER TABLE forms_registry ADD COLUMN IF NOT EXISTS official_source_url TEXT;
ALTER TABLE forms_registry ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE forms_registry ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE forms_registry ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_forms_registry_form_code ON forms_registry (form_code);

-- ----------------------------------------------------------------------------
-- 3. form_templates — mapping payloads bound to a template revision.
-- ----------------------------------------------------------------------------
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS form_code TEXT;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS population_method TEXT;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS canonical_mappings_json JSONB;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS overlay_placements_json JSONB;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS template_storage_path TEXT;
-- Checksum of the exact source bytes these mappings were captured against.
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS source_checksum TEXT;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS template_revision TEXT;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS mapping_review_status TEXT NOT NULL DEFAULT 'needs_review';

DO $$ BEGIN
  ALTER TABLE form_templates ADD CONSTRAINT chk_formtpl_population_method
    CHECK (population_method IS NULL OR population_method IN (
      'acroform','pdf_overlay','docx_merge','structured_portal_data','none'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE form_templates ADD CONSTRAINT chk_formtpl_mapping_review
    CHECK (mapping_review_status IN ('needs_review','reviewed','superseded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 4. user_form_instances — the generated working copy of a government artifact.
-- ----------------------------------------------------------------------------
ALTER TABLE user_form_instances ADD COLUMN IF NOT EXISTS form_code TEXT;
ALTER TABLE user_form_instances ADD COLUMN IF NOT EXISTS artifact_type TEXT;
ALTER TABLE user_form_instances ADD COLUMN IF NOT EXISTS population_method TEXT;
-- generated-filings/{tenant_id}/{business_id}/{form_code}/{instance_id}/populated.pdf
ALTER TABLE user_form_instances ADD COLUMN IF NOT EXISTS populated_storage_path TEXT;
ALTER TABLE user_form_instances ADD COLUMN IF NOT EXISTS template_checksum TEXT;
ALTER TABLE user_form_instances ADD COLUMN IF NOT EXISTS canonical_snapshot_json JSONB;
ALTER TABLE user_form_instances ADD COLUMN IF NOT EXISTS populated_fields_json JSONB;
ALTER TABLE user_form_instances ADD COLUMN IF NOT EXISTS unanswered_fields_json JSONB;
CREATE INDEX IF NOT EXISTS idx_userforms_form_code ON user_form_instances (form_code);

-- ----------------------------------------------------------------------------
-- 5. document_versions — every revision retained; new ones need review and do
--    NOT inherit the previous revision's coordinate mappings.
-- ----------------------------------------------------------------------------
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'needs_review';
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS mapping_status TEXT NOT NULL DEFAULT 'not_remapped';
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS artifact_type TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS population_method TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS byte_length BIGINT;

DO $$ BEGIN
  ALTER TABLE document_versions ADD CONSTRAINT chk_docversions_review
    CHECK (review_status IN ('needs_review','reviewed','superseded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE document_versions ADD CONSTRAINT chk_docversions_mapping
    CHECK (mapping_status IN ('not_remapped','remapped','not_applicable'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 6. municipality_form_implementations — the municipality adapter table.
--    One canonical requirement, many municipality implementations.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS municipality_form_implementations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality        TEXT NOT NULL,
  requirement_code    TEXT NOT NULL,
  implementation_kind TEXT NOT NULL
                        CHECK (implementation_kind IN ('official_form','portal','requirements_only')),
  form_code           TEXT,
  portal_url          TEXT,
  -- A municipality's official artifact is only usable once a human verified
  -- that this municipality accepts THIS artifact.
  verified            BOOLEAN NOT NULL DEFAULT false,
  verified_at         TIMESTAMPTZ,
  verified_by         TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (municipality, requirement_code),
  CONSTRAINT chk_muni_official_needs_form
    CHECK (implementation_kind <> 'official_form' OR (form_code IS NOT NULL AND verified)),
  CONSTRAINT chk_muni_portal_needs_url
    CHECK (implementation_kind <> 'portal' OR portal_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_muni_impl_requirement
  ON municipality_form_implementations (requirement_code, municipality);

-- ----------------------------------------------------------------------------
-- 7. Admin view: artifact coverage per requirement.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_government_artifact_coverage AS
  SELECT fr.requirement_code,
         fr.form_code,
         fr.agency,
         fr.municipality,
         fr.scope,
         fr.artifact_type,
         fr.population_method,
         fr.source_status,
         fr.checksum,
         fr.storage_path,
         fr.last_verified_at,
         t.mapping_review_status,
         t.source_checksum AS mapping_source_checksum,
         (t.source_checksum IS DISTINCT FROM fr.checksum) AS mapping_out_of_date
    FROM forms_registry fr
    LEFT JOIN form_templates t ON t.form_code = fr.form_code AND t.status = 'active';
`;

// Applied once per process; cleared on failure so the next request can retry.
let schemaReady: Promise<void> | null = null;

async function applySchema(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(REQUIREMENTS_SCHEMA_SQL);
    await pool.query(GOVERNMENT_ARTIFACTS_SCHEMA_SQL);
  } catch (e) {
    // Clear the cached promise so the next request can retry.
    schemaReady = null;
    throw e;
  }
}

export async function ensureRequirementsSchema(): Promise<void> {
  if (!schemaReady) schemaReady = applySchema();
  return schemaReady;
}

export { REQUIREMENTS_SCHEMA_SQL, GOVERNMENT_ARTIFACTS_SCHEMA_SQL };
