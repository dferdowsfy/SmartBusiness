// Compare two submissions. Reads v_submission_comparison for each and computes
// the document differences (which documents are unique to each scenario).
// Read-only; returns enabled:false when no DATABASE_URL is configured.

import { query, isEnabled } from "../../../graph/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CompRow {
  id: string;
  municipality: string | null;
  industry: string | null;
  business_type: string | null;
  business_structure: string | null;
  location_type: string | null;
  readiness_score: number | null;
  document_count: number;
  documents: string[] | null;
}

export async function GET(req: Request) {
  if (!isEnabled()) return Response.json({ enabled: false });
  const url = new URL(req.url);
  const a = url.searchParams.get("a");
  const b = url.searchParams.get("b");
  if (!a || !b) return Response.json({ enabled: true, error: "need_a_and_b" }, { status: 400 });

  try {
    const rows = await query<CompRow>(
      `SELECT id, municipality, industry, business_type, business_structure, location_type,
              readiness_score, document_count, documents
       FROM v_submission_comparison WHERE id = $1 OR id = $2`,
      [a, b]
    );
    const A = rows.find((r) => r.id === a);
    const B = rows.find((r) => r.id === b);
    if (!A || !B) return Response.json({ enabled: true, error: "not_found" }, { status: 404 });

    const setA = new Set((A.documents || []).map((d) => d.toLowerCase()));
    const setB = new Set((B.documents || []).map((d) => d.toLowerCase()));
    const onlyInA = (A.documents || []).filter((d) => !setB.has(d.toLowerCase()));
    const onlyInB = (B.documents || []).filter((d) => !setA.has(d.toLowerCase()));
    const shared = (A.documents || []).filter((d) => setB.has(d.toLowerCase()));

    return Response.json({ enabled: true, a: A, b: B, onlyInA, onlyInB, shared });
  } catch (err) {
    console.error("[history] compare failed:", (err as Error).message);
    return Response.json({ enabled: true, error: "query_failed" }, { status: 500 });
  }
}
