// Configuration → AI Agents → [code]
//
// Three sections:
//   1. Operations metrics (last 30 days) + cost summary
//   2. Configuration form (authority, rate limit, model, active flag)
//   3. Prompt versions (read-only list; click for full body)
//   4. Recent invocations drilldown (last 20)
//
// Permission gate: AGENT.RCA_INVOKE for read. The interactive config
// form re-checks AGENT.RCA_CONFIGURE on submit (server-side via the
// PATCH endpoint).

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { backendFetch } from "@/lib/backend";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  History,
  Activity,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Edit3
} from "lucide-react";
import { cn } from "@/lib/utils";

import { AgentConfigForm } from "./agent-config-form";
import { CalibrationButton } from "./calibration-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

type Agent = {
  id: string;
  code: string;
  name: string;
  description: string;
  module: string;
  capabilities: Record<string, string>;
  primaryModelId: string;
  escalationModelId: string | null;
  activePromptId: string | null;
  currentAuthorityLevel: string;
  maxAuthorityLevel: string;
  authorityRationale: string | null;
  availableTools: string[];
  estimatedTokensPerInvocation: number;
  estimatedCostPerInvocation: number;
  isActive: boolean;
  isInPilot: boolean;
  rateLimit: number;
  totalInvocations: number;
  totalAcceptances: number;
  totalModifications: number;
  totalRejections: number;
  averageLatencyMs: number | null;
  averageCostUsd: number | null;
  calibrationScore: number | null;
  lastCalibrationAt: string | null;
};

type Metrics = {
  agentCode: string;
  windowDays: number;
  totalInvocations: number;
  decidedInvocations: number;
  accepted: number;
  modified: number;
  rejected: number;
  errored: number;
  hallucinationFlagged: number;
  averageRating: number | null;
  averageLatencyMs: number | null;
  averageCostUsd: number | null;
  totalCostUsd: number;
  daily: {
    date: string;
    invocations: number;
    accepted: number;
    modified: number;
    rejected: number;
    errored: number;
    totalCostUsd: number;
  }[];
};

type PromptRow = {
  id: string;
  version: number;
  promptDescription: string;
  variantLabel: string | null;
  invocationCount: number;
  acceptanceRate: number | null;
  modificationRate: number | null;
  rejectionRate: number | null;
  approvedAt: string | null;
  createdAt: string;
  isActive: boolean;
};

type InvocationRow = {
  id: string;
  invocationNumber: string;
  invokedAt: string;
  sourceModule: string;
  sourceRecordId: string;
  status: string;
  humanDecision: string | null;
  ratingByHuman: number | null;
  totalCostUsd: number | null;
  latencyMs: number | null;
  hallucinationFlagged: boolean;
  hadError: boolean;
};

export default async function AgentDetailPage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;

  // Read-only views of agent config + metrics are open to any logged-in
  // user. Mutations (PATCH, calibration trigger) still require
  // AGENT.RCA_CONFIGURE — gated below + re-checked server-side.
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = (session?.user as any)?.id ?? "";
  const [configCheck, auditCheck] = await Promise.all([
    can(userId, "AGENT.RCA_CONFIGURE", {}),
    can(userId, "AGENT.AUDIT_VIEW", {})
  ]);
  const canConfigure = configCheck.allowed;
  const canViewAudit = auditCheck.allowed;

  // Parallel fetches — failures are non-fatal for the read path; the
  // page still renders with whatever loaded successfully.
  const [agent, metrics, prompts, invocations] = await Promise.all([
    backendFetch<Agent>(`/api/agents/${code}`).catch(() => null),
    backendFetch<Metrics>(`/api/agents/${code}/metrics?days=30`).catch(() => null),
    backendFetch<PromptRow[]>(`/api/agents/${code}/prompts`).catch(() => []),
    canViewAudit
      ? backendFetch<{ items: InvocationRow[]; total: number }>(
          `/api/agents/${code}/invocations?limit=20`
        ).catch(() => ({ items: [], total: 0 }))
      : Promise.resolve(null)
  ]);

  if (!agent) return notFound();

  return (
    <div>
      <PageHeader
        title={agent.name}
        description={agent.description}
        breadcrumbs={[
          { label: "AI Assistance" },
          { label: "AI Agents", href: "/configuration/agents" },
          { label: agent.code }
        ]}
        action={
          canConfigure ? (
            <CalibrationButton agentCode={agent.code} />
          ) : undefined
        }
      />

      <div className="space-y-6">
        {/* ── Metrics ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <Activity size={14} /> Operations — last 30 days
          </h2>
          {metrics ? (
            <MetricsGrid metrics={metrics} />
          ) : (
            <div className="text-xs text-slate-500">Metrics unavailable.</div>
          )}
        </section>

        {/* ── Config form ─────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <Edit3 size={14} /> Configuration
          </h2>
          <AgentConfigForm
            agent={{
              code: agent.code,
              currentAuthorityLevel: agent.currentAuthorityLevel,
              maxAuthorityLevel: agent.maxAuthorityLevel,
              authorityRationale: agent.authorityRationale,
              rateLimit: agent.rateLimit,
              isActive: agent.isActive,
              isInPilot: agent.isInPilot,
              primaryModelId: agent.primaryModelId,
              escalationModelId: agent.escalationModelId,
              availableTools: agent.availableTools,
              module: agent.module
            }}
            canEdit={canConfigure}
          />
        </section>

        {/* ── Prompt versions ─────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <History size={14} /> Prompt versions
          </h2>
          <PromptList prompts={prompts ?? []} />
        </section>

        {/* ── Invocation drilldown (audit-gated) ──────────────── */}
        {canViewAudit && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Sparkles size={14} /> Recent invocations
              <span className="text-xs text-slate-500 font-normal">
                {invocations?.total ?? 0} total
              </span>
            </h2>
            <InvocationsTable items={invocations?.items ?? []} />
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function MetricsGrid({ metrics }: { metrics: Metrics }) {
  const accRate =
    metrics.decidedInvocations > 0
      ? metrics.accepted / metrics.decidedInvocations
      : null;
  const modRate =
    metrics.decidedInvocations > 0
      ? metrics.modified / metrics.decidedInvocations
      : null;
  const rejRate =
    metrics.decidedInvocations > 0
      ? metrics.rejected / metrics.decidedInvocations
      : null;
  const errRate =
    metrics.totalInvocations > 0
      ? metrics.errored / metrics.totalInvocations
      : null;
  const halluRate =
    metrics.totalInvocations > 0
      ? metrics.hallucinationFlagged / metrics.totalInvocations
      : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
      <Metric label="Invocations" value={metrics.totalInvocations.toLocaleString()} />
      <Metric
        label="Acceptance"
        value={pct(accRate)}
        hint={`${metrics.accepted}/${metrics.decidedInvocations}`}
        tone={accRate != null && accRate >= 0.5 ? "good" : "neutral"}
      />
      <Metric
        label="Modification"
        value={pct(modRate)}
        hint={`${metrics.modified}/${metrics.decidedInvocations}`}
      />
      <Metric
        label="Rejection"
        value={pct(rejRate)}
        hint={`${metrics.rejected}/${metrics.decidedInvocations}`}
        tone={rejRate != null && rejRate > 0.2 ? "bad" : "neutral"}
      />
      <Metric
        label="Avg rating"
        value={
          metrics.averageRating != null
            ? `${metrics.averageRating.toFixed(1)} / 5`
            : "—"
        }
      />
      <Metric
        label="Avg latency"
        value={
          metrics.averageLatencyMs != null
            ? `${(metrics.averageLatencyMs / 1000).toFixed(1)}s`
            : "—"
        }
      />
      <Metric
        label="Avg cost"
        value={
          metrics.averageCostUsd != null
            ? `$${metrics.averageCostUsd.toFixed(4)}`
            : "—"
        }
      />
      <Metric
        label="Total cost"
        value={`$${metrics.totalCostUsd.toFixed(2)}`}
      />
      <Metric
        label="Errors"
        value={metrics.errored.toString()}
        hint={errRate != null ? pct(errRate) : undefined}
        tone={errRate != null && errRate > 0.05 ? "bad" : "neutral"}
      />
      <Metric
        label="Hallucinations"
        value={metrics.hallucinationFlagged.toString()}
        hint={halluRate != null ? pct(halluRate) : undefined}
        tone={
          metrics.hallucinationFlagged > 0 ? "bad" : "neutral"
        }
      />
    </div>
  );
}

function PromptList({ prompts }: { prompts: PromptRow[] }) {
  if (prompts.length === 0) {
    return (
      <Card className="text-xs text-slate-500 p-3 border border-dashed border-slate-200 rounded shadow-none">
        No prompt versions seeded yet.
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {prompts.map((p) => (
        <Card key={p.id} className={cn(p.isActive && "border-violet-300")}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold">v{p.version}</span>
              {p.isActive && (
                <Badge className="bg-violet-100 text-violet-900 border-violet-300 text-[10px]">
                  ACTIVE
                </Badge>
              )}
              {p.variantLabel && (
                <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px]">
                  {p.variantLabel}
                </Badge>
              )}
              <span className="text-xs text-slate-500 ml-auto">
                {new Date(p.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">{p.promptDescription}</p>
            {p.invocationCount > 0 && (
              <div className="text-[11px] text-slate-500 mt-2 flex gap-3">
                <span>{p.invocationCount} invocations</span>
                {p.acceptanceRate != null && (
                  <span>acceptance: {Math.round(p.acceptanceRate * 100)}%</span>
                )}
                {p.modificationRate != null && (
                  <span>modified: {Math.round(p.modificationRate * 100)}%</span>
                )}
                {p.rejectionRate != null && (
                  <span
                    className={cn(
                      p.rejectionRate > 0.4 && "text-rose-700 font-medium"
                    )}
                  >
                    rejected: {Math.round(p.rejectionRate * 100)}%
                    {p.rejectionRate > 0.4 && " — review"}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InvocationsTable({ items }: { items: InvocationRow[] }) {
  if (items.length === 0) {
    return (
      <Card className="text-xs text-slate-500 p-3 border border-dashed border-slate-200 rounded shadow-none">
        No invocations yet.
      </Card>
    );
  }
  return (
    <Card className="border border-slate-200 rounded-md bg-white overflow-x-auto shadow-none">
      <Table className="w-full text-xs">
        <TableHeader className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
          <TableRow>
            <TableHead className="px-3 py-2">Invocation</TableHead>
            <TableHead className="px-3 py-2">At</TableHead>
            <TableHead className="px-3 py-2">Source</TableHead>
            <TableHead className="px-3 py-2">Status</TableHead>
            <TableHead className="px-3 py-2">Decision</TableHead>
            <TableHead className="px-3 py-2 text-right">Cost</TableHead>
            <TableHead className="px-3 py-2 text-right">Latency</TableHead>
            <TableHead className="px-3 py-2">Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
              <TableCell className="px-3 py-2 font-mono text-[11px]">{row.invocationNumber}</TableCell>
              <TableCell className="px-3 py-2 text-slate-500">
                {new Date(row.invokedAt).toLocaleString()}
              </TableCell>
              <TableCell className="px-3 py-2">
                <span className="text-slate-500">{row.sourceModule}</span>
                <Link
                  href={`/incidents/${row.sourceRecordId}`}
                  className="text-violet-700 hover:underline ml-1"
                  title={row.sourceRecordId}
                >
                  →
                </Link>
              </TableCell>
              <TableCell className="px-3 py-2">
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="px-3 py-2 text-slate-600">
                {row.humanDecision ?? "—"}
                {row.ratingByHuman != null && (
                  <span className="ml-1 text-[10px] text-amber-600">
                    {row.ratingByHuman}/5
                  </span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2 text-right text-slate-600">
                {row.totalCostUsd != null
                  ? `$${row.totalCostUsd.toFixed(4)}`
                  : "—"}
              </TableCell>
              <TableCell className="px-3 py-2 text-right text-slate-600">
                {row.latencyMs != null
                  ? `${(row.latencyMs / 1000).toFixed(1)}s`
                  : "—"}
              </TableCell>
              <TableCell className="px-3 py-2">
                <span className="flex items-center gap-1">
                  {row.hallucinationFlagged && (
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px]">
                      hallu
                    </Badge>
                  )}
                  {row.hadError && (
                    <Badge className="bg-rose-100 text-rose-900 border-rose-300 text-[9px]">
                      err
                    </Badge>
                  )}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { cls: string; icon?: any }> = {
    RUNNING: { cls: "bg-amber-100 text-amber-900 border-amber-300" },
    PENDING_REVIEW: { cls: "bg-blue-100 text-blue-900 border-blue-300" },
    ACCEPTED: { cls: "bg-emerald-100 text-emerald-900 border-emerald-300", icon: CheckCircle2 },
    MODIFIED: { cls: "bg-blue-100 text-blue-900 border-blue-300", icon: Edit3 },
    REJECTED: { cls: "bg-slate-100 text-slate-700 border-slate-300", icon: XCircle },
    EXPIRED: { cls: "bg-slate-100 text-slate-500 border-slate-300" },
    ERRORED: { cls: "bg-rose-100 text-rose-900 border-rose-300", icon: AlertCircle }
  };
  const s = styles[status] ?? { cls: "bg-slate-100 text-slate-700 border-slate-300" };
  const Icon = s.icon;
  return (
    <Badge className={cn("text-[10px]", s.cls)}>
      {Icon && <Icon size={9} />}
      {status.replace(/_/g, " ").toLowerCase()}
    </Badge>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral"
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-white p-3",
        tone === "good"
          ? "border-emerald-200"
          : tone === "bad"
          ? "border-rose-200"
          : "border-slate-200"
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div
        className={cn(
          "text-base font-semibold mt-1",
          tone === "good"
            ? "text-emerald-700"
            : tone === "bad"
            ? "text-rose-700"
            : "text-slate-800"
        )}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function pct(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}
