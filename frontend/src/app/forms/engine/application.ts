// ============================================================================
// GeneratedApplication construction (Part 15).
//
// Turns a completed form (definition + data + canonical version) into the
// durable deliverable record. Preparing a CORPREG form yields status
// "prepared" — never "approved" — because official evidence is still required.
// ============================================================================

import type {
  ApplicationStatus,
  CanonicalApplicationData,
  DigitalFormDefinition,
  FormData,
  GeneratedApplication,
  Lang,
  StoredAttachment,
} from "./types.ts";
import { localize } from "./types.ts";

function genId(formId: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `app_${formId}_${Date.now().toString(36)}_${rand}`;
}

export function buildGeneratedApplication(
  def: DigitalFormDefinition,
  data: FormData,
  canonical: CanonicalApplicationData,
  opts: { id?: string; status?: ApplicationStatus; attachments?: StoredAttachment[]; lang?: Lang } = {}
): GeneratedApplication {
  const lang: Lang = opts.lang ?? "en";
  const status: ApplicationStatus = opts.status ?? "prepared";
  const now = new Date().toISOString();
  return {
    id: opts.id ?? genId(def.id),
    formId: def.id,
    officialFormNumber: def.officialFormNumber,
    requirementId: def.requirementId,
    variantKey: def.variantKey,
    title: localize(def.title, lang),
    agency: def.agency,
    formVersion: def.version,
    verificationStatus: def.verificationStatus,
    status,
    completedAt: status === "draft" ? undefined : now,
    data: { ...(data as Record<string, unknown>) },
    canonicalDataVersion: canonical.version,
    attachments: opts.attachments ?? [],
  };
}

/**
 * Requirement-UI state for a form (Part 12). Preparing a CORPREG form displays
 * "Application prepared", NOT "Requirement satisfied".
 */
export type RequirementFormState =
  | "no_record"
  | "draft"
  | "prepared"
  | "needs_refresh"
  | "submitted"
  | "approved";

export function requirementFormState(app: GeneratedApplication | undefined): RequirementFormState {
  if (!app) return "no_record";
  switch (app.status) {
    case "draft":
      return "draft";
    case "needs_refresh":
      return "needs_refresh";
    case "submitted":
      return "submitted";
    case "approved":
      return "approved";
    default:
      return "prepared";
  }
}

/** The action buttons a requirement row should show for a given state. */
export function actionsForFormState(state: RequirementFormState): string[] {
  switch (state) {
    case "no_record":
      return ["start_form"];
    case "draft":
      return ["edit_form"];
    case "prepared":
      return ["view_form", "edit_form"];
    case "needs_refresh":
      return ["review_updates", "view_form", "edit_form"];
    case "submitted":
      return ["view_submission"];
    case "approved":
      return ["view_official_document"];
    default:
      return ["start_form"];
  }
}
