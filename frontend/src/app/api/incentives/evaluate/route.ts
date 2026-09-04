import { evaluateIncentives } from "../../../incentives/engine";
import { compileIncentiveCatalog } from "../../../incentives/catalog";
import { PR_ACT60_CATALOG } from "../../../incentives/prCatalog";
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

  // The graph/DB store is optional and, even when configured, nothing has
  // ever seeded incentive-program nodes into it. The statically authored
  // Act 60 catalog (incentives/prCatalog.ts) always renders regardless, the
  // same way requirement guidance (guidance/pr.ts) doesn't depend on a live
  // graph. A configured store can still contribute additional programs.
  let programs = PR_ACT60_CATALOG;
  let catalogVersion = "pr-act60-static-2026-09-04.1";
  let catalogWarnings = 0;

  if (isEnabled()) {
    await ensureRkReady();
    const catalog = compileIncentiveCatalog(await activeCompileNodes());
    programs = [...PR_ACT60_CATALOG, ...catalog.programs.filter((p) => !PR_ACT60_CATALOG.some((s) => s.id === p.id))];
    catalogVersion = `${catalogVersion}|${catalog.catalogVersion}`;
    catalogWarnings = catalog.rejected.length;
  }

  const assessment = evaluateIncentives(body.profile, programs, {
    catalogVersion,
    verifiedEvidenceTypeIds: body.verifiedEvidenceTypeIds,
  });
  return Response.json({ ...assessment, catalogWarnings });
}
