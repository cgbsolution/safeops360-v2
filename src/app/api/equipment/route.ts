import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

// Create a piece of equipment in the Equipment Master.
// Security boundary — the <Can> button is only UX; this check is what
// actually enforces who may register equipment. Scope is plant-aware:
// OWN_PLANT users can only create at their own plant; ALL_PLANTS roles
// (e.g. HSE Manager) can create at any plant.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const body = await req.json().catch(() => ({}));

  const required = ["code", "name", "category", "plantId", "location"];
  for (const f of required) {
    if (!body[f] || !String(body[f]).trim()) {
      return NextResponse.json(
        { error: `${f} is required` },
        { status: 400 }
      );
    }
  }

  const allowed = await can(userId, "EQUIPMENT_MASTER.CREATE", { plantId: body.plantId });
  if (!allowed.allowed) {
    return NextResponse.json({ error: allowed.reason ?? "Forbidden" }, { status: 403 });
  }

  const str = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s ? s : null;
  };

  try {
    const created = await prisma.equipment.create({
      data: {
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        category: String(body.category).trim(),
        subCategory: str(body.subCategory),
        plantId: body.plantId,
        location: String(body.location).trim(),
        // Legacy single-frequency field is required on the model; default to
        // MONTHLY when the caller doesn't pick one.
        frequency: ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"].includes(body.frequency)
          ? body.frequency
          : "MONTHLY",
        criticality: ["A", "B", "C", "D"].includes(body.criticality) ? body.criticality : null,
        make: str(body.make),
        modelNumber: str(body.modelNumber),
        serialNumber: str(body.serialNumber),
        manufacturer: str(body.manufacturer),
        statutoryRegistrationNumber: str(body.statutoryRegistrationNumber),
        commissioningDate: body.commissioningDate ? new Date(body.commissioningDate) : null,
        active: true
      },
      select: { id: true, code: true }
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: `Equipment code "${body.code}" already exists` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: e?.message ?? "Create failed" }, { status: 500 });
  }
}
