// ============================================================================
// Government-artifact population.
//
// The government's own PDF is the base layer, always. SmartPR loads the
// untouched original, writes the canonical profile into it, and returns the
// bytes of a NEW working copy. The template file and its stored object are
// never modified — `populateArtifact` has no write path back to the source.
//
// Two methods are supported:
//   acroform    — set native form fields (values stay editable for the filer)
//   pdf_overlay — draw text on top of the untouched background at measured
//                 coordinates, for official PDFs with no native fields
// ============================================================================

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { canonicalFieldLabel, readCanonicalField } from "./canonicalFields.ts";
import type { CanonicalApplicationData } from "../engine/types.ts";
import type {
  FieldMapping,
  FormMappingDocument,
  MappingTransform,
  PopulatedFieldRecord,
  PopulationResult,
  UnansweredFieldRecord,
} from "./types.ts";

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function parseDateParts(value: string): { year: string; month: string; day: string; monthNameEs: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  return { year, month, day, monthNameEs: MONTHS_ES[Number(month) - 1] ?? month };
}

/** Shape a canonical value for one government field. */
export function applyTransform(value: unknown, transform: MappingTransform | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") {
    if (transform === "si_no") return value ? "Sí" : "No";
    return value ? "Yes" : "No";
  }
  const raw = String(value);
  switch (transform) {
    case "upper":
      return raw.toUpperCase();
    case "yes_no":
      return raw === "true" ? "Yes" : raw === "false" ? "No" : raw;
    case "si_no":
      return raw === "true" ? "Sí" : raw === "false" ? "No" : raw;
    case "integer": {
      const n = Number(raw);
      return Number.isFinite(n) ? String(Math.round(n)) : raw;
    }
    case "currency": {
      const n = Number(raw);
      return Number.isFinite(n)
        ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : raw;
    }
    case "date_year":
      return parseDateParts(raw)?.year ?? "";
    case "date_month":
      return parseDateParts(raw)?.month ?? "";
    case "date_day":
      return parseDateParts(raw)?.day ?? "";
    // A closing/anniversary month held as "MM-DD" or a full ISO date. Government
    // boxes that ask for a MONTH must not receive a month-day pair.
    case "month_number": {
      const iso = parseDateParts(raw);
      if (iso) return iso.month;
      const mmdd = /^(\d{1,2})-\d{1,2}$/.exec(raw.trim());
      return mmdd ? mmdd[1].padStart(2, "0") : "";
    }
    case "first_name":
      return raw.trim().split(/\s+/)[0] ?? "";
    case "last_name": {
      const parts = raw.trim().split(/\s+/);
      return parts.length > 1 ? parts.slice(1).join(" ") : "";
    }
    default:
      return raw;
  }
}

/** True when a mapping's `writeWhen` guard is satisfied by the profile. */
export function writeConditionHolds(mapping: FieldMapping, profile: CanonicalApplicationData): boolean {
  if (!mapping.writeWhen) return true;
  const actual = readCanonicalField(profile, mapping.writeWhen.canonicalField);
  if (actual === undefined) return false;
  return mapping.writeWhen.equalsAny.map(String).includes(String(actual));
}

export interface ResolvedValue {
  value: string;
  /** Why nothing was written, when `value` is empty. */
  reason?: UnansweredFieldRecord["reason"];
}

/**
 * Resolve what SmartPR would write into one government field. Pure — used both
 * by the PDF writers and by the readiness view that counts answered fields
 * without generating a document.
 */
export function resolveMappedValue(mapping: FieldMapping, profile: CanonicalApplicationData): ResolvedValue {
  if (mapping.sensitive) return { value: "", reason: "requires_user_entry" };
  if (mapping.canonicalField === null && mapping.constantValue === undefined) {
    return { value: "", reason: "no_canonical_mapping" };
  }
  if (!writeConditionHolds(mapping, profile)) {
    // The guard did not match: this box is intentionally left blank, and the
    // guarded canonical answer is reported through its own mapping row.
    return { value: "", reason: undefined };
  }
  if (mapping.constantValue !== undefined) return { value: mapping.constantValue };

  const raw = readCanonicalField(profile, mapping.canonicalField as string);
  if (raw === undefined) return { value: "", reason: "no_value_in_profile" };
  const shaped = applyTransform(raw, mapping.transform);
  if (!shaped) return { value: "", reason: "no_value_in_profile" };
  return { value: shaped };
}

function unansweredRecord(mapping: FieldMapping, reason: UnansweredFieldRecord["reason"]): UnansweredFieldRecord {
  return {
    pdfField: mapping.pdfField,
    canonicalField: mapping.canonicalField,
    page: mapping.page ?? mapping.placement?.page,
    reason,
    label: mapping.canonicalField ? canonicalFieldLabel(mapping.canonicalField) : mapping.pdfField,
  };
}

/**
 * Report which mapped fields the profile can answer today, without touching a
 * PDF. `unanswered` is what the UI turns into "additional information required".
 */
export function evaluateCompleteness(
  doc: FormMappingDocument,
  profile: CanonicalApplicationData
): { populated: PopulatedFieldRecord[]; unanswered: UnansweredFieldRecord[] } {
  const populated: PopulatedFieldRecord[] = [];
  const unanswered: UnansweredFieldRecord[] = [];
  for (const mapping of doc.fields) {
    const resolved = resolveMappedValue(mapping, profile);
    if (resolved.value) {
      populated.push({ pdfField: mapping.pdfField, canonicalField: mapping.canonicalField, value: resolved.value });
    } else if (resolved.reason) {
      unanswered.push(unansweredRecord(mapping, resolved.reason));
    }
  }
  return { populated, unanswered };
}

/** Split a value into at most `maxLines` lines that fit `width` at `size`. */
function wrapText(
  text: string,
  width: number,
  size: number,
  maxLines: number,
  measure: (s: string, size: number) => number
): string[] {
  if (maxLines <= 1) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, size) <= width || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

export interface PopulateOptions {
  /** Draw a light tint behind overlay text so a reviewer sees what SmartPR added. */
  highlightPopulatedValues?: boolean;
}

/**
 * Populate a working copy of the artifact. `templateBytes` is treated as
 * read-only input; the returned bytes are a separate document.
 */
export async function populateArtifact(
  doc: FormMappingDocument,
  templateBytes: Uint8Array,
  profile: CanonicalApplicationData,
  templateChecksum: string,
  options: PopulateOptions = {}
): Promise<PopulationResult> {
  // Copy the input so nothing downstream can write through to the caller's buffer.
  const working = Uint8Array.from(templateBytes);
  const pdf = await PDFDocument.load(working, { ignoreEncryption: true, updateMetadata: false });

  const populated: PopulatedFieldRecord[] = [];
  const unanswered: UnansweredFieldRecord[] = [];

  if (doc.populationMethod === "acroform") {
    const form = pdf.getForm();
    for (const mapping of doc.fields) {
      const resolved = resolveMappedValue(mapping, profile);
      if (!resolved.value) {
        if (resolved.reason) unanswered.push(unansweredRecord(mapping, resolved.reason));
        continue;
      }
      try {
        switch (mapping.pdfFieldType) {
          case "checkbox": {
            const box = form.getCheckBox(mapping.pdfField);
            if (/^(x|yes|s[ií]|true|on)$/i.test(resolved.value)) box.check();
            else box.uncheck();
            break;
          }
          case "radio_group":
            form.getRadioGroup(mapping.pdfField).select(resolved.value);
            break;
          case "dropdown":
            form.getDropdown(mapping.pdfField).select(resolved.value);
            break;
          case "option_list":
            form.getOptionList(mapping.pdfField).select(resolved.value);
            break;
          default:
            form.getTextField(mapping.pdfField).setText(resolved.value);
            break;
        }
        populated.push({ pdfField: mapping.pdfField, canonicalField: mapping.canonicalField, value: resolved.value });
      } catch {
        // A field that will not accept the value is reported, never forced.
        unanswered.push(unansweredRecord(mapping, "requires_user_entry"));
      }
    }
  } else if (doc.populationMethod === "pdf_overlay") {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pages = pdf.getPages();
    const measure = (s: string, size: number) => font.widthOfTextAtSize(s, size);
    for (const mapping of doc.fields) {
      const placement = mapping.placement;
      const resolved = resolveMappedValue(mapping, profile);
      if (!resolved.value || !placement) {
        if (resolved.reason) unanswered.push(unansweredRecord(mapping, resolved.reason));
        continue;
      }
      const page = pages[placement.page - 1];
      if (!page) {
        unanswered.push(unansweredRecord(mapping, "requires_user_entry"));
        continue;
      }
      const size = placement.fontSize ?? 9;
      const lineHeight = placement.lineHeight ?? size * 1.15;
      // Helvetica (WinAnsi) cannot encode every character a profile may hold;
      // substitute rather than abort the whole document.
      const safe = resolved.value.replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
      const lines = wrapText(safe, placement.width, size, placement.maxLines ?? 1, measure);
      lines.forEach((line, index) => {
        const y = placement.y - index * lineHeight;
        if (options.highlightPopulatedValues) {
          page.drawRectangle({
            x: placement.x - 1,
            y: y - 2,
            width: placement.width,
            height: size + 3,
            color: rgb(0.85, 0.93, 1),
            opacity: 0.45,
          });
        }
        page.drawText(line, { x: placement.x, y, size, font, color: rgb(0.05, 0.1, 0.25) });
      });
      populated.push({ pdfField: mapping.pdfField, canonicalField: mapping.canonicalField, value: resolved.value });
    }
  } else {
    // docx_merge / structured_portal_data / none are handled outside the PDF path.
    for (const mapping of doc.fields) {
      const resolved = resolveMappedValue(mapping, profile);
      if (resolved.value) {
        populated.push({ pdfField: mapping.pdfField, canonicalField: mapping.canonicalField, value: resolved.value });
      } else if (resolved.reason) {
        unanswered.push(unansweredRecord(mapping, resolved.reason));
      }
    }
  }

  const bytes = await pdf.save({ useObjectStreams: false });
  return {
    formCode: doc.formCode,
    populationMethod: doc.populationMethod,
    bytes,
    populated,
    unanswered,
    templateChecksum,
    generatedAt: new Date().toISOString(),
  };
}
