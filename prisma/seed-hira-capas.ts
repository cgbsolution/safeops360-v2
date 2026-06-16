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

async function main() {
  // ── Resolve all ids dynamically (the old hardcoded CUIDs no longer exist after re-seed) ──

  // NW plant
  const nw = await prisma.plant.findFirstOrThrow({ where: { code: "NW" } });
  const nwId = nw.id;

  // Users — look up by role within NW; fall back to any NW user if a role is missing.
  async function nwUserByRole(roleCode: string): Promise<string> {
    const u =
      (await prisma.user.findFirst({ where: { role: roleCode, plantId: nwId } })) ??
      (await prisma.user.findFirstOrThrow({ where: { plantId: nwId } }));
    return u.id;
  }
  const HSE_MGR_NW   = await nwUserByRole("HSE_MANAGER");
  const DEPT_HEAD_NW = await nwUserByRole("DEPARTMENT_HEAD");
  const ENV_MGR_NW   = await nwUserByRole("ENVIRONMENT_MANAGER");
  const WORKER_NW    = await nwUserByRole("CONTRACTOR_WORKMAN");
  const EMERG_NW     = await nwUserByRole("EMERGENCY_RESPONSE_COORDINATOR");
  // WORKER_NW / EMERG_NW are resolved for completeness (mirrors original captured ids).
  void WORKER_NW;
  void EMERG_NW;

  // HIRA entries — produced by prisma/seed-risk-management.ts for plant NW.
  //   Study 001  number = HIRA-2026-NW-DEMO-001  (Dye House reactive-dye dosing)
  //   Study 002  number = HIRA-2026-NW-DEMO-002  (Hot Work operations)
  // Each entry's sequenceNumber is deterministic (eIdx + 1), so (studyNumber, sequenceNumber)
  // is a stable lookup key. We verify against a distinctive activityDescription substring,
  // and fall back to study-order if a match can't be found, so all 6 CAPAs get a valid entryId.
  const study001 = await prisma.hiraStudy.findFirstOrThrow({ where: { number: "HIRA-2026-NW-DEMO-001" } });
  const study002 = await prisma.hiraStudy.findFirstOrThrow({ where: { number: "HIRA-2026-NW-DEMO-002" } });

  const entries001 = await prisma.hiraEntry.findMany({
    where: { studyId: study001.id },
    orderBy: { sequenceNumber: "asc" },
    select: { id: true, sequenceNumber: true, activityDescription: true },
  });
  const entries002 = await prisma.hiraEntry.findMany({
    where: { studyId: study002.id },
    orderBy: { sequenceNumber: "asc" },
    select: { id: true, sequenceNumber: true, activityDescription: true },
  });

  // Resolve one entry id: prefer activityDescription substring match, else fall back by order.
  function resolveEntry(
    pool: { id: string; sequenceNumber: number; activityDescription: string }[],
    match: string,
    fallbackIndex: number,
  ): string {
    const needle = match.toLowerCase();
    const found = pool.find(e => e.activityDescription.toLowerCase().includes(needle));
    if (found) return found.id;
    const fb = pool[fallbackIndex] ?? pool[0];
    return fb.id;
  }

  const HIRA_ENTRY_1 = resolveEntry(entries001, "unloading dye chemicals", 0); // Unloading dye chemicals / reactive-dye drums at dye house
  const HIRA_ENTRY_2 = resolveEntry(entries001, "storage in dye house dye-chemical store cage", 1); // Storage in dye house dye-chemical store cage
  const HIRA_ENTRY_3 = resolveEntry(entries001, "connecting drum to dye-bath dosing line", 2); // Connecting drum to dye-bath dosing line
  const HIRA_ENTRY_4 = resolveEntry(entries001, "routine dosing into dyeing vessels", 3); // Routine dosing into dyeing vessels
  const HIRA_ENTRY_5 = resolveEntry(entries002, "gas cutting and oxy-acetylene welding", 0); // Gas cutting and oxy-acetylene welding
  const HIRA_ENTRY_6 = resolveEntry(entries002, "arc welding in maintenance workshop bay", 1); // Arc welding in maintenance workshop bay

  const capas: CapaSpec[] = [
  {
    number: "HCAPA-DEMO-2026-0001",
    entryId: HIRA_ENTRY_1,
    description:
      "Install fixed automatic shut-off valve (ASOv) on the dye house dye-chemical dosing header, pneumatically fail-safe closed, operated from control room and activated by vapour detection alarm. Includes dye-chemical store ventilation upgrade to 15 ACH.",
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
      "Develop and implement a formal written procedure (SOP) for dye house dye-chemical drum unloading, including mandatory pre-delivery checklist, supplier coordination protocol, and emergency communication plan with local fire station.",
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
      "Commission fixed continuous vapour detection system in the dye house dye-chemical store cage: 3-point detection at 0.5 ppm alarm threshold, 1 ppm shutdown threshold. Integrate with building management system for automatic ventilation increase on alarm.",
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
      "Introduce mandatory PPE pre-check station at the entrance to the dye house dye-chemical dosing area: visual checklist board, SCBA donning demonstration poster, and 2-minute minimum pre-entry check requirement enforced by permit-to-work.",
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
