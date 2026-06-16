import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const [contractors, gateClearance, swUsers, eaiAspects] = await Promise.all([
    prisma.contractorCompany.findMany({ select: { id: true, name: true, code: true, prequalificationStatus: true }, take: 10 }),
    prisma.gateClearanceCheck.findMany({ select: { id: true, contractorWorkerId: true, siteId: true, overallResult: true }, take: 5 }),
    prisma.user.findMany({
      where: { email: { contains: ".it.sw@" } },
      select: { id: true, email: true },
      orderBy: { email: "asc" }
    }),
    prisma.eaiAspect.findMany({ select: { id: true, code: true, name: true, category: true }, take: 10 }),
  ]);
  console.log("CONTRACTORS:", JSON.stringify(contractors, null, 2));
  console.log("GATE_CLEARANCE:", JSON.stringify(gateClearance, null, 2));
  console.log("SW_USERS:", JSON.stringify(swUsers, null, 2));
  console.log("EAI_ASPECTS:", JSON.stringify(eaiAspects, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
