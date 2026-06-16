// ──────────────────────────────────────────────────────────────────────────
// Workflow trails for all DEMO- activity records.
//
// Creates WorkflowInstance + WorkflowHistory + WorkflowTask rows so that
// every seeded record shows a proper audit trail, "Actions Remaining" panel,
// and workflow step diagram on its detail page.
//
// Covers: Observation, Near Miss, Permit to Work, Incident.
// (FLRA has no standalone workflow — it is embedded in the PTW flow.)
//
// Idempotent: deletes existing WorkflowInstance rows for DEMO- records
// before re-creating them.
//
// Run:   npx tsx prisma/seed-activity-workflows.ts
// ──────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────

function msAgo(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 3_600_000);
}
function msAfter(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 3_600_000);
}

type StepRow = {
  id: string;
  sequence: number;
  stepType: string;
  name: string;
  slaHours: number | null;
};

type DefRow = {
  id: string;
  steps: StepRow[];
};

// ── Load workflow definitions ─────────────────────────────────────────────

async function loadDef(module: string, recordType?: string): Promise<DefRow> {
  const where = recordType
    ? { module, recordType, isActive: true }
    : { module, isActive: true };
  const def = await prisma.workflowDefinition.findFirst({
    where,
    include: {
      steps: {
        orderBy: { sequence: "asc" },
        select: { id: true, sequence: true, stepType: true, name: true, slaHours: true },
      },
    },
  });
  if (!def) throw new Error(`No active WorkflowDefinition for module="${module}" recordType="${recordType ?? ""}"`);
  return { id: def.id, steps: def.steps };
}

// PTW type → workflow recordType
const PTW_TYPE_MAP: Record<string, string> = {
  HOT_WORK: "HOT_WORK",
  CONFINED_SPACE: "CONFINED_SPACE",
  WORK_AT_HEIGHT: "WORK_AT_HEIGHT",
  EXCAVATION: "EXCAVATION",
  ELECTRICAL_LOTO: "ELECTRICAL_LOTO",
  GENERAL_COLD: "GENERAL_COLD",
};

// ── Instance + History + Task builder ────────────────────────────────────

/**
 * stepsCompleted: how many sequential steps have been fully completed
 *   0 = just initiated (MAKER step is step 1 = done at init time)
 *   1 = step 1 done, step 2 pending
 *   n = n steps done, step n+1 pending (or all done if n >= total)
 */
async function createWorkflowTrail(opts: {
  module: string;
  recordId: string;
  recordNumber: string;
  recordTitle: string;
  recordDate: Date;
  closedAt: Date | null;
  stepsCompleted: number;
  allSteps: StepRow[];
  definitionId: string;
  actors: {
    initiator: string;
    checker: string;
    checker2?: string;
    assignee: string;
    verifier: string;
    closer: string;
  };
}) {
  const {
    module, recordId, recordNumber, recordTitle, recordDate,
    closedAt, stepsCompleted, allSteps, definitionId, actors,
  } = opts;

  const isFullyClosed = stepsCompleted >= allSteps.length || closedAt !== null;
  const completedSteps = isFullyClosed ? allSteps : allSteps.slice(0, stepsCompleted);
  const currentStep = isFullyClosed ? undefined : allSteps[stepsCompleted];

  const instanceStatus = isFullyClosed
    ? "COMPLETED"
    : stepsCompleted > 0
      ? "IN_PROGRESS"
      : "IN_PROGRESS";

  // ── WorkflowInstance ──────────────────────────────────────────────────
  const instance = await prisma.workflowInstance.create({
    data: {
      definitionId,
      module,
      recordId,
      recordNumber,
      status: instanceStatus,
      currentStepId: isFullyClosed ? null : (currentStep?.id ?? null),
      currentStepName: isFullyClosed ? null : (currentStep?.name ?? null),
      initiatedById: actors.initiator,
      initiatedAt: recordDate,
      completedAt: isFullyClosed ? (closedAt ?? msAfter(recordDate, 168)) : null,
    },
  });

  // ── WorkflowHistory ───────────────────────────────────────────────────
  // Helper: pick actor for a completed step
  const actorFor = (step: StepRow, idx: number): string => {
    if (step.stepType === "MAKER")       return actors.initiator;
    if (step.stepType === "ASSIGNEE_TASK") return actors.assignee;
    if (step.stepType === "VERIFIER")    return actors.verifier;
    if (step.stepType === "CLOSURE")     return actors.closer;
    // CHECKER steps: alternate between checker / checker2
    return (idx % 2 === 0 || !actors.checker2) ? actors.checker : actors.checker2;
  };

  const actionFor = (step: StepRow): string => {
    if (step.stepType === "MAKER")        return "INITIATED";
    if (step.stepType === "ASSIGNEE_TASK") return "EXECUTED";
    if (step.stepType === "VERIFIER")     return "VERIFIED";
    if (step.stepType === "CLOSURE")      return "COMPLETED";
    return "APPROVED";
  };

  // Spread completed steps evenly in time between recordDate and closedAt/now
  const endTime = isFullyClosed ? (closedAt ?? msAfter(recordDate, 168)) : msAfter(recordDate, 24 * stepsCompleted);
  const span = endTime.getTime() - recordDate.getTime();
  const stepInterval = completedSteps.length > 1 ? span / completedSteps.length : 3_600_000;

  for (let i = 0; i < completedSteps.length; i++) {
    const step = completedSteps[i];
    const performedAt = new Date(recordDate.getTime() + stepInterval * (i + 1));

    await prisma.workflowHistory.create({
      data: {
        instanceId: instance.id,
        stepId: step.id,
        stepName: step.name,
        action: actionFor(step),
        performedById: actorFor(step, i),
        performedAt,
        fromStatus: i === 0 ? null : "IN_PROGRESS",
        toStatus: i === completedSteps.length - 1 && isFullyClosed ? "COMPLETED" : "IN_PROGRESS",
        comments: commentFor(step, recordNumber),
      },
    });
  }

  // ── WorkflowTask — pending step (if not fully closed) ─────────────────
  if (!isFullyClosed && currentStep) {
    const assigneeForTask =
      currentStep.stepType === "ASSIGNEE_TASK"
        ? actors.assignee
        : currentStep.stepType === "VERIFIER"
          ? actors.verifier
          : currentStep.stepType === "CLOSURE"
            ? actors.closer
            : actors.checker;

    const dueAt = msAfter(
      new Date(recordDate.getTime() + stepInterval * stepsCompleted),
      currentStep.slaHours ?? 48
    );

    await prisma.workflowTask.create({
      data: {
        instanceId: instance.id,
        stepId: currentStep.id,
        stepName: currentStep.name,
        taskType:
          currentStep.stepType === "ASSIGNEE_TASK" ? "EXECUTION"
          : currentStep.stepType === "VERIFIER" ? "VERIFICATION"
          : "APPROVAL",
        module,
        recordId,
        recordNumber,
        recordTitle,
        assignedToId: assigneeForTask,
        assignedAt: new Date(recordDate.getTime() + stepInterval * stepsCompleted),
        dueAt,
        status: "PENDING",
        priority: "NORMAL",
      },
    });
  }

  return instance.id;
}

function commentFor(step: StepRow, number: string): string {
  switch (step.stepType) {
    case "MAKER":        return `${number} initiated and submitted for review.`;
    case "CHECKER":      return `${step.name} completed. Proceeding to next step.`;
    case "ASSIGNEE_TASK": return `Action / investigation task completed. Evidence recorded.`;
    case "VERIFIER":     return `Verification complete. Corrective action confirmed effective.`;
    case "CLOSURE":      return `Record closed. Lessons documented and distributed.`;
    default:             return `Step completed.`;
  }
}

// ── Status → stepsCompleted mapping per module ────────────────────────────

function obsStepsCompleted(status: string): number {
  switch (status) {
    case "OPEN":        return 1; // submitted; checker review pending
    case "ASSIGNED":    return 2; // section head approved; action assigned
    case "IN_PROGRESS": return 3; // action executing; verifier pending
    case "CLOSED":      return 99;
    default:            return 1;
  }
}

function nmStepsCompleted(status: string): number {
  switch (status) {
    case "REPORTED":       return 1; // submitted; joint review pending
    case "UNDER_REVIEW":   return 2; // joint review done; CAPA definition pending
    case "ACTION_ASSIGNED":return 3; // CAPA defined; execution pending
    case "CLOSED":         return 99;
    default:               return 1;
  }
}

function ptwStepsCompleted(status: string): number {
  switch (status) {
    case "SUBMITTED":        return 1;
    case "ISSUER_APPROVED":  return 2;
    case "SAFETY_APPROVED":  return 3; // safety officer approved; plant head / receiver pending
    case "PLANT_APPROVED":   return 4;
    case "ACTIVE":           return 5;
    case "CLOSED":           return 99;
    default:                 return 3;
  }
}

function incidentStepsCompleted(status: string): number {
  switch (status) {
    case "REPORTED":       return 1; // reported; HSE classification pending
    case "INVESTIGATION":  return 2; // classified; investigation underway
    case "CAPA_ASSIGNED":  return 3; // RCA done; review pending
    case "VERIFIED":       return 5; // all reviews done; closure pending
    case "CLOSED":         return 99;
    default:               return 1;
  }
}

// ── Main per-plant seeder ─────────────────────────────────────────────────

async function seedWorkflowsForPlant(plantCode: "NW" | "SW") {
  const P = plantCode;

  // Resolve users
  const get = (email: string) => prisma.user.findFirstOrThrow({ where: { email } });
  const [hse, supervisor, worker, issuer, plantHead, safetyOfficer] = await Promise.all([
    P === "NW"
      ? prisma.user.findFirstOrThrow({ where: { email: "hse-manager.it.nw@safeops360.in" } })
      : get(`hse-manager.it.${P.toLowerCase()}@safeops360.in`),
    get(`supervisor.it.${P.toLowerCase()}@safeops360.in`),
    get(`worker.it.${P.toLowerCase()}@safeops360.in`),
    get(`permit-issuer.it.${P.toLowerCase()}@safeops360.in`),
    get(`plant-head.it.${P.toLowerCase()}@safeops360.in`),
    get(`safety-officer.it.${P.toLowerCase()}@safeops360.in`),
  ]);

  // Shared actors for re-use
  const baseActors = {
    initiator: worker.id,
    checker:   hse.id,
    checker2:  supervisor.id,
    assignee:  supervisor.id,
    verifier:  safetyOfficer.id,
    closer:    hse.id,
  };

  // ── OBSERVATIONS ────────────────────────────────────────────────────────
  const obsDef = await loadDef("OBSERVATION");
  const observations = await prisma.observation.findMany({
    where: { number: { contains: `-${P}-DEMO-` } },
    select: { id: true, number: true, status: true, date: true, closedAt: true, description: true },
  });

  for (const obs of observations) {
    await createWorkflowTrail({
      module: "OBSERVATION",
      recordId: obs.id,
      recordNumber: obs.number,
      recordTitle: obs.description.slice(0, 80),
      recordDate: obs.date,
      closedAt: obs.closedAt,
      stepsCompleted: obsStepsCompleted(obs.status),
      allSteps: obsDef.steps,
      definitionId: obsDef.id,
      actors: {
        ...baseActors,
        initiator: safetyOfficer.id, // observations are made by safety officer
        checker: supervisor.id,
        checker2: hse.id,
        assignee: supervisor.id,
        verifier: safetyOfficer.id,
        closer: hse.id,
      },
    });
  }
  console.log(`   ✓ ${P}: ${observations.length} Observation workflows created`);

  // ── NEAR MISSES ─────────────────────────────────────────────────────────
  const nmDef = await loadDef("NEAR_MISS");
  const nearMisses = await prisma.nearMiss.findMany({
    where: { number: { contains: `-${P}-DEMO-` } },
    select: { id: true, number: true, status: true, date: true, closedAt: true, description: true },
  });

  for (const nm of nearMisses) {
    await createWorkflowTrail({
      module: "NEAR_MISS",
      recordId: nm.id,
      recordNumber: nm.number,
      recordTitle: nm.description.slice(0, 80),
      recordDate: nm.date,
      closedAt: nm.closedAt,
      stepsCompleted: nmStepsCompleted(nm.status),
      allSteps: nmDef.steps,
      definitionId: nmDef.id,
      actors: {
        ...baseActors,
        initiator: worker.id,
        checker: hse.id,
        checker2: supervisor.id,
        assignee: supervisor.id,
        verifier: hse.id,
        closer: hse.id,
      },
    });
  }
  console.log(`   ✓ ${P}: ${nearMisses.length} Near Miss workflows created`);

  // ── PERMITS TO WORK ──────────────────────────────────────────────────────
  const permits = await prisma.permit.findMany({
    where: { number: { contains: `-${P}-DEMO-` } },
    select: { id: true, number: true, status: true, type: true, validFrom: true, closedAt: true, scopeOfWork: true },
  });

  // Cache PTW defs to avoid repeated DB calls
  const ptwDefCache = new Map<string, DefRow>();
  const getPtwDef = async (permitType: string): Promise<DefRow> => {
    const rt = PTW_TYPE_MAP[permitType] ?? "GENERAL_COLD";
    if (!ptwDefCache.has(rt)) ptwDefCache.set(rt, await loadDef("PTW", rt));
    return ptwDefCache.get(rt)!;
  };

  for (const ptw of permits) {
    const def = await getPtwDef(ptw.type);
    await createWorkflowTrail({
      module: "PTW",
      recordId: ptw.id,
      recordNumber: ptw.number,
      recordTitle: `${ptw.type.replace(/_/g, " ")} — ${ptw.number}`,
      recordDate: ptw.validFrom ?? new Date(),
      closedAt: ptw.closedAt,
      stepsCompleted: ptwStepsCompleted(ptw.status),
      allSteps: def.steps,
      definitionId: def.id,
      actors: {
        initiator: supervisor.id,
        checker: issuer.id,
        checker2: safetyOfficer.id,
        assignee: worker.id,
        verifier: safetyOfficer.id,
        closer: issuer.id,
      },
    });
  }
  console.log(`   ✓ ${P}: ${permits.length} Permit workflows created`);

  // ── INCIDENTS ────────────────────────────────────────────────────────────
  const incDef = await loadDef("INCIDENT");
  const incidents = await prisma.incident.findMany({
    where: { number: { contains: `-${P}-DEMO-` } },
    select: { id: true, number: true, status: true, date: true, closedAt: true, description: true },
  });

  for (const inc of incidents) {
    await createWorkflowTrail({
      module: "INCIDENT",
      recordId: inc.id,
      recordNumber: inc.number,
      recordTitle: inc.description.slice(0, 80),
      recordDate: inc.date,
      closedAt: inc.closedAt,
      stepsCompleted: incidentStepsCompleted(inc.status),
      allSteps: incDef.steps,
      definitionId: incDef.id,
      actors: {
        initiator: worker.id,
        checker: hse.id,
        checker2: plantHead.id,
        assignee: hse.id,
        verifier: hse.id,
        closer: hse.id,
      },
    });
  }
  console.log(`   ✓ ${P}: ${incidents.length} Incident workflows created`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  SafeOps360 — Workflow Trails for DEMO- Records      ║");
  console.log("║  Obs + Near Miss + PTW + Incident × 2 plants        ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // ── Idempotent cleanup ─────────────────────────────────────────────────
  console.log("   🧹 Removing previous workflow trails for DEMO- records…");

  const modules = ["OBSERVATION", "NEAR_MISS", "PTW", "INCIDENT"] as const;
  for (const mod of modules) {
    const demoPrefix = mod === "PTW" ? "PTW-" : mod === "OBSERVATION" ? "OBS-" : mod === "NEAR_MISS" ? "NM-" : "INC-";
    const instances = await prisma.workflowInstance.findMany({
      where: { module: mod, recordNumber: { contains: "-DEMO-" } },
      select: { id: true },
    });
    if (instances.length > 0) {
      // WorkflowHistory and WorkflowTask cascade on WorkflowInstance delete
      await prisma.workflowInstance.deleteMany({
        where: { id: { in: instances.map((i) => i.id) } },
      });
      console.log(`   Cleaned ${instances.length} ${mod} instances`);
    }
    void demoPrefix; // suppress lint
  }

  // ── Seed NW ──────────────────────────────────────────────────────────────
  console.log("\n   🏭 NW plant workflows…");
  await seedWorkflowsForPlant("NW");

  // ── Seed SW ──────────────────────────────────────────────────────────────
  console.log("\n   🏭 SW plant workflows…");
  await seedWorkflowsForPlant("SW");

  // ── Summary ───────────────────────────────────────────────────────────────
  const [instanceCount, historyCount, taskCount] = await Promise.all([
    prisma.workflowInstance.count({ where: { recordNumber: { contains: "-DEMO-" } } }),
    prisma.workflowHistory.count({
      where: { instance: { recordNumber: { contains: "-DEMO-" } } },
    }),
    prisma.workflowTask.count({
      where: { recordNumber: { contains: "-DEMO-" } },
    }),
  ]);

  console.log("\n   ╔══════════════════════════════════════════════╗");
  console.log("   ║  Workflow rows created for DEMO- records     ║");
  console.log(`   ║  WorkflowInstances : ${String(instanceCount).padStart(3)}                  ║`);
  console.log(`   ║  WorkflowHistory   : ${String(historyCount).padStart(3)}                  ║`);
  console.log(`   ║  WorkflowTasks     : ${String(taskCount).padStart(3)}  (pending steps)   ║`);
  console.log("   ╚══════════════════════════════════════════════╝");
  console.log("\n✅  Workflow trail seed complete.\n");
}

main()
  .catch((e) => { console.error("❌  Seed failed:", e?.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
