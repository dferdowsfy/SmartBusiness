import { randomUUID } from "crypto";
import { getCurrentUser, createSupabaseServer, isAuthConfigured } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-140) || "document";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isAuthConfigured()) return Response.json({ error: "Supabase Storage is not configured." }, { status: 503 });
  let file: File | null = null;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (candidate instanceof File) file = candidate;
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!file || file.size === 0) return Response.json({ error: "A document is required." }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return Response.json({ error: "Documents must be 20 MB or smaller." }, { status: 413 });
  const supabase = await createSupabaseServer();
  if (!supabase) return Response.json({ error: "Supabase Storage is unavailable." }, { status: 503 });
  const path = `${user.id}/imports/${randomUUID()}/${safeName(file.name)}`;
  const { error } = await supabase.storage.from("evidence").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    console.error("[evidence-upload]", error.message);
    return Response.json({ error: "Evidence storage is not ready. Apply the storage migration and retry." }, { status: 503 });
  }
  return Response.json({ storage_path: path, filename: file.name, size_bytes: file.size, mime_type: file.type || null });
}
