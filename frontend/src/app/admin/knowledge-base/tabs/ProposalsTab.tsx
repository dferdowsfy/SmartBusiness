"use client";

// ============================================================================
// Proposed Changes tab — the human-review gate.
//
// Shows every open proposal (manual edits + AI extractions) with the current
// vs proposed rule side by side, source provision, AI explanation, confidence,
// and classification. Actions: accept · edit & accept · reject · defer · mark
// for legal review · merge duplicates. Accepted proposals still do NOT go
// live — they must be included in an approved publication batch.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, COLORS, StatusBadge, inputStyle, selectStyle } from "../ui";
import { DiffView } from "../components/DiffView";
import { NODE_TYPE_CONFIGS } from "../../../rk/registry";
import { ENACTED_STATUSES, type ChangeProposalRow } from "../../../rk/types";

const OPEN_STATUSES = ["draft", "ai_extracted", "under_review", "legal_review", "accepted", "conflict"];
const CLASS_LABEL: Record<string, string> = {
  new_requirement: "New requirement",
  modified_requirement: "Modified requirement",
  removed_requirement: "Removed requirement",
  new_exemption: "New exemption",
  changed_agency_responsibility: "Changed agency responsibility",
  changed_form: "Changed form",
  changed_eligibility_rule: "Changed eligibility rule",
  changed_deadline: "Changed deadline",
  no_action_required: "No action required",
  needs_legal_review: "Needs legal review",
};

function ConfidenceBar({ value }: { value: number | null }) {
  if (value == null) return null;
  const pct = Math.round(Number(value) * 100);
  const color = pct >= 70 ? COLORS.green : pct >= 40 ? COLORS.amber : COLORS.red;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 60, height: 6, borderRadius: 4, background: COLORS.border, overflow: "hidden", display: "inline-block" }}>
        <span style={{ display: "block", width: `${pct}%`, height: "100%", background: color }} />
      </span>
      <span style={{ color, fontSize: 11.5, fontWeight: 700 }}>{pct}%</span>
    </span>
  );
}

export function ProposalsTab({ enabled, onChanged }: { enabled: boolean; onChanged: () => void }) {
  const [proposals, setProposals] = useState<ChangeProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // proposal id being edited
  const [editText, setEditText] = useState("");
  const [merging, setMerging] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/rk/proposals`);
      const data = await res.json();
      setProposals(data.proposals ?? []);
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
    window.setTimeout(() => setToast(null), 8000);
  };

  const act = async (
    p: ChangeProposalRow,
    action: string,
    extra: { reviewedJson?: Record<string, unknown>; mergeIntoId?: string; note?: string } = {}
  ) => {
    setBusy(p.id + action);
    try {
      const res = await fetch(`/api/rk/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(`Failed: ${data.error}`);
      } else {
        notify(
          action === "accept" || action === "edit_accept"
            ? "Accepted. It becomes active only when included in an approved publication batch (Publications tab)."
            : `Proposal ${action.replace("_", " ")} done.`
        );
        setEditing(null);
        setMerging(null);
        await load();
        onChanged();
      }
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    if (statusFilter === "open") return proposals.filter((p) => OPEN_STATUSES.includes(p.status));
    if (statusFilter === "all") return proposals;
    return proposals.filter((p) => p.status === statusFilter);
  }, [proposals, statusFilter]);

  if (!enabled) {
    return (
      <div style={{ color: COLORS.faint, padding: "50px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
        Proposal review needs a database. Set DATABASE_URL to enable it.
      </div>
    );
  }

  return (
    <div>
      {toast && (
        <div style={{ background: COLORS.green + "18", border: `1px solid ${COLORS.green}66`, color: "#a7f3d0", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
          {toast}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...selectStyle, width: "auto" }}>
          <option value="open">Open (needs attention)</option>
          <option value="all">All</option>
          {["draft", "ai_extracted", "under_review", "legal_review", "accepted", "conflict", "rejected", "deferred", "merged", "published"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span style={{ color: COLORS.faint, fontSize: 12.5 }}>
          {filtered.length} proposal(s). Accepted items are published via the Publications tab — never automatically.
        </span>
      </div>

      {loading ? (
        <div style={{ color: COLORS.faint, padding: 30, textAlign: "center" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: COLORS.faint, padding: "40px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
          Nothing to review. Edit the graph or ingest a regulatory source to create proposals.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((p) => {
            const cfg = NODE_TYPE_CONFIGS[p.node_type];
            const shown = (p.reviewed_json ?? p.proposed_json) as Record<string, unknown> | null;
            const isBill = !!p.source_id && !ENACTED_STATUSES.includes((p.source_legal_status ?? "proposed") as typeof ENACTED_STATUSES[number]);
            const isOpen = expanded === p.id;
            const actionable = OPEN_STATUSES.includes(p.status) && p.status !== "accepted";
            return (
              <div key={p.id} style={{ background: COLORS.panel, border: `1px solid ${p.status === "conflict" ? COLORS.red : COLORS.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ color: cfg?.color ?? COLORS.dim, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{cfg?.label ?? p.node_type}</span>
                      <StatusBadge status={p.status} />
                      <span style={{ color: COLORS.faint, fontSize: 11.5 }}>{p.change_kind.replace("_node", "")}</span>
                      {isBill && <StatusBadge status="proposed" />}
                      {p.origin === "ai_extraction" ? <ConfidenceBar value={p.confidence} /> : <span style={{ color: COLORS.faint, fontSize: 11.5 }}>manual edit</span>}
                    </div>
                    <div style={{ color: COLORS.text, fontWeight: 700, marginTop: 4 }}>
                      {cfg?.labelOf((shown ?? p.current_json ?? {}) as Record<string, unknown>) || p.entity_id}
                    </div>
                    <div style={{ color: COLORS.faint, fontSize: 12, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>{p.entity_id}</span>
                      {p.classification && <span style={{ color: COLORS.amber }}>{CLASS_LABEL[p.classification] ?? p.classification}</span>}
                      {p.citation_section && <span>§ {p.citation_section}</span>}
                      {p.source_title && <span>from {p.source_title}</span>}
                      <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                    {isBill && (
                      <div style={{ color: COLORS.purple, fontSize: 12, marginTop: 4 }}>
                        Proposed Future State — from an unenacted source; cannot enter a publication
                        batch until the source is approved/signed/effective.
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Btn small onClick={() => setExpanded(isOpen ? null : p.id)}>{isOpen ? "Hide diff" : "Review diff"}</Btn>
                    {actionable && (
                      <>
                        <Btn small primary disabled={busy === p.id + "accept"} onClick={() => void act(p, "accept")}>Accept</Btn>
                        <Btn small onClick={() => { setEditing(editing === p.id ? null : p.id); setEditText(JSON.stringify(shown ?? {}, null, 2)); }}>Edit & accept</Btn>
                        <Btn small danger disabled={busy === p.id + "reject"} onClick={() => void act(p, "reject")}>Reject</Btn>
                        <Btn small onClick={() => void act(p, "defer")}>Defer</Btn>
                        <Btn small onClick={() => void act(p, "legal_review")}>Legal review</Btn>
                        <Btn small onClick={() => { setMerging(merging === p.id ? null : p.id); setMergeTarget(""); }}>Merge…</Btn>
                      </>
                    )}
                    {p.status === "conflict" && <Btn small onClick={() => void act(p, "reopen")}>Re-review</Btn>}
                    {(p.status === "rejected" || p.status === "deferred") && <Btn small onClick={() => void act(p, "reopen")}>Reopen</Btn>}
                  </div>
                </div>

                {p.ai_explanation && (
                  <div style={{ marginTop: 8, background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.dim, fontSize: 12.5 }}>
                    <span style={{ color: COLORS.faint, fontWeight: 700 }}>AI explanation: </span>{p.ai_explanation}
                  </div>
                )}
                {p.review_note && (
                  <div style={{ marginTop: 6, color: COLORS.faint, fontSize: 12 }}>Note: {p.review_note}</div>
                )}

                {isOpen && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                    <DiffView current={p.current_json as Record<string, unknown> | null} proposed={shown} />
                  </div>
                )}

                {editing === p.id && (
                  <div style={{ marginTop: 10 }}>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={10}
                      style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", fontSize: 12, resize: "vertical" }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <Btn
                        small
                        primary
                        disabled={busy === p.id + "edit_accept"}
                        onClick={() => {
                          try {
                            const reviewedJson = JSON.parse(editText) as Record<string, unknown>;
                            void act(p, "edit_accept", { reviewedJson });
                          } catch {
                            notify("Invalid JSON — fix the syntax before accepting.");
                          }
                        }}
                      >
                        Accept with edits
                      </Btn>
                      <Btn small onClick={() => setEditing(null)}>Cancel</Btn>
                    </div>
                  </div>
                )}

                {merging === p.id && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} style={{ ...selectStyle, width: "auto", maxWidth: 420 }}>
                      <option value="">Merge this duplicate into…</option>
                      {proposals
                        .filter((o) => o.id !== p.id && o.node_type === p.node_type && OPEN_STATUSES.includes(o.status))
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {NODE_TYPE_CONFIGS[o.node_type]?.labelOf((o.reviewed_json ?? o.proposed_json ?? {}) as Record<string, unknown>) || o.entity_id} · {o.status}
                          </option>
                        ))}
                    </select>
                    <Btn small primary disabled={!mergeTarget || busy === p.id + "merge"} onClick={() => void act(p, "merge", { mergeIntoId: mergeTarget })}>
                      Merge
                    </Btn>
                    <Btn small onClick={() => setMerging(null)}>Cancel</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
