// Automated tests for the Puerto Rico government submission registry.
// Run: node --experimental-strip-types --test src/app/forms/submission/prSubmission.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { emptyCanonicalData, type CanonicalApplicationData } from "../engine/types.ts";
import {
  formatGovernmentFee,
  getGovernmentFee,
  getSubmissionDestination,
  getSubmissionSpec,
  governmentFeeText,
  hasGovernmentSubmission,
  openGovernmentPortal,
  PR_DOS_PORTAL_URL,
  PR_FORM_SUBMISSION,
  type PortalOpener,
} from "./pr.ts";
import { FORM_REGISTRY, getDefinition, getRegistryEntry } from "../engine/registry.ts";
import { resolveFormId } from "../engine/routing.ts";
import { buildGeneratedApplication, requirementFormState } from "../engine/application.ts";
import { feeEstimateFor } from "../engine/fees.ts";

const DIGITIZED = ["CORPREG01", "CORPREG02", "CORPREG03", "CORPREG04", "CORPREG05", "CORPREG06"];

function canonical(overrides: Partial<CanonicalApplicationData["business"]> = {}): CanonicalApplicationData {
  const c = emptyCanonicalData();
  c.business = { ...c.business, ...overrides };
  return c;
}

/** The fee as the applicant sees it, in English. */
function feeText(formId: string, c?: CanonicalApplicationData): string {
  const resolution = getGovernmentFee(formId, c);
  assert.ok(resolution, `${formId} has no government fee`);
  return formatGovernmentFee(resolution, "en");
}

// --- per-form fees ----------------------------------------------------------

test("CORPREG01 shows a $150 government filing fee and links to the correct portal", () => {
  assert.equal(feeText("CORPREG01", canonical({ entityType: "stock_corporation" })), "$150");
  assert.equal(getSubmissionDestination("CORPREG01")?.url, "https://rcp.estado.pr.gov/es");
});

test("CORPREG02 shows a $5 government filing fee", () => {
  assert.equal(feeText("CORPREG02", canonical({ entityType: "nonprofit_nonstock_corporation" })), "$5");
});

test("CORPREG03 for-profit resolves to $150", () => {
  const c = canonical({ formationStatus: "formed_outside_puerto_rico", forProfitStatus: "for_profit" });
  const resolution = getGovernmentFee("CORPREG03", c);
  assert.equal(resolution?.status, "resolved");
  assert.equal(resolution?.status === "resolved" && resolution.amount, 150);
  assert.equal(feeText("CORPREG03", c), "$150");
});

test("CORPREG03 nonprofit resolves to $5", () => {
  const c = canonical({ formationStatus: "formed_outside_puerto_rico", forProfitStatus: "nonprofit" });
  const resolution = getGovernmentFee("CORPREG03", c);
  assert.equal(resolution?.status, "resolved");
  assert.equal(resolution?.status === "resolved" && resolution.amount, 5);
  assert.equal(feeText("CORPREG03", c), "$5");
});

test("CORPREG03 with an unresolved entity type shows both fees and never guesses", () => {
  const c = canonical({ formationStatus: "formed_outside_puerto_rico" }); // forProfitStatus unknown
  const resolution = getGovernmentFee("CORPREG03", c);
  assert.equal(resolution?.status, "unresolved");
  // Both branches are offered, neither is picked.
  assert.deepEqual(
    resolution?.status === "unresolved" ? resolution.options.map((o) => o.amount) : [],
    [150, 5]
  );
  assert.equal(feeText("CORPREG03", c), "$150 for for-profit entities / $5 for nonprofit entities");
  assert.equal(feeText("CORPREG03"), "$150 for for-profit entities / $5 for nonprofit entities");
  // The numeric accessor refuses to invent an amount rather than defaulting.
  assert.equal(feeEstimateFor(getDefinition("FORM_PR_DOS_CORPREG03")!, c), null);
});

test("CORPREG04 and CORPREG05 show $150", () => {
  assert.equal(feeText("CORPREG04", canonical({ entityType: "close_corporation" })), "$150");
  assert.equal(feeText("CORPREG05", canonical({ entityType: "professional_corporation" })), "$150");
});

test("CORPREG06 (LLP registration, not an LLC form) shows $110", () => {
  assert.equal(feeText("CORPREG06", canonical({ entityType: "limited_liability_partnership" })), "$110");
  // Guard the LLP/LLC distinction at the submission layer too.
  assert.equal(getDefinition(PR_FORM_SUBMISSION.CORPREG06.internalFormId)?.requirementId, "DOC_LLP_REGISTRATION");
});

test("every fee is labelled as a government fee, never a SmartPR charge", () => {
  for (const formId of DIGITIZED) {
    const resolution = getGovernmentFee(formId, canonical());
    assert.equal(resolution?.label.en, "Government filing fee");
    assert.equal(resolution?.label.es, "Tarifa gubernamental de radicación");
  }
});

// --- destination ------------------------------------------------------------

test("all six digitized forms are submitted to the Department of State registry", () => {
  for (const formId of DIGITIZED) {
    const destination = getSubmissionDestination(formId);
    assert.ok(destination, `${formId} has no submission destination`);
    assert.equal(destination.agency.en, "Puerto Rico Department of State");
    assert.equal(destination.agency.es, "Departamento de Estado de Puerto Rico");
    assert.equal(destination.portalName.en, "Registry of Corporations and Entities");
    assert.equal(destination.method, "online_portal");
    assert.equal(destination.paymentAtAgency, true);
    // The registry portal, not a generic Puerto Rico government homepage.
    assert.equal(destination.url, PR_DOS_PORTAL_URL);
    assert.equal(destination.url, "https://rcp.estado.pr.gov/es");
  }
});

test("submission lookup accepts both the official number and the internal form id", () => {
  for (const formId of DIGITIZED) {
    const spec = getSubmissionSpec(formId);
    assert.ok(spec);
    assert.equal(getSubmissionSpec(spec.internalFormId)?.formId, formId);
    assert.ok(getDefinition(spec.internalFormId), `${spec.internalFormId} is not a real form definition`);
  }
});

test("the submission registry agrees with each form definition's fee metadata", () => {
  for (const formId of DIGITIZED) {
    const spec = getSubmissionSpec(formId)!;
    const meta = getDefinition(spec.internalFormId)?.feeMetadata;
    assert.ok(meta, `${formId} has no feeMetadata`);
    if (spec.governmentFee.kind === "fixed") {
      assert.equal(meta.estimatedFeeUsd, spec.governmentFee.amount);
    } else {
      const byStatus = Object.fromEntries(spec.governmentFee.options.map((o) => [o.appliesTo, o.amount]));
      assert.deepEqual(meta.estimateByProfit, byStatus);
    }
  }
});

// --- Spanish ----------------------------------------------------------------

test("fee and destination text are available in Spanish", () => {
  assert.equal(governmentFeeText("CORPREG01", canonical(), "es"), "$150");
  assert.equal(
    governmentFeeText("CORPREG03", canonical({ formationStatus: "formed_outside_puerto_rico" }), "es"),
    "$150 para entidades con fines de lucro / $5 para entidades sin fines de lucro"
  );
});

// --- clicking the button changes nothing -------------------------------------

test("opening the government portal does NOT mark the application submitted or approved", () => {
  const def = getDefinition("FORM_PR_DOS_CORPREG01")!;
  const app = buildGeneratedApplication(def, {}, canonical({ entityType: "stock_corporation" }), { status: "prepared" });
  const before = JSON.stringify(app);

  const calls: Array<[string, string, string]> = [];
  const opener: PortalOpener = (url, target, features) => calls.push([url, target, features]);
  assert.equal(openGovernmentPortal("CORPREG01", opener), true);

  // The portal opened in a new tab, safely.
  assert.deepEqual(calls, [["https://rcp.estado.pr.gov/es", "_blank", "noopener,noreferrer"]]);
  // ...and the application is untouched: still prepared, never submitted/approved.
  assert.equal(JSON.stringify(app), before);
  assert.equal(app.status, "prepared");
  assert.equal(app.submittedAt, undefined);
  assert.equal(app.approvedAt, undefined);
  assert.equal(requirementFormState(app), "prepared");
});

test("openGovernmentPortal refuses forms that have no submission destination", () => {
  const calls: string[] = [];
  const opener: PortalOpener = (url) => calls.push(url);
  assert.equal(openGovernmentPortal("FORM_PR_MERCHANT_REGISTRATION", opener), false);
  assert.equal(openGovernmentPortal("", opener), false);
  assert.deepEqual(calls, []);
});

// --- scope: digitized forms only ---------------------------------------------

test("only the six digitized forms have a government submission step", () => {
  assert.deepEqual(Object.keys(PR_FORM_SUBMISSION).sort(), [...DIGITIZED].sort());
  for (const formId of DIGITIZED) assert.equal(hasGovernmentSubmission(formId), true);
});

test("non-digitized requirements get no fee, no destination and no submission button", () => {
  const notDigitized = FORM_REGISTRY.filter((e) => !e.displayForm);
  assert.ok(notDigitized.length > 0);
  for (const entry of notDigitized) {
    assert.equal(hasGovernmentSubmission(entry.id), false, `${entry.id} must not offer submission`);
    assert.equal(getGovernmentFee(entry.id, canonical()), null);
    assert.equal(getSubmissionDestination(entry.id), null);
    assert.equal(governmentFeeText(entry.id, canonical(), "en"), null);
  }
  // Upload-only / agency-issued requirements that have no form at all.
  for (const id of ["DOC_EIN", "DOC_MERCHANT_REGISTRATION", "DOC_HEALTH_PERMIT", "unknown_form"]) {
    assert.equal(hasGovernmentSubmission(id), false);
  }
});

test("every displayable registry entry has submission metadata", () => {
  for (const entry of FORM_REGISTRY.filter((e) => e.displayForm)) {
    assert.equal(hasGovernmentSubmission(entry.id), true, `${entry.id} is displayed but has no submission metadata`);
  }
});

// --- regression: routing and completion are untouched -------------------------

test("existing form routing is unchanged", () => {
  assert.equal(resolveFormId("DOC_CERT_INCORPORATION", canonical({ entityType: "stock_corporation" })), "FORM_PR_DOS_CORPREG01");
  assert.equal(resolveFormId("DOC_CERT_INCORPORATION", canonical({ entityType: "nonprofit_nonstock_corporation" })), "FORM_PR_DOS_CORPREG02");
  assert.equal(resolveFormId("DOC_FOREIGN_CORPORATION_AUTHORIZATION", canonical({ formationStatus: "formed_outside_puerto_rico" })), "FORM_PR_DOS_CORPREG03");
  assert.equal(resolveFormId("DOC_CERT_INCORPORATION", canonical({ entityType: "close_corporation" })), "FORM_PR_DOS_CORPREG04");
  assert.equal(resolveFormId("DOC_CERT_INCORPORATION", canonical({ entityType: "professional_corporation" })), "FORM_PR_DOS_CORPREG05");
  assert.equal(resolveFormId("DOC_LLP_REGISTRATION", canonical({ entityType: "limited_liability_partnership" })), "FORM_PR_DOS_CORPREG06");
  // LLC still routes nowhere — CORPREG06 is an LLP form.
  assert.equal(resolveFormId("DOC_ARTICLES_ORGANIZATION", canonical({ entityType: "limited_liability_company" })), null);
  assert.equal(getRegistryEntry("FORM_PR_DOS_ARTICLES_ORGANIZATION")?.displayForm, false);
});

test("completing a form still produces a prepared application, not a submitted one", () => {
  const def = getDefinition("FORM_PR_DOS_CORPREG01")!;
  const app = buildGeneratedApplication(def, { corporation_name: "Acme Corp." }, canonical({ entityType: "stock_corporation" }));
  assert.equal(app.status, "prepared");
  assert.equal(app.formId, "FORM_PR_DOS_CORPREG01");
  assert.equal(app.officialFormNumber, "CORPREG01");
  assert.ok(app.completedAt);
  assert.equal(app.submittedAt, undefined);
  assert.equal(def.officialEvidenceStillRequired, true);
});
