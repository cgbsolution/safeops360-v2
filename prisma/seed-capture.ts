// Guided Field Capture seed — ADDITIVE + idempotent, safe on the shared DB.
//
// What it seeds:
//   1. FIELD_TECHNICIAN role + CAPTURE.*/ALERT.* permissions + role grants
//      (also present in seed-rbac.ts's canonical matrix — this script lets you
//      enable the module WITHOUT re-running the full RBAC wipe/rebuild)
//   2. Apparel-context areas at Meridian North Works (Cutting Hall, Sewing
//      Lines, Boiler House, Warehouse, Compressor House, Finishing & Packing)
//   3. Demo field technicians (Hindi-first personas) with FIELD_TECHNICIAN role
//   4. Bilingual hazard taxonomy + cause library + control library from
//      prisma/capture-taxonomy-data.ts (upsert on [kind, code] — re-runs
//      refresh labels/icons without duplicating)
//
// Prereqs: seed.ts (plants/users) + seed-rbac.ts (base roles). Tables come
// from `npx tsx prisma/apply-capture-ddl.ts` (hand-DDL; never `prisma db push`).
// Run: npm run db:seed-capture   (or npx tsx prisma/seed-capture.ts)

import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { DEMO_PASSWORD } from "./demo-users-config";
import {
  CAUSE_LIBRARY,
  CONTROL_LIBRARY,
  HAZARD_TAXONOMY,
  type TaxonomyNodeSeed,
} from "./capture-taxonomy-data";

const prisma = new PrismaClient();

// ─── 1. Role + permissions + grants ──────────────────────────────────────────
const CAPTURE_PERMISSIONS = [
  { code: "CAPTURE.CREATE", module: "CAPTURE", action: "CREATE", description: "Submit guided field reports (observation / near-miss / unsafe condition / incident) from the capture wizard" },
  { code: "CAPTURE.READ",   module: "CAPTURE", action: "READ",   description: "View field-report submissions (triage queue / own history by scope)" },
  { code: "CAPTURE.TRIAGE", module: "CAPTURE", action: "TRIAGE", description: "Triage field reports onto the 5x5 matrix; convert to Observation / Near Miss / Incident; reject" },
  { code: "CAPTURE.UNMASK", module: "CAPTURE", action: "UNMASK", description: "Reveal the reporter of an anonymous field report (writes a READ_SENSITIVE audit entry)" },
  { code: "ALERT.READ",     module: "ALERT",   action: "READ",   description: "View the daily alert brief feed (/dashboard/daily)" },
  { code: "ALERT.ACK",      module: "ALERT",   action: "ACK",    description: "Acknowledge alert cards (audited)" },
  { code: "ALERT.MUTE",     module: "ALERT",   action: "MUTE",   description: "Mute non-critical alert cards for 24h" },
];

type GrantSpec = { role: string; permission: string; scope: string };
const GRANTS: GrantSpec[] = [
  { role: "FIELD_TECHNICIAN", permission: "CAPTURE.CREATE", scope: "OWN_PLANT" },
  { role: "FIELD_TECHNICIAN", permission: "CAPTURE.READ",   scope: "OWN_RECORDS" },
  { role: "WORKER",           permission: "CAPTURE.CREATE", scope: "ALL_PLANTS" },
  { role: "WORKER",           permission: "CAPTURE.READ",   scope: "OWN_RECORDS" },
  ...["SAFETY_OFFICER", "HSE_MANAGER"].flatMap((role) => [
    { role, permission: "CAPTURE.READ",   scope: "OWN_PLANT" },
    { role, permission: "CAPTURE.TRIAGE", scope: "OWN_PLANT" },
    { role, permission: "ALERT.READ",     scope: "OWN_PLANT" },
    { role, permission: "ALERT.ACK",      scope: "OWN_PLANT" },
    { role, permission: "ALERT.MUTE",     scope: "OWN_PLANT" },
  ]),
  { role: "PLANT_HEAD", permission: "CAPTURE.READ", scope: "OWN_PLANT" },
  { role: "PLANT_HEAD", permission: "ALERT.READ",   scope: "OWN_PLANT" },
  { role: "PLANT_HEAD", permission: "ALERT.ACK",    scope: "OWN_PLANT" },
  { role: "PLANT_HEAD", permission: "ALERT.MUTE",   scope: "OWN_PLANT" },
  ...["CORPORATE_HSE"].flatMap((role) => [
    { role, permission: "CAPTURE.READ",   scope: "ALL_PLANTS" },
    { role, permission: "CAPTURE.TRIAGE", scope: "ALL_PLANTS" },
    { role, permission: "ALERT.READ",     scope: "ALL_PLANTS" },
    { role, permission: "ALERT.ACK",      scope: "ALL_PLANTS" },
    { role, permission: "ALERT.MUTE",     scope: "ALL_PLANTS" },
  ]),
  ...["ADMIN", "SYSTEM_ADMIN"].flatMap((role) => [
    { role, permission: "CAPTURE.CREATE", scope: "ALL_PLANTS" },
    { role, permission: "CAPTURE.READ",   scope: "ALL_PLANTS" },
    { role, permission: "CAPTURE.TRIAGE", scope: "ALL_PLANTS" },
    { role, permission: "CAPTURE.UNMASK", scope: "ALL_PLANTS" },
    { role, permission: "ALERT.READ",     scope: "ALL_PLANTS" },
    { role, permission: "ALERT.ACK",      scope: "ALL_PLANTS" },
    { role, permission: "ALERT.MUTE",     scope: "ALL_PLANTS" },
  ]),
];

async function seedRbac() {
  await prisma.role.upsert({
    where: { code: "FIELD_TECHNICIAN" },
    create: {
      code: "FIELD_TECHNICIAN",
      name: "Field Technician",
      description:
        "Field worker persona for the guided capture wizard (icon-first, voice-first, offline-capable). Submits observations / near-misses / unsafe conditions; sees own reports only.",
      isSystem: false,
      sortOrder: 108,
      defaultLanding: "/capture",
    },
    update: { defaultLanding: "/capture" },
  });

  for (const p of CAPTURE_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      create: p,
      update: { module: p.module, action: p.action, description: p.description },
    });
  }

  const roles = new Map(
    (await prisma.role.findMany({ select: { id: true, code: true } })).map((r) => [r.code, r.id])
  );
  const perms = new Map(
    (await prisma.permission.findMany({ where: { module: { in: ["CAPTURE", "ALERT"] } }, select: { id: true, code: true } })).map((p) => [p.code, p.id])
  );

  let created = 0;
  for (const g of GRANTS) {
    const roleId = roles.get(g.role);
    const permissionId = perms.get(g.permission);
    if (!roleId || !permissionId) continue; // role not seeded in this env — skip
    const existing = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    if (existing) {
      if (existing.scope !== g.scope) {
        await prisma.rolePermission.update({ where: { id: existing.id }, data: { scope: g.scope } });
      }
    } else {
      await prisma.rolePermission.create({ data: { roleId, permissionId, scope: g.scope } });
      created++;
    }
  }
  console.log(`✓ RBAC: FIELD_TECHNICIAN role, ${CAPTURE_PERMISSIONS.length} permissions, ${created} new grants`);
}

// ─── 2. Apparel-context areas at NW ──────────────────────────────────────────
const NW_AREAS = [
  "Cutting Hall",
  "Sewing Line 1",
  "Sewing Line 2",
  "Finishing & Packing",
  "Boiler House",
  "Fabric Warehouse",
  "Compressor House",
];

async function seedAreas(plantId: string) {
  let created = 0;
  for (const name of NW_AREAS) {
    const existing = await prisma.area.findFirst({ where: { plantId, name } });
    if (!existing) {
      await prisma.area.create({ data: { plantId, name } });
      created++;
    }
  }
  console.log(`✓ Areas at NW: ${created} created (${NW_AREAS.length - created} already present)`);
}

// ─── 3. Demo field technicians (Hindi-first personas) ────────────────────────
const TECHNICIANS = [
  { email: "ramesh.kumar@safeops360.in",  name: "Ramesh Kumar",  designation: "Sewing Machine Operator" },
  { email: "sunita.devi@safeops360.in",   name: "Sunita Devi",   designation: "Cutting Section Helper" },
  { email: "arjun.pal@safeops360.in",     name: "Arjun Pal",     designation: "Boiler Attendant" },
];

async function seedTechnicians(plantId: string) {
  const role = await prisma.role.findUnique({ where: { code: "FIELD_TECHNICIAN" } });
  if (!role) throw new Error("FIELD_TECHNICIAN role missing — seedRbac() must run first");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const t of TECHNICIANS) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      create: {
        email: t.email,
        name: t.name,
        passwordHash,
        role: "FIELD_TECHNICIAN",
        plantId,
        designation: t.designation,
      },
      update: { role: "FIELD_TECHNICIAN", plantId, designation: t.designation },
    });
    const existing = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: role.id },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id, scopeType: "PLANT", scopeValue: plantId },
      });
    }
  }
  console.log(`✓ Field technicians: ${TECHNICIANS.map((t) => t.email).join(", ")} (password: ${DEMO_PASSWORD})`);
}

// ─── 4. Taxonomy (bilingual, upsert on [kind, code]) ─────────────────────────
async function upsertTree(
  kind: "HAZARD" | "CAUSE" | "CONTROL",
  nodes: TaxonomyNodeSeed[],
  parentId: string | null,
  level: number,
  inheritedFishbone: string | null,
): Promise<number> {
  let count = 0;
  for (const node of nodes) {
    const fishbone = node.fishboneCategory ?? inheritedFishbone;
    const row = await prisma.captureTaxonomy.upsert({
      where: { kind_code: { kind, code: node.code } },
      create: {
        kind,
        code: node.code,
        level,
        parentId,
        labels: node.labels,
        iconKey: node.iconKey,
        fishboneCategory: fishbone,
        sortWeight: node.sortWeight,
        active: true,
      },
      update: {
        level,
        parentId,
        labels: node.labels,
        iconKey: node.iconKey,
        fishboneCategory: fishbone,
        sortWeight: node.sortWeight,
        active: true,
      },
    });
    count += 1;
    if (node.children?.length) {
      count += await upsertTree(kind, node.children, row.id, level + 1, fishbone);
    }
  }
  return count;
}

async function main() {
  console.log("Seeding Guided Field Capture (additive)…");

  const nw = await prisma.plant.findFirst({ where: { code: "NW" } });
  if (!nw) throw new Error("Plant NW not found — run seed.ts first");

  await seedRbac();
  await seedAreas(nw.id);
  await seedTechnicians(nw.id);

  const hazards = await upsertTree("HAZARD", HAZARD_TAXONOMY, null, 1, null);
  const causes = await upsertTree("CAUSE", CAUSE_LIBRARY, null, 1, null);
  const controls = await upsertTree("CONTROL", CONTROL_LIBRARY, null, 1, null);
  console.log(`✓ Taxonomy: ${hazards} hazard, ${causes} cause, ${controls} control nodes`);

  console.log("✅ seed-capture complete");
}

main()
  .catch((e) => {
    console.error("❌ seed-capture failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
