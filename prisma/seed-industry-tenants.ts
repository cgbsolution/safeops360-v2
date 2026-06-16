// ─────────────────────────────────────────────────────────────────────────────
// seed-industry-tenants.ts
//
// Seeds 10 full demo tenants — one per heavy-manufacturing vertical.
// Each tenant gets: 1 plant + 15 industry-specific areas, named primary HSE
// Manager persona, 5 supporting users, 17 months of manhours, 3-4 LTI
// incidents, and 2 active permits (HOT_WORK + CONFINED_SPACE).
//
// Idempotent: uses upsert on plant code / user email / manhours(plantId+year+month).
// Incidents and permits are deleted by number before re-creating.
//
// Run standalone: npx tsx prisma/seed-industry-tenants.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_PASSWORD, DEMO_INDUSTRIES } from "./demo-users-config";

const prisma = new PrismaClient();

const DEMO_TODAY = new Date("2026-06-07T09:00:00.000Z");

// ─── Industry-specific areas (15 per plant) ───────────────────────────────────

const INDUSTRY_AREAS: Record<string, string[]> = {
  AXM: [
    "Yarn & Fabric Store",
    "Knitting Section (Circular Knitting Machines)",
    "Dye House — Dyeing & Processing",
    "Cutting Section — Spreading & Band Knife",
    "Sewing / Stitching Lines (Men's Innerwear)",
    "Printing & Embroidery",
    "Checking & Finishing (AQL Quality)",
    "Pressing & Ironing (Steam Press)",
    "Effluent Treatment Plant",
    "Chemical & Dye Store",
    "QC & Fabric Testing Laboratory",
    "Maintenance Workshop",
    "Confined Space Zones (Dye Vessels, ETP Tanks, Pits)",
    "Boiler House & Utilities (Steam, Compressors)",
    "Electrical Substation"
  ],
  MCP: [
    "Yarn & Fabric Store",
    "Knitting Section (Athleisure Fabrics)",
    "Dye House — Dyeing & Processing",
    "Cutting Section — Spreading & Band Knife",
    "Sewing / Stitching Lines (Tees & Track Pants)",
    "Pressing & Ironing (Steam Press)",
    "Printing & Sublimation",
    "Finished Goods Warehouse & Dispatch",
    "Effluent Treatment Plant",
    "Maintenance Workshop",
    "Electrical Substation",
    "Compressed Air & Vacuum Station",
    "Confined Space Zones (Dye Vessels, ETP Tanks)",
    "Checking & Finishing (AQL Quality)",
    "Canteen & Welfare Block"
  ],
  APX: [
    "Yarn & Fabric Store",
    "Knitting Section — Single Jersey & Rib",
    "Knitting Section — Interlock & Fleece",
    "Dye House — Soft-Flow Dyeing",
    "Dye House — Stenter & Compacting",
    "Fabric Inspection & QC Bay",
    "Greige Fabric & Yarn Raw Material Store",
    "Finished Fabric Warehouse",
    "Boiler House & Steam Lines",
    "Cooling Tower",
    "Electrical Substation",
    "Maintenance Workshop",
    "Chemical & Dye Store",
    "Confined Space Zones (Dye Vessels, Tanks, Sumps)",
    "Canteen & Welfare Block"
  ],
  CCS: [
    "Yarn & Fabric Store",
    "Cutting Section — Spreading & CAD",
    "Cutting Section — Band Knife & Fusing",
    "Sewing / Stitching Lines — Block A",
    "Sewing / Stitching Lines — Block B",
    "Checking & Finishing (AQL Quality)",
    "Printing & Embroidery",
    "Electrical Substation",
    "Compressed Air Station",
    "Effluent Treatment Plant",
    "Maintenance Workshop",
    "Pressing & Ironing (Steam Press)",
    "Confined Space Zones (Dye Vessels, ETP Tanks)",
    "Finished Goods Warehouse & Dispatch",
    "Canteen & Welfare Block"
  ],
  ISL: [
    "Yarn & Fabric Store",
    "Knitting Section — Sock Knitting Machines",
    "Dye House — Sock Dyeing & Processing",
    "Toe-Closing & Linking Section",
    "Boarding & Pressing Section",
    "Combed Cotton Yarn & Elastane Store",
    "Sewing / Stitching Lines (Sock Finishing)",
    "Electrical Substation",
    "Steam & Condensate System",
    "Cooling Tower & Water Treatment",
    "Maintenance Workshop",
    "Sock Testing Laboratory",
    "Confined Space Zones (Dye Vessels, Tanks, Pits)",
    "Checking & Finishing (AQL Quality)",
    "Canteen & Welfare Block"
  ],
  PFI: [
    "Yarn & Fabric Store",
    "Cutting Section — Spreading & Blending",
    "Sewing / Stitching Lines (Apparel)",
    "Pressing & Ironing (Steam Press)",
    "Checking & Finishing (AQL Quality)",
    "Chemical & Dye Store",
    "Effluent Treatment Plant",
    "Boiler House & Steam Utilities",
    "Printing & Embroidery",
    "Dye House — Garment Dyeing",
    "QC & Fabric Testing Lab",
    "Engineering Workshop",
    "Electrical Substation",
    "Confined Space Zones (Dye Vessels, ETP Tanks)",
    "Canteen & Welfare Block"
  ],
  PMB: [
    "Yarn & Fabric Store",
    "Knitting Section — Circular Knitting",
    "Knitting Section — Flat Knitting",
    "Dye House — Dyeing & Processing",
    "Sewing / Stitching Lines (Knits) — Line 1",
    "Sewing / Stitching Lines (Knits) — Line 2",
    "Boiler House & Steam Utilities",
    "Cutting Section — Spreading & Band Knife",
    "Effluent Treatment Plant",
    "Chemical & Dye Store",
    "Maintenance Workshop",
    "Electrical Substation",
    "Confined Space Zones (Dye Vessels, ETP Tanks, Pits)",
    "Checking & Finishing (AQL Quality)",
    "Canteen & Welfare Block"
  ],
  VGP: [
    "Greige Fabric & Yarn Store",
    "Cutting Section — Spreading & CAD",
    "Sewing / Stitching Lines — Swim Trunks & Jammers",
    "Sewing / Stitching Lines — Swimsuits",
    "Heat-Seal & Bonding Section",
    "Printing & Sublimation",
    "Checking & Finishing (AQL Quality)",
    "Pressing & Ironing (Steam Press)",
    "Trims & Accessories Store",
    "Maintenance Workshop",
    "Effluent Treatment Plant",
    "Electrical Substation",
    "Confined Space Zones (Dye Vessels, ETP Tanks, Pits)",
    "Finished Goods Warehouse & Dispatch",
    "Canteen & Welfare Block"
  ],
  AGB: [
    "Yarn & Fabric Store",
    "Knitting Section (Women's Innerwear Fabrics)",
    "Dye House — Dyeing & Processing",
    "Cutting Section — Spreading & Band Knife",
    "Sewing / Stitching Lines (Panties & Camisoles)",
    "Bra Moulding & Cup Forming Section",
    "Effluent Treatment Plant",
    "Boiler House & Utilities",
    "Electrical Substation & Control Room",
    "Cooling Tower",
    "Maintenance Workshop",
    "Chemical & Dye Store",
    "Confined Space Zones (Dye Vessels, ETP Tanks, Pits)",
    "Checking & Finishing (AQL Quality)",
    "Canteen & Welfare Block"
  ],
  ACS: [
    "Greige Fabric & Yarn Store",
    "Cutting Section — Spreading & Band Knife",
    "Sewing / Stitching Lines (Loungewear)",
    "Pressing & Ironing (Steam Press)",
    "Checking & Finishing (AQL Quality)",
    "Printing & Embroidery",
    "Quality Inspection Bay",
    "Trims & Packaging Store",
    "Finished Goods Dispatch & Distribution Yard",
    "Boiler House & Compressed Air Station",
    "Electrical Substation",
    "Maintenance Workshop",
    "Chemical & Dye Store",
    "Confined Space Zones (Dye Vessels, ETP Tanks)",
    "Canteen & Welfare Block"
  ]
};

// ─── Supporting roles per industry plant ────────────────────────────────────

const SUPPORT_ROLES = [
  { emailKey: "plant-head",     role: "PLANT_HEAD",  designation: "Plant Head",     dept: "Management" },
  { emailKey: "safety-officer", role: "HSE_MANAGER", designation: "Safety Officer", dept: "HSE" },
  { emailKey: "supervisor",     role: "WORKER",      designation: "Shift Supervisor", dept: "Operations" },
  { emailKey: "permit-issuer",  role: "WORKER",      designation: "Permit Issuer",  dept: "HSE" },
  { emailKey: "worker",         role: "WORKER",      designation: "Process Operator", dept: "Operations" },
];

// ─── Manhours config per industry ───────────────────────────────────────────
// targetHours = trailing 12M total | ltiCount = how many LTIs in that window

type IndustryMetrics = {
  monthlyEmpHours: number;
  monthlyContrHours: number;
  ltiCount: number;
  ltiMonths: number[];  // which months (1-12 of trailing window) have an LTI
  daysLastLTI: number;
};

const INDUSTRY_METRICS: Record<string, IndustryMetrics> = {
  AXM: { monthlyEmpHours: 98000,  monthlyContrHours: 18000, ltiCount: 2, ltiMonths: [4, 11],  daysLastLTI: 21 },
  MCP: { monthlyEmpHours: 62000,  monthlyContrHours: 12000, ltiCount: 1, ltiMonths: [9],      daysLastLTI: 45 },
  APX: { monthlyEmpHours: 128000, monthlyContrHours: 22000, ltiCount: 3, ltiMonths: [3, 7, 11], daysLastLTI: 18 },
  CCS: { monthlyEmpHours: 148000, monthlyContrHours: 26000, ltiCount: 4, ltiMonths: [2, 5, 8, 11], daysLastLTI: 12 },
  ISL: { monthlyEmpHours: 168000, monthlyContrHours: 32000, ltiCount: 5, ltiMonths: [1, 3, 6, 9, 11], daysLastLTI: 9 },
  PFI: { monthlyEmpHours: 110000, monthlyContrHours: 20000, ltiCount: 2, ltiMonths: [5, 10], daysLastLTI: 33 },
  PMB: { monthlyEmpHours: 138000, monthlyContrHours: 24000, ltiCount: 3, ltiMonths: [4, 7, 10], daysLastLTI: 27 },
  VGP: { monthlyEmpHours: 90000,  monthlyContrHours: 16000, ltiCount: 2, ltiMonths: [6, 10], daysLastLTI: 16 },
  AGB: { monthlyEmpHours: 118000, monthlyContrHours: 20000, ltiCount: 3, ltiMonths: [3, 7, 11], daysLastLTI: 22 },
  ACS: { monthlyEmpHours: 154000, monthlyContrHours: 28000, ltiCount: 4, ltiMonths: [2, 5, 8, 11], daysLastLTI: 19 },
};

// ─── Incident templates (industry-specific) ──────────────────────────────────

const INCIDENT_TEMPLATES: Record<string, { location: string; description: string; injury: string; bodyPart: string; cause: string }[]> = {
  AXM: [
    { location: "Dye House — Soft-Flow Machine D-3", description: "Operator sustained chemical splash to forearm from a reactive-dye dosing valve failure while charging the soft-flow dyeing machine.", injury: "Chemical burn — Grade 1", bodyPart: "Left forearm", cause: "Dosing valve not positively isolated prior to charging; splash guard not deployed." },
    { location: "Chemical & Dye Store", description: "Worker fractured wrist tripping over an unlabelled dye-chemical drum moved into the walkway overnight.", injury: "Fracture", bodyPart: "Right wrist", cause: "Housekeeping non-compliance; drum repositioned without barricading walkway." },
  ],
  MCP: [
    { location: "Pressing & Ironing — Steam Press Station 4", description: "Technician sprained ankle stepping off the steam-press platform without using three-point contact.", injury: "Sprain", bodyPart: "Left ankle", cause: "Platform edge not marked; three-point contact procedure not followed." },
  ],
  APX: [
    { location: "Knitting Section — Single Jersey Machine 7", description: "Operator caught glove in the circular-knitting machine yarn-feed drive during a needle change; soft-tissue injury to fingers.", injury: "Soft-tissue contusion", bodyPart: "Right-hand fingers", cause: "Operator reached into the feed zone with the machine in slow-jog mode; guard interlock bypassed." },
    { location: "Dye House — Stenter & Compacting", description: "Maintenance fitter suffered lower back strain lifting a heavy stenter chain-rail section without mechanical aid.", injury: "Musculoskeletal strain", bodyPart: "Lower back", cause: "Mechanical lifting aid not requested; manual handling risk not assessed for the task." },
    { location: "Chemical & Dye Store", description: "Store operator slipped on a softener-solution spill on a smooth concrete floor.", injury: "Laceration", bodyPart: "Left knee", cause: "Spill not barricaded; non-slip footwear not available in store area." },
  ],
  CCS: [
    { location: "Pressing & Ironing (Steam Press)", description: "Fitter sustained burns to forearm from steam blowback while clearing a blockage at a vacuum ironing table.", injury: "Thermal burn — Grade 1", bodyPart: "Right forearm", cause: "Steam supply not isolated before access; hot surface present; PPE inadequate." },
    { location: "Cutting Section — Band Knife & Fusing", description: "Operator lacerated finger on the band-knife blade while clearing a jammed fabric lay.", injury: "Laceration", bodyPart: "Right middle finger", cause: "Band-knife guard gap exceeded tolerance; pre-start safety check not completed." },
    { location: "Sewing / Stitching Lines — Block B", description: "Worker sprained ankle from a misstep on a frayed anti-fatigue mat at the stitching-line walkway.", injury: "Sprain", bodyPart: "Right ankle", cause: "Worn mat not flagged in last inspection; line lighting inadequate." },
    { location: "Checking & Finishing (AQL Quality)", description: "Checker sustained eye injury from airborne lint ingress during a finished-lot inspection.", injury: "Eye irritation — Grade 2", bodyPart: "Both eyes", cause: "Safety glasses removed due to fogging; goggles not available at the bay." },
  ],
  ISL: [
    { location: "Knitting Section — Sock Knitting Machine 12", description: "Machine operator sustained laceration to forearm from a needle-cylinder edge while clearing a knitting fault.", injury: "Laceration", bodyPart: "Right forearm", cause: "Cylinder guard missing; operator's arm entered the hazard zone." },
    { location: "Dye House — Sock Dyeing & Processing", description: "Dye-house operator suffered heat stress and collapsed beside the dyeing machine during the summer peak.", injury: "Heat stress — moderate", bodyPart: "Systemic", cause: "Buddy system not followed; rest shelter not used; hydration schedule overdue." },
    { location: "Combed Cotton Yarn & Elastane Store", description: "Forklift operator fractured ankle jumping from the cab during an emergency stop — cab too high without steps.", injury: "Fracture", bodyPart: "Right ankle", cause: "Cab exit ladder detached; no temporary steps provided; emergency evacuation not practised." },
    { location: "Boarding & Pressing Section", description: "Boarding operator sustained a steam burn to the left eye area from hot-form board spray rebound without a face shield.", injury: "Eye injury — abrasion", bodyPart: "Left eye", cause: "Face shield not worn near the boarding steam form; no supervisor present during operation." },
    { location: "Checking & Finishing (AQL Quality)", description: "Maintenance fitter fell from a mezzanine access ladder at the finishing bay — missing rung not tagged.", injury: "Musculoskeletal sprain", bodyPart: "Lower back and hip", cause: "Ladder not inspected before use; missing rung not reported by previous user." },
  ],
  PFI: [
    { location: "Pressing & Ironing (Steam Press)", description: "Line operator sustained scald to right hand from a steam leak at the vacuum ironing-table supply manifold.", injury: "Scald — Grade 1", bodyPart: "Right hand", cause: "Steam trap overdue service; condensate backup caused manifold blow-out; no steam gloves available at station." },
    { location: "Chemical & Dye Store", description: "Store worker slipped on a spilled garment-dye dispersion near the dosing-tank threshold.", injury: "Laceration", bodyPart: "Left elbow", cause: "Tank coupling seal worn; spill not cleared on daily inspection round." },
  ],
  PMB: [
    { location: "Boiler House & Steam Utilities", description: "Boiler operator sustained a steam burn to the left arm from a condensate-line flexible coupling failure.", injury: "Scald — Grade 2", bodyPart: "Left forearm", cause: "Flexible coupling not included in routine inspection scope; rated life exceeded." },
    { location: "Dye House — Dyeing & Processing", description: "Process operator sustained a dye-chemical splash to the face when a soft-flow machine pressure relief valve discharged unexpectedly.", injury: "Chemical splash — eye and face", bodyPart: "Face and eyes", cause: "PRV not in inspection schedule; face shield not worn during valve-area patrol." },
    { location: "Sewing / Stitching Lines (Knits) — Line 1", description: "Sewing operator's finger caught under the single-needle lockstitch presser foot during threading.", injury: "Crush injury", bodyPart: "Right hand", cause: "Machine not de-energised during threading; needle-guard procedure not followed." },
  ],
  VGP: [
    { location: "Cutting Section — Spreading & CAD", description: "Cutting-room operator sustained a hand injury at the spreader carriage nip point during emergency clearing of a fabric-roll jam.", injury: "Soft-tissue crush", bodyPart: "Right hand", cause: "Spreader not isolated before clearing blockage; isolation point not marked." },
    { location: "Heat-Seal & Bonding Section", description: "Maintenance technician slipped on a bonding-adhesive film from a heat-seal press drip overflow.", injury: "Sprain", bodyPart: "Left knee", cause: "Drip overflow not contained; housekeeping inspection overdue by 4 hours." },
  ],
  AGB: [
    { location: "Chemical & Dye Store", description: "Instrument technician sustained dye-chemical mist inhalation while replacing a flange gasket on the bulk softener header — detected late.", injury: "Chemical mist inhalation — moderate", bodyPart: "Respiratory system", cause: "Work package did not specify fume monitoring; area exhaust ventilation inadequate." },
    { location: "Dye House — Dyeing & Processing", description: "Operator sustained an acid-fixer splash to the legs from leaking pump gland packing on the dye-dosing line.", injury: "Chemical burn — Grade 1", bodyPart: "Both legs (lower)", cause: "Pump gland packing overdue replacement; chemical-resistant PPE leg coverage inadequate." },
    { location: "Bra Moulding & Cup Forming Section", description: "Fitter fell from a portable ladder while tightening flange bolts on the cup-moulding press steam line at an elevated position.", injury: "Fracture", bodyPart: "Right wrist", cause: "Portable ladder not footed; work at height permit not taken for this task." },
  ],
  ACS: [
    { location: "Cutting Section — Spreading & Band Knife", description: "Cutting operator sustained a crush injury to the left-hand finger when a setter entered the band-knife working zone during a lay changeover.", injury: "Crush — fracture", bodyPart: "Left index finger", cause: "Band-knife LOTO not completed; cutting control accessible during setting operation." },
    { location: "Printing & Embroidery", description: "Printing operator developed solvent-induced respiratory sensitisation after repeated screen-wash exposures.", injury: "Occupational lung disease", bodyPart: "Respiratory system", cause: "Supplied air respirator not worn; line exhaust ventilation filter overdue replacement." },
    { location: "Sewing / Stitching Lines (Loungewear)", description: "Sewing worker slipped on a lubricant leak beside an overlock machine station.", injury: "Sprain", bodyPart: "Right ankle", cause: "Machine micro-leak not detected on start-of-shift inspection; drip tray absent." },
    { location: "Checking & Finishing (AQL Quality)", description: "Operator sustained a laceration to the hand from an unguarded thread-trimmer blade while clearing a tangled lot.", injury: "Laceration", bodyPart: "Left hand", cause: "Trimmer guard not deployed; adjacent workers not notified before clearing the jam." },
  ],
};

// Active permit templates per industry
const PERMIT_TEMPLATES: Record<string, [{ type: "HOT_WORK" | "CONFINED_SPACE"; location: string; scope: string }, { type: "HOT_WORK" | "CONFINED_SPACE"; location: string; scope: string }]> = {
  AXM: [
    { type: "HOT_WORK",       location: "Dye House — Steam Header Flange D-07",   scope: "SMAW repair to dye-house steam header flange D-07. Line drained, isolated and gas-tested < 5% LEL. Hot work screens deployed; fabric and lint cleared within 5 m." },
    { type: "CONFINED_SPACE", location: "Dye House — Soft-Flow Dyeing Vessel V-12", scope: "Internal inspection for scale survey. Vessel emptied, washed, ventilated. O₂: 20.9%, LEL: 0%, H₂S: 0 ppm." }
  ],
  MCP: [
    { type: "HOT_WORK",       location: "Boiler House & Utilities — Steam Header Modification", scope: "Welding stainless steam header joint in the utility corridor. Sewing-line steam supply isolated. Gas test < 2% LEL." },
    { type: "CONFINED_SPACE", location: "Effluent Treatment — Equalization Tank",    scope: "Manhole entry for sludge clearance. Forced ventilation, CGI clear, life-line deployed." }
  ],
  APX: [
    { type: "HOT_WORK",       location: "Dye House — Stenter Steam Header Joint",   scope: "Welding repair to stenter steam header flanged joint. Area cleared of fabric and lint within 5 m." },
    { type: "CONFINED_SPACE", location: "Dye House — Soft-Flow Dye Vessel C-3",     scope: "Internal inspection for build-up assessment. Vessel drained, ventilated, O₂: 20.8%, CO: 0 ppm." }
  ],
  CCS: [
    { type: "HOT_WORK",       location: "Cutting Section — Band-Knife Frame Repair", scope: "Arc gouging and welding repair on the band-knife cutting-table frame. Fabric cleared, lint dust suppressed. Gas test clear." },
    { type: "CONFINED_SPACE", location: "Effluent Treatment — Collection Pit",       scope: "ETP collection pit entry for sludge clearance. Pit drained, ventilated. CGI monitor in use." }
  ],
  ISL: [
    { type: "HOT_WORK",       location: "Boarding & Pressing — Steam Manifold Bracket", scope: "Cutting and welding on a boarding steam-manifold support bracket. Steam isolated 6 hr prior; area cooled." },
    { type: "CONFINED_SPACE", location: "Dye House — Sock Dyeing Vessel D-2",         scope: "Dye vessel entry for nozzle replacement. Vessel drained, ventilated. O₂ 20.9%, CO < 5 ppm." }
  ],
  PFI: [
    { type: "HOT_WORK",       location: "Boiler House & Steam Utilities — Steam Line Modification", scope: "Welding new steam branch on 4\" header. Line drained, isolated. Gas test clear." },
    { type: "CONFINED_SPACE", location: "Effluent Treatment — Primary Tank",           scope: "Entry for desludging. Tank purged with fresh air, CGI clear, attendant stationed." }
  ],
  PMB: [
    { type: "HOT_WORK",       location: "Boiler House — Steam Tube Panel Repair",     scope: "GTAW repair to boiler steam tube panel. Boiler offline, tubes purged. Gas test clear." },
    { type: "CONFINED_SPACE", location: "Dye House — Dyeing Vessel D-2",               scope: "Internal inspection of dye-vessel lining. Vessel depressurised, purged. O₂ 20.9%, H₂S 0 ppm." }
  ],
  VGP: [
    { type: "HOT_WORK",       location: "Heat-Seal & Bonding — Press Frame Modification", scope: "Welding a new reinforcement on the heat-seal press frame. Press isolated, drained, gas test clear." },
    { type: "CONFINED_SPACE", location: "Effluent Treatment — Equalization Tank T-2",     scope: "ETP tank internal inspection. Tank drained, ventilated. O₂ 20.9%, CGI monitor in use." }
  ],
  AGB: [
    { type: "HOT_WORK",       location: "Boiler House & Utilities — Steam Manifold Flange",  scope: "Welding repair to steam-manifold flange. Line drained and purged. VOC < 5 ppm, LEL 0%." },
    { type: "CONFINED_SPACE", location: "Dye House — Dyeing Vessel A-3",                       scope: "Internal scale inspection. Vessel depressurised, washed, purged. O₂ 20.8%, LEL 0%." }
  ],
  ACS: [
    { type: "HOT_WORK",       location: "Cutting Section — Band-Knife Frame Routing",   scope: "Welding a guard bracket on the band-knife cutting frame. Cutting table isolated, residual fabric cleared." },
    { type: "CONFINED_SPACE", location: "Effluent Treatment — Collection Tank",          scope: "ETP collection tank entry for dosing-system maintenance. Tank ventilated, CGI clear, O₂ 20.9%." }
  ],
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🏭  Industry tenant seed — 10 verticals");
  console.log(`   Tenants: ${DEMO_INDUSTRIES.map(i => i.plantCode).join(", ")}`);

  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const ind of DEMO_INDUSTRIES) {
    console.log(`\n  ▶  ${ind.vertical} — ${ind.company} (${ind.plantCode})`);

    // ── Plant ────────────────────────────────────────────────────────────────
    const areas = INDUSTRY_AREAS[ind.plantCode];
    const existing = await prisma.plant.findUnique({ where: { code: ind.plantCode }, include: { areas: true } });

    type PlantWithAreas = NonNullable<typeof existing>;
    let plant: PlantWithAreas;
    if (existing) {
      // Update plant fields; re-sync areas
      plant = await prisma.plant.update({
        where: { code: ind.plantCode },
        data: { name: ind.plantName, location: ind.location, state: ind.state, unitType: ind.vertical },
        include: { areas: true }
      });
      // Delete old areas and recreate to stay in sync
      await prisma.area.deleteMany({ where: { plantId: plant.id } });
      await prisma.area.createMany({ data: areas.map(name => ({ name, plantId: plant.id })) });
      plant = (await prisma.plant.findUnique({ where: { id: plant.id }, include: { areas: true } })) as PlantWithAreas;
    } else {
      plant = await prisma.plant.create({
        data: {
          code: ind.plantCode,
          name: ind.plantName,
          location: ind.location,
          state: ind.state,
          unitType: ind.vertical,
          areas: { create: areas.map(name => ({ name })) }
        },
        include: { areas: true }
      });
    }
    console.log(`     ✓ Plant ${ind.plantCode}: ${plant.areas.length} areas`);

    // ── Primary persona ───────────────────────────────────────────────────────
    const persona = await prisma.user.upsert({
      where: { email: ind.persona.email },
      update: { name: ind.persona.name, role: "HSE_MANAGER", designation: ind.persona.designation, department: "HSE", plantId: plant.id },
      create: { email: ind.persona.email, name: ind.persona.name, passwordHash: password, role: "HSE_MANAGER", designation: ind.persona.designation, department: "HSE", plantId: plant.id }
    });

    // ── Supporting users ─────────────────────────────────────────────────────
    for (const sr of SUPPORT_ROLES) {
      const email = `${sr.emailKey}.${ind.plantCode.toLowerCase()}@safeops360.in`;
      await prisma.user.upsert({
        where: { email },
        update: { role: sr.role, designation: sr.designation, department: sr.dept, plantId: plant.id },
        create: { email, name: `${sr.designation} (${ind.plantCode})`, passwordHash: password, role: sr.role, designation: sr.designation, department: sr.dept, plantId: plant.id }
      });
    }
    console.log(`     ✓ Users: 1 primary persona + ${SUPPORT_ROLES.length} supporting`);

    // ── Manhours — 17 months (Jan 2025 – May 2026) ───────────────────────────
    const m = INDUSTRY_METRICS[ind.plantCode];
    const months17: { year: number; month: number }[] = [
      {year:2025,month:1},{year:2025,month:2},{year:2025,month:3},{year:2025,month:4},{year:2025,month:5},
      {year:2025,month:6},{year:2025,month:7},{year:2025,month:8},{year:2025,month:9},{year:2025,month:10},
      {year:2025,month:11},{year:2025,month:12},
      {year:2026,month:1},{year:2026,month:2},{year:2026,month:3},{year:2026,month:4},{year:2026,month:5},
    ];

    // Trailing 12M index: Jun 2025 (index 5) to May 2026 (index 16) = positions 5..16
    // ltiMonths are 1-based within the trailing 12 window → map to month indices
    const trailing12 = months17.filter(mm => (mm.year === 2025 && mm.month >= 6) || (mm.year === 2026 && mm.month <= 5));

    // Distribute LTIs across the trailing 12 months
    const ltiDistribution: Record<string, number> = {};
    m.ltiMonths.forEach((pos, i) => {
      const tgt = trailing12[pos - 1]; // 1-based
      if (tgt) {
        const key = `${tgt.year}-${tgt.month}`;
        ltiDistribution[key] = (ltiDistribution[key] ?? 0) + 1;
      }
    });

    for (const mm of months17) {
      const eH = mm.month === 2 ? Math.round(m.monthlyEmpHours * 0.9) : m.monthlyEmpHours;
      const cH = mm.month === 2 ? Math.round(m.monthlyContrHours * 0.9) : m.monthlyContrHours;
      const total = eH + cH;
      const ltiC = ltiDistribution[`${mm.year}-${mm.month}`] ?? 0;
      const ltifr = total > 0 ? (ltiC * 200000) / total : 0;
      const rwcC = ltiC > 0 ? 0 : Math.floor(Math.random() * 0); // keep clean
      const mtcC = Math.floor(mm.month % 3 === 0 ? 2 : 1);
      await prisma.manhours.upsert({
        where: { plantId_year_month: { plantId: plant.id, year: mm.year, month: mm.month } },
        create: { plantId: plant.id, year: mm.year, month: mm.month, employeeHours: eH, contractorHours: cH, ltiCount: ltiC, rwcCount: rwcC, mtcCount: mtcC, facCount: 0, lostDays: ltiC * 5, ltifr: parseFloat(ltifr.toFixed(4)), trir: parseFloat(ltifr.toFixed(4)), severityRate: 0, locked: mm.year < 2026 || mm.month < 5 },
        update: { employeeHours: eH, contractorHours: cH, ltiCount: ltiC, rwcCount: rwcC, mtcCount: mtcC, lostDays: ltiC * 5, ltifr: parseFloat(ltifr.toFixed(4)), trir: parseFloat(ltifr.toFixed(4)), locked: mm.year < 2026 || mm.month < 5 }
      });
    }
    console.log(`     ✓ Manhours: 17 months seeded`);

    // ── LTI Incidents ─────────────────────────────────────────────────────────
    const templates = INCIDENT_TEMPLATES[ind.plantCode] ?? INCIDENT_TEMPLATES["AXM"];
    const lastLTIDate = new Date(DEMO_TODAY.getTime() - m.daysLastLTI * 86400000);

    // Delete previous incidents for this plant (by pattern)
    const existingNums = (await prisma.incident.findMany({ where: { plantId: plant.id, type: "LTI" }, select: { number: true } })).map(i => i.number);
    if (existingNums.length > 0) await prisma.incident.deleteMany({ where: { number: { in: existingNums } } });

    // Create incidents — last one is the daysLastLTI one (INVESTIGATION), earlier ones CLOSED
    for (let i = 0; i < Math.min(templates.length, m.ltiCount); i++) {
      const tmpl = templates[i];
      const isLast = i === templates.length - 1;
      const incDate = isLast ? lastLTIDate : new Date(lastLTIDate.getTime() - (i + 1) * 60 * 86400000);
      const incNum = `INC-${ind.plantCode}-${String(i + 1).padStart(3, "0")}`;
      const area = plant.areas.find(a => tmpl.location.toLowerCase().includes(a.name.toLowerCase().split(" ")[0])) ?? plant.areas[0];
      await prisma.incident.create({
        data: {
          number: incNum,
          date: incDate,
          occurredAt: incDate,
          reportedAt: new Date(incDate.getTime() + 30 * 60 * 1000),
          type: "LTI",
          plantId: plant.id,
          areaId: area?.id ?? null,
          location: tmpl.location,
          reporterId: persona.id,
          description: tmpl.description,
          injuredPersonName: `Operator ${ind.plantCode}-${String(i + 1).padStart(2, "0")}`,
          injuredPersonDesignation: "Plant Operator",
          bodyPart: tmpl.bodyPart,
          natureOfInjury: tmpl.injury,
          lostDays: isLast ? 3 : 5 + i * 2,
          immediateCause: tmpl.cause,
          correctiveActions: isLast ? "Investigation ongoing. Interim controls implemented." : "Root cause analysis completed. Corrective actions closed.",
          status: isLast ? "INVESTIGATION" : "CLOSED",
          closedAt: isLast ? null : new Date(incDate.getTime() + 30 * 24 * 60 * 60 * 1000)
        }
      });
    }
    console.log(`     ✓ Incidents: ${Math.min(templates.length, m.ltiCount)} LTIs, last = ${m.daysLastLTI} days ago`);

    // ── Active Permits ────────────────────────────────────────────────────────
    const ptmpl = PERMIT_TEMPLATES[ind.plantCode];
    const existingPermitNums = (await prisma.permit.findMany({ where: { plantId: plant.id, status: "ACTIVE" }, select: { number: true } })).map(p => p.number);
    if (existingPermitNums.length > 0) await prisma.permit.deleteMany({ where: { number: { in: existingPermitNums } } });

    for (let i = 0; i < ptmpl.length; i++) {
      const pt = ptmpl[i];
      const validFrom = new Date(DEMO_TODAY.getTime() - (3 + i * 2) * 60 * 60 * 1000);
      const validTo   = new Date(DEMO_TODAY.getTime() + (6 + i * 2) * 60 * 60 * 1000);
      const area = plant.areas[0];
      const pNum = `PTW-${ind.plantCode}-2026-${String(841 + i).padStart(4, "0")}`;
      await prisma.permit.create({
        data: {
          number: pNum,
          type: pt.type,
          plantId: plant.id,
          areaId: area.id,
          location: pt.location,
          scopeOfWork: pt.scope,
          validFrom,
          validTo,
          originatorId: persona.id,
          issuerId: persona.id,
          receiverId: persona.id,
          status: "ACTIVE",
          issuerApprovedAt: new Date(validFrom.getTime() - 15 * 60 * 1000),
          safetyApprovedAt: new Date(validFrom.getTime() - 10 * 60 * 1000),
          gasTestRequired: pt.type === "CONFINED_SPACE",
          gasTestResult: pt.type === "CONFINED_SPACE" ? "PASS" : null,
          o2Level: pt.type === "CONFINED_SPACE" ? "20.9" : null,
          lelLevel: pt.type === "CONFINED_SPACE" ? "0" : null,
          h2sLevel: pt.type === "CONFINED_SPACE" ? "0" : null,
          fireWatchRequired: pt.type === "HOT_WORK"
        }
      });
    }
    console.log(`     ✓ Permits: 2 active (HOT_WORK + CONFINED_SPACE)`);
  }

  const totalPlants = await prisma.plant.count();
  const totalUsers  = await prisma.user.count();
  console.log(`\n✅  Industry tenant seed complete.`);
  console.log(`   Total plants now: ${totalPlants} | Total users: ${totalUsers}`);
  console.log(`   Industry logins: {firstname}.{lastname}@safeops360.in / demo123`);
}

main()
  .catch(e => { console.error("❌  Industry tenant seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
