// Template library status (admin).
// GET -> { templates: [...], municipalIssues: [...] }
//
// Shows exactly what SmartPR holds: which artifacts have a source file, which
// are still pending, how each is populated, and how many mappings a human has
// yet to confirm.
import { isCurrentUserAdmin } from "../../../../../lib/admin";
import { TEMPLATE_LIBRARY } from "../../../../forms/artifacts/catalog";
import { loadMapping } from "../../../../forms/artifacts/mappingStore";
import { validateMunicipalImplementations } from "../../../../forms/artifacts/municipalities";
import { needsHumanReview } from "../../../../forms/artifacts/semanticMapping";
import { manifestEntry } from "../../../../forms/artifacts/templateLoader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });

  const templates = TEMPLATE_LIBRARY.map((template) => {
    const mapping = loadMapping(template.formCode);
    const entry = manifestEntry(template.formCode);
    const fields = mapping?.fields ?? [];
    return {
      formCode: template.formCode,
      title: template.title,
      agency: template.agency,
      scope: template.scope,
      artifactType: template.artifactType,
      sourceStatus: template.sourceStatus,
      populationMethod: mapping?.populationMethod ?? template.populationMethod,
      submissionChannel: template.submissionChannel,
      revision: template.revision ?? null,
      sourceFile: template.sourceFile ?? null,
      storagePath: template.storagePath ?? null,
      checksum: entry?.checksum ?? null,
      pageCount: mapping?.pageCount ?? 0,
      hasAcroForm: mapping?.hasAcroForm ?? false,
      nativeFieldCount: entry?.nativeFieldCount ?? 0,
      mappedFieldCount: fields.filter((f) => f.canonicalField !== null).length,
      totalFieldCount: fields.length,
      needsReviewCount: fields.filter(needsHumanReview).length,
      mappingStatus: mapping?.status ?? "missing",
      notes: template.usageNotes ?? [],
      previewUrl: mapping?.status === "mapped" ? `/api/forms/artifacts/${template.formCode}/preview` : null,
    };
  });

  return Response.json({ templates, municipalIssues: validateMunicipalImplementations() });
}
