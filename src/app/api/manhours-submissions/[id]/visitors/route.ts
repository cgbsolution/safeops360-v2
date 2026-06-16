// PUT /api/manhours-submissions/[id]/visitors
//
// Upsert the single visitor record for the period. PUT (not PATCH)
// because visitors is 1:1 with submission and the wizard always
// sends the complete shape.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { assertEditable, ManhoursStatusError } from "@/lib/manhours/server";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { id } = await ctx.params;
  const submission = await prisma.manhoursSubmission.findUnique({
    where: { id },
    select: { id: true, plantId: true, status: true }
  });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = await can(userId, "MANHOURS.UPDATE", { plantId: submission.plantId });
  if (!allowed.allowed) {
    return NextResponse.json({ error: allowed.reason ?? "Forbidden" }, { status: 403 });
  }

  try {
    assertEditable(submission);
  } catch (e) {
    if (e instanceof ManhoursStatusError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  const body = await req.json().catch(() => ({}));
  const totalVisitorCount = nonNeg(body.totalVisitorCount);
  const totalVisitorHours = nonNeg(body.totalVisitorHours);
  if (totalVisitorCount == null || totalVisitorHours == null) {
    return NextResponse.json(
      { error: "totalVisitorCount and totalVisitorHours must be non-negative numbers" },
      { status: 400 }
    );
  }
  const notableVisits =
    body.notableVisits == null || body.notableVisits === "" ? null : String(body.notableVisits);

  const visitors = await prisma.manhoursVisitorRecord.upsert({
    where: { submissionId: id },
    create: {
      submissionId: id,
      totalVisitorCount,
      totalVisitorHours,
      notableVisits
    },
    update: {
      totalVisitorCount,
      totalVisitorHours,
      notableVisits
    }
  });

  return NextResponse.json({ visitors });
}

function nonNeg(v: unknown): number | null {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
