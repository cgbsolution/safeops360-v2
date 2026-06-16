import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { formatDate, daysBetween } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyCertificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = (session.user as any)?.id ?? "";

  const certs = await prisma.trainingCertificate.findMany({
    where: { userId },
    include: {
      program: {
        select: {
          programName: true,
          name: true,
          programCode: true,
          code: true,
          isStatutory: true,
          statutoryReference: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { validTo: "asc" }],
  });

  const now = new Date();
  const activeCount = certs.filter((c) => c.status === "ACTIVE").length;
  const expiringCount = certs.filter((c) => c.status === "EXPIRING_SOON").length;
  const expiredCount = certs.filter((c) =>
    ["EXPIRED", "LAPSED"].includes(c.status)
  ).length;
  const revokedCount = certs.filter((c) => c.status === "REVOKED").length;

  return (
    <div>
      <PageHeader
        title="My Certifications"
        description="All training certifications issued to you. Status updates automatically."
        breadcrumbs={[
          { label: "Training", href: "/training" },
          { label: "My Certifications" },
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat
          icon={CheckCircle2}
          label="Active"
          value={activeCount}
          tone="emerald"
        />
        <Stat
          icon={AlertTriangle}
          label="Expiring soon"
          value={expiringCount}
          tone="amber"
        />
        <Stat icon={Sparkles} label="Expired / Lapsed" value={expiredCount} tone="slate" />
        <Stat icon={XCircle} label="Revoked" value={revokedCount} tone="rose" />
      </div>

      {certs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Sparkles size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-500">No certificates yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {certs.map((c) => {
            const validTo = c.validTo ? new Date(c.validTo) : null;
            const daysToExpiry = validTo ? daysBetween(now, validTo) : null;
            const isWarn = c.status === "EXPIRING_SOON";
            const isBad = ["EXPIRED", "LAPSED", "REVOKED"].includes(c.status);
            return (
              <Card
                key={c.id}
                className={
                  isBad
                    ? "border-rose-200 bg-rose-50/40"
                    : isWarn
                    ? "border-amber-200 bg-amber-50/40"
                    : "border-emerald-200 bg-emerald-50/40"
                }
              >
                <CardContent className="p-3 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900 text-sm">
                        {c.program.programName ?? c.program.name}
                      </span>
                      {c.program.isStatutory && (
                        <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px]">
                          <ShieldAlert size={10} /> Statutory
                        </Badge>
                      )}
                      <Badge
                        className={
                          c.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]"
                            : c.status === "EXPIRING_SOON"
                            ? "bg-amber-100 text-amber-800 border-amber-200 text-[10px]"
                            : c.status === "REVOKED"
                            ? "bg-rose-100 text-rose-800 border-rose-200 text-[10px]"
                            : "bg-slate-200 text-slate-700 border-slate-300 text-[10px]"
                        }
                      >
                        {c.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      <div>
                        <span className="font-mono">{c.certificateNumber}</span> · Issued{" "}
                        {formatDate(c.issuedAt)}
                      </div>
                      {validTo ? (
                        <div>
                          Valid until {formatDate(validTo)}
                          {daysToExpiry !== null && daysToExpiry > 0 && (
                            <span
                              className={[
                                "ml-2 font-medium",
                                daysToExpiry <= 30
                                  ? "text-amber-700"
                                  : "text-emerald-700",
                              ].join(" ")}
                            >
                              ({daysToExpiry} day{daysToExpiry === 1 ? "" : "s"} remaining)
                            </span>
                          )}
                          {daysToExpiry !== null && daysToExpiry < 0 && (
                            <span className="ml-2 text-rose-700 font-medium">
                              (Expired {Math.abs(daysToExpiry)} day{Math.abs(daysToExpiry) === 1 ? "" : "s"} ago)
                            </span>
                          )}
                        </div>
                      ) : (
                        <div>Lifetime</div>
                      )}
                      {c.status === "REVOKED" && c.revocationReason && (
                        <div className="text-rose-700">
                          Revoked: {c.revocationReason.replace(/_/g, " ").toLowerCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Link
                      href={`/training/certificates/${c.id}`}
                      className="text-xs font-medium text-primary-700 hover:text-primary-900"
                    >
                      View
                    </Link>
                    <a
                      href={`/verify/training/${c.certificateNumber}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1"
                      title="Public verification page"
                    >
                      <ExternalLink size={11} /> Verify
                    </a>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: "emerald" | "amber" | "slate" | "rose";
}) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
  };
  return (
    <Card className={`border ${tones[tone]}`}>
      <CardContent className="p-3 flex items-center gap-2">
        <Icon size={20} />
        <div>
          <div className="text-xl font-bold">{value}</div>
          <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
