// ────────────────────────────────────────────────────────────────────────
// CAPA master data seed.
//
// Phase A of the CAPA generalization rollout (see CAPA_IMPLEMENTATION_PLAN.md).
// Idempotent: upsert on natural keys; safe to re-run.
//
// Seeds:
//   1. 6 source categories (Safety, Quality, Environmental, Organizational,
//      Regulatory, Other) with prefix codes per D4 numbering scheme
//   2. 17 source types per spec §3.3 taxonomy
//   3. Sub-category master (spec §15 — 10 generic categories with descriptions)
//   4. SLA profiles per source × severity per spec §4.4
//   5. Verification methods per spec §3.1 verification.method enum
//
// Run: npx tsx prisma/seed-capa-masters.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Source categories ────────────────────────────────────────────────

const CATEGORIES = [
  { code: "SAFETY",         name: "Safety",         prefix: "S", description: "Safety incidents, near misses, hazard controls — the original CAPA source for SafeOps360.", sortOrder: 1 },
  { code: "QUALITY",        name: "Quality",        prefix: "Q", description: "Quality NCRs, customer complaints, supplier issues, calibration failures, internal/external/regulatory audit findings of quality nature.", sortOrder: 2 },
  { code: "ENVIRONMENTAL",  name: "Environmental",  prefix: "E", description: "Environmental findings, emission exceedances, regulator notifications, EAI register actions.", sortOrder: 3 },
  { code: "ORGANIZATIONAL", name: "Organizational", prefix: "O", description: "Management review actions, training gaps, MOC actions, kaizen initiatives.", sortOrder: 4 },
  { code: "REGULATORY",     name: "Regulatory",     prefix: "R", description: "Regulatory inspection findings requiring corrective action.", sortOrder: 5 },
  { code: "OTHER",          name: "Other",          prefix: "X", description: "Manual / catch-all — CAPA raised without a specific source module reference.", sortOrder: 6 }
];

// ─── Source types ─────────────────────────────────────────────────────

const SOURCE_TYPES = [
  // Safety
  { code: "SAFETY_INCIDENT",   name: "Safety Incident",   category: "SAFETY", parentModuleLive: true,  parentModuleName: "INCIDENT",          sortOrder: 1, description: "Safety incident closure spawns a CAPA on root cause + corrective + preventive action." },
  { code: "SAFETY_OBSERVATION", name: "Safety Observation", category: "SAFETY", parentModuleLive: true,  parentModuleName: "OBSERVATION",       sortOrder: 2, description: "Unsafe-act/condition observation flagged as requiring corrective action." },
  { code: "NEAR_MISS",         name: "Near Miss",         category: "SAFETY", parentModuleLive: true,  parentModuleName: "NEAR_MISS",         sortOrder: 3, description: "Near-miss closure CAPA for high-potential incidents." },
  { code: "HIRA_CONTROL",      name: "HIRA Recommended Control", category: "SAFETY", parentModuleLive: true, parentModuleName: "HIRA",          sortOrder: 4, description: "HIRA entry recommended control becomes a CAPA when residual risk exceeds threshold." },
  { code: "INSPECTION_FINDING", name: "Inspection Finding", category: "SAFETY", parentModuleLive: true,  parentModuleName: "INSPECTION_FINDING", sortOrder: 5, description: "Inspection finding requiring corrective action." },

  // Quality
  { code: "AUDIT_INTERNAL",     name: "Internal Audit Finding",     category: "QUALITY", parentModuleLive: false, parentModuleName: null, sortOrder: 10, description: "Finding from an internal quality / process audit." },
  { code: "AUDIT_EXTERNAL",     name: "External Audit Finding",     category: "QUALITY", parentModuleLive: false, parentModuleName: null, sortOrder: 11, description: "Finding from a customer / certification-body audit (ISO 9001, IATF 16949, GFSI)." },
  { code: "AUDIT_REGULATORY",   name: "Regulatory Audit Finding",   category: "QUALITY", parentModuleLive: false, parentModuleName: null, sortOrder: 12, description: "Finding from a regulator (FDA, CPCB, state pollution control board)." },
  { code: "CUSTOMER_COMPLAINT", name: "Customer Complaint",         category: "QUALITY", parentModuleLive: false, parentModuleName: null, sortOrder: 13, description: "Complaint received from a customer about product / service / experience." },
  { code: "QUALITY_NCR",        name: "Quality NCR (Non-Conformance Report)", category: "QUALITY", parentModuleLive: false, parentModuleName: null, sortOrder: 14, description: "Non-conformance identified by quality inspection." },
  { code: "SUPPLIER_ISSUE",     name: "Supplier Issue",             category: "QUALITY", parentModuleLive: false, parentModuleName: null, sortOrder: 15, description: "Quality / delivery issue with an inbound supplier." },
  { code: "CALIBRATION_FAILURE", name: "Calibration Failure",       category: "QUALITY", parentModuleLive: false, parentModuleName: null, sortOrder: 16, description: "Instrument out of calibration; may impact products tested in the interval." },

  // Environmental
  { code: "ENVIRONMENTAL_FINDING", name: "Environmental Finding",   category: "ENVIRONMENTAL", parentModuleLive: false, parentModuleName: null, sortOrder: 20, description: "Emission / waste / permit / spill event requiring action." },
  { code: "EAI_ACTION",            name: "EAI Register Action",      category: "ENVIRONMENTAL", parentModuleLive: false, parentModuleName: null, sortOrder: 21, description: "Environmental Aspect & Impact register action item." },

  // Organizational
  { code: "MANAGEMENT_REVIEW_ACTION", name: "Management Review Action", category: "ORGANIZATIONAL", parentModuleLive: false, parentModuleName: null, sortOrder: 30, description: "Action item from a periodic management review meeting." },
  { code: "TRAINING_GAP",             name: "Training Gap",            category: "ORGANIZATIONAL", parentModuleLive: true,  parentModuleName: "TRAINING", sortOrder: 31, description: "Competency gap identified during training assessment, audit, or performance review." },
  { code: "MOC_ACTION",               name: "MOC Action",              category: "ORGANIZATIONAL", parentModuleLive: false, parentModuleName: null, sortOrder: 32, description: "Action arising from Management of Change implementation." },
  { code: "KAIZEN_INITIATIVE",        name: "Kaizen Initiative",       category: "ORGANIZATIONAL", parentModuleLive: false, parentModuleName: null, sortOrder: 33, description: "Continuous improvement initiative tracked as a CAPA." },
  { code: "ENTERPRISE_RCA",           name: "Enterprise RCA",          category: "ORGANIZATIONAL", parentModuleLive: true,  parentModuleName: "ERM",     sortOrder: 34, description: "Corrective action raised from an ERM Cross-Domain Root Cause Analysis (event/risk/loss-originated)." },

  // Regulatory
  { code: "REGULATORY_INSPECTION_FINDING", name: "Regulatory Inspection Finding", category: "REGULATORY", parentModuleLive: false, parentModuleName: null, sortOrder: 40, description: "Finding from a regulatory inspection (Factories Inspector, DGFASLI, etc.)." },

  // Other
  { code: "MANUAL",                  name: "Manual",                    category: "OTHER", parentModuleLive: true, parentModuleName: null, sortOrder: 50, description: "Free-form CAPA raised without a specific source module — rationale required." }
];

// ─── Sub-categories ───────────────────────────────────────────────────

const SUB_CATEGORIES = [
  { code: "EQUIPMENT",       name: "Equipment-related",    description: "Equipment failure, design, maintenance, capacity, or specification deficiency." },
  { code: "PROCESS",         name: "Process-related",      description: "Process flow, sequence, parameters, or hand-off deficiency." },
  { code: "MATERIAL",        name: "Material-related",     description: "Raw material, consumable, or component quality / availability / specification issue." },
  { code: "HUMAN_FACTORS",   name: "Human factors",        description: "Skill, knowledge, fatigue, workload, communication, or competency gap." },
  { code: "ENVIRONMENTAL",   name: "Environmental",        description: "Ambient conditions, ergonomics, layout, lighting affecting the activity." },
  { code: "DOCUMENTATION",   name: "Documentation",        description: "SOP missing, outdated, ambiguous, or not followed." },
  { code: "TRAINING",        name: "Training",             description: "Training programme deficiency, scope gap, or refresher missed." },
  { code: "SUPPLIER",        name: "Supplier-related",     description: "External supplier quality, delivery, or specification issue." },
  { code: "CUSTOMER",        name: "Customer-related",     description: "Customer requirement clarity, expectation mismatch, or service experience." },
  { code: "REGULATORY",      name: "Regulatory",           description: "Compliance with statute, code, or licence condition." }
];

// ─── SLA profiles per spec §4.4 ───────────────────────────────────────

const SLA_PROFILES = [
  // Safety
  { code: "SAFETY_INCIDENT_LTI",    sourceTypeCode: "SAFETY_INCIDENT",     severity: "CRITICAL", initialResponseHours: 1,   rcaDueDays: 7,  actionsPlannedDueDays: 14, closureTargetDays: 60,  recurrenceCheckDays: 180 },
  { code: "SAFETY_INCIDENT_FAC",    sourceTypeCode: "SAFETY_INCIDENT",     severity: "MODERATE", initialResponseHours: 24,  rcaDueDays: 14, actionsPlannedDueDays: 21, closureTargetDays: 90,  recurrenceCheckDays: 90 },
  { code: "SAFETY_OBSERVATION_DEF", sourceTypeCode: "SAFETY_OBSERVATION",  severity: null,       initialResponseHours: 48,  rcaDueDays: 30, actionsPlannedDueDays: 45, closureTargetDays: 120, recurrenceCheckDays: 60 },
  { code: "NEAR_MISS_DEF",          sourceTypeCode: "NEAR_MISS",           severity: null,       initialResponseHours: 24,  rcaDueDays: 14, actionsPlannedDueDays: 21, closureTargetDays: 90,  recurrenceCheckDays: 90 },
  { code: "HIRA_CONTROL_DEF",       sourceTypeCode: "HIRA_CONTROL",        severity: null,       initialResponseHours: 168, rcaDueDays: 30, actionsPlannedDueDays: 60, closureTargetDays: 180, recurrenceCheckDays: 90 },
  { code: "INSPECTION_FINDING_DEF", sourceTypeCode: "INSPECTION_FINDING",  severity: null,       initialResponseHours: 72,  rcaDueDays: 14, actionsPlannedDueDays: 21, closureTargetDays: 60,  recurrenceCheckDays: 60 },

  // Quality
  { code: "AUDIT_INTERNAL_DEF",     sourceTypeCode: "AUDIT_INTERNAL",      severity: null,       initialResponseHours: 168, rcaDueDays: 30, actionsPlannedDueDays: 60, closureTargetDays: 180, recurrenceCheckDays: 90 },
  { code: "AUDIT_EXTERNAL_DEF",     sourceTypeCode: "AUDIT_EXTERNAL",      severity: null,       initialResponseHours: 24,  rcaDueDays: 21, actionsPlannedDueDays: 30, closureTargetDays: 90,  recurrenceCheckDays: 90 },
  { code: "AUDIT_REGULATORY_DEF",   sourceTypeCode: "AUDIT_REGULATORY",    severity: null,       initialResponseHours: 24,  rcaDueDays: 14, actionsPlannedDueDays: 21, closureTargetDays: 60,  recurrenceCheckDays: 180 },
  { code: "CUSTOMER_COMPLAINT_DEF", sourceTypeCode: "CUSTOMER_COMPLAINT",  severity: null,       initialResponseHours: 24,  rcaDueDays: 21, actionsPlannedDueDays: 30, closureTargetDays: 60,  recurrenceCheckDays: 60 },
  { code: "QUALITY_NCR_DEF",        sourceTypeCode: "QUALITY_NCR",         severity: null,       initialResponseHours: 24,  rcaDueDays: 14, actionsPlannedDueDays: 21, closureTargetDays: 90,  recurrenceCheckDays: 90 },
  { code: "SUPPLIER_ISSUE_DEF",     sourceTypeCode: "SUPPLIER_ISSUE",      severity: null,       initialResponseHours: 48,  rcaDueDays: 21, actionsPlannedDueDays: 30, closureTargetDays: 90,  recurrenceCheckDays: 90 },
  { code: "CALIBRATION_FAILURE_DEF", sourceTypeCode: "CALIBRATION_FAILURE", severity: null,      initialResponseHours: 4,   rcaDueDays: 7,  actionsPlannedDueDays: 14, closureTargetDays: 45,  recurrenceCheckDays: 60 },

  // Environmental
  { code: "ENVIRONMENTAL_FINDING_DEF", sourceTypeCode: "ENVIRONMENTAL_FINDING", severity: null,  initialResponseHours: 4,   rcaDueDays: 7,  actionsPlannedDueDays: 14, closureTargetDays: 60,  recurrenceCheckDays: 90 },
  { code: "EAI_ACTION_DEF",            sourceTypeCode: "EAI_ACTION",            severity: null,  initialResponseHours: 168, rcaDueDays: 30, actionsPlannedDueDays: 60, closureTargetDays: 180, recurrenceCheckDays: 90 },

  // Organizational
  { code: "MANAGEMENT_REVIEW_ACTION_DEF", sourceTypeCode: "MANAGEMENT_REVIEW_ACTION", severity: null, initialResponseHours: 168, rcaDueDays: 30, actionsPlannedDueDays: 60, closureTargetDays: 120, recurrenceCheckDays: 90 },
  { code: "TRAINING_GAP_DEF",            sourceTypeCode: "TRAINING_GAP",        severity: null, initialResponseHours: 168, rcaDueDays: 30, actionsPlannedDueDays: 60, closureTargetDays: 120, recurrenceCheckDays: 90 },
  { code: "MOC_ACTION_DEF",              sourceTypeCode: "MOC_ACTION",          severity: null, initialResponseHours: 72,  rcaDueDays: 14, actionsPlannedDueDays: 21, closureTargetDays: 60,  recurrenceCheckDays: 90 },
  { code: "KAIZEN_INITIATIVE_DEF",       sourceTypeCode: "KAIZEN_INITIATIVE",   severity: null, initialResponseHours: 336, rcaDueDays: 30, actionsPlannedDueDays: 60, closureTargetDays: 180, recurrenceCheckDays: 90 },

  // Regulatory
  { code: "REGULATORY_INSPECTION_FINDING_DEF", sourceTypeCode: "REGULATORY_INSPECTION_FINDING", severity: null, initialResponseHours: 24, rcaDueDays: 14, actionsPlannedDueDays: 21, closureTargetDays: 60, recurrenceCheckDays: 180 },

  // Other (manual fallback)
  { code: "MANUAL_DEF",     sourceTypeCode: "MANUAL",     severity: null, initialResponseHours: 168, rcaDueDays: 30, actionsPlannedDueDays: 60, closureTargetDays: 180, recurrenceCheckDays: 90 },

  // Universal fallback — used when no source-type-specific profile matches
  { code: "GLOBAL_DEFAULT", sourceTypeCode: null,         severity: null, initialResponseHours: 48,  rcaDueDays: 14, actionsPlannedDueDays: 21, closureTargetDays: 60,  recurrenceCheckDays: 90 }
];

// ─── Verification methods ─────────────────────────────────────────────

const VERIFICATION_METHODS = [
  { code: "REVIEW_METRICS",      name: "Review of operational metrics",          description: "Compare KPIs / metrics before and after implementation against success criteria.", sortOrder: 1 },
  { code: "AUDIT_CHECK",         name: "Follow-up audit check",                  description: "Audit the affected process / equipment / area against the same checklist that surfaced the issue.", sortOrder: 2 },
  { code: "INSPECTION",          name: "Physical inspection",                     description: "On-site inspection of the affected equipment / area / installation.", sortOrder: 3 },
  { code: "TEST",                name: "Functional / performance test",           description: "Repeat the test or procedure that originally identified the issue.", sortOrder: 4 },
  { code: "OBSERVATION",         name: "Behavioural observation",                 description: "Observe the activity in normal operation to confirm compliance with the new control.", sortOrder: 5 },
  { code: "TREND_ANALYSIS",      name: "Trend analysis on recurring data",        description: "Analyse the trend over the measurement period — incident rates, defect rates, complaint volumes.", sortOrder: 6 },
  { code: "CUSTOMER_FEEDBACK",   name: "Customer / stakeholder feedback",         description: "Survey or interview the affected customer / stakeholder.", sortOrder: 7 },
  { code: "MULTIPLE",            name: "Multiple methods combined",                description: "Combination of two or more methods — typical for HIGH/CRITICAL severity.", sortOrder: 8 }
];

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("🛡️   CAPA masters seed");

  // 1. Source categories
  const categoryByCode = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.capaSourceCategory.upsert({
      where: { code: c.code },
      create: c,
      update: { name: c.name, description: c.description, prefix: c.prefix, sortOrder: c.sortOrder }
    });
    categoryByCode.set(c.code, row.id);
  }
  console.log(`   source categories: ${CATEGORIES.length}`);

  // 2. Source types
  for (const t of SOURCE_TYPES) {
    const categoryId = categoryByCode.get(t.category);
    if (!categoryId) continue;
    await prisma.capaSourceType.upsert({
      where: { code: t.code },
      create: {
        code: t.code,
        name: t.name,
        description: t.description,
        categoryId,
        parentModuleLive: t.parentModuleLive,
        parentModuleName: t.parentModuleName,
        sortOrder: t.sortOrder
      },
      update: {
        name: t.name,
        description: t.description,
        categoryId,
        parentModuleLive: t.parentModuleLive,
        parentModuleName: t.parentModuleName,
        sortOrder: t.sortOrder
      }
    });
  }
  console.log(`   source types: ${SOURCE_TYPES.length}`);

  // 3. Sub-categories
  for (const s of SUB_CATEGORIES) {
    await prisma.capaSubCategory.upsert({
      where: { code: s.code },
      create: s,
      update: { name: s.name, description: s.description }
    });
  }
  console.log(`   sub-categories: ${SUB_CATEGORIES.length}`);

  // 4. SLA profiles
  for (const p of SLA_PROFILES) {
    await prisma.capaSlaProfile.upsert({
      where: { code: p.code },
      create: p,
      update: p
    });
  }
  console.log(`   SLA profiles: ${SLA_PROFILES.length}`);

  // 5. Verification methods
  for (const m of VERIFICATION_METHODS) {
    await prisma.capaVerificationMethod.upsert({
      where: { code: m.code },
      create: m,
      update: { name: m.name, description: m.description, sortOrder: m.sortOrder }
    });
  }
  console.log(`   verification methods: ${VERIFICATION_METHODS.length}`);

  console.log("✅  CAPA masters seed complete.");
}

main()
  .catch((e) => {
    console.error("❌  CAPA masters seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
