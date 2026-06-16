// ────────────────────────────────────────────────────────────────────────
// seed-historical-data.ts
//
// Creates 12 months of historical activity records for analytics strips,
// trend charts, and LTIFR rolling windows.
//
// Volume (per plant):
//   Observations  : 10/month × 12 = 120
//   Near Misses   :  5/month × 12 =  60
//   Permits       : 12/month × 12 = 144
//   FLRAs         : 10/month × 12 = 120
//   Incidents     :  2/month × 12 =  24
//   ─────────────────────────────────────
//   Per plant                        468
//   Both plants (NW + SW)            936
//
// Numbering: {MODULE}-{PLANT}-HIST-{MM}-{NN}
//   MM = months ago (01 = last month, 12 = oldest)
//   NN = record sequence within that month
//
// Idempotent: all "-HIST-" records deleted before re-creating.
// Does NOT touch -DEMO- records or the LTI incidents created by
// seed-demo-state.ts / seed-activity-workflows.ts.
//
// Run: npx tsx prisma/seed-historical-data.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const DEMO_TODAY = new Date("2026-06-07T09:00:00.000Z");

// ── Time helpers ─────────────────────────────────────────────────────────

function firstOfMonth(monthsAgo: number): Date {
  const d = new Date(DEMO_TODAY);
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateInMonth(monthsAgo: number, seed: number): Date {
  const start = firstOfMonth(monthsAgo);
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const d = new Date(start);
  d.setDate(1 + (seed % daysInMonth));
  d.setHours(6 + (seed % 12), (seed * 7) % 60, 0, 0);
  return d;
}

// ── Rotating pick ─────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[], idx: number): T {
  return arr[((idx % arr.length) + arr.length) % arr.length];
}

// ── Description / type banks ──────────────────────────────────────────────

const OBS_TYPES = [
  "UNSAFE_ACT", "UNSAFE_CONDITION", "UNSAFE_ACT",
  "UNSAFE_CONDITION", "SAFE_ACT", "SAFE_CONDITION",
] as const;

const OBS_CATS = [
  "PPE", "HOUSEKEEPING", "WORK_AT_HEIGHT", "ELECTRICAL",
  "CHEMICAL_HANDLING", "MATERIAL_HANDLING", "HOT_WORK",
  "CONFINED_SPACE", "EMERGENCY_PREP",
] as const;

const OBS_SEVS = [
  "LOW", "MEDIUM", "MEDIUM", "HIGH", "MEDIUM",
  "LOW", "HIGH", "MEDIUM", "CRITICAL",
] as const;

const OBS_STATUSES_RECENT = ["OPEN", "IN_PROGRESS", "ASSIGNED", "CLOSED", "CLOSED"] as const;
const OBS_STATUSES_OLD    = ["CLOSED", "CLOSED", "CLOSED", "CLOSED", "IN_PROGRESS"] as const;

const OBS_DESCS = [
  "Worker not wearing required PPE near paper machine dryer section. Corrected on site.",
  "Pulp slurry spill on floor creating slip hazard near stock pump. Cleaned and barricaded.",
  "Working at height on recovery boiler platform without fall arrest equipment. Work stopped and PPE issued.",
  "Electrical panel door open near paper machine drive. Secured by maintenance team.",
  "Chemical handling at bleach plant observed without splash protection. PPE issued and task re-briefed.",
  "Emergency exit in finishing house partially obstructed by stacked reels. Obstruction removed immediately.",
  "Hot work under way on digester pipework without fire watch in position. Work suspended pending compliance.",
  "Confined space entry to stock chest attempted without gas test or standby person. Entry stopped.",
  "Fire extinguisher in paper machine hall beyond its last inspection date. Replacement raised as urgent action.",
  "Unsafe stacking of paper reels in warehouse bay creating topple risk. Restacked to safe height.",
  "Correct PPE worn and toolbox talk completed before high-risk task. Positive observation noted.",
  "Loose handrail on access staircase to recovery boiler mezzanine. Maintenance work order raised.",
] as const;

const NM_DESCS = [
  "Reel-handling clamp truck reversed into pedestrian zone in finishing house. No injury. Exclusion zone and signage reinforced.",
  "Slip hazard from black-liquor leak on walkway narrowly avoided by shift operator.",
  "Dropped object from elevated work on recovery boiler narrowly missed worker below. Exclusion zone re-established.",
  "Digester blow valve operated incorrectly releasing minor pulp stock. No injury. Procedure reviewed.",
  "Near miss during paper machine drive panel work — LOTO had not been verified before opening panel.",
  "Rigging load of press roll shifted unexpectedly during lift. Near miss — no personnel struck.",
  "Forklift reversed into marked pedestrian crossing zone near reel warehouse. Physical bollards installed as corrective.",
  "Chlorine dioxide drip onto walkway in bleach plant — operator slipped but caught self on handrail without injury.",
] as const;

const NM_SEV_OPTS = ["MEDIUM", "HIGH", "HIGH", "CRITICAL", "MEDIUM", "HIGH"] as const;
const NM_STATUSES_RECENT = ["REPORTED", "UNDER_REVIEW", "ACTION_ASSIGNED", "CLOSED"] as const;

const PTW_TYPES = [
  "HOT_WORK", "CONFINED_SPACE", "WORK_AT_HEIGHT",
  "ELECTRICAL_LOTO", "GENERAL_COLD", "EXCAVATION",
] as const;

const PTW_SCOPE_ITEMS = [
  "Welding repair on digester pipework in pulp mill. Gas test and firewatch in place.",
  "Confined space entry into stock chest for internal inspection. Gas test and attendant stationed.",
  "Elevated work on recovery boiler platform. Full-body harness and MEWP in use.",
  "Paper machine drive panel maintenance under full electrical LOTO. Test-before-touch confirmed.",
  "General maintenance task in finishing house. Isolations and PPE applied.",
  "Excavation for effluent line installation. Ground surveyed and utilities located by CAT scan.",
  "Pipe flange work on bleach plant line under hot work conditions. Continuous gas monitoring in place.",
  "Annual lime kiln inspection involving confined space. BA on standby.",
  "Cable tray installation at 5 m height in paper machine hall. Working platform and safety harness in use.",
  "Stock pump overhaul under full electrical LOTO. Isolation verified before work.",
  "Chlorine dioxide line maintenance under cold work permit. Double-block-and-bleed isolation.",
  "Structural inspection of chimney stack at height using erected scaffolding. Pre-use inspection complete.",
] as const;

const FLRA_JOBS = [
  "Routine paper machine maintenance with slip, trip, and manual handling hazards.",
  "Elevated work on recovery boiler requiring fall protection and MEWP operation.",
  "Hot work on digester pipework involving welding or grinding — fire and fume hazards.",
  "Paper machine drive electrical work under LOTO — shock and arc flash hazards.",
  "Bleach plant chemical handling with chlorine dioxide splash and inhalation hazards.",
  "Stock chest confined space inspection — O2 deficiency and toxic gas hazards.",
  "Digester mechanical isolation — stored energy and steam/pressure release hazards.",
  "Reel and bale handling — manual and mechanical lift with crush hazards.",
  "Effluent line excavation work — underground utilities and trench collapse hazards.",
  "Recovery boiler pressure-part maintenance — residual pressure and height hazards.",
] as const;

const FLRA_HAZARDS = JSON.stringify([
  {
    id: "1",
    hazard: "Slip, trip, and fall hazard",
    controlMeasure: "Non-slip footwear, area cleared of obstructions, adequate lighting confirmed",
  },
  {
    id: "2",
    hazard: "Manual handling injury",
    controlMeasure: "Team lift protocol applied, mechanical aid used where load exceeds 20 kg",
  },
  {
    id: "3",
    hazard: "PPE non-compliance",
    controlMeasure: "PPE check completed before work starts, supervisor sign-off obtained",
  },
]);

const INC_TYPES = [
  "FIRST_AID", "MTC", "FIRST_AID", "RWC",
  "PROPERTY_DAMAGE", "FIRST_AID", "MTC",
] as const;

const INC_SEVS = ["LOW", "LOW", "MEDIUM", "LOW", "MEDIUM", "LOW", "LOW"] as const;

const INC_STATUSES_RECENT = ["REPORTED", "INVESTIGATION", "CAPA_ASSIGNED", "CLOSED"] as const;

const INC_DESCS = [
  "Minor laceration sustained while clearing a sheet break on the paper machine. First aid treatment given on site.",
  "Sprain from slip on wet floor near couch pit. Medical treatment obtained. Restricted duty 3 days.",
  "Eye irritation from paper dust during reel slitting. Eye wash applied; no lasting injury.",
  "Back strain during manual handling of a heavy pulp bale. Restricted duty 5 days.",
  "Clamp truck contact with structural column during reel maneuvering. No injury — property damage only.",
  "Minor steam burn from incidental contact with dryer cylinder surface. First aid treatment given.",
  "Bruising from falling reel core striking arm. X-ray confirmed — no fracture.",
] as const;

// ── Seed one plant ────────────────────────────────────────────────────────

async function seedPlant(
  plantCode: "NW" | "SW",
  plantId: string,
  areaId: string,
  u: { hseId: string; supervisorId: string; workerId: string; issuerId: string }
) {
  const P      = plantCode;
  const MONTHS = 12;
  const OBS_N  = 10;
  const NM_N   = 5;
  const PTW_N  = 12;
  const FLRA_N = 10;
  const INC_N  = 2;

  // ── 1. Safety Observations ───────────────────────────────────────────
  const obsRows = [];
  for (let m = 1; m <= MONTHS; m++) {
    for (let n = 0; n < OBS_N; n++) {
      const s   = m * 100 + n;
      const d   = dateInMonth(m, s);
      const statusPool = m <= 2 ? OBS_STATUSES_RECENT : OBS_STATUSES_OLD;
      const status     = pick(statusPool, s);
      obsRows.push({
        number:             `OBS-${P}-HIST-${String(m).padStart(2, "0")}-${String(n + 1).padStart(2, "0")}`,
        observerId:         u.hseId,
        date:               d,
        plantId,
        areaId,
        type:               pick(OBS_TYPES, s),
        category:           pick(OBS_CATS, s + 3),
        severity:           pick(OBS_SEVS, s + 7),
        description:        pick(OBS_DESCS, s),
        status,
        isRepeat:           s % 7 === 0,
        permitReviewFlagged: false,
        closedAt:           status === "CLOSED" ? new Date(d.getTime() + 14 * 86_400_000) : null,
        closingRemark:      status === "CLOSED" ? "Corrective action completed and verified." : null,
      });
    }
  }
  await prisma.observation.createMany({ data: obsRows, skipDuplicates: true });
  console.log(`   ✓ ${P}: ${obsRows.length} Observations`);

  // ── 2. Near Misses ───────────────────────────────────────────────────
  const nmRows = [];
  for (let m = 1; m <= MONTHS; m++) {
    for (let n = 0; n < NM_N; n++) {
      const s      = m * 50 + n + 1000;
      const d      = dateInMonth(m, s);
      const status = m <= 2 ? pick(NM_STATUSES_RECENT, s) : "CLOSED";
      nmRows.push({
        number:                   `NM-${P}-HIST-${String(m).padStart(2, "0")}-${String(n + 1).padStart(2, "0")}`,
        reporterId:               u.workerId,
        date:                     d,
        plantId,
        areaId,
        description:              pick(NM_DESCS, s),
        potentialSeverity:        pick(NM_SEV_OPTS, s),
        status,
        isAnonymous:              false,
        multipleWorkersAggravator: false,
        closedAt:                 status === "CLOSED" ? new Date(d.getTime() + 21 * 86_400_000) : null,
        closingRemark:            status === "CLOSED" ? "Root cause addressed. Corrective actions closed." : null,
      });
    }
  }
  await prisma.nearMiss.createMany({ data: nmRows, skipDuplicates: true });
  console.log(`   ✓ ${P}: ${nmRows.length} Near Misses`);

  // ── 3. Permits to Work ───────────────────────────────────────────────
  const ptwRows = [];
  for (let m = 1; m <= MONTHS; m++) {
    for (let n = 0; n < PTW_N; n++) {
      const s         = m * 120 + n + 2000;
      const d         = dateInMonth(m, s);
      const validFrom = new Date(d.getTime() - 30 * 60_000);
      const validTo   = new Date(d.getTime() + 8 * 3_600_000);
      const status    = m === 1 ? pick(["SAFETY_APPROVED", "CLOSED", "CLOSED", "CLOSED"] as const, s) : "CLOSED";
      ptwRows.push({
        number:            `PTW-${P}-HIST-${String(m).padStart(2, "0")}-${String(n + 1).padStart(2, "0")}`,
        type:              pick(PTW_TYPES, s),
        plantId,
        areaId,
        location:          `${P} Plant — Work Area ${pick(["A", "B", "C", "D"] as const, s)}`,
        scopeOfWork:       pick(PTW_SCOPE_ITEMS, s),
        validFrom,
        validTo,
        originatorId:      u.supervisorId,
        issuerId:          u.issuerId,
        status,
        gasTestRequired:   s % 3 === 0,
        fireWatchRequired: s % 4 === 0,
        closedAt:          status === "CLOSED" ? validTo : null,
        closingRemark:     status === "CLOSED" ? "Work completed. Area restored and permit returned." : null,
      });
    }
  }
  await prisma.permit.createMany({ data: ptwRows, skipDuplicates: true });
  console.log(`   ✓ ${P}: ${ptwRows.length} Permits`);

  // ── 4. FLRAs ─────────────────────────────────────────────────────────
  const flraRows = [];
  for (let m = 1; m <= MONTHS; m++) {
    for (let n = 0; n < FLRA_N; n++) {
      const s      = m * 100 + n + 3000;
      const d      = dateInMonth(m, s);
      const status = m === 1
        ? pick(["COMPLETED", "COMPLETED", "IN_PROGRESS"] as const, s)
        : "COMPLETED";
      flraRows.push({
        number:                    `FLRA-${P}-HIST-${String(m).padStart(2, "0")}-${String(n + 1).padStart(2, "0")}`,
        plantId,
        date:                      d,
        location:                  `${P} Plant — Work Area ${pick(["A", "B", "C", "D", "E"] as const, s)}`,
        jobDescription:            pick(FLRA_JOBS, s),
        leaderId:                  u.supervisorId,
        hazards:                   FLRA_HAZARDS,
        status,
        completedAt:               status === "COMPLETED" ? new Date(d.getTime() + 45 * 60_000) : null,
        toolboxTalkConfirmed:      status === "COMPLETED",
        toolboxTalkConducted:      status === "COMPLETED",
        emergencyContactsConfirmed: status === "COMPLETED",
        isStandalone:              s % 5 === 0,
        jobIsRoutine:              s % 5 !== 0,
      });
    }
  }
  await prisma.fLRA.createMany({ data: flraRows, skipDuplicates: true });
  console.log(`   ✓ ${P}: ${flraRows.length} FLRAs`);

  // ── 5. Incidents ─────────────────────────────────────────────────────
  // lostDays is always 0 — LTI tracking is managed by seed-demo-state /
  // seed-activity-workflows to preserve the LTIFR = 0.34 dashboard KPI.
  const incRows = [];
  for (let m = 1; m <= MONTHS; m++) {
    for (let n = 0; n < INC_N; n++) {
      const s      = m * 20 + n + 4000;
      const d      = dateInMonth(m, s);
      const status = m <= 2 ? pick(INC_STATUSES_RECENT, s) : "CLOSED";
      incRows.push({
        number:      `INC-${P}-HIST-${String(m).padStart(2, "0")}-${String(n + 1).padStart(2, "0")}`,
        date:        d,
        occurredAt:  d,
        reportedAt:  new Date(d.getTime() + 30 * 60_000),
        type:        pick(INC_TYPES, s),
        plantId,
        areaId,
        location:    `${P} Plant — Area ${pick(["A", "B", "C", "D"] as const, s)}`,
        reporterId:  u.workerId,
        description: pick(INC_DESCS, s),
        severity:    pick(INC_SEVS, s),
        status,
        lostDays:    0,
        isReportable: s % 11 === 0,
        closedAt:    status === "CLOSED" ? new Date(d.getTime() + 14 * 86_400_000) : null,
      });
    }
  }
  await prisma.incident.createMany({ data: incRows, skipDuplicates: true });
  console.log(`   ✓ ${P}: ${incRows.length} Incidents`);
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  SafeOps360 — Historical Activity Data Seed                  ║");
  console.log("║  12 months × 5 modules × 2 plants = 936 records             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const [nw, sw] = await Promise.all([
    prisma.plant.findFirstOrThrow({ where: { code: "NW" }, include: { areas: { take: 1 } } }),
    prisma.plant.findFirstOrThrow({ where: { code: "SW" }, include: { areas: { take: 1 } } }),
  ]);

  async function getUsers(pl: "nw" | "sw") {
    const get = (email: string) => prisma.user.findFirstOrThrow({ where: { email } });
    const [hse, supervisor, worker, issuer] = await Promise.all([
      pl === "nw"
        ? prisma.user.findFirstOrThrow({ where: { email: "hse-manager.it.nw@safeops360.in" } })
        : get(`hse-manager.it.${pl}@safeops360.in`),
      get(`supervisor.it.${pl}@safeops360.in`),
      get(`worker.it.${pl}@safeops360.in`),
      get(`permit-issuer.it.${pl}@safeops360.in`),
    ]);
    return {
      hseId:        hse.id,
      supervisorId: supervisor.id,
      workerId:     worker.id,
      issuerId:     issuer.id,
    };
  }

  // Idempotent cleanup — remove all previous HIST- records
  console.log("   🧹 Removing previous -HIST- records…");
  const histWhere = { number: { contains: "-HIST-" } };
  await Promise.all([
    prisma.incident.deleteMany({ where: histWhere }),
    prisma.fLRA.deleteMany({ where: histWhere }),
    prisma.permit.deleteMany({ where: histWhere }),
    prisma.nearMiss.deleteMany({ where: histWhere }),
    prisma.observation.deleteMany({ where: histWhere }),
  ]);

  // Seed NW plant
  console.log("\n   🏭 Seeding NW plant…");
  const nwUsers = await getUsers("nw");
  await seedPlant("NW", nw.id, nw.areas[0]!.id, nwUsers);

  // Seed SW plant
  console.log("\n   🏭 Seeding SW plant…");
  const swUsers = await getUsers("sw");
  await seedPlant("SW", sw.id, sw.areas[0]!.id, swUsers);

  // Verification counts
  const hw = { contains: "-HIST-" };
  const [obs, nm, ptw, flra, inc] = await Promise.all([
    prisma.observation.count({ where: { number: hw } }),
    prisma.nearMiss.count({ where: { number: hw } }),
    prisma.permit.count({ where: { number: hw } }),
    prisma.fLRA.count({ where: { number: hw } }),
    prisma.incident.count({ where: { number: hw } }),
  ]);
  const total = obs + nm + ptw + flra + inc;

  console.log("\n   ╔══════════════════════════════════════════════════╗");
  console.log("   ║  Historical seed — record counts (-HIST-)        ║");
  console.log(`   ║  Observations  : ${String(obs).padStart(4)}                           ║`);
  console.log(`   ║  Near Misses   : ${String(nm).padStart(4)}                           ║`);
  console.log(`   ║  Permits       : ${String(ptw).padStart(4)}                           ║`);
  console.log(`   ║  FLRAs         : ${String(flra).padStart(4)}                           ║`);
  console.log(`   ║  Incidents     : ${String(inc).padStart(4)}                           ║`);
  console.log("   ║  ─────────────────                               ║");
  console.log(`   ║  TOTAL         : ${String(total).padStart(4)}                           ║`);
  console.log("   ╚══════════════════════════════════════════════════╝");
  console.log("\n✅  Historical data seed complete.\n");
}

main()
  .catch(e => { console.error("❌  Seed failed:", e?.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
