// ============================================================================
// Status vocabulary.
//
// SmartPR prepares filings; it does not decide them. Words like "approved" or
// "government approved" may only ever come from the issuing agency's own
// system, so the artifact engine speaks from a fixed list and a test asserts
// that no user-facing copy in this module drifts outside it.
// ============================================================================

export type SafeStatus =
  | "information_complete"
  | "additional_information_required"
  | "ready_for_review"
  | "ready_for_submission"
  | "submitted_externally"
  | "awaiting_agency_action"
  | "requirements_prepared"
  | "official_form_not_available";

export interface StatusCopy {
  en: string;
  es: string;
}

export const STATUS_COPY: Record<SafeStatus, StatusCopy> = {
  information_complete: { en: "Information complete", es: "Información completa" },
  additional_information_required: {
    en: "Additional information required",
    es: "Se requiere información adicional",
  },
  ready_for_review: { en: "Ready for review", es: "Listo para revisión" },
  ready_for_submission: { en: "Ready for submission", es: "Listo para presentación" },
  submitted_externally: { en: "Submitted externally", es: "Presentado externamente" },
  awaiting_agency_action: { en: "Awaiting agency action", es: "En espera de acción de la agencia" },
  requirements_prepared: { en: "Requirements prepared", es: "Requisitos preparados" },
  official_form_not_available: {
    en: "Official form not yet available in SmartPR",
    es: "Formulario oficial aún no disponible en SmartPR",
  },
};

/**
 * Claims that may only originate from a government system. Checked against the
 * engine's own copy — never used to censor text an agency actually returned.
 */
const PROHIBITED_PATTERNS: RegExp[] = [
  /\bapproved\b/i,
  /\bapproval granted\b/i,
  /\bgranted\b/i,
  /\bgovernment[- ]approved\b/i,
  /\bofficially accepted\b/i,
  /\baccepted by the (government|agency|municipality)\b/i,
  /\baprobad[oa]s?\b/i,
  /\bconcedid[oa]s?\b/i,
];

export function containsApprovalLanguage(text: string): boolean {
  return PROHIBITED_PATTERNS.some((p) => p.test(text));
}

export function assertNoApprovalLanguage(text: string, context: string): void {
  if (containsApprovalLanguage(text)) {
    throw new Error(`Approval language is not permitted in SmartPR-authored copy (${context}): "${text}"`);
  }
}

export function statusLabel(status: SafeStatus, lang: "en" | "es" = "en"): string {
  return STATUS_COPY[status][lang];
}
