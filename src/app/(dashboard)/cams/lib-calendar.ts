// Calendar bookings — shared types + presentation helpers.
//
// Backend: app/routers/calendar.py, app/services/calendar_{booking,providers}.py
//
// The premise worth holding while reading these types: a booking is ONE calendar
// event with an attendee list, not one row per person. That is what Microsoft
// Graph creates, what an .ics REQUEST describes, and what a participant sees —
// so the panel shows three events with their casts, not nine invitations.

export type BookingType = "AUDIT_BLOCK" | "OPENING_MEETING" | "CLOSING_MEETING";

/**
 * SKIPPED is deliberately distinct from FAILED. It means nothing was sent and
 * nothing was wrong — no calendar channel is configured, or nobody on the audit
 * has an email address. Colouring it red would send people hunting for a fault
 * that does not exist.
 */
export type BookingStatus = "PENDING" | "BOOKED" | "FAILED" | "CANCELLED" | "SKIPPED";

export type BookingProvider = "GRAPH" | "ICS" | "NONE";

export type BookingAttendee = {
  userId: string | null;
  email: string;
  name: string;
  role: "LEAD_AUDITOR" | "CO_AUDITOR" | "AUDITEE" | "PLANT_MANAGER" | "SUPPLIER_CONTACT" | "OTHER";
  required: boolean;
  /** When this person's calendar was claimed — not when the audit was set. */
  addedAt?: string;
  removedAt?: string;
};

/**
 * A room answers for itself. PENDING is not "we have it" — Exchange's booking
 * assistant has simply not replied yet — and DECLINED means it was already
 * taken, which is the state that must never be shown as success.
 */
export type RoomStatus = "NONE" | "DEFERRED" | "PENDING" | "ACCEPTED" | "DECLINED";

export type MeetingRoom = {
  email: string;
  name: string;
  capacity: number | null;
  building: string | null;
  floor: string | number | null;
};

export type RoomsResponse = {
  rooms: MeetingRoom[];
  total: number;
  provider: BookingProvider;
  error: string | null;
  statement: string;
};

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  NONE: "No room",
  // Exchange rooms refuse bookings beyond their window (180 days by default),
  // so a long-lead audit holds the choice and requests it nearer the time.
  DEFERRED: "Room requested nearer the date",
  PENDING: "Awaiting the room",
  ACCEPTED: "Room confirmed",
  DECLINED: "Room unavailable",
};

export const ROOM_STATUS_CHIP: Record<RoomStatus, string> = {
  NONE: "bg-slate-50 text-slate-500 border-slate-200",
  DEFERRED: "bg-sky-50 text-sky-800 border-sky-200",
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  ACCEPTED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  DECLINED: "bg-rose-50 text-rose-800 border-rose-200",
};

export type CalendarBooking = {
  id: string;
  engagementKind: "AUDIT" | "INSPECTION";
  engagementId: string;
  bookingType: BookingType;
  subject: string;
  location: string;
  startAt: string;
  endAt: string;
  timezone: string;
  status: BookingStatus;
  provider: BookingProvider;
  onlineMeetingUrl: string | null;
  roomEmail: string | null;
  roomName: string | null;
  roomStatus: RoomStatus;
  /** True once a human chose a room — or deliberately cleared one. */
  roomPinned: boolean;
  organizerUserId: string | null;
  organizerEmail: string | null;
  attendees: BookingAttendee[];
  attendeeCount: number;
  removedAttendees: BookingAttendee[];
  revision: number;
  attemptCount: number;
  lastSyncedAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
};

export type BookingsResponse = {
  bookings: CalendarBooking[];
  total: number;
  bookedCount: number;
  failedCount: number;
  participantCount: number;
  provider: BookingProvider;
  statement: string;
};

export type CalendarStatus = {
  enabled: boolean;
  activeProvider: BookingProvider;
  graph: {
    configured: boolean;
    tenantId: string | null;
    clientId: string | null;
    onlineMeetings: boolean;
    missing: string[];
    tokenOk?: boolean;
    tokenError?: string | null;
  };
  smtp: { configured: boolean; host: string | null };
  fallbackMailbox: string | null;
  timezone: string;
  openingMeetingMinutes: number;
  closingMeetingMinutes: number;
  statement: string;
};

export const BOOKING_LABEL: Record<BookingType, string> = {
  OPENING_MEETING: "Opening meeting",
  AUDIT_BLOCK: "Audit fieldwork",
  CLOSING_MEETING: "Closing meeting",
};

export const ROLE_LABEL: Record<string, string> = {
  LEAD_AUDITOR: "Lead auditor",
  CO_AUDITOR: "Co-auditor",
  AUDITEE: "Auditee",
  PLANT_MANAGER: "Plant manager",
  SUPPLIER_CONTACT: "Supplier contact",
  OTHER: "Participant",
};

export const STATUS_CHIP: Record<BookingStatus, string> = {
  BOOKED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  FAILED: "bg-rose-50 text-rose-800 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
  SKIPPED: "bg-slate-50 text-slate-600 border-slate-200",
};

/**
 * What each status means for the participant, not for the system. "PENDING" is
 * meaningless to a scheduler; "not in their calendar yet" is the fact they need.
 */
export const STATUS_LABEL: Record<BookingStatus, string> = {
  BOOKED: "In their calendars",
  PENDING: "Not delivered yet",
  FAILED: "Could not be delivered",
  CANCELLED: "Withdrawn",
  SKIPPED: "Not sent",
};

export function fmtTimeRange(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "—";
  const day = s.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  // Cross-midnight windows are real (a night-shift audit), so the end date is
  // printed rather than assumed to be the same day.
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${day} · ${t(s)}–${t(e)}`
    : `${day} ${t(s)} → ${e.toLocaleDateString(undefined, { day: "2-digit", month: "short" })} ${t(e)}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
}

/** Local `datetime-local` input value for an instant. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
