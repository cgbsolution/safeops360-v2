"use client";

// BBS Observation Quality — client view.
// The headline is a *quality index*, not a raw observation count: submissions are
// weighted, per-observer contribution is capped (anti-gaming), and the score is
// multiplied by how many observations actually close the loop (CAPA/action linked
// + re-observation verified). This view also surfaces integrity coaching flags and
// a per-observation closure-loop tracker with the two mutating actions.

import * as React from "react";
import { useRouter } from "next/navigation";
import { ScoreDial } from "../ui";
import { PALETTE, scoreColor, cultureSend } from "../lib";
import { formatUserRefText, type UserDirectory } from "@/lib/users/user-ref";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

// ── Types (shared with the server page) ────────────────────────────────────────
export type QualityIndex = {
  bbsQualityIndex: number;
  observationCount: number;
  weightedTotal: number;
  cappedWeightedTotal: number;
  expectedTarget: number;
  distinctObservers: number;
  verifiedClosures: number;
};

export type IntegrityStatus =
  | "clear"
  | "flagged_pending_review"
  | "flagged_reviewed_dismissed"
  | "flagged_reviewed_upheld";

export type IntegrityFlag = {
  observerId: string;
  totalSubmissions: number;
  lowEffortPct: number;
  deadlineSpikePct: number;
  patterns: string[];
  framing: string;
  period?: string;
  integrityStatus?: IntegrityStatus;
  reviewNote?: string | null;
  reviewedAt?: string | null;
};

export type IntegrityFlags = {
  plantId: string;
  flaggedCount: number;
  flags: IntegrityFlag[];
  framing: string;
};

export type ClosureStage = "logged" | "linked" | "verified";

export type ClosureItem = {
  observationId: string;
  number: string;
  severity: string;
  status: string;
  observerId: string;
  linkedCapaId: string | null;
  linkedActionId: string | null;
  reobservationVerified: boolean;
  reobservationDate: string | null;
  stage: ClosureStage;
};

export type ClosureData = {
  plantId: string;
  items: ClosureItem[];
};

// ── Small display helpers ──────────────────────────────────────────────────────
const GREEN = "#1F7A4D";

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function pct(v: number | null | undefined): string {
  return `${Math.round(num(v))}%`;
}

function severityStyle(severity: string): { bg: string; color: string } {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return { bg: "#FBEAEA", color: "#B4232A" };
    case "high":
      return { bg: "#FBF1E4", color: "#C9761F" };
    case "medium":
      return { bg: "#FEF9E7", color: "#9A7B1F" };
    case "low":
      return { bg: "#E6F4EC", color: GREEN };
    default:
      return { bg: "#F1F5F9", color: "#475569" };
  }
}

function SeverityChip({ severity }: { severity: string }) {
  const s = severityStyle(severity);
  const label = severity ? severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase() : "—";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {label}
    </span>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────
export function BbsView({
  quality,
  integrity,
  closure,
  userDir,
}: {
  quality: QualityIndex;
  integrity: IntegrityFlags;
  closure: ClosureData;
  userDir: UserDirectory;
  plantId: string;
}) {
  const flags = integrity?.flags ?? [];
  const items = closure?.items ?? [];

  return (
    <div className="space-y-6">
      <HeroStrip quality={quality} />
      <IntegrityPanel integrity={integrity} flags={flags} userDir={userDir} />
      <ClosureLoop items={items} userDir={userDir} />
    </div>
  );
}

// ── Hero + KPI tiles ────────────────────────────────────────────────────────────
function HeroStrip({ quality }: { quality: QualityIndex }) {
  const score = num(quality?.bbsQualityIndex);
  return (
    <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
      <div className="flex items-center gap-5 rounded-xl border bg-white p-5">
        <ScoreDial score={score} label="BBS Quality" />
        <div className="max-w-md">
          <p className="text-xs uppercase tracking-wide text-slate-500">The new headline metric</p>
          <p className="mt-1 text-sm text-slate-600">
            This <span className="font-semibold text-slate-800">quality index replaces the raw observation count</span>{" "}
            as the number that matters. It is{" "}
            <span className="font-medium" style={{ color: PALETTE.navy }}>quality-weighted</span>,{" "}
            <span className="font-medium" style={{ color: PALETTE.navy }}>capped per observer</span> to stop volume-gaming,
            and{" "}
            <span className="font-medium" style={{ color: PALETTE.navy }}>multiplied by closure-loop completion</span> — so
            padding the count no longer moves the score.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiTile label="Observations (window)" value={String(num(quality?.observationCount))} hint={`Target ≈ ${num(quality?.expectedTarget)}`} />
        <KpiTile label="Distinct observers" value={String(num(quality?.distinctObservers))} hint="Breadth of participation" />
        <KpiTile label="Verified closures" value={String(num(quality?.verifiedClosures))} hint="Loop closed & re-observed" accent={GREEN} />
        <KpiTile
          label="Capped vs raw weighted"
          value={`${num(quality?.cappedWeightedTotal).toFixed(1)} / ${num(quality?.weightedTotal).toFixed(1)}`}
          hint="Anti-skew cap applied"
          accent={PALETTE.gold}
        />
      </div>
    </div>
  );
}

function KpiTile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: accent ?? PALETTE.navy }}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ── Observation Integrity ────────────────────────────────────────────────────────
function IntegrityPanel({
  integrity,
  flags,
  userDir,
}: {
  integrity: IntegrityFlags;
  flags: IntegrityFlag[];
  userDir: UserDirectory;
}) {
  const framing = integrity?.framing || "Coaching opportunities — not punitive. These patterns highlight where an observer may need support, never blame.";
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: PALETTE.navy }}>
          Observation Integrity
        </p>
        <span className="text-xs text-slate-500">
          {num(integrity?.flaggedCount)} observer{num(integrity?.flaggedCount) === 1 ? "" : "s"} flagged
        </span>
      </div>

      <div
        className="mb-4 flex items-start gap-2 rounded-lg border p-3 text-xs"
        style={{ borderColor: PALETTE.gold, background: "#FBF7EC", color: "#7A6320" }}
      >
        <span className="mt-0.5" style={{ color: PALETTE.gold }}>◆</span>
        <span>{framing}</span>
      </div>

      {flags.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center" style={{ borderColor: GREEN }}>
          <p className="text-sm font-medium" style={{ color: GREEN }}>No gaming patterns detected</p>
          <p className="mt-1 text-xs text-slate-500">Every observer&apos;s submissions look genuine for this window.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {flags.map((f) => (
            <CoachingCard key={f.observerId} flag={f} userDir={userDir} />
          ))}
        </div>
      )}
    </div>
  );
}

const INTEGRITY_STATUS_META: Record<IntegrityStatus, { label: string; bg: string; color: string }> = {
  clear: { label: "Clear", bg: "#E6F4EC", color: GREEN },
  flagged_pending_review: { label: "Pending review", bg: "#FBF1E4", color: "#C9761F" },
  flagged_reviewed_dismissed: { label: "Reviewed · dismissed", bg: "#E6F4EC", color: GREEN },
  flagged_reviewed_upheld: { label: "Reviewed · upheld", bg: "#FBEAEA", color: "#B4232A" },
};

function CoachingCard({ flag, userDir }: { flag: IntegrityFlag; userDir: UserDirectory }) {
  const router = useRouter();
  const patterns = flag?.patterns ?? [];
  const statusKey: IntegrityStatus = flag.integrityStatus ?? "flagged_pending_review";
  const statusMeta = INTEGRITY_STATUS_META[statusKey];
  const isTerminal = statusKey === "flagged_reviewed_dismissed" || statusKey === "flagged_reviewed_upheld";

  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<null | "dismiss" | "uphold">(null);
  const [error, setError] = React.useState<string | null>(null);

  async function review(outcome: "dismiss" | "uphold") {
    if (!note.trim()) {
      setError("A review note is required.");
      return;
    }
    setBusy(outcome);
    setError(null);
    try {
      await cultureSend(`/observations/integrity/${flag.observerId}/review`, "POST", {
        period: flag.period,
        outcome,
        note: note.trim(),
      });
      router.refresh();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Review failed";
      setError(/403|permission|forbidden|denied/i.test(raw) ? "You don't have permission to review integrity flags." : raw);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-800">{formatUserRefText(userDir, flag.observerId)}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{num(flag.totalSubmissions)} submissions in window</p>
        </div>
        <div className="flex shrink-0 gap-3 text-right">
          <div>
            <p className="text-sm font-semibold" style={{ color: PALETTE.gold }}>{pct(flag.lowEffortPct)}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Low effort</p>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: PALETTE.gold }}>{pct(flag.deadlineSpikePct)}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Deadline spike</p>
          </div>
        </div>
      </div>
      {patterns.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {patterns.map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]"
              style={{ borderColor: PALETTE.gold, color: "#7A6320", background: "#FBF7EC" }}
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {/* §Fix 1 — review status + closure action (Recognition points stay frozen
          while pending/upheld; dismissing restores them automatically). */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: statusMeta.bg, color: statusMeta.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusMeta.color }} />
          {statusMeta.label}
        </span>
        {!open ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(true)}
            className="text-xs font-medium disabled:opacity-50"
            style={{ borderColor: PALETTE.gold, color: PALETTE.navy }}
          >
            {isTerminal ? "Re-review flag" : "Review flag"}
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
            Cancel
          </Button>
        )}
      </div>

      {flag.reviewNote && !open && (
        <p className="mt-2 text-[11px] text-slate-500">
          <span className="font-medium text-slate-600">Reviewer note:</span> {flag.reviewNote}
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <label className="block text-[11px] font-medium text-slate-600">Review note (required)</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Coached observer on entry quality; patterns explained by shift rota — dismissing."
            className="text-slate-700"
          />
          {error && <p className="text-[11px] text-rose-600">{error}</p>}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="success"
              onClick={() => review("dismiss")}
              disabled={busy !== null}
              className="text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: GREEN }}
            >
              {busy === "dismiss" ? "Saving…" : "Dismiss (clear)"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => review("uphold")}
              disabled={busy !== null}
              className="text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: "#B4232A" }}
            >
              {busy === "uphold" ? "Saving…" : "Uphold (keep gated)"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Closure Loop ─────────────────────────────────────────────────────────────────
const STEP_ORDER: Record<ClosureStage, number> = { logged: 1, linked: 2, verified: 3 };
const STEPS: { key: ClosureStage; label: string }[] = [
  { key: "logged", label: "Logged" },
  { key: "linked", label: "Linked" },
  { key: "verified", label: "Verified" },
];

function ClosureStepper({ stage }: { stage: ClosureStage }) {
  const current = STEP_ORDER[stage] ?? 1;
  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const order = i + 1;
        const done = order <= current;
        const color = done ? (step.key === "verified" ? GREEN : PALETTE.gold) : "#CBD5E1";
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: color }}
              >
                {done ? "✓" : order}
              </span>
              <span className="mt-1 text-[10px]" style={{ color: done ? PALETTE.navy : "#94A3B8" }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className="mx-1 mb-4 h-0.5 w-6 rounded"
                style={{ background: order < current ? PALETTE.gold : "#E2E8F0" }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ClosureLoop({ items, userDir }: { items: ClosureItem[]; userDir: UserDirectory }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: PALETTE.navy }}>
          Closure Loop
        </p>
        <span className="text-xs text-slate-500">
          Logged → Linked (CAPA/Action) → Verified (re-observation)
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No observations in this window yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b text-left text-[11px] uppercase tracking-wide text-slate-500">
                <TableHead className="py-2 pr-3 font-medium">Observation</TableHead>
                <TableHead className="py-2 pr-3 font-medium">Severity</TableHead>
                <TableHead className="py-2 pr-3 font-medium">Observer</TableHead>
                <TableHead className="py-2 pr-3 font-medium">Closure loop</TableHead>
                <TableHead className="py-2 pl-3 text-right font-medium">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.observationId} className="border-b last:border-0 align-middle">
                  <TableCell className="pr-3 font-medium text-slate-800">{it.number || "—"}</TableCell>
                  <TableCell className="pr-3">
                    <SeverityChip severity={it.severity} />
                  </TableCell>
                  <TableCell className="pr-3 text-slate-600">{formatUserRefText(userDir, it.observerId)}</TableCell>
                  <TableCell className="pr-3">
                    <ClosureStepper stage={it.stage} />
                  </TableCell>
                  <TableCell className="pl-3">
                    <ClosureActions item={it} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ClosureActions({ item }: { item: ClosureItem }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<null | "link" | "verify">(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(kind: "link" | "verify") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "link") {
        await cultureSend(`/observations/${item.observationId}/link-action`, "POST", { spawnCapa: true });
      } else {
        await cultureSend(`/observations/${item.observationId}/verify-closure`, "POST", {
          verified: true,
          reobservationDate: new Date().toISOString(),
        });
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  if (item.stage === "verified") {
    return (
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: GREEN }}>
          ✓ Verified
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex justify-end gap-2">
        {item.stage === "logged" && (
          <Button
            type="button"
            onClick={() => run("link")}
            disabled={busy !== null}
            className="text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: PALETTE.navy }}
          >
            {busy === "link" ? "Raising…" : "Raise + link CAPA"}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => run("verify")}
          disabled={busy !== null || item.stage === "logged"}
          title={item.stage === "logged" ? "Link a CAPA/action first" : undefined}
          className="text-xs font-semibold disabled:opacity-50"
          style={{ borderColor: PALETTE.gold, color: PALETTE.navy }}
        >
          {busy === "verify" ? "Verifying…" : "Verify closure"}
        </Button>
      </div>
      {error && <p className="max-w-[200px] text-right text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
