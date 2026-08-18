// Populate a working copy of a government artifact.
// POST { profile, businessId?, instanceId?, archive? } -> application/pdf
//
// The canonical template is read-only input. Genericized municipal templates
// are refused here: they are not any municipality's official form.
import { randomUUID } from "node:crypto";

import { createSupabaseServer, getCurrentUser } from "../../../../../../lib/supabase/server";
import { ArtifactGenerationError, generateWorkingCopy } from "../../../../../forms/artifacts/library";
import { recordGeneratedFiling } from "../../../../../forms/artifacts/persistence";
import { emptyCanonicalData, type CanonicalApplicationData } from "../../../../../forms/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ formCode: string }> }) {
  const { formCode } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { profile?: Partial<CanonicalApplicationData>; businessId?: string; instanceId?: string; archive?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const profile = { ...emptyCanonicalData(), ...(body.profile ?? {}) } as CanonicalApplicationData;
  let result;
  try {
    result = await generateWorkingCopy({ formCode, profile, purpose: "filing" });
  } catch (error) {
    const status = error instanceof ArtifactGenerationError ? 409 : 500;
    return Response.json({ error: (error as Error).message }, { status });
  }

  const warnings: string[] = [];
  if (body.archive && body.businessId) {
    const outcome = await recordGeneratedFiling({
      tenantId: user.id,
      businessId: body.businessId,
      userId: user.id,
      instanceId: body.instanceId ?? randomUUID(),
      formCode,
      result,
      profile,
      storageClient: await createSupabaseServer(),
    });
    warnings.push(...outcome.warnings);
  }

  return new Response(Buffer.from(result.bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${formCode}-prepared.pdf"`,
      "cache-control": "no-store",
      "x-smartpr-populated-fields": String(result.populated.length),
      "x-smartpr-unanswered-fields": String(result.unanswered.length),
      "x-smartpr-template-checksum": result.templateChecksum,
      ...(warnings.length ? { "x-smartpr-warnings": warnings.join(" | ").slice(0, 400) } : {}),
    },
  });
}
