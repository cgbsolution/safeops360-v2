import Link from "next/link";
import { CalendarRange, ShieldCheck } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { resolvePlantContext } from "@/lib/plant-context";
import { NewProgrammeButton } from "@/components/programme/new-programme-button";
import type { WizardLibrary } from "@/components/programme/programme-wizard";
import { CYCLE_STATUS_CHIP, fmtDate, type ProgrammeRow } from "./lib-programme";

export const dynamic = "force-dynamic";

const f = <T,>(v: T) => () => v;

type RawLibrary = {
  industryCode: string;
  industryName: string;
  categories: { category_code: string; category_name: string; checkpointCount: number }[];
};

/**
 * Annual Audit Programme — the register.
 *
 * Not a scheduler with a year filter. The programme is the artefact a
 * certification body asks to see BEFORE it looks at a single audit
 * (ISO 19011 cl.5, ISO 45001/9001/14001 cl.9.2.2), and CAMS had no concept of
 * it. See docs/cams/08-audit-programme.md.
 */
export default async function ProgrammeListPage() {
  await requirePermission("CAMS.READ");

  let programmes: ProgrammeRow[] = [];
  let error: string | null = null;
  try {
    programmes = (await backendFetch<{ items: ProgrammeRow[] }>("/api/programme")).items;
  } catch (e: any) {
    error = e?.message ?? "Could not load programmes";
  }

  // The wizard's step 3 needs the site list and the discipline taxonomy. Both
  // are already served for the audit register, so this reuses them rather than
  // adding programme-specific endpoints that would drift from the codes the
  // coverage engine actually joins on.
  const [{ plants }, libs] = await Promise.all([
    resolvePlantContext(null).catch(f({ plantId: null, plants: [], isOverride: false })),
    backendFetch<{ libraries: RawLibrary[] }>("/api/audit-compliance/library").catch(
      f({ libraries: [] as RawLibrary[] }),
    ),
  ]);
  const libraries: WizardLibrary[] = libs.libraries.map((l) => ({
    industryCode: l.industryCode,
    industryName: l.industryName,
    categories: (l.categories ?? []).map((c) => ({
      code: c.category_code,
      name: c.category_name,
      checkpointCount: c.checkpointCount ?? 0,
    })),
  }));

  return (
    <div>
      <PageHeader
        title="Audit Programme"
        description="The standing programme, its cycles, and what each cycle actually covered — ISO 19011 clause 5."
        breadcrumbs={[{ label: "Audit & Compliance", href: "/cams/audits" }, { label: "Programme" }]}
        action={<NewProgrammeButton sites={plants} libraries={libraries} />}
      />

      {error && (
        <Card className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
          <p className="mt-1 text-xs text-rose-600">
            If the programme tables have not been created yet, run
            <code className="mx-1 rounded bg-white px-1">scripts/add_programme_tables.py</code>
            and restart the backend.
          </p>
        </Card>
      )}

      {!error && programmes.length === 0 && (
        <Card className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <CalendarRange size={28} className="mx-auto text-slate-300" />
          <h3 className="mt-3 text-sm font-semibold text-slate-700">No audit programme yet</h3>
          <p className="mx-auto mt-1 max-w-lg text-xs text-slate-500">
            A programme is per management system, not per site — typically one for ISO 45001, one
            for SA8000, one for buyer and certification audits. Sites enter as scope units, so a
            16-factory group runs three or four programmes rather than sixteen.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {programmes.map((p) => {
          const active = p.cycles.find((c) => c.status === "ACTIVE") ?? p.cycles[0];
          return (
            <Card key={p.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-violet-700" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/cams/programme/${p.id}`}
                    className="block truncate text-sm font-semibold text-violet-800 hover:underline"
                  >
                    {p.name}
                  </Link>
                  <div className="text-[11px] text-slate-400">{p.programmeCode}</div>
                </div>
              </div>

              {p.standardRefs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.standardRefs.map((s) => (
                    <span
                      key={s}
                      className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {p.objectives && (
                <p className="mt-2 line-clamp-2 text-xs text-slate-600">{p.objectives}</p>
              )}

              <div className="mt-3 border-t border-slate-100 pt-2">
                {active ? (
                  <Link
                    href={`/cams/programme/${p.id}?cycle=${active.id}`}
                    className="flex items-center gap-2 text-xs hover:underline"
                  >
                    <span className="font-medium text-slate-700">{active.cycleLabel}</span>
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px]",
                        CYCLE_STATUS_CHIP[active.status] ?? "",
                      )}
                    >
                      {active.status.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <span className="ml-auto text-slate-400">
                      {fmtDate(active.periodStart)} – {fmtDate(active.periodEnd)}
                    </span>
                  </Link>
                ) : (
                  <span className="text-xs text-slate-400">No cycle defined.</span>
                )}
                {p.cycles.length > 1 && (
                  <div className="mt-1 text-[10px] text-slate-400">
                    +{p.cycles.length - 1} earlier cycle{p.cycles.length > 2 ? "s" : ""}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
