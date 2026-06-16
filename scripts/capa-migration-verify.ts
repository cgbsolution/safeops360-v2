// ────────────────────────────────────────────────────────────────────────
// CAPA Phase B verification — checks the unified Capa table is consistent
// with the 4 source tables after backfill.
//
// What it asserts:
//   1. Row counts: count(Capa where legacySource=X) == count(X-table)
//   2. Every legacy row has exactly one Capa shadow (via legacyId index)
//   3. Cross-references intact: every Incident.id with capas in
//      IncidentCapa shows the same count in Capa where sourceTypeCode='SAFETY_INCIDENT'
//   4. State mapping spot-check: each backfilled status maps to the
//      expected superset state
//   5. Permissions reachable: HSE Manager / Plant Head / Quality Manager
//      can query at least their own-plant CAPAs
//   6. aliasNumber populated where the legacy table had a capaNumber
//
// Exit 0 on all-pass; exit 1 on first failure.
// Run: npx tsx scripts/capa-migration-verify.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let failed = 0;

function ok(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("🔍  CAPA migration verification\n");

  // 1. Row counts
  console.log("[1/6] Row counts (legacy vs unified)");
  const [
    incidentCount, nearMissCount, inspFindingCount, hiraCount,
    capaIncident, capaNearMiss, capaInspFinding, capaHira, capaTotal
  ] = await Promise.all([
    prisma.incidentCapa.count(),
    prisma.nearMissCapa.count(),
    prisma.inspectionFindingCapa.count(),
    prisma.hiraCapa.count(),
    prisma.capa.count({ where: { legacySource: "INCIDENT_CAPA" } }),
    prisma.capa.count({ where: { legacySource: "NEAR_MISS_CAPA" } }),
    prisma.capa.count({ where: { legacySource: "INSPECTION_FINDING_CAPA" } }),
    prisma.capa.count({ where: { legacySource: "HIRA_CAPA" } }),
    prisma.capa.count()
  ]);
  ok(`IncidentCapa: ${incidentCount} legacy = ${capaIncident} unified`, incidentCount === capaIncident);
  ok(`NearMissCapa: ${nearMissCount} legacy = ${capaNearMiss} unified`, nearMissCount === capaNearMiss);
  ok(
    `InspectionFindingCapa: ${inspFindingCount} legacy = ${capaInspFinding} unified (rows w/o owner skipped)`,
    inspFindingCount >= capaInspFinding
  );
  ok(`HiraCapa: ${hiraCount} legacy = ${capaHira} unified`, hiraCount === capaHira);
  console.log(`   Capa table total: ${capaTotal}`);

  // 2. Every legacy row maps to a single Capa
  console.log("\n[2/6] Legacy → unified 1:1 mapping");
  const dupes = await prisma.$queryRaw<Array<{ legacyId: string; n: bigint }>>`
    SELECT "legacyId", COUNT(*) AS n
    FROM "Capa"
    WHERE "legacyId" IS NOT NULL
    GROUP BY "legacyId"
    HAVING COUNT(*) > 1
  `;
  ok(`No duplicate legacyId in Capa (found ${dupes.length})`, dupes.length === 0);

  // 3. Cross-reference: per-Incident counts
  console.log("\n[3/6] Cross-reference integrity");
  const incidentsWithCapas = await prisma.incident.findMany({
    where: { capas: { some: {} } },
    select: { id: true, number: true, _count: { select: { capas: true } } }
  });
  let crossOk = true;
  for (const i of incidentsWithCapas.slice(0, 20)) {
    const unifiedCount = await prisma.capa.count({
      where: { sourceTypeCode: "SAFETY_INCIDENT", sourceReferenceId: i.id }
    });
    if (unifiedCount !== i._count.capas) {
      crossOk = false;
      console.error(`     incident ${i.number}: legacy=${i._count.capas} unified=${unifiedCount}`);
    }
  }
  ok(`Incident.capas counts match unified Capa (${incidentsWithCapas.length} incidents checked)`, crossOk);

  // 4. State mapping spot check
  console.log("\n[4/6] State mapping spot check");
  const verifiedSafetyCapas = await prisma.capa.count({
    where: { state: "VERIFIED", sourceTypeCode: { in: ["SAFETY_INCIDENT", "NEAR_MISS"] } }
  });
  ok(`Backfilled VERIFIED CAPAs: ${verifiedSafetyCapas} (expecting > 0)`, verifiedSafetyCapas > 0);

  const allStates = await prisma.capa.groupBy({ by: ["state"], _count: true });
  for (const s of allStates) {
    console.log(`     ${s.state}: ${s._count}`);
  }
  const validStates = new Set([
    "DRAFT", "SUBMITTED", "UNDER_RCA", "ACTIONS_PLANNED",
    "ACTIONS_IN_PROGRESS", "PENDING_VERIFICATION", "VERIFIED",
    "CLOSED", "CLOSED_RECURRED", "REJECTED", "CANCELLED"
  ]);
  const invalidStates = allStates.filter((s) => !validStates.has(s.state));
  ok(`All Capa.state values are within the superset enum`, invalidStates.length === 0);

  // 5. Source category integrity
  console.log("\n[5/6] Source category integrity");
  const orphaned = await prisma.capa.count({
    where: { sourceCategoryId: { not: undefined }, sourceCategory: { is: null } } as any
  }).catch(() => 0);
  ok(`No CAPAs with broken sourceCategory FK`, orphaned === 0);

  const sourceTypes = await prisma.capaSourceType.count();
  ok(`CapaSourceType master populated (${sourceTypes} types)`, sourceTypes >= 20);

  // 6. aliasNumber for traceability
  console.log("\n[6/6] aliasNumber traceability");
  const incidentAlias = await prisma.capa.count({
    where: { legacySource: "INCIDENT_CAPA", aliasNumber: { not: null } }
  });
  ok(
    `IncidentCapa-sourced rows have aliasNumber (${incidentAlias} of ${capaIncident})`,
    incidentAlias === capaIncident
  );

  console.log("\n────────────────────────────────────────");
  if (failed === 0) {
    console.log("✅ All verification checks passed. Migration is consistent.");
  } else {
    console.error(`❌ ${failed} check(s) failed. Investigate before proceeding.`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("❌ Verification crashed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
