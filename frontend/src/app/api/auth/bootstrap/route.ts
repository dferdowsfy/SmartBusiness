import { bootstrapPlatformUser } from "../../../../lib/auth/bootstrap";
import { getCurrentUser } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { workspaceId } = await bootstrapPlatformUser(user);
    return Response.json({ ready: true, workspace_id: workspaceId });
  } catch (error) {
    console.error("[auth-bootstrap]", (error as Error).message);
    return Response.json(
      { error: "SmartPR could not initialize the Supabase workspace." },
      { status: 503 }
    );
  }
}
