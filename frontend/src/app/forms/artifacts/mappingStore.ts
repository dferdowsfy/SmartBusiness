// ============================================================================
// Persistence for `form-mappings/<FORM_CODE>.json`.
//
// The mapping file is the reviewed contract between a government artifact and
// the canonical profile. Re-inspecting a template must never destroy human
// review: `mergeMappings` keeps every field a person marked `reviewed: true`,
// and reports fields that disappeared from the source instead of dropping them
// silently.
// ============================================================================

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { formMappingsDir } from "./paths.ts";
import type { FieldMapping, FormMappingDocument } from "./types.ts";

export function mappingFilePath(formCode: string): string {
  return join(formMappingsDir(), `${formCode}.json`);
}

export function loadMapping(formCode: string): FormMappingDocument | null {
  const path = mappingFilePath(formCode);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as FormMappingDocument;
}

export function saveMapping(doc: FormMappingDocument): string {
  const dir = formMappingsDir();
  mkdirSync(dir, { recursive: true });
  const path = mappingFilePath(doc.formCode);
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  return path;
}

export function listMappingFormCodes(): string[] {
  const dir = formMappingsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.includes("manifest"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

export interface MergeResult {
  fields: FieldMapping[];
  /** Fields present in the previous mapping but no longer in the source. */
  disappeared: FieldMapping[];
  keptReviewed: number;
}

/**
 * Merge freshly-proposed mappings with whatever a human already reviewed.
 * Reviewed rows win outright; unreviewed rows are replaced by the fresh
 * proposal (they carry no human decision worth preserving).
 */
export function mergeMappings(previous: FieldMapping[], proposed: FieldMapping[]): MergeResult {
  const prevByField = new Map(previous.map((f) => [f.pdfField, f]));
  const proposedFields = new Set(proposed.map((f) => f.pdfField));
  let keptReviewed = 0;

  const fields = proposed.map((next) => {
    const prior = prevByField.get(next.pdfField);
    if (!prior) return next;
    if (prior.reviewed) {
      keptReviewed += 1;
      // Refresh only the mechanical facts; the human decision is preserved.
      return {
        ...prior,
        pdfFieldType: next.pdfFieldType ?? prior.pdfFieldType,
        page: next.page ?? prior.page,
        rect: next.rect ?? prior.rect,
        defaultValue: next.defaultValue ?? prior.defaultValue,
      };
    }
    // An unreviewed prior row is just an older machine proposal — the fresh
    // proposal wins so rule improvements actually take effect.
    return { ...next, placement: next.placement ?? prior.placement };
  });

  const disappeared = previous.filter((f) => !proposedFields.has(f.pdfField));
  return { fields, disappeared, keptReviewed };
}
