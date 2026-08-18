// ============================================================================
// PDF inspection.
//
// Answers, for a real government PDF: does it carry native AcroForm fields, and
// if so exactly which ones, on which page, at which rectangle, with which
// current value? Everything downstream (mapping, population method, overlay
// need) is decided from this inventory rather than from assumption.
// ============================================================================

import {
  PDFButton,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
  type PDFField,
} from "pdf-lib";

import type { AcroFieldRecord, PdfFieldType, PdfInspectionReport } from "./types.ts";

function fieldType(field: PDFField): PdfFieldType {
  if (field instanceof PDFTextField) return "text";
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFRadioGroup) return "radio_group";
  if (field instanceof PDFDropdown) return "dropdown";
  if (field instanceof PDFOptionList) return "option_list";
  if (field instanceof PDFSignature) return "signature";
  if (field instanceof PDFButton) return "button";
  return "unknown";
}

function currentValue(field: PDFField): string | undefined {
  try {
    if (field instanceof PDFTextField) return field.getText() ?? undefined;
    if (field instanceof PDFCheckBox) return field.isChecked() ? "on" : undefined;
    if (field instanceof PDFRadioGroup) return field.getSelected() ?? undefined;
    if (field instanceof PDFDropdown) return field.getSelected()[0];
    if (field instanceof PDFOptionList) return field.getSelected()[0];
  } catch {
    // A malformed value must never abort the inventory.
  }
  return undefined;
}

function fieldOptions(field: PDFField): string[] | undefined {
  try {
    if (field instanceof PDFRadioGroup) return field.getOptions();
    if (field instanceof PDFDropdown) return field.getOptions();
    if (field instanceof PDFOptionList) return field.getOptions();
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Inventory every AcroForm field in `bytes`. Never mutates the input: pdf-lib
 * parses a copy and this function only reads.
 */
export async function inspectPdfBytes(
  bytes: Uint8Array,
  meta: { formCode: string; sourceFile: string; checksum: string }
): Promise<PdfInspectionReport> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const pages = doc.getPages();
  const pageIndexByRef = new Map<string, number>();
  pages.forEach((page, index) => pageIndexByRef.set(page.ref.toString(), index + 1));

  let fields: PDFField[] = [];
  let hasAcroForm = false;
  try {
    const form = doc.getForm();
    fields = form.getFields();
    hasAcroForm = fields.length > 0;
  } catch {
    hasAcroForm = false;
  }

  const records: AcroFieldRecord[] = fields.map((field) => {
    const widgets = field.acroField.getWidgets();
    const first = widgets[0];
    let page: number | undefined;
    let rect: AcroFieldRecord["rect"];
    if (first) {
      const ref = first.P();
      if (ref) page = pageIndexByRef.get(ref.toString());
      const r = first.getRectangle();
      rect = { x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height) };
    }
    const record: AcroFieldRecord = {
      name: field.getName(),
      type: fieldType(field),
      page,
      rect,
      currentValue: currentValue(field),
      options: fieldOptions(field),
      readOnly: field.isReadOnly(),
    };
    if (field instanceof PDFTextField) {
      const max = field.getMaxLength();
      if (typeof max === "number") record.maxLength = max;
    }
    return record;
  });

  return {
    formCode: meta.formCode,
    sourceFile: meta.sourceFile,
    checksum: meta.checksum,
    pageCount: pages.length,
    pageSizes: pages.map((p, i) => ({ page: i + 1, width: round(p.getWidth()), height: round(p.getHeight()) })),
    hasAcroForm,
    fieldCount: records.length,
    fields: records,
    inspectedAt: new Date().toISOString(),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
