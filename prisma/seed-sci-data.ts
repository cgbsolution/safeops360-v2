// ─────────────────────────────────────────────────────────────────────────────
// Step 29 — SCI (Safety Culture Index) Data
//
// Per plant (NW + SW):
//   • ~20 SciLedgerEntry records spanning multiple users + modules
//   • 6 KaizenPost records (PENDING_COMMITTEE, APPROVED, DECLINED)
//
// Idempotent: deletes entries with matching unique keys before recreating.
// Run: npx tsx prisma/seed-sci-data.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-09T08:00:00.000Z");
function daysAgo(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }

// ── Plants ────────────────────────────────────────────────────────────────
const NW = "cmq42hc7b000913589h1l7q23";
const SW = "cmq42hch7000p1358qc91ieav";

// ── NW Users (verified from DB) ───────────────────────────────────────────
const LALIT_NW       = "cmq42henb001m1358xji62qwd"; // Lalit Nair       HSE_MANAGER
const DEEPAK_T_NW    = "cmq42heim001k1358iqqywpfn"; // Deepak Tomar     HSE_MANAGER
const DILIP_NW       = "cmq42hh6s002i1358pqjb967v"; // Dilip Desai      PLANT_HEAD
const BHASKAR_NW     = "cmq42hgxb002e13585csfjcg2"; // Bhaskar Das      WORKER
const VIVEK_NW       = "cmq42hiaa002y1358j8udc4ag"; // Vivek Gupta      ENVIRONMENT_MANAGER
const TARUN_NW       = "cmq42hipx00341358kw90e0w0"; // Tarun Malhotra   EMERGENCY_RESPONSE
const ROHIT_NW       = "cmq42hhfe002m1358fz385chp"; // Rohit Kumar      HSE_MANAGER
const RAJESH_NW      = "cmq42hdbk001a1358gvqf4aph"; // Rajesh Sharma    WORKER
const PRIYA_NW       = "cmq42hd6300181358tcqqdku9"; // Priya Nair       HSE_MANAGER
const YOGESH_NW      = "cmq42he9g001g1358go3o8bza"; // Yogesh Patel     PLANT_HEAD

// ── SW Users (verified from DB) ───────────────────────────────────────────
const HARI_SW        = "cmq42hn9y004s13582w1z3yaf"; // Hari Chauhan     HSE_MANAGER
const NITIN_SW       = "cmq42hmdl004i1358lak42jl2"; // Nitin Bansal     WORKER
const ANJALI_SW      = "cmq42hmx2004m1358j3i1bp2w"; // Anjali Malhotra  PLANT_HEAD
const FAROOQ_SW      = "cmq42ho13005213586wxlt78k"; // Farooq Rao       ENVIRONMENT_MANAGER
const PANKAJ_SW      = "cmq42hohy00581358qrxougqv"; // Pankaj Yadav     EMERGENCY_RESPONSE
const ARUN_SW        = "cmq42hker003o1358r6citkpo"; // Arun Solanki     HSE_MANAGER
const VIVEK_SW       = "cmq42hkmi003s1358hqr5x6h9"; // Vivek Tiwari     PLANT_HEAD
const ROHIT_SW       = "cmq42hjvd003g1358sh3fguui"; // Rohit Saxena     WORKER
const TARUN_SW       = "cmq42hky7003y13582kzowwbi"; // Tarun Tripathi   HSE_MANAGER
const CHANDAN_SW     = "cmq42hl1z00401358lmabclmb"; // Chandan Iyer     ENVIRONMENT_MANAGER

async function seedLedger(
  plantId: string,
  code: "NW" | "SW",
  users: Record<string, string>,
) {
  const period = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  type LedgerSpec = {
    userId: string;
    sourceModule: string;
    sourceTransactionId: string;
    eventType: string;
    basePoints: number;
    multiplier: number;
    finalPoints: number;
    isAnonymous: boolean;
    isVoided: boolean;
    scoringPeriod: string;
    createdAt: Date;
    auditTrail: object;
  };

  const U = users;
  const ledgerEntries: LedgerSpec[] = [
    // ── Safety Observations ──────────────────────────────────────────
    { userId: U.hse,      sourceModule: "SAFETY_OBS", sourceTransactionId: `SCI-${code}-OBS-001`, eventType: "obs_unsafe_condition_reported",   basePoints: 10, multiplier: 2.0, finalPoints: 20, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(42)), createdAt: daysAgo(42), auditTrail: { rule: "obs_unsafe_condition", severity: "HIGH", v: 2 } },
    { userId: U.deptHead, sourceModule: "SAFETY_OBS", sourceTransactionId: `SCI-${code}-OBS-002`, eventType: "obs_positive_practice_reported",   basePoints: 15, multiplier: 1.2, finalPoints: 18, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(35)), createdAt: daysAgo(35), auditTrail: { rule: "obs_positive_practice", v: 2 } },
    { userId: U.hse,      sourceModule: "SAFETY_OBS", sourceTransactionId: `SCI-${code}-OBS-003`, eventType: "obs_closed_on_time",               basePoints: 5,  multiplier: 1.0, finalPoints: 5,  isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(30)), createdAt: daysAgo(30), auditTrail: { rule: "obs_closed_on_time", closure_days: 4, sla_days: 7 } },
    { userId: U.hse2,     sourceModule: "SAFETY_OBS", sourceTransactionId: `SCI-${code}-OBS-004`, eventType: "obs_unsafe_act_reported",          basePoints: 10, multiplier: 1.5, finalPoints: 15, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(25)), createdAt: daysAgo(25), auditTrail: { rule: "obs_unsafe_act", severity: "MEDIUM", v: 2 } },
    { userId: U.worker,   sourceModule: "SAFETY_OBS", sourceTransactionId: `SCI-${code}-OBS-005`, eventType: "obs_unsafe_condition_reported",   basePoints: 10, multiplier: 1.0, finalPoints: 10, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(18)), createdAt: daysAgo(18), auditTrail: { rule: "obs_unsafe_condition", severity: "LOW", v: 2 } },

    // ── Near Miss ────────────────────────────────────────────────────
    { userId: U.worker,   sourceModule: "NEAR_MISS", sourceTransactionId: `SCI-${code}-NM-001`, eventType: "near_miss_reported",               basePoints: 25, multiplier: 1.5, finalPoints: 38, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(20)), createdAt: daysAgo(20), auditTrail: { rule: "near_miss_reported", severity: "HIGH", v: 2 } },
    { userId: U.hse2,     sourceModule: "NEAR_MISS", sourceTransactionId: `SCI-${code}-NM-002`, eventType: "near_miss_reported",               basePoints: 25, multiplier: 1.0, finalPoints: 25, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(10)), createdAt: daysAgo(10), auditTrail: { rule: "near_miss_reported", severity: "MEDIUM", v: 2 } },

    // ── FLRA completion ──────────────────────────────────────────────
    { userId: U.deptHead, sourceModule: "FLRA", sourceTransactionId: `SCI-${code}-FLRA-001`, eventType: "flra_completed_before_work",           basePoints: 20, multiplier: 1.0, finalPoints: 20, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(15)), createdAt: daysAgo(15), auditTrail: { rule: "flra_completed", v: 2 } },
    { userId: U.worker,   sourceModule: "FLRA", sourceTransactionId: `SCI-${code}-FLRA-002`, eventType: "flra_completed_before_work",           basePoints: 20, multiplier: 1.0, finalPoints: 20, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(8)),  createdAt: daysAgo(8),  auditTrail: { rule: "flra_completed", v: 2 } },

    // ── Training ─────────────────────────────────────────────────────
    { userId: U.worker,   sourceModule: "TRAINING", sourceTransactionId: `SCI-${code}-TRN-001`, eventType: "training_completed_voluntary",     basePoints: 30, multiplier: 1.0, finalPoints: 30, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(60)), createdAt: daysAgo(60), auditTrail: { rule: "training_voluntary", program_code: "WORKING_AT_HEIGHT", v: 2 } },
    { userId: U.deptHead, sourceModule: "TRAINING", sourceTransactionId: `SCI-${code}-TRN-002`, eventType: "training_passed_with_distinction",  basePoints: 30, multiplier: 1.5, finalPoints: 45, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(55)), createdAt: daysAgo(55), auditTrail: { rule: "training_distinction", score: 94, v: 2 } },
    { userId: U.hse,      sourceModule: "TRAINING", sourceTransactionId: `SCI-${code}-TRN-003`, eventType: "training_completed_mandatory",      basePoints: 15, multiplier: 1.0, finalPoints: 15, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(40)), createdAt: daysAgo(40), auditTrail: { rule: "training_mandatory", program_code: "FIRE_SAFETY", v: 2 } },
    { userId: U.envMgr,   sourceModule: "TRAINING", sourceTransactionId: `SCI-${code}-TRN-004`, eventType: "training_completed_voluntary",      basePoints: 30, multiplier: 1.0, finalPoints: 30, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(50)), createdAt: daysAgo(50), auditTrail: { rule: "training_voluntary", program_code: "CHEMICAL_HANDLING", v: 2 } },

    // ── Inspection ───────────────────────────────────────────────────
    { userId: U.hse,      sourceModule: "INSPECTION", sourceTransactionId: `SCI-${code}-INS-001`, eventType: "inspection_finding_closed_on_time", basePoints: 12, multiplier: 1.0, finalPoints: 12, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(10)), createdAt: daysAgo(10), auditTrail: { rule: "finding_closed_on_time", v: 2 } },
    { userId: U.hse2,     sourceModule: "INSPECTION", sourceTransactionId: `SCI-${code}-INS-002`, eventType: "inspection_closed_no_overdue",     basePoints: 12, multiplier: 1.0, finalPoints: 12, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(5)),  createdAt: daysAgo(5),  auditTrail: { rule: "inspection_closed_no_overdue", v: 2 } },

    // ── CAPA closure ─────────────────────────────────────────────────
    { userId: U.envMgr,   sourceModule: "CAPA", sourceTransactionId: `SCI-${code}-CAPA-001`, eventType: "capa_closed_on_time",                  basePoints: 20, multiplier: 1.2, finalPoints: 24, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(8)), createdAt: daysAgo(8),  auditTrail: { rule: "capa_closed_on_time", v: 2 } },
    { userId: U.deptHead, sourceModule: "CAPA", sourceTransactionId: `SCI-${code}-CAPA-002`, eventType: "capa_closed_with_evidence",             basePoints: 20, multiplier: 1.0, finalPoints: 20, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(12)), createdAt: daysAgo(12), auditTrail: { rule: "capa_closed_with_evidence", v: 2 } },

    // ── PTW crew lifecycle ────────────────────────────────────────────
    { userId: U.emerg,    sourceModule: "PTW", sourceTransactionId: `SCI-${code}-PTW-001`, eventType: "ptw_crew_lifecycle_complete",             basePoints: 8,  multiplier: 1.0, finalPoints: 8,  isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(7)),  createdAt: daysAgo(7),  auditTrail: { rule: "ptw_crew_lifecycle", v: 2 } },
    { userId: U.worker,   sourceModule: "PTW", sourceTransactionId: `SCI-${code}-PTW-002`, eventType: "ptw_crew_lifecycle_complete",             basePoints: 8,  multiplier: 1.0, finalPoints: 8,  isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(3)),  createdAt: daysAgo(3),  auditTrail: { rule: "ptw_crew_lifecycle", v: 2 } },

    // ── Safety streak bonus ───────────────────────────────────────────
    { userId: U.hse,      sourceModule: "STREAK", sourceTransactionId: `SCI-${code}-STREAK-30D`, eventType: "safety_streak_30_days",            basePoints: 50, multiplier: 1.0, finalPoints: 50, isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(1)), createdAt: daysAgo(1),  auditTrail: { rule: "streak_30d", streak_days: 30, v: 2 } },
    { userId: U.deptHead, sourceModule: "STREAK", sourceTransactionId: `SCI-${code}-STREAK-60D`, eventType: "safety_streak_60_days",            basePoints: 100,multiplier: 1.0, finalPoints: 100,isAnonymous: false, isVoided: false, scoringPeriod: period(daysAgo(1)), createdAt: daysAgo(1),  auditTrail: { rule: "streak_60d", streak_days: 60, v: 2 } },
  ];

  // Delete existing entries for this plant (idempotent)
  await prisma.sciLedgerEntry.deleteMany({
    where: { plantId, sourceTransactionId: { in: ledgerEntries.map(e => e.sourceTransactionId) } },
  });

  for (const e of ledgerEntries) {
    await prisma.sciLedgerEntry.create({
      data: {
        userId:                e.userId,
        plantId,
        sourceModule:          e.sourceModule,
        sourceTransactionId:   e.sourceTransactionId,
        eventType:             e.eventType,
        basePoints:            e.basePoints,
        multiplier:            e.multiplier,
        finalPoints:           e.finalPoints,
        isAnonymous:           e.isAnonymous,
        isVoided:              e.isVoided,
        scoringPeriod:         e.scoringPeriod,
        createdAt:             e.createdAt,
        auditTrail:            e.auditTrail,
      },
    });
  }

  console.log(`  ✅  ${code}: ${ledgerEntries.length} SCI ledger entries`);
}

async function seedKaizen(
  plantId: string,
  code: "NW" | "SW",
  hse: string,
  worker: string,
  deptHead: string,
  envMgr: string,
) {
  await prisma.kaizenPost.deleteMany({ where: { plantId } });

  type KaizenSpec = {
    submitterUserId: string; isAnonymous: boolean; category: string;
    hazardSeveritySelf: string; description: string; locationTag: string;
    status: string; finalCommitteeScore?: number; pointsAwardedSubmitter?: number;
    declineFeedback?: string; committeeScoresJson?: object;
    reviewedByUserId?: string; createdAt: Date;
  };

  const posts: KaizenSpec[] = [
    // APPROVED × 3
    {
      submitterUserId: worker, isAnonymous: false, category: "UNSAFE_CONDITION",
      hazardSeveritySelf: "HIGH", locationTag: "Utilities Block — Boiler Area",
      description: "The walkway alongside Boiler #2 has a corroded grating section (approx 40 cm × 30 cm) near the expansion joint. In wet conditions the corroded section flexes visibly. I nearly slipped last Thursday during a routine round. Suggested fix: replace the grating section with chequer plate.",
      status: "APPROVED", finalCommitteeScore: 8.7, pointsAwardedSubmitter: 75,
      committeeScoresJson: [
        { reviewerId: hse, hazardSig: 9, learningVal: 8, actionQual: 9, decision: "APPROVE" },
        { reviewerId: deptHead, hazardSig: 9, learningVal: 8, actionQual: 9, decision: "APPROVE" },
      ],
      reviewedByUserId: hse,
      createdAt: daysAgo(45),
    },
    {
      submitterUserId: deptHead, isAnonymous: true, category: "NEAR_MISS",
      hazardSeveritySelf: "MEDIUM", locationTag: "Chemical Storage — Cylinder cage",
      description: "While changing over a chlorine cylinder, the connection spanner was not the correct size for the valve nut and slipped twice. No injury, but the wrong tool was available because the dedicated spanner was not returned to its marked location after the previous shift. Needs mandatory spanner tagging and check-out system.",
      status: "APPROVED", finalCommitteeScore: 7.9, pointsAwardedSubmitter: 60,
      committeeScoresJson: [
        { reviewerId: hse, hazardSig: 8, learningVal: 8, actionQual: 7, decision: "APPROVE" },
        { reviewerId: envMgr, hazardSig: 7, learningVal: 9, actionQual: 8, decision: "APPROVE" },
      ],
      reviewedByUserId: hse,
      createdAt: daysAgo(30),
    },
    {
      submitterUserId: hse, isAnonymous: false, category: "GOOD_PRACTICE",
      hazardSeveritySelf: "LOW", locationTag: "Quality Control Laboratory",
      description: "The QC Lab team introduced a colour-coded sample rack system where all samples requiring fume hood handling are placed in RED racks. This has eliminated the previous confusion about which samples needed ventilated handling and has improved throughput. Recommend rolling out to the SW lab.",
      status: "APPROVED", finalCommitteeScore: 9.2, pointsAwardedSubmitter: 90,
      committeeScoresJson: [
        { reviewerId: deptHead, hazardSig: 7, learningVal: 10, actionQual: 10, decision: "APPROVE" },
        { reviewerId: envMgr, hazardSig: 7, learningVal: 9, actionQual: 10, decision: "APPROVE" },
      ],
      reviewedByUserId: deptHead,
      createdAt: daysAgo(15),
    },
    // PENDING_COMMITTEE × 2
    {
      submitterUserId: worker, isAnonymous: false, category: "IMPROVEMENT_SUGGESTION",
      hazardSeveritySelf: "MEDIUM", locationTag: "Loading / Dispatch Area",
      description: "The reversing alarm on Forklift FLT-003 is much quieter than the other forklifts. In the noisy dispatch area, pedestrians cannot hear it until the vehicle is very close. The alarm should be replaced or the sensitivity increased. Multiple colleagues have mentioned this to me.",
      status: "PENDING_COMMITTEE",
      createdAt: daysAgo(3),
    },
    {
      submitterUserId: envMgr, isAnonymous: true, category: "UNSAFE_ACT",
      hazardSeveritySelf: "HIGH", locationTag: "Maintenance Workshop — Hot work bay",
      description: "On two separate occasions this month I observed arc welding being carried out without a fire watch person being present, as required by the hot work permit. The welder was working alone. When I asked, he said the fire watch had 'stepped out for a minute.' This is a permit violation and a significant fire risk given the combustible storage nearby.",
      status: "PENDING_COMMITTEE",
      createdAt: daysAgo(1),
    },
    // DECLINED × 1
    {
      submitterUserId: deptHead, isAnonymous: false, category: "IMPROVEMENT_SUGGESTION",
      hazardSeveritySelf: "LOW", locationTag: "Site Office",
      description: "Suggest that the HSE department switch from paper-based PPE sign-out logs to a digital QR code system. Each PPE item would have a QR code and workers scan in/out on their phones.",
      status: "DECLINED",
      finalCommitteeScore: 4.1,
      declineFeedback: "Thank you for the suggestion. A digital PPE management system is already part of the PPE module roadmap and is expected to be available in Q3 FY27. Your suggestion is recorded as supporting evidence for the business case.",
      committeeScoresJson: [
        { reviewerId: hse, hazardSig: 2, learningVal: 5, actionQual: 6, decision: "DECLINE" },
        { reviewerId: envMgr, hazardSig: 2, learningVal: 4, actionQual: 5, decision: "DECLINE" },
      ],
      reviewedByUserId: hse,
      createdAt: daysAgo(20),
    },
  ];

  for (const p of posts) {
    await prisma.kaizenPost.create({
      data: {
        submitterUserId: p.submitterUserId,
        isAnonymous: p.isAnonymous,
        plantId,
        category: p.category,
        hazardSeveritySelf: p.hazardSeveritySelf,
        description: p.description,
        locationTag: p.locationTag,
        status: p.status,
        ...(p.committeeScoresJson !== undefined && { committeeScoresJson: p.committeeScoresJson }),
        finalCommitteeScore: p.finalCommitteeScore,
        pointsAwardedSubmitter: p.pointsAwardedSubmitter,
        declineFeedback: p.declineFeedback,
        crossPlantDistributed: p.status === "APPROVED" && !!p.finalCommitteeScore && p.finalCommitteeScore >= 8.5,
        reactionsCount: p.status === "APPROVED" ? Math.floor(3 + Math.random() * 18) : 0,
        reviewedByUserId: p.reviewedByUserId,
        reviewedAt: p.reviewedByUserId ? daysAgo(Math.max(1, Math.floor((TODAY.getTime() - p.createdAt.getTime()) / 86400000) - 3)) : undefined,
        createdAt: p.createdAt,
        approvedAt: p.status === "APPROVED" ? daysAgo(Math.max(0, Math.floor((TODAY.getTime() - p.createdAt.getTime()) / 86400000) - 3)) : undefined,
      },
    });
  }

  console.log(`  ✅  ${code}: 6 KaizenPost records (3 approved, 2 pending, 1 declined)`);
}

async function main() {
  console.log("Seeding SCI Ledger + Kaizen posts…");

  // NW plant — Lalit Nair is the primary HSE Manager (logged-in user)
  await seedLedger(NW, "NW", {
    hse:      LALIT_NW,
    hse2:     DEEPAK_T_NW,
    deptHead: DILIP_NW,
    worker:   BHASKAR_NW,
    envMgr:   VIVEK_NW,
    emerg:    TARUN_NW,
  });

  // SW plant
  await seedLedger(SW, "SW", {
    hse:      HARI_SW,
    hse2:     ARUN_SW,
    deptHead: ANJALI_SW,
    worker:   NITIN_SW,
    envMgr:   FAROOQ_SW,
    emerg:    PANKAJ_SW,
  });

  // Kaizen posts
  await seedKaizen(NW, "NW", LALIT_NW, BHASKAR_NW, DILIP_NW, VIVEK_NW);
  await seedKaizen(SW, "SW", HARI_SW, NITIN_SW, ANJALI_SW, FAROOQ_SW);

  console.log("✅  SCI seed complete");
}

main().catch(console.error).finally(() => prisma.$disconnect());
