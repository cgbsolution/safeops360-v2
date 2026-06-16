// GET    /api/manhours-submissions/[id]   — full submission detail
// PATCH  /api/manhours-submissions/[id]   — partial update of Step 1, 5, 6, 8 fields
//
// PATCH triggers a server-side aggregate refresh whenever any
// deduction field changes — net exposure hours and totals stay
// authoritative on the server, never trusting client-computed values.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import {
  assertEditable,
  loadFullSubmission,
  refreshAggregates,
  ManhoursStatusError
} from "@/lib/manhours/server";

export const dynamic = "force-dynamic";

// Whitelist of fields the wizard is allowed to PATCH. Aggregates
// (totalManhoursAll etc.) are server-derived; status moves through
// dedicated transition endpoints; submission/review/lock metadata is
// owned by the workflow handlers in Commit 3.
const PATCHABLE_FIELDS = new Set([
  "totalEmployeeStrength",
  "totalContractorStrength",
  "totalDaysWorked",
  "totalShiftsWorked",
  "hoursAnnualLeave",
  "hoursSickLeave",
  "hoursTraining",
  "hoursMaternityLeave",
  "hoursOther",
  "submissionNotes"
]);

const DEDUCTION_FIELDS = new Set([
  "hoursAnnualLeave",
  "hoursSickLeave",
  "hoursTraining",
  "hoursMaternityLeave",
  "hoursOther"
]);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { id } = await ctx.params;
  const submission = await loadFullSubmission(prisma, id);
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = await can(userId, "MANHOURS.READ", { plantId: submission.plantId });
  if (!allowed.allowed) {
    return NextResponse.json({ error: allowed.reason ?? "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ submission });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { id } = await ctx.params;
  const existing = await prisma.manhoursSubmission.findUnique({
    where: { id },
    select: { id: true, plantId: true, status: true }
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

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  let touchedDeductions = false;

  for (const [k, v] of Object.entries(body ?? {})) {
    if (!PATCHABLE_FIELDS.has(k)) continue;
    if (k === "submissionNotes") {
      data[k] = v == null ? null : String(v);
      continue;
    }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json(
        { error: `Field "${k}" must be a non-negative number (got ${JSON.stringify(v)})` },
        { status: 400 }
      );
    }
    data[k] = n;
    if (DEDUCTION_FIELDS.has(k)) touchedDeductions = true;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No patchable fields supplied" }, { status: 400 });
  }

  await prisma.manhoursSubmission.update({ where: { id }, data });

  // Recompute aggregates only when the inputs actually changed.
  // Avoids an unnecessary roundtrip when the user edits notes alone.
  if (touchedDeductions) {
    await refreshAggregates(prisma, id);
  }

  const fresh = await loadFullSubmission(prisma, id);
  return NextResponse.json({ submission: fresh });
}
