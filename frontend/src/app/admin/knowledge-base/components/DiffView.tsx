"use client";

// Field-level side-by-side diff: current rule vs proposed rule.
import { COLORS } from "../ui";

const fmt = (v: unknown): string => {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
};

export function DiffView({
  current,
  proposed,
}: {
  current: Record<string, unknown> | null;
  proposed: Record<string, unknown> | null;
}) {
  const keys = [...new Set([...Object.keys(current ?? {}), ...Object.keys(proposed ?? {})])].filter(
    (k) => k !== "id"
  );
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", color: COLORS.faint, fontWeight: 600, padding: "4px 8px", width: "18%" }}>Field</th>
            <th style={{ textAlign: "left", color: COLORS.faint, fontWeight: 600, padding: "4px 8px", width: "41%" }}>Current rule</th>
            <th style={{ textAlign: "left", color: COLORS.faint, fontWeight: 600, padding: "4px 8px", width: "41%" }}>Proposed rule</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const a = fmt(current?.[k]);
            const b = fmt(proposed?.[k]);
            const changed = a !== b;
            return (
              <tr key={k} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <td style={{ color: changed ? COLORS.text : COLORS.faint, fontWeight: changed ? 700 : 400, padding: "5px 8px", verticalAlign: "top" }}>{k}</td>
                <td style={{ color: changed ? "#fca5a5" : COLORS.dim, padding: "5px 8px", verticalAlign: "top", whiteSpace: "pre-wrap", wordBreak: "break-word", background: changed ? COLORS.red + "0d" : undefined }}>{a}</td>
                <td style={{ color: changed ? "#a7f3d0" : COLORS.dim, padding: "5px 8px", verticalAlign: "top", whiteSpace: "pre-wrap", wordBreak: "break-word", background: changed ? COLORS.green + "0d" : undefined }}>{b}</td>
              </tr>
            );
          })}
          {keys.length === 0 && (
            <tr><td colSpan={3} style={{ color: COLORS.faint, padding: 8 }}>No field data (archive proposal).</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
