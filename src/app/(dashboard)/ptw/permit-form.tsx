"use client";

// PTW 8-step wizard — production-depth refactor (Commit 2).
//
// Steps:
//   1. Permit Type & Validity     → type, validity window, validity hours computed
//   2. Location & Scope           → plant, dept, area, specific location, GPS, scope, work order
//   3. Work Crew                  → originator (auto), receiver, crew (multi), fire watch / standby
//   4. Isolations                 → multi sub-form (skipped for Cold Work)
//   5. PPE & Equipment            → required PPE, tools used, subject equipment
//   6. Gas Test Plan              → for Hot Work / Confined Space — refresh freq + parameters
//   7. Additional Controls        → rescue plan, weather, wind, MSDS hint, adjacent notifications
//   8. Review & Submit            → preview + submit
//
// State lives in one big object. Each step has its own `validate()` returning
// {ok, errors} called before "Next". The Submit button on Step 8 calls
// POST /api/ptw with the structured payload (Pydantic schema in
// safeops_360_bakend/app/schemas/permit.py).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField, type SelectOption } from "@/components/ui/select-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserPicker } from "@/components/ui/user-picker";
import { useToast } from "@/components/ui/toast";
import { GpsCaptureStatus } from "@/components/ui/gps-capture";
import { useGeolocation } from "@/hooks/use-geolocation";
import { readApiError } from "@/lib/client-errors";
import {
  AlertCircle, ChevronLeft, ChevronRight, Check, MapPin, Trash2, Clock, Flame, Wrench, Users, ShieldAlert, ClipboardCheck, Zap, HardHat, Pickaxe, Hammer, Anchor
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RemoveRowButton } from "@/components/ui/remove-row-button";

type Plant = { id: string; name: string; areas: { id: string; name: string }[] };
type Department = { id: string; name: string };
type EquipmentRow = { id: string; code: string; name: string };

const TYPES = [
  { value: "HOT_WORK", label: "Hot Work", icon: Flame, maxHours: 24, requiresGasTest: true, requiresFireWatch: true, requiresStandby: false, requiresRescue: false },
  { value: "CONFINED_SPACE", label: "Confined Space Entry", icon: ShieldAlert, maxHours: 24, requiresGasTest: true, requiresFireWatch: false, requiresStandby: true, requiresRescue: true },
  { value: "WORK_AT_HEIGHT", label: "Work at Height", icon: HardHat, maxHours: 72, requiresGasTest: false, requiresFireWatch: false, requiresStandby: false, requiresRescue: true },
  { value: "EXCAVATION", label: "Excavation", icon: Pickaxe, maxHours: 72, requiresGasTest: false, requiresFireWatch: false, requiresStandby: false, requiresRescue: false },
  { value: "ELECTRICAL_LOTO", label: "Electrical / LOTO", icon: Zap, maxHours: 72, requiresGasTest: false, requiresFireWatch: false, requiresStandby: false, requiresRescue: false },
  { value: "LIFTING", label: "Lifting Operations", icon: Anchor, maxHours: 72, requiresGasTest: false, requiresFireWatch: false, requiresStandby: true, requiresRescue: false },
  { value: "GENERAL_COLD", label: "General Cold Work", icon: Hammer, maxHours: 72, requiresGasTest: false, requiresFireWatch: false, requiresStandby: false, requiresRescue: false }
] as const;

type TypeMeta = typeof TYPES[number];

const PPE_DEFAULTS: Record<string, string[]> = {
  HOT_WORK: ["helmet", "shoes", "goggles", "fr_coverall", "welding_gloves", "face_shield"],
  CONFINED_SPACE: ["helmet", "shoes", "harness", "scba", "gas_monitor"],
  WORK_AT_HEIGHT: ["helmet", "shoes", "harness", "lanyard"],
  EXCAVATION: ["helmet", "shoes", "high_vis"],
  ELECTRICAL_LOTO: ["helmet", "shoes", "insulated_gloves", "arc_flash_suit"],
  LIFTING: ["helmet", "shoes", "high_vis", "gloves"],
  GENERAL_COLD: ["helmet", "shoes"]
};

const PPE_CATALOG: { code: string; label: string }[] = [
  { code: "helmet", label: "Safety Helmet" },
  { code: "shoes", label: "Safety Shoes" },
  { code: "goggles", label: "Safety Goggles" },
  { code: "gloves", label: "Safety Gloves" },
  { code: "welding_gloves", label: "Welding Gloves" },
  { code: "insulated_gloves", label: "Insulated Gloves" },
  { code: "fr_coverall", label: "Fire-Retardant Coverall" },
  { code: "face_shield", label: "Face Shield" },
  { code: "arc_flash_suit", label: "Arc Flash Suit" },
  { code: "harness", label: "Full-body Harness" },
  { code: "lanyard", label: "Energy-absorbing Lanyard" },
  { code: "scba", label: "SCBA / Air Line" },
  { code: "gas_monitor", label: "Personal Gas Monitor" },
  { code: "high_vis", label: "High-vis Vest" },
  { code: "ear_plugs", label: "Ear Plugs" },
  { code: "respirator", label: "Respirator" }
];

const DEFAULT_GAS_PARAMS = {
  HOT_WORK: [
    { parameter: "LEL", lowLimit: 0, highLimit: 10, unit: "%" },
    { parameter: "O2", lowLimit: 19.5, highLimit: 23.5, unit: "%" }
  ],
  CONFINED_SPACE: [
    { parameter: "O2", lowLimit: 19.5, highLimit: 23.5, unit: "%" },
    { parameter: "LEL", lowLimit: 0, highLimit: 10, unit: "%" },
    { parameter: "CO", lowLimit: 0, highLimit: 35, unit: "ppm" },
    { parameter: "H2S", lowLimit: 0, highLimit: 10, unit: "ppm" }
  ]
} as const;

// The fixed enum lists the wizard's dropdowns offer. Hoisted to module scope
// so they are one array each rather than a fresh literal per render, and so
// the option text lives next to the type definitions it belongs to.
const CREW_ROLES: SelectOption[] = [
  { value: "WORKER", label: "Worker" },
  { value: "HELPER", label: "Helper" },
  { value: "OPERATOR", label: "Operator" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "TECHNICIAN", label: "Technician" },
  { value: "CONTRACTOR", label: "Contractor" }
];

const ISOLATION_TYPES: SelectOption[] = [
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "MECHANICAL", label: "Mechanical" },
  { value: "FLUID", label: "Fluid" },
  { value: "PNEUMATIC", label: "Pneumatic" },
  { value: "HYDRAULIC", label: "Hydraulic" },
  { value: "STEAM", label: "Steam" }
];

const WORK_NATURES: SelectOption[] = [
  { value: "INSPECTION", label: "Inspection" },
  { value: "REPAIR", label: "Repair" },
  { value: "REPLACEMENT", label: "Replacement" },
  { value: "MODIFICATION", label: "Modification" }
];

const FLRA_OVERRIDES: SelectOption[] = [
  { value: "yes", label: "Required — crew must complete & sign an FLRA before activation" },
  { value: "no", label: "Not required for this permit" }
];

type CrewRow = { tempId: string; userId: string; role: string };
type IsolationRow = { tempId: string; isolationType: string; description: string; isolationPointTag: string; lotoTagNumber: string };
type ToolRow = { tempId: string; equipmentId: string; freeTextDescription: string };
type SubjectEqRow = { tempId: string; equipmentId: string; workNature: string };
type GasParam = { parameter: string; lowLimit: string; highLimit: string; unit: string };

function tempId() { return `tmp-${Math.random().toString(36).slice(2, 11)}`; }

const STEPS = [
  { id: 1, label: "Type & Validity", icon: Clock },
  { id: 2, label: "Location & Scope", icon: MapPin },
  { id: 3, label: "Work Crew", icon: Users },
  { id: 4, label: "Isolations", icon: ShieldAlert },
  { id: 5, label: "PPE & Equipment", icon: Wrench },
  { id: 6, label: "Gas Test Plan", icon: Flame },
  { id: 7, label: "Controls", icon: AlertCircle },
  { id: 8, label: "Review", icon: ClipboardCheck }
];

/** Context handed over when the wizard is opened from a HIRA hazard row that
 *  the hazard library flags as permit-requiring. Everything here is a starting
 *  point the originator can change — only the two ids are carried verbatim. */
export type HiraPrefill = {
  hiraEntryId: string;
  hiraEntryHazardId: string;
  plantId: string | null;
  areaId: string | null;
  location: string | null;
  specificLocation: string | null;
  scopeOfWork: string | null;
  suggestedPermitType: string | null;
  hazardName: string | null;
  studyNumber: string | null;
  residualRiskLevel: string | null;
};

export function PermitForm({
  plants,
  defaultPlantId,
  hiraPrefill
}: {
  plants: Plant[];
  defaultPlantId?: string | null;
  hiraPrefill?: HiraPrefill | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ─── Step 1 — type + validity ───
  // A HIRA-driven permit opens on the type the hazard implies rather than the
  // generic Hot Work default.
  const [type, setType] = useState<string>(
    hiraPrefill?.suggestedPermitType && TYPES.some((t) => t.value === hiraPrefill.suggestedPermitType)
      ? hiraPrefill.suggestedPermitType
      : "HOT_WORK"
  );
  const typeMeta = useMemo<TypeMeta>(() => TYPES.find((t) => t.value === type) ?? TYPES[0], [type]);
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const defaultEnd = new Date(Date.now() + 4 * 3_600_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const [validFrom, setValidFrom] = useState(nowLocal);
  const [validTo, setValidTo] = useState(defaultEnd);
  const validityHours = useMemo(() => {
    const a = new Date(validFrom).getTime();
    const b = new Date(validTo).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return Math.max(0, Math.round((b - a) / 3_600_000));
  }, [validFrom, validTo]);

  // ─── Step 2 — location ───
  // Default to the originator's own plant — that's where the issuers, crew and
  // equipment that match the permit actually live. Falling back to plants[0]
  // (alphabetical) used to land the wizard on a plant with no PERMIT_ISSUER /
  // equipment, leaving the Step-3 pickers empty and the user unable to proceed.
  // A HIRA prefill wins over the session plant: the permit has to be raised
  // against the plant the assessed activity actually sits in.
  const initialPlantId =
    (hiraPrefill?.plantId && plants.some((p) => p.id === hiraPrefill.plantId)
      ? hiraPrefill.plantId
      : null) ??
    (defaultPlantId && plants.some((p) => p.id === defaultPlantId) ? defaultPlantId : null) ??
    plants[0]?.id ??
    "";
  const [plantId, setPlantId] = useState(initialPlantId);
  const [departmentId, setDepartmentId] = useState("");
  const [areaId, setAreaId] = useState(hiraPrefill?.areaId ?? "");
  const [specificLocation, setSpecificLocation] = useState(hiraPrefill?.specificLocation ?? "");
  const [scopeOfWork, setScopeOfWork] = useState(hiraPrefill?.scopeOfWork ?? "");
  const [workOrderNumber, setWorkOrderNumber] = useState("");
  const [contractorCompanyId, setContractorCompanyId] = useState("");
  const [contractors, setContractors] = useState<{ id: string; name: string }[]>([]);
  const { coords: gps, status: gpsStatus, error: gpsError, request: requestGps } = useGeolocation();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentRow[]>([]);
  // Both step-5 dropdowns render the same master list; deriving it once keeps
  // the two in step and avoids rebuilding the array per row per render.
  const equipmentOptions: SelectOption[] = useMemo(
    () => equipmentList.map((eq) => ({ value: eq.id, label: `${eq.name} (${eq.code})` })),
    [equipmentList]
  );
  const [loadingMasters, setLoadingMasters] = useState(false);
  const selectedPlant = useMemo(() => plants.find((p) => p.id === plantId), [plants, plantId]);

  // ─── Step 3 — crew ───
  const [issuerId, setIssuerId] = useState<string | null>(null);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [crew, setCrew] = useState<CrewRow[]>([]);
  const [fireWatchPersonId, setFireWatchPersonId] = useState<string | null>(null);
  const [standbyPersonId, setStandbyPersonId] = useState<string | null>(null);

  // ─── Step 4 — isolations ───
  const [isolations, setIsolations] = useState<IsolationRow[]>([]);

  // ─── Step 5 — PPE + tools + subject equipment ───
  const [ppe, setPpe] = useState<string[]>(PPE_DEFAULTS["HOT_WORK"]);
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [subjectEq, setSubjectEq] = useState<SubjectEqRow[]>([]);

  // ─── Step 6 — gas test plan ───
  const [gasRefreshMinutes, setGasRefreshMinutes] = useState("120");
  const [gasParams, setGasParams] = useState<GasParam[]>([]);
  const [gasInstrumentSerial, setGasInstrumentSerial] = useState("");
  const [gasInstrumentCalibrated, setGasInstrumentCalibrated] = useState("");

  // ─── Step 7 — additional controls ───
  const [rescuePlan, setRescuePlan] = useState("");
  const [weatherConditions, setWeatherConditions] = useState("");
  const [windSpeedKmh, setWindSpeedKmh] = useState("");
  const [adjacentNotificationIds, setAdjacentNotificationIds] = useState<string[]>([]);
  // FLRA policy override (closed-loop rebuild): "" = follow site policy,
  // "yes"/"no" send an explicit boolean the backend snapshots per permit.
  const [flraOverride, setFlraOverride] = useState<"" | "yes" | "no">("");

  // When type changes, refresh defaults that depend on it
  function onTypeChange(newType: string) {
    setType(newType);
    setPpe(PPE_DEFAULTS[newType] ?? ["helmet", "shoes"]);
    if (newType === "HOT_WORK" || newType === "CONFINED_SPACE") {
      const defaults = DEFAULT_GAS_PARAMS[newType];
      setGasParams(defaults.map((d) => ({
        parameter: d.parameter,
        lowLimit: d.lowLimit?.toString() ?? "",
        highLimit: d.highLimit?.toString() ?? "",
        unit: d.unit
      })));
      setGasRefreshMinutes(newType === "HOT_WORK" ? "240" : "120");
    } else {
      setGasParams([]);
    }
  }

  // Load departments + equipment when plant changes.
  // NB: this MUST be an effect, not a useMemo — fetching is a side-effect.
  // useMemo is for derived values; React may skip it or discard the cleanup
  // it returns, so the old useMemo version could silently fail to refresh the
  // masters (and never run its cleanup), which is part of why the dropdowns
  // looked stuck/empty.
  useEffect(() => {
    if (!plantId) {
      setDepartments([]); setEquipmentList([]);
      return;
    }
    let cancelled = false;
    setLoadingMasters(true);
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
      } finally {
        if (!cancelled) setLoadingMasters(false);
      }
    })();
    return () => { cancelled = true; };
  }, [plantId]);

  // Contractor companies (plant-agnostic master) — fetch once.
  useEffect(() => {
    let alive = true;
    fetch("/api/near-miss/masters/contractors")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => { if (alive && Array.isArray(rows)) setContractors(rows); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // ─── Step validation ─────────────────────────────────────────────
  function validateStep(n: number): string | null {
    if (n === 1) {
      if (!type) return "Pick a permit type.";
      if (!validFrom || !validTo) return "Set validity window.";
      if (new Date(validTo) <= new Date(validFrom)) return "Valid To must be after Valid From.";
      if (validityHours !== null && validityHours > typeMeta.maxHours) {
        return `Validity exceeds ${typeMeta.maxHours}h cap for ${typeMeta.label}.`;
      }
    }
    if (n === 2) {
      if (!plantId) return "Plant required.";
      if (!areaId) return "Area required.";
      if (!specificLocation && !selectedPlant?.areas.find((a) => a.id === areaId)?.name) return "Specific location required.";
      if (!scopeOfWork || scopeOfWork.trim().length < 10) return "Scope of work must be at least 10 characters.";
    }
    if (n === 3) {
      if (!issuerId) return "Issuer required.";
      if (!receiverId) return "Receiver required.";
      if (issuerId === receiverId) return "Issuer and receiver cannot be the same person.";
      if (typeMeta.requiresFireWatch && !fireWatchPersonId) return `Fire watch person required for ${typeMeta.label}.`;
      if (typeMeta.requiresStandby && !standbyPersonId) return `Standby person required for ${typeMeta.label}.`;
      if (typeMeta.requiresStandby && standbyPersonId && crew.some((c) => c.userId === standbyPersonId)) {
        return "Standby person cannot also be a crew member.";
      }
    }
    if (n === 4) {
      // Cold Work skips this step entirely
      if (typeMeta.value !== "GENERAL_COLD") {
        if (isolations.length > 0 && isolations.some((i) => !i.isolationType || !i.description || !i.isolationPointTag)) {
          return "Each isolation needs type, description, and a physical tag.";
        }
      }
    }
    if (n === 5) {
      if (ppe.length === 0) return "At least one PPE item is required.";
      if (subjectEq.some((s) => !s.equipmentId || !s.workNature)) {
        return "Each subject equipment row needs both equipment and work nature.";
      }
    }
    if (n === 6) {
      if (typeMeta.requiresGasTest) {
        if (gasParams.length === 0) return "Gas test plan must include at least one parameter.";
        if (gasParams.some((p) => !p.parameter || !p.unit)) return "Each gas parameter needs a name and unit.";
        const refreshNum = Number(gasRefreshMinutes);
        if (!refreshNum || refreshNum < 15 || refreshNum > 480) return "Refresh frequency must be between 15 and 480 minutes.";
      }
    }
    if (n === 7) {
      if (typeMeta.requiresRescue && !rescuePlan.trim()) return `Rescue plan required for ${typeMeta.label}.`;
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError("");
    // Skip Step 4 for cold work, Step 6 for non-gas-test types
    let target = step + 1;
    if (target === 4 && typeMeta.value === "GENERAL_COLD") target = 5;
    if (target === 6 && !typeMeta.requiresGasTest) target = 7;
    setStep(target);
  }
  function back() {
    setError("");
    let target = step - 1;
    if (target === 6 && !typeMeta.requiresGasTest) target = 5;
    if (target === 4 && typeMeta.value === "GENERAL_COLD") target = 3;
    setStep(Math.max(1, target));
  }

  // ─── Submit ──────────────────────────────────────────────────────
  async function submit() {
    for (let s = 1; s <= 7; s++) {
      const err = validateStep(s);
      if (err) { setError(`Step ${s}: ${err}`); setStep(s); return; }
    }
    setSubmitting(true);
    setError("");
    const ppeChecklistJson: Record<string, boolean> = {};
    PPE_CATALOG.forEach((p) => { ppeChecklistJson[p.code] = ppe.includes(p.code); });
    const payload = {
      type,
      plantId,
      areaId: areaId || null,
      location: specificLocation || selectedPlant?.areas.find((a) => a.id === areaId)?.name || "",
      scopeOfWork,
      validFrom: new Date(validFrom).toISOString(),
      validTo: new Date(validTo).toISOString(),
      issuerId,
      receiverId,
      departmentId: departmentId || null,
      specificLocation: specificLocation || null,
      contractorCompanyId: contractorCompanyId || null,
      // Keep the legacy free-text field populated from the picked company.
      contractorName: contractors.find((c) => c.id === contractorCompanyId)?.name || null,
      gpsLatitude: gps?.lat ?? null,
      gpsLongitude: gps?.lng ?? null,
      workOrderNumber: workOrderNumber || null,
      // HIRA provenance — present only when this wizard was opened from a
      // hazard row's Create-PTW prompt. Carried through so the finished permit
      // is traceable back to the assessment that called for it.
      hiraEntryId: hiraPrefill?.hiraEntryId ?? null,
      hiraEntryHazardId: hiraPrefill?.hiraEntryHazardId ?? null,
      workCrew: crew.map((c) => ({ userId: c.userId, role: c.role })),
      fireWatchPersonId: fireWatchPersonId || null,
      standbyPersonId: standbyPersonId || null,
      isolations: typeMeta.value === "GENERAL_COLD" ? [] : isolations.map((i) => ({
        isolationType: i.isolationType,
        description: i.description,
        isolationPointTag: i.isolationPointTag,
        lotoTagNumber: i.lotoTagNumber || null
      })),
      requiredPpe: ppe,
      ppeChecklist: JSON.stringify(ppeChecklistJson),
      toolsEquipment: tools.filter((t) => t.equipmentId || t.freeTextDescription).map((t) => ({
        equipmentId: t.equipmentId || null,
        freeTextDescription: t.freeTextDescription || null
      })),
      subjectEquipment: subjectEq.map((s) => ({ equipmentId: s.equipmentId, workNature: s.workNature })),
      gasTestPlan: typeMeta.requiresGasTest ? {
        refreshFrequencyMinutes: Number(gasRefreshMinutes),
        parametersToTest: gasParams.map((p) => ({
          parameter: p.parameter,
          lowLimit: p.lowLimit ? Number(p.lowLimit) : null,
          highLimit: p.highLimit ? Number(p.highLimit) : null,
          unit: p.unit
        })),
        instrumentSerial: gasInstrumentSerial || null,
        instrumentLastCalibrated: gasInstrumentCalibrated ? new Date(gasInstrumentCalibrated).toISOString() : null
      } : null,
      gasTestRequired: typeMeta.requiresGasTest,
      fireWatchRequired: typeMeta.requiresFireWatch,
      rescuePlan: typeMeta.requiresRescue ? rescuePlan : (rescuePlan || null),
      weatherConditionsAtIssue: weatherConditions || null,
      windSpeedKmh: windSpeedKmh ? Number(windSpeedKmh) : null,
      adjacentAreaNotifications: adjacentNotificationIds.length > 0 ? { userIds: adjacentNotificationIds } : null,
      // null → backend resolves from PTW_FLRA_REQUIRED_* site policy.
      flraRequired: flraOverride === "" ? null : flraOverride === "yes"
    };
    try {
      const res = await fetch("/api/ptw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setError(await readApiError(res, "Permit submission failed"));
        setSubmitting(false);
        return;
      }
      const j = await res.json();
      toast({ variant: "success", title: "Permit submitted", description: j.number ?? "Awaiting approval" });
      router.push(`/ptw/${j.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Network error");
      setSubmitting(false);
    }
  }

  // ─── Step strip ───
  const visibleSteps = STEPS.filter((s) =>
    !(s.id === 4 && typeMeta.value === "GENERAL_COLD") &&
    !(s.id === 6 && !typeMeta.requiresGasTest)
  );

  return (
    <div className="max-w-4xl space-y-4">
      {/* Step indicator — circles + connecting lines */}
      <Card>
        <CardContent className="p-4">
          <ol className="flex items-start w-full">
            {visibleSteps.map((s, idx) => {
              const active = step === s.id;
              const done = step > s.id;
              const Icon = s.icon;
              const clickable = done;
              const isLast = idx === visibleSteps.length - 1;
              return (
                <li
                  key={s.id}
                  className={cn(
                    "flex items-start relative",
                    !isLast && "flex-1"
                  )}
                >
                  <div className="flex flex-col items-center min-w-[2.25rem]">
                    <button
                      type="button"
                      onClick={() => clickable && setStep(s.id)}
                      disabled={!clickable}
                      aria-current={active ? "step" : undefined}
                      className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors",
                        active && "border-primary-600 bg-primary-600 text-white shadow-sm ring-4 ring-primary-100",
                        done && "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer",
                        !active && !done && "border-slate-200 bg-white text-slate-400"
                      )}
                    >
                      {done ? <Check size={16} strokeWidth={3} /> : <Icon size={15} />}
                    </button>
                    <span
                      className={cn(
                        "mt-1.5 text-[11px] font-medium text-center leading-tight max-w-[5.5rem] hidden sm:block",
                        active ? "text-primary-700" : done ? "text-emerald-700" : "text-slate-500"
                      )}
                    >
                      {s.label}
                    </span>
                    <span className={cn(
                      "mt-1 text-[10px] font-semibold sm:hidden",
                      active ? "text-primary-700" : done ? "text-emerald-700" : "text-slate-500"
                    )}>
                      {s.id}
                    </span>
                  </div>
                  {!isLast && (
                    <div className="flex-1 h-0.5 mt-4 mx-1 rounded-full bg-slate-200 overflow-hidden">
                      <div className={cn(
                        "h-full transition-all",
                        done ? "w-full bg-emerald-500" : "w-0"
                      )} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {/* Provenance banner — this permit was called for by a HIRA hazard row.
          Shown on every step so the originator keeps the context in view. */}
      {hiraPrefill && (
        <Alert variant="warning" size="lg" className="border-amber-300">
          <div className="font-medium">
            Raised from HIRA{hiraPrefill.studyNumber ? ` ${hiraPrefill.studyNumber}` : ""}
            {hiraPrefill.hazardName ? ` — ${hiraPrefill.hazardName}` : ""}
          </div>
          <div className="text-xs mt-0.5">
            The hazard library flags this hazard as permit-requiring. Type, plant, area and scope
            are pre-filled from the assessment — adjust anything that does not match the actual
            job. The finished permit stays linked to the HIRA entry.
            {hiraPrefill.residualRiskLevel
              ? ` Assessed residual risk: ${hiraPrefill.residualRiskLevel}.`
              : ""}
          </div>
        </Alert>
      )}

      {/* Step content */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>1. Permit Type & Validity</CardTitle>
            <CardDescription>Type drives required controls (gas test, fire watch, etc.) and the approval chain.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div
              role="radiogroup"
              aria-label="Permit type"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              {TYPES.map((t) => {
                const selected = type === t.value;
                const TypeIcon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onTypeChange(t.value)}
                    className={cn(
                      "group relative rounded-xl border bg-card text-left p-4 shadow-sm transition-all",
                      "hover:border-primary-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                      selected
                        ? "border-primary-600 ring-2 ring-primary-100 bg-primary-50/40"
                        : "border-slate-200"
                    )}
                  >
                    {selected && (
                      <span className="absolute top-2.5 right-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
                          selected
                            ? "bg-primary-600 text-white"
                            : "bg-slate-100 text-slate-600 group-hover:bg-primary-100 group-hover:text-primary-700"
                        )}
                      >
                        <TypeIcon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 leading-tight">
                          {t.label}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="neutral" size="sm" className="font-medium">
                            Max {t.maxHours}h
                          </Badge>
                          {t.requiresGasTest && (
                            <Badge variant="warning" size="sm" className="bg-amber-50 font-medium">
                              gas test
                            </Badge>
                          )}
                          {t.requiresFireWatch && (
                            <Badge variant="danger" size="sm" className="bg-rose-50 font-medium">
                              fire watch
                            </Badge>
                          )}
                          {t.requiresStandby && (
                            <Badge variant="info" size="sm" className="border-sky-200 bg-sky-50 font-medium text-sky-700">
                              standby
                            </Badge>
                          )}
                          {t.requiresRescue && (
                            <Badge variant="violet" size="sm" className="bg-violet-50 font-medium">
                              rescue
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Valid From <span className="text-rose-600">*</span></Label>
                <Input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
              </div>
              <div>
                <Label>Valid To <span className="text-rose-600">*</span></Label>
                <Input type="datetime-local" value={validTo} onChange={(e) => setValidTo(e.target.value)} required />
              </div>
            </div>
            {validityHours !== null && (
              <div className={cn(
                "rounded-md border px-3 py-2 text-sm flex items-center gap-2",
                validityHours > typeMeta.maxHours
                  ? "border-rose-300 bg-rose-50 text-rose-900"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              )}>
                <Clock size={14} />
                <span>
                  Validity: <strong>{validityHours}h</strong>
                  {validityHours > typeMeta.maxHours && ` — exceeds ${typeMeta.maxHours}h cap`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>2. Location & Scope</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Plant <span className="text-rose-600">*</span></Label>
                <SelectField
                  value={plantId}
                  onChange={(v) => { setPlantId(v); setAreaId(""); setDepartmentId(""); }}
                  required
                  options={plants.map((p) => ({ value: p.id, label: p.name }))}
                />
              </div>
              <div>
                <Label>Department</Label>
                <SelectField
                  value={departmentId}
                  onChange={setDepartmentId}
                  disabled={loadingMasters}
                  placeholder={loadingMasters ? "Loading…" : "— Select —"}
                  options={departments.map((d) => ({ value: d.id, label: d.name }))}
                />
              </div>
              <div>
                <Label>Area <span className="text-rose-600">*</span></Label>
                <SelectField
                  value={areaId}
                  onChange={setAreaId}
                  required
                  placeholder="— Select —"
                  options={(selectedPlant?.areas ?? []).map((a) => ({ value: a.id, label: a.name }))}
                />
              </div>
              <div>
                <Label>Specific Location</Label>
                <Input value={specificLocation} onChange={(e) => setSpecificLocation(e.target.value)}
                  placeholder="e.g. Cement Mill #2 gearbox bay" />
              </div>
              <div>
                <Label>Contractor (if applicable)</Label>
                <SelectField
                  value={contractorCompanyId}
                  onChange={setContractorCompanyId}
                  placeholder="— None (own employee) —"
                  options={contractors.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Scope of Work <span className="text-rose-600">*</span></Label>
                <Textarea rows={3} value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)}
                  placeholder="Detailed description of work to be performed (10+ chars)" minLength={10} required />
              </div>
              <div>
                <Label>Work Order Number</Label>
                <Input value={workOrderNumber} onChange={(e) => setWorkOrderNumber(e.target.value)}
                  placeholder="If linked to maintenance system" />
              </div>
            </div>
            <GpsCaptureStatus
              status={gpsStatus}
              coords={gps}
              error={gpsError}
              onRetry={requestGps}
            />
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Work Crew</CardTitle>
            <CardDescription>Issuer and Receiver must differ. Crew added here is checked for training validity at submission.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Issuer <span className="text-rose-600">*</span></Label>
                <UserPicker value={issuerId} onChange={(id) => setIssuerId(id)}
                  filter={{ plantId, role: "PERMIT_ISSUER", roleFallback: true }} placeholder="Search & select issuer…" required />
                <p className="text-xs text-slate-500 mt-0.5">
                  Lists this plant's designated Permit Issuers. If none are configured, any plant user can be picked.
                </p>
              </div>
              <div>
                <Label>Receiver <span className="text-rose-600">*</span></Label>
                <UserPicker value={receiverId} onChange={(id) => setReceiverId(id)}
                  filter={{ plantId }} placeholder="Search & select receiver…" required />
                <p className="text-xs text-slate-500 mt-0.5">
                  Receiver's training certification ({typeMeta.label}) is checked at server submission.
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="!mb-0">Work Crew</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setCrew((c) => [...c, { tempId: tempId(), userId: "", role: "WORKER" }])}>+ Add Crew Member</Button>
              </div>
              {crew.length === 0 && <div className="text-sm text-slate-500 italic">No crew members added.</div>}
              {crew.map((c) => (
                <Card key={c.tempId} className="mb-2 flex items-center gap-2 rounded-md border-slate-200 bg-slate-50/50 p-2 shadow-none">
                  <div className="flex-1">
                    <UserPicker value={c.userId || null} onChange={(id) => setCrew((p) => p.map((r) => r.tempId === c.tempId ? { ...r, userId: id ?? "" } : r))}
                      filter={{ plantId }} placeholder="Search…" />
                  </div>
                  <SelectField
                    value={c.role}
                    onChange={(v) => setCrew((p) => p.map((r) => r.tempId === c.tempId ? { ...r, role: v } : r))}
                    ariaLabel="Crew role"
                    className="w-32"
                    options={CREW_ROLES}
                  />
                  <RemoveRowButton
                    label="Remove crew member"
                    onClick={() => setCrew((p) => p.filter((r) => r.tempId !== c.tempId))}
                  />
                </Card>
              ))}
            </div>

            {typeMeta.requiresFireWatch && (
              <div>
                <Label>Fire Watch Person <span className="text-rose-600">*</span></Label>
                <UserPicker value={fireWatchPersonId} onChange={(id) => setFireWatchPersonId(id)}
                  filter={{ plantId }} placeholder="Search & select fire watch…" required />
                <p className="text-xs text-slate-500 mt-0.5">Mandatory for Hot Work. Must hold valid fire watch training.</p>
              </div>
            )}
            {typeMeta.requiresStandby && (
              <div>
                <Label>Standby Person <span className="text-rose-600">*</span></Label>
                <UserPicker value={standbyPersonId} onChange={(id) => setStandbyPersonId(id)}
                  filter={{ plantId }} placeholder="Search & select standby…" required />
                <p className="text-xs text-slate-500 mt-0.5">Mandatory for Confined Space. Cannot be on the work crew.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 4 && typeMeta.value !== "GENERAL_COLD" && (
        <Card>
          <CardHeader>
            <CardTitle>4. Isolations</CardTitle>
            <CardDescription>Energy sources to be isolated before work begins. Issuer verifies each one pre-activation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isolations.length === 0 && <div className="text-sm text-slate-500 italic">No isolations added. Work that doesn't need isolations can skip this step.</div>}
            {isolations.map((iso) => (
              <Card key={iso.tempId} className="grid items-end gap-2 rounded-md border-slate-200 p-2.5 shadow-none sm:grid-cols-[1fr_2fr_1fr_1fr_auto]">
                <div>
                  <Label>Type</Label>
                  <SelectField
                    value={iso.isolationType}
                    onChange={(v) => setIsolations((p) => p.map((r) => r.tempId === iso.tempId ? { ...r, isolationType: v } : r))}
                    placeholder="—"
                    options={ISOLATION_TYPES}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={iso.description} onChange={(e) => setIsolations((p) => p.map((r) => r.tempId === iso.tempId ? { ...r, description: e.target.value } : r))} placeholder="e.g. Mill main motor breaker" />
                </div>
                <div>
                  <Label>Point Tag</Label>
                  <Input value={iso.isolationPointTag} onChange={(e) => setIsolations((p) => p.map((r) => r.tempId === iso.tempId ? { ...r, isolationPointTag: e.target.value } : r))} placeholder="MCC-04-A1" />
                </div>
                <div>
                  <Label>LOTO Tag #</Label>
                  <Input value={iso.lotoTagNumber} onChange={(e) => setIsolations((p) => p.map((r) => r.tempId === iso.tempId ? { ...r, lotoTagNumber: e.target.value } : r))} placeholder="optional" />
                </div>
                <RemoveRowButton
                  label="Remove isolation"
                  className="mb-1.5"
                  onClick={() => setIsolations((p) => p.filter((r) => r.tempId !== iso.tempId))}
                />
              </Card>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setIsolations((p) => [...p, { tempId: tempId(), isolationType: "", description: "", isolationPointTag: "", lotoTagNumber: "" }])}>+ Add Isolation</Button>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>5. PPE & Equipment</CardTitle>
            <CardDescription>PPE auto-selected from permit type defaults. Tools and subject equipment have their inspection currency checked at issuance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Required PPE</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1">
                {PPE_CATALOG.map((p) => (
                  <Label
                    key={p.code}
                    htmlFor={`ppe-${p.code}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm font-normal",
                      ppe.includes(p.code) ? "border-primary-300 bg-primary-50/50" : "border-slate-200 bg-white"
                    )}
                  >
                    <Checkbox
                      id={`ppe-${p.code}`}
                      checked={ppe.includes(p.code)}
                      onChange={() => setPpe((cur) => cur.includes(p.code) ? cur.filter((x) => x !== p.code) : [...cur, p.code])}
                    />
                    <span>{p.label}</span>
                  </Label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="!mb-0">Tools / Equipment Used by Crew</Label>
                <Button type="button" size="sm" variant="outline" disabled={equipmentList.length === 0}
                  onClick={() => setTools((p) => [...p, { tempId: tempId(), equipmentId: "", freeTextDescription: "" }])}>+ Add Tool</Button>
              </div>
              {tools.length === 0 && <div className="text-sm text-slate-500 italic">None added.</div>}
              {tools.map((t) => (
                <Card key={t.tempId} className="mb-2 grid items-end gap-2 rounded-md border-slate-200 p-2 shadow-none sm:grid-cols-[2fr_2fr_auto]">
                  <div>
                    <Label>Equipment from Master</Label>
                    <SelectField
                      value={t.equipmentId}
                      onChange={(v) => setTools((p) => p.map((r) => r.tempId === t.tempId ? { ...r, equipmentId: v } : r))}
                      placeholder="— or use free text —"
                      options={equipmentOptions}
                    />
                  </div>
                  <div>
                    <Label>Free-text description</Label>
                    <Input value={t.freeTextDescription} onChange={(e) => setTools((p) => p.map((r) => r.tempId === t.tempId ? { ...r, freeTextDescription: e.target.value } : r))} placeholder="for tools not in master" />
                  </div>
                  <RemoveRowButton
                    label="Remove tool"
                    className="mb-1.5"
                    onClick={() => setTools((p) => p.filter((r) => r.tempId !== t.tempId))}
                  />
                </Card>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="!mb-0">Subject Equipment (being worked on)</Label>
                <Button type="button" size="sm" variant="outline" disabled={equipmentList.length === 0}
                  onClick={() => setSubjectEq((p) => [...p, { tempId: tempId(), equipmentId: "", workNature: "REPAIR" }])}>+ Add Subject</Button>
              </div>
              {subjectEq.length === 0 && <div className="text-sm text-slate-500 italic">None added.</div>}
              {subjectEq.map((s) => (
                <Card key={s.tempId} className="mb-2 grid items-end gap-2 rounded-md border-slate-200 p-2 shadow-none sm:grid-cols-[2fr_1fr_auto]">
                  <div>
                    <Label>Equipment <span className="text-rose-600">*</span></Label>
                    <SelectField
                      value={s.equipmentId}
                      onChange={(v) => setSubjectEq((p) => p.map((r) => r.tempId === s.tempId ? { ...r, equipmentId: v } : r))}
                      placeholder="— Select —"
                      options={equipmentOptions}
                    />
                  </div>
                  <div>
                    <Label>Work Nature</Label>
                    <SelectField
                      value={s.workNature}
                      onChange={(v) => setSubjectEq((p) => p.map((r) => r.tempId === s.tempId ? { ...r, workNature: v } : r))}
                      ariaLabel="Work nature"
                      options={WORK_NATURES}
                    />
                  </div>
                  <RemoveRowButton
                    label="Remove subject equipment"
                    className="mb-1.5"
                    onClick={() => setSubjectEq((p) => p.filter((r) => r.tempId !== s.tempId))}
                  />
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 6 && typeMeta.requiresGasTest && (
        <Card>
          <CardHeader>
            <CardTitle>6. Gas Test Plan</CardTitle>
            <CardDescription>Parameters monitored, test refresh frequency, and the instrument used. Pre-entry reading captured at activation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Refresh Frequency (minutes)</Label>
                <Input type="number" min={15} max={480} value={gasRefreshMinutes} onChange={(e) => setGasRefreshMinutes(e.target.value)} />
                <p className="text-xs text-slate-500 mt-0.5">15–480 min. Default 240 (Hot Work) / 120 (Confined Space).</p>
              </div>
              <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <Label>Instrument Serial</Label>
                  <Input value={gasInstrumentSerial} onChange={(e) => setGasInstrumentSerial(e.target.value)} placeholder="e.g. GM-04-001" />
                </div>
                <div>
                  <Label>Last Calibrated</Label>
                  <Input type="date" value={gasInstrumentCalibrated} onChange={(e) => setGasInstrumentCalibrated(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="!mb-0">Parameters to Test</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setGasParams((p) => [...p, { parameter: "OTHER", lowLimit: "", highLimit: "", unit: "" }])}>+ Add Parameter</Button>
              </div>
              {gasParams.map((p, i) => (
                <Card key={i} className="rounded-md border border-slate-200 p-2 grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 mb-2 items-end shadow-none">
                  <div>
                    <Label>Parameter</Label>
                    <Input value={p.parameter} onChange={(e) => setGasParams((arr) => arr.map((x, idx) => idx === i ? { ...x, parameter: e.target.value } : x))} />
                  </div>
                  <div>
                    <Label>Low Limit</Label>
                    <Input type="number" value={p.lowLimit} onChange={(e) => setGasParams((arr) => arr.map((x, idx) => idx === i ? { ...x, lowLimit: e.target.value } : x))} />
                  </div>
                  <div>
                    <Label>High Limit</Label>
                    <Input type="number" value={p.highLimit} onChange={(e) => setGasParams((arr) => arr.map((x, idx) => idx === i ? { ...x, highLimit: e.target.value } : x))} />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Input value={p.unit} onChange={(e) => setGasParams((arr) => arr.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x))} placeholder="%, ppm" />
                  </div>
                  <RemoveRowButton
                    label="Remove gas parameter"
                    className="mb-1.5"
                    onClick={() => setGasParams((arr) => arr.filter((_, idx) => idx !== i))}
                  />
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 7 && (
        <Card>
          <CardHeader><CardTitle>7. Additional Controls</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {typeMeta.requiresRescue && (
              <div>
                <Label>Rescue Plan <span className="text-rose-600">*</span></Label>
                <Textarea rows={3} value={rescuePlan} onChange={(e) => setRescuePlan(e.target.value)}
                  placeholder="Step-by-step rescue procedure, equipment available, escape routes…" />
                <p className="text-xs text-slate-500 mt-0.5">Required for Confined Space and Work at Height.</p>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Weather Conditions</Label>
                <Input value={weatherConditions} onChange={(e) => setWeatherConditions(e.target.value)}
                  placeholder="e.g. Clear, 28°C" />
              </div>
              <div>
                <Label>Wind Speed (km/h)</Label>
                <Input type="number" value={windSpeedKmh} onChange={(e) => setWindSpeedKmh(e.target.value)}
                  placeholder="for outdoor hot work" />
                {typeMeta.value === "HOT_WORK" && Number(windSpeedKmh) > 25 && (
                  <p className="text-xs text-rose-700 mt-0.5">⚠ Wind &gt; 25 km/h — outdoor hot work not recommended.</p>
                )}
              </div>
            </div>
            <div>
              <Label>Field-Level Risk Assessment (FLRA)</Label>
              <SelectField
                value={flraOverride}
                onChange={(v) => setFlraOverride(v as "" | "yes" | "no")}
                ariaLabel="Field-Level Risk Assessment requirement"
                placeholder="Follow site policy (default)"
                options={FLRA_OVERRIDES}
              />
              <p className="text-xs text-slate-500 mt-0.5">
                Controls whether the FLRA sub-flow gates the receiver's acceptance.
                The choice is snapshotted on the permit for audit.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 8 && (
        <Card>
          <CardHeader>
            <CardTitle>8. Review & Submit</CardTitle>
            <CardDescription>Confirm everything below. After submission the permit enters approval workflow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReviewRow label="Type" value={typeMeta.label} />
            <ReviewRow label="Validity" value={`${validFrom.replace("T", " ")} → ${validTo.replace("T", " ")} (${validityHours}h)`} />
            <ReviewRow label="Plant" value={selectedPlant?.name ?? "—"} />
            <ReviewRow label="Area" value={selectedPlant?.areas.find((a) => a.id === areaId)?.name ?? "—"} />
            {specificLocation && <ReviewRow label="Specific Location" value={specificLocation} />}
            <ReviewRow label="Scope" value={scopeOfWork} />
            <ReviewRow label="Crew" value={`Issuer + Receiver + ${crew.length} crew member${crew.length === 1 ? "" : "s"}${typeMeta.requiresFireWatch ? " + Fire Watch" : ""}${typeMeta.requiresStandby ? " + Standby" : ""}`} />
            {typeMeta.value !== "GENERAL_COLD" && <ReviewRow label="Isolations" value={`${isolations.length} isolation${isolations.length === 1 ? "" : "s"}`} />}
            <ReviewRow label="PPE" value={`${ppe.length} item${ppe.length === 1 ? "" : "s"}`} />
            <ReviewRow label="Tools" value={`${tools.length} tool${tools.length === 1 ? "" : "s"}`} />
            <ReviewRow label="Subject Equipment" value={`${subjectEq.length} item${subjectEq.length === 1 ? "" : "s"}`} />
            {typeMeta.requiresGasTest && <ReviewRow label="Gas Test" value={`${gasParams.length} parameter${gasParams.length === 1 ? "" : "s"}, refresh every ${gasRefreshMinutes}min`} />}
            {typeMeta.requiresRescue && <ReviewRow label="Rescue Plan" value={rescuePlan ? "✓ provided" : "—"} />}
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive" size="lg">
          <AlertCircle className="mt-0.5" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 -mx-6 px-6 py-3">
        <Button type="button" variant="outline" onClick={back} disabled={step === 1 || submitting}>
          <ChevronLeft size={14} /> Back
        </Button>
        <div className="text-xs text-slate-500">
          Step {step} of {visibleSteps.length === STEPS.length ? 8 : visibleSteps.length} ({typeMeta.label})
        </div>
        {step < 8 ? (
          <Button type="button" onClick={next} disabled={submitting}>
            Next <ChevronRight size={14} />
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={submitting} variant="success">
            {submitting ? "Submitting…" : "Submit Permit"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-slate-100 last:border-b-0">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 w-40 flex-shrink-0">{label}</div>
      <div className="text-sm text-slate-800 flex-1 min-w-0 whitespace-pre-wrap">{value}</div>
    </div>
  );
}
