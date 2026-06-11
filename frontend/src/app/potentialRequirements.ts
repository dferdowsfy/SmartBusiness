// ============================================================================
// Potential (conditional) requirements derived from municipality flags.
//
// These are NOT deterministic rules. They are knowledge-graph relationships:
// a municipality flag suggests a document/agency review MAY apply depending on
// the business's operations. The user confirms applicability (Applies /
// Does Not Apply / Not Sure). Only "Applies" promotes an item to Mandatory.
//
// Rules remain authoritative — nothing here changes the deterministic engine.
// ============================================================================

export interface PotentialDef {
  flag: string;          // municipality flag key
  flagLabel: string;     // human label, e.g. "Island Municipality"
  document: string;      // potential document/review name
  agency: string;        // issuing / reviewing agency
  why: string;           // "Why this may be required"
  followUp: string;      // confirming follow-up question
}

export const POTENTIAL_BY_FLAG: Record<string, PotentialDef> = {
  island: {
    flag: "island",
    flagLabel: "Island Municipality",
    document: "Transportation / Logistics Documentation",
    agency: "Departamento de Transportación y Obras Públicas (DTOP)",
    why:
      "This municipality is classified as an island municipality. Businesses operating from island municipalities may have additional transportation, delivery, shipping, or logistics considerations depending on operations.",
    followUp:
      "Will this business transport goods, equipment, employees, food, materials, or customers to/from the island?",
  },
  coastal: {
    flag: "coastal",
    flagLabel: "Coastal Municipality",
    document: "Coastal / Environmental Zone Review",
    agency: "Departamento de Recursos Naturales y Ambientales (DRNA)",
    why:
      "This municipality lies in a coastal zone. Businesses operating near the maritime-terrestrial zone may require an environmental or coastal review depending on location and activities.",
    followUp:
      "Will this business operate, build, store, or discharge anything near the coast, beach, or maritime-terrestrial zone?",
  },
  tourism: {
    flag: "tourism",
    flagLabel: "Tourism Municipality",
    document: "Tourism Registration",
    agency: "Compañía de Turismo de Puerto Rico",
    why:
      "This municipality is a designated tourism zone. Businesses serving visitors (lodging, tours, experiences, transport) may need to register with the Tourism Company.",
    followUp:
      "Will this business provide lodging, tours, experiences, or services primarily aimed at tourists/visitors?",
  },
  historic: {
    flag: "historic",
    flagLabel: "Historic District Municipality",
    document: "Historic District Review",
    agency: "Instituto de Cultura Puertorriqueña / Oficina Estatal de Conservación Histórica",
    why:
      "This municipality contains a designated historic district. Businesses occupying or altering a property within the historic zone may require a historic-preservation review.",
    followUp:
      "Will this business occupy, renovate, or place signage on a building within the historic district?",
  },
  metro: {
    flag: "metro",
    flagLabel: "Major Metro Municipality",
    document: "Additional Municipal Review",
    agency: "Municipal Permits Office",
    why:
      "This municipality is a major metropolitan area with additional municipal ordinances. Businesses here may face supplementary zoning, traffic, or municipal review depending on size and location.",
    followUp:
      "Will this business have significant foot/vehicle traffic, a large footprint, or operate in a dense commercial zone?",
  },
};

// Potential items for a municipality's flags. Order: most operationally
// impactful first (transport, environmental, then registrations/reviews).
const FLAG_ORDER = ["island", "coastal", "tourism", "historic", "metro"];

export function potentialItemsForFlags(flags: string[]): PotentialDef[] {
  return FLAG_ORDER.filter((f) => flags.includes(f) && POTENTIAL_BY_FLAG[f]).map(
    (f) => POTENTIAL_BY_FLAG[f]
  );
}
