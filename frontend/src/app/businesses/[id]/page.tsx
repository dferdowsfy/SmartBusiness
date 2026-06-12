"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { TopNav, ScorePill, fmtDate, fmtDateTime, statusLabel } from "../../history/ui";

interface Detail {
  business?: { id: string; name: string; notes: string | null; created_at: string };
  submissions?: any[];
  deliverables?: any[];
  error?: string;
}

export default function BusinessDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [d, setD] = useState<Detail | null>(null);
  useEffect(() => { fetch(`/api/businesses/${id}`).then((r) => r.json()).then(setD); }, [id]);

  if (!d) return <div className="min-h-screen bg-slate-50"><TopNav active="businesses" /><div className="p-10 text-center text-[#0A2540]/50">Loading…</div></div>;
  if (d.error || !d.business) return (
    <div className="min-h-screen bg-slate-50"><TopNav active="businesses" />
      <div className="p-10 text-center text-[#0A2540]/50">Business not found.</div>
    </div>
  );

  const b = d.business;

  const downloadDeliverable = async (delivId: string) => {
    const res = await fetch(`/api/deliverables/${delivId}`);
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav active="businesses" />
      <div className="max-w-5xl mx-auto px-5 py-8">
        <Link href="/businesses" className="text-sm text-[#0D9488] font-medium">← My Businesses</Link>
        <div className="flex items-end justify-between mt-2 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0A2540]">{b.name}</h1>
            <p className="text-xs text-[#0A2540]/50">Added {fmtDate(b.created_at)}</p>
          </div>
          <Link href={`/?business=${b.id}`} className="bg-[#0D9488] text-white rounded-full px-5 py-2 text-sm font-medium">
            Start new assessment →
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
          <div className="font-bold text-[#0A2540] mb-3">Submissions ({(d.submissions || []).length})</div>
          {(d.submissions || []).length === 0 ? (
            <div className="text-sm text-[#0A2540]/50 py-4">No assessments for this business yet.</div>
          ) : (
            <div className="space-y-2">
              {d.submissions!.map((s) => (
                <Link key={s.id} href={`/history/${s.id}`}
                  className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3 hover:bg-slate-50">
                  <div>
                    <div className="text-sm font-medium text-[#0A2540]">{fmtDate(s.created_at)}</div>
                    <div className="text-xs text-[#0A2540]/60">
                      {s.municipality || "—"} · {s.business_type || "—"} · {s.business_structure || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ScorePill score={s.readiness_score} />
                    <span className="text-xs text-[#0A2540]/60">{statusLabel(s.readiness_score, s.readiness_status)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="font-bold text-[#0A2540] mb-3">Deliverable Library</div>
          {(d.deliverables || []).length === 0 ? (
            <div className="text-sm text-[#0A2540]/50 py-4">
              Generated reports and packages will appear here once you save them from an assessment.
            </div>
          ) : (
            <div className="space-y-2">
              {d.deliverables!.map((dv) => (
                <div key={dv.id} className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-[#0A2540]">{dv.filename}</div>
                    <div className="text-xs text-[#0A2540]/50">{dv.kind} · {fmtDateTime(dv.generated_at)}</div>
                  </div>
                  <button onClick={() => downloadDeliverable(dv.id)}
                    className="text-xs px-3 py-1.5 rounded-full border border-[#0A2540] text-[#0A2540] hover:bg-[#0A2540] hover:text-white">
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
