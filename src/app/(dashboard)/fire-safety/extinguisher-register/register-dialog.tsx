"use client";

// Add / edit one row of the Register of Fire Extinguishers.
//
// The form is the sheet's own sixteen columns. The HP-test and refill dates are
// entered flat here, exactly as the paper prints them, and the backend stores
// them as asset certificates — the operator should not have to know that "HP
// tested on / HP Test due date" is a certificate lifecycle to fill in a register.
//
// Edits PATCH only the fields actually touched. That is not a micro-optimisation:
// sending the whole form on every edit would rewrite the HP-test certificate
// every time someone corrected a spelling in Remarks, and a re-written
// certificate with an unchanged issue date is a lost revision of the cylinder's
// test history.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MX, RegisterRow, fireFetch } from "../lib";

type Plant = { id: string; code: string; name: string };

// Free text, not an enum — subtype vocabularies differ per client and per
// region, which is why the column behind it is free text too. These are
// suggestions, and the field accepts anything.
const FE_TYPES = ["CO2", "ABC", "DCP", "FOAM", "WATER", "CLEAN_AGENT"];

const LABEL = "block text-[10px] font-semibold uppercase tracking-wider";
const FIELD =
  "mt-1 w-full rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none disabled:bg-slate-50 disabled:text-slate-400";

function iso(d: string | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}
function toIso(v: string): string | null {
  return v ? new Date(`${v}T00:00:00.000Z`).toISOString() : null;
}

export function RegisterDialog({
  open,
  onOpenChange,
  row,
  plants,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: RegisterRow | null;
  plants: Plant[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [f, setF] = React.useState(() => blank());
  function blank() {
    return {
      plantId: plants[0]?.id ?? "",
      serialNo: "",
      allottedSerialNo: "",
      type: "",
      capacity: "",
      yearOfManufacture: "",
      expiryDate: "",
      make: "",
      location: "",
      hpTestedOn: "",
      hpTestDueDate: "",
      dateOfDischarge: "",
      refilledOn: "",
      dueForRefilling: "",
      weightKg: "",
      remarks: "",
    };
  }

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setF(
      row
        ? {
            plantId: row.plantId,
            serialNo: row.serialNo ?? "",
            allottedSerialNo: row.allottedSerialNo ?? "",
            type: row.type ?? "",
            capacity: row.capacity ?? "",
            yearOfManufacture: row.yearOfManufacture ? String(row.yearOfManufacture) : "",
            expiryDate: iso(row.expiryDate),
            make: row.make ?? "",
            location: row.location,
            hpTestedOn: iso(row.hpTestedOn),
            hpTestDueDate: iso(row.hpTestDueDate),
            dateOfDischarge: iso(row.dateOfDischarge),
            refilledOn: iso(row.refilledOn),
            dueForRefilling: iso(row.dueForRefilling),
            weightKg: row.weightKg != null ? String(row.weightKg) : "",
            remarks: row.remarks ?? "",
          }
        : blank(),
    );
  }, [open, row, plants]);

  function set<K extends keyof ReturnType<typeof blank>>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!row && !f.plantId) return setError("Select a plant.");
    if (f.location.trim().length < 2) return setError("Location is required — the register is read by location.");

    const payload: Record<string, unknown> = {
      serialNo: f.serialNo.trim() || null,
      allottedSerialNo: f.allottedSerialNo.trim() || null,
      type: f.type.trim() || null,
      capacity: f.capacity.trim() || null,
      yearOfManufacture: f.yearOfManufacture ? Number(f.yearOfManufacture) : null,
      expiryDate: toIso(f.expiryDate),
      make: f.make.trim() || null,
      location: f.location.trim(),
      hpTestedOn: toIso(f.hpTestedOn),
      hpTestDueDate: toIso(f.hpTestDueDate),
      dateOfDischarge: toIso(f.dateOfDischarge),
      refilledOn: toIso(f.refilledOn),
      dueForRefilling: toIso(f.dueForRefilling),
      weightKg: f.weightKg ? Number(f.weightKg) : null,
      remarks: f.remarks.trim() || null,
    };
    if (!row) payload.plantId = f.plantId;

    setPending(true);
    try {
      await fireFetch(
        row ? `/api/fire/register/extinguishers/${row.id}` : "/api/fire/register/extinguishers",
        { method: row ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      onOpenChange(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Could not save the register row.");
    } finally {
      setPending(false);
    }
  }

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className={LABEL} style={{ color: MX.muted }}>
        {label}
      </label>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle style={{ color: MX.navy }}>
            {row ? `Edit ${row.allottedSerialNo ?? row.equipmentCode}` : "Add to the Register of Fire Extinguishers"}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            PIL/EHSD/CL/028-R1. HP-test and refill dates are stored as asset certificates, so each re-test keeps
            the cylinder&rsquo;s previous certificate rather than overwriting it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {!row && (
              <F label="Plant">
                <select
                  value={f.plantId}
                  onChange={(e) => set("plantId", e.target.value)}
                  className={FIELD}
                  style={{ borderColor: MX.iceLine, color: MX.ink }}
                >
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </F>
            )}
            <F label="Manufacturer Serial No.">
              <input value={f.serialNo} onChange={(e) => set("serialNo", e.target.value)} className={FIELD} style={{ borderColor: MX.iceLine }} />
            </F>
            <F label="Alloted Serial No.">
              <input
                value={f.allottedSerialNo}
                onChange={(e) => set("allottedSerialNo", e.target.value)}
                placeholder="Tag on the cylinder"
                className={FIELD}
                style={{ borderColor: MX.iceLine }}
              />
            </F>
            <F label="Type">
              <input
                list="fe-types"
                value={f.type}
                onChange={(e) => set("type", e.target.value)}
                placeholder="CO2 / ABC / DCP"
                className={FIELD}
                style={{ borderColor: MX.iceLine }}
              />
              <datalist id="fe-types">
                {FE_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </F>
            <F label="Capacity">
              <input value={f.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="2KG / 9L" className={FIELD} style={{ borderColor: MX.iceLine }} />
            </F>
            <F label="Year Manufacture">
              <input type="number" value={f.yearOfManufacture} onChange={(e) => set("yearOfManufacture", e.target.value)} className={FIELD} style={{ borderColor: MX.iceLine }} />
            </F>
            <F label="Expiry Date (cylinder life)">
              <input type="date" value={f.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} className={FIELD} style={{ borderColor: MX.iceLine }} />
            </F>
            <F label="Make">
              <input value={f.make} onChange={(e) => set("make", e.target.value)} className={FIELD} style={{ borderColor: MX.iceLine }} />
            </F>
            <F label="Weight in Kgs">
              <input type="number" step="any" value={f.weightKg} onChange={(e) => set("weightKg", e.target.value)} className={FIELD} style={{ borderColor: MX.iceLine }} />
            </F>
          </div>

          <F label="Location">
            <input
              value={f.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Block-A — Stitching Floor, Col 4"
              className={FIELD}
              style={{ borderColor: MX.iceLine }}
            />
          </F>

          <div
            className="rounded-lg border p-3"
            style={{ borderColor: MX.iceLine, background: MX.ice }}
          >
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: MX.navy }}>
              Hydrostatic test &amp; refill
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <F label="HP tested on">
                <input type="date" value={f.hpTestedOn} onChange={(e) => set("hpTestedOn", e.target.value)} className={FIELD} style={{ borderColor: MX.iceLine, background: "#fff" }} />
              </F>
              <F label="HP Test due date">
                <input type="date" value={f.hpTestDueDate} onChange={(e) => set("hpTestDueDate", e.target.value)} className={FIELD} style={{ borderColor: MX.iceLine, background: "#fff" }} />
              </F>
              <F label="Refilled on">
                <input type="date" value={f.refilledOn} onChange={(e) => set("refilledOn", e.target.value)} className={FIELD} style={{ borderColor: MX.iceLine, background: "#fff" }} />
              </F>
              <F label="Due for refilling">
                <input type="date" value={f.dueForRefilling} onChange={(e) => set("dueForRefilling", e.target.value)} className={FIELD} style={{ borderColor: MX.iceLine, background: "#fff" }} />
              </F>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <F label="Date of Discharge">
              <input type="date" value={f.dateOfDischarge} onChange={(e) => set("dateOfDischarge", e.target.value)} className={FIELD} style={{ borderColor: MX.iceLine }} />
            </F>
            <div className="sm:col-span-2">
              <F label="Remarks">
                <input value={f.remarks} onChange={(e) => set("remarks", e.target.value)} className={FIELD} style={{ borderColor: MX.iceLine }} />
              </F>
            </div>
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 text-[12px] font-medium" style={{ background: MX.redSoft, color: MX.red }}>
              {error}
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border px-3 py-1.5 text-[12.5px] font-medium"
              style={{ borderColor: MX.iceLine, color: MX.navy }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
              style={{ background: MX.navy }}
            >
              {pending && <Loader2 size={13} className="animate-spin" />}
              {row ? "Save changes" : "Add to register"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
