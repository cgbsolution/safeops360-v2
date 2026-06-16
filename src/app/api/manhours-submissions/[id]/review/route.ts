// POST /api/manhours-submissions/[id]/review
//
// Plant Head's decision after Steps 1-8 land in their inbox.
//   Body: { decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_REVISION", notes: string }
//
// APPROVED → submission moves to APPROVED + Corporate HSE task spawned
// REJECTED / RETURNED_FOR_REVISION → submission moves back to DRAFT
//   (HSE Manager edits via the wizard and resubmits)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { loadFullSubmission } from "@/lib/manhours/server";
import { plantHeadApprove, plantHeadReject } from "@/lib/manhours/workflow";

export const dynamic = "force-dynamic";

const VALID_DECISIONS = new Set(["APPROVED", "REJECTED", "RETURNED_FOR_REVISION"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { id } = await ctx.params;
  const sub = await prisma.manhoursSubmission.findUnique({
    where: { id },
    select: { id: true, plantId: true, status: true }
  });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Plant Head's decision is governed by MANHOURS.APPROVE. The seed
  // grants this to PLANT_HEAD with OWN_PLANT scope — so a Plant Head
  // can't sign off on another plant's submission.
  const allowed = await can(userId, "MANHOURS.APPROVE", { plantId: sub.plantId });
  if (!allowed.allowed) {
    return NextResponse.json({ error: allowed.reason ?? "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const decision: string = body.decision;
  const notes: string | null = body.notes ?? null;

  if (!VALID_DECISIONS.has(decision)) {
    return NextResponse.json(
      { error: `decision must be one of ${[...VALID_DECISIONS].join(", ")}` },
      { status: 400 }
    );
  }

  try {
    if (decision === "APPROVED") {
      await plantHeadApprove({ prisma, submissionId: id, approverId: userId, notes });
    } else {
      // The orchestrator enforces the 5-character minimum on notes —
      // we just forward.
      await plantHeadReject({
        prisma,
        submissionId: id,
        reviewerId: userId,
        decision: decision as "REJECTED" | "RETURNED_FOR_REVISION",
        notes: notes ?? ""
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Review failed" }, { status: 409 });
  }

  const fresh = await loadFullSubmission(prisma, id);
  return NextResponse.json({ submission: fresh });
}
