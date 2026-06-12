// ============================================================================
// Potential (conditional) requirements derived from geo (municipality) flags.
//
// These are NOT deterministic rules. They are advisory relationships: a geo flag
// suggests a document/agency review MAY apply depending on the business's
// operations. The user confirms applicability (Applies / Does Not Apply /
// Not Sure). Only "Applies" promotes an item to Mandatory.
//
// The flag->advisory mapping is jurisdiction-specific and lives in the ACTIVE
// Regulatory Knowledge Pack — this module just reads it. Rules remain
// authoritative; nothing here changes the deterministic engine.
// ============================================================================

import { ACTIVE_JURISDICTION, type FlagAdvisory } from "./jurisdictions";

// Re-exported under the historical name so existing imports keep working.
export type PotentialDef = FlagAdvisory;

export const POTENTIAL_BY_FLAG: Record<string, PotentialDef> =
  ACTIVE_JURISDICTION.flagAdvisories.byFlag;

// Potential items for a set of geo flags, in the jurisdiction's display order.
export function potentialItemsForFlags(flags: string[]): PotentialDef[] {
  return ACTIVE_JURISDICTION.flagAdvisories.order
    .filter((f) => flags.includes(f) && POTENTIAL_BY_FLAG[f])
    .map((f) => POTENTIAL_BY_FLAG[f]);
}
