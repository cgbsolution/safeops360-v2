/**
 * Patch: seed 17 months of manhours for Meridian South Works (SW).
 *
 * SW is a slightly smaller plant than NW. Performance is marginally worse
 * (LTIFR ~2.10 vs NW ~1.70) so Compare Plants shows a meaningful gap.
 *
 * Trailing-12M (Jun 2025 – May 2026) design:
 *   Regular months : eH 132 200 + cH 37 400 = 169 600
 *   Shorter months : eH 128 100 + cH 36 100 = 164 200
 *   February       : eH 120 100 + cH 33 600 = 153 700
 *   Total trailing-12M hours ≈ 1 993 100
 *   3 LTIs → LTIFR ≈ 3 × 200 000 / 1 993 100 ≈ 0.30  (display value ~0.30)
 *
 * Note: these are stored in the legacy Manhours table (pre-submission wizard).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type MonthRow = {
  year: number; month: number;
  employeeHours: number; contractorHours: number;
  ltiCount: number; rwcCount: number; mtcCount: number;
  facCount: number; lostDays: number;
};

// SW monthly data — 17 months Jan 2025 – May 2026
const SW_DATA: MonthRow[] = [
  // ── 2025 pre-history (Jan–May) ──
  { year: 2025, month: 1,  employeeHours: 132200, contractorHours: 37400, ltiCount: 0, rwcCount: 1, mtcCount: 2, facCount: 2, lostDays: 0 },
  { year: 2025, month: 2,  employeeHours: 120100, contractorHours: 33600, ltiCount: 0, rwcCount: 1, mtcCount: 1, facCount: 1, lostDays: 0 },
  { year: 2025, month: 3,  employeeHours: 132200, contractorHours: 37400, ltiCount: 0, rwcCount: 0, mtcCount: 2, facCount: 3, lostDays: 0 },
  { year: 2025, month: 4,  employeeHours: 128100, contractorHours: 36100, ltiCount: 0, rwcCount: 1, mtcCount: 1, facCount: 2, lostDays: 0 },
  { year: 2025, month: 5,  employeeHours: 132200, contractorHours: 37400, ltiCount: 0, rwcCount: 0, mtcCount: 2, facCount: 2, lostDays: 0 },
  // ── Trailing-12M window starts Jun 2025 ──
  { year: 2025, month: 6,  employeeHours: 128100, contractorHours: 36100, ltiCount: 0, rwcCount: 1, mtcCount: 2, facCount: 3, lostDays: 0 },
  // LTI #1 — Aug 2025
  { year: 2025, month: 7,  employeeHours: 132200, contractorHours: 37400, ltiCount: 0, rwcCount: 1, mtcCount: 1, facCount: 2, lostDays: 0 },
  { year: 2025, month: 8,  employeeHours: 132200, contractorHours: 37400, ltiCount: 1, rwcCount: 0, mtcCount: 2, facCount: 3, lostDays: 9 },
  { year: 2025, month: 9,  employeeHours: 128100, contractorHours: 36100, ltiCount: 0, rwcCount: 1, mtcCount: 2, facCount: 2, lostDays: 0 },
  { year: 2025, month: 10, employeeHours: 132200, contractorHours: 37400, ltiCount: 0, rwcCount: 0, mtcCount: 1, facCount: 2, lostDays: 0 },
  // LTI #2 — Nov 2025
  { year: 2025, month: 11, employeeHours: 128100, contractorHours: 36100, ltiCount: 1, rwcCount: 1, mtcCount: 2, facCount: 3, lostDays: 6 },
  { year: 2025, month: 12, employeeHours: 132200, contractorHours: 37400, ltiCount: 0, rwcCount: 1, mtcCount: 1, facCount: 2, lostDays: 0 },
  // ── 2026 ──
  { year: 2026, month: 1,  employeeHours: 132200, contractorHours: 37400, ltiCount: 0, rwcCount: 0, mtcCount: 2, facCount: 3, lostDays: 0 },
  { year: 2026, month: 2,  employeeHours: 120100, contractorHours: 33600, ltiCount: 0, rwcCount: 1, mtcCount: 2, facCount: 2, lostDays: 0 },
  { year: 2026, month: 3,  employeeHours: 132200, contractorHours: 37400, ltiCount: 0, rwcCount: 1, mtcCount: 1, facCount: 2, lostDays: 0 },
  // LTI #3 — Apr 2026
  { year: 2026, month: 4,  employeeHours: 128100, contractorHours: 36100, ltiCount: 1, rwcCount: 0, mtcCount: 2, facCount: 3, lostDays: 4 },
  { year: 2026, month: 5,  employeeHours: 132200, contractorHours: 37400, ltiCount: 0, rwcCount: 1, mtcCount: 1, facCount: 2, lostDays: 0 },
];

async function main() {
  const swPlant = await prisma.plant.findUnique({ where: { code: "SW" } });
  if (!swPlant) throw new Error("SW plant not found");

  console.log(`Seeding ${SW_DATA.length} months of manhours for ${swPlant.name}…`);

  for (const m of SW_DATA) {
    const totalHours = m.employeeHours + m.contractorHours;
    const ltifr = totalHours > 0 ? (m.ltiCount * 200_000) / totalHours : 0;
    const trir  = totalHours > 0 ? ((m.ltiCount + m.rwcCount + m.mtcCount) * 200_000) / totalHours : 0;
    const severityRate = totalHours > 0 ? (m.lostDays * 200_000) / totalHours : 0;

    await prisma.manhours.upsert({
      where: { plantId_year_month: { plantId: swPlant.id, year: m.year, month: m.month } },
      create: {
        plantId: swPlant.id,
        year: m.year, month: m.month,
        employeeHours: m.employeeHours, contractorHours: m.contractorHours,
        ltiCount: m.ltiCount, rwcCount: m.rwcCount, mtcCount: m.mtcCount,
        facCount: m.facCount, lostDays: m.lostDays,
        ltifr: parseFloat(ltifr.toFixed(4)),
        trir:  parseFloat(trir.toFixed(4)),
        severityRate: parseFloat(severityRate.toFixed(4)),
        locked: m.year < 2026 || m.month < 5,
      },
      update: {
        employeeHours: m.employeeHours, contractorHours: m.contractorHours,
        ltiCount: m.ltiCount, rwcCount: m.rwcCount, mtcCount: m.mtcCount,
        facCount: m.facCount, lostDays: m.lostDays,
        ltifr: parseFloat(ltifr.toFixed(4)),
        trir:  parseFloat(trir.toFixed(4)),
        severityRate: parseFloat(severityRate.toFixed(4)),
        locked: m.year < 2026 || m.month < 5,
      },
    });
  }

  const trailing = SW_DATA.filter(m =>
    (m.year === 2025 && m.month >= 6) || (m.year === 2026 && m.month <= 5)
  );
  const hours = trailing.reduce((s, m) => s + m.employeeHours + m.contractorHours, 0);
  const ltis  = trailing.reduce((s, m) => s + m.ltiCount, 0);
  const rec   = trailing.reduce((s, m) => s + m.ltiCount + m.rwcCount + m.mtcCount, 0);
  console.log(`✅  SW manhours seeded.`);
  console.log(`   Trailing-12M hours : ${hours.toLocaleString()}`);
  console.log(`   LTIFR              : ${(ltis * 200_000 / hours).toFixed(2)}`);
  console.log(`   TRIR               : ${(rec  * 200_000 / hours).toFixed(2)}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
