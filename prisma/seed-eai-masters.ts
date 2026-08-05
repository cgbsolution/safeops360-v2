/**
 * EAI master data — categories, aspect library, receptors, regulations,
 * impact matrices. HIRA Phase 2.
 *
 * Idempotent — safe to re-run. Uses upsert by code on all tables.
 *
 * Coverage:
 *  - 9 ISO 14001 aspect categories
 *  - ~35 EAI aspects across categories (covers the 80+ goal partially;
 *    additional aspects can be added by industry domain experts later)
 *  - 9 receptors (air, water, soil, ecosystem, community, employees,
 *    biodiversity, climate, cultural)
 *  - ~15 Indian environmental regulations (EPA 1986, Water Act 1974,
 *    Air Act 1981, HW Rules, E-Waste Rules, Plastic Waste Rules, key
 *    CPCB notifications)
 *  - 2 impact matrices (5×5 standard, 4×4 simplified)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── 1. Aspect categories ─────────────────────────────────────────────

const ASPECT_CATEGORIES = [
  { code: "AIR_EMISSIONS",      name: "Air Emissions",        description: "Stack emissions, fugitive emissions, GHG, particulate matter, VOCs, ozone-depleting substances", sortOrder: 10, iconKey: "wind" },
  { code: "WATER_DISCHARGE",    name: "Water Discharge",      description: "Process effluent, sanitary effluent, stormwater runoff, accidental release", sortOrder: 20, iconKey: "droplet" },
  { code: "LAND_CONTAMINATION", name: "Land Contamination",   description: "Spills, leaks, waste disposal, soil contamination", sortOrder: 30, iconKey: "alert-octagon" },
  { code: "WASTE_GENERATION",   name: "Waste Generation",     description: "Hazardous, non-hazardous, recyclable, landfill, e-waste, biomedical", sortOrder: 40, iconKey: "trash-2" },
  { code: "RESOURCE_CONSUMPTION", name: "Resource Consumption", description: "Water, energy, raw materials, fuel consumption", sortOrder: 50, iconKey: "zap" },
  { code: "NOISE_VIBRATION",    name: "Noise & Vibration",    description: "Continuous noise to community, blast vibration, equipment noise", sortOrder: 60, iconKey: "volume-2" },
  { code: "BIODIVERSITY",       name: "Biodiversity Impact",  description: "Habitat disturbance, species impact, water body impact", sortOrder: 70, iconKey: "tree-deciduous" },
  { code: "VISUAL_IMPACT",      name: "Visual Impact",        description: "Light pollution, dust generation, infrastructure visual presence", sortOrder: 80, iconKey: "eye" },
  { code: "COMMUNITY_IMPACT",   name: "Community Impact",     description: "Traffic, odor, employment, displacement", sortOrder: 90, iconKey: "users" },
];

// ─── 2. Receptors ─────────────────────────────────────────────────────

const RECEPTORS = [
  { code: "AIR",            name: "Air",                description: "Ambient air quality", sortOrder: 10 },
  { code: "SURFACE_WATER",  name: "Surface Water",      description: "Rivers, streams, lakes, ponds", sortOrder: 20 },
  { code: "GROUND_WATER",   name: "Ground Water",       description: "Aquifers and bore wells", sortOrder: 30 },
  { code: "SOIL",           name: "Soil",               description: "Top soil and sub-soil layers", sortOrder: 40 },
  { code: "ECOSYSTEM",      name: "Ecosystem",          description: "Local ecology, flora and fauna", sortOrder: 50 },
  { code: "COMMUNITY",      name: "Community",          description: "Neighbouring population, residences", sortOrder: 60 },
  { code: "EMPLOYEES",      name: "Employees",          description: "On-site workforce", sortOrder: 70 },
  { code: "BIODIVERSITY",   name: "Biodiversity",       description: "Species and habitats with conservation value", sortOrder: 80 },
  { code: "CLIMATE",        name: "Climate",            description: "Global / regional climate via GHG emissions", sortOrder: 90 },
];

// ─── 3. Regulations ───────────────────────────────────────────────────

const REGULATIONS = [
  { code: "EPA_1986",         name: "Environment Protection Act, 1986",          jurisdiction: "INDIA", authority: "MoEFCC", description: "Umbrella legislation for environmental protection in India", sortOrder: 10 },
  { code: "WATER_ACT_1974",   name: "Water (Prevention and Control of Pollution) Act, 1974", jurisdiction: "INDIA", authority: "CPCB/SPCB", description: "Prevention and control of water pollution; establishes consent regime", sortOrder: 20 },
  { code: "AIR_ACT_1981",     name: "Air (Prevention and Control of Pollution) Act, 1981",   jurisdiction: "INDIA", authority: "CPCB/SPCB", description: "Prevention and control of air pollution; establishes consent regime", sortOrder: 30 },
  { code: "HAZARDOUS_WASTE_RULES_2016", name: "Hazardous and Other Wastes Rules, 2016", jurisdiction: "INDIA", authority: "MoEFCC/CPCB", description: "Management, handling, and trans-boundary movement of hazardous waste", sortOrder: 40 },
  { code: "E_WASTE_RULES_2016", name: "E-Waste (Management) Rules, 2016", jurisdiction: "INDIA", authority: "MoEFCC/CPCB", description: "Producer responsibility for e-waste collection and recycling", sortOrder: 50 },
  { code: "PLASTIC_WASTE_RULES_2016", name: "Plastic Waste Management Rules, 2016", jurisdiction: "INDIA", authority: "MoEFCC/CPCB", description: "Plastic waste segregation, collection, processing, and disposal", sortOrder: 60 },
  { code: "BIOMEDICAL_WASTE_RULES_2016", name: "Bio-medical Waste Management Rules, 2016", jurisdiction: "INDIA", authority: "MoEFCC/CPCB", description: "Segregation, collection, treatment, and disposal of biomedical waste", sortOrder: 70 },
  { code: "BATTERY_WASTE_RULES_2022", name: "Battery Waste Management Rules, 2022", jurisdiction: "INDIA", authority: "MoEFCC/CPCB", description: "EPR for battery producers and importers", sortOrder: 80 },
  { code: "CPCB_INDUSTRY_STANDARDS", name: "CPCB Industry-Specific Emission and Effluent Standards", jurisdiction: "INDIA", authority: "CPCB", description: "Cement, steel, chemical, refinery industry-specific limits", sortOrder: 90 },
  { code: "NOISE_RULES_2000", name: "Noise Pollution (Regulation and Control) Rules, 2000", jurisdiction: "INDIA", authority: "MoEFCC/CPCB", description: "Ambient noise standards for industrial, commercial, residential, silence zones", sortOrder: 100 },
  { code: "EIA_NOTIFICATION_2006", name: "Environmental Impact Assessment Notification, 2006", jurisdiction: "INDIA", authority: "MoEFCC", description: "EIA requirements for new projects and modernization", sortOrder: 110 },
  { code: "FOREST_CONSERVATION_1980", name: "Forest (Conservation) Act, 1980", jurisdiction: "INDIA", authority: "MoEFCC", description: "Restriction on de-reservation of forests and non-forest use of forest land", sortOrder: 120 },
  { code: "WILDLIFE_PROTECTION_1972", name: "Wildlife (Protection) Act, 1972", jurisdiction: "INDIA", authority: "MoEFCC", description: "Protection of wild animals, birds, and plants", sortOrder: 130 },
  { code: "MAJOR_ACCIDENT_HAZARD_RULES_1989", name: "Manufacture, Storage and Import of Hazardous Chemicals Rules, 1989", jurisdiction: "INDIA", authority: "MoEFCC", description: "MAH installations safety/environmental requirements", sortOrder: 140 },
  { code: "ISO_14001_2015", name: "ISO 14001:2015 Environmental Management Systems", jurisdiction: "INTERNATIONAL", authority: "ISO", description: "International environmental management system standard", sortOrder: 150 },
];

// ─── 4. Impact matrices ──────────────────────────────────────────────

type ScaleSeed = { score: number; label: string; description: string };

const STANDARD_5X5_LIKELIHOODS: ScaleSeed[] = [
  { score: 1, label: "Rare",          description: "Occurs very rarely; once in 10+ years under normal operating conditions" },
  { score: 2, label: "Unlikely",      description: "Could occur once every 5-10 years" },
  { score: 3, label: "Possible",      description: "Could occur once every 1-5 years" },
  { score: 4, label: "Likely",        description: "Occurs once per year or more" },
  { score: 5, label: "Almost Certain", description: "Continuous or near-continuous occurrence" },
];

const STANDARD_5X5_MAGNITUDES: ScaleSeed[] = [
  { score: 1, label: "Insignificant", description: "Negligible environmental impact, contained on site, fully reversible within days" },
  { score: 2, label: "Minor",         description: "Minor local impact, contained within site, reversible within weeks-months" },
  { score: 3, label: "Moderate",      description: "Local impact extending beyond site, reversible within 1-2 years; potential statutory reporting" },
  { score: 4, label: "Major",         description: "Regional impact, partial reversibility >2 years; statutory breach likely" },
  { score: 5, label: "Catastrophic",  description: "National/global impact, irreversible damage; major statutory breach + reputational" },
];

const SIMPLE_4X4_LIKELIHOODS: ScaleSeed[] = [
  { score: 1, label: "Rare",     description: "Once per 5+ years" },
  { score: 2, label: "Unlikely", description: "Once per 1-5 years" },
  { score: 3, label: "Likely",   description: "Once per year or more" },
  { score: 4, label: "Frequent", description: "Continuous or weekly" },
];

const SIMPLE_4X4_MAGNITUDES: ScaleSeed[] = [
  { score: 1, label: "Low",       description: "Negligible, on-site, reversible" },
  { score: 2, label: "Moderate",  description: "Local, reversible within months" },
  { score: 3, label: "High",      description: "Regional, partial reversibility" },
  { score: 4, label: "Very High", description: "Irreversible, statutory breach" },
];

function computeCells(likelihoodScores: number[], magnitudeScores: number[]) {
  const cells: {
    likelihoodScore: number;
    magnitudeScore: number;
    impactScore: number;
    impactLevel: string;
    colorHex: string;
    actionRequired: string;
    responseTimeDays: number;
  }[] = [];
  for (const ls of likelihoodScores) {
    for (const ms of magnitudeScores) {
      const score = ls * ms;
      let level = "LOW";
      let color = "#22c55e";
      let action = "Monitor; no immediate action";
      let days = 90;
      if (score >= 17) {
        level = "MAJOR"; color = "#ef4444"; action = "Immediate intervention; statutory notice may apply"; days = 7;
      } else if (score >= 10) {
        level = "SIGNIFICANT"; color = "#f97316"; action = "Detailed plan; senior approval"; days = 30;
      } else if (score >= 5) {
        level = "MODERATE"; color = "#eab308"; action = "Mitigation plan within review cycle"; days = 60;
      }
      cells.push({
        likelihoodScore: ls,
        magnitudeScore: ms,
        impactScore: score,
        impactLevel: level,
        colorHex: color,
        actionRequired: action,
        responseTimeDays: days,
      });
    }
  }
  return cells;
}

// ─── 5. Aspect library (~35 aspects covering all categories) ─────────

const ASPECTS = [
  // AIR
  { code: "AIR_STACK_PM",          categoryCode: "AIR_EMISSIONS", name: "Stack particulate matter emissions", description: "Solid particles emitted from process stacks (kiln, raw mill, cement mill, etc.)", typicalReceptors: ["AIR","COMMUNITY","EMPLOYEES"], typicalRegulations: ["AIR_ACT_1981","CPCB_INDUSTRY_STANDARDS","EPA_1986"], typicallySignificant: true },
  { code: "AIR_STACK_SOX",         categoryCode: "AIR_EMISSIONS", name: "Stack SOx emissions",             description: "Sulphur oxide emissions from combustion processes", typicalReceptors: ["AIR","COMMUNITY"], typicalRegulations: ["AIR_ACT_1981","CPCB_INDUSTRY_STANDARDS"], typicallySignificant: true },
  { code: "AIR_STACK_NOX",         categoryCode: "AIR_EMISSIONS", name: "Stack NOx emissions",             description: "Nitrogen oxide emissions from high-temperature combustion", typicalReceptors: ["AIR","COMMUNITY"], typicalRegulations: ["AIR_ACT_1981","CPCB_INDUSTRY_STANDARDS"], typicallySignificant: true },
  { code: "AIR_FUGITIVE_DUST",     categoryCode: "AIR_EMISSIONS", name: "Fugitive dust emissions",         description: "Dust emissions from material handling, storage, transport", typicalReceptors: ["AIR","COMMUNITY","EMPLOYEES"], typicalRegulations: ["AIR_ACT_1981","CPCB_INDUSTRY_STANDARDS"], typicallySignificant: true },
  { code: "AIR_GHG_CO2",           categoryCode: "AIR_EMISSIONS", name: "GHG emissions — CO₂",             description: "Carbon dioxide emissions from fuel combustion and process", typicalReceptors: ["CLIMATE","AIR"], typicalRegulations: ["EPA_1986","ISO_14001_2015"], typicallySignificant: true },
  { code: "AIR_VOC",               categoryCode: "AIR_EMISSIONS", name: "VOC emissions",                   description: "Volatile organic compound emissions from solvents, fuels, painting", typicalReceptors: ["AIR","COMMUNITY","EMPLOYEES"], typicalRegulations: ["AIR_ACT_1981","CPCB_INDUSTRY_STANDARDS"], typicallySignificant: false },

  // WATER
  { code: "WATER_PROCESS_EFFLUENT", categoryCode: "WATER_DISCHARGE", name: "Process effluent discharge",    description: "Industrial process water discharged after treatment", typicalReceptors: ["SURFACE_WATER","ECOSYSTEM"], typicalRegulations: ["WATER_ACT_1974","CPCB_INDUSTRY_STANDARDS"], typicallySignificant: true },
  { code: "WATER_SANITARY_EFFLUENT", categoryCode: "WATER_DISCHARGE", name: "Sanitary effluent discharge", description: "Sewage from canteen, toilets, showers", typicalReceptors: ["SURFACE_WATER","ECOSYSTEM"], typicalRegulations: ["WATER_ACT_1974"], typicallySignificant: false },
  { code: "WATER_STORMWATER",      categoryCode: "WATER_DISCHARGE", name: "Stormwater runoff",              description: "Rainwater runoff potentially contaminated by surface materials", typicalReceptors: ["SURFACE_WATER","SOIL"], typicalRegulations: ["WATER_ACT_1974"], typicallySignificant: false },
  { code: "WATER_ACCIDENTAL_RELEASE", categoryCode: "WATER_DISCHARGE", name: "Accidental water release",  description: "Spillage of oils, chemicals to water bodies via drains", typicalReceptors: ["SURFACE_WATER","GROUND_WATER","ECOSYSTEM"], typicalRegulations: ["WATER_ACT_1974","EPA_1986"], typicallySignificant: true },

  // LAND
  { code: "LAND_OIL_SPILL",        categoryCode: "LAND_CONTAMINATION", name: "Oil/fuel spillage to land",  description: "Accidental release of oils, lubricants, or fuel to ground", typicalReceptors: ["SOIL","GROUND_WATER"], typicalRegulations: ["EPA_1986","HAZARDOUS_WASTE_RULES_2016"], typicallySignificant: true },
  { code: "LAND_CHEMICAL_LEAK",    categoryCode: "LAND_CONTAMINATION", name: "Chemical leak to soil",       description: "Leakage of acids, alkalis, or process chemicals to soil", typicalReceptors: ["SOIL","GROUND_WATER","ECOSYSTEM"], typicalRegulations: ["EPA_1986","HAZARDOUS_WASTE_RULES_2016"], typicallySignificant: true },
  { code: "LAND_WASTE_DUMP",       categoryCode: "LAND_CONTAMINATION", name: "Uncontrolled waste disposal", description: "Disposal of waste outside designated areas", typicalReceptors: ["SOIL","GROUND_WATER","COMMUNITY"], typicalRegulations: ["HAZARDOUS_WASTE_RULES_2016","EPA_1986"], typicallySignificant: true },

  // WASTE
  { code: "WASTE_HAZARDOUS",       categoryCode: "WASTE_GENERATION", name: "Hazardous waste generation",   description: "Used oil, solvents, contaminated cloth, lab chemicals, etc.", typicalReceptors: ["SOIL","COMMUNITY","ECOSYSTEM"], typicalRegulations: ["HAZARDOUS_WASTE_RULES_2016","EPA_1986"], typicallySignificant: true },
  { code: "WASTE_NON_HAZARDOUS",   categoryCode: "WASTE_GENERATION", name: "Non-hazardous waste generation", description: "General industrial waste, packaging, scrap", typicalReceptors: ["SOIL","COMMUNITY"], typicalRegulations: ["EPA_1986"], typicallySignificant: false },
  { code: "WASTE_E_WASTE",         categoryCode: "WASTE_GENERATION", name: "E-waste generation",           description: "End-of-life electronic equipment", typicalReceptors: ["SOIL","COMMUNITY"], typicalRegulations: ["E_WASTE_RULES_2016"], typicallySignificant: false },
  { code: "WASTE_PLASTIC",         categoryCode: "WASTE_GENERATION", name: "Plastic waste generation",     description: "Plastic packaging, films, containers", typicalReceptors: ["SOIL","COMMUNITY","ECOSYSTEM"], typicalRegulations: ["PLASTIC_WASTE_RULES_2016"], typicallySignificant: false },
  { code: "WASTE_BIOMEDICAL",      categoryCode: "WASTE_GENERATION", name: "Biomedical waste generation",  description: "First-aid, OHC, lab biomedical waste", typicalReceptors: ["COMMUNITY","SOIL"], typicalRegulations: ["BIOMEDICAL_WASTE_RULES_2016"], typicallySignificant: false },
  { code: "WASTE_BATTERY",         categoryCode: "WASTE_GENERATION", name: "Battery waste generation",     description: "Used industrial and lead-acid batteries", typicalReceptors: ["SOIL","COMMUNITY"], typicalRegulations: ["BATTERY_WASTE_RULES_2022"], typicallySignificant: false },

  // RESOURCE
  { code: "RES_WATER_CONSUMPTION", categoryCode: "RESOURCE_CONSUMPTION", name: "Fresh water consumption",  description: "Withdrawal of fresh water for process, cooling, sanitary use", typicalReceptors: ["SURFACE_WATER","GROUND_WATER","COMMUNITY"], typicalRegulations: ["WATER_ACT_1974","EPA_1986"], typicallySignificant: true },
  { code: "RES_ENERGY_THERMAL",    categoryCode: "RESOURCE_CONSUMPTION", name: "Thermal energy consumption", description: "Consumption of coal, fuel oil, gas for combustion processes", typicalReceptors: ["CLIMATE","AIR"], typicalRegulations: ["EPA_1986","ISO_14001_2015"], typicallySignificant: true },
  { code: "RES_ENERGY_ELECTRICAL", categoryCode: "RESOURCE_CONSUMPTION", name: "Electrical energy consumption", description: "Grid electricity consumption", typicalReceptors: ["CLIMATE"], typicalRegulations: ["ISO_14001_2015"], typicallySignificant: false },
  { code: "RES_RAW_MATERIAL",      categoryCode: "RESOURCE_CONSUMPTION", name: "Raw material consumption", description: "Consumption of natural mineral resources", typicalReceptors: ["BIODIVERSITY","SOIL"], typicalRegulations: ["EPA_1986","ISO_14001_2015"], typicallySignificant: false },

  // NOISE
  { code: "NOISE_CONTINUOUS",      categoryCode: "NOISE_VIBRATION", name: "Continuous industrial noise",   description: "Steady-state noise from mills, fans, compressors, blowers", typicalReceptors: ["COMMUNITY","EMPLOYEES"], typicalRegulations: ["NOISE_RULES_2000"], typicallySignificant: false },
  { code: "NOISE_BLAST",           categoryCode: "NOISE_VIBRATION", name: "Blast / impulse noise",         description: "Quarry blasting, impact piling, pressure release", typicalReceptors: ["COMMUNITY","EMPLOYEES","BIODIVERSITY"], typicalRegulations: ["NOISE_RULES_2000"], typicallySignificant: true },
  { code: "NOISE_TRANSPORT",       categoryCode: "NOISE_VIBRATION", name: "Vehicular / transport noise",   description: "Noise from material movement vehicles", typicalReceptors: ["COMMUNITY"], typicalRegulations: ["NOISE_RULES_2000"], typicallySignificant: false },
  { code: "VIBRATION_BLAST",       categoryCode: "NOISE_VIBRATION", name: "Blast ground vibration",        description: "Quarry blast peak particle velocity affecting structures", typicalReceptors: ["COMMUNITY"], typicalRegulations: ["EPA_1986","NOISE_RULES_2000"], typicallySignificant: false },

  // BIODIVERSITY
  { code: "BIO_HABITAT_DISTURBANCE", categoryCode: "BIODIVERSITY", name: "Habitat disturbance",            description: "Construction or operation disturbing natural habitat", typicalReceptors: ["BIODIVERSITY","ECOSYSTEM"], typicalRegulations: ["WILDLIFE_PROTECTION_1972","FOREST_CONSERVATION_1980"], typicallySignificant: true },
  { code: "BIO_SPECIES_IMPACT",    categoryCode: "BIODIVERSITY", name: "Impact on protected species",      description: "Activities affecting Schedule I/II species or critical habitats", typicalReceptors: ["BIODIVERSITY"], typicalRegulations: ["WILDLIFE_PROTECTION_1972"], typicallySignificant: true },

  // VISUAL
  { code: "VIS_LIGHT_POLLUTION",   categoryCode: "VISUAL_IMPACT", name: "Light pollution to surroundings", description: "Excessive lighting affecting neighbouring residences/biodiversity", typicalReceptors: ["COMMUNITY","BIODIVERSITY"], typicalRegulations: ["EPA_1986"], typicallySignificant: false },
  { code: "VIS_DUST_PLUME",        categoryCode: "VISUAL_IMPACT", name: "Visible dust plume",              description: "Visible dust plume from stacks or fugitive sources", typicalReceptors: ["COMMUNITY"], typicalRegulations: ["AIR_ACT_1981"], typicallySignificant: false },

  // COMMUNITY
  { code: "COM_TRAFFIC",           categoryCode: "COMMUNITY_IMPACT", name: "Heavy traffic on community roads", description: "Plant material movement increasing community road traffic", typicalReceptors: ["COMMUNITY"], typicalRegulations: ["EPA_1986"], typicallySignificant: false },
  { code: "COM_ODOR",              categoryCode: "COMMUNITY_IMPACT", name: "Odor to surroundings",          description: "Process or waste odors reaching neighbouring residences", typicalReceptors: ["COMMUNITY"], typicalRegulations: ["AIR_ACT_1981","EPA_1986"], typicallySignificant: false },

  // ── Meridian cross-industry set (File 3) — EA-prefixed codes, sector-neutral ──

  // AIR — EA codes
  { code: "EA-AIR-001", categoryCode: "AIR_EMISSIONS", name: "Particulate matter (PM10/PM2.5) from process operations",
    description: "Solid particulate emissions from process operations entering ambient air.", typicalReceptors: ["AIR","COMMUNITY","EMPLOYEES"], typicalRegulations: ["AIR_ACT_1981","CPCB_INDUSTRY_STANDARDS","EPA_1986"], typicallySignificant: true },
  { code: "EA-AIR-002", categoryCode: "AIR_EMISSIONS", name: "SOx emissions from fuel combustion",
    description: "Sulphur dioxide and trioxide from combustion of sulphur-containing fuels.", typicalReceptors: ["AIR","COMMUNITY"], typicalRegulations: ["AIR_ACT_1981","CPCB_INDUSTRY_STANDARDS"], typicallySignificant: false },
  { code: "EA-AIR-003", categoryCode: "AIR_EMISSIONS", name: "NOx emissions from high-temperature combustion",
    description: "Nitrogen oxides from high-temperature combustion processes.", typicalReceptors: ["AIR","COMMUNITY"], typicalRegulations: ["AIR_ACT_1981","CPCB_INDUSTRY_STANDARDS"], typicallySignificant: false },
  { code: "EA-AIR-004", categoryCode: "AIR_EMISSIONS", name: "CO emissions — incomplete combustion",
    description: "Carbon monoxide from incomplete combustion in furnaces, boilers, engines.", typicalReceptors: ["AIR","EMPLOYEES"], typicalRegulations: ["AIR_ACT_1981","CPCB_INDUSTRY_STANDARDS"], typicallySignificant: false },
  { code: "EA-AIR-005", categoryCode: "AIR_EMISSIONS", name: "VOC emissions from process solvents or raw materials",
    description: "Volatile organic compound emissions from process solvents, coating operations, or raw materials.", typicalReceptors: ["AIR","COMMUNITY","EMPLOYEES"], typicalRegulations: ["AIR_ACT_1981","CPCB_INDUSTRY_STANDARDS"], typicallySignificant: true },
  { code: "EA-AIR-006", categoryCode: "AIR_EMISSIONS", name: "HCl / HF / acid gas emissions from process",
    description: "Acid gases emitted from chemical processes, incineration, or combustion.", typicalReceptors: ["AIR","COMMUNITY","EMPLOYEES"], typicalRegulations: ["AIR_ACT_1981","CPCB_INDUSTRY_STANDARDS"], typicallySignificant: false },
  { code: "EA-AIR-007", categoryCode: "AIR_EMISSIONS", name: "Fugitive dust from material storage, handling, transfer",
    description: "Uncontrolled dust from open stockpiles, conveyors, and material transfer points.", typicalReceptors: ["AIR","COMMUNITY","EMPLOYEES"], typicalRegulations: ["AIR_ACT_1981","CPCB_INDUSTRY_STANDARDS"], typicallySignificant: true },
  { code: "EA-AIR-008", categoryCode: "AIR_EMISSIONS", name: "Odour from process, ETP, or waste storage",
    description: "Odorous compounds from process vents, ETP, or waste storage areas reaching community.", typicalReceptors: ["AIR","COMMUNITY"], typicalRegulations: ["AIR_ACT_1981","EPA_1986"], typicallySignificant: false },
  { code: "EA-AIR-009", categoryCode: "AIR_EMISSIONS", name: "GHG (CO2, CH4, N2O) from combustion and process",
    description: "Greenhouse gas emissions from fuel combustion and industrial processes.", typicalReceptors: ["CLIMATE","AIR"], typicalRegulations: ["EPA_1986","ISO_14001_2015"], typicallySignificant: true },

  // WATER — EA codes
  { code: "EA-WATER-001", categoryCode: "WATER_DISCHARGE", name: "Process wastewater discharge to ETP",
    description: "Industrial process water discharged to effluent treatment plant.", typicalReceptors: ["SURFACE_WATER","ECOSYSTEM"], typicalRegulations: ["WATER_ACT_1974","CPCB_INDUSTRY_STANDARDS"], typicallySignificant: true },
  { code: "EA-WATER-002", categoryCode: "WATER_DISCHARGE", name: "Cooling water blowdown discharge",
    description: "Cooling tower blowdown with dissolved solids and biocide residuals.", typicalReceptors: ["SURFACE_WATER"], typicalRegulations: ["WATER_ACT_1974"], typicallySignificant: false },
  { code: "EA-WATER-003", categoryCode: "WATER_DISCHARGE", name: "Boiler blowdown discharge",
    description: "High-temperature blowdown from boilers containing dissolved solids and treatment chemicals.", typicalReceptors: ["SURFACE_WATER"], typicalRegulations: ["WATER_ACT_1974"], typicallySignificant: false },
  { code: "EA-WATER-004", categoryCode: "WATER_DISCHARGE", name: "Stormwater runoff from plant area — potential contamination",
    description: "Rainwater runoff over plant areas potentially picking up contaminants.", typicalReceptors: ["SURFACE_WATER","SOIL"], typicalRegulations: ["WATER_ACT_1974","EPA_1986"], typicallySignificant: true },
  { code: "EA-WATER-005", categoryCode: "WATER_DISCHARGE", name: "Chemical / oil spill to drainage and water body",
    description: "Accidental chemical or oil release entering plant drainage and reaching water body.", typicalReceptors: ["SURFACE_WATER","GROUND_WATER","ECOSYSTEM"], typicalRegulations: ["WATER_ACT_1974","EPA_1986"], typicallySignificant: true },
  { code: "EA-WATER-006", categoryCode: "WATER_DISCHARGE", name: "Domestic wastewater from plant facilities",
    description: "Sanitary effluent from canteen, toilets, and welfare facilities.", typicalReceptors: ["SURFACE_WATER","ECOSYSTEM"], typicalRegulations: ["WATER_ACT_1974"], typicallySignificant: false },
  { code: "EA-WATER-007", categoryCode: "RESOURCE_CONSUMPTION", name: "Groundwater extraction — drawdown impact",
    description: "Extraction of groundwater for process and utility use affecting aquifer levels.", typicalReceptors: ["GROUND_WATER","COMMUNITY"], typicalRegulations: ["WATER_ACT_1974","EPA_1986"], typicallySignificant: true },

  // WASTE — EA codes
  { code: "EA-WASTE-001", categoryCode: "WASTE_GENERATION", name: "Hazardous waste generation — process byproducts",
    description: "Hazardous waste generated as byproducts of manufacturing processes.", typicalReceptors: ["SOIL","COMMUNITY","ECOSYSTEM"], typicalRegulations: ["HAZARDOUS_WASTE_RULES_2016","EPA_1986"], typicallySignificant: true },
  { code: "EA-WASTE-002", categoryCode: "WASTE_GENERATION", name: "Used oil and lubricant waste",
    description: "Spent lubricating oil and hydraulic fluid from equipment maintenance.", typicalReceptors: ["SOIL","GROUND_WATER"], typicalRegulations: ["HAZARDOUS_WASTE_RULES_2016","EPA_1986"], typicallySignificant: false },
  { code: "EA-WASTE-003", categoryCode: "WASTE_GENERATION", name: "Chemical packaging waste — drums, IBCs, bags",
    description: "Empty chemical containers with residual contamination requiring disposal.", typicalReceptors: ["SOIL","COMMUNITY"], typicalRegulations: ["HAZARDOUS_WASTE_RULES_2016"], typicallySignificant: false },
  { code: "EA-WASTE-004", categoryCode: "WASTE_GENERATION", name: "E-waste — obsolete electronics and instrumentation",
    description: "End-of-life electronics and instrumentation from operations and upgrades.", typicalReceptors: ["SOIL","COMMUNITY"], typicalRegulations: ["E_WASTE_RULES_2016"], typicallySignificant: false },
  { code: "EA-WASTE-005", categoryCode: "WASTE_GENERATION", name: "Biomedical waste from occupational health facility",
    description: "Medical waste from first aid and occupational health centre.", typicalReceptors: ["COMMUNITY","SOIL"], typicalRegulations: ["BIOMEDICAL_WASTE_RULES_2016"], typicallySignificant: false },
  { code: "EA-WASTE-006", categoryCode: "WASTE_GENERATION", name: "Construction and demolition waste from projects",
    description: "Inert and mixed waste from capital projects and maintenance shutdowns.", typicalReceptors: ["SOIL","COMMUNITY"], typicalRegulations: ["EPA_1986"], typicallySignificant: false },
  { code: "EA-WASTE-007", categoryCode: "WASTE_GENERATION", name: "General solid waste — non-hazardous process and domestic",
    description: "Non-hazardous general waste from process and welfare areas.", typicalReceptors: ["SOIL","COMMUNITY"], typicalRegulations: ["EPA_1986"], typicallySignificant: false },

  // RESOURCE — EA codes
  { code: "EA-RESRC-001", categoryCode: "RESOURCE_CONSUMPTION", name: "Electricity consumption — grid power",
    description: "Grid electricity consumed for process, utilities, lighting, and HVAC.", typicalReceptors: ["CLIMATE"], typicalRegulations: ["ISO_14001_2015"], typicallySignificant: true },
  { code: "EA-RESRC-002", categoryCode: "RESOURCE_CONSUMPTION", name: "Fuel consumption — coal, furnace oil, diesel, LPG, PNG",
    description: "Thermal fuel consumed in furnaces, boilers, vehicles, and gensets.", typicalReceptors: ["CLIMATE","AIR"], typicalRegulations: ["EPA_1986","ISO_14001_2015"], typicallySignificant: true },
  { code: "EA-RESRC-003", categoryCode: "RESOURCE_CONSUMPTION", name: "Water consumption — process, cooling, domestic",
    description: "Total fresh water withdrawn for all plant uses.", typicalReceptors: ["SURFACE_WATER","GROUND_WATER","COMMUNITY"], typicalRegulations: ["WATER_ACT_1974","EPA_1986"], typicallySignificant: true },
  { code: "EA-RESRC-004", categoryCode: "RESOURCE_CONSUMPTION", name: "Raw material consumption",
    description: "Consumption of natural or processed raw materials for manufacturing.", typicalReceptors: ["BIODIVERSITY","SOIL"], typicalRegulations: ["EPA_1986","ISO_14001_2015"], typicallySignificant: false },
  { code: "EA-RESRC-005", categoryCode: "RESOURCE_CONSUMPTION", name: "Packaging material consumption",
    description: "Consumption of packaging materials including plastics and paper.", typicalReceptors: ["SOIL","COMMUNITY"], typicalRegulations: ["PLASTIC_WASTE_RULES_2016"], typicallySignificant: false },

  // LAND — EA codes
  { code: "EA-LAND-001", categoryCode: "LAND_CONTAMINATION", name: "Land use — plant footprint and associated impact",
    description: "Permanent land use change from plant footprint affecting local land use patterns.", typicalReceptors: ["BIODIVERSITY","SOIL","COMMUNITY"], typicalRegulations: ["EPA_1986","FOREST_CONSERVATION_1980"], typicallySignificant: false },
  { code: "EA-LAND-002", categoryCode: "LAND_CONTAMINATION", name: "Soil contamination from historical operations",
    description: "Legacy soil contamination from past chemical handling or waste disposal.", typicalReceptors: ["SOIL","GROUND_WATER","COMMUNITY"], typicalRegulations: ["EPA_1986","HAZARDOUS_WASTE_RULES_2016"], typicallySignificant: false },

  // NOISE — EA codes
  { code: "EA-NOISE-001", categoryCode: "NOISE_VIBRATION", name: "Process noise — continuous from equipment operation",
    description: "Steady-state noise from process equipment reaching plant boundary and community.", typicalReceptors: ["COMMUNITY","EMPLOYEES"], typicalRegulations: ["NOISE_RULES_2000"], typicallySignificant: true },
  { code: "EA-NOISE-002", categoryCode: "NOISE_VIBRATION", name: "Transport noise — vehicle movement at site boundaries",
    description: "Noise from HGVs, forklifts, and plant vehicles at site perimeter.", typicalReceptors: ["COMMUNITY"], typicalRegulations: ["NOISE_RULES_2000"], typicallySignificant: false },

  // BIODIVERSITY — EA codes
  { code: "EA-BIO-001", categoryCode: "BIODIVERSITY", name: "Biodiversity impact — operation near ecologically sensitive area",
    description: "Plant operations affecting flora, fauna, or habitat near ecologically sensitive zones.", typicalReceptors: ["BIODIVERSITY","ECOSYSTEM"], typicalRegulations: ["WILDLIFE_PROTECTION_1972","FOREST_CONSERVATION_1980"], typicallySignificant: false },

  // COMMUNITY — EA codes
  { code: "EA-COMM-001", categoryCode: "COMMUNITY_IMPACT", name: "Community impact — traffic, employment, displacement",
    description: "Socio-economic community impacts from plant traffic, employment, and land requirements.", typicalReceptors: ["COMMUNITY"], typicalRegulations: ["EPA_1986","EIA_NOTIFICATION_2006"], typicallySignificant: false },
  { code: "EA-COMM-002", categoryCode: "COMMUNITY_IMPACT", name: "Visual impact on surrounding community",
    description: "Visual intrusion from plant structures, lighting, or dust plume on surrounding area.", typicalReceptors: ["COMMUNITY"], typicalRegulations: ["EPA_1986"], typicallySignificant: false },
];

// ─── Main seed ────────────────────────────────────────────────────────

async function main() {
  console.log("🌍  EAI masters seed");

  // 1. Categories
  const categoryByCode: Record<string, string> = {};
  for (const c of ASPECT_CATEGORIES) {
    const row = await prisma.eaiAspectCategory.upsert({
      where: { code: c.code },
      create: c,
      update: { name: c.name, description: c.description, sortOrder: c.sortOrder, iconKey: c.iconKey, isActive: true },
    });
    categoryByCode[c.code] = row.id;
  }
  console.log(`   categories upserted: ${ASPECT_CATEGORIES.length}`);

  // 2. Receptors
  for (const r of RECEPTORS) {
    await prisma.eaiReceptor.upsert({
      where: { code: r.code },
      create: r,
      update: { name: r.name, description: r.description, sortOrder: r.sortOrder, isActive: true },
    });
  }
  console.log(`   receptors upserted: ${RECEPTORS.length}`);

  // 3. Regulations
  for (const reg of REGULATIONS) {
    await prisma.eaiRegulation.upsert({
      where: { code: reg.code },
      create: { ...reg, isActive: true },
      update: { name: reg.name, description: reg.description, jurisdiction: reg.jurisdiction, authority: reg.authority, sortOrder: reg.sortOrder, isActive: true },
    });
  }
  console.log(`   regulations upserted: ${REGULATIONS.length}`);

  // 4. Aspects
  for (const a of ASPECTS) {
    const categoryId = categoryByCode[a.categoryCode];
    if (!categoryId) {
      console.warn(`   skip aspect ${a.code}: category ${a.categoryCode} not found`);
      continue;
    }
    const data = {
      code: a.code,
      categoryId,
      name: a.name,
      description: a.description,
      typicalReceptors: a.typicalReceptors,
      typicalRegulations: a.typicalRegulations,
      typicallySignificant: a.typicallySignificant,
      isActive: true,
      isGlobal: true,
    };
    await prisma.eaiAspect.upsert({
      where: { code: a.code },
      create: data,
      update: data,
    });
  }
  console.log(`   aspects upserted: ${ASPECTS.length}`);

  // 5. Impact matrices
  const matrixSpec = [
    {
      code: "ENV_5X5_STD",
      name: "Standard 5×5 Environmental Impact Matrix",
      description: "Default 5×5 likelihood × magnitude matrix per ISO 14001 §6.1.2",
      likelihoodLevels: 5,
      magnitudeLevels: 5,
      isDefault: true,
      likelihoods: STANDARD_5X5_LIKELIHOODS,
      magnitudes: STANDARD_5X5_MAGNITUDES,
      significanceThresholds: { low: false, moderate: false, significant: true, major: true },
      acceptableResidual: { normal: "MODERATE", abnormal: "MODERATE", emergency: "LOW" },
    },
    {
      code: "ENV_4X4_SIMPLE",
      name: "Simplified 4×4 Environmental Impact Matrix",
      description: "4×4 likelihood × magnitude for smaller operations",
      likelihoodLevels: 4,
      magnitudeLevels: 4,
      isDefault: false,
      likelihoods: SIMPLE_4X4_LIKELIHOODS,
      magnitudes: SIMPLE_4X4_MAGNITUDES,
      significanceThresholds: { low: false, moderate: false, significant: true, major: true },
      acceptableResidual: { normal: "MODERATE", abnormal: "LOW", emergency: "LOW" },
    },
  ];

  for (const m of matrixSpec) {
    const matrix = await prisma.environmentalImpactMatrix.upsert({
      where: { code: m.code },
      create: {
        code: m.code,
        name: m.name,
        description: m.description,
        likelihoodLevels: m.likelihoodLevels,
        magnitudeLevels: m.magnitudeLevels,
        significanceThresholds: m.significanceThresholds,
        acceptableResidual: m.acceptableResidual,
        isActive: true,
        isDefault: m.isDefault,
        isGlobal: true,
      },
      update: {
        name: m.name,
        description: m.description,
        significanceThresholds: m.significanceThresholds,
        acceptableResidual: m.acceptableResidual,
        isDefault: m.isDefault,
        isActive: true,
      },
    });

    // Likelihoods — upsert by (matrixId, score)
    for (const lk of m.likelihoods) {
      const existing = await prisma.environmentalImpactMatrixLikelihood.findUnique({
        where: { matrixId_score: { matrixId: matrix.id, score: lk.score } },
      });
      if (existing) {
        await prisma.environmentalImpactMatrixLikelihood.update({
          where: { id: existing.id },
          data: { label: lk.label, description: lk.description, sortOrder: lk.score },
        });
      } else {
        await prisma.environmentalImpactMatrixLikelihood.create({
          data: {
            matrixId: matrix.id,
            score: lk.score,
            label: lk.label,
            description: lk.description,
            sortOrder: lk.score,
          },
        });
      }
    }

    // Magnitudes
    for (const mg of m.magnitudes) {
      const existing = await prisma.environmentalImpactMatrixMagnitude.findUnique({
        where: { matrixId_score: { matrixId: matrix.id, score: mg.score } },
      });
      if (existing) {
        await prisma.environmentalImpactMatrixMagnitude.update({
          where: { id: existing.id },
          data: { label: mg.label, description: mg.description, sortOrder: mg.score },
        });
      } else {
        await prisma.environmentalImpactMatrixMagnitude.create({
          data: {
            matrixId: matrix.id,
            score: mg.score,
            label: mg.label,
            description: mg.description,
            sortOrder: mg.score,
          },
        });
      }
    }

    // Cells — wipe and re-create (no FKs to cells from entries)
    await prisma.environmentalImpactMatrixCell.deleteMany({
      where: { matrixId: matrix.id },
    });
    const lkScores = m.likelihoods.map((x) => x.score);
    const mgScores = m.magnitudes.map((x) => x.score);
    const cells = computeCells(lkScores, mgScores);
    for (const cell of cells) {
      await prisma.environmentalImpactMatrixCell.create({
        data: { matrixId: matrix.id, ...cell },
      });
    }

    console.log(`   matrix ${m.code} upserted (${m.likelihoodLevels}×${m.magnitudeLevels}, ${cells.length} cells)`);
  }

  console.log("✅  EAI masters seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
