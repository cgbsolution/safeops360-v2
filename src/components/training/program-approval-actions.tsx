"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PauseCircle, Send, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { readApiError } from "@/lib/client-errors";

const APPROVER_ROLES = ["HSE_MANAGER", "ADMIN"];
const RETIRER_ROLES = ["HSE_MANAGER", "ADMIN", "LD_MANAGER"];

export function ProgramApprovalActions({
  programId,
  approvalStatus,
  currentRole
}: {
  programId: string;
  approvalStatus: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"submit" | "approve" | "reject" | "retire" | null>(null);
  const [comments, setComments] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [showRetire, setShowRetire] = useState(false);

  const canApprove = APPROVER_ROLES.includes(currentRole);
  const canRetire = RETIRER_ROLES.includes(currentRole);

  async function call(path: string, body: any, op: typeof busy) {
    setBusy(op);
    setError("");
    try {
      const r = await fetch(`/api/training/programs/${programId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (r.ok) {
        setComments("");
        setReason("");
        setShowRetire(false);
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Action failed"));
    } finally {
      setBusy(null);
    }
  }

  if (approvalStatus === "DRAFT") {
    return (
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="p-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-amber-900 flex items-center gap-1.5">
              <PauseCircle size={14} /> Program is in DRAFT
            </div>
            <p className="text-xs text-amber-800 mt-1">
              Submit for HSE Manager review when configuration is complete.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => call("submit", { comments }, "submit")}
            disabled={busy !== null}
          >
            {busy === "submit" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Submit for Review
          </Button>
        </CardContent>
        {error && <div className="px-4 pb-3 text-xs text-rose-700">{error}</div>}
      </Card>
    );
  }

  if (approvalStatus === "UNDER_REVIEW") {
    if (!canApprove) {
      return (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-amber-900 flex items-center gap-1.5">
              <PauseCircle size={14} /> Awaiting HSE Manager review
            </div>
            <p className="text-xs text-amber-800 mt-1">
              Only HSE Manager / Admin can approve or reject this program.
            </p>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="p-4 space-y-2">
          <div className="text-sm font-medium text-amber-900">Review pending</div>
          <Textarea
            rows={2}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Approval / rejection comments (shown in audit trail)"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => call("decide", { decision: "APPROVED", comments }, "approve")}
              disabled={busy !== null}
            >
              {busy === "approve" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => call("decide", { decision: "REJECTED", comments }, "reject")}
              disabled={busy !== null}
            >
              {busy === "reject" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <XCircle size={14} />
              )}
              Reject (back to DRAFT)
            </Button>
          </div>
          {error && <div className="text-xs text-rose-700">{error}</div>}
        </CardContent>
      </Card>
    );
  }

  if (approvalStatus === "APPROVED" && canRetire) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="p-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Program is APPROVED and live
            </div>
            <p className="text-xs text-emerald-800 mt-1">
              Schedules can be created. Retire when the program is superseded — existing
              certificates remain valid.
            </p>
          </div>
          {!showRetire && (
            <Button size="sm" variant="outline" onClick={() => setShowRetire(true)}>
              Retire
            </Button>
          )}
        </CardContent>
        {showRetire && (
          <CardContent className="p-4 pt-0 space-y-2">
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for retiring this program"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => call("retire", { reason }, "retire")}
                disabled={busy !== null || !reason.trim()}
              >
                {busy === "retire" ? <Loader2 size={14} className="animate-spin" /> : null}
                Confirm Retire
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRetire(false)}
                disabled={busy !== null}
              >
                Cancel
              </Button>
            </div>
            {error && <div className="text-xs text-rose-700">{error}</div>}
          </CardContent>
        )}
      </Card>
    );
  }

  if (approvalStatus === "RETIRED") {
    return (
      <Card className="border-slate-200 bg-slate-50/40">
        <CardContent className="p-4">
          <div className="text-sm font-medium text-slate-700">Program is RETIRED</div>
          <p className="text-xs text-slate-600 mt-1">
            New schedules cannot be created. Existing certificates remain valid until expiry.
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
}
