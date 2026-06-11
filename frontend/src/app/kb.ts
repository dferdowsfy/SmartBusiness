// ============================================================================
// Knowledge-base adapter: wires the pure rulesEngine to the SmartPR app.
//
// - Imports the KB tables (same data as the PostgreSQL knowledge base).
// - Translates the existing UI profile/answers into KB question answers
//   (so the UI is unchanged — no new questionnaire).
// - Returns requirements in the shape the existing UI already consumes.
// ============================================================================

import municipalitiesJson from "../kb/municipalities.json";
import businessTypesJson from "../kb/business_types.json";
import questionsJson from "../kb/questions.json";
import documentsJson from "../kb/documents.json";
import rulesJson from "../kb/rules.json";
import {
  runRulesEngine,
  type KnowledgeBase,
  type EngineInput,
  type EngineResult,
  type KBMunicipality,
  type KBBusinessType,
  type KBQuestion,
  type KBDocument,
  type KBRule,
} from "./rulesEngine";

export const KB: KnowledgeBase = {
  municipalities: municipalitiesJson as KBMunicipality[],
  businessTypes: businessTypesJson as KBBusinessType[],
  questions: questionsJson as KBQuestion[],
  documents: documentsJson as KBDocument[],
  rules: rulesJson as KBRule[],
};

// UI requirement shape (kept identical to the existing app interface, with a
// few optional fields appended for the debug panel / engine output).
export interface UIRequirement {
  code: string;
  name: string;
  mandatory: boolean;
  status: "pending" | "uploaded" | "passed" | "warning";
  agency: string;
  reason: string;
  document_id?: string;
  category?: string;
  source_rule?: string;
}

// Minimal view of the app profile this adapter reads.
interface ProfileLike {
  municipality?: string;
  industry?: string;
  business_type?: string;
  location_type?: string;
  number_of_employees?: number;
  [key: string]: unknown;
}

// Map KB document ids to the app's legacy requirement codes so existing
// behavior (upload matching, submission filename ordering) is preserved.
const LEGACY_CODE: Record<string, string> = {
  DOC_CERT_INCORPORATION: "certificate_of_incorporation",
  DOC_EIN: "ein_letter",
  DOC_MERCHANT_REGISTRATION: "merchant_registration",
  DOC_PERMISO_UNICO: "permiso_unico",
  DOC_PATENTE_MUNICIPAL: "patente_municipal",
  DOC_HEALTH_PERMIT: "health_permit",
  DOC_FIRE_CERT: "fire_certification",
  DOC_CFPM: "food_manager_cert",
  DOC_ALCOHOL_LICENSE: "alcohol_permit",
  DOC_LEASE_AGREEMENT: "lease_or_property_docs",
  DOC_CONTRACTOR_LICENSE: "contractor_license",
  DOC_CRIM_CLEARANCE: "crim_clearance",
  DOC_PROFESSIONAL_LICENSE: "professional_licenses",
  DOC_ENVIRONMENTAL_PERMIT: "environmental_permit",
  DOC_TRANSPORT_PERMIT: "transportation_permit",
  DOC_TOURISM_REGISTRATION: "tourism_registration",
  DOC_SIGN_PERMIT: "sign_permit",
  DOC_OUTDOOR_SEATING_AUTH: "outdoor_seating_auth",
  DOC_ENTERTAINMENT_PERMIT: "entertainment_permit",
  DOC_IMPORT_EXPORT_REG: "import_export_reg",
  DOC_HOME_DECLARATION: "home_declaration",
};

// Documents treated as recommended rather than mandatory (affects scoring).
const RECOMMENDED = new Set([
  "DOC_INSURANCE",
  "DOC_CRIM_CLEARANCE",
  "DOC_SIGN_PERMIT",
  "DOC_OUTDOOR_SEATING_AUTH",
  "DOC_ENTERTAINMENT_PERMIT",
  "DOC_FLOOR_PLANS",
  "DOC_DBA_REGISTRATION",
]);

// Display order (formation/tax first, then operational permits, then the rest).
const DOC_ORDER = [
  "DOC_CERT_INCORPORATION",
  "DOC_ARTICLES_ORGANIZATION",
  "DOC_EIN",
  "DOC_MERCHANT_REGISTRATION",
  "DOC_SURI_REGISTRATION",
  "DOC_PERMISO_UNICO",
  "DOC_ZONING",
  "DOC_PATENTE_MUNICIPAL",
  "DOC_MUNICIPAL_REGISTRATION",
  "DOC_MUNICIPAL_TAX_COMPLIANCE",
  "DOC_HEALTH_PERMIT",
  "DOC_FIRE_CERT",
  "DOC_CFPM",
  "DOC_ALCOHOL_LICENSE",
  "DOC_PROFESSIONAL_LICENSE",
  "DOC_CONTRACTOR_LICENSE",
  "DOC_TOURISM_REGISTRATION",
];
const orderIndex = (id: string) => {
  const i = DOC_ORDER.indexOf(id);
  return i === -1 ? DOC_ORDER.length + 1 : i;
};

// Resolve the app's free-text business type to a KB business type (exact match
// first, then a forgiving contains-match for aliases like "Airbnb").
function resolveBusinessTypeName(name?: string): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  const exact = KB.businessTypes.find((b) => b.name.toLowerCase() === n);
  if (exact) return exact.name;
  const partial = KB.businessTypes.find(
    (b) => b.name.toLowerCase().includes(n) || n.includes(b.name.toLowerCase())
  );
  return partial ? partial.name : name;
}

// Translate the app profile + discovery answers into KB question answers.
export function buildEngineInput(
  profile: ProfileLike,
  answers: Record<string, unknown> = {}
): EngineInput {
  const p = profile || {};
  const da = answers || {};
  const on = (...keys: string[]) => keys.some((k) => p[k] === true || da[k] === true);
  const loc = (p.location_type as string) || "";
  const empCount = Number(p.number_of_employees || 0);

  const a: Record<string, boolean | string | undefined> = {
    Q_PHYSICAL_LOCATION: loc !== "Online Only",
    Q_HOME_BASED: loc === "Home-Based Business",
    Q_ONLINE_ONLY: loc === "Online Only",
    Q_FOOD_PREPARED: on("food_prepared_or_sold", "food_prepared_on_site", "food_prepared"),
    Q_FOOD_SOLD: on("food_prepared_or_sold", "food_sold"),
    Q_FOOD_SERVED: on("food_served", "food_prepared_or_sold"),
    Q_ALCOHOL_SOLD: on("alcohol_sold"),
    Q_ALCOHOL_SERVED: on("alcohol_served", "alcohol_sold"),
    Q_HEALTHCARE_SERVICES: on("healthcare_services", "healthcare_professionals", "patients_visit"),
    Q_CONTROLLED_SUBSTANCES: on("controlled_substances"),
    Q_MEDICAL_WASTE: on("medical_waste"),
    Q_BIOHAZARD_WASTE: on("biohazard_waste"),
    Q_EMPLOYEES_HIRED: on("employees_hired", "employees_work_on_site") || empCount > 0,
    Q_COMMERCIAL_VEHICLES: on("vehicles_used", "commercial_vehicles"),
    Q_HAZARDOUS_MATERIALS: on("hazardous_materials"),
    Q_HAZARDOUS_FLUIDS: on("hazardous_fluids", "hazardous_fluids_stored"),
    Q_CHEMICALS_USED: on("chemicals_used", "chemicals_stored"),
    Q_PRODUCTS_MANUFACTURED: on("products_manufactured", "products_manufactured_on_site"),
    Q_IMPORT_EXPORT: on("import_export"),
    Q_PROFESSIONAL_LICENSES: on("professional_licenses_required", "professional_licenses", "licensed_professionals"),
    Q_COMMERCIAL_SIGNAGE: on("commercial_signage"),
    Q_OUTDOOR_SEATING: on("outdoor_seating"),
    Q_LIVE_ENTERTAINMENT: on("live_entertainment"),
    Q_SHORT_TERM_RENTAL: on("short_term_rental", "guests_stay_overnight"),
    Q_TOURISM_ACTIVITY:
      on("tourism_activity", "water_activities", "excursions") || p.industry === "Accommodation & Tourism",
    Q_OWNS_PROPERTY: on("owns_property"),
    Q_EXISTING_LEASE:
      on("existing_lease") || (loc !== "" && loc !== "Home-Based Business" && loc !== "Online Only"),
    Q_CHILDREN_PRESENT: on("children_present"),
    Q_PESTICIDES: on("pesticides"),
    Q_AGRICULTURE_PRODUCTION: on("agriculture_production", "food_products_sold") || p.industry === "Agriculture & Farming",
    Q_FIREARMS_SOLD: on("firearms_sold"),
    Q_NONPROFIT_STATUS: on("nonprofit_status"),
    Q_RENOVATIONS: on("renovations"),
    Q_VEHICLE_REPAIR: on("vehicles_repaired", "vehicle_repair"),
  };

  return {
    municipalityName: (p.municipality as string) || null,
    businessTypeName: resolveBusinessTypeName(p.business_type as string),
    answers: a,
  };
}

export function runRulesEngineForProfile(
  profile: ProfileLike,
  answers: Record<string, unknown> = {}
): EngineResult {
  return runRulesEngine(KB, buildEngineInput(profile, answers));
}

// Drop-in replacement for the old hardcoded computeRequirements().
export function computeRequirementsFromKB(
  profile: ProfileLike,
  answers: Record<string, unknown> = {}
): UIRequirement[] {
  const { requirements } = runRulesEngineForProfile(profile, answers);
  return requirements
    .map((r) => ({
      code: LEGACY_CODE[r.document_id] || r.document_id.toLowerCase(),
      name: r.document_name,
      mandatory: !RECOMMENDED.has(r.document_id),
      status: "pending" as const,
      agency: r.agency,
      reason: r.reason,
      document_id: r.document_id,
      category: r.category,
      source_rule: r.source_rule_id,
    }))
    .sort((a, b) => orderIndex(a.document_id!) - orderIndex(b.document_id!));
}
