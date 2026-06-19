// ============================================================================
// PR 8 + PR 9: Discovery and Monitoring agents.
//
//   discoverRequirementRules()      — propose candidate requirements from
//                                     OFFICIAL government sources only.
//   runRequirementMonitoringAgent() — fetch a rule's source, checksum it,
//                                     detect change vs. the last run, and file
//                                     a requirement_change_event for admins.
//
// GUARDRAILS (enforced here):
//   * Official government sources only (.gov / .pr.gov / known agency domains).
//   * No CAPTCHA bypass, no portal login, no automatic form submission.
//   * Never overwrite active rules/templates — changes are flagged
//     needs_review and a change event is opened for admin approval.
//   * Preserve source URL + timestamp + checksum as evidence.
//   * Static fetch first (no Playwright, no paid scraping APIs).
//   * Bounded: single page fetch per source, short timeout.
// ============================================================================

import { createHash } from "crypto";
import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getPool } from "../graph/db";
import { ensureRequirementsSchema } from "./schema";
import { crawlSource } from "./crawler";
import { OFFICIAL_SOURCES, sourcesFor, type OfficialSource } from "./sources";
import type { DocumentType, FormSchema, RequirementRule } from "./types";

const FETCH_TIMEOUT_MS = 12_000;

// Domains we treat as authoritative. Consultant/blog/law-firm/mirror domains
// are rejected by omission.
const OFFICIAL_SUFFIXES = [".gov", ".pr.gov", ".gov.pr"];

interface MonitoringSourceFile {
  sources: {
    name: string;
    agency: string;
    url: string;
    official_hosts?: string[];
    applies_to?: string[];
  }[];
}

let monitoringSourcesCache: OfficialSource[] | null = null;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function monitoringSourcesFromData(): OfficialSource[] {
  if (monitoringSourcesCache) return monitoringSourcesCache;
  const candidates = [
    join(process.cwd(), "..", "data", "monitoring_sources.json"),
    join(process.cwd(), "data", "monitoring_sources.json"),
  ];
  const filePath = candidates.find((candidate) => existsSync(candidate));
  if (!filePath) {
    monitoringSourcesCache = [];
    return monitoringSourcesCache;
  }
  const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as MonitoringSourceFile;
  monitoringSourcesCache = parsed.sources.flatMap((source) => {
    const host = hostOf(source.url);
    if (!host) return [];
    return [
      {
        seedUrl: source.url,
        agencyName: source.name || source.agency,
        stateOrTerritory: "PR",
        officialHosts: source.official_hosts?.length ? source.official_hosts : [host],
      },
    ];
  });
  return monitoringSourcesCache;
}

function officialHostsFromRegistry(): string[] {
  return [...OFFICIAL_SOURCES, ...monitoringSourcesFromData()].flatMap((source) => source.officialHosts);
}

export function isOfficialSource(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      OFFICIAL_SUFFIXES.some((s) => host.endsWith(s) || host.includes(s)) ||
      officialHostsFromRegistry().some((officialHost) => host === officialHost || host.endsWith("." + officialHost))
    );
  } catch {
    return false;
  }
}

function checksum(text: string): string {
  // Normalize whitespace so trivial reflow doesn't register as a change.
  const normalized = text.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}


function buildScaffoldSchema(doc: { documentType: DocumentType; title: string; url: string; fileType: string | null; language: string | null }): FormSchema {
  const isApplication = doc.documentType === "application_form";
  const sourceLabel = doc.title.slice(0, 180);
  return {
    sections: [
      {
        title: isApplication ? "Applicant Information" : "Required Document" ,
        description: isApplication
          ? "Auto-scaffolded from the official source document. Admins should align fields to the exact official form before publishing."
          : "Official source document surfaced in the UI so the applicant can prepare, attach, and resubmit it without relying on unstructured agent output.",
        fields: [
          { key: "legal_business_name", label: "Legal Business Name", type: "text", required: true, source: "intake.business.legal_name" },
          { key: "owner_name", label: "Owner Name", type: "text", required: true, source: "intake.owner.full_name" },
          { key: "business_address", label: "Business Address", type: "address", required: true, source: "intake.location.address" },
          { key: "municipality", label: "Municipality", type: "text", required: true, source: "intake.location.municipality" },
          ...(!isApplication
            ? [
                {
                  key: "prepared_document",
                  label: `Upload completed ${sourceLabel}`,
                  type: "file_upload" as const,
                  required: true,
                  help: "Attach the completed official document or supporting evidence requested by the municipality.",
                },
                {
                  key: "source_reviewed",
                  label: "I reviewed the official source document and confirm this upload matches the requirement.",
                  type: "declaration" as const,
                  required: true,
                },
              ]
            : []),
        ],
      },
      {
        title: "Official Source",
        description: "Reference-only metadata kept with the fillable UI document.",
        fields: [
          { key: "official_source_url", label: "Official Source URL", type: "hidden", required: false },
          { key: "source_document_type", label: "Document Type", type: "hidden", required: false },
        ],
      },
    ],
  };
}

function scaffoldValidationRules(documentType: DocumentType): Record<string, unknown> {
  if (documentType === "application_form") return { requiredFields: ["legal_business_name", "owner_name", "business_address", "municipality"] };
  return {
    requiredFields: ["legal_business_name", "owner_name", "business_address", "municipality"],
    requiredAttachments: ["prepared_document"],
    requiredDeclarations: ["source_reviewed"],
  };
}

async function fetchText(url: string): Promise<{ ok: boolean; text: string; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "SmartPR-RequirementMonitor/1.0 (readiness; non-commercial)" },
    });
    const text = res.ok ? await res.text() : "";
    return { ok: res.ok, text, status: res.status };
  } catch {
    return { ok: false, text: "", status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Discovery (PR 8) ------------------------------------------------------

export interface DiscoverInput {
  stateOrTerritory: string;
  municipality?: string;
  county?: string;
  businessType: string;
  activityType?: string;
  /** Optional explicit official seed URL (admin-supplied) to crawl. */
  seedUrl?: string;
  /** Use the Playwright fallback for JS-rendered pages (default false). */
  usePlaywright?: boolean;
  maxPages?: number;
  maxDepth?: number;
}

export interface DiscoveryResult {
  sourcesCrawled: { seedUrl: string; agency: string; pagesVisited: number; documentsFound: number }[];
  rulesCreated: number;
  documentsCreated: number;
  draftTemplatesCreated: number;
  feeReferences: string[];
  errors: string[];
  note: string;
}

/**
 * The official-source SEARCH STRATEGY (query set) for a jurisdiction + business
 * type. Retained as a helper/reference; the live discovery agent crawls the
 * curated official entry points in sources.ts rather than a paid search API.
 */
export function discoveryQueryStrategy(input: DiscoverInput): string[] {
  const m = input.municipality ?? "";
  const bt = input.businessType;
  const generic = [
    `site:.gov "${m}" "${bt}" permit application`,
    `site:.gov "${m}" "${bt}" license application`,
    `site:.gov "${m}" business license application`,
    `site:.gov "${m}" zoning permit application`,
    `site:.gov "${m}" certificate of use`,
    `site:.gov "${m}" tax registration`,
    `site:.gov "${m}" inspection requirements`,
  ];
  const puertoRico =
    input.stateOrTerritory.toUpperCase() === "PR"
      ? [
          `"municipio" "${bt}" "permiso"`,
          `"municipio" "${bt}" "licencia"`,
          `"municipio" "patente municipal"`,
          `"certificado de uso"`,
          `"OGPe" "${bt}" "solicitud"`,
          `"permiso único" "${m}"`,
          `"licencia sanitaria" "${m}"`,
          `"bomberos" "${m}"`,
          `"salud ambiental" "${m}"`,
        ]
      : [];
  return [...generic, ...puertoRico];
}

/**
 * LIVE discovery agent: crawls curated official government entry points (and/or
 * an admin-supplied official seed URL), extracts candidate requirement
 * documents, and PERSISTS them as requirement_rules + requirement_documents.
 * Discovered application forms also get a DRAFT form_template so an admin can
 * finish the schema and publish it.
 *
 * GUARDRAILS: official hosts only, bounded crawl, checksum de-dup, everything
 * created as needs_review/draft — never active without admin approval.
 */
export async function discoverRequirementRules(input: DiscoverInput): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    sourcesCrawled: [],
    rulesCreated: 0,
    documentsCreated: 0,
    draftTemplatesCreated: 0,
    feeReferences: [],
    errors: [],
    note:
      "Official government sources only. Discovered items are created as " +
      "needs_review/draft and require admin approval before going live.",
  };

  const pool = getPool();
  if (pool) await ensureRequirementsSchema();
  else result.errors.push("no_database: crawled sources but did not save discovered rules/documents/templates.");

  // Build the set of seeds to crawl: registry matches + any explicit seed.
  const registeredSources = sourcesFor(input.stateOrTerritory, input.municipality);
  const monitoringSources = input.stateOrTerritory.toUpperCase() === "PR" ? monitoringSourcesFromData() : [];
  const adminSeed = input.seedUrl
    ? [{ seedUrl: input.seedUrl, agencyName: "Admin-supplied source", stateOrTerritory: input.stateOrTerritory, municipality: input.municipality, officialHosts: [] as string[] }]
    : [];
  const seedMap = new Map<string, OfficialSource>();
  for (const source of [...adminSeed, ...registeredSources, ...monitoringSources]) {
    seedMap.set(source.seedUrl, source);
  }
  const allSeeds = [...seedMap.values()];
  if (allSeeds.length === 0) {
    result.errors.push(`No official source registered for ${input.stateOrTerritory}${input.municipality ? "/" + input.municipality : ""}. Provide a seedUrl.`);
    return result;
  }

  for (const src of allSeeds) {
    const crawl = await crawlSource(src.seedUrl, {
      officialHosts: src.officialHosts,
      usePlaywright: input.usePlaywright,
      maxPages: input.maxPages,
      maxDepth: input.maxDepth,
    });
    result.errors.push(...crawl.errors);
    for (const f of crawl.feeReferences) if (!result.feeReferences.includes(f)) result.feeReferences.push(f);
    result.sourcesCrawled.push({
      seedUrl: src.seedUrl,
      agency: src.agencyName,
      pagesVisited: crawl.pagesVisited.length,
      documentsFound: crawl.documents.length,
    });

    for (const docItem of crawl.documents) {
      if (!pool) continue;

      // De-dup: skip if a document with this checksum already exists.
      const dup = await pool.query(`SELECT 1 FROM requirement_documents WHERE checksum = $1 LIMIT 1`, [docItem.checksum]);
      if (dup.rows.length > 0) continue;

      const sourceDomain = (() => {
        try { return new URL(docItem.url).hostname; } catch { return null; }
      })();

      // One needs_review rule per discovered document (admin can merge/edit).
      const ruleId = randomUUID();
      await pool.query(
        `INSERT INTO requirement_rules
           (id, state_or_territory, municipality, agency_name, business_type, activity_type,
            requirement_category, requirement_name, description, official_source_url,
            source_domain, confidence_score, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'needs_review')`,
        [
          ruleId,
          input.stateOrTerritory,
          src.municipality ?? input.municipality ?? null,
          src.agencyName,
          input.businessType,
          input.activityType ?? null,
          docItem.documentType,
          docItem.title.slice(0, 300),
          `Auto-discovered from ${src.agencyName}. Needs admin review/classification.`,
          docItem.url,
          sourceDomain,
          0.3,
        ]
      );
      result.rulesCreated += 1;

      const docId = randomUUID();
      await pool.query(
        `INSERT INTO requirement_documents
           (id, requirement_rule_id, document_title, document_type, source_url, source_file_url,
            checksum, file_type, language, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'needs_review')`,
        [
          docId,
          ruleId,
          docItem.title.slice(0, 300),
          docItem.documentType,
          docItem.url,
          docItem.fileType && docItem.fileType !== "html" ? docItem.url : null,
          docItem.checksum,
          docItem.fileType,
          docItem.language,
        ]
      );
      result.documentsCreated += 1;

      // Scaffold every discovered required document into a structured DRAFT
      // template. Application forms get a fillable form shell; checklists, fee
      // schedules, zoning/tax/inspection documents become attachment-driven UI
      // tasks so users can complete/resubmit the actual official file instead
      // of receiving unstructured scraped text.
      const renderMode = docItem.documentType === "application_form" && docItem.fileType === "pdf" ? "pdf_overlay" : "native_ui";
      const schema = buildScaffoldSchema(docItem);
      await pool.query(
        `INSERT INTO form_templates
           (requirement_document_id, template_name, template_version, render_mode,
            schema_json, field_mappings_json, validation_rules_json, output_pdf_template_path, status)
         VALUES ($1,$2,1,$3,$4,$5,$6,$7,'draft')`,
        [
          docId,
          docItem.title.slice(0, 300),
          renderMode,
          JSON.stringify(schema),
          JSON.stringify({ official_source_url: docItem.url, source_document_type: docItem.documentType }),
          JSON.stringify(scaffoldValidationRules(docItem.documentType)),
          docItem.fileType === "pdf" ? docItem.url : null,
        ]
      );
      result.draftTemplatesCreated += 1;
    }
  }

  return result;
}

// ---- Monitoring (PR 9) -----------------------------------------------------

export interface MonitoringRunResult {
  runId: string | null;
  ruleId: string;
  status: "completed" | "failed" | "needs_review" | "skipped";
  changeDetected: boolean;
  summary: string;
}

export interface MonitoringInput {
  ruleId?: string;
  municipality?: string;
  stateOrTerritory?: string;
  businessType?: string;
  activityType?: string;
  forceRefresh?: boolean;
}

/**
 * Monitor one or more rules' official sources for change. For each rule:
 * fetch the source, checksum it, compare to the last completed run, and on
 * change open a requirement_change_event + flag the rule needs_review. Active
 * rules/templates are never overwritten automatically.
 */
export async function runRequirementMonitoringAgent(
  input: MonitoringInput
): Promise<MonitoringRunResult[]> {
  const pool = getPool();
  if (!pool) return [];
  await ensureRequirementsSchema();

  const { rows: rules } = await pool.query<RequirementRule>(
    `SELECT * FROM requirement_rules
      WHERE status IN ('active','needs_review')
        AND ($1::uuid IS NULL OR id = $1)
        AND ($2::text IS NULL OR municipality = $2)
        AND ($3::text IS NULL OR state_or_territory = $3)
        AND ($4::text IS NULL OR business_type = $4)
        AND ($5::text IS NULL OR activity_type = $5)
      ORDER BY last_checked_at NULLS FIRST
      LIMIT 50`,
    [
      input.ruleId ?? null,
      input.municipality ?? null,
      input.stateOrTerritory ?? null,
      input.businessType ?? null,
      input.activityType ?? null,
    ]
  );

  const results: MonitoringRunResult[] = [];
  for (const rule of rules) {
    results.push(await monitorOne(rule));
  }
  return results;
}

async function monitorOne(rule: RequirementRule): Promise<MonitoringRunResult> {
  const pool = getPool()!;
  const runId = randomUUID();
  const url = rule.official_source_url;

  // Guardrail: only fetch authoritative sources.
  if (!isOfficialSource(url)) {
    await pool.query(
      `INSERT INTO requirement_monitoring_runs
         (id, rule_id, status, source_url, change_detected, change_summary, started_at, completed_at, error_message)
       VALUES ($1,$2,'failed',$3,false,$4, now(), now(), $5)`,
      [runId, rule.id, url, "Source not an official government domain.", "non_official_source"]
    );
    return { runId, ruleId: rule.id, status: "failed", changeDetected: false, summary: "Non-official source skipped." };
  }

  const previous = await pool.query<{ new_checksum: string | null }>(
    `SELECT new_checksum FROM requirement_monitoring_runs
      WHERE rule_id = $1 AND status = 'completed' AND new_checksum IS NOT NULL
      ORDER BY created_at DESC LIMIT 1`,
    [rule.id]
  );
  const previousChecksum = previous.rows[0]?.new_checksum ?? null;

  await pool.query(
    `INSERT INTO requirement_monitoring_runs (id, rule_id, status, source_url, previous_checksum, started_at)
     VALUES ($1,$2,'running',$3,$4, now())`,
    [runId, rule.id, url, previousChecksum]
  );

  const fetched = await fetchText(url!);
  if (!fetched.ok) {
    await pool.query(
      `UPDATE requirement_monitoring_runs
          SET status='failed', completed_at=now(), error_message=$2 WHERE id=$1`,
      [runId, `Fetch failed (HTTP ${fetched.status})`]
    );
    await openChangeEvent(rule.id, runId, "source_unavailable", "high",
      `Official source unavailable (HTTP ${fetched.status}): ${url}`);
    await pool.query(`UPDATE requirement_rules SET status='needs_review', last_checked_at=now(), updated_at=now() WHERE id=$1`, [rule.id]);
    return { runId, ruleId: rule.id, status: "needs_review", changeDetected: false, summary: "Source unavailable." };
  }

  const newChecksum = checksum(fetched.text);
  const changeDetected = previousChecksum !== null && previousChecksum !== newChecksum;

  await pool.query(
    `UPDATE requirement_monitoring_runs
        SET status='completed', new_checksum=$2, change_detected=$3, completed_at=now(),
            change_summary=$4
      WHERE id=$1`,
    [runId, newChecksum, changeDetected, changeDetected ? "Source content changed since last check." : "No change."]
  );

  if (changeDetected) {
    await openChangeEvent(rule.id, runId, "form_updated", "medium",
      `Official source content changed: ${url}`, { checksum: previousChecksum }, { checksum: newChecksum });
    // Flag for admin review — never overwrite the active rule/template.
    await pool.query(
      `UPDATE requirement_rules SET status='needs_review', last_changed_at=now(), last_checked_at=now(), updated_at=now() WHERE id=$1`,
      [rule.id]
    );
  } else {
    await pool.query(`UPDATE requirement_rules SET last_checked_at=now(), updated_at=now() WHERE id=$1`, [rule.id]);
  }

  return {
    runId,
    ruleId: rule.id,
    status: "completed",
    changeDetected,
    summary: changeDetected ? "Change detected — flagged for admin review." : "No change detected.",
  };
}

async function openChangeEvent(
  ruleId: string,
  runId: string,
  changeType: string,
  severity: string,
  summary: string,
  oldValue?: unknown,
  newValue?: unknown
): Promise<void> {
  const pool = getPool()!;
  await pool.query(
    `INSERT INTO requirement_change_events
       (id, rule_id, monitoring_run_id, change_type, old_value, new_value, summary, severity, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open')`,
    [
      randomUUID(),
      ruleId,
      runId,
      changeType,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      summary,
      severity,
    ]
  );
}
