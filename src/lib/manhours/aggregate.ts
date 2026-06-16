// ────────────────────────────────────────────────────────────────────────
// Pure aggregation: derive a ManhoursSubmission's roll-up fields from
// its category rows + raw deduction inputs.
//
// Called from two places:
//   1. After any category mutation (create / update / delete / CSV
//      bulk import) — keeps totals in sync.
//   2. Before validation, so the validator sees consistent numbers
//      regardless of how the user got there.
//
// Pure & sync — no Prisma. Caller persists the returned shape.
// ────────────────────────────────────────────────────────────────────────

export interface AggregateCategoryInput {
  categoryType: "PERMANENT" | "CONTRACT" | "TRAINEE";
  averageHeadcount: number;
  endOfPeriodHeadcount: number;
  regularHours: number;
  overtimeHours: number;
}

export interface AggregateDeductionInput {
  hoursAnnualLeave: number;
  hoursSickLeave: number;
  hoursTraining: number;
  hoursMaternityLeave: number;
  hoursOther: number;
}

export interface AggregateResult {
  totalManhoursPermanent: number;
  totalManhoursContract: number;
  totalManhoursTrainee: number;
  totalManhoursAll: number;
  totalEmployeeStrength: number; // permanent + trainee end-of-period
  totalContractorStrength: number; // contract end-of-period
  hoursDeductionsTotal: number;
  netExposureHours: number;
}

export function recomputeAggregates(
  categories: AggregateCategoryInput[],
  deductions: AggregateDeductionInput
): AggregateResult {
  let perm = 0;
  let contr = 0;
  let train = 0;
  let permanentEndStrength = 0;
  let traineeEndStrength = 0;
  let contractEndStrength = 0;

  for (const c of categories) {
    const total = (c.regularHours || 0) + (c.overtimeHours || 0);
    if (c.categoryType === "PERMANENT") {
      perm += total;
      permanentEndStrength += c.endOfPeriodHeadcount || 0;
    } else if (c.categoryType === "CONTRACT") {
      contr += total;
      contractEndStrength += c.endOfPeriodHeadcount || 0;
    } else {
      train += total;
      traineeEndStrength += c.endOfPeriodHeadcount || 0;
    }
  }

  const all = perm + contr + train;

  const deductionsTotal =
    (deductions.hoursAnnualLeave || 0) +
    (deductions.hoursSickLeave || 0) +
    (deductions.hoursTraining || 0) +
    (deductions.hoursMaternityLeave || 0) +
    (deductions.hoursOther || 0);

  return {
    totalManhoursPermanent: perm,
    totalManhoursContract: contr,
    totalManhoursTrainee: train,
    totalManhoursAll: all,
    // Brief lumps trainees with permanent for "employee" strength —
    // they're on payroll. Visitors aren't counted here (visitors live
    // in the separate ManhoursVisitorRecord row).
    totalEmployeeStrength: permanentEndStrength + traineeEndStrength,
    totalContractorStrength: contractEndStrength,
    hoursDeductionsTotal: deductionsTotal,
    // Per IS 3786: net = gross − all deductions.
    netExposureHours: Math.max(0, all - deductionsTotal)
  };
}

/** Compute totalHours for a single category row (regular + overtime).
 *  Used by the wizard's per-row display before save. */
export function categoryTotalHours(c: { regularHours: number; overtimeHours: number }): number {
  return (c.regularHours || 0) + (c.overtimeHours || 0);
}
