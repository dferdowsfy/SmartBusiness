// ============================================================================
// Local template loading with integrity checking.
//
// Every read of a canonical original is checksummed against
// `form-mappings/templates.manifest.json`. A mismatch means the immutable
// source changed underneath the mappings — coordinates and field names can no
// longer be trusted, so the load fails loudly instead of producing a filing
// that looks fine and is wrong.
// ============================================================================

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { getTemplate } from "./catalog.ts";
import { formMappingsDir, resolveRepoPath, sha256 } from "./paths.ts";
import type { TemplateDescriptor } from "./types.ts";

export interface TemplateManifestEntry {
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

export interface TemplateManifest {
  generatedAt: string;
  templates: TemplateManifestEntry[];
}

export function loadTemplateManifest(): TemplateManifest | null {
  const path = join(formMappingsDir(), "templates.manifest.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as TemplateManifest;
}

export function manifestEntry(formCode: string): TemplateManifestEntry | null {
  return loadTemplateManifest()?.templates.find((t) => t.formCode === formCode) ?? null;
}

export interface LoadedTemplate {
  template: TemplateDescriptor;
  bytes: Uint8Array;
  checksum: string;
}

export class TemplateIntegrityError extends Error {}

/**
 * Read a canonical original from disk. `verify` (default true) enforces the
 * recorded checksum.
 */
export function loadTemplateBytes(formCode: string, options: { verify?: boolean } = {}): LoadedTemplate {
  const template = getTemplate(formCode);
  if (!template) throw new Error(`Unknown form code: ${formCode}`);
  if (!template.sourceFile) {
    throw new Error(`${formCode} has no source file yet (sourceStatus: ${template.sourceStatus})`);
  }
  const absolute = resolveRepoPath(template.sourceFile);
  if (!existsSync(absolute)) throw new Error(`Template file missing on disk: ${template.sourceFile}`);

  const bytes = new Uint8Array(readFileSync(absolute));
  const checksum = sha256(bytes);
  if (options.verify !== false) {
    const entry = manifestEntry(formCode);
    if (entry && entry.checksum !== checksum) {
      throw new TemplateIntegrityError(
        `${formCode}: source file changed since inspection (manifest ${entry.checksum}, on disk ${checksum}). ` +
          "Re-run `npm run forms:inspect`, review the diff, and re-validate coordinate mappings before use."
      );
    }
  }
  return { template, bytes, checksum };
}
