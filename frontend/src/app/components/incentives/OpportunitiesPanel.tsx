"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Info, Lightbulb, RefreshCw } from "lucide-react";
import { normalizeProjectProfileForIncentives, type ExistingSmartPrProfile } from "../../incentives/profile";
import type {
  IncentiveAssessment,
  IncentiveFollowUpQuestion,
  ProjectFactValue,
} from "../../incentives/types";

type Language = "en" | "es";

const TYPE_LABELS: Record<string, string> = {
  incentive: "Incentive",
  tax_incentive: "Tax incentive",
  tax_credit: "Tax credit",
  tax_exemption: "Tax exemption",
  grant: "Grant",
  reimbursement_program: "Reimbursement program",
  funding_program: "Funding program",
};

function statusLabel(status: string, language: Language): string {
  const labels: Record<string, [string, string]> = {
    likely_eligible: ["Likely eligible", "Probablemente elegible"],
    potentially_eligible: ["Potentially eligible · needs information", "Potencialmente elegible · falta información"],
    unlikely_eligible: ["Unlikely eligible", "Probablemente no elegible"],
    not_eligible: ["Not eligible", "No elegible"],
  };
  const label = labels[status] ?? [status, status];
  return language === "es" ? label[1] : label[0];
}

function FollowUpInput({
  item,
  value,
  language,
  inputId,
  onChange,
}: {
  item: IncentiveFollowUpQuestion;
  value: ProjectFactValue;
  language: Language;
  inputId: string;
  onChange: (value: ProjectFactValue) => void;
}) {
  if (item.answerType === "boolean") {
    return (
      <div className="opp-answer-buttons">
        <button id={inputId} type="button" className={value === true ? "active" : ""} onClick={() => onChange(true)}>
          {language === "es" ? "Sí" : "Yes"}
        </button>
        <button type="button" className={value === false ? "active" : ""} onClick={() => onChange(false)}>
          {language === "es" ? "No" : "No"}
        </button>
      </div>
    );
  }
  if (item.answerType === "single_select") {
    return (
      <select id={inputId} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || null)}>
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
      onChange={(event) => onChange(item.answerType === "number"
        ? event.target.value === "" ? null : Number(event.target.value)
        : event.target.value || null)}
    />
  );
}

export function OpportunitiesPanel({
  profile,
  facts,
  language,
  verifiedEvidenceTypeIds = [],
  initialAssessment = null,
  onAssessmentChange,
  onFactChange,
}: {
  profile: ExistingSmartPrProfile;
  facts: Record<string, ProjectFactValue>;
  language: Language;
  verifiedEvidenceTypeIds?: string[];
  initialAssessment?: IncentiveAssessment | null;
  onAssessmentChange?: (assessment: IncentiveAssessment) => void;
  onFactChange: (key: string, value: ProjectFactValue) => void;
}) {
  const normalizedProfile = useMemo(
    () => normalizeProjectProfileForIncentives(profile, facts),
    [profile, facts]
  );
  const [assessment, setAssessment] = useState<IncentiveAssessment | null>(initialAssessment);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      void fetch("/api/incentives/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: normalizedProfile, verifiedEvidenceTypeIds }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("evaluation_failed");
          return response.json() as Promise<IncentiveAssessment>;
        })
        .then((data) => {
          setAssessment(data);
          onAssessmentChange?.(data);
        })
        .catch((reason) => {
          if (reason instanceof DOMException && reason.name === "AbortError") return;
          setError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedProfile, verifiedEvidenceTypeIds, onAssessmentChange]);

  const opportunities = assessment?.opportunities ?? [];
  return (
    <section className="opp-panel" aria-labelledby="opportunities-heading">
      <style>{`
        .opp-panel{margin-top:16px;background:var(--surface,#fff);border:1px solid var(--border,#d9d4ca);border-radius:var(--radius,16px);overflow:hidden}
        .opp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:20px;border-bottom:1px solid var(--border,#d9d4ca)}
        .opp-kicker{display:flex;align-items:center;gap:7px;color:var(--accent,#0f766e);font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;margin-bottom:5px}
        .opp-head h2{font-family:var(--font-display,Georgia,serif);font-size:24px;line-height:1.15;margin:0;color:var(--ink,#171714)}
        .opp-head p{max-width:720px;margin:7px 0 0;color:var(--muted,#69665f);font-size:13px;line-height:1.55}
        .opp-count{white-space:nowrap;border:1px solid color-mix(in srgb,var(--accent,#0f766e) 55%,transparent);border-radius:999px;padding:7px 12px;color:var(--accent,#0f766e);font-size:12px;font-weight:700}
        .opp-body{padding:16px 20px 20px}
        .opp-state{display:flex;align-items:flex-start;gap:11px;padding:16px;border:1px dashed var(--border,#d9d4ca);border-radius:12px;color:var(--muted,#69665f);font-size:13px;line-height:1.55;background:var(--surface-2,#faf8f2)}
        .opp-list{display:grid;gap:12px}
        .opp-card{border:1px solid var(--border,#d9d4ca);border-radius:12px;padding:16px;background:var(--surface,#fff)}
        .opp-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
        .opp-card h3{font-size:17px;margin:2px 0 3px;color:var(--ink,#171714)}
        .opp-type{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#69665f)}
        .opp-agency{font-size:12px;color:var(--muted,#69665f)}
        .opp-status{border-radius:999px;background:#e7f5f1;color:#0f766e;padding:5px 9px;font-size:11px;font-weight:800;white-space:nowrap}
        .opp-status.potentially_eligible{background:#fff5df;color:#9a6700}
        .opp-summary{margin:12px 0 0;color:var(--ink,#171714);font-size:13px;line-height:1.55}
        .opp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
        .opp-note{padding:10px 12px;border-radius:9px;background:var(--surface-2,#faf8f2);font-size:12px;line-height:1.45;color:var(--muted,#69665f)}
        .opp-note b{display:block;color:var(--ink,#171714);margin-bottom:3px}
        .opp-card details{margin-top:12px;border-top:1px solid var(--border,#d9d4ca);padding-top:10px}
        .opp-card summary{cursor:pointer;color:var(--accent,#0f766e);font-size:12px;font-weight:700}
        .opp-excluded{margin-top:14px;border-top:1px solid var(--border,#d9d4ca);padding-top:12px}.opp-excluded summary{cursor:pointer;color:var(--muted,#69665f);font-size:12px;font-weight:700}
        .opp-detail{display:grid;gap:10px;margin-top:10px;font-size:12px;line-height:1.5;color:var(--muted,#69665f)}
        .opp-detail strong{color:var(--ink,#171714)}
        .opp-detail ul{margin:4px 0 0;padding-left:18px}
        .opp-source{display:inline-flex;align-items:center;gap:4px;color:var(--accent,#0f766e);text-decoration:underline;text-underline-offset:2px}
        .opp-questions{margin-top:14px;border-top:1px solid var(--border,#d9d4ca);padding-top:14px}
        .opp-questions h3{font-size:14px;margin:0 0 4px}.opp-questions>p{font-size:12px;color:var(--muted,#69665f);margin:0 0 10px}
        .opp-question{display:grid;grid-template-columns:minmax(0,1fr) minmax(160px,260px);align-items:center;gap:14px;padding:10px 0;border-top:1px solid color-mix(in srgb,var(--border,#d9d4ca) 70%,transparent)}
        .opp-question:first-of-type{border-top:0}.opp-question label{font-size:13px;font-weight:650;color:var(--ink,#171714)}.opp-question small{display:block;font-weight:400;color:var(--muted,#69665f);margin-top:3px}
        .opp-question input,.opp-question select{width:100%;border:1px solid var(--border,#d9d4ca);border-radius:8px;background:var(--surface,#fff);padding:8px 10px;font:inherit;color:var(--ink,#171714)}
        .opp-answer-buttons{display:grid;grid-template-columns:1fr 1fr;gap:6px}.opp-answer-buttons button{border:1px solid var(--border,#d9d4ca);background:var(--surface,#fff);border-radius:8px;padding:8px;cursor:pointer}.opp-answer-buttons button.active{background:var(--accent,#0f766e);border-color:var(--accent,#0f766e);color:#fff}
        .opp-foot{margin-top:13px;display:flex;align-items:flex-start;gap:7px;color:var(--muted,#69665f);font-size:11px;line-height:1.45}
        @media(max-width:720px){.opp-head{padding:17px 16px;display:block}.opp-count{display:inline-flex;margin-top:11px}.opp-body{padding:14px 16px 17px}.opp-grid{grid-template-columns:1fr}.opp-card-top{display:block}.opp-status{display:inline-flex;margin-top:8px}.opp-question{grid-template-columns:1fr;gap:7px}}
      `}</style>
      <div className="opp-head">
        <div>
          <div className="opp-kicker"><Lightbulb size={14} aria-hidden="true" /> {language === "es" ? "Oportunidades" : "Opportunities"}</div>
          <h2 id="opportunities-heading">{language === "es" ? "Lo que podría calificar" : "What you may qualify for"}</h2>
          <p>{language === "es"
            ? "SmartPR evalúa programas publicados y respaldados por fuentes usando los mismos datos confirmados de su proyecto. Los resultados son una evaluación, no una garantía."
            : "SmartPR evaluates published, source-backed programs against the same confirmed project facts. Results are an eligibility screen, not a guarantee."}</p>
        </div>
        <span className="opp-count">{loading ? "…" : opportunities.length} {language === "es" ? "identificadas" : "identified"}</span>
      </div>
      <div className="opp-body" aria-live="polite">
        {loading && (
          <div className="opp-state"><RefreshCw size={17} className="spr-spin" aria-hidden="true" /> {language === "es" ? "Evaluando programas publicados…" : "Evaluating published programs…"}</div>
        )}
        {!loading && error && (
          <div className="opp-state"><Info size={17} aria-hidden="true" /> {language === "es" ? "No se pudo completar la evaluación de oportunidades. Sus requisitos no se vieron afectados." : "The opportunities assessment could not be completed. Your requirements were not affected."}</div>
        )}
        {!loading && !error && opportunities.length === 0 && (
          <div className="opp-state">
            <Info size={17} aria-hidden="true" />
            <span>{language === "es"
              ? "Aún no hay programas validados publicados que coincidan. SmartPR no mostrará incentivos extraídos o no revisados como oportunidades reales."
              : assessment?.notice || "No validated published programs match the confirmed profile. SmartPR does not show extracted or unreviewed incentives as real opportunities."}</span>
          </div>
        )}
        {!loading && !error && opportunities.length > 0 && (
          <div className="opp-list">
            {opportunities.map((item) => (
              <article key={item.programId} className="opp-card">
                <div className="opp-card-top">
                  <div>
                    <div className="opp-type">{TYPE_LABELS[item.programType] || item.programType}</div>
                    <h3>{item.programName}</h3>
                    <div className="opp-agency">{item.administeringAgency.name}</div>
                  </div>
                  <span className={`opp-status ${item.eligibility}`}>{statusLabel(item.eligibility, language)} · {item.confidenceScore}%</span>
                </div>
                <p className="opp-summary">{item.shortDescription}</p>
                <div className="opp-grid">
                  <div className="opp-note"><b>{language === "es" ? "Por qué apareció" : "Why SmartPR surfaced it"}</b>{item.whySurfaced}</div>
                  <div className="opp-note"><b>{language === "es" ? "Beneficio potencial" : "Potential benefit"}</b>{item.potentialBenefit.map((benefit) => benefit.amountDescription || benefit.description).join(" · ")}</div>
                  {item.missingInformation.length > 0 && (
                    <div className="opp-note"><b>{language === "es" ? "Información faltante" : "Missing information"}</b>{item.missingInformation.map((criterion) => criterion.description).join(" · ")}</div>
                  )}
                  <div className="opp-note"><b>{language === "es" ? "Geografía" : "Geography"}</b>{item.relevantGeography.municipalityNames.join(", ") || item.relevantGeography.notes || item.relevantGeography.level}</div>
                </div>
                <details>
                  <summary>{language === "es" ? "Ver criterios, evidencia, proceso y fuentes" : "View criteria, evidence, process, and sources"}</summary>
                  <div className="opp-detail">
                    <div><strong>{language === "es" ? "Criterios" : "Criteria"}</strong><ul>{item.eligibilityCriteria.map((criterion) => <li key={criterion.criterionId}>{criterion.description} — {criterion.status.replaceAll("_", " ")}</li>)}</ul></div>
                    <div><strong>{language === "es" ? "Evidencia" : "Supporting evidence"}:</strong> {item.requiredSupportingEvidence.map((evidence) => evidence.name).join(", ") || (language === "es" ? "No especificada" : "Not specified")}</div>
                    <div><strong>{language === "es" ? "Proceso" : "Application process"}:</strong> {item.applicationProcess || (language === "es" ? "Verifique con la agencia administradora." : "Confirm with the administering agency.")}</div>
                    {item.applicationWindow && <div><strong>{language === "es" ? "Ventana" : "Application window"}:</strong> {item.applicationWindow.description}</div>}
                    <div><strong>{language === "es" ? "Fuente" : "Source"}:</strong>{" "}{item.sources.map((source, index) => <span key={source.id}>{index > 0 ? " · " : ""}<a className="opp-source" href={source.url} target="_blank" rel="noreferrer">{source.name}<ExternalLink size={11} aria-hidden="true" /></a> ({source.citation}; {language === "es" ? "verificada" : "verified"} {source.lastVerifiedAt.slice(0, 10)})</span>)}</div>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}

        {!loading && !error && (assessment?.excluded.length ?? 0) > 0 && (
          <details className="opp-excluded">
            <summary>{language === "es" ? "Programas evaluados que no parecen aplicar" : "Programs evaluated that do not appear to apply"} · {assessment!.excluded.length}</summary>
            <div className="opp-detail">
              {assessment!.excluded.map((item) => (
                <div key={item.programId}><strong>{item.programName}</strong> — {statusLabel(item.eligibility, language)}. {item.whySurfaced}</div>
              ))}
            </div>
          </details>
        )}

        {!loading && !error && (assessment?.followUpQuestions.length ?? 0) > 0 && (
          <div className="opp-questions">
            <h3>{language === "es" ? "Preguntas que pueden cambiar la evaluación" : "Questions that could change eligibility"}</h3>
            <p>{language === "es" ? "Solo preguntamos cuando una respuesta puede cambiar materialmente un resultado." : "We only ask when an answer could materially change a result."}</p>
            {assessment!.followUpQuestions.map((item) => (
              <div className="opp-question" key={item.factKey}>
                <label htmlFor={`opp-${item.factKey}`}>{item.question}<small>{item.reason}</small></label>
                <div>
                  <FollowUpInput inputId={`opp-${item.factKey}`} item={item} value={facts[item.factKey]} language={language} onChange={(value) => onFactChange(item.factKey, value)} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="opp-foot"><Info size={13} aria-hidden="true" /> {language === "es" ? "La autoridad final pertenece a la agencia administradora y a la fuente oficial vigente." : "Final eligibility and award authority remains with the administering agency and current official source."}</div>
      </div>
    </section>
  );
}
