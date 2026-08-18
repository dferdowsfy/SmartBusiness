// ============================================================================
// Discovery-question flow decisions.
//
// Pulled out of SmartPRIntake so the "never ask the same question twice" rule
// is a small, testable function rather than an invariant buried in a component.
//
// The rule the intake has to keep: a question the intake already holds an
// answer for is never put back in front of the user. That is easy to state and
// easy to break, because the question list is REBUILT whenever the business
// type, the location type, or the published KB snapshot changes — and a rebuild
// used to send the user back to question one, replaying everything they had
// already answered.
// ============================================================================

export interface FlowQuestion {
  id: string;
  text: string;
}

/**
 * Does the intake already hold an answer for this question, from any source —
 * the user clicking Yes/No, or the AI interpreter pre-filling it?
 *
 * Deliberately NOT the same predicate as the component's `isQuestionSuppressed`.
 * That one reports a hand-answered question as "not suppressed" so Back can
 * return to it; this one asks the plainer question "do we know the answer",
 * which is what deciding where to RESUME needs.
 */
export function hasStoredAnswer(
  questionId: string,
  answers: Record<string, unknown>,
  aiPrefilledKeys: readonly string[] = []
): boolean {
  if (aiPrefilledKeys.includes(questionId)) return true;
  return answers[questionId] !== undefined;
}

/**
 * Where to place the cursor when the question list is rebuilt: the first
 * question still missing an answer, or the end of the list when none are.
 *
 * Returning 0 unconditionally (the previous behaviour) is what made the intake
 * ask everything a second time whenever an answer changed the location type —
 * answering "yes, a food truck" rewrote `location_type`, which rebuilt the list
 * and restarted the questionnaire from the top.
 */
export function resumeQuestionIndex(
  questions: readonly FlowQuestion[],
  answers: Record<string, unknown>,
  aiPrefilledKeys: readonly string[] = []
): number {
  for (let i = 0; i < questions.length; i++) {
    if (!hasStoredAnswer(questions[i].id, answers, aiPrefilledKeys)) return i;
  }
  return questions.length;
}

/**
 * Fold profile-derived answers into the stored ones.
 *
 * `getFollowUpQuestions()` rebuilds a fixed set of profile-derived keys, and
 * assigning its result over the answer map wholesale used to DISCARD every
 * per-business-type answer the user had just given — for a restaurant, six of
 * the eight (food prepared, on-site consumption, alcohol sold, delivery,
 * employees on site, food truck). Returning to the intake then asked all six
 * again.
 *
 * Merging keeps them. `undefined` is skipped so an unset profile field cannot
 * erase a real answer by overwriting it with "unknown".
 */
export function mergeDiscoveryAnswers(
  previous: Record<string, unknown>,
  derived: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...previous };
  for (const [key, value] of Object.entries(derived)) {
    if (value === undefined) continue;
    next[key] = value;
  }
  return next;
}
