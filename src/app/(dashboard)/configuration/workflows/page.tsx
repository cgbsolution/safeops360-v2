import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Workflow, ChevronRight, Eye, AlertTriangle, FileCheck, ShieldAlert, GraduationCap, ClipboardCheck, Clock } from "lucide-react";
import { cn, humanize } from "@/lib/utils";
import { NewWorkflowButton } from "./new-button";

export const dynamic = "force-dynamic";

const MODULE_META: Record<string, { label: string; icon: any; color: string }> = {
  OBSERVATION: { label: "Safety Observation", icon: Eye, color: "bg-blue-50 text-blue-700 border-blue-200" },
  NEAR_MISS: { label: "Near Miss", icon: AlertTriangle, color: "bg-amber-50 text-amber-700 border-amber-200" },
  PTW: { label: "Permit to Work", icon: FileCheck, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  INCIDENT: { label: "Incident Investigation", icon: ShieldAlert, color: "bg-rose-50 text-rose-700 border-rose-200" },
  TRAINING: { label: "Training", icon: GraduationCap, color: "bg-violet-50 text-violet-700 border-violet-200" },
  INSPECTION: { label: "Inspection", icon: ClipboardCheck, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  MANHOURS: { label: "Manhours & KPIs", icon: Clock, color: "bg-slate-50 text-slate-700 border-slate-200" }
};

const STEP_TYPE_COLORS: Record<string, string> = {
  MAKER: "bg-slate-100 text-slate-700",
  CHECKER: "bg-blue-100 text-blue-700",
  ASSIGNEE_TASK: "bg-violet-100 text-violet-700",
  VERIFIER: "bg-amber-100 text-amber-700",
  CLOSURE: "bg-emerald-100 text-emerald-700"
};

export default async function WorkflowsListPage() {
  await requirePermission("CONFIGURATION.WORKFLOWS");

  const definitions = await prisma.workflowDefinition.findMany({
    include: {
      steps: { orderBy: { sequence: "asc" } },
      _count: { select: { instances: true } }
    },
    orderBy: [{ module: "asc" }, { recordType: "asc" }]
  });

  const grouped = definitions.reduce<Record<string, typeof definitions>>((acc, d) => {
    (acc[d.module] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Workflows"
        description="Visual editor for the approval, execution & verification chain behind every module. Drag, drop, save."
        breadcrumbs={[
          { label: "Configuration" },
          { label: "Workflows" }
        ]}
        action={<NewWorkflowButton />}
      />

      <div className="space-y-6">
        {Object.entries(grouped).map(([module, defs]) => {
          const meta = MODULE_META[module] ?? { label: humanize(module), icon: Workflow, color: "bg-slate-50 text-slate-700 border-slate-200" };
          const Icon = meta.icon;
          return (
            <div key={module}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center", meta.color)}>
                  <Icon size={16} />
                </div>
                <h2 className="text-base font-semibold text-slate-900">{meta.label}</h2>
                <span className="text-xs text-slate-500">({defs.length} workflow{defs.length === 1 ? "" : "s"})</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {defs.map((def) => (
                  <Link
                    key={def.id}
                    href={`/configuration/workflows/${def.id}`}
                    className="group block"
                  >
                    <Card className="h-full transition-all hover:shadow-md hover:border-primary-300">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {def.recordType && (
                                <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                                  {humanize(def.recordType)}
                                </Badge>
                              )}
                              <Badge
                                className={cn(
                                  "text-[10px] border",
                                  def.isActive
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-slate-100 text-slate-500 border-slate-200"
                                )}
                              >
                                {def.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="font-semibold text-slate-900 leading-tight">{def.name}</div>
                            {def.description && (
                              <div className="text-xs text-slate-500 mt-1 line-clamp-2">{def.description}</div>
                            )}
                          </div>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                        </div>

                        {/* Step ribbon */}
                        <div className="mt-3 flex items-center gap-1 flex-wrap">
                          {def.steps.map((s, i) => (
                            <span key={s.id} className="flex items-center gap-1">
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", STEP_TYPE_COLORS[s.stepType] ?? "bg-slate-100 text-slate-700")}>
                                {s.stepType.replace("_TASK", "").replace("_", " ")}
                              </span>
                              {i < def.steps.length - 1 && <span className="text-slate-300 text-[10px]">→</span>}
                            </span>
                          ))}
                        </div>

                        <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-slate-500">
                          <span>{def.steps.length} step{def.steps.length === 1 ? "" : "s"}</span>
                          <span>{def._count.instances} run{def._count.instances === 1 ? "" : "s"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        {definitions.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Workflow size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No workflows configured yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
