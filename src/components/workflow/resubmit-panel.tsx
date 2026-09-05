"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";

// Shown on a rejected record's detail page to the original initiator.
// Submitting routes the workflow back to the first review step (CHECKER).
export function ResubmitPanel({
  instanceId,
  rejectionReason,
  rejectedBy,
  rejectedAt
}: {
  instanceId: string;
  rejectionReason: string | null;
  rejectedBy: string | null;
  rejectedAt: Date | string | null;
}) {
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    const r = await fetch("/api/workflow/resubmit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceId, comments: comments || undefined })
    });
    setBusy(false);
    if (r.ok) {
      router.refresh();
    } else {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "Re-submit failed");
    }
  }

  return (
    <Card className="border-rose-300 ring-2 ring-rose-100">
      <CardHeader className="bg-rose-50 rounded-t-xl">
        <CardTitle className="text-rose-900 flex items-center gap-2">
          <AlertTriangle size={18} /> This record was rejected — rework required
        </CardTitle>
        <CardDescription className="text-rose-700">
          Update the record as needed, then re-submit it back into the review queue.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {rejectionReason && (
          <Alert variant="destructive" className="rounded-md border border-rose-200 bg-white p-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-rose-700 mb-1">Rejection reason</div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{rejectionReason}</p>
            {(rejectedBy || rejectedAt) && (
              <div className="mt-2 text-[11px] text-slate-500">
                {rejectedBy && <>By <strong>{rejectedBy}</strong></>}
                {rejectedBy && rejectedAt && " · "}
                {rejectedAt && <>On {formatDateTime(rejectedAt)}</>}
              </div>
            )}
          </Alert>
        )}

        <div className="space-y-2">
          <Label>Comments (what you changed) <span className="text-slate-400">— optional</span></Label>
          <Textarea
            rows={3}
            placeholder="What you addressed before re-submitting…"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>

        {error && <Alert variant="destructive" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</Alert>}

        <div className="flex gap-2 pt-1">
          <Button onClick={submit} disabled={busy} variant="success">
            <RotateCcw size={14} /> {busy ? "Re-submitting…" : "Re-submit for review"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
