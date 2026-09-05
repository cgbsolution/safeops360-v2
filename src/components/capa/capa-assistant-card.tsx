"use client";

// CAPA Assistant — the "Draft analysis" entry point on the CAPA Root Cause tab.
//
// This is the real implementation of the flow the Configuration → AI Agents
// walkthrough advertises ("CAPA Assistant card → Draft analysis"). The agent
// (CAPA_ASSISTANT) is L0 / advisory — nothing it produces writes to the CAPA
// register. The owner copies what they want into the Submit RCA form below and
// records Accept/Dismiss so the platform's calibration metrics learn from it.
//
// State machine: IDLE → RUNNING (poll) → PENDING_REVIEW → ACCEPTED/REJECTED.
//
// Network (all auto-proxied to FastAPI by src/app/api/[...path]/route.ts):
//   POST /api/agents/CAPA_ASSISTANT/invoke
//   GET  /api/agent-invocations/{id}
//   POST /api/agent-invocations/{id}/decision
//   GET  /api/agents/latest-invocation?sourceModule=CAPA&sourceRecordId={id}

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { usePermission } from "@/components/auth/can";
import {
  Sparkles,
  AlertCircle,
  Loader2,
  Zap,
  Copy,
  Check,
  X as XIcon,
  CircleDashed
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_MS = 180_000;

// ── Minimal shape of the backend AgentInvocationOut we actually read ──
type ToolCall = { id?: string; sequence: number; toolName: string; executionMs?: number | null; hadError?: boolean };
type Invocation = {
  id: string;
  invocationNumber: string;
  status: string; // RUNNING | PENDING_REVIEW | ACCEPTED | MODIFIED | REJECTED | ERRORED
  modelUsed?: string | null;
  totalCostUsd?: number | null;
  latencyMs?: number | null;
  invokedAt?: string | null;
  agentReasoning?: string | null;
  agentSuggestion?: Record<string, any> | null;
  agentConfidence?: number | null;
  errorType?: string | null;
  errorDetails?: string | null;
  toolCalls?: ToolCall[];
};
type StartResponse = { invocationId: string; invocationNumber: string; status: string };

export function CapaAssistantCard({ capaId }: { capaId: string }) {
  const canInvoke = usePermission("AGENT.CAPA_INVOKE");
  const { toast } = useToast();

  const [invocation, setInvocation] = useState<Invocation | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pollNote, setPollNote] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pollAbortRef = useRef<{ cancelled: boolean } | null>(null);

  // Stop any poll loop on unmount.
  useEffect(
    () => () => {
      if (pollAbortRef.current) pollAbortRef.current.cancelled = true;
    },
    []
  );

  // Elapsed-time ticker while running.
  const runningStatus = invocation?.status;
  useEffect(() => {
    if (runningStatus !== "RUNNING") return;
    const t = setInterval(() => {
      if (startTimeRef.current != null) setElapsedMs(Date.now() - startTimeRef.current);
    }, 500);
    return () => clearInterval(t);
  }, [runningStatus]);

  // Hydrate from the latest invocation so a finished draft survives a reload.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/agents/latest-invocation?sourceModule=CAPA&sourceRecordId=${encodeURIComponent(capaId)}`,
          { cache: "no-store" }
        );
        if (!res.ok || cancelled) return;
        const inv = (await res.json()) as Invocation | null;
        if (!inv || !inv.id || cancelled) return;
        setInvocation((cur) => cur ?? inv);
        if (inv.status === "RUNNING") {
          startTimeRef.current = inv.invokedAt ? new Date(inv.invokedAt).getTime() : Date.now();
          const token = { cancelled: false };
          pollAbortRef.current = token;
          pollUntilDone(inv.id, token);
        }
      } catch {
        /* stay IDLE */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capaId]);

  // Permission gate — render nothing rather than a disabled control.
  if (!canInvoke) return null;

  async function startInvocation(forceEscalation = false) {
    setStarting(true);
    setError(null);
    setInvocation(null);
    setPollNote(null);
    setElapsedMs(0);
    startTimeRef.current = Date.now();

    if (pollAbortRef.current) pollAbortRef.current.cancelled = true;
    const cancelToken = { cancelled: false };
    pollAbortRef.current = cancelToken;

    try {
      const res = await fetch("/api/agents/CAPA_ASSISTANT/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceModule: "CAPA",
          sourceRecordId: capaId,
          forceEscalationModel: forceEscalation
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? body?.error ?? `Invocation failed (${res.status})`);
      }
      const start = (await res.json()) as StartResponse;
      setInvocation({
        id: start.invocationId,
        invocationNumber: start.invocationNumber,
        status: "RUNNING",
        toolCalls: []
      });
      await pollUntilDone(start.invocationId, cancelToken);
    } catch (e: any) {
      if (!cancelToken.cancelled) setError(e?.message ?? "Could not start the agent");
    } finally {
      setStarting(false);
    }
  }

  async function pollUntilDone(invocationId: string, cancelToken: { cancelled: boolean }) {
    const deadline = Date.now() + POLL_MAX_MS;
    let consecutiveErrors = 0;
    while (Date.now() < deadline) {
      if (cancelToken.cancelled) return;
      try {
        const res = await fetch(`/api/agent-invocations/${invocationId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const next = (await res.json()) as Invocation;
        if (cancelToken.cancelled) return;
        consecutiveErrors = 0;
        setPollNote(null);
        setInvocation(next);
        if (next.status !== "RUNNING") return;
      } catch {
        if (cancelToken.cancelled) return;
        consecutiveErrors += 1;
        setPollNote("Reconnecting to the agent service…");
        if (consecutiveErrors >= 8) {
          setError(
            "Lost connection to the agent service. The draft may still be finishing — click “Check status”."
          );
          return;
        }
      }
      if (cancelToken.cancelled) return;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    await checkStatusNow(invocationId);
    if (!cancelToken.cancelled) {
      setError("The agent is taking longer than usual — click “Check status” to refresh.");
    }
  }

  async function checkStatusNow(id?: string) {
    const invocationId = id ?? invocation?.id;
    if (!invocationId) return;
    setPollNote("Checking…");
    try {
      const res = await fetch(`/api/agent-invocations/${invocationId}`, { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as Invocation;
        setInvocation(next);
        if (next.status !== "RUNNING") setError(null);
      }
    } catch {
      /* user can click again */
    } finally {
      setPollNote(null);
    }
  }

  async function recordDecision(decision: "ACCEPT_AS_IS" | "REJECT", rejectionReason?: string) {
    if (!invocation) return;
    try {
      const res = await fetch(`/api/agent-invocations/${invocation.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, rejectionReason })
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.detail ?? b?.error ?? `Decision failed (${res.status})`);
      }
      const updated = (await res.json()) as Invocation;
      setInvocation(updated);
      toast({
        variant: "success",
        title: decision === "REJECT" ? "Draft dismissed" : "Draft marked as used",
        description: `Invocation ${updated.invocationNumber} → ${updated.status.toLowerCase()}`
      });
    } catch (e: any) {
      toast({ variant: "error", title: "Could not record decision", description: e?.message ?? "Try again" });
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const status = invocation?.status ?? null;

  // 1. IDLE
  if (!invocation && !error) {
    return <IdleCard onStart={startInvocation} starting={starting} />;
  }
  // 2. Failed to even start
  if (!invocation && error) {
    return (
      <Card className="border-rose-200 bg-rose-50/40">
        <CardContent className="p-4 space-y-2 text-sm text-rose-900">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle size={14} /> CAPA Assistant could not start
          </div>
          <p className="text-xs">{error}</p>
          <Button size="sm" variant="outline" onClick={() => startInvocation(false)}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const inv = invocation!;
  return (
    <Card className="border-violet-300 bg-violet-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-violet-900 text-base">
          <Sparkles size={16} /> CAPA Assistant
          <Badge
            className={cn(
              "ml-auto text-[10px] font-medium",
              status === "RUNNING" && "bg-amber-100 text-amber-900 border-amber-300",
              (status === "PENDING_REVIEW" || status === "ACCEPTED") &&
                "bg-emerald-100 text-emerald-900 border-emerald-300",
              status === "REJECTED" && "bg-slate-100 text-slate-700 border-slate-300",
              status === "ERRORED" && "bg-rose-100 text-rose-900 border-rose-300"
            )}
          >
            {status === "RUNNING" ? (
              <>
                <Loader2 size={11} className="animate-spin" /> Running
              </>
            ) : (
              status?.replace(/_/g, " ").toLowerCase() ?? ""
            )}
          </Badge>
        </CardTitle>
        <div className="text-[10px] text-violet-700 tracking-wide">
          {inv.invocationNumber} · model {inv.modelUsed || "…"}
          {inv.totalCostUsd != null && <> · ${inv.totalCostUsd.toFixed(4)}</>}
          {inv.latencyMs != null && <> · {(inv.latencyMs / 1000).toFixed(1)}s</>}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {status === "RUNNING" && (
          <RunningView
            invocation={inv}
            elapsedMs={elapsedMs}
            note={pollNote}
            error={error}
            onCheck={() => checkStatusNow()}
            onRetry={() => startInvocation(false)}
          />
        )}

        {status === "ERRORED" && (
          <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-900 text-sm space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5" />
              <div className="font-medium">
                {inv.errorType ?? "Error"}: {inv.errorDetails ?? "Unknown failure"}
              </div>
            </div>
            {(inv.errorDetails ?? "").toLowerCase().includes("anthropic") && (
              <p className="text-xs text-rose-800">
                The backend has no Anthropic API key configured. Set <code>ANTHROPIC_API_KEY</code> in the
                FastAPI environment and restart it to enable live drafting.
              </p>
            )}
            <Button size="sm" variant="outline" onClick={() => startInvocation(false)} disabled={starting}>
              {starting ? "Retrying…" : "Retry"}
            </Button>
          </Alert>
        )}

        {(status === "PENDING_REVIEW" || status === "ACCEPTED" || status === "REJECTED" || status === "MODIFIED") && (
          <SuggestionView
            invocation={inv}
            copied={copied}
            onCopy={copy}
          />
        )}

        {status === "PENDING_REVIEW" && (
          <Alert variant="brand" className="rounded-md border border-violet-200 bg-white/70 p-2.5 text-xs text-violet-800 space-y-2">
            <p>
              This is an advisory draft. Copy what you want into the <strong>Submit RCA</strong> form below —
              recording a decision here only trains the assistant, it does not write to the CAPA.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="success" onClick={() => recordDecision("ACCEPT_AS_IS")}>
                <Check size={13} /> Mark as used
              </Button>
              <Button size="sm" variant="outline" onClick={() => recordDecision("REJECT")}>
                <XIcon size={13} /> Dismiss
              </Button>
            </div>
          </Alert>
        )}

        {/* Footer — rerun / deep analysis */}
        {status !== "RUNNING" && (
          <div className="pt-2 border-t border-violet-200/60 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => startInvocation(false)} disabled={starting} className="ml-auto">
              <Sparkles size={12} /> {starting ? "Starting…" : "Run again"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => startInvocation(true)}
              disabled={starting}
              title="Use the escalation model for a deeper, slower, more expensive draft."
            >
              <Zap size={12} /> Deep analysis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── IDLE ───────────────────────────────────────────────────────────────
function IdleCard({ onStart, starting }: { onStart: (force?: boolean) => void; starting: boolean }) {
  return (
    <Card className="border-violet-200 bg-violet-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-violet-900 text-base">
          <Sparkles size={16} /> CAPA Assistant
          <Badge variant="violet" size="sm" className="ml-2 py-px font-medium">
            AI · advisory
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-violet-900">
        <p>
          Draft root-cause candidates, action proposals, and a verification approach for this CAPA —
          calibrated to its source category. Every suggestion is a draft you review before saving.
        </p>
        <p className="text-xs text-violet-700">Estimated time: 30–60 seconds · L0 advisory — nothing writes to the CAPA automatically.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="success" onClick={() => onStart(false)} disabled={starting}>
            <Sparkles size={14} /> {starting ? "Starting…" : "Draft analysis"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onStart(true)}
            disabled={starting}
            title="Use the escalation model for a deeper draft. Slower and more expensive."
          >
            <Zap size={12} /> Deep analysis
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── RUNNING ─────────────────────────────────────────────────────────────
function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function RunningView({
  invocation,
  elapsedMs,
  note,
  error,
  onCheck,
  onRetry
}: {
  invocation: Invocation;
  elapsedMs: number;
  note: string | null;
  error: string | null;
  onCheck: () => void;
  onRetry: () => void;
}) {
  const EXPECTED_MS = 60_000;
  const pct = Math.min(95, Math.round((elapsedMs / EXPECTED_MS) * 100));
  const overdue = elapsedMs > EXPECTED_MS && !error;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-violet-800">
        <span className="flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" /> Drafting…
        </span>
        <span className="tabular-nums font-medium">
          {fmtElapsed(elapsedMs)} <span className="text-violet-500 font-normal">/ ~1 min</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-violet-100">
        <div
          className={cn("h-full rounded-full transition-all", error ? "bg-rose-400" : "bg-violet-500")}
          style={{ width: `${error ? 100 : pct}%` }}
        />
      </div>
      <div className="text-xs text-violet-700 flex items-center gap-2">
        <CircleDashed size={11} className="animate-pulse" />
        {note ?? "Loading CAPA context and analysing…"}
      </div>
      {(error || overdue) && (
        <Alert variant="warning" className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 space-y-2">
          <div className="flex items-start gap-1.5">
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
            <span>{error ?? "This is taking longer than usual — the draft is often ready already."}</span>
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

// ── SUGGESTION OUTPUT ───────────────────────────────────────────────────
function SuggestionView({
  invocation,
  copied,
  onCopy
}: {
  invocation: Invocation;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  // Recover drafts that came back wrapped in a markdown code fence (older
  // invocations were stored under `_unparsed` before the backend learned to
  // strip fences). Try to parse the raw text client-side so it still renders.
  let s = invocation.agentSuggestion;
  if (s && typeof s._unparsed === "string") {
    const recovered = recoverFencedJson(s._unparsed);
    if (recovered) s = recovered;
  }

  if (!s) {
    return (
      <div className="text-xs text-slate-500 italic">
        The agent returned no structured suggestion.
        {invocation.agentReasoning && <div className="mt-1 not-italic text-slate-600">{invocation.agentReasoning}</div>}
      </div>
    );
  }

  const task: string = s.task ?? (s.suggestions ? "suggest_root_causes" : s.methodId ? "suggest_verification" : "unknown");

  return (
    <div className="space-y-3">
      {task === "suggest_root_causes" && <RootCauses suggestions={s.suggestions ?? []} copied={copied} onCopy={onCopy} />}
      {task === "suggest_actions" && <Actions suggestions={s.suggestions ?? []} copied={copied} onCopy={onCopy} />}
      {task === "suggest_verification" && <Verification s={s} copied={copied} onCopy={onCopy} />}
      {task === "unknown" && (
        <pre className="text-[11px] whitespace-pre-wrap rounded bg-slate-50 border p-2 text-slate-700">
          {JSON.stringify(s, null, 2)}
        </pre>
      )}

      {typeof s.overallConfidence === "number" && (
        <div className="text-[11px] text-slate-500">
          Overall confidence: <span className="font-medium">{Math.round(s.overallConfidence * 100)}%</span>
        </div>
      )}
      {s.notes && <Alert variant="warning" className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{s.notes}</Alert>}
    </div>
  );
}

function CopyBtn({ text, k, copied, onCopy }: { text: string; k: string; copied: string | null; onCopy: (t: string, k: string) => void }) {
  return (
    <Button variant="outline"
      type="button"
      onClick={() => onCopy(text, k)} className="gap-1 rounded px-1.5 py-0.5 text-[10px]"
      title="Copy to clipboard">
      {copied === k ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
      {copied === k ? "Copied" : "Copy"}
    </Button>
  );
}

function RootCauses({
  suggestions,
  copied,
  onCopy
}: {
  suggestions: any[];
  copied: string | null;
  onCopy: (t: string, k: string) => void;
}) {
  if (suggestions.length === 0) return <Empty label="No root-cause candidates were confident enough to suggest." />;
  return (
    <div className="space-y-2">
      <Heading text={`Candidate root causes (${suggestions.length})`} />
      {suggestions.map((rc, i) => (
        <Alert variant="brand" key={i} className="rounded-lg border border-violet-100 bg-white p-2.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-slate-800">{rc.description}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {rc.category && <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] text-slate-600">{rc.category}</span>}
              <CopyBtn text={rc.description ?? ""} k={`rc-${i}`} copied={copied} onCopy={onCopy} />
            </div>
          </div>
          {rc.rationale && <div className="text-xs text-slate-600 mt-1">{rc.rationale}</div>}
          {typeof rc.confidence === "number" && (
            <div className="text-[10px] text-slate-400 mt-0.5">Confidence: {Math.round(rc.confidence * 100)}%</div>
          )}
          {Array.isArray(rc.evidenceToGather) && rc.evidenceToGather.length > 0 && (
            <div className="mt-1.5 border-l-2 border-violet-200 pl-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Evidence to gather</div>
              <ul className="mt-0.5 space-y-0.5">
                {rc.evidenceToGather.map((e: string, j: number) => (
                  <li key={j} className="text-[11px] text-slate-600">• {e}</li>
                ))}
              </ul>
            </div>
          )}
        </Alert>
      ))}
    </div>
  );
}

function Actions({
  suggestions,
  copied,
  onCopy
}: {
  suggestions: any[];
  copied: string | null;
  onCopy: (t: string, k: string) => void;
}) {
  if (suggestions.length === 0) return <Empty label="No action proposals were suggested." />;
  return (
    <div className="space-y-2">
      <Heading text={`Proposed actions (${suggestions.length})`} />
      {suggestions.map((a, i) => (
        <Alert variant="brand" key={i} className="rounded-lg border border-violet-100 bg-white p-2.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-slate-800">{a.description}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {a.actionType && (
                <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] text-slate-600">{String(a.actionType).replace(/_/g, " ")}</span>
              )}
              <CopyBtn text={a.description ?? ""} k={`act-${i}`} copied={copied} onCopy={onCopy} />
            </div>
          </div>
          {a.rationale && <div className="text-xs text-slate-600 mt-1">{a.rationale}</div>}
          <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {a.targetRoleSuggestion && <span>Suggested owner: {a.targetRoleSuggestion}</span>}
            {a.targetDaysFromNow != null && <span>Target: ~{a.targetDaysFromNow} days</span>}
          </div>
          {a.verificationCriterion && (
            <div className="text-[11px] text-slate-600 mt-1 border-l-2 border-violet-200 pl-2">
              <span className="text-slate-400">Verify: </span>
              {a.verificationCriterion}
            </div>
          )}
        </Alert>
      ))}
    </div>
  );
}

function Verification({
  s,
  copied,
  onCopy
}: {
  s: Record<string, any>;
  copied: string | null;
  onCopy: (t: string, k: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Heading text="Verification approach" />
      <Alert variant="brand" className="rounded-lg border border-violet-100 bg-white p-2.5 space-y-1.5">
        {s.criterion && (
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm text-slate-800">
              <span className="text-slate-400 text-xs">Criterion: </span>
              {s.criterion}
            </div>
            <CopyBtn text={s.criterion} k="verif-criterion" copied={copied} onCopy={onCopy} />
          </div>
        )}
        <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">
          {s.methodId && <span>Method: {s.methodId}</span>}
          {s.targetWaitDays != null && <span>Wait: ~{s.targetWaitDays} days</span>}
        </div>
        {s.successThresholdRationale && <div className="text-xs text-slate-600">{s.successThresholdRationale}</div>}
        {Array.isArray(s.dataToCollect) && s.dataToCollect.length > 0 && (
          <div className="border-l-2 border-violet-200 pl-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Data to collect</div>
            <ul className="mt-0.5 space-y-0.5">
              {s.dataToCollect.map((d: string, j: number) => (
                <li key={j} className="text-[11px] text-slate-600">• {d}</li>
              ))}
            </ul>
          </div>
        )}
        {Array.isArray(s.recurrenceRisks) && s.recurrenceRisks.length > 0 && (
          <div className="border-l-2 border-amber-200 pl-2">
            <div className="text-[10px] uppercase tracking-wider text-amber-500">Recurrence risks</div>
            <ul className="mt-0.5 space-y-0.5">
              {s.recurrenceRisks.map((r: string, j: number) => (
                <li key={j} className="text-[11px] text-slate-600">• {r}</li>
              ))}
            </ul>
          </div>
        )}
      </Alert>
    </div>
  );
}

// Recover a JSON object the model wrapped in a ```json fence (or surrounded
// with prose). Returns the parsed object, or null if nothing usable is found.
function recoverFencedJson(raw: string): Record<string, any> | null {
  let s = raw.trim();
  const fence = s.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    /* fall through to span extraction */
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {
      /* give up */
    }
  }
  return null;
}

function Heading({ text }: { text: string }) {
  return <div className="text-xs font-semibold uppercase tracking-wider text-violet-700">{text}</div>;
}

function Empty({ label }: { label: string }) {
  return <div className="text-xs text-slate-500 italic">{label}</div>;
}
