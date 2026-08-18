// ============================================================================
// Coordinate overlays for official PDFs that carry no AcroForm fields.
//
// The government background is never redrawn or altered — SmartPR writes text
// on top of the untouched page. Coordinates are in PDF user space (origin at
// the bottom-left of the page) and were derived from the position of the ruled
// blanks in each form's own text layer, then rounded to whole points.
//
// Coordinates are VERSION-BOUND. A new agency revision must be re-measured and
// stored under its own revision key — never migrated silently, because a moved
// blank would print a value into the wrong box on an official filing.
// ============================================================================

import type { FieldMapping } from "./types.ts";

const PLACEMENT_NOTE =
  "Coordinates derived from the ruled blanks in the form's text layer. Validate visually with the mapping preview before production use.";

/** Defaults every placement to unreviewed with a validation note. */
function overlay(mapping: Omit<FieldMapping, "reviewed" | "transform"> & Partial<Pick<FieldMapping, "reviewed" | "transform">>): FieldMapping {
  return {
    reviewed: false,
    transform: "none",
    ...mapping,
    reviewNote: mapping.reviewNote ?? PLACEMENT_NOTE,
  };
}

/**
 * CORPREG01 — Certificate of Incorporation (Stock Corporation), 2 pages,
 * 612 × 792 pt. Measured against the file recorded in the template manifest.
 */
export const CORPREG01_OVERLAY: FieldMapping[] = [
  overlay({
    pdfField: "first_corporation_name",
    canonicalField: "business.legal_name",
    confidence: 0.95,
    placement: { page: 1, x: 60, y: 547, width: 490, height: 12, fontSize: 10 },
  }),
  overlay({
    pdfField: "second_designated_office_physical",
    canonicalField: "location.physical_address",
    confidence: 0.86,
    placement: { page: 1, x: 96, y: 432, width: 150, height: 46, fontSize: 8, maxLines: 4, lineHeight: 11.6 },
  }),
  overlay({
    pdfField: "second_designated_office_mailing",
    canonicalField: "location.mailing_address",
    confidence: 0.86,
    placement: { page: 1, x: 348, y: 432, width: 172, height: 46, fontSize: 8, maxLines: 4, lineHeight: 11.6 },
  }),
  overlay({
    pdfField: "second_resident_agent_name",
    canonicalField: "parties.resident_agent_name",
    confidence: 0.9,
    placement: { page: 1, x: 268, y: 374, width: 280, height: 12, fontSize: 9 },
  }),
  overlay({
    pdfField: "second_resident_agent_physical",
    canonicalField: "parties.resident_agent_physical_address",
    confidence: 0.88,
    placement: { page: 1, x: 95, y: 294, width: 150, height: 46, fontSize: 8, maxLines: 4, lineHeight: 11.6 },
  }),
  overlay({
    pdfField: "second_resident_agent_mailing",
    canonicalField: "parties.resident_agent_mailing_address",
    confidence: 0.88,
    placement: { page: 1, x: 347, y: 294, width: 172, height: 46, fontSize: 8, maxLines: 4, lineHeight: 11.6 },
  }),
  overlay({
    pdfField: "third_purpose",
    canonicalField: "business.activity_description",
    confidence: 0.9,
    placement: { page: 1, x: 59, y: 211.5, width: 492, height: 45, fontSize: 8.5, maxLines: 4, lineHeight: 11.6 },
  }),
  overlay({
    pdfField: "fourth_authorized_capital_stock",
    canonicalField: null,
    confidence: 0,
    reviewNote:
      "Authorized share classes and par value are answered on this filing, not in the shared business profile.",
    placement: { page: 1, x: 59, y: 107.5, width: 492, height: 34, fontSize: 8.5, maxLines: 3, lineHeight: 11.6 },
  }),
  overlay({
    pdfField: "fourth_stock_rights",
    canonicalField: null,
    confidence: 0,
    reviewNote: "Stock designations, preferences and rights are answered on this filing.",
    placement: { page: 2, x: 59, y: 729.5, width: 492, height: 22, fontSize: 8.5, maxLines: 2, lineHeight: 11.6 },
  }),
  overlay({
    pdfField: "fifth_incorporators",
    canonicalField: "parties.incorporator_list",
    confidence: 0.9,
    placement: { page: 2, x: 59, y: 660.5, width: 492, height: 45, fontSize: 8, maxLines: 4, lineHeight: 11.6 },
  }),
  overlay({
    pdfField: "sixth_directors",
    canonicalField: "parties.director_list",
    confidence: 0.88,
    placement: { page: 2, x: 59, y: 534.5, width: 492, height: 45, fontSize: 8, maxLines: 4, lineHeight: 11.6 },
  }),
  overlay({
    pdfField: "seventh_term_perpetual_mark",
    canonicalField: "filing.term_of_existence",
    constantValue: "X",
    writeWhen: { canonicalField: "filing.term_of_existence", equalsAny: ["perpetual"] },
    confidence: 0.82,
    placement: { page: 2, x: 61, y: 444, width: 12, height: 11, fontSize: 10 },
  }),
  overlay({
    pdfField: "seventh_term_indefinite_mark",
    canonicalField: "filing.term_of_existence",
    constantValue: "X",
    writeWhen: { canonicalField: "filing.term_of_existence", equalsAny: ["indefinite"] },
    confidence: 0.82,
    placement: { page: 2, x: 169, y: 444, width: 12, height: 11, fontSize: 10 },
  }),
  overlay({
    pdfField: "seventh_term_specific_mark",
    canonicalField: "filing.term_of_existence",
    constantValue: "X",
    writeWhen: { canonicalField: "filing.term_of_existence", equalsAny: ["specific_date"] },
    confidence: 0.82,
    placement: { page: 2, x: 277, y: 444, width: 12, height: 11, fontSize: 10 },
  }),
  overlay({
    pdfField: "seventh_term_specific_date",
    canonicalField: "filing.existence_end_date",
    confidence: 0.8,
    placement: { page: 2, x: 398, y: 444, width: 100, height: 11, fontSize: 9 },
  }),
  overlay({
    pdfField: "effective_on_filing_date_mark",
    canonicalField: "filing.effective_date_choice",
    constantValue: "X",
    writeWhen: { canonicalField: "filing.effective_date_choice", equalsAny: ["filing_date"] },
    confidence: 0.82,
    placement: { page: 2, x: 61, y: 375, width: 12, height: 11, fontSize: 10 },
  }),
  overlay({
    pdfField: "effective_on_future_date_mark",
    canonicalField: "filing.effective_date_choice",
    constantValue: "X",
    writeWhen: { canonicalField: "filing.effective_date_choice", equalsAny: ["future_date"] },
    confidence: 0.82,
    placement: { page: 2, x: 61, y: 340, width: 12, height: 11, fontSize: 10 },
  }),
  overlay({
    pdfField: "effective_future_date",
    canonicalField: "filing.future_effective_date",
    confidence: 0.78,
    placement: { page: 2, x: 155, y: 340, width: 110, height: 11, fontSize: 9 },
  }),
  overlay({
    pdfField: "testimony_incorporator_names_es",
    canonicalField: "parties.incorporator_names",
    confidence: 0.84,
    placement: { page: 2, x: 289, y: 272, width: 262, height: 11, fontSize: 8 },
  }),
  overlay({
    pdfField: "testimony_incorporator_names_en",
    canonicalField: "parties.incorporator_names",
    confidence: 0.84,
    placement: { page: 2, x: 214, y: 226, width: 337, height: 11, fontSize: 8 },
  }),
  overlay({
    pdfField: "contact_email",
    canonicalField: "business.email",
    confidence: 0.9,
    placement: { page: 2, x: 175, y: 100, width: 280, height: 11, fontSize: 9 },
  }),
];

/**
 * SC 2309 — Solicitud de Licencias, 4 pages, 612 × 1008 pt. Only Parte I–III on
 * page 1 are applicant-completed; pages 2–4 are agency-use and instructions and
 * are deliberately left untouched.
 */
export const SC2309_OVERLAY: FieldMapping[] = [
  overlay({
    pdfField: "parte1_nombre",
    canonicalField: "business.legal_name",
    confidence: 0.9,
    placement: { page: 1, x: 24, y: 869, width: 300, height: 12, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte1_numero_registro_comerciante",
    canonicalField: "business.merchant_registration_number",
    confidence: 0.86,
    placement: { page: 1, x: 458, y: 869, width: 125, height: 12, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte1_numero_seguro_social",
    canonicalField: null,
    confidence: 0,
    reviewNote: "Individual social security number — entered by the filer on the artifact, never auto-filled.",
    placement: { page: 1, x: 339, y: 869, width: 110, height: 12, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte1_nombre_comercial",
    canonicalField: "business.trade_name",
    confidence: 0.88,
    placement: { page: 1, x: 24, y: 845, width: 285, height: 12, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte1_numero_identificacion_patronal",
    canonicalField: "business.ein",
    confidence: 0.84,
    placement: { page: 1, x: 322, y: 845, width: 120, height: 12, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte1_numero_telefono",
    canonicalField: "business.phone",
    confidence: 0.7,
    placement: { page: 1, x: 466, y: 845, width: 118, height: 12, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte1_direccion_postal",
    canonicalField: "location.mailing_address",
    confidence: 0.86,
    placement: { page: 1, x: 24, y: 820, width: 280, height: 22, fontSize: 8, maxLines: 2, lineHeight: 10 },
  }),
  overlay({
    pdfField: "parte1_localizacion_negocio",
    canonicalField: "location.physical_address",
    confidence: 0.86,
    placement: { page: 1, x: 314, y: 820, width: 270, height: 22, fontSize: 8, maxLines: 2, lineHeight: 10 },
  }),
  // Tipo de contribuyente — one "X" driven by the canonical entity type.
  overlay({
    pdfField: "parte1_tipo_individuo",
    canonicalField: "business.entity_type",
    constantValue: "X",
    writeWhen: { canonicalField: "business.entity_type", equalsAny: ["sole_proprietorship"] },
    confidence: 0.72,
    placement: { page: 1, x: 115, y: 896, width: 10, height: 10, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte1_tipo_sociedad",
    canonicalField: "business.entity_type",
    constantValue: "X",
    writeWhen: { canonicalField: "business.entity_type", equalsAny: ["partnership", "limited_liability_partnership"] },
    confidence: 0.72,
    placement: { page: 1, x: 171, y: 896, width: 10, height: 10, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte1_tipo_corporacion",
    canonicalField: "business.entity_type",
    constantValue: "X",
    writeWhen: {
      canonicalField: "business.entity_type",
      equalsAny: [
        "stock_corporation",
        "close_corporation",
        "professional_corporation",
        "nonprofit_nonstock_corporation",
        "foreign_corporation",
      ],
    },
    confidence: 0.72,
    placement: { page: 1, x: 228, y: 896, width: 10, height: 10, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte1_tipo_llc",
    canonicalField: "business.entity_type",
    constantValue: "X",
    writeWhen: { canonicalField: "business.entity_type", equalsAny: ["limited_liability_company"] },
    confidence: 0.72,
    placement: { page: 1, x: 296, y: 896, width: 10, height: 10, fontSize: 9 },
  }),
  // Parte II — licencia(s) que solicita. Each mark is driven by one activity.
  overlay({
    pdfField: "parte2_bebidas_alcoholicas",
    canonicalField: "activities.alcohol_sales",
    constantValue: "X",
    writeWhen: { canonicalField: "activities.alcohol_sales", equalsAny: ["true"] },
    confidence: 0.88,
    placement: { page: 1, x: 35, y: 546, width: 10, height: 10, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte2_gasolina",
    canonicalField: "activities.fuel_sales",
    constantValue: "X",
    writeWhen: { canonicalField: "activities.fuel_sales", equalsAny: ["true"] },
    confidence: 0.85,
    placement: { page: 1, x: 134, y: 546, width: 10, height: 10, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte2_cigarrillos",
    canonicalField: "activities.cigarette_sales",
    constantValue: "X",
    writeWhen: { canonicalField: "activities.cigarette_sales", equalsAny: ["true"] },
    confidence: 0.85,
    placement: { page: 1, x: 195, y: 546, width: 10, height: 10, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte2_promotor_espectaculos",
    canonicalField: "activities.public_show_promoter",
    constantValue: "X",
    writeWhen: { canonicalField: "activities.public_show_promoter", equalsAny: ["true"] },
    confidence: 0.82,
    placement: { page: 1, x: 381, y: 546, width: 10, height: 10, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte2_metales_preciosos",
    canonicalField: "activities.precious_metals",
    constantValue: "X",
    writeWhen: { canonicalField: "activities.precious_metals", equalsAny: ["true"] },
    confidence: 0.82,
    placement: { page: 1, x: 35, y: 531, width: 10, height: 10, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte2_armas_municiones",
    canonicalField: "activities.weapons_sales",
    constantValue: "X",
    writeWhen: { canonicalField: "activities.weapons_sales", equalsAny: ["true"] },
    confidence: 0.82,
    placement: { page: 1, x: 198, y: 531, width: 10, height: 10, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte2_maquinas_monedas",
    canonicalField: "activities.coin_operated_machines",
    constantValue: "X",
    writeWhen: { canonicalField: "activities.coin_operated_machines", equalsAny: ["true"] },
    confidence: 0.8,
    placement: { page: 1, x: 35, y: 516, width: 10, height: 10, fontSize: 9 },
  }),
  overlay({
    pdfField: "parte3_comentarios",
    canonicalField: "business.activity_description",
    confidence: 0.6,
    reviewNote:
      "Comentarios is a free-text block; confirm the district office accepts the activity description here.",
    placement: { page: 1, x: 80, y: 489, width: 500, height: 10, fontSize: 7.5 },
  }),
];

export const OVERLAY_MAPS: Record<string, FieldMapping[]> = {
  CORPREG01: CORPREG01_OVERLAY,
  SC2309: SC2309_OVERLAY,
};
