import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const nms = await p.nearMiss.findMany({ where: { number: { contains: "PROMO" } }, select: { id: true, number: true, promotedToIncident: true, promotedIncidentId: true, status: true } });
  console.log("Promo NMs:", nms);
  const all = await p.nearMiss.count({ where: { promotedToIncident: true } });
  console.log("promotedToIncident=true count:", all);
}
main().catch(console.error).finally(() => p.$disconnect());
