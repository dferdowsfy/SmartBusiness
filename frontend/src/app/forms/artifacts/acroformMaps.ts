// ============================================================================
// Hand-written AcroForm mappings.
//
// Most AcroForm templates name their fields after the label printed beside
// them ("Nombre del Dueño o Representante"), so semanticMapping.ts can propose
// a canonical field from the name alone. Some do not: a form exported from an
// XFA designer carries names like `topmostSubform[0].Page1[0].f1_2[0]`, which
// convey nothing. Those forms are mapped here instead, by reading each widget's
// position against the printed line numbers on the page.
//
// An entry here overrides whatever the semantic mapper proposed for that exact
// field name. Fields with no entry keep the mapper's proposal (usually "no
// canonical mapping"), so adding a form here never silently changes the rest.
// ============================================================================

import type { FieldMapping } from "./types.ts";

/** The parts of a mapping a hand-written entry may set. */
export type AcroFieldOverride = Pick<
  FieldMapping,
  "canonicalField" | "transform" | "constantValue" | "writeWhen" | "confidence" | "reviewNote" | "sensitive"
>;

/** Entity types SmartPR treats as forming a new business on SS-4 line 10. */
const NEW_BUSINESS_ENTITY_TYPES = [
  "stock_corporation",
  "nonprofit_nonstock_corporation",
  "close_corporation",
  "professional_corporation",
  "limited_liability_company",
  "limited_liability_partnership",
  "partnership",
  "sole_proprietorship",
];

/**
 * IRS Form SS-4 (Rev. December 2025) — Application for Employer
 * Identification Number. 2 pages, 89 AcroForm fields.
 *
 * Every entry below was resolved by matching the widget rectangle against the
 * printed line numbers and labels in the page's own text layer, not guessed
 * from the field name. Checkbox groups were resolved the same way: e.g. on
 * line 9a the boxes sit at x=61 / x=334 / x=442 with their labels immediately
 * to the right, which fixes the index-to-label order used here.
 *
 * Deliberately left unmapped — blank is the correct output, not a guess:
 *   * 7b SSN/ITIN/EIN of the responsible party — a government identifier the
 *     filer enters on the artifact; SmartPR never stores or auto-fills it.
 *   * 8c "was the LLC organized in the United States" and 9b state/foreign
 *     country of incorporation. Whether a Puerto Rico entity is domestic or
 *     foreign for federal tax purposes turns on IRC §7701(a)(4)-(5) and is a
 *     determination for the filer or their CPA, not a clerical fill.
 *   * 9a entity type when the applicant is an LLC. The correct box depends on
 *     the LLC's federal tax classification (disregarded / partnership /
 *     corporation), which follows from member count and elections SmartPR
 *     does not capture.
 *   * The "(specify)" free-text blanks on lines 9a/10/16, whose printed width
 *     is too small to accept the canonical activity description without
 *     clipping it on a federal form.
 *   * Everything on page 2 (Third Party Designee, signature, title, phone) —
 *     the signature block is an act by the filer.
 */
const SS4: Record<string, AcroFieldOverride> = {
  // --- Lines 1-6: identity and addresses ----------------------------------
  "topmostSubform[0].Page1[0].f1_2[0]": {
    canonicalField: "business.legal_name",
    confidence: 0.95,
    reviewNote: "Line 1 — legal name of entity.",
  },
  "topmostSubform[0].Page1[0].f1_3[0]": {
    canonicalField: "business.trade_name",
    confidence: 0.92,
    reviewNote: "Line 2 — trade name of business, if different from line 1.",
  },
  "topmostSubform[0].Page1[0].Line4ReadOrder[0].f1_5[0]": {
    canonicalField: "location.mailing_address",
    confidence: 0.85,
    reviewNote: "Line 4a — mailing address (street or P.O. box). City/state/ZIP go on 4b.",
  },
  // 4b / 5b (city, state and ZIP) are deliberately unmapped. The canonical
  // model holds an address as one structured value and renders it whole onto
  // 4a/5a, so the only thing left to put here would be a bare postal code —
  // which reads as a mistake in a box labelled "City, state, and ZIP code".
  // Splitting these properly needs a street-only canonical field.
  "topmostSubform[0].Page1[0].f1_7[0]": {
    canonicalField: "location.physical_address",
    confidence: 0.85,
    reviewNote: "Line 5a — street address, only when it differs from the mailing address. No P.O. box.",
  },
  "topmostSubform[0].Page1[0].f1_9[0]": {
    canonicalField: "location.municipality",
    confidence: 0.75,
    reviewNote:
      "Line 6 — county and state where the principal business is located. Puerto Rico has municipios rather than counties; confirm the municipio name is acceptable here.",
  },

  // --- Line 7a: responsible party ----------------------------------------
  "topmostSubform[0].Page1[0].f1_10[0]": {
    canonicalField: "owner.full_name",
    confidence: 0.88,
    reviewNote: "Line 7a — name of responsible party.",
  },

  // --- Line 8a: is this application for an LLC? --------------------------
  "topmostSubform[0].Page1[0].c1_1[0]": {
    canonicalField: "business.entity_type",
    constantValue: "Yes",
    writeWhen: { canonicalField: "business.entity_type", equalsAny: ["limited_liability_company"] },
    confidence: 0.85,
    reviewNote: "Line 8a Yes box (x=255, immediately left of the printed 'Yes' at x=267).",
  },
  "topmostSubform[0].Page1[0].c1_1[1]": {
    canonicalField: "business.entity_type",
    constantValue: "Yes",
    writeWhen: {
      canonicalField: "business.entity_type",
      equalsAny: [
        "stock_corporation",
        "nonprofit_nonstock_corporation",
        "close_corporation",
        "professional_corporation",
        "foreign_corporation",
        "limited_liability_partnership",
        "partnership",
        "sole_proprietorship",
      ],
    },
    confidence: 0.85,
    reviewNote: "Line 8a No box (x=298, immediately left of the printed 'No' at x=310).",
  },

  // --- Line 9a: type of entity (LLCs deliberately excluded, see header) ---
  "topmostSubform[0].Page1[0].c1_3[0]": {
    canonicalField: "business.entity_type",
    constantValue: "Yes",
    writeWhen: { canonicalField: "business.entity_type", equalsAny: ["sole_proprietorship"] },
    confidence: 0.88,
    reviewNote: "Line 9a — Sole proprietor (row y=506, left column).",
  },
  "topmostSubform[0].Page1[0].c1_3[2]": {
    canonicalField: "business.entity_type",
    constantValue: "Yes",
    writeWhen: {
      canonicalField: "business.entity_type",
      equalsAny: ["partnership", "limited_liability_partnership"],
    },
    confidence: 0.82,
    reviewNote:
      "Line 9a — Partnership (row y=494, left column). An LLP is carried here because it files as a partnership; confirm against the entity's own election.",
  },
  "topmostSubform[0].Page1[0].c1_3[4]": {
    canonicalField: "business.entity_type",
    constantValue: "Yes",
    writeWhen: {
      canonicalField: "business.entity_type",
      equalsAny: ["stock_corporation", "close_corporation", "professional_corporation", "foreign_corporation"],
    },
    confidence: 0.85,
    reviewNote:
      "Line 9a — Corporation (row y=482, left column). A professional corporation is mapped here rather than to 'Personal service corporation', which is a tax determination the filer makes.",
  },
  "topmostSubform[0].Page1[0].c1_3[12]": {
    canonicalField: "business.entity_type",
    constantValue: "Yes",
    writeWhen: { canonicalField: "business.entity_type", equalsAny: ["nonprofit_nonstock_corporation"] },
    confidence: 0.82,
    reviewNote: "Line 9a — Other nonprofit organization (row y=446, left column).",
  },

  // --- Line 10: reason for applying --------------------------------------
  "topmostSubform[0].Page1[0].c1_4[0]": {
    canonicalField: "business.entity_type",
    constantValue: "Yes",
    writeWhen: { canonicalField: "business.entity_type", equalsAny: NEW_BUSINESS_ENTITY_TYPES },
    confidence: 0.8,
    reviewNote:
      "Line 10 — Started new business (row y=386, left column). The adjacent '(specify type)' blank is left for the filer; it is too narrow to take the canonical activity description without clipping.",
  },

  // --- Lines 11-13: dates and headcount ----------------------------------
  "topmostSubform[0].Page1[0].f1_31[0]": {
    canonicalField: "business.start_date",
    confidence: 0.85,
    reviewNote: "Line 11 — date business started or acquired.",
  },
  "topmostSubform[0].Page1[0].f1_32[0]": {
    canonicalField: "operations.fiscal_year_end",
    transform: "month_number",
    confidence: 0.78,
    reviewNote:
      "Line 12 — closing MONTH of the accounting year. The canonical value is an MM-DD year end, so only the month is written.",
  },
  "topmostSubform[0].Page1[0].f1_35[0]": {
    canonicalField: "operations.employee_count",
    transform: "integer",
    confidence: 0.78,
    reviewNote:
      "Line 13 — highest number of employees expected, 'Other' column (x=230). Agricultural (x=58) and Household (x=144) are left blank; SmartPR does not classify headcount that way.",
  },

  // --- Line 16: principal activity ---------------------------------------
  "topmostSubform[0].Page1[0].c1_6[5]": {
    canonicalField: "activities.food_service",
    constantValue: "Yes",
    writeWhen: { canonicalField: "activities.food_service", equalsAny: ["true"] },
    confidence: 0.82,
    reviewNote:
      "Line 16 — Accommodation & food service (row y=206, x=320, label at x=332). The other eleven activity boxes are unmapped: SmartPR's profile carries no industry classification that resolves them.",
  },

  // --- Line 17: principal line of merchandise / services ------------------
  "topmostSubform[0].Page1[0].f1_38[0]": {
    canonicalField: "business.activity_description",
    confidence: 0.8,
    reviewNote: "Line 17 — principal line of merchandise sold or services provided (full-width field).",
  },
};

export const ACROFORM_OVERRIDES: Record<string, Record<string, AcroFieldOverride>> = {
  SS4,
};

/** Apply the hand-written entry for this field, when one exists. */
export function applyAcroOverride(mapping: FieldMapping, formCode: string): FieldMapping {
  const override = ACROFORM_OVERRIDES[formCode]?.[mapping.pdfField];
  if (!override) return mapping;
  return { ...mapping, ...override, transform: override.transform ?? mapping.transform ?? "none" };
}
