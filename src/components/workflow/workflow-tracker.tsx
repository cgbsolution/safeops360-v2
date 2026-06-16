"use client";

import { useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, User as UserIcon } from "lucide-react";
import { cn, formatDateTime, humanize } from "@/lib/utils";

type Step = {
  id: string;
  sequence: number;
  stepType: string;
  name: string;
  approverRole?: string | null;
  approverField?: string | null;
  slaHours?: number | null;
};

type HistoryEntry = {
  id: string;
  stepId: string | null;
  stepName: string;
  action: string;
  performedAt: Date | string;
  comments?: string | null;
  performedBy: { name: string; designation?: string | null };
};

type Task = {
  id: string;
  stepId: string;
  stepName: string;
  status: string;
  dueAt?: Date | string | null;
  assignedTo: {
    name: string;
    designation?: string | null;
    department?: string | null;
  };
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
      <div className="flex items-stretch gap-0 rounded-lg border bg-white p-3 overflow-x-auto">
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
      </div>

      {/* Pending tasks — only those at the CURRENT active step. Stale
          pending tasks at earlier steps (from older code paths that
          didn't mark them COMPLETED when the workflow advanced) are
          filtered out so the UI shows only who is actually expected to
          act next, not the full history of orphaned tasks. */}
      {(() => {
        const visiblePendingTasks = currentStepId
          ? pendingTasks.filter((t) => t.stepId === currentStepId)
          : pendingTasks;
        if (visiblePendingTasks.length === 0) return null;
        return (
        <div className="rounded-lg border bg-amber-50 border-amber-200 p-3">
          <div className="text-xs uppercase tracking-wider font-semibold text-amber-800 mb-2">Awaiting Action</div>
          <div className="space-y-1.5">
            {visiblePendingTasks.map((t) => {
              // Build the "Designation · Department" suffix from whatever
              // we have. Either field can be missing on User; gracefully
              // skip dots when a field is empty.
              const meta = [t.assignedTo.designation, t.assignedTo.department].filter(Boolean).join(" · ");
              return (
                <div key={t.id} className="flex items-center justify-between text-sm gap-3">
                  <span className="flex items-center gap-2 text-amber-900 min-w-0">
                    <UserIcon size={12} className="flex-shrink-0" />
                    <span className="font-medium">{t.assignedTo.name}</span>
                    {meta && <span className="text-xs text-amber-700/80 truncate">({meta})</span>}
                    <span className="text-amber-400">·</span>
                    <span className="text-amber-700 truncate">{t.stepName}</span>
                  </span>
                  {t.dueAt && (
                    <span className="text-xs text-amber-700 flex-shrink-0">
                      <Clock size={11} className="inline mr-1" />
                      Due {formatDateTime(t.dueAt)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

      {/* Audit trail (collapsible) */}
      <div className="rounded-lg border bg-white">
        <button
          onClick={() => setExpanded(expanded ? null : "audit")}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Audit Trail</span>
            <span className="text-xs text-slate-500">({history.length} {history.length === 1 ? "entry" : "entries"})</span>
          </div>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
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
                    <span className="font-medium">{h.performedBy.name}</span>
                    <span className="text-slate-500"> — {humanize(h.action)}</span>
                    <span className="text-slate-500"> · {h.stepName}</span>
                  </div>
                  {h.comments && <div className="text-slate-600 mt-0.5 italic">"{h.comments}"</div>}
                  <div className="text-xs text-slate-400 mt-0.5">{formatDateTime(h.performedAt)}{h.performedBy.designation ? ` · ${h.performedBy.designation}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
