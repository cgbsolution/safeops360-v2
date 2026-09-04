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
import { WorkerInvolvedPicker, type WorkerRef } from "@/components/observations/worker-involved-picker";
import { GpsCaptureStatus } from "@/components/ui/gps-capture";
import { useGeolocation } from "@/hooks/use-geolocation";
import { readApiError } from "@/lib/client-errors";
import { uploadNearMissAttachment } from "@/components/near-miss/upload-helper";
import { DEPARTMENTS } from "@/lib/observation-masters";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  CATEGORY_TO_SEVERITY,
  HAZARD_CATEGORIES,
  HAZARD_OTHER,
  NEAR_MISS_CATEGORIES,
  NEAR_MISS_CATEGORY_OTHER,
  PROBABILITY_LEVELS,
  RISK_CATEGORIES,
  RISK_CATEGORY_LABELS,
  SEVERITY_LEVELS,
  riskCategoryFor,
  riskRating,
  type RiskCategory,
  type RiskLevel
} from "@/lib/near-miss/risk-masters";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Loader2,
  Plus,
  Upload,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

// The site's four shifts. Held here rather than in the SHIFT MasterItem
// master because that master (A/B/C/G) is shared with the Incident form and
// is not this site's roster — reseeding it would have changed Incidents too.
// The code is what gets stored in NearMiss.shiftId; the backend accepts these
// alongside the legacy MasterItem ids (see NEAR_MISS_SHIFTS in the router).
const SHIFT_OPTIONS = [
  { code: "GS", label: "GS — General Shift" },
  { code: "FS", label: "FS — First Shift" },
  { code: "SS", label: "SS — Second Shift" },
  { code: "NS", label: "NS — Night Shift" }
] as const;

type Plant = { id: string; name: string };

type MasterListItem = { id: string; code: string; label: string; sortOrder: number };

// The site's printed card bands risk LOW / MEDIUM / HIGH and has no fourth
// tier, so the form no longer offers CRITICAL. The enum still has it and older
// records still carry it; nothing raised here produces one, which also means
// auto-promotion to an Incident no longer fires from this form.
const SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
type Severity = (typeof SEVERITIES)[number];

const ROOT_CAUSE_HINTS = [
  { code: "HUMAN_FACTOR", label: "Human factor" },
  { code: "EQUIPMENT", label: "Equipment" },
  { code: "PROCESS", label: "Process / procedure" },
  { code: "ENVIRONMENT", label: "Environment / workplace" },
  { code: "MANAGEMENT_SYSTEM", label: "Management system" },
  { code: "EXTERNAL", label: "External factor" }
];

// Who is filing. The site recognises two: its own staff and anyone else on
// site. CONTRACTOR and EXTERNAL used to be separate options; with the
// contractor-company field gone there is nothing to hang the distinction on,
// so an outside party is EXTERNAL. ANONYMOUS is not offered here — the
// checkbox sets it.
const REPORTER_TYPES = [
  { value: "EMPLOYEE", label: "Employee Staff" },
  { value: "EXTERNAL", label: "External" }
] as const;

// Sentinel for "Other" in the activity dropdown — mirrors ACTIVITY_OTHER in
// the near-miss router. Everything else in that list is a MasterItem id.
const ACTIVITY_OTHER = "OTHER";

/** WorkerRef → the personsInvolved / witnesses element the API expects. */
function toPersonPayload(w: WorkerRef) {
  return {
    partyType: w.partyType === "USER" ? "USER" : "MANUAL",
    userId: w.partyType === "USER" ? w.id : null,
    name: w.name,
    code: w.code ?? null
  };
}

const MAX_FILES = 5;
const MAX_SIZE = 50 * 1024 * 1024;

type LocalPhoto = {
  tempId: string;
  file: File;
  previewUrl?: string;
  error?: string;
};

export function NearMissForm({ plants }: { plants: Plant[] }) {
  const router = useRouter();
  const [plantId, setPlantId] = useState(plants[0]?.id ?? "");
  const [department, setDepartment] = useState<string>("");
  const [shiftId, setShiftId] = useState<string>("");
  const [severity, setSeverity] = useState<Severity>("MEDIUM");
  // Risk Calculator (RR = L × S) off the site's printed card.
  const [probability, setProbability] = useState<RiskLevel | null>(null);
  const [severityLevel, setSeverityLevel] = useState<RiskLevel | null>(null);
  const [severityDescription, setSeverityDescription] = useState<string>("");
  // Severity wordings the reporter added because none of the three printed
  // ones fitted. Local to this report — see riskSeverityDescription.
  const [extraSeverities, setExtraSeverities] = useState<{ level: RiskLevel; label: string }[]>([]);
  // Auto-filled from the calculator; the reporter can still overrule it.
  const [categoryOverridden, setCategoryOverridden] = useState(false);
  const [riskCategory, setRiskCategory] = useState<RiskCategory | "">("");

  const [hazardCategories, setHazardCategories] = useState<string[]>([]);
  const [hazardOther, setHazardOther] = useState<string>("");
  const [nearMissCategory, setNearMissCategory] = useState<string>("");
  const [nearMissCategoryDetail, setNearMissCategoryDetail] = useState<string>("");
  const [activityType, setActivityType] = useState<string>("");
  const [activityIsRoutine, setActivityIsRoutine] = useState<boolean | null>(null);
  // null until the reporter answers; [] means they answered "no".
  const [equipmentUsed, setEquipmentUsed] = useState<boolean | null>(null);
  const [equipmentItems, setEquipmentItems] = useState<string[]>([]);
  const [reporterType, setReporterType] = useState<string>("EMPLOYEE");
  const [isAnonymous, setIsAnonymous] = useState(false);
  // Hand-typed name + works ID, not a directory search — see
  // WorkerInvolvedPicker for why, and for what a MANUAL row does not do.
  const [personsInvolved, setPersonsInvolved] = useState<WorkerRef[]>([]);
  const [witnesses, setWitnesses] = useState<WorkerRef[]>([]);
  const [riskLikelihood, setRiskLikelihood] = useState<number | null>(null);
  const [riskConsequence, setRiskConsequence] = useState<number | null>(null);
  const [initialRootCause, setInitialRootCause] = useState<string>("");
  const [suggestedActionOwnerId, setSuggestedActionOwnerId] = useState<string | null>(null);

  const { coords: gps, status: gpsStatus, error: gpsError, request: requestGps } = useGeolocation();
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<"" | "creating" | "uploading">("");
  const [error, setError] = useState("");
  const [uploadFailures, setUploadFailures] = useState<{ id: string; fileName: string; error: string }[]>([]);

  // Masters fetched from Python on mount. Departments and shifts are NOT
  // among them: both come from the site's own fixed lists (DEPARTMENTS,
  // SHIFT_OPTIONS) rather than the plant-scoped masters.
  const [activityTypes, setActivityTypes] = useState<MasterListItem[]>([]);

  const today = new Date().toISOString().slice(0, 16);
  // RR = L × S, and the band the card puts that number in. Both follow from
  // the two picks, so they are derived rather than stored — except the
  // category, which the reporter may overrule.
  const calcRating = riskRating(probability, severityLevel);
  const calcCategory = riskCategoryFor(calcRating);
  const effectiveCategory: RiskCategory | "" = categoryOverridden ? riskCategory : calcCategory ?? "";
  const severityOptions = useMemo(
    () => [...SEVERITY_LEVELS, ...extraSeverities],
    [extraSeverities]
  );

  const photoMandatory = severity === "HIGH";
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
        const actRes = await fetch("/api/near-miss/masters/items?type=ACTIVITY_TYPE")
          .then((r) => r.json())
          .catch(() => []);
        if (cancelled) return;
        setActivityTypes(Array.isArray(actRes) ? actRes : []);
      } catch {
        /* swallow */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Nothing is fetched per plant any more. Departments came from an
  // RBAC-filtered master that returns nothing for a department-scoped user
  // with no matching Department row (that is why the dropdown read "No
  // departments available"), and equipment came from a per-plant register that
  // is empty for most plants. Both are now entered directly on the form.

  // The card's risk category IS the potential severity band, so the calculator
  // fills it in. Kept as an effect rather than a derived value because the
  // reporter can still click a different band afterwards — this sets the
  // starting point, it does not lock it.
  useEffect(() => {
    if (!effectiveCategory) return;
    setSeverity(CATEGORY_TO_SEVERITY[effectiveCategory]);
  }, [effectiveCategory]);

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
      departmentName: department || null,
      shiftId: shiftId || null,
      date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
      description: (fd.get("description") as string) || "",
      // "Location (Blocks & building)" — the site names its areas by block and
      // building rather than picking from the Area master, so this is the
      // free-text `location` column, not areaId.
      location: ((fd.get("location") as string) || "").trim() || null,
      specificLocation: ((fd.get("specificLocation") as string) || "").trim() || null,
      gpsLatitude: gps?.lat ?? null,
      gpsLongitude: gps?.lng ?? null,
      reporterType: isAnonymous ? "ANONYMOUS" : reporterType,
      isAnonymous,
      activityBeingPerformed: activityType || null,
      activityIsRoutine,
      // Only meaningful alongside the "Other" activity — it is what the
      // reporter typed when none of the listed activities fitted.
      activity:
        activityType === ACTIVITY_OTHER
          ? ((fd.get("activityOther") as string) || "").trim() || null
          : null,
      immediateAction: ((fd.get("immediateAction") as string) || "").trim() || null,
      // null = unanswered, [] = "no equipment involved", [...] = the items.
      equipmentInvolved:
        equipmentUsed === null ? null : equipmentUsed ? equipmentItems : [],
      potentialSeverity: severity,
      // Risk Calculator. The rating and category are recomputed server-side
      // from these two — see risk_calculator in the near-miss router.
      riskProbability: probability,
      riskSeverityLevel: severityLevel,
      riskSeverityDescription: severityDescription || null,
      hazardCategories: hazardCategories.length ? hazardCategories : null,
      hazardCategoryOther: hazardCategories.includes(HAZARD_OTHER)
        ? hazardOther.trim() || null
        : null,
      nearMissCategory: nearMissCategory || null,
      nearMissCategoryDetail:
        nearMissCategory === NEAR_MISS_CATEGORY_OTHER
          ? nearMissCategoryDetail.trim() || null
          : null,
      riskLikelihood,
      riskConsequence,
      initialRootCauseCategory: initialRootCause || null,
      controlsThatFailed: ((fd.get("controlsFailed") as string) || "").trim() || null,
      controlsThatWorked: ((fd.get("controlsWorked") as string) || "").trim() || null,
      recommendedActions: ((fd.get("recommendedActions") as string) || "").trim() || null,
      suggestedActionOwnerId: suggestedActionOwnerId || null,
      personsInvolved: personsInvolved.map(toPersonPayload),
      witnesses: witnesses.map(toPersonPayload)
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
          if (!result.ok)
            failures.push({
              id: p.tempId,
              fileName: p.file.name,
              error: result.error ?? "Upload failed"
            });
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

          {/* ── Section 1: When & Where ── */}
          <Section title="When & Where">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date / Time<Req /></Label>
                <Input id="date" name="date" type="datetime-local" defaultValue={today} required />
              </div>
              <div>
                <Label>Plant Unit Name<Req /></Label>
                <Select value={plantId} onChange={(e) => setPlantId(e.target.value)} required>
                  {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              {/* The site's own department list, shared with the Safety
                  Observation form. Stored as text — see observation-masters.ts. */}
              <div>
                <Label>Department</Label>
                <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
                  <option value="">— Select the department —</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="location">Location (Blocks &amp; building)</Label>
                <Input id="location" name="location" placeholder="e.g. Block B, Stitching building 2" />
              </div>
              <div>
                <Label htmlFor="specificLocation">Specific location</Label>
                <Input id="specificLocation" name="specificLocation" placeholder="e.g. near south packer #3 outlet" />
              </div>
              <div>
                <Label>Shift</Label>
                <Select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
                  <option value="">— Select —</option>
                  {SHIFT_OPTIONS.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
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
                <Label htmlFor="description">Description<Req /></Label>
                <Textarea id="description" name="description" rows={4} required minLength={10} maxLength={1500} placeholder="What did you observe? When? What could have happened?" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Activity being performed</Label>
                  <Select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value)}
                  >
                    <option value="">— Select —</option>
                    {activityTypes.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    <option value={ACTIVITY_OTHER}>Other</option>
                  </Select>
                </div>
                <div>
                  <Label>Activity is</Label>
                  <RadioRow
                    name="activityIsRoutine"
                    options={[
                      { value: "routine", label: "Routine" },
                      { value: "non-routine", label: "Non-routine" }
                    ]}
                    value={activityIsRoutine === null ? "" : activityIsRoutine ? "routine" : "non-routine"}
                    onChange={(v) => setActivityIsRoutine(v === "routine")}
                  />
                </div>
              </div>
              {/* Only asked when the list did not fit — "Other" is the one
                  activity the reporter has to describe themselves. */}
              {activityType === ACTIVITY_OTHER && (
                <div>
                  <Label htmlFor="activityOther">Describe the activity<Req /></Label>
                  <Input
                    id="activityOther"
                    name="activityOther"
                    required
                    placeholder="What was the person actually doing?"
                  />
                </div>
              )}
              <div>
                <Label>Equipment / tool involved</Label>
                <RadioRow
                  name="equipmentUsed"
                  options={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" }
                  ]}
                  value={equipmentUsed === null ? "" : equipmentUsed ? "yes" : "no"}
                  onChange={(v) => {
                    const yes = v === "yes";
                    setEquipmentUsed(yes);
                    if (!yes) setEquipmentItems([]);
                  }}
                />
                {equipmentUsed && (
                  <div className="mt-2">
                    <TextListInput
                      label="Name the equipment or tool"
                      placeholder="e.g. Overlock machine #12"
                      addLabel="Add this item"
                      value={equipmentItems}
                      onChange={setEquipmentItems}
                    />
                  </div>
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
                  {REPORTER_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
              )}
              <div>
                <Label>Persons directly involved</Label>
                <WorkerInvolvedPicker value={personsInvolved} onChange={setPersonsInvolved} />
              </div>
              <div>
                <Label>Witnesses</Label>
                <WorkerInvolvedPicker value={witnesses} onChange={setWitnesses} />
              </div>
            </div>
          </Section>

          {/* ── Section 4: Potential Consequence ── */}
          <Section
            title="Potential Consequence"
            subtitle="Risk Calculator (RR = L × S) — what could have happened, and how badly"
          >
            <div className="space-y-5">
              {/* The site's printed card scores risk on two 1-3 scales and
                  bands their product. Probability and severity are asked
                  first because the band falls out of them — the reporter
                  should not be picking a band directly and then justifying it. */}
              <div>
                <Label>Probability (L) — how likely was this to happen<Req /></Label>
                <div className="grid gap-2 mt-2 sm:grid-cols-3">
                  {PROBABILITY_LEVELS.map((o) => (
                    <LevelCard
                      key={o.level}
                      level={o.level}
                      label={o.label}
                      selected={probability === o.level}
                      onSelect={() => setProbability(o.level)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label>Severity (S) — how bad the outcome could have been<Req /></Label>
                <div className="grid gap-2 mt-2">
                  {severityOptions.map((o) => (
                    <LevelCard
                      key={o.level + ":" + o.label}
                      level={o.level}
                      label={o.label}
                      selected={severityLevel === o.level && severityDescription === o.label}
                      onSelect={() => {
                        setSeverityLevel(o.level);
                        setSeverityDescription(o.label);
                      }}
                    />
                  ))}
                </div>
                {/* The card's three descriptions do not cover every site. A
                    reporter can word their own, at whichever level they judge
                    it — the level is what drives the rating. */}
                <div className="mt-2">
                  <SeverityAdder
                    onAdd={(level, label) =>
                      setExtraSeverities((prev) =>
                        prev.some((e) => e.label.toLowerCase() === label.toLowerCase())
                          ? prev
                          : [...prev, { level, label }]
                      )
                    }
                  />
                </div>
              </div>

              {/* Rating and category are arithmetic, so they are shown rather
                  than asked. The category stays a select: the calculator sets
                  the starting point and the reporter can overrule it. */}
              <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
                <div className="grid gap-3 sm:grid-cols-3 items-end">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">
                      Risk rating (RR = L × S)
                    </div>
                    <div className="mt-1 text-2xl font-bold text-slate-800">
                      {calcRating ?? "—"}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="riskCategory">Risk category</Label>
                    <Select
                      id="riskCategory"
                      value={effectiveCategory}
                      onChange={(e) => {
                        setCategoryOverridden(true);
                        setRiskCategory(e.target.value as RiskCategory);
                      }}
                    >
                      <option value="">— Pick a probability and a severity —</option>
                      {RISK_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{RISK_CATEGORY_LABELS[c]}</option>
                      ))}
                    </Select>
                    {categoryOverridden && calcCategory && effectiveCategory !== calcCategory && (
                      <p className="mt-1 text-xs text-amber-700">
                        The calculator rates this {RISK_CATEGORY_LABELS[calcCategory]}.{" "}
                        <button
                          type="button"
                          className="underline"
                          onClick={() => setCategoryOverridden(false)}
                        >
                          Use that instead
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label>Potential severity<Req /></Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set from the risk category. Change it if the band does not fit.
                </p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {SEVERITIES.map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverity(sev)}
                      className={cn(
                        "px-3 py-2 rounded-md border text-sm font-medium transition",
                        severity === sev
                          ? sev === "HIGH"
                            ? "bg-orange-500 text-white border-orange-500"
                            : sev === "MEDIUM"
                            ? "bg-amber-400 text-amber-950 border-amber-400"
                            : "bg-emerald-500 text-white border-emerald-500"
                          : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                      )}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="hazardCategories">Hazard category — tick everything you observed</Label>
                <div className="mt-1">
                  <MultiSelect
                    id="hazardCategories"
                    options={HAZARD_CATEGORIES.map((h) => ({ value: h.code, label: h.label }))}
                    value={hazardCategories}
                    onChange={setHazardCategories}
                    placeholder="— Select the hazards —"
                    searchPlaceholder="Search hazards…"
                  />
                </div>
                {hazardCategories.includes(HAZARD_OTHER) && (
                  <Input
                    className="mt-2"
                    value={hazardOther}
                    onChange={(e) => setHazardOther(e.target.value)}
                    placeholder="Describe the other unsafe act or condition"
                  />
                )}
              </div>

              <div>
                <Label>Near miss category</Label>
                <p className="text-xs text-slate-500 mt-0.5">Pick the one that fits best.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {NEAR_MISS_CATEGORIES.map((c) => {
                    const selected = nearMissCategory === c.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setNearMissCategory(selected ? "" : c.code)}
                        aria-pressed={selected}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-md border p-2 text-center transition",
                          selected
                            ? "border-primary-700 bg-primary-50 ring-2 ring-primary-600"
                            : "border-slate-200 bg-white hover:border-slate-400"
                        )}
                      >
                        {/* Plain <img>: these are 6 KB decorative pictograms
                            already sized for the tile, so the Image optimiser
                            has nothing to save here. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={"/near-miss-categories/" + c.image + ".webp"}
                          alt=""
                          width={56}
                          height={56}
                          className="h-14 w-14 object-contain"
                        />
                        <span className="text-[11px] leading-tight text-slate-700">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
                {nearMissCategory === NEAR_MISS_CATEGORY_OTHER && (
                  <Textarea
                    className="mt-2"
                    rows={2}
                    value={nearMissCategoryDetail}
                    onChange={(e) => setNearMissCategoryDetail(e.target.value)}
                    placeholder="Specify the category — what nearly happened?"
                  />
                )}
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

/** One option on a Risk Calculator scale. The LEVEL number is what the card
 *  prints and what the rating multiplies, so it leads rather than hiding
 *  inside the description. */
function LevelCard({
  level,
  label,
  selected,
  onSelect
}: {
  level: RiskLevel;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md border p-2.5 text-left transition",
        selected
          ? "border-primary-700 bg-primary-50 ring-2 ring-primary-600"
          : "border-slate-200 bg-white hover:border-slate-400"
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          selected ? "bg-primary-700 text-white" : "bg-slate-100 text-slate-600"
        )}
      >
        {level}
      </span>
      <span className="text-sm leading-snug text-slate-700">{label}</span>
    </button>
  );
}

/** Adds a severity wording the printed card does not carry. The level is asked
 *  alongside the text because the level, not the wording, is what the rating
 *  multiplies — a description with no level would score nothing. */
function SeverityAdder({ onAdd }: { onAdd: (level: RiskLevel, label: string) => void }) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<RiskLevel>(1);
  const [label, setLabel] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline"
      >
        <Plus className="h-3 w-3" />
        Add another severity description
      </button>
    );
  }

  function commit() {
    const next = label.trim();
    if (!next) return;
    onAdd(level, next);
    setLabel("");
    setOpen(false);
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-2">
      <div className="mb-1.5 text-xs font-medium text-slate-500">
        Describe a severity this card does not cover
      </div>
      <div className="flex items-start gap-2">
        <Select
          value={String(level)}
          onChange={(e) => setLevel(Number(e.target.value) as RiskLevel)}
          className="w-28 shrink-0"
          aria-label="Severity level"
        >
          <option value="1">Level 1</option>
          <option value="2">Level 2</option>
          <option value="3">Level 3</option>
        </Select>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            // Enter inside a form submits it. Here it means "add this one".
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="What could have happened at this level?"
          className="min-w-0 flex-1"
        />
        <Button type="button" onClick={commit} className="shrink-0">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
    </div>
  );
}

/** A short set of mutually exclusive answers, as radios. Used where the answer
 *  is a plain either/or and the reporter should see both choices and which one
 *  is selected — not a pair of buttons where "unanswered" and "no" look alike. */
function RadioRow({
  name,
  options,
  value,
  onChange
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4 mt-2">
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="h-4 w-4 accent-primary-700"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** Type a line, press Add (or Enter), get a removable chip. For lists the site
 *  keeps in its head rather than in a master table. */
function TextListInput({
  label,
  placeholder,
  addLabel,
  value,
  onChange
}: {
  label: string;
  placeholder: string;
  addLabel: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const next = draft.trim();
    if (!next) return;
    if (value.some((v) => v.toLowerCase() === next.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, next]);
    setDraft("");
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-2">
      <div className="mb-1.5 text-xs font-medium text-slate-500">{label}</div>
      <div className="flex items-start gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter inside a form submits it. Here it means "add this item".
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1"
        />
        <Button type="button" onClick={add} title={addLabel} aria-label={addLabel} className="shrink-0">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mt-2">
          {value.map((v) => (
            <li key={v}>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-slate-700 text-xs border">
                {v}
                <button
                  type="button"
                  aria-label={`Remove ${v}`}
                  onClick={() => onChange(value.filter((x) => x !== v))}
                  className="rounded-full p-0.5 hover:bg-slate-100"
                >
                  <X size={11} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
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

