// ============================================================================
// Knowledge-graph helpers for the SmartPR admin explorer.
//
// Turns the raw KB tables into plain-English, relationship-oriented views.
// NO database IDs or internal codes are exposed through these helpers — every
// returned label is human-readable. Engine logic itself lives in rulesEngine.ts.
// ============================================================================

import municipalitiesJson from "../../kb/municipalities.json";
import businessTypesJson from "../../kb/business_types.json";
import questionsJson from "../../kb/questions.json";
import documentsJson from "../../kb/documents.json";
import rulesJson from "../../kb/rules.json";
import industriesJson from "../../kb/industries.json";
import businessTypeQuestionsJson from "../../kb/business_type_questions.json";
import type { KnowledgeBase, KBRule } from "../rulesEngine";

export interface Municipality { id: string; name: string; flags: string[] }
export interface Industry { id: string; name: string; description: string }
export interface BusinessType { id: string; industry_id: string; name: string; description: string }
export interface Question { id: string; question: string; type: string; options?: string[] }
export interface DocumentRec { id: string; name: string; agency: string; category: string }
export interface BTQuestion { business_type_id: string; question_id: string }

export const municipalities = municipalitiesJson as Municipality[];
export const industries = industriesJson as Industry[];
export const businessTypes = businessTypesJson as BusinessType[];
export const questions = questionsJson as Question[];
export const documents = documentsJson as DocumentRec[];
export const rules = rulesJson as KBRule[];
export const businessTypeQuestions = businessTypeQuestionsJson as BTQuestion[];

export const KB: KnowledgeBase = {
  municipalities: municipalities as never,
  businessTypes: businessTypes as never,
  questions: questions as never,
  documents: documents as never,
  rules: rules as never,
};

// ---- lookup maps --------------------------------------------------------
export const industryById = Object.fromEntries(industries.map((i) => [i.id, i]));
export const businessTypeById = Object.fromEntries(businessTypes.map((b) => [b.id, b]));
export const questionById = Object.fromEntries(questions.map((q) => [q.id, q]));
export const documentById = Object.fromEntries(documents.map((d) => [d.id, d]));

// ---- friendly labels ----------------------------------------------------
export const FLAG_LABELS: Record<string, string> = {
  tourism: "Tourism Zone",
  coastal: "Coastal",
  historic: "Historic District",
  metro: "Metro Area",
  island: "Island Municipality",
  capital: "Capital (San Juan)",
};

export const FLAG_COLORS: Record<string, string> = {
  tourism: "#0ea5e9",
  coastal: "#06b6d4",
  historic: "#a16207",
  metro: "#6366f1",
  island: "#10b981",
  capital: "#ec4899",
};

export function flagLabel(flag: string): string {
  return FLAG_LABELS[flag] || flag;
}

// ---- relationship helpers ----------------------------------------------

// Questions that apply to a given business type (plain question objects).
export function questionsForBusinessType(btId: string): Question[] {
  const ids = businessTypeQuestions.filter((x) => x.business_type_id === btId).map((x) => x.question_id);
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const q = questionById[id];
    if (q) out.push(q);
  }
  return out;
}

// Business types belonging to an industry.
export function businessTypesForIndustry(industryId: string): BusinessType[] {
  return businessTypes.filter((b) => b.industry_id === industryId);
}

// Universal documents required for every registered business.
export function universalDocuments(): DocumentRec[] {
  const ids = rules.filter((r) => r.rule_type === "municipality").map((r) => r.requires_document_id);
  return uniqueDocs(ids);
}

// Plain-English explanation of why a rule requires its document.
export function explainRule(rule: KBRule): string {
  switch (rule.rule_type) {
    case "municipality":
      return "Required for every registered business in Puerto Rico";
    case "business_type": {
      const bt = rule.business_type_id ? businessTypeById[rule.business_type_id] : null;
      return bt ? `Required for ${bt.name}` : "Required for this business type";
    }
    case "question_trigger": {
      const q = rule.question_id ? questionById[rule.question_id] : null;
      const ans = rule.expected_answer && rule.expected_answer !== "true" ? `"${rule.expected_answer}"` : "Yes";
      return q ? `Triggered when "${q.question}" is answered ${ans}` : "Triggered by a discovery answer";
    }
    case "municipality_flag": {
      const label = rule.municipality_flag ? flagLabel(rule.municipality_flag) : "certain";
      const bt = rule.business_type_id ? businessTypeById[rule.business_type_id] : null;
      return bt
        ? `Required for ${bt.name} in ${label} municipalities`
        : `Required for businesses in ${label} municipalities`;
    }
    default:
      return "Required by municipal regulation";
  }
}

// Documents potentially required for a business type, with the reason for each.
// Includes: universal baseline, business-type rules, and question triggers for
// questions that apply to this business type.
export interface DocReason {
  document: DocumentRec;
  reason: string;
  triggerType: "universal" | "business_type" | "question" | "flag";
  questionText?: string;
  flag?: string;
}

export function documentsForBusinessType(btId: string): DocReason[] {
  const out: DocReason[] = [];
  const seen = new Set<string>();
  const push = (docId: string, reason: string, triggerType: DocReason["triggerType"], extra?: Partial<DocReason>) => {
    if (seen.has(docId)) return;
    const d = documentById[docId];
    if (!d) return;
    seen.add(docId);
    out.push({ document: d, reason, triggerType, ...extra });
  };

  // 1. Universal
  for (const r of rules.filter((r) => r.rule_type === "municipality")) {
    push(r.requires_document_id, explainRule(r), "universal");
  }
  // 2. Direct business-type rules
  for (const r of rules.filter((r) => r.rule_type === "business_type" && r.business_type_id === btId)) {
    push(r.requires_document_id, explainRule(r), "business_type");
  }
  // 3. Question triggers for applicable questions
  const applicable = new Set(questionsForBusinessType(btId).map((q) => q.id));
  for (const r of rules.filter((r) => r.rule_type === "question_trigger" && r.question_id && applicable.has(r.question_id))) {
    const q = r.question_id ? questionById[r.question_id] : null;
    push(r.requires_document_id, explainRule(r), "question", { questionText: q?.question });
  }
  // 4. Flag rules tied to this business type
  for (const r of rules.filter((r) => r.rule_type === "municipality_flag" && r.business_type_id === btId)) {
    push(r.requires_document_id, explainRule(r), "flag", { flag: r.municipality_flag || undefined });
  }
  return out;
}

// Business types that require a given document (directly or via their questions).
export function businessTypesRequiringDocument(docId: string): BusinessType[] {
  const result = new Set<string>();
  // Direct business_type rules
  for (const r of rules.filter((r) => r.rule_type === "business_type" && r.requires_document_id === docId)) {
    if (r.business_type_id) result.add(r.business_type_id);
  }
  // Flag rules tied to a business type
  for (const r of rules.filter((r) => r.rule_type === "municipality_flag" && r.requires_document_id === docId && r.business_type_id)) {
    if (r.business_type_id) result.add(r.business_type_id);
  }
  // Question triggers: any business type whose applicable questions include the trigger
  const triggerQuestions = rules
    .filter((r) => r.rule_type === "question_trigger" && r.requires_document_id === docId && r.question_id)
    .map((r) => r.question_id as string);
  if (triggerQuestions.length) {
    const tqSet = new Set(triggerQuestions);
    for (const link of businessTypeQuestions) {
      if (tqSet.has(link.question_id)) result.add(link.business_type_id);
    }
  }
  return [...result].map((id) => businessTypeById[id]).filter(Boolean);
}

// Plain-English reasons a document can be required.
export interface DocumentTrigger {
  reason: string;
  triggerType: "universal" | "business_type" | "question" | "flag";
}
export function triggersForDocument(docId: string): DocumentTrigger[] {
  const out: DocumentTrigger[] = [];
  const seen = new Set<string>();
  for (const r of rules.filter((r) => r.requires_document_id === docId)) {
    const reason = explainRule(r);
    if (seen.has(reason)) continue;
    seen.add(reason);
    const triggerType =
      r.rule_type === "municipality"
        ? "universal"
        : r.rule_type === "municipality_flag"
        ? "flag"
        : r.rule_type === "question_trigger"
        ? "question"
        : "business_type";
    out.push({ reason, triggerType });
  }
  return out;
}

// Documents triggered by a specific question (plain docs).
export function documentsForQuestion(questionId: string): DocumentRec[] {
  const ids = rules
    .filter((r) => r.rule_type === "question_trigger" && r.question_id === questionId)
    .map((r) => r.requires_document_id);
  return uniqueDocs(ids);
}

// Questions that, when answered Yes, trigger a given document.
export function questionsTriggeringDocument(docId: string): Question[] {
  const ids = rules
    .filter((r) => r.rule_type === "question_trigger" && r.requires_document_id === docId && r.question_id)
    .map((r) => r.question_id as string);
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (questionById[id]) out.push(questionById[id]);
  }
  return out;
}

export function agenciesForDocuments(docs: DocumentRec[]): string[] {
  return [...new Set(docs.map((d) => d.agency))];
}

function uniqueDocs(ids: string[]): DocumentRec[] {
  const seen = new Set<string>();
  const out: DocumentRec[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (documentById[id]) out.push(documentById[id]);
  }
  return out;
}
