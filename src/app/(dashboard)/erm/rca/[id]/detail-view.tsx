"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Send, CheckCircle2, Wrench } from "lucide-react";
import { RcaEditor } from "@/components/incidents/rca-editor";
import { useToast } from "@/components/ui/toast";
import { usePermission } from "@/components/auth/can";
import { parseApiError } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Card } from "@/components/ui/card";
import {
  CONTRIB_LABEL, DOMAIN_COLOR, DOMAIN_LABEL, METHOD_LABEL, ORIGIN_LABEL, ROLE_LABEL, STATUS_CHIP,
  type CausalRole, type ContributionType, type RcaDetail, type SubCauseOut,
} from "../lib";

type RiskOpt = { id: string; code: string; title: string };
const TABS = ["Analysis", "Causes", "Linked Risks"] as const;
type Tab = (typeof TABS)[number];

const SIX_METHODS = ["FIVE_WHY", "FISHBONE", "FTA", "BOWTIE", "TAPROOT", "CAUSE_MAP"];

async function call(path: string, method: string, body?: unknown): Promise<void> {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await parseApiError(res));
}

export function RcaWorkspace({ rca, subCauses, riskOptions }: {
  rca: RcaDetail; subCauses: SubCauseOut[]; riskOptions: RiskOpt[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const canEdit = usePermission("RCA.CREATE");
  const canTag = usePermission("RCA.TAG");
  const canApprove = usePermission("RCA.APPROVE");
  const editable = canEdit && ["DRAFT", "IN_ANALYSIS", "PEER_REVIEW"].includes(rca.status);

  const [tab, setTab] = useState<Tab>("Analysis");
  const [busy, setBusy] = useState(false);
  const [payload, setPayload] = useState<Record<string, unknown>>(rca.analysisPayload ?? {});
  const [capaOpen, setCapaOpen] = useState(false);

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast({ title: ok, variant: "success" });
      router.refresh();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message ?? "Request failed", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{rca.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded border px-2 py-0.5 font-medium ${STATUS_CHIP[rca.status]}`}>{rca.status.replace("_", " ")}</span>
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DOMAIN_COLOR[rca.primaryDomain] }} />
                {DOMAIN_LABEL[rca.primaryDomain]}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600">{ORIGIN_LABEL[rca.originType]}-originated · {METHOD_LABEL[rca.methodology]}</span>
              {rca.sourceLabel && (<><span className="text-slate-400">·</span><span className="text-slate-500">{rca.sourceLabel}</span></>)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canTag && (
              <Button type="button" variant="outline" onClick={() => setCapaOpen(true)} disabled={busy} className="gap-1.5">
                <Wrench size={15} /> Raise CAPA
              </Button>
            )}
            {editable && rca.status !== "PEER_REVIEW" && (
              <Button variant="outline" onClick={() => run(() => call(`/api/erm/rca/${rca.id}/submit`, "POST"), "Submitted for peer review")} disabled={busy} className="gap-1.5 rounded-lg px-3 py-2 text-sm"><Send size={15} /> Submit for review</Button>
            )}
            {canApprove && rca.status !== "APPROVED" && (
              <Button type="button" variant="success" onClick={() => run(() => call(`/api/erm/rca/${rca.id}/approve`, "POST", { note: null }), "RCA approved")} disabled={busy} className="gap-1.5">
                <CheckCircle2 size={15} /> Approve
              </Button>
            )}
          </div>
        </div>
        {rca.capaIds.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">{rca.capaIds.length} corrective action(s) raised on the universal CAPA engine.</p>
        )}
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Button
            key={t}
            type="button"
            variant="ghost"
            onClick={() => setTab(t)}
            className={cn(
              "h-auto rounded-none px-3 py-2 text-sm font-medium",
              tab === t ? "border-b-2 border-primary-700 text-primary-700" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t}{t === "Causes" ? ` (${rca.identifiedCauses.length})` : t === "Linked Risks" ? ` (${rca.riskLinks.length})` : ""}
          </Button>
        ))}
      </div>

      {tab === "Analysis" && (
        <div className="space-y-3">
          {rca.methodology === "NARRATIVE" ? (
            <NarrativeEditor value={payload} onChange={setPayload} readOnly={!editable} />
          ) : SIX_METHODS.includes(rca.methodology) ? (
            <RcaEditor method={rca.methodology as any} value={payload} onChange={(v) => setPayload(v as Record<string, unknown>)} readOnly={!editable} />
          ) : (
            <p className="text-sm text-slate-500">This methodology has no structured editor.</p>
          )}
          {rca.narrative && <Card className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 shadow-none"><span className="font-medium">Executive summary:</span> {rca.narrative}</Card>}
          {editable && (
            <Button type="button" onClick={() => run(() => call(`/api/erm/rca/${rca.id}`, "PATCH", { analysisPayload: payload }), "Analysis saved")} disabled={busy}>
              Save analysis
            </Button>
          )}
        </div>
      )}

      {tab === "Causes" && <CausesTab rca={rca} subCauses={subCauses} canTag={canTag} busy={busy} run={run} />}
      {tab === "Linked Risks" && <RisksTab rca={rca} riskOptions={riskOptions} canTag={canTag} busy={busy} run={run} />}

      {capaOpen && <RaiseCapaModal rca={rca} onClose={() => setCapaOpen(false)} onDone={() => { setCapaOpen(false); router.refresh(); }} />}
    </div>
  );
}

function NarrativeEditor({ value, onChange, readOnly }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; readOnly?: boolean }) {
  const summary = (value.summary as string) ?? "";
  const factors = (value.factors as { description: string }[]) ?? [];
  return (
    <Card className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-none">
      <div>
        <Label className="text-xs font-semibold text-slate-600">Causal narrative</Label>
        <Textarea disabled={readOnly} value={summary} onChange={(e) => onChange({ ...value, summary: e.target.value })}
          className="mt-1 min-h-[90px] disabled:bg-slate-50"
          placeholder="The structured story of how the risk materialised / deteriorated…" />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-xs font-semibold text-slate-600">Contributing factors</Label>
          {!readOnly && (
            <Button type="button" variant="ghost" onClick={() => onChange({ ...value, factors: [...factors, { description: "" }] })} className="h-auto gap-1 px-0 py-0 text-xs text-primary-700 hover:bg-transparent hover:text-primary-800">
              <Plus size={13} /> Add factor
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {factors.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input disabled={readOnly} value={f.description}
                onChange={(e) => { const next = [...factors]; next[i] = { description: e.target.value }; onChange({ ...value, factors: next }); }}
                className="flex-1 disabled:bg-slate-50" placeholder={`Factor ${i + 1}`} />
              {!readOnly && (
                <Button type="button" variant="ghost" size="icon" onClick={() => onChange({ ...value, factors: factors.filter((_, j) => j !== i) })} className="h-8 w-8 text-slate-400 hover:text-rose-600">
                  <Trash2 size={15} />
                </Button>
              )}
            </div>
          ))}
          {factors.length === 0 && <p className="text-xs text-slate-400">No factors yet.</p>}
        </div>
      </div>
    </Card>
  );
}

function CausesTab({ rca, subCauses, canTag, busy, run }: any) {
  const [subCauseId, setSubCauseId] = useState("");
  const [role, setRole] = useState<CausalRole>("ROOT");
  const [confidence, setConfidence] = useState("CONFIRMED");
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sub-cause</TableHead>
              <TableHead>Enterprise category</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rca.identifiedCauses.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-400">No causes tagged yet.</TableCell></TableRow>
            ) : rca.identifiedCauses.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-slate-700">{c.subCauseName}</TableCell>
                <TableCell className="text-slate-600"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">{c.categoryCode}</span> {c.categoryName}</TableCell>
                <TableCell className="text-xs">{ROLE_LABEL[c.causalRole as CausalRole]}</TableCell>
                <TableCell className="text-xs text-slate-500">{c.confidence ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {canTag && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => run(() => call(`/api/erm/rca/${rca.id}/causes/${c.id}`, "DELETE"), "Cause removed")} disabled={busy} className="h-8 w-8 text-slate-400 hover:text-rose-600">
                      <Trash2 size={15} />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {canTag && (
        <Card className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-none">
          <div className="min-w-[220px] flex-1">
            <Label className="text-[11px] font-semibold text-slate-500">Sub-cause (scoped to {DOMAIN_LABEL[rca.primaryDomain]})</Label>
            <SelectField
              value={subCauseId}
              onChange={setSubCauseId}
              ariaLabel="Sub-cause"
              className="mt-1"
              placeholder="Select a sub-cause…"
              options={subCauses.map((s: SubCauseOut) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div>
            <Label className="text-[11px] font-semibold text-slate-500">Role</Label>
            <SelectField value={role} onChange={(value) => setRole(value as CausalRole)} className="mt-1"
              options={[
              { value: "ROOT", label: "Root cause" },
              { value: "CONTRIBUTING", label: "Contributing" },
              { value: "DIRECT", label: "Direct/immediate" }
            ]}
            />
          </div>
          <div>
            <Label className="text-[11px] font-semibold text-slate-500">Confidence</Label>
            <SelectField value={confidence} onChange={setConfidence} className="mt-1"
              options={[
              { value: "CONFIRMED", label: "Confirmed" },
              { value: "PROBABLE", label: "Probable" },
              { value: "POSSIBLE", label: "Possible" }
            ]}
            />
          </div>
          <Button
            type="button"
            disabled={!subCauseId || busy}
            onClick={() => run(() => call(`/api/erm/rca/${rca.id}/causes`, "POST", { subCauseId, causalRole: role, confidence }), "Cause tagged").then(() => setSubCauseId(""))}
            className="gap-1.5"
          >
            <Plus size={15} /> Tag cause
          </Button>
        </Card>
      )}
    </div>
  );
}

function RisksTab({ rca, riskOptions, canTag, busy, run }: any) {
  const [riskId, setRiskId] = useState("");
  const [contribution, setContribution] = useState<ContributionType>("CAUSED");
  const [weight, setWeight] = useState("0.6");
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Risk</TableHead>
              <TableHead>Contribution</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rca.riskLinks.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-slate-400">No risks linked yet — one RCA can drive a combination of risks.</TableCell></TableRow>
            ) : rca.riskLinks.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell>
                  <Link href={`/erm/register/${l.riskId}`} className="font-medium text-primary-700 hover:underline">{l.riskCode ?? l.riskId}</Link>
                  <span className="ml-2 text-xs text-slate-500">{l.riskTitle}</span>
                </TableCell>
                <TableCell className="text-xs">{CONTRIB_LABEL[l.contributionType as ContributionType]}</TableCell>
                <TableCell className="text-xs tabular-nums text-slate-500">{l.weight ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {canTag && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => run(() => call(`/api/erm/rca/${rca.id}/links/${l.id}`, "DELETE"), "Link removed")} disabled={busy} className="h-8 w-8 text-slate-400 hover:text-rose-600">
                      <Trash2 size={15} />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {canTag && (
        <Card className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-none">
          <div className="min-w-[240px] flex-1">
            <Label className="text-[11px] font-semibold text-slate-500">Risk this cause contributes to</Label>
            <SelectField
              value={riskId}
              onChange={setRiskId}
              ariaLabel="Risk"
              className="mt-1"
              placeholder="Select a risk…"
              options={riskOptions.map((r: RiskOpt) => ({ value: r.id, label: `${r.code} — ${r.title}` }))}
            />
          </div>
          <div>
            <Label className="text-[11px] font-semibold text-slate-500">Contribution</Label>
            <SelectField value={contribution} onChange={(value) => setContribution(value as ContributionType)} className="mt-1"
              options={[
              { value: "CAUSED", label: "Caused" },
              { value: "ELEVATED", label: "Elevated" },
              { value: "REVEALED", label: "Revealed" },
              { value: "RECURRING_DRIVER", label: "Recurring driver" }
            ]}
            />
          </div>
          <div>
            <Label className="text-[11px] font-semibold text-slate-500">Weight (0–1)</Label>
            <Input value={weight} onChange={(e) => setWeight(e.target.value)} className="mt-1 w-20" />
          </div>
          <Button
            type="button"
            disabled={!riskId || busy}
            onClick={() => run(() => call(`/api/erm/rca/${rca.id}/links`, "POST", { riskId, contributionType: contribution, weight: parseFloat(weight) || null }), "Risk linked").then(() => setRiskId(""))}
            className="gap-1.5"
          >
            <Plus size={15} /> Link risk
          </Button>
        </Card>
      )}
    </div>
  );
}

function RaiseCapaModal({ rca, onClose, onDone }: { rca: RcaDetail; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(`Corrective action — ${rca.title}`);
  const [problem, setProblem] = useState(rca.narrative ?? "");
  const [severity, setSeverity] = useState("MODERATE");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await call(`/api/erm/rca/${rca.id}/capas`, "POST", { title, problem, severity, priority: "HIGH", dueDays: 90 });
      toast({ title: "CAPA raised on the universal engine", variant: "success" });
      onDone();
    } catch (e: any) {
      toast({ title: "Failed to raise CAPA", description: e?.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-[520px] max-w-full rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Raise corrective action</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-700">✕</Button>
        </div>
        <div className="space-y-3 p-4">
          <div><Label className="text-xs font-semibold text-slate-600">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs font-semibold text-slate-600">Problem statement</Label><Textarea value={problem} onChange={(e) => setProblem(e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs font-semibold text-slate-600">Severity</Label>
            <SelectField value={severity} onChange={setSeverity} className="mt-1"
              options={[
              { value: "LOW", label: "Low" },
              { value: "MODERATE", label: "Moderate" },
              { value: "HIGH", label: "High" },
              { value: "CRITICAL", label: "Critical" }
            ]}
            />
          </div>
          <p className="text-xs text-slate-400">Creates a CAPA (sourceType ENTERPRISE_RCA) on the one corrective-action engine — it appears in the CAPA register.</p>
          <Button type="button" onClick={submit} disabled={busy || !title || !problem} className="w-full">{busy ? "Raising…" : "Raise CAPA"}</Button>
        </div>
      </div>
    </div>
  );
}
