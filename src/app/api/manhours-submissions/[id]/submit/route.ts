// POST /api/manhours-submissions/[id]/submit
//
// DRAFT → SUBMITTED transition. Runs the full validation gate
// (no FAILs allowed); on success assigns the MH-YYYY-PLANT-MM
// submission number, stamps submitter/at, and moves status to
// SUBMITTED. The Plant Head review handler in Commit 3 picks it
// up from there.
//
// We do NOT create the WorkflowInstance here. That's a Commit 3
// responsibility — the wizard's job ends at SUBMITTED, and the
// review pipeline owns workflow lifecycle. Status alone is enough
// to gate edits and enable the review screen.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import {
  assertEditable,
  buildSubmissionNumber,
  loadFullSubmission,
  loadValidationInput,
  ManhoursStatusError,
  refreshAggregates
} from "@/lib/manhours/server";
import { validateSubmission } from "@/lib/manhours/validation";
import { initiateManhoursWorkflow } from "@/lib/manhours/workflow";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { id } = await ctx.params;
  const existing = await prisma.manhoursSubmission.findUnique({
    where: { id },
    select: {
      id: true,
      plantId: true,
      status: true,
      reportingYear: true,
      reportingMonth: true,
      submissionNumber: true,
      plant: { select: { code: true } }
    }
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = await can(userId, "MANHOURS.UPDATE", { plantId: existing.plantId });
  if (!allowed.allowed) {
    return NextResponse.json({ error: allowed.reason ?? "Forbidden" }, { status: 403 });
  }

  try {
    assertEditable(existing);
  } catch (e) {
    if (e instanceof ManhoursStatusError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  // Defensive aggregate refresh — protects against the rare case of
  // a partial save mid-wizard leaving totals stale, so the validator
  // sees authoritative numbers regardless of UI state.
  await refreshAggregates(prisma, id);

  const validationInput = await loadValidationInput(prisma, id);
  const report = validateSubmission(validationInput);
  if (!report.canSubmit) {
    return NextResponse.json(
      {
        error: "Validation failed — fix the FAIL items before submitting",
        report
      },
      { status: 422 }
    );
  }

  // Optional submission notes from the wizard's Step 8.
  const body = await req.json().catch(() => ({}));
  const submissionNotes: string | null = body?.submissionNotes ?? null;

  // Stamp submitter + assign submission number first. Status moves
  // to UNDER_REVIEW inside initiateManhoursWorkflow (which also
  // creates the WorkflowInstance + Plant Head task). Keeping the
  // number assignment here ensures it lands even if the workflow
  // initiation fails — the operator can retry submit without the
  // number rolling forward.
  const updated = await prisma.manhoursSubmission.update({
    where: { id },
    data: {
      submissionNumber:
        existing.submissionNumber ??
        buildSubmissionNumber({
          plantCode: existing.plant.code,
          reportingYear: existing.reportingYear,
          reportingMonth: existing.reportingMonth
        }),
      submittedById: userId,
      submittedAt: new Date(),
      submissionNotes: submissionNotes != null ? String(submissionNotes) : undefined
    }
  });

  try {
    await initiateManhoursWorkflow({ prisma, submissionId: id, initiatorId: userId });
  } catch (e: any) {
    // Most common cause: no PLANT_HEAD assigned to this plant. Roll back
    // the submitter stamp so the user can fix the assignment and retry
    // without "submitted but no workflow" zombie state.
    await prisma.manhoursSubmission.update({
      where: { id },
      data: {
        submittedById: null,
        submittedAt: null
      }
    });
    return NextResponse.json(
      {
        error: `Workflow initiation failed: ${e?.message ?? "unknown error"}`,
        // Retain the validation report so the UI can keep the user oriented.
        report
      },
      { status: 422 }
    );
  }

  const fresh = await loadFullSubmission(prisma, id);
  return NextResponse.json({ submission: fresh ?? updated, report });
}
