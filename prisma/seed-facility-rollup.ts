// ────────────────────────────────────────────────────────────────────────
// Seed — Facility-Level Compliance & Audit Rollup Extension (P1)
//
// Adds the data the new per-facility rollup blocks read LIVE:
//   1. Prior-quarter (2026-Q1) FactoryComplianceSnapshot rows so the 7-tile
//      strip shows QoQ deltas. Ahmedabad gets the exact build-prompt §7 story
//      (compliance ↑ good, findings ↑ worsening, incidents ↓ good, CAPAs flat);
//      every other MAG site with a LIVE snapshot gets a generic improving prior.
//   2. FactoryEnvPeriod rows for Ahmedabad (current 2026-Q2 + prior 2026-Q1) —
//      the ESG "source module" the Environmental rollup reads.
//   3. Certifications top-up for Ahmedabad (SA8000 → expiring in 71 days; adds
//      OEKO-TEX current) so the Certifications block shows a watch row.
//   4. CompetencyRecords for Ahmedabad workers tuned to ≈92% mandatory-valid,
//      3 expiring ≤30d, 1 expired — the Training & Competency block source.
//
// READS from / extends the existing engines; introduces no rollup store. The
// only new source-of-truth here is FactoryEnvPeriod (the ESG module).
//
// Idempotent (delete-by-key then create). Run AFTER seed-factory + seed-factory-
// ops. For non-Ahmedabad QoQ deltas, run AFTER a dashboard load / snapshot
// recompute (so LIVE snapshots exist to derive a prior from).
//   npx tsx prisma/seed-facility-rollup.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NOW = new Date("2026-06-20T00:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const PERIOD = "2026-Q2"; // current quarter (matches quarter_label(2026-06-20))
const PRIOR = "2026-Q1"; // prior quarter the deltas diff against
const AMD_CODE = "MAG-GJ-02"; // Meridian Apparel — Ahmedabad

async function main() {
  console.log("Seeding facility rollup extension (P1) — deltas + env + certs + training…");

  const owner =
    (await prisma.user.findFirst({ where: { email: "mervyn.fernandes@meridian-apparel.in" } })) ??
    (await prisma.user.findFirst());
  if (!owner) throw new Error("No users found — run seed-rbac / seed-factory first.");

  const amd = await prisma.factoryProfile.findFirst({ where: { factoryCode: AMD_CODE } });
  if (!amd) throw new Error(`Ahmedabad profile (${AMD_CODE}) missing — run seed-factory first.`);
  const siteId = amd.siteId;

  // ── 1. Prior-quarter snapshots (QoQ deltas) ──────────────────────────────
  await prisma.$executeRawUnsafe(`DELETE FROM "FactoryComplianceSnapshot" WHERE "periodLabel" = $1`, PRIOR);

  // Ahmedabad — exact §7 story (current live ≈ compliance 80, findings 1,
  // CAPAs 1, incidents 1). Prior values chosen so deltas read:
  //   compliance 80 ↑ 74 (good) · findings 1 ↑ 0 (worsening) · CAPAs 1 = 1 (flat)
  //   · incidents 1 ↓ 2 (good) · obligations neutral.
  await prisma.factoryComplianceSnapshot.create({
    data: {
      factoryProfileId: amd.id, siteId, periodLabel: PRIOR,
      auditComplianceScorePct: 74, openFindings: 0, criticalFindings: 0,
      openCapas: 1, overdueCapas: 0, openObligations: 0, overdueObligations: 0,
      certsExpiringCount: 1, incidentCount12m: 2, computedAt: daysAgo(80), createdBy: "seed",
    },
  });

  // Every other MAG site with a LIVE snapshot → a generic improving prior.
  const lives = await prisma.factoryComplianceSnapshot.findMany({ where: { periodLabel: "LIVE" } });
  let derived = 0;
  for (const live of lives) {
    if (live.factoryProfileId === amd.id) continue;
    await prisma.factoryComplianceSnapshot.create({
      data: {
        factoryProfileId: live.factoryProfileId, siteId: live.siteId, periodLabel: PRIOR,
        auditComplianceScorePct:
          live.auditComplianceScorePct != null ? Math.max(0, Math.round((live.auditComplianceScorePct - 6) * 10) / 10) : null,
        openFindings: live.openFindings + 1, criticalFindings: live.criticalFindings,
        openCapas: live.openCapas, overdueCapas: live.overdueCapas,
        openObligations: live.openObligations, overdueObligations: live.overdueObligations,
        certsExpiringCount: live.certsExpiringCount, incidentCount12m: live.incidentCount12m + 1,
        computedAt: daysAgo(80), createdBy: "seed",
      },
    });
    derived++;
  }

  // ── 2. Environment (FactoryEnvPeriod) — Ahmedabad current + prior ─────────
  await prisma.factoryEnvPeriod.deleteMany({ where: { factoryProfileId: amd.id } });
  await prisma.factoryEnvPeriod.create({
    data: {
      factoryProfileId: amd.id, siteId, periodLabel: PERIOD,
      energyKwh: 210_000, energyTargetKwh: 225_000,
      waterWithdrawnKl: 3_200, effluentDischargedKl: 2_650, etpStatus: "COMPLIANT",
      consentStatus: "SPCB Consent to Operate — current",
      wasteGeneratedT: 14, wasteDivertedPct: 62, wasteDivertedTargetPct: 70,
      scope1TCo2e: 38, scope2TCo2e: 150, createdBy: "seed",
    },
  });
  await prisma.factoryEnvPeriod.create({
    data: {
      factoryProfileId: amd.id, siteId, periodLabel: PRIOR,
      energyKwh: 218_750, energyTargetKwh: 225_000, // 210,000 is −4% QoQ
      waterWithdrawnKl: 3_350, effluentDischargedKl: 2_780, etpStatus: "COMPLIANT",
      consentStatus: "SPCB Consent to Operate — current",
      wasteGeneratedT: 15, wasteDivertedPct: 58, wasteDivertedTargetPct: 70,
      scope1TCo2e: 40, scope2TCo2e: 158, createdBy: "seed",
    },
  });

  // ── 3. Certifications top-up — Ahmedabad ─────────────────────────────────
  // SA8000 → expiring in 71 days (renewalLeadDays 90 ⇒ EXPIRING_SOON / watch).
  await prisma.factoryCertification.updateMany({
    where: { factoryProfileId: amd.id, certificationType: "SA8000" },
    data: { expiryDate: daysFromNow(71), status: "VALID" },
  });
  // OEKO-TEX current (idempotent).
  await prisma.factoryCertification.deleteMany({ where: { factoryProfileId: amd.id, certificationType: "OEKO_TEX" } });
  await prisma.factoryCertification.create({
    data: {
      factoryProfileId: amd.id, siteId, certificationType: "OEKO_TEX", certificateNo: "OEKOTEX-MAG-AMD",
      issuingBody: "OEKO-TEX (STANDARD 100)", issueDate: daysAgo(200), expiryDate: daysFromNow(300),
      renewalLeadDays: 60, status: "VALID", createdBy: "seed",
    },
  });

  // ── 4. Training & competency (CompetencyRecord) — Ahmedabad ───────────────
  const COMPS = [
    { code: "FACROLL-FIRE-WARDEN", name: "Fire warden refresher", category: "safety_critical", months: 12 },
    { code: "FACROLL-FIRST-AID", name: "First-aider certification", category: "safety_critical", months: 24 },
    { code: "FACROLL-CHEM-HANDLING", name: "Chemical handling", category: "safety_critical", months: 12 },
    { code: "FACROLL-MACHINE-GUARD", name: "Machine guarding & safety", category: "operational", months: 24 },
    { code: "FACROLL-EHS-INDUCTION", name: "EHS induction", category: "regulatory", months: 36 },
  ];
  const cid: Record<string, string> = {};
  for (const c of COMPS) {
    const row = await prisma.competency.upsert({
      where: { code: c.code },
      update: { name: c.name, category: c.category },
      create: {
        code: c.code, name: c.name, category: c.category, validationMethods: [], relatedTrainingProgramIds: [],
        defaultValidityMonths: c.months, isActive: true, isGlobal: true, createdByUserId: owner.id,
      },
    });
    cid[c.code] = row.id;
  }
  await prisma.competencyRecord.deleteMany({ where: { competencyId: { in: Object.values(cid) } } });

  const workers = await prisma.user.findMany({ take: 13, orderBy: { id: "asc" } });
  if (workers.length < 13) throw new Error(`Need ≥13 users for the training seed; found ${workers.length}.`);

  const mkRec = (uid: string, competencyId: string, state: string, validUntil: Date) =>
    prisma.competencyRecord.create({
      data: {
        plantId: siteId, personUserId: uid, competencyId, state,
        validFrom: daysAgo(200), validUntil,
        currentValidatedAt: state.startsWith("expired") ? null : daysAgo(200),
        createdByUserId: owner.id,
      },
    });

  // 12 of 13 workers fully valid (EHS induction current); worker 12 has an
  // expired chemical-handling record ⇒ 12/13 = 92.3% mandatory-valid.
  for (let i = 0; i < 12; i++) await mkRec(workers[i].id, cid["FACROLL-EHS-INDUCTION"], "validated_active", daysFromNow(700));
  // 3 competencies expiring ≤30d (fire-warden ×2, first-aider ×1) — still "valid".
  await mkRec(workers[0].id, cid["FACROLL-FIRE-WARDEN"], "expiring_soon", daysFromNow(20));
  await mkRec(workers[1].id, cid["FACROLL-FIRE-WARDEN"], "expiring_soon", daysFromNow(18));
  await mkRec(workers[2].id, cid["FACROLL-FIRST-AID"], "expiring_soon", daysFromNow(25));
  // 1 expired competency (chemical handling) — worker 12 not fully valid.
  await mkRec(workers[12].id, cid["FACROLL-CHEM-HANDLING"], "expired_revoked", daysAgo(15));
  // A little more depth on some valid workers (no effect on the headline ratio).
  for (let i = 3; i < 8; i++) await mkRec(workers[i].id, cid["FACROLL-MACHINE-GUARD"], "validated_active", daysFromNow(500));

  // ── 5. Social-compliance (SA8000) — Ahmedabad: 1 open flag + training 90% ─
  // Working-hours record incomplete (overtimeVoluntary ATTENTION) ⇒ exactly one
  // open flag ⇒ composite score 86/100 (build-prompt §7). OT kept within the
  // 12h cap so no second penalty.
  await prisma.socialComplianceProfile.updateMany({
    where: { factoryProfileId: amd.id },
    data: {
      overtimeVoluntary: "ATTENTION", weeklyRestDayProvided: "COMPLIANT", maxWeeklyOvertimeHours: 12,
      sa8000AwarenessTrainingPct: 90, overallSocialComplianceFlag: "ATTENTION",
    },
  });

  // ── 6. Operational risk — Ahmedabad: 2 active permits (1 hot-work) + 1 open MOC ─
  // HIRA is intentionally left empty ⇒ 0 overdue reviews (the §7 state).
  await prisma.permit.deleteMany({ where: { number: { startsWith: "FACROLL-PTW-" } } });
  await prisma.changeRequest.deleteMany({ where: { number: { startsWith: "FACROLL-MOC-" } } });
  await prisma.permit.create({
    data: {
      number: "FACROLL-PTW-AMD-01", type: "HOT_WORK", plantId: siteId, location: "Finishing — boiler area",
      scopeOfWork: "Hot work: welding repair on steam-line bracket", validFrom: daysAgo(1), validTo: daysFromNow(1),
      originatorId: owner.id, status: "ACTIVE", fireWatchRequired: true,
    },
  });
  await prisma.permit.create({
    data: {
      number: "FACROLL-PTW-AMD-02", type: "GENERAL_COLD", plantId: siteId, location: "Cutting hall",
      scopeOfWork: "Cold work: routine machine-guard refit", validFrom: daysAgo(1), validTo: daysFromNow(2),
      originatorId: owner.id, status: "ACTIVE",
    },
  });
  await prisma.changeRequest.create({
    data: {
      number: "FACROLL-MOC-AMD-01", plantId: siteId, title: "New finishing-line layout",
      description: "Re-layout of the finishing line to add an inline inspection bay; pre-startup verification pending.",
      category: "process_change", origin: "continuous_improvement", classification: "major",
      initiatedByUserId: owner.id, status: "implementation_complete_pending_verification",
      proposedImplementationDate: daysAgo(20), targetCompletionDate: daysFromNow(10),
    },
  });

  console.log(
    `✅  Rollup seed complete — prior snapshots: 1 (Ahmedabad) + ${derived} derived; ` +
      `env periods: 2; certs: SA8000 expiring-71d + OEKO-TEX; competency records for 13 Ahmedabad workers; ` +
      `social: 1 open flag + 90% training; op-risk: 2 active permits (1 hot-work) + 1 open MOC.`
  );
  if (derived === 0) {
    console.log("ℹ️  No LIVE snapshots found for other sites — only Ahmedabad shows deltas. " +
      "Load the consolidated dashboard (or POST /api/factory/snapshots/recompute) then re-run for estate-wide deltas.");
  }
}

main()
  .catch((e) => {
    console.error("❌  Facility rollup seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
