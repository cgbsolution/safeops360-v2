"use client";

// One slot, in full — plan, link, amendment trail, and the moves it can make.
//
// The layout follows the one distinction the whole module rests on: **a slot is
// not an engagement.** The left column is the PLAN (window, scope, estimate,
// sampling basis); the right column is what became of it (the engagement, or
// the amendments explaining why nothing did). The gap between the two is the
// programme's entire value as a monitoring instrument.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRightLeft, CalendarRange, Gauge, Link2, Zap, FileClock, ArrowRight, ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePermission } from "@/components/auth/can";
import { UserRefLabel, type UserDirectory } from "@/lib/users/user-ref";
import { MaterialiseDialog } from "@/components/programme/materialise-dialog";
import { SlotTransitionDialog } from "@/components/programme/slot-transition-dialog";
import {
  ORIGIN_LABEL, SLOT_STATUS_CHIP, fmtDate, siteText, type SlotDetail,
} from "@/app/(dashboard)/cams/programme/lib-programme";

export function SlotDetailView({
  programmeId, detail, sites, userDir,
}: {
  programmeId: string;
  detail: SlotDetail;
  sites: { id: string; code: string; name: string }[];
  userDir: UserDirectory;
}) {
  const router = useRouter();
  const { slot, plan, cycle, amendments } = detail;
  const canSchedule = usePermission("CAMS.SCHEDULE");
  const canClose = usePermission("CAMS.CLOSE");
  const [materialising, setMaterialising] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const canMaterialise =
    canSchedule && !slot.engagementId && slot.allowedTransitions.includes("SCHEDULED");
  const engagementHref =
    slot.engagementKind === "AUDIT"
      ? `/cams/audits/${slot.engagementId}`
      : `/cams/engagements/${slot.engagementId}`;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3">
        <span className={cn("rounded border px-2 py-0.5 text-xs", SLOT_STATUS_CHIP[slot.status] ?? "")}>
          {slot.status.replace(/_/g, " ").toLowerCase()}
        </span>
        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
          {ORIGIN_LABEL[slot.origin]}
          {slot.externalBody ? ` · ${slot.externalBody}` : ""}
        </span>
        {cycle && (
          <Link href={`/cams/programme/${programmeId}?cycle=${cycle.id}`}
            className="text-xs text-violet-800 hover:underline">
            {cycle.cycleLabel}
          </Link>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {canMaterialise && (
            <Button type="button" size="sm" onClick={() => setMaterialising(true)}>
              <Zap size={14} /> Materialise
            </Button>
          )}
          {(canSchedule || canClose) && slot.allowedTransitions.length > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={() => setTransitioning(true)}>
              <ArrowRightLeft size={13} /> Move
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── The plan ─────────────────────────────────────────────── */}
        <Card className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-800">The plan</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            A window, not a date — a programme that commits to a single day twelve months out is
            lying, and the variance report needs a window to measure drift against.
          </p>

          <dl className="mt-3 space-y-2 text-sm">
            <Row icon={<CalendarRange size={13} />} label="Window">
              {fmtDate(slot.windowStart)} – {fmtDate(slot.windowEnd)}
              <span className="ml-1 text-slate-400">· P{slot.periodIndex + 1}</span>
            </Row>
            <Row icon={<Gauge size={13} />} label="Estimated load">
              {slot.estimatedAuditorDays} auditor-day{slot.estimatedAuditorDays === 1 ? "" : "s"}
              {slot.actualAuditorDays != null && (
                <span className="ml-1 text-slate-500">· {slot.actualAuditorDays} actual</span>
              )}
            </Row>
            <Row label="Intended lead">
              {slot.intendedLeadUserId
                ? <UserRefLabel dir={userDir} id={slot.intendedLeadUserId} />
                : <span className="text-slate-400">not assigned at planning time</span>}
            </Row>
            <Row label="Sampling">
              {slot.samplingApproach === "FULL" ? (
                <span className="text-slate-600">Full — every checkpoint assessed</span>
              ) : (
                <>
                  <span className="rounded border border-teal-200 bg-teal-50 px-1.5 text-[11px] text-teal-800">
                    {slot.samplingApproach.replace(/_/g, " ").toLowerCase()}
                  </span>
                  {slot.samplingJustification && (
                    <p className="mt-1 text-xs text-slate-600">{slot.samplingJustification}</p>
                  )}
                </>
              )}
            </Row>
          </dl>

          <div className="mt-3 border-t border-slate-100 pt-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Scope units covered
            </div>
            {plan.scopeUnits.length === 0 ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
                <ShieldAlert size={12} />
                None — this slot contributes nothing to coverage.
              </p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1">
                {plan.scopeUnits.map((u) => (
                  <span key={u.id}
                    className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-800">
                    {u.dimensionLabel}
                    <span className="text-violet-400"> · {siteText(u, { short: true })}</span>
                  </span>
                ))}
              </div>
            )}
            {plan.standardRefs.length > 0 && (
              <div className="mt-2 text-[11px] text-slate-500">
                Standards: {plan.standardRefs.join(", ")}
              </div>
            )}
          </div>
        </Card>

        {/* ── What became of it ────────────────────────────────────── */}
        <Card className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-800">What happened</h3>

          {slot.engagementId ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-900">
                <Link2 size={13} /> Materialised as {slot.engagementKind?.toLowerCase()}
              </div>
              <Link href={engagementHref}
                className="mt-1 inline-flex items-center gap-1 text-sm text-emerald-900 hover:underline">
                Open the engagement <ArrowRight size={13} />
              </Link>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-center">
              <p className="text-sm text-slate-600">Not materialised yet.</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
                Materialising creates the engagement this slot planned — pre-filled with its scope,
                standards and window — and links it back automatically.
              </p>
              {canMaterialise && (
                <Button type="button" size="sm" className="mt-3" onClick={() => setMaterialising(true)}>
                  <Zap size={14} /> Materialise
                </Button>
              )}
            </div>
          )}

          <div className="mt-4">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              <FileClock size={12} /> Amendments
            </div>
            {amendments.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                None — this slot has run as approved.
              </p>
            ) : (
              <div className="mt-1.5 space-y-2">
                {amendments.map((a) => (
                  <div key={a.id} className="rounded-lg border border-slate-200 p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        {a.amendmentType.replace(/_/g, " ").toLowerCase()}
                      </span>
                      <span className="text-[11px] text-slate-400">{fmtDate(a.approvedAt)}</span>
                      <span className="ml-auto text-[11px] text-slate-500">
                        <UserRefLabel dir={userDir} id={a.approvedByUserId} showRole={false} showPlant={false} />
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-700">{a.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {materialising && (
        <MaterialiseDialog plan={plan} sites={sites} onClose={() => setMaterialising(false)} />
      )}
      {transitioning && (
        <SlotTransitionDialog
          slot={slot}
          onClose={() => setTransitioning(false)}
          onMaterialise={() => { setTransitioning(false); setMaterialising(true); }}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}

function Row({
  icon, label, children,
}: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-2">
      <dt className="inline-flex min-w-28 items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm text-slate-700">{children}</dd>
    </div>
  );
}
