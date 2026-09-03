"use client";

import type { ReactNode } from "react";
import { CheckCircle2, ChevronDown, ClipboardList, Clock, CloudUpload, ArrowRight, Upload } from "lucide-react";
import type { IconTone } from "./requirementCopy";

export type RequirementActionKind = "upload" | "form" | "waiting" | "completed" | "none";

export interface RequirementAction {
  kind: RequirementActionKind;
  label: string;
  helper?: string;
  onClick?: () => void;
}

export interface RequirementSecondaryAction {
  /** Accessible label only (e.g. "Already have your EIN?") — the visible
   * button text is just `label`, matching the reference design's quiet
   * "OR [upload button]" pattern rather than a restated question. */
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
  /** "OR [Upload ___]" — shown under the primary action whenever SmartPR can
   * prepare the requirement for the user but the user may also already hold
   * the document. Omitted once the requirement is completed, or when upload
   * is already the primary (only) action. */
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

  return (
    <button type="button" className={`rq-cta rq-cta-${action.kind}`} onClick={action.onClick}>
      {action.kind === "upload" && <Upload size={15} />}
      {isForm && <ClipboardList size={15} />}
      <span>{action.label}</span>
      {isForm && <ArrowRight size={15} />}
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
            {agency && <span className="tag agency">{agency}</span>}
            {badge && <span className={`rq-badge rq-badge-${badge.tone}`}>{badge.label}</span>}
          </div>
          <p className="rq-card-desc">{description}</p>
          <details className="rq-why">
            <summary>
              {whyLabel} <ChevronDown size={13} className="rq-why-chevron" />
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
            <>
              <span className="rq-or">OR</span>
              <button type="button" className="rq-secondary-btn" onClick={secondary.onClick} aria-label={secondary.prompt}>
                <CloudUpload size={15} />
                <span>{secondary.label}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {extra && <div className="rq-card-extra">{extra}</div>}
    </div>
  );
}
