// ─────────────────────────────────────────────────────────────────────────────
// Step 27 — EPC (Engineering, Procurement & Construction) Site Data
//
// Creates:
//   • 2 ConstructionSites (NW expansion + SW greenfield)
//   • 5 ContractorWorkers per contractor company (2 companies × 5 = 10 workers)
//   • MobilizationRecord per worker per site (10 records)
//   • SiteInduction per mobilization (10 records)
//   • GateClearanceCheck + GatePass for cleared workers (8 records)
//
// Idempotent: deletes sites with siteCode containing "DEMO" before recreating.
// Run: npx tsx prisma/seed-epc-data.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-07T08:00:00.000Z");
function daysAgo(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; }

// ── ID resolution ──
// NOTE: User and ContractorCompany primary keys (CUIDs) are NOT hardcoded.
// They are resolved dynamically at the start of main() via Prisma lookups so
// that this seed survives a fresh re-seed (new CUIDs each run).
//
// Helper: resolve a user by role within a plant, falling back to any user in
// the plant if no user holds that role (keeps the seed resilient).
async function userByRoleInPlant(role: string, plantId: string): Promise<string> {
  const byRole = await prisma.user.findFirst({ where: { role, plantId } });
  if (byRole) return byRole.id;
  const anyInPlant = await prisma.user.findFirstOrThrow({ where: { plantId } });
  return anyInPlant.id;
}

async function main() {
  console.log("Resolving user and contractor ids dynamically…");

  // ── Plants (used to scope user lookups) ──
  const nwPlant = await prisma.plant.findFirstOrThrow({ where: { code: "NW" } });
  const swPlant = await prisma.plant.findFirstOrThrow({ where: { code: "SW" } });

  // ── Users (role code → User.role; scoped by plant where applicable) ──
  const CONT_COORD_NW = await userByRoleInPlant("CONTRACTOR_COORDINATOR", nwPlant.id);
  const CONT_COORD_SW = await userByRoleInPlant("CONTRACTOR_COORDINATOR", swPlant.id);
  const HSE_MGR_NW    = await userByRoleInPlant("HSE_MANAGER", nwPlant.id);
  const HSE_MGR_SW    = await userByRoleInPlant("HSE_MANAGER", swPlant.id);
  const ADMIN         = (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id;

  // ── Contractor Companies (by code from seed-masters CONTRACTORS) ──
  const VIZIONFORGE = (await prisma.contractorCompany.findFirstOrThrow({ where: { code: "VFC" } })).id;
  const STAR_ERECT  = (await prisma.contractorCompany.findFirstOrThrow({ where: { code: "SES" } })).id;
  const NE_MECH     = (await prisma.contractorCompany.findFirstOrThrow({ where: { code: "NEMW" } })).id;
  void NE_MECH; // resolved to keep the contractor↔code mapping complete; not referenced below

  console.log("Deleting existing EPC DEMO records…");
  const oldSites = await prisma.constructionSite.findMany({ where: { siteCode: { contains: "DEMO" } } });
  for (const site of oldSites) {
    await prisma.gateClearanceCheck.deleteMany({ where: { siteId: site.id } });
    await prisma.gatePass.deleteMany({ where: { siteId: site.id } });
    await prisma.siteInduction.deleteMany({ where: { siteId: site.id } });
    await prisma.mobilizationRecord.deleteMany({ where: { siteId: site.id } });
  }
  await prisma.constructionSite.deleteMany({ where: { siteCode: { contains: "DEMO" } } });
  const oldWorkers = await prisma.contractorWorker.findMany({ where: { workerCode: { contains: "DEMO" } } });
  await prisma.contractorWorker.deleteMany({ where: { workerCode: { contains: "DEMO" } } });

  // ── Site 1: NW Expansion ──
  const siteNW = await prisma.constructionSite.create({
    data: {
      siteCode: "DEMO-NW-EXP-2026",
      siteName: "Page Industries — North Garment Unit (Hassan) — Utilities Expansion Block C",
      projectNumber: "MML-PROJ-2026-NW-004",
      clientName: "Page Industries Limited",
      clientContactName: "Rajesh Patel",
      clientContactEmail: "rajesh.patel@pageindustries.in",
      clientProjectManager: "Sunita Ghosh",
      address: "North Garment Unit Campus, Block C Extension, Andheri East, Mumbai",
      district: "Mumbai Suburban",
      state: "Maharashtra",
      lat: 19.1136,
      lng: 72.8697,
      projectType: "PLANT_EXPANSION",
      scopeDescription:
        "Construction of new Utilities Block C comprising: 2 × 15 TPH boilers, cooling tower, compressed air station, electrical substation (11kV/415V), and interconnecting piping. Civil, structural, mechanical, electrical and instrumentation scope.",
      contractValue: 185000000,
      contractCurrency: "INR",
      status: "active_construction",
      awardDate: daysAgo(180),
      plannedStartDate: daysAgo(150),
      plannedCompletionDate: daysFromNow(60),
      actualStartDate: daysAgo(148),
      peakWorkforcePlanned: 120,
      siteManagerUserId: CONT_COORD_NW,
      siteHseManagerUserId: HSE_MGR_NW,
      corporateHseOwnerUserId: ADMIN,
      statutoryApprovals: [
        { type: "Building Plan Approval", authority: "MCGM", number: "MCGM/BP/2026/0142", date: "2026-01-15", status: "approved" },
        { type: "Environmental Clearance", authority: "MPCB", number: "MPCB/EC/2026/0089", date: "2026-02-01", status: "approved" },
        { type: "Fire NOC", authority: "Mumbai Fire Brigade", number: "MFB/NOC/2026/0312", date: "2026-02-20", status: "approved" },
      ],
      createdById: ADMIN,
    },
  });

  // Compliance config for NW site
  await prisma.siteComplianceConfig.create({
    data: {
      siteId: siteNW.id,
      clientName: "Page Industries Limited",
      ptwConfig: { required: true, types: ["hot_work", "confined_space", "electrical", "work_at_height"], colourCoded: true },
      inductionConfig: { required: true, durationMinutes: 90, passMark: 70, languages: ["Hindi", "English", "Marathi"] },
      gateConfig: { biometricRequired: false, gatePassRequired: true, photoRequired: false },
      mandatoryTraining: ["construction_safety_induction", "working_at_height", "first_aid"],
      minimumPpeRequirements: ["HELMET-INDUSTRIAL", "BOOTS-SAFETY", "VEST-HV", "GLOVES-GENERAL"],
      kpiTargets: { ltifr: 0, firstAidFrequency: 2.0, nearMissReportingRate: 0.9 },
      effectiveFrom: daysAgo(148),
      approvedById: HSE_MGR_NW,
      approvedAt: daysAgo(150),
    },
  });

  // ── Site 2: SW Greenfield ──
  const siteSW = await prisma.constructionSite.create({
    data: {
      siteCode: "DEMO-SW-GF-2025",
      siteName: "Page Industries — South Garment Unit (Tiptur) — New Sewing Block SB-3 Erection",
      projectNumber: "MML-PROJ-2025-SW-007",
      clientName: "Page Industries Limited",
      clientContactName: "Pradeep Kumar",
      clientContactEmail: "pradeep.kumar@pageindustries.in",
      clientProjectManager: "Meera Iyer",
      address: "South Garment Unit Campus, Plot 7A, Taloja Industrial Area, Navi Mumbai",
      district: "Raigad",
      state: "Maharashtra",
      lat: 19.0456,
      lng: 73.1189,
      projectType: "GREENFIELD",
      scopeDescription:
        "Greenfield erection of new Sewing Block SB-3 (additional stitching lines & finishing) comprising: production hall building, cutting room (spreading & band-knife area), sewing/stitching line floors, checking & finishing (AQL) area, pressing & ironing bay, process utilities, ETP capacity addition, and supporting infrastructure.",
      contractValue: 430000000,
      contractCurrency: "INR",
      status: "active_construction",
      awardDate: daysAgo(365),
      plannedStartDate: daysAgo(330),
      plannedCompletionDate: daysFromNow(120),
      actualStartDate: daysAgo(328),
      peakWorkforcePlanned: 280,
      siteManagerUserId: CONT_COORD_SW,
      siteHseManagerUserId: HSE_MGR_SW,
      corporateHseOwnerUserId: ADMIN,
      statutoryApprovals: [
        { type: "Environmental Clearance — Category B", authority: "SEIAA Maharashtra", number: "SEIAA/EC/2025/0214", date: "2025-03-12", status: "approved" },
        { type: "Consent to Establish", authority: "MPCB", number: "MPCB/CTE/2025/0567", date: "2025-04-01", status: "approved" },
        { type: "Factory Plan Approval", authority: "Maharashtra Factories Inspectorate", number: "MFI/PA/2025/0089", date: "2025-04-15", status: "approved" },
        { type: "PESO NOC — HSD & Fuel Oil Storage", authority: "PESO", number: "PESO/NOC/2025/1143", date: "2025-05-01", status: "approved" },
      ],
      createdById: ADMIN,
    },
  });

  await prisma.siteComplianceConfig.create({
    data: {
      siteId: siteSW.id,
      clientName: "Page Industries Limited",
      ptwConfig: { required: true, types: ["hot_work", "confined_space", "electrical", "work_at_height", "excavation", "chemical_handling"], colourCoded: true },
      inductionConfig: { required: true, durationMinutes: 120, passMark: 75, languages: ["Hindi", "English", "Tamil", "Telugu"] },
      gateConfig: { biometricRequired: true, gatePassRequired: true, photoRequired: true },
      mandatoryTraining: ["construction_safety_induction", "working_at_height", "first_aid", "chemical_handling_awareness", "confined_space_awareness"],
      minimumPpeRequirements: ["HELMET-INDUSTRIAL", "BOOTS-SAFETY", "VEST-HV", "GLOVES-CHEMICAL", "GOGGLES-CHEM", "COVERALL-FR"],
      kpiTargets: { ltifr: 0, firstAidFrequency: 1.5, nearMissReportingRate: 0.95, toolboxTalkFrequency: 1.0 },
      effectiveFrom: daysAgo(328),
      approvedById: HSE_MGR_SW,
      approvedAt: daysAgo(330),
    },
  });

  // ── Contractor Workers ──
  type WorkerSpec = {
    code: string; contractorId: string; name: string; dob: Date; gender: string;
    blood: string; mobile: string; trade: string; exp: number; edu: string;
    homeState: string; homeDistrict: string;
  };

  const workerSpecs: WorkerSpec[] = [
    // Vizionforge Civil (NW site)
    { code: "DEMO-VCF-W001", contractorId: VIZIONFORGE, name: "Ramesh Kumar Yadav", dob: new Date("1988-04-12"), gender: "MALE", blood: "B+", mobile: "9876543001", trade: "MASON", exp: 12, edu: "8th Standard", homeState: "Uttar Pradesh", homeDistrict: "Azamgarh" },
    { code: "DEMO-VCF-W002", contractorId: VIZIONFORGE, name: "Suresh Lal Meena", dob: new Date("1990-07-22"), gender: "MALE", blood: "O+", mobile: "9876543002", trade: "CONCRETE_WORKER", exp: 8, edu: "10th Standard", homeState: "Rajasthan", homeDistrict: "Kota" },
    { code: "DEMO-VCF-W003", contractorId: VIZIONFORGE, name: "Mohan Das Sahoo", dob: new Date("1985-11-03"), gender: "MALE", blood: "A+", mobile: "9876543003", trade: "SHUTTERING_CARPENTER", exp: 15, edu: "10th Standard", homeState: "Odisha", homeDistrict: "Cuttack" },
    { code: "DEMO-VCF-W004", contractorId: VIZIONFORGE, name: "Dharmendra Singh", dob: new Date("1992-02-18"), gender: "MALE", blood: "AB+", mobile: "9876543004", trade: "SCAFFOLD_ERECTOR", exp: 7, edu: "8th Standard", homeState: "Bihar", homeDistrict: "Patna" },
    { code: "DEMO-VCF-W005", contractorId: VIZIONFORGE, name: "Lakshmi Devi Verma", dob: new Date("1994-09-05"), gender: "FEMALE", blood: "B-", mobile: "9876543005", trade: "BAR_BENDER", exp: 5, edu: "12th Standard", homeState: "Madhya Pradesh", homeDistrict: "Bhopal" },
    // Star Erection Services (SW site)
    { code: "DEMO-SES-W001", contractorId: STAR_ERECT, name: "Venkatesh Naidu Reddy", dob: new Date("1986-06-14"), gender: "MALE", blood: "O+", mobile: "9876543011", trade: "WELDER_6G", exp: 14, edu: "ITI Welding", homeState: "Andhra Pradesh", homeDistrict: "Guntur" },
    { code: "DEMO-SES-W002", contractorId: STAR_ERECT, name: "Arjun Pillai Nair", dob: new Date("1991-03-28"), gender: "MALE", blood: "A-", mobile: "9876543012", trade: "FITTER", exp: 9, edu: "ITI Fitter", homeState: "Kerala", homeDistrict: "Thrissur" },
    { code: "DEMO-SES-W003", contractorId: STAR_ERECT, name: "Rajendran Muthu Kumar", dob: new Date("1987-12-10"), gender: "MALE", blood: "B+", mobile: "9876543013", trade: "RIGGER", exp: 11, edu: "8th Standard", homeState: "Tamil Nadu", homeDistrict: "Salem" },
    { code: "DEMO-SES-W004", contractorId: STAR_ERECT, name: "Mohammed Aslam Khan", dob: new Date("1989-08-25"), gender: "MALE", blood: "O-", mobile: "9876543014", trade: "PIPE_FITTER", exp: 10, edu: "ITI Plumbing", homeState: "Maharashtra", homeDistrict: "Aurangabad" },
    { code: "DEMO-SES-W005", contractorId: STAR_ERECT, name: "Sunita Prabha Thakur", dob: new Date("1995-01-17"), gender: "FEMALE", blood: "A+", mobile: "9876543015", trade: "HELPER", exp: 3, edu: "12th Standard", homeState: "Jharkhand", homeDistrict: "Ranchi" },
  ];

  const workers: { id: string; spec: WorkerSpec; siteId: string }[] = [];

  for (const spec of workerSpecs) {
    const w = await prisma.contractorWorker.create({
      data: {
        contractorCompanyId: spec.contractorId,
        workerCode: spec.code,
        fullName: spec.name,
        dateOfBirth: spec.dob,
        gender: spec.gender,
        bloodGroup: spec.blood,
        aadhaarLast4: String(Math.floor(1000 + Math.random() * 9000)),
        aadhaarVerified: true,
        mobileNumber: spec.mobile,
        emergencyContactName: `${spec.name.split(" ")[0]} family`,
        emergencyContactPhone: `98765${String(Math.floor(43000 + Math.random() * 999)).padStart(5, "0")}`,
        emergencyContactRelation: "SPOUSE",
        homeAddress: `Village ${spec.homeDistrict}, ${spec.homeDistrict} District`,
        homeDistrict: spec.homeDistrict,
        homeState: spec.homeState,
        primaryTrade: spec.trade,
        secondaryTrades: [],
        yearsExperience: spec.exp,
        educationLevel: spec.edu,
        itiTrade: spec.edu.startsWith("ITI") ? spec.edu.replace("ITI ", "") : undefined,
        medicalFitnessRecords: [{
          certificate_type: "Annual Medical Fitness",
          issued_by: "Dr. Mehta Occupational Health Clinic",
          issued_at: daysAgo(90).toISOString(),
          valid_until: daysFromNow(275).toISOString(),
          conditions_noted: null,
          certificate_url: null,
        }],
        currentMedicalValidUntil: daysFromNow(275),
        overallStatus: "active",
        biometricEnrolled: spec.contractorId === STAR_ERECT, // SW site requires biometric
        trainingCertificates: [{
          programCode: "CONSTRUCTION_SAFETY_INDUCTION",
          programName: "Construction Site Safety Induction",
          issuedAt: daysAgo(80).toISOString(),
          validUntil: daysFromNow(285).toISOString(),
          status: "valid",
          certificateUrl: null,
        }],
        competencyRecords: spec.trade.includes("WELDER") ? [{
          competencyCode: "WELD-6G",
          competencyName: "6G Pipe Welding Competency",
          validFrom: daysAgo(180).toISOString(),
          validUntil: daysFromNow(185).toISOString(),
          status: "valid",
          assessorName: "BIS Approved Examiner",
        }] : [],
        ppeIssuances: [{
          ppeTypeCode: "HELMET-INDUSTRIAL",
          ppeTypeName: "Industrial Safety Helmet",
          issuedAt: daysAgo(78).toISOString(),
          expiresAt: daysFromNow(287).toISOString(),
          itemSerial: `HELM-${spec.code.slice(-4)}`,
          status: "active",
        }],
        createdById: spec.contractorId === VIZIONFORGE ? CONT_COORD_NW : CONT_COORD_SW,
      },
    });
    workers.push({ id: w.id, spec, siteId: spec.contractorId === VIZIONFORGE ? siteNW.id : siteSW.id });
  }

  // ── Mobilization Records ──
  for (const { id: workerId, spec, siteId } of workers) {
    const isNW = siteId === siteNW.id;
    const coordinator = isNW ? CONT_COORD_NW : CONT_COORD_SW;
    const hseMgr = isNW ? HSE_MGR_NW : HSE_MGR_SW;
    const mobDate = daysAgo(70 + Math.floor(Math.random() * 30));

    const mob = await prisma.mobilizationRecord.create({
      data: {
        mobilizationNumber: `MOB-${spec.code.replace("DEMO-", "")}-001`,
        contractorWorkerId: workerId,
        contractorCompanyId: spec.contractorId,
        siteId,
        mobilizationType: "new_deployment",
        tradeAtSite: spec.trade,
        workArea: isNW ? "Block C Civil Works" : "SB-3 Production Hall — Structural",
        reportingSupervisorUserId: coordinator,
        contractorCoordinatorUserId: coordinator,
        mobilisationDate: mobDate,
        plannedDemobilisationDate: daysFromNow(30 + Math.floor(Math.random() * 60)),
        preMobilisationChecks: {
          id_verification: { status: "pass", checked_at: mobDate.toISOString(), checked_by: coordinator },
          medical_fitness: { status: "pass", checked_at: mobDate.toISOString(), valid_until: daysFromNow(275).toISOString() },
          training_induction: { status: "pass", checked_at: mobDate.toISOString() },
          ppe_issued: { status: "pass", checked_at: mobDate.toISOString() },
          competency_verified: { status: spec.trade.includes("WELDER") ? "pass" : "not_applicable", checked_at: mobDate.toISOString() },
          site_rules_briefed: { status: "pass", checked_at: mobDate.toISOString() },
        },
        status: "approved",
        approvedById: hseMgr,
        approvedAt: new Date(mobDate.getTime() + 2 * 3600000),
        performanceNotes: [],
      },
    });

    // ── Site Induction ──
    const induction = await prisma.siteInduction.create({
      data: {
        contractorWorkerId: workerId,
        siteId,
        mobilizationRecordId: mob.id,
        inductionType: "full_site_induction",
        topicsCovered: [
          "Emergency assembly points and evacuation routes",
          "Site layout and restricted areas",
          "PTW system overview",
          "PPE requirements by work area",
          "Incident and near miss reporting procedure",
          "Zero tolerance safety rules",
          isNW ? "Confined space hazards in Block C" : "Chemical and rotating-machinery hazards in SB-3 hall",
        ],
        clientRequirementsCovered: true,
        siteEmergencyProceduresCovered: true,
        siteLayoutFamiliarization: true,
        musterPointIdentified: true,
        ppeCoveredBool: true,
        ptwSystemExplained: true,
        incidentReportingExplained: true,
        conductedById: hseMgr,
        conductedAt: new Date(mobDate.getTime() + 1 * 3600000),
        durationMinutes: isNW ? 90 : 120,
        inductionLanguage: ["DEMO-VCF-W005", "DEMO-SES-W005"].includes(spec.code) ? "Hindi" : spec.homeState === "Tamil Nadu" ? "Tamil" : spec.homeState === "Kerala" ? "Malayalam" : "Hindi",
        interpreterUsed: false,
        assessmentConducted: true,
        assessmentScore: 72 + Math.floor(Math.random() * 25),
        assessmentPassScore: isNW ? 70 : 75,
        assessmentPassed: true,
        failedTopics: [],
        reInductionRequired: false,
        workerAcknowledged: true,
        workerAcknowledgementMethod: "signature_on_form",
        workerAcknowledgedAt: new Date(mobDate.getTime() + 3 * 3600000),
        validFrom: mobDate,
        validUntil: daysFromNow(120),
        isExpired: false,
      },
    });

    // ── Gate Clearance Check + Gate Pass (all workers cleared) ──
    const clearanceTime = new Date(mobDate.getTime() + 4 * 3600000);
    const clearance = await prisma.gateClearanceCheck.create({
      data: {
        siteId,
        contractorWorkerId: workerId,
        workerName: spec.name,
        workerCode: spec.code,
        contractorCompanyName: spec.contractorId === VIZIONFORGE ? "Vizionforge Civil Pvt Ltd" : "Star Erection Services",
        checkRequestedAt: clearanceTime,
        checkMethod: "system_automated",
        checks: {
          identity: { result: "pass", detail: "Aadhaar verified" },
          induction: { result: "pass", detail: `Inducted ${daysAgo(70).toLocaleDateString()}; valid until ${daysFromNow(120).toLocaleDateString()}` },
          medical: { result: "pass", detail: `Fitness certificate valid until ${daysFromNow(275).toLocaleDateString()}` },
          training: { result: "pass", detail: "Construction Safety Induction completed" },
          ppe: { result: "pass", detail: "Helmet, boots, vest issued" },
          blacklist: { result: "pass", detail: "No blacklist entry found" },
          work_permit: { result: "pass", detail: "No outstanding permit violations" },
          competency: { result: spec.trade.includes("WELDER") ? "pass" : "not_required", detail: spec.trade.includes("WELDER") ? "6G cert verified" : "Trade does not require competency cert" },
        },
        overallResult: "CLEARED",
        blockingIssues: [],
        warningIssues: [],
        gatePassIssued: true,
        overrideApplied: false,
        checkCompletedAt: new Date(clearanceTime.getTime() + 120000),
        processingDurationMs: 120000,
      },
    });

    const gatePass = await prisma.gatePass.create({
      data: {
        siteId,
        clearanceCheckId: clearance.id,
        contractorWorkerId: workerId,
        workerName: spec.name,
        workerCode: spec.code,
        primaryTrade: spec.trade,
        contractorCompanyName: spec.contractorId === VIZIONFORGE ? "Vizionforge Civil Pvt Ltd" : "Star Erection Services",
        passNumber: `GP-${isNW ? "NW" : "SW"}-${spec.code.slice(-4)}-001`,
        passType: "project_pass",
        validFrom: mobDate,
        validUntil: daysFromNow(30),
        authorizedAreas: isNW ? ["Block C Civil", "Laydown Area", "Site Office"] : ["SB-3 Production Hall Structure", "Laydown Yard", "Site Office"],
        authorizedTrades: [spec.trade],
        status: "active",
        qrCodeData: JSON.stringify({ pass: `GP-${isNW ? "NW" : "SW"}-${spec.code.slice(-4)}-001`, worker: spec.code, site: isNW ? "DEMO-NW-EXP-2026" : "DEMO-SW-GF-2025", valid_until: daysFromNow(30).toISOString() }),
        generatedAt: new Date(clearanceTime.getTime() + 120000),
      },
    });

    // Link gate pass back to clearance check
    await prisma.gateClearanceCheck.update({
      where: { id: clearance.id },
      data: { gatePassId: gatePass.id },
    });
  }

  const workerCount = await prisma.contractorWorker.count({ where: { workerCode: { contains: "DEMO" } } });
  const mobCount    = await prisma.mobilizationRecord.count({ where: { mobilizationNumber: { contains: "DEMO" } } });
  const indCount    = await prisma.siteInduction.count();
  const passCount   = await prisma.gatePass.count({ where: { passNumber: { contains: "-NW-" } } }) +
                      await prisma.gatePass.count({ where: { passNumber: { contains: "-SW-" } } });

  console.log(`✅  EPC seed complete:`);
  console.log(`    Sites: 2 | Workers: ${workerCount} | Mobilizations: ${mobCount} | Inductions: ${indCount} | Gate passes: ${passCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
