// ──────────────────────────────────────────────────────────────────────────
// Seed: Near Misses promoted to Incident investigations.
//
// Each pair:
//   NM-{P}-PROMO-001  (CRITICAL NearMiss, status=CLOSED)
//     └─ promoted to ─►  INC-{P}-PROMO-001  (PROCESS_SAFETY, INVESTIGATION)
//
// Both sides of the bidirectional link are set:
//   NearMiss.promotedIncidentId  → Incident.id
//   Incident.sourceNearMissId    → NearMiss.id
//
// Workflow instances are created for both records so detail pages show full
// audit trails + "Promoted to Incident" badges.
// ──────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const DEMO_TODAY = new Date("2026-06-07T09:00:00.000Z");
function daysAgo(n: number) { const d = new Date(DEMO_TODAY); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(DEMO_TODAY); d.setDate(d.getDate() + n); return d; }
function hoursAfter(base: Date, h: number) { return new Date(base.getTime() + h * 3_600_000); }

// ── Load WorkflowDefinition for a module ─────────────────────────────────
async function loadDef(module: string) {
  const def = await prisma.workflowDefinition.findFirstOrThrow({
    where: { module, isActive: true },
    include: {
      steps: { orderBy: { sequence: "asc" }, select: { id: true, sequence: true, stepType: true, name: true, slaHours: true } },
    },
  });
  return def;
}

// ── Create workflow trail (shared with seed-activity-workflows pattern) ───
async function createTrail(opts: {
  module: string;
  recordId: string;
  recordNumber: string;
  recordTitle: string;
  recordDate: Date;
  stepsCompleted: number;   // how many steps have been completed
  def: { id: string; steps: { id: string; sequence: number; stepType: string; name: string; slaHours: number | null }[] };
  actors: { initiator: string; checker: string; assignee: string; closer: string };
}) {
  const { module, recordId, recordNumber, recordTitle, recordDate, stepsCompleted, def, actors } = opts;
  const allSteps = def.steps;
  const completedSteps = allSteps.slice(0, stepsCompleted);
  const currentStep = allSteps[stepsCompleted] ?? null;
  const isComplete = stepsCompleted >= allSteps.length;

  const instance = await prisma.workflowInstance.create({
    data: {
      definitionId: def.id,
      module,
      recordId,
      recordNumber,
      status: isComplete ? "COMPLETED" : "IN_PROGRESS",
      currentStepId: currentStep?.id ?? null,
      currentStepName: currentStep?.name ?? null,
      initiatedById: actors.initiator,
      initiatedAt: recordDate,
      completedAt: isComplete ? hoursAfter(recordDate, 240) : null,
    },
  });

  const span = (isComplete ? hoursAfter(recordDate, 240) : hoursAfter(recordDate, 48)).getTime() - recordDate.getTime();
  const interval = completedSteps.length > 1 ? span / completedSteps.length : 4 * 3_600_000;

  for (let i = 0; i < completedSteps.length; i++) {
    const step = completedSteps[i];
    const actor =
      step.stepType === "MAKER" ? actors.initiator
      : step.stepType === "ASSIGNEE_TASK" ? actors.assignee
      : step.stepType === "CLOSURE" ? actors.closer
      : actors.checker;
    const action =
      step.stepType === "MAKER" ? "INITIATED"
      : step.stepType === "ASSIGNEE_TASK" ? "EXECUTED"
      : step.stepType === "VERIFIER" ? "VERIFIED"
      : step.stepType === "CLOSURE" ? "COMPLETED"
      : "APPROVED";

    await prisma.workflowHistory.create({
      data: {
        instanceId: instance.id,
        stepId: step.id,
        stepName: step.name,
        action,
        performedById: actor,
        performedAt: new Date(recordDate.getTime() + interval * (i + 1)),
        fromStatus: i === 0 ? null : "IN_PROGRESS",
        toStatus: i === completedSteps.length - 1 && isComplete ? "COMPLETED" : "IN_PROGRESS",
        comments: action === "INITIATED" ? `${recordNumber} submitted.`
          : action === "APPROVED" ? `${step.name} — approved. Proceeding to next step.`
          : action === "EXECUTED" ? `Task executed. Evidence recorded. Submission to next reviewer.`
          : `Step completed — ${step.name}.`,
      },
    });
  }

  // Pending task for current step
  if (!isComplete && currentStep) {
    await prisma.workflowTask.create({
      data: {
        instanceId: instance.id,
        stepId: currentStep.id,
        stepName: currentStep.name,
        taskType: currentStep.stepType === "ASSIGNEE_TASK" ? "EXECUTION"
          : currentStep.stepType === "VERIFIER" ? "VERIFICATION" : "APPROVAL",
        module,
        recordId,
        recordNumber,
        recordTitle,
        assignedToId: currentStep.stepType === "ASSIGNEE_TASK" ? actors.assignee : actors.checker,
        assignedAt: new Date(recordDate.getTime() + interval * stepsCompleted),
        dueAt: hoursAfter(new Date(recordDate.getTime() + interval * stepsCompleted), currentStep.slaHours ?? 48),
        status: "PENDING",
        priority: "HIGH",
      },
    });
  }
}

// ── Seed one plant ────────────────────────────────────────────────────────

async function seedPlantPromo(plantCode: "NW" | "SW") {
  const pl = plantCode.toLowerCase();
  const P  = plantCode;

  // Resolve users
  const hse = P === "NW"
    ? await prisma.user.findFirstOrThrow({ where: { email: "hse-manager.it.nw@safeops360.in" } })
    : await prisma.user.findFirstOrThrow({ where: { email: `hse-manager.it.${pl}@safeops360.in` } });
  const [supervisor, worker, safetyOfficer, plantHead] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { email: `supervisor.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `worker.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `safety-officer.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `plant-head.it.${pl}@safeops360.in` } }),
  ]);

  const plant = await prisma.plant.findFirstOrThrow({
    where: { code: P },
    include: { areas: true },
  });
  const processArea = plant.areas.find((a) => a.name.includes("Process Area A")) ?? plant.areas[0];
  const chemArea    = plant.areas.find((a) => a.name.includes("Chemical")) ?? plant.areas[1];

  const nmDate  = daysAgo(P === "NW" ? 18 : 14);
  const incDate = hoursAfter(nmDate, 2); // incident created 2 hours after NM

  const nmNumber  = `NM-${P}-PROMO-001`;
  const incNumber = `INC-${P}-PROMO-001`;

  // NM scenario differs by plant for variety
  const scenario =
    P === "NW"
      ? {
          nmDesc:
            "Chlorine gas detector CL-MONITOR-04 in Process Area A alarmed at 2.8 ppm (action level 1.0 ppm) during a shift change. All personnel evacuated per ERP. Investigation revealed a cracked gland on chlorine dosing pump P-204A — the same pump model as P-204B which failed 3 months ago. Had the crack propagated to full failure, estimated release: 18 kg Cl₂ with a toxic footprint extending beyond the site boundary under prevailing wind conditions. Potential for multiple fatalities.",
          nmActivity: "Chlorine dosing — routine process operation during shift change",
          nmImmediateAction:
            "Plant evacuated to muster point 2. SCBA-equipped response team identified and isolated pump P-204A. Dosing switched to standby pump P-204C. All chlorine dosing pumps (P-204A/B/C) quarantined for gland inspection.",
          nmRootCause: "EQUIPMENT",
          nmRootCauseDetail:
            "Gland material specification for both P-204A and P-204C found to be standard PTFE-40 rather than chlorine-grade PTFE-75. CMMS BOM had incorrect material code — same defect as P-204B incident. Corrective action from P-204B was not propagated to sibling pumps.",
          nmCorrectiveActions:
            "1. All 3 chlorine dosing pumps glands replaced with certified PTFE-75 chlorine-grade material. 2. CMMS BOM corrected for all 3 pumps. 3. Critical service register updated with mandatory approval gate for material substitution on chlorine-wetted components.",
          incType: "PROCESS_SAFETY" as const,
          incDesc:
            "[Promoted from NM-" + P + "-PROMO-001] Chlorine gas release event requiring full plant evacuation. CL-MONITOR-04 alarmed at 2.8 ppm during shift change — three times the action level. Cause identified as cracked chlorine-grade gland on dosing pump P-204A. Gland failure mechanism identical to P-204B failure 3 months prior; corrective actions from that event were not propagated to sibling pumps P-204A and P-204C.",
          incLocation: "Process Area A — chlorine dosing skid, pump P-204A",
          incImmediateCause:
            "Cracked PTFE gland on chlorine dosing pump P-204A. Gland was non-chlorine-grade PTFE-40 (specified as PTFE-75 chlorine-grade in design basis).",
          incRootCause:
            "Corrective action closure process failed to propagate the P-204B gland material fix to the two sibling pump units in the same dosing skid.",
          incCorrectiveActions:
            "1. All chlorine dosing pump glands replaced and verified chlorine-grade. 2. CMMS BOM corrections raised and approved. 3. Incident investigation report submitted to CPCB as per consent conditions.",
          incImmediateCauses: ["Cracked pump gland — wrong material grade in service", "Chlorine release exceeded fixed gas detector action level"],
          incUnderlyingCauses: ["CMMS BOM had incorrect PTFE grade specification for all 3 pumps in the skid", "Previous corrective action for P-204B was closed without verifying sibling pumps"],
          incRootCauses: ["CAPA closure process does not require verification of fix applied to all similar equipment in the same system"],
          incContributing: ["Multiple shifts between pump failures reducing institutional memory", "CMMS material field not validated against approved material register"],
          incAreaId: processArea.id,
        }
      : {
          nmDesc:
            "Electrical arc flash event on MCC-12 415V feeder panel during planned maintenance. Maintenance electrician opened energised panel door despite believing it was isolated. Arc flash with a calculated incident energy of 11 cal/cm² occurred. Electrician was wearing Cat 2 PPE (8 cal/cm² rated) — insufficient for the actual energy level. No burn injury sustained due to distance, but PPE was destroyed. Had the worker been at closer range (e.g., for connection work), fatal injury was likely.",
          nmActivity: "Planned maintenance — MCC-12 feeder panel connection inspection",
          nmImmediateAction:
            "Area isolated at upstream breaker. Electrician medically assessed — no injury. Incident escalated to plant management. All LV panel maintenance work suspended pending review.",
          nmRootCause: "PROCESS",
          nmRootCauseDetail:
            "Panel had been re-energised by a second team at 14:00 after the original isolation at 08:00 was released for an unrelated fault. The maintenance team was not notified. No single-point personal LOTO was in use — only a group lockout scheme that the second team was not aware of.",
          nmCorrectiveActions:
            "1. Personal padlock single-point LOTO mandatory for all LV panel work. 2. Re-energisation of any isolated switchboard requires sign-off from the maintenance supervisor. 3. Arc flash study commissioned for all MCC panels — PPE selection to be updated.",
          incType: "HIPO_NEAR_MISS" as const,
          incDesc:
            "[Promoted from NM-" + P + "-PROMO-001] Electrical arc flash at MCC-12 during planned maintenance. Incident energy calculated at 11 cal/cm²; electrician wore Cat 2 PPE rated for only 8 cal/cm². No injury sustained due to worker distance, but PPE was destroyed. Potential for fatal electrocution or severe burns had the worker been positioned for connection work. Promoted from near-miss to formal incident investigation due to high potential severity.",
          incLocation: "Electrical Substation — MCC-12 incoming feeder, bay A",
          incImmediateCause:
            "Panel re-energised by a separate team while maintenance team's group LOTO was in place but no personal padlock was applied.",
          incRootCause:
            "Group LOTO system does not prevent unauthorised re-energisation when a second team is not aware of the maintenance lock. No mandatory personal padlock requirement enforced.",
          incCorrectiveActions:
            "1. Personal padlock LOTO procedure implemented and mandatory for all electrical maintenance. 2. Arc flash PPE selection revised following updated arc flash study. 3. All LV maintenance crew re-trained.",
          incImmediateCauses: ["Panel re-energised while maintenance team's LOTO was active", "PPE arc rating insufficient for actual incident energy"],
          incUnderlyingCauses: ["Group LOTO scheme allowed re-energisation without notifying all parties", "PPE selection was based on estimated arc energy, not a formal arc flash study"],
          incRootCauses: ["LOTO procedure did not mandate personal padlock for individual maintenance workers — relied solely on group lockout"],
          incContributing: ["Two teams working on related systems without formal coordination", "Arc flash study had not been updated after MCC upgrade 2 years ago"],
          incAreaId: chemArea.id,
        };

  // ── Step 1: Create Near Miss (without promotedIncidentId yet) ──────────
  const nm = await prisma.nearMiss.create({
    data: {
      number: nmNumber,
      reporterId: worker.id,
      date: nmDate,
      plantId: plant.id,
      areaId: scenario.incAreaId,
      description: scenario.nmDesc,
      location: scenario.incLocation,
      specificLocation: scenario.incLocation,
      reporterType: "EMPLOYEE",
      activityIsRoutine: true,
      activity: scenario.nmActivity,
      immediateAction: scenario.nmImmediateAction,
      potentialSeverity: "CRITICAL",
      potentialConsequences: [
        { type: "INJURY", subRating: "FATALITY_POTENTIAL" },
        { type: "PROCESS_SAFETY_EVENT" },
      ],
      riskLikelihood: 4,
      riskConsequence: 5,
      riskScore: 20,
      riskLevel: "CRITICAL",
      initialRootCauseCategory: scenario.nmRootCause,
      controlsThatFailed:
        P === "NW"
          ? "CMMS BOM material specification — wrong PTFE grade remained uncorrected for sibling pumps."
          : "Group LOTO scheme — second team re-energised panel without clearing the maintenance lock.",
      controlsThatWorked:
        P === "NW"
          ? "Fixed gas detectors performed as designed. ERP executed without injury."
          : "Worker was at stand-off distance. Cat 2 PPE prevented burn injury despite being below rated energy.",
      recommendedActions:
        P === "NW"
          ? "Audit all chlorine-wetted pump seals for correct material grade. Add CMMS BOM approval gate for critical service materials. Propagate fix to all sibling units when CAPA is closed."
          : "Implement mandatory personal LOTO padlock for all LV panel maintenance. Commission arc flash study for full MCC fleet. Revise PPE selection matrix.",
      suggestedActionOwnerId: supervisor.id,
      rootCauseCategory: scenario.nmRootCause,
      rootCauseDetail: scenario.nmRootCauseDetail,
      correctiveActions: scenario.nmCorrectiveActions,
      actionOwnerId: hse.id,
      targetDate: daysFromNow(-5),
      status: "CLOSED",
      closedAt: daysAgo(P === "NW" ? 12 : 8),
      multipleWorkersAggravator: true,
      isAnonymous: false,
    },
  });

  // ── Step 2: Create Incident (with sourceNearMissId = nm.id) ──────────
  const inc = await prisma.incident.create({
    data: {
      number: incNumber,
      date: incDate,
      occurredAt: nmDate,
      reportedAt: hoursAfter(nmDate, 1),
      type: scenario.incType,
      plantId: plant.id,
      areaId: scenario.incAreaId,
      location: scenario.incLocation,
      specificLocation: scenario.incLocation,
      reporterId: worker.id,
      description: scenario.incDesc,
      immediateCause: scenario.incImmediateCause,
      rootCauseMethod: "Fishbone",
      rootCauseDetail: scenario.incRootCause,
      rootCauseSummary: scenario.incRootCause,
      rootCauseData: {
        problemStatement: scenario.incDesc.slice(0, 100),
        categories: {
          manpower: ["Maintenance team not notified of re-energisation", "Training gap on LOTO verification"],
          machine: ["CMMS BOM material specification error", "Equipment not verified before work"],
          method: ["CAPA closure without sibling equipment check", "Personal LOTO not mandated"],
          material: [],
          measurement: ["Gas / arc energy monitoring did not prevent incident"],
          environment: ["Simultaneous operations by two teams without coordination"],
        },
        rootCauses: scenario.incRootCauses,
      },
      correctiveActions: scenario.incCorrectiveActions,
      preventiveActions:
        "Include sibling-equipment verification in CAPA closure checklist. Integrate simultaneous operations risk into all maintenance planning. Schedule arc flash / toxic release consequence modelling for top-tier hazards.",
      immediateCauses: scenario.incImmediateCauses,
      underlyingCauses: scenario.incUnderlyingCauses,
      rootCauses: scenario.incRootCauses,
      contributingFactors: scenario.incContributing,
      severity: "CRITICAL",
      isReportable: true,
      reportableUnder: P === "NW" ? ["FACTORIES_ACT", "CPCB"] : ["FACTORIES_ACT", "DGFASLI"],
      status: "INVESTIGATION",
      lostDays: 0,
      costTotal: P === "NW" ? 250000 : 180000,
      costPropertyDamage: P === "NW" ? 0 : 80000,
      costLegalRegulatory: P === "NW" ? 50000 : 25000,
      costOther: P === "NW" ? 200000 : 75000,
      internalNotificationsSent: [
        { userId: hse.id, name: hse.name, notifiedAt: hoursAfter(nmDate, 0.5).toISOString(), method: "phone" },
        { userId: plantHead.id, name: plantHead.name, notifiedAt: hoursAfter(nmDate, 0.5).toISOString(), method: "sms" },
        { userId: safetyOfficer.id, name: safetyOfficer.name, notifiedAt: hoursAfter(nmDate, 1).toISOString(), method: "email" },
      ],
      form18Submitted: false,
      dgfasliSubmitted: false,
      cpcbSubmitted: false,
      // ← bidirectional link: this incident was auto-promoted from the near miss
      sourceNearMissId: nm.id,
    },
  });

  // ── Step 3: Back-link — set NearMiss.promotedIncidentId + flag ───────
  await prisma.nearMiss.update({
    where: { id: nm.id },
    data: { promotedIncidentId: inc.id, promotedToIncident: true },
  });

  // ── Step 4: Workflow trail — Near Miss (fully closed, all steps done) ─
  const nmDef = await loadDef("NEAR_MISS");
  await createTrail({
    module: "NEAR_MISS",
    recordId: nm.id,
    recordNumber: nmNumber,
    recordTitle: scenario.nmDesc.slice(0, 80),
    recordDate: nmDate,
    stepsCompleted: nmDef.steps.length, // fully closed
    def: nmDef,
    actors: { initiator: worker.id, checker: hse.id, assignee: supervisor.id, closer: hse.id },
  });

  // ── Step 5: Workflow trail — Incident (step 1+2 done, investigation in progress)
  const incDef = await loadDef("INCIDENT");
  await createTrail({
    module: "INCIDENT",
    recordId: inc.id,
    recordNumber: incNumber,
    recordTitle: scenario.incDesc.slice(0, 80),
    recordDate: incDate,
    stepsCompleted: 2, // reported + classified; now at investigation step (step 3)
    def: incDef,
    actors: { initiator: worker.id, checker: hse.id, assignee: hse.id, closer: hse.id },
  });

  console.log(`   ✓ ${P}: ${nmNumber} → ${incNumber}  (CRITICAL → promoted to PROCESS_SAFETY investigation)`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  SafeOps360 — Promoted Near Miss → Incident Pairs   ║");
  console.log("║  1 pair per plant (NW + SW)                         ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // Idempotent cleanup
  console.log("   🧹 Cleaning existing PROMO- records…");
  const existingInc = await prisma.incident.findMany({
    where: { number: { contains: "-PROMO-" } },
    select: { id: true },
  });
  const existingNm = await prisma.nearMiss.findMany({
    where: { number: { contains: "-PROMO-" } },
    select: { id: true },
  });

  // Remove workflow instances first (cascade clears history + tasks)
  for (const rec of [...existingInc, ...existingNm]) {
    await prisma.workflowInstance.deleteMany({ where: { recordId: rec.id } });
  }
  // Clear bidirectional links before deleting
  await prisma.nearMiss.updateMany({
    where: { number: { contains: "-PROMO-" } },
    data: { promotedIncidentId: null },
  });
  await prisma.incident.deleteMany({ where: { number: { contains: "-PROMO-" } } });
  await prisma.nearMiss.deleteMany({ where: { number: { contains: "-PROMO-" } } });

  console.log("   Cleanup done.\n");

  await seedPlantPromo("NW");
  await seedPlantPromo("SW");

  console.log("\n✅  Promoted Near Miss seed complete.\n");
}

main()
  .catch((e) => { console.error("❌  Seed failed:", e?.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
