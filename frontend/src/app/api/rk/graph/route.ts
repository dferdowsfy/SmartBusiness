// Regulatory Knowledge Graph — read the graph for a view mode.
// GET /api/rk/graph?mode=live|draft|proposed&types=rule,document&q=sanitaria
//  -> { enabled, mode, nodes, edges, counts }
// Admin-gated: the graph includes unpublished draft/proposed state.
import { isCurrentUserAdmin } from "../../../../lib/admin";
import { getGraph } from "../../../rk/store";
import { NODE_TYPES } from "../../../rk/registry";
import type { GraphMode, NodeType } from "../../../rk/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const modeParam = url.searchParams.get("mode") ?? "live";
  const mode: GraphMode = modeParam === "draft" || modeParam === "proposed" ? modeParam : "live";
  const typesParam = url.searchParams.get("types");
  const types = typesParam
    ? (typesParam.split(",").filter((t) => (NODE_TYPES as string[]).includes(t)) as NodeType[])
    : undefined;
  const q = url.searchParams.get("q") ?? undefined;

  try {
    const graph = await getGraph(mode, { types, q });
    return Response.json(graph);
  } catch (err) {
    console.error("[rk/graph]", err);
    return Response.json({ error: "graph_failed", message: (err as Error).message }, { status: 500 });
  }
}
