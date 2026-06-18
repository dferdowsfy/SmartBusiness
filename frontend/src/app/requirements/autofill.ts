// ============================================================================
// PR 5: Auto-fill form fields from intake data.
//
// Form templates declare a mapping of field key -> intake dot-path (either in
// field.source on each field, or in the template's field_mappings_json). This
// module resolves those paths against an intake object and returns prefilled
// form_data, only touching keys the user has not already filled.
// ============================================================================

import type { FormSchema, FormTemplate } from "./types";

export type IntakeData = Record<string, unknown>;

/** Read a dot-path like "intake.business.legal_name" out of an intake object. */
export function readPath(obj: unknown, path: string): unknown {
  // Tolerate an optional leading "intake." prefix used in the schema sources.
  const parts = path.replace(/^intake\./, "").split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Collect field key -> source path from both the schema fields and the explicit map. */
export function collectMappings(
  schema: FormSchema,
  explicit?: Record<string, string> | null
): Record<string, string> {
  const map: Record<string, string> = { ...(explicit ?? {}) };
  for (const section of schema.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (field.source && !map[field.key]) map[field.key] = field.source;
    }
  }
  return map;
}

/**
 * Return prefilled form data for a template given intake answers. Existing
 * user-entered values in `current` always win — auto-fill never overwrites.
 */
export function prefillFromIntake(
  template: Pick<FormTemplate, "schema_json" | "field_mappings_json">,
  intake: IntakeData,
  current: Record<string, unknown> = {}
): Record<string, unknown> {
  const mappings = collectMappings(template.schema_json, template.field_mappings_json);
  const out: Record<string, unknown> = { ...current };
  for (const [key, path] of Object.entries(mappings)) {
    const alreadySet = out[key] !== undefined && out[key] !== null && out[key] !== "";
    if (alreadySet) continue;
    const value = readPath({ intake }, `intake.${path.replace(/^intake\./, "")}`);
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}
