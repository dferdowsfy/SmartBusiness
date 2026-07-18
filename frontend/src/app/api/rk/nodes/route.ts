// Create a new graph node — as a change proposal (never a direct write).
// POST { nodeType, data, note?, sourceId?, citationSection? } -> { proposal }
import { isCurrentUserAdmin } from "../../../../lib/admin";
import { getCurrentUser } from "../../../../lib/supabase/server";
import { isEnabled } from "../../../graph/db";
import { NODE_TYPE_CONFIGS, newEntityId } from "../../../rk/registry";
import { createProposal, uniqueEntityId } from "../../../rk/proposals";
import type { NodeType } from "../../../rk/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });

  let body: { nodeType?: NodeType; data?: Record<string, unknown>; note?: string; sourceId?: string; citationSection?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const cfg = body.nodeType ? NODE_TYPE_CONFIGS[body.nodeType] : undefined;
  if (!cfg || !body.data) return Response.json({ error: "nodeType and data are required" }, { status: 400 });

  const user = await getCurrentUser();
  const base = newEntityId(body.nodeType!, cfg.labelOf(body.data) || "NEW");
  const entityId = await uniqueEntityId(body.nodeType!, base);

  const result = await createProposal({
    origin: "manual",
    changeKind: "create_node",
    nodeType: body.nodeType!,
    entityId,
    data: body.data,
    note: body.note ?? null,
    sourceId: body.sourceId ?? null,
    citationSection: body.citationSection ?? null,
    actor: user?.email ?? null,
  });
  if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
  return Response.json({ proposal: result.proposal });
}
