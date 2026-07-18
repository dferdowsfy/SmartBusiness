// Node detail + editing (all edits become change proposals).
// GET    -> { node, versions, edgesIn, edgesOut, proposals, source }
// PUT    { data, note? }  -> { proposal }   (update_node proposal)
// DELETE { note? }        -> { proposal }   (archive_node proposal — never a hard delete)
import { isCurrentUserAdmin } from "../../../../../lib/admin";
import { getCurrentUser } from "../../../../../lib/supabase/server";
import { isEnabled } from "../../../../graph/db";
import { getNodeDetail } from "../../../../rk/store";
import { createProposal } from "../../../../rk/proposals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ entityId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });
  const { entityId } = await ctx.params;
  const detail = await getNodeDetail(decodeURIComponent(entityId));
  if (!detail) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(detail);
}

export async function PUT(request: Request, ctx: Ctx) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });
  const { entityId } = await ctx.params;

  let body: { data?: Record<string, unknown>; note?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.data) return Response.json({ error: "data is required" }, { status: 400 });

  const id = decodeURIComponent(entityId);
  const detail = await getNodeDetail(id);
  if (!detail?.node) return Response.json({ error: "not_found" }, { status: 404 });

  const user = await getCurrentUser();
  const result = await createProposal({
    origin: "manual",
    changeKind: "update_node",
    nodeType: detail.node.node_type,
    entityId: id,
    data: body.data,
    note: body.note ?? null,
    actor: user?.email ?? null,
  });
  if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
  return Response.json({ proposal: result.proposal });
}

export async function DELETE(request: Request, ctx: Ctx) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });
  const { entityId } = await ctx.params;

  let note: string | null = null;
  try {
    const body = await request.json();
    note = typeof body?.note === "string" ? body.note : null;
  } catch {
    /* empty body ok */
  }

  const id = decodeURIComponent(entityId);
  const detail = await getNodeDetail(id);
  if (!detail?.node) return Response.json({ error: "not_found" }, { status: 404 });

  const user = await getCurrentUser();
  const result = await createProposal({
    origin: "manual",
    changeKind: "archive_node",
    nodeType: detail.node.node_type,
    entityId: id,
    note,
    actor: user?.email ?? null,
  });
  if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
  return Response.json({ proposal: result.proposal });
}
