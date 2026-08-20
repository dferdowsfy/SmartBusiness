"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Menu,
  Plus,
  Waypoints,
  X,
} from "lucide-react";
import styles from "./marketing.module.css";
import { SmartPRLogo } from "../brand/SmartPRLogo";
import FilingPathStory from "./FilingPathStory";

type Language = "EN" | "ES";

const copy = {
  EN: {
    nav: ["How It Works", "For Professionals", "Pricing"],
    login: "Log in",
    started: "Get Started",
    badge: "Built for Puerto Rico businesses",
    heroA: "Puerto Rico business compliance,",
    heroB: "without the guesswork",
    heroBody: "From starting a business to staying current, SmartPR tells you what applies, what's missing, and what needs to happen next.",
    startTitle: "Start a New Business",
    startBody: "Find out exactly what you need and get your business ready to file.",
    startAction: "Start a Business",
    manageTitle: "Manage an Existing Business",
    manageBody: "Track filings, renewals, documents, and upcoming deadlines.",
    manageAction: "Manage a Business",
    clientPrompt: "Manage businesses for clients?",
    professionalsLink: "Explore SmartPR for Professionals",
    previewTitleA: "Everything you need to keep every business",
    previewTitleB: "on track",
    howTitle: "How SmartPR works.",
    roadmapTitle: "What are you trying to do?",
    locationTitle: "Where will the business operate?",
    roadmapAction: "Build My Roadmap",
    professionalsTitle: "Manage every client from one place.",
    professionalsBody: "Track businesses, filings, deadlines, documents, and compliance status across your entire portfolio.",
    lifecycleTitle: "Starting the business is only the beginning.",
    lifecycleBody: "SmartPR keeps track of what comes next, so businesses and their advisors can stay ahead of renewals and regulatory deadlines.",
    trustTitle: "Built specifically for Puerto Rico.",
    trustBody: "SmartPR organizes business requirements across Puerto Rico's regulatory ecosystem.",
    disclaimer: "SmartPR is an independent platform. Government agencies remain the approving authorities for permits, licenses, registrations, and filings.",
    finalTitle: "Know what's required. Know what's next.",
    finalBody: "Start a new business or bring an existing business into SmartPR and keep everything on track.",
  },
  ES: {
    nav: ["Cómo funciona", "Para profesionales", "Precios"],
    login: "Iniciar sesión",
    started: "Comenzar",
    badge: "Creado para negocios de Puerto Rico",
    heroA: "Cumplimiento empresarial en Puerto Rico,",
    heroB: "sin adivinanzas",
    heroBody: "Desde comenzar un negocio hasta mantenerlo al día, SmartPR te dice qué aplica, qué falta y cuál es el próximo paso.",
    startTitle: "Comenzar un negocio nuevo",
    startBody: "Descubre exactamente qué necesitas y prepara tu negocio para radicar.",
    startAction: "Comenzar un negocio",
    manageTitle: "Administrar un negocio existente",
    manageBody: "Controla radicaciones, renovaciones, documentos y próximas fechas límite.",
    manageAction: "Administrar un negocio",
    clientPrompt: "¿Administras negocios para clientes?",
    professionalsLink: "Explora SmartPR para profesionales",
    previewTitleA: "Todo lo necesario para mantener cada negocio",
    previewTitleB: "al día",
    howTitle: "Cómo funciona SmartPR.",
    roadmapTitle: "¿Qué estás tratando de hacer?",
    locationTitle: "¿Dónde operará el negocio?",
    roadmapAction: "Crear mi hoja de ruta",
    professionalsTitle: "Administra cada cliente desde un solo lugar.",
    professionalsBody: "Controla negocios, radicaciones, fechas límite, documentos y cumplimiento en toda tu cartera.",
    lifecycleTitle: "Comenzar el negocio es solo el principio.",
    lifecycleBody: "SmartPR controla lo que sigue para que los negocios y sus asesores se adelanten a renovaciones y fechas regulatorias.",
    trustTitle: "Creado específicamente para Puerto Rico.",
    trustBody: "SmartPR organiza requisitos empresariales a través del ecosistema regulatorio de Puerto Rico.",
    disclaimer: "SmartPR es una plataforma independiente. Las agencias gubernamentales siguen siendo las autoridades que aprueban permisos, licencias, registros y radicaciones.",
    finalTitle: "Conoce lo requerido. Conoce lo próximo.",
    finalBody: "Comienza un negocio nuevo o incorpora uno existente a SmartPR y mantén todo al día.",
  },
} as const;

const demoQuery = "I want to open a restaurant that serves alcohol and has outdoor seating";
const demoItems = [
  "Liquor License (Negociado de Bebidas)",
  "Outdoor Seating / Sidewalk Café Permit",
  "Health Department Permit",
  "Fire Department Inspection",
];

const esLabels: Record<string, string> = {
  "I want to open a restaurant that serves alcohol and has outdoor seating": "Quiero abrir un restaurante que sirva alcohol y tenga asientos al aire libre",
  "Liquor License (Negociado de Bebidas)": "Licencia de bebidas alcohólicas (Negociado de Bebidas)",
  "Outdoor Seating / Sidewalk Café Permit": "Permiso para asientos al aire libre",
  "Health Department Permit": "Permiso del Departamento de Salud",
  "Fire Department Inspection": "Inspección del Cuerpo de Bomberos",
  "Quick question": "Pregunta rápida",
  "Will the outdoor seating sit on a public sidewalk or private property?": "¿Los asientos estarán en una acera pública o en propiedad privada?",
  Businesses: "Negocios", "Due Soon": "Próximo a vencer", "Need Attention": "Requiere atención", "Filings In Progress": "Radicaciones en curso",
  "Business / Filing": "Negocio / Radicación", Status: "Estado", Ready: "Preparación", "Action Needed": "Acción necesaria",
  "Permiso Único": "Permiso Único", "Due Sep 14": "Vence el 14 de sep.", Current: "Al día", "Upload insurance": "Subir seguro",
  "Annual Filing": "Radicación anual", "No action": "Sin acción", "Health License": "Licencia de salud", "Needs Attention": "Requiere atención", "Missing certification": "Falta certificación",
  "Tell SmartPR about the business.": "Cuéntale a SmartPR sobre el negocio.", "Answer a few questions or describe what you’re trying to do.": "Responde algunas preguntas o describe lo que deseas hacer.",
  "SmartPR determines what applies.": "SmartPR determina qué aplica.", "Requirements are mapped across agencies, permits, licenses, registrations, and supporting documents.": "Los requisitos se relacionan entre agencias, permisos, licencias, registros y documentos de apoyo.",
  "SmartPR helps get it done.": "SmartPR ayuda a completarlo.", "Prepare filings, review documents, identify missing information, and track what comes next.": "Prepara radicaciones, revisa documentos, identifica información faltante y controla lo próximo.",
  Restaurant: "Restaurante", "Professional Services": "Servicios profesionales", Retail: "Comercio", Healthcare: "Salud", Construction: "Construcción", Other: "Otro",
  "A restaurant": "Un restaurante", "A professional services business": "Un negocio de servicios profesionales", "A retail business": "Un comercio", "A healthcare business": "Un negocio de salud", "A construction business": "Un negocio de construcción", "A business": "Un negocio",
  "Manage multiple businesses": "Administra múltiples negocios", "See upcoming deadlines": "Consulta próximas fechas límite", "Track filing readiness": "Controla la preparación de radicaciones", "Review missing documentation": "Revisa documentos faltantes", "Maintain filing history": "Mantén el historial de radicaciones", "Start new filings from existing client profiles": "Inicia radicaciones desde perfiles de clientes existentes",
  "Due This Month": "Vencen este mes", Overdue: "Vencidos", "Waiting on Client": "Esperando al cliente", "In Progress": "En curso",
  "Start Business": "Comenzar negocio", Permits: "Permisos", "Annual Filings": "Radicaciones anuales", Renewals: "Renovaciones", Changes: "Cambios", "Ongoing Compliance": "Cumplimiento continuo",
  "Due in 47 days": "Vence en 47 días", "Annual filing": "Radicación anual", "Due Apr 15": "Vence el 15 de abr.", Insurance: "Seguro", "Expires in 62 days": "Vence en 62 días", "Health certification": "Certificación de salud",
  Municipalities: "Municipios", "Professional Boards": "Juntas profesionales", Product: "Producto", "How It Works": "Cómo funciona", "For Professionals": "Para profesionales", Pricing: "Precios", Company: "Compañía", About: "Acerca de", Contact: "Contacto", Legal: "Legal", Privacy: "Privacidad", Terms: "Términos",
};

const businesses = [
  { name: "Luna Café LLC", filing: "Permiso Único", due: "Due Sep 14", status: "Due Soon", pct: 80, action: "Upload insurance", tone: "amber" },
  { name: "Rivera Consulting LLC", filing: "Annual Filing", due: "Current", status: "Current", pct: 100, action: "No action", tone: "green" },
  { name: "Farmacia Norte", filing: "Health License", due: "Needs Attention", status: "Needs Attention", pct: 55, action: "Missing certification", tone: "red" },
];

const metrics = [
  ["23", "Businesses", "blue"],
  ["4", "Due Soon", "amber"],
  ["2", "Need Attention", "red"],
  ["6", "Filings In Progress", "teal"],
] as const;

const categories = ["Restaurant", "Professional Services", "Retail", "Healthcare", "Construction", "Other"];
const locations = ["San Juan", "Guaynabo", "Bayamón", "Carolina", "Other"];
const categoryArticles: Record<string, string> = {
  Restaurant: "A restaurant",
  "Professional Services": "A professional services business",
  Retail: "A retail business",
  Healthcare: "A healthcare business",
  Construction: "A construction business",
  Other: "A business",
};

function LanguageToggle({ language, onChange, dark = false }: { language: Language; onChange: (lang: Language) => void; dark?: boolean }) {
  return (
    <div className={`${styles.language} ${dark ? styles.languageDark : ""}`} aria-label="Language">
      {(["EN", "ES"] as const).map((lang) => (
        <button key={lang} type="button" aria-pressed={language === lang} onClick={() => onChange(lang)}>{lang}</button>
      ))}
    </div>
  );
}

function AssistantDemo({ language }: { language: Language }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const cycle = 8900;
    const timer = window.setInterval(() => setElapsed((Date.now() - started) % cycle), 32);
    return () => window.clearInterval(timer);
  }, []);

  const query = language === "ES" ? esLabels[demoQuery] : demoQuery;
  const typedMs = query.length * 32;
  const typed = query.slice(0, Math.min(query.length, Math.floor(elapsed / 32)));
  const analyzing = elapsed >= typedMs + 450 && elapsed < typedMs + 1350;
  const resultsStart = typedMs + 1350;
  const resultCount = elapsed >= resultsStart ? Math.min(4, Math.floor((elapsed - resultsStart) / 420) + 1) : 0;
  const showQuestion = elapsed >= resultsStart + 4 * 420 + 500;

  return (
    <div className={styles.assistantCard} aria-label="SmartPR Assistant example">
      <div className={styles.assistantHeader}>
        <span className={styles.assistantIcon}><Waypoints size={14} /></span>
        <strong>Smart<span>PR</span> Assistant</strong>
        <span className={styles.live}><i /> live</span>
      </div>
      <div className={styles.demoInput}>{typed}<span className={styles.cursor} /></div>
      {analyzing && <div className={styles.analyzing}><span /><span /><span /> {language === "ES" ? "Determinando qué aplica…" : "Finding what applies…"}</div>}
      {resultCount > 0 && <div className={styles.demoResults}>{demoItems.slice(0, resultCount).map((item) => <div key={item}><i><Check size={12} /></i>{language === "ES" ? esLabels[item] : item}</div>)}</div>}
      {showQuestion && <div className={styles.quickQuestion}><b>{language === "ES" ? esLabels["Quick question"] : "Quick question"}</b><span>{language === "ES" ? esLabels["Will the outdoor seating sit on a public sidewalk or private property?"] : "Will the outdoor seating sit on a public sidewalk or private property?"}</span></div>}
    </div>
  );
}

function StatusBadge({ status, tone }: { status: string; tone: string }) {
  return <span className={`${styles.status} ${styles[tone]}`}>{status}</span>;
}

export default function MarketingLanding() {
  const [language, setLanguage] = useState<Language>("EN");
  const [navOpen, setNavOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const c = copy[language];
  const t = (value: string) => language === "ES" ? (esLabels[value] || value) : value;
  const roadmapText = (() => {
    if (!category || !location) return "";
    if (language === "ES") return `${t(categoryArticles[category])} en ${t(location)} puede requerir trámites ante varias agencias.`;
    return `${categoryArticles[category]} in ${location} may involve requirements across multiple agencies.`;
  })();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" aria-label="SmartPR home"><SmartPRLogo className={styles.logo} inverted size="landing" /></Link>
          <nav className={styles.desktopNav} aria-label="Main navigation">
            <a href="#how-it-works">{c.nav[0]}</a><a href="#professionals">{c.nav[1]}</a><a href="#pricing">{c.nav[2]}</a>
          </nav>
          <div className={styles.desktopActions}>
            <LanguageToggle language={language} onChange={setLanguage} />
            <Link href="/auth/login">{c.login}</Link>
            <Link className={styles.tealButton} href="/signup">{c.started}</Link>
          </div>
          <button className={styles.menuButton} type="button" onClick={() => setNavOpen((open) => !open)} aria-expanded={navOpen} aria-controls="mobile-nav">
            {navOpen ? <X size={18} /> : <Menu size={18} />} Menu
          </button>
        </div>
        {navOpen && <div id="mobile-nav" className={styles.mobileNav}>
          <a href="#how-it-works" onClick={() => setNavOpen(false)}>{c.nav[0]}</a>
          <a href="#professionals" onClick={() => setNavOpen(false)}>{c.nav[1]}</a>
          <a href="#pricing" onClick={() => setNavOpen(false)}>{c.nav[2]}</a>
          <Link href="/auth/login">{c.login}</Link>
          <LanguageToggle language={language} onChange={setLanguage} />
          <Link className={styles.tealButton} href="/signup">{c.started}</Link>
        </div>}
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.tealBlob} /><div className={styles.blueBlob} />
          <div className={styles.heroGrid}>
            <div>
              <div className={styles.eyebrow}><i />{c.badge}</div>
              <h1>{c.heroA} <span>{c.heroB}<i /></span>.</h1>
              <p>{c.heroBody}</p>
            </div>
            <AssistantDemo language={language} />
          </div>
          <div className={styles.routeCards}>
            <article className={`${styles.routeCard} ${styles.startCard}`}>
              <span className={styles.routeIcon}><Plus /></span>
              <div><h2>{c.startTitle}</h2><p>{c.startBody}</p></div>
              <Link className={styles.navyButton} href="/signup?intent=start">{c.startAction}<ArrowRight size={16} /></Link>
            </article>
            <article className={`${styles.routeCard} ${styles.manageCard}`}>
              <span className={styles.routeIcon}><ClipboardCheck /></span>
              <div><h2>{c.manageTitle}</h2><p>{c.manageBody}</p></div>
              <Link className={styles.tealButton} href="/signup?intent=manage">{c.manageAction}<ArrowRight size={16} /></Link>
            </article>
          </div>
          <div className={styles.clientPrompt}><span>{c.clientPrompt}</span><a href="#professionals">{c.professionalsLink} <ArrowRight size={15} /></a></div>
        </section>

        <section className={styles.previewSection}>
          <div className={styles.sectionInner}>
            <h2 className={styles.centerTitle}>{c.previewTitleA} <span>{c.previewTitleB}</span>.</h2>
            <div className={styles.previewPanel}>
              <div className={styles.metrics}>{metrics.map(([value, label, tone]) => <div key={label} className={`${styles.metric} ${styles[`${tone}Top`]}`}><strong>{value}</strong><span>{t(label)}</span></div>)}</div>
              <div className={styles.complianceTable}>
                <div className={styles.tableHeader}><span>{t("Business / Filing")}</span><span>{t("Status")}</span><span>{t("Ready")}</span><span>{t("Action Needed")}</span></div>
                {businesses.map((business) => <div className={styles.tableRow} key={business.name}>
                  <div className={styles.businessCell}><strong>{business.name}</strong><span>{t(business.filing)} · {t(business.due)}</span></div>
                  <div><StatusBadge status={t(business.status)} tone={business.tone} /></div>
                  <div className={styles.readiness}><div><i className={styles[business.tone]} style={{ width: `${business.pct}%` }} /></div><span>{business.pct}%</span></div>
                  <div className={styles.actionCell}>{t(business.action)}</div>
                </div>)}
              </div>
            </div>
          </div>
        </section>

        <FilingPathStory language={language} />

        <section className={styles.roadmap}>
          <div className={styles.roadmapInner}>
            <h2>{c.roadmapTitle}</h2>
            <div className={styles.chips}>{categories.map((item) => <button className={category === item ? styles.selectedChip : ""} key={item} type="button" onClick={() => { setCategory(item); setLocation(null); }}>{t(item)}</button>)}</div>
            {category && <div className={styles.locationStep}><h3>{c.locationTitle}</h3><div className={styles.chips}>{locations.map((item) => <button className={location === item ? styles.selectedChip : ""} key={item} type="button" onClick={() => setLocation(item)}>{t(item)}</button>)}</div></div>}
            {roadmapText && <div className={styles.roadmapResult}><p>{roadmapText}</p><Link className={styles.tealButton} href="/signup?intent=start">{c.roadmapAction}</Link></div>}
          </div>
        </section>

        <section id="professionals" className={styles.previewSection}>
          <div className={styles.professionalGrid}>
            <div><h2>{c.professionalsTitle}</h2><p>{c.professionalsBody}</p><ul>{["Manage multiple businesses", "See upcoming deadlines", "Track filing readiness", "Review missing documentation", "Maintain filing history", "Start new filings from existing client profiles"].map((item) => <li key={item}><i><Check size={11} /></i>{t(item)}</li>)}</ul><Link className={styles.navyButton} href="/signup?intent=manage">{c.professionalsLink}</Link></div>
            <div className={styles.proMetrics}>{[["150", "Businesses"], ["18", "Due This Month"], ["7", "Overdue"], ["12", "Waiting on Client"], ["9", "In Progress"]].map(([value, label]) => <div key={label}><strong>{value}</strong><span>{t(label)}</span></div>)}</div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.narrowInner}><h2 className={styles.centerTitle}>{c.lifecycleTitle}</h2><p className={styles.sectionIntro}>{c.lifecycleBody}</p>
            <div className={styles.lifecycle}>{["Start Business", "Permits", "Annual Filings", "Renewals", "Changes", "Ongoing Compliance"].map((item, index, all) => <span key={item}><b>{t(item)}</b>{index < all.length - 1 && <ArrowRight size={15} />}</span>)}</div>
            <div className={styles.deadlineCard}>{[["Permiso Único", "Due in 47 days", "Due Soon", "amber"], ["Annual filing", "Due Apr 15", "Due Soon", "amber"], ["Insurance", "Expires in 62 days", "Due Soon", "amber"], ["Health certification", "Current", "Current", "green"]].map(([name, due, status, tone]) => <div key={name}><strong>{t(name)}</strong><span>{t(due)}</span><StatusBadge status={t(status)} tone={tone} /></div>)}</div>
          </div>
        </section>

        <section className={styles.trustSection}>
          <div className={styles.roadmapInner}><h2>{c.trustTitle}</h2><p>{c.trustBody}</p><div className={styles.agencies}>{["Departamento de Estado", "Hacienda", "OGPe", "Municipalities", "Salud", "Bomberos", "Professional Boards"].map((agency) => <span key={agency}>{t(agency)}</span>)}</div><small>{c.disclaimer}</small></div>
        </section>

        <section id="pricing" className={styles.finalCta}><h2>{c.finalTitle}</h2><p>{c.finalBody}</p><div><Link className={styles.tealButton} href="/signup?intent=start">{c.startTitle}</Link><Link className={styles.outlineButton} href="/signup?intent=manage">{c.manageTitle}</Link></div><a href="#professionals">SmartPR for Professionals <ArrowRight size={14} /></a></section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerGrid}><SmartPRLogo className={styles.logo} size="landing" /><div><b>{t("Product")}</b><a href="#how-it-works">{t("How It Works")}</a><a href="#professionals">{t("For Professionals")}</a><a href="#pricing">{t("Pricing")}</a></div><div><b>{t("Company")}</b><a href="#">{t("About")}</a><a href="#">{t("Contact")}</a></div><div><b>{t("Legal")}</b><a href="#">{t("Privacy")}</a><a href="#">{t("Terms")}</a></div></div>
        <div className={styles.footerBottom}><span>© 2026 SmartPR</span><LanguageToggle language={language} onChange={setLanguage} dark /></div>
      </footer>
    </div>
  );
}
