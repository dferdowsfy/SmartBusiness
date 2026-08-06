"use client";

// ============================================================================
// GovernmentFormModal — self-contained worksheet modal for a single government
// form (Parts 13–14). Encapsulates the renderer, review/preview toggle, action
// bar, completion validation, canonical write-back, and preparation-PDF export
// so the host page only manages "which form is open" and the prepared-app list.
// ============================================================================

import React, { useMemo, useState } from "react";
import { GovernmentFormRenderer } from "./GovernmentFormRenderer.tsx";
import { GovernmentFormPreview } from "./GovernmentFormPreview.tsx";
import { GovernmentFormActions } from "./GovernmentFormActions.tsx";
import { validateForm, type FieldError } from "./formValidation.ts";
import { prefillFromCanonical, writeBackToCanonical } from "./canonicalMapping.ts";
import { buildGeneratedApplication } from "./application.ts";
import { generatePreparationPdf } from "./pdfGenerator.ts";
import { feeEstimateFor } from "./fees.ts";
import type {
  CanonicalApplicationData,
  DigitalFormDefinition,
  FormData,
  GeneratedApplication,
  Lang,
} from "./types.ts";
import { localize } from "./types.ts";

export interface GovernmentFormModalProps {
  definition: DigitalFormDefinition;
  requirementCode: string;
  canonical: CanonicalApplicationData;
  lang: Lang;
  initialData?: FormData;
  initialMode?: "edit" | "view";
  existingApplicationId?: string;
  onClose: () => void;
  onSaveDraft: (formId: string, data: FormData) => void;
  onCanonicalChange: (canonical: CanonicalApplicationData, changedKeys: string[]) => void;
  onComplete: (app: GeneratedApplication, data: FormData) => void;
}

export function GovernmentFormModal(props: GovernmentFormModalProps) {
  const { definition, canonical, lang, initialData, initialMode, existingApplicationId, onClose, onSaveDraft, onCanonicalChange, onComplete } = props;
  const L = (en: string, es: string) => (lang === "es" ? es : en);

  const [data, setData] = useState<FormData>(() => prefillFromCanonical(definition, canonical, initialData ?? {}));
  const [mode, setMode] = useState<"edit" | "review" | "view">(initialMode ?? "edit");
  const [errors, setErrors] = useState<FieldError[]>([]);

  const fee = useMemo(() => feeEstimateFor(definition, canonical), [definition, canonical]);

  const setField = (fieldId: string, value: unknown) => {
    setData((prev) => ({ ...prev, [fieldId]: value as never }));
  };

  const persistCanonical = () => {
    const { canonical: updated, changedKeys } = writeBackToCanonical(definition, data, canonical);
    if (changedKeys.length > 0) onCanonicalChange(updated, changedKeys);
    return updated;
  };

  const handleSaveDraft = () => {
    persistCanonical();
    onSaveDraft(definition.id, data);
  };

  const handleComplete = () => {
    const found = validateForm(definition, data, canonical);
    if (found.length > 0) {
      setErrors(found);
      setMode("edit");
      return;
    }
    setErrors([]);
    const updated = persistCanonical();
    const app = buildGeneratedApplication(definition, data, updated, { id: existingApplicationId, status: "prepared", lang });
    onComplete(app, data);
  };

  const downloadPdf = () => {
    const blob = generatePreparationPdf(definition, data, canonical, lang);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${definition.officialFormNumber}_${localize(definition.title, lang).replace(/\s+/g, "_")}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const readOnly = mode === "view";

  return (
    <div role="dialog" aria-modal="true" data-requirement={props.requirementCode} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }}>
      <div style={{ background: "var(--surface, white)", borderRadius: 12, maxWidth: 820, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#64748b" }}>{definition.agency} · {definition.officialFormNumber}</div>
          <h2 style={{ fontSize: 18, margin: "3px 0" }}>{localize(definition.title, lang)}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 11, background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", borderRadius: 999, padding: "2px 8px" }}>
              ✓ {L("Fields extracted from official PDF", "Campos extraídos del PDF oficial")}
            </span>
            {fee !== null && (
              <span style={{ fontSize: 11, color: "#475569" }}>
                {L("Estimated fee", "Tarifa estimada")}: ${fee} · {L("requires portal verification", "requiere verificación en el portal")}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11.5, color: "#64748b", margin: "6px 0 0" }}>
            {L(
              "SmartPR prepares this application from your shared business information. A prepared application is not an approved permit, license, certificate, or government-issued document.",
              "SmartPR prepara esta solicitud con su información comercial compartida. Una solicitud preparada no es un permiso, licencia, certificado ni documento emitido por el gobierno."
            )}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: 20, maxHeight: "62vh", overflowY: "auto" }}>
          {mode === "review" || mode === "view" ? (
            <GovernmentFormPreview definition={definition} formData={data} canonical={canonical} lang={lang} />
          ) : (
            <GovernmentFormRenderer definition={definition} formData={data} canonical={canonical} lang={lang} errors={errors} onChange={setField} />
          )}
          {errors.length > 0 && mode === "edit" && (
            <div style={{ marginTop: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, fontSize: 12, color: "#991b1b" }}>
              <strong>{L("Please complete the required fields:", "Complete los campos obligatorios:")}</strong>
              <ul style={{ margin: "4px 0 0 18px" }}>
                {errors.slice(0, 8).map((e, i) => <li key={i}>{localize(e.message, lang)}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 8 }}>
          {(mode === "review" || mode === "view") && (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-start" }}>
              <button type="button" onClick={downloadPdf} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}>
                {L("Download preparation PDF", "Descargar PDF de preparación")}
              </button>
            </div>
          )}
          {readOnly ? (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}>{L("Close", "Cerrar")}</button>
              <button type="button" onClick={() => setMode("edit")} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--brand-1, #0a2540)", color: "white", cursor: "pointer" }}>{L("Edit Form", "Editar formulario")}</button>
            </div>
          ) : (
            <GovernmentFormActions
              lang={lang}
              mode={mode === "review" ? "review" : "edit"}
              onSaveDraft={handleSaveDraft}
              onReview={() => setMode("review")}
              onBackToEdit={() => setMode("edit")}
              onComplete={handleComplete}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
