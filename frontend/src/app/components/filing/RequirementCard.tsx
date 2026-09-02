"use client";

import type { ReactNode } from "react";
import { CheckCircle2, ChevronRight, Clock, ExternalLink, Upload } from "lucide-react";
import type { IconTone } from "./requirementCopy";

export type RequirementActionKind = "upload" | "form" | "external" | "waiting" | "completed" | "none";

export interface RequirementAction {
  kind: RequirementActionKind;
  label: string;
  helper?: string;
  onClick?: () => void;
  href?: string;
  /** Only meaningful for kind "external": outline color. */
  tone?: "green" | "blue";
}

export interface RequirementBadge {
  label: string;
  tone: "amber" | "blue" | "gray";
}

export interface RequirementCardProps {
  index: number;
  icon: ReactNode;
  iconTone: IconTone;
  name: string;
  agency?: string | null;
  description: string;
  badge?: RequirementBadge | null;
  whyLabel: string;
  why: ReactNode;
  action: RequirementAction;
  /** Extraction panels, AI findings, multi-stage processing — rendered full
   * width below the card's three zones, unchanged in substance from before. */
  extra?: ReactNode;
  id?: string;
}

function ActionButton({ action }: { action: RequirementAction }) {
  if (action.kind === "completed") {
    return (
      <span className="rq-completed">
        <CheckCircle2 size={15} /> {action.label}
      </span>
    );
  }
  if (action.kind === "waiting") {
    return (
      <span className="rq-waiting">
        <Clock size={15} /> {action.label}
      </span>
    );
  }
  if (action.kind === "none") return null;

  const isExternal = action.kind === "external";
  const isForm = action.kind === "form";
  const className = `rq-cta rq-cta-${action.kind}${isExternal && action.tone ? ` rq-cta-${action.tone}` : ""}`;

  const content = (
    <>
      {action.kind === "upload" && <Upload size={15} />}
      <span>{action.label}</span>
      {(isForm || isExternal) && <ChevronRight size={15} />}
      {isExternal && <ExternalLink size={13} className="rq-cta-ext-icon" />}
    </>
  );

  if (isExternal && action.href) {
    return (
      <a className={className} href={action.href} target="_blank" rel="noreferrer" onClick={action.onClick}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={action.onClick}>
      {content}
    </button>
  );
}

export function RequirementCard({
  index,
  icon,
  iconTone,
  name,
  agency,
  description,
  badge,
  whyLabel,
  why,
  action,
  extra,
  id,
}: RequirementCardProps) {
  return (
    <div id={id} className="rq-card">
      <div className="rq-card-row">
        <div className="rq-card-left">
          <span className="rq-card-num">{index}</span>
          <span className={`rq-card-icon rq-icon-${iconTone}`}>{icon}</span>
        </div>

        <div className="rq-card-center">
          <div className="rq-card-title-row">
            <h3>{name}</h3>
            {badge && <span className={`rq-badge rq-badge-${badge.tone}`}>{badge.label}</span>}
          </div>
          {agency && <span className="tag agency">{agency}</span>}
          <p className="rq-card-desc">{description}</p>
          <details className="rq-why">
            <summary>
              {whyLabel} <ChevronRight size={13} className="rq-why-chevron" />
            </summary>
            <div className="rq-why-body">{why}</div>
          </details>
        </div>

        <div className="rq-card-right">
          <ActionButton action={action} />
          {action.helper && action.kind !== "completed" && <span className="rq-cta-helper">{action.helper}</span>}
        </div>
      </div>

      {extra && <div className="rq-card-extra">{extra}</div>}
    </div>
  );
}
