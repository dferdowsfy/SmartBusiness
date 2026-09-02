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
}

/**
 * Reuse only facts the user has actually confirmed in the current intake.
 * Program-specific facts are supplied separately by adaptive questions.
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
  };
  for (const [key, value] of Object.entries(additionalFacts)) {
    normalized[key] = value;
  }
  return normalized;
}
