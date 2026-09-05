import { notFound } from "next/navigation";
import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, GraduationCap, User as UserIcon, Award, AlertCircle, CheckCircle2, FileDown, ExternalLink
} from "lucide-react";
import { formatDate, daysBetween } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function TrainingDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  // The endpoint nests employee / programme / trainer and enforces
  // TRAINING.READ for this specific record — a 403 lands here as null, which
  // renders as not-found rather than leaking that the record exists.
  const r = await backendFetch<any>(`/api/training/${params.id}`).catch(() => null);
  if (!r) return notFound();

  const now = new Date();
  const expired = r.validUntil <= now;
  const days = daysBetween(now, r.validUntil);
  const expiringSoon = !expired && days > 0 && days <= 30;

  const validityBadge = !r.passed
    ? { label: "No certificate (failed)", cls: "bg-slate-100 text-slate-700 border-slate-200" }
    : expired
      ? { label: `Expired ${formatDate(r.validUntil)}`, cls: "bg-rose-100 text-rose-800 border-rose-200" }
      : expiringSoon
        ? { label: `Expires in ${days}d`, cls: "bg-amber-100 text-amber-800 border-amber-200" }
        : { label: `Valid till ${formatDate(r.validUntil)}`, cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };

  const trainerLabel = r.trainer
    ? `${r.trainer.name}${r.trainer.designation ? ` — ${r.trainer.designation}` : ""}`
    : r.trainerName ?? "—";

  return (
    <div>
      <PageHeader
        title={`${r.program.name} — ${r.employee.name}`}
        description={`Training record · ${formatDate(r.date)}`}
        breadcrumbs={[{ label: "Training", href: "/training" }, { label: r.program.code }]}
        action={
          <div className="flex items-center gap-2">
            {r.passed ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 inline-flex items-center gap-1">
                <CheckCircle2 size={12} /> Passed{r.score !== null ? ` · ${r.score}` : ""}
              </Badge>
            ) : (
              <Badge className="bg-rose-100 text-rose-800 border-rose-200 inline-flex items-center gap-1">
                <AlertCircle size={12} /> Failed{r.score !== null ? ` · ${r.score}` : ""}
              </Badge>
            )}
            <Badge className={validityBadge.cls}>{validityBadge.label}</Badge>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Program</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Name" value={r.program.name} />
              <Row label="Code" value={r.program.code} mono />
              <Row label="Duration" value={`${r.durationHours} hours`} />
              <Row label="Validity" value={`${r.program.validityMonths} months`} />
              <Row label="Passing Score" value={String(r.program.passingScore)} />
              <Row label="Mandatory" value={r.program.mandatory ? "Yes" : "No"} />
              {r.program.description && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Description</div>
                  <p className="text-slate-700">{r.program.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Assessment</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded border p-3 shadow-none">
                  <div className="text-xs uppercase tracking-wider text-slate-500">Score</div>
                  <div className="text-2xl font-bold mt-1">
                    {r.score !== null ? `${r.score} / 100` : "—"}
                  </div>
                  {r.score !== null && (
                    <div className={`text-[11px] mt-1 ${r.score >= r.program.passingScore ? "text-emerald-700" : "text-rose-700"}`}>
                      {r.score >= r.program.passingScore ? "Above passing threshold" : "Below passing threshold"}
                    </div>
                  )}
                </Card>
                <Card className="rounded border p-3 shadow-none">
                  <div className="text-xs uppercase tracking-wider text-slate-500">Outcome</div>
                  <div className={`text-2xl font-bold mt-1 ${r.passed ? "text-emerald-700" : "text-rose-700"}`}>
                    {r.passed ? "Pass" : "Fail"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {r.passed ? "Certificate issued on this date" : "Re-attempt required"}
                  </div>
                </Card>
              </div>
              {r.remarks && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Remarks</div>
                  <p className="text-slate-700 whitespace-pre-wrap">{r.remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {r.passed && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award size={16} className="text-amber-600" /> Certificate
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {r.certificateUrl ? (
                  <Alert variant="warning" className="flex items-center justify-between rounded border bg-amber-50/40 border-amber-200 p-3">
                    <span className="text-amber-900">Certificate document attached.</span>
                    <Button asChild size="sm" variant="outline">
                      <a href={r.certificateUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={13} /> Open
                      </a>
                    </Button>
                  </Alert>
                ) : (
                  <Card className="flex items-center justify-between rounded border bg-slate-50 border-slate-200 p-3 shadow-none">
                    <span className="text-slate-600 text-xs">
                      No certificate file uploaded yet. Auto-generation ships in the Training depth sprint.
                    </span>
                    <Button size="sm" variant="outline" disabled>
                      <FileDown size={13} /> Download
                    </Button>
                  </Card>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Participant</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Meta icon={UserIcon} label="Employee" value={r.employee.name} />
              {r.employee.designation && <Meta icon={UserIcon} label="Designation" value={r.employee.designation} />}
              {r.employee.department && <Meta icon={UserIcon} label="Department" value={r.employee.department} />}
              <div className="pt-2">
                <Link href={`/training?q=${encodeURIComponent(r.employee.name)}`} className="text-xs text-primary-700 hover:text-primary-900">
                  All training for this employee →
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Session</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Meta icon={CalendarDays} label="Date" value={formatDate(r.date)} />
              <Meta icon={GraduationCap} label="Trainer" value={trainerLabel} />
              <Meta icon={CalendarDays} label="Valid From" value={formatDate(r.date)} />
              <Meta icon={CalendarDays} label="Valid Until" value={formatDate(r.validUntil)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-slate-500 whitespace-nowrap">{label}</span>
      <span className={`font-medium text-slate-900 text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-slate-400 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-slate-900 font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
