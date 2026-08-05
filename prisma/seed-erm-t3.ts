// ────────────────────────────────────────────────────────────────────────
// Seed — ERM Tier 3 — Internal Controls · Vendor/ESG Risk · Insurance & Transfer
//
// Depends on Phase 1 (risks ERM-2026-0001..0024), Phase 3 (BP processes), Phase 2
// (OBL obligations, LE loss events) + the ERM personas. Additive; idempotent.
//
// Engineered facts (asserted at end):
//   • 22 controls (16 key); operating ratings 14 EFFECTIVE + 2 DEFICIENT
//   • 1 SIGNIFICANT_DEFICIENCY (IT access) + 1 MATERIAL_WEAKNESS (hedging, unreported)
//   • risk 0011 has NO primary control; ≥1 orphan control
//   • 3 overdue key-control tests
//   • 16 vendors dual-lens; ~9% spend with LAGGING ESG; 1 CRITICAL_GAP→CONDITIONAL
//   • 11 policies (Cyber EXPIRING_SOON, 1 LAPSED); 4 claims (1 SETTLED reconciled)
//   • coverage gap FY27: 3 of 11 critical risks not fully transferred
//   • CAPA sources CONTROL_DEFICIENCY + VENDOR_RISK (→ eight total)
//   • personas Ravi Menon (Controls Tester), Sneha Kulkarni (Vendor Risk Mgr),
//     Aditya Bose (Insurance Mgr)
//
//   npx tsx prisma/seed-erm-t3.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_PASSWORD } from "./demo-users-config";

const prisma = new PrismaClient();
const NOW = new Date("2026-06-15T00:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 864e5);
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 864e5);
const L = 100000, CR = 10000000;

async function main() {
  console.log("Seeding ERM Tier 3 (Controls · Vendor · Insurance)…");
  const nw = await prisma.plant.findFirst({ where: { code: "NW" } });
  const sw = await prisma.plant.findFirst({ where: { code: "SW" } });
  if (!nw || !sw) throw new Error("NW/SW plants not found — run base seed first");

  // ── resolve risks / processes / obligations / loss events / users ──────────
  const riskRows = await prisma.enterpriseRisk.findMany({ where: { riskCode: { startsWith: "ERM-2026-" } }, select: { id: true, riskCode: true, residualBand: true } });
  const ridByShort = new Map(riskRows.map((r) => [r.riskCode.replace("ERM-2026-", ""), r.id]));
  const rid = (s: string) => ridByShort.get(s) ?? null;
  const procRows = await prisma.businessProcess.findMany({ select: { id: true, processCode: true } });
  const pidByCode = new Map(procRows.map((p) => [p.processCode, p.id]));
  const oblRows = await prisma.legalObligation.findMany({ select: { id: true, obligationCode: true } });
  const oblByCode = new Map(oblRows.map((o) => [o.obligationCode, o.id]));
  const lossRows = await prisma.lossEvent.findMany({ select: { id: true, eventCode: true, grossLossInr: true } });
  const lossByCode = new Map(lossRows.map((l) => [l.eventCode, l]));

  const emails = ["anand.krishnan", "rajesh.nair", "kavita.rao", "meera.iyer", "suresh.patel", "lakshmi.venkatesh", "devendra.kulkarni", "nandini.subramaniam"].map((e) => `${e}@safeops360.in`);
  const userRows = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } });
  const uid = (e: string) => { const u = userRows.find((x) => x.email === `${e}@safeops360.in`); if (!u) throw new Error(`user ${e} missing`); return u.id; };
  const anand = uid("anand.krishnan"), rajesh = uid("rajesh.nair"), kavita = uid("kavita.rao"), meera = uid("meera.iyer"), suresh = uid("suresh.patel"), lakshmi = uid("lakshmi.venkatesh"), devendra = uid("devendra.kulkarni"), nandini = uid("nandini.subramaniam");

  // ── personas ───────────────────────────────────────────────────────────────
  const pw = await bcrypt.hash(DEMO_PASSWORD, 10);
  const persona = async (email: string, name: string, role: string, designation: string, plantId: string) => {
    const u = await prisma.user.upsert({ where: { email }, update: { name, role, designation, plantId, passwordHash: pw }, create: { email, name, role, designation, plantId, passwordHash: pw } });
    const r = await prisma.role.findUnique({ where: { code: role } });
    if (r) { const ex = await prisma.userRole.findFirst({ where: { userId: u.id, roleId: r.id } }); if (!ex) await prisma.userRole.create({ data: { userId: u.id, roleId: r.id, scopeType: "ALL_PLANTS", scopeValue: null } }); }
    return u.id;
  };
  const ravi = await persona("ravi.menon@safeops360.in", "Ravi Menon", "CONTROLS_TESTER", "Internal Audit — Controls Tester", nw.id);
  const sneha = await persona("sneha.kulkarni@safeops360.in", "Sneha Kulkarni", "VENDOR_RISK_MANAGER", "Vendor Risk Manager (Corporate)", nw.id);
  const aditya = await persona("aditya.bose@safeops360.in", "Aditya Bose", "INSURANCE_MANAGER", "Insurance & Risk Transfer Manager", nw.id);
  console.log("  personas: Ravi Menon · Sneha Kulkarni · Aditya Bose");

  // ── idempotent wipe (children → parents) ────────────────────────────────────
  const wipe = async (label: string, fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { console.warn(`  (skip ${label}: ${(e as Error).message})`); } };
  await wipe("controlTest", () => prisma.controlTest.deleteMany({}));
  await wipe("controlTestPlan", () => prisma.controlTestPlan.deleteMany({}));
  await wipe("controlDeficiency", () => prisma.controlDeficiency.deleteMany({}));
  await wipe("riskControlMapping", () => prisma.riskControlMapping.deleteMany({}));
  await wipe("control", () => prisma.control.deleteMany({}));
  await wipe("vendorAssessment", () => prisma.vendorAssessment.deleteMany({}));
  await wipe("vendorProfile", () => prisma.vendorProfile.deleteMany({}));
  await wipe("vendorScoringConfig", () => prisma.vendorScoringConfig.deleteMany({}));
  await wipe("insuranceClaim", () => prisma.insuranceClaim.deleteMany({}));
  await wipe("insurancePolicy", () => prisma.insurancePolicy.deleteMany({}));
  await wipe("coverageGapAssessment", () => prisma.coverageGapAssessment.deleteMany({}));
  await wipe("capa(CONTROL_DEFICIENCY)", () => prisma.capa.deleteMany({ where: { sourceTypeCode: "CONTROL_DEFICIENCY" } }));
  await wipe("capa(VENDOR_RISK)", () => prisma.capa.deleteMany({ where: { sourceTypeCode: "VENDOR_RISK" } }));

  // ── CAPA source extensions (7th + 8th) ──────────────────────────────────────
  const capaSource = async (code: string, name: string, prefix: string, sortOrder: number, parentModule: string) => {
    const cat = await prisma.capaSourceCategory.upsert({ where: { code }, update: { name, prefix, sortOrder, isActive: true }, create: { code, name, description: `${name} CAPAs`, prefix, sortOrder, isActive: true } });
    const type = await prisma.capaSourceType.upsert({ where: { code }, update: { name, categoryId: cat.id, parentModuleLive: true, parentModuleName: parentModule, isActive: true, sortOrder: 1 }, create: { code, name, categoryId: cat.id, parentModuleLive: true, parentModuleName: parentModule, isActive: true, sortOrder: 1 } });
    return { cat, type };
  };
  const ctd = await capaSource("CONTROL_DEFICIENCY", "Control Deficiency", "CTD", 97, "Internal Controls");
  const vdr = await capaSource("VENDOR_RISK", "Vendor Risk", "VDR", 98, "Vendor Risk");
  console.log("  CAPA sources: CONTROL_DEFICIENCY + VENDOR_RISK");

  const mkCapa = async (src: { cat: any; type: any }, plantId: string, num: number, o: { title: string; problem: string; refId: string; refUrl: string; refSummary: string; meta: any; severity: string; detectMethod: string; detectedBy: string; owner: string; raisedBy: string; plantCode: string }) => {
    return prisma.capa.create({ data: {
      capaNumber: `CAPA-${src.cat.prefix}-2026-${o.plantCode}-${String(num).padStart(3, "0")}`, title: o.title, plantId,
      sourceCategoryId: src.cat.id, sourceTypeId: src.type.id, sourceTypeCode: src.type.code, sourceReferenceId: o.refId,
      sourceReferenceUrl: o.refUrl, sourceReferenceSummary: o.refSummary, sourceMetadata: o.meta as any, problemDescription: o.problem,
      detectionMethod: o.detectMethod, detectedAt: daysAgo(40), detectedByUserId: o.detectedBy, primaryCategory: src.cat.name,
      severity: o.severity, priority: "HIGH", state: "ACTIONS_PLANNED", stateChangedAt: daysAgo(38), closureTargetDate: daysFromNow(60),
      raisedByUserId: o.raisedBy, primaryOwnerUserId: o.owner, createdByUserId: o.raisedBy,
    } });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 1. CONTROLS (22) + mappings + test plans + tests + deficiencies
  // ════════════════════════════════════════════════════════════════════════════
  type Map1 = { risk?: string; process?: string; obl?: string; strength: "PRIMARY" | "SECONDARY" | "COMPENSATING" };
  type Ctl = {
    name: string; type: string; nature: string; freq: string; cat: string; owner: string; site: string | null; key: boolean;
    design: string; operating: string; overdue?: boolean; orphan?: boolean; maps: Map1[];
    deficiency?: { severity: "SIGNIFICANT_DEFICIENCY" | "MATERIAL_WEAKNESS"; desc: string; reported?: boolean };
    assertions?: string[];
  };
  const CTLS: Ctl[] = [
    { name: "Three-way match on vendor invoices", type: "PREVENTIVE", nature: "AUTOMATED", freq: "CONTINUOUS", cat: "FINANCIAL_REPORTING", owner: rajesh, site: null, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", assertions: ["Completeness", "Accuracy", "Existence"], maps: [{ risk: "0006", strength: "PRIMARY" }] },
    { name: "Vendor master change approval", type: "PREVENTIVE", nature: "IT_DEPENDENT_MANUAL", freq: "EVENT_DRIVEN", cat: "FINANCIAL_REPORTING", owner: rajesh, site: null, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", assertions: ["Existence", "Accuracy"], maps: [{ risk: "0022", strength: "SECONDARY" }] },
    { name: "Monthly bank reconciliation", type: "DETECTIVE", nature: "MANUAL", freq: "MONTHLY", cat: "FINANCIAL_REPORTING", owner: rajesh, site: null, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", assertions: ["Completeness", "Accuracy"], maps: [{ risk: "0006", strength: "SECONDARY" }] },
    { name: "GST input-credit reconciliation", type: "DETECTIVE", nature: "IT_DEPENDENT_MANUAL", freq: "MONTHLY", cat: "COMPLIANCE", owner: nandini, site: null, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", maps: [{ obl: "OBL-0024", strength: "PRIMARY" }] },
    { name: "Fixed-asset physical verification", type: "DETECTIVE", nature: "MANUAL", freq: "ANNUAL", cat: "FINANCIAL_REPORTING", owner: rajesh, site: null, key: false, design: "EFFECTIVE", operating: "NOT_ASSESSED", maps: [] },
    { name: "Permit-to-work authorisation control", type: "PREVENTIVE", nature: "MANUAL", freq: "EVENT_DRIVEN", cat: "OPERATIONAL", owner: devendra, site: nw.id, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", maps: [{ risk: "0008", strength: "PRIMARY" }] },
    { name: "Competency gate before safety-critical task", type: "PREVENTIVE", nature: "IT_DEPENDENT_MANUAL", freq: "EVENT_DRIVEN", cat: "OPERATIONAL", owner: suresh, site: null, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", maps: [{ risk: "0023", strength: "PRIMARY" }] },
    { name: "ETP daily effluent monitoring", type: "DETECTIVE", nature: "MANUAL", freq: "DAILY", cat: "COMPLIANCE", owner: lakshmi, site: sw.id, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", overdue: true, maps: [{ risk: "0015", strength: "PRIMARY" }, { risk: "0005", strength: "SECONDARY" }] },
    { name: "MOC approval before process change", type: "PREVENTIVE", nature: "MANUAL", freq: "EVENT_DRIVEN", cat: "OPERATIONAL", owner: devendra, site: nw.id, key: false, design: "EFFECTIVE", operating: "EFFECTIVE", maps: [{ process: "BP-0001", strength: "SECONDARY" }] },
    { name: "Segregation of duties in payments", type: "PREVENTIVE", nature: "IT_DEPENDENT_MANUAL", freq: "CONTINUOUS", cat: "FINANCIAL_REPORTING", owner: rajesh, site: null, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", assertions: ["Existence", "Accuracy"], maps: [{ risk: "0006", strength: "SECONDARY" }] },
    { name: "IT access provisioning & review", type: "PREVENTIVE", nature: "IT_DEPENDENT_MANUAL", freq: "QUARTERLY", cat: "IT_GENERAL", owner: kavita, site: null, key: true, design: "DEFICIENT", operating: "DEFICIENT", maps: [{ risk: "0018", strength: "PRIMARY" }], deficiency: { severity: "SIGNIFICANT_DEFICIENCY", desc: "Quarterly user-access recertification was not completed for two OT-admin groups; three terminated-user accounts remained active beyond policy. IT general control over access provisioning is operating deficiently." } },
    { name: "Patch management — critical systems", type: "CORRECTIVE", nature: "AUTOMATED", freq: "MONTHLY", cat: "IT_GENERAL", owner: kavita, site: null, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", maps: [{ risk: "0019", strength: "PRIMARY" }] },
    { name: "Backup verification & restore test", type: "DETECTIVE", nature: "AUTOMATED", freq: "WEEKLY", cat: "IT_GENERAL", owner: kavita, site: null, key: false, design: "EFFECTIVE", operating: "EFFECTIVE", orphan: true, maps: [] },
    { name: "Customer credit-limit control", type: "PREVENTIVE", nature: "IT_DEPENDENT_MANUAL", freq: "CONTINUOUS", cat: "FINANCIAL_REPORTING", owner: rajesh, site: null, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", overdue: true, maps: [{ risk: "0005", strength: "PRIMARY" }] },
    { name: "Hedging policy adherence", type: "PREVENTIVE", nature: "MANUAL", freq: "MONTHLY", cat: "FINANCIAL_REPORTING", owner: rajesh, site: null, key: true, design: "DEFICIENT", operating: "DEFICIENT", maps: [{ risk: "0004", strength: "PRIMARY" }], deficiency: { severity: "MATERIAL_WEAKNESS", desc: "Forex hedging executed outside the board-approved policy band for two consecutive months without Treasury Committee ratification; unhedged exposure exceeded the policy ceiling. A material weakness in the financial control over forex risk.", reported: false } },
    { name: "Single-source review board", type: "DIRECTIVE", nature: "MANUAL", freq: "QUARTERLY", cat: "OPERATIONAL", owner: meera, site: null, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", maps: [{ risk: "0022", strength: "PRIMARY" }] },
    { name: "Quality release sign-off", type: "PREVENTIVE", nature: "MANUAL", freq: "EVENT_DRIVEN", cat: "OPERATIONAL", owner: suresh, site: nw.id, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", maps: [{ risk: "0012", strength: "PRIMARY" }, { process: "BP-0004", strength: "SECONDARY" }] },
    { name: "BRSR data validation control", type: "DETECTIVE", nature: "IT_DEPENDENT_MANUAL", freq: "ANNUAL", cat: "COMPLIANCE", owner: nandini, site: null, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", overdue: true, maps: [{ risk: "0020", strength: "PRIMARY" }, { obl: "OBL-0021", strength: "SECONDARY" }] },
    { name: "Boiler statutory inspection control", type: "DETECTIVE", nature: "MANUAL", freq: "ANNUAL", cat: "COMPLIANCE", owner: lakshmi, site: sw.id, key: false, design: "EFFECTIVE", operating: "EFFECTIVE", maps: [{ obl: "OBL-0006", strength: "PRIMARY" }] },
    { name: "Contractor statutory-register check", type: "DETECTIVE", nature: "MANUAL", freq: "MONTHLY", cat: "COMPLIANCE", owner: nandini, site: null, key: false, design: "EFFECTIVE", operating: "EFFECTIVE", maps: [{ risk: "0013", strength: "SECONDARY" }] },
    { name: "Board-level risk appetite monitoring", type: "DIRECTIVE", nature: "MANUAL", freq: "QUARTERLY", cat: "ENTITY_LEVEL", owner: anand, site: null, key: true, design: "EFFECTIVE", operating: "EFFECTIVE", maps: [{ risk: "0001", strength: "PRIMARY" }] },
    { name: "Whistleblower / ethics hotline", type: "DETECTIVE", nature: "MANUAL", freq: "CONTINUOUS", cat: "ENTITY_LEVEL", owner: anand, site: null, key: false, design: "EFFECTIVE", operating: "EFFECTIVE", maps: [{ risk: "0014", strength: "SECONDARY" }] },
  ];

  let ctlCount = 0, mapCount = 0, planCount = 0, testCount = 0, defCount = 0, ctlCapaCount = 0;
  const overdueKey: string[] = [];
  for (let i = 0; i < CTLS.length; i++) {
    const k = CTLS[i];
    const code = `CTL-${String(i + 1).padStart(4, "0")}`;
    const lastTest = k.operating === "NOT_ASSESSED" ? null : daysAgo(k.overdue ? 200 : 60);
    const nextDue = k.key ? (k.overdue ? daysAgo(20) : daysFromNow(120)) : null;
    const c = await prisma.control.create({ data: {
      controlCode: code, name: k.name, description: `${k.name} — operates ${k.freq.toLowerCase()} as a ${k.type.toLowerCase()} ${k.nature.toLowerCase()} control.`,
      controlType: k.type, nature: k.nature, frequency: k.freq, category: k.cat, controlOwnerId: k.owner, siteId: k.site,
      isKeyControl: k.key, assertions: (k.assertions ?? []) as any, controlDesignNotes: "Design assessed against the stated objective; walkthrough performed.",
      currentDesignRating: k.design, currentOperatingRating: k.operating, lastTestDate: lastTest, nextTestDueDate: nextDue, createdBy: ravi,
    } });
    ctlCount++;
    if (k.key && k.overdue) overdueKey.push(code);
    for (const m of k.maps) {
      const target = m.risk ? { riskId: rid(m.risk) } : m.process ? { processId: pidByCode.get(m.process) ?? null } : { obligationId: oblByCode.get(m.obl!) ?? null };
      if (Object.values(target)[0] == null) continue;
      await prisma.riskControlMapping.create({ data: { controlId: c.id, ...target, mitigationStrength: m.strength, coverageNotes: `${k.name} mitigates this exposure.`, createdBy: ravi } });
      mapCount++;
    }
    if (!k.orphan && k.key) {
      // FY27 test plan + DESIGN + OPERATING test (tester = Ravi, never the owner)
      await prisma.controlTestPlan.create({ data: { controlId: c.id, testCycleLabel: "FY27", testMethod: "REPERFORMANCE", sampleSizePlanned: 25, testFrequencyPerYear: k.freq === "ANNUAL" ? 1 : 2, assignedTesterId: ravi, scheduledDate: daysAgo(70), createdBy: ravi } });
      planCount++;
      await prisma.controlTest.create({ data: { controlId: c.id, testType: "DESIGN", testDate: daysAgo(75), testerId: ravi, method: "INSPECTION", sampleSize: 1, exceptionsFound: 0, conclusion: k.design === "DEFICIENT" ? "DEFICIENT" : "EFFECTIVE", workpaperNotes: "Design walkthrough: control objective, owner, frequency and evidence trail confirmed against the process narrative.", evidenceAttachmentIds: [] as any, createdBy: ravi } });
      testCount++;
      const opConclusion = k.deficiency ? k.deficiency.severity : (k.operating === "DEFICIENT" ? "DEFICIENT" : "EFFECTIVE");
      const opTest = await prisma.controlTest.create({ data: { controlId: c.id, testType: "OPERATING", testDate: lastTest ?? daysAgo(60), testerId: ravi, method: "REPERFORMANCE", sampleSize: 25, exceptionsFound: k.deficiency ? 4 : 0, conclusion: opConclusion, workpaperNotes: k.deficiency ? `Sample of 25 reperformed; ${k.deficiency.severity === "MATERIAL_WEAKNESS" ? "pervasive" : "isolated"} exceptions noted. ${k.deficiency.desc}` : "Sample of 25 reperformed; no exceptions. Control operating effectively over the period.", evidenceAttachmentIds: [] as any, createdBy: ravi } });
      testCount++;
      if (k.deficiency) {
        const def = await prisma.controlDeficiency.create({ data: {
          deficiencyCode: `DEF-2026-${String(defCount + 1).padStart(4, "0")}`, controlId: c.id, sourceTestId: opTest.id, severity: k.deficiency.severity,
          description: k.deficiency.desc, rootCause: k.deficiency.severity === "MATERIAL_WEAKNESS" ? "Policy-band breach not escalated; compensating monitoring absent." : "Recertification workflow lapsed during a team transition.",
          status: "REMEDIATION_ACTIVE", identifiedRiskImpact: `Relates to ${k.maps[0]?.risk ? `ERM-2026-${k.maps[0].risk}` : "the linked register risk"}.`,
          reportedToAuditCommittee: k.deficiency.reported ?? false, createdBy: ravi,
        } });
        defCount++;
        const plantCode = k.site === sw.id ? "SW" : "NW";
        const capa = await mkCapa(ctd, k.site ?? nw.id, ctlCapaCount + 1, {
          title: `Remediate control deficiency: ${k.name}`, problem: k.deficiency.desc, refId: def.id, refUrl: "/erm/controls/deficiencies",
          refSummary: `${def.deficiencyCode} — ${code}`, meta: { deficiencyCode: def.deficiencyCode, severity: k.deficiency.severity },
          severity: k.deficiency.severity === "MATERIAL_WEAKNESS" ? "HIGH" : "MODERATE", detectMethod: "CONTROL_TEST", detectedBy: ravi, owner: k.owner, raisedBy: ravi, plantCode,
        });
        ctlCapaCount++;
        await prisma.controlDeficiency.update({ where: { id: def.id }, data: { remediationCapaId: capa.id } });
      }
    }
  }
  console.log(`  controls: ${ctlCount} | mappings: ${mapCount} | plans: ${planCount} | tests: ${testCount} | deficiencies: ${defCount} | control CAPAs: ${ctlCapaCount}`);

  // ════════════════════════════════════════════════════════════════════════════
  // 2. VENDOR SCORING CONFIGS + 16 VENDORS (dual-lens)
  // ════════════════════════════════════════════════════════════════════════════
  const RISK_DOMAINS = [
    { domainKey: "financial_stability", label: "Financial Stability", weightPct: 25, guidance: "Solvency, liquidity, audited results" },
    { domainKey: "operational_capacity", label: "Operational Capacity & Quality", weightPct: 20, guidance: "Capacity, quality systems, track record" },
    { domainKey: "delivery_reliability", label: "Delivery / Logistics Reliability", weightPct: 15, guidance: "OTIF, logistics resilience" },
    { domainKey: "compliance_legal", label: "Compliance & Legal Standing", weightPct: 15, guidance: "Licences, litigation, statutory" },
    { domainKey: "cyber_infosec", label: "Cyber / Information Security", weightPct: 10, guidance: "ISMS, data handling" },
    { domainKey: "concentration_dependency", label: "Concentration / Single-Source Dependency", weightPct: 15, guidance: "Substitutability, our dependency" },
  ];
  const ESG_DOMAINS = [
    { domainKey: "environmental", label: "Environmental", weightPct: 30, guidance: "Emissions, water, waste" },
    { domainKey: "social", label: "Social", weightPct: 30, guidance: "Labour, H&S, human rights, contract-labour welfare" },
    { domainKey: "governance", label: "Governance", weightPct: 20, guidance: "Ethics, anti-bribery, board" },
    { domainKey: "disclosure_certifications", label: "Disclosure & Certifications", weightPct: 10, guidance: "ISO 14001/45001, BRSR alignment" },
    { domainKey: "climate_resource", label: "Climate & Resource", weightPct: 10, guidance: "Climate exposure, resource stewardship" },
  ];
  const RISK_BANDS = [{ band: "LOW", minScore: 0, maxScore: 25, colorHex: "#2E8B57" }, { band: "MEDIUM", minScore: 25.0001, maxScore: 50, colorHex: "#E6A817" }, { band: "HIGH", minScore: 50.0001, maxScore: 75, colorHex: "#E67E22" }, { band: "CRITICAL", minScore: 75.0001, maxScore: 100, colorHex: "#C0392B" }];
  const ESG_BANDS = [{ band: "LAGGING", minScore: 0, maxScore: 39.9999, colorHex: "#C0392B" }, { band: "DEVELOPING", minScore: 40, maxScore: 59.9999, colorHex: "#E6A817" }, { band: "ADEQUATE", minScore: 60, maxScore: 79.9999, colorHex: "#7CB342" }, { band: "LEADING", minScore: 80, maxScore: 100, colorHex: "#2E8B57" }];
  await prisma.vendorScoringConfig.upsert({ where: { lens: "RISK" }, update: { domains: RISK_DOMAINS as any, bandThresholds: RISK_BANDS as any }, create: { lens: "RISK", domains: RISK_DOMAINS as any, bandThresholds: RISK_BANDS as any, createdBy: sneha } });
  await prisma.vendorScoringConfig.upsert({ where: { lens: "ESG" }, update: { domains: ESG_DOMAINS as any, bandThresholds: ESG_BANDS as any }, create: { lens: "ESG", domains: ESG_DOMAINS as any, bandThresholds: ESG_BANDS as any, createdBy: sneha } });

  const wScore = (ds: { rawScore: number; weightPct: number }[]) => Math.round((ds.reduce((s, d) => s + d.rawScore * d.weightPct, 0) / 5) * 10) / 10;
  const bandOf = (thr: { band: string; minScore: number; maxScore: number }[], score: number) => (thr.find((b) => score >= b.minScore && score <= b.maxScore)?.band ?? thr[thr.length - 1].band);
  const mkDomainScores = (domains: typeof RISK_DOMAINS, raws: number[]) => domains.map((d, i) => ({ domainKey: d.domainKey, rawScore: raws[i], weightPct: d.weightPct, evidenceNotes: "" }));

  type VSpec = {
    code: string; legalName: string; category: string; criticality: string; tier: string; site: string | null; owner: string; spend: number;
    single?: boolean; status: string; riskRaws?: number[]; esgRaws?: number[]; links?: string[]; procs?: string[];
    criticalGap?: { lens: "RISK" | "ESG"; desc: string }; lagFinding?: string;
  };
  // Spends tuned so the LAGGING-ESG vendor (contract labour) ≈ 9% of total spend.
  const VENDORS: VSpec[] = [
    { code: "VEN-0001", legalName: "PolyChem Speciality Resins Pvt Ltd", category: "Speciality polymers", criticality: "STRATEGIC", tier: "TIER_1", site: sw.id, owner: meera, spend: 42 * CR, single: true, status: "CONDITIONAL", riskRaws: [3, 3, 3, 3, 4, 5], esgRaws: [3, 2, 3, 2, 2], links: ["0022"], procs: ["BP-0007"], criticalGap: { lens: "RISK", desc: "No disaster-recovery / alternate production site; a force-majeure event would halt the only qualified supply of speciality resin with no fallback." } },
    { code: "VEN-0002", legalName: "TransBharat Logistics Ltd", category: "Logistics", criticality: "CRITICAL", tier: "TIER_1", site: null, owner: meera, spend: 18 * CR, status: "APPROVED", riskRaws: [2, 3, 3, 2, 2, 3], esgRaws: [3, 3, 3, 3, 3], links: ["0012"], procs: ["BP-0003"] },
    { code: "VEN-0003", legalName: "Sahyadri Contract Labour Services", category: "Contract labour", criticality: "CRITICAL", tier: "TIER_2", site: sw.id, owner: lakshmi, spend: 12 * CR, status: "APPROVED", riskRaws: [3, 3, 3, 4, 2, 3], esgRaws: [2, 1, 2, 1, 2], links: ["0013"], lagFinding: "Contract-labour welfare gaps: ESI/PF coverage lag, inadequate site amenities, and incomplete statutory registers identified in the social-domain assessment." },
    { code: "VEN-0004", legalName: "IndoSteel Metals & Alloys Ltd", category: "Raw material", criticality: "CRITICAL", tier: "TIER_1", site: null, owner: meera, spend: 16 * CR, status: "APPROVED", riskRaws: [2, 3, 3, 2, 2, 3], esgRaws: [3, 3, 3, 3, 3], links: ["0006"] },
    { code: "VEN-0005", legalName: "GridPower O&M Contractors", category: "Utilities", criticality: "IMPORTANT", tier: "TIER_2", site: nw.id, owner: devendra, spend: 4 * CR, status: "APPROVED", riskRaws: [1, 2, 2, 2, 2, 2], esgRaws: [2, 3, 3, 2, 2] },
    { code: "VEN-0006", legalName: "Nimbus Managed IT Services Pvt Ltd", category: "IT services", criticality: "CRITICAL", tier: "TIER_2", site: null, owner: kavita, spend: 6 * CR, status: "APPROVED", riskRaws: [2, 3, 3, 3, 2, 3], esgRaws: [3, 3, 3, 3, 3], links: ["0018", "0019"] },
    { code: "VEN-0007", legalName: "Apex Packaging Industries", category: "Packaging", criticality: "IMPORTANT", tier: "TIER_3", site: null, owner: meera, spend: 3 * CR, status: "APPROVED", riskRaws: [1, 2, 2, 2, 1, 2], esgRaws: [3, 3, 3, 3, 3] },
    { code: "VEN-0008", legalName: "EnviroCare ETP Operations", category: "Environmental", criticality: "CRITICAL", tier: "TIER_2", site: sw.id, owner: lakshmi, spend: 5 * CR, status: "APPROVED", riskRaws: [2, 3, 2, 3, 2, 3], esgRaws: [3, 3, 2, 2, 3], links: ["0015"], procs: ["BP-0008"] },
    { code: "VEN-0009", legalName: "Crown Industrial Consumables", category: "Consumables", criticality: "ROUTINE", tier: "TIER_3", site: null, owner: meera, spend: 1.2 * CR, status: "APPROVED", riskRaws: [1, 2, 2, 1, 1, 1] },
    { code: "VEN-0010", legalName: "Meridian Calibration Labs", category: "Calibration", criticality: "ROUTINE", tier: "TIER_3", site: null, owner: suresh, spend: 0.8 * CR, status: "APPROVED", riskRaws: [1, 2, 1, 2, 1, 1] },
    { code: "VEN-0011", legalName: "SafeGuard Security Services", category: "Security", criticality: "IMPORTANT", tier: "TIER_3", site: null, owner: devendra, spend: 2.5 * CR, status: "APPROVED", riskRaws: [2, 2, 2, 2, 2, 2] },
    { code: "VEN-0012", legalName: "Orchid Facility Management", category: "Facility", criticality: "ROUTINE", tier: "TIER_3", site: null, owner: devendra, spend: 1.5 * CR, status: "APPROVED", riskRaws: [1, 2, 2, 2, 1, 1] },
    { code: "VEN-0013", legalName: "BlueOak Industrial Spares", category: "Spares", criticality: "IMPORTANT", tier: "TIER_2", site: null, owner: devendra, spend: 3.5 * CR, status: "APPROVED", riskRaws: [2, 3, 3, 2, 2, 3] },
    { code: "VEN-0014", legalName: "Vertex Engineering Services", category: "Engineering", criticality: "IMPORTANT", tier: "TIER_2", site: nw.id, owner: devendra, spend: 2.2 * CR, status: "DUE_DILIGENCE", riskRaws: [2, 3, 2, 2, 2, 2] },
    { code: "VEN-0015", legalName: "GreenLeaf Sustainability Advisors", category: "Advisory", criticality: "ROUTINE", tier: "TIER_3", site: null, owner: nandini, spend: 0.6 * CR, status: "DUE_DILIGENCE", riskRaws: [1, 2, 2, 1, 2, 1] },
    { code: "VEN-0016", legalName: "Legacy Transport Co (offboarded)", category: "Logistics", criticality: "ROUTINE", tier: "TIER_3", site: null, owner: meera, spend: 0, status: "OFFBOARDED", riskRaws: [3, 3, 4, 3, 2, 3] },
  ];

  let venCount = 0, assessCount = 0, venCapaCount = 0;
  for (const v of VENDORS) {
    const profile = await prisma.vendorProfile.create({ data: {
      vendorCode: v.code, legalName: v.legalName, category: v.category, criticality: v.criticality, tier: v.tier,
      siteScope: (v.site ? [v.site] : []) as any, relationshipOwnerId: v.owner, annualSpendInr: v.spend, isSingleSource: v.single ?? false,
      linkedProcessIds: (v.procs?.map((p) => pidByCode.get(p)).filter(Boolean) ?? []) as any, linkedRiskIds: (v.links?.map((r) => rid(r)).filter(Boolean) ?? []) as any,
      onboardingStatus: v.status, isActive: v.status !== "OFFBOARDED", createdBy: sneha,
    } });
    venCount++;
    let riskScore: number | null = null, riskBand: string | null = null, esgScore: number | null = null, esgBand: string | null = null;
    const validUntil = daysFromNow(v.criticality === "STRATEGIC" || v.criticality === "CRITICAL" ? 180 : 300);
    // RISK lens (all vendors)
    if (v.riskRaws) {
      const ds = mkDomainScores(RISK_DOMAINS, v.riskRaws);
      riskScore = wScore(ds); riskBand = bandOf(RISK_BANDS, riskScore);
      const findings = v.criticalGap?.lens === "RISK" ? [{ id: `f${assessCount}r`, lens: "RISK", severity: "CRITICAL_GAP", description: v.criticalGap.desc, capaId: null as string | null, targetCloseDate: daysFromNow(90).toISOString() }] : [];
      const a = await prisma.vendorAssessment.create({ data: { vendorId: profile.id, lens: "RISK", assessmentDate: daysAgo(50), assessorId: sneha, method: "DESK_REVIEW", domainScores: ds as any, weightedScore: riskScore, band: riskBand, summaryNotes: `Third-party risk assessment — ${riskBand} composite.`, validUntil, isCurrent: true, findings: findings as any, createdBy: sneha } });
      assessCount++;
      if (findings.length) {
        const capa = await mkCapa(vdr, v.site ?? nw.id, venCapaCount + 1, { title: `Vendor gap (RISK): ${v.legalName}`, problem: v.criticalGap!.desc, refId: findings[0].id, refUrl: `/erm/vendors/${profile.id}`, refSummary: `${v.code} — RISK CRITICAL_GAP`, meta: { vendorCode: v.code, lens: "RISK", assessmentId: a.id, findingId: findings[0].id }, severity: "HIGH", detectMethod: "VENDOR_ASSESSMENT", detectedBy: sneha, owner: v.owner, raisedBy: sneha, plantCode: v.site === sw.id ? "SW" : "NW" });
        venCapaCount++;
        findings[0].capaId = capa.id;
        await prisma.vendorAssessment.update({ where: { id: a.id }, data: { findings: findings as any } });
      }
    }
    // ESG lens (CRITICAL/STRATEGIC only)
    if (v.esgRaws && (v.criticality === "STRATEGIC" || v.criticality === "CRITICAL")) {
      const ds = mkDomainScores(ESG_DOMAINS, v.esgRaws);
      esgScore = wScore(ds); esgBand = bandOf(ESG_BANDS, esgScore);
      const findings = v.lagFinding ? [{ id: `f${assessCount}e`, lens: "ESG", severity: "CONCERN", description: v.lagFinding, capaId: null, targetCloseDate: daysFromNow(120).toISOString() }] : [];
      await prisma.vendorAssessment.create({ data: { vendorId: profile.id, lens: "ESG", assessmentDate: daysAgo(45), assessorId: nandini, method: "ONSITE_AUDIT", domainScores: ds as any, weightedScore: esgScore, band: esgBand, summaryNotes: `ESG posture assessment — ${esgBand} (qualitative; not Scope-3 carbon accounting).`, validUntil, isCurrent: true, findings: findings as any, createdBy: nandini } });
      assessCount++;
    }
    await prisma.vendorProfile.update({ where: { id: profile.id }, data: { currentRiskScore: riskScore, currentRiskBand: riskBand, currentEsgScore: esgScore, currentEsgBand: esgBand, nextReviewDate: validUntil } });
  }
  const activeVendors = VENDORS.filter((v) => v.status !== "OFFBOARDED");
  const totalSpend = activeVendors.reduce((s, v) => s + v.spend, 0);
  const laggingVendor = VENDORS.find((v) => v.code === "VEN-0003")!;
  const laggingPct = Math.round((laggingVendor.spend / totalSpend) * 1000) / 10;
  console.log(`  vendors: ${venCount} | assessments: ${assessCount} | vendor CAPAs: ${venCapaCount} | LAGGING spend ≈ ${laggingPct}%`);

  // ════════════════════════════════════════════════════════════════════════════
  // 3. INSURANCE — 11 policies + 4 claims + coverage gap
  // ════════════════════════════════════════════════════════════════════════════
  type PSpec = { code: string; name: string; type: string; insurer: string; broker?: string; num: string; sites: string[]; sumInsured: number; premium: number; deductible?: number; startDays: number; endDays: number; status?: string; risks?: string[]; procs?: string[]; exclusions?: string[] };
  const POLICIES: PSpec[] = [
    { code: "POL-0001", name: "Industrial All-Risk — North & South Works", type: "PROPERTY_FIRE", insurer: "Bharat General Insurance", broker: "Marsh India", num: "IAR/2026/4471", sites: [nw.id, sw.id], sumInsured: 450 * CR, premium: 1.8 * CR, deductible: 25 * L, startDays: 200, endDays: 165, risks: ["0011"], procs: ["BP-0005"], exclusions: ["War & terrorism (separate add-on)", "Wear and tear"] },
    { code: "POL-0002", name: "Business Interruption Cover", type: "BUSINESS_INTERRUPTION", insurer: "Bharat General Insurance", broker: "Marsh India", num: "BI/2026/4472", sites: [nw.id, sw.id], sumInsured: 120 * CR, premium: 0.9 * CR, deductible: 7 * L, startDays: 200, endDays: 165, risks: ["0011"], procs: ["BP-0002", "BP-0005"] },
    { code: "POL-0003", name: "Marine Transit (Inland)", type: "MARINE_TRANSIT", insurer: "Oceanic Insurance Co", num: "MT/2026/1180", sites: [], sumInsured: 30 * CR, premium: 0.12 * CR, startDays: 150, endDays: 215 },
    { code: "POL-0004", name: "Public Liability — Industrial", type: "LIABILITY_PUBLIC", insurer: "Sentinel Liability Insurers", num: "PL/2026/3321", sites: [nw.id, sw.id], sumInsured: 50 * CR, premium: 0.22 * CR, startDays: 120, endDays: 245, risks: ["0008"] },
    { code: "POL-0005", name: "Product Liability", type: "LIABILITY_PRODUCT", insurer: "Sentinel Liability Insurers", num: "PRL/2026/3322", sites: [], sumInsured: 40 * CR, premium: 0.3 * CR, startDays: 120, endDays: 245, risks: ["0012"] },
    { code: "POL-0006", name: "Directors & Officers Liability", type: "DIRECTORS_OFFICERS", insurer: "Apex Specialty Insurance", broker: "Aon India", num: "DO/2026/0091", sites: [], sumInsured: 75 * CR, premium: 0.45 * CR, startDays: 100, endDays: 265 },
    { code: "POL-0007", name: "Cyber Insurance", type: "CYBER", insurer: "Apex Specialty Insurance", broker: "Aon India", num: "CY/2026/0455", sites: [], sumInsured: 25 * CR, premium: 0.35 * CR, deductible: 50 * L, startDays: 335, endDays: 30, risks: ["0018"], exclusions: ["Unpatched-system events beyond 30 days", "Pre-existing breaches"] },
    { code: "POL-0008", name: "Group Mediclaim", type: "EMPLOYEE_GROUP", insurer: "WellCare Health", num: "GM/2026/7788", sites: [nw.id, sw.id], sumInsured: 20 * CR, premium: 1.1 * CR, startDays: 180, endDays: 185 },
    { code: "POL-0009", name: "Machinery Breakdown", type: "MACHINERY_BREAKDOWN", insurer: "Bharat General Insurance", num: "MB/2026/5512", sites: [nw.id], sumInsured: 60 * CR, premium: 0.4 * CR, deductible: 10 * L, startDays: 160, endDays: 205, risks: ["0011"] },
    { code: "POL-0010", name: "Environmental Liability", type: "ENVIRONMENTAL_LIABILITY", insurer: "Sentinel Liability Insurers", num: "EL/2026/2204", sites: [sw.id], sumInsured: 35 * CR, premium: 0.28 * CR, startDays: 140, endDays: 225, risks: ["0015"] },
    { code: "POL-0011", name: "Marine Cargo (Imports)", type: "MARINE_CARGO", insurer: "Oceanic Insurance Co", num: "MC/2025/9090", sites: [], sumInsured: 15 * CR, premium: 0.08 * CR, startDays: 420, endDays: -40, status: "LAPSED" },
  ];
  let polCount = 0;
  const polIdByCode = new Map<string, string>();
  for (const p of POLICIES) {
    const pol = await prisma.insurancePolicy.create({ data: {
      policyCode: p.code, policyName: p.name, policyType: p.type, insurerName: p.insurer, brokerName: p.broker ?? null, policyNumber: p.num,
      siteScope: p.sites as any, sumInsuredInr: p.sumInsured, premiumAnnualInr: p.premium, deductibleInr: p.deductible ?? null,
      coverageStartDate: daysAgo(p.startDays), coverageEndDate: p.endDays < 0 ? daysAgo(-p.endDays) : daysFromNow(p.endDays), renewalLeadDays: 45,
      status: p.status ?? "ACTIVE", keyExclusions: (p.exclusions ?? []) as any, coveredRiskIds: (p.risks?.map((r) => rid(r)).filter(Boolean) ?? []) as any,
      coveredProcessIds: (p.procs?.map((x) => pidByCode.get(x)).filter(Boolean) ?? []) as any, ownerId: aditya, isActive: p.status !== "LAPSED", createdBy: aditya,
    } });
    polIdByCode.set(p.code, pol.id);
    polCount++;
  }

  // Claims linked to Phase-2 loss events
  type CSpec = { code: string; policy: string; loss?: string; days: number; desc: string; claimed: number; status: string; settled?: number; settleDays?: number };
  const CLAIMS: CSpec[] = [
    { code: "CLM-2026-0001", policy: "POL-0008", loss: "LE-2026-0001", days: 90, desc: "Conveyor entanglement LTI — medical compensation claim under group cover.", claimed: 14 * L, status: "SETTLED", settled: 11 * L, settleDays: 30 },
    { code: "CLM-2026-0002", policy: "POL-0001", loss: "LE-2026-0014", days: 95, desc: "Storm damage to SW warehouse roof — property claim.", claimed: 20 * L, status: "PARTIALLY_SETTLED", settled: 12 * L, settleDays: 40 },
    { code: "CLM-2026-0003", policy: "POL-0009", loss: "LE-2026-0013", days: 48, desc: "Line 3 gearbox failure — machinery breakdown + business interruption claim.", claimed: 62 * L, status: "UNDER_ASSESSMENT" },
    { code: "CLM-2026-0004", policy: "POL-0007", days: 33, desc: "Cyber intrusion containment costs — repudiated (event fell under the unpatched-system exclusion).", claimed: 18 * L, status: "REPUDIATED" },
  ];
  let claimCount = 0;
  for (const c of CLAIMS) {
    const polId = polIdByCode.get(c.policy);
    if (!polId) continue;
    await prisma.insuranceClaim.create({ data: {
      claimCode: c.code, policyId: polId, lossEventId: c.loss ? (lossByCode.get(c.loss)?.id ?? null) : null, claimDate: daysAgo(c.days), description: c.desc,
      claimedAmountInr: c.claimed, status: c.status, settledAmountInr: c.settled ?? null, settlementDate: c.settleDays ? daysAgo(c.days - c.settleDays) : null, createdBy: aditya,
    } });
    claimCount++;
  }
  // Reconcile the SETTLED claim's recovery onto its loss event (demo: the confirmed write).
  const settledLoss = lossByCode.get("LE-2026-0001");
  if (settledLoss) {
    await prisma.lossEvent.update({ where: { id: settledLoss.id }, data: { recoveredInr: 11 * L, netLossInr: (settledLoss.grossLossInr ?? 14 * L) - 11 * L } });
  }

  // Coverage gap FY27 — pulls HIGH/CRITICAL register risks. Default FULLY_COVERED
  // (transferred under the broad all-risk / liability programme); exactly 3 named
  // gaps are curated. The 3 targets are ensured present even if their band drifts.
  const critRisks = riskRows.filter((r) => r.residualBand === "HIGH" || r.residualBand === "CRITICAL");
  const GAP_TARGETS: Record<string, { gapType: string; notes: string; rec: string | null }> = {
    "0021": { gapType: "UNINSURABLE_ACCEPTED", notes: "Water-stress / resource exposure is not commercially insurable; consciously self-retained per CRO note. Managed via efficiency + abstraction controls.", rec: null },
    "0024": { gapType: "UNCOVERED", notes: "Tariff / trade-policy exposure is a commercial risk; no transfer instrument. Mitigated operationally.", rec: "Evaluate parametric / political-risk cover at next renewal." },
    "0015": { gapType: "PARTIALLY_COVERED", notes: "Environmental Liability policy covers third-party pollution claims but excludes regulatory-consent breach penalties.", rec: "Add consent-breach extension at renewal." },
  };
  const polByRisk = new Map<string, string[]>();
  for (const p of POLICIES) for (const rs of p.risks ?? []) { const id = rid(rs); if (id) { polByRisk.set(id, [...(polByRisk.get(id) ?? []), polIdByCode.get(p.code)!]); } }
  const gapRiskIds = new Set(critRisks.map((r) => r.id));
  for (const short of Object.keys(GAP_TARGETS)) { const id = rid(short); if (id) gapRiskIds.add(id); }  // ensure the 3 targets are present
  const shortById = new Map(riskRows.map((r) => [r.id, r.riskCode.replace("ERM-2026-", "")]));
  const gapLines = [...gapRiskIds].map((id) => {
    const short = shortById.get(id) ?? "";
    const t = GAP_TARGETS[short];
    if (t) return { riskId: id, isInsurable: t.gapType !== "UNINSURABLE_ACCEPTED", coveredByPolicyIds: polByRisk.get(id) ?? [], gapType: t.gapType, gapNotes: t.notes, recommendedAction: t.rec };
    return { riskId: id, isInsurable: true, coveredByPolicyIds: polByRisk.get(id) ?? [], gapType: "FULLY_COVERED", gapNotes: "Transferred under the corporate insurance programme.", recommendedAction: null };
  });
  await prisma.coverageGapAssessment.create({ data: { assessmentCycleLabel: "FY27 Insurance Review", reviewDate: daysAgo(20), reviewedBy: aditya, lines: gapLines as any, summaryNotes: `${gapLines.filter((l) => l.gapType !== "FULLY_COVERED").length} of ${gapLines.length} critical risks are not fully transferred (incl. 1 uninsurable-accepted with CRO note).`, createdBy: aditya } });
  const notFully = gapLines.filter((l) => l.gapType !== "FULLY_COVERED").length;
  console.log(`  policies: ${polCount} | claims: ${claimCount} | coverage gap: ${notFully} of ${gapLines.length} critical risks not fully transferred`);

  // ════════════════════════════════════════════════════════════════════════════
  // Summary + engineered-fact assertions
  // ════════════════════════════════════════════════════════════════════════════
  const counts = {
    controls: await prisma.control.count(), keyControls: await prisma.control.count({ where: { isKeyControl: true } }),
    mappings: await prisma.riskControlMapping.count(), tests: await prisma.controlTest.count(),
    deficiencies: await prisma.controlDeficiency.count(), materialWeaknesses: await prisma.controlDeficiency.count({ where: { severity: "MATERIAL_WEAKNESS" } }),
    controlCapas: await prisma.capa.count({ where: { sourceTypeCode: "CONTROL_DEFICIENCY" } }),
    vendors: await prisma.vendorProfile.count(), assessments: await prisma.vendorAssessment.count(),
    vendorCapas: await prisma.capa.count({ where: { sourceTypeCode: "VENDOR_RISK" } }),
    laggingVendors: await prisma.vendorProfile.count({ where: { currentEsgBand: "LAGGING" } }),
    policies: await prisma.insurancePolicy.count(), claims: await prisma.insuranceClaim.count(),
    coverageGaps: await prisma.coverageGapAssessment.count(),
  };
  console.log("\n  ── ERM Tier 3 seed summary ─────────────────");
  for (const [k, v] of Object.entries(counts)) console.log(`     ${k.padEnd(20)} : ${v}`);

  const errs: string[] = [];
  if (counts.controls !== 22) errs.push(`expected 22 controls, got ${counts.controls}`);
  if (counts.keyControls !== 16) errs.push(`expected 16 key controls, got ${counts.keyControls}`);
  if (counts.materialWeaknesses !== 1) errs.push(`expected 1 material weakness, got ${counts.materialWeaknesses}`);
  if (counts.controlCapas !== 2) errs.push(`expected 2 CONTROL_DEFICIENCY CAPAs, got ${counts.controlCapas}`);
  if (counts.vendors !== 16) errs.push(`expected 16 vendors, got ${counts.vendors}`);
  if (counts.vendorCapas !== 1) errs.push(`expected 1 VENDOR_RISK CAPA, got ${counts.vendorCapas}`);
  if (counts.laggingVendors !== 1) errs.push(`expected 1 LAGGING vendor, got ${counts.laggingVendors}`);
  if (counts.policies !== 11) errs.push(`expected 11 policies, got ${counts.policies}`);
  if (counts.claims !== 4) errs.push(`expected 4 claims, got ${counts.claims}`);
  if (notFully !== 3) errs.push(`expected 3 critical risks not fully transferred, got ${notFully}`);
  if (laggingPct < 7 || laggingPct > 11) errs.push(`expected ~9% LAGGING spend, got ${laggingPct}%`);
  if (errs.length) { console.error("\n❌ Engineered-fact assertions FAILED:"); for (const e of errs) console.error(`   • ${e}`); throw new Error("Tier 3 seed produced unexpected demo facts"); }
  console.log(`\n  ✓ engineered facts verified: 22 controls (16 key) · 1 MW + 1 SD · 2 control CAPAs · 16 vendors · 1 LAGGING (${laggingPct}% spend) · 1 vendor CAPA · 11 policies · 4 claims · 3-of-${gapLines.length} gap`);
  console.log("✅  ERM Tier 3 seed complete.");
}

main().catch((e) => { console.error("❌ seed-erm-t3 failed:", e); process.exit(1); }).finally(() => prisma.$disconnect());
