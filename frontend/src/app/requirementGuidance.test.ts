// Automated tests for the requirement-guidance content model.
// Run: node --experimental-strip-types --test src/app/requirementGuidance.test.ts
//
// Two things this file exists to catch:
//   1. A hand-written guidance entry regressing into the banned generic
//      template pattern (validateRequirementGuidance).
//   2. Two DIFFERENT requirements, for the SAME project, producing
//      substantially the same explanation — the "swap the title and it still
//      sounds reasonable" failure mode the product spec calls out explicitly.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildRequirementGuidance, validateRequirementGuidance, type GuidanceRequirement } from "./requirementGuidance.ts";
import type { KnowledgeBase } from "./rulesEngine.ts";

const here = dirname(fileURLToPath(import.meta.url));
const kbDir = join(here, "..", "kb");
const load = (f: string) => JSON.parse(readFileSync(join(kbDir, f), "utf8"));
const KB: KnowledgeBase = {
  municipalities: load("municipalities.json"),
  businessTypes: load("business_types.json"),
  questions: load("questions.json"),
  documents: load("documents.json"),
  rules: load("rules.json"),
};

// The Bayamón bar fixture from the product spec: a bar that sells alcohol,
// hires employees, leases its location, and forms as an LLC.
const BAR_CTX = {
  language: "en" as const,
  municipality: "Bayamón",
  businessTypeName: "Bar",
  discoveryAnswers: { alcohol_sold: true, employees_hired: true, existing_lease: true },
  entityType: "limited_liability_company",
  kb: KB,
};

function reqFor(documentId: string, name: string, agency: string): GuidanceRequirement {
  const doc = KB.documents.find((d) => d.id === documentId);
  return { document_id: documentId, code: documentId.toLowerCase(), name: doc?.name ?? name, agency: doc?.agency ?? agency, reason: `Business Type = ${BAR_CTX.businessTypeName}` };
}

const HAND_WRITTEN_DOCS: { id: string; name: string; agency: string }[] = [
  { id: "DOC_ALCOHOL_LICENSE", name: "Alcohol Beverage License", agency: "Departamento de Hacienda" },
  { id: "DOC_EIN", name: "IRS EIN Confirmation Letter", agency: "IRS" },
  { id: "DOC_PATENTE_MUNICIPAL", name: "Patente Municipal", agency: "Municipal Government" },
  { id: "DOC_MERCHANT_REGISTRATION", name: "Merchant Registration Certificate", agency: "Departamento de Hacienda" },
  { id: "DOC_PERMISO_UNICO", name: "Permiso Único", agency: "OGPe" },
  { id: "DOC_LEASE_AGREEMENT", name: "Lease Agreement", agency: "Property Owner" },
  { id: "DOC_ARTICLES_ORGANIZATION", name: "Articles of Organization", agency: "Department of State" },
  { id: "DOC_CERT_INCORPORATION", name: "Certificate of Incorporation", agency: "Department of State" },
  { id: "DOC_WORKERS_COMP", name: "Workers Compensation Insurance (CFSE)", agency: "Corporación del Fondo del Seguro del Estado" },
  { id: "DOC_TOURISM_REGISTRATION", name: "Tourism Registration", agency: "Compañía de Turismo" },
  { id: "DOC_ROOM_TAX_RETURN", name: "Room Tax Monthly Return", agency: "Compañía de Turismo" },
  { id: "DOC_HOA_AUTHORIZATION", name: "Condo / HOA Short-Term Rental Authorization", agency: "Property Owner / Homeowners Association" },
];

test("every hand-written requirement gets guidance with needsReview = false", () => {
  for (const d of HAND_WRITTEN_DOCS) {
    const guidance = buildRequirementGuidance(reqFor(d.id, d.name, d.agency), BAR_CTX);
    assert.equal(guidance.needsReview, false, `${d.id} unexpectedly fell back to the generic template`);
  }
});

test("hand-written guidance passes structural + banned-phrase validation", () => {
  for (const d of HAND_WRITTEN_DOCS) {
    const guidance = buildRequirementGuidance(reqFor(d.id, d.name, d.agency), BAR_CTX);
    const violations = validateRequirementGuidance(guidance, reqFor(d.id, d.name, d.agency));
    assert.deepEqual(violations, [], `${d.id} guidance failed validation: ${JSON.stringify(violations)}`);
  }
});

test("a document with no registered builder is honestly flagged, not filled with generic prose", () => {
  const req = reqFor("DOC_CFPM", "CFPM Certificate", "Departamento de Salud");
  const guidance = buildRequirementGuidance(req, BAR_CTX);
  assert.equal(guidance.needsReview, true);
  assert.match(guidance.whyThisApplies, /not yet been fully validated/i);
});

// The critical acceptance test: for the same fixture, no two of these
// requirements' core explanation should be interchangeable. If swapping the
// requirement's title between two of them would still read as plausible,
// the explanation is too generic.
test("distinct requirements for the same business get materially different explanations", () => {
  const guidances = HAND_WRITTEN_DOCS
    .filter((d) => d.id !== "DOC_TOURISM_REGISTRATION" && d.id !== "DOC_ROOM_TAX_RETURN" && d.id !== "DOC_HOA_AUTHORIZATION")
    .map((d) => ({ id: d.id, guidance: buildRequirementGuidance(reqFor(d.id, d.name, d.agency), BAR_CTX) }));

  // No two whyThisApplies (or whatThisIs) strings are identical.
  const whys = guidances.map((g) => g.guidance.whyThisApplies);
  assert.equal(new Set(whys).size, whys.length, "two requirements share an identical whyThisApplies");
  const whats = guidances.map((g) => g.guidance.whatThisIs);
  assert.equal(new Set(whats).size, whats.length, "two requirements share an identical whatThisIs");

  // Each requirement's explanation contains at least one concrete, distinguishing
  // keyword that would NOT make sense if swapped onto an unrelated requirement.
  const mustContain: Record<string, RegExp> = {
    DOC_ALCOHOL_LICENSE: /alcohol/i,
    DOC_EIN: /federal tax|EIN/i,
    DOC_PATENTE_MUNICIPAL: /municipal/i,
    DOC_MERCHANT_REGISTRATION: /merchant|Hacienda/i,
    DOC_PERMISO_UNICO: /physical location|operating[- ]permit/i,
    DOC_LEASE_AGREEMENT: /lease/i,
    DOC_ARTICLES_ORGANIZATION: /LLC/i,
    DOC_CERT_INCORPORATION: /corporation/i,
    DOC_WORKERS_COMP: /employ|workforce/i,
  };
  for (const { id, guidance } of guidances) {
    const pattern = mustContain[id];
    const combined = `${guidance.whyThisApplies} ${guidance.whatThisIs}`;
    assert.match(combined, pattern, `${id} explanation is missing its distinguishing concept (${pattern})`);
  }
});

test("Alcohol License trigger tags reflect the actual activity, not raw graph concatenation", () => {
  const guidance = buildRequirementGuidance(reqFor("DOC_ALCOHOL_LICENSE", "Alcohol Beverage License", "Departamento de Hacienda"), BAR_CTX);
  assert.ok(guidance.triggeredBy.some((t) => /alcohol/i.test(t)));
  for (const tag of guidance.triggeredBy) assert.ok(!/[a-z][A-Z]/.test(tag), `raw concatenated tag: ${tag}`);
});

test("EIN and Merchant Registration do not mention municipality — it isn't the trigger", () => {
  for (const id of ["DOC_EIN", "DOC_MERCHANT_REGISTRATION"]) {
    const d = HAND_WRITTEN_DOCS.find((x) => x.id === id)!;
    const guidance = buildRequirementGuidance(reqFor(d.id, d.name, d.agency), BAR_CTX);
    assert.ok(!guidance.triggeredBy.some((t) => t === "Bayamón"), `${id} should not list municipality as a trigger`);
  }
});

test("Patente Municipal and Permiso Único DO mention municipality — it is the trigger", () => {
  for (const id of ["DOC_PATENTE_MUNICIPAL", "DOC_PERMISO_UNICO"]) {
    const d = HAND_WRITTEN_DOCS.find((x) => x.id === id)!;
    const guidance = buildRequirementGuidance(reqFor(d.id, d.name, d.agency), BAR_CTX);
    assert.ok(guidance.triggeredBy.some((t) => t === "Bayamón"), `${id} should list municipality as a trigger`);
  }
});
