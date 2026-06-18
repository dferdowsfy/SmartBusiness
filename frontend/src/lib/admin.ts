// ============================================================================
// Admin allowlist gate.
//
// There is no role table; admins are configured via the ADMIN_EMAILS env var
// (comma-separated, case-insensitive). This gates the discovery/monitoring/
// review tools both in the UI (hide the entry point) and on the server (403).
//
// SAFE DEFAULT: if ADMIN_EMAILS is empty/unset, NOBODY is an admin. The
// operator must set it (e.g. ADMIN_EMAILS=dferdows@gmail.com).
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
  return adminSet().has(email.toLowerCase());
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}
