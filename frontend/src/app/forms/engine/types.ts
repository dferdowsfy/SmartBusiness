// ============================================================================
// SmartPR schema-driven government form engine — shared type definitions.
//
// One reusable renderer is driven entirely by the versioned schemas typed here.
// There is deliberately NO per-form React component: every Puerto Rico
// Department of State variant (CORPREG01–CORPREG06) is a `DigitalFormDefinition`
// data object rendered by `GovernmentFormRenderer`.
//
// These types are consumed by the Next.js app AND by node:test files run with
// `--experimental-strip-types`, so the module stays free of runtime-only TS
// features (no enums, no namespaces) — pure type-stripping only.
// ============================================================================

// ---------------------------------------------------------------------------
// Localization
// ---------------------------------------------------------------------------

/** Bilingual text. `es` is optional so English-only strings degrade cleanly. */
export interface LocalizedText {
  en: string;
  es?: string;
}

export type Lang = "en" | "es";

export function localize(text: LocalizedText | undefined, lang: Lang): string {
  if (!text) return "";
  return (lang === "es" ? text.es : text.en) || text.en || text.es || "";
}

// ---------------------------------------------------------------------------
// Canonical entity model (Part 2)
// ---------------------------------------------------------------------------

export type EntityType =
  | "stock_corporation"
  | "nonprofit_nonstock_corporation"
  | "close_corporation"
  | "professional_corporation"
  | "foreign_corporation"
  | "limited_liability_partnership"
  | "limited_liability_company"
  | "sole_proprietorship"
  | "partnership"
  | "other";

export type FormationStatus =
  | "not_formed"
  | "formed_in_puerto_rico"
  | "formed_outside_puerto_rico";

export interface CanonicalAddress {
  line1: string;
  line2?: string;
  cityOrMunicipality: string;
  stateOrTerritory?: string;
  postalCode: string;
  country: string;
}

export interface PartyRecord {
  id: string;
  fullName: string;
  role?: string;
  email?: string;
  phone?: string;
  physicalAddress?: CanonicalAddress;
  mailingAddress?: CanonicalAddress;
  mailingSameAsPhysical?: boolean;
  professionalLicenseNumber?: string;
  signatureStatus?: "not_started" | "signed";
}

export interface CanonicalApplicationData {
  business: {
    legalName: string;
    tradeName?: string;
    entityType: EntityType;
    formationStatus: FormationStatus;
    jurisdictionOfFormation?: string;
    incorporationDate?: string;
    forProfitStatus?: "for_profit" | "nonprofit";
    ein?: string;
    einPending?: boolean;
    purpose?: string;
    activityDescription?: string;
    naicsCode?: string;
    /** Hacienda merchant registration (Registro de Comerciante) number. */
    merchantRegistrationNumber?: string;
    /** Department of State registry number issued after formation. */
    registryNumber?: string;
    operationsStartDate?: string;
    employeeCount?: number;
    email?: string;
    phone?: string;
  };
  contact: {
    fullName?: string;
    email?: string;
    phone?: string;
    role?: string;
  };
  addresses: {
    principalPhysical?: CanonicalAddress;
    principalMailing?: CanonicalAddress;
    operatingAddress?: CanonicalAddress;
    mailingSameAsPhysical?: boolean;
    municipality?: string;
  };
  property: {
    occupancyType?: "owned" | "leased" | "other";
    ownerName?: string;
    cadastralNumber?: string;
    squareFootage?: number;
  };
  parties: {
    residentAgent?: PartyRecord;
    incorporators: PartyRecord[];
    directors: PartyRecord[];
    officers: PartyRecord[];
    partners: PartyRecord[];
    authorizedSigners: PartyRecord[];
  };
  filingPreferences: {
    existenceTerm?: "perpetual" | "indefinite" | "specific_date";
    existenceEndDate?: string;
    effectiveDateChoice?: "filing_date" | "future_date";
    futureEffectiveDate?: string;
  };
  /**
   * Operating profile shared by municipal and Hacienda artifacts. Added for the
   * government-artifact engine (see forms/artifacts) — the municipal patente
   * family asks for headcount and payroll that no Department of State form does.
   */
  operations: {
    employeeCount?: number;
    estimatedAnnualPayroll?: number;
    estimatedAnnualGrossReceipts?: number;
    municipalTaxpayerId?: string;
    fiscalYearEnd?: string;
  };
  /**
   * Regulated-activity flags. These mirror the knowledge-base question ids
   * (Q_ALCOHOL_SOLD, Q_OUTDOOR_SEATING, ...) so the deterministic rules engine
   * stays the single authority on which requirements exist; the artifact engine
   * only reads them to decide which government artifact applies.
   */
  activities: {
    foodService?: boolean;
    outdoorSeating?: boolean;
    alcoholSales?: boolean;
    entertainment?: boolean;
    signage?: boolean;
    coinOperatedMachines?: boolean;
    fuelSales?: boolean;
    cigaretteSales?: boolean;
    weaponsSales?: boolean;
    preciousMetals?: boolean;
    publicShowPromoter?: boolean;
  };
  version: number;
}

/** Fresh, empty canonical object — the durable source populated by intake. */
export function emptyCanonicalData(): CanonicalApplicationData {
  return {
    business: {
      legalName: "",
      entityType: "other",
      formationStatus: "not_formed",
    },
    contact: {},
    addresses: {},
    property: {},
    parties: {
      incorporators: [],
      directors: [],
      officers: [],
      partners: [],
      authorizedSigners: [],
    },
    filingPreferences: {},
    operations: {},
    activities: {},
    version: 1,
  };
}

// ---------------------------------------------------------------------------
// Schema field model (Part 3)
// ---------------------------------------------------------------------------

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "email"
  | "phone"
  | "date"
  | "address"
  | "select"
  | "radio"
  | "checkbox"
  | "category_grid"
  | "repeatable"
  | "file"
  | "attestation"
  | "signature"
  | "statutory_text"
  | "heading";

export interface FormOption {
  value: string;
  label: LocalizedText;
}

/**
 * A canonical dotted path used to prefill a field from — and write it back to —
 * the shared `CanonicalApplicationData`. e.g. "business.legalName".
 */
export type CanonicalKey = string;

export type ConditionOperator =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "truthy"
  | "falsy"
  | "gt"
  | "lt"
  | "exists"
  | "not_exists";

/**
 * A single predicate. `field` is a form field id (or dotted canonical key when
 * `source: "canonical"`). Conditions drive applicability, visibility and
 * conditional-required behavior. Multiple conditions in an array are AND-ed.
 */
export interface FormCondition {
  field: string;
  operator: ConditionOperator;
  value?: string | number | boolean | Array<string | number>;
  source?: "form" | "canonical";
}

export type ValidationRuleType =
  | "required"
  | "email"
  | "phone"
  | "postal_code"
  | "pr_postal_code"
  | "date"
  | "future_within_days"
  | "min_length"
  | "max_length"
  | "regex"
  | "corporate_name_suffix"
  | "professional_corp_suffix"
  | "llp_designation"
  | "min_items"
  | "number_min"
  | "number_max";

export interface ValidationRule {
  type: ValidationRuleType;
  /** Parameter for parameterized rules (days, length, pattern, etc.). */
  param?: string | number;
  message?: LocalizedText;
}

/**
 * Sub-field schema for repeatable person/organization records and structured
 * address inputs. A repeatable field owns a list of `RepeatableSubField`.
 */
export interface RepeatableSubField {
  id: string;
  label: LocalizedText;
  type: FieldType;
  required?: boolean;
  options?: FormOption[];
  helpText?: LocalizedText;
  validation?: ValidationRule[];
  visibleWhen?: FormCondition[];
  /** Maps this sub-field onto a `PartyRecord` key for canonical reuse. */
  partyKey?: keyof PartyRecord;
}

export interface FormField {
  id: string;
  canonicalKey?: CanonicalKey;
  label?: LocalizedText;
  type: FieldType;
  required?: boolean;
  options?: FormOption[];
  visibleWhen?: FormCondition[];
  requiredWhen?: FormCondition[];
  validation?: ValidationRule[];
  helpText?: LocalizedText;
  placeholder?: LocalizedText;
  /** Read-only statutory/informational body text (type: statutory_text). */
  body?: LocalizedText;
  // Repeatable configuration
  repeatable?: boolean;
  subFields?: RepeatableSubField[];
  minimumItems?: number;
  maximumItems?: number;
  /** Canonical party collection this repeatable reads/writes, e.g. "incorporators". */
  partyCollection?: keyof CanonicalApplicationData["parties"];
  /** Convenience toggle metadata, e.g. "use primary contact as incorporator". */
  convenience?: ConvenienceControl;
}

export type ConvenienceControl =
  | "use_primary_contact_as_incorporator"
  | "use_primary_contact_as_authorized_signer"
  | "use_principal_address_as_designated_office"
  | "mailing_same_as_physical"
  | "resident_agent_mailing_same_as_physical";

export interface FormSection {
  id: string;
  title: LocalizedText;
  description?: LocalizedText;
  fields: FormField[];
  visibleWhen?: FormCondition[];
}

export interface AttachmentDefinition {
  id: string;
  label: LocalizedText;
  helpText?: LocalizedText;
  required?: boolean;
  requiredWhen?: FormCondition[];
}

export interface AttestationDefinition {
  id: string;
  label: LocalizedText;
  required?: boolean;
}

export interface FeeMetadata {
  /** Primary displayed estimate in USD. */
  estimatedFeeUsd?: number;
  /** Alternate estimate keyed by for-profit / nonprofit selection. */
  estimateByProfit?: { for_profit?: number; nonprofit?: number };
  source: LocalizedText;
  /** PDF revenue-code notes stored separately from the displayed estimate. */
  revenueCodeNotes?: LocalizedText;
  requiresPortalVerification: boolean;
}

export type FormVerificationStatus =
  | "needs_source"
  | "extracted_from_official_pdf"
  | "verified_against_live_portal"
  | "published"
  | "retired";

export type SubmissionMethod =
  | "external_portal"
  | "generated_preparation_pdf"
  | "api"
  | "government_integration";

export interface DigitalFormDefinition {
  id: string;
  officialFormNumber: string;
  requirementId: string;
  variantKey: string;
  title: LocalizedText;
  agency: string;
  jurisdiction: string;
  version: string;
  verificationStatus: FormVerificationStatus;
  sourceDocument: string;
  officialSourceUrl?: string;
  resultingDocumentName: LocalizedText;
  submissionMethod: SubmissionMethod;
  officialEvidenceStillRequired: boolean;
  /** Conditions (against canonical data) that make this variant applicable. */
  applicability: FormCondition[];
  sections: FormSection[];
  attachments?: AttachmentDefinition[];
  attestations?: AttestationDefinition[];
  feeMetadata?: FeeMetadata;
  /** Informational notices rendered read-only (e.g. LLP one-year validity). */
  notices?: LocalizedText[];
}

// ---------------------------------------------------------------------------
// Runtime form values & prepared applications (Parts 15, 16)
// ---------------------------------------------------------------------------

export type FormFieldValue =
  | string
  | number
  | boolean
  | CanonicalAddress
  | PartyRecord[]
  | StoredAttachment
  | null
  | undefined;

export type FormData = Record<string, FormFieldValue>;

export interface StoredAttachment {
  id: string;
  fieldId?: string;
  name: string;
  /** Data URL or storage key — never rely on an ephemeral Blob URL alone. */
  storageRef?: string;
  mimeType?: string;
  size?: number;
  uploadedAt: string;
}

export type ApplicationStatus =
  | "draft"
  | "prepared"
  | "ready_for_submission"
  | "submitted"
  | "approved"
  | "needs_refresh";

export interface GeneratedApplication {
  id: string;
  formId: string;
  officialFormNumber: string;
  requirementId: string;
  variantKey: string;
  title: string;
  agency: string;
  formVersion: string;
  verificationStatus: FormVerificationStatus;
  status: ApplicationStatus;
  completedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  data: Record<string, unknown>;
  canonicalDataVersion: number;
  attachments: StoredAttachment[];
}
