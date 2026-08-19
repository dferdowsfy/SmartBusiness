// CORPLLC02 — Certificate of Formation of a Limited Liability Company
// (Certificado de Organización de una Compañía de Responsabilidad Limitada).
//
// Sections follow the clause order printed on the official 2-page PDF:
//   PRIMERO  name              SEGUNDO  main office + resident agent
//   TERCERO  purposes          CUARTO   authorized person(s)
//   QUINTO   administrators    SEXTO    term of existence + effective date
//
// The resident agent gets a NAME line only on this form — unlike CORPREG01 it
// prints no separate agent address block, so none is collected.
import type { DigitalFormDefinition } from "../../../engine/types.ts";
import {
  certificationSection,
  existenceAndEffectiveDateSection,
  incorporatorsSection,
  initialDirectorsSection,
  officeAddressFields,
  residentAgentNameOnlySection,
  t,
} from "./shared.ts";

export const CORPLLC02: DigitalFormDefinition = {
  id: "FORM_PR_DOS_CORPLLC02",
  officialFormNumber: "CORPLLC02",
  requirementId: "DOC_ARTICLES_ORGANIZATION",
  variantKey: "limited_liability_company",
  title: t(
    "Certificate of Formation — Limited Liability Company",
    "Certificado de Organización — Compañía de Responsabilidad Limitada"
  ),
  agency: "Puerto Rico Department of State",
  jurisdiction: "pr",
  version: "1.0.0",
  verificationStatus: "extracted_from_official_pdf",
  sourceDocument: "34-CORPLLC02.pdf",
  resultingDocumentName: t(
    "Certificate of Formation issued by the Puerto Rico Department of State",
    "Certificado de Organización emitido por el Departamento de Estado de Puerto Rico"
  ),
  submissionMethod: "external_portal",
  officialEvidenceStillRequired: true,
  applicability: [
    { field: "business.entityType", operator: "eq", value: "limited_liability_company", source: "canonical" },
  ],
  sections: [
    {
      id: "company_information",
      title: t("Company information", "Información de la compañía"),
      fields: [
        {
          id: "llc_name",
          label: t("Limited liability company name", "Nombre de la compañía de responsabilidad limitada"),
          type: "text",
          required: true,
          canonicalKey: "business.legalName",
          helpText: t(
            'The name must include one of: "Limited Liability Company", "L.L.C.", "LLC" — or in Spanish "Compañía de Responsabilidad Limitada", "C.R.L.", "CRL".',
            'El nombre debe incluir uno de: "Compañía de Responsabilidad Limitada", "C.R.L.", "CRL" — o en inglés "Limited Liability Company", "L.L.C.", "LLC".'
          ),
        },
        {
          id: "company_purpose",
          label: t("Nature of the business or purposes", "Naturaleza de los negocios o propósitos"),
          type: "textarea",
          required: true,
          canonicalKey: "business.purpose",
        },
      ],
    },
    {
      id: "main_office",
      title: t("Main office", "Oficina principal"),
      fields: officeAddressFields(
        "main_office",
        {
          physical: t("Main office physical address", "Dirección física de la oficina principal"),
          mailing: t("Main office mailing address", "Dirección postal de la oficina principal"),
        },
        { pr: true, physicalCanonicalKey: "addresses.operatingAddress", mailingCanonicalKey: "addresses.principalMailing" }
      ),
    },
    residentAgentNameOnlySection(),
    // CUARTO on the printed form. SmartPR carries an LLC's authorized persons
    // in the same canonical list a corporation uses for its incorporators.
    incorporatorsSection(),
    // QUINTO — administrators serving until the first annual meeting.
    initialDirectorsSection(),
    existenceAndEffectiveDateSection(),
    // No signerLabel override: that option replaces the perjury attestation
    // sentence, which this form prints verbatim and must keep.
    certificationSection(),
  ],
  feeMetadata: {
    estimatedFeeUsd: 150,
    source: t(
      "Cifra de Ingreso 4391 printed on the official CORPLLC02 PDF",
      "Cifra de Ingreso 4391 impresa en el PDF oficial CORPLLC02"
    ),
    revenueCodeNotes: t(
      "The form prints two revenue codes: 4391 – $150.00 and 4392 – $100.00. Expedited-service surcharges are listed separately on the form.",
      "El formulario imprime dos cifras de ingreso: 4391 – $150.00 y 4392 – $100.00. Los recargos por servicio expedito se listan aparte."
    ),
    requiresPortalVerification: true,
  },
};
