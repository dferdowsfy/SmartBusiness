// Single source of truth for the app's absolute URL. Used for any auth flow
// that bakes a redirect into an outbound message (magic-link emails, OAuth
// state). Must NEVER rely on window.location.origin alone because emails are
// generated server-side at Supabase and the deep-linked URL is fixed.
//
// Resolution order:
//   1. NEXT_PUBLIC_SITE_URL (explicit override — set this on Railway for prod)
//   2. Production default: the deployed Railway URL
//   3. Development default: http://localhost:8080

const PROD_DEFAULT = "https://smartbusiness-production.up.railway.app";
const DEV_DEFAULT = "http://localhost:8080";

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  return process.env.NODE_ENV === "production" ? PROD_DEFAULT : DEV_DEFAULT;
}

export function authRedirectUrl(nextPath: string): string {
  const safeNext = nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard";
  return `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}
