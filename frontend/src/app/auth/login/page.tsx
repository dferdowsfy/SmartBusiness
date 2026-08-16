"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createSupabaseBrowser, isAuthConfigured } from "../../../lib/supabase/client";
import { authRedirectUrl } from "../../../lib/siteUrl";

type Mode = "signin" | "signup" | "forgot";

function LoginInner() {
  const sp = useSearchParams();
  const router = useRouter();
  // Signed-in users land in the persistent portfolio. Explicit protected-route
  // redirects still return to the page the user originally requested.
  const nextPath = sp.get("next") || "/dashboard";
  const initialMode: Mode = sp.get("mode") === "signup" ? "signup" : "signin";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // True after a signUp call returns no session — i.e. the project has
  // email confirmation enabled and we're waiting on the user's inbox.
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "rate_limited">("idle");

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
  // Used for any email confirmation that Supabase may send during sign-up.
  // Set from a single source of truth so it's never localhost in production.
  const emailRedirectTo = authRedirectUrl(nextPath);
  const resetRedirectTo = authRedirectUrl("/auth/reset");

  const swapMode = (m: Mode) => { setMode(m); setErr(null); setInfo(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // forgot mode doesn't need a password
    if (mode !== "forgot" && (!email || !password)) return;
    if (mode === "forgot" && !email) return;
    setBusy(true); setErr(null); setInfo(null);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: resetRedirectTo });
        if (error) { setErr(error.message); return; }
        setInfo(`Password reset link sent to ${email}. Check your inbox.`);
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo },
        });
        if (error) { setErr(error.message); return; }
        // If the Supabase project has email confirmation disabled, signUp
        // returns an active session and we can go straight in. Otherwise the
        // user must click the confirmation link in their inbox — surface a
        // dedicated confirm-pending state with a Resend button.
        if (data.session) router.push(nextPath);
        else setNeedsConfirm(email);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Translate the most common Supabase errors into something actionable.
          const m = error.message || "";
          if (/email\s*not\s*confirmed/i.test(m)) {
            setErr(
              `This account was created but the email is still unconfirmed in Supabase. ` +
              `Fix: in Supabase → Authentication → Users, find ${email}, then either ` +
              `"Confirm" the user or delete it and sign up again. To skip confirmation entirely, ` +
              `turn off "Confirm email" in Authentication → Providers → Email.`
            );
          } else if (/invalid\s*login\s*credentials/i.test(m)) {
            setErr("Email or password is incorrect.");
          } else {
            setErr(m);
          }
          return;
        }
        router.push(nextPath);
      }
    } catch (e) {
      setErr((e as Error).message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!needsConfirm) return;
    setResendState("sending");
    const { error } = await supabase.auth.resend({
      type: "signup", email: needsConfirm, options: { emailRedirectTo },
    });
    if (error) {
      setResendState(/rate.?limit/i.test(error.message) ? "rate_limited" : "idle");
      setErr(error.message);
    } else {
      setResendState("sent");
      setErr(null);
    }
  };

  // If sign-up succeeded but Supabase is waiting on email confirmation,
  // dedicate the whole panel to that state — it's the only thing the user
  // can do next, and they need a way out (resend, switch to sign-in).
  if (needsConfirm) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-white border border-slate-200 rounded-2xl p-7">
        <h1 className="text-2xl font-bold text-[#0A2540]">Confirm your email</h1>
        <p className="text-sm text-[#0A2540]/70 mt-2">
          We sent a confirmation link to <span className="font-semibold">{needsConfirm}</span>.
          Click it to finish creating your account, then come back and sign in.
        </p>

        <div className="mt-5 space-y-2">
          <button onClick={resend} disabled={resendState === "sending"}
            className="w-full border border-slate-300 rounded-lg py-2 text-sm font-medium text-[#0A2540] hover:bg-slate-50 disabled:opacity-50">
            {resendState === "sending" ? "Resending…"
              : resendState === "sent" ? "✓ Confirmation resent"
              : resendState === "rate_limited" ? "Rate limit — try again later"
              : "Resend confirmation email"}
          </button>
          <button onClick={() => { setNeedsConfirm(null); setMode("signin"); setResendState("idle"); setErr(null); }}
            className="w-full bg-[#0A2540] text-white rounded-lg py-2 text-sm font-medium">
            I&apos;ve confirmed — sign in
          </button>
        </div>

        {err && <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <div className="font-semibold mb-1">Email not arriving?</div>
          Supabase&apos;s default email service is rate-limited and best for testing. To skip confirmation entirely, an admin can turn off
          {" "}<span className="font-mono">Confirm email</span> in Supabase → Authentication → Providers → Email.
        </div>

        <button onClick={() => router.push("/")} className="text-xs text-[#0A2540]/60 hover:text-[#0A2540] mt-5 block mx-auto">
          Continue without an account →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12 bg-white border border-slate-200 rounded-2xl p-7">
      <h1 className="text-2xl font-bold text-[#0A2540]">
        {mode === "signin" ? "Sign in to SmartPR"
          : mode === "signup" ? "Create your SmartPR account"
          : "Reset your password"}
      </h1>
      <p className="text-sm text-[#0A2540]/60 mt-1 mb-5">
        {mode === "signin" ? "Welcome back. Pick up exactly where you left off."
          : mode === "signup" ? "Save your compliance work and resume any time."
          : "Enter the email on your account and we'll send a reset link."}
      </p>

      {/* Mode toggle — hidden during forgot-password flow */}
      {mode !== "forgot" && (
        <div className="flex bg-slate-100 rounded-lg p-1 mb-5 text-sm">
          <button type="button" onClick={() => swapMode("signin")}
            className={`flex-1 py-1.5 rounded-md font-medium ${mode === "signin" ? "bg-white text-[#0A2540] shadow-sm" : "text-[#0A2540]/60"}`}>
            Sign in
          </button>
          <button type="button" onClick={() => swapMode("signup")}
            className={`flex-1 py-1.5 rounded-md font-medium ${mode === "signup" ? "bg-white text-[#0A2540] shadow-sm" : "text-[#0A2540]/60"}`}>
            Create account
          </button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#0A2540]/70 mb-1">Email</label>
          <input type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-[#0A2540] placeholder:text-[#0A2540]/40 bg-white" />
        </div>
        {mode !== "forgot" && (
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="block text-xs font-semibold text-[#0A2540]/70">Password</label>
              {mode === "signin" && (
                <button type="button" onClick={() => swapMode("forgot")}
                  className="text-xs text-[#0D9488] font-medium hover:underline">
                  Forgot password?
                </button>
              )}
            </div>
            <input type="password" required minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-[#0A2540] placeholder:text-[#0A2540]/40 bg-white" />
          </div>
        )}
        <button type="submit"
          disabled={busy || !email || (mode !== "forgot" && password.length < 6)}
          className="w-full bg-[#0A2540] text-white rounded-lg py-2.5 font-medium disabled:opacity-50">
          {busy ? (mode === "signup" ? "Creating account…" : mode === "forgot" ? "Sending…" : "Signing in…")
                : (mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in")}
        </button>
      </form>

      {err && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}
      {info && <div className="mt-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{info}</div>}

      {mode === "forgot" && (
        <button onClick={() => swapMode("signin")} className="text-xs text-[#0A2540]/60 hover:text-[#0A2540] mt-4 block mx-auto">
          ← Back to sign in
        </button>
      )}

      <div className="mt-5 text-center text-xs text-[#0A2540]/60">
        {mode === "signin" ? (
          <>Don&apos;t have an account?{" "}
            <button onClick={() => swapMode("signup")} className="font-medium text-[#0A2540] hover:underline">Create one</button>
          </>
        ) : mode === "signup" ? (
          <>Already have an account?{" "}
            <button onClick={() => swapMode("signin")} className="font-medium text-[#0A2540] hover:underline">Sign in</button>
          </>
        ) : null}
      </div>

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
