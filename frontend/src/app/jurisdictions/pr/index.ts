// ============================================================================
// Puerto Rico Regulatory Knowledge Pack.
//
// This is the first concrete jurisdiction. Everything Puerto Rico-specific that
// used to be scattered across kb.ts, potentialRequirements.ts, page.tsx, and the
// analyze-document route now lives here as data.
// ============================================================================

import type {
  KnowledgeBase,
  KBMunicipality,
  KBBusinessType,
  KBQuestion,
  KBDocument,
  KBRule,
} from "../../rulesEngine";
import type { JurisdictionPack } from "../types";
import type { RateFact, RequirementGuidanceMap } from "../../requirementGuidance";

import municipalitiesJson from "../../../kb/municipalities.json";
import businessTypesJson from "../../../kb/business_types.json";
import questionsJson from "../../../kb/questions.json";
import documentsJson from "../../../kb/documents.json";
import rulesJson from "../../../kb/rules.json";

const kb: KnowledgeBase = {
  municipalities: municipalitiesJson as KBMunicipality[],
  businessTypes: businessTypesJson as KBBusinessType[],
  questions: questionsJson as KBQuestion[],
  documents: documentsJson as KBDocument[],
  rules: rulesJson as KBRule[],
  extensions: {
    // DOC_ROOM_TAX_RETURN is a RECURRING obligation, distinct from the
    // one-time DOC_TOURISM_REGISTRATION (Innkeeper) registration that
    // unlocks it — see requirementGuidance below and compliance/server.ts's
    // renewal lookup, which reads this array.
    renewals: [
      { document_id: "DOC_ROOM_TAX_RETURN", frequency_months: 1, citation: "Act 272-2003 (Room Occupancy Tax), 13 L.P.R.A. § 10001 et seq." },
    ],
  },
};

// The room-tax RATE is a fact that can change by legislation — modeled
// explicitly (never hardcoded into a sentence) so a future change is one
// edit here, with its own source/effective-date/supersededBy trail. Do not
// apply a proposed bill's rate until it is actually enacted and in effect.
const ROOM_TAX_RATE: RateFact = {
  rate: "7%",
  basis: "of the room rate charged per night",
  source: "Puerto Rico Tourism Company — Room Tax Division public guidance",
  effectiveDate: null,
  lastVerified: "September 2026",
  supersededBy: null,
};

const strPropertyTypeLabel = (value: unknown, es: boolean): string => {
  if (value === "apartment") return es ? "apartamento" : "apartment";
  if (value === "house") return es ? "casa" : "house";
  return es ? "propiedad" : "property";
};

// Hand-written, fact-interpolated explanations for the requirements this
// product currently gives full-depth treatment: the Short-Term Rental /
// Airbnb archetype. Every other document falls back to the generic,
// still-structured explanation in requirementGuidance.ts.
const requirementGuidance: RequirementGuidanceMap = {
  DOC_TOURISM_REGISTRATION: (req, ctx) => {
    const es = ctx.language === "es";
    const isSTR = ctx.discoveryAnswers.short_term_rental === true
      || /airbnb|short.?term rental|vacation rental|vrbo/i.test(ctx.businessTypeName || "");
    if (!isSTR) {
      return {
        summary: req.reason,
        whyThisApplies: es
          ? `Tu negocio en ${ctx.municipality || "este municipio"} atiende a turistas o visitantes, por lo que Puerto Rico requiere registro con la Compañía de Turismo.`
          : `Your business in ${ctx.municipality || "this municipality"} serves tourists or visitors, so Puerto Rico requires registration with the Tourism Company.`,
        whatThisIs: es
          ? "Este registro identifica tu negocio ante la Compañía de Turismo de Puerto Rico."
          : "This registration identifies your business with the Puerto Rico Tourism Company.",
        whatYouNeedToDo: es
          ? "Completa el registro de turismo. SmartPR usará la información de tu negocio que ya tenemos."
          : "Complete the tourism registration. SmartPR will use the business information we already have.",
        whatHappensNext: es
          ? "Una vez registrado, tu número de registro pasa a formar parte de tu expediente de cumplimiento."
          : "Once registered, your registration number becomes part of your compliance record.",
        triggeredBy: [ctx.businessTypeName, ctx.municipality].filter((v): v is string => Boolean(v)),
        satisfiesOrUnlocks: [],
        sourceReferences: [{ agency: "Compañía de Turismo de Puerto Rico", citation: "Ley de la Compañía de Turismo de Puerto Rico" }],
        lastVerified: "September 2026",
      };
    }
    const property = strPropertyTypeLabel(ctx.discoveryAnswers.str_property_type, es);
    const municipality = ctx.municipality || (es ? "tu municipio" : "your municipality");
    const hasExisting = ctx.discoveryAnswers.str_existing_innkeeper_id === "yes";
    const triggeredBy = [
      es ? "Alquiler a corto plazo" : "Short-term rental",
      es ? "Estadías ≤ 90 días" : "Stays ≤ 90 days",
      ctx.municipality,
    ].filter((v): v is string => Boolean(v));

    return {
      summary: req.reason,
      whyThisApplies: es
        ? `Vas a alquilar tu propiedad tipo ${property} en ${municipality} a huéspedes por estadías de 90 días o menos. Puerto Rico clasifica esto como alquiler a corto plazo, lo que requiere registro con la División de Impuesto de Habitación de la Compañía de Turismo.`
        : `You're renting ${/^[aeiou]/i.test(property) ? "an" : "a"} ${property} in ${municipality} to guests for stays of less than 90 days. Puerto Rico classifies this as a short-term rental, which requires registration with the Puerto Rico Tourism Company's Room Tax Division.`,
      whatThisIs: hasExisting
        ? (es
          ? "Ya nos dijiste que tienes un número de Innkeeper de la Compañía de Turismo para esta propiedad — solo confirmaremos que sigue vigente, no se inicia un registro nuevo."
          : "You told us you already have a Tourism Company Innkeeper ID for this property — SmartPR will confirm it rather than starting a new registration.")
        : (es
          ? "Tu Innkeeper ID (también llamado Registro de Turismo) te identifica como operador de hospedaje a corto plazo ante la Compañía de Turismo, para fines del Impuesto de Habitación."
          : "Your Innkeeper ID (also shown on this form as your Tourism Registration) identifies you as a short-term lodging operator with the Tourism Company, for Room Tax purposes."),
      whatYouNeedToDo: hasExisting
        ? (es ? "Confirma tu número de Innkeeper existente — SmartPR no te pedirá registrarte de nuevo." : "Confirm your existing Innkeeper number — SmartPR won't ask you to register again.")
        : (es
          ? "Completa el Registro de Innkeeper. SmartPR usará la información de la propiedad y del operador que ya nos diste."
          : "Complete your Innkeeper Registration. SmartPR will use the property and operator information you've already provided."),
      whatHappensNext: es
        ? "Una vez registrado, tu Innkeeper ID pasa a formar parte de tu expediente y SmartPR comenzará a rastrear tu declaración mensual del Impuesto de Habitación."
        : "Once registered, your Innkeeper ID becomes part of your operating record, and SmartPR will start tracking your recurring monthly Room Tax filing.",
      triggeredBy,
      satisfiesOrUnlocks: [es ? "Necesario antes de la declaración mensual del Impuesto de Habitación" : "Needed before the monthly Room Tax return can start"],
      sourceReferences: [{ agency: "Puerto Rico Tourism Company", citation: "Act 272-2003 (Room Tax) — Room Tax Division" }],
      lastVerified: "September 2026",
    };
  },

  DOC_ROOM_TAX_RETURN: (_req, ctx) => {
    const es = ctx.language === "es";
    return {
      summary: es ? "Declaración mensual del Impuesto de Habitación." : "Monthly Room Tax return.",
      whyThisApplies: es
        ? `Tu alquiler a corto plazo en ${ctx.municipality || "Puerto Rico"} genera ingresos de hospedaje sujetos al Impuesto de Habitación de Puerto Rico.`
        : `Your short-term rental in ${ctx.municipality || "Puerto Rico"} earns lodging income subject to Puerto Rico's room occupancy tax.`,
      whatThisIs: es
        ? `Puerto Rico requiere que los alquileres a corto plazo cobren un impuesto de habitación equivalente al ${ROOM_TAX_RATE.rate} de la tarifa por noche y presenten una declaración mensual, a más tardar el día 10 del mes siguiente.`
        : `Puerto Rico requires short-term rentals to collect a room occupancy tax equal to ${ROOM_TAX_RATE.rate} of the nightly room rate and submit a monthly return, due by the 10th day of the following month.`,
      whatYouNeedToDo: es
        ? "Esto es cumplimiento recurrente, no una preparación única — aparecerá en tu calendario de cumplimiento una vez que tu Innkeeper ID esté activo."
        : "This is recurring compliance, not a one-time setup step — it will appear on your compliance calendar once your Innkeeper ID is active.",
      whatHappensNext: es
        ? "SmartPR te recordará cada ciclo mensual conforme se acerque la fecha límite."
        : "SmartPR will remind you each monthly cycle as the deadline approaches.",
      triggeredBy: [es ? "Alquiler a corto plazo" : "Short-term rental", ctx.municipality].filter((v): v is string => Boolean(v)),
      satisfiesOrUnlocks: [],
      sourceReferences: [
        { agency: "Puerto Rico Tourism Company", citation: `Act 272-2003 (Room Tax) — current rate ${ROOM_TAX_RATE.rate} ${ROOM_TAX_RATE.basis}, per ${ROOM_TAX_RATE.source}` },
      ],
      lastVerified: ROOM_TAX_RATE.lastVerified,
    };
  },

  DOC_HOA_AUTHORIZATION: (_req, ctx) => {
    const es = ctx.language === "es";
    return {
      summary: es ? "Autorización de condominio / asociación de residentes." : "Condo / HOA authorization.",
      whyThisApplies: es
        ? "Nos dijiste que la propiedad es parte de un condominio o asociación de residentes. Algunas asociaciones restringen o prohíben el alquiler a corto plazo, así que SmartPR necesita evidencia de que está permitido en tu caso."
        : "You told us the property is part of a condominium or residential association. Some associations restrict or prohibit short-term rentals, so SmartPR needs evidence that it's permitted here.",
      whatThisIs: es
        ? "No es un formulario gubernamental — es prueba (reglamento del condominio, estatutos o una carta de autorización) de que la operación cumple con las reglas de tu comunidad residencial."
        : "This isn't a government form — it's evidence (your condo/HOA rules, bylaws, or an authorization letter) that your operation complies with the rules governing your residential complex.",
      whatYouNeedToDo: es
        ? "Sube el reglamento de tu condominio/asociación o una carta de autorización. SmartPR lo revisará por restricciones de alquiler a corto plazo."
        : "Upload your condo/HOA rules or an authorization letter. SmartPR will review the document for short-term-rental restrictions.",
      whatHappensNext: es
        ? "Esto queda como evidencia de respaldo junto a tu registro de Turismo — no bloquea el registro, pero forma parte de tu expediente de cumplimiento."
        : "This is kept as supporting evidence alongside your Tourism registration — it doesn't block registration, but it's part of your compliance record.",
      triggeredBy: [es ? "Propiedad en condominio / HOA" : "Condominium / HOA property", es ? "Alquiler a corto plazo" : "Short-term rental"],
      satisfiesOrUnlocks: [],
      sourceReferences: [{ agency: es ? "Reglamento de tu condominio / asociación" : "Your condo / HOA's own governing rules", citation: es ? "Ley de Condominios de Puerto Rico" : "Puerto Rico Condominium Act" }],
      lastVerified: null,
    };
  },
};

export const puertoRicoPack: JurisdictionPack = {
  meta: {
    id: "pr",
    name: "Puerto Rico",
    productName: "SmartPR",
    tagline: "Puerto Rico Business Licensing Readiness",
    defaultLanguage: "en",
    languages: ["en", "es"],
  },

  geo: {
    subdivisionLabel: "Municipality",
    subdivisionLabelPlural: "Municipalities",
  },

  kb,

  docMappings: {
    // Map KB document ids to the app's legacy requirement codes so existing
    // behavior (upload matching, submission filename ordering) is preserved.
    legacyCode: {
      DOC_CERT_INCORPORATION: "certificate_of_incorporation",
      DOC_FOREIGN_CORPORATION_AUTHORIZATION: "foreign_corporation_authorization",
      DOC_LLP_REGISTRATION: "llp_registration",
      DOC_EIN: "ein_letter",
      DOC_MERCHANT_REGISTRATION: "merchant_registration",
      DOC_PERMISO_UNICO: "permiso_unico",
      DOC_PATENTE_MUNICIPAL: "patente_municipal",
      DOC_HEALTH_PERMIT: "health_permit",
      DOC_FIRE_CERT: "fire_certification",
      DOC_CFPM: "food_manager_cert",
      DOC_ALCOHOL_LICENSE: "alcohol_permit",
      DOC_LEASE_AGREEMENT: "lease_or_property_docs",
      DOC_CONTRACTOR_LICENSE: "contractor_license",
      DOC_CRIM_CLEARANCE: "crim_clearance",
      DOC_PROFESSIONAL_LICENSE: "professional_licenses",
      DOC_ENVIRONMENTAL_PERMIT: "environmental_permit",
      DOC_TRANSPORT_PERMIT: "transportation_permit",
      DOC_TOURISM_REGISTRATION: "tourism_registration",
      DOC_SIGN_PERMIT: "sign_permit",
      DOC_OUTDOOR_SEATING_AUTH: "outdoor_seating_auth",
      DOC_ENTERTAINMENT_PERMIT: "entertainment_permit",
      DOC_IMPORT_EXPORT_REG: "import_export_reg",
      DOC_HOME_DECLARATION: "home_declaration",
      DOC_HOA_AUTHORIZATION: "hoa_authorization",
      DOC_ROOM_TAX_RETURN: "room_tax_return",
    },
    recommended: [
      "DOC_INSURANCE",
      "DOC_CRIM_CLEARANCE",
      "DOC_SIGN_PERMIT",
      "DOC_OUTDOOR_SEATING_AUTH",
      "DOC_ENTERTAINMENT_PERMIT",
      "DOC_FLOOR_PLANS",
      "DOC_DBA_REGISTRATION",
    ],
    order: [
      "DOC_CERT_INCORPORATION",
      "DOC_ARTICLES_ORGANIZATION",
      "DOC_EIN",
      "DOC_MERCHANT_REGISTRATION",
      "DOC_SURI_REGISTRATION",
      "DOC_PERMISO_UNICO",
      "DOC_ZONING",
      "DOC_PATENTE_MUNICIPAL",
      "DOC_MUNICIPAL_REGISTRATION",
      "DOC_MUNICIPAL_TAX_COMPLIANCE",
      "DOC_HEALTH_PERMIT",
      "DOC_FIRE_CERT",
      "DOC_CFPM",
      "DOC_ALCOHOL_LICENSE",
      "DOC_PROFESSIONAL_LICENSE",
      "DOC_CONTRACTOR_LICENSE",
      "DOC_TOURISM_REGISTRATION",
      "DOC_HOA_AUTHORIZATION",
      "DOC_ROOM_TAX_RETURN",
    ],
  },

  flagAdvisories: {
    order: ["island", "coastal", "tourism", "historic", "metro", "capital", "industrial_port", "airport_host"],
    byFlag: {
      island: {
        flag: "island",
        flagLabel: "Island Municipality",
        document: "ATM Ferry Logistics + Island Waste Management",
        agency: "Autoridad de Transporte Marítimo (ATM) + Municipal Solid Waste",
        why:
          "Vieques and Culebra depend on Autoridad de Transporte Marítimo (ATM) ferry service for inventory, staff, and customer access, and have limited island landfill capacity. Hospitality, F&B, retail, and tour operators here typically need an ATM ferry-logistics manifest and a commercial waste-collection contract.",
        followUp:
          "Will this business transport goods, equipment, employees, food, materials, or customers to/from the island, or generate regular commercial waste?",
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
        agency:
          "Instituto de Cultura Puertorriqueña / Oficina Estatal de Conservación Histórica",
        why:
          "This municipality contains a designated historic district. Hospitality, F&B, retail, and personal-care businesses operating in the historic zone face additional review: facade preservation, structural/interior alteration approval, and stricter signage variances distinct from a regular sign permit.",
        followUp:
          "Will this business occupy, renovate, alter the interior, or place signage on a building within the historic district?",
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
      capital: {
        flag: "capital",
        flagLabel: "Capital City (San Juan)",
        document: "San Juan-Specific Municipal Review",
        agency: "Municipio Autónomo de San Juan",
        why:
          "San Juan applies city-specific ordinances on top of the standard metro requirements (Old San Juan facade preservation, stricter noise ordinance, dedicated loading zones, San Juan Municipal Use Permit).",
        followUp:
          "Will this business operate in San Juan? It may need additional San Juan-specific permits beyond the standard metro requirements.",
      },
      industrial_port: {
        flag: "industrial_port",
        flagLabel: "Industrial / Port Corridor",
        document: "Heavy Industry & Port Compliance",
        agency: "Autoridad de los Puertos + EPA / Junta de Calidad Ambiental",
        why:
          "Ponce, Cataño, Guayanilla, Salinas, and Yabucoa sit along Puerto Rico's heavy-industry / port corridor. Manufacturing, logistics, and waste-handling businesses here face EPA/JCA point-source discharge (NPDES industrial), RCRA hazardous-waste handler registration, Title V air emissions, and Port Authority docking authorization — obligations that don't apply to ordinary coastal towns.",
        followUp:
          "Does this business manufacture, store hazardous materials, generate point-source discharge, or operate at or near a port facility?",
      },
      airport_host: {
        flag: "airport_host",
        flagLabel: "Airport-Host Municipality",
        document: "Airport-Adjacent Federal Compliance",
        agency: "U.S. Customs and Border Protection + TSA + Aerostar / Autoridad de los Puertos",
        why:
          "Carolina (LMM/SJU), Aguadilla (BQN), and Ponce (Mercedita) host customs-active airports. Air-cargo logistics, freight forwarding, importers, and airport-area car rentals face CBP customs brokerage bonds, TSA Known Shipper / Indirect Air Carrier certification, and airport-area concession agreements that don't apply elsewhere.",
        followUp:
          "Does this business ship cargo by air, clear customs, or operate as a concession in or directly adjacent to the airport?",
      },
    },
  },

  intakeCompat: {
    // Reverse of buildEngineInput()'s translation table: the wizard answer key
    // each KB question corresponds to. Kept 1:1 so snapshot-driven discovery
    // questions keep writing the same profile fields the engine already reads.
    uiKeyByQuestionId: {
      Q_FOOD_PREPARED: "food_prepared_on_site",
      Q_FOOD_SOLD: "food_sold",
      Q_FOOD_SERVED: "food_served",
      Q_ALCOHOL_SOLD: "alcohol_sold",
      Q_ALCOHOL_SERVED: "alcohol_served",
      Q_HEALTHCARE_SERVICES: "healthcare_services",
      Q_CONTROLLED_SUBSTANCES: "controlled_substances",
      Q_MEDICAL_WASTE: "medical_waste",
      Q_BIOHAZARD_WASTE: "biohazard_waste",
      Q_EMPLOYEES_HIRED: "employees_work_on_site",
      Q_COMMERCIAL_VEHICLES: "commercial_vehicles",
      Q_HAZARDOUS_MATERIALS: "hazardous_materials",
      Q_HAZARDOUS_FLUIDS: "hazardous_fluids",
      Q_CHEMICALS_USED: "chemicals_used",
      Q_PRODUCTS_MANUFACTURED: "products_manufactured",
      Q_IMPORT_EXPORT: "import_export",
      Q_PROFESSIONAL_LICENSES: "professional_licenses_required",
      Q_COMMERCIAL_SIGNAGE: "commercial_signage",
      Q_OUTDOOR_SEATING: "outdoor_seating",
      Q_LIVE_ENTERTAINMENT: "live_entertainment",
      Q_SHORT_TERM_RENTAL: "short_term_rental",
      Q_TOURISM_ACTIVITY: "tourism_activity",
      Q_OWNS_PROPERTY: "owns_property",
      Q_EXISTING_LEASE: "existing_lease",
      Q_CHILDREN_PRESENT: "children_present",
      Q_PESTICIDES: "pesticides",
      Q_AGRICULTURE_PRODUCTION: "agriculture_production",
      Q_FIREARMS_SOLD: "firearms_sold",
      Q_NONPROFIT_STATUS: "nonprofit_status",
      Q_RENOVATIONS: "renovations",
      Q_VEHICLE_REPAIR: "vehicles_repaired",
    },
    profileStageQuestionIds: [
      "Q_BUSINESS_STRUCTURE",
      "Q_PHYSICAL_LOCATION",
      "Q_HOME_BASED",
      "Q_ONLINE_ONLY",
      "Q_LOCATION_TYPE",
    ],
  },

  documentIntelligence: {
    analystSubject: "Puerto Rico business licensing",
    documentClasses: [
      "Certificate of Incorporation",
      "Articles of Organization",
      "IRS EIN Letter",
      "Merchant Registration Certificate",
      "Permiso Único",
      "Patente Municipal",
      "Health Permit",
      "Fire Certification",
      "CFPM Certificate",
      "Professional License",
      "Contractor License",
      "Tourism Registration",
      "Lease Agreement",
      "Property Deed",
      "Floor Plan",
      "Insurance Certificate",
      "Workers Compensation Certificate",
      "Medical Waste Contract",
      "Alcohol Permit",
      "Environmental Permit",
      "Sign Permit",
      "Background Check Documentation",
      "Business Address Documentation",
      "Unknown",
    ],
    extractionHints: [
      {
        match: ["ein"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (EIN Letter):
- Treat the provided text as OCR output from an official IRS EIN confirmation letter.
- Specifically hunt for and extract the 9-digit Employer Identification Number (EIN). It usually appears as XX-XXXXXXX (e.g. 66-1234567).
- Prioritize placing the clean EIN into "license_or_permit_number".
- Also extract business_name / entity_name exactly as shown.
- Validation checks MUST include "EIN Format Valid", "EIN Found", "Business Name Match".
- If no properly formatted EIN is present, set overall_status to "Missing Information" or "Needs Review".`,
      },
      {
        match: ["health", "sanitary"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (Health / Sanitary Permit):
- Treat the provided text as OCR from a Departamento de Salud Health Permit.
- Extract the permit number, facility name, expiration date, and any "uso"/classification.
- Place the permit number in "permit_number".
- Validation checks MUST include "Health Permit Number Found", "Not Expired", "Facility Name Match".`,
      },
      {
        match: ["fire", "bombero"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (Fire Certification):
- Treat the provided text as OCR from a Certificado de Bomberos / Fire Safety document.
- Extract the certificate number, business name, and expiration.
- Place certificate number in "license_or_permit_number".
- Validation checks MUST include "Fire Certificate Number Found", "Not Expired".`,
      },
      {
        match: ["permiso", "unico"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (Permiso Único):
- Treat the provided text as OCR from an official OGPe Permiso Único.
- Extract permit number, business name, address, expiration, and use classification.
- Place permit number in "permit_number".
- Validation checks MUST include "Permit Number Found", "Address Match", "Permit Active".`,
      },
      {
        match: ["merchant", "registro"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (Merchant Registration):
- Treat the provided text as OCR from Hacienda Registro de Comerciante / Merchant Certificate.
- Extract the Merchant Number (often SURI-related), business name, and address.
- Place merchant number in "merchant_number".
- Validation checks MUST include "Merchant Number Extracted", "Merchant Registration Found".`,
      },
      {
        match: ["patente"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (Patente Municipal):
- Extract the municipal account / patente number, municipality name, and business name.
- Place the account number in "license_or_permit_number".`,
      },
      {
        match: ["lease"],
        instructions: `SPECIALIZED INSTRUCTIONS FOR THIS UPLOAD (Lease Agreement):
- Extract tenant name, property address, lease start/end dates, landlord.
- Validate that the tenant roughly matches the business context.`,
      },
    ],
  },

  requirementGuidance,
};
