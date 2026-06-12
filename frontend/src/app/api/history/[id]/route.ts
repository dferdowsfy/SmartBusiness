// Submission detail: summary, questions answered, requirements generated,
// document intelligence (extracted fields), readiness timeline + progression,
// and an intelligence-insights panel for similar businesses.
// Read-only; returns enabled:false when no DATABASE_URL is configured.

import { query, isEnabled } from "../../../graph/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isEnabled()) return Response.json({ enabled: false });
  if (!id) return Response.json({ enabled: true, error: "missing_id" }, { status: 400 });

  try {
    const [summaryRows, questions, requirements, documents, timeline, progression] = await Promise.all([
      query(`SELECT id, created_at, municipality, industry, business_type, business_structure,
                     location_type, readiness_score, readiness_status, document_count
              FROM v_submission_history WHERE id = $1`, [id]),
      query(`SELECT question_id, question_text, answer FROM question_responses WHERE submission_id = $1 ORDER BY id`, [id]),
      query(`SELECT document_id, document_name, agency, reason, source_rule, mandatory
              FROM requirements_generated WHERE submission_id = $1 ORDER BY mandatory DESC, document_name`, [id]),
      query(`SELECT document_type, validation_result, pass_fail, confidence, expiration_status,
                     extracted_fields, fields_found, fields_missing, created_at
              FROM document_validations WHERE submission_id = $1 ORDER BY created_at`, [id]),
      query(`SELECT event, kind, created_at FROM v_submission_timeline WHERE submission_id = $1 ORDER BY created_at`, [id]),
      query(`SELECT score, status, created_at, seq FROM v_readiness_progression WHERE submission_id = $1 ORDER BY seq`, [id]),
    ]);

    const summary = (summaryRows as Record<string, unknown>[])[0];
    if (!summary) return Response.json({ enabled: true, error: "not_found" }, { status: 404 });

    const businessType = summary.business_type as string | null;
    let insights: Record<string, unknown> = { similarCount: 0 };
    if (businessType) {
      const [countRows, commonDocs, missingRows, avgRows] = await Promise.all([
        query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM submissions WHERE business_type = $1`, [businessType]),
        query(`WITH sims AS (SELECT id FROM submissions WHERE business_type = $1)
               SELECT rg.document_name AS document, COUNT(DISTINCT rg.submission_id)::int AS cnt
               FROM requirements_generated rg JOIN sims ON sims.id = rg.submission_id
               GROUP BY rg.document_name ORDER BY cnt DESC LIMIT 6`, [businessType]),
        query(`SELECT mf AS field, COUNT(*)::int AS cnt
               FROM document_validations dv
               JOIN submissions s ON s.id = dv.submission_id AND s.business_type = $1,
               LATERAL jsonb_array_elements_text(COALESCE(dv.fields_missing,'[]'::jsonb)) AS mf
               GROUP BY mf ORDER BY cnt DESC LIMIT 3`, [businessType]),
        query<{ avg: number }>(`SELECT ROUND(AVG(latest.score))::int AS avg FROM (
                 SELECT DISTINCT ON (s.id) r.score
                 FROM submissions s JOIN readiness_scores r ON r.submission_id = s.id
                 WHERE s.business_type = $1 ORDER BY s.id, r.created_at DESC
               ) latest`, [businessType]),
      ]);
      insights = {
        similarCount: countRows[0]?.n || 0,
        commonDocuments: commonDocs,
        commonMissing: missingRows,
        avgReadiness: avgRows[0]?.avg ?? null,
      };
    }

    return Response.json({ enabled: true, summary, questions, requirements, documents, timeline, progression, insights });
  } catch (err) {
    console.error("[history] detail failed:", (err as Error).message);
    return Response.json({ enabled: true, error: "query_failed" }, { status: 500 });
  }
}
