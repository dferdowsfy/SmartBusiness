"use client";

import { useEffect, useMemo, useState } from "react";
import { runRulesEngine } from "../../rulesEngine";
import {
  KB,
  municipalities,
  industries,
  businessTypes,
  questions,
  documents,
  rules,
  FLAG_COLORS,
  flagLabel,
  questionsForBusinessType,
  businessTypesForIndustry,
  universalDocuments,
  documentsForBusinessType,
  businessTypesRequiringDocument,
  triggersForDocument,
  questionsTriggeringDocument,
  documentsForQuestion,
  agenciesForDocuments,
  industryById,
  type DocumentRec,
  type BusinessType,
  type Question,
} from "../knowledgeGraph";

// ===========================================================================
// Shared visual primitives
// ===========================================================================
const COLORS = {
  bg: "#0b1220",
  panel: "#101a2e",
  panel2: "#0f1626",
  border: "#1e2a44",
  text: "#e8eef7",
  dim: "#94a3b8",
  faint: "#64748b",
  accent: "#3b82f6",
  green: "#10b981",
  amber: "#f59e0b",
  purple: "#8b5cf6",
};

// Node colors per layer of the knowledge graph
const LAYER = {
  municipality: "#06b6d4",
  industry: "#8b5cf6",
  businessType: "#3b82f6",
  question: "#f59e0b",
  rule: "#ec4899",
  document: "#10b981",
  validation: "#a16207",
  readiness: "#22c55e",
};

function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ background: (color || COLORS.faint) + "22", color: color || COLORS.dim, border: `1px solid ${(color || COLORS.faint)}55`, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600, display: "inline-block", margin: "2px 4px 2px 0", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Arrow() {
  return <div style={{ textAlign: "center", color: COLORS.faint, fontSize: 18, lineHeight: 1, padding: "4px 0" }}>↓</div>;
}

function FlowNode({ label, sublabel, color }: { label: string; sublabel?: string; color: string }) {
  return (
    <div style={{ background: color + "1a", border: `1px solid ${color}66`, borderLeft: `4px solid ${color}`, borderRadius: 10, padding: "12px 18px", textAlign: "center", maxWidth: 460, margin: "0 auto", width: "100%" }}>
      <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 15 }}>{label}</div>
      {sublabel && <div style={{ color: COLORS.dim, fontSize: 12, marginTop: 2 }}>{sublabel}</div>}
    </div>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderTop: accent ? `3px solid ${accent}` : undefined, borderRadius: 12, padding: 18, marginBottom: 16 }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, color }: { children: React.ReactNode; color?: string }) {
  return <div style={{ color: color || COLORS.text, fontWeight: 700, fontSize: 14, marginBottom: 12, letterSpacing: 0.2 }}>{children}</div>;
}

const selectStyle: React.CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  background: COLORS.panel2,
  color: COLORS.text,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  width: "100%",
};

const labelStyle: React.CSSProperties = { display: "block", color: COLORS.dim, fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 };

const triggerColor = (t: string) =>
  t === "universal" ? COLORS.faint : t === "business_type" ? LAYER.businessType : t === "question" ? LAYER.question : LAYER.municipality;
const triggerLabel = (t: string) =>
  t === "universal" ? "Baseline" : t === "business_type" ? "Business Type" : t === "question" ? "Your Answer" : "Location";

// ===========================================================================
// 1. OVERVIEW
// ===========================================================================
function OverviewTab() {
  const metrics = [
    { label: "Municipalities", value: municipalities.length, color: LAYER.municipality },
    { label: "Industries", value: industries.length, color: LAYER.industry },
    { label: "Business Types", value: businessTypes.length, color: LAYER.businessType },
    { label: "Discovery Questions", value: questions.length, color: LAYER.question },
    { label: "Documents", value: documents.length, color: LAYER.document },
    { label: "Connections", value: rules.length, color: LAYER.rule },
  ];

  const flow = [
    { label: "Municipality", sub: "Where the business operates", color: LAYER.municipality },
    { label: "Industry", sub: "The sector it belongs to", color: LAYER.industry },
    { label: "Business Type", sub: "What the business actually does", color: LAYER.businessType },
    { label: "Discovery Questions", sub: "Tell us about your operations", color: LAYER.question },
    { label: "Requirements Triggered", sub: "Rules that apply to your answers", color: LAYER.rule },
    { label: "Required Documents", sub: "Permits & licenses you need", color: LAYER.document },
    { label: "Validation", sub: "Confirm each document is in order", color: LAYER.validation },
    { label: "Readiness Score", sub: "How prepared you are to operate", color: LAYER.readiness },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 12, color: COLORS.dim, marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      <Card accent={COLORS.accent}>
        <SectionTitle>How SmartPR Determines What You Need</SectionTitle>
        <p style={{ color: COLORS.dim, fontSize: 13, marginTop: -4, marginBottom: 18 }}>
          Every requirement flows through the same chain. Follow it top to bottom to understand how a single permit is determined.
        </p>
        {flow.map((f, i) => (
          <div key={f.label}>
            <FlowNode label={f.label} sublabel={f.sub} color={f.color} />
            {i < flow.length - 1 && <Arrow />}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ===========================================================================
// 2. REQUIREMENTS FLOW
// ===========================================================================
function RequirementsFlowTab() {
  const [btId, setBtId] = useState("");
  const bt = btId ? businessTypes.find((b) => b.id === btId) : null;

  const data = useMemo(() => {
    if (!bt) return null;
    const qs = questionsForBusinessType(bt.id);
    const docs = documentsForBusinessType(bt.id);
    return { qs, docs };
  }, [bt]);

  return (
    <div>
      <label style={labelStyle}>Choose a business type to trace its requirements</label>
      <select value={btId} onChange={(e) => setBtId(e.target.value)} style={{ ...selectStyle, maxWidth: 460, marginBottom: 24 }}>
        <option value="">Select a business type…</option>
        {[...businessTypes].sort((a, b) => a.name.localeCompare(b.name)).map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>

      {!bt && (
        <div style={{ color: COLORS.faint, padding: "40px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
          Pick a business type to see the full chain — from the questions we ask, to the rules they trigger, to the documents required.
        </div>
      )}

      {bt && data && (
        <div>
          <FlowNode label={bt.name} sublabel={industryById[bt.industry_id]?.name} color={LAYER.businessType} />
          <Arrow />

          <Card accent={LAYER.question}>
            <SectionTitle color={LAYER.question}>Questions We Ask ({data.qs.length})</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {data.qs.map((q) => (
                <div key={q.id} style={{ background: LAYER.question + "14", border: `1px solid ${LAYER.question}44`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: COLORS.text, maxWidth: 320 }}>
                  {q.question}
                </div>
              ))}
              {data.qs.length === 0 && <span style={{ color: COLORS.faint }}>No additional discovery questions for this type.</span>}
            </div>
          </Card>
          <Arrow />

          <Card accent={LAYER.rule}>
            <SectionTitle color={LAYER.rule}>What That Triggers ({data.docs.length} requirements)</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.docs.map((d) => (
                <div key={d.document.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: COLORS.dim }}>
                  <span style={{ color: triggerColor(d.triggerType) }}>•</span>
                  <span style={{ color: COLORS.text }}>{d.reason}</span>
                </div>
              ))}
            </div>
          </Card>
          <Arrow />

          <Card accent={LAYER.document}>
            <SectionTitle color={LAYER.document}>Documents Required ({data.docs.length})</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {data.docs.map((d) => (
                <div key={d.document.id} style={{ background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 13 }}>{d.document.name}</div>
                  <div style={{ color: COLORS.dim, fontSize: 12, marginTop: 2 }}>{d.document.agency}</div>
                  <div style={{ marginTop: 6 }}><Pill color={triggerColor(d.triggerType)}>{triggerLabel(d.triggerType)}</Pill></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// 3. KNOWLEDGE GRAPH (interactive column traversal)
// ===========================================================================
function GraphColumn({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 220, flex: "1 1 220px" }}>
      <div style={{ color, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10, paddingLeft: 4 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function GraphNode({ label, color, active, dim, onClick }: { label: string; color: string; active?: boolean; dim?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: active ? color + "33" : COLORS.panel2,
        border: `1px solid ${active ? color : COLORS.border}`,
        borderLeft: `3px solid ${color}`,
        color: dim ? COLORS.faint : COLORS.text,
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 13,
        cursor: onClick ? "pointer" : "default",
        opacity: dim ? 0.45 : 1,
        transition: "all .12s",
      }}
    >
      {label}
    </button>
  );
}

function KnowledgeGraphTab() {
  const [industryId, setIndustryId] = useState("");
  const [btId, setBtId] = useState("");
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);

  const bts = industryId ? businessTypesForIndustry(industryId) : [];
  const bt = btId ? businessTypes.find((b) => b.id === btId) : null;
  const qs = bt ? questionsForBusinessType(bt.id) : [];
  const docs = bt ? documentsForBusinessType(bt.id) : [];

  // When a question node is active, highlight the documents it triggers.
  const triggeredDocIds = activeQuestion ? new Set(documentsForQuestion(activeQuestion).map((d) => d.id)) : null;

  return (
    <div>
      <p style={{ color: COLORS.dim, fontSize: 13, marginBottom: 18 }}>
        Traverse the knowledge graph left to right. Pick an industry, then a business type, to reveal the questions and documents connected to it. Click a question to highlight the documents it triggers.
      </p>
      <div style={{ display: "flex", gap: 18, overflowX: "auto", paddingBottom: 8 }}>
        <GraphColumn title="Industry" color={LAYER.industry}>
          {[...industries].sort((a, b) => a.name.localeCompare(b.name)).map((i) => (
            <GraphNode key={i.id} label={i.name} color={LAYER.industry} active={industryId === i.id}
              onClick={() => { setIndustryId(i.id); setBtId(""); setActiveQuestion(null); }} />
          ))}
        </GraphColumn>

        <GraphColumn title="Business Type" color={LAYER.businessType}>
          {industryId === "" && <span style={{ color: COLORS.faint, fontSize: 12, padding: 4 }}>← Select an industry</span>}
          {bts.map((b) => (
            <GraphNode key={b.id} label={b.name} color={LAYER.businessType} active={btId === b.id}
              onClick={() => { setBtId(b.id); setActiveQuestion(null); }} />
          ))}
        </GraphColumn>

        <GraphColumn title="Questions" color={LAYER.question}>
          {!bt && <span style={{ color: COLORS.faint, fontSize: 12, padding: 4 }}>← Select a business type</span>}
          {qs.map((q) => (
            <GraphNode key={q.id} label={q.question} color={LAYER.question} active={activeQuestion === q.id}
              onClick={() => setActiveQuestion(activeQuestion === q.id ? null : q.id)} />
          ))}
        </GraphColumn>

        <GraphColumn title="Documents" color={LAYER.document}>
          {!bt && <span style={{ color: COLORS.faint, fontSize: 12, padding: 4 }}>← Select a business type</span>}
          {docs.map((d) => {
            const dimmed = triggeredDocIds !== null && !triggeredDocIds.has(d.document.id);
            const highlighted = triggeredDocIds !== null && triggeredDocIds.has(d.document.id);
            return (
              <GraphNode key={d.document.id} label={d.document.name} color={LAYER.document} active={highlighted} dim={dimmed} />
            );
          })}
        </GraphColumn>
      </div>

      {bt && (
        <div style={{ marginTop: 20, color: COLORS.faint, fontSize: 12 }}>
          Showing the graph for <span style={{ color: COLORS.text }}>{bt.name}</span> — {qs.length} questions, {docs.length} possible documents.
          {activeQuestion && <> Highlighting documents triggered by the selected question.</>}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// 4. MUNICIPALITIES
// ===========================================================================
function MunicipalitiesTab() {
  const [id, setId] = useState("");
  const m = id ? municipalities.find((x) => x.id === id) : null;
  const universal = universalDocuments();

  // Documents triggered by this municipality's flags.
  const flagDocs = useMemo(() => {
    if (!m) return [];
    const out: { doc: DocumentRec; flag: string; businessType?: string }[] = [];
    const seen = new Set<string>();
    for (const r of rules.filter((r) => r.rule_type === "municipality_flag" && r.municipality_flag && m.flags.includes(r.municipality_flag))) {
      const key = r.requires_document_id + "|" + r.municipality_flag + "|" + (r.business_type_id || "");
      if (seen.has(key)) continue;
      seen.add(key);
      const d = documents.find((d) => d.id === r.requires_document_id);
      if (!d) continue;
      const btName = r.business_type_id ? businessTypes.find((b) => b.id === r.business_type_id)?.name : undefined;
      out.push({ doc: d, flag: r.municipality_flag as string, businessType: btName });
    }
    return out;
  }, [m]);

  return (
    <div>
      <label style={labelStyle}>Select a municipality</label>
      <select value={id} onChange={(e) => setId(e.target.value)} style={{ ...selectStyle, maxWidth: 460, marginBottom: 24 }}>
        <option value="">Select a municipality…</option>
        {[...municipalities].sort((a, b) => a.name.localeCompare(b.name)).map((x) => (
          <option key={x.id} value={x.id}>{x.name}</option>
        ))}
      </select>

      {!m && (
        <div style={{ color: COLORS.faint, padding: "40px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
          Choose a municipality to see its characteristics and the location-specific requirements it adds.
        </div>
      )}

      {m && (
        <div>
          <Card accent={LAYER.municipality}>
            <SectionTitle color={LAYER.municipality}>{m.name}</SectionTitle>
            <div style={{ marginBottom: 4, color: COLORS.dim, fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Characteristics</div>
            <div>
              {m.flags.length === 0 ? <span style={{ color: COLORS.faint }}>No special designations</span> :
                m.flags.map((f) => <Pill key={f} color={FLAG_COLORS[f]}>{flagLabel(f)}</Pill>)}
            </div>
          </Card>

          <Card accent={LAYER.document}>
            <SectionTitle color={LAYER.document}>Baseline Requirements (every business)</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {universal.map((d) => (
                <div key={d.id} style={{ background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                  <div style={{ color: COLORS.dim, fontSize: 12 }}>{d.agency}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card accent={LAYER.municipality}>
            <SectionTitle color={LAYER.municipality}>Location-Specific Requirements</SectionTitle>
            {flagDocs.length === 0 ? (
              <span style={{ color: COLORS.faint, fontSize: 13 }}>This municipality adds no special requirements beyond the baseline.</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {flagDocs.map((fd, i) => (
                  <div key={i} style={{ background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 13 }}>{fd.doc.name}</div>
                    <div style={{ color: COLORS.dim, fontSize: 12, marginTop: 2 }}>{fd.doc.agency}</div>
                    <div style={{ marginTop: 6 }}>
                      <Pill color={FLAG_COLORS[fd.flag]}>{flagLabel(fd.flag)}</Pill>
                      {fd.businessType && <Pill color={LAYER.businessType}>{fd.businessType}</Pill>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// 5. BUSINESS TYPES
// ===========================================================================
function BusinessTypesTab() {
  const [search, setSearch] = useState("");
  const [btId, setBtId] = useState("");
  const bt = btId ? businessTypes.find((b) => b.id === btId) : null;
  const filtered = [...businessTypes].sort((a, b) => a.name.localeCompare(b.name))
    .filter((b) => !search || b.name.toLowerCase().includes(search.toLowerCase()));

  const qs = bt ? questionsForBusinessType(bt.id) : [];
  const docs = bt ? documentsForBusinessType(bt.id) : [];
  const agencies = agenciesForDocuments(docs.map((d) => d.document));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
      <div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business types…" style={{ ...selectStyle, marginBottom: 10 }} />
        <div style={{ maxHeight: 540, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map((b) => (
            <button key={b.id} onClick={() => setBtId(b.id)} style={{
              textAlign: "left", background: btId === b.id ? LAYER.businessType + "26" : COLORS.panel2,
              border: `1px solid ${btId === b.id ? LAYER.businessType : COLORS.border}`, borderRadius: 8,
              padding: "9px 12px", fontSize: 13, color: COLORS.text, cursor: "pointer",
            }}>
              {b.name}
              <div style={{ color: COLORS.faint, fontSize: 11 }}>{industryById[b.industry_id]?.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        {!bt && (
          <div style={{ color: COLORS.faint, padding: "40px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
            Select a business type to see its industry, the questions asked, and the documents required.
          </div>
        )}
        {bt && (
          <div>
            <Card accent={LAYER.businessType}>
              <SectionTitle color={LAYER.businessType}>{bt.name}</SectionTitle>
              {bt.description && <p style={{ color: COLORS.dim, fontSize: 13, marginTop: -4 }}>{bt.description}</p>}
              <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" }}>
                <Stat label="Industry" value={industryById[bt.industry_id]?.name || "—"} color={LAYER.industry} />
                <Stat label="Questions" value={String(qs.length)} color={LAYER.question} />
                <Stat label="Documents" value={String(docs.length)} color={LAYER.document} />
                <Stat label="Agencies" value={String(agencies.length)} color={COLORS.accent} />
              </div>
            </Card>

            <Card accent={LAYER.question}>
              <SectionTitle color={LAYER.question}>Questions Asked</SectionTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {qs.map((q) => <Pill key={q.id} color={LAYER.question}>{q.question}</Pill>)}
                {qs.length === 0 && <span style={{ color: COLORS.faint }}>No additional questions.</span>}
              </div>
            </Card>

            <Card accent={LAYER.document}>
              <SectionTitle color={LAYER.document}>Documents Required</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {docs.map((d) => (
                  <div key={d.document.id} style={{ background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ color: COLORS.text, fontWeight: 600, fontSize: 13 }}>{d.document.name}</span>
                      <span style={{ color: COLORS.dim, fontSize: 12 }}>{d.document.agency}</span>
                    </div>
                    <div style={{ color: COLORS.faint, fontSize: 12, marginTop: 3 }}>{d.reason}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: COLORS.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

// ===========================================================================
// 6. DOCUMENTS (Requirements Engine view — replaces Rules + Validation tabs)
// ===========================================================================
function DocumentsTab() {
  const [search, setSearch] = useState("");
  const [docId, setDocId] = useState("");
  const doc = docId ? documents.find((d) => d.id === docId) : null;
  const filtered = [...documents].sort((a, b) => a.name.localeCompare(b.name))
    .filter((d) => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.agency.toLowerCase().includes(search.toLowerCase()));

  const requiredBy = doc ? businessTypesRequiringDocument(doc.id) : [];
  const triggers = doc ? triggersForDocument(doc.id) : [];
  const triggerQuestions = doc ? questionsTriggeringDocument(doc.id) : [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
      <div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…" style={{ ...selectStyle, marginBottom: 10 }} />
        <div style={{ maxHeight: 540, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map((d) => (
            <button key={d.id} onClick={() => setDocId(d.id)} style={{
              textAlign: "left", background: docId === d.id ? LAYER.document + "26" : COLORS.panel2,
              border: `1px solid ${docId === d.id ? LAYER.document : COLORS.border}`, borderRadius: 8,
              padding: "9px 12px", fontSize: 13, color: COLORS.text, cursor: "pointer",
            }}>
              {d.name}
              <div style={{ color: COLORS.faint, fontSize: 11 }}>{d.agency}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        {!doc && (
          <div style={{ color: COLORS.faint, padding: "40px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
            Select a document to see which agency issues it, who needs it, and exactly what triggers the requirement.
          </div>
        )}
        {doc && (
          <div>
            <Card accent={LAYER.document}>
              <SectionTitle color={LAYER.document}>{doc.name}</SectionTitle>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <Stat label="Issuing Agency" value={doc.agency} color={COLORS.accent} />
                <Stat label="Level" value={doc.category} color={LAYER.industry} />
                <Stat label="Required By" value={`${requiredBy.length} types`} color={LAYER.businessType} />
              </div>
            </Card>

            <Card accent={LAYER.rule}>
              <SectionTitle color={LAYER.rule}>Required Because</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {triggers.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Pill color={triggerColor(t.triggerType)}>{triggerLabel(t.triggerType)}</Pill>
                    <span style={{ color: COLORS.text, fontSize: 13 }}>{t.reason}</span>
                  </div>
                ))}
              </div>
            </Card>

            {triggerQuestions.length > 0 && (
              <Card accent={LAYER.question}>
                <SectionTitle color={LAYER.question}>Triggered By These Answers</SectionTitle>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {triggerQuestions.map((q) => <Pill key={q.id} color={LAYER.question}>{q.question} → Yes</Pill>)}
                </div>
              </Card>
            )}

            <Card accent={LAYER.businessType}>
              <SectionTitle color={LAYER.businessType}>Who Needs This ({requiredBy.length})</SectionTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {requiredBy.length === 0 ? <span style={{ color: COLORS.faint }}>Required for all businesses (baseline).</span> :
                  requiredBy.map((b) => <Pill key={b.id} color={LAYER.businessType}>{b.name}</Pill>)}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// 7. SIMULATOR (Requirements Simulator — plain English, live)
// ===========================================================================
function SimulatorTab() {
  const [municipalityName, setMunicipalityName] = useState("");
  const [industryId, setIndustryId] = useState("");
  const [btId, setBtId] = useState("");
  const [answers, setAnswers] = useState<Record<string, boolean | string>>({});

  const bts = industryId ? businessTypesForIndustry(industryId) : [];
  const bt = btId ? businessTypes.find((b) => b.id === btId) : null;
  const relevantQuestions: Question[] = bt ? questionsForBusinessType(bt.id) : [];

  const result = useMemo(() => {
    if (!bt) return null;
    return runRulesEngine(KB, {
      municipalityName: municipalityName || null,
      businessTypeName: bt.name,
      answers,
    });
  }, [bt, municipalityName, answers]);

  const agencies = result ? [...new Set(result.requirements.map((r) => r.agency).filter(Boolean))] : [];

  const setBoolean = (qid: string, val: boolean) => setAnswers((p) => ({ ...p, [qid]: val }));
  const setSelect = (qid: string, val: string) => setAnswers((p) => ({ ...p, [qid]: val }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 24 }}>
      {/* Controls */}
      <div>
        <Card>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Municipality</label>
            <select value={municipalityName} onChange={(e) => setMunicipalityName(e.target.value)} style={selectStyle}>
              <option value="">Select…</option>
              {[...municipalities].sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
                <option key={m.id} value={m.name}>{m.name}{m.flags.length ? ` — ${m.flags.map(flagLabel).join(", ")}` : ""}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Industry</label>
            <select value={industryId} onChange={(e) => { setIndustryId(e.target.value); setBtId(""); setAnswers({}); }} style={selectStyle}>
              <option value="">Select…</option>
              {[...industries].sort((a, b) => a.name.localeCompare(b.name)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Business Type</label>
            <select value={btId} onChange={(e) => { setBtId(e.target.value); setAnswers({}); }} style={selectStyle} disabled={!industryId}>
              <option value="">{industryId ? "Select…" : "Choose an industry first"}</option>
              {bts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </Card>

        {bt && (
          <Card accent={LAYER.question}>
            <SectionTitle color={LAYER.question}>Tell Us About Your Operations</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 420, overflowY: "auto" }}>
              {relevantQuestions.map((q) => (
                <div key={q.id}>
                  <div style={{ color: COLORS.text, fontSize: 13, marginBottom: 6 }}>{q.question}</div>
                  {q.type === "boolean" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <ToggleBtn active={answers[q.id] === true} onClick={() => setBoolean(q.id, true)} label="Yes" color={COLORS.green} />
                      <ToggleBtn active={answers[q.id] === false || answers[q.id] === undefined} onClick={() => setBoolean(q.id, false)} label="No" color={COLORS.faint} />
                    </div>
                  )}
                  {(q.type === "single_select" || q.type === "multi_select") && (
                    <select value={(answers[q.id] as string) || ""} onChange={(e) => setSelect(q.id, e.target.value)} style={{ ...selectStyle, padding: "7px 10px", fontSize: 13 }}>
                      <option value="">Select…</option>
                      {(q.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </div>
              ))}
              {relevantQuestions.length === 0 && <span style={{ color: COLORS.faint, fontSize: 13 }}>No additional questions for this type.</span>}
            </div>
          </Card>
        )}
      </div>

      {/* Live results */}
      <div>
        {!bt && (
          <div style={{ color: COLORS.faint, padding: "60px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
            Build a scenario on the left. As you choose a location, business type, and answer questions, your live readiness profile appears here.
          </div>
        )}
        {bt && result && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 16 }}>
              <ResultStat value={result.requirements.length} label="Documents Required" color={LAYER.document} />
              <ResultStat value={agencies.length} label="Agencies Involved" color={COLORS.accent} />
              <ResultStat value={result.debug.questionsTriggered.length} label="Answers That Mattered" color={LAYER.question} />
              <ResultStat value={result.debug.municipalityFlags.length} label="Location Factors" color={LAYER.municipality} />
            </div>

            {result.debug.municipalityFlags.length > 0 && (
              <Card accent={LAYER.municipality}>
                <SectionTitle color={LAYER.municipality}>Location Factors</SectionTitle>
                <div>{result.debug.municipalityFlags.map((f) => <Pill key={f} color={FLAG_COLORS[f]}>{flagLabel(f)}</Pill>)}</div>
              </Card>
            )}

            <Card accent={LAYER.document}>
              <SectionTitle color={LAYER.document}>Required Documents</SectionTitle>
              {result.requirements.length === 0 ? (
                <span style={{ color: COLORS.faint }}>No documents required yet — answer more questions.</span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.requirements.map((r) => (
                    <div key={r.document_id} style={{ background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ color: COLORS.text, fontWeight: 600, fontSize: 13 }}>{r.document_name}</span>
                        <span style={{ color: COLORS.dim, fontSize: 12 }}>{r.agency}</span>
                      </div>
                      <div style={{ color: COLORS.faint, fontSize: 12, marginTop: 3 }}>{humanizeReason(r.reason)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {agencies.length > 0 && (
              <Card accent={COLORS.accent}>
                <SectionTitle color={COLORS.accent}>Agencies You&apos;ll Work With</SectionTitle>
                <div>{agencies.map((a) => <Pill key={a} color={COLORS.accent}>{a}</Pill>)}</div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleBtn({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: string }) {
  return (
    <button onClick={onClick} style={{
      background: active ? color + "33" : COLORS.panel2, border: `1px solid ${active ? color : COLORS.border}`,
      color: active ? COLORS.text : COLORS.dim, borderRadius: 8, padding: "6px 18px", fontSize: 13, cursor: "pointer", fontWeight: 600,
    }}>{label}</button>
  );
}

function ResultStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: COLORS.dim }}>{label}</div>
    </div>
  );
}

// Strip any leftover internal phrasing from engine reasons into plain English.
function humanizeReason(reason: string): string {
  if (reason.startsWith("Question:")) {
    const q = reason.replace(/^Question:\s*/, "").split("|")[0].trim();
    return `Because you answered "Yes" to: ${q}`;
  }
  if (reason.startsWith("Municipality Flag")) {
    return reason.replace("Municipality Flag =", "Location characteristic:");
  }
  if (reason.startsWith("Municipality selected")) {
    return "Required for every registered business";
  }
  if (reason.startsWith("Business Type =")) {
    return "Required for this type of business";
  }
  return reason;
}

// ===========================================================================
// 8. PATTERNS & INTELLIGENCE (captured knowledge graph — observational)
// ===========================================================================
interface PatternsData {
  enabled: boolean;
  error?: string;
  totalSubmissions: number;
  commonBusinessTypes: { business_type: string; submissions: number }[];
  commonDocuments: { document: string; agency: string; times_required: number }[];
  validationFailures: { document_type: string; failures: number }[];
  topScenarios: { municipality: string; business_type: string; occurrence_count: number; sample_documents: string[]; last_seen: string }[];
}

function RankBars({ rows, labelKey, valueKey, color }: { rows: Record<string, unknown>[]; labelKey: string; valueKey: string; color: string }) {
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey]) || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.length === 0 && <span style={{ color: COLORS.faint, fontSize: 13 }}>No data captured yet.</span>}
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 240, fontSize: 13, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(r[labelKey] ?? "—")}</div>
          <div style={{ flex: 1, background: COLORS.panel2, borderRadius: 6, overflow: "hidden", height: 22, position: "relative" }}>
            <div style={{ width: `${(Number(r[valueKey]) / max) * 100}%`, background: color + "cc", height: "100%", borderRadius: 6 }} />
            <span style={{ position: "absolute", right: 8, top: 2, fontSize: 12, color: COLORS.text, fontWeight: 600 }}>{Number(r[valueKey])}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PatternsTab() {
  const [data, setData] = useState<PatternsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/graph/patterns")
      .then((r) => r.json())
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <div style={{ color: COLORS.faint, padding: 40, textAlign: "center" }}>Loading captured history…</div>;

  if (!data || !data.enabled) {
    return (
      <Card accent={COLORS.amber}>
        <SectionTitle color={COLORS.amber}>Capture Not Yet Connected</SectionTitle>
        <p style={{ color: COLORS.dim, fontSize: 13 }}>
          The capture layer is active in the app, but the database is not reachable yet, so nothing is being stored.
          Once <code style={{ color: COLORS.text }}>DATABASE_URL</code> is set (Supabase), every completed intake, document
          validation, and readiness outcome accumulates here.
        </p>
        <p style={{ color: COLORS.faint, fontSize: 12, marginTop: 8 }}>
          Execution history only — the JSON rules engine stays the source of truth and is never modified.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <p style={{ color: COLORS.dim, fontSize: 13, marginBottom: 16 }}>
        A growing record of real scenarios processed by SmartPR. Observational only — it never changes the rules engine.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: LAYER.businessType }}>{data.totalSubmissions}</div>
          <div style={{ fontSize: 12, color: COLORS.dim, marginTop: 2 }}>Total Submissions</div>
        </div>
      </div>

      <Card accent={LAYER.businessType}>
        <SectionTitle color={LAYER.businessType}>Most Common Business Types</SectionTitle>
        <RankBars rows={data.commonBusinessTypes} labelKey="business_type" valueKey="submissions" color={LAYER.businessType} />
      </Card>

      <Card accent={LAYER.document}>
        <SectionTitle color={LAYER.document}>Most Common Documents Required</SectionTitle>
        <RankBars rows={data.commonDocuments} labelKey="document" valueKey="times_required" color={LAYER.document} />
      </Card>

      <Card accent={COLORS.amber}>
        <SectionTitle color={COLORS.amber}>Most Common Validation Failures</SectionTitle>
        <RankBars rows={data.validationFailures} labelKey="document_type" valueKey="failures" color={COLORS.amber} />
      </Card>

      <Card accent={LAYER.rule}>
        <SectionTitle color={LAYER.rule}>Most Common Scenarios</SectionTitle>
        {data.topScenarios.length === 0 ? (
          <span style={{ color: COLORS.faint, fontSize: 13 }}>No scenarios captured yet.</span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.topScenarios.map((sc, i) => (
              <div key={i} style={{ background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Pill color={LAYER.rule}>{sc.occurrence_count}x</Pill>
                  <span style={{ color: COLORS.text, fontWeight: 600, fontSize: 13 }}>{sc.business_type || "—"}</span>
                  {sc.municipality && <span style={{ color: COLORS.dim, fontSize: 12 }}>in {sc.municipality}</span>}
                </div>
                {Array.isArray(sc.sample_documents) && sc.sample_documents.length > 0 && (
                  <div style={{ color: COLORS.faint, fontSize: 12, marginTop: 4 }}>
                    {sc.sample_documents.slice(0, 6).join(" · ")}{sc.sample_documents.length > 6 ? " …" : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ===========================================================================
// MAIN PAGE
// ===========================================================================
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "flow", label: "Requirements Flow" },
  { id: "graph", label: "Knowledge Graph" },
  { id: "municipalities", label: "Municipalities" },
  { id: "businessTypes", label: "Business Types" },
  { id: "documents", label: "Requirements Engine" },
  { id: "simulator", label: "Simulator" },
  { id: "patterns", label: "Patterns & Intelligence" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function KnowledgeBaseAdminPage() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ background: COLORS.purple, padding: "6px 24px", fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>
        ADMIN — KNOWLEDGE GRAPH EXPLORER — INTERNAL USE ONLY
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: COLORS.text, margin: 0 }}>SmartPR Knowledge Graph</h1>
          <p style={{ color: COLORS.dim, fontSize: 13, margin: "4px 0 0" }}>
            Understand how municipalities, business types, questions, and rules connect to determine the documents a business needs.
          </p>
        </div>

        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 22, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? COLORS.panel : "transparent",
              color: tab === t.id ? COLORS.text : COLORS.faint,
              border: "none", borderBottom: tab === t.id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
              padding: "10px 18px", cursor: "pointer", fontWeight: tab === t.id ? 700 : 500, fontSize: 13.5, borderRadius: "6px 6px 0 0",
            }}>{t.label}</button>
          ))}
        </div>

        <div>
          {tab === "overview" && <OverviewTab />}
          {tab === "flow" && <RequirementsFlowTab />}
          {tab === "graph" && <KnowledgeGraphTab />}
          {tab === "municipalities" && <MunicipalitiesTab />}
          {tab === "businessTypes" && <BusinessTypesTab />}
          {tab === "documents" && <DocumentsTab />}
          {tab === "simulator" && <SimulatorTab />}
          {tab === "patterns" && <PatternsTab />}
        </div>
      </div>
    </div>
  );
}
