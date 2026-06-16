// Diagnostic: shows what permissions a user has end-to-end.
// Run with:  npx tsx scripts/check-permissions.ts hse@safeops360.in
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] ?? "hse@safeops360.in";

  console.log(`\n=== Permission diagnostic for ${email} ===\n`);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, role: true, plantId: true }
  });
  if (!user) {
    console.log(`✗ User not found.`);
    return;
  }
  console.log(`✓ User: ${user.name}  | legacy role=${user.role}  | plantId=${user.plantId ?? "NULL"}`);

  // 1. UserRole assignments
  const userRoles = await prisma.userRole.findMany({
    where: { userId: user.id },
    include: { role: true }
  });
  console.log(`\nUserRole rows: ${userRoles.length}`);
  for (const ur of userRoles) {
    console.log(
      `  - role.code=${ur.role.code}  isActive=${ur.role.isActive}  validTo=${ur.validTo ?? "∞"}`
    );
  }
  if (userRoles.length === 0) {
    console.log("\n⚠️  No UserRole assignments. Run: npm run db:seed-rbac\n");
    return;
  }

  // 2. RolePermission grants for those roles
  const roleIds = userRoles.map((ur) => ur.roleId);
  const rolePerms = await prisma.rolePermission.findMany({
    where: { roleId: { in: roleIds } },
    include: { permission: true, role: true }
  });
  console.log(`\nRolePermission grants for these roles: ${rolePerms.length}`);

  // Collect distinct permission codes
  const codes = new Set<string>();
  for (const rp of rolePerms) codes.add(rp.permission.code);
  console.log(`Distinct permission codes granted: ${codes.size}\n`);

  const opsCodes = ["OBSERVATION.READ", "NEAR_MISS.READ", "PTW.READ", "FLRA.READ", "INCIDENT.READ"];
  console.log("Operational Safety permission check:");
  for (const c of opsCodes) {
    console.log(`  ${codes.has(c) ? "✓" : "✗"} ${c}`);
  }

  console.log("\nFirst 20 distinct permissions:");
  [...codes].slice(0, 20).forEach((c) => console.log(`  - ${c}`));
}

main()
  .catch((e) => {
    console.error("Crashed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
