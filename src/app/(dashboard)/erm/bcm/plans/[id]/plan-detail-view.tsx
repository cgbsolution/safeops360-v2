"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, CheckCircle2, Pencil, X, Trash2, History } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  CRITICALITY_CHIP,
  PLAN_STATUS_CHIP,
  PLAN_HEALTH_CHIP,
  PLAN_TYPES,
  fmtRto,
  type PlanDetail,
} from "@/app/(dashboard)/erm/lib-p3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

const PLAN_TYPE_LABEL: Record<string, string> = {
  BUSINESS_CONTINUITY: "Business Continuity",
  DISASTER_RECOVERY_IT: "Disaster Recovery (IT)",
  CRISIS_MANAGEMENT: "Crisis Management",
  EMERGENCY_RESPONSE_LINK: "Emergency Response Link",
};

export function PlanDetailView({ detail }: { detail: PlanDetail }) {
  const router = useRouter();
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showSnaps, setShowSnaps] = useState(false);

  async function action(path: string, okMsg: string) {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/erm/bcm/plans/${detail.id}/${path}`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setBanner({ kind: "err", msg: j.detail || j.error || `Failed (${res.status}).` }); setBusy(false); return; }
      setBanner({ kind: "ok", msg: okMsg });
      setBusy(false);
      router.refresh();
    } catch (e: any) { setBanner({ kind: "err", msg: e?.message ?? "Network error." }); setBusy(false); }
  }

  return (
    <div className="space-y-5">
      {banner && (
        <div className={"rounded-lg border px-4 py-2.5 text-sm " + (banner.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800")}>
          {banner.msg}
        </div>
      )}

      {/* Header */}
      <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={"rounded border px-2 py-0.5 text-[11px] " + (PLAN_STATUS_CHIP[detail.status] ?? "")}>{detail.status.replace(/_/g, " ")}</span>
            <span className={"rounded border px-2 py-0.5 text-[11px] " + (PLAN_HEALTH_CHIP[detail.healthChip] ?? "")}>{detail.healthChip}</span>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">{PLAN_TYPE_LABEL[detail.planType] ?? detail.planType} · v{detail.version}</span>
            <span className="text-xs text-slate-500">{detail.siteName ?? "Corporate"} · Owner {detail.ownerName ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)} disabled={busy}>
              <Pencil size={13} /> Edit
            </Button>
            {detail.status === "DRAFT" && (
              <Button type="button" size="sm" onClick={() => action("submit", "Submitted for review.")} disabled={busy}
                className="bg-blue-600 hover:bg-blue-700">
                <Send size={13} /> Submit for review
              </Button>
            )}
            {detail.status === "IN_REVIEW" && (
              <Button type="button" variant="success" size="sm" onClick={() => action("approve", "Plan approved — new version snapshotted.")} disabled={busy}>
                <CheckCircle2 size={13} /> Approve
              </Button>
            )}
          </div>
        </div>

        {detail.status === "APPROVED" && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            Editing an approved plan forks a new <strong>DRAFT</strong> version. The current approved content is preserved in version history.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Covered processes", value: String(detail.coveredProcessCount) },
            { label: "Open exercise CAPAs", value: String(detail.openExerciseCapas) },
            { label: "Next review", value: detail.nextReviewDate ? fmtDate(detail.nextReviewDate) : "—" },
            { label: "Last exercised", value: detail.lastExercisedAt ? fmtDate(detail.lastExercisedAt) : "never" },
          ].map((m) => (
            <Card key={m.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 shadow-none">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{m.label}</p>
              <p className="text-sm font-semibold text-slate-800">{m.value}</p>
            </Card>
          ))}
        </div>
        {detail.approvedBy && (
          <p className="mt-3 text-xs text-slate-500">Approved {detail.approvedAt ? fmtDate(detail.approvedAt) : ""}{detail.fserPlanRef ? ` · FSER ref: ${detail.fserPlanRef}` : ""}</p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Scope + strategy */}
          <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Scope &amp; strategy</h2>
            <p className="text-sm text-slate-600">{detail.scopeStatement || "—"}</p>
            {detail.strategySummary && <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600"><span className="font-medium text-slate-700">Strategy: </span>{detail.strategySummary}</p>}
          </Card>

          {/* Sections */}
          {detail.sections.length > 0 && (
            <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Plan sections</h2>
              <div className="space-y-3">
                {[...detail.sections].sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)).map((s: any, i: number) => (
                  <div key={i} className="border-l-2 border-primary-200 pl-3">
                    <h3 className="text-sm font-semibold text-slate-800">{s.heading}</h3>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600">{s.contentRichText}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recovery tasks */}
          <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Recovery tasks <span className="text-slate-400">({detail.recoveryTasks.length})</span></h2>
            {detail.recoveryTasks.length === 0 ? (
              <p className="py-3 text-center text-sm text-slate-400">No recovery tasks defined.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full min-w-[480px] text-sm">
                  <TableHeader className="bg-slate-50/95">
                    <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <TableHead className="px-3 py-2">#</TableHead>
                      <TableHead className="px-3 py-2">Task</TableHead>
                      <TableHead className="px-3 py-2">Responsible role</TableHead>
                      <TableHead className="px-3 py-2 text-right">Target</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...detail.recoveryTasks].sort((a, b) => a.orderIndex - b.orderIndex).map((t) => (
                      <TableRow key={t.id} className="border-t border-slate-100 align-top">
                        <TableCell className="px-3 py-2 text-xs tabular-nums text-slate-400">{t.orderIndex + 1}</TableCell>
                        <TableCell className="px-3 py-2 text-slate-700">{t.title}{t.detail && <span className="block text-[11px] text-slate-400">{t.detail}</span>}</TableCell>
                        <TableCell className="px-3 py-2 text-xs text-slate-600">{t.responsibleRoleName}</TableCell>
                        <TableCell className="px-3 py-2 text-right text-xs tabular-nums text-slate-600">{fmtRto(t.targetHoursFromActivation)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {/* Activation criteria */}
          <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Activation criteria</h2>
            {detail.activationCriteria.length === 0 ? (
              <p className="text-sm text-slate-400">—</p>
            ) : (
              <ul className="space-y-1.5">
                {detail.activationCriteria.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" /> {c}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Covered processes */}
          <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Covered processes</h2>
            {detail.coveredProcesses.length === 0 ? (
              <p className="text-sm text-slate-400">None linked.</p>
            ) : (
              <ul className="space-y-2">
                {detail.coveredProcesses.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <Link href={`/erm/bcm/processes/${p.id}`} className="truncate text-sm font-medium text-primary-700 hover:underline">{p.processCode} · {p.name}</Link>
                    <span className={"shrink-0 rounded border px-1.5 py-0.5 text-[10px] " + (CRITICALITY_CHIP[p.criticality] ?? "")}>{p.criticality}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Version history */}
          {detail.versionSnapshots.length > 0 && (
            <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
              <Button type="button" variant="ghost" onClick={() => setShowSnaps((v) => !v)} className="h-auto w-full justify-between p-0 text-sm font-semibold text-slate-900">
                <span className="inline-flex items-center gap-1.5"><History size={14} /> Version history ({detail.versionSnapshots.length})</span>
                <span className="text-xs text-slate-400">{showSnaps ? "Hide" : "Show"}</span>
              </Button>
              {showSnaps && (
                <ul className="mt-3 space-y-2">
                  {detail.versionSnapshots.map((s: any, i: number) => (
                    <li key={i} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">v{s.version}</span>
                      {s.snapshotAt && <span className="text-slate-400"> · snapshotted {fmtDate(s.snapshotAt)}</span>}
                      {Array.isArray(s.sections) && <span className="block text-[11px] text-slate-400">{s.sections.length} section(s)</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>

      {editOpen && <EditPlanModal detail={detail} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); router.refresh(); }} />}
    </div>
  );
}

// ── Edit plan modal (PATCH; editing an APPROVED plan forks a DRAFT) ───────────
type PlantOption = { id: string; name: string };
type ProcOption = { id: string; processCode: string; name: string };
type Section = { heading: string; contentRichText: string };
type RTask = { title: string; responsibleRoleName: string; targetHoursFromActivation: string; detail: string };

function EditPlanModal({ detail, onClose, onSaved }: { detail: PlanDetail; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(detail.title);
  const [planType, setPlanType] = useState(detail.planType);
  const [siteId, setSiteId] = useState(detail.siteId ?? "");
  const [ownerId, setOwnerId] = useState<string | null>(detail.ownerId);
  const [coveredProcessIds, setCoveredProcessIds] = useState<string[]>(detail.coveredProcesses.map((p) => p.id));
  const [scopeStatement, setScopeStatement] = useState(detail.scopeStatement);
  const [criteriaText, setCriteriaText] = useState(detail.activationCriteria.join("\n"));
  const [strategySummary, setStrategySummary] = useState(detail.strategySummary);
  const [fserPlanRef, setFserPlanRef] = useState(detail.fserPlanRef ?? "");
  const [sections, setSections] = useState<Section[]>(
    detail.sections.length ? detail.sections.map((s: any) => ({ heading: s.heading ?? "", contentRichText: s.contentRichText ?? "" })) : [{ heading: "", contentRichText: "" }],
  );
  const [tasks, setTasks] = useState<RTask[]>(
    detail.recoveryTasks.length
      ? [...detail.recoveryTasks].sort((a, b) => a.orderIndex - b.orderIndex).map((t) => ({ title: t.title, responsibleRoleName: t.responsibleRoleName, targetHoursFromActivation: String(t.targetHoursFromActivation), detail: t.detail ?? "" }))
      : [{ title: "", responsibleRoleName: "", targetHoursFromActivation: "", detail: "" }],
  );
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [procs, setProcs] = useState<ProcOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/plants").then((r) => (r.ok ? r.json() : [])).then((d) => { if (!cancelled) setPlants((d?.items ?? d ?? []).map((p: any) => ({ id: p.id, name: p.name }))); }).catch(() => {});
    fetch("/api/erm/bcm/processes").then((r) => (r.ok ? r.json() : { items: [] })).then((d) => { if (!cancelled) setProcs((d?.items ?? d ?? []).map((p: any) => ({ id: p.id, processCode: p.processCode, name: p.name }))); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function toggleProc(id: string) {
    setCoveredProcessIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const activationCriteria = criteriaText.split("\n").map((s) => s.trim()).filter(Boolean);
    const cleanSections = sections.filter((s) => s.heading.trim()).map((s, i) => ({ orderIndex: i, heading: s.heading.trim(), contentRichText: s.contentRichText, attachments: [] }));
    const cleanTasks = tasks.filter((t) => t.title.trim() && t.responsibleRoleName.trim()).map((t, i) => ({
      orderIndex: i, title: t.title.trim(), detail: t.detail.trim() || null,
      responsibleRoleName: t.responsibleRoleName.trim(), targetHoursFromActivation: Number(t.targetHoursFromActivation) || 0,
    }));
    try {
      const res = await fetch(`/api/erm/bcm/plans/${detail.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), planType, siteId: siteId || null, ownerId,
          coveredProcessIds, scopeStatement: scopeStatement.trim(), activationCriteria,
          sections: cleanSections, strategySummary: strategySummary.trim(),
          fserPlanRef: fserPlanRef.trim() || null, recoveryTasks: cleanTasks,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.detail || j.error || `Failed (${res.status}).`); setBusy(false); return; }
      onSaved();
    } catch (e: any) { setError(e?.message ?? "Network error."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Edit plan {detail.status === "APPROVED" && <span className="text-xs font-normal text-amber-600">(saving forks a new draft)</span>}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></Button>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Plan title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Type</Label>
              <SelectField value={planType} onChange={setPlanType}
                options={PLAN_TYPES.map((t) => ({ value: t, label: PLAN_TYPE_LABEL[t] ?? t }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Site</Label>
              <SelectField value={siteId} onChange={setSiteId}
                placeholder="Corporate"
                options={plants.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Owner</Label>
              <UserPicker value={ownerId} onChange={(id) => setOwnerId(id)} placeholder="Owner" />
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Covered processes</Label>
            <Card className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2 shadow-none">
              {procs.map((p) => (
                <Label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50">
                  <Checkbox checked={coveredProcessIds.includes(p.id)} onChange={() => toggleProc(p.id)} />
                  <span className="font-medium text-primary-700">{p.processCode}</span>
                  <span className="truncate text-slate-600">{p.name}</span>
                </Label>
              ))}
            </Card>
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Scope statement</Label>
            <Textarea value={scopeStatement} onChange={(e) => setScopeStatement(e.target.value)} rows={2} />
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Activation criteria (one per line)</Label>
            <Textarea value={criteriaText} onChange={(e) => setCriteriaText(e.target.value)} rows={3} />
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Strategy summary</Label>
            <Textarea value={strategySummary} onChange={(e) => setStrategySummary(e.target.value)} rows={2} />
          </div>
          {planType === "EMERGENCY_RESPONSE_LINK" && (
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">FSER plan reference</Label>
              <Input value={fserPlanRef} onChange={(e) => setFserPlanRef(e.target.value)} />
            </div>
          )}
          {/* Sections */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-600">Plan sections</Label>
              <Button type="button" variant="ghost" onClick={() => setSections((s) => [...s, { heading: "", contentRichText: "" }])} className="h-auto p-0 text-xs font-medium text-primary-700 hover:underline">+ Section</Button>
            </div>
            <div className="space-y-2">
              {sections.map((s, i) => (
                <Card key={i} className="rounded-md border border-slate-200 p-2 shadow-none">
                  <div className="flex items-center gap-2">
                    <Input value={s.heading} onChange={(e) => setSections((arr) => arr.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)))} placeholder="Heading" className="flex-1" />
                    {sections.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setSections((arr) => arr.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-600"><Trash2 size={14} /></Button>}
                  </div>
                  <Textarea value={s.contentRichText} onChange={(e) => setSections((arr) => arr.map((x, j) => (j === i ? { ...x, contentRichText: e.target.value } : x)))} rows={2} placeholder="Content" className="mt-1" />
                </Card>
              ))}
            </div>
          </div>
          {/* Recovery tasks */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-600">Recovery tasks</Label>
              <Button type="button" variant="ghost" onClick={() => setTasks((t) => [...t, { title: "", responsibleRoleName: "", targetHoursFromActivation: "", detail: "" }])} className="h-auto p-0 text-xs font-medium text-primary-700 hover:underline">+ Task</Button>
            </div>
            <div className="space-y-2">
              {tasks.map((t, i) => (
                <Card key={i} className="flex items-center gap-2 rounded-md border border-slate-200 p-2 shadow-none">
                  <Input value={t.title} onChange={(e) => setTasks((arr) => arr.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Task" className="flex-[2]" />
                  <Input value={t.responsibleRoleName} onChange={(e) => setTasks((arr) => arr.map((x, j) => (j === i ? { ...x, responsibleRoleName: e.target.value } : x)))} placeholder="Responsible role" className="flex-[2]" />
                  <Input type="number" min={0} value={t.targetHoursFromActivation} onChange={(e) => setTasks((arr) => arr.map((x, j) => (j === i ? { ...x, targetHoursFromActivation: e.target.value } : x)))} placeholder="h" className="w-16" />
                  {tasks.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setTasks((arr) => arr.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-600"><Trash2 size={14} /></Button>}
                </Card>
              ))}
            </div>
          </div>
          {error && <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</Alert>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy || title.trim().length < 3}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
