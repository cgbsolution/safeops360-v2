// Configuration → AI Agents list. One row per configured agent with
// the rolling metrics the calibration job has computed. Click a row to
// drill into config + per-prompt-version metrics + invocation list.
//
// Data source: GET /api/agents (handled by app/routers/agents_config.py
// on the Python side, auto-proxied by /api/[...path]).

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backendFetch } from "@/lib/backend";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaleSessionBanner } from "./stale-session-banner";
import { AgentDemo, AgentUsedIn } from "./agent-demo";
import {
  Sparkles,
  ChevronRight,
  Activity,
  Pause,
  Power,
  CircleDashed,
  ShieldCheck,
  Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type AgentRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  module: string;
  primaryModelId: string;
  escalationModelId: string | null;
  currentAuthorityLevel: string;
  maxAuthorityLevel: string;
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

export default async function AgentsConfigPage() {
  // No specific permission required — the AI Agents landing page is
  // open to every logged-in user. Discovering the feature shouldn't
  // depend on role assignment. (The actual invocation endpoint
  // remains gated server-side via AGENT.RCA_INVOKE.)
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let agents: AgentRow[] | null = null;
  let fetchError: string | null = null;
  let isStaleSession = false;
  try {
    // Note: AgentOut returns ALL Agent fields but the list view only
    // needs the subset above. The `as` cast is for the local handler;
    // unused fields are harmless extra payload.
    agents = (await backendFetch<AgentRow[]>("/api/agents")) ?? [];
  } catch (e: any) {
    fetchError = e?.message ?? "Could not load agents";
    // Detect the common stale-session case: NextAuth cookie still valid
    // but the user row was wiped (typically by db:reset after login).
    // Surfacing a "sign out + back in" prompt is more useful than the
    // raw backend error.
    if (typeof fetchError === "string" && fetchError.includes("User not found")) {
      isStaleSession = true;
    }
    agents = [];
  }

  return (
    <div>
      <PageHeader
        title="AI Agents"
        description="User-initiated agents that assist with investigations, suggestions, and analysis. All output requires human review — agents never write to records directly."
        breadcrumbs={[{ label: "AI Assistance" }, { label: "AI Agents" }]}
      />

      <HowToUse />

      {isStaleSession && <StaleSessionBanner />}

      {fetchError && !isStaleSession && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-900 text-sm mb-4">
          {fetchError}
        </div>
      )}

      {agents && agents.length === 0 && !fetchError && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-slate-600 space-y-2">
            <CircleDashed size={20} className="mx-auto text-slate-400" />
            <p>No agents are configured.</p>
            <p className="text-xs">
              Run <code className="font-mono">npm run db:seed-agents</code> to seed the RCA Assistant.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {agents?.map((a) => (
          <AgentRow key={a.code} agent={a} />
        ))}
      </div>
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentRow }) {
  const acceptanceRate =
    agent.totalAcceptances + agent.totalModifications + agent.totalRejections > 0
      ? agent.totalAcceptances /
        (agent.totalAcceptances + agent.totalModifications + agent.totalRejections)
      : null;

  return (
    <div className="border border-slate-200 rounded-lg bg-white hover:border-violet-300 hover:shadow-sm transition">
      <div className="p-4 flex items-start gap-4">
        <div className="w-10 h-10 rounded-md bg-violet-50 text-violet-700 flex items-center justify-center flex-shrink-0">
          <Sparkles size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/configuration/agents/${agent.code}`}
              className="text-base font-semibold text-slate-900 hover:text-violet-700"
            >
              {agent.name}
            </Link>
            <code className="text-[10px] font-mono text-slate-500">{agent.code}</code>
            <StatusBadges agent={agent} />
          </div>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{agent.description}</p>

          <AgentUsedIn code={agent.code} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
            <Stat
              label="Invocations"
              value={agent.totalInvocations.toLocaleString()}
            />
            <Stat
              label="Acceptance"
              value={
                acceptanceRate != null
                  ? `${Math.round(acceptanceRate * 100)}%`
                  : "—"
              }
              hint={
                acceptanceRate != null
                  ? `${agent.totalAcceptances}/${agent.totalAcceptances + agent.totalModifications + agent.totalRejections}`
                  : "no decisions yet"
              }
            />
            <Stat
              label="Calibration"
              value={
                agent.calibrationScore != null
                  ? agent.calibrationScore.toFixed(2)
                  : "—"
              }
              hint={
                agent.lastCalibrationAt
                  ? `last run ${new Date(agent.lastCalibrationAt).toLocaleDateString()}`
                  : "never run"
              }
            />
            <Stat
              label="Avg cost"
              value={
                agent.averageCostUsd != null
                  ? `$${agent.averageCostUsd.toFixed(4)}`
                  : "—"
              }
              hint={
                agent.averageLatencyMs != null
                  ? `${(agent.averageLatencyMs / 1000).toFixed(1)}s avg`
                  : undefined
              }
            />
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <AgentDemo code={agent.code} name={agent.name} />
            <Link
              href={`/configuration/agents/${agent.code}`}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            >
              <Settings2 size={14} /> Open configuration
              <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadges({ agent }: { agent: AgentRow }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Badge
        className={cn(
          "text-[10px]",
          agent.isActive
            ? "bg-emerald-100 text-emerald-900 border-emerald-300"
            : "bg-slate-100 text-slate-600 border-slate-300"
        )}
      >
        {agent.isActive ? <Power size={9} /> : <Pause size={9} />}
        {agent.isActive ? "Active" : "Disabled"}
      </Badge>
      {agent.isInPilot && (
        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
          Pilot
        </Badge>
      )}
      <Badge className="bg-violet-100 text-violet-900 border-violet-300 text-[10px]">
        <Activity size={9} /> {agent.currentAuthorityLevel}
      </Badge>
      <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-mono">
        {agent.module}
      </Badge>
    </span>
  );
}

function HowToUse() {
  return (
    <div className="mb-4 rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50/40 p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0">
          <Sparkles size={16} />
        </div>
        <div className="flex-1 text-sm">
          <h3 className="font-semibold text-violet-900">How the AI agents work</h3>
          <p className="text-violet-800 text-xs mt-1 leading-relaxed">
            Each agent is invoked on a specific record — an incident, HIRA entry, CAPA, or
            permit — and returns <strong>advisory</strong> suggestions only. Nothing is written
            to a record without an explicit human click, and every run is fully audited.
          </p>
          <p className="text-violet-800 text-xs mt-2">
            New here? Hit{" "}
            <span className="inline-flex items-center gap-1 rounded border border-violet-200 bg-white px-1.5 py-0.5 font-medium text-violet-700">
              <ShieldCheck size={11} /> See how it works
            </span>{" "}
            on any agent below for a quick visual walkthrough — it shows you exactly where the
            agent lives and how to run it, step by step.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-800 mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}
