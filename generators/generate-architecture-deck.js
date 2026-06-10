const PptxGenJS = require("pptxgenjs");
const fs = require("fs");

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_16x9";
pptx.author = "SmartPR Design Team";
pptx.title = "SmartPR — Product Architecture & Design";
pptx.subject = "GovTech SaaS — Puerto Rico Business Licensing Readiness";

// Color palette (Teal Trust + Navy)
const colors = {
  navy: "0A2540",
  teal: "0D9488",
  lightTeal: "CCFBF1",
  white: "FFFFFF",
  slate: "334155",
  lightSlate: "F1F5F9",
  amber: "B45309",
  red: "B91C1C",
  green: "15803D"
};

// Helper for consistent slide styling
function addSlideFooter(slide, pageNum) {
  slide.addText("SmartPR Design v1.0 | Readiness Assessment Only — Not Government Approval", {
    x: 0.5, y: 7.1, w: 9, h: 0.3,
    fontSize: 9, color: "64748B", fontFace: "Arial"
  });
}

// Slide 1: Title
let slide = pptx.addSlide();
slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 7.5, fill: { color: colors.navy } });
slide.addText("SmartPR", { x: 0.5, y: 1.8, w: 9, h: 1, fontSize: 54, bold: true, color: colors.white, fontFace: "Arial" });
slide.addText("Puerto Rico Business Licensing Readiness Platform", { x: 0.5, y: 2.8, w: 9, h: 0.6, fontSize: 22, color: colors.lightTeal, fontFace: "Arial" });
slide.addText("AI-Powered • TurboTax-Style Checklist • Database-Driven Rules • Bilingual (EN/ES)", { x: 0.5, y: 3.6, w: 9, h: 0.5, fontSize: 14, color: colors.white, fontFace: "Arial" });
slide.addText("Product Architecture & Design Specification v1.0", { x: 0.5, y: 5.2, w: 9, h: 0.4, fontSize: 16, color: colors.white, fontFace: "Arial" });
slide.addText("Readiness Assessment Only — Never Approves or Grants Licenses", { x: 0.5, y: 5.8, w: 9, h: 0.4, fontSize: 12, color: "FCA5A5", fontFace: "Arial", bold: true });

// Slide 2: Vision & Scope
slide = pptx.addSlide();
slide.addText("Product Vision & Scope", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 28, bold: true, color: colors.navy, fontFace: "Arial" });
slide.addText("Business owners cannot easily determine required licenses, agencies, documents, or why applications are rejected. SmartPR acts as an AI-powered readiness assistant that guides step-by-step and validates before submission.", { x: 0.5, y: 1.0, w: 9, h: 1.0, fontSize: 13, color: colors.slate, fontFace: "Arial" });

slide.addText("MVP Objective", { x: 0.5, y: 2.1, w: 4, h: 0.4, fontSize: 16, bold: true, color: colors.teal, fontFace: "Arial" });
slide.addText("Determine exactly what is required and whether the applicant is ready to submit to government agencies.", { x: 0.5, y: 2.5, w: 4.3, h: 0.8, fontSize: 12, color: colors.slate, fontFace: "Arial" });

slide.addText("Non-Goals (MVP)", { x: 5.2, y: 2.1, w: 4.3, h: 0.4, fontSize: 16, bold: true, color: colors.red, fontFace: "Arial" });
slide.addText("• No government submission or e-filing\n• No \"approved\", \"granted\", or \"license issued\" language\n• No predictive approval or legal advice", { x: 5.2, y: 2.5, w: 4.3, h: 1.2, fontSize: 12, color: colors.slate, fontFace: "Arial" });

slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 4.0, w: 9, h: 2.8, fill: { color: colors.lightSlate }, rectRadius: 0.1 });
slide.addText("10 Deliverables Produced", { x: 0.7, y: 4.15, w: 8.6, h: 0.35, fontSize: 14, bold: true, color: colors.navy, fontFace: "Arial" });
slide.addText("1. Application Architecture   2. User Flows & Diagrams   3. Database Schema\n4. Licensing Rules Engine   5. Document + AI Validation   6. API Architecture\n7. UI/UX Wireframes & Design System   8. Future Integration Strategy\n9. MVP Implementation Roadmap   10. Polished DOCX + PPTX + Seeds + Diagrams", { x: 0.7, y: 4.55, w: 8.6, h: 2.0, fontSize: 12, color: colors.slate, fontFace: "Arial" });

addSlideFooter(slide);

// Slide 3: High-Level Architecture
slide = pptx.addSlide();
slide.addText("Application Architecture", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 26, bold: true, color: colors.navy, fontFace: "Arial" });

const layers = [
  { label: "Frontend", desc: "Next.js + TS + Tailwind + shadcn/ui\nBilingual (next-intl) • WCAG AA • Mobile-first", y: 1.0, color: "DBEAFE" },
  { label: "Backend", desc: "FastAPI (Python)\nRequirements • Validation • AI Orchestration • PDF Gen", y: 2.4, color: "D1FAE5" },
  { label: "Data & AI", desc: "Supabase PG (RLS, audit) + Storage (signed URLs)\nOpenRouter (Claude / GPT / Gemini — configurable)", y: 3.8, color: "FEF3C7" },
  { label: "Future", desc: "Adapter layer for SBP • OGPe • Hacienda SURI • Municipal • Salud • Bomberos", y: 5.2, color: "FCE7F3" }
];

layers.forEach((l, i) => {
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: l.y, w: 9, h: 1.2, fill: { color: l.color }, rectRadius: 0.08 });
  slide.addText(l.label, { x: 0.7, y: l.y + 0.1, w: 2, h: 0.4, fontSize: 14, bold: true, color: colors.navy, fontFace: "Arial" });
  slide.addText(l.desc, { x: 0.7, y: l.y + 0.5, w: 8.6, h: 0.6, fontSize: 11, color: colors.slate, fontFace: "Arial" });
});

addSlideFooter(slide);

// Slide 4: User Flow Overview
slide = pptx.addSlide();
slide.addText("User Flow — 9 Steps (Readiness Only)", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: colors.navy, fontFace: "Arial" });

const steps = [
  "1. Discovery — Dynamic questions (industry → follow-ups)",
  "2. Requirements Engine — DB rules → required items",
  "3. Checklist — TurboTax progress + critical path",
  "4. Upload — PDF/DOCX/Images to private storage",
  "5. AI Extract — Structured fields + confidence",
  "6. Validate — Completeness • Consistency • Expiration • Rules",
  "7. Score — 0-100 Readiness (never approval)",
  "8. Findings — Critical / Warning / Info with evidence",
  "9. Package — Professional bilingual PDF + manifest"
];

steps.forEach((s, i) => {
  const y = 1.0 + (i * 0.58);
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: y, w: 9, h: 0.52, fill: { color: i % 2 === 0 ? colors.lightSlate : "FFFFFF" }, rectRadius: 0.05 });
  slide.addText(s, { x: 0.7, y: y + 0.08, w: 8.6, h: 0.4, fontSize: 12, color: colors.slate, fontFace: "Arial" });
});

addSlideFooter(slide);

// Slide 5: Database Schema
slide = pptx.addSlide();
slide.addText("Database Schema (Supabase PostgreSQL)", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: colors.navy, fontFace: "Arial" });

slide.addText("Core Tables", { x: 0.5, y: 0.9, w: 4, h: 0.35, fontSize: 14, bold: true, color: colors.teal, fontFace: "Arial" });
slide.addText("• businesses + discovery_answers (JSONB)\n• agencies (bilingual, portal URLs)\n• requirements (catalog, issuing agency)\n• rule_sets (versioned) + requirement_rules (conditions JSONB)\n• requirement_dependencies", { x: 0.5, y: 1.25, w: 4.3, h: 1.8, fontSize: 11, color: colors.slate, fontFace: "Arial" });

slide.addText("Documents & Validation", { x: 5.2, y: 0.9, w: 4.3, h: 0.35, fontSize: 14, bold: true, color: colors.teal, fontFace: "Arial" });
slide.addText("• documents (storage_path, sha256, status)\n• document_extractions (model, prompt_version, JSONB)\n• validation_runs + findings (severity, evidence)\n• submission_packages + package_documents\n• audit_logs + validation_audits (immutable)", { x: 5.2, y: 1.25, w: 4.3, h: 1.8, fontSize: 11, color: colors.slate, fontFace: "Arial" });

slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 3.3, w: 9, h: 1.6, fill: { color: "FEF3C7" }, rectRadius: 0.08 });
slide.addText("Critical Design Points", { x: 0.7, y: 3.45, w: 8.6, h: 0.3, fontSize: 13, bold: true, color: colors.navy, fontFace: "Arial" });
slide.addText("• RLS enforced on all user tables (owner_id matches auth.uid())\n• GIN indexes on JSONB for fast rule evaluation & extraction queries\n• business_requirements materializes rule results with rule_set_version for reproducibility\n• All AI decisions logged with model + prompt_version + input_hash + evidence", { x: 0.7, y: 3.8, w: 8.6, h: 1.0, fontSize: 11, color: colors.slate, fontFace: "Arial" });

slide.addText("Full DDL: design/db/smartpr-database-schema.sql", { x: 0.5, y: 5.1, w: 9, h: 0.3, fontSize: 11, italic: true, color: "64748B", fontFace: "Arial" });

addSlideFooter(slide);

// Slide 6: Rules Engine
slide = pptx.addSlide();
slide.addText("Licensing Rules Engine — DB-Driven", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: colors.navy, fontFace: "Arial" });

slide.addText("No prompt logic. No hardcoded if/else. All requirements come from versioned rule_sets evaluated against merged business profile.", { x: 0.5, y: 0.85, w: 9, h: 0.5, fontSize: 12, color: colors.slate, fontFace: "Arial" });

slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 1.5, w: 4.3, h: 2.8, fill: { color: colors.lightSlate }, rectRadius: 0.08 });
slide.addText("Evaluation Flow", { x: 0.7, y: 1.6, w: 4, h: 0.3, fontSize: 13, bold: true, color: colors.navy, fontFace: "Arial" });
slide.addText("1. Merge profile (base + answers JSONB)\n2. Load active rule_sets (core + industry + muni override)\n3. For each rule: evaluate conditions JSONB\n4. Collect/override by priority\n5. Apply dependency graph\n6. Materialize to business_requirements + snapshot version", { x: 0.7, y: 1.95, w: 4, h: 2.2, fontSize: 11, color: colors.slate, fontFace: "Arial" });

slide.addShape(pptx.ShapeType.roundRect, { x: 5.2, y: 1.5, w: 4.3, h: 2.8, fill: { color: "CCFBF1" }, rectRadius: 0.08 });
slide.addText("Condition Example (JSONB)", { x: 5.4, y: 1.6, w: 4, h: 0.3, fontSize: 13, bold: true, color: colors.navy, fontFace: "Arial" });
slide.addText("{\n  \"has_food_service\": true,\n  \"municipality\": { \"$in\": [\"San Juan\"] },\n  \"$or\": [ {\"industry\": \"restaurant\"}, {\"alcohol_sales\": true} ]\n}", { x: 5.4, y: 1.95, w: 4, h: 2.2, fontSize: 10, color: colors.slate, fontFace: "Consolas" });

slide.addText("Seed example: design/rules/seeds/example-restaurant-v1.json (bilingual labels, citations, dependencies)", { x: 0.5, y: 4.5, w: 9, h: 0.4, fontSize: 11, italic: true, color: "64748B", fontFace: "Arial" });

addSlideFooter(slide);

// Slide 7: AI Validation Workflow
slide = pptx.addSlide();
slide.addText("Document Ingestion & AI Validation", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: colors.navy, fontFace: "Arial" });

const aiSteps = [
  { title: "Upload", desc: "Private Supabase Storage + metadata + sha256" },
  { title: "Extract", desc: "OpenRouter → structured Pydantic output (name, dates, IDs, addresses)" },
  { title: "Normalize", desc: "Canonical fields stored in document_extractions JSONB" },
  { title: "Validate", desc: "4 passes: Completeness • Consistency • Expiration • Business Rules" },
  { title: "Findings", desc: "Evidence-linked, bilingual, actionable, agency-mapped" },
  { title: "Audit", desc: "Full trace: model, prompt_version, input_hash, output, duration" }
];

aiSteps.forEach((s, i) => {
  const col = i < 3 ? 0.5 : 5.2;
  const row = i % 3;
  const y = 1.0 + (row * 1.5);
  slide.addShape(pptx.ShapeType.roundRect, { x: col, y: y, w: 4.3, h: 1.3, fill: { color: colors.lightSlate }, rectRadius: 0.08 });
  slide.addText(s.title, { x: col + 0.15, y: y + 0.1, w: 4, h: 0.35, fontSize: 14, bold: true, color: colors.teal, fontFace: "Arial" });
  slide.addText(s.desc, { x: col + 0.15, y: y + 0.5, w: 4, h: 0.7, fontSize: 11, color: colors.slate, fontFace: "Arial" });
});

addSlideFooter(slide);

// Slide 8: API Architecture
slide = pptx.addSlide();
slide.addText("API Architecture (FastAPI / v1)", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: colors.navy, fontFace: "Arial" });

slide.addText("Key Groups", { x: 0.5, y: 0.9, w: 9, h: 0.35, fontSize: 14, bold: true, color: colors.teal, fontFace: "Arial" });
slide.addText("/businesses • /discovery • /requirements • /documents (signed upload) • /validations (async) • /findings • /packages (PDF + JSON)\n\nAuth: Supabase JWT + RLS. Async jobs return 202 + job_id. Typed Pydantic contracts. OpenAPI generated.", { x: 0.5, y: 1.25, w: 9, h: 1.2, fontSize: 12, color: colors.slate, fontFace: "Arial" });

slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 2.7, w: 9, h: 2.0, fill: { color: "FEF3C7" }, rectRadius: 0.08 });
slide.addText("Integration-Ready Design", { x: 0.7, y: 2.85, w: 8.6, h: 0.3, fontSize: 13, bold: true, color: colors.navy, fontFace: "Arial" });
slide.addText("• Stable requirement codes + bilingual agency catalog\n• Submission package includes machine-readable manifest (hashes, mappings)\n• Adapter pattern prepared for SBP/OGPe/Hacienda/Municipal (post-MVP)\n• Versioned rule snapshots travel with every package for auditability", { x: 0.7, y: 3.2, w: 8.6, h: 1.3, fontSize: 11, color: colors.slate, fontFace: "Arial" });

addSlideFooter(slide);

// Slide 9: UI/UX & Design System
slide = pptx.addSlide();
slide.addText("UI/UX — TurboTax + Government Portal", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: colors.navy, fontFace: "Arial" });

slide.addText("Principles: Low clutter • Trustworthy • Bilingual (EN/ES toggle always visible) • WCAG 2.2 AA • Mobile-first (48px taps)", { x: 0.5, y: 0.85, w: 9, h: 0.4, fontSize: 12, color: colors.slate, fontFace: "Arial" });

const uxPoints = [
  "Palette: Navy #0A2540 (trust) + Teal #0D9488 (progress) + semantic red/amber/green",
  "Stepper + Progress ring + % complete + \"X of Y critical items\"",
  "Checklist grouped by Agency or Category; \"Why?\" opens citation + plain explanation",
  "Upload → immediate extraction preview + user correction + link to requirement",
  "Findings: severity-colored cards with evidence snippet + recommended action + agency",
  "Package: Professional PDF (cover, summary, items, findings, index, large disclaimers)"
];

uxPoints.forEach((p, i) => {
  slide.addText("• " + p, { x: 0.5, y: 1.4 + (i * 0.55), w: 9, h: 0.5, fontSize: 11, color: colors.slate, fontFace: "Arial" });
});

slide.addText("Wireframe specs + interaction states: design/ux/UI-UX-Design-and-Wireframes.md", { x: 0.5, y: 4.9, w: 9, h: 0.35, fontSize: 11, italic: true, color: "64748B", fontFace: "Arial" });

addSlideFooter(slide);

// Slide 10: Future Integration
slide = pptx.addSlide();
slide.addText("Future Integration Strategy", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: colors.navy, fontFace: "Arial" });

const intLayers = [
  { layer: "Layer 0 (MVP)", items: "Stable package schema + JSON manifest + requirement codes + hashes" },
  { layer: "Layer 1", items: "Read-only verification (professional licenses, merchant status, CRIM)" },
  { layer: "Layer 2", items: "Pre-validate / dry-run endpoints → translate agency errors into findings" },
  { layer: "Layer 3", items: "Authenticated submission (scoped consent + audit) — SBP/OGPe first" },
  { layer: "Layer 4", items: "Status polling/webhooks + renewal reminders" }
];

intLayers.forEach((l, i) => {
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 1.0 + (i * 0.95), w: 9, h: 0.85, fill: { color: i === 0 ? "D1FAE5" : colors.lightSlate }, rectRadius: 0.06 });
  slide.addText(l.layer, { x: 0.7, y: 1.1 + (i * 0.95), w: 2.5, h: 0.3, fontSize: 12, bold: true, color: colors.navy, fontFace: "Arial" });
  slide.addText(l.items, { x: 3.3, y: 1.1 + (i * 0.95), w: 6, h: 0.65, fontSize: 11, color: colors.slate, fontFace: "Arial" });
});

slide.addText("Targets: SBP (DDEC), OGPe, Hacienda SURI, 78 Municipalities (start top 5-7), Salud, Bomberos, Dept of State Boards.", { x: 0.5, y: 5.9, w: 9, h: 0.35, fontSize: 11, italic: true, color: "64748B", fontFace: "Arial" });

addSlideFooter(slide);

// Slide 11: Roadmap
slide = pptx.addSlide();
slide.addText("MVP Implementation Roadmap", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: colors.navy, fontFace: "Arial" });

const phases = [
  { phase: "P0 (1 wk)", items: "Repo, Supabase, CI, i18n, language policy, initial seeds" },
  { phase: "P1 (2-3 wks)", items: "Dynamic wizard + rules engine + seeded requirements + checklist" },
  { phase: "P2 (3 wks)", items: "Upload + OpenRouter extraction + review UI + basic validation" },
  { phase: "P3 (2 wks)", items: "Full 4-axis validation + findings + readiness score + iteration" },
  { phase: "P4 (2 wks)", items: "Professional PDF package + dashboard + a11y + polish" },
  { phase: "P5 (1-2 wks)", items: "E2E tests, security, bilingual QA, compliance review, launch" }
];

phases.forEach((p, i) => {
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 0.95 + (i * 0.85), w: 9, h: 0.75, fill: { color: colors.lightSlate }, rectRadius: 0.06 });
  slide.addText(p.phase, { x: 0.7, y: 1.05 + (i * 0.85), w: 2, h: 0.55, fontSize: 12, bold: true, color: colors.teal, fontFace: "Arial" });
  slide.addText(p.items, { x: 2.8, y: 1.05 + (i * 0.85), w: 6.5, h: 0.55, fontSize: 11, color: colors.slate, fontFace: "Arial" });
});

slide.addText("Target: 10-14 weeks for defensible, production-intent MVP with 5+ industries + major municipalities covered.", { x: 0.5, y: 6.2, w: 9, h: 0.35, fontSize: 11, italic: true, color: "64748B", fontFace: "Arial" });

addSlideFooter(slide);

// Slide 12: Key Risks & Mitigations
slide = pptx.addSlide();
slide.addText("Key Risks & Mitigations", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: colors.navy, fontFace: "Arial" });

const risks = [
  { risk: "Stale / changing regulations", mit: "Versioned rule_sets with effective dates + impact reports + user notifications on activation" },
  { risk: "AI extraction quality on real PR docs", mit: "Structured output + confidence thresholds + user correction + full audit + manual fallback" },
  { risk: "78 municipalities + variance", mit: "Prioritize high-volume first; explicit \"verify with local planning\" informational findings; easy overrides" },
  { risk: "Scope creep on validation", mit: "Ruthless MVP definition: only what is required for defensible readiness score + professional package" }
];

risks.forEach((r, i) => {
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 1.0 + (i * 1.35), w: 9, h: 1.2, fill: { color: i % 2 === 0 ? "FEE2E2" : "FEF3C7" }, rectRadius: 0.08 });
  slide.addText("Risk: " + r.risk, { x: 0.7, y: 1.1 + (i * 1.35), w: 8.6, h: 0.35, fontSize: 12, bold: true, color: colors.red, fontFace: "Arial" });
  slide.addText("Mitigation: " + r.mit, { x: 0.7, y: 1.5 + (i * 1.35), w: 8.6, h: 0.6, fontSize: 11, color: colors.slate, fontFace: "Arial" });
});

addSlideFooter(slide);

// Slide 13: Language Policy (Critical)
slide = pptx.addSlide();
slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 7.5, fill: { color: colors.navy } });
slide.addText("Strict Language Policy", { x: 0.5, y: 1.5, w: 9, h: 0.7, fontSize: 32, bold: true, color: colors.white, fontFace: "Arial" });
slide.addText("SmartPR provides READINESS ASSESSMENT only.\nIt does NOT approve, grant, issue, or clear any license, permit, or certification.\n\nAll approvals are made exclusively by the Government of Puerto Rico and its agencies.", { x: 0.5, y: 2.5, w: 9, h: 2.0, fontSize: 16, color: colors.white, fontFace: "Arial" });
slide.addText("Disallowed terms (enforced in UI, PDFs, logs, tests):\n\"approved\", \"granted\", \"license issued\", \"compliant\", \"cleared\", \"authorized to operate\"", { x: 0.5, y: 4.8, w: 9, h: 1.2, fontSize: 13, color: "FCA5A5", fontFace: "Arial" });
slide.addText("This policy is non-negotiable for legal, trust, and scope reasons.", { x: 0.5, y: 6.2, w: 9, h: 0.4, fontSize: 12, color: colors.lightTeal, fontFace: "Arial", bold: true });

// Slide 14: Next Steps
slide = pptx.addSlide();
slide.addText("Next Steps", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 26, bold: true, color: colors.navy, fontFace: "Arial" });

slide.addText("1. Stakeholder review & sign-off on this design package (architecture, rules approach, language policy, roadmap).", { x: 0.5, y: 1.0, w: 9, h: 0.5, fontSize: 13, color: colors.slate, fontFace: "Arial" });
slide.addText("2. Approve seed data scope (initial industries + municipalities) and compliance review process.", { x: 0.5, y: 1.6, w: 9, h: 0.5, fontSize: 13, color: colors.slate, fontFace: "Arial" });
slide.addText("3. Execute Phase 0 setup (repo, Supabase, CI, i18n foundation).", { x: 0.5, y: 2.2, w: 9, h: 0.5, fontSize: 13, color: colors.slate, fontFace: "Arial" });
slide.addText("4. Begin Phase 1: Wizard + Rules Engine + seeded checklist (fastest path to visible value).", { x: 0.5, y: 2.8, w: 9, h: 0.5, fontSize: 13, color: colors.slate, fontFace: "Arial" });

slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 3.6, w: 9, h: 2.2, fill: { color: colors.lightTeal }, rectRadius: 0.1 });
slide.addText("Key Artifacts in This Package", { x: 0.7, y: 3.75, w: 8.6, h: 0.35, fontSize: 14, bold: true, color: colors.navy, fontFace: "Arial" });
slide.addText("• README.md — Overview & principles\n• design/architecture/*.md — Full layered architecture + security\n• design/db/smartpr-database-schema.sql — Complete DDL + RLS notes\n• design/rules/*.md + seeds/*.json — Rules engine + example restaurant seed\n• design/flows/*.md — Mermaid diagrams + step details\n• design/api/*.md — Contracts + integration-ready design\n• design/ux/*.md — Wireframes + component specs + a11y\n• design/integration/*.md — Layered future strategy\n• design/roadmap/*.md — Phased 10-14 week plan\n• docs/ (generated) — SmartPR-Product-Design-Spec.docx + Architecture Deck.pptx", { x: 0.7, y: 4.15, w: 8.6, h: 1.5, fontSize: 11, color: colors.slate, fontFace: "Arial" });

addSlideFooter(slide);

// Slide 15: Closing
slide = pptx.addSlide();
slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 7.5, fill: { color: colors.navy } });
slide.addText("SmartPR", { x: 0.5, y: 2.2, w: 9, h: 0.8, fontSize: 42, bold: true, color: colors.white, fontFace: "Arial" });
slide.addText("Ready to submit. Never claims to approve.", { x: 0.5, y: 3.1, w: 9, h: 0.6, fontSize: 20, color: colors.lightTeal, fontFace: "Arial" });
slide.addText("Design v1.0 — All rights reserved", { x: 0.5, y: 5.5, w: 9, h: 0.4, fontSize: 12, color: "94A3B8", fontFace: "Arial" });

pptx.writeFile({ fileName: "/Users/dariusferdows/SmartPR/docs/SmartPR-Architecture-Design-Deck.pptx" })
  .then(() => console.log("Generated SmartPR-Architecture-Design-Deck.pptx"))
  .catch(err => console.error("PPTX generation error:", err));
