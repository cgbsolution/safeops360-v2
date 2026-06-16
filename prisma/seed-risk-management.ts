// ─────────────────────────────────────────────────────────────────────────────
// Step 17 — Risk Management: HIRA Studies (5 per plant, NW + SW)
//
// Each study is fully populated:
//   • HiraStudy (number, scope, team, workflow metadata)
//   • HiraStudyTeamMember (5 members per study)
//   • HiraStudyAttachment (1 per study)
//   • HiraEntry (5-8 per study, every field)
//   • HiraEntryHazard (2-3 per entry, linked to real HiraHazard codes)
//   • HiraEntryControl (3-4 per entry, linked to real HiraControl codes)
//   • HiraEntryRecommendedControl (1-2 per entry)
//   • HiraEntryRegulationRef (1 per entry)
//   • HiraReviewCycle (ACTIVE studies only)
//   • WorkflowInstance + WorkflowHistory + WorkflowTask
//
// Idempotent: deletes records with number containing "-DEMO-" before recreating.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-07T08:00:00.000Z");
function daysAgo(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; }
function hoursAfter(base: Date, h: number) { return new Date(base.getTime() + h * 3_600_000); }

// ── Master data lookup ────────────────────────────────────────────────────────

async function loadMasters() {
  const matrix = await prisma.riskMatrix.findFirstOrThrow({ where: { code: "STD_5X5" }, include: { likelihoods: true, severities: true } });
  const hazardsByCode = Object.fromEntries(
    (await prisma.hiraHazard.findMany({ select: { id: true, code: true, name: true } })).map(h => [h.code, h])
  );
  const controlsByCode = Object.fromEntries(
    (await prisma.hiraControl.findMany({ select: { id: true, code: true, hierarchy: true } })).map(c => [c.code, c])
  );
  const likelihoodByScore = Object.fromEntries(matrix.likelihoods.map(l => [l.score, l]));
  const severityByScore   = Object.fromEntries(matrix.severities.map(s => [s.score, s]));
  return { matrix, hazardsByCode, controlsByCode, likelihoodByScore, severityByScore };
}

// ── Workflow helper ───────────────────────────────────────────────────────────

async function createHiraWorkflow(opts: {
  studyId: string; studyNumber: string; studyTitle: string; studyDate: Date;
  status: string; stepsCompleted: number;
  actors: { initiator: string; teamLead: string; plantHead: string; hseManager: string };
}) {
  const { studyId, studyNumber, studyTitle, studyDate, status, stepsCompleted, actors } = opts;
  const def = await prisma.workflowDefinition.findFirstOrThrow({
    where: { module: "HIRA_STUDY", isActive: true },
    include: { steps: { orderBy: { sequence: "asc" }, select: { id: true, sequence: true, stepType: true, name: true, slaHours: true } } },
  });
  const allSteps = def.steps;
  const completedSteps = allSteps.slice(0, stepsCompleted);
  const currentStep = stepsCompleted < allSteps.length ? allSteps[stepsCompleted] : null;
  const isComplete = status === "ACTIVE" || status === "APPROVED";

  const instance = await prisma.workflowInstance.create({
    data: {
      definitionId: def.id, module: "HIRA_STUDY", recordId: studyId, recordNumber: studyNumber,
      status: isComplete ? "COMPLETED" : "IN_PROGRESS",
      currentStepId: currentStep?.id ?? null, currentStepName: currentStep?.name ?? null,
      initiatedById: actors.initiator, initiatedAt: studyDate,
      completedAt: isComplete ? hoursAfter(studyDate, stepsCompleted * 48) : null,
    },
  });

  for (let i = 0; i < completedSteps.length; i++) {
    const step = completedSteps[i];
    const actor = step.stepType === "MAKER" ? actors.initiator
      : step.stepType === "ASSIGNEE_TASK" ? actors.teamLead
      : step.stepType === "VERIFIER" ? actors.hseManager
      : step.stepType === "CLOSURE" ? actors.hseManager
      : actors.plantHead;
    await prisma.workflowHistory.create({
      data: {
        instanceId: instance.id, stepId: step.id, stepName: step.name,
        action: step.stepType === "MAKER" ? "INITIATED" : step.stepType === "ASSIGNEE_TASK" ? "EXECUTED" : step.stepType === "CLOSURE" ? "COMPLETED" : "APPROVED",
        performedById: actor, performedAt: hoursAfter(studyDate, (i + 1) * 48),
        fromStatus: i === 0 ? null : "IN_PROGRESS",
        toStatus: i === completedSteps.length - 1 && isComplete ? "COMPLETED" : "IN_PROGRESS",
        comments: i === 0 ? `${studyNumber} initiated.` : i === completedSteps.length - 1 && isComplete ? "Study activated — entries are live." : `Step completed: ${step.name}.`,
      },
    });
  }

  if (!isComplete && currentStep) {
    await prisma.workflowTask.create({
      data: {
        instanceId: instance.id, stepId: currentStep.id, stepName: currentStep.name,
        taskType: currentStep.stepType === "ASSIGNEE_TASK" ? "EXECUTION" : currentStep.stepType === "VERIFIER" ? "VERIFICATION" : "APPROVAL",
        module: "HIRA_STUDY", recordId: studyId, recordNumber: studyNumber, recordTitle: studyTitle,
        assignedToId: currentStep.stepType === "ASSIGNEE_TASK" ? actors.teamLead : currentStep.stepType === "VERIFIER" ? actors.hseManager : actors.plantHead,
        assignedAt: hoursAfter(studyDate, stepsCompleted * 48),
        dueAt: hoursAfter(studyDate, stepsCompleted * 48 + (currentStep.slaHours ?? 168)),
        status: "PENDING", priority: "HIGH",
      },
    });
  }
}

// ── Study definitions ─────────────────────────────────────────────────────────

const STUDIES = [
  {
    seq: "001", title: "Bleach Plant Chlorine Dioxide Dosing — Comprehensive HIRA",
    scope: "PROCESS", status: "ACTIVE", stepsCompleted: 99,
    description: "Full hazard identification and risk assessment for the bleaching plant chlorine dioxide (ClO₂) / chlorine dosing process including receipt, storage, handling, and dosing into the bleaching towers. Covers all personnel exposure scenarios under routine, non-routine, and emergency conditions.",
    processCode: "PROC-CHG-DOSE-001",
    reviewFreq: "ANNUAL",
    entries: [
      { activity: "Unloading chlorine / ClO₂ precursor cylinders from tanker at bleach plant", routine: "NON_ROUTINE", freq: "WEEKLY", persons: 3, initL: 3, initS: 5, resL: 2, resS: 4,
        hazardCodes: ["CHEM_TOXIC_INHALATION", "MECH_HEAVY_LIFTING"],
        controlCodes: ["CTRL_PTW_CONFINED", "CTRL_BARRIER_HARD"],
        regRef: "Factories Act s. 41A — hazardous process notification", group: "Receipt & Unloading" },
      { activity: "Storage in bleach plant chlorine cylinder cage", routine: "ROUTINE", freq: "DAILY", persons: 5, initL: 2, initS: 5, resL: 1, resS: 5,
        hazardCodes: ["CHEM_TOXIC_INHALATION", "FIRE_HOT_WORK_IGNITION"],
        controlCodes: ["CTRL_GUARD_INTERLOCK", "CTRL_TBT"],
        regRef: "Gas Cylinder Rules 2016 — storage separation", group: "Storage" },
      { activity: "Connecting cylinder to bleaching-stage dosing line (header change)", routine: "NON_ROUTINE", freq: "WEEKLY", persons: 2, initL: 3, initS: 5, resL: 1, resS: 4,
        hazardCodes: ["CHEM_TOXIC_INHALATION", "CHEM_CORROSIVE_CONTACT"],
        controlCodes: ["CTRL_LOTO", "CTRL_PTW_CONFINED"],
        regRef: "Factories Act s. 87 — use of dangerous substances", group: "Connection" },
      { activity: "Routine dosing into bleaching towers — pump running", routine: "ROUTINE", freq: "CONTINUOUS", persons: 8, initL: 2, initS: 4, resL: 1, resS: 3,
        hazardCodes: ["CHEM_TOXIC_INHALATION"],
        controlCodes: ["CTRL_GUARD_INTERLOCK", "CTRL_TRAINING_TASK"],
        regRef: "OSHA 1910.119 — process safety management", group: "Process Operation" },
      { activity: "Chlorine / ClO₂ gas leak response in bleach plant / ERP activation", routine: "EMERGENCY", freq: "RARE", persons: 15, initL: 2, initS: 5, resL: 1, resS: 4,
        hazardCodes: ["CHEM_TOXIC_INHALATION", "BIO_INFECTIOUS_AGENT"],
        controlCodes: ["CTRL_BARRIER_HARD", "CTRL_TBT"],
        regRef: "Factories Act s. 38 — safety of buildings and machinery", group: "Emergency" },
      { activity: "Cylinder replacement and empty cylinder despatch", routine: "NON_ROUTINE", freq: "WEEKLY", persons: 2, initL: 2, initS: 4, resL: 1, resS: 3,
        hazardCodes: ["MECH_HEAVY_LIFTING", "CHEM_TOXIC_INHALATION"],
        controlCodes: ["CTRL_TRAINING_TASK", "CTRL_HEARING_PROT"],
        regRef: "Gas Cylinder Rules 2016 — cylinder handling", group: "Despatch" },
    ],
  },
  {
    seq: "002", title: "Hot Work Operations — Fire & Explosion HIRA",
    scope: "ACTIVITY", status: "ACTIVE", stepsCompleted: 99,
    description: "Hazard identification for all hot work activities (cutting, welding, grinding, brazing) performed across the paper mill. Covers all work areas including the pulp mill, recovery boiler, paper machine hall, maintenance workshop, and restricted zones.",
    processCode: "ACT-HOT-WORK-002",
    reviewFreq: "ANNUAL",
    entries: [
      { activity: "Gas cutting and oxy-acetylene welding in pulp mill / recovery boiler area", routine: "NON_ROUTINE", freq: "WEEKLY", persons: 3, initL: 4, initS: 4, resL: 2, resS: 3,
        hazardCodes: ["FIRE_HOT_WORK_IGNITION", "CHEM_FLAMMABLE_SPILL"],
        controlCodes: ["CTRL_PTW_HOT_WORK", "CTRL_BARRIER_HARD"],
        regRef: "Factories Act s. 31 — precautions in case of fire", group: "Process Area Hot Work" },
      { activity: "Arc welding in maintenance workshop bay", routine: "ROUTINE", freq: "DAILY", persons: 4, initL: 2, initS: 3, resL: 1, resS: 2,
        hazardCodes: ["FIRE_HOT_WORK_IGNITION", "RADIATION_NDT_GAMMA"],
        controlCodes: ["CTRL_PTW_HOT_WORK", "CTRL_GUARD_INTERLOCK"],
        regRef: "IS 818:2004 — code of practice for safety and health requirements in electric and gas welding", group: "Workshop Hot Work" },
      { activity: "Grinding and disc cutting operations", routine: "ROUTINE", freq: "DAILY", persons: 4, initL: 3, initS: 3, resL: 1, resS: 2,
        hazardCodes: ["MECH_UNGUARDED_ROTATING", "FIRE_HOT_WORK_IGNITION"],
        controlCodes: ["CTRL_GUARD_INTERLOCK", "CTRL_HEARING_PROT"],
        regRef: "Factories Act s. 21 — fencing of machinery", group: "Workshop Hot Work" },
      { activity: "Hot work near black liquor / chemical storage area (special conditions)", routine: "NON_ROUTINE", freq: "MONTHLY", persons: 2, initL: 4, initS: 5, resL: 1, resS: 4,
        hazardCodes: ["FIRE_HOT_WORK_IGNITION", "CHEM_FLAMMABLE_SPILL"],
        controlCodes: ["CTRL_PTW_HOT_WORK", "CTRL_LOTO"],
        regRef: "Petroleum Act 1934 — storage near ignition sources", group: "Flammable Zone" },
      { activity: "Post-weld inspection and weld clearance", routine: "NON_ROUTINE", freq: "WEEKLY", persons: 2, initL: 2, initS: 2, resL: 1, resS: 2,
        hazardCodes: ["THERMAL_HOT_SURFACE"],
        controlCodes: ["CTRL_TBT", "CTRL_TRAINING_TASK"],
        regRef: "IS 2825 — unfired pressure vessels (weld acceptance)", group: "Inspection" },
    ],
  },
  {
    seq: "003", title: "Confined Space Entry — Digesters, Chests & Towers HIRA",
    scope: "ACTIVITY", status: "APPROVED", stepsCompleted: 5,
    description: "Systematic hazard analysis for confined space entry into all digesters, stock chests, bleaching/pulp towers, tanks, ETP sumps, and pits across the mill. Covers atmospheric testing, entry procedures, rescue, and standby requirements.",
    processCode: "ACT-CSE-003",
    reviewFreq: "ANNUAL",
    entries: [
      { activity: "Atmospheric testing and pre-entry checklist", routine: "NON_ROUTINE", freq: "MONTHLY", persons: 2, initL: 3, initS: 5, resL: 1, resS: 3,
        hazardCodes: ["CONFINED_OXYGEN_DEFICIENCY", "CHEM_TOXIC_INHALATION"],
        controlCodes: ["CTRL_PTW_CONFINED", "CTRL_TRAINING_TASK"],
        regRef: "Factories Act s. 36A — confined space entry", group: "Pre-Entry" },
      { activity: "Entry into digesters / stock chests (pulp & chemical residues)", routine: "NON_ROUTINE", freq: "QUARTERLY", persons: 3, initL: 3, initS: 5, resL: 1, resS: 4,
        hazardCodes: ["CONFINED_OXYGEN_DEFICIENCY", "CHEM_TOXIC_INHALATION"],
        controlCodes: ["CTRL_PTW_CONFINED", "CTRL_LOTO"],
        regRef: "IS 4167 — confined space rescue", group: "Process Vessel Entry" },
      { activity: "Entry into ETP sumps and chest pits", routine: "NON_ROUTINE", freq: "MONTHLY", persons: 2, initL: 3, initS: 4, resL: 1, resS: 3,
        hazardCodes: ["CONFINED_OXYGEN_DEFICIENCY", "BIO_INFECTIOUS_AGENT"],
        controlCodes: ["CTRL_PTW_CONFINED", "CTRL_BARRIER_HARD"],
        regRef: "Factories Act s. 36A — confined space", group: "Drainage Structures" },
      { activity: "Standby attendant duties during CS operations", routine: "NON_ROUTINE", freq: "MONTHLY", persons: 1, initL: 2, initS: 5, resL: 1, resS: 3,
        hazardCodes: ["CONFINED_OXYGEN_DEFICIENCY"],
        controlCodes: ["CTRL_TRAINING_TASK", "CTRL_TBT"],
        regRef: "Factories Act s. 36A — attendant requirements", group: "Standby" },
      { activity: "Emergency rescue from confined space", routine: "EMERGENCY", freq: "RARE", persons: 5, initL: 2, initS: 5, resL: 1, resS: 4,
        hazardCodes: ["CONFINED_OXYGEN_DEFICIENCY", "CHEM_TOXIC_INHALATION"],
        controlCodes: ["CTRL_PTW_CONFINED", "CTRL_BARRIER_HARD"],
        regRef: "IS 4167:1993 — code of practice for safe entry confined space", group: "Emergency Rescue" },
      { activity: "Ventilation equipment check and SCBA inspection", routine: "ROUTINE", freq: "WEEKLY", persons: 1, initL: 1, initS: 4, resL: 1, resS: 2,
        hazardCodes: ["CONFINED_OXYGEN_DEFICIENCY"],
        controlCodes: ["CTRL_TRAINING_TASK", "CTRL_TBT"],
        regRef: "Factories Act s. 13 — ventilation", group: "Equipment Readiness" },
    ],
  },
  {
    seq: "004", title: "Overhead Crane Operations — Mechanical HIRA",
    scope: "EQUIPMENT", status: "IN_PROGRESS", stepsCompleted: 2,
    description: "Hazard identification for overhead crane and EOT crane operations in the paper machine hall and recovery boiler area, including reel/roll lifting, slinging, travel, and maintenance. Covers operator, rigger, and ground personnel scenarios.",
    processCode: "EQP-CRANE-OHC-004",
    reviewFreq: "ANNUAL",
    entries: [
      { activity: "Pre-shift inspection by crane operator", routine: "ROUTINE", freq: "DAILY", persons: 1, initL: 2, initS: 3, resL: 1, resS: 2,
        hazardCodes: ["MECH_UNGUARDED_ROTATING", "ELEC_LIVE_PARTS_LV"],
        controlCodes: ["CTRL_TRAINING_TASK", "CTRL_TBT"],
        regRef: "Factories Act s. 28 — cranes and lifting machinery", group: "Pre-Shift Checks" },
      { activity: "Load slinging and pre-lift check", routine: "ROUTINE", freq: "DAILY", persons: 3, initL: 3, initS: 4, resL: 2, resS: 3,
        hazardCodes: ["MECH_FALLING_OBJECT", "MECH_MOBILE_EQUIPMENT"],
        controlCodes: ["CTRL_TRAINING_TASK", "CTRL_BARRIER_HARD"],
        regRef: "IS 3938 — code of practice for electric overhead travelling cranes", group: "Slinging" },
      { activity: "Crane travel with suspended load", routine: "ROUTINE", freq: "DAILY", persons: 5, initL: 3, initS: 5, resL: 2, resS: 4,
        hazardCodes: ["MECH_FALLING_OBJECT", "MECH_MOBILE_EQUIPMENT"],
        controlCodes: ["CTRL_BARRIER_HARD", "CTRL_TBT"],
        regRef: "Factories Act s. 29 — lifting machines — chains, ropes, lifting tackle", group: "Load Travel" },
      { activity: "Crane maintenance — electrical & mechanical", routine: "NON_ROUTINE", freq: "MONTHLY", persons: 2, initL: 3, initS: 4, resL: 1, resS: 3,
        hazardCodes: ["ELEC_LIVE_PARTS_LV", "HEIGHT_FALL_OVER_2M"],
        controlCodes: ["CTRL_LOTO", "CTRL_HARNESS"],
        regRef: "Factories Act s. 28 — cranes and lifting machinery", group: "Maintenance" },
      { activity: "Annual statutory inspection by certifying engineer", routine: "NON_ROUTINE", freq: "MONTHLY", persons: 2, initL: 1, initS: 3, resL: 1, resS: 2,
        hazardCodes: ["HEIGHT_FALL_OVER_2M", "ELEC_LIVE_PARTS_LV"],
        controlCodes: ["CTRL_HARNESS", "CTRL_LOTO"],
        regRef: "Factories Act s. 29 — annual test and examination of lifting machines", group: "Statutory Inspection" },
    ],
  },
  {
    seq: "005", title: "Electrical Substation Maintenance — HIRA",
    scope: "EQUIPMENT", status: "DRAFT", stepsCompleted: 1,
    description: "Hazard assessment for 11kV/415V substation operations including switching, maintenance, isolation, and protection testing. For use by Electrical Department and authorised contractors.",
    processCode: "EQP-ELEC-SUB-005",
    reviewFreq: "BIENNIAL",
    entries: [
      { activity: "HV switching operations (11kV)", routine: "NON_ROUTINE", freq: "MONTHLY", persons: 2, initL: 3, initS: 5, resL: 2, resS: 4,
        hazardCodes: ["ELEC_HV_ARC_FLASH", "ELEC_STATIC_DISCHARGE"],
        controlCodes: ["CTRL_LOTO", "CTRL_PTW_CONFINED"],
        regRef: "Indian Electricity Act — operation of HV switchgear", group: "HV Operations" },
      { activity: "LV panel maintenance and testing", routine: "NON_ROUTINE", freq: "MONTHLY", persons: 2, initL: 3, initS: 4, resL: 1, resS: 3,
        hazardCodes: ["ELEC_LIVE_PARTS_LV", "ELEC_HV_ARC_FLASH"],
        controlCodes: ["CTRL_LOTO", "CTRL_GUARD_INTERLOCK"],
        regRef: "Factories Act s. 36 — protection against electric shock", group: "LV Maintenance" },
      { activity: "Battery bank maintenance (48V DC)", routine: "ROUTINE", freq: "WEEKLY", persons: 1, initL: 2, initS: 3, resL: 1, resS: 2,
        hazardCodes: ["ELEC_LIVE_PARTS_LV", "CHEM_CORROSIVE_CONTACT"],
        controlCodes: ["CTRL_TRAINING_TASK", "CTRL_HEARING_PROT"],
        regRef: "Factories Act s. 36 — electrical hazards", group: "Battery Maintenance" },
      { activity: "Transformer oil sampling and testing", routine: "NON_ROUTINE", freq: "MONTHLY", persons: 2, initL: 2, initS: 4, resL: 1, resS: 3,
        hazardCodes: ["CHEM_FLAMMABLE_SPILL", "ELEC_LIVE_PARTS_LV"],
        controlCodes: ["CTRL_LOTO", "CTRL_BARRIER_HARD"],
        regRef: "IS 335 — new insulating oils (transformer oil testing)", group: "Transformer" },
    ],
  },
];

// ── Per-plant seed ────────────────────────────────────────────────────────────

async function seedPlant(plantCode: "NW" | "SW") {
  const pl = plantCode.toLowerCase();
  const hse = plantCode === "NW"
    ? await prisma.user.findFirstOrThrow({ where: { email: "hse-manager.it.nw@safeops360.in" } })
    : await prisma.user.findFirstOrThrow({ where: { email: `hse-manager.it.${pl}@safeops360.in` } });
  const [teamLead, plantHead, supervisor, deptHead, safetyOfficer] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { email: `supervisor.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `plant-head.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `maintenance-head.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `dept-head.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `safety-officer.it.${pl}@safeops360.in` } }),
  ]);

  const plant = await prisma.plant.findFirstOrThrow({ where: { code: plantCode }, include: { areas: true } });
  const area = plant.areas[0];
  const { matrix, hazardsByCode, controlsByCode, likelihoodByScore, severityByScore } = await loadMasters();

  for (const def of STUDIES) {
    const studyDate = daysAgo(def.status === "ACTIVE" ? 90 : def.status === "APPROVED" ? 45 : def.status === "IN_PROGRESS" ? 20 : 5);
    const number = `HIRA-2026-${plantCode}-DEMO-${def.seq}`;

    const study = await prisma.hiraStudy.create({
      data: {
        number, title: def.title, description: def.description,
        plantId: plant.id, areaId: area.id,
        scopeType: def.scope as any,
        processCode: def.processCode,
        riskMatrixId: matrix.id,
        teamLeaderId: teamLead.id,
        status: def.status as any,
        initiatedAt: studyDate,
        targetCompletionDate: daysFromNow(def.status === "DRAFT" ? 30 : 0),
        completedAt: ["APPROVED", "ACTIVE"].includes(def.status) ? daysAgo(def.status === "ACTIVE" ? 60 : 30) : null,
        approvedAt: ["APPROVED", "ACTIVE"].includes(def.status) ? daysAgo(def.status === "ACTIVE" ? 55 : 25) : null,
        approvedById: ["APPROVED", "ACTIVE"].includes(def.status) ? plantHead.id : null,
        effectiveFrom: def.status === "ACTIVE" ? daysAgo(50) : null,
        nextScheduledReviewDate: def.status === "ACTIVE" ? daysFromNow(315) : null,
        reviewFrequency: def.reviewFreq as any,
        applicableRegulations: ["Factories Act 1948", "OSHA 1910.119", "IS 15656"],
        regulatoryReviewRequired: def.status === "ACTIVE",
        aggregateMetrics: def.status !== "DRAFT" ? {
          totalEntries: def.entries.length,
          byInitialLevel: { CRITICAL: Math.floor(def.entries.length * 0.2), HIGH: Math.floor(def.entries.length * 0.4), MODERATE: Math.floor(def.entries.length * 0.3), LOW: Math.floor(def.entries.length * 0.1) },
          byResidualLevel: { CRITICAL: 0, HIGH: Math.floor(def.entries.length * 0.2), MODERATE: Math.floor(def.entries.length * 0.4), LOW: Math.floor(def.entries.length * 0.4) },
          acceptableResidualCount: Math.floor(def.entries.length * 0.6),
        } : undefined,
        createdById: hse.id,
        updatedById: hse.id,
      },
    });

    // Team members
    const TEAM_ROLES = ["FACILITATOR", "SUBJECT_MATTER_EXPERT", "OPERATOR_REP", "SAFETY_OFFICER", "DEPARTMENT_HEAD"] as const;
    const teamUsers = [hse, teamLead, supervisor, safetyOfficer, deptHead];
    for (let i = 0; i < teamUsers.length; i++) {
      await prisma.hiraStudyTeamMember.create({
        data: {
          studyId: study.id, userId: teamUsers[i].id, teamRole: TEAM_ROLES[i],
          department: "Process & Utilities",
          signedAt: ["APPROVED", "ACTIVE"].includes(def.status) ? daysAgo(def.status === "ACTIVE" ? 58 : 28) : null,
          signedNote: ["APPROVED", "ACTIVE"].includes(def.status) ? "Reviewed and agree with the risk assessment findings." : null,
        },
      });
    }

    // Attachment
    await prisma.hiraStudyAttachment.create({
      data: {
        studyId: study.id, fileName: `${number}-scoping-notes.pdf`, fileUrl: `https://storage.safeops360.in/hira/${number}-scoping-notes.pdf`,
        fileSize: 245678, mimeType: "application/pdf", category: "SCOPING_NOTES",
        description: "Initial scoping notes and study boundary definition document",
        uploadedAt: studyDate, uploadedById: hse.id,
      },
    });

    // Entries
    for (let eIdx = 0; eIdx < def.entries.length; eIdx++) {
      const e = def.entries[eIdx];
      const initL = likelihoodByScore[e.initL];
      const initS = severityByScore[e.initS];
      const resL  = likelihoodByScore[e.resL];
      const resS  = severityByScore[e.resS];
      const initScore = e.initL * e.initS;
      const resScore  = e.resL  * e.resS;
      const levelFor = (s: number) => s >= 15 ? "CRITICAL" : s >= 8 ? "HIGH" : s >= 4 ? "MODERATE" : "LOW";

      const entry = await prisma.hiraEntry.create({
        data: {
          studyId: study.id, sequenceNumber: eIdx + 1, groupLabel: e.group,
          activityDescription: e.activity,
          areaId: area.id, subLocation: `Zone ${String.fromCharCode(65 + eIdx)}`,
          routine: e.routine as any, frequency: e.freq as any,
          typicalDurationMin: e.routine === "CONTINUOUS" ? 480 : e.routine === "NON_ROUTINE" ? 120 : 60,
          personsEmployees: e.persons, personsContractors: 1, personsVisitors: 0, personsPublic: 0,
          equipmentUsed: ["PPE Kit", "Gas detector", "SCBA (if required)"],
          materialsUsed: ["Process chemicals as applicable"],
          energySourcesPresent: ["Electrical", "Chemical", "Mechanical"],
          initialLikelihoodId: initL.id, initialLikelihoodScore: e.initL, initialLikelihoodRationale: `Based on historical frequency of similar events in the process area.`,
          initialSeverityId: initS.id, initialSeverityScore: e.initS, initialSeverityRationale: `Severity rated considering worst credible outcome for exposed persons.`,
          initialRiskScore: initScore, initialRiskLevel: levelFor(initScore),
          residualLikelihoodId: resL.id, residualLikelihoodScore: e.resL, residualLikelihoodRationale: `Residual likelihood after engineering controls, PTW, and training are applied.`,
          residualSeverityId: resS.id, residualSeverityScore: e.resS, residualSeverityRationale: `Residual severity — some consequence potential remains after controls.`,
          residualRiskScore: resScore, residualRiskLevel: levelFor(resScore),
          residualAcceptable: resScore <= 8,
          residualAcceptanceRationale: resScore <= 8 ? "Residual risk is within tolerable limits given controls in place." : "Residual risk requires additional improvement — recommended controls raised.",
          influencesPtwRiskLevel: ["PROC-CHG-DOSE-001", "ACT-HOT-WORK-002", "ACT-CSE-003"].includes(def.processCode),
          influencesPtwPermitTypes: ["PROC-CHG-DOSE-001", "ACT-HOT-WORK-002"].includes(def.processCode) ? ["HOT_WORK", "GENERAL_COLD"] : ["CONFINED_SPACE"],
          status: def.status === "ACTIVE" ? "ACTIVE" : def.status === "APPROVED" ? "APPROVED" : "DRAFT" as any,
          versionNumber: def.status === "ACTIVE" ? 2 : 1, isCurrentVersion: true,
          lastReviewedAt: def.status === "ACTIVE" ? daysAgo(55) : null,
          lastReviewedById: def.status === "ACTIVE" ? hse.id : null,
          nextReviewDue: def.status === "ACTIVE" ? daysFromNow(310) : null,
          reviewCount: def.status === "ACTIVE" ? 1 : 0,
          createdById: hse.id, updatedById: hse.id,
        },
      });

      // Hazards
      for (const hCode of e.hazardCodes) {
        const hazard = hazardsByCode[hCode];
        if (!hazard) continue;
        await prisma.hiraEntryHazard.create({
          data: {
            entryId: entry.id, hazardId: hazard.id,
            contextualDescription: `${hazard.name} hazard specific to ${e.activity.toLowerCase()}`,
            potentialHarm: ["injury", "chemical exposure", "fatality potential"],
            affectedPersons: ["Direct operator", "Adjacent workers"],
            sortOrder: e.hazardCodes.indexOf(hCode),
          },
        });
      }

      // Controls
      const HIER_LABELS: Record<string, string> = {
        CTRL_LOTO: "ADMINISTRATIVE", CTRL_PTW_HOT_WORK: "ADMINISTRATIVE", CTRL_PTW_CONFINED: "ADMINISTRATIVE",
        CTRL_GUARD_INTERLOCK: "ENGINEERING", CTRL_LEV: "ENGINEERING", CTRL_HARNESS: "PPE",
        CTRL_HEARING_PROT: "PPE", CTRL_TRAINING_TASK: "ADMINISTRATIVE", CTRL_TBT: "ADMINISTRATIVE",
        CTRL_BARRIER_HARD: "ENGINEERING",
      };
      for (const cCode of e.controlCodes) {
        const ctrl = controlsByCode[cCode];
        await prisma.hiraEntryControl.create({
          data: {
            entryId: entry.id, controlId: ctrl?.id ?? null,
            hierarchy: (ctrl ? HIER_LABELS[cCode] : "ADMINISTRATIVE") as any,
            description: ctrl ? `${ctrl.hierarchy.replace("_", " ")} control: verified and in place for this activity.` : "Administrative control — procedure and instruction based.",
            effectiveness: ["APPROVED", "ACTIVE"].includes(def.status) ? "EFFECTIVE" : "NOT_VERIFIED",
            verificationMethod: "Physical inspection + permit log review",
            verificationFreq: "Each occurrence",
            responsibleRole: "SAFETY_OFFICER",
            evidenceAttached: ["APPROVED", "ACTIVE"].includes(def.status),
            sortOrder: e.controlCodes.indexOf(cCode),
          },
        });
      }

      // Recommended control
      await prisma.hiraEntryRecommendedControl.create({
        data: {
          entryId: entry.id,
          hierarchy: "ENGINEERING" as any,
          description: `Install continuous gas/condition monitoring with automated interlock for ${e.activity.toLowerCase()}.`,
          rationale: "Engineering control provides reliable risk reduction independent of human action.",
          targetLikelihoodReduction: 1, targetSeverityReduction: 0,
          estimatedCostBand: "HIGH" as any,
          proposedImplementationDate: daysFromNow(90),
          responsibleId: deptHead.id,
          status: def.status === "ACTIVE" ? "IN_PROGRESS" : "PROPOSED" as any,
        },
      });

      // Regulation ref
      await prisma.hiraEntryRegulationRef.create({
        data: {
          entryId: entry.id, regulation: e.regRef.split(" — ")[0],
          section: e.regRef.includes(" — ") ? e.regRef.split(" — ")[0].match(/s\.\s*\w+/)?.[0] ?? null : null,
          requirementSummary: e.regRef.split(" — ")[1] ?? e.regRef,
        },
      });

      // Review cycle for ACTIVE entries
      if (def.status === "ACTIVE") {
        await prisma.hiraReviewCycle.create({
          data: {
            entryId: entry.id,
            scheduledFor: daysFromNow(310),
            triggeredBy: "SCHEDULE",
            status: "SCHEDULED",
            assignedToId: safetyOfficer.id,
            assignedRole: "SAFETY_OFFICER",
          },
        });
        // Version record
        await prisma.hiraVersion.create({
          data: {
            entryId: entry.id, versionNumber: 1,
            snapshot: { activityDescription: e.activity, initialRiskScore: initScore, residualRiskScore: resScore },
            changes: [{ type: "initialApproval", value: true }],
            changeReason: "Initial study approval and activation.",
            changeTrigger: "INITIAL_APPROVAL",
            createdAt: daysAgo(55), createdById: plantHead.id,
          },
        });
      }
    }

    // Workflow
    const stepsCompleted = def.stepsCompleted === 99 ? 999 : def.stepsCompleted;
    await createHiraWorkflow({
      studyId: study.id, studyNumber: number, studyTitle: def.title, studyDate,
      status: def.status, stepsCompleted,
      actors: { initiator: hse.id, teamLead: teamLead.id, plantHead: plantHead.id, hseManager: hse.id },
    });

    console.log(`   ✓ ${plantCode}: ${number}  [${def.status}]  ${def.entries.length} entries`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║  Step 17 — Risk Management: HIRA Studies (5/plant)║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  // Idempotent cleanup
  console.log("   🧹 Cleaning existing HIRA DEMO- records…");
  const existing = await prisma.hiraStudy.findMany({ where: { number: { contains: "-DEMO-" } }, select: { id: true } });
  for (const s of existing) {
    await prisma.workflowInstance.deleteMany({ where: { recordId: s.id } });
    await prisma.hiraStudy.delete({ where: { id: s.id } });
  }
  console.log("   Cleanup done.\n");

  await seedPlant("NW");
  await seedPlant("SW");

  console.log("\n✅  Risk Management seed complete.\n");
}

main()
  .catch(e => { console.error("❌  Seed failed:", e?.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
