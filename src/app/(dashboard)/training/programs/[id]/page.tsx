import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Lock, GraduationCap, ClipboardList, Sparkles } from "lucide-react";
import { ProgramApprovalActions } from "@/components/training/program-approval-actions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  RETIRED: "bg-slate-200 text-slate-500 border-slate-300"
};

export default async function TrainingProgramDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "";

  const program = await prisma.trainingProgram.findUnique({
    where: { id: params.id },
    include: {
      plant: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      questions: { orderBy: { sequence: "asc" } },
      materials: { orderBy: { sequence: "asc" } }
    }
  });
  if (!program) return notFound();

  const validity =
    program.certificateValidityMonths ?? program.validityMonths;
  const passing = program.passingScorePercent ?? program.passingScore;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={program.programName ?? program.name}
        description={`${program.programCode ?? program.code} · ${program.category ?? ""}`}
        breadcrumbs={[
          { label: "Training", href: "/training" },
          { label: "Programs", href: "/training/programs" },
          { label: program.programCode ?? program.code }
        ]}
        action={
          <div className="flex items-center gap-2">
            <Badge
              className={
                STATUS_BADGE[program.approvalStatus] ?? "bg-slate-100 text-slate-700 border-slate-200"
              }
            >
              {program.approvalStatus.replace(/_/g, " ")}
            </Badge>
            {program.isStatutory && (
              <Badge className="bg-rose-100 text-rose-800 border-rose-200">
                <ShieldAlert size={11} /> Statutory
              </Badge>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={`/training/programs/${program.id}/edit`}>Edit</Link>
            </Button>
          </div>
        }
      />

      {/* Approval action panel */}
      <ProgramApprovalActions
        programId={program.id}
        approvalStatus={program.approvalStatus}
        currentRole={role}
      />

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2 space-y-4">
          {program.description && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{program.description}</p>
              </CardContent>
            </Card>
          )}

          {(program.isMandatoryForRoles?.length ||
            program.isMandatoryForPermitTypes?.length ||
            program.isMandatoryForActivities?.length ||
            program.statutoryReference) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <ShieldAlert size={14} /> Statutory & Mandatory
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {program.statutoryReference && (
                  <div>
                    <div className="text-[10px] uppercase text-slate-500">Reference</div>
                    <div className="text-slate-800">{program.statutoryReference}</div>
                  </div>
                )}
                {(program.isMandatoryForRoles?.length ?? 0) > 0 && (
                  <ChipRow label="Mandatory for roles" items={program.isMandatoryForRoles ?? []} />
                )}
                {(program.isMandatoryForPermitTypes?.length ?? 0) > 0 && (
                  <ChipRow
                    label="Mandatory for permit types"
                    items={program.isMandatoryForPermitTypes ?? []}
                  />
                )}
                {(program.isMandatoryForActivities?.length ?? 0) > 0 && (
                  <ChipRow
                    label="Mandatory for activities"
                    items={program.isMandatoryForActivities ?? []}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {(program.blocksPtwIfMissing ||
            program.blocksRoleAssignmentIfMissing ||
            program.blocksContractorOnboardingIfMissing) && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5 text-amber-900">
                  <Lock size={14} /> SafeOps Gates Active
                </CardTitle>
                <CardDescription className="text-xs">
                  Workers without a current certificate cannot:
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                {program.blocksPtwIfMissing && <div>• Be added as PTW crew</div>}
                {program.blocksRoleAssignmentIfMissing && <div>• Be assigned to roles requiring this</div>}
                {program.blocksContractorOnboardingIfMissing && <div>• Pass contractor onboarding</div>}
              </CardContent>
            </Card>
          )}

          {(program.learningObjectives?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <ClipboardList size={14} /> Learning Objectives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-0.5">
                  {(program.learningObjectives ?? []).map((o: string, i: number) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {program.hasAssessment && program.questions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Question Bank ({program.questions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {program.questions.map((q) => (
                  <div key={q.id} className="rounded-md border border-slate-200 bg-white p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-slate-800">
                        Q{q.sequence}. {q.questionText}
                      </div>
                      <div className="flex gap-1">
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                          {q.questionType}
                        </Badge>
                        {q.isCritical && (
                          <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]">
                            Critical
                          </Badge>
                        )}
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                          {q.marks} mark{q.marks === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {program.materials.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Training Materials ({program.materials.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs space-y-1">
                  {program.materials.map((m) => (
                    <li key={m.id} className="flex items-center gap-2">
                      <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                        {m.type}
                      </Badge>
                      <span>{m.title}</span>
                      {m.isMandatory && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                          Mandatory
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <GraduationCap size={14} /> At a Glance
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <Row label="Type" value={program.type ?? "—"} />
              <Row label="Duration" value={`${program.durationHours} h · ${program.durationSessions} session${program.durationSessions === 1 ? "" : "s"}`} />
              <Row label="Max participants" value={String(program.maxParticipantsPerBatch)} />
              <Row label="Languages" value={(program.language ?? []).join(", ") || "—"} />
              <Row label="Owner" value={program.owner?.name ?? "—"} />
              <Row label="Plant scope" value={program.plant?.name ?? "All plants"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Sparkles size={14} /> Certification
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <Row label="Issues certificate" value={program.issuesCertificate ? "Yes" : "No"} />
              <Row label="Validity" value={validity ? `${validity} months` : "Lifetime"} />
              <Row label="Grace period" value={`${program.certificateExpiryGracePeriodDays} days`} />
              <Row label="Refresher code" value={program.refresherProgramCode ?? "—"} />
              <Row
                label="Effectiveness review"
                value={program.evaluatesEffectiveness ? `${program.effectivenessReviewMonths} months` : "Off"}
              />
            </CardContent>
          </Card>

          {program.hasAssessment && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Assessment</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <Row label="Type" value={program.assessmentType ?? "—"} />
                <Row label="Pass score" value={`${passing}%`} />
                <Row label="Attempts" value={String(program.attemptsAllowed)} />
                <Row label="Questions" value={String(program.questions.length)} />
              </CardContent>
            </Card>
          )}

          {program.approvedAt && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Approval</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <Row label="Approved by" value={program.approvedBy?.name ?? "—"} />
                <Row
                  label="Approved at"
                  value={new Date(program.approvedAt).toLocaleString()}
                />
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
    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}

function ChipRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-slate-500 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((i) => (
          <Badge key={i} className="bg-slate-100 text-slate-700 border-slate-200">
            {i}
          </Badge>
        ))}
      </div>
    </div>
  );
}
