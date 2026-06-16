// Schedule generator — turns Equipment × InspectionType pairs into actual
// Inspection rows in SCHEDULED status, ready for inspector assignment and
// execution. Idempotent: skips pairs that already have a SCHEDULED or
// IN_PROGRESS row covering the upcoming due date.
//
// Run from a route handler, a cron, or a manual trigger button. Cheap
// enough to call on every dashboard load (it short-circuits when no work
// is due).

import { prisma } from "@/lib/prisma";
import type { InspectionFrequency } from "@prisma/client";

const DAYS_FOR_FREQ: Record<InspectionFrequency, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 91,
  HALF_YEARLY: 183,
  ANNUAL: 365
};

function nextDueFrom(last: Date, freq: InspectionFrequency): Date {
  const d = new Date(last);
  d.setDate(d.getDate() + DAYS_FOR_FREQ[freq]);
  return d;
}

function pad(n: number, w = 4) {
  return String(n).padStart(w, "0");
}

async function nextInspectionNumber(plantCode: string, typeCode: string, scheduledDate: Date): Promise<string> {
  const yr = scheduledDate.getFullYear();
  const prefix = `INSP-${yr}-${plantCode}-${typeCode}-`;
  const last = await prisma.inspection.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true }
  });
  let next = 1;
  if (last) {
    const m = last.number.match(/-(\d{4,})$/);
    if (m) next = Number(m[1]) + 1;
  }
  return `${prefix}${pad(next)}`;
}

/**
 * Generate inspection rows for every Equipment × InspectionType link whose
 * nextInspectionDue is within `horizonDays` from now.
 *
 * @param horizonDays — generate rows for due dates up to N days from now (default 60)
 * @param plantId — optional restriction to a single plant
 * @returns count of rows generated
 */
export async function generateUpcomingInspections(opts: {
  horizonDays?: number;
  plantId?: string;
} = {}): Promise<{ generated: number; updated: number }> {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + (opts.horizonDays ?? 60));

  const links = await prisma.equipmentInspectionType.findMany({
    where: {
      isActive: true,
      OR: [
        { nextInspectionDue: null }, // never run
        { nextInspectionDue: { lte: horizon } }
      ],
      equipment: { active: true, ...(opts.plantId ? { plantId: opts.plantId } : {}) }
    },
    include: {
      equipment: { select: { id: true, plantId: true, plant: { select: { code: true } } } },
      inspectionType: { select: { id: true, code: true, defaultFrequency: true, isStatutory: true, statutoryFormType: true } },
      checklistTemplate: { select: { id: true, version: true } }
    }
  });

  let generated = 0;
  let updated = 0;

  for (const link of links) {
    const freq = link.frequencyOverride ?? link.inspectionType.defaultFrequency;
    const lastDate = link.lastInspectionDate ?? new Date();
    const dueDate = link.nextInspectionDue ?? nextDueFrom(lastDate, freq);

    if (dueDate > horizon) continue;

    // Idempotency check — skip if a SCHEDULED/IN_PROGRESS row for this
    // (equipment, type) pair already exists with scheduledDate within
    // ±2 days of the computed due date.
    const fudge = 2 * 86400000;
    const existing = await prisma.inspection.findFirst({
      where: {
        equipmentInspectionTypeId: link.id,
        status: { in: ["SCHEDULED", "DUE", "IN_PROGRESS", "OVERDUE"] },
        scheduledDate: {
          gte: new Date(dueDate.getTime() - fudge),
          lte: new Date(dueDate.getTime() + fudge)
        }
      },
      select: { id: true }
    });
    if (existing) continue;

    // Resolve checklist template id — link override, then type default
    let checklistTemplateId = link.checklistTemplateId;
    if (!checklistTemplateId) {
      const t = await prisma.inspectionType.findUnique({
        where: { id: link.inspectionTypeId },
        select: { defaultChecklistTemplateId: true }
      });
      checklistTemplateId = t?.defaultChecklistTemplateId ?? null;
    }
    let checklistTemplateVersion: number | undefined;
    if (checklistTemplateId) {
      const tpl = await prisma.checklistTemplate.findUnique({
        where: { id: checklistTemplateId },
        select: { version: true }
      });
      checklistTemplateVersion = tpl?.version;
    }

    const number = await nextInspectionNumber(
      link.equipment.plant.code,
      link.inspectionType.code,
      dueDate
    );

    const wasOverdue = link.nextInspectionDue && link.nextInspectionDue < new Date();
    const initialStatus = wasOverdue ? "OVERDUE" : (Math.abs(dueDate.getTime() - Date.now()) < 3 * 86400000 ? "DUE" : "SCHEDULED");

    await prisma.inspection.create({
      data: {
        number,
        equipmentId: link.equipmentId,
        plantId: link.equipment.plantId,
        scheduledDate: dueDate,
        status: initialStatus,
        inspectionTypeId: link.inspectionTypeId,
        equipmentInspectionTypeId: link.id,
        checklistTemplateId: checklistTemplateId ?? undefined,
        checklistTemplateVersion: checklistTemplateVersion,
        inspectorId: link.defaultInspectorId ?? undefined,
        isStatutory: link.inspectionType.isStatutory,
        statutoryFormType: link.inspectionType.statutoryFormType ?? undefined
      }
    });
    generated++;

    // Cache nextInspectionDue on the link for fast lookups
    await prisma.equipmentInspectionType.update({
      where: { id: link.id },
      data: { nextInspectionDue: dueDate }
    });
    updated++;
  }

  return { generated, updated };
}

/**
 * Mark crossing thresholds: SCHEDULED → DUE (within 3 days), DUE → OVERDUE
 * (past). Runs cheaply on every list/inbox load.
 */
export async function sweepInspectionStatus(): Promise<{ flippedToDue: number; flippedToOverdue: number }> {
  const now = new Date();
  const dueWindow = new Date();
  dueWindow.setDate(dueWindow.getDate() + 3);

  const [overdueRes, dueRes] = await Promise.all([
    prisma.inspection.updateMany({
      where: {
        status: { in: ["SCHEDULED", "DUE"] },
        scheduledDate: { lt: now }
      },
      data: { status: "OVERDUE" }
    }),
    prisma.inspection.updateMany({
      where: {
        status: "SCHEDULED",
        scheduledDate: { gte: now, lte: dueWindow }
      },
      data: { status: "DUE" }
    })
  ]);

  return { flippedToDue: dueRes.count, flippedToOverdue: overdueRes.count };
}

/**
 * Recompute the next due date for an equipment-inspection-type link after
 * an inspection has been completed.
 */
export async function recomputeAfterCompletion(opts: {
  equipmentInspectionTypeId: string;
  completedDate: Date;
}): Promise<void> {
  const link = await prisma.equipmentInspectionType.findUnique({
    where: { id: opts.equipmentInspectionTypeId },
    include: { inspectionType: { select: { defaultFrequency: true } } }
  });
  if (!link) return;
  const freq = link.frequencyOverride ?? link.inspectionType.defaultFrequency;
  const next = nextDueFrom(opts.completedDate, freq);
  await prisma.equipmentInspectionType.update({
    where: { id: opts.equipmentInspectionTypeId },
    data: {
      lastInspectionDate: opts.completedDate,
      nextInspectionDue: next
    }
  });
  // Also cache on Equipment for the master-list view
  await prisma.equipment.update({
    where: { id: link.equipmentId },
    data: { lastInspectionDate: opts.completedDate, nextInspectionDue: next }
  });
}
