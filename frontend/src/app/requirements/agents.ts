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
import { getPool } from "../graph/db";
import { ensureRequirementsSchema } from "./schema";
import type { RequirementRule } from "./types";

const FETCH_TIMEOUT_MS = 12_000;

// Domains we treat as authoritative. Consultant/blog/law-firm/mirror domains
// are rejected by omission.
const OFFICIAL_SUFFIXES = [".gov", ".pr.gov", ".gov.pr"];

export function isOfficialSource(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return OFFICIAL_SUFFIXES.some((s) => host.endsWith(s) || host.includes(s));
  } catch {
    return false;
  }
}

function checksum(text: string): string {
  // Normalize whitespace so trivial reflow doesn't register as a change.
  const normalized = text.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
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
}

export interface DiscoveredRequirement {
  suggestedQueries: string[];
  note: string;
}

/**
 * Returns the official-source search strategy for a jurisdiction + business
 * type. This phase emits the guardrailed query set (to be run against an
 * official-source-restricted search later); it never scrapes blogs or paid
 * APIs and never auto-creates active rules. Discovered candidates must be
 * admin-reviewed before becoming active.
 */
export function discoverRequirementRules(input: DiscoverInput): DiscoveredRequirement {
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
          `"permiso de uso" "${m}"`,
          `"licencia sanitaria" "${m}"`,
          `"bomberos" "${m}"`,
          `"salud ambiental" "${m}"`,
        ]
      : [];
  return {
    suggestedQueries: [...generic, ...puertoRico],
    note:
      "Official government sources only. Reject consultant/blog/law-firm/mirror/AI " +
      "summaries. Discovered candidates are created as needs_review and require admin approval.",
  };
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
