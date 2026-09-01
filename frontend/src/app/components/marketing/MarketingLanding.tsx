"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import styles from "./marketing.module.css";
import { SmartPRLogo } from "../brand/SmartPRLogo";
import FilingPathStory from "./FilingPathStory";

type Language = "EN" | "ES";

const copy = {
  EN: {
    how: "How it works",
    professionals: "For professionals",
    login: "Login",
    started: "Sign up",
    privacy: "Privacy Policy",
    eyebrow: "Puerto Rico · Guided filing",
    hero: "Know what it takes to open a business in Puerto Rico.",
    heroSub:
      "Describe what you want to build. SmartPR maps the permits, licenses, agencies, documents and filing requirements you need — then helps prepare you to submit them.",
    seeHow: "See how it works",
    stepsTitle: "From uncertainty to submission-ready.",
    steps: [
      ["01", "Describe your business", "Tell SmartPR what you are trying to do in plain language."],
      ["02", "Know what applies", "SmartPR identifies applicable requirements across agencies from the facts you confirmed."],
      ["03", "Prepare everything", "SmartPR maps information into official government forms, checks supporting evidence and identifies missing items."],
      ["04", "Know when you're ready", "Receive a readiness assessment and an organized submission package."],
    ],
    portfolioTitle: "One business or fifty.",
    portfolioBody:
      "SmartPR supports individual owners, gestores, permitting firms, CPAs, law firms, consultants, and operators managing multiple Puerto Rico entities — each with its own filing, documents, and readiness.",
    ready: "ready",
    next: "Next",
    continue: "Continue",
    closeTitle: "Tell SmartPR what you want to build.",
    closeBody: "We'll map what comes next.",
    rows: [
      { name: "Amigos Restaurant", muni: "Bayamón", type: "Restaurant", ready: 78, next: "Upload lease agreement" },
      { name: "HealthPR", muni: "San Juan", type: "Healthcare", ready: 40, next: "Complete Department of State formation" },
    ],
  },
  ES: {
    how: "Cómo funciona",
    professionals: "Para profesionales",
    login: "Iniciar sesión",
    started: "Registrarse",
    privacy: "Política de privacidad",
    eyebrow: "Puerto Rico · Trámite guiado",
    hero: "Sepa lo que toma abrir un negocio en Puerto Rico.",
    heroSub:
      "Describa lo que quiere construir. SmartPR identifica los permisos, licencias, agencias, documentos y requisitos de radicación — y le ayuda a prepararse para presentarlos.",
    seeHow: "Vea cómo funciona",
    stepsTitle: "De la incertidumbre a estar listo para presentar.",
    steps: [
      ["01", "Describa su negocio", "Dígale a SmartPR lo que quiere hacer, en lenguaje sencillo."],
      ["02", "Sepa qué aplica", "SmartPR identifica los requisitos aplicables entre agencias a partir de los hechos que confirmó."],
      ["03", "Prepare todo", "SmartPR lleva la información a formularios oficiales, revisa la evidencia y señala lo que falta."],
      ["04", "Sepa cuándo está listo", "Reciba una evaluación de preparación y un paquete de presentación organizado."],
    ],
    portfolioTitle: "Un negocio o cincuenta.",
    portfolioBody:
      "SmartPR apoya a dueños, gestores, firmas de permisos, CPAs, bufetes, consultores y operadores con varias entidades en Puerto Rico — cada una con su propio trámite, documentos y preparación.",
    ready: "listo",
    next: "Siguiente",
    continue: "Continuar",
    closeTitle: "Dígale a SmartPR lo que quiere construir.",
    closeBody: "Trazamos lo que sigue.",
    rows: [
      { name: "Amigos Restaurant", muni: "Bayamón", type: "Restaurante", ready: 78, next: "Subir contrato de arrendamiento" },
      { name: "HealthPR", muni: "San Juan", type: "Salud", ready: 40, next: "Completar constitución en el Departamento de Estado" },
    ],
  },
} as const;

function LanguageToggle({ language, onChange }: { language: Language; onChange: (lang: Language) => void }) {
  return (
    <div className={styles.language} aria-label={language === "ES" ? "Idioma" : "Language"}>
      {(["EN", "ES"] as const).map((lang) => (
        <button key={lang} type="button" aria-pressed={language === lang} onClick={() => onChange(lang)}>
          {lang}
        </button>
      ))}
    </div>
  );
}

export default function MarketingLanding() {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("EN");
  const [navOpen, setNavOpen] = useState(false);
  const c = copy[language];

  function start() {
    router.push("/?entry=new-business");
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" aria-label="SmartPR home">
            <SmartPRLogo className={styles.logo} size="landing" />
          </Link>
          <nav className={styles.desktopNav} aria-label="Main navigation">
            <a href="#how-it-works">{c.how}</a>
            <a href="#professionals">{c.professionals}</a>
          </nav>
          <div className={styles.desktopActions}>
            <LanguageToggle language={language} onChange={setLanguage} />
            <Link href="/auth/login?next=%2F%3Fentry%3Dnew-business">{c.login}</Link>
            <Link className={styles.primary} href="/?entry=new-business">
              {c.started}
            </Link>
          </div>
          <button
            className={styles.menuButton}
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            aria-expanded={navOpen}
            aria-controls="mobile-nav"
            aria-label={navOpen ? (language === "ES" ? "Cerrar menú" : "Close menu") : (language === "ES" ? "Abrir menú" : "Open menu")}
          >
            {navOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
        {navOpen ? (
          <div id="mobile-nav" className={styles.mobileNav}>
            <a href="#how-it-works" onClick={() => setNavOpen(false)}>
              {c.how}
            </a>
            <a href="#professionals" onClick={() => setNavOpen(false)}>
              {c.professionals}
            </a>
            <div className={styles.mobileAccountRow}>
              <Link href="/auth/login?next=%2F%3Fentry%3Dnew-business">{c.login}</Link>
              <LanguageToggle language={language} onChange={setLanguage} />
            </div>
            <Link href="/?entry=new-business">
              {c.started}
            </Link>
          </div>
        ) : null}
      </header>

      <main>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>{c.eyebrow}</p>
          <h1>{c.hero}</h1>
          <p className={styles.heroLead}>{c.heroSub}</p>
          <div className={styles.heroActions}>
            <Link className={styles.primary} href="/?entry=new-business">
              {c.started}
            </Link>
            <a className={styles.ghost} href="#how-it-works">
              {c.seeHow}
            </a>
            <span className={styles.heroWatermark} aria-hidden="true" />
          </div>
        </section>

        <FilingPathStory language={language} />

        <section className={styles.section}>
          <div className={styles.sectionInner}>
            <h2>{c.stepsTitle}</h2>
            <ol className={styles.cards}>
              {c.steps.map(([n, title, body]) => (
                <li key={n} className={styles.card}>
                  <span>{n}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="professionals" className={styles.section}>
          <div className={styles.sectionInner}>
            <h2>{c.portfolioTitle}</h2>
            <p className={styles.lead}>{c.portfolioBody}</p>
            <ul className={styles.portfolio}>
              {c.rows.map((row) => (
                <li key={row.name}>
                  <div>
                    <strong>{row.name}</strong>
                    <small>
                      {row.muni} · {row.type}
                    </small>
                  </div>
                  <p className={styles.meta}>
                    {row.ready}% {c.ready} · {c.next}: {row.next}
                  </p>
                  <button type="button" className={styles.continue} onClick={start}>
                    {c.continue}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.close}>
            <h2>{c.closeTitle}</h2>
            <p className={styles.lead}>{c.closeBody}</p>
            <Link className={styles.primary} href="/?entry=new-business">
              {c.started}
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>© 2026 SmartPR</span>
          <Link href="/privacy">{c.privacy}</Link>
          <a href="#how-it-works">{c.how}</a>
          <LanguageToggle language={language} onChange={setLanguage} />
        </div>
      </footer>
    </div>
  );
}
