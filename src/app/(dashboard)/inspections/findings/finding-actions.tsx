"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Label } from "@/components/ui/label";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { CheckCircle2, Clock, Copy, AlertCircle, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";

const ROOT_CAUSE_CATEGORIES = ["MAN", "MACHINE", "METHOD", "MATERIAL", "MEASUREMENT", "ENVIRONMENT"] as const;

export function FindingActions({
  findingId, status, severity, ownerId
}: {
  findingId: string;
  status: string;
  severity: string;
  ownerId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Local state for inline edits
  const [closureNote, setClosureNote] = useState("");
  const [rootCauseCategory, setRootCauseCategory] = useState("");
  const [rootCauseNote, setRootCauseNote] = useState("");
  const [deferredUntil, setDeferredUntil] = useState("");
  const [deferredReason, setDeferredReason] = useState("");
  const [duplicateOfNumber, setDuplicateOfNumber] = useState("");
  const [effectivenessRating, setEffectivenessRating] = useState("");
  const [effectivenessNote, setEffectivenessNote] = useState("");

  async function patch(payload: any) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/inspections/findings/${findingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `Action failed (${res.status}).`);
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <>
      <CardHeader>
        <CardTitle>Lifecycle actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive" className="rounded border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{error}</Alert>
        )}

        {/* Take ownership */}
        {!ownerId && (
          <Can permission="INSPECTION_FINDING.UPDATE">
            <Button onClick={() => patch({ takeOwnership: true })} disabled={busy}>
              <CheckCircle2 size={14} /> Take ownership
            </Button>
          </Can>
        )}

        {/* Root cause */}
        {(status === "OPEN" || status === "UNDER_REVIEW" || status === "IN_PROGRESS") && (
          <Can permission="INSPECTION_FINDING.UPDATE">
            <details className="border border-slate-200 rounded-md p-3 text-sm">
              <summary className="cursor-pointer font-medium text-slate-700">Root cause analysis</summary>
              <div className="mt-2 space-y-2">
                <div>
                  <Label>Category (5M)</Label>
                  <SelectField value={rootCauseCategory} onChange={setRootCauseCategory}
                    placeholder="— Select —"
                    options={ROOT_CAUSE_CATEGORIES.map((c) => ({ value: String(c), label: c }))}
                  />
                </div>
                <div>
                  <Label>Note</Label>
                  <Textarea rows={2} value={rootCauseNote} onChange={(e) => setRootCauseNote(e.target.value)} placeholder="What was the root cause?" />
                </div>
                <Button onClick={() => patch({ rootCauseCategory, rootCauseNote, status: "IN_PROGRESS" })} disabled={busy || !rootCauseCategory}>
                  Save root cause
                </Button>
              </div>
            </details>
          </Can>
        )}

        {/* Close */}
        {(status === "OPEN" || status === "IN_PROGRESS" || status === "UNDER_REVIEW") && (
          <Can permission="INSPECTION_FINDING.CLOSE">
            <details className="border border-slate-200 rounded-md p-3 text-sm">
              <summary className="cursor-pointer font-medium text-emerald-700">Close finding</summary>
              <div className="mt-2 space-y-2">
                <div>
                  <Label>Closure note</Label>
                  <Textarea rows={2} value={closureNote} onChange={(e) => setClosureNote(e.target.value)} placeholder="What was done to close this?" />
                </div>
                <Button onClick={() => patch({ status: "CLOSED", closureNote })} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 size={14} /> Mark closed
                </Button>
              </div>
            </details>
          </Can>
        )}

        {/* Verify */}
        {status === "CLOSED" && (
          <Can permission="INSPECTION_FINDING.VERIFY">
            <Button onClick={() => patch({ status: "VERIFIED" })} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
              <ShieldCheck size={14} /> Verify closure
            </Button>
          </Can>
        )}

        {/* Defer */}
        {(status === "OPEN" || status === "IN_PROGRESS") && (
          <Can permission="INSPECTION_FINDING.DEFER">
            <details className="border border-slate-200 rounded-md p-3 text-sm">
              <summary className="cursor-pointer font-medium text-amber-700">Defer</summary>
              <div className="mt-2 space-y-2">
                <div>
                  <Label>Defer until</Label>
                  <Input type="date" value={deferredUntil} onChange={(e) => setDeferredUntil(e.target.value)} />
                </div>
                <div>
                  <Label>Reason</Label>
                  <Textarea rows={2} value={deferredReason} onChange={(e) => setDeferredReason(e.target.value)} required />
                </div>
                <Button onClick={() => patch({ status: "DEFERRED", deferredUntil, deferredReason })} disabled={busy || !deferredUntil || !deferredReason}>
                  <Clock size={14} /> Defer
                </Button>
              </div>
            </details>
          </Can>
        )}

        {/* Duplicate */}
        {(status === "OPEN" || status === "IN_PROGRESS") && (
          <Can permission="INSPECTION_FINDING.UPDATE">
            <details className="border border-slate-200 rounded-md p-3 text-sm">
              <summary className="cursor-pointer font-medium">Mark duplicate</summary>
              <div className="mt-2 space-y-2">
                <div>
                  <Label>Original finding number</Label>
                  <Input value={duplicateOfNumber} onChange={(e) => setDuplicateOfNumber(e.target.value)} placeholder="FND-2026-0001" />
                </div>
                <Button onClick={() => patch({ status: "DUPLICATE", duplicateOfFindingNumber: duplicateOfNumber })} disabled={busy || !duplicateOfNumber}>
                  <Copy size={14} /> Mark as duplicate
                </Button>
              </div>
            </details>
          </Can>
        )}

        {/* Effectiveness review */}
        {status === "VERIFIED" && (
          <Can permission="INSPECTION_FINDING.UPDATE">
            <details className="border border-slate-200 rounded-md p-3 text-sm">
              <summary className="cursor-pointer font-medium text-blue-700">Effectiveness review (90-day)</summary>
              <div className="mt-2 space-y-2">
                <div>
                  <Label>Rating</Label>
                  <SelectField value={effectivenessRating} onChange={setEffectivenessRating}
                    placeholder="— Select —"
                    options={[
                    { value: "EFFECTIVE", label: "Effective — issue did not recur" },
                    { value: "PARTIAL", label: "Partial — issue partially addressed" },
                    { value: "NOT_EFFECTIVE", label: "Not effective — additional action needed" },
                    { value: "RECURRENCE", label: "Recurrence — issue happened again" }
                  ]}
                  />
                </div>
                <div>
                  <Label>Note</Label>
                  <Textarea rows={2} value={effectivenessNote} onChange={(e) => setEffectivenessNote(e.target.value)} />
                </div>
                <Button onClick={() => patch({ effectivenessRating, effectivenessNote })} disabled={busy || !effectivenessRating}>
                  Save review
                </Button>
              </div>
            </details>
          </Can>
        )}
      </CardContent>
    </>
  );
}
