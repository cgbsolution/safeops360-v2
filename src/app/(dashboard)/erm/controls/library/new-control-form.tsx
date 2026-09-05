"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  CONTROL_TYPES,
  CONTROL_NATURES,
  CONTROL_FREQUENCIES,
  CONTROL_CATEGORIES,
  CONTROL_TYPE_LABEL,
  NATURE_LABEL,
  CONTROL_CATEGORY_LABEL,
} from "@/app/(dashboard)/erm/lib-t3";

// SOX financial-reporting assertions — picked as chips when category is FINANCIAL_REPORTING.
const ASSERTION_OPTIONS = [
  "EXISTENCE",
  "COMPLETENESS",
  "ACCURACY",
  "VALUATION",
  "RIGHTS_OBLIGATIONS",
  "PRESENTATION_DISCLOSURE",
  "CUTOFF",
];

function freqLabel(f: string) {
  return f.charAt(0) + f.slice(1).toLowerCase().replace(/_/g, " ");
}

export function NewControlButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> New Control
      </Button>
      {open && <NewControlModal onClose={() => setOpen(false)} />}
    </>
  );
}

function NewControlModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [controlType, setControlType] = useState<string>("PREVENTIVE");
  const [nature, setNature] = useState<string>("MANUAL");
  const [frequency, setFrequency] = useState<string>("MONTHLY");
  const [category, setCategory] = useState<string>("OPERATIONAL");
  const [controlOwnerId, setControlOwnerId] = useState<string | null>(null);
  const [processName, setProcessName] = useState("");
  const [isKeyControl, setIsKeyControl] = useState(false);
  const [assertions, setAssertions] = useState<string[]>([]);
  const [controlDesignNotes, setControlDesignNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAssertion(a: string) {
    setAssertions((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/erm/controls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          controlType,
          nature,
          frequency,
          category,
          controlOwnerId,
          processName: processName.trim() || null,
          siteId: null,
          isKeyControl,
          assertions,
          controlDesignNotes: controlDesignNotes.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to create control (${res.status}).`);
        setBusy(false);
        return;
      }
      if (j?.id) {
        router.push(`/erm/controls/${j.id}`);
      } else {
        router.refresh();
        onClose();
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error creating control.");
      setBusy(false);
    }
  }

  const valid = name.trim().length >= 3 && controlOwnerId && description.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New Control</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 text-slate-400 hover:text-slate-700"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Control name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly bank reconciliation review"
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What the control does and how it operates."
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Type</Label>
              <SelectField value={controlType} onChange={setControlType}
                options={CONTROL_TYPES.map((t) => ({ value: t, label: CONTROL_TYPE_LABEL[t] ?? t }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Nature</Label>
              <SelectField value={nature} onChange={setNature}
                options={CONTROL_NATURES.map((t) => ({ value: t, label: NATURE_LABEL[t] ?? t }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Frequency</Label>
              <SelectField value={frequency} onChange={setFrequency}
                options={CONTROL_FREQUENCIES.map((t) => ({ value: t, label: freqLabel(t) }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Category</Label>
              <SelectField value={category} onChange={setCategory}
                options={CONTROL_CATEGORIES.map((t) => ({ value: t, label: CONTROL_CATEGORY_LABEL[t] ?? t }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Control owner</Label>
              <UserPicker value={controlOwnerId} onChange={(id) => setControlOwnerId(id)} placeholder="Select owner" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Process (optional)</Label>
              <Input value={processName} onChange={(e) => setProcessName(e.target.value)} placeholder="e.g. Order-to-Cash" />
            </div>
          </div>

          <Label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={isKeyControl} onChange={(e) => setIsKeyControl(e.target.checked)} />
            Key control (in scope for assurance / SOX)
          </Label>

          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Financial assertions (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {ASSERTION_OPTIONS.map((a) => {
                const on = assertions.includes(a);
                return (
                  <Button
                    key={a}
                    type="button"
                    variant="ghost"
                    onClick={() => toggleAssertion(a)}
                    className={cn(
                      "h-auto rounded border px-2 py-0.5 text-[11px] font-normal transition-colors",
                      on
                        ? "border-primary-300 bg-primary-100 text-primary-800 font-semibold"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                    )}
                  >
                    {a.replace(/_/g, " ")}
                  </Button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Control design notes</Label>
            <Textarea
              value={controlDesignNotes}
              onChange={(e) => setControlDesignNotes(e.target.value)}
              rows={2}
              placeholder="Design rationale, evidence retained, who performs the control."
            />
          </div>

          {error && <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</Alert>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={busy || !valid}>
            {busy ? "Creating…" : "Create control"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
