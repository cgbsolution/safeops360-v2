"use client";

// "Add chemical" — the entry point to the whole module (workflow §4.1).
//
// Two things the form makes deliberately visible rather than hiding:
//
//   1. **A new chemical is created PENDING_SDS, never ACTIVE.** The dialog says
//      so before you submit. It is not a nag: the database refuses ACTIVE
//      without a linked Safety Data Sheet, so a form that implied otherwise
//      would set the user up for a rejection they could not have predicted.
//
//   2. **Hazard classification is entered by hand, from the SDS.** The helper
//      text says the sheet is stored as evidence and is not read by the
//      platform. Automated extraction of flash point / NFPA ratings is a
//      separate licensed capability; pretending otherwise here would be the
//      start of someone trusting fields nothing populated.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { hazardTone, prettyLabel } from "@/lib/chemicals/types";
import { apiSend, Field, FormError } from "./_client";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export function NewChemicalDialog({ hazardClasses }: { hazardClasses: string[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [commonName, setCommonName] = React.useState("");
  const [cas, setCas] = React.useState("");
  const [un, setUn] = React.useState("");
  const [state, setState] = React.useState("LIQUID");
  const [classes, setClasses] = React.useState<string[]>([]);
  const [flash, setFlash] = React.useState("");
  const [boiling, setBoiling] = React.useState("");
  const [nH, setNH] = React.useState("");
  const [nF, setNF] = React.useState("");
  const [nR, setNR] = React.useState("");
  const [regRef, setRegRef] = React.useState("");

  function reset() {
    setName(""); setCommonName(""); setCas(""); setUn(""); setState("LIQUID");
    setClasses([]); setFlash(""); setBoiling(""); setNH(""); setNF(""); setNR("");
    setRegRef(""); setError(null);
  }

  function toggle(c: string) {
    setClasses((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("A chemical name is required.");
      return;
    }
    if (classes.length === 0) {
      // Blocked here as well as explained: an unclassified chemical is
      // invisible to the threshold and co-storage engines, so it would sit in
      // the register looking managed while being covered by nothing.
      setError(
        "Select at least one hazard class. Threshold and co-storage rules match on " +
          "classification — an unclassified chemical is invisible to both."
      );
      return;
    }
    setBusy(true);
    try {
      const created = await apiSend("/api/chemicals/masters", {
        name: name.trim(),
        commonName: commonName.trim() || null,
        casNumber: cas.trim() || null,
        unNumber: un.trim() || null,
        hazardClasses: classes,
        physicalState: state,
        flashPointCelsius: num(flash),
        boilingPointCelsius: num(boiling),
        nfpaHealth: num(nH),
        nfpaFlammability: num(nF),
        nfpaReactivity: num(nR),
        regulatoryReference: regRef.trim() || null,
      });
      toast({
        variant: "success",
        title: `${created.name} added`,
        description: "Status is PENDING_SDS. Attach the Safety Data Sheet, then activate.",
      });
      setOpen(false);
      reset();
      router.refresh();
      router.push(`/chemicals/${created.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Could not create the chemical.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={15} className="mr-1.5" />
        Add chemical
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add a chemical</DialogTitle>
            <DialogDescription>
              Enter the classification from the Safety Data Sheet you are holding. The sheet
              itself is attached in the next step and stored as evidence — the platform does not
              read values out of it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <FormError message={error} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Chemical name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Toluene" />
              </Field>
              <Field label="Common / trade name">
                <Input value={commonName} onChange={(e) => setCommonName(e.target.value)} placeholder="e.g. Methylbenzene" />
              </Field>
              <Field label="CAS number">
                <Input value={cas} onChange={(e) => setCas(e.target.value)} placeholder="108-88-3" />
              </Field>
              <Field label="UN number">
                <Input value={un} onChange={(e) => setUn(e.target.value)} placeholder="1294" />
              </Field>
            </div>

            <Field
              label="Hazard classification"
              required
              hint="Multi-select. Threshold rules and the co-storage matrix both key off these."
            >
              <Card className="grid grid-cols-2 gap-1.5 rounded-lg p-3 shadow-none sm:grid-cols-3">
                {hazardClasses.map((c) => (
                  <Label key={c} className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                    <Checkbox checked={classes.includes(c)} onChange={() => toggle(c)} />
                    {prettyLabel(c)}
                  </Label>
                ))}
              </Card>
              {classes.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {classes.map((c) => (
                    <Badge key={c} className={hazardTone(c)}>{prettyLabel(c)}</Badge>
                  ))}
                </div>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Physical state">
                <SelectField value={state} onChange={setState}
                  options={[
                  { value: "SOLID", label: "Solid" },
                  { value: "LIQUID", label: "Liquid" },
                  { value: "GAS", label: "Gas" }
                ]}
                />
              </Field>
              <Field label="Flash point (°C)">
                <Input type="number" value={flash} onChange={(e) => setFlash(e.target.value)} placeholder="4" />
              </Field>
              <Field label="Boiling point (°C)">
                <Input type="number" value={boiling} onChange={(e) => setBoiling(e.target.value)} placeholder="111" />
              </Field>
            </div>

            <Field label="NFPA 704 ratings" hint="0–4 each, read from the diamond on the sheet.">
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" min={0} max={4} value={nH} onChange={(e) => setNH(e.target.value)} placeholder="Health" />
                <Input type="number" min={0} max={4} value={nF} onChange={(e) => setNF(e.target.value)} placeholder="Flammability" />
                <Input type="number" min={0} max={4} value={nR} onChange={(e) => setNR(e.target.value)} placeholder="Reactivity" />
              </div>
            </Field>

            <Field
              label="Regulatory reference"
              hint="Propagated to HIRA hazard rows generated from this chemical."
            >
              <Input value={regRef} onChange={(e) => setRegRef(e.target.value)} placeholder="MSIHC Schedule 1 Part II" />
            </Field>

            <Alert variant="warning" className="p-3 text-[11px]">
              This chemical will be created as <strong>PENDING_SDS</strong>. It cannot be
              activated — or received into stock — until a Safety Data Sheet is attached and an
              HSE Manager approves it. That rule is enforced by a database constraint, not by
              this form.
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Adding…" : "Add chemical"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
