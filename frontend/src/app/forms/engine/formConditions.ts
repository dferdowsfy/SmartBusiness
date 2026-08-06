// ============================================================================
// Conditional visibility / applicability / required-when evaluation.
//
// A condition references either a live form value (`source: "form"`, the
// default) or a dotted path into the canonical application data
// (`source: "canonical"`). Arrays of conditions are AND-ed together, matching
// how the schemas express "all of these must hold".
// ============================================================================

import type {
  CanonicalApplicationData,
  FormCondition,
  FormData,
  FormFieldValue,
} from "./types.ts";

/** Read a dotted path (e.g. "business.entityType") from any object. */
export function readPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function resolveOperand(
  condition: FormCondition,
  formData: FormData,
  canonical?: CanonicalApplicationData
): unknown {
  if (condition.source === "canonical") {
    return readPath(canonical, condition.field);
  }
  return (formData as Record<string, FormFieldValue>)[condition.field];
}

function truthy(v: unknown): boolean {
  return v === true || v === "true" || v === "yes" || (typeof v === "number" && v !== 0) || (typeof v === "string" && v.trim() !== "" && v !== "false" && v !== "no");
}

export function evaluateCondition(
  condition: FormCondition,
  formData: FormData,
  canonical?: CanonicalApplicationData
): boolean {
  const actual = resolveOperand(condition, formData, canonical);
  const expected = condition.value;

  switch (condition.operator) {
    case "eq":
      return String(actual ?? "") === String(expected ?? "");
    case "neq":
      return String(actual ?? "") !== String(expected ?? "");
    case "in":
      return Array.isArray(expected) && expected.map(String).includes(String(actual ?? ""));
    case "not_in":
      return Array.isArray(expected) && !expected.map(String).includes(String(actual ?? ""));
    case "truthy":
      return truthy(actual);
    case "falsy":
      return !truthy(actual);
    case "gt":
      return Number(actual) > Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "not_exists":
      return actual === undefined || actual === null || actual === "";
    default:
      return true;
  }
}

/** True when every condition in the list holds (AND). Empty list ⇒ true. */
export function evaluateConditions(
  conditions: FormCondition[] | undefined,
  formData: FormData,
  canonical?: CanonicalApplicationData
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(c, formData, canonical));
}
