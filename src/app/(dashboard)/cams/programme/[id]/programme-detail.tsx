"use client";

// Programme detail — cycle switcher, governance bar, and the tabs.
//
// The tabs mirror what the programme is FOR, in the order a certification body
// asks about it: what did you plan to cover (Coverage · Scope) · what actually
// happened (Variance) · why did the plan change (Amendments) · how do you know
// the programme itself is working (Reviews) · is the record self-consistent
// (the integrity strip).
//
// Variance is the tab that justifies modelling a slot separately from an
// engagement. Collapse the two and every column here becomes unanswerable.
//
// The governance bar above them is what turns this from a read-only report into
// the artefact itself: submit → approve → activate → close, each guarded, with
// the approval blockers rendered per scope unit before the click rather than
// after a failed POST.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Grid3x3, GitCompareArrows, FileClock, ClipboardList, ShieldAlert,
  ArrowRight, AlertCircle, CheckCircle2, CalendarRange, Gauge, Layers, MessageSquareQuote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/select-field";
import { CoverageMatrix } from "@/components/programme/coverage-matrix";
import { SlotManager } from "@/components/programme/slot-manager";
import { RecommendationPanel } from "@/components/programme/recommendation-panel";
import { CycleGovernance } from "@/components/programme/cycle-governance";
import { ScopeUnitManager } from "@/components/programme/scope-unit-manager";
import { ReviewPanel } from "@/components/programme/review-panel";
import { usePermission } from "@/components/auth/can";
import { UserRefLabel, type UserDirectory } from "@/lib/users/user-ref";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CYCLE_STATUS_CHIP, ORIGIN_LABEL, SLOT_STATUS_CHIP,
  driftLabel, fmtDate,
  type AmendmentRow, type ApprovalReport, type CoverageResponse, type IntegrityReport,
  type ProgrammeCycleRow, type ProgrammeRow, type RecommendationRow, type ReviewRow,
  type ScopeUnitRow, type SlotRow, type VarianceRow,
} from "../lib-programme";

type Tab =
  | "coverage" | "scope" | "slots" | "frequency"
  | "variance" | "amendments" | "reviews" | "load";

export function ProgrammeDetailView({
  programme, cycle, coverage, variance, amendments, integrity,
  slots = [], scopeUnits = [], recommendations = [], reviews = [],
  approval = null, userDir = {},
}: {
  programme: ProgrammeRow;
  cycle: ProgrammeCycleRow | null;
  coverage: CoverageResponse | null;
  variance: VarianceRow[];
  amendments: AmendmentRow[];
  integrity: IntegrityReport | null;
  slots?: SlotRow[];
  scopeUnits?: ScopeUnitRow[];
  recommendations?: RecommendationRow[];
  reviews?: ReviewRow[];
  approval?: ApprovalReport | null;
  userDir?: UserDirectory;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("coverage");
  const canSchedule = usePermission("CAMS.SCHEDULE");
  const canClose = usePermission("CAMS.CLOSE");

  if (!cycle) {
    return (
      <Card className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
        <p className="text-sm text-slate-600">This programme has no cycle yet.</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
          A cycle is one period instance — a financial year, or a three-year certification cycle.
          Coverage is measured within it.
        </p>
      </Card>
    );
  }

  const openRecs = recommendations.filter((r) => r.isOpen).length;
  const lateCount = variance.filter((v) => v.isLate).length;
  const notExecuted = variance.filter((v) => v.notExecuted).length;
  const blockerCount = approval?.blockers.length ?? 0;
  // Slots per scope unit — the "has a frequency but no planned slot" blocker
  // reads better next to the number it is complaining about.
  const slotCountByUnit: Record<string, number> = {};
  for (const s of slots) {
    for (const id of s.scopeUnitIds) slotCountByUnit[id] = (slotCountByUnit[id] ?? 0) + 1;
  }

  return (
    <div className="space-y-5">
      {/* Cycle switcher */}
      <Card className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
        <SelectField
          value={cycle.id}
          onChange={(value) => router.push(`/cams/programme/${programme.id}?cycle=${value}`)}
          className="h-9 w-auto"
          aria-label="Cycle"
          options={programme.cycles.map((c) => ({ value: c.id, label: `${c.cycleLabel}` }))}
        />
        <span className={cn("rounded border px-2 py-0.5 text-xs", CYCLE_STATUS_CHIP[cycle.status] ?? "")}>
          {cycle.status.replace(/_/g, " ").toLowerCase()}
        </span>
        <span className="text-xs text-slate-500">
          {fmtDate(cycle.periodStart)} – {fmtDate(cycle.periodEnd)} · {cycle.periodsPerCycle} periods
        </span>
        {cycle.status === "APPROVED" || cycle.status === "ACTIVE" || cycle.status === "CLOSED" ? (
          <span className="ml-auto text-[11px] text-slate-400">
            Approved plan is frozen — changes are recorded as amendments
          </span>
        ) : (
          <span className="ml-auto text-[11px] text-amber-600">
            Draft — not yet the plan of record
          </span>
        )}
      </Card>

      {/* Integrity strip — internal, and every count must read zero. */}
      {integrity && !integrity.clean && (
        <Card className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-800">
            <ShieldAlert size={15} /> Programme data integrity
          </div>
          {integrity.slotsNonPlannedWithoutEngagementOrAmendment.length > 0 && (
            <p className="mt-1 text-xs text-rose-700">
              {integrity.slotsNonPlannedWithoutEngagementOrAmendment.length} slot(s) left PLANNED
              with neither an engagement nor an amendment:{" "}
              {integrity.slotsNonPlannedWithoutEngagementOrAmendment.join(", ")}
            </p>
          )}
          {integrity.scopeUnitsWithoutFrequencyOrWaiver.length > 0 && (
            <p className="mt-1 text-xs text-rose-700">
              {integrity.scopeUnitsWithoutFrequencyOrWaiver.length} scope unit(s) on an approved
              cycle carry neither a frequency nor a waiver.
            </p>
          )}
        </Card>
      )}

      <CycleGovernance
        programme={programme}
        cycle={cycle}
        approval={approval}
        reviews={reviews}
        userDir={userDir}
        canSchedule={canSchedule}
        canClose={canClose}
        onGoToScope={() => setTab("scope")}
        onGoToReviews={() => setTab("reviews")}
      />

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        <TabBtn active={tab === "coverage"} onClick={() => setTab("coverage")}>
          <Grid3x3 size={14} /> Coverage
        </TabBtn>
        <TabBtn active={tab === "scope"} onClick={() => setTab("scope")}>
          <Layers size={14} /> Scope
          <span className="ml-1 rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">
            {scopeUnits.length}
          </span>
          {blockerCount > 0 && (
            <span className="ml-1 rounded bg-amber-100 px-1.5 text-[10px] text-amber-800">
              {blockerCount}
            </span>
          )}
        </TabBtn>
        <TabBtn active={tab === "slots"} onClick={() => setTab("slots")}>
          <CalendarRange size={14} /> Slots
          <span className="ml-1 rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">
            {slots.length}
          </span>
        </TabBtn>
        <TabBtn active={tab === "frequency"} onClick={() => setTab("frequency")}>
          <Gauge size={14} /> Frequency
          {openRecs > 0 && (
            <span className="ml-1 rounded bg-violet-100 px-1.5 text-[10px] text-violet-800">
              {openRecs}
            </span>
          )}
        </TabBtn>
        <TabBtn active={tab === "variance"} onClick={() => setTab("variance")}>
          <GitCompareArrows size={14} /> Plan vs actual
          {(lateCount || notExecuted) > 0 && (
            <span className="ml-1 rounded bg-amber-100 px-1.5 text-[10px] text-amber-800">
              {lateCount + notExecuted}
            </span>
          )}
        </TabBtn>
        <TabBtn active={tab === "amendments"} onClick={() => setTab("amendments")}>
          <FileClock size={14} /> Amendments
          <span className="ml-1 rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">
            {amendments.length}
          </span>
        </TabBtn>
        <TabBtn active={tab === "reviews"} onClick={() => setTab("reviews")}>
          <MessageSquareQuote size={14} /> Reviews
          <span className={cn(
            "ml-1 rounded px-1.5 text-[10px]",
            reviews.length ? "bg-slate-100 text-slate-600" : "bg-sky-100 text-sky-800",
          )}>
            {reviews.length}
          </span>
        </TabBtn>
        <TabBtn active={tab === "load"} onClick={() => setTab("load")}>
          <ClipboardList size={14} /> Auditor load
          {(coverage?.summary.collisionCount ?? 0) > 0 && (
            <span className="ml-1 rounded bg-rose-100 px-1.5 text-[10px] text-rose-800">
              {coverage!.summary.collisionCount}
            </span>
          )}
        </TabBtn>
      </div>

      {tab === "coverage" &&
        (coverage ? (
          <CoverageMatrix data={coverage} />
        ) : (
          <EmptyTab text="Coverage could not be computed for this cycle." />
        ))}

      {tab === "scope" && (
        <ScopeUnitManager
          cycle={cycle}
          scopeUnits={scopeUnits}
          blockers={approval?.blockers ?? []}
          slotCountByUnit={slotCountByUnit}
          canManage={canSchedule}
        />
      )}

      {tab === "slots" && (
        <SlotManager
          cycle={cycle}
          programmeId={programme.id}
          slots={slots}
          scopeUnits={scopeUnits}
          canManage={canSchedule || canClose}
        />
      )}

      {tab === "frequency" && (
        <RecommendationPanel
          cycleId={cycle.id}
          rows={recommendations}
          scopeUnits={scopeUnits}
          canManage={canSchedule}
        />
      )}

      {tab === "variance" && <VarianceTab rows={variance} />}
      {tab === "amendments" && <AmendmentsTab rows={amendments} />}
      {tab === "reviews" && (
        <ReviewPanel
          cycle={cycle}
          reviews={reviews}
          amendments={amendments}
          userDir={userDir}
          canManage={canSchedule}
        />
      )}
      {tab === "load" && <LoadTab coverage={coverage} userDir={userDir} />}
    </div>
  );
}

function TabBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
        active ? "border-violet-600 text-violet-800" : "border-transparent text-slate-500 hover:text-slate-800",
      )}
    >
      {children}
    </button>
  );
}

function EmptyTab({ text }: { text: string }) {
  return (
    <Card className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
      {text}
    </Card>
  );
}

function VarianceTab({ rows }: { rows: VarianceRow[] }) {
  if (!rows.length) return <EmptyTab text="No slots in this cycle yet." />;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        A slot holds the <strong>plan</strong>; the engagement is what happened. The gap between
        them — timing drift, scope variance, non-execution — is what a certification body asks
        about, and it is only answerable because the two are modelled separately.
      </p>

      {/* Desktop */}
      <Card className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
        <Table className="w-full text-sm">
          <TableHeader className="bg-slate-50 text-left text-xs text-slate-500">
            <TableRow>
              <TableHead className="px-3 py-2 font-medium">Slot</TableHead>
              <TableHead className="px-3 py-2 font-medium">Planned window</TableHead>
              <TableHead className="px-3 py-2 font-medium">Engagement</TableHead>
              <TableHead className="px-3 py-2 font-medium">Drift</TableHead>
              <TableHead className="px-3 py-2 font-medium">Scope variance</TableHead>
              <TableHead className="px-3 py-2 font-medium">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <TableRow key={r.slotId} className="hover:bg-slate-50/60">
                <TableCell className="px-3 py-2">
                  <div className="font-medium text-slate-800">{r.slotCode}</div>
                  <div className="text-[10px] text-slate-400">{ORIGIN_LABEL[r.origin]}</div>
                </TableCell>
                <TableCell className="px-3 py-2 text-xs text-slate-600">
                  {fmtDate(r.windowStart)} – {fmtDate(r.windowEnd)}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  {r.engagement ? (
                    <a
                      href={
                        r.engagement.engagementKind === "AUDIT"
                          ? `/cams/audits/${r.engagement.engagementId}`
                          : `/cams/engagements/${r.engagement.engagementId}`
                      }
                      className="text-violet-800 hover:underline"
                    >
                      {r.engagement.code}
                    </a>
                  ) : (
                    <span className="text-slate-400">not materialised</span>
                  )}
                </TableCell>
                <TableCell className={cn("px-3 py-2 text-xs", r.isLate ? "text-amber-700" : "text-slate-600")}>
                  {driftLabel(r.timingDriftDays)}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  {r.hasScopeVariance ? (
                    <span className="text-amber-700" title={r.scopeVariance.join(", ")}>
                      {r.scopeVariance.length} planned scope unit(s) not assessed
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2">
                  <span className={cn("rounded border px-1.5 py-0.5 text-[11px]", SLOT_STATUS_CHIP[r.status] ?? "")}>
                    {r.status.replace(/_/g, " ").toLowerCase()}
                  </span>
                  {r.notExecuted && r.amendmentCount > 0 && (
                    <span className="ml-1 text-[10px] text-slate-500">
                      {r.amendmentCount} amendment{r.amendmentCount === 1 ? "" : "s"}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* 390px card list */}
      <div className="space-y-2 lg:hidden">
        {rows.map((r) => (
          <Card key={r.slotId} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-800">{r.slotCode}</span>
              <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", SLOT_STATUS_CHIP[r.status] ?? "")}>
                {r.status.replace(/_/g, " ").toLowerCase()}
              </span>
              {r.isLate && (
                <span className="ml-auto text-[11px] text-amber-700">{driftLabel(r.timingDriftDays)}</span>
              )}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {fmtDate(r.windowStart)} – {fmtDate(r.windowEnd)}
              {r.engagement && <span className="text-slate-400"> → {r.engagement.code}</span>}
            </div>
            {r.hasScopeVariance && (
              <div className="mt-1 text-[11px] text-amber-700">
                {r.scopeVariance.length} planned scope unit(s) not assessed
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function AmendmentsTab({ rows }: { rows: AmendmentRow[] }) {
  if (!rows.length) {
    return (
      <Card className="rounded-xl border border-slate-200 p-8 text-center">
        <CheckCircle2 size={22} className="mx-auto text-emerald-500" />
        <p className="mt-2 text-sm text-slate-600">No amendments — the plan has run as approved.</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
          Every deferral, cancellation or waiver after approval is recorded here with its reason and
          approver. A certification body asks why a planned audit did not happen; this is the answer.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((a) => (
        <Card key={a.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
              {a.amendmentType.replace(/_/g, " ").toLowerCase()}
            </span>
            {a.slotId && <span className="text-[11px] text-slate-400">slot {a.slotId.slice(0, 8)}</span>}
            <span className="ml-auto text-[11px] text-slate-400">{fmtDate(a.approvedAt)}</span>
          </div>
          <p className="mt-1.5 text-sm text-slate-700">{a.reason}</p>
          {a.beforeValue && a.afterValue && (
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
              <span>{String((a.beforeValue as any).status ?? "")}</span>
              <ArrowRight size={11} />
              <span>{String((a.afterValue as any).status ?? "")}</span>
              {(a.afterValue as any).windowStart && (
                <span className="ml-1">
                  new window {fmtDate(String((a.afterValue as any).windowStart))} –{" "}
                  {fmtDate(String((a.afterValue as any).windowEnd))}
                </span>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function LoadTab({
  coverage, userDir,
}: { coverage: CoverageResponse | null; userDir: UserDirectory }) {
  if (!coverage || !coverage.auditorLoad.length) {
    return <EmptyTab text="No auditor-days allocated in this cycle yet." />;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Estimated auditor-days per person per period, with window collisions flagged. This is also
        where an independence problem shows up at <em>planning</em> time rather than at assignment.
      </p>
      {coverage.auditorLoad.map((l) => (
        <Card key={l.userId} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Name · plant · role, never a raw id — platform convention. */}
            <UserRefLabel dir={userDir} id={l.userId} className="text-sm" />
            <span className="text-xs text-slate-500">{l.totalDays} auditor-days</span>
            {l.collisions.length > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-700">
                <AlertCircle size={11} /> {l.collisions.length} collision
                {l.collisions.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {coverage.periods.map((p) => (
              <span
                key={p.periodIndex}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
              >
                {p.label}: {l.byPeriod[String(p.periodIndex)] ?? 0}d
              </span>
            ))}
          </div>
          {l.collisions.map((c, i) => (
            <p key={i} className="mt-1 text-[11px] text-rose-700">
              {c.reason}
            </p>
          ))}
        </Card>
      ))}
    </div>
  );
}
