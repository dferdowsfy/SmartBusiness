# SmartPR Licensing Rules Engine — Design

**Principle**: Requirements are **never** derived from LLM prompts or hardcoded if/else in application code. All logic lives in the database as versioned, auditable, declarative rules.

## 1. Goals
- Accurate, updatable mapping from business profile → exact list of required licenses, permits, certifications, and supporting documents.
- Support for conditional logic (industry + activities + location + structure + scale).
- Explicit dependencies (order of acquisition).
- Per-municipality overrides (critical in PR with 78 municipalities).
- Full audit trail of which rule version produced which requirement for a given business.
- Easy for compliance experts (not just devs) to review and propose changes.

## 2. Core Data Model (see db schema)
- `agencies` — canonical list with bilingual names + future API endpoints.
- `requirements` — the catalog (licenses, permits, certs, docs). Each has `issuing_agency_id`, category, typical validity.
- `rule_sets` — versioned snapshots (e.g. `core_v3`, `restaurant_san_juan_v2`). Has effective dates.
- `requirement_rules` — the mappings. `conditions` (JSONB) + `requirement_id` + `is_mandatory` + `priority`.
- `requirement_dependencies` — graph edges (hard prerequisite, recommended, informational).

## 3. Condition Language (Declarative JSONB)
The backend evaluation engine (Python) interprets conditions. Keep the language simple and explicit.

### Supported Operators (MVP)
```json
{
  "industry": "restaurant",
  "is_home_based": false,
  "has_food_service": true,
  "alcohol_sales": true,
  "employee_count": { "$gte": 5 },
  "municipality": { "$in": ["San Juan", "Bayamón", "Carolina"] },
  "business_structure": { "$in": ["llc", "corporation"] },
  "$or": [
    { "industry": "medical_office" },
    { "provides_healthcare": true }
  ]
}
```

- Simple equality / membership for strings and booleans.
- Numeric comparisons (`$gte`, `$lte`, `$eq`, `$gt`).
- `$in`, `$nin`.
- `$and` (implicit top-level object), `$or`.
- Future: `$not`, geospatial (for zoning), regex for complex names.

**Evaluation order**:
1. Load active rule_set(s) for the profile (core + industry-specific + municipality override).
2. For each `requirement_rule`, evaluate `conditions` against the merged discovery profile (base fields + answers JSONB).
3. Collect matching requirements. Highest priority (lowest number) wins on conflicts.
4. Apply dependencies to mark prerequisites.

## 4. Rule Evaluation Flow (Backend)
```
business profile (structured + answers JSONB)
          │
          ▼
select active rule_sets (core + matching industry + location overrides)
          │
          ▼
for each rule in requirement_rules (ordered by priority):
    if conditions_match(profile, rule.conditions):
        add requirement (or override previous)
          │
          ▼
apply dependency graph (transitive closure for display order)
          │
          ▼
materialize into business_requirements (with rule_set version + source_rule_id)
          │
          ▼
return to UI + store snapshot for audit
```

The engine is pure and idempotent. Re-running on the same profile + same rule_set version produces identical results.

## 5. Versioning & Change Management
- Every rule_set has `version` + `effective_from` / `effective_to`.
- When regulations change, create a new version. Old businesses keep historical snapshot until they re-run evaluation.
- `business_requirements` stores `rule_set_version` at the time of materialization.
- Admin workflow (MVP): JSON seed files + backend loader script with dry-run + diff report.
- Later: Simple web UI for compliance team to propose rule changes → review → activate.

**Regulatory Citation Field** (add to `requirement_rules` or `requirements`):
```json
"citation": {
  "source": "Ley 161-2018 / OGPe Reglamento",
  "url": "https://...",
  "effective": "2024-03-01"
}
```

## 6. Profile Derivation (from Discovery)
The wizard collects:
- Base: name, municipality, industry, structure, address, employee_count, is_home_based.
- Activity flags (dynamic): food_service, alcohol, healthcare_services, professional_services, manufacturing, retail, tourism, construction, indoor_seating, commercial_kitchen, etc.

These are stored in `discovery_answers.answers` (JSONB) and also denormalized into `businesses` for fast filtering.

A small transformation layer merges them into a single "profile" dict for rule evaluation.

## 7. Special Handling
- **Home-based**: Many municipalities restrict or require extra zoning approval. Rules can return "home_occupation_permit" or flag "consult municipality zoning".
- **Professional Services**: If "provides_professional_services" + specific profession → require individual professional license (cross-reference to Examining Boards lookup).
- **Multi-location**: Future — one business can have multiple locations; requirements become per-location.
- **Exemptions**: Rare but exist (certain small home businesses). Model as negative conditions or explicit exemption rules with lower priority.

## 8. Example Seed Structure (JSON)
See `../rules/seeds/example-restaurant-rule-set.json` (to be loaded by script).

High-level example:
```json
{
  "rule_set": { "name": "restaurant_general_v1", "version": 1, "effective_from": "2025-01-01" },
  "rules": [
    {
      "requirement_code": "merchant_registration",
      "conditions": { "industry": { "$in": ["restaurant", "retail", "service"] } },
      "is_mandatory": true,
      "priority": 10
    },
    {
      "requirement_code": "health_permit",
      "conditions": { "has_food_service": true },
      "is_mandatory": true,
      "priority": 20
    },
    {
      "requirement_code": "fire_certification",
      "conditions": { "$or": [ {"has_food_service": true}, {"industry": "restaurant"} ] },
      "is_mandatory": true,
      "priority": 30
    }
  ]
}
```

## 9. Testing the Rules Engine
- Unit tests: condition evaluator against golden profile + expected requirements.
- Snapshot tests: for each major industry + 3 municipalities, assert exact requirement list + dependencies.
- Regulatory review: compliance expert signs off on diff when new version activated.
- Chaos: inject contradictory rules → priority system + audit log must make outcome deterministic and explainable.

## 10. Performance
- Rule sets are small (< few hundred rules total for MVP).
- GIN indexes on conditions + answers.
- Evaluation is fast (<50ms) — cache materialized `business_requirements` and invalidate only on profile change or rule activation.
- For very large rule bases later: compile to decision tree or use a rules engine lib (e.g. durable_rules or simple Rete in Python), but JSONB + Python is sufficient and transparent for years.

## 11. Maintenance Process (Recommended)
1. Compliance / legal researcher proposes change (ticket + citation).
2. Create new rule_set version or delta rules.
3. Run diff against production profiles (anonymized) → impact report (% businesses affected, which requirements added/removed).
4. Peer + legal review.
5. Activate with effective date.
6. Notify affected users (in-app + email) with "Your checklist may have changed — re-validate".
7. Old versions remain queryable for historical packages.

## 12. Bilingual & Display
- All requirement and agency names/descriptions stored bilingual in master tables.
- Findings and checklist items pull the correct language from the user's `profiles.preferred_language` or explicit choice.
- Rule conditions are language-agnostic (keys are internal codes).

## 13. Future Enhancements (Post-MVP)
- Municipality-specific rule_set overrides loaded automatically.
- Time-based rules (seasonal tourism requirements).
- Integration with official machine-readable feeds from SBP/OGPe when published.
- ML-assisted suggestion of missing rules from analysis of rejection patterns (human curated).

**Golden Rule**: If a human compliance expert cannot read the `requirement_rules` table + conditions and explain exactly why a restaurant in San Juan needs a Health Permit and Fire Certification, the engine is too complex.

Keep it declarative, versioned, and reviewable.
