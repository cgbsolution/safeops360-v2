// Seeds workflow definitions for all 8 modules.
// Idempotent — safe to run repeatedly. Does NOT delete records / users / plants.
//
// Run with:  npm run db:seed-workflows

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type StepInput = {
  sequence: number;
  stepType: "MAKER" | "CHECKER" | "ASSIGNEE_TASK" | "VERIFIER" | "CLOSURE";
  name: string;
  approverRole?: string;
  approverField?: string;
  approverGroupRoles?: string;
  slaHours?: number;
  escalationRole?: string;
  isOptional?: boolean;
  conditionExpr?: Record<string, any>;
  // Parallel strategy: JOINT_APPROVAL (one task per role in
  // approverGroupRoles, all must complete), CAPA_FAN_OUT (one task per
  // child CAPA row), or HIRA_TEAM_FAN_OUT (one task per HiraStudyTeamMember
  // for the study sign-off step). Engine handles all in workflow_engine.py.
  parallelStrategy?: "JOINT_APPROVAL" | "CAPA_FAN_OUT" | "HIRA_TEAM_FAN_OUT" | "CAPA_ACTION_FAN_OUT";
  // Severity-driven SLA override map. Engine picks the matching key
  // based on the parent record's potentialSeverity / severity, falls
  // back to slaHours when absent.
  slaBySeverity?: Record<string, number>;
  notes?: string;
};

type DefInput = {
  module: string;
  recordType?: string;
  name: string;
  description: string;
  steps: StepInput[];
};

// Role assignment policy:
//   - Section Head reviews → SUPERVISOR (with HSE_MANAGER escalation fallback)
//   - Verification (separation of duties from approver) → SAFETY_OFFICER
//   - Closure → HSE_MANAGER (operational) / PLANT_HEAD (regulated incidents)
//   - PTW Issuer → PERMIT_ISSUER, Safety review → SAFETY_OFFICER
//   - Plant-head approvals (high-risk PTW, incident final close) → PLANT_HEAD
//   - Corporate Manhours lock → CORPORATE_HSE
// If no user with the target role exists at the record's plant, the engine
// (findUserByRoles in workflow/engine.ts) falls back to a global match, then
// to the escalationRole. This keeps demos and small plants unblocked.

const DEFINITIONS: DefInput[] = [
  // ─── 1. Safety Observation ─────────────────────────────────────────────
  {
    // 4 steps, not 5. "Section Head Review" was removed: its only real output
    // was naming the action owner, and that is now a field on the maker form
    // (Observation.responsiblePersonId, set at submit). What remained was a 24h
    // approval gate between someone reporting a hazard and anyone being asked
    // to fix it. Verification and closure are still separate, independent
    // hands — the review that matters is on the fix, not on the report.
    //
    // `approverField: ACTION_OWNER` now resolves the value the observer picked;
    // blank falls back to the initiator (the observer). See
    // services/workflow_engine._resolve_assignee.
    //
    // On an existing database this seeder is NOT how you apply the change —
    // it re-mints step ids and orphans in-flight instances. Use
    // Safeops360-backend/scripts/observation_4_step.py, which reshapes the
    // definition in place.
    module: "OBSERVATION",
    name: "Safety Observation — Standard Workflow",
    description: "Observation lifecycle: Observer → Action Owner → HSE Officer → HSE Manager",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Submitted by Observer" },
      { sequence: 2, stepType: "ASSIGNEE_TASK", name: "Action Owner Executes", approverField: "ACTION_OWNER", slaHours: 168, escalationRole: "HSE_MANAGER" },
      { sequence: 3, stepType: "VERIFIER", name: "HSE Officer Verification", approverRole: "SAFETY_OFFICER", slaHours: 24, escalationRole: "HSE_MANAGER" },
      { sequence: 4, stepType: "CLOSURE", name: "HSE Manager Closure", approverRole: "HSE_MANAGER" }
    ]
  },

  // ─── 2. Near Miss — Production-Depth (Commit 3) ──────────────────────
  // 7 steps: Maker → Joint Review (parallel × 2) → CAPA Definition →
  //          CAPA Execution (parallel fan-out) → Verification →
  //          Final Closure → Closed.
  // Critical-severity near misses bypass this flow at submission via
  // the auto-promotion service (see safeops_360_bakend/app/services/
  // auto_promote_near_miss.py).
  {
    module: "NEAR_MISS",
    name: "Near Miss — Production Workflow",
    description:
      "Reporter → Joint Review (HSE Mgr + Section Head, parallel) → CAPA Definition → CAPA Execution (parallel) → Verification → Final Closure",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Reported" },
      {
        sequence: 2,
        stepType: "CHECKER",
        name: "Joint Review",
        // ["HSE_MANAGER","DEPARTMENT_HEAD"] — both roles hold
        // NEAR_MISS.APPROVE per the RBAC matrix (HSE_MANAGER at PLANT
        // scope, DEPARTMENT_HEAD at DEPT scope). "Section Head" in the
        // brief = DEPARTMENT_HEAD here. Using SUPERVISOR would conflict
        // with the matrix (SUPERVISOR has no NEAR_MISS.APPROVE) and
        // produce "Missing permission 'NEAR_MISS.APPROVE'" at click time.
        approverGroupRoles: JSON.stringify(["HSE_MANAGER", "DEPARTMENT_HEAD"]),
        parallelStrategy: "JOINT_APPROVAL",
        slaBySeverity: { LOW: 72, MEDIUM: 48, HIGH: 24, CRITICAL: 8 },
        escalationRole: "PLANT_HEAD",
        notes:
          "Plant HSE Manager and Department Head (Section Head) review in parallel. Both must approve to advance. Either can reject (returns to Maker) or upgrade severity (upgrade to Critical triggers auto-promotion mid-flow)."
      },
      {
        sequence: 3,
        stepType: "CHECKER",
        name: "Review Meeting & CAPA Definition",
        approverRole: "HSE_MANAGER",
        slaHours: 48,
        escalationRole: "PLANT_HEAD",
        notes:
          "HSE Manager (lead) defines multiple CAPAs from the joint review discussion. Each CAPA gets its own owner and target date — they fan out into parallel execution tasks at the next step."
      },
      {
        sequence: 4,
        stepType: "ASSIGNEE_TASK",
        name: "CAPA Execution",
        parallelStrategy: "CAPA_FAN_OUT",
        slaBySeverity: { LOW: 720, MEDIUM: 336, HIGH: 168, CRITICAL: 72 },
        escalationRole: "HSE_MANAGER",
        notes:
          "One execution task per CAPA. Each owner submits action-taken narrative + evidence. The workflow advances to verification only when all CAPAs are completed."
      },
      {
        sequence: 5,
        stepType: "VERIFIER",
        name: "HSE Manager Verifies CAPAs",
        approverRole: "HSE_MANAGER",
        slaHours: 120,
        escalationRole: "PLANT_HEAD",
        notes:
          "HSE Manager reviews each CAPA's evidence, sets an overall effectiveness rating (1–5). Individual CAPAs may be rejected without resetting verified ones — handled in the per-CAPA UI (Commit 4)."
      },
      {
        sequence: 6,
        stepType: "CLOSURE",
        name: "Final Closure",
        approverRole: "HSE_MANAGER",
        slaHours: 48,
        notes:
          "Closing remark + lessons learned (mandatory). Triggers post-closure rules engine (Dimension 4) and schedules the 90-day effectiveness review."
      }
    ]
  },

  // ─── 3. PTW — General Cold Work ────────────────────────────────────────
  // Cold work is the low-risk permit type and runs a 4-step chain: the
  // Safety Officer Review that the high-risk types carry is deliberately
  // NOT here. Issuer review plus receiver acknowledgement are the controls.
  // Keep this at 4 steps — it is the shape live Cold Work instances run on
  // (see scripts/ptw_cold_work_4_step.py in the backend repo, which made
  // the same change in place so existing instances kept their step ids).
  {
    module: "PTW",
    recordType: "GENERAL_COLD",
    name: "PTW — Cold Work",
    description:
      "Low-risk cold work — 4 steps: Originator submits → Issuer reviews → Receiver acknowledges (+ FLRA) → Issuer closes the permit.",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Originator Submits" },
      { sequence: 2, stepType: "CHECKER", name: "Issuer Review", approverRole: "PERMIT_ISSUER", slaHours: 4, escalationRole: "HSE_MANAGER" },
      { sequence: 3, stepType: "ASSIGNEE_TASK", name: "Receiver Acknowledges + FLRA", approverField: "RECEIVER", slaHours: 8, escalationRole: "HSE_MANAGER" },
      { sequence: 4, stepType: "CLOSURE", name: "Issuer Closes Permit", approverRole: "PERMIT_ISSUER", escalationRole: "HSE_MANAGER" }
    ]
  },

  // ─── 3. PTW — High-risk types (Hot Work, Confined Space, etc.) ────────
  {
    module: "PTW",
    recordType: "HOT_WORK",
    name: "PTW — Hot Work (high-risk)",
    description: "Issuer → Safety Officer → Plant Head → FLRA → Active → Close",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Originator Submits" },
      { sequence: 2, stepType: "CHECKER", name: "Issuer Review", approverRole: "PERMIT_ISSUER", slaHours: 2, escalationRole: "HSE_MANAGER" },
      { sequence: 3, stepType: "CHECKER", name: "Safety Officer Review", approverRole: "SAFETY_OFFICER", slaHours: 2, escalationRole: "HSE_MANAGER" },
      { sequence: 4, stepType: "CHECKER", name: "Plant Head Approval", approverRole: "PLANT_HEAD", slaHours: 4 },
      { sequence: 5, stepType: "ASSIGNEE_TASK", name: "Receiver Acknowledges + FLRA", approverField: "RECEIVER", slaHours: 4, escalationRole: "HSE_MANAGER" },
      { sequence: 6, stepType: "CLOSURE", name: "Safety Officer Closes", approverRole: "SAFETY_OFFICER", escalationRole: "HSE_MANAGER" }
    ]
  },
  {
    module: "PTW",
    recordType: "CONFINED_SPACE",
    name: "PTW — Confined Space",
    description: "Strict approval: Issuer → Safety Officer → Plant Head; gas test refresh enforced",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Originator Submits" },
      { sequence: 2, stepType: "CHECKER", name: "Issuer Review", approverRole: "PERMIT_ISSUER", slaHours: 2, escalationRole: "HSE_MANAGER" },
      { sequence: 3, stepType: "CHECKER", name: "Safety Officer Review", approverRole: "SAFETY_OFFICER", slaHours: 2, escalationRole: "HSE_MANAGER" },
      { sequence: 4, stepType: "CHECKER", name: "Plant Head Approval", approverRole: "PLANT_HEAD", slaHours: 4 },
      { sequence: 5, stepType: "ASSIGNEE_TASK", name: "Receiver Acknowledges + FLRA + Gas Test", approverField: "RECEIVER", slaHours: 4, escalationRole: "HSE_MANAGER" },
      { sequence: 6, stepType: "CLOSURE", name: "Safety Officer Closes", approverRole: "SAFETY_OFFICER", escalationRole: "HSE_MANAGER" }
    ]
  },

  // ─── 3. PTW — Work at Height (Plant Head approval required) ───────────
  {
    module: "PTW",
    recordType: "WORK_AT_HEIGHT",
    name: "PTW — Work at Height",
    description: "Issuer → Safety Officer → Plant Head → Receiver + FLRA → Close",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Originator Submits" },
      { sequence: 2, stepType: "CHECKER", name: "Issuer Review", approverRole: "PERMIT_ISSUER", slaHours: 2, escalationRole: "HSE_MANAGER" },
      { sequence: 3, stepType: "CHECKER", name: "Safety Officer Review", approverRole: "SAFETY_OFFICER", slaHours: 2, escalationRole: "HSE_MANAGER" },
      { sequence: 4, stepType: "CHECKER", name: "Plant Head Approval", approverRole: "PLANT_HEAD", slaHours: 4 },
      { sequence: 5, stepType: "ASSIGNEE_TASK", name: "Receiver Acknowledges + FLRA", approverField: "RECEIVER", slaHours: 4, escalationRole: "HSE_MANAGER" },
      { sequence: 6, stepType: "CLOSURE", name: "Safety Officer Closes", approverRole: "SAFETY_OFFICER", escalationRole: "HSE_MANAGER" }
    ]
  },

  // ─── 3. PTW — Excavation (Plant Head approval required) ───────────────
  {
    module: "PTW",
    recordType: "EXCAVATION",
    name: "PTW — Excavation",
    description: "Issuer → Safety Officer → Plant Head → Receiver + FLRA → Close",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Originator Submits" },
      { sequence: 2, stepType: "CHECKER", name: "Issuer Review", approverRole: "PERMIT_ISSUER", slaHours: 2, escalationRole: "HSE_MANAGER" },
      { sequence: 3, stepType: "CHECKER", name: "Safety Officer Review", approverRole: "SAFETY_OFFICER", slaHours: 2, escalationRole: "HSE_MANAGER" },
      { sequence: 4, stepType: "CHECKER", name: "Plant Head Approval", approverRole: "PLANT_HEAD", slaHours: 4 },
      { sequence: 5, stepType: "ASSIGNEE_TASK", name: "Receiver Acknowledges + FLRA", approverField: "RECEIVER", slaHours: 4, escalationRole: "HSE_MANAGER" },
      { sequence: 6, stepType: "CLOSURE", name: "Safety Officer Closes", approverRole: "SAFETY_OFFICER", escalationRole: "HSE_MANAGER" }
    ]
  },

  // ─── 3. PTW — Electrical / LOTO (Plant Head approval required) ────────
  {
    module: "PTW",
    recordType: "ELECTRICAL_LOTO",
    name: "PTW — Electrical / LOTO",
    description: "Issuer → Safety Officer → Plant Head → Receiver + FLRA → Close",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Originator Submits" },
      { sequence: 2, stepType: "CHECKER", name: "Issuer Review", approverRole: "PERMIT_ISSUER", slaHours: 2, escalationRole: "HSE_MANAGER" },
      { sequence: 3, stepType: "CHECKER", name: "Safety Officer Review", approverRole: "SAFETY_OFFICER", slaHours: 2, escalationRole: "HSE_MANAGER" },
      { sequence: 4, stepType: "CHECKER", name: "Plant Head Approval", approverRole: "PLANT_HEAD", slaHours: 4 },
      { sequence: 5, stepType: "ASSIGNEE_TASK", name: "Receiver Acknowledges + FLRA + LOTO", approverField: "RECEIVER", slaHours: 4, escalationRole: "HSE_MANAGER" },
      { sequence: 6, stepType: "CLOSURE", name: "Safety Officer Closes", approverRole: "SAFETY_OFFICER", escalationRole: "HSE_MANAGER" }
    ]
  },

  // ─── PTW — Lifting Operations (Plant Head approval required) ─────────
  {
    module: "PTW",
    recordType: "LIFTING",
    name: "PTW — Lifting Operations",
    description: "Issuer → Safety Officer → Plant Head → Receiver + FLRA → Close",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Originator Submits" },
      { sequence: 2, stepType: "CHECKER", name: "Issuer Review", approverRole: "PERMIT_ISSUER", slaHours: 2, escalationRole: "HSE_MANAGER" },
      { sequence: 3, stepType: "CHECKER", name: "Safety Officer Review", approverRole: "SAFETY_OFFICER", slaHours: 2, escalationRole: "HSE_MANAGER" },
      { sequence: 4, stepType: "CHECKER", name: "Plant Head Approval", approverRole: "PLANT_HEAD", slaHours: 4 },
      { sequence: 5, stepType: "ASSIGNEE_TASK", name: "Receiver Acknowledges + FLRA", approverField: "RECEIVER", slaHours: 4, escalationRole: "HSE_MANAGER" },
      { sequence: 6, stepType: "CLOSURE", name: "Safety Officer Closes", approverRole: "SAFETY_OFFICER", escalationRole: "HSE_MANAGER" }
    ]
  },

  // ─── 4. Incident Investigation — production-depth refactor ──────────────
  // 11-step lifecycle with severity-driven SLAs and conditional steps:
  //
  //   1. First Responder Reports                           (Maker)
  //   2. HSE Manager Classification                        (Checker)
  //   3. Investigation Team RCA + CAPA Definition          (Assignee — investigation lead)
  //   4. HSE Manager Reviews Investigation Report          (Checker)
  //   5. Plant Head Approves Final Report                  (Checker — skip for FAC)
  //   6. Corporate HSE Reviews                             (Checker — LTI/Fatality only)
  //   7. CAPA Execution                                    (parallel Assignees, one per CAPA)
  //   8. Safety Officer Verifies CAPAs                     (Verifier)
  //   9. Statutory Forms Submission                        (Assignee — only if reportable)
  //  10. Plant Head Final Close                            (Closure — FAC/MTC/RWC)
  //  11. Plant Head + Corporate HSE Joint Close            (Closure — LTI/Fatality, JOINT_APPROVAL)
  //
  // Severity-driven SLA on Investigation: FAC=168h(7d), MTC/RWC=336h(14d),
  // LTI=720h(30d), Fatality=1440h(60d). Engine resolves slaBySeverity.severity
  // from recordData (set on Phase 1 submit).
  //
  // Effectiveness review (90 days post-closure) is a scheduled task spawned
  // by the post-closure rules engine in Commit 7, not a workflow step.
  {
    module: "INCIDENT",
    name: "Incident Investigation — Severity-driven",
    description:
      "First Responder → HSE Classify → Investigate → Reviews → CAPAs → Verify → Statutory → Close. " +
      "FAC skips Plant Head review; LTI/Fatality require Corporate HSE review and joint close.",
    steps: [
      // 1. Maker
      {
        sequence: 1,
        stepType: "MAKER",
        name: "First Responder Reports",
        notes:
          "Initial report within 1 hour of occurrence. Plant HSE Manager notified on submit; " +
          "Plant Head + Corporate HSE notified for High/Critical severity."
      },

      // 2. Classification — HSE Manager (24h SLA)
      {
        sequence: 2,
        stepType: "CHECKER",
        name: "HSE Manager Classification",
        approverRole: "HSE_MANAGER",
        slaHours: 24,
        escalationRole: "PLANT_HEAD",
        notes:
          "Confirm/refine type, severity, statutory reportability. Constitute the " +
          "investigation team and pick the team lead."
      },

      // 3. Investigation — by team lead, severity-driven SLA (FAC=7d → Fatality=60d)
      {
        sequence: 3,
        stepType: "ASSIGNEE_TASK",
        name: "Investigation Team RCA + CAPA Definition",
        approverField: "INVESTIGATION_LEAD",
        slaHours: 168, // default = 7 days (FAC)
        slaBySeverity: { LOW: 168, MEDIUM: 336, HIGH: 720, CRITICAL: 1440 },
        escalationRole: "HSE_MANAGER",
        notes:
          "Build timeline, gather evidence, take witness statements, perform RCA, " +
          "define CAPAs. Submission of the investigation report advances the workflow."
      },

      // 4. HSE Manager Review — 5d SLA, can return for rework
      {
        sequence: 4,
        stepType: "CHECKER",
        name: "HSE Manager Reviews Investigation Report",
        approverRole: "HSE_MANAGER",
        slaHours: 120,
        escalationRole: "PLANT_HEAD",
        notes:
          "Review the full report. Approve, return for rework, or escalate severity " +
          "(triggers reclassification flow)."
      },

      // 5. Plant Head Review — skip for FAC
      {
        sequence: 5,
        stepType: "CHECKER",
        name: "Plant Head Approves Final Report",
        approverRole: "PLANT_HEAD",
        slaHours: 72,
        conditionExpr: { severity: ["MEDIUM", "HIGH", "CRITICAL"] },
        notes:
          "Plant-wide accountability. FAC (severity=LOW) skips this step and goes " +
          "straight to CAPA Execution after HSE review."
      },

      // 6. Corporate HSE Review — LTI/Fatality only
      {
        sequence: 6,
        stepType: "CHECKER",
        name: "Corporate HSE Reviews",
        approverRole: "CORPORATE_HSE",
        slaHours: 72,
        conditionExpr: { severity: ["HIGH", "CRITICAL"] },
        notes:
          "Corporate oversight for LTI (severity=HIGH) and Fatality / Process Safety " +
          "(severity=CRITICAL). Lower severities skip this step."
      },

      // 7. CAPA Execution — parallel, one task per IncidentCapa row
      {
        sequence: 7,
        stepType: "ASSIGNEE_TASK",
        name: "CAPA Execution",
        approverField: "ACTION_OWNER",
        slaHours: 720,
        parallelStrategy: "CAPA_FAN_OUT",
        escalationRole: "HSE_MANAGER",
        notes:
          "Engine spawns one task per IncidentCapa row. Each owner uploads evidence " +
          "(before / after photos, files). Workflow waits at this step until all CAPAs " +
          "are submitted; per-CAPA rework is allowed without resetting the others."
      },

      // 8. Safety Officer Verifies CAPAs — per-CAPA verification
      {
        sequence: 8,
        stepType: "VERIFIER",
        name: "Safety Officer Verifies CAPAs",
        approverRole: "SAFETY_OFFICER",
        slaHours: 48,
        escalationRole: "HSE_MANAGER",
        notes:
          "Per-CAPA approve/reject. Reject sends a single CAPA back to its owner " +
          "without disturbing the others. On all-approved, advances."
      },

      // 9. Statutory Submission — only if reportable
      {
        sequence: 9,
        stepType: "ASSIGNEE_TASK",
        name: "Statutory Forms Submission",
        approverRole: "HSE_MANAGER",
        slaHours: 24,
        conditionExpr: { isReportable: [true] },
        escalationRole: "PLANT_HEAD",
        notes:
          "File Form 18 (Factories Act) and DGFASLI / CPCB submissions per the " +
          "reportableUnder list. Cannot close incident without this step when reportable."
      },

      // 10. Plant Head Final Close — FAC / MTC / RWC (LOW + MEDIUM severity)
      {
        sequence: 10,
        stepType: "CLOSURE",
        name: "Plant Head Final Close",
        approverRole: "PLANT_HEAD",
        slaHours: 48,
        conditionExpr: { severity: ["LOW", "MEDIUM"] },
        notes:
          "Plant Head closes alone for FAC / MTC / RWC. Closing remark + lessons " +
          "learned mandatory. Triggers post-closure rules engine."
      },

      // 11. Plant Head + Corporate HSE Joint Close — LTI / Fatality (HIGH + CRITICAL)
      {
        sequence: 11,
        stepType: "CLOSURE",
        name: "Plant Head + Corporate HSE Joint Close",
        approverGroupRoles: JSON.stringify(["PLANT_HEAD", "CORPORATE_HSE"]),
        parallelStrategy: "JOINT_APPROVAL",
        slaHours: 72,
        slaBySeverity: { HIGH: 72, CRITICAL: 120 },
        conditionExpr: { severity: ["HIGH", "CRITICAL"] },
        notes:
          "LTI / Fatality require both Plant Head and Corporate HSE to sign off. " +
          "Engine spawns two parallel CLOSURE tasks; both must approve before closure."
      }
    ]
  },

  // ─── 5. Training ───────────────────────────────────────────────────────
  {
    module: "TRAINING",
    name: "Training — Standard",
    description: "L&D schedules, HSE approves nominees, trainer executes, certificate auto-issued",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "L&D Schedules" },
      { sequence: 2, stepType: "CHECKER", name: "HSE Manager Approves Nominees", approverRole: "HSE_MANAGER", slaHours: 48 },
      // Trainer executes via approverField if set on the training record;
      // falls back to TRAINER role, then HSE_MANAGER as a final escalation.
      { sequence: 3, stepType: "ASSIGNEE_TASK", name: "Trainer Conducts + Records", approverField: "TRAINER", slaHours: 168, escalationRole: "HSE_MANAGER" },
      { sequence: 4, stepType: "VERIFIER", name: "L&D Manager Verifies", approverRole: "LD_MANAGER", slaHours: 24, escalationRole: "HSE_MANAGER" },
      { sequence: 5, stepType: "CLOSURE", name: "Auto-issue Certificates", approverRole: "HSE_MANAGER" }
    ]
  },

  // ─── 6. Inspection ─────────────────────────────────────────────────────
  {
    module: "INSPECTION",
    name: "Inspection — Standard",
    description: "System auto-generates → Inspector executes → Section Head reviews → HSE closes",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Auto-Scheduled" },
      { sequence: 2, stepType: "ASSIGNEE_TASK", name: "Inspector Executes Checklist", approverField: "ASSIGNED_INSPECTOR", slaHours: 72, escalationRole: "HSE_MANAGER" },
      { sequence: 3, stepType: "VERIFIER", name: "Section Head Reviews", approverRole: "SUPERVISOR", slaHours: 48, escalationRole: "HSE_MANAGER" },
      { sequence: 4, stepType: "CLOSURE", name: "HSE Manager Closes", approverRole: "HSE_MANAGER" }
    ]
  },

  // ─── 7. Manhours ───────────────────────────────────────────────────────
  {
    module: "MANHOURS",
    name: "Manhours Monthly Lock",
    description: "Plant HSE → Plant Head → Corporate HSE locks the month",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Plant HSE Enters" },
      { sequence: 2, stepType: "CHECKER", name: "Plant Head Reviews", approverRole: "PLANT_HEAD", slaHours: 48 },
      { sequence: 3, stepType: "CLOSURE", name: "Corporate HSE Locks", approverRole: "CORPORATE_HSE", escalationRole: "HSE_MANAGER" }
    ]
  },

  // ─── 8. HIRA — Standard Study ──────────────────────────────────────────
  // 6-step lifecycle per spec §3.1:
  //   1. MAKER — Study leader initiates the draft
  //   2. ASSIGNEE_TASK — Team conducts entry-by-entry assessment
  //   3. JOINT team review — every team member must sign off (parallel)
  //   4. CHECKER — Plant Head approval
  //   5. VERIFIER — HSE Manager (separation of duties)
  //   6. CLOSURE — System sets ACTIVE, computes nextScheduledReviewDate
  //
  // The team-review step uses JOINT_APPROVAL against approverGroupRoles —
  // but for HIRA the engine needs an extra hook to fan out across the
  // dynamic HiraStudyTeamMember list, not a static role union. Until that
  // engine extension lands, the team-review step is sequential with the
  // study leader signing on behalf of the team (Phase 4 follow-on
  // expands this).
  {
    module: "HIRA_STUDY",
    name: "HIRA Study — Standard Workflow",
    description:
      "Initiation → Assessment → Team review → Plant Head approval → HSE Manager verification → Closure (activate study).",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Study Initiated" },
      {
        sequence: 2,
        stepType: "ASSIGNEE_TASK",
        name: "Team Assessment",
        approverField: "TEAM_LEADER",
        slaHours: 4 * 7 * 24, // 4 weeks
        escalationRole: "HSE_MANAGER",
        notes:
          "Study leader coordinates the team filling in entries with hazards, initial risk, controls, and residual risk. Submission to next step requires every entry to be out of DRAFT."
      },
      {
        sequence: 3,
        stepType: "CHECKER",
        name: "Team Review Sign-off",
        // HIRA_TEAM_FAN_OUT (engine-side): fans out one task per
        // HiraStudyTeamMember row + the team leader. Every member must
        // approve to advance. Rejection routes back to step 2.
        parallelStrategy: "HIRA_TEAM_FAN_OUT",
        slaHours: 7 * 24,
        escalationRole: "HSE_MANAGER",
        notes:
          "Each named team member receives a parallel sign-off task. The study advances to Plant Head approval only when every member has approved. Captured on HiraStudyTeamMember.signedAt."
      },
      {
        sequence: 4,
        stepType: "CHECKER",
        name: "Plant Head Approval",
        approverRole: "PLANT_HEAD",
        slaHours: 14 * 24, // 2 weeks
        escalationRole: "CORPORATE_HSE",
        notes:
          "Plant Head reviews aggregate metrics, spot-checks high-residual entries, confirms proposed controls plan. Approval moves the study to APPROVED."
      },
      {
        sequence: 5,
        stepType: "VERIFIER",
        name: "HSE Manager Verification",
        approverRole: "HSE_MANAGER",
        slaHours: 3 * 24,
        escalationRole: "CORPORATE_HSE",
        notes:
          "Separation-of-duties check: HSE Manager confirms the methodology was applied correctly and the regulatory references are appropriate. Triggers supersession of any previous study with the same scope."
      },
      {
        sequence: 6,
        stepType: "CLOSURE",
        name: "Activate Study",
        approverRole: "HSE_MANAGER",
        notes:
          "System sets effectiveFrom = today, computes nextScheduledReviewDate from reviewFrequency, supersedes prior study, fires cross-module triggers (training, inspection schedule, PTW gating)."
      }
    ]
  },

  // ─── 9. HIRA — High-Risk Study ─────────────────────────────────────────
  // Same shape as standard but adds Corporate HSE concurrence between
  // Plant Head approval and HSE Manager verification. Used when the
  // study scope includes high-risk operations (chemicals, height work,
  // hot work, MAH installations). Routed by setting recordType
  // on the WorkflowInstance.
  {
    module: "HIRA_STUDY",
    recordType: "HIGH_RISK",
    name: "HIRA Study — High-Risk Workflow",
    description:
      "Adds Corporate HSE concurrence on top of the standard flow. Used for chemicals, height work, hot work, MAH installations, or any scope flagged regulatoryReviewRequired=true.",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Study Initiated" },
      {
        sequence: 2,
        stepType: "ASSIGNEE_TASK",
        name: "Team Assessment",
        approverField: "TEAM_LEADER",
        slaHours: 6 * 7 * 24,
        escalationRole: "HSE_MANAGER"
      },
      {
        sequence: 3,
        stepType: "CHECKER",
        name: "Team Review Sign-off",
        approverGroupRoles: JSON.stringify(["SAFETY_OFFICER", "DEPARTMENT_HEAD"]),
        parallelStrategy: "JOINT_APPROVAL",
        slaHours: 7 * 24,
        escalationRole: "HSE_MANAGER"
      },
      {
        sequence: 4,
        stepType: "CHECKER",
        name: "Plant Head Approval",
        approverRole: "PLANT_HEAD",
        slaHours: 14 * 24,
        escalationRole: "CORPORATE_HSE"
      },
      {
        sequence: 5,
        stepType: "CHECKER",
        name: "Corporate HSE Concurrence",
        approverRole: "CORPORATE_HSE",
        slaHours: 21 * 24, // 3 weeks
        notes: "Cross-plant safety oversight on high-risk scopes."
      },
      {
        sequence: 6,
        stepType: "VERIFIER",
        name: "HSE Manager Verification",
        approverRole: "HSE_MANAGER",
        slaHours: 3 * 24
      },
      {
        sequence: 7,
        stepType: "CLOSURE",
        name: "Activate Study",
        approverRole: "HSE_MANAGER"
      }
    ]
  },

  // ─── 10. HIRA — Review Cycle ───────────────────────────────────────────
  // Lightweight workflow used when a HiraReviewCycle is initiated (either
  // scheduled, incident-triggered, or MOC-triggered). Outcome of the
  // review either closes silently (no_change) or routes the affected
  // entries through a major-revision approval.
  {
    module: "HIRA_REVIEW",
    name: "HIRA Review Cycle",
    description:
      "Scheduled or triggered re-review of HIRA entries. Department Head executes; HSE Manager closes. Major-revision outcomes route the affected entries back through study approval.",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "Review Initiated (auto or manual)" },
      {
        sequence: 2,
        stepType: "ASSIGNEE_TASK",
        name: "Department Head Reviews",
        approverRole: "DEPARTMENT_HEAD",
        slaHours: 30 * 24,
        escalationRole: "HSE_MANAGER",
        notes:
          "Department Head walks through each entry: confirm activity unchanged, hazards still relevant, controls still effective. Records outcome per entry."
      },
      {
        sequence: 3,
        stepType: "VERIFIER",
        name: "HSE Manager Approval of Changes",
        approverRole: "HSE_MANAGER",
        slaHours: 7 * 24,
        notes:
          "If outcome includes minor revisions, HSE Manager signs them off. Major-revision outcomes spawn a follow-up workflow on the affected study."
      },
      {
        sequence: 4,
        stepType: "CLOSURE",
        name: "Close Review Cycle",
        approverRole: "HSE_MANAGER",
        notes:
          "Updates HiraEntry.lastReviewedAt, nextReviewDue, reviewCount. Re-arms the scheduled review timer."
      }
    ]
  },

  // ─── 11. CAPA — Low severity (universal workflow) ─────────────────────
  // Light-touch flow per spec §4.3 LOW SEVERITY:
  //   - RCA may be marked "none_required" with rationale
  //   - Single approver at action planning (Department Head)
  //   - Verification can be observation
  //   - Closure by Department Head
  {
    module: "CAPA",
    recordType: "LOW",
    name: "CAPA — Low Severity",
    description: "Lightweight CAPA workflow for low-severity findings. Department Head approves action plan and closes.",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "CAPA Initiated" },
      {
        sequence: 2,
        stepType: "CHECKER",
        name: "Action Plan Approval",
        approverRole: "DEPARTMENT_HEAD",
        slaHours: 7 * 24,
        escalationRole: "HSE_MANAGER",
        notes: "Department Head reviews action plan. For LOW severity, RCA can be 5-Why or none_required with rationale."
      },
      {
        sequence: 3,
        stepType: "ASSIGNEE_TASK",
        name: "Action Execution",
        approverField: "ACTION_OWNER",
        parallelStrategy: "CAPA_ACTION_FAN_OUT",
        slaHours: 14 * 24,
        escalationRole: "DEPARTMENT_HEAD",
        notes: "One task per CapaAction. All immediate-containment + corrective + preventive actions must complete."
      },
      {
        sequence: 4,
        stepType: "VERIFIER",
        name: "Effectiveness Verification",
        approverRole: "SAFETY_OFFICER",
        slaHours: 7 * 24,
        notes: "Verifier (not the action executor) confirms effectiveness against success criteria."
      },
      {
        sequence: 5,
        stepType: "CLOSURE",
        name: "Closure",
        approverRole: "DEPARTMENT_HEAD",
        notes: "Department Head closes. Recurrence check scheduled at +30 days."
      }
    ]
  },

  // ─── 12. CAPA — Moderate severity (standard) ──────────────────────────
  {
    module: "CAPA",
    recordType: "MODERATE",
    name: "CAPA — Standard (Moderate Severity)",
    description: "Standard CAPA workflow. RCA + action plan approved by HSE/Quality Manager. Closure by HSE Manager.",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "CAPA Initiated" },
      {
        sequence: 2,
        stepType: "ASSIGNEE_TASK",
        name: "Root Cause Analysis",
        approverField: "PRIMARY_OWNER",
        slaHours: 14 * 24,
        escalationRole: "HSE_MANAGER",
        notes: "Primary owner conducts RCA with selected methodology. AI RCA assistant + similar past CAPAs surfaced."
      },
      {
        sequence: 3,
        stepType: "CHECKER",
        name: "Action Plan Approval",
        approverRole: "HSE_MANAGER",
        slaHours: 7 * 24,
        escalationRole: "PLANT_HEAD",
        notes: "HSE Manager (or quality / environmental equivalent based on source) approves action plan."
      },
      {
        sequence: 4,
        stepType: "ASSIGNEE_TASK",
        name: "Action Execution",
        approverField: "ACTION_OWNER",
        parallelStrategy: "CAPA_ACTION_FAN_OUT",
        slaHours: 30 * 24,
        escalationRole: "HSE_MANAGER",
        notes: "One task per CapaAction. Engine spawns parallel tasks; all must complete."
      },
      {
        sequence: 5,
        stepType: "VERIFIER",
        name: "Effectiveness Verification",
        approverRole: "SAFETY_OFFICER",
        slaHours: 14 * 24,
        notes: "Apply verification method; record evidence."
      },
      {
        sequence: 6,
        stepType: "CLOSURE",
        name: "Closure",
        approverRole: "HSE_MANAGER",
        notes: "HSE Manager closes. Recurrence check scheduled at +60 days."
      }
    ]
  },

  // ─── 13. CAPA — High severity ─────────────────────────────────────────
  {
    module: "CAPA",
    recordType: "HIGH",
    name: "CAPA — High Severity",
    description: "High-severity CAPA. Full RCA mandatory. Plant Head approves plan and closes.",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "CAPA Initiated" },
      {
        sequence: 2,
        stepType: "ASSIGNEE_TASK",
        name: "Root Cause Analysis (Mandatory)",
        approverField: "PRIMARY_OWNER",
        slaHours: 14 * 24,
        escalationRole: "HSE_MANAGER",
        notes: "Full RCA with formal methodology. No 'none_required' path at HIGH severity."
      },
      {
        sequence: 3,
        stepType: "CHECKER",
        name: "Action Plan Approval — Plant Head",
        approverRole: "PLANT_HEAD",
        slaHours: 7 * 24,
        escalationRole: "CORPORATE_HSE"
      },
      {
        sequence: 4,
        stepType: "ASSIGNEE_TASK",
        name: "Action Execution",
        approverField: "ACTION_OWNER",
        parallelStrategy: "CAPA_ACTION_FAN_OUT",
        slaHours: 45 * 24,
        escalationRole: "PLANT_HEAD"
      },
      {
        sequence: 5,
        stepType: "VERIFIER",
        name: "Effectiveness Verification — Multi-Method",
        approverRole: "HSE_MANAGER",
        slaHours: 14 * 24,
        notes: "Multiple verification methods + measurement period required at HIGH severity."
      },
      {
        sequence: 6,
        stepType: "CLOSURE",
        name: "Closure — Plant Head",
        approverRole: "PLANT_HEAD",
        notes: "Plant Head closes. Recurrence check at +90 days. Reported in monthly management review."
      }
    ]
  },

  // ─── 14. MOC — Management of Change ──────────────────────────────────
  {
    module: "MOC",
    name: "MOC — Management of Change",
    description:
      "Standard MOC workflow: Initiator → Impact Assessment → Approval (classification-driven) → Execution → PSSR/Verification → Closure.",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "MOC Submitted" },
      {
        sequence: 2,
        stepType: "ASSIGNEE_TASK",
        name: "Impact Assessment",
        approverField: "PRIMARY_OWNER",
        slaHours: 5 * 24,
        escalationRole: "HSE_MANAGER",
        notes: "Assessor completes risk-dimensions impact assessment (safety/env/quality/ops). Recommends classification."
      },
      {
        sequence: 3,
        stepType: "CHECKER",
        name: "Approval",
        approverRole: "PLANT_HEAD",
        slaHours: 7 * 24,
        escalationRole: "HSE_MANAGER",
        notes: "Plant Head approves (minor/moderate). Major/critical require Corporate HSE co-approval."
      },
      {
        sequence: 4,
        stepType: "ASSIGNEE_TASK",
        name: "Execute Change",
        approverField: "PRIMARY_OWNER",
        slaHours: 30 * 24,
        escalationRole: "PLANT_HEAD",
        notes: "Change implemented per approved plan. Dependent records updated (HIRA, EAI, SOP, Training)."
      },
      {
        sequence: 5,
        stepType: "VERIFIER",
        name: "Verification / PSSR",
        approverRole: "HSE_MANAGER",
        slaHours: 7 * 24,
        notes: "HSE Manager verifies change is correctly implemented. PSSR conducted if pssrRequired=true."
      },
      {
        sequence: 6,
        stepType: "CLOSURE",
        name: "Closure",
        approverRole: "PLANT_HEAD",
        notes: "Plant Head closes MOC. Temporary changes auto-flagged for return-to-normal at expiry."
      }
    ]
  },

  // ─── 15. CAPA — Critical severity ─────────────────────────────────────
  {
    module: "CAPA",
    recordType: "CRITICAL",
    name: "CAPA — Critical Severity",
    description: "Critical-severity CAPA. Investigation team mandatory. Plant Head + Corporate co-approve.",
    steps: [
      { sequence: 1, stepType: "MAKER", name: "CAPA Initiated" },
      {
        sequence: 2,
        stepType: "ASSIGNEE_TASK",
        name: "Investigation Team RCA",
        approverField: "PRIMARY_OWNER",
        slaHours: 14 * 24,
        escalationRole: "HSE_MANAGER",
        notes: "Mandatory investigation team. Formal methodology (8D, FTA, or Bowtie typical for critical)."
      },
      {
        sequence: 3,
        stepType: "CHECKER",
        name: "Action Plan — Plant Head + Corporate",
        approverGroupRoles: JSON.stringify(["PLANT_HEAD", "CORPORATE_HSE"]),
        parallelStrategy: "JOINT_APPROVAL",
        slaHours: 7 * 24,
        notes: "Both Plant Head and Corporate HSE must approve before action execution begins."
      },
      {
        sequence: 4,
        stepType: "ASSIGNEE_TASK",
        name: "Action Execution",
        approverField: "ACTION_OWNER",
        parallelStrategy: "CAPA_ACTION_FAN_OUT",
        slaHours: 60 * 24,
        escalationRole: "PLANT_HEAD"
      },
      {
        sequence: 5,
        stepType: "VERIFIER",
        name: "Independent Verification + Trend Analysis",
        approverRole: "CORPORATE_HSE",
        slaHours: 21 * 24,
        notes: "Independent verification by Corporate HSE; trend analysis over measurement period."
      },
      {
        sequence: 6,
        stepType: "CLOSURE",
        name: "Closure — Plant Head + Corporate",
        approverGroupRoles: JSON.stringify(["PLANT_HEAD", "CORPORATE_HSE"]),
        parallelStrategy: "JOINT_APPROVAL",
        notes: "Joint closure approval. Recurrence check at +180 days. Reported to Board / external stakeholders as applicable."
      }
    ]
  }
];

async function main() {
  console.log("🔁  Seeding workflow definitions (idempotent)...");
  for (const def of DEFINITIONS) {
    const existing = await prisma.workflowDefinition.findFirst({
      where: { module: def.module, recordType: def.recordType ?? null }
    });

    if (existing) {
      // Upsert steps by sequence so existing WorkflowInstance.currentStepId
      // and WorkflowTask.stepId references stay valid. Delete-and-recreate
      // would orphan those references and break running workflows.
      await prisma.workflowDefinition.update({
        where: { id: existing.id },
        data: {
          name: def.name,
          description: def.description,
          isActive: true
        }
      });

      const existingSteps = await prisma.workflowStep.findMany({
        where: { definitionId: existing.id },
        select: { id: true, sequence: true }
      });
      const bySeq = new Map(existingSteps.map((s) => [s.sequence, s.id]));

      for (const s of def.steps) {
        // `as any` here because Prisma's generated JSON types reject
        // plain `null` for nullable Json columns (require `Prisma.JsonNull`).
        // The runtime shape is correct; we just escape strict types.
        const stepData: any = {
          name: s.name,
          stepType: s.stepType,
          approverRole: s.approverRole ?? null,
          approverField: s.approverField ?? null,
          approverGroupRoles: s.approverGroupRoles ?? null,
          slaHours: s.slaHours ?? null,
          escalationRole: s.escalationRole ?? null,
          isOptional: s.isOptional ?? false,
          conditionExpr: s.conditionExpr ? JSON.stringify(s.conditionExpr) : null,
          parallelStrategy: s.parallelStrategy ?? null,
          slaBySeverity: s.slaBySeverity ?? undefined,
          notes: s.notes ?? null
        };
        const stepId = bySeq.get(s.sequence);
        if (stepId) {
          await prisma.workflowStep.update({ where: { id: stepId }, data: stepData });
        } else {
          await prisma.workflowStep.create({
            data: { ...stepData, sequence: s.sequence, definitionId: existing.id }
          });
        }
      }

      // Drop any leftover steps beyond the new sequence range (shorter workflow)
      const newSeqs = new Set(def.steps.map((s) => s.sequence));
      const toDelete = existingSteps.filter((s) => !newSeqs.has(s.sequence)).map((s) => s.id);
      if (toDelete.length > 0) {
        await prisma.workflowStep.deleteMany({ where: { id: { in: toDelete } } });
      }

      console.log(`   ↻ Updated: ${def.module}${def.recordType ? "/" + def.recordType : ""} — ${def.steps.length} steps`);
    } else {
      await prisma.workflowDefinition.create({
        data: {
          module: def.module,
          recordType: def.recordType ?? null,
          name: def.name,
          description: def.description,
          isActive: true,
          steps: {
            create: def.steps.map((s) => ({
              sequence: s.sequence,
              stepType: s.stepType,
              name: s.name,
              approverRole: s.approverRole ?? null,
              approverField: s.approverField ?? null,
              approverGroupRoles: s.approverGroupRoles ?? null,
              slaHours: s.slaHours ?? null,
              escalationRole: s.escalationRole ?? null,
              isOptional: s.isOptional ?? false,
              conditionExpr: s.conditionExpr ? JSON.stringify(s.conditionExpr) : null,
              parallelStrategy: s.parallelStrategy ?? null,
              slaBySeverity: s.slaBySeverity ?? undefined,
              notes: s.notes ?? null
            })) as any
          }
        }
      });
      console.log(`   + Created: ${def.module}${def.recordType ? "/" + def.recordType : ""} — ${def.steps.length} steps`);
    }
  }
  console.log("✅  Workflow definitions seeded.");
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
