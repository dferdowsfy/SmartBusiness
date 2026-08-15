"use client";

// Landing page for password-reset emails. Supabase exchanges the recovery
// token via the shared /auth/callback route and lands the user here with a
// short-lived recovery session. They set a new password and we're done.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser, isAuthConfigured } from "../../../lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isAuthConfigured()) { setReady(true); return; }
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    setBusy(true); setErr(null);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setErr(error.message); return; }
      setDone(true);
      setTimeout(() => router.push("/"), 1500);
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <div className="min-h-screen bg-slate-50 p-10 text-center text-[#0A2540]/50">Loading…</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto mt-12 bg-white border border-slate-200 rounded-2xl p-7">
        <h1 className="text-2xl font-bold text-[#0A2540]">Set a new password</h1>

        {!hasSession ? (
          <>
            <p className="text-sm text-[#0A2540]/70 mt-2">
              This reset link is missing or expired. Request a new one from the sign-in page.
            </p>
            <button onClick={() => router.push("/auth/login?mode=forgot")}
              className="w-full bg-[#0A2540] text-white rounded-lg py-2.5 font-medium mt-5">
              Request a new reset link
            </button>
          </>
        ) : done ? (
          <div className="mt-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            ✓ Password updated. Redirecting to your dashboard…
          </div>
        ) : (
          <>
            <p className="text-sm text-[#0A2540]/60 mt-1 mb-5">Choose a new password for your account.</p>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#0A2540]/70 mb-1">New password</label>
                <input type="password" required minLength={6} autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-[#0A2540] placeholder:text-[#0A2540]/40 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A2540]/70 mb-1">Confirm password</label>
                <input type="password" required minLength={6} autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-[#0A2540] placeholder:text-[#0A2540]/40 bg-white" />
              </div>
              <button type="submit" disabled={busy || password.length < 6}
                className="w-full bg-[#0A2540] text-white rounded-lg py-2.5 font-medium disabled:opacity-50">
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
            {err && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}
          </>
        )}
      </div>
    </div>
  );
}
