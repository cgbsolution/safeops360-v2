import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { PermitGateToggle } from "./permit-gate-toggle";

export const dynamic = "force-dynamic";

const CATEGORY_COLOR: Record<string, string> = {
  mechanical: "bg-blue-100 text-blue-800 border-blue-200",
  electrical: "bg-yellow-100 text-yellow-800 border-yellow-200",
  chemical: "bg-rose-100 text-rose-800 border-rose-200",
  biological: "bg-emerald-100 text-emerald-800 border-emerald-200",
  physical: "bg-slate-100 text-slate-800 border-slate-200",
  ergonomic: "bg-purple-100 text-purple-800 border-purple-200",
  psychosocial: "bg-pink-100 text-pink-800 border-pink-200",
  fire_explosion: "bg-orange-200 text-orange-900 border-orange-300",
  environmental: "bg-teal-100 text-teal-800 border-teal-200",
  radiation: "bg-violet-100 text-violet-800 border-violet-200",
  noise: "bg-amber-100 text-amber-800 border-amber-200",
  thermal: "bg-red-100 text-red-800 border-red-200",
  pressure: "bg-cyan-100 text-cyan-800 border-cyan-200",
  height: "bg-indigo-100 text-indigo-800 border-indigo-200",
  confined_space: "bg-gray-200 text-gray-900 border-gray-300",
  transportation: "bg-lime-100 text-lime-800 border-lime-200",
  behavioral: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200"
};

type Hazard = {
  id: string;
  code: string;
  category: string;
  subcategory: string | null;
  name: string;
  description: string;
  energyForm: string | null;
  isGlobal: boolean;
  factoriesActSection: string | null;
  isStandard: string | null;
  requiresPermit: boolean;
  permitTypes: string[] | null;
};

export default async function HazardsAdminPage(
  props: { searchParams: Promise<{ category?: string; q?: string }> }
) {
  await requirePermission("HIRA.LIBRARY_MANAGE");
  const searchParams = await props.searchParams;

  const hazards = await backendFetch<Hazard[]>("/api/hira/hazards", {
    query: {
      q: searchParams.q ?? null,
      category: searchParams.category ?? null,
      limit: 200
    }
  });

  const categoryCounts: Record<string, number> = {};
  for (const h of hazards) {
    categoryCounts[h.category] = (categoryCounts[h.category] ?? 0) + 1;
  }
  const total = hazards.length;
  const grouped = new Map<string, Hazard[]>();
  for (const h of hazards) {
    if (!grouped.has(h.category)) grouped.set(h.category, []);
    grouped.get(h.category)!.push(h);
  }

  return (
    <div>
      <PageHeader
        title="Hazard Library"
        description="Structured hazard library used by HIRA studies. Global hazards are pre-seeded; tenants add organisation-specific entries."
      />

      <div className="rounded-xl border bg-amber-50 border-amber-200 p-4 mb-4 text-sm text-amber-900">
        <div className="font-medium">{hazards.length} hazards shown</div>
        <div className="mt-1 text-xs">
          The current set is a 20-row stub. PM-owned full library (~150+ rows across 17 categories) delivers by end of week 5.
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip href="/configuration/hazards" label="All" count={total} active={!searchParams.category} />
        {Object.entries(categoryCounts).map(([cat, n]) => (
          <FilterChip
            key={cat}
            href={`/configuration/hazards?category=${cat}`}
            label={cat.replace(/_/g, " ")}
            count={n}
            active={searchParams.category === cat}
            color={CATEGORY_COLOR[cat]}
          />
        ))}
      </div>

      <div className="space-y-6">
        {[...grouped.entries()].map(([cat, items]) => (
          <div key={cat}>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
              {cat.replace(/_/g, " ")} ({items.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((h) => (
                <div key={h.id} className="rounded-lg border bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-slate-900">{h.name}</div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {h.requiresPermit && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          permit
                        </span>
                      )}
                      {h.isGlobal && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          global
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{h.code}</div>
                  <p className="text-sm text-slate-600 mt-2 line-clamp-3">{h.description}</p>
                  {h.energyForm && (
                    <div className="text-xs text-slate-500 mt-2">
                      <span className="font-medium">Energy form:</span> {h.energyForm}
                    </div>
                  )}
                  {(h.factoriesActSection || h.isStandard) && (
                    <div className="text-xs text-slate-500 mt-1 space-x-2">
                      {h.factoriesActSection && (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                          {h.factoriesActSection}
                        </span>
                      )}
                      {h.isStandard && (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                          {h.isStandard}
                        </span>
                      )}
                    </div>
                  )}
                  <PermitGateToggle
                    hazardId={h.id}
                    requiresPermit={h.requiresPermit ?? false}
                    permitTypes={h.permitTypes ?? []}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  href,
  label,
  count,
  active,
  color
}: {
  href: string;
  label: string;
  count: number;
  active?: boolean;
  color?: string;
}) {
  const base = active
    ? "bg-primary-700 text-white border-primary-700"
    : color ?? "bg-white text-slate-700 border-slate-200 hover:border-primary-300";
  return (
    <a href={href} className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border ${base}`}>
      <span className="capitalize">{label}</span>
      <span className="text-[10px] opacity-75">({count})</span>
    </a>
  );
}
