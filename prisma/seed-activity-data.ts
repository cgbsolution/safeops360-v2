// ──────────────────────────────────────────────────────────────────────────
// Demo Activity Data — Safety Observations, Near Misses, Permits to Work,
// FLRAs, and Incident Investigations for Page Industries NW + SW plants.
//
//  10 records × 5 modules × 2 plants = 100 records total.
//  All optional fields populated — no blank columns.
//
// Idempotent: records keyed with DEMO- prefix are deleted before re-creating.
// The 4 LTI incidents + 2 active permits from seed-demo-state.ts are left
// untouched so LTIFR / days-since-LTI dashboard KPIs stay correct.
//
// Run: npx tsx prisma/seed-activity-data.ts
// ──────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const DEMO_TODAY = new Date("2026-06-07T09:00:00.000Z");
function daysAgo(n: number) { const d = new Date(DEMO_TODAY); d.setDate(d.getDate() - n); return d; }
function hoursAgo(n: number) { return new Date(DEMO_TODAY.getTime() - n * 3_600_000); }
function daysFromNow(n: number) { const d = new Date(DEMO_TODAY); d.setDate(d.getDate() + n); return d; }

// ── User email resolution helpers ─────────────────────────────────────────

async function resolveUsers(plantSlug: "nw" | "sw") {
  const get = (email: string) => prisma.user.findFirstOrThrow({ where: { email } });
  const [hse, supervisor, worker, issuer, plantHead, safetyOfficer, maintenanceHead] = await Promise.all([
    plantSlug === "nw"
      ? prisma.user.findFirstOrThrow({ where: { email: "hse-manager.it.nw@safeops360.in" } })
      : get(`hse-manager.it.${plantSlug}@safeops360.in`),
    get(`supervisor.it.${plantSlug}@safeops360.in`),
    get(`worker.it.${plantSlug}@safeops360.in`),
    get(`permit-issuer.it.${plantSlug}@safeops360.in`),
    get(`plant-head.it.${plantSlug}@safeops360.in`),
    get(`safety-officer.it.${plantSlug}@safeops360.in`),
    get(`maintenance-head.it.${plantSlug}@safeops360.in`),
  ]);
  return { hse, supervisor, worker, issuer, plantHead, safetyOfficer, maintenanceHead };
}

// ── Area lookup helper ────────────────────────────────────────────────────

function area(areas: { id: string; name: string }[], keyword: string) {
  return areas.find(a => a.name.toLowerCase().includes(keyword.toLowerCase())) ?? areas[0];
}

// ── Seed all 5 modules for one plant ─────────────────────────────────────

async function seedPlant(
  plantCode: "NW" | "SW",
  plant: { id: string; areas: { id: string; name: string }[] },
  u: Awaited<ReturnType<typeof resolveUsers>>
) {
  const P = plantCode;
  const pl = plantCode.toLowerCase();

  // ── Notification payloads ─────────────────────────────────────────────
  const internalNotif = (extra?: string) => [
    { userId: u.hse.id,       name: u.hse.name,       notifiedAt: daysAgo(1).toISOString(), method: "email" },
    { userId: u.plantHead.id, name: u.plantHead.name, notifiedAt: daysAgo(1).toISOString(), method: "sms"   },
    ...(extra ? [{ userId: u.supervisor.id, name: u.supervisor.name, notifiedAt: daysAgo(1).toISOString(), method: "email", note: extra }] : [])
  ];
  const adjAreaNotif = () => [
    { userId: u.supervisor.id,    name: u.supervisor.name,    notifiedAt: DEMO_TODAY.toISOString() },
    { userId: u.safetyOfficer.id, name: u.safetyOfficer.name, notifiedAt: DEMO_TODAY.toISOString() },
  ];
  const ppeChecklist = () => JSON.stringify({
    hardHat: true, safetyBoots: true, chemicalGloves: true, eyeProtection: true,
    highVisVest: true, fireRetardantCoverall: true, selfContainedBA: false
  });

  // ════════════════════════════════════════════════════════════════════
  //  1. SAFETY OBSERVATIONS
  // ════════════════════════════════════════════════════════════════════
  const obsData = [
    {
      number: `OBS-${P}-DEMO-001`, daysAgo_: 3,
      type: "UNSAFE_ACT" as const, category: "PPE" as const, severity: "HIGH" as const, status: "IN_PROGRESS" as const,
      areaKey: "Maintenance Workshop",
      description: "Maintenance technician operating angle grinder on a worn press-roll doctor blade without face shield or grinding visor. Sparks were flying directly towards the face. Incorrect PPE selection — safety glasses alone insufficient for this task.",
      immediateAction: "Work stopped immediately. Technician issued face shield and briefed on grinding PPE requirements before resuming.",
      responsiblePersonId: u.maintenanceHead.id, targetDaysFromNow: 3,
      riskLikelihood: 4, riskConsequence: 4, riskScore: 16, riskLevel: "HIGH", isRepeat: true,
    },
    {
      number: `OBS-${P}-DEMO-002`, daysAgo_: 6,
      type: "UNSAFE_CONDITION" as const, category: "HOUSEKEEPING" as const, severity: "MEDIUM" as const, status: "ASSIGNED" as const,
      areaKey: "Pulp Mill",
      description: "Black-liquor spill approximately 2 m² on anti-fatigue mat near digester circulation pump P-2. Containment tray overflowing. Drip pan not emptied during last maintenance round. Slip hazard for operators on shift.",
      immediateAction: "Spill barricaded with cones. Absorbent granules applied. Pump seal checked and tightened.",
      responsiblePersonId: u.supervisor.id, targetDaysFromNow: 1,
      riskLikelihood: 3, riskConsequence: 3, riskScore: 9, riskLevel: "MEDIUM", isRepeat: false,
    },
    {
      number: `OBS-${P}-DEMO-003`, daysAgo_: 1,
      type: "UNSAFE_ACT" as const, category: "WORK_AT_HEIGHT" as const, severity: "CRITICAL" as const, status: "OPEN" as const,
      areaKey: "Elevated Structures",
      description: "Two workers on the recovery boiler elevated walkway at approximately 6.5 m height. Neither worker wearing a fall arrest harness or using a lanyard. No edge protection on the south side. No third party rescue plan posted.",
      immediateAction: "Workers ordered down immediately. Work halted pending formal PTW and FLRA with height controls.",
      responsiblePersonId: u.hse.id, targetDaysFromNow: 0,
      riskLikelihood: 4, riskConsequence: 5, riskScore: 20, riskLevel: "CRITICAL", isRepeat: false,
    },
    {
      number: `OBS-${P}-DEMO-004`, daysAgo_: 10,
      type: "UNSAFE_CONDITION" as const, category: "ELECTRICAL" as const, severity: "HIGH" as const, status: "CLOSED" as const,
      areaKey: "Electrical Substation",
      description: "Live terminal exposed on MDB-3 distribution board. Cable ferrule had worked loose leaving 3 mm of conductor exposed. Board cover not latched. Area accessible to non-electrical staff during shift.",
      immediateAction: "Board cover locked. Electrical team called immediately. Terminal re-terminated and insulated within 1 hour.",
      responsiblePersonId: u.maintenanceHead.id, targetDaysFromNow: -5,
      closedAt: daysAgo(5), closingRemark: "Terminal re-ferrulated, insulation confirmed, cover relocked. Board inspection added to weekly PM checklist.",
      riskLikelihood: 3, riskConsequence: 5, riskScore: 15, riskLevel: "HIGH", isRepeat: false,
    },
    {
      number: `OBS-${P}-DEMO-005`, daysAgo_: 5,
      type: "SAFE_ACT" as const, category: "CONFINED_SPACE" as const, severity: "LOW" as const, status: "CLOSED" as const,
      areaKey: "Confined Space",
      description: "Excellent practice observed during stock-chest entry at chest C-107. Full gas test conducted and recorded, attendant stationed at entry, emergency rescue kit present and inspected. Crew demonstrated all pre-entry checklist steps correctly.",
      immediateAction: "Positive observation communicated to crew leader on site. Shared with shift briefing as example of best practice.",
      responsiblePersonId: u.supervisor.id, targetDaysFromNow: -2,
      closedAt: daysAgo(2), closingRemark: "Good practice recognised. Added to monthly HSE bulletin.",
      riskLikelihood: 1, riskConsequence: 1, riskScore: 1, riskLevel: "LOW", isRepeat: false,
    },
    {
      number: `OBS-${P}-DEMO-006`, daysAgo_: 8,
      type: "UNSAFE_ACT" as const, category: "CHEMICAL_HANDLING" as const, severity: "HIGH" as const, status: "IN_PROGRESS" as const,
      areaKey: "Chemical Storage",
      description: "Operator rolling a 210-litre drum of 30% caustic soda without secondary containment bund. Drum cap loosened from rolling. Chemical drip trail of approximately 1.5 m observed on floor. No chemical-resistant gloves being worn.",
      immediateAction: "Drum secured upright. Cap re-tightened. Chemical-resistant gloves issued. Spill cleaned and pH-neutralised.",
      responsiblePersonId: u.supervisor.id, targetDaysFromNow: 2,
      riskLikelihood: 4, riskConsequence: 4, riskScore: 16, riskLevel: "HIGH", isRepeat: true,
    },
    {
      number: `OBS-${P}-DEMO-007`, daysAgo_: 12,
      type: "UNSAFE_CONDITION" as const, category: "MATERIAL_HANDLING" as const, severity: "MEDIUM" as const, status: "IN_PROGRESS" as const,
      areaKey: "Warehouse",
      description: "Emergency exit E-3 in the Reel & Ream Warehouse partially blocked by two pallets of incoming waste-paper bales. Pallet tags indicate goods received 3 days ago and not yet put away. Exit corridor width reduced to less than 50 cm.",
      immediateAction: "Pallets moved to holding bay. Exit clearance confirmed. Goods-in supervisor notified.",
      responsiblePersonId: u.supervisor.id, targetDaysFromNow: 1,
      riskLikelihood: 2, riskConsequence: 4, riskScore: 8, riskLevel: "MEDIUM", isRepeat: false,
    },
    {
      number: `OBS-${P}-DEMO-008`, daysAgo_: 4,
      type: "UNSAFE_CONDITION" as const, category: "HOT_WORK" as const, severity: "HIGH" as const, status: "ASSIGNED" as const,
      areaKey: "Paper Machine",
      description: "Spark protection curtain not installed on north side of hot work zone during flange welding job at the Paper Machine Hall. Adjacent equipment includes a press-section lube oil reservoir at 3 m distance. Gas test not re-conducted after 2-hour interval.",
      immediateAction: "Welding paused. Curtain erected. Gas test repeated — 0% LEL confirmed. Work resumed under revised PTW conditions.",
      responsiblePersonId: u.issuer.id, targetDaysFromNow: 2,
      riskLikelihood: 3, riskConsequence: 5, riskScore: 15, riskLevel: "HIGH", isRepeat: false,
    },
    {
      number: `OBS-${P}-DEMO-009`, daysAgo_: 7,
      type: "SAFE_CONDITION" as const, category: "EMERGENCY_PREP" as const, severity: "LOW" as const, status: "CLOSED" as const,
      areaKey: "Canteen / Welfare",
      description: "All fire extinguishers in canteen block checked — inspection tags current, pressure gauges in green, pin seals intact. First-aid box stocked per checklist. Emergency contact board updated with current shift leader details.",
      immediateAction: "No action required. Positive observation shared with facility management for recognition.",
      responsiblePersonId: u.safetyOfficer.id, targetDaysFromNow: -3,
      closedAt: daysAgo(3), closingRemark: "Observation logged. Good housekeeping and compliance in welfare area.",
      riskLikelihood: 1, riskConsequence: 1, riskScore: 1, riskLevel: "LOW", isRepeat: false,
    },
    {
      number: `OBS-${P}-DEMO-010`, daysAgo_: 2,
      type: "UNSAFE_ACT" as const, category: "CONFINED_SPACE" as const, severity: "CRITICAL" as const, status: "OPEN" as const,
      areaKey: "Effluent Treatment Plant",
      description: "Worker found inside sump pit (confined space) at ETP without gas test, no attendant positioned outside, no rescue equipment at entry. Worker had entered informally to retrieve a dropped tool. Entry not covered by any permit.",
      immediateAction: "Worker evacuated immediately. Gas test conducted post-exit — CO 8 ppm, H2S 3 ppm (marginally elevated). Confined space entry stand-down issued for ETP area. Investigation initiated.",
      responsiblePersonId: u.hse.id, targetDaysFromNow: 0,
      riskLikelihood: 5, riskConsequence: 5, riskScore: 25, riskLevel: "CRITICAL", isRepeat: false,
    },
  ];

  for (const o of obsData) {
    const a = area(plant.areas, o.areaKey);
    await prisma.observation.upsert({
      where: { number: o.number },
      create: {
        number: o.number,
        observerId: u.safetyOfficer.id,
        date: daysAgo(o.daysAgo_),
        plantId: plant.id,
        areaId: a.id,
        type: o.type,
        category: o.category,
        description: o.description,
        severity: o.severity,
        immediateAction: o.immediateAction,
        responsiblePersonId: o.responsiblePersonId,
        targetDate: daysFromNow(o.targetDaysFromNow),
        status: o.status,
        closedAt: o.closedAt ?? null,
        closingRemark: o.closingRemark ?? null,
        riskLikelihood: o.riskLikelihood,
        riskConsequence: o.riskConsequence,
        riskScore: o.riskScore,
        riskLevel: o.riskLevel,
        isRepeat: o.isRepeat,
        permitReviewFlagged: false,
      },
      update: {
        description: o.description,
        severity: o.severity,
        status: o.status,
        riskLikelihood: o.riskLikelihood,
        riskConsequence: o.riskConsequence,
        riskScore: o.riskScore,
        riskLevel: o.riskLevel,
      },
    });
  }
  console.log(`   ✓ ${P}: 10 Observations seeded`);

  // ════════════════════════════════════════════════════════════════════
  //  2. NEAR MISSES
  // ════════════════════════════════════════════════════════════════════
  const nmData = [
    {
      number: `NM-${P}-DEMO-001`, daysAgo_: 5,
      status: "ACTION_ASSIGNED" as const, potentialSeverity: "HIGH" as const,
      areaKey: "Chemical Storage",
      description: "During routine inspection, operator noticed a cracked inlet valve on an IBC containing 30% sulphuric acid. Valve had begun weeping. Had the valve failed fully, approximately 1,000 litres of acid could have discharged into the bunded area with potential for splash injury to personnel.",
      location: "Drum Bay 4 — IBC rack, bay C-3",
      specificLocation: "IBC rack C-3, south end near drain channel",
      activity: "Routine chemical storage inspection",
      activityIsRoutine: true,
      immediateAction: "IBC isolated and quarantined. Procurement contacted for replacement. Hazmat response kit deployed to bay as precaution.",
      initialRootCauseCategory: "EQUIPMENT",
      controlsThatFailed: "Incoming IBC inspection did not include valve integrity check.",
      controlsThatWorked: "Routine inspection cycle caught the defect before failure.",
      recommendedActions: "Add IBC valve leak test to goods-in inspection checklist. Implement quarterly in-service valve inspection for bulk acid IBCs.",
      rootCauseCategory: "EQUIPMENT",
      rootCauseDetail: "Valve body crack due to UV degradation — IBC had been stored outdoors in prior yard for extended period.",
      correctiveActions: "1. IBC valve inspection added to goods-in SOP. 2. All IBCs audited for valve condition. 3. UV-rated valve caps specified on new procurement order.",
      riskLikelihood: 4, riskConsequence: 4, riskScore: 16, riskLevel: "HIGH",
      potentialConsequences: [{ type: "CHEMICAL_EXPOSURE", subRating: "SEVERE_INJURY_POTENTIAL" }, { type: "ENVIRONMENTAL", costEstimate: 200000 }],
      targetDaysFromNow: 7,
      reporterType: "EMPLOYEE",
    },
    {
      number: `NM-${P}-DEMO-002`, daysAgo_: 9,
      status: "CLOSED" as const, potentialSeverity: "CRITICAL" as const,
      areaKey: "Elevated Structures",
      description: "Scaffolding plank (3 m × 225 mm × 38 mm timber) fell from an elevated scaffold bay on the recovery boiler structure at approximately 8 m height. Plank landed 2 m from a maintenance technician who was working below and narrowly avoided being struck. Plank had not been toe-boarded.",
      location: "Recovery Boiler structure — north elevation scaffold bay 3",
      specificLocation: "Bay 3, elevation +8 m, north face",
      activity: "Scaffold dismantling",
      activityIsRoutine: false,
      immediateAction: "Work at height stopped. Exclusion zone established below all scaffold bays. Scaffolding inspected — two further unsecured planks found and secured.",
      initialRootCauseCategory: "PROCESS",
      controlsThatFailed: "Scaffold supervisor did not verify toe-board installation before crew commenced dismantling.",
      controlsThatWorked: "Worker heard impact and moved. No one was standing directly below.",
      recommendedActions: "Mandatory toe-board and exclusion zone protocol for all dismantling operations. Scaffold supervisor sign-off card required.",
      rootCauseCategory: "PROCESS",
      rootCauseDetail: "Scaffold dismantling SOP does not explicitly require exclusion zone establishment before work commences.",
      correctiveActions: "1. SOP revised with mandatory exclusion zone step. 2. All scaffold supervisors re-trained on revised SOP. 3. Weekly scaffold inspection added to HSE walkround.",
      riskLikelihood: 3, riskConsequence: 5, riskScore: 15, riskLevel: "CRITICAL",
      potentialConsequences: [{ type: "INJURY", subRating: "FATALITY_POTENTIAL" }, { type: "PROPERTY_DAMAGE", costEstimate: 0 }],
      targetDaysFromNow: -2, closedAt: daysAgo(2),
      reporterType: "EMPLOYEE",
    },
    {
      number: `NM-${P}-DEMO-003`, daysAgo_: 14,
      status: "UNDER_REVIEW" as const, potentialSeverity: "HIGH" as const,
      areaKey: "Warehouse",
      description: "Forklift FLT-04 reversed into the pedestrian crossing corridor in dispatch bay 2 of the Reel & Ream Warehouse. A warehouse operator was 1.5 m away and had to step back sharply to avoid being struck. The forklift's reverse alarm was sounding but was not audible over background noise from the adjacent rewinder.",
      location: "Dispatch Bay 2 — pedestrian crossing zone, east end",
      specificLocation: "Pedestrian crossing TC-02, 5 m from dock door",
      activity: "Finished reel dispatch — pallet movement",
      activityIsRoutine: true,
      immediateAction: "Forklift operations halted. Pedestrian routing reviewed. Temporary barriers placed to separate pedestrian and forklift zones.",
      initialRootCauseCategory: "ENVIRONMENT",
      controlsThatFailed: "Acoustic reverse alarm insufficient against ambient noise. No physical separation between pedestrian and vehicle lanes at crossing.",
      controlsThatWorked: "Worker was alert and stepped back in time.",
      recommendedActions: "Install physical barriers between pedestrian and forklift routes. Upgrade to flashing LED reverse alarm. Redesign pedestrian crossing as zebra-marked right-angle crossing.",
      rootCauseCategory: "ENVIRONMENT",
      rootCauseDetail: "Layout of loading bay does not provide adequate sight lines or physical separation. Forklift reverse alarm rated for 85 dB but ambient noise measured at 88 dB.",
      correctiveActions: "1. Physical bollard separation installed within 3 days. 2. Forklift equipped with strobe warning lamp and louder alarm. 3. Pedestrian route re-painted with high-visibility markings.",
      riskLikelihood: 4, riskConsequence: 4, riskScore: 16, riskLevel: "HIGH",
      potentialConsequences: [{ type: "INJURY", subRating: "SERIOUS_INJURY_POTENTIAL" }, { type: "VEHICLE_COLLISION" }],
      targetDaysFromNow: 10,
      reporterType: "EMPLOYEE",
    },
    {
      number: `NM-${P}-DEMO-004`, daysAgo_: 18,
      status: "CLOSED" as const, potentialSeverity: "CRITICAL" as const,
      areaKey: "Power & Steam Plant",
      description: "Steam line drain valve (DN50, 7 bar steam) opened by contractor without pressure isolation. Isolation blind not fitted at upstream isolator. A burst of high-pressure steam discharged for approximately 3 seconds before the valve was forced closed. Contractor was unaware that the adjacent isolation valve was passing.",
      location: "Power & Steam Plant (Boiler House) — steam header drain manifold, grid reference UB-12",
      specificLocation: "Steam header drain manifold, column UB-12, 1.8 m above floor",
      activity: "Steam trap replacement — contractor maintenance",
      activityIsRoutine: false,
      immediateAction: "Area evacuated. Steam supply isolated at main header. Contractor stood down. Injury check — no personnel in direct steam path.",
      initialRootCauseCategory: "PROCESS",
      controlsThatFailed: "Isolation verification step (confirm blind fitted, bleed valve tested) was not completed before drain opened.",
      controlsThatWorked: "No personnel were in the direct steam discharge path. Contractor closed valve before injury occurred.",
      recommendedActions: "Mandatory double-block-and-bleed isolation for all steam line work. Blind fitting to be signed off by MWHSE before work commences.",
      rootCauseCategory: "PROCESS",
      rootCauseDetail: "Contractor LOTO procedure did not require verification of isolation valve condition. PSSR record for isolation valve not checked.",
      correctiveActions: "1. Steam isolation SOP updated with double-block-and-bleed requirement. 2. All contractor permits for steam work now require signed isolation certificate. 3. Re-induction mandatory for involved contractor crew.",
      riskLikelihood: 3, riskConsequence: 5, riskScore: 15, riskLevel: "CRITICAL",
      potentialConsequences: [{ type: "INJURY", subRating: "FATALITY_POTENTIAL" }, { type: "PROCESS_RELEASE" }],
      targetDaysFromNow: -5, closedAt: daysAgo(5),
      reporterType: "EMPLOYEE",
    },
    {
      number: `NM-${P}-DEMO-005`, daysAgo_: 3,
      status: "REPORTED" as const, potentialSeverity: "HIGH" as const,
      areaKey: "Maintenance Workshop",
      description: "Grinding disc on bench grinder disintegrated during wheel-dress operation. Disc fragments were contained by the wheel guard but guard had only partial coverage — approximately 15 cm of the disc circumference had no guard coverage. Operator was wearing face shield but was struck by two fragments on the forearm (no penetration — bruising only).",
      location: "Maintenance Workshop — bench grinder station B-3",
      specificLocation: "Bench grinder B-3, south row of workshop",
      activity: "Tool maintenance — grinding wheel dressing",
      activityIsRoutine: true,
      immediateAction: "First aid given. Grinder taken out of service. All bench grinders inspected for guard coverage adequacy.",
      initialRootCauseCategory: "EQUIPMENT",
      controlsThatFailed: "Guard design on older bench grinders provides only 270° coverage. Risk of fragment ejection not addressed in maintenance SOP.",
      controlsThatWorked: "Face shield worn — prevented facial injury. Guard contained majority of fragments.",
      recommendedActions: "Replace all bench grinder guards with 300°+ coverage guards. Annual disc integrity inspection schedule to be established.",
      rootCauseCategory: "EQUIPMENT",
      rootCauseDetail: "Disc was 2 years old — beyond recommended 12-month working life for this duty class. Age tracking not in place for abrasive wheels.",
      correctiveActions: "1. Disc replacement schedule implemented. 2. All grinding discs stamped with installation date. 3. Guards upgraded on 3 bench grinders.",
      riskLikelihood: 3, riskConsequence: 4, riskScore: 12, riskLevel: "HIGH",
      potentialConsequences: [{ type: "INJURY", subRating: "SERIOUS_INJURY_POTENTIAL" }],
      targetDaysFromNow: 14,
      reporterType: "EMPLOYEE",
    },
    {
      number: `NM-${P}-DEMO-006`, daysAgo_: 20,
      status: "CLOSED" as const, potentialSeverity: "MEDIUM" as const,
      areaKey: "Chemical Storage",
      description: "Small fire started in the pulp/paper testing lab fume cupboard when ethanol vapour ignited from an overheated hot plate left unattended. Fire was extinguished by lab technician using CO2 extinguisher within 30 seconds. Sprinkler did not activate (fire below activation threshold). No injuries.",
      location: "Pulp/Paper Testing Lab — fume cupboard FC-2, south wall",
      specificLocation: "Fume cupboard FC-2, testing lab south bay",
      activity: "Solvent extraction analysis (kappa number test)",
      activityIsRoutine: true,
      immediateAction: "Fire extinguished. Lab evacuated. Hot plate taken out of service. Ventilation system checked and running.",
      initialRootCauseCategory: "HUMAN_FACTOR",
      controlsThatFailed: "Hot plate left on at temperature above ethanol flash point while technician attended a meeting. No automatic cut-off on hot plate.",
      controlsThatWorked: "CO2 extinguisher immediately accessible. Technician trained in extinguisher use. Fire contained within fume cupboard.",
      recommendedActions: "Install automatic cut-off timers on all lab hot plates. Establish 'never leave unattended' rule when flammable solvents are in use.",
      rootCauseCategory: "HUMAN_FACTOR",
      rootCauseDetail: "Technician left lab without switching off hot plate. No visual reminder system. Lab SOP does not specify maximum unattended period.",
      correctiveActions: "1. Timer-controlled sockets installed on all hot plates. 2. SOP updated: hot plates must be switched off before leaving lab area. 3. Toolbox talk to all QC lab personnel.",
      riskLikelihood: 2, riskConsequence: 3, riskScore: 6, riskLevel: "MEDIUM",
      potentialConsequences: [{ type: "FIRE", subRating: "MINOR_FIRE" }, { type: "PROPERTY_DAMAGE", costEstimate: 25000 }],
      targetDaysFromNow: -8, closedAt: daysAgo(8),
      reporterType: "EMPLOYEE",
    },
    {
      number: `NM-${P}-DEMO-007`, daysAgo_: 7,
      status: "ACTION_ASSIGNED" as const, potentialSeverity: "CRITICAL" as const,
      areaKey: "Bleaching Plant",
      description: "Chlorine dioxide gas detector in the Bleaching Plant alarmed at 1.0 ppm (action level). All workers evacuated per ERP. Investigation identified a gland leak on a ClO₂ dosing pump seal. Seal had been replaced 3 weeks prior but the wrong grade of PTFE gland was specified in the maintenance job card.",
      location: "Bleaching Plant — ClO₂ dosing skid, pump P-204B",
      specificLocation: "ClO₂ dosing skid CP-04, pump P-204B gland",
      activity: "ClO₂ dosing — process operation",
      activityIsRoutine: true,
      immediateAction: "Plant evacuated to muster point 2. SCBA-equipped team identified and contained leak. Dosing pump P-204B isolated and blanked.",
      initialRootCauseCategory: "PROCESS",
      controlsThatFailed: "Gland material specification in maintenance management system incorrectly updated — PTFE-40 used instead of PTFE-75 ClO₂ grade.",
      controlsThatWorked: "Fixed gas detector performed as designed. ERP executed without injury. SCBA response team available on shift.",
      recommendedActions: "Implement critical service gland material register with CMMS approval controls. Re-audit all ClO₂ system gland types in service.",
      rootCauseCategory: "PROCESS",
      rootCauseDetail: "CMMS BOM for pump P-204B had a legacy entry with non-ClO₂-grade PTFE. Maintenance planner did not cross-reference critical service register.",
      correctiveActions: "1. CMMS BOM corrected for all ClO₂ dosing pumps. 2. Critical service register created and locked to maintenance supervisor approval. 3. Gas detector calibration checked and confirmed.",
      riskLikelihood: 3, riskConsequence: 5, riskScore: 15, riskLevel: "CRITICAL",
      potentialConsequences: [{ type: "TOXIC_RELEASE", subRating: "MULTI_PERSON_INJURY_POTENTIAL" }, { type: "ENVIRONMENTAL" }],
      targetDaysFromNow: 5,
      reporterType: "EMPLOYEE",
    },
    {
      number: `NM-${P}-DEMO-008`, daysAgo_: 11,
      status: "UNDER_REVIEW" as const, potentialSeverity: "HIGH" as const,
      areaKey: "Paper Machine",
      description: "Operator's left hand momentarily trapped in a nip point at the belt-to-roller interface on broke conveyor CV-08 in the Paper Machine Hall during a clearing jam procedure. Hand was withdrawn before injury beyond superficial abrasion. Operator had reached around the guarding panel to access the jam rather than using the designated access hatch.",
      location: "Paper Machine Hall — broke conveyor CV-08, nip point at head end roller",
      specificLocation: "CV-08 head end, east side, nip guard zone",
      activity: "Conveyor jam clearing",
      activityIsRoutine: false,
      immediateAction: "Conveyor stopped using emergency stop. First aid applied — superficial abrasion only. Conveyor locked out before clearing jam.",
      initialRootCauseCategory: "HUMAN_FACTOR",
      controlsThatFailed: "Operator bypassed access hatch to reach jam directly. Safety guarding does not prevent access around the panel end.",
      controlsThatWorked: "Emergency stop activated immediately. First aid available on shift.",
      recommendedActions: "Modify guarding to prevent reach-around access. Develop jam clearing procedure requiring LOTO before any contact. Training refresher for all process operators.",
      rootCauseCategory: "HUMAN_FACTOR",
      rootCauseDetail: "Operator took shortcut due to production pressure. Access hatch requires a tool to open which was not immediately available at time of jam.",
      correctiveActions: "1. Access hatch tool chained to guarding panel permanently. 2. Jam clearing SOP revised to mandate LOTO. 3. All operators on CV-08 re-briefed.",
      riskLikelihood: 3, riskConsequence: 4, riskScore: 12, riskLevel: "HIGH",
      potentialConsequences: [{ type: "INJURY", subRating: "SERIOUS_INJURY_POTENTIAL" }, { type: "MACHINERY_ENTRAPMENT" }],
      targetDaysFromNow: 8,
      reporterType: "EMPLOYEE",
    },
    {
      number: `NM-${P}-DEMO-009`, daysAgo_: 16,
      status: "ACTION_ASSIGNED" as const, potentialSeverity: "HIGH" as const,
      areaKey: "Warehouse",
      description: "Overhead crane hook swung and narrowly missed a maintenance technician who was working on a nearby motor at 2.5 m height. The crane operator had not visually verified the under-hook area before traversing. Technician was not in the banksman's field of view.",
      location: "Reel & Ream Warehouse — overhead crane OHC-1, bay 5–7",
      specificLocation: "Bay 6, 2.5 m elevated access platform near motor MCC-06",
      activity: "Crane load movement and platform maintenance (simultaneous)",
      activityIsRoutine: true,
      immediateAction: "Crane operations suspended. Technician assisted down from platform. No injury — near miss by approximately 0.4 m.",
      initialRootCauseCategory: "MANAGEMENT_SYSTEM",
      controlsThatFailed: "Simultaneous crane operation and elevated work not controlled by permit. No exclusion protocol between crane envelope and elevated workers.",
      controlsThatWorked: "Technician saw hook and moved. No serious injury.",
      recommendedActions: "Implement simultaneous operation control: no crane movement within bay when personnel on elevated platforms. Banksman protocol to cover full 360° under-hook zone.",
      rootCauseCategory: "MANAGEMENT_SYSTEM",
      rootCauseDetail: "Simultaneous operations risk not captured in either the crane operating procedure or the elevated work permit checklist.",
      correctiveActions: "1. Simultaneous operations exclusion rule added to crane SOP. 2. Permit check step added: confirm crane exclusion zone active. 3. Crane operators re-trained.",
      riskLikelihood: 3, riskConsequence: 4, riskScore: 12, riskLevel: "HIGH",
      potentialConsequences: [{ type: "INJURY", subRating: "FATAL_CRUSH_POTENTIAL" }],
      targetDaysFromNow: 6,
      reporterType: "EMPLOYEE",
    },
    {
      number: `NM-${P}-DEMO-010`, daysAgo_: 2,
      status: "REPORTED" as const, potentialSeverity: "CRITICAL" as const,
      areaKey: "Electrical Substation",
      description: "Arc flash incident during panel maintenance on MCC-07. Maintenance electrician opened panel door on a live 415V feeder without verifying isolation. An arc flash occurred — no injury as electrician was wearing arc-rated PPE, but equipment face was scorched and light fixtures in the substation tripped.",
      location: "Electrical Substation — MCC-07 feeder panel, bay B",
      specificLocation: "MCC-07, bay B, 415V feeder F-07/14",
      activity: "Planned maintenance — control panel inspection",
      activityIsRoutine: false,
      immediateAction: "Area isolated at upstream breaker. Electrician medically assessed — no injury confirmed. Affected panel taken out of service. Incident escalated to site management.",
      initialRootCauseCategory: "PROCESS",
      controlsThatFailed: "LOTO tag-and-test step not completed — electrician assumed previous isolation was still in place from a morning test that had since been re-energised.",
      controlsThatWorked: "Arc-rated PPE (Cat 2) protected the electrician. Adjacent panels unaffected.",
      recommendedActions: "Mandatory test-before-touch for every panel entry regardless of prior isolation status. Single-point LOTO with personal padlock for all electrical work.",
      rootCauseCategory: "PROCESS",
      rootCauseDetail: "Panel had been re-energised by another technician at 13:00 without notifying the maintenance team who returned at 14:30 to resume work.",
      correctiveActions: "1. Single-point personal padlock LOTO mandatory for all LV panel work. 2. Re-energisation requires sign-off from maintenance supervisor. 3. All electrical maintainers re-trained on LOTO.",
      riskLikelihood: 4, riskConsequence: 5, riskScore: 20, riskLevel: "CRITICAL",
      potentialConsequences: [{ type: "INJURY", subRating: "FATALITY_POTENTIAL" }, { type: "ELECTRICAL_ARC_FLASH" }],
      targetDaysFromNow: 3,
      reporterType: "EMPLOYEE",
    },
  ];

  for (const nm of nmData) {
    const a = area(plant.areas, nm.areaKey);
    await prisma.nearMiss.upsert({
      where: { number: nm.number },
      create: {
        number: nm.number,
        reporterId: u.worker.id,
        date: daysAgo(nm.daysAgo_),
        plantId: plant.id,
        areaId: a.id,
        description: nm.description,
        location: nm.location,
        specificLocation: nm.specificLocation,
        reporterType: nm.reporterType,
        activityIsRoutine: nm.activityIsRoutine,
        activity: nm.activity,
        immediateAction: nm.immediateAction,
        potentialSeverity: nm.potentialSeverity,
        potentialConsequences: nm.potentialConsequences,
        riskLikelihood: nm.riskLikelihood,
        riskConsequence: nm.riskConsequence,
        riskScore: nm.riskScore,
        riskLevel: nm.riskLevel,
        initialRootCauseCategory: nm.initialRootCauseCategory,
        controlsThatFailed: nm.controlsThatFailed,
        controlsThatWorked: nm.controlsThatWorked,
        recommendedActions: nm.recommendedActions,
        suggestedActionOwnerId: u.supervisor.id,
        rootCauseCategory: nm.rootCauseCategory,
        rootCauseDetail: nm.rootCauseDetail,
        correctiveActions: nm.correctiveActions,
        actionOwnerId: u.supervisor.id,
        targetDate: daysFromNow(nm.targetDaysFromNow),
        status: nm.status,
        closedAt: nm.closedAt ?? null,
        multipleWorkersAggravator: false,
        isAnonymous: false,
      },
      update: { description: nm.description, status: nm.status, riskScore: nm.riskScore },
    });
  }
  console.log(`   ✓ ${P}: 10 Near Misses seeded`);

  // ════════════════════════════════════════════════════════════════════
  //  3. PERMITS TO WORK
  // ════════════════════════════════════════════════════════════════════
  const permitData = [
    {
      number: `PTW-${P}-DEMO-001`, type: "HOT_WORK" as const, status: "CLOSED" as const, daysAgo_: 25,
      areaKey: "Maintenance Workshop",
      location: "Maintenance Workshop — Lathe Bed Frame Repair",
      scopeOfWork: "MIG welding repair to lathe bed frame crack. 200 mm weld pass. Area clear of combustibles to 11 m. Gas test <5% LEL confirmed before start.",
      contractorName: "InfraWeld Services Pvt Ltd",
      isolationsRequired: "Lathe main power isolated and LOTO applied. Adjacent coolant lines drained and blanked.",
      gasTestRequired: true, gasTestResult: "PASS", o2Level: "20.9", lelLevel: "1", h2sLevel: "0",
      fireWatchRequired: true, weatherConditions: "Indoor, ambient 28°C",
      closingRemark: "Weld completed and inspected. Area restored. Fire watch maintained for 30 minutes post-completion.",
    },
    {
      number: `PTW-${P}-DEMO-002`, type: "CONFINED_SPACE" as const, status: "CLOSED" as const, daysAgo_: 20,
      areaKey: "Effluent Treatment Plant",
      location: "ETP — Primary Settling Tank PST-1 internal inspection",
      scopeOfWork: "Visual inspection and sludge level gauging inside primary settling tank PST-1. Vessel drained, purged, and ventilated for minimum 4 hours before entry. Full gas test confirmed.",
      contractorName: "ETP Maintenance Partners",
      isolationsRequired: "Inlet and outlet penstocks closed and padlocked. Agitator motor LOTO applied.",
      gasTestRequired: true, gasTestResult: "PASS", o2Level: "20.9", lelLevel: "0", h2sLevel: "0.5",
      fireWatchRequired: false, weatherConditions: "Partly cloudy, 32°C",
      closingRemark: "Inspection complete. No structural defects. Sludge depth recorded as 0.8 m. Vessel re-commissioned.",
    },
    {
      number: `PTW-${P}-DEMO-003`, type: "WORK_AT_HEIGHT" as const, status: "CLOSED" as const, daysAgo_: 15,
      areaKey: "Elevated Structures",
      location: "Elevated Structures — Cooling Tower Fan Stack CT-3 servicing",
      scopeOfWork: "Cooling tower fan stack bearing replacement at 9.5 m height. Mobile elevated work platform used. Full-body harness and lanyard required for all personnel.",
      contractorName: "CoolTech Mechanical Services",
      isolationsRequired: "CT-3 fan motor LOTO. Cooling water recirculation pump isolated.",
      gasTestRequired: false, gasTestResult: null, o2Level: null, lelLevel: null, h2sLevel: null,
      fireWatchRequired: false, weatherConditions: "Clear, wind <10 km/h, 35°C",
      closingRemark: "Fan bearing replaced. Test run satisfactory. All MEWP daily checks on file.",
    },
    {
      number: `PTW-${P}-DEMO-004`, type: "ELECTRICAL_LOTO" as const, status: "CLOSED" as const, daysAgo_: 18,
      areaKey: "Electrical Substation",
      location: "Electrical Substation — MCC-04 incoming feeder cable replacement",
      scopeOfWork: "Replacement of 240 mm² XLPE cable on MCC-04 incoming feeder. Cable pulled from external transformer bay. Bus-bar isolated and earthed.",
      contractorName: "Voltex Electrical Contractors",
      isolationsRequired: "MCC-04 main incomer CB racked out and locked. Transformer secondary CB opened and LOTO. Test lamp used to confirm dead before cable removal.",
      gasTestRequired: false, gasTestResult: null, o2Level: null, lelLevel: null, h2sLevel: null,
      fireWatchRequired: false, weatherConditions: "Indoor",
      closingRemark: "Cable replaced. Insulation resistance test passed (>1 GOhm). MCC-04 recommissioned under test.",
    },
    {
      number: `PTW-${P}-DEMO-005`, type: "HOT_WORK" as const, status: "SAFETY_APPROVED" as const, daysAgo_: 2,
      areaKey: "Paper Machine",
      location: "Paper Machine Hall — Pipeline P-112 flange weld repair at column B-07",
      scopeOfWork: "GTAW root pass + SMAW fill and cap on DN100 sch-40 carbon steel flange to pipe weld. Line flushed, nitrogen-purged, and depressurised. Weld to be NDT tested post-completion.",
      contractorName: "PipeFab Welding Services",
      isolationsRequired: "P-112 double-block-and-bleed isolation. Nitrogen purge certificate attached. Weld area gas-tested — 0% LEL.",
      gasTestRequired: true, gasTestResult: "PASS", o2Level: "20.9", lelLevel: "0", h2sLevel: "0",
      fireWatchRequired: true, weatherConditions: "Indoor, ambient 31°C",
      closingRemark: null,
    },
    {
      number: `PTW-${P}-DEMO-006`, type: "EXCAVATION" as const, status: "CLOSED" as const, daysAgo_: 30,
      areaKey: "Warehouse",
      location: "Reel & Ream Warehouse yard — storm drain expansion trench, east boundary",
      scopeOfWork: "Excavation of 45 m trench 1.2 m deep × 0.6 m wide for storm drain expansion. Mechanical excavation followed by hand dig for last 0.3 m near utilities. CAT scan and utility drawings on site.",
      contractorName: "Civil Solutions India Pvt Ltd",
      isolationsRequired: "All underground utilities positively located using CAT/Genny scan. Drawing cross-check with plant utilities engineer completed.",
      gasTestRequired: false, gasTestResult: null, o2Level: null, lelLevel: null, h2sLevel: null,
      fireWatchRequired: false, weatherConditions: "Overcast, 30°C, no rain forecast",
      closingRemark: "Trench completed and backfilled. Storm drain installed and connected. Site reinstated. No utilities struck.",
    },
    {
      number: `PTW-${P}-DEMO-007`, type: "HOT_WORK" as const, status: "CLOSED" as const, daysAgo_: 12,
      areaKey: "Power & Steam Plant",
      location: "Power & Steam Plant (Boiler House) — compressed air receiver AR-02 nozzle repair",
      scopeOfWork: "SMAW weld build-up on corroded nozzle flange on compressed air receiver AR-02. Receiver fully depressurised and vented. National certification inspection required post-weld.",
      contractorName: "PressureVessel Tech India",
      isolationsRequired: "AR-02 depressurised to atmospheric pressure. Inlet and outlet valves LOTO. Vent valve locked open during work.",
      gasTestRequired: true, gasTestResult: "PASS", o2Level: "20.9", lelLevel: "0", h2sLevel: "0",
      fireWatchRequired: true, weatherConditions: "Indoor, ambient 29°C",
      closingRemark: "Weld repair complete. NDT (UT + DPT) passed. Receiver pressure-tested to 1.5× MAWP. IBR certificate obtained.",
    },
    {
      number: `PTW-${P}-DEMO-008`, type: "CONFINED_SPACE" as const, status: "CLOSED" as const, daysAgo_: 8,
      areaKey: "Power & Steam Plant",
      location: "Power & Steam Plant (Boiler House) — boiler steam drum internal inspection",
      scopeOfWork: "Annual internal inspection of steam drum SD-1 for corrosion, deposit mapping, and safety valve seat inspection. Drum cooled, drained, and ventilated for 24 hours.",
      contractorName: "Thermex Inspection Services",
      isolationsRequired: "All steam drum connections blind-flanged. Feed water pump LOTO. Safety valves removed for bench testing.",
      gasTestRequired: true, gasTestResult: "PASS", o2Level: "20.9", lelLevel: "0", h2sLevel: "0",
      fireWatchRequired: false, weatherConditions: "Indoor, ambient 38°C (adjacent to boiler house)",
      closingRemark: "Inspection complete. Minor pitting found at crown — documented and re-inspected at 6 months. Drum returned to service.",
    },
    {
      number: `PTW-${P}-DEMO-009`, type: "GENERAL_COLD" as const, status: "SAFETY_APPROVED" as const, daysAgo_: 1,
      areaKey: "Chemical Storage",
      location: "Chemical Storage — bulk sulphuric acid unloading bay",
      scopeOfWork: "Offloading of 25,000 litres 98% sulphuric acid from road tanker to storage tank T-07. Grounding cable connected. Level gauge verified operational. Bund drain valve closed and locked.",
      contractorName: "ChemTrans Logistics Pvt Ltd",
      isolationsRequired: "Acid storage tank T-07 overflow valve verified closed. Vent scrubber operational. Tanker grounding confirmed before any connections made.",
      gasTestRequired: false, gasTestResult: null, o2Level: null, lelLevel: null, h2sLevel: null,
      fireWatchRequired: false, weatherConditions: "Clear sky, 33°C, no wind",
      closingRemark: null,
    },
    {
      number: `PTW-${P}-DEMO-010`, type: "WORK_AT_HEIGHT" as const, status: "CLOSED" as const, daysAgo_: 22,
      areaKey: "Power & Steam Plant",
      location: "Power & Steam Plant (Boiler House) — cooling tower fill pack replacement CT-1",
      scopeOfWork: "Replacement of deteriorated PVC fill pack in cooling tower CT-1. Work at 7 m height inside cooling tower shell. Lockout of fans before entry. Lifeline rigging from top beam.",
      contractorName: "CoolTech Mechanical Services",
      isolationsRequired: "CT-1 fans LOTO. Distribution header drain valve open and locked. Makeup water pump isolated.",
      gasTestRequired: false, gasTestResult: null, o2Level: null, lelLevel: null, h2sLevel: null,
      fireWatchRequired: false, weatherConditions: "Clear, 30°C",
      closingRemark: "Fill pack replaced — 60 m² new PVC. Performance test: approach temperature within design spec. All LOTO removed in correct order.",
    },
  ];

  for (const p of permitData) {
    const a = area(plant.areas, p.areaKey);
    const isClosed = p.status === "CLOSED";
    const isApproved = p.status === "SAFETY_APPROVED" || p.status === "CLOSED";

    const validFrom = hoursAgo(p.daysAgo_ * 24 - 4);
    const validTo = isClosed
      ? hoursAgo(p.daysAgo_ * 24 - 12)
      : daysFromNow(2);

    await prisma.permit.upsert({
      where: { number: p.number },
      create: {
        number: p.number,
        type: p.type,
        plantId: plant.id,
        areaId: a.id,
        location: p.location,
        scopeOfWork: p.scopeOfWork,
        validFrom,
        validTo,
        originatorId: u.supervisor.id,
        issuerId: u.issuer.id,
        receiverId: u.worker.id,
        contractorName: p.contractorName,
        isolationsRequired: p.isolationsRequired,
        ppeChecklist: ppeChecklist(),
        gasTestRequired: p.gasTestRequired,
        gasTestResult: p.gasTestResult ?? null,
        o2Level: p.o2Level ?? null,
        lelLevel: p.lelLevel ?? null,
        h2sLevel: p.h2sLevel ?? null,
        fireWatchRequired: p.fireWatchRequired,
        status: p.status,
        issuerApprovedAt: new Date(validFrom.getTime() - 30 * 60_000),
        safetyApprovedAt: isApproved ? new Date(validFrom.getTime() - 15 * 60_000) : null,
        plantHeadApprovedAt: isClosed ? new Date(validFrom.getTime() - 5 * 60_000) : null,
        activatedAt: isClosed ? new Date(validFrom.getTime() + 5 * 60_000) : null,
        activatedById: isClosed ? u.issuer.id : null,
        closedAt: isClosed ? validTo : null,
        closedById: isClosed ? u.hse.id : null,
        closingRemark: p.closingRemark,
        returnedAt: isClosed ? new Date(validTo.getTime() - 10 * 60_000) : null,
        returnedById: isClosed ? u.worker.id : null,
        returnNotes: isClosed ? "All tools and crew accounted for. Area left clean and safe." : null,
        siteVerifiedAt: isClosed ? new Date(validTo.getTime() - 5 * 60_000) : null,
        siteVerifiedById: isClosed ? u.safetyOfficer.id : null,
        weatherConditionsAtIssue: p.weatherConditions,
        specificLocation: p.location,
        adjacentAreaNotifications: adjAreaNotif(),
      },
      update: { status: p.status, closedAt: isClosed ? validTo : null },
    });
  }
  console.log(`   ✓ ${P}: 10 Permits to Work seeded`);

  // ════════════════════════════════════════════════════════════════════
  //  4. FLRAs
  // ════════════════════════════════════════════════════════════════════
  const flraData = [
    {
      number: `FLRA-${P}-DEMO-001`, daysAgo_: 25, status: "COMPLETED" as const,
      location: "Maintenance Workshop — Lathe Bed Frame Area",
      jobDescription: "MIG welding repair to lathe bed frame crack. Includes clearing of combustibles and firewatch setup.",
      isStandalone: false,
      hazards: JSON.stringify([
        { id: "1", hazard: "Hot metal splatter / sparks — fire ignition", controlMeasure: "Gas test, combustible clearance to 11 m, spark barrier, CO2 extinguisher positioned 2 m from work" },
        { id: "2", hazard: "UV/IR radiation from welding arc — eye and skin burn", controlMeasure: "Auto-darkening welding helmet, FR coverall, welding screen erected" },
        { id: "3", hazard: "Welding fume inhalation", controlMeasure: "LEV duct positioned at weld point, half-face respirator (P3+A2) worn" },
        { id: "4", hazard: "Electric shock — welding leads", controlMeasure: "Welding leads inspected for damage, dry gloves worn, work area dry" },
      ]),
      toolboxTopics: ["Hot work hazards", "Fire watch duties", "Emergency stop procedure", "Burn first aid"],
    },
    {
      number: `FLRA-${P}-DEMO-002`, daysAgo_: 20, status: "COMPLETED" as const,
      location: "ETP — Primary Settling Tank PST-1",
      jobDescription: "Internal inspection of primary settling tank — sludge gauging and structural check.",
      isStandalone: false,
      hazards: JSON.stringify([
        { id: "1", hazard: "Oxygen deficiency inside tank", controlMeasure: "Continuous O2 monitoring, BA set at entry point, blower ventilation running" },
        { id: "2", hazard: "H2S release from sludge", controlMeasure: "Multi-gas detector with alarm set to 1 ppm, immediate evacuation signal agreed" },
        { id: "3", hazard: "Slipping on wet surfaces inside tank", controlMeasure: "Non-slip footwear, slow deliberate movement, torch for lighting" },
        { id: "4", hazard: "Entrapment in narrow passages", controlMeasure: "Attendant at entry, lifeline attached, buddy system — single entry at a time" },
      ]),
      toolboxTopics: ["Confined space hazards", "Gas test interpretation", "Emergency rescue procedure", "Communication signals"],
    },
    {
      number: `FLRA-${P}-DEMO-003`, daysAgo_: 15, status: "COMPLETED" as const,
      location: "Elevated Structures — Cooling Tower Fan Stack CT-3",
      jobDescription: "Cooling tower fan bearing replacement using MEWP at 9.5 m.",
      isStandalone: false,
      hazards: JSON.stringify([
        { id: "1", hazard: "Fall from height — MEWP platform", controlMeasure: "Full-body harness with twin lanyard attached to anchor, MEWP operator briefed on no-sudden-movement rule" },
        { id: "2", hazard: "Dropped tool / bearing component", controlMeasure: "Exclusion zone 10 m radius. Tool tethering lanyards on all items above 1 kg" },
        { id: "3", hazard: "MEWP instability on uneven surface", controlMeasure: "Ground inspected for voids, MEWP outriggers fully extended, daily pre-use check complete" },
        { id: "4", hazard: "Heat stress at height", controlMeasure: "Shift duration limited to 90 min, water provided, shade canopy over MEWP basket" },
      ]),
      toolboxTopics: ["Working at height regulations", "MEWP operating restrictions", "Harness inspection", "First aid for heat exhaustion"],
    },
    {
      number: `FLRA-${P}-DEMO-004`, daysAgo_: 18, status: "COMPLETED" as const,
      location: "Electrical Substation — MCC-04 bay",
      jobDescription: "Replacement of 240 mm² XLPE cable on MCC-04 incoming feeder under full electrical LOTO.",
      isStandalone: false,
      hazards: JSON.stringify([
        { id: "1", hazard: "Residual voltage on cable — electric shock", controlMeasure: "Test-before-touch using approved voltage tester. Cable discharged to earth before handling" },
        { id: "2", hazard: "Arc flash during switching", controlMeasure: "Cat 2 arc-rated PPE worn during all switching operations. Only qualified LV electricians to switch" },
        { id: "3", hazard: "Cable weight / handling injury", controlMeasure: "Mechanical cable puller used for pull-in. Team lift with 2 persons for coil handling" },
        { id: "4", hazard: "Re-energisation while work in progress", controlMeasure: "Personal LOTO padlock on incomer CB. Group lockout hasp used, each person locks own padlock" },
      ]),
      toolboxTopics: ["Electrical LOTO procedure", "Arc flash awareness", "Live testing prohibition", "Emergency isolation"],
    },
    {
      number: `FLRA-${P}-DEMO-005`, daysAgo_: 2, status: "IN_PROGRESS" as const,
      location: "Paper Machine Hall — Pipeline P-112 flange",
      jobDescription: "Pipeline flange weld repair under hot work permit. GTAW root, SMAW fill/cap on DN100 carbon steel.",
      isStandalone: false,
      hazards: JSON.stringify([
        { id: "1", hazard: "Flammable vapours in adjacent process area", controlMeasure: "Continuous LEL monitoring, gas test every 2 hours, work stoppage if >10% LEL" },
        { id: "2", hazard: "Weld fume in enclosed pipe trench", controlMeasure: "Air mover positioned to clear trench. RPE with OV+P3 filter worn" },
        { id: "3", hazard: "UV radiation to bystanders", controlMeasure: "Welding screens on all 4 sides. No unauthorised access within screen perimeter" },
        { id: "4", hazard: "Hot pipe/flange surface after welding", controlMeasure: "Cool-down period of 30 min before removing screens. Thermal gloves and warning sign posted" },
      ]),
      toolboxTopics: ["PTW conditions review", "Hot work gas testing protocol", "Weld quality standards", "Emergency isolation procedure"],
    },
    {
      number: `FLRA-${P}-DEMO-006`, daysAgo_: 30, status: "COMPLETED" as const,
      location: "Reel & Ream Warehouse yard — east boundary trench",
      jobDescription: "Excavation of 45 m trench for storm drain expansion. Mechanical and hand dig.",
      isStandalone: true,
      hazards: JSON.stringify([
        { id: "1", hazard: "Underground utility strike", controlMeasure: "CAT/Genny scan completed. Drawings available on site. Hand dig only within 0.5 m of utilities" },
        { id: "2", hazard: "Trench collapse", controlMeasure: "Sides battered to 1:1 where depth >1.2 m. No entry into unsupported trench >1.5 m deep" },
        { id: "3", hazard: "Equipment overrun edge", controlMeasure: "Minimum 600 mm stopblock at trench edge. No vehicle within 2 m of trench unless baulk in place" },
        { id: "4", hazard: "Working in proximity to live traffic", controlMeasure: "Traffic management plan in place. Banksman present when machinery near roadway. Cones and barriers deployed" },
      ]),
      toolboxTopics: ["Underground utilities awareness", "Trench collapse hazards", "Manual handling in confined spaces", "Traffic management"],
    },
    {
      number: `FLRA-${P}-DEMO-007`, daysAgo_: 12, status: "COMPLETED" as const,
      location: "Power & Steam Plant (Boiler House) — Compressed Air Receiver AR-02",
      jobDescription: "Pressure vessel nozzle weld build-up — hot work on depressurised vessel.",
      isStandalone: false,
      hazards: JSON.stringify([
        { id: "1", hazard: "Residual pressure in vessel", controlMeasure: "Pressure gauge verified at zero. Vent valve open and locked during work. Test crack of manway nut before full removal" },
        { id: "2", hazard: "Fire from hot work near compressed gas area", controlMeasure: "All compressed gas cylinders moved >5 m from work area. CO2 extinguisher positioned on both sides" },
        { id: "3", hazard: "Confined space aspect — working inside vessel manway neck", controlMeasure: "Attendant stationed at manway. Communication every 15 min. No full body entry — arm and head only" },
        { id: "4", hazard: "Heat stress from proximity to heated vessel wall", controlMeasure: "Vessel cooled to <40°C surface temperature before work. 30 min work / 15 min rest rotation" },
      ]),
      toolboxTopics: ["Pressure vessel LOTO", "Hot work fire watch", "Heat stress recognition", "Emergency response for burn injuries"],
    },
    {
      number: `FLRA-${P}-DEMO-008`, daysAgo_: 8, status: "COMPLETED" as const,
      location: "Power & Steam Plant (Boiler House) — Steam Drum SD-1",
      jobDescription: "Annual internal inspection of steam drum — corrosion mapping and safety valve removal.",
      isStandalone: false,
      hazards: JSON.stringify([
        { id: "1", hazard: "Residual steam or hot condensate in drum", controlMeasure: "Drum cooled below 40°C, all drains confirmed open, temperature probe inside before entry" },
        { id: "2", hazard: "Oxygen-deficient atmosphere", controlMeasure: "Forced ventilation running for minimum 4 hours, continuous O2 monitoring at entry point" },
        { id: "3", hazard: "Working in confined, curved space — ergonomic injury", controlMeasure: "Short rotation intervals (45 min on, 15 min out). Correctly sized access manholes confirmed pre-entry" },
        { id: "4", hazard: "Inadvertent valve opening or reconnection of steam", controlMeasure: "All steam connections blind-flanged. Group LOTO board at main steam stop valve" },
      ]),
      toolboxTopics: ["Confined space permit review", "Steam drum safety", "Oxygen meter operation", "Emergency egress from drum"],
    },
    {
      number: `FLRA-${P}-DEMO-009`, daysAgo_: 1, status: "IN_PROGRESS" as const,
      location: "Chemical Storage — Bulk Acid Unloading Bay",
      jobDescription: "Offloading 25,000 L 98% sulphuric acid from road tanker to storage tank T-07.",
      isStandalone: true,
      hazards: JSON.stringify([
        { id: "1", hazard: "Acid splash during hose connection / disconnection", controlMeasure: "Acid-resistant coverall, face shield, and glove system. Dry-break coupling used. Connections made at lowest pressure point" },
        { id: "2", hazard: "Tank overfill and bund overflow", controlMeasure: "High-level alarm set at 90% capacity. Operator monitoring level gauge throughout transfer. Bund drain valve locked closed" },
        { id: "3", hazard: "Vapour release and acid mist inhalation", controlMeasure: "Wind direction checked — upwind positioning required. Acid-grade RPE worn. Emergency eyewash confirmed operational" },
        { id: "4", hazard: "Electrostatic ignition from tanker-to-tank charge", controlMeasure: "Tanker grounding strap connected and resistance verified (<10 Ω) before hoses connected" },
      ]),
      toolboxTopics: ["Chemical bulk transfer SOP", "Acid spill response and neutralisation", "Emergency eyewash use", "SCBA donning"],
    },
    {
      number: `FLRA-${P}-DEMO-010`, daysAgo_: 22, status: "COMPLETED" as const,
      location: "Power & Steam Plant (Boiler House) — Cooling Tower CT-1 interior",
      jobDescription: "PVC fill pack replacement inside cooling tower shell at 7 m height.",
      isStandalone: false,
      hazards: JSON.stringify([
        { id: "1", hazard: "Fall from internal structure or walking surfaces", controlMeasure: "Lifeline rigged from top beam. Full-body harness and energy-absorbing lanyard. No overreaching beyond arm's length" },
        { id: "2", hazard: "Legionella exposure from residual water", controlMeasure: "Tower treated and drained 48 hours prior. FFP3 respirator worn during fill removal. All removed fill double-bagged for disposal" },
        { id: "3", hazard: "Dropped fill panels striking workers below", controlMeasure: "Exclusion zone at base. Lowering rope used for all panels. No person below during lowering" },
        { id: "4", hazard: "Heat stress in enclosed tower", controlMeasure: "Air mover running at base. 60 min on / 20 min rest cycle. Hydration: 500 mL/hour minimum" },
      ]),
      toolboxTopics: ["Cooling tower biological hazards", "Work at height inside structures", "Legionella risk control", "Heat stress management"],
    },
  ];

  for (const f of flraData) {
    const isCompleted = f.status === "COMPLETED";
    const flraDate = daysAgo(f.daysAgo_);
    await prisma.fLRA.upsert({
      where: { number: f.number },
      create: {
        number: f.number,
        plantId: plant.id,
        date: flraDate,
        location: f.location,
        jobDescription: f.jobDescription,
        leaderId: u.supervisor.id,
        hazards: f.hazards,
        toolboxTalkById: u.safetyOfficer.id,
        toolboxTalkConfirmed: isCompleted,
        toolboxTalkConducted: isCompleted,
        toolboxTalkConductedAt: isCompleted ? new Date(flraDate.getTime() + 20 * 60_000) : null,
        toolboxTalkTopics: f.toolboxTopics,
        toolboxTalkLanguage: "Hindi",
        status: f.status,
        completedAt: isCompleted ? new Date(flraDate.getTime() + 30 * 60_000) : null,
        isStandalone: f.isStandalone,
        specificLocation: f.location,
        jobIsRoutine: !f.isStandalone,
        startTime: flraDate,
        emergencyContactsConfirmed: isCompleted,
        exitRoutesIdentified: "Main exit via permit access point. Emergency exit via fire door on east wall.",
        ppeChecklistResponses: JSON.stringify({ hardHat: true, safetyBoots: true, highVisVest: true, gloves: true, eyeProtection: true }),
        toolsCheckedResponses: JSON.stringify({ inspectionTagsCurrent: true, toolsInsulated: true, noDefects: true }),
      },
      update: { status: f.status, completedAt: isCompleted ? new Date(flraDate.getTime() + 30 * 60_000) : null },
    });
  }
  console.log(`   ✓ ${P}: 10 FLRAs seeded`);

  // ════════════════════════════════════════════════════════════════════
  //  5. INCIDENT INVESTIGATIONS
  // ════════════════════════════════════════════════════════════════════
  const incidentData = [
    {
      number: `INC-${P}-DEMO-001`, daysAgo_: 45, type: "FIRST_AID" as const, status: "CLOSED" as const,
      areaKey: "Maintenance Workshop",
      location: "Maintenance Workshop — Hand Tool Storage Bay",
      description: "Maintenance fitter sustained a laceration (2 cm, superficial) to left index finger while cutting cable ties with a box-cutter. Blade slipped when tie snapped suddenly.",
      injuredPersonName: "Maintenance Fitter A", injuredPersonAge: 32, injuredPersonDesignation: "Maintenance Fitter",
      bodyPart: "Left index finger", natureOfInjury: "Laceration (2 cm superficial)", lostDays: 0,
      immediateCause: "Knife slipped during sudden release of cable tie tension. No anti-cut glove worn.",
      rootCauseMethod: "5-Why",
      rootCauseDetail: "1) Blade slipped on tie release → 2) Excessive cutting force used → 3) Wrong tool (box cutter instead of flush-cut plier) → 4) Flush-cut pliers not stocked in workshop bay → 5) PPE/tool requirement for cable tie cutting not specified in task SOP.",
      correctiveActions: "1. Flush-cut pliers added to workshop bay tool inventory. 2. Anti-cut gloves added to cable-tie cutting job task. 3. Toolbox talk delivered on correct tool selection.",
      preventiveActions: "Incorporate cut hazard tool matrix into new-employee induction.",
      immediateCauses: ["Knife slipped on cable tie release", "Anti-cut glove not worn"],
      underlyingCauses: ["Wrong tool in use — box cutter used for cable tie cutting", "Tool inventory does not include flush-cut pliers"],
      rootCauses: ["Cable tie cutting SOP does not specify required tool or PPE"],
      contributingFactors: ["Production pressure", "Familiarity with task leading to complacency"],
      severity: "LOW", isReportable: false,
      internalNotificationsSent: [{ userId: u.hse.id, name: u.hse.name, notifiedAt: daysAgo(44).toISOString(), method: "email" }],
      costMedical: 500, costTotal: 500,
    },
    {
      number: `INC-${P}-DEMO-002`, daysAgo_: 38, type: "MTC" as const, status: "CAPA_ASSIGNED" as const,
      areaKey: "Pulp Mill",
      location: "Pulp Mill — Digester circulation pump station grating",
      description: "Process operator slipped on a wet grating adjacent to pump P-101 seal, sustaining a sprained left wrist. Had gripped the handrail but wrist was twisted in the fall. Medical treatment given at site first-aid room; restricted duty for 4 days.",
      injuredPersonName: "Process Operator E", injuredPersonAge: 27, injuredPersonDesignation: "Process Operator",
      bodyPart: "Left wrist", natureOfInjury: "Sprain — Grade 2 ligament stretch", lostDays: 0,
      immediateCause: "Wet grating — pump P-101 mechanical seal had been weeping for 2 days prior. Housekeeping inspection missed the wet spot.",
      rootCauseMethod: "Fishbone",
      rootCauseDetail: "CAUSE: Slippery grating | Equipment: Pump seal leak undetected | Man: Housekeeping interval too long | Method: No sensor for pump gland leakage | Measurement: No formal slip-risk assessment for grating areas",
      correctiveActions: "1. P-101 seal replaced immediately. 2. Anti-slip coating applied to all pump station gratings. 3. Housekeeping interval in wet process areas reduced to 2 hourly.",
      preventiveActions: "Install vibration/temperature sensors on all critical pump seals. Add floor slip-risk assessment to annual HSE audit.",
      immediateCauses: ["Wet grating from pump seal leak"],
      underlyingCauses: ["Pump seal condition monitoring not in PM schedule", "Housekeeping inspection frequency insufficient"],
      rootCauses: ["No mechanism to detect pump seal leak between scheduled PM rounds"],
      contributingFactors: ["High-frequency shift changes — condition not communicated between shifts"],
      severity: "MEDIUM", isReportable: false,
      internalNotificationsSent: [
        { userId: u.hse.id, name: u.hse.name, notifiedAt: daysAgo(37).toISOString(), method: "email" },
        { userId: u.plantHead.id, name: u.plantHead.name, notifiedAt: daysAgo(37).toISOString(), method: "sms" },
      ],
      costMedical: 1500, costTotal: 1500,
    },
    {
      number: `INC-${P}-DEMO-003`, daysAgo_: 30, type: "FIRST_AID" as const, status: "CLOSED" as const,
      areaKey: "Chemical Storage",
      location: "Chemical Storage — reagent preparation area, bay B",
      description: "Lab technician received a chemical splash to the right eye when a glass stirring rod broke during reagent preparation. Goggles not being worn at time. Eye irrigated at emergency eyewash for 15 minutes. Ophthalmology review confirmed no lasting injury.",
      injuredPersonName: "Lab Technician F", injuredPersonAge: 25, injuredPersonDesignation: "QC Analyst",
      bodyPart: "Right eye", natureOfInjury: "Chemical splash — dilute HCl (5%). Mild conjunctival irritation, no corneal injury.", lostDays: 0,
      immediateCause: "Glass rod broke under unexpected shear load. Splash entered eye as goggles had been removed for fogged lens.",
      rootCauseMethod: "5-Why",
      rootCauseDetail: "1) Chemical splash to eye → 2) Goggles removed (fogged) → 3) Anti-fog goggles not available in lab → 4) Procurement spec had no anti-fog requirement → 5) PPE spec review had not incorporated fog-related comfort feedback.",
      correctiveActions: "1. Anti-fog chemical goggles procured for all lab areas. 2. PPE specification reviewed and updated. 3. Eyewash station inspection confirmed functional.",
      preventiveActions: "Annual PPE comfort review added to lab management system. Polycarbonate stir rods to replace glass where practical.",
      immediateCauses: ["Chemical splash from broken glass stirring rod", "Eye protection not being worn"],
      underlyingCauses: ["Anti-fog goggles not available — standard goggles fogged rapidly"],
      rootCauses: ["PPE specification did not account for comfort/usability in humid lab environment"],
      contributingFactors: ["Young / new worker", "Peer behaviour (others in lab also not wearing goggles)"],
      severity: "LOW", isReportable: false,
      internalNotificationsSent: [{ userId: u.hse.id, name: u.hse.name, notifiedAt: daysAgo(29).toISOString(), method: "email" }],
      costMedical: 800, costTotal: 800,
    },
    {
      number: `INC-${P}-DEMO-004`, daysAgo_: 22, type: "RWC" as const, status: "CAPA_ASSIGNED" as const,
      areaKey: "Warehouse",
      location: "Reel & Ream Warehouse — racking bay 7",
      description: "Warehouse operator sustained a lower back strain (lumbar muscle pull) while manually lifting a 28 kg bag of starch additive from a floor pallet. The bag was at the bottom of a 6-tier stack, requiring a bent and twisted lift posture.",
      injuredPersonName: "Warehouse Operator G", injuredPersonAge: 40, injuredPersonDesignation: "Warehouse Operator",
      bodyPart: "Lower back — L3/L4 lumbar area", natureOfInjury: "Muscular strain — restricted duty 8 days", lostDays: 0,
      immediateCause: "Heavy bag lifted from below knee height in awkward twisted posture. No mechanical aid used.",
      rootCauseMethod: "Fishbone",
      rootCauseDetail: "CAUSE: Back strain | Man: Incorrect posture, no training reinforcement | Machine: No pallet tilter available in bay 7 | Method: Manual handling SOP not task-specific for low pallet lifts | Environment: Bay 7 too narrow for pallet truck use",
      correctiveActions: "1. Pallet tilter procured for bay 7. 2. Manual handling task-specific training delivered to warehouse team. 3. Bay 7 layout redesigned to allow pallet truck access.",
      preventiveActions: "All manual handling >20 kg tasks to have mechanical aid specified in task sheet. Annual ergonomic assessment of warehouse.",
      immediateCauses: ["Twisted posture during heavy lift from low level"],
      underlyingCauses: ["No mechanical aid in bay 7", "Bay layout requires awkward postures for low-tier pallet access"],
      rootCauses: ["Manual handling risk assessment for bay 7 did not identify low-tier pallet access as high-risk task"],
      contributingFactors: ["Time pressure during goods despatch rush", "Worker's prior back condition not declared"],
      severity: "MEDIUM", isReportable: false,
      internalNotificationsSent: [
        { userId: u.hse.id, name: u.hse.name, notifiedAt: daysAgo(21).toISOString(), method: "email" },
        { userId: u.plantHead.id, name: u.plantHead.name, notifiedAt: daysAgo(21).toISOString(), method: "sms" },
      ],
      costMedical: 3500, costTotal: 3500,
    },
    {
      number: `INC-${P}-DEMO-005`, daysAgo_: 17, type: "PROPERTY_DAMAGE" as const, status: "CLOSED" as const,
      areaKey: "Paper Machine",
      location: "Paper Machine Hall — conveyor CV-12 structural support",
      description: "Counterbalance forklift FLT-02 struck the structural support column of conveyor CV-12 while reversing in the Paper Machine Hall. Column deformed (15 cm buckle). Conveyor remained operational but structural integrity requires inspection. No personnel injury. Estimated repair cost ₹1.8 lakh.",
      injuredPersonName: null, injuredPersonAge: null, injuredPersonDesignation: null,
      bodyPart: null, natureOfInjury: null, lostDays: 0,
      immediateCause: "Forklift reversed at excessive speed in confined aisle. Operator did not check path before reversing.",
      rootCauseMethod: "5-Why",
      rootCauseDetail: "1) Column struck while reversing → 2) Aisle too narrow for FLT turning radius at speed → 3) FLT operating speed not controlled in narrow aisles → 4) Aisle width classification not defined in site traffic plan → 5) Site traffic management plan last reviewed 5 years ago.",
      correctiveActions: "1. Speed limit signs installed in all narrow aisles. 2. Proximity alarm fitted to FLT-02. 3. Structural column repaired and impact protection guard installed.",
      preventiveActions: "Site traffic management plan reviewed and reissued. FLT speed limiter devices evaluated for fleet.",
      immediateCauses: ["FLT reversing at excessive speed in confined aisle", "Operator did not check path before reversing"],
      underlyingCauses: ["No speed control signage in narrow aisles", "Traffic management plan outdated"],
      rootCauses: ["Site traffic plan did not define aisle width classifications or speed limits by zone"],
      contributingFactors: ["Operator unfamiliar with new route after warehouse layout change"],
      severity: "MEDIUM", isReportable: false,
      internalNotificationsSent: [
        { userId: u.hse.id, name: u.hse.name, notifiedAt: daysAgo(16).toISOString(), method: "email" },
        { userId: u.plantHead.id, name: u.plantHead.name, notifiedAt: daysAgo(16).toISOString(), method: "sms" },
        { userId: u.maintenanceHead.id, name: u.maintenanceHead.name, notifiedAt: daysAgo(16).toISOString(), method: "email" },
      ],
      costMedical: 0, costPropertyDamage: 180000, costTotal: 180000,
    },
    {
      number: `INC-${P}-DEMO-006`, daysAgo_: 12, type: "MTC" as const, status: "INVESTIGATION" as const,
      areaKey: "Power & Steam Plant",
      location: "Power & Steam Plant (Boiler House) — boiler feed pump room",
      description: "Maintenance engineer sustained a crush injury to the right index finger (tip fracture) when a pipe flange bolt slipped during tightening. Engineer was using an incorrectly sized spanner (non-ring type) which rotated off the hex and the hand struck the flange face.",
      injuredPersonName: "Maintenance Engineer H", injuredPersonAge: 35, injuredPersonDesignation: "Maintenance Engineer",
      bodyPart: "Right index finger (tip)", natureOfInjury: "Distal phalanx fracture — 10 days restricted duty", lostDays: 0,
      immediateCause: "Wrong spanner type used — open-ended spanner slipped off bolt hex under high torque load.",
      rootCauseMethod: "5-Why",
      rootCauseDetail: "Investigation in progress — preliminary: 1) Spanner slipped off hex → 2) Wrong spanner type → 3) Ring spanner not available in maintenance kit → 4) Tool kit specification not reviewed after PM scope change",
      correctiveActions: "Investigation ongoing. Interim: ring-type spanners to be used for all pipe flange work pending investigation.",
      preventiveActions: "TBD pending investigation conclusion.",
      immediateCauses: ["Wrong tool used — open-ended spanner applied to high-torque flange bolt"],
      underlyingCauses: ["Ring spanner not in maintenance technician's kit"],
      rootCauses: ["Tool kit specification not reviewed following PM scope change"],
      contributingFactors: ["Time pressure", "Working in cramped space limiting spanner selection"],
      severity: "MEDIUM", isReportable: false,
      internalNotificationsSent: [
        { userId: u.hse.id, name: u.hse.name, notifiedAt: daysAgo(11).toISOString(), method: "email" },
        { userId: u.plantHead.id, name: u.plantHead.name, notifiedAt: daysAgo(11).toISOString(), method: "sms" },
      ],
      costMedical: 4500, costTotal: 4500,
    },
    {
      number: `INC-${P}-DEMO-007`, daysAgo_: 8, type: "FIRST_AID" as const, status: "CLOSED" as const,
      areaKey: "Warehouse",
      location: "Reel & Ream Warehouse — dock door 3 platform edge",
      description: "Loading assistant stepped off the dock door platform edge (0.6 m drop) while guiding a trailer reversing. Twisted right ankle on landing. First aid applied — no fracture on assessment. Returned to modified duty same day.",
      injuredPersonName: "Loading Assistant J", injuredPersonAge: 22, injuredPersonDesignation: "Loading Assistant",
      bodyPart: "Right ankle", natureOfInjury: "Ankle twist — mild ligament strain", lostDays: 0,
      immediateCause: "Worker stepped off platform edge without looking while focused on trailer guidance.",
      rootCauseMethod: "5-Why",
      rootCauseDetail: "1) Stepped off edge → 2) Attention focused on trailer, not foot placement → 3) No physical edge demarcation at dock level → 4) Platform edge marking not included in dock safety design → 5) Dock safety layout last reviewed at commissioning.",
      correctiveActions: "1. High-visibility edge marking applied to all dock door platforms. 2. Banksman to use radio for trailer guidance rather than hand signals (removes need to stand at edge). 3. Dock safety refresher for loading team.",
      preventiveActions: "Dock safety design review added to next capital safety audit. Evaluate dock edge barriers.",
      immediateCauses: ["Stepped off unmarked dock platform edge"],
      underlyingCauses: ["No edge demarcation on dock platform"],
      rootCauses: ["Dock safety design did not include edge marking as a standard feature"],
      contributingFactors: ["New worker (2 months)"],
      severity: "LOW", isReportable: false,
      internalNotificationsSent: [{ userId: u.hse.id, name: u.hse.name, notifiedAt: daysAgo(7).toISOString(), method: "email" }],
      costMedical: 300, costTotal: 300,
    },
    {
      number: `INC-${P}-DEMO-008`, daysAgo_: 5, type: "RWC" as const, status: "INVESTIGATION" as const,
      areaKey: "Pulp Mill",
      location: "Pulp Mill — digester vessel V-05 access stairs",
      description: "Process technician sustained a knee contusion (bruising, no fracture) after catching a boot toe on a protruding grating bolt head on the access staircase. Fell forward onto the stair tread. Medically assessed as restricted duty for 6 days.",
      injuredPersonName: "Process Technician K", injuredPersonAge: 29, injuredPersonDesignation: "Process Technician",
      bodyPart: "Right knee (patella area)", natureOfInjury: "Contusion / bruising — no fracture on X-ray", lostDays: 0,
      immediateCause: "Grating bolt head protruding 12 mm above grating surface on 4th tread of V-05 access staircase. Bolt was loose — captive nut had corroded out.",
      rootCauseMethod: "Fishbone",
      rootCauseDetail: "CAUSE: Trip on protruding bolt | Man: Hurrying on stairs | Machine: Corroded captive nut allowed bolt to rise | Method: Grating inspection interval too long (annual only) | Environment: Corrosive process atmosphere accelerated nut corrosion",
      correctiveActions: "1. All access grating bolts inspected and tightened/replaced. 2. Protruding bolt heads on all gratings corrected within 48 hours. 3. Grating bolt inspection added to monthly maintenance checklist.",
      preventiveActions: "Switch to spring-lock grating fastener on corrosion-risk stairs. Include grating walk-over in weekly HSE patrol.",
      immediateCauses: ["Trip on protruding grating bolt head"],
      underlyingCauses: ["Grating bolt captive nut corroded out allowing bolt to rise", "Annual grating inspection did not catch deterioration"],
      rootCauses: ["Grating fastener specification not appropriate for corrosive environment adjacent to process vessel"],
      contributingFactors: ["Worker hurrying between activities"],
      severity: "LOW", isReportable: false,
      internalNotificationsSent: [
        { userId: u.hse.id, name: u.hse.name, notifiedAt: daysAgo(4).toISOString(), method: "email" },
        { userId: u.plantHead.id, name: u.plantHead.name, notifiedAt: daysAgo(4).toISOString(), method: "sms" },
      ],
      costMedical: 1200, costTotal: 1200,
    },
    {
      number: `INC-${P}-DEMO-009`, daysAgo_: 42, type: "FIRE" as const, status: "CLOSED" as const,
      areaKey: "Power & Steam Plant",
      location: "Power & Steam Plant (Boiler House) — DG-02 fuel day-tank area",
      description: "Small fire in insulation lagging on the DG-02 exhaust manifold. Lagging was soaked in diesel from a fuel connection drip that had been accumulating for approximately 2 weeks. Fire detected by operator during routine round — extinguished with foam extinguisher before fire brigade response. No injuries. DG-02 out of service for 5 days.",
      injuredPersonName: null, injuredPersonAge: null, injuredPersonDesignation: null,
      bodyPart: null, natureOfInjury: null, lostDays: 0,
      immediateCause: "Hot exhaust manifold ignited diesel-soaked lagging. Diesel had accumulated from an undetected fuel line drip.",
      rootCauseMethod: "5-Why",
      rootCauseDetail: "1) Lagging ignited → 2) Diesel-soaked lagging adjacent to exhaust → 3) Fuel line connection drip not detected → 4) DG-02 round sheet did not include fuel line visual check → 5) Round sheet last revised 4 years ago — predates addition of day-tank.",
      correctiveActions: "1. DG-02 round sheet updated to include fuel line visual check. 2. All DG lagging inspected and diesel-contaminated sections replaced. 3. Metal drip tray installed under all DG fuel connections.",
      preventiveActions: "Annual review of DG round sheets to be added to HSE management calendar. Evaluate thermal imaging camera for DG exhaust inspections.",
      immediateCauses: ["Hot exhaust manifold contacted diesel-soaked lagging"],
      underlyingCauses: ["Fuel line drip undetected — not on round check sheet", "No drip tray under fuel connections"],
      rootCauses: ["DG round inspection sheet was outdated — did not cover all fuel system components"],
      contributingFactors: ["Insulation opacity concealed diesel saturation from visual inspection"],
      severity: "HIGH", isReportable: true,
      reportableUnder: ["FACTORIES_ACT"],
      internalNotificationsSent: [
        { userId: u.hse.id, name: u.hse.name, notifiedAt: daysAgo(41).toISOString(), method: "email" },
        { userId: u.plantHead.id, name: u.plantHead.name, notifiedAt: daysAgo(41).toISOString(), method: "sms", note: "Notified as property loss incident" },
        { userId: u.maintenanceHead.id, name: u.maintenanceHead.name, notifiedAt: daysAgo(41).toISOString(), method: "email" },
      ],
      costPropertyDamage: 45000, costOther: 15000, costTotal: 60000,
    },
    {
      number: `INC-${P}-DEMO-010`, daysAgo_: 55, type: "ENVIRONMENTAL" as const, status: "CLOSED" as const,
      areaKey: "Effluent Treatment Plant",
      location: "ETP — secondary clarifier outlet channel",
      description: "Effluent pH exceeded trade waste consent limit (6.0–9.0) at 11.2 for approximately 45 minutes during chemical dosing control failure. Caustic over-dosing due to pH probe giving incorrect reading following probe fouling. Event self-corrected after operator manual override. Regulator notified as per consent conditions.",
      injuredPersonName: null, injuredPersonAge: null, injuredPersonDesignation: null,
      bodyPart: null, natureOfInjury: null, lostDays: 0,
      immediateCause: "pH probe P-ETP-04 fouled causing high pH reading. Auto-dosing controller responded by reducing caustic — actual pH drifted high with dosing not corrected.",
      rootCauseMethod: "5-Why",
      rootCauseDetail: "1) Effluent pH breached limit → 2) pH controller over-dosed caustic → 3) Probe gave incorrect low reading (probe fouled) → 4) Probe maintenance interval 90 days — too long for ETP duty → 5) Probe maintenance interval not set based on ETP-specific fouling rate.",
      correctiveActions: "1. pH probe cleaning interval reduced to 30 days. 2. Secondary verification pH meter installed as cross-check. 3. Regulator notified and consent condition review initiated.",
      preventiveActions: "ETP pH monitoring system reviewed — dual-probe with divergence alarm specification raised. ETP consent condition parameters reviewed against current process loads.",
      immediateCauses: ["pH probe fouled — gave false low reading causing controller to over-dose caustic"],
      underlyingCauses: ["Probe maintenance interval too long for ETP duty", "No secondary pH verification instrument"],
      rootCauses: ["pH probe maintenance schedule not designed based on process-specific fouling characteristics"],
      contributingFactors: ["New caustic batch with slightly higher concentration added 2 hours prior"],
      severity: "MEDIUM", isReportable: true,
      reportableUnder: ["CPCB", "STATE_PCB"],
      internalNotificationsSent: [
        { userId: u.hse.id, name: u.hse.name, notifiedAt: daysAgo(54).toISOString(), method: "email" },
        { userId: u.plantHead.id, name: u.plantHead.name, notifiedAt: daysAgo(54).toISOString(), method: "sms" },
      ],
      costLegalRegulatory: 25000, costTotal: 25000,
    },
  ];

  for (const inc of incidentData) {
    const a = area(plant.areas, inc.areaKey);
    const incDate = daysAgo(inc.daysAgo_);
    const isClosed = inc.status === "CLOSED";

    await prisma.incident.upsert({
      where: { number: inc.number },
      create: {
        number: inc.number,
        date: incDate,
        occurredAt: incDate,
        reportedAt: new Date(incDate.getTime() + 45 * 60_000),
        type: inc.type,
        plantId: plant.id,
        areaId: a.id,
        location: inc.location,
        reporterId: u.worker.id,
        description: inc.description,
        injuredPersonName: inc.injuredPersonName ?? null,
        injuredPersonAge: inc.injuredPersonAge ?? null,
        injuredPersonDesignation: inc.injuredPersonDesignation ?? null,
        bodyPart: inc.bodyPart ?? null,
        natureOfInjury: inc.natureOfInjury ?? null,
        lostDays: inc.lostDays,
        immediateCause: inc.immediateCause,
        rootCauseMethod: inc.rootCauseMethod,
        rootCauseDetail: inc.rootCauseDetail,
        correctiveActions: inc.correctiveActions,
        preventiveActions: inc.preventiveActions,
        immediateCauses: inc.immediateCauses,
        underlyingCauses: inc.underlyingCauses,
        rootCauses: inc.rootCauses,
        contributingFactors: inc.contributingFactors,
        severity: inc.severity,
        isReportable: inc.isReportable,
        reportableUnder: (inc as any).reportableUnder ?? [],
        status: inc.status,
        closedAt: isClosed ? new Date(incDate.getTime() + 21 * 24 * 3_600_000) : null,
        costMedical: (inc as any).costMedical ?? null,
        costPropertyDamage: (inc as any).costPropertyDamage ?? null,
        costLegalRegulatory: (inc as any).costLegalRegulatory ?? null,
        costOther: (inc as any).costOther ?? null,
        costTotal: (inc as any).costTotal ?? null,
        internalNotificationsSent: inc.internalNotificationsSent,
        form18Submitted: inc.isReportable && isClosed,
        dgfasliSubmitted: false,
        cpcbSubmitted: inc.isReportable && isClosed && ((inc as any).reportableUnder ?? []).includes("CPCB"),
      },
      update: { status: inc.status, closedAt: isClosed ? new Date(incDate.getTime() + 21 * 24 * 3_600_000) : null },
    });
  }
  console.log(`   ✓ ${P}: 10 Incidents seeded`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  SafeOps360 — Page Industries Activity Data Seed            ║");
  console.log("║  10 × 5 modules × 2 plants = 100 records            ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // ── Resolve both plants ──────────────────────────────────────────────
  const [nwRaw, swRaw] = await Promise.all([
    prisma.plant.findFirstOrThrow({ where: { code: "NW" }, include: { areas: true } }),
    prisma.plant.findFirstOrThrow({ where: { code: "SW" }, include: { areas: true } }),
  ]);

  // ── Idempotent cleanup — only DEMO-prefixed records ──────────────────
  console.log("   🧹 Removing previous DEMO- activity records…");
  const demoPrefix = { number: { startsWith: "INC-" } };
  const demoPrefixObs   = { number: { contains: "-DEMO-" } };
  await prisma.incident.deleteMany({ where: demoPrefixObs });
  await prisma.fLRA.deleteMany({ where: demoPrefixObs });
  await prisma.permit.deleteMany({ where: demoPrefixObs });
  await prisma.nearMiss.deleteMany({ where: demoPrefixObs });
  await prisma.observation.deleteMany({ where: demoPrefixObs });

  // ── Seed NW ──────────────────────────────────────────────────────────
  console.log("\n   🏭 Seeding NW plant…");
  const nwUsers = await resolveUsers("nw");
  await seedPlant("NW", nwRaw, nwUsers);

  // ── Seed SW ──────────────────────────────────────────────────────────
  console.log("\n   🏭 Seeding SW plant…");
  const swUsers = await resolveUsers("sw");
  await seedPlant("SW", swRaw, swUsers);

  // ── Summary ───────────────────────────────────────────────────────────
  const [obsCount, nmCount, permitCount, flraCount, incCount] = await Promise.all([
    prisma.observation.count({ where: { number: { contains: "-DEMO-" } } }),
    prisma.nearMiss.count({ where: { number: { contains: "-DEMO-" } } }),
    prisma.permit.count({ where: { number: { contains: "-DEMO-" } } }),
    prisma.fLRA.count({ where: { number: { contains: "-DEMO-" } } }),
    prisma.incident.count({ where: { number: { contains: "-DEMO-" } } }),
  ]);

  console.log("\n   ╔══════════════════════════════════════════════╗");
  console.log("   ║  Activity data seeded (DEMO- records)        ║");
  console.log(`   ║  Safety Observations : ${String(obsCount).padStart(3)}                  ║`);
  console.log(`   ║  Near Misses         : ${String(nmCount).padStart(3)}                  ║`);
  console.log(`   ║  Permits to Work     : ${String(permitCount).padStart(3)}                  ║`);
  console.log(`   ║  FLRAs               : ${String(flraCount).padStart(3)}                  ║`);
  console.log(`   ║  Incidents           : ${String(incCount).padStart(3)}                  ║`);
  console.log("   ╚══════════════════════════════════════════════╝");
  console.log("\n✅  Activity data seed complete.\n");
}

main()
  .catch(e => { console.error("❌  Seed failed:", e?.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
