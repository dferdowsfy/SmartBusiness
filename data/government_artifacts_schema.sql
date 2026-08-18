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
