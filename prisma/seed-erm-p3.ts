// ────────────────────────────────────────────────────────────────────────
// Seed — Enterprise Risk Management (ERM) — Phase 3
//
// Business Continuity Management (ISO 22301) + Scenario / Horizon scanning,
// layered on top of the Phase 1 register and Phase 2 monitoring data for the
// Meridian Manufacturing demo tenant (plants NW / SW).
//
// Depends on (must already be seeded):
//   • Phase 1 — the 24 enterprise risks ERM-2026-0001 .. 0024 + RiskCategory
//   • Phase 1/2 persona users (anand.krishnan, kavita.rao, devendra.kulkarni,
//     lakshmi.venkatesh, meera.iyer, rajesh.nair, suresh.patel) + nandini (P2)
//   • seed-rbac.ts — role BCM_COORDINATOR (for Farhan's UserRole)
//
// Seeds:
//   • 1 BCM Coordinator persona (Farhan Qureshi) + UserRole
//   • CAPA source category + type "BC_EXERCISE" (3rd extension)
//   • 14 business processes (ALL critical) + dependencies (exactly 3 unmitigated SPOFs)
//   • 8 continuity plans (7 APPROVED + 1 IN_REVIEW) → 12-of-14 coverage, 2 named gaps
//   • 6 crisis-team roles + 2 published call trees
//   • 1 closed crisis CRX-2026-0001 with 23 append-only log entries
//   • 6 BC exercises (5 completed inc. 1 call-tree test + 1 MAJOR_GAP→CAPA, 1 planned)
//   • 6 scenarios (varied readiness) + 5 horizon-scanning items
//
// Engineered facts (asserted at the end):
//   • BCM dashboard coverage = 12 / 14 critical (85.7%), 2 gaps: BP-0007, BP-0014
//   • 3 unmitigated single points of failure
//   • 1 BC_EXERCISE CAPA (six-source CAPA regression)
//
// Idempotent: deletes prior Phase 3 demo rows (FK-safe order) + the Farhan
// persona + her UserRole before recreating. Safe to re-run.
//
// Run AFTER: seed-erm-p2.ts (Phase 2).
//   npx tsx prisma/seed-erm-p3.ts
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
function minsAfter(base: Date, mins: number): Date {
  return new Date(base.getTime() + mins * 60_000);
}

async function main() {
  console.log("Seeding Enterprise Risk Management (ERM) — Phase 3 (BCM + Scenario)…");

  // ── Resolve plants ────────────────────────────────────────────────────
  const nw = await prisma.plant.findFirst({ where: { code: "NW" } });
  const sw = await prisma.plant.findFirst({ where: { code: "SW" } });
  if (!nw) throw new Error("NW plant not found — run base seed (Step 9) first");
  if (!sw) throw new Error("SW plant not found — run base seed (Step 9) first");
  const siteIdOf = (s: "NW" | "SW" | null): string | null => (s === "NW" ? nw.id : s === "SW" ? sw.id : null);

  // ── Resolve Phase 1 enterprise risks (with residuals for stressing) ─────
  const riskRows = await prisma.enterpriseRisk.findMany({
    where: { riskCode: { startsWith: "ERM-2026-" } },
    select: { id: true, riskCode: true, residualLikelihood: true, residualImpact: true },
  });
  if (riskRows.length === 0) throw new Error("No ERM-2026-* risks found — run seed-erm.ts (Phase 1) first");
  const riskIdByShort = new Map<string, string>();
  const residById = new Map<string, { l: number; i: number }>();
  for (const r of riskRows) {
    const short = r.riskCode.replace("ERM-2026-", "");
    riskIdByShort.set(short, r.id);
    residById.set(r.id, { l: r.residualLikelihood ?? 3, i: r.residualImpact ?? 3 });
  }
  const ridsOf = (shorts: string[]): string[] => shorts.map((s) => riskIdByShort.get(s)).filter((x): x is string => !!x);
  // whatIfAdjustments that GUARANTEE a movement on the stressed heat map (bump +1, capped 5).
  const stressOf = (shorts: string[]) =>
    ridsOf(shorts).map((id) => {
      const base = residById.get(id) ?? { l: 3, i: 3 };
      return { riskId: id, stressedLikelihood: Math.min(5, base.l + 1), stressedImpact: Math.min(5, base.i + 1) };
    });

  // ── Resolve persona users ───────────────────────────────────────────────
  const personaEmails = [
    "anand.krishnan@safeops360.in",
    "rajesh.nair@safeops360.in",
    "kavita.rao@safeops360.in",
    "meera.iyer@safeops360.in",
    "suresh.patel@safeops360.in",
    "lakshmi.venkatesh@safeops360.in",
    "devendra.kulkarni@safeops360.in",
    "nandini.subramaniam@safeops360.in",
  ];
  const userRows = await prisma.user.findMany({ where: { email: { in: personaEmails } }, select: { id: true, email: true } });
  const userIdByEmail = new Map(userRows.map((u) => [u.email, u.id]));
  const uid = (email: string): string => {
    const id = userIdByEmail.get(email);
    if (!id) throw new Error(`persona user ${email} not found — run seed-erm.ts (Phase 1) / seed-erm-p2.ts first`);
    return id;
  };
  const anandId = uid("anand.krishnan@safeops360.in");
  const rajeshId = uid("rajesh.nair@safeops360.in");
  const kavitaId = uid("kavita.rao@safeops360.in");
  const meeraId = uid("meera.iyer@safeops360.in");
  const sureshId = uid("suresh.patel@safeops360.in");
  const lakshmiId = uid("lakshmi.venkatesh@safeops360.in");
  const devendraId = uid("devendra.kulkarni@safeops360.in");
  const nandiniId = uid("nandini.subramaniam@safeops360.in");

  const FARHAN_EMAIL = "farhan.qureshi@safeops360.in";

  // ── Idempotent wipe (FK-safe: children → parents → persona) ─────────────
  const safeDelete = async (label: string, fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e) { console.warn(`  (skip ${label}: ${(e as Error).message})`); }
  };
  await safeDelete("crisisLogEntry", () => prisma.crisisLogEntry.deleteMany({}));
  await safeDelete("exerciseFinding", () => prisma.exerciseFinding.deleteMany({}));
  await safeDelete("recoveryTask", () => prisma.recoveryTask.deleteMany({}));
  await safeDelete("processDependency", () => prisma.processDependency.deleteMany({}));
  await safeDelete("crisisEvent", () => prisma.crisisEvent.deleteMany({}));
  await safeDelete("bcExercise", () => prisma.bcExercise.deleteMany({}));
  await safeDelete("continuityPlan", () => prisma.continuityPlan.deleteMany({}));
  await safeDelete("businessProcess", () => prisma.businessProcess.deleteMany({}));
  await safeDelete("crisisTeamRole", () => prisma.crisisTeamRole.deleteMany({}));
  await safeDelete("callTree", () => prisma.callTree.deleteMany({}));
  await safeDelete("scenario", () => prisma.scenario.deleteMany({}));
  await safeDelete("horizonItem", () => prisma.horizonItem.deleteMany({}));
  await safeDelete("capa(BC_EXERCISE)", () => prisma.capa.deleteMany({ where: { sourceTypeCode: "BC_EXERCISE" } }));
  await safeDelete("userRole(farhan)", () => prisma.userRole.deleteMany({ where: { user: { email: FARHAN_EMAIL } } }));
  await safeDelete("user(farhan)", () => prisma.user.deleteMany({ where: { email: FARHAN_EMAIL } }));

  // ── Persona — Farhan Qureshi (BCM Coordinator) ──────────────────────────
  const pwHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const farhan = await prisma.user.upsert({
    where: { email: FARHAN_EMAIL },
    update: { name: "Farhan Qureshi", role: "BCM_COORDINATOR", plantId: nw.id, designation: "Business Continuity Coordinator (Corporate)", passwordHash: pwHash },
    create: { email: FARHAN_EMAIL, name: "Farhan Qureshi", role: "BCM_COORDINATOR", plantId: nw.id, designation: "Business Continuity Coordinator (Corporate)", passwordHash: pwHash },
  });
  const farhanId = farhan.id;
  const bcmRole = await prisma.role.findUnique({ where: { code: "BCM_COORDINATOR" } });
  if (bcmRole) {
    const existing = await prisma.userRole.findFirst({ where: { userId: farhanId, roleId: bcmRole.id } });
    if (!existing) {
      await prisma.userRole.create({ data: { userId: farhanId, roleId: bcmRole.id, scopeType: "ALL_PLANTS", scopeValue: null } });
    }
  } else {
    console.warn("  (Role BCM_COORDINATOR not found — skipping Farhan UserRole; run seed-rbac.ts)");
  }
  console.log("  persona: Farhan Qureshi (BCM Coordinator) + UserRole");

  // ── CAPA source category + type "BC_EXERCISE" (3rd source extension) ────
  const bcxCat = await prisma.capaSourceCategory.upsert({
    where: { code: "BC_EXERCISE" },
    update: { name: "BC Exercise", prefix: "BCX", sortOrder: 96, isActive: true },
    create: { code: "BC_EXERCISE", name: "BC Exercise", description: "CAPAs raised from major gaps found in business-continuity exercises / drills.", prefix: "BCX", sortOrder: 96, isActive: true },
  });
  const bcxType = await prisma.capaSourceType.upsert({
    where: { code: "BC_EXERCISE" },
    update: { name: "BC Exercise Finding", categoryId: bcxCat.id, parentModuleLive: true, parentModuleName: "Business Continuity", isActive: true, sortOrder: 1 },
    create: { code: "BC_EXERCISE", name: "BC Exercise Finding", categoryId: bcxCat.id, parentModuleLive: true, parentModuleName: "Business Continuity", isActive: true, sortOrder: 1 },
  });
  console.log(`  CAPA source: category "${bcxCat.code}" + type "${bcxType.code}"`);

  // ════════════════════════════════════════════════════════════════════════
  // 1. Business processes (BP-0001 .. BP-0014) — ALL critical (VITAL/ESSENTIAL)
  //    Coverage gaps engineered: BP-0007 + BP-0014 (no APPROVED plan).
  // ════════════════════════════════════════════════════════════════════════
  type Dep = { type: string; name: string; spof?: boolean; workaround?: string | null; workaroundHrs?: number | null; ref?: string };
  type ProcSpec = {
    code: string; name: string; site: "NW" | "SW" | null; ownerId: string; dept: string;
    rto: number; rpo: number | null; mtpd: number; crit: "VITAL" | "ESSENTIAL";
    desc: string; peak?: string; links?: string[]; reviewDays: number; deps: Dep[];
    impact?: { dimension: string; at4h: number; at24h: number; at7d: number; at30d: number }[];
  };

  // Dimensions use the canonical DIMS enum (FINANCIAL | REPUTATIONAL | REGULATORY |
  // SAFETY | BUSINESS_INTERRUPTION) so seeded rows round-trip through the edit forms
  // (ProcessUpsert / ScenarioUpsert validate dimension against this enum).
  const impactDefault = [
    { dimension: "FINANCIAL", at4h: 1, at24h: 2, at7d: 4, at30d: 5 },
    { dimension: "SAFETY", at4h: 1, at24h: 1, at7d: 2, at30d: 3 },
    { dimension: "REGULATORY", at4h: 1, at24h: 2, at7d: 3, at30d: 4 },
    { dimension: "REPUTATIONAL", at4h: 1, at24h: 2, at7d: 3, at30d: 4 },
  ];

  const PROCS: ProcSpec[] = [
    // ── North Works ──
    { code: "BP-0001", name: "Extrusion Line 3 — Production", site: "NW", ownerId: devendraId, dept: "Production", rto: 4, rpo: 2, mtpd: 24, crit: "VITAL", reviewDays: 200, links: ["0011"],
      desc: "Continuous extrusion production on the critical North Works Line 3 — the single largest revenue line, feeding key OEM contracts.",
      peak: "Q3 (festive build) and month-end dispatch peaks.",
      deps: [
        { type: "EQUIPMENT", name: "Extruder screw & barrel drive", spof: true, workaround: "Cold spare screw set on site; OEM barrel swap ~48h.", workaroundHrs: 48 },
        { type: "PEOPLE_SKILL", name: "Certified extrusion line operators (Grade-A)", workaround: "Cross-trained relief crew from Line 1/2." },
        { type: "UTILITY", name: "Process chilled water", workaround: "Standby chiller (auto-changeover)." },
      ] },
    { code: "BP-0002", name: "Injection Moulding — Lines 1 & 2", site: "NW", ownerId: devendraId, dept: "Production", rto: 12, rpo: 4, mtpd: 72, crit: "ESSENTIAL", reviewDays: 220, links: ["0011"],
      desc: "Injection-moulded component production across Lines 1 & 2 supplying sub-assemblies to extrusion and to direct dispatch.",
      deps: [
        { type: "EQUIPMENT", name: "Moulding tools / dies", workaround: "Duplicate tools for top-5 SKUs." },
        { type: "UPSTREAM_PROCESS", name: "Tool Room mould maintenance", ref: "BP-0006" },
      ] },
    { code: "BP-0003", name: "Finished Goods Dispatch & Logistics", site: "NW", ownerId: devendraId, dept: "Logistics", rto: 24, rpo: 8, mtpd: 96, crit: "ESSENTIAL", reviewDays: 180, links: ["0012"],
      desc: "Picking, packing, statutory documentation and outbound transport of finished goods to customers and warehouses.",
      deps: [
        { type: "IT_SYSTEM", name: "ERP dispatch / e-way-bill module", ref: "BP-0011", workaround: "Manual challan fallback (24h)." },
        { type: "VENDOR", name: "Primary transport carrier", workaround: "Two empanelled backup carriers." },
      ] },
    { code: "BP-0004", name: "Quality Lab & Batch Release (NW)", site: "NW", ownerId: sureshId, dept: "Quality", rto: 24, rpo: null, mtpd: 96, crit: "ESSENTIAL", reviewDays: 210, links: ["0012"],
      desc: "Incoming, in-process and final QC testing and batch release. No dispatch of regulated product without release.",
      deps: [
        { type: "EQUIPMENT", name: "Spectrophotometer & UTM", workaround: "NABL lab tie-up for overflow (48h TAT)." },
        { type: "PEOPLE_SKILL", name: "Approved chemist (release authority)", workaround: "SW chemist deputation." },
      ] },
    { code: "BP-0005", name: "Utilities & Power Distribution (NW)", site: "NW", ownerId: devendraId, dept: "Engineering", rto: 4, rpo: null, mtpd: 24, crit: "VITAL", reviewDays: 160,
      desc: "HT power intake, transformers, compressed air and chilled-water utilities feeding all North Works production.",
      deps: [
        { type: "UTILITY", name: "33 kV HT incomer (single feeder)", spof: true, workaround: null },  // ← unmitigated SPOF #1
        { type: "EQUIPMENT", name: "DG backup set", workaround: "1.5 MW DG covers essential loads." },
      ] },
    { code: "BP-0006", name: "Tool Room & Mould Maintenance", site: "NW", ownerId: devendraId, dept: "Maintenance", rto: 24, rpo: null, mtpd: 120, crit: "ESSENTIAL", reviewDays: 240,
      desc: "Preventive and breakdown maintenance of moulds, dies and tooling that keep moulding and extrusion lines running.",
      deps: [
        { type: "PEOPLE_SKILL", name: "Senior tool-maker", workaround: "Retainer with external tool shop." },
      ] },
    // ── South Works ──
    { code: "BP-0007", name: "Specialty Coating Line", site: "SW", ownerId: lakshmiId, dept: "Production", rto: 24, rpo: 8, mtpd: 96, crit: "ESSENTIAL", reviewDays: 30, links: ["0012"],
      desc: "Specialty surface-coating line for high-margin export SKUs. (Recovery strategy still in draft — coverage gap.)",
      deps: [
        { type: "EQUIPMENT", name: "Coating reactor & curing oven", workaround: "No equivalent line; external toll-coater under evaluation." },
        { type: "VENDOR", name: "Specialty resin supplier (single-source)", spof: true, workaround: "60-day strategic buffer stock.", workaroundHrs: 1440 },
      ] },
    { code: "BP-0008", name: "Effluent Treatment Plant (ETP)", site: "SW", ownerId: lakshmiId, dept: "EHS", rto: 4, rpo: null, mtpd: 24, crit: "VITAL", reviewDays: 150, links: ["0015"],
      desc: "Effluent treatment to consented discharge norms. ETP downtime forces a production stop to avoid a statutory breach.",
      deps: [
        { type: "EQUIPMENT", name: "ETP aeration blower (single)", spof: true, workaround: null },  // ← unmitigated SPOF #2
        { type: "PEOPLE_SKILL", name: "Certified ETP operator", workaround: "Contracted O&M operator on call." },
      ] },
    { code: "BP-0009", name: "Warehouse & Raw Material Store (SW)", site: "SW", ownerId: lakshmiId, dept: "Logistics", rto: 24, rpo: 8, mtpd: 96, crit: "ESSENTIAL", reviewDays: 230,
      desc: "Receipt, storage and issue of raw materials and finished goods at South Works, including hazardous-material storage.",
      deps: [
        { type: "FACILITY", name: "Bonded / hazmat storage area", workaround: "Temporary licensed 3PL warehouse." },
        { type: "IT_SYSTEM", name: "WMS inventory module", ref: "BP-0011", workaround: "Manual bin-card fallback." },
      ] },
    { code: "BP-0010", name: "Boiler & Steam Generation (SW)", site: "SW", ownerId: lakshmiId, dept: "Engineering", rto: 4, rpo: null, mtpd: 24, crit: "VITAL", reviewDays: 170,
      desc: "IBR steam generation feeding the coating and curing processes at South Works.",
      deps: [
        { type: "EQUIPMENT", name: "IBR boiler", spof: true, workaround: "12h steam draw from NW interconnect; spare burner on site.", workaroundHrs: 12 },
        { type: "UTILITY", name: "Furnace oil / gas supply", workaround: "7-day on-site fuel buffer." },
      ] },
    // ── Corporate ──
    { code: "BP-0011", name: "IT / ERP & OT Network", site: null, ownerId: kavitaId, dept: "Information Technology", rto: 4, rpo: 1, mtpd: 24, crit: "VITAL", reviewDays: 140, links: ["0018", "0019"],
      desc: "Core ERP, MES/SCADA OT network and identity services underpinning both plants. A failure cascades to most production processes.",
      deps: [
        { type: "EQUIPMENT", name: "Core network switch (no redundant pair)", spof: true, workaround: null },  // ← unmitigated SPOF #3
        { type: "IT_SYSTEM", name: "ERP application & database", workaround: "Warm DR site, RPO 1h (tested)." },
        { type: "VENDOR", name: "MPLS / internet link", workaround: "Dual-ISP failover." },
      ] },
    { code: "BP-0012", name: "Procurement & Vendor Management", site: null, ownerId: meeraId, dept: "Procurement", rto: 24, rpo: 8, mtpd: 120, crit: "ESSENTIAL", reviewDays: 250, links: ["0022"],
      desc: "Sourcing, purchase-order management and inbound supply assurance for critical raw materials.",
      deps: [
        { type: "IT_SYSTEM", name: "ERP procurement module", ref: "BP-0011" },
        { type: "PEOPLE_SKILL", name: "Category buyers (polymer / steel)", workaround: "Documented vendor matrix + manager backup." },
      ] },
    { code: "BP-0013", name: "Payroll & Treasury", site: null, ownerId: rajeshId, dept: "Finance", rto: 24, rpo: 8, mtpd: 72, crit: "ESSENTIAL", reviewDays: 260, links: ["0004"],
      desc: "Payroll processing, banking, forex settlement and statutory remittances.",
      deps: [
        { type: "IT_SYSTEM", name: "Payroll & banking host link", ref: "BP-0011", workaround: "Bank offline-batch fallback." },
        { type: "VENDOR", name: "Payroll bureau", workaround: "In-house manual run for one cycle." },
      ] },
    { code: "BP-0014", name: "Customer Order Management", site: null, ownerId: farhanId, dept: "Commercial", rto: 24, rpo: 8, mtpd: 96, crit: "ESSENTIAL", reviewDays: 25, links: ["0012"],
      desc: "Order capture, scheduling and customer commitments for OEM and distributor channels. (No recovery plan yet — coverage gap.)",
      deps: [
        { type: "IT_SYSTEM", name: "CRM / order-entry portal", ref: "BP-0011", workaround: "Email-order fallback (degraded)." },
        { type: "PEOPLE_SKILL", name: "Key-account managers", workaround: "Documented account handover pack." },
      ] },
  ];

  const procIdByCode = new Map<string, string>();
  let depCount = 0;
  let unmitigatedSpofCount = 0;
  for (const p of PROCS) {
    const bp = await prisma.businessProcess.create({
      data: {
        processCode: p.code, name: p.name, description: p.desc, siteId: siteIdOf(p.site), ownerId: p.ownerId,
        departmentName: p.dept, rtoHours: p.rto, rpoHours: p.rpo, mtpdHours: p.mtpd, criticality: p.crit,
        peakPeriods: p.peak ?? null, impactProfile: (p.impact ?? impactDefault) as any, linkedRiskIds: ridsOf(p.links ?? []) as any,
        biaStatus: "APPROVED", approvedBy: farhanId, lastBiaDate: daysAgo(365 - p.reviewDays),
        nextBiaReviewDate: daysFromNow(p.reviewDays - 200), createdBy: farhanId,
      },
    });
    procIdByCode.set(p.code, bp.id);
    for (const d of p.deps) {
      await prisma.processDependency.create({
        data: {
          processId: bp.id, dependencyType: d.type, name: d.name, isSinglePointOfFailure: d.spof ?? false,
          workaround: d.workaround ?? null, workaroundDurationHours: d.workaroundHrs ?? null,
          linkedEntityRef: d.ref ? procIdByCode.get(d.ref) ?? d.ref : null, createdBy: farhanId,
        },
      });
      depCount++;
      if ((d.spof ?? false) && !(d.workaround && d.workaround.trim())) unmitigatedSpofCount++;
    }
  }
  const pid = (code: string): string => {
    const id = procIdByCode.get(code);
    if (!id) throw new Error(`process ${code} not created`);
    return id;
  };
  console.log(`  business processes: ${PROCS.length} | dependencies: ${depCount} | unmitigated SPOFs: ${unmitigatedSpofCount}`);

  // ════════════════════════════════════════════════════════════════════════
  // 2. Continuity plans (BCP-0001 .. BCP-0008) + recovery tasks
  //    APPROVED plans cover 12 processes; BP-0007 (draft plan) + BP-0014 = gaps.
  // ════════════════════════════════════════════════════════════════════════
  type RTask = { title: string; detail?: string; role: string; targetHrs: number };
  type PlanSpec = {
    code: string; title: string; type: string; site: "NW" | "SW" | null; ownerId: string;
    covers: string[]; status: "DRAFT" | "IN_REVIEW" | "APPROVED"; version: number;
    scope: string; criteria: string[]; strategy: string; fserRef?: string | null;
    nextReviewDays?: number; lastExercisedDays?: number | null; sections: { heading: string; body: string }[]; tasks: RTask[];
  };

  const PLANS: PlanSpec[] = [
    { code: "BCP-0001", title: "North Works Production Continuity Plan", type: "BUSINESS_CONTINUITY", site: "NW", ownerId: devendraId,
      covers: ["BP-0001", "BP-0002", "BP-0006"], status: "APPROVED", version: 3, nextReviewDays: 120, lastExercisedDays: 90,
      scope: "Recovery of North Works extrusion and moulding production, including tool-room support, following equipment, utility or facility disruption.",
      criteria: ["Loss of a critical production line for > 8 hours", "Loss of utilities affecting > 50% of production", "Site evacuation order"],
      strategy: "Prioritise Line 3 (VITAL) recovery within 4h using cold spares and cross-trained crews; shift moulding load between Lines 1 & 2; escalate tooling to external shop if Tool Room is down > 24h.",
      sections: [
        { heading: "Activation & Roles", body: "NW Site Incident Commander activates on the criteria above and convenes the recovery team within 30 minutes." },
        { heading: "Line 3 Recovery", body: "Swap to cold spare screw set; engage OEM for barrel swap (SLA 48h); maintain chilled-water on standby chiller." },
        { heading: "Workaround Production", body: "Re-balance priority SKUs across Lines 1 & 2; communicate revised commitments to Customer Order Management." },
      ],
      tasks: [
        { title: "Convene NW recovery team & confirm scope", role: "NW Site Incident Commander", targetHrs: 1 },
        { title: "Isolate failed line & deploy cold spares", role: "Maintenance Lead", targetHrs: 4 },
        { title: "Re-balance priority SKUs across Lines 1 & 2", role: "Production Planner", targetHrs: 8 },
        { title: "Notify affected customers of revised ETAs", role: "Customer Order Management", targetHrs: 12 },
      ] },
    { code: "BCP-0002", title: "North Works Utilities & Power Recovery", type: "BUSINESS_CONTINUITY", site: "NW", ownerId: devendraId,
      covers: ["BP-0005"], status: "APPROVED", version: 2, nextReviewDays: 95, lastExercisedDays: 400,  // → STALE
      scope: "Restoration of HT power, compressed air and chilled water at North Works.",
      criteria: ["Loss of HT incomer", "DG backup failure", "Chiller / compressor trip affecting production"],
      strategy: "Shed non-essential load, run essential production on the 1.5 MW DG, coordinate with the discom for HT restoration; treat the single HT feeder as the priority resilience gap.",
      sections: [
        { heading: "Immediate Response", body: "Auto-changeover to DG; manual load-shed per the essential-loads schedule." },
        { heading: "HT Restoration", body: "Liaise with discom; mobilise transformer OEM if fault is internal." },
      ],
      tasks: [
        { title: "Confirm DG auto-changeover & load-shed", role: "Shift Electrical Engineer", targetHrs: 1 },
        { title: "Raise fault with discom / OEM", role: "Utilities Manager", targetHrs: 2 },
        { title: "Restore HT supply & re-energise lines", role: "Utilities Manager", targetHrs: 4 },
      ] },
    { code: "BCP-0003", title: "IT Disaster Recovery Plan", type: "DISASTER_RECOVERY_IT", site: null, ownerId: kavitaId,
      covers: ["BP-0011"], status: "APPROVED", version: 4, nextReviewDays: 110, lastExercisedDays: 120,
      scope: "Recovery of ERP, OT network, identity and supporting IT services for both plants, including ransomware-containment failover.",
      criteria: ["Core system outage > 1 hour", "Confirmed ransomware / intrusion", "Loss of primary data centre"],
      strategy: "Contain at the OT/IT segmentation boundary, fail over ERP to the warm DR site (RPO 1h, tested), restore identity, then progressively reconnect plant networks after integrity checks.",
      fserRef: null,
      sections: [
        { heading: "Containment", body: "Isolate affected segments at the firewall boundary; disable compromised accounts; preserve forensic images." },
        { heading: "ERP Failover", body: "Promote the warm DR database (RPO 1h); redirect application traffic; validate critical transactions." },
        { heading: "Reconnection", body: "Reconnect plant OT networks only after malware scan + integrity sign-off by the IT Recovery Lead." },
      ],
      tasks: [
        { title: "Isolate affected network segments", role: "IT Recovery Lead", targetHrs: 1 },
        { title: "Promote warm DR database & redirect ERP", role: "IT Recovery Lead", targetHrs: 4 },
        { title: "Restore identity & critical integrations", role: "Systems Engineer", targetHrs: 8 },
        { title: "Integrity-check & reconnect OT networks", role: "OT Security Engineer", targetHrs: 18 },
      ] },
    { code: "BCP-0004", title: "South Works Utilities (ETP & Boiler) Plan", type: "BUSINESS_CONTINUITY", site: "SW", ownerId: lakshmiId,
      covers: ["BP-0008", "BP-0010"], status: "APPROVED", version: 2, nextReviewDays: 100, lastExercisedDays: 60,  // → AT_RISK via open exercise CAPA
      scope: "Continuity of effluent treatment and steam generation at South Works to avoid statutory breach and production stop.",
      criteria: ["ETP blower / aeration failure", "Boiler trip or IBR shutdown", "Consented-norm exceedance risk"],
      strategy: "On ETP failure, throttle production to within hydraulic capacity and engage contracted O&M; on boiler failure, draw steam from the NW interconnect for up to 12h while the spare burner is fitted.",
      sections: [
        { heading: "ETP Failure", body: "Reduce effluent load by throttling production; engage contracted O&M operator; notify SPCB if exceedance is credible." },
        { heading: "Boiler Failure", body: "Switch to NW steam interconnect (12h limit); fit spare burner; monitor IBR compliance." },
      ],
      tasks: [
        { title: "Throttle production to hydraulic capacity", role: "SW Site Incident Commander", targetHrs: 2 },
        { title: "Engage contracted ETP O&M operator", role: "EHS Manager", targetHrs: 4 },
        { title: "Switch to NW steam interconnect", role: "Utilities Engineer (SW)", targetHrs: 4 },
        { title: "Assess SPCB notification requirement", role: "EHS Manager", targetHrs: 6 },
      ] },
    { code: "BCP-0005", title: "Logistics & Dispatch Continuity Plan", type: "BUSINESS_CONTINUITY", site: null, ownerId: devendraId,
      covers: ["BP-0003", "BP-0009"], status: "APPROVED", version: 1, nextReviewDays: 130, lastExercisedDays: 45,
      scope: "Continuity of finished-goods dispatch and warehousing across both sites following IT, transport or facility disruption.",
      criteria: ["ERP dispatch module outage > 8h", "Loss of primary carrier", "Warehouse facility loss"],
      strategy: "Fall back to manual challan / e-way-bill, switch to empanelled backup carriers, and use a licensed 3PL warehouse for storage overflow.",
      sections: [
        { heading: "Manual Dispatch", body: "Activate manual challan & e-way-bill process; reconcile to ERP on restoration." },
        { heading: "Transport", body: "Engage the two empanelled backup carriers; reprioritise critical-customer loads." },
      ],
      tasks: [
        { title: "Activate manual dispatch documentation", role: "Logistics Lead", targetHrs: 4 },
        { title: "Engage backup carriers", role: "Logistics Lead", targetHrs: 8 },
        { title: "Stand up 3PL overflow warehouse if needed", role: "Warehouse Manager", targetHrs: 24 },
      ] },
    { code: "BCP-0006", title: "Quality & Batch-Release Continuity Plan", type: "BUSINESS_CONTINUITY", site: "NW", ownerId: sureshId,
      covers: ["BP-0004"], status: "APPROVED", version: 1, nextReviewDays: -20, lastExercisedDays: 75,  // → review overdue → AT_RISK
      scope: "Continuity of QC testing and batch release to avoid dispatch holds following lab-equipment or personnel loss.",
      criteria: ["Critical lab instrument down > 24h", "Loss of release-authorised chemist"],
      strategy: "Route overflow testing to a NABL-accredited external lab (48h TAT); depute the SW approved chemist for release authority.",
      sections: [
        { heading: "External Testing", body: "Engage the NABL lab tie-up; manage sample logistics and chain-of-custody." },
        { heading: "Release Authority", body: "Depute the SW approved chemist; document delegated release authority." },
      ],
      tasks: [
        { title: "Engage NABL external lab", role: "QA Manager", targetHrs: 8 },
        { title: "Depute SW chemist for release", role: "QA Manager", targetHrs: 12 },
      ] },
    { code: "BCP-0007", title: "Procurement & Treasury Continuity Plan", type: "BUSINESS_CONTINUITY", site: null, ownerId: meeraId,
      covers: ["BP-0012", "BP-0013"], status: "APPROVED", version: 1, nextReviewDays: 150, lastExercisedDays: null,  // never exercised → STALE + overdue
      scope: "Continuity of critical procurement and payroll/treasury operations during an IT or personnel disruption.",
      criteria: ["ERP procurement/finance modules down > 8h", "Banking host-link failure on a payroll date"],
      strategy: "Use the documented vendor matrix and manual PO process; fall back to the bank offline-batch and in-house manual payroll for one cycle.",
      sections: [
        { heading: "Procurement Fallback", body: "Issue manual POs to matrix vendors; prioritise critical raw materials." },
        { heading: "Payroll Fallback", body: "Run the bank offline-batch; in-house manual payroll for one cycle if the bureau is unavailable." },
      ],
      tasks: [
        { title: "Activate manual PO process for critical inputs", role: "Procurement Lead", targetHrs: 8 },
        { title: "Initiate bank offline-batch payroll", role: "Treasury Manager", targetHrs: 12 },
      ] },
    // BP-0007 covered only by a NON-approved (IN_REVIEW) plan → still a coverage gap.
    { code: "BCP-0008", title: "Specialty Coating Recovery Plan", type: "BUSINESS_CONTINUITY", site: "SW", ownerId: lakshmiId,
      covers: ["BP-0007"], status: "IN_REVIEW", version: 1, nextReviewDays: 365, lastExercisedDays: null,
      scope: "Recovery strategy for the specialty coating line. Draft strategy pending evaluation of external toll-coating capacity.",
      criteria: ["Coating reactor or curing-oven failure", "Specialty resin supply interruption"],
      strategy: "DRAFT — evaluating an external toll-coater and a larger resin buffer; not yet approved.",
      sections: [
        { heading: "Toll-Coating Option", body: "Evaluate qualifying an external toll-coater for high-margin export SKUs." },
      ],
      tasks: [
        { title: "Qualify external toll-coater", role: "SW Production Manager", targetHrs: 720 },
      ] },
  ];

  const planIdByCode = new Map<string, string>();
  let recoveryTaskCount = 0;
  const bcp3TaskIds: { id: string; title: string }[] = [];
  for (const pl of PLANS) {
    const coveredIds = pl.covers.map((c) => pid(c));
    const approved = pl.status === "APPROVED";
    const plan = await prisma.continuityPlan.create({
      data: {
        planCode: pl.code, title: pl.title, planType: pl.type, siteId: siteIdOf(pl.site), ownerId: pl.ownerId,
        coveredProcessIds: coveredIds as any, scopeStatement: pl.scope, activationCriteria: pl.criteria as any,
        status: pl.status, version: pl.version, approvedBy: approved ? farhanId : null, approvedAt: approved ? daysAgo(150) : null,
        nextReviewDate: pl.nextReviewDays != null ? daysFromNow(pl.nextReviewDays) : null,
        sections: pl.sections.map((s, idx) => ({ orderIndex: idx, heading: s.heading, contentRichText: s.body, attachments: [] })) as any,
        strategySummary: pl.strategy, fserPlanRef: pl.fserRef ?? null, versionSnapshots: [] as any,
        lastExercisedAt: pl.lastExercisedDays != null ? daysAgo(pl.lastExercisedDays) : null, createdBy: farhanId,
      },
    });
    planIdByCode.set(pl.code, plan.id);
    for (let i = 0; i < pl.tasks.length; i++) {
      const t = pl.tasks[i];
      const rt = await prisma.recoveryTask.create({
        data: { planId: plan.id, orderIndex: i, title: t.title, detail: t.detail ?? null, responsibleRoleName: t.role, targetHoursFromActivation: t.targetHrs },
      });
      recoveryTaskCount++;
      if (pl.code === "BCP-0003") bcp3TaskIds.push({ id: rt.id, title: t.title });
    }
  }
  const planId = (code: string): string => {
    const id = planIdByCode.get(code);
    if (!id) throw new Error(`plan ${code} not created`);
    return id;
  };
  const approvedPlanCount = PLANS.filter((p) => p.status === "APPROVED").length;
  console.log(`  continuity plans: ${PLANS.length} (${approvedPlanCount} approved) | recovery tasks: ${recoveryTaskCount}`);

  // ════════════════════════════════════════════════════════════════════════
  // 3. Crisis-team roles (6) + call trees (2 published)
  // ════════════════════════════════════════════════════════════════════════
  type TeamRole = { roleName: string; site: "NW" | "SW" | null; primary: string; alternate: string; resp: string; order: number };
  const TEAM: TeamRole[] = [
    { roleName: "Crisis Director", site: null, primary: anandId, alternate: farhanId, order: 1, resp: "Overall command of an enterprise-level crisis; external/board communications and severity decisions." },
    { roleName: "BCM Coordinator", site: null, primary: farhanId, alternate: sureshId, order: 2, resp: "Coordinates plan activation, the crisis log, recovery-task tracking and stand-down/post-crisis review." },
    { roleName: "IT Recovery Lead", site: null, primary: kavitaId, alternate: rajeshId, order: 2, resp: "Leads IT/OT containment and ERP/identity recovery; declares technical all-clear before reconnection." },
    { roleName: "Communications Lead", site: null, primary: meeraId, alternate: nandiniId, order: 3, resp: "Internal and external/stakeholder communications, regulator notification and media holding statements." },
    { roleName: "NW Site Incident Commander", site: "NW", primary: devendraId, alternate: sureshId, order: 1, resp: "On-site command at North Works: life-safety, evacuation, production isolation and local recovery." },
    { roleName: "SW Site Incident Commander", site: "SW", primary: lakshmiId, alternate: devendraId, order: 1, resp: "On-site command at South Works: life-safety, ETP/boiler safety and local recovery." },
  ];
  let teamCount = 0;
  for (const t of TEAM) {
    await prisma.crisisTeamRole.create({
      data: { roleName: t.roleName, siteId: siteIdOf(t.site), primaryUserId: t.primary, alternateUserId: t.alternate, responsibilities: t.resp, escalationOrder: t.order, createdBy: farhanId },
    });
    teamCount++;
  }
  const corpCallNodes = [
    { id: "n1", parentNodeId: null, userId: anandId, contactPhone: "+91-90000-00001", contactEmail: "anand.krishnan@safeops360.in" },
    { id: "n2", parentNodeId: "n1", userId: farhanId, contactPhone: "+91-90000-00002", contactEmail: FARHAN_EMAIL },
    { id: "n3", parentNodeId: "n2", userId: kavitaId, contactPhone: "+91-90000-00003", contactEmail: "kavita.rao@safeops360.in" },
    { id: "n4", parentNodeId: "n2", userId: meeraId, contactPhone: "+91-90000-00004", contactEmail: "meera.iyer@safeops360.in" },
    { id: "n5", parentNodeId: "n2", groupName: "Site Incident Commanders", contactPhone: "+91-90000-00005", contactEmail: "devendra.kulkarni@safeops360.in" },
  ];
  const swCallNodes = [
    { id: "s1", parentNodeId: null, userId: lakshmiId, contactPhone: "+91-90000-00010", contactEmail: "lakshmi.venkatesh@safeops360.in" },
    { id: "s2", parentNodeId: "s1", groupName: "SW Shift Engineers", contactPhone: "+91-90000-00011", contactEmail: "lakshmi.venkatesh@safeops360.in" },
  ];
  await prisma.callTree.create({ data: { name: "Corporate Crisis Call Tree", siteId: null, nodes: corpCallNodes as any, publishedAt: daysAgo(40), createdBy: farhanId } });
  await prisma.callTree.create({ data: { name: "South Works Call Tree", siteId: sw.id, nodes: swCallNodes as any, publishedAt: daysAgo(35), createdBy: farhanId } });
  console.log(`  crisis-team roles: ${teamCount} | call trees: 2`);

  // ════════════════════════════════════════════════════════════════════════
  // 4. Crisis CRX-2026-0001 — closed ransomware-containment crisis + 23 logs
  // ════════════════════════════════════════════════════════════════════════
  const crisisActivatedAt = daysAgo(33);
  const crisisStandDownAt = minsAfter(crisisActivatedAt, 46 * 60); // ~46h later
  const bcp3 = await prisma.continuityPlan.findUnique({ where: { planCode: "BCP-0003" }, select: { id: true, planCode: true, title: true, version: true, sections: true, activationCriteria: true, strategySummary: true } });
  const cachedPlanContent = bcp3
    ? [{
        planId: bcp3.id, planCode: bcp3.planCode, title: bcp3.title, version: bcp3.version,
        sections: bcp3.sections, activationCriteria: bcp3.activationCriteria, strategySummary: bcp3.strategySummary,
        recoveryTasks: bcp3TaskIds.map((t, idx) => ({ id: t.id, orderIndex: idx, title: t.title })),
      }]
    : [];
  const taskRef = (title: string): string | null => bcp3TaskIds.find((t) => t.title === title)?.id ?? null;

  const crisis = await prisma.crisisEvent.create({
    data: {
      crisisCode: "CRX-2026-0001", title: "Ransomware intrusion — OT network isolation & ERP failover",
      siteId: null, activatedPlanIds: [planId("BCP-0003")] as any, linkedRiskIds: ridsOf(["0018", "0019"]) as any,
      linkedIncidentId: null, status: "CLOSED", activatedBy: kavitaId, activatedAt: crisisActivatedAt,
      severityLevel: 2, standDownAt: crisisStandDownAt, postCrisisReviewDone: true,
      reviewNote: "Post-crisis review held 3 days after stand-down. Containment at the OT boundary worked and ERP failover met the 1h RPO. Two improvement actions logged: (1) accelerate MFA rollout to remaining OT-admin accounts; (2) add the segmentation-failover step to the next call-tree exercise. No data exfiltration confirmed by forensics.",
      reviewCapaId: null,
      cachedPlanContent: cachedPlanContent as any,
      callTreeAck: { n1: { notifiedAt: minsAfter(crisisActivatedAt, 2).toISOString(), acknowledgedAt: minsAfter(crisisActivatedAt, 6).toISOString() }, n2: { notifiedAt: minsAfter(crisisActivatedAt, 3).toISOString(), acknowledgedAt: minsAfter(crisisActivatedAt, 9).toISOString() }, n3: { notifiedAt: minsAfter(crisisActivatedAt, 4).toISOString(), acknowledgedAt: minsAfter(crisisActivatedAt, 7).toISOString() } } as any,
      createdBy: kavitaId,
    },
  });

  type Log = { mins: number; type: string; by: string; content: string; task?: string };
  const LOGS: Log[] = [
    { mins: 0, type: "DECISION", by: kavitaId, content: "Crisis CRX-2026-0001 activated at severity 1 (site). SOC confirmed credential compromise via phishing and lateral-movement attempts toward the OT segment. IT DR Plan (BCP-0003) invoked." },
    { mins: 5, type: "COMMUNICATION", by: kavitaId, content: "Corporate crisis call tree triggered. Crisis Director and BCM Coordinator notified and acknowledged." },
    { mins: 8, type: "ACTION", by: kavitaId, content: "Isolated affected VLAN segments at the firewall boundary; disabled three compromised user accounts; preserved forensic images of the entry host.", task: "Isolate affected network segments" },
    { mins: 20, type: "STATUS_UPDATE", by: kavitaId, content: "No evidence of encryption yet. Containment holding at the IT/OT boundary; OT/SCADA segment shows no anomalous traffic." },
    { mins: 35, type: "DECISION", by: anandId, content: "Severity escalated to 2 (corporate) given the credential-compromise blast radius and the decision to fail ERP over to DR. CRO informed; CFO and Comms Lead pulled in." },
    { mins: 45, type: "ACTION", by: farhanId, content: "Recovery-task checklist opened for BCP-0003; recovery roles confirmed present on the bridge." },
    { mins: 60, type: "ACTION", by: kavitaId, content: "Promoted the warm DR database (RPO 1h verified) and redirected ERP application traffic to the DR site. Critical transaction smoke-test passed.", task: "Promote warm DR database & redirect ERP" },
    { mins: 75, type: "COMMUNICATION", by: meeraId, content: "Holding statement prepared for internal staff; external/customer comms on standby. No regulator notification required at this stage (no confirmed data breach)." },
    { mins: 95, type: "STATUS_UPDATE", by: kavitaId, content: "ERP available on DR for finance and procurement users. Plant MES still isolated pending integrity checks." },
    { mins: 130, type: "ACTION", by: kavitaId, content: "Restored identity services and re-enabled clean accounts with forced password reset + MFA. Critical integrations (banking, e-way-bill) re-validated.", task: "Restore identity & critical integrations" },
    { mins: 160, type: "DECISION", by: kavitaId, content: "Decision: keep OT networks isolated overnight; reconnect only after a full malware scan and integrity sign-off in the morning shift." },
    { mins: 240, type: "STATUS_UPDATE", by: farhanId, content: "End of day-1 status: ERP stable on DR, OT isolated, no exfiltration detected. Bridge stood down to on-call overnight." },
    { mins: 600, type: "COMMUNICATION", by: meeraId, content: "Day-2 internal update circulated: systems being restored progressively; no customer-data impact identified." },
    { mins: 720, type: "ACTION", by: kavitaId, content: "Full malware scan of OT hosts completed — clean. Integrity sign-off obtained from the IT Recovery Lead." },
    { mins: 780, type: "ACTION", by: kavitaId, content: "Began phased reconnection of OT networks per the plan, monitoring traffic at each step.", task: "Integrity-check & reconnect OT networks" },
    { mins: 900, type: "STATUS_UPDATE", by: devendraId, content: "North Works MES reconnected; Line 3 and moulding lines back on ERP scheduling. No production loss beyond the planned isolation window." },
    { mins: 960, type: "STATUS_UPDATE", by: lakshmiId, content: "South Works WMS and dispatch reconnected; manual bin-card entries reconciled to ERP." },
    { mins: 1080, type: "DECISION", by: kavitaId, content: "All systems confirmed restored and clean. Recommending fail-back from DR to primary during the next maintenance window (non-urgent)." },
    { mins: 1200, type: "COMMUNICATION", by: meeraId, content: "Customer-facing all-clear: order processing and dispatch fully normal. No external statement required." },
    { mins: 1500, type: "ACTION", by: farhanId, content: "All BCP-0003 recovery tasks marked complete; recovery-task checklist closed." },
    { mins: 2400, type: "STATUS_UPDATE", by: kavitaId, content: "48-hour watch period clear. No recurrence; DR running stable. Forensics interim report: phishing entry, no confirmed data exfiltration." },
    { mins: 2700, type: "DECISION", by: anandId, content: "Crisis Director authorises stand-down. Move to post-crisis review and capture improvement actions." },
    { mins: 2760, type: "ACTION", by: farhanId, content: "Crisis stood down at severity 2 → STAND_DOWN. Post-crisis review scheduled for +3 days. Crisis log sealed for the legal record." },
  ];
  let logCount = 0;
  for (const l of LOGS) {
    await prisma.crisisLogEntry.create({
      data: {
        crisisId: crisis.id, timestamp: minsAfter(crisisActivatedAt, l.mins), enteredBy: l.by, entryType: l.type,
        content: l.content, recoveryTaskId: l.task ? taskRef(l.task) : null,
      },
    });
    logCount++;
  }
  console.log(`  crisis: ${crisis.crisisCode} (CLOSED, sev 2) | log entries: ${logCount}`);

  // ════════════════════════════════════════════════════════════════════════
  // 5. BC exercises (BCX-2026-0001 .. 0006) + findings (+ 1 MAJOR_GAP → CAPA)
  // ════════════════════════════════════════════════════════════════════════
  type Find = { desc: string; sev: "OBSERVATION" | "MINOR_GAP" | "MAJOR_GAP"; raiseCapa?: boolean };
  type ExSpec = {
    code: string; title: string; type: string; site: "NW" | "SW" | null; plans: string[]; scenario?: string | null;
    facilitator: string; participants: string[]; objectives: string[]; status: "PLANNED" | "COMPLETED";
    schedDays: number; conductedDays?: number; outcome?: string; rtoAchieved?: number | null;
    callTreeStats?: { notified: number; acknowledged: number; medianAckMinutes: number } | null; findings: Find[];
  };
  const EXS: ExSpec[] = [
    { code: "BCX-2026-0001", title: "NW Production Line 3 — Tabletop", type: "TABLETOP", site: "NW", plans: ["BCP-0001"], facilitator: farhanId,
      participants: [devendraId, sureshId], objectives: ["Validate Line 3 recovery sequence", "Confirm cold-spare logistics", "Test customer-comms trigger"],
      status: "COMPLETED", schedDays: 95, conductedDays: 90, outcome: "MET_OBJECTIVES", rtoAchieved: 6,
      findings: [
        { desc: "Cold-spare screw set location was not in the recovery pack; team located it from tribal knowledge.", sev: "MINOR_GAP" },
        { desc: "Customer-comms template lacked a revised-ETA field.", sev: "OBSERVATION" },
      ] },
    { code: "BCX-2026-0002", title: "IT DR Failover — Simulation", type: "SIMULATION", site: null, plans: ["BCP-0003"], facilitator: kavitaId,
      participants: [kavitaId, rajeshId], objectives: ["Fail ERP over to DR within RTO", "Verify RPO ≤ 1h", "Validate identity restoration"],
      status: "COMPLETED", schedDays: 125, conductedDays: 120, outcome: "PARTIALLY_MET", rtoAchieved: 5,
      findings: [
        { desc: "Identity restoration took longer than target due to a stale DNS entry at the DR site.", sev: "MINOR_GAP" },
      ] },
    { code: "BCX-2026-0003", title: "SW Utilities (ETP) — Full Interruption Test", type: "FULL_INTERRUPTION_TEST", site: "SW", plans: ["BCP-0004"], facilitator: lakshmiId,
      participants: [lakshmiId, devendraId], objectives: ["Test ETP failure response within RTO", "Validate contracted O&M call-out", "Confirm no consented-norm breach"],
      status: "COMPLETED", schedDays: 65, conductedDays: 60, outcome: "PARTIALLY_MET", rtoAchieved: 7,
      findings: [
        { desc: "Single ETP aeration blower has no installed standby; on simulated failure, production had to be stopped within 2h to avoid a consented-norm breach. No viable workaround exists — this is an unmitigated single point of failure requiring capex.", sev: "MAJOR_GAP", raiseCapa: true },
        { desc: "Contracted O&M operator call-out exceeded the 4h target by 50 minutes.", sev: "MINOR_GAP" },
      ] },
    { code: "BCX-2026-0004", title: "Enterprise Crisis Call-Tree Test", type: "CALL_TREE_TEST", site: null, plans: [], facilitator: farhanId,
      participants: [anandId, kavitaId, meeraId, devendraId, lakshmiId], objectives: ["Verify call-tree reachability", "Measure acknowledgement latency"],
      status: "COMPLETED", schedDays: 32, conductedDays: 30, outcome: "MET_OBJECTIVES", rtoAchieved: null,
      callTreeStats: { notified: 42, acknowledged: 38, medianAckMinutes: 7 },
      findings: [
        { desc: "Four contacts were unreachable on the first pass (stale mobile numbers); reached on the alternate.", sev: "OBSERVATION" },
      ] },
    { code: "BCX-2026-0005", title: "Logistics & Dispatch — Desk Check", type: "DESK_CHECK", site: null, plans: ["BCP-0005"], facilitator: farhanId,
      participants: [devendraId], objectives: ["Walk through manual-dispatch fallback", "Confirm backup-carrier contacts"],
      status: "COMPLETED", schedDays: 48, conductedDays: 45, outcome: "MET_OBJECTIVES", rtoAchieved: null, findings: [] },
    { code: "BCX-2026-0006", title: "Annual Crisis Simulation — Cyber Scenario", type: "SIMULATION", site: null, plans: ["BCP-0003"], scenario: "SCN-0001", facilitator: farhanId,
      participants: [anandId, kavitaId, farhanId, meeraId], objectives: ["Exercise the full crisis structure end-to-end", "Test severity-escalation decisions", "Validate regulator-notification call"],
      status: "PLANNED", schedDays: -35, findings: [] },  // negative schedDays → scheduled in the FUTURE
  ];

  // Resolve scenario codes after scenarios are created — defer. First create exercises without testedScenarioId,
  // then patch BCX-0006 once SCN-0001 exists. (Simpler: create scenarios first.) → We create scenarios in §6,
  // so stash a deferred patch list here.
  const exIdByCode = new Map<string, string>();
  const deferredScenarioLink: { exId: string; scenarioCode: string }[] = [];
  let exCount = 0, findingCount = 0, bcExerciseCapaCount = 0;
  for (const ex of EXS) {
    const e = await prisma.bcExercise.create({
      data: {
        exerciseCode: ex.code, title: ex.title, exerciseType: ex.type, scheduledDate: ex.schedDays < 0 ? daysFromNow(-ex.schedDays) : daysAgo(ex.schedDays),
        siteId: siteIdOf(ex.site), testedPlanIds: ex.plans.map((c) => planId(c)) as any, testedScenarioId: null,
        facilitatorId: ex.facilitator, participants: ex.participants as any, objectives: ex.objectives as any,
        status: ex.status, conductedDate: ex.conductedDays != null ? daysAgo(ex.conductedDays) : null,
        outcome: ex.outcome ?? null, rtoAchievedHours: ex.rtoAchieved ?? null, callTreeStats: (ex.callTreeStats ?? null) as any,
        reportRichText: ex.status === "COMPLETED" ? `Exercise ${ex.code} conducted; outcome ${ex.outcome}. ${ex.findings.length} finding(s) logged.` : null,
        createdBy: farhanId,
      },
    });
    exIdByCode.set(ex.code, e.id);
    exCount++;
    if (ex.scenario) deferredScenarioLink.push({ exId: e.id, scenarioCode: ex.scenario });
    for (const f of ex.findings) {
      const finding = await prisma.exerciseFinding.create({
        data: { exerciseId: e.id, description: f.desc, severity: f.sev, capaId: null, createdBy: farhanId },
      });
      findingCount++;
      if (f.raiseCapa) {
        const capa = await prisma.capa.create({
          data: {
            capaNumber: `CAPA-${bcxCat.prefix}-2026-${sw.code}-001`,
            title: `Exercise gap: ${f.desc.slice(0, 110)}`,
            plantId: sw.id, sourceCategoryId: bcxCat.id, sourceTypeId: bcxType.id, sourceTypeCode: "BC_EXERCISE",
            sourceReferenceId: finding.id, sourceReferenceUrl: `/erm/bcm/exercises/${e.id}`,
            sourceReferenceSummary: `${ex.code} — ${ex.title}`,
            sourceMetadata: { exerciseCode: ex.code, exerciseId: e.id, findingId: finding.id, severity: f.sev } as any,
            problemDescription: f.desc,
            detectionMethod: "BC_EXERCISE", detectedAt: daysAgo(60), detectedByUserId: lakshmiId,
            primaryCategory: "BC Exercise", severity: "HIGH", priority: "HIGH",
            state: "ACTIONS_PLANNED", stateChangedAt: daysAgo(55), closureTargetDate: daysFromNow(90),
            raisedByUserId: farhanId, primaryOwnerUserId: lakshmiId, createdByUserId: farhanId,
          },
        });
        await prisma.exerciseFinding.update({ where: { id: finding.id }, data: { capaId: capa.id } });
        bcExerciseCapaCount++;
      }
    }
  }
  console.log(`  exercises: ${exCount} | findings: ${findingCount} | BC_EXERCISE CAPAs: ${bcExerciseCapaCount}`);

  // ════════════════════════════════════════════════════════════════════════
  // 6. Scenarios (SCN-0001 .. 0006) + 5 horizon items
  // ════════════════════════════════════════════════════════════════════════
  type ScnSpec = {
    code: string; title: string; category: string; prob: string; horizon: string; status: "DRAFT" | "ACTIVE";
    narrative: string; risks: string[]; procs: string[]; readiness: string;
    impacts: { dimension: string; estimatedLevel: number; estimateBasisNotes: string; estimatedGrossInr?: number }[];
    reviewedDays?: number;
  };
  const SCNS: ScnSpec[] = [
    { code: "SCN-0001", title: "Plant-wide ransomware with OT spillover", category: "CYBER_ATTACK", prob: "PLAUSIBLE", horizon: "0_12_MONTHS", status: "ACTIVE",
      narrative: "A phishing-led ransomware intrusion breaches the IT/OT boundary and encrypts ERP and MES, halting scheduling and dispatch across both plants for several days.",
      risks: ["0018", "0019"], procs: ["BP-0011", "BP-0001", "BP-0003"], readiness: "PLAN_TESTED", reviewedDays: 30,
      impacts: [
        { dimension: "FINANCIAL", estimatedLevel: 5, estimateBasisNotes: "Multi-day shutdown + recovery; ~₹5 Cr credible worst case (see LE-2026-0012).", estimatedGrossInr: 50000000 },
        { dimension: "REPUTATIONAL", estimatedLevel: 4, estimateBasisNotes: "Customer delivery failures + possible disclosure obligations." },
        { dimension: "REGULATORY", estimatedLevel: 3, estimateBasisNotes: "Potential data-protection notification depending on exfiltration." },
      ] },
    { code: "SCN-0002", title: "Single-source specialty resin disruption", category: "SUPPLY_DISRUPTION", prob: "LIKELY", horizon: "0_12_MONTHS", status: "ACTIVE",
      narrative: "The sole qualified specialty-resin supplier suffers a force-majeure outage, draining buffer stock and stopping the high-margin coating line and dependent exports.",
      risks: ["0022"], procs: ["BP-0012", "BP-0007"], readiness: "PLAN_EXISTS", reviewedDays: 50,
      impacts: [
        { dimension: "FINANCIAL", estimatedLevel: 4, estimateBasisNotes: "Lost export margin + air-freight premiums for alternates.", estimatedGrossInr: 32000000 },
        { dimension: "REPUTATIONAL", estimatedLevel: 3, estimateBasisNotes: "Export-customer commitments at risk." },
      ] },
    { code: "SCN-0003", title: "Regional flooding — South Works inundation", category: "NATURAL_DISASTER", prob: "POSSIBLE", horizon: "1_3_YEARS", status: "ACTIVE",
      narrative: "Extreme monsoon flooding inundates South Works, taking down the coating line, ETP and warehouse, with extended access loss.",
      risks: ["0015"], procs: ["BP-0007", "BP-0008", "BP-0009"], readiness: "NO_PLAN", reviewedDays: 70,
      impacts: [
        { dimension: "FINANCIAL", estimatedLevel: 4, estimateBasisNotes: "Asset damage + extended SW outage." },
        { dimension: "SAFETY", estimatedLevel: 3, estimateBasisNotes: "Evacuation + hazmat-storage exposure." },
        { dimension: "REGULATORY", estimatedLevel: 4, estimateBasisNotes: "ETP bypass risk → consented-norm breach." },
      ] },
    { code: "SCN-0004", title: "Regional grid blackout > 24 hours", category: "UTILITY_FAILURE", prob: "PLAUSIBLE", horizon: "1_3_YEARS", status: "ACTIVE",
      narrative: "A prolonged regional grid blackout exceeds on-site DG endurance, forcing essential-load-only operation and a partial production stop.",
      risks: ["0011"], procs: ["BP-0005", "BP-0010"], readiness: "PLAN_EXISTS", reviewedDays: 60,
      impacts: [
        { dimension: "FINANCIAL", estimatedLevel: 4, estimateBasisNotes: "Lost output + fuel costs for extended DG running." },
        { dimension: "SAFETY", estimatedLevel: 2, estimateBasisNotes: "Reduced safety-system redundancy on DG." },
      ] },
    { code: "SCN-0005", title: "Pandemic-driven workforce absenteeism", category: "PANDEMIC_WORKFORCE", prob: "POSSIBLE", horizon: "1_3_YEARS", status: "ACTIVE",
      narrative: "A pandemic wave drives 30–40% absenteeism among skilled operators, throttling production and stressing critical-skill coverage.",
      risks: ["0011"], procs: ["BP-0001", "BP-0002"], readiness: "PLAN_EXISTS", reviewedDays: 80,
      impacts: [
        { dimension: "FINANCIAL", estimatedLevel: 3, estimateBasisNotes: "Reduced throughput across moulding & extrusion." },
        { dimension: "SAFETY", estimatedLevel: 3, estimateBasisNotes: "Fatigue / reduced supervision with thin crews." },
      ] },
    { code: "SCN-0006", title: "Raw-material price shock", category: "MARKET_SHOCK", prob: "LIKELY", horizon: "0_12_MONTHS", status: "DRAFT",
      narrative: "A sharp steel/polymer price spike compresses margins beyond hedged limits, pressuring profitability and pricing commitments.",
      risks: ["0006", "0024"], procs: [], readiness: "NO_PLAN",
      impacts: [
        { dimension: "FINANCIAL", estimatedLevel: 4, estimateBasisNotes: "Margin compression on un-hedged basket; see KRI-0012." },
      ] },
  ];

  const scnIdByCode = new Map<string, string>();
  let scnCount = 0;
  for (const s of SCNS) {
    const scn = await prisma.scenario.create({
      data: {
        scenarioCode: s.code, title: s.title, category: s.category, narrative: s.narrative,
        probabilityQualitative: s.prob, timeHorizon: s.horizon, affectedRiskIds: ridsOf(s.risks) as any,
        affectedProcessIds: s.procs.map((c) => pid(c)) as any,
        impactEstimates: s.impacts.map((im) => ({ ...im, distributionParams: null })) as any,
        whatIfAdjustments: stressOf(s.risks) as any, mitigationReadiness: s.readiness, status: s.status,
        lastReviewedAt: s.reviewedDays != null ? daysAgo(s.reviewedDays) : null, createdBy: farhanId,
      },
    });
    scnIdByCode.set(s.code, scn.id);
    scnCount++;
  }
  // Patch the deferred exercise→scenario link (BCX-0006 → SCN-0001).
  for (const link of deferredScenarioLink) {
    const sid = scnIdByCode.get(link.scenarioCode);
    if (sid) await prisma.bcExercise.update({ where: { id: link.exId }, data: { testedScenarioId: sid } });
  }
  console.log(`  scenarios: ${scnCount}`);

  // ── Horizon items (5) ─────────────────────────────────────────────────────
  type HzSpec = {
    title: string; description: string; category: string; signal: string; watchedBy: string; reviewDays: number;
    potential?: string[]; disposition?: string; promotedTo?: { kind: "scenario" | "risk"; code: string }; note?: string;
  };
  const HZS: HzSpec[] = [
    { title: "EU CBAM carbon border tariff", description: "The EU Carbon Border Adjustment Mechanism enters its definitive phase, adding cost and reporting burden on exported goods with embedded carbon.", category: "REGULATORY_SHOCK", signal: "EMERGING", watchedBy: nandiniId, reviewDays: 40, potential: ["0020", "0024"] },
    { title: "Quantum threat to current PKI", description: "Advances in quantum computing threaten today's public-key cryptography on a multi-year horizon, with implications for OT/IT trust infrastructure.", category: "CYBER_ATTACK", signal: "WEAK", watchedBy: kavitaId, reviewDays: 120, potential: ["0018"] },
    { title: "Regional water-stress & abstraction caps", description: "Worsening regional water stress points to tighter groundwater-abstraction caps that could constrain South Works operations.", category: "REGULATORY_SHOCK", signal: "STRONG", watchedBy: lakshmiId, reviewDays: -10, potential: ["0015", "0021"], disposition: "PROMOTED_TO_SCENARIO", promotedTo: { kind: "scenario", code: "SCN-0003" }, note: "Promoted into the South Works flooding/water-stress scenario for structured analysis." },
    { title: "Key polymer supplier M&A consolidation", description: "Consolidation among polymer suppliers could reduce the qualified-vendor pool and increase single-source exposure on critical inputs.", category: "SUPPLY_DISRUPTION", signal: "EMERGING", watchedBy: meeraId, reviewDays: 30, potential: ["0022"], disposition: "PROMOTED_TO_RISK", promotedTo: { kind: "risk", code: "0022" }, note: "Folded into the existing supply-concentration risk ERM-2026-0022; appetite already breached (KRI-0015)." },
    { title: "AI-driven phishing sophistication", description: "Generative-AI phishing markedly raises the believability of social-engineering attacks, increasing intrusion likelihood.", category: "CYBER_ATTACK", signal: "STRONG", watchedBy: kavitaId, reviewDays: 25, potential: ["0018"], disposition: "DISMISSED", note: "Already captured within cyber risk ERM-2026-0018 and the phishing-simulation KRI-0013; no separate item needed." },
  ];
  let hzCount = 0;
  for (const h of HZS) {
    let promotedEntityId: string | null = null;
    if (h.promotedTo) {
      promotedEntityId = h.promotedTo.kind === "scenario" ? scnIdByCode.get(h.promotedTo.code) ?? null : riskIdByShort.get(h.promotedTo.code) ?? null;
    }
    await prisma.horizonItem.create({
      data: {
        title: h.title, description: h.description, category: h.category, signalStrength: h.signal,
        potentialCategoryIds: (h.potential ?? []) as any, watchedBy: h.watchedBy, reviewDate: daysFromNow(h.reviewDays),
        disposition: h.disposition ?? null, promotedEntityId, dispositionNote: h.note ?? null, createdBy: farhanId,
      },
    });
    hzCount++;
  }
  console.log(`  horizon items: ${hzCount}`);

  // ════════════════════════════════════════════════════════════════════════
  // Summary + engineered-fact assertions
  // ════════════════════════════════════════════════════════════════════════
  const allProcs = await prisma.businessProcess.findMany({ select: { id: true, processCode: true, name: true, criticality: true } });
  const approvedPlans = await prisma.continuityPlan.findMany({ where: { status: "APPROVED" }, select: { coveredProcessIds: true } });
  const coveredSet = new Set<string>();
  for (const pl of approvedPlans) for (const id of (pl.coveredProcessIds as string[]) || []) coveredSet.add(id);
  const critical = allProcs.filter((p) => p.criticality === "VITAL" || p.criticality === "ESSENTIAL");
  const coveredCritical = critical.filter((p) => coveredSet.has(p.id));
  const gaps = critical.filter((p) => !coveredSet.has(p.id));

  const counts = {
    farhan: await prisma.user.count({ where: { email: FARHAN_EMAIL } }),
    businessProcesses: await prisma.businessProcess.count(),
    dependencies: await prisma.processDependency.count(),
    continuityPlans: await prisma.continuityPlan.count(),
    recoveryTasks: await prisma.recoveryTask.count(),
    crisisTeamRoles: await prisma.crisisTeamRole.count(),
    callTrees: await prisma.callTree.count(),
    crisisEvents: await prisma.crisisEvent.count(),
    crisisLogEntries: await prisma.crisisLogEntry.count(),
    bcExercises: await prisma.bcExercise.count(),
    exerciseFindings: await prisma.exerciseFinding.count(),
    bcExerciseCapas: await prisma.capa.count({ where: { sourceTypeCode: "BC_EXERCISE" } }),
    scenarios: await prisma.scenario.count(),
    horizonItems: await prisma.horizonItem.count(),
  };
  console.log("\n  ── ERM Phase 3 seed summary ─────────────────");
  for (const [k, v] of Object.entries(counts)) console.log(`     ${k.padEnd(20)} : ${v}`);
  const covPct = critical.length ? ((coveredCritical.length / critical.length) * 100).toFixed(1) : "0.0";
  console.log(`     coverage             : ${coveredCritical.length} / ${critical.length} critical (${covPct}%)`);
  console.log(`     coverage gaps        : ${gaps.map((g) => g.processCode).join(", ")} (${gaps.map((g) => g.name).join(" | ")})`);

  // Assertions — fail loudly if the engineered demo facts drift.
  const errs: string[] = [];
  if (counts.businessProcesses !== 14) errs.push(`expected 14 processes, got ${counts.businessProcesses}`);
  if (critical.length !== 14) errs.push(`expected 14 critical processes, got ${critical.length}`);
  if (coveredCritical.length !== 12) errs.push(`expected 12 covered-critical, got ${coveredCritical.length}`);
  if (gaps.length !== 2) errs.push(`expected 2 coverage gaps, got ${gaps.length}`);
  if (unmitigatedSpofCount !== 3) errs.push(`expected 3 unmitigated SPOFs, got ${unmitigatedSpofCount}`);
  if (counts.bcExerciseCapas !== 1) errs.push(`expected 1 BC_EXERCISE CAPA, got ${counts.bcExerciseCapas}`);
  if (counts.crisisLogEntries !== 23) errs.push(`expected 23 crisis log entries, got ${counts.crisisLogEntries}`);
  if (errs.length) {
    console.error("\n❌ Engineered-fact assertions FAILED:");
    for (const e of errs) console.error(`   • ${e}`);
    throw new Error("Phase 3 seed produced unexpected demo facts");
  }
  console.log("\n  ✓ engineered facts verified: 14 processes · 12/14 coverage · 2 gaps · 3 SPOFs · 1 BC_EXERCISE CAPA · 23 crisis logs");
  console.log("✅  ERM Phase 3 seed complete.");
}

main()
  .catch((e) => { console.error("❌ seed-erm-p3 failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
