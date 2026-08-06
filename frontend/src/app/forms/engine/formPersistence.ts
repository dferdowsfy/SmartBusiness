// ============================================================================
// Draft / prepared-application persistence (Part 16).
//
// Structured data is the durable source of truth — never an ephemeral Blob URL.
// Supabase is used when configured; otherwise a localStorage fallback keeps
// local development working. Both paths store the same JSON shape so previews
// can always be regenerated from structured data after a refresh.
// ============================================================================

import type {
  CanonicalApplicationData,
  FormData,
  GeneratedApplication,
} from "./types.ts";

const CANONICAL_KEY = "smartpr-canonical-application";
const DRAFTS_KEY = "smartpr-form-drafts";
const APPS_KEY = "smartpr-generated-applications";

export interface PersistedState {
  canonical: CanonicalApplicationData | null;
  drafts: Record<string, FormData>;
  applications: GeneratedApplication[];
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

// --- Local storage fallback (dev) -----------------------------------------

export function loadCanonicalLocal(): CanonicalApplicationData | null {
  if (!hasLocalStorage()) return null;
  return safeParse<CanonicalApplicationData | null>(window.localStorage.getItem(CANONICAL_KEY), null);
}

export function saveCanonicalLocal(data: CanonicalApplicationData): void {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(CANONICAL_KEY, JSON.stringify(data));
}

export function loadDraftsLocal(): Record<string, FormData> {
  if (!hasLocalStorage()) return {};
  return safeParse<Record<string, FormData>>(window.localStorage.getItem(DRAFTS_KEY), {});
}

export function saveDraftLocal(formId: string, data: FormData): void {
  if (!hasLocalStorage()) return;
  const all = loadDraftsLocal();
  all[formId] = data;
  window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
}

export function loadApplicationsLocal(): GeneratedApplication[] {
  if (!hasLocalStorage()) return [];
  return safeParse<GeneratedApplication[]>(window.localStorage.getItem(APPS_KEY), []);
}

export function saveApplicationsLocal(apps: GeneratedApplication[]): void {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(APPS_KEY, JSON.stringify(apps));
}

export function upsertApplicationLocal(app: GeneratedApplication): GeneratedApplication[] {
  const apps = loadApplicationsLocal();
  const idx = apps.findIndex((a) => a.id === app.id);
  if (idx >= 0) apps[idx] = app;
  else apps.push(app);
  saveApplicationsLocal(apps);
  return apps;
}

// --- Supabase-backed persistence (optional) --------------------------------

/**
 * When Supabase is configured, the caller passes a client-bound saver. This
 * indirection keeps this module free of a hard Supabase dependency so it can be
 * imported by node:test. The API route `/api/deliverables` already exists for
 * durable storage; a follow-up can point these hooks at it.
 */
export interface RemotePersistence {
  saveCanonical(data: CanonicalApplicationData): Promise<void>;
  saveApplication(app: GeneratedApplication): Promise<void>;
  loadState(): Promise<PersistedState>;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    typeof process !== "undefined" &&
      process.env &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Load the full persisted state, preferring remote when available. */
export async function loadPersistedState(remote?: RemotePersistence): Promise<PersistedState> {
  if (remote && isSupabaseConfigured()) {
    try {
      return await remote.loadState();
    } catch {
      /* fall through to local */
    }
  }
  return {
    canonical: loadCanonicalLocal(),
    drafts: loadDraftsLocal(),
    applications: loadApplicationsLocal(),
  };
}

/**
 * Concrete Supabase-backed persistence built on the app's existing workflow
 * snapshot endpoint (`/api/snapshots/:id`). The government-form state (canonical
 * profile + drafts + prepared applications) travels inside the same `state`
 * blob the rest of the intake flow already persists, so signed-in users resume
 * exact mid-flow state. Local storage remains the dev fallback.
 */
export function snapshotRemotePersistence(submissionId: string): RemotePersistence {
  const url = `/api/snapshots/${submissionId}`;
  const readState = async (): Promise<Record<string, unknown>> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`snapshot ${res.status}`);
    const snap = await res.json();
    return (snap.state as Record<string, unknown>) ?? {};
  };
  const writeState = async (patch: Record<string, unknown>): Promise<void> => {
    let current: Record<string, unknown> = {};
    try {
      current = await readState();
    } catch {
      /* first write — no snapshot yet */
    }
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: { ...current, ...patch } }),
    });
  };
  return {
    async saveCanonical(data) {
      await writeState({ canonicalApplication: data });
    },
    async saveApplication(app) {
      const state = await readState().catch(() => ({}) as Record<string, unknown>);
      const prepared = { ...((state.preparedGovApplications as Record<string, unknown>) ?? {}), [app.formId]: app };
      await writeState({ preparedGovApplications: prepared });
    },
    async loadState() {
      const state = await readState();
      return {
        canonical: (state.canonicalApplication as PersistedState["canonical"]) ?? null,
        drafts: (state.govFormDrafts as PersistedState["drafts"]) ?? {},
        applications: Object.values((state.preparedGovApplications as Record<string, PersistedState["applications"][number]>) ?? {}),
      };
    },
  };
}
