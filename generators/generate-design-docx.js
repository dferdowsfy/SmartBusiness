const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType, 
        ShadingType, PageNumber, PageBreak, LevelFormat } = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "0A2540" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "0D9488" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "334155" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        children: [new TextRun({ text: "SmartPR — Puerto Rico Business Licensing Readiness Platform | Product Design v1.0", size: 18, color: "64748B" })]
      })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "CONFIDENTIAL — Design Document | Page ", size: 18, color: "64748B" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "64748B" }),
          new TextRun({ text: " | Readiness Assessment Only — Not Government Approval", size: 18, color: "64748B" })
        ]
      })] })
    },
    children: [
      // Title
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("SmartPR Product Design Specification")] }),
      new Paragraph({ children: [new TextRun({ text: "AI-Powered Puerto Rico Business Licensing Readiness Platform", italics: true, size: 24 })] }),
      new Paragraph({ children: [new TextRun({ text: "Version 1.0 — Design Phase | Do not implement without approved roadmap", color: "B91C1C" })] }),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Executive Summary")] }),
      new Paragraph({ children: [new TextRun("SmartPR is a TurboTax-style readiness assessment platform for businesses operating (or planning to operate) in Puerto Rico. It guides users through discovery of required licenses, permits, certifications, and supporting documents across multiple agencies (SBP, OGPe, Hacienda, Salud, Bomberos, Municipalities, Examining Boards). It validates uploaded documentation for completeness, consistency, expiration, and business rules, then produces a professional submission package.")] }),
      new Paragraph({ children: [new TextRun({ text: "CRITICAL: SmartPR determines READINESS ONLY. It never approves licenses or states that a license will be or has been granted. All approvals rest exclusively with the Government of Puerto Rico and its agencies.", bold: true })] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Product Vision & Scope")] }),
      new Paragraph({ children: [new TextRun("Business owners struggle with opacity across agencies. SmartPR replaces guesswork with a guided, validated checklist experience. MVP delivers end-to-end readiness from discovery through downloadable government-style PDF package.")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("In scope: Dynamic discovery, db-driven rules engine, secure upload + AI extraction, multi-axis validation, findings, readiness scoring, professional package.")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Out of scope (MVP): Actual government submission, predictive approval, legal advice, e-filing.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("10 Core Deliverables (This Package)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Complete Application Architecture (layers, AI, security, data flow)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("User Flow Diagrams (Mermaid + sequence)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Database Schema (Supabase PostgreSQL, RLS, audit)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Licensing Rules Engine Design (declarative, versioned, bilingual)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Document Ingestion + AI Validation Workflow")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("API Architecture (FastAPI contracts, versioning)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("UI/UX Wireframes & Design System (bilingual, accessible, TurboTax + Gov tone)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Future Integration Strategy (SBP, OGPe, Municipal, etc.)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("MVP Implementation Roadmap (phased, 10-14 weeks)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun("Polished artifacts: This DOCX + Architecture PPTX + diagrams + seeds")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Technical Architecture Summary")] }),
      new Paragraph({ children: [new TextRun("Frontend: Next.js + TypeScript + Tailwind + shadcn/ui (bilingual via next-intl, WCAG AA).")] }),
      new Paragraph({ children: [new TextRun("Backend: FastAPI (Python) — requirements engine, document orchestration, AI gateway, validation, PDF generation.")] }),
      new Paragraph({ children: [new TextRun("Data: Supabase (PostgreSQL + Auth + Storage). RLS enforced. Private buckets with signed URLs.")] }),
      new Paragraph({ children: [new TextRun("AI: OpenRouter (configurable: Claude 3.5 Sonnet/Opus, GPT-4o, Gemini). Structured outputs + prompt versioning + audit.")] }),
      new Paragraph({ children: [new TextRun("Key principle: All licensing logic is database-driven (rule_sets + requirement_rules + conditions JSONB). No hard-coded if/else or prompt-only rules.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Key Design Constraints & Policies")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Readiness-only language: ", bold: true }), new TextRun("Never \"approved\", \"granted\", \"license issued\", \"compliant\". Enforced in UI strings, PDFs, logs, and tests.")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Audit everything: ", bold: true }), new TextRun("validation_audits table records model, prompt_version, input_hash, output, evidence for every AI-assisted decision.")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Bilingual first: ", bold: true }), new TextRun("All user-facing content, agency names, findings, and package text stored and rendered in EN + ES.")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Privacy & minimization: ", bold: true }), new TextRun("Extract structured fields; minimize retention of raw PII. User-controlled purge + export.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Rules Engine (Core Differentiator)")] }),
      new Paragraph({ children: [new TextRun("Requirements are derived from versioned rule_sets evaluated against a merged business profile (base fields + discovery_answers JSONB). Conditions are declarative JSONB supporting equality, $in, numeric ranges, $or, etc. Evaluation is deterministic and auditable. New regulatory changes are introduced as new rule_set versions with effective dates; historical evaluations remain reproducible.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Validation Axes")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Completeness: ", bold: true }), new TextRun("Mandatory requirements without a passing linked document → Critical.")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Consistency: ", bold: true }), new TextRun("Cross-document entity name, address, EIN, owner mismatches flagged (fuzzy + exact).")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Expiration: ", bold: true }), new TextRun("Docs expiring <30/60 days → Warning; expired → Critical.")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Business Rules: ", bold: true }), new TextRun("Domain logic (restaurant requires health + fire; alcohol triggers additional; home-based restrictions).")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Readiness Score & Status")] }),
      new Paragraph({ children: [new TextRun("Weighted composite (0-100). Example: Critical findings heavily penalize; missing mandatory items weighted; consistency/expiration lighter. Status bands: 90-100 \"Ready for Submission — Strong\"; 75-89 \"Mostly Ready\"; 60-74 \"Needs Work\"; <60 \"Not Ready\". Never implies government outcome.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Submission Package")] }),
      new Paragraph({ children: [new TextRun("Professional PDF generated server-side. Contains: business summary, required items by agency with status, document index (with hashes), readiness score + timestamp, full categorized findings with evidence + recommended actions + agency, disclaimers. Machine-readable JSON manifest also produced for future API handoff.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Future Integration Readiness")] }),
      new Paragraph({ children: [new TextRun("Package + manifest designed to map 1:1 to SBP/OGPe/Municipal payloads. Adapter pattern + mapping tables + consent/audit layer prepared. MVP stops at downloadable package. Post-MVP adds read-only verification, pre-validate, then authenticated submission.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("MVP Roadmap (High-Level)")] }),
      new Paragraph({ children: [new TextRun("Phase 0 (1 wk): Repo, Supabase, CI, i18n, language policy.")] }),
      new Paragraph({ children: [new TextRun("Phase 1 (2-3 wks): Dynamic wizard + rules engine + seed data + checklist.")] }),
      new Paragraph({ children: [new TextRun("Phase 2 (3 wks): Upload + OpenRouter extraction + review + basic validation.")] }),
      new Paragraph({ children: [new TextRun("Phase 3 (2 wks): Full validation engine + findings + score.")] }),
      new Paragraph({ children: [new TextRun("Phase 4 (2 wks): Professional PDF package + dashboard + polish + a11y.")] }),
      new Paragraph({ children: [new TextRun("Phase 5 (1-2 wks): E2E tests, security, bilingual QA, compliance review, staged launch.")] }),
      new Paragraph({ children: [new TextRun("Target: 10-14 weeks for defensible, production-intent MVP.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Risks & Mitigations")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Stale rules: ", bold: true }), new TextRun("Versioned rule_sets + impact analysis + notification on activation.")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "AI extraction errors: ", bold: true }), new TextRun("Structured output + confidence + user correction + audit + fallback manual.")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Municipality variance: ", bold: true }), new TextRun("Prioritize high-volume first; explicit \"verify locally\" findings.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Disclaimers (Must Appear)")] }),
      new Paragraph({ children: [new TextRun({ text: "SmartPR provides readiness assessment and validation services only. It does not approve, grant, or issue any license, permit, certification, or authorization. All final determinations and approvals are made exclusively by the Government of Puerto Rico and its agencies (SBP, OGPe, Hacienda, Departamento de Salud, Cuerpo de Bomberos, municipal governments, Department of State Examining Boards, and others). Users should consult qualified legal, accounting, and compliance professionals. This document and any generated package are snapshots for informational and preparation purposes.", italics: true })] }),

      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Appendix: Key Schema Highlights")] }),
      new Paragraph({ children: [new TextRun("See design/db/smartpr-database-schema.sql for full DDL. Core tables: businesses, discovery_answers, agencies, requirements, rule_sets, requirement_rules (conditions JSONB), documents, document_extractions, validation_runs, findings, submission_packages, audit_logs, validation_audits.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Appendix: Example Rule Seed")] }),
      new Paragraph({ children: [new TextRun("See design/rules/seeds/example-restaurant-v1.json. Demonstrates versioned rule_set with conditions for food_service, dependencies (Permiso Único before Patente), and bilingual labels.")] }),

      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({ children: [new TextRun({ text: "— End of Design Specification —", italics: true, color: "64748B" })] }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/Users/dariusferdows/SmartPR/docs/SmartPR-Product-Design-Spec.docx", buffer);
  console.log("Generated SmartPR-Product-Design-Spec.docx");
});
