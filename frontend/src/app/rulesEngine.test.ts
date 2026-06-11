// Automated tests for the SmartPR rules engine.
// Run: node --experimental-strip-types --test src/app/rulesEngine.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runRulesEngine, type KnowledgeBase, type EngineInput } from "./rulesEngine.ts";

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

const run = (businessTypeName: string, answers: Record<string, boolean> = {}, municipalityName = "San Juan") => {
  const input: EngineInput = { municipalityName, businessTypeName, answers };
  return runRulesEngine(KB, input).debug.documentsGenerated;
};

const UNIVERSAL = ["DOC_CERT_INCORPORATION", "DOC_EIN", "DOC_MERCHANT_REGISTRATION", "DOC_PATENTE_MUNICIPAL", "DOC_MUNICIPAL_REGISTRATION", "DOC_MUNICIPAL_TAX_COMPLIANCE"];
const has = (docs: string[], ...ids: string[]) => ids.every((id) => docs.includes(id));
const lacks = (docs: string[], ...ids: string[]) => ids.every((id) => !docs.includes(id));

test("universal baseline applies to every business", () => {
  const docs = run("Software Company");
  assert.ok(has(docs, ...UNIVERSAL), "missing universal docs: " + docs.join(","));
});

test("Restaurant requires health permit, fire cert, CFPM", () => {
  const docs = run("Restaurant", { Q_PHYSICAL_LOCATION: true });
  assert.ok(has(docs, "DOC_HEALTH_PERMIT", "DOC_FIRE_CERT", "DOC_CFPM", "DOC_PERMISO_UNICO"));
  assert.ok(has(docs, ...UNIVERSAL));
});

test("Restaurant + Alcohol adds alcohol license", () => {
  const docs = run("Restaurant", { Q_ALCOHOL_SOLD: true });
  assert.ok(has(docs, "DOC_ALCOHOL_LICENSE"));
});

test("Restaurant + Outdoor Seating adds outdoor seating authorization", () => {
  const docs = run("Restaurant", { Q_OUTDOOR_SEATING: true });
  assert.ok(has(docs, "DOC_OUTDOOR_SEATING_AUTH"));
});

test("Software Company has baseline but NO health/fire/alcohol", () => {
  const docs = run("Software Company");
  assert.ok(has(docs, ...UNIVERSAL));
  assert.ok(lacks(docs, "DOC_HEALTH_PERMIT", "DOC_FIRE_CERT", "DOC_ALCOHOL_LICENSE", "DOC_CFPM"));
});

test("Medical Office requires professional license + health + medical waste", () => {
  const docs = run("Medical Office");
  assert.ok(has(docs, "DOC_PROFESSIONAL_LICENSE", "DOC_HEALTH_PERMIT", "DOC_MEDICAL_WASTE_PERMIT"));
});

test("Airbnb requires tourism registration and patente municipal", () => {
  const docs = run("Airbnb / Short-Term Rental");
  assert.ok(has(docs, "DOC_TOURISM_REGISTRATION", "DOC_PATENTE_MUNICIPAL"));
});

test("Contractor requires contractor license + workers comp", () => {
  const docs = run("General Contractor");
  assert.ok(has(docs, "DOC_CONTRACTOR_LICENSE", "DOC_WORKERS_COMP"));
});

test("Food Truck requires health permit, fire cert, CFPM", () => {
  const docs = run("Food Truck");
  assert.ok(has(docs, "DOC_HEALTH_PERMIT", "DOC_FIRE_CERT", "DOC_CFPM"));
});

test("Retail (Clothing Store) gets baseline, no health permit by default", () => {
  const docs = run("Clothing Store");
  assert.ok(has(docs, ...UNIVERSAL));
  assert.ok(lacks(docs, "DOC_HEALTH_PERMIT"));
});

test("Salon requires health/sanitary permit", () => {
  const docs = run("Beauty Salon");
  assert.ok(has(docs, "DOC_HEALTH_PERMIT"));
});

test("municipality flag (tourism) + Airbnb yields tourism registration via flag rule", () => {
  const sj = runRulesEngine(KB, { municipalityName: "San Juan", businessTypeName: "Airbnb / Short-Term Rental", answers: {} });
  const flagRule = sj.debug.rulesMatched.find((r) => r.rule_type === "municipality_flag" && r.document_id === "DOC_TOURISM_REGISTRATION");
  assert.ok(flagRule, "expected a tourism municipality_flag rule to match");
});

test("no municipality selected yields no universal municipality docs", () => {
  const docs = runRulesEngine(KB, { municipalityName: null, businessTypeName: "Restaurant", answers: {} }).debug.documentsGenerated;
  assert.ok(lacks(docs, "DOC_PATENTE_MUNICIPAL"));
});
