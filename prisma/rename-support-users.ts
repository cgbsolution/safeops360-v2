// Give the 10 industry-tenant plants' supporting accounts real person names.
//
// WHY THIS EXISTS AS A SEPARATE SCRIPT
// seed-industry-tenants.ts now writes the correct names, but re-running that
// seed is NOT a safe way to fix existing data: for a plant that already exists
// it does `area.deleteMany({ where: { plantId } })` and recreates the areas,
// which would break every Observation / Near Miss / Permit already pointing at
// those Area rows. This script touches nothing but `User.name`.
//
// Idempotent and narrow: it looks up each account by its deterministic email
// ({role-slug}.{plant-code}@safeops360.in), skips any that are already correct
// or absent, and never creates a user. Run it once after deploying the
// full-identity workflow UI:
//
//   npx tsx prisma/rename-support-users.ts          # apply
//   npx tsx prisma/rename-support-users.ts --dry-run  # preview only
//
// ⚠  DATABASE_URL for this workspace points at the live Supabase instance —
// this WILL rewrite production user names. Preview with --dry-run first.

import { PrismaClient } from "@prisma/client";
import { DEMO_INDUSTRIES, SUPPORT_ROLES, supportName } from "./demo-users-config";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(
    dryRun
      ? "🔍  Support-user rename — DRY RUN (no writes)"
      : "✏️   Support-user rename — applying"
  );

  let renamed = 0;
  let alreadyOk = 0;
  let missing = 0;

  for (const ind of DEMO_INDUSTRIES) {
    for (const [i, sr] of SUPPORT_ROLES.entries()) {
      const email = `${sr.emailKey}.${ind.plantCode.toLowerCase()}@safeops360.in`;
      const target = supportName(ind.plantCode, i, sr.designation);

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true },
      });

      if (!user) {
        missing += 1;
        console.log(`  ·  ${email} — not present, skipped`);
        continue;
      }
      if (user.name === target) {
        alreadyOk += 1;
        continue;
      }

      console.log(`  →  ${email}: "${user.name}"  ⇒  "${target}"`);
      if (!dryRun) {
        await prisma.user.update({ where: { id: user.id }, data: { name: target } });
      }
      renamed += 1;
    }
  }

  console.log(
    `\n${dryRun ? "🔍  Would rename" : "✅  Renamed"} ${renamed} · already correct ${alreadyOk} · absent ${missing}`
  );
  if (renamed > 0 && !dryRun) {
    console.log(
      "   Existing records keep their assignee/responsible FKs — every workflow\n" +
      "   screen now reads the new name for the same person."
    );
  }
}

main()
  .catch((e) => {
    console.error("❌  Rename failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
