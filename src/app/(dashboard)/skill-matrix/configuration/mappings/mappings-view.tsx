"use client";

// Client editor for the HazardToSkill trigger mappings — the configurable
// "moat" that lets an admin re-point which incident/near-miss/observation
// classifications raise which competency assignment, with no code change.
// All mutations go through the catch-all proxy (/api/training-engine/...)
// and refresh the route on success. Write controls are gated by
// SKILL_MATRIX.COMPETENCY_CONFIGURE (the API enforces independently).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CLASSIFICATION_FIELDS,
  MATCH_MODES,
  SOURCE_MODULES,
  labelize,
  type Competency,
  type Mapping
} from "@/lib/training-engine";

type FormState = {
  sourceModule: string;
  classificationField: string;
  classificationValue: string;
  matchMode: string;
  competencyId: string;
  priority: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  sourceModule: SOURCE_MODULES[0],
  classificationField: CLASSIFICATION_FIELDS[0],
  classificationValue: "",
  matchMode: MATCH_MODES[0],
  competencyId: "",
  priority: "100",
  notes: ""
};

export function MappingsView({
  mappings,
  competencies
}: {
  mappings: Mapping[];
  competencies: Competency[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Mapping | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, competencyId: competencies[0]?.id ?? "" });
    setDialogOpen(true);
  }

  function openEdit(m: Mapping) {
    setEditing(m);
    setForm({
      sourceModule: m.sourceModule,
      classificationField: m.classificationField,
      classificationValue: m.classificationValue,
      matchMode: m.matchMode,
      competencyId: m.competencyId,
      priority: String(m.priority),
      notes: m.notes ?? ""
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.competencyId) {
      toast({ variant: "error", title: "Pick a competency" });
      return;
    }
    if (!form.classificationValue.trim()) {
      toast({ variant: "error", title: "Enter a classification value" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        sourceModule: form.sourceModule,
        classificationField: form.classificationField,
        classificationValue: form.classificationValue.trim(),
        matchMode: form.matchMode,
        competencyId: form.competencyId,
        priority: Number(form.priority) || 0,
        notes: form.notes.trim() || undefined
      };
      const res = await fetch(
        editing
          ? `/api/training-engine/mappings/${editing.id}`
          : "/api/training-engine/mappings",
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
          title: editing ? "Couldn't update mapping" : "Couldn't create mapping",
          description: j.detail || j.error || "Please try again."
        });
        return;
      }
      toast({ variant: "success", title: editing ? "Mapping updated" : "Mapping created" });
      setDialogOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(m: Mapping) {
    setBusy(true);
    try {
      const res = await fetch(`/api/training-engine/mappings/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !m.isActive })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast({
          variant: "error",
          title: "Couldn't update mapping",
          description: j.detail || j.error || "Please try again."
        });
        return;
      }
      toast({ variant: "success", title: m.isActive ? "Mapping disabled" : "Mapping enabled" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: Mapping) {
    if (!window.confirm(`Delete the mapping to “${m.competencyName}”? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/training-engine/mappings/${m.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast({
          variant: "error",
          title: "Couldn't delete mapping",
          description: j.detail || j.error || "Please try again."
        });
        return;
      }
      toast({ variant: "success", title: "Mapping deleted" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-sm text-slate-600">
          When an incident, near miss or observation is classified, the engine looks up these
          rules to decide which competency to assign. Higher priority wins on ties. Tune them here
          — no code change.
        </p>
        <Can permission="SKILL_MATRIX.COMPETENCY_CONFIGURE">
          <Button size="sm" onClick={openCreate} disabled={busy}>
            <Plus size={14} /> New mapping
          </Button>
        </Can>
      </div>

      <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
        <Table className="w-full text-sm">
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <TableHead className="px-4 py-2.5 font-semibold">Source</TableHead>
              <TableHead className="px-4 py-2.5 font-semibold">Field</TableHead>
              <TableHead className="px-4 py-2.5 font-semibold">Value</TableHead>
              <TableHead className="px-4 py-2.5 font-semibold">Match</TableHead>
              <TableHead className="px-4 py-2.5 font-semibold">Competency</TableHead>
              <TableHead className="px-4 py-2.5 text-right font-semibold">Priority</TableHead>
              <TableHead className="px-4 py-2.5 font-semibold">Active</TableHead>
              <TableHead className="px-4 py-2.5" />
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                  No mappings configured yet.
                </TableCell>
              </TableRow>
            ) : (
              mappings.map((m) => (
                <TableRow key={m.id} className={cn("hover:bg-slate-50/70", !m.isActive && "opacity-60")}>
                  <TableCell className="px-4 py-3 align-top">
                    <Badge variant="neutral" className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {labelize(m.sourceModule)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top font-mono text-xs text-slate-600">
                    {m.classificationField}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top text-slate-800">{m.classificationValue}</TableCell>
                  <TableCell className="px-4 py-3 align-top text-slate-600">{labelize(m.matchMode)}</TableCell>
                  <TableCell className="px-4 py-3 align-top font-medium text-slate-900">
                    {m.competencyName}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top text-right tabular-nums text-slate-600">
                    {m.priority}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top">
                    <Can
                      permission="SKILL_MATRIX.COMPETENCY_CONFIGURE"
                      fallback={
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            m.isActive
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-500"
                          )}
                        >
                          {m.isActive ? "Active" : "Off"}
                        </span>
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleActive(m)}
                        disabled={busy}
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold transition disabled:opacity-50",
                          m.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                        )}
                      >
                        {m.isActive ? "Active" : "Off"}
                      </button>
                    </Can>
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top text-right">
                    <Can permission="SKILL_MATRIX.COMPETENCY_CONFIGURE">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost"
                          type="button"
                          onClick={() => openEdit(m)}
                          disabled={busy} className="rounded p-1"
                          aria-label="Edit mapping">
                          <Pencil size={14} />
                        </Button>
                        <Button variant="destructive"
                          type="button"
                          onClick={() => remove(m)}
                          disabled={busy} className="rounded p-1"
                          aria-label="Delete mapping">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </Can>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => !busy && setDialogOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit mapping" : "New mapping"}</DialogTitle>
            <DialogDescription>
              Route a classified event to a competency assignment.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Source module</Label>
              <SelectField
                value={form.sourceModule}
                onChange={(value) => set("sourceModule", value)}
                options={SOURCE_MODULES.map((s) => ({ value: String(s), label: `${labelize(s)}` }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Classification field</Label>
              <SelectField
                value={form.classificationField}
                onChange={(value) => set("classificationField", value)}
                options={CLASSIFICATION_FIELDS.map((f) => ({ value: String(f), label: `${f}` }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Value</Label>
              <Input
                value={form.classificationValue}
                onChange={(e) => set("classificationValue", e.target.value)}
                placeholder="e.g. working_at_height"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Match mode</Label>
              <SelectField value={form.matchMode} onChange={(value) => set("matchMode", value)}
                options={MATCH_MODES.map((m) => ({ value: String(m), label: `${labelize(m)}` }))}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Competency</Label>
              <SelectField
                value={form.competencyId}
                onChange={(value) => set("competencyId", value)}
                placeholder="Select a competency…"
                options={competencies.map((c) => ({ value: String(c.id), label: `${c.code} — ${c.name}` }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Why this rule exists."
              />
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
              {busy ? "Saving…" : editing ? "Save changes" : "Create mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
