// Populate a working copy of a government artifact.
// POST { profile, businessId?, instanceId?, archive? } -> application/pdf
//
// The canonical template is read-only input. Genericized municipal templates
// are refused here: they are not any municipality's official form.
import { randomUUID } from "node:crypto";

import { createSupabaseServer, getCurrentUser } from "../../../../../../lib/supabase/server";
import { getPool } from "../../../../../graph/db";
import { userCanAccessBusiness } from "../../../../../compliance/server";
import { ArtifactGenerationError, generateWorkingCopy } from "../../../../../forms/artifacts/library";
import { recordGeneratedFiling } from "../../../../../forms/artifacts/persistence";
import { emptyCanonicalData, type CanonicalApplicationData, type FormData } from "../../../../../forms/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ formCode: string }> }) {
  const { formCode } = await ctx.params;
  // Generation itself is pure Node fs/pdf-lib and needs nothing from an
  // account — the main intake flow works anonymously (see archiveDeliverable's
  // same no-op-when-anonymous pattern). Only persisting the result to Supabase
  // Storage below actually requires a signed-in user.
  const user = await getCurrentUser();

  let body: { profile?: Partial<CanonicalApplicationData>; formData?: FormData; businessId?: string; instanceId?: string; archive?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const profile = { ...emptyCanonicalData(), ...(body.profile ?? {}) } as CanonicalApplicationData;
  let result;
  try {
    result = await generateWorkingCopy({ formCode, profile, formData: body.formData, purpose: "filing" });
  } catch (error) {
    const status = error instanceof ArtifactGenerationError ? 409 : 500;
    return Response.json({ error: (error as Error).message }, { status });
  }

  const warnings: string[] = [];
  let archived = false;
  if (body.archive && body.businessId && user) {
    const pool = getPool();
    const owns = pool ? await userCanAccessBusiness(pool, user.id, body.businessId) : false;
    if (!owns) {
      warnings.push("Not archived: this business does not belong to your account.");
    } else {
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
      archived = outcome.persisted && Boolean(outcome.storagePath);
    }
  } else if (body.archive && !user) {
    warnings.push("Not archived: sign in to save this filing to your account.");
  }

  return new Response(Buffer.from(result.bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${formCode}-prepared.pdf"`,
      "cache-control": "no-store",
      "x-smartpr-populated-fields": String(result.populated.length),
      "x-smartpr-unanswered-fields": String(result.unanswered.length),
      "x-smartpr-template-checksum": result.templateChecksum,
      ...(body.archive ? { "x-smartpr-archived": String(archived) } : {}),
      ...(warnings.length ? { "x-smartpr-warnings": warnings.join(" | ").slice(0, 400) } : {}),
    },
  });
}
