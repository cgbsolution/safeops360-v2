// ─────────────────────────────────────────────────────────────────────────────
// Step 26 — EAI (Environmental Aspect & Impact) Study Data
//
// Per plant (NW + SW): 2 EAI studies with 4 entries each + sub-records:
//   Study 1 (ACTIVE): Dye House & Chemical Dosing — 4 entries
//   Study 2 (APPROVED): Boiler / Utilities Operations — 4 entries
//
// Each EaiEntry has:
//   • EaiEntryAspect × 1–2
//   • EaiEntryImpact × 1–2
//   • EaiEntryControl × 2
//   • EaiEntryRegulationRef × 1
//
// Idempotent: deletes studies with number containing "-DEMO-" before recreating.
// Run: npx tsx prisma/seed-eai-data.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-07T08:00:00.000Z");
function daysAgo(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; }

// ─────────────────────────────────────────────────────────────────────────────
// All ids are resolved dynamically at runtime via Prisma lookups (see main()).
// Nothing below references a hardcoded cuid — those go stale on every re-seed.
//
//  • Plants    → prisma.plant.findFirstOrThrow({ where: { code } })
//  • Users     → prisma.user.findFirstOrThrow({ where: { role, plantId } })
//  • Areas     → prisma.area.findFirstOrThrow({ where: { plantId, name: { contains } } })
//  • Matrix    → EnvironmentalImpactMatrix code "ENV_5X5_STD"
//  • LH / MAG  → EnvironmentalImpactMatrix(Likelihood|Magnitude) by (matrixId, score)
//  • Aspects   → EaiAspect by code (AIR_STACK_PM / _SOX / _NOX, AIR_FUGITIVE_DUST, AIR_GHG_CO2)
//  • Regs      → EaiRegulation by code (EPA_1986, AIR_ACT_1981, WATER_ACT_1974)
// ─────────────────────────────────────────────────────────────────────────────

// Global EAI master ids — resolved once in main() and shared with seedPlant().
type Masters = {
  matrix5x5: string;
  lhRare: string;
  lhUnlikely: string;
  lhPossible: string;
  lhLikely: string;
  magMinor: string;
  magModerate: string;
  magMajor: string;
  aspAirPm: string;
  aspAirSox: string;
  aspAirNox: string;
  aspAirDust: string;
  aspGhgCo2: string;
  regEpa: string;
  regAir: string;
  regWater: string;
};

function impactScore(lh: number, mag: number) { return lh * mag; }
function impactLevel(score: number): string {
  if (score <= 4) return "LOW";
  if (score <= 9) return "MODERATE";
  if (score <= 16) return "SIGNIFICANT";
  return "MAJOR";
}

async function seedPlant(
  plantId: string,
  code: "NW" | "SW",
  envMgr: string,
  hseMgr: string,
  areaChem: string,
  areaUtil: string,
  areaProcessA: string,
  m: Masters,
) {
  const {
    matrix5x5: MATRIX_5X5,
    lhRare: LH_RARE,
    lhUnlikely: LH_UNLIKELY,
    lhPossible: LH_POSSIBLE,
    lhLikely: LH_LIKELY,
    magMinor: MAG_MINOR,
    magModerate: MAG_MODERATE,
    magMajor: MAG_MAJOR,
    aspAirPm: ASP_AIR_PM,
    aspAirSox: ASP_AIR_SOX,
    aspAirNox: ASP_AIR_NOX,
    aspAirDust: ASP_AIR_DUST,
    aspGhgCo2: ASP_GHG_CO2,
    regEpa: REG_EPA,
    regAir: REG_AIR,
    regWater: REG_WATER,
  } = m;
  // Study 1 — Dye-House Chemical Dosing (ACTIVE)
  const study1Number = `EAI-2026-${code}-DEMO-001`;
  const study1 = await prisma.eaiStudy.create({
    data: {
      number: study1Number,
      plantId,
      areaId: areaChem,
      scopeType: "AREA",
      title: `Dye House & Chemical Dosing — ${code} Environmental Impact Study`,
      description:
        "Comprehensive environmental aspect and impact register for all dye-house dye/chemical dosing activities including storage, handling, dosing line operations, and emergency response.",
      impactMatrixId: MATRIX_5X5,
      teamLeaderId: envMgr,
      status: "ACTIVE",
      initiatedAt: daysAgo(90),
      targetCompletionDate: daysAgo(30),
      completedAt: daysAgo(35),
      approvedAt: daysAgo(30),
      approvedById: hseMgr,
      effectiveFrom: daysAgo(25),
      nextScheduledReviewDate: daysFromNow(340),
      reviewFrequency: "ANNUAL",
      applicableRegulations: ["EPA_1986", "AIR_ACT_1981", "WATER_ACT_1974"],
      regulatoryReviewRequired: true,
      aggregateMetrics: {
        totalEntries: 4,
        significantEntries: 2,
        highImpactEntries: 1,
        controlCoverage: 0.92,
      },
      createdById: envMgr,
      createdAt: daysAgo(90),
      updatedAt: daysAgo(25),
    },
  });

  // Team member for study 1
  await prisma.eaiStudyTeamMember.create({
    data: {
      studyId: study1.id,
      userId: hseMgr,
      teamRole: "ENVIRONMENT_MANAGER",
      department: "HSE",
      signedAt: daysAgo(32),
      signedNote: "Reviewed and accepted environmental impact findings.",
    },
  });

  // Entries for study 1
  const entries1 = [
    {
      seq: 1,
      groupLabel: "Dye Store Chemical Handling",
      activity: "Unloading and storage of dye-bath chemical drums from tanker",
      areaId: areaChem,
      subLocation: "Chemical & dye store drum cage, unloading bay",
      occurrence: "ABNORMAL",
      frequency: "WEEKLY",
      duration: 120,
      initLhId: LH_UNLIKELY, initLhScore: 2, initLhRationale: "Drum integrity controlled by supplier; double-bund protection",
      initMagId: MAG_MAJOR, initMagScore: 4, initMagRationale: "Chemical vapour release could cause significant air quality impact and community risk",
      initImpactScore: 8, initImpactLevel: "MODERATE",
      resLhId: LH_RARE, resLhScore: 1, resLhRationale: "Buddy system + respirator mandatory; checklist completed at each delivery",
      resMagId: MAG_MODERATE, resMagScore: 3, resMagRationale: "Mitigation through vapour detection and rapid ERP activation",
      resImpactScore: 3, resImpactLevel: "LOW",
      resAcceptable: true,
      significant: true,
      compliance: "COMPLIANT",
      aspectId: ASP_AIR_PM,
      receptorCode: "AIR",
      impactDesc: "Atmospheric chemical vapour release to ambient air, potential toxicity to nearby communities and wildlife",
      impactType: "DIRECT",
      reversibility: "REVERSIBLE",
      geoExtent: "LOCAL",
      temporalExtent: "SHORT_TERM",
      controlHierarchy: "ENGINEERING",
      controlDesc: "Bunded chemical store with ventilation, fixed vapour detection with audible alarm threshold, respirator station at entry",
      controlHierarchy2: "ADMINISTRATIVE",
      controlDesc2: "Mandatory pre-delivery inspection checklist, permit required, authorised personnel only, buddy system enforced",
      regId: REG_AIR,
      regCode: "AIR_ACT_1981",
      status: "ACTIVE" as const,
    },
    {
      seq: 2,
      groupLabel: "Dye Dosing Operations",
      activity: "Continuous dye and auxiliary chemical dosing via metering pumps into soft-flow dyeing machines",
      areaId: areaProcessA,
      subLocation: "Dye house dosing room, chemical dosing skid",
      occurrence: "NORMAL",
      frequency: "CONTINUOUS",
      duration: 1440,
      initLhId: LH_POSSIBLE, initLhScore: 3, initLhRationale: "Pressurised dosing line; minor leaks possible at connections",
      initMagId: MAG_MINOR, initMagScore: 2, initMagRationale: "Controlled indoor environment; diluted chemical concentrations",
      initImpactScore: 6, initImpactLevel: "MODERATE",
      resLhId: LH_UNLIKELY, resLhScore: 2, resLhRationale: "Monthly connection inspection and torque verification",
      resMagId: MAG_MINOR, resMagScore: 2, resMagRationale: "Indoor ventilation and vapour detection minimise escape",
      resImpactScore: 4, resImpactLevel: "LOW",
      resAcceptable: true,
      significant: false,
      compliance: "COMPLIANT",
      aspectId: ASP_AIR_PM,
      receptorCode: "AIR",
      impactDesc: "Fugitive chemical vapour emission inside dosing room affecting indoor air quality and operator health",
      impactType: "DIRECT",
      reversibility: "REVERSIBLE",
      geoExtent: "SITE",
      temporalExtent: "SHORT_TERM",
      controlHierarchy: "ENGINEERING",
      controlDesc: "Continuous vapour monitoring with alarm, forced ventilation at 10 ACH, eyewash station within 10 m",
      controlHierarchy2: "PPE",
      controlDesc2: "Half-mask respirator with chemical cartridge mandatory during maintenance; SCBA available for emergency",
      regId: REG_AIR,
      regCode: "AIR_ACT_1981",
      status: "ACTIVE" as const,
    },
    {
      seq: 3,
      groupLabel: "Dye House Effluent to ETP",
      activity: "Dye-house effluent discharge to ETP after dyeing and rinsing stages",
      areaId: areaUtil,
      subLocation: "Effluent Treatment Plant inlet channel",
      occurrence: "NORMAL",
      frequency: "CONTINUOUS",
      duration: 1440,
      initLhId: LH_LIKELY, initLhScore: 4, initLhRationale: "Process always running; discharge is continuous",
      initMagId: MAG_MINOR, initMagScore: 2, initMagRationale: "Treatment step prior to ETP; colour/COD/TDS levels within consent",
      initImpactScore: 8, initImpactLevel: "MODERATE",
      resLhId: LH_POSSIBLE, resLhScore: 3, resLhRationale: "Continuous online COD/colour monitoring at discharge point",
      resMagId: MAG_MINOR, resMagScore: 2, resMagRationale: "Tertiary + biological treatment provides adequate buffer",
      resImpactScore: 6, resImpactLevel: "MODERATE",
      resAcceptable: true,
      significant: true,
      compliance: "COMPLIANT",
      aspectId: ASP_AIR_PM,
      receptorCode: "SURFACE_WATER",
      impactDesc: "Dye-house effluent (colour, COD, BOD, TDS, pH, residual dye chemicals/heavy metals) causing aquatic toxicity in receiving water body if treatment failure occurs",
      impactType: "DIRECT",
      reversibility: "REVERSIBLE",
      geoExtent: "LOCAL",
      temporalExtent: "SHORT_TERM",
      controlHierarchy: "ENGINEERING",
      controlDesc: "Low-liquor-ratio soft-flow dyeing with dye-bath reuse, online COD/colour analyser with high-alarm shutdown interlock",
      controlHierarchy2: "ADMINISTRATIVE",
      controlDesc2: "Daily effluent sampling and lab analysis, monthly third-party compliance test per consent conditions",
      regId: REG_WATER,
      regCode: "WATER_ACT_1974",
      status: "ACTIVE" as const,
    },
    {
      seq: 4,
      groupLabel: "Dye House Chemical Spill / Emergency Response",
      activity: "Dye chemical spill — emergency shutdown and ERP activation",
      areaId: areaChem,
      subLocation: "Any point in chemical & dye store system",
      occurrence: "EMERGENCY",
      frequency: "RARE",
      duration: 180,
      initLhId: LH_RARE, initLhScore: 1, initLhRationale: "Multiple barriers; formal ERP with drilled response",
      initMagId: MAG_MAJOR, initMagScore: 4, initMagRationale: "Full drum release to drainage — significant community impact",
      initImpactScore: 4, initImpactLevel: "LOW",
      resLhId: LH_RARE, resLhScore: 1, resLhRationale: "Annual ERP drill; automatic shutdown valve tested quarterly",
      resMagId: MAG_MODERATE, resMagScore: 3, resMagRationale: "Rapid isolation + bunded containment limits spill extent",
      resImpactScore: 3, resImpactLevel: "LOW",
      resAcceptable: true,
      significant: false,
      compliance: "COMPLIANT",
      aspectId: ASP_AIR_PM,
      receptorCode: "AIR",
      impactDesc: "Acute chemical vapour and spill impacting on-site workers, neighbouring community, and ambient air quality",
      impactType: "DIRECT",
      reversibility: "REVERSIBLE",
      geoExtent: "REGIONAL",
      temporalExtent: "SHORT_TERM",
      controlHierarchy: "ENGINEERING",
      controlDesc: "Automatic shut-off valve (ASOv) on dosing header, pneumatically operated from control room; bunded containment at store boundary",
      controlHierarchy2: "ADMINISTRATIVE",
      controlDesc2: "Documented emergency response plan, community notification protocol, annual full-scale drill with evacuation exercise",
      regId: REG_EPA,
      regCode: "EPA_1986",
      status: "ACTIVE" as const,
    },
  ];

  for (const e of entries1) {
    const entry = await prisma.eaiEntry.create({
      data: {
        studyId: study1.id,
        sequenceNumber: e.seq,
        groupLabel: e.groupLabel,
        activityDescription: e.activity,
        areaId: e.areaId,
        subLocation: e.subLocation,
        occurrence: e.occurrence,
        frequency: e.frequency,
        typicalDurationMin: e.duration,
        materialsUsed: ["Reactive / disperse dyes", "Dye-bath chemicals (NaOH, soda ash)"],
        processInputs: ["Greige fabric & process water", "Electricity"],
        initialLikelihoodId: e.initLhId,
        initialLikelihoodScore: e.initLhScore,
        initialLikelihoodRationale: e.initLhRationale,
        initialMagnitudeId: e.initMagId,
        initialMagnitudeScore: e.initMagScore,
        initialMagnitudeRationale: e.initMagRationale,
        initialImpactScore: e.initImpactScore,
        initialImpactLevel: e.initImpactLevel,
        initialImpactColor: e.initImpactLevel === "LOW" ? "#22c55e" : e.initImpactLevel === "MODERATE" ? "#f59e0b" : "#ef4444",
        initialSignificant: e.significant,
        residualLikelihoodId: e.resLhId,
        residualLikelihoodScore: e.resLhScore,
        residualLikelihoodRationale: e.resLhRationale,
        residualMagnitudeId: e.resMagId,
        residualMagnitudeScore: e.resMagScore,
        residualMagnitudeRationale: e.initMagRationale,
        residualImpactScore: e.resImpactScore,
        residualImpactLevel: e.resImpactLevel,
        residualImpactColor: e.resImpactLevel === "LOW" ? "#22c55e" : "#f59e0b",
        residualAcceptable: e.resAcceptable,
        residualAcceptanceRationale: "Residual risk is within acceptable limits per corporate risk tolerance matrix.",
        residualSignificant: false,
        legalComplianceStatus: e.compliance,
        lastReviewedAt: daysAgo(30),
        lastReviewedById: envMgr,
        nextReviewDue: daysFromNow(335),
        reviewCount: 1,
        lastReviewType: "SCHEDULED",
        status: e.status,
        versionNumber: 1,
        isCurrentVersion: true,
        createdById: envMgr,
        createdAt: daysAgo(85),
        updatedAt: daysAgo(30),
      },
    });

    // Aspect
    await prisma.eaiEntryAspect.create({
      data: {
        entryId: entry.id,
        aspectId: e.aspectId,
        contextualDescription: `Environmental aspect relevant to ${e.activity.toLowerCase()}`,
        quantification: { parameter: "Emission rate", typicalValue: "< consent limit", unit: "mg/Nm³", monitoringPoint: "Stack/outlet" },
        occurrence: e.occurrence,
        sortOrder: 1,
      },
    });

    // Impact
    await prisma.eaiEntryImpact.create({
      data: {
        entryId: entry.id,
        description: e.impactDesc,
        affectedReceptor: e.receptorCode,
        impactType: e.impactType,
        reversibility: e.reversibility,
        geographicExtent: e.geoExtent,
        temporalExtent: e.temporalExtent,
        sortOrder: 1,
      },
    });

    // Controls × 2
    await prisma.eaiEntryControl.createMany({
      data: [
        {
          entryId: entry.id,
          hierarchy: e.controlHierarchy,
          description: e.controlDesc,
          effectiveness: "HIGH",
          verificationMethod: "Inspection and monitoring",
          verificationFreq: "MONTHLY",
          responsibleRole: "ENVIRONMENT_MANAGER",
        },
        {
          entryId: entry.id,
          hierarchy: e.controlHierarchy2,
          description: e.controlDesc2,
          effectiveness: "MEDIUM",
          verificationMethod: "Audit and records review",
          verificationFreq: "QUARTERLY",
          responsibleRole: "HSE_MANAGER",
        },
      ],
    });

    // Regulation ref
    await prisma.eaiEntryRegulationRef.create({
      data: {
        entryId: entry.id,
        regulationCode: e.regCode,
        section: "General provisions",
        requirementSummary: "Emissions within prescribed consent limits; maintain records for 5 years.",
      },
    });
  }

  // Study 2 — Boiler / Utilities Operations (APPROVED)
  const study2Number = `EAI-2026-${code}-DEMO-002`;
  const study2 = await prisma.eaiStudy.create({
    data: {
      number: study2Number,
      plantId,
      areaId: areaUtil,
      scopeType: "AREA",
      title: `Boiler & Utilities Operations — ${code} Environmental Impact Study`,
      description:
        "Environmental aspect and impact assessment for boiler combustion, cooling tower operation, compressed air generation, and DG set operation.",
      impactMatrixId: MATRIX_5X5,
      teamLeaderId: envMgr,
      status: "APPROVED",
      initiatedAt: daysAgo(60),
      targetCompletionDate: daysAgo(10),
      completedAt: daysAgo(12),
      approvedAt: daysAgo(8),
      approvedById: hseMgr,
      effectiveFrom: daysAgo(5),
      nextScheduledReviewDate: daysFromNow(360),
      reviewFrequency: "ANNUAL",
      applicableRegulations: ["EPA_1986", "AIR_ACT_1981"],
      regulatoryReviewRequired: true,
      aggregateMetrics: {
        totalEntries: 4,
        significantEntries: 3,
        highImpactEntries: 1,
        controlCoverage: 0.88,
      },
      createdById: envMgr,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(5),
    },
  });

  const entries2 = [
    {
      seq: 1, groupLabel: "Combustion Emissions",
      activity: "Coal & biomass combustion in multi-fuel boiler for steam generation",
      areaId: areaUtil, subLocation: "Boiler house — Boiler #1 and #2",
      occurrence: "NORMAL", frequency: "CONTINUOUS", duration: 1440,
      initLhId: LH_LIKELY, initLhScore: 4, initLhRationale: "Continuous combustion operation",
      initMagId: MAG_MODERATE, initMagScore: 3, initMagRationale: "SPM, SO2, NOx and CO2 within typical industrial boiler limits",
      initImpactScore: 12, initImpactLevel: "SIGNIFICANT",
      resLhId: LH_LIKELY, resLhScore: 4, resLhRationale: "Continuous operation — likelihood unchanged",
      resMagId: MAG_MINOR, resMagScore: 2, resMagRationale: "Excess air optimisation and stack monitoring reduce impact",
      resImpactScore: 8, resImpactLevel: "MODERATE",
      resAcceptable: true, significant: true, compliance: "COMPLIANT",
      aspectId: ASP_AIR_NOX, receptorCode: "AIR",
      impactDesc: "Stack SPM, SO2, NOx and CO2 emissions affecting ambient air quality and contributing to GHG inventory",
      impactType: "DIRECT", reversibility: "REVERSIBLE", geoExtent: "REGIONAL", temporalExtent: "LONG_TERM",
      controlHierarchy: "ENGINEERING", controlDesc: "Electrostatic precipitator for SPM control, continuous stack monitoring (CEMS) with data logging to SPCB portal",
      controlHierarchy2: "ADMINISTRATIVE", controlDesc2: "Annual stack emission test by NABL-accredited laboratory, GHG accounting in annual sustainability report",
      regId: REG_AIR, regCode: "AIR_ACT_1981", status: "ACTIVE" as const,
    },
    {
      seq: 2, groupLabel: "Cooling Tower Operations",
      activity: "Cooling tower blowdown and chemical dosing for scale/biofouling control",
      areaId: areaUtil, subLocation: "Cooling tower basin",
      occurrence: "NORMAL", frequency: "DAILY", duration: 30,
      initLhId: LH_POSSIBLE, initLhScore: 3, initLhRationale: "Daily blowdown; potential for chemical drift",
      initMagId: MAG_MODERATE, initMagScore: 3, initMagRationale: "Biocide and antiscalant chemicals in blowdown water",
      initImpactScore: 9, initImpactLevel: "MODERATE",
      resLhId: LH_UNLIKELY, resLhScore: 2, resLhRationale: "Blowdown collected in dedicated sump, not directly discharged",
      resMagId: MAG_MINOR, resMagScore: 2, resMagRationale: "Treatment before ETP; COD within consent",
      resImpactScore: 4, resImpactLevel: "LOW",
      resAcceptable: true, significant: false, compliance: "COMPLIANT",
      aspectId: ASP_AIR_DUST, receptorCode: "SURFACE_WATER",
      impactDesc: "Chemical-laden blowdown water entering drainage and receiving water body, aquatic toxicity risk",
      impactType: "INDIRECT", reversibility: "REVERSIBLE", geoExtent: "LOCAL", temporalExtent: "MEDIUM_TERM",
      controlHierarchy: "ENGINEERING", controlDesc: "Blowdown collection sump with transfer pump to ETP; chemical inventory management system",
      controlHierarchy2: "ADMINISTRATIVE", controlDesc2: "Weekly blowdown water quality test; chemical supplier MSDS review; quantity tracking",
      regId: REG_WATER, regCode: "WATER_ACT_1974", status: "ACTIVE" as const,
    },
    {
      seq: 3, groupLabel: "DG Set Emergency Operation",
      activity: "Emergency DG set operation during grid power failure",
      areaId: areaUtil, subLocation: "DG building — 750 kVA set",
      occurrence: "EMERGENCY", frequency: "MONTHLY", duration: 60,
      initLhId: LH_POSSIBLE, initLhScore: 3, initLhRationale: "Grid outages occur several times per year; DG monthly load test",
      initMagId: MAG_MODERATE, initMagScore: 3, initMagRationale: "HSD combustion — PM, NOx, SO2 emissions during operation",
      initImpactScore: 9, initImpactLevel: "MODERATE",
      resLhId: LH_UNLIKELY, resLhScore: 2, resLhRationale: "Grid reliability improving; DG runtime < 100 h/yr",
      resMagId: MAG_MINOR, resMagScore: 2, resMagRationale: "Short runtime limits cumulative impact",
      resImpactScore: 4, resImpactLevel: "LOW",
      resAcceptable: true, significant: false, compliance: "COMPLIANT",
      aspectId: ASP_AIR_SOX, receptorCode: "AIR",
      impactDesc: "Diesel exhaust emissions (PM, NOx, SO2) from DG set affecting ambient air quality near residential area",
      impactType: "DIRECT", reversibility: "REVERSIBLE", geoExtent: "LOCAL", temporalExtent: "SHORT_TERM",
      controlHierarchy: "ENGINEERING", controlDesc: "Ultra-low sulphur diesel (ULSD) fuel only; CPCB-certified DG set with stack height per guidelines",
      controlHierarchy2: "ADMINISTRATIVE", controlDesc2: "Runtime log maintained; annual emission test; replacement with grid-tied renewable supply planned FY27",
      regId: REG_AIR, regCode: "AIR_ACT_1981", status: "ACTIVE" as const,
    },
    {
      seq: 4, groupLabel: "GHG Emissions — Scope 1",
      activity: "Total Scope 1 GHG emissions from all fuel combustion on site",
      areaId: areaUtil, subLocation: "All fuel-burning equipment",
      occurrence: "NORMAL", frequency: "CONTINUOUS", duration: 1440,
      initLhId: LH_LIKELY, initLhScore: 4, initLhRationale: "Continuous Scope 1 source — certainty of emission",
      initMagId: MAG_MAJOR, initMagScore: 4, initMagRationale: "3,200 tCO2e/yr — significant in absolute terms",
      initImpactScore: 16, initImpactLevel: "SIGNIFICANT",
      resLhId: LH_LIKELY, resLhScore: 4, resLhRationale: "Emissions ongoing — likelihood management only via technology change",
      resMagId: MAG_MODERATE, resMagScore: 3, resMagRationale: "Efficiency improvements in progress; SBT pathway to -30% by 2028",
      resImpactScore: 12, resImpactLevel: "SIGNIFICANT",
      resAcceptable: true, significant: true, compliance: "COMPLIANT",
      aspectId: ASP_GHG_CO2, receptorCode: "AIR",
      impactDesc: "Climate change contribution from fossil fuel combustion; regulatory disclosure risk under Carbon Border Adjustment Mechanism",
      impactType: "DIRECT", reversibility: "IRREVERSIBLE", geoExtent: "GLOBAL", temporalExtent: "PERMANENT",
      controlHierarchy: "ENGINEERING", controlDesc: "Variable frequency drives on pumps, waste heat recovery on boiler, LED lighting upgrade completed FY26",
      controlHierarchy2: "ADMINISTRATIVE", controlDesc2: "ISO 14064 GHG inventory, third-party verification, Science Based Targets commitment for 30% reduction by 2028",
      regId: REG_EPA, regCode: "EPA_1986", status: "ACTIVE" as const,
    },
  ];

  for (const e of entries2) {
    const entry = await prisma.eaiEntry.create({
      data: {
        studyId: study2.id,
        sequenceNumber: e.seq,
        groupLabel: e.groupLabel,
        activityDescription: e.activity,
        areaId: e.areaId,
        subLocation: e.subLocation,
        occurrence: e.occurrence,
        frequency: e.frequency,
        typicalDurationMin: e.duration,
        processInputs: ["Coal & biomass fuel", "Electricity", "Water"],
        initialLikelihoodId: e.initLhId,
        initialLikelihoodScore: e.initLhScore,
        initialLikelihoodRationale: e.initLhRationale,
        initialMagnitudeId: e.initMagId,
        initialMagnitudeScore: e.initMagScore,
        initialMagnitudeRationale: e.initMagRationale,
        initialImpactScore: e.initImpactScore,
        initialImpactLevel: e.initImpactLevel,
        initialImpactColor: "#f59e0b",
        initialSignificant: e.significant,
        residualLikelihoodId: e.resLhId,
        residualLikelihoodScore: e.resLhScore,
        residualMagnitudeId: e.resMagId,
        residualMagnitudeScore: e.resMagScore,
        residualImpactScore: e.resImpactScore,
        residualImpactLevel: e.resImpactLevel,
        residualImpactColor: e.resImpactLevel === "LOW" ? "#22c55e" : "#f59e0b",
        residualAcceptable: e.resAcceptable,
        residualAcceptanceRationale: "Residual risk within corporate tolerance; active reduction programme in place.",
        residualSignificant: e.resImpactScore > 9,
        legalComplianceStatus: e.compliance,
        lastReviewedAt: daysAgo(8),
        lastReviewedById: envMgr,
        nextReviewDue: daysFromNow(357),
        reviewCount: 1,
        lastReviewType: "SCHEDULED",
        status: e.status,
        versionNumber: 1,
        isCurrentVersion: true,
        createdById: envMgr,
        createdAt: daysAgo(55),
        updatedAt: daysAgo(8),
      },
    });

    await prisma.eaiEntryAspect.create({
      data: {
        entryId: entry.id,
        aspectId: e.aspectId,
        contextualDescription: `Environmental aspect for ${e.activity.toLowerCase()}`,
        sortOrder: 1,
      },
    });
    await prisma.eaiEntryImpact.create({
      data: {
        entryId: entry.id,
        description: e.impactDesc,
        affectedReceptor: e.receptorCode,
        impactType: e.impactType,
        reversibility: e.reversibility,
        geographicExtent: e.geoExtent,
        temporalExtent: e.temporalExtent,
        sortOrder: 1,
      },
    });
    await prisma.eaiEntryControl.createMany({
      data: [
        { entryId: entry.id, hierarchy: e.controlHierarchy, description: e.controlDesc, effectiveness: "HIGH", verificationMethod: "Inspection", verificationFreq: "MONTHLY", responsibleRole: "ENVIRONMENT_MANAGER" },
        { entryId: entry.id, hierarchy: e.controlHierarchy2, description: e.controlDesc2, effectiveness: "MEDIUM", verificationMethod: "Audit", verificationFreq: "ANNUAL", responsibleRole: "HSE_MANAGER" },
      ],
    });
    await prisma.eaiEntryRegulationRef.create({
      data: { entryId: entry.id, regulationCode: e.regCode, section: "Emission standards", requirementSummary: "Comply with prescribed stack emission limits." },
    });
  }

  console.log(`  ✅  ${code}: 2 EAI studies, 8 entries with aspects/impacts/controls/regs`);
}

// Resolve the team-leader (ENVIRONMENT_MANAGER) and approver (HSE_MANAGER)
// for a plant, falling back to any user in that plant if the exact role
// is missing so the seed never dies on a missing role.
async function resolveUser(plantId: string, role: string): Promise<string> {
  const byRole = await prisma.user.findFirst({ where: { plantId, role } });
  if (byRole) return byRole.id;
  const anyUser = await prisma.user.findFirst({ where: { plantId } });
  if (!anyUser) {
    throw new Error(`No user found for plant ${plantId} (role ${role})`);
  }
  return anyUser.id;
}

// Resolve a plant area by a substring of its name.
async function resolveArea(plantId: string, contains: string): Promise<string> {
  const area = await prisma.area.findFirstOrThrow({
    where: { plantId, name: { contains } },
  });
  return area.id;
}

// Resolve all global EAI masters once (created by prisma/seed-eai-masters.ts).
async function resolveMasters(): Promise<Masters> {
  const matrix = await prisma.environmentalImpactMatrix.findFirstOrThrow({
    where: { code: "ENV_5X5_STD" },
  });

  const lh = async (score: number) =>
    (
      await prisma.environmentalImpactMatrixLikelihood.findFirstOrThrow({
        where: { matrixId: matrix.id, score },
      })
    ).id;
  const mag = async (score: number) =>
    (
      await prisma.environmentalImpactMatrixMagnitude.findFirstOrThrow({
        where: { matrixId: matrix.id, score },
      })
    ).id;
  const aspect = async (code: string) =>
    (await prisma.eaiAspect.findFirstOrThrow({ where: { code } })).id;
  const reg = async (code: string) =>
    (await prisma.eaiRegulation.findFirstOrThrow({ where: { code } })).id;

  return {
    matrix5x5: matrix.id,
    lhRare: await lh(1),
    lhUnlikely: await lh(2),
    lhPossible: await lh(3),
    lhLikely: await lh(4),
    magMinor: await mag(2),
    magModerate: await mag(3),
    magMajor: await mag(4),
    aspAirPm: await aspect("AIR_STACK_PM"),
    aspAirSox: await aspect("AIR_STACK_SOX"),
    aspAirNox: await aspect("AIR_STACK_NOX"),
    aspAirDust: await aspect("AIR_FUGITIVE_DUST"),
    aspGhgCo2: await aspect("AIR_GHG_CO2"),
    regEpa: await reg("EPA_1986"),
    regAir: await reg("AIR_ACT_1981"),
    regWater: await reg("WATER_ACT_1974"),
  };
}

async function main() {
  console.log("Deleting existing EAI demo study records…");
  const existing = await prisma.eaiStudy.findMany({ where: { number: { contains: "-DEMO-" } } });
  for (const s of existing) {
    await prisma.eaiEntry.deleteMany({ where: { studyId: s.id } });
  }
  await prisma.eaiStudy.deleteMany({ where: { number: { contains: "-DEMO-" } } });

  // ── Resolve global masters once ──
  const masters = await resolveMasters();

  // ── Resolve plant, user and area ids dynamically ──
  const nwPlant = await prisma.plant.findFirstOrThrow({ where: { code: "NW" } });
  const swPlant = await prisma.plant.findFirstOrThrow({ where: { code: "SW" } });

  const NW = nwPlant.id;
  const SW = swPlant.id;

  const ENV_MGR_NW = await resolveUser(NW, "ENVIRONMENT_MANAGER");
  const HSE_MGR_NW = await resolveUser(NW, "HSE_MANAGER");
  const ENV_MGR_SW = await resolveUser(SW, "ENVIRONMENT_MANAGER");
  const HSE_MGR_SW = await resolveUser(SW, "HSE_MANAGER");

  const AREA_NW_CHEM = await resolveArea(NW, "Chemical");
  const AREA_NW_UTIL = await resolveArea(NW, "Boiler House");
  const AREA_NW_PROCESS_A = await resolveArea(NW, "Dye House");
  const AREA_SW_CHEM = await resolveArea(SW, "Chemical");
  const AREA_SW_UTIL = await resolveArea(SW, "Boiler House");
  const AREA_SW_PROCESS_A = await resolveArea(SW, "Dye House");

  await seedPlant(NW, "NW", ENV_MGR_NW, HSE_MGR_NW, AREA_NW_CHEM, AREA_NW_UTIL, AREA_NW_PROCESS_A, masters);
  await seedPlant(SW, "SW", ENV_MGR_SW, HSE_MGR_SW, AREA_SW_CHEM, AREA_SW_UTIL, AREA_SW_PROCESS_A, masters);

  console.log("✅  EAI seed complete — 4 studies, 16 entries total");
}

main().catch(console.error).finally(() => prisma.$disconnect());
