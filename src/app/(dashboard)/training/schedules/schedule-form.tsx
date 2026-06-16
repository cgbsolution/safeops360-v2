"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  MapPin,
  Send,
  Users,
  CheckCircle2,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPicker } from "@/components/ui/user-picker";
import { readApiError } from "@/lib/client-errors";

type Plant = { id: string; name: string; code: string };
type Program = {
  id: string;
  programCode: string | null;
  code: string;
  programName: string | null;
  name: string;
  category: string | null;
  durationHours: number;
  durationSessions: number;
  maxParticipantsPerBatch: number;
  language: string[];
  isStatutory: boolean;
};

type SessionDraft = {
  sequence: number;
  title: string;
  startTime: string;
  endTime: string;
};

const STEPS = [
  { id: 1, title: "Program", icon: GraduationCap },
  { id: 2, title: "When & Where", icon: MapPin },
  { id: 3, title: "Sessions", icon: CalendarDays },
  { id: 4, title: "Trainer", icon: Users },
  { id: 5, title: "Nominees", icon: ClipboardList },
];

export function ScheduleForm({ plants, programs }: { plants: Plant[]; programs: Program[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [programId, setProgramId] = useState("");
  const program = programs.find((p) => p.id === programId);

  // Step 2
  const [plantId, setPlantId] = useState(plants[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venue, setVenue] = useState("");
  const [language, setLanguage] = useState("English");

  // Step 3
  const [sessions, setSessions] = useState<SessionDraft[]>([]);

  // Step 4
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [isExternal, setIsExternal] = useState(false);
  const [externalName, setExternalName] = useState("");
  const [externalOrg, setExternalOrg] = useState("");
  const [externalCert, setExternalCert] = useState("");

  // Step 5
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [nomineeIds, setNomineeIds] = useState<string[]>([]);

  // When program changes, prefill defaults
  useEffect(() => {
    if (!program) return;
    setMaxParticipants(program.maxParticipantsPerBatch);
    if (program.language.length > 0 && !language) setLanguage(program.language[0]);
    // Auto-generate session skeletons
    if (sessions.length === 0) {
      const auto: SessionDraft[] = [];
      for (let i = 1; i <= program.durationSessions; i++) {
        auto.push({
          sequence: i,
          title: `Session ${i} of ${program.durationSessions}`,
          startTime: "",
          endTime: "",
        });
      }
      setSessions(auto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  function validateStep(n: number): string | null {
    if (n === 1 && !programId) return "Pick a program.";
    if (n === 2) {
      if (!plantId) return "Pick a plant.";
      if (!startDate) return "Pick a start date.";
      if (!endDate) return "Pick an end date.";
      if (new Date(endDate) < new Date(startDate))
        return "End date must be on or after start date.";
      if (!venue.trim()) return "Enter a venue.";
    }
    if (n === 3 && sessions.some((s) => !s.startTime || !s.endTime || !s.title.trim()))
      return "Every session needs title + start + end.";
    if (n === 4) {
      if (isExternal && !externalName.trim()) return "External trainer name is required.";
      if (!isExternal && !trainerId) return "Pick an internal trainer.";
    }
    if (n === 5 && maxParticipants <= 0) return "Max participants must be > 0.";
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep((s) => Math.min(STEPS.length, s + 1));
  }
  function back() {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    for (let i = 1; i <= STEPS.length; i++) {
      const err = validateStep(i);
      if (err) {
        setStep(i);
        setError(err);
        return;
      }
    }
    setSubmitting(true);
    setError("");
    try {
      const body = {
        programId,
        plantId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        venue,
        language,
        trainerId: isExternal ? null : trainerId,
        isExternalTrainer: isExternal,
        externalTrainerName: isExternal ? externalName : null,
        externalTrainerOrg: isExternal ? externalOrg : null,
        externalTrainerCert: isExternal ? externalCert : null,
        maxParticipants,
        sessions: sessions.map((s) => ({
          sequence: s.sequence,
          title: s.title,
          startTime: new Date(s.startTime).toISOString(),
          endTime: new Date(s.endTime).toISOString(),
          trainerId: isExternal ? null : trainerId,
        })),
        initialNomineeUserIds: nomineeIds,
      };
      const r = await fetch("/api/training/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const j = await r.json();
        router.push(`/training/schedules/${j.id}`);
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Failed to create schedule"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <StepIndicator step={step} onClick={setStep} />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pick a Program</CardTitle>
            <CardDescription className="text-xs">
              Only APPROVED active programs are schedulable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-auto">
              {programs.map((p) => {
                const active = programId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProgramId(p.id)}
                    className={[
                      "w-full text-left rounded-md border p-3 transition-colors",
                      active
                        ? "border-primary-500 bg-primary-50"
                        : "border-slate-200 bg-white hover:border-primary-300",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-900">
                          {p.programName ?? p.name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {p.programCode ?? p.code}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {p.isStatutory && (
                          <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]">
                            Statutory
                          </Badge>
                        )}
                        {p.category && (
                          <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                            {p.category}
                          </Badge>
                        )}
                        <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                          {p.durationHours}h · {p.durationSessions} session{p.durationSessions === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin size={16} /> When & Where
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Plant *</Label>
                <Select value={plantId} onChange={(e) => setPlantId(e.target.value)}>
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Language *</Label>
                <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {(program?.language ?? ["English", "Hindi"]).map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date *</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Venue *</Label>
              <Input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. Training Hall A, Lumshnong Plant"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays size={16} /> Sessions
            </CardTitle>
            <CardDescription className="text-xs">
              {program?.durationSessions ?? 1} session{(program?.durationSessions ?? 1) === 1 ? "" : "s"} planned for this program.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.map((s, idx) => (
              <div key={idx} className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                <Input
                  value={s.title}
                  onChange={(e) => {
                    const next = [...sessions];
                    next[idx] = { ...next[idx], title: e.target.value };
                    setSessions(next);
                  }}
                  placeholder={`Session ${s.sequence} title`}
                />
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Start</Label>
                    <Input
                      type="datetime-local"
                      value={s.startTime}
                      onChange={(e) => {
                        const next = [...sessions];
                        next[idx] = { ...next[idx], startTime: e.target.value };
                        setSessions(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">End</Label>
                    <Input
                      type="datetime-local"
                      value={s.endTime}
                      onChange={(e) => {
                        const next = [...sessions];
                        next[idx] = { ...next[idx], endTime: e.target.value };
                        setSessions(next);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users size={16} /> Trainer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsExternal(false)}
                className={[
                  "flex-1 px-3 py-2 rounded-md border text-sm font-medium",
                  !isExternal
                    ? "bg-primary-50 border-primary-300 text-primary-700"
                    : "bg-white border-slate-200 text-slate-600",
                ].join(" ")}
              >
                Internal Trainer
              </button>
              <button
                type="button"
                onClick={() => setIsExternal(true)}
                className={[
                  "flex-1 px-3 py-2 rounded-md border text-sm font-medium",
                  isExternal
                    ? "bg-primary-50 border-primary-300 text-primary-700"
                    : "bg-white border-slate-200 text-slate-600",
                ].join(" ")}
              >
                External Trainer
              </button>
            </div>
            {!isExternal ? (
              <UserPicker
                value={trainerId}
                onChange={(id) => setTrainerId(id)}
                filter={{ role: ["TRAINER", "LD_MANAGER", "HSE_MANAGER", "SAFETY_OFFICER"] }}
                placeholder="Pick approved trainer"
              />
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Trainer Name *</Label>
                  <Input
                    value={externalName}
                    onChange={(e) => setExternalName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Organization</Label>
                  <Input
                    value={externalOrg}
                    onChange={(e) => setExternalOrg(e.target.value)}
                    placeholder="e.g. NSC India"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Certification reference</Label>
                  <Input
                    value={externalCert}
                    onChange={(e) => setExternalCert(e.target.value)}
                    placeholder="e.g. NEBOSH IGC #12345"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList size={16} /> Nominees & Capacity
            </CardTitle>
            <CardDescription className="text-xs">
              Bulk-nominate participants. They'll be auto-approved (manager nomination).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Max participants per batch</Label>
              <Input
                type="number"
                min="1"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 20)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nominees</Label>
              <UserPicker
                multiple
                value={nomineeIds}
                onChange={(ids) => setNomineeIds(ids)}
                filter={{ plantId }}
                placeholder="Pick attendees"
              />
              <p className="text-[11px] text-slate-500">
                {nomineeIds.length} of {maxParticipants} seats filled at create time. More can be added after publish.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">
          {error}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/95 backdrop-blur p-3 z-30 shadow-lg sm:left-64">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Button variant="outline" onClick={step === 1 ? () => router.back() : back} disabled={submitting}>
            <ChevronLeft size={16} /> {step === 1 ? "Cancel" : "Back"}
          </Button>
          <div className="text-xs text-slate-500 hidden sm:block">
            Step {step} of {STEPS.length}
          </div>
          {step < STEPS.length ? (
            <Button onClick={next} disabled={submitting}>
              Next <ChevronRight size={16} />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Save as Draft
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step, onClick }: { step: number; onClick: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isActive = step === s.id;
        const isDone = step > s.id;
        return (
          <div key={s.id} className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={() => onClick(s.id)}
              className={[
                "flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium border",
                isActive
                  ? "bg-primary-600 text-white border-primary-600"
                  : isDone
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-50 text-slate-600 border-slate-200",
              ].join(" ")}
            >
              {isDone ? <CheckCircle2 size={12} /> : <Icon size={12} />}
              <span className="hidden sm:inline">{s.title}</span>
              <span className="sm:hidden">{s.id}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={["h-px w-3 sm:w-6", isDone ? "bg-emerald-300" : "bg-slate-200"].join(" ")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
