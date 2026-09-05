"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { readApiError } from "@/lib/client-errors";
import { Alert } from "@/components/ui/alert";

const REVOKER_ROLES = [
  "HSE_MANAGER",
  "LD_MANAGER",
  "ADMIN",
  "PLANT_HEAD",
];

const REASONS = [
  { value: "INCIDENT_INVOLVEMENT", label: "Incident involvement" },
  { value: "DISCIPLINARY", label: "Disciplinary action" },
  { value: "ROLE_CHANGE", label: "Role change" },
  { value: "HEALTH_REASONS", label: "Health reasons" },
  { value: "TRAINING_FRAUD", label: "Training fraud" },
  { value: "OTHER", label: "Other" },
];

export function CertificateRevokeButton({
  certificateId,
  certificateNumber,
  currentRole,
}: {
  certificateId: string;
  certificateNumber: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState(REASONS[0].value);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!REVOKER_ROLES.includes(currentRole)) {
    return (
      <p className="text-xs text-slate-500">
        Only HSE Manager / LD Manager / Plant Head / Admin can revoke certificates.
      </p>
    );
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/training/certificates/${certificateId}/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, details }),
        }
      );
      if (r.ok) {
        setShow(false);
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Failed to revoke"));
    } finally {
      setBusy(false);
    }
  }

  if (!show) {
    return (
      <Button size="sm" variant="outline" onClick={() => setShow(true)} className="text-rose-700">
        <XCircle size={14} /> Revoke certificate
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Alert variant="destructive" className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-md p-2">
        Revoking <strong>{certificateNumber}</strong> takes immediate effect — all
        SafeOps gates referring to this certificate will fail. The audit
        trail is preserved.
      </Alert>
      <div className="space-y-1.5">
        <Label className="text-xs">Reason category *</Label>
        <SelectField value={reason} onChange={(value) => setReason(value)}
          options={REASONS.map((r) => ({ value: String(r.value), label: `${r.label}` }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Details *</Label>
        <Textarea
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="What happened. (Stays internal — not shown on public verify.)"
        />
      </div>
      {error && <div className="text-xs text-rose-700">{error}</div>}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={submit}
          disabled={busy || !details.trim()}
          className="bg-rose-600 hover:bg-rose-700"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
          Confirm Revoke
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShow(false)}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
