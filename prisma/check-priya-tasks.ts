import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const priya = await p.user.findFirst({ where: { email: "priya.nair@safeops360.in" }, select: { id: true, email: true } });
  if (!priya) { console.log("priya.nair not found"); return; }

  const tasks = await p.workflowTask.findMany({
    where: { assignedToId: priya.id, status: { in: ["PENDING", "OVERDUE", "ESCALATED"] } },
    select: { id: true, module: true, recordNumber: true, stepName: true, status: true },
    orderBy: { module: "asc" },
  });
  console.log(`\npriya.nair (${priya.id}) has ${tasks.length} pending tasks:\n`);
  tasks.forEach(t => console.log(`  ${t.module.padEnd(15)} ${(t.recordNumber ?? "").padEnd(25)} ${t.stepName}`));
}
main().catch(console.error).finally(() => p.$disconnect());
