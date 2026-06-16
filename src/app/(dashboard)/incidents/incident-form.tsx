"use client";

// Phase 1 Initial Report form (production-depth refactor, Commit 2).
//
// First responders fill this within ~1 hour of occurrence. Optimised for
// speed and minimal cognitive load while still capturing the essentials
// regulators expect on Form 18 / DGFASLI submissions.
//
// Sections, in order:
//   1. When                    — date/time of occurrence + reporting delay
//   2. Where                   — plant / dept / area / GPS / shift / weather
//   3. What Happened           — description + activity context
//   4. People Involved (multi) — role + injury detail per person
//   5. Witnesses (multi)       — name + role (full statements come Phase 3)
//   6. Equipment & Permit      — equipment multi-pick + active PTW
//   7. Initial Action          — what was done on the spot
//   8. Evidence Photos         — multi-file upload (mandatory for injury)
//
// Submit triggers (server-side):
//   • Generate incidentNumber per plant
//   • Compute reportingDelayMinutes + initialReportSlaTargetAt
//   • Auto-detect active PTW + linked observations (last 90d, same area)
//   • Auto-link source Near Miss when ?fromNearMiss=NM_ID is in URL
//   • Initiate workflow + notify Plant HSE Manager
//
// RCA / CAPAs / cost breakdown / investigation team are deferred to
// Phase 2 (classification) and Phase 3 (investigation) — they are NOT
// captured here. The Python /api/incidents POST endpoint still accepts
// those fields for back-compat with older clients.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readApiError } from "@/lib/client-errors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserPicker } from "@/components/ui/user-picker";
import { useToast } from "@/components/ui/toast";
import { GpsCaptureStatus } from "@/components/ui/gps-capture";
import { useGeolocation } from "@/hooks/use-geolocation";
import { AlertCircle, Camera, Trash2, Upload, MapPin, Clock, X, ChevronDown, ChevronRight, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { RcaEditor, useRcaMethodSwitcher } from "@/components/incidents/rca-editor";
import { type RcaMethod, RCA_METHODS_LIST, emptyDataFor, isEmptyRcaData } from "@/lib/rca/types";

type Plant = { id: string; name: string; areas: { id: string; name: string }[] };
type Department = { id: string; plantId: string; name: string };
type EquipmentRow = { id: string; code: string; name: string };
type MasterListItem = { id: string; code: string; label: string };

const TYPES = [
  { value: "FIRST_AID", label: "First Aid Case (FAC)" },
  { value: "MTC", label: "Medical Treatment Case (MTC)" },
  { value: "RWC", label: "Restricted Work Case (RWC)" },
  { value: "LTI", label: "Lost Time Injury (LTI)" },
  { value: "FATALITY", label: "Fatality" },
  { value: "PROPERTY_DAMAGE", label: "Property Damage" },
  { value: "ENVIRONMENTAL", label: "Environmental Release" },
  { value: "FIRE", label: "Fire / Explosion" },
  { value: "PROCESS_SAFETY", label: "Process Safety" },
  { value: "HIPO_NEAR_MISS", label: "High-Potential Near Miss" }
];

const PERSON_ROLES = ["VICTIM", "INJURED", "WITNESS", "RESPONDER", "OPERATOR", "SUPERVISOR"] as const;

const MAX_PHOTOS = 5;
const MAX_PHOTO_SIZE = 50 * 1024 * 1024;

type LocalPhoto = { tempId: string; file: File; previewUrl?: string; error?: string };

type PersonRow = {
  tempId: string;
  userId: string | null;
  externalName: string;
  externalContact: string;
  role: typeof PERSON_ROLES[number];
  isContractor: boolean;
  contractorCompanyId: string | null;
  isInjured: boolean;
  bodyPartAffected: string;
  natureOfInjury: string;
  injurySeverity: "" | "MINOR" | "MAJOR" | "FATAL";
  treatment: string;
  hospitalName: string;
  daysOff: string;
};

type WitnessRow = {
  tempId: string;
  witnessUserId: string | null;
  witnessName: string;
  witnessRole: string;
  language: string;
};

type EquipmentInputRow = {
  tempId: string;
  equipmentId: string;
  involvement: string;
  damageEstimate: string;
};

function tempId() {
  return `tmp-${Math.random().toString(36).slice(2, 11)}`;
}

export function IncidentForm({ plants }: { plants: Plant[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const sourceNearMissId = searchParams.get("fromNearMiss");

  // ─── Section 1: When ──────────────────────────────────────────────
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  const [occurredAt, setOccurredAt] = useState(nowLocal);
  const reportingDelayMinutes = useMemo(() => {
    const occ = new Date(occurredAt).getTime();
    if (Number.isNaN(occ)) return null;
    const diff = Math.max(0, Math.floor((Date.now() - occ) / 60_000));
    return diff;
  }, [occurredAt]);

  // ─── Section 2: Where ─────────────────────────────────────────────
  const [type, setType] = useState("FIRST_AID");
  const [plantId, setPlantId] = useState(plants[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [specificLocation, setSpecificLocation] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [weatherConditions, setWeatherConditions] = useState("");
  const { coords: gps, status: gpsStatus, error: gpsError, request: requestGps } = useGeolocation();
  const selectedPlant = useMemo(() => plants.find((p) => p.id === plantId), [plants, plantId]);

  // ─── Section 3: What Happened ─────────────────────────────────────
  const [description, setDescription] = useState("");
  const [activityBeingPerformed, setActivityBeingPerformed] = useState("");
  const [activityIsRoutine, setActivityIsRoutine] = useState<"" | "yes" | "no">("");

  // ─── Section 4: People Involved ───────────────────────────────────
  const [persons, setPersons] = useState<PersonRow[]>([]);

  // ─── Section 5: Witnesses ─────────────────────────────────────────
  const [witnesses, setWitnesses] = useState<WitnessRow[]>([]);

  // ─── Section 6: Equipment & Permit ────────────────────────────────
  const [equipmentRows, setEquipmentRows] = useState<EquipmentInputRow[]>([]);
  const [activePermitId, setActivePermitId] = useState("");

  // ─── Section 7: Initial Action ────────────────────────────────────
  const [immediateAction, setImmediateAction] = useState("");

  // ─── Section 8: Photos ────────────────────────────────────────────
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ─── Section 9: Root Cause Analysis ───────────────────────────────
  // Expanded by default so reporters see the analysis forms (5-Why,
  // Fishbone, TapRoot, FTA, Bowtie, Cause Map). Still optional —
  // submitting empty keeps the field null. Investigation team can refine
  // later via the InvestigationPanel on the detail page.
  const [rcaOpen, setRcaOpen] = useState(true);
  const [rcaMethod, setRcaMethod] = useState<RcaMethod | null>(null);
  const [rcaData, setRcaData] = useState<unknown>(null);
  const [immediateCauseText, setImmediateCauseText] = useState("");
  const switchRcaMethod = useRcaMethodSwitcher({
    current: rcaMethod,
    data: rcaData,
    onConfirmedSwitch: (m, d) => { setRcaMethod(m); setRcaData(d); }
  });
  const rcaHasContent = rcaMethod != null && !isEmptyRcaData(rcaMethod, rcaData);

  // ─── Masters fetched from Python (per plant) ──────────────────────
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [equipmentList, setEquipmentList] = useState<EquipmentRow[]>([]);
  const [shifts, setShifts] = useState<MasterListItem[]>([]);

  const isInjuryType = ["FIRST_AID", "MTC", "RWC", "LTI", "FATALITY"].includes(type);
  const photosMandatory = isInjuryType || type === "FATALITY";
  const validPhotos = photos.filter((p) => !p.error);

  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<"" | "creating" | "uploading">("");
  const [error, setError] = useState("");

  // ─── Master fetches ──────────────────────────────────────────────
  // Shifts come from a generic master, fetched once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/near-miss/masters/items?type=SHIFT");
        const j = await res.json().catch(() => []);
        if (!cancelled) setShifts(Array.isArray(j) ? j : []);
      } catch {
        /* swallow — shift is optional */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Departments + equipment per plant. Re-fetches when plant changes.
  // RBAC-filtered server-side: workers see only their dept; HSE manager
  // sees all. Same masters endpoint as Near Miss.
  useEffect(() => {
    if (!plantId) {
      setDepartments([]); setEquipmentList([]); setLoadingDepartments(false);
      return;
    }
    let cancelled = false;
    setLoadingDepartments(true);
    (async () => {
      try {
        const [d, e] = await Promise.all([
          fetch(`/api/near-miss/masters/departments?plant_id=${encodeURIComponent(plantId)}`).then((r) => r.json()).catch(() => []),
          fetch(`/api/near-miss/masters/equipment?plant_id=${encodeURIComponent(plantId)}`).then((r) => r.json()).catch(() => [])
        ]);
        if (!cancelled) {
          setDepartments(Array.isArray(d) ? d : []);
          setEquipmentList(Array.isArray(e) ? e : []);
        }
      } catch {
        if (!cancelled) { setDepartments([]); setEquipmentList([]); }
      } finally {
        if (!cancelled) setLoadingDepartments(false);
      }
    })();
    return () => { cancelled = true; };
  }, [plantId]);

  // ─── Photo handling ──────────────────────────────────────────────
  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    const next: LocalPhoto[] = [];
    for (const file of incoming) {
      if (photos.length + next.length >= MAX_PHOTOS) break;
      if (file.size > MAX_PHOTO_SIZE) {
        next.push({ tempId: tempId(), file, error: `Too large (${Math.round(file.size / 1024 / 1024)} MB; max 50 MB)` });
        continue;
      }
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      next.push({ tempId: tempId(), file, previewUrl });
    }
    setPhotos((prev) => [...prev, ...next]);
  }
  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.tempId === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.tempId !== id);
    });
  }

  // ─── Sub-form row management ─────────────────────────────────────
  function addPerson() {
    setPersons((p) => [
      ...p,
      {
        tempId: tempId(),
        userId: null,
        externalName: "",
        externalContact: "",
        role: "INJURED",
        isContractor: false,
        contractorCompanyId: null,
        isInjured: true,
        bodyPartAffected: "",
        natureOfInjury: "",
        injurySeverity: "MINOR",
        treatment: "",
        hospitalName: "",
        daysOff: ""
      }
    ]);
  }
  function updatePerson(id: string, patch: Partial<PersonRow>) {
    setPersons((p) => p.map((r) => (r.tempId === id ? { ...r, ...patch } : r)));
  }
  function removePerson(id: string) {
    setPersons((p) => p.filter((r) => r.tempId !== id));
  }

  function addWitness() {
    setWitnesses((w) => [...w, { tempId: tempId(), witnessUserId: null, witnessName: "", witnessRole: "", language: "English" }]);
  }
  function updateWitness(id: string, patch: Partial<WitnessRow>) {
    setWitnesses((w) => w.map((r) => (r.tempId === id ? { ...r, ...patch } : r)));
  }
  function removeWitness(id: string) {
    setWitnesses((w) => w.filter((r) => r.tempId !== id));
  }

  function addEquipment() {
    setEquipmentRows((e) => [...e, { tempId: tempId(), equipmentId: "", involvement: "DIRECTLY_INVOLVED", damageEstimate: "" }]);
  }
  function updateEquipment(id: string, patch: Partial<EquipmentInputRow>) {
    setEquipmentRows((e) => e.map((r) => (r.tempId === id ? { ...r, ...patch } : r)));
  }
  function removeEquipment(id: string) {
    setEquipmentRows((e) => e.filter((r) => r.tempId !== id));
  }

  // ─── Submit ──────────────────────────────────────────────────────
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!plantId) { setError("Plant is required"); return; }
    if (!areaId) { setError("Area is required"); return; }
    if (!description || description.trim().length < 10) {
      setError("Description must be at least 10 characters."); return;
    }
    if (photosMandatory && validPhotos.length === 0) {
      setError(`At least one photo is required for ${type} severity.`); return;
    }
    if (persons.some((p) => !p.userId && !p.externalName.trim())) {
      setError("Each person involved needs either an internal user or an external name."); return;
    }

    setSubmitting(true);
    setSubmitStage("creating");

    const payload = {
      type,
      plantId,
      areaId,
      location: specificLocation || (selectedPlant?.areas.find((a) => a.id === areaId)?.name ?? ""),
      date: new Date(occurredAt).toISOString(),  // legacy field
      occurredAt: new Date(occurredAt).toISOString(),
      departmentId: departmentId || null,
      specificLocation: specificLocation || null,
      gpsLatitude: gps?.lat ?? null,
      gpsLongitude: gps?.lng ?? null,
      shiftId: shiftId || null,
      weatherConditions: weatherConditions || null,
      description,
      initialDescription: description,
      immediateAction: immediateAction || null,
      activityBeingPerformed: activityBeingPerformed || null,
      activityIsRoutine: activityIsRoutine === "" ? null : activityIsRoutine === "yes",
      activePermitId: activePermitId || null,
      sourceNearMissId: sourceNearMissId || null,
      personsInvolved: persons.map((p) => ({
        userId: p.userId,
        externalName: p.externalName || null,
        externalContact: p.externalContact || null,
        role: p.role,
        isContractor: p.isContractor,
        contractorCompanyId: p.contractorCompanyId,
        isInjured: p.isInjured,
        bodyPartAffected: p.bodyPartAffected || null,
        natureOfInjury: p.natureOfInjury || null,
        injurySeverity: p.injurySeverity || null,
        treatment: p.treatment || null,
        hospitalName: p.hospitalName || null,
        daysOff: p.daysOff ? Number(p.daysOff) : null
      })),
      witnesses: witnesses.filter((w) => w.witnessName.trim()).map((w) => ({
        witnessUserId: w.witnessUserId,
        witnessName: w.witnessName,
        witnessRole: w.witnessRole || null,
        language: w.language || null
      })),
      equipmentInvolved: equipmentRows.filter((r) => r.equipmentId).map((r) => ({
        equipmentId: r.equipmentId,
        involvement: r.involvement,
        damageEstimate: r.damageEstimate ? Number(r.damageEstimate) : null
      })),
      // Optional RCA pre-filled by the reporter. Only sent when both
      // method + non-empty data are present so we don't overwrite the
      // server-side defaults with an empty editor.
      immediateCause: immediateCauseText.trim() || null,
      ...(rcaHasContent && rcaMethod
        ? { rootCauseMethod: rcaMethod, rootCauseData: rcaData }
        : {})
    };

    let createdId = "";
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setError(await readApiError(res, "Failed to submit incident"));
        setSubmitting(false);
        setSubmitStage("");
        return;
      }
      const j = await res.json();
      createdId = j.id;
    } catch (err: any) {
      setError(err?.message ?? "Network error. Check your connection and retry.");
      setSubmitting(false);
      setSubmitStage("");
      return;
    }

    // ─── Phase 2: upload photos in parallel after create ───────────
    if (validPhotos.length > 0 && createdId) {
      setSubmitStage("uploading");
      // Best-effort: failures are surfaced on the detail page rather
      // than blocking the redirect.
      await Promise.all(validPhotos.map((p) => uploadOnePhoto(createdId, p)));
    }

    toast({ variant: "success", title: "Incident reported", description: "Plant HSE Manager has been notified." });
    router.push(`/incidents/${createdId}?just-created=1`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-4xl">
      {sourceNearMissId && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 flex items-center gap-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          Auto-promoting from near miss <span className="font-mono">{sourceNearMissId}</span>. Most context will be linked automatically.
        </div>
      )}

      {/* ─── 1. When ─── */}
      <Card>
        <CardHeader>
          <CardTitle>When</CardTitle>
          <CardDescription>Capture the precise time of occurrence — gap with reporting matters for compliance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Date & Time of Occurrence <span className="text-rose-600">*</span></Label>
              <Input type="datetime-local" value={occurredAt} max={nowLocal}
                onChange={(e) => setOccurredAt(e.target.value)} required />
            </div>
            <div>
              <Label>Reporting Delay</Label>
              <div className={cn(
                "h-10 rounded-md border px-3 flex items-center gap-1.5 text-sm",
                reportingDelayMinutes !== null && reportingDelayMinutes > 60
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-slate-300 bg-slate-50 text-slate-700"
              )}>
                <Clock size={13} />
                {reportingDelayMinutes === null
                  ? "—"
                  : reportingDelayMinutes < 1
                    ? "Reporting now"
                    : `Reported ${reportingDelayMinutes} minute${reportingDelayMinutes === 1 ? "" : "s"} after occurrence`}
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Incident Type <span className="text-rose-600">*</span></Label>
              <Select value={type} onChange={(e) => setType(e.target.value)} required>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Plant HSE Manager confirms or reclassifies during Phase 2.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 2. Where ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Where</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Plant <span className="text-rose-600">*</span></Label>
              <Select value={plantId} onChange={(e) => { setPlantId(e.target.value); setAreaId(""); setDepartmentId(""); }} required>
                {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={loadingDepartments}>
                <option value="">
                  {loadingDepartments
                    ? "Loading departments…"
                    : departments.length === 0
                      ? "— No departments available —"
                      : "— Select —"}
                </option>
                {!loadingDepartments && departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Area <span className="text-rose-600">*</span></Label>
              <Select value={areaId} onChange={(e) => setAreaId(e.target.value)} required>
                <option value="">— Select —</option>
                {selectedPlant?.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Specific Location</Label>
              <Input value={specificLocation} onChange={(e) => setSpecificLocation(e.target.value)}
                placeholder="e.g. near south packer #3 outlet" />
            </div>
            <div>
              <Label>Shift</Label>
              <Select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
                <option value="">— Select —</option>
                {shifts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Weather Conditions</Label>
              <Input value={weatherConditions} onChange={(e) => setWeatherConditions(e.target.value)}
                placeholder="e.g. light rain, 28°C" />
            </div>
          </div>
          <div className="mt-2">
            <GpsCaptureStatus
              status={gpsStatus}
              coords={gps}
              error={gpsError}
              onRetry={requestGps}
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── 3. What Happened ─── */}
      <Card>
        <CardHeader>
          <CardTitle>What Happened</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Initial Description <span className="text-rose-600">*</span></Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened, where, and any immediate context (10 chars min)..."
              required minLength={10} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Activity Being Performed</Label>
              <Input value={activityBeingPerformed} onChange={(e) => setActivityBeingPerformed(e.target.value)}
                placeholder="e.g. raw mill PM, kiln tyre replacement" />
            </div>
            <div>
              <Label>Was the activity routine?</Label>
              <Select value={activityIsRoutine} onChange={(e) => setActivityIsRoutine(e.target.value as "" | "yes" | "no")}>
                <option value="">— Unknown —</option>
                <option value="yes">Yes — routine activity</option>
                <option value="no">No — non-routine</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 3b. Root Cause Analysis (5-Why / Fishbone / TapRoot / FTA / Bowtie / Cause Map) ─── */}
      <Card className="border-violet-300 bg-violet-50/30">
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setRcaOpen((v) => !v)}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-violet-900">
                <Brain size={18} className="text-violet-700" />
                Root Cause Analysis
                <span className="text-xs font-normal text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">optional</span>
                {rcaHasContent && rcaMethod && (
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    {RCA_METHODS_LIST.find((m) => m.code === rcaMethod)?.label} filled
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Pick a method below to expose the corresponding template — 5-Why ladder, Fishbone (Ishikawa) 6M grid, TapRoot SnapCharT, FTA tree, Bowtie barriers, or Cause Map. Investigation team can refine later.
              </CardDescription>
            </div>
            {rcaOpen
              ? <ChevronDown size={18} className="text-slate-500 flex-shrink-0" />
              : <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />}
          </div>
        </CardHeader>
        {rcaOpen && (
          <CardContent className="space-y-4 bg-white rounded-b-lg">
            <div>
              <Label>Immediate Cause (free text)</Label>
              <Textarea
                rows={2}
                value={immediateCauseText}
                onChange={(e) => setImmediateCauseText(e.target.value)}
                placeholder="One-line cause as you see it now — e.g. 'Walkway not cordoned despite known oil leak'."
              />
            </div>

            <div>
              <Label>RCA Method <span className="text-xs font-normal text-slate-500">— picks which template to show</span></Label>
              <Select
                value={rcaMethod ?? ""}
                onChange={(e) => {
                  const next = e.target.value as RcaMethod | "";
                  if (!next) {
                    setRcaMethod(null);
                    setRcaData(null);
                    return;
                  }
                  if (!rcaMethod) {
                    setRcaMethod(next);
                    setRcaData(emptyDataFor(next));
                    return;
                  }
                  switchRcaMethod(next);
                }}
              >
                <option value="">— Pick a method to start the analysis —</option>
                {RCA_METHODS_LIST.map((m) => (
                  <option key={m.code} value={m.code}>{m.label}</option>
                ))}
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                5-Why for simple causal chains. Fishbone (Ishikawa) for multi-cause analysis across 6M categories. TapRoot for high-severity events. Bowtie for barrier analysis.
              </p>
            </div>

            {rcaMethod && (
              <div className="pt-1">
                <RcaEditor
                  method={rcaMethod}
                  value={rcaData}
                  onChange={(next) => setRcaData(next)}
                  readOnly={false}
                />
              </div>
            )}
            {!rcaMethod && (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600">
                Pick an RCA method above to load the corresponding template (5-Why, Fishbone, TapRoot, etc.).
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ─── 4. People Involved ─── */}
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>People Involved</CardTitle>
            <CardDescription>Add each person with their role. Capture injury detail for victims.</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addPerson}>+ Add Person</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {persons.length === 0 && (
            <div className="text-sm text-slate-500 italic">No persons added.</div>
          )}
          {persons.map((p) => (
            <div key={p.tempId} className="rounded-lg border border-slate-200 p-3 space-y-3 bg-slate-50/50">
              <div className="flex items-start justify-between">
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Person</div>
                <button type="button" onClick={() => removePerson(p.tempId)} className="text-slate-400 hover:text-rose-600">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Internal Employee</Label>
                  <UserPicker value={p.userId} onChange={(id) => updatePerson(p.tempId, { userId: id })}
                    filter={{ plantId }} placeholder="Search & select…" />
                </div>
                <div>
                  <Label>Or External Name</Label>
                  <Input value={p.externalName} onChange={(e) => updatePerson(p.tempId, { externalName: e.target.value })}
                    placeholder="If visitor / public / external" />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={p.role} onChange={(e) => updatePerson(p.tempId, { role: e.target.value as PersonRow["role"] })}>
                    {PERSON_ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id={`inj-${p.tempId}`} checked={p.isInjured}
                    onChange={(e) => updatePerson(p.tempId, { isInjured: e.target.checked })} />
                  <Label htmlFor={`inj-${p.tempId}`} className="!mb-0">This person was injured</Label>
                </div>
              </div>

              {p.isInjured && (
                <div className="grid sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200">
                  <div>
                    <Label>Body Part</Label>
                    <Input value={p.bodyPartAffected}
                      onChange={(e) => updatePerson(p.tempId, { bodyPartAffected: e.target.value })}
                      placeholder="e.g. Right knee" />
                  </div>
                  <div>
                    <Label>Nature of Injury</Label>
                    <Input value={p.natureOfInjury}
                      onChange={(e) => updatePerson(p.tempId, { natureOfInjury: e.target.value })}
                      placeholder="e.g. Soft tissue contusion" />
                  </div>
                  <div>
                    <Label>Severity</Label>
                    <Select value={p.injurySeverity}
                      onChange={(e) => updatePerson(p.tempId, { injurySeverity: e.target.value as PersonRow["injurySeverity"] })}>
                      <option value="">—</option>
                      <option value="MINOR">Minor</option>
                      <option value="MAJOR">Major</option>
                      <option value="FATAL">Fatal</option>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Treatment / Hospital</Label>
                    <Input value={p.treatment}
                      onChange={(e) => updatePerson(p.tempId, { treatment: e.target.value })}
                      placeholder="First aid administered, taken to ABC Hospital..." />
                  </div>
                  <div>
                    <Label>Days Off (estimate)</Label>
                    <Input type="number" min={0} value={p.daysOff}
                      onChange={(e) => updatePerson(p.tempId, { daysOff: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ─── 5. Witnesses ─── */}
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Witnesses</CardTitle>
            <CardDescription>Just names + roles for now. Full statements are taken during the investigation.</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addWitness}>+ Add Witness</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {witnesses.length === 0 && (
            <div className="text-sm text-slate-500 italic">No witnesses added.</div>
          )}
          {witnesses.map((w) => (
            <div key={w.tempId} className="rounded-lg border border-slate-200 p-3 grid sm:grid-cols-[1fr_1fr_140px_auto] gap-3 items-start bg-slate-50/50">
              <div>
                <Label>Witness Name</Label>
                <Input value={w.witnessName} onChange={(e) => updateWitness(w.tempId, { witnessName: e.target.value })}
                  placeholder="Full name" required />
              </div>
              <div>
                <Label>Role / Designation</Label>
                <Input value={w.witnessRole} onChange={(e) => updateWitness(w.tempId, { witnessRole: e.target.value })}
                  placeholder="e.g. Senior Operator" />
              </div>
              <div>
                <Label>Language</Label>
                <Select value={w.language} onChange={(e) => updateWitness(w.tempId, { language: e.target.value })}>
                  <option>English</option>
                  <option>Hindi</option>
                  <option>Bengali</option>
                  <option>Khasi</option>
                </Select>
              </div>
              <button type="button" onClick={() => removeWitness(w.tempId)}
                className="text-slate-400 hover:text-rose-600 mt-7">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ─── 6. Equipment & Permit ─── */}
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Equipment & Permit Context</CardTitle>
            <CardDescription>Add equipment involved. If work was under PTW, the system auto-detects it.</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addEquipment}
            disabled={equipmentList.length === 0}>+ Add Equipment</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {equipmentRows.length === 0 && (
            <div className="text-sm text-slate-500 italic">No equipment added.</div>
          )}
          {equipmentRows.map((r) => (
            <div key={r.tempId} className="rounded-lg border border-slate-200 p-3 grid sm:grid-cols-[2fr_1fr_140px_auto] gap-3 items-start bg-slate-50/50">
              <div>
                <Label>Equipment</Label>
                <Select value={r.equipmentId} onChange={(e) => updateEquipment(r.tempId, { equipmentId: e.target.value })}>
                  <option value="">— Select —</option>
                  {equipmentList.map((eq) => <option key={eq.id} value={eq.id}>{eq.name} ({eq.code})</option>)}
                </Select>
              </div>
              <div>
                <Label>Involvement</Label>
                <Select value={r.involvement} onChange={(e) => updateEquipment(r.tempId, { involvement: e.target.value })}>
                  <option value="DIRECTLY_INVOLVED">Directly involved</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="INADEQUATE_GUARDING">Inadequate guarding</option>
                  <option value="MALFUNCTION">Malfunction</option>
                </Select>
              </div>
              <div>
                <Label>Damage (₹)</Label>
                <Input type="number" min={0} value={r.damageEstimate}
                  onChange={(e) => updateEquipment(r.tempId, { damageEstimate: e.target.value })} />
              </div>
              <button type="button" onClick={() => removeEquipment(r.tempId)}
                className="text-slate-400 hover:text-rose-600 mt-7">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ─── 7. Initial Action ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Initial Action Taken</CardTitle>
          <CardDescription>What was done on the spot to secure the area, treat injured, or contain the event.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea rows={3} value={immediateAction} onChange={(e) => setImmediateAction(e.target.value)}
            placeholder="e.g. First aid administered, area cordoned, equipment isolated..." />
        </CardContent>
      </Card>

      {/* ─── 8. Photos & Evidence ─── */}
      <Card>
        <CardHeader>
          <CardTitle>
            Site Photos
            {photosMandatory && <span className="ml-2 text-xs font-normal text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">Required for {type}</span>}
          </CardTitle>
          <CardDescription>Up to {MAX_PHOTOS} photos · 50 MB each · phone camera works.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
            <Upload size={20} className="mx-auto text-slate-400 mb-1.5" />
            <p className="text-sm text-slate-700 font-medium">Drag & drop photos here</p>
            <div className="mt-2.5 flex items-center justify-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload size={13} /> Browse
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => cameraInputRef.current?.click()}>
                <Camera size={13} /> Take Photo
              </Button>
            </div>
            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,application/pdf"
              className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={cameraInputRef} type="file" accept="image/*"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...({ capture: "environment" } as any)}
              className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
          </div>
          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-3">
              {photos.map((p) => (
                <div key={p.tempId} className="relative aspect-square rounded-md border bg-slate-100 overflow-hidden">
                  {p.previewUrl
                    ? <img src={p.previewUrl} className="w-full h-full object-cover" alt="" />
                    : <div className="flex items-center justify-center h-full text-xs text-slate-500">{p.file.name.slice(0, 30)}</div>}
                  <button type="button" onClick={() => removePhoto(p.tempId)}
                    className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-0.5 hover:bg-black">
                    <X size={12} />
                  </button>
                  {p.error && (
                    <div className="absolute inset-x-0 bottom-0 bg-rose-700 text-white text-[10px] px-1 py-0.5">{p.error}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error + submit */}
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 -mx-6 px-6 py-3">
        <div className="text-xs text-slate-500">
          {photos.length} photo{photos.length === 1 ? "" : "s"} · {persons.length} person{persons.length === 1 ? "" : "s"} · {witnesses.length} witness{witnesses.length === 1 ? "" : "es"}
        </div>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitStage === "creating" ? "Submitting…" : submitStage === "uploading" ? "Uploading photos…" : "Submit Initial Report"}
        </Button>
      </div>
    </form>
  );
}

// ─── Photo upload helper (two-phase: init → presigned PUT → complete) ───
async function uploadOnePhoto(incidentId: string, photo: LocalPhoto): Promise<void> {
  try {
    const initRes = await fetch(`/api/incidents/${incidentId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: "init",
        category: "INITIAL_PHOTO",
        fileName: photo.file.name,
        fileSize: photo.file.size,
        mimeType: photo.file.type
      })
    });
    if (!initRes.ok) return;
    const init = await initRes.json();
    if (!init.uploadUrl || !init.attachmentId) return;
    const putRes = await fetch(init.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": photo.file.type },
      body: photo.file
    });
    if (!putRes.ok) return;
    await fetch(`/api/incidents/${incidentId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: "complete", attachmentId: init.attachmentId })
    });
  } catch {
    /* swallow — surface on detail page */
  }
}
