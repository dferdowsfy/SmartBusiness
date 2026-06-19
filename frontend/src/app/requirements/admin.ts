// ============================================================================
// PR 10: Admin review queue.
//
// Surfaces everything needing human attention (newly discovered/changed rules,
// draft templates, open change events, failed runs) and applies admin actions.
//
// VERSIONING GUARDRAIL: approving a new template version supersedes the prior
// active version rather than deleting it, preserving history for auditability.
// ============================================================================

import { getPool } from "../graph/db";
import { ensureRequirementsSchema } from "./schema";

export interface AdminReviewItem {
  item_kind: "rule" | "document" | "template" | "change_event";
  item_id: string;
  title: string | null;
  status: string;
  confidence_score: number | null;
  source_domain: string | null;
  source_url: string | null;
  source_file_url: string | null;
  agency_name: string | null;
  municipality: string | null;
  document_type: string | null;
  canonical_requirement_code: string | null;
  metadata_json: Record<string, unknown> | null;
  updated_at: string;
}

export async function listAdminReviewQueue(): Promise<AdminReviewItem[]> {
  const pool = getPool();
  if (!pool) return [];
  await ensureRequirementsSchema();
  const { rows } = await pool.query<AdminReviewItem>(
    `SELECT * FROM v_admin_review_queue ORDER BY updated_at DESC LIMIT 200`
  );
  return rows;
}

export type AdminAction =
  | "approve_rule"
  | "reject_rule"
  | "approve_document"
  | "reject_document"
  | "approve_template"
  | "reject_template"
  | "accept_change"
  | "reject_change"
  | "mark_source_stale";

export async function applyAdminAction(input: {
  action: AdminAction;
  itemId: string;
  adminUserId: string;
}): Promise<{ ok: boolean; message: string }> {
  const pool = getPool();
  if (!pool) return { ok: false, message: "no_database" };
  await ensureRequirementsSchema();
  const { action, itemId, adminUserId } = input;

  switch (action) {
    case "approve_rule":
      await pool.query(`UPDATE requirement_rules SET status='active', updated_at=now() WHERE id=$1`, [itemId]);
      return { ok: true, message: "Rule approved and activated." };
    case "reject_rule":
      await pool.query(`UPDATE requirement_rules SET status='deprecated', updated_at=now() WHERE id=$1`, [itemId]);
      return { ok: true, message: "Rule rejected (deprecated)." };
    case "approve_document":
      await pool.query(`UPDATE requirement_documents SET status='active', updated_at=now() WHERE id=$1`, [itemId]);
      return { ok: true, message: "Document approved. It can now be linked to active forms and requirement packages." };
    case "reject_document":
      await pool.query(`UPDATE requirement_documents SET status='deprecated', updated_at=now() WHERE id=$1`, [itemId]);
      return { ok: true, message: "Document rejected (deprecated)." };
    case "approve_template": {
      // Supersede any currently-active version for the same document, then
      // publish this one. History is preserved (status='superseded').
      const { rows } = await pool.query<{ requirement_document_id: string | null }>(
        `SELECT requirement_document_id FROM form_templates WHERE id=$1`,
        [itemId]
      );
      const docId = rows[0]?.requirement_document_id ?? null;
      if (docId) {
        await pool.query(
          `UPDATE form_templates SET status='deprecated', updated_at=now()
            WHERE requirement_document_id=$1 AND status='active' AND id<>$2`,
          [docId, itemId]
        );
      }
      await pool.query(
        `UPDATE form_templates SET status='active', approved_by=$2, approved_at=now(), updated_at=now() WHERE id=$1`,
        [itemId, adminUserId]
      );
      return { ok: true, message: "Template approved and published; prior version superseded." };
    }
    case "reject_template":
      await pool.query(`UPDATE form_templates SET status='deprecated', updated_at=now() WHERE id=$1`, [itemId]);
      return { ok: true, message: "Template rejected." };
    case "accept_change":
      await pool.query(`UPDATE requirement_change_events SET status='accepted' WHERE id=$1`, [itemId]);
      return { ok: true, message: "Change accepted." };
    case "reject_change":
      await pool.query(`UPDATE requirement_change_events SET status='rejected' WHERE id=$1`, [itemId]);
      return { ok: true, message: "Change rejected." };
    case "mark_source_stale":
      await pool.query(`UPDATE requirement_rules SET status='needs_review', updated_at=now() WHERE id=$1`, [itemId]);
      return { ok: true, message: "Source marked stale (needs review)." };
    default:
      return { ok: false, message: "unknown_action" };
  }
}
