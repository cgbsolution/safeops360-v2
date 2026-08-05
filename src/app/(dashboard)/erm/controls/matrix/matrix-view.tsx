"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CONTROL_CATEGORIES, CONTROL_CATEGORY_LABEL } from "@/app/(dashboard)/erm/lib-t3";
import type { PlantOption } from "@/lib/plant-context";

// Client filter bar — pushes ?category to the server page which re-fetches the matrix.
export function MatrixFilters({ plants }: { plants: PlantOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const category = params.get("category") ?? "";
  const siteId = params.get("siteId") ?? "";

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/erm/controls/matrix${next.toString() ? `?${next.toString()}` : ""}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Category</span>
        <select
          value={category}
          onChange={(e) => setParam("category", e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All categories</option>
          {CONTROL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CONTROL_CATEGORY_LABEL[c] ?? c}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Site</span>
        {/* Was a free-text "Filter by site id (Enter)" box — nobody knows their
            plant's cuid, so the filter was effectively unusable. */}
        <select
          value={siteId}
          onChange={(e) => setParam("siteId", e.target.value)}
          className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All sites</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
