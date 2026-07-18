"use client";

// ============================================================================
// Shared visual primitives for the Regulatory Knowledge Graph admin.
// Extracted from the original single-file page so every tab reuses one look.
// ============================================================================

import type { NodeStatus } from "../../rk/types";

export const COLORS = {
  bg: "#0b1220",
  panel: "#101a2e",
  panel2: "#0f1626",
  border: "#1e2a44",
  text: "#e8eef7",
  dim: "#94a3b8",
  faint: "#64748b",
  accent: "#3b82f6",
  green: "#10b981",
  amber: "#f59e0b",
  purple: "#8b5cf6",
  red: "#ef4444",
};

// Node colors per layer of the knowledge graph (extended with rk node types).
export const LAYER = {
  municipality: "#06b6d4",
  industry: "#8b5cf6",
  businessType: "#3b82f6",
  question: "#f59e0b",
  rule: "#ec4899",
  document: "#10b981",
  validation: "#a16207",
  readiness: "#22c55e",
};

export function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ background: (color || COLORS.faint) + "22", color: color || COLORS.dim, border: `1px solid ${color || COLORS.faint}55`, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600, display: "inline-block", margin: "2px 4px 2px 0", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderTop: accent ? `3px solid ${accent}` : undefined, borderRadius: 12, padding: 18, marginBottom: 16 }}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, color }: { children: React.ReactNode; color?: string }) {
  return <div style={{ color: color || COLORS.text, fontWeight: 700, fontSize: 14, marginBottom: 12, letterSpacing: 0.2 }}>{children}</div>;
}

export const selectStyle: React.CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  background: COLORS.panel2,
  color: COLORS.text,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  width: "100%",
};

export const inputStyle: React.CSSProperties = { ...selectStyle };

export const labelStyle: React.CSSProperties = {
  display: "block",
  color: COLORS.dim,
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

export function Btn({
  children,
  onClick,
  primary,
  danger,
  disabled,
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const color = danger ? COLORS.red : primary ? COLORS.accent : COLORS.faint;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: primary || danger ? color + "2b" : COLORS.panel2,
        color: danger ? "#fca5a5" : primary ? "#bfdbfe" : COLORS.dim,
        border: `1px solid ${color}${primary || danger ? "" : "44"}`,
        borderRadius: 8,
        padding: small ? "5px 10px" : "9px 16px",
        fontSize: small ? 12 : 13.5,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

// Status badges per spec: Active / Proposed / Pending review / Conflicting /
// Expired / Superseded / Missing source.
export const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: COLORS.green },
  proposed: { label: "Proposed", color: COLORS.purple },
  draft: { label: "Draft", color: COLORS.amber },
  needs_review: { label: "Pending review", color: COLORS.amber },
  under_review: { label: "Pending review", color: COLORS.amber },
  ai_extracted: { label: "AI extracted", color: COLORS.amber },
  legal_review: { label: "Legal review", color: "#f97316" },
  accepted: { label: "Accepted", color: "#22c55e" },
  conflict: { label: "Conflicting", color: COLORS.red },
  rejected: { label: "Rejected", color: COLORS.faint },
  deferred: { label: "Deferred", color: COLORS.faint },
  merged: { label: "Merged", color: COLORS.faint },
  expired: { label: "Expired", color: COLORS.red },
  superseded: { label: "Superseded", color: COLORS.faint },
  archived: { label: "Archived", color: COLORS.faint },
  rolled_back: { label: "Rolled back", color: COLORS.faint },
  published: { label: "Published", color: COLORS.green },
  approved: { label: "Approved", color: "#22c55e" },
  scheduled: { label: "Scheduled", color: "#38bdf8" },
  missing_source: { label: "Missing source", color: COLORS.red },
};

export function StatusBadge({ status }: { status: NodeStatus | string }) {
  const meta = STATUS_BADGE[status] ?? { label: status, color: COLORS.faint };
  return <Pill color={meta.color}>{meta.label}</Pill>;
}

/** Global stylesheet for the admin (tabs, graph columns, animations). */
export const KB_CSS = `
  .kbadmin .kb-tabs {
    display: flex; gap: 8px; flex-wrap: wrap;
    padding-bottom: 12px; margin-bottom: 22px;
    border-bottom: 1px solid ${COLORS.border};
  }
  .kbadmin .kb-tab {
    flex: 0 0 auto; white-space: nowrap;
    border: 1px solid ${COLORS.border}; border-radius: 999px;
    padding: 8px 16px; cursor: pointer; font-size: 13.5px;
    background: ${COLORS.panel2}; color: ${COLORS.faint}; font-weight: 500;
    transition: all .12s ease;
  }
  .kbadmin .kb-tab:hover { color: ${COLORS.text}; border-color: ${COLORS.accent}66; }
  .kbadmin .kb-tab.active {
    background: ${COLORS.accent}22; color: ${COLORS.text};
    border-color: ${COLORS.accent}; font-weight: 700;
  }
  .kbadmin .kg-columns {
    display: flex; gap: 18px; overflow: visible;
    padding: 8px 4px 12px;
    background:
      radial-gradient(900px 220px at 50% 0%, ${COLORS.accent}10, transparent 60%),
      radial-gradient(700px 200px at 50% 100%, ${LAYER.document}10, transparent 60%);
    border-radius: 12px;
  }
  .kbadmin .kg-col { transition: opacity .25s ease; }
  .kbadmin .kg-col.locked { opacity: 0.55; }
  .kbadmin .kg-col.ready .kg-col-body { animation: kgReveal .28s ease both; }
  .kbadmin .kg-col-body > * { animation: kgNodeIn .28s ease both; }
  .kbadmin .kg-col-body > *:nth-child(1) { animation-delay: 0ms; }
  .kbadmin .kg-col-body > *:nth-child(2) { animation-delay: 20ms; }
  .kbadmin .kg-col-body > *:nth-child(3) { animation-delay: 40ms; }
  .kbadmin .kg-col-body > *:nth-child(4) { animation-delay: 60ms; }
  .kbadmin .kg-col-body > *:nth-child(n+5) { animation-delay: 80ms; }
  @keyframes kgReveal {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes kgNodeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .kbadmin .kg-canvas path { will-change: stroke-opacity, stroke-width; }
  .kbadmin .kg-path { display: none; }
  .kbadmin .kb-split { display: grid; gap: 24px; }
  .kbadmin .kb-split.s300 { grid-template-columns: 300px 1fr; }
  .kbadmin .kb-split.s360 { grid-template-columns: 360px 1fr; }
  .kbadmin .kb-split.detail { grid-template-columns: minmax(0, 1fr) 380px; align-items: start; }
  @media (max-width: 980px) {
    .kbadmin .kb-split.detail { grid-template-columns: 1fr; }
  }
  @media (max-width: 760px) {
    .kbadmin .kb-tabs {
      flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch;
      scrollbar-width: none; gap: 8px;
    }
    .kbadmin .kb-tabs::-webkit-scrollbar { display: none; }
    .kbadmin .kg-columns { flex-direction: column; overflow-x: visible; gap: 14px; }
    .kbadmin .kg-col { min-width: 0 !important; width: 100% !important; flex: none !important; }
    .kbadmin .kb-split.s300, .kbadmin .kb-split.s360 { grid-template-columns: 1fr; gap: 16px; }
    .kbadmin .kg-path {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      position: sticky; top: 0; z-index: 5;
      background: ${COLORS.bg}; padding: 8px 0; margin-bottom: 4px;
      font-size: 12px; color: ${COLORS.dim};
      border-bottom: 1px solid ${COLORS.border};
    }
  }
`;
