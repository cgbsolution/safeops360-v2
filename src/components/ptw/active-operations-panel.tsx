"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertOctagon,
  Clock,
  FlaskConical,
  Loader2,
  Plus,
  Send,
  Timer,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { UserPicker } from "@/components/ui/user-picker";
import { readApiError } from "@/lib/client-errors";
import { cn, formatDateTime } from "@/lib/utils";
import {
  EvidenceCapture,
  evidenceComplete,
  evidencePayload,
  useEvidenceCapture,
} from "@/components/ptw/evidence-capture";

type GasParam = { parameter: string; lowLimit?: number; highLimit?: number; unit?: string };
type GasStatus = {
  hasGasPlan: boolean;
  refreshFrequencyMinutes?: number;
  parametersToTest?: GasParam[] | null;
  instrumentSerial?: string | null;
  lastReadingAt?: string | null;
  lastIsExceedance?: boolean;
  refreshDueBy?: string | null;
};

type CrewMember = {
  id: string;
  userId: string;
  role: string;
  removedAt: string | Date | null;
  user: { id: string; name: string; designation?: string | null };
};

type Extension = {
  id: string;
  newValidTo: string | Date;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approverComments?: string | null;
};

export function ActiveOperationsPanel({
  permitId,
  plantId,
  status,
  validTo,
  type,
  workCrew,
  extensions,
  canAct,
}: {
  permitId: string;
  plantId: string;
  status: string;
  validTo: string | Date;
  type: string;
  workCrew: CrewMember[];
  extensions: Extension[];
  canAct: boolean;
}) {
  if (status !== "ACTIVE" && status !== "SUSPENDED") return null;

  const requiresGasTest = type === "HOT_WORK" || type === "CONFINED_SPACE";

  return (
    <div className="space-y-4">
      <ValidityCountdown validTo={validTo} status={status} />
      {requiresGasTest && (
        <GasTestSection permitId={permitId} active={status === "ACTIVE"} />
      )}
      <ExtensionSection
        permitId={permitId}
        validTo={validTo}
        extensions={extensions}
        canAct={canAct}
      />
      <CrewChangeSection permitId={permitId} plantId={plantId} crew={workCrew} canAct={canAct} />
    </div>
  );
}

// ─── Validity countdown ───────────────────────────────────────────────

function ValidityCountdown({ validTo, status }: { validTo: string | Date; status: string }) {
  const target = new Date(validTo).getTime();
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = target - now;
  const expired = remaining <= 0;
  const hours = Math.floor(Math.abs(remaining) / 3_600_000);
  const minutes = Math.floor((Math.abs(remaining) % 3_600_000) / 60_000);
  const seconds = Math.floor((Math.abs(remaining) % 60_000) / 1_000);

  const isWarn = !expired && remaining < 30 * 60_000;

  return (
    <Card
      className={[
        "border-2",
        expired
          ? "border-rose-300 bg-rose-50"
          : isWarn
          ? "border-amber-300 bg-amber-50"
          : "border-emerald-200 bg-emerald-50",
      ].join(" ")}
    >
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Timer
            size={28}
            className={
              expired ? "text-rose-700" : isWarn ? "text-amber-700" : "text-emerald-700"
            }
          />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              {expired ? "Permit expired" : "Time remaining"}
            </div>
            <div
              className={[
                "font-mono text-2xl font-semibold tabular-nums",
                expired
                  ? "text-rose-800"
                  : isWarn
                  ? "text-amber-800"
                  : "text-emerald-800",
              ].join(" ")}
            >
              {expired ? "-" : ""}
              {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-500">Valid till</div>
          <div className="text-sm font-medium text-slate-800">
            {formatDateTime(new Date(validTo))}
          </div>
          {status === "SUSPENDED" && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 mt-1 text-[10px]">
              Currently suspended
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Gas test section ─────────────────────────────────────────────────

function GasTestSection({ permitId, active }: { permitId: string; active: boolean }) {
  const [status, setStatus] = useState<GasStatus | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [instrument, setInstrument] = useState("");
  const router = useRouter();

  async function reload() {
    const r = await fetch(`/api/ptw/${permitId}/gas-test/status`);
    if (r.ok) setStatus(await r.json());
  }
  useEffect(() => {
    reload();
  }, [permitId]);

  const refreshDue = status?.refreshDueBy ? new Date(status.refreshDueBy).getTime() : null;
  const overdue = refreshDue !== null && refreshDue < Date.now();

  async function submit() {
    if (!status?.parametersToTest) return;
    const readings = status.parametersToTest
      .map((p) => ({
        parameter: p.parameter,
        value: parseFloat(values[p.parameter] || ""),
      }))
      .filter((r) => !Number.isNaN(r.value));
    if (readings.length !== (status.parametersToTest?.length ?? 0)) {
      setError("Enter a numeric value for every parameter.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch(`/api/ptw/${permitId}/gas-test/reading`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readings,
          instrumentSerial: instrument || status?.instrumentSerial || null,
          isPreEntry: !status?.lastReadingAt,
        }),
      });
      if (r.ok) {
        setShowForm(false);
        setValues({});
        await reload();
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Failed to save reading"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!status?.hasGasPlan) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical size={16} /> Gas Test Refresh
        </CardTitle>
        <CardDescription className="text-xs">
          Refresh every {status.refreshFrequencyMinutes} min while crew is in the area.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-2 text-xs">
          <Card className="rounded-md bg-slate-50 p-2 shadow-none">
            <div className="text-[10px] uppercase text-slate-500">Last reading</div>
            <div className="font-medium">
              {status.lastReadingAt
                ? formatDateTime(new Date(status.lastReadingAt))
                : "— none yet —"}
            </div>
          </Card>
          <Card
            className={cn(
              "rounded-md p-2 shadow-none",
              overdue ? "border-rose-200 bg-rose-50" : "bg-slate-50"
            )}
          >
            <div className="text-[10px] uppercase text-slate-500">Next due</div>
            <div className="font-medium">
              {status.refreshDueBy
                ? formatDateTime(new Date(status.refreshDueBy))
                : "—"}
            </div>
            {overdue && (
              <div className="text-[10px] text-rose-700 mt-0.5 flex items-center gap-1">
                <Clock size={10} /> Overdue
              </div>
            )}
          </Card>
          <Card className="rounded-md bg-slate-50 p-2 shadow-none">
            <div className="text-[10px] uppercase text-slate-500">Instrument</div>
            <div className="font-medium">{status.instrumentSerial ?? "—"}</div>
          </Card>
        </div>

        {status.lastIsExceedance && (
          <Alert variant="destructive" className="p-2">
            <AlertOctagon className="mt-0.5" />
            <AlertDescription>
              Last reading was an exceedance. Permit auto-suspended pending re-FLRA.
            </AlertDescription>
          </Alert>
        )}

        {!showForm && active && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Record Reading
          </Button>
        )}

        {showForm && (
          <Card className="space-y-2 rounded-md border-slate-200 bg-slate-50 p-3 shadow-none">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(status.parametersToTest ?? []).map((p) => (
                <div key={p.parameter} className="space-y-1">
                  <Label className="text-[11px]">
                    {p.parameter} {p.unit ? `(${p.unit})` : ""}
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={values[p.parameter] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [p.parameter]: e.target.value }))
                    }
                    placeholder={
                      p.lowLimit !== undefined && p.highLimit !== undefined
                        ? `${p.lowLimit}–${p.highLimit}`
                        : ""
                    }
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Instrument serial</Label>
              <Input
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                placeholder={status.instrumentSerial ?? "Defaults to plan instrument"}
              />
            </div>
            {error && <div className="text-xs text-rose-700">{error}</div>}
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Save Reading
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Extension section ────────────────────────────────────────────────

function ExtensionSection({
  permitId,
  validTo,
  extensions,
  canAct,
}: {
  permitId: string;
  validTo: string | Date;
  extensions: Extension[];
  canAct: boolean;
}) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  // Closed-loop rebuild: extension request + decision are lifecycle actions —
  // GPS + signature evidence required (photo optional).
  const evidenceState = useEvidenceCapture();
  const evidenceReady = evidenceComplete(evidenceState, {
    requirePhoto: false,
    requireDeclaration: false,
  });

  const pending = extensions.filter((e) => e.status === "PENDING");

  async function request() {
    setBusy(true);
    setError("");
    try {
      const isoTo = new Date(`${newDate}T${newTime || "23:59"}:00`).toISOString();
      const r = await fetch(`/api/ptw/${permitId}/active/extension`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newValidTo: isoTo, reason, evidence: evidencePayload(evidenceState) }),
      });
      if (r.ok) {
        setShow(false);
        setReason("");
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Failed to request extension"));
    } finally {
      setBusy(false);
    }
  }

  async function decide(extId: string, d: "APPROVED" | "REJECTED") {
    setBusy(true);
    try {
      const r = await fetch(`/api/ptw/${permitId}/active/extension/${extId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: d, evidence: evidencePayload(evidenceState) }),
      });
      if (r.ok) {
        setDecidingId(null);
        router.refresh();
      } else setError(await readApiError(r, "Failed to decide extension"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock size={16} /> Extensions
        </CardTitle>
        <CardDescription className="text-xs">
          Current validity ends {formatDateTime(new Date(validTo))}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {extensions.length > 0 ? (
          <div className="space-y-1.5">
            {extensions.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md border border-slate-200 bg-white text-xs"
              >
                <div>
                  <div className="font-medium">
                    Until {formatDateTime(new Date(e.newValidTo))}
                  </div>
                  <div className="text-slate-600 truncate max-w-md">{e.reason}</div>
                </div>
                {e.status === "PENDING" && canAct ? (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => { setDecision("APPROVED"); setDecidingId(e.id); }}
                      disabled={busy}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setDecision("REJECTED"); setDecidingId(e.id); }}
                      disabled={busy}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  <Badge
                    className={
                      e.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"
                        : e.status === "REJECTED"
                        ? "bg-rose-100 text-rose-700 border-rose-200 text-[10px]"
                        : "bg-amber-100 text-amber-700 border-amber-200 text-[10px]"
                    }
                  >
                    {e.status}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500">No extension requests yet.</div>
        )}

        {decidingId && (
          <Card className="space-y-2 rounded-md border-slate-200 bg-slate-50 p-3 shadow-none">
            <div className="text-xs font-medium text-slate-700">
              {decision === "APPROVED" ? "Approve" : "Reject"} this extension —
              field evidence is recorded on the permit's audit trail.
            </div>
            <EvidenceCapture permitId={permitId} requirePhoto={false} state={evidenceState} />
            {error && <div className="text-xs text-rose-700">{error}</div>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => decide(decidingId, decision)} disabled={busy || !evidenceReady}>
                Confirm {decision === "APPROVED" ? "Approval" : "Rejection"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDecidingId(null)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {!show && !decidingId && pending.length === 0 && (
          <Button size="sm" variant="outline" onClick={() => setShow(true)}>
            <Plus size={14} /> Request Extension
          </Button>
        )}

        {show && (
          <Card className="space-y-2 rounded-md border-slate-200 bg-slate-50 p-3 shadow-none">
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">New end date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[11px]">New end time</Label>
                <Input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px]">Reason *</Label>
              <Textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why does this permit need more time?"
              />
            </div>
            <EvidenceCapture permitId={permitId} requirePhoto={false} state={evidenceState} />
            {error && <div className="text-xs text-rose-700">{error}</div>}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={request}
                disabled={busy || !newDate || reason.length < 5 || !evidenceReady}
              >
                Submit Request
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
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Crew change section ──────────────────────────────────────────────

function CrewChangeSection({
  permitId,
  plantId,
  crew,
  canAct,
}: {
  permitId: string;
  plantId: string;
  crew: CrewMember[];
  canAct: boolean;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [pickedUser, setPickedUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const active = crew.filter((c) => !c.removedAt);
  const removed = crew.filter((c) => !!c.removedAt);

  async function add() {
    if (!pickedUser) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/ptw/${permitId}/active/crew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: pickedUser, role: "WORKER" }),
      });
      if (r.ok) {
        setShowAdd(false);
        setPickedUser(null);
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Failed to add crew"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(crewId: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/ptw/${permitId}/active/crew/${crewId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: removeReason || "Removed mid-permit" }),
      });
      if (r.ok) {
        setRemoving(null);
        setRemoveReason("");
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Failed to remove crew"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus size={16} /> Crew on Site
        </CardTitle>
        <CardDescription className="text-xs">
          Adding or removing crew mid-permit suspends the permit and forces a re-FLRA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {active.length === 0 && (
          <div className="text-xs text-slate-500">No active crew.</div>
        )}
        {active.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between p-2 rounded-md border border-slate-200 bg-white text-xs"
          >
            <div>
              <div className="font-medium">{c.user.name}</div>
              <div className="text-slate-500">
                {c.role} {c.user.designation ? `· ${c.user.designation}` : ""}
              </div>
            </div>
            {canAct && removing !== c.id && (
              <Button size="sm" variant="outline" onClick={() => setRemoving(c.id)}>
                <UserMinus size={12} /> Remove
              </Button>
            )}
            {removing === c.id && (
              <div className="flex items-center gap-1">
                <Input
                  className="w-40 text-xs"
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                  placeholder="Reason"
                />
                <Button size="sm" onClick={() => remove(c.id)} disabled={busy}>
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRemoving(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ))}

        {removed.length > 0 && (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer">
              {removed.length} previously removed
            </summary>
            <ul className="space-y-1 mt-1">
              {removed.map((c) => (
                <li key={c.id} className="text-slate-500">
                  {c.user.name} — removed (line-through)
                </li>
              ))}
            </ul>
          </details>
        )}

        {canAct && !showAdd && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <UserPlus size={12} /> Add Crew
          </Button>
        )}

        {showAdd && (
          <Card className="space-y-2 rounded-md border-slate-200 bg-slate-50 p-3 shadow-none">
            <UserPicker
              value={pickedUser}
              onChange={(id) => setPickedUser(id)}
              filter={{ plantId: plantId || undefined }}
              placeholder="Search and add"
            />
            {error && <div className="text-xs text-rose-700">{error}</div>}
            <div className="flex gap-2">
              <Button size="sm" onClick={add} disabled={busy || !pickedUser}>
                Add
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowAdd(false);
                  setPickedUser(null);
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
