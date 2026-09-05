"use client";

// "Add Equipment" dialog for the Fire Equipment Register.
//
// The register shipped read-only: the backend has had POST /api/fire/equipment
// since P1-4, but no screen ever called it, so the only way to get an asset into
// the register was seed_fire_safety.py. This is that missing call.
//
// Posts through the /api/* catch-all proxy rather than at the Python backend
// directly, so the browser never sees BACKEND_URL and the caller's session is
// what authorises the write (INCIDENT.UPDATE on the target plant).

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Can } from "@/components/auth/can";
import { SelectField } from "@/components/ui/select-field";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

// Adding an asset to the fire register is FIRE.CREATE — not the INCIDENT.UPDATE
// this borrowed before the dedicated grants existed. Same code the backend route
// enforces.
const WRITE_PERMISSION = "FIRE.CREATE";

type Plant = { id: string; code: string; name: string };
type Zone = { id: string; zoneCode: string; name: string; plantId: string };

// Mirrors the assetType enum in the build spec. Kept here rather than fetched
// because it is a closed vocabulary the backend also validates — a dropdown that
// round-trips to the server to learn its own options is a slower dropdown, not a
// more correct one.
const ASSET_TYPES = [
  "FIRE_EXTINGUISHER",
  "HYDRANT",
  "HOSE_REEL",
  "SPRINKLER_HEAD",
  "FIRE_PUMP",
  "FIRE_WATER_TANK",
  "PANEL",
  "DETECTOR",
  "HEAT_DETECTOR",
  "PA_SYSTEM",
  "SMOKE_CURTAIN",
  "EMERGENCY_LIGHT",
  "OTHER",
];

// Only the types where subtype changes the inspection rule are suggested. A free
// text field, because subtype vocabularies differ per client and per region —
// the same reason the column is free text rather than an enum.
const SUBTYPE_HINTS: Record<string, string> = {
  FIRE_EXTINGUISHER: "CO2 / DCP / FOAM / WATER",
  DETECTOR: "SMOKE / HEAT / BEAM / MULTI",
  PANEL: "ADDRESSABLE / CONVENTIONAL",
};

const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-slate-500";
const FIELD =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 " +
  "focus:border-slate-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400";

/** `allowed` when the backend has told us; otherwise the static permission check. */
function Gate({ allowed, children }: { allowed?: boolean; children: React.ReactNode }) {
  if (allowed === undefined) return <Can permission={WRITE_PERMISSION}>{children}</Can>;
  return allowed ? <>{children}</> : null;
}

export function NewEquipmentDialog({
  plants,
  // Resolved server-side from /api/fire/checklists/capabilities, which accounts
  // for the un-seeded-RBAC fallback. `Can` alone would hide the button on a
  // deployment where the backend would in fact allow the write, so an explicit
  // answer from the backend wins over the static code check when we have one.
  allowed,
}: {
  plants: Plant[];
  allowed?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [zones, setZones] = React.useState<Zone[]>([]);

  const [plantId, setPlantId] = React.useState(plants[0]?.id ?? "");
  const [type, setType] = React.useState("FIRE_EXTINGUISHER");
  const [assetSubtype, setAssetSubtype] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [zoneId, setZoneId] = React.useState("");
  const [make, setMake] = React.useState("");
  const [model, setModel] = React.useState("");
  const [serialNo, setSerialNo] = React.useState("");
  const [capacitySpec, setCapacitySpec] = React.useState("");
  const [installationDate, setInstallationDate] = React.useState("");
  const [maintenanceContractor, setMaintenanceContractor] = React.useState("");

  // Zones are plant-scoped, so the picker reloads whenever the plant changes —
  // otherwise you could file an asset into another site's zone.
  React.useEffect(() => {
    if (!open || !plantId) return;
    let cancelled = false;
    fetch("/api/fire/zones")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        // Tolerates the {items} envelope and a bare array alike.
        const list: Zone[] = Array.isArray(d) ? d : d?.items ?? [];
        if (!cancelled) setZones(list.filter((z) => z.plantId === plantId));
      })
      .catch(() => {
        // A zone list that fails to load must not block asset creation — zoneId
        // is nullable and an unzoned asset is still a tracked asset.
        if (!cancelled) setZones([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, plantId]);

  React.useEffect(() => setZoneId(""), [plantId]);

  function reset() {
    setType("FIRE_EXTINGUISHER");
    setAssetSubtype("");
    setLocation("");
    setZoneId("");
    setMake("");
    setModel("");
    setSerialNo("");
    setCapacitySpec("");
    setInstallationDate("");
    setMaintenanceContractor("");
    setError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!plantId) return setError("Select a plant.");
    if (location.trim().length < 2) return setError("Location is required — it is how an inspector finds the asset.");

    startTransition(async () => {
      const res = await fetch("/api/fire/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantId,
          type,
          location: location.trim(),
          // Empty strings are sent as null so the backend stores an absent value
          // rather than a blank one — "" and NULL read differently on the detail
          // screen and in the frequency resolver's subtype match.
          assetSubtype: assetSubtype.trim() || null,
          zoneId: zoneId || null,
          make: make.trim() || null,
          model: model.trim() || null,
          serialNo: serialNo.trim() || null,
          capacitySpec: capacitySpec.trim() || null,
          maintenanceContractor: maintenanceContractor.trim() || null,
          installationDate: installationDate ? new Date(installationDate).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.detail ?? d.error ?? `Create failed (${res.status})`);
        return;
      }
      const created = await res.json();
      setOpen(false);
      reset();
      router.refresh();
      if (created?.id) router.push(`/fire-safety/equipment/${created.id}`);
    });
  }

  if (!plants.length) {
    return (
      <span className="text-xs text-slate-400" title="No plant is in your access scope">
        Add Equipment unavailable
      </span>
    );
  }

  return (
    // Gated on the same code the backend enforces, so a read-only viewer is not
    // offered a button that 403s once the form is filled in.
    <Gate allowed={allowed}>
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-lg text-xs">
          + Add Equipment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add fire equipment</DialogTitle>
          <DialogDescription>
            The asset code and QR tag are generated on save. Its inspection cadence resolves from the
            Inspection Frequency Master for its type — not entered here — so the due date always
            traces to a rule you can show a regulator.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive" size="lg" className="rounded-lg border-rose-300 text-rose-900">
              {error}
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label variant="eyebrow">Plant *</Label>
              <SelectField
                value={plantId}
                onChange={setPlantId}
                ariaLabel="Plant"
                options={plants.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
              />
            </div>
            <div>
              <Label variant="eyebrow">Zone</Label>
              <SelectField
                value={zoneId}
                onChange={setZoneId}
                ariaLabel="Zone"
                placeholder="— Unzoned —"
                options={zones.map((z) => ({ value: z.id, label: `${z.zoneCode} — ${z.name}` }))}
              />
              {!zones.length && (
                <p className="mt-1 text-[11px] text-slate-400">
                  No zones defined for this plant yet. Unzoned assets are excluded from the hot-work
                  permit guard.
                </p>
              )}
            </div>

            <div>
              <Label variant="eyebrow">Type *</Label>
              <SelectField
                value={type}
                onChange={setType}
                ariaLabel="Asset type"
                options={ASSET_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))}
              />
            </div>
            <div>
              <Label variant="eyebrow">Subtype</Label>
              <Input inputSize="compact"
                value={assetSubtype}
                onChange={(e) => setAssetSubtype(e.target.value)}
                placeholder={SUBTYPE_HINTS[type] ?? "optional"}
              />
            </div>

            <div className="sm:col-span-2">
              <Label variant="eyebrow">Location *</Label>
              <Input inputSize="compact"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Block-A — Stitching Floor, Col 4"
              />
            </div>

            <div>
              <Label variant="eyebrow">Make</Label>
              <Input inputSize="compact" value={make} onChange={(e) => setMake(e.target.value)} />
            </div>
            <div>
              <Label variant="eyebrow">Model</Label>
              <Input inputSize="compact" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div>
              <Label variant="eyebrow">Serial no.</Label>
              <Input inputSize="compact" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} />
            </div>
            <div>
              <Label variant="eyebrow">Capacity / spec</Label>
              <Input inputSize="compact"
                value={capacitySpec}
                onChange={(e) => setCapacitySpec(e.target.value)}
                placeholder="6 kg ABC dry powder"
              />
            </div>
            <div>
              <Label variant="eyebrow">Installed on</Label>
              <input
                type="date"
                className={FIELD}
                value={installationDate}
                onChange={(e) => setInstallationDate(e.target.value)}
              />
            </div>
            <div>
              <Label variant="eyebrow">Maintenance contractor</Label>
              <Input inputSize="compact"
                value={maintenanceContractor}
                onChange={(e) => setMaintenanceContractor(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Create asset"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </Gate>
  );
}
