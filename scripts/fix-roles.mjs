import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
const prisma = new PrismaClient();

const roles = await prisma.role.findMany({ select: { code: true, sortOrder: true } });
const validCodes = new Set(roles.map((r) => r.code));

const users = await prisma.user.findMany({
  select: {
    id: true, email: true, role: true, plantId: true,
    userRoles: { select: { scopeType: true, scopeValue: true, validFrom: true, validTo: true, role: { select: { code: true, sortOrder: true } } } },
  },
});

const now = new Date();
const isActive = (a) => !(a.validFrom && new Date(a.validFrom) > now) && !(a.validTo && new Date(a.validTo) < now);

function pickPrimary(u) {
  const active = u.userRoles.filter(isActive);
  if (active.length === 0) return null;
  const homeOrGlobal = active.filter((a) => a.scopeType === null || a.scopeValue === null || a.scopeValue === u.plantId);
  const pool = homeOrGlobal.length ? homeOrGlobal : active;
  pool.sort((a, b) => (a.role.sortOrder ?? 999) - (b.role.sortOrder ?? 999)); // lowest sortOrder = most senior
  return pool[0].role.code;
}

const changes = [];
for (const u of users) {
  const primary = pickPrimary(u);
  // Guardrails: only act when we have a confident home/global primary that is a
  // valid Role.code and actually differs from the current column.
  if (primary && validCodes.has(primary) && primary !== u.role) {
    changes.push({ id: u.id, email: u.email, oldRole: u.role, newRole: primary });
  }
}

console.log(`Planned updates: ${changes.length}`);
if (changes.length === 0) { await prisma.$disconnect(); process.exit(0); }

// Save rollback record BEFORE writing.
writeFileSync(new URL("./role-fix-rollback.json", import.meta.url), JSON.stringify(changes, null, 2));
console.log("Rollback saved -> scripts/role-fix-rollback.json");

await prisma.$transaction(changes.map((c) => prisma.user.update({ where: { id: c.id }, data: { role: c.newRole } })));

for (const c of changes) console.log(`  ${c.email.padEnd(38)} ${c.oldRole}  ->  ${c.newRole}`);
console.log(`\nDone. Updated ${changes.length} users.`);

await prisma.$disconnect();
