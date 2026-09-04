// Near Miss workflow, second edition.
//
// WHAT CHANGED AND WHY
//
// The six-step flow defined CAPAs at step 3 ("Review Meeting & CAPA
// Definition"), two approvals after the report was filed. In practice the
// person who saw the near miss already knows what should be done about it, and
// making them wait two steps to say so lost that. CAPAs are now written on the
// report form itself, and step 3 is gone.
//
// Step 2 changes with it. It was a JOINT_APPROVAL by HSE Manager and
// Department Head together; it is now the Safety Officer named on the report,
// who verifies the report and names an owner for each CAPA. That is the step
// the old flow's CAPA-definition reviewer used to do, minus writing the CAPAs.
//
//   1  Reported                  reporter — CAPAs defined here
//   2  Safety Officer Review     verifies; assigns each CAPA's owner
//   3  CAPA Execution            the assigned owners, in parallel
//   4  Verify CAPAs              HSE Manager checks the evidence
//   5  Final Closure             HSE Manager closes
//
// IN-FLIGHT RECORDS. The old definition is deactivated, not deleted, and no
// instance is touched. `workflow_engine.initiate` picks a definition by
// `module + isActive`, so new near misses get this one; the near misses
// already mid-flight keep the definitionId they started with and finish on
// the six steps they began. Nobody loses a task.
//
// Re-running is safe: the v2 definition is matched by name and its steps are
// rebuilt from scratch each time.
//
//   npx tsx prisma/seed-near-miss-workflow-v2.ts

import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

// Pinned to a single pgbouncer-mode connection. The sibling apply-*-ddl
// scripts get away with a bare `new PrismaClient()` because they only issue
// $executeRawUnsafe; the typed client calls below use prepared statements,
// which Supabase's transaction pooler rejects with
// `prepared statement "s0" already exists` on the second call.
const rawUrl = readFileSync(new URL("../.env", import.meta.url), "utf8").match(
  /^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m
)![1];
const url = rawUrl + (rawUrl.includes("?") ? "&" : "?") + "pgbouncer=true&connection_limit=1";

const prisma = new PrismaClient({ datasources: { db: { url } } });

const V2_NAME = "Near Miss — Production Workflow v2";

// Severity-driven SLA. The report form's SLA picker sets the record's own
// closure clock (NearMiss.slaHours); these are the per-step clocks.
const SEVERITY_SLA = JSON.stringify({ LOW: 336, MEDIUM: 168, HIGH: 48, CRITICAL: 24 });

const STEPS = [
  {
    sequence: 1,
    stepType: "MAKER",
    name: "Reported",
    notes:
      "The reporter files the near miss, including the CAPAs they think are needed. Owners are assigned at the next step."
  },
  {
    sequence: 2,
    stepType: "CHECKER",
    name: "Safety Officer Review",
    // The Safety Officer named on the report is the assignee; the role is the
    // fallback when the reporter left that field empty. _resolve_assignee
    // tries approverField first and falls through to approverRole.
    approverField: "SAFETY_OFFICER",
    approverRole: "SAFETY_OFFICER",
    escalationRole: "HSE_MANAGER",
    slaHours: 48,
    slaBySeverity: SEVERITY_SLA,
    notes:
      "Verify the report, then name an owner and target date for every CAPA on it. This step cannot be completed while any CAPA is still unowned."
  },
  {
    sequence: 3,
    stepType: "ASSIGNEE_TASK",
    name: "CAPA Execution",
    parallelStrategy: "CAPA_FAN_OUT",
    escalationRole: "HSE_MANAGER",
    notes: "Each CAPA owner completes their own action and attaches evidence."
  },
  {
    sequence: 4,
    stepType: "VERIFIER",
    name: "Verify CAPAs",
    approverRole: "HSE_MANAGER",
    escalationRole: "PLANT_HEAD",
    slaHours: 120,
    notes: "Check the evidence on every CAPA before the record is closed."
  },
  {
    sequence: 5,
    stepType: "CLOSURE",
    name: "Final Closure",
    approverRole: "HSE_MANAGER",
    escalationRole: "PLANT_HEAD",
    slaHours: 48,
    notes: "Close the near miss."
  }
] as const;

async function main() {
  console.log("\n=== Near Miss workflow v2 ===\n");

  const existing = await prisma.workflowDefinition.findFirst({
    where: { module: "NEAR_MISS", name: V2_NAME }
  });

  const definition = existing
    ? await prisma.workflowDefinition.update({
        where: { id: existing.id },
        data: {
          description:
            "CAPAs are defined on the report; the Safety Officer verifies and assigns their owners.",
          isActive: true
        }
      })
    : await prisma.workflowDefinition.create({
        data: {
          module: "NEAR_MISS",
          name: V2_NAME,
          description:
            "CAPAs are defined on the report; the Safety Officer verifies and assigns their owners.",
          isActive: true
        }
      });
  console.log(`${existing ? "Updated" : "Created"} definition ${definition.id}`);

  // Steps are rebuilt rather than diffed — a step's identity is its sequence,
  // and an in-flight instance never points at THIS definition (see header).
  const removed = await prisma.workflowStep.deleteMany({ where: { definitionId: definition.id } });
  if (removed.count) console.log(`  cleared ${removed.count} old step rows`);

  for (const s of STEPS) {
    await prisma.workflowStep.create({ data: { definitionId: definition.id, ...s } });
    console.log(`  ${s.sequence}. ${s.name.padEnd(24)} ${s.stepType}`);
  }

  // Retire every other NEAR_MISS definition so new records land on v2.
  const retired = await prisma.workflowDefinition.updateMany({
    where: { module: "NEAR_MISS", isActive: true, id: { not: definition.id } },
    data: { isActive: false }
  });
  console.log(`\nRetired ${retired.count} earlier definition(s) — in-flight instances keep theirs.`);

  const inFlight = await prisma.workflowInstance.count({
    where: { module: "NEAR_MISS", status: { in: ["IN_PROGRESS", "PENDING", "REJECTED"] } }
  });
  console.log(`${inFlight} near miss instance(s) still running on the previous definition.`);
  console.log("\n✅  Done.\n");
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
