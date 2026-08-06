"use client";

// ============================================================================
// GovernmentFormActions — the modal action bar (Part 13).
//
// Replaces the old single "Add PDF to deliverables" button with Save Draft,
// Review Application, and Complete and Add to Deliverables (plus Close). None of
// these claim official submission — that language is reserved for an authorized
// integration that actually submits.
// ============================================================================

import React from "react";
import type { Lang } from "./types.ts";

export interface GovernmentFormActionsProps {
  lang: Lang;
  mode: "edit" | "review";
  onSaveDraft: () => void;
  onReview: () => void;
  onBackToEdit: () => void;
  onComplete: () => void;
  onClose: () => void;
  completing?: boolean;
}

export function GovernmentFormActions(props: GovernmentFormActionsProps) {
  const { lang, mode, onSaveDraft, onReview, onBackToEdit, onComplete, onClose, completing } = props;
  const L = (en: string, es: string) => (lang === "es" ? es : en);
  const btn: React.CSSProperties = { fontSize: 13, padding: "8px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid #cbd5e1", background: "white" };
  const primary: React.CSSProperties = { ...btn, background: "var(--brand-1, #0a2540)", color: "white", border: "none" };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
      <button type="button" style={btn} onClick={onClose}>{L("Close", "Cerrar")}</button>
      <button type="button" style={btn} onClick={onSaveDraft}>{L("Save Draft", "Guardar borrador")}</button>
      {mode === "edit" ? (
        <button type="button" style={btn} onClick={onReview}>{L("Review Application", "Revisar solicitud")}</button>
      ) : (
        <button type="button" style={btn} onClick={onBackToEdit}>{L("Back to edit", "Volver a editar")}</button>
      )}
      <button type="button" style={primary} disabled={completing} onClick={onComplete}>
        {L("Complete and Add to Deliverables", "Completar y añadir a entregables")}
      </button>
    </div>
  );
}
