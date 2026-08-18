// ============================================================================
// Inspect every template in the SmartPR library and (re)generate its mapping
// artifact under `form-mappings/`.
//
//   npm run forms:inspect
//
// Re-running is safe: human review (`reviewed: true`) survives, and fields that
// vanished from a source file are reported rather than dropped in silence.
// The source PDFs are opened read-only; nothing in this script writes to them.
// ============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { TEMPLATE_LIBRARY } from "../src/app/forms/artifacts/catalog.ts";
import { inspectPdfBytes } from "../src/app/forms/artifacts/inspection.ts";
import { loadMapping, mergeMappings, saveMapping } from "../src/app/forms/artifacts/mappingStore.ts";
import { OVERLAY_MAPS } from "../src/app/forms/artifacts/overlayMaps.ts";
import { formMappingsDir, resolveRepoPath, sha256 } from "../src/app/forms/artifacts/paths.ts";
import { draftMappingForField, needsHumanReview } from "../src/app/forms/artifacts/semanticMapping.ts";
import type { FieldMapping, FormMappingDocument } from "../src/app/forms/artifacts/types.ts";

interface ManifestEntry {
  formCode: string;
  sourceFile: string;
  checksum: string;
  byteLength: number;
  pageCount: number;
  hasAcroForm: boolean;
  nativeFieldCount: number;
  populationMethod: string;
  artifactType: string;
  sourceStatus: string;
}

async function main(): Promise<void> {
  const manifest: ManifestEntry[] = [];
  const summary: string[] = [];

  for (const template of TEMPLATE_LIBRARY) {
    if (template.sourceStatus === "pending_source" || !template.sourceFile) {
      const doc: FormMappingDocument = {
        formCode: template.formCode,
        sourceFile: template.sourceFile ?? null,
        artifactType: template.artifactType,
        populationMethod: "none",
        templateChecksum: null,
        pageCount: 0,
        hasAcroForm: false,
        inspectedAt: null,
        status: "pending_source",
        notes: [
          "No source file in RealForms yet — SmartPR reports requirements only for this artifact.",
          ...(template.usageNotes ?? []),
        ],
        fields: [],
      };
      saveMapping(doc);
      summary.push(`${template.formCode.padEnd(10)} pending_source — no file, mapping stub written`);
      continue;
    }

    const absolute = resolveRepoPath(template.sourceFile);
    if (!existsSync(absolute)) {
      throw new Error(`Catalog lists ${template.sourceFile} but the file is missing at ${absolute}`);
    }
    const bytes = new Uint8Array(readFileSync(absolute));
    const checksum = sha256(bytes);
    const report = await inspectPdfBytes(bytes, {
      formCode: template.formCode,
      sourceFile: template.sourceFile,
      checksum,
    });

    let proposed: FieldMapping[];
    let populationMethod: FormMappingDocument["populationMethod"];
    if (report.hasAcroForm) {
      populationMethod = "acroform";
      proposed = report.fields.map(draftMappingForField);
    } else {
      populationMethod = "pdf_overlay";
      proposed = OVERLAY_MAPS[template.formCode] ?? [];
      if (proposed.length === 0) {
        summary.push(`${template.formCode.padEnd(10)} NO ACROFORM AND NO OVERLAY MAP — needs coordinate mapping`);
      }
    }

    const previous = loadMapping(template.formCode);
    const merged = mergeMappings(previous?.fields ?? [], proposed);

    const notes = [...(template.usageNotes ?? [])];
    if (merged.disappeared.length > 0) {
      notes.push(
        `Fields present in the previous mapping but absent from this source revision (review before use): ${merged.disappeared
          .map((f) => f.pdfField)
          .join(", ")}`
      );
    }

    const doc: FormMappingDocument = {
      formCode: template.formCode,
      sourceFile: template.sourceFile,
      artifactType: template.artifactType,
      populationMethod,
      templateChecksum: checksum,
      templateRevision: template.revision,
      pageCount: report.pageCount,
      hasAcroForm: report.hasAcroForm,
      inspectedAt: report.inspectedAt,
      status: "mapped",
      notes,
      fields: merged.fields,
    };
    saveMapping(doc);

    // The raw inventory is kept beside the mapping so a reviewer can diff what
    // the government file actually contains against what SmartPR mapped.
    const inventoryDir = join(formMappingsDir(), "inventory");
    mkdirSync(inventoryDir, { recursive: true });
    writeFileSync(join(inventoryDir, `${template.formCode}.inventory.json`), `${JSON.stringify(report, null, 2)}\n`);

    manifest.push({
      formCode: template.formCode,
      sourceFile: template.sourceFile,
      checksum,
      byteLength: bytes.byteLength,
      pageCount: report.pageCount,
      hasAcroForm: report.hasAcroForm,
      nativeFieldCount: report.fieldCount,
      populationMethod,
      artifactType: template.artifactType,
      sourceStatus: template.sourceStatus,
    });

    const mapped = merged.fields.filter((f) => f.canonicalField !== null).length;
    const review = merged.fields.filter(needsHumanReview).length;
    summary.push(
      `${template.formCode.padEnd(10)} ${populationMethod.padEnd(12)} pages=${report.pageCount} native=${report.fieldCount} ` +
        `mapped=${mapped}/${merged.fields.length} needs_review=${review} kept_reviewed=${merged.keptReviewed}`
    );
  }

  mkdirSync(formMappingsDir(), { recursive: true });
  writeFileSync(
    join(formMappingsDir(), "templates.manifest.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), templates: manifest }, null, 2)}\n`
  );

  console.log("SmartPR template library inspection");
  console.log("===================================");
  for (const line of summary) console.log(line);
  console.log(`\nMappings written to ${formMappingsDir()}`);
}

await main();
