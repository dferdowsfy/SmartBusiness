// ============================================================================
// Shared schema builders for the Puerto Rico Department of State forms.
//
// Designated office, resident agent, incorporators, initial-director, and the
// existence / effective-date controls repeat across CORPREG01–CORPREG06.
// Centralizing them keeps every variant consistent and avoids duplicating the
// same section five times. Each builder returns plain `FormSection` /
// `FormField` data — no per-form component is ever created.
// ============================================================================

import type {
  AttestationDefinition,
  FormField,
  FormSection,
  LocalizedText,
  RepeatableSubField,
} from "../../../engine/types.ts";

export function t(en: string, es: string): LocalizedText {
  return { en, es };
}

// --- Structured address sub-fields (used by repeatable party records) ------

export function addressSubFields(prefix: string, opts: { pr?: boolean } = {}): RepeatableSubField[] {
  return [
    { id: `${prefix}_line1`, label: t("Address line 1", "Dirección línea 1"), type: "text", required: true },
    { id: `${prefix}_line2`, label: t("Address line 2", "Dirección línea 2"), type: "text" },
    { id: `${prefix}_city`, label: t("City / Municipality", "Ciudad / Municipio"), type: "text", required: true },
    { id: `${prefix}_state`, label: t("State / Territory", "Estado / Territorio"), type: "text" },
    {
      id: `${prefix}_postal`,
      label: t("Postal code", "Código postal"),
      type: "text",
      required: true,
      validation: opts.pr ? [{ type: "pr_postal_code" }] : [{ type: "postal_code" }],
    },
    { id: `${prefix}_country`, label: t("Country", "País"), type: "text" },
  ];
}

// --- Structured address field (physical + optional mailing + same toggle) ---

/**
 * A designated-office / operating-office block: a structured physical address,
 * a "mailing same as physical" toggle, and a mailing address hidden when the
 * toggle is on. `pr: true` opts the physical address into PR validation.
 */
export function officeAddressFields(
  idBase: string,
  labels: { physical: LocalizedText; mailing: LocalizedText },
  opts: { pr?: boolean; physicalCanonicalKey?: string; mailingCanonicalKey?: string } = {}
): FormField[] {
  return [
    {
      id: `${idBase}_physical`,
      label: labels.physical,
      type: "address",
      required: true,
      canonicalKey: opts.physicalCanonicalKey,
      validation: opts.pr ? [{ type: "pr_postal_code" }] : undefined,
    },
    {
      id: `${idBase}_mailing_same`,
      label: t("Mailing address same as physical address", "Dirección postal igual a la física"),
      type: "checkbox",
      convenience: "mailing_same_as_physical",
    },
    {
      id: `${idBase}_mailing`,
      label: labels.mailing,
      type: "address",
      canonicalKey: opts.mailingCanonicalKey,
      visibleWhen: [{ field: `${idBase}_mailing_same`, operator: "falsy" }],
    },
  ];
}

// --- Designated office section --------------------------------------------

export function designatedOfficeSection(): FormSection {
  return {
    id: "designated_office",
    title: t("Designated office", "Oficina designada"),
    fields: officeAddressFields(
      "designated_office",
      {
        physical: t("Designated office physical address", "Dirección física de la oficina designada"),
        mailing: t("Designated office mailing address", "Dirección postal de la oficina designada"),
      },
      { pr: true, physicalCanonicalKey: "addresses.operatingAddress", mailingCanonicalKey: "addresses.principalMailing" }
    ),
  };
}

// --- Resident agent section (two variants) --------------------------------

/** Full resident agent with structured physical + mailing addresses (CORPREG01–03). */
export function residentAgentSection(): FormSection {
  return {
    id: "resident_agent",
    title: t("Resident agent", "Agente residente"),
    description: t(
      "You may select an existing party record or enter a new resident agent.",
      "Puede seleccionar un registro existente o ingresar un nuevo agente residente."
    ),
    fields: [
      { id: "resident_agent_name", label: t("Resident agent full name", "Nombre completo del agente residente"), type: "text", required: true },
      { id: "resident_agent_physical", label: t("Resident agent physical address", "Dirección física del agente residente"), type: "address", required: true, validation: [{ type: "pr_postal_code" }] },
      { id: "resident_agent_mailing_same", label: t("Resident-agent mailing address same as physical", "Dirección postal del agente igual a la física"), type: "checkbox", convenience: "resident_agent_mailing_same_as_physical" },
      { id: "resident_agent_mailing", label: t("Resident agent mailing address", "Dirección postal del agente residente"), type: "address", visibleWhen: [{ field: "resident_agent_mailing_same", operator: "falsy" }] },
    ],
  };
}

/**
 * Name-only resident agent (CORPREG04 / CORPREG05). The source PDFs identify the
 * designated office and the agent name only — we deliberately do NOT invent a
 * separate resident-agent address field.
 */
export function residentAgentNameOnlySection(): FormSection {
  return {
    id: "resident_agent",
    title: t("Resident agent", "Agente residente"),
    fields: [
      {
        id: "resident_agent_name",
        label: t("Resident agent name", "Nombre del agente residente"),
        type: "text",
        required: true,
        helpText: t(
          "The source form identifies the designated office and the agent name. A separate agent address is not collected unless later confirmed against the live portal.",
          "El formulario oficial identifica la oficina designada y el nombre del agente. No se recoge una dirección separada del agente salvo confirmación en el portal."
        ),
      },
    ],
  };
}

// --- Incorporators (repeatable) -------------------------------------------

export function incorporatorSubFields(): RepeatableSubField[] {
  return [
    { id: "fullName", label: t("Full name", "Nombre completo"), type: "text", required: true, partyKey: "fullName" },
    { id: "physical", label: t("Physical address", "Dirección física"), type: "address", required: true, partyKey: "physicalAddress" },
    { id: "mailingSameAsPhysical", label: t("Mailing address same as physical address", "Dirección postal igual a la física"), type: "checkbox", partyKey: "mailingSameAsPhysical" },
    { id: "mailing", label: t("Mailing address", "Dirección postal"), type: "address", partyKey: "mailingAddress", visibleWhen: [{ field: "mailingSameAsPhysical", operator: "falsy" }] },
  ];
}

export function incorporatorsSection(): FormSection {
  return {
    id: "incorporators",
    title: t("Incorporators", "Incorporadores"),
    fields: [
      {
        id: "incorporators",
        label: t("Incorporator", "Incorporador"),
        type: "repeatable",
        required: true,
        minimumItems: 1,
        partyCollection: "incorporators",
        subFields: incorporatorSubFields(),
        convenience: "use_primary_contact_as_incorporator",
      },
    ],
  };
}

// --- Initial directors (conditional) --------------------------------------

/**
 * Shared "will incorporator authority end on filing?" toggle plus a
 * conditionally-visible initial-director repeatable. Used by CORPREG01/02/04/05.
 */
export function initialDirectorsSection(): FormSection {
  return {
    id: "initial_directors",
    title: t("Initial directors", "Directores iniciales"),
    fields: [
      {
        id: "incorporator_authority_ends",
        label: t(
          "Will the incorporators' authority end when the certificate is filed?",
          "¿Terminará la autoridad de los incorporadores al presentarse el certificado?"
        ),
        type: "radio",
        required: true,
        options: [
          { value: "yes", label: t("Yes", "Sí") },
          { value: "no", label: t("No", "No") },
        ],
      },
      {
        id: "initial_directors",
        label: t("Initial director", "Director inicial"),
        type: "repeatable",
        partyCollection: "directors",
        minimumItems: 1,
        requiredWhen: [{ field: "incorporator_authority_ends", operator: "eq", value: "yes" }],
        visibleWhen: [{ field: "incorporator_authority_ends", operator: "eq", value: "yes" }],
        subFields: [
          { id: "fullName", label: t("Full name", "Nombre completo"), type: "text", required: true, partyKey: "fullName" },
          { id: "physical", label: t("Physical address", "Dirección física"), type: "address", required: true, partyKey: "physicalAddress" },
          { id: "mailing", label: t("Mailing address", "Dirección postal"), type: "address", partyKey: "mailingAddress" },
        ],
      },
    ],
  };
}

// --- Existence & effective date (shared) ----------------------------------

export function existenceAndEffectiveDateSection(): FormSection {
  return {
    id: "existence_effective_date",
    title: t("Existence and effective date", "Existencia y fecha de vigencia"),
    fields: [
      {
        id: "existence_term",
        label: t("Existence term", "Término de existencia"),
        type: "radio",
        required: true,
        canonicalKey: "filingPreferences.existenceTerm",
        options: [
          { value: "perpetual", label: t("Perpetual", "Perpetua") },
          { value: "indefinite", label: t("Indefinite", "Indefinida") },
          { value: "specific_date", label: t("Specific date", "Fecha específica") },
        ],
      },
      {
        id: "existence_end_date",
        label: t("Specific expiration date", "Fecha de expiración específica"),
        type: "date",
        canonicalKey: "filingPreferences.existenceEndDate",
        requiredWhen: [{ field: "existence_term", operator: "eq", value: "specific_date" }],
        visibleWhen: [{ field: "existence_term", operator: "eq", value: "specific_date" }],
      },
      {
        id: "effective_date_choice",
        label: t("Effective date", "Fecha de vigencia"),
        type: "radio",
        required: true,
        canonicalKey: "filingPreferences.effectiveDateChoice",
        options: [
          { value: "filing_date", label: t("Filing date", "Fecha de presentación") },
          { value: "future_date", label: t("Future date", "Fecha futura") },
        ],
      },
      {
        id: "future_effective_date",
        label: t("Future effective date", "Fecha de vigencia futura"),
        type: "date",
        canonicalKey: "filingPreferences.futureEffectiveDate",
        requiredWhen: [{ field: "effective_date_choice", operator: "eq", value: "future_date" }],
        visibleWhen: [{ field: "effective_date_choice", operator: "eq", value: "future_date" }],
        validation: [{ type: "future_within_days", param: 90 }],
        helpText: t(
          "A future effective date may be no more than 90 days after the intended filing date.",
          "La fecha de vigencia futura no puede exceder 90 días después de la fecha de presentación prevista."
        ),
      },
    ],
  };
}

// --- Capital stock (shared for stock / close / professional) --------------

export function capitalStockSection(opts: { includeBoardResolution?: boolean } = {}): FormSection {
  const fields: FormField[] = [
    { id: "stock_classes", label: t("Stock classes and number of authorized shares", "Clases de acciones y número de acciones autorizadas"), type: "textarea", required: true, helpText: t("List each class of stock and the number of authorized shares for each.", "Enumere cada clase de acciones y el número de acciones autorizadas.") },
    { id: "par_value", label: t("Par value or no-par-value description", "Valor a la par o descripción sin valor a la par"), type: "textarea", required: true },
    { id: "stock_rights", label: t("Denomination, powers, preferences, rights, conditions, limitations and restrictions", "Denominación, poderes, preferencias, derechos, condiciones, limitaciones y restricciones"), type: "textarea", required: true },
  ];
  if (opts.includeBoardResolution) {
    fields.push({
      id: "board_may_establish_rights",
      label: t("Will the board be authorized to establish rights by resolution?", "¿Estará la junta autorizada a establecer derechos por resolución?"),
      type: "radio",
      options: [
        { value: "yes", label: t("Yes", "Sí") },
        { value: "no", label: t("No", "No") },
      ],
    });
  }
  return { id: "capital_stock", title: t("Authorized capital stock", "Capital social autorizado"), fields };
}

// --- Certification & signature (shared) -----------------------------------

export function certificationSection(opts: { signerLabel?: LocalizedText } = {}): FormSection {
  return {
    id: "certification",
    title: t("Certification and signature", "Certificación y firma"),
    fields: [
      {
        id: "incorporator_attestation",
        label: opts.signerLabel ?? t(
          "I certify, under penalty of perjury, that the information in this application is true and correct.",
          "Certifico, bajo pena de perjurio, que la información de esta solicitud es verdadera y correcta."
        ),
        type: "attestation",
        required: true,
      },
      { id: "attestation_date", label: t("Attestation date", "Fecha de certificación"), type: "date", required: true },
      {
        id: "signatures",
        label: t("Signature", "Firma"),
        type: "repeatable",
        partyCollection: "authorizedSigners",
        minimumItems: 1,
        required: true,
        subFields: [
          { id: "fullName", label: t("Signer full name", "Nombre completo del firmante"), type: "text", required: true, partyKey: "fullName" },
          { id: "signature", label: t("Signature", "Firma"), type: "signature", partyKey: "signatureStatus" },
        ],
      },
      { id: "entity_email", label: t("Entity email", "Correo electrónico de la entidad"), type: "email", required: true, canonicalKey: "business.email", validation: [{ type: "email" }] },
    ],
  };
}

// --- Common attestation helper --------------------------------------------

export function attestation(id: string, en: string, es: string): AttestationDefinition {
  return { id, label: t(en, es), required: true };
}
