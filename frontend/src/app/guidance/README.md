# Requirement guidance

This is content inside the existing Requirements disclosure, not a new UI or
matcher. `rulesEngine.ts` and entity-formation classification remain authoritative.

## Resolution

Existing requirement → matched rule trace → document.requirement_guidance →
supporting regulatory source → confirmed guidance conditions → localized content.

The compiled document node retains the complete versioned concept. Seeded source
nodes link back via `supports`; document nodes derive source, question-condition
and dependency edges. Admin document details expose the structured JSON through
the existing proposal/review/publication workflow. AI extraction forcibly marks
guidance `needs_review`; it cannot certify its own output. Publication requires
active, version-matched source nodes with a supporting relationship, and rejects
duplicate explanations. No production migration or publication is performed here.

Old snapshots without the field use the bundled concept for the same document ID.
An explicit `null`, invalid or needs-review concept overrides that fallback.
This lets an administrator withdraw guidance without changing obligation rules.

## Coverage and boundaries

Eight reviewed, source-linked concepts: alcohol sales, EIN for employers, merchant
registration, nonresidential Permiso Único, Bayamón municipal patent, Bayamón lease
evidence, Puerto Rico LLC organization and CFSE coverage. Source URLs, supporting
propositions and verification dates are in `pr.ts`. No fees or deadlines are added.

Bayamón-only sources are deliberately not extrapolated to other municipalities.
No-employees EIN cases need a separately validated tax-classification rationale.
A physical location alone is not confirmation of a lease. Unsupported documents,
including previously hardcoded tourism/room-tax/HOA claims without adequate source
links, now return `GUIDANCE_NEEDS_REVIEW`. Rates, deadlines and capabilities from
the previous copy are not silently carried over. Requirements themselves remain.

The resolver supplies only guidance-condition facts; it does not read arbitrary
profile fields into prose. Unknown, contradictory, conditional or suppressed
applicability fails closed. A prepared application is never described as issued
evidence, coverage or authority to operate. No LLM call runs on page load.

## Verification

`npm run test:guidance` covers EN/ES distinctions, trigger traces, title-swap
regressions, false/unknown facts, geographic scope, bad JSON, published overrides,
source relationships and unchanged deterministic output. `npm run rk:golden`
checks graph/engine parity. No Requirements markup or styling changes are needed.
