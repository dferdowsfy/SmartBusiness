# Investor Briefing — Municipality Coverage & the Regulatory Knowledge Graph

**Audience:** Investors, advisors, partners
**Subject:** What SmartPR has built across phases 1-7 of municipality coverage, why it matters, and the moat it creates.

---

## TL;DR

SmartPR is a regulatory-knowledge platform for Puerto Rico business licensing. The differentiator is not the form-filling — it is the **knowledge graph behind it**: a typed model of jurisdictions, flags, agencies, business types, questions, documents, and the rules that connect them.

Over seven authoring phases we went from a generic checklist that treated every Puerto Rico municipality identically into a **graph that routes each business through the exact set of permits, inspections, and federal/PR/municipal documents that apply to their specific town and operation**.

| Metric | Phase 0 (start) | Phase 7 (today) |
|---|---|---|
| Authored rules | 268 | **596** |
| Documents modeled | 40 | **58** |
| Geographic flags with composites | 2 sparse | **8 first-class** |
| Industries with metro coverage | 0/20 | **18/20** |
| Engine tests | 17 | **44** (all passing) |
| Avg flag-driven docs for a metro restaurant | 0 | **11** |

A boutique hotel in Old San Juan, a chemical manufacturer in Ponce, an Airbnb in Vieques, and a freight forwarder in Carolina now see fundamentally different checklists — driven by the same engine, the same knowledge graph, and the same UI.

---

## 1. Why municipality matters in Puerto Rico

Puerto Rico has **78 autonomous municipios**, each with overlapping federal (CBP, EPA, TSA, IRS), commonwealth (Hacienda, OGPe, Departamento de Salud, DRNA, JCA), and **municipal** (patente, zoning, signage, noise, traffic) regulators.

A restaurant in San Juan is not regulated like a restaurant in Aguadilla. A pharmaceutical plant in Ponce is not regulated like one in Salinas. An Airbnb in Vieques is not regulated like one in Dorado. These distinctions show up as real, specific documents — facade-preservation plans for historic districts, ferry-logistics manifests for islands, NPDES industrial discharge permits in industrial corridors — and they are the part of compliance that confuses every new business owner.

**The market problem.** Existing tools either flatten everything ("here is a generic business-license checklist for PR") or ask the user to know which special obligations apply to their town. SmartPR knows.

---

## 2. The platform's architecture in one sentence

> Each business is the intersection of **a municipality** (which carries one or more **flags**), **an industry → business type**, and **a small set of yes/no operational questions** — and the knowledge graph deterministically resolves those inputs into the documents required, the agencies behind them, and the validation rules each document must pass.

That single sentence — and the engine that executes it — is what we spent these seven phases hardening and broadening.

---

## 3. The seven phases at a glance

Each phase shipped as a single commit, with passing tests, working in both the user UI and the admin Knowledge Graph visualization. The phases are *cumulative*: every later phase added precision on top of the earlier ones.

### Phase 1 — San Juan + metro foundation
Introduced the first per-business-type composites for San Juan and the six original metro municipalities. Established the four drivers (Traffic, Loading, Noise, Environmental) and the `capital` flag for San Juan-specific obligations.
**Effect:** A restaurant in San Juan went from generating 0 municipality-driven documents to 10.

### Phase 2 — All industries × metro
Extended metro composites to every applicable business type across all 20 industries. Office-only industries (Finance, IT, Professional Services) were intentionally left at the universal baseline — the engine correctly does not require a SaaS company to file a Title V air permit.
**Effect:** 18 of 20 industries now have meaningful metro-specific coverage; the 2 omitted are deliberate.

### Phase 3 — Historic + island + metro fill-ins
Added composites for the four historic-district municipalities (San Juan, Ponce, San Germán, Mayagüez) and the two island municipalities (Vieques, Culebra). Three new documents — historic structural review, historic sign variance, ATM ferry manifest — close real regulatory gaps that no PR licensing tool models today. Locked in 10 new engine tests; surfaced a real over-broad rule from phase 1 and removed it.
**Effect:** A hotel in Old San Juan now sees facade preservation + structural review + sign variance + San Juan municipal use permit — the actual ICP/OECH stack.

### Phase 4 — Popular non-metro municipalities
Broadened tourism and coastal flags to F&B, beauty, retail, and tour-services BTs so the seven popular beach towns (Aguadilla, Cabo Rojo, Dorado, Fajardo, Humacao, Isabela, Río Grande) drive real obligations, not just hotel registration. Added the tourism flag to Arecibo (Observatory + karst eco-tourism), and the metro flag to Toa Alta + Trujillo Alto (genuine SJ urban-corridor towns).
**Effect:** A gift shop in Fajardo went from 0 municipality-driven docs to 3; restaurants in Toa Alta gained the full metro baseline.

### Phase 5 — Industrial-port corridor
Introduced the `industrial_port` flag for Ponce, Cataño, Guayanilla, Salinas, and Yabucoa — the actual PR heavy-industry / port corridor. Four new federally-anchored documents: NPDES industrial discharge, RCRA hazardous-waste handler ID, Title V air emission permit, Port Authority docking authorization. All per-BT so a corner grocer in Ponce does not get Title V just because the town is industrial.
**Effect:** A chemical manufacturer in Ponce now sees all three heavy-industry federal docs in addition to the metro baseline.

### Phase 6 — Airport-host municipalities
Introduced the `airport_host` flag for Carolina (LMM/SJU), Aguadilla (BQN cargo hub), and Ponce (Mercedita). Three new documents — CBP Customs Broker Bond, TSA Known Shipper, airport-area concession. Wired exclusively to air-cargo and customs-active business types; restaurants and offices in those towns are correctly unaffected.
**Effect:** A freight forwarder in Carolina now sees CBP bond + TSA known shipper, not just the metro stormwater plan.

### Phase 7 — Patente-rate metadata
Extended the municipality schema with an optional `patente_rate` field — the gross-receipts tax rate that varies by municipio. Populated the seven main metro municipalities at the legal-maximum general rate (0.5% per Ley 113-1995) and left the rest as "not yet captured" rather than invent numbers. The admin Knowledge Graph footer now surfaces the rate, so the framework is ready for SME enrichment without forcing made-up data.
**Effect:** First structural metadata about per-municipality fiscal obligations; opens a path to per-town fee/tax estimates.

---

## 4. How the user experiences this

When a user picks **a municipality** and **a business type** in the intake form, the same single rules engine that's evaluated in our 44 tests runs **inside their browser** and immediately produces their personalized checklist. The user does not see "flags" or "composites" — they see a card-based list of documents, each with its issuing agency, why it's required, and an upload button.

**Worked example — Hotel in San Juan.** The user picks Tourism & Hospitality → Hotel, San Juan as the municipality, and is shown 21 documents with the right agency labels:

- 6 universal baseline docs (Certificate of Incorporation, EIN, Merchant Registration, Patente Municipal, Municipal Registration, Tax Compliance)
- 5 business-type docs (Permiso Único, Zoning, Health Permit, Fire Cert, Tourism Registration)
- 4 metro composites (Stormwater Plan, Waste Contract, Parking Compliance, Traffic Study, Loading Zone Permit)
- 1 San Juan-specific doc (Municipal Use Permit)
- 3 historic-district docs (Facade Preservation, Structural Review, Sign Variance)
- 1 coastal doc (DRNA Environmental Permit)
- 1 capital + tourism crossover doc (extra registration)

**Same engine.** Same logic. Same data model. Switch the town to **Vieques** and the checklist re-renders — losing San Juan and historic obligations, gaining the ATM ferry manifest and the island waste contract. Switch the BT to **Software Company** and the checklist collapses to the 6 universal docs plus the metro infrastructure trio — no traffic study, no facade review, no Title V. The platform is correct by construction.

---

## 5. The "association" surface — admin Knowledge Graph

The same KB powers a second surface for analysts and ourselves: `/admin/knowledge-base`. It is a literal interactive knowledge-graph traversal — Municipality → Industry → Business Type → Questions → Documents — that draws bezier edges between selected nodes. When an analyst selects San Juan + Hotel they see:

- A path edge from "San Juan" (cyan) to each of the documents its flags activate
- A path edge from "Industry" to "Hotel" (indigo)
- A path edge from "Hotel" through the applicable Questions to the triggered Documents
- The same 21-document set that the live user-facing checklist produces, because both surfaces call the same resolver

This is the moat: the **graph is the product**, not a UI gimmick. The audit screen, the user checklist, and the SVG visualization all draw from one source of truth.

---

## 6. Coverage report (current — phase 7)

| Flag | Composite rules | Universal rules | Municipalities |
|---|---|---|---|
| `metro` | 200 | 3 | 9 |
| `capital` | 10 | 1 | 1 (San Juan) |
| `historic` | 28 | 2 | 4 |
| `island` | 12 | 1 | 2 |
| `tourism` | 29 | 0 | 16 |
| `coastal` | 11 | 0 | 43 |
| `industrial_port` | 28 | 0 | 5 |
| `airport_host` | 11 | 0 | 3 |
| **Total municipality_flag rules** | **329** | **7** | — |

**Industry coverage:** 18 of 20 industries have at least one per-business-type metro/capital composite. Finance & Insurance (0/6) and Information Technology (0/7) are intentionally office-only.

**Engine tests:** 44 passing scenarios, including 10 negative controls that explicitly prove the system does *not* over-fire — e.g. "Restaurant in Adjuntas yields no flag-driven docs," "Chemical Mfg in San Juan does not get Title V," "Software Company in San Juan does not get a traffic-impact study."

---

## 7. Why this is hard for competitors to copy

1. **It is regulatory craft, not ML.** Every rule is a hand-authored, sourced statement of an actual obligation under federal / commonwealth / municipal code. There is no model to scrape; the moat is the *correct* set of rules, derived from regulation, tested against negative cases.
2. **Architecturally jurisdiction-agnostic.** Phase 0 already shipped a `JurisdictionPack` abstraction. The 596 PR rules live in a swappable pack. To onboard Florida, Texas, or any state, we author a new pack and select it at build time — the engine, UI, and admin viz are unchanged. This converts each new jurisdiction from an engineering project into a content project.
3. **One source of truth, two surfaces.** The same engine powers the user checklist *and* the admin Knowledge Graph. Any rule we add appears in both. There is no drift.
4. **The graph is data, not code.** Adding a new flag, a new municipality, a new document, or a new composite rule is a JSON edit — no rebuild of the platform. SMEs and partners can author with us once tooling is exposed.

---

## 8. What the next 90 days look like

| Track | What | Why |
|---|---|---|
| **SME audit pass** | Domain expert review of all 596 rules + flag tagging | Validates the substance behind the framework |
| **Patente-rate enrichment** | Populate the remaining 71 municipios with researched rates | Closes the per-municipality fiscal estimate gap |
| **Florida pack** | Author the first non-PR JurisdictionPack | Proves the cross-jurisdiction architecture |
| **Question-trigger refinements** | Tie noise-variance and similar composites to user answers, not just BT | More precise checklists (tattoo shop without amplified sound shouldn't get noise variance) |
| **Authoring UI** | A surface for SMEs to add/edit rules without touching JSON | Scales authoring beyond the engineering team |

---

## 9. The investor takeaway

What you saw the team ship across seven phases is **not feature work** — it is the construction of a **regulatory knowledge asset** that grows on a defined cadence, with tests that lock in correctness, and an architecture that pays compounding dividends as we cover more flags, more business types, and eventually more jurisdictions.

The graph today knows that a hotel in Old San Juan needs an ICP facade plan, a freight forwarder in Carolina needs a CBP bond, and a chemical plant in Ponce needs a Title V permit — and it produces those checklists in milliseconds, for free, with no human in the loop. Every additional rule we author is a permanent asset that ships across every customer.

This is the part that's hard to build, the part that's hard to copy, and the part that makes everything downstream (validation, document intelligence, deliverable generation) more valuable.
