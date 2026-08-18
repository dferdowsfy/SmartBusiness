// ============================================================================
// SmartPR template library.
//
// One entry per government artifact SmartPR knows about. An entry exists even
// when SmartPR has no file yet (`sourceStatus: "pending_source"`) — the catalog
// is how the product stays honest about what it does and does not have.
//
// Rules encoded here rather than in prose:
//   * `official_pdf_form` means the bytes came from the issuing agency.
//   * `genericized_municipal_template` means the layout is real but the
//     municipality-specific wording was removed. It NEVER represents an
//     official filing form for any municipality — see municipalities.ts for how
//     a municipality gets a verified implementation.
// ============================================================================

import type { TemplateDescriptor } from "./types.ts";

/** Repository-root-relative directory holding the untouched originals. */
export const REAL_FORMS_DIR = "RealForms";

/** Supabase Storage buckets (private). Canonical originals are never overwritten. */
export const OFFICIAL_TEMPLATE_BUCKET = "official-form-templates";
export const MUNICIPAL_TEMPLATE_BUCKET = "municipal-form-templates";
export const GENERATED_FILINGS_BUCKET = "generated-filings";

const GENERIC_MUNICIPAL_NOTES = [
  "Layout originated from a Municipio de Bayamón form; municipality-specific wording was removed locally.",
  "Classified genericized_municipal_template: usable for field mapping, UI demonstration and data-population testing only.",
  "Must not be presented to a user as the official filing form for any municipality until that municipality's acceptance is separately verified.",
];

export const TEMPLATE_LIBRARY: TemplateDescriptor[] = [
  {
    formCode: "CORPREG01",
    title: "Certificate of Incorporation — Stock Corporation",
    agency: "Puerto Rico Department of State",
    scope: "statewide",
    artifactType: "official_pdf_form",
    populationMethod: "pdf_overlay",
    submissionChannel: "agency_portal",
    sourceStatus: "official_source",
    sourceFile: `${REAL_FORMS_DIR}/1-CORPREG01.pdf`,
    storagePath: `${OFFICIAL_TEMPLATE_BUCKET}/pr/estado/CORPREG01/current/original.pdf`,
    requirementCode: "DOC_CERT_INCORPORATION",
    usageNotes: [
      "No native AcroForm fields — populated by coordinate overlay over the untouched background.",
      "Overlay coordinates are version-bound; a new agency revision requires re-measuring before reuse.",
    ],
  },
  {
    formCode: "CORPLLC02",
    title: "Certificate of Organization — Limited Liability Company",
    agency: "Puerto Rico Department of State",
    scope: "statewide",
    artifactType: "official_pdf_form",
    populationMethod: "none",
    submissionChannel: "agency_portal",
    sourceStatus: "pending_source",
    storagePath: `${OFFICIAL_TEMPLATE_BUCKET}/pr/estado/CORPLLC02/current/original.pdf`,
    requirementCode: "DOC_ARTICLES_ORGANIZATION",
    usageNotes: [
      "Source file 34-CORPLLC02.pdf is not present in RealForms; SmartPR reports requirements only until it is added.",
      "Applies when business.entity_type is a limited liability company.",
    ],
  },
  {
    formCode: "SS4",
    title: "Form SS-4 — Application for Employer Identification Number",
    agency: "Internal Revenue Service",
    scope: "federal",
    artifactType: "official_pdf_form",
    populationMethod: "none",
    submissionChannel: "agency_portal",
    sourceStatus: "pending_source",
    storagePath: `${OFFICIAL_TEMPLATE_BUCKET}/federal/irs/SS4/current/original.pdf`,
    requirementCode: "DOC_EIN",
    usageNotes: [
      "Source file fss4.pdf is not present in RealForms; population method becomes acroform once the official file is added.",
    ],
  },
  {
    formCode: "SC2309",
    title: "Modelo SC 2309 — Solicitud de Licencias",
    agency: "Departamento de Hacienda",
    scope: "statewide",
    artifactType: "official_pdf_form",
    populationMethod: "pdf_overlay",
    submissionChannel: "agency_portal",
    sourceStatus: "official_source",
    revision: "Rev. 28 ago 14 (Rep. 26 jun 17)",
    sourceFile: `${REAL_FORMS_DIR}/sc_2309_0.pdf`,
    storagePath: `${OFFICIAL_TEMPLATE_BUCKET}/pr/hacienda/SC2309/current/original.pdf`,
    requirementCode: "DOC_HACIENDA_LICENSE",
    usageNotes: [
      "Conditional: applies only when an activity requires a Hacienda internal-revenue license.",
      "Never attach to every food-service business — see applicability.ts for the trigger set.",
    ],
  },
  {
    formCode: "PA02",
    title: "Solicitud de Patente Provisional (generic municipal layout)",
    agency: "Municipal finance office",
    scope: "municipality_specific",
    artifactType: "genericized_municipal_template",
    populationMethod: "none",
    submissionChannel: "municipal_office",
    sourceStatus: "pending_source",
    storagePath: `${MUNICIPAL_TEMPLATE_BUCKET}/generic/PA02/current/original.pdf`,
    requirementCode: "DOC_PATENTE_MUNICIPAL",
    usageNotes: [
      ...GENERIC_MUNICIPAL_NOTES,
      "Source file PA02-Solicitud-de-Patente-Provisional.pdf is not present in RealForms; the canonical municipal field model is currently carried by PA03/PA04 plus the canonical catalog.",
    ],
  },
  {
    formCode: "PA03",
    title: "Solicitud de Prórroga de Declaración (generic municipal layout)",
    agency: "Municipal finance office",
    scope: "municipality_specific",
    artifactType: "genericized_municipal_template",
    populationMethod: "acroform",
    submissionChannel: "municipal_office",
    sourceStatus: "genericized_working_copy",
    sourceFile: `${REAL_FORMS_DIR}/PA03-Solicitud-de-Prorroga-de-Declaracion.pdf`,
    storagePath: `${MUNICIPAL_TEMPLATE_BUCKET}/generic/PA03/current/original.pdf`,
    requirementCode: "DOC_PATENTE_DECLARATION_EXTENSION",
    usageNotes: [
      ...GENERIC_MUNICIPAL_NOTES,
      "Ongoing compliance / renewal artifact — never part of a new-business formation package.",
    ],
  },
  {
    formCode: "PA04",
    title: "Mantenimiento de Contribuyente / Deudor (generic municipal layout)",
    agency: "Municipal finance office",
    scope: "municipality_specific",
    artifactType: "genericized_municipal_template",
    populationMethod: "acroform",
    submissionChannel: "municipal_office",
    sourceStatus: "genericized_working_copy",
    sourceFile: `${REAL_FORMS_DIR}/PA04-Mant-Contribuyente-Deudor.pdf`,
    storagePath: `${MUNICIPAL_TEMPLATE_BUCKET}/generic/PA04/current/original.pdf`,
    requirementCode: "DOC_MUNICIPAL_TAXPAYER_MAINTENANCE",
    usageNotes: [
      ...GENERIC_MUNICIPAL_NOTES,
      "Taxpayer-record maintenance; not every municipality uses a document of this kind.",
    ],
  },
];

export const TEMPLATES_BY_CODE: Record<string, TemplateDescriptor> = Object.fromEntries(
  TEMPLATE_LIBRARY.map((t) => [t.formCode, t])
);

export function getTemplate(formCode: string): TemplateDescriptor | undefined {
  return TEMPLATES_BY_CODE[formCode];
}

/** Templates whose original file is present locally (inspectable / populatable). */
export function availableTemplates(): TemplateDescriptor[] {
  return TEMPLATE_LIBRARY.filter((t) => t.sourceStatus !== "pending_source" && Boolean(t.sourceFile));
}

/** Templates SmartPR knows about but has no file for yet. */
export function pendingTemplates(): TemplateDescriptor[] {
  return TEMPLATE_LIBRARY.filter((t) => t.sourceStatus === "pending_source");
}

/**
 * True when the artifact may be shown to a user as an official government form.
 * Genericized municipal layouts always return false.
 */
export function isOfficialArtifact(template: TemplateDescriptor): boolean {
  return (
    (template.artifactType === "official_pdf_form" || template.artifactType === "official_docx_form") &&
    template.sourceStatus === "official_source"
  );
}
