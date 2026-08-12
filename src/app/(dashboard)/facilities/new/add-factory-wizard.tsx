"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  BUILDING_TYPES,
  BUILDING_TYPE_LABEL,
  FACTORY_STATUSES,
  OWNERSHIP_TYPES,
  OWNERSHIP_LABEL,
  titleCase,
  UNITS,
  withUnit,
  type BuildingType,
  type FactoryStatus,
  type OwnershipType,
} from "../lib";

// Ownership types that describe a Page-owned, in-house facility. For these the
// Site is not a separate thing the operator maintains — the factory *is* the
// site — so the Site picker is optional and the backend provisions one.
// A supplier arrangement is the case where mapping onto an existing Site
// carries real meaning, so there the picker stays prominent.
const IN_HOUSE_OWNERSHIP: OwnershipType[] = ["OWNED", "LEASED"];

export type SiteOption = {
  id: string;
  name: string;
  code: string;
  state: string;
  location: string;
  linked: boolean;
};

type BuildingRow = {
  buildingName: string;
  buildingType: BuildingType;
  floors: number;
  areaSqm: string;
  maxOccupancy: string;
  assemblyPoint: string;
};

type RegRow = { type: string; number: string };

const STEPS = ["Identity & Location", "Statutory", "Buildings", "Workforce", "Processes", "Review & Save"];

const labelCls = "block text-xs font-medium text-slate-600 mb-1";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export function AddFactoryWizard({ sites }: { sites: SiteOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── form state ──
  const [siteId, setSiteId] = useState("");
  const [factoryName, setFactoryName] = useState("");
  const [factoryCode, setFactoryCode] = useState("");
  const [status, setStatus] = useState<FactoryStatus>("OPERATIONAL");
  const [ownershipType, setOwnershipType] = useState<OwnershipType>("OWNED");
  const [primaryIndustry, setPrimaryIndustry] = useState("Garments / Textile");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [establishedYear, setEstablishedYear] = useState("");

  const [factoryLicenseNo, setFactoryLicenseNo] = useState("");
  const [factoryLicenseValidUntil, setFactoryLicenseValidUntil] = useState("");
  const [pollutionControlBoard, setPollutionControlBoard] = useState("");
  const [applicableActsText, setApplicableActsText] = useState("Factories Act 1948, Contract Labour (R&A) Act 1970");
  const [totalLandAreaSqm, setTotalLandAreaSqm] = useState("");
  const [builtUpAreaSqm, setBuiltUpAreaSqm] = useState("");
  const [regs, setRegs] = useState<RegRow[]>([{ type: "GST", number: "" }]);

  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [wf, setWf] = useState({
    permanentCount: 0,
    contractCount: 0,
    apprenticeTraineeCount: 0,
    maleCount: 0,
    femaleCount: 0,
    otherGenderCount: 0,
    migrantWorkerCount: 0,
    differentlyAbledCount: 0,
  });
  const [procs, setProcs] = useState<{ processName: string; installedCapacity: string; shiftPattern: string }[]>([]);
  const wfTotal = wf.permanentCount + wf.contractCount + wf.apprenticeTraineeCount;
  const wfGender = wf.maleCount + wf.femaleCount + wf.otherGenderCount;
  const wfProvided = wfTotal > 0 || wfGender > 0;

  const onPickSite = (id: string) => {
    setSiteId(id);
    const s = sites.find((x) => x.id === id);
    if (s) {
      if (!state) setState(s.state);
      if (!city) setCity(s.location);
    }
  };

  const num = (v: string): number | null => {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n; // non-numeric → null (not NaN → JSON null)
  };

  const wfNum = (k: keyof typeof wf, label: string) => (
    <Field label={label}>
      <Input
        type="number"
        min={0}
        value={wf[k]}
        onChange={(e) => setWf({ ...wf, [k]: Math.max(0, Number(e.target.value) || 0) })}
      />
    </Field>
  );

  const inHouse = IN_HOUSE_OWNERSHIP.includes(ownershipType);
  // Site is only a hard requirement where the mapping means something: a
  // supplier factory has to land on the Site it is being managed under. An
  // in-house factory can proceed without one and gets a Site provisioned.
  const canNext0 = factoryName.trim().length >= 2 && (inHouse || siteId !== "");

  async function submit() {
    setSubmitting(true);
    setError(null);
    const payload = {
      // Omitted rather than "" — the API reads absent as "provision one for me".
      siteId: siteId || undefined,
      factoryName,
      factoryCode: factoryCode.trim() || undefined,
      status,
      ownershipType,
      primaryIndustry,
      addressLine,
      city,
      state,
      pincode,
      latitude: num(latitude),
      longitude: num(longitude),
      establishedYear: num(establishedYear),
      factoryLicenseNo: factoryLicenseNo || null,
      factoryLicenseValidUntil: factoryLicenseValidUntil ? new Date(factoryLicenseValidUntil).toISOString() : null,
      pollutionControlBoard: pollutionControlBoard || null,
      applicableActs: applicableActsText.split(",").map((a) => a.trim()).filter(Boolean),
      registrationNos: regs.filter((r) => r.type.trim() && r.number.trim()),
      totalLandAreaSqm: num(totalLandAreaSqm),
      builtUpAreaSqm: num(builtUpAreaSqm),
      buildings: buildings
        .filter((b) => b.buildingName.trim())
        .map((b) => ({
          buildingName: b.buildingName,
          buildingType: b.buildingType,
          floors: b.floors || 1,
          areaSqm: num(b.areaSqm),
          maxOccupancy: num(b.maxOccupancy),
          assemblyPoint: b.assemblyPoint || null,
        })),
      workforce: wfProvided ? { ...wf } : undefined,
      processes: procs
        .filter((p) => p.processName.trim())
        .map((p, i) => ({
          processName: p.processName,
          installedCapacity: p.installedCapacity || null,
          shiftPattern: p.shiftPattern || null,
          sequenceOrder: i + 1,
        })),
    };
    try {
      const res = await fetch("/api/factory/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail ?? j?.error ?? `Failed (${res.status})`);
      }
      const created = await res.json();
      router.push(`/facilities/${created.id}`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create factory profile");
      setSubmitting(false);
    }
  }

  const selectedSite = sites.find((s) => s.id === siteId);

  return (
    <div className="max-w-3xl">
      {/* Stepper */}
      <div className="mb-5 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
                (i === step ? "bg-primary-700 text-white" : i < step ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")
              }
            >
              {i + 1}
            </div>
            <span className={"text-xs " + (i === step ? "font-semibold text-slate-900" : "text-slate-400")}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-slate-200" />}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {/* ── Step 1: Identity & Location ── */}
        {step === 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={inHouse ? "Site (optional)" : "Site (1:1 link — required)"}>
                <Select value={siteId} onChange={(e) => onPickSite(e.target.value)}>
                  <option value="">
                    {inHouse ? "Not linked — create a site for this factory" : "Select a site…"}
                  </option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.linked}>
                      {s.code} — {s.name}
                      {s.linked ? " (already linked)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <p className="mt-1 text-[11px] text-slate-500">
                {inHouse
                  ? "For a Page-owned facility the factory is the site — leave this blank and one is created from the factory’s own name and location. Pick a site only if this factory must roll up under an existing one."
                  : "A supplier factory is managed under a site, so the mapping is required here. One site carries one factory profile."}
              </p>
            </div>
            <Field label="Factory name *">
              <Input value={factoryName} onChange={(e) => setFactoryName(e.target.value)} placeholder="Meridian Apparel — Tirupur 1" />
            </Field>
            <Field label="Factory code (auto if blank)">
              <Input value={factoryCode} onChange={(e) => setFactoryCode(e.target.value)} placeholder="MAG-TN-01" />
            </Field>
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as FactoryStatus)}>
                {FACTORY_STATUSES.map((s) => (
                  <option key={s} value={s}>{titleCase(s)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Ownership">
              <Select value={ownershipType} onChange={(e) => setOwnershipType(e.target.value as OwnershipType)}>
                {OWNERSHIP_TYPES.map((o) => (
                  <option key={o} value={o}>{OWNERSHIP_LABEL[o]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Primary industry">
              <Input value={primaryIndustry} onChange={(e) => setPrimaryIndustry(e.target.value)} />
            </Field>
            <Field label="Established year">
              <Input value={establishedYear} onChange={(e) => setEstablishedYear(e.target.value)} placeholder="2009" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <Input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
              </Field>
            </div>
            <Field label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="State">
              <Input value={state} onChange={(e) => setState(e.target.value)} />
            </Field>
            <Field label="Pincode">
              <Input value={pincode} onChange={(e) => setPincode(e.target.value)} />
            </Field>
            <div />
            <Field label="Latitude (for the India map)">
              <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="11.1085" />
            </Field>
            <Field label="Longitude">
              <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="77.3411" />
            </Field>
          </div>
        )}

        {/* ── Step 2: Statutory ── */}
        {step === 1 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Factory licence no.">
              <Input value={factoryLicenseNo} onChange={(e) => setFactoryLicenseNo(e.target.value)} />
            </Field>
            <Field label="Licence valid until">
              <Input type="date" value={factoryLicenseValidUntil} onChange={(e) => setFactoryLicenseValidUntil(e.target.value)} />
            </Field>
            <Field label="Pollution Control Board">
              <Input value={pollutionControlBoard} onChange={(e) => setPollutionControlBoard(e.target.value)} placeholder="TNPCB" />
            </Field>
            <div />
            <div className="sm:col-span-2">
              <Field label="Applicable acts (comma-separated)">
                <Input value={applicableActsText} onChange={(e) => setApplicableActsText(e.target.value)} />
              </Field>
            </div>
            <Field label={withUnit("Total land area", "area")}>
              <Input value={totalLandAreaSqm} onChange={(e) => setTotalLandAreaSqm(e.target.value)} />
            </Field>
            <Field label={withUnit("Built-up area", "area")}>
              <Input value={builtUpAreaSqm} onChange={(e) => setBuiltUpAreaSqm(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <label className={labelCls}>Registrations (GST / ESI / EPF / PCB consent …)</label>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRegs([...regs, { type: "", number: "" }])}
                  className="h-auto gap-1 p-0 text-xs font-medium text-primary-700 hover:bg-transparent hover:underline"
                >
                  <Plus size={12} /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {regs.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      className="max-w-[140px]"
                      placeholder="Type"
                      value={r.type}
                      onChange={(e) => setRegs(regs.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}
                    />
                    <Input
                      placeholder="Number"
                      value={r.number}
                      onChange={(e) => setRegs(regs.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setRegs(regs.filter((_, j) => j !== i))}
                      className="h-8 w-8 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Buildings ── */}
        {step === 2 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-slate-500">Quick-add buildings now, or add them later from the profile.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setBuildings([
                    ...buildings,
                    { buildingName: "", buildingType: "PRODUCTION", floors: 1, areaSqm: "", maxOccupancy: "", assemblyPoint: "" },
                  ])
                }
                className="gap-1 text-slate-700 hover:border-slate-400"
              >
                <Plus size={14} /> Add building
              </Button>
            </div>
            {buildings.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
                No buildings added. The profile’s building count can also be set/edited later.
              </div>
            ) : (
              <div className="space-y-2">
                {buildings.map((b, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-12">
                    <Input
                      className="sm:col-span-4"
                      placeholder="Building name (Block A — Stitching)"
                      value={b.buildingName}
                      onChange={(e) => setBuildings(buildings.map((x, j) => (j === i ? { ...x, buildingName: e.target.value } : x)))}
                    />
                    <Select
                      className="sm:col-span-3"
                      value={b.buildingType}
                      onChange={(e) => setBuildings(buildings.map((x, j) => (j === i ? { ...x, buildingType: e.target.value as BuildingType } : x)))}
                    >
                      {BUILDING_TYPES.map((t) => (
                        <option key={t} value={t}>{BUILDING_TYPE_LABEL[t]}</option>
                      ))}
                    </Select>
                    <Input
                      className="sm:col-span-1"
                      placeholder="Flr"
                      value={b.floors}
                      onChange={(e) => setBuildings(buildings.map((x, j) => (j === i ? { ...x, floors: Number(e.target.value) || 1 } : x)))}
                    />
                    <Input
                      className="sm:col-span-2"
                      placeholder={`Area ${UNITS.area}`}
                      value={b.areaSqm}
                      onChange={(e) => setBuildings(buildings.map((x, j) => (j === i ? { ...x, areaSqm: e.target.value } : x)))}
                    />
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Input
                        placeholder="Assembly pt"
                        value={b.assemblyPoint}
                        onChange={(e) => setBuildings(buildings.map((x, j) => (j === i ? { ...x, assemblyPoint: e.target.value } : x)))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setBuildings(buildings.filter((_, j) => j !== i))}
                        className="h-8 w-8 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Workforce ── */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Initial composition (optional). A profile with ≥1 workforce record activates from DRAFT → ACTIVE; the SA8000 lens
              uses the permanent/contract split and gender breakdown.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {wfNum("permanentCount", "Permanent")}
              {wfNum("contractCount", "Contract")}
              {wfNum("apprenticeTraineeCount", "Apprentice")}
              <div className="flex items-end pb-2 text-sm text-slate-500">= total {wfTotal}</div>
              {wfNum("maleCount", "Male")}
              {wfNum("femaleCount", "Female")}
              {wfNum("otherGenderCount", "Other")}
              <div className="flex items-end pb-2 text-sm text-slate-500">gender {wfGender}</div>
              {wfNum("migrantWorkerCount", "Migrant workers")}
              {wfNum("differentlyAbledCount", "Differently-abled")}
            </div>
            {wfProvided && wfGender !== wfTotal && (
              <div className="text-[11px] text-amber-600">Gender split won’t reconcile to total — allowed (soft warning).</div>
            )}
          </div>
        )}

        {/* ── Step 5: Processes ── */}
        {step === 4 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-slate-500">Production process flow (optional) — add in sequence.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProcs([...procs, { processName: "", installedCapacity: "", shiftPattern: "" }])}
                className="gap-1 text-slate-700 hover:border-slate-400"
              >
                <Plus size={14} /> Add process
              </Button>
            </div>
            {procs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
                No processes added. Cutting → Stitching → Finishing → Packing, etc. can be added later too.
              </div>
            ) : (
              <div className="space-y-2">
                {procs.map((p, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-12">
                    <div className="flex items-center sm:col-span-1">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700">{i + 1}</span>
                    </div>
                    <Input className="sm:col-span-4" placeholder="Process (Stitching)" value={p.processName} onChange={(e) => setProcs(procs.map((x, j) => (j === i ? { ...x, processName: e.target.value } : x)))} />
                    <Input className="sm:col-span-3" placeholder={`Installed capacity (${UNITS.production})`} value={p.installedCapacity} onChange={(e) => setProcs(procs.map((x, j) => (j === i ? { ...x, installedCapacity: e.target.value } : x)))} />
                    <Input className="sm:col-span-3" placeholder="Shifts (2 shifts)" value={p.shiftPattern} onChange={(e) => setProcs(procs.map((x, j) => (j === i ? { ...x, shiftPattern: e.target.value } : x)))} />
                    <div className="flex items-center sm:col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setProcs(procs.filter((_, j) => j !== i))}
                        className="h-8 w-8 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 6: Review ── */}
        {step === 5 && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Review label="Site">
                {selectedSite
                  ? `${selectedSite.code} — ${selectedSite.name}`
                  : "New site — created from this factory"}
              </Review>
              <Review label="Factory">{factoryName || "—"}</Review>
              <Review label="Code">{factoryCode || "auto"}</Review>
              <Review label="Status">{titleCase(status)}</Review>
              <Review label="Ownership">{OWNERSHIP_LABEL[ownershipType]}</Review>
              <Review label="Location">{[city, state].filter(Boolean).join(", ") || "—"}</Review>
              <Review label="Buildings to add">{String(buildings.filter((b) => b.buildingName.trim()).length)}</Review>
              <Review label="Workforce">{wfProvided ? `${wfTotal} employees` : "not set (→ DRAFT)"}</Review>
              <Review label="Processes to add">{String(procs.filter((p) => p.processName.trim()).length)}</Review>
            </div>
            <p className="text-xs text-slate-500">
              The profile is created as <strong>DRAFT</strong> and auto-promoted to <strong>ACTIVE</strong> once name, site link
              and location are present. Workforce, processes and certifications can be completed afterwards — as can the
              floor-by-floor process mapping under each building.
            </p>
          </div>
        )}

        {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      </div>

      {/* Nav buttons */}
      <div className="mt-4 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || submitting}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="hover:border-slate-400"
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            disabled={step === 0 && !canNext0}
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          >
            Next
          </Button>
        ) : (
          <Button
            type="button"
            disabled={submitting || !canNext0}
            onClick={submit}
          >
            {submitting ? "Creating…" : "Create factory profile"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Review({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-800">{children}</div>
    </div>
  );
}
