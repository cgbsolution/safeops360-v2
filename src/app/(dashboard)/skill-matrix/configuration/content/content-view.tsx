"use client";

// Client manager for the learning-content adapter. Content is keyed only on
// competency, so an admin can swap the seeded "demo" placeholder for a real
// vendor package (SCORM / VR / external link) with no code change — the engine
// picks up whatever content is primary for the competency. All mutations go
// through the catch-all proxy (/api/training-engine/...) and refresh the route.
// Write controls are gated by SKILL_MATRIX.COMPETENCY_CONFIGURE.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Can } from "@/components/auth/can";
import { cn } from "@/lib/utils";
import {
  CONTENT_TYPES,
  DELIVERY_MODES,
  labelize,
  type Competency,
  type Content
} from "@/lib/training-engine";

type FormState = {
  competencyId: string;
  title: string;
  description: string;
  contentType: string;
  deliveryMode: string;
  contentRef: string;
  vendorId: string;
  vendorName: string;
  durationMinutes: string;
  passingScore: string;
  isPrimary: boolean;
};

const EMPTY_FORM: FormState = {
  competencyId: "",
  title: "",
  description: "",
  contentType: CONTENT_TYPES[0],
  deliveryMode: DELIVERY_MODES[0],
  contentRef: "",
  vendorId: "",
  vendorName: "",
  durationMinutes: "",
  passingScore: "",
  isPrimary: false
};

export function ContentView({
  content,
  competencies
}: {
  content: Content[];
  competencies: Competency[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Content | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Group content by competency for the labelled table.
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: Content[] }>();
    for (const c of content) {
      const key = c.competencyId;
      if (!map.has(key)) map.set(key, { name: c.competencyName, items: [] });
      map.get(key)!.items.push(c);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [content]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, competencyId: competencies[0]?.id ?? "" });
    setDialogOpen(true);
  }

  function openEdit(c: Content) {
    setEditing(c);
    setForm({
      competencyId: c.competencyId,
      title: c.title,
      description: c.description ?? "",
      contentType: c.contentType,
      deliveryMode: c.deliveryMode,
      contentRef: c.contentRef ?? "",
      vendorId: c.vendorId ?? "",
      vendorName: c.vendorName ?? "",
      durationMinutes: c.durationMinutes != null ? String(c.durationMinutes) : "",
      passingScore: c.passingScore != null ? String(c.passingScore) : "",
      isPrimary: c.isPrimary
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.competencyId) {
      toast({ variant: "error", title: "Pick a competency" });
      return;
    }
    if (!form.title.trim()) {
      toast({ variant: "error", title: "Enter a title" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        competencyId: form.competencyId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        contentType: form.contentType,
        deliveryMode: form.deliveryMode,
        contentRef: form.contentRef.trim() || undefined,
        vendorId: form.vendorId.trim() || undefined,
        vendorName: form.vendorName.trim() || undefined,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
        passingScore: form.passingScore ? Number(form.passingScore) : undefined,
        isPrimary: form.isPrimary
      };
      const res = await fetch(
        editing ? `/api/training-engine/content/${editing.id}` : "/api/training-engine/content",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast({
          variant: "error",
          title: editing ? "Couldn't update content" : "Couldn't create content",
          description: j.detail || j.error || "Please try again."
        });
        return;
      }
      toast({ variant: "success", title: editing ? "Content updated" : "Content created" });
      setDialogOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Content) {
    if (!window.confirm(`Delete “${c.title}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/training-engine/content/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast({
          variant: "error",
          title: "Couldn't delete content",
          description: j.detail || j.error || "Please try again."
        });
        return;
      }
      toast({ variant: "success", title: "Content deleted" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-sm text-slate-600">
          Swap demo content for a vendor package here — no code change; the engine keys only on
          competency. Mark one item primary per competency; that&apos;s what gets assigned.
        </p>
        <Can permission="SKILL_MATRIX.COMPETENCY_CONFIGURE">
          <Button size="sm" onClick={openCreate} disabled={busy}>
            <Plus size={14} /> New content
          </Button>
        </Can>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
          No learning content configured yet.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div
              key={g.name}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <h2 className="text-sm font-semibold text-slate-800">{g.name}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-2.5 font-semibold">Title</th>
                      <th className="px-4 py-2.5 font-semibold">Type</th>
                      <th className="px-4 py-2.5 font-semibold">Source</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {g.items.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{c.title}</span>
                            {c.isPrimary && (
                              <span className="inline-flex rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                                Primary
                              </span>
                            )}
                          </div>
                          {c.contentRef && (
                            <a
                              href={c.contentRef}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary-700 hover:underline"
                            >
                              Open <ExternalLink size={11} />
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                              {labelize(c.contentType)}
                            </span>
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                              {labelize(c.deliveryMode)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {c.vendorId ? (
                            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              {c.vendorName ?? "Vendor"}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                              Demo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <Can permission="SKILL_MATRIX.COMPETENCY_CONFIGURE">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(c)}
                                disabled={busy}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary-700 disabled:opacity-50"
                                aria-label="Edit content"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(c)}
                                disabled={busy}
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                                aria-label="Delete content"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </Can>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !busy && setDialogOpen(o)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit content" : "New content"}</DialogTitle>
            <DialogDescription>
              Learning content is keyed on competency — swap the source without touching the engine.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Competency</Label>
              <Select
                value={form.competencyId}
                onChange={(e) => set("competencyId", e.target.value)}
              >
                <option value="">Select a competency…</option>
                {competencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Content type</Label>
              <Select value={form.contentType} onChange={(e) => set("contentType", e.target.value)}>
                {CONTENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {labelize(t)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delivery mode</Label>
              <Select
                value={form.deliveryMode}
                onChange={(e) => set("deliveryMode", e.target.value)}
              >
                {DELIVERY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {labelize(m)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Content reference (URL / package id)</Label>
              <Input
                value={form.contentRef}
                onChange={(e) => set("contentRef", e.target.value)}
                placeholder="https://… or package identifier"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vendor id (optional)</Label>
              <Input value={form.vendorId} onChange={(e) => set("vendorId", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vendor name (optional)</Label>
              <Input
                value={form.vendorName}
                onChange={(e) => set("vendorName", e.target.value)}
                placeholder="Leave blank for demo content"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Duration (minutes)</Label>
              <Input
                type="number"
                value={form.durationMinutes}
                onChange={(e) => set("durationMinutes", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Passing score</Label>
              <Input
                type="number"
                value={form.passingScore}
                onChange={(e) => set("passingScore", e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.isPrimary}
                  onChange={(e) => set("isPrimary", e.target.checked)}
                />
                <span className="text-slate-700">
                  Primary content for this competency (what the engine assigns)
                </span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create content"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
