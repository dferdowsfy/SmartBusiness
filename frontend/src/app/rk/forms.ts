// ============================================================================
// Forms bridge (SERVER ONLY): the graph admin edits the EXISTING versioned
// form_templates track (requirements/*). Editing always creates a new DRAFT
// version; publishing reuses the established approve_template action, which
// supersedes the prior active version (one active per document).
// ============================================================================

import { getPool } from "../graph/db";
import { ensureRequirementsSchema } from "../requirements/schema";
import { applyAdminAction } from "../requirements/admin";
import type { FormSchema, FormTemplate } from "../requirements/types";
import { writeAudit } from "./audit";

export interface FormTemplateListItem extends FormTemplate {
  document_title: string | null;
  requirement_name: string | null;
  agency_name: string | null;
}

export async function listFormTemplates(): Promise<FormTemplateListItem[]> {
  const pool = getPool();
  if (!pool) return [];
  await ensureRequirementsSchema();
  return (
    await pool.query(`
      SELECT t.*, d.document_title, r.requirement_name, r.agency_name
        FROM form_templates t
        LEFT JOIN requirement_documents d ON d.id = t.requirement_document_id
        LEFT JOIN requirement_rules r ON r.id = d.requirement_rule_id
       ORDER BY coalesce(d.document_title, t.template_name), t.template_version DESC
       LIMIT 300`)
  ).rows as FormTemplateListItem[];
}

export interface SaveDraftInput {
  templateId: string;
  templateName?: string;
  schemaJson?: FormSchema;
  validationRulesJson?: Record<string, unknown> | null;
  fieldMappingsJson?: Record<string, string> | null;
  actor?: string | null;
}

/** Create a NEW draft version of an existing template (never edits in place). */
export async function saveTemplateDraft(input: SaveDraftInput): Promise<{ ok: boolean; template?: FormTemplate; message?: string }> {
  const pool = getPool();
  if (!pool) return { ok: false, message: "no_database" };
  await ensureRequirementsSchema();

  const base = (
    await pool.query(`SELECT * FROM form_templates WHERE id = $1`, [input.templateId])
  ).rows[0] as FormTemplate | undefined;
  if (!base) return { ok: false, message: "template not found" };

  const schema = input.schemaJson ?? base.schema_json;
  if (!schema || !Array.isArray((schema as FormSchema).sections)) {
    return { ok: false, message: "schema_json must contain a sections array" };
  }

  const maxV = (
    await pool.query(
      `SELECT coalesce(max(template_version), 0) AS v FROM form_templates WHERE requirement_document_id = $1`,
      [base.requirement_document_id]
    )
  ).rows[0].v as number;

  const res = await pool.query(
    `INSERT INTO form_templates
       (requirement_document_id, template_name, template_version, render_mode,
        schema_json, field_mappings_json, validation_rules_json, output_pdf_template_path, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft')
     RETURNING *`,
    [
      base.requirement_document_id,
      input.templateName ?? base.template_name,
      Number(maxV) + 1,
      base.render_mode,
      JSON.stringify(schema),
      JSON.stringify(input.fieldMappingsJson ?? base.field_mappings_json ?? null),
      JSON.stringify(input.validationRulesJson ?? base.validation_rules_json ?? null),
      base.output_pdf_template_path,
    ]
  );
  const template = res.rows[0] as FormTemplate;

  await writeAudit({
    actor: input.actor,
    action: "form_template_draft_created",
    entityKind: "form_template",
    entityId: template.id,
    before: { baseTemplate: base.id, version: base.template_version },
    after: { version: template.template_version, name: template.template_name },
  });
  return { ok: true, template };
}

/** Publish (supersede prior active) or reject a draft via the existing admin action. */
export async function actOnTemplate(
  action: "publish" | "reject",
  templateId: string,
  adminUserId: string,
  actorEmail?: string | null
): Promise<{ ok: boolean; message: string }> {
  const result = await applyAdminAction({
    action: action === "publish" ? "approve_template" : "reject_template",
    itemId: templateId,
    adminUserId,
  });
  await writeAudit({
    actor: actorEmail,
    action: `form_template_${action}`,
    entityKind: "form_template",
    entityId: templateId,
    after: { message: result.message },
  });
  return result;
}
