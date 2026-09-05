import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CrewSignoffPanel } from "@/components/flra/crew-signoff-panel";
import { RedoFlraPanel } from "@/components/flra/redo-flra-panel";
import { formatDate, formatDateTime, humanize } from "@/lib/utils";
import { CheckCircle2, ArrowUpRight, AlertTriangle, Heart, Printer, ShieldAlert, XCircle } from "lucide-react";
import { PrintButton } from "@/components/ui/print-button";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const RISK_COLORS: Record<string, string> = {
  Low: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Medium: "bg-amber-100 text-amber-800 border-amber-200",
  High: "bg-orange-100 text-orange-800 border-orange-200",
  Critical: "bg-rose-100 text-rose-800 border-rose-200"
};

const STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  SUPERSEDED: "bg-slate-200 text-slate-600 border-slate-300",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200"
};

export default async function FLRADetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? "";

  // Plant, leader, linked permit, crew signatures, team, job steps with their
  // hazards, fitness declarations and the re-do chain all arrive nested. The
  // endpoint enforces FLRA.READ for this record, so no access means null here.
  const f = await backendFetch<any>(`/api/flra/${params.id}`).catch(() => null);
  if (!f) return notFound();

  const hazards: any[] = (() => {
    try {
      const parsed = JSON.parse(f.hazards);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const myCrewRow = f.crewSignatures.find((s: any) => s.userId === userId) ?? null;
  const isOnCrew = !!myCrewRow;
  const allSigned = f.crewSignatures.length > 0 && f.crewSignatures.every((s: any) => s.signed);
  const signedCount = f.crewSignatures.filter((s: any) => s.signed).length;

  // Re-do is gated to crew members + privileged roles, while the FLRA is live
  const role = (session?.user as any)?.role ?? "";
  const isPrivileged = role === "HSE_MANAGER" || role === "ADMIN";
  const canRedo =
    (f.status === "IN_PROGRESS" || f.status === "COMPLETED") &&
    (isOnCrew || isPrivileged);

  // Permit-state lock — sign / re-do are blocked once the permit is no longer
  // in a workable state. We render the buttons but they show a tooltip from the
  // sub-component when blocked.
  const permitLocked = !!f.permit && ["SUSPENDED", "EXPIRED", "CLOSED", "REJECTED"].includes(f.permit.status);

  return (
    <div>
      <PageHeader
        title={f.number}
        description={`FLRA · ${f.location}`}
        breadcrumbs={[{ label: "FLRA", href: "/flra" }, { label: f.number }]}
        action={
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS[f.status]}>{humanize(f.status)}</Badge>
            <PrintButton />
          </div>
        }
      />

      {/* Linked permit banner — clickable, status-aware */}
      {f.permit && (
        <Link
          href={`/ptw/${f.permit.id}`}
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 p-3 hover:bg-primary-100 transition"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm text-primary-900">Linked to permit</span>
              <span className="font-mono font-semibold text-primary-900">{f.permit.number}</span>
              <Badge className="bg-white text-primary-700 border-primary-200 text-[10px]">
                {humanize(f.permit.type)}
              </Badge>
              <Badge
                className={
                  f.permit.status === "ACTIVE"
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"
                    : f.permit.status === "SUSPENDED"
                      ? "bg-amber-100 text-amber-700 border-amber-200 text-[10px]"
                      : "bg-blue-100 text-blue-700 border-blue-200 text-[10px]"
                }
              >
                {humanize(f.permit.status)}
              </Badge>
            </div>
            <div className="text-xs text-primary-700">
              {f.permit.location} · {f.permit.plant.name}
            </div>
            <div className="text-[11px] text-primary-700">
              Validity {formatDateTime(f.permit.validFrom)} – {formatDateTime(f.permit.validTo)}
            </div>
          </div>
          <ArrowUpRight size={16} className="text-primary-700 mt-1" />
        </Link>
      )}

      {/* Supersession banners */}
      {f.status === "SUPERSEDED" && f.supersededBy && (
        <Alert variant="muted" size="lg" className="mb-4 border-slate-300">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size={14} /> This FLRA was superseded
          </div>
          {f.supersededReason && <div className="text-xs text-slate-600 mt-1">Reason: {f.supersededReason}</div>}
          <div className="text-xs mt-1">
            Replaced by{" "}
            <Link href={`/flra/${f.supersededBy.id}`} className="font-mono font-semibold hover:underline">
              {f.supersededBy.number}
            </Link>
          </div>
        </Alert>
      )}
      {f.supersedes.length > 0 && (
        <Card className="mb-4 p-3 text-xs text-slate-600 shadow-none">
          Supersedes: {f.supersedes.map((s: any, i: number) => (
            <span key={s.id}>
              <Link href={`/flra/${s.id}`} className="font-mono hover:underline text-slate-800">{s.number}</Link>
              {s.supersededReason && <span className="text-slate-500"> ({s.supersededReason})</span>}
              {i < f.supersedes.length - 1 ? ", " : ""}
            </span>
          ))}
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Crew sign-off panel — primary action surface for the whole module */}
          <CrewSignoffPanel
            flraId={f.id}
            flraNumber={f.number}
            flraStatus={f.status}
            permitLocked={permitLocked}
            currentUserId={userId}
            crew={f.crewSignatures.map((s: any) => ({
              id: s.id,
              userId: s.userId,
              name: s.user.name,
              designation: s.user.designation ?? null,
              signed: s.signed,
              signedAt: s.signedAt,
              trainingValid: s.trainingValidAtSignature,
              trainingExpiresAt: s.trainingExpiresAt
            }))}
          />

          <Card>
            <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Description</div>
                <p className="text-slate-800">{f.jobDescription}</p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Team Members</div>
                <div className="flex flex-wrap gap-2">
                  {f.teamMembers.length === 0 && <span className="text-slate-400 text-xs">—</span>}
                  {f.teamMembers.map((m: any) => (
                    <Badge key={m.id} className="bg-slate-100 text-slate-700 border-slate-200">
                      {m.user.name}{m.user.designation ? ` · ${m.user.designation}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {f.jobSteps.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert size={16} /> Hazard Analysis ({f.jobSteps.length} step{f.jobSteps.length === 1 ? "" : "s"})
                </CardTitle>
                <CardDescription>5×5 risk matrix · likelihood × severity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {f.jobSteps.map((s: any) => (
                  <div key={s.id} className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        {s.sequence}
                      </span>
                      <div className="text-sm font-medium">{s.stepDescription}</div>
                    </div>
                    <div className="space-y-2">
                      {s.hazards.map((h: any) => (
                        <div key={h.id} className="text-xs rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="font-medium text-slate-800">{h.hazardDescription}</div>
                          <div className="grid sm:grid-cols-2 gap-2 mt-1.5">
                            <div>
                              <div className="text-[10px] uppercase text-slate-500">Initial</div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-slate-700">{h.initialLikelihood}×{h.initialSeverity}</span>
                                <Badge className={[
                                  "text-[10px]",
                                  h.initialRiskLevel === "CRITICAL" ? "bg-rose-100 text-rose-700 border-rose-200"
                                  : h.initialRiskLevel === "HIGH" ? "bg-orange-100 text-orange-700 border-orange-200"
                                  : h.initialRiskLevel === "MEDIUM" ? "bg-amber-100 text-amber-700 border-amber-200"
                                  : "bg-emerald-100 text-emerald-700 border-emerald-200"
                                ].join(" ")}>
                                  {h.initialRiskScore} · {h.initialRiskLevel}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase text-slate-500">Residual</div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-slate-700">{h.residualLikelihood}×{h.residualSeverity}</span>
                                <Badge className={[
                                  "text-[10px]",
                                  h.residualRiskLevel === "CRITICAL" ? "bg-rose-100 text-rose-700 border-rose-200"
                                  : h.residualRiskLevel === "HIGH" ? "bg-orange-100 text-orange-700 border-orange-200"
                                  : h.residualRiskLevel === "MEDIUM" ? "bg-amber-100 text-amber-700 border-amber-200"
                                  : "bg-emerald-100 text-emerald-700 border-emerald-200"
                                ].join(" ")}>
                                  {h.residualRiskScore} · {h.residualRiskLevel}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="mt-1.5 text-slate-600">
                            <span className="font-medium">Controls: </span>
                            {h.controlMeasures}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Hazard Identification</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader className="border-y bg-slate-50">
                    <TableRow>
                      <TableHead>Step</TableHead>
                      <TableHead>Hazard</TableHead>
                      <TableHead>Initial</TableHead>
                      <TableHead>Control</TableHead>
                      <TableHead>Residual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hazards.map((h: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="align-top font-medium">{h.step}</TableCell>
                        <TableCell className="align-top text-slate-700">{h.hazard}</TableCell>
                        <TableCell className="align-top"><Badge className={RISK_COLORS[h.risk]}>{h.risk}</Badge></TableCell>
                        <TableCell className="align-top text-slate-700">{h.control}</TableCell>
                        <TableCell className="align-top"><Badge className={RISK_COLORS[h.residualRisk]}>{h.residualRisk}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {f.fitnessDeclarations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Heart size={16} /> Fitness Declarations ({f.fitnessDeclarations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {f.fitnessDeclarations.map((fd: any) => (
                  <div
                    key={fd.id}
                    className={[
                      "flex items-center justify-between gap-2 rounded-md border p-2 text-xs",
                      fd.isFit ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"
                    ].join(" ")}
                  >
                    <div>
                      <div className="font-medium">{fd.user.name}</div>
                      <div className="text-slate-600 text-[11px]">
                        Rest: {fd.hadAdequateRest ? "✓" : "✗"} · Influence-free: {fd.underInfluenceCheck ? "✓" : "✗"}
                        {fd.hasMedicalCondition && " · Medical condition declared"}
                      </div>
                      {fd.conditionsDeclared && (
                        <div className="text-[11px] text-slate-600 mt-0.5">{fd.conditionsDeclared}</div>
                      )}
                    </div>
                    {fd.isFit ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                        <CheckCircle2 size={10} /> Fit
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]">
                        <XCircle size={10} /> Not fit
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Re-do panel — anchored at #redo for the "Re-do FLRA" button to scroll to */}
          {canRedo && (
            <div id="redo">
              <RedoFlraPanel flraId={f.id} permitLocked={permitLocked} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status</CardTitle>
              <CardDescription className="text-xs">
                {signedCount}/{f.crewSignatures.length} crew signed
                {allSigned && f.completedAt && <> · completed {formatDateTime(f.completedAt)}</>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Date" value={formatDate(f.date)} />
              <Row label="Plant" value={f.plant.name} />
              <Row label="Location" value={f.location} />
              <Row label="Leader" value={f.leader.name} />
              <Row label="Toolbox Talk by" value={f.toolboxTalkBy?.name ?? "—"} />
            </CardContent>
          </Card>

          {f.toolboxTalkConfirmed && (
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-4 flex items-center gap-3 text-sm">
                <CheckCircle2 className="text-emerald-700" size={18} />
                <div>
                  <div className="font-semibold text-emerald-900">Toolbox Talk Confirmed</div>
                  <div className="text-xs text-emerald-700">All team members briefed</div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right">{value}</span>
    </div>
  );
}
