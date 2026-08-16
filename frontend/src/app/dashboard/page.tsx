"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Bell, Building2, CalendarDays, FilePlus2, FolderClock, Search, TriangleAlert } from "lucide-react";
import { TopNav } from "../history/ui";
import { StatusBadge } from "../components/compliance/StatusBadge";
import { DUE_DATE_UNKNOWN_MESSAGE, type ObligationStatus } from "../compliance/types";

interface PortfolioBusiness {
  id: string;
  legal_name: string;
  municipality: string | null;
  readiness_score: number | null;
}

interface PortfolioItem {
  id: string;
  business_id: string;
  business_name: string;
  municipality: string | null;
  name: string;
  agency: string | null;
  due_date: string | null;
  due_date_source: string;
  status: ObligationStatus;
  readiness_score: number | null;
  matter_type: string | null;
  matter_title: string | null;
  next_action: string;
  item_type?: "OBLIGATION" | "MATTER";
  submission_id?: string | null;
}

interface PortfolioData {
  enabled: boolean;
  error?: string;
  user?: { name: string | null };
  metrics?: {
    businesses: number;
    due_next_30_days: number;
    overdue: number;
    needs_attention: number;
    filings_in_progress: number;
  };
  businesses?: PortfolioBusiness[];
  items?: PortfolioItem[];
  notifications?: { id: string; message: string; scheduled_for: string; business_id: string }[];
}

function KpiCard({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.02]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <span className={`rounded-lg p-2 ${tone}`}>{icon}</span>
      </div>
      <div className="text-3xl font-extrabold tracking-tight text-[#0A2540]">{value}</div>
    </div>
  );
}

function shortDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DashboardPage() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [search, setSearch] = useState("");
  const [business, setBusiness] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [agency, setAgency] = useState("");
  const [matterType, setMatterType] = useState("");
  const [status, setStatus] = useState("");
  const [horizon, setHorizon] = useState("");
  const [sort, setSort] = useState("due");

  useEffect(() => {
    fetch("/api/portfolio").then((response) => response.json()).then(setData)
      .catch(() => setData({ enabled: false, error: "network" }));
  }, []);

  const items = useMemo(() => {
    const now = new Date();
    const filtered = [...(data?.items ?? [])].filter((item) => {
      const query = search.trim().toLowerCase();
      if (query && !item.business_name.toLowerCase().includes(query) && !item.name.toLowerCase().includes(query)) return false;
      if (business && item.business_id !== business) return false;
      if (municipality && item.municipality !== municipality) return false;
      if (agency && item.agency !== agency) return false;
      if (matterType && item.matter_type !== matterType) return false;
      if (status && item.status !== status) return false;
      if (horizon) {
        if (!item.due_date) return false;
        const days = Math.ceil((new Date(`${item.due_date}T23:59:59`).getTime() - now.getTime()) / 86400000);
        if (days < 0 || days > Number(horizon)) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === "business") return a.business_name.localeCompare(b.business_name);
      if (sort === "status") return a.status.localeCompare(b.status);
      return (a.due_date || "9999-12-31").localeCompare(b.due_date || "9999-12-31");
    });
  }, [data, search, business, municipality, agency, matterType, status, horizon, sort]);

  const options = (key: "municipality" | "agency" | "matter_type") =>
    Array.from(new Set((data?.items ?? []).map((item) => item[key]).filter(Boolean) as string[])).sort();
  const metrics = data?.metrics ?? { businesses: 0, due_next_30_days: 0, overdue: 0, needs_attention: 0, filings_in_progress: 0 };

  if (!data) return <div className="min-h-screen bg-slate-50"><TopNav active="dashboard" /><div className="p-12 text-center text-slate-500">Loading portfolio…</div></div>;

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <TopNav active="dashboard" />
      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#0D9488]">Portfolio health</p>
            <h1 className="text-3xl font-bold tracking-tight text-[#0A2540]">Compliance workspace</h1>
            <p className="mt-1 text-sm text-slate-500">What is due, what is missing, and what your portfolio needs next.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/?entry=new-business" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A2540] px-5 py-3 text-sm font-semibold text-white shadow-sm">
              <FilePlus2 className="h-4 w-4" /> File a New Business
            </Link>
            <Link href="/businesses/import" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 py-3 text-sm font-semibold text-white shadow-sm">
              <Building2 className="h-4 w-4" /> Manage an Existing Business
            </Link>
          </div>
        </div>

        <section className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Portfolio metrics">
          <KpiCard label="Businesses Managed" value={metrics.businesses} tone="bg-blue-50 text-blue-600" icon={<Building2 className="h-4 w-4" />} />
          <KpiCard label="Due in Next 30 Days" value={metrics.due_next_30_days} tone="bg-amber-50 text-amber-700" icon={<CalendarDays className="h-4 w-4" />} />
          <KpiCard label="Overdue" value={metrics.overdue} tone="bg-red-50 text-red-700" icon={<TriangleAlert className="h-4 w-4" />} />
          <KpiCard label="Needs Attention" value={metrics.needs_attention} tone="bg-orange-50 text-orange-700" icon={<AlertCircle className="h-4 w-4" />} />
          <KpiCard label="Filings In Progress" value={metrics.filings_in_progress} tone="bg-sky-50 text-sky-700" icon={<FolderClock className="h-4 w-4" />} />
        </section>

        {(!data.enabled || data.error) && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            The compliance database is not available in this environment. Connect PostgreSQL/Supabase and apply the workspace migration to persist portfolio data.
          </div>
        )}

        {(data.notifications?.length ?? 0) > 0 && (
          <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-900"><Bell className="h-4 w-4" /> Due notifications</div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {data.notifications!.slice(0, 4).map((notification) => (
                <Link key={notification.id} href={`/businesses/${notification.business_id}`} className="text-sm text-amber-900 hover:underline">
                  {notification.message}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.02]">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h2 className="font-bold text-[#0A2540]">Urgent work and obligations</h2>
                <p className="text-xs text-slate-500">{items.length} item{items.length === 1 ? "" : "s"} in the current view</p>
              </div>
              <Link href="/calendar" className="text-sm font-semibold text-[#0D9488]">Open compliance calendar →</Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-8">
              <label className="relative col-span-2 lg:col-span-2">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search business or obligation" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-[#0A2540]" />
              </label>
              <select value={business} onChange={(event) => setBusiness(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0A2540]"><option value="">All businesses</option>{data.businesses?.map((item) => <option key={item.id} value={item.id}>{item.legal_name}</option>)}</select>
              <select value={municipality} onChange={(event) => setMunicipality(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0A2540]"><option value="">All municipalities</option>{options("municipality").map((value) => <option key={value}>{value}</option>)}</select>
              <select value={agency} onChange={(event) => setAgency(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0A2540]"><option value="">All agencies</option>{options("agency").map((value) => <option key={value}>{value}</option>)}</select>
              <select value={matterType} onChange={(event) => setMatterType(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0A2540]"><option value="">All matter types</option>{options("matter_type").map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}</select>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0A2540]"><option value="">All statuses</option>{["OVERDUE","DUE_SOON","NEEDS_ATTENTION","MISSING","UNKNOWN","IN_PROGRESS","UPCOMING","CURRENT","COMPLETED"].map((value) => <option key={value}>{value}</option>)}</select>
              <select value={horizon} onChange={(event) => setHorizon(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0A2540]"><option value="">Any due date</option>{[7,30,60,90].map((value) => <option key={value} value={value}>Due within {value} days</option>)}</select>
            </div>
            <div className="mt-2 flex justify-end"><select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600"><option value="due">Sort: due date</option><option value="business">Sort: business</option><option value="status">Sort: status</option></select></div>
          </div>

          {items.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Building2 className="mx-auto mb-3 h-9 w-9 text-slate-300" />
              <p className="font-semibold text-[#0A2540]">No compliance work matches this view.</p>
              <p className="mt-1 text-sm text-slate-500">Add a business or clear filters to see the full portfolio.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>{["Business","Filing / Obligation","Agency","Due Date","Status","Readiness","Next Action"].map((label) => <th key={label} className="px-5 py-3 font-bold">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4"><Link href={`/businesses/${item.business_id}`} className="font-semibold text-[#0A2540] hover:text-[#0D9488]">{item.business_name}</Link><div className="text-xs text-slate-400">{item.municipality || "Municipality not entered"}</div></td>
                      <td className="px-5 py-4"><div className="font-medium text-slate-800">{item.name}</div><div className="text-xs text-slate-400">{item.matter_title || "Ongoing compliance"}</div></td>
                      <td className="px-5 py-4 text-slate-600">{item.agency || "—"}</td>
                      <td className="px-5 py-4"><div className="font-medium text-slate-800">{shortDate(item.due_date) || "Unknown"}</div>{!item.due_date && <div className="max-w-52 text-[11px] leading-4 text-slate-400">{DUE_DATE_UNKNOWN_MESSAGE}</div>}</td>
                      <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                      <td className="px-5 py-4 font-bold text-[#0A2540]">{item.readiness_score == null ? "—" : `${Math.round(item.readiness_score)}%`}</td>
                      <td className="px-5 py-4"><Link href={item.item_type === "MATTER" && item.submission_id ? `/?entry=new-business&resume=${item.submission_id}` : `/businesses/${item.business_id}${item.item_type === "OBLIGATION" ? `#obligation-${item.id}` : ""}`} className="font-semibold text-[#0D9488] hover:underline">{item.next_action} →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
