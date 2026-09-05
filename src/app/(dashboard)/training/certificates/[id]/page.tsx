import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, ShieldAlert, Sparkles, Star, XCircle } from "lucide-react";
import { CertificateRevokeButton } from "@/components/training/certificate-revoke-button";
import { EffectivenessReviewButton } from "@/components/training/effectiveness-review-button";
import { PrintButton } from "@/components/ui/print-button";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  EXPIRING_SOON: "bg-amber-100 text-amber-800 border-amber-200",
  EXPIRED: "bg-slate-200 text-slate-700 border-slate-300",
  LAPSED: "bg-slate-300 text-slate-800 border-slate-400",
  REVOKED: "bg-rose-100 text-rose-800 border-rose-200",
};

const REVOCATION_REASONS: Record<string, string> = {
  INCIDENT_INVOLVEMENT: "Incident involvement",
  DISCIPLINARY: "Disciplinary action",
  ROLE_CHANGE: "Role change",
  HEALTH_REASONS: "Health reasons",
  TRAINING_FRAUD: "Training fraud",
  OTHER: "Other",
};

export default async function CertificateDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "";

  // The endpoint applies the own-vs-privileged read rule itself, then nests
  // the programme, holder, and the people behind each state change.
  const cert = await backendFetch<any>(`/api/training/certificates/${params.id}`).catch(
    () => null
  );
  if (!cert) return notFound();

  const isRevoked = cert.status === "REVOKED";
  const isStatutory = cert.program.isStatutory;
  const verifyUrl = `/verify/training/${cert.certificateNumber}`;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={cert.certificateNumber}
        description={`${cert.program.programName ?? cert.program.name} · ${cert.user.name}`}
        breadcrumbs={[
          { label: "Training", href: "/training" },
          { label: "Certificates", href: "/training/certificates" },
          { label: cert.certificateNumber },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Badge className={STATUS_BADGE[cert.status] ?? ""}>
              {cert.status.replace(/_/g, " ")}
            </Badge>
            {isStatutory && (
              <Badge className="bg-rose-100 text-rose-800 border-rose-200">
                <ShieldAlert size={11} /> Statutory
              </Badge>
            )}
            <PrintButton />
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Status banner */}
          {isRevoked && (
            <Card className="border-rose-300 bg-rose-50">
              <CardContent className="p-4 flex items-start gap-3">
                <XCircle size={28} className="text-rose-700 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-rose-900">
                    REVOKED
                  </div>
                  <div className="text-xs text-rose-800 mt-1">
                    Reason:{" "}
                    {REVOCATION_REASONS[cert.revocationReason ?? ""] ??
                      cert.revocationReason}
                  </div>
                  {cert.revocationDetails && (
                    <div className="text-xs text-rose-700 mt-1">
                      {cert.revocationDetails}
                    </div>
                  )}
                  {cert.revokedAt && (
                    <div className="text-[11px] text-rose-600 mt-1">
                      Revoked by {cert.revokedBy?.name ?? "—"} on{" "}
                      {formatDateTime(cert.revokedAt)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="print:shadow-none">
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles size={16} /> Certificate
                </CardTitle>
                <CardDescription className="text-xs">
                  Tamper-evident · QR verifiable
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={verifyUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={12} /> Public verify
                </a>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <Field label="Number" value={cert.certificateNumber} mono />
                <Field label="Holder" value={cert.user.name} />
                <Field
                  label="Program"
                  value={cert.program.programName ?? cert.program.name}
                />
                <Field
                  label="Program Code"
                  value={cert.program.programCode ?? cert.program.code}
                  mono
                />
                <Field label="Issued" value={formatDate(cert.issuedAt)} />
                <Field label="Issued By" value={cert.issuedBy?.name ?? "—"} />
                <Field label="Valid From" value={formatDate(cert.validFrom)} />
                <Field
                  label="Valid Until"
                  value={cert.validTo ? formatDate(cert.validTo) : "Lifetime"}
                />
                <Field
                  label="Score"
                  value={
                    cert.finalAssessmentScore !== null
                      ? `${cert.finalAssessmentScore}%`
                      : "—"
                  }
                />
                <Field
                  label="Attendance"
                  value={
                    cert.attendancePercent !== null
                      ? `${cert.attendancePercent}%`
                      : "—"
                  }
                />
              </div>

              <Card className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs space-y-1 shadow-none">
                <div className="text-[10px] uppercase text-slate-500">
                  Tamper-detection signature
                </div>
                <div className="font-mono break-all text-slate-700">
                  {cert.digitalSignature ?? "—"}
                </div>
              </Card>
            </CardContent>
          </Card>

          {cert.effectivenessReviewedAt && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Star size={14} /> Effectiveness Review
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={
                        (cert.effectivenessRating ?? 0) > i
                          ? "text-amber-500 fill-amber-500"
                          : "text-slate-300"
                      }
                    />
                  ))}
                  <span className="ml-2 font-medium">
                    {cert.effectivenessRating}/5
                  </span>
                </div>
                <div className="text-slate-500">
                  Reviewed by {cert.effectivenessReviewedBy?.name ?? "—"} on{" "}
                  {formatDateTime(cert.effectivenessReviewedAt)}
                </div>
                {cert.effectivenessNotes && (
                  <div className="text-slate-700 mt-2 whitespace-pre-wrap">
                    {cert.effectivenessNotes}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4 print:hidden">
          {(cert.status === "ACTIVE" ||
            cert.status === "EXPIRING_SOON" ||
            cert.status === "EXPIRED") && (
            <Card className="border-rose-200 bg-rose-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Admin Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <CertificateRevokeButton
                  certificateId={cert.id}
                  certificateNumber={cert.certificateNumber}
                  currentRole={role}
                />
              </CardContent>
            </Card>
          )}

          {!cert.effectivenessReviewedAt &&
            (cert.status === "ACTIVE" || cert.status === "EXPIRING_SOON") && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Effectiveness Review</CardTitle>
                  <CardDescription className="text-xs">
                    Capture how well the training translated to competency.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EffectivenessReviewButton
                    certificateId={cert.id}
                    currentRole={role}
                  />
                </CardContent>
              </Card>
            )}

          {cert.registration?.schedule && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Source</CardTitle>
              </CardHeader>
              <CardContent className="text-xs">
                Issued from schedule{" "}
                <a
                  href={`/training/schedules/${cert.registration.schedule.id}`}
                  className="font-mono text-primary-700 hover:underline"
                >
                  {cert.registration.schedule.scheduleNumber}
                </a>
              </CardContent>
            </Card>
          )}

          {cert.program.refresherProgramCode && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Renewal</CardTitle>
                <CardDescription className="text-xs">
                  When this certificate enters EXPIRING_SOON, learners are
                  auto-registered for refresher{" "}
                  <span className="font-mono">{cert.program.refresherProgramCode}</span>.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={[
          "font-medium text-slate-900 mt-0.5",
          mono ? "font-mono text-xs" : "text-sm",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
