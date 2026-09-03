"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface ReadinessControlProps {
  language: "en" | "es";
  pct: number;
  total: number;
  completed: number;
  needsAction: number;
  inProgress: number;
}

const copy = {
  en: {
    ready: "ready",
    remaining: "remaining",
    total: "total requirements",
    needsAction: "need action",
    inProgress: "in progress",
    completed: "completed",
  },
  es: {
    ready: "listo",
    remaining: "restantes",
    total: "requisitos totales",
    needsAction: "necesitan acción",
    inProgress: "en progreso",
    completed: "completados",
  },
} as const;

/** Compact readiness summary that replaces the old persistent sidebar on the
 * Requirements page — "40% ready [bar] 14 remaining [chevron]" — with a
 * details popover behind the chevron. Sticky on its own so it stays in view
 * while the (non-sticky) page header scrolls away normally. */
export function ReadinessControl({ language, pct, total, completed, needsAction, inProgress }: ReadinessControlProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const c = copy[language];
  const clampedPct = Math.max(0, Math.min(100, Math.round(pct)));
  const remaining = needsAction + inProgress;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="rq-readiness-control" ref={ref}>
      <button
        type="button"
        className="rq-readiness-summary"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`${clampedPct}% ${c.ready}, ${remaining} ${c.remaining}`}
      >
        <strong>{clampedPct}%</strong>
        <span className="rq-readiness-word">{c.ready}</span>
        <span className="rq-readiness-bar">
          <span style={{ width: `${clampedPct}%` }} />
        </span>
        <span className="rq-readiness-word">{remaining} {c.remaining}</span>
        <span className="rq-readiness-chevron">
          <ChevronDown size={14} />
        </span>
      </button>
      {open && (
        <div className="rq-readiness-pop" role="dialog">
          <div><strong>{total}</strong><span>{c.total}</span></div>
          <div><strong>{needsAction}</strong><span>{c.needsAction}</span></div>
          <div><strong>{inProgress}</strong><span>{c.inProgress}</span></div>
          <div><strong>{completed}</strong><span>{c.completed}</span></div>
        </div>
      )}
    </div>
  );
}
