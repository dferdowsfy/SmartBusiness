"use client";

// ============================================================================
// Impact Analysis tab — preview what accepted proposals would change before
// publishing, plus TEST MODE: run a sample scenario (default Restaurant ·
// San Juan) against the current rules and the proposed rules side by side.
// Includes the historical Patterns & Intelligence panel (capture analytics).
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { Btn, COLORS, LAYER, inputStyle, labelStyle } from "../ui";
import type { EngineResult } from "../../../rulesEngine";

interface DiffEntry { id: string; label: string }
interface CollectionDiff { added: DiffEntry[]; removed: DiffEntry[]; changed: DiffEntry[] }
interface ImpactResponse {
  proposalsConsidered: number;
  diff: Record<string, CollectionDiff>;
  affectedBusinessTypes: string[];
  affectedMunicipalities: string[];
  readinessChanges: boolean;
  conflicts: string[];
  invalidRefs: string[];
  scenario: { input: { municipality: string; businessType: string }; before: EngineResult; after: EngineResult };
}

const COMMON_ANSWERS: { key: string; label: string }[] = [
  { key: "Q_FOOD_PREPARED", label: "Food prepared on-site" },
  { key: "Q_FOOD_SERVED", label: "Food served to customers" },
  { key: "Q_ALCOHOL_SOLD", label: "Alcohol sold" },
  { key: "Q_OUTDOOR_SEATING", label: "Outdoor seating" },
  { key: "Q_EMPLOYEES_HIRED", label: "Employees hired" },
  { key: "Q_SHORT_TERM_RENTAL", label: "Short-term rental" },
];

function ScenarioCompare({ before, after }: { before: EngineResult; after: EngineResult }) {
  const beforeIds = new Set(before.requirements.map((r) => r.document_id));
  const afterIds = new Set(after.requirements.map((r) => r.document_id));
  const col = (title: string, run: EngineResult, other: Set<string>, additions: boolean) => (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div style={{ ...labelStyle, marginBottom: 8 }}>{title} · {run.requirements.length} documents</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {run.requirements.map((r) => {
          const delta = !other.has(r.document_id);
          return (
            <div key={r.document_id} style={{
              background: delta ? (additions ? COLORS.green + "18" : COLORS.red + "14") : COLORS.panel2,
              border: `1px solid ${delta ? (additions ? COLORS.green : COLORS.red) + "66" : COLORS.border}`,
              borderLeft: `3px solid ${LAYER.document}`,
              borderRadius: 8, padding: "8px 12px",
            }}>
              <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>
                {r.document_name}
                {delta && <span style={{ color: additions ? "#a7f3d0" : "#fca5a5", fontSize: 11, marginLeft: 8 }}>{additions ? "NEW" : "REMOVED IN PROPOSAL"}</span>}
              </div>
              <div style={{ color: COLORS.dim, fontSize: 11.5 }}>{r.agency} · {r.reason}</div>
            </div>
          );
        })}
        {run.requirements.length === 0 && <span style={{ color: COLORS.faint, fontSize: 12 }}>No requirements generated.</span>}
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {col("Current rules (old result)", before, afterIds, false)}
      {col("Proposed rules (new result)", after, beforeIds, true)}
    </div>
  );
}

function PatternsPanel() {
  const [data, setData] = useState<{
    enabled: boolean;
    totalSubmissions: number;
    commonBusinessTypes: { business_type: string; submissions: number }[];
    commonDocuments: { document: string; times_required: number }[];
  } | null>(null);
  useEffect(() => {
    fetch("/api/graph/patterns").then((r) => r.json()).then(setData).catch(() => setData(null));
  }, []);
  if (!data?.enabled) return null;
  const bars = (rows: { label: string; n: number }[], color: string) => {
    const max = Math.max(...rows.map((r) => r.n), 1);
    return rows.slice(0, 8).map((r) => (
      <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <span style={{ flex: "0 0 200px", color: COLORS.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
        <span style={{ flex: 1, height: 8, background: COLORS.border, borderRadius: 4, overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${(r.n / max) * 100}%`, background: color }} />
        </span>
        <span style={{ color: COLORS.text, width: 36, textAlign: "right" }}>{r.n}</span>
      </div>
    ));
  };
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginTop: 20 }}>
      <div style={{ color: COLORS.text, fontWeight: 700, marginBottom: 4 }}>Patterns & Intelligence (execution history)</div>
      <div style={{ color: COLORS.faint, fontSize: 12, marginBottom: 12 }}>{data.totalSubmissions} captured submissions — which users and workflows a change would touch.</div>
      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div>
          <div style={labelStyle}>Most common business types</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {bars(data.commonBusinessTypes.map((b) => ({ label: b.business_type, n: b.submissions })), LAYER.businessType)}
          </div>
        </div>
        <div>
          <div style={labelStyle}>Most required documents</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {bars(data.commonDocuments.map((d) => ({ label: d.document, n: d.times_required })), LAYER.document)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImpactTab({ enabled }: { enabled: boolean }) {
  const [municipality, setMunicipality] = useState("San Juan");
  const [businessType, setBusinessType] = useState("Restaurant");
  const [answers, setAnswers] = useState<Record<string, boolean>>({ Q_FOOD_PREPARED: true, Q_FOOD_SERVED: true });
  const [result, setResult] = useState<ImpactResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rk/impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: { municipality, businessType, answers } }),
      });
      const data = await res.json();
      if (!res.ok) setError(String(data.error ?? "impact failed"));
      else setResult(data as ImpactResponse);
    } finally {
      setBusy(false);
    }
  }, [municipality, businessType, answers]);

  if (!enabled) {
    return (
      <div style={{ color: COLORS.faint, padding: "50px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
        Impact analysis needs a database. Set DATABASE_URL to enable it.
      </div>
    );
  }

  const diffLine = (name: string, d: CollectionDiff) => {
    const total = d.added.length + d.removed.length + d.changed.length;
    if (total === 0) return null;
    return (
      <div key={name} style={{ fontSize: 13, color: COLORS.dim, marginBottom: 6 }}>
        <span style={{ color: COLORS.text, fontWeight: 700, textTransform: "capitalize" }}>{name}: </span>
        {d.added.length > 0 && <span style={{ color: "#a7f3d0" }}>+{d.added.length} added ({d.added.slice(0, 4).map((e) => e.label).join(", ")}{d.added.length > 4 ? "…" : ""}) </span>}
        {d.changed.length > 0 && <span style={{ color: "#fcd34d" }}>~{d.changed.length} changed ({d.changed.slice(0, 4).map((e) => e.label).join(", ")}{d.changed.length > 4 ? "…" : ""}) </span>}
        {d.removed.length > 0 && <span style={{ color: "#fca5a5" }}>−{d.removed.length} removed ({d.removed.slice(0, 4).map((e) => e.label).join(", ")}{d.removed.length > 4 ? "…" : ""})</span>}
      </div>
    );
  };

  return (
    <div>
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ color: COLORS.text, fontWeight: 700, marginBottom: 4 }}>Impact preview</div>
        <p style={{ color: COLORS.dim, fontSize: 12.5, marginTop: 0 }}>
          Simulates publishing every ACCEPTED proposal: compiled current rules vs proposed rules,
          plus a live test scenario. Nothing is persisted.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={labelStyle}>Municipality</label>
            <input value={municipality} onChange={(e) => setMunicipality(e.target.value)} style={{ ...inputStyle, width: 180 }} />
          </div>
          <div>
            <label style={labelStyle}>Business type</label>
            <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} style={{ ...inputStyle, width: 200 }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {COMMON_ANSWERS.map((a) => (
              <label key={a.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: answers[a.key] ? COLORS.text : COLORS.dim, background: COLORS.panel2, border: `1px solid ${answers[a.key] ? COLORS.accent : COLORS.border}`, borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}>
                <input type="checkbox" checked={!!answers[a.key]} onChange={(e) => setAnswers((prev) => ({ ...prev, [a.key]: e.target.checked }))} style={{ display: "none" }} />
                {a.label}
              </label>
            ))}
          </div>
          <Btn primary disabled={busy} onClick={() => void run()}>{busy ? "Analyzing…" : "Run impact analysis"}</Btn>
        </div>
        {error && <div style={{ color: "#fca5a5", fontSize: 12.5, marginTop: 8 }}>{error}</div>}
      </div>

      {result && (
        <>
          <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ color: COLORS.text, fontWeight: 700, marginBottom: 8 }}>
              {result.proposalsConsidered} accepted proposal(s) considered
            </div>
            {Object.entries(result.diff).map(([k, v]) => diffLine(k, v))}
            {Object.values(result.diff).every((d) => d.added.length + d.removed.length + d.changed.length === 0) && (
              <div style={{ color: COLORS.faint, fontSize: 13 }}>No graph changes — accept proposals first, then re-run.</div>
            )}
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontSize: 12.5 }}>
              <span style={{ color: COLORS.dim }}>
                <b style={{ color: COLORS.text }}>Business workflows affected:</b> {result.affectedBusinessTypes.join(", ") || "none"}
              </span>
              <span style={{ color: COLORS.dim }}>
                <b style={{ color: COLORS.text }}>Municipalities affected:</b> {result.affectedMunicipalities.join(", ") || "none"}
              </span>
              <span style={{ color: result.readinessChanges ? COLORS.amber : COLORS.faint }}>
                Readiness scores {result.readinessChanges ? "WILL change" : "unchanged"}
              </span>
            </div>
            {result.conflicts.length > 0 && (
              <div style={{ color: "#fca5a5", fontSize: 12.5, marginTop: 8 }}>
                Conflicting rules: {result.conflicts.join("; ")}
              </div>
            )}
            {result.invalidRefs.length > 0 && (
              <div style={{ color: "#fca5a5", fontSize: 12.5, marginTop: 8 }}>
                Relationships that would become invalid:
                {result.invalidRefs.slice(0, 8).map((r) => <div key={r} style={{ marginLeft: 12 }}>• {r}</div>)}
              </div>
            )}
          </div>

          <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ color: COLORS.text, fontWeight: 700, marginBottom: 10 }}>
              Test mode: {result.scenario.input.businessType} · {result.scenario.input.municipality}
            </div>
            <ScenarioCompare before={result.scenario.before} after={result.scenario.after} />
          </div>
        </>
      )}

      <PatternsPanel />
    </div>
  );
}
