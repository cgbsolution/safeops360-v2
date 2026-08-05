import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Clear the Inbox unread state for the caller's own open tasks.
 *
 * Scoped to `assignedToId = me` and nothing else: read state is personal, so
 * there is no request shape that lets one user mark another's queue read. No
 * permission check beyond authentication is needed for the same reason.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { count } = await prisma.workflowTask.updateMany({
    where: {
      assignedToId: userId,
      status: { in: ["PENDING", "OVERDUE", "ESCALATED"] },
      readAt: null
    },
    data: { readAt: new Date() }
  });

  return NextResponse.json({ ok: true, marked: count });
}
