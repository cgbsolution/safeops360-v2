import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { can } from "@/lib/auth/permissions";
import { ManhoursWizard } from "@/components/manhours/wizard";
import { periodBounds } from "@/lib/manhours/server";
import type {
  WizardSubmission,
  DepartmentOption,
  ContractorOption
} from "@/components/manhours/wizard-types";

export const dynamic = "force-dynamic";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function ManhoursWizardPage(props: {
  params: Promise<{ plantId: string; year: string; month: string }>;
}) {
  const params = await props.params;
  const year = parseInt(params.year, 10);
  const month = parseInt(params.month, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return notFound();

  // Read access is the bar to enter the wizard at all. Mutation
  // permissions (UPDATE, APPROVE, CLOSE) are enforced per-action by
  // the API endpoints; the wizard surfaces the right action panel
  // based on capability flags computed below.
  await requirePermission("MANHOURS.READ", { plantId: params.plantId });

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string;

  // The wizard hands the page a Submission to render. If one doesn't
  // exist yet, create a DRAFT here so the wizard always has a stable
  // ID to PATCH against — much cleaner than threading "is this
  // creation or edit?" through the client. The draft is only created
  // when the user actually has UPDATE permission (e.g. HSE Manager);
  // reviewers landing on a non-existent submission get redirected to
  // the calendar grid.
  const plant = await prisma.plant.findUnique({ where: { id: params.plantId } });
  if (!plant) return notFound();

  // Disallow wizard for the current or future month — same rule as
  // POST /api/manhours-submissions. Submissions are post-period.
  const now = new Date();
  const currentYM = now.getFullYear() * 12 + now.getMonth();
  const reqYM = year * 12 + (month - 1);
  if (reqYM >= currentYM) {
    redirect(`/manhours/${params.plantId}/${year}/${month}`);
  }

  const existing = await prisma.manhoursSubmission.findUnique({
    where: {
      plantId_reportingYear_reportingMonth: {
        plantId: params.plantId,
        reportingYear: year,
        reportingMonth: month
      }
    }
  });

  let submissionId: string;
  if (!existing) {
    // Auto-create the DRAFT only if the user can actually start a
    // submission — otherwise a Plant Head clicking a NOT_STARTED
    // cell would accidentally provision an empty draft on their
    // behalf. Check UPDATE here (wizard editing requires it) AND
    // CREATE (initial provisioning).
    const canCreate = await can(userId, "MANHOURS.CREATE", { plantId: params.plantId });
    if (!canCreate.allowed) {
      redirect(`/manhours`);
    }
    const { start, end } = periodBounds(year, month);
    const created = await prisma.manhoursSubmission.create({
      data: {
        plantId: params.plantId,
        reportingYear: year,
        reportingMonth: month,
        reportingPeriodStart: start,
        reportingPeriodEnd: end,
        status: "DRAFT"
      }
    });
    submissionId = created.id;
  } else {
    submissionId = existing.id;
    // Non-editable statuses still render in the wizard, but in
    // read-only mode (the wizard's own `isReadOnly` flag). The
    // action panel above the stepper surfaces review / lock /
    // unlock affordances to the right role.
  }

  // Reload with includes for the wizard's initial state.
  const fullSubmission = await prisma.manhoursSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      plant: { select: { id: true, name: true, code: true } },
      categories: {
        include: {
          department: { select: { id: true, name: true, code: true } },
          contractorCompany: { select: { id: true, name: true, code: true } }
        },
        orderBy: { id: "asc" }
      },
      visitors: true,
      attachments: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { uploadedAt: "desc" }
      },
      comments: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  const [departments, contractors, workflowInstance, canReviewResult, canLockResult] = await Promise.all([
    prisma.department.findMany({
      where: { plantId: params.plantId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true }
    }),
    prisma.contractorCompany.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true }
    }),
    // Workflow instance — populated only after /submit. Includes the
    // full definition's steps + history + pending tasks so the
    // tracker can render the timeline.
    prisma.workflowInstance.findUnique({
      where: { module_recordId: { module: "MANHOURS", recordId: submissionId } },
      include: {
        definition: { include: { steps: { orderBy: { sequence: "asc" } } } },
        history: { include: { performedBy: true }, orderBy: { performedAt: "asc" } },
        pendingTasks: { include: { assignedTo: true } }
      }
    }),
    // Capability flags — drive the action panel's render branch.
    can(userId, "MANHOURS.APPROVE", { plantId: params.plantId }),
    can(userId, "MANHOURS.CLOSE", { plantId: params.plantId })
  ]);

  const initialSubmission: WizardSubmission = {
    ...fullSubmission,
    reportingPeriodStart: fullSubmission.reportingPeriodStart.toISOString(),
    reportingPeriodEnd: fullSubmission.reportingPeriodEnd.toISOString(),
    attachments: fullSubmission.attachments.map((a) => ({
      id: a.id,
      category: a.category,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      caption: a.caption,
      uploadedAt: a.uploadedAt.toISOString()
    })),
    comments: fullSubmission.comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      author: c.author
    }))
  } as WizardSubmission;

  return (
    <div>
      <PageHeader
        title={`${plant.name} · ${MONTHS[month]} ${year}`}
        description="Eight-step submission wizard. Auto-saves are server-side; navigate freely."
        breadcrumbs={[
          { label: "Manhours", href: "/manhours" },
          { label: `${MONTHS[month]} ${year}`, href: `/manhours/${params.plantId}/${year}/${month}` },
          { label: "Edit" }
        ]}
      />
      <ManhoursWizard
        initialSubmission={initialSubmission}
        departments={departments as DepartmentOption[]}
        contractors={contractors as ContractorOption[]}
        workflow={
          workflowInstance
            ? {
                steps: workflowInstance.definition.steps.map((s) => ({
                  id: s.id,
                  sequence: s.sequence,
                  stepType: s.stepType,
                  name: s.name,
                  approverRole: s.approverRole,
                  slaHours: s.slaHours
                })),
                history: workflowInstance.history.map((h) => ({
                  id: h.id,
                  stepId: h.stepId,
                  stepName: h.stepName,
                  action: h.action,
                  performedAt: h.performedAt.toISOString(),
                  comments: h.comments,
                  performedBy: {
                    name: h.performedBy.name,
                    designation: h.performedBy.designation
                  }
                })),
                pendingTasks: workflowInstance.pendingTasks.map((t) => ({
                  id: t.id,
                  stepId: t.stepId,
                  stepName: t.stepName,
                  status: t.status,
                  dueAt: t.dueAt?.toISOString() ?? null,
                  assignedTo: {
                    name: t.assignedTo.name,
                    designation: t.assignedTo.designation,
                    department: t.assignedTo.department
                  }
                })),
                currentStepId: workflowInstance.currentStepId,
                status: workflowInstance.status
              }
            : null
        }
        capabilities={{
          canReview: canReviewResult.allowed,
          canLock: canLockResult.allowed
        }}
      />
    </div>
  );
}
