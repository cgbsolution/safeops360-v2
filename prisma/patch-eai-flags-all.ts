import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  // 1. Upsert a flag record for every plant (some may not have one yet)
  const plants = await p.plant.findMany({ select: { id: true, code: true } });
  for (const plant of plants) {
    await p.eaiFeatureFlag.upsert({
      where: { plantId: plant.id },
      update: { eaiRegisterEnabled: true, combinedRegisterEnabled: true, riskDashboardEnabled: true, hiraAssistantV2Enabled: true, enabledAt: new Date() },
      create: { plantId: plant.id, eaiRegisterEnabled: true, combinedRegisterEnabled: true, riskDashboardEnabled: true, hiraAssistantV2Enabled: true, enabledAt: new Date() },
    });
  }

  // 2. Force ALL records on (catches any pre-existing ones not in plant list)
  const r = await p.eaiFeatureFlag.updateMany({
    data: { eaiRegisterEnabled: true, combinedRegisterEnabled: true, riskDashboardEnabled: true, hiraAssistantV2Enabled: true },
  });

  const all = await p.eaiFeatureFlag.findMany({ select: { plantId: true, eaiRegisterEnabled: true, combinedRegisterEnabled: true, riskDashboardEnabled: true } });
  const allOn = all.every(f => f.eaiRegisterEnabled && f.combinedRegisterEnabled && f.riskDashboardEnabled);
  console.log(`Updated ${r.count} records. All flags ON: ${allOn} | Total: ${all.length}`);
  all.forEach(f => console.log(`  ${f.plantId}  eai=${f.eaiRegisterEnabled}  combined=${f.combinedRegisterEnabled}  riskDash=${f.riskDashboardEnabled}`));
}
main().catch(console.error).finally(() => p.$disconnect());
