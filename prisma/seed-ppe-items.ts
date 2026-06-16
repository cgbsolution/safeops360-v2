// ─────────────────────────────────────────────────────────────────────────────
// Step 28 — PPE Items, Issuances, Inspections & Batches
//
// Per plant (NW + SW):
//   • 8 PpeItem records (various PPE types, mixed statuses)
//   • 4 PpeIssuance records (active + returned)
//   • 3 PpeInspection records (pass + fail + conditional)
//   • 2 PpeBatch records (one clean, one under recall)
//
// Idempotent: deletes items with itemNumber containing "DEMO" before recreating.
// Run: npx tsx prisma/seed-ppe-items.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-07T08:00:00.000Z");
function daysAgo(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; }

// ── Dynamic ID resolution ────────────────────────────────────────────────────
// Hardcoded CUIDs from an earlier seed run go stale after a fresh re-seed (the
// FK targets no longer exist → P2003 on PpeType/PpeItem/PpeBatch). Resolve every
// id at runtime from stable business keys instead: Plant.code (unique),
// User.role + plantId, and PpeType.code (unique).

// PPE Type IDs are resolved once (PpeType is a plant-independent global library)
// and shared across plants, keyed by their unique `code`.
type PpeTypeIds = {
  HARNESS: string; SCBA: string; ARC_FLASH: string; ELEC_GLOVE: string;
  GOGGLES: string; GAS_DET: string; COVERALL: string;
};

async function resolvePpeTypeIds(): Promise<PpeTypeIds> {
  const byCode = async (code: string) =>
    (await prisma.ppeType.findFirstOrThrow({ where: { code } })).id;
  return {
    HARNESS:    await byCode("HARNESS-FULLBODY-EN361"),
    SCBA:       await byCode("SCBA-POSITIVEPRESSURE"),
    ARC_FLASH:  await byCode("ARC-FLASH-SUIT"),
    ELEC_GLOVE: await byCode("GLOVES-ELEC-HT"),
    GOGGLES:    await byCode("GOGGLES-CHEM"),
    GAS_DET:    await byCode("GAS-DETECTOR-4GAS"),
    COVERALL:   await byCode("COVERALL-FR"),
  };
}

// Resolve a plant's user for a given role; fall back to any user in the plant.
async function resolveUser(plantId: string, role: string): Promise<string> {
  const byRole = await prisma.user.findFirst({ where: { role, plantId } });
  if (byRole) return byRole.id;
  return (await prisma.user.findFirstOrThrow({ where: { plantId } })).id;
}

async function seedPlant(plantId: string, code: "NW" | "SW", hseMgr: string, worker: string, deptHead: string, types: PpeTypeIds) {
  const TYPE_HARNESS    = types.HARNESS;
  const TYPE_SCBA       = types.SCBA;
  const TYPE_ARC_FLASH  = types.ARC_FLASH;
  const TYPE_ELEC_GLOVE = types.ELEC_GLOVE;
  const TYPE_GOGGLES    = types.GOGGLES;
  const TYPE_GAS_DET    = types.GAS_DET;
  const TYPE_COVERALL   = types.COVERALL;

  type ItemSpec = {
    itemNumber: string; serial: string; typeId: string; typeCode: string; typeName: string;
    mfr: string; model: string; batch: string; mfgDate: Date; purchaseDate: Date; cost: number;
    status: string; condition: string; storageLocation: string; batchId?: string;
    currentHolderUserId?: string; issuedSince?: Date;
  };

  const batchHarnessId = `DEMO-BATCH-${code}-HARNESS-2025`;
  const batchScbaId    = `DEMO-BATCH-${code}-SCBA-2025`;

  // Create batches first (for FK reference below)
  const batchHarness = await prisma.ppeBatch.create({
    data: {
      plantId,
      ppeTypeId: TYPE_HARNESS,
      batchLotNumber: `BL-HARNESS-${code}-2025-Q3`,
      manufacturer: "Petzl Industrial",
      manufactureDate: new Date("2025-06-01"),
      purchaseDate: new Date("2025-07-15"),
      itemsInBatch: 20,
      underRecall: false,
    },
  });

  const batchSCBA = await prisma.ppeBatch.create({
    data: {
      plantId,
      ppeTypeId: TYPE_SCBA,
      batchLotNumber: `BL-SCBA-${code}-2024-Q2`,
      manufacturer: "MSA Safety",
      manufactureDate: new Date("2024-04-01"),
      purchaseDate: new Date("2024-05-20"),
      itemsInBatch: 6,
      underRecall: true,
      recallReason: "Pressure gauge calibration drift identified in batch — potential under-reading by 8–12 bar",
      recallIssuedBy: "MSA Safety Global Recall Notice RN-2026-SCBA-003",
      recallIssuedAt: daysAgo(14),
      recallActionRequired: "Return all units in batch BL-SCBA-2024-Q2 to MSA authorised service centre for gauge replacement before next use.",
    },
  });

  const itemSpecs: ItemSpec[] = [
    // ── Harness (in_stock × 2, issued × 1) ──
    { itemNumber: `DEMO-${code}-HARNESS-001`, serial: `PZ-FBH-${code}-001`, typeId: TYPE_HARNESS, typeCode: "HARNESS-FULLBODY-EN361", typeName: "Full-Body Safety Harness", mfr: "Petzl Industrial", model: "SEQUOIA SRT", batch: batchHarness.batchLotNumber, mfgDate: new Date("2025-06-01"), purchaseDate: new Date("2025-07-15"), cost: 8500, status: "in_stock", condition: "good", storageLocation: `${code} HSE Store — Bay A, Shelf 2` },
    { itemNumber: `DEMO-${code}-HARNESS-002`, serial: `PZ-FBH-${code}-002`, typeId: TYPE_HARNESS, typeCode: "HARNESS-FULLBODY-EN361", typeName: "Full-Body Safety Harness", mfr: "Petzl Industrial", model: "SEQUOIA SRT", batch: batchHarness.batchLotNumber, mfgDate: new Date("2025-06-01"), purchaseDate: new Date("2025-07-15"), cost: 8500, status: "issued", condition: "good", storageLocation: `${code} HSE Store — Bay A, Shelf 2`, currentHolderUserId: worker, issuedSince: daysAgo(30) },
    // ── SCBA (under_inspection — recall batch) ──
    { itemNumber: `DEMO-${code}-SCBA-001`, serial: `MSA-SCBA-${code}-001`, typeId: TYPE_SCBA, typeCode: "SCBA-POSITIVEPRESSURE", typeName: "SCBA — Positive Pressure", mfr: "MSA Safety", model: "G1 SCBA", batch: batchSCBA.batchLotNumber, mfgDate: new Date("2024-04-01"), purchaseDate: new Date("2024-05-20"), cost: 95000, status: "quarantined", condition: "needs_inspection", storageLocation: `${code} Quarantine Cage` },
    // ── Gas Detector (issued + nearing expiry) ──
    { itemNumber: `DEMO-${code}-GASDET-001`, serial: `BW-4G-${code}-001`, typeId: TYPE_GAS_DET, typeCode: "GAS-DETECTOR-4GAS", typeName: "Portable 4-Gas Detector", mfr: "BW Technologies (Honeywell)", model: "GasAlertMicro5 IR", batch: `GD-STD-2022`, mfgDate: new Date("2022-02-01"), purchaseDate: new Date("2022-03-10"), cost: 28000, status: "issued", condition: "fair", storageLocation: `${code} Dye House Control Room`, currentHolderUserId: deptHead, issuedSince: daysAgo(180) },
    // ── Arc Flash Suit (in_stock) ──
    { itemNumber: `DEMO-${code}-ARCFLASH-001`, serial: `HD-AFS-${code}-001`, typeId: TYPE_ARC_FLASH, typeCode: "ARC-FLASH-SUIT", typeName: "Arc Flash Suit", mfr: "Honeywell", model: "Salisbury ArcPro 12 cal/cm²", batch: `AFS-2023-Q1`, mfgDate: new Date("2023-01-15"), purchaseDate: new Date("2023-02-01"), cost: 45000, status: "in_stock", condition: "good", storageLocation: `${code} Electrical Workshop Store` },
    // ── Elec Gloves (in_stock) ──
    { itemNumber: `DEMO-${code}-ELECGLV-001`, serial: `BM-EG-${code}-001`, typeId: TYPE_ELEC_GLOVE, typeCode: "GLOVES-ELEC-HT", typeName: "Electrical Insulating Gloves — HT", mfr: "Biname", model: "Class 4 — 36kV", batch: `EG-2025-Q2`, mfgDate: new Date("2025-04-01"), purchaseDate: new Date("2025-04-20"), cost: 6200, status: "in_stock", condition: "new", storageLocation: `${code} Electrical Workshop Store` },
    // ── Chemical Goggles (issued) ──
    { itemNumber: `DEMO-${code}-GOGGLES-001`, serial: `3M-GG-${code}-001`, typeId: TYPE_GOGGLES, typeCode: "GOGGLES-CHEM", typeName: "Chemical Splash Goggles", mfr: "3M", model: "Virtua CCS Protective Eyewear", batch: `GG-2024-Q4`, mfgDate: new Date("2024-10-01"), purchaseDate: new Date("2024-11-01"), cost: 1800, status: "issued", condition: "good", storageLocation: `${code} Dye House — Dye Chemical Dosing`, currentHolderUserId: hseMgr, issuedSince: daysAgo(60) },
    // ── FR Coverall (retired) ──
    { itemNumber: `DEMO-${code}-COVERALL-001`, serial: `DU-FR-${code}-001`, typeId: TYPE_COVERALL, typeCode: "COVERALL-FR", typeName: "Flame-Resistant Coverall", mfr: "DuPont", model: "Nomex IIIA", batch: `FR-2019-Q3`, mfgDate: new Date("2019-08-01"), purchaseDate: new Date("2019-09-01"), cost: 4200, status: "retired", condition: "unserviceable", storageLocation: `${code} Disposal Bay` },
  ];

  const createdItems: { id: string; spec: ItemSpec }[] = [];

  for (const s of itemSpecs) {
    const serviceLifeEndDate = new Date(s.mfgDate);
    serviceLifeEndDate.setFullYear(serviceLifeEndDate.getFullYear() + 5);

    const item = await prisma.ppeItem.create({
      data: {
        itemNumber: s.itemNumber,
        serialNumber: s.serial,
        ppeTypeId: s.typeId,
        ppeTypeCode: s.typeCode,
        ppeTypeName: s.typeName,
        manufacturer: s.mfr,
        model: s.model,
        batchLotNumber: s.batch,
        manufactureDate: s.mfgDate,
        purchaseDate: s.purchaseDate,
        purchaseOrderReference: `PO-${code}-PPE-2024-${String(Math.floor(100 + Math.random() * 900))}`,
        cost: s.cost,
        costCurrency: "INR",
        plantId,
        storageLocation: s.storageLocation,
        status: s.status,
        currentHolderUserId: s.currentHolderUserId,
        issuedSince: s.issuedSince,
        condition: s.condition,
        lastConditionUpdateAt: daysAgo(30),
        lastConditionUpdateByUserId: hseMgr,
        commissionedAt: s.purchaseDate,
        serviceLifeEndDate,
        lastInspectedAt: daysAgo(45),
        lastInspectedByUserId: hseMgr,
        nextInspectionDueDate: daysFromNow(45),
        batchUnderRecall: s.typeId === TYPE_SCBA,
        recallReference: s.typeId === TYPE_SCBA ? "MSA RN-2026-SCBA-003" : undefined,
        recallIssuedAt: s.typeId === TYPE_SCBA ? daysAgo(14) : undefined,
        stateHistory: [
          { from_status: "in_stock", to_status: s.status === "in_stock" ? "in_stock" : s.status, changed_at: s.issuedSince?.toISOString() ?? daysAgo(180).toISOString(), changed_by_user_id: hseMgr, reason: s.status === "retired" ? "End of service life" : s.status === "quarantined" ? "Recall isolation" : "Normal transition" },
        ],
        versionNumber: 1,
      },
    });
    createdItems.push({ id: item.id, spec: s });
  }

  // ── Issuances (4 records: 2 active, 1 returned, 1 task_based) ──
  const issuedItems = createdItems.filter(i => i.spec.status === "issued");
  for (let idx = 0; idx < Math.min(issuedItems.length, 3); idx++) {
    const ci = issuedItems[idx];
    await prisma.ppeIssuance.create({
      data: {
        issuanceNumber: `ISS-${code}-DEMO-${String(idx + 1).padStart(3, "0")}`,
        ppeItemId: ci.id,
        ppeTypeCode: ci.spec.typeCode,
        ppeTypeName: ci.spec.typeName,
        serialNumber: ci.spec.serial,
        issuedToUserId: ci.spec.currentHolderUserId!,
        issuedToName: ci.spec.currentHolderUserId === worker ? "Contractor Workman" : ci.spec.currentHolderUserId === deptHead ? "Department Head" : "HSE Manager",
        issuedToDepartment: "Operations",
        issuedToRole: ci.spec.currentHolderUserId === worker ? "CONTRACTOR_WORKMAN" : "DEPT_HEAD",
        issuedByUserId: hseMgr,
        issuedByName: "HSE Manager",
        issuedAt: ci.spec.issuedSince!,
        expectedReturnDate: daysFromNow(180),
        issuancePurpose: idx === 1 ? "task_based" : "personal_assignment",
        conditionAtIssuance: "good",
        conditionNotesAtIssuance: "Inspected before issue — no defects found.",
        preIssuanceInspectionDone: true,
        preIssuanceInspectorUserId: hseMgr,
        recipientAcknowledged: true,
        recipientAcknowledgedAt: new Date(ci.spec.issuedSince!.getTime() + 3600000),
        briefingProvided: true,
        briefingByUserId: hseMgr,
        status: "active",
        plantId,
      },
    });
  }

  // 1 returned issuance
  await prisma.ppeIssuance.create({
    data: {
      issuanceNumber: `ISS-${code}-DEMO-004`,
      ppeItemId: createdItems[0].id, // harness-001 (in_stock — previously issued)
      ppeTypeCode: "HARNESS-FULLBODY-EN361",
      ppeTypeName: "Full-Body Safety Harness",
      serialNumber: createdItems[0].spec.serial,
      issuedToUserId: worker,
      issuedToName: "Contractor Workman",
      issuedToDepartment: "Maintenance",
      issuedToRole: "CONTRACTOR_WORKMAN",
      issuedByUserId: hseMgr,
      issuedByName: "HSE Manager",
      issuedAt: daysAgo(90),
      expectedReturnDate: daysAgo(60),
      issuancePurpose: "task_based",
      conditionAtIssuance: "good",
      conditionNotesAtIssuance: "",
      preIssuanceInspectionDone: true,
      preIssuanceInspectorUserId: hseMgr,
      recipientAcknowledged: true,
      recipientAcknowledgedAt: daysAgo(90),
      briefingProvided: true,
      briefingByUserId: hseMgr,
      status: "returned",
      returnedAt: daysAgo(61),
      returnedByUserId: worker,
      conditionAtReturn: "good",
      conditionNotesAtReturn: "No visible damage. Webbing and buckles intact.",
      postReturnInspectionRequired: true,
      plantId,
    },
  });

  // ── Inspections (3 records: pass, fail, conditional_pass) ──
  const inspItems = [
    { item: createdItems[1], result: "pass" as const, type: "periodic" },
    { item: createdItems[2], result: "fail" as const, type: "post_incident" },
    { item: createdItems[6], result: "conditional_pass" as const, type: "annual" },
  ];

  for (const { item: ci, result, type } of inspItems) {
    await prisma.ppeInspection.create({
      data: {
        ppeItemId: ci.id,
        ppeTypeCode: ci.spec.typeCode,
        serialNumber: ci.spec.serial,
        inspectionType: type,
        trigger: type === "post_incident" ? "post_incident" : "scheduled",
        scheduledDate: daysAgo(50),
        conductedAt: daysAgo(45),
        inspectorUserId: hseMgr,
        inspectorName: "HSE Manager",
        inspectorQualification: "NEBOSH IGC + PPE Competency Assessment",
        isThirdPartyInspection: type === "annual",
        thirdPartyCompany: type === "annual" ? "SafeInspect India Pvt Ltd" : "",
        thirdPartyCertificateReference: type === "annual" ? `SII-CERT-${code}-2026-0341` : "",
        checklistItems: [
          { sequence: 1, check_item: "Visual inspection — no cuts, tears, or abrasions", result: result === "fail" ? "fail" : "pass", notes: result === "fail" ? "Pressure gauge drifting — reads 10 bar low vs. calibrated reference" : "OK" },
          { sequence: 2, check_item: "Buckle / connector integrity", result: "pass", notes: "All connectors engage and release smoothly" },
          { sequence: 3, check_item: "Webbing / stitching condition", result: result === "conditional_pass" ? "advisory" : "pass", notes: result === "conditional_pass" ? "Minor surface soiling on shoulder strap — cleaned and re-assessed as acceptable" : "Clean and serviceable" },
          { sequence: 4, check_item: "Label and date code legible", result: "pass", notes: "Manufacture date visible, within service life" },
        ],
        overallResult: result,
        defectsFound: result === "fail" ? [{ defect_description: "Pressure gauge calibration drift — under-reads by approximately 10 bar", severity: "CRITICAL", action_required: "Remove from service, return to MSA for gauge replacement per recall notice RN-2026-SCBA-003" }] : result === "conditional_pass" ? [{ defect_description: "Minor surface contamination on shoulder strap", severity: "MINOR", action_required: "Clean with approved solvent; re-inspect in 30 days" }] : [],
        conditions: result === "fail" ? "Unit quarantined pending manufacturer recall action." : "Good",
        reInspectionRequired: result === "conditional_pass",
        reInspectionDueDate: result === "conditional_pass" ? daysFromNow(30) : undefined,
        itemStatusAfterInspection: result === "fail" ? "quarantined_pending_repair" : result === "conditional_pass" ? "returned_to_service" : "returned_to_service",
        serviceLifeRemainingDays: result === "fail" ? 0 : 400,
        capaSpawned: result === "fail",
        plantId,
      },
    });
  }

  console.log(`  ✅  ${code}: 8 PpeItems, 4 Issuances, 3 Inspections, 2 Batches`);
}

async function main() {
  console.log("Deleting existing PPE DEMO item records…");
  await prisma.ppeInspection.deleteMany({ where: { ppeTypeCode: { in: ["HARNESS-FULLBODY-EN361", "SCBA-POSITIVEPRESSURE", "GOGGLES-CHEM"] } } });
  await prisma.ppeIssuance.deleteMany({ where: { issuanceNumber: { contains: "DEMO" } } });
  await prisma.ppeItem.deleteMany({ where: { itemNumber: { contains: "DEMO" } } });
  await prisma.ppeBatch.deleteMany({ where: { batchLotNumber: { contains: "DEMO" } } });

  // Resolve all ids dynamically from stable business keys (avoids stale CUIDs).
  const nw = await prisma.plant.findFirstOrThrow({ where: { code: "NW" } });
  const sw = await prisma.plant.findFirstOrThrow({ where: { code: "SW" } });

  const HSE_MGR_NW   = await resolveUser(nw.id, "HSE_MANAGER");
  const WORKER_NW    = await resolveUser(nw.id, "CONTRACTOR_WORKMAN");
  const DEPT_HEAD_NW = await resolveUser(nw.id, "DEPARTMENT_HEAD");

  const HSE_MGR_SW   = await resolveUser(sw.id, "HSE_MANAGER");
  const WORKER_SW    = await resolveUser(sw.id, "CONTRACTOR_WORKMAN");
  const DEPT_HEAD_SW = await resolveUser(sw.id, "DEPARTMENT_HEAD");

  const types = await resolvePpeTypeIds();

  await seedPlant(nw.id, "NW", HSE_MGR_NW, WORKER_NW, DEPT_HEAD_NW, types);
  await seedPlant(sw.id, "SW", HSE_MGR_SW, WORKER_SW, DEPT_HEAD_SW, types);

  const totals = {
    items: await prisma.ppeItem.count({ where: { itemNumber: { contains: "DEMO" } } }),
    issuances: await prisma.ppeIssuance.count({ where: { issuanceNumber: { contains: "DEMO" } } }),
    batches: await prisma.ppeBatch.count(),
  };
  console.log(`✅  PPE seed complete — Items: ${totals.items} | Issuances: ${totals.issuances} | Batches: ${totals.batches}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
