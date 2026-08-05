// Seeds AreaHazardTier — the per-area modifier applied to a matrix rule's base
// severity.
//
//   npx tsx prisma/seed-area-hazard-tiers.ts            # fill gaps only
//   npx tsx prisma/seed-area-hazard-tiers.ts --force    # re-derive, overwriting
//   npx tsx prisma/seed-area-hazard-tiers.ts --dry-run  # report, write nothing
//
// ── Why this table exists at all ──────────────────────────────────────────────
// The build spec asks to reuse an existing per-area risk classification if one
// is already modelled. There isn't one. `Area` carries name / plantId /
// ownerUserId and nothing else, and HIRA's risk levels live on `HiraEntry` —
// one row per assessed hazard *scenario*, with its own likelihood, severity and
// controls. That is a rating of a scenario, not a standing property of a place,
// and it changes every time a study is revised.
//
// So the tier is owned here, but it is DERIVED from HIRA rather than invented:
// an area's tier starts from the worst risk level any HIRA entry has assessed
// there. That gives every area a defensible starting value on day one without
// asking anyone to hand-classify a site, and it stays editable afterwards.
//
// Rows written by this script are marked `source = 'hira_derived'`. A row a
// person edited (source = 'manual') is NEVER touched, even with --force —
// re-deriving must not quietly revert a considered decision.
//
// Requires apply-observation-severity-ddl.ts to have run first.

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");

type Tier = "Standard" | "Elevated" | "HighHazard";

// HIRA risk level → hazard tier. Deliberately conservative at the top: only a
// CRITICAL assessed risk earns HighHazard, because HighHazard bumps EVERY
// observation in the area up one severity band. Over-tiering an area doesn't
// make it safer — it floods the register with High-severity records and
// destroys the signal the severity field is supposed to carry.
const TIER_FOR_RISK_LEVEL: Record<string, Tier> = {
  CRITICAL: "HighHazard",
  HIGH: "Elevated",
  MODERATE: "Standard",
  MEDIUM: "Standard", // MODERATE is the seeded spelling; accept both.
  LOW: "Standard",
};

const TIER_RANK: Record<Tier, number> = { Standard: 0, Elevated: 1, HighHazard: 2 };

type AreaRow = { areaId: string; areaName: string; plantId: string; plantName: string };

async function main() {
  console.log(
    `Deriving AreaHazardTier from HIRA${FORCE ? " — FORCE" : ""}${DRY_RUN ? " — DRY RUN" : ""}…`
  );

  const areas = await prisma.$queryRawUnsafe<AreaRow[]>(
    `SELECT a."id" AS "areaId", a."name" AS "areaName",
            p."id" AS "plantId", p."name" AS "plantName"
       FROM "Area" a
       JOIN "Plant" p ON p."id" = a."plantId"
      ORDER BY p."name", a."name"`
  );

  // Worst assessed risk per area. Residual is preferred where it exists — it is
  // the risk that remains WITH the controls in place, which is what an observer
  // actually walks into. Initial is the fallback for entries not yet assessed
  // for residual risk.
  const hira = await prisma.$queryRawUnsafe<{ areaId: string; level: string; n: bigint }[]>(
    `SELECT e."areaId" AS "areaId",
            COALESCE(e."residualRiskLevel", e."initialRiskLevel") AS "level",
            count(*)::bigint AS "n"
       FROM "HiraEntry" e
      WHERE e."areaId" IS NOT NULL
      GROUP BY e."areaId", COALESCE(e."residualRiskLevel", e."initialRiskLevel")`
  );

  const worstByArea = new Map<string, { tier: Tier; level: string; entries: number }>();
  const entryCount = new Map<string, number>();
  for (const row of hira) {
    entryCount.set(row.areaId, (entryCount.get(row.areaId) ?? 0) + Number(row.n));
    const tier = TIER_FOR_RISK_LEVEL[(row.level ?? "").toUpperCase()];
    if (!tier) continue;
    const current = worstByArea.get(row.areaId);
    if (!current || TIER_RANK[tier] > TIER_RANK[current.tier]) {
      worstByArea.set(row.areaId, { tier, level: row.level, entries: 0 });
    }
  }
  for (const [areaId, v] of worstByArea) v.entries = entryCount.get(areaId) ?? 0;

  const existing = await prisma.$queryRawUnsafe<
    { id: string; plantId: string; areaId: string | null; hazardTier: string; source: string }[]
  >(`SELECT "id", "plantId", "areaId", "hazardTier", "source" FROM "AreaHazardTier"`);
  const byArea = new Map(existing.filter((r) => r.areaId).map((r) => [r.areaId!, r]));
  const plantDefaults = new Set(existing.filter((r) => !r.areaId).map((r) => r.plantId));

  let created = 0;
  let updated = 0;
  let keptManual = 0;
  let keptSame = 0;
  let noHira = 0;
  const uplifted: string[] = [];

  for (const area of areas) {
    const derived = worstByArea.get(area.areaId);
    // No HIRA coverage → no row. An absent row resolves to the plant default,
    // then to Standard. Writing a speculative Standard row for an unassessed
    // area would look like a decision that nobody made, and would then block
    // the plant default from ever applying to it.
    if (!derived) {
      noHira++;
      continue;
    }

    const notes =
      `Derived from ${derived.entries} HIRA entr${derived.entries === 1 ? "y" : "ies"} ` +
      `in this area; worst assessed risk level is ${derived.level}.`;
    const current = byArea.get(area.areaId);

    if (!current) {
      if (!DRY_RUN) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "AreaHazardTier"
             ("id", "plantId", "areaId", "hazardTier", "notes", "source", "isActive",
              "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'hira_derived', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          randomUUID().replace(/-/g, ""),
          area.plantId,
          area.areaId,
          derived.tier,
          notes
        );
      }
      created++;
      if (derived.tier !== "Standard") {
        uplifted.push(`${area.plantName} / ${area.areaName} → ${derived.tier} (${derived.level})`);
      }
      continue;
    }

    if (current.source === "manual") {
      keptManual++;
      if (current.hazardTier !== derived.tier) {
        console.log(
          `  · ${area.areaName.padEnd(28)} kept MANUAL ${current.hazardTier} ` +
            `(HIRA would derive ${derived.tier})`
        );
      }
      continue;
    }
    if (current.hazardTier === derived.tier) {
      keptSame++;
      continue;
    }
    if (!FORCE) {
      keptSame++;
      console.log(
        `  · ${area.areaName.padEnd(28)} left at ${current.hazardTier} ` +
          `(HIRA now derives ${derived.tier}; pass --force to re-derive)`
      );
      continue;
    }
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(
        `UPDATE "AreaHazardTier"
            SET "hazardTier" = $1, "notes" = $2, "source" = 'hira_derived',
                "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $3`,
        derived.tier,
        notes,
        current.id
      );
    }
    updated++;
    console.log(`  ~ ${area.areaName.padEnd(28)} ${current.hazardTier} → ${derived.tier}`);
  }

  console.log(
    `\n✅  ${created} created, ${updated} re-derived, ${keptSame} unchanged, ` +
      `${keptManual} left as manual edits.`
  );
  console.log(
    `    ${noHira} of ${areas.length} area(s) have no HIRA entries — they resolve to the ` +
      "plant default, then Standard (base severity passes through unchanged)."
  );
  console.log(
    `    Plant-wide default rows present for ${plantDefaults.size} plant(s). ` +
      "Add one per plant only if unassessed areas there should NOT be Standard."
  );

  if (uplifted.length > 0) {
    console.log(`\n    Areas that will now uplift observation severity (${uplifted.length}):`);
    for (const u of uplifted) console.log(`      ${u}`);
  } else {
    console.log(
      "\n    No area derived above Standard — every suggestion is the matrix base severity."
    );
  }
  if (DRY_RUN) console.log("\n    DRY RUN — nothing was written.");
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
