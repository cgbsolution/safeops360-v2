import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default async function TrainingAnalyticsPage() {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const in60 = new Date(now.getTime() + 60 * 86400000);
  const in90 = new Date(now.getTime() + 90 * 86400000);

  // ─── Pull everything in parallel ───
  const [
    statusCounts,
    statutoryActive,
    expiringSoon30,
    expiringSoon60,
    expiringSoon90,
    perPlant,
    topProgramsRaw,
    plants,
    programs,
    effectiveness,
    expiryPipelineRaw,
    triggeredFromIncidents,
  ] = await Promise.all([
    prisma.trainingCertificate.groupBy({ by: ["status"], _count: true }),
    prisma.trainingCertificate.count({
      where: { status: "ACTIVE", program: { isStatutory: true } },
    }),
    prisma.trainingCertificate.count({
      where: { validTo: { gte: now, lt: in30 }, status: { in: ["ACTIVE", "EXPIRING_SOON"] } },
    }),
    prisma.trainingCertificate.count({
      where: {
        validTo: { gte: in30, lt: in60 },
        status: { in: ["ACTIVE", "EXPIRING_SOON"] },
      },
    }),
    prisma.trainingCertificate.count({
      where: {
        validTo: { gte: in60, lt: in90 },
        status: { in: ["ACTIVE", "EXPIRING_SOON"] },
      },
    }),
    prisma.trainingCertificate.groupBy({
      by: ["status"],
      _count: true,
      where: { user: { plant: { isNot: null } } },
    }),
    prisma.trainingCertificate.groupBy({
      by: ["programId"],
      _count: true,
      orderBy: { _count: { programId: "desc" } },
      take: 8,
    }),
    prisma.plant.findMany({ select: { id: true, name: true, code: true } }),
    // Single programs lookup with all fields the analytics rendering needs
    prisma.trainingProgram.findMany({
      where: { approvalStatus: "APPROVED", isActive: true },
      select: {
        id: true,
        programName: true,
        name: true,
        programCode: true,
        code: true,
        isStatutory: true,
        blocksPtwIfMissing: true,
        blocksRoleAssignmentIfMissing: true,
        blocksContractorOnboardingIfMissing: true,
      },
    }),
    prisma.trainingCertificate.findMany({
      where: { effectivenessReviewedAt: { not: null } },
      select: { id: true, effectivenessRating: true },
    }),
    // Expiry pipeline — group by month for next 12 months
    prisma.trainingCertificate.findMany({
      where: {
        validTo: { gte: now, lt: new Date(now.getTime() + 365 * 86400000) },
        status: { in: ["ACTIVE", "EXPIRING_SOON"] },
      },
      select: { validTo: true, programId: true },
    }),
    prisma.incident.findMany({
      where: { triggeredTrainingFor: { isEmpty: false } },
      select: {
        id: true,
        number: true,
        date: true,
        triggeredTrainingFor: true,
        triggeredTrainingKeywords: true,
      },
      orderBy: { date: "desc" },
      take: 5,
    }),
  ]);

  const cnt = (s: string) => statusCounts.find((c) => c.status === s)?._count ?? 0;
  const totalCerts = statusCounts.reduce((acc, c) => acc + c._count, 0);
  const activePct = totalCerts > 0 ? Math.round((cnt("ACTIVE") / totalCerts) * 100) : 0;

  // Per-plant compliance: cert counts by plant (need to join via user)
  const certsWithPlant = await prisma.trainingCertificate.findMany({
    select: {
      status: true,
      user: { select: { plantId: true } },
    },
  });
  const plantStats = new Map<string, { active: number; total: number }>();
  for (const p of plants) plantStats.set(p.id, { active: 0, total: 0 });
  for (const c of certsWithPlant) {
    const pid = c.user.plantId;
    if (!pid) continue;
    const s = plantStats.get(pid);
    if (!s) continue;
    s.total++;
    if (c.status === "ACTIVE") s.active++;
  }

  // Top programs by issuance
  const programLookup = new Map(programs.map((p) => [p.id, p]));
  const topPrograms = topProgramsRaw.map((tp) => ({
    program: programLookup.get(tp.programId),
    count: tp._count,
  })).filter((tp) => tp.program);

  // Effectiveness rollup
  const reviewedCerts = effectiveness.filter((e) => e.effectivenessRating !== null);
  const avgRating =
    reviewedCerts.length > 0
      ? reviewedCerts.reduce((acc, e) => acc + (e.effectivenessRating ?? 0), 0) / reviewedCerts.length
      : 0;

  // Expiry pipeline by month
  const monthBuckets = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    monthBuckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const c of expiryPipelineRaw) {
    if (!c.validTo) continue;
    const d = new Date(c.validTo);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + 1);
  }
  const maxMonth = Math.max(1, ...Array.from(monthBuckets.values()));

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
                const program = tp.program!;
                const gates: string[] = [];
                if (program.blocksPtwIfMissing) gates.push("PTW");
                if (program.blocksRoleAssignmentIfMissing) gates.push("Role");
                if (program.blocksContractorOnboardingIfMissing) gates.push("Contractor");
                return (
                  <div
                    key={program.id}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-2 text-xs"
                  >
                    <div>
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        {program.isStatutory && (
                          <ShieldAlert size={11} className="text-rose-600" />
                        )}
                        <Link
                          href={`/training/programs/${program.id}`}
                          className="hover:text-primary-700"
                        >
                          {program.programName ?? program.name}
                        </Link>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {program.programCode ?? program.code}
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
                  </div>
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
            <div className="rounded-md border border-rose-200 bg-rose-50/40 p-3">
              <div className="text-xs text-rose-700 uppercase tracking-wide font-medium">
                Statutory training
              </div>
              <div className="text-2xl font-bold text-rose-900 mt-1">{statutoryActive}</div>
              <div className="text-xs text-rose-700 mt-0.5">
                ACTIVE statutory certificates across the platform.{" "}
                Inspections key off this number.
              </div>
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50/40 p-3">
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
            </div>

            <div className="rounded-md border border-violet-200 bg-violet-50/40 p-3">
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
            </div>
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
