// CORPREG01 — Certificate of Incorporation, Stock Corporation.
// Fields extracted from the official CORPREG01 PDF (Part 5).
import type { DigitalFormDefinition } from "../../../engine/types.ts";
import {
  capitalStockSection,
  certificationSection,
  designatedOfficeSection,
  existenceAndEffectiveDateSection,
  incorporatorsSection,
  initialDirectorsSection,
  residentAgentSection,
  t,
} from "./shared.ts";

export const CORPREG01: DigitalFormDefinition = {
  id: "FORM_PR_DOS_CORPREG01",
  officialFormNumber: "CORPREG01",
  requirementId: "DOC_CERT_INCORPORATION",
  variantKey: "stock_corporation",
  title: t("Certificate of Incorporation — Stock Corporation", "Certificado de Incorporación — Corporación con Acciones"),
  agency: "Puerto Rico Department of State",
  jurisdiction: "pr",
  version: "1.0.0",
  verificationStatus: "extracted_from_official_pdf",
  sourceDocument: "CORPREG01.pdf",
  resultingDocumentName: t("Certificate of Incorporation issued by the Puerto Rico Department of State", "Certificado de Incorporación emitido por el Departamento de Estado de Puerto Rico"),
  submissionMethod: "external_portal",
  officialEvidenceStillRequired: true,
  applicability: [{ field: "business.entityType", operator: "eq", value: "stock_corporation", source: "canonical" }],
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
          helpText: t("The name must include an accepted corporate term or abbreviation (e.g. Inc., Corp., Corporation).", "El nombre debe incluir un término o abreviatura corporativa aceptada (p. ej. Inc., Corp.)."),
        },
        { id: "corporation_purpose", label: t("Corporation purpose", "Propósito de la corporación"), type: "textarea", required: true, canonicalKey: "business.purpose" },
      ],
    },
    designatedOfficeSection(),
    residentAgentSection(),
    capitalStockSection({ includeBoardResolution: true }),
    incorporatorsSection(),
    initialDirectorsSection(),
    existenceAndEffectiveDateSection(),
    certificationSection(),
  ],
  feeMetadata: {
    estimatedFeeUsd: 150,
    source: t("Department of State listing supplied with the source package", "Listado del Departamento de Estado provisto con el paquete fuente"),
    revenueCodeNotes: t("See CORPREG01 PDF revenue-code notes; stored separately from the displayed estimate.", "Ver notas de código de rentas del PDF CORPREG01; almacenadas por separado."),
    requiresPortalVerification: true,
  },
};
