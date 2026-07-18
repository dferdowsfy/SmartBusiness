"use client";

// ============================================================================
// Forms tab — versioned form-template management over the EXISTING
// form_templates track (the same templates users fill at /requirements/…).
//
// Editing creates a new DRAFT version; publishing supersedes the prior active
// version (one active per document, never overwritten). Field-level and
// cross-document validation rules live in validation_rules_json and are
// enforced by the existing validation engine on every user form.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { Btn, COLORS, StatusBadge, inputStyle, labelStyle } from "../ui";
import type { FormTemplate } from "../../../requirements/types";

interface TemplateRow extends FormTemplate {
  document_title: string | null;
  requirement_name: string | null;
  agency_name: string | null;
}

export function FormsTab({ enabled }: { enabled: boolean }) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [schemaText, setSchemaText] = useState("");
  const [rulesText, setRulesText] = useState("");

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/rk/forms");
      if (res.ok) setTemplates(((await res.json()).templates ?? []) as TemplateRow[]);
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
    window.setTimeout(() => setToast(null), 9000);
  };

  const startEdit = (t: TemplateRow) => {
    setEditing(t.id);
    setName(t.template_name ?? "");
    setSchemaText(JSON.stringify(t.schema_json ?? { sections: [] }, null, 2));
    setRulesText(JSON.stringify(t.validation_rules_json ?? {}, null, 2));
  };

  const saveDraft = async (t: TemplateRow) => {
    let schemaJson: unknown;
    let validationRulesJson: unknown;
    try {
      schemaJson = JSON.parse(schemaText);
      validationRulesJson = rulesText.trim() ? JSON.parse(rulesText) : undefined;
    } catch {
      notify("Invalid JSON — fix the syntax first.");
      return;
    }
    setBusy(t.id);
    try {
      const res = await fetch("/api/rk/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_draft", templateId: t.id, templateName: name, schemaJson, validationRulesJson }),
      });
      const data = await res.json();
      if (!res.ok) notify(`Failed: ${data.error}`);
      else {
        notify(`Saved as draft v${data.template.template_version}. Publish it to supersede the active version.`);
        setEditing(null);
        await load();
      }
    } finally {
      setBusy(null);
    }
  };

  const act = async (t: TemplateRow, action: "publish" | "reject") => {
    if (action === "publish" && !window.confirm(`Publish "${t.template_name}" v${t.template_version}? The current active version is superseded (kept in history) and users get this version immediately.`)) return;
    setBusy(t.id + action);
    try {
      const res = await fetch("/api/rk/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, templateId: t.id }),
      });
      const data = await res.json();
      notify(data.message ?? (res.ok ? "Done." : `Failed: ${data.error}`));
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (!enabled) {
    return (
      <div style={{ color: COLORS.faint, padding: "50px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
        Form-template management needs a database. Set DATABASE_URL to enable it.
      </div>
    );
  }
  if (loading) return <div style={{ color: COLORS.faint, padding: 30, textAlign: "center" }}>Loading…</div>;

  return (
    <div>
      {toast && (
        <div style={{ background: COLORS.green + "18", border: `1px solid ${COLORS.green}66`, color: "#a7f3d0", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
          {toast}
        </div>
      )}
      <p style={{ color: COLORS.dim, fontSize: 12.5, marginTop: 0 }}>
        These templates power the fillable forms and the validation engine (required fields,
        signatures, attachments, declarations, conditional cross-field rules) at
        <code style={{ color: COLORS.text }}> /requirements</code>. Field schema lives in
        <code style={{ color: COLORS.text }}> schema_json</code>; explicit validation rules
        (requiredFields / requiredAttachments / requiredSignatures / requiredDeclarations /
        conditional) in <code style={{ color: COLORS.text }}>validation_rules_json</code>.
      </p>

      {templates.length === 0 ? (
        <div style={{ color: COLORS.faint, padding: "40px 20px", textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
          No form templates yet — seed them via data/requirements_seed.sql or the discovery agent.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {templates.map((t) => (
            <div key={t.id} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ color: COLORS.text, fontWeight: 700 }}>
                    {t.template_name ?? "(unnamed template)"} <span style={{ color: COLORS.faint, fontWeight: 400 }}>v{t.template_version}</span>
                  </div>
                  <div style={{ color: COLORS.faint, fontSize: 12, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {t.requirement_name && <span>{t.requirement_name}</span>}
                    {t.agency_name && <span>{t.agency_name}</span>}
                    <span>{t.render_mode}</span>
                    <span>{(t.schema_json?.sections ?? []).reduce((n, s) => n + s.fields.length, 0)} fields</span>
                    {t.approved_at && <span>published {new Date(t.approved_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <StatusBadge status={t.status} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Btn small onClick={() => (editing === t.id ? setEditing(null) : startEdit(t))}>
                    {editing === t.id ? "Close" : "Edit → new draft"}
                  </Btn>
                  {t.status === "draft" && (
                    <>
                      <Btn small primary disabled={busy === t.id + "publish"} onClick={() => void act(t, "publish")}>Publish</Btn>
                      <Btn small danger disabled={busy === t.id + "reject"} onClick={() => void act(t, "reject")}>Reject</Btn>
                    </>
                  )}
                </div>
              </div>

              {editing === t.id && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Template name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, maxWidth: 420 }} />
                  </div>
                  <div>
                    <label style={labelStyle}>schema_json (sections → fields: key, label, type, required, source, options, visibleWhen)</label>
                    <textarea value={schemaText} onChange={(e) => setSchemaText(e.target.value)} rows={14} style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", fontSize: 12, resize: "vertical" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>validation_rules_json (requiredFields, requiredAttachments, requiredSignatures, requiredDeclarations, conditional[])</label>
                    <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} rows={8} style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", fontSize: 12, resize: "vertical" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn primary disabled={busy === t.id} onClick={() => void saveDraft(t)}>
                      {busy === t.id ? "Saving…" : "Save as new draft version"}
                    </Btn>
                    <Btn onClick={() => setEditing(null)}>Cancel</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
