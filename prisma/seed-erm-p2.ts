// ────────────────────────────────────────────────────────────────────────
// Seed — Enterprise Risk Management (ERM) — Phase 2
//
// Layers the monitoring (KRI), governance (Appetite), compliance (Legal
// Obligations) and evidence (Loss Events) demo data on top of the Phase 1
// ERM register for the Page Industries demo tenant (plants NW / SW).
//
// Phase 1 must already be seeded — this depends on:
//   • the 24 enterprise risks  ERM-2026-0001 .. 0024
//   • the 10 RiskCategory rows (codes STR/FIN/OPS/CMP/REP/TEC/ESG/SCM/PPL/GEO)
//   • the ERM persona users (anand.krishnan, rajesh.nair, kavita.rao, …)
//
// Seeds:
//   • 1 Compliance Officer persona (Nandini Subramaniam) + UserRole
//   • CAPA source category + type "COMPLIANCE"
//   • 18 KRI definitions + 6 monthly readings each (status computed) + breaches
//   • 10 Appetite statements (one per category) + 2 explicit appetite breaches
//   • 28 Legal obligations + compliance tasks (+ 1 overdue CAPA) + attachments
//   • 16 Loss events (incident-auto + manual; calibrated for ERM-2026-0012)
//
// Idempotent: deletes prior Phase 2 demo rows (FK-safe order) + the Nandini
// persona and her UserRole before recreating. Safe to re-run.
//
// Run AFTER: seed-erm.ts (Phase 1).
//   npx tsx prisma/seed-erm-p2.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_PASSWORD } from "./demo-users-config";

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────
const NOW = new Date("2026-06-14T00:00:00.000Z");
function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 3_600_000);
}
function daysFromNow(n: number): Date {
  return new Date(NOW.getTime() + n * 24 * 3_600_000);
}
// Last calendar day of a "YYYY-MM" period, as UTC midnight.
function lastDayOfMonth(year: number, month1to12: number): Date {
  // Day 0 of the *next* month = last day of this month.
  return new Date(Date.UTC(year, month1to12, 0));
}

// KRI status given direction + thresholds (per spec).
function kriStatus(
  value: number,
  direction: "HIGHER_IS_WORSE" | "LOWER_IS_WORSE",
  thresholdGreen: number,
  thresholdAmber: number,
): "GREEN" | "AMBER" | "RED" {
  if (direction === "HIGHER_IS_WORSE") {
    if (value <= thresholdGreen) return "GREEN";
    if (value <= thresholdAmber) return "AMBER";
    return "RED";
  } else {
    if (value >= thresholdGreen) return "GREEN";
    if (value >= thresholdAmber) return "AMBER";
    return "RED";
  }
}

// The 6 monthly periods Dec-2025 .. May-2026.
const PERIODS: { label: string; year: number; month: number }[] = [
  { label: "2025-12", year: 2025, month: 12 },
  { label: "2026-01", year: 2026, month: 1 },
  { label: "2026-02", year: 2026, month: 2 },
  { label: "2026-03", year: 2026, month: 3 },
  { label: "2026-04", year: 2026, month: 4 },
  { label: "2026-05", year: 2026, month: 5 },
];

async function main() {
  console.log("Seeding Enterprise Risk Management (ERM) — Phase 2…");

  // ── Resolve plants ────────────────────────────────────────────────────
  const nw = await prisma.plant.findFirst({ where: { code: "NW" } });
  const sw = await prisma.plant.findFirst({ where: { code: "SW" } });
  if (!nw) throw new Error("NW plant not found — run base seed (Step 9) first");
  if (!sw) throw new Error("SW plant not found — run base seed (Step 9) first");

  // ── Resolve risk categories (Phase 1) ──────────────────────────────────
  const catRows = await prisma.riskCategory.findMany({ select: { id: true, code: true } });
  const catIdByCode = new Map(catRows.map((c) => [c.code, c.id]));
  const catId = (code: string): string => {
    const id = catIdByCode.get(code);
    if (!id) throw new Error(`RiskCategory ${code} not found — run seed-erm.ts (Phase 1) first`);
    return id;
  };

  // ── Resolve Phase 1 enterprise risks (riskCode "ERM-2026-NNNN") ─────────
  const riskRows = await prisma.enterpriseRisk.findMany({
    where: { riskCode: { startsWith: "ERM-2026-" } },
    select: { id: true, riskCode: true, categoryId: true, residualBand: true },
  });
  if (riskRows.length === 0) throw new Error("No ERM-2026-* risks found — run seed-erm.ts (Phase 1) first");
  // map "0008" → risk.id  (key = last 4 digits of the riskCode)
  const riskIdByShort = new Map<string, string>();
  const riskById = new Map<string, (typeof riskRows)[number]>();
  for (const r of riskRows) {
    const short = r.riskCode.replace("ERM-2026-", "");
    riskIdByShort.set(short, r.id);
    riskById.set(r.id, r);
  }
  const rid = (short: string): string => {
    const id = riskIdByShort.get(short);
    if (!id) throw new Error(`EnterpriseRisk ERM-2026-${short} not found`);
    return id;
  };
  // map short codes → risk.ids (for linkedRiskIds arrays); skips any missing
  const ridsOf = (shorts: string[]): string[] => shorts.map((s) => riskIdByShort.get(s)).filter((x): x is string => !!x);

  // ── Resolve existing users by email ─────────────────────────────────────
  const ownerEmails = [
    "anand.krishnan@safeops360.in",
    "rajesh.nair@safeops360.in",
    "kavita.rao@safeops360.in",
    "meera.iyer@safeops360.in",
    "suresh.patel@safeops360.in",
    "lakshmi.venkatesh@safeops360.in",
    "devendra.kulkarni@safeops360.in",
  ];
  const userRows = await prisma.user.findMany({ where: { email: { in: ownerEmails } }, select: { id: true, email: true } });
  const userIdByEmail = new Map(userRows.map((u) => [u.email, u.id]));
  const uid = (email: string): string => {
    const id = userIdByEmail.get(email);
    if (!id) throw new Error(`persona user ${email} not found — run seed-erm.ts (Phase 1) first`);
    return id;
  };
  const anandId = uid("anand.krishnan@safeops360.in");
  const rajeshId = uid("rajesh.nair@safeops360.in");
  const kavitaId = uid("kavita.rao@safeops360.in");
  const meeraId = uid("meera.iyer@safeops360.in");
  const sureshId = uid("suresh.patel@safeops360.in");
  const lakshmiId = uid("lakshmi.venkatesh@safeops360.in");
  const devendraId = uid("devendra.kulkarni@safeops360.in");

  const NANDINI_EMAIL = "nandini.subramaniam@safeops360.in";

  // ── Idempotent wipe (FK-safe order, tolerant) ───────────────────────────
  const safeDelete = async (label: string, fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e) { console.warn(`  (skip ${label}: ${(e as Error).message})`); }
  };

  await safeDelete("kriBreachEvent", () => prisma.kriBreachEvent.deleteMany({}));
  await safeDelete("kriReading", () => prisma.kriReading.deleteMany({}));
  await safeDelete("kriDefinition", () => prisma.kriDefinition.deleteMany({}));
  await safeDelete("appetiteBreach", () => prisma.appetiteBreach.deleteMany({}));
  await safeDelete("appetiteStatement", () => prisma.appetiteStatement.deleteMany({}));
  await safeDelete("complianceAttachment", () => prisma.complianceAttachment.deleteMany({}));
  await safeDelete("complianceTask", () => prisma.complianceTask.deleteMany({}));
  await safeDelete("legalObligation", () => prisma.legalObligation.deleteMany({}));
  await safeDelete("lossEvent", () => prisma.lossEvent.deleteMany({}));
  await safeDelete("capa(COMPLIANCE)", () => prisma.capa.deleteMany({ where: { sourceTypeCode: "COMPLIANCE" } }));
  await safeDelete("userRole(nandini)", () => prisma.userRole.deleteMany({ where: { user: { email: NANDINI_EMAIL } } }));
  await safeDelete("user(nandini)", () => prisma.user.deleteMany({ where: { email: NANDINI_EMAIL } }));

  // ── 1a. Persona — Nandini Subramaniam (Compliance Officer) ──────────────
  const pwHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const nandini = await prisma.user.upsert({
    where: { email: NANDINI_EMAIL },
    update: { name: "Nandini Subramaniam", role: "COMPLIANCE_OFFICER", plantId: nw.id, designation: "Compliance Officer (Corporate)", passwordHash: pwHash },
    create: { email: NANDINI_EMAIL, name: "Nandini Subramaniam", role: "COMPLIANCE_OFFICER", plantId: nw.id, designation: "Compliance Officer (Corporate)", passwordHash: pwHash },
  });
  const nandiniId = nandini.id;
  const compRole = await prisma.role.findUnique({ where: { code: "COMPLIANCE_OFFICER" } });
  if (compRole) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: nandiniId, roleId: compRole.id, scopeType: "PLANT", scopeValue: nw.id },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: nandiniId, roleId: compRole.id, scopeType: "PLANT", scopeValue: nw.id },
      });
    }
  } else {
    console.warn("  (Role COMPLIANCE_OFFICER not found — skipping Nandini UserRole; run seed-rbac.ts)");
  }
  console.log("  persona: Nandini Subramaniam (Compliance Officer) + UserRole");

  // ── 1b. CAPA source category + type "COMPLIANCE" ────────────────────────
  const cmpCat = await prisma.capaSourceCategory.upsert({
    where: { code: "COMPLIANCE" },
    update: { name: "Compliance", prefix: "CMP", sortOrder: 95, isActive: true },
    create: { code: "COMPLIANCE", name: "Compliance", description: "CAPAs raised from overdue / failed compliance obligations.", prefix: "CMP", sortOrder: 95, isActive: true },
  });
  const cmpType = await prisma.capaSourceType.upsert({
    where: { code: "COMPLIANCE" },
    update: { name: "Compliance Obligation", categoryId: cmpCat.id, parentModuleLive: true, parentModuleName: "Compliance", isActive: true, sortOrder: 1 },
    create: { code: "COMPLIANCE", name: "Compliance Obligation", categoryId: cmpCat.id, parentModuleLive: true, parentModuleName: "Compliance", isActive: true, sortOrder: 1 },
  });
  console.log(`  CAPA source: category "${cmpCat.code}" + type "${cmpType.code}"`);

  // ════════════════════════════════════════════════════════════════════════
  // 2. KRIs (KRI-0001 .. KRI-0018) + 6 monthly readings each
  // ════════════════════════════════════════════════════════════════════════
  type Dir = "HIGHER_IS_WORSE" | "LOWER_IS_WORSE";
  type KriSpec = {
    code: string; name: string; description: string; catCode: string;
    feedType: "MANUAL" | "MODULE_FED"; metricProviderKey: string | null;
    unit: string; direction: Dir; targetStatus: "GREEN" | "AMBER" | "RED" | "NO_DATA";
    linked: string[]; ownerId: string;
    thresholdGreen: number; thresholdAmber: number;
    // 6 monthly values Dec→May (May = current). KRI-0016 omits May (no-data).
    values: number[];
  };

  // Values chosen so the LATEST (May) reading lands on targetStatus given
  // direction + thresholds. RED ones deteriorate month-over-month into RED.
  const KRIS: KriSpec[] = [
    {
      code: "KRI-0001", name: "LTIFR — rolling 12 months", catCode: "OPS", feedType: "MODULE_FED",
      metricProviderKey: "incident.ltifr_12m", unit: "per mn manhours", direction: "HIGHER_IS_WORSE",
      targetStatus: "GREEN", linked: ["0008", "0009"], ownerId: devendraId,
      description: "Lost-time injury frequency rate over a rolling 12-month window, per million manhours worked across both plants.",
      thresholdGreen: 0.5, thresholdAmber: 0.9, values: [0.46, 0.42, 0.40, 0.38, 0.35, 0.34],
    },
    {
      code: "KRI-0002", name: "TRIR — rolling 12 months", catCode: "OPS", feedType: "MODULE_FED",
      metricProviderKey: "incident.trir_12m", unit: "per mn manhours", direction: "HIGHER_IS_WORSE",
      targetStatus: "AMBER", linked: ["0008", "0009"], ownerId: devendraId,
      description: "Total recordable incident rate over a rolling 12-month window, per million manhours.",
      thresholdGreen: 1.0, thresholdAmber: 1.8, values: [1.05, 1.10, 1.20, 1.30, 1.42, 1.55],
    },
    {
      code: "KRI-0003", name: "Near-miss : incident ratio", catCode: "OPS", feedType: "MODULE_FED",
      metricProviderKey: "incident.near_miss_ratio", unit: "ratio", direction: "LOWER_IS_WORSE",
      targetStatus: "GREEN", linked: ["0008"], ownerId: devendraId,
      description: "Ratio of reported near-misses to recordable incidents — a higher ratio signals a healthier reporting culture.",
      thresholdGreen: 8, thresholdAmber: 5, values: [7.2, 7.6, 8.1, 8.5, 9.0, 9.4],
    },
    {
      code: "KRI-0004", name: "CAPA overdue %", catCode: "OPS", feedType: "MODULE_FED",
      metricProviderKey: "capa.overdue_pct", unit: "%", direction: "HIGHER_IS_WORSE",
      targetStatus: "AMBER", linked: ["0008", "0013"], ownerId: sureshId,
      description: "Share of open CAPAs that are past their closure-target date.",
      thresholdGreen: 10, thresholdAmber: 25, values: [9, 12, 15, 18, 20, 22],
    },
    {
      code: "KRI-0005", name: "Audit NC rate", catCode: "CMP", feedType: "MODULE_FED",
      metricProviderKey: "audit.nc_rate", unit: "NCs/audit", direction: "HIGHER_IS_WORSE",
      targetStatus: "GREEN", linked: ["0013"], ownerId: sureshId,
      description: "Average number of non-conformities raised per completed audit.",
      thresholdGreen: 3, thresholdAmber: 6, values: [3.4, 3.1, 2.9, 2.7, 2.6, 2.4],
    },
    {
      code: "KRI-0006", name: "Overdue scheduled audits", catCode: "CMP", feedType: "MODULE_FED",
      metricProviderKey: "audit.overdue_audits", unit: "count", direction: "HIGHER_IS_WORSE",
      targetStatus: "GREEN", linked: ["0013"], ownerId: sureshId,
      description: "Count of scheduled internal/external audits past their planned date.",
      thresholdGreen: 2, thresholdAmber: 5, values: [3, 2, 2, 1, 1, 1],
    },
    {
      code: "KRI-0007", name: "Safety competency currency", catCode: "OPS", feedType: "MODULE_FED",
      metricProviderKey: "training.competency_currency_pct", unit: "%", direction: "LOWER_IS_WORSE",
      targetStatus: "AMBER", linked: ["0008", "0023"], ownerId: sureshId,
      description: "Share of safety-critical roles whose mandatory competencies are current (not expired).",
      thresholdGreen: 95, thresholdAmber: 85, values: [93, 92, 91, 90, 89, 88],
    },
    {
      code: "KRI-0008", name: "Overdue statutory obligations", catCode: "CMP", feedType: "MODULE_FED",
      metricProviderKey: "compliance.overdue_obligations", unit: "count", direction: "HIGHER_IS_WORSE",
      targetStatus: "RED", linked: ["0013", "0015"], ownerId: nandiniId,
      description: "Count of statutory obligations whose latest task is overdue. Module-fed from the Compliance register.",
      thresholdGreen: 0, thresholdAmber: 1, values: [0, 1, 1, 2, 2, 3],
    },
    {
      code: "KRI-0009", name: "Net loss quarter", catCode: "FIN", feedType: "MODULE_FED",
      metricProviderKey: "loss.net_loss_quarter", unit: "₹ Lakh", direction: "HIGHER_IS_WORSE",
      targetStatus: "AMBER", linked: ["0006"], ownerId: rajeshId,
      description: "Aggregate net loss (gross less recoveries) booked in the loss-event database for the quarter.",
      thresholdGreen: 100, thresholdAmber: 250, values: [80, 110, 140, 170, 200, 230],
    },
    {
      code: "KRI-0010", name: "Top-3 customer receivables share", catCode: "FIN", feedType: "MANUAL",
      metricProviderKey: null, unit: "%", direction: "HIGHER_IS_WORSE",
      targetStatus: "RED", linked: ["0005"], ownerId: rajeshId,
      description: "Share of total receivables owed by the top three customers — a concentration / credit-risk indicator.",
      thresholdGreen: 45, thresholdAmber: 55, values: [54, 55, 57, 58, 60, 62],
    },
    {
      code: "KRI-0011", name: "Import payables unhedged %", catCode: "FIN", feedType: "MANUAL",
      metricProviderKey: null, unit: "%", direction: "HIGHER_IS_WORSE",
      targetStatus: "GREEN", linked: ["0004"], ownerId: rajeshId,
      description: "Share of import payables exposure left unhedged against USD/INR movements.",
      thresholdGreen: 25, thresholdAmber: 50, values: [30, 28, 24, 22, 20, 18],
    },
    {
      code: "KRI-0012", name: "Raw material price index vs budget", catCode: "FIN", feedType: "MANUAL",
      metricProviderKey: null, unit: "index", direction: "HIGHER_IS_WORSE",
      targetStatus: "RED", linked: ["0006", "0024"], ownerId: meeraId,
      description: "Blended pulpwood/recovered-paper price index relative to the budgeted basket (100 = on budget).",
      thresholdGreen: 105, thresholdAmber: 112, values: [104, 107, 110, 113, 116, 120],
    },
    {
      code: "KRI-0013", name: "Phishing simulation failure rate", catCode: "TEC", feedType: "MANUAL",
      metricProviderKey: null, unit: "%", direction: "HIGHER_IS_WORSE",
      targetStatus: "AMBER", linked: ["0018"], ownerId: kavitaId,
      description: "Share of staff who clicked or submitted credentials in the monthly phishing simulation.",
      thresholdGreen: 5, thresholdAmber: 12, values: [4.5, 6, 7, 8, 9, 10],
    },
    {
      code: "KRI-0014", name: "Critical patch latency", catCode: "TEC", feedType: "MANUAL",
      metricProviderKey: null, unit: "days", direction: "HIGHER_IS_WORSE",
      targetStatus: "GREEN", linked: ["0018", "0019"], ownerId: kavitaId,
      description: "Average days to deploy critical security patches across IT/OT estate after release.",
      thresholdGreen: 7, thresholdAmber: 14, values: [8, 7, 6, 6, 5, 5],
    },
    {
      code: "KRI-0015", name: "Single-source spend share", catCode: "SCM", feedType: "MANUAL",
      metricProviderKey: null, unit: "%", direction: "HIGHER_IS_WORSE",
      targetStatus: "RED", linked: ["0022"], ownerId: meeraId,
      description: "Share of total procurement spend routed through single-source (un-dual-qualified) vendors.",
      thresholdGreen: 15, thresholdAmber: 25, values: [22, 24, 26, 28, 30, 32],
    },
    {
      code: "KRI-0016", name: "Skilled operator attrition (annualised)", catCode: "PPL", feedType: "MANUAL",
      metricProviderKey: null, unit: "%", direction: "HIGHER_IS_WORSE",
      targetStatus: "NO_DATA", linked: ["0023"], ownerId: sureshId,
      description: "Annualised voluntary attrition of skilled operators across both plants. (Latest period not yet reported.)",
      thresholdGreen: 12, thresholdAmber: 18,
      // No May reading — only Dec..Apr (5 values) so it reads NO_DATA / stale.
      values: [13, 14, 15, 16, 17],
    },
    {
      code: "KRI-0017", name: "Groundwater draw vs consented limit", catCode: "ESG", feedType: "MANUAL",
      metricProviderKey: null, unit: "%", direction: "HIGHER_IS_WORSE",
      targetStatus: "AMBER", linked: ["0021"], ownerId: lakshmiId,
      description: "South Kraft & Board Mill groundwater abstraction as a percentage of the consented annual limit.",
      thresholdGreen: 75, thresholdAmber: 90, values: [72, 76, 80, 84, 86, 88],
    },
    {
      code: "KRI-0018", name: "Line 3 unplanned downtime", catCode: "OPS", feedType: "MANUAL",
      metricProviderKey: null, unit: "hrs/month", direction: "HIGHER_IS_WORSE",
      targetStatus: "GREEN", linked: ["0011"], ownerId: devendraId,
      description: "Unplanned downtime hours on the critical North Paper Mill Line 3 per month.",
      thresholdGreen: 12, thresholdAmber: 24, values: [14, 12, 11, 10, 9, 8],
    },
  ];

  let kriCount = 0;
  let readingCount = 0;
  const kriIdByCode = new Map<string, string>();
  for (const k of KRIS) {
    // Verify the chosen current value actually lands on targetStatus (sanity).
    if (k.targetStatus !== "NO_DATA") {
      const cur = k.values[k.values.length - 1];
      const got = kriStatus(cur, k.direction, k.thresholdGreen, k.thresholdAmber);
      if (got !== k.targetStatus) {
        console.warn(`  ⚠ ${k.code}: current value ${cur} computes ${got} but spec wants ${k.targetStatus} (check thresholds)`);
      }
    }

    const def = await prisma.kriDefinition.create({
      data: {
        kriCode: k.code,
        name: k.name,
        description: k.description,
        categoryId: catId(k.catCode),
        linkedRiskIds: ridsOf(k.linked) as any,
        unit: k.unit,
        direction: k.direction,
        frequency: "MONTHLY",
        feedType: k.feedType,
        metricProviderKey: k.feedType === "MODULE_FED" ? k.metricProviderKey : null,
        thresholdGreen: k.thresholdGreen,
        thresholdAmber: k.thresholdAmber,
        ownerId: k.ownerId,
        isActive: true,
        graceDays: 7,
        // overwritten below from the latest reading (or NO_DATA for KRI-0016)
        currentStatus: "NO_DATA",
        currentValue: null,
        createdBy: nandiniId,
      },
    });
    kriIdByCode.set(k.code, def.id);
    kriCount++;

    // ── Readings — one per available period; the source string per feedType.
    const source = k.feedType === "MODULE_FED" ? "MODULE_FED" : "MANUAL";
    const lastIdx = k.values.length - 1;
    let latestStatus: string | null = null;
    let latestValue: number | null = null;
    for (let i = 0; i < k.values.length; i++) {
      const period = PERIODS[i]; // values align Dec→May
      const value = k.values[i];
      const status = kriStatus(value, k.direction, k.thresholdGreen, k.thresholdAmber);
      const isCurrent = i === lastIdx;
      const periodEnd = lastDayOfMonth(period.year, period.month);
      await prisma.kriReading.create({
        data: {
          kriId: def.id,
          periodLabel: period.label,
          periodEnd,
          value,
          status,
          source,
          enteredBy: k.feedType === "MODULE_FED" ? null : k.ownerId,
          isCurrent,
          createdBy: nandiniId,
        },
      });
      readingCount++;
      if (isCurrent) { latestStatus = status; latestValue = value; }
    }

    // ── Denormalise current status/value onto the definition.
    if (k.targetStatus === "NO_DATA") {
      await prisma.kriDefinition.update({ where: { id: def.id }, data: { currentStatus: "NO_DATA", currentValue: latestValue } });
    } else {
      await prisma.kriDefinition.update({ where: { id: def.id }, data: { currentStatus: latestStatus!, currentValue: latestValue } });
    }
  }
  console.log(`  KRIs: ${kriCount} definitions, ${readingCount} readings`);

  // ── KRI breach events ───────────────────────────────────────────────────
  let breachCount = 0;
  // KRI-0010 (RED) — open
  await prisma.kriBreachEvent.create({
    data: { kriId: kriIdByCode.get("KRI-0010")!, breachType: "RED", status: "OPEN", createdBy: nandiniId },
  }); breachCount++;
  // KRI-0015 (RED) — open
  await prisma.kriBreachEvent.create({
    data: { kriId: kriIdByCode.get("KRI-0015")!, breachType: "RED", status: "OPEN", createdBy: nandiniId },
  }); breachCount++;
  // KRI-0012 (RED) — acknowledged
  await prisma.kriBreachEvent.create({
    data: {
      kriId: kriIdByCode.get("KRI-0012")!, breachType: "RED", status: "ACKNOWLEDGED",
      acknowledgedBy: rajeshId, acknowledgedAt: daysAgo(8),
      resolutionNotes: "Hedging review underway", createdBy: nandiniId,
    },
  }); breachCount++;
  console.log(`  KRI breach events: ${breachCount}`);

  // ════════════════════════════════════════════════════════════════════════
  // 3. Appetite statements (one per category) + 2 explicit breaches
  // ════════════════════════════════════════════════════════════════════════
  const APPROVAL_REF = "RMC Meeting 14-May-2026, Item 4.2";
  const approvedAt = new Date("2026-05-14T00:00:00.000Z");

  type Band = { bandType: string; thresholdValue: number };
  type AppetiteSpec = { catCode: string; level: string; statementText: string; bands: Band[] };
  const APPETITES: AppetiteSpec[] = [
    {
      catCode: "OPS", level: "AVERSE",
      statementText: "The Board has no appetite for operational risks that threaten the safety of people or the licence to operate; serious-injury exposure must be driven As Low As Reasonably Practicable.",
      bands: [{ bandType: "MAX_CRITICAL_COUNT", thresholdValue: 2 }, { bandType: "MAX_HIGH_PLUS_COUNT", thresholdValue: 8 }, { bandType: "MAX_RED_KRI_COUNT", thresholdValue: 3 }],
    },
    {
      catCode: "CMP", level: "AVERSE",
      statementText: "The Board has zero tolerance for wilful statutory or regulatory non-compliance and a very low appetite for inadvertent breaches of licences, consents and statutory filings.",
      bands: [{ bandType: "MAX_CRITICAL_COUNT", thresholdValue: 1 }, { bandType: "MAX_HIGH_PLUS_COUNT", thresholdValue: 5 }, { bandType: "MAX_RED_KRI_COUNT", thresholdValue: 3 }],
    },
    {
      catCode: "FIN", level: "CAUTIOUS",
      statementText: "The Board accepts a cautious level of financial risk in pursuit of returns, provided liquidity, leverage and concentration exposures remain within Treasury policy limits.",
      // MAX_HIGH_PLUS_COUNT threshold is set BELOW the live FIN HIGH+ count at runtime to force a breach.
      bands: [{ bandType: "MAX_RESIDUAL_SCORE", thresholdValue: 16 }, { bandType: "MAX_HIGH_PLUS_COUNT", thresholdValue: 2 }],
    },
    {
      catCode: "STR", level: "OPEN",
      statementText: "The Board is open to strategic risk where it advances long-term competitive position and growth, subject to disciplined stage-gate governance of major commitments.",
      bands: [{ bandType: "MAX_RESIDUAL_SCORE", thresholdValue: 20 }, { bandType: "MAX_CRITICAL_COUNT", thresholdValue: 3 }],
    },
    {
      catCode: "TEC", level: "MINIMAL",
      statementText: "The Board has minimal appetite for technology and cyber risk that could disrupt production or compromise data, requiring resilient, segmented and well-backed-up IT/OT systems.",
      bands: [{ bandType: "MAX_RESIDUAL_SCORE", thresholdValue: 16 }, { bandType: "MAX_RED_KRI_COUNT", thresholdValue: 3 }],
    },
    {
      catCode: "ESG", level: "CAUTIOUS",
      statementText: "The Board adopts a cautious appetite for ESG and climate risk, prioritising resource stewardship, accurate disclosure and proactive management of physical and transition exposures.",
      bands: [{ bandType: "MAX_RESIDUAL_SCORE", thresholdValue: 16 }, { bandType: "MAX_RED_KRI_COUNT", thresholdValue: 3 }],
    },
    {
      catCode: "SCM", level: "CAUTIOUS",
      statementText: "The Board has a cautious appetite for supply-chain risk and expects single-source dependencies for critical inputs to be actively dual-qualified and buffered.",
      // MAX_RED_KRI_COUNT 0 → KRI-0015 (SCM, RED) breaches (observed 1 > 0).
      bands: [{ bandType: "MAX_RESIDUAL_SCORE", thresholdValue: 20 }, { bandType: "MAX_RED_KRI_COUNT", thresholdValue: 0 }],
    },
    {
      catCode: "REP", level: "MINIMAL",
      statementText: "The Board has minimal appetite for reputational risk and expects proactive stakeholder, customer and community engagement to protect brand and trust.",
      bands: [{ bandType: "MAX_RESIDUAL_SCORE", thresholdValue: 16 }, { bandType: "MAX_HIGH_PLUS_COUNT", thresholdValue: 5 }],
    },
    {
      catCode: "PPL", level: "CAUTIOUS",
      statementText: "The Board has a cautious appetite for people and talent risk and expects retention, skilling and succession plans to protect critical capability.",
      bands: [{ bandType: "MAX_RESIDUAL_SCORE", thresholdValue: 16 }, { bandType: "MAX_RED_KRI_COUNT", thresholdValue: 3 }],
    },
    {
      catCode: "GEO", level: "OPEN",
      statementText: "The Board accepts an open appetite for geopolitical and external risk that is inherent to the business, while monitoring trade, tariff and regulatory developments for material shifts.",
      bands: [{ bandType: "MAX_RESIDUAL_SCORE", thresholdValue: 20 }, { bandType: "MAX_CRITICAL_COUNT", thresholdValue: 3 }],
    },
  ];

  // Compute the live FIN HIGH+ residual count, then force the FIN threshold below it.
  const finRisks = riskRows.filter((r) => r.categoryId === catId("FIN"));
  const finHighPlus = finRisks.filter((r) => r.residualBand === "HIGH" || r.residualBand === "CRITICAL");
  const finHighPlusCount = finHighPlus.length;
  const finThreshold = Math.max(0, finHighPlusCount - 1);

  const appetiteIdByCat = new Map<string, string>();
  let appetiteCount = 0;
  for (const a of APPETITES) {
    let bands = a.bands;
    if (a.catCode === "FIN") {
      // Replace the MAX_HIGH_PLUS_COUNT band with the runtime-forced threshold.
      bands = a.bands.map((b) => (b.bandType === "MAX_HIGH_PLUS_COUNT" ? { ...b, thresholdValue: finThreshold } : b));
    }
    const stmt = await prisma.appetiteStatement.create({
      data: {
        categoryId: catId(a.catCode),
        statementText: a.statementText,
        appetiteLevel: a.level,
        version: 1,
        status: "ACTIVE",
        approvedBy: anandId,
        approvalReference: APPROVAL_REF,
        approvedAt,
        effectiveFrom: approvedAt,
        toleranceBands: bands as any,
        createdBy: anandId,
      },
    });
    appetiteIdByCat.set(a.catCode, stmt.id);
    appetiteCount++;
  }
  console.log(`  appetite statements: ${appetiteCount} (FIN HIGH+ live count=${finHighPlusCount}, threshold=${finThreshold})`);

  // ── 2 explicit appetite breaches ────────────────────────────────────────
  let appetiteBreachCount = 0;
  // 1) SCM — KRI-0015 RED → MAX_RED_KRI_COUNT observed 1 > 0
  await prisma.appetiteBreach.create({
    data: {
      appetiteStatementId: appetiteIdByCat.get("SCM")!,
      categoryId: catId("SCM"),
      bandType: "MAX_RED_KRI_COUNT",
      observedValue: 1,
      thresholdValue: 0,
      triggeringEntityIds: [kriIdByCode.get("KRI-0015")!] as any,
      detectedAt: daysAgo(6),
      status: "UNDER_REVIEW",
      createdBy: anandId,
    },
  }); appetiteBreachCount++;
  // 2) FIN — MAX_HIGH_PLUS_COUNT observed = live count > threshold (count-1)
  await prisma.appetiteBreach.create({
    data: {
      appetiteStatementId: appetiteIdByCat.get("FIN")!,
      categoryId: catId("FIN"),
      bandType: "MAX_HIGH_PLUS_COUNT",
      observedValue: finHighPlusCount,
      thresholdValue: finThreshold,
      triggeringEntityIds: (finHighPlus.length ? finHighPlus.map((r) => r.id) : ridsOf(["0006", "0024", "0005"])) as any,
      detectedAt: daysAgo(6),
      status: "TEMPORARILY_ACCEPTED",
      committeeDecision: "Accepted pending tariff resolution; treatment plans in flight (see ERM-2026-0024).",
      reviewByDate: new Date("2026-07-31T00:00:00.000Z"),
      decisionBy: anandId,
      createdBy: anandId,
    },
  }); appetiteBreachCount++;
  console.log(`  appetite breaches: ${appetiteBreachCount} (SCM RED-KRI, FIN HIGH+)`);

  // ════════════════════════════════════════════════════════════════════════
  // 4. Legal obligations (OBL-0001 ..) + compliance tasks
  // ════════════════════════════════════════════════════════════════════════
  type Obl = {
    code: string; title: string; type: string; statute: string; regulator: string;
    site: "NW" | "SW" | null; ownerId: string; frequency: string; status: string;
    validFromDays?: number; validUntilDays?: number; // relative to NOW (negative = past)
    linked?: string[]; conditions?: string[];
  };

  // 28 obligations: SW (10), NW (10), corporate (8).
  const OBLS: Obl[] = [
    // ── South Kraft & Board Mill (10) ──
    { code: "OBL-0001", title: "Consent to Operate (Water) — South Kraft & Board Mill", type: "CONSENT", statute: "Water (Prevention & Control of Pollution) Act, 1974, s.25/26", regulator: "State Pollution Control Board", site: "SW", ownerId: lakshmiId, frequency: "PERIODIC_RENEWAL", status: "UNDER_RENEWAL", validFromDays: -700, validUntilDays: 40, linked: ["0015"], conditions: ["Effluent within consented norms", "ETP operational log maintained"] },
    { code: "OBL-0002", title: "Consent to Operate (Air) — South Kraft & Board Mill", type: "CONSENT", statute: "Air (Prevention & Control of Pollution) Act, 1981, s.21", regulator: "State Pollution Control Board", site: "SW", ownerId: lakshmiId, frequency: "PERIODIC_RENEWAL", status: "UNDER_RENEWAL", validFromDays: -700, validUntilDays: 40, conditions: ["Stack emission within norms", "CEMS calibration current"] },
    { code: "OBL-0003", title: "Hazardous Waste Authorisation — South Kraft & Board Mill", type: "LICENCE", statute: "Hazardous & Other Wastes (M&TM) Rules, 2016", regulator: "State Pollution Control Board", site: "SW", ownerId: lakshmiId, frequency: "PERIODIC_RENEWAL", status: "COMPLIANT", validFromDays: -300, validUntilDays: 400, conditions: ["Manifest system maintained", "TSDF tie-up valid"] },
    { code: "OBL-0004", title: "Factory Licence — South Kraft & Board Mill", type: "LICENCE", statute: "Factories Act, 1948, s.6", regulator: "Directorate of Factories & Boilers", site: "SW", ownerId: lakshmiId, frequency: "PERIODIC_RENEWAL", status: "COMPLIANT", validFromDays: -200, validUntilDays: 500, conditions: ["Approved max headcount", "Plan amendments filed"] },
    { code: "OBL-0005", title: "Fire NOC — South Kraft & Board Mill", type: "LICENCE", statute: "State Fire Service Act / NBC 2016 Part 4", regulator: "State Fire & Emergency Services", site: "SW", ownerId: lakshmiId, frequency: "PERIODIC_RENEWAL", status: "OVERDUE", validFromDays: -740, validUntilDays: -12, conditions: ["Hydrant system pressure-tested", "Fire drills recorded"] },
    { code: "OBL-0006", title: "Boiler Certificate — South Kraft & Board Mill", type: "LICENCE", statute: "Boilers Act, 1923, s.7", regulator: "Directorate of Boilers", site: "SW", ownerId: lakshmiId, frequency: "PERIODIC_RENEWAL", status: "COMPLIANT", validFromDays: -120, validUntilDays: 240, conditions: ["IBR fittings certified", "Hydraulic test passed"] },
    { code: "OBL-0007", title: "Contract Labour Licence — South Kraft & Board Mill", type: "LICENCE", statute: "Contract Labour (R&A) Act, 1970, s.12", regulator: "Office of Labour Commissioner", site: "SW", ownerId: lakshmiId, frequency: "PERIODIC_RENEWAL", status: "DUE_SOON", validFromDays: -330, validUntilDays: 55, conditions: ["Form-XIII register current", "Welfare amenities provided"] },
    { code: "OBL-0008", title: "ESI Returns — South Kraft & Board Mill", type: "RETURN_FILING", statute: "Employees' State Insurance Act, 1948", regulator: "Employees' State Insurance Corporation", site: "SW", ownerId: lakshmiId, frequency: "MONTHLY", status: "COMPLIANT" },
    { code: "OBL-0009", title: "PF Returns — South Kraft & Board Mill", type: "RETURN_FILING", statute: "EPF & MP Act, 1952", regulator: "Employees' Provident Fund Organisation", site: "SW", ownerId: lakshmiId, frequency: "MONTHLY", status: "COMPLIANT" },
    { code: "OBL-0010", title: "Electrical Inspection — South Kraft & Board Mill", type: "STATUTORY_DUTY", statute: "Central Electricity Authority (M&S) Regulations, 2010", regulator: "Office of the Electrical Inspector", site: "SW", ownerId: lakshmiId, frequency: "ANNUAL", status: "DUE_SOON", validFromDays: -340, validUntilDays: 25 },
    // ── North Paper Mill (10) ──
    { code: "OBL-0011", title: "Consent to Operate (Water) — North Paper Mill", type: "CONSENT", statute: "Water (Prevention & Control of Pollution) Act, 1974, s.25/26", regulator: "State Pollution Control Board", site: "NW", ownerId: devendraId, frequency: "PERIODIC_RENEWAL", status: "COMPLIANT", validFromDays: -300, validUntilDays: 420, conditions: ["Effluent within consented norms"] },
    { code: "OBL-0012", title: "Consent to Operate (Air) — North Paper Mill", type: "CONSENT", statute: "Air (Prevention & Control of Pollution) Act, 1981, s.21", regulator: "State Pollution Control Board", site: "NW", ownerId: devendraId, frequency: "PERIODIC_RENEWAL", status: "COMPLIANT", validFromDays: -300, validUntilDays: 420, conditions: ["Stack emission within norms"] },
    { code: "OBL-0013", title: "Hazardous Waste Authorisation — North Paper Mill", type: "LICENCE", statute: "Hazardous & Other Wastes (M&TM) Rules, 2016", regulator: "State Pollution Control Board", site: "NW", ownerId: devendraId, frequency: "PERIODIC_RENEWAL", status: "COMPLIANT", validFromDays: -250, validUntilDays: 450, conditions: ["Manifest system maintained"] },
    { code: "OBL-0014", title: "Factory Licence — North Paper Mill", type: "LICENCE", statute: "Factories Act, 1948, s.6", regulator: "Directorate of Factories & Boilers", site: "NW", ownerId: devendraId, frequency: "PERIODIC_RENEWAL", status: "DUE_SOON", validFromDays: -320, validUntilDays: 45, conditions: ["Approved max headcount"] },
    { code: "OBL-0015", title: "Fire NOC — North Paper Mill", type: "LICENCE", statute: "State Fire Service Act / NBC 2016 Part 4", regulator: "State Fire & Emergency Services", site: "NW", ownerId: devendraId, frequency: "PERIODIC_RENEWAL", status: "COMPLIANT", validFromDays: -200, validUntilDays: 500, conditions: ["Fire drills recorded"] },
    { code: "OBL-0016", title: "Boiler Certificate — North Paper Mill", type: "LICENCE", statute: "Boilers Act, 1923, s.7", regulator: "Directorate of Boilers", site: "NW", ownerId: devendraId, frequency: "PERIODIC_RENEWAL", status: "COMPLIANT", validFromDays: -150, validUntilDays: 210 },
    { code: "OBL-0017", title: "Contract Labour Licence — North Paper Mill", type: "LICENCE", statute: "Contract Labour (R&A) Act, 1970, s.12", regulator: "Office of Labour Commissioner", site: "NW", ownerId: devendraId, frequency: "PERIODIC_RENEWAL", status: "COMPLIANT", validFromDays: -260, validUntilDays: 360, conditions: ["Form-XIII register current"] },
    { code: "OBL-0018", title: "ESI Returns — North Paper Mill", type: "RETURN_FILING", statute: "Employees' State Insurance Act, 1948", regulator: "Employees' State Insurance Corporation", site: "NW", ownerId: devendraId, frequency: "MONTHLY", status: "COMPLIANT" },
    { code: "OBL-0019", title: "PF Returns — North Paper Mill", type: "RETURN_FILING", statute: "EPF & MP Act, 1952", regulator: "Employees' Provident Fund Organisation", site: "NW", ownerId: devendraId, frequency: "MONTHLY", status: "COMPLIANT" },
    { code: "OBL-0020", title: "Electrical Inspection — North Paper Mill", type: "STATUTORY_DUTY", statute: "Central Electricity Authority (M&S) Regulations, 2010", regulator: "Office of the Electrical Inspector", site: "NW", ownerId: devendraId, frequency: "ANNUAL", status: "COMPLIANT", validFromDays: -200, validUntilDays: 160 },
    // ── Corporate (8) ──
    { code: "OBL-0021", title: "BRSR Filing — Corporate", type: "RETURN_FILING", statute: "SEBI (LODR) Regulations, 2015 — Reg. 34(2)(f)", regulator: "Securities and Exchange Board of India", site: null, ownerId: nandiniId, frequency: "ANNUAL", status: "DUE_SOON", linked: ["0020"] },
    { code: "OBL-0022", title: "Legal Metrology Registration — Corporate", type: "REGISTRATION", statute: "Legal Metrology Act, 2009", regulator: "Department of Legal Metrology", site: null, ownerId: nandiniId, frequency: "PERIODIC_RENEWAL", status: "COMPLIANT", validFromDays: -280, validUntilDays: 300 },
    { code: "OBL-0023", title: "Trade Licence — Corporate", type: "LICENCE", statute: "Municipal Corporation Act (Trade Licence)", regulator: "Municipal Corporation", site: null, ownerId: nandiniId, frequency: "PERIODIC_RENEWAL", status: "COMPLIANT", validFromDays: -200, validUntilDays: 240 },
    { code: "OBL-0024", title: "GST Filing — Corporate", type: "RETURN_FILING", statute: "Central Goods & Services Tax Act, 2017", regulator: "GST Network / CBIC", site: null, ownerId: nandiniId, frequency: "QUARTERLY", status: "COMPLIANT" },
    { code: "OBL-0025", title: "TDS Filing — Corporate", type: "RETURN_FILING", statute: "Income-tax Act, 1961 — Chapter XVII-B", regulator: "Income Tax Department", site: null, ownerId: nandiniId, frequency: "QUARTERLY", status: "COMPLIANT" },
    { code: "OBL-0026", title: "CSR Spend Attestation — Corporate", type: "STATUTORY_DUTY", statute: "Companies Act, 2013 — s.135", regulator: "Ministry of Corporate Affairs", site: null, ownerId: nandiniId, frequency: "ANNUAL", status: "DUE_SOON" },
    { code: "OBL-0027", title: "Annual Return (MGT-7) — Corporate", type: "RETURN_FILING", statute: "Companies Act, 2013 — s.92", regulator: "Ministry of Corporate Affairs / RoC", site: null, ownerId: nandiniId, frequency: "ANNUAL", status: "COMPLIANT" },
    { code: "OBL-0028", title: "Professional Tax Filing — Corporate", type: "RETURN_FILING", statute: "State Professional Tax Act", regulator: "Commercial Tax Department", site: null, ownerId: nandiniId, frequency: "MONTHLY", status: "COMPLIANT" },
  ];

  // ── Create obligations + tasks ──────────────────────────────────────────
  let oblCount = 0;
  let taskCount = 0;
  let attachmentCount = 0;
  let complianceCapaCount = 0;
  let verifiedTaskCount = 0;
  let pendingTaskCount = 0;
  let waivedTaskCount = 0;

  const siteIdOf = (s: "NW" | "SW" | null): string | null => (s === "NW" ? nw.id : s === "SW" ? sw.id : null);
  const taskTypeFor = (type: string): "RENEWAL" | "FILING" | "ATTESTATION" => {
    if (type === "LICENCE" || type === "CONSENT" || type === "REGISTRATION") return "RENEWAL";
    if (type === "RETURN_FILING") return "FILING";
    return "ATTESTATION";
  };

  for (const o of OBLS) {
    const obl = await prisma.legalObligation.create({
      data: {
        obligationCode: o.code,
        title: o.title,
        obligationType: o.type,
        statuteReference: o.statute,
        regulatorName: o.regulator,
        siteId: siteIdOf(o.site),
        ownerId: o.ownerId,
        frequency: o.frequency,
        validFrom: o.validFromDays != null ? daysAgo(-o.validFromDays) : null,
        validUntil: o.validUntilDays != null ? daysAgo(-o.validUntilDays) : null,
        renewalLeadDays: 60,
        conditions: (o.conditions ?? []) as any,
        linkedRiskIds: ridsOf(o.linked ?? []) as any,
        status: o.status,
        isActive: true,
        createdBy: nandiniId,
      },
    });
    oblCount++;

    const taskType = taskTypeFor(o.type);

    // ── Special case: SW Fire NOC (OBL-0005) — one OVERDUE task + CAPA ──
    if (o.code === "OBL-0005") {
      const overdueTask = await prisma.complianceTask.create({
        data: {
          obligationId: obl.id,
          taskType,
          periodLabel: "Renewal-2026",
          dueDate: daysAgo(12),
          status: "OVERDUE",
          remarks: "Fire NOC renewal lapsed; hydrant pressure test pending. Escalated to CAPA.",
          createdBy: nandiniId,
        },
      });
      taskCount++;
      // Raise a Compliance CAPA on the overdue task.
      const capa = await prisma.capa.create({
        data: {
          capaNumber: "CAPA-CMP-2026-SW-001",
          title: "Renew lapsed Fire NOC — South Kraft & Board Mill",
          plantId: sw.id,
          sourceCategoryId: cmpCat.id,
          sourceTypeId: cmpType.id,
          sourceTypeCode: "COMPLIANCE",
          sourceReferenceId: overdueTask.id,
          sourceReferenceUrl: `/erm/compliance/${obl.id}`,
          sourceReferenceSummary: `${o.code} — ${o.title}`,
          sourceMetadata: { obligationCode: o.code, taskId: overdueTask.id, regulator: o.regulator } as any,
          problemDescription: "The Fire NOC for South Kraft & Board Mill has lapsed (validity expired ~12 days ago). Operating without a valid Fire NOC exposes the site to a closure direction and prosecution risk. Hydrant pressure test and fire-drill records must be completed and the renewal application filed on priority.",
          detectionMethod: "COMPLIANCE_OVERDUE",
          detectedAt: daysAgo(12),
          detectedByUserId: lakshmiId,
          primaryCategory: "Compliance",
          severity: "HIGH",
          priority: "HIGH",
          state: "ACTIONS_PLANNED",
          stateChangedAt: daysAgo(10),
          closureTargetDate: daysFromNow(30),
          raisedByUserId: nandiniId,
          primaryOwnerUserId: lakshmiId,
          createdByUserId: nandiniId,
        },
      });
      complianceCapaCount++;
      await prisma.complianceTask.update({ where: { id: overdueTask.id }, data: { capaId: capa.id } });
      continue;
    }

    // ── General case: 1–3 tasks per obligation.
    // History task(s): VERIFIED for ~70% (here: most renewals/filings get a verified prior period),
    // then a current/forward task whose status mirrors the obligation status where sensible.
    type TaskPlan = {
      periodLabel: string; dueDate: Date; status: "PENDING" | "SUBMITTED" | "VERIFIED" | "WAIVED";
      attestedAt?: Date; verifiedAt?: Date; waiver?: string; withAttachment?: boolean; remarks?: string;
    };
    const plans: TaskPlan[] = [];

    if (o.frequency === "MONTHLY") {
      // Two recent verified monthly filings + one pending current.
      plans.push({ periodLabel: "2026-04", dueDate: daysAgo(60), status: "VERIFIED", attestedAt: daysAgo(62), verifiedAt: daysAgo(58) });
      plans.push({ periodLabel: "2026-05", dueDate: daysAgo(30), status: "VERIFIED", attestedAt: daysAgo(32), verifiedAt: daysAgo(28) });
      plans.push({ periodLabel: "2026-06", dueDate: daysFromNow(8), status: "PENDING" });
    } else if (o.frequency === "QUARTERLY") {
      plans.push({ periodLabel: "FY26-Q4", dueDate: daysAgo(45), status: "VERIFIED", attestedAt: daysAgo(48), verifiedAt: daysAgo(42), withAttachment: true });
      plans.push({ periodLabel: "FY27-Q1", dueDate: daysFromNow(20), status: "PENDING" });
    } else {
      // ANNUAL / PERIODIC_RENEWAL / one-offs — a prior verified period + a forward renewal/filing.
      const dueForward = o.validUntilDays != null ? daysAgo(-(o.validUntilDays)) : daysFromNow(45);
      // prior period verified
      plans.push({ periodLabel: o.frequency === "ANNUAL" ? "FY26" : "Renewal-2025", dueDate: daysAgo(120), status: "VERIFIED", attestedAt: daysAgo(123), verifiedAt: daysAgo(118), withAttachment: taskType === "RENEWAL" });
      // forward period
      const forwardLabel = o.frequency === "ANNUAL" ? "FY27" : "Renewal-2026";
      if (o.status === "UNDER_RENEWAL") {
        plans.push({ periodLabel: forwardLabel, dueDate: dueForward, status: "SUBMITTED", attestedAt: daysAgo(15), remarks: "Renewal application submitted; awaiting regulator." });
      } else {
        plans.push({ periodLabel: forwardLabel, dueDate: dueForward, status: "PENDING" });
      }
    }

    for (const p of plans) {
      const attestedBy = p.status !== "PENDING" ? o.ownerId : null;
      const verifiedBy = p.status === "VERIFIED" || p.status === "WAIVED" ? nandiniId : null;
      const task = await prisma.complianceTask.create({
        data: {
          obligationId: obl.id,
          taskType,
          periodLabel: p.periodLabel,
          dueDate: p.dueDate,
          status: p.status,
          attestedBy,
          attestedAt: p.attestedAt ?? (p.status !== "PENDING" ? p.dueDate : null),
          verifiedBy,
          verifiedAt: p.verifiedAt ?? null,
          waiverJustification: p.waiver ?? null,
          remarks: p.remarks ?? null,
          createdBy: nandiniId,
        },
      });
      taskCount++;
      if (p.status === "VERIFIED") verifiedTaskCount++;
      if (p.status === "PENDING") pendingTaskCount++;
      if (p.status === "WAIVED") waivedTaskCount++;

      // Attach a stub on a couple of VERIFIED renewal tasks.
      if (p.withAttachment && p.status === "VERIFIED" && taskType === "RENEWAL" && attachmentCount < 3) {
        await prisma.complianceAttachment.create({
          data: {
            taskId: task.id,
            fileName: `${o.code}-${p.periodLabel}-certificate.pdf`,
            storagePath: `compliance/${task.id}/stub.pdf`,
            fileSize: 184320,
            mimeType: "application/pdf",
            caption: `${o.title} — evidence of ${p.periodLabel} renewal`,
            uploadedById: nandiniId,
          },
        });
        attachmentCount++;
      }
    }
  }

  // ── Ensure the spec's task-mix targets are met: add a WAIVED task and a
  //    couple more PENDING (within 30 days) on suitable obligations. ─────────
  // WAIVED: Professional Tax for a period where the entity had no liability.
  {
    const ptaxObl = await prisma.legalObligation.findUnique({ where: { obligationCode: "OBL-0028" } });
    if (ptaxObl) {
      try {
        await prisma.complianceTask.create({
          data: {
            obligationId: ptaxObl.id, taskType: "FILING", periodLabel: "2026-03",
            dueDate: daysAgo(75), status: "WAIVED",
            waiverJustification: "No professional-tax liability for the period (NIL payroll in the applicable state); NIL return waived with finance sign-off.",
            verifiedBy: nandiniId, verifiedAt: daysAgo(70),
            attestedBy: nandiniId, attestedAt: daysAgo(73),
            createdBy: nandiniId,
          },
        });
        taskCount++; waivedTaskCount++;
      } catch { /* unique dup — skip */ }
    }
    // Two extra PENDING tasks within next 30 days on corporate attestations.
    for (const [code, label, days] of [["OBL-0026", "FY27-attestation", 18], ["OBL-0021", "FY27-prep", 27]] as [string, string, number][]) {
      const ob = await prisma.legalObligation.findUnique({ where: { obligationCode: code } });
      if (!ob) continue;
      try {
        await prisma.complianceTask.create({
          data: { obligationId: ob.id, taskType: "ATTESTATION", periodLabel: label, dueDate: daysFromNow(days), status: "PENDING", createdBy: nandiniId },
        });
        taskCount++; pendingTaskCount++;
      } catch { /* unique dup — skip */ }
    }
  }

  console.log(`  legal obligations: ${oblCount} | tasks: ${taskCount} (verified=${verifiedTaskCount}, pending=${pendingTaskCount}, waived=${waivedTaskCount}) | attachments: ${attachmentCount} | compliance CAPAs: ${complianceCapaCount}`);

  // ════════════════════════════════════════════════════════════════════════
  // 5. Loss events (LE-2026-0001 ..)
  // ════════════════════════════════════════════════════════════════════════
  // Find a few existing incident ids for the INCIDENT_AUTO drill-downs (optional).
  let incidentIds: string[] = [];
  try {
    const incs = await prisma.incident.findMany({ select: { id: true }, take: 6, orderBy: { createdAt: "desc" } });
    incidentIds = incs.map((i) => i.id);
  } catch { /* model name / availability — leave null */ }
  const incAt = (i: number): string | null => incidentIds[i] ?? null;

  const L = 100000; // ₹1 Lakh in INR
  type LossSpec = {
    code: string; title: string; description: string; daysAgo: number;
    site: "NW" | "SW" | null; catCode: string; linked?: string[];
    source: "INCIDENT_AUTO" | "MANUAL"; sourceIncidentIdx?: number;
    isNearMiss?: boolean; gross: number; recovered?: number; potential?: number;
    lossTypes: string[]; status: "DRAFT" | "QUANTIFIED" | "CLOSED";
  };

  const LOSSES: LossSpec[] = [
    // ── INCIDENT_AUTO (6, OPS) ──
    { code: "LE-2026-0001", title: "Conveyor entanglement — lost-time injury", description: "Operator's glove caught in a conveyor nip point on Line 2; lost-time injury with medical compensation paid.", daysAgo: 95, site: "NW", catCode: "OPS", source: "INCIDENT_AUTO", sourceIncidentIdx: 0, gross: 14 * L, lossTypes: ["MEDICAL_COMPENSATION"], status: "QUANTIFIED" },
    { code: "LE-2026-0002", title: "Forklift impact — racking & product damage", description: "Forklift struck pallet racking in the SW warehouse, damaging racking and finished goods.", daysAgo: 110, site: "SW", catCode: "OPS", source: "INCIDENT_AUTO", sourceIncidentIdx: 1, gross: 8 * L, lossTypes: ["PROPERTY_DAMAGE"], status: "QUANTIFIED" },
    { code: "LE-2026-0003", title: "Line stoppage — utility trip (Line 1)", description: "Unplanned utility trip stopped Line 1 for several hours; business-interruption loss from lost output.", daysAgo: 70, site: "NW", catCode: "OPS", linked: ["0011"], source: "INCIDENT_AUTO", sourceIncidentIdx: 2, gross: 22 * L, lossTypes: ["BUSINESS_INTERRUPTION"], status: "QUANTIFIED" },
    { code: "LE-2026-0004", title: "Line stoppage — feed jam (Line 3)", description: "Material feed jam halted Line 3; extended stoppage drove a larger business-interruption loss.", daysAgo: 52, site: "NW", catCode: "OPS", linked: ["0011"], source: "INCIDENT_AUTO", sourceIncidentIdx: 3, gross: 35 * L, lossTypes: ["BUSINESS_INTERRUPTION"], status: "QUANTIFIED" },
    { code: "LE-2026-0005", title: "Near-miss — overhead crane load slip", description: "An overhead crane load slipped during a lift over an occupied bay; arrested by the secondary sling. Credible worst case ≈ ₹2.4 Cr (fatality + asset loss).", daysAgo: 40, site: "NW", catCode: "OPS", linked: ["0011"], source: "INCIDENT_AUTO", sourceIncidentIdx: 4, isNearMiss: true, gross: 0, potential: 24000000, lossTypes: ["NEAR_MISS"], status: "QUANTIFIED" },
    { code: "LE-2026-0006", title: "Spill clean-up — minor chemical release", description: "Minor chemical release during transfer; clean-up and disposal costs incurred. Pending full quantification.", daysAgo: 15, site: "SW", catCode: "OPS", source: "INCIDENT_AUTO", sourceIncidentIdx: 5, gross: 0, lossTypes: ["CLEAN_UP"], status: "DRAFT" },
    // ── MANUAL (10) ──
    { code: "LE-2026-0007", title: "SPCB penalty — effluent norm exceedance", description: "State Pollution Control Board levied a penalty following a transient effluent-norm exceedance at the SW ETP.", daysAgo: 80, site: "SW", catCode: "ESG", linked: ["0015"], source: "MANUAL", gross: 6 * L, lossTypes: ["FINE_PENALTY"], status: "QUANTIFIED" },
    { code: "LE-2026-0008", title: "Customer quality claim — reel rejection", description: "Key packaging customer raised a quality claim for a reel rejection / sort cost on a grammage and surface defect.", daysAgo: 65, site: "NW", catCode: "OPS", linked: ["0012"], source: "MANUAL", gross: 48 * L, lossTypes: ["PRODUCT_QUALITY"], status: "QUANTIFIED" },
    { code: "LE-2026-0009", title: "Customer quality claim — press-stop charge", description: "Second customer quality claim — press-stop and containment charge for a related defect family. Linked to the same paper-quality exposure.", daysAgo: 38, site: "NW", catCode: "OPS", linked: ["0012"], source: "MANUAL", gross: 70 * L, lossTypes: ["PRODUCT_QUALITY"], status: "QUANTIFIED" },
    { code: "LE-2026-0010", title: "Forex loss — unhedged USD payables", description: "Mark-to-market forex loss on unhedged USD import payables during a sharp INR depreciation window.", daysAgo: 58, site: null, catCode: "FIN", linked: ["0004"], source: "MANUAL", gross: 31 * L, lossTypes: ["OTHER"], status: "QUANTIFIED" },
    { code: "LE-2026-0011", title: "Chemical air-freight premium — expedite", description: "Air-freight premium incurred to expedite chlorine dioxide (bleaching chemical) after a single-source vendor disruption.", daysAgo: 47, site: null, catCode: "SCM", linked: ["0022"], source: "MANUAL", gross: 19 * L, lossTypes: ["BUSINESS_INTERRUPTION"], status: "QUANTIFIED" },
    { code: "LE-2026-0012", title: "Near-miss — phishing-led ransomware intrusion", description: "A phishing email led to credential compromise; intrusion was contained at the segmentation boundary before encryption. Credible worst case ≈ ₹5 Cr (multi-day plant shutdown + recovery).", daysAgo: 33, site: null, catCode: "TEC", linked: ["0018"], source: "MANUAL", isNearMiss: true, gross: 0, potential: 50000000, lossTypes: ["NEAR_MISS"], status: "QUANTIFIED" },
    { code: "LE-2026-0013", title: "Line 3 gearbox failure — business interruption", description: "Critical gearbox failure on North Paper Mill Line 3 caused an extended outage; lost output plus expedited repair.", daysAgo: 50, site: "NW", catCode: "OPS", linked: ["0011"], source: "MANUAL", gross: 62 * L, lossTypes: ["BUSINESS_INTERRUPTION"], status: "QUANTIFIED" },
    { code: "LE-2026-0014", title: "Warehouse roof damage — storm (insured)", description: "Storm damaged a section of SW warehouse roof; property loss partly recovered under the property policy.", daysAgo: 100, site: "SW", catCode: "OPS", source: "MANUAL", gross: 20 * L, recovered: 12 * L, lossTypes: ["PROPERTY_DAMAGE"], status: "CLOSED" },
    { code: "LE-2026-0015", title: "Transit damage claim — recovered from carrier", description: "Finished-goods transit damage; loss recovered from the carrier under the logistics contract.", daysAgo: 90, site: null, catCode: "SCM", source: "MANUAL", gross: 9 * L, recovered: 7 * L, lossTypes: ["PROPERTY_DAMAGE"], status: "CLOSED" },
    { code: "LE-2026-0016", title: "Labour compliance penalty — register gap", description: "Minor penalty for a contractor statutory-register gap identified during a labour inspection.", daysAgo: 72, site: "NW", catCode: "CMP", linked: ["0013"], source: "MANUAL", gross: 3 * L, lossTypes: ["FINE_PENALTY"], status: "CLOSED" },
  ];

  let lossCount = 0;
  for (const le of LOSSES) {
    const gross = le.gross;
    const recovered = le.recovered ?? 0;
    const net = gross - recovered;
    await prisma.lossEvent.create({
      data: {
        eventCode: le.code,
        title: le.title,
        description: le.description,
        eventDate: daysAgo(le.daysAgo),
        siteId: siteIdOf(le.site),
        categoryId: catId(le.catCode),
        linkedRiskIds: ridsOf(le.linked ?? []) as any,
        source: le.source,
        sourceIncidentId: le.source === "INCIDENT_AUTO" ? incAt(le.sourceIncidentIdx ?? 0) : null,
        isNearMiss: le.isNearMiss ?? false,
        grossLossInr: gross,
        recoveredInr: recovered,
        netLossInr: net,
        potentialLossInr: le.potential ?? null,
        lossTypes: le.lossTypes as any,
        status: le.status,
        closureNotes: le.status === "CLOSED" ? "Loss quantified, recoveries booked and file closed." : null,
        createdBy: nandiniId,
      },
    });
    lossCount++;
  }
  console.log(`  loss events: ${lossCount}`);

  // ── Calibration note: ERM-2026-0012 linked net loss ─────────────────────
  // 0012 receives LE-0008 (₹48L) + LE-0009 (₹70L) = ₹1.18 Cr (> ₹1 Cr) → UNDERSCORED flag.
  const linked0012 = LOSSES.filter((l) => (l.linked ?? []).includes("0012") && !l.isNearMiss && l.status !== "DRAFT");
  const net0012 = linked0012.reduce((s, l) => s + (l.gross - (l.recovered ?? 0)), 0);
  console.log(`  calibration: ERM-2026-0012 linked net loss = ₹${(net0012 / L).toFixed(0)}L (${net0012 >= 10000000 ? "≥ ₹1 Cr → UNDERSCORED" : "< ₹1 Cr"})`);

  // ════════════════════════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════════════════════════
  const counts = {
    nandini: await prisma.user.count({ where: { email: NANDINI_EMAIL } }),
    kriDefinitions: await prisma.kriDefinition.count(),
    kriReadings: await prisma.kriReading.count(),
    kriBreaches: await prisma.kriBreachEvent.count(),
    appetiteStatements: await prisma.appetiteStatement.count(),
    appetiteBreaches: await prisma.appetiteBreach.count(),
    legalObligations: await prisma.legalObligation.count(),
    complianceTasks: await prisma.complianceTask.count(),
    complianceAttachments: await prisma.complianceAttachment.count(),
    complianceCapas: await prisma.capa.count({ where: { sourceTypeCode: "COMPLIANCE" } }),
    lossEvents: await prisma.lossEvent.count(),
  };
  console.log("\n  ── ERM Phase 2 seed summary ─────────────────");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`     ${k.padEnd(22)} : ${v}`);
  }
  console.log("✅  ERM Phase 2 seed complete.");
}

main()
  .catch((e) => { console.error("❌ seed-erm-p2 failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
