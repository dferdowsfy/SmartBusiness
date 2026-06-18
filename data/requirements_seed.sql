-- ============================================================================
-- Seed data for the Requirement Monitoring & Fillable Documents system.
--
-- Provides a handful of ACTIVE Puerto Rico examples so the Required Forms UI
-- (PR 3+) can be built before the discovery/monitoring agents are perfect.
-- Each example creates: requirement_rule -> requirement_document -> form_template
-- (with a native_ui schema_json + validation_rules_json).
--
-- source_url values are official-domain placeholders; the monitoring agent
-- (PR 9) will verify/refresh them. Idempotent: guarded by requirement_name.
-- Run after data/requirements_schema.sql.
-- ============================================================================

-- 1. San Juan / restaurant / food service ------------------------------------
WITH r AS (
  INSERT INTO requirement_rules (
    state_or_territory, municipality, county, agency_name, business_type,
    activity_type, requirement_category, requirement_name, description,
    official_source_url, source_domain, confidence_score, status, effective_date)
  SELECT 'PR','San Juan', NULL,'Municipio de San Juan / OGPe','restaurant',
    'food_service','license','Permiso Único & Licencia Sanitaria (Restaurant)',
    'Single permit (Permiso Único) plus health/sanitation license required to operate a food-service establishment in San Juan.',
    'https://ogpe.pr.gov/','ogpe.pr.gov', 0.80,'active', DATE '2025-01-01'
  WHERE NOT EXISTS (
    SELECT 1 FROM requirement_rules
     WHERE municipality='San Juan' AND business_type='restaurant'
       AND requirement_name='Permiso Único & Licencia Sanitaria (Restaurant)')
  RETURNING id
), d AS (
  INSERT INTO requirement_documents (
    requirement_rule_id, document_title, document_type, source_url, language,
    version_label, status)
  SELECT r.id,'Solicitud de Permiso Único','application_form',
    'https://ogpe.pr.gov/','es','2025.1','active' FROM r
  RETURNING id
)
INSERT INTO form_templates (
  requirement_document_id, template_name, template_version, render_mode,
  schema_json, field_mappings_json, validation_rules_json, status)
SELECT d.id,'Permiso Único — Restaurant (San Juan)',1,'native_ui',
  '{"sections":[{"title":"Applicant Information","fields":[
      {"key":"legal_business_name","label":"Legal Business Name","type":"text","required":true,"source":"intake.business.legal_name"},
      {"key":"trade_name","label":"Trade Name (DBA)","type":"text","source":"intake.business.dba"},
      {"key":"owner_name","label":"Owner Name","type":"text","required":true,"source":"intake.owner.full_name"},
      {"key":"owner_email","label":"Owner Email","type":"email","required":true,"source":"intake.owner.email"},
      {"key":"owner_phone","label":"Owner Phone","type":"phone","required":true,"source":"intake.owner.phone"}]},
    {"title":"Location","fields":[
      {"key":"business_address","label":"Business Address","type":"address","required":true,"source":"intake.location.address"},
      {"key":"municipality","label":"Municipality","type":"text","required":true,"source":"intake.location.municipality"},
      {"key":"square_footage","label":"Square Footage","type":"number","source":"intake.location.square_footage"}]},
    {"title":"Food Service","fields":[
      {"key":"food_service_flag","label":"Food is prepared/served on premises","type":"checkbox","required":true,"source":"intake.activities.food_service"},
      {"key":"health_certificate","label":"Health/Sanitation Certificate","type":"file_upload","required":true},
      {"key":"applicant_signature","label":"Applicant Signature","type":"signature","required":true}]}]}'::jsonb,
  '{"legal_business_name":"intake.business.legal_name","trade_name":"intake.business.dba","owner_name":"intake.owner.full_name","owner_email":"intake.owner.email","owner_phone":"intake.owner.phone","business_address":"intake.location.address","municipality":"intake.location.municipality","square_footage":"intake.location.square_footage","food_service_flag":"intake.activities.food_service"}'::jsonb,
  '{"requiredFields":["legal_business_name","owner_name","owner_email","owner_phone","business_address","municipality"],"requiredAttachments":["health_certificate"],"requiredSignatures":["applicant_signature"],"conditional":[{"when":{"field":"food_service_flag","equals":true},"requireAttachments":["health_certificate"]}]}'::jsonb,
  'active' FROM d;

-- 2. Guaynabo / short-term rental --------------------------------------------
WITH r AS (
  INSERT INTO requirement_rules (
    state_or_territory, municipality, agency_name, business_type, activity_type,
    requirement_category, requirement_name, description, official_source_url,
    source_domain, confidence_score, status, effective_date)
  SELECT 'PR','Guaynabo','Municipio de Guaynabo','short_term_rental','short_term_rental',
    'registration','Registro Municipal de Alquiler a Corto Plazo',
    'Municipal registration required to operate a short-term rental property in Guaynabo.',
    'https://guaynabo.pr.gov/','guaynabo.pr.gov',0.70,'active', DATE '2025-01-01'
  WHERE NOT EXISTS (
    SELECT 1 FROM requirement_rules
     WHERE municipality='Guaynabo' AND business_type='short_term_rental')
  RETURNING id
), d AS (
  INSERT INTO requirement_documents (
    requirement_rule_id, document_title, document_type, source_url, language,
    version_label, status)
  SELECT r.id,'Solicitud de Registro STR','application_form',
    'https://guaynabo.pr.gov/','es','2025.1','active' FROM r
  RETURNING id
)
INSERT INTO form_templates (
  requirement_document_id, template_name, template_version, render_mode,
  schema_json, field_mappings_json, validation_rules_json, status)
SELECT d.id,'STR Registration — Guaynabo',1,'native_ui',
  '{"sections":[{"title":"Owner Information","fields":[
      {"key":"owner_name","label":"Owner Name","type":"text","required":true,"source":"intake.owner.full_name"},
      {"key":"owner_email","label":"Owner Email","type":"email","required":true,"source":"intake.owner.email"},
      {"key":"owner_phone","label":"Owner Phone","type":"phone","required":true,"source":"intake.owner.phone"}]},
    {"title":"Property Details","fields":[
      {"key":"property_address","label":"Property Address","type":"address","required":true,"source":"intake.location.address"},
      {"key":"municipality","label":"Municipality","type":"text","required":true,"source":"intake.location.municipality"},
      {"key":"number_of_units","label":"Number of Rental Units","type":"number","required":true},
      {"key":"deed_or_lease","label":"Deed / Lease Proof","type":"file_upload","required":true},
      {"key":"owner_signature","label":"Owner Signature","type":"signature","required":true}]}]}'::jsonb,
  '{"owner_name":"intake.owner.full_name","owner_email":"intake.owner.email","owner_phone":"intake.owner.phone","property_address":"intake.location.address","municipality":"intake.location.municipality"}'::jsonb,
  '{"requiredFields":["owner_name","owner_email","owner_phone","property_address","municipality","number_of_units"],"requiredAttachments":["deed_or_lease"],"requiredSignatures":["owner_signature"]}'::jsonb,
  'active' FROM d;

-- 3. Bayamon / retail store --------------------------------------------------
WITH r AS (
  INSERT INTO requirement_rules (
    state_or_territory, municipality, agency_name, business_type, activity_type,
    requirement_category, requirement_name, description, official_source_url,
    source_domain, confidence_score, status, effective_date)
  SELECT 'PR','Bayamón','Municipio de Bayamón','retail_store','retail',
    'license','Patente Municipal & Certificado de Uso (Retail)',
    'Municipal business license (patente) and certificate of use required for a retail store in Bayamón.',
    'https://bayamon.pr.gov/','bayamon.pr.gov',0.75,'active', DATE '2025-01-01'
  WHERE NOT EXISTS (
    SELECT 1 FROM requirement_rules
     WHERE municipality='Bayamón' AND business_type='retail_store')
  RETURNING id
), d AS (
  INSERT INTO requirement_documents (
    requirement_rule_id, document_title, document_type, source_url, language,
    version_label, status)
  SELECT r.id,'Solicitud de Patente Municipal','application_form',
    'https://bayamon.pr.gov/','es','2025.1','active' FROM r
  RETURNING id
)
INSERT INTO form_templates (
  requirement_document_id, template_name, template_version, render_mode,
  schema_json, field_mappings_json, validation_rules_json, status)
SELECT d.id,'Patente Municipal — Retail (Bayamón)',1,'native_ui',
  '{"sections":[{"title":"Business Information","fields":[
      {"key":"legal_business_name","label":"Legal Business Name","type":"text","required":true,"source":"intake.business.legal_name"},
      {"key":"trade_name","label":"Trade Name (DBA)","type":"text","source":"intake.business.dba"},
      {"key":"entity_type","label":"Entity Type","type":"select","required":true,"source":"intake.business.entity_type","options":[{"value":"sole_proprietor","label":"Sole Proprietor"},{"value":"llc","label":"LLC"},{"value":"corporation","label":"Corporation"}]},
      {"key":"tax_id","label":"Tax ID","type":"text","required":true,"source":"intake.business.tax_id"}]},
    {"title":"Location","fields":[
      {"key":"business_address","label":"Business Address","type":"address","required":true,"source":"intake.location.address"},
      {"key":"municipality","label":"Municipality","type":"text","required":true,"source":"intake.location.municipality"},
      {"key":"certificate_of_use","label":"Certificate of Use","type":"file_upload","required":true},
      {"key":"applicant_signature","label":"Applicant Signature","type":"signature","required":true}]}]}'::jsonb,
  '{"legal_business_name":"intake.business.legal_name","trade_name":"intake.business.dba","entity_type":"intake.business.entity_type","tax_id":"intake.business.tax_id","business_address":"intake.location.address","municipality":"intake.location.municipality"}'::jsonb,
  '{"requiredFields":["legal_business_name","entity_type","tax_id","business_address","municipality"],"requiredAttachments":["certificate_of_use"],"requiredSignatures":["applicant_signature"]}'::jsonb,
  'active' FROM d;

-- 4. San Juan / professional services office ---------------------------------
WITH r AS (
  INSERT INTO requirement_rules (
    state_or_territory, municipality, agency_name, business_type, activity_type,
    requirement_category, requirement_name, description, official_source_url,
    source_domain, confidence_score, status, effective_date)
  SELECT 'PR','San Juan','Municipio de San Juan','professional_services_office','professional_services',
    'license','Patente Municipal (Professional Services Office)',
    'Municipal business license (patente) required for a professional services office in San Juan.',
    'https://sanjuan.pr.gov/','sanjuan.pr.gov',0.75,'active', DATE '2025-01-01'
  WHERE NOT EXISTS (
    SELECT 1 FROM requirement_rules
     WHERE municipality='San Juan' AND business_type='professional_services_office')
  RETURNING id
), d AS (
  INSERT INTO requirement_documents (
    requirement_rule_id, document_title, document_type, source_url, language,
    version_label, status)
  SELECT r.id,'Solicitud de Patente Municipal','application_form',
    'https://sanjuan.pr.gov/','es','2025.1','active' FROM r
  RETURNING id
)
INSERT INTO form_templates (
  requirement_document_id, template_name, template_version, render_mode,
  schema_json, field_mappings_json, validation_rules_json, status)
SELECT d.id,'Patente Municipal — Professional Office (San Juan)',1,'native_ui',
  '{"sections":[{"title":"Business Information","fields":[
      {"key":"legal_business_name","label":"Legal Business Name","type":"text","required":true,"source":"intake.business.legal_name"},
      {"key":"owner_name","label":"Owner / Principal Name","type":"text","required":true,"source":"intake.owner.full_name"},
      {"key":"owner_email","label":"Owner Email","type":"email","required":true,"source":"intake.owner.email"},
      {"key":"entity_type","label":"Entity Type","type":"select","required":true,"source":"intake.business.entity_type","options":[{"value":"sole_proprietor","label":"Sole Proprietor"},{"value":"llc","label":"LLC"},{"value":"corporation","label":"Corporation"}]},
      {"key":"naics_code","label":"NAICS Code","type":"text","source":"intake.business.naics_code"}]},
    {"title":"Location & Declaration","fields":[
      {"key":"business_address","label":"Business Address","type":"address","required":true,"source":"intake.location.address"},
      {"key":"municipality","label":"Municipality","type":"text","required":true,"source":"intake.location.municipality"},
      {"key":"employee_count","label":"Number of Employees","type":"number","source":"intake.operations.employee_count"},
      {"key":"truth_declaration","label":"I declare the above information is true and correct.","type":"declaration","required":true},
      {"key":"applicant_signature","label":"Applicant Signature","type":"signature","required":true}]}]}'::jsonb,
  '{"legal_business_name":"intake.business.legal_name","owner_name":"intake.owner.full_name","owner_email":"intake.owner.email","entity_type":"intake.business.entity_type","naics_code":"intake.business.naics_code","business_address":"intake.location.address","municipality":"intake.location.municipality","employee_count":"intake.operations.employee_count"}'::jsonb,
  '{"requiredFields":["legal_business_name","owner_name","owner_email","entity_type","business_address","municipality"],"requiredAttachments":[],"requiredSignatures":["applicant_signature"],"requiredDeclarations":["truth_declaration"]}'::jsonb,
  'active' FROM d;
