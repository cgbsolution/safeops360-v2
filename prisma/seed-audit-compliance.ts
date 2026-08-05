// ────────────────────────────────────────────────────────────────────────
// Seed — Audit & Compliance Management
//
// Seeds:
//   • Industry checkpoint libraries: GARMENTS_TEXTILE (full, ~100 checkpoints
//     across 10 categories — the Page Industries use case) + MANUFACTURING_GENERIC
//     and PHARMA_LIFE_SCIENCES (stubs, enough to demo industry-switch).
//   • Audit templates (presets that pull checkpoints from a library).
//   • Demo ComplianceAudits in different lifecycle states, each with materialized
//     AuditCheckpointResponse rows so the dashboards render immediately.
//
// Idempotent: deletes existing audit-compliance rows first. Run after seed-rbac
// (needs users/roles) and CAPA masters (AUDIT_INTERNAL source type).
//   npx tsx prisma/seed-audit-compliance.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type Checkpoint = {
  code: string;
  question: string;
  guidance?: string;
  requirement_reference?: string;
  standard?: string;
  criticality: "critical" | "major" | "minor" | "informational";
  response_type?: string;
  requires_photo_on_fail?: boolean;
  requires_photo_always?: boolean;
  auto_trigger_capa_on_fail?: boolean;
  capa_severity_if_triggered?: "critical" | "major" | "minor";
  linked_safeops_module?: string | null;
};
type Category = {
  category_code: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  sequence: number;
  checkpoints: Checkpoint[];
};

// Default rule-fill: critical/major fails want a photo; criticals auto-spawn CAPA.
function cp(c: Checkpoint): Checkpoint {
  const isCrit = c.criticality === "critical";
  const isMajor = c.criticality === "major";
  return {
    response_type: "pass_partial_fail",
    requires_photo_on_fail: c.requires_photo_on_fail ?? (isCrit || isMajor),
    auto_trigger_capa_on_fail: c.auto_trigger_capa_on_fail ?? isCrit,
    capa_severity_if_triggered: c.capa_severity_if_triggered ?? (isCrit ? "critical" : isMajor ? "major" : "minor"),
    standard: c.standard ?? "ISO 45001",
    linked_safeops_module: c.linked_safeops_module ?? null,
    ...c,
  };
}

// ── GARMENTS / TEXTILE library ──────────────────────────────────────────
const GARMENTS_CATEGORIES: Category[] = [
  {
    category_code: "FIRE-LIFE-SAFETY",
    category_name: "Fire Safety & Emergency Preparedness",
    category_color: "#DC2626",
    category_icon: "fire",
    sequence: 1,
    checkpoints: [
      cp({ code: "GT-FS-001", question: "Are all fire exits clearly marked, unobstructed, and functional?", guidance: "Walk every exit route; confirm no locked/blocked doors.", requirement_reference: "Factories Act §38, NFPA 101", criticality: "critical" }),
      cp({ code: "GT-FS-002", question: "Are fire extinguishers at designated locations, inspected monthly, and accessible?", requirement_reference: "IS 2190", criticality: "major" }),
      cp({ code: "GT-FS-003", question: "Is the fire suppression / sprinkler system operational and last tested within 6 months?", criticality: "critical" }),
      cp({ code: "GT-FS-004", question: "Is the fire alarm / detection system functional and last tested within 3 months?", guidance: "Check test log; physically test one detector; verify certificate.", criticality: "critical" }),
      cp({ code: "GT-FS-005", question: "Have all workers received fire safety training in the last 12 months?", linked_safeops_module: "training", criticality: "major" }),
      cp({ code: "GT-FS-006", question: "Has a fire evacuation drill been conducted in the last 6 months?", criticality: "major" }),
      cp({ code: "GT-FS-007", question: "Are muster points clearly identified and known to all workers?", criticality: "major" }),
      cp({ code: "GT-FS-008", question: "Is storage of fabric and flammable materials compliant with spacing and stacking requirements?", criticality: "critical" }),
      cp({ code: "GT-FS-009", question: "Are electrical panels free from combustible materials within 1 metre?", criticality: "major" }),
      cp({ code: "GT-FS-010", question: "Is emergency lighting functional in all exit routes?", criticality: "major" }),
      cp({ code: "GT-FS-011", question: "Are fire hose reels accessible, unobstructed, and in working condition?", criticality: "major" }),
      cp({ code: "GT-FS-012", question: "Are smoking controls enforced across all production areas?", criticality: "major" }),
      cp({ code: "GT-FS-013", question: "Is a trained fire-fighting team designated per shift with roster displayed?", linked_safeops_module: "skill_matrix", criticality: "major" }),
      cp({ code: "GT-FS-014", question: "Are exit door widths and travel distances within code for the occupant load?", requirement_reference: "NBC Part 4", criticality: "major" }),
    ],
  },
  {
    category_code: "WORKER-WELFARE",
    category_name: "Worker Welfare & SA8000 Compliance",
    category_color: "#7C3AED",
    category_icon: "users",
    sequence: 2,
    checkpoints: [
      cp({ code: "GT-WW-001", question: "Is child labour (under 15 years) prohibited and verified through age documentation?", requirement_reference: "SA8000:2014 Cl.1, Child Labour Act 1986", standard: "SA8000", criticality: "critical" }),
      cp({ code: "GT-WW-002", question: "Are working hours compliant — not exceeding 10 hours/day and 60 hours/week including overtime?", requirement_reference: "SA8000:2014 Cl.7, Factories Act §51-56", standard: "SA8000", criticality: "critical" }),
      cp({ code: "GT-WW-003", question: "Are workers paid minimum wage or above as per applicable state/central rates?", requirement_reference: "Minimum Wages Act 1948", standard: "SA8000", criticality: "critical" }),
      cp({ code: "GT-WW-004", question: "Are adequate welfare amenities provided — clean drinking water, toilets (separate men/women), rest areas?", requirement_reference: "Factories Act §18-19, SA8000 Cl.8", standard: "SA8000", criticality: "major" }),
      cp({ code: "GT-WW-005", question: "Is there a functioning internal grievance mechanism accessible to all workers?", requirement_reference: "SA8000:2014 Cl.11", standard: "SA8000", criticality: "major" }),
      cp({ code: "GT-WW-006", question: "Are workers free to join or form trade unions, with this right documented and communicated?", requirement_reference: "SA8000:2014 Cl.4", standard: "SA8000", criticality: "major" }),
      cp({ code: "GT-WW-007", question: "Is there a policy against discrimination (gender, caste, religion) effectively implemented?", requirement_reference: "SA8000:2014 Cl.5", standard: "SA8000", criticality: "major" }),
      cp({ code: "GT-WW-008", question: "Are worker employment contracts in place and copies provided to each worker?", standard: "SA8000", criticality: "major" }),
      cp({ code: "GT-WW-009", question: "Is the canteen / meal facility hygienically maintained and FSSAI compliant?", criticality: "minor" }),
      cp({ code: "GT-WW-010", question: "Is maternity leave and benefit compliance documented per Maternity Benefits Act?", standard: "SA8000", criticality: "major" }),
      cp({ code: "GT-WW-011", question: "Is a functioning anti-harassment (POSH) committee constituted and trained?", requirement_reference: "POSH Act 2013", standard: "SA8000", criticality: "major" }),
      cp({ code: "GT-WW-012", question: "Are crèche facilities provided where the number of women workers requires it?", requirement_reference: "Factories Act §48", criticality: "minor" }),
    ],
  },
  {
    category_code: "MACHINE-SAFETY",
    category_name: "Machine & Equipment Safety",
    category_color: "#EA580C",
    category_icon: "cog",
    sequence: 3,
    checkpoints: [
      cp({ code: "GT-MS-001", question: "Are all machine guards (needle guards, belt guards, flywheel covers) in place and functional?", requirement_reference: "Factories Act §21-27, ISO 45001 Cl.8.1", criticality: "critical" }),
      cp({ code: "GT-MS-002", question: "Are emergency stop buttons accessible and functional on all sewing and cutting machines?", criticality: "critical" }),
      cp({ code: "GT-MS-003", question: "Are cutting machines (straight knife, band knife) equipped with anti-contact devices and PPE provided?", criticality: "critical" }),
      cp({ code: "GT-MS-004", question: "Is LOTO (Lockout/Tagout) procedure followed during maintenance activities?", linked_safeops_module: "ptw", criticality: "major" }),
      cp({ code: "GT-MS-005", question: "Are machine operators trained for the specific machines they operate?", linked_safeops_module: "skill_matrix", criticality: "major" }),
      cp({ code: "GT-MS-006", question: "Is the boiler / steam press equipment certified and inspected per Indian Boilers Act?", criticality: "critical" }),
      cp({ code: "GT-MS-007", question: "Are overlock and flatlock machines free from exposed moving parts without guards?", criticality: "major" }),
      cp({ code: "GT-MS-008", question: "Are compressor air lines and pressure vessels within inspection validity?", linked_safeops_module: "inspection", criticality: "major" }),
      cp({ code: "GT-MS-009", question: "Are needle detection and broken-needle log procedures followed?", criticality: "major" }),
      cp({ code: "GT-MS-010", question: "Is machine maintenance on schedule and records available?", linked_safeops_module: "inspection", criticality: "minor" }),
      cp({ code: "GT-MS-011", question: "Are fusing machines and heat presses fitted with two-hand controls / guards?", criticality: "major" }),
    ],
  },
  {
    category_code: "ELECTRICAL-SAFETY",
    category_name: "Electrical Safety",
    category_color: "#F59E0B",
    category_icon: "zap",
    sequence: 4,
    checkpoints: [
      cp({ code: "GT-EL-001", question: "Is the earthing system tested annually and records available?", criticality: "critical" }),
      cp({ code: "GT-EL-002", question: "Are all electrical panels labelled, locked, and accessible only to authorised personnel?", criticality: "major" }),
      cp({ code: "GT-EL-003", question: "Are extension cords / multi-plug adapters absent from production areas (direct wiring required)?", criticality: "major" }),
      cp({ code: "GT-EL-004", question: "Are electrical cables routed properly — no hanging cables over water, no exposed insulation?", criticality: "major" }),
      cp({ code: "GT-EL-005", question: "Are MCBs and circuit breakers rated correctly for the connected load?", criticality: "major" }),
      cp({ code: "GT-EL-006", question: "Are licensed electricians employed for all electrical maintenance?", linked_safeops_module: "skill_matrix", criticality: "major" }),
      cp({ code: "GT-EL-007", question: "Are electrical workers provided insulated tools and appropriate PPE?", linked_safeops_module: "ppe", criticality: "major" }),
      cp({ code: "GT-EL-008", question: "Are RCDs / ELCBs installed on socket circuits and tested via the trip button?", criticality: "major" }),
      cp({ code: "GT-EL-009", question: "Is a valid electrical-installation safety certificate available and current?", criticality: "minor" }),
    ],
  },
  {
    category_code: "CHEMICAL-HAZMAT",
    category_name: "Chemical & Hazardous Material Management",
    category_color: "#10B981",
    category_icon: "flask",
    sequence: 5,
    checkpoints: [
      cp({ code: "GT-CH-001", question: "Are Safety Data Sheets (SDS) available in local language at each chemical storage/use location?", requirement_reference: "Factories Act §41-B, GHS", criticality: "major" }),
      cp({ code: "GT-CH-002", question: "Are dyes, solvents, and adhesives stored in designated areas with secondary containment?", criticality: "major" }),
      cp({ code: "GT-CH-003", question: "Are workers handling chemicals trained on hazards, PPE, and emergency response?", linked_safeops_module: "training", criticality: "major" }),
      cp({ code: "GT-CH-004", question: "Are chemical containers labelled with GHS-compliant labels?", criticality: "major" }),
      cp({ code: "GT-CH-005", question: "Are spill kits available at chemical-use locations and workers trained in spill response?", criticality: "major" }),
      cp({ code: "GT-CH-006", question: "Is the effluent treatment plant (ETP) operational and discharging within PCB-permitted limits?", linked_safeops_module: "eai", standard: "ISO 14001", criticality: "critical" }),
      cp({ code: "GT-CH-007", question: "Is incompatible-chemical segregation maintained in the store (acids/alkalis/oxidisers)?", criticality: "major" }),
    ],
  },
  {
    category_code: "PPE-COMPLIANCE",
    category_name: "PPE Usage & Compliance",
    category_color: "#0891B2",
    category_icon: "hard-hat",
    sequence: 6,
    checkpoints: [
      cp({ code: "GT-PP-001", question: "Are appropriate PPE types identified and provided for each workstation?", linked_safeops_module: "ppe", criticality: "major" }),
      cp({ code: "GT-PP-002", question: "Is PPE being worn correctly by workers at all required workstations during the audit?", requires_photo_always: true, criticality: "major" }),
      cp({ code: "GT-PP-003", question: "Is PPE in good condition — no damaged gloves, torn coveralls, or defective ear protection?", criticality: "major" }),
      cp({ code: "GT-PP-004", question: "Have all workers received PPE usage training?", linked_safeops_module: "training", criticality: "minor" }),
      cp({ code: "GT-PP-005", question: "Are eye-wash stations functional and accessible in dyeing/chemical areas?", criticality: "major" }),
      cp({ code: "GT-PP-006", question: "Are metal-mesh gloves provided and used at cutting workstations?", linked_safeops_module: "ppe", criticality: "major" }),
    ],
  },
  {
    category_code: "HOUSEKEEPING-ERGONOMICS",
    category_name: "Housekeeping, Ergonomics & Working Environment",
    category_color: "#6366F1",
    category_icon: "broom",
    sequence: 7,
    checkpoints: [
      cp({ code: "GT-HK-001", question: "Are all walkways and aisles free from fabric rolls, cut pieces, and obstructions?", criticality: "major" }),
      cp({ code: "GT-HK-002", question: "Is adequate lighting provided at all workstations (≥300 lux sewing, ≥500 lux cutting/inspection)?", criticality: "major" }),
      cp({ code: "GT-HK-003", question: "Is ventilation adequate in ironing and heat-press areas — no heat stress risk?", criticality: "major" }),
      cp({ code: "GT-HK-004", question: "Are ergonomic workstations available — adjustable chairs, footrests for sewing operators?", criticality: "minor" }),
      cp({ code: "GT-HK-005", question: "Is dust and lint accumulation controlled in cutting and blowing areas?", criticality: "major" }),
      cp({ code: "GT-HK-006", question: "Is noise level within acceptable limits in production areas (<85 dB for 8 hours)?", criticality: "major" }),
      cp({ code: "GT-HK-007", question: "Is waste fabric / trim collected in designated bins and cleared each shift?", criticality: "minor" }),
    ],
  },
  {
    category_code: "TRAINING-COMPETENCY",
    category_name: "Training & Competency",
    category_color: "#F97316",
    category_icon: "graduation-cap",
    sequence: 8,
    checkpoints: [
      cp({ code: "GT-TC-001", question: "Have all workers completed safety induction training before starting work?", linked_safeops_module: "training", criticality: "major" }),
      cp({ code: "GT-TC-002", question: "Are training records maintained and available for the last 3 years?", linked_safeops_module: "training", criticality: "major" }),
      cp({ code: "GT-TC-003", question: "Is a First Aider trained and present on each working shift (≥1 per 150 workers)?", linked_safeops_module: "skill_matrix", criticality: "critical" }),
      cp({ code: "GT-TC-004", question: "Are fire wardens designated and trained for each floor/section?", linked_safeops_module: "skill_matrix", criticality: "major" }),
      cp({ code: "GT-TC-005", question: "Are supervisors trained in incident reporting and investigation?", linked_safeops_module: "training", criticality: "minor" }),
    ],
  },
  {
    category_code: "INCIDENT-NEAR-MISS",
    category_name: "Incident Reporting & Investigation",
    category_color: "#EF4444",
    category_icon: "alert-triangle",
    sequence: 9,
    checkpoints: [
      cp({ code: "GT-IN-001", question: "Is there a functioning incident reporting system and are workers aware of how to report?", linked_safeops_module: "incident", criticality: "major" }),
      cp({ code: "GT-IN-002", question: "Have all incidents in the last 12 months been investigated with root cause identified?", linked_safeops_module: "incident", criticality: "major" }),
      cp({ code: "GT-IN-003", question: "Are near misses being reported and tracked (target ≥10:1 ratio vs incidents)?", linked_safeops_module: "near_miss", criticality: "major" }),
      cp({ code: "GT-IN-004", question: "Are CAPA actions from previous incidents implemented and verified?", linked_safeops_module: "capa", criticality: "major" }),
      cp({ code: "GT-IN-005", question: "Is LTIFR tracked and communicated to workers monthly?", linked_safeops_module: "manhours", criticality: "minor" }),
    ],
  },
  {
    category_code: "ENVIRONMENTAL-COMPLIANCE",
    category_name: "Environmental & Legal Compliance",
    category_color: "#14B8A6",
    category_icon: "leaf",
    sequence: 10,
    checkpoints: [
      cp({ code: "GT-EC-001", question: "Is the PCB / SPCB Consent to Operate valid and displayed?", standard: "ISO 14001", criticality: "critical" }),
      cp({ code: "GT-EC-002", question: "Is the Factory Licence valid and displayed?", requirement_reference: "Factories Act §6", criticality: "critical" }),
      cp({ code: "GT-EC-003", question: "Is waste segregation practised — hazardous, non-hazardous, recyclable in separate streams?", linked_safeops_module: "eai", standard: "ISO 14001", criticality: "major" }),
      cp({ code: "GT-EC-004", question: "Are hazardous-waste manifests maintained and disposal through authorised agencies only?", standard: "ISO 14001", criticality: "major" }),
      cp({ code: "GT-EC-005", question: "Is water consumption monitored and records maintained?", standard: "ISO 14001", criticality: "minor" }),
      cp({ code: "GT-EC-006", question: "Is energy consumption monitored and reduction targets set?", standard: "ISO 14001", criticality: "minor" }),
    ],
  },
];

// ── Stub libraries (enough to demo the industry-switch differentiator) ────
const MANUFACTURING_CATEGORIES: Category[] = [
  {
    category_code: "MACHINE-GUARDING", category_name: "Machine Guarding & LOTO", category_color: "#EA580C", category_icon: "cog", sequence: 1,
    checkpoints: [
      cp({ code: "MG-MS-001", question: "Are all rotating/moving parts guarded per ISO 14120?", requirement_reference: "ISO 14120", criticality: "critical" }),
      cp({ code: "MG-MS-002", question: "Is LOTO implemented with personal locks during maintenance?", linked_safeops_module: "ptw", criticality: "critical" }),
      cp({ code: "MG-MS-003", question: "Are emergency stops tested and functional on all production lines?", criticality: "major" }),
      cp({ code: "MG-MS-004", question: "Are operators competency-verified for assigned machines?", linked_safeops_module: "skill_matrix", criticality: "major" }),
      cp({ code: "MG-MS-005", question: "Are pressure vessels within statutory inspection validity?", linked_safeops_module: "inspection", criticality: "major" }),
    ],
  },
  {
    category_code: "WORK-AT-HEIGHT", category_name: "Working at Height & Confined Space", category_color: "#0891B2", category_icon: "arrow-up", sequence: 2,
    checkpoints: [
      cp({ code: "MG-WH-001", question: "Is a work-at-height permit raised and fall protection used above 1.8 m?", linked_safeops_module: "ptw", criticality: "critical" }),
      cp({ code: "MG-WH-002", question: "Are confined-space entries gas-tested and permit-controlled?", linked_safeops_module: "ptw", criticality: "critical" }),
      cp({ code: "MG-WH-003", question: "Are scaffolds inspected and tagged before use?", linked_safeops_module: "inspection", criticality: "major" }),
      cp({ code: "MG-WH-004", question: "Are anchor points certified for the applied loads?", criticality: "major" }),
    ],
  },
  {
    category_code: "FIRE-ELEC", category_name: "Fire & Electrical Safety", category_color: "#DC2626", category_icon: "fire", sequence: 3,
    checkpoints: [
      cp({ code: "MG-FE-001", question: "Are fire detection and suppression systems tested within validity?", criticality: "critical" }),
      cp({ code: "MG-FE-002", question: "Is electrical earthing tested annually with records?", criticality: "major" }),
      cp({ code: "MG-FE-003", question: "Are hot-work permits enforced with fire watch?", linked_safeops_module: "ptw", criticality: "major" }),
    ],
  },
  {
    category_code: "ENV-COMPLIANCE-M", category_name: "Environmental Compliance", category_color: "#14B8A6", category_icon: "leaf", sequence: 4,
    checkpoints: [
      cp({ code: "MG-EC-001", question: "Is the Consent to Operate valid and emissions within limits?", linked_safeops_module: "eai", standard: "ISO 14001", criticality: "critical" }),
      cp({ code: "MG-EC-002", question: "Is hazardous waste manifested and disposed via authorised agencies?", standard: "ISO 14001", criticality: "major" }),
      cp({ code: "MG-EC-003", question: "Are HIRA studies current for all significant activities?", linked_safeops_module: "hira", criticality: "major" }),
    ],
  },
];

const PHARMA_CATEGORIES: Category[] = [
  {
    category_code: "CLEANROOM", category_name: "Clean Room & Contamination Control", category_color: "#6366F1", category_icon: "shield", sequence: 1,
    checkpoints: [
      cp({ code: "PH-CR-001", question: "Are cleanroom differential pressures within qualified ranges and logged?", standard: "EU GMP Annex 1", criticality: "critical" }),
      cp({ code: "PH-CR-002", question: "Is gowning procedure followed and gowning qualification current?", linked_safeops_module: "training", criticality: "major" }),
      cp({ code: "PH-CR-003", question: "Is environmental monitoring (viable/non-viable) within action limits?", criticality: "major" }),
      cp({ code: "PH-CR-004", question: "Are HEPA filters within integrity-test validity?", linked_safeops_module: "inspection", criticality: "major" }),
    ],
  },
  {
    category_code: "GMP-DOCS", category_name: "GMP Documentation & Data Integrity", category_color: "#7C3AED", category_icon: "file", sequence: 2,
    checkpoints: [
      cp({ code: "PH-DI-001", question: "Are batch manufacturing records complete, contemporaneous, and reviewed?", standard: "21 CFR 211", criticality: "critical" }),
      cp({ code: "PH-DI-002", question: "Are electronic records 21 CFR Part 11 compliant (audit trail, e-sign)?", standard: "21 CFR Part 11", criticality: "critical" }),
      cp({ code: "PH-DI-003", question: "Are SOPs current, approved, and available at point of use?", criticality: "major" }),
      cp({ code: "PH-DI-004", question: "Are deviations and CAPAs closed within timelines?", linked_safeops_module: "capa", criticality: "major" }),
    ],
  },
  {
    category_code: "PH-SAFETY", category_name: "Process Safety & Hazmat", category_color: "#10B981", category_icon: "flask", sequence: 3,
    checkpoints: [
      cp({ code: "PH-PS-001", question: "Are solvent-handling areas ATEX-classified with appropriate equipment?", criticality: "critical" }),
      cp({ code: "PH-PS-002", question: "Are SDS available and operators trained on chemical hazards?", linked_safeops_module: "training", criticality: "major" }),
      cp({ code: "PH-PS-003", question: "Is the ETP / solvent recovery operating within consent limits?", linked_safeops_module: "eai", standard: "ISO 14001", criticality: "major" }),
    ],
  },
];

// ── CEMENT library (DGMS, kiln, dust — the "switch to Cement" demo moment) ──
const CEMENT_CATEGORIES: Category[] = [
  {
    category_code: "KILN-MILL", category_name: "Kiln & Mill Safety", category_color: "#B45309", category_icon: "flame", sequence: 1,
    checkpoints: [
      cp({ code: "CE-KM-001", question: "Are kiln hot-zone entry permits and cooling protocols enforced before inspection?", requirement_reference: "DGMS Circular, OISD", criticality: "critical" }),
      cp({ code: "CE-KM-002", question: "Are raw mill and cement mill guards, interlocks, and emergency stops functional?", criticality: "critical" }),
      cp({ code: "CE-KM-003", question: "Is hot-meal / clinker spillage handling procedure followed with burn-protection PPE?", linked_safeops_module: "ppe", criticality: "major" }),
      cp({ code: "CE-KM-004", question: "Are preheater/cyclone jamming clearance jobs done under work permit with LOTO?", linked_safeops_module: "ptw", criticality: "critical" }),
      cp({ code: "CE-KM-005", question: "Is kiln refractory inspection within validity with confined-space controls?", linked_safeops_module: "inspection", criticality: "major" }),
    ],
  },
  {
    category_code: "DUST-DGMS", category_name: "Dust Control & DGMS Compliance", category_color: "#78716C", category_icon: "wind", sequence: 2,
    checkpoints: [
      cp({ code: "CE-DG-001", question: "Are respirable dust levels monitored and within DGMS permissible limits at crusher/packing?", requirement_reference: "DGMS / Mines Act, Factories Act §41-F", criticality: "critical" }),
      cp({ code: "CE-DG-002", question: "Are bag filters and dust extraction systems operational across transfer points?", standard: "ISO 14001", criticality: "major" }),
      cp({ code: "CE-DG-003", question: "Are workers in dust-prone zones provided and using N95/FFP2 respirators?", linked_safeops_module: "ppe", criticality: "major" }),
      cp({ code: "CE-DG-004", question: "Is periodic medical examination (PME) for dust-exposed workers up to date?", requirement_reference: "DGMS Vocational Training & PME Rules", linked_safeops_module: "training", criticality: "major" }),
      cp({ code: "CE-DG-005", question: "Is silica/pneumoconiosis surveillance documented for long-service workers?", criticality: "major" }),
    ],
  },
  {
    category_code: "QUARRY-BLAST", category_name: "Limestone Quarry & Blasting", category_color: "#92400E", category_icon: "mountain", sequence: 3,
    checkpoints: [
      cp({ code: "CE-QB-001", question: "Are blasting operations conducted by licensed blasters with PESO-approved explosives storage?", requirement_reference: "Explosives Rules 2008, DGMS", criticality: "critical" }),
      cp({ code: "CE-QB-002", question: "Are bench heights, slope angles, and haul roads compliant with the approved mine plan?", requirement_reference: "Metalliferous Mines Regulations", criticality: "major" }),
      cp({ code: "CE-QB-003", question: "Is the danger-zone clearance and siren protocol followed before every blast?", criticality: "critical" }),
      cp({ code: "CE-QB-004", question: "Are HEMM operators (dumpers, excavators) DGMS-certified and fit?", linked_safeops_module: "skill_matrix", criticality: "major" }),
    ],
  },
  {
    category_code: "PRESSURE-HT", category_name: "Pressure Vessels & HT Electrical", category_color: "#F59E0B", category_icon: "zap", sequence: 4,
    checkpoints: [
      cp({ code: "CE-PH-001", question: "Are compressors, air receivers, and pressure vessels within IBR/statutory inspection validity?", linked_safeops_module: "inspection", criticality: "critical" }),
      cp({ code: "CE-PH-002", question: "Are HT switchyard and substation access controls, earthing, and PPE (arc flash) in place?", linked_safeops_module: "ppe", criticality: "critical" }),
      cp({ code: "CE-PH-003", question: "Is HT line work done under sanctioned electrical permit with discharge rods?", linked_safeops_module: "ptw", criticality: "major" }),
    ],
  },
  {
    category_code: "ENV-CEMENT", category_name: "Environmental & Stack Emissions", category_color: "#14B8A6", category_icon: "leaf", sequence: 5,
    checkpoints: [
      cp({ code: "CE-EN-001", question: "Are CEMS stack emissions (PM, SOx, NOx) within CPCB-consented limits and telemetered?", requirement_reference: "CPCB CEMS, Consent to Operate", standard: "ISO 14001", criticality: "critical" }),
      cp({ code: "CE-EN-002", question: "Is AFR (alternative fuel) co-processing within authorised hazardous-waste limits?", standard: "ISO 14001", criticality: "major" }),
      cp({ code: "CE-EN-003", question: "Is ambient air quality monitoring (AAQM) data maintained and reported?", standard: "ISO 14001", criticality: "minor" }),
    ],
  },
];

// ── STEEL & METALS library ──
const STEEL_CATEGORIES: Category[] = [
  {
    category_code: "HOT-METAL", category_name: "Hot Metal & Molten Safety", category_color: "#DC2626", category_icon: "flame", sequence: 1,
    checkpoints: [
      cp({ code: "ST-HM-001", question: "Are molten-metal handling areas free of moisture/water ingress (explosion risk)?", criticality: "critical" }),
      cp({ code: "ST-HM-002", question: "Are ladle, tundish, and torpedo car operations done with aluminised PPE and heat shields?", linked_safeops_module: "ppe", criticality: "critical" }),
      cp({ code: "ST-HM-003", question: "Is the runner/casting area access controlled during tapping?", criticality: "major" }),
      cp({ code: "ST-HM-004", question: "Are gas cutting and slag handling procedures followed with fume controls?", criticality: "major" }),
    ],
  },
  {
    category_code: "CRANE-LIFT", category_name: "Crane & Lifting Operations", category_color: "#EA580C", category_icon: "move-up", sequence: 2,
    checkpoints: [
      cp({ code: "ST-CL-001", question: "Are EOT cranes, slings, and lifting tackle within statutory test validity (Form 11)?", requirement_reference: "Factories Act, Form 11", linked_safeops_module: "inspection", criticality: "critical" }),
      cp({ code: "ST-CL-002", question: "Are crane operators and riggers competency-certified with no-go zones enforced?", linked_safeops_module: "skill_matrix", criticality: "major" }),
      cp({ code: "ST-CL-003", question: "Is the SWL marked and load charts available at every lifting point?", criticality: "major" }),
    ],
  },
  {
    category_code: "GAS-CONFINED", category_name: "Gas Hazards & Confined Space", category_color: "#0891B2", category_icon: "alert-octagon", sequence: 3,
    checkpoints: [
      cp({ code: "ST-GC-001", question: "Are CO/BF-gas monitoring and personal gas detectors used in gas-prone areas?", criticality: "critical" }),
      cp({ code: "ST-GC-002", question: "Are confined-space entries (ladles, ducts, bunkers) gas-tested and permit-controlled?", linked_safeops_module: "ptw", criticality: "critical" }),
      cp({ code: "ST-GC-003", question: "Is the gas-line isolation and blanking procedure followed for maintenance?", criticality: "major" }),
    ],
  },
  {
    category_code: "ELEC-ARC-ST", category_name: "Electrical & Arc Flash", category_color: "#F59E0B", category_icon: "zap", sequence: 4,
    checkpoints: [
      cp({ code: "ST-EA-001", question: "Are arc-flash boundaries marked and arc-rated PPE used on HT/EAF panels?", linked_safeops_module: "ppe", criticality: "critical" }),
      cp({ code: "ST-EA-002", question: "Is earthing of furnaces and large drives tested and recorded?", criticality: "major" }),
    ],
  },
];

// ── CHEMICAL PROCESS library ──
const CHEMICAL_CATEGORIES: Category[] = [
  {
    category_code: "MAH-PSM", category_name: "MAH & Process Safety", category_color: "#7C3AED", category_icon: "shield-alert", sequence: 1,
    checkpoints: [
      cp({ code: "CH-PS-001", question: "Is the facility's MAH status assessed and on-site/off-site emergency plans current?", requirement_reference: "MSIHC Rules 1989, MAH", criticality: "critical" }),
      cp({ code: "CH-PS-002", question: "Are HAZOP/PHA studies current for all process units with actions closed?", linked_safeops_module: "hira", criticality: "critical" }),
      cp({ code: "CH-PS-003", question: "Are safety-instrumented systems (SIS/interlocks) tested and bypass-controlled?", criticality: "critical" }),
      cp({ code: "CH-PS-004", question: "Is the Management of Change process followed for process modifications?", linked_safeops_module: "moc", criticality: "major" }),
    ],
  },
  {
    category_code: "HAZCHEM", category_name: "Chemical Storage (HAZCHEM)", category_color: "#10B981", category_icon: "flask", sequence: 2,
    checkpoints: [
      cp({ code: "CH-HC-001", question: "Are incompatible chemicals segregated with secondary containment and HAZCHEM signage?", criticality: "critical" }),
      cp({ code: "CH-HC-002", question: "Are SDS available and tank farm dyke capacity ≥110% of largest tank?", criticality: "major" }),
      cp({ code: "CH-HC-003", question: "Is the loading/unloading area earthed with spill controls and eye-wash/safety showers?", criticality: "major" }),
    ],
  },
  {
    category_code: "ATEX-AREA", category_name: "ATEX / Hazardous Area", category_color: "#F97316", category_icon: "zap", sequence: 3,
    checkpoints: [
      cp({ code: "CH-AT-001", question: "Are electrical fittings in classified zones flameproof/intrinsically-safe and certified?", requirement_reference: "PESO, IS/IEC 60079", criticality: "critical" }),
      cp({ code: "CH-AT-002", question: "Is the hazardous-area classification drawing current and earthing/bonding verified?", criticality: "major" }),
    ],
  },
  {
    category_code: "EMERGENCY-CH", category_name: "Emergency Response", category_color: "#EF4444", category_icon: "siren", sequence: 4,
    checkpoints: [
      cp({ code: "CH-ER-001", question: "Are gas detectors, scrubbers, and toxic-release alarms functional and tested?", criticality: "critical" }),
      cp({ code: "CH-ER-002", question: "Are mock drills for toxic release / fire conducted and gaps closed?", linked_safeops_module: "incident", criticality: "major" }),
      cp({ code: "CH-ER-003", question: "Is the ETP discharge within consented limits with online monitoring?", linked_safeops_module: "eai", standard: "ISO 14001", criticality: "major" }),
    ],
  },
];

function countCheckpoints(cats: Category[]): number {
  return cats.reduce((n, c) => n + c.checkpoints.length, 0);
}

// ── Materialize response rows for a demo audit (mirrors backend create) ───
type SeededResponse = Prisma.AuditCheckpointResponseCreateManyAuditInput;

function materialize(cats: Category[], routedTo: string | null): SeededResponse[] {
  const rows: SeededResponse[] = [];
  let seq = 0;
  for (const cat of cats) {
    for (const c of cat.checkpoints) {
      seq += 1;
      rows.push({
        plantId: "", // set by caller
        checkpointCode: c.code,
        checkpointQuestion: c.question,
        guidance: c.guidance ?? "",
        requirementReference: c.requirement_reference ?? "",
        standard: c.standard ?? "",
        categoryId: cat.category_code,
        categoryName: cat.category_name,
        categoryColor: cat.category_color,
        criticality: c.criticality,
        responseType: c.response_type ?? "pass_partial_fail",
        sequence: seq,
        requiresPhotoOnFail: !!c.requires_photo_on_fail,
        autoTriggerCapaOnFail: !!c.auto_trigger_capa_on_fail,
        capaSeverity: c.capa_severity_if_triggered ?? null,
        linkedSafeopsModule: c.linked_safeops_module ?? null,
        routedToUserId: routedTo,
        overallStatus: "not_answered",
      });
    }
  }
  return rows;
}

// Deterministic value picker: ~80% pass, ~10% partial, ~7% fail, ~3% na.
function pickValue(i: number): "pass" | "partial" | "fail" | "na" {
  const m = i % 13;
  if (m === 3 || m === 9) return "fail";
  if (m === 6) return "partial";
  if (m === 11) return "na";
  return "pass";
}

function normForScore(v: string | null): string | null {
  if (v === "pass" || v === "yes") return "pass";
  if (v === "partial") return "partial";
  if (v === "fail" || v === "no") return "fail";
  if (v === "na") return "na";
  return null;
}

function computeScore(rows: SeededResponse[]) {
  let passed = 0, partial = 0, failed = 0, na = 0, answered = 0, crit = 0;
  const catMap = new Map<string, any>();
  for (const r of rows) {
    const val = normForScore((r.auditorResponse as any)?.value ?? null);
    const cat = catMap.get(r.categoryId) ?? { category_id: r.categoryId, category_name: r.categoryName, total: 0, passed: 0, partial: 0, failed: 0, na: 0 };
    cat.total += 1;
    if (val) {
      answered += 1;
      if (val === "pass") { passed += 1; cat.passed += 1; }
      else if (val === "partial") { partial += 1; cat.partial += 1; }
      else if (val === "fail") { failed += 1; cat.failed += 1; if (r.criticality === "critical") crit += 1; }
      else if (val === "na") { na += 1; cat.na += 1; }
    }
    catMap.set(r.categoryId, cat);
  }
  const assessable = passed + partial + failed;
  const overall = assessable ? Math.round(((passed + 0.5 * partial) / assessable) * 1000) / 10 : 0;
  const category_scores = [...catMap.values()].map((c) => {
    const a = c.passed + c.partial + c.failed;
    c.score_pct = a ? Math.round(((c.passed + 0.5 * c.partial) / a) * 1000) / 10 : 0;
    return c;
  });
  return {
    total_checkpoints: rows.length, answered, passed, partially_passed: partial, failed, not_applicable: na,
    overall_score_pct: overall, category_scores, critical_failures: crit,
    major_failures: 0, minor_failures: 0, audit_passed: crit === 0 && overall >= 80,
  };
}

async function main() {
  console.log("Seeding Audit & Compliance…");

  // Idempotent wipe (responses cascade from audits, but clear explicitly).
  await prisma.auditCheckpointResponse.deleteMany({});
  await prisma.complianceAudit.deleteMany({});
  await prisma.auditTemplate.deleteMany({});
  await prisma.auditCheckpointLibrary.deleteMany({});

  // ── Libraries ──
  await prisma.auditCheckpointLibrary.createMany({
    data: [
      { industryCode: "GARMENTS_TEXTILE", industryName: "Garments, Textile & Apparel Manufacturing", version: "2026.1", categories: GARMENTS_CATEGORIES as any, checkpointCount: countCheckpoints(GARMENTS_CATEGORIES) },
      { industryCode: "CEMENT", industryName: "Cement & Building Materials", version: "2026.1", categories: CEMENT_CATEGORIES as any, checkpointCount: countCheckpoints(CEMENT_CATEGORIES) },
      { industryCode: "STEEL_METALS", industryName: "Steel, Metals & Foundry", version: "2026.1", categories: STEEL_CATEGORIES as any, checkpointCount: countCheckpoints(STEEL_CATEGORIES) },
      { industryCode: "CHEMICAL_PROCESS", industryName: "Chemical & Process Industries", version: "2026.1", categories: CHEMICAL_CATEGORIES as any, checkpointCount: countCheckpoints(CHEMICAL_CATEGORIES) },
      { industryCode: "MANUFACTURING_GENERIC", industryName: "General Manufacturing", version: "2026.1", categories: MANUFACTURING_CATEGORIES as any, checkpointCount: countCheckpoints(MANUFACTURING_CATEGORIES) },
      { industryCode: "PHARMA_LIFE_SCIENCES", industryName: "Pharmaceutical & Life Sciences", version: "2026.1", categories: PHARMA_CATEGORIES as any, checkpointCount: countCheckpoints(PHARMA_CATEGORIES) },
    ],
  });
  console.log(`  libraries: GARMENTS(${countCheckpoints(GARMENTS_CATEGORIES)}) CEMENT(${countCheckpoints(CEMENT_CATEGORIES)}) STEEL(${countCheckpoints(STEEL_CATEGORIES)}) CHEMICAL(${countCheckpoints(CHEMICAL_CATEGORIES)}) MANUFACTURING(${countCheckpoints(MANUFACTURING_CATEGORIES)}) PHARMA(${countCheckpoints(PHARMA_CATEGORIES)})`);

  // ── Templates ──
  const fireCodes = GARMENTS_CATEGORIES[0].checkpoints.map((c) => c.code);
  const welfareCodes = GARMENTS_CATEGORIES[1].checkpoints.map((c) => c.code);
  const tFull = await prisma.auditTemplate.create({
    data: {
      name: "SA8000 + ISO 45001 Integrated Audit — Garments", description: "Full integrated social-compliance + OH&S audit across all 10 categories.",
      auditType: "sa8000_iso45001_integrated", baseIndustry: "GARMENTS_TEXTILE",
      checkpointConfiguration: { mode: "all" } as any,
      scoring: { method: "percentage", critical_fail_auto_fails_audit: true, minimum_pass_score: 80 } as any,
      workflow: { auditee_response_sla_days: 7, plant_manager_approval_required: true } as any,
    },
  });
  await prisma.auditTemplate.create({
    data: {
      name: "Fire Safety Focused Audit — Garments", description: "Rapid fire & emergency-preparedness audit.",
      auditType: "fire_safety_audit", baseIndustry: "GARMENTS_TEXTILE",
      checkpointConfiguration: { mode: "subset", codes: fireCodes } as any,
      scoring: { method: "percentage", critical_fail_auto_fails_audit: true, minimum_pass_score: 90 } as any,
    },
  });
  await prisma.auditTemplate.create({
    data: {
      name: "Worker Welfare & Social Compliance — Garments", description: "SA8000-aligned worker welfare audit.",
      auditType: "worker_welfare", baseIndustry: "GARMENTS_TEXTILE",
      checkpointConfiguration: { mode: "subset", codes: welfareCodes } as any,
      scoring: { method: "percentage", critical_fail_auto_fails_audit: true, minimum_pass_score: 85 } as any,
    },
  });
  console.log("  templates: 3");

  // ── Resolve plants + personas ──
  const nw = await prisma.plant.findFirst({ where: { code: "NW" } });
  const sw = await prisma.plant.findFirst({ where: { code: "SW" } });
  if (!nw) throw new Error("NW plant not found — run base seed first");

  const nwUsers = await prisma.user.findMany({ where: { plantId: nw.id }, select: { id: true, name: true, role: true } });
  const lead = nwUsers.find((u) => u.name === "Priya Nair") ?? nwUsers[0];
  const pm = nwUsers.find((u) => u.role === "PLANT_HEAD") ?? nwUsers[1] ?? lead;
  const auditeeA = nwUsers.find((u) => u.id !== lead.id && u.id !== pm.id) ?? lead;
  const auditeeB = nwUsers.find((u) => u.id !== lead.id && u.id !== pm.id && u.id !== auditeeA.id) ?? auditeeA;

  // Route fire/machine/electrical to auditeeA; welfare/training to auditeeB.
  const auditees = [
    { userId: auditeeA.id, responsibleCategories: ["FIRE-LIFE-SAFETY", "MACHINE-SAFETY", "ELECTRICAL-SAFETY", "CHEMICAL-HAZMAT", "PPE-COMPLIANCE", "HOUSEKEEPING-ERGONOMICS"] },
    { userId: auditeeB.id, responsibleCategories: ["WORKER-WELFARE", "TRAINING-COMPETENCY", "INCIDENT-NEAR-MISS", "ENVIRONMENTAL-COMPLIANCE"] },
  ];

  function routeFor(catCode: string): string | null {
    for (const a of auditees) if (a.responsibleCategories.includes(catCode)) return a.userId;
    return null;
  }

  const year = 2026;
  const nowIso = new Date("2026-06-11T04:00:00.000Z");

  async function makeAudit(opts: {
    seq: number; plantId: string; title: string; status: string; scheduledDate: Date;
    answeredFraction: number; computeFinal: boolean; submitted?: boolean; closed?: boolean;
  }) {
    const rows = materialize(GARMENTS_CATEGORIES, null).map((r) => ({ ...r, plantId: opts.plantId, routedToUserId: routeFor(r.categoryId) }));
    // Pre-fill auditor responses up to answeredFraction.
    const answerN = Math.floor(rows.length * opts.answeredFraction);
    let crit = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (i < answerN) {
        const val = pickValue(i);
        r.auditorResponse = {
          value: val, numeric_value: null, selected_options: null,
          text_observation: val === "fail" ? "Non-conformance observed during walkthrough." : val === "partial" ? "Partially compliant — minor gaps." : "Verified compliant.",
          auditor_notes: "", photos: [], evidence_links: [], responded_at: nowIso.toISOString(), is_saved: true,
        } as any;
        const nv = normForScore(val);
        r.overallStatus = nv ? `answered_${nv}` : "not_answered";
        r.answeredAt = nowIso;
        if (opts.submitted && (val === "fail" || val === "partial")) {
          r.overallStatus = "pending_auditee";
        }
        if (val === "fail" && r.criticality === "critical") crit += 1;
      }
    }
    const score = computeScore(rows);
    const audit = await prisma.complianceAudit.create({
      data: {
        auditNumber: `AUD-GT-${year}-${opts.plantId === nw!.id ? "NW" : "SW"}-${String(opts.seq).padStart(4, "0")}`,
        title: opts.title, plantId: opts.plantId, templateId: tFull.id, industryCode: "GARMENTS_TEXTILE",
        auditType: "sa8000_iso45001_integrated",
        scopeDepartments: ["Cutting", "Sewing", "Finishing", "Stores"] as any, scopeAreas: ["Production Floor 1", "Dye House"] as any,
        scopeDescription: "Integrated SA8000 + ISO 45001 internal audit.",
        scheduledDate: opts.scheduledDate, scheduledStartTime: "09:00", estimatedDurationHours: 4,
        leadAuditorUserId: lead.id, coAuditors: [] as any, auditees: auditees as any, plantManagerUserId: pm.id,
        status: opts.status,
        actualStartAt: opts.answeredFraction > 0 ? opts.scheduledDate : null,
        actualEndAt: opts.closed || opts.submitted ? nowIso : null,
        submittedAt: opts.submitted || opts.closed ? nowIso : null,
        closedAt: opts.closed ? nowIso : null,
        score: opts.computeFinal ? (score as any) : Prisma.JsonNull,
        totalCheckpoints: rows.length, answeredCheckpoints: answerN,
        overallCompliancePct: opts.computeFinal ? score.overall_score_pct : null,
        auditPassed: opts.computeFinal ? score.audit_passed : null,
        criticalFailureCount: opts.computeFinal ? score.critical_failures : 0,
        openCapaCount: 0,
        openingRemarks: "Audit opened with plant management. Scope and methodology confirmed.",
        closingRemarks: opts.closed ? "All findings reviewed; corrective actions agreed. Audit closed." : "",
        createdByUserId: lead.id,
        responses: { createMany: { data: rows } },
      },
    });
    return audit;
  }

  await makeAudit({ seq: 1, plantId: nw.id, title: "Q2 Integrated Audit — North Works (In Progress)", status: "in_progress", scheduledDate: new Date("2026-06-09T03:30:00.000Z"), answeredFraction: 0.55, computeFinal: false });
  await makeAudit({ seq: 2, plantId: nw.id, title: "SA8000 Mid-Year Audit — North Works (Awaiting Responses)", status: "submitted_pending_response", scheduledDate: new Date("2026-06-02T03:30:00.000Z"), answeredFraction: 1.0, computeFinal: true, submitted: true });
  await makeAudit({ seq: 3, plantId: nw.id, title: "Q1 Integrated Audit — North Works (Closed)", status: "closed", scheduledDate: new Date("2026-03-12T03:30:00.000Z"), answeredFraction: 1.0, computeFinal: true, closed: true });
  if (sw) {
    await makeAudit({ seq: 1, plantId: sw.id, title: "Q2 Integrated Audit — South Works (Scheduled)", status: "scheduled", scheduledDate: new Date("2026-06-20T03:30:00.000Z"), answeredFraction: 0, computeFinal: false });
  }

  console.log("  demo audits: 4 (in_progress, submitted, closed, scheduled)");
  console.log("✅  Audit & Compliance seed complete.");
}

main()
  .catch((e) => { console.error("❌ seed-audit-compliance failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
