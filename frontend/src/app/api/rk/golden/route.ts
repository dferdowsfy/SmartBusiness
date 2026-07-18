// Golden parity check: the graph seed + compiler must round-trip the bundled
// KB JSON exactly on every engine-relevant key. Run this BEFORE trusting
// /api/kb snapshots in production.
//
// GET /api/rk/golden -> { ok, checked, problems }
//  - With a database: seeds if empty, compiles the ACTIVE graph, compares.
//  - Without: compares the pure seed->compile path (no DB round-trip).
import { isCurrentUserAdmin } from "../../../../lib/admin";
import { isEnabled } from "../../../graph/db";
import { ACTIVE_JURISDICTION } from "../../../jurisdictions";
import { compileKb, goldenCompare, type CompileNode } from "../../../rk/compile";
import { buildSeedNodes } from "../../../rk/seed-data";
import { activeCompileNodes, ensureRkReady } from "../../../rk/store";
import businessTypeQuestionsJson from "../../../../kb/business_type_questions.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });

  try {
    let nodes: CompileNode[];
    let checked: string;
    if (isEnabled()) {
      await ensureRkReady();
      nodes = await activeCompileNodes();
      checked = "database (seed -> jsonb -> compile)";
    } else {
      nodes = buildSeedNodes().map((n) => ({ entityId: n.entityId, nodeType: n.nodeType, data: n.data }));
      checked = "pure (seed builder -> compile, no database)";
    }
    const compiled = compileKb(nodes, { version: 0, batchId: null });
    const kb = ACTIVE_JURISDICTION.kb;
    const problems = goldenCompare(compiled, {
      municipalities: kb.municipalities as unknown as Record<string, unknown>[],
      businessTypes: kb.businessTypes as unknown as Record<string, unknown>[],
      questions: kb.questions as unknown as Record<string, unknown>[],
      documents: kb.documents as unknown as Record<string, unknown>[],
      rules: kb.rules as unknown as Record<string, unknown>[],
      businessTypeQuestions: businessTypeQuestionsJson as { business_type_id: string; question_id: string }[],
    });
    return Response.json({ ok: problems.length === 0, checked, problems: problems.slice(0, 50) });
  } catch (err) {
    console.error("[rk/golden]", err);
    return Response.json({ error: "golden_failed", message: (err as Error).message }, { status: 500 });
  }
}
