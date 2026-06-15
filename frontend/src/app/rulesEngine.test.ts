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

// ============================================================================
// municipality_flag composite coverage (phases 1-3). These lock in the per-BT
// rules so future KB edits can't silently drop a town's requirements.
// ============================================================================

test("Restaurant in Bayamón (metro) gets metro baseline + restaurant traffic study", () => {
  const docs = run("Restaurant", {}, "Bayamón");
  assert.ok(has(docs, "DOC_STORMWATER_PLAN", "DOC_WASTE_COLLECTION_CONTRACT", "DOC_PARKING_COMPLIANCE"),
    "metro universal triad missing: " + docs.join(","));
  assert.ok(has(docs, "DOC_TRAFFIC_IMPACT_STUDY"), "metro+restaurant composite missing");
});

test("Software Company in San Juan stays at universal baseline (no traffic/loading/noise)", () => {
  const docs = run("Software Company");
  assert.ok(has(docs, "DOC_STORMWATER_PLAN", "DOC_WASTE_COLLECTION_CONTRACT", "DOC_PARKING_COMPLIANCE"),
    "metro universal triad should still apply to office uses");
  assert.ok(lacks(docs, "DOC_TRAFFIC_IMPACT_STUDY", "DOC_LOADING_ZONE_PERMIT", "DOC_NOISE_VARIANCE"),
    "office-only BT must not pick up per-BT metro composites");
});

test("Hotel in San Juan picks up historic + capital + tourism composites", () => {
  const docs = run("Hotel");
  assert.ok(has(docs, "DOC_FACADE_PRESERVATION"), "historic universal facade preservation missing");
  assert.ok(has(docs, "DOC_HISTORIC_DISTRICT_REVIEW", "DOC_SIGN_VARIANCE_HISTORIC"),
    "historic+hotel composites missing");
  assert.ok(has(docs, "DOC_SAN_JUAN_USE_PERMIT"), "capital universal use permit missing");
});

test("Restaurant in Ponce gets historic composites + metro baseline", () => {
  const docs = run("Restaurant", {}, "Ponce");
  assert.ok(has(docs, "DOC_HISTORIC_DISTRICT_REVIEW", "DOC_SIGN_VARIANCE_HISTORIC"),
    "historic+restaurant composites missing in Ponce");
  assert.ok(has(docs, "DOC_PARKING_COMPLIANCE", "DOC_STORMWATER_PLAN"), "metro baseline missing in Ponce");
});

test("Art Gallery in San Germán picks up historic sign variance", () => {
  const docs = run("Art Gallery", {}, "San Germán");
  assert.ok(has(docs, "DOC_SIGN_VARIANCE_HISTORIC", "DOC_FACADE_PRESERVATION"));
  // San Germán is historic but not metro — metro triad should NOT fire.
  assert.ok(lacks(docs, "DOC_STORMWATER_PLAN", "DOC_WASTE_COLLECTION_CONTRACT"),
    "non-metro historic town shouldn't pick up metro baseline");
});

test("Hotel in Vieques gets island ferry manifest + waste contract + tourism", () => {
  const docs = run("Hotel", {}, "Vieques");
  assert.ok(has(docs, "DOC_ISLAND_FERRY_MANIFEST"), "island+hotel ferry manifest missing");
  assert.ok(has(docs, "DOC_WASTE_COLLECTION_CONTRACT"), "island universal waste contract missing");
  assert.ok(has(docs, "DOC_TOURISM_REGISTRATION"), "tourism+hotel registration missing");
});

test("Restaurant in Culebra picks up island ferry logistics", () => {
  const docs = run("Restaurant", {}, "Culebra");
  assert.ok(has(docs, "DOC_ISLAND_FERRY_MANIFEST"), "island+restaurant ferry manifest missing");
  assert.ok(has(docs, "DOC_WASTE_COLLECTION_CONTRACT"));
});

test("Architecture Firm in San Juan gets metro fill-in traffic + loading", () => {
  const docs = run("Architecture Firm");
  assert.ok(has(docs, "DOC_TRAFFIC_IMPACT_STUDY", "DOC_LOADING_ZONE_PERMIT"),
    "architecture firm metro fill-in missing");
});

test("Tutoring Center in metro town gets traffic study (parent drop-off)", () => {
  const docs = run("Tutoring Center", {}, "Caguas");
  assert.ok(has(docs, "DOC_TRAFFIC_IMPACT_STUDY"),
    "tutoring center metro fill-in for parent drop-off missing");
});

test("Restaurant in Adjuntas (no flags) gets none of the flag-driven docs", () => {
  const docs = run("Restaurant", {}, "Adjuntas");
  assert.ok(lacks(docs,
    "DOC_TRAFFIC_IMPACT_STUDY", "DOC_LOADING_ZONE_PERMIT", "DOC_NOISE_VARIANCE",
    "DOC_STORMWATER_PLAN", "DOC_HISTORIC_DISTRICT_REVIEW", "DOC_ISLAND_FERRY_MANIFEST",
    "DOC_FACADE_PRESERVATION", "DOC_SAN_JUAN_USE_PERMIT"),
    "Adjuntas has no flags — no flag-driven docs should fire");
});

// ----- Phase 4: popular non-metro beach + north-coast + SJ-corridor coverage -----

test("Hotel in Fajardo (tourism+coastal) gets DRNA env permit + tourism reg", () => {
  const docs = run("Hotel", {}, "Fajardo");
  assert.ok(has(docs, "DOC_ENVIRONMENTAL_PERMIT"), "coastal+hotel DRNA permit missing");
  assert.ok(has(docs, "DOC_TOURISM_REGISTRATION"), "tourism+hotel registration missing");
});

test("Gift Shop in Fajardo (tourism+coastal) picks up tourism reg + sign permit + coastal env", () => {
  const docs = run("Gift Shop", {}, "Fajardo");
  assert.ok(has(docs, "DOC_TOURISM_REGISTRATION", "DOC_SIGN_PERMIT"),
    "tourism retail composites missing");
  assert.ok(has(docs, "DOC_ENVIRONMENTAL_PERMIT"),
    "coastal small-retail env permit missing");
});

test("Food Truck in Aguadilla (tourism+coastal) gets tourism reg", () => {
  const docs = run("Food Truck", {}, "Aguadilla");
  assert.ok(has(docs, "DOC_TOURISM_REGISTRATION"));
});

test("Arecibo gains tourism flag → Hotel gets tourism registration", () => {
  const docs = run("Hotel", {}, "Arecibo");
  assert.ok(has(docs, "DOC_TOURISM_REGISTRATION"),
    "Arecibo Observatory / karst eco-tourism: hotel should register with Compañía de Turismo");
});

test("Toa Alta gains metro flag → Restaurant picks up full metro baseline", () => {
  const docs = run("Restaurant", {}, "Toa Alta");
  assert.ok(has(docs, "DOC_STORMWATER_PLAN", "DOC_WASTE_COLLECTION_CONTRACT",
    "DOC_PARKING_COMPLIANCE", "DOC_TRAFFIC_IMPACT_STUDY"),
    "Toa Alta is now metro — restaurant metro composites should fire");
});

test("Trujillo Alto (metro) — Dental Office gets metro baseline + dental traffic/env", () => {
  const docs = run("Dental Office", {}, "Trujillo Alto");
  assert.ok(has(docs, "DOC_STORMWATER_PLAN", "DOC_TRAFFIC_IMPACT_STUDY",
    "DOC_ENVIRONMENTAL_PERMIT"));
});

// ----- Phase 5: industrial_port flag (Ponce/Cataño/Guayanilla/Salinas/Yabucoa) ---

test("Chemical Mfg in Ponce (industrial_port) gets all heavy-industry docs", () => {
  const docs = run("Chemical Manufacturing", {}, "Ponce");
  assert.ok(has(docs,
    "DOC_NPDES_INDUSTRIAL", "DOC_HAZMAT_HANDLER", "DOC_AIR_EMISSION_PERMIT"),
    "industrial_port + chem mfg should fire NPDES + RCRA + Title V");
});

test("Pharmaceutical Mfg in Guayanilla gets the full industrial heavy triad", () => {
  const docs = run("Pharmaceutical Manufacturing", {}, "Guayanilla");
  assert.ok(has(docs,
    "DOC_NPDES_INDUSTRIAL", "DOC_HAZMAT_HANDLER", "DOC_AIR_EMISSION_PERMIT"));
});

test("Freight Forwarding in Cataño gets port facility permit", () => {
  const docs = run("Freight Forwarding Company", {}, "Cataño");
  assert.ok(has(docs, "DOC_PORT_FACILITY_PERMIT"));
});

test("Body Shop in Salinas picks up RCRA hazmat handler (solvent / paint waste)", () => {
  const docs = run("Body Shop", {}, "Salinas");
  assert.ok(has(docs, "DOC_HAZMAT_HANDLER"));
});

test("Restaurant in Ponce does NOT pick up industrial-port docs", () => {
  // Negative control: industrial_port composites are per-BT, not universal —
  // a restaurant in an industrial-port town must NOT get NPDES/Title V/etc.
  const docs = run("Restaurant", {}, "Ponce");
  assert.ok(lacks(docs,
    "DOC_NPDES_INDUSTRIAL", "DOC_HAZMAT_HANDLER",
    "DOC_AIR_EMISSION_PERMIT", "DOC_PORT_FACILITY_PERMIT"),
    "non-industrial BT in industrial_port town must not pick up heavy docs");
});

test("Chemical Mfg in San Juan does NOT get industrial-port docs (SJ lacks flag)", () => {
  // Negative control: the heavy-industry rules only fire on the industrial_port
  // flag, NOT just because a chem facility is in a metro town.
  const docs = run("Chemical Manufacturing", {}, "San Juan");
  assert.ok(lacks(docs,
    "DOC_NPDES_INDUSTRIAL", "DOC_AIR_EMISSION_PERMIT", "DOC_PORT_FACILITY_PERMIT"),
    "industrial_port composites must not fire in San Juan");
});

// ----- Phase 6: airport_host flag (Carolina LMM, Aguadilla BQN, Ponce Mercedita) ---

test("Freight Forwarding in Carolina (LMM) gets CBP bond + TSA known shipper", () => {
  const docs = run("Freight Forwarding Company", {}, "Carolina");
  assert.ok(has(docs, "DOC_CUSTOMS_BROKER_BOND", "DOC_TSA_KNOWN_SHIPPER"),
    "airport_host + freight forwarder federal compliance missing");
});

test("Car Rental in Aguadilla (BQN) gets airport concession agreement", () => {
  const docs = run("Car Rental Business", {}, "Aguadilla");
  assert.ok(has(docs, "DOC_AIRPORT_CONCESSION"),
    "airport_host + car rental concession missing");
});

test("Import/Export in Ponce (Mercedita) gets CBP customs broker bond", () => {
  const docs = run("Import / Export Business", {}, "Ponce");
  assert.ok(has(docs, "DOC_CUSTOMS_BROKER_BOND"));
});

test("Restaurant in Carolina does NOT pick up airport-host federal docs", () => {
  // Negative control: airport_host composites are per-BT — restaurants don't
  // need a customs bond just because they're in an airport-host town.
  const docs = run("Restaurant", {}, "Carolina");
  assert.ok(lacks(docs,
    "DOC_CUSTOMS_BROKER_BOND", "DOC_TSA_KNOWN_SHIPPER", "DOC_AIRPORT_CONCESSION"),
    "non-aviation BT in airport_host town must not pick up federal aviation docs");
});

test("Freight Forwarding in San Juan (no airport flag) gets no airport docs", () => {
  // Negative control: the rules fire on the flag, not on proximity guesses.
  const docs = run("Freight Forwarding Company");  // default municipality = San Juan
  assert.ok(lacks(docs, "DOC_CUSTOMS_BROKER_BOND", "DOC_TSA_KNOWN_SHIPPER", "DOC_AIRPORT_CONCESSION"),
    "airport_host composites must NOT fire in San Juan (no flag)");
});
