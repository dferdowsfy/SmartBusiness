// CORPREG03 — Certificate of Authorization to Do Business, Foreign Corporation.
// Fields extracted from the official CORPREG03 PDF (Part 7).
import type { DigitalFormDefinition } from "../../../engine/types.ts";
import {
  designatedOfficeSection,
  existenceAndEffectiveDateSection,
  residentAgentSection,
  t,
} from "./shared.ts";

export const CORPREG03: DigitalFormDefinition = {
  id: "FORM_PR_DOS_CORPREG03",
  officialFormNumber: "CORPREG03",
  requirementId: "DOC_FOREIGN_CORPORATION_AUTHORIZATION",
  variantKey: "foreign_corporation",
  title: t("Certificate of Authorization to Do Business — Foreign Corporation", "Certificado de Autorización para Hacer Negocios — Corporación Foránea"),
  agency: "Puerto Rico Department of State",
  jurisdiction: "pr",
  version: "1.0.0",
  verificationStatus: "extracted_from_official_pdf",
  sourceDocument: "CORPREG03.pdf",
  resultingDocumentName: t("Certificate of Authorization issued by the Puerto Rico Department of State", "Certificado de Autorización emitido por el Departamento de Estado de Puerto Rico"),
  submissionMethod: "external_portal",
  officialEvidenceStillRequired: true,
  applicability: [{ field: "business.formationStatus", operator: "eq", value: "formed_outside_puerto_rico", source: "canonical" }],
  sections: [
    {
      id: "existing_corporation",
      title: t("Existing corporation", "Corporación existente"),
      fields: [
        { id: "corporation_name", label: t("Existing corporation legal name", "Nombre legal de la corporación existente"), type: "text", required: true, canonicalKey: "business.legalName" },
        { id: "jurisdiction", label: t("Jurisdiction under whose laws it is organized", "Jurisdicción bajo cuyas leyes está organizada"), type: "text", required: true, canonicalKey: "business.jurisdictionOfFormation" },
        { id: "incorporation_date", label: t("Date of incorporation", "Fecha de incorporación"), type: "date", required: true, canonicalKey: "business.incorporationDate" },
        { id: "home_term", label: t("Existing term or duration in the home jurisdiction", "Término o duración existente en la jurisdicción de origen"), type: "text", required: true },
        { id: "domicile_address", label: t("Physical address of corporate domicile", "Dirección física del domicilio corporativo"), type: "address", required: true },
      ],
    },
    { ...designatedOfficeSection(), title: t("Puerto Rico designated office", "Oficina designada en Puerto Rico") },
    { ...residentAgentSection(), title: t("Puerto Rico resident agent", "Agente residente en Puerto Rico") },
    {
      id: "directors_officers",
      title: t("Current directors and officers", "Directores y oficiales actuales"),
      fields: [
        {
          id: "directors_officers",
          label: t("Director / officer", "Director / oficial"),
          type: "repeatable",
          required: true,
          minimumItems: 1,
          partyCollection: "officers",
          subFields: [
            { id: "fullName", label: t("Full name", "Nombre completo"), type: "text", required: true, partyKey: "fullName" },
            {
              id: "role",
              label: t("Role", "Cargo"),
              type: "select",
              required: true,
              partyKey: "role",
              options: [
                { value: "director", label: t("Director", "Director") },
                { value: "officer", label: t("Officer", "Oficial") },
                { value: "director_officer", label: t("Director and officer", "Director y oficial") },
              ],
            },
            { id: "physical", label: t("Usual business physical address", "Dirección física comercial habitual"), type: "address", required: true, partyKey: "physicalAddress" },
            { id: "mailing", label: t("Mailing address (if separately supplied)", "Dirección postal (si se provee por separado)"), type: "address", partyKey: "mailingAddress" },
          ],
        },
      ],
    },
    {
      id: "financial_information",
      title: t("Financial information", "Información financiera"),
      fields: [
        { id: "assets", label: t("Corporation assets", "Activos de la corporación"), type: "currency", required: true },
        { id: "liabilities", label: t("Corporation liabilities", "Pasivos de la corporación"), type: "currency", required: true },
      ],
    },
    {
      id: "proposed_business",
      title: t("Proposed Puerto Rico business", "Negocio propuesto en Puerto Rico"),
      fields: [
        { id: "proposed_business_description", label: t("Description of the business the corporation proposes to conduct in Puerto Rico", "Descripción del negocio que la corporación propone realizar en Puerto Rico"), type: "textarea", required: true, canonicalKey: "business.activityDescription" },
        { id: "authorized_in_home_attestation", label: t("The corporation is authorized to conduct that business in its jurisdiction of incorporation.", "La corporación está autorizada a realizar dicho negocio en su jurisdicción de incorporación."), type: "attestation", required: true },
      ],
    },
    { ...existenceAndEffectiveDateSection(), title: t("Puerto Rico existence and effective date", "Existencia y fecha de vigencia en Puerto Rico") },
    {
      id: "authorized_officer_certification",
      title: t("Authorized officer certification", "Certificación del oficial autorizado"),
      fields: [
        { id: "authorized_officer_name", label: t("Authorized officer full name", "Nombre completo del oficial autorizado"), type: "text", required: true },
        { id: "attestation_date", label: t("Attestation date", "Fecha de certificación"), type: "date", required: true },
        { id: "authorized_officer_signature", label: t("Authorized officer signature", "Firma del oficial autorizado"), type: "signature" },
        { id: "entity_email", label: t("Email", "Correo electrónico"), type: "email", required: true, canonicalKey: "business.email", validation: [{ type: "email" }] },
      ],
    },
    {
      id: "certificate_language",
      title: t("Required attachments", "Documentos requeridos"),
      fields: [
        {
          id: "certificate_foreign_language",
          label: t("Is the certificate of existence written in a language other than English or Spanish?", "¿Está el certificado de existencia escrito en un idioma que no sea inglés o español?"),
          type: "radio",
          required: true,
          options: [
            { value: "yes", label: t("Yes", "Sí") },
            { value: "no", label: t("No", "No") },
          ],
        },
      ],
    },
  ],
  attachments: [
    {
      id: "certificate_of_existence",
      label: t("Certificate of existence / good-standing document from the official custodian in the home jurisdiction", "Certificado de existencia / buena reputación emitido por el custodio oficial de la jurisdicción de origen"),
      required: true,
    },
    {
      id: "translation",
      label: t("Translation of the certificate of existence", "Traducción del certificado de existencia"),
      requiredWhen: [{ field: "certificate_foreign_language", operator: "eq", value: "yes" }],
    },
    {
      id: "translator_declaration",
      label: t("Sworn translator declaration", "Declaración jurada del traductor"),
      requiredWhen: [{ field: "certificate_foreign_language", operator: "eq", value: "yes" }],
    },
  ],
  feeMetadata: {
    estimateByProfit: { for_profit: 150, nonprofit: 5 },
    source: t("Department of State listing supplied with the source package", "Listado del Departamento de Estado provisto con el paquete fuente"),
    revenueCodeNotes: t("Displayed estimate is chosen from business.forProfitStatus; requires portal verification before payment.", "El estimado mostrado se elige según business.forProfitStatus; requiere verificación en el portal antes del pago."),
    requiresPortalVerification: true,
  },
};
