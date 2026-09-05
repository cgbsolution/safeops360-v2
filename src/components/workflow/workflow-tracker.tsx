"use client";

import { useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, User as UserIcon } from "lucide-react";
import { cn, formatDateTime, humanize } from "@/lib/utils";
import { formatPartyMeta, formatPartyMetaOrHint, formatPartyName } from "@/lib/users/user-ref";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

type Step = {
  id: string;
  sequence: number;
  stepType: string;
  name: string;
  approverRole?: string | null;
  approverField?: string | null;
  slaHours?: number | null;
};

// Everyone shown on the tracker — the pending assignee and every actor in the
// audit trail — is described by the same identity shape, so "who is this?" reads
// identically wherever it appears. `plantName` is flattened by the caller from
// the User → Plant relation.
type Party = {
  name?: string | null;
  designation?: string | null;
  role?: string | null;
  department?: string | null;
  plantName?: string | null;
};

type HistoryEntry = {
  id: string;
  stepId: string | null;
  stepName: string;
  action: string;
  performedAt: Date | string;
  comments?: string | null;
  performedBy: Party;
};

type Task = {
  id: string;
  stepId: string;
  stepName: string;
  status: string;
  dueAt?: Date | string | null;
  assignedTo: Party;
};

export function WorkflowTracker({
  steps,
  history,
  pendingTasks,
  currentStepId,
  status
}: {
  steps: Step[];
  history: HistoryEntry[];
  pendingTasks: Task[];
  currentStepId?: string | null;
  status: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const isComplete = status === "COMPLETED";
  const isRejected = status === "REJECTED";

  // Build map of step → completion info
  const completedSteps = new Set(
    history.filter((h) => h.action === "APPROVED" || h.action === "EXECUTED" || h.action === "VERIFIED" || h.action === "COMPLETED").map((h) => h.stepId)
  );
  const submittedStep = history.find((h) => h.action === "SUBMITTED")?.stepId;
  if (submittedStep) completedSteps.add(submittedStep);
  // Treat all steps before currentStep as done if instance is in progress
  const currentIdx = steps.findIndex((s) => s.id === currentStepId);
  if (currentIdx > 0) {
    steps.slice(0, currentIdx).forEach((s) => completedSteps.add(s.id));
  }
  if (isComplete) steps.forEach((s) => completedSteps.add(s.id));
  // Rework state: when the workflow has bounced back to a step that was
  // previously executed (verifier rejected → back to ASSIGNEE_TASK), drop
  // the "done" mark on the current step so it renders as active again.
  if (currentStepId && !isComplete) {
    completedSteps.delete(currentStepId);
  }

  return (
    <div className="space-y-3">
      {/* Stepper — single rendering for all viewports. The previous mobile
          vertical timeline was a duplicate of the same data. */}
      <Card className="flex items-stretch gap-0 rounded-lg border bg-white p-3 overflow-x-auto shadow-none">
        {steps.map((step, i) => {
          const done = completedSteps.has(step.id);
          const active = step.id === currentStepId && !isComplete;
          const last = i === steps.length - 1;
          return (
            <div key={step.id} className="flex-1 flex items-stretch">
              <div className="flex flex-col items-center flex-1 px-2">
                <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  done && "bg-emerald-600 text-white",
                  active && !done && "bg-primary-700 text-white ring-4 ring-primary-200 animate-pulse",
                  !done && !active && "bg-slate-200 text-slate-500",
                  isRejected && step.id === currentStepId && "bg-rose-600 text-white ring-4 ring-rose-200"
                )}>
                  {done ? <CheckCircle2 size={16} /> : isRejected && step.id === currentStepId ? <AlertTriangle size={16} /> : step.sequence}
                </div>
                <div className="mt-2 text-center">
                  <div className={cn(
                    "text-[10px] uppercase tracking-wider font-semibold",
                    done ? "text-emerald-700" : active ? "text-primary-700" : "text-slate-400"
                  )}>
                    {step.stepType.replace("_", " ")}
                  </div>
                  <div className={cn(
                    "text-xs font-medium leading-tight mt-0.5",
                    done || active ? "text-slate-900" : "text-slate-400"
                  )}>
                    {step.name}
                  </div>
                </div>
              </div>
              {!last && (
                <div className="flex-shrink-0 self-start mt-4 w-8">
                  <div className={cn("h-1 rounded transition-all", done ? "bg-emerald-500" : "bg-slate-200")} />
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {/* Pending tasks — only those at the CURRENT active step. Stale
          pending tasks at earlier steps (from older code paths that
          didn't mark them COMPLETED when the workflow advanced) are
          filtered out so the UI shows only who is actually expected to
          act next, not the full history of orphaned tasks. */}
      {(() => {
        // `pendingTasks` is every task on the instance, terminal ones included
        // (see lib/workflow/state.ts) — so filter to the live ones FIRST.
        // Without this, a completed or rejected instance has no currentStepId,
        // the step filter below falls through, and the panel listed every
        // finished step of a closed record under the heading "Awaiting Action".
        const open = pendingTasks.filter((t) =>
          ["PENDING", "OVERDUE", "ESCALATED"].includes(t.status)
        );
        const visiblePendingTasks = currentStepId
          ? open.filter((t) => t.stepId === currentStepId)
          : open;
        if (visiblePendingTasks.length === 0) return null;
        return (
        <Alert variant="warning" className="rounded-lg border bg-amber-50 border-amber-200 p-3">
          <div className="text-xs uppercase tracking-wider font-semibold text-amber-800 mb-2">Awaiting Action</div>
          <div className="space-y-2.5">
            {visiblePendingTasks.map((t) => (
              // Two lines on purpose: the person's full name has to be legible
              // at a glance, and designation / role / department / plant are
              // what tell a reader WHICH "Process Operator" owes the action.
              // Squeezing all five onto one line truncated the identity away
              // on narrower screens, which is exactly what we're fixing.
              <div key={t.id} className="flex items-start justify-between text-sm gap-3">
                <span className="flex items-start gap-2 text-amber-900 min-w-0">
                  <UserIcon size={12} className="flex-shrink-0 mt-1" />
                  <span className="min-w-0">
                    <span className="block">
                      <span className="font-semibold">{formatPartyName(t.assignedTo)}</span>
                      <span className="text-amber-400"> · </span>
                      <span className="text-amber-700">{t.stepName}</span>
                    </span>
                    <span className="block text-xs text-amber-700/90 mt-0.5">
                      {formatPartyMetaOrHint(t.assignedTo)}
                    </span>
                  </span>
                </span>
                {t.dueAt && (
                  <span className="text-xs text-amber-700 flex-shrink-0 mt-0.5">
                    <Clock size={11} className="inline mr-1" />
                    Due {formatDateTime(t.dueAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Alert>
        );
      })()}

      {/* Audit trail (collapsible) */}
      <Card className="rounded-lg border bg-white shadow-none">
        <Button variant="ghost"
          onClick={() => setExpanded(expanded ? null : "audit")} className="h-auto whitespace-normal w-full flex justify-between px-4 py-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Audit Trail</span>
            <span className="text-xs text-slate-500">({history.length} {history.length === 1 ? "entry" : "entries"})</span>
          </div>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
        {expanded && (
          <div className="border-t px-4 py-3 space-y-3">
            {history.length === 0 && <p className="text-sm text-slate-500">No actions recorded yet.</p>}
            {history.map((h) => (
              <div key={h.id} className="flex items-start gap-3 text-sm">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                  h.action === "APPROVED" || h.action === "EXECUTED" || h.action === "VERIFIED" || h.action === "COMPLETED" ? "bg-emerald-500" :
                  h.action === "REJECTED" ? "bg-rose-500" :
                  h.action === "REASSIGNED" ? "bg-blue-500" :
                  h.action === "ESCALATED" ? "bg-orange-500" :
                  "bg-slate-400"
                )} />
                <div className="flex-1">
                  <div className="text-slate-900">
                    <span className="font-medium">{formatPartyName(h.performedBy)}</span>
                    <span className="text-slate-500"> — {humanize(h.action)}</span>
                    <span className="text-slate-500"> · {h.stepName}</span>
                  </div>
                  {h.comments && <div className="text-slate-600 mt-0.5 italic">"{h.comments}"</div>}
                  <div className="text-xs text-slate-400 mt-0.5">
                    {[formatDateTime(h.performedAt), formatPartyMeta(h.performedBy)].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
