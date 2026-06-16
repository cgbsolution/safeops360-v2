import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { dueDateForUpdatedSeverity } from "@/lib/inspections/finding-engine";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "INSPECTION_FINDING.READ");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const f = await prisma.inspectionFinding.findUnique({
    where: { id: params.id },
    include: { capas: true, owner: true, inspection: { select: { number: true } } }
  });
  if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(f);
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const body = await req.json();
  const data: any = {};

  // Ownership shortcut
  if (body.takeOwnership) {
    const allowed = await can(userId, "INSPECTION_FINDING.UPDATE");
    if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });
    data.ownerId = userId;
    if (body.status === undefined) data.status = "IN_PROGRESS";
  }

  if (body.ownerId !== undefined) {
    const allowed = await can(userId, "INSPECTION_FINDING.UPDATE");
    if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });
    data.ownerId = body.ownerId;
  }
  if (body.rootCauseCategory !== undefined) data.rootCauseCategory = body.rootCauseCategory;
  if (body.rootCauseNote !== undefined) data.rootCauseNote = body.rootCauseNote;
  if (body.severity !== undefined) {
    data.severity = body.severity;
    data.dueDate = dueDateForUpdatedSeverity(body.severity);
  }
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;

  // Status transitions
  if (body.status === "CLOSED") {
    const allowed = await can(userId, "INSPECTION_FINDING.CLOSE");
    if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });
    data.status = "CLOSED";
    data.closedById = userId;
    data.closedAt = new Date();
    if (body.closureNote !== undefined) data.closureNote = body.closureNote;
  } else if (body.status === "VERIFIED") {
    const allowed = await can(userId, "INSPECTION_FINDING.VERIFY");
    if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });
    data.status = "VERIFIED";
    data.verifiedById = userId;
    data.verifiedAt = new Date();
  } else if (body.status === "DEFERRED") {
    const allowed = await can(userId, "INSPECTION_FINDING.DEFER");
    if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });
    data.status = "DEFERRED";
    if (body.deferredUntil) data.deferredUntil = new Date(body.deferredUntil);
    if (body.deferredReason) data.deferredReason = body.deferredReason;
  } else if (body.status === "DUPLICATE") {
    const allowed = await can(userId, "INSPECTION_FINDING.UPDATE");
    if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });
    if (body.duplicateOfFindingNumber) {
      const orig = await prisma.inspectionFinding.findUnique({
        where: { findingNumber: body.duplicateOfFindingNumber },
        select: { id: true }
      });
      if (!orig) return NextResponse.json({ error: `No finding with number ${body.duplicateOfFindingNumber}` }, { status: 400 });
      data.duplicateOfFindingId = orig.id;
    }
    data.status = "DUPLICATE";
  } else if (body.status === "IN_PROGRESS" || body.status === "OPEN" || body.status === "UNDER_REVIEW") {
    data.status = body.status;
  }

  // Effectiveness review fields
  if (body.effectivenessRating !== undefined) {
    const allowed = await can(userId, "INSPECTION_FINDING.UPDATE");
    if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });
    data.effectivenessRating = body.effectivenessRating;
    data.effectivenessReviewedById = userId;
    data.effectivenessReviewedAt = new Date();
  }
  if (body.effectivenessNote !== undefined) data.effectivenessNote = body.effectivenessNote;

  try {
    const updated = await prisma.inspectionFinding.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Update failed" }, { status: 500 });
  }
}
