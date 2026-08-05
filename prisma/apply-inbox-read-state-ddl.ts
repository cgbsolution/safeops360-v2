// DDL for Inbox read/unread state: WorkflowTask.readAt.
//
// null = the assignee has never opened this task's record, so the Inbox row
// renders as unread (tinted + bold, exactly like an unread notification).
// Stamped the first time the assignee lands on the record — from the Inbox,
// a pasted deep link, or a modal.
//
// Additive and idempotent. Applied through the Prisma client's connection,
// matching the other apply-*-ddl scripts: `prisma db execute` / `migrate diff`
// hang against the pooler in this environment, and `prisma db push` would drop
// the drifted hand-DDL tables.
//
//   npx tsx prisma/apply-inbox-read-state-ddl.ts
//
// BACKFILL POLICY: existing rows are left as readAt = NULL, i.e. everything
// currently in an inbox shows up as unread on first load. That is the honest
// state — we have no record of what anyone has already opened, and marking the
// whole backlog "read" would hide it. Users clear it by opening items, or in
// one shot via "Mark all read".

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "WorkflowTask" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3)`,
  // Serves the per-tab unread counts: WHERE assignedToId = ? AND readAt IS NULL.
  `CREATE INDEX IF NOT EXISTS "WorkflowTask_assignedToId_readAt_idx"
     ON "WorkflowTask" ("assignedToId", "readAt")`,
];

async function main() {
  console.log("Applying Inbox read-state DDL…");
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${sql.trim().split("\n")[0].slice(0, 72)}`);
  }

  const [{ total, unread }] = await prisma.$queryRawUnsafe<
    { total: bigint; unread: bigint }[]
  >(
    `SELECT count(*)::bigint AS total,
            count(*) FILTER (WHERE "readAt" IS NULL)::bigint AS unread
       FROM "WorkflowTask"`
  );
  console.log(`✅  WorkflowTask ready — ${total} tasks, ${unread} currently unread.`);
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
