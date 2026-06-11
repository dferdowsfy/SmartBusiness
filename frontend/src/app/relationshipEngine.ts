// ============================================================================
// Knowledge Graph Relationship Engine V1 — explainability layer.
//
// This sits ON TOP of the deterministic rules engine. It NEVER changes what is
// required — it only annotates each rule-produced requirement with:
//   * a confidence score (100% for rule-based requirements — they are
//     deterministic and legally required), and
//   * a weighted, human-readable breakdown of WHY it was required
//     (Business Type 40 / Questions 35 / Municipality 15 / Location 10).
//
// Historical / advisory recommendations are produced elsewhere (from captured
// submissions) and are explicitly marked advisory — they never become rules.
// ============================================================================

import type { KnowledgeBase, EngineResult, KBRule } from "./rulesEngine";

export type Factor = "business_type" | "question" | "location" | "municipality" | "universal";

// Relationship weights from the V1 spec (used to explain *why*, and to order
// reasons by influence). Historical patterns are advisory and not in this map.
export const FACTOR_WEIGHTS: Record<Factor, number> = {
  business_type: 40,
  question: 35,
  municipality: 15,
  location: 10,
  universal: 100,
};

const FACTOR_LABEL: Record<Factor, string> = {
  business_type: "Business Type",
  question: "Operations",
  location: "Location",
  municipality: "Municipality",
  universal: "Baseline",
};

// Location-type questions are weighted as the "Location" factor (10%) rather
// than a generic operations question (35%).
const LOCATION_QUESTIONS = new Set(["Q_PHYSICAL_LOCATION", "Q_HOME_BASED", "Q_ONLINE_ONLY"]);

export interface RequirementReason {
  factor: Factor | "agency";
  factorLabel: string;   // e.g. "Business Type", "Operations"
  weight: number;        // contribution weight (0 for agency context line)
  text: string;          // e.g. "Business Type = Restaurant"
}

export interface EnrichedRequirement {
  document_id: string;
  document_name: string;
  agency: string;
  category: string;
  mandatory: boolean;
  confidence: number;          // 100 for rule-based (deterministic) requirements
  source: "rule";              // distinguishes from advisory historical items
  reasons: RequirementReason[];
}

const FLAG_LABEL: Record<string, string> = {
  tourism: "Tourism Zone", coastal: "Coastal", historic: "Historic District",
  metro: "Metro Area", island: "Island Municipality",
};

function classify(rule: KBRule): Factor {
  switch (rule.rule_type) {
    case "municipality": return "universal";
    case "municipality_flag": return "municipality";
    case "business_type": return "business_type";
    case "question_trigger":
      return rule.question_id && LOCATION_QUESTIONS.has(rule.question_id) ? "location" : "question";
    default: return "question";
  }
}

function reasonText(kb: KnowledgeBase, rule: KBRule, factor: Factor): string {
  switch (factor) {
    case "universal":
      return "Required for all registered businesses in Puerto Rico";
    case "municipality": {
      const flag = rule.municipality_flag ? FLAG_LABEL[rule.municipality_flag] || rule.municipality_flag : "municipal";
      return `${flag} municipality requirement`;
    }
    case "business_type": {
      const bt = kb.businessTypes.find((b) => b.id === rule.business_type_id);
      return `Business Type = ${bt ? bt.name : rule.business_type_id}`;
    }
    case "question":
    case "location": {
      const q = kb.questions.find((x) => x.id === rule.question_id);
      const answer = rule.expected_answer && rule.expected_answer !== "true" ? rule.expected_answer : "Yes";
      return q ? `${q.question} = ${answer}` : `${rule.question_id} = ${answer}`;
    }
    default:
      return "Regulatory requirement";
  }
}

// Annotate every rule-produced requirement with confidence + weighted reasons.
// Mandatory classification is passed in (the app already distinguishes
// mandatory vs recommended) so this layer stays presentation-only.
export function enrichRequirements(
  kb: KnowledgeBase,
  result: EngineResult,
  isMandatory: (documentId: string) => boolean = () => true
): EnrichedRequirement[] {
  const ruleById = new Map(kb.rules.map((r) => [r.id, r]));

  // Group every matched rule by the document it produced.
  const byDoc = new Map<string, KBRule[]>();
  for (const m of result.debug.rulesMatched) {
    const rule = ruleById.get(m.rule_id);
    if (!rule) continue;
    const list = byDoc.get(m.document_id) || [];
    list.push(rule);
    byDoc.set(m.document_id, list);
  }

  return result.requirements.map((req) => {
    const matched = byDoc.get(req.document_id) || [];
    const seen = new Set<string>();
    const reasons: RequirementReason[] = [];

    for (const rule of matched) {
      const factor = classify(rule);
      const text = reasonText(kb, rule, factor);
      const key = factor + "|" + text;
      if (seen.has(key)) continue;
      seen.add(key);
      reasons.push({ factor, factorLabel: FACTOR_LABEL[factor], weight: FACTOR_WEIGHTS[factor], text });
    }

    // Order reasons by influence (heaviest factor first).
    reasons.sort((a, b) => b.weight - a.weight);

    // Agency regulation context line (weight 0 — explanatory, not scored).
    if (req.agency) {
      reasons.push({ factor: "agency", factorLabel: "Agency", weight: 0, text: `${req.agency} regulation` });
    }

    return {
      document_id: req.document_id,
      document_name: req.document_name,
      agency: req.agency,
      category: req.category,
      mandatory: isMandatory(req.document_id),
      confidence: 100, // rule-based requirements are deterministic
      source: "rule" as const,
      reasons,
    };
  });
}
