import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { generateUpcomingInspections } from "@/lib/inspections/schedule-generator";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "INSPECTION.SCHEDULE");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const result = await generateUpcomingInspections({
    horizonDays: body.horizonDays ?? 60,
    plantId: body.plantId
  });
  return NextResponse.json(result);
}
