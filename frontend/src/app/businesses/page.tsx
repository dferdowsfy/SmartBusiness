"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
    <div className="min-h-screen bg-[#f4f1ea] text-[#161616]">
      <TopNav active="businesses" />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight sm:text-5xl">My businesses</h1>
        <p className="mt-3 max-w-xl text-[#1b1b1b]">Permanent profiles for the businesses and clients you file for in Puerto Rico.</p>
        <Link href="/?entry=new-business" className="mt-8 inline-flex h-12 items-center rounded-lg bg-[#245c5c] px-5 text-sm font-medium text-[#f6f3ea]">
          Start a new filing
        </Link>

        {(businesses?.length ?? 0) > 6 ? (
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name"
            className="mt-8 w-full rounded-lg border border-[#161616]/22 bg-[#fbf8f2] px-3 py-2.5 text-sm"
          />
        ) : null}

        {businesses === null ? (
          <p className="mt-12 text-sm text-[#5a5a5a]">Loading businesses…</p>
        ) : shown.length === 0 ? (
          <p className="mt-12 text-sm text-[#5a5a5a]">{businesses.length ? "No businesses match that search." : "No businesses yet. Start a filing to create the first profile."}</p>
        ) : (
          <ul className="mt-12 divide-y divide-[#161616]/12 border-y border-[#161616]/12">
            {shown.map((business) => (
              <li key={business.id} className="grid gap-3 py-5 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
                <div>
                  <p className="font-medium">{business.legal_name}</p>
                  <p className="text-sm text-[#5a5a5a]">
                    {[business.municipality, business.business_type].filter(Boolean).join(" · ") || "Puerto Rico"}
                  </p>
                </div>
                <p className="text-sm text-[#1b1b1b]">
                  {business.readiness_score == null ? "In progress" : `${business.readiness_score}% ready`}
                  {business.active_matters ? ` · ${business.active_matters} filing${business.active_matters === 1 ? "" : "s"}` : ""}
                </p>
                <Link href={`/businesses/${business.id}`} className="justify-self-start text-sm text-[#245c5c] underline-offset-4 hover:underline sm:justify-self-end">
                  Continue
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
