"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createSupabaseBrowser, isAuthConfigured } from "../../../lib/supabase/client";
import { authRedirectUrl } from "../../../lib/siteUrl";

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
  // Single source of truth — never derive from window.location.origin because
  // the magic-link URL is embedded in an outbound email and must be a
  // fully-qualified, deterministic production URL.
  const redirectTo = authRedirectUrl(nextPath);

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

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Suspense fallback={<div className="p-10 text-center text-[#0A2540]/50">Loading…</div>}>
        <LoginInner />
      </Suspense>
    </div>
  );
}
