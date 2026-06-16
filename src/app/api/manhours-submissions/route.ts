// POST /api/manhours-submissions
//
// Idempotent on (plantId, reportingYear, reportingMonth) — returns
// the existing submission for that period if one exists, regardless
// of status. The wizard relies on this to allow resume-from-anywhere
// without forcing the HSE Manager to remember an ID.
//
// Permission: MANHOURS.CREATE for the target plant.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { periodBounds } from "@/lib/manhours/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const body = await req.json().catch(() => ({}));
  const plantId: string | undefined = body.plantId;
  const reportingYear: number | undefined = body.reportingYear;
  const reportingMonth: number | undefined = body.reportingMonth;

  if (!plantId || typeof reportingYear !== "number" || typeof reportingMonth !== "number") {
    return NextResponse.json(
      { error: "plantId, reportingYear and reportingMonth are required" },
      { status: 400 }
    );
  }
  if (reportingMonth < 1 || reportingMonth > 12) {
    return NextResponse.json({ error: "reportingMonth must be 1-12" }, { status: 400 });
  }

  // Disallow creating submissions for the current or future month —
  // manhours are reported AFTER the period closes.
  const now = new Date();
  const currentYM = now.getFullYear() * 12 + now.getMonth();
  const reqYM = reportingYear * 12 + (reportingMonth - 1);
  if (reqYM >= currentYM) {
    return NextResponse.json(
      { error: "Cannot create a submission for the current or a future month" },
      { status: 400 }
    );
  }

  const allowed = await can(userId, "MANHOURS.CREATE", { plantId });
  if (!allowed.allowed) {
    return NextResponse.json({ error: allowed.reason ?? "Forbidden" }, { status: 403 });
  }

  // Race-safe: try-find first (the common case), fall back to create
  // and rely on the (plantId, year, month) unique constraint to catch
  // simultaneous double-submits.
  const existing = await prisma.manhoursSubmission.findUnique({
    where: {
      plantId_reportingYear_reportingMonth: {
        plantId,
        reportingYear,
        reportingMonth
      }
    }
  });
  if (existing) {
    return NextResponse.json({ submission: existing, created: false });
  }

  const { start, end } = periodBounds(reportingYear, reportingMonth);
  try {
    const created = await prisma.manhoursSubmission.create({
      data: {
        plantId,
        reportingYear,
        reportingMonth,
        reportingPeriodStart: start,
        reportingPeriodEnd: end,
        status: "DRAFT"
      }
    });
    return NextResponse.json({ submission: created, created: true }, { status: 201 });
  } catch (e: any) {
    // P2002 = unique violation — another request created it between
    // our find and create. Re-fetch and return.
    if (e?.code === "P2002") {
      const racedExisting = await prisma.manhoursSubmission.findUnique({
        where: {
          plantId_reportingYear_reportingMonth: {
            plantId,
            reportingYear,
            reportingMonth
          }
        }
      });
      if (racedExisting) return NextResponse.json({ submission: racedExisting, created: false });
    }
    throw e;
  }
}
