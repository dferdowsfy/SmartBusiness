// ============================================================================
// Per-requirement guidance content.
//
// Replaces a single generated sentence ("Business Type = Restaurant") with a
// structured, project-specific explanation: why THIS user is seeing this
// requirement, what it actually is, what to do, and what happens next — plus
// where the rule comes from. Rendered inside the existing "Why do I need
// this?" disclosure; this module only decides CONTENT, never layout.
//
// Two questions this module deliberately keeps separate:
//   - triggeredBy   — "why did SmartPR select this for ME?" (a graph fact)
//   - whyThisApplies — "why does this requirement exist for this activity?"
//     (a regulatory fact). A trigger is never a substitute for a reason.
//
// Jurisdiction packs register a hand-written guidance builder per document id
// (see jurisdictions/pr/index.ts's `requirementGuidance`) — that is the ONLY
// place a `whyThisApplies`/`purpose`/`consequenceOrNextStep` may be authored.
// A document with no registered builder gets the honest NEEDS_REVIEW fallback
// below, never invented prose — see buildRequirementGuidance().
// ============================================================================

import { ACTIVE_JURISDICTION } from "./jurisdictions/index.ts";
import type { LangCode } from "./jurisdictions/types";
import type { KBRule, KnowledgeBase } from "./rulesEngine";

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
  /** Human-readable facts that produced this requirement, e.g. "Selling alcohol". Never a raw graph id/concatenation. */
  triggeredBy: string[];
  /** What completing this unlocks or blocks, e.g. "Needed before Room Tax filing can start". */
  satisfiesOrUnlocks: string[];
  sourceReferences: RequirementSource[];
  /** e.g. "September 2026" — null when not independently verified. */
  lastVerified: string | null;
  /**
   * True when this came from the generic fallback rather than a hand-written,
   * source-grounded builder — i.e. GUIDANCE_NEEDS_REVIEW. The UI shows the
   * honest "not yet validated" copy in this case rather than invented prose.
   */
  needsReview: boolean;
}

export interface GuidanceContext {
  language: LangCode;
  municipality?: string | null;
  /** Display name of the resolved business type, e.g. "Airbnb". */
  businessTypeName?: string | null;
  /** Raw discovery answers (wizard keys), for fact-driven personalization. */
  discoveryAnswers: Record<string, unknown>;
  /** Selected legal structure, e.g. "limited_liability_company" — needed for entity-formation guidance. */
  entityType?: string | null;
  /** The full KB, so the fallback can look up which rule actually fired (see describeTriggerRule). Optional so tests can omit it. */
  kb?: KnowledgeBase;
}

export interface GuidanceRequirement {
  document_id?: string;
  code: string;
  name: string;
  agency: string;
  reason: string;
  /** Id of the rule that matched (ClassifiedRequirement.source_rule_id), used to derive honest, relevance-filtered trigger tags when no hand-written builder exists. */
  sourceRuleId?: string;
}

// Hand-written builders never set `needsReview` themselves — it's true only
// for the generic fallback, and buildRequirementGuidance() injects `false`
// for every registered builder's result (see below).
type GuidanceBuilder = (req: GuidanceRequirement, ctx: GuidanceContext) => Omit<RequirementGuidance, "needsReview">;

/** Registered per document id by a jurisdiction pack (see PR pack). */
export type RequirementGuidanceMap = Record<string, GuidanceBuilder>;

const NEEDS_REVIEW_EN = "SmartPR has identified this requirement, but the regulatory rationale has not yet been fully validated.";
const NEEDS_REVIEW_ES = "SmartPR identificó este requisito, pero la justificación regulatoria aún no ha sido validada completamente.";

/**
 * Look at the rule that actually fired and describe it in relevance-filtered,
 * human terms — a business-type match yields the business type only, a
 * question trigger yields a cleaned-up version of the question that was
 * answered, a municipality/flag match yields the municipality. This is the
 * ONLY place trigger tags come from when no hand-written builder exists, so
 * a fallback requirement never shows a raw graph value.
 */
function describeTriggerRule(rule: KBRule | undefined, kb: KnowledgeBase, ctx: GuidanceContext): string[] {
  if (!rule) return [];
  if (rule.rule_type === "business_type") {
    const bt = kb.businessTypes.find((b) => b.id === rule.business_type_id);
    return bt ? [bt.name] : [];
  }
  if (rule.rule_type === "question_trigger") {
    const q = kb.questions.find((item) => item.id === rule.question_id);
    if (!q) return [];
    // "Will alcohol be sold?" -> "Alcohol be sold" -> best-effort humanized tag.
    const cleaned = q.question.replace(/^will\s+/i, "").replace(/\?$/, "").trim();
    return [cleaned.charAt(0).toUpperCase() + cleaned.slice(1)];
  }
  if (rule.rule_type === "municipality_flag") {
    const flag = rule.municipality_flag;
    const label = flag ? ACTIVE_JURISDICTION.flagAdvisories.byFlag[flag]?.flagLabel : null;
    return [label || ctx.municipality, ctx.municipality && rule.business_type_id ? ctx.businessTypeName : null]
      .filter((v): v is string => Boolean(v));
  }
  if (rule.rule_type === "municipality") {
    // The universal per-municipality baseline (EIN, Patente, Merchant Reg,
    // Certificate of Incorporation) — municipality is genuinely the trigger.
    return ctx.municipality ? [ctx.municipality] : [];
  }
  return [];
}

function genericGuidance(req: GuidanceRequirement, ctx: GuidanceContext): RequirementGuidance {
  const es = ctx.language === "es";
  const msg = es ? NEEDS_REVIEW_ES : NEEDS_REVIEW_EN;
  const rule = ctx.kb && req.sourceRuleId ? ctx.kb.rules.find((r) => r.id === req.sourceRuleId) : undefined;
  const triggeredBy = ctx.kb ? describeTriggerRule(rule, ctx.kb, ctx) : [];
  return {
    summary: msg,
    whyThisApplies: msg,
    whatThisIs: es
      ? "SmartPR aún no ha documentado el propósito específico de este requisito — consulta la fuente oficial abajo."
      : "SmartPR hasn't documented what this specific requirement covers yet — check the official source below.",
    whatYouNeedToDo: es
      ? "Consulta la fuente oficial mientras SmartPR completa esta guía."
      : "Check the official source while SmartPR finishes documenting this requirement.",
    whatHappensNext: es
      ? "SmartPR actualizará esta explicación en cuanto se valide con una fuente regulatoria."
      : "SmartPR will update this explanation once it's grounded in a verified regulatory source.",
    triggeredBy,
    satisfiesOrUnlocks: [],
    sourceReferences: [{ agency: req.agency, citation: es ? "Fuente por confirmar" : "Source to be confirmed" }],
    lastVerified: null,
    needsReview: true,
  };
}

/**
 * Resolve the guidance for one requirement. Looks up a hand-written builder
 * registered for this document id in the active jurisdiction pack; falls
 * back to the honest NEEDS_REVIEW explanation otherwise — never invented
 * regulatory prose.
 */
export function buildRequirementGuidance(req: GuidanceRequirement, ctx: GuidanceContext): RequirementGuidance {
  const builder = req.document_id ? ACTIVE_JURISDICTION.requirementGuidance?.[req.document_id] : undefined;
  if (builder) return { needsReview: false, ...builder(req, ctx) };
  return genericGuidance(req, ctx);
}

// ---------------------------------------------------------------------------
// Quality validation — catches guidance that has regressed into the generic
// template pattern this module exists to eliminate. Used by the test suite
// (requirementGuidance.test.ts), not on the render path.
// ---------------------------------------------------------------------------

export const BANNED_PHRASES: string[] = [
  "this applies based on what smartpr knows about your project",
  "is issued or required by",
  "this helps keep you compliant",
  "this keeps your compliance profile current",
  "smartpr will guide you through the exact steps",
  "this is needed to comply with local regulations",
  "completing this requirement allows your business to remain compliant",
  "prepare this document and keep it on file",
  "prepare",
  "and keep it on file",
];

// A handful of the phrases above (e.g. "prepare", "and keep it on file") are
// only meaningful as a substring check paired with the others — check the
// full banned sentence fragments, not single common words in isolation.
const BANNED_SENTENCE_FRAGMENTS = BANNED_PHRASES.filter((p) => p.split(" ").length > 2);

export interface GuidanceViolation {
  field: keyof RequirementGuidance | "cross_field";
  message: string;
}

/**
 * Structural + banned-phrase checks for one requirement's guidance. Does NOT
 * check cross-requirement distinctiveness (two different requirements
 * producing near-identical text) — that needs a set of requirements to
 * compare against, and lives in the test suite instead.
 */
export function validateRequirementGuidance(guidance: RequirementGuidance, req: GuidanceRequirement): GuidanceViolation[] {
  const violations: GuidanceViolation[] = [];
  const fields: (keyof RequirementGuidance)[] = ["whyThisApplies", "whatThisIs", "whatYouNeedToDo", "whatHappensNext"];

  if (guidance.needsReview) {
    // The fallback is exempt from the "must be specific" checks below — its
    // entire point is to admit it isn't specific yet, honestly.
    return violations;
  }

  for (const field of fields) {
    const text = guidance[field] as string;
    if (!text || !text.trim()) {
      violations.push({ field, message: `${field} is empty` });
      continue;
    }
    const lower = text.toLowerCase();
    for (const phrase of BANNED_SENTENCE_FRAGMENTS) {
      if (lower.includes(phrase)) {
        violations.push({ field, message: `${field} contains banned generic phrase: "${phrase}"` });
      }
    }
  }

  // whatThisIs must not merely restate "<name> is issued/required by <agency>".
  const nameAgencyOnly = new RegExp(`^${escapeRegExp(req.name)}.*(issued|required).*${escapeRegExp(req.agency)}\\.?$`, "i");
  if (nameAgencyOnly.test(guidance.whatThisIs.trim())) {
    violations.push({ field: "whatThisIs", message: "whatThisIs merely repeats the requirement name and agency" });
  }

  // A regulatory reason must be backed by at least one source.
  if (guidance.sourceReferences.length === 0) {
    violations.push({ field: "sourceReferences", message: "whyThisApplies asserts a regulatory reason with no source reference" });
  }

  // triggeredBy must never contain a raw concatenated graph value (no
  // internal-cap-splice like "BarBayamón" — a simple heuristic: no tag mixing
  // an uppercase letter directly after a lowercase letter mid-string, which
  // legitimate multi-word tags like "Selling alcohol" never do).
  for (const tag of guidance.triggeredBy) {
    if (/[a-z][A-Z]/.test(tag)) {
      violations.push({ field: "triggeredBy", message: `triggeredBy tag looks like a raw concatenated graph value: "${tag}"` });
    }
  }

  return violations;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
