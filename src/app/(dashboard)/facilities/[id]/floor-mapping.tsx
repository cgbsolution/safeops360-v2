"use client";

// Floor register + per-floor activity mapping for one building.
//
// The Buildings tab used to stop at a floor *count*, so a factory's layout was
// unrepresentable: "Block A has 4 floors" says nothing about Sewing on 1,
// Packing on 2, the Canteen on 3, or the DG yard carrying both a 1250 kVA set
// and the STP. This is the editor for that — many activities per floor, many
// floors per building, each activity optionally bound to the ProductionProcess
// register so the process flow and the physical layout stay one dataset.
//
// Units: every measure is captured in a fixed unit declared in its label (see
// UNITS in ../lib). There is deliberately no unit picker — a per-row unit makes
// two factories' numbers incomparable and quietly corrupts every roll-up.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { Can, usePermission } from "@/components/auth/can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_CHIP,
  ACTIVITY_TYPE_LABEL,
  UNITS,
  fmtNum,
  floorLabelForLevel,
  withUnit,
  type Building,
  type BuildingFloor,
  type FloorActivity,
  type ProductionProcess,
} from "../lib";

async function mutate(url: string, init?: RequestInit): Promise<void> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.detail ?? j?.error ?? msg;
    } catch {
      /* non-JSON body */
    }
    throw new Error(msg);
  }
}

const num = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

type ActivityForm = {
  activityType: string;
  activityName: string;
  processId: string;
  areaSqm: string;
  headcount: string;
  productionCapacityPcsPerDay: string;
  fabricConsumptionMPerDay: string;
  powerRatingKva: string;
  waterCapacityKld: string;
  wasteGeneratedKgPerDay: string;
  description: string;
};

const EMPTY_ACTIVITY: ActivityForm = {
  activityType: "PROCESS",
  activityName: "",
  processId: "",
  areaSqm: "",
  headcount: "",
  productionCapacityPcsPerDay: "",
  fabricConsumptionMPerDay: "",
  powerRatingKva: "",
  waterCapacityKld: "",
  wasteGeneratedKgPerDay: "",
  description: "",
};

const activityToForm = (a: FloorActivity): ActivityForm => ({
  activityType: a.activityType,
  activityName: a.activityName,
  processId: a.processId ?? "",
  areaSqm: str(a.areaSqm),
  headcount: str(a.headcount),
  productionCapacityPcsPerDay: str(a.productionCapacityPcsPerDay),
  fabricConsumptionMPerDay: str(a.fabricConsumptionMPerDay),
  powerRatingKva: str(a.powerRatingKva),
  waterCapacityKld: str(a.waterCapacityKld),
  wasteGeneratedKgPerDay: str(a.wasteGeneratedKgPerDay),
  description: a.description ?? "",
});

const activityPayload = (f: ActivityForm) => ({
  activityType: f.activityType,
  activityName: f.activityName.trim(),
  processId: f.processId || null,
  description: f.description.trim() || null,
  areaSqm: num(f.areaSqm),
  headcount: num(f.headcount),
  productionCapacityPcsPerDay: num(f.productionCapacityPcsPerDay),
  fabricConsumptionMPerDay: num(f.fabricConsumptionMPerDay),
  powerRatingKva: num(f.powerRatingKva),
  waterCapacityKld: num(f.waterCapacityKld),
  wasteGeneratedKgPerDay: num(f.wasteGeneratedKgPerDay),
});

/** The measures worth showing inline, in a fixed order, unit always attached. */
function activityMeasures(a: FloorActivity): string[] {
  const out: string[] = [];
  if (a.areaSqm != null) out.push(`${fmtNum(a.areaSqm)} ${UNITS.area}`);
  if (a.headcount != null) out.push(`${fmtNum(a.headcount)} ${UNITS.people}`);
  if (a.productionCapacityPcsPerDay != null)
    out.push(`${fmtNum(a.productionCapacityPcsPerDay)} ${UNITS.production}`);
  if (a.fabricConsumptionMPerDay != null) out.push(`${fmtNum(a.fabricConsumptionMPerDay)} ${UNITS.fabric}`);
  if (a.powerRatingKva != null) out.push(`${fmtNum(a.powerRatingKva)} ${UNITS.power}`);
  if (a.waterCapacityKld != null) out.push(`${fmtNum(a.waterCapacityKld)} ${UNITS.water}`);
  if (a.wasteGeneratedKgPerDay != null) out.push(`${fmtNum(a.wasteGeneratedKgPerDay)} ${UNITS.waste}`);
  return out;
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}

export function FloorMapping({
  building,
  processes,
  onError,
}: {
  building: Building;
  /** The factory's process register — lets an activity name a real process. */
  processes: ProductionProcess[];
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const canEdit = usePermission("FACILITY.UPDATE");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [addingFloor, setAddingFloor] = useState(false);
  const [newFloor, setNewFloor] = useState({ floorLevel: "", floorLabel: "", areaSqm: "", occupancyPersons: "" });
  const [editFloorId, setEditFloorId] = useState<string | null>(null);
  const [floorEdit, setFloorEdit] = useState({ floorLabel: "", floorLevel: "", areaSqm: "", headroomM: "", occupancyPersons: "" });

  const [activityFor, setActivityFor] = useState<string | null>(null); // floorId
  const [editActivityId, setEditActivityId] = useState<string | null>(null);
  const [af, setAf] = useState<ActivityForm>(EMPTY_ACTIVITY);

  const floors = building.floorRegister ?? [];
  const activityCount = floors.reduce((n, f) => n + f.activities.length, 0);

  async function run(fn: () => Promise<void>, success?: string) {
    setBusy(true);
    onError(null);
    try {
      await fn();
      if (success) toast({ variant: "success", title: success });
      router.refresh();
    } catch (e: any) {
      onError(e?.message ?? "Request failed");
      toast({ variant: "error", title: "Could not save", description: e?.message });
    } finally {
      setBusy(false);
    }
  }

  // Default the next floor to the level above the highest registered one.
  function startAddFloor() {
    const nextLevel = floors.length ? Math.max(...floors.map((f) => f.floorLevel)) + 1 : 0;
    setNewFloor({
      floorLevel: String(nextLevel),
      floorLabel: floorLabelForLevel(nextLevel),
      areaSqm: "",
      occupancyPersons: "",
    });
    setAddingFloor(true);
  }

  const addFloor = () =>
    run(async () => {
      const level = Number(newFloor.floorLevel);
      await mutate(`/api/factory/buildings/${building.id}/floors`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          floorLabel: newFloor.floorLabel.trim() || floorLabelForLevel(level),
          floorLevel: Number.isNaN(level) ? 0 : level,
          areaSqm: num(newFloor.areaSqm),
          occupancyPersons: num(newFloor.occupancyPersons),
        }),
      });
      setAddingFloor(false);
    }, "Floor added");

  function startEditFloor(f: BuildingFloor) {
    setEditFloorId(f.id);
    setFloorEdit({
      floorLabel: f.floorLabel,
      floorLevel: String(f.floorLevel),
      areaSqm: str(f.areaSqm),
      headroomM: str(f.headroomM),
      occupancyPersons: str(f.occupancyPersons),
    });
  }

  const saveFloor = () =>
    run(async () => {
      await mutate(`/api/factory/floors/${editFloorId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          floorLabel: floorEdit.floorLabel.trim(),
          floorLevel: Number(floorEdit.floorLevel) || 0,
          areaSqm: num(floorEdit.areaSqm),
          headroomM: num(floorEdit.headroomM),
          occupancyPersons: num(floorEdit.occupancyPersons),
        }),
      });
      setEditFloorId(null);
    }, "Floor updated");

  const removeFloor = (f: BuildingFloor) => {
    const n = f.activities.length;
    if (
      !confirm(
        `Remove “${f.floorLabel}” from ${building.buildingName}?` +
          (n ? `\n\n${n} mapped ${n === 1 ? "activity" : "activities"} will be removed with it.` : "")
      )
    )
      return;
    return run(async () => {
      await mutate(`/api/factory/floors/${f.id}`, { method: "DELETE" });
    }, "Floor removed");
  };

  function startAddActivity(floorId: string) {
    setActivityFor(floorId);
    setEditActivityId(null);
    setAf(EMPTY_ACTIVITY);
  }

  function startEditActivity(a: FloorActivity) {
    setActivityFor(a.floorId);
    setEditActivityId(a.id);
    setAf(activityToForm(a));
  }

  const saveActivity = () =>
    run(async () => {
      const body = JSON.stringify(activityPayload(af));
      if (editActivityId) {
        await mutate(`/api/factory/floor-activities/${editActivityId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body,
        });
      } else {
        await mutate(`/api/factory/floors/${activityFor}/activities`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
      }
      setActivityFor(null);
      setEditActivityId(null);
      setAf(EMPTY_ACTIVITY);
    }, editActivityId ? "Activity updated" : "Activity mapped");

  const removeActivity = (a: FloorActivity) => {
    if (!confirm(`Remove “${a.activityName}” from this floor?`)) return;
    return run(async () => {
      await mutate(`/api/factory/floor-activities/${a.id}`, { method: "DELETE" });
    }, "Activity removed");
  };

  // Which measures make sense to ask for depends on the activity, but the UNIT
  // for each never does — so the fields shown vary, their units never do.
  const measureFields: { key: keyof ActivityForm; label: string; unit: keyof typeof UNITS; forTypes?: string[] }[] = [
    { key: "areaSqm", label: "Area", unit: "area" },
    { key: "headcount", label: "Headcount", unit: "people" },
    { key: "productionCapacityPcsPerDay", label: "Production capacity", unit: "production", forTypes: ["PROCESS"] },
    { key: "fabricConsumptionMPerDay", label: "Fabric consumption", unit: "fabric", forTypes: ["PROCESS"] },
    { key: "powerRatingKva", label: "Power rating", unit: "power", forTypes: ["POWER", "UTILITY"] },
    { key: "waterCapacityKld", label: "Water capacity", unit: "water", forTypes: ["UTILITY", "EFFLUENT", "WELFARE"] },
    { key: "wasteGeneratedKgPerDay", label: "Waste generated", unit: "waste", forTypes: ["PROCESS", "EFFLUENT", "WELFARE"] },
  ];
  const visibleMeasures = measureFields.filter((m) => !m.forTypes || m.forTypes.includes(af.activityType));

  return (
    <div className="border-t border-slate-100 bg-slate-50/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Layers size={13} className="text-slate-400" />
        <span className="font-medium">Floors &amp; process mapping</span>
        <span className="text-slate-400">
          {floors.length} {floors.length === 1 ? "floor" : "floors"} · {activityCount}{" "}
          {activityCount === 1 ? "activity" : "activities"}
        </span>
      </button>

      {open && (
        <div className="space-y-2 px-3 pb-3">
          {floors.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-xs text-slate-400">
              No floors registered for this building yet. Add one to map the processes and activities it carries.
            </p>
          )}

          {floors.map((f) => (
            <div key={f.id} className="rounded-lg border border-slate-200 bg-white">
              {editFloorId === f.id ? (
                <div className="flex flex-wrap items-end gap-2 p-2">
                  <Labelled label="Floor name">
                    <Input
                      className="w-44"
                      value={floorEdit.floorLabel}
                      onChange={(e) => setFloorEdit({ ...floorEdit, floorLabel: e.target.value })}
                    />
                  </Labelled>
                  <Labelled label="Level">
                    <Input
                      type="number"
                      className="w-20"
                      value={floorEdit.floorLevel}
                      onChange={(e) => setFloorEdit({ ...floorEdit, floorLevel: e.target.value })}
                    />
                  </Labelled>
                  <Labelled label={withUnit("Area", "area")}>
                    <Input
                      type="number"
                      className="w-28"
                      value={floorEdit.areaSqm}
                      onChange={(e) => setFloorEdit({ ...floorEdit, areaSqm: e.target.value })}
                    />
                  </Labelled>
                  <Labelled label={withUnit("Height", "height")}>
                    <Input
                      type="number"
                      className="w-24"
                      value={floorEdit.headroomM}
                      onChange={(e) => setFloorEdit({ ...floorEdit, headroomM: e.target.value })}
                    />
                  </Labelled>
                  <Labelled label={withUnit("Occupancy", "people")}>
                    <Input
                      type="number"
                      className="w-28"
                      value={floorEdit.occupancyPersons}
                      onChange={(e) => setFloorEdit({ ...floorEdit, occupancyPersons: e.target.value })}
                    />
                  </Labelled>
                  <Button type="button" size="sm" onClick={saveFloor} disabled={busy || !floorEdit.floorLabel.trim()}>
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditFloorId(null)} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">{f.floorLabel}</span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">level {f.floorLevel}</span>
                  {f.areaSqm != null && (
                    <span className="text-xs text-slate-500">
                      {fmtNum(f.areaSqm)} {UNITS.area}
                    </span>
                  )}
                  {f.occupancyPersons != null && (
                    <span className="text-xs text-slate-500">
                      {fmtNum(f.occupancyPersons)} {UNITS.people}
                    </span>
                  )}
                  {canEdit && (
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startAddActivity(f.id)}
                        disabled={busy}
                        className="h-auto gap-1 px-2 py-1 text-[11px] font-medium text-primary-700 hover:underline"
                      >
                        <Plus size={12} /> Map activity
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditFloor(f)}
                        disabled={busy}
                        title="Edit floor"
                        className="h-auto w-auto text-slate-400 hover:text-primary-700"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFloor(f)}
                        disabled={busy}
                        title="Remove floor"
                        className="h-auto w-auto text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <ul className="divide-y divide-slate-100">
                {f.activities.length === 0 && activityFor !== f.id && (
                  <li className="px-3 py-2 text-xs text-slate-400">No activities mapped to this floor yet.</li>
                )}
                {f.activities.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px] font-medium",
                        ACTIVITY_TYPE_CHIP[a.activityType] ?? ACTIVITY_TYPE_CHIP.OTHER
                      )}
                    >
                      {ACTIVITY_TYPE_LABEL[a.activityType] ?? a.activityType}
                    </span>
                    <span className="text-sm text-slate-700">{a.activityName}</span>
                    {activityMeasures(a).map((m) => (
                      <span key={m} className="text-xs tabular-nums text-slate-500">
                        {m}
                      </span>
                    ))}
                    {canEdit && (
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditActivity(a)}
                          disabled={busy}
                          title="Edit activity"
                          className="h-auto w-auto text-slate-400 hover:text-primary-700"
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeActivity(a)}
                          disabled={busy}
                          title="Remove activity"
                          className="h-auto w-auto text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {activityFor === f.id && (
                <div className="space-y-2 border-t border-slate-100 bg-primary-50/30 p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <Labelled label="Type">
                      <Select
                        className="w-44"
                        value={af.activityType}
                        onChange={(e) => setAf({ ...af, activityType: e.target.value })}
                      >
                        {ACTIVITY_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {ACTIVITY_TYPE_LABEL[t]}
                          </option>
                        ))}
                      </Select>
                    </Labelled>
                    <Labelled label="Activity">
                      <Input
                        className="w-52"
                        placeholder="Sewing / Packing / Canteen / DG Set"
                        value={af.activityName}
                        onChange={(e) => setAf({ ...af, activityName: e.target.value })}
                      />
                    </Labelled>
                    {af.activityType === "PROCESS" && processes.length > 0 && (
                      <Labelled label="Linked process">
                        <Select
                          className="w-48"
                          value={af.processId}
                          onChange={(e) => {
                            const p = processes.find((x) => x.id === e.target.value);
                            setAf({
                              ...af,
                              processId: e.target.value,
                              // Naming the process is the common case — prefill it,
                              // but never overwrite something already typed.
                              activityName: af.activityName.trim() || p?.processName || "",
                            });
                          }}
                        >
                          <option value="">Not linked</option>
                          {processes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.processName}
                            </option>
                          ))}
                        </Select>
                      </Labelled>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    {visibleMeasures.map((m) => (
                      <Labelled key={m.key} label={withUnit(m.label, m.unit)}>
                        <Input
                          type="number"
                          className="w-32"
                          value={af[m.key]}
                          onChange={(e) => setAf({ ...af, [m.key]: e.target.value })}
                        />
                      </Labelled>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" onClick={saveActivity} disabled={busy || !af.activityName.trim()}>
                      {editActivityId ? "Save activity" : "Map activity"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActivityFor(null);
                        setEditActivityId(null);
                      }}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                    <span className="text-[11px] text-slate-400">
                      Units are fixed platform-wide — enter the number only.
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}

          <Can permission="FACILITY.UPDATE">
            {addingFloor ? (
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-2">
                <Labelled label="Level">
                  <Input
                    type="number"
                    className="w-20"
                    value={newFloor.floorLevel}
                    onChange={(e) => {
                      const level = Number(e.target.value);
                      setNewFloor({
                        ...newFloor,
                        floorLevel: e.target.value,
                        floorLabel: Number.isNaN(level) ? newFloor.floorLabel : floorLabelForLevel(level),
                      });
                    }}
                  />
                </Labelled>
                <Labelled label="Floor name">
                  <Input
                    className="w-48"
                    placeholder="Ground Floor / DG Area"
                    value={newFloor.floorLabel}
                    onChange={(e) => setNewFloor({ ...newFloor, floorLabel: e.target.value })}
                  />
                </Labelled>
                <Labelled label={withUnit("Area", "area")}>
                  <Input
                    type="number"
                    className="w-28"
                    value={newFloor.areaSqm}
                    onChange={(e) => setNewFloor({ ...newFloor, areaSqm: e.target.value })}
                  />
                </Labelled>
                <Labelled label={withUnit("Occupancy", "people")}>
                  <Input
                    type="number"
                    className="w-28"
                    value={newFloor.occupancyPersons}
                    onChange={(e) => setNewFloor({ ...newFloor, occupancyPersons: e.target.value })}
                  />
                </Labelled>
                <Button type="button" size="sm" onClick={addFloor} disabled={busy}>
                  Add floor
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setAddingFloor(false)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={startAddFloor} disabled={busy}>
                <Plus size={14} /> Add floor
              </Button>
            )}
          </Can>
        </div>
      )}
    </div>
  );
}
