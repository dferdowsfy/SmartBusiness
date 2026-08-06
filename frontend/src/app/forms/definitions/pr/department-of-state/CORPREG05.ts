// CORPREG05 — Certificate of Incorporation, Professional Corporation.
// Fields extracted from the official CORPREG05 PDF (Part 9).
import type { DigitalFormDefinition } from "../../../engine/types.ts";
import {
  capitalStockSection,
  certificationSection,
  designatedOfficeSection,
  existenceAndEffectiveDateSection,
  incorporatorsSection,
  initialDirectorsSection,
  residentAgentNameOnlySection,
  t,
} from "./shared.ts";

export const CORPREG05: DigitalFormDefinition = {
  id: "FORM_PR_DOS_CORPREG05",
  officialFormNumber: "CORPREG05",
  requirementId: "DOC_CERT_INCORPORATION",
  variantKey: "professional_corporation",
  title: t("Certificate of Incorporation — Professional Corporation", "Certificado de Incorporación — Corporación Profesional"),
  agency: "Puerto Rico Department of State",
  jurisdiction: "pr",
  version: "1.0.0",
  verificationStatus: "extracted_from_official_pdf",
  sourceDocument: "CORPREG05.pdf",
  resultingDocumentName: t("Certificate of Incorporation issued by the Puerto Rico Department of State", "Certificado de Incorporación emitido por el Departamento de Estado de Puerto Rico"),
  submissionMethod: "external_portal",
  officialEvidenceStillRequired: true,
  applicability: [{ field: "business.entityType", operator: "eq", value: "professional_corporation", source: "canonical" }],
  sections: [
    {
      id: "professional_corporation_information",
      title: t("Professional corporation information", "Información de la corporación profesional"),
      fields: [
        {
          id: "corporation_name",
          label: t("Corporation name", "Nombre de la corporación"),
          type: "text",
          required: true,
          canonicalKey: "business.legalName",
          validation: [{ type: "professional_corp_suffix" }],
          helpText: t("The name must contain an accepted professional-corporation abbreviation (e.g. P.S.C.).", "El nombre debe contener una abreviatura de corporación profesional aceptada (p. ej. P.S.C.)."),
        },
        { id: "professional_service", label: t("Exclusive professional service to be provided", "Servicio profesional exclusivo a proveer"), type: "textarea", required: true, canonicalKey: "business.purpose" },
      ],
    },
    designatedOfficeSection(),
    residentAgentNameOnlySection(),
    {
      id: "licensing_attestation",
      title: t("Licensing attestation", "Declaración de licencia"),
      fields: [
        {
          id: "att_incorporators_licensed",
          label: t(
            "All incorporators and shareholders are properly licensed or otherwise legally authorized by Puerto Rico to provide the listed professional service.",
            "Todos los incorporadores y accionistas están debidamente licenciados o legalmente autorizados por Puerto Rico para proveer el servicio profesional indicado."
          ),
          type: "attestation",
          required: true,
        },
      ],
    },
    capitalStockSection(),
    incorporatorsSection(),
    initialDirectorsSection(),
    {
      id: "director_officer_licensing",
      title: t("Director and officer licensing attestation", "Declaración de licencia de directores y oficiales"),
      fields: [
        {
          id: "att_directors_licensed",
          label: t(
            "All directors and officers are properly licensed in Puerto Rico to provide the professional service.",
            "Todos los directores y oficiales están debidamente licenciados en Puerto Rico para proveer el servicio profesional."
          ),
          type: "attestation",
          required: true,
        },
      ],
    },
    existenceAndEffectiveDateSection(),
    certificationSection(),
  ],
  feeMetadata: {
    estimatedFeeUsd: 150,
    source: t("Department of State listing supplied with the source package", "Listado del Departamento de Estado provisto con el paquete fuente"),
    requiresPortalVerification: true,
  },
};
