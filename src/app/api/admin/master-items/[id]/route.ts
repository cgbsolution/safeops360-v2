import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "CONFIGURATION.MASTERS");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const body = await req.json();
  const data: any = {};
  // code is immutable once persisted (records reference it by value)
  if (body.label !== undefined) data.label = String(body.label).trim();
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
  if (body.active !== undefined) data.active = !!body.active;
  if (body.metadata !== undefined) data.metadata = body.metadata;

  const updated = await prisma.masterItem.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "CONFIGURATION.MASTERS");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  // Hard delete is fine — the code stored in records is just a string
  // and dropdowns will simply hide the option.
  await prisma.masterItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
