// ============================================================================
// End-to-end demonstration: one sentence of intake → applicable government
// artifacts → populated working copies of the real files.
//
//   npm run forms:demo
//
// Writes to `generated-filings-demo/` using the same object layout as the
// Supabase `generated-filings` bucket. Canonical templates are never touched.
// ============================================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { resolveApplicableArtifacts } from "../src/app/forms/artifacts/applicability.ts";
import { buildFilingPackage, itemStatusLabel } from "../src/app/forms/artifacts/filingPackage.ts";
import { applyExtraction, extractIntake } from "../src/app/forms/artifacts/intakeExtraction.ts";
import { loadMunicipalities } from "../src/app/forms/artifacts/kbLoader.ts";
import {
  generateMappingPreview,
  generateWorkingCopy,
  loadAllMappings,
  outstandingQuestionsForProfile,
} from "../src/app/forms/artifacts/library.ts";
import { generatedFilingRef } from "../src/app/forms/artifacts/storage.ts";
import { repoRoot } from "../src/app/forms/artifacts/paths.ts";
import { emptyCanonicalData, type CanonicalApplicationData } from "../src/app/forms/engine/types.ts";

const DESCRIPTION = "I want to open a restaurant in Bayamón with 10 employees and outdoor seating.";
const OUT_DIR = join(repoRoot(), "generated-filings-demo");
const TENANT_ID = "demo-tenant";
const BUSINESS_ID = "demo-business";

/** The answers a user gives after the sentence — nothing already inferred is re-asked. */
function answerRemainingQuestions(base: CanonicalApplicationData): CanonicalApplicationData {
  const profile = structuredClone(base);
  profile.business.legalName = "Sabor Bayamón Inc.";
  profile.business.tradeName = "Sabor Bayamón";
  profile.business.entityType = "stock_corporation";
  profile.business.formationStatus = "not_formed";
  profile.business.forProfitStatus = "for_profit";
  profile.business.activityDescription = "Full-service restaurant with indoor and outdoor seating.";
  profile.business.email = "hola@saborbayamon.com";
  profile.business.phone = "787-555-0142";
  profile.business.operationsStartDate = "2026-10-01";
  profile.business.einPending = true;

  profile.contact = {
    fullName: "María Rivera Colón",
    email: "maria@saborbayamon.com",
    phone: "787-555-0142",
    role: "President",
  };

  const address = {
    line1: "125 Calle Comercio",
    cityOrMunicipality: "Bayamón",
    stateOrTerritory: "PR",
    postalCode: "00961",
    country: "US",
  };
  profile.addresses.operatingAddress = address;
  profile.addresses.principalPhysical = address;
  profile.addresses.mailingSameAsPhysical = true;

  profile.parties.residentAgent = {
    id: "agent-1",
    fullName: "María Rivera Colón",
    physicalAddress: address,
    mailingSameAsPhysical: true,
  };
  profile.parties.incorporators = [
    { id: "inc-1", fullName: "María Rivera Colón", physicalAddress: address },
  ];
  profile.parties.directors = [
    { id: "dir-1", fullName: "María Rivera Colón", physicalAddress: address },
    { id: "dir-2", fullName: "Luis Ortiz Vega", physicalAddress: address },
  ];
  profile.parties.authorizedSigners = [
    { id: "sig-1", fullName: "María Rivera Colón", physicalAddress: address },
  ];

  profile.filingPreferences.existenceTerm = "perpetual";
  profile.filingPreferences.effectiveDateChoice = "filing_date";

  profile.operations.estimatedAnnualPayroll = 285000;
  profile.operations.estimatedAnnualGrossReceipts = 940000;
  return profile;
}

function write(path: string, bytes: Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

async function main(): Promise<void> {
  console.log(`Intake sentence:\n  "${DESCRIPTION}"\n`);

  const extraction = extractIntake(DESCRIPTION, loadMunicipalities());
  console.log("Extracted:", JSON.stringify({
    business_type: extraction.businessType,
    municipality: extraction.municipality,
    employee_count: extraction.employeeCount,
    ...extraction.activities,
  }, null, 2));

  const seeded = applyExtraction(extraction, emptyCanonicalData());
  const artifactsAfterSeed = resolveApplicableArtifacts(seeded);
  const questions = outstandingQuestionsForProfile(seeded, artifactsAfterSeed);
  console.log(`\nStill to ask (${questions.length}):`);
  for (const q of questions.slice(0, 20)) console.log(`  - ${q.canonicalField} (${q.label}) → needed by ${q.neededBy.join(", ")}`);

  const profile = answerRemainingQuestions(seeded);
  const artifacts = resolveApplicableArtifacts(profile);
  const pkg = buildFilingPackage({ profile, artifacts, mappings: loadAllMappings() });

  console.log("\nFiling package");
  console.log("==============");
  for (const item of pkg.items) {
    console.log(`\n${item.agency}`);
    console.log(`  ${item.title}${item.formCode ? ` [${item.formCode}]` : ""}`);
    console.log(`  availability: ${item.availability} · status: ${itemStatusLabel(item)}`);
    const answerWord = item.unansweredCount === 1 ? "answer" : "answers";
    console.log(`  ✓ ${item.populatedCount} fields populated · △ ${item.unansweredCount} ${answerWord} required`);
    console.log(`  ${item.message.en}`);
  }

  const generated: string[] = [];
  for (const item of pkg.items) {
    if (!item.canGenerateWorkingCopy || !item.formCode) continue;
    const result = await generateWorkingCopy({ formCode: item.formCode, profile, purpose: "filing" });
    const ref = generatedFilingRef({
      tenantId: TENANT_ID,
      businessId: BUSINESS_ID,
      formCode: item.formCode,
      instanceId: "demo-instance",
    });
    const path = join(OUT_DIR, ref.bucket, ref.objectPath);
    write(path, result.bytes);
    generated.push(`${path} (${result.populated.length} populated, ${result.unanswered.length} unanswered)`);
  }

  // Municipal templates are generated for development validation only, under a
  // clearly separate path that is never surfaced as a filing artifact.
  for (const formCode of ["PA03", "PA04"]) {
    const result = await generateWorkingCopy({ formCode, profile, purpose: "development" });
    const path = join(OUT_DIR, "development-only", `${formCode}.populated.pdf`);
    write(path, result.bytes);
    generated.push(`${path} (development only — ${result.populated.length} populated, ${result.unanswered.length} unanswered)`);
  }

  for (const formCode of ["CORPREG01", "SC2309", "PA03", "PA04"]) {
    const preview = await generateMappingPreview(formCode);
    const path = join(OUT_DIR, "mapping-previews", `${formCode}.mapping-preview.pdf`);
    write(path, preview);
    generated.push(path);
  }

  console.log("\nGenerated files");
  console.log("===============");
  for (const line of generated) console.log(`  ${line}`);
  console.log(`\n${pkg.disclaimer}`);
}

await main();
