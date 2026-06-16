// Traces who each workflow step would route to. Uses the same logic as the
// engine's findUserByRoles. Helps verify the workflow definition is correct
// before submitting a real record.
//
// Run with:  npx tsx scripts/trace-workflow.ts OBSERVATION
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function findUserByRole(roleCode: string, plantId: string) {
  const rows = await prisma.userRole.findMany({
    where: {
      role: { code: roleCode, isActive: true },
      OR: [{ validTo: null }, { validTo: { gt: new Date() } }]
    },
    include: { user: { select: { id: true, name: true, email: true, plantId: true } } },
    orderBy: { user: { createdAt: "asc" } }
  });
  if (rows.length === 0) return null;
  const atPlant = rows.find((r) => r.user.plantId === plantId);
  if (atPlant) return atPlant.user;
  return rows[0].user;
}

async function main() {
  const moduleArg = (process.argv[2] ?? "OBSERVATION").toUpperCase();
  const recordType = process.argv[3] ?? null;

  // Pick the first plant to trace against
  const plant = await prisma.plant.findFirst({ orderBy: { code: "asc" } });
  if (!plant) { console.log("No plants in DB."); return; }

  const def = await prisma.workflowDefinition.findFirst({
    where: { module: moduleArg, recordType, isActive: true },
    include: { steps: { orderBy: { sequence: "asc" } } }
  });
  if (!def) {
    console.log(`No workflow definition found for ${moduleArg}${recordType ? `/${recordType}` : ""}`);
    return;
  }

  console.log(`\n=== ${def.name} (plant: ${plant.name}) ===\n`);

  for (const step of def.steps) {
    const tag = `[${step.sequence}] ${step.stepType}`.padEnd(22);
    const sla = step.slaHours ? ` (SLA ${step.slaHours}h)` : "";

    if (step.approverRole) {
      const user = await findUserByRole(step.approverRole, plant.id);
      const fallback = step.escalationRole && !user
        ? await findUserByRole(step.escalationRole, plant.id)
        : null;
      const assignee = user
        ? `${user.name.padEnd(20)} <${user.email}>`
        : fallback
          ? `[esc→${step.escalationRole}] ${fallback.name} <${fallback.email}>`
          : "❌ NO USER FOUND";
      console.log(`${tag} ${step.name.padEnd(40)} role=${step.approverRole.padEnd(18)} → ${assignee}${sla}`);
    } else if (step.approverField) {
      console.log(`${tag} ${step.name.padEnd(40)} field=${step.approverField.padEnd(18)} → (resolved at runtime from record)${sla}`);
    } else {
      console.log(`${tag} ${step.name.padEnd(40)} (auto)`);
    }
  }
  console.log();
}

main().catch(console.error).finally(() => prisma.$disconnect());
