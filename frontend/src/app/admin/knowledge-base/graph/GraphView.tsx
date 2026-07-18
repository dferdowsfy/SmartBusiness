"use client";

// ============================================================================
// The interactive 5-column knowledge-graph traversal (Municipality → Industry
// → Business Type → Questions → Documents) with SVG bezier edges.
//
// Ported verbatim from the original page's KnowledgeGraphTab, but data-driven:
// nodes/edges come from /api/rk/graph (or the static fallback), so proposal
// overlays render here too. Every node carries an inspect (✎) affordance that
// opens the editable DetailPanel.
// ============================================================================

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { COLORS, LAYER, selectStyle } from "../ui";
import type { GraphNodeDTO, GraphResponse } from "../../../rk/types";

const FLAG_SHORT: Record<string, string> = {
  tourism: "Tourism",
  coastal: "Coastal",
  historic: "Historic",
  metro: "Metro",
  island: "Island",
  capital: "Capital",
  industrial_port: "Industrial Port",
  airport_host: "Airport Host",
};
const flagShort = (f: string) => FLAG_SHORT[f] ?? f;

const s = (v: unknown): string => (typeof v === "string" ? v : "");
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

interface DocReason {
  doc: GraphNodeDTO;
  triggerType: "universal" | "business_type" | "question" | "flag";
  flag?: string;
}

function GraphColumn({ title, color, step, children, colRef, locked, revealKey, header, scrollCap }: { title: string; color: string; step?: number; children: React.ReactNode; colRef?: (el: HTMLDivElement | null) => void; locked?: boolean; revealKey?: string; header?: React.ReactNode; scrollCap?: boolean }) {
  return (
    <div ref={colRef} className={`kg-col ${locked ? "locked" : "ready"}`} style={{ minWidth: 220, flex: "1 1 220px" }}>
      <div style={{ color, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10, paddingLeft: 4, display: "flex", alignItems: "center", gap: 8 }}>
        {step != null && (
          <span style={{ background: color + "22", color, border: `1px solid ${color}66`, borderRadius: 999, width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{step}</span>
        )}
        {title}
      </div>
      {header}
      <div key={revealKey} className="kg-col-body" style={{ display: "flex", flexDirection: "column", gap: 6, ...(scrollCap ? { maxHeight: 420, overflowY: "auto", paddingRight: 4 } : null) }}>{children}</div>
    </div>
  );
}

function GraphNode({ label, color, active, dim, status, onClick, onInspect, nodeRef }: { label: string; color: string; active?: boolean; dim?: boolean; status?: string; onClick?: () => void; onInspect?: () => void; nodeRef?: (el: HTMLButtonElement | null) => void }) {
  const overlaid = status === "proposed";
  const archived = status === "archived";
  return (
    <button
      ref={nodeRef}
      onClick={onClick}
      style={{
        textAlign: "left",
        background: active ? color + "33" : COLORS.panel2,
        border: `1px solid ${active ? color : overlaid ? COLORS.purple + "aa" : COLORS.border}`,
        borderLeft: `3px solid ${overlaid ? COLORS.purple : color}`,
        color: dim || archived ? COLORS.faint : COLORS.text,
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 13,
        cursor: onClick ? "pointer" : "default",
        opacity: dim ? 0.45 : archived ? 0.4 : 1,
        transition: "all .12s",
        boxShadow: active ? `0 0 0 4px ${color}22, 0 0 24px ${color}44` : "none",
        position: "relative",
        zIndex: 2,
        display: "flex",
        alignItems: "center",
        gap: 8,
        textDecoration: archived ? "line-through" : "none",
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {overlaid && <span title="Has an open proposal" style={{ width: 7, height: 7, borderRadius: 999, background: COLORS.purple, flex: "0 0 auto" }} />}
      {onInspect && (
        <span
          role="button"
          title="View / edit details"
          onClick={(e) => {
            e.stopPropagation();
            onInspect();
          }}
          style={{ color: COLORS.faint, fontSize: 12, padding: "0 2px", flex: "0 0 auto" }}
        >
          ✎
        </span>
      )}
    </button>
  );
}

export function GraphView({ graph, onInspect }: { graph: GraphResponse; onInspect: (entityId: string) => void }) {
  const [municipalityId, setMunicipalityId] = useState("");
  const [munSearch, setMunSearch] = useState("");
  const [industryId, setIndustryId] = useState("");
  const [btId, setBtId] = useState("");
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // ---- Derive the traversal model from the graph DTOs ----
  const model = useMemo(() => {
    const byType = (t: GraphNodeDTO["nodeType"]) => graph.nodes.filter((n) => n.nodeType === t);
    const byEntity = new Map(graph.nodes.map((n) => [n.entityId, n]));
    const municipalities = byType("municipality");
    const industries = byType("industry");
    const businessTypes = byType("business_type");
    const rules = byType("rule").filter((r) => r.status !== "archived");

    const questionsForBt = (bt: GraphNodeDTO | null): GraphNodeDTO[] => {
      if (!bt) return [];
      return arr(bt.data.question_ids)
        .map((qid) => byEntity.get(qid))
        .filter((q): q is GraphNodeDTO => !!q && q.nodeType === "intake_question" && q.status !== "archived");
    };

    // DocReason list for a business type (priority: flag > question >
    // business_type > universal, so municipality-flag highlighting works even
    // when a document is triggered multiple ways).
    const docsForBt = (bt: GraphNodeDTO | null): DocReason[] => {
      if (!bt) return [];
      const btQids = new Set(arr(bt.data.question_ids));
      const prio: Record<DocReason["triggerType"], number> = { universal: 0, business_type: 1, question: 2, flag: 3 };
      const out = new Map<string, DocReason>();
      const add = (docId: string, triggerType: DocReason["triggerType"], flag?: string) => {
        const doc = byEntity.get(docId);
        if (!doc || doc.nodeType !== "document" || doc.status === "archived") return;
        const prev = out.get(docId);
        if (!prev || prio[triggerType] > prio[prev.triggerType]) out.set(docId, { doc, triggerType, flag });
      };
      for (const r of rules) {
        const d = r.data;
        const docId = s(d.requires_document_id);
        if (!docId) continue;
        switch (s(d.rule_type)) {
          case "municipality":
            add(docId, "universal");
            break;
          case "business_type":
            if (s(d.business_type_id) === bt.entityId) add(docId, "business_type");
            break;
          case "question_trigger":
            if (d.question_id && btQids.has(s(d.question_id))) add(docId, "question");
            break;
          case "municipality_flag":
            if (d.municipality_flag && (!d.business_type_id || s(d.business_type_id) === bt.entityId)) {
              add(docId, "flag", s(d.municipality_flag));
            }
            break;
        }
      }
      return [...out.values()];
    };

    const docsForQuestion = (qid: string): Set<string> => {
      const set = new Set<string>();
      for (const r of rules) {
        if (s(r.data.rule_type) === "question_trigger" && s(r.data.question_id) === qid) {
          set.add(s(r.data.requires_document_id));
        }
      }
      return set;
    };

    return { municipalities, industries, businessTypes, byEntity, questionsForBt, docsForBt, docsForQuestion };
  }, [graph]);

  const mun = municipalityId ? model.byEntity.get(municipalityId) ?? null : null;
  const munFlags = new Set(arr(mun?.data.flags));
  const bts = industryId ? model.businessTypes.filter((b) => s(b.data.industry_id) === industryId) : [];
  const bt = btId ? model.byEntity.get(btId) ?? null : null;
  const qs = model.questionsForBt(bt);
  const docs = model.docsForBt(bt);

  const triggeredDocIds = activeQuestion ? model.docsForQuestion(activeQuestion) : null;
  const munActive = !!municipalityId && !activeQuestion;
  const munDocIds = munActive
    ? new Set(docs.filter((d) => d.triggerType === "flag" && d.flag && munFlags.has(d.flag)).map((d) => d.doc.entityId))
    : null;

  const filteredMuns = useMemo(() => {
    const q = munSearch.trim().toLowerCase();
    const list = [...model.municipalities].sort((a, b) => a.label.localeCompare(b.label));
    return q ? list.filter((m) => m.label.toLowerCase().includes(q)) : list;
  }, [munSearch, model]);

  // ---- Refs for SVG path geometry (ported verbatim) ----
  const containerRef = useRef<HTMLDivElement | null>(null);
  const munNodeRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const industryNodeRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const btNodeRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const qNodeRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const docNodeRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const industryColRef = useRef<HTMLDivElement | null>(null);
  const btColRef = useRef<HTMLDivElement | null>(null);
  const qColRef = useRef<HTMLDivElement | null>(null);
  const docColRef = useRef<HTMLDivElement | null>(null);

  const [paths, setPaths] = useState<Array<{ d: string; color: string; key: string; emphasis: 0 | 1 | 2 }>>([]);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement: bezier geometry must be computed after layout
    if (isMobile) { setPaths([]); return; }
    const compute = () => {
      const c = containerRef.current;
      if (!c) return;
      const crect = c.getBoundingClientRect();
      setCanvasSize({ w: crect.width, h: crect.height });
      const out: Array<{ d: string; color: string; key: string; emphasis: 0 | 1 | 2 }> = [];

      const edges = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return {
          right: r.right - crect.left,
          left: r.left - crect.left,
          centerY: r.top - crect.top + r.height / 2,
        };
      };
      const bezier = (sx: number, sy: number, tx: number, ty: number) => {
        const mid = (sx + tx) / 2;
        return `M ${sx} ${sy} C ${mid} ${sy}, ${mid} ${ty}, ${tx} ${ty}`;
      };

      const iEl = industryId ? industryNodeRefs.current.get(industryId) : null;
      const btEl = btId ? btNodeRefs.current.get(btId) : null;
      const munEl = municipalityId ? munNodeRefs.current.get(municipalityId) : null;

      if (iEl && btEl) {
        const s0 = edges(iEl);
        const t = edges(btEl);
        out.push({ d: bezier(s0.right, s0.centerY, t.left, t.centerY), color: LAYER.businessType, key: "i-bt", emphasis: 2 });
      }

      if (btEl) {
        const s0 = edges(btEl);
        qNodeRefs.current.forEach((el, qid) => {
          if (!el) return;
          const t = edges(el);
          const emphasis: 0 | 1 | 2 = activeQuestion ? (activeQuestion === qid ? 2 : 0) : 1;
          out.push({ d: bezier(s0.right, s0.centerY, t.left, t.centerY), color: LAYER.question, key: `bt-q-${qid}`, emphasis });
        });
      }

      if (activeQuestion) {
        const qEl = qNodeRefs.current.get(activeQuestion);
        if (qEl) {
          const s0 = edges(qEl);
          docNodeRefs.current.forEach((el, did) => {
            if (!el) return;
            if (!triggeredDocIds || !triggeredDocIds.has(did)) return;
            const t = edges(el);
            out.push({ d: bezier(s0.right, s0.centerY, t.left, t.centerY), color: LAYER.document, key: `q-d-${did}`, emphasis: 2 });
          });
        }
      } else if (btEl) {
        const s0 = edges(btEl);
        docNodeRefs.current.forEach((el, did) => {
          if (!el) return;
          const t = edges(el);
          out.push({ d: bezier(s0.right, s0.centerY, t.left, t.centerY), color: LAYER.document, key: `bt-d-${did}`, emphasis: 0 });
        });
      }

      if (munEl && munDocIds && munDocIds.size > 0) {
        const s0 = edges(munEl);
        docNodeRefs.current.forEach((el, did) => {
          if (!el || !munDocIds.has(did)) return;
          const t = edges(el);
          out.push({ d: bezier(s0.right, s0.centerY, t.left, t.centerY), color: LAYER.municipality, key: `m-d-${did}`, emphasis: 2 });
        });
      }

      setPaths(out);
    };

    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", compute);
    const t = setTimeout(compute, 50);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipalityId, industryId, btId, activeQuestion, isMobile, qs.length, docs.length, munActive, graph]);

  // ---- Mobile: smooth-scroll the newly-revealed column into view ----
  useEffect(() => {
    if (!isMobile || !municipalityId) return;
    industryColRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [municipalityId, isMobile]);
  useEffect(() => {
    if (!isMobile || !industryId) return;
    btColRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [industryId, isMobile]);
  useEffect(() => {
    if (!isMobile || !btId) return;
    qColRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [btId, isMobile]);
  useEffect(() => {
    if (!isMobile || !activeQuestion) return;
    docColRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeQuestion, isMobile]);

  return (
    <div>
      <p style={{ color: COLORS.dim, fontSize: 13, marginBottom: 14 }}>
        Pick a municipality, then an industry and business type, to reveal the questions and
        documents connected to it. Click a question to highlight the documents it triggers.
        Use ✎ on any node to open its editable details.
      </p>

      <div className="kg-path">
        <span style={{ color: mun ? LAYER.municipality : COLORS.faint, fontWeight: 600 }}>
          {mun?.label || "Any municipality"}
        </span>
        <span style={{ color: COLORS.faint }}>›</span>
        <span style={{ color: industryId ? LAYER.industry : COLORS.faint, fontWeight: 600 }}>
          {model.industries.find((i) => i.entityId === industryId)?.label || "industry"}
        </span>
        <span style={{ color: COLORS.faint }}>›</span>
        <span style={{ color: bt ? LAYER.businessType : COLORS.faint, fontWeight: 600 }}>
          {bt?.label || "business type"}
        </span>
        {bt && <span style={{ color: COLORS.faint }}>· {qs.length}Q · {docs.length} docs</span>}
      </div>

      <div ref={containerRef} className="kg-columns" style={{ position: "relative" }}>
        {!isMobile && canvasSize.w > 0 && (
          <svg
            className="kg-canvas"
            width={canvasSize.w}
            height={canvasSize.h}
            style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}
            aria-hidden
          >
            {paths.map((p) => {
              const opacity = p.emphasis === 2 ? 0.9 : p.emphasis === 1 ? 0.4 : 0.12;
              const width = p.emphasis === 2 ? 2 : 1.3;
              return (
                <path
                  key={p.key}
                  d={p.d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={width}
                  strokeOpacity={opacity}
                  strokeLinecap="round"
                  style={{ transition: "stroke-opacity .25s ease, stroke-width .25s ease" }}
                />
              );
            })}
          </svg>
        )}

        <GraphColumn title="Municipality" color={LAYER.municipality} step={1}
          header={
            <input
              value={munSearch}
              onChange={(e) => setMunSearch(e.target.value)}
              placeholder="Search municipality…"
              style={{ ...selectStyle, marginBottom: 8, padding: "8px 10px", fontSize: 13 }}
            />
          }
          scrollCap>
          {filteredMuns.map((m) => {
            const flags = arr(m.data.flags);
            return (
              <GraphNode key={m.entityId}
                label={flags.length ? `${m.label}  ·  ${flags.map(flagShort).join(", ")}` : m.label}
                color={LAYER.municipality}
                status={m.status}
                active={municipalityId === m.entityId}
                dim={municipalityId !== "" && municipalityId !== m.entityId}
                nodeRef={(el) => { munNodeRefs.current.set(m.entityId, el); }}
                onInspect={() => onInspect(m.entityId)}
                onClick={() => { setMunicipalityId(municipalityId === m.entityId ? "" : m.entityId); }} />
            );
          })}
          {filteredMuns.length === 0 && <span style={{ color: COLORS.faint, fontSize: 12, padding: 4 }}>No match</span>}
        </GraphColumn>

        <GraphColumn title="Industry" color={LAYER.industry} step={2}
          colRef={(el) => { industryColRef.current = el; }}>
          {[...model.industries].sort((a, b) => a.label.localeCompare(b.label)).map((i) => (
            <GraphNode key={i.entityId} label={i.label} color={LAYER.industry}
              status={i.status}
              active={industryId === i.entityId}
              dim={industryId !== "" && industryId !== i.entityId}
              nodeRef={(el) => { industryNodeRefs.current.set(i.entityId, el); }}
              onInspect={() => onInspect(i.entityId)}
              onClick={() => { setIndustryId(i.entityId); setBtId(""); setActiveQuestion(null); }} />
          ))}
        </GraphColumn>

        <GraphColumn title="Business Type" color={LAYER.businessType} step={3}
          colRef={(el) => { btColRef.current = el; }}
          locked={!industryId}
          revealKey={industryId || "none"}>
          {industryId === "" && <span style={{ color: COLORS.faint, fontSize: 12, padding: 4 }}>Select an industry first</span>}
          {bts.map((b) => (
            <GraphNode key={b.entityId} label={b.label} color={LAYER.businessType}
              status={b.status}
              active={btId === b.entityId}
              dim={btId !== "" && btId !== b.entityId}
              nodeRef={(el) => { btNodeRefs.current.set(b.entityId, el); }}
              onInspect={() => onInspect(b.entityId)}
              onClick={() => { setBtId(b.entityId); setActiveQuestion(null); }} />
          ))}
        </GraphColumn>

        <GraphColumn title={bt ? `Questions for ${bt.label}` : "Questions"} color={LAYER.question} step={4}
          colRef={(el) => { qColRef.current = el; }}
          locked={!bt}
          revealKey={btId || "none"}>
          {!bt && <span style={{ color: COLORS.faint, fontSize: 12, padding: 4 }}>Select a business type first</span>}
          {qs.map((q) => (
            <GraphNode key={q.entityId} label={q.label} color={LAYER.question}
              status={q.status}
              active={activeQuestion === q.entityId}
              dim={activeQuestion !== null && activeQuestion !== q.entityId}
              nodeRef={(el) => { qNodeRefs.current.set(q.entityId, el); }}
              onInspect={() => onInspect(q.entityId)}
              onClick={() => setActiveQuestion(activeQuestion === q.entityId ? null : q.entityId)} />
          ))}
        </GraphColumn>

        <GraphColumn title={activeQuestion ? "Documents triggered" : munActive && munDocIds && munDocIds.size > 0 ? `Documents · ${mun?.label}` : bt ? `Documents for ${bt.label}` : "Documents"} color={LAYER.document} step={5}
          colRef={(el) => { docColRef.current = el; }}
          locked={!bt}
          revealKey={btId + "|" + (activeQuestion || "") + "|" + (municipalityId || "")}>
          {!bt && <span style={{ color: COLORS.faint, fontSize: 12, padding: 4 }}>Select a business type first</span>}
          {docs.map((d) => {
            const isFlag = d.triggerType === "flag";
            const flagApplies = isFlag && !!d.flag && munFlags.has(d.flag);
            const flagMismatch = isFlag && !!municipalityId && !!d.flag && !munFlags.has(d.flag);
            let highlighted = false;
            let dimmed = false;
            if (activeQuestion) {
              highlighted = !!triggeredDocIds && triggeredDocIds.has(d.doc.entityId);
              dimmed = !!triggeredDocIds && !triggeredDocIds.has(d.doc.entityId);
            } else if (munActive) {
              highlighted = flagApplies;
              dimmed = flagMismatch;
            }
            const suffix = isFlag && d.flag ? `  ·  ${flagShort(d.flag)}` : "";
            return (
              <GraphNode key={d.doc.entityId} label={`${d.doc.label}${suffix}`} color={LAYER.document}
                status={d.doc.status}
                active={highlighted} dim={dimmed}
                onInspect={() => onInspect(d.doc.entityId)}
                nodeRef={(el) => { docNodeRefs.current.set(d.doc.entityId, el); }} />
            );
          })}
        </GraphColumn>
      </div>

      {(bt || mun) && (
        <div style={{ marginTop: 20, color: COLORS.faint, fontSize: 12 }}>
          {bt && <>Showing the graph for <span style={{ color: COLORS.text }}>{bt.label}</span> — {qs.length} questions, {docs.length} possible documents. </>}
          {mun && munDocIds && (
            <>In <span style={{ color: COLORS.text }}>{mun.label}</span>{munFlags.size ? <> (flags: {[...munFlags].map(flagShort).join(", ")})</> : <> (no special flags)</>}
              {bt ? <>, {munDocIds.size} flag-triggered document{munDocIds.size === 1 ? "" : "s"} apply.</> : <>. Pick a business type to see which flag documents apply.</>}
              {" "}
              <span style={{ color: COLORS.dim }}>
                Patente rate: {typeof mun.data.patente_rate === "number"
                  ? `${((mun.data.patente_rate as number) * 100).toFixed(2)}% of gross receipts (advisory)`
                  : "not yet captured"}.
              </span>
            </>
          )}
          {activeQuestion && <> Highlighting documents triggered by the selected question.</>}
        </div>
      )}
    </div>
  );
}
