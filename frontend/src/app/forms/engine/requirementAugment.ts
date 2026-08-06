// ============================================================================
// Narrow, additive requirement augmentation for entity-type-driven documents.
//
// The pure rules engine keys off municipality / business type / question
// answers and has no concept of entity TYPE. Foreign-corporation authorization
// and LLP registration, however, are driven by the canonical entity type the
// user picks during core intake. Rather than teach the engine a new rule kind
// (a breaking change), we additively inject these two requirements when the
// canonical model calls for them. Existing requirements are never removed or
// reordered — this only appends.
// ============================================================================

import type { CanonicalApplicationData } from "./types.ts";

export interface MinimalRequirement {
  document_id?: string;
  code?: string;
  name?: string;
  agency?: string;
  category?: string;
  mandatory?: boolean;
  reason?: string;
}

interface AugmentDef {
  document_id: string;
  code: string;
  name: string;
  reason: string;
  applies: (c: CanonicalApplicationData) => boolean;
}

const AUGMENTS: AugmentDef[] = [
  {
    document_id: "DOC_FOREIGN_CORPORATION_AUTHORIZATION",
    code: "foreign_corporation_authorization",
    name: "Certificate of Authorization to Do Business (Foreign Corporation)",
    reason: "Entity was formed outside Puerto Rico and must be authorized to do business here.",
    applies: (c) =>
      c.business.formationStatus === "formed_outside_puerto_rico" ||
      c.business.entityType === "foreign_corporation",
  },
  {
    document_id: "DOC_LLP_REGISTRATION",
    code: "llp_registration",
    name: "Limited Liability Partnership Registration",
    reason: "Entity type is a Limited Liability Partnership (SRL), which must register with the Department of State.",
    applies: (c) => c.business.entityType === "limited_liability_partnership",
  },
];

/**
 * Return additive requirements implied by the canonical entity type that are
 * not already present. Callers append these to the rules-engine output.
 */
export function entityTypeRequirements<T extends MinimalRequirement>(
  canonical: CanonicalApplicationData,
  existing: T[],
  make: (def: { document_id: string; code: string; name: string; reason: string }) => T
): T[] {
  const presentDocs = new Set(existing.map((r) => r.document_id).filter(Boolean));
  const out: T[] = [];
  for (const aug of AUGMENTS) {
    if (presentDocs.has(aug.document_id)) continue;
    if (!aug.applies(canonical)) continue;
    out.push(make(aug));
  }
  return out;
}
