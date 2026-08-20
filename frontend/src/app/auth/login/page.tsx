"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createSupabaseBrowser, isAuthConfigured } from "../../../lib/supabase/client";
import { authRedirectUrl } from "../../../lib/siteUrl";
import { SmartPRLogo } from "../../components/brand/SmartPRLogo";
import { GUEST_INTAKE, guestContinuePath, sanitizeNext } from "../../../lib/safeNext";

type Mode = "signin" | "signup" | "forgot";

function LoginInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const nextPath = sanitizeNext(sp.get("next"), "/businesses");
  const initialMode: Mode = sp.get("mode") === "signup" ? "signup" : "signin";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "rate_limited">("idle");

  if (!isAuthConfigured()) {
    return (
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-medium">Sign-in is not configured</h1>
        <p className="mt-3 text-[#1b1b1b]">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable accounts.
          You can still use SmartPR without signing in.
        </p>
      </div>
    );
  }

  const supabase = createSupabaseBrowser();
  const emailRedirectTo = authRedirectUrl(nextPath);
  const resetRedirectTo = authRedirectUrl("/auth/reset");
  const swapMode = (m: Mode) => { setMode(m); setErr(null); setInfo(null); };

  const bootstrapPlatform = async () => {
    const response = await fetch("/api/auth/bootstrap", { method: "POST" });
    if (response.ok) return true;
    const result = await response.json().catch(() => ({}));
    setErr(result.error || "Signed in, but SmartPR could not initialize your workspace.");
    return false;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        if (data.session) {
          if (await bootstrapPlatform()) router.push(nextPath);
        } else {
          setNeedsConfirm(email);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const m = error.message || "";
          if (/email\s*not\s*confirmed/i.test(m)) {
            setErr("This email is not confirmed yet. Check your inbox, or ask an admin to confirm the user in Supabase.");
          } else if (/invalid\s*login\s*credentials/i.test(m)) {
            setErr("Email or password is incorrect.");
          } else {
            setErr(m);
          }
          return;
        }
        if (await bootstrapPlatform()) router.push(nextPath);
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

  if (needsConfirm) {
    return (
      <div className="w-full">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-medium">Confirm your email</h1>
        <p className="mt-3 text-[#1b1b1b]">
          We sent a confirmation link to <span className="font-medium">{needsConfirm}</span>.
        </p>
        <div className="mt-8 space-y-3">
          <button onClick={resend} disabled={resendState === "sending"}
            className="w-full border border-[#161616]/22 rounded-lg py-2.5 text-sm font-medium hover:bg-[#ebe6db] disabled:opacity-50">
            {resendState === "sending" ? "Resending…"
              : resendState === "sent" ? "Confirmation resent"
              : resendState === "rate_limited" ? "Rate limit — try again later"
              : "Resend confirmation email"}
          </button>
          <button onClick={() => { setNeedsConfirm(null); setMode("signin"); setResendState("idle"); setErr(null); }}
            className="w-full bg-[#245c5c] text-[#f6f3ea] rounded-lg py-2.5 text-sm font-medium">
            I've confirmed — sign in
          </button>
        </div>
        {err && <div className="mt-3 text-sm text-[#8a2f2f]">{err}</div>}
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-medium">
        {mode === "signin" ? "Welcome back."
          : mode === "signup" ? "Create your SmartPR account."
          : "Reset your password."}
      </h1>
      <p className="mt-3 mb-8 text-[#1b1b1b]">
        {mode === "signin" ? "Continue your Puerto Rico filing work."
          : mode === "signup" ? "Start a filing and come back whenever you need."
          : "Enter the email on your account and we'll send a reset link."}
      </p>

      {mode !== "forgot" && (
        <div className="mb-6 flex rounded-lg border border-[#161616]/22 p-1 text-sm">
          <button type="button" onClick={() => swapMode("signin")}
            className={`flex-1 rounded-md py-1.5 font-medium ${mode === "signin" ? "bg-[#161616] text-[#f6f3ea]" : "text-[#5a5a5a]"}`}
            aria-pressed={mode === "signin"}>
            I have an account
          </button>
          <button type="button" onClick={() => swapMode("signup")}
            className={`flex-1 rounded-md py-1.5 font-medium ${mode === "signup" ? "bg-[#161616] text-[#f6f3ea]" : "text-[#5a5a5a]"}`}
            aria-pressed={mode === "signup"}>
            Create account
          </button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com"
            className="w-full rounded-lg border border-[#161616]/22 bg-[#fbf8f2] px-3 py-2.5 text-sm placeholder:text-[#5a5a5a]" />
        </div>
        {mode !== "forgot" && (
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label className="text-sm font-medium">Password</label>
              {mode === "signin" && (
                <button type="button" onClick={() => swapMode("forgot")} className="text-sm text-[#245c5c] underline-offset-4 hover:underline">
                  Forgot password?
                </button>
              )}
            </div>
            <input type="password" required minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
              className="w-full rounded-lg border border-[#161616]/22 bg-[#fbf8f2] px-3 py-2.5 text-sm placeholder:text-[#5a5a5a]" />
          </div>
        )}
        <button type="submit"
          disabled={busy || !email || (mode !== "forgot" && password.length < 6)}
          className="w-full rounded-lg bg-[#245c5c] py-3 font-medium text-[#f6f3ea] disabled:opacity-50">
          {busy ? (mode === "signup" ? "Creating account…" : mode === "forgot" ? "Sending…" : "Signing in…")
                : (mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in")}
        </button>
      </form>

      {err && <div className="mt-3 text-sm text-[#8a2f2f]">{err}</div>}
      {info && <div className="mt-3 text-sm text-[#1f5a3a]">{info}</div>}

      {mode === "forgot" && (
        <button onClick={() => swapMode("signin")} className="mt-4 block text-sm text-[#5a5a5a] hover:text-[#161616]">
          Back to sign in
        </button>
      )}

      <div className="mt-6 text-sm text-[#5a5a5a]">
        {mode === "signin" ? (
          <>Need an account?{" "}
            <button onClick={() => swapMode("signup")} className="font-medium text-[#161616] underline-offset-4 hover:underline">Create one</button>
          </>
        ) : mode === "signup" ? (
          <>Already have an account?{" "}
            <button onClick={() => swapMode("signin")} className="font-medium text-[#161616] underline-offset-4 hover:underline">Sign in</button>
          </>
        ) : null}
      </div>

      <button type="button" onClick={() => router.push(guestContinuePath(sp.get("next")))} className="mt-6 block text-sm text-[#5a5a5a] hover:text-[#161616]">
        Continue without an account
      </button>
      <p className="mt-2 text-xs text-[#5a5a5a]">
        You can finish this assessment first. An account is required later to save to the cloud, manage multiple businesses, and resume on another device.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f1ea] text-[#161616]">
      <header className="px-6 py-5">
        <Link href="/" aria-label="SmartPR home"><SmartPRLogo size="auth" /></Link>
      </header>
      <main className="mx-auto grid w-full max-w-md flex-1 place-items-center px-6 py-10">
        <Suspense fallback={<div className="text-[#5a5a5a]">Loading…</div>}>
          <LoginInner />
        </Suspense>
      </main>
      <footer className="px-6 py-6 text-sm text-[#5a5a5a]">
        <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy Policy</Link>
        {" · "}
        <Link href={GUEST_INTAKE} className="underline-offset-4 hover:underline">Start without an account</Link>
      </footer>
    </div>
  );
}
