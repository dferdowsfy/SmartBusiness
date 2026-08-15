"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, Landmark, RefreshCw, LogOut, Settings, ShieldCheck } from "lucide-react";
import { ACTIVE_JURISDICTION } from "../jurisdictions";
import { createSupabaseBrowser, isAuthConfigured } from "../../lib/supabase/client";

interface MeUser { id: string; email: string | null; name: string | null; avatar: string | null }

// Sign out: navigate to the server route immediately (clears httpOnly cookies
// and 302s to /auth/login). The browser-side signOut is best-effort and is NOT
// awaited, so a hanging network call can never block the redirect.
function signOutNow() {
  try {
    if (isAuthConfigured()) void createSupabaseBrowser().auth.signOut().catch(() => {});
  } catch {
    /* server route below is the source of truth */
  }
  window.location.assign("/auth/signout");
}

// Primary navigation shared across the compliance workspace. Uses the same
// Validador app bar as the main experience so the UI is consistent everywhere.
export function TopNav({ active }: { active: "dashboard" | "businesses" | "history" | "graph" | "admin" | "settings" }) {
  const tabs = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard", Icon: Building2 },
    { key: "businesses", label: "My Businesses", href: "/businesses", Icon: Landmark },
    { key: "history", label: "History", href: "/history", Icon: RefreshCw },
    { key: "graph", label: "Knowledge Graph", href: "/admin/knowledge-base", Icon: ShieldCheck },
    { key: "admin", label: "Admin Review", href: "/admin/requirements", Icon: ShieldCheck },
  ];
  const [user, setUser] = useState<MeUser | null | undefined>(undefined); // undefined = loading
  const [menuOpen, setMenuOpen] = useState(false);
  const product = ACTIVE_JURISDICTION.meta.productName;

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => setUser(d.user || null)).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const close = () => setMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const initials = (user?.name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <header className="appbar">
      <div className="appbar-inner">
        <div className="appbar-left">
          <Link href="/" className="brand">
            <div className="brand-mark">{(product || "V").slice(0, 1)}</div>
            <div className="brand-name">{product}</div>
          </Link>
        </div>

        <nav className="nav-tabs" aria-label="Sections">
          {tabs.map(({ key, label, href, Icon }) => (
            <Link key={key} href={href} className={`nav-tab ${active === key ? "active" : ""}`}>
              <Icon className="tab-icon" /> {label}
            </Link>
          ))}
        </nav>

        <div className="appbar-actions">
          {user === undefined ? null : user ? (
            <>
              <button className="avatar" onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }} title="Account">{initials}</button>
              <div className={`user-menu ${menuOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
                <div className="uhead">
                  <div className="uname">{user.name || user.email}</div>
                  <div className="uemail">{user.email}</div>
                </div>
                <Link className="uitem" href="/settings"><Settings className="i" /> Settings</Link>
                <button type="button" className="uitem" onClick={signOutNow}><LogOut className="i" /> Sign out</button>
              </div>
            </>
          ) : (
            <Link href="/auth/login" className="nav-tab">Sign in</Link>
          )}
        </div>
      </div>
    </header>
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
