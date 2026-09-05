"use client";

// Risk-based frequency recommendation (docs/cams/08 §5) — WP-30's surface.
//
// The design rule that shaped this screen: **render the arithmetic, not the
// verdict.** Gensuite and Enablon schedule off a static risk rating; the value
// here is that the number derives from the client's own findings, repeat chains,
// overdue CAPAs and incidents — and that is only persuasive if the reader can
// see the contributions and disagree with one.
//
// Two rules the UI must not soften:
//
//   * **Unavailable ≠ zero.** A signal that could not be measured is listed
//     separately with its reason, never rendered as a 0 contribution. Zero means
//     "measured, and clean".
//   * **Recommends, never applies.** Nothing here changes a frequency without an
//     explicit accept, and the accept lets you enter a DIFFERENT number —
//     agreeing with the direction while disagreeing with the magnitude is a
//     normal outcome, and forcing a binary choice pushes people to reject good
//     recommendations.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, Minus, TrendingDown, RefreshCw, Loader2, Check, X,
  Info, ShieldQuestion,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readApiError } from "@/lib/client-errors";
import { Alert } from "@/components/ui/alert";
import {
  BAND_META,
  siteText,
  type RecommendationRow,
  type ScopeUnitRow,
} from "@/app/(dashboard)/cams/programme/lib-programme";

const BAND_ICON = {
  INCREASE: <TrendingUp size={13} />,
  HOLD: <Minus size={13} />,
  REDUCE: <TrendingDown size={13} />,
};

export function RecommendationPanel({
  cycleId,
  rows,
  scopeUnits,
  canManage,
}: {
  cycleId: string;
  rows: RecommendationRow[];
  scopeUnits: ScopeUnitRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const unitById = new Map(scopeUnits.map((u) => [u.id, u]));

  async function recompute() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/programme/cycles/${cycleId}/recommendations`, {
      method: "POST",
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await readApiError(res, "Could not compute recommendations"));
      return;
    }
    router.refresh();
  }

  const open = rows.filter((r) => r.isOpen);

  return (
    <div className="space-y-3">
      <Card className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Risk-based frequency</h3>
            <p className="mt-1 max-w-prose text-xs text-slate-500">
              Derived from this client&rsquo;s own history — open critical/major NCs, repeat-finding
              chains, overdue CAPAs, incidents mapped to the discipline, and time since the last
              audit. Deterministic arithmetic, no AI. It <strong>recommends</strong>; a frequency
              only changes when someone accepts it.
            </p>
          </div>
          {canManage && (
            <Button type="button" size="sm" variant="outline" onClick={recompute} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Recompute
            </Button>
          )}
        </div>
        {err && (
          <Alert variant="destructive" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {err}
          </Alert>
        )}
      </Card>

      {rows.length === 0 && (
        <Card className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">No recommendations computed yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
            Recomputing reads the cycle&rsquo;s scope units and scores each one. It writes
            recommendations only — it never changes a frequency.
          </p>
        </Card>
      )}

      {open.length > 0 && (
        <p className="text-xs text-slate-500">
          {open.length} open recommendation{open.length === 1 ? "" : "s"}, highest score first.
        </p>
      )}

      {rows.map((r) => (
        <RecommendationCard
          key={r.id ?? r.scopeUnitId}
          rec={r}
          unit={unitById.get(r.scopeUnitId)}
          canManage={canManage}
          expanded={expanded === (r.id ?? r.scopeUnitId)}
          onToggle={() =>
            setExpanded(expanded === (r.id ?? r.scopeUnitId) ? null : (r.id ?? r.scopeUnitId))
          }
        />
      ))}
    </div>
  );
}

function RecommendationCard({
  rec, unit, canManage, expanded, onToggle,
}: {
  rec: RecommendationRow;
  unit?: ScopeUnitRow;
  canManage: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [acting, setActing] = useState<"accept" | "reject" | null>(null);
  const [freq, setFreq] = useState(String(rec.recommendedFrequency));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const band = BAND_META[rec.band] ?? BAND_META.HOLD;
  const available = rec.inputs.filter((i) => i.available);
  const unavailable = rec.inputs.filter((i) => !i.available);
  const maxContribution = Math.max(1, ...available.map((i) => i.weight));

  async function act(kind: "accept" | "reject") {
    if (!rec.id) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/programme/recommendations/${rec.id}/${kind}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        kind === "accept" ? { frequency: Number(freq) } : { reason: reason.trim() },
      ),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await readApiError(res, `Could not ${kind} the recommendation`));
      return;
    }
    setActing(null);
    router.refresh();
  }

  return (
    <Card className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-800">
          {unit?.dimensionLabel ?? rec.scopeUnitId}
        </span>
        {unit?.siteId && <span className="text-[11px] text-slate-400">{siteText(unit)}</span>}
        <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]", band.chip)}>
          {BAND_ICON[rec.band]} {band.label}
        </span>
        <span className="ml-auto text-sm tabular-nums">
          <span className="text-slate-400">{rec.currentFrequency ?? "—"}</span>
          <span className="mx-1 text-slate-300">→</span>
          <span className="font-bold text-slate-900">{rec.recommendedFrequency}</span>
          <span className="ml-1 text-[11px] text-slate-400">per cycle</span>
        </span>
      </div>

      <p className="mt-1.5 text-xs text-slate-600">{rec.narrative}</p>

      {/* Outcome, if already actioned. */}
      {!rec.isOpen && (
        <div
          className={cn(
            "mt-2 rounded-lg border px-2.5 py-1.5 text-[12px]",
            rec.acceptedAt
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-slate-50 text-slate-600",
          )}
        >
          {rec.acceptedAt ? (
            <>
              Accepted at {rec.acceptedFrequency}× per cycle
              {rec.acceptedFrequency !== rec.recommendedFrequency && (
                <span className="text-emerald-700">
                  {" "}
                  (reviewer set a different number from the {rec.recommendedFrequency} recommended)
                </span>
              )}
            </>
          ) : (
            <>Rejected — {rec.rejectionReason}</>
          )}
        </div>
      )}

      <Button variant="link"
        type="button"
        onClick={onToggle} className="mt-2 text-[11px] hover:underline">
        {expanded ? "Hide" : "Show"} the arithmetic ({rec.score}/100)
      </Button>

      {expanded && (
        <div className="mt-2 rounded-lg bg-slate-50 p-3">
          <ul className="space-y-1.5">
            {available.map((i) => (
              <li key={i.input} className="text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-44 shrink-0 truncate text-slate-700">{i.label}</span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-slate-500">
                    {i.rawValue ?? 0}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{ width: `${(i.contribution / maxContribution) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right tabular-nums text-slate-600">
                    {i.contribution} / {i.weight}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* Unavailable inputs are listed SEPARATELY. Rendering them as a 0
              contribution would say "measured and clean", which is a claim the
              product cannot make. */}
          {unavailable.length > 0 && (
            <div className="mt-3 border-t border-slate-200 pt-2">
              <div className="flex items-center gap-1 text-[11px] font-medium text-amber-800">
                <ShieldQuestion size={11} /> Not measured — weight redistributed to the signals above
              </div>
              <ul className="mt-1 space-y-0.5">
                {unavailable.map((i) => (
                  <li key={i.input} className="text-[11px] text-slate-500">
                    <span className="text-slate-700">{i.label}</span>
                    {i.detail ? ` — ${i.detail}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rec.reductionVetoedBy?.length > 0 && (
            <p className="mt-2 flex items-start gap-1 border-t border-slate-200 pt-2 text-[11px] text-amber-800">
              <Info size={11} className="mt-0.5 shrink-0" />
              A reduction is blocked while these remain open, regardless of the total score.
            </p>
          )}
        </div>
      )}

      {canManage && rec.isOpen && rec.id && (
        <div className="mt-3 border-t border-slate-100 pt-2.5">
          {acting === null && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => setActing("accept")}>
                <Check size={14} /> Accept
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setActing("reject")}>
                <X size={14} /> Reject
              </Button>
            </div>
          )}

          {acting === "accept" && (
            <div className="space-y-2">
              <Label htmlFor={`freq-${rec.id}`} className="text-xs">
                Audits per cycle
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={`freq-${rec.id}`}
                  type="number"
                  min={1}
                  value={freq}
                  onChange={(e) => setFreq(e.target.value)}
                  className="h-8 w-24"
                />
                <span className="text-[11px] text-slate-500">
                  Recommended {rec.recommendedFrequency}. You may set a different number.
                </span>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => act("accept")} disabled={busy || Number(freq) < 1}>
                  {busy && <Loader2 size={14} className="animate-spin" />} Apply frequency
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setActing(null)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {acting === "reject" && (
            <div className="space-y-2">
              <Label htmlFor={`rej-${rec.id}`} className="text-xs">
                Why is this recommendation not being applied?
              </Label>
              <Textarea
                id={`rej-${rec.id}`}
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. site is mothballed this cycle; covered by the buyer's own programme"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => act("reject")}
                  disabled={busy || reason.trim().length < 5}
                >
                  {busy && <Loader2 size={14} className="animate-spin" />} Record rejection
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setActing(null)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {err && <p className="mt-2 text-[11px] text-rose-700">{err}</p>}
        </div>
      )}
    </Card>
  );
}
