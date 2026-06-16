// ──────────────────────────────────────────────────────────────────────────
// Deterministic RCA builder for demo / backfill seeding.
//
// `buildRcaForIncident` produces typed rootCauseData JSON + all derived text
// fields. Method is selected by `spice % RCA_METHOD_ROTATION.length` so each
// call with a unique spice yields a different methodology, making the demo
// roster look realistic rather than every incident using the same approach.
//
// All types mirror src/lib/rca/types.ts — duplicated here so this file can
// run standalone (npx tsx prisma/...) without needing the src/ path aliases.
// ──────────────────────────────────────────────────────────────────────────

// ── Canonical method codes (must match normaliseRcaMethod in src/lib/rca/types.ts) ──
export const RCA_METHOD_ROTATION = [
  "FIVE_WHY",
  "FISHBONE",
  "TAPROOT",
  "FTA",
  "BOWTIE",
  "CAUSE_MAP",
] as const;

export type RcaMethodCode = (typeof RCA_METHOD_ROTATION)[number];

// ── Input shape ──────────────────────────────────────────────────────────
export interface IncidentInput {
  type: string;              // IncidentType enum value
  description: string;
  immediateCause?: string | null;
  location?: string | null;
  bodyPart?: string | null;
  natureOfInjury?: string | null;
}

// ── Output shape (maps 1-to-1 to Prisma update fields) ──────────────────
export interface RcaOutput {
  rootCauseMethod: string;
  rootCauseData: object;
  rootCauseSummary: string;
  immediateCauses: string[];
  underlyingCauses: string[];
  rootCauses: string[];
  contributingFactors: string[];
  correctiveActions: string;
  preventiveActions: string;
}

// ── Per-type context tables ───────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  FIRST_AID: "first-aid injury",
  MTC: "medical treatment case",
  RWC: "restricted work case",
  LTI: "lost-time injury",
  FATALITY: "fatality",
  PROPERTY_DAMAGE: "property damage incident",
  ENVIRONMENTAL: "environmental release",
  FIRE: "fire incident",
  PROCESS_SAFETY: "process safety event",
  HIPO_NEAR_MISS: "high-potential near miss",
};

// Arrays are [0..4] variants; spice % 5 selects the variant per record so the
// demo shows variety even within the same incident type.
const TYPE_WHYS: Record<string, string[][]> = {
  INJURY: [
    [
      "Worker sustained an injury during task execution",
      "Required PPE was not worn at time of injury",
      "PPE was uncomfortable and workers routinely removed it",
      "PPE specification had not been reviewed for fitness-for-purpose",
      "No periodic user-feedback mechanism for PPE comfort / fit",
      "PPE selection process does not incorporate ergonomic wearer assessment"
    ],
    [
      "Maintenance technician received a crush injury",
      "Body part was in the line of fire during tool operation",
      "Safe working posture not established before starting task",
      "No pre-task body-positioning check in the job card",
      "Job cards were written for outcomes, not sequential safe acts",
      "Work planning process does not mandate ergonomic safe-positioning step"
    ],
    [
      "Operator was struck by moving equipment",
      "Worker entered an exclusion zone without authorisation",
      "Exclusion zone boundaries were not clearly marked",
      "Area delineation standards not applied to this equipment type",
      "Equipment-specific hazard assessment did not classify exclusion zones",
      "HIRA for this area was last completed 3 years ago and is outdated"
    ],
    [
      "Slip and fall incident on process floor",
      "Floor surface was wet at the time",
      "Spill was not cleaned up promptly",
      "Housekeeping frequency for this area was insufficient",
      "Housekeeping schedule was not risk-ranked by area slip risk",
      "Area risk assessment had not identified variable-slip-risk periods"
    ],
    [
      "Worker sustained a laceration from a hand tool",
      "Correct tool was not used for the task",
      "Tool selection guidance was absent from the task procedure",
      "Task procedure last reviewed before tool hazard matrix was introduced",
      "Procedure review cycle (5 years) too long for high-frequency tasks",
      "Procedure management system has no trigger for interim review on tool changes"
    ],
  ],
  PROPERTY_DAMAGE: [
    [
      "Equipment was struck by mobile plant during operation",
      "Vehicle was operating in an area shared with static equipment without barrier",
      "Vehicle route planning did not identify the shared corridor",
      "Traffic management plan was 4 years old and had not been updated after layout change",
      "Change management process had not triggered a traffic plan review after relayout",
      "MOC process scope excluded layout changes below a defined capital threshold"
    ],
    [
      "Structural component failed under load",
      "Load applied exceeded the rated safe working load",
      "SWL marking on the structural component had become illegible",
      "No programme for periodic SWL label inspection and replacement",
      "Asset integrity inspection scope did not cover structural markings",
      "Asset register had not been reviewed since commissioning"
    ],
  ],
  ENVIRONMENTAL: [
    [
      "Effluent discharge exceeded consent limits",
      "Automated dosing control failed without triggering an alarm",
      "Control system alarm threshold had been set above the consent limit",
      "Commissioning team set a conservative threshold that was not updated post-consent revision",
      "No procedure for reviewing control thresholds when consent parameters change",
      "Consent change management is owned by legal; control parameters owned by engineering — no handshake"
    ],
    [
      "Chemical spill to bunded area with partial bund breach",
      "Bund drainage valve was open and unlocked",
      "Bund drain valve state was not on the operator round sheet",
      "Round sheet had never been updated after bund was added to the area",
      "Round sheet update process is informal and owner-dependent",
      "No formal configuration management for operator round sheets"
    ],
  ],
  FIRE: [
    [
      "Fire started in insulation lagging",
      "Lagging was saturated with flammable fluid",
      "Fluid leak had been present for an extended period undetected",
      "Lagging condition is not inspected on rounds — only the fluid level is checked",
      "Round sheet does not prompt inspection of lagging surfaces adjacent to fluid systems",
      "Risk assessment for fluid systems did not identify lagging saturation as a check point"
    ],
    [
      "Hot-work fire in adjacent combustible material",
      "Combustible material was within the hot-work exclusion radius",
      "Combustible clearance check was not performed before hot work started",
      "Pre-hot-work checklist did not include a combustible clearance step",
      "PTW checklist had not been updated since hot-work SOP was revised",
      "PTW and SOP documents are maintained by different teams without a cross-reference review"
    ],
  ],
  DEFAULT: [
    [
      "An unexpected unsafe event occurred during routine operations",
      "Controls in place were insufficient to prevent the event",
      "Risk assessment underestimated the likelihood of failure",
      "Risk assessment was not reviewed after a near-miss with similar mechanism 12 months prior",
      "Near-miss learnings are not systematically used to trigger risk re-assessment",
      "Incident investigation outputs are not linked to the risk register review cycle"
    ],
    [
      "Incident occurred due to a combination of equipment and procedural failures",
      "Equipment was operating outside design parameters at time of incident",
      "Equipment condition monitoring had lapsed",
      "Preventive maintenance frequency was reduced due to resource constraints",
      "PM scope reduction was not evaluated through a formal risk assessment",
      "Maintenance resource decisions are not subject to safety risk review"
    ],
  ],
};

function getWhysForType(type: string, variant: number): string[] {
  const injuryTypes = new Set(["FIRST_AID", "MTC", "RWC", "LTI", "FATALITY"]);
  const pool = injuryTypes.has(type)
    ? TYPE_WHYS.INJURY
    : TYPE_WHYS[type] ?? TYPE_WHYS.DEFAULT;
  return pool[variant % pool.length];
}

// ── Builder functions per method ──────────────────────────────────────────

function buildFiveWhy(inc: IncidentInput, variant: number): object {
  const whys = getWhysForType(inc.type, variant);
  return {
    problemStatement: inc.description.slice(0, 200),
    whys: [
      { question: "Why did the incident occur?",              answer: whys[1] ?? "" },
      { question: "Why was that condition present?",          answer: whys[2] ?? "" },
      { question: "Why did that underlying cause exist?",     answer: whys[3] ?? "" },
      { question: "Why was the system condition undetected?", answer: whys[4] ?? "" },
      { question: "Why did the management gap exist?",        answer: whys[5] ?? "" },
    ],
    rootCause: whys[5] ?? whys[4] ?? "Systemic gap in risk management process",
  };
}

function buildFishbone(inc: IncidentInput, variant: number): object {
  const typeLabel = TYPE_LABELS[inc.type] ?? "incident";
  const bodyPartNote = inc.bodyPart ? ` (${inc.bodyPart})` : "";
  const injuryNote = inc.natureOfInjury ? ` — ${inc.natureOfInjury}` : "";
  const fishbones: Record<string, string[][][]> = {
    INJURY: [
      [
        ["Inadequate PPE worn at time of task", "Worker fatigue affecting task focus"],
        ["Equipment guarding not fit for purpose", "Tool maintenance interval lapsed"],
        ["Concurrent task steps creating distraction", "Step sequence not enforced"],
        ["Non-conforming material substituted without review", "Missing consumable sourced informally"],
        ["No pre-task risk check conducted", "Inspection data not acted upon"],
        ["Ambient conditions reducing concentration", "Poor lighting in work area"],
      ],
      [
        ["Incorrect body positioning during manual task", "New worker with insufficient supervised hours"],
        ["Defective hand tool in service", "MEWP/access equipment not rated for task"],
        ["No permit or FLRA for non-routine task", "SOP did not address this task variant"],
        ["Consumable expired / degraded", "Wrong grade of material used"],
        ["Condition monitoring gap — defect not detected", "Near-miss not reported or acted upon"],
        ["Confined/awkward workspace increases injury risk", "High ambient temperature reducing alertness"],
      ],
    ],
    FIRE: [
      [
        ["Fire watch not in place", "Worker unfamiliar with fire response procedure"],
        ["Hot work equipment defective — spark beyond normal zone", "Gas detection system offline"],
        ["Hot work permit conditions not fully implemented", "SOP lacked combustible clearance step"],
        ["Flammable material stored beyond SOP-specified distance", "Drip/saturated insulation present"],
        ["Gas test interval exceeded", "Combustible classification not re-assessed post-layout change"],
        ["Adjacent process area not evacuated", "Work adjacent to live process not risk-assessed"],
      ],
    ],
    ENVIRONMENTAL: [
      [
        ["Operator unaware of consent parameter change", "No alert system for consent limit breach"],
        ["Dosing control calibration drifted", "Auto-shut-off system not tested on last schedule"],
        ["Consent revision not communicated to operations", "Control set-points not updated after revision"],
        ["Wrong reagent batch concentration", "Reagent quality certificate not verified on receipt"],
        ["pH meter not calibrated — false reading", "Alarm threshold above consent limit"],
        ["Bund drain not closed after maintenance", "Secondary containment not confirmed on rounds"],
      ],
    ],
  };

  const injurySet = new Set(["FIRST_AID", "MTC", "RWC", "LTI", "FATALITY", "HIPO_NEAR_MISS"]);
  const key = injurySet.has(inc.type) ? "INJURY" : inc.type === "FIRE" ? "FIRE" : inc.type === "ENVIRONMENTAL" ? "ENVIRONMENTAL" : "INJURY";
  const pool = fishbones[key] ?? fishbones.INJURY;
  const cats = pool[variant % pool.length];

  return {
    problemStatement: `${typeLabel}${bodyPartNote}${injuryNote} — ${inc.location ?? "site"}`,
    categories: {
      manpower:    cats[0],
      machine:     cats[1],
      method:      cats[2],
      material:    cats[3],
      measurement: cats[4],
      environment: cats[5],
    },
    rootCauses: [
      cats[2][0] ?? "Procedural gap in task method",
      cats[4][0] ?? "Monitoring / detection gap",
    ],
  };
}

function buildFta(inc: IncidentInput, variant: number): object {
  const typeLabel = TYPE_LABELS[inc.type] ?? "incident";
  const topEvent = `${typeLabel} at ${inc.location ?? "facility"}`;
  const variants = [
    {
      tree: {
        id: "T0", description: topEvent, nodeType: "EVENT",
        children: [
          {
            id: "G1", description: "Hazardous condition not controlled", nodeType: "AND_GATE",
            children: [
              { id: "B1", description: inc.immediateCause ?? "Energy release exceeded barrier capacity", nodeType: "BASIC_EVENT", probability: "HIGH", controlActiveAtIncident: false },
              { id: "B2", description: "PPE / guarding did not provide adequate protection", nodeType: "BASIC_EVENT", probability: "MEDIUM", controlActiveAtIncident: false },
            ]
          },
          {
            id: "G2", description: "Administrative controls failed", nodeType: "OR_GATE",
            children: [
              { id: "B3", description: "Risk assessment did not identify this scenario", nodeType: "BASIC_EVENT", probability: "MEDIUM", existingControls: "HIRA reviewed annually", controlActiveAtIncident: false },
              { id: "B4", description: "Permit / FLRA conditions not enforced at site", nodeType: "BASIC_EVENT", probability: "LOW", existingControls: "PTW system active", controlActiveAtIncident: true },
            ]
          },
        ]
      },
      minimalCutSets: [
        [inc.immediateCause ?? "Energy release", "PPE / guarding failure"],
        ["Risk assessment gap", "Administrative controls not enforced"],
      ],
      actualCutSet: [inc.immediateCause ?? "Energy release", "PPE / guarding failure"],
    },
    {
      tree: {
        id: "T0", description: topEvent, nodeType: "EVENT",
        children: [
          {
            id: "G1", description: "Physical barrier absent or failed", nodeType: "OR_GATE",
            children: [
              { id: "B1", description: "Guarding / cover removed for maintenance", nodeType: "BASIC_EVENT", probability: "HIGH", controlActiveAtIncident: true },
              { id: "B2", description: "Barrier degraded beyond effective state", nodeType: "BASIC_EVENT", probability: "MEDIUM", controlActiveAtIncident: false },
            ]
          },
          {
            id: "G2", description: "Worker in line-of-fire", nodeType: "AND_GATE",
            children: [
              { id: "B3", description: "Task required positioning adjacent to hazard zone", nodeType: "BASIC_EVENT", probability: "HIGH", controlActiveAtIncident: true },
              { id: "B4", description: "Exclusion / segregation not established", nodeType: "BASIC_EVENT", probability: "MEDIUM", controlActiveAtIncident: false },
            ]
          },
          {
            id: "G3", description: "Recovery controls did not mitigate outcome", nodeType: "AND_GATE",
            children: [
              { id: "B5", description: "Emergency stop / isolation not immediately accessible", nodeType: "BASIC_EVENT", probability: "LOW", controlActiveAtIncident: false },
              { id: "B6", description: "First responder not present at scene", nodeType: "BASIC_EVENT", probability: "LOW", controlActiveAtIncident: true },
            ]
          },
        ]
      },
      minimalCutSets: [
        ["Guarding failure", "Worker in line-of-fire"],
        ["Barrier degraded", "Exclusion not established", "E-stop inaccessible"],
      ],
      actualCutSet: ["Guarding removed", "Worker in line-of-fire", "Exclusion not established"],
    },
  ];

  const v = variants[variant % variants.length];
  return { topEvent, ...v };
}

function buildBowtie(inc: IncidentInput, variant: number): object {
  const typeLabel = TYPE_LABELS[inc.type] ?? "incident";
  const topEvent = inc.immediateCause ?? `Uncontrolled energy release leading to ${typeLabel}`;
  const variants = [
    {
      threats: [
        {
          description: "Equipment / tool failure",
          preventiveBarriers: [
            { description: "Preventive maintenance schedule", status: "WORKED" },
            { description: "Pre-use inspection by operator", status: "FAILED" },
            { description: "Defect reporting system", status: "WORKED" },
          ]
        },
        {
          description: "Human error in task execution",
          preventiveBarriers: [
            { description: "Written procedure (SOP)", status: "WORKED" },
            { description: "Toolbox talk / FLRA before task", status: "ABSENT" },
            { description: "Supervisor on-site verification", status: "FAILED" },
          ]
        },
      ],
      consequences: [
        {
          description: "Personal injury",
          mitigativeBarriers: [
            { description: "Personal Protective Equipment", status: "WORKED" },
            { description: "First aid trained first responder on shift", status: "WORKED" },
            { description: "Emergency medical response plan", status: "WORKED" },
          ]
        },
        {
          description: "Production stoppage",
          mitigativeBarriers: [
            { description: "Business continuity / standby equipment", status: "WORKED" },
            { description: "Incident escalation and management plan", status: "WORKED" },
          ]
        },
      ],
    },
    {
      threats: [
        {
          description: "Inadequate hazard identification",
          preventiveBarriers: [
            { description: "HIRA / JSA for task", status: "FAILED" },
            { description: "Management of change review", status: "ABSENT" },
            { description: "Daily safety walkround", status: "WORKED" },
          ]
        },
        {
          description: "Communication failure",
          preventiveBarriers: [
            { description: "Shift handover checklist", status: "WORKED" },
            { description: "Permit to Work conditions communicated to all crew", status: "FAILED" },
          ]
        },
      ],
      consequences: [
        {
          description: "Injury to worker(s)",
          mitigativeBarriers: [
            { description: "PPE — primary protection", status: "FAILED" },
            { description: "Immediate first aid", status: "WORKED" },
            { description: "Hospital / medical treatment", status: "WORKED" },
          ]
        },
        {
          description: "Regulatory notification / investigation",
          mitigativeBarriers: [
            { description: "Internal incident reporting system", status: "WORKED" },
            { description: "External statutory reporting to DGFASLI / factory inspector", status: "WORKED" },
          ]
        },
      ],
    },
  ];

  return { topEvent, ...variants[variant % variants.length] };
}

function buildTapRoot(inc: IncidentInput, variant: number): object {
  const typeLabel = TYPE_LABELS[inc.type] ?? "incident";
  const variants = [
    {
      eventDescription: `${typeLabel} — ${inc.description.slice(0, 150)}`,
      snapChart: [
        { timestamp: "T-04:00", condition: "Normal operating conditions in area", action: "Routine shift operations continuing", isIncident: false },
        { timestamp: "T-00:30", condition: "Precursor condition developing (not yet visible)", action: "Shift supervisor conducting another task", isIncident: false },
        { timestamp: "T-00:05", condition: inc.immediateCause ?? "Hazardous condition reached threshold", action: "Worker started task without pre-task risk check", isIncident: false },
        { timestamp: "T=0",     condition: "Incident event", action: `${typeLabel} occurred`, isIncident: true },
        { timestamp: "T+00:05", condition: "Injured party / witness raises alarm", action: "Emergency stop activated; first aid deployed", isIncident: false },
        { timestamp: "T+00:30", condition: "Area secured", action: "Supervisor notified; investigation team assembled", isIncident: false },
      ],
      causalFactors: [
        {
          description: "Worker did not follow required pre-task safety steps",
          rootCauseTree: [
            { category: "Human Performance Difficulty", subcategory: "Procedure", nearRootCause: "Procedure Not Used", rootCause: "SOP did not cover this task variant; worker relied on experience alone" },
            { category: "Human Performance Difficulty", subcategory: "Training", nearRootCause: "Initial Training Deficiency", rootCause: "On-the-job training for this equipment type was never formally documented or verified" },
          ]
        },
        {
          description: "Engineered safeguard failed to prevent injury",
          rootCauseTree: [
            { category: "Equipment", subcategory: "Design", nearRootCause: "Wrong / Inadequate Design", rootCause: "Guarding design predated current machine operating speed; not updated during last upgrade" },
            { category: "Equipment", subcategory: "Maintenance", nearRootCause: "PM Deficiency", rootCause: "PM task for guarding inspection had been removed from schedule during cost reduction" },
          ]
        },
      ],
      genericCauses: ["Inadequate procedure", "Inadequate training", "Equipment/guarding deficiency"],
      correctiveActions: [
        { description: "Revise SOP to cover this task variant with explicit safe-positioning requirement", traceableTo: ["Worker did not follow required pre-task safety steps"] },
        { description: "Restore guarding inspection to PM schedule with 3-monthly frequency", traceableTo: ["Engineered safeguard failed to prevent injury"] },
        { description: "Deliver task-specific re-training to all workers performing this activity", traceableTo: ["Worker did not follow required pre-task safety steps"] },
      ],
    },
    {
      eventDescription: `${typeLabel} — ${inc.description.slice(0, 150)}`,
      snapChart: [
        { timestamp: "T-72:00", condition: "Latent equipment condition developing", action: "Routine maintenance conducted — defect not identified", isIncident: false },
        { timestamp: "T-01:00", condition: "Increased risk — condition visible to attentive observer", action: "Pre-shift walkround completed — condition not reported", isIncident: false },
        { timestamp: "T=0",     condition: "Incident event", action: `${typeLabel} occurred — ${inc.immediateCause ?? "control failure"}`, isIncident: true },
        { timestamp: "T+00:10", condition: "Alarm raised by personnel on site", action: "Emergency response initiated", isIncident: false },
        { timestamp: "T+01:00", condition: "Scene stabilised; area barricaded", action: "Site management notified; investigation commenced", isIncident: false },
      ],
      causalFactors: [
        {
          description: "Equipment in degraded condition — defect not detected",
          rootCauseTree: [
            { category: "Equipment", subcategory: "Maintenance", nearRootCause: "PM Deficiency", rootCause: "Inspection frequency inadequate for the rate of degradation of this component" },
            { category: "Equipment", subcategory: "Identification", nearRootCause: "Equipment Not Identified", rootCause: "This component was not included in the asset register inspection programme" },
          ]
        },
        {
          description: "Pre-shift walkround did not identify or escalate defect",
          rootCauseTree: [
            { category: "Human Performance Difficulty", subcategory: "Procedure", nearRootCause: "Procedure Not Followed", rootCause: "Walkround checklist did not include a check for this type of defect condition" },
            { category: "Management System", subcategory: "Oversight", nearRootCause: "Audits / Assessments Deficiency", rootCause: "Last HSE audit did not cover inspection effectiveness for this equipment category" },
          ]
        },
      ],
      genericCauses: ["Equipment inspection gap", "Management system / oversight gap", "Detection system failure"],
      correctiveActions: [
        { description: "Add component to asset register and create annual inspection task", traceableTo: ["Equipment in degraded condition — defect not detected"] },
        { description: "Revise walkround checklist to include defect condition indicator for this equipment type", traceableTo: ["Pre-shift walkround did not identify or escalate defect"] },
        { description: "Include inspection effectiveness in next HSE audit scope", traceableTo: ["Pre-shift walkround did not identify or escalate defect"] },
      ],
    },
  ];

  return variants[variant % variants.length];
}

function buildCauseMap(inc: IncidentInput, variant: number): object {
  const injuryImpacts = ["SAFETY"];
  const envImpacts = ["SAFETY", "ENVIRONMENTAL"];
  const propImpacts = ["SAFETY", "PRODUCTION", "COST"];
  const impactsByType: Record<string, string[]> = {
    FIRST_AID: injuryImpacts, MTC: injuryImpacts, RWC: injuryImpacts,
    LTI: ["SAFETY", "COST", "COMPLIANCE"], FATALITY: ["SAFETY", "COMPLIANCE", "COST"],
    PROPERTY_DAMAGE: propImpacts, ENVIRONMENTAL: envImpacts,
    FIRE: ["SAFETY", "PRODUCTION", "COST"], PROCESS_SAFETY: ["SAFETY", "PRODUCTION", "ENVIRONMENTAL"],
    HIPO_NEAR_MISS: injuryImpacts,
  };

  const impacts = impactsByType[inc.type] ?? injuryImpacts;
  const typeLabel = TYPE_LABELS[inc.type] ?? "incident";

  const variants = [
    {
      rootEvent: `${typeLabel} — ${inc.description.slice(0, 100)}`,
      impacts,
      causeNodes: [
        { id: "C1", description: inc.immediateCause ?? "Immediate physical cause", parentId: null },
        { id: "C2", description: "Personal protective measure absent or failed", parentId: "C1" },
        { id: "C3", description: "Pre-task risk check not completed", parentId: "C1" },
        { id: "C4", description: "PPE specification not reviewed in last 2 years", parentId: "C2" },
        { id: "C5", description: "Comfort / compatibility concerns never captured from workforce", parentId: "C2" },
        { id: "C6", description: "FLRA / toolbox talk not conducted before task", parentId: "C3" },
        { id: "C7", description: "Supervision confirmed work started without verification", parentId: "C3" },
        { id: "C8", description: "PPE review process does not include wearer feedback loop", parentId: "C4" },
        { id: "C9", description: "No formal mechanism to capture or escalate PPE complaints", parentId: "C5" },
      ],
    },
    {
      rootEvent: `${typeLabel} — ${inc.location ?? "facility site"}`,
      impacts,
      causeNodes: [
        { id: "C1", description: "Hazard materialised without effective barrier", parentId: null },
        { id: "C2", description: "Engineered control not in place or failed", parentId: "C1" },
        { id: "C3", description: "Administrative control not followed", parentId: "C1" },
        { id: "C4", description: "Equipment maintenance overdue", parentId: "C2" },
        { id: "C5", description: "Guarding / isolation design inadequate for current operating mode", parentId: "C2" },
        { id: "C6", description: "Procedure does not address this task scenario", parentId: "C3" },
        { id: "C7", description: "Supervision not present at critical task step", parentId: "C3" },
        { id: "C8", description: "PM schedule resource constraint reduced frequency", parentId: "C4" },
        { id: "C9", description: "Equipment upgrade not assessed for guarding adequacy", parentId: "C5" },
        { id: "C10", description: "Procedure last updated before current operating conditions", parentId: "C6" },
      ],
    },
  ];

  return variants[variant % variants.length];
}

// ── Cause-hierarchy generators ────────────────────────────────────────────

function deriveImmediateCauses(inc: IncidentInput, variant: number): string[] {
  if (inc.immediateCause) {
    return [inc.immediateCause, `Protective control did not prevent exposure`];
  }
  const pools = [
    ["Energy release exceeded engineered barrier capacity", "Worker in line-of-fire of hazard"],
    ["Equipment failure during routine operation", "Safeguard was absent at time of failure"],
    ["Uncontrolled release of hazardous substance", "Secondary containment breach"],
    ["Moving object struck stationary person", "Exclusion zone not established"],
    ["Manual handling task exceeded ergonomic threshold", "Mechanical aid not used"],
  ];
  return pools[variant % pools.length];
}

function deriveUnderlyingCauses(inc: IncidentInput, variant: number): string[] {
  const pools = [
    [
      "Risk assessment for this task had not been updated after equipment modification",
      "Pre-task brief (FLRA / toolbox talk) was not conducted before work commenced",
      "Correct PPE was not available at the point of use",
    ],
    [
      "Preventive maintenance for the involved equipment was overdue",
      "Equipment inspection checklist did not include this failure mode",
      "Operator did not report a prior symptom / near-miss involving this equipment",
    ],
    [
      "Standard operating procedure did not cover this specific task variant",
      "Worker had not received formal task-specific training",
      "Supervisor was absent from the area during the critical task step",
    ],
    [
      "Traffic / segregation management plan had not been reviewed after area layout change",
      "Signage and barriers did not adequately communicate the exclusion zone",
      "Concurrent activities had not been assessed for simultaneous operation risk",
    ],
    [
      "Chemical storage SOP did not specify secondary containment requirements for this vessel type",
      "Bund drain valve state was not included on the operator round check sheet",
      "Chemical compatibility between substances stored in this area had not been assessed",
    ],
  ];
  return pools[variant % pools.length];
}

function deriveRootCauses(inc: IncidentInput, variant: number): string[] {
  const whys = getWhysForType(inc.type, variant);
  return [whys[whys.length - 1] ?? "Management system gap in hazard identification and control", whys[whys.length - 2] ?? "Review cycle for safety-critical procedures is too infrequent"];
}

function deriveContributingFactors(variant: number): string[] {
  const pools = [
    ["Production pressure reducing time available for pre-task checks", "New or recently transferred worker with limited site familiarity"],
    ["High ambient temperature and fatigue affecting concentration", "Peer-group behaviour normalised shortcut approach"],
    ["Verbal communication relied on rather than written handover", "Unfamiliarity with recently modified equipment"],
    ["Multiple concurrent tasks reducing supervisor availability", "Prior near-miss with similar mechanism not formally investigated"],
    ["Resource constraints had reduced PM frequency", "Change management process not triggered for minor layout modification"],
  ];
  return pools[variant % pools.length];
}

function deriveCorrectiveActions(inc: IncidentInput, variant: number): string {
  const whys = getWhysForType(inc.type, variant);
  const typeLabel = TYPE_LABELS[inc.type] ?? "incident";
  return [
    `1. Address immediate cause: ${inc.immediateCause ?? "review and reinstate failed control"}.`,
    `2. Update risk assessment to include this ${typeLabel} scenario.`,
    `3. Revise relevant SOP / procedure to cover the identified task variant.`,
    `4. Deliver targeted training refresher to all personnel performing this activity.`,
    `5. Root cause remedy: ${whys[whys.length - 1] ?? "review management system adequacy for this hazard class"}.`,
  ].join(" ");
}

function derivePreventiveActions(inc: IncidentInput, variant: number): string {
  const pools = [
    "Include this incident mechanism in the next HIRA review cycle. Add inspection of this control type to the monthly HSE audit checklist. Share lessons learned across all similar plant areas within 30 days.",
    "Establish a periodic review trigger for procedures covering high-frequency tasks. Add a near-miss trending analysis step to the monthly HSE leadership meeting. Review all similar equipment types site-wide for the same failure mode.",
    "Implement a formal simultaneous operations (SIMOPS) risk assessment for work in this area. Link equipment upgrade change requests to a mandatory guarding adequacy review. Introduce a post-maintenance test requirement before return to service.",
    "Integrate worker feedback on PPE comfort / usability into the annual PPE review. Establish a formal mechanism for workers to report PPE fit issues without production pressure. Review PPE specification at next supplier framework renewal.",
    "Include effluent / consent parameters in the management of change review scope. Establish a cross-functional sign-off between operations and environmental for consent-related control set-point changes. Audit all auto-dosing control systems for consent-limit alignment.",
  ];
  return pools[variant % pools.length];
}

function deriveSummary(method: RcaMethodCode, data: object, inc: IncidentInput): string {
  const typeLabel = TYPE_LABELS[inc.type] ?? "incident";
  switch (method) {
    case "FIVE_WHY": {
      const d = data as { rootCause: string; problemStatement: string };
      return `${d.problemStatement?.slice(0, 80) ?? typeLabel}. 5-Why root cause: ${d.rootCause}.`;
    }
    case "FISHBONE": {
      const d = data as { problemStatement: string; rootCauses: string[] };
      return `${d.problemStatement?.slice(0, 80) ?? typeLabel}. 6M Fishbone analysis identified ${d.rootCauses?.length ?? 0} root cause(s): ${(d.rootCauses ?? []).slice(0, 2).join("; ")}.`;
    }
    case "FTA": {
      const d = data as { topEvent: string; actualCutSet?: string[] };
      const cs = (d.actualCutSet ?? []).slice(0, 2).join(" + ");
      return `FTA top event: "${d.topEvent}". Critical path: ${cs || "see tree"}.`;
    }
    case "BOWTIE": {
      const d = data as { topEvent: string; threats: { description: string; preventiveBarriers: { status: string }[] }[] };
      const failedBarriers = (d.threats ?? []).flatMap((t) => t.preventiveBarriers.filter((b) => b.status === "FAILED").length);
      return `Bowtie — top event: "${d.topEvent}". ${failedBarriers} preventive barrier(s) failed.`;
    }
    case "TAPROOT": {
      const d = data as { eventDescription: string; causalFactors: { description: string }[] };
      return `TapRoot — ${d.eventDescription?.slice(0, 80) ?? typeLabel}. ${d.causalFactors?.length ?? 0} causal factor(s) identified.`;
    }
    case "CAUSE_MAP": {
      const d = data as { rootEvent: string; causeNodes: unknown[] };
      return `Cause Map — "${d.rootEvent?.slice(0, 80) ?? typeLabel}". ${d.causeNodes?.length ?? 0} cause node(s) mapped.`;
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────

export function buildRcaForIncident(
  inc: IncidentInput,
  _date: Date,
  spice: number
): RcaOutput {
  const method = RCA_METHOD_ROTATION[spice % RCA_METHOD_ROTATION.length];
  const variant = Math.floor(spice / RCA_METHOD_ROTATION.length) % 5;

  let rootCauseData: object;
  switch (method) {
    case "FIVE_WHY":   rootCauseData = buildFiveWhy(inc, variant); break;
    case "FISHBONE":   rootCauseData = buildFishbone(inc, variant); break;
    case "FTA":        rootCauseData = buildFta(inc, variant); break;
    case "BOWTIE":     rootCauseData = buildBowtie(inc, variant); break;
    case "TAPROOT":    rootCauseData = buildTapRoot(inc, variant); break;
    case "CAUSE_MAP":  rootCauseData = buildCauseMap(inc, variant); break;
  }

  return {
    rootCauseMethod: method,
    rootCauseData,
    rootCauseSummary: deriveSummary(method, rootCauseData, inc),
    immediateCauses: deriveImmediateCauses(inc, variant),
    underlyingCauses: deriveUnderlyingCauses(inc, variant),
    rootCauses: deriveRootCauses(inc, variant),
    contributingFactors: deriveContributingFactors(variant),
    correctiveActions: deriveCorrectiveActions(inc, variant),
    preventiveActions: derivePreventiveActions(inc, variant),
  };
}
