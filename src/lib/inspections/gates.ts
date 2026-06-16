// Cross-module gates that depend on Inspection state.
//
// Used by:
//   - PTW issuance (block if equipment has overdue inspection of given types)
//   - Inspector assignment (block if user lacks required certifications)
//   - Inspection execution (re-checked at submit time in /api/inspections/[id]/items)

import { prisma } from "@/lib/prisma";

/**
 * Equipment currency check — used at PTW issuance.
 * Returns the list of overdue InspectionType+Equipment pairs that should
 * block issuance, or empty array if all clear.
 *
 * Caller decides whether to hard-block or warn — typically:
 *   - Hard block for STATUTORY types
 *   - Warn for ROUTINE types
 */
export async function checkEquipmentInspectionCurrency(equipmentIds: string[]): Promise<{
  equipmentId: string;
  equipmentName: string;
  inspectionTypeName: string;
  inspectionTypeId: string;
  isStatutory: boolean;
  daysOverdue: number;
  nextInspectionDue: Date | null;
}[]> {
  if (equipmentIds.length === 0) return [];
  const links = await prisma.equipmentInspectionType.findMany({
    where: {
      equipmentId: { in: equipmentIds },
      isActive: true,
      nextInspectionDue: { lt: new Date() }
    },
    include: {
      equipment: { select: { id: true, name: true } },
      inspectionType: { select: { id: true, name: true, isStatutory: true } }
    }
  });
  const now = Date.now();
  return links.map((l) => ({
    equipmentId: l.equipmentId,
    equipmentName: l.equipment.name,
    inspectionTypeId: l.inspectionTypeId,
    inspectionTypeName: l.inspectionType.name,
    isStatutory: l.inspectionType.isStatutory,
    daysOverdue: l.nextInspectionDue ? Math.floor((now - l.nextInspectionDue.getTime()) / 86400000) : 0,
    nextInspectionDue: l.nextInspectionDue
  })).sort((a, b) => Number(b.isStatutory) - Number(a.isStatutory) || b.daysOverdue - a.daysOverdue);
}

/**
 * Inspector competency check — verify a user holds the certifications
 * required for an InspectionType.
 *
 * Returns { allowed, missingCerts } — missing list is used to populate
 * a clear error message and link the user to the training catalogue.
 */
export async function checkInspectorCompetency(opts: {
  userId: string;
  inspectionTypeId: string;
}): Promise<{ allowed: boolean; missingCerts: string[]; reason?: string }> {
  const type = await prisma.inspectionType.findUnique({
    where: { id: opts.inspectionTypeId },
    select: { requiresCertifiedInspector: true, requiredCertificationCodes: true }
  });
  if (!type) return { allowed: false, missingCerts: [], reason: "Inspection type not found" };
  if (!type.requiresCertifiedInspector || type.requiredCertificationCodes.length === 0) {
    return { allowed: true, missingCerts: [] };
  }

  const certs = await prisma.trainingCertificate.findMany({
    where: {
      userId: opts.userId,
      status: { in: ["ACTIVE", "EXPIRING_SOON"] },
      program: {
        OR: [
          { code: { in: type.requiredCertificationCodes } },
          { programCode: { in: type.requiredCertificationCodes } }
        ]
      }
    },
    include: { program: { select: { code: true, programCode: true } } }
  }).catch(() => [] as any[]);

  const heldCodes = new Set<string>();
  for (const c of certs) {
    if (c.program?.code) heldCodes.add(c.program.code);
    if (c.program?.programCode) heldCodes.add(c.program.programCode);
  }
  const missing = type.requiredCertificationCodes.filter((c) => !heldCodes.has(c));
  if (missing.length === 0) return { allowed: true, missingCerts: [] };
  return {
    allowed: false,
    missingCerts: missing,
    reason: `Inspector lacks valid certification(s): ${missing.join(", ")}`
  };
}
