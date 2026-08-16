"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, FilePlus2, Search } from "lucide-react";
import { TopNav } from "../history/ui";

interface Business {
  id: string;
  legal_name: string;
  entity_number: string | null;
  municipality: string | null;
  business_type: string | null;
  onboarding_mode: "NEW" | "EXISTING";
  readiness_score: number | null;
  active_matters: number;
}

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    fetch("/api/portfolio").then((response) => response.json())
      .then((result) => setBusinesses(result.businesses ?? [])).catch(() => setBusinesses([]));
  }, []);
  const shown = useMemo(() => (businesses ?? []).filter((business) =>
    !search.trim() || business.legal_name.toLowerCase().includes(search.trim().toLowerCase())
  ), [businesses, search]);

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <TopNav active="businesses" />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0D9488]">Portfolio</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0A2540]">Businesses</h1>
            <p className="mt-1 text-sm text-slate-500">Permanent compliance profiles for your businesses and clients.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/?entry=new-business" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A2540] px-4 py-2.5 text-sm font-semibold text-white"><FilePlus2 className="h-4 w-4" /> File a New Business</Link>
            <Link href="/businesses/import" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white"><Building2 className="h-4 w-4" /> Manage an Existing Business</Link>
          </div>
        </div>

        <label className="relative mb-5 block max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by business name" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-[#0A2540]" />
        </label>

        {businesses === null ? (
          <div className="py-16 text-center text-slate-500">Loading businesses…</div>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h2 className="font-bold text-[#0A2540]">{businesses.length ? "No businesses match that search." : "Build your compliance portfolio."}</h2>
            {!businesses.length && <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">File a new business through the existing SmartPR intake or import an established business to reconstruct its compliance state.</p>}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((business) => (
              <Link key={business.id} href={`/businesses/${business.id}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] transition hover:-translate-y-0.5 hover:border-[#0D9488]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#0A2540]"><Building2 className="h-5 w-5" /></div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-500">{business.onboarding_mode === "EXISTING" ? "IMPORTED" : "FORMATION"}</span>
                </div>
                <h2 className="mt-4 text-lg font-bold text-[#0A2540] group-hover:text-[#0D9488]">{business.legal_name}</h2>
                <p className="mt-1 text-xs text-slate-500">{[business.entity_number, business.municipality, business.business_type].filter(Boolean).join(" · ") || "Profile details in progress"}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
                  <div><div className="text-xs text-slate-400">Overall readiness</div><div className="font-bold text-[#0A2540]">{business.readiness_score == null ? "—" : `${business.readiness_score}%`}</div></div>
                  <div><div className="text-xs text-slate-400">Active filings</div><div className="font-bold text-[#0A2540]">{business.active_matters}</div></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
