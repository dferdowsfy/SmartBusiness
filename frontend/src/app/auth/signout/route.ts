// Server-side sign-out: clears the Supabase session cookies and redirects home.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const sb = await createSupabaseServer();
  if (sb) await sb.auth.signOut();
  return NextResponse.redirect(new URL("/auth/login", req.url));
}
export const GET = handle;
export const POST = handle;
