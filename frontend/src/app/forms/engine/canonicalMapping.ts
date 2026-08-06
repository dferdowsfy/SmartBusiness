// ============================================================================
// Canonical ⇄ form mapping (Part 2).
//
// Core intake populates a single `CanonicalApplicationData`. When a form opens,
// fields with a `canonicalKey` are prefilled from it. When a canonical field is
// edited inside a form, the canonical profile is updated and previously
// prepared forms that used the old value are flagged "needs_refresh".
// ============================================================================

import { readPath } from "./formConditions.ts";
import type {
  CanonicalAddress,
  CanonicalApplicationData,
  DigitalFormDefinition,
  FormData,
  FormField,
  FormFieldValue,
  GeneratedApplication,
} from "./types.ts";

/** All canonical keys referenced by a definition (fields + address defaults). */
export function canonicalKeysForForm(def: DigitalFormDefinition): string[] {
  const keys = new Set<string>();
  for (const section of def.sections) {
    for (const field of section.fields) {
      if (field.canonicalKey) keys.add(field.canonicalKey);
    }
  }
  return [...keys];
}

/**
 * Build the initial form data for a definition by prefilling every field that
 * declares a `canonicalKey` from the canonical profile, then layering any
 * previously-saved draft/prepared values on top (draft wins).
 */
export function prefillFromCanonical(
  def: DigitalFormDefinition,
  canonical: CanonicalApplicationData,
  existing: FormData = {}
): FormData {
  const next: FormData = { ...existing };
  for (const section of def.sections) {
    for (const field of section.fields) {
      if (!field.canonicalKey) continue;
      if (next[field.id] !== undefined) continue; // draft/user value wins
      const value = readPath(canonical, field.canonicalKey);
      if (value !== undefined && value !== null && value !== "") {
        next[field.id] = value as FormFieldValue;
      }
    }
  }
  return next;
}

/** Set a dotted canonical path, returning a new canonical object (immutable). */
export function setCanonicalValue(
  canonical: CanonicalApplicationData,
  path: string,
  value: unknown
): CanonicalApplicationData {
  return writePath(canonical, path, value);
}

/** Write a dotted path into a (cloned) canonical object. */
function writePath<T extends object>(obj: T, path: string, value: unknown): T {
  const clone = structuredCloneSafe(obj);
  const keys = path.split(".");
  let cursor: Record<string, unknown> = clone as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof cursor[k] !== "object" || cursor[k] === null) cursor[k] = {};
    cursor = cursor[k] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
  return clone;
}

function structuredCloneSafe<T>(v: T): T {
  if (typeof structuredClone === "function") return structuredClone(v);
  return JSON.parse(JSON.stringify(v)) as T;
}

export interface CanonicalWriteResult {
  canonical: CanonicalApplicationData;
  /** Canonical keys whose value actually changed. */
  changedKeys: string[];
}

/**
 * Push any form fields carrying a `canonicalKey` back into the canonical
 * profile. Returns the updated canonical object and the list of keys that
 * changed (used to flag prepared forms for refresh) and bumps `version` when
 * anything changed.
 */
export function writeBackToCanonical(
  def: DigitalFormDefinition,
  formData: FormData,
  canonical: CanonicalApplicationData
): CanonicalWriteResult {
  let next = canonical;
  const changedKeys: string[] = [];

  const fieldsByKey = new Map<string, FormField>();
  for (const section of def.sections) {
    for (const field of section.fields) {
      if (field.canonicalKey) fieldsByKey.set(field.canonicalKey, field);
    }
  }

  for (const [key, field] of fieldsByKey) {
    const formValue = (formData as Record<string, unknown>)[field.id];
    if (formValue === undefined) continue;
    const current = readPath(next, key);
    if (JSON.stringify(current ?? null) !== JSON.stringify(formValue ?? null)) {
      next = writePath(next, key, formValue);
      changedKeys.push(key);
    }
  }

  if (changedKeys.length > 0) {
    next = { ...next, version: next.version + 1 };
  }
  return { canonical: next, changedKeys };
}

/**
 * Given a set of changed canonical keys, determine which prepared applications
 * reference any of them and should therefore be marked "needs_refresh".
 * A submitted/approved application is never silently overwritten — it is only
 * flagged, so the UI can offer "Review Updates".
 */
export function applicationsNeedingRefresh(
  changedKeys: string[],
  apps: GeneratedApplication[],
  defsById: Record<string, DigitalFormDefinition>
): string[] {
  if (changedKeys.length === 0) return [];
  const changed = new Set(changedKeys);
  const flagged: string[] = [];
  for (const app of apps) {
    if (app.status === "draft") continue;
    const def = defsById[app.formId];
    if (!def) continue;
    const keys = canonicalKeysForForm(def);
    if (keys.some((k) => changed.has(k))) flagged.push(app.id);
  }
  return flagged;
}

// --- Convenience controls (Part 2) ----------------------------------------

export function addressFromCanonical(
  canonical: CanonicalApplicationData,
  which: "principalPhysical" | "principalMailing" | "operatingAddress"
): CanonicalAddress | undefined {
  return canonical.addresses[which];
}

/** Show the user which canonical values changed (for the "Needs refresh" UI). */
export function describeChanges(
  changedKeys: string[],
  before: CanonicalApplicationData,
  after: CanonicalApplicationData
): { key: string; from: string; to: string }[] {
  return changedKeys.map((key) => ({
    key,
    from: String(readPath(before, key) ?? ""),
    to: String(readPath(after, key) ?? ""),
  }));
}
