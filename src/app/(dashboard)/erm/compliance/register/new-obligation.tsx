"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

const OBLIGATION_TYPES = [
  "LICENSE",
  "CONSENT",
  "PERMIT",
  "REGISTRATION",
  "RETURN_FILING",
  "STATUTORY_REGISTER",
  "INSPECTION",
  "CERTIFICATION",
  "OTHER",
];

const FREQUENCIES = ["ONE_TIME", "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL", "BIENNIAL", "ON_EVENT"];

function label(token: string): string {
  return token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function NewObligationButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> New Obligation
      </Button>
      {open && <NewObligationModal onClose={() => setOpen(false)} />}
    </>
  );
}

function NewObligationModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [obligationType, setObligationType] = useState("LICENSE");
  const [statuteReference, setStatuteReference] = useState("");
  const [regulatorName, setRegulatorName] = useState("");
  const [siteId, setSiteId] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState("ANNUAL");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [renewalLeadDays, setRenewalLeadDays] = useState("30");
  const [conditionsText, setConditionsText] = useState("");

  async function submit() {
    if (!title.trim() || !ownerId) {
      setErr("Title and owner are required.");
      return;
    }
    setBusy(true);
    setErr(null);
    const conditions = conditionsText
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);
    const body = {
      title: title.trim(),
      obligationType,
      statuteReference: statuteReference.trim(),
      regulatorName: regulatorName.trim(),
      siteId: siteId.trim() || null,
      ownerId,
      frequency,
      validFrom: validFrom || null,
      validUntil: validUntil || null,
      renewalLeadDays: Number(renewalLeadDays) || 0,
      conditions,
      linkedRiskIds: [] as string[],
      isActive: true,
    };
    const res = await fetch("/api/erm/compliance/obligations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.detail || j.error || `Failed (${res.status})`);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New Obligation</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </Button>
        </div>

        {err && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}

        <div className="space-y-3">
          <Field label="Title (required)">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Factory Licence under Factories Act 1948"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Obligation type">
              <Select value={obligationType} onChange={(e) => setObligationType(e.target.value)}>
                {OBLIGATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Frequency">
              <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {label(f)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Statute reference">
              <Input
                value={statuteReference}
                onChange={(e) => setStatuteReference(e.target.value)}
                placeholder="e.g. Factories Act, 1948 — s.6"
              />
            </Field>
            <Field label="Regulator">
              <Input
                value={regulatorName}
                onChange={(e) => setRegulatorName(e.target.value)}
                placeholder="e.g. Chief Inspector of Factories"
              />
            </Field>
          </div>

          <Field label="Owner (required)">
            <UserPicker value={ownerId} onChange={(id) => setOwnerId(id)} placeholder="Search and select the accountable owner" required />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Site ID (optional)">
              <Input
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                placeholder="Plant / site id"
              />
            </Field>
            <Field label="Valid from">
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </Field>
            <Field label="Valid until">
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </Field>
          </div>

          <Field label="Renewal lead days">
            <Input
              type="number"
              min={0}
              value={renewalLeadDays}
              onChange={(e) => setRenewalLeadDays(e.target.value)}
              className="w-32"
            />
          </Field>

          <Field label="Conditions (one per line)">
            <Textarea
              value={conditionsText}
              onChange={(e) => setConditionsText(e.target.value)}
              rows={3}
              placeholder={"e.g. Maintain effluent within consent limits\nFile quarterly returns by the 30th"}
            />
          </Field>

          <Button
            disabled={busy || !title.trim() || !ownerId}
            onClick={submit}
            className="w-full"
          >
            {busy ? "Saving…" : "Create obligation"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
