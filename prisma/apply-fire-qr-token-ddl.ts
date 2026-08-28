// Opaque QR token on FireEquipment.
//
// The sticker used to encode `safeops:fire-asset:<asset.id>` — the row's own id.
// That is neither opaque (one photographed label shows you the shape of every
// other) nor revocable (you cannot invalidate a derived value without changing
// the primary key). These columns hold a stored random token instead.
//
// "qrCode" is deliberately left alone: it holds the legacy derived value, which
// is what every sticker currently stuck on a cylinder encodes, and resolution
// still honours it until the reprint pass is done.
//
// Mirrors prisma/apply-capture-ddl.ts: additive, idempotent, applied through the
// Prisma client's connection because `prisma db execute` / `migrate diff` hang
// against the pooler in this environment, and `prisma db push` would drop the
// drifted hand-DDL tables.
//   npx tsx prisma/apply-fire-qr-token-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "qrToken" TEXT`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "qrTokenGeneratedAt" TIMESTAMP(3)`,
  // How many times this label has been reissued. The previous token is NOT kept
  // — a revoked label has to stop resolving — so the counter is what answers
  // "has this been reprinted before?" without retaining the value itself.
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "qrTokenRotations" INTEGER NOT NULL DEFAULT 0`,
  // Null = the current token has never been printed, so the sticker in the field
  // is still the old derived one and this asset goes unscannable at cutover.
  // This column is what makes reprint readiness answerable without walking the site.
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "qrLabelPrintedAt" TIMESTAMP(3)`,
  // UNIQUE because two assets sharing a token is a sticker that resolves to an
  // arbitrary one of them. Partial, because tokens are NULL until backfilled and
  // NULLs must not collide with each other.
  `CREATE UNIQUE INDEX IF NOT EXISTS "ix_FireEquipment_qrToken"
     ON "FireEquipment" ("qrToken") WHERE "qrToken" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "ix_FireEquipment_qrPrinted"
     ON "FireEquipment" ("plantId", "qrLabelPrintedAt")`,
];

async function main() {
  console.log("Applying FireEquipment opaque QR token DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 72);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }

  const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'FireEquipment'
        AND column_name IN ('qrToken','qrTokenGeneratedAt','qrTokenRotations','qrLabelPrintedAt')
      ORDER BY column_name`,
  );
  if (cols.length !== 4) {
    throw new Error(`Expected 4 columns, found: ${cols.map((c) => c.column_name).join(", ")}`);
  }
  const [row] = await prisma.$queryRawUnsafe<{ total: bigint; tokened: bigint; printed: bigint }[]>(
    `SELECT count(*)::bigint AS total,
            count("qrToken")::bigint AS tokened,
            count("qrLabelPrintedAt")::bigint AS printed
       FROM "FireEquipment" WHERE "isDeleted" = false`,
  );
  console.log(
    `✅  FireEquipment ready: ${row.total} asset(s), ${row.tokened} with an opaque token, ` +
      `${row.printed} with a printed label.`,
  );
  if (row.tokened < row.total) {
    console.log(
      `\n⚠  ${row.total - row.tokened} asset(s) still have no token. Run:\n` +
        "     python scripts/fire_qr_backfill.py --commit",
    );
  }
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
