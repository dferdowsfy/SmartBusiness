# SmartPR UI/UX Design System & Wireframes

**Design Language**: "TurboTax meets Puerto Rico Government Portal" — clean, trustworthy, low visual noise, high information density without clutter, bilingual by default, WCAG 2.2 AA.

## Visual Identity
- **Primary**: Deep Navy `#0A2540` (trust, government)
- **Accent Teal**: `#0D9488` (progress, Caribbean, modern gov)
- **Success Green**: `#15803D`
- **Warning Amber**: `#B45309`
- **Critical Red**: `#B91C1C`
- **Backgrounds**: `#F8FAFC` (light), `#0F172A` (dark mode future)
- **Text**: Slate 900 / 700 for body, high contrast.
- **Fonts**: Inter (or system sans) for UI; Georgia or similar for headings in reports for authority feel.
- **Spacing**: Generous — 1.5x default Tailwind for breathing room.
- **Icons**: Lucide (consistent line weight). Colored circles behind key icons on landing/checklist.

## Core Components (shadcn/ui + custom)
- Stepper (horizontal on desktop, vertical on mobile) with check / current / locked states.
- Progress ring + linear bar (with % and "X of Y critical items complete").
- Checklist cards (clickable to upload or view details).
- Document dropzone with preview + extracted data inline.
- Finding cards (severity color left border, collapsible evidence).
- Readiness gauge (big number + label + "Last validated: ...").
- Bilingual toggle (EN | ES) always visible in header; persists.
- Disclaimers: Persistent subtle footer + modal on first use + large text in every generated PDF.

## Responsive Strategy
- Mobile: Full-screen wizard steps, large tap targets (min 48px), bottom sheet for details.
- Tablet/Desktop: Two-column (checklist | details panel), side-by-side document + extraction viewer.
- All flows work offline-ish (local state + sync on reconnect) where possible.

## Key Screen Wireframes (Textual Specification)

### 1. Landing / Get Started
- Hero: "Know exactly what your Puerto Rico business needs before you submit." (bilingual)
- Trust bar: "Built for compliance with SBP, OGPe, Hacienda, and municipal requirements. Readiness assessment only."
- Primary CTA: "Start Free Readiness Check"
- Secondary: "How it works" (3-step visual), "For accountants & advisors", "See sample report"
- Footer with strong disclaimers and links to official portals.

### 2. Step 1: Business Discovery (Wizard)
Layout:
- Top: Progress stepper "1/9 Business Profile" (or dynamic total)
- Left/main: Current question card(s)
  - Business Name (text)
  - Municipality (select or combobox with 78 options + "Other")
  - Industry (grid of cards or searchable: Restaurant, Retail, Medical Office, Professional Services, Construction, Tourism, Manufacturing, Other)
  - Business Structure (radios)
  - Physical Location / Address (fields)
  - Number of Employees (number or ranges)
  - Home-Based? (Yes/No with warning callout if Yes)
- Dynamic section below (appears after base answers): "Additional details for [Industry]"
  - Restaurant example: toggles + selects for "Serves food on premises?", "Alcohol sales?", "Commercial kitchen?", "Indoor seating capacity?"
- Bottom nav: Back | Save & Continue (disabled until required answered)
- Sidebar (desktop): Live preview of "Likely requirements so far (3-7 items)" — updates live.

Validation: Real-time where possible; server roundtrip on major branches.

### 3. Step 3: Personalized Checklist (Core Experience)
TurboTax-like:
- Header: Business name + "Readiness 68%" + big progress bar + "Estimated 12-18 days to complete core items"
- Tabs or sections: All | By Agency | Critical First
- List of items:
  - [✓] Certificate of Incorporation — linked doc, extracted "ABC LLC", "Passed"
  - [✓] EIN Confirmation
  - [ ] Merchant Registration (Hacienda) — "Required. Apply via SURI."
  - [ ] Health Permit (Salud) — "Critical for food service"
  - etc.
- Each row: Status pill, Agency badge, "Why?" (opens explanation + citation), Upload button or "View document".
- Right panel (or bottom sheet): Selected item detail + upload history + extraction card if present.
- Floating action: "Upload documents" or "Generate Package (current score 68%)"

### 4. Document Upload & Review
- Dropzone prominent.
- After upload: Thumbnail + filename + "AI analyzing..." → "Extracted: Business Name: ABC Restaurant LLC | Issued: 2024-06-12 | Expires: 2025-06-12"
- "Edit extracted values" (for user correction).
- "Link to requirement" (if ambiguous).
- Multi-file support with batch.

### 5. Findings Dashboard
- Score header with trend sparkline (future).
- Three columns or stacked sections: Critical (red), Warnings (amber), Informational (blue).
- Each finding:
  - Title
  - One-sentence description
  - Evidence: "Certificate of Incorporation shows 'ABC LLC' vs Insurance 'ABC Restaurants LLC' (doc #3)"
  - Recommended: "Upload corrected insurance certificate or add explanation letter."
  - Agency: "Hacienda / Insurance requirements"
  - Actions: "Upload replacement", "Mark addressed (will re-validate)", "Add note"

### 6. Submission Package Preview / Download
- Summary card (score, date, business, rule version used).
- Sections mirror the PDF: Summary, Required Items Status, Findings, Document Index, Disclaimers.
- "Download PDF" (primary) + "Download JSON (machine-readable for future submission)" (secondary).
- "This package reflects your readiness as of [timestamp]. Re-generate after changes."

### 7. Business Dashboard (Post-Onboarding)
- List of businesses (for advisors) or single business view.
- At-a-glance score + last validated.
- Quick actions: Re-validate, Upload more, View latest package, Edit profile.
- History table of previous validation runs + packages.

## Accessibility & i18n Specifics
- All form controls labeled, described.
- Findings have `aria-live` updates on validation completion.
- Language switch does not lose form state.
- PDF is tagged for screen readers + has logical reading order.
- Color is never sole indicator (icons + text + patterns).

## Interaction States
- Loading: Skeleton for checklist items, spinner for AI.
- Empty: Encouraging "Start with your Certificate of Incorporation or Merchant Registration" with examples.
- Error: Clear message + "Try again" + support contact. Never blame user for AI issues.

## Design QA Checklist (for implementation)
- [ ] No "approved", "compliant", "cleared", "granted" strings.
- [ ] Every screen has visible disclaimer or link to full legal.
- [ ] Bilingual parity (no English-only strings in prod).
- [ ] Mobile layout tested at 320px, 375px, 414px.
- [ ] Keyboard-only navigation through entire wizard + checklist.
- [ ] High contrast mode verified.

## Wireframe Assets
Text descriptions above are sufficient for handoff. For visual exploration:
- Use Figma with the above tokens.
- In this design package, the PPTX contains illustrated screen mocks using shapes and text.
- Future: High-fidelity coded prototypes in Storybook.

This UX prioritizes clarity and forward progress over delight. Users are often stressed about government processes — the interface should feel calm, competent, and authoritative without being intimidating.
