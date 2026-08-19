// ============================================================================
// Independent read-back of a produced PDF.
//
// The population engine reports which fields it wrote. That report is the
// engine grading its own homework: it proves the code took a branch, not that
// a value physically landed in the delivered document. These helpers reopen
// the produced bytes with a *different* reader and pull the content back out,
// so a test can assert on what a person opening the PDF would actually see.
//
//   pdf_overlay → text is drawn into the page content stream (pdf.js extracts)
//   acroform    → values live in form fields (pdf-lib reads them)
//
// Node-only (scripts + tests). Never imported by client code.
// ============================================================================

import { PDFDocument } from "pdf-lib";

/** Text of every page of a PDF, page contents joined by newlines. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  // Deep import: pdfjs-dist ships no exports map, and the legacy build is the
  // one that runs under plain Node without a DOM.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    // pdf.js transfers ownership of the buffer it is handed, which would
    // detach a caller's array. Hand it a copy.
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    verbosity: 0,
  }).promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
      );
    }
    return pages.join("\n");
  } finally {
    await doc.destroy();
  }
}

/** Current value of every readable AcroForm text field, keyed by field name. */
export async function readAcroFormValues(bytes: Uint8Array): Promise<Record<string, string>> {
  const doc = await PDFDocument.load(bytes);
  const out: Record<string, string> = {};
  for (const field of doc.getForm().getFields()) {
    const name = field.getName();
    // Only text fields carry a free-text value worth comparing against a
    // canonical string; checkboxes/radios are asserted through their own API.
    const maybeText = field as { getText?: () => string | undefined };
    if (typeof maybeText.getText !== "function") continue;
    try {
      const value = maybeText.getText();
      if (value !== undefined && value !== null) out[name] = value;
    } catch {
      // A malformed widget should not hide the fields that did read cleanly.
    }
  }
  return out;
}

/**
 * Fold text to a comparable form: collapse whitespace, drop diacritics, lower
 * case. Overlay text is drawn per-field and pdf.js re-splits it into runs, so
 * comparing raw strings produces false failures on spacing alone.
 *
 * Diacritic folding matches "Bayamón" to "bayamon" — a real match, not a
 * loophole: mangled encoding does not fold to the right letters. Tests that
 * care about accent preservation assert on the unfolded text instead.
 */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Whether `value` appears in `haystack`, both folded per `foldForSearch`. */
export function pdfTextContains(haystack: string, value: string): boolean {
  const needle = foldForSearch(value);
  if (needle.length === 0) return false;
  return foldForSearch(haystack).includes(needle);
}
