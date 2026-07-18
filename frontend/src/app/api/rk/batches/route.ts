// Publication batches: the human-approved path to live regulatory state.
// GET  -> { batches, snapshots, eligible }   (also runs the scheduled sweep)
// POST { action: create|approve|schedule|publish|rollback, batchId?, name?,
//        notes?, proposalIds?, effectiveAt? } -> { batch }
import { isCurrentUserAdmin } from "../../../../lib/admin";
import { getCurrentUser } from "../../../../lib/supabase/server";
import { isEnabled } from "../../../graph/db";
import {
  approveBatch,
  createBatch,
  eligibleProposals,
  listBatches,
  publishBatch,
  publishDueBatches,
  rollbackBatch,
  scheduleBatch,
} from "../../../rk/batches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ batches: [], snapshots: [], eligible: [], reason: "no_database" });
  await publishDueBatches(); // lazy scheduler sweep
  const { batches, snapshots } = await listBatches();
  const eligible = await eligibleProposals();
  return Response.json({ batches, snapshots, eligible });
}

export async function POST(request: Request) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });

  let body: {
    action?: "create" | "approve" | "schedule" | "publish" | "rollback";
    batchId?: string;
    name?: string;
    notes?: string;
    proposalIds?: string[];
    effectiveAt?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const user = await getCurrentUser();
  const actor = user?.email ?? null;

  let result;
  switch (body.action) {
    case "create":
      result = await createBatch({ name: body.name ?? "", notes: body.notes ?? null, proposalIds: body.proposalIds ?? [], actor });
      break;
    case "approve":
      result = body.batchId ? await approveBatch(body.batchId, actor) : { ok: false, message: "batchId required" };
      break;
    case "schedule":
      result = body.batchId && body.effectiveAt
        ? await scheduleBatch(body.batchId, body.effectiveAt, actor)
        : { ok: false, message: "batchId and effectiveAt required" };
      break;
    case "publish":
      result = body.batchId ? await publishBatch(body.batchId, actor) : { ok: false, message: "batchId required" };
      break;
    case "rollback":
      result = body.batchId ? await rollbackBatch(body.batchId, actor) : { ok: false, message: "batchId required" };
      break;
    default:
      return Response.json({ error: "unknown action" }, { status: 400 });
  }
  if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
  return Response.json({ batch: result.batch });
}
