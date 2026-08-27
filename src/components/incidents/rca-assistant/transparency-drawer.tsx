"use client";

// Audit drawer for AGENT.AUDIT_VIEW holders. Loads the richer
// /api/agent-invocations/{id}/detail endpoint which returns
// inputContext + rawApiResponse in addition to the standard fields.
// The basic invocation (passed in as a prop) seeds the initial render
// so the drawer feels instant; the detail fetch fills in the heavier
// fields once it arrives.
//
// What lives here:
//   • Full reasoning (uncollapsed)
//   • Every tool call with input + output (collapsible, JSON-pretty)
//   • Token usage + cost + latency + model breakdown
//   • Hallucination details if flagged
//   • Raw Anthropic API response (for advanced debug)
//   • The input context that was fed to the agent
//
// Permission note: the parent card only opens this drawer when the
// caller has AGENT.AUDIT_VIEW. If the backend rejects the detail call
// for any reason, we fall back to rendering whatever was in the props
// invocation.

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Wrench,
  Brain,
  Loader2
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

import type {
  AgentInvocationOut,
  AgentToolCallOut,
  HallucinationFinding
} from "./types";

type DetailInvocation = AgentInvocationOut & {
  inputContext: Record<string, unknown>;
  rawApiResponse: Record<string, unknown> | null;
};

export function TransparencyDrawer({
  open,
  onOpenChange,
  invocation
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  invocation: AgentInvocationOut;
}) {
  const [detail, setDetail] = useState<DetailInvocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/agent-invocations/${invocation.id}/detail`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          if (res.status === 403) {
            throw new Error(
              "AGENT.AUDIT_VIEW permission required. Ask System Admin or Corporate HSE for the full audit view."
            );
          }
          throw new Error(`Detail fetch failed (${res.status})`);
        }
        const j = (await res.json()) as DetailInvocation;
        if (!cancelled) setDetail(j);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Could not load details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, invocation.id]);

  // Use the richer detail when available, fall back to the props row.
  const inv: AgentInvocationOut | DetailInvocation = detail ?? invocation;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-violet-900">
            <Brain size={16} /> RCA Agent — Full Audit View
          </SheetTitle>
          <div className="text-[10px] text-slate-500 font-mono">
            {inv.invocationNumber}
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4 text-sm">
          {/* Loading state */}
          {loading && !detail && (
            <div className="flex items-center gap-2 text-xs text-violet-700">
              <Loader2 size={12} className="animate-spin" /> Loading audit detail…
            </div>
          )}
          {error && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              {error}
            </div>
          )}

          {/* Metadata grid */}
          <Section title="Execution">
            <dl className="grid grid-cols-2 gap-y-1 gap-x-3 text-xs">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium">{inv.status}</dd>
              <dt className="text-slate-500">Trigger</dt>
              <dd>{inv.invocationTrigger}</dd>
              <dt className="text-slate-500">Authority level used</dt>
              <dd>{inv.authorityLevelUsed}</dd>
              <dt className="text-slate-500">Model</dt>
              <dd className="font-mono text-[10px]">{inv.modelUsed}</dd>
              <dt className="text-slate-500">Input tokens</dt>
              <dd>{inv.inputTokens ?? "—"}</dd>
              <dt className="text-slate-500">Output tokens</dt>
              <dd>{inv.outputTokens ?? "—"}</dd>
              <dt className="text-slate-500">Total cost</dt>
              <dd>
                {inv.totalCostUsd != null
                  ? `$${inv.totalCostUsd.toFixed(4)}`
                  : "—"}
              </dd>
              <dt className="text-slate-500">Latency</dt>
              <dd>
                {inv.latencyMs != null
                  ? `${(inv.latencyMs / 1000).toFixed(2)}s`
                  : "—"}
              </dd>
              <dt className="text-slate-500">Confidence</dt>
              <dd>
                {inv.agentConfidence != null
                  ? `${Math.round(inv.agentConfidence * 100)}%`
                  : "—"}
              </dd>
            </dl>
          </Section>

          {/* Hallucinations */}
          {inv.hallucinationFlagged && (
            <Section title="Hallucination Findings" tone="amber">
              <ul className="space-y-2 text-xs">
                {(inv.hallucinationDetails ?? []).map(
                  (h: HallucinationFinding, i: number) => (
                    <li
                      key={i}
                      className="rounded border border-amber-200 bg-white p-2"
                    >
                      <div className="font-mono text-[11px] text-amber-900">
                        {h.value}
                      </div>
                      <div className="text-amber-800 mt-0.5">{h.context}</div>
                    </li>
                  )
                )}
              </ul>
            </Section>
          )}

          {/* Reasoning — uncollapsed here */}
          <Section title="Reasoning" icon={Brain}>
            <pre className="text-xs whitespace-pre-wrap text-slate-700 leading-relaxed">
              {inv.agentReasoning ?? "(no reasoning extracted)"}
            </pre>
          </Section>

          {/* Tool calls */}
          <Section title="Tool Calls" icon={Wrench}>
            {(!inv.toolCalls || inv.toolCalls.length === 0) && (
              <div className="text-xs text-slate-500">No tool calls were made.</div>
            )}
            <div className="space-y-2">
              {(inv.toolCalls ?? []).map((tc) => (
                <ToolCallRow key={tc.id ?? tc.sequence} call={tc} />
              ))}
            </div>
          </Section>

          {/* Detail-only sections — input context + raw API response */}
          {detail && (
            <>
              <Section title="Input Context (fed to agent)">
                <JsonBlock value={detail.inputContext} />
              </Section>
              <Section title="Raw API Response (last turn)">
                {detail.rawApiResponse ? (
                  <JsonBlock value={detail.rawApiResponse} />
                ) : (
                  <div className="text-xs text-slate-500">
                    Not captured (invocation predates raw-response logging or
                    errored before completion).
                  </div>
                )}
              </Section>
            </>
          )}

          {/* Human decision if recorded */}
          {inv.humanDecisionAt && (
            <Section title="Human Decision">
              <dl className="grid grid-cols-2 gap-y-1 gap-x-3 text-xs">
                <dt className="text-slate-500">Decision</dt>
                <dd className="font-medium">{inv.humanDecision}</dd>
                <dt className="text-slate-500">At</dt>
                <dd>{formatDateTime(inv.humanDecisionAt)}</dd>
                {inv.ratingByHuman != null && (
                  <>
                    <dt className="text-slate-500">Rating</dt>
                    <dd>{inv.ratingByHuman} / 5</dd>
                  </>
                )}
                {inv.rejectionReason && (
                  <>
                    <dt className="text-slate-500">Rejection reason</dt>
                    <dd className="col-span-1">{inv.rejectionReason}</dd>
                  </>
                )}
                {inv.detailedFeedback && (
                  <>
                    <dt className="text-slate-500">Feedback</dt>
                    <dd className="col-span-1">{inv.detailedFeedback}</dd>
                  </>
                )}
              </dl>
              {inv.humanModifications && (
                <div className="mt-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                    Modifications
                  </div>
                  <JsonBlock value={inv.humanModifications} />
                </div>
              )}
            </Section>
          )}

          <div className="pt-2 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  tone = "default",
  children
}: {
  title: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  tone?: "default" | "amber";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3 space-y-2",
        tone === "amber" ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold",
          tone === "amber"
            ? "text-amber-800 flex items-center gap-1.5"
            : "text-slate-700"
        )}
      >
        {Icon && <Icon size={11} />}
        {tone === "amber" && !Icon && <AlertTriangle size={11} />}
        {title}
      </div>
      {children}
    </div>
  );
}

function ToolCallRow({ call }: { call: AgentToolCallOut }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-100"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span className="font-mono text-[10px] text-slate-500">
          #{call.sequence}
        </span>
        <span className="font-medium">{call.toolName}</span>
        {call.executionMs != null && (
          <span className="text-[10px] text-slate-500 ml-auto">
            {(call.executionMs / 1000).toFixed(2)}s
          </span>
        )}
        {call.hadError && (
          <Badge className="bg-rose-100 text-rose-900 border-rose-300 text-[9px]">
            error
          </Badge>
        )}
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-2">
          <div>
            <div className="text-[10px] uppercase text-slate-500 mb-0.5">Input</div>
            <JsonBlock value={call.toolInput} />
          </div>
          {call.hadError ? (
            <div>
              <div className="text-[10px] uppercase text-rose-600 mb-0.5">Error</div>
              <pre className="text-[11px] text-rose-900 whitespace-pre-wrap bg-rose-50 border border-rose-200 rounded p-2">
                {call.errorDetails ?? "(no detail)"}
              </pre>
            </div>
          ) : (
            <div>
              <div className="text-[10px] uppercase text-slate-500 mb-0.5">Output</div>
              <JsonBlock value={call.toolOutput} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  // Pretty-print with a max height so a giant context doesn't blow
  // the drawer. Mono font + small size so it doesn't compete visually.
  return (
    <pre className="text-[10px] leading-tight bg-slate-50 border border-slate-200 rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
