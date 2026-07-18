// Impact preview + test mode.
// POST { proposalIds? | batchId?, scenario?: { municipality, businessType, answers } }
//   -> { diff, affectedBusinessTypes, affectedMunicipalities, readinessChanges,
//        conflicts, invalidRefs, scenario: { before, after } }
import { isCurrentUserAdmin } from "../../../../lib/admin";
import { isEnabled } from "../../../graph/db";
import { runImpact } from "../../../rk/impact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });

  let body: Parameters<typeof runImpact>[0] = {};
  try {
    body = await request.json();
  } catch {
    /* empty body = preview all accepted proposals with the default scenario */
  }
  try {
    const result = await runImpact(body ?? {});
    if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
    return Response.json(result);
  } catch (err) {
    console.error("[rk/impact]", err);
    return Response.json({ error: "impact_failed", message: (err as Error).message }, { status: 500 });
  }
}
