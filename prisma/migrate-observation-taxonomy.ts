// Backfill the DuPont STOP taxonomy onto existing at-risk observations.
//
//   npx tsx prisma/migrate-observation-taxonomy.ts            # dry run (default)
//   npx tsx prisma/migrate-observation-taxonomy.ts --apply    # write
//
// Requires apply-observation-taxonomy-ddl.ts AND seed-observation-taxonomy.ts
// to have run first.
//
// Scope: UNSAFE_ACT / UNSAFE_CONDITION only. Safe observations don't carry the
// STOP taxonomy (its sub-category labels are all deviation-phrased), so they
// keep their legacy hazard category untouched.
//
// ── Why this migration refuses to finish the job ──────────────────────────────
// The legacy schema had NO sub-category field at all — it is not a case of
// re-pointing an existing value, the information was never captured. So the
// sub-category is *unknowable* from the record alone. Two outcomes only:
//
//   CATEGORY-ONLY   legacy category maps 1:1 onto a STOP category (PPE→PPE,
//                   HOUSEKEEPING→HOUSEKEEPING). categoryCode + taxonomyAxis are
//                   set; subCategoryCode stays NULL and the row is queued in
//                   UnmappedLegacyObservation as SUBCATEGORY_REQUIRES_REVIEW.
//
//   UNMAPPED        no confident STOP equivalent (WORK_AT_HEIGHT, HOT_WORK,
//                   ELECTRICAL, …). Nothing is written to the record; queued as
//                   NO_CONFIDENT_CATEGORY_MATCH.
//
// Guessing a sub-category here would put fabricated safety data into a client's
// register that reads exactly like observed fact. It isn't done.

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

/** Legacy ObservationCategory → STOP categoryCode, ONLY where the two mean the
 *  same thing. Everything absent from this map is deliberately unmapped:
 *   • WORK_AT_HEIGHT / HOT_WORK / CONFINED_SPACE — permit-to-work activity
 *     types, not STOP observation categories; could be Positions, Procedures or
 *     Tools depending on what was actually seen.
 *   • ELECTRICAL / CHEMICAL_HANDLING — hazard energies, same ambiguity.
 *   • MOBILE_EQUIPMENT / MATERIAL_HANDLING — could be Tools (the equipment) or
 *     Positions (the person). Not decidable from a category alone.
 *   • EMERGENCY_PREP / OTHERS / OTHER — no signal at all. */
const CONFIDENT_CATEGORY_MAP: Record<string, string> = {
  PPE: "PPE",
  HOUSEKEEPING: "HOUSEKEEPING",
};

const AXIS_FOR_TYPE: Record<string, "ACT" | "CONDITION"> = {
  SAFE_ACT: "ACT",
  UNSAFE_ACT: "ACT",
  SAFE_CONDITION: "CONDITION",
  UNSAFE_CONDITION: "CONDITION",
};

type Outcome = {
  id: string;
  number: string;
  type: string;
  legacyCategory: string;
  axis: "ACT" | "CONDITION";
  result: "CATEGORY_ONLY" | "UNMAPPED";
  categoryCode: string | null;
  reason: "SUBCATEGORY_REQUIRES_REVIEW" | "NO_CONFIDENT_CATEGORY_MATCH";
};

async function main() {
  console.log(
    `\n${APPLY ? "APPLYING" : "DRY RUN"} — STOP taxonomy backfill for at-risk observations`
  );
  console.log("─".repeat(78));

  // Only rows that haven't been mapped yet, so a re-run is a no-op on work
  // already done (and never clobbers a sub-category a reviewer has since set).
  const rows = await prisma.observation.findMany({
    where: {
      type: { in: ["UNSAFE_ACT", "UNSAFE_CONDITION"] },
      categoryCode: null,
    },
    select: { id: true, number: true, type: true, category: true },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length === 0) {
    console.log("Nothing to migrate — every at-risk observation already has a STOP category.");
    return;
  }

  const outcomes: Outcome[] = rows.map((r) => {
    const axis = AXIS_FOR_TYPE[r.type] ?? "CONDITION";
    const legacyCategory = String(r.category);
    const mapped = CONFIDENT_CATEGORY_MAP[legacyCategory] ?? null;
    // A confident category mapping still has to exist on THIS axis. PPE and
    // HOUSEKEEPING both do; the guard matters if the map ever grows.
    return {
      id: r.id,
      number: r.number,
      type: r.type,
      legacyCategory,
      axis,
      result: mapped ? "CATEGORY_ONLY" : "UNMAPPED",
      categoryCode: mapped,
      reason: mapped ? "SUBCATEGORY_REQUIRES_REVIEW" : "NO_CONFIDENT_CATEGORY_MATCH",
    };
  });

  // Verify each proposed category actually has sub-categories seeded on that
  // axis — if the seed hasn't run, say so instead of writing dangling codes.
  for (const o of outcomes) {
    if (!o.categoryCode) continue;
    const n = await prisma.observationTaxonomy.count({
      where: { categoryCode: o.categoryCode, observationType: o.axis, isActive: true },
    });
    if (n === 0) {
      o.result = "UNMAPPED";
      o.reason = "NO_CONFIDENT_CATEGORY_MATCH";
      o.categoryCode = null;
    }
  }

  // ── Mapping table for review (the artefact the spec asks to eyeball) ──
  const byKey = new Map<string, { count: number; sample: string[]; o: Outcome }>();
  for (const o of outcomes) {
    const key = `${o.type}|${o.legacyCategory}|${o.categoryCode ?? "—"}`;
    const entry = byKey.get(key) ?? { count: 0, sample: [], o };
    entry.count++;
    if (entry.sample.length < 3) entry.sample.push(o.number);
    byKey.set(key, entry);
  }

  console.log("\nMAPPING TABLE");
  console.log(
    "  " +
      "TYPE".padEnd(18) +
      "LEGACY CATEGORY".padEnd(20) +
      "→ STOP CATEGORY".padEnd(22) +
      "SUB".padEnd(6) +
      "COUNT"
  );
  for (const [, e] of [...byKey.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(
      "  " +
        e.o.type.padEnd(18) +
        e.o.legacyCategory.padEnd(20) +
        `→ ${e.o.categoryCode ?? "(none — review)"}`.padEnd(22) +
        "—".padEnd(6) +
        String(e.count) +
        `   e.g. ${e.sample.join(", ")}`
    );
  }

  const categoryOnly = outcomes.filter((o) => o.result === "CATEGORY_ONLY");
  const unmapped = outcomes.filter((o) => o.result === "UNMAPPED");

  console.log("\nSUMMARY");
  console.log(`  ${rows.length} at-risk observation(s) examined`);
  console.log(`  ${categoryOnly.length} → category mapped, sub-category queued for review`);
  console.log(`  ${unmapped.length} → no confident match, record left untouched`);
  console.log(`  0 → sub-category auto-assigned (by design — see header comment)`);

  if (!APPLY) {
    console.log(
      "\nDRY RUN — nothing written. Re-run with --apply once the mapping table above looks right."
    );
    return;
  }

  console.log("\nWriting…");
  let recordsUpdated = 0;
  let reviewsQueued = 0;

  for (const o of outcomes) {
    await prisma.$transaction(async (tx) => {
      if (o.result === "CATEGORY_ONLY" && o.categoryCode) {
        await tx.observation.update({
          where: { id: o.id },
          // subCategoryCode stays NULL on purpose. The composite FK is MATCH
          // SIMPLE, so a NULL member skips enforcement — which is what lets a
          // half-mapped legacy row exist at all.
          data: { categoryCode: o.categoryCode, taxonomyAxis: o.axis },
        });
        recordsUpdated++;
      }
      await tx.unmappedLegacyObservation.upsert({
        where: { observationId: o.id },
        update: {
          reason: o.reason,
          suggestedCategoryCode: o.categoryCode,
          suggestedAxis: o.axis,
        },
        create: {
          observationId: o.id,
          observationNumber: o.number,
          observationType: o.type,
          legacyCategory: o.legacyCategory,
          reason: o.reason,
          suggestedCategoryCode: o.categoryCode,
          suggestedAxis: o.axis,
        },
      });
      reviewsQueued++;
    });
  }

  console.log(`✅  ${recordsUpdated} observation(s) updated, ${reviewsQueued} queued for review.`);
  console.log(
    "    Review queue: SELECT * FROM \"UnmappedLegacyObservation\" WHERE \"resolvedAt\" IS NULL;\n" +
      "    Reviewers assign the sub-category by editing the observation — the API\n" +
      "    will demand a valid pair for the record's axis."
  );
}

main()
  .catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      console.error(
        "❌  Table missing. Run `npx tsx prisma/apply-observation-taxonomy-ddl.ts` first."
      );
      process.exit(1);
    }
    console.error("❌  Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
