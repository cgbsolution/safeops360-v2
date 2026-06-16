// POST /api/manhours-submissions/[id]/relock
//
// Corporate HSE re-locks a submission after the HSE Manager has
// edited it via the wizard (under UNLOCKED_FOR_REVISION). Captures a
// FRESH KPI snapshot — the revised numbers ARE the new truth. The
// previous snapshot is preserved inside the corresponding
// ManhoursUnlockEvent.changeLog so the trail shows what changed.
//
// Body: { notes?: string }

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { loadFullSubmission } from "@/lib/manhours/server";
import { relockSubmission } from "@/lib/manhours/workflow";

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
  const notes: string | null = body.notes ?? null;

  try {
    await relockSubmission({ prisma, submissionId: id, lockerId: userId, notes });
    const fresh = await loadFullSubmission(prisma, id);
    return NextResponse.json({ submission: fresh });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Re-lock failed" }, { status: 409 });
  }
}
