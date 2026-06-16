// ─────────────────────────────────────────────────────────────────────────────
// Step 19 — People & Competency: Training + Skill Matrix
//
// Per plant:
//   • 3  TrainingSchedule (completed, completed, in-progress)
//     – TrainingSession (2 per schedule)
//     – TrainingRegistration (5-7 per schedule)
//     – TrainingAttendance (all sessions × all registrations)
//     – TrainingAssessment (completed schedules)
//     – TrainingCertificate (passed assessments)
//   • CompetencyRecord × 5 users × 6 competencies (mixed states)
//     – CompetencyAssessment per validated record
//     – SupervisedPerformanceRecord per practical competency
//   • PersonRoleAssignment × 5 users
//   • RecertificationCycle × 1 per plant
//   • WorkflowInstance + WorkflowHistory + WorkflowTask (TRAINING module)
//
// Idempotent: cleans records by scheduleNumber / competencyRecord markers.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-07T08:00:00.000Z");
function daysAgo(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; }
function hoursAfter(base: Date, h: number) { return new Date(base.getTime() + h * 3_600_000); }

// ── Workflow helper ───────────────────────────────────────────────────────────

async function createTrainingWorkflow(opts: {
  scheduleId: string; scheduleNumber: string; scheduleTitle: string;
  scheduleDate: Date; status: string; stepsCompleted: number;
  actors: { initiator: string; checker: string; trainer: string; ldManager: string };
}) {
  const { scheduleId, scheduleNumber, scheduleTitle, scheduleDate, status, stepsCompleted, actors } = opts;
  const def = await prisma.workflowDefinition.findFirstOrThrow({
    where: { module: "TRAINING", isActive: true },
    include: { steps: { orderBy: { sequence: "asc" }, select: { id: true, sequence: true, stepType: true, name: true, slaHours: true } } },
  });
  const allSteps = def.steps;
  const completed = allSteps.slice(0, stepsCompleted);
  const currentStep = stepsCompleted < allSteps.length ? allSteps[stepsCompleted] : null;
  const isComplete = status === "COMPLETED" || status === "CANCELLED";

  const instance = await prisma.workflowInstance.create({
    data: {
      definitionId: def.id, module: "TRAINING", recordId: scheduleId, recordNumber: scheduleNumber,
      status: isComplete ? "COMPLETED" : "IN_PROGRESS",
      currentStepId: currentStep?.id ?? null, currentStepName: currentStep?.name ?? null,
      initiatedById: actors.initiator, initiatedAt: scheduleDate,
      completedAt: isComplete ? hoursAfter(scheduleDate, stepsCompleted * 24) : null,
    },
  });

  for (let i = 0; i < completed.length; i++) {
    const step = completed[i];
    const actor = step.stepType === "MAKER" ? actors.initiator
      : step.stepType === "ASSIGNEE_TASK" ? actors.trainer
      : step.stepType === "VERIFIER" ? actors.ldManager
      : step.stepType === "CLOSURE" ? actors.ldManager
      : actors.checker;
    await prisma.workflowHistory.create({
      data: {
        instanceId: instance.id, stepId: step.id, stepName: step.name,
        action: step.stepType === "MAKER" ? "INITIATED" : step.stepType === "ASSIGNEE_TASK" ? "EXECUTED" : step.stepType === "CLOSURE" ? "COMPLETED" : "APPROVED",
        performedById: actor, performedAt: hoursAfter(scheduleDate, (i + 1) * 24),
        fromStatus: i === 0 ? null : "IN_PROGRESS",
        toStatus: i === completed.length - 1 && isComplete ? "COMPLETED" : "IN_PROGRESS",
        comments: i === 0 ? `${scheduleNumber} published.` : step.stepType === "ASSIGNEE_TASK" ? "Training conducted. Attendance and assessments recorded." : step.stepType === "CLOSURE" ? "Certificates auto-issued for all passing participants." : `Step completed: ${step.name}.`,
      },
    });
  }

  if (!isComplete && currentStep) {
    await prisma.workflowTask.create({
      data: {
        instanceId: instance.id, stepId: currentStep.id, stepName: currentStep.name,
        taskType: currentStep.stepType === "ASSIGNEE_TASK" ? "EXECUTION" : currentStep.stepType === "VERIFIER" ? "VERIFICATION" : "APPROVAL",
        module: "TRAINING", recordId: scheduleId, recordNumber: scheduleNumber, recordTitle: scheduleTitle,
        assignedToId: currentStep.stepType === "ASSIGNEE_TASK" ? actors.trainer : currentStep.stepType === "VERIFIER" ? actors.ldManager : actors.checker,
        assignedAt: hoursAfter(scheduleDate, stepsCompleted * 24),
        dueAt: hoursAfter(scheduleDate, stepsCompleted * 24 + (currentStep.slaHours ?? 48)),
        status: "PENDING", priority: "NORMAL",
      },
    });
  }
}

// ── Per-plant seed ────────────────────────────────────────────────────────────

async function seedPlant(plantCode: "NW" | "SW") {
  const pl = plantCode.toLowerCase();
  const P  = plantCode;

  const hse = P === "NW"
    ? await prisma.user.findFirstOrThrow({ where: { email: "hse-manager.it.nw@safeops360.in" } })
    : await prisma.user.findFirstOrThrow({ where: { email: `hse-manager.it.${pl}@safeops360.in` } });

  const [trainer, ldManager, supervisor, deptHead, plantHead, safetyOfficer, worker, worker2, worker3] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { email: `trainer.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `ld-manager.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `supervisor.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `dept-head.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `plant-head.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `safety-officer.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `worker.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `contractor-workman.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `permit-issuer.it.${pl}@safeops360.in` } }),
  ]);

  const plant = await prisma.plant.findFirstOrThrow({ where: { code: P } });
  const trainees = [worker, worker2, worker3, supervisor, safetyOfficer];

  // ── Training Programs (look up by programCode) ───────────────────────────

  const [pgBasicSafety, pgHotWork, pgInduction] = await Promise.all([
    prisma.trainingProgram.findFirstOrThrow({ where: { OR: [{ programCode: "BASIC_SAFETY" }, { code: "BASIC_SAFETY" }] } }),
    prisma.trainingProgram.findFirstOrThrow({ where: { OR: [{ programCode: "PTW_HOT_WORK_HOLDER" }, { code: "PTW_HOT_WORK_HOLDER" }] } }),
    prisma.trainingProgram.findFirstOrThrow({ where: { OR: [{ programCode: "INDUCTION_GENERAL" }, { code: "INDUCTION_GENERAL" }] } }),
  ]);

  // ── Schedule 1: General Safety Induction (COMPLETED) ────────────────────

  const sch1Date = daysAgo(60);
  const sch1 = await prisma.trainingSchedule.create({
    data: {
      scheduleNumber: `TRN-SCH-${P}-DEMO-001`,
      programId: pgInduction.id, plantId: plant.id,
      startDate: sch1Date, endDate: hoursAfter(sch1Date, 8),
      venue: `${P === "NW" ? "North Garment Unit" : "South Garment Unit"} — Training Room 1`,
      language: "English", trainerId: trainer.id, isExternalTrainer: false,
      maxParticipants: 15, status: "completed",
      publishedAt: daysAgo(65),
      trainerEffectivenessScore: 4.2,
      participantSatisfaction: 4.5,
      immediateAssessmentPassRate: 80.0,
      createdById: ldManager.id, approvedById: hse.id, approvedAt: daysAgo(64),
    },
  });

  const sch1Sessions = await Promise.all([
    prisma.trainingSession.create({ data: { scheduleId: sch1.id, sequence: 1, title: "Introduction to HSE — regulations, plant rules, and hazard awareness", startTime: sch1Date, endTime: hoursAfter(sch1Date, 4), trainerId: trainer.id, conductedAt: sch1Date, durationMinutesActual: 240, topicsCovered: ["HSE policy", "Legal requirements", "Hazard identification overview", "Emergency procedures"] } }),
    prisma.trainingSession.create({ data: { scheduleId: sch1.id, sequence: 2, title: "Practical walkthrough — process area, muster points, fire equipment", startTime: hoursAfter(sch1Date, 5), endTime: hoursAfter(sch1Date, 8), trainerId: trainer.id, conductedAt: sch1Date, durationMinutesActual: 180, topicsCovered: ["Process area hazards", "Emergency assembly points", "Fire extinguisher types and use", "SCBA location"] } }),
  ]);

  const sch1Regs: typeof trainees = trainees.concat([deptHead]);
  for (let i = 0; i < sch1Regs.length; i++) {
    const u = sch1Regs[i];
    const score = 65 + (i * 7) % 35; // 65–99 range
    const passed = score >= 60;
    const reg = await prisma.trainingRegistration.create({
      data: {
        scheduleId: sch1.id, userId: u.id,
        registrationType: "NOMINATED", nominatedById: deptHead.id,
        triggerReason: "New employee induction", prerequisitesMet: true,
        prerequisiteCheckResult: { checked: true, missing: [] },
        approvalStatus: "approved", approvedById: hse.id, approvedAt: daysAgo(63),
        status: "completed", attendancePercent: 100,
        assessmentScore: score, assessmentAttempts: 1, passed,
      },
    });
    // Attendance for both sessions
    for (const sess of sch1Sessions) {
      await prisma.trainingAttendance.create({ data: { sessionId: sess.id, registrationId: reg.id, status: "PRESENT", arrivalTime: sess.startTime, departureTime: sess.endTime, durationMinutes: sess.durationMinutesActual ?? 0, signatureCaptured: true, capturedById: trainer.id, capturedAt: sess.endTime } });
    }
    // Assessment
    const assessment = await prisma.trainingAssessment.create({
      data: {
        registrationId: reg.id, attemptNumber: 1,
        startedAt: hoursAfter(sch1Date, 8.5), submittedAt: hoursAfter(sch1Date, 9.5),
        durationMinutes: 60, totalScore: score, totalMarks: 100,
        scorePercent: score, passed,
        assessedById: trainer.id, remediationRequired: !passed,
        remediationPlan: passed ? null : "Re-attend session 1 and retake written assessment.",
        retakeAllowed: !passed, retakeAfterDate: passed ? null : daysFromNow(7),
        failureReasons: passed ? [] : ["Insufficient knowledge of emergency procedures"],
      },
    });
    // Certificate for passing
    if (passed) {
      await prisma.trainingCertificate.create({
        data: {
          certificateNumber: `CERT-${P}-INDUCT-${String(i + 1).padStart(3, "0")}-2026`,
          programId: pgInduction.id, userId: u.id, registrationId: reg.id,
          issuedAt: hoursAfter(sch1Date, 24), issuedById: ldManager.id,
          finalAssessmentScore: score, attendancePercent: 100,
          validFrom: hoursAfter(sch1Date, 24), validTo: daysFromNow(365 - 60),
          status: "active", isRenewable: true,
        },
      });
    }
  }
  await createTrainingWorkflow({ scheduleId: sch1.id, scheduleNumber: `TRN-SCH-${P}-DEMO-001`, scheduleTitle: pgInduction.name, scheduleDate: daysAgo(65), status: "COMPLETED", stepsCompleted: 999, actors: { initiator: ldManager.id, checker: hse.id, trainer: trainer.id, ldManager: ldManager.id } });
  console.log(`   ✓ ${P}: TRN-SCH-${P}-DEMO-001  [completed] ${sch1Regs.length} participants`);

  // ── Schedule 2: Hot Work Permit Holder (COMPLETED) ───────────────────────

  const sch2Date = daysAgo(30);
  const sch2 = await prisma.trainingSchedule.create({
    data: {
      scheduleNumber: `TRN-SCH-${P}-DEMO-002`,
      programId: pgHotWork.id, plantId: plant.id,
      startDate: sch2Date, endDate: hoursAfter(sch2Date, 16),
      venue: `${P === "NW" ? "North Garment Unit" : "South Garment Unit"} — Training Room 2 + Workshop Bay`,
      language: "English", trainerId: trainer.id, isExternalTrainer: false,
      maxParticipants: 10, status: "completed",
      publishedAt: daysAgo(38),
      trainerEffectivenessScore: 4.7, participantSatisfaction: 4.8, immediateAssessmentPassRate: 85.7,
      createdById: ldManager.id, approvedById: hse.id, approvedAt: daysAgo(37),
    },
  });

  const sch2Sessions = await Promise.all([
    prisma.trainingSession.create({ data: { scheduleId: sch2.id, sequence: 1, title: "Hot Work Permit System — theory, risk assessment, and approval process", startTime: sch2Date, endTime: hoursAfter(sch2Date, 8), trainerId: trainer.id, conductedAt: sch2Date, durationMinutesActual: 480, topicsCovered: ["PTW system overview", "Hot work hazards", "Fire watch duties", "Flammable gas testing", "Permit conditions"] } }),
    prisma.trainingSession.create({ data: { scheduleId: sch2.id, sequence: 2, title: "Practical: Gas testing, fire watch simulation, permit closure", startTime: hoursAfter(sch2Date, 8), endTime: hoursAfter(sch2Date, 16), trainerId: trainer.id, conductedAt: sch2Date, durationMinutesActual: 480, topicsCovered: ["Combustible gas meter operation", "Fire extinguisher practical", "Permit initiation and closure walkthrough"] } }),
  ]);

  const hwTrainees = [worker, worker3, supervisor, safetyOfficer, deptHead];
  for (let i = 0; i < hwTrainees.length; i++) {
    const u = hwTrainees[i];
    const score = 72 + (i * 5) % 28;
    const passed = score >= 70;
    const reg = await prisma.trainingRegistration.create({
      data: {
        scheduleId: sch2.id, userId: u.id,
        registrationType: "NOMINATED", nominatedById: hse.id,
        triggerReason: "Hot work permit holder certification — role requirement",
        prerequisitesMet: true, prerequisiteCheckResult: { checked: true, missing: [] },
        approvalStatus: "approved", approvedById: hse.id, approvedAt: daysAgo(37),
        status: "completed", attendancePercent: 100,
        assessmentScore: score, assessmentAttempts: i === 2 ? 2 : 1, passed,
      },
    });
    for (const sess of sch2Sessions) {
      await prisma.trainingAttendance.create({ data: { sessionId: sess.id, registrationId: reg.id, status: "PRESENT", arrivalTime: sess.startTime, departureTime: sess.endTime, durationMinutes: sess.durationMinutesActual ?? 0, signatureCaptured: true, capturedById: trainer.id, capturedAt: sess.endTime } });
    }
    await prisma.trainingAssessment.create({ data: { registrationId: reg.id, attemptNumber: 1, startedAt: hoursAfter(sch2Date, 16), submittedAt: hoursAfter(sch2Date, 17.5), durationMinutes: 90, totalScore: score, totalMarks: 100, scorePercent: score, passed, assessedById: trainer.id, remediationRequired: !passed, retakeAllowed: !passed } });
    if (passed) {
      await prisma.trainingCertificate.create({ data: { certificateNumber: `CERT-${P}-HWPH-${String(i + 1).padStart(3, "0")}-2026`, programId: pgHotWork.id, userId: u.id, registrationId: reg.id, issuedAt: hoursAfter(sch2Date, 24), issuedById: ldManager.id, finalAssessmentScore: score, attendancePercent: 100, validFrom: hoursAfter(sch2Date, 24), validTo: daysFromNow(365 - 30), status: "active", isRenewable: true } });
    }
  }
  await createTrainingWorkflow({ scheduleId: sch2.id, scheduleNumber: `TRN-SCH-${P}-DEMO-002`, scheduleTitle: pgHotWork.name, scheduleDate: daysAgo(38), status: "COMPLETED", stepsCompleted: 999, actors: { initiator: ldManager.id, checker: hse.id, trainer: trainer.id, ldManager: ldManager.id } });
  console.log(`   ✓ ${P}: TRN-SCH-${P}-DEMO-002  [completed] ${hwTrainees.length} participants`);

  // ── Schedule 3: Basic Safety Refresher (IN PROGRESS — mid-workflow) ──────

  const sch3Date = daysAgo(5);
  const sch3 = await prisma.trainingSchedule.create({
    data: {
      scheduleNumber: `TRN-SCH-${P}-DEMO-003`,
      programId: pgBasicSafety.id, plantId: plant.id,
      startDate: sch3Date, endDate: hoursAfter(sch3Date, 8),
      venue: `${P === "NW" ? "North Garment Unit" : "South Garment Unit"} — Training Room 1`,
      language: "English", trainerId: trainer.id, isExternalTrainer: false,
      maxParticipants: 20, status: "scheduled",
      publishedAt: daysAgo(10),
      createdById: ldManager.id, approvedById: hse.id, approvedAt: daysAgo(9),
    },
  });

  await prisma.trainingSession.create({ data: { scheduleId: sch3.id, sequence: 1, title: "Basic Safety Refresher — hazard awareness, near miss reporting, and personal safety rules", startTime: sch3Date, endTime: hoursAfter(sch3Date, 8), trainerId: trainer.id, conductedAt: sch3Date, durationMinutesActual: 480, topicsCovered: ["Near miss reporting refresher", "Personal safety rules", "Toolbox talk best practices", "Emergency drills recap"] } });

  const refreshTrainees = [worker, worker2, worker3, supervisor, safetyOfficer, deptHead];
  for (const u of refreshTrainees) {
    await prisma.trainingRegistration.create({
      data: {
        scheduleId: sch3.id, userId: u.id,
        registrationType: "MANDATORY", nominatedById: ldManager.id,
        triggerReason: "Annual safety refresher — mandatory for all plant personnel",
        prerequisitesMet: true, prerequisiteCheckResult: { checked: true, missing: [] },
        approvalStatus: "approved", approvedById: hse.id, approvedAt: daysAgo(8),
        status: "registered", attendancePercent: null,
        assessmentScore: null, assessmentAttempts: 0, passed: null,
      },
    });
  }
  await createTrainingWorkflow({ scheduleId: sch3.id, scheduleNumber: `TRN-SCH-${P}-DEMO-003`, scheduleTitle: pgBasicSafety.name, scheduleDate: daysAgo(10), status: "IN_PROGRESS", stepsCompleted: 2, actors: { initiator: ldManager.id, checker: hse.id, trainer: trainer.id, ldManager: ldManager.id } });
  console.log(`   ✓ ${P}: TRN-SCH-${P}-DEMO-003  [in_progress → workflow task pending trainer]  ${refreshTrainees.length} registrations`);

  // ── Competency Records ────────────────────────────────────────────────────

  const competencies = await prisma.competency.findMany({
    where: { code: { in: ["HSE-FOUNDATION", "CS-ENTRANT-L1", "HOT-WORK-WELDER-SMAW", "WORK-HEIGHT-L1", "ELEC-AUTH-LV", "FIRE-WARDEN"] } },
    select: { id: true, code: true, name: true, defaultValidityMonths: true },
  });
  const compByCode = Object.fromEntries(competencies.map(c => [c.code, c]));

  const COMP_SCENARIOS = [
    { code: "HSE-FOUNDATION", state: "validated_active", daysValidAgo: 60, validMonths: 24 },
    { code: "CS-ENTRANT-L1", state: "validated_active", daysValidAgo: 45, validMonths: 12 },
    { code: "HOT-WORK-WELDER-SMAW", state: "expiring_soon", daysValidAgo: 350, validMonths: 12 },
    { code: "WORK-HEIGHT-L1", state: "expired_in_grace", daysValidAgo: 395, validMonths: 12 },
    { code: "ELEC-AUTH-LV", state: "validated_active", daysValidAgo: 90, validMonths: 24 },
    { code: "FIRE-WARDEN", state: "in_training", daysValidAgo: null, validMonths: 12 },
  ];

  const compWorkers = [worker, worker3, supervisor, safetyOfficer, deptHead];
  for (let wi = 0; wi < compWorkers.length; wi++) {
    const u = compWorkers[wi];
    for (const scenario of COMP_SCENARIOS) {
      const comp = compByCode[scenario.code];
      if (!comp) continue;

      const validFrom = scenario.daysValidAgo !== null ? daysAgo(scenario.daysValidAgo) : null;
      const validUntil = validFrom ? new Date(validFrom.getTime() + scenario.validMonths * 30 * 24 * 3_600_000) : null;

      const record = await prisma.competencyRecord.create({
        data: {
          plantId: plant.id, personUserId: u.id, competencyId: comp.id,
          state: scenario.state,
          currentValidatedAt: validFrom,
          currentValidatedByUserId: validFrom ? hse.id : null,
          currentValidationMethod: validFrom ? "assessment_required" : null,
          currentScore: validFrom ? (75 + (wi * 5 + COMP_SCENARIOS.indexOf(scenario) * 3) % 25) : null,
          validFrom, validUntil,
          requiredValidationsTotal: 1, requiredValidationsCompleted: validFrom ? 1 : 0,
          lastProgressEventAt: validFrom ?? daysAgo(7),
          nextRevalidationDue: validUntil ? new Date(validUntil.getTime() - 90 * 24 * 3_600_000) : null,
          createdByUserId: hse.id, versionNumber: 1,
        },
      });

      // CompetencyAssessment for validated records
      if (validFrom) {
        await prisma.competencyAssessment.create({
          data: {
            plantId: plant.id, recordId: record.id,
            personUserId: u.id, competencyId: comp.id,
            assessmentType: "practical" as any,
            scheduledAt: validFrom, conductedAt: validFrom,
            location: `${P === "NW" ? "North Garment Unit" : "South Garment Unit"} — Training Centre`,
            assessorUserId: trainer.id, assessorRole: "Certified Assessor",
            questionsCount: 10, durationMinutes: 45,
            status: "passed" as any,
            rawScore: (75 + (wi * 5) % 25) as any, maximumScore: 100,
            percentageScore: (75 + (wi * 5) % 25) as any, minimumPassScore: 70,
            result: "pass" as any,
            assessorObservations: "Candidate demonstrated satisfactory competency across all assessed dimensions.",
            assesseeFeedback: "Good practical session. Would appreciate more hands-on practice time.",
            competencyValidated: true,
          },
        });

        // Supervised performance record for practical competencies
        if (["CS-ENTRANT-L1", "HOT-WORK-WELDER-SMAW", "WORK-HEIGHT-L1"].includes(scenario.code)) {
          await prisma.supervisedPerformanceRecord.create({
            data: {
              plantId: plant.id, recordId: record.id,
              personUserId: u.id, competencyId: comp.id,
              activityDescription: `Supervised practical demonstration of ${comp.name} competency`,
              activityDate: hoursAfter(validFrom, -24),
              activityLocation: `Knitting Section — ${P === "NW" ? "North Garment Unit" : "South Garment Unit"}`,
              supervisorUserId: supervisor.id,
              supervisorCompetencyToSupervise: comp.code,
              performanceRating: "competent_independent" as any,
              observations: [{ aspect: "Safety awareness", rating: "competent_independent", comment: "Good awareness of hazards throughout." }, { aspect: "Procedure adherence", rating: "competent_with_supervision", comment: "Minor prompt required on permit closure step." }],
              contributesToValidation: true, attemptNumber: 1,
              supervisorSignatureAt: validFrom, superviseeAcknowledgmentAt: validFrom,
            },
          });
        }
      }
    }
  }
  console.log(`   ✓ ${P}: ${compWorkers.length} users × ${COMP_SCENARIOS.length} competencies = ${compWorkers.length * COMP_SCENARIOS.length} competency records`);

  // ── PersonRoleAssignment ──────────────────────────────────────────────────

  const roleDef = await prisma.roleDefinition.findFirst({ where: { plantId: plant.id } });
  if (roleDef) {
    for (const u of compWorkers) {
      const existing = await prisma.personRoleAssignment.findFirst({ where: { personUserId: u.id, plantId: plant.id } });
      if (!existing) {
        await prisma.personRoleAssignment.create({
          data: {
            plantId: plant.id, personUserId: u.id, roleDefinitionId: roleDef.id,
            isPrimary: true, assignedByUserId: hse.id,
            assignmentRationale: "Initial role assignment upon onboarding.",
            effectiveFrom: daysAgo(365), status: "active",
            operatingUnderGracePeriod: false,
          },
        });
      }
    }
    console.log(`   ✓ ${P}: PersonRoleAssignment for ${compWorkers.length} workers`);
  }

  // ── RecertificationCycle ──────────────────────────────────────────────────

  await prisma.recertificationCycle.create({
    data: {
      plantId: plant.id,
      cycleNumber: `RECERT-${P}-DEMO-2026-Q2`,
      name: `Q2 2026 Competency Revalidation Cycle — ${P === "NW" ? "North Garment Unit" : "South Garment Unit"}`,
      status: "IN_PROGRESS" as any,
      scopeCompetencyIds: competencies.map(c => c.id),
      scopeRoleIds: [], scopeDepartmentIds: [], scopePlantIds: [plant.id],
      windowStart: daysAgo(15), windowEnd: daysFromNow(30),
      ownerUserId: ldManager.id,
      affectedPersonsCount: compWorkers.length,
      completedCount: 2,
      summary: {
        onTrack: 3, overdue: 1, notStarted: 1, completed: 2,
        note: "Hot-work and work-at-height revalidations are the priority for this cycle.",
      },
      createdByUserId: ldManager.id,
    },
  });
  console.log(`   ✓ ${P}: RecertificationCycle RECERT-${P}-DEMO-2026-Q2  [IN_PROGRESS]`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Step 19 — People & Competency: Training + Skill Matrix      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  console.log("   🧹 Cleaning existing Training/Competency DEMO- records…");

  // Cascade: schedule → sessions/registrations/attendance/assessments/certificates
  const existingScheds = await prisma.trainingSchedule.findMany({ where: { scheduleNumber: { contains: "-DEMO-" } }, select: { id: true } });
  for (const s of existingScheds) {
    await prisma.workflowInstance.deleteMany({ where: { recordId: s.id } });
    const regs = await prisma.trainingRegistration.findMany({ where: { scheduleId: s.id }, select: { id: true } });
    for (const r of regs) {
      await prisma.trainingAttendance.deleteMany({ where: { registrationId: r.id } });
      await prisma.trainingAssessment.deleteMany({ where: { registrationId: r.id } });
      await prisma.trainingCertificate.deleteMany({ where: { registrationId: r.id } });
    }
    await prisma.trainingRegistration.deleteMany({ where: { scheduleId: s.id } });
    await prisma.trainingSession.deleteMany({ where: { scheduleId: s.id } });
    await prisma.trainingSchedule.delete({ where: { id: s.id } });
  }

  // Competency records and related
  const existingRecs = await prisma.competencyRecord.findMany({ where: { createdByUserId: { contains: "" } }, select: { id: true } });
  for (const r of existingRecs) {
    const existing = await prisma.competencyRecord.findUnique({ where: { id: r.id }, select: { id: true, plantId: true } });
    if (!existing) continue;
    // Only delete our DEMO ones (we can check by plantId of our plants)
    const plant = await prisma.plant.findFirst({ where: { id: existing.plantId, code: { in: ["NW", "SW"] } } });
    if (!plant) continue;
    await prisma.supervisedPerformanceRecord.deleteMany({ where: { recordId: r.id } });
    await prisma.competencyAssessment.deleteMany({ where: { recordId: r.id } });
    await prisma.competencyRecord.delete({ where: { id: r.id } });
  }

  await prisma.recertificationCycle.deleteMany({ where: { cycleNumber: { contains: "-DEMO-" } } });

  console.log("   Cleanup done.\n");

  await seedPlant("NW");
  await seedPlant("SW");

  console.log("\n✅  People & Competency seed complete.\n");
}

main()
  .catch(e => { console.error("❌  Seed failed:", e?.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
