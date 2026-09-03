// Content only: resolve existing deterministic requirements. Never match obligations.
import { ACTIVE_JURISDICTION } from "./jurisdictions/index.ts";
import { runRulesEngine, type EngineInput, type KnowledgeBase } from "./rulesEngine.ts";
import { isHomeBasedLocation, isOnlineOnlyLocation } from "./locationTypes.ts";
import { duplicateGuidanceIds, validateGuidanceConcept, type GuidanceConcept, type GuidanceFactKey, type GuidanceSource } from "./guidance/model.ts";
import type { LangCode } from "./jurisdictions/types";

export interface TriggerFact {
  key: GuidanceFactKey;
  value: string | boolean;
  label: string;
  ruleIds: string[];
  conditionPath: string;
}
export interface RequirementGuidance {
  requirementId: string;
  status: "VALIDATED" | "GUIDANCE_NEEDS_REVIEW";
  reviewReasons: string[];
  triggerFacts: TriggerFact[];
  regulatoryReason: string;
  purpose: string;
  nextAction: string;
  consequenceOrNextStep: string;
  dependencies: string[];
  sources: GuidanceSource[];
  sourceVersion: string | null;
  // Existing renderer contract — unchanged UI.
  summary: string;
  whyThisApplies: string;
  whatThisIs: string;
  whatYouNeedToDo: string;
  whatHappensNext: string;
  triggeredBy: string[];
  satisfiesOrUnlocks: string[];
  sourceReferences: GuidanceSource[];
  lastVerified: string | null;
}
export interface GuidanceContext {
  language: LangCode;
  municipality?: string | null;
  businessTypeName?: string | null;
  discoveryAnswers: Record<string, unknown>;
  profile?: Record<string, unknown>;
  entityType?: string;
  /** User-edited core application fact; never inferred from location type. */
  occupancyType?: "owned" | "leased" | "other";
  kb?: KnowledgeBase;
  /** Exact normalized input used by the deterministic matcher. */
  engineInput?: EngineInput;
}
export interface GuidanceRequirement {
  document_id?: string;
  code: string;
  name: string;
  agency: string;
  reason: string;
  applicability?: string;
  triggerFacts?: string[];
}
const yes = (v: unknown) => v === true || v === "true" || v === "yes" || v === "Yes";
const no = (v: unknown) => v === false || v === "false" || v === "no" || v === "No";

/** Engine defaults (physical location => assumed lease) are not confirmed facts. */
function factValue(key: GuidanceFactKey, ctx: GuidanceContext): string | boolean | undefined {
  const p = ctx.profile ?? {}, a = ctx.discoveryAnswers;
  if (key === "entityType") return ctx.entityType;
  if (key === "municipality") return ctx.municipality || undefined;
  if (key === "businessType") return ctx.businessTypeName || undefined;
  const aliases: Partial<Record<GuidanceFactKey, string[]>> = {
    Q_ALCOHOL_SOLD: ["alcohol_sold"], Q_EMPLOYEES_HIRED: ["employees_hired", "employees_work_on_site"],
    Q_EXISTING_LEASE: ["existing_lease"], Q_PHYSICAL_LOCATION: ["physical_location"],
  };
  const values = [a[key], p[key], ...(aliases[key] ?? []).flatMap(k => [a[k], p[k]])].filter(v => v !== undefined && v !== null);
  if (values.some(no)) return false;
  if (key === "Q_EXISTING_LEASE") {
    if (ctx.occupancyType === "owned" || ctx.occupancyType === "other" || yes(a.owns_property) || yes(p.owns_property) || yes(a.Q_OWNS_PROPERTY)) return false;
    if (ctx.occupancyType === "leased") return true;
  }
  if (key === "Q_PHYSICAL_LOCATION") {
    const location = typeof p.location_type === "string" ? p.location_type.trim() : "";
    if (!location || isOnlineOnlyLocation(location) || isHomeBasedLocation(location) || /mobile|mixed use/i.test(location)) return undefined;
    return true;
  }
  if (values.some(yes)) return true;
  if (key === "Q_EMPLOYEES_HIRED" && Number(p.number_of_employees) > 0) return true;
  return undefined;
}

function review(req: GuidanceRequirement, ctx: GuidanceContext, reasons: string[]): RequirementGuidance {
  const es = ctx.language === "es";
  const why = es ? "SmartPR ha identificado este requisito, pero su fundamento regulatorio aún no se ha validado por completo." : "SmartPR has identified this requirement, but the regulatory rationale has not yet been fully validated.";
  return {
    requirementId: req.document_id ?? req.code, status: "GUIDANCE_NEEDS_REVIEW", reviewReasons: reasons,
    triggerFacts: [], regulatoryReason: "", purpose: "", nextAction: "", consequenceOrNextStep: "", dependencies: [], sources: [], sourceVersion: null,
    summary: why, whyThisApplies: why,
    whatThisIs: es ? "La finalidad específica está pendiente de validación." : "The specific purpose is awaiting validation.",
    whatYouNeedToDo: es ? "Confirma el fundamento y la aplicabilidad antes de actuar sobre este requisito." : "Confirm the rationale and applicability before acting on this requirement.",
    whatHappensNext: es ? "No se ha validado qué autoriza o acredita su cumplimiento." : "What completion authorizes or establishes has not been validated.",
    triggeredBy: [], satisfiesOrUnlocks: [], sourceReferences: [], lastVerified: null,
  };
}

export function buildRequirementGuidance(req: GuidanceRequirement, ctx: GuidanceContext): RequirementGuidance {
  const kb = ctx.kb ?? ACTIVE_JURISDICTION.kb;
  const raw = kb.documents.find(d => d.id === req.document_id)?.requirement_guidance;
  const problems = validateGuidanceConcept(raw, req.document_id);
  if (problems.length) return review(req, ctx, problems);
  const concept = raw as GuidanceConcept;
  if (["conditional", "not_applicable", "recommended"].includes(req.applicability ?? "")) return review(req, ctx, ["APPLICABILITY_NOT_CONFIRMED"]);
  const concepts = kb.documents.map(d => d.requirement_guidance).filter((c): c is GuidanceConcept => validateGuidanceConcept(c).length === 0);
  if (duplicateGuidanceIds(concepts).has(concept.requirementId)) return review(req, ctx, ["DUPLICATE_EXPLANATION"]);
  const matches = ctx.engineInput ? runRulesEngine(kb, ctx.engineInput).debug.rulesMatched.filter(r => r.document_id === req.document_id) : [];
  const entityTrace = req.triggerFacts?.includes(`entityType:${ctx.entityType}`) && concept.conditions.some(g => g.some(t => t.key === "entityType" && t.equals === ctx.entityType));
  if (!matches.length && !entityTrace) return review(req, ctx, ["MATCH_TRACE_MISSING"]);
  const group = concept.conditions.find(g => g.every(t => {
    const value = factValue(t.key, ctx);
    return t.equals === undefined ? typeof value === "string" && value.length > 0 : value === t.equals;
  }));
  if (!group) return review(req, ctx, ["TRIGGER_UNCONFIRMED_OR_CONTRADICTED"]);
  const lang = ctx.language;
  const triggerFacts: TriggerFact[] = group.map(t => {
    const value = factValue(t.key, ctx)!;
    const ruleIds = matches.map(m => m.rule_id);
    return { key: t.key, value, label: t.equals === undefined || t.key === "municipality" ? `${t.label[lang]}: ${value}` : t.label[lang], ruleIds: entityTrace ? [...ruleIds, "entity_formation_exclusivity"] : ruleIds, conditionPath: `${concept.requirementId}.requirement_guidance.conditions.${concept.conditions.indexOf(group)}.${group.indexOf(t)}` };
  });
  const render = (value: string) => value.replace(/\{municipality\}/g, String(triggerFacts.find(f => f.key === "municipality")?.value ?? ""));
  const regulatoryReason = render(concept.regulatoryReason[lang]), purpose = render(concept.purpose[lang]);
  const nextAction = render(concept.nextAction[lang]), consequenceOrNextStep = render(concept.consequenceOrNextStep[lang]);
  const why = `${lang === "es" ? "Confirmaste" : "You confirmed"}: ${triggerFacts.map(f => f.label).join("; ")}. ${regulatoryReason}`;
  return {
    requirementId: concept.requirementId, status: "VALIDATED", reviewReasons: [], triggerFacts,
    regulatoryReason, purpose, nextAction, consequenceOrNextStep,
    dependencies: [...new Set([...concept.dependencies, ...(concept.conditionalDependencies ?? []).filter(d => d.entityType === ctx.entityType).map(d => d.documentId)])],
    sources: concept.sources, sourceVersion: concept.version,
    summary: why, whyThisApplies: why, whatThisIs: purpose, whatYouNeedToDo: nextAction, whatHappensNext: consequenceOrNextStep,
    triggeredBy: triggerFacts.map(f => f.label), satisfiesOrUnlocks: [consequenceOrNextStep], sourceReferences: concept.sources,
    lastVerified: concept.sources.map(s => s.lastVerified).sort()[0],
  };
}
