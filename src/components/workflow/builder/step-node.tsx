"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  User, ShieldCheck, Hammer, Eye, CheckCircle2, Clock, GitBranch, Users,
  Trash2, Zap, ArrowUp, ArrowDown, Copy, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditorStep, StepType } from "./types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type StepNodeData = {
  step: EditorStep;
  selected: boolean;
  isFirst: boolean;
  isLast: boolean;
  highlight: "idle" | "running" | "done" | "skipped" | "blocked";
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

const STEP_META: Record<StepType, { icon: any; label: string; accent: string; ring: string; iconBg: string }> = {
  MAKER: {
    icon: User, label: "Maker",
    accent: "border-slate-300", ring: "ring-slate-200",
    iconBg: "bg-slate-100 text-slate-600"
  },
  CHECKER: {
    icon: ShieldCheck, label: "Checker",
    accent: "border-blue-300", ring: "ring-blue-200",
    iconBg: "bg-blue-100 text-blue-600"
  },
  ASSIGNEE_TASK: {
    icon: Hammer, label: "Assignee Task",
    accent: "border-violet-300", ring: "ring-violet-200",
    iconBg: "bg-violet-100 text-violet-600"
  },
  VERIFIER: {
    icon: Eye, label: "Verifier",
    accent: "border-amber-300", ring: "ring-amber-200",
    iconBg: "bg-amber-100 text-amber-600"
  },
  CLOSURE: {
    icon: CheckCircle2, label: "Closure",
    accent: "border-emerald-300", ring: "ring-emerald-200",
    iconBg: "bg-emerald-100 text-emerald-600"
  }
};

function humanSla(h: number | null) {
  if (!h) return null;
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.round((h / 24) * 10) / 10;
  return `${d} day${d === 1 ? "" : "s"}`;
}

const ROLE_LABEL: Record<string, string> = {
  HSE_MANAGER: "HSE Manager",
  PLANT_HEAD: "Plant Head",
  ADMIN: "Admin",
  WORKER: "Worker"
};

const FIELD_LABEL: Record<string, string> = {
  ORIGINATOR: "Originator",
  ACTION_OWNER: "Action Owner",
  RESPONSIBLE_PERSON: "Responsible Person",
  ASSIGNED_INSPECTOR: "Assigned Inspector",
  RECEIVER: "Receiver",
  ISSUER: "Issuer",
  TRAINER: "Trainer",
  AREA_OWNER: "Area Owner"
};

function humanAssignee(step: EditorStep): string {
  if (step.approverUserId) return step.approverUserName ? `👤 ${step.approverUserName}` : "Specific user";
  if (step.approverGroupRoles && step.approverGroupRoles.length > 0) {
    const labels = step.approverGroupRoles.map((r) => ROLE_LABEL[r] ?? r);
    return `Group: ${labels.join(" / ")}`;
  }
  if (step.approverField) return `${FIELD_LABEL[step.approverField] ?? step.approverField} (from record)`;
  if (step.approverRole) return ROLE_LABEL[step.approverRole] ?? step.approverRole;
  return "Unassigned";
}

const COND_OP_LABEL: Record<string, string> = {
  "=": "=",
  "!=": "≠",
  in: "in",
  not_in: "∉",
  contains: "contains",
  ">": ">",
  "<": "<",
  ">=": "≥",
  "<=": "≤"
};

function parseConditionForDisplay(expr: string | null): string | null {
  if (!expr) return null;
  try {
    const obj = JSON.parse(expr);
    if (obj && obj.version === 2 && Array.isArray(obj.rules)) {
      const parts = obj.rules.map((r: any) => {
        const v = Array.isArray(r.value) ? r.value.join(" / ") : String(r.value);
        return `${r.field} ${COND_OP_LABEL[r.operator] ?? r.operator} ${v}`;
      });
      return parts.join(obj.combinator === "OR" ? " OR " : " AND ");
    }
    const parts: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) parts.push(`${k} = ${v.join(" / ")}`);
      else parts.push(`${k} = ${v}`);
    }
    return parts.join(" AND ");
  } catch {
    return null;
  }
}

function StepNodeImpl({ data }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const { step, selected, isFirst, isLast, highlight, onSelect, onDelete, onDuplicate, onMoveUp, onMoveDown } = d;
  const meta = STEP_META[step.stepType];
  const Icon = meta.icon;
  const sla = humanSla(step.slaHours);
  const assigneeText = humanAssignee(step);
  const condition = parseConditionForDisplay(step.conditionExpr);

  return (
    <div
      className="group relative"
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-300 !w-2 !h-2 !border-0" />

      {/* Hover toolbar (top-right) */}
      <div className="absolute -top-3 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {!isFirst && (
          <Button variant="outline"
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            title="Move up" className="w-6 h-6 rounded-md shadow-sm flex">
            <ArrowUp size={12} />
          </Button>
        )}
        {!isLast && (
          <Button variant="outline"
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            title="Move down" className="w-6 h-6 rounded-md shadow-sm flex">
            <ArrowDown size={12} />
          </Button>
        )}
        {step.stepType !== "MAKER" && (
          <Button variant="outline"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            title="Duplicate step" className="w-6 h-6 rounded-md shadow-sm flex">
            <Copy size={12} />
          </Button>
        )}
        {step.stepType !== "MAKER" && (
          <Button variant="outline"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete step" className="w-6 h-6 rounded-md shadow-sm flex">
            <Trash2 size={12} />
          </Button>
        )}
      </div>

      {/* Card */}
      <div
        className={cn(
          "w-72 rounded-xl bg-white border-2 transition-all cursor-pointer shadow-sm",
          meta.accent,
          selected && "ring-4 " + meta.ring + " border-primary-500 shadow-md",
          highlight === "running" && "ring-4 ring-primary-300 border-primary-500 animate-pulse",
          highlight === "done" && "border-emerald-400 bg-emerald-50/30",
          highlight === "skipped" && "opacity-50 border-slate-300 bg-slate-50",
          highlight === "blocked" && "border-rose-400 bg-rose-50/30"
        )}
      >
        <div className="px-4 py-3 flex items-start gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", meta.iconBg)}>
            <Icon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                {meta.label}
              </span>
              <span className="text-[10px] text-slate-400">·</span>
              <span className="text-[10px] text-slate-500 font-mono">#{step.sequence}</span>
              {step.isOptional && (
                <span className="text-[9px] uppercase font-semibold tracking-wider text-slate-400 ml-1">Optional</span>
              )}
            </div>
            <div className="text-sm font-semibold text-slate-900 leading-snug mt-0.5 truncate" title={step.name}>
              {step.name}
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Users size={11} className="text-slate-400 flex-shrink-0" />
                <span className="truncate" title={assigneeText}>{assigneeText}</span>
              </div>
              {sla && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Clock size={11} className="text-slate-400 flex-shrink-0" />
                  <span>SLA · {sla}</span>
                  {step.escalationRole && (
                    <span className="text-[10px] text-amber-700 ml-1">↗ escalates</span>
                  )}
                </div>
              )}
              {condition && (
                <div className="flex items-start gap-1.5 text-xs">
                  <GitBranch size={11} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-amber-700 leading-snug">If {condition}</span>
                </div>
              )}
              {step.notes && step.notes.trim() && (
                <div className="flex items-start gap-1.5 text-xs">
                  <MessageSquare size={11} className="text-slate-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-500 leading-snug truncate" title={step.notes}>Notes attached</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-300 !w-2 !h-2 !border-0" />
    </div>
  );
}

export const StepNode = memo(StepNodeImpl);

// ───────────────────────────────────────────────────────────────────────
// "Add step" inserter node — renders as a thin button that lives between
// each pair of step nodes. Handles let edges connect cleanly.
// ───────────────────────────────────────────────────────────────────────

type InserterData = { onClick: () => void };

function InserterNodeImpl({ data }: NodeProps) {
  const { onClick } = data as unknown as InserterData;
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-1 !h-1" />
      <Button variant="default"
        onClick={onClick} className="w-7 h-7 rounded-full border-2 border-dashed hover:scale-110 transition-all flex shadow-sm"
        title="Insert step here">
        <span className="text-base font-semibold leading-none">+</span>
      </Button>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-1 !h-1" />
    </div>
  );
}

export const InserterNode = memo(InserterNodeImpl);

// Top-of-canvas trigger node (read-only label, mimics the screenshot's
// "Order fulfilled" event entry).
type TriggerData = { module: string; recordType: string | null };

function TriggerNodeImpl({ data }: NodeProps) {
  const { module, recordType } = data as unknown as TriggerData;
  return (
    <div className="relative">
      <Card className="w-72 rounded-xl bg-white border border-slate-200 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <Zap size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Trigger</div>
            <div className="text-sm font-semibold text-slate-900 leading-snug">
              When a {prettyModule(module)} is created
            </div>
            <div className="text-[11px] text-slate-500">
              {recordType ? `Sub-type: ${recordType.replace(/_/g, " ")}` : "Applies to all sub-types"}
            </div>
          </div>
        </div>
      </Card>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-300 !w-2 !h-2 !border-0" />
    </div>
  );
}

function prettyModule(m: string) {
  const map: Record<string, string> = {
    OBSERVATION: "Safety Observation",
    NEAR_MISS: "Near Miss",
    PTW: "Permit",
    INCIDENT: "Incident",
    TRAINING: "Training Session",
    INSPECTION: "Inspection",
    MANHOURS: "Manhours entry"
  };
  return map[m] ?? m.toLowerCase();
}

export const TriggerNode = memo(TriggerNodeImpl);
