// ============================================================================
// Jurisdiction registry + active-jurisdiction resolver.
//
// The active jurisdiction is selected by the NEXT_PUBLIC_JURISDICTION env var
// (falling back to "pr"). To onboard a new jurisdiction, add its pack to the
// registry below — no other code changes are required.
// ============================================================================

import type { JurisdictionPack } from "./types";
import { puertoRicoPack } from "./pr";

export type { JurisdictionPack, FlagAdvisory, ExtractionHint, LangCode } from "./types";

// All known jurisdiction packs, keyed by their stable slug.
export const JURISDICTION_REGISTRY: Record<string, JurisdictionPack> = {
  pr: puertoRicoPack,
};

const DEFAULT_JURISDICTION_ID = "pr";

// NEXT_PUBLIC_ vars are inlined at build time, so this works on both the
// server and the client without any runtime wiring.
const requestedId = (
  process.env.NEXT_PUBLIC_JURISDICTION || DEFAULT_JURISDICTION_ID
)
  .trim()
  .toLowerCase();

export const ACTIVE_JURISDICTION: JurisdictionPack =
  JURISDICTION_REGISTRY[requestedId] || JURISDICTION_REGISTRY[DEFAULT_JURISDICTION_ID];

export function getJurisdiction(id?: string): JurisdictionPack {
  if (!id) return ACTIVE_JURISDICTION;
  return JURISDICTION_REGISTRY[id.trim().toLowerCase()] || ACTIVE_JURISDICTION;
}

export function listJurisdictions(): { id: string; name: string }[] {
  return Object.values(JURISDICTION_REGISTRY).map((p) => ({
    id: p.meta.id,
    name: p.meta.name,
  }));
}
