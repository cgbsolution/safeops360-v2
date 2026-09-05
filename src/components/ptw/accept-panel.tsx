"use client";

// PTW closed-loop: Receiver acceptance panel — a first-class signed act.
// The receiver confirms the declaration, signs, captures GPS + an onsite
// photo, and the permit transitions ISSUED → ACTIVE (work in progress)
// through POST /api/ptw/{id}/accept. The activation gate (FLRA when
// required, crew validity, PPE, isolations, expiry) is enforced server-side
// and its blockers are rendered by the page above this panel.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, PlayCircle } from "lucide-react";
import { readApiError } from "@/lib/client-errors";
import { Alert } from "@/components/ui/alert";
import {
  EvidenceCapture,
  evidenceComplete,
  evidencePayload,
  useEvidenceCapture,
} from "@/components/ptw/evidence-capture";

const ACCEPT_DECLARATION =
  "I confirm I have inspected the worksite, understand the scope and hazards of this permit, " +
  "verified the stated controls are in place, and accept responsibility for the work under this permit.";

export function AcceptPanel({
  permitId,
  permitNumber,
  gateOk,
}: {
  permitId: string;
  permitNumber: string;
  /** Activation-gate state from the SSR page — the button stays enabled
      (server re-checks) but we surface the warning inline. */
  gateOk: boolean;
}) {
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const evidenceState = useEvidenceCapture();

  const ready = evidenceComplete(evidenceState, {
    requirePhoto: true,
    requireDeclaration: true,
  });

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/ptw/${permitId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comments: comments || undefined,
          evidence: evidencePayload(evidenceState, ACCEPT_DECLARATION),
        }),
      });
      if (r.ok) {
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Acceptance failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary-300 ring-2 ring-primary-100">
      <CardHeader className="bg-primary-50 rounded-t-xl">
        <CardTitle className="text-primary-900 flex items-center gap-2">
          <PlayCircle size={18} /> Accept Permit {permitNumber}
        </CardTitle>
        <CardDescription className="text-primary-700">
          You are the named receiver. Accepting at the worksite activates the
          permit — work may then start. GPS, an onsite photo and your
          signature are recorded on the permit's audit trail.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {!gateOk && (
          <Alert variant="warning" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            The activation gate still shows blockers (see the panel above).
            Resolve them first — acceptance will be refused until every
            blocker clears.
          </Alert>
        )}

        <EvidenceCapture
          permitId={permitId}
          requirePhoto
          declaration={ACCEPT_DECLARATION}
          state={evidenceState}
        />

        <div className="space-y-1.5">
          <Label className="text-[11px]">Comments (optional)</Label>
          <Textarea
            rows={2}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Site conditions, toolbox talk notes…"
          />
        </div>

        {error && (
          <Alert variant="destructive" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 whitespace-pre-wrap">
            {error}
          </Alert>
        )}

        <Button onClick={accept} disabled={busy || !ready} variant="success">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
          Accept & Activate Permit
        </Button>
        {!ready && (
          <div className="text-[11px] text-slate-500">
            GPS fix, onsite photo, signature and the declaration tick are all
            required before you can accept.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
