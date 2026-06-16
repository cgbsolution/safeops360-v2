import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const defs = await p.workflowDefinition.findMany({ select: { module: true, recordType: true, name: true } });
  defs.forEach(d => console.log(d.module, (d.recordType ?? "").padEnd(20), d.name));
}
main().catch(console.error).finally(() => p.$disconnect());
