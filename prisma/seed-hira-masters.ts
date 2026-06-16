// ────────────────────────────────────────────────────────────────────────
// HIRA master data seed — Phase 1 of IMS expansion.
//
// Seeds:
//   1. Standard 5×5 risk matrix (default for new tenants)
//   2. Simplified 3×3 risk matrix (small-business variant)
//   3. Likelihood + severity scales for both matrices
//   4. Cell mapping with risk levels, colors, action statements
//   5. Hazard library stub — 20 representative hazards across 5 categories
//      (the PM owns the full 150+ row delivery per D6)
//   6. Control library stub — 12 standard controls
//
// Idempotent: uses upsert on natural keys; safe to re-run.
//
// Run:  npx tsx prisma/seed-hira-masters.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── 5×5 standard risk matrix ────────────────────────────────────────

const STD_5X5 = {
  code: "STD_5X5",
  name: "5×5 Standard Risk Matrix",
  description: "Aligned with AS/NZS 4360 and ISO 31000. Default for new tenants.",
  likelihoodLevels: 5,
  severityLevels: 5,
  acceptableResidual: {
    routine: "MODERATE",
    non_routine: "MODERATE",
    emergency: "LOW"
  },
  controlHierarchyEnforced: true,
  isActive: true,
  isDefault: true,
  isGlobal: true,
  likelihoods: [
    { score: 1, label: "Rare",             description: "May occur only in exceptional circumstances", frequencyGuidance: "Once in more than 10 years" },
    { score: 2, label: "Unlikely",         description: "Could occur at some time",                     frequencyGuidance: "Once in 5–10 years" },
    { score: 3, label: "Possible",         description: "Might occur at some time",                     frequencyGuidance: "Once in 1–5 years" },
    { score: 4, label: "Likely",           description: "Will probably occur in most circumstances",    frequencyGuidance: "Once a year or more" },
    { score: 5, label: "Almost Certain",   description: "Expected to occur in most circumstances",      frequencyGuidance: "Multiple times per year" }
  ],
  severities: [
    {
      score: 1, label: "Insignificant",
      description: "No injury or minor injury requiring no treatment",
      healthSafetyGuidance: "First aid not required, no lost time",
      propertyDamageGuidance: "< INR 10,000",
      environmentalGuidance: "No environmental impact",
      reputationGuidance: "No external awareness"
    },
    {
      score: 2, label: "Minor",
      description: "Minor injury requiring first aid",
      healthSafetyGuidance: "First aid treatment, no lost time",
      propertyDamageGuidance: "INR 10,000 – 1 lakh",
      environmentalGuidance: "Minor on-site impact, easily contained",
      reputationGuidance: "Internal awareness only"
    },
    {
      score: 3, label: "Moderate",
      description: "Medical treatment required, possible lost time",
      healthSafetyGuidance: "Medical treatment, possible short-term LTI (< 1 week)",
      propertyDamageGuidance: "INR 1–10 lakh",
      environmentalGuidance: "Limited off-site impact, recoverable",
      reputationGuidance: "Local media or community awareness"
    },
    {
      score: 4, label: "Major",
      description: "Serious injury, extended LTI, hospitalisation",
      healthSafetyGuidance: "Hospitalisation, LTI > 1 week, possible permanent partial disability",
      propertyDamageGuidance: "INR 10 lakh – 1 crore",
      environmentalGuidance: "Significant off-site impact, prolonged recovery",
      reputationGuidance: "Regional media coverage, regulatory attention"
    },
    {
      score: 5, label: "Catastrophic",
      description: "Fatality, multiple casualties, permanent total disability",
      healthSafetyGuidance: "Single fatality, multiple major injuries, permanent total disability",
      propertyDamageGuidance: "> INR 1 crore",
      environmentalGuidance: "Major off-site impact, long-term/permanent damage",
      reputationGuidance: "National media, criminal liability potential"
    }
  ]
};

// Cell colour + level + action. The mapping codifies the spec §10.1 table.
const CELL_COLORS: Record<string, string> = {
  LOW:      "#10B981",
  MODERATE: "#F59E0B",
  HIGH:     "#F97316",
  CRITICAL: "#EF4444"
};

// (likelihood, severity) → riskLevel based on spec §10.1
function cellLevel(l: number, s: number): "LOW" | "MODERATE" | "HIGH" | "CRITICAL" {
  const score = l * s;
  // High-severity ceiling: severity 5 with likelihood 3+ goes critical regardless
  if (s === 5 && l >= 3) return "CRITICAL";
  if (s === 4 && l >= 4) return "CRITICAL";
  if (score >= 15) return "CRITICAL";
  if (score >= 8) return "HIGH";
  if (score >= 6) return "MODERATE";
  if (score >= 4 && l >= 4) return "MODERATE";
  if (score >= 4 && s >= 4) return "MODERATE";
  return "LOW";
}

function cellAction(level: string): { action: string; responseDays: number } {
  switch (level) {
    case "CRITICAL": return { action: "STOP — Corporate HSE escalation, immediate controls required", responseDays: 3 };
    case "HIGH":     return { action: "Senior management review required",                              responseDays: 30 };
    case "MODERATE": return { action: "Reduce ALARP",                                                   responseDays: 60 };
    case "LOW":      return { action: "Acceptable, periodic review",                                    responseDays: 90 };
    default:         return { action: "Review",                                                          responseDays: 60 };
  }
}

// ─── 3×3 simplified matrix (small-business variant) ─────────────────

const STD_3X3 = {
  code: "STD_3X3",
  name: "3×3 Simplified Risk Matrix",
  description: "Simplified variant for low-complexity operations and small contractors.",
  likelihoodLevels: 3,
  severityLevels: 3,
  acceptableResidual: { routine: "MODERATE", non_routine: "LOW", emergency: "LOW" },
  controlHierarchyEnforced: false,
  isActive: true,
  isDefault: false,
  isGlobal: true,
  likelihoods: [
    { score: 1, label: "Low",    description: "Unlikely under normal conditions", frequencyGuidance: "Less than once a year" },
    { score: 2, label: "Medium", description: "May occur occasionally",          frequencyGuidance: "Once a year" },
    { score: 3, label: "High",   description: "Likely to occur frequently",      frequencyGuidance: "Monthly or more often" }
  ],
  severities: [
    { score: 1, label: "Minor",        description: "First aid",          healthSafetyGuidance: "First aid", propertyDamageGuidance: "< INR 50,000", environmentalGuidance: "Negligible", reputationGuidance: "None" },
    { score: 2, label: "Significant",  description: "Medical / LTI",      healthSafetyGuidance: "Medical / LTI", propertyDamageGuidance: "INR 50k–10 lakh", environmentalGuidance: "Local", reputationGuidance: "Local" },
    { score: 3, label: "Severe",       description: "Major or fatality",  healthSafetyGuidance: "Major injury / fatality", propertyDamageGuidance: "> INR 10 lakh", environmentalGuidance: "Off-site", reputationGuidance: "Regional+" }
  ]
};

function level3x3(l: number, s: number): string {
  const score = l * s;
  if (score >= 7) return "CRITICAL";
  if (score >= 4) return "HIGH";
  if (score >= 2) return "MODERATE";
  return "LOW";
}

// ─── Hazard library stub (20 rows; PM delivers full set by end-of-week-5) ─

const HAZARDS = [
  // Mechanical (4)
  { code: "MECH_UNGUARDED_ROTATING", category: "mechanical", subcategory: "rotating_parts", name: "Moving machinery — unguarded rotating parts",
    description: "Exposed shafts, belts, gears, pulleys on machinery without fixed or interlocked guards.",
    typicalHarmPotential: ["entanglement", "amputation", "fracture", "laceration"],
    typicalAffectedPersons: ["operator", "maintenance_crew", "contractor"],
    energyForm: "mechanical_rotational",
    factoriesActSection: "Section 21 (Fencing of machinery)",
    isStandard: "IS 9474 (Safety of machinery)",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Fixed guard with interlocked access" },
      { hierarchy: "ADMINISTRATIVE", description: "Lockout-tagout during maintenance" }
    ]},
  { code: "MECH_HEAVY_LIFTING", category: "mechanical", subcategory: "manual_handling", name: "Heavy / awkward manual lifting",
    description: "Lifting, pushing, pulling of loads beyond ergonomic limits.",
    typicalHarmPotential: ["strain", "sprain", "musculoskeletal_injury"],
    typicalAffectedPersons: ["operator", "warehouse_worker", "contractor"],
    energyForm: "ergonomic",
    isStandard: "IS 7155 (Manual handling)",
    typicalControlsSuggested: [
      { hierarchy: "ELIMINATION", description: "Mechanise the lift with hoist / forklift" },
      { hierarchy: "ADMINISTRATIVE", description: "Two-person lift policy above 25 kg" }
    ]},
  { code: "MECH_FALLING_OBJECT", category: "mechanical", subcategory: "struck_by", name: "Falling object from height",
    description: "Tools, materials, debris falling from raised work platforms or storage racks.",
    typicalHarmPotential: ["fracture", "head_injury", "fatality"],
    typicalAffectedPersons: ["worker_below", "contractor", "visitor"],
    energyForm: "gravitational",
    factoriesActSection: "Section 32",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Toe boards and debris netting" },
      { hierarchy: "PPE", description: "Hard hat" }
    ]},
  { code: "MECH_MOBILE_EQUIPMENT", category: "mechanical", subcategory: "mobile", name: "Mobile equipment collision (forklift, mobile crane, dumper)",
    description: "Pedestrian-vehicle interaction in operating areas.",
    typicalHarmPotential: ["crush_injury", "fracture", "fatality"],
    typicalAffectedPersons: ["operator", "pedestrian", "contractor"],
    energyForm: "kinetic",
    isStandard: "IS 14962",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Separation of pedestrian and vehicle paths with barriers" },
      { hierarchy: "ADMINISTRATIVE", description: "Speed limits and traffic management plan" }
    ]},
  // Electrical (3)
  { code: "ELEC_LIVE_PARTS_LV", category: "electrical", subcategory: "low_voltage", name: "Contact with live LV (< 1 kV) parts",
    description: "Exposed live conductors or terminals during inspection / maintenance of LV equipment.",
    typicalHarmPotential: ["electrocution", "burn"],
    typicalAffectedPersons: ["electrician", "maintenance"],
    energyForm: "electrical_low_voltage",
    factoriesActSection: "Section 36",
    typicalControlsSuggested: [
      { hierarchy: "ADMINISTRATIVE", description: "Permit to Work + isolation procedure" },
      { hierarchy: "PPE", description: "Insulated gloves, dielectric footwear" }
    ]},
  { code: "ELEC_HV_ARC_FLASH", category: "electrical", subcategory: "high_voltage", name: "HV arc flash during switching",
    description: "Arc flash event from HV switchgear operation, capacitor banks, or motor starts.",
    typicalHarmPotential: ["burn", "blast_injury", "fatality"],
    typicalAffectedPersons: ["electrician", "maintenance"],
    energyForm: "electrical_high_voltage",
    isStandard: "IS/IEC 61482 (Arc flash PPE)",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Arc-rated switchgear with remote racking" },
      { hierarchy: "PPE", description: "Arc-flash suit per category" }
    ]},
  { code: "ELEC_STATIC_DISCHARGE", category: "electrical", subcategory: "static", name: "Static electricity discharge in flammable atmosphere",
    description: "Static buildup during liquid transfer or powder handling igniting flammable vapour.",
    typicalHarmPotential: ["burn", "blast_injury", "fatality"],
    typicalAffectedPersons: ["operator"],
    energyForm: "electrical_static",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Bonding and grounding during transfer" }
    ]},
  // Chemical (4)
  { code: "CHEM_CORROSIVE_CONTACT", category: "chemical", subcategory: "corrosive", name: "Contact with corrosive substance",
    description: "Skin or eye contact with acids, alkalis, or strong oxidisers during handling.",
    typicalHarmPotential: ["burn_chemical", "eye_injury"],
    typicalAffectedPersons: ["operator", "lab_technician"],
    energyForm: "chemical",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Closed transfer system" },
      { hierarchy: "PPE", description: "Chemical resistant gloves + face shield" }
    ]},
  { code: "CHEM_TOXIC_INHALATION", category: "chemical", subcategory: "toxic", name: "Inhalation of toxic vapour / dust",
    description: "Exposure to toxic gas (H2S, NH3, CO, SO2) or respirable dust above TLV.",
    typicalHarmPotential: ["respiratory_illness", "poisoning", "fatality"],
    typicalAffectedPersons: ["operator", "contractor"],
    energyForm: "chemical",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Local exhaust ventilation" },
      { hierarchy: "PPE", description: "Half / full face respirator with appropriate cartridge" }
    ]},
  { code: "CHEM_FLAMMABLE_SPILL", category: "chemical", subcategory: "flammable", name: "Flammable liquid spill",
    description: "Spill of flammable liquid creating vapour cloud and ignition risk.",
    typicalHarmPotential: ["burn", "blast_injury", "fatality"],
    typicalAffectedPersons: ["operator", "emergency_responders"],
    energyForm: "chemical",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Bunded storage and spill containment" },
      { hierarchy: "ADMINISTRATIVE", description: "Hot work permit with gas test" }
    ]},
  { code: "CHEM_SDS_UNREVIEWED", category: "chemical", subcategory: "sds", name: "Handling a chemical without SDS review",
    description: "Worker uses a substance without first reviewing the Safety Data Sheet.",
    typicalHarmPotential: ["acute_exposure", "chronic_health_effect"],
    typicalAffectedPersons: ["operator", "lab_technician"],
    energyForm: "chemical",
    typicalControlsSuggested: [
      { hierarchy: "ADMINISTRATIVE", description: "SDS access training and pre-task review checklist" }
    ]},
  // Fire / explosion (2)
  { code: "FIRE_HOT_WORK_IGNITION", category: "fire_explosion", subcategory: "hot_work", name: "Hot work ignition source near combustibles",
    description: "Welding, cutting, grinding sparks landing on combustibles within 11 metres.",
    typicalHarmPotential: ["burn", "structural_fire", "fatality"],
    typicalAffectedPersons: ["welder", "fire_watch", "occupants"],
    energyForm: "thermal",
    factoriesActSection: "Section 38",
    typicalControlsSuggested: [
      { hierarchy: "ELIMINATION", description: "Move work to designated hot work area" },
      { hierarchy: "ADMINISTRATIVE", description: "Hot work permit + fire watch + 11m clearance" }
    ]},
  { code: "FIRE_DUST_EXPLOSION", category: "fire_explosion", subcategory: "dust", name: "Combustible dust explosion",
    description: "Accumulated combustible dust (cotton lint, fabric fly, yarn fibre fines) ignited by spark or flame.",
    typicalHarmPotential: ["blast_injury", "fatality"],
    typicalAffectedPersons: ["operator", "occupants"],
    energyForm: "chemical",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Explosion-proof equipment and venting" },
      { hierarchy: "ADMINISTRATIVE", description: "Housekeeping standard for dust accumulation" }
    ]},
  // Height + confined space (3)
  { code: "HEIGHT_FALL_OVER_2M", category: "height", subcategory: "fall", name: "Fall from height (> 2 m)",
    description: "Working at or above 2 m without fall protection.",
    typicalHarmPotential: ["fracture", "head_injury", "fatality"],
    typicalAffectedPersons: ["worker_at_height", "contractor"],
    energyForm: "gravitational",
    factoriesActSection: "Section 32 (Floors, stairs)",
    isStandard: "IS 3696",
    typicalControlsSuggested: [
      { hierarchy: "ELIMINATION", description: "Perform work at ground level (pre-fab)" },
      { hierarchy: "ENGINEERING", description: "Guard rails / scaffolding" },
      { hierarchy: "PPE", description: "Full body harness with shock absorber" }
    ]},
  { code: "HEIGHT_LADDER_MISUSE", category: "height", subcategory: "ladder", name: "Improper ladder use",
    description: "Use of damaged, unsuitable, or unsecured ladders.",
    typicalHarmPotential: ["fracture", "head_injury"],
    typicalAffectedPersons: ["worker_at_height"],
    energyForm: "gravitational",
    typicalControlsSuggested: [
      { hierarchy: "ADMINISTRATIVE", description: "Pre-use ladder inspection" }
    ]},
  { code: "CONFINED_OXYGEN_DEFICIENCY", category: "confined_space", subcategory: "atmosphere", name: "Oxygen-deficient atmosphere in confined space",
    description: "Oxygen below 19.5% in a confined space — silo, vessel, sewer, pit.",
    typicalHarmPotential: ["asphyxiation", "fatality"],
    typicalAffectedPersons: ["confined_space_entrant", "rescuer"],
    energyForm: "chemical",
    factoriesActSection: "Section 36A",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Forced ventilation before and during entry" },
      { hierarchy: "ADMINISTRATIVE", description: "Confined space permit + continuous gas monitoring" }
    ]},
  // Noise + thermal + radiation (4)
  { code: "NOISE_HIGH_EXPOSURE", category: "noise", subcategory: "occupational", name: "Noise above 85 dB(A) 8-hour TWA",
    description: "Sustained occupational noise exposure above PEL.",
    typicalHarmPotential: ["hearing_loss"],
    typicalAffectedPersons: ["operator", "maintenance"],
    energyForm: "acoustic",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Acoustic enclosure / silencer" },
      { hierarchy: "PPE", description: "Hearing protection with NRR matched to exposure" }
    ]},
  { code: "THERMAL_HOT_SURFACE", category: "thermal", subcategory: "hot", name: "Contact with hot surface (> 60°C)",
    description: "Skin contact with steam pipes, fusing-machine plates, steam-press / ironing surfaces.",
    typicalHarmPotential: ["burn_thermal"],
    typicalAffectedPersons: ["operator", "maintenance"],
    energyForm: "thermal",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Insulation / heat shields" },
      { hierarchy: "PPE", description: "Heat-resistant gloves and clothing" }
    ]},
  { code: "RADIATION_NDT_GAMMA", category: "radiation", subcategory: "ionising", name: "Ionising radiation during NDT (gamma source)",
    description: "Exposure to gamma rays from radiography source.",
    typicalHarmPotential: ["acute_radiation_syndrome", "cancer_long_term"],
    typicalAffectedPersons: ["radiographer", "bystander"],
    energyForm: "radiation_ionising",
    isStandard: "AERB Safety Code",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Shielded radiography pit" },
      { hierarchy: "ADMINISTRATIVE", description: "Cordon at calculated dose rate boundary" }
    ]},
  { code: "BIO_INFECTIOUS_AGENT", category: "biological", subcategory: "infectious", name: "Exposure to infectious biological agent",
    description: "Contact with bacteria, viruses, or other pathogens during waste handling or medical response.",
    typicalHarmPotential: ["infection", "chronic_illness"],
    typicalAffectedPersons: ["first_aider", "waste_handler"],
    energyForm: "biological",
    typicalControlsSuggested: [
      { hierarchy: "ADMINISTRATIVE", description: "Vaccination programme" },
      { hierarchy: "PPE", description: "Disposable gloves, gowns, face shield" }
    ]},

  // Mechanical — additions
  { code: "MECH_PINCH_POINT", category: "mechanical", subcategory: "pinch_point", name: "Pinch point between moving and stationary parts",
    description: "Fingers, hand, or limb caught between a moving part (conveyor, press, gate) and a fixed structure.",
    typicalHarmPotential: ["crush_injury", "amputation", "laceration"],
    typicalAffectedPersons: ["operator", "maintenance"],
    energyForm: "mechanical_translational",
    factoriesActSection: "Section 21",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Pinch-point guards / mesh shields" },
      { hierarchy: "ADMINISTRATIVE", description: "Two-handed operation control on presses" }
    ]},
  { code: "MECH_SHARP_EDGE", category: "mechanical", subcategory: "cut_laceration", name: "Sharp edge / cutting surface",
    description: "Exposure to knives, blades, sheet-metal edges, or broken glass during normal task.",
    typicalHarmPotential: ["laceration", "amputation"],
    typicalAffectedPersons: ["operator", "warehouse_worker"],
    energyForm: "mechanical_translational",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Blade guards / sheath when not in use" },
      { hierarchy: "PPE", description: "Cut-resistant gloves (rated ANSI A4+)" }
    ]},
  { code: "MECH_PROJECTILE", category: "mechanical", subcategory: "projectile", name: "Flying projectile from grinding / abrasive blasting",
    description: "Particles, sparks, or fragments ejected at high velocity during grinding, chipping, or abrasive blasting.",
    typicalHarmPotential: ["eye_injury", "laceration", "burn_thermal"],
    typicalAffectedPersons: ["operator", "bystander"],
    energyForm: "kinetic",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Local exhaust + ventilated booth for blasting" },
      { hierarchy: "PPE", description: "Safety goggles + face shield + leather apron" }
    ]},
  { code: "MECH_VIBRATION", category: "mechanical", subcategory: "vibration", name: "Hand-arm or whole-body vibration",
    description: "Sustained exposure to vibration from hand tools (jackhammers, grinders) or vehicles.",
    typicalHarmPotential: ["musculoskeletal_injury", "hand_arm_vibration_syndrome", "back_injury"],
    typicalAffectedPersons: ["operator", "driver"],
    energyForm: "mechanical_vibration",
    isStandard: "ISO 5349 / ISO 2631",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Anti-vibration tool handles / vehicle suspension upgrade" },
      { hierarchy: "ADMINISTRATIVE", description: "Job rotation; daily exposure-time limits" }
    ]},

  // Electrical — additions
  { code: "ELEC_HV_LIVE", category: "electrical", subcategory: "high_voltage", name: "Contact with live HV (> 1 kV) parts",
    description: "Direct contact or flashover from HV equipment, lines, or busbars.",
    typicalHarmPotential: ["electrocution", "burn", "fatality"],
    typicalAffectedPersons: ["electrician", "linesman"],
    energyForm: "electrical_high_voltage",
    factoriesActSection: "Section 36",
    isStandard: "IS 5216",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Earthing and short-circuiting before work" },
      { hierarchy: "ADMINISTRATIVE", description: "HV Permit + competent person supervision" }
    ]},
  { code: "ELEC_OVERLOAD_FIRE", category: "electrical", subcategory: "fire", name: "Electrical fire from overload or short circuit",
    description: "Overloaded cables, faulty connections, or short circuits causing fire in distribution panels or equipment.",
    typicalHarmPotential: ["burn", "fatality", "property_damage"],
    typicalAffectedPersons: ["operator", "occupants"],
    energyForm: "electrical_low_voltage",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Properly rated MCB/RCD protection" },
      { hierarchy: "ADMINISTRATIVE", description: "Thermographic survey of panels half-yearly" }
    ]},

  // Chemical — additions
  { code: "CHEM_OXIDISER_REACTIVE", category: "chemical", subcategory: "oxidiser", name: "Reactive / incompatible chemical contact",
    description: "Inadvertent mixing of incompatible chemicals (acid + base, oxidiser + organic) causing violent reaction.",
    typicalHarmPotential: ["burn_chemical", "blast_injury", "toxic_release"],
    typicalAffectedPersons: ["operator", "warehouse_worker"],
    energyForm: "chemical",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Segregated storage by hazard class" },
      { hierarchy: "ADMINISTRATIVE", description: "Compatibility matrix in stores; SDS review before issue" }
    ]},
  { code: "CHEM_PRESSURISED_GAS", category: "chemical", subcategory: "pressurised_gas", name: "Pressurised gas cylinder failure",
    description: "Sudden failure of compressed gas cylinder valve, regulator, or vessel.",
    typicalHarmPotential: ["blast_injury", "asphyxiation", "fatality"],
    typicalAffectedPersons: ["operator", "occupants"],
    energyForm: "pressure_pneumatic",
    isStandard: "IS 3196 / IS 7311",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Cylinder chains and secured upright storage" },
      { hierarchy: "ADMINISTRATIVE", description: "Cylinder hydrostatic test record review on receipt" }
    ]},
  { code: "CHEM_CARCINOGEN_EXPOSURE", category: "chemical", subcategory: "carcinogen", name: "Exposure to known carcinogen",
    description: "Long-term exposure to IARC Group 1 carcinogens (benzene, asbestos, silica dust, hexavalent chromium).",
    typicalHarmPotential: ["chronic_health_effect", "cancer_long_term"],
    typicalAffectedPersons: ["operator", "maintenance"],
    energyForm: "chemical",
    typicalControlsSuggested: [
      { hierarchy: "ELIMINATION", description: "Substitute non-carcinogenic alternative where available" },
      { hierarchy: "ENGINEERING", description: "Closed handling system + LEV at point of generation" },
      { hierarchy: "ADMINISTRATIVE", description: "Annual occupational health surveillance" }
    ]},

  // Fire / explosion — additions
  { code: "FIRE_LPG_LEAK", category: "fire_explosion", subcategory: "flammable_gas", name: "LPG / fuel gas leak",
    description: "Leak of LPG, natural gas, or process fuel gas from piping, valve, or storage tank.",
    typicalHarmPotential: ["burn", "blast_injury", "fatality"],
    typicalAffectedPersons: ["operator", "emergency_responders", "public"],
    energyForm: "chemical",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Gas detection with auto-shutoff valve" },
      { hierarchy: "ADMINISTRATIVE", description: "Monthly leak test of gas piping" }
    ]},
  { code: "FIRE_MOLTEN_METAL", category: "fire_explosion", subcategory: "molten_metal", name: "Fabric / lint flash fire on the production floor (high fire load)",
    description: "Rapid flame spread through accumulated cotton lint, stacked fabric rolls, and finished-garment stock when ignited by a spark, hot iron, or electrical fault on the sewing / finishing floor.",
    typicalHarmPotential: ["burn_thermal", "fatality"],
    typicalAffectedPersons: ["operator", "bystander"],
    energyForm: "thermal",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Automatic sprinklers over the production floor + lint extraction at machines" },
      { hierarchy: "PPE", description: "Aluminised heat-resistant suit + visor" }
    ]},

  // Physical (struck-by, slip/trip)
  { code: "PHYS_SLIP_TRIP", category: "physical", subcategory: "slip_trip", name: "Slip / trip / fall on same level",
    description: "Wet floors, uneven surfaces, trailing cables, poor housekeeping causing slips/trips/falls.",
    typicalHarmPotential: ["fracture", "sprain", "head_injury"],
    typicalAffectedPersons: ["all"],
    energyForm: "gravitational",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Anti-slip flooring; cable trays" },
      { hierarchy: "ADMINISTRATIVE", description: "Housekeeping inspection rounds" }
    ]},
  { code: "PHYS_STRUCK_BY_FALLING", category: "physical", subcategory: "struck_by", name: "Struck by falling object during overhead work",
    description: "Tools, material, or debris falling from above onto workers below.",
    typicalHarmPotential: ["fracture", "head_injury", "fatality"],
    typicalAffectedPersons: ["worker_below", "bystander"],
    energyForm: "gravitational",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Toe boards + debris netting + exclusion zone" },
      { hierarchy: "PPE", description: "Hard hat" }
    ]},
  { code: "PHYS_STRUCK_AGAINST", category: "physical", subcategory: "struck_against", name: "Struck against fixed structure",
    description: "Worker walks into low-hanging pipe, sharp corner, or protruding equipment.",
    typicalHarmPotential: ["head_injury", "laceration", "bruise"],
    typicalAffectedPersons: ["all"],
    energyForm: "kinetic",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Mark low clearances with hi-vis padding" }
    ]},

  // Ergonomic
  { code: "ERGO_REPETITIVE_STRAIN", category: "ergonomic", subcategory: "repetitive_motion", name: "Repetitive motion strain",
    description: "Sustained repetitive movements (assembly line, data entry) causing RSI.",
    typicalHarmPotential: ["musculoskeletal_injury", "chronic_health_effect"],
    typicalAffectedPersons: ["operator", "office_worker"],
    energyForm: "ergonomic",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Workstation ergonomic redesign" },
      { hierarchy: "ADMINISTRATIVE", description: "Job rotation + scheduled micro-breaks" }
    ]},
  { code: "ERGO_AWKWARD_POSTURE", category: "ergonomic", subcategory: "posture", name: "Awkward / static posture",
    description: "Sustained awkward postures (overhead reach, deep bend, twist) during routine work.",
    typicalHarmPotential: ["musculoskeletal_injury", "back_injury"],
    typicalAffectedPersons: ["operator", "maintenance"],
    energyForm: "ergonomic",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Adjustable-height work surfaces" },
      { hierarchy: "ADMINISTRATIVE", description: "Posture-awareness training" }
    ]},

  // Psychosocial
  { code: "PSYCH_WORKLOAD", category: "psychosocial", subcategory: "workload", name: "Excessive workload / time pressure",
    description: "Persistent high workload, unrealistic deadlines, or chronic understaffing.",
    typicalHarmPotential: ["chronic_health_effect", "burnout", "human_error"],
    typicalAffectedPersons: ["all"],
    energyForm: "psychosocial",
    typicalControlsSuggested: [
      { hierarchy: "ADMINISTRATIVE", description: "Workload assessment; staffing review" }
    ]},
  { code: "PSYCH_HARASSMENT", category: "psychosocial", subcategory: "harassment", name: "Harassment / bullying in the workplace",
    description: "Verbal, physical, or sexual harassment between colleagues, supervisors, or contractors.",
    typicalHarmPotential: ["chronic_health_effect", "mental_health"],
    typicalAffectedPersons: ["all"],
    energyForm: "psychosocial",
    typicalControlsSuggested: [
      { hierarchy: "ADMINISTRATIVE", description: "POSH committee; complaint and investigation procedure" }
    ]},
  { code: "PSYCH_FATIGUE", category: "psychosocial", subcategory: "fatigue", name: "Fatigue from shift work or long hours",
    description: "Reduced alertness from rotating shifts, extended hours, or insufficient rest.",
    typicalHarmPotential: ["human_error", "vehicle_accident"],
    typicalAffectedPersons: ["operator", "driver"],
    energyForm: "psychosocial",
    typicalControlsSuggested: [
      { hierarchy: "ADMINISTRATIVE", description: "Shift roster compliance with Factories Act §54" }
    ]},

  // Environmental
  { code: "ENV_HEAT_STRESS", category: "environmental", subcategory: "heat", name: "Heat stress / heat stroke in hot environment",
    description: "Sustained work in high ambient temperature without adequate hydration or rest.",
    typicalHarmPotential: ["heat_exhaustion", "heat_stroke", "fatality"],
    typicalAffectedPersons: ["operator", "outdoor_worker"],
    energyForm: "thermal",
    isStandard: "IS 7689",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Spot coolers / shade structures" },
      { hierarchy: "ADMINISTRATIVE", description: "Work-rest schedule by WBGT level" }
    ]},
  { code: "ENV_COLD_STRESS", category: "environmental", subcategory: "cold", name: "Cold stress in cold storage / outdoor winter work",
    description: "Frostbite or hypothermia from sustained cold exposure.",
    typicalHarmPotential: ["frostbite", "hypothermia"],
    typicalAffectedPersons: ["cold_storage_worker", "outdoor_worker"],
    energyForm: "thermal",
    typicalControlsSuggested: [
      { hierarchy: "ADMINISTRATIVE", description: "Maximum continuous exposure time policy" },
      { hierarchy: "PPE", description: "Insulated clothing rated for ambient temperature" }
    ]},
  { code: "ENV_POOR_LIGHTING", category: "environmental", subcategory: "lighting", name: "Inadequate lighting",
    description: "Insufficient illuminance causing eye strain or contributing to other hazards.",
    typicalHarmPotential: ["eye_injury", "slip_trip_secondary"],
    typicalAffectedPersons: ["all"],
    energyForm: "non_ionising_radiation",
    isStandard: "IS 3646",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Lux-level survey; supplemental task lighting" }
    ]},
  { code: "ENV_DUST_AIRBORNE", category: "environmental", subcategory: "dust", name: "Airborne respirable dust",
    description: "Respirable dust (cotton dust, fabric lint, fibre fly) exceeding occupational exposure limits.",
    typicalHarmPotential: ["respiratory_illness", "silicosis", "pneumoconiosis"],
    typicalAffectedPersons: ["operator", "maintenance"],
    energyForm: "chemical",
    isStandard: "IS 17041",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Wet suppression at source; bag filters on dust collector" },
      { hierarchy: "PPE", description: "P3 / N95 respirator depending on dust type" }
    ]},

  // Pressure
  { code: "PRESS_VESSEL_RUPTURE", category: "pressure", subcategory: "pressure_vessel", name: "Pressure vessel rupture",
    description: "Catastrophic failure of pressurised vessel (boiler, autoclave, storage tank).",
    typicalHarmPotential: ["blast_injury", "burn", "fatality"],
    typicalAffectedPersons: ["operator", "occupants"],
    energyForm: "pressure_pneumatic",
    factoriesActSection: "Section 31",
    isStandard: "IBR / IS 2825",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Safety valves rated for full design discharge" },
      { hierarchy: "ADMINISTRATIVE", description: "Statutory hydrostatic test / fitness certificate" }
    ]},
  { code: "PRESS_HYDRAULIC_INJECTION", category: "pressure", subcategory: "hydraulic", name: "Hydraulic fluid injection injury",
    description: "Pinhole leak from high-pressure hydraulic line causing fluid injection under skin.",
    typicalHarmPotential: ["compartment_syndrome", "amputation"],
    typicalAffectedPersons: ["maintenance", "operator"],
    energyForm: "pressure_hydraulic",
    typicalControlsSuggested: [
      { hierarchy: "ADMINISTRATIVE", description: "Leak inspection with cardboard, never bare hand" }
    ]},

  // Height — additions
  { code: "HEIGHT_FRAGILE_ROOF", category: "height", subcategory: "fragile_roof", name: "Fall through fragile roof",
    description: "Worker steps on or falls through asbestos / GI sheet roof.",
    typicalHarmPotential: ["fatality", "fracture"],
    typicalAffectedPersons: ["maintenance", "contractor"],
    energyForm: "gravitational",
    factoriesActSection: "Section 33C",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Roof ladders / crawl boards" },
      { hierarchy: "ADMINISTRATIVE", description: "Roof Work Permit + safety net below" }
    ]},
  { code: "HEIGHT_SCAFFOLD_COLLAPSE", category: "height", subcategory: "scaffold", name: "Scaffold collapse / instability",
    description: "Improperly erected, unbraced, or overloaded scaffold collapsing under load.",
    typicalHarmPotential: ["fracture", "fatality"],
    typicalAffectedPersons: ["scaffold_user", "worker_below"],
    energyForm: "gravitational",
    isStandard: "IS 3696",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Erected per IS 3696 by competent scaffolder" },
      { hierarchy: "ADMINISTRATIVE", description: "Scaff-tag inspection (green/red) before every shift" }
    ]},

  // Transportation
  { code: "TRANSPORT_VEHICLE_COLLISION", category: "transportation", subcategory: "road", name: "Road traffic collision on plant access roads",
    description: "Collision between two vehicles or vehicle-pedestrian on internal plant roads.",
    typicalHarmPotential: ["fracture", "head_injury", "fatality"],
    typicalAffectedPersons: ["driver", "pedestrian"],
    energyForm: "kinetic",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Speed humps, mirrors at blind corners" },
      { hierarchy: "ADMINISTRATIVE", description: "Driving licence verification + plant speed limit policy" }
    ]},
  { code: "TRANSPORT_RAIL", category: "transportation", subcategory: "rail", name: "Rail siding / shunting operations",
    description: "Pedestrian-train collision or crush during shunting in plant rail siding.",
    typicalHarmPotential: ["fracture", "amputation", "fatality"],
    typicalAffectedPersons: ["shunter", "bystander"],
    energyForm: "kinetic",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Derailers / track-locking devices during loading" },
      { hierarchy: "ADMINISTRATIVE", description: "Train movement permit + radio communication" }
    ]},

  // Noise + thermal — additions
  { code: "NOISE_IMPULSE", category: "noise", subcategory: "impulse", name: "Impulse / impact noise above 140 dB peak",
    description: "Sudden high-intensity noise from drop hammers, explosive activities, or pressure release.",
    typicalHarmPotential: ["hearing_loss", "tinnitus"],
    typicalAffectedPersons: ["operator", "bystander"],
    energyForm: "acoustic",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Silencer on pressure release points" },
      { hierarchy: "PPE", description: "Double hearing protection (plugs + muffs)" }
    ]},
  { code: "THERMAL_STEAM_BURN", category: "thermal", subcategory: "steam", name: "Steam burn from pipe failure",
    description: "Skin contact with escaping steam or hot water from pipe / flange failure.",
    typicalHarmPotential: ["burn_thermal"],
    typicalAffectedPersons: ["operator", "maintenance"],
    energyForm: "thermal",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Steam line insulation" },
      { hierarchy: "ADMINISTRATIVE", description: "Steam line maintenance schedule" }
    ]},

  // Confined space — additions
  { code: "CONFINED_TOXIC_ATMOSPHERE", category: "confined_space", subcategory: "atmosphere_toxic", name: "Toxic atmosphere in confined space",
    description: "H2S, CO, or solvent vapours in a confined space above IDLH levels.",
    typicalHarmPotential: ["poisoning", "asphyxiation", "fatality"],
    typicalAffectedPersons: ["confined_space_entrant", "rescuer"],
    energyForm: "chemical",
    factoriesActSection: "Section 36",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Pre-entry purge + continuous monitoring" },
      { hierarchy: "ADMINISTRATIVE", description: "Confined Space Permit with rescue plan" },
      { hierarchy: "PPE", description: "SCBA / supplied-air respirator for IDLH atmosphere" }
    ]},
  { code: "CONFINED_ENTRAPMENT", category: "confined_space", subcategory: "engulfment", name: "Engulfment in flowing material (grain, sand, slurry)",
    description: "Worker engulfed in flowing or shifting material in a silo, hopper, or bunker.",
    typicalHarmPotential: ["asphyxiation", "crush_injury", "fatality"],
    typicalAffectedPersons: ["confined_space_entrant"],
    energyForm: "gravitational",
    typicalControlsSuggested: [
      { hierarchy: "ELIMINATION", description: "Remote dislodging from outside the bin" },
      { hierarchy: "ADMINISTRATIVE", description: "Energy-isolate flow paths + lifeline + observer" }
    ]},

  // Behavioral
  { code: "BEHAV_SHORTCUTS", category: "behavioral", subcategory: "shortcuts", name: "Procedure deviation / shortcuts under time pressure",
    description: "Worker skips or shortens documented procedure to save time, defeating control reliance.",
    typicalHarmPotential: ["human_error", "any_downstream_consequence"],
    typicalAffectedPersons: ["all"],
    energyForm: "behavioral",
    typicalControlsSuggested: [
      { hierarchy: "ADMINISTRATIVE", description: "BBS observation programme; rewards for compliance" }
    ]},
  { code: "BEHAV_PPE_NONCOMPLIANCE", category: "behavioral", subcategory: "ppe", name: "PPE non-compliance (not worn / worn incorrectly)",
    description: "Required PPE is not worn, not the correct type, or not worn correctly.",
    typicalHarmPotential: ["any_relevant_to_hazard"],
    typicalAffectedPersons: ["all"],
    energyForm: "behavioral",
    typicalControlsSuggested: [
      { hierarchy: "ADMINISTRATIVE", description: "PPE compliance audit + disciplinary action policy" }
    ]},

  // Radiation — additions
  { code: "RADIATION_LASER", category: "radiation", subcategory: "non_ionising", name: "Laser beam eye / skin exposure",
    description: "Direct or reflected laser beam exposure during alignment, welding, or marking.",
    typicalHarmPotential: ["eye_injury", "burn_thermal"],
    typicalAffectedPersons: ["operator", "bystander"],
    energyForm: "radiation_non_ionising",
    isStandard: "IS 14624",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Laser-rated curtains around work area" },
      { hierarchy: "PPE", description: "Laser-rated goggles matched to wavelength + power" }
    ]},
  { code: "RADIATION_UV", category: "radiation", subcategory: "uv", name: "UV exposure from welding arc",
    description: "Direct or reflected UV radiation from arc welding causing arc eye / skin burn.",
    typicalHarmPotential: ["eye_injury", "burn_thermal"],
    typicalAffectedPersons: ["welder", "bystander"],
    energyForm: "radiation_non_ionising",
    typicalControlsSuggested: [
      { hierarchy: "ENGINEERING", description: "Welding screens around work area" },
      { hierarchy: "PPE", description: "Welding helmet with shade-matched filter" }
    ]},

  // ── Page Industries cross-industry set (File 2) — 90 hazards, sector-neutral ──

  // Confined Space (File 2.1)
  { code: "CS-001", category: "confined_space", subcategory: "atmosphere", name: "Oxygen deficiency in confined space",
    description: "Oxygen concentration below 19.5% in a confined space due to displacement, consumption, or chemical reaction.",
    typicalHarmPotential: ["asphyxiation", "fatality"], typicalAffectedPersons: ["confined_space_entrant", "rescuer"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Confined space permit + atmospheric test before entry" }, { hierarchy: "PPE", description: "SCBA where O2 cannot be maintained above 19.5%" }] },
  { code: "CS-002", category: "confined_space", subcategory: "atmosphere_toxic", name: "Toxic gas accumulation (H2S, CO, SO2, NH3) in confined space",
    description: "Accumulation of toxic gases from process residues, microbial activity, or adjacent pipework.",
    typicalHarmPotential: ["poisoning", "fatality"], typicalAffectedPersons: ["confined_space_entrant", "rescuer"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Pre-entry purge and continuous 4-gas monitoring" }, { hierarchy: "PPE", description: "SCBA / supplied-air respirator" }] },
  { code: "CS-003", category: "confined_space", subcategory: "atmosphere_flammable", name: "Flammable gas or vapour accumulation in confined space",
    description: "Vapour concentration between LEL and UEL creating explosion risk inside the confined space.",
    typicalHarmPotential: ["explosion", "fatality"], typicalAffectedPersons: ["confined_space_entrant"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Forced ventilation to below 10% LEL before entry" }, { hierarchy: "ADMINISTRATIVE", description: "No ignition sources; continuous LEL monitoring" }] },
  { code: "CS-004", category: "confined_space", subcategory: "engulfment_liquid", name: "Flooding / engulfment — liquid ingress to confined space",
    description: "Uncontrolled liquid ingress from connected pipework, process upset, or rainfall.",
    typicalHarmPotential: ["drowning", "fatality"], typicalAffectedPersons: ["confined_space_entrant"], energyForm: "hydraulic",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Isolate and blank all connected lines before entry" }] },
  { code: "CS-005", category: "confined_space", subcategory: "engulfment", name: "Entrapment / engulfment — solid material collapse",
    description: "Collapse of stored solid material (powder, granules) onto entrant in silo or hopper.",
    typicalHarmPotential: ["crush_injury", "asphyxiation", "fatality"], typicalAffectedPersons: ["confined_space_entrant"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ELIMINATION", description: "Remote dislodging from outside" }, { hierarchy: "ADMINISTRATIVE", description: "Bin entry only with permit + lifeline + observer" }] },
  { code: "CS-006", category: "confined_space", subcategory: "thermal", name: "Thermal extremes — hot surfaces or steam in confined space",
    description: "Residual heat from process operations causing burns or heat stress inside confined space.",
    typicalHarmPotential: ["burn_thermal", "heat_stroke"], typicalAffectedPersons: ["confined_space_entrant"], energyForm: "thermal",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Cool-down period and temperature check before entry" }] },
  { code: "CS-007", category: "confined_space", subcategory: "mechanical", name: "Mechanical hazard — rotating or moving parts inside confined space",
    description: "Agitators, scrapers, or conveyors inside the space creating entanglement risk.",
    typicalHarmPotential: ["entanglement", "fatality"], typicalAffectedPersons: ["confined_space_entrant"], energyForm: "mechanical_rotational",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "LOTO all drives before entry" }] },
  { code: "CS-008", category: "confined_space", subcategory: "communication", name: "Inadequate communication between entrant and attendant",
    description: "Loss of contact between entrant and standby attendant delaying rescue.",
    typicalHarmPotential: ["fatality_delayed_rescue"], typicalAffectedPersons: ["confined_space_entrant"], energyForm: "procedural",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Dedicated attendant + agreed check-in intervals + rescue signal" }] },
  { code: "CS-009", category: "confined_space", subcategory: "rescue", name: "Rescue capability inadequate for confined space emergency",
    description: "No trained rescuers or equipment available when an entrant becomes incapacitated.",
    typicalHarmPotential: ["fatality_rescue_failure"], typicalAffectedPersons: ["confined_space_entrant"], energyForm: "procedural",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Non-entry rescue plan verified before permit issue" }] },
  { code: "CS-010", category: "confined_space", subcategory: "pressure", name: "Unexpected pressurisation of confined space",
    description: "Sudden positive or negative pressure from connected process or utility lines.",
    typicalHarmPotential: ["blast_injury", "fatality"], typicalAffectedPersons: ["confined_space_entrant"], energyForm: "pressure_pneumatic",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Positive isolation (blank/spade) of all pressure lines" }] },
  { code: "CS-011", category: "confined_space", subcategory: "slip_trip", name: "Slips and falls within confined space (wet, limited visibility)",
    description: "Wet or slippery surfaces and poor lighting inside confined space causing slips and falls.",
    typicalHarmPotential: ["fracture", "head_injury"], typicalAffectedPersons: ["confined_space_entrant"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Portable task lighting rated for confined space" }] },
  { code: "CS-012", category: "confined_space", subcategory: "explosion", name: "Dust explosion risk in enclosed vessels or hoppers",
    description: "Combustible dust accumulated inside vessel ignited by spark, friction, or static.",
    typicalHarmPotential: ["explosion", "fatality"], typicalAffectedPersons: ["confined_space_entrant", "bystander"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Wet suppression or purge before entry; no ignition sources" }] },
  { code: "CS-013", category: "confined_space", subcategory: "energy_isolation", name: "Inadequate isolation — unexpected energy introduction",
    description: "Energy re-introduced to connected equipment while workers are inside confined space.",
    typicalHarmPotential: ["fatality"], typicalAffectedPersons: ["confined_space_entrant"], energyForm: "multiple",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Group LOTO with personal locks; verify isolation before entry" }] },
  { code: "CS-014", category: "confined_space", subcategory: "equipment_failure", name: "SCBA failure during confined space entry",
    description: "Self-contained breathing apparatus malfunction while in IDLH atmosphere.",
    typicalHarmPotential: ["asphyxiation", "fatality"], typicalAffectedPersons: ["confined_space_entrant"], energyForm: "equipment_failure",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Pre-entry SCBA check; spare set outside; buddy system" }] },
  { code: "CS-015", category: "confined_space", subcategory: "human_factors", name: "Multiple entrant fatigue / disorientation in long entries",
    description: "Physical and cognitive impairment from heat, exertion, or duration inside confined space.",
    typicalHarmPotential: ["human_error", "collapse"], typicalAffectedPersons: ["confined_space_entrant"], energyForm: "physiological",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Maximum entry duration; mandatory rest breaks; work-rest cycle" }] },

  // Electrical (File 2.2)
  { code: "ELEC-001", category: "electrical", subcategory: "low_voltage", name: "Electric shock — direct contact with live conductor",
    description: "Direct contact with uninsulated live conductors during electrical work or accidental access.",
    typicalHarmPotential: ["electrocution", "burn", "fatality"], typicalAffectedPersons: ["electrician", "maintenance"], energyForm: "electrical_low_voltage",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Permit to Work + verified isolation before touching" }, { hierarchy: "PPE", description: "Insulated gloves and tools" }] },
  { code: "ELEC-002", category: "electrical", subcategory: "earth_fault", name: "Electric shock — indirect contact / earth fault",
    description: "Metallic enclosure becomes live due to insulation failure and earth fault.",
    typicalHarmPotential: ["electrocution", "burn"], typicalAffectedPersons: ["all"], energyForm: "electrical_low_voltage",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "RCD/ELCB protection on all circuits; regular earth continuity checks" }] },
  { code: "ELEC-003", category: "electrical", subcategory: "arc_flash", name: "Arc flash — high-energy electrical arc during switching",
    description: "Arc flash from HV/LV switchgear during racking in/out or fault condition.",
    typicalHarmPotential: ["burn", "blast_injury", "fatality"], typicalAffectedPersons: ["electrician", "maintenance"], energyForm: "electrical_high_voltage",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Arc-rated switchgear with remote racking" }, { hierarchy: "PPE", description: "Arc flash PPE per incident energy level" }] },
  { code: "ELEC-004", category: "electrical", subcategory: "fire", name: "Electrical fire — overloaded circuit or insulation failure",
    description: "Cable overloading or damaged insulation causing fire in switchgear or cable tray.",
    typicalHarmPotential: ["burn", "property_damage"], typicalAffectedPersons: ["operator", "occupants"], energyForm: "electrical_low_voltage",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Properly rated MCBs; thermographic survey of panels" }] },
  { code: "ELEC-005", category: "electrical", subcategory: "stored_energy", name: "Stored energy release — capacitor discharge or residual charge",
    description: "Residual electrical charge on capacitor banks or large drives discharging during maintenance.",
    typicalHarmPotential: ["electrocution", "burn"], typicalAffectedPersons: ["electrician", "maintenance"], energyForm: "electrical_stored",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Wait discharge time per OEM SOP; verify zero energy with meter" }] },
  { code: "ELEC-006", category: "electrical", subcategory: "loto_failure", name: "Lockout/Tagout failure — unexpected re-energisation",
    description: "Electrical equipment inadvertently re-energised while work is in progress.",
    typicalHarmPotential: ["electrocution", "fatality"], typicalAffectedPersons: ["electrician", "maintenance"], energyForm: "electrical_low_voltage",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Personal lock-out with individual verification of isolation" }] },
  { code: "ELEC-007", category: "electrical", subcategory: "step_touch", name: "Step and touch potential — substation fault",
    description: "Ground fault in substation creating dangerous voltage gradients in surrounding soil.",
    typicalHarmPotential: ["electrocution", "fatality"], typicalAffectedPersons: ["bystander", "electrician"], energyForm: "electrical_high_voltage",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Equipotential bonding grid in substation; crushed stone surface" }] },
  { code: "ELEC-008", category: "electrical", subcategory: "temporary_installation", name: "Temporary electrical installation failure — overloading or damage",
    description: "Overloaded or damaged temporary power leads and distribution boards on project sites.",
    typicalHarmPotential: ["electrocution", "fire"], typicalAffectedPersons: ["contractor", "project_worker"], energyForm: "electrical_low_voltage",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Temporary electrical inspection before each shift" }] },
  { code: "ELEC-009", category: "electrical", subcategory: "wet_conditions", name: "Wet conditions near electrical installations",
    description: "Water ingress to electrical enclosures or use of electrical equipment in wet conditions.",
    typicalHarmPotential: ["electrocution", "burn"], typicalAffectedPersons: ["operator", "electrician"], energyForm: "electrical_low_voltage",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "IP65+ rated enclosures in wet areas; GFCI protection" }] },
  { code: "ELEC-010", category: "electrical", subcategory: "earthing", name: "Inadequate earthing — induced voltage on plant",
    description: "Floating metalwork accumulating induced voltages from nearby HV equipment.",
    typicalHarmPotential: ["electrocution"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "electrical_induced",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Annual earth resistance test; verify bonding continuity" }] },
  { code: "ELEC-011", category: "electrical", subcategory: "overhead_line", name: "Overhead line contact during lifting or vehicle movement",
    description: "Crane boom, excavator arm, or scaffold pole contacting overhead lines.",
    typicalHarmPotential: ["electrocution", "fatality"], typicalAffectedPersons: ["crane_operator", "driver", "rigger"], energyForm: "electrical_high_voltage",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Goalposts and barriers at safe clearance distance" }, { hierarchy: "ADMINISTRATIVE", description: "Exclusion zone = 3 m + 1 m per 100 kV" }] },
  { code: "ELEC-012", category: "electrical", subcategory: "underground_cable", name: "HT cable damage during excavation or civil work",
    description: "Underground HT cable struck by excavator or hand tool during civil work.",
    typicalHarmPotential: ["electrocution", "blast_injury", "fatality"], typicalAffectedPersons: ["excavator_operator", "civil_worker"], energyForm: "electrical_high_voltage",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Cable-detection survey before excavation; hand-dig within 500 mm" }] },

  // Hot Work (File 2.3)
  { code: "HW-001", category: "fire_explosion", subcategory: "hot_work", name: "Fire from hot work — ignition of nearby combustibles",
    description: "Hot work sparks or spatter contacting combustible materials within or outside the work zone.",
    typicalHarmPotential: ["burn", "structural_fire"], typicalAffectedPersons: ["welder", "fire_watch", "occupants"], energyForm: "thermal",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Hot work permit; remove or shield combustibles within 11 m" }, { hierarchy: "ADMINISTRATIVE", description: "Fire watch during and 30 min after work" }] },
  { code: "HW-002", category: "fire_explosion", subcategory: "hot_work_explosion", name: "Explosion — hot work in area with flammable atmosphere",
    description: "Ignition of flammable vapour or gas by hot work in inadequately tested area.",
    typicalHarmPotential: ["explosion", "fatality"], typicalAffectedPersons: ["welder", "bystander"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Atmospheric gas test before every hot work permit issue" }] },
  { code: "HW-003", category: "thermal", subcategory: "welding_burn", name: "Burn injury from welding / cutting arc or flame",
    description: "Direct flame or radiant heat from oxy-fuel or arc welding causing skin burns.",
    typicalHarmPotential: ["burn_thermal"], typicalAffectedPersons: ["welder", "bystander"], energyForm: "thermal",
    typicalControlsSuggested: [{ hierarchy: "PPE", description: "Leather gauntlets, FR coveralls, face shield" }] },
  { code: "HW-004", category: "radiation", subcategory: "uv_welding", name: "UV radiation injury to eyes and skin from welding arc",
    description: "Arc eye (photokeratitis) or skin burn from UV radiation during arc welding.",
    typicalHarmPotential: ["eye_injury", "burn_thermal"], typicalAffectedPersons: ["welder", "bystander"], energyForm: "radiation_non_ionising",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Welding screens / curtains" }, { hierarchy: "PPE", description: "Shade-matched auto-darkening helmet" }] },
  { code: "HW-005", category: "chemical", subcategory: "welding_fume", name: "Fume inhalation — welding, brazing, grinding fumes",
    description: "Metallic and flux fumes from welding and grinding causing respiratory and systemic effects.",
    typicalHarmPotential: ["respiratory_illness", "cancer_long_term"], typicalAffectedPersons: ["welder", "grinder"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "LEV at fume source; portable fume extractor in confined areas" }, { hierarchy: "PPE", description: "P3 respirator for fume types above OEL" }] },
  { code: "HW-006", category: "pressure", subcategory: "gas_cylinder", name: "Gas cylinder hazard — physical or thermal damage",
    description: "Compressed gas cylinder knocked over, heated, or physically damaged causing sudden release.",
    typicalHarmPotential: ["blast_injury", "asphyxiation", "fatality"], typicalAffectedPersons: ["welder", "bystander"], energyForm: "pressure_pneumatic",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Cylinder chained upright; flash arrestors on both hoses" }] },
  { code: "HW-007", category: "fire_explosion", subcategory: "spatter", name: "Hot debris and spatter causing delayed ignition",
    description: "Hot spatter penetrating into voids, insulation, or drains causing smouldering fire hours later.",
    typicalHarmPotential: ["structural_fire"], typicalAffectedPersons: ["occupants"], energyForm: "thermal",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Fire watch 30 min post-work; re-inspect at 1 hour" }] },
  { code: "HW-008", category: "fire_explosion", subcategory: "backfire", name: "Oxy-acetylene backfire / flashback",
    description: "Backfire into hose or regulator causing explosive burning back through the equipment.",
    typicalHarmPotential: ["burn", "blast_injury"], typicalAffectedPersons: ["welder"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Flashback arrestors on both oxygen and fuel lines" }] },
  { code: "HW-009", category: "physiological", subcategory: "heat_stress", name: "Heat stress during hot work in confined or outdoor areas",
    description: "Core body temperature rise from radiant heat and exertion in hot environment.",
    typicalHarmPotential: ["heat_exhaustion", "heat_stroke", "fatality"], typicalAffectedPersons: ["welder"], energyForm: "thermal",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Work-rest schedule by WBGT; hydration plan" }] },
  { code: "HW-010", category: "fire_explosion", subcategory: "fire_watch", name: "Fire watch inadequate — post-work smouldering undetected",
    description: "Fire watch leaves before smouldering becomes visible fire, or area not checked after watch.",
    typicalHarmPotential: ["structural_fire", "fatality"], typicalAffectedPersons: ["occupants"], energyForm: "thermal",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Dedicated fire watch 30 min minimum; record closure on permit" }] },

  // Work at Height (File 2.4)
  { code: "WAH-001", category: "height", subcategory: "scaffold_fall", name: "Fall from scaffolding — inadequate erection or inspection",
    description: "Worker falls from scaffold due to missing boards, inadequate guardrails, or uninspected scaffold.",
    typicalHarmPotential: ["fracture", "head_injury", "fatality"], typicalAffectedPersons: ["worker_at_height", "contractor"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Scaffold to IS 3696; green tag after each shift inspection" }] },
  { code: "WAH-002", category: "height", subcategory: "ladder_fall", name: "Fall from ladder — improper use or positioning",
    description: "Use of unsecured, damaged, or incorrectly angled ladder resulting in fall.",
    typicalHarmPotential: ["fracture", "head_injury"], typicalAffectedPersons: ["worker_at_height"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Three-point contact; 75° angle; secured at top and bottom" }] },
  { code: "WAH-003", category: "height", subcategory: "edge_fall", name: "Fall from working at unprotected edge or opening",
    description: "Worker falls through floor opening or over unguarded platform edge.",
    typicalHarmPotential: ["fracture", "fatality"], typicalAffectedPersons: ["worker_at_height", "contractor"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Guardrails top rail 1 m; mid-rail; toe board" }, { hierarchy: "ADMINISTRATIVE", description: "Work at height permit; harness anchor above head" }] },
  { code: "WAH-004", category: "height", subcategory: "dropped_object", name: "Dropped object from height — tool, component, material",
    description: "Tool, bolt, or material dropped from elevated position striking workers below.",
    typicalHarmPotential: ["head_injury", "fatality"], typicalAffectedPersons: ["worker_below", "bystander"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Toe boards; tool tethers; exclusion zone below" }, { hierarchy: "PPE", description: "Hard hat for all persons in vicinity" }] },
  { code: "WAH-005", category: "height", subcategory: "suspension_trauma", name: "Harness arrest — suspension trauma after fall arrest",
    description: "Worker suspended in harness after fall arrest develops orthostatic intolerance (suspension trauma).",
    typicalHarmPotential: ["circulatory_collapse", "fatality"], typicalAffectedPersons: ["worker_at_height"], energyForm: "physiological",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Rescue plan before work starts; relief straps in harness" }] },
  { code: "WAH-006", category: "height", subcategory: "fragile_surface", name: "Roof fragility — inadequate load rating for access",
    description: "Worker or equipment placed on fragile roofing (GI sheet, asbestos, polycarbonate) which fails.",
    typicalHarmPotential: ["fatality", "fracture"], typicalAffectedPersons: ["maintenance", "contractor"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Roof crawl boards or walkways; debris-net below fragile area" }] },
  { code: "WAH-007", category: "height", subcategory: "wind", name: "Wind loading on elevated workers or structures",
    description: "Strong wind destabilising elevated worker, scaffold, or unsecured material.",
    typicalHarmPotential: ["fall", "struck_by_debris"], typicalAffectedPersons: ["worker_at_height"], energyForm: "environmental",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Suspend work at height above Beaufort 5 (38 km/h)" }] },
  { code: "WAH-008", category: "height", subcategory: "mewp", name: "MEWP overloading or operation on uneven ground",
    description: "Mobile Elevated Work Platform tips or collapses due to overloading or ground instability.",
    typicalHarmPotential: ["crush_injury", "fatality"], typicalAffectedPersons: ["mewp_operator"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Ground survey; max rated load; outrigger deployment" }] },
  { code: "WAH-009", category: "height", subcategory: "scaffold_overload", name: "Scaffolding overloading — stacked materials or equipment",
    description: "Scaffolding loaded beyond design capacity causing progressive collapse.",
    typicalHarmPotential: ["fracture", "fatality"], typicalAffectedPersons: ["scaffold_user", "worker_below"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Working load limit posted on scaffold; no material storage beyond" }] },
  { code: "WAH-010", category: "height", subcategory: "lightning", name: "Lightning strike on elevated structure during storm",
    description: "Worker struck directly or indirectly by lightning while working at height.",
    typicalHarmPotential: ["electrocution", "fatality"], typicalAffectedPersons: ["worker_at_height"], energyForm: "electrical_lightning",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Stop elevated work on first thunder; descend and shelter" }] },

  // Mechanical / Process Equipment (File 2.5)
  { code: "MECH-001", category: "mechanical", subcategory: "entanglement", name: "Entanglement in rotating equipment — conveyor, mixer, pump",
    description: "Clothing, hair, or limb caught in unguarded rotating equipment during operation or maintenance.",
    typicalHarmPotential: ["entanglement", "amputation", "fatality"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "mechanical_rotational",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Interlocked guards on all nip and rotating points" }, { hierarchy: "ADMINISTRATIVE", description: "LOTO before any guarding removal" }] },
  { code: "MECH-002", category: "mechanical", subcategory: "nip_point", name: "Nip point injury — belt drive, gear train",
    description: "Fingers or limb drawn into nip point between belt and pulley, or gear mesh.",
    typicalHarmPotential: ["crush_injury", "amputation"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "mechanical_rotational",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Nip-point guards with interlocked access" }] },
  { code: "MECH-003", category: "mechanical", subcategory: "stored_energy", name: "Stored mechanical energy release — spring, compressed component",
    description: "Unexpected release of stored mechanical energy in springs, gas struts, or compressed components.",
    typicalHarmPotential: ["strike_injury", "fracture"], typicalAffectedPersons: ["maintenance"], energyForm: "mechanical_stored",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Identify and control stored energy in pre-task LOTO assessment" }] },
  { code: "MECH-004", category: "pressure", subcategory: "vessel_failure", name: "Pressure vessel / piping failure — overpressure or corrosion",
    description: "Catastrophic failure of pressure vessel, piping, or fitting due to overpressure or corrosion.",
    typicalHarmPotential: ["blast_injury", "burn", "fatality"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "pressure_pneumatic",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Safety valves at design pressure; corrosion monitoring programme" }, { hierarchy: "ADMINISTRATIVE", description: "Statutory IBR/BIS inspection" }] },
  { code: "MECH-005", category: "thermal", subcategory: "steam_release", name: "Steam release — pipe, valve, or fitting failure",
    description: "High-energy steam escaping from failed steam piping, valve packing, or flange.",
    typicalHarmPotential: ["burn_thermal", "fatality"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "thermal",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Insulated and guarded steam lines; condition-based valve inspection" }] },
  { code: "MECH-006", category: "thermal", subcategory: "hot_surface", name: "Contact with hot surfaces — pipework, reactors, dryers, heat exchangers",
    description: "Inadvertent skin contact with uninsulated hot surfaces above 60°C.",
    typicalHarmPotential: ["burn_thermal"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "thermal",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Insulate all surfaces > 60°C or guard with perforated sheet" }] },
  { code: "MECH-007", category: "mechanical", subcategory: "ejected_part", name: "Struck by ejected component — pressure release, mechanical failure",
    description: "Component, fastener, or fragment ejected at high velocity during failure or maintenance.",
    typicalHarmPotential: ["laceration", "fracture", "fatality"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "kinetic",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Pressure bleed-down before opening; use correct tooling" }] },
  { code: "MECH-008", category: "lifting", subcategory: "crane_failure", name: "Crane / lifting equipment failure — dropped load",
    description: "Structural or mechanical failure of crane, hoist, or chain-block causing dropped load.",
    typicalHarmPotential: ["crush_injury", "fatality"], typicalAffectedPersons: ["rigger", "worker_below"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Statutory crane test certificate; pre-lift inspection; exclusion zone" }] },
  { code: "MECH-009", category: "lifting", subcategory: "rigging_failure", name: "Rigging failure — sling, shackle, or attachment point",
    description: "Rigging component failure during lift causing load drop.",
    typicalHarmPotential: ["crush_injury", "fatality"], typicalAffectedPersons: ["rigger", "worker_below"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Pre-use visual inspection of all rigging; reject if damaged" }] },
  { code: "MECH-010", category: "mechanical", subcategory: "uncontrolled_start", name: "Uncontrolled machine start-up during maintenance",
    description: "Machine or equipment unexpectedly starts while maintenance work is in progress.",
    typicalHarmPotential: ["entanglement", "fatality"], typicalAffectedPersons: ["maintenance"], energyForm: "mechanical_rotational",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Group LOTO with personal locks; try-start after isolation" }] },
  { code: "MECH-011", category: "pressure", subcategory: "hydraulic_injection", name: "Hydraulic hose burst — high-pressure injection injury",
    description: "Pinhole in high-pressure hydraulic hose injecting fluid under skin at depth.",
    typicalHarmPotential: ["compartment_syndrome", "amputation"], typicalAffectedPersons: ["maintenance", "operator"], energyForm: "pressure_hydraulic",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Bleed-down pressure before inspection; no bare hand testing" }] },
  { code: "MECH-012", category: "pressure", subcategory: "compressed_air", name: "Compressed air line failure — whipping hose",
    description: "High-pressure air hose disconnecting and whipping, or direct air blast to person.",
    typicalHarmPotential: ["laceration", "air_embolism"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "pressure_pneumatic",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Anti-whip retaining cables on hose couplings" }] },
  { code: "MECH-013", category: "ergonomic", subcategory: "vibration", name: "Vibration — hand-arm or whole-body from equipment",
    description: "Sustained vibration from hand tools or vehicles exceeding daily exposure action value.",
    typicalHarmPotential: ["hand_arm_vibration_syndrome", "musculoskeletal_injury"], typicalAffectedPersons: ["operator", "driver"], energyForm: "mechanical_vibration",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Low-vibration tool selection; anti-vibration mounts on vehicles" }] },
  { code: "MECH-014", category: "noise", subcategory: "occupational_noise", name: "Noise-induced hearing loss from process equipment",
    description: "Chronic exposure to noise levels above 85 dB(A) TWA without adequate hearing protection.",
    typicalHarmPotential: ["hearing_loss"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "acoustic",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Acoustic enclosures or isolating mounts on high-noise equipment" }, { hierarchy: "PPE", description: "Hearing protection with NRR matched to exposure level" }] },
  { code: "MECH-015", category: "pressure", subcategory: "vacuum", name: "Vacuum system failure — implosion or personnel entrapment",
    description: "Implosion of vessel under vacuum or suction entrapping hand/arm at vacuum port.",
    typicalHarmPotential: ["crush_injury", "entrapment"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "pressure_vacuum",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Positive break isolation before entry or port opening" }] },

  // Chemical and Hazardous Substance (File 2.6)
  { code: "CHEM-001", category: "chemical", subcategory: "inhalation", name: "Inhalation of toxic chemical vapour or fume",
    description: "Airborne chemical vapour, mist, or fume exceeding occupational exposure limits.",
    typicalHarmPotential: ["respiratory_illness", "poisoning", "fatality"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Local exhaust ventilation at source" }, { hierarchy: "PPE", description: "Appropriate respiratory protection per SDS" }] },
  { code: "CHEM-002", category: "chemical", subcategory: "skin_corrosive", name: "Skin contact with corrosive chemical — acid or alkali",
    description: "Direct skin contact with strong acid, alkali, or other corrosive causing chemical burn.",
    typicalHarmPotential: ["burn_chemical"], typicalAffectedPersons: ["operator", "lab_technician"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Closed transfer systems; drip trays" }, { hierarchy: "PPE", description: "Chemical-resistant gloves and apron" }] },
  { code: "CHEM-003", category: "chemical", subcategory: "eye_contact", name: "Eye contact with chemical — splash or spray",
    description: "Chemical splash to eyes from open handling, transfer, or equipment failure.",
    typicalHarmPotential: ["eye_injury", "blindness"], typicalAffectedPersons: ["operator", "lab_technician"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Emergency eyewash within 10 seconds travel" }, { hierarchy: "PPE", description: "Chemical splash goggles or face shield" }] },
  { code: "CHEM-004", category: "chemical", subcategory: "ingestion", name: "Ingestion of chemical — poor hygiene or food contamination",
    description: "Inadvertent ingestion of chemical from contaminated hands or surfaces.",
    typicalHarmPotential: ["poisoning", "acute_toxicity"], typicalAffectedPersons: ["operator"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "No eating/drinking in chemical handling areas; handwash before food" }] },
  { code: "CHEM-005", category: "chemical", subcategory: "toxic_gas_cloud", name: "Toxic gas cloud — large-scale release from process or storage",
    description: "Major release of toxic gas creating hazardous cloud affecting large area.",
    typicalHarmPotential: ["mass_casualty", "fatality"], typicalAffectedPersons: ["site_population", "community"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Gas detectors with alarm and automatic isolation" }, { hierarchy: "ADMINISTRATIVE", description: "Emergency response plan; community notification protocol" }] },
  { code: "CHEM-006", category: "fire_explosion", subcategory: "flammable_spill", name: "Flammable liquid spill and ignition",
    description: "Spilled flammable liquid vaporising and contacting ignition source.",
    typicalHarmPotential: ["burn", "blast_injury", "fatality"], typicalAffectedPersons: ["operator", "emergency_responders"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Bunded storage; spill containment; ignition-source control zone" }] },
  { code: "CHEM-007", category: "chemical", subcategory: "reactive", name: "Reactive chemical — incompatible materials coming into contact",
    description: "Accidental mixing of incompatible chemicals causing violent exothermic reaction.",
    typicalHarmPotential: ["burn_chemical", "blast_injury", "toxic_release"], typicalAffectedPersons: ["operator", "warehouse_worker"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Segregated storage by compatibility; secondary containment per class" }] },
  { code: "CHEM-008", category: "health", subcategory: "chronic_exposure", name: "Chronic chemical exposure — long-term health effect",
    description: "Repeated low-level exposure to hazardous chemical over years causing occupational disease.",
    typicalHarmPotential: ["chronic_health_effect", "cancer_long_term"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Engineering controls to keep below OEL; annual health surveillance" }] },
  { code: "CHEM-009", category: "chemical", subcategory: "storage_leak", name: "Chemical storage leak — drum or IBC failure",
    description: "Drum, IBC, or bulk tank failure causing chemical release in storage area.",
    typicalHarmPotential: ["burn_chemical", "toxic_exposure", "environmental_damage"], typicalAffectedPersons: ["warehouse_worker"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Bunded storage; drip pallets under IBCs; weekly inspection" }] },
  { code: "CHEM-010", category: "chemical", subcategory: "transport_spill", name: "Chemical transportation spill — during internal movement",
    description: "Chemical container damage during internal transport by forklift or trolley.",
    typicalHarmPotential: ["burn_chemical", "environmental_damage"], typicalAffectedPersons: ["driver", "bystander"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Containers capped and secured during transport; spill kit on vehicle" }] },
  { code: "CHEM-011", category: "health", subcategory: "respirable_dust", name: "Respirable dust — prolonged inhalation causing occupational disease",
    description: "Long-term inhalation of respirable cotton dust / fabric lint (byssinosis risk) above OEL.",
    typicalHarmPotential: ["pneumoconiosis", "chronic_health_effect"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Wet suppression; LEV; sealed conveyors" }, { hierarchy: "PPE", description: "FFP3/P3 respirator; health surveillance programme" }] },
  { code: "CHEM-012", category: "health", subcategory: "asbestos", name: "Asbestos exposure — legacy insulation or lagging disturbance",
    description: "Asbestos-containing material disturbed during demolition, maintenance, or refurbishment.",
    typicalHarmPotential: ["mesothelioma", "asbestosis"], typicalAffectedPersons: ["maintenance", "contractor"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ELIMINATION", description: "ACM survey before any maintenance; licensed removal contractor" }] },
  { code: "CHEM-013", category: "health", subcategory: "carcinogen", name: "Carcinogen exposure without adequate controls",
    description: "Occupational exposure to IARC Group 1 carcinogen above action value.",
    typicalHarmPotential: ["cancer_long_term"], typicalAffectedPersons: ["operator", "maintenance"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ELIMINATION", description: "Substitute with non-carcinogenic alternative where feasible" }, { hierarchy: "ENGINEERING", description: "Closed system + LEV; annual biological monitoring" }] },
  { code: "CHEM-014", category: "chemical", subcategory: "utility_chemical", name: "Chemical burn from boiler water treatment chemicals",
    description: "Concentrated scale-inhibitor, biocide, or oxygen scavenger contact during dosing.",
    typicalHarmPotential: ["burn_chemical", "eye_injury"], typicalAffectedPersons: ["utility_operator"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Closed dosing system; SDS training; chemical gloves and goggles" }] },
  { code: "CHEM-015", category: "environmental", subcategory: "waste_mishandling", name: "Waste chemical mishandling — incorrect disposal or mixing",
    description: "Waste chemicals mixed or disposed of incorrectly causing secondary hazard or environmental harm.",
    typicalHarmPotential: ["toxic_reaction", "environmental_damage"], typicalAffectedPersons: ["waste_handler"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Waste segregation labelling; approved disposal contractor records" }] },

  // Movement, Transport and Logistics (File 2.7)
  { code: "VEH-001", category: "transportation", subcategory: "forklift_pedestrian", name: "Pedestrian struck by forklift — inadequate segregation",
    description: "Forklift operates in shared space without pedestrian segregation.",
    typicalHarmPotential: ["crush_injury", "fatality"], typicalAffectedPersons: ["pedestrian"], energyForm: "kinetic",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Physical barriers separating pedestrian and forklift paths" }, { hierarchy: "ADMINISTRATIVE", description: "Forklift licence verification; speed limit 10 km/h indoors" }] },
  { code: "VEH-002", category: "transportation", subcategory: "forklift_tip", name: "Forklift overload or tip — unstable load",
    description: "Forklift tips due to overloading, off-centre load, or turning with elevated mast.",
    typicalHarmPotential: ["crush_injury", "fatality"], typicalAffectedPersons: ["forklift_operator", "bystander"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Load within rated capacity; mast lowered when travelling; trained driver" }] },
  { code: "VEH-003", category: "transportation", subcategory: "hgv_pedestrian", name: "Heavy goods vehicle striking pedestrian — dispatch area",
    description: "HGV entering or manoeuvring in loading dock area strikes pedestrian.",
    typicalHarmPotential: ["crush_injury", "fatality"], typicalAffectedPersons: ["pedestrian", "loading_staff"], energyForm: "kinetic",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Traffic management plan; banksman for all HGV movements in yard" }] },
  { code: "VEH-004", category: "transportation", subcategory: "internal_road", name: "Internal road collision — inadequate speed control",
    description: "Vehicle collision on internal plant roads due to excessive speed or blind corners.",
    typicalHarmPotential: ["fracture", "fatality"], typicalAffectedPersons: ["driver", "pedestrian"], energyForm: "kinetic",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Speed humps; convex mirrors at blind corners; clear signage" }] },
  { code: "VEH-005", category: "transportation", subcategory: "reversing", name: "Reversing vehicle — limited visibility striking person",
    description: "Vehicle reversing without adequate visibility or warning system striking person.",
    typicalHarmPotential: ["crush_injury", "fatality"], typicalAffectedPersons: ["pedestrian"], energyForm: "kinetic",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Reversing cameras + audible reversing alarm on all plant vehicles" }] },
  { code: "VEH-006", category: "transportation", subcategory: "falling_load", name: "Load falling from transport vehicle",
    description: "Inadequately secured load falling from flatbed, skip, or vehicle during movement.",
    typicalHarmPotential: ["fracture", "fatality"], typicalAffectedPersons: ["bystander", "driver"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Load securing check before movement; tarpaulin on loose material" }] },
  { code: "VEH-007", category: "ergonomic", subcategory: "manual_handling", name: "Manual handling musculoskeletal injury — lifting, carrying, pushing",
    description: "Injury from lifting, carrying, pushing, or pulling loads beyond ergonomic limits.",
    typicalHarmPotential: ["musculoskeletal_injury", "back_injury"], typicalAffectedPersons: ["operator", "warehouse_worker"], energyForm: "ergonomic",
    typicalControlsSuggested: [{ hierarchy: "ELIMINATION", description: "Mechanise lifts above 25 kg" }, { hierarchy: "ADMINISTRATIVE", description: "Manual handling training; two-person lift above threshold" }] },
  { code: "VEH-008", category: "physical", subcategory: "slip_trip", name: "Slip and fall on walkway — wet, oil-contaminated, or cluttered",
    description: "Worker slips on contaminated or wet walkway or trips on obstacle.",
    typicalHarmPotential: ["fracture", "head_injury"], typicalAffectedPersons: ["all"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Anti-slip gratings; regular housekeeping rounds; drainage grilles" }] },
  { code: "VEH-009", category: "physical", subcategory: "trip", name: "Trip hazard — hoses, cables, poor housekeeping on floor",
    description: "Trip over trailing hoses, cables, or materials left on floor.",
    typicalHarmPotential: ["fracture", "strain"], typicalAffectedPersons: ["all"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Cable trays; hose retractors; designated routes for temporary hoses" }] },
  { code: "VEH-010", category: "lifting", subcategory: "overhead_crane", name: "Overhead crane travel — personnel below load path",
    description: "Personnel standing under or near the path of an overhead crane load.",
    typicalHarmPotential: ["crush_injury", "fatality"], typicalAffectedPersons: ["worker_below"], energyForm: "gravitational",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Exclusion zone under load path; audible crane horn before travel" }] },

  // Fire and Emergency (File 2.8)
  { code: "FIRE-001", category: "fire_explosion", subcategory: "general_fire", name: "General fire — inadequate detection or suppression",
    description: "Undetected or unsuppressed fire spreading in plant area due to system failure.",
    typicalHarmPotential: ["burn", "asphyxiation", "fatality"], typicalAffectedPersons: ["all"], energyForm: "thermal",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Automatic fire detection with alarm; sprinkler or suppression system" }] },
  { code: "FIRE-002", category: "fire_explosion", subcategory: "electrical_room_fire", name: "Electrical room fire — cable tray or switchgear ignition",
    description: "Fire starting in MCC room or cable basement from electrical fault or cable tray.",
    typicalHarmPotential: ["burn", "property_damage"], typicalAffectedPersons: ["electrician", "operator"], energyForm: "electrical_low_voltage",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "CO2 or FM-200 suppression in electrical rooms; fire-stop at penetrations" }] },
  { code: "FIRE-003", category: "fire_explosion", subcategory: "transformer_fire", name: "Transformer fire — oil-filled equipment failure",
    description: "Oil-immersed transformer failure causing oil fire.",
    typicalHarmPotential: ["burn", "blast_injury", "property_damage"], typicalAffectedPersons: ["electrician", "bystander"], energyForm: "thermal",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Oil containment bund; fire detection; Buchholz relay protection" }] },
  { code: "FIRE-004", category: "fire_explosion", subcategory: "dust_explosion", name: "Dust fire or explosion — combustible dust accumulation",
    description: "Accumulated combustible dust ignited by spark, flame, or hot surface causing fire or explosion.",
    typicalHarmPotential: ["explosion", "fatality"], typicalAffectedPersons: ["operator", "occupants"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Housekeeping standard for dust accumulation; explosion-proof equipment in dust zones" }] },
  { code: "FIRE-005", category: "emergency_response", subcategory: "egress_blocked", name: "Emergency egress blocked — exit inaccessible during emergency",
    description: "Fire exits locked, blocked, or unknown to occupants during emergency evacuation.",
    typicalHarmPotential: ["fatality_trapped"], typicalAffectedPersons: ["all"], energyForm: "procedural",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Emergency lighting and exit signs; panic hardware on exit doors" }, { hierarchy: "ADMINISTRATIVE", description: "Monthly exit inspection; evacuation drills every 6 months" }] },
  { code: "FIRE-006", category: "emergency_response", subcategory: "detection_failure", name: "Fire detection failure — detector not functioning",
    description: "Smoke or heat detector not triggering due to fault, paint overspray, or age.",
    typicalHarmPotential: ["fatality_undetected_fire"], typicalAffectedPersons: ["all"], energyForm: "equipment_failure",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Quarterly detector function test; service contract with documented records" }] },
  { code: "FIRE-007", category: "emergency_response", subcategory: "training_failure", name: "Inadequate emergency response training — delayed response",
    description: "Delayed or ineffective emergency response due to insufficient training or practice.",
    typicalHarmPotential: ["fatality_delayed_rescue"], typicalAffectedPersons: ["all"], energyForm: "procedural",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Emergency response training every 12 months; mock drills every 6 months" }] },
  { code: "FIRE-008", category: "emergency_response", subcategory: "suppression_failure", name: "Sprinkler / suppression system failure during fire",
    description: "Sprinkler or suppression system failing to activate due to isolation valve closed or maintenance failure.",
    typicalHarmPotential: ["burn", "fatality", "property_damage"], typicalAffectedPersons: ["all"], energyForm: "equipment_failure",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Monthly valve inspection; annual full-system flow test" }] },

  // Environmental Hazards (File 2.9)
  { code: "ENV-001", category: "environmental", subcategory: "ground_contamination", name: "Spill of process chemical — ground contamination",
    description: "Process chemical spill contaminating ground and potentially migrating to groundwater.",
    typicalHarmPotential: ["environmental_damage"], typicalAffectedPersons: ["environment", "community"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Impermeable bunded containment; spill kits at risk points" }] },
  { code: "ENV-002", category: "environmental", subcategory: "stormwater", name: "Stormwater contamination — chemical or oil to drainage",
    description: "Chemical or oil entering stormwater drainage system after spill or rainfall flush.",
    typicalHarmPotential: ["water_body_contamination"], typicalAffectedPersons: ["environment"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Trapped gullies; first-flush diversion; bund outfall controls" }] },
  { code: "ENV-003", category: "environmental", subcategory: "effluent_breach", name: "Effluent discharge exceeding permitted limits",
    description: "Treated effluent discharged with parameters exceeding CPCB/SPCB consent limits.",
    typicalHarmPotential: ["regulatory_breach", "aquatic_damage"], typicalAffectedPersons: ["environment"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Online effluent monitoring; alarm before limit breach; ETP operator training" }] },
  { code: "ENV-004", category: "environmental", subcategory: "stack_emission", name: "Stack emission exceedance — process upset or equipment failure",
    description: "Stack emissions exceeding CPCB consent limits during process upset or APCD failure.",
    typicalHarmPotential: ["air_quality_breach", "regulatory_breach"], typicalAffectedPersons: ["community", "environment"], energyForm: "air_emissions",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Online CEMS with alarm; APCD redundancy plan" }] },
  { code: "ENV-005", category: "environmental", subcategory: "fugitive_dust", name: "Fugitive dust — uncontrolled emission from material handling",
    description: "Dust from stockpiles, transfer points, or vehicle movement exceeding consent limits.",
    typicalHarmPotential: ["community_health", "air_quality_breach"], typicalAffectedPersons: ["community", "employees"], energyForm: "air_emissions",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Water sprays at transfer points; windbreaks at stockpiles" }] },
  { code: "ENV-006", category: "environmental", subcategory: "waste_misclassification", name: "Hazardous waste misclassification and improper disposal",
    description: "Hazardous waste incorrectly classified as non-hazardous and disposed of through wrong stream.",
    typicalHarmPotential: ["regulatory_breach", "environmental_damage"], typicalAffectedPersons: ["environment"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Waste classification protocol; approved TSDF contractor list; manifest records" }] },
  { code: "ENV-007", category: "environmental", subcategory: "groundwater", name: "Groundwater contamination — underground storage tank leak",
    description: "Leak from underground fuel or chemical storage tank contaminating groundwater.",
    typicalHarmPotential: ["groundwater_contamination", "community_health"], typicalAffectedPersons: ["community", "environment"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Double-walled tanks with interstitial monitoring; above-ground storage preferred" }] },
  { code: "ENV-008", category: "environmental", subcategory: "noise_community", name: "Noise pollution — community impact from process equipment",
    description: "Plant operating noise exceeding CPCB ambient noise standards at nearest receptor.",
    typicalHarmPotential: ["community_disturbance", "regulatory_breach"], typicalAffectedPersons: ["community"], energyForm: "acoustic",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Acoustic barriers at perimeter; equipment on anti-vibration mounts" }] },

  // Utility and Infrastructure (File 2.10)
  { code: "UTIL-001", category: "pressure", subcategory: "boiler", name: "Boiler explosion — overpressure or furnace explosion",
    description: "Boiler overpressure or furnace backfire/explosion causing catastrophic failure.",
    typicalHarmPotential: ["blast_injury", "burn", "fatality"], typicalAffectedPersons: ["utility_operator", "bystander"], energyForm: "pressure_pneumatic",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Safety valves, pressure interlock; IBR statutory inspection" }] },
  { code: "UTIL-002", category: "biological", subcategory: "legionella", name: "Cooling tower Legionella — inadequate water treatment",
    description: "Legionella bacteria proliferating in cooling tower water aerosol affecting workers and community.",
    typicalHarmPotential: ["legionnaires_disease", "fatality"], typicalAffectedPersons: ["operator", "community"], energyForm: "biological",
    typicalControlsSuggested: [{ hierarchy: "ADMINISTRATIVE", description: "Monthly Legionella risk assessment; biocide dosing; water sampling records" }] },
  { code: "UTIL-003", category: "pressure", subcategory: "compressed_air_vessel", name: "Compressed air vessel or pipeline failure",
    description: "Air receiver or compressed air pipeline failing due to corrosion, overpressure, or fatigue.",
    typicalHarmPotential: ["blast_injury", "fatality"], typicalAffectedPersons: ["utility_operator", "bystander"], energyForm: "pressure_pneumatic",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Safety valve rated for full discharge; statutory vessel inspection every 2 years" }] },
  { code: "UTIL-004", category: "utility_failure", subcategory: "power_failure", name: "Power failure — loss of safety-critical systems",
    description: "Loss of grid or plant power affecting safety-critical systems (ventilation, interlocks, lighting).",
    typicalHarmPotential: ["process_upset", "fatality_delayed"], typicalAffectedPersons: ["all"], energyForm: "electrical_low_voltage",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "UPS for safety-critical systems; tested DG backup; emergency lighting" }] },
  { code: "UTIL-005", category: "pressure", subcategory: "water_hammer", name: "Water hammer — sudden pressure surge in pipework",
    description: "Pressure surge from rapid valve closure or pump start damaging pipework or fittings.",
    typicalHarmPotential: ["pipe_failure", "injury_from_debris"], typicalAffectedPersons: ["utility_operator"], energyForm: "pressure_hydraulic",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Slow-closing valves; surge arrestors on pump discharge" }] },
  { code: "UTIL-006", category: "fire_explosion", subcategory: "gas_pipeline", name: "Flammable gas pipeline leak — LPG, natural gas, hydrogen",
    description: "Gas leak from pipeline, fitting, or valve creating explosive atmosphere.",
    typicalHarmPotential: ["explosion", "fatality"], typicalAffectedPersons: ["operator", "site_population"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Gas detectors with auto-shutoff; regular pipe inspection; pressure testing" }] },
  { code: "UTIL-007", category: "chemical", subcategory: "exhaust_fume", name: "DG / genset operation — exhaust fume buildup in enclosed area",
    description: "Carbon monoxide and exhaust fumes from DG set accumulating in poorly ventilated enclosure.",
    typicalHarmPotential: ["co_poisoning", "fatality"], typicalAffectedPersons: ["utility_operator"], energyForm: "chemical",
    typicalControlsSuggested: [{ hierarchy: "ENGINEERING", description: "Exhaust vented to outside; CO detector with alarm in DG room" }] }
];

// ─── Control library stub (12 standard controls) ──────────────────────

const CONTROLS = [
  { code: "CTRL_LOTO",          hierarchy: "ADMINISTRATIVE", description: "Lockout-Tagout (LOTO) procedure with energy isolation verification",
    verificationMethod: "Visual + try-test", verificationFrequency: "Per occurrence" },
  { code: "CTRL_PTW_HOT_WORK",  hierarchy: "ADMINISTRATIVE", description: "Hot Work Permit with gas test, fire watch, and 11 m clearance",
    verificationMethod: "Permit checklist sign-off", verificationFrequency: "Per occurrence" },
  { code: "CTRL_PTW_CONFINED",  hierarchy: "ADMINISTRATIVE", description: "Confined Space Permit with continuous gas monitoring and rescue plan",
    verificationMethod: "Permit checklist + atmospheric log", verificationFrequency: "Per occurrence" },
  { code: "CTRL_GUARD_INTERLOCK", hierarchy: "ENGINEERING", description: "Fixed guard with electrical interlock — machine stops on guard removal",
    verificationMethod: "Function test", verificationFrequency: "Quarterly" },
  { code: "CTRL_LEV",           hierarchy: "ENGINEERING", description: "Local Exhaust Ventilation (LEV) with face velocity ≥ 0.5 m/s at source",
    verificationMethod: "Face-velocity measurement", verificationFrequency: "Quarterly" },
  { code: "CTRL_HARNESS",       hierarchy: "PPE", description: "Full body harness with double lanyard, anchor point rated ≥ 22.2 kN",
    verificationMethod: "Pre-use inspection", verificationFrequency: "Per use" },
  { code: "CTRL_HEARING_PROT",  hierarchy: "PPE", description: "Hearing protection (earplugs / earmuffs) with NRR matched to exposure",
    verificationMethod: "Fit check", verificationFrequency: "Annual training" },
  { code: "CTRL_TRAINING_TASK", hierarchy: "ADMINISTRATIVE", description: "Task-specific training with assessment and certification",
    verificationMethod: "Training record + certificate validity", verificationFrequency: "Per refresher cycle" },
  { code: "CTRL_TBT",           hierarchy: "ADMINISTRATIVE", description: "Toolbox Talk on activity hazards before shift / job",
    verificationMethod: "Attendance signed off", verificationFrequency: "Daily / per job" },
  { code: "CTRL_BARRIER_HARD",  hierarchy: "ENGINEERING", description: "Hard physical barrier separating pedestrians from mobile equipment paths",
    verificationMethod: "Visual inspection", verificationFrequency: "Weekly" },
  { code: "CTRL_BUND",          hierarchy: "ENGINEERING", description: "Bunded storage with 110% of largest tank capacity",
    verificationMethod: "Visual + capacity calc", verificationFrequency: "Annual" },
  { code: "CTRL_EMG_PROC",      hierarchy: "ADMINISTRATIVE", description: "Documented emergency procedure with assembly point and roll-call",
    verificationMethod: "Mock drill", verificationFrequency: "Half-yearly" }
];

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("🛡️   HIRA masters seed");

  // 1. 5×5 standard matrix
  await seedMatrix(STD_5X5, cellLevel);
  // 2. 3×3 simplified
  await seedMatrix(STD_3X3, level3x3);

  // 3. Hazard library
  for (const h of HAZARDS) {
    await prisma.hiraHazard.upsert({
      where: { code: h.code },
      create: { ...h, isActive: true, isGlobal: true },
      update: { ...h, isActive: true, isGlobal: true }
    });
  }
  console.log(`   hazards seeded: ${HAZARDS.length} (covering all 17 spec categories — PM-curated set comes later)`);

  // 4. Control library
  for (const c of CONTROLS) {
    await prisma.hiraControl.upsert({
      where: { code: c.code },
      create: { ...c, isActive: true, isGlobal: true },
      update: { ...c, isActive: true, isGlobal: true }
    });
  }
  console.log(`   controls seeded: ${CONTROLS.length}`);

  console.log("✅  HIRA masters seed complete.");
}

async function seedMatrix(
  spec: typeof STD_5X5 | typeof STD_3X3,
  levelFn: (l: number, s: number) => string
) {
  const matrix = await prisma.riskMatrix.upsert({
    where: { code: spec.code },
    create: {
      code: spec.code,
      name: spec.name,
      description: spec.description,
      likelihoodLevels: spec.likelihoodLevels,
      severityLevels: spec.severityLevels,
      acceptableResidual: spec.acceptableResidual,
      controlHierarchyEnforced: spec.controlHierarchyEnforced,
      isActive: spec.isActive,
      isDefault: spec.isDefault,
      isGlobal: spec.isGlobal
    },
    update: {
      name: spec.name,
      description: spec.description,
      acceptableResidual: spec.acceptableResidual,
      controlHierarchyEnforced: spec.controlHierarchyEnforced,
      isActive: spec.isActive,
      isDefault: spec.isDefault
    }
  });

  // Cells are FK-safe to delete/recreate; scales are referenced by HiraEntry
  // FKs so we upsert them in place rather than wipe.
  await prisma.riskMatrixCell.deleteMany({ where: { matrixId: matrix.id } });
  for (let i = 0; i < spec.likelihoods.length; i++) {
    const l = spec.likelihoods[i];
    await prisma.riskMatrixLikelihood.upsert({
      where: { matrixId_score: { matrixId: matrix.id, score: l.score } },
      create: { ...l, matrixId: matrix.id, sortOrder: i },
      update: { ...l, sortOrder: i }
    });
  }
  for (let i = 0; i < spec.severities.length; i++) {
    const s = spec.severities[i];
    await prisma.riskMatrixSeverity.upsert({
      where: { matrixId_score: { matrixId: matrix.id, score: s.score } },
      create: { ...s, matrixId: matrix.id, sortOrder: i },
      update: { ...s, sortOrder: i }
    });
  }

  const cells: { matrixId: string; likelihoodScore: number; severityScore: number; riskScore: number; riskLevel: string; colorHex: string; actionRequired: string; responseTimeDays: number }[] = [];
  for (let l = 1; l <= spec.likelihoodLevels; l++) {
    for (let s = 1; s <= spec.severityLevels; s++) {
      const level = levelFn(l, s);
      const { action, responseDays } = cellAction(level);
      cells.push({
        matrixId: matrix.id,
        likelihoodScore: l,
        severityScore: s,
        riskScore: l * s,
        riskLevel: level,
        colorHex: CELL_COLORS[level] ?? "#9CA3AF",
        actionRequired: action,
        responseTimeDays: responseDays
      });
    }
  }
  await prisma.riskMatrixCell.createMany({ data: cells });

  console.log(`   matrix '${spec.code}' seeded: ${spec.likelihoods.length} L × ${spec.severities.length} S = ${cells.length} cells`);
}

main()
  .catch((e) => {
    console.error("❌  HIRA masters seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
