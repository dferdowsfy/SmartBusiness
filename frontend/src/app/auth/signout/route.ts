// Server-side sign-out: clears the Supabase session cookies and redirects to
// the login screen. Uses a relative Location header so the browser resolves it
// against the public origin — required because behind Railway's proxy
// req.url can be the internal localhost:8080, which would otherwise be baked
// into an absolute redirect URL.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(_req: NextRequest) {
  const sb = await createSupabaseServer();
  if (sb) await sb.auth.signOut();
  // Per RFC 7231 the Location header may be a relative URI; the browser
  // resolves it against the request URL (the public origin, not the proxy's
  // internal one), so we never need to know the absolute origin server-side.
  return new NextResponse(null, {
    status: 302,
    headers: { Location: "/auth/login" },
  });
}
export const GET = handle;
export const POST = handle;
