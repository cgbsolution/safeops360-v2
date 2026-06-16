// Extended dropdown seed — adds the modern types used by the admin panel
// (observation categories, training categories, designations, etc.) on top
// of the original seed-masters.ts which already covered SHIFT,
// ACTIVITY_TYPE, HAZARD_CATEGORY, ENERGY_SOURCE, ROOT_CAUSE_CATEGORY.
//
// Idempotent — uses upsert on (type, code).

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SEEDS: Record<string, { code: string; label: string }[]> = {
  OBSERVATION_CATEGORY: [
    { code: "PPE", label: "PPE compliance" },
    { code: "HOUSEKEEPING", label: "Housekeeping" },
    { code: "BEHAVIOUR", label: "At-risk behaviour" },
    { code: "EQUIPMENT_TOOLS", label: "Equipment / tools condition" },
    { code: "WORKPLACE", label: "Workplace condition" },
    { code: "PROCEDURES", label: "Procedure / SOP deviation" },
    { code: "ENVIRONMENT", label: "Environmental concern" },
    { code: "VEHICLE_TRAFFIC", label: "Vehicle / traffic" },
    { code: "EMERGENCY_PREP", label: "Emergency preparedness" },
    { code: "OTHER", label: "Other" }
  ],
  INCIDENT_TYPE: [
    { code: "INJURY", label: "Personal injury" },
    { code: "PROPERTY_DAMAGE", label: "Property damage" },
    { code: "ENVIRONMENTAL", label: "Environmental release" },
    { code: "FIRE", label: "Fire / explosion" },
    { code: "VEHICLE", label: "Vehicle incident" },
    { code: "OCCUPATIONAL_ILLNESS", label: "Occupational illness" },
    { code: "PROCESS_UPSET", label: "Process upset" }
  ],
  PERMIT_TYPE: [
    { code: "HOT_WORK", label: "Hot work" },
    { code: "CONFINED_SPACE", label: "Confined-space entry" },
    { code: "WORK_AT_HEIGHT", label: "Work at height" },
    { code: "EXCAVATION", label: "Excavation" },
    { code: "ELECTRICAL", label: "Electrical" },
    { code: "LIFTING", label: "Critical lifting" },
    { code: "RADIATION", label: "Radiography" },
    { code: "GENERAL", label: "General" }
  ],
  PPE_TYPE: [
    { code: "HARD_HAT", label: "Hard hat" },
    { code: "SAFETY_SHOES", label: "Safety shoes" },
    { code: "SAFETY_GLASSES", label: "Safety glasses" },
    { code: "HIGH_VIS_VEST", label: "High-visibility vest" },
    { code: "GLOVES_LEATHER", label: "Gloves — leather" },
    { code: "GLOVES_NITRILE", label: "Gloves — chemical (nitrile)" },
    { code: "EAR_PLUGS", label: "Hearing protection — plugs" },
    { code: "EAR_MUFFS", label: "Hearing protection — muffs" },
    { code: "DUST_MASK", label: "Dust mask (N95)" },
    { code: "FACE_SHIELD", label: "Face shield" },
    { code: "WELDING_HOOD", label: "Welding hood" },
    { code: "FALL_HARNESS", label: "Full-body fall harness" },
    { code: "SCBA", label: "Self-contained breathing apparatus" },
    { code: "FRC", label: "Flame-retardant coverall (FRC)" }
  ],
  TRAINING_CATEGORY: [
    { code: "INDUCTION", label: "Induction" },
    { code: "TECHNICAL", label: "Technical" },
    { code: "BEHAVIOURAL", label: "Behavioural" },
    { code: "STATUTORY", label: "Statutory" },
    { code: "EMERGENCY", label: "Emergency response" },
    { code: "LEADERSHIP", label: "Leadership" },
    { code: "COMPLIANCE", label: "Compliance" },
    { code: "REFRESHER", label: "Refresher" }
  ],
  TRAINING_TYPE: [
    { code: "CLASSROOM", label: "Classroom" },
    { code: "E_LEARNING", label: "E-learning" },
    { code: "ON_JOB", label: "On-the-job" },
    { code: "BLENDED", label: "Blended" },
    { code: "CERTIFICATION", label: "Certification" },
    { code: "WORKSHOP", label: "Workshop" },
    { code: "DRILL", label: "Drill" }
  ],
  INSPECTION_CATEGORY: [
    { code: "ROUTINE", label: "Routine" },
    { code: "STATUTORY", label: "Statutory" },
    { code: "PRE_OPERATIONAL", label: "Pre-operational" },
    { code: "POST_INCIDENT", label: "Post-incident" },
    { code: "CONDITION_BASED", label: "Condition-based" },
    { code: "THIRD_PARTY", label: "Third-party" },
    { code: "FOCUSED", label: "Focused (event-driven)" }
  ],
  EQUIPMENT_CATEGORY: [
    { code: "PROCESS_CRITICAL", label: "Process Critical" },
    { code: "MOBILE", label: "Mobile Equipment" },
    { code: "LIFTING", label: "Lifting Equipment" },
    { code: "FIRE_SAFETY", label: "Fire Safety" },
    { code: "EMERGENCY", label: "Emergency" },
    { code: "STATUTORY", label: "Statutory" },
    { code: "ELECTRICAL", label: "Electrical" },
    { code: "HAND_TOOLS", label: "Hand Tools" }
  ],
  EQUIPMENT_CRITICALITY: [
    { code: "A", label: "A — Critical (process-stopping if down)" },
    { code: "B", label: "B — High (significant impact)" },
    { code: "C", label: "C — Medium (moderate impact)" },
    { code: "D", label: "D — Low (minimal impact)" }
  ],
  STATUTORY_FORM_TYPE: [
    { code: "FORM_11_PRESSURE_VESSEL", label: "Form 11 — Pressure Vessel" },
    { code: "FORM_13_LIFTING_EQUIPMENT", label: "Form 13 — Lifting Equipment" },
    { code: "FORM_4_FACTORY_LICENSE", label: "Form 4 — Factory License" },
    { code: "PESO_CYLINDER_INSPECTION", label: "PESO — Gas Cylinder Inspection" },
    { code: "ELECTRICAL_INSPECTORATE", label: "Electrical Inspectorate" },
    { code: "POLLUTION_CONTROL_BOARD", label: "Pollution Control Board" }
  ],
  DESIGNATION: [
    { code: "WORKER", label: "Worker" },
    { code: "OPERATOR", label: "Operator" },
    { code: "FOREMAN", label: "Foreman" },
    { code: "SUPERVISOR", label: "Supervisor" },
    { code: "ENGINEER", label: "Engineer" },
    { code: "SR_ENGINEER", label: "Senior Engineer" },
    { code: "MANAGER", label: "Manager" },
    { code: "SR_MANAGER", label: "Senior Manager" },
    { code: "DGM", label: "Deputy GM" },
    { code: "GM", label: "General Manager" },
    { code: "VP", label: "Vice President" }
  ],
  DEPARTMENT_FUNCTION: [
    { code: "PRODUCTION", label: "Production" },
    { code: "MAINTENANCE", label: "Maintenance" },
    { code: "QUALITY", label: "Quality" },
    { code: "HSE", label: "Health, Safety & Environment" },
    { code: "PROCESS", label: "Process" },
    { code: "ELECTRICAL", label: "Electrical" },
    { code: "MECHANICAL", label: "Mechanical" },
    { code: "INSTRUMENTATION", label: "Instrumentation" },
    { code: "STORES", label: "Stores" },
    { code: "ADMINISTRATION", label: "Administration" },
    { code: "FINANCE", label: "Finance" },
    { code: "HR", label: "Human Resources" },
    { code: "IT", label: "Information Technology" }
  ],
  FINDING_SEVERITY_REASON: [
    { code: "IMMINENT_DANGER", label: "Imminent danger to life" },
    { code: "SAFETY_GUARD_DOWN", label: "Safety guard / interlock disabled" },
    { code: "STATUTORY_BREACH", label: "Statutory non-compliance" },
    { code: "REPEAT_FAILURE", label: "Repeat of an earlier finding" },
    { code: "PROCESS_STOPPING", label: "Process-stopping equipment defect" }
  ]
};

async function main() {
  console.log("\n=== Extended dropdown seed ===\n");
  let totalCreated = 0;
  let totalUpdated = 0;
  for (const [type, items] of Object.entries(SEEDS)) {
    let created = 0;
    let updated = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const existing = await prisma.masterItem.findUnique({
        where: { type_code: { type, code: it.code } }
      });
      if (existing) {
        await prisma.masterItem.update({
          where: { id: existing.id },
          data: { label: it.label, sortOrder: i + 1, active: true }
        });
        updated++;
      } else {
        await prisma.masterItem.create({
          data: { type, code: it.code, label: it.label, sortOrder: i + 1, active: true }
        });
        created++;
      }
    }
    totalCreated += created;
    totalUpdated += updated;
    console.log(`  ${type.padEnd(28)}: ${created} created, ${updated} updated`);
  }
  console.log(`\n✅ Done. ${totalCreated} created, ${totalUpdated} updated.\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
