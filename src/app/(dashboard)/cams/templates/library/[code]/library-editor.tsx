"use client";

// ──────────────────────────────────────────────────────────────────────
// Editable checkpoint library.
//
// The library was authored by bulk JSON import and, after that, was read-only:
// changing one question meant re-pasting the entire document, which is both
// laborious and lossy — it discards every edit anyone else made since the copy
// was taken. These are surgical edits, one checkpoint at a time.
//
// THE SEMANTIC THAT MATTERS, stated on screen and not just in the code: editing
// the library does not change an audit already materialised from it. Every
// audit snapshots its own checkpoint rows at creation, precisely so a wording
// change in November cannot restate what an auditor assessed in March. Edits
// reach the next audit scheduled.
//
// Rows expand to edit rather than opening a modal: an editor is for scanning a
// long list and fixing a few lines, and a dialog per row would hide the list
// you are working through.
// ──────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown, ChevronRight, Loader2, Plus, Trash2, Search, Save, X,
  AlertTriangle, Info, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Can } from "@/components/auth/can";
import {
  apiErrorMessage, REQUIREMENT_TYPE_META, CRITICALITY_CHIP, CRITICALITY_FALLBACK,
  type RequirementType,
} from "../../../audits/lib";

export type LibraryCheckpoint = {
  code: string;
  question: string;
  guidance?: string;
  requirement_reference?: string;
  standard?: string;
  criticality: string;
  requirement_type?: RequirementType | null;
  requires_photo_on_fail?: boolean;
  auto_trigger_capa_on_fail?: boolean;
  linked_safeops_module?: string | null;
};
export type LibraryCategory = {
  category_code: string;
  category_name: string;
  category_color?: string;
  checkpoints: LibraryCheckpoint[];
};
export type LibraryDetail = {
  industryCode: string;
  industryName: string;
  version: string;
  checkpointCount: number;
  categories: LibraryCategory[];
};

const CRITICALITIES = ["critical", "major", "minor", "informational"] as const;
const REQ_TYPES: RequirementType[] = ["STATUTORY_REGULATORY", "INTERNAL_REQUIREMENT"];

export function LibraryEditor({ library }: { library: LibraryDetail }) {
  const router = useRouter();
  const { toast } = useToast();
  const code = library.industryCode;

  const [q, setQ] = useState("");
  const [openDiscipline, setOpenDiscipline] = useState<string | null>(
    library.categories?.[0]?.category_code ?? null,
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LibraryCheckpoint | null>(null);
  const [busy, setBusy] = useState(false);

  const needle = q.trim().toLowerCase();
  const categories = useMemo(() => {
    if (!needle) return library.categories ?? [];
    return (library.categories ?? [])
      .map((c) => ({
        ...c,
        checkpoints: c.checkpoints.filter(
          (cp) =>
            cp.question.toLowerCase().includes(needle) ||
            cp.code.toLowerCase().includes(needle),
        ),
      }))
      .filter((c) => c.checkpoints.length > 0);
  }, [library.categories, needle]);

  const matched = categories.reduce((s, c) => s + c.checkpoints.length, 0);

  async function call(path: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(`/api/audit-compliance/library/${encodeURIComponent(code)}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Couldn't save", description: apiErrorMessage(j, res.status) });
      return null;
    }
    return res.json();
  }

  async function saveCheckpoint(cpCode: string, patch: Record<string, unknown>) {
    const j = await call(`/checkpoints/${encodeURIComponent(cpCode)}`, "PATCH", patch);
    if (!j) return;
    setEditing(null);
    toast({ variant: "success", title: "Checkpoint updated", description: `${cpCode} · library now v${j.version}` });
    router.refresh();
  }

  async function addCheckpoint(disciplineCode: string, data: Record<string, unknown>) {
    const j = await call("/checkpoints", "POST", { disciplineCode, ...data });
    if (!j) return;
    setAddingTo(null);
    toast({
      variant: "success", title: "Checkpoint added",
      description: `${j.checkpoint.code} · library now v${j.version} (${j.checkpointCount} checkpoints)`,
    });
    router.refresh();
  }

  async function removeCheckpoint(cp: LibraryCheckpoint) {
    const j = await call(`/checkpoints/${encodeURIComponent(cp.code)}`, "DELETE");
    if (!j) return;
    setConfirmDelete(null);
    toast({
      variant: "success", title: "Checkpoint removed",
      description: `${cp.code} will not appear on future audits. Past audits are unchanged.`,
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* The one thing a user must understand before editing. Not a tooltip —
          it changes what they should expect to happen. */}
      <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-2.5 text-[12px] leading-relaxed text-sky-900">
        <Info size={15} className="mt-0.5 shrink-0" />
        <span>
          Edits here apply to the <strong>next audit scheduled</strong>. Audits already created keep
          the checkpoints they were materialised with, so a change today never restates what an
          auditor assessed last quarter. The library version moves on every edit
          (currently <strong>v{library.version}</strong>) so two audits can be told apart.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search checkpoints…" className="h-9 w-72 pl-8 text-sm"
          />
        </div>
        {needle && (
          <span className="text-xs text-slate-500">
            {matched} match{matched === 1 ? "" : "es"}
            <Button type="button" variant="ghost" size="sm" onClick={() => setQ("")} className="ml-1 h-6 px-1 text-xs">
              clear
            </Button>
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400">{library.checkpointCount} checkpoints total</span>
      </div>

      {categories.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
          No checkpoints match “{q}”.
        </div>
      )}

      {categories.map((cat) => {
        const open = needle ? true : openDiscipline === cat.category_code;
        return (
          <div key={cat.category_code} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setOpenDiscipline(open && !needle ? null : cat.category_code)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
            >
              {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
              <span className="size-2.5 rounded-full" style={{ backgroundColor: cat.category_color || "#94a3b8" }} />
              <span className="text-sm font-semibold text-slate-800">{cat.category_name}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {cat.checkpoints.length}
              </span>
              <span className="font-mono text-[10px] text-slate-400">{cat.category_code}</span>
            </button>

            {open && (
              <div className="border-t border-slate-100">
                <ul className="divide-y divide-slate-100">
                  {cat.checkpoints.map((cp) => (
                    <li key={cp.code}>
                      {editing === cp.code ? (
                        <CheckpointForm
                          initial={cp}
                          disciplines={library.categories}
                          currentDiscipline={cat.category_code}
                          busy={busy}
                          onCancel={() => setEditing(null)}
                          onSave={(patch) => saveCheckpoint(cp.code, patch)}
                        />
                      ) : (
                        <CheckpointRow
                          cp={cp}
                          onEdit={() => setEditing(cp.code)}
                          onDelete={() => setConfirmDelete(cp)}
                        />
                      )}
                    </li>
                  ))}
                </ul>

                {addingTo === cat.category_code ? (
                  <div className="border-t border-slate-100 bg-primary-50/40">
                    <CheckpointForm
                      initial={null}
                      disciplines={library.categories}
                      currentDiscipline={cat.category_code}
                      busy={busy}
                      onCancel={() => setAddingTo(null)}
                      onSave={(data) => addCheckpoint(cat.category_code, data)}
                    />
                  </div>
                ) : (
                  <Can permission="AUDIT_COMPLIANCE.CREATE">
                    <div className="border-t border-slate-100 p-2">
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={() => setAddingTo(cat.category_code)}
                        className="w-full border-dashed text-[12px] text-primary-700"
                      >
                        <Plus size={13} /> Add a checkpoint to {cat.category_name}
                      </Button>
                    </div>
                  </Can>
                )}
              </div>
            )}
          </div>
        );
      })}

      {confirmDelete && (
        <Dialog open onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <AlertTriangle size={17} className="text-rose-600" /> Remove this checkpoint?
              </DialogTitle>
              <DialogDescription className="sr-only">Confirm removal of a library checkpoint.</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-slate-700">{confirmDelete.question}</p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
              <span className="font-mono text-slate-500">{confirmDelete.code}</span> will not appear on
              audits scheduled from now on. Audits already created keep it — their checkpoint rows
              are their own copy, so no past record changes.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                type="button" variant="destructive" size="sm" disabled={busy}
                onClick={() => removeCheckpoint(confirmDelete)}
              >
                {busy && <Loader2 size={14} className="animate-spin" />} Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CheckpointRow({ cp, onEdit, onDelete }: {
  cp: LibraryCheckpoint; onEdit: () => void; onDelete: () => void;
}) {
  const req = cp.requirement_type ? REQUIREMENT_TYPE_META[cp.requirement_type] : null;
  return (
    <div className="group flex items-start gap-3 px-4 py-2.5">
      <span className="mt-0.5 shrink-0 font-mono text-[11px] text-slate-400">{cp.code}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-slate-800">{cp.question}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {req && (
            <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase", req.chip)} title={req.label}>
              {req.short}
            </span>
          )}
          <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase", CRITICALITY_CHIP[cp.criticality] ?? CRITICALITY_FALLBACK)}>
            {cp.criticality}
          </span>
          {cp.requires_photo_on_fail && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">photo on finding</span>
          )}
          {cp.auto_trigger_capa_on_fail && (
            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">auto-CAPA</span>
          )}
          {cp.requirement_reference && (
            <span className="text-[10px] text-slate-400">📋 {cp.requirement_reference}</span>
          )}
        </div>
        {cp.guidance && <p className="mt-1 text-[11px] text-slate-500">{cp.guidance}</p>}
      </div>
      <Can permission="AUDIT_COMPLIANCE.UPDATE">
        <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <Button type="button" variant="ghost" size="icon" onClick={onEdit} className="size-7 text-slate-400 hover:text-primary-700" aria-label={`Edit ${cp.code}`}>
            <Pencil size={13} />
          </Button>
          <Can permission="AUDIT_COMPLIANCE.DELETE">
            <Button type="button" variant="ghost" size="icon" onClick={onDelete} className="size-7 text-slate-400 hover:text-rose-600" aria-label={`Remove ${cp.code}`}>
              <Trash2 size={13} />
            </Button>
          </Can>
        </div>
      </Can>
    </div>
  );
}

function CheckpointForm({ initial, disciplines, currentDiscipline, busy, onCancel, onSave }: {
  initial: LibraryCheckpoint | null;
  disciplines: LibraryCategory[];
  currentDiscipline: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [guidance, setGuidance] = useState(initial?.guidance ?? "");
  const [reference, setReference] = useState(initial?.requirement_reference ?? "");
  const [criticality, setCriticality] = useState(initial?.criticality ?? "major");
  const [requirementType, setRequirementType] = useState<string>(initial?.requirement_type ?? "");
  const [photo, setPhoto] = useState(initial?.requires_photo_on_fail ?? true);
  const [autoCapa, setAutoCapa] = useState(initial?.auto_trigger_capa_on_fail ?? false);
  const [category, setCategory] = useState(currentDiscipline);

  const error = question.trim().length < 4 ? "The question must be at least 4 characters." : null;

  function submit() {
    if (error) return;
    const payload: Record<string, unknown> = {
      question: question.trim(),
      guidance: guidance.trim(),
      requirement_reference: reference.trim(),
      criticality,
      requirement_type: requirementType || null,
      requires_photo_on_fail: photo,
      auto_trigger_capa_on_fail: autoCapa,
    };
    // Only send the move when it IS a move — a no-op category on every save
    // would rewrite the checkpoint's position for no reason.
    if (initial && category !== currentDiscipline) payload.category_code = category;
    onSave(payload);
  }

  return (
    <div className="space-y-3 bg-slate-50/70 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-slate-500">
          {initial ? initial.code : "New checkpoint — code assigned automatically"}
        </span>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} className="ml-auto size-6 text-slate-400" aria-label="Cancel">
          <X size={13} />
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Question<span className="ml-0.5 text-rose-500">*</span></Label>
        <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2}
          placeholder="What must the auditor verify?" className="text-[13px]" />
        {error && <p className="text-[11px] text-rose-600">{error}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-[11px]">Requirement type</Label>
          <Select value={requirementType} onChange={(e) => setRequirementType(e.target.value)} className="h-8 text-xs">
            <option value="">— not set —</option>
            {REQ_TYPES.map((r) => (
              <option key={r} value={r}>{REQUIREMENT_TYPE_META[r].label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Criticality</Label>
          <Select value={criticality} onChange={(e) => setCriticality(e.target.value)} className="h-8 text-xs capitalize">
            {CRITICALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        {initial && (
          <div className="space-y-1">
            <Label className="text-[11px]">Discipline</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 text-xs">
              {disciplines.map((d) => (
                <option key={d.category_code} value={d.category_code}>{d.category_name}</option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Guidance (optional)</Label>
          <Input value={guidance} onChange={(e) => setGuidance(e.target.value)} className="h-8 text-xs" placeholder="How to assess this checkpoint." />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Requirement reference (optional)</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} className="h-8 text-xs" placeholder="e.g. Factories Act §38" />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[12px] text-slate-600">
          <Checkbox checked={photo} onChange={(e) => setPhoto(e.target.checked)} />
          Require an evidence photo on a finding
        </label>
        <label className="flex items-center gap-2 text-[12px] text-slate-600">
          <Checkbox checked={autoCapa} onChange={(e) => setAutoCapa(e.target.checked)} />
          Auto-raise a CAPA on a finding
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" onClick={submit} disabled={busy || !!error}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {initial ? "Save changes" : "Add checkpoint"}
        </Button>
      </div>
    </div>
  );
}
