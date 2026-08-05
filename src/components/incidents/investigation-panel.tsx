"use client";

// Phase 3 — Investigation Team multi-tab panel.
//
// Shown when the current pending ASSIGNEE_TASK is "Investigation Team RCA +
// CAPA Definition" assigned to the user. Replaces ExecutionPanel for that
// step. The lead drives the investigation across tabs and submits the
// complete report to advance the workflow.
//
// Tab status (Commit 4):
//   ✅ Cause Analysis — uses existing RcaEditor, fully functional
//   ✅ CAPAs — full CRUD via /api/incidents/:id/capas
//   ⏳ Timeline / Witnesses / Evidence / Documents / Persons / Equipment /
//      Cost / Statutory — placeholders, deeper UIs land in Commit 5
//
// Submitting the report calls /api/workflow/submit-execution which advances
// to "HSE Manager Reviews Investigation Report".

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserPicker } from "@/components/ui/user-picker";
import { useToast } from "@/components/ui/toast";
import { PanelBoundary } from "@/components/ui/panel-boundary";
import { RcaEditor, useRcaMethodSwitcher } from "@/components/incidents/rca-editor";
import { RcaAssistantCard } from "@/components/incidents/rca-assistant";
import { type RcaMethod, RCA_METHODS_LIST, emptyDataFor, isEmptyRcaData } from "@/lib/rca/types";
import {
  AlertCircle, ChevronRight, ListChecks, Search, Users, FileText,
  Wrench, Brain, ClipboardList, IndianRupee, Shield, Send, Trash2,
  type LucideIcon
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

type Capa = {
  id: string;
  capaNumber: string;
  description: string;
  type: "CORRECTIVE" | "PREVENTIVE";
  rootCauseAddressed: string | null;
  ownerId: string;
  targetDate: string;
  status: string;
};

type TabKey =
  | "overview"
  | "timeline"
  | "witnesses"
  | "evidence"
  | "documents"
  | "persons"
  | "equipment"
  | "cause"
  | "capas"
  | "cost"
  | "statutory";

const TABS: { key: TabKey; label: string; icon: LucideIcon; status: "ready" | "placeholder" }[] = [
  { key: "overview",   label: "Overview",          icon: ListChecks, status: "ready" },
  { key: "timeline",   label: "Timeline",          icon: ChevronRight, status: "ready" },
  { key: "witnesses",  label: "Witnesses",         icon: Users, status: "ready" },
  { key: "evidence",   label: "Evidence",          icon: Search, status: "ready" },
  { key: "documents",  label: "Documents",         icon: FileText, status: "ready" },
  { key: "persons",    label: "Persons & Injuries", icon: Users, status: "ready" },
  { key: "equipment",  label: "Equipment",         icon: Wrench, status: "ready" },
  { key: "cause",      label: "Cause Analysis",    icon: Brain, status: "ready" },
  { key: "capas",      label: "CAPAs",             icon: ClipboardList, status: "ready" },
  { key: "cost",       label: "Cost",              icon: IndianRupee, status: "ready" },
  { key: "statutory",  label: "Statutory",         icon: Shield, status: "ready" }
];

export function InvestigationPanel({
  incidentId,
  taskId,
  initial,
  canInvokeRcaAgent = false,
  canViewAgentAudit = false
}: {
  incidentId: string;
  taskId: string;
  initial: {
    plantId: string;
    rcaMethod: string | null;
    rcaData: unknown;
    immediateCauses: string[];
    underlyingCauses: string[];
    rootCauses: string[];
    contributingFactors: string[];
    isReportable: boolean;
    statutoryDeadline: string | null;
  };
  /** Whether the caller has AGENT.RCA_INVOKE — gates the assistant card. */
  canInvokeRcaAgent?: boolean;
  /** Whether the caller has AGENT.AUDIT_VIEW — controls the audit drawer. */
  canViewAgentAudit?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Cause analysis state
  const [rcaMethod, setRcaMethod] = useState<RcaMethod>(
    (initial.rcaMethod as RcaMethod) ?? "FIVE_WHY"
  );
  const [rcaData, setRcaData] = useState<unknown>(initial.rcaData ?? emptyDataFor(rcaMethod));
  const switchMethod = useRcaMethodSwitcher({
    current: rcaMethod, data: rcaData,
    onConfirmedSwitch: (m, d) => { setRcaMethod(m); setRcaData(d); }
  });

  const [immediateCauses, setImmediateCauses] = useState(initial.immediateCauses.join("\n"));
  const [underlyingCauses, setUnderlyingCauses] = useState(initial.underlyingCauses.join("\n"));
  const [rootCauses, setRootCauses] = useState(initial.rootCauses.join("\n"));
  const [contributingFactors, setContributingFactors] = useState(initial.contributingFactors.join("\n"));

  // CAPA list (loaded on mount + after add/delete)
  const [capas, setCapas] = useState<Capa[]>([]);
  const [loadingCapas, setLoadingCapas] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/capas`);
        const j = await res.json().catch(() => []);
        if (!cancelled) setCapas(Array.isArray(j) ? j : []);
      } catch { /* swallow */ }
      finally { if (!cancelled) setLoadingCapas(false); }
    })();
    return () => { cancelled = true; };
  }, [incidentId]);

  // Submit-investigation-report state
  const [reportNarrative, setReportNarrative] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function saveCauseAnalysis() {
    setError("");
    const payload = {
      rootCauseMethod: rcaMethod,
      rootCauseData: rcaData,
      immediateCauses: immediateCauses.split("\n").map((s) => s.trim()).filter(Boolean),
      underlyingCauses: underlyingCauses.split("\n").map((s) => s.trim()).filter(Boolean),
      rootCauses: rootCauses.split("\n").map((s) => s.trim()).filter(Boolean),
      contributingFactors: contributingFactors.split("\n").map((s) => s.trim()).filter(Boolean)
    };
    const res = await fetch(`/api/incidents/${incidentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      toast({ variant: "success", title: "Saved", description: "Cause analysis updated." });
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.detail ?? j.error ?? "Save failed");
    }
  }

  async function addCapa(form: NewCapaForm) {
    const res = await fetch(`/api/incidents/${incidentId}/capas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      const j = await res.json();
      setCapas((prev) => [...prev, j]);
      toast({ variant: "success", title: "CAPA added", description: j.capaNumber });
      return true;
    }
    const j = await res.json().catch(() => ({}));
    toast({ variant: "error", title: "Could not add CAPA", description: j.detail ?? j.error ?? "Try again" });
    return false;
  }

  async function deleteCapa(id: string) {
    if (!confirm("Delete this CAPA? It must not be in progress.")) return;
    const res = await fetch(`/api/incidents/${incidentId}/capas/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setCapas((prev) => prev.filter((c) => c.id !== id));
    } else {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Delete failed", description: j.detail ?? "Try again" });
    }
  }

  async function submitInvestigationReport() {
    if (capas.length === 0) {
      setError("At least one CAPA is required before submitting the investigation report."); return;
    }
    if (rootCauses.split("\n").map((s) => s.trim()).filter(Boolean).length === 0) {
      setError("At least one root cause must be identified before submitting."); return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/workflow/submit-execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          comments: reportNarrative || "Investigation report submitted with cause analysis and CAPAs."
        })
      });
      if (res.ok) {
        toast({ variant: "success", title: "Report submitted", description: "HSE Manager will review next." });
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.detail ?? j.error ?? `Submit failed (${res.status})`);
        setSubmitting(false);
      }
    } catch (err: any) {
      setError(err?.message ?? "Network error");
      setSubmitting(false);
    }
  }

  const readyCount = TABS.filter((t) => t.status === "ready").length;

  return (
    <Card className="border-primary-300 ring-2 ring-primary-100">
      <CardHeader className="bg-primary-50 rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-primary-900">
          <Brain size={18} /> Phase 3 — Investigation
        </CardTitle>
        <CardDescription className="text-primary-700">
          Drive the investigation across tabs. Submit the report when cause analysis is complete and CAPAs are defined.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Tab strip */}
        <div className="flex flex-wrap gap-1 px-3 pt-3 border-b border-slate-200 bg-slate-50/60">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            const isReady = t.status === "ready";
            return (
              <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
                className={cn(
                  "px-3 py-1.5 rounded-t-md text-xs font-medium border-x border-t transition flex items-center gap-1.5",
                  isActive
                    ? "bg-white border-slate-300 text-primary-800"
                    : "bg-transparent border-transparent text-slate-600 hover:text-slate-900",
                  !isReady && !isActive && "opacity-60"
                )}>
                <Icon size={12} />
                {t.label}
                {!isReady && <span className="ml-0.5 text-[9px] uppercase tracking-wider text-slate-400">(soon)</span>}
              </button>
            );
          })}
        </div>

        <div className="p-5 space-y-4">
          {activeTab === "overview" && (
            <OverviewTab capas={capas} rcaMethod={rcaMethod} readyCount={readyCount} totalTabs={TABS.length}
              isReportable={initial.isReportable} statutoryDeadline={initial.statutoryDeadline} />
          )}

          {activeTab === "cause" && (
            <CauseAnalysisTab
              incidentId={incidentId}
              canInvokeRcaAgent={canInvokeRcaAgent}
              canViewAgentAudit={canViewAgentAudit}
              method={rcaMethod}
              data={rcaData}
              onMethodChange={(m) => switchMethod(m)}
              onDataChange={setRcaData}
              immediateCauses={immediateCauses} setImmediateCauses={setImmediateCauses}
              underlyingCauses={underlyingCauses} setUnderlyingCauses={setUnderlyingCauses}
              rootCauses={rootCauses} setRootCauses={setRootCauses}
              contributingFactors={contributingFactors} setContributingFactors={setContributingFactors}
              onSave={saveCauseAnalysis}
              // RCA-agent "Load Into Editor" hook: replace methodology +
              // data with the agent's draft. When the editor already has
              // non-empty content, confirm before clobbering — same
              // semantic as the method-switch hook elsewhere. For root
              // causes / contributing factors, APPEND rather than
              // overwrite so the agent's proposals don't wipe what the
              // investigator already typed.
              onLoadFromAgent={(payload) => {
                const editorIsEmpty = isEmptyRcaData(rcaMethod, rcaData);
                if (!editorIsEmpty) {
                  const ok = window.confirm(
                    "The methodology editor has unsaved content. Loading the agent's draft will replace it. Continue?"
                  );
                  if (!ok) return;
                }
                setRcaMethod(payload.method);
                setRcaData(payload.data);
                if (payload.proposedRootCauses.length > 0) {
                  setRootCauses((prev) => {
                    const trimmed = prev.trim();
                    const additions = payload.proposedRootCauses.join("\n");
                    return trimmed ? `${trimmed}\n${additions}` : additions;
                  });
                }
                if (payload.contributingFactors.length > 0) {
                  setContributingFactors((prev) => {
                    const trimmed = prev.trim();
                    const additions = payload.contributingFactors.join("\n");
                    return trimmed ? `${trimmed}\n${additions}` : additions;
                  });
                }
              }}
            />
          )}

          {activeTab === "capas" && (
            <CapasTab capas={capas} loading={loadingCapas} plantId={initial.plantId}
              rootCauses={rootCauses.split("\n").map((s) => s.trim()).filter(Boolean)}
              onAdd={addCapa} onDelete={deleteCapa} />
          )}

          {activeTab === "timeline"  && <TimelineTab incidentId={incidentId} />}
          {activeTab === "witnesses" && <WitnessesTab incidentId={incidentId} />}
          {activeTab === "evidence"  && <EvidenceTab incidentId={incidentId} />}
          {activeTab === "persons"   && <PersonsTab incidentId={incidentId} />}
          {activeTab === "equipment" && <EquipmentTab incidentId={incidentId} />}
          {activeTab === "cost"      && <CostTab incidentId={incidentId} />}
          {activeTab === "documents" && <DocumentsTab incidentId={incidentId} />}
          {activeTab === "statutory" && <StatutoryTab incidentId={incidentId} />}

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit investigation report */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <Label>Investigation Report Narrative</Label>
            <Textarea rows={2} value={reportNarrative} onChange={(e) => setReportNarrative(e.target.value)}
              placeholder="Optional summary comment posted to the workflow audit trail when you submit." />
            <div className="flex justify-end">
              <Button type="button" onClick={submitInvestigationReport} disabled={submitting} variant="success">
                <Send size={14} />
                {submitting ? "Submitting…" : "Submit Investigation Report"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────

function OverviewTab({ capas, rcaMethod, readyCount, totalTabs, isReportable, statutoryDeadline }: {
  capas: Capa[]; rcaMethod: string; readyCount: number; totalTabs: number;
  isReportable: boolean; statutoryDeadline: string | null;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="RCA Method" value={rcaMethod.replace(/_/g, " ")} />
        <Stat label="CAPAs Defined" value={capas.length.toString()} />
        <Stat label="Tabs Ready"
          value={`${readyCount} of ${totalTabs}`}
          hint="Other tabs land in Commit 5" />
      </div>
      {isReportable && statutoryDeadline && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 text-xs">
          <strong>Statutory deadline:</strong> {formatDateTime(statutoryDeadline)} — Form 18 / DGFASLI submission gates the closure step.
        </div>
      )}
      <p className="text-xs text-slate-500">
        Switch to <strong>Cause Analysis</strong> to perform root-cause investigation, then add <strong>CAPAs</strong>.
        Submit the report at the bottom when both are complete.
      </p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-800 mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function CauseAnalysisTab({
  incidentId,
  canInvokeRcaAgent,
  canViewAgentAudit,
  method, data, onMethodChange, onDataChange,
  immediateCauses, setImmediateCauses,
  underlyingCauses, setUnderlyingCauses,
  rootCauses, setRootCauses,
  contributingFactors, setContributingFactors,
  onSave,
  onLoadFromAgent
}: {
  incidentId: string;
  canInvokeRcaAgent: boolean;
  canViewAgentAudit: boolean;
  method: RcaMethod; data: unknown;
  onMethodChange: (m: RcaMethod) => void;
  onDataChange: (d: unknown) => void;
  immediateCauses: string; setImmediateCauses: (s: string) => void;
  underlyingCauses: string; setUnderlyingCauses: (s: string) => void;
  rootCauses: string; setRootCauses: (s: string) => void;
  contributingFactors: string; setContributingFactors: (s: string) => void;
  onSave: () => void;
  onLoadFromAgent: (payload: {
    method: RcaMethod;
    data: unknown;
    proposedRootCauses: string[];
    contributingFactors: string[];
  }) => void;
}) {
  return (
    <div className="space-y-4">
      {/* RCA Assistant entry point — only shown when the caller has the
          AGENT.RCA_INVOKE permission. Slotted ABOVE the editor so the
          investigator sees the agent option before they start drafting. */}
      <PanelBoundary label="RCA Assistant">
        <RcaAssistantCard
          incidentId={incidentId}
          canInvoke={canInvokeRcaAgent}
          canViewAudit={canViewAgentAudit}
          onLoadIntoEditor={onLoadFromAgent}
          getCurrentDraftState={() => ({ method, data, rootCauses })}
        />
      </PanelBoundary>

      <div className="grid sm:grid-cols-3 gap-3 items-end">
        <div className="sm:col-span-2">
          <Label>Root Cause Method</Label>
          <Select value={method} onChange={(e) => onMethodChange(e.target.value as RcaMethod)}>
            {RCA_METHODS_LIST.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
          </Select>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onSave}>Save Cause Analysis</Button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3">
        <RcaEditor method={method} value={data} onChange={onDataChange} readOnly={false} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200">
        <div>
          <Label>Immediate Causes (one per line)</Label>
          <Textarea rows={3} value={immediateCauses} onChange={(e) => setImmediateCauses(e.target.value)}
            placeholder="What directly caused the event…" />
        </div>
        <div>
          <Label>Underlying Causes (one per line)</Label>
          <Textarea rows={3} value={underlyingCauses} onChange={(e) => setUnderlyingCauses(e.target.value)}
            placeholder="Contributing conditions…" />
        </div>
        <div>
          <Label>Root Causes (one per line) <span className="text-rose-600">*</span></Label>
          <Textarea rows={3} value={rootCauses} onChange={(e) => setRootCauses(e.target.value)}
            placeholder="Identified by RCA. CAPAs link to these." />
        </div>
        <div>
          <Label>Contributing Factors (one per line)</Label>
          <Textarea rows={3} value={contributingFactors} onChange={(e) => setContributingFactors(e.target.value)}
            placeholder="Contextual factors…" />
        </div>
      </div>
    </div>
  );
}

type NewCapaForm = {
  description: string;
  type: "CORRECTIVE" | "PREVENTIVE";
  rootCauseAddressed: string | null;
  ownerId: string;
  targetDate: string;
};

function CapasTab({ capas, loading, plantId, rootCauses, onAdd, onDelete }: {
  capas: Capa[]; loading: boolean; plantId: string;
  rootCauses: string[];
  onAdd: (f: NewCapaForm) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"CORRECTIVE" | "PREVENTIVE">("CORRECTIVE");
  const [rootCauseAddressed, setRootCauseAddressed] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [targetDate, setTargetDate] = useState(today);
  const [busy, setBusy] = useState(false);

  function reset() {
    setDescription(""); setType("CORRECTIVE"); setRootCauseAddressed("");
    setOwnerId(null); setTargetDate(today); setShowForm(false);
  }

  async function submit() {
    if (description.trim().length < 10 || !ownerId) return;
    setBusy(true);
    const ok = await onAdd({
      description, type, rootCauseAddressed: rootCauseAddressed || null,
      ownerId, targetDate: new Date(targetDate).toISOString()
    });
    setBusy(false);
    if (ok) reset();
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="text-sm text-slate-500">Loading CAPAs…</div>
      ) : capas.length === 0 ? (
        <div className="text-sm text-slate-500 italic">No CAPAs defined yet. Add one below.</div>
      ) : (
        <ul className="space-y-2">
          {capas.map((c) => (
            <li key={c.id} className="rounded-md border border-slate-200 bg-white p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-semibold text-slate-700">{c.capaNumber}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                    c.type === "CORRECTIVE" ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800"
                  )}>{c.type}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-500">Due {formatDateTime(c.targetDate).split(",")[0]}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-500">{c.status}</span>
                </div>
                <div className="text-sm text-slate-800 mt-1">{c.description}</div>
                {c.rootCauseAddressed && (
                  <div className="text-xs text-slate-500 mt-1 italic">Addresses: {c.rootCauseAddressed}</div>
                )}
              </div>
              {c.status === "PENDING" && (
                <button type="button" onClick={() => onDelete(c.id)}
                  className="text-slate-400 hover:text-rose-600">
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!showForm ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>+ Add CAPA</Button>
      ) : (
        <div className="rounded-lg border border-slate-300 bg-slate-50/60 p-3 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">New CAPA</div>
          <div>
            <Label>Description <span className="text-rose-600">*</span></Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What action will be taken? (10+ chars)" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as "CORRECTIVE" | "PREVENTIVE")}>
                <option value="CORRECTIVE">Corrective</option>
                <option value="PREVENTIVE">Preventive</option>
              </Select>
            </div>
            <div>
              <Label>Root Cause Addressed</Label>
              <Select value={rootCauseAddressed} onChange={(e) => setRootCauseAddressed(e.target.value)}>
                <option value="">— Select root cause —</option>
                {rootCauses.map((rc, i) => <option key={i} value={rc}>{rc.slice(0, 80)}</option>)}
              </Select>
            </div>
            <div>
              <Label>Owner <span className="text-rose-600">*</span></Label>
              <UserPicker value={ownerId} onChange={(id) => setOwnerId(id)}
                filter={{ plantId }} placeholder="Search…" required />
            </div>
            <div>
              <Label>Target Date <span className="text-rose-600">*</span></Label>
              <Input type="date" min={today} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={reset}>Cancel</Button>
            <Button type="button" size="sm" onClick={submit}
              disabled={busy || description.trim().length < 10 || !ownerId}>
              {busy ? "Adding…" : "Add CAPA"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaceholderTab({ tab }: { tab: TabKey }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="text-sm font-semibold text-slate-700">
        {TABS.find((t) => t.key === tab)?.label} — landing in Commit 7
      </div>
      <p className="text-xs text-slate-500 mt-1">
        Data model is in place. UI ships alongside Form 18 / DGFASLI generation.
      </p>
    </div>
  );
}


// ─── Timeline tab ───────────────────────────────────────────────────────

type TimelineEvent = {
  id: string;
  sequence: number;
  timestamp: string;
  description: string;
  source: string;
  sourceReference: string | null;
};

function TimelineTab({ incidentId }: { incidentId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 16);
  const [timestamp, setTimestamp] = useState(today);
  const [description, setDescription] = useState("");
  const [source, setSource] = useState<string>("WITNESS");
  const [sourceReference, setSourceReference] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/timeline-events`);
        const j = await res.json().catch(() => []);
        if (!cancelled) setRows(Array.isArray(j) ? j : []);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [incidentId]);

  async function add() {
    if (description.trim().length < 5) return;
    setBusy(true);
    const nextSeq = rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.sequence)) + 1;
    const res = await fetch(`/api/incidents/${incidentId}/timeline-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sequence: nextSeq,
        timestamp: new Date(timestamp).toISOString(),
        description, source,
        sourceReference: sourceReference || null
      })
    });
    setBusy(false);
    if (res.ok) {
      const j = await res.json();
      setRows((prev) => [...prev, j].sort((a, b) => a.sequence - b.sequence));
      setDescription(""); setSourceReference(""); setShowForm(false);
    } else {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Add failed", description: j.detail ?? "Try again" });
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this timeline event?")) return;
    const res = await fetch(`/api/incidents/${incidentId}/timeline-events/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="text-sm text-slate-500">Loading timeline…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-500 italic">No events recorded yet. Add the first one below.</div>
      ) : (
        <ol className="relative border-l-2 border-slate-200 ml-3 space-y-3 pl-4">
          {rows.map((r) => (
            <li key={r.id} className="relative">
              <span className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-primary-600 border-2 border-white" />
              <div className="rounded-md border border-slate-200 bg-white p-3 flex items-start gap-3">
                <div className="text-xs text-slate-500 font-mono whitespace-nowrap">
                  #{r.sequence}<br />{formatDateTime(r.timestamp)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-800">{r.description}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Source: <span className="font-medium">{r.source}</span>
                    {r.sourceReference && ` · ${r.sourceReference}`}
                  </div>
                </div>
                <button type="button" onClick={() => remove(r.id)}
                  className="text-slate-400 hover:text-rose-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {!showForm ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>+ Add Timeline Event</Button>
      ) : (
        <div className="rounded-lg border border-slate-300 bg-slate-50/60 p-3 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>Timestamp</Label>
              <Input type="datetime-local" value={timestamp} onChange={(e) => setTimestamp(e.target.value)} />
            </div>
            <div>
              <Label>Source</Label>
              <Select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="WITNESS">Witness</option>
                <option value="CCTV">CCTV</option>
                <option value="EQUIPMENT_DATA">Equipment Data</option>
                <option value="INTERVIEW">Interview</option>
                <option value="DOCUMENT">Document</option>
              </Select>
            </div>
            <div>
              <Label>Source Reference</Label>
              <Input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)}
                placeholder="e.g. Camera 4, log #123" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened at this point in time…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setDescription(""); }}>Cancel</Button>
            <Button type="button" size="sm" onClick={add} disabled={busy || description.trim().length < 5}>
              {busy ? "Adding…" : "Add Event"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Witnesses tab ──────────────────────────────────────────────────────

type WitnessRow = {
  id: string;
  witnessName: string;
  witnessRole: string | null;
  statementText: string | null;
  statementFileUrl: string | null;
  audioRecordingUrl: string | null;
  takenAt: string;
  language: string | null;
};

function WitnessesTab({ incidentId }: { incidentId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<WitnessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<WitnessRow>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/incidents/${incidentId}/witnesses`);
        const j = await r.json().catch(() => []);
        if (!cancelled) setRows(Array.isArray(j) ? j : []);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [incidentId]);

  function startEdit(w: WitnessRow) {
    setEditing(w.id);
    setDraft({
      witnessRole: w.witnessRole ?? "",
      statementText: w.statementText ?? "",
      statementFileUrl: w.statementFileUrl ?? "",
      audioRecordingUrl: w.audioRecordingUrl ?? "",
      language: w.language ?? "English"
    });
  }

  async function save(id: string) {
    const res = await fetch(`/api/incidents/${incidentId}/witnesses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    if (res.ok) {
      const j = await res.json();
      setRows((prev) => prev.map((r) => (r.id === id ? j : r)));
      setEditing(null);
      toast({ variant: "success", title: "Statement saved" });
    } else {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Save failed", description: j.detail ?? "Try again" });
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Loading witnesses…</div>;
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        No witnesses were captured during Phase 1. Add them by editing the incident's reporter context.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((w) => (
        <div key={w.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-800">{w.witnessName}</div>
              <div className="text-xs text-slate-500">
                {w.witnessRole ?? "—"} · taken {formatDateTime(w.takenAt)} · {w.language ?? "English"}
              </div>
            </div>
            {editing !== w.id && (
              <Button type="button" size="sm" variant="outline" onClick={() => startEdit(w)}>
                {w.statementText ? "Edit Statement" : "Add Statement"}
              </Button>
            )}
          </div>

          {editing === w.id ? (
            <div className="mt-3 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Role</Label>
                  <Input value={draft.witnessRole ?? ""} onChange={(e) => setDraft({ ...draft, witnessRole: e.target.value })} />
                </div>
                <div>
                  <Label>Language</Label>
                  <Select value={draft.language ?? "English"} onChange={(e) => setDraft({ ...draft, language: e.target.value })}>
                    <option>English</option>
                    <option>Hindi</option>
                    <option>Bengali</option>
                    <option>Khasi</option>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Statement Text</Label>
                <Textarea rows={4} value={draft.statementText ?? ""}
                  onChange={(e) => setDraft({ ...draft, statementText: e.target.value })}
                  placeholder="Verbatim or paraphrased witness account…" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Signed Statement File URL</Label>
                  <Input value={draft.statementFileUrl ?? ""}
                    onChange={(e) => setDraft({ ...draft, statementFileUrl: e.target.value })}
                    placeholder="https://… (signed PDF)" />
                </div>
                <div>
                  <Label>Audio Recording URL</Label>
                  <Input value={draft.audioRecordingUrl ?? ""}
                    onChange={(e) => setDraft({ ...draft, audioRecordingUrl: e.target.value })}
                    placeholder="https://… (audio file)" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="button" size="sm" onClick={() => save(w.id)}>Save</Button>
              </div>
            </div>
          ) : w.statementText ? (
            <div className="mt-2 rounded-md bg-slate-50 border border-slate-200 p-2.5 text-sm text-slate-700 whitespace-pre-wrap italic">
              "{w.statementText}"
              {(w.statementFileUrl || w.audioRecordingUrl) && (
                <div className="mt-2 flex gap-3 text-xs not-italic">
                  {w.statementFileUrl && <a href={w.statementFileUrl} target="_blank" className="text-primary-700 underline">Signed PDF</a>}
                  {w.audioRecordingUrl && <a href={w.audioRecordingUrl} target="_blank" className="text-primary-700 underline">Audio</a>}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-500 italic">No statement recorded yet.</div>
          )}
        </div>
      ))}
    </div>
  );
}


// ─── Evidence tab ───────────────────────────────────────────────────────

type EvidenceRow = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  fileUrl: string | null;
  fileName: string | null;
  collectedAt: string | null;
  preservedFor: string | null;
};

function EvidenceTab({ incidentId }: { incidentId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [category, setCategory] = useState("PHOTO");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [preservedFor, setPreservedFor] = useState("internal");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/incidents/${incidentId}/evidence`);
        const j = await r.json().catch(() => []);
        if (!cancelled) setRows(Array.isArray(j) ? j : []);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [incidentId]);

  async function add() {
    if (title.trim().length < 2) return;
    setBusy(true);
    const res = await fetch(`/api/incidents/${incidentId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category, title,
        description: description || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        preservedFor
      })
    });
    setBusy(false);
    if (res.ok) {
      const j = await res.json();
      setRows((prev) => [j, ...prev]);
      setTitle(""); setDescription(""); setFileUrl(""); setFileName(""); setShowForm(false);
    } else {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Add failed", description: j.detail ?? "Try again" });
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this evidence item?")) return;
    const res = await fetch(`/api/incidents/${incidentId}/evidence/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="text-sm text-slate-500">Loading evidence…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-500 italic">No evidence collected yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {rows.map((e) => (
            <div key={e.id} className="rounded-md border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-semibold text-slate-700">{e.category}</span>
                    {e.preservedFor && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-amber-100 border border-amber-300 rounded text-amber-800">{e.preservedFor}</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-800 mt-1">{e.title}</div>
                  {e.description && <div className="text-xs text-slate-600 mt-1">{e.description}</div>}
                  {e.fileUrl && (
                    <a href={e.fileUrl} target="_blank" className="text-xs text-primary-700 underline mt-1 inline-block">
                      {e.fileName || "View file"}
                    </a>
                  )}
                  {e.collectedAt && (
                    <div className="text-[10px] text-slate-400 mt-1">collected {formatDateTime(e.collectedAt)}</div>
                  )}
                </div>
                <button type="button" onClick={() => remove(e.id)}
                  className="text-slate-400 hover:text-rose-600 ml-2">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>+ Add Evidence</Button>
      ) : (
        <div className="rounded-lg border border-slate-300 bg-slate-50/60 p-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="PHOTO">Photo</option>
                <option value="VIDEO">Video</option>
                <option value="CCTV">CCTV</option>
                <option value="EQUIPMENT_DATA">Equipment Data</option>
                <option value="DOCUMENT">Document</option>
                <option value="SKETCH">Sketch</option>
                <option value="EXTERNAL_REPORT">External Report</option>
              </Select>
            </div>
            <div>
              <Label>Preservation Purpose</Label>
              <Select value={preservedFor} onChange={(e) => setPreservedFor(e.target.value)}>
                <option value="internal">Internal</option>
                <option value="regulatory">Regulatory</option>
                <option value="legal">Legal</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Kiln preheater photo, gas test log Mar 4" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>File URL</Label>
              <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <Label>File Name</Label>
              <Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="e.g. cctv_camera4.mp4" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setTitle(""); }}>Cancel</Button>
            <Button type="button" size="sm" onClick={add} disabled={busy || title.trim().length < 2}>
              {busy ? "Adding…" : "Add Evidence"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Persons & Injuries tab ─────────────────────────────────────────────

type PersonRow = {
  id: string;
  externalName: string | null;
  role: string;
  isContractor: boolean;
  isInjured: boolean;
  bodyPartAffected: string | null;
  natureOfInjury: string | null;
  injurySeverity: string | null;
  treatment: string | null;
  hospitalName: string | null;
  daysOff: number | null;
  daysRestricted: number | null;
  returnToWorkDate: string | null;
  isFitForDuty: boolean | null;
};

function PersonsTab({ incidentId }: { incidentId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PersonRow>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/incidents/${incidentId}/persons`);
        const j = await r.json().catch(() => []);
        if (!cancelled) setRows(Array.isArray(j) ? j : []);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [incidentId]);

  async function save(id: string) {
    const res = await fetch(`/api/incidents/${incidentId}/persons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        daysOff: draft.daysOff !== undefined ? Number(draft.daysOff) || null : undefined,
        daysRestricted: draft.daysRestricted !== undefined ? Number(draft.daysRestricted) || null : undefined,
        returnToWorkDate: draft.returnToWorkDate ? new Date(draft.returnToWorkDate).toISOString() : null
      })
    });
    if (res.ok) {
      const j = await res.json();
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...j } : r)));
      setEditing(null);
      toast({ variant: "success", title: "Saved" });
    } else {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Save failed", description: j.detail ?? "Try again" });
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Loading persons…</div>;
  if (rows.length === 0) {
    return <div className="text-sm text-slate-500 italic">No persons captured.</div>;
  }

  return (
    <div className="space-y-3">
      {rows.map((p) => (
        <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800">
                {p.externalName ?? "Internal employee"}{" "}
                <span className="text-xs text-slate-500 font-normal">
                  · {p.role}{p.isContractor && " · contractor"}
                </span>
              </div>
              {p.isInjured && (
                <div className="text-xs text-slate-600 mt-1">
                  {p.bodyPartAffected ?? "—"} · {p.natureOfInjury ?? "—"} · {p.injurySeverity ?? "—"}
                  {p.daysOff != null && ` · ${p.daysOff} days off`}
                  {p.returnToWorkDate && ` · returned ${formatDateTime(p.returnToWorkDate).split(",")[0]}`}
                  {p.isFitForDuty === true && " · fit"}
                  {p.isFitForDuty === false && " · not fit"}
                </div>
              )}
            </div>
            {editing !== p.id && (
              <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(p.id); setDraft({ ...p }); }}>
                Refine
              </Button>
            )}
          </div>

          {editing === p.id && (
            <div className="mt-3 pt-3 border-t border-slate-200 grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Body Part</Label>
                <Input value={draft.bodyPartAffected ?? ""} onChange={(e) => setDraft({ ...draft, bodyPartAffected: e.target.value })} />
              </div>
              <div>
                <Label>Nature of Injury</Label>
                <Input value={draft.natureOfInjury ?? ""} onChange={(e) => setDraft({ ...draft, natureOfInjury: e.target.value })} />
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={draft.injurySeverity ?? ""} onChange={(e) => setDraft({ ...draft, injurySeverity: e.target.value })}>
                  <option value="">—</option>
                  <option value="MINOR">Minor</option>
                  <option value="MAJOR">Major</option>
                  <option value="FATAL">Fatal</option>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Treatment</Label>
                <Input value={draft.treatment ?? ""} onChange={(e) => setDraft({ ...draft, treatment: e.target.value })} />
              </div>
              <div>
                <Label>Hospital</Label>
                <Input value={draft.hospitalName ?? ""} onChange={(e) => setDraft({ ...draft, hospitalName: e.target.value })} />
              </div>
              <div>
                <Label>Days Off (final)</Label>
                <Input type="number" min={0} value={draft.daysOff ?? ""} onChange={(e) => setDraft({ ...draft, daysOff: e.target.value as any })} />
              </div>
              <div>
                <Label>Days Restricted</Label>
                <Input type="number" min={0} value={draft.daysRestricted ?? ""} onChange={(e) => setDraft({ ...draft, daysRestricted: e.target.value as any })} />
              </div>
              <div>
                <Label>Return to Work</Label>
                <Input type="date" value={draft.returnToWorkDate ? draft.returnToWorkDate.slice(0, 10) : ""}
                  onChange={(e) => setDraft({ ...draft, returnToWorkDate: e.target.value || null })} />
              </div>
              <div className="sm:col-span-3 flex items-center gap-2">
                <input type="checkbox" id={`fit-${p.id}`} checked={!!draft.isFitForDuty}
                  onChange={(e) => setDraft({ ...draft, isFitForDuty: e.target.checked })} />
                <Label htmlFor={`fit-${p.id}`} className="!mb-0">Assessed fit for duty</Label>
              </div>
              <div className="sm:col-span-3 flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="button" size="sm" onClick={() => save(p.id)}>Save</Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


// ─── Equipment tab ──────────────────────────────────────────────────────

type EquipmentRow = {
  id: string;
  equipmentId: string;
  involvement: string;
  damageEstimate: number | null;
  repairStatus: string | null;
};

function EquipmentTab({ incidentId }: { incidentId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<EquipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<EquipmentRow>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/incidents/${incidentId}/equipment`);
        const j = await r.json().catch(() => []);
        if (!cancelled) setRows(Array.isArray(j) ? j : []);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [incidentId]);

  async function save(id: string) {
    const res = await fetch(`/api/incidents/${incidentId}/equipment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        involvement: draft.involvement,
        damageEstimate: draft.damageEstimate !== undefined ? Number(draft.damageEstimate) || null : undefined,
        repairStatus: draft.repairStatus
      })
    });
    if (res.ok) {
      const j = await res.json();
      setRows((prev) => prev.map((r) => (r.id === id ? j : r)));
      setEditing(null);
    } else {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Save failed", description: j.detail ?? "Try again" });
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Loading equipment…</div>;
  if (rows.length === 0) {
    return <div className="text-sm text-slate-500 italic">No equipment was recorded as involved.</div>;
  }

  return (
    <div className="space-y-3">
      {rows.map((e) => (
        <div key={e.id} className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-800 font-mono">{e.equipmentId}</div>
              <div className="text-xs text-slate-600 mt-1">
                {e.involvement.replace(/_/g, " ")}
                {e.damageEstimate != null && ` · damage ₹${e.damageEstimate.toLocaleString("en-IN")}`}
                {e.repairStatus && ` · ${e.repairStatus.replace(/_/g, " ")}`}
              </div>
            </div>
            {editing !== e.id && (
              <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(e.id); setDraft({ ...e }); }}>
                Refine
              </Button>
            )}
          </div>
          {editing === e.id && (
            <div className="mt-3 pt-3 border-t border-slate-200 grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Involvement</Label>
                <Select value={draft.involvement ?? ""} onChange={(ev) => setDraft({ ...draft, involvement: ev.target.value })}>
                  <option value="DIRECTLY_INVOLVED">Directly involved</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="INADEQUATE_GUARDING">Inadequate guarding</option>
                  <option value="MALFUNCTION">Malfunction</option>
                </Select>
              </div>
              <div>
                <Label>Damage Estimate (₹)</Label>
                <Input type="number" min={0} value={draft.damageEstimate ?? ""}
                  onChange={(ev) => setDraft({ ...draft, damageEstimate: ev.target.value as any })} />
              </div>
              <div>
                <Label>Repair Status</Label>
                <Select value={draft.repairStatus ?? ""} onChange={(ev) => setDraft({ ...draft, repairStatus: ev.target.value })}>
                  <option value="">—</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="REPAIRED">Repaired</option>
                  <option value="REPLACED">Replaced</option>
                  <option value="DECOMMISSIONED">Decommissioned</option>
                </Select>
              </div>
              <div className="sm:col-span-3 flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="button" size="sm" onClick={() => save(e.id)}>Save</Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


// ─── Documents Reviewed tab ─────────────────────────────────────────────

type DocumentRow = {
  id: string;
  documentType: string;
  documentReference: string;
  documentLinkId: string | null;
  reviewNotes: string | null;
  complianceFinding: string | null;
};

function DocumentsTab({ incidentId }: { incidentId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [documentType, setDocumentType] = useState("SOP");
  const [documentReference, setDocumentReference] = useState("");
  const [documentLinkId, setDocumentLinkId] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [complianceFinding, setComplianceFinding] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/incidents/${incidentId}/documents-reviewed`);
        const j = await r.json().catch(() => []);
        if (!cancelled) setRows(Array.isArray(j) ? j : []);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [incidentId]);

  async function add() {
    if (documentReference.trim().length < 2) return;
    setBusy(true);
    const res = await fetch(`/api/incidents/${incidentId}/documents-reviewed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentType, documentReference,
        documentLinkId: documentLinkId || null,
        reviewNotes: reviewNotes || null,
        complianceFinding: complianceFinding || null
      })
    });
    setBusy(false);
    if (res.ok) {
      const j = await res.json();
      setRows((prev) => [...prev, j]);
      setDocumentReference(""); setDocumentLinkId(""); setReviewNotes(""); setComplianceFinding("");
      setShowForm(false);
    } else {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Add failed", description: j.detail ?? "Try again" });
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this document review?")) return;
    const res = await fetch(`/api/incidents/${incidentId}/documents-reviewed/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="text-sm text-slate-500">Loading documents…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-500 italic">No documents reviewed yet.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((d) => (
            <li key={d.id} className="rounded-md border border-slate-200 bg-white p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono font-semibold text-slate-700 text-[10px] uppercase">{d.documentType}</span>
                  {d.complianceFinding && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                      d.complianceFinding === "COMPLIANT" ? "bg-emerald-100 text-emerald-800" :
                      d.complianceFinding === "NON_COMPLIANT" ? "bg-rose-100 text-rose-800" :
                      "bg-slate-100 text-slate-700"
                    )}>{d.complianceFinding.replace(/_/g, " ")}</span>
                  )}
                </div>
                <div className="text-sm font-semibold text-slate-800 mt-1">{d.documentReference}</div>
                {d.reviewNotes && <div className="text-xs text-slate-600 mt-1">{d.reviewNotes}</div>}
                {d.documentLinkId && <div className="text-[10px] text-slate-400 mt-0.5 font-mono">linked: {d.documentLinkId}</div>}
              </div>
              <button type="button" onClick={() => remove(d.id)} className="text-slate-400 hover:text-rose-600">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!showForm ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>+ Add Document Review</Button>
      ) : (
        <div className="rounded-lg border border-slate-300 bg-slate-50/60 p-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Document Type</Label>
              <Select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                <option value="SOP">SOP</option>
                <option value="PERMIT">Permit</option>
                <option value="TRAINING_RECORD">Training Record</option>
                <option value="INSPECTION_RECORD">Inspection Record</option>
                <option value="MOC">MOC (Management of Change)</option>
                <option value="PSM">PSM</option>
              </Select>
            </div>
            <div>
              <Label>Compliance Finding</Label>
              <Select value={complianceFinding} onChange={(e) => setComplianceFinding(e.target.value)}>
                <option value="">— Select —</option>
                <option value="COMPLIANT">Compliant</option>
                <option value="NON_COMPLIANT">Non-compliant</option>
                <option value="NOT_APPLICABLE">Not applicable</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Document Reference</Label>
            <Input value={documentReference} onChange={(e) => setDocumentReference(e.target.value)}
              placeholder="e.g. SOP-CM-014 v3, PTW-2026-LMS-0123, Training Cert #4521" />
          </div>
          <div>
            <Label>Linked Internal Record ID (optional)</Label>
            <Input value={documentLinkId} onChange={(e) => setDocumentLinkId(e.target.value)}
              placeholder="If reviewing a SafeOps360 record (e.g. permit id)" />
          </div>
          <div>
            <Label>Review Notes</Label>
            <Textarea rows={2} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="What you found when reviewing this document…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setDocumentReference(""); }}>Cancel</Button>
            <Button type="button" size="sm" onClick={add} disabled={busy || documentReference.trim().length < 2}>
              {busy ? "Adding…" : "Add Review"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Statutory submissions tab ──────────────────────────────────────────

type StatutoryState = {
  reportableUnder: string[] | null;
  statutoryDeadline: string | null;
  form18Submitted: boolean;
  form18SubmissionDate: string | null;
  form18SubmissionRef: string | null;
  dgfasliSubmitted: boolean;
  dgfasliSubmissionDate: string | null;
  cpcbSubmitted: boolean;
  cpcbSubmissionDate: string | null;
  isReportable: boolean;
};

function StatutoryTab({ incidentId }: { incidentId: string }) {
  const { toast } = useToast();
  const [state, setState] = useState<StatutoryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Local edit state for ref number / submission date
  const [form18Ref, setForm18Ref] = useState("");
  const [form18Date, setForm18Date] = useState("");
  const [dgfasliDate, setDgfasliDate] = useState("");
  const [cpcbDate, setCpcbDate] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/incidents/${incidentId}`);
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        setState({
          reportableUnder: j.reportableUnder ?? null,
          statutoryDeadline: j.statutoryDeadline ?? null,
          form18Submitted: !!j.form18Submitted,
          form18SubmissionDate: j.form18SubmissionDate ?? null,
          form18SubmissionRef: j.form18SubmissionRef ?? null,
          dgfasliSubmitted: !!j.dgfasliSubmitted,
          dgfasliSubmissionDate: j.dgfasliSubmissionDate ?? null,
          cpcbSubmitted: !!j.cpcbSubmitted,
          cpcbSubmissionDate: j.cpcbSubmissionDate ?? null,
          isReportable: !!j.isReportable
        });
        setForm18Ref(j.form18SubmissionRef ?? "");
        if (j.form18SubmissionDate) setForm18Date(j.form18SubmissionDate.slice(0, 10));
        if (j.dgfasliSubmissionDate) setDgfasliDate(j.dgfasliSubmissionDate.slice(0, 10));
        if (j.cpcbSubmissionDate) setCpcbDate(j.cpcbSubmissionDate.slice(0, 10));
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [incidentId]);

  async function submit(payload: any) {
    setBusy(true);
    const res = await fetch(`/api/incidents/${incidentId}/statutory-submissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setBusy(false);
    if (res.ok) {
      const j = await res.json();
      setState((prev) => prev && {
        ...prev,
        form18Submitted: !!j.form18Submitted,
        form18SubmissionDate: j.form18SubmissionDate ?? null,
        form18SubmissionRef: j.form18SubmissionRef ?? null,
        dgfasliSubmitted: !!j.dgfasliSubmitted,
        dgfasliSubmissionDate: j.dgfasliSubmissionDate ?? null,
        cpcbSubmitted: !!j.cpcbSubmitted,
        cpcbSubmissionDate: j.cpcbSubmissionDate ?? null
      });
      toast({ variant: "success", title: "Statutory submission updated" });
    } else {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Save failed", description: j.detail ?? "Try again" });
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Loading statutory state…</div>;
  if (!state) return <div className="text-sm text-slate-500">Could not load statutory state.</div>;

  if (!state.isReportable) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        This incident is classified as <strong>not statutorily reportable</strong>. If that's incorrect,
        re-classify the incident first via Phase 2 → Statutory Assessment.
      </div>
    );
  }

  const deadline = state.statutoryDeadline ? new Date(state.statutoryDeadline) : null;
  const overdue = deadline && deadline.getTime() < Date.now();

  const regs = [
    { code: "FACTORIES_ACT", label: "Form 18 (Factories Act)",
      submitted: state.form18Submitted, date: state.form18SubmissionDate, ref: state.form18SubmissionRef },
    { code: "DGFASLI", label: "DGFASLI",
      submitted: state.dgfasliSubmitted, date: state.dgfasliSubmissionDate, ref: null },
    { code: "CPCB", label: "CPCB (Environmental)",
      submitted: state.cpcbSubmitted, date: state.cpcbSubmissionDate, ref: null }
  ].filter((r) => state.reportableUnder?.includes(r.code));

  return (
    <div className="space-y-4">
      {deadline && (
        <div className={cn(
          "rounded-md border px-3 py-2.5 text-sm flex items-start gap-2",
          overdue ? "border-rose-300 bg-rose-50 text-rose-900" : "border-amber-300 bg-amber-50 text-amber-900"
        )}>
          <Shield size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold">
              Deadline: {deadline.toLocaleString()}
              {overdue && " — OVERDUE"}
            </div>
            <div className="text-xs">
              {overdue
                ? "Submission window has lapsed. File retroactively and document the reason in your investigation report."
                : "All applicable submissions must be filed before incident closure."}
            </div>
          </div>
        </div>
      )}

      {regs.map((r) => (
        <div key={r.code} className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-800">{r.label}</div>
              {r.submitted ? (
                <div className="text-xs text-emerald-700 mt-0.5">
                  ✓ Submitted{r.date && ` on ${new Date(r.date).toLocaleDateString()}`}
                  {r.ref && <span className="ml-2 font-mono text-slate-500">(ref: {r.ref})</span>}
                </div>
              ) : (
                <div className="text-xs text-slate-500 mt-0.5">Not yet submitted</div>
              )}
            </div>
          </div>
          {!r.submitted && (
            <div className="grid sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <div>
                <Label>Submission Date</Label>
                <Input type="date"
                  value={r.code === "FACTORIES_ACT" ? form18Date : r.code === "DGFASLI" ? dgfasliDate : cpcbDate}
                  onChange={(e) => {
                    if (r.code === "FACTORIES_ACT") setForm18Date(e.target.value);
                    else if (r.code === "DGFASLI") setDgfasliDate(e.target.value);
                    else setCpcbDate(e.target.value);
                  }} />
              </div>
              {r.code === "FACTORIES_ACT" && (
                <div className="sm:col-span-1">
                  <Label>Inspector Reference No.</Label>
                  <Input value={form18Ref} onChange={(e) => setForm18Ref(e.target.value)}
                    placeholder="e.g. INS/2026/M/123" />
                </div>
              )}
              <div className={r.code === "FACTORIES_ACT" ? "sm:col-span-1" : "sm:col-span-2"}>
                <Label>&nbsp;</Label>
                <Button type="button" size="sm" disabled={busy} onClick={() => {
                  const date = r.code === "FACTORIES_ACT" ? form18Date : r.code === "DGFASLI" ? dgfasliDate : cpcbDate;
                  if (!date) {
                    toast({ variant: "error", title: "Date required", description: "Pick a submission date." });
                    return;
                  }
                  const payload: any = {};
                  if (r.code === "FACTORIES_ACT") {
                    payload.form18Submitted = true;
                    payload.form18SubmissionDate = new Date(date).toISOString();
                    payload.form18SubmissionRef = form18Ref || null;
                  } else if (r.code === "DGFASLI") {
                    payload.dgfasliSubmitted = true;
                    payload.dgfasliSubmissionDate = new Date(date).toISOString();
                  } else {
                    payload.cpcbSubmitted = true;
                    payload.cpcbSubmissionDate = new Date(date).toISOString();
                  }
                  submit(payload);
                }}>Mark Submitted</Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


// ─── Cost tab ───────────────────────────────────────────────────────────

function CostTab({ incidentId }: { incidentId: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [costs, setCosts] = useState({
    costMedical: "", costPropertyDamage: "", costLostProduction: "",
    costInsurance: "", costLegalRegulatory: "", costOther: ""
  });

  // Production tonnage helper for "lost production" — tonnes × margin
  const [tonnes, setTonnes] = useState("");
  const [marginPerTonne, setMarginPerTonne] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/incidents/${incidentId}`);
      if (!r.ok) return;
      const j = await r.json();
      if (cancelled) return;
      setCosts({
        costMedical: j.costMedical?.toString() ?? "",
        costPropertyDamage: j.costPropertyDamage?.toString() ?? "",
        costLostProduction: j.costLostProduction?.toString() ?? "",
        costInsurance: j.costInsurance?.toString() ?? "",
        costLegalRegulatory: j.costLegalRegulatory?.toString() ?? "",
        costOther: j.costOther?.toString() ?? ""
      });
    })();
    return () => { cancelled = true; };
  }, [incidentId]);

  const total = useMemo(() => {
    return Object.values(costs).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [costs]);

  // Compute lost production from tonnes × margin when both filled
  useEffect(() => {
    const t = Number(tonnes), m = Number(marginPerTonne);
    if (t > 0 && m > 0) {
      setCosts((prev) => ({ ...prev, costLostProduction: (t * m).toString() }));
    }
  }, [tonnes, marginPerTonne]);

  async function save() {
    setBusy(true);
    const payload: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(costs)) {
      payload[k] = v === "" ? null : Number(v);
    }
    const res = await fetch(`/api/incidents/${incidentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setBusy(false);
    if (res.ok) {
      toast({ variant: "success", title: "Cost saved", description: `Total: ₹${total.toLocaleString("en-IN")}` });
    } else {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Save failed", description: j.detail ?? "Try again" });
    }
  }

  function input(key: keyof typeof costs, label: string, hint?: string) {
    return (
      <div>
        <Label>{label} (₹)</Label>
        <Input type="number" min={0} value={costs[key]}
          onChange={(e) => setCosts({ ...costs, [key]: e.target.value })} />
        {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        {input("costMedical", "Medical", "Hospital, treatment, follow-up")}
        {input("costPropertyDamage", "Property Damage", "Equipment / structure repair / replacement")}
        {input("costInsurance", "Insurance Claim")}
        {input("costLegalRegulatory", "Legal / Regulatory", "Fines, legal fees")}
        {input("costOther", "Other")}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Lost Production</div>
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div>
            <Label>Tonnes Lost</Label>
            <Input type="number" min={0} value={tonnes} onChange={(e) => setTonnes(e.target.value)} />
          </div>
          <div>
            <Label>Margin per Tonne (₹)</Label>
            <Input type="number" min={0} value={marginPerTonne} onChange={(e) => setMarginPerTonne(e.target.value)} />
          </div>
          {input("costLostProduction", "Total Lost Production")}
        </div>
      </div>

      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-center justify-between">
        <div className="text-sm font-semibold text-emerald-900">Total Cost of Incident</div>
        <div className="text-lg font-bold text-emerald-900 font-mono">
          ₹ {total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save Cost Breakdown"}</Button>
      </div>
    </div>
  );
}
