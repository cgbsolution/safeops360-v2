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
    "Wood Yard & Chip Handling",
    "Digester House — Continuous Cooking",
    "Brown Stock Washing & Screening",
    "Bleaching Plant (ClO₂ / Peroxide Stages)",
    "Pulp Drying & Baling Machine",
    "Chemical Recovery & Recovery Boiler",
    "Causticizing & Lime Kiln",
    "Power & Steam Plant (Boiler House)",
    "Effluent Treatment Plant",
    "Black Liquor & Chemical Storage",
    "QC & Pulp Testing Laboratory",
    "Maintenance Workshop",
    "Confined Space Zones (Digesters, Tanks, Pits)",
    "Elevated Structures (Recovery Boiler, Chimney Stack)",
    "Electrical Substation"
  ],
  MCP: [
    "Recycled Fibre & Stock Preparation",
    "Approach Flow & Headbox Area",
    "Tissue Machine TM-1 (Yankee & Hood)",
    "Tissue Machine TM-2 (Yankee & Hood)",
    "Converting Hall — Rewinding & Folding",
    "Steam & Condensate Utilities",
    "Chemical Dosing & Storage",
    "Reel & Jumbo Roll Warehouse",
    "Effluent Treatment Plant",
    "Engineering & Maintenance Workshop",
    "Electrical Substation",
    "Compressed Air & Vacuum Station",
    "Confined Space Zones (Chests, Tanks, Saveall Pits)",
    "Broke & Reject Handling Area",
    "Canteen & Welfare Block"
  ],
  APX: [
    "Stock Preparation & Pulping",
    "Board Machine — Wet End & Press Section",
    "Board Machine — Dryer & Size Press",
    "Coating & Calendering Section",
    "Cutting, Sheeting & Ream Wrapping",
    "Board Testing & QC Bay",
    "Pulp & Fibre Raw Material Store",
    "Finished Board Warehouse",
    "Boiler House & Steam Lines",
    "Cooling Tower",
    "Electrical Substation",
    "Maintenance Workshop",
    "Coating Chemicals & Starch Store",
    "Confined Space Zones (Chests, Tanks, Sumps)",
    "Canteen & Welfare Block"
  ],
  CCS: [
    "Stock Preparation & Refining",
    "Approach Flow / Headbox",
    "Kraft Paper Machine — Wire & Press",
    "Kraft Paper Machine — Dryer Section",
    "Reeling & Rewinding Section",
    "Reel & Roll Dispatch Area",
    "Recycled Fibre & OCC Handling",
    "Electrical Substation",
    "Compressed Air Station",
    "Effluent Treatment Plant",
    "Maintenance Workshop",
    "Elevated Structures (Dryer Hood, Stack, Conveyors)",
    "Confined Space Zones (Chests, Tanks, Saveall Pits)",
    "Broke & Reject Handling Area",
    "Canteen & Welfare Block"
  ],
  ISL: [
    "Stock Preparation & De-inking",
    "Approach Flow & Headbox",
    "Newsprint Machine — Forming & Press",
    "Newsprint Machine — Dryer Section",
    "Calendering & Reeling Section",
    "Recycled Fibre & ONP/OMG Store",
    "Pulper & Slushing Area",
    "Electrical Substation (132 kV)",
    "Steam & Condensate System",
    "Cooling Tower & Water Treatment",
    "Maintenance Workshop",
    "Pulp & Paper Testing Laboratory",
    "Confined Space Zones (Chests, Tanks, Pits)",
    "Elevated Structures (Dryer Hood, Reel, Cranes)",
    "Canteen & Welfare Block"
  ],
  PFI: [
    "Receiving & Pulp Preparation Hall",
    "Stock Preparation — Refining & Blending",
    "Coating Machine — Base Paper Feed",
    "Coating & Drying Section",
    "Supercalender & Glazing Area",
    "Coating Chemicals & Pigment Store",
    "Effluent Treatment Plant",
    "Boiler & Steam Utilities",
    "Sheeting & Reel Finishing Line",
    "Coating Kitchen & Dispersion Station",
    "QC & Paper Testing Lab",
    "Engineering Workshop",
    "Electrical Substation",
    "Confined Space Zones (Chests, Tanks, Pits)",
    "Canteen & Welfare Block"
  ],
  PMB: [
    "Wood Yard & Chip Handling",
    "Pulp Mill — Chemical Recovery Section",
    "Digester House",
    "Bleaching Plant",
    "Paper Machine PM-1",
    "Paper Machine PM-2",
    "Recovery Boiler",
    "Power & Steam Plant",
    "Effluent Treatment Plant",
    "Black Liquor & Chemical Storage",
    "Maintenance Workshop",
    "Electrical Substation",
    "Confined Space Zones (Digesters, Tanks, Chest Pits)",
    "Elevated Structures (Recovery Boiler, Chimney Stack)",
    "Canteen & Welfare Block"
  ],
  VGP: [
    "Waste Paper Yard & Bale Storage",
    "Pulper & Slushing Area",
    "Coarse & Fine Screening Plant",
    "De-inking & Flotation Cells",
    "Cleaning & Thickening Section",
    "Disc Filter & Sludge Dewatering",
    "Stock Preparation & Refining",
    "Recycled Pulp Drying Machine",
    "Reject & Broke Handling Area",
    "Maintenance Workshop",
    "Effluent Treatment Plant",
    "Electrical Substation",
    "Confined Space Zones (Pulper, Chests, Tanks, Pits)",
    "Elevated Structures (Towers, Conveyors, Cyclones)",
    "Canteen & Welfare Block"
  ],
  AGB: [
    "AKD / Rosin Sizing Reactor Unit",
    "Starch Cooking & Cationisation Unit",
    "Alum & Coagulant Blending Plant",
    "Coating Binder & Latex Plant",
    "Bagging & Dispatch Area",
    "Bulk Caustic & Acid Storage",
    "Effluent Treatment Plant",
    "Boiler & Utility Block",
    "Electrical Substation & Control Room",
    "Cooling Tower",
    "Maintenance Workshop",
    "Hazardous Chemical Store (NaOH, ClO₂ precursors, Alum)",
    "Confined Space Zones (Reactors, Vessels, Pits)",
    "Elevated Structures (Reactor Loop, Storage Silos)",
    "Canteen & Welfare Block"
  ],
  ACS: [
    "Reel Storage & Unwind Stand",
    "Reel-to-Sheet Cutting Section",
    "Ruling & Printing Line",
    "Notebook Binding Line A",
    "Notebook Binding Line B",
    "Exercise-Book Stitching & Trimming",
    "Quality Inspection Bay",
    "Reel & Paper Stock Warehouse",
    "Finished Goods Dispatch Yard",
    "Boiler & Compressed Air Station",
    "Electrical Substation",
    "Maintenance Workshop",
    "Glue, Ink & Solvent Store",
    "Confined Space Zones (Glue Tanks, Reel Pits)",
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
    { location: "Bleaching Plant — ClO₂ Stage", description: "Operator sustained chemical splash to forearm from chlorine dioxide sample valve failure during dip sampling at the D0 stage.", injury: "Chemical burn — Grade 1", bodyPart: "Left forearm", cause: "Sample valve not positively isolated prior to sampling; splash guard not deployed." },
    { location: "Black Liquor & Chemical Storage", description: "Worker fractured wrist tripping over unlabelled chemical drum moved into walkway overnight.", injury: "Fracture", bodyPart: "Right wrist", cause: "Housekeeping non-compliance; drum repositioned without barricading walkway." },
  ],
  MCP: [
    { location: "Tissue Machine TM-2 (Yankee & Hood)", description: "Technician sprained ankle stepping off the Yankee dryer access platform without using three-point contact.", injury: "Sprain", bodyPart: "Left ankle", cause: "Platform edge not marked; three-point contact procedure not followed." },
  ],
  APX: [
    { location: "Stock Preparation & Pulping", description: "Operator caught glove in hydrapulper agitator drive coupling during furnish loading; soft-tissue injury to fingers.", injury: "Soft-tissue contusion", bodyPart: "Right-hand fingers", cause: "Operator reached into pulper zone with agitator in slow-jog mode; guard interlock bypassed." },
    { location: "Coating & Calendering Section", description: "Maintenance fitter suffered lower back strain lifting a heavy calender roll bearing without mechanical aid.", injury: "Musculoskeletal strain", bodyPart: "Lower back", cause: "Mechanical lifting aid not requested; manual handling risk not assessed for the task." },
    { location: "Coating Chemicals & Starch Store", description: "Warehouse operator slipped on a starch slurry spill on smooth concrete floor.", injury: "Laceration", bodyPart: "Left knee", cause: "Spill not barricaded; non-slip footwear not available in store area." },
  ],
  CCS: [
    { location: "Kraft Paper Machine — Dryer Section", description: "Fitter sustained burns to forearm from steam blowback while clearing a doctor-blade blockage at a dryer cylinder.", injury: "Thermal burn — Grade 1", bodyPart: "Right forearm", cause: "Cylinder steam not isolated before access; hot surface present; PPE inadequate." },
    { location: "Stock Preparation & Refining", description: "Operator fractured finger caught in rotating disc-refiner coupling guard gap.", injury: "Fracture", bodyPart: "Right middle finger", cause: "Guard gap exceeded 25 mm tolerance; pre-start safety check not completed." },
    { location: "Elevated Structures (Dryer Hood, Stack, Conveyors)", description: "Worker sprained ankle from misstep on a corroded grating panel at the dryer-hood walkway.", injury: "Sprain", bodyPart: "Right ankle", cause: "Corroded grating not flagged in last inspection; walkway lighting inadequate." },
    { location: "Reeling & Rewinding Section", description: "Reel operator sustained eye injury from paper dust ingress during a reel changeover.", injury: "Eye irritation — Grade 2", bodyPart: "Both eyes", cause: "Safety glasses removed during reel change due to fogging; goggles not available." },
  ],
  ISL: [
    { location: "Newsprint Machine — Dryer Section", description: "Machine operator sustained laceration to forearm from a sharp sheet-edge whip during a dryer-section break.", injury: "Laceration", bodyPart: "Right forearm", cause: "Edge deflector guard missing; operator's arm entered the hazard zone." },
    { location: "Pulper & Slushing Area", description: "Pulper operator suffered heat stress and collapsed at the pulper platform during summer peak.", injury: "Heat stress — moderate", bodyPart: "Systemic", cause: "Buddy system not followed; rest shelter not used; hydration schedule overdue." },
    { location: "Recycled Fibre & ONP/OMG Store", description: "Crane operator fractured ankle jumping from cab during emergency stop — cab too high without steps.", injury: "Fracture", bodyPart: "Right ankle", cause: "Cab exit ladder detached; no temporary steps provided; emergency evacuation not practised." },
    { location: "Newsprint Machine — Forming & Press", description: "Press-section operator sustained corneal injury from high-pressure shower spray rebound without face shield.", injury: "Eye injury — abrasion", bodyPart: "Left eye", cause: "Face shield not worn near press showers; no supervisor present during operation." },
    { location: "Calendering & Reeling Section", description: "Maintenance fitter fell from a reel-stand access ladder — missing rung not tagged.", injury: "Musculoskeletal sprain", bodyPart: "Lower back and hip", cause: "Ladder not inspected before use; missing rung not reported by previous user." },
  ],
  PFI: [
    { location: "Coating & Drying Section", description: "Line operator sustained scald to right hand from a steam leak at the coating dryer feed manifold.", injury: "Scald — Grade 1", bodyPart: "Right hand", cause: "Steam trap overdue service; condensate backup caused manifold blow-out; no steam gloves available at station." },
    { location: "Coating Chemicals & Pigment Store", description: "Store worker slipped on a spilled pigment dispersion near the dosing tank threshold.", injury: "Laceration", bodyPart: "Left elbow", cause: "Tank coupling seal worn; spill not cleared on daily inspection round." },
  ],
  PMB: [
    { location: "Recovery Boiler", description: "Boiler operator sustained steam burn to left arm from condensate line flexible coupling failure.", injury: "Scald — Grade 2", bodyPart: "Left forearm", cause: "Flexible coupling not included in routine inspection scope; rated life exceeded." },
    { location: "Pulp Mill — Recovery Section", description: "Process operator sustained caustic splash to face when pressure relief valve discharged unexpectedly.", injury: "Chemical splash — eye and face", bodyPart: "Face and eyes", cause: "PRV not in inspection schedule; face shield not worn during valve-area patrol." },
    { location: "Paper Machine PM-1", description: "Paper machine assistant hand caught in felt press nip during threading operation.", injury: "Crush injury", bodyPart: "Right hand", cause: "Machine not de-energised during threading; LOTO procedure not followed." },
  ],
  VGP: [
    { location: "Pulper & Slushing Area", description: "Pulper operator sustained hand injury from the pulper conveyor nip point during emergency clearing of a wire-bundle jam.", injury: "Soft-tissue crush", bodyPart: "Right hand", cause: "Conveyor not isolated before clearing blockage; isolation point not marked." },
    { location: "Disc Filter & Sludge Dewatering", description: "Maintenance technician slipped on a fibre-sludge film from a disc-filter drain overflow.", injury: "Sprain", bodyPart: "Left knee", cause: "Drain overflow not contained; housekeeping inspection overdue by 4 hours." },
  ],
  AGB: [
    { location: "Bulk Caustic & Acid Storage", description: "Instrument technician sustained caustic mist inhalation while replacing a flange gasket on the NaOH header — detected late.", injury: "Caustic mist inhalation — moderate", bodyPart: "Respiratory system", cause: "Work package did not specify fume monitoring; area exhaust ventilation inadequate." },
    { location: "AKD / Rosin Sizing Reactor Unit", description: "Operator sustained acid splash to legs from leaking pump gland packing on the alum dosing line.", injury: "Chemical burn — Grade 1", bodyPart: "Both legs (lower)", cause: "Pump gland packing overdue replacement; acid-resistant PPE leg coverage inadequate." },
    { location: "Starch Cooking & Cationisation Unit", description: "Fitter fell from a portable ladder while tightening flange bolts on the starch cooker at elevated position.", injury: "Fracture", bodyPart: "Right wrist", cause: "Portable ladder not footed; work at height permit not taken for this task." },
  ],
  ACS: [
    { location: "Reel-to-Sheet Cutting Section", description: "Sheeter operator sustained crush injury to left-hand finger from a setter entering the knife working zone during reel changeover.", injury: "Crush — fracture", bodyPart: "Left index finger", cause: "Sheeter LOTO not completed; cutting control accessible during setting operation." },
    { location: "Ruling & Printing Line", description: "Printing operator developed solvent-induced respiratory sensitisation after repeated ink-wash exposures.", injury: "Occupational lung disease", bodyPart: "Respiratory system", cause: "Supplied air respirator not worn; line exhaust ventilation filter overdue replacement." },
    { location: "Notebook Binding Line A", description: "Binding worker slipped on a hot-melt glue leak beside the gluing station.", injury: "Sprain", bodyPart: "Right ankle", cause: "Glue line micro-leak not detected on start-of-shift inspection; drip tray absent." },
    { location: "Exercise-Book Stitching & Trimming", description: "Operator sustained a laceration to the hand from the unguarded trimmer knife while clearing a paper jam.", injury: "Laceration", bodyPart: "Left hand", cause: "Knife guard not deployed; adjacent workers not notified before clearing the jam." },
  ],
};

// Active permit templates per industry
const PERMIT_TEMPLATES: Record<string, [{ type: "HOT_WORK" | "CONFINED_SPACE"; location: string; scope: string }, { type: "HOT_WORK" | "CONFINED_SPACE"; location: string; scope: string }]> = {
  AXM: [
    { type: "HOT_WORK",       location: "Digester House — Nozzle Flange N-07",   scope: "SMAW repair to continuous digester shell nozzle N-07. Vessel emptied, purged and gas-tested < 5% LEL. Hot work screens deployed." },
    { type: "CONFINED_SPACE", location: "Black Liquor Storage Tank T-12",        scope: "Internal inspection for corrosion survey. Tank emptied, washed, ventilated. O₂: 20.9%, LEL: 0%, H₂S: 0 ppm." }
  ],
  MCP: [
    { type: "HOT_WORK",       location: "Steam & Condensate Utilities — Header Modification", scope: "Welding stainless steam header joint in the utility corridor. Tissue machines isolated. Gas test < 2% LEL." },
    { type: "CONFINED_SPACE", location: "Effluent Treatment — Equalization Tank",    scope: "Manhole entry for sludge clearance. Forced ventilation, CGI clear, life-line deployed." }
  ],
  APX: [
    { type: "HOT_WORK",       location: "Board Machine — Steam Header Joint",       scope: "Welding repair to dryer-section steam header flanged joint. Area cleared of board broke within 5 m." },
    { type: "CONFINED_SPACE", location: "Stock Preparation — Pulp Chest C-3",       scope: "Internal inspection for build-up assessment. Chest drained, ventilated, O₂: 20.8%, CO: 0 ppm." }
  ],
  CCS: [
    { type: "HOT_WORK",       location: "Kraft Paper Machine — Press Frame Crack",  scope: "Arc gouging and welding repair on press-section frame. Broke cleared, dust suppressed. Gas test clear." },
    { type: "CONFINED_SPACE", location: "Stock Preparation — Saveall Pit",          scope: "Saveall pit entry for white-water clearance. Pit drained, ventilated. CGI monitor in use." }
  ],
  ISL: [
    { type: "HOT_WORK",       location: "Newsprint Machine — Dryer Cylinder Bracket", scope: "Cutting and welding on a dryer-cylinder support bracket. Steam isolated 6 hr prior; area cooled." },
    { type: "CONFINED_SPACE", location: "Pulper & Slushing Area — Couch Pit",        scope: "Couch pit entry for chute replacement. Pit dewatered, ventilated. O₂ 20.9%, CO < 5 ppm." }
  ],
  PFI: [
    { type: "HOT_WORK",       location: "Boiler & Steam Utilities — Steam Line Modification", scope: "Welding new steam branch on 4\" header. Line drained, isolated. Gas test clear." },
    { type: "CONFINED_SPACE", location: "Effluent Treatment — Primary Tank",           scope: "Entry for desludging. Tank purged with fresh air, CGI clear, attendant stationed." }
  ],
  PMB: [
    { type: "HOT_WORK",       location: "Recovery Boiler — Tube Panel Repair",        scope: "GTAW repair to recovery boiler furnace tube panel. Boiler offline, tubes purged. Gas test clear." },
    { type: "CONFINED_SPACE", location: "Pulp Digester D-2",                           scope: "Internal inspection of digester lining. Digester depressurised, purged. O₂ 20.9%, TRS 0 ppm." }
  ],
  VGP: [
    { type: "HOT_WORK",       location: "Pulper & Slushing Area — Feed Chute Modification", scope: "Welding a new reinforcement on the pulper feed chute. Pulper isolated, drained, gas test clear." },
    { type: "CONFINED_SPACE", location: "De-inking & Flotation Cells — Cell F-2",          scope: "Flotation cell internal inspection. Cell drained, ventilated. O₂ 20.9%, CGI monitor in use." }
  ],
  AGB: [
    { type: "HOT_WORK",       location: "AKD / Rosin Sizing Reactor — Manhole Flange",  scope: "Welding repair to sizing reactor manhole flange. System purged with N₂. VOC < 5 ppm, LEL 0%." },
    { type: "CONFINED_SPACE", location: "Starch Cooking Unit — Cooker Vessel A-3",        scope: "Internal corrosion inspection. Cooker depressurised, washed, purged. O₂ 20.8%, LEL 0%." }
  ],
  ACS: [
    { type: "HOT_WORK",       location: "Reel-to-Sheet Cutting — Knife Frame Routing",   scope: "Welding a guard bracket on the sheeter knife frame. Sheeter isolated, residual paper cleared." },
    { type: "CONFINED_SPACE", location: "Glue, Ink & Solvent Store — Glue Tank Pit",      scope: "Glue tank pit entry for dosing system maintenance. Pit ventilated, CGI clear, O₂ 20.9%." }
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
