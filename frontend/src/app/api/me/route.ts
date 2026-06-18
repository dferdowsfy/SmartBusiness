// Lightweight "who am I" probe used by client components to toggle UI
// (Sign in vs avatar/Sign out) without round-tripping through middleware.

import { getCurrentUser, isAuthConfigured } from "../../../lib/supabase/server";
import { isAdminEmail } from "../../../lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthConfigured()) return Response.json({ configured: false, user: null });
  const user = await getCurrentUser();
  if (!user) return Response.json({ configured: true, user: null });
  return Response.json({
    configured: true,
    user: {
      id: user.id,
      email: user.email,
      name: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || null,
      avatar: (user.user_metadata?.avatar_url as string) || null,
      isAdmin: isAdminEmail(user.email),
    },
  });
}
