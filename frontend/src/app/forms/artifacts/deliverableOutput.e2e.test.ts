// ============================================================================
// Deliverable-output verification.
// Run: node --experimental-strip-types --test src/app/forms/artifacts/deliverableOutput.e2e.test.ts
//
// Does SmartPR actually populate the preloaded government forms?
//
// The population engine reports which fields it wrote. Asserting on that report
// only proves the code took a branch. These tests instead reopen the produced
// bytes with an independent reader and pull the content back out:
//
//   pdf_overlay (CORPREG01, SC2309) → pdf.js text extraction
//   acroform    (PA03, PA04)        → pdf-lib form-field read-back
//
// Each populated value is also checked against the BLANK template, so a match
// proves population put it there rather than it being government boilerplate.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resolveApplicableArtifacts } from "./applicability.ts";
import { getTemplate } from "./catalog.ts";
import { ArtifactGenerationError, generateWorkingCopy } from "./library.ts";
import { extractPdfText, pdfTextContains, readAcroFormValues } from "./pdfReadback.ts";
import { resolveRepoPath, sha256 } from "./paths.ts";
import { emptyCanonicalData, type CanonicalApplicationData } from "../engine/types.ts";

// Deliberately distinctive values: none of these strings occur in a blank
// government form, so finding them in the output can only mean SmartPR wrote
// them there.
const APPLICANT = {
  legalName: "Sabor Bayamón Inc.",
  tradeName: "Sabor Bayamón",
  agent: "María Rivera Colón",
  street: "125 Calle Comercio",
  municipality: "Bayamón",
  postalCode: "00961",
  email: "hola@saborbayamon.com",
  phone: "787-555-0142",
  ein: "66-1234567",
  merchantNumber: "MRC-4471902",
  taxpayerId: "CTM-8890-BAY",
  activity: "Full-service restaurant with indoor and outdoor seating.",
} as const;

const ADDRESS = {
  line1: APPLICANT.street,
  cityOrMunicipality: APPLICANT.municipality,
  stateOrTerritory: "PR",
  postalCode: APPLICANT.postalCode,
  country: "US",
};

/** A fully answered restaurant profile — the state a user reaches before filing. */
function applicantProfile(): CanonicalApplicationData {
  const profile = emptyCanonicalData();

  profile.business.legalName = APPLICANT.legalName;
  profile.business.tradeName = APPLICANT.tradeName;
  profile.business.entityType = "stock_corporation";
  profile.business.formationStatus = "not_formed";
  profile.business.activityDescription = APPLICANT.activity;
  profile.business.email = APPLICANT.email;
  profile.business.phone = APPLICANT.phone;
  profile.business.ein = APPLICANT.ein;
  profile.business.merchantRegistrationNumber = APPLICANT.merchantNumber;
  profile.business.incorporationDate = "2026-09-15";
  profile.business.operationsStartDate = "2026-10-01";
  profile.business.employeeCount = 10;

  profile.contact = {
    fullName: APPLICANT.agent,
    email: APPLICANT.email,
    phone: APPLICANT.phone,
    role: "President",
  };

  profile.addresses.principalPhysical = ADDRESS;
  profile.addresses.operatingAddress = ADDRESS;
  profile.addresses.mailingSameAsPhysical = true;
  profile.addresses.municipality = APPLICANT.municipality;

  const party = { physicalAddress: ADDRESS, mailingSameAsPhysical: true };
  profile.parties.residentAgent = { id: "a", fullName: APPLICANT.agent, ...party };
  profile.parties.incorporators = [{ id: "i", fullName: APPLICANT.agent, ...party }];
  profile.parties.directors = [{ id: "d", fullName: APPLICANT.agent, ...party }];
  profile.parties.authorizedSigners = [{ id: "s", fullName: APPLICANT.agent, ...party }];

  profile.filingPreferences.existenceTerm = "perpetual";
  profile.filingPreferences.effectiveDateChoice = "filing_date";

  profile.operations.employeeCount = 10;
  profile.operations.estimatedAnnualPayroll = 285000;
  profile.operations.estimatedAnnualGrossReceipts = 940000;
  profile.operations.municipalTaxpayerId = APPLICANT.taxpayerId;
  profile.operations.fiscalYearEnd = "12-31";

  profile.activities.foodService = true;
  profile.activities.outdoorSeating = true;
  // Alcohol makes the Hacienda licence artifact (SC 2309) genuinely applicable.
  profile.activities.alcoholSales = true;

  return profile;
}

/** Text of the untouched original on disk, for "was it already there?" checks. */
async function blankTemplateText(formCode: string): Promise<string> {
  const template = getTemplate(formCode);
  assert.ok(template?.sourceFile, `${formCode} has no source file`);
  const bytes = new Uint8Array(readFileSync(resolveRepoPath(template.sourceFile)));
  return extractPdfText(bytes);
}

// --- Official overlay artifacts ---------------------------------------------

test("CORPREG01: the delivered certificate physically contains the applicant's data", async () => {
  const result = await generateWorkingCopy({
    formCode: "CORPREG01",
    profile: applicantProfile(),
    purpose: "filing",
  });

  assert.equal(result.populationMethod, "pdf_overlay");
  assert.ok(result.bytes.length > 0, "no bytes produced");

  const delivered = await extractPdfText(result.bytes);
  const blank = await blankTemplateText("CORPREG01");

  // Each value must be in the delivered copy AND absent from the blank form —
  // together that is proof SmartPR wrote it, not the government's boilerplate.
  for (const value of [
    APPLICANT.legalName,
    APPLICANT.agent,
    APPLICANT.street,
    APPLICANT.postalCode,
    APPLICANT.email,
  ]) {
    assert.ok(pdfTextContains(delivered, value), `"${value}" is missing from the delivered CORPREG01`);
    assert.ok(!pdfTextContains(blank, value), `"${value}" was already in the blank template — not a real population check`);
  }
});

test("CORPREG01: accented characters survive into the delivered PDF", async () => {
  const result = await generateWorkingCopy({
    formCode: "CORPREG01",
    profile: applicantProfile(),
    purpose: "filing",
  });
  const delivered = await extractPdfText(result.bytes);
  // Asserted unfolded: this catches an encoding bug that accent-folded
  // comparisons elsewhere in this file would forgive.
  assert.ok(delivered.includes("Bayamón"), "the ó was lost writing the municipality");
  assert.ok(delivered.includes("María"), "the í was lost writing the resident agent");
});

test("SC2309: the alcohol licence artifact is populated from the same profile", async () => {
  const profile = applicantProfile();

  // It is only worth delivering because the profile makes it applicable.
  const applicable = resolveApplicableArtifacts(profile).map((a) => a.formCode);
  assert.ok(applicable.includes("SC2309"), "alcohol sales should make SC 2309 applicable");

  const result = await generateWorkingCopy({ formCode: "SC2309", profile, purpose: "filing" });
  const delivered = await extractPdfText(result.bytes);
  const blank = await blankTemplateText("SC2309");

  for (const value of [APPLICANT.legalName, APPLICANT.merchantNumber, APPLICANT.ein]) {
    assert.ok(pdfTextContains(delivered, value), `"${value}" is missing from the delivered SC 2309`);
    assert.ok(!pdfTextContains(blank, value), `"${value}" was already in the blank SC 2309`);
  }
});

test("the engine does not over-report: every field it claims to have written is in the output", async () => {
  const result = await generateWorkingCopy({
    formCode: "CORPREG01",
    profile: applicantProfile(),
    purpose: "filing",
  });
  const delivered = await extractPdfText(result.bytes);

  assert.ok(result.populated.length >= 10, `expected a well-populated certificate, got ${result.populated.length}`);

  const missing = result.populated
    // Multi-line values (address blocks, party lists) are drawn as separate
    // runs; check them line by line rather than as one string.
    .flatMap((field) => field.value.split(/\r?\n/).map((line) => ({ field, line: line.trim() })))
    .filter(({ line }) => line.length > 2)
    .filter(({ line }) => !pdfTextContains(delivered, line))
    .map(({ field, line }) => `${field.pdfField} → "${line}"`);

  assert.deepEqual(missing, [], "the engine reported writing values that are not in the delivered PDF");
});

// --- AcroForm artifacts ------------------------------------------------------

test("PA03/PA04: values read back through the PDF form API", async () => {
  for (const formCode of ["PA03", "PA04"]) {
    // Genericized municipal layouts are development-only artifacts; the guard
    // covering that is asserted separately below.
    const result = await generateWorkingCopy({
      formCode,
      profile: applicantProfile(),
      purpose: "development",
    });
    assert.equal(result.populationMethod, "acroform", `${formCode} should populate native fields`);

    const values = await readAcroFormValues(result.bytes);
    const readBack = Object.values(values).join(" | ");

    assert.ok(
      pdfTextContains(readBack, APPLICANT.legalName),
      `${formCode}: the legal name did not read back out of the form fields`
    );
    assert.ok(
      pdfTextContains(readBack, APPLICANT.municipality),
      `${formCode}: the municipality did not read back out of the form fields`
    );

    // A blank template reads back as empty; a populated one must not.
    const nonEmpty = Object.values(values).filter((v) => v.trim().length > 0);
    assert.ok(nonEmpty.length >= 5, `${formCode}: only ${nonEmpty.length} fields carry a value`);
  }
});

// --- Safety invariants -------------------------------------------------------

test("generating a deliverable never modifies the canonical original on disk", async () => {
  const codes = ["CORPREG01", "SC2309", "PA03", "PA04"];
  const before = codes.map((code) => {
    const template = getTemplate(code);
    return sha256(new Uint8Array(readFileSync(resolveRepoPath(template!.sourceFile!))));
  });

  for (const code of codes) {
    await generateWorkingCopy({
      formCode: code,
      profile: applicantProfile(),
      // Official codes accept "filing"; genericized ones only "development".
      purpose: code === "PA03" || code === "PA04" ? "development" : "filing",
    });
  }

  const after = codes.map((code) => {
    const template = getTemplate(code);
    return sha256(new Uint8Array(readFileSync(resolveRepoPath(template!.sourceFile!))));
  });
  assert.deepEqual(after, before, "a template file changed while producing working copies");
});

test("a genericized municipal template cannot be delivered as a filing artifact", async () => {
  for (const formCode of ["PA03", "PA04"]) {
    await assert.rejects(
      () => generateWorkingCopy({ formCode, profile: applicantProfile(), purpose: "filing" }),
      ArtifactGenerationError,
      `${formCode} must not be presentable as an official municipal form`
    );
  }
});
