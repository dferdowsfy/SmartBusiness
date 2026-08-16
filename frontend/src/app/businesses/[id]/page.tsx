"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Bell, CalendarDays, CheckCircle2, FileClock, FileText, FolderOpen, Plus, ShieldAlert } from "lucide-react";
import { TopNav, ScorePill, fmtDate, fmtDateTime } from "../../history/ui";
import { StatusBadge } from "../../components/compliance/StatusBadge";
import { DUE_DATE_UNKNOWN_MESSAGE, type DueDateSource, type ObligationStatus } from "../../compliance/types";

interface BusinessRecord {
  id: string; name: string; legal_name: string | null; entity_number: string | null;
  municipality: string | null; business_type: string | null; onboarding_mode: "NEW" | "EXISTING";
}
interface Matter { id: string; matter_type: string; title: string; status: string; readiness_score: number | null; opened_at: string; completed_at: string | null; submission_id: string | null; due_date: string | null; due_date_source: DueDateSource; source_reference: string | null }
interface Obligation { id: string; name: string; agency: string | null; matter_title: string | null; status: ObligationStatus; due_date: string | null; due_date_source: DueDateSource; source_reference: string | null; next_action: string }
interface Evidence { id: string; original_filename: string; obligation_name: string | null; review_status: string; created_at: string }
interface Submission { id: string; created_at: string; business_type: string | null; municipality: string | null; readiness_score: number | null }
interface Deliverable { id: string; filename: string; kind: string; generated_at: string }
interface Notification { id: string; message: string; scheduled_for: string; status: string }

interface Detail {
  business?: BusinessRecord;
  overall_readiness?: number | null;
  matters?: Matter[];
  obligations?: Obligation[];
  evidence?: Evidence[];
  submissions?: Submission[];
  deliverables?: Deliverable[];
  notifications?: Notification[];
  error?: string;
}

function Section({ title, icon, children, count }: { title: string; icon: React.ReactNode; children: React.ReactNode; count?: number }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.02]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-bold text-[#0A2540]">
        {icon}{title}{count != null && <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{count}</span>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function dateLabel(value?: string | null) {
  if (!value) return "Unknown";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ObligationRow({ item, reload }: { item: Obligation; reload: () => void }) {
  const [date, setDate] = useState(item.due_date || "");
  const [source, setSource] = useState<DueDateSource>(item.due_date_source === "UNKNOWN" ? "USER_PROVIDED" : item.due_date_source);
  const [reference, setReference] = useState(item.source_reference || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const update = async (payload: Record<string, unknown>) => {
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/obligations/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setMessage(result.error || "Could not update."); return; }
    reload();
  };
  return (
    <div id={`obligation-${item.id}`} className="rounded-xl border border-slate-200 px-4 py-3">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="min-w-0">
              <div className="font-semibold text-[#0A2540]">{item.name}</div>
          <div className="text-xs text-slate-500">{item.agency || "Agency not recorded"}{item.matter_title ? ` · ${item.matter_title}` : ""}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right"><div className="text-sm font-semibold text-slate-700">{dateLabel(item.due_date)}</div><div className="text-[10px] uppercase tracking-wide text-slate-400">{item.due_date_source.replaceAll("_", " ")}</div></div>
          <StatusBadge status={item.status as ObligationStatus} />
        </div>
      </div>
      {!item.due_date && <p className="mt-2 text-xs text-slate-500">{DUE_DATE_UNKNOWN_MESSAGE}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        <span className="text-xs font-medium text-slate-600">Next: {item.next_action}</span>
        <details className="ml-auto text-xs">
          <summary className="cursor-pointer font-semibold text-[#0D9488]">Update date</summary>
          <div className="mt-2 grid min-w-[270px] gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5" />
            <select value={source} onChange={(event) => setSource(event.target.value as DueDateSource)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5"><option value="USER_PROVIDED">User provided</option><option value="DOCUMENT_EXTRACTED">Document extracted</option><option value="EXTERNALLY_VERIFIED">Externally verified</option><option value="REGULATORY_RULE">Regulatory rule</option></select>
            <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Source reference (required for rules)" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5" />
            <button disabled={busy || !date} onClick={() => update({ due_date: date, due_date_source: source, source_reference: reference || undefined })} className="rounded-lg bg-[#0A2540] px-3 py-1.5 font-semibold text-white disabled:opacity-50">Save verified date</button>
            {message && <span className="text-red-600">{message}</span>}
          </div>
        </details>
        {item.status !== "COMPLETED" && <button disabled={busy} onClick={() => update({ complete: true })} className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50">Mark renewed / complete</button>}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-200 py-7 text-center text-sm text-slate-400">{text}</div>; }

export default function BusinessDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const load = useCallback(() => fetch(`/api/businesses/${id}`).then((response) => response.json()).then(setData), [id]);
  useEffect(() => { void load(); }, [load]);
  const completeMatter = async (matterId: string) => {
    const response = await fetch(`/api/matters/${matterId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    if (response.ok) await load();
  };
  const groups = useMemo(() => {
    const obligations = data?.obligations ?? [];
    const matterCalendar: Obligation[] = (data?.matters ?? []).filter((matter) => matter.due_date && matter.status !== "COMPLETED").map((matter) => ({
      id: `matter-${matter.id}`, name: matter.title, agency: "Filing matter", matter_title: matter.title,
      status: matter.status === "NEEDS_ATTENTION" ? "NEEDS_ATTENTION" : "IN_PROGRESS",
      due_date: matter.due_date, due_date_source: matter.due_date_source,
      source_reference: matter.source_reference, next_action: "Continue filing",
    }));
    return {
      current: obligations.filter((item) => ["CURRENT", "COMPLETED"].includes(item.status)),
      upcoming: obligations.filter((item) => ["UPCOMING", "DUE_SOON", "OVERDUE"].includes(item.status)),
      missing: obligations.filter((item) => ["MISSING", "NEEDS_ATTENTION", "UNKNOWN"].includes(item.status)),
      calendar: [...obligations.filter((item) => item.due_date && item.status !== "COMPLETED"), ...matterCalendar].sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")),
    };
  }, [data]);

  if (!data) return <div className="min-h-screen bg-slate-50"><TopNav active="businesses" /><div className="p-12 text-center text-slate-500">Loading compliance profile…</div></div>;
  if (data.error || !data.business) return <div className="min-h-screen bg-slate-50"><TopNav active="businesses" /><div className="p-12 text-center text-slate-500">Business not found.</div></div>;
  const business = data.business;
  const activeMatters = (data.matters ?? []).filter((matter) => !["COMPLETED", "ARCHIVED"].includes(matter.status));
  const history = (data.matters ?? []).filter((matter) => matter.status === "COMPLETED");

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <TopNav active="businesses" />
      <main className="mx-auto max-w-7xl px-5 py-8">
        <Link href="/businesses" className="text-sm font-semibold text-[#0D9488]">← Businesses</Link>
        <header className="mt-3 rounded-2xl bg-[#0A2540] p-6 text-white shadow-lg shadow-slate-950/10">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-2 flex flex-wrap gap-2 text-xs text-white/60"><span>{business.entity_number || "Entity number not entered"}</span><span>·</span><span>{business.municipality || "Municipality not entered"}</span><span>·</span><span>{business.business_type || "Business type not entered"}</span></div>
              <h1 className="text-3xl font-bold tracking-tight">{business.legal_name || business.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70">Persistent compliance profile · {business.onboarding_mode === "EXISTING" ? "Existing business reconstruction" : "SmartPR formation workflow"}</p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <div className="rounded-xl bg-white/10 px-4 py-3"><div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Overall readiness</div><div className="text-2xl font-extrabold">{data.overall_readiness == null ? "—" : `${data.overall_readiness}%`}</div></div>
              <Link href={`/businesses/${id}/matters/new`} className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Start New Filing / Renewal</Link>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Section title="Current Obligations" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} count={groups.current.length}>{groups.current.length ? <div className="space-y-3">{groups.current.map((item) => <ObligationRow key={item.id} item={item} reload={load} />)}</div> : <Empty text="No obligations are currently verified." />}</Section>
          <Section title="Upcoming Renewals" icon={<CalendarDays className="h-4 w-4 text-sky-600" />} count={groups.upcoming.length}>{groups.upcoming.length ? <div className="space-y-3">{groups.upcoming.map((item) => <ObligationRow key={item.id} item={item} reload={load} />)}</div> : <Empty text="No known renewals are approaching." />}</Section>
              <Section title="Active Filings / Matters" icon={<FolderOpen className="h-4 w-4 text-blue-600" />} count={activeMatters.length}>{activeMatters.length ? <div className="space-y-2">{activeMatters.map((matter) => <div key={matter.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center"><div><div className="font-semibold text-[#0A2540]">{matter.title}</div><div className="text-xs text-slate-500">{matter.matter_type.replaceAll("_", " ")} · Opened {fmtDate(matter.opened_at)}</div></div><div className="flex flex-wrap items-center gap-3"><StatusBadge status={matter.status === "READY" ? "CURRENT" : matter.status === "DRAFT" ? "IN_PROGRESS" : matter.status as ObligationStatus} /><ScorePill score={matter.readiness_score} />{matter.submission_id && <Link href={`/?entry=new-business&resume=${matter.submission_id}`} className="text-xs font-semibold text-[#0D9488]">Resume →</Link>}<button onClick={() => void completeMatter(matter.id)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600">Mark filing complete</button></div></div>)}</div> : <Empty text="No active filings." />}</Section>
          <Section title="Missing Requirements" icon={<ShieldAlert className="h-4 w-4 text-rose-600" />} count={groups.missing.length}>{groups.missing.length ? <div className="space-y-3">{groups.missing.map((item) => <ObligationRow key={item.id} item={item} reload={load} />)}</div> : <Empty text="No missing requirements are recorded." />}</Section>
          <Section title="Documents / Evidence" icon={<FileText className="h-4 w-4 text-slate-600" />} count={(data.evidence ?? []).length}>{(data.evidence ?? []).length ? <div className="space-y-2">{data.evidence!.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"><div><div className="font-semibold text-[#0A2540]">{item.original_filename}</div><div className="text-xs text-slate-500">{item.obligation_name || "Unmatched evidence"} · Added {fmtDateTime(item.created_at)}</div></div><StatusBadge status={item.review_status === "VERIFIED" ? "CURRENT" : item.review_status === "NEEDS_REVIEW" ? "NEEDS_ATTENTION" : "UNKNOWN"} /></div>)}</div> : <Empty text="No uploaded evidence is associated with this business." />}</Section>
          <Section title="Filing History" icon={<FileClock className="h-4 w-4 text-slate-600" />} count={history.length + (data.submissions ?? []).length}>{history.length || (data.submissions ?? []).length ? <div className="space-y-2">{history.map((matter) => <div key={matter.id} className="rounded-xl border border-slate-200 px-4 py-3"><div className="font-semibold text-[#0A2540]">{matter.title}</div><div className="text-xs text-slate-500">Completed {fmtDate(matter.completed_at)}</div></div>)}{data.submissions!.map((submission) => <Link key={submission.id} href={`/history/${submission.id}`} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"><div><div className="font-semibold text-[#0A2540]">Rules evaluation · {fmtDate(submission.created_at)}</div><div className="text-xs text-slate-500">{submission.business_type || "Business profile"} · {submission.municipality || "—"}</div></div><ScorePill score={submission.readiness_score} /></Link>)}</div> : <Empty text="No filing history yet." />}</Section>
          <Section title="Compliance Calendar" icon={<CalendarDays className="h-4 w-4 text-[#0D9488]" />} count={groups.calendar.length}>{groups.calendar.length ? <div className="space-y-2">{groups.calendar.slice(0, 8).map((item) => <Link key={item.id} href={`#obligation-${item.id}`} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"><div><div className="font-semibold text-[#0A2540]">{item.name}</div><div className="text-xs text-slate-500">{item.agency || "—"}</div></div><div className="text-right"><div className="font-semibold text-slate-700">{dateLabel(item.due_date)}</div><StatusBadge status={item.status} /></div></Link>)}</div> : <Empty text={DUE_DATE_UNKNOWN_MESSAGE} />}</Section>
          <Section title="Notifications" icon={<Bell className="h-4 w-4 text-amber-600" />} count={(data.notifications ?? []).length}>{(data.notifications ?? []).length ? <div className="space-y-2">{data.notifications!.slice(0, 10).map((item) => <div key={item.id} className="rounded-xl border border-slate-200 px-4 py-3"><div className="text-sm font-semibold text-[#0A2540]">{item.message}</div><div className="text-xs text-slate-500">Scheduled {fmtDateTime(item.scheduled_for)} · {item.status}</div></div>)}</div> : <Empty text="No reminders have been scheduled." />}</Section>
        </div>

        {(data.deliverables ?? []).length > 0 && <div className="mt-6"><Section title="Deliverable Library" icon={<Archive className="h-4 w-4 text-slate-600" />} count={data.deliverables!.length}><div className="grid gap-2 md:grid-cols-2">{data.deliverables!.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 px-4 py-3"><div className="font-semibold text-[#0A2540]">{item.filename}</div><div className="text-xs text-slate-500">{item.kind} · {fmtDateTime(item.generated_at)}</div></div>)}</div></Section></div>}
      </main>
    </div>
  );
}
