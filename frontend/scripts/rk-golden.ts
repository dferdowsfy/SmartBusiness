// ============================================================================
// Golden parity check (standalone): seed builder -> compiler must round-trip
// the bundled KB JSON exactly on every engine-relevant key.
//
//   npm run rk:golden          # pure check (no database)
//   DATABASE_URL=... npm run rk:golden   # also checks the DB round-trip
//
// The same check is exposed at GET /api/rk/golden (admin-gated) for verifying
// a deployed environment.
// ============================================================================

import { ACTIVE_JURISDICTION } from "../src/app/jurisdictions";
import { buildSeedNodes } from "../src/app/rk/seed-data";
import { compileKb, goldenCompare, type CompileNode } from "../src/app/rk/compile";
import businessTypeQuestionsJson from "../src/kb/business_type_questions.json";

async function main() {
  const checks: { name: string; nodes: CompileNode[] }[] = [];

  const pure = buildSeedNodes().map((n) => ({
    entityId: n.entityId,
    nodeType: n.nodeType,
    data: n.data,
  }));
  checks.push({ name: "pure (seed builder -> compile)", nodes: pure });

  if (process.env.DATABASE_URL || process.env.DIRECT_URL) {
    const { ensureRkReady, activeCompileNodes } = await import("../src/app/rk/store");
    await ensureRkReady();
    checks.push({ name: "database (seed -> jsonb -> compile)", nodes: await activeCompileNodes() });
  }

  const kb = ACTIVE_JURISDICTION.kb;
  let failed = false;
  for (const check of checks) {
    const compiled = compileKb(check.nodes, { version: 0, batchId: null });
    const problems = goldenCompare(compiled, {
      municipalities: kb.municipalities as unknown as Record<string, unknown>[],
      businessTypes: kb.businessTypes as unknown as Record<string, unknown>[],
      questions: kb.questions as unknown as Record<string, unknown>[],
      documents: kb.documents as unknown as Record<string, unknown>[],
      rules: kb.rules as unknown as Record<string, unknown>[],
      businessTypeQuestions: businessTypeQuestionsJson as {
        business_type_id: string;
        question_id: string;
      }[],
    });
    if (problems.length === 0) {
      console.log(`✅ ${check.name}: parity OK (${check.nodes.length} nodes)`);
    } else {
      failed = true;
      console.error(`❌ ${check.name}: ${problems.length} problem(s)`);
      for (const p of problems.slice(0, 25)) console.error("   -", p);
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
