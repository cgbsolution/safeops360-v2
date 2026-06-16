import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const plants = await p.plant.findMany({ select: { id: true, code: true } });
  for (const plant of plants) {
    await p.eaiFeatureFlag.upsert({
      where: { plantId: plant.id },
      update: {
        eaiRegisterEnabled: true,
        combinedRegisterEnabled: true,
        riskDashboardEnabled: true,
        hiraAssistantV2Enabled: true,
        enabledAt: new Date(),
      },
      create: {
        plantId: plant.id,
        eaiRegisterEnabled: true,
        combinedRegisterEnabled: true,
        riskDashboardEnabled: true,
        hiraAssistantV2Enabled: true,
        enabledAt: new Date(),
      },
    });
    console.log(`✓ ${plant.code} — eaiRegister, combinedRegister, riskDashboard, hiraAssistantV2 → all ENABLED`);
  }
  // Verify
  const flags = await p.eaiFeatureFlag.findMany({ select: { plantId: true, eaiRegisterEnabled: true, combinedRegisterEnabled: true, riskDashboardEnabled: true } });
  console.log("\nVerification:", flags);
}
main().catch(console.error).finally(() => p.$disconnect());
