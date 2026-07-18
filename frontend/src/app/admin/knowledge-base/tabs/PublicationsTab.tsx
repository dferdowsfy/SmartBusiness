"use client";

// ============================================================================
// Publications tab — batch lifecycle: Draft → Approved → (Scheduled) →
// Published → Rolled back. Nothing accepted becomes active until it ships in
// an approved batch; only the latest published batch can be rolled back.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { Btn, COLORS, StatusBadge, inputStyle, labelStyle } from "../ui";
import { NODE_TYPE_CONFIGS } from "../../../rk/registry";
import type { ChangeProposalRow, PublicationBatchRow } from "../../../rk/types";

interface BatchesResponse {
  batches: (PublicationBatchRow & { item_count: number })[];
  snapshots: { id: string; version: number; is_active: boolean; created_at: string; compiled_from_batch: string | null }[];
  eligible: (ChangeProposalRow & { blocked_reason?: string })[];
}

export function PublicationsTab({ enabled, onChanged }: { enabled: boolean; onChanged: () => void }) {
  const [data, setData] = useState<BatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [effectiveAt, setEffectiveAt] = useState("");

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/rk/batches");
      if (res.ok) setData((await res.json()) as BatchesResponse);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch lifecycle
    void load();
  }, [load]);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 9000);
  };

  const post = async (body: Record<string, unknown>, confirmWord?: string) => {
    if (confirmWord) {
      const typed = window.prompt(
        `This changes LIVE user-facing requirements. Type ${confirmWord} to confirm.\n(Tip: set ADMIN_EMAILS in production so only named admins can do this.)`
      );
      if (typed !== confirmWord) {
        notify("Cancelled — confirmation text did not match.");
        return;
      }
    }
    setBusy(String(body.action) + String(body.batchId ?? ""));
    try {
      const res = await fetch("/api/rk/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = await res.json();
      if (!res.ok) notify(`Failed: ${out.error}`);
      else {
        notify(`Batch ${body.action} OK.`);
        setSelected(new Set());
        setName("");
        setScheduling(null);
        await load();
        onChanged();
      }
    } finally {
      setBusy(null);
    }
  };

  if (!enabled) {
    return (
      <div style={{ color: COLORS.faint, padding: "50px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
        Publishing needs a database. Set DATABASE_URL to enable it.
      </div>
    );
  }
  if (loading || !data) return <div style={{ color: COLORS.faint, padding: 30, textAlign: "center" }}>Loading…</div>;

  return (
    <div>
      {toast && (
        <div style={{ background: COLORS.green + "18", border: `1px solid ${COLORS.green}66`, color: "#a7f3d0", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
          {toast}
        </div>
      )}

      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ color: COLORS.text, fontWeight: 700, marginBottom: 6 }}>Create a publication batch</div>
        {data.eligible.length === 0 ? (
          <div style={{ color: COLORS.faint, fontSize: 13 }}>
            No accepted, unbatched proposals. Accept proposals in Proposed Changes first.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto", marginBottom: 10 }}>
              {data.eligible.map((p) => {
                const cfg = NODE_TYPE_CONFIGS[p.node_type];
                const blocked = !!p.blocked_reason;
                return (
                  <label key={p.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: blocked ? COLORS.faint : COLORS.text, cursor: blocked ? "default" : "pointer" }}>
                    <input
                      type="checkbox"
                      disabled={blocked}
                      checked={selected.has(p.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(p.id);
                        else next.delete(p.id);
                        setSelected(next);
                      }}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      <span style={{ color: cfg?.color }}>{cfg?.label}</span>{" "}
                      {cfg?.labelOf((p.reviewed_json ?? p.proposed_json ?? {}) as Record<string, unknown>) || p.entity_id}
                      <span style={{ color: COLORS.faint }}> · {p.change_kind.replace("_node", "")}</span>
                      {blocked && <span style={{ color: COLORS.purple, display: "block", fontSize: 12 }}>Blocked: {p.blocked_reason}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label style={labelStyle}>Batch name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. March 2026 health-permit updates" style={inputStyle} />
              </div>
              <Btn primary disabled={!name.trim() || selected.size === 0 || busy === "create"} onClick={() => void post({ action: "create", name, proposalIds: [...selected] })}>
                Create batch ({selected.size})
              </Btn>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {data.batches.length === 0 && (
          <div style={{ color: COLORS.faint, padding: "30px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
            No batches yet.
          </div>
        )}
        {data.batches.map((b) => (
          <div key={b.id} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ color: COLORS.text, fontWeight: 700 }}>{b.name}</div>
                <div style={{ color: COLORS.faint, fontSize: 12, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span>{b.item_count} change(s)</span>
                  <span>created {new Date(b.created_at).toLocaleString()} {b.created_by ? `by ${b.created_by}` : ""}</span>
                  {b.approved_at && <span>approved {new Date(b.approved_at).toLocaleString()} by {b.approved_by}</span>}
                  {b.effective_at && <span>effective {new Date(b.effective_at).toLocaleString()}</span>}
                  {b.published_at && <span>published {new Date(b.published_at).toLocaleString()} by {b.published_by}</span>}
                  {b.rolled_back_at && <span>rolled back {new Date(b.rolled_back_at).toLocaleString()} by {b.rolled_back_by}</span>}
                </div>
              </div>
              <StatusBadge status={b.status} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {b.status === "draft" && (
                  <Btn small primary disabled={busy === "approve" + b.id} onClick={() => void post({ action: "approve", batchId: b.id })}>Approve</Btn>
                )}
                {b.status === "approved" && (
                  <>
                    <Btn small primary disabled={busy === "publish" + b.id} onClick={() => void post({ action: "publish", batchId: b.id }, "PUBLISH")}>Publish now</Btn>
                    <Btn small onClick={() => setScheduling(scheduling === b.id ? null : b.id)}>Schedule…</Btn>
                  </>
                )}
                {b.status === "scheduled" && (
                  <Btn small primary disabled={busy === "publish" + b.id} onClick={() => void post({ action: "publish", batchId: b.id }, "PUBLISH")}>Publish early</Btn>
                )}
                {b.status === "published" && (
                  <Btn small danger disabled={busy === "rollback" + b.id} onClick={() => void post({ action: "rollback", batchId: b.id }, "ROLLBACK")}>Roll back</Btn>
                )}
              </div>
            </div>
            {scheduling === b.id && (
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="datetime-local" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} style={{ ...inputStyle, width: "auto" }} />
                <Btn small primary disabled={!effectiveAt} onClick={() => void post({ action: "schedule", batchId: b.id, effectiveAt: new Date(effectiveAt).toISOString() })}>
                  Schedule
                </Btn>
                <span style={{ color: COLORS.faint, fontSize: 12 }}>
                  Scheduled batches publish automatically on the next admin visit after the effective time
                  (or wire a cron to GET /api/rk/batches).
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ color: COLORS.text, fontWeight: 700, marginBottom: 8 }}>Knowledge-base snapshots (version history)</div>
        {data.snapshots.length === 0 ? (
          <div style={{ color: COLORS.faint, fontSize: 13 }}>
            No snapshots yet — the live app serves the bundled knowledge base until the first batch is published.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.snapshots.map((s) => (
              <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, color: COLORS.dim }}>
                <span style={{ color: COLORS.text, fontWeight: 700 }}>v{s.version}</span>
                {s.is_active && <StatusBadge status="active" />}
                <span>{new Date(s.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
