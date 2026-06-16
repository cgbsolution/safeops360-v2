// One-off cleanup. Removes the old dotted-format AGENT permission rows
// (AGENT.RCA.INVOKE etc) left behind from a prior seed-rbac run before
// the codes were renamed to single-dot form (AGENT.RCA_INVOKE etc).
// Safe to re-run.

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const oldCodes = [
    "AGENT.RCA.INVOKE",
    "AGENT.RCA.CONFIGURE",
    "AGENT.AUDIT.VIEW",
    "AGENT.PROMPT.EDIT"
  ];
  const result = await prisma.permission.deleteMany({
    where: { code: { in: oldCodes } }
  });
  console.log(`Deleted ${result.count} orphan AGENT.*.* permission row(s)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
