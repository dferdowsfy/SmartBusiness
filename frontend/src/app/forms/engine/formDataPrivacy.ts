import type { DigitalFormDefinition, FormData } from "./types.ts";

/**
 * Remove values that are needed only long enough to populate the applicant's
 * current official PDF. These values are intentionally excluded from browser
 * autosave, workflow snapshots, and prepared-application records.
 */
export function persistableFormData(definition: DigitalFormDefinition, data: FormData): FormData {
  const transientIds = new Set(
    definition.sections.flatMap((section) =>
      section.fields.filter((field) => field.transient).map((field) => field.id)
    )
  );
  return Object.fromEntries(
    Object.entries(data).filter(([fieldId]) => !transientIds.has(fieldId))
  ) as FormData;
}
