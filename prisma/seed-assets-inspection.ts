// ─────────────────────────────────────────────────────────────────────────────
// Step 20 — Assets & Inspection
//
// Global (once):
//   • 5 InspectionType records
//   • 2 ChecklistTemplate + 8-12 ChecklistItem each
//   • EquipmentInspectionType links
//
// Per plant (NW + SW):
//   • 10 Equipment records (various categories + criticality)
//   • 10 Inspection records (COMPLETED/IN_PROGRESS/SCHEDULED/OVERDUE)
//     – InspectionItemResult for COMPLETED inspections (full checklist)
//     – InspectionFinding for FAIL/PARTIAL inspections
//     – InspectionFindingCapa for each finding
//   • WorkflowInstance + WorkflowHistory + WorkflowTask (INSPECTION module)
//
// Idempotent: cleans equipment/inspections with "-DEMO-" in code/number.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-07T08:00:00.000Z");
function daysAgo(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; }
function hoursAfter(base: Date, h: number) { return new Date(base.getTime() + h * 3_600_000); }

// ── Workflow helper ───────────────────────────────────────────────────────────

async function createInspectionWorkflow(opts: {
  inspId: string; inspNumber: string; inspTitle: string; inspDate: Date;
  inspStatus: string; stepsCompleted: number;
  actors: { initiator: string; inspector: string; reviewer: string; closer: string };
}) {
  const { inspId, inspNumber, inspTitle, inspDate, inspStatus, stepsCompleted, actors } = opts;
  const def = await prisma.workflowDefinition.findFirstOrThrow({
    where: { module: "INSPECTION", isActive: true },
    include: { steps: { orderBy: { sequence: "asc" }, select: { id: true, sequence: true, stepType: true, name: true, slaHours: true } } },
  });
  const allSteps = def.steps;
  const completed = allSteps.slice(0, stepsCompleted);
  const currentStep = stepsCompleted < allSteps.length ? allSteps[stepsCompleted] : null;
  const isComplete = ["COMPLETED", "CANCELLED"].includes(inspStatus);

  const instance = await prisma.workflowInstance.create({
    data: {
      definitionId: def.id, module: "INSPECTION", recordId: inspId, recordNumber: inspNumber,
      status: isComplete ? "COMPLETED" : "IN_PROGRESS",
      currentStepId: currentStep?.id ?? null, currentStepName: currentStep?.name ?? null,
      initiatedById: actors.initiator, initiatedAt: inspDate,
      completedAt: isComplete ? hoursAfter(inspDate, stepsCompleted * 24) : null,
    },
  });

  for (let i = 0; i < completed.length; i++) {
    const step = completed[i];
    const actor = step.stepType === "MAKER" ? actors.initiator
      : step.stepType === "ASSIGNEE_TASK" ? actors.inspector
      : step.stepType === "VERIFIER" ? actors.reviewer
      : actors.closer;
    await prisma.workflowHistory.create({
      data: {
        instanceId: instance.id, stepId: step.id, stepName: step.name,
        action: step.stepType === "MAKER" ? "INITIATED" : step.stepType === "ASSIGNEE_TASK" ? "EXECUTED" : step.stepType === "CLOSURE" ? "COMPLETED" : "APPROVED",
        performedById: actor, performedAt: hoursAfter(inspDate, (i + 1) * 24),
        fromStatus: i === 0 ? null : "IN_PROGRESS",
        toStatus: i === completed.length - 1 && isComplete ? "COMPLETED" : "IN_PROGRESS",
        comments: i === 0 ? `${inspNumber} auto-scheduled.` : step.stepType === "ASSIGNEE_TASK" ? "Checklist completed. Results recorded." : step.stepType === "CLOSURE" ? "Inspection closed. All findings actioned." : `Step approved: ${step.name}.`,
      },
    });
  }

  if (!isComplete && currentStep) {
    await prisma.workflowTask.create({
      data: {
        instanceId: instance.id, stepId: currentStep.id, stepName: currentStep.name,
        taskType: currentStep.stepType === "ASSIGNEE_TASK" ? "EXECUTION" : currentStep.stepType === "VERIFIER" ? "VERIFICATION" : "APPROVAL",
        module: "INSPECTION", recordId: inspId, recordNumber: inspNumber, recordTitle: inspTitle,
        assignedToId: currentStep.stepType === "ASSIGNEE_TASK" ? actors.inspector : currentStep.stepType === "VERIFIER" ? actors.reviewer : actors.closer,
        assignedAt: hoursAfter(inspDate, stepsCompleted * 24),
        dueAt: hoursAfter(inspDate, stepsCompleted * 24 + (currentStep.slaHours ?? 72)),
        status: "PENDING", priority: "NORMAL",
      },
    });
  }
}

// ── Global masters: InspectionType + ChecklistTemplate ───────────────────────

async function ensureGlobalMasters() {
  // Idempotent: use findOrCreate by code
  const createTypeIfMissing = async (data: Parameters<typeof prisma.inspectionType.create>[0]["data"]) => {
    const existing = await prisma.inspectionType.findUnique({ where: { code: data.code as string } });
    return existing ?? await prisma.inspectionType.create({ data });
  };

  const [itMonthly, itStatPV, itPreOp, itPostInc, itCraneWeekly] = await Promise.all([
    createTypeIfMissing({ code: "IT-MONTHLY-SAFETY", name: "Monthly Safety Inspection", description: "Routine monthly inspection covering all statutory and safety-critical equipment.", category: "ROUTINE", defaultFrequency: "MONTHLY", applicableEquipmentCategories: ["PRESSURE_VESSEL", "FIRE_SYSTEM", "CRANE", "ELECTRICAL", "UTILITIES"], isStatutory: false, retentionYears: 5 }),
    createTypeIfMissing({ code: "IT-STAT-PV-ANNUAL", name: "Annual Pressure Vessel Statutory Inspection", description: "Annual statutory inspection of pressure vessels as required under Factories Act / IBR.", category: "STATUTORY", defaultFrequency: "ANNUAL", applicableEquipmentCategories: ["PRESSURE_VESSEL", "BOILER"], isStatutory: true, statutoryReference: "Factories Act s.31 — inspection of pressure vessels", regulatoryAuthority: "Chief Inspector of Factories", statutoryFormType: "Form-23", requiresCertifiedInspector: true, requiredCertificationCodes: ["IBR_CE"], retentionYears: 10 }),
    createTypeIfMissing({ code: "IT-PRE-OP-CRANE", name: "Pre-Operational Crane Check", description: "Daily pre-shift inspection of overhead and EOT cranes by certified operator.", category: "PRE_OPERATIONAL", defaultFrequency: "DAILY", applicableEquipmentCategories: ["CRANE"], isStatutory: false, retentionYears: 2 }),
    createTypeIfMissing({ code: "IT-POST-INCIDENT", name: "Post-Incident Safety Inspection", description: "Inspection of equipment and area following a safety incident or near miss involving that equipment.", category: "POST_INCIDENT", defaultFrequency: "DAILY", applicableEquipmentCategories: ["PRESSURE_VESSEL", "CRANE", "ELECTRICAL", "UTILITIES", "FIRE_SYSTEM"], isStatutory: false, retentionYears: 7 }),
    createTypeIfMissing({ code: "IT-WEEKLY-FIRE", name: "Weekly Fire System Inspection", description: "Weekly check of fire detection, suppression systems, extinguishers, and emergency exits.", category: "ROUTINE", defaultFrequency: "WEEKLY", applicableEquipmentCategories: ["FIRE_SYSTEM"], isStatutory: true, statutoryReference: "Factories Act s.38 — precautions in case of fire", retentionYears: 5 }),
  ]);

  // Checklist Templates
  const createTemplateIfMissing = async (code: string, name: string, itId: string, items: { sequence: number; sectionTitle?: string; itemText: string; itemType: string; isCritical?: boolean; guidanceText?: string; minValue?: number; maxValue?: number; units?: string }[]) => {
    const existing = await prisma.checklistTemplate.findUnique({ where: { code } });
    if (existing) return existing;
    const template = await prisma.checklistTemplate.create({ data: { code, name, inspectionTypeId: itId, version: 1, applicableEquipmentCategories: [], approvalStatus: "APPROVED" } });
    for (const item of items) {
      await prisma.checklistItem.create({ data: { templateId: template.id, sequence: item.sequence, sectionTitle: item.sectionTitle, itemText: item.itemText, itemType: item.itemType as any, isCritical: item.isCritical ?? false, guidanceText: item.guidanceText, minValue: item.minValue, maxValue: item.maxValue, units: item.units } });
    }
    return template;
  };

  const clMonthly = await createTemplateIfMissing("CL-MONTHLY-GENERAL-001", "General Monthly Safety Inspection Checklist", itMonthly.id, [
    { sequence: 1, sectionTitle: "A. Housekeeping & Access", itemText: "All walkways and emergency exits clear of obstructions", itemType: "PASS_FAIL", isCritical: true, guidanceText: "Check minimum 1.2m clear width on all emergency exit routes." },
    { sequence: 2, sectionTitle: "A. Housekeeping & Access", itemText: "Chemical storage areas clean, segregated, labelled, and bunded", itemType: "PASS_FAIL", guidanceText: "Verify secondary containment capacity ≥110% of largest vessel." },
    { sequence: 3, sectionTitle: "A. Housekeeping & Access", itemText: "Spill kits present and stocked at designated locations", itemType: "PASS_FAIL" },
    { sequence: 4, sectionTitle: "B. Fire & Emergency Equipment", itemText: "Fire extinguisher pressure indicator in green zone", itemType: "PASS_FAIL", isCritical: true },
    { sequence: 5, sectionTitle: "B. Fire & Emergency Equipment", itemText: "Emergency eyewash station functional and flushed (within last 7 days)", itemType: "PASS_FAIL", isCritical: true, guidanceText: "Eyewash must flow clear water for ≥15 minutes. Check flushing log." },
    { sequence: 6, sectionTitle: "B. Fire & Emergency Equipment", itemText: "Emergency shower pressure and flow tested", itemType: "PASS_FAIL" },
    { sequence: 7, sectionTitle: "C. Equipment & Machinery", itemText: "All rotating equipment guards in place and secured", itemType: "PASS_FAIL", isCritical: true },
    { sequence: 8, sectionTitle: "C. Equipment & Machinery", itemText: "Pressure relief valve inspection — no visible damage or bypass", itemType: "PASS_FAIL", isCritical: true },
    { sequence: 9, sectionTitle: "C. Equipment & Machinery", itemText: "Pressure gauge reading within normal operating range", itemType: "NUMERIC", units: "bar g", minValue: 0.0, maxValue: 10.0, guidanceText: "Record actual reading. Normal range is equipment-specific — refer to operating procedure." },
    { sequence: 10, sectionTitle: "D. Electrical & Instrumentation", itemText: "Electrical panels: no open knockouts, covers in place, no visible damage", itemType: "PASS_FAIL", isCritical: true },
    { sequence: 11, sectionTitle: "D. Electrical & Instrumentation", itemText: "Earthing and bonding connections on storage vessels — visual check", itemType: "PASS_FAIL" },
    { sequence: 12, sectionTitle: "E. Administrative", itemText: "MSDS/SDS available and current for all chemicals in the area", itemType: "PASS_FAIL" },
    { sequence: 13, sectionTitle: "E. Administrative", itemText: "Permit to Work board — all permits current and properly issued", itemType: "PASS_FAIL", isCritical: true },
    { sequence: 14, sectionTitle: "E. Administrative", itemText: "Inspector observations and additional comments", itemType: "TEXT", guidanceText: "Record any additional observations not captured in the checklist above." },
  ]);

  const clCrane = await createTemplateIfMissing("CL-CRANE-PREOP-001", "Overhead Crane Pre-Operational Inspection Checklist", itPreOp.id, [
    { sequence: 1, sectionTitle: "A. Structural", itemText: "Crane bridge and end carriages — no cracks, deformation, or corrosion", itemType: "PASS_FAIL", isCritical: true },
    { sequence: 2, sectionTitle: "A. Structural", itemText: "Runway rails — no misalignment, missing fishbolts, or rail damage", itemType: "PASS_FAIL", isCritical: true },
    { sequence: 3, sectionTitle: "B. Hoisting Mechanism", itemText: "Wire rope condition — no broken wires, kinks, or corrosion", itemType: "PASS_FAIL", isCritical: true, guidanceText: "Reject if >2 broken wires per rope lay length or any kink/crush present." },
    { sequence: 4, sectionTitle: "B. Hoisting Mechanism", itemText: "Hook condition — no visible cracks, throat opening within 10% of specification", itemType: "PASS_FAIL", isCritical: true },
    { sequence: 5, sectionTitle: "B. Hoisting Mechanism", itemText: "Hook latch operative and spring-loaded", itemType: "PASS_FAIL", isCritical: true },
    { sequence: 6, sectionTitle: "B. Hoisting Mechanism", itemText: "Upper limit switch function test (raise to upper limit — verify cut-out)", itemType: "PASS_FAIL", isCritical: true },
    { sequence: 7, sectionTitle: "C. Travel Motion", itemText: "Long travel and cross travel controls — directional response correct", itemType: "PASS_FAIL" },
    { sequence: 8, sectionTitle: "C. Travel Motion", itemText: "End stop buffers present and undamaged on both axes", itemType: "PASS_FAIL" },
    { sequence: 9, sectionTitle: "D. Electrical", itemText: "Pendant controls — all buttons labelled, no damaged leads or connectors", itemType: "PASS_FAIL" },
    { sequence: 10, sectionTitle: "D. Electrical", itemText: "Emergency stop function tested — crane halts immediately", itemType: "PASS_FAIL", isCritical: true },
    { sequence: 11, sectionTitle: "E. Load Indicator & SWL", itemText: "SWL plate visible and legible on bridge and hook block", itemType: "PASS_FAIL" },
    { sequence: 12, sectionTitle: "F. Sign-off", itemText: "Crane safe to operate — operator declaration", itemType: "CHECKBOX", isCritical: true },
  ]);

  return { itMonthly, itStatPV, itPreOp, itPostInc, itCraneWeekly, clMonthly, clCrane };
}

// ── Equipment definitions ─────────────────────────────────────────────────────

const EQUIPMENT_DEFS = [
  { idx: "01", name: "Reactive Dye Dosing System — Dye House", category: "PROCESS_EQUIPMENT", sub: "Chemical Dosing", criticality: "A", freq: "MONTHLY", make: "Grundfos", model: "DME 60-10", serial: "GFD-2021-4421", mfr: "Grundfos A/S" },
  { idx: "02", name: "EOT Crane 5T — Dye House Bay", category: "CRANE", sub: "Overhead EOT Crane", criticality: "A", freq: "WEEKLY", make: "Electromech", model: "EOT-5T-20M", serial: "EM-OHC-2019-1143", mfr: "Electromech Industries" },
  { idx: "03", name: "Fire Water Pump FW-01 (Main)", category: "FIRE_SYSTEM", sub: "Fire Pump", criticality: "A", freq: "WEEKLY", make: "Kirloskar", model: "KDS-2200-1450", serial: "KIR-FWP-2018-2267", mfr: "Kirloskar Brothers Ltd" },
  { idx: "04", name: "Multi-fuel Boiler BLR-01 (15 Bar)", category: "PRESSURE_VESSEL", sub: "Boiler", criticality: "A", freq: "MONTHLY", make: "Thermax", model: "TDBX-3000", serial: "THX-BLR-2017-0891", mfr: "Thermax Ltd" },
  { idx: "05", name: "Compressed Air Receiver AR-101 (10 Bar)", category: "PRESSURE_VESSEL", sub: "Air Receiver", criticality: "B", freq: "MONTHLY", make: "Atlas Copco", model: "GAe-11-10", serial: "ACO-RCV-2020-3312", mfr: "Atlas Copco India" },
  { idx: "06", name: "DG Set 500kVA — Emergency Power", category: "ELECTRICAL", sub: "Diesel Generator", criticality: "A", freq: "WEEKLY", make: "Cummins", model: "C500D5", serial: "CUM-DG-2020-7743", mfr: "Cummins India" },
  { idx: "07", name: "Fork Lift Truck 3T — FLT-01 (Fabric Roll Handling)", category: "MOBILE_EQUIPMENT", sub: "Forklift", criticality: "B", freq: "DAILY", make: "Godrej", model: "EFG-3T", serial: "GDJ-FLT-2022-0441", mfr: "Godrej Material Handling" },
  { idx: "08", name: "Cooling Tower CT-01 (Evaporative)", category: "UTILITIES", sub: "Cooling Tower", criticality: "B", freq: "MONTHLY", make: "Paharpur", model: "Crossflow-2500", serial: "PPR-CT-2018-1891", mfr: "Paharpur Cooling Towers" },
  { idx: "09", name: "Soft-flow Dyeing Machine SFD-201 (Dye House)", category: "PRESSURE_VESSEL", sub: "Process Vessel", criticality: "A", freq: "MONTHLY", make: "Bharat Heavy Electricals", model: "BHE-PV-2000-14B", serial: "BHEL-PV-2016-0077", mfr: "BHEL" },
  { idx: "10", name: "Electrical MCC Panel — Knitting Hall Drive", category: "ELECTRICAL", sub: "Motor Control Centre", criticality: "A", freq: "MONTHLY", make: "L&T", model: "3W3-MCC-400A", serial: "LT-MCC-2021-5512", mfr: "Larsen & Toubro" },
];

// ── Inspection scenarios ──────────────────────────────────────────────────────

function getInspectionScenarios(P: string) {
  return [
    { seq: "001", eqIdx: "01", typeCode: "IT-MONTHLY-SAFETY", clCode: "CL-MONTHLY-GENERAL-001", sched: daysAgo(32), completed: daysAgo(32), status: "COMPLETED", result: "Pass", inspector: "safety-officer", findings: [] },
    { seq: "002", eqIdx: "02", typeCode: "IT-PRE-OP-CRANE", clCode: "CL-CRANE-PREOP-001", sched: daysAgo(3), completed: daysAgo(3), status: "COMPLETED", result: "Fail",
      findings: [
        { title: "Wire rope — 3 broken wires found at drum end", desc: "Pre-operational inspection identified 3 broken wires within one rope lay length at the drum end. Exceeds rejection criterion of 2 broken wires per lay length.", severity: "CRITICAL", capas: [{ type: "CORRECTIVE_ACTION", desc: "Wire rope to be replaced immediately before any further crane operations. SWL 5T — crane OUT OF SERVICE until wire rope replacement and re-inspection." }] },
        { title: "Upper limit switch function test — failed", desc: "Upper limit switch did not cut out hoist travel when tested. Hoist continued to travel past upper limit position.", severity: "CRITICAL", capas: [{ type: "CORRECTIVE_ACTION", desc: "Limit switch to be replaced and tested by certified electrician before crane is returned to service." }] },
      ] },
    { seq: "003", eqIdx: "03", typeCode: "IT-WEEKLY-FIRE", clCode: "CL-MONTHLY-GENERAL-001", sched: daysAgo(7), completed: daysAgo(7), status: "COMPLETED", result: "Pass", inspector: "safety-officer", findings: [] },
    { seq: "004", eqIdx: "04", typeCode: "IT-MONTHLY-SAFETY", clCode: "CL-MONTHLY-GENERAL-001", sched: daysAgo(28), completed: daysAgo(27), status: "COMPLETED", result: "Partial",
      findings: [
        { title: "Pressure gauge PG-BLR-01 — glass cracked, reading unreadable", desc: "Pressure gauge PG-BLR-01 on the steam header shows a cracked face glass. Actual reading is not visible. Safety concern — operating pressure cannot be confirmed visually from the front.", severity: "HIGH", capas: [{ type: "CORRECTIVE_ACTION", desc: "Pressure gauge to be replaced with calibrated unit. Temporary: rely on secondary gauge PG-BLR-02 until replacement." }] },
      ] },
    { seq: "005", eqIdx: "05", typeCode: "IT-STAT-PV-ANNUAL", clCode: "CL-MONTHLY-GENERAL-001", sched: daysAgo(180), completed: daysAgo(179), status: "COMPLETED", result: "Pass", inspector: "safety-officer", findings: [], statutory: true },
    { seq: "006", eqIdx: "06", typeCode: "IT-MONTHLY-SAFETY", clCode: "CL-MONTHLY-GENERAL-001", sched: daysAgo(5), completed: null, status: "IN_PROGRESS", result: null, inspector: "maintenance-head", findings: [] },
    { seq: "007", eqIdx: "07", typeCode: "IT-PRE-OP-CRANE", clCode: "CL-CRANE-PREOP-001", sched: daysAgo(1), completed: null, status: "SCHEDULED", result: null, inspector: "safety-officer", findings: [] },
    { seq: "008", eqIdx: "08", typeCode: "IT-MONTHLY-SAFETY", clCode: "CL-MONTHLY-GENERAL-001", sched: daysAgo(35), completed: null, status: "OVERDUE", result: null, inspector: "safety-officer", findings: [] },
    { seq: "009", eqIdx: "09", typeCode: "IT-MONTHLY-SAFETY", clCode: "CL-MONTHLY-GENERAL-001", sched: daysAgo(60), completed: daysAgo(59), status: "COMPLETED", result: "Pass", inspector: "safety-officer", findings: [] },
    { seq: "010", eqIdx: "10", typeCode: "IT-MONTHLY-SAFETY", clCode: "CL-MONTHLY-GENERAL-001", sched: daysAgo(15), completed: daysAgo(14), status: "COMPLETED", result: "Pass", inspector: "safety-officer", findings: [] },
  ];
}

// ── Per-plant seed ────────────────────────────────────────────────────────────

async function seedPlant(
  plantCode: "NW" | "SW",
  masters: Awaited<ReturnType<typeof ensureGlobalMasters>>
) {
  const pl = plantCode.toLowerCase();
  const P  = plantCode;

  const hse = P === "NW"
    ? await prisma.user.findFirstOrThrow({ where: { email: "hse-manager.it.nw@safeops360.in" } })
    : await prisma.user.findFirstOrThrow({ where: { email: `hse-manager.it.${pl}@safeops360.in` } });
  const [safetyOfficer, supervisor, maintenanceHead, deptHead] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { email: `safety-officer.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `supervisor.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `maintenance-head.it.${pl}@safeops360.in` } }),
    prisma.user.findFirstOrThrow({ where: { email: `dept-head.it.${pl}@safeops360.in` } }),
  ]);

  const plant = await prisma.plant.findFirstOrThrow({ where: { code: P } });
  const typeByCode = { [masters.itMonthly.code]: masters.itMonthly, [masters.itStatPV.code]: masters.itStatPV, [masters.itPreOp.code]: masters.itPreOp, [masters.itPostInc.code]: masters.itPostInc, [masters.itCraneWeekly.code]: masters.itCraneWeekly };
  const tplByCode  = { [masters.clMonthly.code]: masters.clMonthly, [masters.clCrane.code]: masters.clCrane };

  // Create equipment
  const equipmentMap: Record<string, string> = {}; // idx → id
  for (const eq of EQUIPMENT_DEFS) {
    const code = `EQ-${P}-DEMO-${eq.idx}`;
    const e = await prisma.equipment.create({
      data: {
        code, name: eq.name, category: eq.category,
        subCategory: eq.sub, plantId: plant.id,
        location: `Knitting Section — ${P === "NW" ? "North Garment Unit" : "South Garment Unit"}`,
        make: eq.make, modelNumber: eq.model, serialNumber: eq.serial,
        manufacturer: eq.mfr,
        commissioningDate: daysAgo(1800 + parseInt(eq.idx) * 30),
        criticality: eq.criticality,
        lastInspectionDate: daysAgo(30 + parseInt(eq.idx) * 3),
        nextInspectionDue: daysFromNow(30 - parseInt(eq.idx) * 2),
        frequency: eq.freq as any,
        active: true,
      },
    });
    equipmentMap[eq.idx] = e.id;
    console.log(`   ✓ ${P}: EQ-${P}-DEMO-${eq.idx}  ${eq.name}`);
  }

  // Inspections
  const scenarios = getInspectionScenarios(P);
  for (const sc of scenarios) {
    const eqId = equipmentMap[sc.eqIdx];
    const inspType = typeByCode[sc.typeCode];
    const tpl = tplByCode[sc.clCode as string];
    if (!inspType || !tpl || !eqId) continue;

    const items = await prisma.checklistItem.findMany({ where: { templateId: tpl.id }, orderBy: { sequence: "asc" } });
    const inspUserKey = (sc as any).inspector as string | undefined;
    const inspectorId = inspUserKey === "maintenance-head" ? maintenanceHead.id : safetyOfficer.id;

    const insp = await prisma.inspection.create({
      data: {
        number: `INS-${P}-DEMO-${sc.seq}`,
        equipmentId: eqId, plantId: plant.id,
        inspectionTypeId: inspType.id,
        checklistTemplateId: tpl.id, checklistTemplateVersion: 1,
        scheduledDate: sc.sched, completedDate: sc.completed ?? undefined,
        inspectorId: inspectorId,
        status: sc.status as any,
        result: sc.result as any ?? undefined,
        isStatutory: sc.typeCode === "IT-STAT-PV-ANNUAL",
        statutoryFormType: sc.typeCode === "IT-STAT-PV-ANNUAL" ? "Form-23" : null,
        statutoryFormSubmittedAt: sc.typeCode === "IT-STAT-PV-ANNUAL" && sc.completed ? daysAgo(174) : null,
        statutoryFormAcknowledgmentNumber: sc.typeCode === "IT-STAT-PV-ANNUAL" && sc.completed ? `IBR-ACK-${P}-2026-0${sc.seq}` : null,
        followUpRequired: sc.findings.length > 0,
        observations: sc.result === "Pass" ? "All items inspected. No significant issues found. Equipment in satisfactory condition." :
          sc.result === "Partial" ? "Inspection completed. Minor issues noted. See findings for details." :
          sc.result === "Fail" ? "Critical defects found. Equipment taken out of service. Immediate corrective actions required." :
          sc.status === "IN_PROGRESS" ? "Inspection in progress — checklist partially completed." : null,
        inspectorSignature: sc.completed ? `SIG-${P}-INS-${sc.seq}` : null,
        inspectorSignedAt: sc.completed,
        reviewerId: sc.completed ? (sc.findings.length > 0 ? hse.id : supervisor.id) : null,
        reviewerSignedAt: sc.completed && sc.findings.length === 0 ? hoursAfter(sc.completed, 24) : null,
        closedAt: sc.status === "COMPLETED" && sc.findings.length === 0 ? hoursAfter(sc.completed!, 24) : null,
        closedById: sc.status === "COMPLETED" && sc.findings.length === 0 ? hse.id : null,
      },
    });

    // InspectionItemResult for completed inspections
    if (sc.status === "COMPLETED" && sc.completed) {
      for (const item of items) {
        const isSection = item.itemType === "SECTION_HEADER";
        const isFail = sc.result === "Fail" && item.isCritical && items.indexOf(item) < 3;
        const isPartial = sc.result === "Partial" && item.isCritical && items.indexOf(item) === 2;
        const statusVal = isSection ? "NA" : isFail ? "FAIL" : isPartial ? "OBSERVATION" : "PASS";

        await prisma.inspectionItemResult.create({
          data: {
            inspectionId: insp.id, checklistItemId: item.id,
            sequence: item.sequence, sectionTitle: item.sectionTitle,
            itemTextSnapshot: item.itemText, itemTypeSnapshot: item.itemType as any,
            isCriticalSnapshot: item.isCritical,
            resultStatus: statusVal as any,
            valueText: item.itemType === "TEXT" ? (sc.result === "Pass" ? "No additional observations to note." : sc.result === "Partial" ? "Pressure gauge cracked face — see finding." : "Wire rope failed. Limit switch failed. Crane removed from service.") : null,
            valueNumeric: item.itemType === "NUMERIC" ? (item.maxValue ? (item.minValue ?? 0) + ((item.maxValue - (item.minValue ?? 0)) * 0.6) : 5.5) : null,
            comment: isFail ? "CRITICAL DEFECT — see inspection finding." : isPartial ? "Defect noted — finding raised." : null,
            capturedById: inspectorId, capturedAt: sc.completed,
          },
        });
      }
    }

    // Findings
    for (let fIdx = 0; fIdx < sc.findings.length; fIdx++) {
      const f = sc.findings[fIdx];
      const finding = await prisma.inspectionFinding.create({
        data: {
          findingNumber: `FND-${P}-${sc.seq}-${String(fIdx + 1).padStart(2, "0")}`,
          inspectionId: insp.id, title: f.title, description: f.desc,
          severity: f.severity as any, isCritical: f.severity === "CRITICAL",
          status: "IN_PROGRESS" as any,
          ownerId: maintenanceHead.id,
          dueDate: daysFromNow(7),
          rootCauseCategory: f.severity === "CRITICAL" ? "equipment_wear" : "equipment_damage",
          rootCauseNote: "Root cause investigation in progress. Preliminary finding: scheduled maintenance interval may be insufficient.",
        },
      });
      // CAPAs for each finding
      for (const capa of f.capas) {
        await prisma.inspectionFindingCapa.create({
          data: {
            findingId: finding.id, capaType: capa.type as any, description: capa.desc,
            ownerId: maintenanceHead.id, dueDate: daysFromNow(7), status: "OPEN" as any,
          },
        });
      }
    }

    // Workflow
    const stepsCompleted = sc.status === "COMPLETED" ? 999 : sc.status === "IN_PROGRESS" ? 1 : 0;
    await createInspectionWorkflow({
      inspId: insp.id, inspNumber: `INS-${P}-DEMO-${sc.seq}`,
      inspTitle: `${inspType.name} — ${EQUIPMENT_DEFS.find(e => e.idx === sc.eqIdx)?.name}`,
      inspDate: sc.sched, inspStatus: sc.status, stepsCompleted,
      actors: { initiator: hse.id, inspector: inspectorId, reviewer: supervisor.id, closer: hse.id },
    });

    const findingNote = sc.findings.length > 0 ? `  ⚠ ${sc.findings.length} finding(s)` : "";
    console.log(`   ✓ ${P}: INS-${P}-DEMO-${sc.seq}  [${sc.status}] ${sc.result ?? "—"}${findingNote}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Step 20 — Assets & Inspection                           ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("   🧹 Cleaning existing DEMO- equipment and inspections…");
  const existingInsp = await prisma.inspection.findMany({ where: { number: { contains: "-DEMO-" } }, select: { id: true } });
  for (const i of existingInsp) {
    await prisma.workflowInstance.deleteMany({ where: { recordId: i.id } });
    await prisma.inspectionFinding.deleteMany({ where: { inspectionId: i.id } });
    await prisma.inspectionItemResult.deleteMany({ where: { inspectionId: i.id } });
    await prisma.inspection.delete({ where: { id: i.id } });
  }
  await prisma.equipment.deleteMany({ where: { code: { contains: "-DEMO-" } } });
  console.log("   Cleanup done.\n");

  const masters = await ensureGlobalMasters();
  await seedPlant("NW", masters);
  await seedPlant("SW", masters);

  console.log("\n✅  Assets & Inspection seed complete.\n");
}

main()
  .catch(e => { console.error("❌  Seed failed:", e?.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
