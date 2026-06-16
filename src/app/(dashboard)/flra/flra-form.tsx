"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileCheck,
  HardHat,
  Heart,
  Link2,
  ListChecks,
  MapPin,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPicker } from "@/components/ui/user-picker";
import { GpsCaptureStatus } from "@/components/ui/gps-capture";
import { useGeolocation } from "@/hooks/use-geolocation";
import { formatDateTime, humanize } from "@/lib/utils";
import { readApiError } from "@/lib/client-errors";

type Plant = { id: string; name: string };
type MasterItem = { id: string; code: string; label: string };
type Department = { id: string; name: string };

type EligiblePermit = {
  id: string;
  number: string;
  type: string;
  location: string;
  scopeOfWork: string;
  validFrom: string | Date;
  validTo: string | Date;
  status: string;
  plantId: string;
  plant: { id: string; name: string };
  receiver: { id: string; name: string } | null;
  workCrew: { userId: string; user: { id: string; name: string } }[];
  flras: { id: string; status: string }[];
};

type StepHazard = {
  hazardDescription: string;
  hazardCategory: string;
  energySource: string;
  initialLikelihood: number;
  initialSeverity: number;
  controlMeasures: string;
  residualLikelihood: number;
  residualSeverity: number;
};

type JobStep = {
  sequence: number;
  stepDescription: string;
  hazards: StepHazard[];
};

type FitnessDeclaration = {
  userId: string;
  userName: string;
  isFit: boolean;
  hadAdequateRest: boolean;
  underInfluenceCheck: boolean;
  hasMedicalCondition: boolean;
  conditionsDeclared: string;
  notes: string;
};

const TBT_LANGUAGES = ["English", "Hindi", "Bengali", "Khasi", "Other"];

const PPE_ITEMS = [
  { code: "HARD_HAT", label: "Hard hat" },
  { code: "SAFETY_SHOES", label: "Safety shoes" },
  { code: "SAFETY_GLASSES", label: "Safety glasses" },
  { code: "GLOVES", label: "Gloves" },
  { code: "HI_VIS", label: "Hi-vis vest" },
  { code: "HEARING", label: "Hearing protection" },
  { code: "DUST_MASK", label: "Dust mask / respirator" },
  { code: "FACE_SHIELD", label: "Face shield" },
];

const TOOLS_CHECKLIST = [
  { code: "VISUAL_INSPECTION", label: "Visual inspection done" },
  { code: "DEFECT_FREE", label: "All tools defect-free" },
  { code: "VALID_INSPECTION", label: "Valid inspection tags / colour codes" },
  { code: "RIGHT_TOOL", label: "Right tool for the job" },
  { code: "CORDS_INTACT", label: "Power cords / hoses intact" },
];

function newHazard(): StepHazard {
  return {
    hazardDescription: "",
    hazardCategory: "",
    energySource: "",
    initialLikelihood: 3,
    initialSeverity: 3,
    controlMeasures: "",
    residualLikelihood: 1,
    residualSeverity: 2,
  };
}

function newStep(seq: number): JobStep {
  return { sequence: seq, stepDescription: "", hazards: [newHazard()] };
}

function riskLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 15) return "CRITICAL";
  if (score >= 8) return "HIGH";
  if (score >= 4) return "MEDIUM";
  return "LOW";
}

function riskColor(level: string) {
  switch (level) {
    case "CRITICAL":
      return "bg-rose-100 text-rose-800 border-rose-300";
    case "HIGH":
      return "bg-orange-100 text-orange-800 border-orange-300";
    case "MEDIUM":
      return "bg-amber-100 text-amber-800 border-amber-300";
    default:
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
  }
}

const STEPS = [
  { id: 1, title: "Permit & Job", icon: FileCheck },
  { id: 2, title: "Crew & TBT", icon: Users },
  { id: 3, title: "Hazards", icon: ShieldAlert },
  { id: 4, title: "Controls & Fitness", icon: Heart },
  { id: 5, title: "Review", icon: ClipboardList },
] as const;

export function FLRAForm({
  plants,
  permit,
}: {
  plants: Plant[];
  permit: EligiblePermit | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ─── Step 1 — Permit & Job ───
  const [selectedPermit, setSelectedPermit] = useState<EligiblePermit | null>(permit);
  const [plantId, setPlantId] = useState<string>(permit?.plantId ?? plants[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [areaCode, setAreaCode] = useState<string>("");
  const [location, setLocation] = useState<string>(permit?.location ?? "");
  const [specificLocation, setSpecificLocation] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState<string>("");
  const { coords: gpsCoords, status: gpsStatus, error: gpsError, request: requestGps } = useGeolocation();
  const gpsLat = gpsCoords?.lat ?? null;
  const gpsLng = gpsCoords?.lng ?? null;
  const [jobDescription, setJobDescription] = useState<string>(permit?.scopeOfWork ?? "");
  const [jobIsRoutine, setJobIsRoutine] = useState<boolean | null>(null);

  // ─── Step 2 — Crew & TBT ───
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>(
    permit?.workCrew?.map((c) => c.userId) ?? []
  );
  const [crewNamesById, setCrewNamesById] = useState<Record<string, string>>(
    Object.fromEntries(permit?.workCrew?.map((c) => [c.userId, c.user.name]) ?? [])
  );
  const [toolboxTalkById, setToolboxTalkById] = useState<string | null>(null);
  const [tbtConducted, setTbtConducted] = useState<boolean>(false);
  const [tbtConductedAt, setTbtConductedAt] = useState<string>("");
  const [tbtTopics, setTbtTopics] = useState<string>("");
  const [tbtLanguage, setTbtLanguage] = useState<string>("Hindi");

  // ─── Step 3 — Hazards ───
  const [jobSteps, setJobSteps] = useState<JobStep[]>([newStep(1)]);

  // ─── Step 4 — Controls & Fitness ───
  const [ppeChecks, setPpeChecks] = useState<Record<string, boolean>>({});
  const [toolsChecks, setToolsChecks] = useState<Record<string, boolean>>({});
  const [exitRoutes, setExitRoutes] = useState<string>("");
  const [emergencyConfirmed, setEmergencyConfirmed] = useState<boolean>(false);
  const [fitness, setFitness] = useState<FitnessDeclaration[]>([]);

  // ─── Masters ───
  const [hazardCategories, setHazardCategories] = useState<MasterItem[]>([]);
  const [energySources, setEnergySources] = useState<MasterItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/near-miss/masters/items?type=HAZARD_CATEGORY").then((r) => r.json()).catch(() => []),
      fetch("/api/near-miss/masters/items?type=ENERGY_SOURCE").then((r) => r.json()).catch(() => []),
    ]).then(([hc, es]) => {
      setHazardCategories(Array.isArray(hc) ? hc : hc?.items ?? []);
      setEnergySources(Array.isArray(es) ? es : es?.items ?? []);
    });
  }, []);

  useEffect(() => {
    if (!plantId) {
      setDepartments([]);
      return;
    }
    // Departments only — Area is now a free-text field, no master fetch needed.
    // The departments endpoint historically returned cross-plant rows (one per
    // (department × plant) combination), which surfaced as duplicates in this
    // dropdown. Dedupe client-side by name; first occurrence wins so the row
    // we keep is stable across renders.
    fetch(`/api/near-miss/masters/departments?plantId=${plantId}`)
      .then((r) => r.json())
      .catch(() => [])
      .then((dp) => {
        const raw: Department[] = Array.isArray(dp) ? dp : dp?.items ?? [];
        const seen = new Set<string>();
        const deduped: Department[] = [];
        for (const d of raw) {
          const key = d.name.trim().toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(d);
        }
        deduped.sort((a, b) => a.name.localeCompare(b.name));
        setDepartments(deduped);
      });
  }, [plantId]);

  // Sync fitness rows to crew list
  useEffect(() => {
    setFitness((prev) => {
      const map = new Map(prev.map((f) => [f.userId, f]));
      return teamMemberIds.map((uid) => {
        const existing = map.get(uid);
        if (existing) return { ...existing, userName: crewNamesById[uid] ?? existing.userName };
        return {
          userId: uid,
          userName: crewNamesById[uid] ?? "Crew member",
          isFit: false,
          hadAdequateRest: false,
          underInfluenceCheck: false,
          hasMedicalCondition: false,
          conditionsDeclared: "",
          notes: "",
        };
      });
    });
  }, [teamMemberIds, crewNamesById]);

  const lockedByPermit = !!selectedPermit;

  function applyPermit(p: EligiblePermit | null) {
    setSelectedPermit(p);
    if (p) {
      setPlantId(p.plantId);
      setLocation(p.location);
      setJobDescription(p.scopeOfWork);
      const crewIds = p.workCrew.length
        ? p.workCrew.map((c) => c.userId)
        : p.receiver
        ? [p.receiver.id]
        : [];
      setTeamMemberIds(crewIds);
      setCrewNamesById(Object.fromEntries(p.workCrew.map((c) => [c.userId, c.user.name])));
    }
  }

  function clearPermit() {
    setSelectedPermit(null);
    setLocation("");
    setJobDescription("");
    setTeamMemberIds([]);
    setCrewNamesById({});
  }

  function validateStep(n: number): string | null {
    if (n === 1) {
      if (!plantId) return "Choose a plant.";
      if (!location.trim()) return "Enter the worksite location.";
      if (!date) return "Choose a date.";
      if (jobDescription.trim().length < 10)
        return "Job description must be at least 10 characters.";
      if (jobIsRoutine === null) return "Mark whether this job is routine.";
    }
    if (n === 2) {
      if (teamMemberIds.length === 0) return "Add at least one crew member.";
      if (!toolboxTalkById) return "Select who conducted the toolbox talk.";
      if (!tbtConducted) return "Confirm the toolbox talk was conducted.";
      if (!tbtConductedAt) return "Capture the time the toolbox talk was conducted.";
    }
    if (n === 3) {
      if (jobSteps.length === 0) return "Add at least one job step.";
      for (const s of jobSteps) {
        if (!s.stepDescription.trim()) return `Step ${s.sequence}: describe the work step.`;
        if (s.hazards.length === 0)
          return `Step ${s.sequence}: add at least one hazard.`;
        for (const h of s.hazards) {
          if (!h.hazardDescription.trim())
            return `Step ${s.sequence}: hazard description is required.`;
          if (!h.hazardCategory)
            return `Step ${s.sequence}: pick a hazard category.`;
          if (!h.controlMeasures.trim())
            return `Step ${s.sequence}: list control measures.`;
          const residual = riskLevel(h.residualLikelihood * h.residualSeverity);
          if (residual === "HIGH" || residual === "CRITICAL")
            return `Step ${s.sequence}: residual risk is ${residual} — strengthen controls or escalate.`;
        }
      }
    }
    if (n === 4) {
      if (!emergencyConfirmed)
        return "Confirm emergency contacts have been reviewed.";
      if (!exitRoutes.trim())
        return "Identify the worksite exit routes.";
      for (const f of fitness) {
        if (!f.isFit)
          return `${f.userName} has not declared fitness for duty.`;
        if (!f.hadAdequateRest)
          return `${f.userName} must confirm adequate rest.`;
        if (!f.underInfluenceCheck)
          return `${f.userName} must confirm not under any influence.`;
      }
    }
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
    for (let i = 1; i <= 4; i++) {
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
      const dt = new Date(`${date}T${startTime || "00:00"}:00`);
      const payload = {
        permitId: selectedPermit?.id ?? null,
        plantId,
        date: new Date(date).toISOString(),
        location,
        jobDescription,
        teamMemberIds,
        toolboxTalkById,
        toolboxTalkConfirmed: tbtConducted,
        hazards: "[]",
        isStandalone: !selectedPermit,
        departmentId: departmentId || null,
        areaCode: areaCode || null,
        specificLocation: specificLocation || null,
        gpsLatitude: gpsLat,
        gpsLongitude: gpsLng,
        startTime: startTime ? dt.toISOString() : null,
        jobIsRoutine,
        toolboxTalkConducted: tbtConducted,
        toolboxTalkConductedAt: tbtConducted ? new Date().toISOString() : null,
        toolboxTalkTopics: tbtTopics
          ? tbtTopics
              .split(/[\n,]/)
              .map((t) => t.trim())
              .filter(Boolean)
          : null,
        toolboxTalkLanguage: tbtLanguage,
        ppeChecklistResponses: ppeChecks,
        toolsCheckedResponses: toolsChecks,
        exitRoutesIdentified: exitRoutes,
        emergencyContactsConfirmed: emergencyConfirmed,
        jobSteps: jobSteps.map((s) => ({
          sequence: s.sequence,
          stepDescription: s.stepDescription,
          hazards: s.hazards.map((h) => ({
            hazardDescription: h.hazardDescription,
            hazardCategory: h.hazardCategory,
            energySource: h.energySource || null,
            initialLikelihood: h.initialLikelihood,
            initialSeverity: h.initialSeverity,
            controlMeasures: h.controlMeasures,
            residualLikelihood: h.residualLikelihood,
            residualSeverity: h.residualSeverity,
          })),
        })),
        fitnessDeclarations: fitness.map((f) => ({
          userId: f.userId,
          isFit: f.isFit,
          hasMedicalCondition: f.hasMedicalCondition,
          conditionsDeclared: f.conditionsDeclared || null,
          hadAdequateRest: f.hadAdequateRest,
          underInfluenceCheck: f.underInfluenceCheck,
          notes: f.notes || null,
        })),
      };

      const res = await fetch("/api/flra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const j = await res.json();
        router.push(`/flra/${j.id}`);
        router.refresh();
        return;
      }
      setError(await readApiError(res, "Failed to submit FLRA"));
    } catch (err: any) {
      setError(err?.message ?? "Network error. Check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-24">
      <StepIndicator step={step} />

      {step === 1 && (
        <Step1JobInfo
          plants={plants}
          plantId={plantId}
          setPlantId={setPlantId}
          departments={departments}
          departmentId={departmentId}
          setDepartmentId={setDepartmentId}
          areaCode={areaCode}
          setAreaCode={setAreaCode}
          location={location}
          setLocation={setLocation}
          specificLocation={specificLocation}
          setSpecificLocation={setSpecificLocation}
          date={date}
          setDate={setDate}
          startTime={startTime}
          setStartTime={setStartTime}
          jobDescription={jobDescription}
          setJobDescription={setJobDescription}
          jobIsRoutine={jobIsRoutine}
          setJobIsRoutine={setJobIsRoutine}
          gpsCoords={gpsCoords}
          gpsStatus={gpsStatus}
          gpsError={gpsError}
          requestGps={requestGps}
          selectedPermit={selectedPermit}
          applyPermit={applyPermit}
          clearPermit={clearPermit}
          lockedByPermit={lockedByPermit}
        />
      )}

      {step === 2 && (
        <Step2CrewTBT
          plantId={plantId}
          teamMemberIds={teamMemberIds}
          setTeamMemberIds={setTeamMemberIds}
          setCrewNamesById={setCrewNamesById}
          toolboxTalkById={toolboxTalkById}
          setToolboxTalkById={setToolboxTalkById}
          tbtConducted={tbtConducted}
          setTbtConducted={setTbtConducted}
          tbtConductedAt={tbtConductedAt}
          setTbtConductedAt={setTbtConductedAt}
          tbtTopics={tbtTopics}
          setTbtTopics={setTbtTopics}
          tbtLanguage={tbtLanguage}
          setTbtLanguage={setTbtLanguage}
          lockedByPermit={lockedByPermit}
        />
      )}

      {step === 3 && (
        <Step3Hazards
          jobSteps={jobSteps}
          setJobSteps={setJobSteps}
          hazardCategories={hazardCategories}
          energySources={energySources}
        />
      )}

      {step === 4 && (
        <Step4Controls
          ppeChecks={ppeChecks}
          setPpeChecks={setPpeChecks}
          toolsChecks={toolsChecks}
          setToolsChecks={setToolsChecks}
          exitRoutes={exitRoutes}
          setExitRoutes={setExitRoutes}
          emergencyConfirmed={emergencyConfirmed}
          setEmergencyConfirmed={setEmergencyConfirmed}
          fitness={fitness}
          setFitness={setFitness}
        />
      )}

      {step === 5 && (
        <Step5Review
          plantName={plants.find((p) => p.id === plantId)?.name ?? ""}
          location={location}
          specificLocation={specificLocation}
          date={date}
          startTime={startTime}
          jobDescription={jobDescription}
          selectedPermit={selectedPermit}
          teamMemberIds={teamMemberIds}
          crewNamesById={crewNamesById}
          jobSteps={jobSteps}
          fitness={fitness}
        />
      )}

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Sticky bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/95 backdrop-blur p-3 z-30 shadow-lg sm:left-64">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={step === 1 ? () => router.back() : back}
            disabled={submitting}
          >
            <ChevronLeft size={16} /> {step === 1 ? "Cancel" : "Back"}
          </Button>
          <div className="text-xs text-slate-500 hidden sm:block">
            Step {step} of {STEPS.length}
          </div>
          {step < STEPS.length ? (
            <Button type="button" onClick={next} disabled={submitting}>
              Next <ChevronRight size={16} />
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : (
                <>
                  <Send size={16} /> Submit FLRA
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step indicator strip ─────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isActive = step === s.id;
        const isDone = step > s.id;
        return (
          <div key={s.id} className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div
              className={[
                "flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
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
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  "h-px w-3 sm:w-6",
                  isDone ? "bg-emerald-300" : "bg-slate-200",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Permit & Job ─────────────────────────────────────────────

function Step1JobInfo(props: {
  plants: Plant[];
  plantId: string;
  setPlantId: (s: string) => void;
  departments: Department[];
  departmentId: string;
  setDepartmentId: (s: string) => void;
  areaCode: string;
  setAreaCode: (s: string) => void;
  location: string;
  setLocation: (s: string) => void;
  specificLocation: string;
  setSpecificLocation: (s: string) => void;
  date: string;
  setDate: (s: string) => void;
  startTime: string;
  setStartTime: (s: string) => void;
  jobDescription: string;
  setJobDescription: (s: string) => void;
  jobIsRoutine: boolean | null;
  setJobIsRoutine: (b: boolean) => void;
  gpsCoords: import("@/hooks/use-geolocation").GpsCoords | null;
  gpsStatus: import("@/hooks/use-geolocation").GeolocationStatus;
  gpsError: string | null;
  requestGps: () => void;
  selectedPermit: EligiblePermit | null;
  applyPermit: (p: EligiblePermit | null) => void;
  clearPermit: () => void;
  lockedByPermit: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card className={props.selectedPermit ? "border-primary-300 ring-2 ring-primary-100" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 size={16} /> Linked Permit
            <span className="text-xs font-normal text-slate-500 ml-1">(optional)</span>
          </CardTitle>
          <CardDescription className="text-xs">
            {props.selectedPermit
              ? "FLRA gates this permit's activation. All listed crew must sign before work."
              : "Pick a permit to chain this FLRA, or leave blank for non-permit work."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {props.selectedPermit ? (
            <div className="rounded-lg border border-primary-200 bg-primary-50 p-3 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FileCheck size={16} className="text-primary-700" />
                    <span className="font-mono text-sm font-semibold text-primary-900">
                      {props.selectedPermit.number}
                    </span>
                    <Badge className="bg-white text-primary-700 border-primary-200 text-[10px]">
                      {humanize(props.selectedPermit.type)}
                    </Badge>
                  </div>
                  <div className="text-sm text-primary-800 mt-1">
                    {props.selectedPermit.location} · {props.selectedPermit.plant.name}
                  </div>
                  <div className="text-xs text-primary-700 mt-0.5">
                    {formatDateTime(new Date(props.selectedPermit.validFrom))} –{" "}
                    {formatDateTime(new Date(props.selectedPermit.validTo))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={props.clearPermit}
                  className="text-primary-700 hover:text-primary-900"
                  aria-label="Clear linked permit"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <PermitPicker onSelect={props.applyPermit} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin size={16} /> Where & When
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Plant *</Label>
              <Select
                value={props.plantId}
                onChange={(e) => props.setPlantId(e.target.value)}
                disabled={props.lockedByPermit}
              >
                {props.plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Department</Label>
              <Select
                value={props.departmentId}
                onChange={(e) => props.setDepartmentId(e.target.value)}
              >
                <option value="">— Pick —</option>
                {props.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Area</Label>
              <Input
                value={props.areaCode}
                onChange={(e) => props.setAreaCode(e.target.value)}
                placeholder="e.g. Kiln 1, Coal Mill, Packing Plant"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Location *</Label>
              <Input
                value={props.location}
                onChange={(e) => props.setLocation(e.target.value)}
                placeholder="Worksite"
                disabled={props.lockedByPermit}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Specific Location</Label>
            <Input
              value={props.specificLocation}
              onChange={(e) => props.setSpecificLocation(e.target.value)}
              placeholder="Equipment / column / floor"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date *</Label>
              <Input
                type="date"
                value={props.date}
                onChange={(e) => props.setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start Time</Label>
              <Input
                type="time"
                value={props.startTime}
                onChange={(e) => props.setStartTime(e.target.value)}
              />
            </div>
          </div>

          <GpsCaptureStatus
            status={props.gpsStatus}
            coords={props.gpsCoords}
            error={props.gpsError}
            onRetry={props.requestGps}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Job Description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={3}
            value={props.jobDescription}
            onChange={(e) => props.setJobDescription(e.target.value)}
            placeholder="Describe what work will be done (≥ 10 chars)"
            disabled={props.lockedByPermit}
          />
          <div className="space-y-1.5">
            <Label className="text-xs">Is this a routine job? *</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => props.setJobIsRoutine(true)}
                className={[
                  "flex-1 px-3 py-2 rounded-md border text-sm font-medium",
                  props.jobIsRoutine === true
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-white border-slate-200 text-slate-600",
                ].join(" ")}
              >
                Routine
              </button>
              <button
                type="button"
                onClick={() => props.setJobIsRoutine(false)}
                className={[
                  "flex-1 px-3 py-2 rounded-md border text-sm font-medium",
                  props.jobIsRoutine === false
                    ? "bg-amber-50 border-amber-300 text-amber-700"
                    : "bg-white border-slate-200 text-slate-600",
                ].join(" ")}
              >
                Non-routine
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Step 2: Crew & Toolbox Talk ──────────────────────────────────────

function Step2CrewTBT(props: {
  plantId: string;
  teamMemberIds: string[];
  setTeamMemberIds: (ids: string[]) => void;
  setCrewNamesById: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  toolboxTalkById: string | null;
  setToolboxTalkById: (id: string | null) => void;
  tbtConducted: boolean;
  setTbtConducted: (b: boolean) => void;
  tbtConductedAt: string;
  setTbtConductedAt: (s: string) => void;
  tbtTopics: string;
  setTbtTopics: (s: string) => void;
  tbtLanguage: string;
  setTbtLanguage: (s: string) => void;
  lockedByPermit: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users size={16} /> Work Crew
          </CardTitle>
          <CardDescription className="text-xs">
            {props.lockedByPermit
              ? "Locked to permit roster — all listed must sign on-site."
              : "Add every crew member who will be on site for this task."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <UserPicker
            multiple
            value={props.teamMemberIds}
            onChange={(ids, users) => {
              props.setTeamMemberIds(ids);
              props.setCrewNamesById((prev) => {
                const next = { ...prev };
                users.forEach((u) => {
                  next[u.id] = u.name;
                });
                return next;
              });
            }}
            filter={{ plantId: props.plantId || undefined }}
            placeholder="Search crew members"
            disabled={props.lockedByPermit}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList size={16} /> Toolbox Talk
          </CardTitle>
          <CardDescription className="text-xs">
            Recorded TBT before work — confirms crew briefed on hazards & emergency.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Conducted By *</Label>
            <UserPicker
              value={props.toolboxTalkById}
              onChange={(id) => props.setToolboxTalkById(id)}
              filter={{ plantId: props.plantId || undefined }}
              placeholder="Select supervisor"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">TBT Time *</Label>
              <Input
                type="time"
                value={props.tbtConductedAt}
                onChange={(e) => props.setTbtConductedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Language</Label>
              <Select
                value={props.tbtLanguage}
                onChange={(e) => props.setTbtLanguage(e.target.value)}
              >
                {TBT_LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Topics Covered</Label>
            <Textarea
              rows={2}
              value={props.tbtTopics}
              onChange={(e) => props.setTbtTopics(e.target.value)}
              placeholder="e.g. PPE, isolation, emergency exits — comma or newline separated"
            />
          </div>

          <label className="flex items-start gap-2 p-2 rounded-md border border-emerald-200 bg-emerald-50">
            <input
              type="checkbox"
              checked={props.tbtConducted}
              onChange={(e) => props.setTbtConducted(e.target.checked)}
              className="mt-0.5"
            />
            <div className="text-xs text-emerald-800">
              <span className="font-medium">Toolbox talk completed</span>
              <div className="text-emerald-700">
                All crew briefed on hazards, controls and emergency procedures.
              </div>
            </div>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Step 3: Hazard Analysis (5×5) ────────────────────────────────────

function Step3Hazards({
  jobSteps,
  setJobSteps,
  hazardCategories,
  energySources,
}: {
  jobSteps: JobStep[];
  setJobSteps: (s: JobStep[]) => void;
  hazardCategories: MasterItem[];
  energySources: MasterItem[];
}) {
  function updateStep(idx: number, patch: Partial<JobStep>) {
    setJobSteps(jobSteps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function updateHazard(stepIdx: number, hazIdx: number, patch: Partial<StepHazard>) {
    setJobSteps(
      jobSteps.map((s, i) =>
        i === stepIdx
          ? {
              ...s,
              hazards: s.hazards.map((h, j) => (j === hazIdx ? { ...h, ...patch } : h)),
            }
          : s
      )
    );
  }

  function addStep() {
    setJobSteps([...jobSteps, newStep(jobSteps.length + 1)]);
  }
  function removeStep(idx: number) {
    setJobSteps(
      jobSteps
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, sequence: i + 1 }))
    );
  }
  function addHazard(stepIdx: number) {
    updateStep(stepIdx, { hazards: [...jobSteps[stepIdx].hazards, newHazard()] });
  }
  function removeHazard(stepIdx: number, hazIdx: number) {
    updateStep(stepIdx, {
      hazards: jobSteps[stepIdx].hazards.filter((_, j) => j !== hazIdx),
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert size={16} /> Hazard Analysis
          </CardTitle>
          <CardDescription className="text-xs">
            Break the job into steps. Score each hazard <strong>likelihood × severity</strong>{" "}
            (1–5) before & after controls. Residual ≥ HIGH blocks the FLRA.
          </CardDescription>
        </CardHeader>
      </Card>

      {jobSteps.map((s, sIdx) => (
        <Card key={sIdx} className="border-slate-300">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                {s.sequence}
              </span>
              Job Step
            </CardTitle>
            {jobSteps.length > 1 && (
              <button
                type="button"
                onClick={() => removeStep(sIdx)}
                className="text-rose-600 hover:text-rose-800"
                aria-label="Remove step"
              >
                <Trash2 size={14} />
              </button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={2}
              value={s.stepDescription}
              onChange={(e) => updateStep(sIdx, { stepDescription: e.target.value })}
              placeholder="Describe this work step"
            />

            {s.hazards.map((h, hIdx) => {
              const initialScore = h.initialLikelihood * h.initialSeverity;
              const residualScore = h.residualLikelihood * h.residualSeverity;
              const initialLevel = riskLevel(initialScore);
              const residualLevel = riskLevel(residualScore);
              return (
                <div
                  key={hIdx}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-700">
                      Hazard #{hIdx + 1}
                    </div>
                    {s.hazards.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeHazard(sIdx, hIdx)}
                        className="text-rose-600 hover:text-rose-800"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  <Textarea
                    rows={2}
                    value={h.hazardDescription}
                    onChange={(e) =>
                      updateHazard(sIdx, hIdx, { hazardDescription: e.target.value })
                    }
                    placeholder="Hazard description"
                  />

                  <div className="grid sm:grid-cols-2 gap-2">
                    <Select
                      value={h.hazardCategory}
                      onChange={(e) =>
                        updateHazard(sIdx, hIdx, { hazardCategory: e.target.value })
                      }
                    >
                      <option value="">Hazard category…</option>
                      {hazardCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={h.energySource}
                      onChange={(e) =>
                        updateHazard(sIdx, hIdx, { energySource: e.target.value })
                      }
                    >
                      <option value="">Energy source (opt)…</option>
                      {energySources.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Initial risk */}
                  <div className="rounded-md border border-orange-200 bg-orange-50 p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold text-orange-700 uppercase tracking-wide">
                        Initial Risk (no controls)
                      </div>
                      <span
                        className={[
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                          riskColor(initialLevel),
                        ].join(" ")}
                      >
                        {initialScore} · {initialLevel}
                      </span>
                    </div>
                    <RiskMatrixSlider
                      label="Likelihood"
                      value={h.initialLikelihood}
                      onChange={(v) => updateHazard(sIdx, hIdx, { initialLikelihood: v })}
                    />
                    <RiskMatrixSlider
                      label="Severity"
                      value={h.initialSeverity}
                      onChange={(v) => updateHazard(sIdx, hIdx, { initialSeverity: v })}
                    />
                  </div>

                  <Textarea
                    rows={2}
                    value={h.controlMeasures}
                    onChange={(e) =>
                      updateHazard(sIdx, hIdx, { controlMeasures: e.target.value })
                    }
                    placeholder="Control measures applied (PPE, isolation, barriers, etc.)"
                  />

                  {/* Residual risk */}
                  <div
                    className={[
                      "rounded-md border p-2 space-y-2",
                      residualLevel === "HIGH" || residualLevel === "CRITICAL"
                        ? "border-rose-300 bg-rose-50"
                        : "border-emerald-200 bg-emerald-50",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                        Residual Risk (after controls)
                      </div>
                      <span
                        className={[
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                          riskColor(residualLevel),
                        ].join(" ")}
                      >
                        {residualScore} · {residualLevel}
                      </span>
                    </div>
                    <RiskMatrixSlider
                      label="Likelihood"
                      value={h.residualLikelihood}
                      onChange={(v) =>
                        updateHazard(sIdx, hIdx, { residualLikelihood: v })
                      }
                    />
                    <RiskMatrixSlider
                      label="Severity"
                      value={h.residualSeverity}
                      onChange={(v) =>
                        updateHazard(sIdx, hIdx, { residualSeverity: v })
                      }
                    />
                    {(residualLevel === "HIGH" || residualLevel === "CRITICAL") && (
                      <div className="text-[11px] text-rose-700 flex items-start gap-1">
                        <AlertTriangle size={11} className="mt-0.5" />
                        <span>
                          Residual {residualLevel} blocks the FLRA. Strengthen controls
                          or escalate to HSE.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addHazard(sIdx)}
            >
              <Plus size={14} /> Add Hazard
            </Button>
          </CardContent>
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={addStep} className="w-full">
        <Plus size={14} /> Add Job Step
      </Button>
    </div>
  );
}

function RiskMatrixSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-slate-600">
        <span>{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={[
              "h-8 rounded text-xs font-semibold border transition-colors",
              value === n
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-primary-300",
            ].join(" ")}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 4: Controls & Fitness ───────────────────────────────────────

function Step4Controls(props: {
  ppeChecks: Record<string, boolean>;
  setPpeChecks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  toolsChecks: Record<string, boolean>;
  setToolsChecks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  exitRoutes: string;
  setExitRoutes: (s: string) => void;
  emergencyConfirmed: boolean;
  setEmergencyConfirmed: (b: boolean) => void;
  fitness: FitnessDeclaration[];
  setFitness: React.Dispatch<React.SetStateAction<FitnessDeclaration[]>>;
}) {
  function updateFitness(uid: string, patch: Partial<FitnessDeclaration>) {
    props.setFitness((prev) =>
      prev.map((f) => (f.userId === uid ? { ...f, ...patch } : f))
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HardHat size={16} /> PPE Confirmed
          </CardTitle>
          <CardDescription className="text-xs">
            Tick PPE that crew is wearing on-site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PPE_ITEMS.map((p) => (
              <label
                key={p.code}
                className={[
                  "flex items-center gap-2 px-2 py-2 rounded-md border text-xs cursor-pointer",
                  props.ppeChecks[p.code]
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "bg-white border-slate-200 text-slate-700",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={!!props.ppeChecks[p.code]}
                  onChange={(e) =>
                    props.setPpeChecks((prev) => ({
                      ...prev,
                      [p.code]: e.target.checked,
                    }))
                  }
                />
                {p.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks size={16} /> Tools & Equipment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {TOOLS_CHECKLIST.map((t) => (
              <label
                key={t.code}
                className="flex items-start gap-2 px-2 py-1.5 rounded-md border border-slate-200 bg-white text-xs cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!!props.toolsChecks[t.code]}
                  onChange={(e) =>
                    props.setToolsChecks((prev) => ({
                      ...prev,
                      [t.code]: e.target.checked,
                    }))
                  }
                  className="mt-0.5"
                />
                <span className="text-slate-700">{t.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Emergency Preparedness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Exit Routes Identified *</Label>
            <Textarea
              rows={2}
              value={props.exitRoutes}
              onChange={(e) => props.setExitRoutes(e.target.value)}
              placeholder="Describe primary & secondary exit routes from the worksite"
            />
          </div>
          <label className="flex items-start gap-2 p-2 rounded-md border border-amber-200 bg-amber-50 cursor-pointer">
            <input
              type="checkbox"
              checked={props.emergencyConfirmed}
              onChange={(e) => props.setEmergencyConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <div className="text-xs text-amber-800">
              <span className="font-medium">Emergency contacts confirmed</span>
              <div className="text-amber-700">
                Crew knows muster point, security number and on-call rescue.
              </div>
            </div>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Heart size={16} /> Fitness Declaration
          </CardTitle>
          <CardDescription className="text-xs">
            Each crew member self-declares fitness. Declaring "not fit" blocks sign-off.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {props.fitness.length === 0 && (
            <div className="text-xs text-slate-500">Add crew members in Step 2 first.</div>
          )}
          {props.fitness.map((f) => (
            <div
              key={f.userId}
              className={[
                "rounded-md border p-3 space-y-2",
                f.isFit ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{f.userName}</div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => updateFitness(f.userId, { isFit: true })}
                    className={[
                      "px-2 py-1 rounded text-[11px] font-medium border",
                      f.isFit
                        ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600",
                    ].join(" ")}
                  >
                    Fit
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFitness(f.userId, { isFit: false })}
                    className={[
                      "px-2 py-1 rounded text-[11px] font-medium border",
                      !f.isFit && f.isFit !== undefined
                        ? "bg-rose-100 border-rose-300 text-rose-700"
                        : "bg-white border-slate-200 text-slate-600",
                    ].join(" ")}
                  >
                    Not fit
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-start gap-1.5 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={f.hadAdequateRest}
                    onChange={(e) =>
                      updateFitness(f.userId, { hadAdequateRest: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span>Adequate rest</span>
                </label>
                <label className="flex items-start gap-1.5 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={f.underInfluenceCheck}
                    onChange={(e) =>
                      updateFitness(f.userId, { underInfluenceCheck: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span>Not under influence</span>
                </label>
                <label className="flex items-start gap-1.5 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={f.hasMedicalCondition}
                    onChange={(e) =>
                      updateFitness(f.userId, { hasMedicalCondition: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span>Has medical condition</span>
                </label>
              </div>

              {f.hasMedicalCondition && (
                <Textarea
                  rows={2}
                  value={f.conditionsDeclared}
                  onChange={(e) =>
                    updateFitness(f.userId, { conditionsDeclared: e.target.value })
                  }
                  placeholder="Brief description of condition (visible to supervisor)"
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Step 5: Review ───────────────────────────────────────────────────

function Step5Review(props: {
  plantName: string;
  location: string;
  specificLocation: string;
  date: string;
  startTime: string;
  jobDescription: string;
  selectedPermit: EligiblePermit | null;
  teamMemberIds: string[];
  crewNamesById: Record<string, string>;
  jobSteps: JobStep[];
  fitness: FitnessDeclaration[];
}) {
  const totalHazards = props.jobSteps.reduce((acc, s) => acc + s.hazards.length, 0);
  const fitCount = props.fitness.filter((f) => f.isFit).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Review & Submit</CardTitle>
          <CardDescription className="text-xs">
            Confirm everything below. After submit, each crew member must sign on-site
            from their own device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {props.selectedPermit && (
            <div className="rounded-md border border-primary-200 bg-primary-50 p-2">
              <div className="text-[11px] text-primary-700">Linked Permit</div>
              <div className="font-mono font-semibold text-primary-900">
                {props.selectedPermit.number}
              </div>
            </div>
          )}

          <ReviewRow label="Plant" value={props.plantName} />
          <ReviewRow
            label="Location"
            value={`${props.location}${props.specificLocation ? " · " + props.specificLocation : ""}`}
          />
          <ReviewRow
            label="Date"
            value={`${props.date}${props.startTime ? " at " + props.startTime : ""}`}
          />
          <ReviewRow label="Job" value={props.jobDescription} />
          <ReviewRow
            label="Crew"
            value={`${props.teamMemberIds.length} member${props.teamMemberIds.length === 1 ? "" : "s"}`}
          />
          <ReviewRow
            label="Hazards"
            value={`${props.jobSteps.length} step${props.jobSteps.length === 1 ? "" : "s"} · ${totalHazards} hazard${totalHazards === 1 ? "" : "s"}`}
          />
          <ReviewRow
            label="Fitness"
            value={`${fitCount} of ${props.fitness.length} declared fit`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Crew Sign-off (after submit)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {props.teamMemberIds.map((uid) => (
              <div
                key={uid}
                className="flex items-center justify-between p-2 rounded-md border border-slate-200 bg-white text-xs"
              >
                <span className="font-medium">{props.crewNamesById[uid] ?? uid}</span>
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                  Pending sign-off
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 pb-2 last:border-b-0">
      <div className="text-xs text-slate-500 w-20 shrink-0">{label}</div>
      <div className="text-sm text-slate-800 flex-1 break-words">{value || "—"}</div>
    </div>
  );
}

// ─── PermitPicker ─────────────────────────────────────────────────────

function PermitPicker({ onSelect }: { onSelect: (p: EligiblePermit) => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<EligiblePermit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/permits/eligible-for-flra${query ? `?q=${encodeURIComponent(query)}` : ""}`
        );
        const j = await r.json();
        if (!cancelled) setItems(j.items ?? []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const filtered = items ?? [];
  const eligibleNoFlra = filtered.filter((p) => p.flras.length === 0);

  return (
    <div className="space-y-2">
      <Input
        type="text"
        placeholder="Search by permit number, location, or scope…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="rounded-md border border-slate-200 bg-white shadow-sm max-h-64 overflow-auto">
          {loading && <div className="p-3 text-xs text-slate-500">Searching…</div>}
          {!loading && eligibleNoFlra.length === 0 && (
            <div className="p-3 text-xs text-slate-500">
              No approved permits available to link. Permits with an in-progress or completed
              FLRA are filtered out — use Re-do FLRA on the permit detail page if needed.
            </div>
          )}
          {!loading &&
            eligibleNoFlra.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 border-b border-slate-100 last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold">{p.number}</span>
                  <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                    {humanize(p.type)}
                  </Badge>
                  <Badge
                    className={
                      p.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"
                        : "bg-blue-100 text-blue-700 border-blue-200 text-[10px]"
                    }
                  >
                    {humanize(p.status)}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {p.location} · {p.plant.name}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{p.scopeOfWork}</div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
