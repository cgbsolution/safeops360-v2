// Additive DDL applier for the shared Evidence Attachment layer (Stream B §5).
//   • Attachment — one generic attachment table keyed by (entityType, entityId),
//     with documentCategory (§6 AI key), slot-based versioning, extraction JSON.
//
// Mirrors prisma/apply-incident-intel-ddl.ts: additive, idempotent (every
// statement tolerates "already exists"), applied through the Prisma client's
// connection because `prisma db push` would drop the drifted hand-DDL tables on
// this shared Supabase database. Kept in agreement with the SQLAlchemy model
// (app/models/attachment.py) + the backend applier
// (scripts/create_attachment_tables.py) by hand.
//   npx tsx prisma/apply-attachment-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "Attachment" (
     "id" TEXT PRIMARY KEY,
     "entityType" TEXT NOT NULL,
     "entityId" TEXT NOT NULL,
     "category" TEXT NOT NULL,
     "documentCategory" TEXT,
     "fileName" TEXT NOT NULL,
     "storagePath" TEXT NOT NULL,
     "fileSize" INTEGER NOT NULL,
     "mimeType" TEXT NOT NULL,
     "caption" TEXT,
     "slotKey" TEXT,
     "version" INTEGER NOT NULL DEFAULT 1,
     "supersedesId" TEXT,
     "isCurrent" BOOLEAN NOT NULL DEFAULT true,
     "extraction" JSONB,
     "uploadedById" TEXT NOT NULL REFERENCES "User"("id"),
     "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
     "deletedAt" TIMESTAMPTZ
   )`,
  `CREATE INDEX IF NOT EXISTS "ix_Attachment_entityType" ON "Attachment" ("entityType")`,
  `CREATE INDEX IF NOT EXISTS "ix_Attachment_entityId" ON "Attachment" ("entityId")`,
  `CREATE INDEX IF NOT EXISTS "ix_Attachment_entity" ON "Attachment" ("entityType", "entityId")`,
  `CREATE INDEX IF NOT EXISTS "ix_Attachment_entity_current" ON "Attachment" ("entityType", "entityId", "isCurrent")`,
  `CREATE INDEX IF NOT EXISTS "ix_Attachment_documentCategory" ON "Attachment" ("documentCategory")`,
  `CREATE INDEX IF NOT EXISTS "ix_Attachment_slotKey" ON "Attachment" ("slotKey")`,
  `CREATE INDEX IF NOT EXISTS "ix_Attachment_isCurrent" ON "Attachment" ("isCurrent")`,
  `CREATE INDEX IF NOT EXISTS "ix_Attachment_deletedAt" ON "Attachment" ("deletedAt")`,
];

async function main() {
  console.log("Applying Evidence Attachment (Stream B) DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 70);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const [{ count }] = await prisma.$queryRawUnsafe<{ count: number | bigint }[]>(
    `SELECT count(*)::int AS count FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'Attachment'`,
  );
  console.log(`✅  Attachment table present: ${Number(count) > 0}`);
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
