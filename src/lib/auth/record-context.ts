// Per-module record-context loader. Used by both the workflow engine's RBAC
// gate and the regular API authorize() helper, so OWN_PLANT / OWN_DEPARTMENT
// / OWN_RECORDS scope checks have what they need regardless of which path
// the request takes.
//
// What it does: given (module, recordId), returns plantId, departmentId,
// and the record itself (with the owner-id fields populated). Departments
// are derived from the natural "owner" user on each record — observer for
// observations, reporter for near-miss/incident, originator for permits,
// leader for FLRA, inspector for inspections. Plant Heads / HSE Managers
// hold OWN_PLANT scope so they're not affected by department derivation.

import { prisma } from "@/lib/prisma";

export type RecordContext = {
  plantId: string | null;
  departmentId: string | null;
  record: Record<string, any> | null;
};

export async function loadRecordContext(module: string, recordId: string): Promise<RecordContext> {
  try {
    switch (module) {
      case "OBSERVATION": {
        const r = await prisma.observation.findUnique({
          where: { id: recordId },
          select: {
            plantId: true,
            observerId: true,
            responsiblePersonId: true,
            observer: { select: { department: true } }
          }
        });
        return {
          plantId: r?.plantId ?? null,
          departmentId: r?.observer?.department ?? null,
          record: r
        };
      }
      case "NEAR_MISS": {
        const r = await prisma.nearMiss.findUnique({
          where: { id: recordId },
          select: {
            plantId: true,
            reporterId: true,
            actionOwnerId: true,
            reporter: { select: { department: true } }
          }
        });
        return {
          plantId: r?.plantId ?? null,
          departmentId: r?.reporter?.department ?? null,
          record: r
        };
      }
      case "INCIDENT": {
        const r = await prisma.incident.findUnique({
          where: { id: recordId },
          select: {
            plantId: true,
            reporterId: true,
            reporter: { select: { department: true } }
          }
        });
        return {
          plantId: r?.plantId ?? null,
          departmentId: r?.reporter?.department ?? null,
          record: r
        };
      }
      case "PTW": {
        const r = await prisma.permit.findUnique({
          where: { id: recordId },
          select: {
            plantId: true,
            originatorId: true,
            issuerId: true,
            receiverId: true,
            originator: { select: { department: true } }
          }
        });
        return {
          plantId: r?.plantId ?? null,
          departmentId: r?.originator?.department ?? null,
          record: r
        };
      }
      case "FLRA": {
        const r = await prisma.fLRA.findUnique({
          where: { id: recordId },
          select: {
            plantId: true,
            leaderId: true,
            leader: { select: { department: true } }
          }
        });
        return {
          plantId: r?.plantId ?? null,
          departmentId: r?.leader?.department ?? null,
          record: r
        };
      }
      case "INSPECTION": {
        const r = await prisma.inspection.findUnique({
          where: { id: recordId },
          select: {
            plantId: true,
            inspectorId: true,
            inspector: { select: { department: true } }
          }
        });
        return {
          plantId: r?.plantId ?? null,
          departmentId: r?.inspector?.department ?? null,
          record: r
        };
      }
      case "MANHOURS": {
        const r = await prisma.manhours.findUnique({
          where: { id: recordId },
          select: { plantId: true }
        });
        return { plantId: r?.plantId ?? null, departmentId: null, record: r };
      }
      case "TRAINING": {
        const r = await prisma.trainingRecord.findUnique({
          where: { id: recordId },
          select: {
            employeeId: true,
            trainerId: true,
            employee: { select: { plantId: true, department: true } }
          }
        });
        return {
          plantId: r?.employee?.plantId ?? null,
          departmentId: r?.employee?.department ?? null,
          record: r
        };
      }
      // HIRA — both the study and individual entries are addressable. Studies
      // are plant-scoped via their direct plantId; departmentId resolves via
      // the optional department FK (we return the department's name to match
      // the pattern used by other modules, which compare against User.department).
      case "HIRA_STUDY": {
        const r = await prisma.hiraStudy.findUnique({
          where: { id: recordId },
          select: {
            plantId: true,
            createdById: true,
            teamLeaderId: true,
            department: { select: { name: true } },
            team: { select: { userId: true } }
          }
        });
        return {
          plantId: r?.plantId ?? null,
          departmentId: r?.department?.name ?? null,
          record: r
        };
      }
      // Entries inherit plant + department from their parent study. OWN_RECORDS
      // is satisfied if the user is the entry creator, updater, OR a study
      // team member — the latter so team-invited Safety Officers / Supervisors
      // can edit entries within the study scope.
      case "HIRA_ENTRY": {
        const r = await prisma.hiraEntry.findUnique({
          where: { id: recordId },
          select: {
            createdById: true,
            updatedById: true,
            study: {
              select: {
                plantId: true,
                createdById: true,
                teamLeaderId: true,
                department: { select: { name: true } },
                team: { select: { userId: true } }
              }
            }
          }
        });
        return {
          plantId: r?.study?.plantId ?? null,
          departmentId: r?.study?.department?.name ?? null,
          record: r ? { ...r, teamUserIds: r.study?.team?.map((t) => t.userId) ?? [] } : null
        };
      }
      // CAPA — unified module. departmentId comes from the primary owner's
      // department string (consistent with other modules). The owner-id fields
      // (raisedByUserId, primaryOwnerUserId) feed OWN_RECORDS scope checks.
      // Source-category scoping is enforced one layer up by the can() helper
      // when the role lacks CAPA.CROSS_SOURCE_VIEW.
      case "CAPA": {
        const r = await prisma.capa.findUnique({
          where: { id: recordId },
          select: {
            plantId: true,
            raisedByUserId: true,
            primaryOwnerUserId: true,
            sourceCategoryId: true,
            sourceTypeCode: true,
            primaryOwner: { select: { department: true } },
            contributors: { select: { userId: true } }
          }
        });
        return {
          plantId: r?.plantId ?? null,
          departmentId: r?.primaryOwner?.department ?? null,
          record: r
            ? {
                ...r,
                contributorUserIds: r.contributors?.map((c) => c.userId) ?? []
              }
            : null
        };
      }
      default:
        return { plantId: null, departmentId: null, record: null };
    }
  } catch {
    return { plantId: null, departmentId: null, record: null };
  }
}
