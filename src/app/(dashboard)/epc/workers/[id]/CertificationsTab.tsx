"use client";

import { useState } from "react";
import {
  Award,
  ShieldCheck,
  HardHat,
  ChevronDown,
  ChevronUp,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card } from "@/components/ui/card";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type TrainingCert = {
  programCode: string;
  programName: string;
  issuedDate?: string;
  validUntil?: string;
  certificateUrl?: string;
  status?: string;
};

type CompetencyRecord = {
  competencyCode: string;
  competencyName: string;
  validFrom?: string;
  validUntil?: string;
  assessor?: string;
  status?: string;
};

type PpeIssuance = {
  ppeType: string;
  itemSerial?: string;
  issuedDate?: string;
  expiryDate?: string;
  status?: string;
};

type Props = {
  workerId: string;
  trainingCertificates: TrainingCert[];
  competencyRecords: CompetencyRecord[];
  ppeIssuances: PpeIssuance[];
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function certStatusBadge(status?: string) {
  const s = (status ?? "").toLowerCase();
  if (s === "active" || s === "valid")
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "expiring_soon")
    return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "expired")
    return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function humanize(s?: string): string {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }: { status?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${certStatusBadge(
        status
      )}`}
    >
      {humanize(status)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Add Training Certificate form                                             */
/* -------------------------------------------------------------------------- */

function AddCertForm({
  workerId,
  existing,
  onAdded,
}: {
  workerId: string;
  existing: TrainingCert[];
  onAdded: (certs: TrainingCert[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    programCode: "",
    programName: "",
    issuedDate: "",
    validUntil: "",
    certificateUrl: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.programCode.trim() || !form.programName.trim()) {
      setErr("Program Code and Program Name are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const newCert: TrainingCert = {
        programCode: form.programCode.trim(),
        programName: form.programName.trim(),
        issuedDate: form.issuedDate || undefined,
        validUntil: form.validUntil || undefined,
        certificateUrl: form.certificateUrl || undefined,
        status: "active",
      };
      const updated = [...existing, newCert];
      const res = await fetch(`/api/epc/workers/${workerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingCertificates: updated }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail ?? `Error ${res.status}`);
      }
      onAdded(updated);
      setForm({ programCode: "", programName: "", issuedDate: "", validUntil: "", certificateUrl: "" });
      setOpen(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="h-auto w-full justify-start gap-1.5 px-4 py-2.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50 text-left"
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        <Plus size={12} />
        Add Certificate
      </Button>
      {open && (
        <form
          onSubmit={handleSubmit}
          className="px-4 pb-4 pt-2 border-t bg-slate-50 space-y-3"
        >
          {err && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded">
              {err}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Program Code *</Label>
              <Input
                value={form.programCode}
                onChange={(e) => setForm((f) => ({ ...f, programCode: e.target.value }))}
                placeholder="e.g. WLD-ADV-01"
                className="mt-1 text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Program Name *</Label>
              <Input
                value={form.programName}
                onChange={(e) => setForm((f) => ({ ...f, programName: e.target.value }))}
                placeholder="e.g. Advanced Welding Safety"
                className="mt-1 text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Issued Date</Label>
              <Input
                type="date"
                value={form.issuedDate}
                onChange={(e) => setForm((f) => ({ ...f, issuedDate: e.target.value }))}
                className="mt-1 text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Valid Until</Label>
              <Input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                className="mt-1 text-xs h-8"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Certificate URL (optional)</Label>
              <Input
                type="url"
                value={form.certificateUrl}
                onChange={(e) => setForm((f) => ({ ...f, certificateUrl: e.target.value }))}
                placeholder="https://..."
                className="mt-1 text-xs h-8"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="text-xs h-8">
              {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
              Save Certificate
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Add Competency Record form                                                */
/* -------------------------------------------------------------------------- */

function AddCompetencyForm({
  workerId,
  existing,
  onAdded,
}: {
  workerId: string;
  existing: CompetencyRecord[];
  onAdded: (recs: CompetencyRecord[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    competencyCode: "",
    competencyName: "",
    validFrom: "",
    validUntil: "",
    assessor: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.competencyCode.trim() || !form.competencyName.trim()) {
      setErr("Competency Code and Name are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const newRec: CompetencyRecord = {
        competencyCode: form.competencyCode.trim(),
        competencyName: form.competencyName.trim(),
        validFrom: form.validFrom || undefined,
        validUntil: form.validUntil || undefined,
        assessor: form.assessor || undefined,
        status: "active",
      };
      const updated = [...existing, newRec];
      const res = await fetch(`/api/epc/workers/${workerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencyRecords: updated }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail ?? `Error ${res.status}`);
      }
      onAdded(updated);
      setForm({ competencyCode: "", competencyName: "", validFrom: "", validUntil: "", assessor: "" });
      setOpen(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="h-auto w-full justify-start gap-1.5 px-4 py-2.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50 text-left"
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        <Plus size={12} />
        Add Competency Record
      </Button>
      {open && (
        <form
          onSubmit={handleSubmit}
          className="px-4 pb-4 pt-2 border-t bg-slate-50 space-y-3"
        >
          {err && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded">
              {err}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Competency Code *</Label>
              <Input
                value={form.competencyCode}
                onChange={(e) => setForm((f) => ({ ...f, competencyCode: e.target.value }))}
                placeholder="e.g. COMP-RIG-02"
                className="mt-1 text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Competency Name *</Label>
              <Input
                value={form.competencyName}
                onChange={(e) => setForm((f) => ({ ...f, competencyName: e.target.value }))}
                placeholder="e.g. Rigging Level 2"
                className="mt-1 text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Valid From</Label>
              <Input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                className="mt-1 text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Valid Until</Label>
              <Input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                className="mt-1 text-xs h-8"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Assessor (optional)</Label>
              <Input
                value={form.assessor}
                onChange={(e) => setForm((f) => ({ ...f, assessor: e.target.value }))}
                placeholder="Assessor name or ID"
                className="mt-1 text-xs h-8"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="text-xs h-8">
              {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
              Save Record
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main exported component                                                   */
/* -------------------------------------------------------------------------- */

export default function CertificationsTab({
  workerId,
  trainingCertificates: initialCerts,
  competencyRecords: initialComps,
  ppeIssuances,
}: Props) {
  const [certs, setCerts] = useState<TrainingCert[]>(initialCerts);
  const [comps, setComps] = useState<CompetencyRecord[]>(initialComps);

  return (
    <div className="space-y-5">
      {/* Training Certificates */}
      <Card className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Award size={14} className="text-cyan-700" />
          <h3 className="text-sm font-semibold text-slate-700">
            Training Certificates ({certs.length})
          </h3>
        </div>
        {certs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            <Award size={28} className="mx-auto mb-2 text-slate-300" />
            No training certificates on record.
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Program Code</TableHead>
                <TableHead>Program Name</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certs.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-slate-500">{c.programCode}</TableCell>
                  <TableCell className="font-medium text-slate-900">
                    {c.programName}
                    {c.certificateUrl && (
                      <a
                        href={c.certificateUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1.5 text-cyan-600 hover:underline"
                      >
                        View
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600">{fmtDate(c.issuedDate)}</TableCell>
                  <TableCell className="text-slate-600">{fmtDate(c.validUntil)}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <AddCertForm workerId={workerId} existing={certs} onAdded={setCerts} />
      </Card>

      {/* Competency Records */}
      <Card className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <ShieldCheck size={14} className="text-cyan-700" />
          <h3 className="text-sm font-semibold text-slate-700">
            Competency Records ({comps.length})
          </h3>
        </div>
        {comps.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            <ShieldCheck size={28} className="mx-auto mb-2 text-slate-300" />
            No competency records on record.
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Valid From</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assessor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comps.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-slate-500">{c.competencyCode}</TableCell>
                  <TableCell className="font-medium text-slate-900">{c.competencyName}</TableCell>
                  <TableCell className="text-slate-600">{fmtDate(c.validFrom)}</TableCell>
                  <TableCell className="text-slate-600">{fmtDate(c.validUntil)}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-slate-600">{c.assessor ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <AddCompetencyForm workerId={workerId} existing={comps} onAdded={setComps} />
      </Card>

      {/* PPE Issuances (read-only) */}
      <Card className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <HardHat size={14} className="text-cyan-700" />
          <h3 className="text-sm font-semibold text-slate-700">
            PPE Issuances ({ppeIssuances.length})
          </h3>
        </div>
        {ppeIssuances.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            <HardHat size={28} className="mx-auto mb-2 text-slate-300" />
            No PPE issuances on record.
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>PPE Type</TableHead>
                <TableHead>Item Serial</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ppeIssuances.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-slate-900">{p.ppeType}</TableCell>
                  <TableCell className="font-mono text-slate-500">{p.itemSerial ?? "—"}</TableCell>
                  <TableCell className="text-slate-600">{fmtDate(p.issuedDate)}</TableCell>
                  <TableCell className="text-slate-600">{fmtDate(p.expiryDate)}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
