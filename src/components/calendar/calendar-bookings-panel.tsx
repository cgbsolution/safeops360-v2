"use client";

// Calendar bookings — whose time this audit is actually holding.
//
// The question this panel exists to answer is not "did we send some invites".
// It is "is this audit in the right people's calendars, and if not, why not".
// So every state is stated in the participant's terms — "in their calendars",
// "not delivered yet", "could not be delivered" — and a failure shows the
// provider's own message rather than a generic red badge that leaves the
// scheduler with nothing to act on.
//
// Empty is a legitimate state and says so. An audit created before this feature
// existed has no bookings, and the panel offers to make them rather than
// implying something broke.
//
// Reschedule is available on the meetings and NOT on the fieldwork block: the
// block's time is derived from the audit's own scheduled date and duration, and
// letting it be edited from here would give the schedule two owners that could
// disagree. The panel says that in words rather than just disabling a control.
//
// Scheduling an audit books the FIELDWORK BLOCK only. The opening and closing
// meetings appear here once someone records them, because that is when their
// time and their attendees are actually known — so a panel showing one booking
// is the normal state of a freshly scheduled audit, not a half-finished one.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck, CalendarClock, CalendarX, AlertTriangle, Loader2, RefreshCw,
  Video, Users2, Clock, Info, X, Pencil, DoorOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  BOOKING_LABEL, ROLE_LABEL, ROOM_STATUS_CHIP, ROOM_STATUS_LABEL, STATUS_CHIP,
  STATUS_LABEL, fmtDateTime, fmtTimeRange, toLocalInput,
  type BookingsResponse, type CalendarBooking, type MeetingRoom, type RoomsResponse,
} from "@/app/(dashboard)/cams/lib-calendar";

const TYPE_ICON = {
  OPENING_MEETING: CalendarClock,
  AUDIT_BLOCK: CalendarCheck,
  CLOSING_MEETING: CalendarX,
} as const;

export function CalendarBookingsPanel({
  engagementKind = "AUDIT",
  engagementId,
  data,
  canManage = false,
  locked = false,
}: {
  engagementKind?: "AUDIT" | "INSPECTION";
  engagementId: string;
  data: BookingsResponse | null;
  /** CAMS.SCHEDULE — may sync, reschedule a meeting, withdraw a booking. */
  canManage?: boolean;
  /** Closed or cancelled: the record stays readable, the actions go away. */
  locked?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const bookings = data?.bookings ?? [];
  const provider = data?.provider ?? "NONE";

  // The room directory is fetched once, on first use, and shared by every row.
  // Loading it with the page would cost a Graph round trip on every audit
  // screen for a control most visits never touch.
  const [rooms, setRooms] = useState<RoomsResponse | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(false);
  async function loadRooms() {
    if (rooms || roomsLoading) return;
    setRoomsLoading(true);
    try {
      const res = await fetch("/api/calendar/rooms");
      setRooms(res.ok ? await res.json() : { rooms: [], total: 0, provider, error: "Could not load rooms", statement: "Could not load the room list." });
    } catch {
      setRooms({ rooms: [], total: 0, provider, error: "Could not load rooms", statement: "Could not load the room list." });
    } finally {
      setRoomsLoading(false);
    }
  }

  async function sync(force: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/calendar/bookings/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementKind, engagementId, force }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: "error",
          title: "Couldn't book calendars",
          description: j.detail || j.error || "Please try again.",
        });
        return;
      }
      const added = j.attendeesAdded ?? 0;
      const outcomes: string[] = Object.values(j.results ?? {});
      const booked = outcomes.filter((o) => o === "booked").length;
      const failed = outcomes.filter((o) => o === "failed").length;
      const skipped = outcomes.filter((o) => o === "skipped").length;
      toast({
        variant: failed ? "error" : "success",
        title: failed
          ? `${failed} booking(s) could not be delivered`
          : booked
            ? `${booked} booking(s) sent`
            : skipped
              ? "Nothing was sent"
              : "Calendars already up to date",
        description: failed
          ? "They will be retried automatically. See the panel for the reason."
          : skipped
            ? "No calendar channel is configured, or no participant has an email address."
            : added
              ? `${added} participant(s) newly invited.`
              : "No changes were needed, so nobody was re-invited.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancelBooking(b: CalendarBooking) {
    if (
      !confirm(
        `Withdraw "${BOOKING_LABEL[b.bookingType]}" from ${b.attendeeCount} calendar(s)?\n\n` +
          "Participants receive a cancellation notice and the time is released.",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/calendar/bookings/${b.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Withdrawn from SafeOps360." }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "error", title: "Couldn't withdraw", description: j.detail || "Please try again." });
        return;
      }
      toast({ variant: "success", title: "Withdrawn", description: "The time has been released." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // ── Nothing booked yet ────────────────────────────────────────────
  if (!data || bookings.length === 0) {
    return (
      <Card className="rounded-xl border border-slate-200 p-4">
        <Header provider={provider} />
        <p className="mt-2 text-xs text-slate-500">
          {data
            ? "Nothing is in anyone's calendar for this audit yet."
            : "Calendar bookings are unavailable — the feature may not be installed on this deployment yet."}
        </p>
        {data && canManage && !locked && (
          <>
            <p className="mt-1 text-[11px] text-slate-400">
              Audits created before calendar booking was enabled are not booked automatically.
            </p>
            <Button type="button" size="sm" className="mt-3" disabled={busy} onClick={() => sync(false)}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CalendarCheck size={14} />}
              Book calendars
            </Button>
          </>
        )}
      </Card>
    );
  }

  const failed = data.failedCount;

  return (
    <Card className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Header provider={provider} />
        {canManage && !locked && (
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => sync(false)}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Sync
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => sync(true)}
              title="Re-send every invitation, even where nothing changed. Use when someone has deleted the meeting out of their own calendar."
            >
              Re-send all
            </Button>
          </div>
        )}
      </div>

      <p className={cn("mt-1.5 text-[11px]", failed ? "text-rose-700" : "text-slate-500")}>
        {data.statement}
      </p>

      {provider === "NONE" && (
        <div className="mt-2.5 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
          <Info size={14} className="mt-px shrink-0" />
          <span>
            No calendar channel is configured, so these bookings are recorded but nothing has been
            sent. Configure SMTP to email calendar invitations, or Microsoft Graph credentials to
            write directly into Microsoft 365 calendars with a Teams link.
          </span>
        </div>
      )}
      {provider === "ICS" && (
        <div className="mt-2.5 flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600">
          <Info size={14} className="mt-px shrink-0" />
          <span>
            Sent as calendar invitations by email. The time is held once each participant accepts.
            Add Microsoft Graph credentials to book calendars directly and attach Teams links.
          </span>
        </div>
      )}

      <div className="mt-3 space-y-2.5">
        {bookings.map((b) => (
          <BookingRow
            key={b.id}
            booking={b}
            canManage={canManage && !locked}
            busy={busy}
            onCancel={() => cancelBooking(b)}
            onRescheduled={() => router.refresh()}
            setBusy={setBusy}
            rooms={rooms}
            roomsLoading={roomsLoading}
            onNeedRooms={loadRooms}
          />
        ))}
      </div>
    </Card>
  );
}

function Header({ provider }: { provider: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
      <CalendarCheck size={16} className="text-primary-700" />
      Calendar bookings
      <span className="text-xs font-normal text-slate-400">
        {provider === "GRAPH"
          ? "Microsoft 365"
          : provider === "ICS"
            ? "Email invitations"
            : "Not configured"}
      </span>
    </div>
  );
}

function BookingRow({
  booking: b, canManage, busy, onCancel, onRescheduled, setBusy,
  rooms, roomsLoading, onNeedRooms,
}: {
  booking: CalendarBooking;
  canManage: boolean;
  busy: boolean;
  onCancel: () => void;
  onRescheduled: () => void;
  setBusy: (v: boolean) => void;
  rooms: RoomsResponse | null;
  roomsLoading: boolean;
  onNeedRooms: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [pickingRoom, setPickingRoom] = useState(false);
  const [start, setStart] = useState(() => toLocalInput(b.startAt));
  const [end, setEnd] = useState(() => toLocalInput(b.endAt));

  async function saveRoom(room: MeetingRoom | null) {
    setBusy(true);
    try {
      const res = await fetch(`/api/calendar/bookings/${b.id}/room`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomEmail: room?.email ?? null, roomName: room?.name ?? null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "error", title: "Couldn't book the room", description: j.detail || "Please try again." });
        return;
      }
      toast({
        variant: "success",
        title: room ? `${room.name} requested` : "Room released",
        // Deliberately not "booked": the room has not answered yet, and saying
        // it has is exactly the false confidence this panel exists to avoid.
        description: room
          ? "The room will confirm or decline shortly — the panel updates when it does."
          : "This meeting no longer holds a room.",
      });
      setPickingRoom(false);
      onRescheduled();
    } finally {
      setBusy(false);
    }
  }
  const Icon = TYPE_ICON[b.bookingType] ?? CalendarCheck;
  const isBlock = b.bookingType === "AUDIT_BLOCK";
  const cancelled = b.status === "CANCELLED";

  async function save() {
    if (!start || !end) return;
    if (new Date(end) <= new Date(start)) {
      toast({ variant: "error", title: "Invalid times", description: "The meeting must end after it starts." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/calendar/bookings/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: new Date(start).toISOString(),
          endAt: new Date(end).toISOString(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "error", title: "Couldn't reschedule", description: j.detail || "Please try again." });
        return;
      }
      toast({
        variant: "success",
        title: "Meeting moved",
        description: "Everyone invited receives the updated time.",
      });
      setEditing(false);
      onRescheduled();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5",
        cancelled ? "border-slate-200 bg-slate-50/60" : "border-slate-100 bg-white",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Icon size={14} className={cancelled ? "text-slate-400" : "text-slate-500"} />
        <span
          className={cn(
            "text-[13px] font-medium",
            cancelled ? "text-slate-500 line-through" : "text-slate-800",
          )}
        >
          {BOOKING_LABEL[b.bookingType] ?? b.bookingType}
        </span>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px] font-medium",
            STATUS_CHIP[b.status],
          )}
        >
          {STATUS_LABEL[b.status] ?? b.status}
        </span>
        {b.onlineMeetingUrl && !cancelled && (
          <a
            href={b.onlineMeetingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-800 hover:bg-primary-100"
          >
            <Video size={11} /> Teams
          </a>
        )}
        {canManage && !cancelled && (
          <div className="ml-auto flex items-center gap-1">
            {!isBlock && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing((v) => !v)}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <Pencil size={11} /> Move
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => { onNeedRooms(); setPickingRoom((v) => !v); }}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <DoorOpen size={11} /> {b.roomEmail ? "Change room" : "Add room"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-rose-50 hover:text-rose-700"
            >
              <X size={11} /> Withdraw
            </button>
          </div>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Clock size={11} /> {fmtTimeRange(b.startAt, b.endAt)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users2 size={11} /> {b.attendeeCount} invited
        </span>
        {b.roomEmail && (
          <span
            title={b.roomEmail}
            className={cn(
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
              ROOM_STATUS_CHIP[b.roomStatus],
            )}
          >
            <DoorOpen size={11} /> {b.roomName || b.roomEmail}
            <span className="opacity-70">· {ROOM_STATUS_LABEL[b.roomStatus]}</span>
          </span>
        )}
        {b.lastSyncedAt && <span>delivered {fmtDateTime(b.lastSyncedAt)}</span>}
      </div>

      {editing && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-2">
          <label className="text-[11px] text-slate-500">
            Starts
            <Input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-0.5 h-8 text-xs"
            />
          </label>
          <label className="text-[11px] text-slate-500">
            Ends
            <Input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-0.5 h-8 text-xs"
            />
          </label>
          <Button type="button" size="sm" disabled={busy} onClick={save}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Save &amp; notify
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      )}

      {pickingRoom && (
        <div className="mt-2 rounded-lg bg-slate-50 p-2">
          {roomsLoading && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Loader2 size={12} className="animate-spin" /> Loading rooms…
            </p>
          )}
          {!roomsLoading && rooms && rooms.rooms.length === 0 && (
            <p className="text-[11px] text-slate-500">
              {rooms.statement}
              {rooms.provider !== "GRAPH" &&
                " Rooms can only be listed and held through Microsoft 365."}
            </p>
          )}
          {!roomsLoading && rooms && rooms.rooms.length > 0 && (
            <>
              <p className="mb-1.5 text-[11px] text-slate-500">
                The room decides for itself — if it is already taken it will decline, and the
                panel will say so.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rooms.rooms.map((room) => {
                  const current = room.email.toLowerCase() === (b.roomEmail ?? "").toLowerCase();
                  return (
                    <button
                      key={room.email}
                      type="button"
                      disabled={busy || current}
                      onClick={() => saveRoom(room)}
                      className={cn(
                        "rounded border px-2 py-1 text-[11px]",
                        current
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-700 hover:border-primary-300 hover:bg-primary-50",
                      )}
                    >
                      {room.name}
                      {room.capacity ? (
                        <span className="ml-1 text-slate-400">{room.capacity} seats</span>
                      ) : null}
                      {current && <span className="ml-1">· current</span>}
                    </button>
                  );
                })}
                {b.roomEmail && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveRoom(null)}
                    className="rounded border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-500 hover:bg-white"
                  >
                    No room
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Who, in which seat, and when their calendar was claimed. The last part
          is the answer to "when were the auditees added" — it is per person, so
          someone named a week after the audit was set shows their own date. */}
      {b.attendees.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {b.attendees.map((a) => (
            <li
              key={a.email}
              title={`${ROLE_LABEL[a.role] ?? a.role} · ${a.email}${
                a.addedAt ? ` · booked ${fmtDateTime(a.addedAt)}` : ""
              }`}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px]",
                a.required
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-dashed border-slate-200 bg-white text-slate-500",
              )}
            >
              {a.name}
              <span className="ml-1 text-slate-400">{ROLE_LABEL[a.role] ?? a.role}</span>
            </li>
          ))}
        </ul>
      )}

      {b.removedAttendees.length > 0 && (
        <p className="mt-1 text-[10px] text-slate-400">
          Withdrawn from: {b.removedAttendees.map((a) => a.name).join(", ")}
        </p>
      )}

      {/* The provider's own words. A scheduler can act on "mailbox not found";
          they cannot act on "delivery failed". */}
      {b.lastError && b.status !== "CANCELLED" && (
        <div className="mt-1.5 flex gap-1.5 rounded border border-rose-100 bg-rose-50 p-1.5 text-[10px] text-rose-800">
          <AlertTriangle size={11} className="mt-px shrink-0" />
          <span>
            {b.lastError}
            {b.status === "PENDING" && " — this will be retried automatically."}
          </span>
        </div>
      )}

      {isBlock && canManage && !cancelled && (
        <p className="mt-1 text-[10px] text-slate-400">
          This block follows the audit&rsquo;s scheduled date and duration. Change those on the
          audit and it moves with them.
        </p>
      )}

      {cancelled && b.cancelReason && (
        <p className="mt-1 text-[10px] text-slate-400">{b.cancelReason}</p>
      )}
    </div>
  );
}
