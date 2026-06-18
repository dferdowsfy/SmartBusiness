// ============================================================================
// Admin allowlist gate.
//
// There is no role table; admins are configured via the ADMIN_EMAILS env var
// (comma-separated, case-insensitive). This gates the discovery/monitoring/
// review tools both in the UI (hide the entry point) and on the server (403).
//
// OPEN DEFAULT: if ADMIN_EMAILS is empty/unset, ANY signed-in user is treated
// as an admin (so the tools are reachable out of the box). Set ADMIN_EMAILS to
// lock access down to a specific allowlist.
// ============================================================================

import { getCurrentUser } from "./supabase/server";

function adminSet(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const set = adminSet();
  if (set.size === 0) return true; // open default: no allowlist configured
  return set.has(email.toLowerCase());
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}
