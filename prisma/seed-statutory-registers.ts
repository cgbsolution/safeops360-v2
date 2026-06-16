// ─────────────────────────────────────────────────────────────────────────────
// Step 23 — Statutory Registers: RegisterMaster + RegisterEntry per plant
//
// Creates 8 RegisterMaster records per plant covering Indian statutory
// requirements under Factories Act, BOCW, CLRA, and PESO regulations.
// Each register has 4–6 RegisterEntry records auto-populated from demo data.
//
// Registers seeded:
//   1. FORM-18  — Accident Register (Factories Act s.88A)
//   2. FORM-20  — Medical Certificate of Fitness
//   3. FORM-22  — Register of Adult Workers
//   4. FORM-11  — Register of Overtime
//   5. FORM-12  — Register of Leaves
//   6. CLRA-XIII — Register of Workers (Contract Labour)
//   7. PESO-PV  — Pressure Vessel Inspection Register
//   8. FORM-7   — Register of Compensatory Holidays
//
// Idempotent: deletes by (registerCode, plantId) before recreating.
// Run: npx tsx prisma/seed-statutory-registers.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-08T08:00:00.000Z");
function daysAgo(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; }

// ── Register definitions (plant-agnostic) ─────────────────────────────────────

const REGISTER_DEFS = [
  {
    code: "FORM-18",
    name: "Register of Accidents (Form 18)",
    legalAct: "Factories Act 1948",
    sectionRule: "Section 88A / Rule 107",
    sourceModule: "IncidentManagement",
    sourceEventType: "INCIDENT_RECORDED",
    entryFrequency: "ON_EVENT",
    submissionFrequency: "ON_OCCURRENCE",
    submissionAuthority: "Inspector of Factories",
    authorisedSignatoryRole: "Plant Head",
    retentionPeriodYears: 5,
  },
  {
    code: "FORM-20",
    name: "Register of Medical Certificates of Fitness (Form 20)",
    legalAct: "Factories Act 1948",
    sectionRule: "Section 68 / Rule 125",
    sourceModule: "PeopleCompetency",
    sourceEventType: "MEDICAL_FITNESS_CERTIFICATE_ISSUED",
    entryFrequency: "ON_EVENT",
    submissionFrequency: "ANNUAL",
    submissionAuthority: "Inspector of Factories",
    authorisedSignatoryRole: "HR Manager",
    retentionPeriodYears: 5,
  },
  {
    code: "FORM-22",
    name: "Register of Adult Workers (Form 22)",
    legalAct: "Factories Act 1948",
    sectionRule: "Section 62 / Rule 102",
    sourceModule: "PeopleCompetency",
    sourceEventType: "WORKER_ENGAGED",
    entryFrequency: "ON_EVENT",
    submissionFrequency: "ANNUAL",
    submissionAuthority: "Inspector of Factories",
    authorisedSignatoryRole: "HR Manager",
    retentionPeriodYears: 10,
  },
  {
    code: "FORM-11",
    name: "Register of Overtime (Form 11)",
    legalAct: "Factories Act 1948",
    sectionRule: "Section 59 / Rule 101",
    sourceModule: "Manhours",
    sourceEventType: "OVERTIME_RECORDED",
    entryFrequency: "MONTHLY",
    submissionFrequency: "ANNUAL",
    submissionAuthority: "Inspector of Factories",
    authorisedSignatoryRole: "HR Manager",
    retentionPeriodYears: 3,
  },
  {
    code: "FORM-12",
    name: "Register of Leaves With Wages (Form 12)",
    legalAct: "Factories Act 1948",
    sectionRule: "Section 79 / Rule 104",
    sourceModule: "Manhours",
    sourceEventType: "LEAVE_RECORDED",
    entryFrequency: "MONTHLY",
    submissionFrequency: "ANNUAL",
    submissionAuthority: "Inspector of Factories",
    authorisedSignatoryRole: "HR Manager",
    retentionPeriodYears: 3,
  },
  {
    code: "CLRA-XIII",
    name: "Register of Workmen — Contract Labour (Form XIII)",
    legalAct: "Contract Labour (Regulation & Abolition) Act 1970",
    sectionRule: "Rule 75 / Form XIII",
    sourceModule: "EPC_Contractor",
    sourceEventType: "CONTRACTOR_WORKER_ENGAGED",
    entryFrequency: "ON_EVENT",
    submissionFrequency: "ANNUAL",
    submissionAuthority: "Registering Officer (Labour Dept)",
    authorisedSignatoryRole: "Contract Manager",
    retentionPeriodYears: 5,
  },
  {
    code: "PESO-PV",
    name: "Pressure Vessel Inspection Register (PESO Schedule 1)",
    legalAct: "Static and Mobile Pressure Vessels (Unfired) Rules 1981",
    sectionRule: "Rule 21 / Schedule 1",
    sourceModule: "AssetsInspection",
    sourceEventType: "INSPECTION_COMPLETED",
    entryFrequency: "ON_EVENT",
    submissionFrequency: "ANNUAL",
    submissionAuthority: "Chief Inspector of Boilers / PESO",
    authorisedSignatoryRole: "Plant Head",
    retentionPeriodYears: 10,
  },
  {
    code: "FORM-7",
    name: "Register of Compensatory Holidays (Form 7)",
    legalAct: "Factories Act 1948",
    sectionRule: "Section 52 / Rule 97",
    sourceModule: "Manhours",
    sourceEventType: "COMPENSATORY_HOLIDAY_GRANTED",
    entryFrequency: "ON_EVENT",
    submissionFrequency: "ANNUAL",
    submissionAuthority: "Inspector of Factories",
    authorisedSignatoryRole: "HR Manager",
    retentionPeriodYears: 3,
  },
];

// ── Entry generator helpers ───────────────────────────────────────────────────

function accidentEntries(P: string) {
  return [
    {
      txnId: `INC-${P}-DEMO-002-REG`,
      sourceRef: `INC-${P}-DEMO-002`,
      entryDate: daysAgo(85),
      fields: {
        dateOfAccident: daysAgo(85).toISOString(),
        timeOfAccident: "14:30",
        nameOfInjuredPerson: "Ramesh Kumar",
        designation: "Bleach Plant Operator",
        natureOfInjury: "Chemical exposure — chlorine dioxide (ClO₂), first aid administered",
        bodyPartAffected: "Respiratory tract (mild)",
        locationOfAccident: "Bleaching Plant — ClO₂ Dosing Station",
        causeOfAccident: "Corroded isolation valve micro-leak during peak operation",
        absenceDays: 1,
        reportedToInspector: true,
        inspectorReportDate: daysAgo(84).toISOString(),
        remarks: "Worker resumed duty next shift after medical clearance",
      }
    },
    {
      txnId: `INC-${P}-DEMO-005-REG`,
      sourceRef: `INC-${P}-DEMO-005`,
      entryDate: daysAgo(45),
      fields: {
        dateOfAccident: daysAgo(45).toISOString(),
        timeOfAccident: "09:15",
        nameOfInjuredPerson: "Suresh Nair",
        designation: "Maintenance Technician",
        natureOfInjury: "Minor laceration to right hand — no stitches required",
        bodyPartAffected: "Right hand",
        locationOfAccident: "Workshop — Bench Grinding Area",
        causeOfAccident: "Glove removed to adjust workpiece; contacted grinding wheel",
        absenceDays: 0,
        reportedToInspector: false,
        remarks: "First aid only. Toolbox talk conducted on PPE compliance.",
      }
    },
    {
      txnId: `NM-${P}-PROMO-001-REG`,
      sourceRef: `NM-${P}-PROMO-001`,
      entryDate: daysAgo(35),
      fields: {
        dateOfAccident: daysAgo(35).toISOString(),
        timeOfAccident: "11:45",
        nameOfInjuredPerson: "Near Miss — No injury",
        designation: "Electrician",
        natureOfInjury: "Arc flash — no injury due to Class E PPE",
        bodyPartAffected: "None",
        locationOfAccident: "MCC Room — Panel MCC-03",
        causeOfAccident: "Energised panel worked on without LOTO. Arc flash occurred.",
        absenceDays: 0,
        reportedToInspector: false,
        remarks: "Dangerous occurrence — near miss with high-potential. Investigation conducted.",
      }
    },
  ];
}

function overtimeEntries(P: string) {
  return [
    {
      txnId: `OT-${P}-2026-01-REG`,
      sourceRef: `OT-${P}-JAN-2026`,
      entryDate: daysAgo(150),
      fields: {
        month: "January 2026",
        totalOvertimeHours: 187,
        workerBreakdown: [
          { department: "Paper Machine Operations", workers: 8, overtimeHours: 64 },
          { department: "Maintenance", workers: 6, overtimeHours: 72 },
          { department: "Warehouse", workers: 3, overtimeHours: 51 },
        ],
        maxOvertimePerWorker: 12,
        approvedByManagerId: "plant-head",
        compliance: "COMPLIANT — all within 75 hrs/quarter limit",
      }
    },
    {
      txnId: `OT-${P}-2026-02-REG`,
      sourceRef: `OT-${P}-FEB-2026`,
      entryDate: daysAgo(120),
      fields: {
        month: "February 2026",
        totalOvertimeHours: 143,
        workerBreakdown: [
          { department: "Paper Machine Operations", workers: 8, overtimeHours: 48 },
          { department: "Maintenance", workers: 6, overtimeHours: 55 },
          { department: "Warehouse", workers: 3, overtimeHours: 40 },
        ],
        maxOvertimePerWorker: 10,
        approvedByManagerId: "plant-head",
        compliance: "COMPLIANT",
      }
    },
    {
      txnId: `OT-${P}-2026-03-REG`,
      sourceRef: `OT-${P}-MAR-2026`,
      entryDate: daysAgo(90),
      fields: {
        month: "March 2026",
        totalOvertimeHours: 212,
        workerBreakdown: [
          { department: "Paper Machine Operations", workers: 8, overtimeHours: 80 },
          { department: "Maintenance", workers: 6, overtimeHours: 82 },
          { department: "Warehouse", workers: 3, overtimeHours: 50 },
        ],
        maxOvertimePerWorker: 14,
        approvedByManagerId: "plant-head",
        compliance: "AT_RISK — 2 workers approaching quarterly limit",
        nonCompliantWorkers: ["W-001", "W-004"],
      }
    },
  ];
}

function pressureVesselEntries(P: string) {
  return [
    {
      txnId: `INS-${P}-PV-BOILER-2025-REG`,
      sourceRef: `INS-${P}-PV-ANNUAL-2025`,
      entryDate: daysAgo(365),
      fields: {
        vesselId: `EQ-${P}-DEMO-04`,
        vesselDescription: "Fire Tube Boiler — 10T/hr, 10.5 kg/cm²",
        dateOfInspection: daysAgo(365).toISOString(),
        inspectionType: "Annual Statutory (PESO Schedule 1)",
        inspectedBy: "PESO-approved Inspector — Reg. No. PVI/MH/2021/0847",
        maximumAllowableWorkingPressure: "10.5 kg/cm²",
        nextInspectionDue: daysFromNow(0).toISOString(),
        result: "PASS",
        certificateNumber: `PESO/PV/2025/${P}/004`,
        deficienciesFound: "None",
        remarks: "All welds sound. Pressure relief valve tested and certified. Safety interlocks functional.",
      }
    },
    {
      txnId: `INS-${P}-PV-AIR-2025-REG`,
      sourceRef: `INS-${P}-PV-ANNUAL-2025-AR`,
      entryDate: daysAgo(365),
      fields: {
        vesselId: `EQ-${P}-DEMO-05`,
        vesselDescription: "Air Receiver — 1000L, 12 kg/cm²",
        dateOfInspection: daysAgo(365).toISOString(),
        inspectionType: "Annual Statutory (PESO Schedule 1)",
        inspectedBy: "PESO-approved Inspector — Reg. No. PVI/MH/2021/0847",
        maximumAllowableWorkingPressure: "12 kg/cm²",
        nextInspectionDue: daysFromNow(0).toISOString(),
        result: "PASS",
        certificateNumber: `PESO/PV/2025/${P}/005`,
        deficienciesFound: "None",
        remarks: "Hydrostatic test completed. PRV set pressure verified.",
      }
    },
    {
      txnId: `INS-${P}-PV-BOILER-2026-REG`,
      sourceRef: `INS-${P}-DEMO-004`,
      entryDate: daysAgo(30),
      fields: {
        vesselId: `EQ-${P}-DEMO-04`,
        vesselDescription: "Fire Tube Boiler — 10T/hr, 10.5 kg/cm²",
        dateOfInspection: daysAgo(30).toISOString(),
        inspectionType: "Interim Inspection — After Finding",
        inspectedBy: `Plant Competent Person — ${P === "NW" ? "maintenance-head.it.nw" : "maintenance-head.it.sw"}`,
        result: "CONDITIONAL",
        certificateNumber: null,
        deficienciesFound: "Cracked pressure gauge — gauge replaced and re-tested",
        remarks: "Full annual PESO inspection due. Replacement gauge installed; re-inspection by PESO inspector scheduled.",
        capaRaised: `INS-${P}-DEMO-004-CAPA-001`,
      }
    },
  ];
}

function workerRegisterEntries(P: string) {
  return [
    {
      txnId: `WORKER-${P}-001-REG`,
      sourceRef: `EMP-${P}-001`,
      entryDate: daysAgo(730),
      fields: {
        serialNumber: 1,
        employeeId: `EMP-${P}-001`,
        name: "Rajesh Sharma",
        sex: "Male",
        dateOfBirth: "1988-03-15",
        designation: "Paper Machine Operator",
        department: "Paper Machine Operations",
        dateOfJoining: daysAgo(730).toISOString().split("T")[0],
        natureOfWork: "Operating the Fourdrinier paper machine — wet end, press and dryer sections",
        shiftType: "Rotating 3-shift",
        tokenNumber: `TK-${P}-001`,
        remarks: "Active",
      }
    },
    {
      txnId: `WORKER-${P}-002-REG`,
      sourceRef: `EMP-${P}-002`,
      entryDate: daysAgo(690),
      fields: {
        serialNumber: 2,
        employeeId: `EMP-${P}-002`,
        name: "Pradeep Joshi",
        sex: "Male",
        dateOfBirth: "1991-07-22",
        designation: "Maintenance Technician",
        department: "Maintenance",
        dateOfJoining: daysAgo(690).toISOString().split("T")[0],
        natureOfWork: "Preventive and corrective maintenance — mechanical and electrical",
        shiftType: "Day shift",
        tokenNumber: `TK-${P}-002`,
        remarks: "Active",
      }
    },
    {
      txnId: `WORKER-${P}-003-REG`,
      sourceRef: `EMP-${P}-003`,
      entryDate: daysAgo(540),
      fields: {
        serialNumber: 3,
        employeeId: `EMP-${P}-003`,
        name: "Anitha Krishnan",
        sex: "Female",
        dateOfBirth: "1993-11-08",
        designation: "Quality Control Analyst",
        department: "Quality",
        dateOfJoining: daysAgo(540).toISOString().split("T")[0],
        natureOfWork: "In-process pulp & paper testing — GSM, burst factor, brightness; laboratory analysis, deviation management",
        shiftType: "Day shift",
        tokenNumber: `TK-${P}-003`,
        remarks: "Active",
      }
    },
    {
      txnId: `WORKER-${P}-004-REG`,
      sourceRef: `EMP-${P}-004`,
      entryDate: daysAgo(365),
      fields: {
        serialNumber: 4,
        employeeId: `EMP-${P}-004`,
        name: "Vikram Singh",
        sex: "Male",
        dateOfBirth: "1986-05-30",
        designation: "Electrician Grade II",
        department: "Maintenance",
        dateOfJoining: daysAgo(365).toISOString().split("T")[0],
        natureOfWork: "Electrical maintenance, LOTO, panel work, cable routing",
        shiftType: "Rotating 3-shift",
        tokenNumber: `TK-${P}-004`,
        remarks: "Active",
      }
    },
  ];
}

function clraEntries(P: string) {
  return [
    {
      txnId: `CLRA-${P}-2026-001`,
      sourceRef: `CONTR-${P}-2026-001`,
      entryDate: daysAgo(180),
      fields: {
        serialNumber: 1,
        contractorName: "Apex Engineering Services",
        contractorLicenceNo: `CLRA/MH/2024/${P}/0127`,
        natureOfWork: "Annual Turnaround — Recovery Boiler & Digester Cleaning",
        periodOfWork: { from: daysAgo(180).toISOString().split("T")[0], to: daysAgo(150).toISOString().split("T")[0] },
        numberOfContractWorkers: 22,
        principalEmployer: `Page Industries ${P === "NW" ? "North Paper Mill" : "South Kraft & Board Mill"}`,
        formXIIICertificateIssued: true,
        remarks: "Work completed. Site cleared.",
      }
    },
    {
      txnId: `CLRA-${P}-2026-002`,
      sourceRef: `CONTR-${P}-2026-002`,
      entryDate: daysAgo(60),
      fields: {
        serialNumber: 2,
        contractorName: "BuildSafe Infrastructure Pvt Ltd",
        contractorLicenceNo: `CLRA/MH/2025/${P}/0341`,
        natureOfWork: "Civil repairs and painting — Pulp Mill Block",
        periodOfWork: { from: daysAgo(60).toISOString().split("T")[0], to: daysFromNow(15).toISOString().split("T")[0] },
        numberOfContractWorkers: 14,
        principalEmployer: `Page Industries ${P === "NW" ? "North Paper Mill" : "South Kraft & Board Mill"}`,
        formXIIICertificateIssued: true,
        remarks: "Work ongoing.",
      }
    },
  ];
}

// ── Plant seed ────────────────────────────────────────────────────────────────

async function seedPlant(pl: "NW" | "SW") {
  const P = pl;
  const plant = await prisma.plant.findFirstOrThrow({ where: { code: P } });

  // Cleanup
  const existingRegs = await prisma.registerMaster.findMany({
    where: { plantId: plant.id },
    select: { id: true, registerCode: true },
  });
  if (existingRegs.length) {
    const regIds = existingRegs.map(r => r.id);
    await prisma.registerEntry.deleteMany({ where: { registerId: { in: regIds } } });
    await prisma.registerMaster.deleteMany({ where: { plantId: plant.id } });
  }

  for (const def of REGISTER_DEFS) {
    // Determine compliance status
    const complianceStatus =
      def.code === "PESO-PV"
        ? "AT_RISK" // PRV overdue from CAPA-006
        : "COMPLIANT";

    const register = await prisma.registerMaster.create({
      data: {
        registerCode: def.code,
        registerName: def.name,
        legalAct: def.legalAct,
        sectionRule: def.sectionRule,
        plantId: plant.id,
        sourceModule: def.sourceModule,
        sourceEventType: def.sourceEventType,
        entryFrequency: def.entryFrequency,
        submissionFrequency: def.submissionFrequency,
        nextSubmissionDue: def.submissionFrequency === "ANNUAL" ? new Date("2027-01-31") : (def.submissionFrequency === "ON_OCCURRENCE" ? null : new Date("2026-12-31")),
        lastSubmittedDate: def.submissionFrequency === "ANNUAL" ? new Date("2026-01-31") : null,
        submissionAuthority: def.submissionAuthority,
        authorisedSignatoryRole: def.authorisedSignatoryRole,
        retentionPeriodYears: def.retentionPeriodYears,
        isActive: true,
        complianceStatus,
      },
    });

    // Create entries based on register type
    const entries =
      def.code === "FORM-18" ? accidentEntries(P)
        : def.code === "FORM-11" ? overtimeEntries(P)
          : def.code === "FORM-22" ? workerRegisterEntries(P)
            : def.code === "CLRA-XIII" ? clraEntries(P)
              : def.code === "PESO-PV" ? pressureVesselEntries(P)
                : [];

    for (const entry of entries) {
      await prisma.registerEntry.create({
        data: {
          registerId: register.id,
          sourceTransactionId: entry.txnId,
          sourceModule: def.sourceModule,
          sourceRef: entry.sourceRef,
          entryDate: entry.entryDate,
          entryCreatedBy: "SYSTEM",
          entryFieldsJson: entry.fields,
          isManualCorrection: false,
          isVoided: false,
          auditTrail: [
            {
              action: "CREATED",
              timestamp: entry.entryDate.toISOString(),
              by: "SYSTEM",
              reason: `Auto-populated from ${def.sourceEventType} event`,
            }
          ],
        },
      });
    }

    const entryCount = entries.length;
    console.log(`   ✓ ${P}: ${def.code.padEnd(12)} — ${def.name.substring(0, 45)}  (${entryCount} entries)  [${complianceStatus}]`);
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Step 23 — Statutory Registers seed                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  await seedPlant("NW");
  await seedPlant("SW");
  console.log("\n✅  Statutory Registers seed complete.");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
