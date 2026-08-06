// CORPREG06 — Application for Registration of a Limited Liability Partnership
// (Solicitud de Registro de una Sociedad de Responsabilidad Limitada).
// NOTE: this is an LLP registration, NOT an LLC Certificate of Organization.
// Fields extracted from the official CORPREG06 PDF (Part 10).
import type { DigitalFormDefinition } from "../../../engine/types.ts";
import { officeAddressFields, t } from "./shared.ts";

export const CORPREG06: DigitalFormDefinition = {
  id: "FORM_PR_DOS_CORPREG06",
  officialFormNumber: "CORPREG06",
  requirementId: "DOC_LLP_REGISTRATION",
  variantKey: "limited_liability_partnership",
  title: t("Application for Registration — Limited Liability Partnership", "Solicitud de Registro — Sociedad de Responsabilidad Limitada"),
  agency: "Puerto Rico Department of State",
  jurisdiction: "pr",
  version: "1.0.0",
  verificationStatus: "extracted_from_official_pdf",
  sourceDocument: "CORPREG06.pdf",
  resultingDocumentName: t("Registration of Limited Liability Partnership issued by the Puerto Rico Department of State", "Registro de Sociedad de Responsabilidad Limitada emitido por el Departamento de Estado de Puerto Rico"),
  submissionMethod: "external_portal",
  officialEvidenceStillRequired: true,
  applicability: [{ field: "business.entityType", operator: "eq", value: "limited_liability_partnership", source: "canonical" }],
  sections: [
    {
      id: "registration_type",
      title: t("Registration type", "Tipo de registro"),
      fields: [
        {
          id: "registration_type",
          label: t("Registration type", "Tipo de registro"),
          type: "radio",
          required: true,
          options: [
            { value: "domestic", label: t("Domestic", "Doméstica") },
            { value: "foreign", label: t("Foreign", "Foránea") },
          ],
        },
      ],
    },
    {
      id: "partnership_identity",
      title: t("Partnership identity", "Identidad de la sociedad"),
      fields: [
        {
          id: "llp_name",
          label: t("LLP legal name", "Nombre legal de la SRL"),
          type: "text",
          required: true,
          canonicalKey: "business.legalName",
          validation: [{ type: "llp_designation" }],
          helpText: t("The name must include the required LLP / SRL designation.", "El nombre debe incluir la designación requerida de LLP / SRL."),
        },
        { id: "jurisdiction", label: t("Jurisdiction under whose laws the partnership is organized", "Jurisdicción bajo cuyas leyes está organizada la sociedad"), type: "text", required: true, canonicalKey: "business.jurisdictionOfFormation" },
        { id: "business_description", label: t("Business description", "Descripción del negocio"), type: "textarea", required: true, canonicalKey: "business.purpose" },
      ],
    },
    {
      id: "principal_place_of_business",
      title: t("Principal place of business", "Lugar principal de negocios"),
      fields: [
        ...officeAddressFields(
          "principal_office",
          { physical: t("Physical address", "Dirección física"), mailing: t("Mailing address", "Dirección postal") },
          { physicalCanonicalKey: "addresses.principalPhysical", mailingCanonicalKey: "addresses.principalMailing" }
        ),
        { id: "principal_office_phone", label: t("Principal-office telephone", "Teléfono de la oficina principal"), type: "phone", required: true, canonicalKey: "business.phone", validation: [{ type: "phone" }] },
      ],
    },
    {
      id: "managing_partner",
      title: t("Managing partner or authorized service-of-process person", "Socio gestor o persona autorizada para recibir emplazamientos"),
      fields: [
        { id: "managing_partner_name", label: t("Full name", "Nombre completo"), type: "text", required: true },
        { id: "managing_partner_role", label: t("Role", "Cargo"), type: "text", required: true },
        { id: "managing_partner_physical", label: t("Physical address", "Dirección física"), type: "address", required: true },
        { id: "managing_partner_mailing_same", label: t("Mailing address same as physical address", "Dirección postal igual a la física"), type: "checkbox" },
        { id: "managing_partner_mailing", label: t("Mailing address", "Dirección postal"), type: "address", visibleWhen: [{ field: "managing_partner_mailing_same", operator: "falsy" }] },
      ],
    },
    {
      id: "partners",
      title: t("Partners", "Socios"),
      fields: [
        {
          id: "partners",
          label: t("Partner", "Socio"),
          type: "repeatable",
          required: true,
          minimumItems: 1,
          partyCollection: "partners",
          subFields: [
            { id: "fullName", label: t("Full name", "Nombre completo"), type: "text", required: true, partyKey: "fullName" },
            { id: "physical", label: t("Physical address", "Dirección física"), type: "address", required: true, partyKey: "physicalAddress" },
            { id: "mailingSameAsPhysical", label: t("Mailing address same as physical address", "Dirección postal igual a la física"), type: "checkbox", partyKey: "mailingSameAsPhysical" },
            { id: "mailing", label: t("Mailing address", "Dirección postal"), type: "address", partyKey: "mailingAddress", visibleWhen: [{ field: "mailingSameAsPhysical", operator: "falsy" }] },
          ],
        },
      ],
    },
    {
      id: "certification",
      title: t("Certification", "Certificación"),
      fields: [
        {
          id: "signatures",
          label: t("Authorized partner", "Socio autorizado"),
          type: "repeatable",
          required: true,
          minimumItems: 1,
          partyCollection: "authorizedSigners",
          subFields: [
            { id: "fullName", label: t("Authorized partner full name", "Nombre completo del socio autorizado"), type: "text", required: true, partyKey: "fullName" },
            { id: "signature", label: t("Signature", "Firma"), type: "signature", partyKey: "signatureStatus" },
          ],
        },
        { id: "attestation_date", label: t("Attestation date", "Fecha de certificación"), type: "date", required: true },
        { id: "entity_email", label: t("Entity email", "Correo electrónico de la entidad"), type: "email", required: true, canonicalKey: "business.email", validation: [{ type: "email" }] },
      ],
    },
  ],
  attachments: [
    {
      id: "partnership_instrument",
      label: t("Certified copy of the applicable partnership instrument (charter, registration instrument, or renewal instrument)", "Copia certificada del instrumento de sociedad aplicable (carta constitutiva, instrumento de registro o instrumento de renovación)"),
      required: true,
    },
  ],
  notices: [
    t(
      "Registration is valid for one year from filing unless withdrawn earlier (per the source form).",
      "El registro es válido por un año desde la presentación a menos que se retire antes (según el formulario oficial)."
    ),
  ],
  feeMetadata: {
    estimatedFeeUsd: 110,
    source: t("Department of State listing supplied with the source package", "Listado del Departamento de Estado provisto con el paquete fuente"),
    revenueCodeNotes: t("See CORPREG06 PDF revenue-code notes; stored separately from the displayed estimate.", "Ver notas de código de rentas del PDF CORPREG06; almacenadas por separado."),
    requiresPortalVerification: true,
  },
};
