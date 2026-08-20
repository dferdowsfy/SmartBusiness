"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./filingPath.module.css";

type Language = "EN" | "ES";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function clamp01(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function range(p: number, a: number, b: number) {
  if (b === a) return p >= b ? 1 : 0;
  return clamp01((p - a) / (b - a));
}

function ease(t: number) {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function tokenize(sentence: string, marks: string[]) {
  const lower = sentence.toLowerCase();
  const hits: { start: number; end: number }[] = [];
  for (const mark of marks) {
    const i = lower.indexOf(mark.toLowerCase());
    if (i < 0) continue;
    hits.push({ start: i, end: i + mark.length });
  }
  hits.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const hit of hits) {
    const last = merged[merged.length - 1];
    if (last && hit.start <= last.end) last.end = Math.max(last.end, hit.end);
    else merged.push({ ...hit });
  }
  const parts: { text: string; mark: boolean }[] = [];
  let cursor = 0;
  for (const hit of merged) {
    if (hit.start > cursor) parts.push({ text: sentence.slice(cursor, hit.start), mark: false });
    parts.push({ text: sentence.slice(hit.start, hit.end), mark: true });
    cursor = hit.end;
  }
  if (cursor < sentence.length) parts.push({ text: sentence.slice(cursor), mark: false });
  return parts;
}

const copy = {
  EN: {
    title: "One sentence becomes a filing path.",
    mapped: "Your filing path, mapped.",
    sentence: "I want to open a restaurant in Bayamón with 10 employees and outdoor seating.",
    marks: ["restaurant", "Bayamón", "10 employees", "outdoor seating"],
    facts: [
      { id: "type", label: "Restaurant", links: ["dos", "health", "muni"] },
      { id: "place", label: "Bayamón", links: ["muni", "ogpe"] },
      { id: "emp", label: "10 employees", links: ["hacienda"] },
      { id: "out", label: "Outdoor seating", links: ["muni", "ogpe", "health", "fire"] },
    ],
    agencies: [
      { id: "dos", label: "Department of State" },
      { id: "hacienda", label: "Hacienda" },
      { id: "muni", label: "Municipio de Bayamón" },
      { id: "ogpe", label: "OGPe" },
      { id: "health", label: "Department of Health" },
      { id: "fire", label: "Fire" },
    ],
    path: [
      { title: "Entity registration", detail: "Department of State · Certificate of Incorporation" },
      { title: "Tax registration", detail: "Hacienda · Employer Identification Number (SS-4)" },
      { title: "Municipal registration", detail: "Municipio de Bayamón · Municipal patent application" },
      { title: "Permits & use requirements", detail: "OGPe · Permiso Único" },
      { title: "Health / fire requirements", detail: "Department of Health · Fire" },
    ],
    cta: "Build my filing path",
  },
  ES: {
    title: "Una oración se convierte en una ruta de radicación.",
    mapped: "Su ruta de radicación, trazada.",
    sentence: "Quiero abrir un restaurante en Bayamón con 10 empleados y asientos al aire libre.",
    marks: ["restaurante", "Bayamón", "10 empleados", "asientos al aire libre"],
    facts: [
      { id: "type", label: "Restaurante", links: ["dos", "health", "muni"] },
      { id: "place", label: "Bayamón", links: ["muni", "ogpe"] },
      { id: "emp", label: "10 empleados", links: ["hacienda"] },
      { id: "out", label: "Asientos al aire libre", links: ["muni", "ogpe", "health", "fire"] },
    ],
    agencies: [
      { id: "dos", label: "Departamento de Estado" },
      { id: "hacienda", label: "Hacienda" },
      { id: "muni", label: "Municipio de Bayamón" },
      { id: "ogpe", label: "OGPe" },
      { id: "health", label: "Departamento de Salud" },
      { id: "fire", label: "Bomberos" },
    ],
    path: [
      { title: "Registro de entidad", detail: "Departamento de Estado · Certificado de incorporación" },
      { title: "Registro contributivo", detail: "Hacienda · Número de identificación patronal (SS-4)" },
      { title: "Registro municipal", detail: "Municipio de Bayamón · Solicitud de patente municipal" },
      { title: "Permisos y requisitos de uso", detail: "OGPe · Permiso Único" },
      { title: "Requisitos de salud y bomberos", detail: "Departamento de Salud · Bomberos" },
    ],
    cta: "Armar mi ruta de radicación",
  },
} as const;

export default function FilingPathStory({ language }: { language: Language }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const phaseRef = useRef(0);
  const mobileRef = useRef(false);
  const c = copy[language];
  const parts = useMemo(() => tokenize(c.sentence, [...c.marks]), [c]);

  function startExample() {
    router.push("/signup?intent=start");
  }

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;

    const mq = window.matchMedia("(max-width: 1023px)");
    const updateMobile = () => {
      mobileRef.current = mq.matches;
    };
    updateMobile();
    mq.addEventListener("change", updateMobile);

    let frame = 0;

    const apply = (p: number) => {
      const mobile = mobileRef.current;
      const extract = ease(range(p, 0.06, 0.28));
      const graph = ease(range(p, 0.3, 0.52));
      const toPath = ease(range(p, 0.58, 0.82));
      const nextPhase = p < 0.22 ? 0 : p < 0.52 ? 1 : p < 0.8 ? 2 : 3;
      if (phaseRef.current !== nextPhase) {
        phaseRef.current = nextPhase;
        setPhase(nextPhase);
      }

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 40 || h < 40) return;
      const svg = svgRef.current;
      if (svg) {
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        svg.setAttribute("width", String(w));
        svg.setAttribute("height", String(h));
      }

      const facts = [...canvas.querySelectorAll<HTMLElement>("[data-fact]")];
      const agencies = [...canvas.querySelectorAll<HTMLElement>("[data-agency]")];
      const nF = facts.length;
      const nA = agencies.length;
      const factPts: { x: number; y: number }[] = [];

      facts.forEach((el, i) => {
        const spreadX = nF === 1 ? 0.5 : lerp(0.14, 0.86, i / Math.max(1, nF - 1));
        const colY = nF === 1 ? 0.48 : lerp(0.18, 0.82, i / Math.max(1, nF - 1));
        const p1x = spreadX;
        const p1y = mobile ? 0.16 : 0.18;
        const p2x = mobile ? spreadX : 0.16;
        const p2y = mobile ? 0.16 : colY;
        const p3x = spreadX;
        const p3y = 0.08;
        const bx = lerp(p1x, p2x, graph);
        const by = lerp(p1y, p2y, graph);
        const x = lerp(bx, p3x, toPath) * w;
        const y = lerp(by, p3y, toPath) * h;
        el.style.opacity = String(extract * lerp(1, 0.28, toPath));
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${lerp(0.96, 1, extract)})`;
        factPts.push({ x, y });
      });

      const agencyPts: { x: number; y: number }[] = [];
      agencies.forEach((el, i) => {
        const spreadX = nA === 1 ? 0.5 : lerp(0.16, 0.84, i / Math.max(1, nA - 1));
        const x = (mobile ? spreadX : 0.78) * w;
        const y = (mobile ? 0.54 : lerp(0.24, 0.82, nA === 1 ? 0.5 : i / Math.max(1, nA - 1))) * h;
        el.style.opacity = String(graph * (1 - toPath));
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${lerp(0.96, 1, graph)})`;
        agencyPts.push({ x, y });
      });

      canvas.querySelectorAll<SVGPathElement>("[data-link]").forEach((path) => {
        const a = factPts[Number(path.dataset.fi)];
        const b = agencyPts[Number(path.dataset.ai)];
        if (!a || !b) return;
        const x1 = a.x + (mobile ? 0 : 58);
        const x2 = b.x - (mobile ? 0 : 72);
        const midX = mobile ? (x1 + x2) / 2 : lerp(x1, x2, 0.5);
        path.setAttribute("d", `M ${x1} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${x2} ${b.y}`);
        let len = 160;
        try {
          len = path.getTotalLength() || 160;
        } catch {
          /* empty path */
        }
        path.style.strokeDasharray = String(len);
        path.style.strokeDashoffset = String(len * (1 - graph));
        path.style.opacity = String(graph * (1 - toPath) * 0.9);
      });

      const pathBox = canvas.querySelector<HTMLElement>("[data-story=path]");
      if (pathBox) {
        pathBox.style.opacity = String(toPath);
        pathBox.style.transform = `translate(-50%, ${lerp(22, 0, toPath)}px) scale(${lerp(0.96, 1, toPath)})`;
      }
      canvas.querySelectorAll<HTMLElement>("[data-path-step]").forEach((el, i) => {
        const local = ease(range(toPath, i * 0.12, Math.min(1, i * 0.12 + 0.4)));
        el.style.opacity = String(local);
        el.style.transform = `translateY(${lerp(12, 0, local)}px)`;
      });

      const cta = section.querySelector<HTMLElement>("[data-story=cta]");
      if (cta) {
        cta.style.opacity = "1";
        cta.style.pointerEvents = "auto";
      }

      const rail = section.querySelector<HTMLElement>("[data-story=rail]");
      if (rail) rail.style.transform = `scaleY(${p})`;
    };

    const play = 10000;
    const hold = 2800;
    let start = performance.now() - 900;
    const tick = (now: number) => {
      if (reduced) {
        apply(1);
        return;
      }
      const cycle = play + hold;
      const elapsed = (now - start) % cycle;
      apply(elapsed <= play ? elapsed / play : 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      mq.removeEventListener("change", updateMobile);
    };
  }, [reduced, language]);

  const links = c.facts.flatMap((fact, fi) =>
    fact.links
      .map((id) => ({ fi, ai: c.agencies.findIndex((a) => a.id === id) }))
      .filter((l) => l.ai >= 0),
  );

  if (reduced) {
    return (
      <section id="how-it-works" className={styles.staticSection}>
        <div className={styles.staticInner}>
          <h2>{c.mapped}</h2>
          <p>{c.sentence}</p>
          <ul>
            {c.path.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={startExample}>
            {c.cta}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="how-it-works" ref={sectionRef} className={styles.pin}>
      <div className={styles.pinInner}>
        <div className={styles.frame}>
          <div className={styles.heading}>
            <h2 className={phase >= 3 ? styles.hidden : undefined}>{c.title}</h2>
            <h2 className={phase >= 3 ? undefined : styles.hidden} aria-hidden={phase < 3}>
              {c.mapped}
            </h2>
          </div>

          <blockquote className={styles.sentence}>
            {parts.map((part, i) =>
              part.mark ? <em key={i}>{part.text}</em> : <span key={i}>{part.text}</span>,
            )}
          </blockquote>

          <div ref={canvasRef} className={styles.canvas}>
            <div className={styles.rail} aria-hidden>
              <span data-story="rail" />
            </div>

            {c.facts.map((fact) => (
              <span key={fact.id} data-fact={fact.id} className={styles.pill}>
                {fact.label}
              </span>
            ))}

            {c.agencies.map((agency) => (
              <span key={agency.id} data-agency={agency.id} className={styles.agency}>
                <i />
                {agency.label}
              </span>
            ))}

            <svg ref={svgRef} className={styles.svg} aria-hidden>
              {links.map((link, i) => (
                <path key={`${link.fi}-${link.ai}-${i}`} data-link data-fi={link.fi} data-ai={link.ai} />
              ))}
            </svg>

            <div data-story="path" className={styles.path}>
              <ol>
                {c.path.map((step, i) => (
                  <li key={step.title} data-path-step>
                    {i > 0 ? <span className={styles.join} aria-hidden /> : null}
                    <p>{step.title}</p>
                    <small>{step.detail}</small>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div data-story="cta" className={styles.cta}>
            <button type="button" onClick={startExample}>
              {c.cta}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
