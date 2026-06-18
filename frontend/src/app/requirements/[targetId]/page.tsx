"use client";

// ============================================================================
// PR 3-7 UI: Required Documents / Required Forms experience.
//
// After intake the user lands here for a target (business). It lists the
// resolved required forms with agency, source, confidence, last-verified, and
// change warnings, lets the user fill each form in-app (dynamic renderer driven
// by schema_json, with autosave + live validation), and builds the submission
// package. No download/reupload is required for the normal flow.
// ============================================================================

import { use, useCallback, useEffect, useMemo, useState } from "react";
import type {
  FormSchema,
  FormField,
  FormTemplate,
  UserFormInstance,
  ValidationResult,
} from "../types";

interface ResolvedForm {
  instanceId: string;
  status: string;
  rule: {
    id: string;
    requirement_name: string | null;
    agency_name: string | null;
    requirement_category: string | null;
    official_source_url: string | null;
    source_domain: string | null;
    confidence_score: number | null;
    status: string;
    last_checked_at: string | null;
    last_changed_at: string | null;
  } | null;
  template: { id: string; template_name: string | null; render_mode: string; template_version: number } | null;
  validation: ValidationResult | null;
}

function statusBadge(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    not_started: { label: "Not started", className: "bg-gray-100 text-gray-700" },
    in_progress: { label: "In progress", className: "bg-amber-100 text-amber-800" },
    needs_review: { label: "Needs review", className: "bg-purple-100 text-purple-800" },
    complete: { label: "Complete", className: "bg-green-100 text-green-800" },
    approved: { label: "Approved", className: "bg-green-100 text-green-800" },
    rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
  };
  return map[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
}

export default function RequiredFormsPage({ params }: { params: Promise<{ targetId: string }> }) {
  const { targetId } = use(params);
  const [forms, setForms] = useState<ResolvedForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openInstanceId, setOpenInstanceId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/requirements/forms?targetId=${encodeURIComponent(targetId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load forms");
      setForms(data.forms ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await load();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [load]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Required Forms</h1>
      <p className="mt-1 text-sm text-gray-600">
        Based on your municipality, business type, and activity, these are the required forms.
        Fill them in directly below — most fields are pre-filled from your intake.
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Readiness only. SmartPR does not approve licenses or submit forms to any agency.
      </p>

      {loading && <p className="mt-6 text-sm text-gray-500">Loading…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
      {!loading && !error && forms.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">
          No required forms resolved yet for this target.
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {forms.map((f) => {
          const badge = statusBadge(f.status);
          const changed = !!f.rule?.last_changed_at;
          const isOpen = openInstanceId === f.instanceId;
          return (
            <li key={f.instanceId || f.rule?.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium">{f.rule?.requirement_name || f.template?.template_name}</h2>
                  <p className="text-sm text-gray-600">{f.rule?.agency_name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {f.rule?.source_domain && (
                      <a className="underline" href={f.rule.official_source_url ?? "#"} target="_blank" rel="noreferrer">
                        Source: {f.rule.source_domain}
                      </a>
                    )}
                    {f.rule?.confidence_score != null && <span>Confidence: {Math.round(Number(f.rule.confidence_score) * 100)}%</span>}
                    {f.rule?.last_checked_at && <span>Verified: {new Date(f.rule.last_checked_at).toLocaleDateString()}</span>}
                  </div>
                  {changed && (
                    <p className="mt-2 rounded bg-yellow-50 px-2 py-1 text-xs text-yellow-800">
                      ⚠ This requirement recently changed and is under review.
                    </p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>{badge.label}</span>
              </div>

              {f.template ? (
                <button
                  className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  onClick={() => setOpenInstanceId(isOpen ? null : f.instanceId)}
                >
                  {isOpen ? "Close form" : "Fill form"}
                </button>
              ) : (
                <p className="mt-3 text-xs text-gray-500">No fillable form available yet — supporting document.</p>
              )}

              {isOpen && f.template && (
                <FormEditor instanceId={f.instanceId} onSaved={load} />
              )}
            </li>
          );
        })}
      </ul>

      <SubmissionPackagePanel targetId={targetId} />
    </main>
  );
}

// ---- Dynamic form editor (PR 4/5/6) ----------------------------------------

function FormEditor({ instanceId, onSaved }: { instanceId: string; onSaved: () => void }) {
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/requirements/form/${instanceId}`);
      const json: { instance: UserFormInstance; template: FormTemplate | null } = await res.json();
      setTemplate(json.template);
      setData(json.instance?.form_data_json ?? {});
      setValidation(json.instance?.validation_result_json ?? null);
      setLoaded(true);
    })();
  }, [instanceId]);

  const save = useCallback(
    async (next: Record<string, unknown>, markReview = false) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/requirements/form/${instanceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formData: next, markReview }),
        });
        const json = await res.json();
        setValidation(json.validation ?? null);
        onSaved();
      } finally {
        setSaving(false);
      }
    },
    [instanceId, onSaved]
  );

  const setField = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }));

  const schema: FormSchema | null = template?.schema_json ?? null;
  const missing = useMemo(
    () => new Set([...(validation?.missingFields ?? []), ...(validation?.missingAttachments ?? [])]),
    [validation]
  );

  if (!loaded) return <p className="mt-3 text-sm text-gray-500">Loading form…</p>;
  if (!schema) return <p className="mt-3 text-sm text-gray-500">No schema available.</p>;

  return (
    <div className="mt-4 rounded border border-gray-100 bg-gray-50 p-4">
      {schema.sections.map((section) => (
        <fieldset key={section.title} className="mb-4">
          <legend className="text-sm font-semibold text-gray-800">{section.title}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {section.fields
              .filter((field) => isVisible(field, data))
              .map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={data[field.key]}
                  invalid={missing.has(field.key)}
                  onChange={(v) => setField(field.key, v)}
                />
              ))}
          </div>
        </fieldset>
      ))}

      {validation && (
        <div className="mb-3 text-sm">
          {validation.status === "complete" ? (
            <p className="text-green-700">✓ All required fields complete.</p>
          ) : (
            <ul className="list-disc pl-5 text-amber-800">
              {validation.missingFields.map((m) => <li key={m}>Missing: {m}</li>)}
              {validation.missingAttachments.map((m) => <li key={m}>Missing attachment: {m}</li>)}
              {validation.blockingIssues.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={saving}
          onClick={() => save(data)}
        >
          {saving ? "Saving…" : "Save & validate"}
        </button>
        <button
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          disabled={saving}
          onClick={() => save(data, true)}
        >
          Submit for review
        </button>
      </div>
    </div>
  );
}

function isVisible(field: FormField, data: Record<string, unknown>): boolean {
  if (field.type === "hidden") return false;
  if (!field.visibleWhen) return true;
  return data[field.visibleWhen.field] === field.visibleWhen.equals;
}

function FieldInput({
  field,
  value,
  invalid,
  onChange,
}: {
  field: FormField;
  value: unknown;
  invalid: boolean;
  onChange: (v: unknown) => void;
}) {
  const base = `w-full rounded border px-2 py-1.5 text-sm ${invalid ? "border-red-400" : "border-gray-300"}`;
  const label = (
    <label className="mb-1 block text-xs font-medium text-gray-700">
      {field.label}
      {field.required && <span className="text-red-500"> *</span>}
    </label>
  );

  switch (field.type) {
    case "textarea":
    case "address":
      return (
        <div className="sm:col-span-2">
          {label}
          <textarea className={base} rows={2} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span className="text-sm text-gray-700">{field.label}</span>
        </div>
      );
    case "declaration":
      return (
        <div className="sm:col-span-2 flex items-start gap-2">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <span className="text-sm text-gray-700">{field.label}</span>
        </div>
      );
    case "select":
      return (
        <div>
          {label}
          <select className={base} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select…</option>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    case "file_upload":
      return (
        <div className="sm:col-span-2">
          {label}
          <input
            type="file"
            className="text-sm"
            onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")}
          />
          {typeof value === "string" && value && <p className="mt-1 text-xs text-gray-500">Attached: {value}</p>}
        </div>
      );
    case "signature":
      return (
        <div className="sm:col-span-2">
          {label}
          <input className={base} placeholder="Type full name to sign" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "number":
    case "currency":
      return (
        <div>
          {label}
          <input type="number" className={base} value={(value as number) ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
      );
    default:
      return (
        <div>
          {label}
          <input
            type={field.type === "email" ? "email" : field.type === "date" ? "date" : field.type === "phone" ? "tel" : "text"}
            className={base}
            value={(value as string) ?? ""}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
  }
}

// ---- Submission package (PR 7) ---------------------------------------------

function SubmissionPackagePanel({ targetId }: { targetId: string }) {
  const [pkg, setPkg] = useState<{ readiness: string; openIssues: string[]; forms: unknown[] } | null>(null);
  const [building, setBuilding] = useState(false);

  const build = async () => {
    setBuilding(true);
    try {
      const res = await fetch(`/api/requirements/package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      const json = await res.json();
      setPkg(json.package ?? null);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <section className="mt-10 border-t border-gray-200 pt-6">
      <h2 className="text-lg font-semibold">Submission Package</h2>
      <p className="text-sm text-gray-600">
        Combines your completed in-app forms, requirement evidence, and validation results into a
        single deliverable. Preparation only — nothing is submitted to a government portal.
      </p>
      <button
        className="mt-3 rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
        disabled={building}
        onClick={build}
      >
        {building ? "Building…" : "Build submission package"}
      </button>

      {pkg && (
        <div className="mt-4 rounded border border-gray-200 p-4 text-sm">
          <p className="font-medium">
            Readiness:{" "}
            <span className={pkg.readiness === "ready" ? "text-green-700" : "text-amber-700"}>
              {pkg.readiness === "ready" ? "Ready to assemble" : "Incomplete"}
            </span>
          </p>
          <p className="mt-1 text-gray-600">{pkg.forms.length} form(s) included.</p>
          {pkg.openIssues.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-amber-800">
              {pkg.openIssues.map((i, idx) => <li key={idx}>{i}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
