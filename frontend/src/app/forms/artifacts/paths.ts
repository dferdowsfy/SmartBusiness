// ============================================================================
// Filesystem locations for the template library and its mapping artifacts.
// Node-only (scripts, route handlers, tests) — never imported by client code.
// ============================================================================

import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

/** Frontend service root. Overridable so a deployment can relocate the library. */
export function repoRoot(): string {
  return process.env.SMARTPR_REPO_ROOT ? resolve(process.env.SMARTPR_REPO_ROOT) : process.cwd();
}

/** Directory holding the untouched original government files. */
export function realFormsDir(): string {
  return join(repoRoot(), "RealForms");
}

/** Directory holding the generated inspection + mapping artifacts. */
export function formMappingsDir(): string {
  return join(repoRoot(), "form-mappings");
}

/** Absolute path for a repository-relative path recorded in the catalog. */
export function resolveRepoPath(relativePath: string): string {
  return join(repoRoot(), relativePath);
}

/** "sha256:<hex>" for the given bytes. */
export function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
