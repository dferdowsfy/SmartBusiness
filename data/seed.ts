/**
 * SmartPR Licensing Knowledge Base — PostgreSQL seed script.
 *
 * Usage:
 *   DATABASE_URL=postgres://user:pass@host:5432/smartpr \
 *     npx ts-node data/seed.ts
 *
 * Applies data/schema.sql first, then imports every JSON file in data/.
 * Idempotent: re-running re-creates the schema (schema.sql drops tables) and
 * re-inserts all rows inside a single transaction.
 *
 * Requires: pg  (npm i pg)  and ts-node/typescript to run directly.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";

const DATA_DIR = __dirname;
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(join(DATA_DIR, name), "utf8")) as T;

type Municipality = { id: string; name: string; flags: string[] };
type Industry = { id: string; name: string; description: string };
type BusinessType = { id: string; industry_id: string; name: string; description: string };
type Question = { id: string; question: string; type: string; options?: string[] };
type Document = { id: string; name: string; agency: string; category: string };
type BTQ = { business_type_id: string; question_id: string };
type Rule = {
  id: string;
  rule_type: string;
  business_type_id: string | null;
  question_id: string | null;
  expected_answer: string | null;
  municipality_flag: string | null;
  requires_document_id: string;
};
type ValidationRule = { document_id: string; required_fields: string[] };

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1. Apply schema.
    const schema = readFileSync(join(DATA_DIR, "schema.sql"), "utf8");
    await client.query(schema);

    // 2. Load data.
    const municipalities = read<Municipality[]>("municipalities.json");
    const industries = read<Industry[]>("industries.json");
    const businessTypes = read<BusinessType[]>("business_types.json");
    const questions = read<Question[]>("questions.json");
    const documents = read<Document[]>("documents.json");
    const btq = read<BTQ[]>("business_type_questions.json");
    const rules = read<Rule[]>("rules.json");
    const validationRules = read<ValidationRule[]>("validation_rules.json");

    await client.query("BEGIN");

    // Helper: batch insert. cols define column order; rows are value arrays.
    const insert = async (table: string, cols: string[], rows: any[][]) => {
      if (rows.length === 0) return;
      const BATCH = 500;
      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const params: any[] = [];
        const tuples = slice.map((r) => {
          const ph = r.map((_, j) => `$${params.length + j + 1}`);
          params.push(...r);
          return `(${ph.join(",")})`;
        });
        await client.query(
          `INSERT INTO ${table} (${cols.join(",")}) VALUES ${tuples.join(",")} ON CONFLICT DO NOTHING`,
          params
        );
      }
    };

    // 3. Insert in FK-safe order.
    await insert("industries", ["id", "name", "description"],
      industries.map((x) => [x.id, x.name, x.description]));

    await insert("municipalities", ["id", "name"],
      municipalities.map((x) => [x.id, x.name]));

    await insert("municipality_flags", ["municipality_id", "flag"],
      municipalities.flatMap((m) => m.flags.map((f) => [m.id, f])));

    await insert("business_types", ["id", "industry_id", "name", "description"],
      businessTypes.map((x) => [x.id, x.industry_id, x.name, x.description]));

    await insert("questions", ["id", "question", "type"],
      questions.map((x) => [x.id, x.question, x.type]));

    await insert("question_options", ["question_id", "position", "option"],
      questions.flatMap((q) => (q.options ?? []).map((opt, i) => [q.id, i, opt])));

    await insert("documents", ["id", "name", "agency", "category"],
      documents.map((x) => [x.id, x.name, x.agency, x.category]));

    await insert("business_type_questions", ["business_type_id", "question_id"],
      btq.map((x) => [x.business_type_id, x.question_id]));

    await insert(
      "rules",
      ["id", "rule_type", "business_type_id", "question_id", "expected_answer", "municipality_flag", "requires_document_id"],
      rules.map((x) => [
        x.id, x.rule_type, x.business_type_id, x.question_id,
        x.expected_answer, x.municipality_flag, x.requires_document_id,
      ])
    );

    await insert("document_validation_fields", ["document_id", "position", "field_name"],
      validationRules.flatMap((v) => v.required_fields.map((f, i) => [v.document_id, i, f])));

    await client.query("COMMIT");

    // 4. Report.
    const counts = await client.query(`
      SELECT 'municipalities' t, COUNT(*) c FROM municipalities
      UNION ALL SELECT 'municipality_flags', COUNT(*) FROM municipality_flags
      UNION ALL SELECT 'industries', COUNT(*) FROM industries
      UNION ALL SELECT 'business_types', COUNT(*) FROM business_types
      UNION ALL SELECT 'questions', COUNT(*) FROM questions
      UNION ALL SELECT 'question_options', COUNT(*) FROM question_options
      UNION ALL SELECT 'documents', COUNT(*) FROM documents
      UNION ALL SELECT 'business_type_questions', COUNT(*) FROM business_type_questions
      UNION ALL SELECT 'rules', COUNT(*) FROM rules
      UNION ALL SELECT 'document_validation_fields', COUNT(*) FROM document_validation_fields
      ORDER BY t;
    `);
    console.table(counts.rows);
    console.log("SmartPR knowledge base seeded successfully.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Seed failed:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
