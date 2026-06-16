// POST /api/manhours-submissions/[id]/categories/import-csv
//
// Bulk import. Parses the CSV, resolves department / contractor codes
// to IDs against the plant's masters, and replaces ALL existing
// categories of the given categoryType with the parsed rows. Replace
// (not merge) is deliberate — re-importing is the intended way to
// fix mistakes.
//
// Body: { categoryType, csv }
// Response: { imported, errors, replaced }

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
import { parseCategoryCsv, type CategoryKind } from "@/lib/manhours/csv";

export const dynamic = "force-dynamic";

const VALID_KINDS = new Set<CategoryKind>(["PERMANENT", "CONTRACT", "TRAINEE"]);

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
  const kind: CategoryKind | undefined = body.categoryType;
  const csv: string | undefined = body.csv;

  if (!kind || !VALID_KINDS.has(kind)) {
    return NextResponse.json(
      { error: `categoryType must be one of ${[...VALID_KINDS].join(", ")}` },
      { status: 400 }
    );
  }
  if (typeof csv !== "string") {
    return NextResponse.json({ error: "csv body field must be a string" }, { status: 400 });
  }

  const parsed = parseCategoryCsv(csv, kind);
  if (parsed.errors.length > 0 && parsed.rows.length === 0) {
    return NextResponse.json(
      { error: "CSV parse failed", errors: parsed.errors },
      { status: 400 }
    );
  }

  // Resolve key codes against plant masters. Departments are scoped
  // per-plant; contractor companies are global.
  const errors = [...parsed.errors];
  let resolved: {
    departmentId: string | null;
    contractorCompanyId: string | null;
    row: (typeof parsed.rows)[number];
  }[] = [];

  if (kind === "PERMANENT" || kind === "TRAINEE") {
    const depts = await prisma.department.findMany({
      where: { plantId: submission.plantId, active: true },
      select: { id: true, code: true, name: true }
    });
    const byCode = new Map<string, string>();
    for (const d of depts) {
      if (d.code) byCode.set(d.code.toUpperCase(), d.id);
      byCode.set(d.name.toUpperCase(), d.id);
    }
    for (const row of parsed.rows) {
      const deptId = byCode.get(row.key.toUpperCase());
      if (!deptId) {
        errors.push({ row: -1, message: `Unknown department code/name: "${row.key}"` });
        continue;
      }
      resolved.push({ departmentId: deptId, contractorCompanyId: null, row });
    }
  } else {
    const contractors = await prisma.contractorCompany.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, code: true, name: true }
    });
    const byCode = new Map<string, string>();
    for (const c of contractors) {
      if (c.code) byCode.set(c.code.toUpperCase(), c.id);
      byCode.set(c.name.toUpperCase(), c.id);
    }
    for (const row of parsed.rows) {
      const cId = byCode.get(row.key.toUpperCase());
      if (!cId) {
        errors.push({ row: -1, message: `Unknown contractor code/name: "${row.key}"` });
        continue;
      }
      resolved.push({ departmentId: null, contractorCompanyId: cId, row });
    }
  }

  if (resolved.length === 0) {
    return NextResponse.json(
      { error: "No rows resolved against masters", errors },
      { status: 400 }
    );
  }

  // Replace-all in a single transaction so a mid-import failure
  // can't leave the user with half-removed data.
  const result = await prisma.$transaction(async (tx) => {
    const removed = await tx.manhoursEmployeeCategory.deleteMany({
      where: { submissionId: id, categoryType: kind }
    });
    let imported = 0;
    for (const r of resolved) {
      await tx.manhoursEmployeeCategory.create({
        data: {
          submissionId: id,
          categoryType: kind,
          departmentId: r.departmentId,
          contractorCompanyId: r.contractorCompanyId,
          shiftId: null,
          averageHeadcount: r.row.averageHeadcount,
          peakHeadcount: r.row.peakHeadcount,
          endOfPeriodHeadcount: r.row.endOfPeriodHeadcount,
          regularHours: r.row.regularHours,
          overtimeHours: r.row.overtimeHours,
          totalHours: categoryTotal(r.row),
          notes: r.row.notes ?? null
        }
      });
      imported++;
    }
    return { imported, replaced: removed.count };
  });

  await refreshAggregates(prisma, id);
  return NextResponse.json({ ...result, errors });
}
