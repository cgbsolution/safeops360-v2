import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  ShieldAlert,
  ChevronLeft,
  Mail,
  MapPin,
  Building2,
  Tag,
  User as UserIcon
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

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

// Map a contributing record id to its source-module detail route so the
// reviewer can click through to "what made the algorithm fire".
function recordHref(module: string, id: string): string | null {
  switch (module) {
    case "OBSERVATION":
      return `/observations/${id}`;
    case "NEAR_MISS":
      return `/near-miss/${id}`;
    case "INCIDENT":
      return `/incidents/${id}`;
    default:
      return null;
  }
}

export default async function AnomalyDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const anomaly = await prisma.anomaly.findUnique({
    where: { id },
    include: {
      plant: { select: { code: true, name: true } },
      reviewer: { select: { name: true } },
      person: { select: { name: true } }
    }
  });
  if (!anomaly) notFound();

  const SeverityIcon =
    anomaly.severity === "CRITICAL"
      ? ShieldAlert
      : anomaly.severity === "WARNING"
      ? AlertTriangle
      : Activity;
  const severityTone =
    anomaly.severity === "CRITICAL"
      ? "text-rose-600"
      : anomaly.severity === "WARNING"
      ? "text-amber-600"
      : "text-sky-600";

  const signal = (anomaly.signalData ?? {}) as Record<string, unknown>;
  const signalEntries = Object.entries(signal);

  return (
    <div>
      <Link
        href="/anomalies"
        className="inline-flex items-center gap-1 text-sm text-primary-700 hover:underline mb-3"
      >
        <ChevronLeft size={14} /> Back to anomalies
      </Link>

      <PageHeader
        title={DETECTOR_LABEL[anomaly.detectorId] ?? anomaly.detectorId}
        description={`Detected ${formatDateTime(anomaly.detectedAt)} · ${anomaly.module.replace(/_/g, " ")}`}
        action={
          <div className="flex items-center gap-2">
            <Badge className={`${SEVERITY_COLORS[anomaly.severity] ?? ""}`}>
              {anomaly.severity}
            </Badge>
            <Badge className={`${STATUS_COLORS[anomaly.status] ?? ""}`}>
              {anomaly.status.replace(/_/g, " ")}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <SeverityIcon size={20} className={`${severityTone} mt-0.5 shrink-0`} />
                <p className="text-sm text-slate-800 leading-relaxed">
                  {anomaly.description}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="px-5 py-3 border-b text-xs uppercase tracking-wider text-slate-600 font-medium">
                Detection signal
              </div>
              {signalEntries.length === 0 ? (
                <div className="px-5 py-4 text-sm text-slate-400">
                  No signal data recorded.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {signalEntries.map(([k, v]) => (
                      <tr key={k}>
                        <td className="px-5 py-2 text-slate-500 w-1/3 align-top">
                          {k}
                        </td>
                        <td className="px-5 py-2 font-mono text-xs text-slate-800 break-all">
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="px-5 py-3 border-b text-xs uppercase tracking-wider text-slate-600 font-medium">
                Contributing records ({anomaly.contributingRecordIds.length})
              </div>
              {anomaly.contributingRecordIds.length === 0 ? (
                <div className="px-5 py-4 text-sm text-slate-400">
                  No contributing records linked.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {anomaly.contributingRecordIds.map((rid) => {
                    const href = recordHref(anomaly.module, rid);
                    return (
                      <li key={rid} className="px-5 py-2.5 text-sm">
                        {href ? (
                          <Link href={href} className="text-primary-700 hover:underline font-mono text-xs">
                            {anomaly.module} · {rid}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-slate-600">
                            {anomaly.module} · {rid}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="px-5 py-3 border-b text-xs uppercase tracking-wider text-slate-600 font-medium">
                Subject
              </div>
              <dl className="divide-y divide-slate-100">
                <KV icon={Building2} label="Plant" value={anomaly.plant ? `${anomaly.plant.code} — ${anomaly.plant.name}` : "—"} />
                <KV icon={Tag} label="Category" value={anomaly.category ?? "—"} />
                <KV icon={MapPin} label="Area" value={anomaly.area ?? "—"} />
                <KV icon={UserIcon} label="Person" value={anomaly.person?.name ?? "—"} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="px-5 py-3 border-b text-xs uppercase tracking-wider text-slate-600 font-medium">
                Review
              </div>
              <dl className="divide-y divide-slate-100">
                <KV label="Status" value={anomaly.status.replace(/_/g, " ")} />
                <KV label="Reviewer" value={anomaly.reviewer?.name ?? "—"} />
                <KV label="Reviewed at" value={anomaly.reviewedAt ? formatDateTime(anomaly.reviewedAt) : "—"} />
                <KV label="Review note" value={anomaly.reviewNote ?? "—"} />
                <KV
                  label="Email notified"
                  value={anomaly.emailNotifiedAt ? formatDateTime(anomaly.emailNotifiedAt) : "Not sent"}
                  badge={anomaly.emailNotifiedAt ? <Mail size={12} className="text-slate-400" /> : undefined}
                />
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KV({
  icon: Icon,
  label,
  value,
  badge
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-2.5">
      <dt className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
        {Icon && <Icon size={11} className="text-slate-400" />}
        {label}
      </dt>
      <dd className="text-sm text-slate-800 mt-0.5 flex items-center gap-1.5">
        {badge}
        {value}
      </dd>
    </div>
  );
}
