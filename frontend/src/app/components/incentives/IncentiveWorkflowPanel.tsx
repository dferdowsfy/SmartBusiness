"use client";

import { useEffect, useRef } from "react";
import { Check, ExternalLink, FileWarning, X } from "lucide-react";
import type { IncentiveEligibilityResult } from "../../incentives/types";

type Language = "en" | "es";

/** Minimal shape this panel needs from a filing's own requirement rows, to
 * cross-reference "documents SmartPR already has" against real, already-
 * tracked filing state instead of guessing. */
interface KnownRequirement {
  document_id?: string;
  status: "pending" | "uploaded" | "passed" | "warning";
}

export function IncentiveWorkflowPanel({
  result,
  language,
  knownRequirements,
  pursued,
  onPursue,
  onRemove,
  onClose,
}: {
  result: IncentiveEligibilityResult;
  language: Language;
  knownRequirements: KnownRequirement[];
  /** Whether the user has already chosen to pursue this incentive. */
  pursued: boolean;
  onPursue: (result: IncentiveEligibilityResult) => void;
  onRemove: (programId: string) => void;
  onClose: () => void;
}) {
  const es = language === "es";
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasDocument = (documentId: string) =>
    knownRequirements.some((r) => r.document_id === documentId && (r.status === "uploaded" || r.status === "passed"));

  const haveDocs = result.requiredSupportingEvidence.filter((doc) => hasDocument(doc.id));
  const missingDocs = result.requiredSupportingEvidence.filter((doc) => !hasDocument(doc.id));
  const benefitText = result.potentialBenefit.map((b) => b.amountDescription || b.description).join(" ");
  const nextAction = missingDocs.length > 0
    ? (es
        ? `Completa los documentos faltantes en tu lista de Requisitos, luego solicita a través de ${result.applicationAgency?.name || result.administeringAgency.name}.`
        : `Complete the missing documents in your Requirements checklist, then apply through ${result.applicationAgency?.name || result.administeringAgency.name}.`)
    : (es
        ? `Listo para solicitar — presenta a través de ${result.applicationAgency?.name || result.administeringAgency.name}.`
        : `Ready to apply — submit through ${result.applicationAgency?.name || result.administeringAgency.name}.`);

  return (
    <div className="iw-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`
        .iw-overlay{position:fixed;inset:0;z-index:80;background:rgba(20,18,14,.4);display:flex;align-items:flex-end;justify-content:center;padding:0}
        @media(min-width:720px){.iw-overlay{align-items:center;padding:24px}}
        .iw-panel{background:var(--surface,#fff);width:100%;max-width:620px;max-height:92vh;overflow-y:auto;border-radius:18px 18px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,.2)}
        @media(min-width:720px){.iw-panel{border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.25)}}
        .iw-head{position:sticky;top:0;background:var(--surface,#fff);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px;border-bottom:1px solid var(--border,#d9d4ca)}
        .iw-head h2{font-family:var(--font-display,Georgia,serif);font-size:19px;line-height:1.25;margin:0 0 3px;color:var(--ink,#171714)}
        .iw-head span{font-size:12px;color:var(--muted,#69665f)}
        .iw-close{background:none;border:none;cursor:pointer;color:var(--muted,#69665f);padding:6px;border-radius:8px;flex:none}
        .iw-close:hover{background:var(--surface-2,#faf8f2);color:var(--ink,#171714)}
        .iw-body{padding:20px;display:grid;gap:18px}
        .iw-section b{display:block;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--accent,#0f766e);margin-bottom:8px}
        .iw-section p{margin:0;font-size:13px;line-height:1.55;color:var(--ink,#171714)}
        .iw-doclist{display:grid;gap:6px;margin:0;padding:0;list-style:none}
        .iw-doclist li{display:flex;align-items:center;gap:8px;font-size:13px;padding:8px 10px;border-radius:8px;background:var(--surface-2,#faf8f2)}
        .iw-doclist li.have{color:#0f766e}
        .iw-doclist li.missing{color:#9a6700}
        .iw-doclist svg{flex:none}
        .iw-source{display:inline-flex;align-items:center;gap:4px;color:var(--accent,#0f766e);text-decoration:underline;text-underline-offset:2px;font-size:13px}
        .iw-next{padding:14px;border-radius:12px;background:#e7f5f1;color:#0c5f59;font-size:13.5px;font-weight:650;line-height:1.5}
        .iw-foot{position:sticky;bottom:0;background:var(--surface,#fff);padding:14px 20px;border-top:1px solid var(--border,#d9d4ca);display:flex;align-items:center;justify-content:space-between;gap:10px}
        .iw-done{background:none;border:none;color:var(--muted,#69665f);font-size:13px;font-weight:650;cursor:pointer;padding:10px 4px}
        .iw-done:hover{color:var(--ink,#171714)}
        .iw-pursue{display:inline-flex;align-items:center;gap:7px;background:var(--accent,#0f766e);color:#fff;border:none;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer}
        .iw-pursue:hover{background:#0c5f59}
        .iw-pursued-state{display:inline-flex;align-items:center;gap:10px}
        .iw-pursued-badge{display:inline-flex;align-items:center;gap:6px;color:#0f766e;font-size:13px;font-weight:700}
        .iw-remove{background:none;border:none;color:var(--muted,#69665f);font-size:12px;text-decoration:underline;cursor:pointer;padding:0}
        .iw-remove:hover{color:var(--ink,#171714)}
      `}</style>
      <div ref={panelRef} className="iw-panel" role="dialog" aria-modal="true" aria-label={result.programName} tabIndex={-1}>
        <div className="iw-head">
          <div>
            <h2>{result.programName}</h2>
            <span>{result.administeringAgency.name}</span>
          </div>
          <button type="button" className="iw-close" onClick={onClose} aria-label={es ? "Cerrar" : "Close"}><X size={18} /></button>
        </div>
        <div className="iw-body">
          <div className="iw-section">
            <b>{es ? "Requisitos de la solicitud" : "Application requirements"}</b>
            <ul className="iw-doclist">
              {result.eligibilityCriteria.map((c) => (
                <li key={c.criterionId} className={c.status === "satisfied" ? "have" : "missing"}>
                  {c.status === "satisfied" ? <Check size={14} /> : <FileWarning size={14} />} {c.description}
                </li>
              ))}
            </ul>
          </div>

          <div className="iw-section">
            <b>{es ? "Beneficio publicado" : "Published benefit"}</b>
            <p>{benefitText}</p>
          </div>

          {result.requiredSupportingEvidence.length > 0 && (
            <div className="iw-section">
              <b>{es ? "Documentos requeridos" : "Required documents"}</b>
              <ul className="iw-doclist">
                {haveDocs.map((doc) => (
                  <li key={doc.id} className="have"><Check size={14} /> {doc.name} — {es ? "ya en tu expediente" : "already on file"}</li>
                ))}
                {missingDocs.map((doc) => (
                  <li key={doc.id} className="missing"><FileWarning size={14} /> {doc.name} — {es ? "falta" : "still needed"}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="iw-section">
            <b>{es ? "Pasos de la solicitud" : "Application steps"}</b>
            <p>{result.applicationProcess || (es ? "Verifica con la agencia administradora." : "Confirm with the administering agency.")}</p>
          </div>

          <div className="iw-section">
            <b>{es ? "Plazo / fecha límite" : "Timing/deadline"}</b>
            <p>{result.applicationWindow?.description || (es ? "Continuo — sin fecha límite fija publicada. No se añadió nada al Calendario." : "Rolling — no fixed application deadline published. Nothing was added to your Calendar.")}</p>
          </div>

          <div className="iw-section">
            <b>{es ? "Fuente oficial" : "Official source"}</b>
            <p>
              {result.sources.map((s, i) => (
                <span key={s.id}>{i > 0 ? " · " : ""}<a className="iw-source" href={s.url} target="_blank" rel="noreferrer">{s.name}<ExternalLink size={11} /></a></span>
              ))}
            </p>
          </div>

          <div className="iw-next">{es ? "Siguiente paso: " : "Next action: "}{nextAction}</div>
        </div>
        <div className="iw-foot">
          <button type="button" className="iw-done" onClick={onClose}>{es ? "Cerrar" : "Close"}</button>
          {pursued ? (
            <div className="iw-pursued-state">
              <span className="iw-pursued-badge"><Check size={15} /> {es ? "Persiguiendo" : "Pursuing"}</span>
              <button type="button" className="iw-remove" onClick={() => onRemove(result.programId)}>{es ? "Eliminar" : "Remove"}</button>
            </div>
          ) : (
            <button type="button" className="iw-pursue" onClick={() => onPursue(result)}>
              {es ? "Perseguir este incentivo" : "Pursue this incentive"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
