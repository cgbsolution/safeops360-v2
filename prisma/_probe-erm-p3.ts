import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const plants = await prisma.plant.findMany({ select: { id: true, code: true } });
  console.log("PLANTS", JSON.stringify(plants));
  const emails = [
    "anand.krishnan@safeops360.in","rajesh.nair@safeops360.in","kavita.rao@safeops360.in",
    "meera.iyer@safeops360.in","suresh.patel@safeops360.in","lakshmi.venkatesh@safeops360.in",
    "devendra.kulkarni@safeops360.in","nandini.subramaniam@safeops360.in","farhan.qureshi@safeops360.in"
  ];
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true, name: true } });
  console.log("USERS", JSON.stringify(users));
  const risks = await prisma.enterpriseRisk.findMany({ where: { riskCode: { startsWith: "ERM-2026-" } }, select: { riskCode: true }, orderBy: { riskCode: "asc" } });
  console.log("RISKS", risks.map(r=>r.riskCode).join(","));
  const role = await prisma.role.findUnique({ where: { code: "BCM_COORDINATOR" }, select: { id: true, code: true } });
  console.log("ROLE", JSON.stringify(role));
  const cats = await prisma.riskCategory.findMany({ select: { code: true } });
  console.log("CATS", cats.map(c=>c.code).join(","));
  const incs = await prisma.incident.count();
  console.log("INCIDENTS", incs);
}
main().catch(e=>{console.error("PROBE ERR", e.message); process.exit(1);}).finally(()=>prisma.$disconnect());
