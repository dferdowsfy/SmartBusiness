// Form templates from the graph admin (bridges to the existing versioned
// form_templates track that powers /requirements/[targetId] fill + validation).
// GET  -> { templates }
// POST { action: 'save_draft', templateId, templateName?, schemaJson?,
//         validationRulesJson?, fieldMappingsJson? }        -> { template }
// POST { action: 'publish' | 'reject', templateId }          -> { ok, message }
import { isCurrentUserAdmin } from "../../../../lib/admin";
import { getCurrentUser } from "../../../../lib/supabase/server";
import { isEnabled } from "../../../graph/db";
import { actOnTemplate, listFormTemplates, saveTemplateDraft } from "../../../rk/forms";
import type { FormSchema } from "../../../requirements/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ templates: [], reason: "no_database" });
  return Response.json({ templates: await listFormTemplates() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!isEnabled()) return Response.json({ error: "no_database" }, { status: 503 });

  let body: {
    action?: "save_draft" | "publish" | "reject";
    templateId?: string;
    templateName?: string;
    schemaJson?: FormSchema;
    validationRulesJson?: Record<string, unknown>;
    fieldMappingsJson?: Record<string, string>;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.templateId) return Response.json({ error: "templateId is required" }, { status: 400 });

  if (body.action === "save_draft") {
    const result = await saveTemplateDraft({
      templateId: body.templateId,
      templateName: body.templateName,
      schemaJson: body.schemaJson,
      validationRulesJson: body.validationRulesJson ?? undefined,
      fieldMappingsJson: body.fieldMappingsJson ?? undefined,
      actor: user.email ?? null,
    });
    if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
    return Response.json({ template: result.template });
  }
  if (body.action === "publish" || body.action === "reject") {
    const result = await actOnTemplate(body.action, body.templateId, user.id, user.email ?? null);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }
  return Response.json({ error: "unknown action" }, { status: 400 });
}
