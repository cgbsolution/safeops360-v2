// Finding lifecycle engine. Auto-spawns InspectionFinding rows from failed
// or marginal item results when an inspection is submitted, applies
// severity using item criticality, sets owner from equipment department,
// and seeds default CAPAs. Also handles cross-module spawn (Observation
// when escalation level > 0).

import { prisma } from "@/lib/prisma";

const SEVERITY_FROM_STATUS: Record<string, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
  FAIL: "MEDIUM",
  MARGINAL: "LOW",
  OBSERVATION: "LOW"
};

function pad(n: number, w = 4) {
  return String(n).padStart(w, "0");
}

async function nextFindingNumber(): Promise<string> {
  const yr = new Date().getFullYear();
  const prefix = `FND-${yr}-`;
  const last = await prisma.inspectionFinding.findFirst({
    where: { findingNumber: { startsWith: prefix } },
    orderBy: { findingNumber: "desc" },
    select: { findingNumber: true }
  });
  let n = 1;
  if (last) {
    const m = last.findingNumber.match(/-(\d{4,})$/);
    if (m) n = Number(m[1]) + 1;
  }
  return `${prefix}${pad(n)}`;
}

function dueDateForSeverity(severity: string): Date {
  const d = new Date();
  switch (severity) {
    case "CRITICAL": d.setDate(d.getDate() + 1); break;
    case "HIGH": d.setDate(d.getDate() + 7); break;
    case "MEDIUM": d.setDate(d.getDate() + 30); break;
    default: d.setDate(d.getDate() + 60);
  }
  return d;
}

/**
 * After items are submitted, iterate through results and create a Finding
 * for each FAIL / MARGINAL / OBSERVATION row that doesn't already have one.
 * Idempotent — safe to call multiple times.
 *
 * @returns number of findings created
 */
export async function spawnFindingsFromInspection(inspectionId: string): Promise<{ findingsCreated: number; criticalCreated: number }> {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      itemResults: { include: { finding: true } },
      equipment: { select: { id: true, plantId: true, departmentId: true, criticality: true, name: true } }
    }
  });
  if (!inspection) return { findingsCreated: 0, criticalCreated: 0 };

  let created = 0;
  let criticalCreated = 0;

  for (const r of inspection.itemResults) {
    if (r.finding) continue; // already spawned
    if (!["FAIL", "MARGINAL", "OBSERVATION"].includes(r.resultStatus)) continue;

    const isCritical = r.isCriticalSnapshot && r.resultStatus === "FAIL";
    const baseSev = SEVERITY_FROM_STATUS[r.resultStatus] ?? "LOW";
    let severity = baseSev;
    if (isCritical) severity = "CRITICAL";
    else if (inspection.equipment.criticality === "A" && r.resultStatus === "FAIL") severity = "HIGH";
    else if (inspection.equipment.criticality === "B" && r.resultStatus === "FAIL") severity = "MEDIUM";

    const number = await nextFindingNumber();
    const title = `${inspection.equipment.name}: ${r.itemTextSnapshot}`.slice(0, 200);
    const description = [
      `Inspection ${inspection.number} flagged item #${r.sequence}.`,
      `Item: ${r.itemTextSnapshot}`,
      `Result: ${r.resultStatus}${r.valueNumeric !== null ? ` (value: ${r.valueNumeric})` : ""}${r.valueText ? ` (${r.valueText})` : ""}`,
      r.comment ? `Inspector comment: ${r.comment}` : null
    ].filter(Boolean).join("\n");

    const finding = await prisma.inspectionFinding.create({
      data: {
        findingNumber: number,
        inspectionId,
        itemResultId: r.id,
        title,
        description,
        severity,
        isCritical,
        status: "OPEN",
        dueDate: dueDateForSeverity(severity),
        photoUrls: r.photoUrls,
        // Seed default Correction CAPA for HIGH+ severity
        capas: severity === "CRITICAL" || severity === "HIGH"
          ? {
              create: [{
                capaType: "CORRECTION",
                description: `Immediate correction required for: ${r.itemTextSnapshot}. Details to be filled by action owner.`,
                status: "OPEN",
                dueDate: dueDateForSeverity(severity)
              }]
            }
          : undefined
      }
    });

    created++;
    if (isCritical) criticalCreated++;

    // Critical-finding cascade: spawn an Observation for plant-wide
    // visibility. The observation lifecycle then drives Plant Head
    // notification through the existing workflow.
    if (isCritical) {
      try {
        const observer = (await prisma.user.findFirst({
          where: { plantId: inspection.plantId, role: "HSE_MANAGER" },
          select: { id: true }
        }))?.id ?? inspection.inspectorId;
        if (observer) {
          await prisma.observation.create({
            data: {
              number: `OBS-FROM-${number}`,
              observerId: observer,
              date: new Date(),
              plantId: inspection.plantId,
              type: "UNSAFE_CONDITION" as any,
              // ObservationCategory is a Prisma enum (PPE / HOUSEKEEPING /
              // WORK_AT_HEIGHT / HOT_WORK / MOBILE_EQUIPMENT / ELECTRICAL /
              // MATERIAL_HANDLING / CONFINED_SPACE / CHEMICAL_HANDLING /
              // EMERGENCY_PREP / OTHERS). The OBSERVATION_CATEGORY *dropdown*
              // in seed-dropdowns.ts includes "EQUIPMENT_TOOLS" as a master
              // option, but that label is not part of the strict enum the
              // database expects — passing it threw a Prisma validation
              // error and the cascade was silently swallowed. Map to the
              // generic OTHERS so the cascade actually succeeds; a future
              // pass can route based on equipment category if needed.
              category: "OTHERS" as any,
              severity: "HIGH" as any,
              description: `Critical inspection finding: ${title}\n\n${description}`,
              triggeredInspectionId: inspectionId
            } as any
          });
          await prisma.inspectionFinding.update({
            where: { id: finding.id },
            data: { spawnedObservationId: undefined } // best-effort marker would go here if schema supports
          }).catch(() => null);
        }
      } catch (e) {
        // Schema variations across older code — log but don't fail finding creation
        console.warn("Critical-finding observation cascade skipped:", (e as Error).message);
      }
    }
  }

  return { findingsCreated: created, criticalCreated };
}

/**
 * Severity is recomputed when finding metadata or rootCauseCategory is
 * updated. Call from PATCH /findings/[id] to keep due-date aligned.
 */
export function dueDateForUpdatedSeverity(severity: string): Date {
  return dueDateForSeverity(severity);
}
