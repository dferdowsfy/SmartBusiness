"use client";

import { CloudUpload, Info, Map, MessageCircle, Shield, SquarePen } from "lucide-react";

export interface RequirementsSidebarProps {
  language: "en" | "es";
  readinessPct: number;
  totalCount: number;
  completedCount: number;
  todoCount: number;
  fillOutCount: number;
  onChat?: () => void;
  onViewRoadmap?: () => void;
}

const copy = {
  en: {
    readiness: "Submission Readiness",
    requirementsLabel: (n: number) => `${n} requirement${n === 1 ? "" : "s"}`,
    completed: "Completed",
    todo: "To Do",
    fillOut: "To Fill Out",
    whereTitle: "Where to Take Action",
    uploadTitle: "Upload Documents",
    uploadBody: "For items you already have.",
    formsTitle: "SmartPR Forms",
    formsBody: "We'll guide you through government forms and prefill what we can.",
    learnMore: "Learn more",
    helpTitle: "Need Help?",
    chatTitle: "Chat with SmartPR",
    chatBody: "Get help from our support team.",
    roadmapTitle: "View Your Roadmap",
    roadmapBody: "See all permits and licensing steps.",
    secureTitle: "Your information is secure",
    secureBody: "We use bank-level encryption to protect your data.",
  },
  es: {
    readiness: "Preparación para radicar",
    requirementsLabel: (n: number) => `${n} requisito${n === 1 ? "" : "s"}`,
    completed: "Completados",
    todo: "Por hacer",
    fillOut: "Por llenar",
    whereTitle: "Dónde tomar acción",
    uploadTitle: "Subir documentos",
    uploadBody: "Para lo que ya tienes.",
    formsTitle: "Formularios de SmartPR",
    formsBody: "Te guiamos por los formularios del gobierno y pre-llenamos lo que podamos.",
    learnMore: "Más información",
    helpTitle: "¿Necesitas ayuda?",
    chatTitle: "Chatea con SmartPR",
    chatBody: "Recibe ayuda de nuestro equipo de soporte.",
    roadmapTitle: "Ver tu ruta",
    roadmapBody: "Ve todos los permisos y pasos de licencias.",
    secureTitle: "Tu información está segura",
    secureBody: "Usamos encriptación de nivel bancario para proteger tus datos.",
  },
} as const;

export function RequirementsSidebar({
  language,
  readinessPct,
  totalCount,
  completedCount,
  todoCount,
  fillOutCount,
  onChat,
  onViewRoadmap,
}: RequirementsSidebarProps) {
  const c = copy[language];
  const pct = Math.max(0, Math.min(100, Math.round(readinessPct)));

  return (
    <aside className="rq-sidebar" aria-label={c.readiness}>
      <div className="rq-side-card">
        <div className="rq-side-head">
          <span>{c.readiness}</span>
          <Info size={14} />
        </div>
        <div className="rq-readiness-pct">{pct}%</div>
        <div className="rq-readiness-sub">{c.requirementsLabel(totalCount)}</div>
        <div className="rq-progress-track">
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="rq-readiness-metrics">
          <div>
            <strong>{completedCount}</strong>
            <span>{c.completed}</span>
          </div>
          <div>
            <strong>{todoCount}</strong>
            <span>{c.todo}</span>
          </div>
          <div>
            <strong>{fillOutCount}</strong>
            <span>{c.fillOut}</span>
          </div>
        </div>
      </div>

      <div className="rq-side-card">
        <h4 className="rq-side-title">{c.whereTitle}</h4>
        <div className="rq-where-row">
          <span className="rq-where-icon rq-where-green">
            <CloudUpload size={16} />
          </span>
          <div>
            <strong>{c.uploadTitle}</strong>
            <p>{c.uploadBody}</p>
          </div>
        </div>
        <div className="rq-where-row">
          <span className="rq-where-icon rq-where-amber">
            <SquarePen size={16} />
          </span>
          <div>
            <strong>{c.formsTitle}</strong>
            <p>{c.formsBody}</p>
          </div>
        </div>
      </div>

      <div className="rq-side-card">
        <h4 className="rq-side-title">{c.helpTitle}</h4>
        <button type="button" className="rq-help-row" onClick={onChat}>
          <span className="rq-help-icon">
            <MessageCircle size={16} />
          </span>
          <div>
            <strong>{c.chatTitle}</strong>
            <p>{c.chatBody}</p>
          </div>
        </button>
        <button type="button" className="rq-help-row" onClick={onViewRoadmap}>
          <span className="rq-help-icon">
            <Map size={16} />
          </span>
          <div>
            <strong>{c.roadmapTitle}</strong>
            <p>{c.roadmapBody}</p>
          </div>
        </button>
      </div>

      <div className="rq-side-card rq-security">
        <span className="rq-security-icon">
          <Shield size={16} />
        </span>
        <div>
          <strong>{c.secureTitle}</strong>
          <p>{c.secureBody}</p>
        </div>
      </div>
    </aside>
  );
}
