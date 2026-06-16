"use client";

// ──────────────────────────────────────────────────────────────────────
// THE SHOWPIECE — on-site conduct UI for 100+ checkpoints with minimum scroll.
// Section navigator (category pills) + one-checkpoint-at-a-time card + auto
// partial-save (every response persisted immediately → close & resume at the
// exact checkpoint). Mobile-first; thumb-friendly Pass/Partial/Fail/NA targets.
// ──────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Check, Camera, AlertTriangle, Link2, Loader2,
  CheckCircle2, X, ArrowLeft, Trash2, ListPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { AuditDetail, CheckpointResponse, AuditValue, CRITICALITY_CHIP, VALUE_META } from "../../lib";
import { uploadAuditPhoto, deleteAuditPhoto } from "../../upload-photo";

type Resp = CheckpointResponse;

export function ConductScreen({ audit }: { audit: AuditDetail }) {
  const router = useRouter();
  const { toast } = useToast();

  // Ordered flat list (by sequence → category-grouped) + local mutable state.
  const ordered = useMemo(() => [...audit.responses].sort((a, b) => a.sequence - b.sequence), [audit.responses]);
  const [resp, setResp] = useState<Resp[]>(ordered);
  const [idx, setIdx] = useState(0);
  const [savingCodes, setSavingCodes] = useState<Set<string>>(new Set());
  const [savedTick, setSavedTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  // Resume at the first unanswered checkpoint on mount.
  useEffect(() => {
    const firstUnanswered = ordered.findIndex((r) => !r.auditorResponse?.value);
    setIdx(firstUnanswered === -1 ? 0 : firstUnanswered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = resp[idx];

  // Sections (contiguous categories in sequence order).
  const sections = useMemo(() => {
    const out: { categoryId: string; name: string; color: string; startIdx: number; total: number; answered: number; failed: number }[] = [];
    resp.forEach((r, i) => {
      let s = out.find((x) => x.categoryId === r.categoryId);
      if (!s) { s = { categoryId: r.categoryId, name: r.categoryName, color: r.categoryColor || "#6d28d9", startIdx: i, total: 0, answered: 0, failed: 0 }; out.push(s); }
      s.total += 1;
      const v = r.auditorResponse?.value;
      if (v) s.answered += 1;
      if (v === "fail") s.failed += 1;
    });
    return out;
  }, [resp]);

  const answeredCount = resp.filter((r) => r.auditorResponse?.value).length;
  const pct = resp.length ? Math.round((answeredCount / resp.length) * 100) : 0;
  const allAnswered = answeredCount === resp.length;

  const save = useCallback(
    async (code: string, patch: Partial<NonNullable<Resp["auditorResponse"]>>) => {
      // Optimistic local merge.
      setResp((prev) =>
        prev.map((r) => (r.checkpointCode === code ? { ...r, auditorResponse: { value: r.auditorResponse?.value ?? null, ...r.auditorResponse, ...patch, is_saved: false } } : r)),
      );
      setSavingCodes((prev) => new Set(prev).add(code));
      // Send ONLY the changed fields — the backend merges (exclude_unset), so an
      // observation-only save never overwrites a previously-saved value.
      const body: Record<string, unknown> = { checkpointCode: code };
      if ("value" in patch) body.value = patch.value;
      if ("text_observation" in patch) body.textObservation = patch.text_observation;
      if ("auditor_notes" in patch) body.auditorNotes = patch.auditor_notes;
      if ("photos" in patch) body.photos = patch.photos;
      const doPost = () => fetch(`/api/audit-compliance/${audit.id}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      try {
        // Retry once on a transient blip (network drop or 5xx from the DB pooler).
        let r = await doPost();
        if (!r || r.status >= 500) {
          await new Promise((res) => setTimeout(res, 500));
          r = await doPost();
        }
        if (!r) {
          toast({ variant: "error", title: "Network error", description: "Your last change wasn't saved — check your connection." });
          return;
        }
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          toast({ variant: "error", title: "Couldn't save response", description: j.detail ?? `Error ${r.status}` });
          return;
        }
        setResp((prev) => prev.map((x) => (x.checkpointCode === code ? { ...x, auditorResponse: { ...x.auditorResponse!, is_saved: true } } : x)));
        setSavedTick((t) => t + 1);
      } finally {
        setSavingCodes((prev) => { const n = new Set(prev); n.delete(code); return n; });
      }
    },
    [audit.id, toast],
  );

  function setValue(v: AuditValue) {
    if (!current) return;
    // Toggle off if tapping the same value again; otherwise set it.
    save(current.checkpointCode, { value: current.auditorResponse?.value === v ? null : v });
    // No auto-advance — the auditor moves on with Next / Previous or the section pills.
  }

  // Debounced observation save.
  const obsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function setObservation(text: string) {
    if (!current) return;
    setResp((prev) => prev.map((r) => (r.checkpointCode === current.checkpointCode ? { ...r, auditorResponse: { value: r.auditorResponse?.value ?? null, ...r.auditorResponse, text_observation: text } } : r)));
    if (obsTimer.current) clearTimeout(obsTimer.current);
    obsTimer.current = setTimeout(() => save(current.checkpointCode, { text_observation: text }), 700);
  }

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file || !current) return;
    setPhotoErr(null);
    setUploading(true);
    const res = await uploadAuditPhoto(file, { auditId: audit.id, checkpointCode: current.checkpointCode });
    setUploading(false);
    if (!res.ok) { setPhotoErr(res.error); toast({ variant: "error", title: "Photo upload failed", description: res.error }); return; }
    const photos = [...(current.auditorResponse?.photos ?? []), res.photo];
    save(current.checkpointCode, { photos });
    toast({ variant: "success", title: "Photo uploaded" });
  }

  function removePhoto(i: number) {
    if (!current) return;
    const photos = current.auditorResponse?.photos ?? [];
    const removed = photos[i];
    save(current.checkpointCode, { photos: photos.filter((_, idx) => idx !== i) });
    void deleteAuditPhoto(removed?.storagePath);
    toast({ variant: "success", title: "Photo removed", description: "Add a new one to replace it." });
  }

  async function doSubmit() {
    setSubmitting(true);
    const res = await fetch(`/api/audit-compliance/${audit.id}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const j = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.ok) {
      const caps = j.capasSpawned ?? 0;
      toast({
        variant: "success",
        title: "Audit submitted",
        description: `Overall compliance ${j.score?.overall_score_pct ?? "—"}%. Findings routed to auditees${caps ? ` · ${caps} CAPA${caps > 1 ? "s" : ""} auto-raised` : ""}.`,
      });
      router.push(`/audit-compliance/${audit.id}`);
      router.refresh();
    } else {
      setShowSubmit(false);
      toast({ variant: "error", title: "Couldn't submit audit", description: j.detail ?? "Please try again." });
    }
  }

  if (!current) return <div className="p-8 text-sm text-slate-500">No checkpoints.</div>;

  const cval = current.auditorResponse?.value ?? null;
  const photoCount = current.auditorResponse?.photos?.length ?? 0;
  const needsPhoto = current.requiresPhotoOnFail && cval === "fail" && photoCount === 0;

  return (
    <div className="mx-auto max-w-2xl pb-28">
      {/* Header + progress */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-t-xl">
        <div className="flex items-center gap-2">
          <Link href={`/audit-compliance/${audit.id}`} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><ArrowLeft size={18} /></Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-800">{audit.title}</div>
            <div className="text-[11px] text-slate-400">{audit.auditNumber}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold tabular-nums text-violet-700">{pct}%</div>
            <div className="text-[11px] tabular-nums text-slate-400">{answeredCount}/{resp.length}</div>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        {/* Section navigator (horizontal scroll) */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {sections.map((s) => {
            const active = current.categoryId === s.categoryId;
            const done = s.answered === s.total;
            return (
              <button
                key={s.categoryId}
                onClick={() => setIdx(s.startIdx)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                  active ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
                style={active ? { backgroundColor: s.color } : undefined}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: active ? "rgba(255,255,255,.9)" : s.color }} />
                <span className="max-w-[110px] truncate">{s.name}</span>
                {s.failed > 0 ? (
                  <span className={cn("rounded-full px-1 text-[10px] font-bold", active ? "bg-white/25" : "bg-rose-100 text-rose-700")}>{s.failed}</span>
                ) : done ? (
                  <Check size={12} className={active ? "text-white" : "text-emerald-600"} />
                ) : (
                  <span className={cn("text-[10px]", active ? "text-white/80" : "text-slate-400")}>{s.answered}/{s.total}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Checkpoint card */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{current.checkpointCode}</span>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", CRITICALITY_CHIP[current.criticality])}>
            {current.criticality === "critical" && <AlertTriangle size={11} />} {current.criticality}
          </span>
          <span className="ml-auto text-[11px] text-slate-400">{idx + 1} of {resp.length}</span>
        </div>

        <h2 className="text-base font-semibold leading-snug text-slate-900">{current.checkpointQuestion}</h2>

        {current.guidance && (
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600"><span className="font-medium text-slate-500">Guidance: </span>{current.guidance}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
          {current.requirementReference && <span>📋 {current.requirementReference}</span>}
          {current.standard && <span>· {current.standard}</span>}
          {current.linkedSafeopsModule && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-sky-700"><Link2 size={11} /> evidence: {current.linkedSafeopsModule}</span>
          )}
        </div>

        {/* Response controls — 4 large tap targets */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {(["pass", "partial", "fail", "na"] as const).map((v) => {
            const meta = VALUE_META[v];
            const on = cval === v;
            return (
              <Button
                key={v}
                type="button"
                variant="outline"
                onClick={() => setValue(v)}
                className={cn(
                  "h-auto flex-col gap-1 rounded-xl border-2 py-3 text-xs font-semibold",
                  on
                    ? v === "pass" ? "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                      : v === "partial" ? "border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-50"
                        : v === "fail" ? "border-rose-500 bg-rose-50 text-rose-700 hover:bg-rose-50"
                          : "border-slate-400 bg-slate-100 text-slate-600 hover:bg-slate-100"
                    : "border-slate-200 text-slate-500",
                )}
              >
                <span className={cn("flex size-6 items-center justify-center rounded-full text-white", on ? meta.dot : "bg-slate-200")}>
                  {v === "pass" ? <Check size={14} /> : v === "fail" ? <X size={14} /> : v === "partial" ? "~" : "–"}
                </span>
                {meta.label}
              </Button>
            );
          })}
        </div>

        {/* Observation */}
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-slate-600">Observation {cval === "fail" && <span className="text-rose-500">*</span>}</label>
          <Textarea
            value={current.auditorResponse?.text_observation ?? ""}
            onChange={(e) => setObservation(e.target.value)}
            rows={2}
            placeholder="What did you observe?"
            className="min-h-[60px]"
          />
        </div>

        {/* Photo */}
        <div className="mt-3">
          {(current.auditorResponse?.photos?.length ?? 0) > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {current.auditorResponse!.photos!.map((p, i) => (
                <div key={i} className="relative size-16 overflow-hidden rounded-lg border border-slate-200">
                  <a href={p.url} target="_blank" rel="noreferrer" className="block size-full hover:ring-2 hover:ring-violet-300">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption || `photo ${i + 1}`} className="size-full object-cover" />
                  </a>
                  <button type="button" onClick={() => removePhoto(i)} title="Remove / replace photo"
                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-rose-600 text-white shadow ring-1 ring-white hover:bg-rose-700">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoSelected} />
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className={cn(needsPhoto && "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100")}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} {uploading ? "Uploading…" : "Add photo"}
            </Button>
            {photoCount > 0 && <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={13} /> {photoCount} photo{photoCount > 1 ? "s" : ""}</span>}
            {needsPhoto && <span className="text-[11px] text-rose-600">Photo required for a critical/major fail</span>}
            <span className="ml-auto text-[11px] text-slate-400">
              {savingCodes.has(current.checkpointCode) ? <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> saving…</span>
                : current.auditorResponse?.is_saved ? <span className="inline-flex items-center gap-1 text-emerald-600"><Check size={12} /> saved</span> : null}
            </span>
          </div>
          {photoErr && <div className="mt-1 text-[11px] text-rose-600">{photoErr}</div>}
        </div>
      </div>

      {/* Prev / Next */}
      <div className="mt-4 flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          <ChevronLeft size={16} /> Previous
        </Button>
        <span className="text-xs text-slate-400">{current.categoryName}</span>
        {idx < resp.length - 1 ? (
          <Button type="button" size="sm" onClick={() => setIdx((i) => Math.min(resp.length - 1, i + 1))}>
            Next <ChevronRight size={16} />
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => setShowSubmit(true)}>Review & Submit</Button>
        )}
      </div>

      {/* Sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{answeredCount}</span>/{resp.length} answered · {resp.length - answeredCount} remaining
            {savedTick > 0 && <span className="ml-2 text-emerald-600">· auto-saved</span>}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowCustom(true)}><ListPlus size={15} /> Add checkpoint</Button>
          <Button type="button" onClick={() => setShowSubmit(true)}>Submit Audit</Button>
        </div>
      </div>

      <CustomCheckpointDialog
        open={showCustom}
        onOpenChange={setShowCustom}
        auditId={audit.id}
        categories={sections.map((s) => ({ id: s.categoryId, name: s.name, color: s.color }))}
        onAdded={() => { setShowCustom(false); router.refresh(); }}
      />

      <Dialog open={showSubmit} onOpenChange={setShowSubmit}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Submit audit?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {allAnswered ? "All checkpoints answered." : `${resp.length - answeredCount} checkpoint(s) are unanswered and will be marked not assessed.`}
            {" "}Failed and partial checkpoints become findings routed to the Plant Head for auditee assignment; critical failures auto-spawn CAPA.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowSubmit(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={doSubmit} disabled={submitting}>
              {submitting && <Loader2 size={14} className="animate-spin" />} Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomCheckpointDialog({ open, onOpenChange, auditId, categories, onAdded }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  auditId: string;
  categories: { id: string; name: string; color: string }[];
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const CUSTOM = { id: "CUSTOM", name: "Custom checkpoints", color: "#6d28d9" };
  const opts = categories.some((c) => c.id === CUSTOM.id) ? categories : [...categories, CUSTOM];
  const [categoryId, setCategoryId] = useState(CUSTOM.id);
  const [question, setQuestion] = useState("");
  const [guidance, setGuidance] = useState("");
  const [criticality, setCriticality] = useState("major");
  const [requiresPhotoOnFail, setReqPhoto] = useState(false);
  const [autoCapa, setAutoCapa] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (question.trim().length < 4) {
      toast({ variant: "error", title: "Question required", description: "Enter at least 4 characters." });
      return;
    }
    const cat = opts.find((c) => c.id === categoryId) ?? CUSTOM;
    setBusy(true);
    const res = await fetch(`/api/audit-compliance/${auditId}/custom-checkpoint`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        categoryId: cat.id, categoryName: cat.name, categoryColor: cat.color,
        checkpointQuestion: question, guidance, criticality,
        requiresPhotoOnFail, autoTriggerCapaOnFail: autoCapa,
        capaSeverity: autoCapa ? criticality : null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      toast({ variant: "success", title: "Checkpoint added", description: "It's been added to this audit." });
      setQuestion(""); setGuidance(""); setCriticality("major"); setReqPhoto(false); setAutoCapa(false);
      onAdded();
    } else {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Couldn't add checkpoint", description: j.detail ?? "Please try again." });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-base">Add custom checkpoint</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Question <span className="text-rose-500">*</span></label>
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} placeholder="What should be checked?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Discipline / category</label>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {opts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Criticality</label>
              <Select value={criticality} onChange={(e) => setCriticality(e.target.value)}>
                <option value="critical">Critical</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
                <option value="informational">Informational</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Guidance (optional)</label>
            <Input value={guidance} onChange={(e) => setGuidance(e.target.value)} placeholder="How to assess this checkpoint…" />
          </div>
          <div className="flex flex-col gap-1.5 text-sm text-slate-700">
            <label className="flex items-center gap-2"><input type="checkbox" checked={requiresPhotoOnFail} onChange={(e) => setReqPhoto(e.target.checked)} className="size-4" /> Require a photo on fail</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={autoCapa} onChange={(e) => setAutoCapa(e.target.checked)} className="size-4" /> Auto-raise a CAPA on fail</label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" size="sm" onClick={submit} disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />} Add checkpoint</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
