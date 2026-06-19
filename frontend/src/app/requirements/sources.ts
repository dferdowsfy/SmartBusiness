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
    seedUrl: "https://www.permisos.pr.gov/",
    agencyName: "Oficina de Gerencia de Permisos (OGPe)",
    stateOrTerritory: "PR",
    officialHosts: ["permisos.pr.gov", "www.permisos.pr.gov", "ogpe.pr.gov"],
  },
  {
    seedUrl: "https://www.sbp.pr.gov/",
    agencyName: "Single Business Portal (SBP) — Puerto Rico",
    stateOrTerritory: "PR",
    officialHosts: ["sbp.pr.gov", "www.sbp.pr.gov"],
  },
  { seedUrl: "https://hacienda.pr.gov/", agencyName: "Departamento de Hacienda", stateOrTerritory: "PR", officialHosts: ["hacienda.pr.gov"] },
  { seedUrl: "https://www.estado.pr.gov/", agencyName: "Departamento de Estado", stateOrTerritory: "PR", officialHosts: ["estado.pr.gov", "www.estado.pr.gov"] },
  { seedUrl: "https://www.salud.pr.gov/", agencyName: "Departamento de Salud", stateOrTerritory: "PR", officialHosts: ["salud.pr.gov", "www.salud.pr.gov"] },
  { seedUrl: "https://saluddigital.salud.pr.gov/", agencyName: "Salud Digital", stateOrTerritory: "PR", officialHosts: ["saluddigital.salud.pr.gov", "salud.pr.gov"] },
  { seedUrl: "https://orcps.salud.pr.gov/", agencyName: "ORCPS", stateOrTerritory: "PR", officialHosts: ["orcps.salud.pr.gov", "salud.pr.gov"] },
  { seedUrl: "https://agencias.pr.gov/agencias/bomberos/formularios/Pages/default.aspx", agencyName: "Negociado del Cuerpo de Bomberos", stateOrTerritory: "PR", officialHosts: ["agencias.pr.gov"] },
  { seedUrl: "https://www.drna.pr.gov/", agencyName: "DRNA", stateOrTerritory: "PR", officialHosts: ["drna.pr.gov", "www.drna.pr.gov"] },
  { seedUrl: "https://www.cfse.pr.gov/", agencyName: "CFSE", stateOrTerritory: "PR", officialHosts: ["cfse.pr.gov", "www.cfse.pr.gov"] },
  { seedUrl: "https://portal.crim360.com/", agencyName: "CRIM", stateOrTerritory: "PR", officialHosts: ["portal.crim360.com", "crim360.com"] },
  { seedUrl: "https://app.asume.pr.gov/Patronal", agencyName: "ASUME Patronal", stateOrTerritory: "PR", officialHosts: ["app.asume.pr.gov", "asume.pr.gov"] },
  { seedUrl: "https://tourism.pr.gov/", agencyName: "Puerto Rico Tourism Company", stateOrTerritory: "PR", officialHosts: ["tourism.pr.gov"] },
  { seedUrl: "https://www.pr.gov/", agencyName: "PR.gov", stateOrTerritory: "PR", officialHosts: ["pr.gov", "www.pr.gov"] },
  { seedUrl: "https://www.sanjuan.pr/", agencyName: "Municipio de San Juan", stateOrTerritory: "PR", municipality: "San Juan", officialHosts: ["sanjuan.pr", "www.sanjuan.pr"] },
  { seedUrl: "https://guaynabocity.gov.pr/", agencyName: "Municipio de Guaynabo", stateOrTerritory: "PR", municipality: "Guaynabo", officialHosts: ["guaynabocity.gov.pr", "guaynabo.pr.gov"] },
  { seedUrl: "https://bayamon.pr.gov/", agencyName: "Municipio de Bayamón", stateOrTerritory: "PR", municipality: "Bayamón", officialHosts: ["bayamon.pr.gov"] },
  { seedUrl: "https://carolina.pr.gov/", agencyName: "Municipio de Carolina", stateOrTerritory: "PR", municipality: "Carolina", officialHosts: ["carolina.pr.gov"] },
  { seedUrl: "https://www.ponce.pr.gov/", agencyName: "Municipio de Ponce", stateOrTerritory: "PR", municipality: "Ponce", officialHosts: ["ponce.pr.gov", "www.ponce.pr.gov"] },
  { seedUrl: "https://www.mayaguezpr.gov/", agencyName: "Municipio de Mayagüez", stateOrTerritory: "PR", municipality: "Mayagüez", officialHosts: ["mayaguezpr.gov", "www.mayaguezpr.gov"] },
  { seedUrl: "https://arecibo.pr.gov/", agencyName: "Municipio de Arecibo", stateOrTerritory: "PR", municipality: "Arecibo", officialHosts: ["arecibo.pr.gov"] },
  { seedUrl: "https://caguas.gov.pr/", agencyName: "Municipio de Caguas", stateOrTerritory: "PR", municipality: "Caguas", officialHosts: ["caguas.gov.pr"] },
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
