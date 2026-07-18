// Audit trail (append-only).
// GET ?entity=&batch=&limit= -> { events }
import { isCurrentUserAdmin } from "../../../../lib/admin";
import { isEnabled } from "../../../graph/db";
import { listAudit } from "../../../rk/audit";
import { ensureRkReady } from "../../../rk/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ events: [], reason: "no_database" });
  await ensureRkReady();
  const url = new URL(request.url);
  const events = await listAudit({
    entityId: url.searchParams.get("entity") ?? undefined,
    batchId: url.searchParams.get("batch") ?? undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  });
  return Response.json({ events });
}
