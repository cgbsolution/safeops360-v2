"use client";

// The ISO 19011 §5.6 programme review — first-class, not a notes field.
//
// This is the clause an auditor actually asks about and the one most tools skip:
// they model "monitor the programme" and stop, never "review and improve it".
// `close_cycle` refuses a cycle with zero reviews, so this screen is the only
// way a cycle can ever reach CLOSED — and until it existed, no cycle could.
//
// A review here is about the PROGRAMME, not about audits: coverage that was
// missed, frequencies that turned out wrong, resourcing that fell short. Its
// `resultingAmendmentIds` link the decisions to the amendments they caused,
// because a review with no traceable consequence is minutes, not a review.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, ClipboardList, Users, FileClock, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserPicker } from "@/components/ui/user-picker";
import { readApiError } from "@/lib/client-errors";
import { UserRefLabel, type UserDirectory } from "@/lib/users/user-ref";
import {
  fmtDate,
  type AmendmentRow, type ProgrammeCycleRow, type ReviewRow,
} from "@/app/(dashboard)/cams/programme/lib-programme";

export function ReviewPanel({
  cycle, reviews, amendments, userDir, canManage,
}: {
  cycle: ProgrammeCycleRow;
  reviews: ReviewRow[];
  amendments: AmendmentRow[];
  userDir: UserDirectory;
  canManage: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const amendmentById = new Map(amendments.map((a) => [a.id, a]));

  return (
    <div className="space-y-3">
      <Card className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Programme review</h3>
            <p className="mt-1 max-w-prose text-xs text-slate-500">
              ISO 19011 §5.6 — the periodic review <em>of the programme itself</em>: whether the
              coverage it planned was achieved, whether the frequencies were right, whether it was
              resourced. Not audit findings. A cycle cannot close without at least one.
            </p>
          </div>
          {canManage && cycle.status !== "CLOSED" && (
            <Button type="button" size="sm" onClick={() => setCreating(true)}>
              <Plus size={14} /> Record review
            </Button>
          )}
        </div>
      </Card>

      {reviews.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <ClipboardList size={22} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm text-slate-600">No programme review recorded yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
            Closure is gated on this. Most tools stop at &ldquo;monitor&rdquo;; the clause an
            auditor asks about is &ldquo;review and improve&rdquo;.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {reviews.map((r) => {
            const linked = r.resultingAmendmentIds
              .map((id) => amendmentById.get(id))
              .filter((a): a is AmendmentRow => !!a);
            return (
              <Card key={r.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800">
                    <CalendarDays size={14} className="text-slate-400" />
                    {fmtDate(r.reviewDate)}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    recorded by <UserRefLabel dir={userDir} id={r.reviewedByUserId} showRole={false} />
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                  <Users size={12} className="text-slate-400" />
                  {r.participantUserIds.map((id) => (
                    <span key={id} className="rounded bg-slate-100 px-1.5 py-0.5">
                      <UserRefLabel dir={userDir} id={id} showRole={false} showPlant={false} />
                    </span>
                  ))}
                  {r.externalParticipants.map((p, i) => (
                    <span key={`x${i}`} className="rounded border border-slate-200 px-1.5 py-0.5">
                      {p.name}{p.organisation ? ` · ${p.organisation}` : ""}
                    </span>
                  ))}
                  {!r.participantUserIds.length && !r.externalParticipants.length && (
                    <span className="text-slate-400">no participants recorded</span>
                  )}
                </div>

                {r.programmeFindings && (
                  <Section title="Findings about the programme">{r.programmeFindings}</Section>
                )}
                {r.decisions && <Section title="Decisions">{r.decisions}</Section>}
                {r.effectivenessAssessment && (
                  <Section title="Effectiveness assessment">{r.effectivenessAssessment}</Section>
                )}

                {linked.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <FileClock size={12} /> Resulting amendments
                    </div>
                    <ul className="mt-1 space-y-1">
                      {linked.map((a) => (
                        <li key={a.id} className="flex items-start gap-2 text-[11px] text-slate-600">
                          <span className="rounded border border-amber-200 bg-amber-50 px-1.5 text-[10px] text-amber-800">
                            {a.amendmentType.replace(/_/g, " ").toLowerCase()}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{a.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {creating && (
        <CreateReviewDialog
          cycle={cycle}
          amendments={amendments}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{title}</div>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{children}</p>
    </div>
  );
}

function CreateReviewDialog({
  cycle, amendments, onClose,
}: {
  cycle: ProgrammeCycleRow;
  amendments: AmendmentRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [reviewDate, setReviewDate] = useState(today);
  const [participants, setParticipants] = useState<string[]>([]);
  const [externals, setExternals] = useState<{ name: string; organisation: string }[]>([]);
  const [extName, setExtName] = useState("");
  const [extOrg, setExtOrg] = useState("");
  const [findings, setFindings] = useState("");
  const [decisions, setDecisions] = useState("");
  const [effectiveness, setEffectiveness] = useState("");
  const [amendmentIds, setAmendmentIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const substance = `${findings.trim()} ${decisions.trim()}`.trim();
  const noParticipants = participants.length === 0 && externals.length === 0;
  const invalid = substance.length < 10 || noParticipants;

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/programme/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cycleId: cycle.id,
        reviewDate,
        participantUserIds: participants,
        externalParticipants: externals,
        programmeFindings: findings.trim(),
        decisions: decisions.trim(),
        effectivenessAssessment: effectiveness.trim() || null,
        resultingAmendmentIds: amendmentIds,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await readApiError(res, "Could not record the review"));
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-xl sm:rounded-2xl">
        <h3 className="text-sm font-semibold text-slate-900">
          Record a programme review — {cycle.cycleLabel}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          About the programme, not about individual audits. This record is what unlocks closing
          the cycle.
        </p>

        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
            <div>
              <Label htmlFor="rv-date" className="text-xs">Review date</Label>
              <Input id="rv-date" type="date" value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">
                Participants <span className="text-rose-600">*</span>
              </Label>
              <div className="mt-1">
                <UserPicker
                  multiple
                  value={participants}
                  onChange={(ids) => setParticipants(ids)}
                  placeholder="Who attended the review?"
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">External participants</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              <Input value={extName} onChange={(e) => setExtName(e.target.value)}
                placeholder="Name" className="h-8 flex-1 text-xs" />
              <Input value={extOrg} onChange={(e) => setExtOrg(e.target.value)}
                placeholder="Organisation" className="h-8 flex-1 text-xs" />
              <Button type="button" size="sm" variant="outline" disabled={!extName.trim()}
                onClick={() => {
                  setExternals((p) => [...p, { name: extName.trim(), organisation: extOrg.trim() }]);
                  setExtName(""); setExtOrg("");
                }}>
                Add
              </Button>
            </div>
            {externals.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {externals.map((x, i) => (
                  <button key={i} type="button"
                    onClick={() => setExternals((p) => p.filter((_, j) => j !== i))}
                    className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-700 hover:bg-rose-50">
                    {x.name}{x.organisation ? ` · ${x.organisation}` : ""} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="rv-find" className="text-xs">Findings about the programme</Label>
            <Textarea id="rv-find" rows={3} value={findings} onChange={(e) => setFindings(e.target.value)}
              placeholder="e.g. Q3 coverage at South Works fell short because two slots were deferred against the same auditor; the electrical frequency of 1× proved too low given three incidents."
              className="mt-1 text-sm" />
          </div>

          <div>
            <Label htmlFor="rv-dec" className="text-xs">Decisions</Label>
            <Textarea id="rv-dec" rows={3} value={decisions} onChange={(e) => setDecisions(e.target.value)}
              placeholder="e.g. Raise electrical to 2× per cycle from FY28; add a second qualified lead auditor before Q1."
              className="mt-1 text-sm" />
          </div>

          <div>
            <Label htmlFor="rv-eff" className="text-xs">Effectiveness assessment</Label>
            <Textarea id="rv-eff" rows={2} value={effectiveness}
              onChange={(e) => setEffectiveness(e.target.value)}
              placeholder="Did the programme achieve its objectives?"
              className="mt-1 text-sm" />
          </div>

          {amendments.length > 0 && (
            <div>
              <Label className="text-xs">Resulting amendments</Label>
              <p className="text-[11px] text-slate-500">
                Link the amendments this review decided — a review with no traceable consequence
                is minutes, not a review.
              </p>
              <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-slate-200">
                {amendments.map((a) => {
                  const on = amendmentIds.includes(a.id);
                  return (
                    <button key={a.id} type="button"
                      onClick={() =>
                        setAmendmentIds((p) => (on ? p.filter((x) => x !== a.id) : [...p, a.id]))
                      }
                      className={cn(
                        "flex w-full items-start gap-2 border-b border-slate-100 px-2.5 py-1.5 text-left text-xs last:border-0 hover:bg-slate-50",
                        on && "bg-violet-50/60",
                      )}>
                      <span className={cn(
                        "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded border text-[9px]",
                        on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300",
                      )}>{on && "✓"}</span>
                      <span className="min-w-0">
                        <span className="rounded border border-amber-200 bg-amber-50 px-1 text-[10px] text-amber-800">
                          {a.amendmentType.replace(/_/g, " ").toLowerCase()}
                        </span>
                        <span className="ml-1 text-slate-700">{a.reason}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {invalid && (
            <p className="text-[11px] text-slate-500">
              {noParticipants
                ? "Record who attended."
                : "Findings or decisions are required — an empty review would unlock closure without saying anything."}
            </p>
          )}
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {err}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={submit} disabled={busy || invalid}>
            {busy && <Loader2 size={14} className="animate-spin" />} Record review
          </Button>
        </div>
      </div>
    </div>
  );
}
