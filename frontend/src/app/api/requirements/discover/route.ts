// PR 8: run the discovery crawler manually. Crawls official sources and
// persists discovered rules/documents/draft templates (all needs_review).
//
// POST { stateOrTerritory, municipality?, county?, businessType, activityType?,
//        seedUrl?, usePlaywright?, maxPages?, maxDepth? }
import { isEnabled } from "../../../graph/db";
import { isCurrentUserAdmin } from "../../../../lib/admin";
import { discoverRequirementRules } from "../../../requirements/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Crawling can take a while; allow up to 5 minutes.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });

  let body: {
    stateOrTerritory?: string;
    municipality?: string;
    county?: string;
    businessType?: string;
    activityType?: string;
    seedUrl?: string;
    usePlaywright?: boolean;
    maxPages?: number;
    maxDepth?: number;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.stateOrTerritory || !body.businessType) {
    return Response.json({ error: "stateOrTerritory and businessType are required" }, { status: 400 });
  }

  try {
    const result = await discoverRequirementRules({
      stateOrTerritory: body.stateOrTerritory,
      municipality: body.municipality,
      county: body.county,
      businessType: body.businessType,
      activityType: body.activityType,
      seedUrl: body.seedUrl,
      usePlaywright: body.usePlaywright,
      maxPages: body.maxPages,
      maxDepth: body.maxDepth,
    });
    return Response.json(result);
  } catch (err) {
    console.error("[requirements/discover] failed:", (err as Error).message);
    return Response.json({ error: "discover_failed", message: (err as Error).message }, { status: 500 });
  }
}
