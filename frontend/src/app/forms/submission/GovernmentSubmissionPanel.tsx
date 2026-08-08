"use client";

// ============================================================================
// GovernmentSubmissionPanel — the "Application Ready" step.
//
// Shown only AFTER the applicant has completed and reviewed a digitized form,
// never at the start. It states the government filing fee, names the agency
// that receives the filing, and links to the official portal where the real
// filing and payment happen.
//
// What it deliberately does NOT do: change the application's status. Following
// the link means the application is ready to be filed externally — not that it
// was filed, approved, or that the underlying requirement is satisfied. The
// separate "I submitted this application" confirmation is the only thing that
// records a submission, and it is the applicant's own statement.
// ============================================================================

import React from "react";
import type { CanonicalApplicationData, Lang } from "../engine/types.ts";
import { localize } from "../engine/types.ts";
import {
  formatGovernmentFee,
  getGovernmentFee,
  getSubmissionDestination,
  GOVERNMENT_FEE_DISCLAIMER,
  openGovernmentPortal,
} from "./pr.ts";

export interface GovernmentSubmissionPanelProps {
  /** Official form number ("CORPREG01") or internal id ("FORM_PR_DOS_CORPREG01"). */
  formId: string;
  canonical: CanonicalApplicationData;
  lang: Lang;
  /** Applicant's own confirmation that they filed with the agency. */
  onMarkSubmitted?: () => void;
  /** True once that confirmation has been recorded. */
  submitted?: boolean;
}

export function GovernmentSubmissionPanel(props: GovernmentSubmissionPanelProps) {
  const { formId, canonical, lang, onMarkSubmitted, submitted } = props;
  const L = (en: string, es: string) => (lang === "es" ? es : en);

  const destination = getSubmissionDestination(formId);
  const fee = getGovernmentFee(formId, canonical);
  // Not a digitized form — no submission step exists for it.
  if (!destination || !fee) return null;

  return (
    <section
      data-form-id={formId}
      style={{
        border: "1px solid #a7f3d0",
        background: "#f0fdf4",
        borderRadius: 10,
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#065f46", margin: 0 }}>
          {L("Application Ready", "Solicitud Lista")}
        </h3>
        <p style={{ fontSize: 12.5, color: "#047857", margin: "3px 0 0" }}>
          {L(
            "Your application has been prepared and reviewed.",
            "Su solicitud ha sido preparada y revisada."
          )}
        </p>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#475569" }}>
            {localize(fee.label, lang)}
          </div>
          <div style={{ fontSize: fee.status === "resolved" ? 22 : 14, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
            {formatGovernmentFee(fee, lang)}
          </div>
          {fee.status === "unresolved" && (
            <div style={{ fontSize: 11.5, color: "#475569", marginTop: 3 }}>
              {L(
                "The exact fee depends on whether the entity is for-profit or nonprofit.",
                "La tarifa exacta depende de si la entidad es con o sin fines de lucro."
              )}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#475569" }}>
            {L("Submitted to", "Se presenta ante")}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>
            {localize(destination.agency, lang)}
          </div>
          <div style={{ fontSize: 12, color: "#475569" }}>{localize(destination.portalName, lang)}</div>
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: "#475569", margin: 0 }}>{localize(GOVERNMENT_FEE_DISCLAIMER, lang)}</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => openGovernmentPortal(formId)}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "9px 16px",
            borderRadius: 8,
            border: "none",
            background: "var(--brand-1, #0a2540)",
            color: "white",
            cursor: "pointer",
          }}
        >
          {L("Continue to Government Submission", "Continuar al Portal del Gobierno")} →
        </button>
        {onMarkSubmitted && !submitted && (
          <button
            type="button"
            onClick={onMarkSubmitted}
            style={{
              fontSize: 12.5,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "white",
              cursor: "pointer",
            }}
          >
            {L("I submitted this application", "Ya presenté esta solicitud")}
          </button>
        )}
        {submitted && (
          <span style={{ fontSize: 12, color: "#047857", fontWeight: 600 }}>
            ✓ {L("Marked as submitted", "Marcada como presentada")}
          </span>
        )}
      </div>

      <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
        {L(
          "Opening the portal does not submit your application. Final filing and payment are completed on the government site, and the requirement stays open until the official document is issued.",
          "Abrir el portal no presenta su solicitud. La radicación y el pago finales se completan en el sitio del gobierno, y el requisito permanece abierto hasta que se emita el documento oficial."
        )}
      </p>
    </section>
  );
}
