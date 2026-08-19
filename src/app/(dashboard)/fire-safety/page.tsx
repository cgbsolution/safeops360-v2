import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

type Eq = { id: string; equipmentCode: string; type: string; location: string; status: string; nextInspectionDueDate: string | null };
type Dash = {
  totalEquipment: number; byStatus: Record<string, number>; dueThisMonth: number; overdue: number;
  drillsCompletedThisYear: number; drillsDue: number; plansReviewDue: number; overdueItems: Eq[];
};

const TILE = "rounded-xl border border-slate-200 bg-white p-4";

function Kpi({ label, value, tone, sub }: { label: string; value: any; tone?: string; sub?: string }) {
  const color = tone === "critical" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className={TILE}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={"text-2xl font-bold tabular-nums " + color}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

export default async function FireSafetyPage() {
  let d: Dash | null = null;
  let error: string | null = null;
  try {
    d = await backendFetch<Dash>("/api/fire/dashboard");
  } catch (e: any) {
    error = e?.message ?? "Failed to load fire-safety dashboard";
  }

  return (
    <div>
      <PageHeader title="Fire Safety & Emergency Response"
        breadcrumbs={[{ label: "Operational Safety" }, { label: "Fire Safety" }]}
        description="Equipment lifecycle, inspection rounds (via the CAMS engine), assembly points, emergency plans and evacuation drills — every regulatory question, one screen." />
      {error || !d ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}. Run seed_fire_safety.py and ensure you have an HSE role.</div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <Kpi label="Total Equipment" value={d.totalEquipment} />
            <Kpi label="Due This Month" value={d.dueThisMonth} tone="warn" />
            <Kpi label="Overdue" value={d.overdue} tone="critical" />
            <Kpi label="Drills This Year" value={d.drillsCompletedThisYear} tone="good" />
            <Kpi label="Drills Due" value={d.drillsDue} tone="warn" />
            <Kpi label="Plans Review-Due" value={d.plansReviewDue} tone={d.plansReviewDue > 0 ? "warn" : "good"} />
          </div>

          {/* ONE register link, not two.
              "Equipment Register →" and "Due / Overdue" used to sit here, next to
              a card that also opened a register — three entry points to two
              screens that wrote to the same FireEquipment table. Both old screens
              now redirect to /fire-safety/register, which carries the general
              asset list and the controlled extinguisher sheet as tabs. The
              overdue state is not a separate destination either: it is the badge
              column on that register and the "act now" panel below. */}
          <div className="mb-4 rounded-xl border border-[#D3DEEE] bg-white p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#5A6273]">
              Register &amp; controlled checklists — Page Industries EHS
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {[
                { href: "/fire-safety/register", doc: "PIL/EHSD/CL/028-R1", label: "Fire Asset Register", hint: "Every asset · 16-column extinguisher sheet · due-date badges", primary: true },
                { href: "/fire-safety/fe-inspection", doc: "PIL/EHSD/CL/027-R1", label: "FE Inspection Checklist", hint: "21 checks × Jan–Dec per cylinder" },
                { href: "/fire-safety/fire-alarm", doc: "PIL/EHS/CL/025-R1", label: "Fire Alarm System", hint: "Daily · Monthly ×2 · Quarterly · Annual · Beam" },
                { href: "/fire-safety/fire-hydrant", doc: "PIL/EHSD/CL/026", label: "Fire Hydrant & Sprinkler", hint: "Daily · Monthly · Quarterly · Yearly" },
                { href: "/fire-safety/checklists", doc: "Configuration", label: "Checklist Library", hint: "Add, revise, publish or retire a controlled sheet" },
              ].map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className={
                    "group rounded-lg border p-2.5 transition-colors hover:border-[#C9A961] " +
                    (c.primary ? "border-[#0B1F4D] bg-[#0B1F4D]" : "border-[#D3DEEE] bg-[#E8EEF7]")
                  }
                >
                  <div className="text-[10px] font-semibold tracking-wide text-[#C9A961]">{c.doc}</div>
                  <div className={"text-[12.5px] font-semibold " + (c.primary ? "text-white" : "text-[#0B1F4D]")}>{c.label}</div>
                  <div className={"text-[10.5px] " + (c.primary ? "text-white/70" : "text-[#5A6273]")}>{c.hint}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={TILE}>
              <div className="mb-2 text-sm font-semibold text-slate-800">Equipment by status</div>
              <div className="space-y-1.5">
                {Object.entries(d.byStatus).sort().map(([s, n]) => (
                  <div key={s} className="flex items-center gap-2 text-sm">
                    <span className={"inline-block h-2.5 w-2.5 rounded-full " + (s === "OVERDUE" ? "bg-rose-500" : s === "DUE_INSPECTION" ? "bg-amber-500" : s === "OUT_OF_SERVICE" ? "bg-slate-400" : "bg-emerald-500")} />
                    <span className="text-slate-600">{s.replace(/_/g, " ")}</span>
                    <span className="ml-auto font-semibold tabular-nums text-slate-800">{n}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={TILE}>
              <div className="mb-2 text-sm font-semibold text-rose-700">Overdue equipment — act now</div>
              {d.overdueItems.length === 0 ? (
                <div className="text-sm text-slate-400">Nothing overdue. 🎉</div>
              ) : (
                <div className="space-y-1">
                  {d.overdueItems.map((e) => (
                    <Link key={e.id} href={`/fire-safety/register`} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                      <span className="font-medium text-primary-700">{e.equipmentCode}</span>
                      <span className="truncate text-xs text-slate-500">{e.type.replace(/_/g, " ")} · {e.location}</span>
                      <span className="ml-auto text-[11px] text-rose-600">due {e.nextInspectionDueDate ? new Date(e.nextInspectionDueDate).toLocaleDateString("en-IN") : "—"}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
