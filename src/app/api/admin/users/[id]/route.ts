import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, invalidateUserPermissions } from "@/lib/auth/permissions";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "CONFIGURATION.USERS");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const u = await prisma.user.findUnique({
    where: { id: params.id },
    include: { plant: true, userRoles: { include: { role: true } } }
  });
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(u);
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const callerId = (session.user as any).id;
  const allowed = await can(callerId, "CONFIGURATION.USERS");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const body = await req.json();
  const data: any = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.email !== undefined) data.email = String(body.email).trim().toLowerCase();
  if (body.role !== undefined) {
    const role = await prisma.role.findUnique({ where: { code: body.role } });
    if (!role || !role.isActive) {
      return NextResponse.json({ error: `Role '${body.role}' is not active` }, { status: 400 });
    }
    data.role = role.code;
    // Ensure a corresponding UserRole assignment exists
    const existing = await prisma.userRole.findFirst({
      where: { userId: params.id, roleId: role.id }
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: params.id, roleId: role.id, assignedById: callerId } as any
      }).catch(() => null);
    }
  }
  if (body.plantId !== undefined) data.plantId = body.plantId || null;
  if (body.department !== undefined) data.department = body.department || null;
  if (body.designation !== undefined) data.designation = body.designation || null;
  if (body.password) {
    if (String(body.password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }

  try {
    const updated = await prisma.user.update({ where: { id: params.id }, data });
    invalidateUserPermissions(params.id);
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Another user already has this email" }, { status: 409 });
    }
    return NextResponse.json({ error: e.message ?? "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const callerId = (session.user as any).id;
  const allowed = await can(callerId, "CONFIGURATION.USERS");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  if (params.id === callerId) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  // Soft-delete approach: drop UserRole assignments and disable login by
  // clearing the password hash. The User row is preserved so all FK
  // references in records (originator, owner, etc.) stay intact.
  //
  // For a hard delete you'd need to detach every FK relation first; we
  // settle for an account-disable that is reversible by setting a new
  // password from the same admin UI.
  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId: params.id } });
    await tx.user.update({
      where: { id: params.id },
      data: {
        passwordHash: "$2a$10$" + "x".repeat(53), // unusable hash
        role: "WORKER",
        plantId: null
      }
    });
  });
  invalidateUserPermissions(params.id);
  return NextResponse.json({ ok: true, mode: "soft-delete" });
}
