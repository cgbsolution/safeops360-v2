import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const emails = [
    "worker.it.nw@safeops360.in",
    "supervisor.it.nw@safeops360.in",
    "hse-manager.it.nw@safeops360.in",
    "worker.hr.nw@safeops360.in",
    "worker.it.sw@safeops360.in",
    "priya.nair@safeops360.in",
    "admin@safeops360.in",
  ];
  for (const email of emails) {
    const u = await prisma.user.findUnique({ where: { email }, select: { name: true, role: true } });
    console.log(email, "→", u ? `${u.name} (${u.role})` : "NOT FOUND");
  }

  const nwCount = await prisma.user.count({ where: { plant: { code: "NW" } } });
  const swCount = await prisma.user.count({ where: { plant: { code: "SW" } } });
  console.log(`\nNW plant users: ${nwCount}`);
  console.log(`SW plant users: ${swCount}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
