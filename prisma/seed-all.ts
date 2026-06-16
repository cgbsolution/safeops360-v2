// ────────────────────────────────────────────────────────────────────────
// FILE 20 — Master Loading Sequence  (Page Industries demo tenant)
//
// This is the CANONICAL loading order. Follow it exactly.
// Master data must load before transactional data.
// Competencies must load before role definitions.
// Users must exist before any records that reference them.
//
// Loading sequence:
//   Step  1 — Risk matrix + HIRA hazard library     (seed-hira-masters)
//   Step  2 — EAI aspect library                    (seed-eai-masters)
//   Step  3 — Workflow definitions                  (seed-workflows)
//   Step  4 — Master dropdown data                  (seed-masters)
//   Step  5 — Dropdown option lists                 (seed-dropdowns)
//   Step  6 — CAPA master data                      (seed-capa-masters)
//   Step  7 — Training program library              (seed-training-programs)
//   Step  8 — Competency library                    (seed-competency-library)
//   Step  9 — Plants + Areas + Users (Priya Nair ←) (seed)
//   Step 10 — RBAC role/permission matrix + user assignments (seed-rbac)
//   Step 11 — AI Agents                             (seed-agents)
//   Step 12 — Demo transactional state              (seed-demo-state)
//   Step 13 — Industry vertical tenants (10 companies) (seed-industry-tenants)
//   Step 14 — Activity data (Obs/NearMiss/PTW/FLRA/Incident ×10 per plant) (seed-activity-data)
//   Step 15 — Workflow trails for all DEMO- records        (seed-activity-workflows)
//             ↳ manhours (LTIFR 0.34)
//             ↳ 4 LTI incidents (last = 28 days ago)
//             ↳ 2 active permits (HOT_WORK + CONFINED_SPACE)
//   Step 16 — Promoted Near Miss → Incident pairs           (seed-promoted-near-miss)
//   Step 17 — Risk Management: HIRA studies                 (seed-risk-management)
//   Step 18 — Quality GMP: Deviations + OOS + Audits        (seed-quality-gmp)
//   Step 19 — People & Competency                           (seed-people-competency)
//   Step 20 — Assets & Inspection                           (seed-assets-inspection)
//   Step 21 — CAPA universal records                        (seed-capa)
//   Step 22 — MOC (Management of Change)                    (seed-moc)
//   Step 23 — Statutory Registers                           (seed-statutory-registers)
//   Step 24 — EAI Feature Flags                             (patch-eai-flags-all)
//   Step 25 — Anomaly detection records                     (seed-anomalies)
//   Step 26 — EAI Study data: studies + entries             (seed-eai-data)
//   Step 27 — EPC Site data: sites/workers/inductions/gates (seed-epc-data)
//   Step 28 — PPE Items, Issuances, Inspections, Batches    (seed-ppe-items)
//   Step 29 — SCI Ledger + Kaizen Wall posts                (seed-sci-data)
//   Step 30 — HIRA CAPAs                                    (seed-hira-capas)
//   Step 31 — Controlled Documents + Document Versions      (seed-docs-data)
//   Step 32 — GMP Audit Entries (Part 11 audit trail)       (seed-gmp-audit)
//   Step 33 — Historical activity data (12 mo × 5 modules × 2 plants) (seed-historical-data)
//
// QA checkpoint after loading:
//   • Dashboard shows: 28 days since LTI
//   • Trailing-12-month LTIFR = 0.34
//   • Active permits count = 2
//   • Demo primary login: priya.nair@safeops360.in / demo123
//
// Run:   npx tsx prisma/seed-all.ts
// Reset: npx prisma db push --force-reset && npx tsx prisma/seed-all.ts
// ────────────────────────────────────────────────────────────────────────

import { execSync } from "child_process";
import * as path from "path";

const PRISMA_DIR = path.resolve(__dirname);

function run(script: string, label: string) {
  const scriptPath = path.join(PRISMA_DIR, script);
  console.log(`\n${"─".repeat(60)}`);
  console.log(`▶  ${label}`);
  console.log(`   ${script}`);
  console.log("─".repeat(60));
  try {
    execSync(`npx tsx "${scriptPath}"`, { stdio: "inherit" });
    console.log(`✅  ${label} — done`);
  } catch (e) {
    console.error(`❌  ${label} — FAILED`);
    throw e;
  }
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║  FILE 20 — Page Industries Demo Loading Sequence  ║");
  console.log("╚═══════════════════════════════════════════════════════╝");
  console.log("  Demo tenant   : Page Industries Limited");
  console.log("  Plants        : NW (North Paper Mill) + SW (South Kraft & Board Mill)");
  console.log("  Primary login : priya.nair@safeops360.in / demo123");
  console.log("  QA target     : 28 days since LTI | LTIFR 0.34 | 2 active permits");
  console.log();

  const steps: [string, string][] = [
    ["seed-hira-masters.ts",    "Step  1 — Risk matrix + HIRA hazard library"],
    ["seed-eai-masters.ts",     "Step  2 — EAI aspect library"],
    ["seed-workflows.ts",       "Step  3 — Workflow definitions"],
    ["seed-masters.ts",         "Step  4 — Master dropdown data"],
    ["seed-dropdowns.ts",       "Step  5 — Dropdown option lists"],
    ["seed-capa-masters.ts",    "Step  6 — CAPA master data"],
    ["seed-training-programs.ts","Step  7 — Training program library"],
    ["seed-competency-library.ts","Step  8 — Competency library"],
    ["seed.ts",                 "Step  9 — Plants + Areas + Users (primary persona: Priya Nair)"],
    ["seed-rbac.ts",            "Step 10 — RBAC permission matrix + user-role assignments"],
    ["seed-agents.ts",          "Step 11 — AI Agents"],
    ["seed-demo-state.ts",      "Step 12 — Demo transactional state (manhours / incidents / permits)"],
    ["seed-industry-tenants.ts","Step 13 — Industry vertical tenants (10 companies)"],
    ["seed-activity-data.ts",        "Step 14 — Activity data: Obs / Near Miss / PTW / FLRA / Incident (×10 per plant)"],
    ["seed-activity-workflows.ts",   "Step 15 — Workflow audit trails + pending tasks for all DEMO- records"],
    ["seed-promoted-near-miss.ts",   "Step 16 — Promoted Near Miss → Incident pairs (1 per plant, NW + SW)"],
    ["seed-risk-management.ts",      "Step 17 — Risk Management: HIRA studies (5 per plant, full entries + workflow)"],
    ["seed-audit-compliance.ts",     "Step 18 — Audit & Compliance: Garments library (82cp) + 2 stubs + 3 templates + 4 demo audits"],
    ["seed-people-competency.ts",    "Step 19 — People & Competency: Training schedules + Competency records"],
    ["seed-assets-inspection.ts",    "Step 20 — Assets & Inspection: Equipment (10) + Inspections (10) per plant"],
    ["seed-capa.ts",                 "Step 21 — CAPA (Universal): 8 records per plant (all states, full sub-records + workflow)"],
    ["seed-moc.ts",                  "Step 22 — MOC (Management of Change): 6 records per plant (approval chain + impact assessment + workflow)"],
    ["seed-statutory-registers.ts",  "Step 23 — Statutory Registers: 8 registers per plant (FORM-18/20/22/11/12, CLRA-XIII, PESO-PV, FORM-7)"],
    ["patch-eai-flags-all.ts",       "Step 24 — EAI Feature Flags: enable eaiRegister + combinedRegister + riskDashboard + hiraAssistantV2 for all plants"],
    ["seed-anomalies.ts",            "Step 25 — Anomaly detection records (5 per plant × 2 plants)"],
    ["seed-eai-data.ts",             "Step 26 — EAI Study data: 2 studies + 4 entries + sub-records per plant"],
    ["seed-epc-data.ts",             "Step 27 — EPC Site data: 2 sites, 10 workers, mobilization, inductions, gate passes"],
    ["seed-ppe-items.ts",            "Step 28 — PPE Items (8) + Issuances (4) + Inspections (3) + Batches (2) per plant"],
    ["seed-sci-data.ts",             "Step 29 — SCI Ledger entries (10 per plant) + Kaizen Wall posts (6 per plant)"],
    ["seed-hira-capas.ts",           "Step 30 — HIRA CAPAs: 6 records linked to NW HIRA entries"],
    ["seed-historical-data.ts",      "Step 33 — Historical activity data: Obs/NearMiss/PTW/FLRA/Incident × 10-12/month × 12 months × 2 plants"],
    ["seed-erm.ts",                  "Step 34 — Enterprise Risk Management: taxonomy, matrix, 24 risks, assessments, treatments, rollups, linkages, reviews, snapshots, board pack"],
    ["seed-erm-p2.ts",               "Step 35 — ERM Phase 2: KRIs, appetite, compliance obligations, loss events"],
    ["seed-erm-p3.ts",               "Step 36 — ERM Phase 3: BCM (14 processes / 8 plans / crisis / 6 exercises) + scenarios + horizon"],
    ["seed-erm-t3.ts",               "Step 37 — ERM Tier 3: Internal Controls (22) + Vendor/ESG (16) + Insurance (11 policies/claims/gap)"],
    ["seed-cams.ts",                 "Step 38 — CAMS: 8 audit types + 4 clause-mapped templates + 3 recurrence rules + 14 engagements + ~16 findings (AUDIT-source CAPAs)"],
  ];

  const start = Date.now();
  for (const [script, label] of steps) {
    run(script, label);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n${"═".repeat(60)}`);
  console.log("  ALL STEPS COMPLETE");
  console.log(`  Total time: ${elapsed}s`);
  console.log(`${"═".repeat(60)}`);
  console.log();
  console.log("  QA CHECKPOINT — verify on dashboard before customer demo:");
  console.log("  ┌──────────────────────────────────────────────────────┐");
  console.log("  │  ✓ Days since last LTI = 28                          │");
  console.log("  │  ✓ Trailing-12-month LTIFR = 0.34                    │");
  console.log("  │  ✓ Active permits = 2                                │");
  console.log("  │  ✓ Primary login: priya.nair@safeops360.in / demo123 │");
  console.log("  └──────────────────────────────────────────────────────┘");
}

main().catch(e => {
  console.error("❌  Loading sequence aborted:", e?.message ?? e);
  process.exit(1);
});
