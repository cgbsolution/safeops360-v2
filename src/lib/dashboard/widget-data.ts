// ─────────────────────────────────────────────────────────────────────
// Widget data loaders (UI Depth sprint, Deliverable 1).
//
// One loader per widget id, behind a single `loadWidgetData(id, ctx)`
// switch. Server-only (Prisma). The widget API route
// (/api/dashboard/widget/[id]) resolves the caller's plant scope, calls
// this, and returns the payload as JSON; the client widget renders it.
//
// Every query is plant-scoped via ctx.plant (a `{ plantId? }` fragment).
// Where a datum genuinely doesn't exist yet in the schema (contractor
// workforce as a distinct entity, the Permit Risk Reviewer agent outputs),
// the loader returns `{ available: false }` and the component shows an
// honest empty state — per the brief's "meaningful empty state" rule.
// ─────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { humanize } from "@/lib/utils";
import type { PlantWhere } from "./scope";
import { last12Months, monthsInRange, bucketCounts, monthBounds, avgDaysBetween } from "./strip";

export interface WidgetCtx {
  plant: PlantWhere;
  now: Date;
  /** ISO YYYY-MM-DD boundaries from the dashboard date picker. */
  dateFrom?: Date;
  dateTo?: Date;
}

const CAPA_CLOSED = ["CLOSED", "CLOSED_RECURRED", "REJECTED", "CANCELLED"];

// Plant-scope fragment helpers for the various relation shapes.
const direct = (ctx: WidgetCtx) => (ctx.plant.plantId ? { plantId: ctx.plant.plantId } : {});
const viaStudy = (ctx: WidgetCtx) => (ctx.plant.plantId ? { study: { plantId: ctx.plant.plantId } } : {});
const viaEmployee = (ctx: WidgetCtx) => (ctx.plant.plantId ? { employee: { plantId: ctx.plant.plantId } } : {});

function capaSourceLabel(code?: string | null): string {
  const c = (code ?? "").toUpperCase();
  if (c.includes("SAFETY") || c.includes("OBSERV") || c.includes("NEAR") || c.includes("INCIDENT")) return "Safety";
  if (c.includes("QUAL") || c.includes("DEVIATION") || c.includes("OOS")) return "Quality";
  if (c.includes("ENVIRON") || c.includes("EAI")) return "Environmental";
  if (c.includes("AUDIT")) return "Audit";
  if (c.includes("INSPECT")) return "Inspection";
  return "Other";
}

export async function loadWidgetData(id: string, ctx: WidgetCtx): Promise<unknown> {
  const nowDate = ctx.now;
  const now = ctx.now.getTime();

  // When the caller supplies a date range, use it for all period-bounded queries.
  // periodEnd is exclusive (start of the day after dateTo) so `lt` comparisons work.
  const periodEnd: Date | undefined = ctx.dateTo ? new Date(ctx.dateTo.getTime() + 86_400_000) : undefined;

  const buckets = ctx.dateFrom && ctx.dateTo
    ? monthsInRange(ctx.dateFrom, ctx.dateTo)
    : last12Months(nowDate);

  // Start of the query window: caller's dateFrom, else the start of the oldest bucket (12 mo ago).
  const twelveMonthsAgo = ctx.dateFrom ?? buckets[0].start;

  // Reusable date-filter fragment for period-bounded queries.
  const periodFilter = { gte: twelveMonthsAgo, ...(periodEnd ? { lt: periodEnd } : {}) };

  const in30 = new Date(now + 30 * 86_400_000);
  const { startOfMonth, startOfLastMonth } = monthBounds(nowDate);

  switch (id) {
    // ── WIDGET-01 · Open Actions by Age ──────────────────────────────
    case "open-actions-by-age": {
      const open = await prisma.capa.findMany({
        where: { ...direct(ctx), state: { notIn: CAPA_CLOSED } },
        select: { createdAt: true, sourceTypeCode: true, closureTargetDate: true },
        take: 8000,
      });
      const SOURCES = ["Safety", "Quality", "Environmental", "Audit", "Inspection", "Other"];
      const ageBucket = (d: Date) => {
        const days = (now - d.getTime()) / 86_400_000;
        return days <= 7 ? 0 : days <= 30 ? 1 : days <= 90 ? 2 : 3;
      };
      const grid: Record<string, number[]> = {};
      for (const s of SOURCES) grid[s] = [0, 0, 0, 0];
      let overdue = 0;
      let oldest = 0;
      for (const a of open) {
        grid[capaSourceLabel(a.sourceTypeCode)][ageBucket(a.createdAt)]++;
        if (a.closureTargetDate && a.closureTargetDate < nowDate) overdue++;
        oldest = Math.max(oldest, Math.floor((now - a.createdAt.getTime()) / 86_400_000));
      }
      const sources = SOURCES.map((s) => ({ source: s, buckets: grid[s] })).filter((s) => s.buckets.some((n) => n > 0));
      return {
        total: open.length,
        pctOverdue: open.length ? Math.round((overdue / open.length) * 100) : 0,
        oldestDays: oldest,
        sources,
      };
    }

    // ── WIDGET-02 · CAPA Closure Rate Trend ──────────────────────────
    case "capa-closure-trend": {
      const [opened, closed, remainingOpen] = await Promise.all([
        // Use detectedAt (the real incident/detection date) not createdAt (DB insert time).
        prisma.capa.findMany({ where: { ...direct(ctx), detectedAt: periodFilter }, select: { detectedAt: true }, take: 10000 }),
        prisma.capa.findMany({ where: { ...direct(ctx), closedAt: periodFilter }, select: { closedAt: true }, take: 10000 }),
        prisma.capa.count({ where: { ...direct(ctx), state: { notIn: CAPA_CLOSED } } }),
      ]);
      const openedCounts = bucketCounts(opened.map((o) => o.detectedAt), buckets);
      const closedCounts = bucketCounts(closed.filter((c) => c.closedAt).map((c) => c.closedAt as Date), buckets);
      const totalClosed = closed.length;
      const closureRate = totalClosed + remainingOpen > 0 ? Math.round((totalClosed / (totalClosed + remainingOpen)) * 100) : 0;
      return {
        months: buckets.map((b, i) => ({ label: b.label, opened: openedCounts[i], closed: closedCounts[i] })),
        currentOpened: openedCounts[buckets.length - 1] ?? 0,
        currentClosed: closedCounts[buckets.length - 1] ?? 0,
        closureRate,
      };
    }

    // ── WIDGET-03 · Regulatory Compliance Score ──────────────────────
    case "compliance-score": {
      const [training, inspections, comps] = await Promise.all([
        prisma.trainingRecord.findMany({ where: viaEmployee(ctx), select: { employeeId: true, programId: true, date: true, passed: true, validUntil: true }, orderBy: { date: "desc" }, take: 8000 }),
        prisma.inspection.findMany({ where: direct(ctx), select: { status: true }, take: 8000 }),
        prisma.competencyRecord.findMany({ where: direct(ctx), select: { state: true }, take: 20000 }),
      ]);
      // Training: latest record per (employee, program), valid + passed.
      const latest = new Map<string, (typeof training)[number]>();
      for (const t of training) {
        const k = `${t.employeeId}::${t.programId}`;
        const p = latest.get(k);
        if (!p || t.date > p.date) latest.set(k, t);
      }
      const trTotal = latest.size;
      const trValid = [...latest.values()].filter((t) => t.passed && t.validUntil > nowDate).length;
      const trainingPct = trTotal ? (trValid / trTotal) * 100 : 0;
      const insTotal = inspections.length;
      const insOk = inspections.filter((i) => i.status === "COMPLETED").length;
      const inspectionPct = insTotal ? (insOk / insTotal) * 100 : 0;
      const NOT_STARTED = ["not_yet_attempted", "not_started"];
      const compApplicable = comps.filter((c) => !NOT_STARTED.includes(c.state)).length;
      const compValid = comps.filter((c) => c.state === "validated_active").length;
      const competencyPct = compApplicable ? (compValid / compApplicable) * 100 : 0;
      // PPE not yet a complete compliance source → redistribute its 0.20 equally.
      const ppeLive = false;
      const wTr = ppeLive ? 0.3 : 0.375;
      const wIn = ppeLive ? 0.25 : 0.3125;
      const wCo = ppeLive ? 0.25 : 0.3125;
      const score = Math.round(trainingPct * wTr + inspectionPct * wIn + competencyPct * wCo);
      return {
        score,
        ppeLive,
        sub: [
          { key: "training", label: "Training", pct: Math.round(trainingPct), href: "/training" },
          { key: "inspection", label: "Inspection", pct: Math.round(inspectionPct), href: "/inspections" },
          { key: "competency", label: "Competency", pct: Math.round(competencyPct), href: "/skill-matrix" },
          { key: "ppe", label: "PPE", pct: null, href: "/ppe" },
        ],
      };
    }

    // ── WIDGET-04 · HIRA Risk Profile ────────────────────────────────
    case "hira-risk-profile": {
      const entries = await prisma.hiraEntry.findMany({
        where: { status: "ACTIVE", ...viaStudy(ctx) },
        select: { residualRiskLevel: true, createdAt: true },
        take: 12000,
      });
      const ninetyAgo = new Date(now - 90 * 86_400_000);
      const LEVELS = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
      const levels = LEVELS.map((lvl) => {
        const all = entries.filter((e) => e.residualRiskLevel === lvl);
        return { level: lvl, count: all.length, recent: all.filter((e) => e.createdAt >= ninetyAgo).length };
      });
      return { total: entries.length, levels };
    }

    // ── WIDGET-05 · PTW Performance ──────────────────────────────────
    case "ptw-performance": {
      const [active, closedRows, activatedRows] = await Promise.all([
        prisma.permit.count({ where: { ...direct(ctx), status: { in: ["ACTIVE", "SAFETY_APPROVED", "PLANT_HEAD_APPROVED"] } } }),
        prisma.permit.findMany({ where: { ...direct(ctx), closedAt: { gte: startOfMonth } }, select: { closedAt: true, validTo: true }, take: 5000 }),
        prisma.permit.findMany({ where: { ...direct(ctx), activatedAt: { gte: startOfMonth } }, select: { createdAt: true, activatedAt: true }, take: 5000 }),
      ]);
      const closedThisMonth = closedRows.length;
      const onTime = closedRows.filter((p) => p.closedAt && p.validTo && p.closedAt <= p.validTo).length;
      const onTimePct = closedThisMonth ? Math.round((onTime / closedThisMonth) * 100) : null;
      const avgCycleDays = avgDaysBetween(activatedRows.filter((p) => p.activatedAt).map((p) => ({ from: p.createdAt, to: p.activatedAt as Date })));
      // No competency-gate-block model exists yet.
      return { active, closedThisMonth, onTimePct, competencyBlocks: 0, avgCycleDays };
    }

    // ── WIDGET-06 · Inspection Performance Summary ───────────────────
    case "inspection-performance": {
      const sixtyAgo = new Date(now - 60 * 86_400_000);
      const [completed60, overdue, findings, typed] = await Promise.all([
        prisma.inspection.count({ where: { ...direct(ctx), status: "COMPLETED", completedDate: { gte: sixtyAgo } } }),
        prisma.inspection.count({ where: { ...direct(ctx), status: "OVERDUE" } }),
        prisma.inspectionFinding.findMany({
          where: { status: { notIn: ["CLOSED", "VERIFIED", "DUPLICATE"] }, ...(ctx.plant.plantId ? { inspection: { plantId: ctx.plant.plantId } } : {}) },
          select: { isCritical: true },
          take: 8000,
        }),
        prisma.inspection.findMany({ where: { ...direct(ctx), result: { not: null } }, select: { result: true, inspectionType: { select: { name: true } } }, take: 8000 }),
      ]);
      const map = new Map<string, { pass: number; fail: number; total: number }>();
      for (const i of typed) {
        const name = i.inspectionType?.name ?? "Other";
        const m = map.get(name) ?? { pass: 0, fail: 0, total: 0 };
        m.total++;
        if (i.result === "Pass") m.pass++;
        else if (i.result === "Fail") m.fail++;
        map.set(name, m);
      }
      const types = [...map.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 5).map(([name, v]) => ({ name, ...v }));
      return { completed60, overdue, findingsOpen: findings.length, findingsCritical: findings.filter((f) => f.isCritical).length, types };
    }

    // ── WIDGET-07 · MOC Activity ─────────────────────────────────────
    case "moc-activity": {
      const rows = await prisma.changeRequest.findMany({
        where: direct(ctx),
        select: { status: true, isTemporary: true, temporaryExpiryDate: true, targetCompletionDate: true },
        take: 6000,
      });
      const STAGES = ["Draft", "Submitted", "Impact Assessment", "Technical Review", "Approval", "Implementation", "Post-Impl Review"];
      const stageOf = (s: string): string => {
        const x = s.toLowerCase();
        if (x.includes("draft")) return "Draft";
        if (x.includes("impact")) return "Impact Assessment";
        if (x.includes("technical")) return "Technical Review";
        if (x.includes("approval")) return "Approval";
        if (x.includes("implement")) return "Implementation";
        if (x.includes("post") || x.includes("pssr") || x.includes("return") || x.includes("normal")) return "Post-Impl Review";
        if (x.includes("submit") || x.includes("qa_review") || x.includes("review")) return "Submitted";
        return "Submitted";
      };
      const counts: Record<string, number> = Object.fromEntries(STAGES.map((s) => [s, 0]));
      let overdue = 0;
      let tempExpiring = 0;
      for (const r of rows) {
        const open = !r.status.toLowerCase().includes("closed");
        if (open) {
          counts[stageOf(r.status)]++;
          if (r.targetCompletionDate && r.targetCompletionDate < nowDate) overdue++;
        }
        if (r.isTemporary && r.temporaryExpiryDate && r.temporaryExpiryDate >= nowDate && r.temporaryExpiryDate <= in30) tempExpiring++;
      }
      return { stages: STAGES.map((s) => ({ label: s, count: counts[s] })), overdue, tempExpiring };
    }

    // ── WIDGET-08 · Skill Matrix Compliance ──────────────────────────
    case "skill-matrix-compliance": {
      const recs = await prisma.competencyRecord.findMany({ where: direct(ctx), select: { state: true, validUntil: true }, take: 30000 });
      const VALID = ["validated_active"];
      const EXPIRING = ["expiring_soon"];
      const EXPIRED = ["expired_in_grace", "expired_revoked", "lapsed_requires_full_redo", "expired", "lapsed", "revoked"];
      const INPROG = ["in_training", "training_complete_pending_assessment", "under_assessment", "in_progress"];
      const SUSP = ["suspended"];
      const NOT_STARTED = ["not_yet_attempted", "not_started"];
      const c = (arr: string[]) => recs.filter((r) => arr.includes(r.state)).length;
      const valid = c(VALID);
      const applicable = recs.length - c(NOT_STARTED);
      const validityPct = applicable > 0 ? Math.round((valid / applicable) * 100) : 0;
      const expiringThisMonth = recs.filter((r) => r.validUntil && r.validUntil >= nowDate && r.validUntil <= in30).length;
      return {
        segments: [
          { key: "valid", label: "Valid", count: valid },
          { key: "expiring", label: "Expiring", count: c(EXPIRING) },
          { key: "expired", label: "Expired/Lapsed", count: c(EXPIRED) },
          { key: "inprogress", label: "In progress", count: c(INPROG) },
          { key: "suspended", label: "Suspended", count: c(SUSP) },
        ],
        validityPct,
        expiringThisMonth,
      };
    }

    // ── WIDGET-09 · Top Repeat Hazards ───────────────────────────────
    case "top-repeat-hazards": {
      const [nm, obs] = await Promise.all([
        prisma.nearMiss.findMany({ where: { ...direct(ctx), date: periodFilter, hazardCategory: { not: null } }, select: { hazardCategory: true }, take: 12000 }),
        prisma.observation.findMany({ where: { ...direct(ctx), date: periodFilter }, select: { category: true }, take: 12000 }),
      ]);
      const map = new Map<string, { NM: number; OBS: number }>();
      const add = (raw: string | null, key: "NM" | "OBS") => {
        if (!raw) return;
        const k = humanize(raw);
        const m = map.get(k) ?? { NM: 0, OBS: 0 };
        m[key]++;
        map.set(k, m);
      };
      nm.forEach((n) => add(n.hazardCategory, "NM"));
      obs.forEach((o) => add(o.category, "OBS"));
      const items = [...map.entries()]
        .map(([hazard, v]) => ({ hazard, total: v.NM + v.OBS, sources: v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      return { items };
    }

    // ── WIDGET-10 · Incident Investigation Status ────────────────────
    case "incident-status": {
      const ninetyAgo = new Date(now - 90 * 86_400_000);
      const thirty = new Date(now - 30 * 86_400_000);
      const ten = new Date(now - 10 * 86_400_000);
      const [byStatus, openRows, closed90] = await Promise.all([
        prisma.incident.groupBy({ by: ["status"], where: direct(ctx), _count: true }),
        prisma.incident.findMany({ where: { ...direct(ctx), status: { not: "CLOSED" } }, select: { date: true, type: true }, take: 5000 }),
        prisma.incident.findMany({ where: { ...direct(ctx), status: "CLOSED", closedAt: { gte: ninetyAgo } }, select: { date: true, closedAt: true }, take: 5000 }),
      ]);
      const STAGES: [string, string][] = [
        ["Initiated", "REPORTED"],
        ["Investigation", "INVESTIGATION"],
        ["RCA / CAPA", "CAPA_ASSIGNED"],
        ["Verified", "VERIFIED"],
        ["Closed", "CLOSED"],
      ];
      const cmap: Record<string, number> = {};
      byStatus.forEach((b: { status: string; _count: number }) => (cmap[b.status] = b._count));
      const stalled = openRows.filter((r) => r.date < thirty).length;
      const ltiOpen = openRows.filter((r) => (r.type === "LTI" || r.type === "FATALITY") && r.date < ten).length;
      const avgCloseDays = avgDaysBetween(closed90.filter((r) => r.closedAt).map((r) => ({ from: r.date, to: r.closedAt as Date })));
      return { stages: STAGES.map(([label, code]) => ({ label, count: cmap[code] ?? 0 })), stalled, ltiOpen, avgCloseDays };
    }

    // ── WIDGET-11 · Training Coverage by Department ──────────────────
    case "training-by-department": {
      const recs = await prisma.trainingRecord.findMany({
        where: viaEmployee(ctx),
        select: { employeeId: true, programId: true, date: true, passed: true, validUntil: true, employee: { select: { department: true } } },
        orderBy: { date: "desc" },
        take: 12000,
      });
      const latest = new Map<string, (typeof recs)[number]>();
      for (const r of recs) {
        const k = `${r.employeeId}::${r.programId}`;
        const p = latest.get(k);
        if (!p || r.date > p.date) latest.set(k, r);
      }
      const dept: Record<string, { valid: number; total: number; expiring: number }> = {};
      for (const r of latest.values()) {
        const d = r.employee?.department ?? "Other";
        const e = dept[d] ?? (dept[d] = { valid: 0, total: 0, expiring: 0 });
        e.total++;
        if (r.passed && r.validUntil > nowDate) e.valid++;
        if (r.validUntil >= nowDate && r.validUntil <= in30) e.expiring++;
      }
      const depts = Object.entries(dept)
        .map(([name, v]) => ({ name, pct: v.total ? Math.round((v.valid / v.total) * 100) : 0, expiring: v.expiring, total: v.total }))
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 8);
      return { depts };
    }

    // ── WIDGET-12 · Days Since Last Incident by Type ─────────────────
    case "days-since-incident": {
      const defs: [string, string, string[]][] = [
        ["LTI", "Days Since LTI", ["LTI", "FATALITY"]],
        ["RWC", "Days Since RWC", ["RWC"]],
        ["MTC", "Days Since MTC", ["MTC"]],
        ["FA", "Days Since First Aid", ["FIRST_AID"]],
      ];
      const tiles = await Promise.all(
        defs.map(async ([key, label, codes]) => {
          const last = await prisma.incident.findFirst({
            where: { ...direct(ctx), type: { in: codes as never } },
            orderBy: { date: "desc" },
            select: { date: true },
          });
          const days = last ? Math.floor((now - last.date.getTime()) / 86_400_000) : null;
          return { key, label, days };
        })
      );
      return { tiles };
    }

    // ── WIDGET-13 · Contractor Compliance ────────────────────────────
    case "contractor-compliance": {
      // Contractors are not modelled as a distinct workforce entity (no
      // contractor flag on User; only per-record markers). True contractor
      // training/competency/PPE compliance needs that entity — honest empty.
      return { available: false };
    }

    // ── WIDGET-14 · EAI Significance Overview ────────────────────────
    case "eai-significance": {
      const studyScope = viaStudy(ctx);
      const obligationScope = ctx.plant.plantId ? { entry: { study: { plantId: ctx.plant.plantId } } } : {};
      const [significantTotal, controlled, obligationsDue] = await Promise.all([
        prisma.eaiEntry.count({ where: { status: "ACTIVE", residualSignificant: true, ...studyScope } }),
        prisma.eaiEntry.count({ where: { status: "ACTIVE", residualSignificant: true, residualAcceptable: true, ...studyScope } }),
        prisma.eaiComplianceObligation.count({ where: { status: "ACTIVE", nextMonitoringDue: { gte: nowDate, lte: in30 }, ...obligationScope } }),
      ]);
      return { significantTotal, controlled, uncontrolled: Math.max(0, significantTotal - controlled), obligationsDue };
    }

    // ── WIDGET-15 · Safety Observation Quality Score ─────────────────
    case "observation-quality": {
      const sixMoStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 5, 1);
      const rows = await prisma.observation.findMany({
        where: { ...direct(ctx), date: { gte: sixMoStart } },
        select: { date: true, description: true, photoUrl: true, areaId: true },
        take: 15000,
      });
      const grade = (o: { description: string | null; photoUrl: string | null; areaId: string | null }): "high" | "medium" | "low" => {
        const len = o.description?.length ?? 0;
        if (len < 20) return "low";
        if (len > 50 && o.photoUrl && o.areaId) return "high";
        return "medium";
      };
      const months = [] as { label: string; start: Date; end: Date; high: number; medium: number; low: number }[];
      for (let i = 5; i >= 0; i--) {
        const start = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
        const end = new Date(nowDate.getFullYear(), nowDate.getMonth() - i + 1, 1);
        months.push({ label: start.toLocaleDateString("en-IN", { month: "short" }), start, end, high: 0, medium: 0, low: 0 });
      }
      let high = 0;
      let medium = 0;
      let low = 0;
      for (const o of rows) {
        const g = grade(o);
        if (g === "high") high++;
        else if (g === "low") low++;
        else medium++;
        const m = months.find((mm) => o.date >= mm.start && o.date < mm.end);
        if (m) m[g]++;
      }
      return { high, medium, low, trend: months.map((m) => ({ label: m.label, high: m.high, medium: m.medium, low: m.low })) };
    }

    // ── WIDGET-16 · Permit Risk Reviewer Agent Activity ──────────────
    case "permit-agent-activity": {
      return { available: false };
    }

    // ── AI Insights ──────────────────────────────────────────────────
    case "ai-insights": {
      const sevenAgo    = new Date(now - 7  * 86_400_000);
      const fourteenAgo = new Date(now - 14 * 86_400_000);
      const thirtyAgo   = new Date(now - 30 * 86_400_000);

      const [
        nmThis, nmLast,
        openIncidents,
        hiraHighCrit,
        trainingRecs,
        openCapas,
        openCapasOld,
      ] = await Promise.all([
        prisma.nearMiss.count({ where: { ...direct(ctx), date: { gte: sevenAgo } } }),
        prisma.nearMiss.count({ where: { ...direct(ctx), date: { gte: fourteenAgo, lt: sevenAgo } } }),
        prisma.incident.count({ where: { ...direct(ctx), status: { not: "CLOSED" } } }),
        prisma.hiraEntry.count({ where: { ...viaStudy(ctx), status: "ACTIVE", residualRiskLevel: { in: ["HIGH", "CRITICAL"] } } }),
        prisma.trainingRecord.findMany({
          where: viaEmployee(ctx),
          select: { passed: true, validUntil: true, employee: { select: { department: true } } },
          take: 8000,
        }),
        prisma.capa.count({ where: { ...direct(ctx), state: { notIn: CAPA_CLOSED } } }),
        prisma.capa.count({ where: { ...direct(ctx), state: { notIn: CAPA_CLOSED }, createdAt: { lt: thirtyAgo } } }),
      ]);

      type Tone = "good" | "warn" | "bad" | "neutral";
      const insights: { text: string; tone: Tone }[] = [];

      // Near-miss reporting trend
      if (nmLast > 0 && nmThis < nmLast * 0.6) {
        const drop = Math.round((1 - nmThis / nmLast) * 100);
        insights.push({ text: `Near-miss reporting down ${drop}% vs last week — possible under-reporting`, tone: "warn" });
      } else if (nmLast > 0 && nmThis > nmLast * 1.4 && nmThis >= 3) {
        const rise = Math.round((nmThis / nmLast - 1) * 100);
        insights.push({ text: `Near-miss reporting up ${rise}% vs last week — heightened vigilance or incident spike`, tone: "warn" });
      }

      // Open investigations
      if (openIncidents > 0) {
        insights.push({
          text: `${openIncidents} incident investigation${openIncidents > 1 ? "s" : ""} pending closure`,
          tone: openIncidents >= 5 ? "bad" : "warn",
        });
      }

      // HIRA high/critical residual risk
      if (hiraHighCrit > 0) {
        insights.push({
          text: `${hiraHighCrit} HIGH/CRITICAL residual-risk entr${hiraHighCrit > 1 ? "ies" : "y"} in active HIRA studies`,
          tone: "bad",
        });
      }

      // CAPA backlog ageing
      if (openCapas > 0 && openCapasOld > 0) {
        const pct = Math.round((openCapasOld / openCapas) * 100);
        insights.push({ text: `${pct}% of open CAPAs are older than 30 days — backlog ageing`, tone: pct > 50 ? "bad" : "warn" });
      }

      // Training compliance — best and worst department
      const deptMap: Record<string, { valid: number; total: number }> = {};
      for (const r of trainingRecs) {
        const d = r.employee?.department ?? "Other";
        const e = deptMap[d] ?? (deptMap[d] = { valid: 0, total: 0 });
        e.total++;
        if (r.passed && r.validUntil > nowDate) e.valid++;
      }
      const depts = Object.entries(deptMap)
        .filter(([, v]) => v.total >= 3)
        .map(([name, v]) => ({ name, pct: Math.round((v.valid / v.total) * 100) }))
        .sort((a, b) => b.pct - a.pct);
      if (depts.length > 0 && depts[0].pct >= 85) {
        insights.push({ text: `${depts[0].name} training compliance at ${depts[0].pct}% — best in group`, tone: "good" });
      }
      if (depts.length > 1 && depts[depts.length - 1].pct < 60) {
        insights.push({ text: `${depts[depts.length - 1].name} training compliance at ${depts[depts.length - 1].pct}% — needs attention`, tone: "bad" });
      }

      if (insights.length === 0) {
        insights.push({ text: "No critical patterns detected — all safety indicators within normal range", tone: "good" });
      }

      return { insights };
    }

    // ── Existing KPI widgets ─────────────────────────────────────────
    case "kpi-days-since-lti": {
      // Always computed relative to today — "days since" is always from now.
      const last = await prisma.incident.findFirst({ where: { ...direct(ctx), type: { in: ["LTI", "FATALITY"] }, ...(periodEnd ? { date: { lt: periodEnd } } : {}) }, orderBy: { date: "desc" }, select: { date: true } });
      const value = last ? Math.floor((now - last.date.getTime()) / 86_400_000) : 365;
      return { kind: "kpi", value, unit: "days", tone: value > 90 ? "good" : value > 30 ? "warn" : "bad", href: "/manhours" };
    }
    case "kpi-ltifr":
    case "kpi-trir": {
      const rows = await prisma.manhours.findMany({
        where: direct(ctx),
        select: { year: true, month: true, ltiCount: true, rwcCount: true, mtcCount: true, employeeHours: true, contractorHours: true },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 120,
      });
      const monthly = new Map<string, { lti: number; rec: number; hours: number }>();
      for (const r of rows) {
        const k = `${r.year}-${String(r.month).padStart(2, "0")}`;
        const e = monthly.get(k) ?? { lti: 0, rec: 0, hours: 0 };
        e.lti += r.ltiCount;
        e.rec += r.ltiCount + r.rwcCount + r.mtcCount;
        e.hours += r.employeeHours + r.contractorHours;
        monthly.set(k, e);
      }
      const allKeys = [...monthly.keys()].sort();
      // When a date range is supplied, restrict to months within that range.
      const periodKeys = new Set(buckets.map((b) => `${b.start.getFullYear()}-${String(b.start.getMonth() + 1).padStart(2, "0")}`));
      const selectedKeys = ctx.dateFrom ? allKeys.filter((k) => periodKeys.has(k)) : allKeys.slice(-12);
      const last12 = selectedKeys.length > 0 ? selectedKeys : allKeys.slice(-12);
      const isLtifr = id === "kpi-ltifr";
      const rate = (m: { lti: number; rec: number; hours: number }) => (m.hours ? (isLtifr ? (m.lti * 1_000_000) / m.hours : (m.rec * 200_000) / m.hours) : 0);
      const tl = last12.reduce((s, k) => s + (monthly.get(k)?.lti ?? 0), 0);
      const tr = last12.reduce((s, k) => s + (monthly.get(k)?.rec ?? 0), 0);
      const th = last12.reduce((s, k) => s + (monthly.get(k)?.hours ?? 0), 0);
      const value = th ? (isLtifr ? (tl * 1_000_000) / th : (tr * 200_000) / th) : 0;
      const spark = last12.map((k) => {
        const [y, mo] = k.split("-");
        return { label: new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), value: rate(monthly.get(k)!) };
      });
      return { kind: "kpi", value: value.toFixed(2), unit: isLtifr ? "per 1M hrs" : "per 200k hrs", spark, tone: value < (isLtifr ? 0.5 : 1) ? "good" : "warn", href: "/manhours" };
    }
    case "kpi-active-permits": {
      // Point-in-time count — date range doesn't apply.
      const value = await prisma.permit.count({ where: { ...direct(ctx), status: { in: ["ACTIVE", "SAFETY_APPROVED", "PLANT_HEAD_APPROVED"] } } });
      return { kind: "kpi", value, unit: "in execution", href: "/ptw?status=ACTIVE" };
    }
    case "kpi-observations-mtd": {
      // When a date range is active, count within that range; otherwise use MTD.
      const rangeStart = ctx.dateFrom ?? startOfMonth;
      const rangeEndDate = periodEnd;
      const value = await prisma.observation.count({ where: { ...direct(ctx), date: { gte: rangeStart, ...(rangeEndDate ? { lt: rangeEndDate } : {}) } } });
      const prev = ctx.dateFrom
        ? 0  // no prior-period comparison when a custom range is set
        : await prisma.observation.count({ where: { ...direct(ctx), date: { gte: startOfLastMonth, lt: startOfMonth } } });
      const unit = ctx.dateFrom ? "in period" : "this month";
      return { kind: "kpi", value, unit, delta: { current: value, prior: prev, higherIsBetter: true }, href: "/observations" };
    }
    case "kpi-nearmiss-12mo": {
      const value = await prisma.nearMiss.count({ where: { ...direct(ctx), date: periodFilter } });
      const unit = ctx.dateFrom ? "in period" : "12 months";
      return { kind: "kpi", value, unit, tone: "warn", href: "/near-miss" };
    }
    case "kpi-training-compliance": {
      // Snapshot metric — not filtered by date range.
      const recs = await prisma.trainingRecord.findMany({ where: viaEmployee(ctx), select: { employeeId: true, programId: true, date: true, passed: true, validUntil: true }, orderBy: { date: "desc" }, take: 8000 });
      const latest = new Map<string, (typeof recs)[number]>();
      for (const r of recs) {
        const k = `${r.employeeId}::${r.programId}`;
        const p = latest.get(k);
        if (!p || r.date > p.date) latest.set(k, r);
      }
      const total = latest.size;
      const valid = [...latest.values()].filter((t) => t.passed && t.validUntil > nowDate).length;
      const pct = total ? Math.round((valid / total) * 100) : 0;
      return { kind: "kpi", value: `${pct}%`, unit: "valid certs", tone: pct >= 90 ? "good" : "warn", href: "/training?filter=expired" };
    }
    case "kpi-inspection-compliance": {
      // Snapshot metric — not filtered by date range.
      const [total, done] = await Promise.all([
        prisma.inspection.count({ where: direct(ctx) }),
        prisma.inspection.count({ where: { ...direct(ctx), status: "COMPLETED" } }),
      ]);
      const pct = total ? Math.round((done / total) * 100) : 0;
      return { kind: "kpi", value: `${pct}%`, unit: "completed", tone: pct >= 90 ? "good" : "warn", href: "/inspections?status=OVERDUE" };
    }

    // ── Existing chart widgets ───────────────────────────────────────
    case "heinrich-pyramid": {
      const [inc, nm, obs] = await Promise.all([
        prisma.incident.findMany({ where: { ...direct(ctx), date: periodFilter }, select: { type: true }, take: 8000 }),
        prisma.nearMiss.count({ where: { ...direct(ctx), date: periodFilter } }),
        prisma.observation.count({ where: { ...direct(ctx), date: periodFilter, type: { in: ["UNSAFE_ACT", "UNSAFE_CONDITION"] } } }),
      ]);
      const t = (c: string) => inc.filter((i) => i.type === c).length;
      return {
        levels: [
          { level: "Fatality", count: t("FATALITY"), color: "#7f1d1d" },
          { level: "LTI", count: t("LTI"), color: "#dc2626" },
          { level: "RWC + MTC", count: inc.filter((i) => i.type === "RWC" || i.type === "MTC").length, color: "#ea580c" },
          { level: "First Aid", count: t("FIRST_AID"), color: "#f59e0b" },
          { level: "Near Miss", count: nm, color: "#3b82f6" },
          { level: "Unsafe Acts/Conds", count: obs, color: "#7c3aed" },
        ],
      };
    }
    case "obs-nearmiss-trend": {
      const [obs, nm] = await Promise.all([
        prisma.observation.findMany({ where: { ...direct(ctx), date: periodFilter }, select: { date: true }, take: 12000 }),
        prisma.nearMiss.findMany({ where: { ...direct(ctx), date: periodFilter }, select: { date: true }, take: 12000 }),
      ]);
      const oc = bucketCounts(obs.map((o) => o.date), buckets);
      const nc = bucketCounts(nm.map((n) => n.date), buckets);
      return { months: buckets.map((b, i) => ({ label: b.label, observations: oc[i], nearMiss: nc[i] })) };
    }

    default:
      return { error: `Unknown widget: ${id}` };
  }
}
