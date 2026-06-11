// Historical pattern matching (ADVISORY ONLY).
//
// Given a business profile, finds similar past submissions and surfaces
// advisory insights: documents commonly required by similar businesses,
// which of those the current scenario may be overlooking, and the most common
// validation failures for this business type.
//
// These NEVER become mandatory requirements — rules remain authoritative.

import { query, isEnabled } from "../../../graph/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  municipality?: string | null;
  industry?: string | null;
  business_type?: string | null;
  location_type?: string | null;
  currentDocuments?: string[]; // document names already required for this scenario
}

const EMPTY = {
  enabled: false,
  similarCount: 0,
  commonlyRequired: [] as unknown[],
  potentiallyOverlooked: [] as unknown[],
  commonValidationFailures: [] as unknown[],
};

export async function POST(request: Request) {
  if (!isEnabled()) return Response.json(EMPTY);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ...EMPTY, enabled: true, error: "bad_json" }, { status: 400 });
  }

  const bt = body.business_type || "";
  if (!bt) return Response.json({ ...EMPTY, enabled: true });

  try {
    const [countRows, commonRows, failureRows] = await Promise.all([
      query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM submissions WHERE business_type = $1`, [bt]),
      query<{ document: string; agency: string; cnt: number }>(
        `WITH sims AS (SELECT id FROM submissions WHERE business_type = $1)
         SELECT rg.document_name AS document, MAX(rg.agency) AS agency,
                COUNT(DISTINCT rg.submission_id)::int AS cnt
         FROM requirements_generated rg JOIN sims ON sims.id = rg.submission_id
         GROUP BY rg.document_name ORDER BY cnt DESC LIMIT 30`,
        [bt]
      ),
      query<{ document_type: string; failures: number }>(
        `SELECT document_type, COUNT(*)::int AS failures
         FROM document_validations WHERE business_type = $1 AND pass_fail = false
         GROUP BY document_type ORDER BY failures DESC LIMIT 10`,
        [bt]
      ),
    ]);

    const total = countRows[0]?.n || 0;
    const current = new Set((body.currentDocuments || []).map((d) => d.toLowerCase()));

    const commonlyRequired = commonRows.map((r) => ({
      document: r.document,
      agency: r.agency,
      count: r.cnt,
      pct: total > 0 ? Math.round((r.cnt / total) * 100) : 0,
    }));

    // Advisory: docs that similar businesses commonly needed but this scenario
    // hasn't surfaced. Only show meaningfully frequent ones (>= 40%).
    const potentiallyOverlooked = commonlyRequired.filter(
      (r) => r.pct >= 40 && !current.has(r.document.toLowerCase())
    );

    return Response.json({
      enabled: true,
      similarCount: total,
      commonlyRequired,
      potentiallyOverlooked,
      commonValidationFailures: failureRows,
    });
  } catch (err) {
    console.error("[graph] similar query failed:", (err as Error).message);
    return Response.json({ ...EMPTY, enabled: true, error: "query_failed" });
  }
}
