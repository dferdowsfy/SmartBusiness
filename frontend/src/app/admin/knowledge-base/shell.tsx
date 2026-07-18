"use client";

// ============================================================================
// Regulatory Knowledge Graph Admin — client shell.
//
// Top-level tabs: Graph · Requirements · Forms · Regulatory Sources ·
// Proposed Changes · Impact Analysis · Publications · Audit Log.
// A state indicator switches the working view: Live Rules / Draft Changes /
// Proposed Bill Preview (the "Proposed Future State" layer).
// ============================================================================

import { useState } from "react";
import { COLORS, KB_CSS, StatusBadge } from "./ui";
import { NODE_TYPE_CONFIGS } from "../../rk/registry";
import type { GraphMode } from "../../rk/types";
import { useGraphData } from "./graph/useGraphData";
import { GraphView } from "./graph/GraphView";
import { DetailPanel } from "./graph/DetailPanel";
import { RequirementsTab } from "./tabs/RequirementsTab";
import { SourcesTab } from "./tabs/SourcesTab";

const TABS = [
  { id: "graph", label: "Graph" },
  { id: "requirements", label: "Requirements" },
  { id: "forms", label: "Forms" },
  { id: "sources", label: "Regulatory Sources" },
  { id: "proposals", label: "Proposed Changes" },
  { id: "impact", label: "Impact Analysis" },
  { id: "publications", label: "Publications" },
  { id: "audit", label: "Audit Log" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const MODES: { id: GraphMode; label: string; hint: string }[] = [
  { id: "live", label: "Live Rules", hint: "What production users get today" },
  { id: "draft", label: "Draft Changes", hint: "Live + open manual/enacted proposals" },
  { id: "proposed", label: "Proposed Bill Preview", hint: "Future state from unenacted bills (e.g. PS 1173) — never affects live users" },
];

function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div style={{ color: COLORS.faint, padding: "60px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
      <div style={{ color: COLORS.dim, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {phase}
    </div>
  );
}

export default function KnowledgeBaseShell() {
  const [tab, setTab] = useState<TabId>("graph");
  const [mode, setMode] = useState<GraphMode>("live");
  const [inspected, setInspected] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const graph = useGraphData(mode);

  const saved = (msg: string) => {
    setToast(msg);
    setInspected(null);
    graph.refresh();
    window.setTimeout(() => setToast(null), 8000);
  };

  const counts = graph.graph?.counts ?? {};
  const stat = (t: keyof typeof NODE_TYPE_CONFIGS, label?: string) => (
    <span style={{ color: COLORS.dim, fontSize: 12, whiteSpace: "nowrap" }}>
      <span style={{ color: NODE_TYPE_CONFIGS[t].color, fontWeight: 800 }}>{counts[t] ?? 0}</span>{" "}
      {label ?? NODE_TYPE_CONFIGS[t].plural.toLowerCase()}
    </span>
  );

  return (
    <div className="kbadmin" style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: KB_CSS }} />
      <div style={{ background: COLORS.purple, padding: "6px 24px", fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>
        ADMIN — REGULATORY KNOWLEDGE GRAPH — INTERNAL USE ONLY
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: COLORS.text, margin: 0 }}>Regulatory Knowledge Graph</h1>
            <p style={{ color: COLORS.dim, fontSize: 13, margin: "4px 0 0" }}>
              Puerto Rico business permits & licenses — edit requirements, ingest regulations, review
              proposed changes, and publish versioned updates.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
              {stat("municipality")}
              {stat("business_type")}
              {stat("intake_question", "questions")}
              {stat("document", "documents & permits")}
              {stat("rule", "rules")}
              {stat("agency", "agencies")}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", gap: 6, background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 999, padding: 4 }}>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  title={m.hint}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "7px 14px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: mode === m.id ? (m.id === "live" ? COLORS.green : m.id === "draft" ? COLORS.amber : COLORS.purple) + "33" : "transparent",
                    color: mode === m.id ? COLORS.text : COLORS.faint,
                    outline: mode === m.id ? `1px solid ${m.id === "live" ? COLORS.green : m.id === "draft" ? COLORS.amber : COLORS.purple}` : "none",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div style={{ color: COLORS.faint, fontSize: 11, marginTop: 4, textAlign: "right" }}>
              {MODES.find((m) => m.id === mode)?.hint}
            </div>
          </div>
        </div>

        {!graph.enabled && !graph.loading && (
          <div style={{ background: COLORS.amber + "15", border: `1px solid ${COLORS.amber}55`, color: "#fcd34d", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
            No database connected — showing the bundled knowledge base, read-only.
            {graph.error ? ` (${graph.error})` : ""} Set DATABASE_URL to enable editing, ingestion, and publishing.
          </div>
        )}

        {toast && (
          <div style={{ background: COLORS.green + "18", border: `1px solid ${COLORS.green}66`, color: "#a7f3d0", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14, display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span>{toast}</span>
            <span role="button" onClick={() => setToast(null)} style={{ cursor: "pointer", color: COLORS.faint }}>✕</span>
          </div>
        )}

        <div className="kb-tabs">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`kb-tab ${tab === t.id ? "active" : ""}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "graph" && (
          <div className={inspected ? "kb-split detail" : undefined}>
            <div>
              {graph.loading && !graph.graph ? (
                <div style={{ color: COLORS.faint, padding: 60, textAlign: "center" }}>Loading graph…</div>
              ) : graph.graph ? (
                <GraphView graph={graph.graph} onInspect={(id) => setInspected(id)} />
              ) : null}
              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ color: COLORS.faint, fontSize: 12 }}>Legend:</span>
                <StatusBadge status="active" />
                <StatusBadge status="proposed" />
                <StatusBadge status="superseded" />
                <StatusBadge status="archived" />
                <span style={{ color: COLORS.faint, fontSize: 12 }}>
                  Relationships: business type → belongs to industry · asks questions; rule → requires
                  document · applies to business type/question; document → issued by agency.
                </span>
              </div>
            </div>
            {inspected && (
              <DetailPanel entityId={inspected} graph={graph} onClose={() => setInspected(null)} onSaved={saved} />
            )}
          </div>
        )}

        {tab === "requirements" && <RequirementsTab graph={graph} onSaved={saved} />}
        {tab === "forms" && <Placeholder title="Forms" phase="Form template editing (fields, signatures, attachments, validation rules, versions) arrives with the Forms milestone." />}
        {tab === "sources" && <SourcesTab enabled={graph.enabled} onProposals={() => setTab("proposals")} />}
        {tab === "proposals" && <Placeholder title="Proposed Changes" phase="Review queue with side-by-side diffs, confidence, citations, and accept / edit / reject / defer / legal-review / merge — arrives with the review milestone." />}
        {tab === "impact" && <Placeholder title="Impact Analysis" phase="Impact preview + test mode (e.g. Restaurant · San Juan, before vs after) — arrives with the impact milestone." />}
        {tab === "publications" && <Placeholder title="Publications" phase="Approve → schedule → publish → rollback with full version history — arrives with the publication milestone." />}
        {tab === "audit" && <Placeholder title="Audit Log" phase="Complete change history with actor, timestamps, and before/after — arrives with the publication milestone." />}
      </div>
    </div>
  );
}
