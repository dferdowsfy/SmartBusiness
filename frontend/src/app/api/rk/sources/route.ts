// Regulatory sources: list + create.
// GET  -> { sources }
// POST { title, sourceType, legalStatus, citation?, url?, effectiveDate?, text? } -> { source }
//   text = pasted document text or client-side-extracted PDF text (JSON, no multipart).
import { isCurrentUserAdmin } from "../../../../lib/admin";
import { getCurrentUser } from "../../../../lib/supabase/server";
import { isEnabled } from "../../../graph/db";
import { createSource, listSources } from "../../../rk/sources";
import type { LegalStatus, SourceType } from "../../../rk/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ sources: [], reason: "no_database" });
  return Response.json({ sources: await listSources() });
}

export async function POST(request: Request) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });

  let body: {
    title?: string;
    sourceType?: SourceType;
    legalStatus?: LegalStatus;
    citation?: string;
    url?: string;
    effectiveDate?: string;
    text?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.title?.trim()) return Response.json({ error: "title is required" }, { status: 400 });

  const user = await getCurrentUser();
  const result = await createSource({
    title: body.title.trim(),
    sourceType: body.sourceType ?? "other",
    legalStatus: body.legalStatus ?? "proposed",
    citation: body.citation ?? null,
    url: body.url ?? null,
    effectiveDate: body.effectiveDate ?? null,
    text: body.text ?? null,
    actor: user?.email ?? null,
  });
  if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
  return Response.json({ source: result.source });
}
