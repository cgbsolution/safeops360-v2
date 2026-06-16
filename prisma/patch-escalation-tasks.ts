// Patch: reassign all [Escalation] tasks from priya.nair to the correct
// plant-scoped user based on the record's plant (NW/SW in recordNumber).
//
// Rule:
//   recordNumber contains NW → hse-manager.it.nw (+ trainer/maintenance/supervisor per step)
//   recordNumber contains SW → hse-manager.it.sw (+ corresponding plant user per step)

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const priya = await p.user.findFirstOrThrow({ where: { email: "priya.nair@safeops360.in" }, select: { id: true } });

  const tasks = await p.workflowTask.findMany({
    where: {
      assignedToId: priya.id,
      stepName: { startsWith: "[Escalation]" },
      status: { in: ["PENDING", "OVERDUE", "ESCALATED"] },
    },
    select: { id: true, module: true, recordNumber: true, stepName: true },
  });

  console.log(`Found ${tasks.length} escalation tasks assigned to priya.nair`);

  // User lookup cache
  const userCache: Record<string, string> = {};
  const getUser = async (email: string): Promise<string> => {
    if (!userCache[email]) {
      const u = await p.user.findFirstOrThrow({ where: { email }, select: { id: true } });
      userCache[email] = u.id;
    }
    return userCache[email];
  };

  for (const task of tasks) {
    const rn = task.recordNumber ?? "";
    const isNW = rn.includes("-NW-") || rn.includes("NW");
    const slug = isNW ? "nw" : "sw";
    const sn = task.stepName.replace("[Escalation] ", "");

    // Route to the most appropriate escalation user for each step type
    let email: string;
    if (sn.includes("Trainer Conducts")) {
      email = `ld-manager.it.${slug}@safeops360.in`;
    } else if (sn.includes("Inspector Executes")) {
      email = `maintenance-head.it.${slug}@safeops360.in`;
    } else if (sn.includes("Team Review Sign-off")) {
      email = `plant-head.it.${slug}@safeops360.in`;
    } else {
      // Default: HSE Manager is the escalation owner for most safety workflow steps
      email = `hse-manager.it.${slug}@safeops360.in`;
    }

    // Fallback: check user exists; if not fall back to hse-manager
    let newUserId: string;
    try {
      newUserId = await getUser(email);
    } catch {
      newUserId = await getUser(`hse-manager.it.${slug}@safeops360.in`);
    }

    await p.workflowTask.update({
      where: { id: task.id },
      data: { assignedToId: newUserId },
    });

    console.log(`  ✓ ${rn.padEnd(28)} ${sn.substring(0, 40).padEnd(40)} → ${email}`);
  }

  console.log(`\n✅  Patched ${tasks.length} escalation tasks.`);
}

main().catch(console.error).finally(() => p.$disconnect());
