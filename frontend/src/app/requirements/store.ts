// ============================================================================
// Data-access layer for the Requirement Monitoring & Fillable Documents system.
//
//   PR 2  resolveRequirements()  — map intake answers to active rules and
//         materialize a user_form_instance per active form template.
//   PR 3+ listRequiredForms()    — list resolved forms for a target.
//         getFormInstance() / saveFormInstance() — fill + autosave.
//
// Everything is best-effort and a safe no-op when DATABASE_URL is unset
// (mirrors src/app/graph/store.ts). The JSON rules engine still drives the
// existing intake flow; this layer adds preloaded, monitored, fillable forms.
// ============================================================================

import { randomUUID } from "crypto";
import { getPool } from "../graph/db";
import { ensureRequirementsSchema } from "./schema";
import { prefillFromIntake, type IntakeData } from "./autofill";
import { validateFormInstance } from "./validation";
import type {
  FormTemplate,
  RequirementDocument,
  RequirementRule,
  UserFormInstance,
  ValidationResult,
} from "./types";

export interface ResolveInput {
  tenantId: string;
  targetId: string;
  userId: string;
  stateOrTerritory?: string | null;
  municipality?: string | null;
  businessType?: string | null;
  activityType?: string | null;
  intake?: IntakeData;
}

export interface ResolvedForm {
  instanceId: string;
  status: UserFormInstance["status"];
  rule: Pick<
    RequirementRule,
    | "id"
    | "requirement_name"
    | "agency_name"
    | "requirement_category"
    | "official_source_url"
    | "source_domain"
    | "confidence_score"
    | "status"
    | "last_checked_at"
    | "last_changed_at"
  > | null;
  template: Pick<
    FormTemplate,
    "id" | "template_name" | "render_mode" | "template_version" | "output_pdf_template_path"
  > | null;
  sourceDocument: Pick<
    RequirementDocument,
    "id" | "document_title" | "document_type" | "source_url" | "source_file_url" | "file_type" | "language" | "status"
  > | null;
  validation: ValidationResult | null;
}

/**
 * PR 2: find ACTIVE requirement rules matching the intake (municipality +
 * business type, plus optional activity type), and ensure a user_form_instance
 * exists for each rule's ACTIVE form template. Intake answers are auto-filled
 * into newly created instances. Returns the resolved forms for the target.
 */
export async function resolveRequirements(input: ResolveInput): Promise<ResolvedForm[]> {
  const pool = getPool();
  if (!pool) return [];
  await ensureRequirementsSchema();

  // Active rules for this jurisdiction + business type. activity_type is
  // matched loosely: a rule with no activity_type applies to all activities.
  const { rows: rules } = await pool.query<RequirementRule>(
    `SELECT * FROM requirement_rules
      WHERE status = 'active'
        AND ($1::text IS NULL OR state_or_territory IS NULL OR state_or_territory = $1)
        AND ($2::text IS NULL OR municipality IS NULL OR municipality = $2)
        AND ($3::text IS NULL OR business_type IS NULL OR business_type = $3)
        AND ($4::text IS NULL OR activity_type IS NULL OR activity_type = $4)
      ORDER BY requirement_category, requirement_name`,
    [
      input.stateOrTerritory ?? null,
      input.municipality ?? null,
      input.businessType ?? null,
      input.activityType ?? null,
    ]
  );

  const resolved: ResolvedForm[] = [];
  for (const rule of rules) {
    // The active template for this rule (via its active document).
    const { rows: tpls } = await pool.query<FormTemplate>(
      `SELECT t.* FROM form_templates t
         JOIN requirement_documents d ON d.id = t.requirement_document_id
        WHERE d.requirement_rule_id = $1 AND t.status = 'active'
        ORDER BY t.template_version DESC LIMIT 1`,
      [rule.id]
    );
    const template = tpls[0] ?? null;
    const { rows: docs } = await pool.query<RequirementDocument>(
      `SELECT d.* FROM requirement_documents d
        WHERE d.requirement_rule_id = $1 AND d.status IN ('active','needs_review')
        ORDER BY CASE WHEN d.id = $2::uuid THEN 0 ELSE 1 END, d.status, d.document_type, d.document_title
        LIMIT 1`,
      [rule.id, template?.requirement_document_id ?? null]
    );
    const sourceDocument = docs[0] ?? null;
    if (!template) {
      // Rule with no fillable template yet — still surface it to the user.
      resolved.push({
        instanceId: "",
        status: "not_started",
        rule: ruleSummary(rule),
        template: null,
        sourceDocument: sourceDocumentSummary(sourceDocument),
        validation: null,
      });
      continue;
    }

    // Idempotent per (target, template): create with prefilled data, or reuse.
    const existing = await pool.query<UserFormInstance>(
      `SELECT * FROM user_form_instances
        WHERE target_id = $1 AND form_template_id = $2 LIMIT 1`,
      [input.targetId, template.id]
    );

    let instance = existing.rows[0];
    if (!instance) {
      const prefilled = input.intake
        ? prefillFromIntake(template, input.intake)
        : {};
      const id = randomUUID();
      const status = Object.keys(prefilled).length > 0 ? "in_progress" : "not_started";
      const ins = await pool.query<UserFormInstance>(
        `INSERT INTO user_form_instances
           (id, tenant_id, target_id, user_id, requirement_rule_id, form_template_id, status, form_data_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (target_id, form_template_id) DO UPDATE SET updated_at = now()
         RETURNING *`,
        [id, input.tenantId, input.targetId, input.userId, rule.id, template.id, status, JSON.stringify(prefilled)]
      );
      instance = ins.rows[0];
    }

    resolved.push({
      instanceId: instance.id,
      status: instance.status,
      rule: ruleSummary(rule),
      template: {
        id: template.id,
        template_name: template.template_name,
        render_mode: template.render_mode,
        template_version: template.template_version,
        output_pdf_template_path: template.output_pdf_template_path,
      },
      sourceDocument: sourceDocumentSummary(sourceDocument),
      validation: instance.validation_result_json,
    });
  }

  return resolved;
}

function ruleSummary(r: RequirementRule): ResolvedForm["rule"] {
  return {
    id: r.id,
    requirement_name: r.requirement_name,
    agency_name: r.agency_name,
    requirement_category: r.requirement_category,
    official_source_url: r.official_source_url,
    source_domain: r.source_domain,
    confidence_score: r.confidence_score,
    status: r.status,
    last_checked_at: r.last_checked_at,
    last_changed_at: r.last_changed_at,
  };
}

function sourceDocumentSummary(d: RequirementDocument | null): ResolvedForm["sourceDocument"] {
  if (!d) return null;
  return {
    id: d.id,
    document_title: d.document_title,
    document_type: d.document_type,
    source_url: d.source_url,
    source_file_url: d.source_file_url,
    file_type: d.file_type,
    language: d.language,
    status: d.status,
  };
}

export async function listRequiredForms(targetId: string): Promise<ResolvedForm[]> {
  const pool = getPool();
  if (!pool) return [];
  await ensureRequirementsSchema();
  const { rows } = await pool.query(
    `SELECT i.id AS instance_id, i.status, i.validation_result_json,
            r.id AS rule_id, r.requirement_name, r.agency_name, r.requirement_category,
            r.official_source_url, r.source_domain, r.confidence_score, r.status AS rule_status,
            r.last_checked_at, r.last_changed_at,
            t.id AS template_id, t.template_name, t.render_mode, t.template_version, t.output_pdf_template_path,
            d.id AS document_id, d.document_title, d.document_type, d.source_url AS document_source_url,
            d.source_file_url, d.file_type, d.language, d.status AS document_status
       FROM user_form_instances i
       LEFT JOIN requirement_rules r ON r.id = i.requirement_rule_id
       LEFT JOIN form_templates t ON t.id = i.form_template_id
       LEFT JOIN requirement_documents d ON d.id = t.requirement_document_id
      WHERE i.target_id = $1
      ORDER BY r.requirement_category, r.requirement_name`,
    [targetId]
  );
  return rows.map((row): ResolvedForm => ({
    instanceId: row.instance_id,
    status: row.status,
    rule: row.rule_id
      ? {
          id: row.rule_id,
          requirement_name: row.requirement_name,
          agency_name: row.agency_name,
          requirement_category: row.requirement_category,
          official_source_url: row.official_source_url,
          source_domain: row.source_domain,
          confidence_score: row.confidence_score,
          status: row.rule_status,
          last_checked_at: row.last_checked_at,
          last_changed_at: row.last_changed_at,
        }
      : null,
    template: row.template_id
      ? {
          id: row.template_id,
          template_name: row.template_name,
          render_mode: row.render_mode,
          template_version: row.template_version,
          output_pdf_template_path: row.output_pdf_template_path,
        }
      : null,
    sourceDocument: row.document_id
      ? {
          id: row.document_id,
          document_title: row.document_title,
          document_type: row.document_type,
          source_url: row.document_source_url,
          source_file_url: row.source_file_url,
          file_type: row.file_type,
          language: row.language,
          status: row.document_status,
        }
      : null,
    validation: row.validation_result_json,
  }));
}

export interface FormInstanceWithTemplate {
  instance: UserFormInstance;
  template: FormTemplate | null;
}

export async function getFormInstance(
  instanceId: string
): Promise<FormInstanceWithTemplate | null> {
  const pool = getPool();
  if (!pool) return null;
  await ensureRequirementsSchema();
  const { rows } = await pool.query<UserFormInstance>(
    `SELECT * FROM user_form_instances WHERE id = $1 LIMIT 1`,
    [instanceId]
  );
  const instance = rows[0];
  if (!instance) return null;
  let template: FormTemplate | null = null;
  if (instance.form_template_id) {
    const t = await pool.query<FormTemplate>(
      `SELECT * FROM form_templates WHERE id = $1 LIMIT 1`,
      [instance.form_template_id]
    );
    template = t.rows[0] ?? null;
  }
  return { instance, template };
}

/**
 * Save (autosave) form data and re-run validation. The instance is only marked
 * 'complete' when validation passes; otherwise it stays 'in_progress'. Callers
 * may force 'needs_review' (e.g. when submitting for admin approval).
 */
export async function saveFormInstance(
  instanceId: string,
  data: Record<string, unknown>,
  opts: { markReview?: boolean } = {}
): Promise<{ instance: UserFormInstance; validation: ValidationResult | null } | null> {
  const pool = getPool();
  if (!pool) return null;
  await ensureRequirementsSchema();

  const ctx = await getFormInstance(instanceId);
  if (!ctx) return null;

  let validation: ValidationResult | null = null;
  let status: UserFormInstance["status"] = "in_progress";
  if (ctx.template) {
    validation = validateFormInstance(ctx.template, data);
    if (opts.markReview) status = "needs_review";
    else if (validation.status === "complete") status = "complete";
  }

  const completedAt = status === "complete" ? new Date().toISOString() : null;
  const { rows } = await pool.query<UserFormInstance>(
    `UPDATE user_form_instances
        SET form_data_json = $2,
            validation_result_json = $3,
            status = $4,
            completed_at = COALESCE($5, completed_at),
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [
      instanceId,
      JSON.stringify(data),
      validation ? JSON.stringify(validation) : null,
      status,
      completedAt,
    ]
  );
  return { instance: rows[0], validation };
}
