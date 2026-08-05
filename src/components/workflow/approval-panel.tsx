"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, UserMinus, Clock, AlertCircle } from "lucide-react";
import { daysBetween, formatDateTime, cn } from "@/lib/utils";
import { UserPicker } from "@/components/ui/user-picker";
import {
  EvidenceCapture,
  evidenceComplete,
  evidencePayload,
  useEvidenceCapture,
} from "@/components/ptw/evidence-capture";

type Task = {
  id: string;
  stepName: string;
  taskType: string;
  dueAt?: Date | string | null;
  assignedAt: Date | string;
};

export function ApprovalPanel({
  task,
  recordData,
  needsResponsiblePerson,
  plantId,
  eligibleRoles,
  ptwEvidence
}: {
  task: Task;
  recordData?: Record<string, any>;
  needsResponsiblePerson?: boolean;
  /** Plant scope for the picker, so it only lists users at this plant. */
  plantId?: string;
  /** Roles that are eligible for the current step (from the workflow
      definition: approverRole + approverGroupRoles). When set, the
      reassign user picker filters to users holding one of these roles
      so a workflow can't be reassigned to someone who lacks the
      permission to act on it (which would just result in "Missing
      permission" later). */
  eligibleRoles?: string[];
  /** PTW closed-loop: when set, approvals must carry field evidence
      (GPS + signature + photo per policy) — validated server-side too. */
  ptwEvidence?: { permitId: string; requirePhoto: boolean };
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "approve" | "reject" | "reassign">("idle");
  const [comments, setComments] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [responsiblePersonId, setResponsiblePersonId] = useState<string | null>(null);
  const evidenceState = useEvidenceCapture();

  const slaBadge = computeSlaBadge(task.dueAt);
  const evidenceReady =
    !ptwEvidence ||
    evidenceComplete(evidenceState, {
      requirePhoto: ptwEvidence.requirePhoto,
      requireDeclaration: false,
    });

  async function submit(action: "approve" | "reject") {
    if (action === "reject" && !reason.trim()) {
      setError("Rejection reason is required");
      return;
    }
    if (action === "approve" && needsResponsiblePerson && !responsiblePersonId) {
      setError("Please select a Responsible Person before approving.");
      return;
    }
    if (action === "approve" && ptwEvidence && !evidenceReady) {
      setError("Field evidence is required: GPS fix, signature" + (ptwEvidence.requirePhoto ? " and an onsite photo." : "."));
      return;
    }
    setBusy(true);
    setError("");
    // Inject the picked responsible person into recordData so the engine
    // resolves the next ACTION_OWNER step to this user AND the API
    // persists it on the Observation.
    const augmentedRecordData = needsResponsiblePerson && responsiblePersonId
      ? { ...(recordData ?? {}), responsiblePersonId, actionOwnerId: responsiblePersonId }
      : recordData;
    const res = await fetch(`/api/workflow/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        comments: comments || undefined,
        reason: action === "reject" ? reason : undefined,
        recordData: augmentedRecordData,
        // PTW: evidence rides along on approve (mandatory) and reject
        // (best-effort — whatever the device could capture).
        evidence: ptwEvidence ? evidencePayload(evidenceState) : undefined
      })
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      // FastAPI returns errors as {detail}; legacy Node returned {error}.
      const e = await res.json().catch(() => ({}));
      setError(e.error ?? e.detail ?? `Action failed (${res.status})`);
      // A failed approve used to leave the panel button-less (mode stuck on
      // "approve") — return to idle so the user can fix the issue and retry.
      if (action === "approve") setMode("idle");
    }
  }

  return (
    <Card className="border-primary-300 ring-2 ring-primary-100">
      <CardHeader className="bg-primary-50 rounded-t-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-primary-900">⏳ Action Required</CardTitle>
              <span className={cn("chip text-xs", slaBadge.className)}>{slaBadge.label}</span>
            </div>
            <CardDescription className="text-primary-700">{task.stepName}</CardDescription>
          </div>
          {task.dueAt && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-primary-600">Due</div>
              <div className="text-xs text-primary-900 font-medium">{formatDateTime(task.dueAt)}</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {needsResponsiblePerson && (
          <div className="space-y-2">
            <Label>
              Responsible Person <span className="text-rose-600">*</span>
            </Label>
            <UserPicker
              value={responsiblePersonId}
              onChange={(id) => setResponsiblePersonId(id)}
              filter={{ plantId }}
              placeholder="Search and select the action owner"
              required
            />
            <p className="text-xs text-slate-500">
              They will receive the execution task once you approve this review.
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label>Comments {mode === "reject" && <span className="text-rose-600">*</span>}</Label>
          <Textarea
            rows={3}
            placeholder={mode === "reject" ? "Mandatory rejection reason..." : "Optional comments..."}
            value={mode === "reject" ? reason : comments}
            onChange={(e) => mode === "reject" ? setReason(e.target.value) : setComments(e.target.value)}
          />
        </div>

        {ptwEvidence && (
          <EvidenceCapture
            permitId={ptwEvidence.permitId}
            requirePhoto={ptwEvidence.requirePhoto}
            state={evidenceState}
          />
        )}

        {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</div>}

        <div className="flex flex-wrap gap-2">
          {mode === "idle" && (
            <>
              <Button
                onClick={() => { setMode("approve"); submit("approve"); }}
                disabled={busy || (!!ptwEvidence && !evidenceReady)}
                variant="success"
                title={ptwEvidence && !evidenceReady ? "Capture GPS, signature and photo first" : undefined}
              >
                <CheckCircle2 size={16} /> Approve
              </Button>
              <Button onClick={() => setMode("reject")} disabled={busy} variant="destructive">
                <XCircle size={16} /> Reject
              </Button>
              <Button onClick={() => setMode("reassign")} disabled={busy} variant="outline">
                <UserMinus size={16} /> Reassign
              </Button>
            </>
          )}
          {mode === "reject" && (
            <>
              <Button onClick={() => submit("reject")} disabled={busy || !reason.trim()} variant="destructive">
                {busy ? "Rejecting..." : "Confirm Reject"}
              </Button>
              <Button onClick={() => { setMode("idle"); setError(""); }} variant="outline">Cancel</Button>
            </>
          )}
          {mode === "approve" && busy && <span className="text-sm text-slate-500">Approving…</span>}
          {mode === "reassign" && (
            <ReassignDialog
              taskId={task.id}
              plantId={plantId}
              eligibleRoles={eligibleRoles}
              onClose={() => setMode("idle")}
              onDone={() => router.refresh()}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type PickableUser = {
  id: string;
  name: string;
  email: string;
  designation: string | null;
  department: string | null;
};

function ReassignDialog({
  taskId,
  plantId,
  eligibleRoles,
  onClose,
  onDone
}: {
  taskId: string;
  plantId?: string;
  eligibleRoles?: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [users, setUsers] = useState<PickableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toUserId, setToUserId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Load eligible users — filter by plant + the step's eligible roles
  // so the picker can't show someone who couldn't legally act on this
  // task (which would later 403 with "Missing permission" on click).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ excludeSelf: "true", take: "100" });
        if (plantId) params.set("plantId", plantId);
        for (const r of eligibleRoles ?? []) params.append("role", r);
        const r = await fetch(`/api/users?${params.toString()}`);
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setError(j.error ?? "Failed to load users");
          setUsers([]);
        } else {
          setUsers(Array.isArray(j.users) ? j.users : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Network error loading users");
          setUsers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [plantId, JSON.stringify(eligibleRoles ?? [])]);

  async function go() {
    if (!toUserId || !reason.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/workflow/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, toUserId, reason })
      });
      if (res.ok) {
        onDone();
        return;
      }
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? j.detail ?? "Reassign failed");
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full bg-slate-50 border rounded p-3 space-y-2">
      <Label>Reassign to</Label>
      <select
        value={toUserId}
        onChange={(e) => setToUserId(e.target.value)}
        className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        disabled={loading || users.length === 0}
      >
        <option value="">
          {loading
            ? "Loading users…"
            : users.length === 0
              ? eligibleRoles && eligibleRoles.length > 0
                ? `No eligible users (${eligibleRoles.join(" / ")}) at this plant`
                : "No users available"
              : "— Select user —"}
        </option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
            {u.designation ? ` — ${u.designation}` : ""}
            {u.department ? ` (${u.department})` : ""}
          </option>
        ))}
      </select>
      <Label>Reason</Label>
      <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why reassigning?" />
      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2 py-1.5 flex items-start gap-1.5">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={go} disabled={busy || loading || !toUserId || !reason.trim()}>
          {busy ? "Reassigning…" : "Reassign"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}

function computeSlaBadge(dueAt: Date | string | null | undefined) {
  if (!dueAt) return { label: "No SLA", className: "bg-slate-100 text-slate-600 border-slate-200" };
  const diff = daysBetween(new Date(), dueAt) * 24; // hours-ish via days*24
  const hoursLeft = (new Date(dueAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursLeft < 0) return { label: `Overdue by ${Math.abs(Math.round(hoursLeft))}h`, className: "bg-rose-100 text-rose-700 border-rose-200" };
  if (hoursLeft < 24) return { label: `${Math.round(hoursLeft)}h left`, className: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: `${Math.round(hoursLeft / 24)}d left`, className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
}
