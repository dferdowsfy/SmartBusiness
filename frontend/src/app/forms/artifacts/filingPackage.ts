// ============================================================================
// The "Filing package" view model.
//
// One entry per applicable government artifact: what it is, who it goes to,
// how much of it SmartPR can already answer, and what the user must still
// supply. Copy comes from the fixed status vocabulary — SmartPR never reports
// an approval it did not receive from a government system.
// ============================================================================

import { evaluateCompleteness } from "./population.ts";
import { readCanonicalField, canonicalFieldLabel } from "./canonicalFields.ts";
import { INFORMATION_MODELS_BY_REQUIREMENT } from "./informationModels.ts";
import { isPresentableAsOfficial, type ApplicableArtifact } from "./applicability.ts";
import { STATUS_COPY, type SafeStatus } from "./statusVocabulary.ts";
import type { CanonicalApplicationData } from "../engine/types.ts";
import type { FormMappingDocument, UnansweredFieldRecord } from "./types.ts";

export type FilingAction = "review_form" | "review_information" | "open_portal" | "view_requirements";

export interface FilingPackageItem {
  requirementCode: string;
  title: string;
  agency: string;
  municipality?: string;
  formCode?: string;
  availability: ApplicableArtifact["availability"];
  status: SafeStatus;
  /** Bilingual sentence shown under the title. Vocabulary-checked. */
  message: { en: string; es: string };
  populatedCount: number;
  unansweredCount: number;
  unanswered: UnansweredFieldRecord[];
  actions: FilingAction[];
  /** True only when the artifact may be shown as an official government form. */
  presentableAsOfficial: boolean;
  /** True when SmartPR may generate a populated working copy of the artifact. */
  canGenerateWorkingCopy: boolean;
  notes: string[];
  reason: string;
  portalUrl?: string;
}

export interface FilingPackage {
  generatedAt: string;
  items: FilingPackageItem[];
  summary: {
    artifactCount: number;
    officialFormsAvailable: number;
    awaitingOfficialSource: number;
    totalUnanswered: number;
  };
  disclaimer: string;
}

const DISCLAIMER =
  "SmartPR prepares filing information and populates working copies of government artifacts. " +
  "It does not submit filings and does not issue any government decision. " +
  "An agency's own system remains the only source of a filing outcome.";

const MUNICIPAL_UNVERIFIED_EN =
  "SmartPR has prepared your information, but an official digital form for this municipality has not yet been verified.";
const MUNICIPAL_UNVERIFIED_ES =
  "SmartPR preparó su información, pero aún no se ha verificado un formulario oficial digital para este municipio.";

function messageFor(
  availability: ApplicableArtifact["availability"],
  status: SafeStatus,
  unansweredCount: number
): { en: string; es: string } {
  if (availability === "municipal_requirements_only") {
    return { en: MUNICIPAL_UNVERIFIED_EN, es: MUNICIPAL_UNVERIFIED_ES };
  }
  if (availability === "form_pending_source") {
    return {
      en: "SmartPR has prepared your information. The official form file is not yet in the SmartPR library.",
      es: "SmartPR preparó su información. El archivo oficial del formulario aún no está en la biblioteca de SmartPR.",
    };
  }
  if (availability === "municipal_portal") {
    return {
      en: "This municipality accepts this filing through its own portal. Your prepared information is ready to enter there.",
      es: "Este municipio acepta esta presentación a través de su portal. Su información preparada está lista para ingresarse allí.",
    };
  }
  if (status === "information_complete") {
    return {
      en: "Every field SmartPR maps on this form is populated from your business profile.",
      es: "Todos los campos que SmartPR asigna en este formulario están completados desde su perfil de negocio.",
    };
  }
  return {
    en: `${unansweredCount} ${unansweredCount === 1 ? "answer is" : "answers are"} still required before this form is ready for review.`,
    es: `Faltan ${unansweredCount} ${unansweredCount === 1 ? "respuesta" : "respuestas"} antes de que este formulario esté listo para revisión.`,
  };
}

function statusFor(
  availability: ApplicableArtifact["availability"],
  unansweredCount: number
): SafeStatus {
  switch (availability) {
    case "official_form_available":
    case "municipal_official_form":
      return unansweredCount === 0 ? "information_complete" : "additional_information_required";
    case "municipal_requirements_only":
    case "form_pending_source":
    case "development_template_only":
      return "requirements_prepared";
    case "municipal_portal":
      return "ready_for_submission";
    default:
      return "requirements_prepared";
  }
}

function actionsFor(item: {
  availability: ApplicableArtifact["availability"];
  canGenerateWorkingCopy: boolean;
  portalUrl?: string;
}): FilingAction[] {
  if (item.availability === "municipal_portal") return item.portalUrl ? ["open_portal", "review_information"] : ["review_information"];
  if (item.canGenerateWorkingCopy) return ["review_form"];
  return ["review_information", "view_requirements"];
}

/**
 * Readiness for a requirement SmartPR has no artifact for: measured against the
 * canonical information model instead of a PDF field list, so a missing file
 * never hides missing answers.
 */
function coverageFromInformationModel(
  requirementCode: string,
  profile: CanonicalApplicationData
): { populated: { pdfField: string; canonicalField: string | null; value: string }[]; unanswered: UnansweredFieldRecord[] } | null {
  const model = INFORMATION_MODELS_BY_REQUIREMENT[requirementCode];
  if (!model) return null;
  const populated: { pdfField: string; canonicalField: string | null; value: string }[] = [];
  const unanswered: UnansweredFieldRecord[] = [];
  for (const field of model.requiredFields) {
    const value = readCanonicalField(profile, field);
    if (value === undefined || value === "") {
      unanswered.push({
        pdfField: field,
        canonicalField: field,
        reason: "no_value_in_profile",
        label: canonicalFieldLabel(field),
      });
    } else {
      populated.push({ pdfField: field, canonicalField: field, value: String(value) });
    }
  }
  return { populated, unanswered };
}

export interface BuildFilingPackageInput {
  profile: CanonicalApplicationData;
  artifacts: ApplicableArtifact[];
  /** Mapping documents keyed by form code (loaded from form-mappings/). */
  mappings: Record<string, FormMappingDocument>;
}

export function buildFilingPackage(input: BuildFilingPackageInput): FilingPackage {
  const items: FilingPackageItem[] = input.artifacts.map((artifact) => {
    const mapping = artifact.formCode ? input.mappings[artifact.formCode] : undefined;
    const mappedCoverage =
      mapping && mapping.status === "mapped" && artifact.availability !== "municipal_requirements_only"
        ? evaluateCompleteness(mapping, input.profile)
        : null;
    // Without a usable artifact mapping — a pending source file, or a municipal
    // requirement with no verified official form — readiness is measured
    // against the canonical information model for the requirement itself.
    const coverage =
      mappedCoverage ??
      coverageFromInformationModel(artifact.requirementCode, input.profile) ?? { populated: [], unanswered: [] };

    const presentableAsOfficial = isPresentableAsOfficial(artifact);
    // A genericized municipal layout is never generated as this municipality's
    // filing artifact — it only tells SmartPR which information to collect.
    const canGenerateWorkingCopy =
      presentableAsOfficial && Boolean(mapping) && mapping?.status === "mapped" && mapping.populationMethod !== "none";

    const status = statusFor(artifact.availability, coverage.unanswered.length);
    return {
      requirementCode: artifact.requirementCode,
      title: artifact.title,
      agency: artifact.agency,
      municipality: artifact.municipality,
      formCode: artifact.formCode,
      availability: artifact.availability,
      status,
      message: messageFor(artifact.availability, status, coverage.unanswered.length),
      populatedCount: coverage.populated.length,
      unansweredCount: coverage.unanswered.length,
      unanswered: coverage.unanswered,
      actions: actionsFor({ availability: artifact.availability, canGenerateWorkingCopy, portalUrl: artifact.portalUrl }),
      presentableAsOfficial,
      canGenerateWorkingCopy,
      notes: artifact.notes,
      reason: artifact.reason,
      portalUrl: artifact.portalUrl,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    items,
    summary: {
      artifactCount: items.length,
      officialFormsAvailable: items.filter((i) => i.presentableAsOfficial).length,
      awaitingOfficialSource: items.filter(
        (i) => i.availability === "form_pending_source" || i.availability === "municipal_requirements_only"
      ).length,
      totalUnanswered: items.reduce((sum, i) => sum + i.unansweredCount, 0),
    },
    disclaimer: DISCLAIMER,
  };
}

/** Status label helper so UI code never invents its own wording. */
export function itemStatusLabel(item: FilingPackageItem, lang: "en" | "es" = "en"): string {
  return STATUS_COPY[item.status][lang];
}
