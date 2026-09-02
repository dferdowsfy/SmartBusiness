import { evaluateIncentives } from "../../../incentives/engine";
import { compileIncentiveCatalog } from "../../../incentives/catalog";
import type { NormalizedProjectProfile } from "../../../incentives/types";
import { isEnabled } from "../../../graph/db";
import { activeCompileNodes, ensureRkReady } from "../../../rk/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { profile?: NormalizedProjectProfile; verifiedEvidenceTypeIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.profile || typeof body.profile !== "object" || Array.isArray(body.profile)) {
    return Response.json({ error: "profile is required" }, { status: 400 });
  }

  if (!isEnabled()) {
    return Response.json(evaluateIncentives(body.profile, [], {
      catalogVersion: "no-database",
      verifiedEvidenceTypeIds: body.verifiedEvidenceTypeIds,
    }));
  }

  await ensureRkReady();
  const catalog = compileIncentiveCatalog(await activeCompileNodes());
  const assessment = evaluateIncentives(body.profile, catalog.programs, {
    catalogVersion: catalog.catalogVersion,
    verifiedEvidenceTypeIds: body.verifiedEvidenceTypeIds,
  });
  return Response.json({
    ...assessment,
    catalogWarnings: catalog.rejected.length,
  });
}
