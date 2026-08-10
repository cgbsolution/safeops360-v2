"use client";

// Opening / closing meeting records — ISO 19011 §6.4.2 and §6.4.9.
// docs/cams/09 §2.3.
//
// The rule that makes this worth building rather than faking: **the report
// renders from data or says nothing.** If no closing meeting was recorded, the
// report prints "No closing meeting was recorded" — it never asserts a meeting
// the product has no evidence of. So this form is the evidence, and an empty
// state here is an honest statement rather than a gap to paper over.
//
// Attendees are internal users OR free-text externals: buyer auditors,
// certification assessors and contractor reps attend these meetings and are not
// platform users. Designed for 390px first — this is filled in standing on a
// shop floor, not at a desk.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Plus,
  Trash2,
  Loader2,
  UserPlus,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { UserPicker } from "@/components/ui/user-picker";
import { readApiError } from "@/lib/client-errors";
import {
  fmtDateTime,
  type MeetingAttendee,
  type MeetingRecord,
  type MeetingsResponse,
} from "@/app/(dashboard)/cams/lib-assurance";

export function MeetingRecords({
  engagementKind = "AUDIT",
  engagementId,
  data,
  canRecord,
}: {
  engagementKind?: "AUDIT" | "INSPECTION";
  engagementId: string;
  data: MeetingsResponse | null;
  canRecord: boolean;
}) {
  const [editing, setEditing] = useState<"OPENING" | "CLOSING" | null>(null);

  return (
    <Card className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <CalendarCheck size={16} className="text-violet-700" />
        Meeting records
        <span className="text-xs font-normal text-slate-400">ISO 19011 §6.4</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MeetingCard
          record={data?.opening ?? { recorded: false, meetingType: "OPENING" }}
          label="Opening meeting"
          canRecord={canRecord}
          onEdit={() => setEditing("OPENING")}
        />
        <MeetingCard
          record={data?.closing ?? { recorded: false, meetingType: "CLOSING" }}
          label="Closing meeting"
          canRecord={canRecord}
          onEdit={() => setEditing("CLOSING")}
        />
      </div>

      {editing && (
        <MeetingForm
          engagementKind={engagementKind}
          engagementId={engagementId}
          meetingType={editing}
          existing={editing === "OPENING" ? data?.opening : data?.closing}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

function MeetingCard({
  record,
  label,
  canRecord,
  onEdit,
}: {
  record: MeetingRecord;
  label: string;
  canRecord: boolean;
  onEdit: () => void;
}) {
  if (!record.recorded) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <CircleDashed size={13} className="text-slate-400" />
          {label}
        </div>
        {/* Honest empty state — this exact sentence is what the report prints. */}
        <p className="mt-1 text-[12px] text-slate-500">No {label.toLowerCase()} was recorded.</p>
        {canRecord && (
          <Button type="button" size="sm" variant="outline" className="mt-2 h-7 text-[11px]" onClick={onEdit}>
            <Plus size={12} /> Record it
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
        <CheckCircle2 size={13} className="text-emerald-600" />
        {label}
        {canRecord && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto text-[11px] text-violet-700 hover:underline"
          >
            Edit
          </button>
        )}
      </div>
      <div className="mt-1 text-[12px] text-slate-600">{fmtDateTime(record.heldAt)}</div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {(record.attendees ?? []).slice(0, 6).map((a, i) => (
          <span
            key={i}
            className={cn(
              "rounded border px-1.5 py-0.5 text-[10px]",
              a.external
                ? "border-slate-300 bg-slate-100 text-slate-700"
                : "border-violet-200 bg-violet-50 text-violet-800",
            )}
            title={a.organisation ?? ""}
          >
            {a.name}
            {a.external && a.organisation ? ` · ${a.organisation}` : ""}
          </span>
        ))}
        {(record.attendeeCount ?? 0) > 6 && (
          <span className="text-[10px] text-slate-500">+{(record.attendeeCount ?? 0) - 6} more</span>
        )}
      </div>
      {record.addToCalendar && (
        <p className="mt-1.5 text-[11px] text-slate-600">
          On the audit&apos;s calendar
          {(record.unreachableCount ?? 0) > 0
            ? ` — except ${record.unreachableCount} external with no email address.`
            : "."}
        </p>
      )}
      {record.meetingType === "OPENING" && record.scopeConfirmed && (
        <p className="mt-1.5 text-[11px] text-emerald-700">Scope confirmed with the auditee.</p>
      )}
      {record.meetingType === "CLOSING" && (
        <p
          className={cn(
            "mt-1.5 text-[11px]",
            record.auditeeAcknowledged ? "text-emerald-700" : "text-amber-700",
          )}
        >
          {record.auditeeAcknowledged
            ? `Findings acknowledged by ${record.auditeeAcknowledgedBy ?? "the auditee"}.`
            : "Auditee acknowledgement not recorded."}
        </p>
      )}
    </div>
  );
}

function MeetingForm({
  engagementKind,
  engagementId,
  meetingType,
  existing,
  onClose,
}: {
  engagementKind: "AUDIT" | "INSPECTION";
  engagementId: string;
  meetingType: "OPENING" | "CLOSING";
  existing?: MeetingRecord;
  onClose: () => void;
}) {
  const router = useRouter();
  const [heldAt, setHeldAt] = useState(() =>
    existing?.heldAt ? existing.heldAt.slice(0, 16) : new Date().toISOString().slice(0, 16),
  );
  const [attendees, setAttendees] = useState<MeetingAttendee[]>(existing?.attendees ?? []);
  const [scopeConfirmed, setScopeConfirmed] = useState(!!existing?.scopeConfirmed);
  const [summary, setSummary] = useState(existing?.findingsSummaryPresented ?? "");
  const [acknowledged, setAcknowledged] = useState(!!existing?.auditeeAcknowledged);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [extName, setExtName] = useState("");
  const [extOrg, setExtOrg] = useState("");
  const [extEmail, setExtEmail] = useState("");
  // Ticked by default on a NEW record: someone who has just typed a list of
  // people almost always wants those people on the closing invitation. An
  // existing record keeps whatever was decided when it was saved.
  const [addToCalendar, setAddToCalendar] = useState(existing?.addToCalendar ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function addInternal(userId: string | null, user: { name?: string } | null) {
    if (!userId || attendees.some((a) => a.userId === userId)) return;
    setAttendees((prev) => [...prev, { userId, name: user?.name ?? userId }]);
  }
  function addExternal() {
    const n = extName.trim();
    if (!n) return;
    setAttendees((prev) => [
      ...prev,
      {
        name: n,
        organisation: extOrg.trim() || "External",
        email: extEmail.trim() || undefined,
        external: true,
      },
    ]);
    setExtName("");
    setExtOrg("");
    setExtEmail("");
  }

  // Externals with no address. They are a legitimate minute entry — a contractor
  // rep with no email still attended — so this informs rather than blocks.
  const unreachable = attendees.filter((a) => a.external && !a.email);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/assurance/meetings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        engagementKind,
        engagementId,
        meetingType,
        heldAt: new Date(heldAt).toISOString(),
        attendees,
        scopeConfirmed,
        findingsSummaryPresented: meetingType === "CLOSING" ? summary : null,
        auditeeAcknowledged: meetingType === "CLOSING" ? acknowledged : false,
        notes,
        addToCalendar,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await readApiError(res, "Could not save the meeting record"));
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <h3 className="text-sm font-semibold text-slate-900">
          {meetingType === "OPENING" ? "Opening" : "Closing"} meeting record
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Captured as data, then rendered into the audit report. Nothing is asserted in the report
          that is not recorded here.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="held-at" className="text-xs">
              Date &amp; time <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="held-at"
              type="datetime-local"
              value={heldAt}
              onChange={(e) => setHeldAt(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">
              Attendees <span className="text-rose-600">*</span>
            </Label>
            <div className="mt-1">
              <UserPicker value={null} onChange={addInternal} placeholder="Add a colleague…" />
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <Input
                value={extName}
                onChange={(e) => setExtName(e.target.value)}
                placeholder="External attendee name"
                className="h-8 flex-1 min-w-[9rem] text-xs"
              />
              <Input
                value={extOrg}
                onChange={(e) => setExtOrg(e.target.value)}
                placeholder="Organisation"
                className="h-8 w-32 text-xs"
              />
              {/* Optional — an external with no address is still a valid minute
                  entry, so this cannot be required. It is what decides whether
                  they can be put on the calendar. */}
              <Input
                value={extEmail}
                onChange={(e) => setExtEmail(e.target.value)}
                type="email"
                inputMode="email"
                placeholder="Email (for the invite)"
                className="h-8 w-44 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={addExternal}
                disabled={!extName.trim()}
              >
                <UserPlus size={13} />
              </Button>
            </div>

            {attendees.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attendees.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs"
                  >
                    <span className="truncate">
                      {a.name}
                      {a.organisation ? (
                        <span className="text-slate-500"> · {a.organisation}</span>
                      ) : null}
                      {a.external && !a.email ? (
                        <span className="text-amber-700"> · no email</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="ml-auto text-slate-400 hover:text-rose-600"
                      onClick={() => setAttendees((p) => p.filter((_, j) => j !== i))}
                      aria-label={`Remove ${a.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {attendees.length === 0 && (
              <p className="mt-1 text-[11px] text-slate-400">
                At least one attendee is required — a meeting record with no attendees is not a
                record.
              </p>
            )}
          </div>

          {/* The minute is the only place the department owners identified at the
              opening meeting are ever named. This is what puts them on the
              closing invitation — nothing in the audit team fields knows them. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={addToCalendar}
                onChange={(e) => setAddToCalendar(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Add these attendees to the audit&apos;s calendar.
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {meetingType === "OPENING"
                    ? "They are invited to the opening and closing meetings — not to the fieldwork block."
                    : "They are invited to the closing meeting."}{" "}
                  Anyone already on the audit team keeps the invitation they have.
                </span>
              </span>
            </label>
            {addToCalendar && unreachable.length > 0 && (
              <p className="mt-1.5 pl-6 text-[11px] text-amber-700">
                {unreachable.length} external attendee{unreachable.length > 1 ? "s have" : " has"} no
                email address — recorded in the minute, but no calendar invitation can be sent.
              </p>
            )}
          </div>

          {meetingType === "OPENING" ? (
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={scopeConfirmed}
                onChange={(e) => setScopeConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              Audit scope, criteria and method were confirmed with the auditee.
            </label>
          ) : (
            <>
              <div>
                <Label htmlFor="summary" className="text-xs">
                  Findings summary presented
                </Label>
                <Textarea
                  id="summary"
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="What was presented to the auditee at closing…"
                  className="mt-1"
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5"
                />
                The auditee acknowledged the findings presented.
              </label>
            </>
          )}

          <div>
            <Label htmlFor="notes" className="text-xs">
              Notes
            </Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {err}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={submit} disabled={busy || attendees.length === 0}>
            {busy && <Loader2 size={14} className="animate-spin" />} Save record
          </Button>
        </div>
      </div>
    </div>
  );
}
