"use client";

// ============================================================================
// Graph data hook: API-first (/api/rk/graph), static-fallback.
//
// When the database is unavailable (or the API errors), the graph falls back
// to the bundled KB via the same pure seed builder the server uses — so the
// admin always renders, just read-only.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSeedNodes } from "../../../rk/seed-data";
import { NODE_TYPE_CONFIGS } from "../../../rk/registry";
import type { GraphEdgeDTO, GraphMode, GraphNodeDTO, GraphResponse } from "../../../rk/types";

function staticGraph(mode: GraphMode): GraphResponse {
  const nodes: GraphNodeDTO[] = buildSeedNodes().map((n) => ({
    rowId: null,
    entityId: n.entityId,
    nodeType: n.nodeType,
    label: n.label,
    status: "active",
    version: 1,
    data: n.data,
    sourceId: null,
  }));
  const present = new Set(nodes.map((n) => n.entityId));
  const edges: GraphEdgeDTO[] = [];
  const counts: Record<string, number> = {};
  for (const n of nodes) {
    counts[n.nodeType] = (counts[n.nodeType] ?? 0) + 1;
    for (const e of NODE_TYPE_CONFIGS[n.nodeType].edgesOf(n.data)) {
      if (present.has(e.toEntity)) {
        edges.push({ fromEntity: n.entityId, toEntity: e.toEntity, edgeType: e.edgeType });
      }
    }
  }
  return { enabled: false, mode, nodes, edges, counts };
}

export interface GraphData {
  graph: GraphResponse | null;
  /** false = static fallback (no database) — editing disabled */
  enabled: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** entityId -> node for quick lookups */
  byEntity: Map<string, GraphNodeDTO>;
}

export function useGraphData(mode: GraphMode): GraphData {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const gen = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rk/graph?mode=${mode}`);
      if (gen !== generation.current) return;
      if (res.ok) {
        const data = (await res.json()) as GraphResponse;
        if (gen !== generation.current) return;
        if (data.enabled) {
          setGraph(data);
          setLoading(false);
          return;
        }
      }
      // 403 / 500 / disabled -> static fallback
      setGraph(staticGraph(mode));
      if (!res.ok) setError(`graph API returned ${res.status}; showing bundled knowledge base`);
      setLoading(false);
    } catch {
      if (gen !== generation.current) return;
      setGraph(staticGraph(mode));
      setError("graph API unreachable; showing bundled knowledge base");
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch lifecycle: loading flag must flip when the mode changes
    void load();
  }, [load]);

  const byEntity = useMemo(() => {
    const m = new Map<string, GraphNodeDTO>();
    for (const n of graph?.nodes ?? []) m.set(n.entityId, n);
    return m;
  }, [graph]);

  return {
    graph,
    enabled: graph?.enabled ?? false,
    loading,
    error,
    refresh: () => void load(),
    byEntity,
  };
}
