"use client";

// The RCA Assistant entry point inside the Cause Analysis tab.
//
// State machine:
//   IDLE      — no invocation yet. Show pitch + "Start AI Analysis" button.
//   RUNNING   — polling. Show streaming tool-call progress.
//   REVIEWING — result available, awaiting human decision. Renders the
//               result + decision panels.
//   COMPLETED — decision recorded (ACCEPTED/MODIFIED/REJECTED). Renders
//               a summary banner; another invocation can be started.
//   ERRORED   — invocation failed. Show error + retry.
//
// Network access:
//   POSTs to /api/agents/RCA_ASSISTANT/invoke
//   GETs  from /api/agent-invocations/{id}
//   POSTs to /api/agent-invocations/{id}/decision
// All three routes are auto-proxied to the Python backend by the
// existing catch-all in src/app/api/[...path]/route.ts. The session
// JWT is attached server-side; the browser does not need to handle
// tokens directly.

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Zap,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";

import { ResultPanel } from "./result-panel";
import { DecisionPanel } from "./decision-panel";
import { TransparencyDrawer } from "./transparency-drawer";
import {
  TOOL_LABELS,
  type AgentInvocationOut,
  type InvocationStartedResponse,
  type RcaSuggestion
} from "./types";
import type { RcaMethod } from "@/lib/rca/types";
import { Alert } from "@/components/ui/alert";

// ─── Constants ──────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 2500;
// Hard cap on polling so a stuck invocation doesn't hammer the API forever.
// Matches the Python rate limiter window — after this, the user retries.
const POLL_MAX_MS = 180_000;

/**
 * Build a complete AgentInvocationOut placeholder for the brief window
 * between the invoke response (which gives us only id/number/status) and
 * the first poll response (which fills in the rest). All non-essential
 * fields are nulled — the JSX only reads what's available, but TS wants
 * a full object shape.
 */
function makeRunningPlaceholder(
  id: string,
  invocationNumber: string
): AgentInvocationOut {
  return {
    id,
    invocationNumber,
    agentId: "",
    invocationTrigger: "USER_INITIATED",
    invokedAt: new Date().toISOString(),
    invokedById: null,
    sourceModule: "INCIDENT",
    sourceRecordId: "",
    sourceRecordType: "INCIDENT",
    sourcePlantId: null,
    authorityLevelUsed: "",
    promptVersionId: "",
    modelUsed: "",
    inputTokens: null,
    outputTokens: null,
    totalCostUsd: null,
    latencyMs: null,
    agentReasoning: null,
    agentSuggestion: null,
    agentConfidence: null,
    status: "RUNNING",
    humanDecisionAt: null,
    humanDecisionById: null,
    humanDecision: null,
    humanModifications: null,
    rejectionReason: null,
    ratingByHuman: null,
    detailedFeedback: null,
    hadError: false,
    errorType: null,
    errorDetails: null,
    hallucinationFlagged: false,
    hallucinationDetails: null,
    toolCalls: []
  };
}

// ─── Props ─────────────────────────────────────────────────────────────
export type RcaAssistantCardProps = {
  incidentId: string;
  /** Whether the caller has AGENT.RCA_INVOKE on this incident. When
   *  false, the card is hidden entirely — we don't show disabled UI. */
  canInvoke: boolean;
  /** Whether the caller has AGENT.AUDIT_VIEW. Controls visibility of
   *  the transparency drawer entry point. */
  canViewAudit: boolean;
  /** Called when the user clicks "Load Into Editor" on a suggestion.
   *  Receives the methodology + draft JSON + the proposed root-cause
   *  strings. The parent applies these to the RcaEditor and the root-
   *  causes textarea. */
  onLoadIntoEditor: (payload: {
    method: RcaMethod;
    data: unknown;
    proposedRootCauses: string[];
    contributingFactors: string[];
  }) => void;
  /** Current state of the form, used to capture human modifications
   *  when the user picks ACCEPT_WITH_MODIFICATION. */
  getCurrentDraftState: () => {
    method: RcaMethod;
    data: unknown;
    rootCauses: string;
  };
};

// ─── Component ─────────────────────────────────────────────────────────
export function RcaAssistantCard(props: RcaAssistantCardProps) {
  const { incidentId, canInvoke, canViewAudit } = props;
  const { toast } = useToast();

  const [invocation, setInvocation] = useState<AgentInvocationOut | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Whether the user already pulled the suggestion into the editor.
  // Lets the result panel show "Loaded" state instead of "Load Into Editor".
  const [hasLoaded, setHasLoaded] = useState(false);
  // Elapsed-time + transient-connection feedback while running.
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pollNote, setPollNote] = useState<string | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Holds the abort timer for the active poll loop so we can stop it
  // when the user navigates away or starts a new invocation.
  const pollAbortRef = useRef<{ cancelled: boolean } | null>(null);
  useEffect(
    () => () => {
      if (pollAbortRef.current) pollAbortRef.current.cancelled = true;
    },
    []
  );

  // Tick the elapsed-time counter while the agent is running.
  const runningStatus = invocation?.status;
  useEffect(() => {
    if (runningStatus !== "RUNNING") return;
    const t = setInterval(() => {
      if (startTimeRef.current != null) setElapsedMs(Date.now() - startTimeRef.current);
    }, 500);
    return () => clearInterval(t);
  }, [runningStatus]);

  // Hydrate from the latest invocation for this incident on load, so a
  // finished result (or an in-flight one) shows immediately — instead of
  // being lost when the client-side poll/page state goes away.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/agents/latest-invocation?sourceModule=INCIDENT&sourceRecordId=${encodeURIComponent(incidentId)}`,
          { cache: "no-store" }
        );
        if (!res.ok || cancelled) return;
        const inv = (await res.json()) as AgentInvocationOut | null;
        if (!inv || !inv.id || cancelled) return;
        // Don't clobber an invocation the user just started.
        setInvocation((cur) => cur ?? inv);
        if (inv.status === "RUNNING") {
          startTimeRef.current = inv.invokedAt ? new Date(inv.invokedAt).getTime() : Date.now();
          const token = { cancelled: false };
          pollAbortRef.current = token;
          pollUntilDone(inv.id, token);
        }
      } catch {
        /* ignore — the card just stays in IDLE */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId]);

  // Permission gate — render nothing rather than disabled controls.
  if (!canInvoke) return null;

  async function startInvocation(forceEscalation = false) {
    setStarting(true);
    setError(null);
    setInvocation(null);
    setHasLoaded(false);
    setPollNote(null);
    setElapsedMs(0);
    startTimeRef.current = Date.now();

    // Cancel any in-flight poll loop first.
    if (pollAbortRef.current) pollAbortRef.current.cancelled = true;
    const cancelToken = { cancelled: false };
    pollAbortRef.current = cancelToken;

    try {
      const res = await fetch("/api/agents/RCA_ASSISTANT/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceModule: "INCIDENT",
          sourceRecordId: incidentId,
          forceEscalationModel: forceEscalation
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.detail ??
            body?.error ??
            `Invocation failed (${res.status})`
        );
      }
      const start = (await res.json()) as InvocationStartedResponse;

      // Render a "running" placeholder immediately so the user sees
      // progress instead of waiting on the first poll. All non-relevant
      // fields are nulled — the result panel guards on status anyway,
      // and the first poll fills them in within ~2.5s.
      setInvocation(makeRunningPlaceholder(start.invocationId, start.invocationNumber));

      await pollUntilDone(start.invocationId, cancelToken);
    } catch (e: any) {
      if (!cancelToken.cancelled) {
        setError(e?.message ?? "Could not start the agent");
      }
    } finally {
      setStarting(false);
    }
  }

  async function pollUntilDone(
    invocationId: string,
    cancelToken: { cancelled: boolean }
  ) {
    const deadline = Date.now() + POLL_MAX_MS;
    // Survive transient failures (e.g. the backend briefly reloading or the
    // event loop busy on the LLM call) instead of giving up on the first one.
    let consecutiveErrors = 0;
    while (Date.now() < deadline) {
      if (cancelToken.cancelled) return;
      try {
        const res = await fetch(`/api/agent-invocations/${invocationId}`, {
          cache: "no-store"
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const next = (await res.json()) as AgentInvocationOut;
        if (cancelToken.cancelled) return;
        consecutiveErrors = 0;
        setPollNote(null);
        setInvocation(next);
        if (next.status !== "RUNNING") return; // done (PENDING_REVIEW / ERRORED)
      } catch (e: any) {
        if (cancelToken.cancelled) return;
        consecutiveErrors += 1;
        setPollNote("Reconnecting to the agent service…");
        if (consecutiveErrors >= 8) {
          // ~20s of solid failures — surface it (and keep the placeholder so
          // "Check status" can still recover once the service is back).
          setError(
            "Lost connection to the agent service. The analysis may still be finishing — click “Check status” to refresh."
          );
          return;
        }
      }
      if (cancelToken.cancelled) return;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    // Deadline reached — one last check, then surface a recoverable message.
    await checkStatusNow(invocationId);
    if (!cancelToken.cancelled) {
      setError(
        "The agent is taking longer than usual — it often finishes in the background. Click “Check status” to refresh the result."
      );
    }
  }

  /** One-off poll to recover a result the live loop may have missed. */
  async function checkStatusNow(id?: string) {
    const invocationId = id ?? invocation?.id;
    if (!invocationId) return;
    setPollNote("Checking…");
    try {
      const res = await fetch(`/api/agent-invocations/${invocationId}`, { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as AgentInvocationOut;
        setInvocation(next);
        if (next.status !== "RUNNING") setError(null);
      }
    } catch {
      /* ignore — the user can click again */
    } finally {
      setPollNote(null);
    }
  }

  async function handleDecision(payload: {
    decision: "ACCEPT_AS_IS" | "ACCEPT_WITH_MODIFICATION" | "REJECT";
    rejectionReason?: string;
    rating?: number;
    feedback?: string;
  }) {
    if (!invocation) return;

    // For ACCEPT_WITH_MODIFICATION, snapshot the current draft state
    // so the audit trail captures what the human kept vs changed.
    const body: Record<string, unknown> = {
      decision: payload.decision,
      rating: payload.rating,
      feedback: payload.feedback
    };
    if (payload.decision === "ACCEPT_WITH_MODIFICATION") {
      const snap = props.getCurrentDraftState();
      body.humanModifications = {
        method: snap.method,
        data: snap.data,
        rootCauses: snap.rootCauses
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      };
    }
    if (payload.decision === "REJECT") {
      body.rejectionReason = payload.rejectionReason;
    }

    try {
      const res = await fetch(
        `/api/agent-invocations/${invocation.id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.detail ?? errBody?.error ?? `Decision failed (${res.status})`);
      }
      const updated = (await res.json()) as AgentInvocationOut;
      setInvocation(updated);
      toast({
        variant: "success",
        title:
          payload.decision === "REJECT"
            ? "Suggestion rejected"
            : payload.decision === "ACCEPT_WITH_MODIFICATION"
            ? "Modifications recorded"
            : "Suggestion accepted",
        description: `Invocation ${updated.invocationNumber} → ${updated.status}`
      });
    } catch (e: any) {
      toast({
        variant: "error",
        title: "Could not record decision",
        description: e?.message ?? "Try again"
      });
    }
  }

  // ── State branches ────────────────────────────────────────────────
  const status = invocation?.status ?? null;

  // 1. IDLE: no invocation yet, no error.
  if (!invocation && !error) {
    return <IdleCard onStart={startInvocation} starting={starting} />;
  }

  // 2. ERRORED start (no invocation at all).
  if (!invocation && error) {
    return <ErroredCard error={error} onRetry={() => startInvocation(false)} />;
  }

  // 3. We have an invocation row. Render based on its status. The two
  //    early returns above already excluded the null case but TS can't
  //    follow that narrowing across the function — assert non-null so
  //    the JSX below is typed accordingly.
  const inv = invocation!;
  return (
    <Card className="border-violet-300 bg-violet-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-violet-900 text-base">
          <Sparkles size={16} />
          RCA Assistant
          <Badge
            className={cn(
              "ml-auto text-[10px] font-medium",
              status === "RUNNING" && "bg-amber-100 text-amber-900 border-amber-300",
              status === "PENDING_REVIEW" &&
                "bg-emerald-100 text-emerald-900 border-emerald-300",
              status === "ACCEPTED" && "bg-emerald-100 text-emerald-900 border-emerald-300",
              status === "MODIFIED" && "bg-blue-100 text-blue-900 border-blue-300",
              status === "REJECTED" && "bg-slate-100 text-slate-700 border-slate-300",
              status === "ERRORED" && "bg-rose-100 text-rose-900 border-rose-300"
            )}
          >
            {status === "RUNNING" && (
              <>
                <Loader2 size={11} className="animate-spin" /> Running
              </>
            )}
            {status !== "RUNNING" && (status?.replace(/_/g, " ").toLowerCase() ?? "")}
          </Badge>
        </CardTitle>
        <div className="text-[10px] text-violet-700 tracking-wide">
          {inv.invocationNumber} · model {inv.modelUsed || "…"}
          {inv.totalCostUsd != null && (
            <> · ${inv.totalCostUsd.toFixed(4)}</>
          )}
          {inv.latencyMs != null && (
            <> · {(inv.latencyMs / 1000).toFixed(1)}s</>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {status === "RUNNING" && (
          <ProgressList
            invocation={inv}
            elapsedMs={elapsedMs}
            note={pollNote}
            error={error}
            onCheck={() => checkStatusNow()}
            onRetry={() => startInvocation(false)}
          />
        )}

        {status === "ERRORED" && (
          <Alert variant="destructive" size="lg" className="p-3">
            <AlertCircle size={14} className="mt-0.5" />
            <div className="space-y-1">
              <div className="font-medium">
                {inv.errorType ?? "Error"}: {inv.errorDetails ?? "Unknown failure"}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => startInvocation(false)}
                disabled={starting}
              >
                {starting ? "Retrying…" : "Retry"}
              </Button>
            </div>
          </Alert>
        )}

        {(status === "PENDING_REVIEW" ||
          status === "ACCEPTED" ||
          status === "MODIFIED" ||
          status === "REJECTED") && (
          <ResultPanel
            invocation={inv}
            hasLoaded={hasLoaded}
            onLoadIntoEditor={() => {
              const sugg = inv.agentSuggestion as RcaSuggestion | null;
              if (!sugg || !("recommendedMethod" in sugg)) return;
              props.onLoadIntoEditor({
                method: sugg.recommendedMethod,
                data: sugg.draftAnalysis,
                proposedRootCauses: sugg.proposedRootCauses ?? [],
                contributingFactors: sugg.contributingFactors ?? []
              });
              setHasLoaded(true);
              toast({
                variant: "success",
                title: "Loaded into editor",
                description:
                  "Methodology editor and root-cause field populated. Review and edit before saving."
              });
            }}
          />
        )}

        {/* Decision controls — only when awaiting decision */}
        {status === "PENDING_REVIEW" && (
          <DecisionPanel onSubmit={handleDecision} />
        )}

        {/* Footer actions */}
        <div className="pt-2 border-t border-violet-200/60 flex flex-wrap items-center gap-2 text-xs text-violet-700">
          {canViewAudit && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setDrawerOpen(true)}
            >
              <Eye size={12} /> View Full Reasoning
            </Button>
          )}
          {status !== "RUNNING" && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => startInvocation(false)}
              disabled={starting}
              className="ml-auto"
            >
              <Sparkles size={12} />
              {starting ? "Starting…" : "Run again"}
            </Button>
          )}
          {status !== "RUNNING" && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => startInvocation(true)}
              disabled={starting}
              title="Use the escalation model (Opus) for a deeper, slower, more expensive analysis."
            >
              <Zap size={12} />
              Deep analysis
            </Button>
          )}
        </div>

        {inv.hallucinationFlagged && (
          <Alert variant="warning" className="border-amber-300 p-2">
            <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Hallucination flagged</div>
              <div>
                The agent referenced record IDs that don't exist. Treat the
                similar-cases section with extra scrutiny —{" "}
                {canViewAudit
                  ? "see the audit drawer for details."
                  : "ask a reviewer with audit access for details."}
              </div>
            </div>
          </Alert>
        )}
      </CardContent>

      <TransparencyDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        invocation={inv}
      />
    </Card>
  );
}

// ─── Sub-components for the simpler states ─────────────────────────────

function IdleCard({
  onStart,
  starting
}: {
  onStart: (forceEscalation?: boolean) => void;
  starting: boolean;
}) {
  return (
    <Card className="border-violet-200 bg-violet-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-violet-900 text-base">
          <Sparkles size={16} /> RCA Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-violet-900">
        <p>
          Draft initial analysis based on the incident facts. I'll search for
          similar past incidents, review equipment history, and propose root
          causes for your review.
        </p>
        <p className="text-xs text-violet-700">
          Estimated time: 30-60 seconds · estimated cost: ~$0.015 (Haiku)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="success"
            onClick={() => onStart(false)}
            disabled={starting}
          >
            <Sparkles size={14} />
            {starting ? "Starting…" : "Start AI Analysis"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onStart(true)}
            disabled={starting}
            title="Use Opus 4.7 for a deeper analysis. ~10x cost; takes longer."
          >
            <Zap size={12} />
            Deep analysis (Opus)
          </Button>
        </div>
        <p className="text-[10px] text-violet-600 leading-relaxed">
          Output is a draft for your review — accept, modify, or reject every
          suggestion. The agent never decides root cause on its own.
        </p>
      </CardContent>
    </Card>
  );
}

function ErroredCard({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card className="border-rose-200 bg-rose-50/40">
      <CardContent className="p-4 space-y-2 text-sm text-rose-900">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle size={14} /> RCA Assistant could not start
        </div>
        <p className="text-xs">{error}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function ProgressList({
  invocation,
  elapsedMs,
  note,
  error,
  onCheck,
  onRetry
}: {
  invocation: AgentInvocationOut;
  elapsedMs: number;
  note: string | null;
  error: string | null;
  onCheck: () => void;
  onRetry: () => void;
}) {
  const calls = invocation.toolCalls ?? [];
  const EXPECTED_MS = 90_000; // typical multi-tool RCA run ≈ 60-75s
  const pct = Math.min(95, Math.round((elapsedMs / EXPECTED_MS) * 100));
  const overdue = elapsedMs > EXPECTED_MS && !error;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-violet-800">
        <span className="flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" />
          Analysing…
        </span>
        <span className="tabular-nums font-medium">
          {fmtElapsed(elapsedMs)}
          <span className="text-violet-500 font-normal"> / ~1 min</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-violet-100">
        <div
          className={cn("h-full rounded-full transition-all", error ? "bg-rose-400" : "bg-violet-500")}
          style={{ width: `${error ? 100 : pct}%` }}
        />
      </div>

      <ul className="space-y-1 text-xs">
        {calls.length === 0 && !error && (
          <li className="text-violet-700 flex items-center gap-2">
            <CircleDashed size={11} className="animate-pulse" />
            {note ?? "Loading incident context…"}
          </li>
        )}
        {calls.map((tc) => (
          <li key={tc.id || tc.sequence} className="flex items-center gap-2 text-violet-900">
            <CheckCircle2 size={11} className={cn(tc.hadError ? "text-rose-500" : "text-emerald-500")} />
            <span>
              {TOOL_LABELS[tc.toolName] ?? tc.toolName}
              {tc.executionMs != null && (
                <span className="text-violet-500 ml-1">· {(tc.executionMs / 1000).toFixed(1)}s</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {note && !error && <div className="text-[11px] text-amber-600">{note}</div>}

      {/* Surfaced error / overdue — no longer swallowed. Always recoverable. */}
      {(error || overdue) && (
        <Alert variant="warning" className="space-y-2 p-2.5">
          <div className="flex items-start gap-1.5">
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
            <span>{error ?? "This is taking longer than usual — the result is often ready already."}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onCheck}>
              <Loader2 size={12} /> Check status
            </Button>
            <Button size="sm" variant="ghost" onClick={onRetry}>
              <Sparkles size={12} /> Start over
            </Button>
          </div>
        </Alert>
      )}
    </div>
  );
}
