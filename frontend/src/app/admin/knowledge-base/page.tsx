"use client";

import { useState, useMemo } from "react";
import municipalitiesJson from "../../../kb/municipalities.json";
import businessTypesJson from "../../../kb/business_types.json";
import questionsJson from "../../../kb/questions.json";
import documentsJson from "../../../kb/documents.json";
import rulesJson from "../../../kb/rules.json";
import industriesJson from "../../../kb/industries.json";
import { runRulesEngine, type KnowledgeBase } from "../../rulesEngine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Municipality { id: string; name: string; flags: string[] }
interface Industry { id: string; name: string; description: string }
interface BusinessType { id: string; industry_id: string; name: string; description: string }
interface Question { id: string; question: string; type: string; options?: string[] }
interface Document { id: string; name: string; agency: string; category: string }
interface Rule {
  id: string;
  rule_type: string;
  business_type_id: string | null;
  question_id: string | null;
  expected_answer: string | null;
  municipality_flag: string | null;
  requires_document_id: string;
}

// ---------------------------------------------------------------------------
// KB data
// ---------------------------------------------------------------------------
const municipalities = municipalitiesJson as Municipality[];
const industries = industriesJson as Industry[];
const businessTypes = businessTypesJson as BusinessType[];
const questions = questionsJson as Question[];
const documents = documentsJson as Document[];
const rules = rulesJson as Rule[];

const KB: KnowledgeBase = {
  municipalities: municipalities as any,
  businessTypes: businessTypes as any,
  questions: questions as any,
  documents: documents as any,
  rules: rules as any,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const docById = Object.fromEntries(documents.map((d) => [d.id, d]));
const btById = Object.fromEntries(businessTypes.map((b) => [b.id, b]));
const qById = Object.fromEntries(questions.map((q) => [q.id, q]));
const indById = Object.fromEntries(industries.map((i) => [i.id, i]));

const RULE_TYPE_COLORS: Record<string, string> = {
  municipality: "#6366f1",
  municipality_flag: "#8b5cf6",
  business_type: "#0ea5e9",
  question_trigger: "#f59e0b",
};

const FLAG_COLORS: Record<string, string> = {
  tourism: "#0ea5e9",
  coastal: "#06b6d4",
  historic: "#a16207",
  metro: "#6366f1",
  island: "#10b981",
};

function Badge({ label, color }: { label: string; color?: string }) {
  const bg = color || "#64748b";
  return (
    <span style={{ background: bg, color: "#fff", borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 600, display: "inline-block", marginRight: 3 }}>
      {label}
    </span>
  );
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Search…"}
      style={{ border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", borderRadius: 6, padding: "6px 12px", width: "100%", maxWidth: 360, fontSize: 13 }}
    />
  );
}

function Table({ cols, rows }: { cols: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid #334155", color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: "1px solid #1e293b" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "7px 12px", color: "#cbd5e1", verticalAlign: "top" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols.length} style={{ padding: "24px 12px", color: "#64748b", textAlign: "center" }}>
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function exportCSV(cols: string[], rows: (string | React.ReactNode)[][], filename: string) {
  const lines = [
    cols.join(","),
    ...rows.map((row) =>
      row.map((cell) => {
        const s = typeof cell === "string" ? cell : String(cell ?? "");
        return `"${s.replace(/"/g, '""')}"`;
      }).join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function IndustriesTab() {
  const [q, setQ] = useState("");
  const filtered = industries.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()));
  const btCount = (id: string) => businessTypes.filter((b) => b.industry_id === id).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search industries…" />
        <button onClick={() => exportCSV(["ID", "Name", "Description", "Business Types"], filtered.map((i) => [i.id, i.name, i.description, String(btCount(i.id))]), "industries.csv")} style={exportBtn}>Export CSV</button>
      </div>
      <Table
        cols={["ID", "Name", "Description", "Business Types"]}
        rows={filtered.map((i) => [
          <code key={i.id} style={{ color: "#7dd3fc" }}>{i.id}</code>,
          i.name,
          <span key={i.id} style={{ color: "#94a3b8" }}>{i.description}</span>,
          <Badge key={i.id} label={String(btCount(i.id))} color="#0ea5e9" />,
        ])}
      />
    </div>
  );
}

function BusinessTypesTab() {
  const [q, setQ] = useState("");
  const [indFilter, setIndFilter] = useState("all");
  const filtered = businessTypes.filter((b) => {
    const matchQ = !q || b.name.toLowerCase().includes(q.toLowerCase()) || b.id.toLowerCase().includes(q.toLowerCase());
    const matchInd = indFilter === "all" || b.industry_id === indFilter;
    return matchQ && matchInd;
  });
  const ruleCount = (id: string) => rules.filter((r) => r.business_type_id === id).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search business types…" />
        <select value={indFilter} onChange={(e) => setIndFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Industries</option>
          {industries.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <button onClick={() => exportCSV(["ID", "Industry", "Name", "Description", "Rules"], filtered.map((b) => [b.id, indById[b.industry_id]?.name || b.industry_id, b.name, b.description, String(ruleCount(b.id))]), "business_types.csv")} style={exportBtn}>Export CSV</button>
      </div>
      <Table
        cols={["ID", "Industry", "Name", "Rules"]}
        rows={filtered.map((b) => [
          <code key={b.id} style={{ color: "#7dd3fc" }}>{b.id}</code>,
          <span key={b.id} style={{ color: "#94a3b8", fontSize: 12 }}>{indById[b.industry_id]?.name}</span>,
          b.name,
          <Badge key={b.id} label={String(ruleCount(b.id))} color="#0ea5e9" />,
        ])}
      />
      <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>Showing {filtered.length} of {businessTypes.length}</div>
    </div>
  );
}

function MunicipalitiesTab() {
  const [q, setQ] = useState("");
  const [flagFilter, setFlagFilter] = useState("all");
  const allFlags = Array.from(new Set(municipalities.flatMap((m) => m.flags)));
  const filtered = municipalities.filter((m) => {
    const matchQ = !q || m.name.toLowerCase().includes(q.toLowerCase());
    const matchF = flagFilter === "all" || m.flags.includes(flagFilter);
    return matchQ && matchF;
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search municipalities…" />
        <select value={flagFilter} onChange={(e) => setFlagFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Flags</option>
          {allFlags.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <button onClick={() => exportCSV(["ID", "Name", "Flags"], filtered.map((m) => [m.id, m.name, m.flags.join(";")]), "municipalities.csv")} style={exportBtn}>Export CSV</button>
      </div>
      <Table
        cols={["ID", "Name", "Flags"]}
        rows={filtered.map((m) => [
          <code key={m.id} style={{ color: "#7dd3fc" }}>{m.id}</code>,
          m.name,
          <span key={m.id}>{m.flags.map((f) => <Badge key={f} label={f} color={FLAG_COLORS[f] || "#64748b"} />)}</span>,
        ])}
      />
      <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>Showing {filtered.length} of {municipalities.length}</div>
    </div>
  );
}

function DocumentsTab() {
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const cats = Array.from(new Set(documents.map((d) => d.category)));
  const filtered = documents.filter((d) => {
    const matchQ = !q || d.name.toLowerCase().includes(q.toLowerCase()) || d.id.toLowerCase().includes(q.toLowerCase());
    const matchC = catFilter === "all" || d.category === catFilter;
    return matchQ && matchC;
  });
  const ruleCount = (id: string) => rules.filter((r) => r.requires_document_id === id).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search documents…" />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Categories</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => exportCSV(["ID", "Name", "Agency", "Category", "Rules"], filtered.map((d) => [d.id, d.name, d.agency, d.category, String(ruleCount(d.id))]), "documents.csv")} style={exportBtn}>Export CSV</button>
      </div>
      <Table
        cols={["ID", "Name", "Agency", "Category", "Rules"]}
        rows={filtered.map((d) => [
          <code key={d.id} style={{ color: "#7dd3fc" }}>{d.id}</code>,
          d.name,
          <span key={d.id} style={{ color: "#94a3b8" }}>{d.agency}</span>,
          <Badge key={d.id} label={d.category} color="#475569" />,
          <Badge key={d.id + "r"} label={String(ruleCount(d.id))} color="#0ea5e9" />,
        ])}
      />
    </div>
  );
}

function QuestionsTab() {
  const [q, setQ] = useState("");
  const filtered = questions.filter((item) => !q || item.question.toLowerCase().includes(q.toLowerCase()) || item.id.toLowerCase().includes(q.toLowerCase()));
  const ruleCount = (id: string) => rules.filter((r) => r.question_id === id).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search questions…" />
        <button onClick={() => exportCSV(["ID", "Question", "Type", "Rules"], filtered.map((item) => [item.id, item.question, item.type, String(ruleCount(item.id))]), "questions.csv")} style={exportBtn}>Export CSV</button>
      </div>
      <Table
        cols={["ID", "Question", "Type", "Triggered Rules"]}
        rows={filtered.map((item) => [
          <code key={item.id} style={{ color: "#7dd3fc" }}>{item.id}</code>,
          item.question,
          <Badge key={item.id} label={item.type} color="#475569" />,
          <Badge key={item.id + "r"} label={String(ruleCount(item.id))} color={ruleCount(item.id) > 0 ? "#f59e0b" : "#475569"} />,
        ])}
      />
    </div>
  );
}

function RulesTab() {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const filtered = rules.filter((r) => {
    const matchQ = !q || r.id.toLowerCase().includes(q.toLowerCase()) || r.requires_document_id.toLowerCase().includes(q.toLowerCase()) || (r.business_type_id || "").toLowerCase().includes(q.toLowerCase());
    const matchT = typeFilter === "all" || r.rule_type === typeFilter;
    return matchQ && matchT;
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search rules…" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Types</option>
          {Object.keys(RULE_TYPE_COLORS).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => exportCSV(["ID", "Type", "Business Type", "Question", "Answer", "Flag", "Document"], filtered.map((r) => [r.id, r.rule_type, r.business_type_id || "", r.question_id || "", r.expected_answer || "", r.municipality_flag || "", r.requires_document_id]), "rules.csv")} style={exportBtn}>Export CSV</button>
      </div>
      <Table
        cols={["ID", "Type", "Condition", "Requires Document"]}
        rows={filtered.map((r) => {
          let condition: React.ReactNode = null;
          if (r.rule_type === "business_type" && r.business_type_id) {
            condition = <span><span style={{ color: "#94a3b8" }}>BT=</span><code style={{ color: "#7dd3fc" }}>{r.business_type_id}</code></span>;
          } else if (r.rule_type === "question_trigger" && r.question_id) {
            condition = <span><span style={{ color: "#94a3b8" }}>Q=</span><code style={{ color: "#7dd3fc" }}>{r.question_id}</code> <span style={{ color: "#94a3b8" }}>== {r.expected_answer}</span></span>;
          } else if (r.rule_type === "municipality_flag") {
            condition = <span><span style={{ color: "#94a3b8" }}>flag=</span><Badge label={r.municipality_flag || ""} color={FLAG_COLORS[r.municipality_flag || ""] || "#64748b"} /></span>;
          } else {
            condition = <span style={{ color: "#64748b" }}>universal</span>;
          }
          return [
            <code key={r.id} style={{ color: "#94a3b8", fontSize: 11 }}>{r.id}</code>,
            <Badge key={r.id + "t"} label={r.rule_type} color={RULE_TYPE_COLORS[r.rule_type]} />,
            condition,
            <span key={r.id + "d"}><code style={{ color: "#a78bfa" }}>{r.requires_document_id}</code> <span style={{ color: "#64748b", fontSize: 11 }}>{docById[r.requires_document_id]?.name}</span></span>,
          ];
        })}
      />
      <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>Showing {filtered.length} of {rules.length}</div>
    </div>
  );
}

function ValidationRulesTab() {
  // validation_rules.json may not be in src/kb — show what we have from rules
  const qtRules = rules.filter((r) => r.rule_type === "question_trigger");
  const [q, setQ] = useState("");
  const filtered = qtRules.filter((r) => !q || (r.question_id || "").toLowerCase().includes(q.toLowerCase()) || r.requires_document_id.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
        Validation rules define which question answers trigger additional document requirements. These are the <Badge label="question_trigger" color={RULE_TYPE_COLORS.question_trigger} /> rules from the rules engine.
      </p>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search validation rules…" />
        <button onClick={() => exportCSV(["Rule ID", "Question ID", "Question Text", "Expected Answer", "Required Document", "Document Name"], filtered.map((r) => [r.id, r.question_id || "", qById[r.question_id || ""]?.question || "", r.expected_answer || "", r.requires_document_id, docById[r.requires_document_id]?.name || ""]), "validation_rules.csv")} style={exportBtn}>Export CSV</button>
      </div>
      <Table
        cols={["Rule ID", "Question", "Answer", "Required Document"]}
        rows={filtered.map((r) => [
          <code key={r.id} style={{ color: "#94a3b8", fontSize: 11 }}>{r.id}</code>,
          <span key={r.id + "q"}><code style={{ color: "#7dd3fc", fontSize: 11 }}>{r.question_id}</code><br /><span style={{ color: "#94a3b8", fontSize: 11 }}>{qById[r.question_id || ""]?.question}</span></span>,
          <Badge key={r.id + "a"} label={r.expected_answer || "any"} color={r.expected_answer === "true" ? "#10b981" : "#ef4444"} />,
          <span key={r.id + "d"}><code style={{ color: "#a78bfa" }}>{r.requires_document_id}</code><br /><span style={{ color: "#64748b", fontSize: 11 }}>{docById[r.requires_document_id]?.name}</span></span>,
        ])}
      />
    </div>
  );
}

function RulesExplorerTab() {
  const [municipalityName, setMunicipalityName] = useState("");
  const [businessTypeName, setBusinessTypeName] = useState("");
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, boolean>>({});
  const [ran, setRan] = useState(false);

  const result = useMemo(() => {
    if (!ran) return null;
    try {
      return runRulesEngine(KB, {
        municipalityName: municipalityName || null,
        businessTypeName: businessTypeName || null,
        answers: questionAnswers,
      });
    } catch {
      return null;
    }
  }, [ran, municipalityName, businessTypeName, questionAnswers]);

  const toggleAnswer = (qid: string) => {
    setQuestionAnswers((prev) => {
      const next = { ...prev };
      if (next[qid]) delete next[qid];
      else next[qid] = true;
      return next;
    });
    setRan(false);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
      {/* Left: controls */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Municipality</label>
          <select value={municipalityName} onChange={(e) => { setMunicipalityName(e.target.value); setRan(false); }} style={{ ...selectStyle, width: "100%" }}>
            <option value="">(none)</option>
            {municipalities.map((m) => <option key={m.id} value={m.name}>{m.name}{m.flags.length ? ` [${m.flags.join(",")}]` : ""}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Business Type</label>
          <select value={businessTypeName} onChange={(e) => { setBusinessTypeName(e.target.value); setRan(false); }} style={{ ...selectStyle, width: "100%" }}>
            <option value="">(none)</option>
            {businessTypes.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Question Answers (check = true)</label>
          <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #334155", borderRadius: 6, padding: "8px 4px" }}>
            {questions.map((q) => (
              <label key={q.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 8px", cursor: "pointer", borderRadius: 4, background: questionAnswers[q.id] ? "#1e3a5f" : "transparent" }}>
                <input type="checkbox" checked={!!questionAnswers[q.id]} onChange={() => toggleAnswer(q.id)} style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: questionAnswers[q.id] ? "#7dd3fc" : "#94a3b8", lineHeight: 1.4 }}>
                  <span style={{ color: "#475569" }}>{q.id}: </span>{q.question}
                </span>
              </label>
            ))}
          </div>
        </div>
        <button
          onClick={() => setRan(true)}
          style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px", cursor: "pointer", fontWeight: 600, width: "100%" }}
        >
          Run Rules Engine
        </button>
        {Object.keys(questionAnswers).length > 0 && (
          <button onClick={() => { setQuestionAnswers({}); setRan(false); }} style={{ ...exportBtn, marginTop: 8, width: "100%", textAlign: "center" }}>
            Clear Answers
          </button>
        )}
      </div>

      {/* Right: results */}
      <div>
        {!ran && (
          <div style={{ color: "#64748b", padding: "40px 20px", textAlign: "center", border: "1px dashed #334155", borderRadius: 8 }}>
            Select options and click Run Rules Engine to see results.
          </div>
        )}
        {ran && result && (
          <div>
            {/* Municipality flags */}
            {result.debug.municipalityFlags.length > 0 && (
              <div style={sectionBox}>
                <div style={sectionTitle}>Municipality Flags</div>
                <div>{result.debug.municipalityFlags.map((f) => <Badge key={f} label={f} color={FLAG_COLORS[f] || "#64748b"} />)}</div>
              </div>
            )}

            {/* Generated documents */}
            <div style={sectionBox}>
              <div style={sectionTitle}>Required Documents ({result.requirements.length})</div>
              {result.requirements.length === 0 ? (
                <div style={{ color: "#64748b", fontSize: 13 }}>No documents required.</div>
              ) : (
                result.requirements.map((req) => (
                  <div key={req.document_id} style={{ padding: "8px 0", borderBottom: "1px solid #1e293b" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <code style={{ color: "#a78bfa", fontSize: 12 }}>{req.document_id}</code>
                      <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{req.document_name}</span>
                      <span style={{ color: "#64748b", fontSize: 12 }}>{req.agency}</span>
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{req.reason}</div>
                    <div style={{ marginTop: 2 }}><Badge label={req.source_rule_id} color="#334155" /></div>
                  </div>
                ))
              )}
            </div>

            {/* Matched rules */}
            <div style={sectionBox}>
              <div style={sectionTitle}>Matched Rules ({result.debug.rulesMatched.length})</div>
              <Table
                cols={["Rule ID", "Type", "Document"]}
                rows={result.debug.rulesMatched.map((r) => [
                  <code key={r.rule_id} style={{ color: "#94a3b8", fontSize: 11 }}>{r.rule_id}</code>,
                  <Badge key={r.rule_id + "t"} label={r.rule_type} color={RULE_TYPE_COLORS[r.rule_type]} />,
                  <code key={r.rule_id + "d"} style={{ color: "#a78bfa", fontSize: 11 }}>{r.document_id}</code>,
                ])}
              />
            </div>

            {/* Triggered questions */}
            {result.debug.questionsTriggered.length > 0 && (
              <div style={sectionBox}>
                <div style={sectionTitle}>Questions That Triggered Rules</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {result.debug.questionsTriggered.map((qt) => (
                    <Badge key={qt.question_id} label={qt.question_id} color="#f59e0b" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const exportBtn: React.CSSProperties = {
  background: "#1e293b",
  color: "#94a3b8",
  border: "1px solid #334155",
  borderRadius: 6,
  padding: "6px 14px",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
  whiteSpace: "nowrap",
};
const selectStyle: React.CSSProperties = {
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
};
const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
};
const sectionBox: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 8,
  padding: "14px 16px",
  marginBottom: 16,
};
const sectionTitle: React.CSSProperties = {
  color: "#e2e8f0",
  fontWeight: 600,
  fontSize: 14,
  marginBottom: 12,
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const TABS = [
  { id: "industries", label: "Industries" },
  { id: "business_types", label: "Business Types" },
  { id: "municipalities", label: "Municipalities" },
  { id: "documents", label: "Documents" },
  { id: "questions", label: "Questions" },
  { id: "rules", label: "Rules" },
  { id: "validation_rules", label: "Validation Rules" },
  { id: "explorer", label: "Rules Explorer" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function KnowledgeBaseAdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>("industries");

  const metrics = [
    { label: "Municipalities", value: municipalities.length, color: "#0ea5e9" },
    { label: "Industries", value: industries.length, color: "#8b5cf6" },
    { label: "Business Types", value: businessTypes.length, color: "#6366f1" },
    { label: "Questions", value: questions.length, color: "#f59e0b" },
    { label: "Documents", value: documents.length, color: "#10b981" },
    { label: "Rules", value: rules.length, color: "#ef4444" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#020817", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
      {/* Admin banner */}
      <div style={{ background: "#7c3aed", padding: "6px 24px", fontSize: 12, fontWeight: 600, color: "#fff", letterSpacing: 1 }}>
        ADMIN — KNOWLEDGE BASE ADMINISTRATION — NOT FOR PUBLIC ACCESS
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Knowledge Base Administration</h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>Inspect, search, and explore the SmartPR rules engine knowledge base.</p>
        </div>

        {/* Metrics */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
          {metrics.map((m) => (
            <div key={m.label} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "12px 20px", minWidth: 120 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #1e293b", marginBottom: 20, flexWrap: "wrap" }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? "#1e293b" : "transparent",
                color: activeTab === tab.id ? "#e2e8f0" : "#64748b",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #6366f1" : "2px solid transparent",
                padding: "8px 16px",
                cursor: "pointer",
                fontWeight: activeTab === tab.id ? 600 : 400,
                fontSize: 13,
                borderRadius: "4px 4px 0 0",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 8, padding: "20px" }}>
          {activeTab === "industries" && <IndustriesTab />}
          {activeTab === "business_types" && <BusinessTypesTab />}
          {activeTab === "municipalities" && <MunicipalitiesTab />}
          {activeTab === "documents" && <DocumentsTab />}
          {activeTab === "questions" && <QuestionsTab />}
          {activeTab === "rules" && <RulesTab />}
          {activeTab === "validation_rules" && <ValidationRulesTab />}
          {activeTab === "explorer" && <RulesExplorerTab />}
        </div>
      </div>
    </div>
  );
}
