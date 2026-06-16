// Quick diagnostic: checks why login is failing.
// Run with:  npx tsx scripts/check-login.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const demos = [
    "hse@safeops360.in",
    "planthead@safeops360.in",
    "worker@safeops360.in"
  ];

  console.log("\n=== SafeOps360 login diagnostic ===\n");

  // 1. DB connectivity
  try {
    const userCount = await prisma.user.count();
    console.log(`✓ DB connected. ${userCount} users in DB.\n`);
    if (userCount === 0) {
      console.log("⚠️  User table is EMPTY. The seed has not been run.");
      console.log("   Fix: npm run db:seed\n");
      return;
    }
  } catch (e: any) {
    console.log(`✗ Cannot connect to DB: ${e.message}\n`);
    return;
  }

  // 2. Per demo user
  for (const email of demos) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) {
      console.log(`✗ ${email} — NOT FOUND in DB`);
      continue;
    }
    const ok = await bcrypt.compare("demo123", u.passwordHash);
    console.log(
      `${ok ? "✓" : "✗"} ${email}  | role=${u.role.padEnd(20)} plantId=${u.plantId ?? "NULL"}  passwordOK=${ok}`
    );
  }

  // 3. Are there ANY users we could log in as?
  const sampleUser = await prisma.user.findFirst();
  if (sampleUser) {
    console.log(`\nSample user in DB: ${sampleUser.email} (role=${sampleUser.role})`);
  }

  // 4. RBAC sanity
  const roleCount = await prisma.role.count();
  const userRoleCount = await prisma.userRole.count();
  console.log(`\nRBAC: ${roleCount} roles seeded, ${userRoleCount} user-role assignments.`);
  if (roleCount === 0) {
    console.log("⚠️  No roles in DB. Run: npm run db:seed-rbac");
  }

  console.log("\n=== Recommendations ===");
  console.log("If passwordOK=false for all → run: npm run db:reset  (wipes + reseeds everything)");
  console.log("If users not found → run: npm run db:seed");
  console.log("If userRoles count is 0 → run: npm run db:seed-rbac\n");
}

main()
  .catch((e) => {
    console.error("Diagnostic crashed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
