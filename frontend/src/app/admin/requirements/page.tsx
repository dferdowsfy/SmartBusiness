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

export default function AdminRequirementsPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/requirements/admin");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

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

  const runMonitor = async () => {
    setBusy("monitor");
    try {
      const res = await fetch("/api/requirements/monitor", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
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
                          a.primary
                            ? "bg-[#0D9488] text-white"
                            : "border border-slate-300 text-[#0A2540]"
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
    </div>
  );
}
