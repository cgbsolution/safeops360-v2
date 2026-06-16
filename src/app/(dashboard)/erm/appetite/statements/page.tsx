import Link from "next/link";
import { FilePlus2, ChevronRight } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import {
  APPETITE_LEVEL_CHIP,
  type AppetiteStatement,
  type AppetiteDashRow,
} from "@/app/(dashboard)/erm/lib-p2";
import { fmtDate } from "@/app/(dashboard)/erm/lib";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  SUPERSEDED: "bg-slate-100 text-slate-500 border-slate-200",
};

export default async function ManageStatementsPage() {
  let statements: AppetiteStatement[] = [];
  let rows: AppetiteDashRow[] = [];
  let error: string | null = null;
  try {
    [statements, rows] = await Promise.all([
      backendFetch<AppetiteStatement[]>("/api/erm/appetite/statements"),
      backendFetch<AppetiteDashRow[]>("/api/erm/appetite/dashboard").catch(
        () => [] as AppetiteDashRow[],
      ),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load appetite statements";
  }

  // Group statements by category; remember which categories have none.
  const byCat = new Map<string, AppetiteStatement[]>();
  for (const s of statements) {
    const list = byCat.get(s.categoryId) ?? [];
    list.push(s);
    byCat.set(s.categoryId, list);
  }
  for (const list of byCat.values()) list.sort((a, b) => b.version - a.version);

  const catsWithout = rows.filter((r) => !byCat.has(r.categoryId));

  return (
    <div>
      <PageHeader
        title="Manage Appetite Statements"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Appetite", href: "/erm/appetite" },
          { label: "Statements" },
        ]}
        description="All appetite statement versions across categories. Drill into a version to edit or run the approval workflow."
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <div className="space-y-4">
          {[...byCat.entries()].map(([catId, list]) => {
            const head = list[0];
            return (
              <div key={catId} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded"
                    style={{ backgroundColor: head.categoryColor ?? "#64748b" }}
                  />
                  <h2 className="text-sm font-semibold text-slate-900">
                    {head.categoryName ?? head.categoryCode}
                  </h2>
                </div>
                <ul className="divide-y divide-slate-100">
                  {list.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/erm/appetite/${s.id}`}
                        className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:text-primary-700"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-700">v{s.version}</span>
                          <span
                            className={
                              "rounded border px-2 py-0.5 text-[10px] font-semibold " +
                              (STATUS_CHIP[s.status] ?? "bg-slate-100 text-slate-600 border-slate-200")
                            }
                          >
                            {s.status.replace(/_/g, " ")}
                          </span>
                          <span
                            className={
                              "rounded border px-2 py-0.5 text-[10px] font-semibold " +
                              (APPETITE_LEVEL_CHIP[s.appetiteLevel] ??
                                "bg-slate-100 text-slate-600 border-slate-200")
                            }
                          >
                            {s.appetiteLevel}
                          </span>
                          {s.approvalReference && (
                            <span className="text-[11px] text-slate-400">ref {s.approvalReference}</span>
                          )}
                          {s.effectiveFrom && (
                            <span className="text-[11px] text-slate-400">eff {fmtDate(s.effectiveFrom)}</span>
                          )}
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-slate-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {catsWithout.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Categories without a statement</h2>
              <ul className="divide-y divide-slate-100">
                {catsWithout.map((r) => (
                  <li key={r.categoryId}>
                    <Link
                      href={`/erm/appetite/new?categoryId=${r.categoryId}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary-700"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3.5 w-3.5 rounded"
                          style={{ backgroundColor: r.categoryColor ?? "#64748b" }}
                        />
                        <span className="font-medium text-slate-700">{r.categoryName ?? r.categoryCode}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-700">
                        <FilePlus2 size={13} /> Draft statement
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {byCat.size === 0 && catsWithout.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
              No appetite statements or categories found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
