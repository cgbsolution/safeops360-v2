// ────────────────────────────────────────────────────────────────────────
// Master / lookup data seed.
// Idempotent — uses upsert on natural keys so re-running is safe.
//
// Tables seeded:
//   • Department — per-plant departments (HSE, Operations, Maintenance, …)
//   • ContractorCompany — companies whose workmen appear in records
//   • MasterItem — generic lookup with type discriminator:
//       SHIFT, ACTIVITY_TYPE, HAZARD_CATEGORY, ENERGY_SOURCE,
//       ROOT_CAUSE_CATEGORY
//
// Run:  npx tsx prisma/seed-masters.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Departments — applied per plant ───────────────────────────────
const DEPARTMENTS = [
  { name: "HSE", code: "HSE" },
  { name: "Operations", code: "OPS" },
  { name: "Maintenance", code: "MAINT" },
  { name: "Quality", code: "QC" },
  { name: "Stores", code: "STORE" },
  { name: "Electrical", code: "ELEC" },
  { name: "Mechanical", code: "MECH" },
  { name: "Process", code: "PROC" },
  { name: "Logistics", code: "LOG" },
  { name: "Administration", code: "ADMIN" },
  { name: "IT", code: "IT" },
  { name: "HR", code: "HR" },
  { name: "Contractor", code: "CONTRACT" }
];

// ─── Contractor companies ──────────────────────────────────────────
const CONTRACTORS = [
  { name: "Vizionforge Civil Pvt Ltd", code: "VFC", contactPerson: "R. Krishnan", contactEmail: "rk@vfc.example.in" },
  { name: "Star Erection Services", code: "SES", contactPerson: "S. Iyer", contactEmail: "siyer@ses.example.in" },
  { name: "North-East Mechanical Works", code: "NEMW", contactPerson: "M. Lyngdoh", contactEmail: "ml@nemw.example.in" },
  { name: "Granite Logistics", code: "GLOG", contactPerson: "P. Saha", contactEmail: "psaha@glog.example.in" },
  { name: "Reliable Cleaning Services", code: "RCS", contactPerson: "A. Choudhury", contactEmail: "ac@rcs.example.in" }
];

// ─── Shifts ────────────────────────────────────────────────────────
const SHIFTS = [
  { code: "A", label: "A — General (06:00–14:00)", sortOrder: 1, metadata: { startHour: 6, endHour: 14 } },
  { code: "B", label: "B — Afternoon (14:00–22:00)", sortOrder: 2, metadata: { startHour: 14, endHour: 22 } },
  { code: "C", label: "C — Night (22:00–06:00)", sortOrder: 3, metadata: { startHour: 22, endHour: 6 } },
  { code: "G", label: "G — General (09:00–17:00)", sortOrder: 4, metadata: { startHour: 9, endHour: 17 } }
];

// ─── Activity types ────────────────────────────────────────────────
const ACTIVITY_TYPES = [
  { code: "ROUTINE_OPERATION", label: "Routine operation" },
  { code: "ROUTINE_MAINTENANCE", label: "Routine maintenance" },
  { code: "BREAKDOWN_MAINTENANCE", label: "Breakdown maintenance" },
  { code: "SHUTDOWN_OVERHAUL", label: "Shutdown / overhaul" },
  { code: "CONFINED_SPACE_ENTRY", label: "Confined-space entry" },
  { code: "WORK_AT_HEIGHT", label: "Work at height" },
  { code: "HOT_WORK", label: "Hot work / welding" },
  { code: "ELECTRICAL_WORK", label: "Electrical work" },
  { code: "EXCAVATION", label: "Excavation" },
  { code: "MATERIAL_HANDLING", label: "Material handling" },
  { code: "MOBILE_EQUIPMENT", label: "Mobile equipment operation" },
  { code: "CHEMICAL_HANDLING", label: "Chemical handling" },
  { code: "INSPECTION", label: "Inspection / audit" },
  { code: "CLEANING_HOUSEKEEPING", label: "Cleaning / housekeeping" },
  { code: "MOVEMENT_TRANSIT", label: "Movement / transit" }
];

// ─── Hazard categories ─────────────────────────────────────────────
const HAZARD_CATEGORIES = [
  { code: "MECHANICAL", label: "Mechanical (rotating, pinch, struck-by)" },
  { code: "ELECTRICAL", label: "Electrical (shock, arc-flash)" },
  { code: "GRAVITY_FALL", label: "Gravity / fall (height, falling object)" },
  { code: "THERMAL", label: "Thermal (hot surface, fire, heat stress)" },
  { code: "CHEMICAL", label: "Chemical exposure" },
  { code: "PRESSURE", label: "Pressure (steam, hydraulic, pneumatic)" },
  { code: "CONFINED_SPACE", label: "Confined space" },
  { code: "ENVIRONMENTAL", label: "Environmental (spill, emission)" },
  { code: "BIOLOGICAL", label: "Biological" },
  { code: "ERGONOMIC", label: "Ergonomic" },
  { code: "NOISE_VIBRATION", label: "Noise / vibration" },
  { code: "RADIATION", label: "Radiation" },
  { code: "HOUSEKEEPING", label: "Slip / trip / housekeeping" },
  { code: "TRAFFIC", label: "Vehicle / traffic" },
  { code: "BEHAVIOURAL", label: "Behavioural / human factor" }
];

// ─── Energy sources (per Bowtie / energy-isolation thinking) ──────
const ENERGY_SOURCES = [
  { code: "ELECTRICAL", label: "Electrical" },
  { code: "MECHANICAL_KINETIC", label: "Mechanical (kinetic / rotating)" },
  { code: "MECHANICAL_POTENTIAL", label: "Mechanical (potential / stored)" },
  { code: "GRAVITY", label: "Gravity" },
  { code: "THERMAL", label: "Thermal" },
  { code: "CHEMICAL", label: "Chemical" },
  { code: "PRESSURE_HYDRAULIC", label: "Pressure (hydraulic)" },
  { code: "PRESSURE_PNEUMATIC", label: "Pressure (pneumatic)" },
  { code: "PRESSURE_STEAM", label: "Pressure (steam)" },
  { code: "RADIATION", label: "Radiation" },
  { code: "NONE_OBVIOUS", label: "None obvious" }
];

// ─── Root-cause categories (initial reporter hint + refined review) ─
const ROOT_CAUSE_CATEGORIES = [
  { code: "HUMAN_FACTOR", label: "Human factor (skill, attention, fatigue)" },
  { code: "EQUIPMENT", label: "Equipment (failure, condition)" },
  { code: "PROCESS", label: "Process / procedure (gap, deviation)" },
  { code: "ENVIRONMENT", label: "Environment / workplace condition" },
  { code: "MANAGEMENT_SYSTEM", label: "Management system (training, supervision, audit)" },
  { code: "EXTERNAL", label: "External factor" }
];

async function seedMasterItems(type: string, items: { code: string; label: string; sortOrder?: number; metadata?: any }[]) {
  let created = 0;
  let updated = 0;
  for (const [i, item] of items.entries()) {
    const existing = await prisma.masterItem.findUnique({
      where: { type_code: { type, code: item.code } }
    });
    if (existing) {
      await prisma.masterItem.update({
        where: { id: existing.id },
        data: { label: item.label, sortOrder: item.sortOrder ?? i + 1, metadata: item.metadata ?? null, active: true }
      });
      updated++;
    } else {
      await prisma.masterItem.create({
        data: { type, code: item.code, label: item.label, sortOrder: item.sortOrder ?? i + 1, metadata: item.metadata ?? null }
      });
      created++;
    }
  }
  console.log(`  ${type.padEnd(22)}: ${created} created, ${updated} updated  (total ${items.length})`);
}

async function main() {
  console.log("\n=== Master data seed ===\n");

  // Departments — per plant
  const plants = await prisma.plant.findMany({ orderBy: { code: "asc" } });
  if (plants.length === 0) {
    throw new Error("No plants found — run prisma/seed.ts first");
  }
  let dCreated = 0;
  let dExists = 0;
  for (const plant of plants) {
    for (const dept of DEPARTMENTS) {
      const existing = await prisma.department.findUnique({
        where: { plantId_name: { plantId: plant.id, name: dept.name } }
      });
      if (existing) {
        dExists++;
      } else {
        await prisma.department.create({
          data: { plantId: plant.id, name: dept.name, code: dept.code, active: true }
        });
        dCreated++;
      }
    }
  }
  console.log(`  Department            : ${dCreated} created, ${dExists} existed (across ${plants.length} plants)`);

  // Contractor companies
  let cCreated = 0;
  let cUpdated = 0;
  for (const c of CONTRACTORS) {
    const existing = await prisma.contractorCompany.findUnique({ where: { name: c.name } });
    if (existing) {
      await prisma.contractorCompany.update({
        where: { id: existing.id },
        data: { code: c.code, contactPerson: c.contactPerson, contactEmail: c.contactEmail }
      });
      cUpdated++;
    } else {
      await prisma.contractorCompany.create({ data: c });
      cCreated++;
    }
  }
  console.log(`  ContractorCompany     : ${cCreated} created, ${cUpdated} updated  (total ${CONTRACTORS.length})`);

  // MasterItem rows
  await seedMasterItems("SHIFT", SHIFTS);
  await seedMasterItems("ACTIVITY_TYPE", ACTIVITY_TYPES);
  await seedMasterItems("HAZARD_CATEGORY", HAZARD_CATEGORIES);
  await seedMasterItems("ENERGY_SOURCE", ENERGY_SOURCES);
  await seedMasterItems("ROOT_CAUSE_CATEGORY", ROOT_CAUSE_CATEGORIES);

  console.log("\n✅ Master data seed complete.\n");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
