# RealForms — SmartPR template library (source files)

These are the **untouched originals** SmartPR populates. Nothing in the codebase
writes to this directory: population always produces a separate working copy
(see `frontend/src/app/forms/artifacts/population.ts`).

Every file is checksummed into `form-mappings/templates.manifest.json`. If a file
here changes, `loadTemplateBytes` refuses to populate until the library is
re-inspected and the mappings are re-validated:

```bash
cd frontend && npm run forms:inspect
```

## Present files

| File | Form code | Agency | Artifact type | Scope | Population |
|------|-----------|--------|---------------|-------|------------|
| `1-CORPREG01.pdf` | CORPREG01 | PR Department of State | `official_pdf_form` | statewide | `pdf_overlay` (no native fields) |
| `34-CORPLLC02.pdf` | CORPLLC02 | PR Department of State | `official_pdf_form` | statewide | `pdf_overlay` (no native fields) |
| `fss4.pdf` | SS4 | Internal Revenue Service | `official_pdf_form` | federal | `acroform` (89 native fields) |
| `sc_2309_0.pdf` | SC2309 | Departamento de Hacienda | `official_pdf_form` | statewide | `pdf_overlay` (no native fields) |
| `PA02-Solicitud-de-Patente-Provisional.pdf` | PA02 | Municipal finance office | `genericized_municipal_template` | municipality-specific | `acroform` (45 native fields) |
| `PA03-Solicitud-de-Prorroga-de-Declaracion.pdf` | PA03 | Municipal finance office | `genericized_municipal_template` | municipality-specific | `acroform` (61 native fields) |
| `PA04-Mant-Contribuyente-Deudor.pdf` | PA04 | Municipal finance office | `genericized_municipal_template` | municipality-specific | `acroform` (40 native fields) |

Every form code in the catalog now has its source file. Run
`cd frontend && npm run forms:verify` to populate all seven and confirm the
applicant's data is readable back out of each produced PDF.

## A note on field names

`fss4.pdf` is an XFA-derived form whose fields are named `f1_2[0]`, `c1_3[4]`
and so on — names that convey nothing for a label matcher to work from. Its
mappings are therefore hand-written in
`frontend/src/app/forms/artifacts/acroformMaps.ts`, resolved by matching each
widget rectangle against the printed line numbers in the page's own text layer.
The PA-family forms name their fields after the printed Spanish labels, so the
semantic matcher proposes those automatically.

## Municipal template classification (important)

`PA02`, `PA03` and `PA04` originate from a Municipio de Bayamón form family and
were **genericized locally** — municipality-specific wording was removed so the
field layout can be used while SmartPR's municipality architecture is built.

They are classified `genericized_municipal_template` and may be used for:

* development, field mapping and UI demonstration,
* data-population testing,
* identifying common municipal information requirements.

They must **not** be presented to a user as the official filing form for San
Juan, Guaynabo, Carolina, Caguas, Bayamón or any other municipality unless that
municipality's acceptance of that exact artifact has been separately verified and
registered in `municipalities.ts`. The engine enforces this:
`generateWorkingCopy({ purpose: "filing" })` refuses to produce them, and
`validateMunicipalImplementations` rejects any attempt to register one as a
municipality's official form.

Note on the current PA03 working copy: the static page carries no municipality
name, but its `Municipio` AcroForm field is populated from
`location.municipality`, so a generated development copy will display whichever
municipality the profile holds. That is a populated value, not an endorsement of
the artifact by that municipality.
