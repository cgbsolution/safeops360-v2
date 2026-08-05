// ─────────────────────────────────────────────────────────────────────────────
// Step 21 — CAPA (Universal): 8 records per plant (NW + SW)
//
// Every Capa record is fully populated:
//   • Capa (all required + optional fields)
//   • CapaAction × 2-3 per record
//   • CapaRootCause × 1-2 per record
//   • CapaContributor × 2-3 per record
//   • WorkflowInstance + WorkflowHistory + WorkflowTask
//
// States covered: CLOSED, VERIFIED, PENDING_VERIFICATION, ACTIONS_IN_PROGRESS,
//                 ACTIONS_PLANNED, UNDER_RCA, SUBMITTED, DRAFT
//
// Idempotent: deletes records with capaNumber containing "-DEMO-" before recreating.
// Run: npx tsx prisma/seed-capa.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-08T08:00:00.000Z");
function daysAgo(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; }

// ── Master data lookup ────────────────────────────────────────────────────────

async function loadMasters() {
  const cats = await prisma.capaSourceCategory.findMany({ select: { id: true, code: true } });
  const catByCode = Object.fromEntries(cats.map(c => [c.code, c]));

  const types = await prisma.capaSourceType.findMany({ select: { id: true, code: true } });
  const typeByCode = Object.fromEntries(types.map(t => [t.code, t]));

  const subs = await prisma.capaSubCategory.findMany({ select: { id: true, code: true } });
  const subByCode = Object.fromEntries(subs.map(s => [s.code, s]));

  const verMethods = await prisma.capaVerificationMethod.findMany({ select: { id: true, code: true } });
  const verByCode = Object.fromEntries(verMethods.map(v => [v.code, v]));

  return { catByCode, typeByCode, subByCode, verByCode };
}

// ── Workflow helper ───────────────────────────────────────────────────────────

async function createCapaWorkflow(opts: {
  capaId: string;
  capaNumber: string;
  capaTitle: string;
  severity: string;
  state: string;
  detectedAt: Date;
  actors: {
    initiator: string;
    primaryOwner: string;
    checker: string;
    verifier: string;
    closer: string;
  };
}) {
  const { capaId, capaNumber, capaTitle, severity, state, detectedAt, actors } = opts;

  // Map severity to workflow recordType
  const recordType = severity; // LOW | MODERATE | HIGH | CRITICAL

  const def = await prisma.workflowDefinition.findFirstOrThrow({
    where: { module: "CAPA", recordType },
    include: { steps: { orderBy: { sequence: "asc" }, select: { id: true, sequence: true, stepType: true, name: true, slaHours: true } } },
  });

  // Map state to stepsCompleted
  const stepsMap: Record<string, number> = {
    DRAFT: 0,
    SUBMITTED: 1,
    UNDER_RCA: 1,
    ACTIONS_PLANNED: 2,
    ACTIONS_IN_PROGRESS: 3,
    PENDING_VERIFICATION: 4,
    VERIFIED: 5,
    CLOSED: def.steps.length,
  };
  const stepsCompleted = stepsMap[state] ?? 1;
  const allDone = stepsCompleted >= def.steps.length;

  const instance = await prisma.workflowInstance.create({
    data: {
      definitionId: def.id,
      module: "CAPA",
      recordId: capaId,
      recordNumber: capaNumber,
      initiatedById: actors.initiator,
      initiatedAt: detectedAt,
      status: allDone ? "COMPLETED" : "IN_PROGRESS",
      currentStepId: allDone ? null : (def.steps[stepsCompleted]?.id ?? null),
      currentStepName: allDone ? null : (def.steps[stepsCompleted]?.name ?? null),
      completedAt: allDone ? daysAgo(2) : null,
    },
  });

  // Completed steps
  for (let i = 0; i < Math.min(stepsCompleted, def.steps.length); i++) {
    const step = def.steps[i];
    const actorId =
      step.stepType === "MAKER" ? actors.initiator
        : step.stepType === "CHECKER" ? actors.checker
          : step.stepType === "VERIFIER" ? actors.verifier
            : step.stepType === "CLOSURE" ? actors.closer
              : actors.primaryOwner;
    const completedAt = new Date(detectedAt.getTime() + (i + 1) * 2 * 24 * 3_600_000);
    await prisma.workflowHistory.create({
      data: {
        instanceId: instance.id,
        stepId: step.id,
        stepName: step.name,
        action: "APPROVED",
        performedById: actorId,
        performedAt: completedAt,
        comments: `${step.name} completed`,
      },
    });
  }

  // Pending step
  if (!allDone && stepsCompleted < def.steps.length) {
    const pendingStep = def.steps[stepsCompleted];
    const assigneeId =
      pendingStep.stepType === "CHECKER" ? actors.checker
        : pendingStep.stepType === "VERIFIER" ? actors.verifier
          : pendingStep.stepType === "CLOSURE" ? actors.closer
            : actors.primaryOwner;
    const dueDate = pendingStep.slaHours
      ? new Date(TODAY.getTime() + pendingStep.slaHours * 3_600_000)
      : daysFromNow(7);
    await prisma.workflowTask.create({
      data: {
        instanceId: instance.id,
        stepId: pendingStep.id,
        stepName: pendingStep.name,
        taskType: pendingStep.stepType === "ASSIGNEE_TASK" ? "EXECUTION"
          : pendingStep.stepType === "VERIFIER" ? "VERIFICATION"
            : "APPROVAL",
        module: "CAPA",
        recordId: capaId,
        recordNumber: capaNumber,
        recordTitle: capaTitle,
        assignedToId: assigneeId,
        dueAt: dueDate,
        status: "PENDING",
        priority: severity === "CRITICAL" ? "URGENT" : severity === "HIGH" ? "HIGH" : "NORMAL",
      },
    });
  }

  return instance;
}

// ── Plant seed ────────────────────────────────────────────────────────────────

async function seedPlant(pl: "NW" | "SW") {
  const P = pl;
  const slug = pl.toLowerCase() as "nw" | "sw";

  const plant = await prisma.plant.findFirstOrThrow({ where: { code: P } });

  const getUser = async (email: string) =>
    prisma.user.findFirstOrThrow({ where: { email }, select: { id: true } });

  const hse = await getUser(`hse-manager.it.${slug}@safeops360.in`);
  const plantHead = await getUser(`plant-head.it.${slug}@safeops360.in`);
  const supervisor = await getUser(`supervisor.it.${slug}@safeops360.in`);
  const safetyOfficer = await getUser(`safety-officer.it.${slug}@safeops360.in`);
  const worker = await getUser(`worker.it.${slug}@safeops360.in`);
  const maintHead = await getUser(`maintenance-head.it.${slug}@safeops360.in`);

  const masters = await loadMasters();
  const { catByCode, typeByCode, subByCode, verByCode } = masters;

  // ── Cleanup ─────────────────────────────────────────────────────────────

  const existingCapas = await prisma.capa.findMany({
    where: { plantId: plant.id, capaNumber: { contains: `-DEMO-` } },
    select: { id: true },
  });
  if (existingCapas.length) {
    const ids = existingCapas.map(c => c.id);
    await prisma.workflowTask.deleteMany({ where: { module: "CAPA", instanceId: { in: (await prisma.workflowInstance.findMany({ where: { module: "CAPA", recordId: { in: ids } }, select: { id: true } })).map(i => i.id) } } });
    await prisma.workflowHistory.deleteMany({ where: { instanceId: { in: (await prisma.workflowInstance.findMany({ where: { module: "CAPA", recordId: { in: ids } }, select: { id: true } })).map(i => i.id) } } });
    await prisma.workflowInstance.deleteMany({ where: { module: "CAPA", recordId: { in: ids } } });
    await prisma.capa.deleteMany({ where: { plantId: plant.id, capaNumber: { contains: `-DEMO-` } } });
  }

  // ── 8 CAPA definitions ─────────────────────────────────────────────────

  const CAPAS = [
    {
      num: "001", severity: "HIGH", state: "CLOSED",
      title: "Chlorine gas release — corrective + preventive actions",
      sourceTypeCode: "SAFETY_INCIDENT", sourceCatCode: "SAFETY", subCatCode: "EQUIPMENT",
      actionType: "CORRECTIVE_AND_PREVENTIVE",
      problem: "Chlorine gas detected above TLV at dosing station. Corrosion on isolation valve stem allowed micro-leak during peak load. Two workers exposed; first aid required.",
      detectedAt: daysAgo(90), rcaMethodology: "5_WHY",
      rcaSummary: "Root cause: isolation valve stem corrosion not identified during 6-monthly inspection due to absence of UT thickness testing on valve bodies. Contributing: no specific checklist item for CI valve stems in chlorine service.",
      verificationResult: "EFFECTIVE",
      actors: { initiator: hse.id, primaryOwner: maintHead.id, checker: plantHead.id, verifier: safetyOfficer.id, closer: plantHead.id },
      actions: [
        { type: "IMMEDIATE_CONTAINMENT", desc: "Isolated valve, vented line, evacuated area. Air quality monitoring confirmed clearance before re-entry.", owner: maintHead.id, status: "COMPLETED", daysFromDetect: 1 },
        { type: "CORRECTIVE", desc: "Replace all CI isolation valves in chlorine service with corrosion-resistant duplex SS valves. UT thickness test prior to re-commissioning.", owner: maintHead.id, status: "COMPLETED", daysFromDetect: 30 },
        { type: "PREVENTIVE", desc: "Revise preventive maintenance checklist to include UT thickness measurement for all valves in corrosive service. Frequency: quarterly.", owner: safetyOfficer.id, status: "COMPLETED", daysFromDetect: 45 },
      ],
      rootCauses: [
        { desc: "6-monthly visual inspection did not include ultrasonic wall thickness measurement on valve stems in corrosive service.", cat: "PROCESS", confidence: "HIGH" },
        { desc: "PM checklist had no specific line item for CI valve stem integrity in chlorine dosing service.", cat: "DOCUMENTATION", confidence: "HIGH" },
      ],
    },
    {
      num: "002", severity: "MODERATE", state: "VERIFIED",
      title: "Overhead crane wire rope wear — inspection finding CAPA",
      sourceTypeCode: "INSPECTION_FINDING", sourceCatCode: "SAFETY", subCatCode: "EQUIPMENT",
      actionType: "CORRECTIVE_AND_PREVENTIVE",
      problem: "Monthly crane inspection found wire rope with 3 broken wires in one lay, exceeding the 2-wire discard criterion. Crane taken out of service immediately.",
      detectedAt: daysAgo(45), rcaMethodology: "5_WHY",
      rcaSummary: "Wire rope lubrication had lapsed; last application was 8 months prior vs 3-month schedule. Maintenance coordinator did not reschedule after technician absence.",
      verificationResult: "EFFECTIVE",
      actors: { initiator: safetyOfficer.id, primaryOwner: maintHead.id, checker: hse.id, verifier: safetyOfficer.id, closer: hse.id },
      actions: [
        { type: "IMMEDIATE_CONTAINMENT", desc: "Crane taken out of service; defective wire rope replaced with new rope of same grade and diameter.", owner: maintHead.id, status: "COMPLETED", daysFromDetect: 2 },
        { type: "CORRECTIVE", desc: "All 3 cranes at facility: inspect wire ropes; replace any showing > 1 broken wire in a lay.", owner: maintHead.id, status: "COMPLETED", daysFromDetect: 7 },
        { type: "PREVENTIVE", desc: "Wire rope lubrication moved to CMMS preventive schedule with auto-alert to supervisor if overdue by > 7 days.", owner: safetyOfficer.id, status: "COMPLETED", daysFromDetect: 21 },
      ],
      rootCauses: [
        { desc: "Preventive lubrication schedule not tracked in CMMS — paper-based schedule missed after technician absence.", cat: "PROCESS", confidence: "HIGH" },
      ],
    },
    {
      num: "003", severity: "HIGH", state: "PENDING_VERIFICATION",
      title: "Electrical arc flash — hot work near energised panel",
      sourceTypeCode: "NEAR_MISS", sourceCatCode: "SAFETY", subCatCode: "HUMAN_FACTORS",
      actionType: "CORRECTIVE_AND_PREVENTIVE",
      problem: "Electrician began work on MCC panel without verifying de-energisation. Arc flash occurred; PPE prevented injury. Near-miss escalated to CAPA given high potential severity.",
      detectedAt: daysAgo(30), rcaMethodology: "FISHBONE",
      rcaSummary: "Fishbone analysis identified: (1) LOTO procedure posted on equipment was outdated version; (2) electrician new to this circuit had not completed specific LOTO OJT; (3) buddy check not performed due to understaffing on the shift.",
      verificationResult: null,
      actors: { initiator: hse.id, primaryOwner: supervisor.id, checker: hse.id, verifier: safetyOfficer.id, closer: hse.id },
      actions: [
        { type: "IMMEDIATE_CONTAINMENT", desc: "Work stopped; all MCC panels audited for current LOTO procedure revisions. Outdated procedures replaced.", owner: supervisor.id, status: "COMPLETED", daysFromDetect: 1 },
        { type: "CORRECTIVE", desc: "Electrician completed LOTO specific OJT for this panel. Competency record updated.", owner: supervisor.id, status: "COMPLETED", daysFromDetect: 14 },
        { type: "PREVENTIVE", desc: "LOTO buddy check made mandatory for all MV/HV work regardless of crew size. Reinforced in toolbox talk. Updated PTW checklist.", owner: safetyOfficer.id, status: "IN_PROGRESS", daysFromDetect: 30 },
      ],
      rootCauses: [
        { desc: "LOTO procedure posted on MCC panel was superseded version — document control system not integrated with field posting.", cat: "DOCUMENTATION", confidence: "HIGH" },
        { desc: "Technician had not completed panel-specific LOTO OJT — competency gap not flagged before shift assignment.", cat: "TRAINING", confidence: "HIGH" },
      ],
    },
    {
      num: "004", severity: "MODERATE", state: "ACTIONS_IN_PROGRESS",
      title: "Internal audit NC — SOP non-compliance in chemical handling",
      sourceTypeCode: "AUDIT_INTERNAL", sourceCatCode: "QUALITY", subCatCode: "DOCUMENTATION",
      actionType: "CORRECTIVE_AND_PREVENTIVE",
      problem: "Internal audit (IMS-AUD-2026-Q1) identified that 3 of 5 chemical handling operators could not locate the current revision of SOP-CHEM-005. One operator using superseded procedure.",
      detectedAt: daysAgo(21), rcaMethodology: "IS_IS_NOT",
      rcaSummary: "IS: Chemical handling area, Shift B operators. IS NOT: Shift A, other areas. Documents issue: SOP revisions distributed via email only; operators on shift B had not accessed intranet in > 3 months. Root cause: document distribution system does not enforce acknowledgement for controlled procedures.",
      verificationResult: null,
      actors: { initiator: safetyOfficer.id, primaryOwner: supervisor.id, checker: hse.id, verifier: safetyOfficer.id, closer: hse.id },
      actions: [
        { type: "CORRECTIVE", desc: "All affected operators trained on SOP-CHEM-005 Rev 4. Acknowledgement records signed and filed.", owner: supervisor.id, status: "COMPLETED", daysFromDetect: 7 },
        { type: "PREVENTIVE", desc: "Document management system updated: controlled procedure revisions now require digital acknowledgement before operators can access work orders.", owner: safetyOfficer.id, status: "IN_PROGRESS", daysFromDetect: 21 },
      ],
      rootCauses: [
        { desc: "Controlled document acknowledgement not enforced — email distribution relied on self-reporting.", cat: "PROCESS", confidence: "HIGH" },
      ],
    },
    {
      num: "005", severity: "LOW", state: "ACTIONS_PLANNED",
      title: "Housekeeping deficiency — slip hazard in raw materials store",
      sourceTypeCode: "SAFETY_OBSERVATION", sourceCatCode: "SAFETY", subCatCode: "ENVIRONMENTAL",
      actionType: "CORRECTIVE_ONLY",
      problem: "Safety walk identified spilled granular material on access aisle in raw materials store. Aisle not cleaned at end of shift as per housekeeping standard.",
      detectedAt: daysAgo(7), rcaMethodology: "NONE_REQUIRED",
      rcaSummary: "Housekeeping standard awareness issue. End-of-shift cleaning checklist not being consistently completed.",
      verificationResult: null,
      actors: { initiator: worker.id, primaryOwner: supervisor.id, checker: supervisor.id, verifier: safetyOfficer.id, closer: supervisor.id },
      actions: [
        { type: "CORRECTIVE", desc: "Clean spilled material; inspect and clean all access aisles in raw materials store. Verify no other contamination.", owner: supervisor.id, status: "PROPOSED", daysFromDetect: 1 },
        { type: "CORRECTIVE", desc: "Reinforce end-of-shift housekeeping checklist in next team briefing. Supervisor to verify completion daily for 30 days.", owner: supervisor.id, status: "PROPOSED", daysFromDetect: 7 },
      ],
      rootCauses: [
        { desc: "End-of-shift housekeeping checklist completion not verified by supervisor.", cat: "PROCESS", confidence: "MEDIUM" },
      ],
    },
    {
      num: "006", severity: "CRITICAL", state: "UNDER_RCA",
      title: "Regulatory inspection NC — pressure relief valve not tested per PESO schedule",
      sourceTypeCode: "REGULATORY_INSPECTION_FINDING", sourceCatCode: "REGULATORY", subCatCode: "PROCESS",
      actionType: "CORRECTIVE_AND_PREVENTIVE",
      problem: "PESO statutory inspection identified that 2 pressure relief valves on the air receiver system were not tested on schedule — testing overdue by 4 months. Immediate Notice of Prohibition issued.",
      detectedAt: daysAgo(14), rcaMethodology: "FAULT_TREE",
      rcaSummary: "Fault tree analysis in progress. Preliminary finding: statutory inspection schedule not integrated with CMMS auto-scheduling. Manual tracking spreadsheet missed PRV due dates when technician on long leave.",
      verificationResult: null,
      actors: { initiator: hse.id, primaryOwner: maintHead.id, checker: plantHead.id, verifier: hse.id, closer: plantHead.id },
      actions: [
        { type: "IMMEDIATE_CONTAINMENT", desc: "Air receivers isolated; PRVs removed and dispatched to PESO-approved test lab. Results expected in 5 days.", owner: maintHead.id, status: "IN_PROGRESS", daysFromDetect: 1 },
        { type: "CORRECTIVE", desc: "Upon test certification, re-install PRVs and lift Notice of Prohibition. PESO inspector notification of rectification.", owner: maintHead.id, status: "PROPOSED", daysFromDetect: 10 },
        { type: "PREVENTIVE", desc: "Integrate all statutory inspection schedules (PESO, Factory Inspectorate, fire dept) into CMMS. Auto-alert 30/60/90 days before due date.", owner: safetyOfficer.id, status: "PROPOSED", daysFromDetect: 30 },
      ],
      rootCauses: [
        { desc: "Statutory PRV test schedule not integrated into CMMS — manual spreadsheet tracking lapsed during long leave.", cat: "PROCESS", confidence: "HIGH" },
        { desc: "No backup ownership assigned for statutory schedule tracking during planned absences.", cat: "HUMAN_FACTORS", confidence: "MEDIUM" },
      ],
    },
    {
      num: "007", severity: "LOW", state: "SUBMITTED",
      title: "Training gap — hot work authorization competency not current",
      sourceTypeCode: "TRAINING_GAP", sourceCatCode: "ORGANIZATIONAL", subCatCode: "TRAINING",
      actionType: "CORRECTIVE_ONLY",
      problem: "Competency audit found 2 maintenance workers with expired Hot Work Welder (SMAW) authorization. Workers had not been re-assessed after 3-year recertification was due.",
      detectedAt: daysAgo(5), rcaMethodology: "NONE_REQUIRED",
      rcaSummary: "Recertification reminder process not automated. Learning & Development team manually tracks expiry with a spreadsheet that was not updated for 6 months.",
      verificationResult: null,
      actors: { initiator: safetyOfficer.id, primaryOwner: supervisor.id, checker: supervisor.id, verifier: safetyOfficer.id, closer: supervisor.id },
      actions: [
        { type: "CORRECTIVE", desc: "Schedule affected workers for hot work re-assessment within 14 days. Restrict hot work until authorized.", owner: supervisor.id, status: "PROPOSED", daysFromDetect: 14 },
      ],
      rootCauses: [
        { desc: "Competency expiry reminders not automated — L&D spreadsheet not maintained for 6 months.", cat: "PROCESS", confidence: "HIGH" },
      ],
    },
    {
      num: "008", severity: "MODERATE", state: "DRAFT",
      title: "HIRA recommended control — high noise in compressor room",
      sourceTypeCode: "HIRA_CONTROL", sourceCatCode: "SAFETY", subCatCode: "ENVIRONMENTAL",
      actionType: "PREVENTIVE_ONLY",
      problem: "HIRA review of compressor room identified noise level averaging 95 dB(A) — exceeding the 85 dB action level. Engineering noise control not yet installed. Hearing protection mandatory interim control only.",
      detectedAt: daysAgo(2), rcaMethodology: null,
      rcaSummary: null,
      verificationResult: null,
      actors: { initiator: hse.id, primaryOwner: maintHead.id, checker: hse.id, verifier: safetyOfficer.id, closer: hse.id },
      actions: [
        { type: "PREVENTIVE", desc: "Procure and install acoustic enclosure around compressor units 1–3. Target: reduce noise at operator station to < 80 dB(A). Engineering evaluation to specify design.", owner: maintHead.id, status: "PROPOSED", daysFromDetect: 60 },
      ],
      rootCauses: [],
    },
  ];

  for (const c of CAPAS) {
    const sourceCat = catByCode[c.sourceCatCode];
    const sourceType = typeByCode[c.sourceTypeCode];
    const subCat = subByCode[c.subCatCode];
    if (!sourceCat || !sourceType) {
      console.error(`  ❌ ${P}: CAPA-${P}-DEMO-${c.num} — missing master data for ${c.sourceCatCode}/${c.sourceTypeCode}`);
      continue;
    }

    const capaNumber = `CAPA-${P}-DEMO-${c.num}`;
    const closedAt = c.state === "CLOSED" ? daysAgo(5) : null;
    const verifiedAt = (c.state === "CLOSED" || c.state === "VERIFIED") ? daysAgo(10) : null;

    const capa = await prisma.capa.create({
      data: {
        capaNumber,
        title: c.title,
        plantId: plant.id,
        sourceCategoryId: sourceCat.id,
        sourceTypeId: sourceType.id,
        sourceTypeCode: c.sourceTypeCode,
        problemDescription: c.problem,
        detectedAt: c.detectedAt,
        detectedByUserId: c.actors.initiator,
        primaryCategory: c.subCatCode === "EQUIPMENT" ? "Equipment-related"
          : c.subCatCode === "PROCESS" ? "Process-related"
            : c.subCatCode === "HUMAN_FACTORS" ? "Human factors"
              : c.subCatCode === "DOCUMENTATION" ? "Documentation"
                : c.subCatCode === "TRAINING" ? "Training"
                  : c.subCatCode === "ENVIRONMENTAL" ? "Environmental"
                    : "Process-related",
        subCategoryId: subCat?.id ?? null,
        actionType: c.actionType,
        severity: c.severity,
        priority: c.severity === "CRITICAL" ? "URGENT" : c.severity === "HIGH" ? "HIGH" : c.severity === "MODERATE" ? "MODERATE" : "LOW",
        isRecurring: false,
        rcaMethodology: c.rcaMethodology,
        rcaCompleted: !!c.rcaSummary && c.state !== "DRAFT" && c.state !== "UNDER_RCA",
        rcaSummary: c.rcaSummary,
        rcaCompletedAt: c.rcaSummary && c.state !== "DRAFT" && c.state !== "UNDER_RCA" ? daysAgo(Math.floor(90 - 60 * (CAPAS.indexOf(c) / CAPAS.length))) : null,
        rcaCompletedByUserId: c.rcaSummary ? c.actors.primaryOwner : null,
        verificationMethodId: verByCode["INSPECTION"]?.id ?? null,
        verificationSuccessCriteria: "No recurrence within 60-day measurement period. Supporting evidence: inspection records, training certificates, or CMMS audit trail.",
        measurementPeriodDays: 60,
        verificationDueDate: daysFromNow(60 - CAPAS.indexOf(c) * 7),
        verificationCompletedAt: verifiedAt,
        verificationCompletedByUserId: verifiedAt ? c.actors.verifier : null,
        verificationResult: c.verificationResult,
        verificationEvidence: c.verificationResult ? "Post-implementation audit confirmed controls in place and operating effectively. No recurrence observed during measurement period." : null,
        state: c.state,
        stateChangedAt: c.state === "DRAFT" ? c.detectedAt : daysAgo(1),
        stateChangedByUserId: c.actors.initiator,
        rcaDueDate: new Date(c.detectedAt.getTime() + 14 * 24 * 3_600_000),
        correctiveActionDueDate: new Date(c.detectedAt.getTime() + 30 * 24 * 3_600_000),
        preventiveActionDueDate: new Date(c.detectedAt.getTime() + 45 * 24 * 3_600_000),
        closureTargetDate: new Date(c.detectedAt.getTime() + 90 * 24 * 3_600_000),
        raisedByUserId: c.actors.initiator,
        raisedByRole: "HSE_MANAGER",
        primaryOwnerUserId: c.actors.primaryOwner,
        primaryOwnerRole: "MAINTENANCE_HEAD",
        estimatedProblemCost: c.severity === "CRITICAL" ? 500000 : c.severity === "HIGH" ? 150000 : c.severity === "MODERATE" ? 50000 : 10000,
        estimatedActionsCost: c.severity === "CRITICAL" ? 800000 : c.severity === "HIGH" ? 200000 : c.severity === "MODERATE" ? 75000 : 15000,
        actualCost: closedAt ? (c.severity === "HIGH" ? 185000 : c.severity === "MODERATE" ? 62000 : null) : null,
        closedAt,
        closedByUserId: closedAt ? c.actors.closer : null,
        createdByUserId: c.actors.initiator,
        updatedByUserId: c.actors.checker,
        affectedAreas: ["Chlorine Dosing Area", "Compressor Room"],
        affectedProcesses: ["Chemical Dosing", "Equipment Maintenance"],
      },
    });

    // CapaActions
    for (let ai = 0; ai < c.actions.length; ai++) {
      const a = c.actions[ai];
      await prisma.capaAction.create({
        data: {
          capaId: capa.id,
          actionType: a.type,
          description: a.desc,
          ownerUserId: a.owner,
          ownerRole: "MAINTENANCE_HEAD",
          dueDate: new Date(c.detectedAt.getTime() + a.daysFromDetect * 24 * 3_600_000),
          startedAt: a.status !== "PROPOSED" ? new Date(c.detectedAt.getTime() + 1 * 24 * 3_600_000) : null,
          completedAt: a.status === "COMPLETED" ? new Date(c.detectedAt.getTime() + a.daysFromDetect * 24 * 3_600_000 - 24 * 3_600_000) : null,
          status: a.status,
          evidenceOfCompletion: a.status === "COMPLETED" ? "Work order closed in CMMS. Photo evidence attached. Inspector sign-off obtained." : null,
          sortOrder: ai,
        },
      });
    }

    // CapaRootCauses
    for (let ri = 0; ri < c.rootCauses.length; ri++) {
      const r = c.rootCauses[ri];
      await prisma.capaRootCause.create({
        data: {
          capaId: capa.id,
          description: r.desc,
          category: r.cat,
          confidence: r.confidence,
          sortOrder: ri,
        },
      });
    }

    // CapaContributors
    const contributors: { userId: string; role: string; contributionType: string }[] = [
      { userId: c.actors.initiator, role: "HSE Manager", contributionType: "INVESTIGATOR" },
      { userId: c.actors.primaryOwner, role: "Primary Owner", contributionType: "EXECUTOR" },
    ];
    if (c.actors.checker !== c.actors.initiator) {
      contributors.push({ userId: c.actors.checker, role: "Reviewer", contributionType: "REVIEWER" });
    }
    const seen = new Set<string>();
    for (const ct of contributors) {
      const key = `${ct.userId}-${ct.contributionType}`;
      if (!seen.has(key)) {
        seen.add(key);
        await prisma.capaContributor.create({
          data: { capaId: capa.id, userId: ct.userId, role: ct.role, contributionType: ct.contributionType },
        });
      }
    }

    // Workflow
    if (c.state !== "DRAFT") {
      await createCapaWorkflow({
        capaId: capa.id,
        capaNumber,
        capaTitle: c.title,
        severity: c.severity,
        state: c.state,
        detectedAt: c.detectedAt,
        actors: c.actors,
      });
    }

    console.log(`   ✓ ${P}: ${capaNumber}  [${c.state}]  ${c.severity}  — ${c.sourceTypeCode}`);
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Step 21 — CAPA (Universal) seed                         ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  await seedPlant("NW");
  await seedPlant("SW");
  console.log("\n✅  CAPA seed complete.");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
