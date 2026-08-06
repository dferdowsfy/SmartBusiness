// CORPREG02 — Certificate of Incorporation, Nonprofit Non-Stock Corporation.
// Fields extracted from the official CORPREG02 PDF (Part 6), including the
// additional nonprofit category page.
import type { DigitalFormDefinition } from "../../../engine/types.ts";
import {
  certificationSection,
  designatedOfficeSection,
  existenceAndEffectiveDateSection,
  incorporatorsSection,
  initialDirectorsSection,
  residentAgentSection,
  t,
} from "./shared.ts";

const SERVICE_CATEGORIES = [
  ["social_services", "Social Services", "Servicios sociales"],
  ["environmental_services", "Environmental Services", "Servicios ambientales"],
  ["legal_rights_defense", "Legal Services and Rights Defense", "Servicios legales y defensa de derechos"],
  ["economic_community_dev", "Economic, Social and Community Development", "Desarrollo económico, social y comunitario"],
  ["educational_research", "Educational and Research Services", "Servicios educativos y de investigación"],
  ["donation", "Donation", "Donación"],
  ["health_services", "Health Services", "Servicios de salud"],
  ["international_activities", "International Activities", "Actividades internacionales"],
  ["art_culture", "Art and Culture", "Arte y cultura"],
  ["religious_services", "Religious Services", "Servicios religiosos"],
  ["recreation_sports", "Recreation and Sports Services", "Servicios de recreación y deportes"],
  ["institutional_services", "Institutional Services", "Servicios institucionales"],
  ["housing_services", "Housing Services", "Servicios de vivienda"],
  ["other_services", "Other Services", "Otros servicios"],
] as const;

const ORG_FORM_CATEGORIES = [
  ["professional_organization", "Professional Organization", "Organización profesional"],
  ["social_club", "Social Club", "Club social"],
  ["civic_organization", "Civic Organization", "Organización cívica"],
  ["religious_organization", "Religious Organization", "Organización religiosa"],
  ["foundation", "Foundation", "Fundación"],
  ["community_based", "Community-Based Organization", "Organización de base comunitaria"],
  ["philanthropic", "Philanthropic Organization", "Organización filantrópica"],
  ["institutional_services", "Institutional Services", "Servicios institucionales"],
] as const;

export const CORPREG02: DigitalFormDefinition = {
  id: "FORM_PR_DOS_CORPREG02",
  officialFormNumber: "CORPREG02",
  requirementId: "DOC_CERT_INCORPORATION",
  variantKey: "nonprofit_nonstock_corporation",
  title: t("Certificate of Incorporation — Nonprofit Non-Stock Corporation", "Certificado de Incorporación — Corporación Sin Fines de Lucro Sin Acciones"),
  agency: "Puerto Rico Department of State",
  jurisdiction: "pr",
  version: "1.0.0",
  verificationStatus: "extracted_from_official_pdf",
  sourceDocument: "CORPREG02.pdf",
  resultingDocumentName: t("Certificate of Incorporation issued by the Puerto Rico Department of State", "Certificado de Incorporación emitido por el Departamento de Estado de Puerto Rico"),
  submissionMethod: "external_portal",
  officialEvidenceStillRequired: true,
  applicability: [{ field: "business.entityType", operator: "eq", value: "nonprofit_nonstock_corporation", source: "canonical" }],
  sections: [
    {
      id: "corporation_information",
      title: t("Corporation information", "Información de la corporación"),
      fields: [
        { id: "corporation_name", label: t("Corporation name", "Nombre de la corporación"), type: "text", required: true, canonicalKey: "business.legalName" },
        { id: "nonprofit_purpose", label: t("Nonprofit purpose", "Propósito sin fines de lucro"), type: "textarea", required: true, canonicalKey: "business.purpose" },
        {
          id: "no_stock_ack",
          type: "statutory_text",
          body: t("This corporation will not issue capital stock.", "Esta corporación no emitirá acciones de capital."),
        },
      ],
    },
    designatedOfficeSection(),
    residentAgentSection(),
    {
      id: "membership_conditions",
      title: t("Membership conditions", "Condiciones de membresía"),
      fields: [
        {
          id: "membership_conditions_choice",
          label: t("Membership conditions", "Condiciones de membresía"),
          type: "radio",
          required: true,
          options: [
            { value: "in_bylaws", label: t("Membership conditions will be stated in the bylaws", "Las condiciones de membresía se establecerán en los estatutos") },
            { value: "in_filing", label: t("Membership conditions are stated in this filing", "Las condiciones de membresía se establecen en esta presentación") },
          ],
        },
        {
          id: "membership_conditions_text",
          label: t("Membership conditions", "Condiciones de membresía"),
          type: "textarea",
          requiredWhen: [{ field: "membership_conditions_choice", operator: "eq", value: "in_filing" }],
          visibleWhen: [{ field: "membership_conditions_choice", operator: "eq", value: "in_filing" }],
        },
      ],
    },
    incorporatorsSection(),
    initialDirectorsSection(),
    existenceAndEffectiveDateSection(),
    {
      id: "nonprofit_category",
      title: t("Nonprofit category supplement", "Suplemento de categoría sin fines de lucro"),
      description: t("Select the principal service or purpose category and the organization form (from the CORPREG02 category page).", "Seleccione la categoría principal de servicio o propósito y la forma de organización."),
      fields: [
        {
          id: "service_category",
          label: t("Principal service or purpose category", "Categoría principal de servicio o propósito"),
          type: "category_grid",
          required: true,
          options: SERVICE_CATEGORIES.map(([value, en, es]) => ({ value, label: t(en, es) })),
        },
        {
          id: "service_category_other",
          label: t("Explain the other service", "Explique el otro servicio"),
          type: "textarea",
          requiredWhen: [{ field: "service_category", operator: "eq", value: "other_services" }],
          visibleWhen: [{ field: "service_category", operator: "eq", value: "other_services" }],
        },
        {
          id: "organization_form",
          label: t("Organization form category", "Categoría de forma de organización"),
          type: "category_grid",
          required: true,
          options: ORG_FORM_CATEGORIES.map(([value, en, es]) => ({ value, label: t(en, es) })),
        },
      ],
    },
    certificationSection(),
  ],
  attestations: [],
  notices: [
    t(
      "Nonprofit exemption notice: the CORPREG02 form includes an exemption notice. SmartPR does not decide whether a particular organization qualifies for an exemption.",
      "Aviso de exención sin fines de lucro: el formulario CORPREG02 incluye un aviso de exención. SmartPR no determina si una organización califica para una exención."
    ),
  ],
  feeMetadata: {
    estimatedFeeUsd: 5,
    source: t("Department of State listing supplied with the source package", "Listado del Departamento de Estado provisto con el paquete fuente"),
    revenueCodeNotes: t("Nonprofit exemption notice included as informational text; final fee requires portal verification.", "Aviso de exención incluido como texto informativo; la tarifa final requiere verificación en el portal."),
    requiresPortalVerification: true,
  },
};
