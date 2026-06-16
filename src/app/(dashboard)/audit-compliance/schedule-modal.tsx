"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Layers, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { AuditLibrary, AuditTemplate, PlantUser } from "./lib";

export function ScheduleModal({
  plantId, templates, libraries, users, onClose,
}: {
  plantId: string | null;
  templates: AuditTemplate[];
  libraries: AuditLibrary[];
  users: PlantUser[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const orderedLibs = useMemo(() => {
    const g = libraries.filter((l) => l.industryCode === "GARMENTS_TEXTILE");
    const rest = libraries.filter((l) => l.industryCode !== "GARMENTS_TEXTILE");
    return [...g, ...rest];
  }, [libraries]);

  const [title, setTitle] = useState("");
  const [industryCode, setIndustryCode] = useState(orderedLibs[0]?.industryCode ?? "");
  const [templateId, setTemplateId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(() => new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
  const [leadAuditorUserId, setLead] = useState(users[0]?.id ?? "");
  const [plantManagerUserId, setPM] = useState("");
  const [touched, setTouched] = useState(false);

  const library = orderedLibs.find((l) => l.industryCode === industryCode);
  const industryTemplates = useMemo(() => templates.filter((t) => t.baseIndustry === industryCode), [templates, industryCode]);
  useEffect(() => { setTemplateId(""); }, [industryCode]);

  const template = industryTemplates.find((t) => t.id === templateId);
  const checkpointCount = useMemo(() => {
    if (template) {
      const cfg = template.checkpointConfiguration ?? {};
      if (cfg.mode === "subset" && Array.isArray(cfg.codes)) return cfg.codes.length;
    }
    return library?.checkpointCount ?? 0;
  }, [template, library]);

  // Field-level validation
  const titleError = title.trim().length < 4 ? "Title must be at least 4 characters." : null;
  const industryError = !industryCode || !library ? "Pick an industry." : null;
  const leadError = !leadAuditorUserId ? "Pick a lead auditor." : null;
  const firstError = titleError ?? industryError ?? leadError;

  async function submit() {
    setTouched(true);
    if (!plantId) { toast({ variant: "error", title: "No plant selected", description: "Select a plant before scheduling an audit." }); return; }
    if (firstError) { toast({ variant: "error", title: "Missing required fields", description: firstError }); return; }

    // Auditees are assigned per discipline by the Plant Head after the auditor
    // submits — so none are set at scheduling time.
    setBusy(true);
    const res = await fetch("/api/audit-compliance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        plantId, title, industryCode, templateId: templateId || null,
        auditType: template?.auditType ?? "integrated_compliance_audit",
        scheduledDate: new Date(scheduledDate + "T09:00:00").toISOString(),
        scheduledStartTime: "09:00", estimatedDurationHours: 4,
        leadAuditorUserId, plantManagerUserId: plantManagerUserId || null,
        auditees: [], scopeDescription: `${library!.industryName} compliance audit`,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Couldn't schedule audit", description: j.detail || j.error || "Please try again." });
      return;
    }
    const created = await res.json();
    toast({ variant: "success", title: "Audit scheduled", description: `${created.auditNumber} — ${created.totalCheckpoints} checkpoints materialized.` });
    startTransition(() => {
      onClose();
      router.push(`/audit-compliance/${created.id}`);
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl gap-3 p-0">
        <DialogHeader className="border-b px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList size={18} className="text-primary-700" /> Schedule Audit
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[68vh] space-y-3 overflow-y-auto px-5 py-1">
          <Field label="Audit title" required error={touched ? titleError : null}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 Integrated SA8000 + ISO 45001 Audit" aria-invalid={!!(touched && titleError)} />
          </Field>

          {/* Industry switcher */}
          <Field label="Industry" required error={touched ? industryError : null}>
            <div className="flex flex-wrap gap-1.5">
              {orderedLibs.map((l) => {
                const on = l.industryCode === industryCode;
                return (
                  <Button key={l.industryCode} type="button" size="sm" variant={on ? "default" : "outline"} onClick={() => setIndustryCode(l.industryCode)} className="rounded-full">
                    {l.industryName.split(",")[0].split("&")[0].trim()}
                    <Badge className={cn("ml-1 border-0 px-1.5 py-0", on ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500")}>{l.checkpointCount}</Badge>
                  </Button>
                );
              })}
            </div>
          </Field>

          {/* Live checkpoint preview — the "instant swap" moment */}
          {library && (
            <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary-900"><Layers size={15} /> {library.industryName}</div>
                <div className="text-right">
                  <div className="text-lg font-extrabold leading-none text-primary-800">{checkpointCount}</div>
                  <div className="text-[10px] uppercase tracking-wide text-primary-500">checkpoints · {library.categories.length} categories</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {library.categories.map((c) => (
                  <Badge key={c.category_code} className="border-slate-200 bg-white font-medium text-slate-600">
                    <span className="size-2 rounded-full" style={{ backgroundColor: c.category_color }} />
                    {c.category_name} <span className="text-slate-400">{c.checkpointCount}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Scope preset */}
          {industryTemplates.length > 0 && (
            <Field label="Scope preset">
              <div className="space-y-1">
                <PresetRow active={templateId === ""} onClick={() => setTemplateId("")} name={`Full library — all ${library?.checkpointCount ?? 0} checkpoints`} desc="Every category in this industry" />
                {industryTemplates.map((t) => {
                  const cfg = t.checkpointConfiguration ?? {};
                  const n = cfg.mode === "subset" && Array.isArray(cfg.codes) ? cfg.codes.length : library?.checkpointCount ?? 0;
                  return <PresetRow key={t.id} active={templateId === t.id} onClick={() => setTemplateId(t.id)} name={`${t.name} — ${n} checkpoints`} desc={t.description} />;
                })}
              </div>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Scheduled date" required><Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} /></Field>
            <Field label="Lead auditor" required error={touched ? leadError : null}>
              <Select value={leadAuditorUserId} onChange={(e) => setLead(e.target.value)} aria-invalid={!!(touched && leadError)}>
                <option value="">— select —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Plant Head (assigns auditees, gives final acceptance)">
            <Select value={plantManagerUserId} onChange={(e) => setPM(e.target.value)}>
              <option value="">— none —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, " ")})</option>)}
            </Select>
          </Field>

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            After the auditor submits, the Plant Head assigns a responsible auditee to each discipline with findings, then dispatches. Auditees are not selected here.
          </p>
        </div>

        <DialogFooter className="items-center justify-between gap-2 border-t px-5 py-3 sm:justify-between">
          <span className="text-xs text-slate-500">Will materialize <span className="font-semibold text-slate-700">{checkpointCount}</span> checkpoints</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="button" size="sm" onClick={submit} disabled={busy}>{busy ? "Scheduling…" : "Schedule & Materialize"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</Label>
      {children}
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}

function PresetRow({ active, onClick, name, desc }: { active: boolean; onClick: () => void; name: string; desc?: string }) {
  return (
    <Button type="button" variant="outline" onClick={onClick} className={cn("h-auto w-full justify-start gap-2 py-2 text-left", active && "border-primary-500 bg-primary-50")}>
      <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", active ? "border-primary-600 bg-primary-600 text-white" : "border-slate-300")}>{active && <Check size={11} />}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-slate-800">{name}</span>
        {desc && <span className="block truncate text-[11px] font-normal text-slate-500">{desc}</span>}
      </span>
    </Button>
  );
}
