// ============================================================================
// Official-source registry for the discovery crawler.
//
// We do NOT use paid search APIs. Instead we maintain a curated list of
// authoritative government ENTRY POINTS (agency + municipal portals) and crawl
// outward from them, bounded by depth/page limits and restricted to official
// hosts. Admins can also pass an explicit official seed URL at runtime.
//
// Add hosts here as coverage expands to more municipalities / states.
// ============================================================================

export interface OfficialSource {
  /** Entry-point URL to start crawling from. */
  seedUrl: string;
  agencyName: string;
  stateOrTerritory: string;
  municipality?: string;
  /** Hosts that should be treated as authoritative for this source's crawl. */
  officialHosts: string[];
}

// Generic suffixes always treated as official government domains.
export const OFFICIAL_SUFFIXES = [".gov", ".gov.pr", ".pr.gov"];

// Curated authoritative entry points. URLs are official portals; the crawler
// degrades gracefully (records source_unavailable) if one is unreachable.
export const OFFICIAL_SOURCES: OfficialSource[] = [
  {
    seedUrl: "https://ogpe.pr.gov/",
    agencyName: "Oficina de Gerencia de Permisos (OGPe)",
    stateOrTerritory: "PR",
    officialHosts: ["ogpe.pr.gov"],
  },
  {
    seedUrl: "https://sbp.pr.gov/",
    agencyName: "Single Business Portal (SBP) — Puerto Rico",
    stateOrTerritory: "PR",
    officialHosts: ["sbp.pr.gov"],
  },
  {
    seedUrl: "https://www.sanjuan.pr/",
    agencyName: "Municipio de San Juan",
    stateOrTerritory: "PR",
    municipality: "San Juan",
    officialHosts: ["sanjuan.pr", "www.sanjuan.pr"],
  },
  {
    seedUrl: "https://bayamon.pr.gov/",
    agencyName: "Municipio de Bayamón",
    stateOrTerritory: "PR",
    municipality: "Bayamón",
    officialHosts: ["bayamon.pr.gov"],
  },
  {
    seedUrl: "https://guaynabo.pr.gov/",
    agencyName: "Municipio de Guaynabo",
    stateOrTerritory: "PR",
    municipality: "Guaynabo",
    officialHosts: ["guaynabo.pr.gov"],
  },
];

/** Select registry sources matching a jurisdiction (and optional municipality). */
export function sourcesFor(
  stateOrTerritory: string,
  municipality?: string
): OfficialSource[] {
  return OFFICIAL_SOURCES.filter(
    (s) =>
      s.stateOrTerritory.toUpperCase() === stateOrTerritory.toUpperCase() &&
      (!municipality || !s.municipality || s.municipality.toLowerCase() === municipality.toLowerCase())
  );
}

/** True if `url` is on an official government host (suffix rules + allowlist). */
export function isOfficialHost(url: string, extraHosts: string[] = []): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (extraHosts.some((h) => host === h.toLowerCase() || host.endsWith("." + h.toLowerCase()))) {
      return true;
    }
    return OFFICIAL_SUFFIXES.some((s) => host.endsWith(s));
  } catch {
    return false;
  }
}
