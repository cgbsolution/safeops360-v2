import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "CHECKLIST_TEMPLATE.APPROVE");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const existing = await prisma.checklistTemplate.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.approvalStatus !== "UNDER_REVIEW" && existing.approvalStatus !== "DRAFT") {
    return NextResponse.json({ error: `Cannot approve from status ${existing.approvalStatus}` }, { status: 409 });
  }

  // If a prior approved version of this code exists, retire it (only one
  // active version per code at a time).
  const prior = await prisma.checklistTemplate.findFirst({
    where: {
      code: existing.code,
      approvalStatus: "APPROVED",
      id: { not: existing.id }
    }
  });
  await prisma.$transaction(async (tx) => {
    if (prior) {
      await tx.checklistTemplate.update({
        where: { id: prior.id },
        data: { approvalStatus: "RETIRED" }
      });
    }
    await tx.checklistTemplate.update({
      where: { id: params.id },
      data: {
        approvalStatus: "APPROVED",
        approvedById: userId,
        approvedAt: new Date(),
        effectiveFrom: new Date()
      }
    });
  });

  return NextResponse.json({ ok: true });
}
