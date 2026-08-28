// Adds the fire-asset link to CaptureSubmission.
//
// `qr-scanner.tsx` has been parsing `safeops:fire-asset:<id>` stickers into a
// `fireAssetId` since fire QR labels shipped, but `wizard.tsx` never read that
// field and there was nowhere to put it if it had — so every fire sticker
// scanned inside the capture wizard produced a field report with no asset
// context and no error. These two columns are where it lands.
//
// Separate from "equipmentId", which holds a Field Capture `Equipment` id.
// `FireEquipment` is a different table with different ids; writing one into the
// other yields a link that resolves to nothing.
//
// Mirrors prisma/apply-capture-ddl.ts: additive, idempotent, applied through the
// Prisma client's connection because `prisma db execute` / `migrate diff` hang
// against the pooler in this environment, and `prisma db push` would drop the
// drifted hand-DDL tables.
//   npx tsx prisma/apply-capture-fire-asset-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "CaptureSubmission" ADD COLUMN IF NOT EXISTS "fireAssetId" TEXT`,
  // Snapshot of the asset as it was at submit time — code, allotted tag,
  // location, type, subtype. Kept for the same reason as "categorySnapshot":
  // a cylinder gets condemned, re-tagged or moved, and a report that renders
  // today's asset record is a report that misstates where the finding was made.
  `ALTER TABLE "CaptureSubmission" ADD COLUMN IF NOT EXISTS "fireAssetSnapshot" JSONB`,
  // "every field report against this cylinder" is the query the fire register
  // and the overdue/escalation views both want, and it must not seq-scan the
  // submissions table.
  `CREATE INDEX IF NOT EXISTS "ix_CaptureSubmission_fireAsset"
     ON "CaptureSubmission" ("fireAssetId")`,
];

async function main() {
  console.log("Applying CaptureSubmission fire-asset link DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 70);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'CaptureSubmission'
        AND column_name IN ('fireAssetId', 'fireAssetSnapshot')
      ORDER BY column_name`,
  );
  const found = cols.map((c) => c.column_name);
  if (found.length !== 2) {
    throw new Error(`Expected both columns, found: ${found.join(", ") || "none"}`);
  }
  const linked = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT count(*)::bigint AS c FROM "CaptureSubmission" WHERE "fireAssetId" IS NOT NULL`,
  );
  console.log(`✅  CaptureSubmission ready: ${found.join(", ")} · ${linked[0].c} report(s) linked to a fire asset`);
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
