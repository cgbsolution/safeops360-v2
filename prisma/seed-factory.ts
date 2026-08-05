// ────────────────────────────────────────────────────────────────────────
// Seed — Facilities (Factory Profile Master) — Meridian Apparel Group, 16 factories
//
// Seeds the full 16-factory garment estate (Section 6.1 of the build prompt) —
// each as a new Plant (= "Site") + FactoryProfile + generated Building register,
// Workforce (SA8000 lens, contract-heavy / female-majority), Production process
// flow, Certifications (3–4 EXPIRING_SOON/EXPIRED across the estate) and Contacts.
// Plus a Group Compliance Manager (Mervyn) + a Factory Manager (Ludhiana) persona.
//
// Group totals: 16 factories · ~70 buildings · ~11,800 employees · group ~80%,
// clear laggard (Ludhiana 68%) + leader (Tirupur 1 88%).
//
// Sub-records are GENERATED from compact per-factory parameters to stay correct
// and maintainable at 16+ factories.
//
// Idempotent: deletes prior MAG-* rows + persona users before recreating.
// Run AFTER seed (base) + seed-rbac. Then seed-factory-ops + recompute snapshots.
//   npx tsx prisma/seed-factory.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_PASSWORD } from "./demo-users-config";

const prisma = new PrismaClient();

const NOW = new Date("2026-06-20T00:00:00.000Z");
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const PCB_BY_STATE: Record<string, string> = {
  "Tamil Nadu": "TNPCB", Karnataka: "KSPCB", "Uttar Pradesh": "UPPCB", Haryana: "HSPCB",
  Punjab: "PPCB", Gujarat: "GPCB", Maharashtra: "MPCB", "West Bengal": "WBPCB",
  "Madhya Pradesh": "MPPCB", Rajasthan: "RSPCB", Telangana: "TSPCB",
};
const ACTS = ["Factories Act 1948", "Contract Labour (R&A) Act 1970", "Payment of Wages Act 1936", "ESI Act 1948"];

// Statutory monthly minimum wage by state (₹, indicative garment/unskilled band)
// — drives the SA8000 wage comparison; the seeded lowest wage sits above this.
const STATUTORY_MIN_WAGE_BY_STATE: Record<string, number> = {
  "Tamil Nadu": 13000, Karnataka: 14500, "Uttar Pradesh": 10600, Haryana: 11600,
  Punjab: 10200, Gujarat: 11200, Maharashtra: 13500, "West Bengal": 9500,
  "Madhya Pradesh": 10000, Rajasthan: 10500, Telangana: 12000,
};

// ── SA8000 flag engine (mirrors app/services/factory.py) ─────────────────────
type Flag = "COMPLIANT" | "ATTENTION" | "NON_COMPLIANT" | "NOT_ASSESSED";
const FLAG_RANK: Record<Flag, number> = { NON_COMPLIANT: 3, ATTENTION: 2, COMPLIANT: 1, NOT_ASSESSED: 0 };
function worstFlag(flags: Flag[]): Flag {
  const assessed = flags.filter((f) => f && f !== "NOT_ASSESSED");
  if (!assessed.length) return "NOT_ASSESSED";
  return assessed.reduce((a, b) => (FLAG_RANK[b] > FLAG_RANK[a] ? b : a));
}

type CertNote = "CLEAN" | "WRAP_EXPIRING" | "SA8000_EXPIRED" | "SMETA_DUE" | "LAGGARD";

type FSpec = {
  plantCode: string;
  factoryCode: string;
  name: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lon: number;
  employees: number;
  buildings: number;
  score: number;
  established: number;
  status: string;
  etp?: boolean;
  certNote: CertNote;
  fmName: string;
  // seeds a legally-employed apprentice cohort aged 17 → exercises the SA8000
  // child-labour ATTENTION flag (under-18 below the hiring-age policy).
  apprenticeUnder18?: boolean;
};

// Section 6.1 — the 16 factories (Ludhiana=MAG-PB-01, Tirupur1=MAG-TN-01, Surat=MAG-GJ-01 kept stable).
const FACTORIES: FSpec[] = [
  { plantCode: "MAG-TIR1", factoryCode: "MAG-TN-01", name: "Meridian Apparel — Tirupur 1", city: "Tirupur", state: "Tamil Nadu", pincode: "641604", lat: 11.1085, lon: 77.3411, employees: 1240, buildings: 6, score: 88, established: 2008, status: "OPERATIONAL", certNote: "CLEAN", fmName: "Karthik Subramaniam" },
  { plantCode: "MAG-TIR2", factoryCode: "MAG-TN-02", name: "Meridian Apparel — Tirupur 2", city: "Tirupur", state: "Tamil Nadu", pincode: "641607", lat: 11.124, lon: 77.353, employees: 720, buildings: 4, score: 79, established: 2012, status: "OPERATIONAL", certNote: "WRAP_EXPIRING", fmName: "Selvam Murugan" },
  { plantCode: "MAG-BLR", factoryCode: "MAG-KA-01", name: "Meridian Apparel — Bengaluru", city: "Bengaluru", state: "Karnataka", pincode: "560058", lat: 12.9716, lon: 77.5946, employees: 960, buildings: 5, score: 84, established: 2010, status: "OPERATIONAL", certNote: "CLEAN", fmName: "Ravi Shankar" },
  { plantCode: "MAG-MYS", factoryCode: "MAG-KA-02", name: "Meridian Apparel — Mysuru", city: "Mysuru", state: "Karnataka", pincode: "570016", lat: 12.2958, lon: 76.6394, employees: 410, buildings: 3, score: 72, established: 2015, status: "OPERATIONAL", certNote: "SA8000_EXPIRED", fmName: "Mahesh Gowda" },
  { plantCode: "MAG-NOI", factoryCode: "MAG-UP-01", name: "Meridian Apparel — Noida", city: "Noida", state: "Uttar Pradesh", pincode: "201305", lat: 28.5355, lon: 77.391, employees: 1510, buildings: 7, score: 81, established: 2009, status: "OPERATIONAL", certNote: "CLEAN", fmName: "Alok Srivastava", apprenticeUnder18: true },
  { plantCode: "MAG-GUR", factoryCode: "MAG-HR-01", name: "Meridian Apparel — Gurugram", city: "Gurugram", state: "Haryana", pincode: "122001", lat: 28.4595, lon: 77.0266, employees: 650, buildings: 4, score: 86, established: 2011, status: "OPERATIONAL", certNote: "CLEAN", fmName: "Naveen Yadav" },
  { plantCode: "MAG-LDH", factoryCode: "MAG-PB-01", name: "Meridian Apparel — Ludhiana", city: "Ludhiana", state: "Punjab", pincode: "141003", lat: 30.901, lon: 75.8573, employees: 380, buildings: 3, score: 68, established: 2014, status: "OPERATIONAL", certNote: "LAGGARD", fmName: "Harpreet Singh" },
  { plantCode: "MAG-FBD", factoryCode: "MAG-HR-02", name: "Meridian Apparel — Faridabad", city: "Faridabad", state: "Haryana", pincode: "121003", lat: 28.4089, lon: 77.3178, employees: 540, buildings: 4, score: 77, established: 2013, status: "OPERATIONAL", certNote: "CLEAN", fmName: "Sandeep Chauhan" },
  { plantCode: "MAG-SUR", factoryCode: "MAG-GJ-01", name: "Meridian Apparel — Surat", city: "Surat", state: "Gujarat", pincode: "395004", lat: 21.1702, lon: 72.8311, employees: 880, buildings: 5, score: 83, established: 2011, status: "OPERATIONAL", etp: true, certNote: "CLEAN", fmName: "Bhavesh Patel" },
  { plantCode: "MAG-AMD", factoryCode: "MAG-GJ-02", name: "Meridian Apparel — Ahmedabad", city: "Ahmedabad", state: "Gujarat", pincode: "382445", lat: 23.0225, lon: 72.5714, employees: 600, buildings: 4, score: 80, established: 2012, status: "OPERATIONAL", certNote: "CLEAN", fmName: "Jignesh Shah" },
  { plantCode: "MAG-MUM", factoryCode: "MAG-MH-01", name: "Meridian Apparel — Mumbai", city: "Mumbai", state: "Maharashtra", pincode: "400072", lat: 19.076, lon: 72.8777, employees: 340, buildings: 3, score: 85, established: 2013, status: "OPERATIONAL", certNote: "CLEAN", fmName: "Rohan Desai" },
  { plantCode: "MAG-KOL", factoryCode: "MAG-WB-01", name: "Meridian Apparel — Kolkata", city: "Kolkata", state: "West Bengal", pincode: "700150", lat: 22.5726, lon: 88.3639, employees: 720, buildings: 4, score: 74, established: 2014, status: "OPERATIONAL", certNote: "SMETA_DUE", fmName: "Subhankar Ghosh" },
  { plantCode: "MAG-IDR", factoryCode: "MAG-MP-01", name: "Meridian Apparel — Indore", city: "Indore", state: "Madhya Pradesh", pincode: "452015", lat: 22.7196, lon: 75.8577, employees: 290, buildings: 3, score: 82, established: 2016, status: "OPERATIONAL", certNote: "CLEAN", fmName: "Aditya Joshi" },
  { plantCode: "MAG-JAI", factoryCode: "MAG-RJ-01", name: "Meridian Apparel — Jaipur", city: "Jaipur", state: "Rajasthan", pincode: "302022", lat: 26.9124, lon: 75.7873, employees: 560, buildings: 4, score: 78, established: 2013, status: "OPERATIONAL", certNote: "CLEAN", fmName: "Vikas Sharma" },
  { plantCode: "MAG-HYD", factoryCode: "MAG-TG-01", name: "Meridian Apparel — Hyderabad", city: "Hyderabad", state: "Telangana", pincode: "500055", lat: 17.385, lon: 78.4867, employees: 910, buildings: 5, score: 87, established: 2010, status: "OPERATIONAL", certNote: "CLEAN", fmName: "Srinivas Reddy" },
  { plantCode: "MAG-CBE", factoryCode: "MAG-TN-03", name: "Meridian Apparel — Coimbatore", city: "Coimbatore", state: "Tamil Nadu", pincode: "641407", lat: 11.0168, lon: 76.9558, employees: 1080, buildings: 6, score: 76, established: 2011, status: "PARTIAL_OPERATION", certNote: "CLEAN", fmName: "Prakash Velu" },
];

// ── generators ──────────────────────────────────────────────────────────────
const SAFETY_NAMES = ["Anitha Raj", "Manjit Singh", "Deepa Nair", "Imran Khan", "Sunita Patil", "Rakesh Verma", "Lakshmi Menon", "Faizal Ahmed"];
const COMPLIANCE_NAMES = ["Ramesh Pillai", "Gurpreet Kaur", "Priya Mehta", "Nilesh Shah", "Anjali Rao", "Sameer Joshi", "Kavya Iyer", "Tarun Bose"];

function genBuildings(spec: FSpec) {
  const palette: [string, string][] = [
    ["Block A — Cutting", "PRODUCTION"],
    ["Block B — Stitching", "PRODUCTION"],
    ["Block C — Finishing & Packing", "PRODUCTION"],
    ["Central Warehouse", "WAREHOUSE"],
    ["Admin & QA", "ADMIN_OFFICE"],
    ["Canteen", "CANTEEN"],
    ["Stitching Block D", "PRODUCTION"],
    ["Workers' Dormitory", "DORMITORY"],
    ["Utility & Boiler House", "BOILER_HOUSE"],
  ];
  const chosen = palette.slice(0, spec.buildings).map(([name, type]) => ({ name, type }));
  if (spec.etp && chosen.length) chosen[chosen.length - 1] = { name: "Effluent Treatment Plant", type: "ETP_PLANT" };
  return chosen.map((b, i) => ({
    buildingName: b.name,
    buildingType: b.type,
    floors: b.type === "PRODUCTION" ? 2 : 1,
    areaSqm: b.type === "PRODUCTION" ? 4200 : b.type === "WAREHOUSE" ? 3200 : b.type === "ETP_PLANT" ? 1600 : 1500,
    maxOccupancy: b.type === "PRODUCTION" ? Math.round(spec.employees / Math.max(2, spec.buildings - 2)) : 80,
    assemblyPoint: i % 2 === 0 ? "AP-1 (Main lawn)" : "AP-2 (Gate)",
    emergencyExits: b.type === "PRODUCTION" ? 6 : 3,
  }));
}

function genWorkforce(spec: FSpec) {
  const e = spec.employees;
  const contractFrac = Math.min(0.7, 0.5 + (88 - spec.score) * 0.006); // laggards more contract-heavy
  const contract = Math.round(e * contractFrac);
  const apprentice = Math.round(e * 0.07);
  const permanent = e - contract - apprentice;
  const female = Math.round(e * 0.64); // garment sector — female-majority
  const other = Math.max(2, Math.round(e * 0.008));
  const male = e - female - other;
  const migrant = Math.round(e * (spec.score < 75 ? 0.22 : 0.12));
  const genderTotal = male + female + other;
  // Child-labour evidence: clean everywhere (youngest ≥ 18, none under 18) except
  // the one apprentice-cohort factory (legal 17-yo trainees) → exercises the flag.
  const under18 = spec.apprenticeUnder18 ? Math.max(8, Math.round(apprentice * 0.04)) : 0;
  const youngest = spec.apprenticeUnder18 ? 17 : 18;
  return {
    permanentCount: permanent,
    contractCount: contract,
    apprenticeTraineeCount: apprentice,
    maleCount: male,
    femaleCount: female,
    otherGenderCount: other,
    migrantWorkerCount: migrant,
    differentlyAbledCount: Math.max(2, Math.round(e * 0.01)),
    totalCount: e,
    youngestWorkerAge: youngest,
    workersUnder18Count: under18,
    minHiringAgePolicy: 18,
    contractPct: Math.round((contract / e) * 1000) / 10,
    femalePct: Math.round((female / genderTotal) * 1000) / 10,
    migrantPct: Math.round((migrant / e) * 1000) / 10,
  };
}

// ── Social-Compliance Profile generator (SA8000) — tells the estate story ──
function genSocialCompliance(spec: FSpec) {
  const statutory = STATUTORY_MIN_WAGE_BY_STATE[spec.state] ?? 10000;
  const lowest = statutory + 1500 + Math.round((spec.score - 68) * 60); // above statutory, better at leaders
  // Defaults: a compliant garment factory.
  const p = {
    minimumWageCompliant: "COMPLIANT" as Flag,
    lowestMonthlyWageInr: lowest,
    statutoryMinimumWageInr: statutory,
    wagesPaidOnTime: "COMPLIANT" as Flag,
    standardWeeklyHours: 48,
    maxWeeklyOvertimeHours: 12,
    overtimeVoluntary: "COMPLIANT" as Flag,
    weeklyRestDayProvided: "COMPLIANT" as Flag,
    unionOrWorkerCommitteePresent: "COMPLIANT" as Flag,
    collectiveBargainingAgreement: spec.score >= 84,
    noDepositOrDocumentRetention: "COMPLIANT" as Flag,
    grievanceMechanismPresent: "COMPLIANT" as Flag,
    antiDiscriminationPolicy: "COMPLIANT" as Flag,
    sa8000AwarenessTrainingPct: Math.min(92, 62 + Math.round((spec.score - 68) * 1.4)),
    lastSocialAuditDate: daysAgo(120 + Math.floor(Math.random() * 160)),
    nextReviewDate: daysFromNow(150 + Math.floor(Math.random() * 90)),
  };

  // Story overrides.
  if (spec.factoryCode === "MAG-PB-01") {
    // Ludhiana — the laggard: overtime over the SA8000 cap + low training.
    p.maxWeeklyOvertimeHours = 16;
    p.overtimeVoluntary = "ATTENTION";
    p.sa8000AwarenessTrainingPct = 35;
  } else if (spec.factoryCode === "MAG-KA-02") {
    // Mysuru — no worker committee (freedom-of-association attention).
    p.unionOrWorkerCommitteePresent = "ATTENTION";
    p.collectiveBargainingAgreement = false;
  } else if (spec.factoryCode === "MAG-TN-01") {
    // Tirupur 1 — the leader: full marks.
    p.sa8000AwarenessTrainingPct = 95;
    p.unionOrWorkerCommitteePresent = "COMPLIANT";
    p.collectiveBargainingAgreement = true;
  }

  // Persisted overall = worst-of element flags + OT-cap breach (>12h) → ATTENTION.
  const elementFlags: Flag[] = [
    p.minimumWageCompliant, p.wagesPaidOnTime, p.overtimeVoluntary, p.weeklyRestDayProvided,
    p.unionOrWorkerCommitteePresent, p.noDepositOrDocumentRetention, p.grievanceMechanismPresent,
    p.antiDiscriminationPolicy,
  ];
  if (p.maxWeeklyOvertimeHours > 12) elementFlags.push("ATTENTION");
  const overallSocialComplianceFlag = worstFlag(elementFlags);

  return { ...p, overallSocialComplianceFlag };
}

function genProcesses(spec: FSpec) {
  const cap = (f: number) => `${Math.round((spec.employees * f) / 100) * 100} pcs/day`;
  const p: { processName: string; installedCapacity: string; shiftPattern: string; keyHazards: string[] }[] = [
    { processName: "Cutting", installedCapacity: cap(9), shiftPattern: "2 shifts", keyHazards: ["Cut injury", "Repetitive strain"] },
    { processName: "Stitching", installedCapacity: cap(7), shiftPattern: "2 shifts", keyHazards: ["Needle injury", "Noise", "Ergonomic"] },
  ];
  if (spec.etp) p.push({ processName: "Washing & Dyeing", installedCapacity: cap(6), shiftPattern: "24x7", keyHazards: ["Chemical exposure", "Effluent / ETP", "Heat & steam", "Slips"] });
  p.push({ processName: "Finishing", installedCapacity: cap(8), shiftPattern: "2 shifts", keyHazards: ["Heat (pressing)"] });
  p.push({ processName: "Packing", installedCapacity: cap(9), shiftPattern: "1 shift", keyHazards: ["Manual handling"] });
  return p;
}

const farExpiry = () => daysFromNow(280 + Math.floor(Math.random() * 120));
const soonExpiry = () => daysFromNow(25 + Math.floor(Math.random() * 30)); // within 60d lead → EXPIRING_SOON
const pastExpiry = () => daysAgo(20 + Math.floor(Math.random() * 60)); // EXPIRED

type CertSpec = { certificationType: string; certificateNo: string; issuingBody: string; issueDate: Date; expiryDate: Date; renewalLeadDays: number; manualStatus?: string };

function genCerts(spec: FSpec): CertSpec[] {
  const yr = String(spec.established).slice(-2);
  const base: CertSpec[] = [
    { certificationType: "SA8000", certificateNo: `SA8000-IN-${spec.plantCode}`, issuingBody: "SAI / SAAS", issueDate: daysAgo(400), expiryDate: farExpiry(), renewalLeadDays: 90 },
    { certificationType: "WRAP", certificateNo: `WRAP-${spec.plantCode}-${yr}`, issuingBody: "WRAP", issueDate: daysAgo(360), expiryDate: farExpiry(), renewalLeadDays: 60 },
    { certificationType: "ISO_9001", certificateNo: `ISO9001-${spec.plantCode}`, issuingBody: "Bureau Veritas", issueDate: daysAgo(380), expiryDate: farExpiry(), renewalLeadDays: 60 },
    { certificationType: "ISO_14001", certificateNo: `ISO14001-${spec.plantCode}`, issuingBody: "DNV", issueDate: daysAgo(380), expiryDate: farExpiry(), renewalLeadDays: 60 },
  ];
  switch (spec.certNote) {
    case "WRAP_EXPIRING":
      base[1].expiryDate = soonExpiry();
      break;
    case "SA8000_EXPIRED":
      base[0].expiryDate = pastExpiry();
      break;
    case "SMETA_DUE":
      base.push({ certificationType: "SEDEX_SMETA", certificateNo: `SMETA-${spec.plantCode}`, issuingBody: "Sedex (SMETA 4-Pillar)", issueDate: daysAgo(360), expiryDate: soonExpiry(), renewalLeadDays: 60 });
      break;
    case "LAGGARD":
      base[0].expiryDate = pastExpiry(); // SA8000 EXPIRED
      base[1].expiryDate = soonExpiry(); // WRAP EXPIRING_SOON
      base.push({ certificationType: "BSCI", certificateNo: `BSCI-${spec.plantCode}`, issuingBody: "amfori", issueDate: daysAgo(380), expiryDate: daysAgo(20), renewalLeadDays: 60, manualStatus: "UNDER_RENEWAL" });
      break;
  }
  return base;
}

function genContacts(spec: FSpec, idx: number) {
  return [
    { role: "FACTORY_MANAGER", name: spec.fmName, primary: true },
    { role: "SAFETY_OFFICER", name: SAFETY_NAMES[idx % SAFETY_NAMES.length], primary: false },
    { role: spec.etp ? "ENVIRONMENT_OFFICER" : "COMPLIANCE_OFFICER", name: COMPLIANCE_NAMES[idx % COMPLIANCE_NAMES.length], primary: false },
  ];
}

async function main() {
  console.log("Seeding Facilities — Meridian Apparel Group (16 factories)…");

  const factoryCodes = FACTORIES.map((f) => f.factoryCode);
  const childWhere = { factoryProfile: { factoryCode: { in: factoryCodes } } };
  const safeDelete = async (label: string, fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e) { console.warn(`  (skip ${label}: ${(e as Error).message})`); }
  };

  // ── Idempotent wipe (children → parents) ──
  await safeDelete("complianceSnapshot", () => prisma.$executeRawUnsafe(`DELETE FROM "FactoryComplianceSnapshot" WHERE "factoryProfileId" IN (SELECT id FROM "FactoryProfile" WHERE "factoryCode" = ANY($1))`, factoryCodes));
  await safeDelete("building", () => prisma.building.deleteMany({ where: childWhere }));
  await safeDelete("socialComplianceProfile", () => prisma.socialComplianceProfile.deleteMany({ where: childWhere }));
  await safeDelete("workforceComposition", () => prisma.workforceComposition.deleteMany({ where: childWhere }));
  await safeDelete("productionProcess", () => prisma.productionProcess.deleteMany({ where: childWhere }));
  await safeDelete("factoryCertification", () => prisma.factoryCertification.deleteMany({ where: childWhere }));
  await safeDelete("factoryContact", () => prisma.factoryContact.deleteMany({ where: childWhere }));
  await safeDelete("factoryProfile", () => prisma.factoryProfile.deleteMany({ where: { factoryCode: { in: factoryCodes } } }));

  // ── Personas ──
  type PersonaSpec = { name: string; email: string; roleCode: string; plantCode: string | null; designation: string };
  const personas: PersonaSpec[] = [
    { name: "Mervyn Fernandes", email: "mervyn.fernandes@meridian-apparel.in", roleCode: "FACILITIES_MANAGER", plantCode: null, designation: "Group Compliance Manager" },
    { name: "Harpreet Singh", email: "harpreet.singh@meridian-apparel.in", roleCode: "FACTORY_MANAGER", plantCode: "MAG-LDH", designation: "Factory Manager (Ludhiana)" },
  ];
  const personaEmails = personas.map((p) => p.email);
  await safeDelete("userRole(personas)", () => prisma.userRole.deleteMany({ where: { user: { email: { in: personaEmails } } } }));
  await safeDelete("users(personas)", () => prisma.user.deleteMany({ where: { email: { in: personaEmails } } }));

  // ── Plants (= Sites) ──
  const plantIdByCode = new Map<string, string>();
  for (const f of FACTORIES) {
    const plant = await prisma.plant.upsert({
      where: { code: f.plantCode },
      update: { name: f.name, location: f.city, state: f.state, unitType: "Garment" },
      create: { code: f.plantCode, name: f.name, location: f.city, state: f.state, unitType: "Garment" },
    });
    plantIdByCode.set(f.plantCode, plant.id);
  }

  // ── Persona users + UserRole rows ──
  const pwHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const p of personas) {
    const plantId = p.plantCode ? plantIdByCode.get(p.plantCode) ?? null : null;
    const u = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name, role: p.roleCode, plantId, designation: p.designation, passwordHash: pwHash },
      create: { email: p.email, name: p.name, role: p.roleCode, plantId, designation: p.designation, passwordHash: pwHash },
    });
    const role = await prisma.role.findUnique({ where: { code: p.roleCode } });
    if (!role) { console.warn(`  (role ${p.roleCode} not found — run seed-rbac first)`); continue; }
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, scopeType: plantId ? "PLANT" : null, scopeValue: plantId } });
  }

  // ── Profiles + generated children ──
  let nB = 0, nW = 0, nP = 0, nC = 0, nCt = 0, nS = 0;
  for (let idx = 0; idx < FACTORIES.length; idx++) {
    const f = FACTORIES[idx];
    const siteId = plantIdByCode.get(f.plantCode)!;
    const wf = genWorkforce(f);
    const profile = await prisma.factoryProfile.create({
      data: {
        siteId,
        factoryCode: f.factoryCode,
        factoryName: f.name,
        status: f.status,
        ownershipType: "OWNED",
        addressLine: `${f.city} Apparel Park`,
        city: f.city,
        state: f.state,
        pincode: f.pincode,
        latitude: f.lat,
        longitude: f.lon,
        establishedYear: f.established,
        factoryLicenseNo: `${PCB_BY_STATE[f.state] ?? "SPCB"}/${f.plantCode}/${f.established}`,
        factoryLicenseValidUntil: daysFromNow(300),
        registrationNos: [
          { type: "GST", number: `${f.plantCode}-GST` },
          { type: "ESI", number: `${f.plantCode}-ESI` },
          { type: "EPF", number: `${f.plantCode}-EPF` },
        ],
        applicableActs: f.etp ? [...ACTS, "Water (Prevention & Control of Pollution) Act 1974"] : ACTS,
        pollutionControlBoard: PCB_BY_STATE[f.state] ?? "SPCB",
        totalLandAreaSqm: f.buildings * 6000,
        builtUpAreaSqm: f.buildings * 3800,
        buildingCount: f.buildings,
        totalEmployees: f.employees,
        primaryIndustry: "Garments / Textile",
        profileStatus: "ACTIVE",
        createdBy: "seed",
      },
    });

    for (const b of genBuildings(f)) {
      await prisma.building.create({ data: { factoryProfileId: profile.id, siteId, buildingName: b.buildingName, buildingType: b.buildingType, floors: b.floors, areaSqm: b.areaSqm, maxOccupancy: b.maxOccupancy, assemblyPoint: b.assemblyPoint, emergencyExits: b.emergencyExits, isActive: true, createdBy: "seed" } });
      nB++;
    }
    await prisma.workforceComposition.create({ data: { factoryProfileId: profile.id, siteId, asOfDate: NOW, isCurrent: true, ...wf, createdBy: "seed" } });
    nW++;
    await prisma.socialComplianceProfile.create({ data: { factoryProfileId: profile.id, siteId, asOfDate: NOW, ...genSocialCompliance(f), createdBy: "seed" } });
    nS++;
    let seq = 1;
    for (const pr of genProcesses(f)) {
      await prisma.productionProcess.create({ data: { factoryProfileId: profile.id, siteId, processName: pr.processName, sequenceOrder: seq++, installedCapacity: pr.installedCapacity, shiftPattern: pr.shiftPattern, keyHazards: pr.keyHazards, isActive: true, createdBy: "seed" } });
      nP++;
    }
    for (const cert of genCerts(f)) {
      await prisma.factoryCertification.create({ data: { factoryProfileId: profile.id, siteId, certificationType: cert.certificationType, certificateNo: cert.certificateNo, issuingBody: cert.issuingBody, issueDate: cert.issueDate, expiryDate: cert.expiryDate, renewalLeadDays: cert.renewalLeadDays, status: cert.manualStatus ?? "VALID", createdBy: "seed" } });
      nC++;
    }
    for (const ct of genContacts(f, idx)) {
      await prisma.factoryContact.create({ data: { factoryProfileId: profile.id, siteId, role: ct.role, name: ct.name, email: `${ct.name.toLowerCase().replace(/[^a-z]/g, ".")}@meridian-apparel.in`, isPrimary: ct.primary, createdBy: "seed" } });
      nCt++;
    }
  }

  const totalEmp = FACTORIES.reduce((a, f) => a + f.employees, 0);
  console.log(`  ${FACTORIES.length} factories · ${nB} buildings · ${totalEmp.toLocaleString()} employees · ${nW} workforce · ${nS} social-compliance · ${nP} processes · ${nC} certs · ${nCt} contacts`);
  console.log("✅  Facilities seed complete (16-factory estate + SA8000 social-compliance).");
}

main()
  .catch((e) => { console.error("❌  Facilities seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
