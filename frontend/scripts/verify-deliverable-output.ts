// ============================================================================
// Deliverable-output verification run.
//
//   npm run forms:verify
//
// Produces a real deliverable from each preloaded government form, then reopens
// the produced bytes with an independent reader and checks the applicant's data
// is actually in there — pdf.js text extraction for overlay forms, pdf-lib
// form-field read-back for AcroForm ones.
//
// Writes the populated copies to `generated-filings-verified/` so the output can
// be opened and read by a person. Canonical templates are never modified; that
// is re-checked by checksum at the end. Exits non-zero if any check fails, so
// this is usable as a CI gate and not only as a demo.
// ============================================================================

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { availableTemplates } from "../src/app/forms/artifacts/catalog.ts";
import { generateWorkingCopy, type GenerationPurpose } from "../src/app/forms/artifacts/library.ts";
import {
  extractPdfText,
  pdfTextContains,
  readAcroFormValues,
} from "../src/app/forms/artifacts/pdfReadback.ts";
import { repoRoot, resolveRepoPath, sha256 } from "../src/app/forms/artifacts/paths.ts";
import { emptyCanonicalData, type CanonicalApplicationData } from "../src/app/forms/engine/types.ts";

const OUT_DIR = join(repoRoot(), "generated-filings-verified");

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
} as const;

const ADDRESS = {
  line1: APPLICANT.street,
  cityOrMunicipality: APPLICANT.municipality,
  stateOrTerritory: "PR",
  postalCode: APPLICANT.postalCode,
  country: "US",
};

function applicantProfile(): CanonicalApplicationData {
  const profile = emptyCanonicalData();
  profile.business.legalName = APPLICANT.legalName;
  profile.business.tradeName = APPLICANT.tradeName;
  profile.business.entityType = "stock_corporation";
  profile.business.formationStatus = "not_formed";
  profile.business.activityDescription = "Full-service restaurant with indoor and outdoor seating.";
  profile.business.email = APPLICANT.email;
  profile.business.phone = APPLICANT.phone;
  profile.business.ein = APPLICANT.ein;
  profile.business.merchantRegistrationNumber = APPLICANT.merchantNumber;
  profile.business.incorporationDate = "2026-09-15";
  profile.business.operationsStartDate = "2026-10-01";
  profile.business.employeeCount = 10;
  profile.contact = { fullName: APPLICANT.agent, email: APPLICANT.email, phone: APPLICANT.phone, role: "President" };
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
  profile.activities.alcoholSales = true;
  return profile;
}

/** Values expected to reach each form, given what that form actually asks for. */
const EXPECTED_VALUES: Record<string, string[]> = {
  CORPREG01: [APPLICANT.legalName, APPLICANT.agent, APPLICANT.street, APPLICANT.postalCode, APPLICANT.email],
  SC2309: [APPLICANT.legalName, APPLICANT.merchantNumber, APPLICANT.ein, APPLICANT.tradeName],
  PA03: [APPLICANT.legalName, APPLICANT.municipality, APPLICANT.taxpayerId],
  PA04: [APPLICANT.legalName, APPLICANT.municipality, APPLICANT.taxpayerId],
};

interface Row {
  formCode: string;
  method: string;
  populated: number;
  unanswered: number;
  found: string[];
  absent: string[];
  /** Values present in the produced copy that were ALSO in the blank template. */
  inconclusive: string[];
  file: string;
}

async function run(): Promise<void> {
  const profile = applicantProfile();
  const templates = availableTemplates();
  const checksumsBefore = new Map<string, string>();
  for (const template of templates) {
    checksumsBefore.set(template.formCode, sha256(new Uint8Array(readFileSync(resolveRepoPath(template.sourceFile!)))));
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const rows: Row[] = [];
  const failures: string[] = [];

  for (const template of templates) {
    const { formCode } = template;
    const expected = EXPECTED_VALUES[formCode] ?? [];
    // A genericized municipal layout may only ever be produced for internal
    // validation — never handed to a user as their municipality's form.
    const purpose: GenerationPurpose =
      template.artifactType === "genericized_municipal_template" ? "development" : "filing";

    let result;
    try {
      result = await generateWorkingCopy({ formCode, profile, purpose });
    } catch (error) {
      failures.push(`${formCode}: generation threw — ${(error as Error).message}`);
      continue;
    }

    const filename = `${formCode}.populated.pdf`;
    writeFileSync(join(OUT_DIR, filename), result.bytes);

    // Read the produced document back with a different reader than the one
    // that wrote it, then diff against the blank original so a "found" value
    // cannot just be government boilerplate.
    const producedText =
      result.populationMethod === "acroform"
        ? Object.values(await readAcroFormValues(result.bytes)).join(" | ")
        : await extractPdfText(result.bytes);
    const blankBytes = new Uint8Array(readFileSync(resolveRepoPath(template.sourceFile!)));
    const blankText =
      result.populationMethod === "acroform"
        ? Object.values(await readAcroFormValues(blankBytes)).join(" | ")
        : await extractPdfText(blankBytes);

    const found: string[] = [];
    const absent: string[] = [];
    const inconclusive: string[] = [];
    for (const value of expected) {
      if (!pdfTextContains(producedText, value)) absent.push(value);
      else if (pdfTextContains(blankText, value)) inconclusive.push(value);
      else found.push(value);
    }

    if (absent.length > 0) failures.push(`${formCode}: not written into the deliverable — ${absent.join(", ")}`);
    if (inconclusive.length > 0) {
      failures.push(`${formCode}: already present in the blank template, cannot prove population — ${inconclusive.join(", ")}`);
    }
    if (result.populated.length === 0) failures.push(`${formCode}: the engine populated nothing`);

    rows.push({
      formCode,
      method: result.populationMethod,
      populated: result.populated.length,
      unanswered: result.unanswered.length,
      found,
      absent,
      inconclusive,
      file: filename,
    });
  }

  for (const template of templates) {
    const after = sha256(new Uint8Array(readFileSync(resolveRepoPath(template.sourceFile!))));
    if (after !== checksumsBefore.get(template.formCode)) {
      failures.push(`${template.formCode}: the canonical template on disk was MODIFIED`);
    }
  }

  report(rows, failures);
  if (failures.length > 0) process.exitCode = 1;
}

function report(rows: Row[], failures: string[]): void {
  console.log("\nDELIVERABLE OUTPUT VERIFICATION");
  console.log("Data is read back out of the produced PDF, not taken from the engine's own report.\n");

  const header = ["FORM", "METHOD", "WRITTEN", "BLANK", "VERIFIED IN OUTPUT"];
  const body = rows.map((r) => [
    r.formCode,
    r.method,
    String(r.populated),
    String(r.unanswered),
    r.absent.length === 0 && r.inconclusive.length === 0
      ? `PASS — ${r.found.length}/${r.found.length + r.absent.length + r.inconclusive.length} values confirmed`
      : `FAIL — missing: ${[...r.absent, ...r.inconclusive].join(", ")}`,
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log(line(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of body) console.log(line(row));

  console.log("\nSample of what landed in the deliverable:");
  for (const row of rows) {
    if (row.found.length > 0) console.log(`  ${row.formCode}: ${row.found.join(" · ")}`);
  }

  console.log(`\nPopulated copies written to ${OUT_DIR}`);
  for (const row of rows) console.log(`  ${row.file}`);

  if (failures.length === 0) {
    console.log("\nRESULT: every preloaded form was populated and verified in its output.");
    console.log("Canonical templates unchanged.\n");
  } else {
    console.log(`\nRESULT: ${failures.length} problem(s):`);
    for (const failure of failures) console.log(`  - ${failure}`);
    console.log("");
  }
}

await run();
