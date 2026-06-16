import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const rows = await p.workflowTask.groupBy({
    by: ['assignedToId'],
    where: { status: { in: ['PENDING', 'OVERDUE', 'ESCALATED'] } },
    _count: { id: true },
  });

  const ids = rows.map((r) => r.assignedToId);
  const users = await p.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true },
  });
  const map = Object.fromEntries(users.map((u) => [u.id, u.email]));

  rows.sort((a, b) => b._count.id - a._count.id);

  console.log('\n📬  Inbox task distribution (PENDING/OVERDUE/ESCALATED):');
  console.log('  Count  Email');
  console.log('  ─────  ────────────────────────────────────────');
  rows.forEach((r) =>
    console.log(`  ${String(r._count.id).padStart(5)}  ${map[r.assignedToId] || r.assignedToId}`)
  );
  console.log(`\n  Total: ${rows.reduce((s, r) => s + r._count.id, 0)} tasks across ${rows.length} users\n`);

  // also show submitted-by-me distribution
  const submitted = await p.workflowInstance.groupBy({
    by: ['initiatedById'],
    _count: { id: true },
  });
  const sids = submitted.map((r) => r.initiatedById);
  const susers = await p.user.findMany({ where: { id: { in: sids } }, select: { id: true, email: true } });
  const smap = Object.fromEntries(susers.map((u) => [u.id, u.email]));
  submitted.sort((a, b) => b._count.id - a._count.id);
  console.log('📤  Submitted-by-me distribution (WorkflowInstance initiators):');
  console.log('  Count  Email');
  console.log('  ─────  ────────────────────────────────────────');
  submitted.forEach((r) =>
    console.log(`  ${String(r._count.id).padStart(5)}  ${smap[r.initiatedById] || r.initiatedById}`)
  );
  console.log(`\n  Total: ${submitted.reduce((s, r) => s + r._count.id, 0)} instances across ${submitted.length} users\n`);
}

main().catch(console.error).finally(() => p.$disconnect());
