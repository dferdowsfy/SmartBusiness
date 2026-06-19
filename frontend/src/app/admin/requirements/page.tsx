"use client";

// ============================================================================
// PR 10 UI: Admin review queue.
//
// Lists everything needing human attention (newly discovered/changed rules,
// draft templates, open change events) and lets an admin approve/reject. Also
// provides manual triggers for the discovery and monitoring agents.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { TopNav } from "../../history/ui";
import municipalities from "../../../kb/municipalities.json";
import businessTypes from "../../../kb/business_types.json";
import { OFFICIAL_SOURCES } from "../../requirements/sources";

interface ReviewItem {
  item_kind: "rule" | "document" | "template" | "change_event";
  item_id: string;
  title: string | null;
  status: string;
  confidence_score: number | null;
  source_domain: string | null;
  source_url: string | null;
  updated_at: string;
}

const KIND_LABEL: Record<ReviewItem["item_kind"], string> = {
  rule: "Requirement rule",
  document: "Source document",
  template: "Form template",
  change_event: "Change event",
};

// Which admin actions apply to each item kind.
const ACTIONS: Record<ReviewItem["item_kind"], { action: string; label: string; primary?: boolean }[]> = {
  rule: [
    { action: "approve_rule", label: "Approve", primary: true },
    { action: "reject_rule", label: "Reject" },
    { action: "mark_source_stale", label: "Mark stale" },
  ],
  template: [
    { action: "approve_template", label: "Publish", primary: true },
    { action: "reject_template", label: "Reject" },
  ],
  change_event: [
    { action: "accept_change", label: "Accept", primary: true },
    { action: "reject_change", label: "Reject" },
  ],
  document: [],
};

const MUNICIPALITY_OPTIONS = [
  { value: "", label: "Statewide / all municipalities" },
  ...(municipalities as { name: string }[]).map((m) => ({ value: m.name, label: m.name })),
];

const BUSINESS_TYPE_OPTIONS = (businessTypes as { id: string; name: string }[]).map((bt) => ({
  value: bt.id.toLowerCase().replace(/^bt_/, "").replaceAll("_", "-"),
  label: bt.name,
}));

const SOURCE_OPTIONS = [
  { label: "All curated official sources", value: "" },
  ...OFFICIAL_SOURCES.map((source) => ({
    label: source.municipality ? `${source.agencyName} — ${source.municipality}` : source.agencyName,
    value: source.seedUrl,
  })),
];

export default function AdminRequirementsPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null = checking
  const [disc, setDisc] = useState({
    stateOrTerritory: "PR",
    municipality: "",
    businessType: "restaurant",
    seedUrl: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/requirements/admin");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const meRes = await fetch("/api/me");
      const me = await meRes.json();
      const admin = !!me?.user?.isAdmin;
      if (!active) return;
      setIsAdmin(admin);
      if (admin) await load();
      else setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const act = async (item: ReviewItem, action: string) => {
    setBusy(item.item_id + action);
    try {
      const res = await fetch("/api/requirements/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, itemId: item.item_id }),
      });
      const data = await res.json();
      setToast(data.message ?? (data.ok ? "Done." : "Failed."));
      await load();
    } finally {
      setBusy(null);
    }
  };

  const runDiscovery = async () => {
    setBusy("discover");
    try {
      const res = await fetch("/api/requirements/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stateOrTerritory: disc.stateOrTerritory,
          municipality: disc.municipality || undefined,
          businessType: disc.businessType,
          seedUrl: disc.seedUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setToast(`Discovery failed: ${data.message || data.error}`);
      } else {
        setToast(
          `Discovery complete: crawled ${data.sourcesCrawled?.length ?? 0} source(s), ` +
            `created ${data.rulesCreated} rule(s), ${data.documentsCreated} document(s), ` +
            `${data.draftTemplatesCreated} draft template(s).` +
            (data.errors?.length ? ` (${data.errors.length} warning(s))` : "")
        );
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const runMonitor = async () => {
    setBusy("monitor");
    try {
      const res = await fetch("/api/requirements/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      const changed = (data.results ?? []).filter((r: { changeDetected: boolean }) => r.changeDetected).length;
      setToast(`Monitoring run complete: ${(data.results ?? []).length} source(s) checked, ${changed} change(s) detected.`);
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav active="admin" />
      {isAdmin === false ? (
        <div className="max-w-5xl mx-auto px-5 py-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <h1 className="text-xl font-bold text-[#0A2540]">Not authorized</h1>
            <p className="mt-2 text-sm text-[#0A2540]/60">
              This area is restricted to administrators. Ask an administrator to add your account
              to <code className="rounded bg-slate-100 px-1">ADMIN_EMAILS</code>.
            </p>
          </div>
        </div>
      ) : isAdmin === null ? (
        <div className="p-10 text-center text-[#0A2540]/50">Checking access…</div>
      ) : (
        <div className="max-w-5xl mx-auto px-5 py-8">
          <div className="flex items-end justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold text-[#0A2540]">Admin Review Queue</h1>
              <p className="text-sm text-[#0A2540]/60">
                Approve discovered/changed requirements and publish form templates. New versions
                never overwrite active ones until published here.
              </p>
            </div>
            <button
              onClick={runMonitor}
              disabled={busy === "monitor"}
              className="bg-[#0A2540] text-white rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy === "monitor" ? "Running…" : "Run monitoring now"}
            </button>
          </div>

          {toast && <div className="my-3 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{toast}</div>}

          <div className="my-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-bold text-[#0A2540]">Discover requirements from official sources</div>
            <p className="mb-3 text-xs text-[#0A2540]/60">
              Crawls curated government portals (OGPe + municipalities) or an official seed URL you
              provide, extracts forms/checklists/fees, and files them as needs_review.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-xs font-medium text-[#0A2540]/70">
                State/Territory
                <input
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-[#0A2540]"
                  placeholder="State/Territory (e.g. PR)"
                  value={disc.stateOrTerritory}
                  onChange={(e) => setDisc((d) => ({ ...d, stateOrTerritory: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[#0A2540]/70">
                Municipality
                <select
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-[#0A2540]"
                  value={disc.municipality}
                  onChange={(e) => setDisc((d) => ({ ...d, municipality: e.target.value }))}
                >
                  {MUNICIPALITY_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-[#0A2540]/70">
                Business type
                <select
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-[#0A2540]"
                  value={disc.businessType}
                  onChange={(e) => setDisc((d) => ({ ...d, businessType: e.target.value }))}
                >
                  {BUSINESS_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-[#0A2540]/70">
                Official source
                <select
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-[#0A2540]"
                  value={disc.seedUrl}
                  onChange={(e) => setDisc((d) => ({ ...d, seedUrl: e.target.value }))}
                >
                  {SOURCE_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              onClick={runDiscovery}
              disabled={busy === "discover"}
              className="mt-3 rounded-full bg-[#0D9488] px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy === "discover" ? "Crawling…" : "Run discovery"}
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-[#0A2540]/50">Loading…</div>
          ) : items.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-[#0A2540]/50">
              Nothing needs review. 🎉
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.item_kind + item.item_id} className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {KIND_LABEL[item.item_kind]}
                      </span>
                      <div className="mt-1 font-semibold text-[#0A2540]">{item.title || "(untitled)"}</div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-[#0A2540]/50">
                        <span>Status: {item.status}</span>
                        {item.confidence_score != null && <span>Confidence: {Math.round(Number(item.confidence_score) * 100)}%</span>}
                        {item.source_domain && <span>Source: {item.source_domain}</span>}
                        <span>Updated: {new Date(item.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {ACTIONS[item.item_kind].map((a) => (
                        <button
                          key={a.action}
                          onClick={() => act(item, a.action)}
                          disabled={busy === item.item_id + a.action}
                          className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${
                            a.primary ? "bg-[#0D9488] text-white" : "border border-slate-300 text-[#0A2540]"
                          }`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
