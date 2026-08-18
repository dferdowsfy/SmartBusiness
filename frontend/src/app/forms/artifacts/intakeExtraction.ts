// ============================================================================
// Deterministic intake extraction.
//
// "I want to open a restaurant in Bayamón with 10 employees and outdoor
// seating" → structured canonical seeds. Deterministic and dependency-injected
// (the municipality list is passed in, exactly like rulesEngine.ts) so the same
// function runs in the app, in scripts and in tests without a model call.
//
// This module NEVER decides requirements — it only fills in canonical answers
// so SmartPR stops asking for what the user already said.
// ============================================================================

import { emptyCanonicalData } from "../engine/types.ts";
import type { CanonicalApplicationData } from "../engine/types.ts";
import { CANONICAL_FIELDS, canonicalFieldLabel, readCanonicalField } from "./canonicalFields.ts";

export interface ExtractionEvidence {
  canonicalField: string;
  value: string;
  evidence: string;
}

export interface IntakeExtraction {
  businessType?: string;
  municipality?: string;
  employeeCount?: number;
  activities: Partial<CanonicalApplicationData["activities"]>;
  evidence: ExtractionEvidence[];
}

export interface MunicipalityOption {
  name: string;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

interface BusinessTypeRule {
  type: string;
  patterns: RegExp[];
  activities?: Partial<CanonicalApplicationData["activities"]>;
}

const BUSINESS_TYPE_RULES: BusinessTypeRule[] = [
  { type: "restaurant", patterns: [/\brestaurant\b/, /\brestaurante\b/], activities: { foodService: true } },
  { type: "cafe", patterns: [/\bcafe\b/, /\bcoffee shop\b/, /\bcafeteria\b/], activities: { foodService: true } },
  { type: "bakery", patterns: [/\bbakery\b/, /\bpanaderia\b/], activities: { foodService: true } },
  { type: "food_truck", patterns: [/\bfood truck\b/, /\bcamion de comida\b/], activities: { foodService: true } },
  { type: "bar", patterns: [/\bbar\b/, /\bpub\b/, /\bcantina\b/], activities: { foodService: true } },
  { type: "retail", patterns: [/\bretail\b/, /\bstore\b/, /\btienda\b/, /\bboutique\b/] },
  { type: "salon", patterns: [/\bsalon\b/, /\bbarber\b/, /\bbarberia\b/, /\bpeluqueria\b/] },
  { type: "office", patterns: [/\boffice\b/, /\boficina\b/, /\bconsulting\b/] },
];

const ACTIVITY_RULES: { key: keyof CanonicalApplicationData["activities"]; patterns: RegExp[] }[] = [
  { key: "outdoorSeating", patterns: [/\boutdoor seating\b/, /\bsidewalk seating\b/, /\bterraza\b/, /\bmesas afuera\b/] },
  { key: "alcoholSales", patterns: [/\balcohol\b/, /\bliquor\b/, /\bbeer\b/, /\bwine\b/, /\bbebidas alcoholicas\b/] },
  { key: "entertainment", patterns: [/\blive (music|entertainment)\b/, /\bentertainment\b/, /\bmusica en vivo\b/] },
  { key: "signage", patterns: [/\bsignage\b/, /\bsign\b/, /\brotulo\b/, /\bletrero\b/] },
  { key: "coinOperatedMachines", patterns: [/\bslot machines?\b/, /\bmaquinas? de (pasatiempo|monedas)\b/, /\btragamonedas\b/] },
  { key: "fuelSales", patterns: [/\bgas station\b/, /\bfuel\b/, /\bgasolina\b/] },
  { key: "cigaretteSales", patterns: [/\bcigarettes?\b/, /\bcigarrillos\b/] },
];

/**
 * Extract canonical seeds from a free-text description.
 * `municipalities` comes from the knowledge base — nothing is hardcoded here.
 */
export function extractIntake(description: string, municipalities: MunicipalityOption[]): IntakeExtraction {
  const text = normalize(description);
  const extraction: IntakeExtraction = { activities: {}, evidence: [] };

  for (const rule of BUSINESS_TYPE_RULES) {
    const hit = rule.patterns.find((p) => p.test(text));
    if (!hit) continue;
    extraction.businessType = rule.type;
    extraction.evidence.push({ canonicalField: "business.activity_description", value: rule.type, evidence: String(hit) });
    Object.assign(extraction.activities, rule.activities ?? {});
    break;
  }

  // Longest municipality name first so "San Juan" wins over a shorter substring.
  const sorted = [...municipalities].sort((a, b) => b.name.length - a.name.length);
  for (const option of sorted) {
    const key = normalize(option.name);
    if (key && new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)) {
      extraction.municipality = option.name;
      extraction.evidence.push({ canonicalField: "location.municipality", value: option.name, evidence: option.name });
      break;
    }
  }

  const employees = /(\d{1,5})\s*(?:full[- ]time\s*|part[- ]time\s*)?(employees|empleados|staff|workers)/.exec(text);
  if (employees) {
    extraction.employeeCount = Number(employees[1]);
    extraction.evidence.push({
      canonicalField: "operations.employee_count",
      value: employees[1],
      evidence: employees[0],
    });
  }

  for (const rule of ACTIVITY_RULES) {
    const hit = rule.patterns.find((p) => p.test(text));
    if (!hit) continue;
    extraction.activities[rule.key] = true;
    extraction.evidence.push({ canonicalField: `activities.${rule.key}`, value: "true", evidence: String(hit) });
  }

  return extraction;
}

/** Merge extraction seeds into a canonical profile without clobbering answers. */
export function applyExtraction(
  extraction: IntakeExtraction,
  base: CanonicalApplicationData = emptyCanonicalData()
): CanonicalApplicationData {
  return {
    ...base,
    business: {
      ...base.business,
      activityDescription: base.business.activityDescription || extraction.businessType,
    },
    addresses: {
      ...base.addresses,
      municipality: base.addresses.municipality || extraction.municipality,
    },
    operations: {
      ...base.operations,
      employeeCount: base.operations.employeeCount ?? extraction.employeeCount,
    },
    activities: { ...extraction.activities, ...base.activities },
  };
}

export interface OutstandingQuestion {
  canonicalField: string;
  label: string;
  /** Artifacts blocked by this answer. */
  neededBy: string[];
}

/**
 * The only questions worth asking next: canonical fields that some applicable
 * artifact needs and the profile cannot already answer.
 */
export function outstandingIntakeQuestions(
  profile: CanonicalApplicationData,
  requiredByArtifact: { formCode: string; canonicalFields: string[] }[]
): OutstandingQuestion[] {
  const order = new Map(CANONICAL_FIELDS.map((f, index) => [f.id, index]));
  const byField = new Map<string, Set<string>>();
  for (const artifact of requiredByArtifact) {
    for (const field of artifact.canonicalFields) {
      if (readCanonicalField(profile, field) !== undefined) continue;
      if (!byField.has(field)) byField.set(field, new Set());
      byField.get(field)!.add(artifact.formCode);
    }
  }
  return [...byField.entries()]
    .map(([canonicalField, forms]) => ({
      canonicalField,
      label: canonicalFieldLabel(canonicalField),
      neededBy: [...forms].sort(),
    }))
    .sort((a, b) => (order.get(a.canonicalField) ?? 999) - (order.get(b.canonicalField) ?? 999));
}
