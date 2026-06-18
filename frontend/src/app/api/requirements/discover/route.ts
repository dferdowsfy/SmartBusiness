// PR 8: run discovery manually. POST { stateOrTerritory, municipality?, county?, businessType, activityType? }
import { getCurrentUser } from "../../../../lib/supabase/server";
import { discoverRequirementRules } from "../../../requirements/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { stateOrTerritory?: string; municipality?: string; county?: string; businessType?: string; activityType?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.stateOrTerritory || !body.businessType) {
    return Response.json({ error: "stateOrTerritory and businessType are required" }, { status: 400 });
  }
  const result = discoverRequirementRules({
    stateOrTerritory: body.stateOrTerritory,
    municipality: body.municipality,
    county: body.county,
    businessType: body.businessType,
    activityType: body.activityType,
  });
  return Response.json(result);
}
