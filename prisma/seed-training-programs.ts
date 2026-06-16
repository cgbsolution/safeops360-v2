// ────────────────────────────────────────────────────────────────────────
// Seeds 25+ realistic paper-mill training programs.
// Idempotent: re-running upserts on programCode.
//
// Coverage:
//   • Statutory & Mandatory (Factories Act 7A) — 5
//   • Permit Holder Trainings — 5
//   • Specialized Roles — 5
//   • Equipment & Process — 4
//   • Behavioural & Leadership — 4
//   • Emergency — 3
//
// SafeOps gates wired:
//   • blocksPtwIfMissing — hot work, confined space, height, electrical
//   • blocksRoleAssignmentIfMissing — induction, basic safety
//   • blocksContractorOnboardingIfMissing — contractor induction
//
// Run: npx tsx prisma/seed-training-programs.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ProgramSeed = {
  programCode: string;
  programName: string;
  description: string;
  category:
    | "INDUCTION"
    | "TECHNICAL"
    | "BEHAVIOURAL"
    | "STATUTORY"
    | "EMERGENCY"
    | "LEADERSHIP"
    | "COMPLIANCE"
    | "REFRESHER";
  type:
    | "CLASSROOM"
    | "E_LEARNING"
    | "ON_JOB"
    | "BLENDED"
    | "CERTIFICATION"
    | "WORKSHOP"
    | "DRILL";
  isStatutory?: boolean;
  statutoryReference?: string;
  isMandatoryForRoles?: string[];
  isMandatoryForPermitTypes?: string[];
  durationHours: number;
  durationSessions?: number;
  certificateValidityMonths: number | null;
  blocksPtwIfMissing?: boolean;
  blocksRoleAssignmentIfMissing?: boolean;
  blocksContractorOnboardingIfMissing?: boolean;
  hasAssessment?: boolean;
  passingScorePercent?: number;
  refresherProgramCode?: string;
  language?: string[];
  learningObjectives?: string[];
};

const PROGRAMS: ProgramSeed[] = [
  // ─── Statutory & Mandatory ────────────────────────────────────────
  {
    programCode: "INDUCTION_GENERAL",
    programName: "Plant Induction (General)",
    description:
      "Mandatory induction covering plant layout, emergency response, gate procedures, basic safety rules, and reporting channels.",
    category: "INDUCTION",
    type: "CLASSROOM",
    isStatutory: true,
    statutoryReference: "Factories Act 1948 Section 7A",
    isMandatoryForRoles: [
      "WORKER",
      "SUPERVISOR",
      "PERMIT_ISSUER",
      "SAFETY_OFFICER",
      "MAINTENANCE_HEAD",
      "DEPARTMENT_HEAD"
    ],
    durationHours: 8,
    certificateValidityMonths: null, // lifetime
    hasAssessment: true,
    passingScorePercent: 70,
    blocksRoleAssignmentIfMissing: true,
    language: ["English", "Hindi"],
    learningObjectives: [
      "Identify plant emergency assembly points and evacuation routes",
      "Recognise basic safety signs and PPE requirements",
      "Know how to report hazards and near-misses",
      "Understand plant gate-pass and entry procedures"
    ]
  },
  {
    programCode: "INDUCTION_CONTRACTOR",
    programName: "Contractor Workman Induction",
    description:
      "Mandatory induction for every contractor workman before gate pass issuance. Covers contractor-specific rules, PPE, work-permit basics, and incident reporting.",
    category: "INDUCTION",
    type: "CLASSROOM",
    isStatutory: true,
    statutoryReference: "Factories Act 1948 Section 7A; Contract Labour Act",
    isMandatoryForRoles: ["CONTRACTOR_WORKMAN"],
    durationHours: 4,
    certificateValidityMonths: 12,
    hasAssessment: true,
    passingScorePercent: 70,
    blocksContractorOnboardingIfMissing: true,
    refresherProgramCode: "INDUCTION_CONTRACTOR",
    language: ["English", "Hindi"],
    learningObjectives: [
      "Understand contractor's responsibilities under the safety policy",
      "Identify the required PPE for the contractor's scope of work",
      "Know how to escalate hazards through the contractor coordinator"
    ]
  },
  {
    programCode: "BASIC_SAFETY",
    programName: "Basic Safety Training (Section 7A)",
    description:
      "Statutory training under Factories Act 7A covering hazard identification, control hierarchy, PPE, manual handling, and emergency response.",
    category: "STATUTORY",
    type: "CLASSROOM",
    isStatutory: true,
    statutoryReference: "Factories Act 1948 Section 7A",
    isMandatoryForRoles: [
      "WORKER",
      "CONTRACTOR_WORKMAN",
      "SUPERVISOR",
      "PERMIT_ISSUER"
    ],
    durationHours: 16,
    durationSessions: 2,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 70,
    refresherProgramCode: "BASIC_SAFETY_REFRESHER",
    blocksRoleAssignmentIfMissing: true,
    language: ["English", "Hindi"]
  },
  {
    programCode: "FIRE_SAFETY",
    programName: "Fire Safety & Use of Extinguishers",
    description:
      "Hands-on training on fire classes, extinguisher selection, and practical use of CO2 / DCP / foam extinguishers.",
    category: "EMERGENCY",
    type: "BLENDED",
    isStatutory: true,
    statutoryReference: "Factories Act 1948; National Building Code Part 4",
    durationHours: 4,
    certificateValidityMonths: 12,
    hasAssessment: true,
    passingScorePercent: 70,
    refresherProgramCode: "FIRE_SAFETY",
    language: ["English", "Hindi"]
  },
  {
    programCode: "FIRST_AID",
    programName: "First Aid",
    description:
      "St. John Ambulance certified first-aid training covering CPR, bleeding control, fractures, burns, electric shock, and chemical exposure.",
    category: "STATUTORY",
    type: "CERTIFICATION",
    isStatutory: true,
    statutoryReference: "Factories Act 1948 Section 45",
    durationHours: 8,
    certificateValidityMonths: 36,
    hasAssessment: true,
    passingScorePercent: 70,
    refresherProgramCode: "FIRST_AID",
    language: ["English", "Hindi"]
  },

  // ─── Permit Holder Trainings (PTW gate enforcement) ─────────────────
  {
    programCode: "PTW_HOT_WORK_HOLDER",
    programName: "Hot Work Permit Holder",
    description:
      "Required for any worker added as crew on a Hot Work permit. Covers welding/cutting hazards, fire watch responsibilities, hot-work area preparation, and gas testing basics.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    isMandatoryForPermitTypes: ["HOT_WORK"],
    durationHours: 8,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 80,
    blocksPtwIfMissing: true,
    refresherProgramCode: "PTW_HOT_WORK_HOLDER",
    language: ["English", "Hindi"],
    learningObjectives: [
      "Identify hot-work hazards in pulp & paper mill operations",
      "Establish a hot-work area: cleaning, screens, fire watch",
      "Verify the area is gas-free before starting hot work",
      "Respond to a hot-work incident within the first 60 seconds"
    ]
  },
  {
    programCode: "PTW_CONFINED_SPACE_HOLDER",
    programName: "Confined Space Entry",
    description:
      "Required for any worker entering a confined space (digesters, stock chests, towers, tanks, lime kiln). Covers atmospheric testing, ventilation, rescue planning, and entry/exit logging.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    isMandatoryForPermitTypes: ["CONFINED_SPACE"],
    durationHours: 16,
    durationSessions: 2,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 80,
    blocksPtwIfMissing: true,
    refresherProgramCode: "PTW_CONFINED_SPACE_HOLDER",
    language: ["English", "Hindi"]
  },
  {
    programCode: "PTW_HEIGHT_HOLDER",
    programName: "Work at Height",
    description:
      "Required for any worker performing work above 1.8m. Covers fall hazards, harness selection and inspection, anchor points, and rescue at height.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    isMandatoryForPermitTypes: ["WORK_AT_HEIGHT"],
    durationHours: 8,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 80,
    blocksPtwIfMissing: true,
    refresherProgramCode: "PTW_HEIGHT_HOLDER",
    language: ["English", "Hindi"]
  },
  {
    programCode: "PTW_EXCAVATION_HOLDER",
    programName: "Excavation Safety",
    description:
      "Required for any worker performing excavation deeper than 1.2m. Covers underground utility detection, shoring, sloping, and trench rescue.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    isMandatoryForPermitTypes: ["EXCAVATION"],
    durationHours: 8,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 80,
    blocksPtwIfMissing: true,
    language: ["English", "Hindi"]
  },
  {
    programCode: "PTW_ELECTRICAL_HOLDER",
    programName: "Electrical Safety & Lockout/Tagout",
    description:
      "Required for any worker performing electrical work. Covers shock/arc-flash hazards, isolation, LOTO procedure, voltage verification, and HT switching.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    isMandatoryForPermitTypes: ["ELECTRICAL_LOTO"],
    durationHours: 16,
    durationSessions: 2,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 80,
    blocksPtwIfMissing: true,
    refresherProgramCode: "PTW_ELECTRICAL_HOLDER",
    language: ["English", "Hindi"]
  },

  // ─── Specialized Roles ────────────────────────────────────────────
  {
    programCode: "FIRE_WATCH",
    programName: "Fire Watch Person",
    description:
      "Certifies competence as a Fire Watch during hot work. Covers fire detection, immediate response, communication protocols, and the 30-minute post-work observation.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    durationHours: 4,
    certificateValidityMonths: 12,
    hasAssessment: true,
    passingScorePercent: 80,
    refresherProgramCode: "FIRE_WATCH",
    language: ["English", "Hindi"]
  },
  {
    programCode: "CONFINED_SPACE_STANDBY",
    programName: "Confined Space Standby Person",
    description:
      "Certifies competence as a Confined Space Standby (Attendant). Covers continuous communication, atmospheric monitoring, rescue activation, and entry/exit logging.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    durationHours: 8,
    certificateValidityMonths: 12,
    hasAssessment: true,
    passingScorePercent: 80,
    language: ["English", "Hindi"]
  },
  {
    programCode: "GAS_TESTER",
    programName: "Authorized Gas Tester",
    description:
      "Certifies competence to perform pre-entry and refresh gas testing. Covers 4-gas monitor calibration, sampling strategy, interpretation of readings, and limits.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    durationHours: 16,
    durationSessions: 2,
    certificateValidityMonths: 12,
    hasAssessment: true,
    passingScorePercent: 85,
    refresherProgramCode: "GAS_TESTER",
    language: ["English", "Hindi"]
  },
  {
    programCode: "RIGGER",
    programName: "Authorized Rigger",
    description:
      "Certifies competence in rigging and load-handling for crane operations. Covers sling selection, lift planning, signaling, and load stability.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    durationHours: 24,
    durationSessions: 3,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 80,
    refresherProgramCode: "RIGGER",
    language: ["English", "Hindi"]
  },
  {
    programCode: "SCAFFOLDER",
    programName: "Authorized Scaffolder",
    description:
      "Certifies competence to erect, modify, and dismantle scaffolds per IS 4014. Covers scaffold types, load capacity, tie-ins, and inspection.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    durationHours: 40,
    durationSessions: 5,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 80,
    refresherProgramCode: "SCAFFOLDER",
    language: ["English", "Hindi"]
  },

  // ─── Equipment & Process ──────────────────────────────────────────
  {
    programCode: "CRANE_OPERATOR",
    programName: "Crane Operator Certification",
    description:
      "Certifies competence to operate overhead, mobile, and tower cranes. Covers pre-operation checks, load calculation, environmental limits, and emergency lowering.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    durationHours: 40,
    durationSessions: 5,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 85,
    refresherProgramCode: "CRANE_OPERATOR",
    language: ["English", "Hindi"]
  },
  {
    programCode: "FORKLIFT_OPERATOR",
    programName: "Forklift Operator",
    description:
      "Certifies competence to operate forklifts and material-handling equipment. Covers pre-shift checks, load stability, pedestrian safety, and battery handling.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    durationHours: 16,
    durationSessions: 2,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 80,
    refresherProgramCode: "FORKLIFT_OPERATOR",
    language: ["English", "Hindi"]
  },
  {
    programCode: "PROCESS_EQUIPMENT_SAFETY",
    programName: "Process Equipment Safety — Operators",
    description:
      "Specialized safety training for process equipment operators covering hazardous energy, pressure systems, hot dryer surfaces, recovery-boiler smelt-water hazards, emergency shutdown procedures, and safe start-up / shutdown sequences.",
    category: "TECHNICAL",
    type: "BLENDED",
    durationHours: 40,
    durationSessions: 5,
    certificateValidityMonths: 36,
    hasAssessment: true,
    passingScorePercent: 80,
    language: ["English", "Hindi"],
    learningObjectives: [
      "Identify energy isolation requirements for process equipment",
      "Recognise overpressure, thermal, and mechanical hazards",
      "Execute emergency shutdown procedures correctly",
      "Conduct pre-startup safety checks per plant SOP"
    ]
  },
  {
    programCode: "ELECTRICAL_HT",
    programName: "HT Electrical Operations (11kV / 33kV)",
    description:
      "Authorisation training for HT electrical operations. Covers 11kV/33kV switching, two-source isolation, earthing, and arc-flash PPE.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    durationHours: 16,
    durationSessions: 2,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 85,
    language: ["English"]
  },

  // ─── Behavioural & Leadership ─────────────────────────────────────
  {
    programCode: "BBS_OBSERVER",
    programName: "Behaviour-Based Safety Observer",
    description:
      "Trains supervisors to conduct BBS observations, give effective feedback, and capture observation data in the BBS module.",
    category: "BEHAVIOURAL",
    type: "WORKSHOP",
    durationHours: 8,
    certificateValidityMonths: 12,
    hasAssessment: true,
    passingScorePercent: 70,
    language: ["English", "Hindi"]
  },
  {
    programCode: "INCIDENT_INVESTIGATOR",
    programName: "Incident Investigation & Root Cause Analysis",
    description:
      "Trains HSE personnel and supervisors in 5-Why, Fishbone, and TapRoot RCA methods. Includes mock investigations from pulp & paper mill incidents.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    durationHours: 24,
    durationSessions: 3,
    certificateValidityMonths: 36,
    hasAssessment: true,
    passingScorePercent: 75,
    language: ["English"]
  },
  {
    programCode: "HSE_LEADERSHIP",
    programName: "HSE Leadership for Supervisors",
    description:
      "Develops safety leadership capability in supervisors and team leads. Covers safety culture, behaviour change, intervention, and coaching.",
    category: "LEADERSHIP",
    type: "WORKSHOP",
    durationHours: 16,
    durationSessions: 2,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 70,
    language: ["English", "Hindi"]
  },
  {
    programCode: "TBT_FACILITATOR",
    programName: "Toolbox Talk Facilitator",
    description:
      "Trains supervisors to conduct effective toolbox talks. Covers content selection, language, engagement, and FLRA-aligned briefings.",
    category: "BEHAVIOURAL",
    type: "WORKSHOP",
    durationHours: 4,
    certificateValidityMonths: 12,
    hasAssessment: false,
    language: ["English", "Hindi"]
  },

  // ─── Emergency ────────────────────────────────────────────────────
  {
    programCode: "EMERGENCY_RESPONSE",
    programName: "Emergency Response Team Member",
    description:
      "Certifies team members for the plant Emergency Response Team. Covers incident command, casualty management, communication, and drill participation.",
    category: "EMERGENCY",
    type: "CERTIFICATION",
    durationHours: 24,
    durationSessions: 3,
    certificateValidityMonths: 12,
    hasAssessment: true,
    passingScorePercent: 80,
    refresherProgramCode: "EMERGENCY_RESPONSE",
    language: ["English", "Hindi"]
  },
  {
    programCode: "ERT_FIRE",
    programName: "Fire Brigade Member",
    description:
      "Certifies fire brigade competence. Covers BA set use, fire-attack tactics, hose drills, ladder operations, and search-and-rescue.",
    category: "EMERGENCY",
    type: "CERTIFICATION",
    durationHours: 40,
    durationSessions: 5,
    certificateValidityMonths: 12,
    hasAssessment: true,
    passingScorePercent: 80,
    refresherProgramCode: "ERT_FIRE",
    language: ["English", "Hindi"]
  },
  {
    programCode: "ERT_MEDICAL",
    programName: "Medical First Responder",
    description:
      "Beyond first aid — trains responders to handle major casualties: trauma, burns, heat illness, chemical exposure. Includes triage and ambulance liaison.",
    category: "EMERGENCY",
    type: "CERTIFICATION",
    durationHours: 24,
    durationSessions: 3,
    certificateValidityMonths: 12,
    hasAssessment: true,
    passingScorePercent: 80,
    language: ["English", "Hindi"]
  },

  // ── Page Industries cross-industry set (File 7) — generic mandatory programs ──

  {
    programCode: "INDUCTION-GEN",
    programName: "General Safety Induction",
    description: "Mandatory induction covering plant layout, emergency response, basic safety rules, PPE requirements, and reporting channels. Applicable to all new joiners across any manufacturing sector.",
    category: "INDUCTION",
    type: "CLASSROOM",
    isStatutory: true,
    statutoryReference: "Factories Act 1948 Section 111A",
    isMandatoryForRoles: ["WORKER", "SUPERVISOR", "PERMIT_ISSUER", "SAFETY_OFFICER", "MAINTENANCE_HEAD", "DEPARTMENT_HEAD"],
    durationHours: 8,
    certificateValidityMonths: 12,
    hasAssessment: true,
    passingScorePercent: 70,
    blocksRoleAssignmentIfMissing: true,
    language: ["English", "Hindi"],
    learningObjectives: [
      "Identify plant emergency assembly points and evacuation routes",
      "Recognise basic safety signs and PPE requirements",
      "Know how to report hazards and near-misses",
      "Understand plant gate-pass and entry procedures"
    ]
  },
  {
    programCode: "PTW-HOLDER",
    programName: "Permit to Work — Awareness (All Staff)",
    description: "PTW awareness for all personnel who may work under or encounter a permit. Covers permit types, responsibilities of originator/issuer/receiver, and compliance obligations.",
    category: "COMPLIANCE",
    type: "CLASSROOM",
    isMandatoryForRoles: ["WORKER", "SUPERVISOR", "PERMIT_ISSUER", "MAINTENANCE_HEAD"],
    durationHours: 4,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 75,
    language: ["English", "Hindi"]
  },
  {
    programCode: "LOTO-AWARENESS",
    programName: "Lockout/Tagout Awareness",
    description: "Covers LOTO principles, energy forms, isolation points, personal lock procedures, and group LOTO for complex equipment.",
    category: "TECHNICAL",
    type: "CLASSROOM",
    isMandatoryForRoles: ["WORKER", "SUPERVISOR", "MAINTENANCE_HEAD"],
    durationHours: 4,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 80,
    language: ["English", "Hindi"]
  },
  {
    programCode: "CHEM-HANDLING",
    programName: "Chemical Handling and Hazard Communication (HAZCHEM)",
    description: "Covers SDS interpretation, HAZCHEM labels, chemical segregation, spill response, and regulatory requirements under GHS/MSDS.",
    category: "STATUTORY",
    type: "CLASSROOM",
    isMandatoryForRoles: ["WORKER", "SUPERVISOR"],
    durationHours: 6,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 75,
    language: ["English", "Hindi"]
  },
  {
    programCode: "FORKLIFT-SAFE",
    programName: "Forklift / MHE Safety",
    description: "Safety training for forklift and material-handling equipment operators and co-workers in shared spaces. Covers pre-shift checks, load stability, pedestrian segregation.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    isMandatoryForPermitTypes: ["FORKLIFT"],
    durationHours: 8,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 80,
    blocksPtwIfMissing: false,
    language: ["English", "Hindi"]
  },
  {
    programCode: "MANUAL-HANDLING",
    programName: "Safe Manual Handling Techniques",
    description: "Ergonomic principles for safe lifting, carrying, pushing, and pulling. Includes risk assessment of manual handling tasks.",
    category: "STATUTORY",
    type: "CLASSROOM",
    isMandatoryForRoles: ["WORKER", "CONTRACTOR_WORKMAN"],
    durationHours: 4,
    certificateValidityMonths: 36,
    hasAssessment: true,
    passingScorePercent: 70,
    language: ["English", "Hindi"]
  },
  {
    programCode: "ENVIRO-AWARENESS",
    programName: "Environmental Awareness and Legal Obligations",
    description: "Covers applicable environmental legislation (EPA, Water Act, Air Act, HW Rules), environmental aspects at the plant, incident reporting, and employee responsibilities.",
    category: "STATUTORY",
    type: "CLASSROOM",
    isStatutory: true,
    durationHours: 4,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 70,
    language: ["English", "Hindi"]
  },
  {
    programCode: "PPE-USAGE",
    programName: "Personal Protective Equipment — Selection and Use",
    description: "Covers PPE selection, fit testing, donning/doffing, inspection, maintenance, and disposal for all standard PPE categories.",
    category: "INDUCTION",
    type: "CLASSROOM",
    isMandatoryForRoles: ["WORKER", "CONTRACTOR_WORKMAN", "SUPERVISOR"],
    durationHours: 4,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 75,
    language: ["English", "Hindi"]
  },
  {
    programCode: "INCIDENT-REPORTING",
    programName: "Incident Reporting and Near Miss Reporting",
    description: "Covers definition of incidents/near misses, legal and company reporting obligations, how to use the reporting system, and no-blame culture.",
    category: "BEHAVIOURAL",
    type: "CLASSROOM",
    isMandatoryForRoles: ["WORKER", "CONTRACTOR_WORKMAN", "SUPERVISOR"],
    durationHours: 2,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 70,
    language: ["English", "Hindi"]
  },
  {
    programCode: "BBS-BEHAVIOURAL",
    programName: "Behavioural Based Safety (BBS)",
    description: "Trains observers in the STOP/ABCD BBS framework. Covers safe and at-risk behaviour identification, observation technique, positive reinforcement, and data entry.",
    category: "BEHAVIOURAL",
    type: "WORKSHOP",
    durationHours: 8,
    certificateValidityMonths: 36,
    hasAssessment: true,
    passingScorePercent: 70,
    language: ["English", "Hindi"]
  },
  {
    programCode: "STOP-WORK-AUTH",
    programName: "Stop Work Authority — Speaking Up for Safety",
    description: "Empowers all personnel to exercise stop work authority. Covers legal right, company policy, how to exercise SWA, and protection from retaliation.",
    category: "BEHAVIOURAL",
    type: "CLASSROOM",
    isMandatoryForRoles: ["WORKER", "CONTRACTOR_WORKMAN", "SUPERVISOR"],
    durationHours: 2,
    certificateValidityMonths: 24,
    hasAssessment: true,
    passingScorePercent: 70,
    language: ["English", "Hindi"]
  },
  {
    programCode: "ROAD-SAFETY",
    programName: "Road Safety and Defensive Driving",
    description: "Road safety and defensive driving for plant vehicle drivers. Covers journey planning, distraction, fatigue, load securing, and plant traffic rules.",
    category: "TECHNICAL",
    type: "CERTIFICATION",
    durationHours: 8,
    certificateValidityMonths: 36,
    hasAssessment: true,
    passingScorePercent: 70,
    language: ["English", "Hindi"]
  },
  {
    programCode: "CONTRACTOR-INDUCTION",
    programName: "Contractor Workman Site Induction",
    description: "Site-specific induction for contractor workmen before gate pass issuance. Covers contractor rules, PPE, work-permit basics, emergency contacts, and incident reporting.",
    category: "INDUCTION",
    type: "CLASSROOM",
    isStatutory: true,
    statutoryReference: "Factories Act 1948 Section 7A; Contract Labour (R&A) Act 1970",
    isMandatoryForRoles: ["CONTRACTOR_WORKMAN"],
    durationHours: 4,
    certificateValidityMonths: 12,
    hasAssessment: true,
    passingScorePercent: 70,
    blocksContractorOnboardingIfMissing: true,
    language: ["English", "Hindi"]
  }
];

async function main() {
  console.log(`Seeding ${PROGRAMS.length} training programs…`);
  let created = 0;
  let updated = 0;

  for (const p of PROGRAMS) {
    const validityMonths =
      p.certificateValidityMonths === null ? 999 : p.certificateValidityMonths; // legacy column NOT NULL
    const passing = p.passingScorePercent ?? 70;
    const isMandatoryLegacy =
      p.isStatutory ||
      (p.isMandatoryForRoles?.length ?? 0) > 0 ||
      (p.isMandatoryForPermitTypes?.length ?? 0) > 0;

    const existing = await prisma.trainingProgram.findUnique({
      where: { programCode: p.programCode }
    });

    const data = {
      // Legacy + canonical paired
      code: p.programCode,
      programCode: p.programCode,
      name: p.programName,
      programName: p.programName,
      description: p.description,
      category: p.category,
      type: p.type,
      isStatutory: p.isStatutory ?? false,
      statutoryReference: p.statutoryReference ?? null,
      isMandatoryForRoles: p.isMandatoryForRoles ?? [],
      isMandatoryForActivities: [],
      isMandatoryForPermitTypes: p.isMandatoryForPermitTypes ?? [],
      durationHours: p.durationHours,
      durationSessions: p.durationSessions ?? 1,
      maxParticipantsPerBatch: 20,
      language: p.language ?? ["English", "Hindi"],
      prerequisitePrograms: [],
      prerequisiteRoles: [],
      medicalFitnessRequired: false,
      hasAssessment: p.hasAssessment ?? false,
      assessmentType: p.hasAssessment ? "WRITTEN" : null,
      passingScore: passing,
      passingScorePercent: passing,
      attemptsAllowed: 3,
      issuesCertificate: true,
      validityMonths,
      certificateValidityMonths: p.certificateValidityMonths,
      certificateExpiryGracePeriodDays: 30,
      refresherProgramCode: p.refresherProgramCode ?? null,
      learningObjectives: p.learningObjectives ?? [],
      approvedTrainerIds: [],
      externalTrainerAllowed: false,
      evaluatesEffectiveness: true,
      effectivenessReviewMonths: 3,
      blocksPtwIfMissing: p.blocksPtwIfMissing ?? false,
      blocksRoleAssignmentIfMissing: p.blocksRoleAssignmentIfMissing ?? false,
      blocksContractorOnboardingIfMissing: p.blocksContractorOnboardingIfMissing ?? false,
      mandatory: isMandatoryLegacy,
      isActive: true,
      approvalStatus: "APPROVED",
      approvedAt: new Date(),
      reviewFrequencyMonths: 12
    };

    if (existing) {
      await prisma.trainingProgram.update({
        where: { id: existing.id },
        data
      });
      updated++;
    } else {
      await prisma.trainingProgram.create({ data });
      created++;
    }
  }

  console.log(`✅ ${created} created, ${updated} updated, ${PROGRAMS.length} total.`);

  const counts = await prisma.trainingProgram.groupBy({
    by: ["category"],
    _count: true
  });
  console.log("\nBy category:");
  for (const c of counts) {
    console.log(`  ${c.category ?? "—"}: ${c._count}`);
  }

  const ptwGated = await prisma.trainingProgram.count({
    where: { blocksPtwIfMissing: true }
  });
  const roleGated = await prisma.trainingProgram.count({
    where: { blocksRoleAssignmentIfMissing: true }
  });
  const contractorGated = await prisma.trainingProgram.count({
    where: { blocksContractorOnboardingIfMissing: true }
  });
  const statutory = await prisma.trainingProgram.count({
    where: { isStatutory: true }
  });
  console.log("\nGate enforcement:");
  console.log(`  PTW-gated:        ${ptwGated}`);
  console.log(`  Role-gated:       ${roleGated}`);
  console.log(`  Contractor-gated: ${contractorGated}`);
  console.log(`  Statutory:        ${statutory}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
