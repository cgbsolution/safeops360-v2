import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_PLANTS, DEMO_DEPARTMENTS, DEMO_ROLES, DEMO_PASSWORD, buildDemoEmail, nameForCell } from "./demo-users-config";

// ─────────────────────────────────────────────────────────────────────
// Login-only seed.
//
// This seed intentionally creates ONLY the data needed to log in and
// exercise RBAC: the base Role master, plants/areas, and the demo user
// matrix (role × dept × plant). All demo business records (observations,
// near misses, permits, FLRAs, incidents, inspections, training records,
// HIRA, CAPA, EAI, MOC, manhours, …) have been removed so the system
// starts as a clean slate.
//
// Master/config data (workflows, dropdowns, masters, agents, training
// programs, competency library, RBAC permission matrix) is seeded by the
// dedicated scripts (seed-workflows, seed-rbac, seed-agents, seed-masters,
// seed-dropdowns, seed-*-masters, seed-training-programs,
// seed-competency-library). This file no longer creates any of it.
// ─────────────────────────────────────────────────────────────────────

// Role codes — was a Prisma enum, now stored as strings driven by the Role master table.
const ROLE_CODES = {
  WORKER: "WORKER",
  HSE_MANAGER: "HSE_MANAGER",
  PLANT_HEAD: "PLANT_HEAD",
  ADMIN: "ADMIN",
  ENVIRONMENT_MANAGER: "ENVIRONMENT_MANAGER",
  CONTRACTOR_COORDINATOR: "CONTRACTOR_COORDINATOR",
  OCCUPATIONAL_HEALTH_OFFICER: "OCCUPATIONAL_HEALTH_OFFICER",
  EMERGENCY_RESPONSE_COORDINATOR: "EMERGENCY_RESPONSE_COORDINATOR",
  INDUSTRIAL_HYGIENIST: "INDUSTRIAL_HYGIENIST"
} as const;

const prisma = new PrismaClient();

// ─── Plant data — Page Industries Limited — Pulp & Paper ──────────────
const PAPER_MILL_AREAS = [
  "Wood Yard & Chip Handling",
  "Pulp Mill — Digester House & Confined Space Zones",
  "Bleaching Plant",
  "Stock Preparation & Approach Flow",
  "Paper Machine Hall (PM-1 & PM-2)",
  "Chemical Recovery, Recovery Boiler & Elevated Structures",
  "Causticizing & Lime Kiln",
  "Power & Steam Plant (Boiler House)",
  "Effluent Treatment Plant",
  "Chemical Storage & Handling Area",
  "Finishing House — Cutting, Reeling & Rewinding",
  "Reel & Ream Warehouse",
  "Maintenance Workshop",
  "Electrical Substation",
  "Canteen / Welfare Building"
];

const PLANTS = [
  {
    code: "NW",
    name: "Page Industries — North Paper Mill (Integrated Pulp & Writing/Printing Paper Unit)",
    location: "Industrial Area Phase II, Sector 7, Bharatpur",
    state: "Rajasthan",
    unitType: "Integrated",
    areas: PAPER_MILL_AREAS
  },
  {
    code: "SW",
    name: "Page Industries — South Kraft & Board Mill",
    location: "Special Economic Zone, Block C, Nellore",
    state: "Andhra Pradesh",
    unitType: "Integrated",
    areas: PAPER_MILL_AREAS
  },
  // Plant set limited to 2 (NW + SW) for demo — matches DEMO_PLANTS in demo-users-config.ts.
  // NW: primary demo plant (full data, healthy metrics).
  // SW: secondary plant (cross-plant comparison, slightly lower compliance).
];

// ─── Main Seed ───────────────────────────────────────────────────────
async function main() {
  console.log("🧹  Cleaning login + demo business data...");

  // Clean in dependency order. Business tables hold FKs to users so they
  // go before users. This wipes any leftover demo business records so the
  // system always comes up as a clean slate. Master/config tables
  // (trainingProgram, etc.) are intentionally NOT deleted here.
  await prisma.workflowTask.deleteMany();
  await prisma.workflowHistory.deleteMany();
  await prisma.workflowInstance.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.trainingRecord.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.fLRA.deleteMany();
  await prisma.permit.deleteMany();
  await prisma.nearMiss.deleteMany();
  await prisma.observation.deleteMany();
  await prisma.manhours.deleteMany();
  // AgentPrompt has createdById FK → User; must clear before user.deleteMany
  await prisma.agentPrompt.deleteMany();
  // UserRole has userId FK → User
  await prisma.userRole.deleteMany();
  await prisma.area.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.plant.deleteMany();
  await prisma.role.deleteMany();

  console.log("🛡️   Seeding Role master...");
  const ROLE_MASTER = [
    { code: ROLE_CODES.ADMIN, name: "System Administrator", description: "Full system access including configuration and master data.", isSystem: true, sortOrder: 0, defaultLanding: "/inbox" },
    { code: ROLE_CODES.PLANT_HEAD, name: "Plant Head", description: "Plant-level executive owner; final approver on high-risk records.", isSystem: true, sortOrder: 10, defaultLanding: "/dashboard" },
    { code: ROLE_CODES.HSE_MANAGER, name: "HSE Manager", description: "HSE leadership; approves and verifies safety records.", isSystem: true, sortOrder: 20, defaultLanding: "/inbox" },
    { code: ROLE_CODES.ENVIRONMENT_MANAGER, name: "Environment Manager", description: "Owns environmental compliance, consents, emissions, waste, sustainability KPIs.", isSystem: false, sortOrder: 30, defaultLanding: "/environmental" },
    { code: ROLE_CODES.CONTRACTOR_COORDINATOR, name: "Contractor Coordinator", description: "Owns contractor onboarding, document compliance, and offboarding.", isSystem: false, sortOrder: 40, defaultLanding: "/contractors" },
    { code: ROLE_CODES.OCCUPATIONAL_HEALTH_OFFICER, name: "Occupational Health Officer", description: "Owns OHC: medicals, fitness assessments, health surveillance.", isSystem: false, sortOrder: 50, defaultLanding: "/occupational-health" },
    { code: ROLE_CODES.EMERGENCY_RESPONSE_COORDINATOR, name: "Emergency Response Coordinator", description: "Owns ERP, mock drills, mutual aid, crisis communications.", isSystem: false, sortOrder: 60, defaultLanding: "/emergency-response" },
    { code: ROLE_CODES.INDUSTRIAL_HYGIENIST, name: "Industrial Hygienist", description: "Owns workplace exposure monitoring and health risk assessments.", isSystem: false, sortOrder: 70, defaultLanding: "/industrial-hygiene" },
    { code: ROLE_CODES.WORKER, name: "Worker", description: "Default role for shop-floor / field employees.", isSystem: true, sortOrder: 100, defaultLanding: "/inbox" }
  ];
  for (const r of ROLE_MASTER) {
    await prisma.role.create({ data: r });
  }

  console.log("🏭  Creating plants & areas...");
  const plants = [];
  for (const p of PLANTS) {
    const plant = await prisma.plant.create({
      data: {
        code: p.code,
        name: p.name,
        location: p.location,
        state: p.state,
        unitType: p.unitType,
        areas: { create: p.areas.map((name) => ({ name })) }
      },
      include: { areas: true }
    });
    plants.push(plant);
  }

  console.log("👥  Creating structured demo users (role × dept × plant matrix)...");
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Map plant code → DB row so we can look up plantId by slug from
  // demo-users-config.ts.
  const plantByCode = new Map(plants.map((p) => [p.code, p]));

  // 1a) Global anchor admin — back-compat for tooling/scripts.
  await prisma.user.create({
    data: {
      email: "admin@safeops360.in",
      name: "Vizionforge Admin",
      passwordHash: password,
      role: ROLE_CODES.ADMIN,
      designation: "System Administrator",
      department: "IT",
      plantId: plants[0].id
    }
  });

  // 1b) Priya Nair — PRIMARY DEMO PERSONA (HSE Manager, North Paper Mill).
  //     Demo walkthroughs are conducted logged in as her.
  //     Simple named email; always NW plant regardless of matrix.
  const nwPlant = plants.find(p => p.code === "NW");
  if (nwPlant) {
    await prisma.user.create({
      data: {
        email: "priya.nair@safeops360.in",
        name: "Priya Nair",
        passwordHash: password,
        role: ROLE_CODES.HSE_MANAGER,
        designation: "HSE Manager",
        department: "HSE",
        plantId: nwPlant.id
      }
    });
  }

  // 2) Structured matrix:  every role × every department × every plant.
  //    Email pattern:  {role-slug}.{dept-slug}.{plant-slug}@safeops360.in
  let cellCount = 0;
  for (let pi = 0; pi < DEMO_PLANTS.length; pi++) {
    const plant = plantByCode.get(DEMO_PLANTS[pi].code);
    if (!plant) {
      console.warn(`  ⚠️  Plant ${DEMO_PLANTS[pi].code} not found — skipping its users.`);
      continue;
    }
    for (let di = 0; di < DEMO_DEPARTMENTS.length; di++) {
      const dept = DEMO_DEPARTMENTS[di];
      for (let ri = 0; ri < DEMO_ROLES.length; ri++) {
        const role = DEMO_ROLES[ri];
        const email = buildDemoEmail(role.emailSlug, dept.slug, DEMO_PLANTS[pi].slug);
        const name = nameForCell(ri, di, pi);
        await prisma.user.create({
          data: {
            email,
            name,
            passwordHash: password,
            // User.role drives the displayed persona badge and the coarse
            // session-role gates. Seed it with the canonical roleCode (the same
            // value used for the UserRole assignment + the designation), NOT the
            // coarse `legacyRole` bucket — otherwise e.g. a Supervisor account
            // shows/acts as "WORKER" and a Department Head as "PLANT_HEAD".
            // (`legacyRole` is now vestigial; kept on the config for reference.)
            role: role.roleCode,
            designation: role.label,
            department: dept.name,
            plantId: plant.id
          }
        });
        cellCount++;
      }
    }
  }

  console.log(`   ✓ ${cellCount} structured users + 1 anchor admin = ${cellCount + 1} total`);
  console.log(`   Login pattern: {role-slug}.{dept}.{plant}@safeops360.in  /  ${DEMO_PASSWORD}`);
  console.log(`   e.g. supervisor.it.nw@safeops360.in  /  ${DEMO_PASSWORD}`);

  const allUsers = await prisma.user.findMany();

  console.log("✅  Login-only seed complete.");
  console.log(`   Plants: ${plants.length}`);
  console.log(`   Users:  ${allUsers.length}`);
  console.log(`   Anchor admin login: admin@safeops360.in / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
