// OAuth + Magic Link callback. Exchanges the auth code for a session cookie,
// upserts the user mirror, claims any anonymous submissions matching the
// user's email, then redirects to ?next= (or the portfolio dashboard).

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase/server";
import { bootstrapPlatformUser } from "../../../lib/auth/bootstrap";
import { claimSubmissionsByEmail } from "../../graph/auth-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextPath = url.searchParams.get("next") || "/dashboard";
  const supabase = await createSupabaseServer();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (u) {
        await bootstrapPlatformUser(u).catch((bootstrapError) => {
          console.error("[auth-callback] platform bootstrap failed:", (bootstrapError as Error).message);
        });
        await claimSubmissionsByEmail(u.id, u.email ?? null);
      }
    }
  }

  return NextResponse.redirect(new URL(nextPath, req.url));
}
