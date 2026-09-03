// ============================================================================
// Per-requirement guidance content.
//
// Replaces a single generated sentence ("Business Type = Restaurant") with a
// structured, project-specific explanation: why THIS user is seeing this
// requirement, what it actually is, what to do, and what happens next — plus
// where the rule comes from. Rendered inside the existing "Why do I need
// this?" disclosure; this module only decides CONTENT, never layout.
//
// Jurisdiction packs may register a hand-written guidance builder per
// document id (see jurisdictions/pr/index.ts's `requirementGuidance`). Any
// document without one gets a generic, still-structured fallback composed
// from the same data the old single-sentence `reason` came from — so every
// requirement supports the model, even before it has bespoke copy.
// ============================================================================

import { ACTIVE_JURISDICTION } from "./jurisdictions";
import type { LangCode } from "./jurisdictions/types";

export interface RequirementSource {
  agency: string;
  /** Law / regulation / form citation, e.g. "Act 272-2003 (Room Tax)". */
  citation: string;
  url?: string;
}

/**
 * A rate/figure that regulators can change — modeled explicitly so it is
 * never silently hardcoded into prose. `supersededBy` names a proposed or
 * enacted change; a PROPOSED bill is never applied here until it is actually
 * enacted and in effect (a source citation is what tells you which).
 */
export interface RateFact {
  rate: string;
  basis: string;
  source: string;
  effectiveDate: string | null;
  lastVerified: string;
  supersededBy: string | null;
}

export interface RequirementGuidance {
  /** Short label-free sentence, used only if a caller wants a one-liner. */
  summary: string;
  whyThisApplies: string;
  whatThisIs: string;
  whatYouNeedToDo: string;
  whatHappensNext: string;
  /** Human-readable facts that produced this requirement, e.g. "Short-term rental", "Bayamón". */
  triggeredBy: string[];
  /** What completing this unlocks or blocks, e.g. "Needed before Room Tax filing can start". */
  satisfiesOrUnlocks: string[];
  sourceReferences: RequirementSource[];
  /** e.g. "September 2026" — null when not independently verified. */
  lastVerified: string | null;
}

export interface GuidanceContext {
  language: LangCode;
  municipality?: string | null;
  /** Display name of the resolved business type, e.g. "Airbnb". */
  businessTypeName?: string | null;
  /** Raw discovery answers (wizard keys), for fact-driven personalization. */
  discoveryAnswers: Record<string, unknown>;
}

export interface GuidanceRequirement {
  document_id?: string;
  code: string;
  name: string;
  agency: string;
  reason: string;
}

type GuidanceBuilder = (req: GuidanceRequirement, ctx: GuidanceContext) => RequirementGuidance;

/** Registered per document id by a jurisdiction pack (see PR pack). */
export type RequirementGuidanceMap = Record<string, GuidanceBuilder>;

function genericGuidance(req: GuidanceRequirement, ctx: GuidanceContext): RequirementGuidance {
  const es = ctx.language === "es";
  const where = [ctx.businessTypeName, ctx.municipality].filter(Boolean).join(es ? " en " : " in ");
  return {
    summary: req.reason,
    whyThisApplies: where
      ? (es ? `Aplica porque SmartPR identificó: ${where}.` : `This applies based on what SmartPR knows about your project: ${where}.`)
      : req.reason,
    whatThisIs: es
      ? `${req.name} es emitido o requerido por ${req.agency}.`
      : `${req.name} is issued or required by ${req.agency}.`,
    whatYouNeedToDo: es
      ? `Prepara ${req.name} y consérvalo en tu expediente. SmartPR te guiará en los pasos exactos cuando comiences este requisito.`
      : `Prepare ${req.name} and keep it on file. SmartPR will guide you through the exact steps when you start this requirement.`,
    whatHappensNext: es
      ? "Completarlo mantiene tu perfil de cumplimiento al día."
      : "Completing this keeps your compliance profile current.",
    triggeredBy: [ctx.businessTypeName, ctx.municipality].filter((v): v is string => Boolean(v)),
    satisfiesOrUnlocks: [],
    sourceReferences: [{ agency: req.agency, citation: es ? "Base de conocimiento regulatorio de SmartPR" : "SmartPR regulatory knowledge base" }],
    lastVerified: null,
  };
}

/**
 * Resolve the guidance for one requirement. Looks up a hand-written builder
 * registered for this document id in the active jurisdiction pack; falls
 * back to a generic-but-structured explanation otherwise.
 */
export function buildRequirementGuidance(req: GuidanceRequirement, ctx: GuidanceContext): RequirementGuidance {
  const builder = req.document_id ? ACTIVE_JURISDICTION.requirementGuidance?.[req.document_id] : undefined;
  if (builder) return builder(req, ctx);
  return genericGuidance(req, ctx);
}
