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
                                'application_form','checklist','fee_schedule','instructions',
                                'zoning_document','tax_registration','license_requirement',
                                'inspection_requirement','supporting_document_template',
                                'portal_instruction','other')),
  source_url                TEXT,
  source_file_url           TEXT,
  storage_path              TEXT,
  checksum                  TEXT,
  file_type                 TEXT,
  language                  TEXT,
  version_label             TEXT,
  detected_effective_date   DATE,
  detected_last_updated_date DATE,
  status                    TEXT NOT NULL DEFAULT 'needs_review'
                              CHECK (status IN ('active','needs_review','deprecated','superseded')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reqdocs_rule     ON requirement_documents (requirement_rule_id);
CREATE INDEX IF NOT EXISTS idx_reqdocs_status   ON requirement_documents (status);
CREATE INDEX IF NOT EXISTS idx_reqdocs_checksum ON requirement_documents (checksum);
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

CREATE OR REPLACE VIEW v_admin_review_queue AS
  SELECT 'rule'::text AS item_kind, r.id AS item_id, r.requirement_name AS title,
         r.status, r.confidence_score, r.source_domain, r.official_source_url AS source_url,
         r.updated_at
    FROM requirement_rules r WHERE r.status = 'needs_review'
  UNION ALL
  SELECT 'document'::text, d.id, d.document_title, d.status, NULL::numeric,
         NULL::text, d.source_url, d.updated_at
    FROM requirement_documents d WHERE d.status = 'needs_review'
  UNION ALL
  SELECT 'template'::text, t.id, t.template_name, t.status, NULL::numeric,
         NULL::text, NULL::text, t.updated_at
    FROM form_templates t WHERE t.status IN ('draft','needs_review')
  UNION ALL
  SELECT 'change_event'::text, e.id, e.summary, e.status, NULL::numeric,
         NULL::text, NULL::text, e.created_at
    FROM requirement_change_events e WHERE e.status = 'open';
`;

// Applied once per process; cleared on failure so the next request can retry.
let schemaReady: Promise<void> | null = null;

async function applySchema(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(REQUIREMENTS_SCHEMA_SQL);
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

export { REQUIREMENTS_SCHEMA_SQL };
