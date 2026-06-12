# Regulatory Knowledge Packs

The platform is **jurisdiction-agnostic**. All jurisdiction-specific knowledge
lives in a **pack** — a single object implementing `JurisdictionPack`
(`types.ts`). The engine, UI, and API routes read from the **active pack**
(`ACTIVE_JURISDICTION`) and contain no hardcoded jurisdiction logic.

## Selecting the active jurisdiction

Set `NEXT_PUBLIC_JURISDICTION` (build-time env var) to a registered pack slug.
Defaults to `pr`.

```bash
NEXT_PUBLIC_JURISDICTION=pr   # Puerto Rico (default)
```

## What a pack contains

| Section | Replaces previously-hardcoded code |
| --- | --- |
| `meta` | product name + "Puerto Rico" tagline in `page.tsx` |
| `geo` | subdivision terminology ("Municipality" / "County") |
| `kb` | the 5 knowledge-base tables (municipalities, business types, questions, documents, rules) |
| `docMappings` | `LEGACY_CODE`, `RECOMMENDED`, `DOC_ORDER` formerly in `kb.ts` |
| `flagAdvisories` | `POTENTIAL_BY_FLAG` formerly in `potentialRequirements.ts` (DRNA, DTOP, etc.) |
| `documentIntelligence` | the LLM system prompt + document-class list + extraction hints formerly hardcoded in `api/analyze-document/route.ts` |

The deterministic rules engine (`rulesEngine.ts`) and relationship/scoring layer
(`relationshipEngine.ts`) are already jurisdiction-clean and need **no changes**.

## Onboarding a new jurisdiction (e.g. Florida)

1. Author the KB tables for the jurisdiction (`municipalities`/counties,
   `business_types`, `questions`, `documents`, `rules`). This is the bulk of the
   work and requires domain knowledge — it is **data**, not code.
2. Create `jurisdictions/fl/index.ts` exporting a `JurisdictionPack` (copy
   `pr/index.ts` as a template; swap the agency names, geo terminology,
   advisories, document classes, and extraction hints).
3. Register it in `jurisdictions/index.ts`:
   ```ts
   import { floridaPack } from "./fl";
   export const JURISDICTION_REGISTRY = { pr: puertoRicoPack, fl: floridaPack };
   ```
4. Build with `NEXT_PUBLIC_JURISDICTION=fl`. No engine, UI, or route changes.

## Remaining coupling (tracked)

`i18n.ts` still embeds some jurisdiction names inside English translation keys.
Those strings are display-only and do not affect logic; migrating them to
pack-sourced labels is the next increment toward full string-level neutrality.
