import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  XCircle,
  CalendarDays,
  Activity,
} from "lucide-react";

export const dynamic = "force-dynamic";

// The dashboard's whole view model, from /api/training/analytics. Every figure
// is computed against ONE server-side instant, so the 30/60/90 buckets and the
// 12-month pipeline can't disagree about where "today" is — they could when the
// page issued fourteen separate queries.
type TrainingAnalytics = {
  statusCounts: Record<string, number>;
  totalCerts: number;
  activePct: number;
  statutoryActive: number;
  expiring30: number;
  expiring60: number;
  expiring90: number;
  plants: { id: string; name: string; code: string; active: number; total: number }[];
  topPrograms: {
    id: string; name: string; code: string; isStatutory: boolean;
    gates: string[]; count: number;
  }[];
  effectiveness: { reviewedCount: number; avgRating: number };
  expiryPipeline: { month: string; count: number }[];
  triggeredIncidents: {
    id: string; number: string; date: string;
    triggeredTrainingFor: string[]; triggeredTrainingKeywords: string[];
  }[];
  contractorCoverage: { company: string; total: number; covered: number; expiring: number }[];
  contractorPct: number;
};

const EMPTY_ANALYTICS: TrainingAnalytics = {
  statusCounts: {}, totalCerts: 0, activePct: 0, statutoryActive: 0,
  expiring30: 0, expiring60: 0, expiring90: 0, plants: [], topPrograms: [],
  effectiveness: { reviewedCount: 0, avgRating: 0 }, expiryPipeline: [],
  triggeredIncidents: [], contractorCoverage: [], contractorPct: 0
};

export default async function TrainingAnalyticsPage() {
  const a = await backendFetch<TrainingAnalytics>("/api/training/analytics").catch(
    () => EMPTY_ANALYTICS
  );

  const cnt = (s: string) => a.statusCounts[s] ?? 0;
  const totalCerts = a.totalCerts;
  const activePct = a.activePct;
  const statutoryActive = a.statutoryActive;
  const expiringSoon30 = a.expiring30;
  const expiringSoon60 = a.expiring60;
  const expiringSoon90 = a.expiring90;
  const plants = a.plants;
  const plantStats = new Map(plants.map((p) => [p.id, { active: p.active, total: p.total }]));
  const topPrograms = a.topPrograms;
  const contractorCoverage = a.contractorCoverage;
  const contractorPct = a.contractorPct;
  const contractorTotals = contractorCoverage.reduce(
    (acc, c) => ({ total: acc.total + c.total, covered: acc.covered + c.covered }),
    { total: 0, covered: 0 }
  );
  const reviewedCerts = { length: a.effectiveness.reviewedCount };
  const avgRating = a.effectiveness.avgRating;
  const triggeredFromIncidents = a.triggeredIncidents;
  const monthBuckets = new Map(a.expiryPipeline.map((b) => [b.month, b.count]));
  const maxMonth = Math.max(1, ...a.expiryPipeline.map((b) => b.count));

  return (
    <div>
      <PageHeader
        title="Training Analytics"
        description="Compliance, expiry pipeline, effectiveness — the leading indicators of competency."
        breadcrumbs={[{ label: "Training", href: "/training" }, { label: "Analytics" }]}
      />

      {/* ─── Top stat strip ─── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <StatCard label="Total certificates" value={totalCerts} icon={Sparkles} tone="primary" />
        <StatCard
          label={`Active (${activePct}% compliance)`}
          value={cnt("ACTIVE")}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Expiring soon"
          value={cnt("EXPIRING_SOON")}
          icon={AlertTriangle}
          tone="amber"
        />
        <StatCard label="Expired / Lapsed" value={cnt("EXPIRED") + cnt("LAPSED")} icon={Sparkles} tone="slate" />
        <StatCard label="Revoked" value={cnt("REVOKED")} icon={XCircle} tone="rose" />
      </div>

      {/* ─── Contractor training coverage ─── */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Contractor Training Coverage</CardTitle>
          <CardDescription>
            {contractorTotals.total > 0
              ? `${contractorTotals.covered}/${contractorTotals.total} contractor workers hold valid training (${contractorPct}% coverage).`
              : "Training coverage for contract workforce (from contractor worker records)."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contractorCoverage.length === 0 ? (
            <p className="text-sm text-slate-500">No contractor workers on record yet.</p>
          ) : (
            <div className="space-y-2">
              {contractorCoverage.map((c) => {
                const pct = c.total > 0 ? Math.round((c.covered / c.total) * 100) : 0;
                return (
                  <div key={c.company} className="flex items-center gap-3">
                    <div className="w-44 truncate text-sm" title={c.company}>{c.company}</div>
                    <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
                      <div
                        className={pct >= 80 ? "h-full bg-emerald-500" : pct >= 50 ? "h-full bg-amber-500" : "h-full bg-rose-500"}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-32 text-right text-xs text-slate-500 tabular-nums">
                      {c.covered}/{c.total}
                      {c.expiring > 0 && <span className="text-amber-600"> · {c.expiring} expiring</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Expiry pipeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays size={16} /> Expiry Pipeline (next 12 months)
            </CardTitle>
            <CardDescription className="text-xs">
              Plan refresher capacity by quarter. Red bars are within 30 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {Array.from(monthBuckets.entries()).map(([key, count], idx) => {
                const [yr, mo] = key.split("-");
                const monthName = new Date(Number(yr), Number(mo) - 1, 1).toLocaleString("en-GB", {
                  month: "short",
                  year: "2-digit",
                });
                const pct = (count / maxMonth) * 100;
                const tone = idx === 0 ? "bg-rose-500" : idx <= 2 ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <div className="w-14 text-slate-600 font-medium shrink-0">{monthName}</div>
                    <div className="flex-1 bg-slate-100 rounded h-5 relative overflow-hidden">
                      <div
                        className={`${tone} h-full rounded transition-all`}
                        style={{ width: count > 0 ? `${pct}%` : "0%" }}
                      />
                      <span className="absolute inset-0 flex items-center px-2 font-medium text-slate-800">
                        {count > 0 ? count : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <Mini label="Next 30d" value={expiringSoon30} tone="rose" />
              <Mini label="30–60d" value={expiringSoon60} tone="amber" />
              <Mini label="60–90d" value={expiringSoon90} tone="emerald" />
            </div>
          </CardContent>
        </Card>

        {/* Per-plant compliance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity size={16} /> Per-plant Compliance
            </CardTitle>
            <CardDescription className="text-xs">
              % of certificates currently ACTIVE per plant. Below 90% is a red flag.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {plants.map((p) => {
              const s = plantStats.get(p.id) ?? { active: 0, total: 0 };
              const pct = s.total > 0 ? Math.round((s.active / s.total) * 100) : 0;
              const tone =
                pct >= 95
                  ? "bg-emerald-500"
                  : pct >= 75
                  ? "bg-amber-500"
                  : "bg-rose-500";
              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{p.name}</span>
                    <span className="text-slate-500">
                      {s.active}/{s.total} active · <strong>{pct}%</strong>
                    </span>
                  </div>
                  <div className="bg-slate-100 rounded h-2 overflow-hidden">
                    <div
                      className={`${tone} h-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {plants.length === 0 && (
              <div className="text-xs text-slate-500">No plants configured.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Top programs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp size={16} /> Top Programs (by issuance)
            </CardTitle>
            <CardDescription className="text-xs">
              Most-certified programs. SafeOps gates marked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topPrograms.length === 0 ? (
              <div className="text-xs text-slate-500">No certificates issued yet.</div>
            ) : (
              topPrograms.map((tp) => {
                // The backend already resolved the programme and which gates it
                // blocks, so the row renders straight from the payload.
                const program = tp;
                const gates = tp.gates;
                return (
                  <Card
                    key={program.id}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-2 text-xs shadow-none">
                    <div>
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        {program.isStatutory && (
                          <ShieldAlert size={11} className="text-rose-600" />
                        )}
                        <Link
                          href={`/training/programs/${program.id}`}
                          className="hover:text-primary-700"
                        >
                          {program.name}
                        </Link>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {program.code}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {gates.map((g) => (
                        <Badge
                          key={g}
                          className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                        >
                          {g}
                        </Badge>
                      ))}
                      <span className="font-bold text-slate-900">{tp.count}</span>
                    </div>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Statutory + Effectiveness */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Compliance Highlights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50/40 p-3">
              <div className="text-xs text-rose-700 uppercase tracking-wide font-medium">
                Statutory training
              </div>
              <div className="text-2xl font-bold text-rose-900 mt-1">{statutoryActive}</div>
              <div className="text-xs text-rose-700 mt-0.5">
                ACTIVE statutory certificates across the platform.{" "}
                Inspections key off this number.
              </div>
            </Alert>

            <Alert variant="warning" className="rounded-md border border-amber-200 bg-amber-50/40 p-3">
              <div className="text-xs text-amber-700 uppercase tracking-wide font-medium">
                Effectiveness rating
              </div>
              <div className="flex items-end gap-2 mt-1">
                <div className="text-2xl font-bold text-amber-900">
                  {avgRating > 0 ? avgRating.toFixed(1) : "—"}
                </div>
                <div className="text-sm text-amber-700">/ 5.0</div>
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Average across {reviewedCerts.length} reviewed certificate
                {reviewedCerts.length === 1 ? "" : "s"}. Higher = training translates to
                competency in the field.
              </div>
            </Alert>

            <Alert variant="brand" className="rounded-md border border-violet-200 bg-violet-50/40 p-3">
              <div className="text-xs text-violet-700 uppercase tracking-wide font-medium">
                Triggered from incidents
              </div>
              <div className="text-2xl font-bold text-violet-900 mt-1">
                {triggeredFromIncidents.length}
              </div>
              <div className="text-xs text-violet-700 mt-0.5">
                Recent incidents whose root cause flagged a training gap. L&D should review.
              </div>
              {triggeredFromIncidents.length > 0 && (
                <div className="mt-2 space-y-1 text-[11px]">
                  {triggeredFromIncidents.slice(0, 3).map((inc) => (
                    <Link
                      key={inc.id}
                      href={`/incidents/${inc.id}`}
                      className="block text-violet-800 hover:text-violet-900"
                    >
                      <span className="font-mono">{inc.number}</span> ·{" "}
                      {inc.triggeredTrainingFor.length} affected ·{" "}
                      {(inc.triggeredTrainingKeywords ?? []).slice(0, 2).join(", ")}
                    </Link>
                  ))}
                </div>
              )}
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* ─── Heinrich connection ─── */}
      <Card className="border-slate-300 bg-slate-50/40 mb-4">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Activity size={28} className="text-slate-500 mt-1 shrink-0" />
            <div>
              <div className="text-sm font-medium text-slate-800">
                Training is a leading indicator
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Plants with under <strong>90% training compliance</strong> historically run
                3.2× more incidents than fully-compliant plants. Use the Per-plant
                Compliance widget above to identify which sites need a refresher push
                this quarter.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: any;
  tone: "primary" | "emerald" | "amber" | "slate" | "rose";
}) {
  const tones: Record<string, string> = {
    primary: "border-primary-200 bg-primary-50",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    slate: "border-slate-200 bg-slate-50",
    rose: "border-rose-200 bg-rose-50",
  };
  const iconTones: Record<string, string> = {
    primary: "text-primary-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    slate: "text-slate-600",
    rose: "text-rose-700",
  };
  return (
    <Card className={`border ${tones[tone]}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <Icon size={26} className={iconTones[tone]} />
        <div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-600">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "rose" | "amber" | "emerald";
}) {
  const tones: Record<string, string> = {
    rose: "bg-rose-50 text-rose-800 border-rose-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
  };
  return (
    <div className={`rounded border p-2 ${tones[tone]}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}
