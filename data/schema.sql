-- ============================================================
-- SmartPR Licensing Knowledge Base — PostgreSQL schema
-- Generated for direct import. Stable text IDs, FKs, indexes.
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS document_validation_fields CASCADE;
DROP TABLE IF EXISTS rules CASCADE;
DROP TABLE IF EXISTS business_type_questions CASCADE;
DROP TABLE IF EXISTS question_options CASCADE;
DROP TABLE IF EXISTS municipality_flags CASCADE;
DROP TABLE IF EXISTS business_types CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS industries CASCADE;
DROP TABLE IF EXISTS municipalities CASCADE;

-- ---------- Core reference tables ----------
CREATE TABLE municipalities (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE municipality_flags (
  municipality_id TEXT NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  flag            TEXT NOT NULL CHECK (flag IN ('tourism','coastal','historic','metro','island')),
  PRIMARY KEY (municipality_id, flag)
);

CREATE TABLE industries (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE business_types (
  id          TEXT PRIMARY KEY,
  industry_id TEXT NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT
);

CREATE TABLE questions (
  id       TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  type     TEXT NOT NULL CHECK (type IN ('boolean','single_select','multi_select'))
);

CREATE TABLE question_options (
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  option      TEXT NOT NULL,
  PRIMARY KEY (question_id, position)
);

CREATE TABLE documents (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  agency   TEXT NOT NULL,
  category TEXT NOT NULL
);

-- ---------- Mapping / engine tables ----------
CREATE TABLE business_type_questions (
  business_type_id TEXT NOT NULL REFERENCES business_types(id) ON DELETE CASCADE,
  question_id      TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  PRIMARY KEY (business_type_id, question_id)
);

CREATE TABLE rules (
  id                   TEXT PRIMARY KEY,
  rule_type            TEXT NOT NULL CHECK (rule_type IN ('business_type','question_trigger','municipality','municipality_flag')),
  business_type_id     TEXT REFERENCES business_types(id) ON DELETE CASCADE,
  question_id          TEXT REFERENCES questions(id) ON DELETE CASCADE,
  expected_answer      TEXT,
  municipality_flag    TEXT CHECK (municipality_flag IS NULL OR municipality_flag IN ('tourism','coastal','historic','metro','island')),
  requires_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE document_validation_fields (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  field_name  TEXT NOT NULL,
  PRIMARY KEY (document_id, position)
);

-- ---------- Indexes ----------
CREATE INDEX idx_business_types_industry        ON business_types(industry_id);
CREATE INDEX idx_municipality_flags_flag        ON municipality_flags(flag);
CREATE INDEX idx_btq_question                   ON business_type_questions(question_id);
CREATE INDEX idx_rules_rule_type                ON rules(rule_type);
CREATE INDEX idx_rules_business_type            ON rules(business_type_id);
CREATE INDEX idx_rules_question                 ON rules(question_id);
CREATE INDEX idx_rules_flag                     ON rules(municipality_flag);
CREATE INDEX idx_rules_requires_document        ON rules(requires_document_id);
CREATE INDEX idx_question_options_question      ON question_options(question_id);
CREATE INDEX idx_validation_fields_document     ON document_validation_fields(document_id);

COMMIT;
