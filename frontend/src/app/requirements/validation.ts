// ============================================================================
// PR 6: Validation engine.
//
// Validates a filled form instance against the template's schema_json and
// validation_rules_json. Checks required fields, required attachments,
// signatures, declarations, and conditional requirements (e.g. food-service
// requires a health certificate). Returns the shape the UI + package builder
// consume:
//   { status, missingFields, missingAttachments, warnings, blockingIssues }
//
// NOTE: validation reports readiness only. It never asserts legal sufficiency.
// ============================================================================

import type { FormSchema, FormTemplate, ValidationResult } from "./types";

interface ConditionalRule {
  when: { field: string; equals: unknown };
  requireFields?: string[];
  requireAttachments?: string[];
}

interface ValidationRules {
  requiredFields?: string[];
  requiredAttachments?: string[];
  requiredSignatures?: string[];
  requiredDeclarations?: string[];
  conditional?: ConditionalRule[];
}

function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "boolean") return v === false;
  return false;
}

function labelFor(schema: FormSchema, key: string): string {
  for (const s of schema.sections ?? []) {
    for (const f of s.fields ?? []) if (f.key === key) return f.label || key;
  }
  return key;
}

/**
 * Derive required field/attachment/signature lists from the schema itself so
 * templates work even without an explicit validation_rules_json, then layer
 * the explicit rules on top.
 */
function deriveFromSchema(schema: FormSchema): Required<Omit<ValidationRules, "conditional">> {
  const requiredFields: string[] = [];
  const requiredAttachments: string[] = [];
  const requiredSignatures: string[] = [];
  const requiredDeclarations: string[] = [];
  for (const s of schema.sections ?? []) {
    for (const f of s.fields ?? []) {
      if (!f.required) continue;
      if (f.type === "file_upload") requiredAttachments.push(f.key);
      else if (f.type === "signature") requiredSignatures.push(f.key);
      else if (f.type === "declaration") requiredDeclarations.push(f.key);
      else requiredFields.push(f.key);
    }
  }
  return { requiredFields, requiredAttachments, requiredSignatures, requiredDeclarations };
}

export function validateFormInstance(
  template: Pick<FormTemplate, "schema_json" | "validation_rules_json">,
  data: Record<string, unknown>
): ValidationResult {
  const schema = template.schema_json;
  const explicit = (template.validation_rules_json ?? {}) as ValidationRules;
  const derived = deriveFromSchema(schema);

  const requiredFields = new Set([...(derived.requiredFields), ...(explicit.requiredFields ?? [])]);
  const requiredAttachments = new Set([...(derived.requiredAttachments), ...(explicit.requiredAttachments ?? [])]);
  const requiredSignatures = new Set([...(derived.requiredSignatures), ...(explicit.requiredSignatures ?? [])]);
  const requiredDeclarations = new Set([...(derived.requiredDeclarations), ...(explicit.requiredDeclarations ?? [])]);

  // Conditional rules (e.g. food_service_flag -> health certificate).
  for (const cond of explicit.conditional ?? []) {
    if (data[cond.when.field] === cond.when.equals) {
      for (const k of cond.requireFields ?? []) requiredFields.add(k);
      for (const k of cond.requireAttachments ?? []) requiredAttachments.add(k);
    }
  }

  const missingFields: string[] = [];
  const missingAttachments: string[] = [];
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  for (const k of requiredFields) if (isEmpty(data[k])) missingFields.push(k);
  for (const k of requiredAttachments) if (isEmpty(data[k])) missingAttachments.push(k);
  for (const k of requiredSignatures) {
    if (isEmpty(data[k])) blockingIssues.push(`Signature required: ${labelFor(schema, k)}`);
  }
  for (const k of requiredDeclarations) {
    if (data[k] !== true) blockingIssues.push(`Declaration must be accepted: ${labelFor(schema, k)}`);
  }

  const complete =
    missingFields.length === 0 &&
    missingAttachments.length === 0 &&
    blockingIssues.length === 0;

  return {
    status: complete ? "complete" : "incomplete",
    missingFields,
    missingAttachments,
    warnings,
    blockingIssues,
  };
}
