// Idempotently adds role-specific demo accounts to the existing DB.
// Safe to re-run — uses upsert so it won't duplicate or wipe data.
// Run with:  npx tsx scripts/upsert-demo-accounts.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type DemoSpec = {
  email: string;
  name: string;
  legacyRole: string;       // The User.role string column
  rbacRoleCodes: string[];  // The Role.code values that get UserRole rows
  designation: string;
  department: string;
};

const DEMOS: DemoSpec[] = [
  {
    email: "safety@safeops360.in",
    name: "Anjali Sharma",
    legacyRole: "HSE_MANAGER",         // legacy column expects one of the original 9
    rbacRoleCodes: ["SAFETY_OFFICER"],  // actual role granted via UserRole
    designation: "Safety Officer",
    department: "HSE"
  },
  {
    email: "supervisor@safeops360.in",
    name: "Vinod Khanna",
    legacyRole: "WORKER",
    rbacRoleCodes: ["SUPERVISOR"],
    designation: "Production Supervisor",
    department: "Production"
  },
  {
    email: "corporate@safeops360.in",
    name: "Priya Mehta",
    legacyRole: "HSE_MANAGER",
    rbacRoleCodes: ["CORPORATE_HSE"],
    designation: "Corporate HSE Lead",
    department: "Corporate HSE"
  },
  {
    email: "issuer@safeops360.in",
    name: "Manoj Verma",
    legacyRole: "WORKER",
    rbacRoleCodes: ["PERMIT_ISSUER"],
    designation: "Permit Issuer",
    department: "Operations"
  },
  {
    email: "contractor@safeops360.in",
    name: "Imran Qureshi",
    legacyRole: "WORKER",
    rbacRoleCodes: ["CONTRACTOR_WORKMAN"],
    designation: "Contractor Crew Member",
    department: "Contractor"
  },
  {
    email: "dept-head@safeops360.in",
    name: "Pooja Desai",
    legacyRole: "PLANT_HEAD",
    rbacRoleCodes: ["DEPARTMENT_HEAD"],
    designation: "Department Head — Production",
    department: "Production"
  }
];

async function main() {
  console.log("\n=== Upserting role-specific demo accounts ===\n");

  const password = await bcrypt.hash("demo123", 10);

  // Anchor every demo to the first plant (matches the existing demos)
  const plant = await prisma.plant.findFirst({ orderBy: { code: "asc" } });
  if (!plant) {
    console.log("✗ No plants in DB. Run `npm run db:seed` first.");
    return;
  }
  console.log(`Anchoring demos to plant: ${plant.name} (${plant.code})\n`);

  for (const d of DEMOS) {
    const user = await prisma.user.upsert({
      where: { email: d.email },
      create: {
        email: d.email,
        name: d.name,
        passwordHash: password,
        role: d.legacyRole,
        designation: d.designation,
        department: d.department,
        plantId: plant.id
      },
      update: {
        // Don't reset passwords or break ids on re-run — only ensure
        // metadata stays in sync with this script.
        name: d.name,
        role: d.legacyRole,
        designation: d.designation,
        department: d.department,
        plantId: plant.id
      }
    });

    // Sync UserRole rows for the new RBAC system
    for (const code of d.rbacRoleCodes) {
      const role = await prisma.role.findUnique({ where: { code } });
      if (!role) {
        console.log(`  ⚠️  Role '${code}' not in DB — run \`npm run db:seed-rbac\` first.`);
        continue;
      }
      const existing = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId: role.id }
      });
      if (!existing) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId: role.id, scopeValue: plant.id }
        });
      }
    }

    console.log(`✓ ${d.email.padEnd(34)} ${d.name.padEnd(20)} → ${d.rbacRoleCodes.join(", ")}`);
  }

  console.log("\nAll demos use password: demo123");
  console.log("Done.\n");
}

main()
  .catch((e) => {
    console.error("Script crashed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
