// ─────────────────────────────────────────────────────────────────────────────
// Step 30 — HIRA CAPAs
//
// Creates HiraCapa records linked to existing NW HiraEntry records.
// 6 CAPAs covering various statuses: OPEN, IN_PROGRESS, COMPLETED, VERIFIED, CANCELLED
//
// Idempotent: deletes records with number containing "HCAPA-DEMO" before recreating.
// Run: npx tsx prisma/seed-hira-capas.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-07T08:00:00.000Z");
function daysAgo(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; }

// HIRA Entry IDs (NW plant — from activity data seed)
const HIRA_ENTRY_1 = "cmq4v48sj000f13666eg8thvr"; // Unloading chlorine cylinders
const HIRA_ENTRY_2 = "cmq4v49w1000x1366t6a5g6w1"; // Storage in chlorine cylinder cage
const HIRA_ENTRY_3 = "cmq4v4azz001f1366t3czi8wl"; // Connecting cylinder to dosing line
const HIRA_ENTRY_4 = "cmq4v4c1t001x1366sf0sj9x2"; // Routine process dosing
const HIRA_ENTRY_5 = "cmq4v4h5y00451366l7q7rn9d"; // Gas cutting and oxy-acetylene welding
const HIRA_ENTRY_6 = "cmq4v4iaw004n13667kimg4ee"; // Arc welding in workshop bay

const HSE_MGR_NW   = "cmq42hhjw002o1358mzpjpr5i";
const DEPT_HEAD_NW = "cmq42hh6s002i1358pqjb967v";
const ENV_MGR_NW   = "cmq42hiaa002y1358j8udc4ag";
const WORKER_NW    = "cmq42hgxb002e13585csfjcg2";
const EMERG_NW     = "cmq42hipx00341358kw90e0w0";

type CapaSpec = {
  number: string;
  entryId: string;
  description: string;
  controlHierarchy: string;
  ownerId: string;
  targetDate: Date;
  status: string;
  completedAt?: Date;
  completionNote?: string;
  verifierId?: string;
  verifiedAt?: Date;
  verifyMethod?: string;
  effectiveness?: string;
};

const capas: CapaSpec[] = [
  {
    number: "HCAPA-DEMO-2026-0001",
    entryId: HIRA_ENTRY_1,
    description:
      "Install fixed automatic shut-off valve (ASOv) on chlorine cylinder header, pneumatically fail-safe closed, operated from control room and activated by gas detection alarm. Includes cylinder cage ventilation upgrade to 15 ACH.",
    controlHierarchy: "ENGINEERING",
    ownerId: DEPT_HEAD_NW,
    targetDate: daysFromNow(30),
    status: "IN_PROGRESS",
    completedAt: undefined,
    completionNote: undefined,
    verifierId: undefined,
    verifiedAt: undefined,
    verifyMethod: undefined,
    effectiveness: undefined,
  },
  {
    number: "HCAPA-DEMO-2026-0002",
    entryId: HIRA_ENTRY_1,
    description:
      "Develop and implement a formal written procedure (SOP) for chlorine cylinder unloading, including mandatory pre-delivery checklist, supplier coordination protocol, and emergency communication plan with local fire station.",
    controlHierarchy: "ADMINISTRATIVE",
    ownerId: HSE_MGR_NW,
    targetDate: daysFromNow(14),
    status: "COMPLETED",
    completedAt: daysAgo(5),
    completionNote:
      "SOP-HSE-CHL-001 Rev 0 issued and communicated to all relevant personnel. Training conducted for 12 operators on 04 Jun 2026. Records filed in DMS.",
    verifierId: ENV_MGR_NW,
    verifiedAt: daysAgo(3),
    verifyMethod: "DOCUMENT_REVIEW",
    effectiveness: "EFFECTIVE",
  },
  {
    number: "HCAPA-DEMO-2026-0003",
    entryId: HIRA_ENTRY_2,
    description:
      "Commission fixed continuous gas detection system in chlorine cylinder storage cage: 3-point detection at 0.5 ppm alarm threshold, 1 ppm shutdown threshold. Integrate with building management system for automatic ventilation increase on alarm.",
    controlHierarchy: "ENGINEERING",
    ownerId: DEPT_HEAD_NW,
    targetDate: daysAgo(10),
    status: "VERIFIED",
    completedAt: daysAgo(15),
    completionNote:
      "Fixed detection system installed by SafeAir Systems. 3 sensors commissioned at cage entry, mid-point, and rear wall. All alarm thresholds tested and verified.",
    verifierId: HSE_MGR_NW,
    verifiedAt: daysAgo(8),
    verifyMethod: "PHYSICAL_INSPECTION",
    effectiveness: "EFFECTIVE",
  },
  {
    number: "HCAPA-DEMO-2026-0004",
    entryId: HIRA_ENTRY_3,
    description:
      "Introduce mandatory PPE pre-check station at entrance to chlorine dosing room: visual checklist board, SCBA donning demonstration poster, and 2-minute minimum pre-entry check requirement enforced by permit-to-work.",
    controlHierarchy: "ADMINISTRATIVE",
    ownerId: HSE_MGR_NW,
    targetDate: daysAgo(30),
    status: "VERIFIED",
    completedAt: daysAgo(35),
    completionNote:
      "PPE pre-check station installed. Checkpoint incorporated into PTW cold work checklist for dosing room entry. Supervisor sign-off required.",
    verifierId: DEPT_HEAD_NW,
    verifiedAt: daysAgo(28),
    verifyMethod: "AUDIT",
    effectiveness: "PARTIALLY_EFFECTIVE",
  },
  {
    number: "HCAPA-DEMO-2026-0005",
    entryId: HIRA_ENTRY_5,
    description:
      "Demarcate a dedicated hot work bay in the Maintenance Workshop with fire-resistant curtains, spark-proof flooring, and a permanently mounted fire extinguisher (CO2, 5 kg) and dry powder extinguisher (2 kg) at bay entrance.",
    controlHierarchy: "ENGINEERING",
    ownerId: DEPT_HEAD_NW,
    targetDate: daysFromNow(60),
    status: "OPEN",
    completedAt: undefined,
    completionNote: undefined,
    verifierId: undefined,
    verifiedAt: undefined,
    verifyMethod: undefined,
    effectiveness: undefined,
  },
  {
    number: "HCAPA-DEMO-2026-0006",
    entryId: HIRA_ENTRY_6,
    description:
      "Procure and issue 2 × photoluminescent arc welding shields and update the welding bay layout plan to mandatory eye protection exclusion zones.",
    controlHierarchy: "PPE",
    ownerId: HSE_MGR_NW,
    targetDate: daysAgo(20),
    status: "CANCELLED",
    completedAt: undefined,
    completionNote: undefined,
    verifierId: undefined,
    verifiedAt: undefined,
    verifyMethod: undefined,
    effectiveness: undefined,
  },
];

async function main() {
  console.log("Deleting existing HIRA CAPA demo records…");
  await prisma.hiraCapa.deleteMany({ where: { number: { contains: "HCAPA-DEMO" } } });

  for (const c of capas) {
    await prisma.hiraCapa.create({
      data: {
        number: c.number,
        entryId: c.entryId,
        description: c.description,
        controlHierarchy: c.controlHierarchy,
        ownerId: c.ownerId,
        targetDate: c.targetDate,
        status: c.status,
        completedAt: c.completedAt,
        completionNote: c.completionNote,
        verifierId: c.verifierId,
        verifiedAt: c.verifiedAt,
        verifyMethod: c.verifyMethod,
        effectiveness: c.effectiveness,
        createdAt: daysAgo(60),
        updatedAt: c.completedAt ?? TODAY,
      },
    });
  }

  console.log(`✅  HIRA CAPA seed complete — ${capas.length} records`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
