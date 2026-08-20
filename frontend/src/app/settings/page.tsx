"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "../history/ui";
import { createSupabaseBrowser } from "../../lib/supabase/client";

interface AccountUser {
  email: string | null;
  name: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((response) => response.json())
      .then((data) => {
        if (!data.user) {
          router.replace("/auth/login?next=/settings");
          return;
        }
        setUser(data.user);
        setName(data.user.name || "");
      })
      .catch(() => setError("We could not load your account settings."))
      .finally(() => setLoading(false));
  }, [router]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const supabase = createSupabaseBrowser();
      const { error: updateError } = await supabase.auth.updateUser({
        data: { full_name: name.trim(), name: name.trim() },
      });
      if (updateError) throw updateError;
      setUser((current) => current ? { ...current, name: name.trim() } : current);
      setMessage("Profile settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not save your profile settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f1ea]">
      <TopNav active="settings" />
      <main className="max-w-2xl mx-auto px-5 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#161616]">Account settings</h1>
          <p className="text-sm text-[#161616]/60 mt-1">Manage the profile associated with your SmartPR account.</p>
        </div>

        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          {loading ? (
            <div className="text-sm text-[#161616]/50">Loading account…</div>
          ) : user ? (
            <form onSubmit={saveProfile} className="space-y-5">
              <div>
                <label htmlFor="profile-name" className="block text-xs font-semibold text-[#161616]/70 mb-1">Display name</label>
                <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-[#161616] bg-white"
                  placeholder="Your name" autoComplete="name" />
              </div>
              <div>
                <label htmlFor="profile-email" className="block text-xs font-semibold text-[#161616]/70 mb-1">Email</label>
                <input id="profile-email" value={user.email || ""} readOnly
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-[#161616]/70 bg-[#f4f1ea]" />
                <p className="text-xs text-[#161616]/50 mt-1">Your sign-in email is managed by your authentication account.</p>
              </div>

              {message && <div role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{message}</div>}
              {error && <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving}
                  className="bg-[#161616] text-white rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50">
                  {saving ? "Saving…" : "Save profile"}
                </button>
                <a href="/auth/signout" className="border border-slate-300 text-[#161616] rounded-lg px-5 py-2.5 text-sm font-medium">Sign out</a>
              </div>
            </form>
          ) : (
            <div className="text-sm text-red-700">{error || "Redirecting to sign in…"}</div>
          )}
        </section>
      </main>
    </div>
  );
}
