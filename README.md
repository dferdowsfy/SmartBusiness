# SmartPR — Puerto Rico Business Licensing Readiness Platform

**AI-Powered Licensing Readiness Assistant (TurboTax for PR Business Licensing)**

> **Critical Scope Statement**  
> SmartPR **does not approve licenses**.  
> SmartPR determines required licenses/permits/certifications/documents, validates applicant readiness, and produces a submission package.  
> Government agencies (SBP, OGPe, Hacienda, Salud, Bomberos, Municipalities, Examining Boards, etc.) remain the sole approving authorities.

## 🚀 Launch Locally for Testing (macOS)

You now have a runnable local prototype that closely follows the approved design.

### One-command launch (recommended)

```bash
cd /Users/dariusferdows/SmartPR
npm run dev
```

Or from anywhere after opening a **new terminal** (or `source ~/.zshrc`):

```bash
smartpr
```

### Other ways to launch

- Double-click the Desktop shortcut: `~/Desktop/SmartPR-Local.command`
- Frontend only: `npm run dev:frontend`
- Backend only: `npm run dev:backend`

### What you'll see
- Frontend (Next.js): http://localhost:3000 — full interactive demo of the 9-step flow (discovery, dynamic questions, rules-based checklist, mock uploads + AI extraction, validation engine, findings, and package generation).
- Backend (FastAPI): http://localhost:8000 — real endpoints matching the design (`/health`, `/businesses`, `/requirements`, `/validations`, etc.). Toggle "Use local backend" in the UI to switch from pure mock to real API calls.

### First time setup notes
- The frontend demo works immediately.
- For the real backend, the venv was created during scaffolding. If the backend doesn't start, run:
  ```bash
  cd backend
  source .venv/bin/activate
  pip install -r requirements.txt 2>/dev/null || pip install fastapi uvicorn pydantic python-multipart
  ```
- To use real AI (xAI) and Supabase: add keys to `.env` (see the frontend and backend `.env.example` files).

### xAI production configuration

SmartPR calls xAI directly through `POST https://api.x.ai/v1/responses`; it does
not use OpenRouter. Configure these server-side variables in **every** deployed
environment:

```text
XAI_API_KEY=<secret xAI API key>
XAI_MODEL=grok-4.3
XAI_BASE_URL=https://api.x.ai/v1  # optional; this is the default
```

Railway variables are environment-specific. Adding a variable to `production`
does not add it to preview, staging, or any other Railway environment. A missing
`XAI_API_KEY` makes SmartPR's AI routes return HTTP 503 before contacting xAI;
an upstream xAI failure is returned as HTTP 502.

### Stopping
Press `Ctrl + C` in the terminal running the launch script (it cleans up both servers).

## Design Documentation
All original deliverables are in the `design/` folder and generated artifacts in `docs/`. The local demo was built to match the architecture, rules engine, validation workflow, and UI patterns exactly.

## Product Vision
Business owners in Puerto Rico face opaque, multi-agency requirements that lead to incomplete applications, rejections, and delays. SmartPR provides a guided, validated, checklist-driven experience that tells the user exactly what is needed and whether they are ready to submit — nothing more.

## Objectives (MVP)
- Accurate, maintainable mapping of business profiles → required items (licenses, permits, certs, supporting docs, agencies).
- Step-by-step discovery with dynamic follow-ups.
- Secure document upload + AI-powered extraction + multi-axis validation (completeness, consistency, expiration, business rules).
- TurboTax-style personalized checklist with progress, critical path, time estimates.
- Clear Readiness Score + categorized Findings (Critical / Warning / Info) with evidence + recommended action + responsible agency.
- Professional, bilingual (EN/ES), accessible, low-clutter UI.
- Downloadable, government-style Submission Package (PDF) — never raw data dump.
- Fully database-driven rules (no hardcoded logic in prompts or code).
- Architecture explicitly designed for future authenticated submission to SBP/OGPe/Municipal portals.

## Non-Goals (MVP)
- No government submission / e-filing.
- No "license granted", "approved", or predictive approval language anywhere in UI, reports, or communications.
- No replacement of professional legal/accounting advice (strong disclaimers).

## Key Deliverables (This Design Package)
1. Complete Application Architecture
2. User Flow Diagrams (Mermaid)
3. Database Schema (Supabase PostgreSQL)
4. Licensing Rules Engine Design (declarative, versioned, auditable)
5. Document Ingestion + AI Validation Architecture
6. API Architecture (FastAPI + contracts)
7. UI/UX Wireframes + Design System (bilingual, WCAG AA, mobile-first)
8. Future Integration Strategy (SBP, OGPe, etc.)
9. MVP Implementation Roadmap (phased, risk-aware)
10. Polished artifacts: Design Spec (DOCX), Architecture Deck (PPTX), diagrams, seed data examples.

## Tech Stack (as specified)
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- **Backend**: FastAPI (Python)
- **Database / Auth / Storage**: Supabase (PostgreSQL, Auth, Storage)
- **AI**: xAI Responses API (Grok, configured server-side)
- **Document Processing**: AI vision + text extraction (structured output), optional OCR fallback
- **i18n**: next-intl (or equivalent) — full bilingual from day one
- **Observability / Audit**: Structured logs + validation audit trail (model, version, evidence, timestamp)

## Guiding Principles (GovTech + SuperClaude)
- Evidence > assumptions
- Readiness only — explicit disclaimers everywhere
- Database-driven rules for accuracy and maintainability
- Human-in-the-loop for edge cases; AI augments, does not decide final compliance
- Privacy & security by design (least data, signed URLs, encryption, retention policies, export controls)
- Accessibility & language equity first
- Measurable quality gates on every validation path

## Repository Layout (Design Phase)
```
SmartPR/
├── README.md
├── design/
│   ├── architecture/
│   ├── flows/
│   ├── db/
│   ├── rules/
│   ├── api/
│   ├── ux/
│   ├── integration/
│   ├── roadmap/
│   └── assets/
├── docs/
│   └── (generated DOCX + PPTX here)
├── generators/          # JS generators for DOCX/PPTX (run via node)
└── seeds/               # Example rule seeds, agency master data (to be expanded)
```

## Next Steps for Implementation
See [MVP Implementation Roadmap](design/roadmap/MVP-Roadmap.md) and the full design package.

**Status**: Design Complete (this package). Implementation follows separate plan with quality gates.

---
*Prepared following SuperClaude design protocols, evidence-based architecture, and GovTech production standards. All language strictly limited to "readiness", "validation", "recommended for submission".*
