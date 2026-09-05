"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function NewSubmissionForm({
  plants
}: {
  plants: { id: string; name: string; code: string }[];
}) {
  const router = useRouter();
  // Default to the most recently completed month — submissions are
  // filed AFTER the period closes.
  const now = new Date();
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-12
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [plantId, setPlantId] = useState(plants[0]?.id ?? "");
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/manhours-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, reportingYear: year, reportingMonth: month })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      // Whether created or pre-existing, send the user into the wizard.
      router.push(`/manhours/${plantId}/${year}/${month}/edit`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to start submission");
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Plant</Label>
            <SelectField value={plantId} onChange={(value) => setPlantId(value)} required
              options={plants.map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }))}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reporting year</Label>
              <Input
                type="number"
                min={2020}
                max={now.getFullYear()}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Reporting month</Label>
              <SelectField value={String(month)} onChange={(value) => setMonth(Number(value))} required
                options={MONTHS.map((m, i) => ({ value: String(i + 1), label: `${m}` }))}
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            If a submission already exists for this period it'll be opened in place — never duplicated.
            The wizard saves on every step transition; you can leave and resume any time.
          </p>

          {error && (
            <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</Alert>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Opening…" : "Open in wizard"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
