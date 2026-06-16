import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "CONFIGURATION.MASTERS");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const where: any = {};
  if (type) where.type = type;

  const items = await prisma.masterItem.findMany({
    where,
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "CONFIGURATION.MASTERS");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const body = await req.json();
  if (!body.type || !body.code || !body.label) {
    return NextResponse.json({ error: "Type, code and label are required" }, { status: 400 });
  }

  const code = String(body.code).trim().toUpperCase().replace(/\s+/g, "_");
  const type = String(body.type).trim().toUpperCase().replace(/\s+/g, "_");

  try {
    const created = await prisma.masterItem.create({
      data: {
        type,
        code,
        label: String(body.label).trim(),
        sortOrder: Number(body.sortOrder) || 0,
        active: body.active !== false,
        metadata: body.metadata ?? null
      }
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json(
        { error: `A value with code "${code}" already exists for type ${type}.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: e.message ?? "Create failed" }, { status: 500 });
  }
}
