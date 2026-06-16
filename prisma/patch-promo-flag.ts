import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const r = await p.nearMiss.updateMany({ where: { promotedIncidentId: { not: null } }, data: { promotedToIncident: true } });
  console.log("Updated", r.count, "near miss records → promotedToIncident=true");
  const check = await p.nearMiss.count({ where: { promotedToIncident: true } });
  console.log("Count now:", check);
}
main().catch(console.error).finally(() => p.$disconnect());
