"use client";

// CAPA plan section. Replaces the legacy single-CAPA edit panel with a
// list of NearMissCapa rows + per-CAPA actions:
//   • HSE Manager / Admin (during step 3 review meeting): add new CAPA
//   • CAPA owner: submit completion (notes + evidence URL/description)
//   • Verifier (HSE Manager during step 5): approve or reject single CAPA
//
// Engine-side CAPA_FAN_OUT picks up these rows when the workflow advances
// past step 3 — see workflow_engine._create_tasks_for_step.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserPicker } from "@/components/ui/user-picker";
import {
  CheckCircle2, XCircle, Plus, AlertCircle, Loader2, ClipboardList, UserPlus
} from "lucide-react";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import { toDateInputValue, toTargetIso, todayInAppZone } from "@/lib/near-miss/target-date";

type Capa = {
  id: string;
  description: string;
  type: "CORRECTIVE" | "PREVENTIVE";
  ownerId: string | null;
  targetDate: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE" | "VERIFIED" | "REJECTED";
  evidenceUrl: string | null;
  evidenceDescription: string | null;
  completionNotes: string | null;
  completedAt: string | null;
  verifiedById: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  reworkRound: number;
  createdAt: string;
};

const STATUS_BADGE: Record<Capa["status"], string> = {
  PENDING: "bg-slate-100 text-slate-700 border-slate-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
  COMPLETED: "bg-blue-100 text-blue-800 border-blue-200",
  OVERDUE: "bg-rose-100 text-rose-800 border-rose-200",
  VERIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-100 text-rose-900 border-rose-300"
};

export function CapaPlanSection({
  nearMissId,
  plantId,
  currentUserId,
  canDefine,
  canVerify
}: {
  nearMissId: string;
  plantId: string;
  currentUserId: string;
  /** True for HSE Manager / Admin while the workflow is at the CAPA Definition step. */
  canDefine: boolean;
  /** True for the verifier (HSE Manager during step 5). */
  canVerify: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Capa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/near-miss/${nearMissId}/capas`);
      const j = await r.json();
      setItems(r.ok ? (j.items ?? []) : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [nearMissId]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ClipboardList size={16} /> CAPA Plan ({items.length})
        </CardTitle>
        {canDefine && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd((v) => !v)}>
            <Plus size={13} /> {showAdd ? "Close" : "Add CAPA"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && canDefine && (
          <AddCapaForm nearMissId={nearMissId} plantId={plantId} onAdded={() => { setShowAdd(false); void load(); router.refresh(); }} />
        )}
        {loading && <div className="text-sm text-slate-500 py-2">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="text-sm text-slate-500 py-4 text-center">
            No CAPAs defined yet.
            {canDefine && <> Use <strong>Add CAPA</strong> above to define corrective and preventive actions.</>}
          </div>
        )}
        {items.map((c) => (
          <CapaRow
            key={c.id}
            capa={c}
            nearMissId={nearMissId}
            plantId={plantId}
            currentUserId={currentUserId}
            canVerify={canVerify}
            canAssign={canDefine}
            onChanged={() => { void load(); router.refresh(); }}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function AddCapaForm({
  nearMissId,
  plantId,
  onAdded
}: {
  nearMissId: string;
  plantId: string;
  onAdded: () => void;
}) {
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"CORRECTIVE" | "PREVENTIVE">("CORRECTIVE");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    if (!description.trim() || !ownerId || !targetDate) {
      setErr("Description, owner, and target date are required");
      return;
    }
    setBusy(true);
    setErr("");
    const r = await fetch(`/api/near-miss/${nearMissId}/capas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, type, ownerId, targetDate: new Date(targetDate).toISOString() })
    });
    setBusy(false);
    if (r.ok) {
      setDescription(""); setOwnerId(null); setTargetDate("");
      onAdded();
    } else {
      const j = await r.json().catch(() => ({}));
      setErr(j.error ?? j.detail ?? "Failed");
    }
  }

  return (
    <div className="rounded-md border bg-slate-50 p-3 space-y-2">
      <div>
        <Label>Description</Label>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What needs to happen?" />
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <div>
          <Label>Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="CORRECTIVE">Corrective</option>
            <option value="PREVENTIVE">Preventive</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Owner</Label>
          <UserPicker value={ownerId} onChange={setOwnerId} filter={{ plantId }} placeholder="Search..." />
        </div>
      </div>
      <div>
        <Label>Target date</Label>
        <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      </div>
      {err && <div className="text-xs text-rose-700">{err}</div>}
      <Button size="sm" onClick={go} disabled={busy}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add CAPA
      </Button>
    </div>
  );
}

function CapaRow({
  capa,
  nearMissId,
  plantId,
  currentUserId,
  canVerify,
  canAssign,
  onChanged
}: {
  capa: Capa;
  nearMissId: string;
  plantId: string;
  currentUserId: string;
  canVerify: boolean;
  /** The Safety Officer holds this step — they name each CAPA's owner. */
  canAssign: boolean;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "submit" | "reject" | "assign">("idle");
  const [assignOwnerId, setAssignOwnerId] = useState<string | null>(capa.ownerId);
  // Read back in the display zone for the same reason it is written at noon
  // UTC — see lib/near-miss/target-date.
  const [assignTargetDate, setAssignTargetDate] = useState(toDateInputValue(capa.targetDate));
  const [completionNotes, setCompletionNotes] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const isOwner = capa.ownerId === currentUserId;
  const ownerCanSubmit = isOwner && (capa.status === "PENDING" || capa.status === "IN_PROGRESS" || capa.status === "REJECTED");
  const verifierCanAct = canVerify && capa.status === "COMPLETED";

  async function send(action: "ASSIGN" | "SUBMIT" | "VERIFY" | "REJECT", payload: Record<string, any>) {
    setBusy(true); setErr("");
    const r = await fetch(`/api/near-miss/${nearMissId}/capas/${capa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload })
    });
    setBusy(false);
    if (r.ok) { setMode("idle"); onChanged(); }
    else {
      const j = await r.json().catch(() => ({}));
      setErr(j.error ?? j.detail ?? "Failed");
    }
  }

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={STATUS_BADGE[capa.status]}>{capa.status}</Badge>
            <Badge className={cn("text-[10px]", capa.type === "PREVENTIVE" ? "bg-violet-100 text-violet-800 border-violet-200" : "bg-blue-100 text-blue-800 border-blue-200")}>
              {capa.type}
            </Badge>
            {capa.reworkRound > 0 && (
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                Rework #{capa.reworkRound}
              </Badge>
            )}
          </div>
          <div className="text-sm text-slate-900">{capa.description}</div>
          <div className="text-xs text-slate-500 mt-1">
            {/* A CAPA written on the report has neither until the Safety
                Officer assigns it, so say so rather than print an empty date. */}
            {capa.ownerId && capa.targetDate ? (
              <>Target: {formatDate(capa.targetDate)}</>
            ) : (
              <span className="text-amber-700">Awaiting owner &amp; target date</span>
            )}
            {capa.completedAt && <> · Submitted {formatDateTime(capa.completedAt)}</>}
            {capa.verifiedAt && <> · Verified {formatDateTime(capa.verifiedAt)}</>}
          </div>
          {capa.completionNotes && (
            <div className="mt-2 text-xs bg-slate-50 border rounded p-2 italic text-slate-700">
              "{capa.completionNotes}"
            </div>
          )}
          {capa.rejectionReason && capa.status === "REJECTED" && (
            <div className="mt-2 text-xs bg-rose-50 border border-rose-200 rounded p-2 text-rose-800">
              <strong>Rejection reason:</strong> {capa.rejectionReason}
            </div>
          )}
        </div>
      </div>

      {canAssign && mode === "idle" && (
        <Button size="sm" variant={capa.ownerId ? "outline" : "default"} onClick={() => setMode("assign")}>
          <UserPlus size={13} /> {capa.ownerId ? "Reassign" : "Assign owner"}
        </Button>
      )}
      {mode === "assign" && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/60 p-2">
          <div>
            <Label className="text-xs">Owner</Label>
            <UserPicker
              value={assignOwnerId}
              onChange={setAssignOwnerId}
              filter={{ plantId }}
              placeholder="Search and pick..."
            />
          </div>
          <div>
            <Label className="text-xs">Target date</Label>
            <Input
              type="date"
              value={assignTargetDate}
              min={todayInAppZone()}
              onChange={(e) => setAssignTargetDate(e.target.value)}
            />
          </div>
          {err && <p className="text-xs text-rose-700">{err}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !assignOwnerId || !assignTargetDate}
              onClick={() =>
                send("ASSIGN", {
                  ownerId: assignOwnerId,
                  targetDate: toTargetIso(assignTargetDate)
                })
              }
            >
              <CheckCircle2 size={13} /> Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode("idle")} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {ownerCanSubmit && mode === "idle" && (
        <Button size="sm" onClick={() => setMode("submit")}>
          <CheckCircle2 size={13} /> Submit completion
        </Button>
      )}
      {verifierCanAct && mode === "idle" && (
        <div className="flex gap-2">
          <Button size="sm" variant="success" onClick={() => send("VERIFY", {})} disabled={busy}>
            <CheckCircle2 size={13} /> Verify
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setMode("reject")}>
            <XCircle size={13} /> Reject (rework)
          </Button>
        </div>
      )}
      {mode === "submit" && (
        <div className="space-y-2 pt-2 border-t">
          <Textarea rows={2} placeholder="Action narrative — what was done?" value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} />
          <Input placeholder="Evidence URL (photo, doc, etc)" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} />
          <Textarea rows={1} placeholder="Evidence description (optional)" value={evidenceDescription} onChange={(e) => setEvidenceDescription(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => send("SUBMIT", { completionNotes, evidenceUrl: evidenceUrl || null, evidenceDescription: evidenceDescription || null })} disabled={busy || !completionNotes.trim()}>
              Submit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode("idle")}>Cancel</Button>
          </div>
        </div>
      )}
      {mode === "reject" && (
        <div className="space-y-2 pt-2 border-t">
          <Textarea rows={2} placeholder="Why is this CAPA rejected?" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => send("REJECT", { rejectionReason })} disabled={busy || !rejectionReason.trim()}>
              Confirm reject
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode("idle")}>Cancel</Button>
          </div>
        </div>
      )}
      {err && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 flex items-start gap-1">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" /> {err}
        </div>
      )}
    </div>
  );
}
