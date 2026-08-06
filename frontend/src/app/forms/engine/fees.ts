// ============================================================================
// Fee estimate resolution.
//
// Foreign-corporation authorization (CORPREG03) chooses its estimate from
// business.forProfitStatus. All estimates are display-only and require live
// portal verification before any payment — SmartPR never collects an official
// government filing fee without an authorized integration.
// ============================================================================

import type { CanonicalApplicationData, DigitalFormDefinition } from "./types.ts";

export function feeEstimateFor(
  def: DigitalFormDefinition,
  canonical: CanonicalApplicationData
): number | null {
  const meta = def.feeMetadata;
  if (!meta) return null;
  if (typeof meta.estimatedFeeUsd === "number") return meta.estimatedFeeUsd;
  if (meta.estimateByProfit) {
    const profit = canonical.business.forProfitStatus ?? "for_profit";
    const chosen = profit === "nonprofit" ? meta.estimateByProfit.nonprofit : meta.estimateByProfit.for_profit;
    return chosen ?? meta.estimateByProfit.for_profit ?? meta.estimateByProfit.nonprofit ?? null;
  }
  return null;
}
