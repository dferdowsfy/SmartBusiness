# SmartPR API Architecture (FastAPI)

**Design Goals**
- Clean, typed contracts (Pydantic).
- Versioned (`/api/v1/...`).
- Idempotent where possible.
- Readiness-focused responses (no approval semantics).
- Excellent OpenAPI docs for future integrators and internal frontend.
- Auth via Supabase JWT (verified in middleware).

## Base
- Base URL (MVP): `https://api.smartpr.example/v1`
- All responses JSON. Errors follow RFC 7807 Problem Details.
- Pagination: cursor-based for lists.
- Bilingual: Accept-Language or `?lang=es` ; responses include `_i18n` or client selects.

## Authentication & Authorization
- Supabase JWT in `Authorization: Bearer <token>`.
- RLS in DB + backend checks (owner_id matches token).
- Service-to-service: signed internal tokens (for background jobs).
- Future: OAuth2 client credentials for accountant dashboards / partner integrations.

## Key Resource Groups

### Businesses
`GET /businesses` — list user's businesses (summary + latest readiness)
`POST /businesses` — create with initial profile
`GET /businesses/{id}` — full profile + latest score + counts
`PATCH /businesses/{id}` — update profile (triggers re-eval option)
`DELETE /businesses/{id}` — soft delete with cascade note

### Discovery
`POST /businesses/{id}/discovery` — submit answers (partial or final)
`GET /businesses/{id}/discovery` — current answers + suggested next questions (if incomplete)

### Requirements
`GET /businesses/{id}/requirements` — current materialized list (with status, linked docs, agency)
`POST /businesses/{id}/requirements/recompute` — force re-run rules engine (idempotent)

### Documents
`POST /businesses/{id}/documents` — initiate upload (returns signed URL + document_id)
`GET /businesses/{id}/documents` — list with extraction summary + validation status
`GET /documents/{doc_id}/download` — short-lived signed URL (backend proxies or redirects)
`DELETE /documents/{doc_id}`

### Validation & Findings
`POST /businesses/{id}/validations` — trigger validation run (async → returns run_id)
`GET /businesses/{id}/validations/{run_id}` — status + summary
`GET /businesses/{id}/findings` — latest findings (filter by severity)
`GET /validations/{run_id}/findings`

### Packages
`POST /businesses/{id}/packages` — generate submission package (async)
`GET /businesses/{id}/packages` — list historical packages
`GET /packages/{pkg_id}/download` — PDF

### Admin / KB (protected, service role or admin users)
`GET /admin/agencies`
`POST /admin/requirements`
`POST /admin/rule-sets` (with dry-run diff capability)
`POST /admin/rule-sets/{id}/activate`

## Async Pattern (for AI-heavy ops)
Long-running operations (extraction, full validation, package gen) return 202 + `{"job_id": "...", "status_url": "..."}`.
Frontend polls or uses Supabase Realtime / webhooks (future) on `validation_runs` / `submission_packages`.

## Webhooks (Future)
For when government portals offer callbacks, SmartPR can expose webhook endpoints registered per business for status updates.

## Data Contracts (Key Pydantic Shapes — illustrative)

```python
class BusinessProfile(BaseModel):
    name: str
    municipality: str
    industry: str
    business_structure: BusinessStructure
    is_home_based: bool
    employee_count: int | None = None
    # ...

class DiscoveryAnswers(BaseModel):
    answers: dict[str, Any]  # flexible but validated keys
    completed: bool

class RequirementItem(BaseModel):
    id: UUID
    code: str
    name_en: str
    name_es: str
    agency: AgencySummary
    category: str
    is_mandatory: bool
    status: ValidationStatus
    linked_document_ids: list[UUID]
    last_validated_at: datetime | None

class ExtractedData(BaseModel):
    business_name: str | None = None
    entity_name: str | None = None
    address: Address | None = None
    issue_date: date | None = None
    expiration_date: date | None = None
    license_number: str | None = None
    tax_id: str | None = None
    # ...

class Finding(BaseModel):
    id: UUID
    severity: Literal["critical", "warning", "informational"]
    title_en: str
    title_es: str
    description_en: str
    description_es: str
    evidence: dict
    recommended_action_en: str
    recommended_action_es: str
    applicable_agency: AgencySummary | None
```

## Error Examples
```json
{
  "type": "https://smartpr.example/problems/ai-extraction-failed",
  "title": "AI extraction could not be completed",
  "status": 422,
  "detail": "Low quality scan or unsupported format",
  "instance": "/documents/123/extract"
}
```

## Rate Limiting & Quotas
- Per-user: 10 uploads/min, 5 validations/min (tunable).
- AI cost guard: daily token budget per business with graceful "AI features temporarily limited".

## OpenAPI & Client Generation
FastAPI auto-generates OpenAPI 3.1. Frontend uses `openapi-typescript-codegen` or `orval` for typed hooks. Internal tools use the spec for integration planning.

## Versioning Strategy
- URL prefix `/v1`.
- Backward-compatible additions only in minor.
- Breaking changes → new major version + migration guide + parallel support window.
- Rule engine changes are **not** API version changes (they are data changes with effective dates).

## Security Headers & Practices
- CORS locked to known origins (web + future partner domains).
- Request ID propagation for tracing.
- Input size limits on uploads (enforced at storage + API).
- All PII fields explicitly modeled; raw document text never returned in API responses unless user requests "full text export" (logged).

## Testing
- Contract tests against OpenAPI spec.
- Property-based tests for rules evaluation (same profile + same rule_set → same requirements).
- Load tests on upload + validation path (critical path).

This API surface is deliberately small and focused. Most complexity lives in the rules + validation engines, not in a large number of endpoints.
