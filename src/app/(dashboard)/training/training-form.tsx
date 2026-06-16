"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserPicker } from "@/components/ui/user-picker";

type Program = {
  id: string;
  name: string;
  code: string;
  durationHours: number;
  validityMonths: number;
  passingScore: number;
};

export function TrainingForm({
  programs,
  employees
}: {
  programs: Program[];
  employees: { id: string; name: string; designation: string | null; department: string | null }[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [externalTrainer, setExternalTrainer] = useState(false);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [trainerName, setTrainerName] = useState("");
  const [programId, setProgramId] = useState<string>(programs[0]?.id ?? "");
  const [score, setScore] = useState<string>("80");

  const today = new Date().toISOString().slice(0, 10);
  const selectedProgram = useMemo(() => programs.find((p) => p.id === programId), [programs, programId]);
  const passingScore = selectedProgram?.passingScore ?? 60;
  const numericScore = score === "" ? null : Number(score);
  const scoreBelowPass = numericScore !== null && !isNaN(numericScore) && numericScore < passingScore;

  function onTrainerToggle(useExternal: boolean) {
    setExternalTrainer(useExternal);
    if (useExternal) {
      setTrainerId(null);
    } else {
      setTrainerName("");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, any> = {
      ...Object.fromEntries(fd.entries()),
      trainerId: externalTrainer ? null : trainerId,
      trainerName: externalTrainer ? trainerName.trim() || null : null
    };
    const res = await fetch("/api/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSubmitting(false);
    if (res.ok) {
      router.push(`/training`);
      router.refresh();
    } else {
      const e = await res.json().catch(() => ({}));
      setError(e.error ?? "Failed");
    }
  }

  const trainerReady = externalTrainer ? !!trainerName.trim() : !!trainerId;

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Employee<span className="text-rose-600 ml-0.5">*</span></Label>
            <Select name="employeeId" required>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.designation ?? "—"} ({e.department ?? "—"})</option>)}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Training Program<span className="text-rose-600 ml-0.5">*</span></Label>
            <Select name="programId" required value={programId} onChange={(e) => setProgramId(e.target.value)}>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code}) — {p.durationHours}h, valid {p.validityMonths}m, pass ≥ {p.passingScore}</option>)}
            </Select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date<span className="text-rose-600 ml-0.5">*</span></Label>
              <Input name="date" type="date" defaultValue={today} max={today} required />
            </div>
            <div className="space-y-2">
              <Label>
                Trainer<span className="text-rose-600 ml-0.5">*</span>
                <span className="ml-3 inline-flex items-center gap-1 text-xs font-normal text-slate-500">
                  <input
                    type="checkbox"
                    checked={externalTrainer}
                    onChange={(e) => onTrainerToggle(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  External trainer
                </span>
              </Label>
              {externalTrainer ? (
                <Input
                  value={trainerName}
                  onChange={(e) => setTrainerName(e.target.value)}
                  placeholder="e.g. NSC India / Saviour Safety / DGFASLI"
                  required
                />
              ) : (
                <UserPicker
                  value={trainerId}
                  onChange={(id) => setTrainerId(id)}
                  placeholder="Search and select trainer"
                  required
                />
              )}
              <p className="text-xs text-slate-500">
                {externalTrainer
                  ? "Free text — used when the trainer is not a system user."
                  : "Pick from registered users. Toggle 'External trainer' for outside agencies."}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Score (out of 100)</Label>
              <Input
                name="score"
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
              <p className="text-[11px] text-slate-500">Passing score for this program: {passingScore}</p>
            </div>
            <div className="space-y-2">
              <Label>Outcome<span className="text-rose-600 ml-0.5">*</span></Label>
              <Select name="passed" required defaultValue="true">
                <option value="true">Pass</option>
                <option value="false">Fail (re-attempt required)</option>
              </Select>
              {scoreBelowPass && (
                <p className="text-[11px] text-amber-700">
                  Score is below {passingScore} — outcome must be Fail.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea name="remarks" rows={2} placeholder="Any specific observations from the training..." />
          </div>

          {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">{error}</div>}

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting || !trainerReady}>
              {submitting ? "Saving..." : "Save Training Record"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
