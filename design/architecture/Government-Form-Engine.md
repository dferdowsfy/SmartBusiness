# SmartPR Government Form Engine

**Status:** implemented (`frontend/src/app/forms/artifacts/`)
**Related:** `SmartPR-Application-Architecture.md`, `../rules/Licensing-Rules-Engine-Design.md`

SmartPR does not re-draw government forms. It loads the agency's own file,
writes the user's canonical answers onto a **copy**, and reports what is still
missing. Where SmartPR has no artifact, it says so instead of substituting one.

```
intake sentence + answers
        ↓
canonical business profile          (one profile, every agency)
        ↓
regulatory graph → requirements     (rulesEngine / requirement knowledge base)
        ↓
requirement → artifact resolution   (applicability.ts + municipalities.ts)
        ↓
artifact mapping                    (form-mappings/<CODE>.json)
        ↓
populated working copy              (population.ts — acroform | pdf_overlay)
        ↓
filing package                      (filingPackage.ts — counts + safe status copy)
```

## Artifact types

| `artifact_type` | Meaning | May be shown as an official form? |
|---|---|---|
| `official_pdf_form` | The agency's published PDF | yes, when `source_status = official_source` |
| `official_docx_form` | The agency's published DOCX | yes, when `source_status = official_source` |
| `genericized_municipal_template` | Real municipal layout with municipality wording removed | **never** |
| `portal_submission` | No file; a portal workflow | n/a — portal-ready data |
| `issued_certificate` | Something the agency issues back | n/a — evidence |
| `supporting_evidence` | Attachments the filer supplies | n/a |

`population_method` is one of `acroform`, `pdf_overlay`, `docx_merge`,
`structured_portal_data`, `none`, decided from the inspection report — not from
assumption. A PDF with native fields is filled natively; a PDF without them gets
a coordinate overlay over the untouched background.

## One canonical profile

`canonicalFields.ts` defines stable dotted ids (`business.legal_name`,
`operations.estimated_payroll`, `activities.alcohol_sales`, …) resolved against
the existing `CanonicalApplicationData`. Every artifact maps its own fields onto
those ids. No government form gets its own data model, and no municipality name
appears in the model.

Personal government identifiers (`owner.tax_id`) are declared but never
auto-filled: they are typed onto the artifact by the filer.

## Municipality architecture

```
PATENTE_MUNICIPAL
   ├── Bayamón   → municipality implementation
   ├── San Juan  → municipality implementation
   └── (any)     → requirements-only fallback
```

`municipalities.ts` maps *(municipality, requirement)* → implementation:
`official_form` (a verified municipality artifact), `portal`, or the honest
default `requirements_only`. Business logic is never duplicated per
municipality — only the implementation differs.

`MUNICIPAL_IMPLEMENTATIONS` is currently empty: SmartPR holds no
municipality-verified patente artifact. `validateMunicipalImplementations()`
rejects any registration that would back an official implementation with a
genericized template, and `assertGenerationAllowed()` refuses to generate one as
a filing document.

## Readiness without a file

`informationModels.ts` states which canonical fields a requirement needs even
when SmartPR has no artifact for it. That is how a pending SS-4 or an unverified
municipal patente still reports "16 fields populated · 1 answer required", and
how a later official file maps onto data that was already collected.

## Storage

```
official-form-templates/pr/estado/CORPREG01/current/original.pdf
official-form-templates/pr/hacienda/SC2309/current/original.pdf
official-form-templates/federal/irs/SS4/current/original.pdf
municipal-form-templates/generic/PA02/current/original.pdf
generated-filings/{tenant_id}/{business_id}/{form_code}/{instance_id}/populated.pdf
```

Canonical originals are uploaded with `upsert: false` and superseded revisions go
to `…/revisions/<label>/`. Nothing overwrites a canonical template, ever.

## Versioning and monitoring

* Source bytes are checksummed (`templates.manifest.json`); a changed file fails
  population closed rather than filing a document mapped against other bytes.
* `document_versions` retains every revision; new versions arrive
  `review_status = needs_review`, `mapping_status = not_remapped`.
* Coordinate mappings are bound to a revision and are never migrated
  automatically — a moved blank would print a value in the wrong box.

## Status vocabulary

SmartPR reports: *information complete, additional information required, ready
for review, ready for submission, submitted externally, awaiting agency action,
requirements prepared, official form not yet available*. It never reports
approved, granted, government approved or officially accepted — those come only
from a government system. A test asserts the engine's own copy stays inside this
vocabulary.

## Surfaces

| Surface | Purpose |
|---|---|
| `/filing-package` | The user's filing package: applicable artifacts, populated/required counts, **Review form** |
| `/admin/form-mappings` | Template library status, mapping coverage, review flags, mapping-boundary preview |
| `POST /api/forms/artifacts/filing-package` | Resolve artifacts + readiness for a profile |
| `POST /api/forms/artifacts/{formCode}/populate` | Populated working copy (official artifacts only) |
| `GET /api/forms/artifacts/{formCode}/preview` | Mapping-boundary preview PDF (admin) |
| `GET /api/forms/artifacts/templates` | Library status JSON (admin) |

## Commands

```bash
cd frontend
npm run forms:inspect   # re-inventory RealForms/ and regenerate form-mappings/
npm run forms:demo      # end-to-end Bayamón restaurant → populated PDFs
npm run forms:sync      # upload canonical templates to Supabase Storage (write-once)
npm run test:forms      # artifact engine + e2e scenario + existing form engine tests
```
