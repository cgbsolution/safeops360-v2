// Shared client-side types for the wizard. Lives in its own module so
// step components can import without pulling Prisma types via the
// server helper module (keeps the client bundle lean).

export interface WizardSubmission {
  id: string;
  submissionNumber: string | null;
  plantId: string;
  plant: { id: string; name: string; code: string };
  reportingYear: number;
  reportingMonth: number;
  reportingPeriodStart: string; // ISO; serialised over the wire
  reportingPeriodEnd: string;
  status: string;

  totalManhoursPermanent: number;
  totalManhoursContract: number;
  totalManhoursTrainee: number;
  totalManhoursAll: number;
  totalEmployeeStrength: number;
  totalContractorStrength: number;
  totalDaysWorked: number;
  totalShiftsWorked: number;

  hoursAnnualLeave: number;
  hoursSickLeave: number;
  hoursTraining: number;
  hoursMaternityLeave: number;
  hoursOther: number;
  hoursDeductionsTotal: number;
  netExposureHours: number;

  submissionNotes: string | null;
  // Workflow audit metadata — present once the submission has moved
  // through review / lock. Wizard renders these conditionally in the
  // action panel + workflow tracker.
  submittedById: string | null;
  submittedAt: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewerNotes: string | null;
  reviewDecision: string | null;
  lockedById: string | null;
  lockedAt: string | null;
  lockNotes: string | null;
  // Frozen KPI snapshot — populated at LOCKED. Untyped here because
  // the schema's Json column round-trips as `unknown`; consumers
  // narrow when needed.
  kpiSnapshot: unknown;

  categories: WizardCategory[];
  visitors: WizardVisitorRecord | null;
  attachments: WizardAttachment[];
  comments: WizardComment[];
}

export interface WizardCategory {
  id: string;
  categoryType: string; // PERMANENT | CONTRACT | TRAINEE
  departmentId: string | null;
  contractorCompanyId: string | null;
  shiftId: string | null;
  averageHeadcount: number;
  peakHeadcount: number;
  endOfPeriodHeadcount: number;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  notes: string | null;
  department: { id: string; name: string; code: string | null } | null;
  contractorCompany: { id: string; name: string; code: string | null } | null;
}

export interface WizardVisitorRecord {
  id: string;
  totalVisitorCount: number;
  totalVisitorHours: number;
  notableVisits: string | null;
}

export interface WizardAttachment {
  id: string;
  category: string;
  fileName: string;
  fileUrl: string;
  caption: string | null;
  uploadedAt: string;
}

export interface WizardComment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string };
}

export interface DepartmentOption {
  id: string;
  name: string;
  code: string | null;
}

export interface ContractorOption {
  id: string;
  name: string;
  code: string | null;
}

export const STEPS = [
  { n: 1, key: "period", label: "Period & Strength" },
  { n: 2, key: "permanent", label: "Permanent Manhours" },
  { n: 3, key: "contract", label: "Contract Manhours" },
  { n: 4, key: "trainee", label: "Trainee Manhours" },
  { n: 5, key: "visitors", label: "Visitors" },
  { n: 6, key: "deductions", label: "Deductions" },
  { n: 7, key: "attachments", label: "Documents" },
  { n: 8, key: "validate", label: "Validate & Submit" }
] as const;

export type StepNumber = (typeof STEPS)[number]["n"];
