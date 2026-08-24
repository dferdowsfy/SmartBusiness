// IRS Form SS-4 (Rev. December 2025) — Application for Employer
// Identification Number. This schema mirrors lines 1–18 and the optional
// third-party block on the official form.
//
// Taxpayer identifiers are transient: they are sent only to the population
// route for the PDF generated in this modal and are never written to SmartPR's
// workflow snapshot or prepared-application record.
import type { DigitalFormDefinition, FormOption, ValidationRule } from "../../../engine/types.ts";
import { t } from "../../pr/department-of-state/shared.ts";

const requiredText: ValidationRule[] = [{ type: "min_length", param: 1 }];
const nonNegative: ValidationRule[] = [{ type: "number_min", param: 0 }];
const yesNo: FormOption[] = [
  { value: "yes", label: t("Yes", "Sí") },
  { value: "no", label: t("No", "No") },
];
const months: FormOption[] = [
  ["01", "January", "enero"], ["02", "February", "febrero"], ["03", "March", "marzo"],
  ["04", "April", "abril"], ["05", "May", "mayo"], ["06", "June", "junio"],
  ["07", "July", "julio"], ["08", "August", "agosto"], ["09", "September", "septiembre"],
  ["10", "October", "octubre"], ["11", "November", "noviembre"], ["12", "December", "diciembre"],
].map(([value, en, es]) => ({ value, label: t(en, es) }));

const entityTypes: FormOption[] = [
  ["sole_proprietor", "Sole proprietor", "Dueño único"],
  ["partnership", "Partnership", "Sociedad"],
  ["corporation", "Corporation", "Corporación"],
  ["personal_service_corporation", "Personal service corporation", "Corporación de servicios personales"],
  ["church", "Church or church-controlled organization", "Iglesia u organización controlada por una iglesia"],
  ["nonprofit", "Other nonprofit organization", "Otra organización sin fines de lucro"],
  ["estate", "Estate", "Caudal hereditario"],
  ["plan_administrator", "Plan administrator", "Administrador de plan"],
  ["trust", "Trust", "Fideicomiso"],
  ["military", "Military / National Guard", "Fuerzas Armadas / Guardia Nacional"],
  ["farmers_cooperative", "Farmers' cooperative", "Cooperativa agrícola"],
  ["remic", "REMIC", "REMIC"],
  ["state_local_government", "State / local government", "Gobierno estatal / local"],
  ["federal_government", "Federal government", "Gobierno federal"],
  ["tribal_government", "Indian tribal government / enterprise", "Gobierno / empresa tribal indígena"],
  ["other", "Other", "Otro"],
].map(([value, en, es]) => ({ value, label: t(en, es) }));

const reasons: FormOption[] = [
  ["started_new_business", "Started a new business", "Comenzó un negocio nuevo"],
  ["hired_employees", "Hired employees", "Contrató empleados"],
  ["banking", "Banking purpose", "Propósito bancario"],
  ["changed_organization", "Changed type of organization", "Cambió el tipo de organización"],
  ["purchased_business", "Purchased a going business", "Compró un negocio en marcha"],
  ["created_trust", "Created a trust", "Creó un fideicomiso"],
  ["withholding", "Compliance with IRS withholding regulations", "Cumplimiento con las reglas de retención del IRS"],
  ["created_pension", "Created a pension plan", "Creó un plan de pensión"],
  ["other", "Other", "Otro"],
].map(([value, en, es]) => ({ value, label: t(en, es) }));

const activities: FormOption[] = [
  ["construction", "Construction", "Construcción"],
  ["real_estate", "Real estate", "Bienes raíces"],
  ["rental_leasing", "Rental and leasing", "Alquiler y arrendamiento"],
  ["manufacturing", "Manufacturing", "Manufactura"],
  ["transportation", "Transportation and warehousing", "Transportación y almacenamiento"],
  ["finance", "Finance and insurance", "Finanzas y seguros"],
  ["health_care", "Health care and social assistance", "Salud y asistencia social"],
  ["food_service", "Accommodation and food service", "Alojamiento y servicio de alimentos"],
  ["wholesale_agent", "Wholesale — agent / broker", "Mayorista — agente / corredor"],
  ["wholesale_other", "Wholesale — other", "Mayorista — otro"],
  ["retail", "Retail", "Venta al detal"],
  ["other", "Other", "Otro"],
].map(([value, en, es]) => ({ value, label: t(en, es) }));

export const SS4: DigitalFormDefinition = {
  id: "FORM_IRS_SS4",
  officialFormNumber: "SS4",
  requirementId: "DOC_EIN",
  variantKey: "ein_application",
  title: t("Form SS-4 — Application for Employer Identification Number", "Formulario SS-4 — Solicitud de Número de Identificación Patronal"),
  agency: "Internal Revenue Service",
  jurisdiction: "federal",
  version: "2.0.0",
  verificationStatus: "extracted_from_official_pdf",
  sourceDocument: "fss4.pdf (Rev. December 2025)",
  officialSourceUrl: "https://www.irs.gov/pub/irs-pdf/fss4.pdf",
  resultingDocumentName: t("IRS CP 575 EIN confirmation notice", "Notificación CP 575 del IRS confirmando el EIN"),
  submissionMethod: "external_portal",
  officialEvidenceStillRequired: true,
  applicability: [],
  sections: [
    {
      id: "identity",
      title: t("Entity identity — lines 1–3", "Identidad de la entidad — líneas 1–3"),
      fields: [
        { id: "legal_name", label: t("Legal name of entity or individual", "Nombre legal de la entidad o persona"), type: "text", required: true, canonicalKey: "business.legalName", validation: requiredText, helpText: t("Line 1 — exactly as it appears on the formation or other legal document.", "Línea 1 — exactamente como aparece en el documento legal u organizativo.") },
        { id: "trade_name", label: t("Trade name, if different", "Nombre comercial, si es distinto"), type: "text", canonicalKey: "business.tradeName", helpText: t("Line 2.", "Línea 2.") },
        { id: "care_of_name", label: t("Executor, administrator, trustee, or “care of” name", "Nombre del albacea, administrador, fiduciario o persona “a cargo”"), type: "text", helpText: t("Line 3 — complete when applicable.", "Línea 3 — complete cuando corresponda.") },
      ],
    },
    {
      id: "addresses",
      title: t("Addresses — lines 4–6", "Direcciones — líneas 4–6"),
      fields: [
        { id: "mailing_address", label: t("Mailing address", "Dirección postal"), type: "address", required: true, canonicalKey: "addresses.principalMailing", helpText: t("Lines 4a–4b. A P.O. box is allowed.", "Líneas 4a–4b. Se permite un apartado postal.") },
        { id: "street_address_different", label: t("The physical address is different from the mailing address", "La dirección física es distinta de la dirección postal"), type: "checkbox" },
        { id: "street_address", label: t("Physical street address", "Dirección física"), type: "address", canonicalKey: "addresses.operatingAddress", visibleWhen: [{ field: "street_address_different", operator: "eq", value: true }], requiredWhen: [{ field: "street_address_different", operator: "eq", value: true }], helpText: t("Lines 5a–5b. Do not use a P.O. box.", "Líneas 5a–5b. No use un apartado postal.") },
        { id: "principal_location", label: t("County or municipality and state / territory of the principal business", "Condado o municipio y estado / territorio del negocio principal"), type: "text", required: true, canonicalKey: "addresses.municipality", validation: requiredText, helpText: t("Line 6 — for Puerto Rico, enter the municipio followed by PR.", "Línea 6 — para Puerto Rico, escriba el municipio seguido de PR.") },
      ],
    },
    {
      id: "responsible_party",
      title: t("Responsible party — lines 7a–7b", "Parte responsable — líneas 7a–7b"),
      description: t("The IRS generally requires the individual who ultimately owns or controls the entity.", "El IRS generalmente requiere la persona que en última instancia posee o controla la entidad."),
      fields: [
        { id: "responsible_party_name", label: t("Responsible party's full legal name", "Nombre legal completo de la parte responsable"), type: "text", required: true, validation: requiredText },
        { id: "responsible_party_tin", label: t("Responsible party's SSN, ITIN, EIN, or “foreign” / “N/A” when allowed", "SSN, ITIN, EIN de la parte responsable, o “foreign” / “N/A” cuando esté permitido"), type: "text", required: true, sensitive: true, transient: true, validation: requiredText, helpText: t("Line 7b. Used only to populate this PDF; SmartPR does not autosave or retain it.", "Línea 7b. Se usa solo para completar este PDF; SmartPR no lo guarda automáticamente ni lo conserva.") },
      ],
    },
    {
      id: "llc",
      title: t("Limited liability company — lines 8a–8c", "Compañía de responsabilidad limitada — líneas 8a–8c"),
      fields: [
        { id: "is_llc", label: t("Is this application for an LLC or foreign equivalent?", "¿Es esta solicitud para una LLC o equivalente extranjero?"), type: "radio", options: yesNo, required: true },
        { id: "llc_member_count", label: t("Number of LLC members", "Número de miembros de la LLC"), type: "number", visibleWhen: [{ field: "is_llc", operator: "eq", value: "yes" }], requiredWhen: [{ field: "is_llc", operator: "eq", value: "yes" }], validation: [{ type: "number_min", param: 1 }] },
        { id: "llc_organized_us", label: t("Was the LLC organized in the United States?", "¿Se organizó la LLC en Estados Unidos?"), type: "radio", options: yesNo, visibleWhen: [{ field: "is_llc", operator: "eq", value: "yes" }], requiredWhen: [{ field: "is_llc", operator: "eq", value: "yes" }], helpText: t("Line 8c is a federal-tax classification question; do not infer the answer from a Puerto Rico address alone.", "La línea 8c es una pregunta de clasificación tributaria federal; no deduzca la respuesta solo por tener dirección en Puerto Rico.") },
      ],
    },
    {
      id: "entity_classification",
      title: t("Federal entity classification — lines 9a–9b", "Clasificación federal de la entidad — líneas 9a–9b"),
      fields: [
        { id: "entity_classification", label: t("Type of entity", "Tipo de entidad"), type: "category_grid", options: entityTypes, required: true },
        { id: "sole_proprietor_tin", label: t("Sole proprietor's SSN or ITIN", "SSN o ITIN del dueño único"), type: "text", sensitive: true, transient: true, visibleWhen: [{ field: "entity_classification", operator: "eq", value: "sole_proprietor" }], requiredWhen: [{ field: "entity_classification", operator: "eq", value: "sole_proprietor" }] },
        { id: "estate_decedent_tin", label: t("Decedent's SSN or ITIN", "SSN o ITIN de la persona fallecida"), type: "text", sensitive: true, transient: true, visibleWhen: [{ field: "entity_classification", operator: "eq", value: "estate" }], requiredWhen: [{ field: "entity_classification", operator: "eq", value: "estate" }] },
        { id: "plan_administrator_tin", label: t("Plan administrator TIN", "TIN del administrador del plan"), type: "text", sensitive: true, transient: true, visibleWhen: [{ field: "entity_classification", operator: "eq", value: "plan_administrator" }], requiredWhen: [{ field: "entity_classification", operator: "eq", value: "plan_administrator" }] },
        { id: "corporation_return_form", label: t("Income tax form the corporation will file", "Formulario contributivo que presentará la corporación"), type: "text", visibleWhen: [{ field: "entity_classification", operator: "eq", value: "corporation" }], requiredWhen: [{ field: "entity_classification", operator: "eq", value: "corporation" }], placeholder: t("Example: 1120", "Ejemplo: 1120") },
        { id: "trust_grantor_tin", label: t("Grantor's TIN", "TIN del otorgante"), type: "text", sensitive: true, transient: true, visibleWhen: [{ field: "entity_classification", operator: "eq", value: "trust" }], requiredWhen: [{ field: "entity_classification", operator: "eq", value: "trust" }] },
        { id: "nonprofit_type", label: t("Type of nonprofit organization", "Tipo de organización sin fines de lucro"), type: "text", visibleWhen: [{ field: "entity_classification", operator: "eq", value: "nonprofit" }], requiredWhen: [{ field: "entity_classification", operator: "eq", value: "nonprofit" }] },
        { id: "other_entity_type", label: t("Other entity type and return, if any", "Otro tipo de entidad y planilla, si corresponde"), type: "text", visibleWhen: [{ field: "entity_classification", operator: "eq", value: "other" }], requiredWhen: [{ field: "entity_classification", operator: "eq", value: "other" }] },
        { id: "group_exemption_number", label: t("Group Exemption Number (GEN), if any", "Número de exención grupal (GEN), si existe"), type: "text" },
        { id: "incorporation_location_type", label: t("Where was the corporation incorporated?", "¿Dónde se incorporó la corporación?"), type: "radio", options: [{ value: "state", label: t("A U.S. state", "Un estado de EE. UU.") }, { value: "foreign_country", label: t("A foreign country or territory", "Un país extranjero o territorio") }], visibleWhen: [{ field: "entity_classification", operator: "in", value: ["corporation", "personal_service_corporation"] }], requiredWhen: [{ field: "entity_classification", operator: "in", value: ["corporation", "personal_service_corporation"] }] },
        { id: "incorporation_state", label: t("State of incorporation", "Estado de incorporación"), type: "text", visibleWhen: [{ field: "incorporation_location_type", operator: "eq", value: "state" }], requiredWhen: [{ field: "incorporation_location_type", operator: "eq", value: "state" }] },
        { id: "incorporation_foreign_country", label: t("Foreign country or territory of incorporation", "País extranjero o territorio de incorporación"), type: "text", visibleWhen: [{ field: "incorporation_location_type", operator: "eq", value: "foreign_country" }], requiredWhen: [{ field: "incorporation_location_type", operator: "eq", value: "foreign_country" }] },
      ],
    },
    {
      id: "reason",
      title: t("Reason for applying — lines 10–12", "Motivo de la solicitud — líneas 10–12"),
      fields: [
        { id: "reason_for_applying", label: t("Reason for applying", "Motivo de la solicitud"), type: "radio", options: reasons, required: true },
        { id: "reason_detail", label: t("Required explanation", "Explicación requerida"), type: "text", visibleWhen: [{ field: "reason_for_applying", operator: "in", value: ["started_new_business", "banking", "changed_organization", "created_trust", "created_pension", "other"] }], requiredWhen: [{ field: "reason_for_applying", operator: "in", value: ["started_new_business", "banking", "changed_organization", "created_trust", "created_pension", "other"] }] },
        { id: "date_business_started", label: t("Date business started or acquired", "Fecha en que comenzó o se adquirió el negocio"), type: "date", required: true, canonicalKey: "business.operationsStartDate" },
        { id: "closing_month", label: t("Closing month of accounting year", "Mes de cierre del año contable"), type: "select", options: months, required: true },
      ],
    },
    {
      id: "employment",
      title: t("Employees and payroll — lines 13–15", "Empleados y nómina — líneas 13–15"),
      description: t("Enter zero in every employee category that does not apply.", "Escriba cero en cada categoría de empleados que no corresponda."),
      fields: [
        { id: "agricultural_employee_count", label: t("Agricultural employees expected", "Empleados agrícolas esperados"), type: "number", required: true, validation: nonNegative },
        { id: "household_employee_count", label: t("Household employees expected", "Empleados domésticos esperados"), type: "number", required: true, validation: nonNegative },
        { id: "other_employee_count", label: t("Other employees expected", "Otros empleados esperados"), type: "number", required: true, canonicalKey: "operations.employeeCount", validation: nonNegative },
        { id: "form_944_election", label: t("I qualify and elect to file Form 944 annually instead of Form 941 quarterly", "Cualifico y elijo presentar el Formulario 944 anual en vez del Formulario 941 trimestral"), type: "checkbox", helpText: t("Line 14 — leave unchecked if no employees are expected or if you do not make this election.", "Línea 14 — deje sin marcar si no espera empleados o si no hace esta elección.") },
        { id: "first_wage_date_or_na", label: t("First date wages or annuities were paid, or N/A", "Primera fecha en que pagó salarios o anualidades, o N/A"), type: "text", required: true, helpText: t("Line 15 — enter N/A if the business does not plan to have employees.", "Línea 15 — escriba N/A si el negocio no planea tener empleados.") },
      ],
    },
    {
      id: "activity",
      title: t("Principal business activity — lines 16–17", "Actividad principal del negocio — líneas 16–17"),
      fields: [
        { id: "principal_activity_category", label: t("Principal activity category", "Categoría de actividad principal"), type: "category_grid", options: activities, required: true },
        { id: "principal_activity_other", label: t("Other principal activity", "Otra actividad principal"), type: "text", visibleWhen: [{ field: "principal_activity_category", operator: "eq", value: "other" }], requiredWhen: [{ field: "principal_activity_category", operator: "eq", value: "other" }] },
        { id: "principal_activity_line", label: t("Specific merchandise sold, work done, products produced, or services provided", "Mercancía vendida, trabajo realizado, productos o servicios específicos"), type: "textarea", required: true, canonicalKey: "business.activityDescription", validation: requiredText },
      ],
    },
    {
      id: "prior_ein",
      title: t("Prior EIN — line 18", "EIN anterior — línea 18"),
      fields: [
        { id: "previous_ein_received", label: t("Has this entity previously applied for and received an EIN?", "¿Esta entidad solicitó y recibió anteriormente un EIN?"), type: "radio", options: yesNo, required: true },
        { id: "previous_ein", label: t("Previous EIN", "EIN anterior"), type: "text", sensitive: true, transient: true, visibleWhen: [{ field: "previous_ein_received", operator: "eq", value: "yes" }], requiredWhen: [{ field: "previous_ein_received", operator: "eq", value: "yes" }] },
      ],
    },
    {
      id: "third_party",
      title: t("Third-party designee — optional", "Tercero designado — opcional"),
      fields: [
        { id: "use_third_party_designee", label: t("Authorize a third party to receive the EIN and answer questions", "Autorizar a un tercero a recibir el EIN y contestar preguntas"), type: "radio", options: yesNo, required: true },
        { id: "designee_name", label: t("Designee's name", "Nombre del tercero"), type: "text", visibleWhen: [{ field: "use_third_party_designee", operator: "eq", value: "yes" }], requiredWhen: [{ field: "use_third_party_designee", operator: "eq", value: "yes" }] },
        { id: "designee_phone", label: t("Designee's telephone number", "Teléfono del tercero"), type: "phone", visibleWhen: [{ field: "use_third_party_designee", operator: "eq", value: "yes" }], requiredWhen: [{ field: "use_third_party_designee", operator: "eq", value: "yes" }] },
        { id: "designee_address", label: t("Designee's address and ZIP code", "Dirección y código postal del tercero"), type: "textarea", visibleWhen: [{ field: "use_third_party_designee", operator: "eq", value: "yes" }], requiredWhen: [{ field: "use_third_party_designee", operator: "eq", value: "yes" }] },
        { id: "designee_fax", label: t("Designee's fax number", "Fax del tercero"), type: "phone", visibleWhen: [{ field: "use_third_party_designee", operator: "eq", value: "yes" }] },
      ],
    },
    {
      id: "applicant",
      title: t("Applicant certification and contact", "Certificación y contacto del solicitante"),
      fields: [
        { id: "signer_name_and_title", label: t("Applicant's name and title", "Nombre y cargo del solicitante"), type: "text", required: true },
        { id: "applicant_phone", label: t("Applicant's telephone number", "Teléfono del solicitante"), type: "phone", required: true, canonicalKey: "business.phone" },
        { id: "applicant_fax", label: t("Applicant's fax number, if any", "Fax del solicitante, si existe"), type: "phone" },
        { id: "signature_acknowledgement", label: t("I understand that I must sign and date the downloaded Form SS-4 before faxing or mailing it to the IRS.", "Entiendo que debo firmar y fechar el Formulario SS-4 descargado antes de enviarlo por fax o correo al IRS."), type: "attestation", required: true },
      ],
    },
  ],
  notices: [
    t("Sensitive taxpayer identifiers are used only to populate the PDF in this open session and are not autosaved. The IRS requires the responsible party's identifier and a signature when filing Form SS-4 by fax or mail.", "Los identificadores contributivos confidenciales se usan solo para completar el PDF en esta sesión y no se guardan automáticamente. El IRS requiere el identificador de la parte responsable y una firma al presentar el Formulario SS-4 por fax o correo."),
  ],
  feeMetadata: {
    estimatedFeeUsd: 0,
    source: t("The IRS charges no fee to apply for an EIN.", "El IRS no cobra por solicitar un EIN."),
    requiresPortalVerification: false,
  },
};
