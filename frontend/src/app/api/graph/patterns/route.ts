// Read endpoint powering the admin "Patterns & Intelligence" view.
// Returns the five aggregate metrics derived from captured execution history.
// Read-only and observational. Returns empty data when no DATABASE_URL is set.

import { query, isEnabled } from "../../../graph/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY = {
  enabled: false,
  totalSubmissions: 0,
  commonBusinessTypes: [],
  commonDocuments: [],
  validationFailures: [],
  topScenarios: [],
};

export async function GET() {
  if (!isEnabled()) return Response.json(EMPTY);

  try {
    const [totalRow, commonBusinessTypes, commonDocuments, validationFailures, topScenarios] = await Promise.all([
      query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM submissions`),
      query(`SELECT business_type, COUNT(*)::int AS submissions
             FROM submissions WHERE business_type IS NOT NULL AND business_type <> ''
             GROUP BY business_type ORDER BY submissions DESC LIMIT 20`),
      query(`SELECT document_name AS document, MAX(agency) AS agency, COUNT(*)::int AS times_required
             FROM requirements_generated
             GROUP BY document_name ORDER BY times_required DESC LIMIT 20`),
      query(`SELECT document_type, COUNT(*)::int AS failures
             FROM document_validations WHERE pass_fail = false
             GROUP BY document_type ORDER BY failures DESC LIMIT 20`),
      query(`SELECT municipality, business_type, occurrence_count::int AS occurrence_count,
                    sample_documents, last_seen
             FROM scenario_patterns ORDER BY occurrence_count DESC LIMIT 25`),
    ]);

    return Response.json({
      enabled: true,
      totalSubmissions: (totalRow[0]?.n as number) || 0,
      commonBusinessTypes,
      commonDocuments,
      validationFailures,
      topScenarios,
    });
  } catch (err) {
    console.error("[graph] patterns query failed:", (err as Error).message);
    return Response.json({ ...EMPTY, enabled: true, error: "query_failed" });
  }
}
