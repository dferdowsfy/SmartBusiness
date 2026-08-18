// ============================================================================
// Semantic mapping: government field name → canonical SmartPR field.
//
// Municipal and Hacienda artifacts name their fields in Spanish, Department of
// State artifacts in Spanish + English. This module proposes a canonical
// mapping and a confidence for each. Proposals are never silently trusted:
// anything below REVIEW_THRESHOLD is written to the mapping file with
// `reviewed: false` and surfaces in the admin review queue.
// ============================================================================

import type { AcroFieldRecord, FieldMapping, MappingTransform } from "./types.ts";

/** Mappings at or below this confidence require a human before production use. */
export const REVIEW_THRESHOLD = 0.85;

interface MappingRule {
  /** Matched against the accent-stripped, lower-cased field name. */
  pattern: RegExp;
  canonicalField: string | null;
  confidence: number;
  transform?: MappingTransform;
  sensitive?: boolean;
  note?: string;
}

/** Strip accents + collapse whitespace so "Nómina Anual" matches "nomina anual". */
export function normalizeFieldName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ordered rules — first match wins, so put specific patterns above general ones.
 * Confidence reflects how certain the *semantic* match is, not how certain we
 * are that the value is correct.
 */
const RULES: MappingRule[] = [
  // --- explicitly NOT auto-populated --------------------------------------
  {
    pattern: /seg\.? soc\.?|seguro social(?! patronal)|social security/,
    canonicalField: "owner.tax_id",
    confidence: 0.6,
    sensitive: true,
    note: "Government identifier of a person — SmartPR never auto-fills it; the filer enters it on the artifact.",
  },
  {
    pattern: /juramenta|jurado por|notari|oficinista que administra|firma/,
    canonicalField: null,
    confidence: 0,
    note: "Sworn-statement block completed at signing, not from the business profile.",
  },
  {
    pattern: /^(car rt|ciclo|referencia|status|enviar a|zona$)/,
    canonicalField: null,
    confidence: 0,
    note: "Municipal back-office routing field; completed by the municipality.",
  },

  // --- identity ------------------------------------------------------------
  { pattern: /nombre comercial|nombre corto/, canonicalField: "business.trade_name", confidence: 0.62, note: "Could be the trade name or an abbreviation the municipality assigns." },
  {
    pattern: /nombre del negocio, dueno\/deudor/,
    canonicalField: "business.legal_name",
    confidence: 0.55,
    note: "Label covers business OR owner/debtor OR representative — confirm which one the municipality expects in this section.",
  },
  {
    pattern: /nombre del individuo|nombre del negocio|razon social|nombre de la corporacion|name of the corporation/,
    canonicalField: "business.legal_name",
    confidence: 0.88,
  },
  { pattern: /nombre del dueno o representante|owner name/, canonicalField: "owner.full_name", confidence: 0.9 },
  { pattern: /posicion del dueno|titulo del dueno|cargo/, canonicalField: "owner.title", confidence: 0.84 },

  // --- identifiers ---------------------------------------------------------
  { pattern: /numero de seguro social patronal|identificacion patronal|employer identification|\bein\b/, canonicalField: "business.ein", confidence: 0.72, note: "Employer identifier: confirm the municipality expects the federal EIN here." },
  { pattern: /identificacion municipal|id contribuyente|numero de contribuyente/, canonicalField: "operations.municipal_taxpayer_id", confidence: 0.86 },
  { pattern: /registro de comerciante|registro de cormerciante/, canonicalField: "business.merchant_registration_number", confidence: 0.88 },

  // --- postal codes (checked before addresses: the label contains both) -----
  { pattern: /(zona|codigo) postal.*(residencial|hogar)/, canonicalField: "owner.postal_code", confidence: 0.74 },
  { pattern: /(zona|codigo) postal.*(direccion postal|postal oficina|oficina principal)/, canonicalField: "location.mailing_postal_code", confidence: 0.78 },
  { pattern: /(zona|codigo) postal/, canonicalField: "location.postal_code", confidence: 0.82 },

  // --- addresses -----------------------------------------------------------
  { pattern: /direccion fisica del negocio|localizacion del negocio|direccion fisica/, canonicalField: "location.physical_address", confidence: 0.88 },
  { pattern: /direccion postal (del negocio|negocio)|direccion postal$/, canonicalField: "location.mailing_address", confidence: 0.84 },
  { pattern: /direccion postal oficina principal|oficina principal/, canonicalField: "location.mailing_address", confidence: 0.7, note: "Principal-office address may differ from the business mailing address." },
  { pattern: /direccion (residencial|del hogar|hogar)/, canonicalField: "owner.address", confidence: 0.72 },
  { pattern: /direccion alterna/, canonicalField: null, confidence: 0, note: "Alternate address is municipality-specific; no canonical equivalent yet." },
  { pattern: /(pueblo o ciudad|municipio).*(hogar|residencial)/, canonicalField: "owner.city", confidence: 0.76 },
  { pattern: /estado.*(hogar|residencial)/, canonicalField: "owner.state", confidence: 0.76 },
  { pattern: /^municipio$|municipality|pueblo o ciudad/, canonicalField: "location.municipality", confidence: 0.9 },
  { pattern: /^estado/, canonicalField: "location.state", confidence: 0.86 },

  // --- contact -------------------------------------------------------------
  { pattern: /telefono.*(hogar|residencial)/, canonicalField: "owner.phone", confidence: 0.8 },
  { pattern: /telefono del negocio|num\.? de telefono|telefono/, canonicalField: "business.phone", confidence: 0.86 },
  { pattern: /correo electronico|e-?mail/, canonicalField: "business.email", confidence: 0.88 },

  // --- operations ----------------------------------------------------------
  { pattern: /numero de empleados|employee count/, canonicalField: "operations.employee_count", confidence: 0.94, transform: "integer" },
  { pattern: /nomina( anual)?|payroll/, canonicalField: "operations.estimated_payroll", confidence: 0.9, transform: "currency" },
  { pattern: /volumen de negocio/, canonicalField: "operations.estimated_gross_receipts", confidence: 0.8, transform: "currency", note: "Gross receipts are usually reported for a closed fiscal year — confirm the period before filing." },
  { pattern: /clase de industria|tipo de negocio|naturaleza|purpose/, canonicalField: "business.activity_description", confidence: 0.76 },

  // --- dates ---------------------------------------------------------------
  { pattern: /fecha en que se establecio el negocio \(mes\)/, canonicalField: "business.start_date", confidence: 0.88, transform: "date_month" },
  { pattern: /fecha en que se establecio el negocio \(dia\)/, canonicalField: "business.start_date", confidence: 0.88, transform: "date_day" },
  { pattern: /fecha en que se establecio el negocio \(ano\)/, canonicalField: "business.start_date", confidence: 0.88, transform: "date_year" },
  { pattern: /fecha de incorporacion/, canonicalField: "business.incorporation_date", confidence: 0.86 },
  { pattern: /ano fiscal/, canonicalField: "operations.fiscal_year_end", confidence: 0.6, note: "Fiscal-year field on a municipal declaration — confirm whether the municipality wants the year or the closing date." },
];

export interface MappingProposal {
  canonicalField: string | null;
  confidence: number;
  transform?: MappingTransform;
  sensitive?: boolean;
  note?: string;
}

/** Propose a canonical mapping for one government field name. */
export function proposeMapping(fieldName: string): MappingProposal {
  const normalized = normalizeFieldName(fieldName);
  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) {
      return {
        canonicalField: rule.canonicalField,
        confidence: rule.confidence,
        transform: rule.transform,
        sensitive: rule.sensitive,
        note: rule.note,
      };
    }
  }
  return {
    canonicalField: null,
    confidence: 0,
    note: "No semantic match — needs human mapping or is answered on the artifact itself.",
  };
}

/** Build a draft mapping row for an inventoried AcroForm field. */
export function draftMappingForField(field: AcroFieldRecord): FieldMapping {
  const proposal =
    field.type === "radio_group" || field.type === "checkbox" || field.type === "dropdown"
      ? {
          canonicalField: null,
          confidence: 0,
          note: `Choice field (${field.type}); options: ${(field.options ?? []).join(" | ") || "unknown"}. Needs an explicit option mapping.`,
        }
      : proposeMapping(field.name);

  return {
    pdfField: field.name,
    pdfFieldType: field.type,
    page: field.page,
    rect: field.rect,
    defaultValue: field.currentValue,
    canonicalField: proposal.canonicalField,
    transform: proposal.transform ?? "none",
    confidence: proposal.confidence,
    reviewed: false,
    reviewNote: proposal.note,
    sensitive: proposal.sensitive,
  };
}

/** Mappings a human still has to confirm. */
export function needsHumanReview(mapping: FieldMapping): boolean {
  if (mapping.reviewed) return false;
  if (mapping.canonicalField === null) return false; // deliberately unmapped, not uncertain
  return mapping.confidence < REVIEW_THRESHOLD;
}
