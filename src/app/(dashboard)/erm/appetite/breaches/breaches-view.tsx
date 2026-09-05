"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { BREACH_STATUS_CHIP, type AppetiteBreach } from "@/app/(dashboard)/erm/lib-p2";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

const BAND_LABEL: Record<string, string> = {
  MAX_RESIDUAL_SCORE: "Max residual score",
  MAX_CRITICAL_COUNT: "Max critical risks",
  MAX_HIGH_PLUS_COUNT: "Max high+ risks",
  MAX_RED_KRI_COUNT: "Max red KRIs",
};
function bandLabel(t: string): string {
  return BAND_LABEL[t] ?? t.replace(/_/g, " ");
}

function entityHref(e: { id: string; type: string }): string {
  return e.type === "RISK" ? `/erm/register/${e.id}` : `/erm/kris/${e.id}`;
}

export function BreachesView({ breaches }: { breaches: AppetiteBreach[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = breaches.find((b) => b.id === openId) ?? null;

  return (
    <div className="space-y-3">
      {breaches.length === 0 ? (
        <Card className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-none">
          No appetite breaches recorded. Tolerance gauges are within appetite.
        </Card>
      ) : (
        breaches.map((b) => (
          <Button variant="outline"
            key={b.id}
            type="button"
            onClick={() => setOpenId(b.id)} className="h-auto whitespace-normal block w-full rounded-xl p-5 text-left transition-shadow hover:shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{b.categoryName ?? b.categoryCode ?? "—"}</span>
                  <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {bandLabel(b.bandType)}
                  </span>
                  <span
                    className={
                      "rounded border px-2 py-0.5 text-[10px] font-semibold " +
                      (BREACH_STATUS_CHIP[b.status] ?? "bg-slate-100 text-slate-600 border-slate-200")
                    }
                  >
                    {b.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle size={12} className="text-rose-500" />
                    observed <b className="tabular-nums text-rose-700">{b.observedValue}</b> vs threshold{" "}
                    <b className="tabular-nums">{b.thresholdValue}</b>
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Clock size={12} /> {b.ageDays}d old
                  </span>
                </div>
                {b.triggeringEntities.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] text-slate-400">triggered by</span>
                    {b.triggeringEntities.map((e) => (
                      <Link
                        key={e.id}
                        href={entityHref(e)}
                        onClick={(ev) => ev.stopPropagation()}
                        className={
                          "rounded border px-1.5 py-0.5 text-[10px] font-medium hover:underline " +
                          (e.type === "RISK"
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-cyan-200 bg-cyan-50 text-cyan-700")
                        }
                        title={e.title}
                      >
                        {e.type} · {e.code}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Button>
        ))
      )}

      {selected && <BreachDrawer breach={selected} onClose={() => setOpenId(null)} />}
    </div>
  );
}

const ACTIONS: { action: string; label: string; needsReviewBy?: boolean }[] = [
  { action: "UNDER_REVIEW", label: "Mark Under Review" },
  { action: "TREATMENT_MANDATED", label: "Mandate Treatment" },
  { action: "TEMPORARILY_ACCEPTED", label: "Temporarily Accept", needsReviewBy: true },
  { action: "RESOLVED", label: "Resolve" },
];

function BreachDrawer({ breach, onClose }: { breach: AppetiteBreach; onClose: () => void }) {
  const router = useRouter();
  const [action, setAction] = useState<string>("UNDER_REVIEW");
  const [committeeDecision, setCommitteeDecision] = useState("");
  const [reviewByDate, setReviewByDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const needsReviewBy = ACTIONS.find((a) => a.action === action)?.needsReviewBy ?? false;

  // reviewByDate must be ≤ 90 days from today for a temporary acceptance.
  const maxReviewBy = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  })();
  const today = new Date().toISOString().slice(0, 10);

  async function submit() {
    setErr(null);
    if (!committeeDecision.trim()) {
      setErr("Enter the committee decision / rationale.");
      return;
    }
    if (needsReviewBy) {
      if (!reviewByDate) {
        setErr("A temporary acceptance requires a review-by date (≤ 90 days).");
        return;
      }
      if (reviewByDate > maxReviewBy) {
        setErr("The review-by date must be within 90 days.");
        return;
      }
    }
    setBusy(true);
    try {
      const body: any = { action, committeeDecision: committeeDecision.trim() };
      if (needsReviewBy) body.reviewByDate = reviewByDate;
      const res = await fetch(`/api/erm/appetite/breaches/${breach.id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.detail || j.error || `Failed (${res.status})`);
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]">
      <div className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              {breach.categoryName ?? breach.categoryCode} breach
            </h2>
            <p className="text-xs text-slate-500">
              {bandLabel(breach.bandType)} · detected {fmtDate(breach.detectedAt)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-700">
            <X size={18} />
          </Button>
        </div>

        <div className="space-y-5 p-5">
          {/* Snapshot */}
          <Card className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center shadow-none">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Observed</div>
              <div className="text-xl font-bold tabular-nums text-rose-700">{breach.observedValue}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Threshold</div>
              <div className="text-xl font-bold tabular-nums text-slate-700">{breach.thresholdValue}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Age</div>
              <div className="text-xl font-bold tabular-nums text-slate-700">{breach.ageDays}d</div>
            </div>
          </Card>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Status</span>
            <span
              className={
                "rounded border px-2 py-0.5 text-[11px] font-semibold " +
                (BREACH_STATUS_CHIP[breach.status] ?? "bg-slate-100 text-slate-600 border-slate-200")
              }
            >
              {breach.status.replace(/_/g, " ")}
            </span>
          </div>

          {/* Triggering entities */}
          {breach.triggeringEntities.length > 0 && (
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Triggering entities
              </h3>
              <ul className="space-y-1.5">
                {breach.triggeringEntities.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={entityHref(e)}
                      className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm hover:border-primary-300"
                    >
                      <span
                        className={
                          "rounded border px-1.5 py-0.5 text-[10px] font-medium " +
                          (e.type === "RISK"
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-cyan-200 bg-cyan-50 text-cyan-700")
                        }
                      >
                        {e.type}
                      </span>
                      <span className="font-medium text-primary-700">{e.code}</span>
                      <span className="truncate text-slate-600">{e.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Existing decision */}
          {(breach.committeeDecision || breach.decisionByName || breach.reviewByDate) && (
            <Card className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 shadow-none">
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Committee decision
              </h3>
              {breach.committeeDecision && (
                <p className="text-sm text-slate-700">{breach.committeeDecision}</p>
              )}
              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                {breach.decisionByName && <span>by {breach.decisionByName}</span>}
                {breach.reviewByDate && <span>review by {fmtDate(breach.reviewByDate)}</span>}
              </div>
            </Card>
          )}

          {/* Decision workflow (CRO only — backend enforces) */}
          <Card className="rounded-lg border border-slate-200 p-4 shadow-none">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Record committee decision</h3>
            <p className="mb-3 text-[11px] text-slate-400">
              Decisions are restricted to the CRO; the backend enforces the role.
            </p>

            {err && (
              <Alert variant="destructive" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-800">
                {err}
              </Alert>
            )}

            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {ACTIONS.map((a) => (
                <Button
                  key={a.action}
                  type="button"
                  variant="ghost"
                  onClick={() => setAction(a.action)}
                  className={cn(
                    "h-auto rounded-lg border px-2 py-2 text-xs font-medium",
                    action === a.action
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-400"
                  )}
                >
                  {a.label}
                </Button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <Label className="mb-1 block text-xs font-medium text-slate-600">
                  Committee decision (required)
                </Label>
                <Textarea
                  value={committeeDecision}
                  onChange={(e) => setCommitteeDecision(e.target.value)}
                  rows={3}
                  placeholder="Rationale, conditions, owner…"
                />
              </div>
              {needsReviewBy && (
                <div>
                  <Label className="mb-1 block text-xs font-medium text-slate-600">
                    Review-by date (≤ 90 days)
                  </Label>
                  <Input
                    type="date"
                    value={reviewByDate}
                    min={today}
                    max={maxReviewBy}
                    onChange={(e) => setReviewByDate(e.target.value)}
                  />
                </div>
              )}
              <Button onClick={submit} disabled={busy} className="w-full text-sm font-medium text-white disabled:opacity-50">
                {busy ? "Recording…" : "Record decision"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
