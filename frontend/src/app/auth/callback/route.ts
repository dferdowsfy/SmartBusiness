// OAuth + Magic Link callback. Exchanges the auth code for a session cookie,
// upserts the user mirror, claims any anonymous submissions matching the
// user's email, then redirects to ?next= (or the current SmartPR workspace).

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase/server";
import { upsertUser, claimSubmissionsByEmail } from "../../graph/auth-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextPath = url.searchParams.get("next") || "/";
  const supabase = await createSupabaseServer();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (u) {
        await upsertUser(u.id, u.email ?? null, (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || null);
        await claimSubmissionsByEmail(u.id, u.email ?? null);
      }
    }
  }

  return NextResponse.redirect(new URL(nextPath, req.url));
}
