"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, X } from "lucide-react";
import { statusPresentation } from "./IncentivesSidebar";
import type { IncentiveAssessment, IncentiveEligibilityResult, IncentiveFollowUpQuestion, ProjectFactValue } from "../../incentives/types";

type Language = "en" | "es";

function FollowUpInput({
  item, value, language, inputId, onChange,
}: {
  item: IncentiveFollowUpQuestion; value: ProjectFactValue; language: Language; inputId: string;
  onChange: (value: ProjectFactValue) => void;
}) {
  if (item.answerType === "boolean") {
    return (
      <div className="opd-answer-buttons">
        <button id={inputId} type="button" className={value === true ? "active" : ""} onClick={() => onChange(true)}>{language === "es" ? "Sí" : "Yes"}</button>
        <button type="button" className={value === false ? "active" : ""} onClick={() => onChange(false)}>{language === "es" ? "No" : "No"}</button>
      </div>
    );
  }
  if (item.answerType === "single_select") {
    return (
      <select id={inputId} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{language === "es" ? "Seleccionar…" : "Select…"}</option>
        {item.answerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  return (
    <input
      type={item.answerType === "number" ? "number" : item.answerType === "date" ? "date" : "text"}
      id={inputId}
      value={typeof value === "string" || typeof value === "number" ? value : ""}
      onChange={(e) => onChange(item.answerType === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value || null)}
    />
  );
}

/** The full opportunities list plus the follow-up questions, both moved out
 * of the main Requirements page and into this overlay — reached via
 * "View all opportunities" or "Answer N questions to improve matches". */
export function OpportunitiesDrawer({
  assessment,
  language,
  facts,
  onFactChange,
  onReview,
  onClose,
}: {
  assessment: IncentiveAssessment | null;
  language: Language;
  facts: Record<string, ProjectFactValue>;
  onFactChange: (key: string, value: ProjectFactValue) => void;
  onReview: (result: IncentiveEligibilityResult) => void;
  onClose: () => void;
}) {
  const es = language === "es";
  const panelRef = useRef<HTMLDivElement>(null);
  const opportunities = assessment?.opportunities ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="opd-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`
        .opd-overlay{position:fixed;inset:0;z-index:75;background:rgba(20,18,14,.4);display:flex;justify-content:flex-end}
        .opd-panel{background:var(--surface,#fff);width:100%;max-width:440px;height:100%;overflow-y:auto;box-shadow:-8px 0 40px rgba(0,0,0,.2)}
        .opd-head{position:sticky;top:0;background:var(--surface,#fff);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px;border-bottom:1px solid var(--border,#d9d4ca)}
        .opd-head h2{font-family:var(--font-display,Georgia,serif);font-size:18px;margin:0;color:var(--ink,#171714)}
        .opd-close{background:none;border:none;cursor:pointer;color:var(--muted,#69665f);padding:6px;border-radius:8px;flex:none}
        .opd-close:hover{background:var(--surface-2,#faf8f2);color:var(--ink,#171714)}
        .opd-body{padding:18px 20px;display:flex;flex-direction:column;gap:12px}
        .opd-questions{border:1px solid var(--border,#d9d4ca);border-radius:12px;padding:14px}
        .opd-questions h3{font-size:13px;margin:0 0 4px;color:var(--ink,#171714)}
        .opd-questions>p{font-size:12px;color:var(--muted,#69665f);margin:0 0 10px}
        .opd-question{padding:10px 0;border-top:1px solid color-mix(in srgb,var(--border,#d9d4ca) 70%,transparent)}
        .opd-question:first-of-type{border-top:0}
        .opd-question label{display:block;font-size:12.5px;font-weight:650;color:var(--ink,#171714);margin-bottom:6px}
        .opd-question input,.opd-question select{width:100%;border:1px solid var(--border,#d9d4ca);border-radius:8px;background:var(--surface,#fff);padding:8px 10px;font:inherit;color:var(--ink,#171714)}
        .opd-answer-buttons{display:grid;grid-template-columns:1fr 1fr;gap:6px}
        .opd-answer-buttons button{border:1px solid var(--border,#d9d4ca);background:var(--surface,#fff);border-radius:8px;padding:8px;cursor:pointer}
        .opd-answer-buttons button.active{background:var(--accent,#0f766e);border-color:var(--accent,#0f766e);color:#fff}
        .opd-card{border:1px solid var(--border,#d9d4ca);border-radius:12px;padding:14px;cursor:pointer;background:var(--surface,#fff)}
        .opd-card:hover{border-color:var(--accent,#0f766e)}
        .opd-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
        .opd-status{display:inline-block;border-radius:999px;padding:3px 8px;font-size:10.5px;font-weight:800}
        .opd-status.strong{background:#e7f5f1;color:#0f766e}.opd-status.likely{background:#e7f5f1;color:#0f766e}
        .opd-status.possible{background:#fff5df;color:#9a6700}.opd-status.info{background:#fff5df;color:#9a6700}
        .opd-status.low{background:var(--surface-2,#faf8f2);color:var(--muted,#69665f)}.opd-status.no{background:var(--surface-2,#faf8f2);color:var(--muted,#69665f)}
        .opd-card h4{font-size:13.5px;margin:0 0 3px;color:var(--ink,#171714)}
        .opd-card-agency{font-size:11.5px;color:var(--muted,#69665f);margin-bottom:6px}
        .opd-card-benefit{font-size:12px;color:var(--ink,#171714);line-height:1.5}
        .opd-empty{font-size:13px;color:var(--muted,#69665f);padding:8px 0}
      `}</style>
      <div ref={panelRef} className="opd-panel" role="dialog" aria-modal="true" aria-label={es ? "Todas las oportunidades" : "All opportunities"} tabIndex={-1}>
        <div className="opd-head">
          <h2>{es ? "Todas las oportunidades" : "All opportunities"}</h2>
          <button type="button" className="opd-close" onClick={onClose} aria-label={es ? "Cerrar" : "Close"}><X size={18} /></button>
        </div>
        <div className="opd-body">
          {(assessment?.followUpQuestions.length ?? 0) > 0 && (
            <div className="opd-questions">
              <h3>{es ? "Preguntas que pueden cambiar la evaluación" : "Questions that could change eligibility"}</h3>
              <p>{es ? "Solo preguntamos cuando una respuesta puede cambiar materialmente un resultado, y nunca algo que ya confirmaste." : "We only ask when an answer could materially change a result, and never something already confirmed."}</p>
              {assessment!.followUpQuestions.map((item) => (
                <div className="opd-question" key={item.factKey}>
                  <label htmlFor={`opd-${item.factKey}`}>{item.question}</label>
                  <FollowUpInput inputId={`opd-${item.factKey}`} item={item} value={facts[item.factKey]} language={language} onChange={(value) => onFactChange(item.factKey, value)} />
                </div>
              ))}
            </div>
          )}

          {opportunities.length === 0 && <div className="opd-empty">{es ? "No hay oportunidades publicadas todavía." : "No published opportunities yet."}</div>}

          {opportunities.map((item) => {
            const status = statusPresentation(item, language);
            const benefit = item.potentialBenefit[0]?.amountDescription || item.potentialBenefit[0]?.description || "";
            return (
              <div key={item.programId} className="opd-card" role="button" tabIndex={0}
                onClick={() => onReview(item)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onReview(item); } }}
              >
                <div className="opd-card-top">
                  <span className={`opd-status ${status.tone}`}>{status.label}</span>
                  <ArrowRight size={13} aria-hidden="true" style={{ color: "var(--muted)" }} />
                </div>
                <h4>{item.programName}</h4>
                <div className="opd-card-agency">{item.administeringAgency.name}</div>
                {benefit && <div className="opd-card-benefit">{benefit}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
