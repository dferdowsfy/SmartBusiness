// Filing package for a business profile.
// POST { description?, profile? } -> { extraction, questions, package }
//
// Read-only: this route resolves which government artifacts apply and how much
// of each SmartPR can already answer. It generates no documents and submits
// nothing.
import { resolveApplicableArtifacts, type ApplicabilityOptions } from "../../../../forms/artifacts/applicability";
import { buildFilingPackage } from "../../../../forms/artifacts/filingPackage";
import { applyExtraction, extractIntake } from "../../../../forms/artifacts/intakeExtraction";
import { loadMunicipalities } from "../../../../forms/artifacts/kbLoader";
import { loadAllMappings, outstandingQuestionsForProfile } from "../../../../forms/artifacts/library";
import { emptyCanonicalData, type CanonicalApplicationData } from "../../../../forms/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  description?: string;
  profile?: Partial<CanonicalApplicationData>;
  options?: ApplicabilityOptions;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const base: CanonicalApplicationData = { ...emptyCanonicalData(), ...(body.profile ?? {}) } as CanonicalApplicationData;
  const extraction = body.description
    ? extractIntake(body.description.slice(0, 2000), loadMunicipalities())
    : null;
  const profile = extraction ? applyExtraction(extraction, base) : base;

  const artifacts = resolveApplicableArtifacts(profile, body.options ?? {});
  const questions = outstandingQuestionsForProfile(profile, artifacts);
  const filingPackage = buildFilingPackage({ profile, artifacts, mappings: loadAllMappings() });

  return Response.json({
    extraction: extraction
      ? {
          business_type: extraction.businessType,
          municipality: extraction.municipality,
          employee_count: extraction.employeeCount,
          activities: extraction.activities,
          evidence: extraction.evidence,
        }
      : null,
    questions,
    package: filingPackage,
  });
}
