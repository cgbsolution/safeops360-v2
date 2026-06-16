// One-time migration: turn legacy free-text person fields into FK references
// where possible, and log unmatched rows to CSV.
//
// This script is intended to run AFTER `prisma db push` adds the new FK columns
// alongside the legacy text columns (i.e., before the legacy text columns are
// dropped). To keep both old and new columns coexisting during the migration,
// re-add the dropped legacy fields temporarily as nullable in schema.prisma,
// run `prisma db push`, run this script, verify the CSV, then drop the legacy
// fields and run `prisma db push` again.
//
// Run with:  tsx prisma/migrate-person-fields.ts
// Outputs:   prisma/unmatched_responsible_persons.csv

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

type AnyRow = Record<string, any>;

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokens(name: string): string[] {
  return normalize(name).split(" ").filter(Boolean);
}

// Score a candidate match: 100 = exact, 80 = all tokens overlap, 60 = first+last
// match, 40 = first OR last match, 0 = no overlap.
function scoreMatch(query: string, candidate: string): number {
  const a = normalize(query);
  const b = normalize(candidate);
  if (!a || !b) return 0;
  if (a === b) return 100;

  const at = tokens(a);
  const bt = tokens(b);
  const aFirst = at[0] ?? "";
  const aLast = at[at.length - 1] ?? "";
  const bFirst = bt[0] ?? "";
  const bLast = bt[bt.length - 1] ?? "";

  const allTokensInB = at.every((t) => bt.includes(t));
  if (allTokensInB && at.length === bt.length) return 95;
  if (allTokensInB) return 80;

  if (aFirst && aLast && aFirst === bFirst && aLast === bLast) return 70;
  if (aLast && aLast === bLast) return 50;
  if (aFirst && aFirst === bFirst) return 40;
  return 0;
}

async function fuzzyMatchUser(name: string | null | undefined, plantId: string | null | undefined, allUsers: { id: string; name: string; plantId: string | null }[]) {
  if (!name) return { id: null, score: 0 };
  // Prefer same-plant users; fall back to global pool
  const samePlant = plantId ? allUsers.filter((u) => u.plantId === plantId) : [];
  const pool = samePlant.length ? samePlant : allUsers;
  let best: { id: string | null; score: number } = { id: null, score: 0 };
  for (const u of pool) {
    const s = scoreMatch(name, u.name);
    if (s > best.score) best = { id: u.id, score: s };
  }
  // If same-plant didn't find a 70+ match, retry global
  if (best.score < 70 && samePlant.length) {
    for (const u of allUsers) {
      const s = scoreMatch(name, u.name);
      if (s > best.score) best = { id: u.id, score: s };
    }
  }
  return best;
}

async function migrateObservations(allUsers: { id: string; name: string; plantId: string | null }[]) {
  const unmatched: AnyRow[] = [];
  let matched = 0;
  let alreadyOk = 0;
  let nullSkipped = 0;

  // The `responsibleName` column may have been dropped already; this script reads
  // it via raw SQL so it works whether or not the Prisma model still has the field.
  const rows: { id: string; responsibleName: string | null; plantId: string; number: string; responsiblePersonId: string | null }[] =
    await prisma.$queryRawUnsafe(
      `select "id", "responsibleName", "plantId", "number", "responsiblePersonId" from "Observation" where "responsibleName" is not null and "responsiblePersonId" is null`
    );

  for (const r of rows) {
    if (!r.responsibleName) {
      nullSkipped++;
      continue;
    }
    if (r.responsiblePersonId) {
      alreadyOk++;
      continue;
    }
    const m = await fuzzyMatchUser(r.responsibleName, r.plantId, allUsers);
    if (m.id && m.score >= 70) {
      await prisma.observation.update({ where: { id: r.id }, data: { responsiblePersonId: m.id } });
      matched++;
    } else {
      unmatched.push({ observationId: r.id, observationNumber: r.number, originalName: r.responsibleName, plantId: r.plantId, bestScore: m.score });
    }
  }

  if (unmatched.length) {
    const header = "observationId,observationNumber,originalName,plantId,bestScore\n";
    const body = unmatched
      .map((r) => [r.observationId, r.observationNumber, JSON.stringify(r.originalName), r.plantId, r.bestScore].join(","))
      .join("\n");
    writeFileSync(join(__dirname, "unmatched_responsible_persons.csv"), header + body, "utf-8");
  }

  console.log(`Observations  | total=${rows.length}  matched=${matched}  unmatched=${unmatched.length}  alreadyOk=${alreadyOk}  nullSkipped=${nullSkipped}`);
  return { matched, unmatched: unmatched.length, total: rows.length };
}

async function main() {
  const allUsers = await prisma.user.findMany({ select: { id: true, name: true, plantId: true } });
  console.log(`Loaded ${allUsers.length} users for fuzzy matching.\n`);

  await migrateObservations(allUsers);

  console.log("\nDone. See prisma/unmatched_responsible_persons.csv for any rows that could not be auto-matched.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
