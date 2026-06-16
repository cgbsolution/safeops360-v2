// POST /api/manhours-submissions/[id]/categories
//
// Create a single category row (one Department×Shift entry for
// PERMANENT/TRAINEE, or one ContractorCompany×Shift entry for
// CONTRACT). Multiple rows per department/contractor are allowed —
// e.g. one per shift — so this endpoint always creates, never
// upserts. Updates go through PATCH on the single-row endpoint.

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

const VALID_CATEGORY_TYPES = new Set(["PERMANENT", "CONTRACT", "TRAINEE"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
  const categoryType: string = body.categoryType;
  if (!VALID_CATEGORY_TYPES.has(categoryType)) {
    return NextResponse.json(
      { error: `categoryType must be one of ${[...VALID_CATEGORY_TYPES].join(", ")}` },
      { status: 400 }
    );
  }

  // Cross-check: CONTRACT rows need a contractorCompanyId; PERMANENT
  // and TRAINEE need a departmentId. Either is OK (e.g. plant-wide
  // ungrouped), but most flows specify one.
  if (categoryType === "CONTRACT" && !body.contractorCompanyId && !body.departmentId) {
    return NextResponse.json(
      { error: "Contract rows must reference either a contractorCompanyId or a departmentId" },
      { status: 400 }
    );
  }

  const regularHours = nonNegNumber(body.regularHours);
  const overtimeHours = nonNegNumber(body.overtimeHours);
  if (regularHours == null || overtimeHours == null) {
    return NextResponse.json(
      { error: "regularHours and overtimeHours must be non-negative numbers" },
      { status: 400 }
    );
  }

  const created = await prisma.manhoursEmployeeCategory.create({
    data: {
      submissionId: id,
      categoryType,
      departmentId: body.departmentId || null,
      contractorCompanyId: body.contractorCompanyId || null,
      shiftId: body.shiftId || null,
      averageHeadcount: nonNegNumber(body.averageHeadcount) ?? 0,
      peakHeadcount: nonNegNumber(body.peakHeadcount) ?? 0,
      endOfPeriodHeadcount: nonNegNumber(body.endOfPeriodHeadcount) ?? 0,
      regularHours,
      overtimeHours,
      totalHours: categoryTotal({ regularHours, overtimeHours }),
      notes: body.notes ?? null
    }
  });

  await refreshAggregates(prisma, id);
  return NextResponse.json({ category: created }, { status: 201 });
}

function nonNegNumber(v: unknown): number | null {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
