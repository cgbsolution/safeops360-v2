// Indexes for the platform-wide "newest created first" list ordering.
//
// Every record register now sorts by `createdAt DESC, id DESC` (see the sort
// convention comments in the list routes / pages). The old orderings had
// supporting indexes — `Observation(date)`, `NearMiss(date)`, `Incident(date)`,
// `Inspection(scheduledDate)` etc. — and the new sort key does not, so without
// this the big registers pay a full sort on every page load.
//
// Additive and idempotent (CREATE INDEX IF NOT EXISTS): safe to re-run, and it
// does NOT drop the existing date indexes — those still serve the date-window
// filters used by dashboards and analytics.
//
// Applied through the Prisma client's connection, matching the other
// apply-*-ddl scripts: `prisma db execute` / `migrate diff` hang against the
// pooler in this environment, and `prisma db push` would drop the drifted
// hand-DDL tables.
//
//   npx tsx prisma/apply-list-sort-indexes.ts
//
// CONCURRENTLY is deliberately NOT used — it cannot run inside the implicit
// transaction Prisma wraps around $executeRawUnsafe. On demo/POC data volumes
// the brief write lock is irrelevant; if this is ever run against a large
// production table, issue the same statements manually with CONCURRENTLY.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** [table, columns] — one composite index per register, matching its ORDER BY. */
const INDEXES: [table: string, columns: string][] = [
  ["Observation", `"createdAt" DESC, "id" DESC`],
  ["NearMiss", `"createdAt" DESC, "id" DESC`],
  ["Incident", `"createdAt" DESC, "id" DESC`],
  ["FLRA", `"createdAt" DESC, "id" DESC`],
  ["Inspection", `"createdAt" DESC, "id" DESC`],
  ["Permit", `"createdAt" DESC, "id" DESC`],
  ["Anomaly", `"detectedAt" DESC, "id" DESC`], // no createdAt column; detectedAt IS the insert stamp
  ["Capa", `"createdAt" DESC, "id" DESC`],
  ["ChangeRequest", `"createdAt" DESC, "id" DESC`],
  ["EnterpriseRisk", `"createdAt" DESC, "id" DESC`],
  ["HiraStudy", `"createdAt" DESC, "id" DESC`],
  ["EaiStudy", `"createdAt" DESC, "id" DESC`],
  ["CamsEngagement", `"createdAt" DESC, "id" DESC`],
  ["ComplianceAudit", `"createdAt" DESC, "id" DESC`],
  ["Manhours", `"createdAt" DESC, "id" DESC`],
  // Inbox queues: the work tabs page by (assignee, status) newest-first, and
  // the Overdue tab by (assignee, status) oldest-due-first.
  ["WorkflowTask", `"assignedToId", "status", "assignedAt" DESC`],
  ["WorkflowTask", `"assignedToId", "status", "dueAt" ASC`],
];

function indexName(table: string, columns: string): string {
  const cols = columns
    .split(",")
    .map((c) => c.trim().replace(/"/g, "").replace(/\s+(ASC|DESC)$/i, ""))
    .join("_");
  return `ix_${table}_${cols}_sort`;
}

async function main() {
  console.log("Applying list-sort indexes…");
  let created = 0;
  for (const [table, columns] of INDEXES) {
    const name = indexName(table, columns);
    const sql = `CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${columns})`;
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`  ✓ ${name}`);
      created += 1;
    } catch (e) {
      // A missing table (a module not provisioned in this instance) must not
      // abort the rest — report and continue.
      console.warn(`  ⚠ skipped ${name}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  console.log(`✅  Done — ${created}/${INDEXES.length} statements applied.`);
}

main()
  .catch((e) => {
    console.error("❌  Index apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
