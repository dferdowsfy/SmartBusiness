// PR 9: run the monitoring agent. Doubles as a cron-compatible endpoint.
//
// Auth: either a signed-in user, OR a cron call carrying the shared secret
//   header `x-cron-secret: $REQUIREMENT_MONITOR_CRON_SECRET` (so a simple
//   cron/GitHub Action can hit it without a paid scheduler).
//
// POST { ruleId?, municipality?, stateOrTerritory?, businessType?, activityType?, forceRefresh? }
import { isEnabled } from "../../../graph/db";
import { isCurrentUserAdmin } from "../../../../lib/admin";
import { runRequirementMonitoringAgent } from "../../../requirements/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cronAuthorized(req: Request): boolean {
  const secret = process.env.REQUIREMENT_MONITOR_CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-cron-secret") === secret;
}

async function handle(req: Request, body: Record<string, unknown>) {
  if (!isEnabled()) return Response.json({ results: [], reason: "no_database" });
  const results = await runRequirementMonitoringAgent({
    ruleId: (body.ruleId as string) ?? undefined,
    municipality: (body.municipality as string) ?? undefined,
    stateOrTerritory: (body.stateOrTerritory as string) ?? undefined,
    businessType: (body.businessType as string) ?? undefined,
    activityType: (body.activityType as string) ?? undefined,
    forceRefresh: !!body.forceRefresh,
  });
  return Response.json({ results });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine for a sweep */
  }
  if (!cronAuthorized(req)) {
    if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return handle(req, body);
}

// Allow GET for the simplest cron setups (secret header still required).
export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return handle(req, {});
}
