// ────────────────────────────────────────────────────────────────────────
// Migration — Inspection cluster → CAMS engine (Build Prompt §9)
//
// Re-homes the legacy Assets & Inspection cluster into the centralised CAMS
// engine WITHOUT orphaning data. Mapping:
//   InspectionType            → CamsAuditType            (engagementType INSPECTION)
//   ChecklistTemplate + Items → CamsTemplate + Sections + Questions (v1, APPROVED)
//   Inspection + ItemResults  → CamsEngagement + CamsResponse
//   InspectionFinding         → CamsFinding              (severity/status mapped)
//
// Properties (§9.7):
//   • DRY-RUN by default — prints a reconciliation report (counts in → out,
//     unmapped items listed) and writes NOTHING. Pass --run to apply.
//   • IDEMPOTENT — migrated rows carry a "MIG-" code prefix; re-running skips
//     rows already migrated.
//   • REVERSIBLE — `--revert` deletes every MIG- row (FK-safe order).
//   • Clause backfill is best-effort; questions without a derivable ISO clause
//     are left null and counted as "needs admin clause-mapping pass".
//
// Run:
//   npx tsx prisma/migrate-cams.ts            # dry-run report
//   npx tsx prisma/migrate-cams.ts --run      # apply
//   npx tsx prisma/migrate-cams.ts --revert   # undo
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RUN = process.argv.includes("--run");
const REVERT = process.argv.includes("--revert");
const MIG = "MIG-";

// ── value mappings ────────────────────────────────────────────────────────
const QTYPE: Record<string, string> = {
  PASS_FAIL: "CONFORM_NC_NA", NUMERIC: "NUMERIC", MEASUREMENT: "NUMERIC", SELECT: "SINGLE_SELECT",
  TEXT: "TEXT", PHOTO: "PHOTO_REQUIRED", SIGNATURE: "SIGNATURE", CHECKBOX: "YES_NO_NA",
};
const FINDING_SEVERITY: Record<string, string> = { LOW: "OBSERVATION", MEDIUM: "MINOR_NC", HIGH: "MAJOR_NC", CRITICAL: "CRITICAL_NC" };
const FINDING_STATUS: Record<string, string> = {
  OPEN: "OPEN", UNDER_REVIEW: "OPEN", IN_PROGRESS: "IN_REMEDIATION", DEFERRED: "OPEN",
  DUPLICATE: "ACCEPTED_RISK", CLOSED: "CLOSED", VERIFIED: "CLOSED",
};
const ENG_STATUS: Record<string, string> = {
  SCHEDULED: "SCHEDULED", DUE: "SCHEDULED", IN_PROGRESS: "IN_PROGRESS", COMPLETED: "CLOSED",
  OVERDUE: "SCHEDULED", CANCELLED: "CANCELLED", DEFERRED: "PLANNED", SKIPPED: "CANCELLED",
};
function resultToOverall(result: string | null): string | null {
  if (!result) return null;
  const r = result.toLowerCase();
  if (r.startsWith("pass")) return "CONFORMING";
  if (r.startsWith("fail")) return "MAJOR_NC";
  if (r.startsWith("partial")) return "MINOR_NC";
  return null;
}
function resultStatusToConformance(s: string): string | null {
  if (s === "PASS") return "CONFORM";
  if (s === "FAIL" || s === "MARGINAL" || s === "OBSERVATION") return "NC";
  if (s === "NA") return "NA";
  return null;
}

async function revert() {
  console.log("Reverting CAMS migration (deleting MIG- rows)…");
  const f = await prisma.camsFinding.deleteMany({ where: { findingCode: { startsWith: MIG } } });
  const r = await prisma.camsResponse.deleteMany({ where: { engagement: { engagementCode: { startsWith: MIG } } } });
  const e = await prisma.camsEngagement.deleteMany({ where: { engagementCode: { startsWith: MIG } } });
  const t = await prisma.camsTemplate.deleteMany({ where: { templateCode: { startsWith: MIG } } }); // cascades sections+questions
  const a = await prisma.camsAuditType.deleteMany({ where: { typeCode: { startsWith: MIG } } });
  console.log(`  deleted: ${a.count} types, ${t.count} templates, ${e.count} engagements, ${r.count} responses, ${f.count} findings`);
}

async function main() {
  if (REVERT) { await revert(); return; }

  console.log(`CAMS migration — ${RUN ? "APPLY (--run)" : "DRY-RUN (no writes; pass --run to apply)"}`);
  const report = {
    types: { in: 0, migrated: 0, skipped: 0 },
    templates: { in: 0, migrated: 0, skipped: 0, questions: 0, clauseUnmapped: 0 },
    engagements: { in: 0, migrated: 0, skipped: 0, responses: 0 },
    findings: { in: 0, migrated: 0, skipped: 0, capaRelinked: 0 },
    unmapped: [] as string[],
  };

  // ── 1. InspectionType → CamsAuditType ─────────────────────────────────────
  const types = await prisma.inspectionType.findMany();
  report.types.in = types.length;
  const typeMap = new Map<string, string>(); // legacyTypeId → new CamsAuditType.id (or sentinel in dry-run)
  for (const t of types) {
    const code = `${MIG}${t.code}`;
    const existing = await prisma.camsAuditType.findUnique({ where: { typeCode: code } });
    if (existing) { report.types.skipped++; typeMap.set(t.id, existing.id); continue; }
    if (RUN) {
      const created = await prisma.camsAuditType.create({
        data: {
          typeCode: code, name: t.name, engagementType: "INSPECTION",
          standardRefs: [], requiresAssetRef: true, requiresAuditorCompetency: [],
          isActive: t.isActive, createdBy: "MIGRATION",
        },
      });
      typeMap.set(t.id, created.id);
    } else {
      typeMap.set(t.id, "dry-run");
    }
    report.types.migrated++;
  }

  // ── 2. ChecklistTemplate (+Items) → CamsTemplate (+Sections+Questions) ────
  const templates = await prisma.checklistTemplate.findMany({ include: { items: { orderBy: { sequence: "asc" } } } });
  report.templates.in = templates.length;
  const tplMap = new Map<string, string>();          // legacyTemplateId → new CamsTemplate.id
  const itemToQuestion = new Map<string, string>();   // legacy ChecklistItem.id → new CamsTemplateQuestion.id
  for (const tpl of templates) {
    const code = `${MIG}${tpl.code}`;
    const existing = await prisma.camsTemplate.findUnique({ where: { templateCode: code }, include: { sections: { include: { questions: true } } } });
    if (existing) {
      report.templates.skipped++;
      tplMap.set(tpl.id, existing.id);
      // Rebuild itemToQuestion map by matching question text (best-effort for re-run).
      const qByText = new Map(existing.sections.flatMap((s) => s.questions).map((q) => [q.text, q.id]));
      for (const it of tpl.items) { const qid = qByText.get(it.itemText); if (qid) itemToQuestion.set(it.id, qid); }
      continue;
    }

    // Group items into sections by SECTION_HEADER markers / sectionTitle.
    type SecBuild = { title: string; items: typeof tpl.items };
    const sections: SecBuild[] = [];
    let current: SecBuild | null = null;
    for (const it of tpl.items) {
      if (it.itemType === "SECTION_HEADER") { current = { title: it.itemText || "Section", items: [] }; sections.push(current); continue; }
      if (!current) { current = { title: it.sectionTitle || "Checklist", items: [] }; sections.push(current); }
      else if (it.sectionTitle && it.sectionTitle !== current.title && current.items.length) { current = { title: it.sectionTitle, items: [] }; sections.push(current); }
      current.items.push(it);
    }
    if (!sections.length) sections.push({ title: "Checklist", items: tpl.items });

    const qCount = sections.reduce((n, s) => n + s.items.length, 0);
    report.templates.questions += qCount;
    report.templates.clauseUnmapped += qCount; // legacy items carry no ISO clause — all need an admin pass

    if (RUN) {
      const created = await prisma.camsTemplate.create({
        data: {
          templateCode: code, name: tpl.name, description: tpl.description ?? "",
          applicableEngagementTypes: ["INSPECTION"], standardRefs: [], version: 1,
          status: tpl.approvalStatus === "APPROVED" ? "APPROVED" : "APPROVED", // legacy active templates land as APPROVED v1
          approvedBy: tpl.approvedById ?? "MIGRATION", approvedAt: tpl.approvedAt ?? new Date(),
          scoringConfig: { mode: "PERCENT_CONFORMANCE", passThresholdPercent: 80 },
          ownerId: tpl.createdById ?? "MIGRATION", isGlobal: true, createdBy: "MIGRATION",
          sections: {
            create: sections.map((s, si) => ({
              orderIndex: si, title: s.title,
              questions: {
                create: s.items.map((it, qi) => ({
                  orderIndex: qi, text: it.itemText, questionType: QTYPE[it.itemType] ?? "CONFORM_NC_NA",
                  isMandatory: true, guidance: it.guidanceText ?? null,
                  ncTriggersFinding: it.isCritical ?? true, evidenceRequiredOnNc: it.requiresPhoto ?? false,
                })),
              },
            })),
          },
        },
        include: { sections: { include: { questions: true } } },
      });
      tplMap.set(tpl.id, created.id);
      // Map legacy item ids → new question ids by (section order, item order).
      const flatNew = created.sections.sort((a, b) => a.orderIndex - b.orderIndex).flatMap((s) => s.questions.sort((a, b) => a.orderIndex - b.orderIndex));
      const flatOld = sections.flatMap((s) => s.items);
      flatOld.forEach((it, i) => { if (flatNew[i]) itemToQuestion.set(it.id, flatNew[i].id); });
    } else {
      tplMap.set(tpl.id, "dry-run");
    }
    report.templates.migrated++;
  }

  // ── 3. Inspection (+ItemResults) → CamsEngagement (+CamsResponse) ─────────
  const inspections = await prisma.inspection.findMany({
    include: { itemResults: true, equipment: { select: { plantId: true } } },
  });
  report.engagements.in = inspections.length;
  for (const ins of inspections) {
    const code = `${MIG}${ins.number}`;
    const existing = await prisma.camsEngagement.findUnique({ where: { engagementCode: code } });
    if (existing) { report.engagements.skipped++; continue; }
    if (RUN) {
      const eng = await prisma.camsEngagement.create({
        data: {
          engagementCode: code, title: `Inspection ${ins.number}`, engagementType: "INSPECTION",
          auditTypeId: ins.inspectionTypeId ? typeMap.get(ins.inspectionTypeId) ?? null : null,
          standardRefs: [], siteId: ins.plantId, areaOrAssetRef: ins.equipmentId,
          scopeStatement: ins.observations ?? "Migrated from the legacy Inspection cluster.",
          leadAuditorId: ins.inspectorId ?? "MIGRATION", auditTeamIds: [],
          plannedDate: ins.scheduledDate, conductedDate: ins.completedDate,
          templateId: ins.checklistTemplateId ? tplMap.get(ins.checklistTemplateId) ?? null : null,
          templateVersionUsed: ins.checklistTemplateId ? 1 : null,
          status: ENG_STATUS[ins.status] ?? "SCHEDULED",
          overallResult: resultToOverall(ins.result), sourceModule: "Assets & Inspection (migrated)",
          createdBy: "MIGRATION",
        },
      });
      // Build a CamsResponse from item results when there are any.
      if (ins.itemResults.length) {
        const answers = ins.itemResults
          .filter((ir) => ir.checklistItemId && itemToQuestion.has(ir.checklistItemId))
          .map((ir) => ({
            questionId: itemToQuestion.get(ir.checklistItemId!),
            value: ir.valueText ?? ir.valueNumeric ?? null,
            conformance: resultStatusToConformance(ir.resultStatus),
            evidenceAttachmentIds: ir.photoUrls ?? [],
            note: ir.comment ?? "",
            findingId: null,
          }));
        if (answers.length) {
          await prisma.camsResponse.create({
            data: { engagementId: eng.id, templateVersionUsed: 1, answers, sectionScores: [], completedBy: ins.inspectorId ?? null, completedAt: ins.completedDate ?? null },
          });
          report.engagements.responses++;
        }
      }
    }
    report.engagements.migrated++;
  }

  // ── 4. InspectionFinding → CamsFinding ────────────────────────────────────
  const findings = await prisma.inspectionFinding.findMany({ include: { inspection: { select: { number: true, plantId: true } } } });
  report.findings.in = findings.length;
  for (const f of findings) {
    const code = `${MIG}${f.findingNumber}`;
    const existing = await prisma.camsFinding.findUnique({ where: { findingCode: code } });
    if (existing) { report.findings.skipped++; continue; }
    const engCode = `${MIG}${f.inspection.number}`;
    const eng = RUN ? await prisma.camsEngagement.findUnique({ where: { engagementCode: engCode } }) : null;
    if (RUN && !eng) { report.unmapped.push(`Finding ${f.findingNumber}: parent inspection not migrated`); continue; }
    // Relink to an existing universal CAPA raised against this inspection finding, if any.
    let capaId: string | null = null;
    const capa = await prisma.capa.findFirst({ where: { sourceReferenceId: f.id, sourceTypeCode: { startsWith: "INSPECTION" } }, select: { id: true } });
    if (capa) { capaId = capa.id; report.findings.capaRelinked++; }
    if (RUN && eng) {
      await prisma.camsFinding.create({
        data: {
          findingCode: code, engagementId: eng.id, title: f.title, description: f.description,
          severity: FINDING_SEVERITY[f.severity] ?? "MINOR_NC", siteId: f.inspection.plantId,
          ownerId: f.ownerId ?? null, status: FINDING_STATUS[f.status] ?? "OPEN", capaId,
          rootCauseSummary: f.rootCauseNote ?? null, dueDate: f.dueDate ?? null,
          closedBy: f.closedById ?? null, closedAt: f.closedAt ?? null,
          evidenceAttachmentIds: f.photoUrls ?? [], createdBy: "MIGRATION",
        },
      });
    }
    report.findings.migrated++;
  }

  // ── Reconciliation report ─────────────────────────────────────────────────
  console.log("\n  Reconciliation report");
  console.log("  ─────────────────────");
  console.log(`  Audit types   : ${report.types.in} in → ${report.types.migrated} migrated, ${report.types.skipped} already present`);
  console.log(`  Templates     : ${report.templates.in} in → ${report.templates.migrated} migrated, ${report.templates.skipped} present · ${report.templates.questions} questions (${report.templates.clauseUnmapped} need a clause-mapping pass)`);
  console.log(`  Engagements   : ${report.engagements.in} in → ${report.engagements.migrated} migrated, ${report.engagements.skipped} present · ${report.engagements.responses} responses`);
  console.log(`  Findings      : ${report.findings.in} in → ${report.findings.migrated} migrated, ${report.findings.skipped} present · ${report.findings.capaRelinked} CAPA relinked`);
  if (report.unmapped.length) {
    console.log(`\n  Unmapped (${report.unmapped.length}):`);
    for (const u of report.unmapped) console.log(`    • ${u}`);
  }
  if (!RUN) console.log("\n  DRY-RUN — nothing written. Re-run with --run to apply, or --revert to undo a prior run.");
  else console.log("\n  Migration applied. Re-run is idempotent; use --revert to undo.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
