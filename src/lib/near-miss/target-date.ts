import { APP_TIME_ZONE, parseApiDate } from "@/lib/utils";

// The record-level target closure date (NearMiss.targetDate) is a calendar
// day, not an instant. The backend column is a timestamp, so the day we store
// it at decides the day everyone reads back.
//
// Storing the picked day at MIDNIGHT UTC is what shifted Observation dates a
// day earlier for IST users, so we pin it to NOON UTC instead: noon is the
// same calendar day in every zone from UTC-11 to UTC+12, which makes the
// stored value render identically no matter where it is read.
export function toTargetIso(dateOnly: string): string {
  return `${dateOnly}T12:00:00.000Z`;
}

/** Calendar day (yyyy-mm-dd) of an instant, in the app's display zone. */
export function toDateInputValue(value: Date | string | null | undefined): string {
  const d = parseApiDate(value);
  if (!d) return "";
  // en-CA formats as yyyy-mm-dd, which is exactly what <input type="date"> wants.
  return d.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
}

/** Today in the app's display zone — the correct `min` for a target picker. */
export function todayInAppZone(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
}

/**
 * Days a still-open record is past its target closure date, or null when it
 * has no target, is already closed, or is not yet due.
 *
 * Compared as calendar days in the display zone — a record is not "overdue"
 * until the target day itself has passed, whatever the stored clock time is.
 */
export function overdueDays(
  targetDate: Date | string | null | undefined,
  closedAt: Date | string | null | undefined,
): number | null {
  if (closedAt) return null;
  const target = toDateInputValue(targetDate);
  if (!target) return null;
  const today = todayInAppZone();
  if (target >= today) return null;
  const diff = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${target}T00:00:00Z`);
  return Math.round(diff / 86_400_000);
}
