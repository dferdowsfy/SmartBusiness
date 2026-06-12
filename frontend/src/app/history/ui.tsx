"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface MeUser { id: string; email: string | null; name: string | null; avatar: string | null }

// Primary navigation shared across the compliance workspace. Shows the
// signed-in user (or a Sign-in CTA) on the right.
export function TopNav({ active }: { active: "dashboard" | "businesses" | "history" | "graph" | "admin" }) {
  // Knowledge Graph is an internal/admin surface — intentionally not linked
  // from user-facing navigation. Reach it directly at /admin/knowledge-base.
  const items: { key: string; label: string; href: string }[] = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "businesses", label: "My Businesses", href: "/businesses" },
    { key: "history", label: "History", href: "/history" },
  ];
  const [user, setUser] = useState<MeUser | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => setUser(d.user || null)).catch(() => setUser(null));
  }, []);

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center gap-1">
        <Link href="/" className="font-bold text-[#0A2540] mr-4">SmartPR</Link>
        {items.map((it) => (
          <Link key={it.key} href={it.href}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              active === it.key ? "bg-[#0A2540] text-white" : "text-[#0A2540]/70 hover:bg-slate-100"
            }`}
          >{it.label}</Link>
        ))}
        <div className="flex-1" />
        {user === undefined ? null : user ? (
          <div className="flex items-center gap-2 text-sm">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#0A2540] text-white flex items-center justify-center text-xs font-bold">
                {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="hidden sm:block text-[#0A2540]/70 max-w-[140px] truncate">{user.name || user.email}</span>
            <a href="/auth/signout" className="text-xs text-[#0A2540]/60 hover:text-[#0A2540]">Sign out</a>
          </div>
        ) : (
          <Link href="/auth/login" className="bg-[#0A2540] text-white rounded-lg px-3 py-1.5 text-sm font-medium">Sign in</Link>
        )}
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
