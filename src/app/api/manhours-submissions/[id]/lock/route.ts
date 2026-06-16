// POST /api/manhours-submissions/[id]/lock
//
// Corporate HSE's final decision. Locks the submission and captures
// the IS-3786 KPI snapshot, or rejects back to the HSE Manager.
//   Body: { decision: "LOCK" | "REJECT", notes?: string }
//
// LOCK   → submission moves to LOCKED + kpiSnapshot frozen
// REJECT → submission moves to DRAFT (rare; e.g. policy mismatch found late)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { loadFullSubmission } from "@/lib/manhours/server";
import { corporateLock, corporateReject } from "@/lib/manhours/workflow";

export const dynamic = "force-dynamic";

const VALID_DECISIONS = new Set(["LOCK", "REJECT"]);

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

  // MANHOURS.CLOSE is Corporate HSE's lock permission per seed-rbac.
  const allowed = await can(userId, "MANHOURS.CLOSE", { plantId: sub.plantId });
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
    if (decision === "LOCK") {
      await corporateLock({ prisma, submissionId: id, lockerId: userId, notes });
    } else {
      await corporateReject({
        prisma,
        submissionId: id,
        reviewerId: userId,
        notes: notes ?? ""
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Lock failed" }, { status: 409 });
  }

  const fresh = await loadFullSubmission(prisma, id);
  return NextResponse.json({ submission: fresh });
}
