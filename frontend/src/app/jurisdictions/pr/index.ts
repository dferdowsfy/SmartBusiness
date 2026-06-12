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
    ],
  },

  flagAdvisories: {
    order: ["island", "coastal", "tourism", "historic", "metro"],
    byFlag: {
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
        agency:
          "Instituto de Cultura Puertorriqueña / Oficina Estatal de Conservación Histórica",
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
    },
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
};
