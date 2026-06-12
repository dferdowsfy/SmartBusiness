"use client";

import Link from "next/link";

// Primary navigation shared across the compliance workspace.
export function TopNav({ active }: { active: "dashboard" | "history" | "graph" | "admin" }) {
  const items: { key: string; label: string; href: string }[] = [
    { key: "dashboard", label: "Dashboard", href: "/" },
    { key: "history", label: "History", href: "/history" },
    { key: "graph", label: "Knowledge Graph", href: "/admin/knowledge-base" },
    { key: "admin", label: "Admin", href: "/admin/knowledge-base" },
  ];
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center gap-1">
        <div className="font-bold text-[#0A2540] mr-4">SmartPR</div>
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              active === it.key ? "bg-[#0A2540] text-white" : "text-[#0A2540]/70 hover:bg-slate-100"
            }`}
          >
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return String(s);
  }
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return String(s);
  }
}

// Display status: prefer the stored readiness status, else derive from score.
export function statusLabel(score: number | null | undefined, stored?: string | null): string {
  if (stored) return stored;
  if (score == null) return "In Progress";
  if (score >= 90) return "Ready For Submission";
  if (score >= 70) return "Nearly Ready";
  if (score >= 40) return "Needs Documents";
  return "Missing Requirements";
}

export function scoreColor(score: number | null | undefined): string {
  if (score == null) return "#64748b";
  if (score >= 90) return "#10b981";
  if (score >= 70) return "#0d9488";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

export function ScorePill({ score }: { score: number | null | undefined }) {
  const c = scoreColor(score);
  return (
    <span style={{ background: c + "1a", color: c, border: `1px solid ${c}55` }} className="rounded-full px-2.5 py-0.5 text-sm font-bold">
      {score == null ? "—" : `${score}%`}
    </span>
  );
}

// "Connect a database" notice when capture isn't enabled.
export function NotConnected() {
  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 rounded-2xl border border-amber-200 bg-amber-50">
      <div className="font-semibold text-amber-800">No submission history yet</div>
      <p className="text-sm text-amber-700/90 mt-1">
        Submission history appears here once the capture database is connected and you complete an assessment.
        Each readiness assessment you run is saved automatically — revisit, compare, and resume them from this workspace.
      </p>
    </div>
  );
}
