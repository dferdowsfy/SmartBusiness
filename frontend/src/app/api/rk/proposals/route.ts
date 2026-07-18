// Proposed-change review.
// GET  ?status=&source=&type=&entity=      -> { proposals }
// POST { id, action: accept|edit_accept|reject|defer|legal_review|merge|reopen,
//        reviewedJson?, mergeIntoId?, note? } -> { proposal }
import { isCurrentUserAdmin } from "../../../../lib/admin";
import { getCurrentUser } from "../../../../lib/supabase/server";
import { isEnabled } from "../../../graph/db";
import { listProposals, reviewProposal, type ReviewAction } from "../../../rk/proposals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ proposals: [], reason: "no_database" });
  const url = new URL(request.url);
  const proposals = await listProposals({
    status: url.searchParams.get("status") ?? undefined,
    sourceId: url.searchParams.get("source") ?? undefined,
    nodeType: url.searchParams.get("type") ?? undefined,
    entityId: url.searchParams.get("entity") ?? undefined,
  });
  return Response.json({ proposals });
}

export async function POST(request: Request) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });

  let body: {
    id?: string;
    action?: ReviewAction;
    reviewedJson?: Record<string, unknown>;
    mergeIntoId?: string;
    note?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.id || !body.action) return Response.json({ error: "id and action are required" }, { status: 400 });

  const user = await getCurrentUser();
  const result = await reviewProposal({
    id: body.id,
    action: body.action,
    reviewedJson: body.reviewedJson ?? null,
    mergeIntoId: body.mergeIntoId ?? null,
    note: body.note ?? null,
    actor: user?.email ?? null,
  });
  if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
  return Response.json({ proposal: result.proposal });
}
