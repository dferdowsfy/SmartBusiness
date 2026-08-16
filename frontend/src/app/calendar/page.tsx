"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { TopNav } from "../history/ui";
import { StatusBadge } from "../components/compliance/StatusBadge";
import type { ObligationStatus } from "../compliance/types";

interface EventItem {
  id: string;
  business_id: string;
  business_name: string;
  name: string;
  agency: string | null;
  due_date: string | null;
  status: ObligationStatus;
  matter_title: string | null;
}

interface Portfolio {
  businesses?: { id: string; legal_name: string }[];
  items?: EventItem[];
}

const HORIZONS = [7, 30, 60, 90, 365] as const;

function CalendarContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Portfolio | null>(null);
  const [horizon, setHorizon] = useState<number>(30);
  const [business, setBusiness] = useState(() => searchParams.get("business") || "");
  useEffect(() => {
    fetch("/api/portfolio").then((response) => response.json()).then(setData).catch(() => setData({}));
  }, []);
  const events = useMemo(() => {
    const today = new Date();
    return (data?.items ?? []).filter((item) => {
      if (!item.due_date || item.status === "COMPLETED") return false;
      if (business && item.business_id !== business) return false;
      const days = Math.ceil((new Date(`${item.due_date}T23:59:59`).getTime() - today.getTime()) / 86400000);
      return days <= horizon;
    }).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  }, [data, horizon, business]);

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <TopNav active="calendar" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0D9488]">Due dates</p><h1 className="mt-1 text-3xl font-bold text-[#0A2540]">Compliance calendar</h1><p className="mt-1 text-sm text-slate-500">Portfolio-level deadlines linked to the relevant business and obligation.</p></div>
          <select value={business} onChange={(event) => setBusiness(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-[#0A2540]"><option value="">All businesses</option>{data?.businesses?.map((item) => <option key={item.id} value={item.id}>{item.legal_name}</option>)}</select>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">{HORIZONS.map((days) => <button key={days} onClick={() => setHorizon(days)} className={`rounded-full px-4 py-2 text-sm font-semibold ${horizon === days ? "bg-[#0A2540] text-white" : "border border-slate-300 bg-white text-slate-600"}`}>{days === 365 ? "Annual horizon" : `${days} days`}</button>)}</div>
        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {data === null ? <div className="py-14 text-center text-slate-500">Loading calendar…</div> : events.length === 0 ? <div className="py-14 text-center"><CalendarDays className="mx-auto mb-3 h-9 w-9 text-slate-300" /><div className="font-semibold text-[#0A2540]">No known due dates in this horizon.</div><p className="mt-1 text-sm text-slate-500">Unknown dates stay unknown until documentation or a sourced date is provided.</p></div> : <div className="divide-y divide-slate-100">{events.map((item) => {
            const date = new Date(`${item.due_date}T00:00:00`);
            return <Link key={item.id} href={`/businesses/${item.business_id}#obligation-${item.id}`} className="grid gap-3 px-5 py-4 hover:bg-slate-50 sm:grid-cols-[80px_1fr_auto] sm:items-center"><div className="rounded-xl bg-slate-100 py-2 text-center"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{date.toLocaleDateString("en-US", { month: "short" })}</div><div className="text-xl font-extrabold text-[#0A2540]">{date.getDate()}</div></div><div><div className="font-bold text-[#0A2540]">{item.name}</div><div className="text-xs text-slate-500">{item.business_name} · {item.agency || "Agency not recorded"}{item.matter_title ? ` · ${item.matter_title}` : ""}</div></div><StatusBadge status={item.status} /></Link>;
          })}</div>}
        </section>
      </main>
    </div>
  );
}

export default function CalendarPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-50"><TopNav active="calendar" /><div className="p-12 text-center text-slate-500">Loading calendar…</div></div>}><CalendarContent /></Suspense>;
}
