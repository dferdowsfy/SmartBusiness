// PR 4/5/6: get a form instance (template schema + prefilled data) and save it.
// GET  -> { instance, template }
// PUT  { formData, markReview? } -> { instance, validation }
import { isEnabled } from "../../../../graph/db";
import { getCurrentUser } from "../../../../../lib/supabase/server";
import { getFormInstance, saveFormInstance } from "../../../../requirements/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });

  const result = await getFormInstance(id);
  if (!result) return Response.json({ error: "not_found" }, { status: 404 });
  if (result.instance.user_id !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return Response.json(result);
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });

  const existing = await getFormInstance(id);
  if (!existing) return Response.json({ error: "not_found" }, { status: 404 });
  if (existing.instance.user_id !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { formData?: Record<string, unknown>; markReview?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const saved = await saveFormInstance(id, body.formData ?? {}, { markReview: !!body.markReview });
  if (!saved) return Response.json({ error: "save_failed" }, { status: 500 });
  return Response.json(saved);
}
