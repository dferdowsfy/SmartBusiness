// ============================================================================
// Node-side orchestration over the template library.
//
// Loads mapping documents, produces populated working copies, and renders
// mapping previews. Every generation path goes through `assertGenerationAllowed`
// so a genericized municipal layout can only ever be produced for explicit
// internal purposes — never as a user's filing artifact.
// ============================================================================

import { getTemplate, isOfficialArtifact, TEMPLATE_LIBRARY } from "./catalog.ts";
import { CORE_PROFILE_REQUIREMENT, INFORMATION_MODELS_BY_REQUIREMENT } from "./informationModels.ts";
import { outstandingIntakeQuestions, type OutstandingQuestion } from "./intakeExtraction.ts";
import { renderMappingPreview } from "./mappingPreview.ts";
import { loadMapping } from "./mappingStore.ts";
import { populateArtifact, type PopulateOptions } from "./population.ts";
import { loadTemplateBytes } from "./templateLoader.ts";
import type { CanonicalApplicationData } from "../engine/types.ts";
import type { FormMappingDocument, PopulationResult, TemplateDescriptor } from "./types.ts";

/** Why a working copy is being produced. */
export type GenerationPurpose =
  /** A document the user may review, complete and file. */
  | "filing"
  /** Field-mapping validation, UI demos and tests. Never shown as a filing. */
  | "development";

export function loadAllMappings(): Record<string, FormMappingDocument> {
  const out: Record<string, FormMappingDocument> = {};
  for (const template of TEMPLATE_LIBRARY) {
    const doc = loadMapping(template.formCode);
    if (doc) out[template.formCode] = doc;
  }
  return out;
}

/** Canonical fields a form actually consumes (deduped, mapping order). */
export function canonicalFieldsForForm(formCode: string): string[] {
  const doc = loadMapping(formCode);
  if (!doc) return [];
  const seen = new Set<string>();
  for (const field of doc.fields) {
    if (field.canonicalField) seen.add(field.canonicalField);
    if (field.writeWhen) seen.add(field.writeWhen.canonicalField);
  }
  return [...seen];
}

/**
 * The canonical fields an applicable artifact needs. Falls back to the
 * requirement's information model when SmartPR has no mapping yet, so a
 * missing source file never hides the questions the requirement still asks.
 */
export function canonicalFieldsForArtifact(artifact: { formCode?: string; requirementCode: string }): string[] {
  const mapped = artifact.formCode ? canonicalFieldsForForm(artifact.formCode) : [];
  if (mapped.length > 0) return mapped;
  const model = INFORMATION_MODELS_BY_REQUIREMENT[artifact.requirementCode];
  return model ? [...model.requiredFields] : [];
}

/**
 * What SmartPR should ask next: the core profile plus whatever the applicable
 * artifacts need, minus everything the profile already answers.
 */
export function outstandingQuestionsForProfile(
  profile: CanonicalApplicationData,
  artifacts: { formCode?: string; requirementCode: string }[]
): OutstandingQuestion[] {
  const core = INFORMATION_MODELS_BY_REQUIREMENT[CORE_PROFILE_REQUIREMENT];
  const sets = [
    { formCode: "core profile", canonicalFields: core ? [...core.requiredFields] : [] },
    ...artifacts.map((artifact) => ({
      formCode: artifact.formCode ?? artifact.requirementCode,
      canonicalFields: canonicalFieldsForArtifact(artifact),
    })),
  ];
  return outstandingIntakeQuestions(profile, sets);
}

export class ArtifactGenerationError extends Error {}

/**
 * Guard the one mistake this whole engine exists to prevent: handing a user a
 * genericized municipal layout as though it were their municipality's official
 * form.
 */
export function assertGenerationAllowed(template: TemplateDescriptor, purpose: GenerationPurpose): void {
  if (purpose === "development") return;
  if (isOfficialArtifact(template)) return;
  throw new ArtifactGenerationError(
    `${template.formCode} is ${template.artifactType} (${template.sourceStatus}) and cannot be generated as a filing artifact. ` +
      "Register a municipality-verified official form, or report requirements only."
  );
}

export interface GenerateWorkingCopyInput {
  formCode: string;
  profile: CanonicalApplicationData;
  purpose: GenerationPurpose;
  populateOptions?: PopulateOptions;
}

/**
 * Produce a populated working copy of a government artifact.
 * The canonical original is read-only input; the returned bytes are new.
 */
export async function generateWorkingCopy(input: GenerateWorkingCopyInput): Promise<PopulationResult> {
  const template = getTemplate(input.formCode);
  if (!template) throw new ArtifactGenerationError(`Unknown form code: ${input.formCode}`);
  assertGenerationAllowed(template, input.purpose);

  const mapping = loadMapping(input.formCode);
  if (!mapping || mapping.status !== "mapped") {
    throw new ArtifactGenerationError(
      `${input.formCode} has no usable mapping yet (status: ${mapping?.status ?? "missing"}).`
    );
  }
  const loaded = loadTemplateBytes(input.formCode);
  if (mapping.templateChecksum && mapping.templateChecksum !== loaded.checksum) {
    throw new ArtifactGenerationError(
      `${input.formCode}: mapping was captured against ${mapping.templateChecksum} but the template on disk is ${loaded.checksum}.`
    );
  }
  return populateArtifact(mapping, loaded.bytes, input.profile, loaded.checksum, input.populateOptions);
}

/** Render the admin mapping-boundary preview for a form. */
export async function generateMappingPreview(formCode: string): Promise<Uint8Array> {
  const mapping = loadMapping(formCode);
  if (!mapping || mapping.status !== "mapped") {
    throw new ArtifactGenerationError(`${formCode} has no mapping to preview.`);
  }
  const loaded = loadTemplateBytes(formCode);
  return renderMappingPreview(mapping, loaded.bytes);
}
