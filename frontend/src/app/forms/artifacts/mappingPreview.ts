// ============================================================================
// Developer/admin mapping preview.
//
// Draws every mapping boundary on top of the real artifact so a human can see
// where SmartPR would write before anything is filed. Overlay coordinates in
// particular are unverifiable by unit test alone — this is how they get
// validated, and re-validated after a government revision.
//
// The preview is a throwaway rendering: it is never a filing artifact, and the
// canonical template is untouched.
// ============================================================================

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { needsHumanReview } from "./semanticMapping.ts";
import type { FormMappingDocument } from "./types.ts";

const MAPPED = rgb(0.09, 0.5, 0.32);
const NEEDS_REVIEW = rgb(0.85, 0.45, 0.05);
const UNMAPPED = rgb(0.7, 0.15, 0.2);

/**
 * Render a copy of the template with mapping boundaries drawn on it.
 * Green = mapped and reviewed, amber = mapped but awaiting human review,
 * red = no canonical mapping (answered on the artifact itself).
 */
export async function renderMappingPreview(
  doc: FormMappingDocument,
  templateBytes: Uint8Array
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(Uint8Array.from(templateBytes), {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  for (const mapping of doc.fields) {
    const box = mapping.placement
      ? {
          page: mapping.placement.page,
          x: mapping.placement.x,
          y: mapping.placement.y,
          width: mapping.placement.width,
          height: mapping.placement.height,
        }
      : mapping.rect && mapping.page
        ? { page: mapping.page, x: mapping.rect.x, y: mapping.rect.y, width: mapping.rect.width, height: mapping.rect.height }
        : null;
    if (!box) continue;
    const page = pages[box.page - 1];
    if (!page) continue;

    const color = mapping.canonicalField === null ? UNMAPPED : needsHumanReview(mapping) ? NEEDS_REVIEW : MAPPED;
    // Placement boxes are anchored on the text baseline; nudge down so the
    // drawn rectangle brackets the glyphs rather than sitting on top of them.
    const y = mapping.placement ? box.y - 2 : box.y;
    page.drawRectangle({
      x: box.x - 1,
      y,
      width: Math.max(box.width, 6),
      height: Math.max(box.height, 8),
      borderColor: color,
      borderWidth: 0.6,
      opacity: 0,
      borderOpacity: 0.9,
    });
    // Helvetica/WinAnsi has no arrow glyph — plain ASCII keeps the label safe
    // for any field name the government file happens to use.
    const label = `${mapping.pdfField} -> ${mapping.canonicalField ?? "(unmapped)"}`;
    page.drawText(asciiSafe(label).slice(0, 78), {
      x: box.x,
      y: y + Math.max(box.height, 8) + 1.2,
      size: 4.4,
      font,
      color,
    });
  }

  // Legend on page 1 so the artifact is self-describing when exported.
  const first = pages[0];
  if (first) {
    const legend = [
      `SmartPR mapping preview — ${doc.formCode} (${doc.populationMethod})`,
      "green = reviewed mapping | amber = needs human review | red = answered on the artifact",
      "Not a filing document.",
    ];
    legend.forEach((line, i) => {
      first.drawText(asciiSafe(line), { x: 18, y: 14 - i * 5.5, size: 4.8, font, color: rgb(0.35, 0.35, 0.4) });
    });
  }

  return pdf.save({ useObjectStreams: false });
}

/** Standard fonts are WinAnsi-encoded; drop anything they cannot render. */
function asciiSafe(text: string): string {
  return text.replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
}
