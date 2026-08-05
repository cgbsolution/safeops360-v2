// ────────────────────────────────────────────────────────────────────────
// Seed — CAMS (Compliance & Audit Management System)
//
// Layers the centralised audit/inspection engine demo data on top of the
// Meridian Manufacturing tenant (plants NW / SW). One engine for audits AND
// inspections — engagements carry `sourceModule` to prove the shared model.
//
// Seeds:
//   • 3 personas: Rohan Bhatt (Audit Manager), Anjali Verma (Lead Auditor),
//     Deepak Sharma (Auditor) + UserRole assignments
//   • 8 audit types (system audits, ETP/statutory compliance, fire & PPE
//     inspections, contractor audit)
//   • 4 APPROVED, clause-mapped templates (ISO 45001 / 14001 / 9001 / fire)
//   • 3 recurrence rules (fire monthly, PPE quarterly, system audits annual)
//   • 14 engagements across a rolling 12 months — closed (scored), in-progress,
//     scheduled & planned; 3 raised by consumer modules (Fire / PPE / Pharma)
//     with provenance; the North 88% vs South 79% HSE benchmarking story
//   • ~16 findings (severity spread); MAJOR/CRITICAL carry an AUDIT-source CAPA;
//     a repeat finding pair at South Works (same ISO 45001 clause, two quarters)
//
// Idempotent: deletes prior CAMS demo rows (FK-safe order) + personas + the
// AUDIT-source CAPAs this seed created (matched by /cams/findings/ ref) before
// recreating. Safe to re-run.
//
// Run AFTER: base seed (Step 9 — plants/users), seed-rbac.ts, seed-capa-masters.ts.
//   npx tsx prisma/seed-cams.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_PASSWORD } from "./demo-users-config";

const prisma = new PrismaClient();

const NOW = new Date("2026-06-15T00:00:00.000Z");
function daysAgo(n: number): Date { return new Date(NOW.getTime() - n * 24 * 3_600_000); }
function daysFromNow(n: number): Date { return new Date(NOW.getTime() + n * 24 * 3_600_000); }

async function safeDelete(label: string, fn: () => Promise<unknown>) {
  try { await fn(); } catch (e) { console.warn(`  (delete ${label} skipped: ${(e as Error).message})`); }
}

const PERSONAS = [
  { email: "rohan.bhatt@safeops360.in", name: "Rohan Bhatt", role: "AUDIT_MANAGER", designation: "Audit Manager (Corporate)", plant: "NW" },
  { email: "anjali.verma@safeops360.in", name: "Anjali Verma", role: "LEAD_AUDITOR", designation: "Lead Auditor", plant: "NW" },
  { email: "deepak.sharma.cams@safeops360.in", name: "Deepak Sharma", role: "AUDITOR", designation: "Auditor", plant: "SW" },
];

async function main() {
  console.log("Seeding CAMS — Compliance & Audit Management System…");

  const nw = await prisma.plant.findFirst({ where: { code: "NW" } });
  const sw = await prisma.plant.findFirst({ where: { code: "SW" } });
  if (!nw || !sw) throw new Error("NW/SW plants not found — run the base seed (Step 9) first");

  // ── Idempotent cleanup (FK-safe order) ─────────────────────────────────
  await safeDelete("camsComplianceLink", () => prisma.camsComplianceLink.deleteMany({}));
  await safeDelete("capa(CAMS audit findings)", () =>
    prisma.capa.deleteMany({ where: { sourceReferenceUrl: { contains: "/cams/findings/" } } }));
  await safeDelete("camsFinding", () => prisma.camsFinding.deleteMany({}));
  await safeDelete("camsResponse", () => prisma.camsResponse.deleteMany({}));
  await safeDelete("camsEngagement", () => prisma.camsEngagement.deleteMany({}));
  await safeDelete("camsRecurrence", () => prisma.camsRecurrence.deleteMany({}));
  await safeDelete("camsTemplate", () => prisma.camsTemplate.deleteMany({})); // cascades sections+questions
  await safeDelete("camsAuditType", () => prisma.camsAuditType.deleteMany({}));
  for (const p of PERSONAS) {
    await safeDelete(`userRole(${p.email})`, () => prisma.userRole.deleteMany({ where: { user: { email: p.email } } }));
    await safeDelete(`user(${p.email})`, () => prisma.user.deleteMany({ where: { email: p.email } }));
  }

  // ── Personas ────────────────────────────────────────────────────────────
  const pwHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userByRole: Record<string, string> = {};
  for (const p of PERSONAS) {
    const plantId = p.plant === "NW" ? nw.id : sw.id;
    const u = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name, role: p.role, plantId, designation: p.designation, passwordHash: pwHash },
      create: { email: p.email, name: p.name, role: p.role, plantId, designation: p.designation, passwordHash: pwHash },
    });
    userByRole[p.role] = u.id;
    const role = await prisma.role.findUnique({ where: { code: p.role } });
    if (role) {
      const existing = await prisma.userRole.findFirst({ where: { userId: u.id, roleId: role.id, scopeType: "PLANT", scopeValue: plantId } });
      if (!existing) await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, scopeType: "PLANT", scopeValue: plantId } });
    } else {
      console.warn(`  (Role ${p.role} not found — run seed-rbac.ts; skipping UserRole for ${p.name})`);
    }
  }
  const auditMgr = userByRole["AUDIT_MANAGER"];
  const leadAuditor = userByRole["LEAD_AUDITOR"];
  const auditor = userByRole["AUDITOR"];
  console.log(`  personas: Rohan Bhatt / Anjali Verma / Deepak Sharma + UserRoles`);

  // ── Templates (APPROVED, clause-mapped) ─────────────────────────────────
  let tplSeq = 0;
  const nextTpl = () => `TPL-${String(++tplSeq).padStart(4, "0")}`;

  async function approvedTemplate(opts: {
    name: string; types: string[]; standards: string[]; mode: string; pass?: number;
    sections: { title: string; weightPct?: number; questions: { text: string; clause?: string; type?: string; nc?: boolean; guidance?: string }[] }[];
  }) {
    return prisma.camsTemplate.create({
      data: {
        templateCode: nextTpl(), name: opts.name, description: `${opts.name} — clause-mapped checklist.`,
        applicableEngagementTypes: opts.types, standardRefs: opts.standards, version: 1, status: "APPROVED",
        approvedBy: auditMgr, approvedAt: daysAgo(120),
        scoringConfig: { mode: opts.mode, passThresholdPercent: opts.pass ?? 80 },
        ownerId: auditMgr, isGlobal: true, createdBy: auditMgr,
        sections: {
          create: opts.sections.map((s, si) => ({
            orderIndex: si, title: s.title, weightPct: s.weightPct ?? null,
            questions: {
              create: s.questions.map((q, qi) => ({
                orderIndex: qi, text: q.text, questionType: q.type ?? "CONFORM_NC_NA", isMandatory: true,
                standardClauseRef: q.clause ?? null, guidance: q.guidance ?? null,
                ncTriggersFinding: q.nc ?? true, evidenceRequiredOnNc: false,
              })),
            },
          })),
        },
      },
    });
  }

  const hseTpl = await approvedTemplate({
    name: "Internal HSE System Audit — ISO 45001", types: ["INTERNAL_AUDIT"], standards: ["ISO_45001"],
    mode: "WEIGHTED_SCORE", pass: 80,
    sections: [
      { title: "Leadership & Worker Participation", weightPct: 25, questions: [
        { text: "Is top-management commitment to the OH&S policy demonstrable?", clause: "ISO 45001:5.1" },
        { text: "Are workers consulted and participating in OH&S decisions?", clause: "ISO 45001:5.4" },
      ]},
      { title: "Planning — Hazards & Legal", weightPct: 25, questions: [
        { text: "Is hazard identification current and risk-assessed for all tasks?", clause: "ISO 45001:6.1.2" },
        { text: "Are applicable legal requirements determined and tracked?", clause: "ISO 45001:6.1.3" },
      ]},
      { title: "Operation", weightPct: 30, questions: [
        { text: "Are operational controls implemented for high-risk activities?", clause: "ISO 45001:8.1.1" },
        { text: "Is the hierarchy of controls applied to eliminate hazards?", clause: "ISO 45001:8.1.2" },
        { text: "Is management of change applied to new/changed processes?", clause: "ISO 45001:8.1.3" },
        { text: "Is emergency preparedness tested and effective?", clause: "ISO 45001:8.2" },
      ]},
      { title: "Performance & Improvement", weightPct: 20, questions: [
        { text: "Is OH&S performance monitored and evaluated?", clause: "ISO 45001:9.1" },
        { text: "Are incidents and nonconformities driving corrective action?", clause: "ISO 45001:10.2" },
      ]},
    ],
  });

  const etpTpl = await approvedTemplate({
    name: "ETP / Environmental Compliance Audit — ISO 14001", types: ["COMPLIANCE_AUDIT", "INTERNAL_AUDIT"], standards: ["ISO_14001"],
    mode: "PERCENT_CONFORMANCE", pass: 85,
    sections: [
      { title: "Compliance Obligations", questions: [
        { text: "Are consent-to-operate conditions met and evidenced?", clause: "ISO 14001:6.1.3" },
        { text: "Is effluent within consented norms (ETP logs verified)?", clause: "ISO 14001:9.1.2" },
      ]},
      { title: "Operational Control", questions: [
        { text: "Is the ETP operated and maintained per SOP?", clause: "ISO 14001:8.1" },
        { text: "Is emergency response for environmental release in place?", clause: "ISO 14001:8.2" },
        { text: "Are environmental nonconformities corrected?", clause: "ISO 14001:10.2" },
      ]},
    ],
  });

  const fireTpl = await approvedTemplate({
    name: "Fire Equipment Inspection", types: ["INSPECTION"], standards: ["ISO_45001"],
    mode: "PASS_FAIL",
    sections: [
      { title: "Extinguishers & Hydrants", questions: [
        { text: "Are extinguishers pressurised, sealed and within service date?", clause: "ISO 45001:8.2" },
        { text: "Are hydrants & hose reels accessible and functional?", clause: "ISO 45001:8.2" },
      ]},
      { title: "Detection & Egress", questions: [
        { text: "Are smoke/heat detectors tested and operational?", clause: "ISO 45001:8.2" },
        { text: "Are escape routes unobstructed and signage illuminated?", clause: "ISO 45001:8.2" },
      ]},
    ],
  });

  const qmsTpl = await approvedTemplate({
    name: "Quality System Audit — ISO 9001", types: ["INTERNAL_AUDIT"], standards: ["ISO_9001"],
    mode: "PERCENT_CONFORMANCE", pass: 80,
    sections: [
      { title: "Production Control", questions: [
        { text: "Is production and service provision controlled per plan?", clause: "ISO 9001:8.5.1" },
        { text: "Are monitoring & measuring resources calibrated?", clause: "ISO 9001:7.1.5" },
        { text: "Are nonconforming outputs controlled?", clause: "ISO 9001:8.7" },
      ]},
      { title: "Improvement", questions: [
        { text: "Are internal audits conducted to programme?", clause: "ISO 9001:9.2" },
        { text: "Is corrective action effective and verified?", clause: "ISO 9001:10.2" },
      ]},
    ],
  });
  console.log("  templates: 4 approved + clause-mapped");

  // ── Audit Types ──────────────────────────────────────────────────────────
  let atSeq = 0;
  const nextAt = () => `AT-${String(++atSeq).padStart(4, "0")}`;
  async function auditType(name: string, engagementType: string, standards: string[], defaultTemplateId: string | null, opts?: { recur?: string; asset?: boolean }) {
    return prisma.camsAuditType.create({
      data: {
        typeCode: nextAt(), name, engagementType, standardRefs: standards, defaultTemplateId,
        defaultRecurrence: opts?.recur ?? null, requiresAssetRef: opts?.asset ?? false,
        requiresAuditorCompetency: [], isActive: true, createdBy: auditMgr,
      },
    });
  }
  const atHse = await auditType("Internal HSE System Audit", "INTERNAL_AUDIT", ["ISO_45001"], hseTpl.id, { recur: "ANNUAL" });
  const atEnv = await auditType("Environmental System Audit", "INTERNAL_AUDIT", ["ISO_14001"], etpTpl.id, { recur: "ANNUAL" });
  const atQms = await auditType("Quality System Audit", "INTERNAL_AUDIT", ["ISO_9001"], qmsTpl.id, { recur: "ANNUAL" });
  const atEtp = await auditType("ETP Compliance Audit", "COMPLIANCE_AUDIT", ["ISO_14001"], etpTpl.id, { recur: "HALF_YEARLY" });
  const atFire = await auditType("Fire Equipment Inspection", "INSPECTION", ["ISO_45001"], fireTpl.id, { recur: "MONTHLY", asset: true });
  const atPpe = await auditType("PPE Condition Inspection", "INSPECTION", ["ISO_45001"], null, { recur: "QUARTERLY", asset: true });
  const atCon = await auditType("Contractor Safety Audit", "SUPPLIER_AUDIT", ["ISO_45001"], hseTpl.id);
  const atStat = await auditType("Statutory Compliance Audit", "COMPLIANCE_AUDIT", ["ISO_45001", "ISO_14001"], etpTpl.id, { recur: "ANNUAL" });
  console.log("  audit types: 8");

  // ── Recurrence rules ─────────────────────────────────────────────────────
  await prisma.camsRecurrence.createMany({
    data: [
      { auditTypeId: atFire.id, templateId: fireTpl.id, siteScope: [nw.id, sw.id], frequency: "MONTHLY", leadTimeDays: 7, defaultLeadAuditorId: auditor, isActive: true, lastGeneratedAt: daysAgo(20), createdBy: auditMgr },
      { auditTypeId: atPpe.id, siteScope: [nw.id, sw.id], frequency: "QUARTERLY", leadTimeDays: 14, defaultLeadAuditorId: auditor, isActive: true, lastGeneratedAt: daysAgo(60), createdBy: auditMgr },
      { auditTypeId: atHse.id, templateId: hseTpl.id, siteScope: [nw.id, sw.id], frequency: "ANNUAL", leadTimeDays: 30, defaultLeadAuditorId: leadAuditor, isActive: true, lastGeneratedAt: daysAgo(200), createdBy: auditMgr },
    ],
  });
  console.log("  recurrence rules: 3 (fire monthly, PPE quarterly, HSE annual)");

  // ── CAPA source type lookup (AUDIT_INTERNAL — existing, not forked) ──────
  const auditCapaType = await prisma.capaSourceType.findFirst({ where: { code: "AUDIT_INTERNAL" } });
  const auditCapaCat = auditCapaType ? await prisma.capaSourceCategory.findUnique({ where: { id: auditCapaType.categoryId } }) : null;
  let capaSeq = 0;

  async function raiseAuditCapa(finding: { id: string; findingCode: string; title: string; severity: string; description: string; ownerId: string | null }, engagementCode: string, plantId: string, plantCode: string, state: string, daysOld: number) {
    if (!auditCapaType) { console.warn("  (AUDIT_INTERNAL CAPA source type missing — run seed-capa-masters.ts; skipping CAPA)"); return null; }
    const sevMap: Record<string, string> = { CRITICAL_NC: "CRITICAL", MAJOR_NC: "HIGH", MINOR_NC: "MODERATE" };
    const capa = await prisma.capa.create({
      data: {
        capaNumber: `CAPA-${auditCapaCat?.prefix ?? "Q"}-2026-${plantCode}-${String(++capaSeq).padStart(3, "0")}`,
        title: `Audit finding: ${finding.title}`.slice(0, 200), plantId,
        sourceCategoryId: auditCapaType.categoryId, sourceTypeId: auditCapaType.id, sourceTypeCode: "AUDIT_INTERNAL",
        sourceReferenceId: finding.id, sourceReferenceUrl: `/cams/findings/${finding.id}`,
        sourceReferenceSummary: `${finding.findingCode} — ${engagementCode}`,
        sourceMetadata: { findingCode: finding.findingCode, engagementCode, severity: finding.severity },
        problemDescription: finding.description || finding.title, detectionMethod: "AUDIT_FINDING",
        detectedAt: daysAgo(daysOld), detectedByUserId: leadAuditor,
        primaryCategory: "Audit / Compliance", actionType: "CORRECTIVE_AND_PREVENTIVE",
        severity: sevMap[finding.severity] ?? "MODERATE", priority: finding.severity === "CRITICAL_NC" ? "URGENT" : "HIGH",
        state, stateChangedAt: daysAgo(daysOld), stateChangedByUserId: leadAuditor,
        raisedByUserId: leadAuditor, primaryOwnerUserId: finding.ownerId ?? auditMgr, createdByUserId: leadAuditor,
        closureTargetDate: daysFromNow(30),
      },
    });
    await prisma.camsFinding.update({ where: { id: finding.id }, data: { capaId: capa.id, status: state === "CLOSED" ? "CLOSED" : "CAPA_RAISED" } });
    return capa;
  }

  // ── Engagements + findings ───────────────────────────────────────────────
  let engSeq = 0, insSeq = 0, fndSeq = 0;
  const nextEng = (type: string) => type === "INSPECTION" ? `INS-2026-${String(++insSeq).padStart(4, "0")}` : `AUD-2026-${String(++engSeq).padStart(4, "0")}`;
  const nextFnd = () => `FND-2026-${String(++fndSeq).padStart(4, "0")}`;

  type FindingSpec = { title: string; severity: string; clause?: string; status?: string; capaState?: string; repeat?: boolean; ageDays?: number; rca?: string };
  async function engagement(o: {
    title: string; type: string; auditTypeId: string; templateId: string | null; standards: string[]; plant: { id: string; code: string };
    status: string; lead: string; plannedAgo?: number; plannedIn?: number; score?: number; result?: string; sourceModule?: string; findings?: FindingSpec[];
  }) {
    const code = nextEng(o.type);
    const planned = o.plannedIn != null ? daysFromNow(o.plannedIn) : daysAgo(o.plannedAgo ?? 30);
    const conducted = ["FIELDWORK_COMPLETE", "FINDINGS_REVIEW", "REPORT_ISSUED", "CLOSED"].includes(o.status) ? planned : null;
    const eng = await prisma.camsEngagement.create({
      data: {
        engagementCode: code, title: o.title, engagementType: o.type, auditTypeId: o.auditTypeId,
        standardRefs: o.standards, siteId: o.plant.id, scopeStatement: `${o.title} for ${o.plant.code} works.`,
        leadAuditorId: o.lead, auditTeamIds: [auditor], auditeeOwnerId: auditMgr,
        plannedDate: planned, scheduledStart: planned, conductedDate: conducted,
        templateId: o.templateId, templateVersionUsed: o.templateId ? 1 : null, status: o.status,
        riskBasis: o.type === "COMPLIANCE_AUDIT" ? "REGULATORY_REQUIRED" : "ROUTINE",
        overallResult: o.result ?? null, scorePercent: o.score ?? null, sourceModule: o.sourceModule ?? null,
        createdBy: auditMgr,
      },
    });
    for (const f of o.findings ?? []) {
      const finding = await prisma.camsFinding.create({
        data: {
          findingCode: nextFnd(), engagementId: eng.id, title: f.title, description: f.title,
          severity: f.severity, standardClauseRef: f.clause ?? null, siteId: o.plant.id, ownerId: auditMgr,
          status: f.status ?? "OPEN", isRepeatFinding: f.repeat ?? false, dueDate: daysFromNow(21),
          rootCauseMethod: f.rca ? "5_WHY" : null, rootCauseSummary: f.rca ?? null, createdBy: leadAuditor,
        },
      });
      if (f.capaState) {
        await raiseAuditCapa(
          { id: finding.id, findingCode: finding.findingCode, title: f.title, severity: f.severity, description: f.title, ownerId: auditMgr },
          code, o.plant.id, o.plant.code, f.capaState, f.ageDays ?? 20,
        );
      }
    }
    return eng;
  }

  // Closed/scored — the North vs South HSE benchmarking story.
  await engagement({ title: "Internal HSE System Audit — North Works FY26", type: "INTERNAL_AUDIT", auditTypeId: atHse.id, templateId: hseTpl.id, standards: ["ISO_45001"], plant: nw, status: "CLOSED", lead: leadAuditor, plannedAgo: 150, score: 88, result: "MINOR_NC",
    findings: [{ title: "Worker consultation records incomplete for night shift", severity: "MINOR_NC", clause: "ISO 45001:5.4", status: "CLOSED", rca: "Consultation log not extended to the third shift roster." }] });

  await engagement({ title: "Internal HSE System Audit — South Works FY26", type: "INTERNAL_AUDIT", auditTypeId: atHse.id, templateId: hseTpl.id, standards: ["ISO_45001"], plant: sw, status: "CLOSED", lead: leadAuditor, plannedAgo: 140, score: 79, result: "MAJOR_NC",
    findings: [
      { title: "Hierarchy of controls not applied at packing line guarding", severity: "MAJOR_NC", clause: "ISO 45001:8.1.2", status: "CAPA_RAISED", capaState: "ACTIONS_IN_PROGRESS", ageDays: 130, rca: "Machine guarding upgrade deferred for budget." },
      { title: "Emergency drill overdue at South Works", severity: "MINOR_NC", clause: "ISO 45001:8.2", status: "CLOSED" },
    ] });

  // ETP South Works — MAJOR_NC tying to the water/consent risk story.
  await engagement({ title: "ETP Compliance Audit — South Works", type: "COMPLIANCE_AUDIT", auditTypeId: atEtp.id, templateId: etpTpl.id, standards: ["ISO_14001"], plant: sw, status: "REPORT_ISSUED", lead: leadAuditor, plannedAgo: 45, score: 72, result: "MAJOR_NC",
    findings: [{ title: "Effluent COD exceeded consented norm on 3 days", severity: "MAJOR_NC", clause: "ISO 14001:9.1.2", status: "CAPA_RAISED", capaState: "ACTIONS_PLANNED", ageDays: 40, rca: "Dosing pump under-capacity during peak load." }] });

  // Quality system audit — North, clean.
  await engagement({ title: "Quality System Audit — North Works", type: "INTERNAL_AUDIT", auditTypeId: atQms.id, templateId: qmsTpl.id, standards: ["ISO_9001"], plant: nw, status: "CLOSED", lead: leadAuditor, plannedAgo: 95, score: 91, result: "CONFORMING" });

  // Repeat finding pair — same ISO 45001 clause at South Works, two quarters apart.
  await engagement({ title: "Internal HSE System Audit — South Works Q2", type: "INTERNAL_AUDIT", auditTypeId: atHse.id, templateId: hseTpl.id, standards: ["ISO_45001"], plant: sw, status: "REPORT_ISSUED", lead: leadAuditor, plannedAgo: 30, score: 77, result: "MAJOR_NC",
    findings: [{ title: "Machine guarding gap recurs at packing line (repeat)", severity: "MAJOR_NC", clause: "ISO 45001:8.1.2", status: "CAPA_RAISED", capaState: "ACTIONS_PLANNED", repeat: true, ageDays: 25, rca: "Prior CAPA not yet effective — interim guard only." }] });

  // Consumer-raised engagements (provenance badges) — the shared-engine proof.
  await engagement({ title: "Fire Equipment Inspection — North Works (June)", type: "INSPECTION", auditTypeId: atFire.id, templateId: fireTpl.id, standards: ["ISO_45001"], plant: nw, status: "CLOSED", lead: auditor, plannedAgo: 12, score: 100, result: "CONFORMING", sourceModule: "Fire Safety" });
  await engagement({ title: "PPE Condition Inspection — South Works Q2", type: "INSPECTION", auditTypeId: atPpe.id, templateId: null, standards: ["ISO_45001"], plant: sw, status: "FIELDWORK_COMPLETE", lead: auditor, plannedAgo: 6, score: 94, result: "MINOR_NC", sourceModule: "PPE Management",
    findings: [{ title: "3 hard hats past replacement date in store B", severity: "MINOR_NC", status: "OPEN" }] });
  await engagement({ title: "Line Clearance Audit — Pharma Block (Batch 2026-118)", type: "INSPECTION", auditTypeId: atQms.id, templateId: qmsTpl.id, standards: ["ISO_9001"], plant: nw, status: "CLOSED", lead: auditor, plannedAgo: 3, score: 100, result: "CONFORMING", sourceModule: "Pharma IMS" });

  // In-progress / scheduled / planned (calendar forward fill).
  await engagement({ title: "Environmental System Audit — North Works", type: "INTERNAL_AUDIT", auditTypeId: atEnv.id, templateId: etpTpl.id, standards: ["ISO_14001"], plant: nw, status: "IN_PROGRESS", lead: leadAuditor, plannedAgo: 2 });
  await engagement({ title: "Contractor Safety Audit — EPC Site A", type: "SUPPLIER_AUDIT", auditTypeId: atCon.id, templateId: hseTpl.id, standards: ["ISO_45001"], plant: sw, status: "SCHEDULED", lead: leadAuditor, plannedIn: 9, sourceModule: "EPC" });
  await engagement({ title: "Fire Equipment Inspection — South Works (July)", type: "INSPECTION", auditTypeId: atFire.id, templateId: fireTpl.id, standards: ["ISO_45001"], plant: sw, status: "SCHEDULED", lead: auditor, plannedIn: 16 });
  await engagement({ title: "Statutory Compliance Audit — North Works FY27", type: "COMPLIANCE_AUDIT", auditTypeId: atStat.id, templateId: etpTpl.id, standards: ["ISO_45001", "ISO_14001"], plant: nw, status: "PLANNED", lead: leadAuditor, plannedIn: 40 });
  await engagement({ title: "Quality System Audit — South Works FY27", type: "INTERNAL_AUDIT", auditTypeId: atQms.id, templateId: qmsTpl.id, standards: ["ISO_9001"], plant: sw, status: "PLANNED", lead: leadAuditor, plannedIn: 55 });

  // ── Compliance links (§10.5) — audits/findings ↔ ERM obligations ─────────
  // Enrichment: only if the ERM obligations register is present (integrated mode).
  let linkCount = 0;
  const obligations = await prisma.legalObligation.findMany({
    where: { isDeleted: false }, select: { id: true, obligationCode: true, siteId: true, title: true, status: true },
  }).catch(() => [] as { id: string; obligationCode: string; siteId: string | null; title: string; status: string }[]);
  if (obligations.length) {
    const etp = await prisma.camsEngagement.findFirst({ where: { title: { contains: "ETP Compliance Audit — South Works" } } });
    const etpFinding = etp ? await prisma.camsFinding.findFirst({ where: { engagementId: etp.id } }) : null;
    const hseNorth = await prisma.camsEngagement.findFirst({ where: { title: { contains: "Internal HSE System Audit — North Works" } } });
    const qmsNorth = await prisma.camsEngagement.findFirst({ where: { title: { contains: "Quality System Audit — North Works" } } });

    const nwObls = obligations.filter((o) => o.siteId === nw.id);
    const swObls = obligations.filter((o) => o.siteId === sw.id);
    const fireNoc = obligations.find((o) => /fire/i.test(o.title)) ?? swObls.find((o) => o.status === "OVERDUE");
    const swWater = swObls.find((o) => /water|consent|effluent/i.test(o.title)) ?? swObls[0];

    const links: { engagementId?: string; findingId?: string; obligationId: string; linkType: string; notes: string }[] = [];
    // Two passed North audits VERIFY compliant North obligations.
    if (hseNorth && nwObls[0]) links.push({ engagementId: hseNorth.id, obligationId: nwObls[0].id, linkType: "VERIFIES", notes: "HSE system audit verified compliance conditions." });
    if (qmsNorth && nwObls[1]) links.push({ engagementId: qmsNorth.id, obligationId: nwObls[1].id, linkType: "VERIFIES", notes: "Quality system audit verified compliance conditions." });
    // ETP MAJOR_NC at South BREACHES the South water/consent obligation.
    if (etp && etpFinding && swWater) links.push({ findingId: etpFinding.id, obligationId: swWater.id, linkType: "BREACHES", notes: "Effluent COD exceeded the consented norm — open non-conformance." });
    // Fire NOC obligation evidenced against the South ETP engagement (overdue NOC).
    if (etp && fireNoc && fireNoc.id !== swWater?.id) links.push({ engagementId: etp.id, obligationId: fireNoc.id, linkType: "EVIDENCES", notes: "Statutory audit flagged the lapsed Fire NOC." });

    for (const l of links) {
      await prisma.camsComplianceLink.create({ data: { ...l, createdBy: auditMgr } });
      linkCount++;
    }
  }

  const engCount = await prisma.camsEngagement.count();
  const fndCount = await prisma.camsFinding.count();
  const capaCount = await prisma.capa.count({ where: { sourceReferenceUrl: { contains: "/cams/findings/" } } });
  console.log(`  engagements: ${engCount} · findings: ${fndCount} · audit-source CAPAs: ${capaCount} · compliance links: ${linkCount}`);
  console.log("CAMS seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
