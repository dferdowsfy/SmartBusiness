// SS-4 — Application for Employer Identification Number (IRS, Rev. Dec 2025).
//
// This is the EIN APPLICATION. The CP 575 notice the IRS issues back is
// separate agency evidence the applicant still uploads — see
// ISSUED_DOCUMENT_GUIDANCE.ein_letter.
//
// Only the lines SmartPR's canonical profile can genuinely answer are
// collected here. Line 7b (SSN/ITIN), line 8c and line 9b are deliberately
// absent: the first is a government identifier SmartPR never stores, and the
// other two turn on a federal tax determination for the filer or their CPA
// (see acroformMaps.ts for the full reasoning).
import type { DigitalFormDefinition } from "../../../engine/types.ts";
import { t } from "../../pr/department-of-state/shared.ts";

export const SS4: DigitalFormDefinition = {
  id: "FORM_IRS_SS4",
  officialFormNumber: "SS4",
  requirementId: "DOC_EIN",
  variantKey: "ein_application",
  title: t(
    "Form SS-4 — Application for Employer Identification Number",
    "Formulario SS-4 — Solicitud de Número de Identificación Patronal"
  ),
  agency: "Internal Revenue Service",
  jurisdiction: "federal",
  version: "1.0.0",
  verificationStatus: "extracted_from_official_pdf",
  sourceDocument: "fss4.pdf",
  resultingDocumentName: t(
    "IRS CP 575 EIN confirmation notice",
    "Notificación CP 575 del IRS confirmando el EIN"
  ),
  submissionMethod: "external_portal",
  officialEvidenceStillRequired: true,
  // Every business SmartPR forms needs an EIN, so there is no entity-type gate.
  applicability: [],
  sections: [
    {
      id: "entity_identity",
      title: t("Entity identity", "Identidad de la entidad"),
      fields: [
        {
          id: "legal_name",
          label: t("Legal name of entity", "Nombre legal de la entidad"),
          type: "text",
          required: true,
          canonicalKey: "business.legalName",
          helpText: t("Line 1 — exactly as it appears on the formation document.", "Línea 1 — exactamente como aparece en el documento de organización."),
        },
        {
          id: "trade_name",
          label: t("Trade name of business", "Nombre comercial del negocio"),
          type: "text",
          canonicalKey: "business.tradeName",
          helpText: t("Line 2 — only if different from the legal name.", "Línea 2 — solo si difiere del nombre legal."),
        },
      ],
    },
    {
      id: "addresses",
      title: t("Addresses", "Direcciones"),
      fields: [
        {
          id: "mailing_address",
          label: t("Mailing address", "Dirección postal"),
          type: "address",
          required: true,
          canonicalKey: "addresses.principalMailing",
          helpText: t("Lines 4a–4b. A P.O. box is acceptable here.", "Líneas 4a–4b. Se acepta un apartado postal."),
        },
        {
          id: "street_address",
          label: t("Street address", "Dirección física"),
          type: "address",
          canonicalKey: "addresses.operatingAddress",
          helpText: t("Lines 5a–5b — only if different from the mailing address. No P.O. box.", "Líneas 5a–5b — solo si difiere de la postal. No use apartado postal."),
        },
        {
          id: "principal_location",
          label: t("Municipality where the principal business is located", "Municipio donde ubica el negocio principal"),
          type: "text",
          required: true,
          canonicalKey: "addresses.municipality",
          helpText: t("Line 6 — the form asks for county and state; Puerto Rico uses municipios.", "Línea 6 — el formulario pide condado y estado; Puerto Rico usa municipios."),
        },
      ],
    },
    {
      id: "responsible_party",
      title: t("Responsible party", "Parte responsable"),
      fields: [
        {
          id: "responsible_party_name",
          label: t("Name of responsible party", "Nombre de la parte responsable"),
          type: "text",
          required: true,
          helpText: t(
            "Line 7a. Line 7b asks for that person's SSN/ITIN — SmartPR never stores it; enter it directly on the printed form.",
            "Línea 7a. La línea 7b pide el SSN/ITIN de esa persona — SmartPR nunca lo almacena; escríbalo directamente en el formulario impreso."
          ),
        },
      ],
    },
    {
      id: "business_profile",
      title: t("Business profile", "Perfil del negocio"),
      fields: [
        {
          id: "date_business_started",
          label: t("Date business started or acquired", "Fecha en que comenzó o se adquirió el negocio"),
          type: "date",
          required: true,
          canonicalKey: "business.operationsStartDate",
          helpText: t("Line 11.", "Línea 11."),
        },
        {
          id: "closing_month",
          label: t("Closing month of accounting year", "Mes de cierre del año contable"),
          type: "text",
          canonicalKey: "operations.fiscalYearEnd",
          helpText: t("Line 12 — most calendar-year businesses close in December.", "Línea 12 — la mayoría de los negocios de año natural cierran en diciembre."),
        },
        {
          id: "employee_count",
          label: t("Highest number of employees expected in the next 12 months", "Número máximo de empleados esperados en los próximos 12 meses"),
          type: "number",
          canonicalKey: "operations.employeeCount",
          helpText: t("Line 13 — enter 0 if none are expected.", "Línea 13 — escriba 0 si no espera empleados."),
        },
        {
          id: "principal_activity_line",
          label: t("Principal line of merchandise or services", "Línea principal de mercancía o servicios"),
          type: "textarea",
          required: true,
          canonicalKey: "business.activityDescription",
          helpText: t("Line 17.", "Línea 17."),
        },
      ],
    },
  ],
  notices: [
    t(
      "SmartPR fills the lines your profile answers and leaves the rest blank, including the responsible party's SSN/ITIN and the signature block. Review and complete the form before filing it with the IRS.",
      "SmartPR completa las líneas que su perfil contesta y deja el resto en blanco, incluidos el SSN/ITIN de la parte responsable y el bloque de firma. Revise y complete el formulario antes de presentarlo al IRS."
    ),
  ],
  feeMetadata: {
    estimatedFeeUsd: 0,
    source: t("The IRS charges no fee to apply for an EIN.", "El IRS no cobra por solicitar un EIN."),
    requiresPortalVerification: false,
  },
};
