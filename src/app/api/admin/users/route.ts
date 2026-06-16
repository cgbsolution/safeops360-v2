import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, invalidateUserPermissions } from "@/lib/auth/permissions";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "CONFIGURATION.USERS");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, plantId: true, department: true, designation: true },
    orderBy: { name: "asc" }
  });
  return NextResponse.json({ items: users });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "CONFIGURATION.USERS");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const body = await req.json();
  if (!body.name || !body.email || !body.password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }
  if (String(body.password).length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Validate role exists
  const role = await prisma.role.findUnique({ where: { code: body.role ?? "WORKER" } });
  if (!role || !role.isActive) {
    return NextResponse.json({ error: `Role '${body.role}' is not active` }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  try {
    const created = await prisma.user.create({
      data: {
        name: String(body.name).trim(),
        email: String(body.email).trim().toLowerCase(),
        passwordHash,
        role: role.code,
        plantId: body.plantId || null,
        department: body.department ?? null,
        designation: body.designation ?? null
      }
    });
    // Mirror primary role into UserRole assignment
    await prisma.userRole.create({
      data: {
        userId: created.id,
        roleId: role.id,
        assignedById: userId
      } as any
    }).catch(() => null); // assignedById field is optional in some schemas
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: e.message ?? "Create failed" }, { status: 500 });
  }
}
