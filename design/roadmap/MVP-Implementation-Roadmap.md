# SmartPR MVP Implementation Roadmap

**Duration Target**: 10-14 weeks for a focused, high-quality MVP (team of 3-5: 1 PM/Designer + 1-2 Frontend + 1 Backend/AI + part-time compliance + QA).

**Non-Negotiables**:
- No "approved" language anywhere.
- Fully database-driven rules engine (no prompt logic).
- Bilingual (EN/ES) from first commit.
- WCAG AA + mobile responsive.
- Professional PDF package output.
- Comprehensive audit + disclaimers.

## Phase 0: Foundations (Week 0-1)
- Finalize this design package + get stakeholder sign-off (legal, compliance, product).
- Set up repos (monorepo or separate frontend/backend), Supabase project (dev + staging), CI/CD, linting, typechecking, pre-commit hooks.
- Define "readiness language" disallow list + automated check in CI.
- Create initial i18n files (all static strings) with professional translation review.
- Threat model + privacy review (data flow of PII in documents).
- Seed initial agencies + core requirements from research (Hacienda, OGPe, Salud, Bomberos, common municipalities).

**Deliverable**: Working empty app shell with auth + "Create Business" stub + bilingual toggle.

## Phase 1: Discovery & Rules Foundation (Weeks 1-3)
- Implement dynamic wizard (Step 1) with conditional follow-ups for 4-5 priority industries (restaurant/food, medical/professional, retail, construction, general services).
- Design & implement rules engine (Python evaluator + JSONB conditions).
- Seed 2-3 full rule_sets (general + restaurant + professional services) with citations where available.
- Materialize requirements and basic checklist view (read-only at first).
- Basic profile storage + re-compute on answer changes.
- Unit + snapshot tests for rules (golden profiles → expected requirements).

**Milestone**: User can complete discovery for a restaurant in San Juan and see a realistic checklist of 8-12 items with dependencies.

## Phase 2: Documents + AI Pipeline (Weeks 3-6)
- Document upload to Supabase Storage (signed URLs, metadata, sha256).
- Background job queue (Celery / RQ / FastAPI + Redis or Supabase Edge Functions if suitable).
- OpenRouter integration + structured extraction (Pydantic models for common doc types).
- Extraction review UI (show extracted, allow edit/correct).
- Link uploaded docs to requirements (manual or heuristic).
- Basic validation passes (completeness first).
- Audit logging for every AI call.

**Milestone**: Upload Certificate of Incorporation + Merchant Registration → AI extracts fields → checklist items move to "uploaded" / "extracted".

## Phase 3: Full Validation Engine + Findings (Weeks 6-8)
- Completeness, consistency (fuzzy name/address/EIN matching), expiration logic.
- Business rules pass (re-use rules engine + domain-specific checks, e.g. food service requires health + fire).
- Findings generation with evidence, bilingual text, agency links, recommended actions.
- Readiness score calculation (tunable weights, documented).
- Re-validation on new uploads / profile edits.
- Findings dashboard UI.

**Milestone**: Realistic end-to-end for one business type: upload docs → score + categorized findings appear. User can iterate and improve score.

## Phase 4: Package Builder + Polish (Weeks 8-10)
- Professional PDF generation (layout, TOC, disclaimers, agency grouping, document index with hashes, findings, profile summary).
- Package history + re-generate.
- Business dashboard (multiple businesses for advisors, history, quick actions).
- Error states, loading, empty states, help content.
- Accessibility audit + fixes.
- Performance pass (upload + validation < acceptable thresholds).
- Legal copy review (disclaimers, consent, terms).

**Milestone**: User can generate and download a government-style PDF package that looks production-ready.

## Phase 5: Hardening, Testing, Launch Prep (Weeks 10-12/14)
- End-to-end tests (Playwright) for main happy paths + key error paths.
- Security review (authz, storage access, injection, rate limits).
- Load / cost testing on AI paths (budgeting, fallbacks).
- Compliance expert review of seeded rules + sample packages.
- Bilingual QA (native or professional review of all flows).
- Onboarding copy, sample data, "how SmartPR works" educational flow.
- Monitoring + alerting (score anomalies, AI failure rates, upload failures).
- Staged rollout (internal → beta users → public).
- Support processes (what happens when user hits a municipality not in rules yet?).

**Launch Criteria**:
- Zero "approval" language in code, UI, or docs.
- Rules for at least 5 industries + 3 major municipalities + general fallbacks.
- AI extraction working on real scanned PR docs (tested with varied quality).
- PDF package reviewed by 2+ external compliance-minded reviewers.
- All critical paths have automated tests + manual sign-off.
- Clear path for users to give feedback / request new rule coverage.

## Post-MVP Priorities (Backlog)
- More municipalities and edge industries (tourism, manufacturing with environmental, alcohol-specific, pharmacies, etc.).
- Accountant / advisor multi-client workspace (orgs, roles, shared packages).
- Renewal reminders + expiration monitoring.
- Read-only verification integrations (professional licenses, basic status checks).
- Pre-validate + submission adapters (per integration strategy).
- Mobile native feel (PWA or thin native shell).
- Advanced AI: better consistency (LLM + rules hybrid), document classification auto-tagging.
- Analytics dashboard for platform (anonymized) to identify common failure patterns → feed back into rules.

## Risks & Mitigations in Roadmap
- **Regulatory change during build**: Freeze core rule_set early, make updates cheap (data only).
- **AI quality variance on real PR gov docs**: Heavy investment in prompt versioning + human review loop + fallback manual entry + user correction path.
- **Municipality fragmentation**: Prioritize top 5-7 by business formation volume first; make "consult local" a first-class informational finding.
- **Scope creep on "just one more validation"**: Ruthless prioritization. Anything not required for a defensible readiness score + professional package is post-MVP.
- **Translation debt**: All new strings must be added to i18n files in the same PR; no English-only strings merged.

## Team & Process Recommendations
- Weekly compliance / legal review of new rules or UI copy.
- "Readiness language" is a blocking review item.
- Use feature flags for new industries or validation types.
- Instrument everything (drop-off in wizard, extraction confidence distribution, time from first upload to first package).
- Document every design decision that affects user trust or legal exposure.

## Definition of Done for MVP
A new user can:
1. Create a business (e.g. restaurant in a supported municipality).
2. Answer discovery questions (base + relevant follow-ups).
3. See accurate, sourced checklist.
4. Upload 4-6 typical documents (scans or photos OK).
5. Receive AI extractions + multi-axis validation.
6. See clear Critical/Warning/Info findings with actions.
7. Generate and download a professional, bilingual, disclaimer-heavy PDF package that a reasonable person would feel confident taking to an accountant or agency.
8. Understand at every step that SmartPR only assesses readiness.

Everything else is optimization or expansion.
