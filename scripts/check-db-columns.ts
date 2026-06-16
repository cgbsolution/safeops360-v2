import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

(async () => {
  const cols: { column_name: string }[] = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Observation'
      AND column_name IN ('isRepeat','riskScore','triggeredInspectionId','closureTriggers','permitReviewFlagged','similarObservationIds','activePermitId')
    ORDER BY column_name
  `;
  console.log("Found columns:");
  for (const c of cols) console.log(`  ✓ ${c.column_name}`);

  // Also CoachingTask
  const ct: { table_name: string }[] = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'CoachingTask'
  `;
  console.log(`\nCoachingTask table: ${ct.length > 0 ? "✓ exists" : "✗ missing"}`);
})()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
