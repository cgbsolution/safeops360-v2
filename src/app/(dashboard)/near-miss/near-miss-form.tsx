"use client";

// New Near Miss form (Commit 2 of the production-depth refactor).
// Single component covering all 9 sections from the brief. Mobile UX is
// handled by single-column layout + sticky submit button — Tailwind
// breakpoints make the wider layout opt-in via grid utilities.
//
// Photos are uploaded AFTER the near-miss row is created (we need the
// id), using the two-phase pattern from upload-helper.ts. Mandatory for
// HIGH and CRITICAL severities.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPicker } from "@/components/ui/user-picker";
import { GpsCaptureStatus } from "@/components/ui/gps-capture";
import { useGeolocation } from "@/hooks/use-geolocation";
import { readApiError } from "@/lib/client-errors";
import { uploadNearMissAttachment } from "@/components/near-miss/upload-helper";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Loader2,
  MapPin,
  Mic,
  Upload,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

type Plant = { id: string; name: string; areas: { id: string; name: string }[] };

type MasterListItem = { id: string; code: string; label: string; sortOrder: number };
type Department = { id: string; plantId: string; name: string; code: string | null };
type ContractorCompany = { id: string; name: string; score: number };

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
type Severity = (typeof SEVERITIES)[number];

const CONSEQUENCE_TYPES = [
  { code: "INJURY", label: "Injury", subRatings: ["MINOR", "MAJOR", "FATALITY_POTENTIAL"] },
  { code: "PROPERTY_DAMAGE", label: "Property damage", subRatings: [] },
  { code: "ENVIRONMENTAL", label: "Environmental", subRatings: [] },
  { code: "PROCESS_LOSS", label: "Process loss", subRatings: [] },
  { code: "FIRE_EXPLOSION", label: "Fire / explosion potential", subRatings: [] },
  { code: "MULTIPLE_WORKER_IMPACT", label: "Multiple worker impact", subRatings: [] },
  { code: "REPUTATION", label: "Reputation / stakeholder", subRatings: [] }
] as const;

const ROOT_CAUSE_HINTS = [
  { code: "HUMAN_FACTOR", label: "Human factor" },
  { code: "EQUIPMENT", label: "Equipment" },
  { code: "PROCESS", label: "Process / procedure" },
  { code: "ENVIRONMENT", label: "Environment / workplace" },
  { code: "MANAGEMENT_SYSTEM", label: "Management system" },
  { code: "EXTERNAL", label: "External factor" }
];

const REPORTER_TYPES = ["EMPLOYEE", "CONTRACTOR", "EXTERNAL", "ANONYMOUS"] as const;

const MAX_FILES = 5;
const MAX_SIZE = 50 * 1024 * 1024;

type LocalPhoto = {
  tempId: string;
  file: File;
  previewUrl?: string;
  error?: string;
};

type ConsequenceSelection = {
  type: string;
  subRating?: string;
  costEstimate?: number | null;
  substanceEstimate?: string | null;
  downtimeHours?: number | null;
};

export function NearMissForm({ plants }: { plants: Plant[] }) {
  const router = useRouter();
  const [plantId, setPlantId] = useState(plants[0]?.id ?? "");
  const [areaId, setAreaId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [shiftId, setShiftId] = useState<string>("");
  const [severity, setSeverity] = useState<Severity>("MEDIUM");
  const [consequences, setConsequences] = useState<ConsequenceSelection[]>([]);
  const [hazardCategory, setHazardCategory] = useState<string>("");
  const [energySource, setEnergySource] = useState<string>("");
  const [activityType, setActivityType] = useState<string>("");
  const [activityIsRoutine, setActivityIsRoutine] = useState<boolean | null>(null);
  const [reporterType, setReporterType] = useState<string>("EMPLOYEE");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [contractorCompanyId, setContractorCompanyId] = useState<string>("");
  const [personsInvolved, setPersonsInvolved] = useState<string[]>([]);
  const [personsAffected, setPersonsAffected] = useState<string[]>([]);
  const [witnesses, setWitnesses] = useState<string[]>([]);
  const [riskLikelihood, setRiskLikelihood] = useState<number | null>(null);
  const [riskConsequence, setRiskConsequence] = useState<number | null>(null);
  const [initialRootCause, setInitialRootCause] = useState<string>("");
  const [suggestedActionOwnerId, setSuggestedActionOwnerId] = useState<string | null>(null);
  const [multipleWorkers, setMultipleWorkers] = useState(false);

  const { coords: gps, status: gpsStatus, error: gpsError, request: requestGps } = useGeolocation();
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<"" | "creating" | "uploading">("");
  const [error, setError] = useState("");
  const [uploadFailures, setUploadFailures] = useState<{ id: string; fileName: string; error: string }[]>([]);

  // Masters fetched from Python on mount
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [contractors, setContractors] = useState<ContractorCompany[]>([]);
  const [shifts, setShifts] = useState<MasterListItem[]>([]);
  const [activityTypes, setActivityTypes] = useState<MasterListItem[]>([]);
  const [hazardCats, setHazardCats] = useState<MasterListItem[]>([]);
  const [energySources, setEnergySources] = useState<MasterListItem[]>([]);
  const [equipmentList, setEquipmentList] = useState<{ id: string; code: string; name: string }[]>([]);
  const [equipmentId, setEquipmentId] = useState<string>("");

  const today = new Date().toISOString().slice(0, 16);
  const selectedPlant = useMemo(() => plants.find((p) => p.id === plantId), [plants, plantId]);
  const photoMandatory = severity === "HIGH" || severity === "CRITICAL";
  const validPhotos = photos.filter((p) => !p.error);
  const riskScore = riskLikelihood && riskConsequence ? riskLikelihood * riskConsequence : null;
  const riskLevel = useMemo(() => {
    if (!riskScore) return null;
    if (riskScore >= 15) return { label: "CRITICAL", className: "bg-rose-600 text-white border-rose-600" };
    if (riskScore >= 9) return { label: "HIGH", className: "bg-orange-500 text-white border-orange-500" };
    if (riskScore >= 4) return { label: "MEDIUM", className: "bg-amber-400 text-amber-950 border-amber-400" };
    return { label: "LOW", className: "bg-emerald-500 text-white border-emerald-500" };
  }, [riskScore]);

  // Fetch masters once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [shiftRes, actRes, hazRes, energyRes, contractorsRes] = await Promise.all([
          fetch("/api/near-miss/masters/items?type=SHIFT").then((r) => r.json()).catch(() => []),
          fetch("/api/near-miss/masters/items?type=ACTIVITY_TYPE").then((r) => r.json()).catch(() => []),
          fetch("/api/near-miss/masters/items?type=HAZARD_CATEGORY").then((r) => r.json()).catch(() => []),
          fetch("/api/near-miss/masters/items?type=ENERGY_SOURCE").then((r) => r.json()).catch(() => []),
          fetch("/api/near-miss/masters/contractors").then((r) => r.json()).catch(() => [])
        ]);
        if (cancelled) return;
        setShifts(Array.isArray(shiftRes) ? shiftRes : []);
        setActivityTypes(Array.isArray(actRes) ? actRes : []);
        setHazardCats(Array.isArray(hazRes) ? hazRes : []);
        setEnergySources(Array.isArray(energyRes) ? energyRes : []);
        setContractors(Array.isArray(contractorsRes) ? contractorsRes : []);
      } catch {
        /* swallow */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch departments + equipment per plant.
  // We surface a `loadingDepartments` flag for the dropdown so users see
  // "Loading departments…" instead of an empty list during the 1-2s the
  // RBAC-filtered fetch takes — otherwise it looks like there are no
  // departments and people abandon the form.
  useEffect(() => {
    if (!plantId) {
      setDepartments([]); setEquipmentList([]); setEquipmentId("");
      setLoadingDepartments(false);
      return;
    }
    let cancelled = false;
    setLoadingDepartments(true);
    (async () => {
      try {
        const [deptRes, eqRes] = await Promise.all([
          fetch(`/api/near-miss/masters/departments?plant_id=${encodeURIComponent(plantId)}`).then((r) => r.json()).catch(() => []),
          fetch(`/api/near-miss/masters/equipment?plant_id=${encodeURIComponent(plantId)}`).then((r) => r.json()).catch(() => [])
        ]);
        if (!cancelled) {
          setDepartments(Array.isArray(deptRes) ? deptRes : []);
          setEquipmentList(Array.isArray(eqRes) ? eqRes : []);
          setEquipmentId(""); // reset when plant changes
        }
      } catch {
        if (!cancelled) { setDepartments([]); setEquipmentList([]); }
      } finally {
        if (!cancelled) setLoadingDepartments(false);
      }
    })();
    return () => { cancelled = true; };
  }, [plantId]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      photos.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(incoming: FileList | File[]) {
    setError("");
    const list = Array.from(incoming);
    if (photos.length + list.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} photos.`);
      return;
    }
    const accepted: LocalPhoto[] = [];
    for (const f of list) {
      if (f.size > MAX_SIZE) {
        accepted.push({ tempId: crypto.randomUUID(), file: f, error: `Exceeds ${Math.round(MAX_SIZE / 1024 / 1024)} MB` });
        continue;
      }
      const previewUrl = f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined;
      accepted.push({ tempId: crypto.randomUUID(), file: f, previewUrl });
    }
    setPhotos((prev) => [...prev, ...accepted]);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const t = prev.find((p) => p.tempId === id);
      if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl);
      return prev.filter((p) => p.tempId !== id);
    });
  }

  function toggleConsequence(code: string) {
    setConsequences((prev) =>
      prev.find((c) => c.type === code)
        ? prev.filter((c) => c.type !== code)
        : [...prev, { type: code }]
    );
  }
  function setConsequenceField(code: string, patch: Partial<ConsequenceSelection>) {
    setConsequences((prev) => prev.map((c) => (c.type === code ? { ...c, ...patch } : c)));
  }

  // Voice-to-text helper (Web Speech API; gracefully falls through if unsupported)
  function startVoice(setter: (s: string | ((prev: string) => string)) => void) {
    const SpeechRecognition: any =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input not supported in this browser. Use Chrome on Android or desktop.");
      return;
    }
    const r = new SpeechRecognition();
    r.lang = "en-IN";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (ev: any) => {
      const transcript: string = ev.results[0][0].transcript;
      setter((prev: string) => (prev ? prev + " " + transcript : transcript));
    };
    r.start();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setUploadFailures([]);

    if (photoMandatory && validPhotos.length === 0) {
      const ok = confirm(
        `${severity} severity near misses should include at least one photo. Submit without?`
      );
      if (!ok) return;
    }

    setSubmitting(true);
    setStage("creating");

    const fd = new FormData(e.currentTarget);
    const dateStr = (fd.get("date") as string) || "";

    const payload: Record<string, any> = {
      plantId,
      areaId: areaId || null,
      departmentId: departmentId || null,
      shiftId: shiftId || null,
      date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
      description: (fd.get("description") as string) || "",
      specificLocation: ((fd.get("specificLocation") as string) || "").trim() || null,
      gpsLatitude: gps?.lat ?? null,
      gpsLongitude: gps?.lng ?? null,
      reporterType: isAnonymous ? "ANONYMOUS" : reporterType,
      isAnonymous,
      activityBeingPerformed: activityType || null,
      activityIsRoutine,
      activity: ((fd.get("activityFreeText") as string) || "").trim() || null,
      immediateAction: ((fd.get("immediateAction") as string) || "").trim() || null,
      equipmentId: equipmentId || null,
      contractorCompanyId: contractorCompanyId || null,
      potentialSeverity: severity,
      potentialConsequences: consequences.length ? consequences : null,
      multipleWorkersAggravator: multipleWorkers,
      hazardCategory: hazardCategory || null,
      energySource: energySource || null,
      riskLikelihood,
      riskConsequence,
      initialRootCauseCategory: initialRootCause || null,
      controlsThatFailed: ((fd.get("controlsFailed") as string) || "").trim() || null,
      controlsThatWorked: ((fd.get("controlsWorked") as string) || "").trim() || null,
      recommendedActions: ((fd.get("recommendedActions") as string) || "").trim() || null,
      suggestedActionOwnerId: suggestedActionOwnerId || null,
      personsInvolved: personsInvolved.map((u) => ({ userId: u })),
      personsPotentiallyAffected: personsAffected.map((u) => ({ userId: u })),
      witnesses: witnesses.map((u) => ({ userId: u }))
    };

    try {
      const res = await fetch("/api/near-miss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setError(await readApiError(res, "Failed to submit near miss"));
        setSubmitting(false);
        setStage("");
        return;
      }
      const created = await res.json();

      // Upload photos
      const failures: { id: string; fileName: string; error: string }[] = [];
      if (validPhotos.length > 0) {
        setStage("uploading");
        for (const p of validPhotos) {
          const result = await uploadNearMissAttachment(created.id, p.file, "INITIAL_PHOTO");
          if (!result.ok) failures.push({ id: p.tempId, fileName: p.file.name, error: result.error ?? "Upload failed" });
        }
      }
      if (failures.length > 0) {
        setUploadFailures(failures);
        setStage("");
        setSubmitting(false);
        // Still navigate — record exists; photos can be added from detail page
        router.push(`/near-miss/${created.id}?just-created=1&photo-errors=${failures.length}`);
        router.refresh();
        return;
      }

      router.push(`/near-miss/${created.id}?just-created=1`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Network error");
      setSubmitting(false);
      setStage("");
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-6">
          {/* CRITICAL severity warning — sticky, prominent */}
          {severity === "CRITICAL" && (
            <div className="rounded-md border-2 border-rose-400 bg-rose-50 p-4 flex gap-3">
              <AlertTriangle size={20} className="text-rose-700 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-rose-900">
                <strong>This near miss will be auto-promoted to Incident Investigation on submission.</strong>
                <div className="mt-1">
                  Plant HSE Manager and Plant Head will be notified immediately via SMS and email.
                </div>
              </div>
            </div>
          )}

          {/* ── Section 1: When & Where ── */}
          <Section title="When & Where">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date / Time<Req /></Label>
                <Input id="date" name="date" type="datetime-local" defaultValue={today} required />
              </div>
              <div>
                <Label>Plant<Req /></Label>
                <Select value={plantId} onChange={(e) => { setPlantId(e.target.value); setAreaId(""); setDepartmentId(""); }} required>
                  {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={loadingDepartments}
                >
                  <option value="">
                    {loadingDepartments
                      ? "Loading departments…"
                      : departments.length === 0
                        ? "— No departments available —"
                        : "— Select —"}
                  </option>
                  {!loadingDepartments && departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Area</Label>
                <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                  <option value="">— Select —</option>
                  {selectedPlant?.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="specificLocation">Specific location</Label>
                <Input id="specificLocation" name="specificLocation" placeholder="e.g. near south packer #3 outlet" />
              </div>
              <div>
                <Label>Shift</Label>
                <Select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
                  <option value="">— Select —</option>
                  {shifts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
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
          </Section>

          {/* ── Section 2: What Happened ── */}
          <Section title="What Happened">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="description">Description<Req /></Label>
                  <button type="button" className="text-xs text-primary-700 flex items-center gap-1" onClick={() => startVoice((s) => {
                    const el = document.getElementById("description") as HTMLTextAreaElement | null;
                    if (el) {
                      const next = typeof s === "function" ? (s as any)(el.value) : s;
                      el.value = next;
                    }
                  })}>
                    <Mic size={12} /> Voice
                  </button>
                </div>
                <Textarea id="description" name="description" rows={4} required minLength={10} maxLength={1500} placeholder="What did you observe? When? What could have happened?" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Activity being performed</Label>
                  <Select value={activityType} onChange={(e) => setActivityType(e.target.value)}>
                    <option value="">— Select —</option>
                    {activityTypes.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Activity is</Label>
                  <div className="flex gap-2 mt-1">
                    <ToggleButton active={activityIsRoutine === true} onClick={() => setActivityIsRoutine(true)}>Routine</ToggleButton>
                    <ToggleButton active={activityIsRoutine === false} onClick={() => setActivityIsRoutine(false)}>Non-routine</ToggleButton>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="activityFreeText">Other detail (free text)</Label>
                <Input id="activityFreeText" name="activityFreeText" placeholder="anything not captured above" />
              </div>
              <div>
                <Label>Equipment / tool involved</Label>
                <Select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
                  <option value="">— None —</option>
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id}>{eq.code} — {eq.name}</option>
                  ))}
                </Select>
                {plantId && equipmentList.length === 0 && (
                  <p className="text-xs text-slate-500 mt-1">No equipment registered for this plant yet.</p>
                )}
              </div>
            </div>
          </Section>

          {/* ── Section 3: People Involved ── */}
          <Section title="People Involved">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Reporter type</Label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="rounded" />
                  Anonymous reporting
                </label>
              </div>
              {!isAnonymous && (
                <Select value={reporterType} onChange={(e) => setReporterType(e.target.value)}>
                  {REPORTER_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              )}
              <div>
                <Label>Persons directly involved</Label>
                <MultiUserPicker plantId={plantId} value={personsInvolved} onChange={setPersonsInvolved} />
              </div>
              <div>
                <Label>Persons potentially affected (could have been hurt)</Label>
                <MultiUserPicker plantId={plantId} value={personsAffected} onChange={setPersonsAffected} />
              </div>
              <div>
                <Label>Witnesses</Label>
                <MultiUserPicker plantId={plantId} value={witnesses} onChange={setWitnesses} />
              </div>
              <div>
                <Label>Contractor company (if applicable)</Label>
                <Select value={contractorCompanyId} onChange={(e) => setContractorCompanyId(e.target.value)}>
                  <option value="">— None —</option>
                  {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
            </div>
          </Section>

          {/* ── Section 4: Potential Consequence ── */}
          <Section title="Potential Consequence" subtitle="What could have happened — drives the workflow">
            <div className="space-y-4">
              <div>
                <Label>Potential severity<Req /></Label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {SEVERITIES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className={cn(
                        "px-3 py-2 rounded-md border text-sm font-medium transition",
                        severity === s
                          ? s === "CRITICAL"
                            ? "bg-rose-600 text-white border-rose-600"
                            : s === "HIGH"
                            ? "bg-orange-500 text-white border-orange-500"
                            : s === "MEDIUM"
                            ? "bg-amber-400 text-amber-950 border-amber-400"
                            : "bg-emerald-500 text-white border-emerald-500"
                          : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Consequence types (multi-select)</Label>
                <div className="space-y-2 mt-2">
                  {CONSEQUENCE_TYPES.map((c) => {
                    const selected = consequences.find((x) => x.type === c.code);
                    return (
                      <div key={c.code} className="border rounded-md p-2.5">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!selected} onChange={() => toggleConsequence(c.code)} className="rounded" />
                          <span className="font-medium">{c.label}</span>
                        </label>
                        {selected && c.subRatings.length > 0 && (
                          <Select value={selected.subRating ?? ""} onChange={(e) => setConsequenceField(c.code, { subRating: e.target.value })} className="mt-2 h-8 text-xs">
                            <option value="">— Sub-rating —</option>
                            {c.subRatings.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                          </Select>
                        )}
                        {selected && c.code === "PROPERTY_DAMAGE" && (
                          <Input type="number" placeholder="Cost estimate (₹)" className="mt-2 h-8" onChange={(e) => setConsequenceField(c.code, { costEstimate: Number(e.target.value) || null })} />
                        )}
                        {selected && c.code === "PROCESS_LOSS" && (
                          <Input type="number" placeholder="Downtime (hours)" className="mt-2 h-8" onChange={(e) => setConsequenceField(c.code, { downtimeHours: Number(e.target.value) || null })} />
                        )}
                        {selected && c.code === "ENVIRONMENTAL" && (
                          <Input placeholder="Substance / quantity" className="mt-2 h-8" onChange={(e) => setConsequenceField(c.code, { substanceEstimate: e.target.value || null })} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={multipleWorkers} onChange={(e) => setMultipleWorkers(e.target.checked)} className="rounded" />
                Multiple worker impact (escalates severity)
              </label>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Hazard category</Label>
                  <Select value={hazardCategory} onChange={(e) => setHazardCategory(e.target.value)}>
                    <option value="">— Select —</option>
                    {hazardCats.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Energy source</Label>
                  <Select value={energySource} onChange={(e) => setEnergySource(e.target.value)}>
                    <option value="">— Select —</option>
                    {energySources.map((es) => <option key={es.id} value={es.id}>{es.label}</option>)}
                  </Select>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Section 5: Risk Assessment (5×5) ── */}
          <Section title="Risk Assessment (5 × 5)">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Likelihood of recurrence (1-5)</Label>
                <RiskScale value={riskLikelihood} onChange={setRiskLikelihood} />
              </div>
              <div>
                <Label>Severity if it had happened (1-5)</Label>
                <RiskScale value={riskConsequence} onChange={setRiskConsequence} />
              </div>
            </div>
            {riskScore !== null && riskLevel && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-slate-500">Computed risk:</span>
                <Badge className={riskLevel.className}>{riskLevel.label} ({riskScore})</Badge>
              </div>
            )}
          </Section>

          {/* ── Section 6: Existing Controls ── */}
          <Section title="Existing Controls">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="controlsFailed">Controls that failed</Label>
                <Textarea id="controlsFailed" name="controlsFailed" rows={3} placeholder="Existing barriers that should have prevented this..." />
              </div>
              <div>
                <Label htmlFor="controlsWorked">Controls that worked</Label>
                <Textarea id="controlsWorked" name="controlsWorked" rows={3} placeholder="Barriers that DID prevent the incident..." />
              </div>
            </div>
          </Section>

          {/* ── Section 7: Initial Root Cause Hint ── */}
          <Section title="Initial Root Cause Hint">
            <Label>Reporter's first guess</Label>
            <Select value={initialRootCause} onChange={(e) => setInitialRootCause(e.target.value)}>
              <option value="">— Select —</option>
              {ROOT_CAUSE_HINTS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </Select>
          </Section>

          {/* ── Section 8: Site Photos ── */}
          <Section
            title="Site Photos"
            subtitle={
              photoMandatory
                ? `Mandatory for ${severity} severity — at least 1 recommended`
                : "Up to 5 photos / videos / PDFs, 50 MB each"
            }
          >
            <div className="rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
              <Upload size={20} className="mx-auto text-slate-400 mb-1.5" />
              <p className="text-sm text-slate-700 font-medium">Drag &amp; drop or use the buttons</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={13} /> Browse
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => cameraInputRef.current?.click()}>
                  <Camera size={13} /> Take Photo
                </Button>
              </div>
              <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,application/pdf" className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={cameraInputRef} type="file" accept="image/*"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...({ capture: "environment" } as any)}
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
                {photos.map((p) => (
                  <div key={p.tempId} className="relative aspect-square rounded-md border bg-slate-100 overflow-hidden">
                    {p.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">{p.file.name}</div>
                    )}
                    <button type="button" onClick={() => removePhoto(p.tempId)} className="absolute top-1 right-1 bg-white/90 rounded-full p-1 shadow">
                      <X size={12} />
                    </button>
                    {p.error && <div className="absolute inset-x-0 bottom-0 bg-rose-600 text-white text-[10px] px-1 py-0.5 truncate">{p.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Section 9: Immediate Action & Recommendation ── */}
          <Section title="Immediate Action & Recommendation">
            <div className="space-y-4">
              <div>
                <Label htmlFor="immediateAction">Immediate action taken</Label>
                <Textarea id="immediateAction" name="immediateAction" rows={2} placeholder="Steps taken on the spot..." />
              </div>
              <div>
                <Label htmlFor="recommendedActions">Recommended corrective actions</Label>
                <Textarea id="recommendedActions" name="recommendedActions" rows={2} placeholder="What you think should be done..." />
              </div>
              <div>
                <Label>Suggested action owner</Label>
                <UserPicker
                  value={suggestedActionOwnerId}
                  onChange={setSuggestedActionOwnerId}
                  filter={{ plantId: plantId || undefined }}
                  placeholder="Search and pick..."
                />
              </div>
            </div>
          </Section>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {uploadFailures.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Submitted, but {uploadFailures.length} photo{uploadFailures.length === 1 ? "" : "s"} failed. Add them from the detail page.
            </div>
          )}

          <div className="sticky bottom-0 bg-white border-t pt-3 flex gap-3">
            <Button type="submit" disabled={submitting}>
              {stage === "creating" && <><Loader2 size={14} className="animate-spin" /> Submitting…</>}
              {stage === "uploading" && <><Loader2 size={14} className="animate-spin" /> Uploading photos…</>}
              {!stage && "Submit Near Miss"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-white">
      <div className="px-4 pt-3 pb-2 border-b bg-slate-50">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle && <div className="text-[11px] text-slate-500">{subtitle}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Req() {
  return <span className="text-rose-600 ml-0.5">*</span>;
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md border text-sm",
        active ? "bg-primary-700 text-white border-primary-700" : "bg-white text-slate-700 border-slate-300"
      )}
    >
      {children}
    </button>
  );
}

function RiskScale({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1 mt-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "py-2 rounded-md border text-sm font-bold",
            value === n
              ? n >= 4
                ? "bg-rose-500 text-white border-rose-500"
                : n === 3
                ? "bg-amber-400 text-amber-950 border-amber-400"
                : "bg-emerald-500 text-white border-emerald-500"
              : "bg-white text-slate-600 border-slate-300"
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function MultiUserPicker({
  plantId,
  value,
  onChange
}: {
  plantId: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  // Lightweight wrapper around the existing single-user UserPicker. Adds
  // selected ids one at a time; removes via chip click.
  const [working, setWorking] = useState<string | null>(null);
  return (
    <div>
      <UserPicker
        value={working}
        onChange={(id) => {
          if (id && !value.includes(id)) onChange([...value, id]);
          setWorking(null);
        }}
        filter={{ plantId: plantId || undefined }}
        placeholder="Search and add..."
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {value.map((uid) => (
            <ChipUser key={uid} userId={uid} onRemove={() => onChange(value.filter((x) => x !== uid))} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChipUser({ userId, onRemove }: { userId: string; onRemove: () => void }) {
  const [name, setName] = useState<string>(userId.slice(0, 6));
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/users/${userId}`);
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled && j?.name) setName(j.name);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs border">
      {name}
      <button type="button" onClick={onRemove} className="text-slate-400 hover:text-slate-700">×</button>
    </span>
  );
}
