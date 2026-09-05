"use client";

import { useState } from "react";
import { X, Play, Loader2, Sparkles, CheckCircle2, AlertCircle, SkipForward, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, cn } from "@/lib/utils";
import type { EditorStep } from "./types";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

type SimAssignee = { id: string; name: string; designation: string | null; plant?: string | null };
type SimStepResult = {
  sequence: number;
  stepType: string;
  name: string;
  status: "AUTO" | "EXECUTED" | "SKIPPED" | "BLOCKED";
  reason: string | null;
  conditionExpr: string | null;
  dueAt: string | null;
  assignee: SimAssignee | null;
};
type SimResponse = {
  sample: { id: string; number: string; title: string; plantId: string | null };
  trace: SimStepResult[];
  errors: { sequence: number; message: string }[];
};

const STATUS_META: Record<string, { label: string; icon: any; cls: string }> = {
  AUTO: { label: "Auto", icon: CheckCircle2, cls: "text-slate-600 bg-slate-100 border-slate-200" },
  EXECUTED: { label: "Routed", icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  SKIPPED: { label: "Skipped", icon: SkipForward, cls: "text-slate-500 bg-slate-50 border-slate-200" },
  BLOCKED: { label: "Blocked", icon: AlertCircle, cls: "text-rose-700 bg-rose-50 border-rose-200" }
};

export function TestRunPanel({
  definitionId,
  open,
  draftSteps,
  onClose,
  onStepHover
}: {
  definitionId: string;
  open: boolean;
  draftSteps: EditorStep[];
  onClose: () => void;
  onStepHover?: (sequence: number | null) => void;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sampleRecordId, setSampleRecordId] = useState("");

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const body: any = {
        draftSteps: draftSteps.map((s) => ({
          sequence: s.sequence,
          stepType: s.stepType,
          name: s.name,
          approverRole: s.approverRole,
          approverField: s.approverField,
          approverUserId: s.approverUserId,
          approverGroupRoles: s.approverGroupRoles ? JSON.stringify(s.approverGroupRoles) : null,
          slaHours: s.slaHours,
          conditionExpr: s.conditionExpr
        }))
      };
      if (sampleRecordId.trim()) body.sampleRecordId = sampleRecordId.trim();
      const r = await fetch(`/api/workflow/definitions/${definitionId}/test-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "Test run failed");
        return;
      }
      setResult(j);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setRunning(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-screen w-[460px] bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary-600" />
            <div>
              <div className="text-sm font-semibold text-slate-900">Test run</div>
              <div className="text-[11px] text-slate-500">Simulates the workflow against a real sample record. No data is modified.</div>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" title="Close" className="h-auto w-auto p-0 text-slate-400 hover:bg-transparent hover:text-slate-600" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="px-5 py-4 border-b space-y-2 bg-slate-50">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Sample record (optional)</Label>
          <Input
            value={sampleRecordId}
            onChange={(e) => setSampleRecordId(e.target.value)}
            placeholder="Leave blank to use the most recent record"
            className="h-9 text-xs"
          />
          <Button onClick={run} size="sm" disabled={running} className="w-full">
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {running ? "Simulating…" : "Run simulation"}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <Alert variant="destructive" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3 flex items-start gap-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </Alert>
          )}

          {result && (
            <>
              <Card className="rounded-md border border-slate-200 bg-white p-3 shadow-none">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Sample record</div>
                <div className="font-mono text-xs text-slate-700 mt-0.5">{result.sample.number}</div>
                <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{result.sample.title}</div>
              </Card>

              {result.errors.length > 0 && (
                <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 p-3 space-y-1">
                  <div className="text-xs font-semibold text-rose-800 flex items-center gap-1">
                    <AlertCircle size={12} /> {result.errors.length} issue{result.errors.length === 1 ? "" : "s"} found
                  </div>
                  <ul className="text-xs text-rose-700 list-disc pl-4">
                    {result.errors.map((e, i) => (
                      <li key={i}>Step {e.sequence}: {e.message}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              <ol className="space-y-2">
                {result.trace.map((s) => {
                  const m = STATUS_META[s.status] ?? STATUS_META.AUTO;
                  const Icon = m.icon;
                  return (
                    <li
                      key={s.sequence}
                      onMouseEnter={() => onStepHover?.(s.sequence)}
                      onMouseLeave={() => onStepHover?.(null)}
                      className={cn("rounded-md border p-3 transition", m.cls)}
                    >
                      <div className="flex items-start gap-2">
                        <Icon size={14} className="flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-slate-500">#{s.sequence}</span>
                            <span className="text-sm font-semibold text-slate-900 truncate">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-600 mt-0.5">
                            <Badge className="bg-white border border-slate-200 text-slate-700 text-[10px]">{s.stepType.replace("_TASK", "")}</Badge>
                            <Badge className={cn("text-[10px] border", m.cls)}>{m.label}</Badge>
                          </div>
                          {s.assignee && (
                            <div className="text-xs text-slate-700 mt-1.5">
                              👤 <span className="font-medium">{s.assignee.name}</span>
                              {s.assignee.designation && <span className="text-slate-500"> — {s.assignee.designation}</span>}
                              {s.assignee.plant && <span className="text-slate-500"> · {s.assignee.plant}</span>}
                            </div>
                          )}
                          {s.dueAt && (
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                              <Clock size={10} /> Due {formatDateTime(s.dueAt)}
                            </div>
                          )}
                          {s.reason && (
                            <p className="text-[11px] text-slate-600 mt-1 leading-snug">{s.reason}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}

          {!result && !running && !error && (
            <div className="text-center py-12 text-sm text-slate-500">
              <Sparkles size={24} className="mx-auto text-slate-300 mb-2" />
              <p>Click Run simulation to test the workflow.</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
