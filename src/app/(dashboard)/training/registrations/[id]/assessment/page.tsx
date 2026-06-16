import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { AssessmentTake } from "@/components/training/assessment-take";

export const dynamic = "force-dynamic";

export default async function AssessmentPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = (session.user as any)?.id ?? "";

  const reg = await prisma.trainingRegistration.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true } },
      schedule: {
        include: {
          program: {
            include: {
              questions: { orderBy: { sequence: "asc" } },
            },
          },
        },
      },
      assessments: { orderBy: { attemptNumber: "asc" } },
    },
  });
  if (!reg) return notFound();

  // Auth: only the learner can take their own assessment, or a privileged
  // assessor (TRAINER / LD / HSE / ADMIN).
  const role = (session.user as any)?.role ?? "";
  const isOwner = reg.userId === userId;
  const isAssessor = ["TRAINER", "LD_MANAGER", "HSE_MANAGER", "ADMIN", "SYSTEM_ADMIN"].includes(role);
  if (!isOwner && !isAssessor) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-sm text-slate-600">
        You are not authorised to view this assessment.
      </div>
    );
  }

  if (!reg.schedule.program.hasAssessment) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-sm text-slate-600">
        This program does not have an assessment configured.
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Assessment — ${reg.schedule.program.programName ?? reg.schedule.program.name}`}
        description={`Attempt for ${reg.user.name}. ${reg.assessmentAttempts}/${reg.schedule.program.attemptsAllowed} attempts used.`}
        breadcrumbs={[
          { label: "Training", href: "/training" },
          { label: "Schedules", href: "/training/schedules" },
          {
            label: reg.schedule.scheduleNumber,
            href: `/training/schedules/${reg.schedule.id}`,
          },
          { label: "Assessment" },
        ]}
      />
      <AssessmentTake
        registrationId={reg.id}
        attemptsUsed={reg.assessmentAttempts}
        attemptsAllowed={reg.schedule.program.attemptsAllowed}
        passingScorePercent={
          reg.schedule.program.passingScorePercent ?? reg.schedule.program.passingScore
        }
        questions={reg.schedule.program.questions.map((q) => ({
          id: q.id,
          sequence: q.sequence,
          questionText: q.questionText,
          questionType: q.questionType,
          options: (q.options as any) ?? [],
          marks: q.marks,
          isCritical: q.isCritical,
        }))}
        existingAssessments={reg.assessments.map((a) => ({
          id: a.id,
          attemptNumber: a.attemptNumber,
          submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
          scorePercent: a.scorePercent,
          passed: a.passed,
        }))}
      />
    </div>
  );
}
