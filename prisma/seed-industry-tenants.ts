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
import { DEMO_PASSWORD, DEMO_INDUSTRIES, SUPPORT_ROLES, supportName } from "./demo-users-config";

const prisma = new PrismaClient();

const DEMO_TODAY = new Date("2026-06-07T09:00:00.000Z");

// ─── Industry-specific areas (15 per plant) ───────────────────────────────────

const INDUSTRY_AREAS: Record<string, string[]> = {
  AXM: [
    "Reactor Hall A — Primary Synthesis",
    "Reactor Hall B — Secondary Synthesis",
    "Distillation & Separation Unit",
    "Solvent Storage & Handling Area",
    "Boiler & Steam Generation",
    "Cooling Tower & Water Treatment",
    "Electrical Substation",
    "Effluent Treatment Plant",
    "Tanker Loading & Unloading Bay",
    "QC & Analytical Laboratory",
    "Maintenance Workshop",
    "Compressed Gas Store (N₂, O₂, Cl₂)",
    "Confined Space Zones (Reactors, Vessels, Pits)",
    "Hazardous Waste Segregation Bay",
    "Admin & Welfare Block"
  ],
  MCP: [
    "Manufacturing Suite A — Granulation & Blending",
    "Manufacturing Suite B — Compression & Coating",
    "Sterile Fill-Finish Area (Grade A/B Cleanroom)",
    "Dispensing & Weighing Room",
    "QC & Microbiology Laboratory",
    "Clean Utilities (WFI, Clean Steam, HVAC)",
    "Solvent Storage & Recovery",
    "Warehouse & Cold Chain Store",
    "Effluent Treatment Plant",
    "Engineering & Maintenance Workshop",
    "Electrical Substation",
    "Compressed Gas Store (N₂, CO₂, Argon)",
    "Confined Space Zones (Tanks, Vessels, Ducts)",
    "Incinerator & Hazardous Waste Area",
    "Canteen & Welfare Block"
  ],
  APX: [
    "Banbury Mixing Area",
    "Carbon Black & Chemicals Storage",
    "Tyre Building Area",
    "Curing Press Area",
    "Bead Winding & Ply Cutting Section",
    "Testing & QC Bay",
    "Raw Material Store",
    "Finished Goods Warehouse",
    "Boiler House & Steam Lines",
    "Cooling Tower",
    "Electrical Substation",
    "Maintenance Workshop",
    "Chemical & Solvent Store",
    "Confined Space Zones (Pits, Vessels, Sumps)",
    "Canteen & Welfare Block"
  ],
  CCS: [
    "Raw Mill Section",
    "Kiln Feed / Pre-heater Tower",
    "Rotary Kiln & Clinker Cooler",
    "Cement Mill Section",
    "Packing Plant",
    "Bulk Loading & Dispatch Area",
    "Coal Handling & Storage",
    "Electrical Substation",
    "Compressed Air Station",
    "Effluent Settling Pond",
    "Maintenance Workshop",
    "Elevated Structures (Pre-heater, Silos, Conveyors)",
    "Confined Space Zones (Silos, Bins, Ducts)",
    "Clinker Storage Dome",
    "Canteen & Welfare Block"
  ],
  ISL: [
    "Blast Furnace Area",
    "Basic Oxygen / Electric Arc Furnace Shop",
    "Continuous Casting Bay",
    "Hot Rolling Mill",
    "Cold Rolling Mill",
    "Scrap Yard & Raw Material Store",
    "Coke Oven Battery",
    "Electrical Substation (132 kV)",
    "Gas Holder Area (BF Gas, Coke Oven Gas)",
    "Cooling Tower & Water Treatment",
    "Maintenance Workshop",
    "Quality Control Laboratory",
    "Confined Space Zones (Vessels, Ladles, Pits)",
    "Elevated Structures (Furnace Charging, Cranes)",
    "Canteen & Welfare Block"
  ],
  PFI: [
    "Receiving & Raw Material Preparation Hall",
    "Processing Hall A — Cooking & Blending",
    "Processing Hall B — Filling & Sealing",
    "Retort & Sterilisation Area",
    "Cold Storage & Deep Freeze",
    "Dry Ingredients & Packaging Store",
    "Effluent Treatment Plant",
    "Boiler & Steam Utilities",
    "Packaging Line Area",
    "CIP & Hygiene Station",
    "QC & Microbiology Lab",
    "Engineering Workshop",
    "Electrical Substation",
    "Confined Space Zones (Tanks, Silos, Vessels)",
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
    "Turbine Hall (Unit 1 & 2)",
    "Boiler House",
    "Coal Handling Plant",
    "Ash Handling System",
    "Cooling Tower Area",
    "Switchyard (220 kV)",
    "DM Water & Condensate Plant",
    "Fuel Oil Storage & Handling",
    "Electrical Control Room (ECR / UCB)",
    "Maintenance Workshop",
    "Effluent Treatment Plant",
    "Transformer Yard",
    "Confined Space Zones (Vessels, Ducts, Pits, Condensers)",
    "Elevated Structures (Boiler, Chimney, Cooling Tower)",
    "Canteen & Welfare Block"
  ],
  AGB: [
    "Ammonia Synthesis Unit",
    "Urea Synthesis & Prilling Tower",
    "Phosphoric Acid Plant",
    "Sulphuric Acid Plant",
    "Bagging & Dispatch Area",
    "Ammonia Storage Bullets",
    "Effluent Treatment Plant",
    "Boiler & Utility Block",
    "Electrical Substation & Control Room",
    "Cooling Tower",
    "Maintenance Workshop",
    "Hazardous Chemical Store (Ammonia, H₂SO₄, H₃PO₄)",
    "Confined Space Zones (Reactors, Vessels, Pits)",
    "Elevated Structures (Prilling Tower, Synthesis Loop)",
    "Canteen & Welfare Block"
  ],
  ACS: [
    "Press Shop",
    "Welding Shop",
    "Paint Shop & Paint Kitchen",
    "Assembly Line A",
    "Assembly Line B",
    "Engine & Transmission Sub-Assembly",
    "Quality Inspection Bay",
    "Raw Material & Parts Warehouse",
    "Finished Goods Dispatch Yard",
    "Boiler & Compressed Air Station",
    "Electrical Substation",
    "Maintenance Workshop",
    "Chemical & Paint Store",
    "Confined Space Zones (Paint Booths, Underbody Pits)",
    "Canteen & Welfare Block"
  ]
};

// ─── Supporting roles per industry plant ────────────────────────────────────

// SUPPORT_ROLES / supportName live in demo-users-config so the standalone
// rename-support-users script can reuse the exact same table.

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
    { location: "Reactor Hall A", description: "Operator sustained chemical splash to forearm from reactor drain valve failure during dip sampling.", injury: "Chemical burn — Grade 1", bodyPart: "Left forearm", cause: "Drain valve not positively isolated prior to sampling; splash guard not deployed." },
    { location: "Solvent Storage Area", description: "Worker fractured wrist tripping over unlabelled drum moved into walkway overnight.", injury: "Fracture", bodyPart: "Right wrist", cause: "Housekeeping non-compliance; drum repositioned without barricading walkway." },
  ],
  MCP: [
    { location: "Manufacturing Suite B", description: "Technician sprained ankle stepping off turntable platform without using three-point contact.", injury: "Sprain", bodyPart: "Left ankle", cause: "Platform edge not marked; three-point contact procedure not followed." },
  ],
  APX: [
    { location: "Banbury Mixing Area", description: "Operator caught glove in Banbury mixer ram during ingredient loading; soft-tissue injury to fingers.", injury: "Soft-tissue contusion", bodyPart: "Right-hand fingers", cause: "Operator reached into mixing zone with mixer in slow-jog mode; guard interlock bypassed." },
    { location: "Curing Press Area", description: "Maintenance fitter suffered lower back strain lifting heavy curing mould without mechanical aid.", injury: "Musculoskeletal strain", bodyPart: "Lower back", cause: "Mechanical lifting aid not requested; manual handling risk not assessed for the task." },
    { location: "Carbon Black Store", description: "Warehouse operator slipped on carbon black spill on smooth concrete floor.", injury: "Laceration", bodyPart: "Left knee", cause: "Spill not barricaded; non-slip footwear not available in store area." },
  ],
  CCS: [
    { location: "Kiln Feed Pre-heater Tower", description: "Fitter sustained burns to forearm from hot clinker dust blowback while clearing blockage at cyclone inspection port.", injury: "Thermal burn — Grade 1", bodyPart: "Right forearm", cause: "Port opened without confirming zero pressure; hot material present; PPE inadequate." },
    { location: "Raw Mill Section", description: "Operator fractured finger caught in rotating mill coupling guard gap.", injury: "Fracture", bodyPart: "Right middle finger", cause: "Guard gap exceeded 25 mm tolerance; pre-start safety check not completed." },
    { location: "Elevated Conveyor Structure", description: "Worker sprained ankle from misstep on corroded grating panel at conveyor walkway.", injury: "Sprain", bodyPart: "Right ankle", cause: "Corroded grating not flagged in last inspection; walkway lighting inadequate." },
    { location: "Packing Plant", description: "Packing operator sustained eye injury from cement dust ingress during bag reel changeover.", injury: "Eye irritation — Grade 2", bodyPart: "Both eyes", cause: "Safety glasses removed during reel change due to fogging; goggles not available." },
  ],
  ISL: [
    { location: "Hot Rolling Mill", description: "Roll table operator sustained laceration to forearm from sharp coil edge projection.", injury: "Laceration", bodyPart: "Right forearm", cause: "Coil edge deflector guard missing; operator's arm entered hazard zone." },
    { location: "Blast Furnace Area", description: "BF operator suffered heat stress and collapsed at taphole platform during summer peak.", injury: "Heat stress — moderate", bodyPart: "Systemic", cause: "Buddy system not followed; rest shelter not used; hydration schedule overdue." },
    { location: "Scrap Yard", description: "Crane operator fractured ankle jumping from cab during emergency stop — cab too high without steps.", injury: "Fracture", bodyPart: "Right ankle", cause: "Cab exit ladder detached; no temporary steps provided; emergency evacuation not practised." },
    { location: "Coke Oven Battery", description: "Oven pusher operator sustained corneal burn from hot coke projection without face shield.", injury: "Eye burn — chemical/thermal", bodyPart: "Left eye", cause: "Face shield not worn for oven pushing; no supervisor present during operation." },
    { location: "Continuous Casting Bay", description: "Maintenance fitter fell from casting platform ladder — missing rung not tagged.", injury: "Musculoskeletal sprain", bodyPart: "Lower back and hip", cause: "Ladder not inspected before use; missing rung not reported by previous user." },
  ],
  PFI: [
    { location: "Processing Hall B", description: "Line operator sustained scald to right hand from steam leak at sealing machine feed nozzle.", injury: "Scald — Grade 1", bodyPart: "Right hand", cause: "Steam trap overdue service; condensate backup caused nozzle blow-out; no steam gloves available at station." },
    { location: "Cold Storage", description: "Store worker slipped on ice patch near freezer door threshold.", injury: "Laceration", bodyPart: "Left elbow", cause: "Freezer door seal worn; ice build-up not cleared on daily inspection round." },
  ],
  PMB: [
    { location: "Recovery Boiler", description: "Boiler operator sustained steam burn to left arm from condensate line flexible coupling failure.", injury: "Scald — Grade 2", bodyPart: "Left forearm", cause: "Flexible coupling not included in routine inspection scope; rated life exceeded." },
    { location: "Pulp Mill — Recovery Section", description: "Process operator sustained caustic splash to face when pressure relief valve discharged unexpectedly.", injury: "Chemical splash — eye and face", bodyPart: "Face and eyes", cause: "PRV not in inspection schedule; face shield not worn during valve-area patrol." },
    { location: "Paper Machine PM-1", description: "Paper machine assistant hand caught in felt press nip during threading operation.", injury: "Crush injury", bodyPart: "Right hand", cause: "Machine not de-energised during threading; LOTO procedure not followed." },
  ],
  VGP: [
    { location: "Coal Handling Plant", description: "Coal handler sustained hand injury from conveyor belt nip point during emergency clearing.", injury: "Soft-tissue crush", bodyPart: "Right hand", cause: "Conveyor not isolated before clearing blockage; isolation point not marked." },
    { location: "Turbine Hall", description: "Maintenance technician slipped on oil film from turbine bearing oil drain overflow.", injury: "Sprain", bodyPart: "Left knee", cause: "Oil drain overflow not contained; housekeeping inspection overdue by 4 hours." },
  ],
  AGB: [
    { location: "Ammonia Synthesis Unit", description: "Instrument technician sustained ammonia inhalation while replacing flange gasket — detected late.", injury: "Ammonia inhalation — moderate", bodyPart: "Respiratory system", cause: "Work package did not specify NH₃ monitor; area monitor alarm threshold too high." },
    { location: "Sulphuric Acid Plant", description: "Operator sustained acid splash to legs from leaking pump gland packing.", injury: "Chemical burn — Grade 1", bodyPart: "Both legs (lower)", cause: "Pump gland packing overdue replacement; acid-resistant PPE leg coverage inadequate." },
    { location: "Urea Synthesis Unit", description: "Fitter fell from portable ladder while tightening flange bolts at elevated position.", injury: "Fracture", bodyPart: "Right wrist", cause: "Portable ladder not footed; work at height permit not taken for this task." },
  ],
  ACS: [
    { location: "Press Shop", description: "Press operator sustained crush injury to left-hand finger from die-setter entering press working zone.", injury: "Crush — fracture", bodyPart: "Left index finger", cause: "Die-setting LOTO not completed; press control accessible during setting operation." },
    { location: "Paint Shop", description: "Paint spray technician developed isocyanate-induced occupational asthma after repeated exposures.", injury: "Occupational lung disease", bodyPart: "Respiratory system", cause: "Supplied air respirator not worn; spray booth ventilation filter overdue replacement." },
    { location: "Assembly Line A", description: "Assembly worker slipped on hydraulic oil leak beside torquing station.", injury: "Sprain", bodyPart: "Right ankle", cause: "Hydraulic line micro-leak not detected on start-of-shift inspection; drip tray absent." },
    { location: "Welding Shop", description: "Welder sustained flash burn to eyes while working adjacent to unshielded arc.", injury: "Arc-eye (photokeratitis)", bodyPart: "Both eyes", cause: "Welding screen not deployed; adjacent workers not notified before arc start." },
  ],
};

// Active permit templates per industry
const PERMIT_TEMPLATES: Record<string, [{ type: "HOT_WORK" | "CONFINED_SPACE"; location: string; scope: string }, { type: "HOT_WORK" | "CONFINED_SPACE"; location: string; scope: string }]> = {
  AXM: [
    { type: "HOT_WORK",       location: "Reactor Hall A — Nozzle Flange N-07", scope: "SMAW repair to reactor shell nozzle N-07. Area purged and gas-tested < 5% LEL. Hot work screens deployed." },
    { type: "CONFINED_SPACE", location: "Solvent Storage Tank T-12",             scope: "Internal inspection for corrosion survey. Tank purged, ventilated. O₂: 20.9%, LEL: 0%, H₂S: 0 ppm." }
  ],
  MCP: [
    { type: "HOT_WORK",       location: "Clean Utilities — HVAC Duct Modification", scope: "Welding stainless duct joint in clean utility corridor. Cleanrooms isolated. Gas test < 2% LEL." },
    { type: "CONFINED_SPACE", location: "Effluent Treatment — Equalization Tank",    scope: "Manhole entry for sludge clearance. Forced ventilation, CGI clear, life-line deployed." }
  ],
  APX: [
    { type: "HOT_WORK",       location: "Banbury Mixing Area — Steam Header Joint", scope: "Welding repair to steam header flanged joint. Area cleared of rubber compound within 5 m." },
    { type: "CONFINED_SPACE", location: "Carbon Black Storage Silo S-3",             scope: "Internal inspection for bridging assessment. Silo purged, ventilated, O₂: 20.8%, CO: 0 ppm." }
  ],
  CCS: [
    { type: "HOT_WORK",       location: "Cement Mill — Separator Housing Crack",   scope: "Arc gouging and welding repair on separator housing. Dust suppressed. Gas test clear." },
    { type: "CONFINED_SPACE", location: "Pre-heater Tower — Cyclone Stage 3",       scope: "Internal deskaleing entry. Cyclone cooled to < 45°C, ventilated. CGI monitor in use." }
  ],
  ISL: [
    { type: "HOT_WORK",       location: "Blast Furnace — Cooling Stave Replacement", scope: "Cutting and welding on cooling stave support bracket. BF tapped 6 hr prior; area cooled." },
    { type: "CONFINED_SPACE", location: "Hot Rolling Mill — Underground Pit",         scope: "Scale pit entry for chute replacement. Pit dewatered, ventilated. O₂ 20.9%, CO < 5 ppm." }
  ],
  PFI: [
    { type: "HOT_WORK",       location: "Processing Hall A — Steam Line Modification", scope: "Welding new steam branch on 4\" header. Line drained, isolated. Gas test clear." },
    { type: "CONFINED_SPACE", location: "Effluent Treatment — Primary Tank",           scope: "Entry for desludging. Tank purged with fresh air, CGI clear, attendant stationed." }
  ],
  PMB: [
    { type: "HOT_WORK",       location: "Recovery Boiler — Tube Panel Repair",        scope: "GTAW repair to recovery boiler furnace tube panel. Boiler offline, tubes purged. Gas test clear." },
    { type: "CONFINED_SPACE", location: "Pulp Digester D-2",                           scope: "Internal inspection of digester lining. Digester depressurised, purged. O₂ 20.9%, TRS 0 ppm." }
  ],
  VGP: [
    { type: "HOT_WORK",       location: "Boiler House — Feed Water Line Modification", scope: "Welding new drain branch on feed water line. Line isolated, drained, gas test clear." },
    { type: "CONFINED_SPACE", location: "Condenser Water Box",                         scope: "Condenser tube inspection. Water box drained, ventilated. O₂ 20.9%, CGI monitor in use." }
  ],
  AGB: [
    { type: "HOT_WORK",       location: "Ammonia Synthesis — Converter Manhole",      scope: "Welding repair to converter manhole flange. System purged with N₂. NH₃ < 5 ppm, LEL 0%." },
    { type: "CONFINED_SPACE", location: "Urea Synthesis — Autoclave A-3",              scope: "Internal corrosion inspection. Autoclave depressurised, purged. O₂ 20.8%, NH₃ < 1 ppm." }
  ],
  ACS: [
    { type: "HOT_WORK",       location: "Press Shop — Hydraulic Line Routing",        scope: "Welding hydraulic manifold bracket on press frame. Press isolated, hydraulic oil cleared." },
    { type: "CONFINED_SPACE", location: "Paint Shop — Spray Booth Pit",                scope: "Booth pit entry for filter system maintenance. Booth ventilated, CGI clear, O₂ 20.9%." }
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
    for (const [i, sr] of SUPPORT_ROLES.entries()) {
      const email = `${sr.emailKey}.${ind.plantCode.toLowerCase()}@safeops360.in`;
      const name = supportName(ind.plantCode, i, sr.designation);
      await prisma.user.upsert({
        where: { email },
        // `name` is in the update branch on purpose: re-running this seed must
        // rename accounts already created with the old designation-as-name
        // scheme, otherwise every workflow screen keeps showing a role where a
        // person belongs.
        update: { name, role: sr.role, designation: sr.designation, department: sr.dept, plantId: plant.id },
        create: { email, name, passwordHash: password, role: sr.role, designation: sr.designation, department: sr.dept, plantId: plant.id }
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
