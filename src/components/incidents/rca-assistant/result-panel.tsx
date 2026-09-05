"use client";

// Renders the agent's structured result inside the RcaAssistantCard.
// Receives a populated AgentInvocationOut and is rendered when status
// is PENDING_REVIEW or any terminal decision state (ACCEPTED / MODIFIED /
// REJECTED) — same panel for all of them; the difference is whether
// the DecisionPanel below also shows.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Lightbulb,
  AlertTriangle,
  CheckSquare,
  FileSearch,
  History,
  Info,
  LinkIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

import { RCA_METHOD_LABELS } from "@/lib/rca/types";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  isParsedSuggestion,
  type AgentInvocationOut,
  type RcaSuggestion
} from "./types";

export function ResultPanel({
  invocation,
  hasLoaded,
  onLoadIntoEditor
}: {
  invocation: AgentInvocationOut;
  hasLoaded: boolean;
  onLoadIntoEditor: () => void;
}) {
  // Reasoning is long — start collapsed.
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const suggestion = invocation.agentSuggestion;
  if (!suggestion) {
    return (
      <Alert variant="warning" className="p-3">
        The agent finished but produced no parsed suggestion. The reasoning
        may still be useful — open "View Full Reasoning" below.
      </Alert>
    );
  }

  // Malformed JSON inside <suggestion> — show the raw text instead of
  // failing silently.
  if (!isParsedSuggestion(suggestion)) {
    return (
      <div className="space-y-2">
        <Alert variant="warning" className="p-3">
          The agent emitted a suggestion block that wasn't valid JSON. Raw
          contents below — review and capture the analysis manually.
        </Alert>
        <pre className="text-[11px] whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-2 max-h-60 overflow-auto">
          {(suggestion as { _unparsed: string })._unparsed}
        </pre>
      </div>
    );
  }

  const s = suggestion as RcaSuggestion;
  const confidence = invocation.agentConfidence;

  return (
    <div className="space-y-4">
      {/* Confidence + reasoning toggle row */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-600">Confidence</span>
          <ConfidenceMeter value={confidence} />
        </div>
        <button
          type="button"
          onClick={() => setReasoningOpen((v) => !v)}
          className="flex items-center gap-1 text-violet-700 hover:text-violet-900"
        >
          {reasoningOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Reasoning
        </button>
      </div>

      {reasoningOpen && invocation.agentReasoning && (
        <Card className="whitespace-pre-wrap rounded-md border-slate-200 p-3 text-xs leading-relaxed text-slate-700 shadow-none">
          {invocation.agentReasoning}
        </Card>
      )}

      {/* Recommended methodology + Load Into Editor */}
      <Section icon={Lightbulb} title="Recommended Methodology">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-violet-100 text-violet-900 border-violet-300">
            {RCA_METHOD_LABELS[s.recommendedMethod] ?? s.recommendedMethod}
          </Badge>
          <span className="text-xs text-slate-600">{s.methodRationale}</span>
        </div>
        <div className="pt-2">
          <Button
            type="button"
            size="sm"
            variant={hasLoaded ? "outline" : "success"}
            onClick={onLoadIntoEditor}
          >
            {hasLoaded ? "Re-load Into Editor" : "Load Into Editor"}
          </Button>
          {hasLoaded && (
            <span className="ml-2 text-[11px] text-emerald-700">
              ✓ Draft loaded — review the editor below.
            </span>
          )}
        </div>
      </Section>

      {/* Proposed root causes */}
      {s.proposedRootCauses?.length > 0 && (
        <Section icon={CheckSquare} title="Proposed Root Causes">
          <ol className="list-decimal list-inside text-xs space-y-1 text-slate-800">
            {s.proposedRootCauses.map((rc, i) => (
              <li key={i}>{rc}</li>
            ))}
          </ol>
          <p className="text-[10px] text-slate-500 mt-1">
            Loaded into the root-cause field when you click Load Into Editor.
            Edit / remove freely before saving.
          </p>
        </Section>
      )}

      {/* Contributing factors */}
      {s.contributingFactors?.length > 0 && (
        <Section icon={Info} title="Contributing Factors">
          <ul className="list-disc list-inside text-xs space-y-1 text-slate-700">
            {s.contributingFactors.map((cf, i) => (
              <li key={i}>{cf}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Evidence gaps */}
      {s.evidenceGaps?.length > 0 && (
        <Section icon={FileSearch} title="Evidence Gaps To Address">
          <ul className="list-disc list-inside text-xs space-y-1 text-slate-700">
            {s.evidenceGaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Similar cases */}
      {s.similarCasesReferenced?.length > 0 && (
        <Section icon={History} title="Similar Past Cases">
          <ul className="space-y-2 text-xs">
            {s.similarCasesReferenced.map((c, i) => (
              <li
                key={c.incidentNumber + i}
                className="rounded-md border border-slate-200 bg-white p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-violet-700">
                    {c.incidentNumber}
                  </span>
                  <a
                    href={`/incidents?q=${encodeURIComponent(c.incidentNumber)}`}
                    className="text-[10px] text-violet-600 hover:underline flex items-center gap-1"
                  >
                    Find <LinkIcon size={10} />
                  </a>
                </div>
                <div className="text-slate-700 mt-1 text-[11px]">{c.relevance}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Caveats */}
      {s.caveats?.length > 0 && (
        <Section icon={AlertTriangle} title="Caveats" tone="amber">
          <ul className="list-disc list-inside text-xs space-y-1 text-amber-900">
            {s.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// ─── Small layout helpers ──────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  tone = "default",
  children
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  tone?: "default" | "amber";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3 space-y-2",
        tone === "amber"
          ? "border-amber-200 bg-amber-50/60"
          : "border-violet-200 bg-white"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold",
          tone === "amber" ? "text-amber-800" : "text-violet-800"
        )}
      >
        <Icon size={11} /> {title}
      </div>
      {children}
    </div>
  );
}

function ConfidenceMeter({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-slate-400 text-xs">unknown</span>;
  }
  const pct = Math.round(value * 100);
  // 5-dot indicator, filled by quintile. Matches the brief's mockup.
  const filled = Math.min(5, Math.round(value * 5));
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              i < filled ? "bg-violet-600" : "bg-violet-200"
            )}
          />
        ))}
      </span>
      <span className="text-violet-800 text-xs font-medium">{pct}%</span>
    </span>
  );
}
