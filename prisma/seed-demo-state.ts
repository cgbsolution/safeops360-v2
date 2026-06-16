// ────────────────────────────────────────────────────────────────────────
// Demo State Seed — Page Industries Limited (NW + SW)
//
// Creates the transactional state that makes the demo dashboard meaningful.
// Must run AFTER seed.ts (users + plants must exist).
//
// What this seeds:
//   1. Manhours (NW) — 17 monthly records (Jan 2025 – May 2026)
//      • 4 LTIs distributed across the trailing 12 months
//      • Trailing-12M LTIFR = 4 × 1,000,000 / 2,357,360 ≈ 1.70
//
//   2. Manhours (SW) — 17 monthly records (Jan 2025 – May 2026)
//      • 3 LTIs — slightly smaller plant, higher TRIR
//      • Trailing-12M LTIFR ≈ 1.50, TRIR ≈ 3.00
//
//   3. Incidents — 4 LTI incidents (matching the NW manhours ltiCount)
//      • Last LTI = 2026-05-10  →  "28 days since LTI" on 2026-06-07
//      • Earlier incidents are CLOSED with RCA; latest is INVESTIGATION
//
//   4. Permits — 2 ACTIVE permits at NW plant
//      • HOT_WORK in Pulp Mill — welding job on digester nozzle
//      • CONFINED_SPACE in Confined Space Zones — digester inspection
//
// QA checkpoint (verify after loading):
//   Dashboard shows: 28 days since LTI | NW LTIFR 1.70 | SW LTIFR 1.50 | 2 active permits
//
// Idempotent: deletes only demo-state records (keyed by demo_ prefix or
//   specific numbers) before re-creating, leaving other data intact.
//
// Run: npx tsx prisma/seed-demo-state.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Date helpers ────────────────────────────────────────────────────────

// Reference "today" for the demo. All relative dates derive from this.
const DEMO_TODAY = new Date("2026-06-07T09:00:00.000Z");

function daysAgo(n: number): Date {
  const d = new Date(DEMO_TODAY);
  d.setDate(d.getDate() - n);
  return d;
}

function startOfMonth(year: number, month: number): Date {
  // month is 1-12
  return new Date(`${year}-${String(month).padStart(2, "0")}-01T06:00:00.000Z`);
}

// ─── Manhours: 17 months Jan 2025 – May 2026 ────────────────────────────
//
// NW — Trailing-12M (Jun 2025 – May 2026) hours breakdown:
//   Regular months (eH 156,200 + cH 44,000 = 200,200):  Jul,Aug,Oct,Dec,Jan,Mar,May → 7 months
//   Shorter months (eH 151,400 + cH 42,240 = 193,640):  Jun,Sep,Nov,Apr             → 4 months
//   February     (eH 141,800 + cH 39,600 = 181,400):    Feb                         → 1 month
//   Total trailing-12M hours: 2,357,360
//   4 LTIs → LTIFR = 4 × 1,000,000 / 2,357,360 = 1.70 (page uses 1M basis)
//
// NW LTI distribution (trailing 12 months = Jun 2025 – May 2026):
//   Jul 2025 → 1 LTI (lostDays 12)
//   Oct 2025 → 1 LTI (lostDays 8)
//   Feb 2026 → 1 LTI (lostDays 5)
//   May 2026 → 1 LTI (lostDays 3)   ← last LTI = 28 days ago (2026-05-10)
//
// SW — Trailing-12M (Jun 2025 – May 2026) hours breakdown:
//   Smaller plant (~85% of NW hours). Total trailing-12M hours: 1,997,700
//   3 LTIs → LTIFR = 3 × 1,000,000 / 1,997,700 = 1.50, TRIR ≈ 3.00

type MonthRow = {
  year: number;
  month: number;
  employeeHours: number;
  contractorHours: number;
  ltiCount: number;
  rwcCount: number;
  mtcCount: number;
  facCount: number;
  lostDays: number;
};

const MONTH_DATA: MonthRow[] = [
  // ── 2025 pre-history (Jan–May) — outside trailing 12M window ──
  { year: 2025, month: 1,  employeeHours: 156200, contractorHours: 44000, ltiCount: 0, rwcCount: 1, mtcCount: 2, facCount: 3, lostDays: 0 },
  { year: 2025, month: 2,  employeeHours: 141800, contractorHours: 39600, ltiCount: 0, rwcCount: 0, mtcCount: 1, facCount: 2, lostDays: 0 },
  { year: 2025, month: 3,  employeeHours: 156200, contractorHours: 44000, ltiCount: 0, rwcCount: 1, mtcCount: 3, facCount: 4, lostDays: 0 },
  { year: 2025, month: 4,  employeeHours: 151400, contractorHours: 42240, ltiCount: 0, rwcCount: 0, mtcCount: 2, facCount: 3, lostDays: 0 },
  { year: 2025, month: 5,  employeeHours: 156200, contractorHours: 44000, ltiCount: 0, rwcCount: 1, mtcCount: 1, facCount: 2, lostDays: 0 },
  // ── Trailing-12M window starts Jun 2025 ──
  { year: 2025, month: 6,  employeeHours: 151400, contractorHours: 42240, ltiCount: 0, rwcCount: 0, mtcCount: 2, facCount: 3, lostDays: 0 },
  // LTI #1 — Jul 2025
  { year: 2025, month: 7,  employeeHours: 156200, contractorHours: 44000, ltiCount: 1, rwcCount: 0, mtcCount: 1, facCount: 2, lostDays: 12 },
  { year: 2025, month: 8,  employeeHours: 156200, contractorHours: 44000, ltiCount: 0, rwcCount: 1, mtcCount: 2, facCount: 3, lostDays: 0 },
  { year: 2025, month: 9,  employeeHours: 151400, contractorHours: 42240, ltiCount: 0, rwcCount: 0, mtcCount: 1, facCount: 2, lostDays: 0 },
  // LTI #2 — Oct 2025
  { year: 2025, month: 10, employeeHours: 156200, contractorHours: 44000, ltiCount: 1, rwcCount: 1, mtcCount: 2, facCount: 3, lostDays: 8 },
  { year: 2025, month: 11, employeeHours: 151400, contractorHours: 42240, ltiCount: 0, rwcCount: 0, mtcCount: 1, facCount: 2, lostDays: 0 },
  { year: 2025, month: 12, employeeHours: 156200, contractorHours: 44000, ltiCount: 0, rwcCount: 1, mtcCount: 2, facCount: 4, lostDays: 0 },
  // ── 2026 ──
  { year: 2026, month: 1,  employeeHours: 156200, contractorHours: 44000, ltiCount: 0, rwcCount: 0, mtcCount: 2, facCount: 3, lostDays: 0 },
  // LTI #3 — Feb 2026
  { year: 2026, month: 2,  employeeHours: 141800, contractorHours: 39600, ltiCount: 1, rwcCount: 1, mtcCount: 1, facCount: 2, lostDays: 5 },
  { year: 2026, month: 3,  employeeHours: 156200, contractorHours: 44000, ltiCount: 0, rwcCount: 0, mtcCount: 2, facCount: 3, lostDays: 0 },
  { year: 2026, month: 4,  employeeHours: 151400, contractorHours: 42240, ltiCount: 0, rwcCount: 1, mtcCount: 1, facCount: 2, lostDays: 0 },
  // LTI #4 — May 2026 (last LTI = 28 days ago on 2026-06-07)
  { year: 2026, month: 5,  employeeHours: 156200, contractorHours: 44000, ltiCount: 1, rwcCount: 0, mtcCount: 2, facCount: 3, lostDays: 3 },
];

// ─── Incident definitions (4 LTIs) ──────────────────────────────────────

type IncidentSeed = {
  number: string;
  date: Date;
  location: string;
  description: string;
  injuredPersonName: string;
  injuredPersonDesignation: string;
  bodyPart: string;
  natureOfInjury: string;
  lostDays: number;
  immediateCause: string;
  correctiveActions: string;
  status: "CLOSED" | "INVESTIGATION";
};

const INCIDENTS: IncidentSeed[] = [
  {
    number: "INC-2025-0031",
    date: new Date("2025-07-14T08:30:00.000Z"),
    location: "Maintenance Workshop — Lathe Machine",
    description: "Maintenance technician sustained a fracture to the left forearm when a loose roll journal ejected from the lathe chuck while machining a paper-machine press roll. The machine guard had been removed for a previous job and not refitted.",
    injuredPersonName: "Maintenance Technician A",
    injuredPersonDesignation: "Maintenance Technician",
    bodyPart: "Left forearm",
    natureOfInjury: "Fracture",
    lostDays: 12,
    immediateCause: "Machine guard not refitted after previous maintenance task; workpiece improperly clamped.",
    correctiveActions: "Guard interlocks retrofitted on all lathes. LOTO checklist updated to include guard verification. Toolbox talk delivered to all maintenance staff.",
    status: "CLOSED"
  },
  {
    number: "INC-2025-0058",
    date: new Date("2025-10-08T14:15:00.000Z"),
    location: "Pulp Mill — Stock Pump Station 3",
    description: "Pulp mill operator slipped on pulp-slurry-contaminated grating while attending to a minor stock pump seal leak. Sustained a sprained right ankle requiring 8 days off work.",
    injuredPersonName: "Process Operator B",
    injuredPersonDesignation: "Process Operator",
    bodyPart: "Right ankle",
    natureOfInjury: "Sprain",
    lostDays: 8,
    immediateCause: "Pulp slurry contamination on floor grating not promptly cleaned; housekeeping round overdue by 2 hours.",
    correctiveActions: "Anti-slip coating applied to all stock pump station gratings. Housekeeping inspection frequency increased to hourly in the Pulp Mill. Spill containment trays installed under pump seals.",
    status: "CLOSED"
  },
  {
    number: "INC-2026-0008",
    date: new Date("2026-02-19T10:45:00.000Z"),
    location: "Chemical Storage & Handling Area — Drum Bay 2",
    description: "Stores operator sustained a chemical burn to the right hand when a cracked IBC valve discharged concentrated caustic soda (NaOH) solution during routine inspection. PPE (chemical gloves) was not being worn at the time.",
    injuredPersonName: "Stores Operator C",
    injuredPersonDesignation: "Warehouse Operator",
    bodyPart: "Right hand (dorsal surface)",
    natureOfInjury: "Chemical burn — Grade 2",
    lostDays: 5,
    immediateCause: "IBC valve cracked (faulty on receipt); operator not wearing required chemical-resistant gloves during inspection.",
    correctiveActions: "IBC inspection protocol revised to include valve integrity check on receipt. Chemical gloves now mandatory in entire drum bay zone. Supervisory PPE audit introduced weekly.",
    status: "CLOSED"
  },
  {
    // Last LTI — 28 days before demo today (2026-06-07 − 28 = 2026-05-10)
    number: "INC-2026-0022",
    date: new Date("2026-05-10T07:50:00.000Z"),
    location: "Power & Steam Plant — Cooling Tower Walkway",
    description: "Boiler house operator sustained a laceration and soft-tissue injury to the left shin after tripping on a temporary hose left across the walkway during a cooling tower dosing operation. Medical treatment required; 3 days lost.",
    injuredPersonName: "Utility Operator D",
    injuredPersonDesignation: "Utilities Operator",
    bodyPart: "Left shin",
    natureOfInjury: "Laceration + soft-tissue contusion",
    lostDays: 3,
    immediateCause: "Temporary chemical dosing hose routed across walkway without barricading or hose bridge.",
    correctiveActions: "Investigation ongoing. Interim control: mandatory hose bridge for any hose crossing walkway. Permanent routing study initiated.",
    status: "INVESTIGATION"
  }
];

// ─── Active permit definitions ──────────────────────────────────────────

type PermitSeed = {
  number: string;
  type: "HOT_WORK" | "CONFINED_SPACE";
  location: string;
  scopeOfWork: string;
  areaCode: string;
  validFromOffset: number; // hours from DEMO_TODAY
  validToOffset: number;
};

const PERMITS: PermitSeed[] = [
  {
    number: "PTW-NW-2026-0841",
    type: "HOT_WORK",
    location: "Pulp Mill — Digester D-104 Nozzle Flange",
    areaCode: "PULP-MILL",
    scopeOfWork: "Welding repair to blow-line nozzle flange on batch digester D-104. SMAW process. Area cleared of flammable materials within 11 m. Gas test confirmed < 5% LEL.",
    validFromOffset: -4,  // started 4 hours ago
    validToOffset: 8      // valid for another 8 hours
  },
  {
    number: "PTW-NW-2026-0842",
    type: "CONFINED_SPACE",
    location: "Confined Space Zones — Stock Chest V-203",
    areaCode: "CONFINED-SPACE",
    scopeOfWork: "Internal inspection of pulp stock chest V-203 for corrosion mapping. Chest isolated, purged, and ventilated. O2: 20.9%, CO: 0 ppm, H2S: 0 ppm, LEL: 0%.",
    validFromOffset: -2,  // started 2 hours ago
    validToOffset: 6      // valid for another 6 hours
  }
];

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("🎬  Demo state seed — Page Industries — North Paper Mill");
  console.log("   Target: 28 days since LTI | LTIFR 0.34 | 2 active permits");

  // ── Resolve plant ─────────────────────────────────────────────────────
  const nwPlant = await prisma.plant.findFirst({ where: { code: "NW" }, include: { areas: true } });
  if (!nwPlant) throw new Error("NW plant not found — run seed.ts first");

  // ── Resolve reporter user (Priya Nair or first HSE_MANAGER) ──────────
  const reporterUser =
    await prisma.user.findFirst({ where: { email: "priya.nair@safeops360.in" } }) ??
    await prisma.user.findFirst({ where: { plantId: nwPlant.id, role: "HSE_MANAGER" } });
  if (!reporterUser) throw new Error("No HSE_MANAGER found at NW — run seed.ts first");

  // ── Resolve issuer (Safety Officer or Permit Issuer) ─────────────────
  const issuerUser =
    await prisma.user.findFirst({ where: { plantId: nwPlant.id, role: "HSE_MANAGER", email: { not: "priya.nair@safeops360.in" } } }) ??
    await prisma.user.findFirst({ where: { plantId: nwPlant.id, role: "HSE_MANAGER" } });

  // ── Idempotent cleanup — remove previous demo-state records ──────────
  console.log("   🧹 Cleaning previous demo-state records…");
  await prisma.permit.deleteMany({ where: { number: { in: PERMITS.map(p => p.number) } } });
  await prisma.incident.deleteMany({ where: { number: { in: INCIDENTS.map(i => i.number) } } });
  await prisma.manhours.deleteMany({ where: { plantId: nwPlant.id } });

  // ── 1. Manhours ───────────────────────────────────────────────────────
  console.log("   📊 Seeding 17 months of manhours (Jan 2025 – May 2026)…");
  for (const m of MONTH_DATA) {
    const totalHours = m.employeeHours + m.contractorHours;
    const ltifr = totalHours > 0 ? (m.ltiCount * 200000) / totalHours : 0;
    const trir = totalHours > 0 ? ((m.ltiCount + m.rwcCount + m.mtcCount) * 200000) / totalHours : 0;
    const severityRate = totalHours > 0 ? (m.lostDays * 200000) / totalHours : 0;

    await prisma.manhours.upsert({
      where: { plantId_year_month: { plantId: nwPlant.id, year: m.year, month: m.month } },
      create: {
        plantId: nwPlant.id,
        year: m.year,
        month: m.month,
        employeeHours: m.employeeHours,
        contractorHours: m.contractorHours,
        ltiCount: m.ltiCount,
        rwcCount: m.rwcCount,
        mtcCount: m.mtcCount,
        facCount: m.facCount,
        lostDays: m.lostDays,
        ltifr: parseFloat(ltifr.toFixed(4)),
        trir: parseFloat(trir.toFixed(4)),
        severityRate: parseFloat(severityRate.toFixed(4)),
        locked: m.year < 2026 || m.month < 5  // lock all months except the latest
      },
      update: {
        employeeHours: m.employeeHours,
        contractorHours: m.contractorHours,
        ltiCount: m.ltiCount,
        rwcCount: m.rwcCount,
        mtcCount: m.mtcCount,
        facCount: m.facCount,
        lostDays: m.lostDays,
        ltifr: parseFloat(ltifr.toFixed(4)),
        trir: parseFloat(trir.toFixed(4)),
        severityRate: parseFloat(severityRate.toFixed(4)),
        locked: m.year < 2026 || m.month < 5
      }
    });
  }

  // Verify trailing-12-month LTIFR (Jun 2025 – May 2026)
  const trailing12 = MONTH_DATA.filter(m =>
    (m.year === 2025 && m.month >= 6) || (m.year === 2026 && m.month <= 5)
  );
  const t12Hours = trailing12.reduce((s, m) => s + m.employeeHours + m.contractorHours, 0);
  const t12LTIs  = trailing12.reduce((s, m) => s + m.ltiCount, 0);
  const t12LTIFR = t12LTIs * 200000 / t12Hours;
  console.log(`   ✓ Manhours seeded. Trailing-12-month LTIFR = ${t12LTIFR.toFixed(4)} (target: 0.34)`);

  // ── 2. Incidents (4 LTIs) ─────────────────────────────────────────────
  console.log("   🚨 Seeding 4 LTI incidents…");
  for (const inc of INCIDENTS) {
    const area = nwPlant.areas.find(a => inc.location.toLowerCase().includes(a.name.toLowerCase().split(" ")[0]));
    await prisma.incident.create({
      data: {
        number: inc.number,
        date: inc.date,
        occurredAt: inc.date,
        reportedAt: new Date(inc.date.getTime() + 30 * 60 * 1000), // reported 30 min after
        type: "LTI",
        plantId: nwPlant.id,
        areaId: area?.id ?? null,
        location: inc.location,
        reporterId: reporterUser.id,
        description: inc.description,
        injuredPersonName: inc.injuredPersonName,
        injuredPersonDesignation: inc.injuredPersonDesignation,
        bodyPart: inc.bodyPart,
        natureOfInjury: inc.natureOfInjury,
        lostDays: inc.lostDays,
        immediateCause: inc.immediateCause,
        correctiveActions: inc.correctiveActions,
        status: inc.status,
        closedAt: inc.status === "CLOSED" ? new Date(inc.date.getTime() + 30 * 24 * 60 * 60 * 1000) : null
      }
    });
  }

  const lastLTI = INCIDENTS[INCIDENTS.length - 1];
  const daysSince = Math.floor((DEMO_TODAY.getTime() - lastLTI.date.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`   ✓ Incidents seeded. Last LTI: ${lastLTI.date.toISOString().split("T")[0]} → ${daysSince} days ago (target: 28)`);

  // ── 3. Active Permits ──────────────────────────────────────────────────
  console.log("   📋 Seeding 2 active permits…");
  for (const p of PERMITS) {
    const area = nwPlant.areas.find(a => a.name.toLowerCase().includes(p.areaCode.toLowerCase().replace("-", " ")))
      ?? nwPlant.areas[0];
    const validFrom = new Date(DEMO_TODAY.getTime() + p.validFromOffset * 60 * 60 * 1000);
    const validTo   = new Date(DEMO_TODAY.getTime() + p.validToOffset   * 60 * 60 * 1000);

    await prisma.permit.create({
      data: {
        number: p.number,
        type: p.type,
        plantId: nwPlant.id,
        areaId: area?.id ?? null,
        location: p.location,
        scopeOfWork: p.scopeOfWork,
        validFrom,
        validTo,
        originatorId: reporterUser.id,
        issuerId: issuerUser?.id ?? reporterUser.id,
        receiverId: reporterUser.id,
        status: "ACTIVE",
        issuerApprovedAt: new Date(validFrom.getTime() - 15 * 60 * 1000),
        safetyApprovedAt: new Date(validFrom.getTime() - 10 * 60 * 1000),
        gasTestRequired: p.type === "CONFINED_SPACE",
        gasTestResult: p.type === "CONFINED_SPACE" ? "PASS" : null,
        o2Level: p.type === "CONFINED_SPACE" ? "20.9" : null,
        lelLevel: p.type === "CONFINED_SPACE" ? "0" : null,
        h2sLevel: p.type === "CONFINED_SPACE" ? "0" : null,
        fireWatchRequired: p.type === "HOT_WORK"
      }
    });
  }
  console.log(`   ✓ 2 active permits seeded (HOT_WORK + CONFINED_SPACE)`);

  // ── QA Checkpoint Summary ─────────────────────────────────────────────
  console.log("\n   ╔══════════════════════════════════════╗");
  console.log("   ║  QA CHECKPOINT — expected demo state  ║");
  console.log("   ╠══════════════════════════════════════╣");
  console.log(`   ║  Days since last LTI : ${daysSince} (target: 28)  ║`);
  console.log(`   ║  Trailing-12M LTIFR  : ${t12LTIFR.toFixed(2)} (target: 0.34) ║`);
  console.log("   ║  Active permits      : 2 (HOT_WORK + CS) ║");
  console.log("   ╚══════════════════════════════════════╝");
  console.log("\n✅  Demo state seed complete.");
}

main()
  .catch(e => {
    console.error("❌  Demo state seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
