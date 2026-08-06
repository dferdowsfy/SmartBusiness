// CORPREG04 — Certificate of Incorporation, Close / Intimate Corporation.
// Fields extracted from the official CORPREG04 PDF (Part 8).
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

export const CORPREG04: DigitalFormDefinition = {
  id: "FORM_PR_DOS_CORPREG04",
  officialFormNumber: "CORPREG04",
  requirementId: "DOC_CERT_INCORPORATION",
  variantKey: "close_corporation",
  title: t("Certificate of Incorporation — Close Corporation", "Certificado de Incorporación — Corporación Íntima"),
  agency: "Puerto Rico Department of State",
  jurisdiction: "pr",
  version: "1.0.0",
  verificationStatus: "extracted_from_official_pdf",
  sourceDocument: "CORPREG04.pdf",
  resultingDocumentName: t("Certificate of Incorporation issued by the Puerto Rico Department of State", "Certificado de Incorporación emitido por el Departamento de Estado de Puerto Rico"),
  submissionMethod: "external_portal",
  officialEvidenceStillRequired: true,
  applicability: [{ field: "business.entityType", operator: "eq", value: "close_corporation", source: "canonical" }],
  sections: [
    {
      id: "corporation_information",
      title: t("Corporation information", "Información de la corporación"),
      fields: [
        {
          id: "corporation_name",
          label: t("Corporation name", "Nombre de la corporación"),
          type: "text",
          required: true,
          canonicalKey: "business.legalName",
          validation: [{ type: "corporate_name_suffix" }],
          helpText: t("The name must include an accepted corporate term or abbreviation.", "El nombre debe incluir un término o abreviatura corporativa aceptada."),
        },
        { id: "business_purpose", label: t("Business purpose", "Propósito del negocio"), type: "textarea", required: true, canonicalKey: "business.purpose" },
      ],
    },
    designatedOfficeSection(),
    residentAgentNameOnlySection(),
    capitalStockSection(),
    incorporatorsSection(),
    {
      id: "close_corporation_attestations",
      title: t("Close-corporation attestations", "Declaraciones de corporación íntima"),
      description: t("Acknowledge the provisions stated on the source form.", "Reconozca las disposiciones establecidas en el formulario oficial."),
      fields: [
        { id: "att_75_persons", label: t("Issued stock will be held by no more than 75 persons.", "Las acciones emitidas serán poseídas por no más de 75 personas."), type: "attestation", required: true },
        { id: "att_transfer_restrictions", label: t("Issued stock will be subject to permitted transfer restrictions.", "Las acciones emitidas estarán sujetas a restricciones de transferencia permitidas."), type: "attestation", required: true },
        { id: "att_no_public_offering", label: t("The corporation will not make a public stock offering.", "La corporación no hará una oferta pública de acciones."), type: "attestation", required: true },
      ],
    },
    initialDirectorsSection(),
    existenceAndEffectiveDateSection(),
    certificationSection(),
  ],
  feeMetadata: {
    estimatedFeeUsd: 150,
    source: t("Department of State listing supplied with the source package", "Listado del Departamento de Estado provisto con el paquete fuente"),
    requiresPortalVerification: true,
  },
};
