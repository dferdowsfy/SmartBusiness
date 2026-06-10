# SmartPR Future Integration Strategy

**Core Philosophy**: SmartPR is the **readiness and validation layer**. Submission to government is a future **handoff**, not core MVP functionality. The architecture is designed from day one so that "Submit to SBP" is a thin, auditable adapter rather than a rewrite.

## Target Integrations (in rough priority order)
1. **Single Business Portal (SBP / DDEC)** — central orchestrator for many permits.
2. **OGPe (Oficina de Gerencia de Permisos)** — Permiso Único, use permits, construction-related.
3. **Hacienda (SURI)** — Registro de Comerciante updates, IVU, tax-related filings.
4. **Municipal portals** (78, start with largest: San Juan, Bayamón, Carolina, Ponce, etc.) — Patente Municipal, local use permits.
5. **Departamento de Salud** — health permit applications/renewals.
6. **Cuerpo de Bomberos** — fire certification requests.
7. **Department of State / Examining Boards** — professional license verification (read-only lookup first).
8. **E3 Solutions or other platforms** (if they become official channels).
9. **CRIM** — property tax clearance checks.

## Integration Layers (Future)

### Layer 0: Data & Package Standards (MVP — Do This Now)
- Machine-readable package (JSON + PDF/A) with stable schema.
- Canonical requirement codes that map to agency forms.
- Document classification + extracted fields that agencies already request.
- Strong versioning + hash chain so agencies can trust the provenance of the readiness package.

### Layer 1: Read-Only / Verification (Early Post-MVP)
- Pull public or authenticated status for a license/permit number.
- Verify professional licenses against Examining Boards lookup.
- Check CRIM clearance status.
- Benefit: Auto-populate "already valid" items in checklist and reduce user re-upload.

### Layer 2: Pre-Submission Validation (High Value)
- Call agency "dry-run" or "pre-validate" endpoints with package data.
- Receive structured errors/warnings before formal submission.
- SmartPR translates agency errors into user-friendly findings.

### Layer 3: Authenticated Submission
- User grants scoped consent + delegates limited authority (OAuth2 or agency-specific).
- SmartPR (or trusted partner) submits package + supporting docs via agency API.
- Receive tracking / receipt ID, store in SmartPR with link to agency portal.
- Full audit log of what was sent when.

### Layer 4: Status Polling & Renewal Reminders
- Webhooks or polling for status changes.
- SmartPR surfaces "Your Health Permit application is under review — last update 3 days ago".
- Expiration monitoring + proactive re-validation prompts.

## Technical Integration Patterns
- **Adapter per agency**: `integrations/sbp.py`, `ogpe.py`, etc. Each implements a small interface (validate_package, submit_package, get_status).
- **Mapping layer**: `agency_mappings/` — JSON or DB tables that translate SmartPR requirement codes ↔ agency form fields / document types.
- **Auth**: Prefer OAuth2 / OIDC per agency. Store only short-lived tokens or refresh tokens in secure backend vault. Never store full user gov credentials.
- **Idempotency**: All submission calls use idempotency keys.
- **Rate limiting & backoff**: Respect agency limits; queue submissions.
- **Sandbox first**: Every integration starts with sandbox/test environment before prod.

## Data Mapping Principles
- SmartPR never invents data. Extracted fields + user-confirmed values only.
- Package includes both "SmartPR normalized" and "as-submitted to agency" representations.
- Support attachments with original filenames + content hashes.
- Include the exact rule_set version and validation_run that produced the readiness claim.

## Consent & Legal
- Explicit, granular, revocable consent screen before any data leaves SmartPR toward an agency.
- Bilingual consent language reviewed by counsel.
- "I understand that SmartPR is only assisting with preparation and submission; approval is solely at the discretion of the Government of Puerto Rico."
- Audit record of consent + exact payload sent.

## Security for Integrations
- Mutual TLS or signed JWTs where required.
- Separate credentials per environment.
- Data minimization: only send fields the specific submission requires.
- Encryption in transit + at rest for any cached agency responses.
- SOC2 / similar posture for production gov integrations.

## MVP Preparation Work (No Real Calls)
- Define stable public API for the "Submission Package" (JSON schema + PDF template).
- Create a `submission_manifest` JSON that lists every document with purpose, hash, and agency mapping.
- Build an internal "mock agency" adapter for testing the handoff UI flow.
- Document the expected shape of future SBP/OGPe payloads based on current paper + portal forms.

## Risks & Mitigations
- **Agencies change forms frequently**: Versioned mappings + admin UI to update without code deploy.
- **Authentication complexity per agency**: Abstract behind a "Government Identity" service (future).
- **Liability**: Strong contracts, disclaimers, and "readiness only" positioning. SmartPR does not become the filer of record unless explicitly contracted as such.
- **Data residency / sovereignty**: Keep primary data in approved jurisdictions; only transmit necessary subsets.

## Success Metrics (Post-Integration)
- % of users who go from "Ready for Submission" → actual submission via the platform (vs. downloading PDF and going direct).
- Reduction in rejection rate for packages submitted through SmartPR vs. direct (if agencies share data).
- Time from "checklist complete" to "submitted" (target: same day for simple cases).
- User satisfaction with "one less government portal to learn".

## Phased Rollout Recommendation
1. **MVP**: Perfect readiness + beautiful package. No integration calls.
2. **Phase 1 (3-6 months post)**: Read-only verification for 2-3 high-impact items (e.g. professional license status, merchant reg existence).
3. **Phase 2**: Pre-validate + structured error translation for Permiso Único / basic SBP flow.
4. **Phase 3**: Full authenticated submission for the most common business types (restaurants, retail, professional offices) in largest municipalities.
5. **Ongoing**: Expand coverage + add renewal automation.

The better the readiness engine and package quality in MVP, the easier and more valuable every subsequent integration layer becomes. Agencies will be more willing to integrate with a system that demonstrably reduces incomplete and erroneous submissions.
