// ============================================================================
// PR 7: Submission package builder.
//
// Combines the completed in-app forms, requirement rules/evidence, validation
// results, and open issues for a target into a single structured deliverable.
//
// GUARDRAIL: this prepares a package only. It NEVER submits to a government
// portal and NEVER claims legal sufficiency — readiness reporting only.
// ============================================================================

import { getPool } from "../graph/db";
import { ensureRequirementsSchema } from "./schema";
import type { ValidationResult } from "./types";

export interface PackagedForm {
  instanceId: string;
  templateName: string | null;
  requirementName: string | null;
  agency: string | null;
  status: string;
  formData: Record<string, unknown>;
  validation: ValidationResult | null;
  generatedPdfPath: string | null;
  source: { url: string | null; domain: string | null; lastCheckedAt: string | null };
}

export interface SubmissionPackage {
  tenantId: string;
  targetId: string;
  generatedAt: string;
  readiness: "ready" | "incomplete";
  forms: PackagedForm[];
  openIssues: string[];
  disclaimer: string;
}

const DISCLAIMER =
  "This package reports submission READINESS only. It does not constitute legal advice, " +
  "does not guarantee approval, and has not been submitted to any government agency. " +
  "Approving authorities remain the sole deciders of sufficiency.";

export async function buildSubmissionPackage(input: {
  tenantId: string;
  targetId: string;
}): Promise<SubmissionPackage> {
  const base: SubmissionPackage = {
    tenantId: input.tenantId,
    targetId: input.targetId,
    generatedAt: new Date().toISOString(),
    readiness: "incomplete",
    forms: [],
    openIssues: [],
    disclaimer: DISCLAIMER,
  };

  const pool = getPool();
  if (!pool) return base;
  await ensureRequirementsSchema();

  const { rows } = await pool.query(
    `SELECT i.id AS instance_id, i.status, i.form_data_json, i.validation_result_json,
            i.generated_pdf_path,
            r.requirement_name, r.agency_name, r.official_source_url, r.source_domain,
            r.last_checked_at,
            t.template_name
       FROM user_form_instances i
       LEFT JOIN requirement_rules r ON r.id = i.requirement_rule_id
       LEFT JOIN form_templates t ON t.id = i.form_template_id
      WHERE i.tenant_id = $1 AND i.target_id = $2
      ORDER BY r.requirement_category, r.requirement_name`,
    [input.tenantId, input.targetId]
  );

  const openIssues: string[] = [];
  const forms: PackagedForm[] = rows.map((row) => {
    const validation: ValidationResult | null = row.validation_result_json ?? null;
    const name = row.requirement_name || row.template_name || "Required form";
    if (row.status !== "complete" && row.status !== "approved") {
      openIssues.push(`"${name}" is not complete (status: ${row.status}).`);
    }
    if (validation) {
      for (const m of validation.missingFields) openIssues.push(`${name}: missing field "${m}".`);
      for (const a of validation.missingAttachments) openIssues.push(`${name}: missing attachment "${a}".`);
      for (const b of validation.blockingIssues) openIssues.push(`${name}: ${b}`);
    }
    return {
      instanceId: row.instance_id,
      templateName: row.template_name,
      requirementName: row.requirement_name,
      agency: row.agency_name,
      status: row.status,
      formData: row.form_data_json ?? {},
      validation,
      generatedPdfPath: row.generated_pdf_path,
      source: {
        url: row.official_source_url,
        domain: row.source_domain,
        lastCheckedAt: row.last_checked_at,
      },
    };
  });

  return {
    ...base,
    readiness: openIssues.length === 0 && forms.length > 0 ? "ready" : "incomplete",
    forms,
    openIssues,
  };
}
