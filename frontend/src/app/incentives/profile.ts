import type { NormalizedProjectProfile, ProjectFactValue } from "./types";

export interface ExistingSmartPrProfile {
  business_stage?: "new" | "existing" | null;
  municipality?: string | null;
  industry?: string | null;
  business_type?: string | null;
  location_type?: string | null;
  business_structure?: string | null;
  number_of_employees?: number | null;
  products_manufactured?: boolean | null;
  import_export?: boolean | null;
}

/**
 * Reuse only facts the user has actually confirmed in the current intake —
 * both the base profile and any discovery answer already on record. Never
 * ask again for a fact this maps; only genuinely unanswered facts (e.g.
 * renewable-energy investment, Opportunity Zone siting) fall through to a
 * follow-up question in the incentive engine.
 */
export function normalizeProjectProfileForIncentives(
  profile: ExistingSmartPrProfile,
  additionalFacts: Record<string, ProjectFactValue> = {}
): NormalizedProjectProfile {
  const normalized: NormalizedProjectProfile = {
    business_type: profile.business_type ?? null,
    business_stage: profile.business_stage ?? null,
    industry: profile.industry ?? null,
    municipality: profile.municipality ?? null,
    physical_location: profile.location_type ?? null,
    entity_type: profile.business_structure ?? null,
    number_of_employees: profile.number_of_employees ?? null,
    manufacturing_activity: profile.products_manufactured ?? null,
    // Already answered during discovery (Q_IMPORT_EXPORT) — reuse it rather
    // than asking the International Trading Company follow-up question again.
    export_activity: profile.import_export ?? null,
    // The industry itself, already confirmed in intake, already implies these —
    // asking a separate yes/no would just restate a fact SmartPR already has.
    tourism_activity: profile.industry === "Accommodation & Tourism" ? true : null,
    agricultural_activity: profile.industry === "Agriculture & Farming" ? true : null,
  };
  for (const [key, value] of Object.entries(additionalFacts)) {
    normalized[key] = value;
  }
  return normalized;
}
