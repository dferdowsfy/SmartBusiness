"use client";

// ============================================================================
// DetailPanel — registry-driven node editor.
//
// One generic form renders every node type from NODE_TYPE_CONFIGS[type].fields
// (no per-type switch). Saving NEVER writes the graph directly: it creates a
// change proposal that must be accepted and published via a batch.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Btn, COLORS, StatusBadge, inputStyle, labelStyle, selectStyle } from "../ui";
import { KNOWN_FLAGS, NODE_TYPE_CONFIGS, type FieldSpec } from "../../../rk/registry";
import type { NodeType, RkNodeRow } from "../../../rk/types";
import type { GraphData } from "./useGraphData";

interface DetailResponse {
  node: RkNodeRow;
  versions: RkNodeRow[];
  edgesIn: { from_entity: string; from_label: string; edge_type: string }[];
  source: { id: string; title: string; legal_status: string; citation: string | null } | null;
}

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function FieldInput({
  spec,
  value,
  onChange,
  graph,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
  graph: GraphData;
}) {
  const refOptions = useMemo(() => {
    const refTypes = spec.refTypes ?? (spec.refType ? [spec.refType] : []);
    if (refTypes.length === 0 || !graph.graph) return [];
    return graph.graph.nodes
      .filter((n) => refTypes.includes(n.nodeType) && n.status !== "archived")
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [spec.refType, spec.refTypes, graph.graph]);

  switch (spec.kind) {
    case "json":
      return <textarea
        value={typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2)}
        onChange={(e) => { try { onChange(JSON.parse(e.target.value)); } catch { onChange(e.target.value); } }}
        rows={14}
        style={{ ...inputStyle, resize: "vertical" }}
      />;
    case "textarea":
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      );
    case "number":
      return (
        <input
          type="number"
          step="any"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          style={inputStyle}
        />
      );
    case "boolean":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.text, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked ? true : undefined)} />
          Yes
        </label>
      );
    case "select":
      return (
        <select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)} style={selectStyle}>
          <option value="">—</option>
          {(spec.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    case "multiselect": {
      const lines = arr(value);
      return (
        <textarea
          value={lines.join("\n")}
          onChange={(e) => {
            const next = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
            onChange(next.length ? next : undefined);
          }}
          rows={Math.max(2, lines.length + 1)}
          placeholder="One value per line"
          style={{ ...inputStyle, resize: "vertical" }}
        />
      );
    }
    case "flags": {
      const current = new Set(arr(value));
      const all = [...new Set([...KNOWN_FLAGS, ...current])];
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {all.map((f) => (
            <label key={f} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: current.has(f) ? COLORS.text : COLORS.dim, background: COLORS.panel2, border: `1px solid ${current.has(f) ? COLORS.accent : COLORS.border}`, borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={current.has(f)}
                onChange={(e) => {
                  const next = new Set(current);
                  if (e.target.checked) next.add(f);
                  else next.delete(f);
                  onChange([...next]);
                }}
                style={{ display: "none" }}
              />
              {f}
            </label>
          ))}
        </div>
      );
    }
    case "entity_ref":
      return (
        <select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)} style={selectStyle}>
          <option value="">—</option>
          {refOptions.map((n) => (
            <option key={n.entityId} value={n.entityId}>{n.label}</option>
          ))}
        </select>
      );
    case "entity_ref_list": {
      const current = arr(value);
      const currentSet = new Set(current);
      return (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
            {current.map((id) => {
              const n = graph.byEntity.get(id);
              return (
                <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 999, padding: "3px 10px", fontSize: 12, color: COLORS.text }}>
                  {n?.label ?? id}
                  <span role="button" onClick={() => onChange(current.filter((x) => x !== id))} style={{ color: COLORS.faint, cursor: "pointer" }}>×</span>
                </span>
              );
            })}
            {current.length === 0 && <span style={{ color: COLORS.faint, fontSize: 12 }}>None linked</span>}
          </div>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onChange([...current, e.target.value]);
            }}
            style={selectStyle}
          >
            <option value="">+ Add…</option>
            {refOptions.filter((n) => !currentSet.has(n.entityId)).map((n) => (
              <option key={n.entityId} value={n.entityId}>{n.label}</option>
            ))}
          </select>
        </div>
      );
    }
    default:
      return (
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          style={inputStyle}
        />
      );
  }
}

export function DetailPanel({
  entityId,
  newNodeType,
  graph,
  onClose,
  onSaved,
}: {
  /** entity to edit — or null when creating a new node */
  entityId: string | null;
  /** node type for a brand-new node (entityId null) */
  newNodeType?: NodeType;
  graph: GraphData;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const existing = entityId ? graph.byEntity.get(entityId) ?? null : null;
  const nodeType = existing?.nodeType ?? newNodeType ?? "rule";
  const cfg = NODE_TYPE_CONFIGS[nodeType];

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- form state must reset when the selected entity changes
    setForm(existing ? { ...existing.data } : {});
    setNote("");
    setError(null);
    setDetail(null);
    if (entityId && graph.enabled) {
      let active = true;
      void (async () => {
        try {
          const res = await fetch(`/api/rk/nodes/${encodeURIComponent(entityId)}`);
          if (!res.ok) return;
          const d = (await res.json()) as DetailResponse;
          if (active) setDetail(d);
        } catch {
          /* detail enrichment is optional */
        }
      })();
      return () => {
        active = false;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, newNodeType, graph.enabled]);

  const renamed = useMemo(() => {
    if (!existing) return [] as string[];
    return cfg.fields
      .filter((f) => f.renameWarning && existing.data[f.key] !== undefined && form[f.key] !== existing.data[f.key])
      .map((f) => f.label);
  }, [existing, form, cfg]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = entityId
        ? await fetch(`/api/rk/nodes/${encodeURIComponent(entityId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: form, note: note || undefined }),
          })
        : await fetch(`/api/rk/nodes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeType, data: form, note: note || undefined }),
          });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Save failed"));
        return;
      }
      onSaved(
        entityId
          ? `Edit saved as a change proposal for ${cfg.label} "${cfg.labelOf(form)}". It goes live once accepted and published.`
          : `New ${cfg.label} proposed. It goes live once accepted and published.`
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!entityId) return;
    if (!window.confirm(`Propose archiving "${existing?.label}"? Nothing is deleted — the archive takes effect only when published, and every prior version stays in history.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rk/nodes/${encodeURIComponent(entityId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Archive failed"));
        return;
      }
      onSaved(`Archive proposal created for "${existing?.label}".`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18, position: "sticky", top: 12, maxHeight: "calc(100vh - 40px)", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
        <div>
          <div style={{ color: cfg.color, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{cfg.label}</div>
          <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>
            {existing ? existing.label : `New ${cfg.label}`}
          </div>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {existing && <StatusBadge status={existing.status} />}
            {existing && <span style={{ color: COLORS.faint, fontSize: 11 }}>v{existing.version} · {existing.entityId}</span>}
            {existing && !existing.sourceId && existing.nodeType === "rule" && <StatusBadge status="missing_source" />}
          </div>
        </div>
        <Btn small onClick={onClose}>✕</Btn>
      </div>

      {detail?.source && (
        <div style={{ background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: COLORS.dim, margin: "8px 0" }}>
          Source: <span style={{ color: COLORS.text }}>{detail.source.title}</span>
          {detail.source.citation && <> · {detail.source.citation}</>} · <StatusBadge status={detail.source.legal_status} />
        </div>
      )}

      {!graph.enabled && (
        <div style={{ background: COLORS.amber + "18", border: `1px solid ${COLORS.amber}55`, color: "#fcd34d", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "8px 0" }}>
          Read-only: no database connected. Set DATABASE_URL to enable editing.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
        {cfg.fields.map((f) => (
          <div key={f.key}>
            <label style={labelStyle}>
              {f.label}
              {f.required && <span style={{ color: COLORS.red }}> *</span>}
            </label>
            <FieldInput spec={f} value={form[f.key]} onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))} graph={graph} />
            {f.help && <div style={{ color: COLORS.faint, fontSize: 11.5, marginTop: 3 }}>{f.help}</div>}
          </div>
        ))}

        {renamed.length > 0 && (
          <div style={{ background: COLORS.red + "15", border: `1px solid ${COLORS.red}55`, color: "#fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
            Renaming {renamed.join(", ")} — the live intake matches this entity by name, so existing
            selections/aliases may stop matching. Prefer adding a new entity unless this is a correction.
          </div>
        )}

        <div>
          <label style={labelStyle}>Change note (why)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Updated per Departamento de Salud guidance 2026-03" style={inputStyle} />
        </div>

        {error && <div style={{ color: "#fca5a5", fontSize: 12.5 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn primary disabled={busy || !graph.enabled} onClick={save}>
            {busy ? "Saving…" : entityId ? "Propose change" : "Propose new"}
          </Btn>
          {entityId && (
            <Btn danger disabled={busy || !graph.enabled} onClick={archive}>
              Propose archive
            </Btn>
          )}
        </div>
        <div style={{ color: COLORS.faint, fontSize: 11.5 }}>
          Changes never go live directly — they become proposals reviewed in Proposed Changes and
          activated through a publication batch.
        </div>
      </div>

      {detail && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
          {detail.edgesIn.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ ...labelStyle, marginBottom: 4 }}>Referenced by ({detail.edgesIn.length})</div>
              <div style={{ color: COLORS.dim, fontSize: 12, display: "flex", flexDirection: "column", gap: 3, maxHeight: 140, overflowY: "auto" }}>
                {detail.edgesIn.slice(0, 20).map((e, i) => (
                  <div key={i}>
                    <span style={{ color: COLORS.text }}>{e.from_label}</span>
                    <span style={{ color: COLORS.faint }}> — {e.edge_type}</span>
                  </div>
                ))}
                {detail.edgesIn.length > 20 && <div style={{ color: COLORS.faint }}>+{detail.edgesIn.length - 20} more…</div>}
              </div>
            </div>
          )}
          <div style={{ ...labelStyle, marginBottom: 4 }}>Version history</div>
          <div style={{ color: COLORS.dim, fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
            {detail.versions.map((v) => (
              <div key={v.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: COLORS.text }}>v{v.version}</span>
                <StatusBadge status={v.status} />
                <span style={{ color: COLORS.faint }}>{new Date(v.created_at).toLocaleDateString()}</span>
                {v.created_by && <span style={{ color: COLORS.faint }}>· {v.created_by}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
