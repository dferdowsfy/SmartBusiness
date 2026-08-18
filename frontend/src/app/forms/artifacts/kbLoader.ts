// ============================================================================
// Knowledge-base access for the artifact engine (node-only).
// The KB stays the single source of municipality names — nothing is hardcoded.
// ============================================================================

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const KB_DIR = join(here, "..", "..", "..", "kb");

export interface KbMunicipality {
  id: string;
  name: string;
  flags: string[];
  patente_rate?: number | null;
}

export function loadMunicipalities(): KbMunicipality[] {
  return JSON.parse(readFileSync(join(KB_DIR, "municipalities.json"), "utf8")) as KbMunicipality[];
}
