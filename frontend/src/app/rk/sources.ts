// ============================================================================
// Regulatory sources (SERVER ONLY): bills, laws, regulations, ordinances,
// agency guidance, official forms, government web content.
//
// Each source carries a legal_status; only enacted statuses (approved/signed/
// effective/amended) may feed publishable proposals — everything else lives in
// the "Proposed Future State" layer.
// ============================================================================

import { createHash } from "crypto";
import { getPool } from "../graph/db";
import { ensureRkReady } from "./store";
import { writeAudit } from "./audit";
import { isOfficialHost } from "../requirements/sources";
import type { LegalStatus, RegulatorySourceRow, SourceType } from "./types";

// Hosts beyond .gov/.pr.gov that publish official PR legislative text.
const EXTRA_OFFICIAL_HOSTS = ["oslpr.org", "sutra.oslpr.org", "lexjuris.com"];

const MAX_TEXT = 5 * 1024 * 1024; // ~5MB of text

export async function listSources(): Promise<(RegulatorySourceRow & { proposal_count: number })[]> {
  const pool = getPool();
  if (!pool) return [];
  await ensureRkReady();
  const rows = (
    await pool.query(`
      SELECT s.id, s.title, s.source_type, s.legal_status, s.citation, s.url, s.jurisdiction,
             s.checksum, s.effective_date, s.metadata, s.created_by, s.created_at, s.updated_at,
             length(s.raw_text) AS raw_text_length,
             jsonb_array_length(coalesce(s.sections_json, '[]'::jsonb)) AS section_count,
             (SELECT count(*)::int FROM rk_change_proposals p WHERE p.source_id = s.id) AS proposal_count
        FROM rk_regulatory_sources s
       ORDER BY s.created_at DESC`)
  ).rows;
  return rows as (RegulatorySourceRow & { proposal_count: number })[];
}

export async function getSource(id: string): Promise<RegulatorySourceRow | null> {
  const pool = getPool();
  if (!pool) return null;
  await ensureRkReady();
  const rows = (await pool.query(`SELECT * FROM rk_regulatory_sources WHERE id = $1`, [id])).rows;
  return (rows[0] as RegulatorySourceRow) ?? null;
}

export interface CreateSourceInput {
  title: string;
  sourceType: SourceType;
  legalStatus: LegalStatus;
  citation?: string | null;
  url?: string | null;
  effectiveDate?: string | null;
  /** raw document text (pasted, or extracted client-side from a PDF) */
  text?: string | null;
  actor?: string | null;
}

export async function createSource(input: CreateSourceInput): Promise<{ ok: boolean; source?: RegulatorySourceRow; message?: string }> {
  const pool = getPool();
  if (!pool) return { ok: false, message: "no_database" };
  await ensureRkReady();

  let text = (input.text ?? "").slice(0, MAX_TEXT) || null;

  // If a URL is given without text, fetch it — official hosts only.
  if (!text && input.url) {
    if (!isOfficialHost(input.url, EXTRA_OFFICIAL_HOSTS)) {
      return { ok: false, message: "URL is not an allowed official source host (.gov / .pr.gov / legislature portals)" };
    }
    try {
      const res = await fetch(input.url, {
        headers: { "User-Agent": "SmartPR-RegulatoryMonitor/1.0" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return { ok: false, message: `fetch failed: HTTP ${res.status}` };
      const body = (await res.text()).slice(0, MAX_TEXT);
      // Strip tags crudely if HTML; bills are usually served as text/html.
      text = body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s{3,}/g, "\n").trim();
    } catch (err) {
      return { ok: false, message: `fetch failed: ${(err as Error).message}` };
    }
  }

  const checksum = text ? createHash("sha256").update(text).digest("hex") : null;
  const res = await pool.query(
    `INSERT INTO rk_regulatory_sources
       (title, source_type, legal_status, citation, url, raw_text, checksum, effective_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      input.title,
      input.sourceType,
      input.legalStatus,
      input.citation ?? null,
      input.url ?? null,
      text,
      checksum,
      input.effectiveDate ?? null,
      input.actor ?? null,
    ]
  );
  const source = res.rows[0] as RegulatorySourceRow;
  await writeAudit({
    actor: input.actor,
    action: "source_created",
    entityKind: "regulatory_source",
    entityId: source.id,
    after: { title: source.title, source_type: source.source_type, legal_status: source.legal_status },
  });
  return { ok: true, source };
}

export async function updateSource(
  id: string,
  patch: { legalStatus?: LegalStatus; citation?: string | null; effectiveDate?: string | null; title?: string },
  actor?: string | null
): Promise<{ ok: boolean; source?: RegulatorySourceRow; message?: string }> {
  const pool = getPool();
  if (!pool) return { ok: false, message: "no_database" };
  const before = await getSource(id);
  if (!before) return { ok: false, message: "not_found" };
  const res = await pool.query(
    `UPDATE rk_regulatory_sources
        SET legal_status = coalesce($2, legal_status),
            citation = coalesce($3, citation),
            effective_date = coalesce($4, effective_date),
            title = coalesce($5, title),
            updated_at = now()
      WHERE id = $1 RETURNING *`,
    [id, patch.legalStatus ?? null, patch.citation ?? null, patch.effectiveDate ?? null, patch.title ?? null]
  );
  const source = res.rows[0] as RegulatorySourceRow;
  await writeAudit({
    actor,
    action: "source_updated",
    entityKind: "regulatory_source",
    entityId: id,
    before: { legal_status: before.legal_status, title: before.title },
    after: { legal_status: source.legal_status, title: source.title },
  });
  return { ok: true, source };
}
