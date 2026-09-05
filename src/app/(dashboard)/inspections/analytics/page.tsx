import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, ShieldAlert, ClipboardCheck, Clock } from "lucide-react";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function InspectionAnalyticsPage() {
  await requirePermission("INSPECTION.READ");
  const now = new Date();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);

  const [
    inspectionsByStatus,
    inspectionsByType,
    findingsBySeverity,
    findingsByStatus,
    overdueEquipment,
    statutoryDue,
    inspectorLeaders,
    findingsClosureRate
  ] = await Promise.all([
    prisma.inspection.groupBy({ by: ["status"], _count: true }),
    prisma.inspection.findMany({
      where: { createdAt: { gte: sixtyDaysAgo }, inspectionTypeId: { not: null } },
      select: { inspectionTypeId: true, result: true, inspectionType: { select: { name: true, isStatutory: true } } }
    }),
    prisma.inspectionFinding.groupBy({ by: ["severity"], _count: true }),
    prisma.inspectionFinding.groupBy({ by: ["status"], _count: true }),
    prisma.equipmentInspectionType.count({
      where: { isActive: true, nextInspectionDue: { lt: now } }
    }),
    prisma.equipmentInspectionType.count({
      where: {
        isActive: true,
        inspectionType: { isStatutory: true },
        nextInspectionDue: { lt: new Date(now.getTime() + 30 * 86400000) }
      }
    }),
    prisma.inspection.groupBy({
      by: ["inspectorId"],
      where: { status: "COMPLETED", completedDate: { gte: sixtyDaysAgo }, inspectorId: { not: null } },
      _count: true,
      orderBy: { _count: { inspectorId: "desc" } },
      take: 5
    }),
    prisma.inspectionFinding.groupBy({
      by: ["status"],
      where: { createdAt: { gte: sixtyDaysAgo } },
      _count: true
    })
  ]);

  const inspectorLeaderUsers = inspectorLeaders.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: inspectorLeaders.map((l) => l.inspectorId!) } },
        select: { id: true, name: true }
      })
    : [];

  // Aggregate by inspection type for the recent 60-day window
  const typeAgg = new Map<string, { name: string; isStatutory: boolean; total: number; pass: number; fail: number; partial: number }>();
  for (const i of inspectionsByType) {
    if (!i.inspectionTypeId) continue;
    const prev = typeAgg.get(i.inspectionTypeId) ?? {
      name: i.inspectionType?.name ?? "—",
      isStatutory: i.inspectionType?.isStatutory ?? false,
      total: 0, pass: 0, fail: 0, partial: 0
    };
    prev.total++;
    if (i.result === "Pass") prev.pass++;
    else if (i.result === "Fail") prev.fail++;
    else if (i.result === "Partial") prev.partial++;
    typeAgg.set(i.inspectionTypeId, prev);
  }
  const typeRows = Array.from(typeAgg.values()).sort((a, b) => b.total - a.total);

  const cnt = (rows: { _count: any }[], key: string, value: string) => rows.find((r: any) => r[key] === value)?._count ?? 0;

  return (
    <div>
      <PageHeader
        title="Inspection Analytics"
        description="Plant-wide inspection performance — schedule adherence, finding trends, statutory compliance."
        breadcrumbs={[{ label: "Inspections", href: "/inspections" }, { label: "Analytics" }]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard
          icon={<ClipboardCheck size={18} />} label="Completed (60d)"
          value={cnt(inspectionsByStatus, "status", "COMPLETED")} tone="emerald"
        />
        <KpiCard
          icon={<Clock size={18} />} label="In progress"
          value={cnt(inspectionsByStatus, "status", "IN_PROGRESS")} tone="blue"
        />
        <KpiCard
          icon={<AlertTriangle size={18} />} label="Overdue"
          value={cnt(inspectionsByStatus, "status", "OVERDUE")} tone="rose"
          href="/inspections?status=OVERDUE"
        />
        <KpiCard
          icon={<ShieldAlert size={18} />} label="Statutory due (30d)"
          value={statutoryDue} tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader>
            <CardTitle>Findings — by severity</CardTitle>
            <CardDescription>All-time. Use the Findings page for time-bound filtering.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-2">
            <SevTile label="Critical" value={cnt(findingsBySeverity, "severity", "CRITICAL")} tone="rose" />
            <SevTile label="High" value={cnt(findingsBySeverity, "severity", "HIGH")} tone="rose" />
            <SevTile label="Medium" value={cnt(findingsBySeverity, "severity", "MEDIUM")} tone="amber" />
            <SevTile label="Low" value={cnt(findingsBySeverity, "severity", "LOW")} tone="slate" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Findings — by status</CardTitle>
            <CardDescription>Closure rate is closure / (open + in progress + closed + verified).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Row label="Open" value={cnt(findingsByStatus, "status", "OPEN")} />
              <Row label="In progress" value={cnt(findingsByStatus, "status", "IN_PROGRESS")} />
              <Row label="Closed" value={cnt(findingsByStatus, "status", "CLOSED")} />
              <Row label="Verified" value={cnt(findingsByStatus, "status", "VERIFIED")} />
              <Row label="Deferred" value={cnt(findingsByStatus, "status", "DEFERRED")} />
              <Row label="Duplicate" value={cnt(findingsByStatus, "status", "DUPLICATE")} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pass rate by inspection type (last 60 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {typeRows.length === 0 ? (
              <p className="text-sm text-slate-500">No completed inspections in the last 60 days.</p>
            ) : (
              <div className="space-y-2">
                {typeRows.map((t, idx) => {
                  const pct = t.total > 0 ? Math.round((t.pass / t.total) * 100) : 0;
                  return (
                    <div key={idx}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="flex items-center gap-1">
                          {t.isStatutory && <ShieldAlert size={11} className="text-rose-600" />}
                          {t.name}
                        </span>
                        <span className="text-slate-500 text-xs">
                          {t.total} run · {pct}% pass
                          {t.fail > 0 && <span className="text-rose-700 ml-1">({t.fail} fail)</span>}
                        </span>
                      </div>
                      <div className="h-2 rounded bg-slate-100 overflow-hidden">
                        <div
                          className={pct >= 90 ? "bg-emerald-500 h-full" : pct >= 70 ? "bg-amber-500 h-full" : "bg-rose-500 h-full"}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top inspectors (60d)</CardTitle>
            <CardDescription>By count of completed inspections.</CardDescription>
          </CardHeader>
          <CardContent>
            {inspectorLeaders.length === 0 ? (
              <p className="text-sm text-slate-500">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {inspectorLeaders.map((l) => {
                  const u = inspectorLeaderUsers.find((x) => x.id === l.inspectorId);
                  return (
                    <div key={l.inspectorId} className="flex justify-between text-sm">
                      <span>{u?.name ?? "—"}</span>
                      <Badge>{l._count}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600" />
              Equipment overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-700">{overdueEquipment}</div>
            <p className="text-xs text-slate-500 mt-1">Equipment-type pairs with a past-due nextInspectionDue.</p>
            <Link href="/inspections/equipment?due=overdue" className="text-sm text-primary-700 hover:underline">
              View list →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, tone, href }: { icon: React.ReactNode; label: string; value: number; tone: "emerald" | "rose" | "amber" | "blue"; href?: string }) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900"
  };
  const inner = (
    <div className={["border rounded-md p-4", tones[tone]].join(" ")}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-80">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SevTile({ label, value, tone }: { label: string; value: number; tone: "rose" | "amber" | "slate" }) {
  const tones: Record<string, string> = {
    rose: "text-rose-700",
    amber: "text-amber-700",
    slate: "text-slate-600"
  };
  return (
    <Card className="text-center p-3 rounded border border-slate-200 shadow-none">
      <div className={["text-2xl font-bold", tones[tone]].join(" ")}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm border-b last:border-0 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
