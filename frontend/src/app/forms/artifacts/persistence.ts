// ============================================================================
// Persisting a generated working copy.
//
// A populated artifact is recorded in three places, and never in a way that
// touches the canonical template:
//   1. Supabase Storage  — generated-filings/{tenant}/{business}/{form}/{id}/
//   2. user_form_instances — the durable record, with the template checksum it
//      was produced from and the fields still unanswered
//   3. the caller's response — bytes for immediate review
//
// Every write is best-effort in exactly the way the rest of SmartPR is: with no
// DATABASE_URL or no Supabase project, generation still works and the caller is
// told what could not be persisted.
// ============================================================================

import { getPool } from "../../graph/db";
import { ensureRequirementsSchema } from "../../requirements/schema";
import { getTemplate } from "./catalog.ts";
import { generatedFilingRef, uploadGeneratedFiling, type StorageCapableClient } from "./storage.ts";
import type { CanonicalApplicationData } from "../engine/types.ts";
import type { PopulationResult } from "./types.ts";

export interface RecordFilingInput {
  tenantId: string;
  businessId: string;
  userId: string;
  instanceId: string;
  formCode: string;
  result: PopulationResult;
  profile: CanonicalApplicationData;
  storageClient?: StorageCapableClient | null;
}

export interface RecordFilingOutcome {
  storagePath: string | null;
  persisted: boolean;
  warnings: string[];
}

/** Store the populated copy and record the instance. Never writes a template. */
export async function recordGeneratedFiling(input: RecordFilingInput): Promise<RecordFilingOutcome> {
  const warnings: string[] = [];
  const template = getTemplate(input.formCode);
  const ref = generatedFilingRef({
    tenantId: input.tenantId,
    businessId: input.businessId,
    formCode: input.formCode,
    instanceId: input.instanceId,
  });

  let storagePath: string | null = null;
  if (input.storageClient) {
    try {
      await uploadGeneratedFiling(input.storageClient, {
        tenantId: input.tenantId,
        businessId: input.businessId,
        formCode: input.formCode,
        instanceId: input.instanceId,
      }, input.result.bytes);
      storagePath = `${ref.bucket}/${ref.objectPath}`;
    } catch (error) {
      warnings.push(`Storage upload failed: ${(error as Error).message}`);
    }
  } else {
    warnings.push("Supabase Storage is not configured; the populated copy was not archived.");
  }

  const pool = getPool();
  if (!pool) {
    warnings.push("No database configured; the filing instance was not recorded.");
    return { storagePath, persisted: false, warnings };
  }

  try {
    await ensureRequirementsSchema();
    await pool.query(
      `INSERT INTO user_form_instances
         (id, tenant_id, target_id, user_id, status, form_data_json, form_code, artifact_type,
          population_method, populated_storage_path, template_checksum, canonical_snapshot_json,
          populated_fields_json, unanswered_fields_json, completed_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::jsonb, $7, $8, $9, $10, $11,
               $12::jsonb, $13::jsonb, $14::jsonb, now(), now())
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         populated_storage_path = EXCLUDED.populated_storage_path,
         template_checksum = EXCLUDED.template_checksum,
         canonical_snapshot_json = EXCLUDED.canonical_snapshot_json,
         populated_fields_json = EXCLUDED.populated_fields_json,
         unanswered_fields_json = EXCLUDED.unanswered_fields_json,
         updated_at = now()`,
      [
        input.instanceId,
        input.tenantId,
        input.businessId,
        input.userId,
        input.result.unanswered.length === 0 ? "complete" : "in_progress",
        JSON.stringify({}),
        input.formCode,
        template?.artifactType ?? null,
        input.result.populationMethod,
        storagePath,
        input.result.templateChecksum,
        JSON.stringify(input.profile),
        JSON.stringify(input.result.populated),
        JSON.stringify(input.result.unanswered),
      ]
    );
    return { storagePath, persisted: true, warnings };
  } catch (error) {
    warnings.push(`Instance record failed: ${(error as Error).message}`);
    return { storagePath, persisted: false, warnings };
  }
}
