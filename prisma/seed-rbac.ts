// RBAC seed — runs after seed.ts (which seeds plants + base roles + users).
// Idempotent: safe to re-run. Adds expanded roles, all permission codes, the
// default Role × Permission matrix, and assigns demo users into the new
// taxonomy via UserRole rows.
//
// What it does NOT touch: the existing single-string User.role column. That
// stays as a denormalised "primary role" for back-compat with code paths
// that haven't been migrated to permission helpers yet.

import { PrismaClient } from "@prisma/client";
import { parseDemoEmail } from "./demo-users-config";
import { syncNamedAllPlantUsers } from "./named-users-sync";

const prisma = new PrismaClient();

// ─── Expanded role taxonomy ─────────────────────────────────────────────
// Beyond the original 9 (ADMIN, PLANT_HEAD, HSE_MANAGER, ENVIRONMENT_MANAGER,
// CONTRACTOR_COORDINATOR, OCCUPATIONAL_HEALTH_OFFICER,
// EMERGENCY_RESPONSE_COORDINATOR, INDUSTRIAL_HYGIENIST, WORKER) we add the
// roles the brief assumes. ADMIN is the single portal administrator role.
const ADDITIONAL_ROLES: { code: string; name: string; description: string; isSystem: boolean; sortOrder: number; defaultLanding: string }[] = [
  // SUPER_ADMIN owns the ORGANISATION (this portal is single-tenant: one
  // organisation, many plants). Everything ADMIN can do, plus the one
  // authority no other role has — deciding which licensed modules the
  // organisation uses at all (ORGANISATION.MODULES). sortOrder 0 puts it above
  // Administrator in every role list.
  { code: "SUPER_ADMIN", name: "Super Administrator", description: "Organisation owner. Everything an Administrator can do, plus enabling/disabling modules for the whole organisation.", isSystem: true, sortOrder: 0, defaultLanding: "/organisation/modules" },
  // SYSTEM_ADMIN was removed — it and ADMIN were declared aliases but had
  // drifted into two different grant sets, which meant "the admin role" quietly
  // depended on which of the two a user happened to hold. ADMIN is now the
  // single portal administrator and absorbed everything SYSTEM_ADMIN held; see
  // the union assembled below the ROLE_GRANTS literal.
  { code: "ADMIN", name: "Administrator", description: "Full configuration access — users, roles, workflows, masters and every module across all plants.", isSystem: true, sortOrder: 1, defaultLanding: "/configuration/workflows" },
  { code: "CORPORATE_HSE", name: "Corporate HSE", description: "All-plants HSE leadership; manages master data and roll-up reports.", isSystem: true, sortOrder: 5, defaultLanding: "/dashboard" },
  { code: "PERMIT_ISSUER", name: "Permit Issuer", description: "Originates and approves permits as Issuer (first approval step).", isSystem: true, sortOrder: 25, defaultLanding: "/inbox" },
  { code: "SAFETY_OFFICER", name: "Safety Officer", description: "Verifies observations, near-miss closure, permit safety conditions.", isSystem: true, sortOrder: 27, defaultLanding: "/inbox" },
  { code: "SUPERVISOR", name: "Supervisor", description: "Frontline supervisor; raises FLRA, approves observations within own department.", isSystem: true, sortOrder: 80, defaultLanding: "/inbox" },
  { code: "DEPARTMENT_HEAD", name: "Department Head", description: "Department-scoped approval authority for non-permit records.", isSystem: false, sortOrder: 75, defaultLanding: "/inbox" },
  { code: "MAINTENANCE_HEAD", name: "Maintenance Head", description: "Owns equipment master + inspection assignments.", isSystem: false, sortOrder: 65, defaultLanding: "/inspections" },
  { code: "LD_MANAGER", name: "L&D Manager", description: "Owns training programs across all plants.", isSystem: false, sortOrder: 55, defaultLanding: "/training" },
  { code: "TRAINER", name: "Trainer", description: "Conducts training sessions and records outcomes.", isSystem: false, sortOrder: 90, defaultLanding: "/training" },
  { code: "CONTRACTOR_WORKMAN", name: "Contractor Workman", description: "External crew member; restricted to records they're crew on.", isSystem: false, sortOrder: 110, defaultLanding: "/inbox" },

  // CAPA generalization — 6 new roles per spec §7. ENVIRONMENTAL_MANAGER
  // already exists and gains the CAPA grants for environmental sources.
  { code: "QUALITY_MANAGER",          name: "Quality Manager",          description: "Owns quality CAPAs — NCRs, customer complaints, audit findings of quality type. Defaults to quality source scope.", isSystem: false, sortOrder: 30, defaultLanding: "/capa" },
  { code: "QUALITY_ASSURANCE_LEAD",   name: "Quality Assurance Lead",   description: "Verification authority for quality CAPAs. Cannot raise; can verify effectiveness.", isSystem: false, sortOrder: 33, defaultLanding: "/capa" },
  { code: "CUSTOMER_SERVICE_LEAD",    name: "Customer Service Lead",    description: "Owns customer complaint intake and initial response. Source-scoped to customer complaints.", isSystem: false, sortOrder: 40, defaultLanding: "/capa" },
  { code: "INTERNAL_AUDIT_LEAD",      name: "Internal Audit Lead",      description: "Raises audit-driven CAPAs across functions. Source-scoped to audit sources; read-only on others.", isSystem: false, sortOrder: 45, defaultLanding: "/capa" },
  { code: "EXTERNAL_AUDIT_COORDINATOR", name: "External Audit Coordinator", description: "Manages external/regulatory audit CAPAs and regulator responses.", isSystem: false, sortOrder: 47, defaultLanding: "/capa" },
  { code: "CALIBRATION_MANAGER",      name: "Calibration Manager",      description: "Owns calibration-driven CAPAs and impact analysis on out-of-cal instruments.", isSystem: false, sortOrder: 70, defaultLanding: "/capa" },

  // Skill Matrix — Phase 1 IMS (competency / HR-adjacent wedge). Only these
  // two are new; LD_MANAGER, TRAINER, SUPERVISOR, DEPARTMENT_HEAD, HSE_MANAGER,
  // PLANT_HEAD, CORPORATE_HSE, ADMIN already exist and just gain grants.
  { code: "HR_HEAD",           name: "HR Head",            description: "Owns competency management cross-plant (HR territory). Configures competencies + role definitions; suspends for HR reasons.", isSystem: false, sortOrder: 35, defaultLanding: "/skill-matrix" },
  { code: "EXTERNAL_ASSESSOR", name: "External Assessor",  description: "External party scoped to specific competency assessments they are assigned. No master or role-definition authority.", isSystem: false, sortOrder: 95, defaultLanding: "/skill-matrix" },

  // ─── Enterprise Risk Management (ERM) — board-grade ERM layer (§4) ────────
  // CRO owns the board pack and is the sole approver for acceptance + closure.
  // Risk Champion facilitates assessment/review across all sites. Risk Owner
  // is the single accountable owner of specific risks. Executive Viewer is the
  // board-member persona (read-only, dashboards + published packs). Plant HSE
  // Head sees only their own-site OPS rollup risks. System Admin (existing)
  // gains taxonomy / matrix / rollup admin grants below.
  { code: "CRO",              name: "Chief Risk Officer / Head of Risk", description: "Enterprise risk governance. Owns the board pack; sole approver for risk acceptance and closure.", isSystem: false, sortOrder: 6,   defaultLanding: "/erm" },
  { code: "RISK_CHAMPION",    name: "Risk Champion",                      description: "Facilitates risk assessment and review across the enterprise; can draft board packs.", isSystem: false, sortOrder: 8,   defaultLanding: "/erm" },
  { code: "RISK_OWNER",       name: "Risk Owner",                         description: "Single accountable owner of specific enterprise risks; manages assessments + treatments for own risks.", isSystem: false, sortOrder: 28,  defaultLanding: "/erm" },
  { code: "EXECUTIVE_VIEWER", name: "Executive Viewer",                   description: "Board / RMC member. Read-only access to dashboards, heat maps, and published board packs.", isSystem: false, sortOrder: 4,   defaultLanding: "/erm" },
  { code: "PLANT_HSE_HEAD",   name: "Plant HSE Head",                     description: "Plant safety leader. Sees only own-site operational (OPS) rollup risks and their contributing HIRA/EAI entries.", isSystem: false, sortOrder: 26, defaultLanding: "/erm" },

  // ─── ERM Phase 2 — Compliance Officer (corporate) ───────────────────────
  // Sole verify/waive authority for compliance tasks (segregation of duties
  // from the attester). Manages the obligations register; reads KRI/appetite/loss.
  { code: "COMPLIANCE_OFFICER", name: "Compliance Officer",               description: "Owns the Legal & Compliance Obligations register; exclusive verify/waive authority for compliance tasks (SoD from attesters).", isSystem: false, sortOrder: 29, defaultLanding: "/erm/compliance" },

  // ─── ERM Phase 3 — BCM Coordinator (corporate) ──────────────────────────
  // Owns Business Continuity: BIA approval, plan versioning/approval, crisis
  // team + activation, exercise programme, scenario library. (Crisis Director
  // is a Crisis Team role assignment, not a platform role.)
  { code: "BCM_COORDINATOR", name: "BCM Coordinator",                     description: "Owns Business Continuity Management — BIA approval, continuity-plan versioning/approval, crisis team + activation, exercise programme, scenario analysis.", isSystem: false, sortOrder: 7, defaultLanding: "/erm/bcm" },

  // ─── CAMS — Compliance & Audit Management System (§7 RBAC matrix) ────────
  // One engine for audits + inspections. Audit Manager owns the programme;
  // Lead Auditor runs own-team engagements; Auditor executes assigned audits.
  // Auditee/Area Owner (audited party) responds to findings — inherits an
  // existing area-owner role + CAMS.READ rather than a dedicated platform role.
  { code: "CAMS_ADMIN",    name: "CAMS Admin",     description: "Owns CAMS configuration — audit types, recurrence, template approval, RBAC. Full audit/inspection authority cross-site.", isSystem: false, sortOrder: 30, defaultLanding: "/cams" },
  { code: "AUDIT_MANAGER", name: "Audit Manager",  description: "Owns the audit programme: plans/approves the programme, authors + approves templates, schedules engagements, runs analytics & benchmarking cross-site.", isSystem: false, sortOrder: 31, defaultLanding: "/cams" },
  { code: "LEAD_AUDITOR",  name: "Lead Auditor",   description: "Leads audit engagements for their own team/site — schedules, executes, closes own engagements, authors templates, raises findings & CAPAs.", isSystem: false, sortOrder: 32, defaultLanding: "/cams/engagements" },
  { code: "AUDITOR",       name: "Auditor",        description: "Field auditor — executes assigned engagements, records findings, raises CAPAs; sees own-audit analytics.", isSystem: false, sortOrder: 33, defaultLanding: "/cams/engagements" },
  // The audited party, as a role of its own. It used to be borrowed —
  // DEPARTMENT_HEAD or SUPERVISOR happened to carry the right grants — which
  // works until you need to seat someone who is an auditee and NOTHING else.
  // Borrowing a department head's seat hands them approval authority over
  // observations, near misses, permits, MOC and HIRA across a whole department,
  // none of which answering an audit finding requires.
  //
  // Deliberately has no AUDIT_COMPLIANCE.EXECUTE: accepting a response, raising
  // a CAPA from a finding and escalating are the AUDITOR's side of the same
  // conversation. An auditee holding it could accept their own answers.
  { code: "AUDITEE",       name: "Auditee",        description: "The audited party — reads audits they are seated on, answers findings routed to them with evidence, and works the corrective actions they own. No auditor authority.", isSystem: false, sortOrder: 34, defaultLanding: "/cams/audits" },

  // ─── ERM Tier 3 — Controls / Vendor / Insurance specialist roles ─────────
  { code: "CONTROLS_TESTER",     name: "Controls Tester",       description: "Internal-audit / controls function: control library, risk-control mapping, control testing (cannot test own-owned controls), deficiency management.", isSystem: false, sortOrder: 30, defaultLanding: "/erm/controls" },
  { code: "VENDOR_RISK_MANAGER", name: "Vendor Risk Manager",   description: "Owns third-party / vendor risk: onboarding, dual-lens (risk + ESG) assessments, vendor register + ESG portfolio.", isSystem: false, sortOrder: 31, defaultLanding: "/erm/vendors" },
  { code: "INSURANCE_MANAGER",   name: "Insurance Manager",     description: "Owns insurance & risk transfer: policies, renewals, claims, coverage-gap analysis.", isSystem: false, sortOrder: 32, defaultLanding: "/erm/insurance" },

  // ─── Facilities — Factory Profile Master & Consolidated Dashboard (§5) ────
  // Group Compliance Manager (Mervyn's persona) sees ALL factories and edits any
  // profile. Factory Manager is scoped strictly to their own factory across
  // every screen (the dashboard auto-filters to their site).
  { code: "FACILITIES_MANAGER", name: "Group Compliance Manager", description: "Group / facilities compliance leadership. Sees all factory profiles, the consolidated dashboard and benchmarking; creates and edits any profile, buildings, workforce, certifications and contacts.", isSystem: false, sortOrder: 3,  defaultLanding: "/facilities" },
  { code: "FACTORY_MANAGER",    name: "Factory Manager",          description: "Owns one factory's profile — buildings, workforce, certifications and contacts for their own site only. Dashboard auto-scopes to their factory.", isSystem: false, sortOrder: 34, defaultLanding: "/facilities" },

  // ─── Guided Field Capture — low-literacy field persona ───────────────────
  // Lands directly on the icon-first capture wizard; sees only their own
  // reports. Officers triage via CAPTURE.TRIAGE (granted to SAFETY_OFFICER /
  // HSE_MANAGER below).
  { code: "FIELD_TECHNICIAN", name: "Field Technician", description: "Field worker persona for the guided capture wizard (icon-first, voice-first, offline-capable). Submits observations / near-misses / unsafe conditions; sees own reports only.", isSystem: false, sortOrder: 108, defaultLanding: "/capture" }
];

// ─── Permission catalogue ───────────────────────────────────────────────
// Module × Action codes. "Operational" modules share the same action set;
// configuration permissions are explicit codes.
const OPERATIONAL_MODULES = [
  "OBSERVATION", "NEAR_MISS", "PTW", "FLRA", "INCIDENT", "TRAINING", "INSPECTION", "MANHOURS",
  // HIRA — Phase 1 of IMS expansion. CREATE/READ/UPDATE/DELETE on studies +
  // entries (the engine treats them as one module for permission grants; the
  // entry editor's "edit own department only" nuance is handled by scope).
  // APPROVE = study approval. EXECUTE = perform review cycle. VERIFY = HSE
  // Manager review-of-a-review. CLOSE = supersede.
  "HIRA",
  // CAPA — generalized universal CAPA module. CREATE = raise CAPA (from any
  // source). READ = view. UPDATE = edit. APPROVE = approve action plan.
  // EXECUTE = execute an action (action owner). VERIFY = verify effectiveness.
  // CLOSE = final closure. DELETE = archive (statutory rec; soft delete only).
  "CAPA",
  // EAI — HIRA Phase 2. Environmental Aspect & Impact register. Same
  // CRUD shape as HIRA; APPROVE = study approval; EXECUTE = review cycle;
  // VERIFY = HSE/Env Manager re-check; CLOSE = supersede.
  "EAI",
  // SKILL_MATRIX — Phase 1 IMS competency layer. CRUD + lifecycle actions
  // auto-generated below; the non-CRUD codes (ASSESS, SUSPEND, CONFIGURE,
  // RECERT_CYCLE, etc.) are in EXTRA_PERMISSIONS.
  "SKILL_MATRIX",
  // MOC — Management of Change (IMS Phase 1, 4th module). CRUD + the 9
  // lifecycle actions auto-generate below; ADMIN gets them via the
  // spread. Explicit grants for operational roles are in ROLE_GRANTS.
  "MOC",
  // AUDIT_COMPLIANCE — Audit & Compliance Management. Industry-checklist audits.
  // CREATE = schedule an audit. READ = view programme/audit/dashboards.
  // EXECUTE = conduct (partial-save + submit). UPDATE = auditee response.
  // APPROVE = plant-manager review. CLOSE = close audit. EXPORT = reports.
  "AUDIT_COMPLIANCE",
  // ERM — Enterprise Risk Management. CREATE = author a risk. READ = view
  // register/dashboards/heat maps. UPDATE = edit. APPROVE = validate
  // SUBMITTED→ASSESSED. CLOSE = approve closure (CRO). DELETE = archive.
  // EXPORT = reports/board pack data. The non-CRUD codes (ASSESS, TREAT,
  // ACCEPT, REVIEW, LINK, BOARD_PACK, TAXONOMY_ADMIN, MATRIX_ADMIN,
  // ROLLUP_ADMIN) are in EXTRA_PERMISSIONS.
  "ERM",
  // RCA — Cross-Domain Root Cause Analysis (ERM sub-module). CREATE = open an
  // RCA (event/risk/loss) + edit/submit. READ = register/workspace/analytics/
  // maps. APPROVE = approve an RCA. The non-CRUD codes (TAG = tag causes / link
  // risks; TAXONOMY_ADMIN = manage the cause taxonomy) are in EXTRA_PERMISSIONS.
  "RCA",
  // FIRE — Fire & Life Safety. The module shipped borrowing INCIDENT.READ /
  // INCIDENT.UPDATE, which its own router documents as a bootstrap with two
  // known defects, and both are real:
  //
  //   • AUDITOR and LEAD_AUDITOR hold no INCIDENT grant at all, so the two roles
  //     whose job is to inspect the fire register could not open it.
  //   • WORKER and CONTRACTOR_WORKMAN hold INCIDENT.READ at OWN_RECORDS, and
  //     get_accessible_plants_for widens OWN_RECORDS to the whole plant — so a
  //     contractor could read every extinguisher, panel and checklist on site.
  //
  // The action shape maps onto the sign-off block printed on the client's own
  // sheets, which is where the segregation of duties is already defined:
  //
  //   CREATE  add an asset to the fire register
  //   READ    view the register, the checklists and their exports
  //   UPDATE  edit a register row
  //   EXECUTE fill in a checklist       -> "Prepared by: Person In-charge"
  //   VERIFY  review a filled checklist -> "Reviewed by: Intermediatory Head"
  //   APPROVE approve + lock the record -> "Approved by: HOD"
  //   CLOSE   close out a fire defect
  //   DELETE  retire an asset / a checklist template
  //   EXPORT  the PDF an external auditor is handed
  //
  // EXECUTE / VERIFY / APPROVE are granted to different roles on purpose. One
  // person holding all three can sign their own work, which is the whole thing
  // a three-stage sign-off block exists to prevent.
  "FIRE"
] as const;
const OPERATIONAL_ACTIONS = ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT"] as const;

const EXTRA_PERMISSIONS: { code: string; module: string; action: string; description: string }[] = [
  { code: "CONFIGURATION.MASTERS",     module: "CONFIGURATION", action: "MASTERS",     description: "Manage master data (plants, areas, equipment, training programs)" },
  { code: "CONFIGURATION.WORKFLOWS",   module: "CONFIGURATION", action: "WORKFLOWS",   description: "Edit workflow definitions and steps" },
  { code: "CONFIGURATION.USERS",       module: "CONFIGURATION", action: "USERS",       description: "Create / edit / disable user accounts" },
  { code: "CONFIGURATION.PERMISSIONS", module: "CONFIGURATION", action: "PERMISSIONS", description: "Edit role × permission matrix" },
  { code: "CONFIGURATION.ROLES",       module: "CONFIGURATION", action: "ROLES",       description: "Create / edit roles and assign role membership" },
  { code: "LICENSING.MANAGE",          module: "LICENSING",     action: "MANAGE",      description: "View licence diagnostics, upload/renew the licence file, view installation id" },
  { code: "AUDIT.VIEW",                module: "AUDIT",         action: "VIEW",        description: "Read audit log" },
  // Organisation ownership — the Super Admin's distinguishing authority. Turning
  // a module off here removes it for EVERY plant and every role at once, so it
  // is granted to SUPER_ADMIN only, never to ADMIN.
  { code: "ORGANISATION.MODULES",      module: "ORGANISATION",  action: "MODULES",     description: "Enable / disable modules for the whole organisation (Super Admin)" },

  // Inspection masters & finding lifecycle (production-depth refactor)
  { code: "INSPECTION_TYPE.CREATE",    module: "INSPECTION_TYPE",    action: "CREATE",  description: "Create new inspection types (statutory / routine / pre-op / etc.)" },
  { code: "INSPECTION_TYPE.READ",      module: "INSPECTION_TYPE",    action: "READ",    description: "View inspection types" },
  { code: "INSPECTION_TYPE.UPDATE",    module: "INSPECTION_TYPE",    action: "UPDATE",  description: "Update inspection types" },
  { code: "INSPECTION_TYPE.DELETE",    module: "INSPECTION_TYPE",    action: "DELETE",  description: "Retire inspection types" },
  { code: "CHECKLIST_TEMPLATE.CREATE", module: "CHECKLIST_TEMPLATE", action: "CREATE",  description: "Author checklist templates" },
  { code: "CHECKLIST_TEMPLATE.READ",   module: "CHECKLIST_TEMPLATE", action: "READ",    description: "View checklist templates" },
  { code: "CHECKLIST_TEMPLATE.UPDATE", module: "CHECKLIST_TEMPLATE", action: "UPDATE",  description: "Update checklist templates" },
  { code: "CHECKLIST_TEMPLATE.APPROVE", module: "CHECKLIST_TEMPLATE", action: "APPROVE", description: "Approve checklist templates for use" },
  { code: "CHECKLIST_TEMPLATE.DELETE", module: "CHECKLIST_TEMPLATE", action: "DELETE",  description: "Retire checklist templates" },
  { code: "EQUIPMENT_MASTER.CREATE",   module: "EQUIPMENT_MASTER",   action: "CREATE",  description: "Add equipment to master" },
  { code: "EQUIPMENT_MASTER.READ",     module: "EQUIPMENT_MASTER",   action: "READ",    description: "View equipment master" },
  { code: "EQUIPMENT_MASTER.UPDATE",   module: "EQUIPMENT_MASTER",   action: "UPDATE",  description: "Update equipment master" },
  { code: "EQUIPMENT_MASTER.DELETE",   module: "EQUIPMENT_MASTER",   action: "DELETE",  description: "Decommission equipment" },
  { code: "INSPECTION_FINDING.READ",   module: "INSPECTION_FINDING", action: "READ",    description: "View inspection findings" },
  { code: "INSPECTION_FINDING.UPDATE", module: "INSPECTION_FINDING", action: "UPDATE",  description: "Update finding metadata, take ownership" },
  { code: "INSPECTION_FINDING.CLOSE",  module: "INSPECTION_FINDING", action: "CLOSE",   description: "Close findings" },
  { code: "INSPECTION_FINDING.VERIFY", module: "INSPECTION_FINDING", action: "VERIFY",  description: "Verify finding closure" },
  { code: "INSPECTION_FINDING.DEFER",  module: "INSPECTION_FINDING", action: "DEFER",   description: "Defer findings" },
  { code: "INSPECTION.SCHEDULE",       module: "INSPECTION",         action: "SCHEDULE", description: "Generate inspection schedules from masters" },
  { code: "INSPECTION.REASSIGN",       module: "INSPECTION",         action: "REASSIGN", description: "Reassign inspector on a scheduled inspection" },

  // ─── HIRA admin / configuration permissions (Phase 1 of IMS expansion) ───
  // CRUD on studies + entries comes free from OPERATIONAL_MODULES.HIRA;
  // these additional codes gate the configuration and lifecycle actions
  // that don't fit the generic CRUD shape.
  { code: "HIRA.MATRIX_CONFIGURE",  module: "HIRA", action: "MATRIX_CONFIGURE",  description: "Create / edit RiskMatrix master, scales, cells, default selection" },
  { code: "HIRA.LIBRARY_MANAGE",    module: "HIRA", action: "LIBRARY_MANAGE",    description: "Manage tenant-scoped HiraHazard and HiraControl library rows" },
  { code: "HIRA.THRESHOLDS_CONFIGURE", module: "HIRA", action: "THRESHOLDS_CONFIGURE", description: "Edit acceptable residual risk thresholds per routine/non-routine/emergency" },
  { code: "HIRA.REVIEW_TRIGGER",    module: "HIRA", action: "REVIEW_TRIGGER",    description: "Manually trigger a review cycle on a HIRA entry" },
  { code: "HIRA.VERSION_VIEW",      module: "HIRA", action: "VERSION_VIEW",      description: "View immutable HiraVersion history and diffs" },
  { code: "HIRA.OVERRIDE_UNACCEPTABLE", module: "HIRA", action: "OVERRIDE_UNACCEPTABLE", description: "Authorise approval of an Unacceptable (ALARP) residual risk via a time-bounded override — Plant Head / Corporate HSE tier" },

  // ─── EAI admin / configuration permissions (HIRA Phase 2) ────────────────
  // CRUD on studies + entries comes free from OPERATIONAL_MODULES.EAI.
  // FEATURE_FLAG_TOGGLE gates the per-plant Phase 2 opt-in switch.
  { code: "EAI.MATRIX_CONFIGURE",     module: "EAI", action: "MATRIX_CONFIGURE",     description: "Create / edit EnvironmentalImpactMatrix master, scales, cells" },
  { code: "EAI.LIBRARY_MANAGE",       module: "EAI", action: "LIBRARY_MANAGE",       description: "Manage EaiAspect, EaiReceptor, EaiRegulation library rows" },
  { code: "EAI.SIGNIFICANCE_CONFIGURE", module: "EAI", action: "SIGNIFICANCE_CONFIGURE", description: "Edit significance thresholds and acceptability per occurrence type" },
  { code: "EAI.REVIEW_TRIGGER",       module: "EAI", action: "REVIEW_TRIGGER",       description: "Manually trigger a review cycle on an EAI entry" },
  { code: "EAI.VERSION_VIEW",         module: "EAI", action: "VERSION_VIEW",         description: "View immutable EaiVersion history and diffs" },
  { code: "EAI.COMPLIANCE_REPORT",    module: "EAI", action: "COMPLIANCE_REPORT",    description: "View compliance obligations dashboard and statutory reporting status" },
  { code: "EAI.FEATURE_FLAG_TOGGLE",  module: "EAI", action: "FEATURE_FLAG_TOGGLE",  description: "Enable / disable per-plant Phase 2 feature flags (EAI register, Combined Register, Risk Dashboard, HIRA Assistant v2)" },

  // ─── Fire & Life Safety — the non-CRUD codes ─────────────────────────────
  // CRUD + APPROVE/EXECUTE/VERIFY/CLOSE/EXPORT come free from
  // OPERATIONAL_MODULES.FIRE above. These three gate the things that are
  // configuration rather than record-keeping.
  //
  // TEMPLATE_AUTHOR and TEMPLATE_APPROVE are deliberately separate codes, and
  // separate from FIRE.APPROVE. Approving a *checklist record* says "these
  // readings are correct". Approving a *checklist template* publishes a version
  // of a controlled document that every future inspection on the site will be
  // recorded against — a document-control act, not an inspection one. The person
  // who transcribes a revised client sheet should not also be the person who
  // rules it fit to publish.
  { code: "FIRE.TEMPLATE_AUTHOR",  module: "FIRE", action: "TEMPLATE_AUTHOR",  description: "Create / edit / clone fire checklist templates (controlled document transcription)" },
  { code: "FIRE.TEMPLATE_APPROVE", module: "FIRE", action: "TEMPLATE_APPROVE", description: "Publish a fire checklist template revision, retiring the prior one" },
  // Marking a day as a shutdown or holiday removes it from every daily
  // checklist's compliance count for that plant, so it is an authority of its
  // own rather than something any inspector can do to their own backlog.
  { code: "FIRE.CALENDAR",         module: "FIRE", action: "CALENDAR",         description: "Mark plant non-working days (Sunday/holiday) on the daily checklist grids" },

  // ─── Combined Risk Register + Risk Aggregation Dashboard (HIRA Phase 2) ──
  { code: "RISK.COMBINED_VIEW",       module: "RISK", action: "COMBINED_VIEW",       description: "View the combined HIRA + EAI risk register" },
  { code: "RISK.DASHBOARD_VIEW",      module: "RISK", action: "DASHBOARD_VIEW",      description: "View the Risk Aggregation Dashboard (executive + plant-level)" },
  { code: "RISK.DASHBOARD_EXPORT",    module: "RISK", action: "DASHBOARD_EXPORT",    description: "Export Risk Aggregation Dashboard widgets (PDF executive summary)" },

  // ─── CAPA generalization — Phase 1 of IMS QMS wedge ──────────────────────
  // CRUD + 6 lifecycle actions come from OPERATIONAL_MODULES.CAPA above.
  // These additional codes gate cross-source visibility, master config,
  // pattern detection, and recurrence checks that don't fit generic CRUD.
  { code: "CAPA.CROSS_SOURCE_VIEW",   module: "CAPA", action: "CROSS_SOURCE_VIEW",   description: "View CAPAs across source categories outside the role's default scope (e.g. Quality Manager seeing safety CAPAs)" },
  { code: "CAPA.PATTERN_LINK",        module: "CAPA", action: "PATTERN_LINK",        description: "Confirm/dismiss auto-detected CAPA pattern groups and manually link related CAPAs" },
  { code: "CAPA.MASTERS_CONFIGURE",   module: "CAPA", action: "MASTERS_CONFIGURE",   description: "Edit CapaSourceCategory, CapaSubCategory, CapaVerificationMethod, CapaSlaProfile masters" },
  { code: "CAPA.RECURRENCE_CHECK",    module: "CAPA", action: "RECURRENCE_CHECK",    description: "Run / complete the post-closure recurrence check on a CAPA" },
  { code: "CAPA.REASSIGN",            module: "CAPA", action: "REASSIGN",            description: "Reassign primary owner or action owners on a CAPA" },

  // ─── Facilities — Factory Profile Master & Consolidated Dashboard ────────
  // CRUD on factory profiles + buildings, plus the custom actions that gate the
  // later-phase tabs (workforce / certifications / contacts), the comparison
  // view, and the 1:1 site-link configuration. READ also gates the consolidated
  // dashboard, the per-factory profile, and the live Compliance & Audit tab.
  { code: "FACILITY.READ",             module: "FACILITY", action: "READ",             description: "View the consolidated facilities dashboard, factory profiles, buildings and the live Compliance & Audit tab" },
  { code: "FACILITY.CREATE",           module: "FACILITY", action: "CREATE",           description: "Create a factory profile (1:1 with a Site)" },
  { code: "FACILITY.UPDATE",           module: "FACILITY", action: "UPDATE",           description: "Edit a factory profile and manage its building register" },
  { code: "FACILITY.DELETE",           module: "FACILITY", action: "DELETE",           description: "Archive a factory profile (soft delete)" },
  { code: "FACILITY.EXPORT",           module: "FACILITY", action: "EXPORT",           description: "Export facilities reports (factory master, building / workforce / certification registers)" },
  { code: "FACILITY.WORKFORCE_UPDATE", module: "FACILITY", action: "WORKFORCE_UPDATE", description: "Update workforce composition (permanent/contract split + SA8000 gender lens + child-labour evidence)" },
  { code: "FACILITY.SOCIAL_UPDATE",     module: "FACILITY", action: "SOCIAL_UPDATE",     description: "Edit the social-compliance (SA8000) profile — wages, working hours, freedom of association, grievance & training" },
  { code: "FACILITY.CERT_MANAGE",      module: "FACILITY", action: "CERT_MANAGE",      description: "Manage factory certifications (SA8000, WRAP, ISO, SMETA, …) and expiry tracking" },
  { code: "FACILITY.CONTACT_MANAGE",   module: "FACILITY", action: "CONTACT_MANAGE",   description: "Manage factory contacts (factory manager, safety / compliance / HR officers)" },
  { code: "FACILITY.COMPARE",          module: "FACILITY", action: "COMPARE",          description: "Use factory comparison / benchmarking" },
  // Narrowed to the SUPPLIER case only: attaching a factory to a Site that
  // already exists. Provisioning a Site for a Page-owned factory no longer needs
  // it — that is ordinary FACILITY.CREATE — so grant this to the supplier lead
  // auditor rather than to every operational creator. It is what the Site picker
  // on Add Factory is gated on, in the UI and on the create endpoint alike.
  { code: "FACILITY.SITE_LINK",        module: "FACILITY", action: "SITE_LINK",        description: "Link a factory to an existing Site (the 1:1 supplier mapping) and configure profile review settings" },
  // Two-step sign-off on an edit to an ACTIVE factory profile: the Unit
  // confirms the change is factually right, Compliance confirms it is
  // admissible. Deliberately separate codes — held by different people is the
  // whole point, and the API refuses both steps from the same user.
  { code: "FACILITY.PROFILE_APPROVE_UNIT",       module: "FACILITY", action: "PROFILE_APPROVE_UNIT",       description: "Approve a factory-profile change request at the Unit (Plant Head)" },
  { code: "FACILITY.PROFILE_APPROVE_COMPLIANCE", module: "FACILITY", action: "PROFILE_APPROVE_COMPLIANCE", description: "Give the final factory-profile change approval (Compliance Team — Lead Auditor)" },

  // ─── User-initiated AI agent platform (Commit 1) ──────────────────────
  // One INVOKE permission per agent so RBAC can restrict pilots to specific
  // plants/roles. Scope=OWN_PLANT for HSE Manager / Plant Head / Safety
  // Officer; ALL_PLANTS for Corporate HSE; ADMIN gets everything.
  // AGENT.RCA_CONFIGURE gates authority-level changes and prompt edits;
  // AGENT.AUDIT_VIEW gates the transparency drawer (raw context + API
  // response). Adding a new agent means adding its INVOKE row here plus
  // wiring the code into _INVOKE_PERMISSIONS in agent_service.py.
  { code: "AGENT.RCA_INVOKE",            module: "AGENT", action: "RCA_INVOKE",            description: "Invoke the RCA Assistant agent on an incident" },
  { code: "AGENT.RCA_CONFIGURE",         module: "AGENT", action: "RCA_CONFIGURE",         description: "Change RCA agent authority, prompt version, or rate limit" },
  { code: "AGENT.PERMIT_REVIEW_INVOKE",  module: "AGENT", action: "PERMIT_REVIEW_INVOKE",  description: "Invoke the Permit Risk Reviewer agent on a permit submission" },
  { code: "AGENT.TRIAGE_INVOKE",         module: "AGENT", action: "TRIAGE_INVOKE",         description: "Invoke the Triage Agent on an observation or near-miss record" },
  { code: "AGENT.HIRA_INVOKE",           module: "AGENT", action: "HIRA_INVOKE",           description: "Invoke the HIRA Assistant agent on a HIRA entry" },
  { code: "AGENT.CAPA_INVOKE",           module: "AGENT", action: "CAPA_INVOKE",           description: "Invoke the CAPA Assistant agent on a CAPA record" },
  { code: "AGENT.AUDIT_VIEW",            module: "AGENT", action: "AUDIT_VIEW",            description: "View full agent invocation audit trail (raw context + API responses)" },
  { code: "AGENT.PROMPT_EDIT",           module: "AGENT", action: "PROMPT_EDIT",           description: "Author and approve new agent system prompt versions" },

  // ─── Skill Matrix non-CRUD permissions (Phase 1 IMS) ──────────────────
  // CRUD + lifecycle (CREATE/READ/UPDATE/DELETE/APPROVE/EXECUTE/VERIFY/CLOSE/
  // EXPORT) come free from OPERATIONAL_MODULES.SKILL_MATRIX. These gate the
  // actions that don't fit generic CRUD — mapped 1:1 to spec §8.1 columns.
  { code: "SKILL_MATRIX.COMPETENCY_CONFIGURE", module: "SKILL_MATRIX", action: "COMPETENCY_CONFIGURE", description: "Create / edit Competency + Skill masters and validation methods (spec §8.1 'Edit Competency Master')" },
  { code: "SKILL_MATRIX.ROLE_DEF_CONFIGURE",   module: "SKILL_MATRIX", action: "ROLE_DEF_CONFIGURE",   description: "Create / edit RoleDefinition and its competency requirements (spec §8.1 'Edit Role Definition')" },
  { code: "SKILL_MATRIX.ASSESS",               module: "SKILL_MATRIX", action: "ASSESS",               description: "Conduct competency assessments and sign supervised-performance records" },
  { code: "SKILL_MATRIX.SUSPEND",              module: "SKILL_MATRIX", action: "SUSPEND",              description: "Suspend / reinstate a person's competency" },
  { code: "SKILL_MATRIX.APPROVE_OVERRIDE",     module: "SKILL_MATRIX", action: "APPROVE_OVERRIDE",     description: "Approve a role assignment beyond the competency grace period" },
  { code: "SKILL_MATRIX.RECERT_CYCLE",         module: "SKILL_MATRIX", action: "RECERT_CYCLE",         description: "Initiate and manage re-certification cycles" },
  { code: "SKILL_MATRIX.CROSS_PERSON_VIEW",    module: "SKILL_MATRIX", action: "CROSS_PERSON_VIEW",    description: "View detailed competency records of persons outside the holder's scope" },
  { code: "SKILL_MATRIX.VERSION_VIEW",         module: "SKILL_MATRIX", action: "VERSION_VIEW",         description: "View immutable CompetencyRecordVersion history and diffs" },

  // ─── ERM non-CRUD permissions (Enterprise Risk Management) ────────────────
  // CRUD + APPROVE/CLOSE/EXPORT come free from OPERATIONAL_MODULES.ERM. These
  // gate the actions that don't fit the generic CRUD shape (spec §4 matrix).
  { code: "ERM.ASSESS",         module: "ERM", action: "ASSESS",         description: "Record / revise inherent + residual risk assessments" },
  { code: "ERM.TREAT",          module: "ERM", action: "TREAT",          description: "Create risk treatments (spawns CAPA RISK_TREATMENT) and record TOLERATE" },
  { code: "ERM.ACCEPT",         module: "ERM", action: "ACCEPT",         description: "Approve risk acceptance / TOLERATE sign-off (CRO only)" },
  { code: "ERM.REVIEW",         module: "ERM", action: "REVIEW",         description: "Conduct periodic risk reviews" },
  { code: "ERM.LINK",           module: "ERM", action: "LINK",           description: "Create / remove risk interconnection linkages" },
  { code: "ERM.BOARD_PACK",     module: "ERM", action: "BOARD_PACK",     description: "Generate / draft board packs and trigger register snapshots" },
  { code: "ERM.TAXONOMY_ADMIN", module: "ERM", action: "TAXONOMY_ADMIN", description: "Manage risk categories + sub-categories (taxonomy admin)" },
  { code: "ERM.MATRIX_ADMIN",   module: "ERM", action: "MATRIX_ADMIN",   description: "Edit the scoring matrix — labels, descriptors, band thresholds" },
  { code: "ERM.ROLLUP_ADMIN",   module: "ERM", action: "ROLLUP_ADMIN",   description: "Manage HSE rollup rules and run aggregation" },
  // RCA — Cross-Domain Root Cause Analysis & Causal Intelligence (CRUD/APPROVE
  // come free from OPERATIONAL_MODULES.RCA). These are the non-CRUD codes.
  { code: "RCA.TAG",            module: "RCA", action: "TAG",            description: "Tag identified causes against the taxonomy + link RCAs to risk(s); raise CAPA" },
  { code: "RCA.TAXONOMY_ADMIN", module: "RCA", action: "TAXONOMY_ADMIN", description: "Manage the two-layer root-cause taxonomy (categories + sub-causes)" },

  // ─── ERM Phase 2 — KRI / Appetite / Compliance / Loss ───────────────────
  { code: "KRI.READ",          module: "KRI", action: "READ",   description: "View KRI dashboards, definitions, readings, breaches" },
  { code: "KRI.ADMIN",         module: "KRI", action: "ADMIN",  description: "Define KRIs, set thresholds, run module-fed jobs, rotate API tokens" },
  { code: "KRI.ENTER",         module: "KRI", action: "ENTER",  description: "Enter / bulk-enter KRI readings" },
  { code: "KRI.ACK",           module: "KRI", action: "ACK",    description: "Acknowledge / resolve KRI breach events" },
  { code: "APPETITE.READ",     module: "APPETITE", action: "READ",    description: "View appetite statements, gauges, breaches" },
  { code: "APPETITE.AUTHOR",   module: "APPETITE", action: "AUTHOR",  description: "Draft / edit / submit risk appetite statements" },
  { code: "APPETITE.APPROVE",  module: "APPETITE", action: "APPROVE", description: "Approve / activate appetite statements (CRO only)" },
  { code: "APPETITE.DECIDE",   module: "APPETITE", action: "DECIDE",  description: "Record committee decisions on appetite breaches (CRO only)" },
  { code: "COMPLIANCE.READ",   module: "COMPLIANCE", action: "READ",   description: "View obligations register, tasks, compliance dashboards" },
  { code: "COMPLIANCE.MANAGE", module: "COMPLIANCE", action: "MANAGE", description: "Create / edit obligations; raise compliance CAPAs" },
  { code: "COMPLIANCE.ATTEST", module: "COMPLIANCE", action: "ATTEST", description: "Attest compliance tasks (owner) with evidence" },
  { code: "COMPLIANCE.VERIFY", module: "COMPLIANCE", action: "VERIFY", description: "Verify attested compliance tasks (Compliance Officer only)" },
  { code: "COMPLIANCE.WAIVE",  module: "COMPLIANCE", action: "WAIVE",  description: "Waive compliance tasks with justification (Compliance Officer only)" },
  { code: "LOSS.READ",         module: "LOSS", action: "READ",   description: "View loss event register + analytics / calibration" },
  { code: "LOSS.CREATE",       module: "LOSS", action: "CREATE", description: "Create / quantify loss events; run incident auto-feed" },
  { code: "LOSS.CLOSE",        module: "LOSS", action: "CLOSE",  description: "Close quantified loss events" },

  // ─── CAMS — Compliance & Audit Management System (centralised engine) ────
  // Raising an audit, split out from AUDIT_COMPLIANCE.CREATE so that "who may
  // schedule" is its own admin-managed switch. CREATE still gates checkpoint
  // library import and template custom-checkpoint authoring; restricting
  // scheduling by revoking CREATE would silently take those away too.
  { code: "AUDIT_COMPLIANCE.SCHEDULE", module: "AUDIT_COMPLIANCE", action: "SCHEDULE", description: "Schedule (raise) an audit — the Schedule Audit action" },
  // Allocating checkpoints and re-seating a live team, split out of
  // AUDIT_COMPLIANCE.UPDATE for the same reason SCHEDULE was split out of
  // CREATE: "who decides who conducts what" is its own admin-managed switch.
  //
  // UPDATE could not express it. An AUDITEE holds UPDATE at ALL_PLANTS by
  // design — `_scope_covers_plant` reads the auditee slot's permission to decide
  // who may be SEATED, and OWN_RECORDS would stop an auditee being named on
  // another unit's audit — and an ALL_PLANTS grant satisfies `can()` before it
  // ever consults the record that /allocate passes. The audited party could
  // therefore reallocate the very disciplines being audited, and re-seat the
  // team, on any audit at any site. A scope cannot say "not the people under
  // audit"; a separate permission can.
  { code: "AUDIT_COMPLIANCE.ALLOCATE", module: "AUDIT_COMPLIANCE", action: "ALLOCATE", description: "Allocate checkpoints to auditors / auditees and re-seat a live audit team" },
  { code: "CAMS.READ",             module: "CAMS", action: "READ",             description: "View CAMS engagements, templates, findings, command centre" },
  { code: "CAMS.TYPE_CONFIG",      module: "CAMS", action: "TYPE_CONFIG",      description: "Configure audit types + recurrence rules" },
  { code: "CAMS.TEMPLATE_AUTHOR",  module: "CAMS", action: "TEMPLATE_AUTHOR",  description: "Author / edit / clone checklist templates" },
  { code: "CAMS.TEMPLATE_APPROVE", module: "CAMS", action: "TEMPLATE_APPROVE", description: "Approve a template version (locks it immutable)" },
  { code: "CAMS.SCHEDULE",         module: "CAMS", action: "SCHEDULE",         description: "Plan / schedule / reschedule audit & inspection engagements" },
  { code: "CAMS.EXECUTE",          module: "CAMS", action: "EXECUTE",          description: "Run the checklist; record + disposition findings" },
  { code: "CAMS.CLOSE",            module: "CAMS", action: "CLOSE",            description: "Close an engagement (CAPA / finding gates enforced)" },
  { code: "CAMS.FINDING_MANAGE",   module: "CAMS", action: "FINDING_MANAGE",   description: "Raise / disposition findings; raise CAPA (AUDIT source)" },
  { code: "CAMS.ANALYTICS",        module: "CAMS", action: "ANALYTICS",        description: "Audit analytics & benchmarking" },

  // ─── ERM Phase 3 — BCM (BIA / Plans / Crisis / Exercises) + Scenario ─────
  { code: "BCM.READ",          module: "BCM", action: "READ",        description: "View BCM dashboards, processes, plans, crisis, exercises, scenarios, horizon" },
  { code: "BIA.WRITE",         module: "BIA", action: "WRITE",       description: "Create / edit business processes + dependencies (BIA)" },
  { code: "BIA.APPROVE",       module: "BIA", action: "APPROVE",     description: "Approve a Business Impact Analysis" },
  { code: "PLAN.WRITE",        module: "PLAN", action: "WRITE",      description: "Author / edit continuity plans (draft)" },
  { code: "PLAN.APPROVE",      module: "PLAN", action: "APPROVE",    description: "Approve / version continuity plans" },
  { code: "CRISIS.ADMIN",      module: "CRISIS", action: "ADMIN",    description: "Manage crisis teams and call trees" },
  { code: "CRISIS.ACTIVATE",   module: "CRISIS", action: "ACTIVATE", description: "Activate a crisis event" },
  { code: "CRISIS.MANAGE",     module: "CRISIS", action: "MANAGE",   description: "Escalate severity / stand-down / close crisis events" },
  { code: "EXERCISE.WRITE",    module: "EXERCISE", action: "WRITE",  description: "Schedule / facilitate BC exercises; capture findings; raise BC CAPAs" },
  { code: "EXERCISE.COMPLETE", module: "EXERCISE", action: "COMPLETE", description: "Complete BC exercises (enforces gap-CAPA gates)" },
  { code: "SCENARIO.WRITE",    module: "SCENARIO", action: "WRITE",  description: "Author / edit scenarios; run as exercise" },
  { code: "HORIZON.WRITE",     module: "HORIZON", action: "WRITE",   description: "Manage horizon watchlist + dispositions" },

  // ─── ERM Tier 3 — Internal Controls · Vendor/ESG · Insurance & Transfer ───
  { code: "CONTROL.READ",       module: "CONTROL", action: "READ",       description: "View controls register, risk-control matrix, deficiencies, dashboard" },
  { code: "CONTROL.WRITE",      module: "CONTROL", action: "WRITE",      description: "Create/edit controls; map controls to risks/processes/obligations" },
  { code: "CONTROL.TEST",       module: "CONTROL", action: "TEST",       description: "Schedule / record control tests (tester != owner enforced)" },
  { code: "CONTROL.DEFICIENCY", module: "CONTROL", action: "DEFICIENCY", description: "Raise / manage control deficiencies + remediation" },
  { code: "CONTROL.REPORT_MW",  module: "CONTROL", action: "REPORT_MW",  description: "Mark a material weakness reported to the audit committee (CRO)" },
  { code: "CONTROL.CONFIG",     module: "CONTROL", action: "CONFIG",     description: "Controls configuration admin" },
  { code: "VENDOR.READ",        module: "VENDOR",  action: "READ",       description: "View vendor register, profiles, dashboards, ESG portfolio" },
  { code: "VENDOR.WRITE",       module: "VENDOR",  action: "WRITE",      description: "Onboard vendors; assess on the RISK lens; raise as risk" },
  { code: "VENDOR.ESG",         module: "VENDOR",  action: "ESG",        description: "Assess vendors on the ESG lens" },
  { code: "VENDOR.APPROVE",     module: "VENDOR",  action: "APPROVE",    description: "Approve a strategic/critical vendor with open critical gaps (CRO)" },
  { code: "VENDOR.CONFIG",      module: "VENDOR",  action: "CONFIG",     description: "Vendor scoring configuration admin" },
  { code: "INSURANCE.READ",     module: "INSURANCE", action: "READ",     description: "View policies, claims, coverage gap, insurance dashboard" },
  { code: "INSURANCE.WRITE",    module: "INSURANCE", action: "WRITE",    description: "Manage policies + renewals" },
  { code: "INSURANCE.CLAIM",    module: "INSURANCE", action: "CLAIM",    description: "Manage insurance claims + loss-event reconciliation" },
  { code: "INSURANCE.GAP",      module: "INSURANCE", action: "GAP",      description: "Run coverage-gap assessments; raise transfer treatments" },

  // ─── Guided Field Capture (low-literacy wizard) + Daily Alert Brief ─────
  { code: "CAPTURE.CREATE",  module: "CAPTURE", action: "CREATE",  description: "Submit guided field reports (observation / near-miss / unsafe condition / incident) from the capture wizard" },
  { code: "CAPTURE.READ",    module: "CAPTURE", action: "READ",    description: "View field-report submissions (triage queue / own history by scope)" },
  { code: "CAPTURE.TRIAGE",  module: "CAPTURE", action: "TRIAGE",  description: "Triage field reports onto the 5x5 matrix; convert to Observation / Near Miss / Incident; reject" },
  { code: "CAPTURE.UNMASK",  module: "CAPTURE", action: "UNMASK",  description: "Reveal the reporter of an anonymous field report (writes a READ_SENSITIVE audit entry)" },
  { code: "ALERT.READ",      module: "ALERT",   action: "READ",    description: "View the daily alert brief feed (/dashboard/daily)" },
  { code: "ALERT.ACK",       module: "ALERT",   action: "ACK",     description: "Acknowledge alert cards (audited)" },
  { code: "ALERT.MUTE",      module: "ALERT",   action: "MUTE",    description: "Mute non-critical alert cards for 24h" }
];

// Default role-permission matrix. scope picks one of:
//   ALL_PLANTS / OWN_PLANT / OWN_DEPARTMENT / OWN_RECORDS
// Reading: WORKER can CREATE observations anywhere; can READ only their own.
type Scope = "ALL_PLANTS" | "OWN_PLANT" | "OWN_DEPARTMENT" | "OWN_RECORDS";
type Grant = { module: string; actions: string[]; scope: Scope };

// ─── Safety Observation matrix (per stakeholder spec) ──────────────────
// Anyone can raise an observation — that's a deliberate safety-culture choice.
// "OWN-draft" semantics for UPDATE are encoded as scope=OWN_RECORDS here;
// the API additionally enforces that only DRAFT-state records are editable.
// Closing is an HSE_MANAGER (or higher) authority.
//
// Matrix:
//   Role                       C    R     U          AP     EX    VR    CL    DL    EXP
//   Worker / Contractor        ALL  OWN   OWN-draft  —      OWN   —     —     —     —
//   Supervisor                 ALL  DEPT  OWN-draft  DEPT   OWN   —     —     —     DEPT
//   Permit Issuer              ALL  DEPT  OWN-draft  —      OWN   —     —     —     DEPT
//   Safety Officer             ALL  PLANT OWN-draft  PLANT  OWN   PLANT —     —     PLANT
//   Department Head            ALL  DEPT  OWN-draft  DEPT   OWN   —     —     —     DEPT
//   HSE Manager                ALL  PLANT PLANT      PLANT  PLANT PLANT PLANT PLANT PLANT
//   Plant Head                 ALL  PLANT PLANT      PLANT  —     —     PLANT —     PLANT
//   Corporate HSE              ALL  ALL   ALL        ALL    —     ALL   ALL   ALL   ALL
//   System Admin               ALL  ALL   ALL        ALL    ALL   ALL   ALL   ALL   ALL
//   Trainer / LD Manager       ALL  OWN   OWN-draft  —      OWN   —     —     —     —
//   Maintenance Head           ALL  DEPT  OWN-draft  —      OWN   —     —     —     DEPT
//   Contractor Coordinator     ALL  PLANT OWN-draft  —      OWN   —     —     —     PLANT
//   Environment Manager        ALL  PLANT OWN-draft  —      OWN   —     —     —     PLANT

// ─── ROLE_GRANTS — verbatim mirror of the matrix ──────────────────────
//
// This object is the source of truth for the Role × Permission × Scope
// matrix. Every grant below corresponds to a single cell in the published
// matrix (see top-of-file table). Adding/removing/changing scopes here
// changes the runtime RBAC after re-running this seed.
//
// Matrix conventions:
//   "ALL"   → ALL_PLANTS
//   "PLANT" → OWN_PLANT
//   "DEPT"  → OWN_DEPARTMENT
//   "OWN"   → OWN_RECORDS
//   "—"     → grant absent entirely
//
// Action codes:
//   C=CREATE  R=READ  U=UPDATE  AP=APPROVE  EX=EXECUTE
//   VR=VERIFY CL=CLOSE  DL=DELETE  EXP=EXPORT
const ROLE_GRANTS: Record<string, Grant[]> = {
  // ════════════════════════════════════════════════════════════════════
  // Worker / Contractor Workman — anyone-can-report field role.
  // Edits limited to own draft; can sign FLRAs they're crew on; can
  // acknowledge their own training records.
  // ════════════════════════════════════════════════════════════════════
  WORKER: [
    // Guided Field Capture — anyone-can-report, same culture as observations
    { module: "CAPTURE", actions: ["CREATE"], scope: "ALL_PLANTS" },
    { module: "CAPTURE", actions: ["READ"], scope: "OWN_RECORDS" },
    { module: "MOC", actions: ["READ"], scope: "OWN_DEPARTMENT" }, // MOC §8.1 (view dept changes)
    { module: "SKILL_MATRIX", actions: ["READ"], scope: "OWN_RECORDS" }, // Skill Matrix §8.1 (view own)
    // Observation: C=ALL, R/U/EX=OWN
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "OBSERVATION", actions: ["READ", "UPDATE", "EXECUTE"],         scope: "OWN_RECORDS" },
    // Near Miss: C=ALL, R/U/EX=OWN
    { module: "NEAR_MISS",   actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "NEAR_MISS",   actions: ["READ", "UPDATE", "EXECUTE"],         scope: "OWN_RECORDS" },
    // Incident: C=ALL (initial report), R=OWN
    { module: "INCIDENT",    actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "INCIDENT",    actions: ["READ"],                              scope: "OWN_RECORDS" },
    // PTW: R=OWN-crew (read-only on permits they're crew on)
    { module: "PTW",         actions: ["READ"],                              scope: "OWN_RECORDS" },
    // FLRA: R=OWN-crew, EX=OWN (sign their own crew row)
    { module: "FLRA",        actions: ["READ", "EXECUTE"],                   scope: "OWN_RECORDS" },
    // Training: R=OWN, EX=OWN (acknowledge), EXP=OWN-cert
    { module: "TRAINING",    actions: ["READ", "EXECUTE", "EXPORT"],         scope: "OWN_RECORDS" },
    // Inspection: R=OWN
    { module: "INSPECTION",  actions: ["READ"],                              scope: "OWN_RECORDS" },
    // HIRA — Worker can only read entries for their own area (no edit, no review).
    // OWN_RECORDS isn't quite right for HIRA since workers aren't named on
    // entries, but OWN_PLANT would over-grant. The record-context resolver
    // for HIRA_ENTRY returns areaId; UI restricts list to entries matching
    // the worker's department. The READ permission with OWN_DEPARTMENT
    // scope is the closest fit.
    { module: "HIRA",        actions: ["READ"],                              scope: "OWN_DEPARTMENT" },
    // Audit & Compliance — auditee: read audits with checkpoints routed to
    // them and respond on their own checkpoints (audit lifecycle A-05/A-06).
    { module: "AUDIT_COMPLIANCE", actions: ["READ", "UPDATE"],              scope: "OWN_RECORDS" },
    { module: "AGENT",       actions: ["RCA_INVOKE"],                       scope: "OWN_RECORDS" }
  ],
  CONTRACTOR_WORKMAN: [
    { module: "SKILL_MATRIX", actions: ["READ"], scope: "OWN_RECORDS" }, // Skill Matrix §8.1 (view own)
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "OBSERVATION", actions: ["READ", "UPDATE", "EXECUTE"],         scope: "OWN_RECORDS" },
    { module: "NEAR_MISS",   actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "NEAR_MISS",   actions: ["READ", "UPDATE", "EXECUTE"],         scope: "OWN_RECORDS" },
    { module: "INCIDENT",    actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "INCIDENT",    actions: ["READ"],                              scope: "OWN_RECORDS" },
    { module: "PTW",         actions: ["READ"],                              scope: "OWN_RECORDS" },
    { module: "FLRA",        actions: ["READ", "EXECUTE"],                   scope: "OWN_RECORDS" },
    { module: "TRAINING",    actions: ["READ", "EXECUTE", "EXPORT"],         scope: "OWN_RECORDS" },
    { module: "AGENT",       actions: ["RCA_INVOKE"],                       scope: "OWN_RECORDS" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // Supervisor — frontline; raises FLRA + low-risk PTW; approves
  // observations within own department.
  // ════════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════
  // Field Technician — the low-literacy capture persona. Wizard + own
  // history only; no triage, no dashboards.
  // ════════════════════════════════════════════════════════════════════
  FIELD_TECHNICIAN: [
    { module: "CAPTURE", actions: ["CREATE"], scope: "OWN_PLANT" },
    { module: "CAPTURE", actions: ["READ"], scope: "OWN_RECORDS" },
  ],
  SUPERVISOR: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    // The frontline electrician / operator who walks the daily round. EXECUTE
    // fills the sheet; that is all. No VERIFY and no APPROVE — the sheet they
    // fill is reviewed and approved by someone else, which is the point of the
    // three-stage block printed on it.
    { module: "FIRE",        actions: ["READ", "EXECUTE"],                     scope: "OWN_DEPARTMENT" },
    { module: "MOC", actions: ["CREATE", "READ", "UPDATE"], scope: "OWN_DEPARTMENT" }, // MOC — raise minor changes
    { module: "SKILL_MATRIX", actions: ["READ", "ASSESS", "EXECUTE"], scope: "OWN_DEPARTMENT" }, // Skill Matrix §8.1
    // Observation: C=ALL, R/AP/EXP=DEPT, U/EX=OWN
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "OBSERVATION", actions: ["READ", "APPROVE", "EXPORT"],         scope: "OWN_DEPARTMENT" },
    { module: "OBSERVATION", actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // Near Miss: C=ALL, R/EXP=DEPT, U/EX=OWN (no APPROVE per matrix)
    { module: "NEAR_MISS",   actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "NEAR_MISS",   actions: ["READ", "EXPORT"],                    scope: "OWN_DEPARTMENT" },
    { module: "NEAR_MISS",   actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // Incident: C=ALL (initial), R/EXP=DEPT, U/EX=OWN
    { module: "INCIDENT",    actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "INCIDENT",    actions: ["READ", "EXPORT"],                    scope: "OWN_DEPARTMENT" },
    { module: "INCIDENT",    actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // PTW: C/R/EXP=DEPT, U=OWN (matrix shows Supervisor can originate dept-level permits)
    { module: "PTW",         actions: ["CREATE", "READ", "EXPORT"],          scope: "OWN_DEPARTMENT" },
    { module: "PTW",         actions: ["UPDATE"],                            scope: "OWN_RECORDS" },
    // FLRA: C/R/VR/EXP=DEPT, U/EX=OWN (toolbox confirm = VR)
    { module: "FLRA",        actions: ["CREATE", "READ", "VERIFY", "EXPORT"], scope: "OWN_DEPARTMENT" },
    { module: "FLRA",        actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // Training: R/EXP=DEPT
    { module: "TRAINING",    actions: ["READ", "EXPORT"],                    scope: "OWN_DEPARTMENT" },
    // Inspection: R/AP/VR/EXP=DEPT, EX=OWN
    { module: "INSPECTION",  actions: ["READ", "APPROVE", "VERIFY", "EXPORT"], scope: "OWN_DEPARTMENT" },
    { module: "INSPECTION",  actions: ["EXECUTE"],                           scope: "OWN_RECORDS" },
    // Manhours: R=DEPT (DEPT-summary)
    { module: "MANHOURS",    actions: ["READ"],                              scope: "OWN_DEPARTMENT" },
    // HIRA — Supervisor reads own-dept entries; can suggest edits via
    // OWN_RECORDS UPDATE only if they're named on the entry (team member);
    // can request review.
    { module: "HIRA",        actions: ["READ"],                              scope: "OWN_DEPARTMENT" },
    { module: "HIRA",        actions: ["UPDATE"],                            scope: "OWN_RECORDS" },
    { module: "HIRA",        actions: ["REVIEW_TRIGGER"],                    scope: "OWN_DEPARTMENT" },
    // Audit & Compliance — auditee: respond on own checkpoints.
    { module: "AUDIT_COMPLIANCE", actions: ["READ", "UPDATE"],              scope: "OWN_RECORDS" },
    { module: "AGENT",       actions: ["RCA_INVOKE", "PERMIT_REVIEW_INVOKE", "TRIAGE_INVOKE", "HIRA_INVOKE", "CAPA_INVOKE"], scope: "OWN_PLANT" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // Permit Issuer — owns PTW originate + Issuer step + site verify.
  // ════════════════════════════════════════════════════════════════════
  PERMIT_ISSUER: [
    // Observation: C=ALL, R/EXP=DEPT, U/EX=OWN
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "OBSERVATION", actions: ["READ", "EXPORT"],                    scope: "OWN_DEPARTMENT" },
    { module: "OBSERVATION", actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // Near Miss: C=ALL, R/EXP=PLANT, U/EX=OWN
    { module: "NEAR_MISS",   actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "NEAR_MISS",   actions: ["READ", "EXPORT"],                    scope: "OWN_PLANT" },
    { module: "NEAR_MISS",   actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // Incident: C=ALL, R/EXP=DEPT, U/EX=OWN
    { module: "INCIDENT",    actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "INCIDENT",    actions: ["READ", "EXPORT"],                    scope: "OWN_DEPARTMENT" },
    { module: "INCIDENT",    actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // PTW: C/R/AP/VR/EXP=PLANT, U=OWN, DL=OWN
    // (AP = Issuer step; VR = site verify; DL = own draft permits)
    { module: "PTW",         actions: ["CREATE", "READ", "APPROVE", "VERIFY", "EXPORT"], scope: "OWN_PLANT" },
    { module: "PTW",         actions: ["UPDATE", "DELETE"],                  scope: "OWN_RECORDS" },
    // FLRA: C/R/VR/EXP=PLANT, U/EX=OWN
    { module: "FLRA",        actions: ["CREATE", "READ", "VERIFY", "EXPORT"], scope: "OWN_PLANT" },
    { module: "FLRA",        actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // Training: R/EXP=DEPT
    { module: "TRAINING",    actions: ["READ", "EXPORT"],                    scope: "OWN_DEPARTMENT" },
    // HIRA: read-only. The permit form and the permit detail page both render
    // the "HIRA — Relevant Entries" panel (GET /api/hira/integrations/for-ptw),
    // which is gated on HIRA.READ. Without this grant the Issuer — the one
    // person who has to weigh those entries before approving — got HTTP 403
    // on every permit. Read only: authoring the register stays with HSE.
    { module: "HIRA",        actions: ["READ"],                              scope: "OWN_PLANT" },
    // Agent platform: Permit Issuer is the primary user of the Permit Risk
    // Reviewer agent (they read its advisory output on every submission
    // they review).
    { module: "AGENT",       actions: ["RCA_INVOKE", "PERMIT_REVIEW_INVOKE", "TRIAGE_INVOKE", "HIRA_INVOKE", "CAPA_INVOKE"], scope: "OWN_PLANT" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // Safety Officer — Safety step approver + final close on PTW.
  // ════════════════════════════════════════════════════════════════════
  SAFETY_OFFICER: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    // "Checked by: [Safety Officer]" is printed on the daily hydrant sheet and
    // the daily alarm sheet carries a Safety Officer signature row, so this role
    // is a preparer across the plant, not just its own department. Owns the
    // register too (CREATE/UPDATE) because they are the ones who find an
    // unregistered cylinder on a walk. No VERIFY/APPROVE — same reason as above.
    { module: "FIRE",        actions: ["CREATE", "READ", "UPDATE", "EXECUTE", "EXPORT"], scope: "OWN_PLANT" },
    // Guided Field Capture triage + Daily Alert Brief
    { module: "CAPTURE", actions: ["READ", "TRIAGE"], scope: "OWN_PLANT" },
    { module: "ALERT", actions: ["READ", "ACK", "MUTE"], scope: "OWN_PLANT" },
    // Observation: C=ALL, R/AP/VR/EXP=PLANT, U/EX=OWN
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "OBSERVATION", actions: ["READ", "APPROVE", "VERIFY", "EXPORT"], scope: "OWN_PLANT" },
    { module: "OBSERVATION", actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // Near Miss: C=ALL, R/AP/VR/EXP=PLANT, U/EX=OWN
    { module: "NEAR_MISS",   actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "NEAR_MISS",   actions: ["READ", "APPROVE", "VERIFY", "EXPORT"], scope: "OWN_PLANT" },
    { module: "NEAR_MISS",   actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // Incident: C=ALL, R/VR/EXP=PLANT, U/EX=OWN (CAPA owner)
    { module: "INCIDENT",    actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "INCIDENT",    actions: ["READ", "VERIFY", "EXPORT"],          scope: "OWN_PLANT" },
    { module: "INCIDENT",    actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // PTW: C/R/AP/CL/EXP=PLANT, U=OWN (Safety step + final close)
    { module: "PTW",         actions: ["CREATE", "READ", "APPROVE", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "PTW",         actions: ["UPDATE"],                            scope: "OWN_RECORDS" },
    // FLRA: C/R/VR/CL/EXP=PLANT, U/EX=OWN
    { module: "FLRA",        actions: ["CREATE", "READ", "VERIFY", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "FLRA",        actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // Training: R/EXP=PLANT
    { module: "TRAINING",    actions: ["READ", "EXPORT"],                    scope: "OWN_PLANT" },
    // Inspection: R/AP/VR/EXP=PLANT, EX=OWN
    { module: "INSPECTION",  actions: ["READ", "APPROVE", "VERIFY", "EXPORT", "SCHEDULE", "REASSIGN"], scope: "OWN_PLANT" },
    { module: "INSPECTION",  actions: ["EXECUTE"],                           scope: "OWN_RECORDS" },
    // Inspection masters & findings (Safety Officer reviews + approves)
    { module: "INSPECTION_TYPE",    actions: ["READ"],                       scope: "ALL_PLANTS" },
    { module: "CHECKLIST_TEMPLATE", actions: ["READ", "APPROVE"],            scope: "ALL_PLANTS" },
    { module: "EQUIPMENT_MASTER",   actions: ["READ"],                       scope: "OWN_PLANT" },
    { module: "INSPECTION_FINDING", actions: ["READ", "UPDATE", "VERIFY", "DEFER"], scope: "OWN_PLANT" },
    // Agent platform: Safety Officer can invoke RCA + Permit Risk Reviewer
    // + Triage agents on own-plant records.
    { module: "AGENT",       actions: ["RCA_INVOKE", "PERMIT_REVIEW_INVOKE", "TRIAGE_INVOKE", "HIRA_INVOKE", "CAPA_INVOKE"], scope: "OWN_PLANT" },
    // HIRA — Safety Officer creates and edits within team membership; cannot
    // approve studies (Plant Head / Corp HSE). REVIEW_TRIGGER + VERSION_VIEW
    // support running review cycles when team-assigned. LIBRARY_MANAGE OWN_PLANT
    // lets them add tenant-specific hazards/controls for their plant.
    { module: "HIRA",        actions: ["CREATE", "READ", "EXPORT"],          scope: "OWN_PLANT" },
    { module: "HIRA",        actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    { module: "HIRA",        actions: ["REVIEW_TRIGGER", "VERSION_VIEW", "LIBRARY_MANAGE"], scope: "OWN_PLANT" },
    // Audit & Compliance — Safety Officer is a frequent auditee; reads routed
    // audits and responds on own checkpoints.
    { module: "AUDIT_COMPLIANCE", actions: ["READ", "UPDATE"],              scope: "OWN_RECORDS" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // Department Head — department-scoped approval authority.
  // ════════════════════════════════════════════════════════════════════
  DEPARTMENT_HEAD: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    // "Reviewed by: Intermediatory Head" — the middle stage of the sheet's own
    // sign-off block. VERIFY only: a reviewer who could also EXECUTE could fill
    // a sheet and review it in the same breath.
    { module: "FIRE",        actions: ["READ", "VERIFY", "EXPORT"],            scope: "OWN_DEPARTMENT" },
    { module: "MOC", actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXPORT"], scope: "OWN_DEPARTMENT" }, // MOC — approve minor/moderate (own dept)
    { module: "SKILL_MATRIX", actions: ["READ", "ASSESS", "SUSPEND", "APPROVE_OVERRIDE"], scope: "OWN_DEPARTMENT" }, // Skill Matrix §8.1
    // Observation: C=ALL, R/AP/EXP=DEPT, U/EX=OWN
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "OBSERVATION", actions: ["READ", "APPROVE", "EXPORT"],         scope: "OWN_DEPARTMENT" },
    { module: "OBSERVATION", actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // Near Miss: C=ALL, R/AP/EXP=DEPT, U/EX=OWN
    { module: "NEAR_MISS",   actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "NEAR_MISS",   actions: ["READ", "APPROVE", "EXPORT"],         scope: "OWN_DEPARTMENT" },
    { module: "NEAR_MISS",   actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // Incident: C=ALL, R/EXP=DEPT, U/EX=OWN
    { module: "INCIDENT",    actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "INCIDENT",    actions: ["READ", "EXPORT"],                    scope: "OWN_DEPARTMENT" },
    { module: "INCIDENT",    actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // PTW: C/R/AP/EXP=DEPT, U=OWN
    { module: "PTW",         actions: ["CREATE", "READ", "APPROVE", "EXPORT"], scope: "OWN_DEPARTMENT" },
    { module: "PTW",         actions: ["UPDATE"],                            scope: "OWN_RECORDS" },
    // HIRA — Department Head creates and edits within own dept; assigned the
    // EXECUTE step (running periodic reviews); can trigger ad-hoc reviews;
    // cannot approve studies (Plant Head / Corp HSE only).
    { module: "HIRA",        actions: ["CREATE", "READ", "UPDATE", "EXECUTE", "EXPORT"], scope: "OWN_DEPARTMENT" },
    { module: "HIRA",        actions: ["REVIEW_TRIGGER", "VERSION_VIEW"],    scope: "OWN_DEPARTMENT" },
    // CAPA — Department Head owns CAPAs whose primaryOwner is in their dept;
    // can close low-severity, approve action plans for own-dept CAPAs.
    { module: "CAPA",        actions: ["CREATE", "READ", "UPDATE", "EXECUTE", "APPROVE", "EXPORT"], scope: "OWN_DEPARTMENT" },
    { module: "CAPA",        actions: ["CLOSE"],                             scope: "OWN_DEPARTMENT" },
    // Audit & Compliance — Department Head is an auditee for their area; reads
    // routed audits and responds on own checkpoints.
    { module: "AUDIT_COMPLIANCE", actions: ["READ", "UPDATE"],              scope: "OWN_RECORDS" },
    // CAMS.READ is what makes the above reachable. The audited party is the one
    // role CAMS deliberately has no dedicated code for — an auditee is an area
    // owner who also answers findings — and the taxonomy note at the top of this
    // file says they "inherit an existing area-owner role + CAMS.READ". Without
    // it the engagement screen carrying their own findings 403s, and the
    // AUDIT_COMPLIANCE grants above are unreachable in the UI.
    { module: "CAMS",        actions: ["READ"],                             scope: "OWN_PLANT" },
    { module: "AGENT",       actions: ["RCA_INVOKE", "PERMIT_REVIEW_INVOKE", "TRIAGE_INVOKE", "HIRA_INVOKE", "CAPA_INVOKE"], scope: "OWN_DEPARTMENT" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // HSE Manager — full operational authority within plant.
  // Note: the matrix shows EX=— for HSE Manager on PTW + Inspection;
  // they orchestrate but don't perform the field execution step.
  // ════════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════
  // HSE Manager — full operational authority at own plant(s) across ALL
  // modules except CONFIGURATION (MASTERS / PERMISSIONS / ROLES / USERS /
  // WORKFLOWS). CREATE on reporting modules is ALL_PLANTS so they can raise
  // records at any plant during site visits; all other actions are OWN_PLANT.
  // ════════════════════════════════════════════════════════════════════
  HSE_MANAGER: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    // "Approved by: HOD" — the final stage. Also the document-control authority
    // for the controlled checklists: transcribing a revised client sheet
    // (TEMPLATE_AUTHOR) and publishing it (TEMPLATE_APPROVE).
    //
    // ALL_PLANTS on every fire action, not on READ alone. The fire register is a
    // group-wide asset master: an HSE Manager holds PLANT-scoped role rows for
    // the units they line-manage, but extinguishers, panels and hydrants are
    // registered against the units that physically hold them, so OWN_PLANT
    // matched almost nothing. READ was already ALL_PLANTS, so every sheet and
    // every register row rendered — and then EXECUTE / EXPORT / UPDATE refused
    // the very same record with "scope does not include this record". A screen
    // that shows the work and then declines it teaches the rule by failing at
    // it. Fire & Life Safety is one HSE authority group-wide, so the whole verb
    // set moves together and the list and the record stop disagreeing.
    //
    // The separation that matters on a fire sheet is untouched: EXECUTE (prepare)
    // vs VERIFY (review) vs APPROVE (sign off) is enforced per action, not per
    // plant, and the roles that hold only some of those still hold only those.
    { module: "FIRE",        actions: ["READ", "CREATE", "UPDATE", "DELETE", "EXECUTE", "VERIFY", "APPROVE", "CLOSE", "EXPORT", "TEMPLATE_AUTHOR", "TEMPLATE_APPROVE", "CALENDAR"], scope: "ALL_PLANTS" },
    // Guided Field Capture triage + Daily Alert Brief
    { module: "CAPTURE", actions: ["READ", "TRIAGE"], scope: "OWN_PLANT" },
    { module: "ALERT", actions: ["READ", "ACK", "MUTE"], scope: "OWN_PLANT" },
    // ── Operational Safety ──────────────────────────────────────────
    // View / edit / delete of raised records are elevated to ALL_PLANTS so HSE
    // leadership can act on any originator's record group-wide (any plant).
    // CREATE on OBS/NM/INCIDENT is already ALL_PLANTS (site-visit reporting).
    // Approve/execute/verify/close/export stay OWN_PLANT — cross-plant workflow
    // ownership sits with CORPORATE_HSE.
    { module: "OBSERVATION",  actions: ["CREATE", "READ", "UPDATE", "DELETE"],                                                                 scope: "ALL_PLANTS" },
    { module: "OBSERVATION",  actions: ["APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT"],                                                    scope: "OWN_PLANT" },
    { module: "NEAR_MISS",    actions: ["CREATE", "READ", "UPDATE", "DELETE"],                                                                 scope: "ALL_PLANTS" },
    { module: "NEAR_MISS",    actions: ["APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT"],                                                    scope: "OWN_PLANT" },
    { module: "INCIDENT",     actions: ["CREATE", "READ", "UPDATE", "DELETE"],                                                                 scope: "ALL_PLANTS" },
    { module: "INCIDENT",     actions: ["APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT"],                                                    scope: "OWN_PLANT" },
    { module: "PTW",          actions: ["READ", "UPDATE", "DELETE"],                                                                           scope: "ALL_PLANTS" },
    { module: "PTW",          actions: ["CREATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT"],                                          scope: "OWN_PLANT" },
    { module: "FLRA",         actions: ["READ", "UPDATE", "DELETE"],                                                                           scope: "ALL_PLANTS" },
    { module: "FLRA",         actions: ["CREATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT"],                                          scope: "OWN_PLANT" },
    { module: "EPC",          actions: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT", "GATE_OVERRIDE", "INDUCTION_CONDUCT", "MOBILIZATION_APPROVE", "PREQUALIFY"], scope: "OWN_PLANT" },
    // ── Inspection ──────────────────────────────────────────────────
    { module: "INSPECTION",         actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "DELETE", "EXPORT", "SCHEDULE", "REASSIGN"], scope: "OWN_PLANT" },
    { module: "INSPECTION_TYPE",    actions: ["CREATE", "READ", "UPDATE", "DELETE"],                                                           scope: "OWN_PLANT" },
    { module: "CHECKLIST_TEMPLATE", actions: ["CREATE", "READ", "UPDATE", "APPROVE", "DELETE"],                                                scope: "OWN_PLANT" },
    { module: "EQUIPMENT_MASTER",   actions: ["CREATE", "READ", "UPDATE", "DELETE"],                                                           scope: "OWN_PLANT" },
    { module: "INSPECTION_FINDING", actions: ["READ", "UPDATE", "CLOSE", "VERIFY", "DEFER"],                                                   scope: "OWN_PLANT" },
    // ── Risk Management ─────────────────────────────────────────────
    { module: "HIRA",         actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "DELETE", "EXPORT"],              scope: "OWN_PLANT" },
    { module: "HIRA",         actions: ["LIBRARY_MANAGE", "MATRIX_CONFIGURE", "THRESHOLDS_CONFIGURE", "REVIEW_TRIGGER", "VERSION_VIEW"],       scope: "OWN_PLANT" },
    // Cross-Domain RCA — HSE investigator exposes/tags/approves operational
    // (event-derived) RCAs at own plant; reads analytics across the enterprise.
    { module: "RCA",          actions: ["READ"],                                                                                              scope: "ALL_PLANTS" },
    { module: "RCA",          actions: ["CREATE", "UPDATE", "APPROVE", "EXPORT", "TAG"],                                                       scope: "OWN_PLANT" },
    { module: "EAI",          actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "DELETE", "EXPORT"],              scope: "OWN_PLANT" },
    { module: "EAI",          actions: ["REVIEW_TRIGGER", "VERSION_VIEW", "COMPLIANCE_REPORT", "LIBRARY_MANAGE", "MATRIX_CONFIGURE", "SIGNIFICANCE_CONFIGURE", "FEATURE_FLAG_TOGGLE"], scope: "OWN_PLANT" },
    { module: "RISK",         actions: ["COMBINED_VIEW", "DASHBOARD_VIEW", "DASHBOARD_EXPORT"],                                                scope: "OWN_PLANT" },
    // ── CAPA ────────────────────────────────────────────────────────
    { module: "CAPA",         actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "DELETE", "EXPORT"],              scope: "OWN_PLANT" },
    { module: "CAPA",         actions: ["CROSS_SOURCE_VIEW", "PATTERN_LINK", "RECURRENCE_CHECK", "REASSIGN", "MASTERS_CONFIGURE"],             scope: "OWN_PLANT" },
    // ── Change Management ────────────────────────────────────────────
    { module: "MOC",          actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "DELETE", "EXPORT"],              scope: "OWN_PLANT" },
    // ── Audit & Compliance ──────────────────────────────────────────
    // SCHEDULE is currently held ONLY by HSE Manager + ADMIN.
    // ALL_PLANTS, the same reach as LEAD_AUDITOR. An HSE Manager owns the audit
    // programme across sites, and OWN_PLANT limited them to the plants they
    // happen to be SEATED at — two of twenty-eight for a manager holding a
    // NW + SW seat, which is exactly what the Owning-site picker offered.
    // ALL_PLANTS stores no plant list, so a site added later needs no RBAC edit.
    { module: "AUDIT_COMPLIANCE", actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT", "SCHEDULE"],        scope: "ALL_PLANTS" },
    { module: "AUDIT_COMPLIANCE", actions: ["ALLOCATE"], scope: "ALL_PLANTS" },
    { module: "AUDIT",        actions: ["VIEW"],                                                                                              scope: "OWN_PLANT" },
    // ── PPE ──────────────────────────────────────────────────────────
    { module: "PPE",          actions: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT", "ISSUE", "INSPECT", "CATALOG_MANAGE", "RETIRE_APPROVE", "RECALL_MANAGE"], scope: "OWN_PLANT" },
    // ── Training & Competency ────────────────────────────────────────
    { module: "TRAINING",     actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "DELETE", "EXPORT"],              scope: "OWN_PLANT" },
    { module: "SKILL_MATRIX", actions: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "APPROVE_OVERRIDE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT", "COMPETENCY_CONFIGURE", "ROLE_DEF_CONFIGURE", "RECERT_CYCLE", "ASSESS", "SUSPEND", "CROSS_PERSON_VIEW", "VERSION_VIEW"], scope: "OWN_PLANT" },
    // ── Manhours ─────────────────────────────────────────────────────
    { module: "MANHOURS",     actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "DELETE", "EXPORT"],              scope: "OWN_PLANT" },
    // ── Agent Platform ───────────────────────────────────────────────
    { module: "AGENT",        actions: ["RCA_INVOKE", "PERMIT_REVIEW_INVOKE", "TRIAGE_INVOKE", "HIRA_INVOKE", "CAPA_INVOKE", "AUDIT_VIEW", "PROMPT_EDIT", "RCA_CONFIGURE"], scope: "OWN_PLANT" },
    // ── CAMS — HSE managers conduct audits & inspections on the central engine ──
    { module: "CAMS",         actions: ["READ", "TEMPLATE_AUTHOR", "SCHEDULE", "EXECUTE", "CLOSE", "FINDING_MANAGE", "ANALYTICS"], scope: "OWN_PLANT" },
    // ── Facilities — full factory-level data entry + the consolidated estate.
    // ALL_PLANTS because the consolidated dashboard is inherently group-level
    // (factories live on their own Sites/plants, not the user's home plant).
    // No SITE_LINK: attaching a factory to an existing Site is the supplier
    // onboarding act, reserved for the supplier lead auditor. An HSE Manager
    // adding a Page-owned factory gets its Site provisioned automatically.
    { module: "FACILITY",     actions: ["READ", "CREATE", "UPDATE", "EXPORT", "COMPARE", "WORKFORCE_UPDATE", "SOCIAL_UPDATE", "CERT_MANAGE", "CONTACT_MANAGE"], scope: "ALL_PLANTS" },
  ],
  // ════════════════════════════════════════════════════════════════════
  // Plant Head — plant-wide oversight + final approver on high-risk.
  // EXECUTE on OBS/NM/INCIDENT is OWN_RECORDS — only when explicitly
  // assigned as action owner (not a broad workflow grant). Matrix treats
  // this as "—" for clarity; OWN_RECORDS is the operational equivalent.
  // ════════════════════════════════════════════════════════════════════
  PLANT_HEAD: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    // Approves and reads; does not fill sheets or edit the register. A plant head
    // signing off a checklist they also filled in would defeat the sign-off.
    // CALENDAR sits here because declaring a plant shutdown is a plant-head act.
    { module: "FIRE",        actions: ["READ", "VERIFY", "APPROVE", "CLOSE", "EXPORT", "CALENDAR"], scope: "OWN_PLANT" },
    // Field-report visibility + Daily Alert Brief
    { module: "CAPTURE", actions: ["READ"], scope: "OWN_PLANT" },
    { module: "ALERT", actions: ["READ", "ACK", "MUTE"], scope: "OWN_PLANT" },
    { module: "MOC", actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "DELETE", "EXPORT"], scope: "OWN_PLANT" }, // MOC — full, up to critical
    { module: "SKILL_MATRIX", actions: ["READ", "APPROVE_OVERRIDE", "RECERT_CYCLE", "EXPORT", "COMPETENCY_CONFIGURE", "ROLE_DEF_CONFIGURE", "ASSESS", "SUSPEND", "CROSS_PERSON_VIEW", "VERSION_VIEW"], scope: "OWN_PLANT" }, // Skill Matrix §8.1 (full, own plant)
    // Observation
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "OBSERVATION", actions: ["READ", "UPDATE", "APPROVE", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "OBSERVATION", actions: ["EXECUTE"],                           scope: "OWN_RECORDS" },
    // Near Miss
    { module: "NEAR_MISS",   actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "NEAR_MISS",   actions: ["READ", "UPDATE", "APPROVE", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "NEAR_MISS",   actions: ["EXECUTE"],                           scope: "OWN_RECORDS" },
    // Incident: AP=PLANT (final report), CL=PLANT (final close)
    { module: "INCIDENT",    actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "INCIDENT",    actions: ["READ", "UPDATE", "APPROVE", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    // PTW: C/R/U/AP/CL/EXP=PLANT (AP = high-risk types only, enforced by workflow)
    { module: "PTW",         actions: ["CREATE", "READ", "UPDATE", "APPROVE", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    // FLRA: C/R/EXP=PLANT (oversight only)
    { module: "FLRA",        actions: ["CREATE", "READ", "EXPORT"],          scope: "OWN_PLANT" },
    // Training: R/AP/EXP=PLANT (AP = high-cost approvals)
    { module: "TRAINING",    actions: ["READ", "APPROVE", "EXPORT"],         scope: "OWN_PLANT" },
    // Inspection: R/EXP=PLANT
    { module: "INSPECTION",  actions: ["READ", "EXPORT"],                    scope: "OWN_PLANT" },
    // Manhours: R/AP/EXP=PLANT
    { module: "MANHOURS",    actions: ["READ", "APPROVE", "EXPORT"],         scope: "OWN_PLANT" },
    // Agent platform: Plant Head can invoke all three agents + view audit
    // trail on own-plant invocations. Plant Head is the escalation target
    // named in critical permit-review and critical-triage findings.
    { module: "AGENT",       actions: ["RCA_INVOKE", "PERMIT_REVIEW_INVOKE", "TRIAGE_INVOKE", "HIRA_INVOKE", "CAPA_INVOKE", "AUDIT_VIEW"], scope: "OWN_PLANT" },
    // HIRA — Plant Head is the final approver on plant-scope studies.
    // R/U/AP/CL/EXP=PLANT; REVIEW_TRIGGER+VERSION_VIEW=PLANT.
    { module: "HIRA",        actions: ["READ", "UPDATE", "APPROVE", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "HIRA",        actions: ["REVIEW_TRIGGER", "VERSION_VIEW", "OVERRIDE_UNACCEPTABLE"], scope: "OWN_PLANT" },
    // CAPA — Plant Head closes high/critical CAPAs across all sources at
    // their plant. Has cross-source view by default.
    { module: "CAPA",        actions: ["READ", "UPDATE", "APPROVE", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "CAPA",        actions: ["CROSS_SOURCE_VIEW", "PATTERN_LINK", "REASSIGN"], scope: "OWN_PLANT" },
    // EAI — Plant Head is final approver on plant-scope EAI studies + closes.
    // CREATE so they can initiate strategic studies; APPROVE/CLOSE on all.
    // Owns the per-plant feature flag toggle (FEATURE_FLAG_TOGGLE).
    { module: "EAI",         actions: ["CREATE", "READ", "UPDATE", "APPROVE", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "EAI",         actions: ["REVIEW_TRIGGER", "VERSION_VIEW", "COMPLIANCE_REPORT", "FEATURE_FLAG_TOGGLE"], scope: "OWN_PLANT" },
    { module: "RISK",        actions: ["COMBINED_VIEW", "DASHBOARD_VIEW", "DASHBOARD_EXPORT"], scope: "OWN_PLANT" },
    // Audit & Compliance — Plant Head is the plant-manager reviewer (APPROVE +
    // CLOSE); can also schedule / conduct on own plant.
    { module: "AUDIT_COMPLIANCE", actions: ["CREATE", "READ", "UPDATE", "EXECUTE", "APPROVE", "VERIFY", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "AUDIT_COMPLIANCE", actions: ["ALLOCATE"], scope: "OWN_PLANT" },
    // ── CAMS — Plant Head: oversight + schedule/close on own plant ──
    { module: "CAMS",        actions: ["READ", "SCHEDULE", "CLOSE", "ANALYTICS"], scope: "OWN_PLANT" },
    // ── Facilities — consolidated estate view + full profile management.
    // ALL_PLANTS so the group dashboard populates (factories sit on their own Sites).
    // SITE_LINK dropped — see HSE_MANAGER above.
    { module: "FACILITY",    actions: ["READ", "CREATE", "UPDATE", "EXPORT", "COMPARE", "WORKFORCE_UPDATE", "SOCIAL_UPDATE", "CERT_MANAGE", "CONTACT_MANAGE"], scope: "ALL_PLANTS" },
    // The Unit-level sign-off on a profile edit is the Plant Head's, and it is
    // OWN_PLANT: a Plant Head approves changes to their own factory, not the estate.
    { module: "FACILITY",    actions: ["PROFILE_APPROVE_UNIT"], scope: "OWN_PLANT" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // Corporate HSE — cross-plant governance. Per matrix: never EXECUTES
  // (no field role); never DELETES on Incident/PTW/FLRA/Training/
  // Inspection/Manhours. Has DELETE on Observation + Near Miss only.
  // ════════════════════════════════════════════════════════════════════
  CORPORATE_HSE: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    // Group-wide fire authority, including document control over the controlled
    // checklist library — a revised client sheet applies to every site.
    { module: "FIRE",        actions: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT", "TEMPLATE_AUTHOR", "TEMPLATE_APPROVE", "CALENDAR"], scope: "ALL_PLANTS" },
    // Field-report visibility + Daily Alert Brief (multi-site rollup)
    { module: "CAPTURE", actions: ["READ", "TRIAGE"], scope: "ALL_PLANTS" },
    { module: "ALERT", actions: ["READ", "ACK", "MUTE"], scope: "ALL_PLANTS" },
    { module: "MOC", actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "DELETE", "EXPORT"], scope: "ALL_PLANTS" }, // MOC — all plants, critical authority
    { module: "SKILL_MATRIX", actions: ["READ", "APPROVE_OVERRIDE", "RECERT_CYCLE", "EXPORT", "COMPETENCY_CONFIGURE", "ROLE_DEF_CONFIGURE", "ASSESS", "SUSPEND", "CROSS_PERSON_VIEW", "VERSION_VIEW"], scope: "ALL_PLANTS" }, // Skill Matrix §8.1 (full, all plants)
    // Observation: ALL except EX
    { module: "OBSERVATION", actions: ["CREATE", "READ", "UPDATE", "APPROVE", "VERIFY", "CLOSE", "DELETE", "EXPORT"], scope: "ALL_PLANTS" },
    // Near Miss: ALL except EX
    { module: "NEAR_MISS",   actions: ["CREATE", "READ", "UPDATE", "APPROVE", "VERIFY", "CLOSE", "DELETE", "EXPORT"], scope: "ALL_PLANTS" },
    // Incident: ALL except EX, DL
    { module: "INCIDENT",    actions: ["CREATE", "READ", "UPDATE", "APPROVE", "VERIFY", "CLOSE", "EXPORT"], scope: "ALL_PLANTS" },
    // PTW: ALL governance (no EX, no DL, no VR)
    { module: "PTW",         actions: ["CREATE", "READ", "UPDATE", "APPROVE", "CLOSE", "EXPORT"], scope: "ALL_PLANTS" },
    // FLRA: ALL except AP, EX, DL
    { module: "FLRA",        actions: ["CREATE", "READ", "UPDATE", "VERIFY", "CLOSE", "EXPORT"], scope: "ALL_PLANTS" },
    // Training: ALL except EX, DL
    { module: "TRAINING",    actions: ["CREATE", "READ", "UPDATE", "APPROVE", "VERIFY", "CLOSE", "EXPORT"], scope: "ALL_PLANTS" },
    // Inspection: ALL except EX, DL
    { module: "INSPECTION",  actions: ["CREATE", "READ", "UPDATE", "APPROVE", "VERIFY", "CLOSE", "EXPORT", "SCHEDULE", "REASSIGN"], scope: "ALL_PLANTS" },
    { module: "INSPECTION_TYPE",    actions: ["CREATE", "READ", "UPDATE", "DELETE"],            scope: "ALL_PLANTS" },
    { module: "CHECKLIST_TEMPLATE", actions: ["CREATE", "READ", "UPDATE", "APPROVE", "DELETE"], scope: "ALL_PLANTS" },
    { module: "EQUIPMENT_MASTER",   actions: ["READ"],                                          scope: "ALL_PLANTS" },
    { module: "INSPECTION_FINDING", actions: ["READ", "UPDATE", "CLOSE", "VERIFY", "DEFER"],    scope: "ALL_PLANTS" },
    // Manhours: R/U/AP/VR/CL/EXP=ALL (no C, no EX, no DL)
    { module: "MANHOURS",    actions: ["READ", "UPDATE", "APPROVE", "VERIFY", "CLOSE", "EXPORT"], scope: "ALL_PLANTS" },
    { module: "AUDIT_COMPLIANCE", actions: ["READ", "EXPORT"],            scope: "ALL_PLANTS" },
    // Configuration: read across all sub-modules (Masters, Workflows)
    { module: "CONFIGURATION", actions: ["MASTERS", "WORKFLOWS"],            scope: "ALL_PLANTS" },
    { module: "AUDIT",       actions: ["VIEW"],                              scope: "ALL_PLANTS" },
    // Agent platform: Corporate HSE owns the agent configuration cross-plant
    // — authority promotion, prompt versioning, all-plants audit. They also
    // invoke (e.g. when reviewing a record at a sister plant).
    { module: "AGENT",       actions: ["RCA_INVOKE", "PERMIT_REVIEW_INVOKE", "TRIAGE_INVOKE", "HIRA_INVOKE", "CAPA_INVOKE", "RCA_CONFIGURE", "AUDIT_VIEW", "PROMPT_EDIT"], scope: "ALL_PLANTS" },
    // HIRA — cross-plant governance: full CRUD, approve high-risk studies,
    // configure matrices and hazard library across all plants, view all
    // versions.
    { module: "HIRA",        actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "DELETE", "EXPORT"], scope: "ALL_PLANTS" },
    { module: "HIRA",        actions: ["MATRIX_CONFIGURE", "LIBRARY_MANAGE", "THRESHOLDS_CONFIGURE", "REVIEW_TRIGGER", "VERSION_VIEW", "OVERRIDE_UNACCEPTABLE"], scope: "ALL_PLANTS" },
    // CAPA — cross-plant governance. Owns master configuration cross-plant.
    { module: "CAPA",        actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "DELETE", "EXPORT"], scope: "ALL_PLANTS" },
    { module: "CAPA",        actions: ["CROSS_SOURCE_VIEW", "PATTERN_LINK", "MASTERS_CONFIGURE", "RECURRENCE_CHECK", "REASSIGN"], scope: "ALL_PLANTS" },
    // EAI — cross-plant governance over the environmental register.
    { module: "EAI",         actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "DELETE", "EXPORT"], scope: "ALL_PLANTS" },
    { module: "EAI",         actions: ["MATRIX_CONFIGURE", "LIBRARY_MANAGE", "SIGNIFICANCE_CONFIGURE", "REVIEW_TRIGGER", "VERSION_VIEW", "COMPLIANCE_REPORT", "FEATURE_FLAG_TOGGLE"], scope: "ALL_PLANTS" },
    { module: "RISK",        actions: ["COMBINED_VIEW", "DASHBOARD_VIEW", "DASHBOARD_EXPORT"], scope: "ALL_PLANTS" },
    // ── CAMS — cross-plant audit programme governance ──
    { module: "CAMS",        actions: ["READ", "TYPE_CONFIG", "TEMPLATE_AUTHOR", "TEMPLATE_APPROVE", "SCHEDULE", "EXECUTE", "CLOSE", "FINDING_MANAGE", "ANALYTICS"], scope: "ALL_PLANTS" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // Trainer — delivers training sessions; no module authority outside
  // training delivery + own observations/near-misses.
  // ════════════════════════════════════════════════════════════════════
  TRAINER: [
    { module: "SKILL_MATRIX", actions: ["READ", "ASSESS"], scope: "OWN_RECORDS" }, // Skill Matrix §8.1 (assess own trainees)
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "OBSERVATION", actions: ["READ", "UPDATE", "EXECUTE"],         scope: "OWN_RECORDS" },
    // Training: R/EX/EXP=PLANT (deliver training sessions)
    { module: "TRAINING",    actions: ["READ", "EXECUTE", "EXPORT"],         scope: "OWN_PLANT" },
    { module: "AGENT",       actions: ["RCA_INVOKE"],                       scope: "OWN_PLANT" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // L&D Manager — owns training programs cross-plant; can delete own
  // drafts only.
  // ════════════════════════════════════════════════════════════════════
  LD_MANAGER: [
    { module: "SKILL_MATRIX", actions: ["READ", "RECERT_CYCLE", "EXPORT", "COMPETENCY_CONFIGURE", "ROLE_DEF_CONFIGURE", "ASSESS", "CROSS_PERSON_VIEW", "VERSION_VIEW"], scope: "ALL_PLANTS" }, // Skill Matrix §8.1 (non-safety config in service layer)
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "OBSERVATION", actions: ["READ", "UPDATE", "EXECUTE"],         scope: "OWN_RECORDS" },
    // Training: C/R/U/AP/EX/VR/EXP=ALL, DL=OWN-draft
    { module: "TRAINING",    actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "EXPORT"], scope: "ALL_PLANTS" },
    { module: "TRAINING",    actions: ["DELETE"],                            scope: "OWN_RECORDS" },
    // Incident: a training-system CAPA raised out of an incident investigation
    // is owned by this role, and the CAPA-execution step fans a task out to
    // the owner. Without an INCIDENT grant the permission service answers
    // "Missing permission" before the workflow-assignee fallback can run, so
    // the owner cannot open the record their task points at. Read plant-wide;
    // write only on records they own.
    { module: "INCIDENT",    actions: ["READ", "EXPORT"],                    scope: "OWN_PLANT" },
    { module: "INCIDENT",    actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // L&D Manager owns training masters configuration (training programs).
    // Sub-domain restriction ("Training only") not encoded in scope; UI
    // surfaces only the relevant masters tabs.
    { module: "CONFIGURATION", actions: ["MASTERS"],                         scope: "ALL_PLANTS" },
    { module: "AGENT",       actions: ["RCA_INVOKE"],                       scope: "ALL_PLANTS" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // Maintenance Head — owns equipment master + inspection assignments.
  // Per matrix: only R/VR/EXP=PLANT on Inspection (NOT C/U/AP/EX/CL).
  // Inspections are system-generated from equipment master schedules;
  // HSE Manager creates ad-hoc inspections.
  // ════════════════════════════════════════════════════════════════════
  MAINTENANCE_HEAD: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    // Already owns EQUIPMENT_MASTER, and fire assets are equipment: this role
    // registers the panels, hydrants and cylinders and does the maintenance
    // rounds on them. EXECUTE, not APPROVE — the maintainer does not sign off
    // their own maintenance.
    { module: "FIRE",        actions: ["CREATE", "READ", "UPDATE", "DELETE", "EXECUTE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "MOC", actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "EXPORT"], scope: "OWN_PLANT" }, // MOC — equipment/maintenance changes
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "OBSERVATION", actions: ["READ", "EXPORT"],                    scope: "OWN_DEPARTMENT" },
    { module: "OBSERVATION", actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // Near Miss mirrors Observation for this role. Without it a Maintenance
    // Head can be named the owner of a near-miss CAPA — the owner picker
    // lists them — and then hold a task they structurally cannot open or
    // complete, because workflow_engine._rbac_triple_check requires the
    // NEAR_MISS.EXECUTE code and the nav/detail read requires NEAR_MISS.READ.
    { module: "NEAR_MISS",   actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "NEAR_MISS",   actions: ["READ", "EXPORT"],                    scope: "OWN_DEPARTMENT" },
    { module: "NEAR_MISS",   actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // Incident mirrors Near Miss for the same reason, and the reason bites
    // harder here: the incident CAPA-execution step fans out one task per
    // CAPA owner, and machine-guarding CAPAs land on this role by default.
    // With no INCIDENT grant at all the permission service short-circuits on
    // "Missing permission" before it ever reaches the workflow-assignee
    // fallback, so the owner could not open the incident, let alone complete
    // the task the engine had just assigned them. READ is plant-wide (they
    // own equipment across the plant, not one department); the write actions
    // stay on records they own.
    { module: "INCIDENT",    actions: ["READ", "EXPORT"],                    scope: "OWN_PLANT" },
    { module: "INCIDENT",    actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    // PTW: C/R/AP/EXP=DEPT, U=OWN (Maintenance Head originates work permits
    // on equipment they own).
    { module: "PTW",         actions: ["CREATE", "READ", "APPROVE", "EXPORT"], scope: "OWN_DEPARTMENT" },
    { module: "PTW",         actions: ["UPDATE"],                            scope: "OWN_RECORDS" },
    // Inspection: R/VR/EXP=PLANT only (system-generated; HSE creates ad-hoc)
    { module: "INSPECTION",  actions: ["READ", "VERIFY", "EXPORT", "REASSIGN"], scope: "OWN_PLANT" },
    // Inspection masters — Maintenance Head owns equipment + reads other masters
    { module: "INSPECTION_TYPE",    actions: ["READ"],                       scope: "ALL_PLANTS" },
    { module: "CHECKLIST_TEMPLATE", actions: ["READ"],                       scope: "ALL_PLANTS" },
    { module: "EQUIPMENT_MASTER",   actions: ["CREATE", "READ", "UPDATE", "DELETE"], scope: "OWN_PLANT" },
    { module: "INSPECTION_FINDING", actions: ["READ", "UPDATE", "CLOSE"],    scope: "OWN_PLANT" },
    // Maintenance Head owns equipment master configuration.
    { module: "CONFIGURATION", actions: ["MASTERS"],                         scope: "ALL_PLANTS" },
    // HIRA read-only — they originate and approve permits (above), and the PTW
    // form/detail pages render the HIRA relevant-entries panel, which is gated
    // on HIRA.READ. Department scope matches their PTW scope.
    { module: "HIRA",        actions: ["READ"],                              scope: "OWN_DEPARTMENT" },
    { module: "AGENT",       actions: ["RCA_INVOKE", "PERMIT_REVIEW_INVOKE", "TRIAGE_INVOKE", "HIRA_INVOKE", "CAPA_INVOKE"], scope: "OWN_PLANT" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // Environment Manager — owns Environmental Compliance module.
  // Maps to OBSERVATION + INCIDENT read here; Environmental Compliance
  // module not yet in OPERATIONAL_MODULES.
  // ════════════════════════════════════════════════════════════════════
  ENVIRONMENT_MANAGER: [
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "OBSERVATION", actions: ["READ", "EXPORT"],                    scope: "OWN_PLANT" },
    { module: "OBSERVATION", actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    { module: "INCIDENT",    actions: ["READ"],                              scope: "OWN_PLANT" },
    // CAPA — Environmental Manager owns environmental-source CAPAs at their
    // plant. Default scope is OWN_PLANT; without CROSS_SOURCE_VIEW grant
    // they only see env sources due to the source-scope filter in the
    // record-context resolver.
    { module: "CAPA",        actions: ["CREATE", "READ", "UPDATE", "APPROVE", "VERIFY", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    // EAI — Environment Manager is the primary owner of the environmental
    // register. Full CRUD + approve + execute (review cycles) + close + export
    // at own plant. Library and significance configuration plant-scoped.
    { module: "EAI",         actions: ["CREATE", "READ", "UPDATE", "EXECUTE", "APPROVE", "VERIFY", "CLOSE", "DELETE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "EAI",         actions: ["LIBRARY_MANAGE", "SIGNIFICANCE_CONFIGURE", "REVIEW_TRIGGER", "VERSION_VIEW", "COMPLIANCE_REPORT"], scope: "OWN_PLANT" },
    { module: "RISK",        actions: ["COMBINED_VIEW", "DASHBOARD_VIEW", "DASHBOARD_EXPORT"], scope: "OWN_PLANT" },
    { module: "AGENT",       actions: ["RCA_INVOKE", "HIRA_INVOKE", "CAPA_INVOKE"],                       scope: "OWN_PLANT" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // Contractor Coordinator — owns contractor company master + onboarding.
  // ════════════════════════════════════════════════════════════════════
  CONTRACTOR_COORDINATOR: [
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "OBSERVATION", actions: ["READ", "EXPORT"],                    scope: "OWN_PLANT" },
    { module: "OBSERVATION", actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    { module: "NEAR_MISS",   actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "NEAR_MISS",   actions: ["READ", "EXPORT"],                    scope: "OWN_PLANT" },
    { module: "NEAR_MISS",   actions: ["UPDATE", "EXECUTE"],                 scope: "OWN_RECORDS" },
    { module: "PTW",         actions: ["READ"],                              scope: "OWN_PLANT" },
    { module: "TRAINING",    actions: ["READ"],                              scope: "OWN_PLANT" },
    // HIRA — read entries relevant to contractor work; suggest changes via
    // OWN_RECORDS UPDATE if named on the study team.
    { module: "HIRA",        actions: ["READ"],                              scope: "OWN_PLANT" },
    { module: "HIRA",        actions: ["UPDATE"],                            scope: "OWN_RECORDS" },
    { module: "AGENT",       actions: ["RCA_INVOKE"],                       scope: "OWN_PLANT" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // Specialist roles — read-only access to incidents/inspections.
  // ════════════════════════════════════════════════════════════════════
  OCCUPATIONAL_HEALTH_OFFICER: [
    { module: "INCIDENT",    actions: ["READ"],                              scope: "OWN_PLANT" },
    { module: "TRAINING",    actions: ["READ"],                              scope: "OWN_PLANT" },
    { module: "AGENT",       actions: ["RCA_INVOKE"],                       scope: "OWN_PLANT" }
  ],
  EMERGENCY_RESPONSE_COORDINATOR: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    // Fire is this role's core subject matter. Prepares and reviews; final
    // approval stays with the HOD tier.
    { module: "FIRE",        actions: ["CREATE", "READ", "UPDATE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "INCIDENT",    actions: ["READ"],                              scope: "OWN_PLANT" },
    { module: "AGENT",       actions: ["RCA_INVOKE"],                       scope: "OWN_PLANT" }
  ],
  INDUSTRIAL_HYGIENIST: [
    { module: "INSPECTION",  actions: ["READ"],                              scope: "OWN_PLANT" },
    { module: "INCIDENT",    actions: ["READ"],                              scope: "OWN_PLANT" },
    { module: "AGENT",       actions: ["RCA_INVOKE"],                       scope: "OWN_PLANT" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // ADMIN — everything everywhere. Merged with the former SYSTEM_ADMIN below.
  // ════════════════════════════════════════════════════════════════════
  ADMIN: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    { module: "FIRE",        actions: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT", "TEMPLATE_AUTHOR", "TEMPLATE_APPROVE", "CALENDAR"], scope: "ALL_PLANTS" },
    ...OPERATIONAL_MODULES.map((m) => ({ module: m, actions: [...OPERATIONAL_ACTIONS], scope: "ALL_PLANTS" as Scope })),
    // Guided Field Capture + Daily Alert Brief (UNMASK is admin-only per spec)
    { module: "CAPTURE", actions: ["CREATE", "READ", "TRIAGE", "UNMASK"], scope: "ALL_PLANTS" },
    { module: "ALERT", actions: ["READ", "ACK", "MUTE"], scope: "ALL_PLANTS" },
    // AUDIT_COMPLIANCE.SCHEDULE is an EXTRA permission, so the
    // OPERATIONAL_ACTIONS spread above does not cover it — grant it explicitly.
    { module: "AUDIT_COMPLIANCE", actions: ["SCHEDULE", "ALLOCATE"], scope: "ALL_PLANTS" },
    // Skill Matrix non-CRUD (CRUD comes from the spread above)
    { module: "SKILL_MATRIX", actions: ["COMPETENCY_CONFIGURE", "ROLE_DEF_CONFIGURE", "ASSESS", "SUSPEND", "APPROVE_OVERRIDE", "RECERT_CYCLE", "CROSS_PERSON_VIEW", "VERSION_VIEW"], scope: "ALL_PLANTS" },
    { module: "INSPECTION",         actions: ["SCHEDULE", "REASSIGN"],                          scope: "ALL_PLANTS" },
    { module: "INSPECTION_TYPE",    actions: ["CREATE", "READ", "UPDATE", "DELETE"],            scope: "ALL_PLANTS" },
    { module: "CHECKLIST_TEMPLATE", actions: ["CREATE", "READ", "UPDATE", "APPROVE", "DELETE"], scope: "ALL_PLANTS" },
    { module: "EQUIPMENT_MASTER",   actions: ["CREATE", "READ", "UPDATE", "DELETE"],            scope: "ALL_PLANTS" },
    { module: "INSPECTION_FINDING", actions: ["READ", "UPDATE", "CLOSE", "VERIFY", "DEFER"],    scope: "ALL_PLANTS" },
    { module: "CONFIGURATION", actions: ["MASTERS", "WORKFLOWS", "USERS", "PERMISSIONS", "ROLES"], scope: "ALL_PLANTS" },
    { module: "LICENSING",   actions: ["MANAGE"], scope: "ALL_PLANTS" },
    { module: "AUDIT",       actions: ["VIEW"], scope: "ALL_PLANTS" },
    { module: "AGENT",       actions: ["RCA_INVOKE", "PERMIT_REVIEW_INVOKE", "TRIAGE_INVOKE", "HIRA_INVOKE", "CAPA_INVOKE", "RCA_CONFIGURE", "AUDIT_VIEW", "PROMPT_EDIT"], scope: "ALL_PLANTS" },
    { module: "HIRA",        actions: ["MATRIX_CONFIGURE", "LIBRARY_MANAGE", "THRESHOLDS_CONFIGURE", "REVIEW_TRIGGER", "VERSION_VIEW", "OVERRIDE_UNACCEPTABLE"], scope: "ALL_PLANTS" },
    { module: "CAPA",        actions: ["CROSS_SOURCE_VIEW", "PATTERN_LINK", "MASTERS_CONFIGURE", "RECURRENCE_CHECK", "REASSIGN"], scope: "ALL_PLANTS" },
    { module: "ERM",         actions: ["ASSESS", "TREAT", "ACCEPT", "REVIEW", "LINK", "BOARD_PACK", "TAXONOMY_ADMIN", "MATRIX_ADMIN", "ROLLUP_ADMIN"], scope: "ALL_PLANTS" },
    // RCA non-CRUD (CRUD/APPROVE come from the OPERATIONAL_MODULES spread above)
    { module: "RCA",         actions: ["TAG", "TAXONOMY_ADMIN"], scope: "ALL_PLANTS" },
    { module: "KRI",         actions: ["READ", "ADMIN", "ENTER", "ACK"], scope: "ALL_PLANTS" },
    { module: "APPETITE",    actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "COMPLIANCE",  actions: ["READ", "MANAGE"], scope: "ALL_PLANTS" },
    { module: "LOSS",        actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "BCM",         actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "CRISIS",      actions: ["ADMIN"], scope: "ALL_PLANTS" },
    // CAMS — full audit/inspection authority cross-site.
    { module: "CAMS",        actions: ["READ", "TYPE_CONFIG", "TEMPLATE_AUTHOR", "TEMPLATE_APPROVE", "SCHEDULE", "EXECUTE", "CLOSE", "FINDING_MANAGE", "ANALYTICS"], scope: "ALL_PLANTS" },
    // Facilities — full factory-profile authority cross-site.
    { module: "FACILITY",    actions: ["READ", "CREATE", "UPDATE", "DELETE", "EXPORT", "WORKFORCE_UPDATE", "SOCIAL_UPDATE", "CERT_MANAGE", "CONTACT_MANAGE", "COMPARE", "SITE_LINK", "PROFILE_APPROVE_UNIT", "PROFILE_APPROVE_COMPLIANCE"], scope: "ALL_PLANTS" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // CAPA generalization — 6 new roles. Each is source-scoped by default
  // (CROSS_SOURCE_VIEW must be granted explicitly to widen).
  // ════════════════════════════════════════════════════════════════════
  QUALITY_MANAGER: [
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "OBSERVATION", actions: ["READ", "EXPORT"],                    scope: "OWN_PLANT" },
    // CAPA — owns quality source category (audits, customer complaints,
    // NCR, calibration, supplier). Source filter is enforced at the
    // record-context layer based on sourceCategory.code = 'QUALITY'.
    { module: "CAPA",        actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "CAPA",        actions: ["PATTERN_LINK", "RECURRENCE_CHECK", "REASSIGN"], scope: "OWN_PLANT" },
    // Audit & Compliance — Quality Manager owns the audit programme.
    { module: "AUDIT_COMPLIANCE", actions: ["CREATE", "READ", "UPDATE", "EXECUTE", "APPROVE", "VERIFY", "CLOSE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "AUDIT_COMPLIANCE", actions: ["ALLOCATE"], scope: "OWN_PLANT" },
    // CAMS — owns the audit programme on the centralised engine too.
    { module: "CAMS",        actions: ["READ", "TEMPLATE_AUTHOR", "SCHEDULE", "EXECUTE", "CLOSE", "FINDING_MANAGE", "ANALYTICS"], scope: "OWN_PLANT" },
    { module: "AGENT",       actions: ["RCA_INVOKE"],                       scope: "OWN_PLANT" }
  ],
  QUALITY_ASSURANCE_LEAD: [
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    // CAPA — verification-only authority on quality CAPAs. Cannot create,
    // cannot close. UPDATE is limited to verification fields only at the
    // service layer.
    { module: "CAPA",        actions: ["READ", "VERIFY", "EXPORT"],          scope: "OWN_PLANT" }
  ],
  CUSTOMER_SERVICE_LEAD: [
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    // CAPA — owns the customer complaint intake + initial response.
    // sourceTypeCode = 'CUSTOMER_COMPLAINT' enforced at record-context.
    { module: "CAPA",        actions: ["CREATE", "READ", "UPDATE", "EXECUTE", "EXPORT"], scope: "OWN_PLANT" }
  ],
  INTERNAL_AUDIT_LEAD: [
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    // CAPA — raises audit-driven CAPAs across functions; needs
    // cross-source view to track CAPAs they raised. Read-only on others.
    { module: "CAPA",        actions: ["CREATE", "READ", "UPDATE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "CAPA",        actions: ["CROSS_SOURCE_VIEW"],                 scope: "OWN_PLANT" },
    // Audit & Compliance — Internal Audit Lead conducts audits end-to-end.
    { module: "AUDIT_COMPLIANCE", actions: ["CREATE", "READ", "UPDATE", "EXECUTE", "VERIFY", "EXPORT"], scope: "OWN_PLANT" },
    { module: "AUDIT_COMPLIANCE", actions: ["ALLOCATE"], scope: "OWN_PLANT" },
    // CAMS — conducts audits end-to-end on the centralised engine.
    { module: "CAMS",        actions: ["READ", "TEMPLATE_AUTHOR", "SCHEDULE", "EXECUTE", "CLOSE", "FINDING_MANAGE", "ANALYTICS"], scope: "OWN_PLANT" }
  ],
  EXTERNAL_AUDIT_COORDINATOR: [
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "CAPA",        actions: ["CREATE", "READ", "UPDATE", "EXPORT"], scope: "OWN_PLANT" },
    { module: "CAPA",        actions: ["CROSS_SOURCE_VIEW"],                 scope: "OWN_PLANT" }
  ],
  CALIBRATION_MANAGER: [
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    // CAPA — owns calibration-failure CAPAs. Can close low/moderate.
    { module: "CAPA",        actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "CLOSE", "EXPORT"], scope: "OWN_PLANT" }
  ],
  // Former standalone role; merged into ADMIN below and then deleted.
  SYSTEM_ADMIN: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    { module: "FIRE",        actions: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT", "TEMPLATE_AUTHOR", "TEMPLATE_APPROVE", "CALENDAR"], scope: "ALL_PLANTS" },
    ...OPERATIONAL_MODULES.map((m) => ({ module: m, actions: [...OPERATIONAL_ACTIONS], scope: "ALL_PLANTS" as Scope })),
    // Guided Field Capture + Daily Alert Brief (UNMASK is admin-only per spec)
    { module: "CAPTURE", actions: ["CREATE", "READ", "TRIAGE", "UNMASK"], scope: "ALL_PLANTS" },
    { module: "ALERT", actions: ["READ", "ACK", "MUTE"], scope: "ALL_PLANTS" },
    // AUDIT_COMPLIANCE.SCHEDULE is an EXTRA permission, so the
    // OPERATIONAL_ACTIONS spread above does not cover it — grant it explicitly.
    { module: "AUDIT_COMPLIANCE", actions: ["SCHEDULE", "ALLOCATE"], scope: "ALL_PLANTS" },
    { module: "INSPECTION",         actions: ["SCHEDULE", "REASSIGN"],                          scope: "ALL_PLANTS" },
    { module: "INSPECTION_TYPE",    actions: ["CREATE", "READ", "UPDATE", "DELETE"],            scope: "ALL_PLANTS" },
    { module: "CHECKLIST_TEMPLATE", actions: ["CREATE", "READ", "UPDATE", "APPROVE", "DELETE"], scope: "ALL_PLANTS" },
    { module: "EQUIPMENT_MASTER",   actions: ["CREATE", "READ", "UPDATE", "DELETE"],            scope: "ALL_PLANTS" },
    { module: "INSPECTION_FINDING", actions: ["READ", "UPDATE", "CLOSE", "VERIFY", "DEFER"],    scope: "ALL_PLANTS" },
    { module: "CONFIGURATION", actions: ["MASTERS", "WORKFLOWS", "USERS", "PERMISSIONS", "ROLES"], scope: "ALL_PLANTS" },
    { module: "LICENSING",   actions: ["MANAGE"], scope: "ALL_PLANTS" },
    { module: "AUDIT",       actions: ["VIEW"], scope: "ALL_PLANTS" },
    { module: "AGENT",       actions: ["RCA_INVOKE", "PERMIT_REVIEW_INVOKE", "TRIAGE_INVOKE", "HIRA_INVOKE", "CAPA_INVOKE", "RCA_CONFIGURE", "AUDIT_VIEW", "PROMPT_EDIT"], scope: "ALL_PLANTS" },
    // EAI + Risk admin (HIRA Phase 2)
    { module: "EAI",         actions: ["MATRIX_CONFIGURE", "LIBRARY_MANAGE", "SIGNIFICANCE_CONFIGURE", "REVIEW_TRIGGER", "VERSION_VIEW", "COMPLIANCE_REPORT", "FEATURE_FLAG_TOGGLE"], scope: "ALL_PLANTS" },
    { module: "RISK",        actions: ["COMBINED_VIEW", "DASHBOARD_VIEW", "DASHBOARD_EXPORT"], scope: "ALL_PLANTS" },
    // ERM admin — taxonomy / matrix / rollup configuration (CRUD comes from the spread above)
    { module: "ERM",         actions: ["ASSESS", "TREAT", "ACCEPT", "REVIEW", "LINK", "BOARD_PACK", "TAXONOMY_ADMIN", "MATRIX_ADMIN", "ROLLUP_ADMIN"], scope: "ALL_PLANTS" },
    // RCA non-CRUD (CRUD/APPROVE come from the OPERATIONAL_MODULES spread above)
    { module: "RCA",         actions: ["TAG", "TAXONOMY_ADMIN"], scope: "ALL_PLANTS" },
    // Phase 2/3 admin — KRI admin + reads, BCM dashboards + crisis team admin
    { module: "KRI",         actions: ["READ", "ADMIN", "ENTER", "ACK"], scope: "ALL_PLANTS" },
    { module: "APPETITE",    actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "COMPLIANCE",  actions: ["READ", "MANAGE"], scope: "ALL_PLANTS" },
    { module: "LOSS",        actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "BCM",         actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "CRISIS",      actions: ["ADMIN"], scope: "ALL_PLANTS" },
    // Tier 3 — read + scoring/control config admin
    { module: "CONTROL",     actions: ["READ", "CONFIG"], scope: "ALL_PLANTS" },
    { module: "VENDOR",      actions: ["READ", "CONFIG"], scope: "ALL_PLANTS" },
    { module: "INSURANCE",   actions: ["READ"], scope: "ALL_PLANTS" },
    // Skill Matrix governance (config only; no ASSESS/SUSPEND — admin governs, doesn't operate)
    { module: "SKILL_MATRIX", actions: ["COMPETENCY_CONFIGURE", "ROLE_DEF_CONFIGURE", "ASSESS", "SUSPEND", "APPROVE_OVERRIDE", "RECERT_CYCLE", "CROSS_PERSON_VIEW", "VERSION_VIEW"], scope: "ALL_PLANTS" },
    { module: "CAMS",        actions: ["READ", "TYPE_CONFIG", "TEMPLATE_AUTHOR", "TEMPLATE_APPROVE", "SCHEDULE", "EXECUTE", "CLOSE", "FINDING_MANAGE", "ANALYTICS"], scope: "ALL_PLANTS" },
    { module: "FACILITY",    actions: ["READ", "CREATE", "UPDATE", "DELETE", "EXPORT", "WORKFORCE_UPDATE", "SOCIAL_UPDATE", "CERT_MANAGE", "CONTACT_MANAGE", "COMPARE", "SITE_LINK", "PROFILE_APPROVE_UNIT", "PROFILE_APPROVE_COMPLIANCE"], scope: "ALL_PLANTS" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // Skill Matrix — 2 new roles (Phase 1 IMS). Grants per spec §8.1.
  // ════════════════════════════════════════════════════════════════════
  HR_HEAD: [
    { module: "OBSERVATION", actions: ["CREATE"],                            scope: "ALL_PLANTS" },
    { module: "TRAINING",    actions: ["READ", "EXPORT"],                    scope: "ALL_PLANTS" },
    // Competency management is HR territory: configure masters + role defs,
    // suspend for HR reasons, cross-person view. No ASSESS (that's L&D/HSE).
    { module: "SKILL_MATRIX", actions: ["READ", "EXPORT", "COMPETENCY_CONFIGURE", "ROLE_DEF_CONFIGURE", "SUSPEND", "CROSS_PERSON_VIEW", "VERSION_VIEW"], scope: "ALL_PLANTS" },
    { module: "AGENT",       actions: ["RCA_INVOKE"],                        scope: "ALL_PLANTS" }
  ],
  EXTERNAL_ASSESSOR: [
    // Scoped to the assessments they are explicitly assigned (OWN_RECORDS via
    // assessorUserId). No master / role-definition / suspend authority.
    { module: "SKILL_MATRIX", actions: ["READ", "ASSESS"], scope: "OWN_RECORDS" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // Enterprise Risk Management (ERM) — 5 new roles. Verbatim mirror of the
  // §4 RBAC matrix. CRO is all-plants and the sole acceptance/closure approver;
  // Champion is all-plants facilitation (no accept/close/admin); Risk Owner is
  // own-records + own-plant; Executive Viewer is read-only all-plants; Plant
  // HSE Head is own-plant READ (router further restricts to OPS rollup risks).
  // ════════════════════════════════════════════════════════════════════
  CRO: [
    { module: "ERM",  actions: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "CLOSE", "EXPORT", "ASSESS", "TREAT", "ACCEPT", "REVIEW", "LINK", "BOARD_PACK", "TAXONOMY_ADMIN", "MATRIX_ADMIN", "ROLLUP_ADMIN"], scope: "ALL_PLANTS" },
    // Cross-Domain RCA — full authority incl. approval + taxonomy admin (committee/CRO governs the cause taxonomy + cross-domain analytics).
    { module: "RCA",  actions: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "EXPORT", "TAG", "TAXONOMY_ADMIN"], scope: "ALL_PLANTS" },
    // Phase 2 — full KRI/appetite governance; manages+attests compliance (not verify/waive); full loss lifecycle
    { module: "KRI",        actions: ["READ", "ADMIN", "ENTER", "ACK"], scope: "ALL_PLANTS" },
    { module: "APPETITE",   actions: ["READ", "AUTHOR", "APPROVE", "DECIDE"], scope: "ALL_PLANTS" },
    { module: "COMPLIANCE", actions: ["READ", "MANAGE", "ATTEST"], scope: "ALL_PLANTS" },
    { module: "LOSS",       actions: ["READ", "CREATE", "CLOSE"], scope: "ALL_PLANTS" },
    // Phase 3 — full BCM authority
    { module: "BCM",      actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "BIA",      actions: ["WRITE", "APPROVE"], scope: "ALL_PLANTS" },
    { module: "PLAN",     actions: ["WRITE", "APPROVE"], scope: "ALL_PLANTS" },
    { module: "CRISIS",   actions: ["ADMIN", "ACTIVATE", "MANAGE"], scope: "ALL_PLANTS" },
    { module: "EXERCISE", actions: ["WRITE", "COMPLETE"], scope: "ALL_PLANTS" },
    { module: "SCENARIO", actions: ["WRITE"], scope: "ALL_PLANTS" },
    { module: "HORIZON",  actions: ["WRITE"], scope: "ALL_PLANTS" },
    { module: "RISK", actions: ["COMBINED_VIEW", "DASHBOARD_VIEW", "DASHBOARD_EXPORT"], scope: "ALL_PLANTS" },
    // CAPA — treatments run on the universal CAPA engine.
    { module: "CAPA", actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT", "CROSS_SOURCE_VIEW"], scope: "ALL_PLANTS" },
    // Tier 3 — full controls / vendor / insurance authority incl. CRO-only gates (REPORT_MW, vendor APPROVE) + config
    { module: "CONTROL",   actions: ["READ", "WRITE", "TEST", "DEFICIENCY", "REPORT_MW", "CONFIG"], scope: "ALL_PLANTS" },
    { module: "VENDOR",    actions: ["READ", "WRITE", "ESG", "APPROVE", "CONFIG"], scope: "ALL_PLANTS" },
    { module: "INSURANCE", actions: ["READ", "WRITE", "CLAIM", "GAP"], scope: "ALL_PLANTS" },
    // Read HIRA/EAI to drill into contributing operational entries.
    { module: "HIRA", actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "EAI",  actions: ["READ"], scope: "ALL_PLANTS" },
    // CAMS — board oversight: audit programme + analytics read.
    { module: "CAMS", actions: ["READ", "ANALYTICS"], scope: "ALL_PLANTS" }
  ],
  RISK_CHAMPION: [
    { module: "ERM",  actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXPORT", "ASSESS", "TREAT", "REVIEW", "LINK", "BOARD_PACK"], scope: "ALL_PLANTS" },
    // Cross-Domain RCA — analyst/facilitator: opens RCAs, tags causes, links risks, views analytics (no approve / no taxonomy admin).
    { module: "RCA",  actions: ["CREATE", "READ", "UPDATE", "EXPORT", "TAG"], scope: "ALL_PLANTS" },
    // Phase 2 — KRI admin + entry + ack; drafts appetite; reads compliance; full loss create/close
    { module: "KRI",        actions: ["READ", "ADMIN", "ENTER", "ACK"], scope: "ALL_PLANTS" },
    { module: "APPETITE",   actions: ["READ", "AUTHOR"], scope: "ALL_PLANTS" },
    { module: "COMPLIANCE", actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "LOSS",       actions: ["READ", "CREATE", "CLOSE"], scope: "ALL_PLANTS" },
    // Phase 3 — BCM authoring (no approve / no crisis admin-activate-manage)
    { module: "BCM",      actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "BIA",      actions: ["WRITE"], scope: "ALL_PLANTS" },
    { module: "PLAN",     actions: ["WRITE"], scope: "ALL_PLANTS" },
    { module: "EXERCISE", actions: ["WRITE", "COMPLETE"], scope: "ALL_PLANTS" },
    { module: "SCENARIO", actions: ["WRITE"], scope: "ALL_PLANTS" },
    { module: "HORIZON",  actions: ["WRITE"], scope: "ALL_PLANTS" },
    { module: "RISK", actions: ["COMBINED_VIEW", "DASHBOARD_VIEW", "DASHBOARD_EXPORT"], scope: "ALL_PLANTS" },
    { module: "CAPA", actions: ["CREATE", "READ", "UPDATE", "EXPORT"], scope: "ALL_PLANTS" },
    // Tier 3 — controls library/mapping (no test/deficiency), full vendor dual-lens, claims + coverage gap (no policy admin)
    { module: "CONTROL",   actions: ["READ", "WRITE"], scope: "ALL_PLANTS" },
    { module: "VENDOR",    actions: ["READ", "WRITE", "ESG"], scope: "ALL_PLANTS" },
    { module: "INSURANCE", actions: ["READ", "CLAIM", "GAP"], scope: "ALL_PLANTS" },
    { module: "HIRA", actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "EAI",  actions: ["READ"], scope: "ALL_PLANTS" }
  ],
  RISK_OWNER: [
    // Own risks (router enforces owner/plant scoping); can read own-plant register.
    { module: "ERM",  actions: ["CREATE"], scope: "ALL_PLANTS" },
    { module: "ERM",  actions: ["READ"], scope: "OWN_PLANT" },
    { module: "ERM",  actions: ["UPDATE", "ASSESS", "TREAT", "REVIEW", "LINK"], scope: "OWN_RECORDS" },
    // Cross-Domain RCA — owner opens risk/loss RCAs on their risks, tags + links, approves; reads analytics across the enterprise.
    { module: "RCA",  actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "RCA",  actions: ["CREATE", "UPDATE", "APPROVE", "EXPORT", "TAG"], scope: "ALL_PLANTS" },
    { module: "RISK", actions: ["DASHBOARD_VIEW"], scope: "ALL_PLANTS" },
    { module: "CAPA", actions: ["CREATE", "READ", "UPDATE", "EXECUTE"], scope: "OWN_PLANT" },
    // Phase 2 — KRI read + own readings/ack; reads appetite; attests own compliance; own loss create
    { module: "KRI",        actions: ["READ"], scope: "OWN_PLANT" },
    { module: "KRI",        actions: ["ENTER", "ACK"], scope: "OWN_RECORDS" },
    { module: "APPETITE",   actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "COMPLIANCE", actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "COMPLIANCE", actions: ["ATTEST"], scope: "OWN_RECORDS" },
    { module: "LOSS",       actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "LOSS",       actions: ["CREATE"], scope: "OWN_RECORDS" }
  ],
  EXECUTIVE_VIEWER: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    // Board persona. Read-only, group-wide, consistent with every other module.
    { module: "FIRE",        actions: ["READ"],                                scope: "ALL_PLANTS" },
    // Board persona — read-only dashboards, heat maps, published board packs.
    { module: "ERM",  actions: ["READ", "EXPORT"], scope: "ALL_PLANTS" },
    // Cross-Domain RCA — read-only causal analytics + maps for the board view.
    { module: "RCA",  actions: ["READ", "EXPORT"], scope: "ALL_PLANTS" },
    { module: "RISK", actions: ["COMBINED_VIEW", "DASHBOARD_VIEW"], scope: "ALL_PLANTS" },
    // Phase 2 — read-only across KRI/appetite/compliance/loss
    { module: "KRI",        actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "APPETITE",   actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "COMPLIANCE", actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "LOSS",       actions: ["READ"], scope: "ALL_PLANTS" },
    // Phase 3 — read-only BCM + stressed heat map view
    { module: "BCM",      actions: ["READ"], scope: "ALL_PLANTS" },
    // Tier 3 — read-only controls / vendor / insurance for the board view
    { module: "CONTROL",   actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "VENDOR",    actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "INSURANCE", actions: ["READ"], scope: "ALL_PLANTS" },
    // CAMS — read-only audit programme + analytics for the board view.
    { module: "CAMS",      actions: ["READ", "ANALYTICS"], scope: "ALL_PLANTS" }
  ],
  PLANT_HSE_HEAD: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    { module: "FIRE",        actions: ["READ", "VERIFY", "EXPORT"],            scope: "OWN_PLANT" },
    // Own-site OPS rollup risks only — router restricts the query to
    // sourceType=HSE_ROLLUP + OPS category for this role.
    { module: "ERM",  actions: ["READ"], scope: "OWN_PLANT" },
    { module: "RISK", actions: ["COMBINED_VIEW", "DASHBOARD_VIEW"], scope: "OWN_PLANT" },
    { module: "HIRA", actions: ["READ"], scope: "OWN_PLANT" },
    { module: "EAI",  actions: ["READ"], scope: "OWN_PLANT" },
    // Phase 2 — own-site OPS KRI read + entry; reads compliance + attests own; own-site loss draft
    { module: "KRI",        actions: ["READ", "ENTER"], scope: "OWN_PLANT" },
    { module: "COMPLIANCE", actions: ["READ"], scope: "OWN_PLANT" },
    { module: "COMPLIANCE", actions: ["ATTEST"], scope: "OWN_RECORDS" },
    { module: "LOSS",       actions: ["READ"], scope: "OWN_PLANT" },
    { module: "LOSS",       actions: ["CREATE"], scope: "OWN_RECORDS" },
    // Phase 3 — own-site BCM read + BIA write; sev-1 own-site crisis activate/manage (severity-1 enforced in router)
    { module: "BCM",      actions: ["READ"], scope: "OWN_PLANT" },
    { module: "BIA",      actions: ["WRITE"], scope: "OWN_PLANT" },
    { module: "CRISIS",   actions: ["ACTIVATE", "MANAGE"], scope: "OWN_PLANT" }
  ],
  COMPLIANCE_OFFICER: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    // Reads and exports the statutory record; no authority over its content.
    { module: "FIRE",        actions: ["READ", "EXPORT"],                      scope: "ALL_PLANTS" },
    // Owns the obligations register; EXCLUSIVE verify/waive (SoD). Reads the rest.
    { module: "COMPLIANCE", actions: ["READ", "MANAGE", "ATTEST", "VERIFY", "WAIVE"], scope: "ALL_PLANTS" },
    { module: "KRI",        actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "APPETITE",   actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "LOSS",       actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "ERM",        actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "CAPA",       actions: ["CREATE", "READ"], scope: "ALL_PLANTS" },
    // Cross-Domain RCA — compliance lead opens/tags/approves compliance RCAs;
    // analytics are domain-scoped to COMPLIANCE in the router (RCA-T16).
    { module: "RCA",        actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXPORT", "TAG"], scope: "ALL_PLANTS" },
    // CAMS — compliance-assurance view: reads audit programme + analytics.
    { module: "CAMS",       actions: ["READ", "ANALYTICS"], scope: "ALL_PLANTS" },
    // Tier 3 — assesses vendors on the ESG lens (value-chain ESG); reads the vendor register
    { module: "VENDOR",     actions: ["READ", "ESG"], scope: "ALL_PLANTS" }
  ],
  BCM_COORDINATOR: [
    // Owns Business Continuity end-to-end. Reads the wider ERM register for context.
    { module: "BCM",      actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "BIA",      actions: ["WRITE", "APPROVE"], scope: "ALL_PLANTS" },
    { module: "PLAN",     actions: ["WRITE", "APPROVE"], scope: "ALL_PLANTS" },
    { module: "CRISIS",   actions: ["ADMIN", "ACTIVATE", "MANAGE"], scope: "ALL_PLANTS" },
    { module: "EXERCISE", actions: ["WRITE", "COMPLETE"], scope: "ALL_PLANTS" },
    { module: "SCENARIO", actions: ["WRITE"], scope: "ALL_PLANTS" },
    { module: "HORIZON",  actions: ["WRITE"], scope: "ALL_PLANTS" },
    { module: "ERM",      actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "RISK",     actions: ["COMBINED_VIEW", "DASHBOARD_VIEW"], scope: "ALL_PLANTS" },
    { module: "CAPA",     actions: ["CREATE", "READ"], scope: "ALL_PLANTS" }
  ],
  // ─── ERM Tier 3 — Controls / Vendor / Insurance specialist roles ─────────
  CONTROLS_TESTER: [
    // Internal-audit/controls function. Router enforces tester != control owner.
    { module: "CONTROL", actions: ["READ", "WRITE", "TEST", "DEFICIENCY"], scope: "ALL_PLANTS" },
    { module: "ERM",     actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "BCM",     actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "RISK",    actions: ["COMBINED_VIEW", "DASHBOARD_VIEW"], scope: "ALL_PLANTS" },
    { module: "CAPA",    actions: ["CREATE", "READ", "UPDATE"], scope: "ALL_PLANTS" }
  ],
  VENDOR_RISK_MANAGER: [
    { module: "VENDOR", actions: ["READ", "WRITE", "ESG"], scope: "ALL_PLANTS" },
    { module: "ERM",    actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "BCM",    actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "CAPA",   actions: ["CREATE", "READ"], scope: "ALL_PLANTS" }
  ],
  INSURANCE_MANAGER: [
    { module: "INSURANCE", actions: ["READ", "WRITE", "CLAIM", "GAP"], scope: "ALL_PLANTS" },
    { module: "ERM",       actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "LOSS",      actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "RISK",      actions: ["DASHBOARD_VIEW"], scope: "ALL_PLANTS" },
    { module: "CAPA",      actions: ["CREATE", "READ"], scope: "ALL_PLANTS" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // CAMS — Compliance & Audit Management System. §7 RBAC matrix. CAPA on
  // the AUDIT source flows through the universal CAPA engine (CAPA.CREATE).
  // ════════════════════════════════════════════════════════════════════
  // NOTE: audits under CAMS run on the ComplianceAudit engine (/cams/audits),
  // which is gated on AUDIT_COMPLIANCE.* — NOT on CAMS.*. CAMS.* only covers
  // the inspection engine, templates, programme and analytics. So every
  // auditor-class role needs BOTH module grants or it 403s on the audit
  // register, the conduct screen and my-checkpoints (and the sidebar hides
  // "Audits" / "My Checkpoints", which gate on AUDIT_COMPLIANCE.READ).
  CAMS_ADMIN: [
    { module: "CAMS", actions: ["READ", "TYPE_CONFIG", "TEMPLATE_AUTHOR", "TEMPLATE_APPROVE", "SCHEDULE", "EXECUTE", "CLOSE", "FINDING_MANAGE", "ANALYTICS"], scope: "ALL_PLANTS" },
    { module: "AUDIT_COMPLIANCE", actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT"], scope: "ALL_PLANTS" },
    { module: "AUDIT_COMPLIANCE", actions: ["ALLOCATE"], scope: "ALL_PLANTS" },
    { module: "CAPA", actions: ["CREATE", "READ", "UPDATE", "EXPORT", "CROSS_SOURCE_VIEW"], scope: "ALL_PLANTS" },
    { module: "COMPLIANCE", actions: ["READ"], scope: "ALL_PLANTS" }
  ],
  AUDIT_MANAGER: [
    // Owns the audit programme cross-site; authors + approves templates; benchmarking.
    { module: "CAMS", actions: ["READ", "TYPE_CONFIG", "TEMPLATE_AUTHOR", "TEMPLATE_APPROVE", "SCHEDULE", "EXECUTE", "CLOSE", "FINDING_MANAGE", "ANALYTICS"], scope: "ALL_PLANTS" },
    { module: "AUDIT_COMPLIANCE", actions: ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT"], scope: "ALL_PLANTS" },
    { module: "AUDIT_COMPLIANCE", actions: ["ALLOCATE"], scope: "ALL_PLANTS" },
    { module: "CAPA", actions: ["CREATE", "READ", "UPDATE", "EXPORT", "CROSS_SOURCE_VIEW"], scope: "ALL_PLANTS" },
    { module: "COMPLIANCE", actions: ["READ"], scope: "ALL_PLANTS" }
  ],
  LEAD_AUDITOR: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    // Same reasoning as AUDITOR: read the register and the signed checklists,
    // export the PDF that gets handed over. No write authority on the records
    // under audit.
    { module: "FIRE",        actions: ["READ", "EXPORT"],                      scope: "OWN_PLANT" },
    // Cross-site engagements, matching the audit grant below; authors templates;
    // raises CAPAs. Leaving CAMS narrower than AUDIT_COMPLIANCE is how the same
    // role ends up able to conduct an audit at a site whose inspection register
    // it cannot open.
    { module: "CAMS", actions: ["READ", "TEMPLATE_AUTHOR", "SCHEDULE", "EXECUTE", "CLOSE", "FINDING_MANAGE", "ANALYTICS"], scope: "ALL_PLANTS" },
    // Audit engine: schedules (SCHEDULE + CREATE), allocates checkpoints + adds
    // disciplines (UPDATE), conducts (EXECUTE), closes own engagements (CLOSE),
    // issues reports (EXPORT). No APPROVE — plant-manager review of auditee
    // responses is the segregation-of-duties counterparty, not the lead auditor.
    // That is the ONE difference from HSE_MANAGER on this module, and it is
    // about who signs off on whom rather than about reach.
    //
    // SCHEDULE was absent while this comment already said "schedules": the
    // Audits screen gates its + Schedule Audit button on
    // AUDIT_COMPLIANCE.SCHEDULE, so a Lead Auditor could not raise the audits
    // they are the named owner of — the button was never rendered, with no
    // error to explain it. The CAMS grant above always included SCHEDULE, so
    // the two engines disagreed about the same role.
    //
    // ALL_PLANTS, not OWN_PLANT. Audit independence routinely sends a lead
    // auditor to a unit that is not their home site, and the platform already
    // expects that: `audit_assignment` offers anyone whose scope reaches the
    // audited plant. Leaving this at OWN_PLANT meant a lead seated on a
    // neighbouring unit's audit could be named but not act — the picker
    // promising what the guard refused. The per-audit record guard
    // (`_auditor_record`) still limits EXECUTE to audits they are actually on.
    { module: "AUDIT_COMPLIANCE", actions: ["CREATE", "READ", "UPDATE", "EXECUTE", "VERIFY", "CLOSE", "EXPORT", "SCHEDULE"], scope: "ALL_PLANTS" },
    { module: "AUDIT_COMPLIANCE", actions: ["ALLOCATE"], scope: "ALL_PLANTS" },
    { module: "CAPA", actions: ["CREATE", "READ", "UPDATE", "EXPORT"], scope: "OWN_PLANT" },
    // Facilities — the Lead Auditor is the Compliance Team's final signatory on
    // a factory-profile change (after the Plant Head's Unit approval). READ so
    // the profile and its proposed diff are actually openable; no UPDATE, which
    // keeps the approver off the requesting side of the same change.
    { module: "FACILITY", actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "FACILITY", actions: ["PROFILE_APPROVE_COMPLIANCE"], scope: "ALL_PLANTS" },
    // Supplier onboarding. CREATE + SITE_LINK together are what "add a supplier
    // factory" means: the factory is raised AND attached to the Site it is
    // managed under, and SITE_LINK is held by nobody else, so the Site picker on
    // Add Factory appears for this role alone.
    //
    // Note this is the one place the Lead Auditor sits on the requesting side of
    // Facilities rather than the approving side. It does not collide with the
    // PROFILE_APPROVE_COMPLIANCE grant above: that governs change requests
    // against an EXISTING profile, and creating one raises no change request to
    // self-approve. UPDATE is still deliberately withheld for that reason.
    { module: "FACILITY", actions: ["CREATE", "SITE_LINK"], scope: "ALL_PLANTS" }
  ],
  AUDITEE: [
    // Open the audit screens at all. Without this the grants below are
    // unreachable in the UI — the engagement page carrying their own findings
    // 403s before it can render them.
    { module: "CAMS", actions: ["READ"], scope: "OWN_PLANT" },
    // READ stays at OWN_RECORDS — this is the grant that keeps an auditee
    // looking only at their own engagements. The audit detail endpoint passes
    // `_reader_record(audit)`, which flattens every party to the engagement
    // into `teamMembers`, so a seated auditee matches and nobody else's audit
    // is visible.
    { module: "AUDIT_COMPLIANCE", actions: ["READ"], scope: "OWN_RECORDS" },
    // UPDATE is ALL_PLANTS while READ deliberately is NOT, and the split is the
    // whole point. Two different things read these two grants:
    //
    //   • `_scope_covers_plant` decides whether someone may be SEATED as an
    //     auditee, and it reads the auditee slot's permission — UPDATE. At
    //     OWN_RECORDS this required the audited plant to be in the person's own
    //     plant set, so an auditee could not be allocated checkpoints on another
    //     unit's audit even after being named on it.
    //   • `_party_filter_for` narrows the Audits register to a person's own
    //     engagements ONLY while every READ grant they hold is OWN_RECORDS.
    //     Widening READ too would silently turn every auditee into a
    //     company-wide audit reader across all sites.
    //
    // So UPDATE opens the assignment, READ keeps the blinkers. Responding is
    // still gated twice over: `record={"routedToUserId": user.id}` on the
    // permission check, and the routing guard in `transition_checkpoint`, which
    // refuses anyone who is not the checkpoint's assigned owner.
    { module: "AUDIT_COMPLIANCE", actions: ["UPDATE"], scope: "ALL_PLANTS" },
    // Evidence upload needs no more than READ: /upload-url mints a signed
    // Supabase URL and the response carries the storage paths.
    //
    // The corrective actions arising from their findings. OWN_RECORDS, so they
    // work the CAPAs they own and see no others.
    { module: "CAPA", actions: ["READ", "UPDATE", "EXECUTE"], scope: "OWN_RECORDS" }
  ],
  AUDITOR: [
    // ── Fire & Life Safety ──────────────────────────────────────────
    // The gap the previous INCIDENT.* bootstrap left open: an auditor held no
    // INCIDENT grant, so the role whose job is to inspect the fire register
    // could not open it. Read + export only — an auditor who could edit the
    // record they are auditing is not auditing it.
    { module: "FIRE",        actions: ["READ", "EXPORT"],                      scope: "OWN_PLANT" },
    // Executes assigned engagements; records findings; raises CAPAs; own-audit analytics.
    { module: "CAMS", actions: ["READ", "EXECUTE", "FINDING_MANAGE", "ANALYTICS"], scope: "OWN_PLANT" },
    // Conducts only — no scheduling, no close. The per-audit record guard
    // (_auditor_record) still restricts EXECUTE to audits they are on, which is
    // what makes ALL_PLANTS safe here: the scope decides which plants they can
    // be SEATED on, the record guard decides which audits they can act on.
    { module: "AUDIT_COMPLIANCE", actions: ["READ", "EXECUTE", "EXPORT"], scope: "ALL_PLANTS" },
    { module: "CAPA", actions: ["CREATE", "READ", "UPDATE"], scope: "OWN_PLANT" }
  ],
  // ════════════════════════════════════════════════════════════════════
  // Facilities — Factory Profile Master & Consolidated Dashboard. §5 RBAC
  // matrix. The consolidated dashboard reads live operational data per site
  // from the existing engines, so the personas also hold scoped READ on
  // CAMS / CAPA / AUDIT_COMPLIANCE / INCIDENT for the Compliance & Audit tab.
  // ════════════════════════════════════════════════════════════════════
  FACILITIES_MANAGER: [
    // Group view — sees and edits every factory cross-site.
    // SITE_LINK dropped — see HSE_MANAGER above.
    { module: "FACILITY",         actions: ["READ", "CREATE", "UPDATE", "DELETE", "EXPORT", "WORKFORCE_UPDATE", "SOCIAL_UPDATE", "CERT_MANAGE", "CONTACT_MANAGE", "COMPARE", "PROFILE_APPROVE_UNIT", "PROFILE_APPROVE_COMPLIANCE"], scope: "ALL_PLANTS" },
    // Live drill-down into the operational engines (read-only).
    { module: "CAMS",             actions: ["READ", "ANALYTICS"], scope: "ALL_PLANTS" },
    { module: "CAPA",             actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "AUDIT_COMPLIANCE", actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "INCIDENT",         actions: ["READ"], scope: "ALL_PLANTS" },
    { module: "COMPLIANCE",       actions: ["READ"], scope: "ALL_PLANTS" }
  ],
  FACTORY_MANAGER: [
    // Strictly own factory across every screen (dashboard auto-scopes to site).
    { module: "FACILITY",         actions: ["READ", "CREATE", "UPDATE", "EXPORT", "WORKFORCE_UPDATE", "SOCIAL_UPDATE", "CERT_MANAGE", "CONTACT_MANAGE"], scope: "OWN_PLANT" },
    { module: "CAMS",             actions: ["READ"], scope: "OWN_PLANT" },
    { module: "CAPA",             actions: ["READ"], scope: "OWN_PLANT" },
    { module: "AUDIT_COMPLIANCE", actions: ["READ"], scope: "OWN_PLANT" },
    { module: "INCIDENT",         actions: ["READ"], scope: "OWN_PLANT" }
  ]
};

// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════
// The two administrator roles.
//
// ADMIN absorbs SYSTEM_ADMIN. The two were written as separate hand-maintained
// lists that were meant to be identical and had drifted — ADMIN uniquely held
// the HIRA/CAPA extras, SYSTEM_ADMIN uniquely held EAI/RISK/CONTROL/VENDOR/
// INSURANCE. Taking the UNION rather than picking one keeps every capability
// that existed under either name. `skipDuplicates` on the insert absorbs the
// overlap, so the shared majority is written once.
ROLE_GRANTS.ADMIN = [...ROLE_GRANTS.ADMIN, ...ROLE_GRANTS.SYSTEM_ADMIN];
delete ROLE_GRANTS.SYSTEM_ADMIN;

// SUPER_ADMIN — the organisation owner. DERIVED from ADMIN rather than copied,
// so a grant added to ADMIN is automatically held here too. That is the
// invariant we want: the Super Admin can do everything the Administrator can,
// plus own the organisation.
//
// ORGANISATION.MODULES is the one authority no other role gets — switching a
// module off there removes it from every plant at once.
ROLE_GRANTS.SUPER_ADMIN = [
  ...ROLE_GRANTS.ADMIN,
  { module: "ORGANISATION", actions: ["MODULES"], scope: "ALL_PLANTS" }
];

async function main() {
  console.log("🔐  RBAC seed: roles + permissions + grants + user-role assignments");

  // 1) Add the new roles (idempotent)
  for (const r of ADDITIONAL_ROLES) {
    await prisma.role.upsert({
      where: { code: r.code },
      create: { ...r, isActive: true },
      update: { name: r.name, description: r.description, sortOrder: r.sortOrder, defaultLanding: r.defaultLanding, isActive: true }
    });
  }
  const roleCount = await prisma.role.count();
  console.log(`   roles in master: ${roleCount}`);

  // 2) Seed permission catalogue
  const allPermissions: { code: string; module: string; action: string; description: string }[] = [];
  for (const m of OPERATIONAL_MODULES) {
    for (const a of OPERATIONAL_ACTIONS) {
      allPermissions.push({ code: `${m}.${a}`, module: m, action: a, description: `${a} on ${m}` });
    }
  }
  allPermissions.push(...EXTRA_PERMISSIONS);

  for (const p of allPermissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      create: p,
      update: { module: p.module, action: p.action, description: p.description }
    });
  }
  console.log(`   permissions catalogued: ${allPermissions.length}`);

  // 3) Default role × permission matrix
  // Strategy: wipe then re-create as ONE batched insert. The previous loop
  // fired a separate INSERT per grant (~500) which, over a remote DB with
  // ~80ms RTT, made the seed take ~60s. createMany is a single round-trip.
  await prisma.rolePermission.deleteMany({});
  const roleByCode = new Map(
    (await prisma.role.findMany({ select: { id: true, code: true } })).map((r) => [r.code, r.id])
  );
  const permByCode = new Map(
    (await prisma.permission.findMany({ select: { id: true, code: true } })).map((p) => [p.code, p.id])
  );
  const grantRows: { roleId: string; permissionId: string; scope: string }[] = [];
  for (const [roleCode, grants] of Object.entries(ROLE_GRANTS)) {
    const roleId = roleByCode.get(roleCode);
    if (!roleId) continue;
    for (const g of grants) {
      for (const action of g.actions) {
        const permissionId = permByCode.get(`${g.module}.${action}`);
        if (!permissionId) continue;
        grantRows.push({ roleId, permissionId, scope: g.scope });
      }
    }
  }
  if (grantRows.length > 0) {
    await prisma.rolePermission.createMany({ data: grantRows, skipDuplicates: true });
  }
  console.log(`   role-permission grants created: ${grantRows.length}`);

  // 4) Assign demo users to their RBAC roles via UserRole rows.
  //
  // Strategy:
  //   a. For structured demo emails ({role}.{dept}.{plant}@safeops360.in)
  //      parse the role from the email — that's the canonical role assignment
  //      and avoids any drift between the legacy User.role string and the
  //      richer role taxonomy.
  //   b. For non-structured emails (the global anchor admin, plus any users
  //      created via other paths), back-fill UserRole from User.role.
  //
  // The legacy User.role column stays as a back-compat denormalisation; the
  // UserRole table is the source of truth for permission checks.
  await prisma.userRole.deleteMany({});

  const allUsers = await prisma.user.findMany({ select: { id: true, email: true, role: true, plantId: true } });
  const roleIdByCode = new Map(
    (await prisma.role.findMany({ select: { id: true, code: true } })).map((r) => [r.code, r.id])
  );

  // Batched insert — same reason as the rolePermission batch above.
  const userRoleRows: { userId: string; roleId: string; scopeType: string | null; scopeValue: string | null }[] = [];
  let structuredAssigned = 0;
  let backfilled = 0;
  for (const u of allUsers) {
    const parsed = parseDemoEmail(u.email);
    const targetRoleCode = parsed?.role.roleCode ?? u.role;
    const rid = roleIdByCode.get(targetRoleCode);
    if (!rid) continue;
    userRoleRows.push({
      userId: u.id,
      roleId: rid,
      scopeType: u.plantId ? "PLANT" : null,
      scopeValue: u.plantId ?? null
    });
    if (parsed) structuredAssigned++;
    else backfilled++;
  }
  if (userRoleRows.length > 0) {
    await prisma.userRole.createMany({ data: userRoleRows, skipDuplicates: true });
  }
  console.log(`   structured emails → role assigned: ${structuredAssigned}`);
  console.log(`   non-structured emails (back-filled): ${backfilled}`);

  // Anchor admin (admin@safeops360.in) — also layer ADMIN on top so
  // configuration access keys off the role code regardless of which path
  // created the user.
  const anchorAdmin = allUsers.find((u) => u.email === "admin@safeops360.in");
  const sysAdminRoleId = roleIdByCode.get("ADMIN");
  if (anchorAdmin && sysAdminRoleId) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: anchorAdmin.id, roleId: sysAdminRoleId }
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: anchorAdmin.id, roleId: sysAdminRoleId }
      });
    }
  }

  // Cross-plant UserRole entries for Meridian Manufacturing (NW + SW).
  // NW users get a role entry for SW and vice-versa so getAccessiblePlantIds()
  // returns both plants for any Meridian user (HSE Manager, Plant Head, etc.),
  // while industry-tenant users keep single-plant scope.
  const nwPlant = await prisma.plant.findUnique({ where: { code: "NW" } });
  const swPlant = await prisma.plant.findUnique({ where: { code: "SW" } });
  if (nwPlant && swPlant) {
    const meridianUsers = await prisma.user.findMany({
      where: { email: { contains: ".it.nw@" }, plantId: nwPlant.id },
      select: { id: true, role: true }
    });
    const meridianSwUsers = await prisma.user.findMany({
      where: { email: { contains: ".it.sw@" }, plantId: swPlant.id },
      select: { id: true, role: true }
    });

    const crossRows: { userId: string; roleId: string; scopeType: string; scopeValue: string }[] = [];
    for (const u of meridianUsers) {
      const rid = roleIdByCode.get(u.role);
      if (rid) crossRows.push({ userId: u.id, roleId: rid, scopeType: "PLANT", scopeValue: swPlant.id });
    }
    for (const u of meridianSwUsers) {
      const rid = roleIdByCode.get(u.role);
      if (rid) crossRows.push({ userId: u.id, roleId: rid, scopeType: "PLANT", scopeValue: nwPlant.id });
    }
    if (crossRows.length > 0) {
      await prisma.userRole.createMany({ data: crossRows, skipDuplicates: true });
      console.log(`   cross-plant (NW↔SW) entries added: ${crossRows.length}`);
    }
  }

  // Named all-plant accounts (NAMED_ALL_PLANT_USERS). Re-granted here because
  // the deleteMany above wiped their per-plant rows, and neither the back-fill
  // (home plant only) nor the NW↔SW block (matches `.it.nw@` / `.it.sw@`) would
  // restore group-wide reach.
  const namedSynced = await syncNamedAllPlantUsers(prisma);
  for (const n of namedSynced) {
    console.log(`   named all-plant user: ${n.email} → ${n.roleCode} × ${n.plantsGranted} plants`);
  }

  const userRoleCount = await prisma.userRole.count();
  console.log(`   user-role assignments: ${userRoleCount}`);
  console.log("✅  RBAC seed complete.");
}

main()
  .catch((e) => {
    console.error("❌  RBAC seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
