// GET /api/manhours-submissions/[id]/validate
//
// Read-only — runs the same validator the submit endpoint runs, but
// without state transitions. Used by Step 8 to show issues live as
// the user tweaks Steps 1-7.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { loadValidationInput, refreshAggregates } from "@/lib/manhours/server";
import { validateSubmission } from "@/lib/manhours/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { id } = await ctx.params;
  const existing = await prisma.manhoursSubmission.findUnique({
    where: { id },
    select: { id: true, plantId: true }
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = await can(userId, "MANHOURS.READ", { plantId: existing.plantId });
  if (!allowed.allowed) {
    return NextResponse.json({ error: allowed.reason ?? "Forbidden" }, { status: 403 });
  }

  // Refresh aggregates first so the validator sees current numbers
  // even if a previous PATCH skipped the recompute.
  await refreshAggregates(prisma, id);

  const input = await loadValidationInput(prisma, id);
  const report = validateSubmission(input);
  return NextResponse.json({ report });
}
