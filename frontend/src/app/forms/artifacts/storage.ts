// ============================================================================
// Supabase Storage layout for government artifacts.
//
//   official-form-templates/   canonical originals, private, WRITE-ONCE
//   municipal-form-templates/  generic municipal layouts, private, WRITE-ONCE
//   generated-filings/         per-tenant populated working copies
//
// A canonical template object is never overwritten: uploads use upsert:false
// and a new agency revision is stored under its own revision key while the old
// bytes stay retrievable. That is what makes checksum-based change detection
// and coordinate-mapping version pinning meaningful.
// ============================================================================

import {
  DELIVERABLES_BUCKET,
  GENERATED_FILINGS_BUCKET,
  MUNICIPAL_TEMPLATE_BUCKET,
  OFFICIAL_TEMPLATE_BUCKET,
} from "./catalog.ts";
import type { TemplateDescriptor } from "./types.ts";

export interface StorageRef {
  bucket: string;
  objectPath: string;
}

/** Split a catalog `storagePath` ("bucket/a/b/c.pdf") into bucket + object path. */
export function parseStoragePath(storagePath: string): StorageRef {
  const [bucket, ...rest] = storagePath.split("/");
  return { bucket, objectPath: rest.join("/") };
}

export function templateStorageRef(template: TemplateDescriptor): StorageRef {
  if (template.storagePath) return parseStoragePath(template.storagePath);
  const bucket =
    template.scope === "municipality_specific" ? MUNICIPAL_TEMPLATE_BUCKET : OFFICIAL_TEMPLATE_BUCKET;
  return { bucket, objectPath: `${template.formCode}/current/original.pdf` };
}

/**
 * Where a superseded revision is parked when a new official file arrives.
 * Old versions are retained forever — nothing is deleted or replaced in place.
 */
export function templateRevisionStorageRef(template: TemplateDescriptor, revisionKey: string): StorageRef {
  const ref = templateStorageRef(template);
  const safeRevision = revisionKey.replace(/[^A-Za-z0-9._-]+/g, "-");
  return { bucket: ref.bucket, objectPath: ref.objectPath.replace("/current/", `/revisions/${safeRevision}/`) };
}

export interface GeneratedFilingKey {
  tenantId: string;
  businessId: string;
  formCode: string;
  instanceId: string;
  fileName?: string;
}

/** generated-filings/{tenant_id}/{business_id}/{form_code}/{instance_id}/populated.pdf */
export function generatedFilingRef(key: GeneratedFilingKey): StorageRef {
  const fileName = key.fileName ?? "populated.pdf";
  return {
    bucket: GENERATED_FILINGS_BUCKET,
    objectPath: `${key.tenantId}/${key.businessId}/${key.formCode}/${key.instanceId}/${fileName}`,
  };
}

export interface DeliverableKey {
  userId: string;
  deliverableId: string;
  fileName: string;
}

/** deliverables/{user_id}/{deliverable_id}/{file_name} */
export function deliverableStorageRef(key: DeliverableKey): StorageRef {
  return {
    bucket: DELIVERABLES_BUCKET,
    objectPath: `${key.userId}/${key.deliverableId}/${key.fileName}`,
  };
}

// ---------------------------------------------------------------------------
// Client plumbing
// ---------------------------------------------------------------------------

/**
 * Structural subset of the Supabase client this module needs. Keeping it
 * structural means the storage layout is unit-testable without a live project.
 */
export interface StorageCapableClient {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: ArrayBuffer | Uint8Array | Blob,
        options?: { contentType?: string; upsert?: boolean }
      ): Promise<{ data: unknown; error: { message: string; statusCode?: string } | null }>;
      download(path: string): Promise<{ data: Blob | null; error: { message: string } | null }>;
      createSignedUrl(
        path: string,
        expiresIn: number
      ): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
    };
  };
}

export type TemplateUploadOutcome = "uploaded" | "already_present";

/**
 * Upload a canonical original. Refuses to overwrite: an existing object means
 * the library already holds that revision's bytes, and replacing them would
 * destroy the provenance every mapping and checksum depends on.
 */
export async function uploadCanonicalTemplate(
  client: StorageCapableClient,
  template: TemplateDescriptor,
  bytes: Uint8Array
): Promise<{ outcome: TemplateUploadOutcome; ref: StorageRef }> {
  const ref = templateStorageRef(template);
  const { error } = await client.storage
    .from(ref.bucket)
    .upload(ref.objectPath, bytes, { contentType: "application/pdf", upsert: false });
  if (error) {
    if (/exists|duplicate/i.test(error.message) || error.statusCode === "409") {
      return { outcome: "already_present", ref };
    }
    throw new Error(`Template upload failed for ${template.formCode}: ${error.message}`);
  }
  return { outcome: "uploaded", ref };
}

export async function downloadCanonicalTemplate(
  client: StorageCapableClient,
  template: TemplateDescriptor
): Promise<Uint8Array> {
  const ref = templateStorageRef(template);
  const { data, error } = await client.storage.from(ref.bucket).download(ref.objectPath);
  if (error || !data) {
    throw new Error(`Template download failed for ${template.formCode}: ${error?.message ?? "not found"}`);
  }
  return new Uint8Array(await data.arrayBuffer());
}

/** Store a populated working copy. Generated documents may be replaced freely. */
export async function uploadGeneratedFiling(
  client: StorageCapableClient,
  key: GeneratedFilingKey,
  bytes: Uint8Array
): Promise<StorageRef> {
  const ref = generatedFilingRef(key);
  const { error } = await client.storage
    .from(ref.bucket)
    .upload(ref.objectPath, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Generated filing upload failed for ${key.formCode}: ${error.message}`);
  return ref;
}

/**
 * Sign a short-lived download URL for any stored object this module knows the
 * path for. Callers MUST verify the requesting user actually owns the record
 * that points at `ref` before calling this — the storage layer trusts the
 * caller to have already done that authorization check.
 */
export async function signedFilingUrl(
  client: StorageCapableClient,
  ref: StorageRef,
  expiresInSeconds = 300
): Promise<string> {
  const { data, error } = await client.storage.from(ref.bucket).createSignedUrl(ref.objectPath, expiresInSeconds);
  if (error || !data) throw new Error(`Could not sign ${ref.bucket}/${ref.objectPath}: ${error?.message ?? "unknown"}`);
  return data.signedUrl;
}

/** Store an archived deliverable (readiness report / submission package). */
export async function uploadDeliverable(
  client: StorageCapableClient,
  key: DeliverableKey,
  bytes: ArrayBuffer | Uint8Array | Blob,
  contentType: string
): Promise<StorageRef> {
  const ref = deliverableStorageRef(key);
  const { error } = await client.storage
    .from(ref.bucket)
    .upload(ref.objectPath, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Deliverable upload failed for ${key.deliverableId}: ${error.message}`);
  return ref;
}
