/** Public guest intake. Marketing `/` is the landing page, not this flow. */
export const GUEST_INTAKE = "/?entry=new-business";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/businesses",
  "/calendar",
  "/history",
  "/settings",
  "/workspace",
  "/admin",
];

/**
 * Same-origin relative paths only. Rejects protocol-relative and absolute URLs
 * so auth redirects cannot be used as an open redirect.
 */
export function isSafeNext(next: string | null | undefined): next is string {
  if (!next) return false;
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  if (next.includes("://")) return false;
  if (next.includes("\\")) return false;
  return true;
}

export function sanitizeNext(next: string | null | undefined, fallback = "/businesses"): string {
  return isSafeNext(next) ? next : fallback;
}

function pathOnly(next: string): string {
  return next.split("?")[0]?.split("#")[0] || "/";
}

export function isProtectedPath(next: string): boolean {
  const path = pathOnly(next);
  return PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Where a guest should go after "Continue without an account".
 * Never send guests at a middleware-protected route (login loop) or bare `/`
 * (marketing homepage).
 */
export function guestContinuePath(next: string | null | undefined): string {
  if (!isSafeNext(next)) return GUEST_INTAKE;
  if (isProtectedPath(next)) return GUEST_INTAKE;
  const path = pathOnly(next);
  if (path === "/" && !/[?&]entry=new-business/.test(next) && !/[?&]resume=/.test(next)) {
    return GUEST_INTAKE;
  }
  return next;
}

export function authCallbackPath(next: string | null | undefined): string {
  return sanitizeNext(next, GUEST_INTAKE);
}
