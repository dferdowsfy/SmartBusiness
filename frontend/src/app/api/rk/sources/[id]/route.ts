// Regulatory source detail + status updates.
// GET -> { source, proposals }   (raw_text omitted; sections included)
// PUT { legalStatus?, citation?, effectiveDate?, title? } -> { source }
import { isCurrentUserAdmin } from "../../../../../lib/admin";
import { getCurrentUser } from "../../../../../lib/supabase/server";
import { isEnabled } from "../../../../graph/db";
import { getSource, updateSource } from "../../../../rk/sources";
import { listProposals } from "../../../../rk/proposals";
import type { LegalStatus } from "../../../../rk/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });
  const { id } = await ctx.params;
  const source = await getSource(id);
  if (!source) return Response.json({ error: "not_found" }, { status: 404 });
  const proposals = await listProposals({ sourceId: id });
  const { raw_text, ...rest } = source;
  return Response.json({ source: { ...rest, raw_text_length: raw_text?.length ?? 0 }, proposals });
}

export async function PUT(request: Request, ctx: Ctx) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });
  const { id } = await ctx.params;

  let body: { legalStatus?: LegalStatus; citation?: string; effectiveDate?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const user = await getCurrentUser();
  const result = await updateSource(id, body, user?.email ?? null);
  if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
  return Response.json({ source: result.source });
}
