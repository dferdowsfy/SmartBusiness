"use client";

// ============================================================================
// GovernmentFormPreview — polished, bilingual, PDF-like read-only preview
// (Part 14). Always rendered from structured data so it survives refreshes.
// Carries the mandatory disclaimer that this is a preparation, not a filing.
// ============================================================================

import React from "react";
import { evaluateConditions } from "./formConditions.ts";
import { governmentFeeText } from "../submission/pr.ts";
import type {
  CanonicalAddress,
  CanonicalApplicationData,
  DigitalFormDefinition,
  FormData,
  Lang,
  PartyRecord,
} from "./types.ts";
import { localize } from "./types.ts";

function renderValue(value: unknown, lang: Lang): string {
  if (value === undefined || value === null || value === "") return "—";
  if (value === true) return lang === "es" ? "Sí" : "Yes";
  if (value === false) return "No";
  if (Array.isArray(value)) return value.map((p) => (p as PartyRecord).fullName || "—").join("; ");
  if (typeof value === "object") {
    const a = value as CanonicalAddress;
    if ("line1" in a) return [a.line1, a.line2, a.cityOrMunicipality, a.stateOrTerritory, a.postalCode, a.country].filter(Boolean).join(", ");
    return JSON.stringify(value);
  }
  return String(value);
}

export interface GovernmentFormPreviewProps {
  definition: DigitalFormDefinition;
  formData: FormData;
  canonical: CanonicalApplicationData;
  lang: Lang;
  preparedAt?: string;
}

export function GovernmentFormPreview(props: GovernmentFormPreviewProps) {
  const { definition, formData, canonical, lang, preparedAt } = props;
  const L = (en: string, es: string) => (lang === "es" ? es : en);
  const fee = governmentFeeText(definition.id, canonical, lang);
  const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "40% 60%", gap: 8, fontSize: 12.5, padding: "3px 0", borderBottom: "1px solid #f1f5f9" };

  return (
    <div style={{ background: "white", padding: 20, borderRadius: 8, border: "1px solid #e2e8f0" }}>
      <div style={{ borderBottom: "2px solid #0a2540", paddingBottom: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#64748b" }}>{definition.agency} · {definition.officialFormNumber}</div>
        <h2 style={{ fontSize: 18, margin: "2px 0" }}>{localize(definition.title, lang)}</h2>
        <div style={{ fontSize: 11, color: "#64748b" }}>
          {L("Entity type", "Tipo de entidad")}: {canonical.business.entityType} · v{definition.version}
        </div>
      </div>

      <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 6, padding: 10, marginBottom: 14, fontSize: 12, color: "#9a3412" }}>
        <strong>{L("Prepared for submission through SmartPR.", "Preparado para presentación a través de SmartPR.")}</strong>
        <div style={{ marginTop: 3 }}>
          {L(
            `This is a prepared draft. It has not been submitted to or accepted by ${definition.agency}, and it is not an agency-issued document.`,
            `Este es un borrador preparado. No se ha presentado ni ha sido aceptado por ${definition.agency}, y no es un documento emitido por la agencia.`
          )}
        </div>
      </div>

      {definition.sections.map((section) => {
        if (!evaluateConditions(section.visibleWhen, formData, canonical)) return null;
        const fields = section.fields.filter((f) => f.type !== "heading" && f.type !== "statutory_text" && evaluateConditions(f.visibleWhen, formData, canonical));
        if (fields.length === 0) return null;
        return (
          <div key={section.id} style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0a2540", margin: "0 0 4px" }}>{localize(section.title, lang)}</h3>
            {fields.map((f) => (
              <div key={f.id} style={row}>
                <span style={{ color: "#475569" }}>{f.label ? localize(f.label, lang) : f.id}</span>
                <span>{renderValue((formData as Record<string, unknown>)[f.id], lang)}</span>
              </div>
            ))}
          </div>
        );
      })}

      {definition.attachments && definition.attachments.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0a2540", margin: "0 0 4px" }}>{L("Attachments", "Documentos adjuntos")}</h3>
          {definition.attachments.map((a) => (
            <div key={a.id} style={row}>
              <span style={{ color: "#475569" }}>{localize(a.label, lang)}</span>
              <span>{(formData as Record<string, unknown>)[a.id] ? "✓" : "—"}</span>
            </div>
          ))}
        </div>
      )}

      {definition.notices?.map((n, i) => (
        <p key={i} style={{ fontSize: 11.5, color: "#475569", background: "#f8fafc", padding: 8, borderRadius: 6 }}>{localize(n, lang)}</p>
      ))}

      <div style={{ marginTop: 14, borderTop: "1px solid #e2e8f0", paddingTop: 10, fontSize: 11, color: "#64748b", display: "grid", gap: 3 }}>
        <div>{L("Schema version", "Versión del esquema")}: {definition.version} · {L("Source", "Fuente")}: {definition.sourceDocument}</div>
        <div>{L("Submission method", "Método de presentación")}: {definition.submissionMethod}</div>
        {fee !== null && <div>{L("Government filing fee", "Tarifa gubernamental de radicación")}: {fee} ({L("paid to the agency at submission", "se paga a la agencia al presentar")})</div>}
        <div>{L("Prepared", "Preparado")}: {preparedAt ? new Date(preparedAt).toLocaleString() : new Date().toLocaleString()}</div>
      </div>
    </div>
  );
}
