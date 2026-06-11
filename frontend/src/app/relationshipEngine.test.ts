// Tests for the relationship/explainability engine.
// Run: node --experimental-strip-types --test src/app/relationshipEngine.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runRulesEngine, type KnowledgeBase } from "./rulesEngine.ts";
import { enrichRequirements } from "./relationshipEngine.ts";

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

const enrich = (businessTypeName: string, answers = {}, municipalityName = "San Juan") =>
  enrichRequirements(KB, runRulesEngine(KB, { municipalityName, businessTypeName, answers }));

test("every rule-based requirement has 100% confidence", () => {
  const reqs = enrich("Restaurant", { Q_PHYSICAL_LOCATION: true, Q_FOOD_PREPARED: true });
  assert.ok(reqs.length > 0);
  assert.ok(reqs.every((r) => r.confidence === 100), "all rule-based reqs are deterministic (100%)");
});

test("Health Permit explains via Business Type and Operations factors", () => {
  const reqs = enrich("Restaurant", { Q_PHYSICAL_LOCATION: true, Q_FOOD_PREPARED: true, Q_FOOD_SERVED: true });
  const health = reqs.find((r) => r.document_id === "DOC_HEALTH_PERMIT");
  assert.ok(health, "Health Permit present");
  const factors = new Set(health!.reasons.map((x) => x.factor));
  assert.ok(factors.has("business_type"), "explained by Business Type");
  // Agency context line is always appended.
  assert.ok(health!.reasons.some((x) => x.factor === "agency"));
});

test("reasons are ordered by influence weight (heaviest first)", () => {
  const reqs = enrich("Restaurant", { Q_ALCOHOL_SOLD: true });
  for (const r of reqs) {
    const scored = r.reasons.filter((x) => x.factor !== "agency");
    for (let i = 1; i < scored.length; i++) {
      assert.ok(scored[i - 1].weight >= scored[i].weight, "reasons sorted by weight desc");
    }
  }
});

test("universal baseline documents read as Baseline factor", () => {
  const reqs = enrich("Software Company");
  const ein = reqs.find((r) => r.document_id === "DOC_EIN");
  assert.ok(ein, "EIN present");
  assert.ok(ein!.reasons.some((x) => x.factor === "universal"), "EIN explained as baseline");
});
