// ────────────────────────────────────────────────────────────────────────
// Near Miss data-integrity repair.
//
// Fixes two issues introduced by prisma/seed.ts:
//
//   1. promotedToIncident=true on records that have no linked Incident.
//      The list page renders a "Promoted" badge purely off the boolean
//      flag, but the detail page expects promotedIncidentId to be set so
//      it can render the "Promoted to incident" cross-link. Result: the
//      list misleads viewers into thinking the record was promoted when
//      no incident actually exists.
//
//      Resolution: clear the misleading flag. The seed never created the
//      target Incident, so there is no link to recover.
//
//   2. status=CLOSED with closedAt=null. The detail page formats the
//      closure timestamp ("Closed on …") and shows "—" when null, which
//      reads as a half-finished closure.
//
//      Resolution: backfill closedAt at a plausible point between the
//      report date and now (within the SLA window).
//
// Run: npx tsx scripts/repair-near-miss-data.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const randInt = (lo: number, hi: number) =>
  Math.floor(Math.random() * (hi - lo + 1)) + lo;
const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3600_000);

async function main() {
  console.log("─── Near Miss data repair ──────────────────────────────");

  // ── Issue 1: orphan promotedToIncident flags ─────────────────────
  const orphanPromoted = await prisma.nearMiss.findMany({
    where: { promotedToIncident: true, promotedIncidentId: null },
    select: { id: true, number: true, status: true, potentialSeverity: true }
  });

  if (orphanPromoted.length === 0) {
    console.log("✓ No orphan 'Promoted' flags found.");
  } else {
    console.log(`Clearing 'Promoted' flag on ${orphanPromoted.length} records:`);
    for (const r of orphanPromoted) {
      console.log(`  ${r.number}  (${r.status}, ${r.potentialSeverity})`);
    }
    await prisma.nearMiss.updateMany({
      where: { id: { in: orphanPromoted.map((r) => r.id) } },
      data: { promotedToIncident: false }
    });
  }

  // ── Issue 2: CLOSED with no closedAt ─────────────────────────────
  const closedNoTs = await prisma.nearMiss.findMany({
    where: { status: "CLOSED", closedAt: null },
    select: { id: true, number: true, date: true, targetDate: true, actionOwnerId: true }
  });

  if (closedNoTs.length === 0) {
    console.log("✓ All CLOSED near misses have closedAt.");
  } else {
    console.log(`Backfilling closedAt on ${closedNoTs.length} CLOSED records:`);
    for (const r of closedNoTs) {
      // Pick a closure timestamp between report date and target date (or +30d).
      const reportTime = r.date.getTime();
      const targetTime = (r.targetDate ?? addHours(r.date, 24 * 30)).getTime();
      const span = Math.max(targetTime - reportTime, 24 * 3600_000);
      const closedAt = new Date(
        reportTime + Math.floor(span * (0.4 + Math.random() * 0.5))
      );
      const closedAtCapped = closedAt > new Date() ? new Date() : closedAt;
      await prisma.nearMiss.update({
        where: { id: r.id },
        data: {
          closedAt: closedAtCapped,
          // Closer = action owner if we have one; falls back to reporter via the
          // existing record. closedById is optional on the schema, but setting
          // it makes the detail-page Meta block look complete.
          closedById: r.actionOwnerId,
          closingRemark:
            "Corrective actions implemented and verified by HSE walk-down. Lessons learned circulated to plant team via TBT.",
          lessonsLearned:
            "Reinforced procedural compliance and pre-task briefing. Equipment-side root causes addressed through maintenance plan update."
        }
      });
      console.log(`  ${r.number}  closedAt=${closedAtCapped.toISOString()}`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────
  const promoted = await prisma.nearMiss.count({ where: { promotedToIncident: true } });
  const closedClean = await prisma.nearMiss.count({
    where: { status: "CLOSED", closedAt: { not: null } }
  });
  const closedTotal = await prisma.nearMiss.count({ where: { status: "CLOSED" } });
  console.log("────────────────────────────────────────────────────────");
  console.log(`Promoted-to-Incident records (legitimate): ${promoted}`);
  console.log(`CLOSED records with closedAt:              ${closedClean} / ${closedTotal}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
