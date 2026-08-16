import { randomUUID } from "crypto";
import { getPool } from "../../../graph/db";
import { ensureSchema } from "../../../graph/store";
import { getCurrentUser } from "../../../../lib/supabase/server";
import { addMonthsClamped, deriveObligationStatus, nextActionForStatus, validDateOnly } from "../../../compliance/dates";
import { scheduleObligationNotifications } from "../../../compliance/server";
import { DUE_DATE_SOURCES, type DueDateSource } from "../../../compliance/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  due_date?: string | null;
  due_date_source?: DueDateSource;
  due_date_confidence?: number | null;
  source_reference?: string | null;
  complete?: boolean;
  next_due_date?: string | null;
  next_due_date_source?: DueDateSource;
  next_source_reference?: string | null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const pool = getPool();
  if (!pool) return Response.json({ error: "Database unavailable." }, { status: 503 });
  let body: PatchBody;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const dueDate = body.due_date === null ? null : body.due_date ? validDateOnly(body.due_date) : undefined;
  if (body.due_date && !dueDate) return Response.json({ error: "Due date must use YYYY-MM-DD." }, { status: 400 });
  if (dueDate && (!body.due_date_source || body.due_date_source === "UNKNOWN" || !DUE_DATE_SOURCES.includes(body.due_date_source))) {
    return Response.json({ error: "A verifiable due-date source is required." }, { status: 400 });
  }
  if (dueDate && body.due_date_source === "REGULATORY_RULE" && !body.source_reference?.trim()) {
    return Response.json({ error: "Regulatory-rule dates require a source reference." }, { status: 400 });
  }

  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = (await client.query<{
      id: string; business_id: string; matter_id: string | null; requirement_id: string | null;
      graph_entity_id: string | null; name: string; agency: string | null; mandatory: boolean;
      status: string; due_date: string | null; due_date_source: DueDateSource;
      source: string; source_reference: string | null; renewal_frequency_months: number | null;
      renewal_reference: string | null; cycle_index: number; workspace_id: string | null;
      business_name: string; evidence_state: "NONE" | "VERIFIED" | "NEEDS_REVIEW" | "FAILED";
    }>(
      `SELECT o.*, b.workspace_id, COALESCE(b.legal_name, b.name) AS business_name,
              CASE
                WHEN EXISTS (SELECT 1 FROM evidence e WHERE e.obligation_id=o.id AND e.review_status='VERIFIED') THEN 'VERIFIED'
                WHEN EXISTS (SELECT 1 FROM evidence e WHERE e.obligation_id=o.id AND e.review_status='NEEDS_REVIEW') THEN 'NEEDS_REVIEW'
                WHEN EXISTS (SELECT 1 FROM evidence e WHERE e.obligation_id=o.id) THEN 'FAILED'
                ELSE 'NONE' END AS evidence_state
         FROM obligations o JOIN businesses b ON b.id=o.business_id
        WHERE o.id=$1 AND (b.user_id=$2 OR EXISTS (
          SELECT 1 FROM workspace_members wm WHERE wm.workspace_id=b.workspace_id AND wm.user_id=$2))
        FOR UPDATE`,
      [id, user.id]
    )).rows[0];
    if (!current) {
      await client.query("ROLLBACK");
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const resolvedDue = dueDate === undefined ? current.due_date : dueDate;
    const resolvedSource = dueDate === undefined
      ? current.due_date_source
      : dueDate === null ? "UNKNOWN" : body.due_date_source!;
    const status = body.complete ? "COMPLETED" : deriveObligationStatus({
      currentStatus: current.status,
      dueDate: resolvedDue,
      evidenceState: current.evidence_state,
      expectsRenewal: Boolean(current.renewal_frequency_months || resolvedDue),
    });
    await client.query(
      `UPDATE obligations SET status=$2, due_date=$3, due_date_source=$4,
          due_date_confidence=$5, source_reference=COALESCE($6, source_reference),
          verified_at=CASE WHEN $4 <> 'UNKNOWN' THEN now() ELSE verified_at END,
          completed_at=CASE WHEN $2='COMPLETED' THEN now() ELSE NULL END,
          next_action=$7, updated_at=now()
        WHERE id=$1`,
      [id, status, resolvedDue, resolvedSource, body.due_date_confidence ?? null,
        body.source_reference?.trim() || null, nextActionForStatus(status)]
    );

    let nextObligationId: string | null = null;
    if (body.complete) {
      await client.query(
        `UPDATE notifications SET status='CANCELLED' WHERE obligation_id=$1 AND status='PENDING'`, [id]
      );
      const explicitNext = body.next_due_date ? validDateOnly(body.next_due_date) : null;
      if (body.next_due_date && !explicitNext) throw new Error("Invalid next due date");
      let nextDue = explicitNext;
      let nextSource: DueDateSource = body.next_due_date_source ?? "UNKNOWN";
      let nextReference = body.next_source_reference?.trim() || null;
      if (!nextDue && current.renewal_frequency_months && resolvedDue && current.renewal_reference) {
        nextDue = addMonthsClamped(resolvedDue, current.renewal_frequency_months);
        nextSource = "REGULATORY_RULE";
        nextReference = current.renewal_reference;
      }
      if (nextDue) {
        if (nextSource === "UNKNOWN" || !DUE_DATE_SOURCES.includes(nextSource)) {
          throw new Error("Next due date requires provenance");
        }
        if (nextSource === "REGULATORY_RULE" && !nextReference) {
          throw new Error("Regulatory recurrence requires a source reference");
        }
        nextObligationId = randomUUID();
        const nextStatus = deriveObligationStatus({ evidenceState: "VERIFIED", dueDate: nextDue, expectsRenewal: true });
        await client.query(
          `INSERT INTO obligations
             (id,business_id,matter_id,requirement_id,graph_entity_id,name,agency,status,due_date,
              due_date_source,source,source_reference,verified_at,renewal_frequency_months,
              renewal_reference,mandatory,next_action,cycle_index,previous_obligation_id)
           VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$12,$13,$14,$15,$16,$17)`,
          [nextObligationId, current.business_id, current.requirement_id, current.graph_entity_id,
            current.name, current.agency, nextStatus, nextDue, nextSource, current.source,
            nextReference, current.renewal_frequency_months, current.renewal_reference,
            current.mandatory, nextActionForStatus(nextStatus), current.cycle_index + 1, id]
        );
        await scheduleObligationNotifications(client, {
          userId: user.id,
          workspaceId: current.workspace_id,
          businessId: current.business_id,
          businessName: current.business_name,
          obligationId: nextObligationId,
          obligationName: current.name,
          dueDate: nextDue,
        });
      }
    } else if (resolvedDue) {
      await scheduleObligationNotifications(client, {
        userId: user.id,
        workspaceId: current.workspace_id,
        businessId: current.business_id,
        businessName: current.business_name,
        obligationId: id,
        obligationName: current.name,
        dueDate: resolvedDue,
      });
    }
    await client.query("COMMIT");
    return Response.json({ updated: true, status, next_obligation_id: nextObligationId });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const message = (error as Error).message;
    if (/Invalid next|requires provenance|requires a source/.test(message)) {
      return Response.json({ error: message }, { status: 400 });
    }
    console.error("[obligations] update", message);
    return Response.json({ error: "Could not update obligation." }, { status: 500 });
  } finally {
    client.release();
  }
}
