"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CATEGORIES, CATEGORY_LABEL, CLASSIFICATIONS, ORIGINS, ORIGIN_LABEL } from "../_meta";

export function NewChangeForm({ plantId }: { plantId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "equipment",
    subcategory: "",
    classification: "minor",
    origin: "operational_request",
    isTemporary: false,
    temporaryExpiryDate: "",
    businessJustification: "",
    expectedBenefits: "",
    costEstimate: "",
    proposedImplementationDate: "",
    targetCompletionDate: ""
  });

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(doSubmit: boolean) {
    if (!form.title.trim() || !form.description.trim()) {
      toast({ variant: "error", title: "Title and description are required" });
      return;
    }
    setSaving(true);
    const payload = {
      plantId,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      subcategory: form.subcategory.trim() || null,
      classification: form.classification,
      origin: form.origin,
      isTemporary: form.isTemporary,
      temporaryExpiryDate: form.isTemporary && form.temporaryExpiryDate ? form.temporaryExpiryDate : null,
      businessJustification: form.businessJustification.trim() || null,
      expectedBenefits: form.expectedBenefits.trim() || null,
      costEstimate: form.costEstimate ? Number(form.costEstimate) : null,
      proposedImplementationDate: form.proposedImplementationDate || null,
      targetCompletionDate: form.targetCompletionDate || null,
      submit: doSubmit
    };
    try {
      const res = await fetch("/api/moc/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "error", title: "Couldn't create change request", description: j.error });
        setSaving(false);
        return;
      }
      toast({
        variant: "success",
        title: doSubmit ? "Change request submitted" : "Draft saved",
        description: j.number
      });
      router.push(`/moc/${j.id}`);
    } catch {
      toast({ variant: "error", title: "Network error", description: "Please try again." });
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(true);
      }}
      className="max-w-3xl space-y-5"
    >
      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-900">Identify the change</div>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Replace bag filter on Kiln-2 with higher-capacity unit" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What is changing, and from what to what?" required />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subcategory">Subcategory</Label>
            <Input id="subcategory" value={form.subcategory} onChange={(e) => set("subcategory", e.target.value)} placeholder="optional" />
          </div>
          <div className="space-y-2">
            <Label>Classification</Label>
            <Select value={form.classification} onChange={(e) => set("classification", e.target.value)}>
              {CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Origin</Label>
            <Select value={form.origin} onChange={(e) => set("origin", e.target.value)}>
              {ORIGINS.map((o) => (
                <option key={o} value={o}>{ORIGIN_LABEL[o]}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-end gap-2 pb-1">
            <input
              id="isTemporary"
              type="checkbox"
              checked={form.isTemporary}
              onChange={(e) => set("isTemporary", e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="isTemporary" className="!mb-0">This is a temporary change</Label>
          </div>
        </div>
        {form.isTemporary && (
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="temporaryExpiryDate">Temporary expiry date</Label>
            <Input id="temporaryExpiryDate" type="date" value={form.temporaryExpiryDate} onChange={(e) => set("temporaryExpiryDate", e.target.value)} />
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-900">Justification & timeline</div>
        <div className="space-y-2">
          <Label htmlFor="businessJustification">Business justification</Label>
          <Textarea id="businessJustification" rows={3} value={form.businessJustification} onChange={(e) => set("businessJustification", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expectedBenefits">Expected benefits</Label>
          <Textarea id="expectedBenefits" rows={2} value={form.expectedBenefits} onChange={(e) => set("expectedBenefits", e.target.value)} />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="costEstimate">Cost estimate (INR)</Label>
            <Input id="costEstimate" type="number" value={form.costEstimate} onChange={(e) => set("costEstimate", e.target.value)} placeholder="optional" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proposedImplementationDate">Proposed implementation</Label>
            <Input id="proposedImplementationDate" type="date" value={form.proposedImplementationDate} onChange={(e) => set("proposedImplementationDate", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetCompletionDate">Target completion</Label>
            <Input id="targetCompletionDate" type="date" value={form.targetCompletionDate} onChange={(e) => set("targetCompletionDate", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Submitting…" : "Submit change request"}
        </Button>
        <Button type="button" variant="outline" disabled={saving} onClick={() => submit(false)}>
          Save as draft
        </Button>
      </div>
    </form>
  );
}
