-- ============================================================================
-- SmartPR Database Schema (Supabase PostgreSQL)
-- Version: 1.0 Design
-- Purpose: Production-ready schema for licensing readiness platform.
-- Notes:
--   - RLS policies required for multi-tenant security.
--   - All user-facing content stored bilingual (en/es) where applicable.
--   - Strict "readiness only" — no approval state columns.
--   - Audit tables are append-only.
-- ============================================================================

-- Enable extensions (Supabase usually has these)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS & TYPES
-- ============================================================================

CREATE TYPE business_structure AS ENUM (
  'sole_proprietorship',
  'llc',
  'corporation',
  'partnership',
  'professional_corporation',
  'other'
);

CREATE TYPE finding_severity AS ENUM ('critical', 'warning', 'informational');

CREATE TYPE validation_status AS ENUM ('pending', 'passed', 'failed', 'warning');

CREATE TYPE document_type_code AS ENUM (
  'certificate_of_incorporation',
  'ein_letter',
  'merchant_registration',
  'lease_agreement',
  'insurance_certificate',
  'health_permit',
  'fire_certification',
  'municipal_use_permit',
  'patente_municipal',
  'professional_license',
  'floor_plan',
  'photo_exterior',
  'photo_interior',
  'owner_id',
  'crim_clearance',
  'other'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Profiles / Auth extension (Supabase auth.users is source of truth)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'es')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Businesses (one user can have multiple client businesses, e.g. advisors)
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  municipality TEXT NOT NULL,                    -- e.g. 'San Juan', 'Aguada'
  industry TEXT NOT NULL,                        -- normalized key e.g. 'restaurant', 'medical_office'
  business_structure business_structure NOT NULL,
  physical_address TEXT,
  is_home_based BOOLEAN NOT NULL DEFAULT false,
  employee_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb            -- freeform future fields
);

-- Discovery Answers (structured + flexible)
-- The wizard produces a canonical profile + freeform answers for rules
CREATE TABLE public.discovery_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,                       -- e.g. {"has_food_service": true, "alcohol_sales": false, "indoor_seating": true, ...}
  follow_up_questions JSONB,                    -- dynamic questions shown
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- KNOWLEDGE BASE / RULES ENGINE (DB-DRIVEN — NO PROMPT HARD-CODING)
-- ============================================================================

-- Master list of agencies (source of truth for display + future integration)
CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,                    -- 'hacienda', 'ogpe', 'salud', 'bomberos', 'municipal_sanjuan', ...
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  portal_url TEXT,
  contact_info JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Requirement catalog (licenses, permits, certifications, documents)
CREATE TABLE public.requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,                    -- 'merchant_registration', 'fire_certification', ...
  category TEXT NOT NULL,                       -- 'license' | 'permit' | 'certification' | 'document'
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  description_en TEXT,
  description_es TEXT,
  issuing_agency_id UUID REFERENCES public.agencies(id),
  typical_validity_days INTEGER,                -- for expiration warnings
  is_mandatory_by_default BOOLEAN NOT NULL DEFAULT true,
  notes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rule Sets (versioned collections of rules for a "profile type")
CREATE TABLE public.rule_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version INTEGER NOT NULL,
  name TEXT NOT NULL,                           -- 'restaurant_v1', 'general_retail_v2'
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

-- Core mapping: which requirements apply under what conditions
CREATE TABLE public.requirement_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_set_id UUID NOT NULL REFERENCES public.rule_sets(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES public.requirements(id),
  -- Conditions expressed declaratively (evaluated by backend)
  conditions JSONB NOT NULL,                    -- e.g. {"industry": ["restaurant"], "has_food_service": true, "municipality": {"$in": ["San Juan"]}}
  priority INTEGER NOT NULL DEFAULT 100,        -- lower = higher priority for overrides
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dependency graph between requirements (e.g. Patente requires Permiso Único first)
CREATE TABLE public.requirement_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prerequisite_requirement_id UUID NOT NULL REFERENCES public.requirements(id),
  dependent_requirement_id UUID NOT NULL REFERENCES public.requirements(id),
  dependency_type TEXT NOT NULL DEFAULT 'hard' CHECK (dependency_type IN ('hard', 'recommended', 'informational')),
  notes_en TEXT,
  notes_es TEXT,
  UNIQUE (prerequisite_requirement_id, dependent_requirement_id)
);

-- ============================================================================
-- DOCUMENTS & EXTRACTION
-- ============================================================================

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES public.requirements(id),  -- link to expected requirement if known
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,                   -- Supabase storage path (private bucket)
  mime_type TEXT,
  size_bytes BIGINT,
  sha256 TEXT,                                  -- integrity + dedup
  uploaded_by UUID REFERENCES public.profiles(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'failed')),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- AI Extraction Results (structured, normalized)
CREATE TABLE public.document_extractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  model TEXT NOT NULL,                          -- e.g. 'openrouter/anthropic/claude-3.5-sonnet'
  prompt_version TEXT NOT NULL,
  extracted JSONB NOT NULL,                     -- canonical schema: {business_name, entity_name, address, owner_name, issue_date, expiration_date, license_number, tax_id, ...}
  confidence JSONB,                             -- per-field confidence 0-1
  raw_response JSONB,                           -- for audit / re-processing
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- VALIDATION, FINDINGS, READINESS
-- ============================================================================

-- Materialized / computed required items for a business (snapshot at time of eval)
CREATE TABLE public.business_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES public.requirements(id),
  rule_set_version INTEGER,
  is_mandatory BOOLEAN NOT NULL,
  source_rule_id UUID REFERENCES public.requirement_rules(id),
  status validation_status NOT NULL DEFAULT 'pending',
  last_evaluated_at TIMESTAMPTZ,
  UNIQUE (business_id, requirement_id)
);

-- Validation Runs (one per significant event: upload, manual refresh, package gen)
CREATE TABLE public.validation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  triggered_by UUID REFERENCES public.profiles(id),
  triggered_reason TEXT,                        -- 'document_upload', 'manual_refresh', 'package_request'
  readiness_score NUMERIC(5,2),                 -- 0-100
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Findings (the heart of the UX — Critical / Warning / Info)
CREATE TABLE public.findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_run_id UUID NOT NULL REFERENCES public.validation_runs(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  severity finding_severity NOT NULL,
  category TEXT NOT NULL,                       -- 'completeness', 'consistency', 'expiration', 'business_rule', 'recommendation'
  title_en TEXT NOT NULL,
  title_es TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_es TEXT NOT NULL,
  evidence JSONB,                               -- {document_id, extracted_field, rule_code, ...}
  recommended_action_en TEXT,
  recommended_action_es TEXT,
  applicable_agency_id UUID REFERENCES public.agencies(id),
  related_requirement_id UUID REFERENCES public.requirements(id),
  related_document_id UUID REFERENCES public.documents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SUBMISSION PACKAGES (READINESS ARTIFACTS)
-- ============================================================================

CREATE TABLE public.submission_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  validation_run_id UUID REFERENCES public.validation_runs(id),
  readiness_score NUMERIC(5,2) NOT NULL,
  package_url TEXT,                             -- generated PDF in storage
  package_sha256 TEXT,
  generated_by UUID REFERENCES public.profiles(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb            -- summary of contents, rule versions used, etc.
);

-- Document index inside package (for traceability)
CREATE TABLE public.package_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id UUID NOT NULL REFERENCES public.submission_packages(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id),
  display_order INTEGER,
  included_hash TEXT
);

-- ============================================================================
-- AUDIT & COMPLIANCE (IMMUTABLE)
-- ============================================================================

CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  business_id UUID,
  actor_id UUID,
  action TEXT NOT NULL,                         -- 'create_business', 'upload_document', 'run_validation', 'generate_package'
  entity_type TEXT,
  entity_id UUID,
  before JSONB,
  after JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.validation_audits (
  id BIGSERIAL PRIMARY KEY,
  validation_run_id UUID,
  business_id UUID NOT NULL,
  step TEXT NOT NULL,                           -- 'extraction', 'completeness', 'consistency', 'rules_eval'
  model TEXT,
  prompt_version TEXT,
  input_hash TEXT,
  output JSONB,
  evidence JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_businesses_owner ON public.businesses(owner_id);
CREATE INDEX idx_discovery_business ON public.discovery_answers(business_id);
CREATE INDEX idx_documents_business ON public.documents(business_id);
CREATE INDEX idx_extractions_document ON public.document_extractions(document_id);
CREATE INDEX idx_findings_business_severity ON public.findings(business_id, severity);
CREATE INDEX idx_business_requirements_business ON public.business_requirements(business_id);
CREATE INDEX idx_requirement_rules_rule_set ON public.requirement_rules(rule_set_id);
CREATE INDEX idx_audit_business_time ON public.audit_logs(business_id, created_at DESC);

-- GIN for flexible JSONB queries (discovery answers, conditions, extractions)
CREATE INDEX idx_discovery_answers_gin ON public.discovery_answers USING GIN (answers);
CREATE INDEX idx_requirement_rules_conditions_gin ON public.requirement_rules USING GIN (conditions);
CREATE INDEX idx_extractions_extracted_gin ON public.document_extractions USING GIN (extracted);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — CRITICAL FOR SUPABASE
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_packages ENABLE ROW LEVEL SECURITY;
-- ... enable on all user-owned tables

-- Example policies (implement in Supabase dashboard or migration)
-- CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
-- CREATE POLICY "Users can CRUD own businesses" ON public.businesses FOR ALL USING (auth.uid() = owner_id);
-- Similar for documents, findings (join through business), packages.

-- Admin / service role bypass via service key (never expose to client).

-- ============================================================================
-- VIEWS (for convenience / API)
-- ============================================================================

CREATE OR REPLACE VIEW public.v_business_readiness AS
SELECT 
  b.id AS business_id,
  b.name,
  b.municipality,
  b.industry,
  COUNT(br.*) FILTER (WHERE br.is_mandatory AND br.status = 'passed') AS mandatory_passed,
  COUNT(br.*) FILTER (WHERE br.is_mandatory) AS mandatory_total,
  ROUND(100.0 * COUNT(br.*) FILTER (WHERE br.is_mandatory AND br.status = 'passed') / NULLIF(COUNT(br.*) FILTER (WHERE br.is_mandatory), 0), 1) AS completeness_pct,
  MAX(vr.readiness_score) AS latest_readiness_score
FROM public.businesses b
LEFT JOIN public.business_requirements br ON br.business_id = b.id
LEFT JOIN public.validation_runs vr ON vr.business_id = b.id
GROUP BY b.id, b.name, b.municipality, b.industry;

-- ============================================================================
-- TRIGGERS (updated_at, audit)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add similar for other tables. Audit trigger functions can be added for sensitive tables.

-- ============================================================================
-- SEED NOTES
-- ============================================================================
-- 1. Seed agencies from official sources (SBP, Hacienda, OGPe, Salud, Bomberos, key municipalities).
-- 2. Seed base requirements (merchant_registration, fire_certification, health_permit, etc.).
-- 3. Create rule_sets + requirement_rules for high-volume profiles (restaurant, retail, professional_services, medical_office, construction, tourism, home_consulting).
-- 4. All seed data must include both EN and ES labels.
-- 5. Maintain a CHANGELOG for rule versions (regulatory citations where possible).
--
-- Example seed data lives in ../rules/seed-*.json (loaded via backend admin scripts).
