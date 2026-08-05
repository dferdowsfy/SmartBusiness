import test from "node:test";
import assert from "node:assert/strict";
import {
  confirmedPotentialRequirements,
  mergeConfirmedPotentialRequirements,
  type PotentialDef,
} from "./potentialRequirements.ts";

const definitions: PotentialDef[] = [
  {
    flag: "coastal",
    flagLabel: "Coastal Municipality",
    document: "Coastal / Environmental Zone Review",
    agency: "DRNA",
    why: "A coastal review may be required.",
    followUp: "Will the business operate near the coast?",
  },
  {
    flag: "tourism",
    flagLabel: "Tourism Municipality",
    document: "Tourism Registration",
    agency: "Tourism Company",
    why: "Tourism businesses may need to register.",
    followUp: "Will the business primarily serve visitors?",
  },
];

test("only Applies creates required checklist items", () => {
  const requirements = confirmedPotentialRequirements(definitions, {
    coastal: "applies",
    tourism: "not_sure",
  });

  assert.equal(requirements.length, 1);
  assert.equal(requirements[0].code, "potential_coastal");
  assert.equal(requirements[0].mandatory, true);
  assert.equal(requirements[0].status, "pending");
});

test("Does Not Apply and Not Sure do not change required fields", () => {
  const requirements = confirmedPotentialRequirements(definitions, {
    coastal: "not_applies",
    tourism: "not_sure",
  });

  assert.deepEqual(requirements, []);
});

test("confirmed items are merged once into the computed checklist", () => {
  const base = [{ code: "ein", name: "IRS EIN Confirmation Letter" }];
  const merged = mergeConfirmedPotentialRequirements(base, definitions, {
    coastal: "applies",
    tourism: "applies",
  });

  assert.deepEqual(merged.map((requirement) => requirement.code), [
    "ein",
    "potential_coastal",
    "potential_tourism",
  ]);
});
