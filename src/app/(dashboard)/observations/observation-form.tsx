"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { readApiError } from "@/lib/client-errors";
import { uploadObservationAttachment } from "@/components/observations/upload-helper";
import {
  StopTaxonomyFields,
  isAtRisk,
  type StopTaxonomyValue
} from "@/components/observations/stop-taxonomy-fields";
import {
  WorkerInvolvedPicker,
  type WorkerRef
} from "@/components/observations/worker-involved-picker";
import {
  SlaTargetDateField,
  useSlaPreview,
  MIN_OVERRIDE_REASON
} from "@/components/observations/sla-target-date";
import {
  SeveritySuggestionField,
  useSeveritySuggestion,
  severityLabel
} from "@/components/observations/severity-suggestion";
import { UserPicker } from "@/components/ui/user-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DEPARTMENTS } from "@/lib/observation-masters";
import { Camera, Upload, X, Image as ImageIcon, Film, FileText, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Plant = { id: string; name: string; areas: { id: string; name: string }[] };

// At-risk types only. Safe Act / Safe Condition were removed from the create
// form: this programme records deviations, and a "safe" observation carried no
// STOP taxonomy, no severity rule and no action owner — it entered the same
// five-step workflow to be reviewed, actioned, verified and closed with nothing
// to action. The enum and the legacy hazard-category dropdown below both stay,
// because historical safe observations still have to render and be editable.
const TYPES = [
  { value: "UNSAFE_ACT", label: "Unsafe Act" },
  { value: "UNSAFE_CONDITION", label: "Unsafe Condition" }
];

// Legacy hazard categories — still the classification for SAFE observations.
// At-risk observations use the DuPont STOP taxonomy instead (StopTaxonomyFields).
const CATEGORIES = [
  "PPE", "HOUSEKEEPING", "WORK_AT_HEIGHT", "HOT_WORK", "MOBILE_EQUIPMENT",
  "ELECTRICAL", "MATERIAL_HANDLING", "CONFINED_SPACE", "CHEMICAL_HANDLING",
  "EMERGENCY_PREP", "OTHERS"
];

const MAX_FILES = 5;
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

type LocalPhoto = {
  tempId: string;
  file: File;
  previewUrl?: string;
  error?: string;
};

export function ObservationForm({ plants }: { plants: Plant[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<"" | "creating" | "uploading">("");
  const [plantId, setPlantId] = useState(plants[0]?.id ?? "");
  // Free text — where on site this was seen. Replaced the Area dropdown, so
  // `areaId` is no longer collected here and new records leave it null; the
  // column and its FK stay for legacy rows and the area hazard tier.
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [severityReason, setSeverityReason] = useState("");
  // Picked from the site department list (Dept.list.xlsx), stored as text.
  const [department, setDepartment] = useState("");
  // The action owner, chosen by the observer at submit. This used to be the
  // Section Head's job on the CHECKER step; that step is gone, so the
  // ASSIGNEE_TASK step resolves its assignee straight from this value via
  // approverField ACTION_OWNER.
  const [responsiblePersonId, setResponsiblePersonId] = useState<string | null>(null);
  // Observation type drives the whole taxonomy — controlled so the STOP
  // dropdowns can react to Act ↔ Condition switches mid-entry.
  const [type, setType] = useState("UNSAFE_ACT");
  const [taxonomy, setTaxonomy] = useState<StopTaxonomyValue>({ categoryCode: "", subCategoryCode: "" });
  // The safe-axis category. Was an uncontrolled <select defaultValue="PPE">;
  // a Radix listbox has no form value of its own, so the default now lives here.
  const [safeCategory, setSafeCategory] = useState("PPE");
  const [error, setError] = useState("");
  const [uploadFailures, setUploadFailures] = useState<{ id: string; fileName: string; error: string }[]>([]);
  const [createdObservationId, setCreatedObservationId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Who employs the person this observation is about. Previously inferred from
  // a single optional dropdown, where "left blank" meant both "own employee"
  // and "haven't got to it yet" — the observer never actually stated which.
  // Asking outright makes "own employee" a recorded answer, and only then is
  // the company list worth showing.
  const [employmentType, setEmploymentType] = useState<"COMPANY" | "CONTRACTOR">("COMPANY");
  // Controlled so the Worker Involved picker can scope to this company's crew.

  const [workersInvolved, setWorkersInvolved] = useState<WorkerRef[]>([]);
  // Observation date is controlled because the SLA preview is computed from it.
  const [obsDate, setObsDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [targetDateOverride, setTargetDateOverride] = useState("");
  const [targetDateReason, setTargetDateReason] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  // Revoke object URLs when photos change/unmount
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
      setError(`Maximum ${MAX_FILES} photos. Remove some before adding more.`);
      return;
    }
    const accepted: LocalPhoto[] = [];
    for (const f of list) {
      if (f.size > MAX_SIZE) {
        accepted.push({
          tempId: crypto.randomUUID(),
          file: f,
          error: `Exceeds ${Math.round(MAX_SIZE / 1024 / 1024)} MB`
        });
        continue;
      }
      const previewUrl = f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined;
      accepted.push({ tempId: crypto.randomUUID(), file: f, previewUrl });
    }
    setPhotos((prev) => [...prev, ...accepted]);
  }

  function removePhoto(tempId: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.tempId === tempId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.tempId !== tempId);
    });
  }

  // Severity-aware photo guidance — High and Critical strongly warrant evidence
  const photosRecommended = severity === "HIGH" || severity === "CRITICAL";
  const validPhotos = photos.filter((p) => !p.error);

  // Worker Involved is mandatory only for a High/Critical Unsafe Act — the same
  // condition the server enforces and the deroster trigger fires on.
  const workersRequired =
    type === "UNSAFE_ACT" && (severity === "HIGH" || severity === "CRITICAL");

  // Target closure date preview. The Behavioural/Physical group comes from the
  // configurable STOP-category mapping, so the category is part of the key —
  // for at-risk types the date settles once a category is chosen. Safe types
  // carry no STOP category and resolve from the axis alone.
  // Severity suggestion. Only at-risk types carry the STOP taxonomy, and the
  // matrix is keyed on it — a Safe Act has nothing to look up, so the hook is
  // disabled rather than sent a request that can only miss.
  // No `areaId`: the Area dropdown is gone, so there is no structured area to
  // resolve a hazard tier from and the suggestion is computed from the
  // classification alone.
  const { suggestion: severitySuggestion, loading: severityLoading } = useSeveritySuggestion({
    observationType: type,
    categoryCode: taxonomy.categoryCode,
    subCategoryCode: taxonomy.subCategoryCode,
    plantId,
    enabled: isAtRisk(type)
  });

  const { preview: slaPreview, loading: slaLoading } = useSlaPreview(
    plantId,
    type,
    severity,
    obsDate,
    isAtRisk(type) ? taxonomy.categoryCode : undefined
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // A disabled <select> is skipped by native validation, so a submit while
    // the taxonomy is still loading would slip through with no category.
    // (The server rejects it too — this just gives a better message.)
    // Sub-category is deliberately NOT checked: it refines the category rather
    // than completing it, and everything downstream groups by the category.
    if (isAtRisk(type) && !taxonomy.categoryCode) {
      setError("Select a category for this observation type.");
      return;
    }

    // Worker Involved gate. The server enforces this too — this is just the
    // faster, clearer failure.
    if (workersRequired && workersInvolved.length === 0) {
      setError(
        "Name at least one worker involved. A High or Critical severity Unsafe Act " +
          "starts a safety review for each named worker."
      );
      return;
    }

    // Severity override without a usable reason. The server re-resolves the
    // suggestion and rejects this too — catching it here just avoids bouncing
    // the user after the photos have queued.
    const suggested = severitySuggestion?.suggested;
    const minSeverityReason = severitySuggestion?.minOverrideReasonChars ?? 10;
    if (suggested && severity !== suggested && severityReason.trim().length < minSeverityReason) {
      setError(
        `Severity was changed from the suggested ${severityLabel(suggested)} — give a reason ` +
          `of at least ${minSeverityReason} characters explaining why this observation differs.`
      );
      return;
    }

    // An override without a usable reason is rejected server-side; catch it
    // here so the user isn't bounced after the photos have queued.
    if (targetDateOverride && targetDateReason.trim().length < MIN_OVERRIDE_REASON) {
      setError(
        `A closure-date override needs a reason of at least ${MIN_OVERRIDE_REASON} characters.`
      );
      return;
    }

    // Soft warning for High/Critical without photos — don't hard-block, but
    // confirm so users don't accidentally submit critical reports with no
    // evidence. Hard-blocking is a Phase 2 policy decision.
    if (photosRecommended && validPhotos.length === 0) {
      const ok = confirm(
        `${severity} severity observations should include site photos. Submit anyway?`
      );
      if (!ok) return;
    }

    setSubmitting(true);
    setSubmitStage("creating");
    setUploadFailures([]);

    const fd = new FormData(e.currentTarget);
    const payload: Record<string, any> = Object.fromEntries(fd.entries());
    // The action owner is set here, at submit, and drives the first real task
    // in the workflow. Empty string would fail as an FK, so send null.
    payload.responsiblePersonId = responsiblePersonId || null;
    payload.location = location.trim() || null;
    payload.department = department || null;
    // Taken from state, not the form: on "Company employee" the select isn't
    // rendered at all, and an empty-string FK would fail on insert either way.
    payload.employmentType = employmentType;
    // No company is collected any more, so this stays null on new records. The
    // column and every reader of it are untouched for the records that have one.
    payload.contractorCompanyId = null;

    // Named workers, tagged with which people table each id belongs to — or
    // MANUAL, which belongs to neither and carries its own typed name/ID.
    payload.workersInvolved = workersInvolved.map((w) => ({
      partyType: w.partyType,
      userId: w.partyType === "USER" ? w.id : null,
      contractorWorkerId: w.partyType === "CONTRACTOR_WORKER" ? w.id : null,
      name: w.partyType === "MANUAL" ? w.name : null,
      code: w.partyType === "MANUAL" ? w.code ?? null : null,
      employer: w.partyType === "MANUAL" ? w.employer ?? null : null
    }));

    // targetDate is only honoured server-side when no SLA policy matches; with
    // a policy in force the server computes it. An intentional override is
    // applied as a second call below, because it needs a reason recorded
    // against a record that already exists.
    if (!payload.targetDate) delete payload.targetDate;

    try {
      // 1. Create the observation
      const res = await fetch("/api/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setError(await readApiError(res, "Failed to create observation"));
        setSubmitting(false);
        setSubmitStage("");
        return;
      }
      const created = await res.json();

      // 1b. Apply the closure-date override, if one was entered. Non-fatal —
      // the observation exists and has a valid SLA date; a failure here means
      // the policy date stands, which is reported rather than silently kept.
      if (targetDateOverride && targetDateReason.trim().length >= MIN_OVERRIDE_REASON) {
        const ovr = await fetch(
          `/api/observations/${created.id}/target-closure-date/override`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: new Date(targetDateOverride).toISOString(),
              reason: targetDateReason.trim()
            })
          }
        );
        if (!ovr.ok) {
          setError(
            await readApiError(
              ovr,
              "Observation saved, but the closure-date override was not applied — the SLA date stands."
            )
          );
        }
      }

      // 2. Upload photos sequentially (preserves order, simpler error handling)
      const failures: { id: string; fileName: string; error: string }[] = [];
      if (validPhotos.length > 0) {
        setSubmitStage("uploading");
        for (const p of validPhotos) {
          const result = await uploadObservationAttachment(created.id, p.file, "INITIAL_PHOTO");
          if (!result.ok) failures.push({ id: p.tempId, fileName: p.file.name, error: result.error ?? "Upload failed" });
        }
      }

      // 3. If any photos failed, stop here and show the error inline so the
      //    user knows why and can decide. The observation itself is already
      //    saved — they can navigate to it via the "View record" button.
      if (failures.length > 0) {
        setUploadFailures(failures);
        setCreatedObservationId(created.id);
        setSubmitStage("");
        setSubmitting(false);
        return;
      }

      // 4. All good — redirect to detail page with the green success banner.
      router.push(`/observations/${created.id}?just-created=1`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Network error. Check your connection and retry.");
      setSubmitting(false);
      setSubmitStage("");
    }
  }

  function viewCreatedRecord() {
    if (createdObservationId) {
      router.push(`/observations/${createdObservationId}?just-created=1&photo-errors=${uploadFailures.length}`);
      router.refresh();
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Date" name="date" required>
              {/* Controlled: the SLA target date is observationDate + slaDays,
                  so backdating the observation moves the closure date with it. */}
              <DatePicker
                id="date"
                name="date"
                value={obsDate}
                onChange={setObsDate}
                required
                ariaLabel="Observation date"
              />
            </Field>
            {/* Pre-filled from the severity matrix once Category + Sub-category
                are chosen; still fully editable, with a recorded reason when the
                observer disagrees. Falls back to a plain dropdown when no rule
                is seeded for the combination. */}
            <Field label="Severity" name="severity" required>
              <SeveritySuggestionField
                value={severity}
                onChange={setSeverity}
                suggestion={severitySuggestion}
                loading={severityLoading}
                reason={severityReason}
                onReasonChange={setSeverityReason}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Plant Unit Name" name="plantId" required>
              <SelectField
                id="plantId"
                name="plantId"
                value={plantId}
                onChange={setPlantId}
                required
                placeholder="— Select the plant unit —"
                options={plants.map((p) => ({ value: p.id, label: p.name }))}
              />
            </Field>
            {/* Typed, not picked. The place something is observed is rarely one
                of a plant's registered Areas — it is "behind the Elastic line,
                near the RM door" — and a master row nobody has created must not
                be what stops an observation being filed. Stored in
                Observation.location; areaId is left null on new records. */}
            <Field label="Location" name="location" required>
              <Input
                name="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where on site — line, machine, room or landmark"
                required
              />
            </Field>
            {/* The site's own department list (Dept.list.xlsx). Stored as text
                rather than an FK — see Observation.department. */}
            <Field label="Department" name="department" required>
              <SelectField
                id="department"
                name="department"
                required
                value={department}
                onChange={setDepartment}
                placeholder="— Select the department —"
                options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Observation Type" name="type" required>
              <SelectField
                id="type"
                name="type"
                required
                value={type}
                onChange={setType}
                options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </Field>
            {/* The site's own category list, scoped to the act/condition axis:
                17 unsafe-condition categories, 19 unsafe-act ones. Served from
                ObservationTaxonomy, which is also what the server validates the
                submitted code against — see
                prisma/seed-page-observation-categories.ts. */}
            <StopTaxonomyFields
              type={type}
              value={taxonomy}
              onChange={setTaxonomy}
              safeCategorySlot={
                <Field label="Category" name="category" required>
                  <SelectField
                    id="category"
                    name="category"
                    required
                    value={safeCategory}
                    onChange={setSafeCategory}
                    options={CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, " ") }))}
                  />
                </Field>
              }
            />
          </div>

          {/* Employed By is the whole question. Naming the specific contractor
              company was dropped on request: the observer is reporting what they
              saw, and "which of the site's contractors employs this person" is a
              lookup they often cannot answer standing in front of them. The
              answer is stored on Observation.employmentType. */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Employed By" name="employmentType" required>
              <RadioGroup
                className="grid-cols-2 gap-2"
                value={employmentType}
                onValueChange={(v) => setEmploymentType(v as "COMPANY" | "CONTRACTOR")}
              >
                <EmploymentOption value="COMPANY" label="Company employee" />
                <EmploymentOption value="CONTRACTOR" label="Contractor" />
              </RadioGroup>
            </Field>
          </div>

          {/* Worker Involved — always visible, mandatory only for High/Critical
              Unsafe Acts. Kept optional elsewhere on purpose: forcing a name on
              every Medium/Low or Unsafe Condition report turns hazard reporting
              into blame reporting. */}
          <Field label="Worker Involved" name="workersInvolved" required={workersRequired}>
            <WorkerInvolvedPicker
              value={workersInvolved}
              onChange={setWorkersInvolved}
              required={workersRequired}
              invalid={workersRequired && workersInvolved.length === 0}
            />
            <p className="text-xs text-slate-500 mt-1">
              {workersRequired
                ? "Required for a High or Critical severity Unsafe Act — this starts a safety review for each named worker."
                : "Optional. Name a worker only when the observation is about a specific person's action."}
            </p>
          </Field>

          <Field label="Description" name="description" required>
            <Textarea name="description" required placeholder="Describe what was observed, where, and any context..." rows={4} />
          </Field>

          <Field label="Immediate Action Taken" name="immediateAction">
            <Textarea name="immediateAction" placeholder="Action taken on the spot, if any..." rows={2} />
          </Field>

          {/* Photos & Evidence — collected locally, uploaded after the
              observation is created so they're linked to the new record. */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Site Photos
                {photosRecommended && (
                  <span className="ml-2 text-xs font-normal text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    Recommended for {severity} severity
                  </span>
                )}
              </Label>
              <span className="text-[11px] text-slate-500">
                {photos.length}/{MAX_FILES}
              </span>
            </div>

            <div
              onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
              className={cn(
                "rounded-md border-2 border-dashed transition px-4 py-5 text-center",
                dragOver ? "border-primary-500 bg-primary-50/40" : "border-slate-300 bg-slate-50"
              )}
            >
              <Upload size={20} className="mx-auto text-slate-400 mb-1.5" />
              <p className="text-sm text-slate-700 font-medium">Drag &amp; drop photos here</p>
              <p className="text-xs text-slate-500 mt-1">
                Photos help reviewers act faster. Max {MAX_FILES} files, {Math.round(MAX_SIZE / 1024 / 1024)} MB each.
              </p>
              <div className="mt-2.5 flex items-center justify-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={13} /> Browse
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => cameraInputRef.current?.click()}>
                  <Camera size={13} /> Take Photo
                </Button>
              </div>
              {/* The two file pickers the Browse / Take Photo buttons open.
                  Visually hidden but functional — never remove `hidden` in
                  favour of display:none on a parent, or the click() calls above
                  stop opening anything in Safari. */}
              <Input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
              <Input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...({ capture: "environment" } as any)}
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-2">
                {photos.map((p) => (
                  <PhotoTile key={p.tempId} photo={p} onRemove={() => removePhoto(p.tempId)} />
                ))}
              </div>
            )}
          </div>

          {/* Action owner — assigned here, by the observer, at submit.
              The Section Head Review step that used to do this is gone, so
              this value is what the ASSIGNEE_TASK step resolves its assignee
              from (approverField ACTION_OWNER → Observation.responsiblePersonId).
              Left blank, the engine falls back to the observer, which reads as
              "the person who reported it also has to fix it" — hence the
              warning rather than a silent default. */}
          <Field label="Action Owner" name="responsiblePersonId">
            <UserPicker
              value={responsiblePersonId}
              onChange={(id) => setResponsiblePersonId(id)}
              filter={{ plantId }}
              placeholder="Search and select who will action this"
            />
            <p className="text-xs text-slate-500 mt-1">
              {responsiblePersonId
                ? "They get the execution task as soon as this is submitted."
                : "Optional. Leave blank only if you don't know yet — the execution task then falls to you as the observer until someone reassigns it."}
            </p>
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Target Closure Date" name="targetDate">
              <SlaTargetDateField
                preview={slaPreview}
                loading={slaLoading}
                overrideDate={targetDateOverride}
                overrideReason={targetDateReason}
                onOverrideDate={setTargetDateOverride}
                onOverrideReason={setTargetDateReason}
                minDate={today}
              />
              <p className="text-xs text-slate-500 mt-1">
                Set from the SLA policy for this severity and category group.
              </p>
            </Field>
          </div>

          {error && (
            <Alert variant="destructive" size="lg">
              <AlertCircle className="mt-0.5" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {uploadFailures.length > 0 && (
            <Alert variant="warning" size="lg" className="space-y-2 border-amber-300 p-4">
              <AlertCircle className="mt-0.5" />
              <AlertDescription>
                <AlertTitle className="text-amber-900">
                  Observation saved, but {uploadFailures.length} photo{uploadFailures.length === 1 ? "" : "s"} failed to upload
                </AlertTitle>
                <p className="mt-0.5 text-xs text-amber-800">
                  The observation itself is recorded and the workflow has started. You can attach photos
                  later from the record&apos;s detail page.
                </p>
              </AlertDescription>
              <ul className="text-xs space-y-1 pl-6">
                {uploadFailures.map((f) => (
                  <li key={f.id} className="text-amber-900">
                    <strong>{f.fileName}</strong> — <span className="text-amber-800">{f.error}</span>
                  </li>
                ))}
              </ul>
              {uploadFailures.some((f) => f.error.toLowerCase().includes("storage")) && (
                <Alert variant="warning" className="ml-6 border-amber-200 bg-amber-100 px-2 py-1.5 text-[11px] text-amber-700">
                  <strong>Admin note:</strong> Supabase Storage isn't configured on the server. Set
                  <code className="font-mono mx-1 bg-white/70 px-1 rounded">SUPABASE_URL</code> and the
                  <code className="font-mono mx-1 bg-white/70 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code>
                  (the <em>secret</em> key — NOT the publishable/anon key)
                  in <code className="font-mono bg-white/70 px-1 rounded">.env</code>, create a private bucket named
                  <code className="font-mono mx-1 bg-white/70 px-1 rounded">incident-attachments</code>
                  (or whatever <code className="font-mono bg-white/70 px-1 rounded">SUPABASE_INCIDENT_BUCKET</code> is set to), then restart the backend.
                </Alert>
              )}
              <div className="flex gap-2 pt-1">
                <Button type="button" size="sm" onClick={viewCreatedRecord}>
                  View record →
                </Button>
              </div>
            </Alert>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting || uploadFailures.length > 0}>
              {submitStage === "creating" && <><Loader2 size={14} className="animate-spin" /> Saving observation…</>}
              {submitStage === "uploading" && <><Loader2 size={14} className="animate-spin" /> Uploading photos…</>}
              {!submitStage && "Submit Observation"}
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

function PhotoTile({ photo, onRemove }: { photo: LocalPhoto; onRemove: () => void }) {
  const isImage = photo.file.type.startsWith("image/");
  const isVideo = photo.file.type.startsWith("video/");
  const sizeKb = Math.round(photo.file.size / 1024);
  const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

  return (
    <Card className="group relative aspect-square overflow-hidden rounded-md bg-slate-100 shadow-none">
      {isImage && photo.previewUrl ? (
        <img src={photo.previewUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {isVideo ? <Film size={28} className="text-slate-400" /> :
           photo.file.type === "application/pdf" ? <FileText size={28} className="text-slate-400" /> :
           <ImageIcon size={28} className="text-slate-400" />}
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label="Remove"
        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/90 p-0 shadow opacity-0 transition hover:bg-white group-hover:opacity-100"
      >
        <X size={12} />
      </Button>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
        <div className="text-[10px] text-white truncate">{photo.file.name}</div>
        <div className="text-[10px] text-white/80">
          {photo.error ? <span className="text-rose-300">{photo.error}</span> : sizeLabel}
        </div>
      </div>
    </Card>
  );
}

/** One option in the Employed By RadioGroup, styled as a selectable card. The
 *  Label wraps the RadioGroupItem so the whole card is the hit target, and the
 *  selected state is driven off the item's own data-state rather than a second
 *  copy of "which one is checked" passed down as a prop. */
function EmploymentOption({ value, label }: { value: string; label: string }) {
  return (
    <Label
      htmlFor={`employment-${value}`}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2",
        "text-sm font-normal text-slate-700 transition hover:bg-slate-50",
        "has-[button[data-state=checked]]:border-primary-500",
        "has-[button[data-state=checked]]:bg-primary-50/60",
        "has-[button[data-state=checked]]:font-medium has-[button[data-state=checked]]:text-slate-900"
      )}
    >
      <RadioGroupItem id={`employment-${value}`} value={value} />
      {label}
    </Label>
  );
}

function Field({ label, name, required, children }: { label: string; name: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}{required && <span className="text-rose-600 ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}
