// ────────────────────────────────────────────────────────────────────────
// Server-side helpers shared across the Manhours route handlers.
//
// Centralises:
//   • the editable-status guard (only DRAFT and UNLOCKED_FOR_REVISION
//     are mutable by HSE Manager)
//   • the post-mutation aggregate refresh (every category mutation
//     and every deduction edit re-derives the submission's totals)
//   • the validation-input assembler (loads prior 3 months for trend
//     deviation and new-master detection)
//   • the submission-number generator (MH-YYYY-PLANT-MM)
//
// Route handlers stay thin and focused on HTTP plumbing.
// ────────────────────────────────────────────────────────────────────────

import type { Prisma, PrismaClient } from "@prisma/client";
import { recomputeAggregates } from "./aggregate";
import type {
  ValidationInput,
  ValidationCategorySummary,
  ValidationPriorMonth
} from "./validation";

/** Statuses where the HSE Manager (the role doing the wizard work)
 *  can still edit content. Plant Head and Corporate HSE roles use
 *  separate review/lock endpoints landing in Commit 3. */
export const EDITABLE_STATUSES = new Set(["DRAFT", "UNLOCKED_FOR_REVISION"]);

export class ManhoursStatusError extends Error {
  constructor(public readonly status: string, message?: string) {
    super(
      message ??
        `Submission is in ${status} state — edits are no longer allowed. Use the unlock workflow if changes are required.`
    );
    this.name = "ManhoursStatusError";
  }
}

/** Throw if the submission isn't in an editable state. Call from every
 *  mutation endpoint before applying changes. */
export function assertEditable(submission: { status: string }): void {
  if (!EDITABLE_STATUSES.has(submission.status)) {
    throw new ManhoursStatusError(submission.status);
  }
}

/** Re-derive the submission's roll-up fields from current category +
 *  deduction state and persist the update. Called after every
 *  category mutation and after PATCH /api/manhours-submissions/[id]
 *  when deduction fields changed. */
export async function refreshAggregates(
  prisma: PrismaClient,
  submissionId: string
): Promise<void> {
  const sub = await prisma.manhoursSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: {
      hoursAnnualLeave: true,
      hoursSickLeave: true,
      hoursTraining: true,
      hoursMaternityLeave: true,
      hoursOther: true,
      categories: {
        select: {
          categoryType: true,
          averageHeadcount: true,
          endOfPeriodHeadcount: true,
          regularHours: true,
          overtimeHours: true
        }
      }
    }
  });

  // Prisma types `categoryType` as a plain string; the aggregate
  // contract requires the literal union. Cast at the boundary —
  // the writes that produced these rows already validated the value.
  const totals = recomputeAggregates(
    sub.categories as Parameters<typeof recomputeAggregates>[0],
    sub
  );

  await prisma.manhoursSubmission.update({
    where: { id: submissionId },
    data: totals
  });
}

/** Compute the per-row totalHours field. Called inside the same
 *  transaction as the create/update so reads see a consistent total. */
export function categoryTotal(c: { regularHours: number; overtimeHours: number }): number {
  return (c.regularHours || 0) + (c.overtimeHours || 0);
}

/** Generate the human-friendly submission number. Assigned at the
 *  DRAFT → SUBMITTED transition. Uses plant code + zero-padded month. */
export function buildSubmissionNumber(opts: {
  plantCode: string;
  reportingYear: number;
  reportingMonth: number;
}): string {
  const month = String(opts.reportingMonth).padStart(2, "0");
  return `MH-${opts.reportingYear}-${opts.plantCode}-${month}`;
}

/** Load the last N months of LOCKED submissions for the same plant —
 *  used by the validator to flag deviations and new departments /
 *  contractors. Excludes the current submission. */
export async function loadPriorMonths(
  prisma: PrismaClient,
  opts: {
    plantId: string;
    excludeSubmissionId: string;
    months?: number;
  }
): Promise<ValidationPriorMonth[]> {
  const months = opts.months ?? 3;
  const rows = await prisma.manhoursSubmission.findMany({
    where: {
      plantId: opts.plantId,
      status: "LOCKED",
      id: { not: opts.excludeSubmissionId }
    },
    orderBy: [{ reportingYear: "desc" }, { reportingMonth: "desc" }],
    take: months,
    select: {
      reportingYear: true,
      reportingMonth: true,
      netExposureHours: true,
      totalEmployeeStrength: true,
      totalContractorStrength: true,
      categories: {
        select: {
          categoryType: true,
          department: { select: { name: true } },
          contractorCompany: { select: { name: true } }
        }
      }
    }
  });

  return rows.map((r) => ({
    reportingYear: r.reportingYear,
    reportingMonth: r.reportingMonth,
    netExposureHours: r.netExposureHours,
    totalEmployeeStrength: r.totalEmployeeStrength,
    totalContractorStrength: r.totalContractorStrength,
    departmentNames: dedupe(
      r.categories
        .filter((c) => (c.categoryType === "PERMANENT" || c.categoryType === "TRAINEE") && c.department)
        .map((c) => c.department!.name)
    ),
    contractorNames: dedupe(
      r.categories
        .filter((c) => c.categoryType === "CONTRACT" && c.contractorCompany)
        .map((c) => c.contractorCompany!.name)
    )
  }));
}

/** Pull a submission with everything the validator needs and shape it
 *  for the validation library. */
export async function loadValidationInput(
  prisma: PrismaClient,
  submissionId: string
): Promise<ValidationInput> {
  const sub = await prisma.manhoursSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      categories: {
        include: {
          department: { select: { name: true } },
          contractorCompany: { select: { name: true } }
        }
      }
    }
  });

  const categorySummaries: ValidationCategorySummary[] = sub.categories.map((c) => ({
    categoryType: c.categoryType as "PERMANENT" | "CONTRACT" | "TRAINEE",
    departmentName: c.department?.name ?? null,
    contractorName: c.contractorCompany?.name ?? null,
    averageHeadcount: c.averageHeadcount,
    totalHours: c.totalHours
  }));

  const priorMonths = await loadPriorMonths(prisma, {
    plantId: sub.plantId,
    excludeSubmissionId: submissionId
  });

  return {
    submission: {
      totalManhoursPermanent: sub.totalManhoursPermanent,
      totalManhoursContract: sub.totalManhoursContract,
      totalManhoursTrainee: sub.totalManhoursTrainee,
      totalManhoursAll: sub.totalManhoursAll,
      totalEmployeeStrength: sub.totalEmployeeStrength,
      totalContractorStrength: sub.totalContractorStrength,
      totalDaysWorked: sub.totalDaysWorked,
      hoursAnnualLeave: sub.hoursAnnualLeave,
      hoursSickLeave: sub.hoursSickLeave,
      hoursTraining: sub.hoursTraining,
      hoursMaternityLeave: sub.hoursMaternityLeave,
      hoursOther: sub.hoursOther,
      hoursDeductionsTotal: sub.hoursDeductionsTotal,
      netExposureHours: sub.netExposureHours,
      submissionNotes: sub.submissionNotes
    },
    categories: categorySummaries,
    priorMonths
  };
}

/** Compute the [start, end) date bounds for a (year, month) reporting
 *  period. End is exclusive (first of the following month). */
export function periodBounds(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1)
  };
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/** Type helper — the shape returned by loadFullSubmission (used by
 *  several routes for response payloads). */
export type ManhoursSubmissionDetail = Prisma.ManhoursSubmissionGetPayload<{
  include: {
    plant: { select: { id: true; name: true; code: true } };
    categories: {
      include: {
        department: { select: { id: true; name: true; code: true } };
        contractorCompany: { select: { id: true; name: true; code: true } };
      };
    };
    visitors: true;
    attachments: {
      include: { uploadedBy: { select: { id: true; name: true } } };
    };
    comments: {
      include: { author: { select: { id: true; name: true } } };
    };
  };
}>;

export async function loadFullSubmission(
  prisma: PrismaClient,
  submissionId: string
): Promise<ManhoursSubmissionDetail | null> {
  return prisma.manhoursSubmission.findUnique({
    where: { id: submissionId },
    include: {
      plant: { select: { id: true, name: true, code: true } },
      categories: {
        include: {
          department: { select: { id: true, name: true, code: true } },
          contractorCompany: { select: { id: true, name: true, code: true } }
        }
      },
      visitors: true,
      attachments: {
        include: { uploadedBy: { select: { id: true, name: true } } }
      },
      comments: {
        include: { author: { select: { id: true, name: true } } }
      }
    }
  });
}
