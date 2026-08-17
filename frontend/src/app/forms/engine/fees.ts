// ============================================================================
// Numeric fee accessor.
//
// The authoritative fee data lives in the centralized submission registry
// (forms/submission/pr.ts); this is the numeric view of it for callers that
// need an amount rather than display text.
//
// Foreign-corporation authorization (CORPREG03) is priced from
// business.forProfitStatus. When that status is unknown this returns null —
// there is no default amount, because picking one would be a guess. Callers
// that must show something should use `getGovernmentFee` and render every
// possible amount.
// ============================================================================

import type { CanonicalApplicationData, DigitalFormDefinition } from "./types.ts";
import { getGovernmentFee } from "../submission/pr.ts";

export function feeEstimateFor(
  def: DigitalFormDefinition,
  canonical: CanonicalApplicationData
): number | null {
  const resolution = getGovernmentFee(def.id, canonical);
  if (!resolution || resolution.status !== "resolved") return null;
  return resolution.amount;
}
