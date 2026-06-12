"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopNav, ScorePill, fmtDate } from "../history/ui";

interface Biz {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  submission_count: number;
  latest_submission_id: string | null;
  readiness_score: number | null;
}

export default function BusinessesPage() {
  const [bizzes, setBizzes] = useState<Biz[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => fetch("/api/businesses").then((r) => r.json()).then((d) => setBizzes(d.businesses || []));
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    await fetch("/api/businesses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setCreating(false); setName(""); load();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav active="businesses" />
      <div className="max-w-4xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-bold text-[#0A2540] mb-1">My Businesses</h1>
        <p className="text-sm text-[#0A2540]/60 mb-6">Group your compliance work — each business holds its own submissions, documents, and readiness history.</p>

        <form onSubmit={create} className="flex gap-2 mb-6">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New business name…"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <button type="submit" disabled={creating || !name.trim()}
            className="bg-[#0A2540] text-white rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-50">
            {creating ? "Adding…" : "Add business"}
          </button>
        </form>

        {bizzes === null ? (
          <div className="text-center text-[#0A2540]/50 py-12">Loading…</div>
        ) : bizzes.length === 0 ? (
          <div className="text-center text-[#0A2540]/50 py-12 border border-dashed rounded-2xl">
            You haven't added any businesses yet. Create one above to start grouping assessments.
          </div>
        ) : (
          <div className="space-y-2">
            {bizzes.map((b) => (
              <Link key={b.id} href={`/businesses/${b.id}`}
                className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center justify-between hover:border-[#0D9488]">
                <div>
                  <div className="font-semibold text-[#0A2540]">{b.name}</div>
                  <div className="text-xs text-[#0A2540]/50">
                    Added {fmtDate(b.created_at)} · {b.submission_count} assessment{b.submission_count === 1 ? "" : "s"}
                  </div>
                </div>
                <ScorePill score={b.readiness_score} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
