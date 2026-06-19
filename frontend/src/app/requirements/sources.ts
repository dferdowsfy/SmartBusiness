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
  {
    seedUrl: "https://hacienda.pr.gov/planillas-formularios-y-anejos",
    agencyName: "Departamento de Hacienda — Formularios",
    stateOrTerritory: "PR",
    officialHosts: ["hacienda.pr.gov"],
  },
  {
    seedUrl: "https://hacienda.pr.gov/comerciantes",
    agencyName: "Departamento de Hacienda — Comerciantes",
    stateOrTerritory: "PR",
    officialHosts: ["hacienda.pr.gov"],
  },
  {
    seedUrl: "https://www.estado.pr.gov/corporaciones",
    agencyName: "Departamento de Estado — Corporaciones",
    stateOrTerritory: "PR",
    officialHosts: ["estado.pr.gov", "www.estado.pr.gov"],
  },
  {
    seedUrl: "https://www.salud.pr.gov/",
    agencyName: "Departamento de Salud",
    stateOrTerritory: "PR",
    officialHosts: ["salud.pr.gov", "www.salud.pr.gov"],
  },
  {
    seedUrl: "https://saluddigital.salud.pr.gov/",
    agencyName: "Salud Digital",
    stateOrTerritory: "PR",
    officialHosts: ["saluddigital.salud.pr.gov"],
  },
  {
    seedUrl: "https://orcps.salud.pr.gov/",
    agencyName: "ORCPS — Profesionales de la Salud",
    stateOrTerritory: "PR",
    officialHosts: ["orcps.salud.pr.gov"],
  },
  {
    seedUrl: "https://agencias.pr.gov/agencias/bomberos/formularios/Pages/default.aspx",
    agencyName: "Cuerpo de Bomberos — Formularios",
    stateOrTerritory: "PR",
    officialHosts: ["agencias.pr.gov"],
  },
  {
    seedUrl: "https://www.drna.pr.gov/cat/documentos/formularios/",
    agencyName: "DRNA — Formularios",
    stateOrTerritory: "PR",
    officialHosts: ["drna.pr.gov", "www.drna.pr.gov"],
  },
  {
    seedUrl: "https://www.drna.pr.gov/cat/documentos/formularios/perm/",
    agencyName: "DRNA — Permisos",
    stateOrTerritory: "PR",
    officialHosts: ["drna.pr.gov", "www.drna.pr.gov"],
  },
  {
    seedUrl: "https://www.drna.pr.gov/acai/permisos/",
    agencyName: "DRNA — Calidad de Aire",
    stateOrTerritory: "PR",
    officialHosts: ["drna.pr.gov", "www.drna.pr.gov"],
  },
  {
    seedUrl: "https://tourism.pr.gov/home-en/",
    agencyName: "Puerto Rico Tourism Company",
    stateOrTerritory: "PR",
    officialHosts: ["tourism.pr.gov"],
  },
  {
    seedUrl: "https://tourism.pr.gov/doing-business/",
    agencyName: "Puerto Rico Tourism Company — Doing Business",
    stateOrTerritory: "PR",
    officialHosts: ["tourism.pr.gov"],
  },
  {
    seedUrl: "https://portal.crim360.com/",
    agencyName: "CRIM 360",
    stateOrTerritory: "PR",
    officialHosts: ["portal.crim360.com"],
  },
  {
    seedUrl: "https://www.cfse.pr.gov/",
    agencyName: "Corporación del Fondo del Seguro del Estado",
    stateOrTerritory: "PR",
    officialHosts: ["cfse.pr.gov", "www.cfse.pr.gov"],
  },
  {
    seedUrl: "https://app.asume.pr.gov/Patronal",
    agencyName: "ASUME — Certificación Patronal",
    stateOrTerritory: "PR",
    officialHosts: ["app.asume.pr.gov"],
  },
  {
    seedUrl: "https://www.pr.gov/gobierno-digital",
    agencyName: "PR.gov Gobierno Digital",
    stateOrTerritory: "PR",
    officialHosts: ["pr.gov", "www.pr.gov"],
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
