// ────────────────────────────────────────────────────────────────────────
// Pre-submission validation for Manhours wizards.
//
// Pure functions — no Prisma, no async. Caller assembles a
// ValidationInput from the loaded submission + prior 3 months and
// hands it in. Engine returns a list of typed issues (INFO / WARN /
// FAIL); UI groups + colours by level. Submit is blocked iff any
// FAIL exists.
//
// Design: each check is a small named function that returns
// ValidationIssue | null. The dispatcher runs them in order.
// Tests can call individual checks directly.
// ────────────────────────────────────────────────────────────────────────

export type ValidationIssueLevel = "INFO" | "WARN" | "FAIL";

export type ValidationCode =
  | "TOTAL_MATCH_PERMANENT"
  | "TOTAL_MATCH_CONTRACT"
  | "TOTAL_MATCH_TRAINEE"
  | "TOTAL_MATCH_ALL"
  | "DEDUCTIONS_REASONABLE"
  | "DEDUCTIONS_NEGATIVE"
  | "DEDUCTIONS_TOTAL_MISMATCH"
  | "HOURS_PER_EMPLOYEE_REASONABLE"
  | "HOURS_PER_EMPLOYEE_ABSURD"
  | "MISSING_PERMANENT_ROWS"
  | "MISSING_CONTRACT_ROWS"
  | "MISSING_TRAINEE_ROWS"
  | "NET_EXPOSURE_NONPOSITIVE"
  | "NET_EXPOSURE_FORMULA_MISMATCH"
  | "PRIOR_DEVIATION"
  | "NEW_DEPARTMENT"
  | "NEW_CONTRACTOR"
  | "NOTES_REQUIRED_ON_DEVIATIONS";

export interface ValidationIssue {
  level: ValidationIssueLevel;
  code: ValidationCode;
  message: string;
  details?: string;
}

export interface ValidationCategorySummary {
  categoryType: "PERMANENT" | "CONTRACT" | "TRAINEE";
  departmentName: string | null;
  contractorName: string | null;
  averageHeadcount: number;
  totalHours: number;
}

export interface ValidationPriorMonth {
  reportingYear: number;
  reportingMonth: number;
  netExposureHours: number;
  totalEmployeeStrength: number;
  totalContractorStrength: number;
  departmentNames: string[];
  contractorNames: string[];
}

export interface ValidationInput {
  submission: {
    totalManhoursPermanent: number;
    totalManhoursContract: number;
    totalManhoursTrainee: number;
    totalManhoursAll: number;
    totalEmployeeStrength: number;
    totalContractorStrength: number;
    totalDaysWorked: number;
    hoursAnnualLeave: number;
    hoursSickLeave: number;
    hoursTraining: number;
    hoursMaternityLeave: number;
    hoursOther: number;
    hoursDeductionsTotal: number;
    netExposureHours: number;
    submissionNotes: string | null;
  };
  categories: ValidationCategorySummary[];
  priorMonths: ValidationPriorMonth[];
}

export interface ValidationReport {
  issues: ValidationIssue[];
  canSubmit: boolean;
  summary: { info: number; warn: number; fail: number };
}

// Float-equality slack — categories are entered as integers but
// aggregates may have small rounding noise from CSV imports / unit
// conversions. 0.01 hr (~36 sec) is well below the noise floor.
const EPS = 0.01;

// ── Public entry point ─────────────────────────────────────────────

export function validateSubmission(input: ValidationInput): ValidationReport {
  const issues: ValidationIssue[] = [];

  const checks = [
    checkTotalMatchPermanent,
    checkTotalMatchContract,
    checkTotalMatchTrainee,
    checkTotalMatchAll,
    checkDeductionsNegative,
    checkDeductionsTotalConsistent,
    checkDeductionsReasonable,
    checkHoursPerEmployee,
    checkMissingPermanentRows,
    checkMissingContractRows,
    checkMissingTraineeRows,
    checkNetExposurePositive,
    checkNetExposureFormula,
    checkPriorDeviation,
    checkNewDepartments,
    checkNewContractors
  ];

  for (const check of checks) {
    const out = check(input);
    if (Array.isArray(out)) issues.push(...out);
    else if (out) issues.push(out);
  }

  // Cross-cut: notes required if any WARN was raised. Run last so it
  // can react to the issues collected so far.
  const notesIssue = checkNotesOnDeviations(input, issues);
  if (notesIssue) issues.push(notesIssue);

  const summary = { info: 0, warn: 0, fail: 0 };
  for (const i of issues) {
    if (i.level === "INFO") summary.info++;
    else if (i.level === "WARN") summary.warn++;
    else summary.fail++;
  }

  return { issues, canSubmit: summary.fail === 0, summary };
}

// ── Individual checks ──────────────────────────────────────────────

function checkTotalMatchPermanent(i: ValidationInput): ValidationIssue | null {
  const declared = i.submission.totalManhoursPermanent;
  const sum = i.categories.filter((c) => c.categoryType === "PERMANENT").reduce((s, c) => s + c.totalHours, 0);
  if (Math.abs(declared - sum) <= EPS) return null;
  return {
    level: "FAIL",
    code: "TOTAL_MATCH_PERMANENT",
    message: "Permanent total doesn't match sum of department rows",
    details: `Declared ${declared.toFixed(2)} hrs vs rows sum to ${sum.toFixed(2)} hrs`
  };
}

function checkTotalMatchContract(i: ValidationInput): ValidationIssue | null {
  const declared = i.submission.totalManhoursContract;
  const sum = i.categories.filter((c) => c.categoryType === "CONTRACT").reduce((s, c) => s + c.totalHours, 0);
  if (Math.abs(declared - sum) <= EPS) return null;
  return {
    level: "FAIL",
    code: "TOTAL_MATCH_CONTRACT",
    message: "Contract total doesn't match sum of contractor company rows",
    details: `Declared ${declared.toFixed(2)} hrs vs rows sum to ${sum.toFixed(2)} hrs`
  };
}

function checkTotalMatchTrainee(i: ValidationInput): ValidationIssue | null {
  const declared = i.submission.totalManhoursTrainee;
  const sum = i.categories.filter((c) => c.categoryType === "TRAINEE").reduce((s, c) => s + c.totalHours, 0);
  if (Math.abs(declared - sum) <= EPS) return null;
  return {
    level: "FAIL",
    code: "TOTAL_MATCH_TRAINEE",
    message: "Trainee total doesn't match sum of trainee rows",
    details: `Declared ${declared.toFixed(2)} hrs vs rows sum to ${sum.toFixed(2)} hrs`
  };
}

function checkTotalMatchAll(i: ValidationInput): ValidationIssue | null {
  const declared = i.submission.totalManhoursAll;
  const sum =
    i.submission.totalManhoursPermanent +
    i.submission.totalManhoursContract +
    i.submission.totalManhoursTrainee;
  if (Math.abs(declared - sum) <= EPS) return null;
  return {
    level: "FAIL",
    code: "TOTAL_MATCH_ALL",
    message: "Grand total doesn't equal permanent + contract + trainee",
    details: `Declared ${declared.toFixed(2)} hrs vs computed ${sum.toFixed(2)} hrs`
  };
}

function checkDeductionsNegative(i: ValidationInput): ValidationIssue | null {
  const fields: [string, number][] = [
    ["Annual leave", i.submission.hoursAnnualLeave],
    ["Sick leave", i.submission.hoursSickLeave],
    ["Off-job training", i.submission.hoursTraining],
    ["Maternity leave", i.submission.hoursMaternityLeave],
    ["Other", i.submission.hoursOther]
  ];
  const negatives = fields.filter(([, v]) => v < 0);
  if (negatives.length === 0) return null;
  return {
    level: "FAIL",
    code: "DEDUCTIONS_NEGATIVE",
    message: "Deduction values cannot be negative",
    details: negatives.map(([name, v]) => `${name}: ${v}`).join("; ")
  };
}

function checkDeductionsTotalConsistent(i: ValidationInput): ValidationIssue | null {
  const sum =
    i.submission.hoursAnnualLeave +
    i.submission.hoursSickLeave +
    i.submission.hoursTraining +
    i.submission.hoursMaternityLeave +
    i.submission.hoursOther;
  if (Math.abs(i.submission.hoursDeductionsTotal - sum) <= EPS) return null;
  return {
    level: "FAIL",
    code: "DEDUCTIONS_TOTAL_MISMATCH",
    message: "Deduction total doesn't match sum of individual deductions",
    details: `Total ${i.submission.hoursDeductionsTotal.toFixed(2)} vs sum ${sum.toFixed(2)}`
  };
}

function checkDeductionsReasonable(i: ValidationInput): ValidationIssue | null {
  // Industry typical: 5-15% of gross hours. Below 5% is suspicious
  // (no leave taken at all?), above 15% suggests data classification
  // issues. Either way: warn, not fail — there are legitimate edge
  // cases (commissioning month, festival shutdowns).
  const gross = i.submission.totalManhoursAll;
  if (gross <= 0) return null;
  const pct = (i.submission.hoursDeductionsTotal / gross) * 100;
  if (pct >= 5 && pct <= 15) return null;
  return {
    level: "WARN",
    code: "DEDUCTIONS_REASONABLE",
    message: pct < 5 ? "Deductions unusually low (<5%)" : "Deductions unusually high (>15%)",
    details: `Deductions are ${pct.toFixed(1)}% of gross hours; typical range is 5-15%`
  };
}

function checkHoursPerEmployee(i: ValidationInput): ValidationIssue | null {
  const strength = i.submission.totalEmployeeStrength;
  if (strength <= 0 || i.submission.totalManhoursPermanent <= 0) return null;
  const perHead = i.submission.totalManhoursPermanent / strength;
  // Normal month: 22 working days × 8 hrs = 176 hrs/employee. Plus
  // overtime brings typical to ~190. Outside [150, 220] is suspicious.
  // Outside [50, 400] is almost certainly a data entry error.
  if (perHead < 50 || perHead > 400) {
    return {
      level: "FAIL",
      code: "HOURS_PER_EMPLOYEE_ABSURD",
      message: "Hours per employee is outside any plausible range",
      details: `${perHead.toFixed(1)} hrs/employee for ${strength} permanent staff — check headcount or hours entry`
    };
  }
  if (perHead < 150 || perHead > 220) {
    return {
      level: "WARN",
      code: "HOURS_PER_EMPLOYEE_REASONABLE",
      message: "Hours per employee outside normal range",
      details: `${perHead.toFixed(1)} hrs/employee; typical month = 175-200 hrs`
    };
  }
  return null;
}

function checkMissingPermanentRows(i: ValidationInput): ValidationIssue | null {
  if (i.submission.totalEmployeeStrength === 0) return null;
  const has = i.categories.some((c) => c.categoryType === "PERMANENT");
  if (has) return null;
  return {
    level: "FAIL",
    code: "MISSING_PERMANENT_ROWS",
    message: "Permanent strength declared but no department rows entered",
    details: `${i.submission.totalEmployeeStrength} permanent staff declared in Step 1; add at least one department row in Step 2`
  };
}

function checkMissingContractRows(i: ValidationInput): ValidationIssue | null {
  if (i.submission.totalContractorStrength === 0) return null;
  const has = i.categories.some((c) => c.categoryType === "CONTRACT");
  if (has) return null;
  return {
    level: "FAIL",
    code: "MISSING_CONTRACT_ROWS",
    message: "Contractor strength declared but no contractor company rows entered",
    details: `${i.submission.totalContractorStrength} contract staff declared in Step 1; add at least one contractor row in Step 3`
  };
}

function checkMissingTraineeRows(i: ValidationInput): ValidationIssue | null {
  // Trainees are optional — only fail if hours are entered without rows.
  if (i.submission.totalManhoursTrainee === 0) return null;
  const has = i.categories.some((c) => c.categoryType === "TRAINEE");
  if (has) return null;
  return {
    level: "FAIL",
    code: "MISSING_TRAINEE_ROWS",
    message: "Trainee hours declared but no trainee rows entered",
    details: "Add per-department breakdown in Step 4 or set trainee total to 0"
  };
}

function checkNetExposurePositive(i: ValidationInput): ValidationIssue | null {
  if (i.submission.netExposureHours > 0) return null;
  return {
    level: "FAIL",
    code: "NET_EXPOSURE_NONPOSITIVE",
    message: "Net exposure hours must be greater than zero",
    details:
      "All KPIs (LTIFR, TRIR, Severity) divide by this number — submitting zero would make them undefined."
  };
}

function checkNetExposureFormula(i: ValidationInput): ValidationIssue | null {
  const expected = i.submission.totalManhoursAll - i.submission.hoursDeductionsTotal;
  if (Math.abs(i.submission.netExposureHours - expected) <= EPS) return null;
  return {
    level: "FAIL",
    code: "NET_EXPOSURE_FORMULA_MISMATCH",
    message: "Net exposure hours don't match (gross − deductions)",
    details: `Stored ${i.submission.netExposureHours.toFixed(2)} vs computed ${expected.toFixed(2)} — re-save Steps 2-6 to refresh totals`
  };
}

function checkPriorDeviation(i: ValidationInput): ValidationIssue | null {
  if (i.priorMonths.length === 0) return null;
  const meanPrior =
    i.priorMonths.reduce((s, p) => s + p.netExposureHours, 0) / i.priorMonths.length;
  if (meanPrior <= 0) return null;
  const pctDelta = ((i.submission.netExposureHours - meanPrior) / meanPrior) * 100;
  if (Math.abs(pctDelta) <= 30) return null;
  return {
    level: "WARN",
    code: "PRIOR_DEVIATION",
    message:
      pctDelta > 0
        ? "Net exposure hours markedly higher than recent months"
        : "Net exposure hours markedly lower than recent months",
    details: `${pctDelta > 0 ? "+" : ""}${pctDelta.toFixed(1)}% vs prior ${i.priorMonths.length}-month average (${meanPrior.toFixed(0)} hrs). Add notes if this reflects a real operational change.`
  };
}

function checkNewDepartments(i: ValidationInput): ValidationIssue[] {
  if (i.priorMonths.length === 0) return [];
  const seen = new Set<string>();
  for (const p of i.priorMonths) for (const d of p.departmentNames) seen.add(d);
  const novel = new Set<string>();
  for (const c of i.categories) {
    if ((c.categoryType === "PERMANENT" || c.categoryType === "TRAINEE") && c.departmentName) {
      if (!seen.has(c.departmentName)) novel.add(c.departmentName);
    }
  }
  if (novel.size === 0) return [];
  return [
    {
      level: "INFO",
      code: "NEW_DEPARTMENT",
      message: `${novel.size} department${novel.size === 1 ? "" : "s"} not seen in recent months`,
      details: Array.from(novel).join(", ") + " — confirm this isn't a typo"
    }
  ];
}

function checkNewContractors(i: ValidationInput): ValidationIssue[] {
  if (i.priorMonths.length === 0) return [];
  const seen = new Set<string>();
  for (const p of i.priorMonths) for (const c of p.contractorNames) seen.add(c);
  const novel = new Set<string>();
  for (const c of i.categories) {
    if (c.categoryType === "CONTRACT" && c.contractorName && !seen.has(c.contractorName)) {
      novel.add(c.contractorName);
    }
  }
  if (novel.size === 0) return [];
  return [
    {
      level: "INFO",
      code: "NEW_CONTRACTOR",
      message: `${novel.size} contractor${novel.size === 1 ? "" : "s"} not seen in recent months`,
      details: Array.from(novel).join(", ") + " — confirm this isn't a typo"
    }
  ];
}

function checkNotesOnDeviations(
  i: ValidationInput,
  collected: ValidationIssue[]
): ValidationIssue | null {
  const hasWarn = collected.some((x) => x.level === "WARN");
  if (!hasWarn) return null;
  if ((i.submission.submissionNotes ?? "").trim().length > 10) return null;
  return {
    level: "WARN",
    code: "NOTES_REQUIRED_ON_DEVIATIONS",
    message: "Add submission notes explaining the flagged deviations",
    details: "Plant Head review goes faster when context is captured at submit time."
  };
}
