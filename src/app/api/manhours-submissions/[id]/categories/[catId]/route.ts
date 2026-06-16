// PATCH  /api/manhours-submissions/[id]/categories/[catId]
// DELETE /api/manhours-submissions/[id]/categories/[catId]
//
// Both verbs guard against editing a non-DRAFT submission and
// re-aggregate the parent submission's totals after the mutation.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import {
  assertEditable,
  categoryTotal,
  ManhoursStatusError,
  refreshAggregates
} from "@/lib/manhours/server";

export const dynamic = "force-dynamic";

const PATCHABLE_CATEGORY_FIELDS = new Set([
  "departmentId",
  "contractorCompanyId",
  "shiftId",
  "averageHeadcount",
  "peakHeadcount",
  "endOfPeriodHeadcount",
  "regularHours",
  "overtimeHours",
  "notes"
]);

const NUMERIC_FIELDS = new Set([
  "averageHeadcount",
  "peakHeadcount",
  "endOfPeriodHeadcount",
  "regularHours",
  "overtimeHours"
]);

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; catId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { id, catId } = await ctx.params;
  const guard = await loadAndAssert(prisma, id, catId, userId);
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (!PATCHABLE_CATEGORY_FIELDS.has(k)) continue;
    if (NUMERIC_FIELDS.has(k)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: `Field "${k}" must be a non-negative number (got ${JSON.stringify(v)})` },
          { status: 400 }
        );
      }
      data[k] = n;
    } else if (v === null || v === undefined) {
      data[k] = null;
    } else {
      data[k] = String(v);
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No patchable fields supplied" }, { status: 400 });
  }

  // Recompute totalHours if either component was touched.
  const touchedHours = "regularHours" in data || "overtimeHours" in data;
  if (touchedHours) {
    const reg = (data.regularHours as number | undefined) ?? guard.category.regularHours;
    const ot = (data.overtimeHours as number | undefined) ?? guard.category.overtimeHours;
    data.totalHours = categoryTotal({ regularHours: reg, overtimeHours: ot });
  }

  await prisma.manhoursEmployeeCategory.update({ where: { id: catId }, data });
  await refreshAggregates(prisma, id);

  const fresh = await prisma.manhoursEmployeeCategory.findUnique({ where: { id: catId } });
  return NextResponse.json({ category: fresh });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; catId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { id, catId } = await ctx.params;
  const guard = await loadAndAssert(prisma, id, catId, userId);
  if ("error" in guard) return guard.error;

  await prisma.manhoursEmployeeCategory.delete({ where: { id: catId } });
  await refreshAggregates(prisma, id);
  return NextResponse.json({ ok: true });
}

// ── Internal: shared auth + lookup + editable guard ──────────────

type GuardResult =
  | { error: NextResponse }
  | { submission: { plantId: string; status: string }; category: { regularHours: number; overtimeHours: number } };

async function loadAndAssert(
  client: typeof prisma,
  submissionId: string,
  categoryId: string,
  userId: string
): Promise<GuardResult> {
  const cat = await client.manhoursEmployeeCategory.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      submissionId: true,
      regularHours: true,
      overtimeHours: true,
      submission: { select: { plantId: true, status: true } }
    }
  });
  if (!cat || cat.submissionId !== submissionId) {
    return { error: NextResponse.json({ error: "Category not found" }, { status: 404 }) };
  }
  const allowed = await can(userId, "MANHOURS.UPDATE", { plantId: cat.submission.plantId });
  if (!allowed.allowed) {
    return { error: NextResponse.json({ error: allowed.reason ?? "Forbidden" }, { status: 403 }) };
  }
  try {
    assertEditable(cat.submission);
  } catch (e) {
    if (e instanceof ManhoursStatusError) {
      return { error: NextResponse.json({ error: e.message }, { status: 409 }) };
    }
    throw e;
  }
  return {
    submission: cat.submission,
    category: { regularHours: cat.regularHours, overtimeHours: cat.overtimeHours }
  };
}
