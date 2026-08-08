"use client";

// Inventory operations (workflows §4.2 / §4.4 / §4.7).
//
// Everything that changes a quantity goes through a ledger transaction. There
// is no "edit quantity" control anywhere in this file, and that is not an
// oversight — the database rejects a direct write to `quantityLedger`, so a
// field offering one would produce an error the user could not act on. A count
// that disagrees with the system is corrected with an ADJUSTMENT carrying a
// reason, which is what keeps the register auditable.
//
// The dialogs surface backend rejections inline instead of as toasts. The
// messages that matter here are paragraphs — "Incompatible co-storage: Toluene
// cannot share a storage location with Nitric Acid — NFPA 400 / MSIHC Sch.1",
// "batch VERIFY-B1 holds 380 KG" — and a toast that vanishes after four seconds
// is the wrong container for a sentence someone has to act on.

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Boxes, MinusCircle, Plus, PlusCircle, Trash2, Warehouse } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { Chemical, InventoryItem, StorageLocation } from "@/lib/chemicals/types";
import { fmtQty } from "@/lib/chemicals/types";
import { apiSend, Field, FormError } from "../_client";

type TriggerSummary = {
  fired: { rule: string; reason: string; mocId: string | null }[];
  failed: { rule: string; failureReason: string | null }[];
  auditPersisted: boolean;
} | null;

/** Surfaces what the threshold engine did on a receipt — the module's whole
 *  reason for existing. Silence here would hide the auto-MOC. */
function useTriggerToast() {
  const { toast } = useToast();
  return React.useCallback(
    (triggers: TriggerSummary, warnings?: string[]) => {
      if (triggers?.failed?.length) {
        toast({
          variant: "error",
          title: `${triggers.failed.length} automatic MOC trigger failed`,
          description:
            `${triggers.failed[0].failureReason ?? "No reason recorded"} — the change request ` +
            `was NOT created and must be raised manually. Logged in the MOC trigger log.`,
        });
      }
      if (triggers?.fired?.length) {
        toast({
          variant: "success",
          title: "Regulatory threshold breached — MOC raised automatically",
          description: triggers.fired[0].reason,
        });
      }
      (warnings ?? []).forEach((w) =>
        toast({ variant: "error", title: "Warning", description: w })
      );
    },
    [toast]
  );
}

// ── New batch ────────────────────────────────────────────────────────────────
export function NewBatchDialog({
  plantId,
  chemicals,
  locations,
}: {
  plantId: string;
  chemicals: Chemical[];
  locations: StorageLocation[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const notifyTriggers = useTriggerToast();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [chemicalId, setChemicalId] = React.useState("");
  const [batch, setBatch] = React.useState("");
  const [unit, setUnit] = React.useState("KG");
  const [qty, setQty] = React.useState("");
  const [locationId, setLocationId] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [supplier, setSupplier] = React.useState("");
  const [lowStock, setLowStock] = React.useState("");
  const [overrideReason, setOverrideReason] = React.useState("");
  const [conflicts, setConflicts] = React.useState<
    { severity: string; message: string }[]
  >([]);

  // Only ACTIVE chemicals can be received — the backend enforces it, so
  // offering the others would be offering a guaranteed rejection.
  const receivable = chemicals.filter((c) => c.status === "ACTIVE");

  // Live co-storage preview (§7 #4 — surfaced visually, not just on save).
  React.useEffect(() => {
    if (!chemicalId || !locationId) { setConflicts([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/chemicals/storage-locations/${locationId}/conflicts?chemicalId=${chemicalId}`
        );
        const j = await r.json();
        if (!cancelled && r.ok) setConflicts(j.conflicts ?? []);
      } catch {
        /* preview is advisory; the save path enforces */
      }
    })();
    return () => { cancelled = true; };
  }, [chemicalId, locationId]);

  const blocking = conflicts.filter((c) => c.severity === "BLOCK");
  const warning = conflicts.filter((c) => c.severity === "WARN");

  async function submit() {
    setError(null);
    if (!chemicalId) { setError("Choose a chemical."); return; }
    if (!batch.trim()) { setError("A batch / lot number is required — it is how stock is traced."); return; }
    setBusy(true);
    try {
      const res = await apiSend("/api/chemicals/inventory", {
        chemicalId,
        plantId,
        batchLotNumber: batch.trim(),
        unit,
        storageLocationId: locationId || null,
        expiryDate: expiry ? new Date(expiry).toISOString() : null,
        supplierName: supplier.trim() || null,
        lowStockThreshold: lowStock.trim() === "" ? null : Number(lowStock),
        openingQuantity: qty.trim() === "" ? null : Number(qty),
        storageOverrideReason: overrideReason.trim() || null,
      });
      toast({
        variant: "success",
        title: `Batch ${batch} received`,
        description: qty ? `${qty} ${unit} posted to the ledger.` : "Batch created with no opening stock.",
      });
      notifyTriggers(res.triggers, res.warnings);
      setOpen(false);
      setChemicalId(""); setBatch(""); setQty(""); setLocationId("");
      setExpiry(""); setSupplier(""); setLowStock(""); setOverrideReason("");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not create the batch.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={15} className="mr-1.5" />
        Receive stock
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive stock</DialogTitle>
            <DialogDescription>
              Creates a batch and posts the opening quantity as a RECEIPT ledger entry. If this
              takes the site over a regulatory threshold, a change request is raised automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <FormError message={error} />

            {receivable.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                No ACTIVE chemicals at this site yet. A chemical must have its Safety Data Sheet
                attached and be approved before stock can be received against it.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Chemical" required>
                <Select value={chemicalId} onChange={(e) => setChemicalId(e.target.value)}>
                  <option value="">Select…</option>
                  {receivable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.casNumber ? ` (${c.casNumber})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Batch / lot number" required>
                <Input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="TOL-2026-014" />
              </Field>
              <Field label="Quantity received">
                <Input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="500" />
              </Field>
              <Field label="Unit" hint="Transactions must use the batch's own unit.">
                <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="KG">KG — kilograms</option>
                  <option value="G">G — grams</option>
                  <option value="T">T — tonnes</option>
                  <option value="L">L — litres</option>
                  <option value="ML">ML — millilitres</option>
                  <option value="KL">KL — kilolitres</option>
                </Select>
              </Field>
              <Field label="Storage location">
                <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                  ))}
                </Select>
              </Field>
              <Field label="Expiry date">
                <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              </Field>
              <Field label="Supplier">
                <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              </Field>
              <Field label="Low-stock threshold" hint="Below this the batch is flagged LOW.">
                <Input type="number" min="0" step="any" value={lowStock} onChange={(e) => setLowStock(e.target.value)} />
              </Field>
            </div>

            {blocking.length > 0 && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 p-3">
                <div className="text-xs font-semibold text-rose-800">
                  Incompatible co-storage — this location cannot be used
                </div>
                <ul className="mt-1 space-y-0.5 text-[11px] text-rose-700">
                  {blocking.map((c, i) => <li key={i}>{c.message}</li>)}
                </ul>
                <div className="mt-1.5 text-[11px] text-rose-600">
                  This is a hard constraint — the save will be rejected by the database, not just
                  by this form. Choose a different location.
                </div>
              </div>
            )}

            {warning.length > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <div className="text-xs font-semibold text-amber-800">Co-storage warning</div>
                <ul className="space-y-0.5 text-[11px] text-amber-700">
                  {warning.map((c, i) => <li key={i}>{c.message}</li>)}
                </ul>
                <Field label="Override reason" required hint="Recorded for review — an accepted risk needs an owner.">
                  <Textarea rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. Segregated bund, 3 m separation verified by CSO" />
                </Field>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || blocking.length > 0}>
              {busy ? "Receiving…" : "Receive stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Per-row actions ──────────────────────────────────────────────────────────
export function RowActions({
  item,
  locations,
  plants,
}: {
  item: InventoryItem;
  locations: StorageLocation[];
  plants: { id: string; name: string; code: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const notifyTriggers = useTriggerToast();
  const [mode, setMode] = React.useState<null | "TXN" | "MOVE" | "TRANSFER" | "DISPOSAL">(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // transaction
  const [txnType, setTxnType] = React.useState<"RECEIPT" | "ISSUE" | "ADJUSTMENT">("ISSUE");
  const [qty, setQty] = React.useState("");
  const [adjSign, setAdjSign] = React.useState("-1");
  const [ref, setRef] = React.useState("");
  const [reason, setReason] = React.useState("");
  // move
  const [locationId, setLocationId] = React.useState(item.storageLocationId ?? "");
  const [overrideReason, setOverrideReason] = React.useState("");
  // transfer
  const [toPlant, setToPlant] = React.useState("");
  const [toLocation, setToLocation] = React.useState("");
  // disposal
  const [manifest, setManifest] = React.useState("");
  const [vendor, setVendor] = React.useState("");
  const [vendorAuth, setVendorAuth] = React.useState("");
  const [wasteCategory, setWasteCategory] = React.useState("");
  const [disposalDate, setDisposalDate] = React.useState(
    new Date().toISOString().slice(0, 10)
  );

  function close() { setMode(null); setError(null); setQty(""); setReason(""); setRef(""); }

  async function postTxn() {
    setError(null);
    const n = Number(qty);
    if (!n || n <= 0) { setError("Enter a quantity greater than zero."); return; }
    if (txnType === "ADJUSTMENT" && !reason.trim()) {
      setError("An adjustment needs a reason — it is the audit trail for a discrepancy.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiSend(`/api/chemicals/inventory/${item.id}/transactions`, {
        type: txnType,
        quantity: n,
        unit: item.unit,
        refDocument: ref.trim() || null,
        reason: reason.trim() || null,
        adjustmentSign: txnType === "ADJUSTMENT" ? Number(adjSign) : 1,
      });
      toast({
        variant: "success",
        title: `${txnType.toLowerCase()} posted`,
        description: `${item.batchLotNumber} now holds ${fmtQty(res.item.quantity, res.item.unit)}.`,
      });
      notifyTriggers(res.triggers, res.warnings);
      close();
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not post the transaction.");
    } finally { setBusy(false); }
  }

  async function move() {
    setError(null);
    if (!locationId) { setError("Choose a storage location."); return; }
    setBusy(true);
    try {
      const res = await apiSend(`/api/chemicals/inventory/${item.id}/storage`, {
        storageLocationId: locationId,
        overrideReason: overrideReason.trim() || null,
      });
      toast({
        variant: "success",
        title: "Storage location updated",
        description: res.overriddenWarnings?.length
          ? `${res.overriddenWarnings.length} warning override logged for review.`
          : undefined,
      });
      close();
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not move the batch.");
    } finally { setBusy(false); }
  }

  async function transfer() {
    setError(null);
    const n = Number(qty);
    if (!toPlant) { setError("Choose a destination site."); return; }
    if (!n || n <= 0) { setError("Enter a quantity greater than zero."); return; }
    setBusy(true);
    try {
      const res = await apiSend(`/api/chemicals/inventory/${item.id}/transfer`, {
        toPlantId: toPlant,
        toStorageLocationId: toLocation || null,
        quantity: n,
        refDocument: ref.trim() || null,
      });
      toast({
        variant: "success",
        title: "Transfer recorded",
        description: "Two ledger entries written — the origin shows what left, the destination what arrived.",
      });
      notifyTriggers(res.triggers);
      close();
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not transfer the stock.");
    } finally { setBusy(false); }
  }

  async function dispose() {
    setError(null);
    const n = Number(qty);
    if (!n || n <= 0) { setError("Enter a quantity greater than zero."); return; }
    if (!manifest.trim()) { setError("A manifest reference is required — it is the record an inspection asks for."); return; }
    if (!vendor.trim()) { setError("An authorised disposal vendor is required."); return; }
    setBusy(true);
    try {
      const res = await apiSend(`/api/chemicals/inventory/${item.id}/disposal`, {
        quantity: n,
        disposalDate: new Date(disposalDate).toISOString(),
        manifestReference: manifest.trim(),
        disposalVendor: vendor.trim(),
        vendorAuthorisationNo: vendorAuth.trim() || null,
        wasteCategory: wasteCategory.trim() || null,
      });
      toast({
        variant: "success",
        title: "Disposal recorded",
        description: res.eaiLinked
          ? "Linked to the EAI Register."
          : "No covering EAI aspect entry exists — the disposal is flagged as unrepresented in the environmental register.",
      });
      close();
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not record the disposal.");
    } finally { setBusy(false); }
  }

  const btn = "inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900";

  return (
    <>
      <div className="flex flex-wrap items-center gap-0.5">
        <button className={btn} onClick={() => { setTxnType("ISSUE"); setMode("TXN"); }} title="Issue, receive or adjust">
          <MinusCircle size={13} /> Issue
        </button>
        <button className={btn} onClick={() => { setTxnType("RECEIPT"); setMode("TXN"); }} title="Receive more of this batch">
          <PlusCircle size={13} /> Receive
        </button>
        <button className={btn} onClick={() => setMode("MOVE")} title="Assign or change storage location">
          <Warehouse size={13} /> Move
        </button>
        <button className={btn} onClick={() => setMode("TRANSFER")} title="Transfer to another site">
          <ArrowRightLeft size={13} /> Transfer
        </button>
        <button className={btn} onClick={() => setMode("DISPOSAL")} title="Record disposal with manifest">
          <Trash2 size={13} /> Dispose
        </button>
      </div>

      {/* ── transaction ── */}
      <Dialog open={mode === "TXN"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{item.chemicalName} — batch {item.batchLotNumber}</DialogTitle>
            <DialogDescription>
              On hand: <strong>{fmtQty(item.quantity, item.unit)}</strong>. Every movement is a
              ledger entry; quantities are never edited directly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormError message={error} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Transaction type">
                <Select value={txnType} onChange={(e) => setTxnType(e.target.value as any)}>
                  <option value="ISSUE">Issue — stock leaves the store</option>
                  <option value="RECEIPT">Receipt — more stock arrives</option>
                  <option value="ADJUSTMENT">Adjustment — correct a discrepancy</option>
                </Select>
              </Field>
              <Field label={`Quantity (${item.unit})`} required>
                <Input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
              </Field>
            </div>
            {txnType === "ADJUSTMENT" && (
              <Field label="Direction">
                <Select value={adjSign} onChange={(e) => setAdjSign(e.target.value)}>
                  <option value="-1">Write down — physical count is lower</option>
                  <option value="1">Write up — physical count is higher</option>
                </Select>
              </Field>
            )}
            <Field label="Reference document" hint="Issue slip, GRN, invoice number.">
              <Input value={ref} onChange={(e) => setRef(e.target.value)} />
            </Field>
            <Field label="Reason" required={txnType === "ADJUSTMENT"}>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
            <Button onClick={postTxn} disabled={busy}>{busy ? "Posting…" : "Post to ledger"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── move ── */}
      <Dialog open={mode === "MOVE"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move batch {item.batchLotNumber}</DialogTitle>
            <DialogDescription>
              The co-storage matrix is checked against everything already in the destination.
              A BLOCK-severity conflict is refused by the database.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormError message={error} />
            <Field label="Storage location" required>
              <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">Select…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.code}) — {l.itemCount} batches</option>
                ))}
              </Select>
            </Field>
            <Field label="Override reason" hint="Required only if a WARN-severity conflict is found.">
              <Textarea rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
            <Button onClick={move} disabled={busy}>{busy ? "Moving…" : "Move batch"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── transfer ── */}
      <Dialog open={mode === "TRANSFER"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer batch {item.batchLotNumber}</DialogTitle>
            <DialogDescription>
              Written as two ledger entries rather than a moved row, so both sites stay
              reconcilable. The destination may cross a threshold and raise a change request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormError message={error} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Destination site" required>
                <Select value={toPlant} onChange={(e) => setToPlant(e.target.value)}>
                  <option value="">Select…</option>
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </Select>
              </Field>
              <Field label={`Quantity (${item.unit})`} required>
                <Input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
              </Field>
            </div>
            <Field label="Reference document">
              <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Transfer note number" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
            <Button onClick={transfer} disabled={busy}>{busy ? "Transferring…" : "Transfer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── disposal ── */}
      <Dialog open={mode === "DISPOSAL"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record disposal — {item.batchLotNumber}</DialogTitle>
            <DialogDescription>
              Manifest reference and authorised vendor are mandatory. This is the record a
              Pollution Control Board inspection asks for and the one that cannot be produced
              after the fact.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormError message={error} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Quantity disposed (${item.unit})`} required>
                <Input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
              </Field>
              <Field label="Disposal date" required>
                <Input type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} />
              </Field>
              <Field label="Manifest reference" required>
                <Input value={manifest} onChange={(e) => setManifest(e.target.value)} placeholder="Form 10 / manifest no." />
              </Field>
              <Field label="Disposal vendor" required>
                <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Authorised TSDF operator" />
              </Field>
              <Field label="Vendor authorisation no.">
                <Input value={vendorAuth} onChange={(e) => setVendorAuth(e.target.value)} placeholder="SPCB authorisation" />
              </Field>
              <Field label="Waste category">
                <Input value={wasteCategory} onChange={(e) => setWasteCategory(e.target.value)} placeholder="e.g. 28.1 spent solvent" />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
            <Button onClick={dispose} disabled={busy}>{busy ? "Recording…" : "Record disposal"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { Boxes };
