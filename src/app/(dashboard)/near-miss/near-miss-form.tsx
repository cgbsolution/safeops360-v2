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
import { SelectField } from "@/components/ui/select-field";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { toTargetIso, todayInAppZone } from "@/lib/near-miss/target-date";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  CATEGORY_TO_SEVERITY,
  HAZARD_CATEGORIES,
  HAZARD_OTHER,
  NEAR_MISS_CATEGORIES,
  NEAR_MISS_CATEGORY_OTHER,
  PROBABILITY_LEVELS,
  RISK_CATEGORY_LABELS,
  RISK_LEVELS,
  RISK_RATINGS,
  SEVERITY_LEVELS,
  categoryForLevel,
  levelForCategory,
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

type CapaType = "CORRECTIVE" | "PREVENTIVE";
type CapaDraft = { description: string; type: CapaType };

// Closure SLA presets. The reporter picks one; the default follows the
// severity band, which is the rule the backend applied on its own before the
// field existed (_SLA_HOURS_BY_SEVERITY in the near-miss router).
const SLA_PRESETS = [
  { hours: 24, label: "24 hours" },
  { hours: 48, label: "48 hours" },
  { hours: 168, label: "7 days" },
  { hours: 336, label: "14 days" }
] as const;

const DEFAULT_SLA_HOURS: Record<Severity, number> = {
  LOW: 336,
  MEDIUM: 168,
  HIGH: 48
};

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
  // Both auto-fill from the calculator and both stay clickable, so each keeps
  // its own override. Null means "follow the calculator".
  const [ratingOverride, setRatingOverride] = useState<number | null>(null);
  const [levelOverride, setLevelOverride] = useState<RiskLevel | null>(null);

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
  const [initialRootCause, setInitialRootCause] = useState<string>("");
  // The Safety Officer who verifies this report and assigns its CAPAs. Still
  // NearMiss.suggestedActionOwnerId underneath — the column already held
  // "the person this should go to", which is exactly what this is.
  const [suggestedActionOwnerId, setSuggestedActionOwnerId] = useState<string | null>(null);
  const [capas, setCapas] = useState<CapaDraft[]>([]);
  const [targetDate, setTargetDate] = useState<string>("");
  const [slaHours, setSlaHours] = useState<string>(String(DEFAULT_SLA_HOURS.MEDIUM));

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
  // The target picker's floor is today in the DISPLAY zone, not in UTC.
  const todayDate = todayInAppZone();
  // RR = L × S, and the band the card puts that number in. Both follow from
  // the two picks, so they are derived rather than stored — except the
  // category, which the reporter may overrule.
  const calcRating = riskRating(probability, severityLevel);
  // Rating: the product, unless the coordinator picked a number themselves.
  const effectiveRating = ratingOverride ?? calcRating;
  // Level and risk category are one value read two ways (see risk-masters).
  // The level follows whatever rating is in force, unless overridden in turn.
  const effectiveLevel: RiskLevel | null =
    levelOverride ?? levelForCategory(riskCategoryFor(effectiveRating));
  const effectiveCategory: RiskCategory | "" = categoryForLevel(effectiveLevel) ?? "";
  const severityOptions = useMemo(
    () => [...SEVERITY_LEVELS, ...extraSeverities],
    [extraSeverities]
  );

  const photoMandatory = severity === "HIGH";
  const validPhotos = photos.filter((p) => !p.error);

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

  // The SLA default follows the severity band the Risk Calculator produced,
  // right up until the reporter picks one themselves — after that it is
  // theirs and the band no longer moves it.
  const slaTouched = useRef(false);
  useEffect(() => {
    if (slaTouched.current) return;
    setSlaHours(String(DEFAULT_SLA_HOURS[severity]));
  }, [severity]);

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
      // Sent rather than left to the server because both are overridable here.
      riskRating: effectiveRating,
      riskCategory: effectiveCategory || null,
      hazardCategories: hazardCategories.length ? hazardCategories : null,
      hazardCategoryOther: hazardCategories.includes(HAZARD_OTHER)
        ? hazardOther.trim() || null
        : null,
      nearMissCategory: nearMissCategory || null,
      nearMissCategoryDetail:
        nearMissCategory === NEAR_MISS_CATEGORY_OTHER
          ? nearMissCategoryDetail.trim() || null
          : null,
      initialRootCauseCategory: initialRootCause || null,
      // The Safety Officer named here becomes step 2's assignee — see the
      // SAFETY_OFFICER branch in workflow_engine._resolve_assignee.
      suggestedActionOwnerId: suggestedActionOwnerId || null,
      capas: capas.length ? capas : null,
      // Pinned to noon UTC by toTargetIso: a calendar day stored at local
      // midnight reads back a day earlier for IST users.
      targetDate: targetDate ? toTargetIso(targetDate) : null,
      slaHours: Number(slaHours) || null,
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
                <SelectField
                  id="plantId"
                  required
                  value={plantId}
                  onChange={setPlantId}
                  options={plants.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder="— Select the plant unit —"
                />
              </div>
              {/* The site's own department list, shared with the Safety
                  Observation form. Stored as text — see observation-masters.ts. */}
              <div>
                <Label>Department</Label>
                <SelectField
                  id="department"
                  value={department}
                  onChange={setDepartment}
                  options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                  placeholder="— Select the department —"
                />
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
                <SelectField
                  id="shiftId"
                  value={shiftId}
                  onChange={setShiftId}
                  options={SHIFT_OPTIONS.map((o) => ({ value: o.code, label: o.label }))}
                  placeholder="— Select —"
                />
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
                  <SelectField
                    id="activityType"
                    value={activityType}
                    onChange={setActivityType}
                    options={[
                      ...activityTypes.map((a) => ({ value: a.id, label: a.label })),
                      { value: ACTIVITY_OTHER, label: "Other" }
                    ]}
                    placeholder="— Select —"
                  />
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
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isAnonymous"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                  />
                  <Label htmlFor="isAnonymous" className="cursor-pointer font-normal">
                    Anonymous reporting
                  </Label>
                </div>
              </div>
              {!isAnonymous && (
                <SelectField
                  id="reporterType"
                  value={reporterType}
                  onChange={setReporterType}
                  options={REPORTER_TYPES.map((r) => ({ value: r.value, label: r.label }))}
                  placeholder="— Select —"
                />
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
                <ChoiceCards
                  name="probability"
                  className="grid gap-2 mt-2 sm:grid-cols-3"
                  options={PROBABILITY_LEVELS.map((o) => ({
                    value: String(o.level),
                    label: o.label
                  }))}
                  value={probability === null ? "" : String(probability)}
                  onChange={(v) => setProbability(Number(v) as RiskLevel)}
                  renderOption={(o, selected) => (
                    <LevelBody level={Number(o.value) as RiskLevel} label={o.label} selected={selected} />
                  )}
                />
              </div>

              <div>
                <Label>Severity (S) — how bad the outcome could have been<Req /></Label>
                {/* Keyed on the wording, not the level: two options can sit
                    at the same level once the reporter adds their own. */}
                <ChoiceCards
                  name="severity"
                  className="grid gap-2 mt-2"
                  options={severityOptions.map((o) => ({ value: o.label, label: o.label }))}
                  value={severityDescription}
                  onChange={(v) => {
                    const picked = severityOptions.find((o) => o.label === v);
                    if (!picked) return;
                    setSeverityLevel(picked.level);
                    setSeverityDescription(picked.label);
                  }}
                  renderOption={(o, selected) => {
                    const picked = severityOptions.find((x) => x.label === o.value);
                    return (
                      <LevelBody level={picked?.level ?? 1} label={o.label} selected={selected} />
                    );
                  }}
                />
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

              {/* The rating and its band are set below, in the Risk
                  Calculator. Shown here too because it is what the rest of
                  this section reads against. */}
              {effectiveCategory && (
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/60 p-2.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    Risk category
                  </span>
                  <Badge className={RISK_BAND_BADGE[effectiveCategory]}>
                    {RISK_CATEGORY_LABELS[effectiveCategory]}
                  </Badge>
                  {effectiveRating != null && (
                    <span className="text-xs text-slate-600">rating {effectiveRating}</span>
                  )}
                </div>
              )}

              <div>
                <Label>Potential severity<Req /></Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set from the risk category. Change it if the band does not fit.
                </p>
                <ChoiceCards
                  name="potentialSeverity"
                  className="grid grid-cols-3 gap-2 mt-2"
                  options={SEVERITIES.map((sev) => ({ value: sev, label: sev }))}
                  value={severity}
                  onChange={(v) => setSeverity(v as Severity)}
                  cardClassName={(selected, o) =>
                    cn(
                      "px-3 py-2 text-center text-sm font-medium",
                      selected &&
                        (o.value === "HIGH"
                          ? "!border-orange-500 !bg-orange-500 !ring-orange-500 text-white"
                          : o.value === "MEDIUM"
                          ? "!border-amber-400 !bg-amber-400 !ring-amber-400 text-amber-950"
                          : "!border-emerald-500 !bg-emerald-500 !ring-emerald-500 text-white")
                    )
                  }
                />
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
                <ChoiceCards
                  name="nearMissCategory"
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2"
                  options={NEAR_MISS_CATEGORIES.map((c) => ({ value: c.code, label: c.label }))}
                  value={nearMissCategory}
                  onChange={setNearMissCategory}
                  cardClassName={() => "p-2"}
                  renderOption={(o) => (
                    <span className="flex flex-col items-center gap-1.5 text-center">
                      {/* Plain <img>: these are 6 KB decorative pictograms
                          already sized for the tile, so the Image optimiser
                          has nothing to save here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          "/near-miss-categories/" +
                          (NEAR_MISS_CATEGORIES.find((c) => c.code === o.value)?.image ?? "other") +
                          ".webp"
                        }
                        alt=""
                        width={56}
                        height={56}
                        className="h-14 w-14 object-contain"
                      />
                      <span className="text-[11px] font-normal leading-tight text-slate-700">
                        {o.label}
                      </span>
                    </span>
                  )}
                />
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

          {/* ── Section 5: Risk Calculator ── */}
          <Section
            title="Risk Calculator"
            subtitle="RR = L × S — filled in from the picks above; change either if you disagree"
          >
            <div className="space-y-4">
              <div>
                <Label>Level (1-3)</Label>
                <NumberScale
                  name="riskLevelBand"
                  values={RISK_LEVELS}
                  value={effectiveLevel}
                  onChange={(n) => setLevelOverride(n as RiskLevel)}
                  toneFor={(n) => LEVEL_TONE[n as RiskLevel]}
                />
                {effectiveCategory && (
                  <p className="mt-1.5 text-xs text-slate-600">
                    Level {effectiveLevel} is{" "}
                    <span className="font-medium">{RISK_CATEGORY_LABELS[effectiveCategory]}</span>{" "}
                    on the card.
                  </p>
                )}
              </div>

              <div>
                <Label>Risk rating (1-9)</Label>
                <NumberScale
                  name="riskRating"
                  values={RISK_RATINGS}
                  value={effectiveRating}
                  onChange={(n) => {
                    setRatingOverride(n);
                    // A new rating re-bands the level; an earlier level
                    // override would otherwise silently outrank it.
                    setLevelOverride(null);
                  }}
                  toneFor={(n) => LEVEL_TONE[levelForCategory(riskCategoryFor(n)) ?? 1]}
                />
                {calcRating != null && effectiveRating !== calcRating && (
                  <p className="mt-1.5 text-xs text-amber-700">
                    L × S gives {calcRating}.{" "}
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-amber-800"
                      onClick={() => {
                        setRatingOverride(null);
                        setLevelOverride(null);
                      }}
                    >
                      Use that instead
                    </Button>
                  </p>
                )}
                {calcRating == null && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Pick a probability and a severity above and this fills itself in.
                  </p>
                )}
              </div>
            </div>
          </Section>

          {/* ── Section 7: Initial Root Cause Hint ── */}
          <Section title="Initial Root Cause Hint">
            <Label>Reporter's first guess</Label>
            <SelectField
              id="initialRootCause"
              value={initialRootCause}
              onChange={setInitialRootCause}
              options={ROOT_CAUSE_HINTS.map((r) => ({ value: r.code, label: r.label }))}
              placeholder="— Select —"
            />
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
              {/* Hidden and driven by the buttons above — a native file
                  picker cannot be styled, so this is the only way to give it
                  the design system's chrome. */}
              <Input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
              <Input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...({ capture: "environment" } as any)}
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
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
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label={`Remove ${p.file.name}`}
                      onClick={() => removePhoto(p.tempId)}
                      className="absolute right-1 top-1 h-6 w-6 rounded-full bg-white/90 p-0 shadow hover:bg-white"
                    >
                      <X size={12} />
                    </Button>
                    {p.error && <div className="absolute inset-x-0 bottom-0 bg-rose-600 text-white text-[10px] px-1 py-0.5 truncate">{p.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Section 9: Immediate Action & CAPA ── */}
          <Section
            title="Immediate Action & CAPA"
            subtitle="What you did on the spot, and what should be done about it"
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="immediateAction">Immediate action taken</Label>
                <Textarea id="immediateAction" name="immediateAction" rows={2} placeholder="Steps taken on the spot..." />
              </div>

              {/* CAPAs are written here, by the person who saw it. The Safety
                  Officer names an owner and a date for each at the next
                  workflow step — which is why neither is asked for now. */}
              <div>
                <Label>Corrective &amp; preventive actions (CAPA)</Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  What should be done so this cannot happen again? The Safety Officer
                  assigns who does each one.
                </p>
                <div className="mt-2">
                  <CapaListInput value={capas} onChange={setCapas} />
                </div>
              </div>

              <div>
                <Label htmlFor="safetyOfficer">Safety officer<Req /></Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verifies this report and assigns each CAPA. Leave blank and it goes to
                  whoever holds the Safety Officer role at this plant.
                </p>
                <div className="mt-1">
                  <UserPicker
                    id="safetyOfficer"
                    value={suggestedActionOwnerId}
                    onChange={setSuggestedActionOwnerId}
                    filter={{ plantId: plantId || undefined }}
                    placeholder="Search and pick..."
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="targetDate">Target closure date</Label>
                  <Input
                    id="targetDate"
                    name="targetDate"
                    type="date"
                    value={targetDate}
                    min={todayDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="slaHours">Closure SLA</Label>
                  <SelectField
                    id="slaHours"
                    value={slaHours}
                    onChange={(v) => {
                      // From here on the SLA is the reporter's, not the
                      // severity band's — see the effect that seeds it.
                      slaTouched.current = true;
                      setSlaHours(v);
                    }}
                    options={SLA_PRESETS.map((o) => ({
                      value: String(o.hours),
                      label:
                        o.hours === DEFAULT_SLA_HOURS[severity]
                          ? `${o.label} — default for ${severity}`
                          : o.label
                    }))}
                    placeholder="— Select —"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    The clock starts on submission. Past it, the record shows as
                    <span className="font-medium"> SLA breached</span> and escalates.
                  </p>
                </div>
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

/** The body of one option on a Risk Calculator scale. The LEVEL number is
 *  what the printed card shows and what the rating multiplies, so it leads
 *  rather than hiding inside the description. */
function LevelBody({
  level,
  label,
  selected
}: {
  level: RiskLevel;
  label: string;
  selected: boolean;
}) {
  return (
    <span className="flex w-full items-start gap-2.5 p-2.5 text-left">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          selected ? "bg-primary-700 text-white" : "bg-slate-100 text-slate-600"
        )}
      >
        {level}
      </span>
      <span className="text-sm font-normal leading-snug text-slate-700">{label}</span>
    </span>
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
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-auto gap-1 p-0 text-xs"
      >
        <Plus className="h-3 w-3" />
        Add another severity description
      </Button>
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
        <div className="w-28 shrink-0">
          <SelectField
            value={String(level)}
            onChange={(v) => setLevel(Number(v) as RiskLevel)}
            ariaLabel="Severity level"
            options={[
              { value: "1", label: "Level 1" },
              { value: "2", label: "Level 2" },
              { value: "3", label: "Level 3" }
            ]}
          />
        </div>
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

/** The CAPAs a reporter writes on the form. Each is a line of what should be
 *  done and whether it is corrective or preventive; no owner and no date,
 *  because the Safety Officer sets both at the next workflow step and the step
 *  will not close until they have. */
function CapaListInput({
  value,
  onChange
}: {
  value: CapaDraft[];
  onChange: (v: CapaDraft[]) => void;
}) {
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CapaType>("CORRECTIVE");

  function add() {
    const next = description.trim();
    if (next.length < 3) return;
    if (value.some((c) => c.description.toLowerCase() === next.toLowerCase())) {
      setDescription("");
      return;
    }
    onChange([...value, { description: next, type }]);
    setDescription("");
    setType("CORRECTIVE");
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-2">
      <div className="mb-1.5 text-xs font-medium text-slate-500">
        Describe one action, then Add
      </div>
      <div className="flex items-start gap-2">
        <div className="w-36 shrink-0">
          <SelectField
            value={type}
            onChange={(v) => setType(v as CapaType)}
            ariaLabel="CAPA type"
            options={[
              { value: "CORRECTIVE", label: "Corrective" },
              { value: "PREVENTIVE", label: "Preventive" }
            ]}
          />
        </div>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            // Enter inside a form submits it. Here it means "add this one".
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. Fit a self-closing latch on the ramp gate"
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          onClick={add}
          title="Add this CAPA"
          aria-label="Add this CAPA"
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <ol className="mt-2 space-y-1.5">
          {value.map((c, i) => (
            <li
              key={c.description}
              className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-2"
            >
              <Badge
                className={cn(
                  "mt-0.5 shrink-0 border-transparent",
                  c.type === "PREVENTIVE"
                    ? "bg-sky-100 text-sky-800"
                    : "bg-violet-100 text-violet-800"
                )}
              >
                {c.type === "PREVENTIVE" ? "Preventive" : "Corrective"}
              </Badge>
              <span className="min-w-0 flex-1 text-sm text-slate-700">{c.description}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove CAPA ${i + 1}`}
                onClick={() => onChange(value.filter((x) => x.description !== c.description))}
                className="h-6 w-6 shrink-0 rounded-full p-0"
              >
                <X size={12} />
              </Button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** A group of mutually exclusive choices rendered as cards.
 *
 *  Radix RadioGroup rather than a row of buttons with `aria-pressed`: these
 *  are genuinely "pick one of N", and the primitive brings the roving
 *  tabindex a radio group needs — arrow keys move between options, Tab enters
 *  and leaves the group as one stop. The control itself is visually hidden
 *  and the Label is the card, which is shadcn's own radio-as-card pattern.
 */
function ChoiceCards({
  name,
  options,
  value,
  onChange,
  className,
  cardClassName,
  renderOption
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
  /** Extra classes on each card, given whether that card is selected. */
  cardClassName?: (selected: boolean, option: { value: string; label: string }) => string;
  /** Card body. Defaults to the label text. */
  renderOption?: (option: { value: string; label: string }, selected: boolean) => React.ReactNode;
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className={className}>
      {options.map((o) => {
        const id = `${name}-${o.value}`;
        const selected = value === o.value;
        return (
          <div key={o.value} className="min-w-0">
            <RadioGroupItem id={id} value={o.value} className="peer sr-only" />
            <Label
              htmlFor={id}
              className={cn(
                "block cursor-pointer rounded-md border transition",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-primary-600 peer-focus-visible:ring-offset-1",
                cardClassName?.(selected, o) ?? "",
                selected
                  ? "border-primary-700 bg-primary-50 ring-2 ring-primary-600"
                  : "border-slate-200 bg-white hover:border-slate-400"
              )}
            >
              {renderOption ? renderOption(o, selected) : o.label}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}

/** A short set of mutually exclusive answers, as plain radios in a row. Used
 *  where the answer is an either/or and the reporter should see both choices
 *  and which one is selected — not a pair of buttons where "unanswered" and
 *  "no" look alike. */
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
    <RadioGroup
      value={value}
      onValueChange={onChange}
      className="flex flex-row flex-wrap gap-4 mt-2"
    >
      {options.map((o) => {
        const id = `${name}-${o.value}`;
        return (
          <div key={o.value} className="flex items-center gap-2">
            <RadioGroupItem id={id} value={o.value} />
            <Label htmlFor={id} className="cursor-pointer font-normal text-slate-700">
              {o.label}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
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
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((v) => (
            <Badge
              key={v}
              className="border-slate-200 bg-white py-1 pl-2.5 pr-1 font-normal text-slate-700"
            >
              {v}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="h-5 w-5 rounded-full p-0 hover:bg-slate-100"
              >
                <X size={11} />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/** Colour per band, shared by the Level and Risk rating scales so a 3 and a 9
 *  read as the same severity of answer. */
const LEVEL_TONE: Record<RiskLevel, string> = {
  1: "!border-emerald-500 !bg-emerald-500 !ring-emerald-500 text-white",
  2: "!border-amber-400 !bg-amber-400 !ring-amber-400 text-amber-950",
  3: "!border-orange-500 !bg-orange-500 !ring-orange-500 text-white"
};

const RISK_BAND_BADGE: Record<RiskCategory, string> = {
  LOW_RISK: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEDIUM_RISK: "bg-amber-100 text-amber-900 border-amber-200",
  HIGH_RISK: "bg-orange-100 text-orange-900 border-orange-200"
};

/** A row of numbered boxes, one selectable — the shape the printed card's
 *  LEVEL and RISK RATING columns take on screen. Radio semantics, because
 *  that is what "pick one of these numbers" is. */
function NumberScale({
  name,
  values,
  value,
  onChange,
  toneFor
}: {
  name: string;
  values: number[];
  value: number | null;
  onChange: (n: number) => void;
  /** Classes for the selected box, so a 9 can look different from a 1. */
  toneFor: (n: number) => string;
}) {
  return (
    <ChoiceCards
      name={name}
      className="mt-1 flex flex-row flex-wrap gap-1.5"
      options={values.map((n) => ({ value: String(n), label: String(n) }))}
      value={value === null ? "" : String(value)}
      onChange={(v) => onChange(Number(v))}
      cardClassName={(selected, o) =>
        cn(
          "w-11 py-2 text-center text-sm font-bold",
          selected ? toneFor(Number(o.value)) : "text-slate-600"
        )
      }
    />
  );
}

