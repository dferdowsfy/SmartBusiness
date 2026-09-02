"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Receipt, Landmark, ShieldCheck, HeartPulse } from "lucide-react";
import styles from "./filingPath.module.css";

type Language = "EN" | "ES";

const STEP_ICONS: Array<typeof Building2> = [Building2, Receipt, Landmark, ShieldCheck, HeartPulse];

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

type Token = { text: string; mark: boolean; start: number; end: number };

/** Splits `sentence` into ordered, non-overlapping segments, tagging the ones
 * that match an entry in `marks`. Segments partition the sentence exactly,
 * so cumulative lengths double as reveal offsets for the typing animation. */
function tokenize(sentence: string, marks: string[]): Token[] {
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
  let offset = 0;
  return parts.map((part) => {
    const start = offset;
    offset += part.text.length;
    return { ...part, start, end: offset };
  });
}

const copy = {
  EN: {
    mapped: "Your filing path, mapped.",
    sentence: "I want to open a restaurant in Bayamón with 10 employees and outdoor seating.",
    marks: ["restaurant", "Bayamón", "10 employees", "outdoor seating"],
    chips: ["Restaurant", "Bayamón", "10 employees", "Outdoor seating"],
    parseReading: "Reading your business",
    parseDetails: (n: number) => `${n} details identified`,
    parseAgencies: (n: number) => `${n} agencies apply`,
    parseMapped: "Filing sequence mapped",
    agencies: ["Department of State", "Hacienda", "Municipio de Bayamón", "OGPe", "Department of Health", "Fire"],
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
    mapped: "Su ruta de radicación, trazada.",
    sentence: "Quiero abrir un restaurante en Bayamón con 10 empleados y asientos al aire libre.",
    marks: ["restaurante", "Bayamón", "10 empleados", "asientos al aire libre"],
    chips: ["Restaurante", "Bayamón", "10 empleados", "Asientos al aire libre"],
    parseReading: "Leyendo su negocio",
    parseDetails: (n: number) => `${n} detalles identificados`,
    parseAgencies: (n: number) => `${n} agencias aplican`,
    parseMapped: "Ruta de radicación trazada",
    agencies: ["Departamento de Estado", "Hacienda", "Municipio de Bayamón", "OGPe", "Departamento de Salud", "Bomberos"],
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

function bezier(p0: number, p1: number, p2: number, p3: number, t: number) {
  const m = 1 - t;
  return m * m * m * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t * p3;
}

function arrowheadPath(x: number, y: number, angle: number) {
  const size = 4.2;
  const a1 = angle + Math.PI - 0.42;
  const a2 = angle + Math.PI + 0.42;
  return `M ${x} ${y} L ${x + size * Math.cos(a1)} ${y + size * Math.sin(a1)} L ${x + size * Math.cos(a2)} ${y + size * Math.sin(a2)} Z`;
}

export default function FilingPathStory({ language }: { language: Language }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const c = copy[language];
  const tokens = useMemo(() => tokenize(c.sentence, [...c.marks]), [c]);
  const markTokens = useMemo(() => tokens.filter((t) => t.mark), [tokens]);

  const sectionRef = useRef<HTMLElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const routeRef = useRef<SVGPathElement | null>(null);
  const arrowRefs = useRef<(SVGPathElement | null)[]>([]);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  /** Where the route currently sits, so a re-measure can restore that state
   * instead of blanking it. Mobile browsers fire resize on every URL-bar
   * collapse mid-scroll, which is exactly when this section animates. */
  const drawStateRef = useRef<"hidden" | "drawing" | "drawn">("hidden");

  const [typedCount, setTypedCount] = useState(0);
  const [caretDone, setCaretDone] = useState(false);
  const [parseOn, setParseOn] = useState(false);
  const [parseSettled, setParseSettled] = useState(false);
  const [parseLabel, setParseLabel] = useState<string>(c.parseReading);
  const [markedCount, setMarkedCount] = useState(0);
  const [liftedCount, setLiftedCount] = useState(0);
  const [agenciesShown, setAgenciesShown] = useState(0);
  const [pathDrawn, setPathDrawn] = useState(false);
  const [stepsShown, setStepsShown] = useState(0);
  const [ctaShown, setCtaShown] = useState(false);

  // Reduced motion never touches the timeline state above — it just renders
  // the finished values directly, so there's nothing to synchronize in an effect.
  const effTypedCount = reduced ? c.sentence.length : typedCount;
  const effCaretDone = reduced ? true : caretDone;
  const effParseOn = reduced ? true : parseOn;
  const effParseSettled = reduced ? true : parseSettled;
  const effParseLabel = reduced ? c.parseMapped : parseLabel;
  const effMarkedCount = reduced ? markTokens.length : markedCount;
  const effLiftedCount = reduced ? markTokens.length : liftedCount;
  const effAgenciesShown = reduced ? c.agencies.length : agenciesShown;
  const effStepsShown = reduced ? c.path.length : stepsShown;
  const effPathDrawn = reduced ? true : pathDrawn;
  const effCtaShown = reduced ? true : ctaShown;

  const reset = () => {
    setTypedCount(0);
    setCaretDone(false);
    setParseOn(false);
    setParseSettled(false);
    setParseLabel(c.parseReading);
    setMarkedCount(0);
    setLiftedCount(0);
    setAgenciesShown(0);
    setPathDrawn(false);
    setStepsShown(0);
    setCtaShown(false);
  };

  /** Measures the current node circles and writes the connecting curve +
   * arrowheads straight onto the SVG (matches how the rest of this file
   * drives the desktop canvas: geometry is imperative, content is not). */
  const layoutPath = () => {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    const route = routeRef.current;
    if (!wrap || !svg || !route) return 0;
    const wrapBox = wrap.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 56 ${wrapBox.height}`);
    svg.setAttribute("height", String(wrapBox.height));
    const nodes = nodeRefs.current
      .filter((n): n is HTMLDivElement => Boolean(n))
      .map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.left - wrapBox.left + r.width / 2, y: r.top - wrapBox.top + r.height / 2 };
      });
    if (nodes.length < 2) return 0;
    let d = `M ${nodes[0].x} ${nodes[0].y}`;
    nodes.slice(1).forEach((p1, i) => {
      const p0 = nodes[i];
      const dir = i % 2 === 0 ? 1 : -1;
      const bow = 9 * dir;
      const c1x = p0.x + bow;
      const c1y = p0.y + (p1.y - p0.y) * 0.33;
      const c2x = p1.x - bow;
      const c2y = p0.y + (p1.y - p0.y) * 0.66;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p1.x} ${p1.y}`;
      const ax = bezier(p0.x, c1x, c2x, p1.x, 0.9);
      const ay = bezier(p0.y, c1y, c2y, p1.y, 0.9);
      const bx = bezier(p0.x, c1x, c2x, p1.x, 0.98);
      const by = bezier(p0.y, c1y, c2y, p1.y, 0.98);
      const arrow = arrowRefs.current[i];
      if (arrow) arrow.setAttribute("d", arrowheadPath(bx, by, Math.atan2(by - ay, bx - ax)));
    });
    route.setAttribute("d", d);
    const len = route.getTotalLength();
    route.style.strokeDasharray = String(len);
    // Restore whatever state the route was in — re-measuring must not un-draw
    // it. Mid-draw, leave the in-flight transition alone so it keeps running.
    if (drawStateRef.current === "hidden") {
      route.style.transition = "none";
      route.style.strokeDashoffset = String(len);
    } else if (drawStateRef.current === "drawn") {
      route.style.transition = "none";
      route.style.strokeDashoffset = "0";
    }
    return len;
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    layoutPath();

    let frame = 0;
    const relayout = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => layoutPath());
    };

    // A plain window "resize" only fires on viewport changes. It misses the
    // far more common case on a first visit: the step titles render in a
    // fallback font, then reflow taller/shorter once the real webfont swaps
    // in (next/font's default font-display: swap) — same width, no resize
    // event, but every node below the swap has moved. A ResizeObserver on
    // the list catches that reflow directly; document.fonts.ready is a
    // belt-and-suspenders nudge for browsers where the observer fires before
    // the swapped glyphs actually affect layout.
    const ro = wrap ? new ResizeObserver(relayout) : null;
    ro?.observe(wrap!);
    window.addEventListener("resize", relayout);
    document.fonts?.ready?.then(relayout);

    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener("resize", relayout);
    };
  }, [language]);

  useEffect(() => {
    const route = routeRef.current;
    if (!route) return;
    if (!effPathDrawn) {
      drawStateRef.current = "hidden";
      layoutPath();
      return;
    }
    if (reduced) {
      drawStateRef.current = "drawn";
      layoutPath();
      return;
    }
    drawStateRef.current = "hidden";
    layoutPath();
    drawStateRef.current = "drawing";
    const frame = requestAnimationFrame(() => {
      route.style.transition = "stroke-dashoffset 2.2s cubic-bezier(.35,.55,.2,1)";
      route.style.strokeDashoffset = "0";
    });
    const settle = setTimeout(() => {
      drawStateRef.current = "drawn";
    }, 2300);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [effPathDrawn, reduced]);

  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    const anchor = anchorRef.current;
    if (!section || !anchor) return;

    let armed = true;
    let runId = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const pause = (ms: number, id: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      }).then(() => id === runId);

    async function run() {
      const id = ++runId;
      reset();
      if (!(await pause(400, id))) return;

      for (const token of tokens) {
        for (let i = token.start + 1; i <= token.end; i++) {
          setTypedCount(i);
          if (!(await pause(token.mark ? 34 : 22, id))) return;
        }
      }
      setCaretDone(true);
      if (!(await pause(420, id))) return;

      setParseOn(true);
      for (let i = 1; i <= markTokens.length; i++) {
        setMarkedCount(i);
        if (!(await pause(230, id))) return;
      }
      if (!(await pause(180, id))) return;
      setParseLabel(c.parseDetails(markTokens.length));
      setParseSettled(true);
      if (!(await pause(320, id))) return;

      for (let i = 1; i <= markTokens.length; i++) {
        setLiftedCount(i);
        if (!(await pause(150, id))) return;
      }
      if (!(await pause(280, id))) return;

      setParseLabel(c.parseAgencies(c.agencies.length));
      for (let i = 1; i <= c.agencies.length; i++) {
        setAgenciesShown(i);
        if (!(await pause(70, id))) return;
      }
      if (!(await pause(360, id))) return;

      setParseLabel(c.parseMapped);
      setPathDrawn(true);
      for (let i = 1; i <= c.path.length; i++) {
        setStepsShown(i);
        if (!(await pause(430, id))) return;
      }
      if (!(await pause(300, id))) return;
      setCtaShown(true);
    }

    const player = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && armed) {
          armed = false;
          run();
        }
      },
      // Hold off until the section has actually scrolled up into view, rather
      // than the instant it peeks over the bottom edge. On a tall phone
      // viewport the sentence sits within the first screen, so an edge-only
      // trigger starts the sequence at page load — and it is over by the time
      // you have scrolled down far enough to watch it.
      { threshold: 0, rootMargin: "0px 0px -50% 0px" },
    );
    player.observe(anchor);

    const rearm = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && !armed) {
          armed = true;
          runId++;
          timers.splice(0).forEach(clearTimeout);
          reset();
        }
      },
      { threshold: 0 },
    );
    rearm.observe(section);

    return () => {
      runId++;
      timers.splice(0).forEach(clearTimeout);
      player.disconnect();
      rearm.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, language]);

  function startExample() {
    router.push("/?entry=new-business");
  }

  return (
    <section id="how-it-works" ref={sectionRef} className={styles.pin}>
      <div className={styles.frame}>
        <h2 className={styles.heading}>{c.mapped}</h2>

        {/* Full sentence for assistive tech / no-JS; the animated version below is aria-hidden. */}
        <p className={styles.srOnly}>{c.sentence}</p>

        <div ref={anchorRef} className={styles.sentence} aria-hidden="true">
          {tokens.map((token, i) => {
            const markIndex = markTokens.indexOf(token);
            const revealed = token.text.slice(0, Math.max(0, effTypedCount - token.start));
            if (!revealed) return null;
            const isMarked = token.mark && markIndex < effMarkedCount;
            const isLifted = token.mark && markIndex < effLiftedCount;
            return (
              <span
                key={i}
                className={
                  token.mark
                    ? `${styles.tok} ${styles.key} ${isMarked ? styles.marked : ""} ${isLifted ? styles.lifted : ""}`
                    : styles.tok
                }
              >
                {revealed}
              </span>
            );
          })}
          <span className={`${styles.caret} ${effCaretDone ? styles.caretDone : ""}`} />
        </div>

        <div
          className={`${styles.parse} ${effParseOn ? styles.on : ""} ${effParseSettled ? styles.settled : ""}`}
          aria-hidden="true"
        >
          <span className={styles.pulse} />
          <span>{effParseLabel}</span>
        </div>

        <div className={styles.chips} aria-hidden="true">
          {c.chips.map((label, i) => (
            <div key={label} className={`${styles.chip} ${i < effLiftedCount ? styles.in : ""}`}>
              {label}
            </div>
          ))}
        </div>

        <p className={styles.agencies}>
          {c.agencies.map((agency, i) => (
            <span key={agency} className={`${styles.ag} ${i < effAgenciesShown ? styles.in : ""}`}>
              {agency}
              {i < c.agencies.length - 1 ? <span className={styles.dot}>•</span> : null}
            </span>
          ))}
        </p>

        <div ref={wrapRef} className={styles.stepsWrap}>
          <svg ref={svgRef} className={styles.pathSvg} aria-hidden="true">
            <path ref={routeRef} className={styles.route} />
            {c.path.slice(0, -1).map((_, i) => (
              <path
                key={i}
                ref={(el) => {
                  arrowRefs.current[i] = el;
                }}
                className={`${styles.arrow} ${i < effStepsShown - 1 ? styles.show : ""}`}
              />
            ))}
          </svg>
          <ol className={styles.steps}>
            {c.path.map((step, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <li key={step.title} className={`${styles.step} ${i < effStepsShown ? styles.in : ""}`}>
                  <div
                    className={styles.node}
                    ref={(el) => {
                      nodeRefs.current[i] = el;
                    }}
                  >
                    <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </li>
              );
            })}
          </ol>
        </div>

        <div className={styles.cta}>
          <button type="button" className={effCtaShown ? styles.in : ""} onClick={startExample}>
            {c.cta}
          </button>
        </div>
      </div>
    </section>
  );
}
