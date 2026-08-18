// ============================================================================
// Upload the canonical government templates into Supabase Storage.
//
//   npm run forms:sync -- [--dry-run]
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the private
// buckets are not writable with the anon key).
//
// Uploads are WRITE-ONCE: an object that already exists is left exactly as it
// is and reported as already_present. Replacing canonical bytes would destroy
// the provenance every checksum, mapping and coordinate overlay depends on.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

import { availableTemplates, pendingTemplates } from "../src/app/forms/artifacts/catalog.ts";
import { loadTemplateBytes } from "../src/app/forms/artifacts/templateLoader.ts";
import { templateStorageRef, uploadCanonicalTemplate } from "../src/app/forms/artifacts/storage.ts";

const dryRun = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("SmartPR template library → Supabase Storage");
  console.log("===========================================");

  for (const template of availableTemplates()) {
    const ref = templateStorageRef(template);
    const loaded = loadTemplateBytes(template.formCode);
    const target = `${ref.bucket}/${ref.objectPath}`;
    if (dryRun || !url || !serviceKey) {
      console.log(`${dryRun ? "[dry-run]" : "[no credentials]"} ${template.formCode} → ${target} (${loaded.checksum})`);
      continue;
    }
    const client = createClient(url, serviceKey, { auth: { persistSession: false } });
    const result = await uploadCanonicalTemplate(client, template, loaded.bytes);
    console.log(`${result.outcome.padEnd(15)} ${template.formCode} → ${target} (${loaded.checksum})`);
  }

  for (const template of pendingTemplates()) {
    console.log(`pending_source  ${template.formCode} → ${template.storagePath} (no file to upload yet)`);
  }

  if (!dryRun && (!url || !serviceKey)) {
    console.log("\nSet NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to perform the upload.");
  }
}

await main();
