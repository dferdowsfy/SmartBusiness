// Temporary adapter: the deliverables screen archives generated files
// (readiness report PDF / submission ZIP) for signed-in users. There is no
// file-storage backend yet, so this endpoint records deliverable METADATA in
// the existing `deliverables` table (created by graph/store.ts) and discards
// the binary. Replace `storage_path` handling with a real Supabase Storage
// upload when storage is wired up. Anonymous calls are a polite no-op so the
// client's fire-and-forget archive never breaks the user flow.

import { randomUUID } from "crypto";
import { getPool, isEnabled } from "../../graph/db";
import { ensureSchema } from "../../graph/store";
import { getCurrentUser } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ archived: false, reason: "anonymous" });
  if (!isEnabled()) return Response.json({ archived: false, reason: "no_database" });
  const pool = getPool();
  if (!pool) return Response.json({ archived: false, reason: "no_database" });

  let kind = "report";
  let filename = "deliverable";
  let sizeBytes: number | null = null;
  let submissionId: string | null = null;
  let businessId: string | null = null;
  try {
    const fd = await req.formData();
    kind = String(fd.get("kind") || "report");
    submissionId = (fd.get("submission_id") as string) || null;
    businessId = (fd.get("business_id") as string) || null;
    const file = fd.get("file");
    if (file instanceof File) {
      filename = file.name || filename;
      sizeBytes = file.size;
    }
  } catch {
    return Response.json({ archived: false, reason: "bad_form" }, { status: 400 });
  }

  try {
    await ensureSchema();
    await pool.query(
      `INSERT INTO deliverables (id, user_id, business_id, submission_id, kind, filename, storage_path, size_bytes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), user.id, businessId, submissionId, kind, filename, `pending-storage/${filename}`, sizeBytes]
    );
    return Response.json({ archived: true });
  } catch (err) {
    console.error("[deliverables] archive failed:", (err as Error).message);
    return Response.json({ archived: false, reason: "insert_failed" }, { status: 500 });
  }
}
