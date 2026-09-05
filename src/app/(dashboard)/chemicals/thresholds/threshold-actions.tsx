"use client";

// Admin: add a regulatory threshold rule, and recompute the dashboard.
//
// This dialog IS the "config-driven, never hardcoded" claim made good
// (business rule §2). A GCC regulatory remap is these rows with `region` set to
// AE/SA/QA — no code change, no release. The form says so, because a threshold
// people believe is compiled in is a threshold nobody tries to correct.
//
// Gated on CONFIGURATION.MASTERS, so the button only renders for Admin /
// System Admin / Corporate HSE. The API enforces independently.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { Can } from "@/components/auth/can";
import { prettyLabel } from "@/lib/chemicals/types";
import { apiSend, Field, FormError } from "../_client";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";

const HAZARD_CLASSES = [
  "FLAMMABLE", "CORROSIVE", "TOXIC", "OXIDIZER", "REACTIVE", "CARCINOGEN",
  "EXPLOSIVE", "COMPRESSED_GAS", "PYROPHORIC", "WATER_REACTIVE",
  "ENVIRONMENTAL_HAZARD", "IRRITANT",
];

export function RecomputeButton({ plantId }: { plantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        router.push(`/chemicals/thresholds?plantId=${plantId}&recompute=1`);
        router.refresh();
        setBusy(false);
      }}
    >
      <RefreshCw size={15} className="mr-1.5" />
      Recompute from ledger
    </Button>
  );
}

export function NewThresholdRuleDialog() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [region, setRegion] = React.useState("IN");
  const [hazardClass, setHazardClass] = React.useState("FLAMMABLE");
  const [schedule, setSchedule] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [unit, setUnit] = React.useState("KG");
  const [approach, setApproach] = React.useState("0.8");
  const [obligation, setObligation] = React.useState("ON_SITE_EMERGENCY_PLAN");
  const [autoMoc, setAutoMoc] = React.useState(true);
  const [notes, setNotes] = React.useState("");

  async function submit() {
    setError(null);
    if (!schedule.trim()) { setError("A schedule / licence reference is required — it is what the MOC cites."); return; }
    const n = Number(qty);
    if (!n || n <= 0) { setError("Enter a threshold quantity greater than zero."); return; }
    setBusy(true);
    try {
      await apiSend("/api/chemicals/thresholds/rules", {
        region,
        hazardClass,
        chemicalId: null,
        scheduleReference: schedule.trim(),
        thresholdQuantity: n,
        unit,
        approachRatio: Number(approach),
        triggerObligation: obligation,
        autoMocOnBreach: autoMoc,
        notes: notes.trim() || null,
      });
      toast({
        variant: "success",
        title: "Threshold rule added",
        description: "Evaluated on the next receipt or transfer, and by the 6-hourly sweep.",
      });
      setOpen(false);
      setSchedule(""); setQty(""); setNotes("");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not create the threshold rule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Can permission="CONFIGURATION.MASTERS">
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus size={15} className="mr-1.5" />
        Add threshold rule
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add a regulatory threshold rule</DialogTitle>
            <DialogDescription>
              Thresholds are configuration, not code. Adding rules with a different region is how
              a GCC regulatory remap is applied — without a release.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <FormError message={error} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Region">
                <SelectField value={region} onChange={setRegion}
                  options={[
                  { value: "IN", label: "IN — India (MSIHC / PESO)" },
                  { value: "AE", label: "AE — United Arab Emirates" },
                  { value: "SA", label: "SA — Saudi Arabia" },
                  { value: "QA", label: "QA — Qatar" },
                  { value: "OM", label: "OM — Oman" }
                ]}
                />
              </Field>
              <Field label="Hazard class" required>
                <SelectField value={hazardClass} onChange={setHazardClass}
                  options={HAZARD_CLASSES.map((h) => ({ value: h, label: prettyLabel(h) }))}
                />
              </Field>
              <Field label="Schedule / licence reference" required hint="Quoted in the auto-raised change request.">
                <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="MSIHC Schedule 2 — Flammable" />
              </Field>
              <Field label="Threshold quantity" required>
                <Input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="10000" />
              </Field>
              <Field label="Unit" hint="Stock held in an incompatible unit family is excluded and reported, never converted.">
                <SelectField value={unit} onChange={setUnit}
                  options={[
                  { value: "KG", label: "KG" },
                  { value: "T", label: "T — tonnes" },
                  { value: "L", label: "L — litres" },
                  { value: "KL", label: "KL — kilolitres" }
                ]}
                />
              </Field>
              <Field label="Approaching at" hint="Fraction of the limit that raises the preventive brief card.">
                <SelectField value={approach} onChange={setApproach}
                  options={[
                  { value: "0.7", label: "70% of threshold" },
                  { value: "0.8", label: "80% of threshold (default)" },
                  { value: "0.9", label: "90% of threshold" }
                ]}
                />
              </Field>
            </div>

            <Field label="Obligation engaged on breach" required>
              <SelectField value={obligation} onChange={setObligation}
                options={[
                { value: "ON_SITE_EMERGENCY_PLAN", label: "On-site emergency plan" },
                { value: "OFF_SITE_EMERGENCY_PLAN", label: "Off-site emergency plan" },
                { value: "SAFETY_REPORT", label: "Safety report" },
                { value: "LICENSE_UPGRADE", label: "Licence upgrade" }
              ]}
              />
            </Field>

            <Label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
              <Checkbox checked={autoMoc} onChange={(e) => setAutoMoc(e.target.checked)} className="mt-0.5" />
              <span>
                <strong>Raise a change request automatically on breach.</strong>
                <span className="block text-[11px] text-slate-500">
                  Leave this on unless the obligation is handled outside the platform. When off,
                  a breach is still recorded in the MOC trigger log as SKIPPED with the reason —
                  it never passes silently.
                </span>
              </span>
            </Label>

            <Field label="Notes">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy ? "Adding…" : "Add rule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Can>
  );
}
