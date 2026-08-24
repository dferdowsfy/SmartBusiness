// ============================================================================
// Puerto Rico government submission registry.
//
// One centralized place that answers two questions for a DIGITIZED form:
//   1. what does the government charge to file it, and
//   2. where does the applicant actually file and pay?
//
// The six digitized Department of State forms and federal Form SS-4 have
// entries here. Requirements backed only by document upload, an unsourced
// form, or agency-issued evidence are deliberately absent.
//
// The fee is a GOVERNMENT fee. SmartPR never collects it — the amounts here are
// displayed so the applicant knows what the agency will charge at the portal.
//
// CORPREG03 (foreign-corporation authorization) is priced from the entity's
// for-profit / nonprofit status. When that status is unknown the resolution is
// returned as `unresolved` with BOTH amounts: this module never guesses.
//
// Consumed by the Next.js app AND by node:test files run with
// `--experimental-strip-types`, so it stays free of runtime-only TS features.
// ============================================================================

import type { CanonicalApplicationData, Lang, LocalizedText } from "../engine/types.ts";
import { localize } from "../engine/types.ts";

const t = (en: string, es: string): LocalizedText => ({ en, es });

/** The Registry of Corporations and Entities — never a generic PR homepage. */
export const PR_DOS_PORTAL_URL = "https://rcp.estado.pr.gov/es";

// ---------------------------------------------------------------------------
// Destination
// ---------------------------------------------------------------------------

export interface SubmissionDestination {
  agency: LocalizedText;
  portalName: LocalizedText;
  method: "online_portal";
  url: string;
  /** True when the government fee is paid to the agency, not to SmartPR. */
  paymentAtAgency: boolean;
  actionLabel?: LocalizedText;
  feeDisclaimer?: LocalizedText;
  instructions?: LocalizedText;
  instructionsUrl?: string;
  instructionsLinkLabel?: LocalizedText;
  alternatives?: Array<{ label: LocalizedText; detail: LocalizedText }>;
}

const PR_DEPARTMENT_OF_STATE: SubmissionDestination = {
  agency: t("Puerto Rico Department of State", "Departamento de Estado de Puerto Rico"),
  portalName: t("Registry of Corporations and Entities", "Registro de Corporaciones y Entidades"),
  method: "online_portal",
  url: PR_DOS_PORTAL_URL,
  paymentAtAgency: true,
};

export const IRS_EIN_URL = "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number";

const IRS_EIN_DESTINATION: SubmissionDestination = {
  agency: t("Internal Revenue Service", "Servicio de Impuestos Internos (IRS)"),
  portalName: t("IRS online EIN application — recommended", "Solicitud de EIN en línea del IRS — recomendada"),
  method: "online_portal",
  url: IRS_EIN_URL,
  paymentAtAgency: false,
  actionLabel: t("Open the IRS EIN application", "Abrir la solicitud de EIN del IRS"),
  feeDisclaimer: t(
    "The IRS issues EINs for free. SmartPR does not submit this application or charge an EIN filing fee.",
    "El IRS emite los EIN gratuitamente. SmartPR no presenta esta solicitud ni cobra una tarifa por solicitar el EIN."
  ),
  instructions: t(
    "Puerto Rico applicants may apply online and receive the EIN immediately when eligible. Use one application method only.",
    "Los solicitantes de Puerto Rico pueden solicitar en línea y recibir el EIN inmediatamente cuando cualifiquen. Use un solo método de solicitud."
  ),
  instructionsUrl: "https://www.irs.gov/instructions/iss4",
  instructionsLinkLabel: t("View current IRS Form SS-4 instructions", "Ver las instrucciones vigentes del IRS para el Formulario SS-4"),
  alternatives: [
    {
      label: t("Fax the signed Form SS-4", "Enviar por fax el Formulario SS-4 firmado"),
      detail: t(
        "From within the United States: 855-215-1627. Include your fax number so the IRS can return the EIN by fax.",
        "Desde Estados Unidos: 855-215-1627. Incluya su número de fax para que el IRS pueda devolver el EIN por fax."
      ),
    },
    {
      label: t("Mail the signed Form SS-4", "Enviar por correo el Formulario SS-4 firmado"),
      detail: t(
        "Internal Revenue Service, Attn: EIN International Operation, Cincinnati, OH 45999.",
        "Internal Revenue Service, Attn: EIN International Operation, Cincinnati, OH 45999."
      ),
    },
  ],
};

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

/** Always shown next to an amount so it is never read as a SmartPR charge. */
export const GOVERNMENT_FEE_LABEL: LocalizedText = t(
  "Government filing fee",
  "Tarifa gubernamental de radicación"
);

export const GOVERNMENT_FEE_DISCLAIMER: LocalizedText = t(
  "Government fees are paid directly to the Puerto Rico Department of State during final submission.",
  "Las tarifas gubernamentales se pagan directamente al Departamento de Estado de Puerto Rico durante la radicación final."
);

export type ForProfitStatus = "for_profit" | "nonprofit";

export interface ConditionalFeeOption {
  amount: number;
  currency: "USD";
  /** The for-profit status this amount applies to. */
  appliesTo: ForProfitStatus;
  /** Reads as a suffix after the amount: "$150 for for-profit entities". */
  description: LocalizedText;
}

export type GovernmentFeeSpec =
  | { kind: "fixed"; amount: number; currency: "USD"; label: LocalizedText }
  | {
      kind: "conditional";
      /** The canonical key the amount is chosen from. */
      basis: "business.forProfitStatus";
      options: ConditionalFeeOption[];
      label: LocalizedText;
    };

/**
 * A resolved fee, or an honest "we cannot tell which of these applies".
 * `unresolved` is never collapsed to a default amount.
 */
export type GovernmentFeeResolution =
  | {
      status: "resolved";
      amount: number;
      currency: "USD";
      label: LocalizedText;
      /** Present when the amount was chosen from a conditional spec. */
      appliesTo?: ForProfitStatus;
    }
  | { status: "unresolved"; label: LocalizedText; options: ConditionalFeeOption[] };

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

export interface FormSubmissionSpec {
  /** Official government form number, e.g. "CORPREG01". */
  formId: string;
  /** Matching `DigitalFormDefinition.id` in the form registry. */
  internalFormId: string;
  governmentFee: GovernmentFeeSpec;
  submission: SubmissionDestination;
}

const fixed = (amount: number): GovernmentFeeSpec => ({
  kind: "fixed",
  amount,
  currency: "USD",
  label: GOVERNMENT_FEE_LABEL,
});

export const PR_FORM_SUBMISSION: Record<string, FormSubmissionSpec> = {
  CORPREG01: {
    formId: "CORPREG01",
    internalFormId: "FORM_PR_DOS_CORPREG01",
    governmentFee: fixed(150),
    submission: PR_DEPARTMENT_OF_STATE,
  },
  CORPREG02: {
    formId: "CORPREG02",
    internalFormId: "FORM_PR_DOS_CORPREG02",
    governmentFee: fixed(5),
    submission: PR_DEPARTMENT_OF_STATE,
  },
  CORPREG03: {
    formId: "CORPREG03",
    internalFormId: "FORM_PR_DOS_CORPREG03",
    governmentFee: {
      kind: "conditional",
      basis: "business.forProfitStatus",
      label: GOVERNMENT_FEE_LABEL,
      options: [
        {
          amount: 150,
          currency: "USD",
          appliesTo: "for_profit",
          description: t("for for-profit entities", "para entidades con fines de lucro"),
        },
        {
          amount: 5,
          currency: "USD",
          appliesTo: "nonprofit",
          description: t("for nonprofit entities", "para entidades sin fines de lucro"),
        },
      ],
    },
    submission: PR_DEPARTMENT_OF_STATE,
  },
  CORPREG04: {
    formId: "CORPREG04",
    internalFormId: "FORM_PR_DOS_CORPREG04",
    governmentFee: fixed(150),
    submission: PR_DEPARTMENT_OF_STATE,
  },
  CORPREG05: {
    formId: "CORPREG05",
    internalFormId: "FORM_PR_DOS_CORPREG05",
    governmentFee: fixed(150),
    submission: PR_DEPARTMENT_OF_STATE,
  },
  // CORPREG06 is the Limited Liability PARTNERSHIP registration — not an LLC
  // form. The PR LLC Certificate of Organization is still needs_source and has
  // no entry here on purpose.
  CORPREG06: {
    formId: "CORPREG06",
    internalFormId: "FORM_PR_DOS_CORPREG06",
    governmentFee: fixed(110),
    submission: PR_DEPARTMENT_OF_STATE,
  },
};

export const FEDERAL_FORM_SUBMISSION: Record<string, FormSubmissionSpec> = {
  SS4: {
    formId: "SS4",
    internalFormId: "FORM_IRS_SS4",
    governmentFee: fixed(0),
    submission: IRS_EIN_DESTINATION,
  },
};

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const BY_INTERNAL_ID: Record<string, FormSubmissionSpec> = Object.fromEntries(
  [...Object.values(PR_FORM_SUBMISSION), ...Object.values(FEDERAL_FORM_SUBMISSION)].map((spec) => [spec.internalFormId, spec])
);

/** Accepts either the official form number or the internal registry id. */
export function getSubmissionSpec(formId: string): FormSubmissionSpec | null {
  if (!formId) return null;
  return PR_FORM_SUBMISSION[formId] ?? FEDERAL_FORM_SUBMISSION[formId] ?? BY_INTERNAL_ID[formId] ?? null;
}

/**
 * The gate for the whole feature. Upload-only and agency-issued requirements
 * return false and must not get a submission button.
 */
export function hasGovernmentSubmission(formId: string): boolean {
  return getSubmissionSpec(formId) !== null;
}

export function getSubmissionDestination(formId: string): SubmissionDestination | null {
  return getSubmissionSpec(formId)?.submission ?? null;
}

// ---------------------------------------------------------------------------
// Fee resolution
// ---------------------------------------------------------------------------

function forProfitStatusOf(canonical: CanonicalApplicationData | undefined): ForProfitStatus | null {
  const declared = canonical?.business.forProfitStatus;
  if (declared === "for_profit" || declared === "nonprofit") return declared;
  // A nonstock/nonprofit corporation is nonprofit by definition; anything else
  // stays unknown rather than defaulting to for-profit.
  if (canonical?.business.entityType === "nonprofit_nonstock_corporation") return "nonprofit";
  return null;
}

/**
 * The government fee for a digitized form, resolved against the applicant's
 * canonical answers. Returns null for anything that is not a digitized form.
 *
 * When a conditional fee cannot be resolved the result is `unresolved` and
 * carries every possible amount — callers must display all of them rather than
 * pick one.
 */
export function getGovernmentFee(
  formId: string,
  answers?: CanonicalApplicationData
): GovernmentFeeResolution | null {
  const spec = getSubmissionSpec(formId);
  if (!spec) return null;
  const fee = spec.governmentFee;

  if (fee.kind === "fixed") {
    return { status: "resolved", amount: fee.amount, currency: fee.currency, label: fee.label };
  }

  const status = forProfitStatusOf(answers);
  const match = status ? fee.options.find((o) => o.appliesTo === status) : undefined;
  if (!match) return { status: "unresolved", label: fee.label, options: fee.options };
  return {
    status: "resolved",
    amount: match.amount,
    currency: match.currency,
    label: fee.label,
    appliesTo: match.appliesTo,
  };
}

const money = (amount: number) => `$${amount}`;

/**
 * The amount as displayed. An unresolved conditional fee renders every branch —
 * "$150 for for-profit entities / $5 for nonprofit entities" — so the applicant
 * sees the real choice instead of a guess.
 */
export function formatGovernmentFee(resolution: GovernmentFeeResolution, lang: Lang): string {
  if (resolution.status === "resolved") return money(resolution.amount);
  return resolution.options
    .map((o) => `${money(o.amount)} ${localize(o.description, lang)}`)
    .join(" / ");
}

/** Convenience for one-line fee display; null when the form is not digitized. */
export function governmentFeeText(
  formId: string,
  answers: CanonicalApplicationData | undefined,
  lang: Lang
): string | null {
  const resolution = getGovernmentFee(formId, answers);
  return resolution ? formatGovernmentFee(resolution, lang) : null;
}

// ---------------------------------------------------------------------------
// Opening the portal
// ---------------------------------------------------------------------------

export type PortalOpener = (url: string, target: string, features: string) => unknown;

/**
 * Sends the applicant to the official portal in a new tab.
 *
 * This deliberately takes no application and returns no status: reaching the
 * portal means "ready for external submission" and nothing more. Marking an
 * application submitted, or a requirement satisfied, stays an explicit,
 * separate act — never a side effect of following this link.
 *
 * Returns false when the form has no submission destination, or when there is
 * no window to open (server render).
 */
export function openGovernmentPortal(formId: string, open?: PortalOpener): boolean {
  const destination = getSubmissionDestination(formId);
  if (!destination) return false;
  const opener: PortalOpener | undefined =
    open ?? (typeof window !== "undefined" ? (u, target, features) => window.open(u, target, features) : undefined);
  if (!opener) return false;
  opener(destination.url, "_blank", "noopener,noreferrer");
  return true;
}
