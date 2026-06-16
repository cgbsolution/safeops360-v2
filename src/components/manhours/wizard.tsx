"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import {
  STEPS,
  type StepNumber,
  type WizardSubmission,
  type DepartmentOption,
  type ContractorOption
} from "./wizard-types";
import { StepPeriod } from "./step-period";
import { StepCategories } from "./step-categories";
import { StepVisitors } from "./step-visitors";
import { StepDeductions } from "./step-deductions";
import { StepAttachments } from "./step-attachments";
import { StepValidate } from "./step-validate";
import { ManhoursActionPanel } from "./action-panel";
import { LockedKpiPanel } from "./locked-kpi-panel";
import { WorkflowTracker } from "@/components/workflow/workflow-tracker";

interface WorkflowSnapshot {
  steps: {
    id: string;
    sequence: number;
    stepType: string;
    name: string;
    approverRole?: string | null;
    slaHours?: number | null;
  }[];
  history: {
    id: string;
    stepId: string | null;
    stepName: string;
    action: string;
    performedAt: string;
    comments?: string | null;
    performedBy: { name: string; designation?: string | null };
  }[];
  pendingTasks: {
    id: string;
    stepId: string;
    stepName: string;
    status: string;
    dueAt?: string | null;
    assignedTo: { name: string; designation?: string | null; department?: string | null };
  }[];
  currentStepId: string | null;
  status: string;
}

export interface WizardCapabilities {
  canReview: boolean;
  canLock: boolean;
}

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function ManhoursWizard({
  initialSubmission,
  departments,
  contractors,
  workflow,
  capabilities
}: {
  initialSubmission: WizardSubmission;
  departments: DepartmentOption[];
  contractors: ContractorOption[];
  workflow: WorkflowSnapshot | null;
  capabilities: WizardCapabilities;
}) {
  const router = useRouter();
  const [submission, setSubmission] = useState<WizardSubmission>(initialSubmission);
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [pending, startTransition] = useTransition();

  const isReadOnly = submission.status !== "DRAFT" && submission.status !== "UNLOCKED_FOR_REVISION";

  function refresh(next: WizardSubmission) {
    setSubmission(next);
    // Workflow snapshot is server-rendered — after a state transition
    // we trigger a router refresh so the tracker reflects the new
    // step/history/task without a manual round-trip.
    router.refresh();
  }

  function goTo(step: StepNumber) {
    setCurrentStep(step);
    // smooth scroll up so the new step's content is visible
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-4">
      <Header submission={submission} isReadOnly={isReadOnly} />

      {/* Status-aware action panel — Plant Head review, Corporate
          lock/unlock/relock affordances render here based on
          submission.status + the user's capability flags. */}
      <ManhoursActionPanel submission={submission} flags={capabilities} onUpdated={refresh} />

      {/* Immutable KPI tile grid — only renders for LOCKED rows
          where a snapshot exists. Tiles deep-link to the drill-down
          page with preferSnapshot=true so historical numbers stay
          frozen. */}
      {(submission.status === "LOCKED" || submission.status === "UNLOCKED_FOR_REVISION") && (
        <LockedKpiPanel submission={submission} />
      )}

      {workflow && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Workflow
            </div>
            <WorkflowTracker
              steps={workflow.steps}
              history={workflow.history}
              pendingTasks={workflow.pendingTasks}
              currentStepId={workflow.currentStepId}
              status={workflow.status}
            />
          </CardContent>
        </Card>
      )}

      <Stepper
        currentStep={currentStep}
        onJump={goTo}
        // Don't gate jumps in this commit — HSE Manager often hops
        // around to fix earlier steps after seeing Step 8 issues.
        // Workflow + lock checks live on the server.
      />

      <Card>
        <CardContent className="p-6">
          {currentStep === 1 && (
            <StepPeriod
              submission={submission}
              onSaved={refresh}
              isReadOnly={isReadOnly}
            />
          )}
          {currentStep === 2 && (
            <StepCategories
              submission={submission}
              kind="PERMANENT"
              departments={departments}
              contractors={contractors}
              onSaved={refresh}
              isReadOnly={isReadOnly}
            />
          )}
          {currentStep === 3 && (
            <StepCategories
              submission={submission}
              kind="CONTRACT"
              departments={departments}
              contractors={contractors}
              onSaved={refresh}
              isReadOnly={isReadOnly}
            />
          )}
          {currentStep === 4 && (
            <StepCategories
              submission={submission}
              kind="TRAINEE"
              departments={departments}
              contractors={contractors}
              onSaved={refresh}
              isReadOnly={isReadOnly}
            />
          )}
          {currentStep === 5 && (
            <StepVisitors submission={submission} onSaved={refresh} isReadOnly={isReadOnly} />
          )}
          {currentStep === 6 && (
            <StepDeductions submission={submission} onSaved={refresh} isReadOnly={isReadOnly} />
          )}
          {currentStep === 7 && (
            <StepAttachments submission={submission} isReadOnly={isReadOnly} />
          )}
          {currentStep === 8 && (
            <StepValidate
              submission={submission}
              onSaved={refresh}
              onSubmitted={() => {
                // After SUBMITTED transition, kick the user back to
                // the detail page where the workflow tracker lives.
                startTransition(() => {
                  router.push(
                    `/manhours/${submission.plantId}/${submission.reportingYear}/${submission.reportingMonth}`
                  );
                  router.refresh();
                });
              }}
              isReadOnly={isReadOnly}
            />
          )}
        </CardContent>
      </Card>

      <NavFooter
        currentStep={currentStep}
        onBack={() => goTo((currentStep - 1) as StepNumber)}
        onNext={() => goTo((currentStep + 1) as StepNumber)}
        pending={pending}
      />
    </div>
  );
}

// ── Header summarising the submission state + roll-up totals ─────

function Header({
  submission,
  isReadOnly
}: {
  submission: WizardSubmission;
  isReadOnly: boolean;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            {submission.plant.name} · {submission.plant.code}
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {MONTHS[submission.reportingMonth]} {submission.reportingYear}
          </h1>
          {submission.submissionNumber && (
            <div className="font-mono text-xs text-slate-500 mt-1">{submission.submissionNumber}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={submission.status} />
          {isReadOnly && (
            <Badge className="bg-slate-700 text-white">
              <Lock size={12} /> Read-only
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Roll label="Total hours" value={formatNumber(submission.totalManhoursAll)} hint="all categories" />
        <Roll
          label="Net exposure"
          value={formatNumber(submission.netExposureHours)}
          hint="after deductions"
          tone="primary"
        />
        <Roll
          label="Permanent strength"
          value={String(submission.totalEmployeeStrength)}
          hint="end of period"
        />
        <Roll
          label="Contract strength"
          value={String(submission.totalContractorStrength)}
          hint="end of period"
        />
      </div>
    </div>
  );
}

function Roll({
  label,
  value,
  hint,
  tone
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "primary";
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={cn("text-xl font-bold tabular-nums", tone === "primary" ? "text-primary-800" : "text-slate-900")}>
        {value}
      </div>
      <div className="text-[10px] text-slate-500">{hint}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-amber-100 text-amber-800 border-amber-200",
    SUBMITTED: "bg-blue-100 text-blue-800 border-blue-200",
    UNDER_REVIEW: "bg-blue-100 text-blue-800 border-blue-200",
    APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
    LOCKED: "bg-slate-700 text-white border-slate-700",
    UNLOCKED_FOR_REVISION: "bg-rose-100 text-rose-800 border-rose-200"
  };
  return <Badge className={map[status] ?? "bg-slate-100 text-slate-700"}>{status.replace(/_/g, " ")}</Badge>;
}

// ── Horizontal step indicator ────────────────────────────────────

function Stepper({
  currentStep,
  onJump
}: {
  currentStep: StepNumber;
  onJump: (n: StepNumber) => void;
}) {
  return (
    <div className="rounded-lg border bg-white p-3 overflow-x-auto">
      <ol className="flex items-center gap-1 min-w-max">
        {STEPS.map((s, i) => {
          const isCurrent = s.n === currentStep;
          const isPast = s.n < currentStep;
          return (
            <li key={s.n} className="flex items-center">
              <button
                type="button"
                onClick={() => onJump(s.n)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition",
                  isCurrent && "bg-primary-700 text-white",
                  !isCurrent && isPast && "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                  !isCurrent && !isPast && "bg-slate-50 text-slate-600 hover:bg-slate-100"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                    isCurrent && "bg-white text-primary-700",
                    !isCurrent && isPast && "bg-emerald-100 text-emerald-700",
                    !isCurrent && !isPast && "bg-white text-slate-500 border border-slate-300"
                  )}
                >
                  {isPast ? <Check size={10} /> : s.n}
                </span>
                <span>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <span className="mx-1 text-slate-300">›</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function NavFooter({
  currentStep,
  onBack,
  onNext,
  pending
}: {
  currentStep: StepNumber;
  onBack: () => void;
  onNext: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-white p-3">
      <Button variant="outline" disabled={currentStep === 1 || pending} onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </Button>
      <div className="text-xs text-slate-500">
        Step {currentStep} of {STEPS.length}
      </div>
      <Button disabled={currentStep === STEPS.length || pending} onClick={onNext}>
        Next <ChevronRight size={16} />
      </Button>
    </div>
  );
}
