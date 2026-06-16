// Read-only verification that CAMS data is seeded. Safe to run anytime.
//   npx tsx prisma/check-cams.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function count(label: string, fn: () => Promise<number>): Promise<number> {
  try {
    const n = await fn();
    console.log(`  ${n > 0 ? "✓" : "·"}  ${label.padEnd(34)} ${n}`);
    return n;
  } catch (e) {
    console.log(`  ✗  ${label.padEnd(34)} ERROR: ${(e as Error).message.split("\n")[0]}`);
    return -1;
  }
}

async function main() {
  console.log("CAMS seed check\n────────────────");

  await count("CamsAuditType", () => prisma.camsAuditType.count());
  await count("CamsTemplate", () => prisma.camsTemplate.count());
  await count("  └ CamsTemplateSection", () => prisma.camsTemplateSection.count());
  await count("  └ CamsTemplateQuestion", () => prisma.camsTemplateQuestion.count());
  await count("  └ questions w/ ISO clause", () => prisma.camsTemplateQuestion.count({ where: { standardClauseRef: { not: null } } }));
  await count("CamsRecurrence", () => prisma.camsRecurrence.count());
  const eng = await count("CamsEngagement", () => prisma.camsEngagement.count());
  await count("  └ with sourceModule (consumer)", () => prisma.camsEngagement.count({ where: { sourceModule: { not: null } } }));
  await count("CamsResponse", () => prisma.camsResponse.count());
  await count("CamsFinding", () => prisma.camsFinding.count());
  await count("  └ MAJOR/CRITICAL NC", () => prisma.camsFinding.count({ where: { severity: { in: ["MAJOR_NC", "CRITICAL_NC"] } } }));
  await count("  └ repeat findings", () => prisma.camsFinding.count({ where: { isRepeatFinding: true } }));
  await count("  └ findings with CAPA", () => prisma.camsFinding.count({ where: { capaId: { not: null } } }));
  await count("CAPAs (AUDIT, /cams/findings/)", () => prisma.capa.count({ where: { sourceReferenceUrl: { contains: "/cams/findings/" } } }));

  console.log("\n  Engagements by status:");
  if (eng >= 0) {
    const byStatus = await prisma.camsEngagement.groupBy({ by: ["status"], _count: true });
    for (const r of byStatus.sort((a, b) => a.status.localeCompare(b.status))) console.log(`    ${r.status.padEnd(20)} ${r._count}`);
  }

  console.log("\n  RBAC:");
  await count("CAMS.* permissions", () => prisma.permission.count({ where: { module: "CAMS" } }));
  for (const code of ["CAMS_ADMIN", "AUDIT_MANAGER", "LEAD_AUDITOR", "AUDITOR"]) {
    const r = await prisma.role.findUnique({ where: { code } }).catch(() => null);
    console.log(`    ${r ? "✓" : "✗"}  role ${code}`);
  }

  console.log("\n  Personas:");
  for (const email of ["rohan.bhatt@safeops360.in", "anjali.verma@safeops360.in", "deepak.sharma.cams@safeops360.in"]) {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, role: true } }).catch(() => null);
    let roles = 0;
    if (u) roles = await prisma.userRole.count({ where: { userId: u.id } });
    console.log(`    ${u ? "✓" : "✗"}  ${email}${u ? ` (${u.name}, ${u.role}, ${roles} UserRole)` : " — MISSING"}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
