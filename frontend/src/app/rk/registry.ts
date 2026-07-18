// ============================================================================
// Regulatory Knowledge Graph — node-type registry (CLIENT-SAFE, pure data).
//
// One registry drives three things so they can never drift:
//   1. The DetailPanel edit forms (FieldSpec[] per node type).
//   2. Server-side validation of node data on writes.
//   3. Edge derivation: edgesOf(data) — relationships are projections of ref
//      fields inside the canonical `data` jsonb, recomputed on every write.
// ============================================================================

import type { EdgeType, NodeType } from "./types";

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "flags"
  | "entity_ref"
  | "entity_ref_list";

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** for kind=select */
  options?: string[];
  /** for kind=entity_ref / entity_ref_list: which node type it points to */
  refType?: NodeType;
  help?: string;
  /** warn before renaming — the rules engine matches some entities by name */
  renameWarning?: boolean;
}

export interface DerivedEdge {
  edgeType: EdgeType;
  toEntity: string;
}

export interface NodeTypeConfig {
  type: NodeType;
  label: string;
  plural: string;
  color: string;
  fields: FieldSpec[];
  /** derive relationship edges from canonical data */
  edgesOf: (data: Record<string, unknown>) => DerivedEdge[];
  /** human label for a node from its data */
  labelOf: (data: Record<string, unknown>) => string;
}

// Municipality flags are open-ended strings (the bundled KB already uses more
// flags than the engine's TS union — treat as opaque, never validate the union).
export const KNOWN_FLAGS = [
  "tourism",
  "coastal",
  "historic",
  "metro",
  "island",
  "capital",
  "industrial_port",
  "airport_host",
];

export const DOC_KINDS = [
  "permit",
  "license",
  "registration",
  "certificate",
  "supporting_doc",
  "form",
  "other",
];

export const RULE_TYPES = [
  "business_type",
  "question_trigger",
  "municipality",
  "municipality_flag",
];

export const MANDATORINESS = ["mandatory", "conditional", "informational"];

const s = (v: unknown): string => (typeof v === "string" ? v : "");
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function pushRef(out: DerivedEdge[], edgeType: EdgeType, v: unknown) {
  const id = s(v);
  if (id) out.push({ edgeType, toEntity: id });
}

export const NODE_TYPE_CONFIGS: Record<NodeType, NodeTypeConfig> = {
  municipality: {
    type: "municipality",
    label: "Municipality",
    plural: "Municipalities",
    color: "#06b6d4",
    labelOf: (d) => s(d.name) || s(d.id),
    fields: [
      { key: "name", label: "Name", kind: "text", required: true, renameWarning: true },
      { key: "flags", label: "Flags", kind: "flags", help: "Regulatory overlays (tourism, coastal, historic…) that activate flag rules." },
      { key: "patente_rate", label: "Patente rate (decimal)", kind: "number", help: "Municipal gross-receipts tax rate, e.g. 0.005 = 0.5%. Leave blank if unknown." },
      { key: "notes", label: "Internal notes", kind: "textarea" },
    ],
    edgesOf: () => [],
  },

  industry: {
    type: "industry",
    label: "Industry",
    plural: "Industries",
    color: "#8b5cf6",
    labelOf: (d) => s(d.name) || s(d.id),
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "description", label: "Description", kind: "textarea" },
    ],
    edgesOf: () => [],
  },

  business_type: {
    type: "business_type",
    label: "Business Type",
    plural: "Business Types",
    color: "#3b82f6",
    labelOf: (d) => s(d.name) || s(d.id),
    fields: [
      { key: "name", label: "Name", kind: "text", required: true, renameWarning: true },
      { key: "industry_id", label: "Industry", kind: "entity_ref", refType: "industry", required: true },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "question_ids", label: "Intake questions asked", kind: "entity_ref_list", refType: "intake_question", help: "Which intake questions this business type asks (order preserved)." },
      { key: "activity_ids", label: "Business activities", kind: "entity_ref_list", refType: "business_activity" },
      { key: "notes", label: "Internal notes", kind: "textarea" },
    ],
    edgesOf: (d) => {
      const out: DerivedEdge[] = [];
      pushRef(out, "belongs_to", d.industry_id);
      for (const q of list(d.question_ids)) out.push({ edgeType: "asks", toEntity: q });
      for (const a of list(d.activity_ids)) out.push({ edgeType: "applies_to", toEntity: a });
      return out;
    },
  },

  business_activity: {
    type: "business_activity",
    label: "Business Activity",
    plural: "Business Activities",
    color: "#14b8a6",
    labelOf: (d) => s(d.name) || s(d.id),
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "description", label: "Description", kind: "textarea" },
    ],
    edgesOf: () => [],
  },

  intake_question: {
    type: "intake_question",
    label: "Intake Question",
    plural: "Intake Questions",
    color: "#f59e0b",
    labelOf: (d) => s(d.question) || s(d.id),
    fields: [
      { key: "question", label: "Question text", kind: "textarea", required: true },
      { key: "type", label: "Answer type", kind: "select", options: ["boolean", "single_select", "multi_select"], required: true },
      { key: "options", label: "Options (for selects)", kind: "multiselect", help: "Answer choices for single/multi select questions." },
      { key: "stage", label: "Stage", kind: "select", options: ["discovery", "profile"], help: "profile = derived from business basics, never asked directly." },
      { key: "ui_key", label: "Legacy UI key", kind: "text", help: "Answer key the intake wizard stores for this question (legacy compatibility). Leave blank for new questions." },
      { key: "guidance", label: "User guidance", kind: "textarea" },
    ],
    edgesOf: () => [],
  },

  document: {
    type: "document",
    label: "Document / Permit",
    plural: "Documents & Permits",
    color: "#10b981",
    labelOf: (d) => s(d.name) || s(d.id),
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "doc_kind", label: "Kind", kind: "select", options: DOC_KINDS, help: "Permit / license / registration / certificate / supporting document." },
      { key: "agency", label: "Agency (display name)", kind: "text", required: true, help: "Shown to users; kept as text for engine compatibility." },
      { key: "agency_id", label: "Issuing agency", kind: "entity_ref", refType: "agency" },
      { key: "category", label: "Category", kind: "select", options: ["State", "Federal", "Municipal", "Insurance", "Legal", "Health", "Safety", "Environmental", "Other"], required: true },
      { key: "recommended", label: "Recommended (not mandatory)", kind: "boolean", help: "Recommended documents don't block readiness." },
      { key: "score_weight", label: "Readiness score weight", kind: "number", help: "Relative weight in readiness scoring. Blank = equal weight." },
      { key: "order_hint", label: "Checklist order", kind: "number", help: "Lower numbers sort first in the checklist." },
      { key: "legacy_code", label: "Legacy requirement code", kind: "text", help: "Code used for upload matching / filenames. Blank = derived from id." },
      { key: "evidence_type_ids", label: "Accepted evidence types", kind: "entity_ref_list", refType: "evidence_type" },
      { key: "depends_on_document_ids", label: "Prerequisite documents", kind: "entity_ref_list", refType: "document", help: "Documents that must be obtained before this one." },
      { key: "guidance", label: "User guidance", kind: "textarea" },
      { key: "citation", label: "Regulatory citation", kind: "text" },
      { key: "notes", label: "Internal notes", kind: "textarea" },
    ],
    edgesOf: (d) => {
      const out: DerivedEdge[] = [];
      pushRef(out, "issued_by", d.agency_id);
      for (const dep of list(d.depends_on_document_ids)) out.push({ edgeType: "depends_on", toEntity: dep });
      for (const ev of list(d.evidence_type_ids)) out.push({ edgeType: "requires", toEntity: ev });
      return out;
    },
  },

  rule: {
    type: "rule",
    label: "Applicability Rule",
    plural: "Applicability Rules",
    color: "#ec4899",
    labelOf: (d) => {
      const name = s(d.requirement_name);
      if (name) return name;
      const doc = s(d.requires_document_id);
      const rt = s(d.rule_type);
      return doc ? `${rt || "rule"} → ${doc}` : s(d.id) || "rule";
    },
    fields: [
      { key: "requirement_name", label: "Requirement name", kind: "text", help: "Plain-language name shown in review screens." },
      { key: "rule_type", label: "Rule type", kind: "select", options: RULE_TYPES, required: true },
      { key: "requires_document_id", label: "Requires document", kind: "entity_ref", refType: "document", required: true },
      { key: "business_type_id", label: "Business type (business_type / flag rules)", kind: "entity_ref", refType: "business_type" },
      { key: "question_id", label: "Trigger question (question_trigger rules)", kind: "entity_ref", refType: "intake_question" },
      { key: "expected_answer", label: "Expected answer", kind: "text", help: "\"true\" for yes/no triggers, or an exact option value." },
      { key: "municipality_flag", label: "Municipality flag (flag rules)", kind: "select", options: KNOWN_FLAGS },
      { key: "mandatoriness", label: "Mandatory / conditional / informational", kind: "select", options: MANDATORINESS },
      { key: "conditions", label: "Conditions that trigger the requirement", kind: "textarea" },
      { key: "exemptions_note", label: "Exemptions", kind: "textarea" },
      { key: "guidance", label: "User guidance", kind: "textarea" },
      { key: "citation", label: "Regulatory citation", kind: "text", help: "e.g. \"PS 1173 Art. 4.2\" or \"Ley 216-2014 §3\"." },
      { key: "notes", label: "Internal notes", kind: "textarea" },
    ],
    edgesOf: (d) => {
      const out: DerivedEdge[] = [];
      pushRef(out, "requires", d.requires_document_id);
      pushRef(out, "applies_to", d.business_type_id);
      pushRef(out, "applies_to", d.question_id);
      return out;
    },
  },

  agency: {
    type: "agency",
    label: "Agency",
    plural: "Agencies",
    color: "#64748b",
    labelOf: (d) => s(d.name) || s(d.id),
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "acronym", label: "Acronym", kind: "text" },
      { key: "level", label: "Level", kind: "select", options: ["Commonwealth", "Federal", "Municipal", "Other"] },
      { key: "website", label: "Website", kind: "text" },
      { key: "description", label: "Description", kind: "textarea" },
    ],
    edgesOf: () => [],
  },

  exemption: {
    type: "exemption",
    label: "Exemption",
    plural: "Exemptions",
    color: "#f43f5e",
    labelOf: (d) => s(d.name) || s(d.id),
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "description", label: "Description", kind: "textarea", required: true },
      { key: "exempts_entity_ids", label: "Exempts (rules/documents)", kind: "entity_ref_list", refType: "rule" },
      { key: "conditions", label: "Qualifying conditions", kind: "textarea" },
      { key: "citation", label: "Regulatory citation", kind: "text" },
    ],
    edgesOf: (d) => list(d.exempts_entity_ids).map((id) => ({ edgeType: "exempts" as EdgeType, toEntity: id })),
  },

  renewal: {
    type: "renewal",
    label: "Renewal",
    plural: "Renewals",
    color: "#0ea5e9",
    labelOf: (d) => s(d.name) || s(d.id),
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "document_id", label: "Renews document", kind: "entity_ref", refType: "document", required: true },
      { key: "frequency_months", label: "Frequency (months)", kind: "number" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "citation", label: "Regulatory citation", kind: "text" },
    ],
    edgesOf: (d) => {
      const out: DerivedEdge[] = [];
      pushRef(out, "renews", d.document_id);
      return out;
    },
  },

  inspection: {
    type: "inspection",
    label: "Inspection",
    plural: "Inspections",
    color: "#d97706",
    labelOf: (d) => s(d.name) || s(d.id),
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "document_id", label: "Related document", kind: "entity_ref", refType: "document" },
      { key: "agency_id", label: "Inspecting agency", kind: "entity_ref", refType: "agency" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "citation", label: "Regulatory citation", kind: "text" },
    ],
    edgesOf: (d) => {
      const out: DerivedEdge[] = [];
      pushRef(out, "inspects", d.document_id);
      pushRef(out, "issued_by", d.agency_id);
      return out;
    },
  },

  evidence_type: {
    type: "evidence_type",
    label: "Evidence Type",
    plural: "Evidence Types",
    color: "#a855f7",
    labelOf: (d) => s(d.name) || s(d.id),
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "description", label: "Description", kind: "textarea" },
    ],
    edgesOf: () => [],
  },
};

export const NODE_TYPES = Object.keys(NODE_TYPE_CONFIGS) as NodeType[];

/** Allowed (from, edge, to) triples — powers the legend + write validation. */
export const EDGE_RULES: { from: NodeType; edge: EdgeType; to: NodeType }[] = [
  { from: "business_type", edge: "belongs_to", to: "industry" },
  { from: "business_type", edge: "asks", to: "intake_question" },
  { from: "business_type", edge: "applies_to", to: "business_activity" },
  { from: "rule", edge: "requires", to: "document" },
  { from: "rule", edge: "applies_to", to: "business_type" },
  { from: "rule", edge: "applies_to", to: "intake_question" },
  { from: "document", edge: "issued_by", to: "agency" },
  { from: "document", edge: "depends_on", to: "document" },
  { from: "document", edge: "requires", to: "evidence_type" },
  { from: "exemption", edge: "exempts", to: "rule" },
  { from: "renewal", edge: "renews", to: "document" },
  { from: "inspection", edge: "inspects", to: "document" },
  { from: "inspection", edge: "issued_by", to: "agency" },
];

export function labelForNode(nodeType: NodeType, data: Record<string, unknown>): string {
  const cfg = NODE_TYPE_CONFIGS[nodeType];
  return cfg ? cfg.labelOf(data) : String(data.id ?? "");
}

/**
 * Validate node data against the registry. Returns a list of problems
 * (empty = valid). Shared by the server routes and (optionally) the client.
 */
export function validateNodeData(nodeType: NodeType, data: Record<string, unknown>): string[] {
  const cfg = NODE_TYPE_CONFIGS[nodeType];
  if (!cfg) return [`Unknown node type: ${nodeType}`];
  const problems: string[] = [];
  for (const f of cfg.fields) {
    if (!f.required) continue;
    const v = data[f.key];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      problems.push(`Missing required field: ${f.label}`);
    }
  }
  if (nodeType === "rule") {
    const rt = s(data.rule_type);
    if (rt === "question_trigger" && !s(data.question_id)) {
      problems.push("question_trigger rules need a trigger question.");
    }
    if (rt === "business_type" && !s(data.business_type_id)) {
      problems.push("business_type rules need a business type.");
    }
    if (rt === "municipality_flag" && !s(data.municipality_flag)) {
      problems.push("municipality_flag rules need a flag.");
    }
  }
  return problems;
}

/** New entity ids: slugified, prefixed per type, uppercase to match kb style. */
export function newEntityId(nodeType: NodeType, name: string): string {
  const prefix: Record<NodeType, string> = {
    municipality: "MUN",
    industry: "IND",
    business_type: "BT",
    business_activity: "ACT",
    intake_question: "Q",
    document: "DOC",
    rule: "RULE",
    agency: "AGY",
    exemption: "EXM",
    renewal: "RNW",
    inspection: "INSP",
    evidence_type: "EVD",
  };
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${prefix[nodeType]}_${slug || Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
