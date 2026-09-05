"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Alert } from "@/components/ui/alert";

type Plant = { id: string; code: string; name: string };

const CRITICALITY = [
  { code: "", label: "— None —" },
  { code: "A", label: "A — Critical" },
  { code: "B", label: "B — High" },
  { code: "C", label: "C — Medium" },
  { code: "D", label: "D — Low" }
];

const FREQUENCY = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"];

export function EquipmentForm({
  plants,
  categories
}: {
  plants: Plant[];
  categories: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [plantId, setPlantId] = useState(plants.length === 1 ? plants[0].id : "");
  const [location, setLocation] = useState("");
  const [criticality, setCriticality] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [make, setMake] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [statutoryRegistrationNumber, setStatutoryRegistrationNumber] = useState("");
  const [commissioningDate, setCommissioningDate] = useState("");

  function submit() {
    setError(null);
    if (!code.trim()) return setError("Code is required.");
    if (!name.trim()) return setError("Name is required.");
    if (!category.trim()) return setError("Category is required.");
    if (!plantId) return setError("Plant is required.");
    if (!location.trim()) return setError("Location is required.");

    const body = {
      code: code.trim(),
      name: name.trim(),
      category: category.trim(),
      subCategory: subCategory.trim() || null,
      plantId,
      location: location.trim(),
      frequency,
      criticality: criticality || null,
      make: make.trim() || null,
      modelNumber: modelNumber.trim() || null,
      serialNumber: serialNumber.trim() || null,
      manufacturer: manufacturer.trim() || null,
      statutoryRegistrationNumber: statutoryRegistrationNumber.trim() || null,
      commissioningDate: commissioningDate || null
    };

    startTransition(async () => {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? `Failed (${res.status})`);
        return;
      }
      router.push("/inspections/equipment");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Section title="Identity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Code" required>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g., EQ-LMS-0007"
              className="form-input" />
          </Field>
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Crusher Secondary"
              className="form-input" />
          </Field>
          <Field label="Category" required>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="equipment-categories"
              placeholder="e.g., Process Critical"
              className="form-input" />
            <datalist id="equipment-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Sub-category">
            <Input
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              className="form-input" />
          </Field>
        </div>
      </Section>

      <Section title="Location & criticality">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Plant" required>
            <SelectField value={plantId} onChange={setPlantId} className="form-input"
              placeholder="Select plant…"
              options={plants.map((p) => ({ value: String(p.id), label: `${p.code} — ${p.name}` }))}
            />
          </Field>
          <Field label="Location" required>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Packing Plant"
              className="form-input" />
          </Field>
          <Field label="Criticality">
            <SelectField value={criticality} onChange={setCriticality} className="form-input"
              options={CRITICALITY.map((c) => ({ value: String(c.code), label: `${c.label}` }))}
            />
          </Field>
          <Field label="Inspection frequency" required>
            <SelectField value={frequency} onChange={setFrequency} className="form-input"
              options={FREQUENCY.map((f) => ({ value: String(f), label: `${f.replace(/_/g, " ")}` }))}
            />
          </Field>
          <Field label="Commissioning date">
            <Input
              type="date"
              value={commissioningDate}
              onChange={(e) => setCommissioningDate(e.target.value)}
              className="form-input" />
          </Field>
        </div>
      </Section>

      <Section title="Make & identification">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Make">
            <Input value={make} onChange={(e) => setMake(e.target.value)} className="form-input" />
          </Field>
          <Field label="Model number">
            <Input value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} className="form-input" />
          </Field>
          <Field label="Serial number">
            <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="form-input" />
          </Field>
          <Field label="Manufacturer">
            <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className="form-input" />
          </Field>
          <Field label="Statutory registration no.">
            <Input
              value={statutoryRegistrationNumber}
              onChange={(e) => setStatutoryRegistrationNumber(e.target.value)}
              placeholder="For lifting gear, pressure vessels, etc."
              className="form-input" />
          </Field>
        </div>
      </Section>

      {error && (
        <Alert variant="destructive" className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </Alert>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Register Equipment"}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="form-label">
        {label} {required && <span className="text-rose-600">*</span>}
      </Label>
      {children}
    </div>
  );
}
