"use client";

// ============================================================================
// Regulatory Sources tab — the ingestion workspace.
//
// Upload a bill / law / regulation / ordinance / guidance / form (paste text,
// fetch an official URL, or extract a PDF client-side with pdf.js — the
// existing analyze-document pattern), track its legal status, and run the
// AI-assisted extraction that PROPOSES graph changes for human review.
// First target: PR Senate Bill PS 1173.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Btn, COLORS, StatusBadge, inputStyle, labelStyle, selectStyle } from "../ui";
import type { LegalStatus, SourceSection, SourceType } from "../../../rk/types";

interface SourceRow {
  id: string;
  title: string;
  source_type: SourceType;
  legal_status: LegalStatus;
  citation: string | null;
  url: string | null;
  effective_date: string | null;
  created_at: string;
  proposal_count: number;
  section_count?: number;
  raw_text_length?: number;
}

const SOURCE_TYPES: SourceType[] = ["bill", "law", "regulation", "ordinance", "guidance", "form", "web", "other"];
const LEGAL_STATUSES: LegalStatus[] = [
  "proposed", "introduced", "under_review", "approved", "signed", "effective", "amended", "repealed", "superseded",
];
const ENACTED = new Set(["approved", "signed", "effective", "amended"]);

// Extract text from a PDF in the browser (same pdf.js pattern as page.tsx).
async function extractPdfText(file: File): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  const maxPages = Math.min(doc.numPages, 80);
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    parts.push(
      textContent.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((it: any) => (typeof it.str === "string" ? it.str : ""))
        .join(" ")
    );
  }
  return parts.join("\n").trim();
}

export function SourcesTab({ enabled, onProposals }: { enabled: boolean; onProposals: (sourceId: string) => void }) {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sections, setSections] = useState<SourceSection[] | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    title: "PS 1173 (Proyecto del Senado 1173)",
    sourceType: "bill" as SourceType,
    legalStatus: "proposed" as LegalStatus,
    citation: "PS 1173",
    url: "",
    text: "",
  });

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/rk/sources");
      const data = await res.json();
      setSources(data.sources ?? []);
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
    window.setTimeout(() => setToast(null), 10000);
  };

  const onPdf = async (file: File) => {
    setBusy("pdf");
    try {
      const text = await extractPdfText(file);
      if (!text) {
        notify(`No selectable text found in "${file.name}" — it may be a scanned image. Paste the text instead.`);
        return;
      }
      setForm((f) => ({ ...f, text, title: f.title || file.name.replace(/\.pdf$/i, "") }));
      notify(`Extracted ${text.length.toLocaleString()} characters from ${file.name}.`);
    } catch (err) {
      notify(`PDF extraction failed: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    setBusy("create");
    try {
      const res = await fetch("/api/rk/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          sourceType: form.sourceType,
          legalStatus: form.legalStatus,
          citation: form.citation || undefined,
          url: form.url || undefined,
          text: form.text || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(`Failed: ${data.error}`);
        return;
      }
      notify(`Source "${data.source.title}" saved. Run extraction to propose graph changes.`);
      setForm((f) => ({ ...f, text: "" }));
      await load();
    } finally {
      setBusy(null);
    }
  };

  const ingest = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch("/api/rk/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(`Extraction failed: ${data.error}${data.message ? ` — ${data.message}` : ""}`);
        return;
      }
      notify(
        `Extraction complete${data.usedAI ? " (AI)" : " (no AI key — sections flagged for manual review)"}: ` +
          `${data.sections} section(s), ${data.businessSections} business-permitting, ` +
          `${data.skippedConstruction} construction-only excluded, ${data.proposalsCreated} proposal(s) created. ` +
          `Review them in Proposed Changes — nothing goes live without approval.`
      );
      await load();
      if (openId === id) await openDetail(id);
    } finally {
      setBusy(null);
    }
  };

  const openDetail = async (id: string) => {
    setOpenId(id);
    setSections(null);
    const res = await fetch(`/api/rk/sources/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSections((data.source.sections_json as SourceSection[]) ?? []);
    }
  };

  const setStatus = async (id: string, legalStatus: LegalStatus) => {
    const res = await fetch(`/api/rk/sources/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legalStatus }),
    });
    if (res.ok) {
      notify(
        ENACTED.has(legalStatus)
          ? `Legal status set to ${legalStatus} — proposals from this source can now enter publication batches.`
          : `Legal status set to ${legalStatus} — proposals stay in the Proposed Future State layer (blocked from publishing).`
      );
      await load();
    }
  };

  if (!enabled) {
    return (
      <div style={{ color: COLORS.faint, padding: "50px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
        Regulatory-source ingestion needs a database. Set DATABASE_URL to enable it.
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

      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ color: COLORS.text, fontWeight: 700, marginBottom: 4 }}>Ingest Regulatory Source</div>
        <p style={{ color: COLORS.dim, fontSize: 12.5, marginTop: 0 }}>
          Bills, laws, regulations, municipal ordinances, agency guidance, or official forms.
          Provide the text by pasting it, uploading a PDF (text is extracted in your browser), or
          fetching an official URL. AI then extracts business-permitting provisions and proposes
          graph changes — construction-only provisions are excluded, and nothing is published
          without your review.
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={form.sourceType} onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value as SourceType }))} style={selectStyle}>
              {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Legal status</label>
            <select value={form.legalStatus} onChange={(e) => setForm((f) => ({ ...f, legalStatus: e.target.value as LegalStatus }))} style={selectStyle}>
              {LEGAL_STATUSES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Citation</label>
            <input value={form.citation} onChange={(e) => setForm((f) => ({ ...f, citation: e.target.value }))} placeholder="e.g. PS 1173" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Official URL (optional)</label>
            <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://sutra.oslpr.org/…" style={inputStyle} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={labelStyle}>Document text</label>
          <textarea
            value={form.text}
            onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
            rows={6}
            placeholder="Paste the bill/regulation text here, or upload a PDF below. Leave empty to fetch from the official URL."
            style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (/\.pdf$/i.test(f.name)) void onPdf(f);
                  else f.text().then((t) => setForm((prev) => ({ ...prev, text: t })));
                }
                e.target.value = "";
              }}
            />
            <Btn onClick={() => fileRef.current?.click()} disabled={busy === "pdf"}>
              {busy === "pdf" ? "Extracting PDF…" : "Upload PDF / TXT"}
            </Btn>
            <Btn primary onClick={create} disabled={busy === "create" || !form.title.trim() || (!form.text.trim() && !form.url.trim())}>
              {busy === "create" ? "Saving…" : "Save source"}
            </Btn>
            {form.text && <span style={{ color: COLORS.faint, fontSize: 12 }}>{form.text.length.toLocaleString()} characters ready</span>}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ color: COLORS.faint, padding: 30, textAlign: "center" }}>Loading sources…</div>
      ) : sources.length === 0 ? (
        <div style={{ color: COLORS.faint, padding: "40px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
          No regulatory sources yet. Add PS 1173 above to run the first ingestion.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sources.map((s) => (
            <div key={s.id} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ color: COLORS.text, fontWeight: 700 }}>{s.title}</div>
                  <div style={{ color: COLORS.faint, fontSize: 12, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span>{s.source_type}</span>
                    {s.citation && <span>{s.citation}</span>}
                    {s.effective_date && <span>effective {new Date(s.effective_date).toLocaleDateString()}</span>}
                    <span>{s.proposal_count} proposal(s)</span>
                    {typeof s.section_count === "number" && s.section_count > 0 && <span>{s.section_count} section(s)</span>}
                  </div>
                  {!ENACTED.has(s.legal_status) && (
                    <div style={{ color: COLORS.purple, fontSize: 12, marginTop: 4 }}>
                      Proposed Future State layer — extracted rules are NOT treated as active law and
                      cannot be published until the status becomes approved/signed/effective.
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <StatusBadge status={s.legal_status} />
                  <select value={s.legal_status} onChange={(e) => void setStatus(s.id, e.target.value as LegalStatus)} style={{ ...selectStyle, width: "auto", padding: "6px 8px", fontSize: 12.5 }}>
                    {LEGAL_STATUSES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Btn primary small disabled={busy === s.id} onClick={() => void ingest(s.id)}>
                    {busy === s.id ? "Extracting…" : "Run extraction"}
                  </Btn>
                  <Btn small onClick={() => (openId === s.id ? setOpenId(null) : void openDetail(s.id))}>
                    {openId === s.id ? "Hide sections" : "Sections"}
                  </Btn>
                  <Btn small onClick={() => onProposals(s.id)}>Proposals →</Btn>
                </div>
              </div>

              {openId === s.id && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                  {!sections ? (
                    <div style={{ color: COLORS.faint, fontSize: 12 }}>Loading sections…</div>
                  ) : sections.length === 0 ? (
                    <div style={{ color: COLORS.faint, fontSize: 12 }}>No sections yet — run extraction to sectionize the document.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                      {sections.map((sec, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 12.5 }}>
                          <span style={{ color: sec.classification === "business_permitting" ? COLORS.green : sec.classification === "construction_only" ? COLORS.red : COLORS.faint, flex: "0 0 150px" }}>
                            {sec.classification === "business_permitting" ? "business permitting" : sec.classification === "construction_only" ? "construction only" : "general"}
                          </span>
                          <span style={{ color: COLORS.text }}>{sec.heading}</span>
                          <span style={{ color: COLORS.faint }}>{sec.text.length.toLocaleString()} chars</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
