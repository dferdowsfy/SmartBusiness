# SmartPR Application Architecture

**Version**: 1.0 (Design)  
**Date**: Design Phase  
**Scope**: MVP + explicit extension points for government integration  
**Guiding Constraint**: The system **never** states or implies that a license/permit is approved or granted. All outputs use "readiness", "validated for submission", "recommended actions".

## 1. High-Level Architecture

```
Users (Web + Future Mobile)
        │ HTTPS + Auth (Supabase)
        ▼
Next.js Frontend (App Router, TS, Tailwind, shadcn/ui)
  - Wizard (multi-step discovery)
  - Checklist + Progress
  - Document Upload + Viewer
  - Findings Dashboard
  - Readiness Score + Package Builder
        │ REST + tRPC or typed fetch / Server Actions
        ▼
FastAPI Backend (Python 3.11+)
  - Discovery & Requirements Engine
  - Document Service (upload orchestration, metadata)
  - AI Orchestration (OpenRouter client + structured output)
  - Validation Engine (completeness, consistency, expiration, rules)
  - Package Generator (WeasyPrint or ReportLab for PDF)
  - Audit Logger
        │
        ├─→ Supabase PostgreSQL (primary data + rules KB)
        ├─→ Supabase Storage (encrypted docs, signed URLs)
        ├─→ Supabase Auth (JWT, RBAC via app metadata)
        └─→ OpenRouter (LLM gateway: Claude 3.5 Sonnet/Opus, GPT-4o, Gemini 1.5, configurable per-task routing)
```

**Deployment Notes (MVP)**:
- Frontend: Vercel (or Netlify)
- Backend: Railway / Fly.io / Render / AWS ECS (containerized)
- Supabase: Hosted (or self-hosted for on-prem gov future)
- All AI calls go through OpenRouter for model flexibility + cost control + logging.

## 2. Layered Breakdown

### 2.1 Frontend Layers
- **Presentation**: shadcn/ui + Radix + Tailwind. Strict design tokens for "Gov + TurboTax" feel: clean sans, high contrast, generous whitespace, blue/teal trust palette with Puerto Rico accent (e.g. deep blue #0A2540, teal #0D9488, gold accent for highlights).
- **State**: React Server Components + client state (Zustand or Jotai for wizard). URL-driven steps for shareability/resume.
- **i18n**: next-intl. All strings, labels, findings, agency names, help text bilingual (en/es). KB content stored bilingual.
- **Accessibility**: WCAG 2.2 AA baseline. Semantic HTML, ARIA, keyboard, high-contrast mode, reduced-motion. Language switch prominent.
- **Responsive**: Mobile-first. Wizard optimized for phone (progress stepper, large taps). Desktop for document review.

### 2.2 Backend Layers (FastAPI)
- **API Routers**: `/auth` (proxy/supabase), `/businesses`, `/discovery`, `/requirements`, `/documents`, `/validations`, `/findings`, `/packages`, `/admin/kb` (rules).
- **Services**:
  - `requirements_service.py`: Applies rules engine to profile → required items.
  - `document_service.py`: Presigned upload, virus scan hook (ClamAV or storage provider), metadata storage.
  - `ai_service.py`: Structured extraction (Pydantic models), consistency checks, summarization. Model routing config.
  - `validation_engine.py`: Pure functions + DB-backed rules for completeness/consistency/expiration/business rules.
  - `package_service.py`: Assemble structured data → PDF (professional template, table of contents, agency index, QR to checklist?).
- **Background**: Celery or FastAPI BackgroundTasks + Redis for long-running AI/validation jobs. Webhooks for future gov callbacks.
- **Security**: JWT verification (Supabase), input sanitization, rate limiting, PII minimization (store only extracted structured fields + doc hash; full text redacted or not persisted unless justified).

### 2.3 Data & Storage
- **Primary**: Supabase Postgres. Row Level Security (RLS) enforced. Users can only access their own businesses/docs/findings.
- **Documents**: Supabase Storage buckets (private). Signed URLs with short TTL. Metadata + extracted JSON in DB. Retention policy + user-initiated purge/export.
- **Audit**: Immutable `validation_audits` table (who/what/when/model/prompt_version/inputs_hash/outputs/evidence).
- **Rules KB**: Versioned tables (see Rules Engine design). Admin UI (MVP: seed scripts + simple admin pages; later dedicated).

### 2.4 AI Integration (OpenRouter)
- **Gateway**: Single client. Per-task model profiles (e.g. `extraction`: vision-capable high-accuracy; `reasoning`: Sonnet/Claude for rule eval; `summarization`: cheaper).
- **Structured Outputs**: Use OpenRouter + provider tools (JSON mode / tool calling) + Pydantic validation + retries + fallback model.
- **Prompt Management**: Versioned prompts in code or DB (not ad-hoc). Include strict "readiness-only" guardrails in every system prompt.
- **Guardrails**: Output filters, refusal patterns, confidence thresholds. Human review flag for low-confidence extractions.
- **Cost/Usage**: Per-user or per-business quotas in MVP. Logging of tokens/cost for later billing/optimization.
- **Fallbacks**: If OpenRouter down → graceful degradation (manual checklist entry, "AI validation temporarily unavailable").

### 2.5 Security, Compliance & Privacy (GovTech Critical)
- **Data Classification**: PII in docs (SSN last4 only if needed, names, addresses, license #s). Minimize storage of raw PII.
- **Consent**: Explicit consent for AI document processing at upload. Bilingual.
- **Encryption**: At-rest (Supabase), in-transit (TLS 1.3). Client-side encryption option for highly sensitive future.
- **Access Control**: Supabase Auth + app-level roles (owner, viewer, advisor). No superuser direct access in prod.
- **Auditability**: Every readiness determination and finding traceable to source documents + rule versions + AI output.
- **Retention & Right to be Forgotten**: Configurable per org + user delete flows that cascade + storage purge.
- **Disclaimers**: Persistent banner + in every PDF + on checklist: "SmartPR provides readiness assessment only. All approvals are issued exclusively by the Government of Puerto Rico agencies."
- **Vulnerability**: OWASP ASVS baseline. Dependency scanning, SAST in CI. Annual pen-test target post-MVP.
- **Sovereignty**: All data in US/PR jurisdiction (Supabase regions). No training on customer docs.

### 2.6 Observability
- Structured logging (JSON) + correlation IDs.
- Metrics: Readiness score distribution, validation pass/fail rates, AI extraction accuracy (sampled human review), time-to-checklist, drop-off points.
- Tracing: OpenTelemetry (future).
- Error budgets + alerting on critical paths (upload → validation).

## 3. Component Interaction (Key Flow)

1. User creates Business Profile via Wizard → `POST /businesses` + discovery answers → profile JSONB.
2. Requirements Engine evaluates rules → materializes `required_items` (licenses, permits, certs, documents) with dependencies.
3. User uploads docs → storage + metadata + trigger async extraction job.
4. Extraction → structured `extracted_fields` (normalized: entity_name, address, dates, ids, etc.).
5. Validation Engine runs:
   - Completeness (missing required?)
   - Cross-doc consistency (names, addresses, EINs match?)
   - Expiration (warn <30/60 days)
   - Business rules (e.g. restaurant without health permit = critical)
6. Findings generated (categorized, evidence-linked to specific doc + rule).
7. Readiness Score computed (weighted: critical items 60%, completeness 20%, expirations 10%, consistency 10%).
8. Package Builder assembles PDF from materialized view + embeds index of docs (hashes, not full binaries in report for size).

## 4. Scalability & Extensibility
- Rules engine is the heart — fully externalized.
- API versioning (`/v1/...`).
- Feature flags for rollout (new industries, new validation types).
- Multi-tenant ready (orgs/accounts) from day 1 for accountants/consultants who manage multiple clients.
- Future "Submit" button is a thin adapter layer calling external APIs once auth + data mapping contracts exist.

## 5. Technology Choices Rationale
- **Next.js**: Best DX for bilingual SEO-friendly + server components reduce client JS.
- **FastAPI**: Excellent for typed Python services, async, OpenAPI auto, great for AI glue code.
- **Supabase**: Auth + DB + Storage + RLS in one, excellent for startups, PR data residency options.
- **OpenRouter**: Avoids vendor lock-in on models, single integration point, usage analytics, easy A/B of Claude vs GPT for extraction quality.
- **PDF generation in backend**: Full control over layout, branding, disclaimers, accessibility tagging.

## 6. Risks & Mitigations (Architecture Level)
- **Stale rules / regulatory change**: Versioned KB + admin workflow + change audit. Notification to affected users.
- **AI hallucination on extraction**: Structured output + confidence + secondary validation pass + "verify this field" UI + human escalation path.
- **Municipality variance**: Rules support per-municipality overrides. Start with high-volume municipalities (San Juan, etc.) + general + "consult local" flags.
- **Document quality (scans, photos)**: Pre-process (deskew, enhance) + multi-page support + user "this page is the certificate" tagging + fallback manual entry.
- **Language accuracy**: Professional translation of all static + curated KB content. AI only for user-generated or extraction.

## 7. Diagrams

See sibling directories:
- `../flows/` for end-to-end and per-step Mermaid diagrams.
- `../db/` for schema ERD (Mermaid + SQL).
- `../rules/` for rules evaluation flow.

## 8. Future Integration Architecture (Preview)
See dedicated `../integration/Future-Integration-Strategy.md`.

Core principle: SmartPR produces a **machine-readable + human-readable submission package** that maps 1:1 to what SBP/OGPe expect. When APIs become available, the package + auth token + user consent enables "Submit to Agency" with audit trail.

---
**Strict Language Policy**: All user-facing text, logs, reports, and error messages must use only readiness terminology. Automated tests + linters will enforce a disallow list ("approved", "granted", "license issued", "compliant", "cleared", etc.) in production strings.
