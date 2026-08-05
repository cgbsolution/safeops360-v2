// ────────────────────────────────────────────────────────────────────────
// Seed — Facilities Phase D/E: OPERATIONAL data for all 16 garment sites
//
// Seeds light data into the EXISTING engines (CAMS audits + findings, CAPA,
// ERM obligations, Incidents) for every MAG-* plant so the consolidated
// dashboard's live roll-ups + the F-02 Compliance & Audit tab are non-empty.
// The FactoryComplianceSnapshot computes FROM this (never a duplicate store).
// Data is GENERATED per factory from its compliance band → coherent gradient:
// leaders clean, laggards (Ludhiana 68%) carry critical findings + overdue
// CAPAs/obligations + incidents.
//
// Idempotent: deletes prior MAG-* operational rows before recreating.
// Run AFTER seed-factory. Then recompute snapshots (or first dashboard load).
//   npx tsx prisma/seed-factory-ops.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NOW = new Date("2026-06-20T00:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

// plantCode + compliance score + etp flag (mirrors seed-factory.ts)
const SITES: { plantCode: string; score: number; etp?: boolean }[] = [
  { plantCode: "MAG-TIR1", score: 88 }, { plantCode: "MAG-TIR2", score: 79 }, { plantCode: "MAG-BLR", score: 84 },
  { plantCode: "MAG-MYS", score: 72 }, { plantCode: "MAG-NOI", score: 81 }, { plantCode: "MAG-GUR", score: 86 },
  { plantCode: "MAG-LDH", score: 68 }, { plantCode: "MAG-FBD", score: 77 }, { plantCode: "MAG-SUR", score: 83, etp: true },
  { plantCode: "MAG-AMD", score: 80 }, { plantCode: "MAG-MUM", score: 85 }, { plantCode: "MAG-KOL", score: 74 },
  { plantCode: "MAG-IDR", score: 82 }, { plantCode: "MAG-JAI", score: 78 }, { plantCode: "MAG-HYD", score: 87 },
  { plantCode: "MAG-CBE", score: 76 },
];

const overallResult = (s: number) => (s < 75 ? "CRITICAL_NC" : s < 80 ? "MAJOR_NC" : s < 85 ? "MINOR_NC" : "CONFORMING");

function findingsFor(score: number, etp?: boolean) {
  let f: { sev: string; status: string; title: string }[];
  if (score >= 85) f = [{ sev: "MINOR_NC", status: "CLOSED", title: "Minor documentation gap (closed)" }];
  else if (score >= 80) f = [{ sev: "MINOR_NC", status: "OPEN", title: "Housekeeping observation in finishing" }];
  else if (score >= 75) f = [{ sev: "MAJOR_NC", status: "OPEN", title: "Training records incomplete for new joiners" }, { sev: "MINOR_NC", status: "CLOSED", title: "Signage refresh (closed)" }];
  else f = [
    { sev: "CRITICAL_NC", status: "OPEN", title: "Emergency exit obstructed / fire-safety gap" },
    { sev: "MAJOR_NC", status: "OPEN", title: "Fire-drill & PPE records incomplete" },
    { sev: "MINOR_NC", status: "OPEN", title: "Statutory register gaps" },
    { sev: "MINOR_NC", status: "CLOSED", title: "Dispatch housekeeping (closed)" },
  ];
  if (etp) f.push({ sev: "MAJOR_NC", status: "OPEN", title: "ETP effluent pH excursion not logged" });
  return f;
}
function capasFor(score: number, etp?: boolean) {
  let c: { state: string; severity: string; overdue: boolean; title: string }[];
  if (score >= 85) c = [{ state: "CLOSED", severity: "LOW", overdue: false, title: "Minor corrective (closed)" }];
  else if (score >= 80) c = [{ state: "ACTIONS_IN_PROGRESS", severity: "MODERATE", overdue: false, title: "Process improvement action" }];
  else if (score >= 75) c = [{ state: "ACTIONS_IN_PROGRESS", severity: "HIGH", overdue: false, title: "Training-records corrective action" }];
  else c = [
    { state: "ACTIONS_IN_PROGRESS", severity: "CRITICAL", overdue: true, title: "Clear & maintain emergency egress routes" },
    { state: "UNDER_RCA", severity: "HIGH", overdue: true, title: "Reinstate monthly fire-drill schedule" },
    { state: "ACTIONS_PLANNED", severity: "MODERATE", overdue: false, title: "Digitise PPE issuance tracking" },
  ];
  if (etp) c.push({ state: "ACTIONS_IN_PROGRESS", severity: "HIGH", overdue: false, title: "ETP continuous monitoring + logging SOP" });
  return c;
}
function oblsFor(score: number, etp?: boolean) {
  const consent = etp ? "GPCB Water Consent" : "SPCB Consent to Operate";
  if (score >= 80) return [
    { type: "LICENCE", status: "COMPLIANT", title: "Factory Licence — current", validUntil: daysFromNow(250) },
    { type: "CONSENT", status: "COMPLIANT", title: `${consent} — current`, validUntil: daysFromNow(200) },
  ];
  if (score >= 75) return [
    { type: "CONSENT", status: "DUE_SOON", title: `${consent} — renewal due`, validUntil: daysFromNow(25) },
    { type: "LICENCE", status: "COMPLIANT", title: "Factory Licence — current", validUntil: daysFromNow(220) },
  ];
  return [
    { type: "CONSENT", status: "OVERDUE", title: `${consent} — RENEWAL LAPSED`, validUntil: daysAgo(20) },
    { type: "RETURN_FILING", status: "DUE_SOON", title: "Annual Factory Return (Form 22)", validUntil: daysFromNow(20) },
    { type: "LICENCE", status: "COMPLIANT", title: "Factory Licence — current", validUntil: daysFromNow(200) },
  ];
}
function incsFor(score: number) {
  if (score >= 83) return [] as { type: string; days: number; desc: string }[];
  if (score >= 75) return [{ type: "FIRST_AID", days: 80, desc: "Minor first-aid case" }];
  return [
    { type: "MTC", days: 40, desc: "Laceration at cutting table — medical treatment case" },
    { type: "FIRST_AID", days: 120, desc: "Slip near dispatch dock — first aid" },
  ];
}

async function main() {
  console.log("Seeding Facilities operational data — 16 MAG-* sites…");
  const owner = await prisma.user.findFirst({ where: { email: "mervyn.fernandes@meridian-apparel.in" } });
  if (!owner) throw new Error("mervyn.fernandes persona missing — run seed-factory first");
  const capaCat = await prisma.capaSourceCategory.findFirst();
  const capaType = await prisma.capaSourceType.findFirst();
  const canSeedCapa = !!(capaCat && capaType);
  if (!canSeedCapa) console.warn("  (CAPA source masters missing — skipping CAPA seed)");

  const safeDelete = async (label: string, fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e) { console.warn(`  (skip ${label}: ${(e as Error).message})`); }
  };
  await safeDelete("camsFinding", () => prisma.camsFinding.deleteMany({ where: { findingCode: { startsWith: "MAG-FND-" } } }));
  await safeDelete("camsEngagement", () => prisma.camsEngagement.deleteMany({ where: { engagementCode: { startsWith: "MAG-AUD-" } } }));
  await safeDelete("capa", () => prisma.capa.deleteMany({ where: { capaNumber: { startsWith: "CAPA-MAG-" } } }));
  await safeDelete("legalObligation", () => prisma.legalObligation.deleteMany({ where: { obligationCode: { startsWith: "MAG-OBL-" } } }));
  await safeDelete("incident", () => prisma.incident.deleteMany({ where: { number: { startsWith: "INC-MAG-" } } }));

  let nE = 0, nF = 0, nC = 0, nO = 0, nI = 0;
  for (const s of SITES) {
    const plant = await prisma.plant.findUnique({ where: { code: s.plantCode } });
    if (!plant) { console.warn(`  (plant ${s.plantCode} not found)`); continue; }
    const siteId = plant.id;

    const eng = await prisma.camsEngagement.create({
      data: {
        engagementCode: `MAG-AUD-${s.plantCode}-01`,
        title: `Internal HSE & Social Compliance Audit — ${s.plantCode} FY27`,
        engagementType: "COMPLIANCE_AUDIT",
        standardRefs: ["ISO_45001", "SA8000"],
        siteId,
        scopeStatement: `Integrated audit at ${s.plantCode}.`,
        leadAuditorId: owner.id,
        auditTeamIds: [],
        plannedDate: daysAgo(60),
        conductedDate: daysAgo(58),
        status: "CLOSED",
        scorePercent: s.score,
        overallResult: overallResult(s.score),
        createdBy: owner.id,
      },
    });
    nE++;
    let fi = 1;
    for (const f of findingsFor(s.score, s.etp)) {
      await prisma.camsFinding.create({ data: { findingCode: `MAG-FND-${s.plantCode}-${String(fi++).padStart(2, "0")}`, engagementId: eng.id, title: f.title, description: f.title, severity: f.sev, status: f.status, siteId, ownerId: owner.id, dueDate: f.status === "OPEN" ? daysFromNow(21) : null, createdBy: owner.id } });
      nF++;
    }
    if (canSeedCapa) {
      let ci = 1;
      for (const c of capasFor(s.score, s.etp)) {
        await prisma.capa.create({ data: { capaNumber: `CAPA-MAG-${s.plantCode}-${String(ci++).padStart(2, "0")}`, title: c.title, plantId: siteId, sourceCategoryId: capaCat!.id, sourceTypeId: capaType!.id, sourceTypeCode: capaType!.code, problemDescription: c.title, detectedAt: daysAgo(45), detectedByUserId: owner.id, primaryCategory: "Audit Finding", severity: c.severity, priority: c.severity === "CRITICAL" ? "URGENT" : c.severity === "HIGH" ? "HIGH" : "MODERATE", state: c.state, closureTargetDate: c.overdue ? daysAgo(10) : daysFromNow(30), closedAt: c.state === "CLOSED" ? daysAgo(5) : null, raisedByUserId: owner.id, primaryOwnerUserId: owner.id, createdByUserId: owner.id } });
        nC++;
      }
    }
    let oi = 1;
    for (const ob of oblsFor(s.score, s.etp)) {
      await prisma.legalObligation.create({ data: { obligationCode: `MAG-OBL-${s.plantCode}-${String(oi++).padStart(2, "0")}`, title: ob.title, obligationType: ob.type, statuteReference: "Factories Act 1948 / SPCB consent conditions", regulatorName: ob.type === "CONSENT" ? "State Pollution Control Board" : "Directorate of Factories", siteId, ownerId: owner.id, frequency: "ANNUAL", validFrom: daysAgo(330), validUntil: ob.validUntil, status: ob.status, isActive: true, createdBy: owner.id } });
      nO++;
    }
    let ii = 1;
    for (const inc of incsFor(s.score)) {
      await prisma.incident.create({ data: { number: `INC-MAG-${s.plantCode}-${String(ii++).padStart(2, "0")}`, date: daysAgo(inc.days), type: inc.type as any, plantId: siteId, location: s.plantCode, reporterId: owner.id, description: inc.desc, status: "REPORTED" as any } });
      nI++;
    }
  }
  console.log(`  CAMS engagements: ${nE}, findings: ${nF}; CAPAs: ${nC}; obligations: ${nO}; incidents: ${nI}`);
  console.log("✅  Facilities operational seed complete (16 sites). Recompute snapshots to populate the dashboard.");
}

main()
  .catch((e) => { console.error("❌  Facilities ops seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
