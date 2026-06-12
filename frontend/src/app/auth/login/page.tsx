"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createSupabaseBrowser, isAuthConfigured } from "../../../lib/supabase/client";

function LoginInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const nextPath = sp.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!isAuthConfigured()) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white border border-amber-200 rounded-2xl p-6">
        <h1 className="font-bold text-amber-800">Sign-in is not configured</h1>
        <p className="text-sm text-amber-700 mt-2">
          To enable user accounts, add <code className="bg-amber-50 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and
          {" "}<code className="bg-amber-50 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your Railway service.
          You can still use SmartPR anonymously in the meantime.
        </p>
      </div>
    );
  }

  const supabase = createSupabaseBrowser();
  const redirectTo = typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
    : undefined;

  const signInOAuth = async (provider: "google" | "azure") => {
    setBusy(provider); setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, scopes: provider === "azure" ? "email" : undefined },
    });
    if (error) { setErr(error.message); setBusy(null); }
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy("magic"); setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    setBusy(null);
    if (error) setErr(error.message);
    else setSent(true);
  };

  return (
    <div className="max-w-md mx-auto mt-12 bg-white border border-slate-200 rounded-2xl p-7">
      <h1 className="text-2xl font-bold text-[#0A2540]">Sign in to SmartPR</h1>
      <p className="text-sm text-[#0A2540]/60 mt-1 mb-6">
        Save your compliance work and resume any time. No password required.
      </p>

      <div className="space-y-2">
        <button onClick={() => signInOAuth("google")} disabled={busy !== null}
          className="w-full border border-slate-300 rounded-lg py-2.5 px-4 flex items-center justify-center gap-3 font-medium text-[#0A2540] hover:bg-slate-50 disabled:opacity-50">
          <GoogleMark /> {busy === "google" ? "Redirecting…" : "Continue with Google"}
        </button>
        <button onClick={() => signInOAuth("azure")} disabled={busy !== null}
          className="w-full border border-slate-300 rounded-lg py-2.5 px-4 flex items-center justify-center gap-3 font-medium text-[#0A2540] hover:bg-slate-50 disabled:opacity-50">
          <MicrosoftMark /> {busy === "azure" ? "Redirecting…" : "Continue with Microsoft"}
        </button>
      </div>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-[#0A2540]/40">or</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {!sent ? (
        <form onSubmit={sendMagicLink} className="space-y-2">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <button type="submit" disabled={busy !== null}
            className="w-full bg-[#0A2540] text-white rounded-lg py-2.5 font-medium disabled:opacity-50">
            {busy === "magic" ? "Sending…" : "Email me a magic link"}
          </button>
        </form>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Check your inbox — we sent a sign-in link to <span className="font-semibold">{email}</span>.
        </div>
      )}

      {err && <div className="mt-3 text-xs text-red-700">{err}</div>}

      <button onClick={() => router.push("/")} className="text-xs text-[#0A2540]/60 hover:text-[#0A2540] mt-5 block mx-auto">
        Continue without an account →
      </button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 16.6 4.5 10.2 8.7 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.9 12.9-5l-6-4.9c-1.9 1.3-4.3 2.1-6.9 2.1-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.9 39.1 16.3 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.3 5.4l6 4.9c-.4.4 6.6-4.8 6.6-14.3 0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
function MicrosoftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden>
      <rect width="10" height="10" x="1" y="1" fill="#F25022" />
      <rect width="10" height="10" x="12" y="1" fill="#7FBA00" />
      <rect width="10" height="10" x="1" y="12" fill="#00A4EF" />
      <rect width="10" height="10" x="12" y="12" fill="#FFB900" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Suspense fallback={<div className="p-10 text-center text-[#0A2540]/50">Loading…</div>}>
        <LoginInner />
      </Suspense>
    </div>
  );
}
