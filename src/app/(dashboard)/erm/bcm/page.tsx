import Link from "next/link";
import { AlertTriangle, ShieldCheck, Network, FlaskConical, ClipboardCheck, Boxes } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KpiTile } from "@/components/erm/shared";
import {
  CRITICALITY_CHIP,
  CRISIS_STATUS_CHIP,
  EXERCISE_STATUS_CHIP,
  SEVERITY_LABEL,
  type BcmDashboard,
} from "@/app/(dashboard)/erm/lib-p3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";

export const dynamic = "force-dynamic";

export default async function BcmDashboardPage() {
  let d: BcmDashboard | null = null;
  let error: string | null = null;
  try {
    d = await backendFetch<BcmDashboard>("/api/erm/bcm/dashboard");
  } catch (e: any) {
    error = e?.message ?? "Failed to load BCM dashboard";
  }

  return (
    <div>
      <PageHeader
        title="Business Continuity (BCM)"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Business Continuity" },
        ]}
        description="ISO 22301 continuity posture — business-impact analysis, plan coverage, crisis readiness, exercises and scenario resilience across both plants."
      />

      {error || !d ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "No dashboard data."}. Ensure the ERM Phase 3 (BCM) seed has been run and you are logged in with a BCM role.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Active-crisis red banner */}
          {d.activeCrises > 0 && (
            <Link
              href="/erm/bcm/crisis"
              className="flex items-center gap-3 rounded-xl border border-rose-300 bg-rose-600 px-5 py-3 text-white shadow-sm transition-colors hover:bg-rose-700"
            >
              <AlertTriangle size={20} className="shrink-0" />
              <span className="text-sm font-semibold">
                {d.activeCrises} active crisis{d.activeCrises > 1 ? "es" : ""} in progress — open the crisis workspace
              </span>
              <span className="ml-auto text-xs font-medium uppercase tracking-wider opacity-90">View →</span>
            </Link>
          )}

          {/* Headline coverage + posture */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KpiTile
              label="Critical Coverage"
              value={`${d.coveragePct}%`}
              tone={d.coveragePct >= 90 ? "good" : d.coveragePct >= 75 ? "warn" : "critical"}
              sub={`${d.coveredCritical} / ${d.totalCritical} critical processes`}
              href="/erm/bcm/processes"
            />
            <KpiTile label="Critical Processes" value={d.criticalProcesses} href="/erm/bcm/processes?criticality=VITAL" />
            <KpiTile
              label="Unmitigated SPOFs"
              value={d.unmitigatedSpofs}
              tone={d.unmitigatedSpofs > 0 ? "high" : "good"}
              href="/erm/bcm/dependency-map"
            />
            <KpiTile label="Plans Review Due" value={d.plansReviewDue} tone={d.plansReviewDue > 0 ? "warn" : "neutral"} href="/erm/bcm/plans" />
            <KpiTile label="Exercises Overdue" value={d.exercisesOverdue} tone={d.exercisesOverdue > 0 ? "warn" : "neutral"} href="/erm/bcm/exercises" />
            <KpiTile label="Open Exercise CAPAs" value={d.openExerciseCapas} tone={d.openExerciseCapas > 0 ? "high" : "good"} href="/erm/bcm/exercises" />
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              { href: "/erm/bcm/processes", label: "BIA / Processes", icon: ClipboardCheck },
              { href: "/erm/bcm/dependency-map", label: "Dependency Map", icon: Network },
              { href: "/erm/bcm/plans", label: "Continuity Plans", icon: ShieldCheck },
              { href: "/erm/bcm/crisis", label: "Crisis", icon: AlertTriangle },
              { href: "/erm/bcm/exercises", label: "Exercises", icon: FlaskConical },
              { href: "/erm/bcm/scenarios", label: "Scenarios", icon: Boxes },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:border-primary-500 hover:text-primary-700"
              >
                <Icon size={15} className="shrink-0 text-slate-400" />
                {label}
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Coverage gaps */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Coverage gaps</h2>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">
                  {d.coverageGaps.length} critical process{d.coverageGaps.length === 1 ? "" : "es"} uncovered
                </span>
              </div>
              {d.coverageGaps.length === 0 ? (
                <p className="py-6 text-center text-sm text-emerald-600">All critical processes are covered by an approved plan.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {d.coverageGaps.map((g) => (
                    <li key={g.processCode} className="flex items-center gap-3 py-2.5">
                      <AlertTriangle size={15} className="shrink-0 text-rose-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{g.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {g.processCode} · {g.siteId ? "Plant process" : "Corporate"}
                        </p>
                      </div>
                      <span className={"rounded border px-2 py-0.5 text-[11px] " + (CRITICALITY_CHIP[g.criticality] ?? "")}>
                        {g.criticality}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recent crises */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Recent crises</h2>
                <Link href="/erm/bcm/crisis" className="text-[11px] font-medium text-primary-700 hover:underline">
                  All crises →
                </Link>
              </div>
              {d.recentCrises.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">No crises recorded.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {d.recentCrises.map((c) => (
                    <li key={c.crisisCode} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{c.title}</p>
                        <p className="text-[11px] text-slate-400">
                          {c.crisisCode} · {SEVERITY_LABEL[c.severityLevel] ?? `Sev ${c.severityLevel}`} · {fmtDate(c.activatedAt)}
                        </p>
                      </div>
                      <span className={"rounded border px-2 py-0.5 text-[11px] " + (CRISIS_STATUS_CHIP[c.status] ?? "")}>
                        {c.status.replace(/_/g, " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Exercise programme */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Exercise programme</h2>
              <Link href="/erm/bcm/exercises" className="text-[11px] font-medium text-primary-700 hover:underline">
                Programme →
              </Link>
            </div>
            {d.exerciseProgramme.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No exercises scheduled.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {d.exerciseProgramme.map((e) => (
                  <div key={e.exerciseCode} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-primary-700">{e.exerciseCode}</span>
                      <span className={"rounded border px-1.5 py-0.5 text-[10px] " + (EXERCISE_STATUS_CHIP[e.status] ?? "")}>
                        {e.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-0.5 max-w-[200px] truncate text-xs text-slate-600">{e.title}</p>
                    <p className="text-[10px] text-slate-400">{fmtDate(e.scheduledDate)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
