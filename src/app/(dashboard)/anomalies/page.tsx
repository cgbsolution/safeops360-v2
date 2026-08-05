import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, ShieldAlert, Eye, Mail } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";

export const dynamic = "force-dynamic";

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-rose-100 text-rose-800 border-rose-200",
  WARNING: "bg-amber-100 text-amber-800 border-amber-200",
  INFO: "bg-sky-100 text-sky-800 border-sky-200"
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: "bg-blue-100 text-blue-800 border-blue-200",
  ACKNOWLEDGED: "bg-violet-100 text-violet-800 border-violet-200",
  CONFIRMED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DISMISSED: "bg-slate-100 text-slate-700 border-slate-200",
  EXPIRED: "bg-slate-100 text-slate-500 border-slate-200"
};

const DETECTOR_LABEL: Record<string, string> = {
  FREQUENCY_SPIKE: "Frequency spike",
  SEVERITY_DRIFT: "Severity drift",
  HOTSPOT_CLUSTER: "Hot-spot cluster",
  PERSON_OF_CONCERN: "Person of concern",
  CROSS_CORRELATION: "Cross-correlation"
};

export default async function AnomaliesPage(props: { searchParams: Promise<{ status?: string; severity?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const where: Record<string, any> = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.severity) where.severity = searchParams.severity;

  const anomalies = await prisma.anomaly.findMany({
    where,
    include: {
      plant: { select: { code: true, name: true } },
      reviewer: { select: { name: true } }
    },
    // Newest-created first (platform-wide list convention). Anomaly has no
    // createdAt — `detectedAt` IS its insert timestamp (server default now()).
    // The old status-then-date grouping pushed freshly-detected anomalies
    // below older open ones.
    orderBy: [{ detectedAt: "desc" }, { id: "desc" }],
    take: 200
  });

  const counts = await prisma.anomaly.groupBy({ by: ["status"], _count: true });
  const statusCounts: Record<string, number> = {};
  counts.forEach((c) => { statusCounts[c.status] = c._count; });
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        title="Anomalies"
        description="Detected by the AnomalyDetectionAgent — frequency spikes, severity drift, hot-spots, repeat behaviour, and cross-correlations across safety records."
      />
      <FilterTabsList label="Status" className="mb-4">
        <FilterTab href="/anomalies" label="All" count={total} active={!searchParams.status} />
        <FilterTab href="/anomalies?status=PENDING_REVIEW" label="Pending review" count={statusCounts.PENDING_REVIEW ?? 0} active={searchParams.status === "PENDING_REVIEW"} tone="blue" />
        <FilterTab href="/anomalies?status=ACKNOWLEDGED" label="Acknowledged" count={statusCounts.ACKNOWLEDGED ?? 0} active={searchParams.status === "ACKNOWLEDGED"} />
        <FilterTab href="/anomalies?status=CONFIRMED" label="Confirmed" count={statusCounts.CONFIRMED ?? 0} active={searchParams.status === "CONFIRMED"} tone="emerald" />
        <FilterTab href="/anomalies?status=DISMISSED" label="Dismissed" count={statusCounts.DISMISSED ?? 0} active={searchParams.status === "DISMISSED"} tone="slate" />
      </FilterTabsList>
      {anomalies.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Activity className="mx-auto text-slate-300" size={36} />
            <p className="text-sm text-slate-500 mt-3">
              No anomalies match this filter.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Detectors run automatically on observation closure (Rule 9). They also run on a nightly schedule once configured.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {anomalies.map((a) => (
              <Link
                key={a.id}
                href={`/anomalies/${a.id}`}
                className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 transition"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {a.severity === "CRITICAL" ? (
                    <ShieldAlert size={18} className="text-rose-600" />
                  ) : a.severity === "WARNING" ? (
                    <AlertTriangle size={18} className="text-amber-600" />
                  ) : (
                    <Activity size={18} className="text-sky-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={`text-[10px] ${SEVERITY_COLORS[a.severity] ?? ""}`}>
                      {a.severity}
                    </Badge>
                    <Badge className={`text-[10px] ${STATUS_COLORS[a.status] ?? ""}`}>
                      {a.status.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {DETECTOR_LABEL[a.detectorId] ?? a.detectorId}
                    </span>
                    {a.plant && (
                      <span className="text-xs text-slate-500">· {a.plant.code}</span>
                    )}
                    {a.category && (
                      <span className="text-xs text-slate-500">· {a.category}</span>
                    )}
                    {a.emailNotifiedAt && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                        <Mail size={10} /> notified
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-800">{a.description}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Detected {formatDateTime(a.detectedAt)}
                    {a.reviewedAt && a.reviewer && (
                      <> · Reviewed by {a.reviewer.name} on {formatDateTime(a.reviewedAt)}</>
                    )}
                  </div>
                </div>
                <Eye size={14} className="text-slate-400 mt-1 flex-shrink-0" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

