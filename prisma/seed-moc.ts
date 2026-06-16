// ─────────────────────────────────────────────────────────────────────────────
// Step 22 — MOC (Management of Change): 6 records per plant (NW + SW)
//
// Every ChangeRequest is fully populated:
//   • ChangeRequest (all fields populated)
//   • MocApprovalStep × 2-4 per record
//   • MocDependentRecord × 2-3 per record
//   • MocStateHistory (full audit trail of state transitions)
//   • MocImpactAssessment (1:1, full dimensions JSON)
//   • WorkflowInstance + WorkflowHistory + WorkflowTask
//
// Statuses: closed, executing, approved, impact_assessment_complete, submitted, draft
//
// Idempotent: deletes records with number containing "-DEMO-" before recreating.
// Run: npx tsx prisma/seed-moc.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-08T08:00:00.000Z");
function daysAgo(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; }

// ── Workflow helper ───────────────────────────────────────────────────────────

async function createMocWorkflow(opts: {
  mocId: string; mocNumber: string; mocTitle: string; mocDate: Date;
  status: string; stepsCompleted: number;
  actors: { initiator: string; assessor: string; approver: string; executor: string; verifier: string; closer: string };
}) {
  const { mocId, mocNumber, mocTitle, mocDate, status, stepsCompleted, actors } = opts;

  const def = await prisma.workflowDefinition.findFirstOrThrow({
    where: { module: "MOC" },
    include: { steps: { orderBy: { sequence: "asc" }, select: { id: true, sequence: true, stepType: true, name: true, slaHours: true } } },
  });

  const allDone = stepsCompleted >= def.steps.length;

  const instance = await prisma.workflowInstance.create({
    data: {
      definitionId: def.id,
      module: "MOC",
      recordId: mocId,
      recordNumber: mocNumber,
      initiatedById: actors.initiator,
      initiatedAt: mocDate,
      status: allDone ? "COMPLETED" : "IN_PROGRESS",
      currentStepId: allDone ? null : (def.steps[stepsCompleted]?.id ?? null),
      currentStepName: allDone ? null : (def.steps[stepsCompleted]?.name ?? null),
      completedAt: allDone ? daysAgo(2) : null,
    },
  });

  for (let i = 0; i < Math.min(stepsCompleted, def.steps.length); i++) {
    const step = def.steps[i];
    const actorId =
      step.stepType === "MAKER" ? actors.initiator
        : step.stepType === "CHECKER" ? actors.approver
          : step.stepType === "VERIFIER" ? actors.verifier
            : step.stepType === "CLOSURE" ? actors.closer
              : actors.assessor;
    await prisma.workflowHistory.create({
      data: {
        instanceId: instance.id,
        stepId: step.id,
        stepName: step.name,
        action: "APPROVED",
        performedById: actorId,
        performedAt: new Date(mocDate.getTime() + (i + 1) * 3 * 24 * 3_600_000),
        comments: `${step.name} completed`,
      },
    });
  }

  if (!allDone && stepsCompleted < def.steps.length) {
    const pendingStep = def.steps[stepsCompleted];
    const assigneeId =
      pendingStep.stepType === "CHECKER" ? actors.approver
        : pendingStep.stepType === "VERIFIER" ? actors.verifier
          : pendingStep.stepType === "CLOSURE" ? actors.closer
            : pendingStep.sequence === 2 ? actors.assessor
              : actors.executor;
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
        module: "MOC",
        recordId: mocId,
        recordNumber: mocNumber,
        recordTitle: mocTitle,
        assignedToId: assigneeId,
        dueAt: dueDate,
        status: "PENDING",
        priority: "NORMAL",
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
  const maintHead = await getUser(`maintenance-head.it.${slug}@safeops360.in`);

  // ── Cleanup ─────────────────────────────────────────────────────────────

  const existing = await prisma.changeRequest.findMany({
    where: { plantId: plant.id, number: { contains: "-DEMO-" } },
    select: { id: true },
  });
  if (existing.length) {
    const ids = existing.map(r => r.id);
    const wfInstances = await prisma.workflowInstance.findMany({
      where: { module: "MOC", recordId: { in: ids } },
      select: { id: true },
    });
    const wfIds = wfInstances.map(i => i.id);
    await prisma.workflowTask.deleteMany({ where: { instanceId: { in: wfIds } } });
    await prisma.workflowHistory.deleteMany({ where: { instanceId: { in: wfIds } } });
    await prisma.workflowInstance.deleteMany({ where: { module: "MOC", recordId: { in: ids } } });
    await prisma.changeRequest.deleteMany({ where: { plantId: plant.id, number: { contains: "-DEMO-" } } });
  }

  // ── 6 MOC definitions ──────────────────────────────────────────────────

  const MOCS = [
    {
      num: "0001", status: "closed", classification: "moderate", category: "equipment",
      title: "Replacement of Dye-House Bleaching-Chemical Dosing Valves — Corrosion-Resistant Upgrade",
      description: "Replace 6 cast-iron isolation valves in the dye-house bleaching-chemical (hydrogen peroxide / scouring) dosing system with titanium-lined valves to eliminate recurrence of the corrosion-related vapour leak (ref: CAPA-NW-DEMO-001 corrective action).",
      origin: "incident_corrective_action",
      stepsCompleted: 6,
      initiatedAt: daysAgo(80),
      actualCompletionDate: daysAgo(55),
      classification_risk: { safety: "moderate", environmental: "low", quality: "low", operational: "moderate" },
      affectedProcesses: ["Chemical Dosing", "Bleaching & Scouring"],
      affectedEquipment: [`EQ-${P}-DEMO-01`],
      businessJustification: "Existing CI valves have shown corrosion failures in bleaching-chemical service. Two vapour exposure incidents in 18 months. Upgrading to titanium-lined valves eliminates root cause and meets PESO statutory requirements.",
      expectedBenefits: "Zero recurrence of bleaching-chemical vapour leaks from valve corrosion. PESO compliance. Maintenance interval extended from 6 months to 24 months.",
      costEstimate: 285000,
      pssrRequired: true,
      pssrOutcome: "go",
      actors: { initiator: hse.id, assessor: safetyOfficer.id, approver: plantHead.id, executor: maintHead.id, verifier: hse.id, closer: plantHead.id },
      dependentRecords: [
        { recordType: "hira_entry", recordReference: "HIRA-2026-NW-DEMO-001 Entry 2", impactType: "must_update", impactDescription: "HIRA control measure updated to reflect SS valves. Risk score reduced.", updateStatus: "completed" },
        { recordType: "inspection_schedule", recordReference: "Dye-House Chemical Dosing Monthly Inspection", impactType: "must_update", impactDescription: "Inspection frequency changed from monthly to quarterly for corrosion checks.", updateStatus: "completed" },
        { recordType: "sop", recordReference: "SOP-CHEM-002 Dye-House Chemical Dosing Operations", impactType: "must_update", impactDescription: "SOP updated for new valve type — operating torque and LOTO points changed.", updateStatus: "completed" },
      ],
      stateTransitions: [
        { from: null, to: "draft", at: daysAgo(80) },
        { from: "draft", to: "submitted", at: daysAgo(79) },
        { from: "submitted", to: "impact_assessment_complete", at: daysAgo(76) },
        { from: "impact_assessment_complete", to: "approved", at: daysAgo(73) },
        { from: "approved", to: "executing", at: daysAgo(70) },
        { from: "executing", to: "verifying", at: daysAgo(60) },
        { from: "verifying", to: "closed", at: daysAgo(55) },
      ],
    },
    {
      num: "0002", status: "executing", classification: "major", category: "process",
      title: "Power Boiler Feed Water Treatment Process Change — Chemical Substitution",
      description: "Replace sodium sulphite oxygen scavenger with DEHA (diethylhydroxylamine) in the boiler house & steam utilities boiler feed water treatment to improve corrosion protection and reduce chemical inventory risk.",
      origin: "maintenance_initiative",
      stepsCompleted: 4,
      initiatedAt: daysAgo(45),
      proposedImplementationDate: daysAgo(10),
      targetCompletionDate: daysFromNow(20),
      classification_risk: { safety: "low", environmental: "low", quality: "moderate", operational: "major" },
      affectedProcesses: ["Boiler Operations", "Water Treatment", "Steam Distribution"],
      affectedEquipment: [`EQ-${P}-DEMO-04`],
      businessJustification: "Sodium sulphite is an oxygen scavenger but also a reducing agent that can accelerate pitting corrosion at high temperatures. DEHA provides better protection and has lower toxicity profile.",
      expectedBenefits: "Improved boiler tube life (expected +40%). Reduced chemical storage hazard. Operational cost saving estimated ₹3.2L/year.",
      costEstimate: 125000,
      pssrRequired: false,
      pssrOutcome: null,
      actors: { initiator: supervisor.id, assessor: safetyOfficer.id, approver: plantHead.id, executor: maintHead.id, verifier: hse.id, closer: plantHead.id },
      dependentRecords: [
        { recordType: "training_program", recordReference: "Boiler Chemical Treatment — Operator Refresher", impactType: "must_create", impactDescription: "New training required for DEHA handling, dosing rates, and emergency response.", updateStatus: "in_progress" },
        { recordType: "hira_entry", recordReference: "HIRA-2026-NW-DEMO-002 Entry 1", impactType: "must_update", impactDescription: "Chemical hazard profile updated for DEHA. SDS reviewed. Risk controls updated.", updateStatus: "completed" },
        { recordType: "sop", recordReference: "SOP-UTIL-004 Boiler Chemical Dosing", impactType: "must_update", impactDescription: "Dosing rates, target concentrations, and emergency spill response updated for DEHA.", updateStatus: "in_progress" },
      ],
      stateTransitions: [
        { from: null, to: "draft", at: daysAgo(45) },
        { from: "draft", to: "submitted", at: daysAgo(44) },
        { from: "submitted", to: "impact_assessment_complete", at: daysAgo(41) },
        { from: "impact_assessment_complete", to: "approved", at: daysAgo(38) },
        { from: "approved", to: "executing", at: daysAgo(30) },
      ],
    },
    {
      num: "0003", status: "approved", classification: "minor", category: "organizational",
      title: "Shift Structure Change — 4-Shift Rotation to 3-Shift Fixed Roster",
      description: "Change sewing / stitching line operations from a rotating 4-shift pattern (Day/Eve/Night/Off) to a fixed 3-shift schedule to reduce fatigue incidents and improve handover consistency.",
      origin: "operational_request",
      stepsCompleted: 3,
      initiatedAt: daysAgo(25),
      proposedImplementationDate: daysFromNow(30),
      targetCompletionDate: daysFromNow(60),
      classification_risk: { safety: "low", environmental: "low", quality: "low", operational: "low" },
      affectedProcesses: ["Sewing Line Operations", "Shift Management"],
      affectedEquipment: [],
      businessJustification: "Rotating 4-shift pattern results in operators working 3 night shifts in a row fortnightly. Fatigue incidents increased 40% in Q4 2025 vs Q4 2024. Fixed roster reduces circadian disruption.",
      expectedBenefits: "Reduced fatigue-related incidents. Better handover quality. Improved worker satisfaction.",
      costEstimate: 0,
      pssrRequired: false,
      pssrOutcome: null,
      actors: { initiator: hse.id, assessor: hse.id, approver: plantHead.id, executor: supervisor.id, verifier: hse.id, closer: plantHead.id },
      dependentRecords: [
        { recordType: "competency_requirement", recordReference: "Shift Supervisor — Competency Matrix", impactType: "must_review", impactDescription: "Competency matrix to be reviewed for additional handover skills training.", updateStatus: "not_started" },
        { recordType: "role_definition", recordReference: "Sewing Machine Operator Role Profile", impactType: "must_update", impactDescription: "Role profile updated to reflect fixed shift hours and responsibilities.", updateStatus: "in_progress" },
      ],
      stateTransitions: [
        { from: null, to: "draft", at: daysAgo(25) },
        { from: "draft", to: "submitted", at: daysAgo(24) },
        { from: "submitted", to: "impact_assessment_complete", at: daysAgo(21) },
        { from: "impact_assessment_complete", to: "approved", at: daysAgo(18) },
      ],
    },
    {
      num: "0004", status: "impact_assessment_complete", classification: "minor", category: "temporary",
      title: "Temporary Bypass — Cooling Tower Level Transmitter LT-305",
      description: "Temporary bypass of LT-305 cooling tower basin level transmitter while replacement transmitter is procured. Manual level checks every 2 hours by operator during bypass period.",
      origin: "maintenance_initiative",
      stepsCompleted: 2,
      initiatedAt: daysAgo(5),
      isTemporary: true,
      temporaryExpiryDate: daysFromNow(25),
      proposedImplementationDate: daysAgo(4),
      targetCompletionDate: daysFromNow(25),
      classification_risk: { safety: "low", environmental: "low", quality: "low", operational: "low" },
      affectedProcesses: ["Cooling Water System"],
      affectedEquipment: [`EQ-${P}-DEMO-08`],
      businessJustification: "LT-305 failed on 03 Jun 2026. Spare transmitter procurement lead time is 3–4 weeks. Cooling tower cannot be shut down without affecting production. Manual monitoring is an adequate interim control.",
      expectedBenefits: "Maintains production continuity. Manual monitoring compensates for transmitter bypass during replacement procurement.",
      costEstimate: 0,
      pssrRequired: false,
      pssrOutcome: null,
      actors: { initiator: maintHead.id, assessor: safetyOfficer.id, approver: plantHead.id, executor: maintHead.id, verifier: hse.id, closer: plantHead.id },
      dependentRecords: [
        { recordType: "inspection_schedule", recordReference: "Cooling Tower Level Check Log", impactType: "must_create", impactDescription: "Manual 2-hourly level check log created for duration of bypass. Checked by Control Room operator.", updateStatus: "completed" },
        { recordType: "sop", recordReference: "SOP-UTIL-009 Cooling Tower Operations", impactType: "must_update", impactDescription: "Temporary note added: manual level check procedure appended while LT-305 bypassed.", updateStatus: "completed" },
      ],
      stateTransitions: [
        { from: null, to: "draft", at: daysAgo(5) },
        { from: "draft", to: "submitted", at: daysAgo(4) },
        { from: "submitted", to: "impact_assessment_complete", at: daysAgo(3) },
      ],
    },
    {
      num: "0005", status: "submitted", classification: "moderate", category: "procedural",
      title: "LOTO Procedure Revision — MCC Panel MCC-01 to MCC-06",
      description: "Revise and reissue LOTO procedures for 6 MCC panels following the near-miss arc flash incident (ref NM-NW-PROMO-001). All procedures to include panel-specific isolation diagram and mandatory buddy-check step.",
      origin: "incident_corrective_action",
      stepsCompleted: 1,
      initiatedAt: daysAgo(10),
      proposedImplementationDate: daysFromNow(21),
      targetCompletionDate: daysFromNow(45),
      classification_risk: { safety: "moderate", environmental: "low", quality: "low", operational: "low" },
      affectedProcesses: ["Electrical LOTO", "Maintenance Isolation"],
      affectedEquipment: [`EQ-${P}-DEMO-10`],
      businessJustification: "Near-miss investigation identified LOTO procedure for MCC panels had not been updated after panel upgrades in 2024. Revised procedures with current isolation diagrams and mandatory buddy-check will prevent recurrence.",
      expectedBenefits: "Elimination of outdated LOTO procedure risk. Consistent buddy-check enforcement across all shifts.",
      costEstimate: 15000,
      pssrRequired: false,
      pssrOutcome: null,
      actors: { initiator: hse.id, assessor: safetyOfficer.id, approver: plantHead.id, executor: supervisor.id, verifier: hse.id, closer: plantHead.id },
      dependentRecords: [
        { recordType: "sop", recordReference: "SOP-ELC-001 to SOP-ELC-006 (MCC Panel LOTO)", impactType: "must_update", impactDescription: "6 LOTO procedures to be revised with current single-line diagrams and buddy-check step added.", updateStatus: "not_started" },
        { recordType: "training_program", recordReference: "Electrical LOTO Awareness Refresher", impactType: "must_create", impactDescription: "One-hour refresher to be delivered to all maintenance staff before revised procedures go live.", updateStatus: "not_started" },
        { recordType: "competency_requirement", recordReference: "Electrician — MCC Panel Authorisation", impactType: "must_review", impactDescription: "Review authorisation list: confirm all panel-specific competencies are current.", updateStatus: "not_started" },
      ],
      stateTransitions: [
        { from: null, to: "draft", at: daysAgo(10) },
        { from: "draft", to: "submitted", at: daysAgo(9) },
      ],
    },
    {
      num: "0006", status: "draft", classification: "major", category: "equipment",
      title: "Forklift Fleet Electrification — Diesel to Lithium-Ion Battery Forklifts",
      description: "Replace 4 diesel-powered fabric-roll handling forklifts with lithium-ion battery electric models. Includes installation of charging infrastructure, ventilation review, and fire protection assessment.",
      origin: "operational_request",
      stepsCompleted: 0,
      initiatedAt: daysAgo(2),
      proposedImplementationDate: daysFromNow(90),
      targetCompletionDate: daysFromNow(120),
      classification_risk: { safety: null, environmental: null, quality: null, operational: null },
      affectedProcesses: ["Warehouse & Logistics", "Material Handling"],
      affectedEquipment: [`EQ-${P}-DEMO-07`],
      businessJustification: "Diesel forklifts contribute to indoor air quality issues in the enclosed finished-goods warehouse. Electrification aligns with company sustainability targets and eliminates diesel emission risk in classified hazardous area.",
      expectedBenefits: "Elimination of diesel emissions. Lower operating cost (electricity vs diesel). Extended forklift duty cycle. ESG carbon footprint reduction.",
      costEstimate: 2800000,
      pssrRequired: false,
      pssrOutcome: null,
      actors: { initiator: supervisor.id, assessor: hse.id, approver: plantHead.id, executor: maintHead.id, verifier: hse.id, closer: plantHead.id },
      dependentRecords: [
        { recordType: "hira_entry", recordReference: "Forklift Operations HIRA", impactType: "must_update", impactDescription: "HIRA to be updated for lithium-ion battery hazards (thermal runaway, charging area classification).", updateStatus: "not_started" },
        { recordType: "inspection_schedule", recordReference: "Forklift Pre-Operational Checklist", impactType: "must_update", impactDescription: "Checklist to be revised for electric forklift — battery state-of-charge, connector integrity, charging area checks.", updateStatus: "not_started" },
      ],
      stateTransitions: [
        { from: null, to: "draft", at: daysAgo(2) },
      ],
    },
  ];

  for (const m of MOCS) {
    const mocNumber = `MOC-2026-${P}-DEMO-${m.num}`;

    const moc = await prisma.changeRequest.create({
      data: {
        plantId: plant.id,
        number: mocNumber,
        title: m.title,
        description: m.description,
        category: m.category,
        classification: m.classification,
        isTemporary: (m as any).isTemporary ?? false,
        temporaryExpiryDate: (m as any).temporaryExpiryDate ?? null,
        origin: m.origin,
        affectedDepartments: [],
        affectedLocations: [plant.id],
        affectedEquipmentIds: m.affectedEquipment,
        affectedProcesses: m.affectedProcesses,
        affectedRoles: [],
        initiatedByUserId: m.actors.initiator,
        initiatedAt: m.initiatedAt,
        businessJustification: m.businessJustification,
        expectedBenefits: m.expectedBenefits,
        costEstimate: m.costEstimate || null,
        proposedImplementationDate: (m as any).proposedImplementationDate ?? null,
        targetCompletionDate: (m as any).targetCompletionDate ?? null,
        actualImplementationDate: m.status === "closed" ? daysAgo(60) : null,
        actualCompletionDate: m.status === "closed" ? daysAgo(55) : null,
        status: m.status,
        safetyRiskLevel: (m.classification_risk.safety as string) ?? null,
        environmentalRiskLevel: (m.classification_risk.environmental as string) ?? null,
        qualityRiskLevel: (m.classification_risk.quality as string) ?? null,
        operationalRiskLevel: (m.classification_risk.operational as string) ?? null,
        overallResidualRisk: m.status === "closed" || m.status === "executing" ? "low" : null,
        pssrRequired: m.pssrRequired,
        pssrOutcome: m.pssrOutcome ?? null,
        pssrConductedAt: m.pssrRequired && m.status === "closed" ? daysAgo(58) : null,
        returnToNormalCompletedAt: null,
        versionNumber: 1,
      },
    });

    // MocApprovalSteps
    const approvalChain = [
      { sequence: 1, role: "HSE_MANAGER", userId: m.actors.assessor, decision: m.stepsCompleted >= 2 ? "approved" : "pending" },
      { sequence: 2, role: "PLANT_HEAD", userId: m.actors.approver, decision: m.stepsCompleted >= 3 ? "approved" : "pending" },
    ];
    if (m.classification === "major" || m.classification === "critical") {
      approvalChain.push({ sequence: 3, role: "CORPORATE_HSE", userId: m.actors.approver, decision: m.stepsCompleted >= 3 ? "approved" : "pending" });
    }
    for (const step of approvalChain) {
      await prisma.mocApprovalStep.create({
        data: {
          changeRequestId: moc.id,
          sequence: step.sequence,
          role: step.role,
          specificUserId: step.userId,
          isRequired: true,
          decision: step.decision,
          decidedAt: step.decision === "approved" ? new Date(m.initiatedAt.getTime() + step.sequence * 3 * 24 * 3_600_000) : null,
          decidedByUserId: step.decision === "approved" ? step.userId : null,
          rationale: step.decision === "approved" ? "Change justified; risk controls adequate. Impact assessment reviewed and approved." : null,
        },
      });
    }

    // MocDependentRecords
    for (const dr of m.dependentRecords) {
      await prisma.mocDependentRecord.create({
        data: {
          changeRequestId: moc.id,
          recordType: dr.recordType,
          recordReference: dr.recordReference,
          impactType: dr.impactType,
          impactDescription: dr.impactDescription,
          updateStatus: dr.updateStatus,
          updatedAt: dr.updateStatus === "completed" ? daysAgo(50 - MOCS.indexOf(m) * 5) : null,
          updatedByUserId: dr.updateStatus === "completed" ? m.actors.executor : null,
          updateEvidence: dr.updateStatus === "completed" ? "Document revision uploaded to DMS. Change effective date confirmed." : null,
        },
      });
    }

    // MocStateHistory
    for (const t of m.stateTransitions) {
      await prisma.mocStateHistory.create({
        data: {
          changeRequestId: moc.id,
          fromState: t.from ?? null,
          toState: t.to,
          transitionedAt: t.at,
          transitionedByUserId: t.to === "draft" ? m.actors.initiator
            : t.to === "submitted" ? m.actors.initiator
              : t.to === "impact_assessment_complete" ? m.actors.assessor
                : t.to === "approved" ? m.actors.approver
                  : t.to === "executing" ? m.actors.executor
                    : t.to === "verifying" ? m.actors.verifier
                      : t.to === "closed" ? m.actors.closer
                        : m.actors.initiator,
          rationale: `State transitioned to ${t.to}`,
        },
      });
    }

    // MocImpactAssessment (skip for draft with no assessment)
    if (m.stepsCompleted >= 2) {
      await prisma.mocImpactAssessment.create({
        data: {
          changeRequestId: moc.id,
          assessorUserId: m.actors.assessor,
          assessorRole: "SAFETY_OFFICER",
          methodology: "checklist_based",
          dimensions: {
            safety: {
              riskLevel: m.classification_risk.safety ?? "low",
              hazardsIntroduced: m.category === "equipment" ? ["New equipment introduction", "Commissioning activities"] : ["Procedural deviation during transition"],
              mitigationMeasures: ["Updated HIRA", "Revised SOPs", "Training completed"],
              residualRisk: "low"
            },
            environmental: {
              riskLevel: m.classification_risk.environmental ?? "low",
              impactAssessed: true,
              notes: "No significant environmental impact identified."
            },
            quality: {
              riskLevel: m.classification_risk.quality ?? "low",
              qualityPlanUpdate: m.classification === "major",
              notes: m.classification === "major" ? "Quality plan review required before implementation." : "No quality system impact."
            },
            operations: {
              riskLevel: m.classification_risk.operational ?? "low",
              downtime: m.category === "equipment" ? "4–6 hours planned shutdown" : "No planned downtime",
              productionImpact: "Minimal — change scoped to off-peak window",
              rollbackPlan: "Revert to original configuration within 2 hours if issues encountered"
            }
          },
          recommendedClassification: m.classification,
          pssrRequired: m.pssrRequired,
          rollbackPlanRequired: m.classification === "major" || m.classification === "critical",
          assessmentDate: new Date(m.initiatedAt.getTime() + 3 * 24 * 3_600_000),
          reviewedByUserId: m.actors.approver,
          reviewedAt: m.stepsCompleted >= 3 ? new Date(m.initiatedAt.getTime() + 6 * 24 * 3_600_000) : null,
        },
      });
    }

    // Workflow
    if (m.stepsCompleted > 0) {
      await createMocWorkflow({
        mocId: moc.id,
        mocNumber,
        mocTitle: m.title,
        mocDate: m.initiatedAt,
        status: m.status,
        stepsCompleted: m.stepsCompleted,
        actors: m.actors,
      });
    }

    console.log(`   ✓ ${P}: ${mocNumber}  [${m.status}]  ${m.classification}  ${m.category}`);
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Step 22 — MOC (Management of Change) seed               ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  await seedPlant("NW");
  await seedPlant("SW");
  console.log("\n✅  MOC seed complete.");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
