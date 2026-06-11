// Knowledge-graph read endpoint: powers the admin "Patterns & Intelligence"
// view. Returns aggregate frequency data derived from captured submissions.
//
// Read-only and observational. Returns empty arrays (enabled:false) when no
// DATABASE_URL is configured.

import { query, isEnabled } from "../../../graph/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isEnabled()) {
    return Response.json({ enabled: false, totals: {}, commonBusinessTypes: [], commonDocuments: [], validationFailures: [], byMunicipality: [], topScenarios: [], rejections: [] });
  }

  try {
    const [
      totalsRow,
      commonBusinessTypes,
      commonDocuments,
      validationFailures,
      byMunicipality,
      topScenarios,
      rejections,
    ] = await Promise.all([
      query<{ submissions: string; documents: string; validations: string; nodes: string }>(
        `SELECT
           (SELECT COUNT(*) FROM submissions)            AS submissions,
           (SELECT COUNT(*) FROM document_validations)   AS validations,
           (SELECT COUNT(*) FROM graph_nodes)            AS nodes,
           (SELECT COALESCE(SUM(occurrence_count),0) FROM graph_edges) AS documents`
      ).catch(() => []),
      query(`SELECT business_type, COUNT(*)::int AS submissions
             FROM submissions WHERE business_type IS NOT NULL AND business_type <> ''
             GROUP BY business_type ORDER BY submissions DESC LIMIT 20`),
      query(`SELECT (d.value->>'document') AS document, (d.value->>'agency') AS agency, COUNT(*)::int AS times_required
             FROM submissions s, jsonb_array_elements(s.requirements) AS d(value)
             GROUP BY 1,2 ORDER BY times_required DESC LIMIT 20`),
      query(`SELECT document_type, COUNT(*)::int AS failures
             FROM document_validations WHERE pass_fail = false
             GROUP BY document_type ORDER BY failures DESC LIMIT 20`),
      query(`SELECT municipality, COUNT(*)::int AS submissions,
                    ROUND(AVG(jsonb_array_length(requirements)),1) AS avg_documents
             FROM submissions WHERE municipality IS NOT NULL AND municipality <> ''
             GROUP BY municipality ORDER BY avg_documents DESC LIMIT 20`),
      query(`SELECT municipality, business_type, occurrence_count::int AS occurrence_count,
                    sample_answers, sample_documents, last_seen
             FROM scenario_patterns ORDER BY occurrence_count DESC LIMIT 25`),
      query(`SELECT business_type, issue_type, detail, occurrence_count::int AS occurrence_count, last_seen
             FROM rejection_intelligence ORDER BY occurrence_count DESC LIMIT 25`),
    ]);

    const t = (totalsRow as { submissions: string; documents: string; validations: string; nodes: string }[])[0] || {};
    return Response.json({
      enabled: true,
      totals: {
        submissions: Number(t.submissions || 0),
        validations: Number(t.validations || 0),
        nodes: Number(t.nodes || 0),
        relationships: Number(t.documents || 0),
      },
      commonBusinessTypes,
      commonDocuments,
      validationFailures,
      byMunicipality,
      topScenarios,
      rejections,
    });
  } catch (err) {
    console.error("[graph] patterns query failed:", (err as Error).message);
    return Response.json({ enabled: true, error: "query_failed", totals: {}, commonBusinessTypes: [], commonDocuments: [], validationFailures: [], byMunicipality: [], topScenarios: [], rejections: [] });
  }
}
