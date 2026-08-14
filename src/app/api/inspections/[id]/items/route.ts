import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { spawnFindingsFromInspection } from "@/lib/inspections/finding-engine";
import { recomputeAfterCompletion } from "@/lib/inspections/schedule-generator";
import { backendFetch } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const insp = await prisma.inspection.findUnique({
    where: { id: params.id },
    include: {
      inspectionType: { select: { requiresCertifiedInspector: true, requiredCertificationCodes: true } }
    }
  });
  if (!insp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Permission — EXECUTE on inspection
  const allowed = await can(userId, "INSPECTION.EXECUTE", { recordId: insp.id, plantId: insp.plantId, record: insp });
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  // Inspector competency gate — if this inspection's type requires certification,
  // the executing user must hold a valid TrainingCertificate for any of the codes.
  if (insp.inspectionType?.requiresCertifiedInspector && (insp.inspectionType.requiredCertificationCodes ?? []).length > 0) {
    const certs = await prisma.trainingCertificate.findMany({
      where: {
        userId,
        status: { in: ["ACTIVE", "EXPIRING_SOON"] },
        program: { OR: [{ code: { in: insp.inspectionType.requiredCertificationCodes } }, { programCode: { in: insp.inspectionType.requiredCertificationCodes } }] }
      },
      select: { id: true }
    }).catch(() => [] as { id: string }[]);
    if (certs.length === 0) {
      return NextResponse.json({
        error: `Inspector competency gate: this inspection requires a valid certification for one of [${insp.inspectionType.requiredCertificationCodes.join(", ")}]. Your training records do not satisfy this gate.`
      }, { status: 403 });
    }
  }

  const body = await req.json();
  const itemResults = Array.isArray(body.itemResults) ? body.itemResults : [];

  // Replace-then-create: simplest semantics for the partial-save flow.
  // Wraps in transaction so concurrent saves don't leave half-state.
  await prisma.$transaction(async (tx) => {
    // Fetch existing to keep finding linkage where status hasn't changed
    const existing = await tx.inspectionItemResult.findMany({
      where: { inspectionId: insp.id },
      select: { id: true, checklistItemId: true, finding: { select: { id: true } } }
    });
    const existingByItem = new Map(existing.map((r) => [r.checklistItemId, r]));

    for (const r of itemResults) {
      const ex = existingByItem.get(r.checklistItemId);
      if (ex) {
        await tx.inspectionItemResult.update({
          where: { id: ex.id },
          data: {
            sequence: r.sequence,
            sectionTitle: r.sectionTitle,
            itemTextSnapshot: r.itemTextSnapshot,
            itemTypeSnapshot: r.itemTypeSnapshot,
            isCriticalSnapshot: r.isCriticalSnapshot,
            resultStatus: r.resultStatus,
            valueText: r.valueText,
            valueNumeric: r.valueNumeric,
            comment: r.comment,
            photoUrls: r.photoUrls ?? [],
            capturedById: userId,
            capturedAt: new Date()
          }
        });
      } else {
        await tx.inspectionItemResult.create({
          data: {
            inspectionId: insp.id,
            checklistItemId: r.checklistItemId,
            sequence: r.sequence,
            sectionTitle: r.sectionTitle,
            itemTextSnapshot: r.itemTextSnapshot,
            itemTypeSnapshot: r.itemTypeSnapshot,
            isCriticalSnapshot: r.isCriticalSnapshot,
            resultStatus: r.resultStatus,
            valueText: r.valueText,
            valueNumeric: r.valueNumeric,
            comment: r.comment,
            photoUrls: r.photoUrls ?? [],
            capturedById: userId,
            capturedAt: new Date()
          }
        });
      }
    }

    // Update inspection top-level state
    const allResults = await tx.inspectionItemResult.findMany({
      where: { inspectionId: insp.id },
      select: { resultStatus: true, isCriticalSnapshot: true }
    });
    const fail = allResults.some((x) => x.resultStatus === "FAIL");
    const partial = allResults.some((x) => x.resultStatus === "MARGINAL" || x.resultStatus === "OBSERVATION");
    const followUp = allResults.some((x) => x.resultStatus === "FAIL" || x.resultStatus === "MARGINAL");
    const result = fail ? "Fail" : partial ? "Partial" : "Pass";

    await tx.inspection.update({
      where: { id: insp.id },
      data: {
        status: body.submit ? "COMPLETED" : "IN_PROGRESS",
        completedDate: body.submit ? new Date() : insp.completedDate,
        result: body.submit ? result : insp.result,
        followUpRequired: followUp,
        inspectorId: insp.inspectorId ?? userId
      }
    });
  });

  let findings: any = null;
  let workflowAdvancedTo: string | null = null;
  if (body.submit) {
    findings = await spawnFindingsFromInspection(insp.id);
    if (insp.equipmentInspectionTypeId) {
      await recomputeAfterCompletion({
        equipmentInspectionTypeId: insp.equipmentInspectionTypeId,
        completedDate: new Date()
      });
    }

    // Advance the workflow: mark the inspector's pending ASSIGNEE_TASK as
    // completed and create the verifier task. Without this, the inspector's
    // task stays in "Awaiting Action" forever and the verifier never gets
    // their task assigned — the UI ends up showing both the (already done)
    // inspector and the (never started) verifier as pending.
    try {
      const pendingTask = await prisma.workflowTask.findFirst({
        where: {
          module: "INSPECTION",
          recordId: insp.id,
          assignedToId: userId,
          status: "PENDING"
        },
        select: { id: true, taskType: true, stepId: true, instanceId: true }
      });
      // taskType "EXECUTION" maps to ASSIGNEE_TASK step. Only advance when
      // the user's pending task is this kind — verifiers/approvers complete
      // their tasks through a different endpoint.
      if (pendingTask && pendingTask.taskType === "EXECUTION") {
        // Check whether the workflow already has a downstream pending task
        // (e.g., the verifier task already exists from prior data state).
        // If so, just close out the inspector's task without re-running
        // submitExecution — that would spawn a DUPLICATE downstream task.
        const downstreamPending = await prisma.workflowTask.findFirst({
          where: {
            instanceId: pendingTask.instanceId,
            status: "PENDING",
            stepId: { not: pendingTask.stepId }
          },
          select: { stepName: true }
        });
        if (downstreamPending) {
          // Workflow already advanced through another path — just close
          // this task and log an EXECUTED history row so the audit trail
          // and the UI stay consistent.
          await prisma.$transaction([
            prisma.workflowTask.update({
              where: { id: pendingTask.id },
              data: { status: "COMPLETED", completedAt: new Date() }
            }),
            prisma.workflowHistory.create({
              data: {
                instanceId: pendingTask.instanceId,
                stepId: pendingTask.stepId,
                stepName: "Inspector Executes Checklist",
                action: "EXECUTED",
                performedById: userId,
                comments: "Inspection checklist submitted."
              }
            })
          ]);
          workflowAdvancedTo = downstreamPending.stepName;
        } else {
          // The engine itself lives in Python — this posts the same arguments
          // the local copy took, and the backend re-checks that `userId` is
          // actually the task's assignee before advancing.
          const adv = await backendFetch<{ advancedTo?: string | null }>(
            "/api/workflow/submit-execution",
            {
              method: "POST",
              userId,
              body: {
                taskId: pendingTask.id,
                comments: "Inspection checklist submitted.",
                plantId: insp.plantId
              }
            }
          );
          workflowAdvancedTo = adv?.advancedTo ?? null;
        }
      }
    } catch (e) {
      // Don't fail the inspection submit if workflow advance hiccups —
      // the data is saved; the workflow can be nudged manually from the
      // inbox if needed.
      console.warn("Inspection workflow advance skipped:", (e as Error).message);
    }
  }

  return NextResponse.json({ ok: true, findings, workflowAdvancedTo });
}
