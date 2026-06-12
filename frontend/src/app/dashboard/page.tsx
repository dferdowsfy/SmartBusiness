"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopNav, ScorePill, fmtDateTime } from "../history/ui";

interface Dash {
  enabled: boolean;
  user?: { id: string; email: string | null; name: string | null };
  metrics?: { businesses: number; submissions: number; documents: number; avgReadiness: number | null };
  recent?: { event: string; kind: string; created_at: string; submission_id: string }[];
  businesses?: { id: string; name: string; readiness_score: number | null }[];
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="text-3xl font-extrabold" style={{ color: accent }}>{value}</div>
      <div className="text-xs text-[#0A2540]/60 mt-1">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => { fetch("/api/dashboard").then((r) => r.json()).then(setD).catch(() => setD({ enabled: false })); }, []);

  if (!d) return <div className="min-h-screen bg-slate-50"><TopNav active="dashboard" /><div className="p-10 text-center text-[#0A2540]/50">Loading…</div></div>;

  const m = d.metrics || { businesses: 0, submissions: 0, documents: 0, avgReadiness: null };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav active="dashboard" />
      <div className="max-w-6xl mx-auto px-5 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0A2540]">Welcome back{d.user?.name ? `, ${d.user.name}` : ""}</h1>
            <p className="text-sm text-[#0A2540]/60">Your compliance workspace.</p>
          </div>
          <Link href="/" className="bg-[#0D9488] text-white rounded-full px-5 py-2 text-sm font-medium">Start new assessment →</Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Metric label="My Businesses" value={m.businesses} accent="#3b82f6" />
          <Metric label="My Submissions" value={m.submissions} accent="#0d9488" />
          <Metric label="Documents Uploaded" value={m.documents} accent="#10b981" />
          <Metric label="Average Readiness" value={m.avgReadiness == null ? "—" : `${m.avgReadiness}%`} accent="#f59e0b" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-3">
              <div className="font-bold text-[#0A2540]">My Businesses</div>
              <Link href="/businesses" className="text-xs text-[#0D9488] font-medium">View all →</Link>
            </div>
            {(d.businesses || []).length === 0 ? (
              <div className="text-sm text-[#0A2540]/50 py-6 border border-dashed rounded-xl text-center">
                You haven't added any businesses yet.<br />
                <Link href="/businesses" className="text-[#0D9488] font-medium">Add your first business →</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {d.businesses!.map((b) => (
                  <Link key={b.id} href={`/businesses/${b.id}`}
                    className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3 hover:bg-slate-50">
                    <span className="font-medium text-[#0A2540]">{b.name}</span>
                    <ScorePill score={b.readiness_score} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="font-bold text-[#0A2540] mb-3">Recent Activity</div>
            {(d.recent || []).length === 0 ? (
              <div className="text-xs text-[#0A2540]/40">No activity yet.</div>
            ) : (
              <ol className="space-y-2 text-sm">
                {d.recent!.map((r, i) => (
                  <li key={i}>
                    <Link href={`/history/${r.submission_id}`} className="block hover:bg-slate-50 rounded-lg p-2 -mx-2">
                      <div className="text-[#0A2540]">{r.event}</div>
                      <div className="text-xs text-[#0A2540]/50">{fmtDateTime(r.created_at)}</div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
