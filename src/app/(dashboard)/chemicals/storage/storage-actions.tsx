"use client";

// Create a chemical storage location.
//
// `zoneId` points at a Fire & Life Safety FireZone. That reuse is the reason a
// co-storage rule and a fire zone describe the same physical space — this
// module builds no second location hierarchy, so the zone picker is offered
// (and explained) rather than a free-text room name.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { apiSend, Field, FormError } from "../_client";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Card } from "@/components/ui/card";

export function NewStorageLocationDialog({
  plantId,
  zones,
}: {
  plantId: string;
  zones: { id: string; zoneCode: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("GENERAL");
  const [zoneId, setZoneId] = React.useState("");
  const [capacity, setCapacity] = React.useState("");
  const [capacityUnit, setCapacityUnit] = React.useState("KG");
  const [ventilated, setVentilated] = React.useState(false);
  const [bunded, setBunded] = React.useState(false);
  const [tempControlled, setTempControlled] = React.useState(false);

  async function submit() {
    setError(null);
    if (!code.trim() || !name.trim()) {
      setError("A code and a name are both required — the code is what appears on the shelf label.");
      return;
    }
    setBusy(true);
    try {
      await apiSend("/api/chemicals/storage-locations", {
        plantId,
        zoneId: zoneId || null,
        code: code.trim(),
        name: name.trim(),
        storageType: type,
        maxCapacity: capacity.trim() === "" ? null : Number(capacity),
        capacityUnit: capacity.trim() === "" ? null : capacityUnit,
        ventilated,
        bunded,
        temperatureControlled: tempControlled,
      });
      toast({ variant: "success", title: `${name} created` });
      setOpen(false);
      setCode(""); setName(""); setZoneId(""); setCapacity("");
      setVentilated(false); setBunded(false); setTempControlled(false);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not create the storage location.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={15} className="mr-1.5" />
        Add storage location
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add storage location</DialogTitle>
            <DialogDescription>
              A cabinet, store or bund that chemical stock sits in. Linking it to a fire zone
              keeps one location hierarchy across the platform.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <FormError message={error} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code" required hint="Short, matches the shelf label.">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ST-FL-01" />
              </Field>
              <Field label="Name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Flammable store — Block A" />
              </Field>
              <Field label="Storage type">
                <SelectField value={type} onChange={setType}
                  options={[
                  { value: "FLAMMABLE_CABINET", label: "Flammable cabinet" },
                  { value: "VENTILATED_STORE", label: "Ventilated store" },
                  { value: "COLD_STORE", label: "Cold store" },
                  { value: "GENERAL", label: "General" },
                  { value: "OUTDOOR_BUND", label: "Outdoor bund" }
                ]}
                />
              </Field>
              <Field label="Fire zone" hint="Reuses the Fire & Life Safety zone model.">
                <SelectField value={zoneId} onChange={setZoneId}
                  placeholder="Not linked"
                  options={zones.map((z) => ({ value: z.id, label: "{z.name} ({z.zoneCode})" }))}
                />
              </Field>
              <Field label="Maximum capacity">
                <Input type="number" min="0" step="any" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </Field>
              <Field label="Capacity unit">
                <SelectField value={capacityUnit} onChange={setCapacityUnit}
                  options={[
                  { value: "KG", label: "KG" },
                  { value: "L", label: "L" },
                  { value: "T", label: "T" }
                ]}
                />
              </Field>
            </div>

            <Field label="Containment features">
              <Card className="flex flex-wrap gap-4 rounded-lg p-3 shadow-none">
                <Label className="flex items-center gap-2 text-xs text-slate-700">
                  <Checkbox checked={ventilated} onChange={(e) => setVentilated(e.target.checked)} /> Ventilated
                </Label>
                <Label className="flex items-center gap-2 text-xs text-slate-700">
                  <Checkbox checked={bunded} onChange={(e) => setBunded(e.target.checked)} /> Bunded
                </Label>
                <Label className="flex items-center gap-2 text-xs text-slate-700">
                  <Checkbox checked={tempControlled} onChange={(e) => setTempControlled(e.target.checked)} /> Temperature-controlled
                </Label>
              </Card>
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create location"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
