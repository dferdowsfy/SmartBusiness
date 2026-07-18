"use client";

// Audit Log tab — complete append-only history of every admin/system action.
import { useCallback, useEffect, useState } from "react";
import { Btn, COLORS, inputStyle } from "../ui";
import type { AuditEventRow } from "../../../rk/types";

export function AuditTab({ enabled }: { enabled: boolean }) {
  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = entity.trim() ? `?entity=${encodeURIComponent(entity.trim())}` : "";
      const res = await fetch(`/api/rk/audit${qs}`);
      if (res.ok) setEvents(((await res.json()).events ?? []) as AuditEventRow[]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, entity]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch lifecycle
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) {
    return (
      <div style={{ color: COLORS.faint, padding: "50px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
        The audit log needs a database. Set DATABASE_URL to enable it.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="Filter by entity id (e.g. DOC_HEALTH_PERMIT)…" style={{ ...inputStyle, maxWidth: 380 }} />
        <Btn onClick={() => void load()}>Filter</Btn>
      </div>
      {loading ? (
        <div style={{ color: COLORS.faint, padding: 30, textAlign: "center" }}>Loading…</div>
      ) : events.length === 0 ? (
        <div style={{ color: COLORS.faint, padding: "40px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
          No audit events yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {events.map((e) => (
            <div key={e.id} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
                <span style={{ color: COLORS.faint, minWidth: 150 }}>{new Date(e.created_at).toLocaleString()}</span>
                <span style={{ color: COLORS.accent, fontWeight: 700 }}>{e.action}</span>
                {e.entity_kind && <span style={{ color: COLORS.dim }}>{e.entity_kind}</span>}
                {e.entity_id && <span style={{ color: COLORS.text }}>{e.entity_id}</span>}
                <span style={{ flex: 1 }} />
                {e.actor && <span style={{ color: COLORS.faint }}>{e.actor}</span>}
                {(e.before_json || e.after_json) && (
                  <Btn small onClick={() => setOpen(open === e.id ? null : e.id)}>{open === e.id ? "Hide" : "Details"}</Btn>
                )}
              </div>
              {open === e.id && (
                <pre style={{ marginTop: 8, background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, fontSize: 11.5, color: COLORS.dim, overflowX: "auto", maxHeight: 260 }}>
                  {JSON.stringify({ before: e.before_json, after: e.after_json }, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
