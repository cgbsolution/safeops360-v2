"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";

// Department / Business-Unit select + free-text search for the Risk Register.
// Mirrors the URL-driven filter mechanism used by the band chips: every change
// rewrites the search params and lets the server component re-fetch.
export function RegisterFilters({ businessUnits }: { businessUnits: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentBu = searchParams.get("businessUnit") ?? "";
  const currentSearch = searchParams.get("search") ?? "";

  // Local state for the search box so typing feels immediate; commit on submit.
  const [searchDraft, setSearchDraft] = useState(currentSearch);
  useEffect(() => {
    setSearchDraft(currentSearch);
  }, [currentSearch]);

  function pushWith(mutate: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(searchParams.toString());
    mutate(sp);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onDepartmentChange(value: string) {
    pushWith((sp) => {
      if (value) sp.set("businessUnit", value);
      else sp.delete("businessUnit");
    });
  }

  function commitSearch() {
    pushWith((sp) => {
      const v = searchDraft.trim();
      if (v) sp.set("search", v);
      else sp.delete("search");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Department</span>
      <SelectField
        value={currentBu}
        onChange={onDepartmentChange}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
        placeholder="All departments"
        options={businessUnits.map((bu) => ({ value: bu, label: `${bu}` }))}
      />

      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitSearch();
            }
          }}
          onBlur={commitSearch}
          placeholder="Search code, title, description…"
          className="w-56 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500" />
      </div>
    </div>
  );
}
