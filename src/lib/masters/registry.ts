// Registry of well-known MasterItem types — the admin UI uses this to
// surface pre-defined dropdown groups with friendly labels and a hint of
// where each type is consumed. Custom types created by admins (any string
// not in this list) appear in the UI under "Custom".

export type MasterTypeMeta = {
  type: string;
  label: string;
  description: string;
  consumedIn: string[]; // human-readable list of forms / modules
  icon?: string;
};

export const MASTER_TYPES: MasterTypeMeta[] = [
  {
    type: "SHIFT",
    label: "Work Shifts",
    description: "Production shift codes used in observation, near-miss, incident, and PTW forms.",
    consumedIn: ["Observation", "Near Miss", "Incident", "PTW", "Manhours"]
  },
  {
    type: "ACTIVITY_TYPE",
    label: "Activity Types",
    description: "What kind of activity was being performed when an event occurred.",
    consumedIn: ["Observation", "Near Miss", "Incident", "PTW", "FLRA"]
  },
  {
    type: "HAZARD_CATEGORY",
    label: "Hazard Categories",
    description: "Top-level hazard taxonomy for risk assessment (mechanical, electrical, etc.).",
    consumedIn: ["FLRA", "PTW", "Risk Assessment"]
  },
  {
    type: "ENERGY_SOURCE",
    label: "Energy Sources",
    description: "Energy isolation taxonomy used in PTW lockout/tagout planning.",
    consumedIn: ["PTW", "FLRA"]
  },
  {
    type: "ROOT_CAUSE_CATEGORY",
    label: "Root Cause Categories",
    description: "Investigation framework — used during incident and near-miss closure.",
    consumedIn: ["Incident", "Near Miss", "Inspection Findings"]
  },
  {
    type: "OBSERVATION_CATEGORY",
    label: "Observation Categories",
    description: "Categorisation for safety observations (PPE, housekeeping, behaviour, etc.).",
    consumedIn: ["Observation"]
  },
  {
    type: "INCIDENT_TYPE",
    label: "Incident Types",
    description: "Categorisation for incident reports.",
    consumedIn: ["Incident"]
  },
  {
    type: "PERMIT_TYPE",
    label: "Permit Types",
    description: "Permit-to-work sub-categories — hot work, confined space, height, etc.",
    consumedIn: ["PTW", "FLRA"]
  },
  {
    type: "PPE_TYPE",
    label: "PPE Types",
    description: "Personal protective equipment options offered in PTW / FLRA / observation forms.",
    consumedIn: ["PTW", "FLRA", "Observation"]
  },
  {
    type: "TRAINING_CATEGORY",
    label: "Training Categories",
    description: "Categorisation for training programs (induction, technical, behavioural, etc.).",
    consumedIn: ["Training"]
  },
  {
    type: "TRAINING_TYPE",
    label: "Training Delivery Types",
    description: "How training is delivered (classroom, e-learning, on-the-job, etc.).",
    consumedIn: ["Training"]
  },
  {
    type: "INSPECTION_CATEGORY",
    label: "Inspection Categories",
    description: "Buckets used to classify inspection types.",
    consumedIn: ["Inspections"]
  },
  {
    type: "EQUIPMENT_CATEGORY",
    label: "Equipment Categories",
    description: "Categorisation for the equipment master.",
    consumedIn: ["Inspections / Equipment Master", "PTW"]
  },
  {
    type: "EQUIPMENT_CRITICALITY",
    label: "Equipment Criticality",
    description: "Criticality bands (A/B/C/D) used to drive PTW gating + finding severity.",
    consumedIn: ["Inspections / Equipment Master"]
  },
  {
    type: "FINDING_SEVERITY_REASON",
    label: "Finding Severity Reasons",
    description: "Optional dropdown for inspectors to qualify why they marked a finding critical.",
    consumedIn: ["Inspection Findings"]
  },
  {
    type: "DEPARTMENT_FUNCTION",
    label: "Department Functions",
    description: "Functional areas for department classification.",
    consumedIn: ["User profile", "Plant master"]
  },
  {
    type: "STATUTORY_FORM_TYPE",
    label: "Statutory Form Types",
    description: "Regulatory form templates (Form 11, Form 13, etc.).",
    consumedIn: ["Inspection Types"]
  },
  {
    type: "DESIGNATION",
    label: "Designations",
    description: "Job titles / designations available in the user master.",
    consumedIn: ["Users"]
  }
];

export function getMasterTypeMeta(type: string): MasterTypeMeta | null {
  return MASTER_TYPES.find((t) => t.type === type) ?? null;
}
