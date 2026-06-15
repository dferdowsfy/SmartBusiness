/**
 * Generates a presentation-quality investor briefing DOCX for SmartPR.
 * Open in Google Docs / Word and export as PDF in one click.
 * Usage: node scripts/generate-investor-pdf.mjs
 * Output: design/SmartPR-Investor-Briefing.docx
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  PageBreak,
  TableLayoutType,
  UnderlineType,
  convertInchesToTwip,
} from "docx";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── Brand colours ─────────────────────────────────────────────────────────
const NAVY  = "0A2540";
const TEAL  = "0D9488";
const WHITE = "FFFFFF";
const SLATE = "64748B";
const LIGHT = "F1F5F9";

// ─── Text helpers ─────────────────────────────────────────────────────────
const run = (text, opts = {}) =>
  new TextRun({ text, font: "Calibri", size: (opts.size || 10) * 2, ...opts });

const heading1 = (text) =>
  new Paragraph({
    children: [
      new TextRun({ text, bold: true, size: 32, color: NAVY, font: "Calibri" }),
    ],
    spacing: { before: 240, after: 120 },
  });

const heading2 = (text) =>
  new Paragraph({
    children: [
      new TextRun({ text, bold: true, size: 24, color: TEAL, font: "Calibri" }),
    ],
    spacing: { before: 200, after: 80 },
  });

const heading3 = (text) =>
  new Paragraph({
    children: [
      new TextRun({ text, bold: true, size: 20, color: NAVY, font: "Calibri" }),
    ],
    spacing: { before: 160, after: 60 },
  });

const body = (text, opts = {}) =>
  new Paragraph({
    children: [run(text, { size: 10, color: SLATE, ...opts })],
    spacing: { before: 60, after: 60 },
    alignment: AlignmentType.JUSTIFIED,
  });

const bodyNavy = (text) =>
  new Paragraph({
    children: [run(text, { size: 10, color: NAVY })],
    spacing: { before: 60, after: 60 },
    alignment: AlignmentType.JUSTIFIED,
  });

const bullet = (text) =>
  new Paragraph({
    children: [run(text, { size: 9.5, color: SLATE })],
    bullet: { level: 0 },
    spacing: { before: 40, after: 40 },
  });

const space = (pts = 120) =>
  new Paragraph({ spacing: { before: pts, after: 0 } });

const hr = () =>
  new Paragraph({
    border: { bottom: { color: TEAL, space: 1, style: BorderStyle.SINGLE, size: 6 } },
    spacing: { before: 120, after: 120 },
  });

// ─── Table helpers ─────────────────────────────────────────────────────────
const cell = (text, opts = {}) =>
  new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: opts.bold || false,
            color: opts.color || NAVY,
            size: (opts.size || 9) * 2,
            font: "Calibri",
          }),
        ],
        alignment: opts.align || AlignmentType.LEFT,
      }),
    ],
    shading: opts.bg
      ? { type: ShadingType.CLEAR, fill: opts.bg }
      : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    verticalAlign: "center",
  });

const headerRow = (cols) =>
  new TableRow({
    children: cols.map((c) => cell(c, { bold: true, color: WHITE, bg: NAVY })),
    tableHeader: true,
  });

const dataRow = (cols, shade = false) =>
  new TableRow({
    children: cols.map((c, i) =>
      cell(c, { bold: i === 0, bg: shade ? LIGHT : WHITE })
    ),
  });

const buildTable = (headers, rows, widths) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      headerRow(headers),
      ...rows.map((r, i) => dataRow(r, i % 2 === 0)),
    ],
    columnWidths: widths.map((w) => convertInchesToTwip(w)),
  });

// ─── Page break ────────────────────────────────────────────────────────────
const pageBreak = () =>
  new Paragraph({ children: [new PageBreak()] });

// ─── Phase card (styled paragraph block) ───────────────────────────────────
const phaseCard = (num, title, effect) => [
  new Paragraph({
    children: [
      new TextRun({ text: `Phase ${num}  `, bold: true, color: WHITE, size: 18, font: "Calibri" }),
      new TextRun({ text: title, bold: true, color: WHITE, size: 20, font: "Calibri" }),
    ],
    shading: { type: ShadingType.CLEAR, fill: TEAL },
    spacing: { before: 80, after: 0 },
    indent: { left: convertInchesToTwip(0.15) },
  }),
  new Paragraph({
    children: [run(effect, { size: 9.5, color: SLATE })],
    shading: { type: ShadingType.CLEAR, fill: LIGHT },
    spacing: { before: 0, after: 80 },
    indent: { left: convertInchesToTwip(0.15) },
  }),
];

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT
// ═══════════════════════════════════════════════════════════════════════════
const doc = new Document({
  creator: "SmartPR",
  title: "SmartPR Investor Briefing — Municipality Coverage",
  description: "Phases 1–7 of the Regulatory Knowledge Graph",
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 20 },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 900, right: 900 },
        },
      },
      children: [

        // ── COVER ──────────────────────────────────────────────────────────
        new Paragraph({
          children: [
            new TextRun({ text: "SMARTPR", bold: true, size: 52, color: WHITE, font: "Calibri Light" }),
          ],
          shading: { type: ShadingType.CLEAR, fill: NAVY },
          spacing: { before: 0, after: 0 },
          indent: { left: convertInchesToTwip(0.2) },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Puerto Rico Business Licensing Intelligence", size: 20, color: "B3D6FF", font: "Calibri" }),
          ],
          shading: { type: ShadingType.CLEAR, fill: NAVY },
          spacing: { before: 0, after: 80 },
          indent: { left: convertInchesToTwip(0.2) },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: "Investor Briefing", bold: true, size: 48, color: NAVY, font: "Calibri Light" }),
          ],
          spacing: { before: 320, after: 80 },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: "Municipality Coverage & the Regulatory Knowledge Graph", size: 24, color: TEAL, font: "Calibri" }),
          ],
          spacing: { before: 0, after: 200 },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: "Audience: ", bold: true, size: 20, color: NAVY, font: "Calibri" }),
            new TextRun({ text: "Investors · Advisors · Partners", size: 20, color: SLATE, font: "Calibri" }),
          ],
          spacing: { before: 0, after: 40 },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: "Coverage: ", bold: true, size: 20, color: NAVY, font: "Calibri" }),
            new TextRun({ text: "Phases 1 – 7  ·  June 2026", size: 20, color: SLATE, font: "Calibri" }),
          ],
          spacing: { before: 0, after: 200 },
        }),

        // Key stats table on cover
        buildTable(
          ["Metric", "Before (Phase 0)", "After (Phase 7)"],
          [
            ["Authored rules",                      "268",       "596"],
            ["Documents modeled",                   "40",        "58"],
            ["Geographic flags",                    "2 sparse",  "8 first-class"],
            ["Industries with metro coverage",      "0 / 20",    "18 / 20"],
            ["Engine tests",                        "17",        "44 — all passing"],
            ["Avg flag-driven docs (metro restaurant)", "0",     "11"],
          ],
          [3.2, 1.6, 1.6]
        ),

        pageBreak(),

        // ── SECTION 1 — Executive Summary ──────────────────────────────────
        heading1("Executive Summary"),
        bodyNavy("SmartPR is a regulatory-knowledge platform for Puerto Rico business licensing. The differentiator is not the form-filling — it is the knowledge graph behind it: a typed model of jurisdictions, flags, agencies, business types, questions, documents, and the rules that connect them."),
        space(80),
        body("Over seven authoring phases, SmartPR evolved from a generic checklist that treated every Puerto Rico municipality identically into a graph that routes each business through the exact set of permits, inspections, and federal/PR/municipal documents that apply to their specific town and operation."),

        hr(),

        // ── SECTION 2 — Why Municipality Matters ───────────────────────────
        heading2("Why Municipality Matters in Puerto Rico"),
        body("Puerto Rico has 78 autonomous municipios, each with overlapping federal (CBP, EPA, TSA, IRS), commonwealth (Hacienda, OGPe, Departamento de Salud, DRNA, JCA), and municipal (patente, zoning, signage, noise, traffic) regulators."),
        space(80),
        new Paragraph({
          children: [
            run("A restaurant in San Juan ", { bold: true, color: NAVY }),
            run("is not regulated like a restaurant in Aguadilla. ", { color: SLATE }),
            run("A pharmaceutical plant in Ponce ", { bold: true, color: NAVY }),
            run("is not regulated like one in Salinas. ", { color: SLATE }),
            run("An Airbnb in Vieques ", { bold: true, color: NAVY }),
            run("is not regulated like one in Dorado.", { color: SLATE }),
          ],
          spacing: { before: 80, after: 80 },
        }),
        space(40),
        body("These distinctions show up as real, specific documents — facade-preservation plans for historic districts, ferry-logistics manifests for islands, NPDES industrial discharge permits in industrial corridors. Existing tools either flatten everything into a generic checklist or ask the user to know which special obligations apply to their town. SmartPR knows."),

        pageBreak(),

        // ── SECTION 3 — How the Engine Works ───────────────────────────────
        heading1("How the Engine Works"),
        new Paragraph({
          children: [
            new TextRun({ text: "Each business is the intersection of ", size: 22, color: NAVY, font: "Calibri" }),
            new TextRun({ text: "a municipality", size: 22, bold: true, color: TEAL, font: "Calibri" }),
            new TextRun({ text: " (which carries one or more ", size: 22, color: NAVY, font: "Calibri" }),
            new TextRun({ text: "flags", size: 22, bold: true, color: TEAL, font: "Calibri" }),
            new TextRun({ text: "), an ", size: 22, color: NAVY, font: "Calibri" }),
            new TextRun({ text: "industry → business type", size: 22, bold: true, color: TEAL, font: "Calibri" }),
            new TextRun({ text: ", and a small set of ", size: 22, color: NAVY, font: "Calibri" }),
            new TextRun({ text: "yes/no operational questions", size: 22, bold: true, color: TEAL, font: "Calibri" }),
            new TextRun({ text: ". The knowledge graph deterministically resolves those inputs into the exact documents required.", size: 22, color: NAVY, font: "Calibri" }),
          ],
          spacing: { before: 80, after: 160 },
          alignment: AlignmentType.JUSTIFIED,
        }),

        heading3("The 8 Municipality Flags"),
        buildTable(
          ["Flag", "What It Signals", "Towns", "Rules"],
          [
            ["metro",          "Urban corridor — traffic, loading, noise, stormwater",     "9",  "200+"],
            ["capital",        "San Juan-specific obligations (use permit, reporting)",     "1",  "10"],
            ["historic",       "ICP/OECH facade + structural + signage preservation",      "4",  "28"],
            ["island",         "ATM ferry logistics, limited-landfill waste constraints",  "2",  "12"],
            ["tourism",        "PRTC licensing, eco-tourism, beach/water permits",         "16", "29"],
            ["coastal",        "DRNA environmental + shoreline permits",                   "43", "11"],
            ["industrial_port","NPDES, RCRA, Title V, Port Authority docking",             "5",  "28"],
            ["airport_host",   "CBP Customs Bond, TSA Known Shipper, concession permit",  "3",  "11"],
          ],
          [1.5, 3.2, 0.7, 0.8]
        ),

        space(80),
        new Paragraph({
          children: [
            new TextRun({ text: "Note: ", bold: true, size: 18, color: NAVY, font: "Calibri" }),
            new TextRun({ text: "Office-only industries (Finance, IT, Professional Services) correctly yield zero flag-driven documents — the engine does not over-fire.", size: 18, color: SLATE, font: "Calibri" }),
          ],
          shading: { type: ShadingType.CLEAR, fill: "FFF3CD" },
          spacing: { before: 80, after: 80 },
          indent: { left: convertInchesToTwip(0.15) },
        }),

        pageBreak(),

        // ── SECTION 4 — The Seven Phases ───────────────────────────────────
        heading1("The Seven Phases"),
        body("Each phase shipped as a single commit with passing tests — cumulative, additive precision. Every later phase adds specificity on top of the earlier ones without breaking what came before."),
        space(80),

        ...phaseCard(1, "San Juan + Metro Foundation",
          "Introduced the first per-business-type composites for San Juan and six original metro municipalities. Established four drivers: Traffic, Loading, Noise, Environmental, and the capital flag for San Juan-specific obligations.  Effect: A restaurant in San Juan went from 0 municipality-driven documents to 10."),

        ...phaseCard(2, "All Industries × Metro",
          "Extended metro composites to every applicable business type across all 20 industries. Office-only industries (Finance, IT, Professional Services) intentionally left at the universal baseline.  Effect: 18 of 20 industries now have meaningful metro-specific coverage."),

        ...phaseCard(3, "Historic + Island + Metro Fill-ins",
          "Added composites for the four historic-district municipalities (San Juan, Ponce, San Germán, Mayagüez) and two island municipalities (Vieques, Culebra). Three new documents — historic structural review, historic sign variance, ATM ferry manifest.  Effect: A hotel in Old San Juan now sees facade preservation + structural review + sign variance + use permit."),

        ...phaseCard(4, "Popular Non-Metro Municipalities",
          "Broadened tourism and coastal flags to F&B, beauty, retail, and tour-services business types for seven popular beach towns (Aguadilla, Cabo Rojo, Dorado, Fajardo, Humacao, Isabela, Río Grande). Added Arecibo to tourism; Toa Alta and Trujillo Alto to metro.  Effect: A gift shop in Fajardo went from 0 municipality-driven docs to 3."),

        ...phaseCard(5, "Industrial-Port Corridor",
          "Introduced the industrial_port flag for Ponce, Cataño, Guayanilla, Salinas, and Yabucoa. Four new federally-anchored documents: NPDES industrial discharge, RCRA hazardous-waste handler ID, Title V air emission permit, Port Authority docking authorization.  Effect: A chemical manufacturer in Ponce now sees all three heavy-industry federal docs."),

        ...phaseCard(6, "Airport-Host Municipalities",
          "Introduced the airport_host flag for Carolina (SJU), Aguadilla (BQN), and Ponce (Mercedita). Three new documents — CBP Customs Broker Bond, TSA Known Shipper, airport-area concession — wired exclusively to air-cargo and customs-active business types.  Effect: A freight forwarder in Carolina now sees CBP bond + TSA known shipper."),

        ...phaseCard(7, "Patente-Rate Metadata",
          "Extended the municipality schema with an optional patente_rate field — the gross-receipts tax rate that varies by municipio. Populated the seven main metro municipalities at the legal-maximum general rate (0.5% per Ley 113-1995).  Effect: First structural metadata about per-municipality fiscal obligations; opens a path to per-town fee and tax estimates."),

        pageBreak(),

        // ── SECTION 5 — Worked Example ─────────────────────────────────────
        heading1("Platform in Action — Worked Example"),
        heading3("Hotel in Old San Juan  →  21 Personalized Documents"),
        body("The user picks Tourism & Hospitality → Hotel and San Juan as the municipality. The same engine that powers our 44 tests runs instantly in the browser and produces:"),
        space(40),

        buildTable(
          ["Document Group", "Documents Included"],
          [
            ["6  Universal baseline",     "Certificate of Incorporation, EIN, Merchant Registration, Patente Municipal, Municipal Registration, Tax Compliance"],
            ["5  Business-type specific", "Permiso Único, Zoning Certificate, Health Permit, Fire Safety Certificate, Tourism Registration"],
            ["4  Metro composites",       "Stormwater Management Plan, Waste Collection Contract, Parking Compliance Certificate, Traffic Impact Study, Loading Zone Permit"],
            ["1  Capital flag",           "San Juan Municipal Use Permit"],
            ["3  Historic-district",      "Facade Preservation Plan (ICP), Historic Structural Review (OECH), Sign Variance — Historic Zone"],
            ["1  Coastal flag",           "DRNA Shoreline Environmental Permit"],
            ["1  Tourism crossover",      "Additional PRTC Registration (capital + tourism combination)"],
          ],
          [2.0, 4.2]
        ),

        space(160),
        heading3("Switch the Inputs — the Checklist Changes Instantly"),
        bullet("Change municipality to Vieques → lose San Juan + historic docs, gain ATM Ferry Manifest + island waste contract"),
        bullet("Change business type to Software Company → checklist collapses to 6 universal docs + metro infrastructure trio only — no traffic study, no facade review"),
        bullet("Change municipality to Carolina + Freight Forwarder → gain CBP Customs Broker Bond + TSA Known Shipper"),
        bullet("Change municipality to Ponce + Chemical Manufacturer → gain NPDES industrial discharge + RCRA hazardous-waste ID + Title V air permit"),
        space(80),
        body("Same engine. Same rules. Same data model. The platform is correct by construction."),

        pageBreak(),

        // ── SECTION 6 — Competitive Moat ───────────────────────────────────
        heading1("The Competitive Moat"),

        heading3("1. Regulatory Craft, Not Machine Learning"),
        body("Every rule is a hand-authored, sourced statement of an actual obligation under federal, commonwealth, or municipal code. There is no model to scrape — the moat is the correct set of rules, derived from regulation, tested against negative cases. Competitors cannot replicate this by scraping SmartPR's UI."),

        heading3("2. Jurisdiction-Agnostic Architecture"),
        body("A JurisdictionPack abstraction makes all Puerto Rico-specific data swappable. Adding Florida, Texas, or any state becomes a content project, not an engineering project — the engine, UI, and admin visualization are unchanged. Each new jurisdiction is multiplicative value on the same platform."),

        heading3("3. One Source of Truth, Two Surfaces"),
        body("The same engine powers the user checklist and the admin Knowledge Graph. Any rule added appears instantly in both. There is no drift — what the analyst sees is exactly what the customer receives."),

        heading3("4. The Graph is Data, Not Code"),
        body("Adding a new flag, a new municipality, a new document, or a new composite rule is a JSON edit — no rebuild of the platform. SMEs and partners can author with us once the authoring UI is exposed, creating a scalable path for continuous regulatory coverage."),

        hr(),

        // ── SECTION 7 — 90-Day Roadmap ─────────────────────────────────────
        heading2("90-Day Roadmap"),

        buildTable(
          ["Track", "Deliverable", "Why It Matters"],
          [
            ["SME Audit Pass",         "Domain expert review of all 596 rules + flag tagging",  "Validates the substance behind the framework"],
            ["Patente-Rate Enrichment","Populate remaining 71 municipios with researched rates", "Closes per-municipality fiscal estimate gap"],
            ["Florida Pack",           "Author the first non-PR JurisdictionPack",               "Proves the cross-jurisdiction architecture"],
            ["Question-Trigger Refine","Tie composites to user answers, not just business type", "More precise checklists (noise only if amplified sound)"],
            ["Authoring UI",           "SME-facing surface to add/edit rules without JSON",      "Scales authoring beyond the engineering team"],
          ],
          [1.8, 2.4, 2.0]
        ),

        pageBreak(),

        // ── SECTION 8 — Investor Takeaway ──────────────────────────────────
        heading1("Investor Takeaway"),

        new Paragraph({
          children: [
            new TextRun({
              text: "\"The graph today knows that a hotel in Old San Juan needs an ICP facade plan, a freight forwarder in Carolina needs a CBP bond, and a chemical plant in Ponce needs a Title V permit — and it produces those checklists in milliseconds, for free, with no human in the loop.\"",
              italics: true,
              size: 24,
              color: TEAL,
              font: "Calibri",
            }),
          ],
          shading: { type: ShadingType.CLEAR, fill: "F0FDFA" },
          spacing: { before: 160, after: 160 },
          alignment: AlignmentType.CENTER,
          indent: { left: convertInchesToTwip(0.4), right: convertInchesToTwip(0.4) },
          border: {
            left: { color: TEAL, space: 20, style: BorderStyle.SINGLE, size: 12 },
          },
        }),

        bodyNavy("What you saw the team ship across seven phases is not feature work — it is the construction of a regulatory knowledge asset that grows on a defined cadence, with tests that lock in correctness, and an architecture that pays compounding dividends as SmartPR covers more flags, more business types, and eventually more jurisdictions."),
        space(80),
        body("Every additional rule authored is a permanent asset that ships across every customer. This is the part that is hard to build, hard to copy, and the part that makes everything downstream — validation, document intelligence, deliverable generation — more valuable."),

        space(160),

        buildTable(
          ["596 Rules", "78 Municipalities", "44 Tests — All Passing"],
          [
            ["Authored regulatory knowledge,\nnot generic templates",
             "Full Puerto Rico coverage\nwith per-town precision",
             "Engine behavior locked in;\nevery phase is safe to extend"],
          ],
          [2.1, 2.1, 2.0]
        ),

        space(200),

        new Paragraph({
          children: [
            new TextRun({ text: "SmartPR  ·  Confidential  ·  June 2026", size: 16, color: SLATE, font: "Calibri" }),
          ],
          alignment: AlignmentType.CENTER,
        }),

      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
const outPath = path.join(ROOT, "design", "SmartPR-Investor-Briefing.docx");
writeFileSync(outPath, buffer);
console.log(`✓  Written: ${outPath}`);
console.log("  → Open in Google Docs or Word, then File → Download as PDF");
