// ============================================================================
// Canonical information models per requirement.
//
// A requirement exists whether or not SmartPR holds the artifact that satisfies
// it. These models say WHICH canonical information that requirement needs, so
// the product can report readiness — "13 of 16 municipal answers prepared" —
// without a file, and so a later official artifact simply maps onto data that
// was already collected.
//
// The municipal model is deliberately municipality-agnostic. It was derived
// from the municipal patente family (provisional patent, declaration extension,
// taxpayer maintenance) and from what every municipality asks for; no
// municipality's name appears in it.
// ============================================================================

export interface RequirementInformationModel {
  requirementCode: string;
  label: string;
  /** Canonical fields the requirement needs before it can be filed anywhere. */
  requiredFields: string[];
  /** Useful but not blocking. */
  optionalFields?: string[];
  notes?: string[];
}

const MUNICIPAL_CORE_FIELDS = [
  "business.legal_name",
  "business.trade_name",
  "business.entity_type",
  "business.ein",
  "business.activity_description",
  "business.start_date",
  "business.phone",
  "owner.full_name",
  "owner.title",
  "owner.email",
  "owner.phone",
  "location.physical_address",
  "location.mailing_address",
  "location.municipality",
  "location.postal_code",
  "operations.employee_count",
  "operations.estimated_payroll",
];

/**
 * The shared profile SmartPR needs before it can route any artifact at all —
 * notably the entity type, without which no Department of State form can be
 * selected. Always included when deciding what to ask next.
 */
export const CORE_PROFILE_REQUIREMENT = "SMARTPR_CORE_PROFILE";

export const REQUIREMENT_INFORMATION_MODELS: RequirementInformationModel[] = [
  {
    requirementCode: CORE_PROFILE_REQUIREMENT,
    label: "Core business profile",
    requiredFields: [
      "business.legal_name",
      "business.entity_type",
      "business.activity_description",
      "business.start_date",
      "business.email",
      "business.phone",
      "owner.full_name",
      "owner.title",
      "owner.email",
      "owner.phone",
      "location.physical_address",
      "location.municipality",
      "location.postal_code",
    ],
    optionalFields: ["business.trade_name", "business.ein", "business.naics_code"],
  },
  {
    requirementCode: "DOC_PATENTE_MUNICIPAL",
    label: "Municipal patente information",
    requiredFields: MUNICIPAL_CORE_FIELDS,
    optionalFields: ["operations.estimated_gross_receipts", "business.naics_code"],
    notes: [
      "Municipality-agnostic: every municipality reuses these canonical answers; only the artifact differs.",
    ],
  },
  {
    requirementCode: "DOC_PATENTE_DECLARATION_EXTENSION",
    label: "Municipal declaration extension information",
    requiredFields: [
      "business.legal_name",
      "location.municipality",
      "operations.municipal_taxpayer_id",
      "operations.estimated_gross_receipts",
      "owner.full_name",
      "owner.title",
    ],
  },
  {
    requirementCode: "DOC_MUNICIPAL_TAXPAYER_MAINTENANCE",
    label: "Municipal taxpayer record information",
    requiredFields: [
      "business.legal_name",
      "business.trade_name",
      "location.physical_address",
      "location.municipality",
      "location.postal_code",
      "business.phone",
      "operations.municipal_taxpayer_id",
    ],
  },
  {
    requirementCode: "DOC_EIN",
    label: "Employer identification number application information",
    requiredFields: [
      "business.legal_name",
      "business.trade_name",
      "business.entity_type",
      "business.activity_description",
      "business.start_date",
      "location.physical_address",
      "location.mailing_address",
      "owner.full_name",
      "owner.title",
      "owner.phone",
      "operations.employee_count",
    ],
    notes: ["Replaced by the official SS-4 field mapping once fss4.pdf is added to the library."],
  },
  {
    requirementCode: "DOC_ARTICLES_ORGANIZATION",
    label: "LLC certificate of organization information",
    requiredFields: [
      "business.legal_name",
      "business.entity_type",
      "business.activity_description",
      "location.physical_address",
      "location.mailing_address",
      "parties.resident_agent_name",
      "parties.resident_agent_physical_address",
      "business.email",
    ],
    notes: ["Replaced by the official CORPLLC02 field mapping once 34-CORPLLC02.pdf is added to the library."],
  },
];

export const INFORMATION_MODELS_BY_REQUIREMENT: Record<string, RequirementInformationModel> = Object.fromEntries(
  REQUIREMENT_INFORMATION_MODELS.map((m) => [m.requirementCode, m])
);
