// Tests for the extraction-first document schema.
// Run: node --experimental-strip-types --test src/app/documentFields.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildExtraction } from "./documentFields.ts";

test("EIN with business name + number passes", () => {
  const r = buildExtraction("IRS EIN Letter",
    { business_name: "Kaptrix LLC", license_or_permit_number: "66-1234567" }, 0.95,
    { businessName: "Kaptrix LLC" });
  assert.equal(r.validation_result, "PASS");
  assert.equal(r.fields_missing.length, 0);
  assert.ok(r.fields_found.some((f) => f.value === "66-1234567"));
  assert.equal(r.classification_confidence, 95);
});

test("EIN missing the number fails with a concrete missing field", () => {
  const r = buildExtraction("IRS EIN Letter", { business_name: "Kaptrix LLC" }, 0.9);
  assert.equal(r.validation_result, "FAIL");
  assert.ok(r.fields_missing.some((f) => /License|Permit/.test(f.label)));
});

test("expired document is flagged as needs review", () => {
  const r = buildExtraction("Health Permit",
    { business_name: "X", permit_number: "H-1", expiration_date: "2000-01-01" }, 0.9,
    { businessName: "X" });
  assert.equal(r.expiration_status, "Expired");
  assert.equal(r.validation_result, "NEEDS_REVIEW");
});

test("name mismatch triggers needs review, not a generic message", () => {
  const r = buildExtraction("Merchant Registration Certificate",
    { business_name: "Totally Different Co", merchant_number: "SC-999" }, 0.9,
    { businessName: "Kaptrix LLC" });
  assert.equal(r.validation_result, "NEEDS_REVIEW");
  assert.match(r.reasoning, /does not match/);
});

test("reasoning is specific (mentions found/missing), never generic", () => {
  const r = buildExtraction("Permiso Único", { permit_number: "P-1" }, 0.8);
  assert.match(r.reasoning, /Found|Missing/);
});
