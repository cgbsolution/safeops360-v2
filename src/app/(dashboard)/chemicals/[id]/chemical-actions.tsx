"use client";

// Chemical lifecycle actions (workflow §4.1): attach the SDS, then activate.
//
// The two-step shape is the point. Attaching a sheet and approving a
// classification are different acts by (usually) different people, and
// collapsing them into one button would mean a chemical goes ACTIVE the moment
// a PDF lands — which is not what "HSE Manager review" means.
//
// The SDS upload goes through the shared evidence-attachment layer at basic
// tier: store the file, link it, show it. Nothing parses it.

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, ShieldCheck, Ban } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { Chemical } from "@/lib/chemicals/types";
import { apiSend, Field, FormError } from "../_client";

export function ChemicalActions({ chemical }: { chemical: Chemical }) {
  const router = useRouter();
  const { toast } = useToast();
  const [sdsOpen, setSdsOpen] = React.useState(false);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [file, setFile] = React.useState<File | null>(null);
  const [revisionDate, setRevisionDate] = React.useState("");
  const [validity, setValidity] = React.useState("3");

  const [newStatus, setNewStatus] = React.useState("INACTIVE");
  const [reason, setReason] = React.useState("");

  async function uploadSds() {
    setError(null);
    if (!file) { setError("Choose the Safety Data Sheet PDF to upload."); return; }
    if (!revisionDate) { setError("Enter the sheet's revision date — the review clock runs from it."); return; }
    setBusy(true);
    try {
      // The evidence layer is a three-step signed-URL flow, not a multipart
      // POST: init (reserves the row + returns a Supabase upload URL) → PUT the
      // bytes straight to storage → complete (versions the slot). The file
      // never passes through the API server, which is why a 50 MB SDS does not
      // occupy a request worker.
      //
      // `slotKey: "sds"` is what makes a re-upload SUPERSEDE the previous sheet
      // (bumping version, keeping the old one queryable) instead of silently
      // overwriting it — the audit trail wants the sheet history.
      const base = `/api/evidence/chemical_master/${chemical.id}`;

      const init = await apiSend(base, {
        phase: "init",
        category: "SDS_SHEET",
        documentCategory: "SDS",
        slotKey: "sds",
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/pdf",
      });

      const put = await fetch(init.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/pdf",
          ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
        },
        body: file,
      });
      if (!put.ok) {
        throw new Error(
          `Storage upload failed (${put.status}). The attachment row was reserved but no file ` +
            `was stored — retry, or check Supabase Storage configuration.`
        );
      }

      await apiSend(base, { phase: "complete", attachmentId: init.attachmentId });

      await apiSend(`/api/chemicals/masters/${chemical.id}/sds`, {
        attachmentId: init.attachmentId,
        revisionDate: new Date(revisionDate).toISOString(),
        validityYears: Number(validity),
      });

      toast({
        variant: "success",
        title: "Safety Data Sheet attached",
        description: "The review clock is running. Activate once the classification is checked.",
      });
      setSdsOpen(false);
      setFile(null);
      setRevisionDate("");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not attach the Safety Data Sheet.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string, why?: string) {
    setError(null);
    setBusy(true);
    try {
      await apiSend(`/api/chemicals/masters/${chemical.id}/status`, {
        status,
        reason: why ?? null,
      });
      toast({
        variant: "success",
        title: `${chemical.name} is now ${status.replace(/_/g, " ")}`,
        description:
          status === "ACTIVE"
            ? "Stock can now be received against this chemical."
            : undefined,
      });
      setStatusOpen(false);
      setReason("");
      router.refresh();
    } catch (e: any) {
      // The backend's message here is the useful one — e.g. "cannot be
      // activated without a Safety Data Sheet attached" or "has no hazard
      // classification". Show it verbatim.
      setError(e?.message ?? "Could not change the status.");
      if (!statusOpen) {
        toast({ variant: "error", title: "Cannot activate", description: e?.message });
      }
    } finally {
      setBusy(false);
    }
  }

  const canActivate = !!chemical.sdsAttachmentId && chemical.hazardClasses.length > 0;

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => { setError(null); setSdsOpen(true); }}>
        <FileUp size={15} className="mr-1.5" />
        {chemical.sdsAttachmentId ? "Replace SDS" : "Attach SDS"}
      </Button>

      {chemical.status !== "ACTIVE" && (
        <Button
          variant="success"
          disabled={!canActivate || busy}
          onClick={() => setStatus("ACTIVE")}
          title={
            canActivate
              ? undefined
              : "Attach a Safety Data Sheet and enter the hazard classification first."
          }
        >
          <ShieldCheck size={15} className="mr-1.5" />
          Approve & activate
        </Button>
      )}

      <Button variant="outline" onClick={() => { setError(null); setStatusOpen(true); }}>
        <Ban size={15} className="mr-1.5" />
        Change status
      </Button>

      {!canActivate && chemical.status !== "ACTIVE" && (
        <p className="w-full text-[11px] text-amber-700">
          {!chemical.sdsAttachmentId
            ? "Activation is blocked until a Safety Data Sheet is attached — enforced by a database constraint."
            : "Enter at least one hazard class before activating; threshold and co-storage rules match on it."}
        </p>
      )}

      {/* ── attach SDS ── */}
      <Dialog open={sdsOpen} onOpenChange={setSdsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach Safety Data Sheet</DialogTitle>
            <DialogDescription>
              Stored as supporting evidence against {chemical.name}. The file is not parsed —
              hazard values stay exactly as a person entered them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormError message={error} />
            <Field label="SDS document (PDF)" required>
              <Input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sheet revision date" required hint="The review due date is calculated from this.">
                <Input type="date" value={revisionDate} onChange={(e) => setRevisionDate(e.target.value)} />
              </Field>
              <Field label="Validity (years)">
                <SelectField value={validity} onChange={setValidity}
                  options={[
                  { value: "1", label: "1 year" },
                  { value: "2", label: "2 years" },
                  { value: "3", label: "3 years (default)" },
                  { value: "5", label: "5 years" }
                ]}
                />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSdsOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={uploadSds} disabled={busy}>{busy ? "Uploading…" : "Attach"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── change status ── */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>
              RESTRICTED keeps the chemical usable but blocks new receipts without an HSE
              Manager exception. INACTIVE blocks receipts outright. Neither affects stock
              already on site — you can always issue or dispose of what is there.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormError message={error} />
            <Field label="New status">
              <SelectField value={newStatus} onChange={setNewStatus}
                options={[
                { value: "ACTIVE", label: "Active" },
                { value: "RESTRICTED", label: "Restricted" },
                { value: "INACTIVE", label: "Inactive" },
                { value: "PENDING_SDS", label: "Pending SDS" }
              ]}
              />
            </Field>
            {newStatus === "RESTRICTED" && (
              <Field label="Restriction reason" required hint="Shown to anyone who tries to receive this chemical.">
                <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => setStatus(newStatus, reason)} disabled={busy}>
              {busy ? "Saving…" : "Update status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
