"use client";

import type { ReactNode } from "react";
import { CheckCircle2, ChevronRight, Clock, Upload } from "lucide-react";
import type { IconTone } from "./requirementCopy";

export type RequirementActionKind = "upload" | "form" | "waiting" | "completed" | "none";

export interface RequirementAction {
  kind: RequirementActionKind;
  label: string;
  helper?: string;
  onClick?: () => void;
}

export interface RequirementSecondaryAction {
  /** e.g. "Already have your EIN?" */
  prompt: string;
  /** e.g. "Upload EIN confirmation" */
  label: string;
  onClick: () => void;
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
  /** "Already have this? Upload ___" — shown under the primary action
   * whenever SmartPR can prepare the requirement for the user but the user
   * may also already hold the document. Omitted once the requirement is
   * completed, or when upload is already the primary (only) action. */
  secondary?: RequirementSecondaryAction;
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

  const isForm = action.kind === "form";
  const className = `rq-cta rq-cta-${action.kind}`;

  return (
    <button type="button" className={className} onClick={action.onClick}>
      {action.kind === "upload" && <Upload size={15} />}
      <span>{action.label}</span>
      {isForm && <ChevronRight size={15} />}
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
  secondary,
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
          {action.helper && (action.kind === "form" || action.kind === "upload") && (
            <span className="rq-cta-helper">{action.helper}</span>
          )}
          {secondary && action.kind !== "completed" && (
            <div className="rq-secondary">
              <span className="rq-secondary-prompt">{secondary.prompt}</span>
              <button type="button" className="rq-secondary-link" onClick={secondary.onClick}>
                {secondary.label}
              </button>
            </div>
          )}
        </div>
      </div>

      {extra && <div className="rq-card-extra">{extra}</div>}
    </div>
  );
}
