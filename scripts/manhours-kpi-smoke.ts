// ────────────────────────────────────────────────────────────────────────
// Manhours KPI Engine — smoke test.
//
// Pre-requisites (run once after pulling Commit 1):
//   npx prisma migrate dev --name add_manhours_submission
//   npx prisma generate
//
// Then:
//   npx tsx scripts/manhours-kpi-smoke.ts            # all plants, rolling 12
//   npx tsx scripts/manhours-kpi-smoke.ts <plantId>  # single plant
//
// Until Commit 6 backfills ManhoursSubmission rows for the demo data,
// every KPI here falls back to the legacy `Manhours` table — you'll see
// `fellBackToLegacyGrossHours: true` in the output. Numbers therefore
// match the existing /manhours dashboard. After the C6 backfill, this
// script will report NET exposure hours (lower) and slightly worse
// LTIFR / TRIR / Severity — that's the brief's "wrong denominator"
// correction at work.
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import { KpiEngine, type KpiScope, type KpiPeriod } from "../src/lib/manhours/kpi-engine";
import { KPI_CODES } from "../src/lib/manhours/kpi-registry";

const prisma = new PrismaClient();

async function main() {
  const targetPlantId = process.argv[2];

  const plants = targetPlantId
    ? await prisma.plant.findMany({ where: { id: targetPlantId } })
    : await prisma.plant.findMany({ orderBy: { name: "asc" } });

  if (plants.length === 0) {
    console.error("No plants found. Run the main seed first.");
    process.exit(1);
  }

  const engine = new KpiEngine(prisma);
  const now = new Date();
  const period: KpiPeriod = {
    year: now.getFullYear(),
    month: now.getMonth() + 1, // anchor to current month
    isRolling12: true
  };

  for (const plant of plants) {
    const scope: KpiScope = { plantId: plant.id };
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`  ${plant.name}  (${plant.code})`);
    console.log(`═══════════════════════════════════════════════════════`);

    const results = await engine.computeKpiBatch(KPI_CODES, scope, period);

    // Pretty-print each KPI + best-effort prior-period trend.
    for (const code of KPI_CODES) {
      const r = results[code];
      const bandTag = r.band ? `  [${r.band}]` : "";
      const fallbackTag = r.audit.fellBackToLegacyGrossHours ? "  ⚠ legacy gross" : "";
      console.log(
        `\n  ${r.kpiName} (${code})${bandTag}${fallbackTag}`
      );
      console.log(`    formula:     ${r.formula}`);
      console.log(`    period:      ${r.period.label}`);
      console.log(`    numerator:   ${r.numerator}`);
      console.log(`    denominator: ${r.denominator}`);
      console.log(`    value:       ${r.formattedValue}`);
      console.log(`    sources:     ${r.audit.sourceRecordIds.length} record(s)`);

      try {
        const trend = await engine.computeTrend(code, r.value, scope, period);
        const arrow = trend.direction === "UP" ? "↑" : trend.direction === "DOWN" ? "↓" : "→";
        const pct = trend.percentChange == null ? "n/a" : `${trend.percentChange.toFixed(1)}%`;
        console.log(`    trend:       ${arrow} ${pct} vs ${trend.priorPeriodLabel}`);
      } catch {
        /* period shape doesn't support trend — skip */
      }
    }
  }

  // Sub-plant scope sanity check — pick a department from the first
  // plant + run LTIFR. Confirms applyScope's dept-injection works.
  const firstPlant = plants[0];
  if (firstPlant) {
    const dept = await prisma.department.findFirst({
      where: { plantId: firstPlant.id, active: true },
      orderBy: { name: "asc" }
    });
    if (dept) {
      console.log(`\n═══════════════════════════════════════════════════════`);
      console.log(`  Department scope sanity — ${firstPlant.name} / ${dept.name}`);
      console.log(`═══════════════════════════════════════════════════════`);
      try {
        const r = await engine.computeKpi(
          "LTIFR",
          { plantId: firstPlant.id, departmentId: dept.id },
          period
        );
        console.log(`  LTIFR (${dept.name}): ${r.formattedValue} from ${r.audit.sourceRecordIds.length} incident(s)`);
        console.log(`    denominator: ${r.denominator} hrs (${r.audit.fellBackToLegacyGrossHours ? "legacy gross" : "from category rows"})`);
      } catch (e: any) {
        console.log(`  ⚠ Department scope failed: ${e?.message}`);
      }
    }
  }

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  Done. Computed ${KPI_CODES.length} KPIs across ${plants.length} plant(s).`);
  console.log(`═══════════════════════════════════════════════════════\n`);
}

main()
  .catch((e) => {
    console.error("❌ smoke test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
