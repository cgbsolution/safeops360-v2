// POST /api/manhours-submissions/[id]/unlock
//
// Corporate HSE unlocks a LOCKED submission with a mandatory reason
// (>= 10 chars). Creates a ManhoursUnlockEvent row + flips status to
// UNLOCKED_FOR_REVISION. HSE Manager can then re-enter the wizard,
// fix the issue, and Corporate HSE re-locks (capturing a fresh
// snapshot — see /relock).
//
// Body: { reason: string }
//
// Brief notes a CFO/Director second-approval requirement for unlocks.
// Out of scope for C3 — implementable as a two-party signature with
// minimal additional plumbing in a follow-up commit.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { loadFullSubmission } from "@/lib/manhours/server";
import { unlockSubmission } from "@/lib/manhours/workflow";

export const dynamic = "force-dynamic";

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

  const allowed = await can(userId, "MANHOURS.CLOSE", { plantId: sub.plantId });
  if (!allowed.allowed) {
    return NextResponse.json({ error: allowed.reason ?? "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const reason: string = body.reason ?? "";

  try {
    const result = await unlockSubmission({
      prisma,
      submissionId: id,
      unlockerId: userId,
      reason
    });
    const fresh = await loadFullSubmission(prisma, id);
    return NextResponse.json({ submission: fresh, unlockEventId: result.unlockEventId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unlock failed" }, { status: 409 });
  }
}
