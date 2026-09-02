"use client";

// ============================================================================
// Requirements tab — master-detail editor over every graph entity.
// Replaces the old read-only Municipalities / Business Types / Requirements
// Engine tabs with one searchable, filterable, editable list.
// ============================================================================

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Btn, COLORS, StatusBadge, inputStyle, selectStyle } from "../ui";
import { DetailPanel } from "../graph/DetailPanel";
import { NODE_TYPES, NODE_TYPE_CONFIGS } from "../../../rk/registry";
import type { NodeType } from "../../../rk/types";
import type { GraphData } from "../graph/useGraphData";

export function RequirementsTab({
  graph,
  onSaved,
  initialType = "rule",
  allowedTypes = NODE_TYPES,
  intro,
}: {
  graph: GraphData;
  onSaved: (msg: string) => void;
  initialType?: NodeType | "all";
  allowedTypes?: NodeType[];
  intro?: ReactNode;
}) {
  const [typeFilter, setTypeFilter] = useState<NodeType | "all">(initialType);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState<NodeType | null>(null);

  const nodes = useMemo(() => {
    let list = graph.graph?.nodes ?? [];
    if (typeFilter !== "all") list = list.filter((n) => n.nodeType === typeFilter);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (n) => n.label.toLowerCase().includes(query) || n.entityId.toLowerCase().includes(query)
      );
    }
    return [...list].sort((a, b) => a.label.localeCompare(b.label)).slice(0, 400);
  }, [graph.graph, typeFilter, q]);

  const showPanel = selected !== null || creating !== null;

  return (
    <div className={showPanel ? "kb-split detail" : undefined}>
      <div>
        {intro}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button
            onClick={() => setTypeFilter("all")}
            className={`kb-tab ${typeFilter === "all" ? "active" : ""}`}
          >
            All
          </button>
          {allowedTypes.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`kb-tab ${typeFilter === t ? "active" : ""}`}
              style={{ borderLeft: `3px solid ${NODE_TYPE_CONFIGS[t].color}` }}
            >
              {NODE_TYPE_CONFIGS[t].plural}
              {graph.graph?.counts[t] ? ` · ${graph.graph.counts[t]}` : ""}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or id…"
            style={{ ...inputStyle, flex: 1 }}
          />
          {typeFilter !== "all" ? (
            <Btn
              primary
              disabled={!graph.enabled}
              onClick={() => {
                setSelected(null);
                setCreating(typeFilter);
              }}
            >
              + New {NODE_TYPE_CONFIGS[typeFilter].label}
            </Btn>
          ) : (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  setSelected(null);
                  setCreating(e.target.value as NodeType);
                }
              }}
              style={{ ...selectStyle, width: "auto" }}
              disabled={!graph.enabled}
            >
              <option value="">+ New…</option>
              {allowedTypes.map((t) => (
                <option key={t} value={t}>{NODE_TYPE_CONFIGS[t].label}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "calc(100vh - 320px)", overflowY: "auto", paddingRight: 4 }}>
          {nodes.map((n) => (
            <button
              key={n.entityId}
              onClick={() => {
                setCreating(null);
                setSelected(n.entityId);
              }}
              style={{
                textAlign: "left",
                background: selected === n.entityId ? NODE_TYPE_CONFIGS[n.nodeType].color + "22" : COLORS.panel,
                border: `1px solid ${selected === n.entityId ? NODE_TYPE_CONFIGS[n.nodeType].color : COLORS.border}`,
                borderLeft: `3px solid ${NODE_TYPE_CONFIGS[n.nodeType].color}`,
                borderRadius: 8,
                padding: "9px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ flex: 1, color: COLORS.text, fontSize: 13 }}>
                {n.label}
                <span style={{ color: COLORS.faint, fontSize: 11, marginLeft: 8 }}>{n.entityId}</span>
              </span>
              {n.status !== "active" && <StatusBadge status={n.status} />}
              {n.overlaid && <StatusBadge status="proposed" />}
            </button>
          ))}
          {nodes.length === 0 && (
            <div style={{ color: COLORS.faint, padding: "30px 10px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 10 }}>
              No entities match.
            </div>
          )}
          {nodes.length === 400 && <div style={{ color: COLORS.faint, fontSize: 12, padding: 6 }}>Showing first 400 — refine your search.</div>}
        </div>
      </div>

      {showPanel && (
        <DetailPanel
          entityId={selected}
          newNodeType={creating ?? undefined}
          graph={graph}
          onClose={() => {
            setSelected(null);
            setCreating(null);
          }}
          onSaved={(msg) => {
            setCreating(null);
            onSaved(msg);
          }}
        />
      )}
    </div>
  );
}
