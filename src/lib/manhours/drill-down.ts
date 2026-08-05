// ────────────────────────────────────────────────────────────────────────
// Drill-down record hydration.
//
// Given a KpiResult's audit.sourceRecordIds + the source identifier
// the engine pulled them from, fetch enough fields to render a
// per-record link in the drill-down list (number, brief description,
// dated label) and a deep-link href back to the source module's
// detail page.
//
// Sources are heterogeneous, so we use a small switch rather than a
// generic findMany — each source maps to its own select shape. Kept
// in its own module so the API route + the export view both render
// from the same canonical hydrated shape.
// ────────────────────────────────────────────────────────────────────────

import type { PrismaClient } from "@prisma/client";

export interface DrillDownRecord {
  id: string;
  /** Module-friendly label, e.g. INC-2026-LMS-0042. */
  number: string | null;
  /** One-line summary the drill-down list shows. */
  title: string;
  /** Secondary line — type / severity / status. */
  meta: string;
  /** ISO date the record is associated with. */
  date: string | null;
  /** Internal href back to the source module's detail page. */
  href: string;
}

/** Sources the registry currently uses as numerator MODULE_COUNT/SUM
 *  inputs. Drill-down for CUSTOM-tag KPIs is handled by the route
 *  itself (it knows which source the tag pulled from). */
export type DrillSource =
  | "incident"
  | "nearMiss"
  | "observation"
  | "permit"
  | "trainingRecord"
  | "inspection"
  | "manhoursSubmission";

export async function hydrateRecords(
  prisma: PrismaClient,
  source: DrillSource,
  ids: string[]
): Promise<DrillDownRecord[]> {
  if (ids.length === 0) return [];

  switch (source) {
    case "incident": {
      const rows = await prisma.incident.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          number: true,
          date: true,
          occurredAt: true,
          type: true,
          severity: true,
          description: true,
          lostDays: true
        },
        orderBy: { date: "desc" }
      });
      return rows.map((r) => ({
        id: r.id,
        number: r.number,
        title: r.description.slice(0, 120),
        meta: `${r.type}${r.severity ? ` · ${r.severity}` : ""}${r.lostDays ? ` · ${r.lostDays} lost days` : ""}`,
        date: (r.occurredAt ?? r.date).toISOString(),
        href: `/incidents/${r.id}`
      }));
    }
    case "nearMiss": {
      const rows = await prisma.nearMiss.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          number: true,
          date: true,
          potentialSeverity: true,
          description: true
        },
        orderBy: { date: "desc" }
      });
      return rows.map((r) => ({
        id: r.id,
        number: r.number,
        title: r.description.slice(0, 120),
        meta: `Potential: ${r.potentialSeverity}`,
        date: r.date.toISOString(),
        href: `/near-miss/${r.id}`
      }));
    }
    case "observation": {
      const rows = await prisma.observation.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          number: true,
          date: true,
          type: true,
          severity: true,
          description: true,
          status: true
        },
        orderBy: { date: "desc" }
      });
      return rows.map((r) => ({
        id: r.id,
        number: r.number,
        title: r.description.slice(0, 120),
        meta: `${r.type}${r.severity ? ` · ${r.severity}` : ""} · ${r.status}`,
        date: r.date.toISOString(),
        href: `/observations/${r.id}`
      }));
    }
    case "permit": {
      const rows = await prisma.permit.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          scopeOfWork: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" }
      });
      return rows.map((r) => ({
        id: r.id,
        number: r.number,
        title: r.scopeOfWork.slice(0, 120),
        meta: `${r.type} · ${r.status}`,
        date: r.createdAt.toISOString(),
        href: `/ptw/${r.id}`
      }));
    }
    case "trainingRecord": {
      const rows = await prisma.trainingRecord.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          date: true,
          passed: true,
          validUntil: true,
          employee: { select: { name: true } },
          program: { select: { name: true } }
        },
        orderBy: { date: "desc" }
      });
      return rows.map((r) => ({
        id: r.id,
        number: null,
        title: `${r.program.name} — ${r.employee.name}`,
        meta: `${r.passed ? "Passed" : "Failed"} · valid till ${r.validUntil.toLocaleDateString("en-IN")}`,
        date: r.date.toISOString(),
        href: `/training/${r.id}`
      }));
    }
    case "inspection": {
      const rows = await prisma.inspection.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          number: true,
          status: true,
          scheduledDate: true,
          completedDate: true,
          equipment: { select: { name: true, code: true } }
        },
        orderBy: { scheduledDate: "desc" }
      });
      return rows.map((r) => ({
        id: r.id,
        number: r.number,
        title: `${r.equipment.name} (${r.equipment.code})`,
        meta: `${r.status}${r.completedDate ? ` · completed ${r.completedDate.toLocaleDateString("en-IN")}` : ""}`,
        date: (r.completedDate ?? r.scheduledDate).toISOString(),
        href: `/inspections/${r.id}`
      }));
    }
    case "manhoursSubmission": {
      const rows = await prisma.manhoursSubmission.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          submissionNumber: true,
          plantId: true,
          reportingYear: true,
          reportingMonth: true,
          netExposureHours: true,
          status: true
        },
        orderBy: [{ reportingYear: "desc" }, { reportingMonth: "desc" }]
      });
      return rows.map((r) => ({
        id: r.id,
        number: r.submissionNumber,
        title: `${r.reportingYear}-${String(r.reportingMonth).padStart(2, "0")} · ${Math.round(r.netExposureHours).toLocaleString("en-IN")} net hrs`,
        meta: r.status,
        date: new Date(r.reportingYear, r.reportingMonth - 1, 1).toISOString(),
        href: `/manhours/${r.plantId}/${r.reportingYear}/${r.reportingMonth}/edit`
      }));
    }
    default:
      // Should be unreachable — TypeScript exhaustiveness check
      // catches any new source we forget to handle.
      return [];
  }
}

/** Map a registry KPI code to the source it pulls records from. Used
 *  by the drill-down API to know which hydrator to call. CUSTOM and
 *  DERIVED KPIs return null — the API renders an "audit trail
 *  combines multiple sources" message for those. */
export function inferDrillSourceForKpi(code: string): DrillSource | null {
  switch (code) {
    case "LTIFR":
    case "TRIFR":
    case "TRIR":
    case "IFR":
    case "DART_RATE":
    case "SEVERITY_RATE":
    case "DAYS_SINCE_LAST_LTI":
    case "COST_OF_INCIDENTS":
      return "incident";
    case "NEAR_MISS_RATE":
      return "nearMiss";
    case "OBSERVATION_RATE":
      return "observation";
    case "INSPECTION_COMPLIANCE":
      return "inspection";
    case "TRAINING_COMPLIANCE":
      return "trainingRecord";
    case "PTW_FLRA_COMPLIANCE":
      return "permit";
    // FSI / HEINRICH_RATIO / CAPA_CLOSURE_RATE combine multiple
    // sources — the drill-down view shows the underlying KPIs
    // instead of raw records.
    default:
      return null;
  }
}
