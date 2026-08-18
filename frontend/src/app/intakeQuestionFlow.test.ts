// Tests for the discovery-question flow rule: a question the intake already
// has an answer for is never asked again.
// Run: node --experimental-strip-types --test src/app/intakeQuestionFlow.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  hasStoredAnswer,
  mergeDiscoveryAnswers,
  resumeQuestionIndex,
  type FlowQuestion,
} from "./intakeQuestionFlow.ts";

/** The questions hardcodedQuestionsForBusinessType() asks a restaurant. */
const RESTAURANT: FlowQuestion[] = [
  { id: "food_prepared_on_site", text: "Will food be prepared on-site?" },
  { id: "customers_consume_on_site", text: "Will customers consume food on-site?" },
  { id: "alcohol_sold", text: "Will alcohol be sold?" },
  { id: "outdoor_seating", text: "Will there be outdoor seating?" },
  { id: "live_entertainment", text: "Will there be live entertainment?" },
  { id: "food_delivered", text: "Will food be delivered?" },
  { id: "employees_work_on_site", text: "Will employees work on-site?" },
  { id: "food_truck_or_mobile", text: "Will this operate from a food truck or mobile unit?" },
];

/** What getFollowUpQuestions() rebuilds from the profile at "See my requirements". */
function followUpQuestions(profile: Record<string, unknown>): Record<string, unknown> {
  return {
    has_food_service: profile.food_prepared_or_sold === true,
    alcohol_sales: profile.alcohol_sold === true,
    customers_visit: profile.customers_visit,
    location_type: profile.location_type,
    business_type: profile.business_type,
    employees_hired: profile.employees_hired,
    physical_location: profile.physical_location,
    outdoor_seating: profile.outdoor_seating,
    live_entertainment: profile.live_entertainment,
    import_export: profile.import_export,
  };
}

const answerAll = (): Record<string, unknown> =>
  Object.fromEntries(RESTAURANT.map((q) => [q.id, true]));

// --- resume position -------------------------------------------------------

test("a fresh intake starts at the first question", () => {
  assert.equal(resumeQuestionIndex(RESTAURANT, {}), 0);
});

test("resume lands on the first question still missing an answer", () => {
  const answers = { food_prepared_on_site: true, customers_consume_on_site: false };
  assert.equal(resumeQuestionIndex(RESTAURANT, answers), 2);
});

test("an answer of false still counts as answered", () => {
  // "No" is an answer. Only `undefined` means the intake does not know.
  assert.equal(resumeQuestionIndex(RESTAURANT, { food_prepared_on_site: false }), 1);
  assert.equal(hasStoredAnswer("food_prepared_on_site", { food_prepared_on_site: false }), true);
});

test("AI-prefilled questions count as answered", () => {
  assert.equal(resumeQuestionIndex(RESTAURANT, {}, ["food_prepared_on_site"]), 1);
});

test("REPRO: rebuilding the list mid-flow must not restart the questionnaire", () => {
  // Answering "yes, a food truck" rewrites profile.location_type, which rebuilds
  // the question list. Every question is answered by then, so there is nothing
  // left to ask — the old behaviour reset to 0 and replayed all eight.
  assert.equal(resumeQuestionIndex(RESTAURANT, answerAll()), RESTAURANT.length);
});

test("REPRO: a KB snapshot arriving mid-flow does not rewind progress", () => {
  const answers = { food_prepared_on_site: true, customers_consume_on_site: true, alcohol_sold: true };
  // kbReady flipping true rebuilds the list; the user keeps their place.
  assert.equal(resumeQuestionIndex(RESTAURANT, answers), 3);
});

// --- answers surviving "See my requirements" -------------------------------

test("REPRO: profile-derived answers must not discard per-business-type answers", () => {
  const stored = answerAll();
  // The profile as it stands after those answers were mirrored onto it.
  const profile = {
    food_prepared_or_sold: true, alcohol_sold: true, customers_visit: true,
    outdoor_seating: true, live_entertainment: true, employees_hired: true,
    physical_location: true, business_type: "Fast Food Restaurant",
    location_type: "Food Truck",
  };

  const merged = mergeDiscoveryAnswers(stored, followUpQuestions(profile));

  // Every question the user answered is still answered...
  for (const question of RESTAURANT) {
    assert.notEqual(merged[question.id], undefined, `${question.id} was discarded`);
  }
  // ...so returning to the intake asks nothing again.
  assert.equal(resumeQuestionIndex(RESTAURANT, merged), RESTAURANT.length);
  // ...and the derived aggregates are still refreshed.
  assert.equal(merged.has_food_service, true);
  assert.equal(merged.alcohol_sales, true);
});

test("an unset profile field never erases a real answer", () => {
  // customers_visit is undefined on the profile; the stored answer must win.
  const merged = mergeDiscoveryAnswers({ customers_visit: true }, { customers_visit: undefined });
  assert.equal(merged.customers_visit, true);
});

test("a refreshed profile value does update the stored answer", () => {
  const merged = mergeDiscoveryAnswers({ has_food_service: false }, { has_food_service: true });
  assert.equal(merged.has_food_service, true);
});

test("the whole restaurant round trip asks each question exactly once", () => {
  // Walk the flow the way the component does and count how often each question
  // is put in front of the user.
  const asked: string[] = [];
  let answers: Record<string, unknown> = {};
  let index = resumeQuestionIndex(RESTAURANT, answers);

  while (index < RESTAURANT.length) {
    const question = RESTAURANT[index];
    asked.push(question.id);
    answers = { ...answers, [question.id]: true };
    // The food-truck answer rewrites location_type, rebuilding the list.
    index = question.id === "food_truck_or_mobile"
      ? resumeQuestionIndex(RESTAURANT, answers)
      : index + 1;
  }

  // Then "See my requirements" folds the profile-derived answers in, and the
  // user comes back to the intake.
  answers = mergeDiscoveryAnswers(answers, followUpQuestions({ food_prepared_or_sold: true }));
  index = resumeQuestionIndex(RESTAURANT, answers);
  while (index < RESTAURANT.length) {
    asked.push(RESTAURANT[index].id);
    answers = { ...answers, [RESTAURANT[index].id]: true };
    index = resumeQuestionIndex(RESTAURANT, answers);
  }

  assert.deepEqual(asked, RESTAURANT.map((q) => q.id), "each question exactly once, in order");
  assert.equal(asked.length, new Set(asked).size, "no question asked twice");
});
