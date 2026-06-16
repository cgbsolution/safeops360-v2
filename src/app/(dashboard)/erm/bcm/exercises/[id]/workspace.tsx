"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhoneCall, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EXERCISE_STATUS_CHIP,
  FINDING_SEVERITY_CHIP,
  fmtRto,
  type Exercise,
} from "@/app/(dashboard)/erm/lib-p3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";

const TYPE_LABEL: Record<string, string> = {
  DESK_CHECK: "Desk Check",
  TABLETOP: "Tabletop",
  SIMULATION: "Simulation",
  FULL_INTERRUPTION_TEST: "Full Interruption",
  CALL_TREE_TEST: "Call-Tree Test",
};

const FINDING_SEVERITIES = ["OBSERVATION", "MINOR_GAP", "MAJOR_GAP"] as const;

export function ExerciseWorkspace({
  exercise,
  planLabels = {},
  scenarioLabels = {},
}: {
  exercise: Exercise;
  planLabels?: Record<string, string>;
  scenarioLabels?: Record<string, string>;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "finding" | "complete">(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  async function post(path: string, body?: any): Promise<boolean> {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/erm/bcm/exercises/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setBanner(j.detail || j.error || `Failed (${res.status}).`);
        return false;
      }
      router.refresh();
      return true;
    } catch (e: any) {
      setBanner(e?.message ?? "Network error.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const stats = exercise.callTreeStats as
    | { notified?: number; acknowledged?: number; medianAckMinutes?: number }
    | null;
  const isCompleted = exercise.status === "COMPLETED";

  return (
    <div className="space-y-4">
      {banner && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{banner}</div>
      )}

      {/* Header / meta card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{exercise.title}</h1>
              <span
                className={
                  "rounded border px-2 py-0.5 text-[11px] font-medium " +
                  (EXERCISE_STATUS_CHIP[exercise.status] ?? "")
                }
              >
                {exercise.status.replace(/_/g, " ")}
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                {TYPE_LABEL[exercise.exerciseType] ?? exercise.exerciseType.replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Facilitator <b>{exercise.facilitatorName ?? "—"}</b> · Scheduled {fmtDate(exercise.scheduledDate)}
              {exercise.conductedDate && <> · Conducted {fmtDate(exercise.conductedDate)}</>}
              {exercise.siteName && <> · {exercise.siteName}</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {exercise.exerciseType === "CALL_TREE_TEST" && !isCompleted && (
              <button
                onClick={() => post(`${exercise.id}/run-call-tree-test`)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-primary-500 disabled:opacity-50"
              >
                <PhoneCall size={15} /> Run call-tree test
              </button>
            )}
            {!isCompleted && (
              <button
                onClick={() => setModal("complete")}
                disabled={busy}
                className="rounded-lg bg-primary-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
              >
                Complete exercise
              </button>
            )}
          </div>
        </div>

        {exercise.openCapaCount > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            {exercise.openCapaCount} open CAPA(s) from this exercise
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: scope */}
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Objectives</h3>
            {exercise.objectives.length === 0 ? (
              <p className="text-xs text-slate-400">No objectives recorded.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700">
                {exercise.objectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Plans under test</h3>
            {exercise.testedPlanIds.length === 0 ? (
              <p className="text-xs text-slate-400">No plans linked.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {exercise.testedPlanIds.map((pid) => (
                  <li key={pid}>
                    <Link href={`/erm/bcm/plans/${pid}`} className="text-primary-700 hover:underline">
                      {planLabels[pid] ?? pid}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {exercise.testedScenarioId && (
              <p className="mt-3 text-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Scenario: </span>
                <Link href={`/erm/bcm/scenarios/${exercise.testedScenarioId}`} className="text-primary-700 hover:underline">
                  {scenarioLabels[exercise.testedScenarioId] ?? exercise.testedScenarioId}
                </Link>
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Participants</h3>
            {exercise.participants.length === 0 ? (
              <p className="text-xs text-slate-400">No participants recorded.</p>
            ) : (
              <p className="text-sm text-slate-700">{exercise.participants.length} participant(s)</p>
            )}
          </div>

          {stats && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Call-tree results
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xl font-bold tabular-nums text-slate-900">{stats.notified ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Notified</div>
                </div>
                <div>
                  <div className="text-xl font-bold tabular-nums text-emerald-600">{stats.acknowledged ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Acked</div>
                </div>
                <div>
                  <div className="text-xl font-bold tabular-nums text-slate-900">{stats.medianAckMinutes ?? "—"}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Median min</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: findings + report */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Findings</h3>
              <button
                onClick={() => setModal("finding")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-primary-500 disabled:opacity-50"
              >
                <Plus size={14} /> Add finding
              </button>
            </div>
            {exercise.findings.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                No findings yet. Capture observations and gaps as the exercise runs.
              </p>
            ) : (
              <ul className="space-y-2">
                {exercise.findings.map((f) => (
                  <li key={f.id} className="rounded-lg border border-slate-100 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span
                          className={
                            "mb-1 inline-block rounded border px-2 py-0.5 text-[10px] font-medium " +
                            (FINDING_SEVERITY_CHIP[f.severity] ?? "")
                          }
                        >
                          {f.severity.replace(/_/g, " ")}
                        </span>
                        <p className="text-sm text-slate-700">{f.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {f.capaId ? (
                          <Link href={`/capa/${f.capaId}`} className="text-xs font-medium text-primary-700 hover:underline">
                            CAPA ↗
                          </Link>
                        ) : f.severity === "MAJOR_GAP" ? (
                          <button
                            onClick={() => post(`findings/${f.id}/raise-capa`)}
                            disabled={busy}
                            className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            Raise CAPA
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-slate-400">
              A MAJOR GAP finding must have a linked CAPA before the exercise can be completed.
            </p>
          </div>

          {exercise.reportRichText && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Exercise report</h3>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{exercise.reportRichText}</p>
              {exercise.rtoAchievedHours != null && (
                <p className="mt-2 text-xs text-slate-500">
                  RTO achieved: <b>{fmtRto(exercise.rtoAchievedHours)}</b>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {modal === "finding" && (
        <FindingModal
          onClose={() => setModal(null)}
          onSubmit={async (body) => {
            const ok = await post(`${exercise.id}/findings`, body);
            if (ok) setModal(null);
          }}
          busy={busy}
        />
      )}
      {modal === "complete" && (
        <CompleteModal
          onClose={() => setModal(null)}
          onSubmit={async (body) => {
            const ok = await post(`${exercise.id}/complete`, body);
            if (ok) setModal(null);
          }}
          busy={busy}
        />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FindingModal({
  onClose,
  onSubmit,
  busy,
}: {
  onClose: () => void;
  onSubmit: (body: any) => void;
  busy: boolean;
}) {
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<string>("OBSERVATION");
  return (
    <Modal title="Add finding" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Severity</label>
          <div className="grid grid-cols-3 gap-1.5">
            {FINDING_SEVERITIES.map((s) => (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-medium",
                  severity === s ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200",
                )}
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            placeholder="What was observed and why it matters…"
          />
        </div>
        <button
          onClick={() => onSubmit({ description: description.trim(), severity })}
          disabled={busy || !description.trim()}
          className="w-full rounded-lg bg-primary-700 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add finding"}
        </button>
      </div>
    </Modal>
  );
}

const OUTCOMES = ["MET_OBJECTIVES", "PARTIALLY_MET", "NOT_MET"] as const;

function CompleteModal({
  onClose,
  onSubmit,
  busy,
}: {
  onClose: () => void;
  onSubmit: (body: any) => void;
  busy: boolean;
}) {
  const [outcome, setOutcome] = useState<string>("MET_OBJECTIVES");
  const [conductedDate, setConductedDate] = useState("");
  const [rtoAchievedHours, setRtoAchievedHours] = useState("");
  const [reportRichText, setReportRichText] = useState("");
  return (
    <Modal title="Complete exercise" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Outcome</label>
          <div className="grid grid-cols-3 gap-1.5">
            {OUTCOMES.map((o) => (
              <button
                key={o}
                onClick={() => setOutcome(o)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-medium",
                  outcome === o ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200",
                )}
              >
                {o.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Conducted date</label>
            <input
              type="date"
              value={conductedDate}
              onChange={(e) => setConductedDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">RTO achieved (hours)</label>
            <input
              type="number"
              min={0}
              value={rtoAchievedHours}
              onChange={(e) => setRtoAchievedHours(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Report</label>
          <textarea
            value={reportRichText}
            onChange={(e) => setReportRichText(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            placeholder="Summary of conduct, what worked, what failed, recommendations…"
          />
        </div>
        <button
          onClick={() =>
            onSubmit({
              outcome,
              conductedDate: conductedDate || null,
              rtoAchievedHours: rtoAchievedHours ? Number(rtoAchievedHours) : null,
              reportRichText: reportRichText.trim() || null,
            })
          }
          disabled={busy || !conductedDate}
          className="w-full rounded-lg bg-primary-700 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
        >
          {busy ? "Completing…" : "Complete exercise"}
        </button>
        <p className="text-[11px] text-slate-400">
          Completion is blocked if any MAJOR GAP finding lacks a linked CAPA — raise it on the Findings panel first.
        </p>
      </div>
    </Modal>
  );
}
