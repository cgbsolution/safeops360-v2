import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const priya = await p.user.findFirstOrThrow({ where: { email: "priya.nair@safeops360.in" }, select: { id: true } });
  const tasks = await p.workflowTask.findMany({
    where: { assignedToId: priya.id, status: { in: ["PENDING", "OVERDUE", "ESCALATED"] } },
    select: { id: true, module: true, recordNumber: true, stepName: true, status: true, dueAt: true, assignedAt: true },
    take: 5,
  });
  tasks.forEach(t => console.log(JSON.stringify(t, null, 2)));
}
main().catch(console.error).finally(() => p.$disconnect());
