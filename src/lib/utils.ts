import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// The site's wall-clock timezone. Every timestamp is STORED in UTC and must be
// DISPLAYED here.
//
// This has to be pinned. Without it, `toLocaleString` uses whatever timezone the
// JavaScript runtime happens to be in — which is the browser for a client
// component but the *server* for a server component. Vercel's Node runtime is
// UTC, so a server-rendered timestamp read 5h30m earlier than the identical
// value rendered on the client: an action taken at 07:46 IST displayed as
// "02:16 am" in the Corrective Action panel while the resubmit panel next to it
// said "07:46 am".
//
// Override per deployment (e.g. a non-India instance) with
// NEXT_PUBLIC_APP_TIMEZONE. It must be a valid IANA zone name.
export const APP_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata";

// Timestamps come off the API as bare ISO strings with no zone — the database
// columns are Prisma `timestamp` (no zone) and every writer stores UTC in them,
// so "2026-08-27T11:25:00" means 11:25 UTC. `new Date()` parses a zone-less
// datetime as LOCAL time, so on an IST machine that string became 11:25 IST and
// every timestamp in the app rendered 5h30m earlier than it happened: an
// incident that occurred at 16:55 showed as 11:25 am, and an evening event
// crossed back over midnight and showed the previous day.
//
// Anything already carrying a zone (a trailing Z or ±hh:mm) is left alone, and
// a real Date object passes straight through.
export function parseApiDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
  const iso = hasZone || !/^\d{4}-\d{2}-\d{2}T/.test(value.trim()) ? value : `${value.trim()}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(date: Date | string | null | undefined): string {
  const d = parseApiDate(date);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  const d = parseApiDate(date);
  if (!d) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE
  });
}

export function daysBetween(a: Date | string, b: Date | string = new Date()): number {
  const da = parseApiDate(a) ?? new Date(a as string);
  const db = parseApiDate(b) ?? new Date(b as string);
  return Math.floor((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatINR(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    OPEN: "bg-amber-100 text-amber-800 border-amber-200",
    ASSIGNED: "bg-blue-100 text-blue-800 border-blue-200",
    IN_PROGRESS: "bg-indigo-100 text-indigo-800 border-indigo-200",
    CLOSED: "bg-emerald-100 text-emerald-800 border-emerald-200",
    REPORTED: "bg-amber-100 text-amber-800 border-amber-200",
    UNDER_REVIEW: "bg-blue-100 text-blue-800 border-blue-200",
    ACTION_ASSIGNED: "bg-indigo-100 text-indigo-800 border-indigo-200",
    DRAFT: "bg-slate-100 text-slate-800 border-slate-200",
    SUBMITTED: "bg-amber-100 text-amber-800 border-amber-200",
    ISSUER_APPROVED: "bg-blue-100 text-blue-800 border-blue-200",
    SAFETY_APPROVED: "bg-indigo-100 text-indigo-800 border-indigo-200",
    PLANT_HEAD_APPROVED: "bg-violet-100 text-violet-800 border-violet-200",
    ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
    EXPIRED: "bg-rose-100 text-rose-800 border-rose-200",
    REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
    SCHEDULED: "bg-slate-100 text-slate-800 border-slate-200",
    DUE: "bg-amber-100 text-amber-800 border-amber-200",
    COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
    OVERDUE: "bg-rose-100 text-rose-800 border-rose-200",
    INVESTIGATION: "bg-blue-100 text-blue-800 border-blue-200",
    CAPA_ASSIGNED: "bg-indigo-100 text-indigo-800 border-indigo-200",
    VERIFIED: "bg-violet-100 text-violet-800 border-violet-200",
  };
  return map[status] ?? "bg-slate-100 text-slate-800 border-slate-200";
}

export function severityColor(s: string): string {
  const map: Record<string, string> = {
    LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
    MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
    HIGH: "bg-orange-100 text-orange-800 border-orange-200",
    CRITICAL: "bg-rose-100 text-rose-800 border-rose-200"
  };
  return map[s] ?? "bg-slate-100 text-slate-800 border-slate-200";
}

// Plant names are stored as "Meridian North Works — Integrated Manufacturing
// Unit"; chrome (header/sidebar) shows only the part before the em dash.
export function shortPlantName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.split(/\s+—\s+/)[0].trim();
}

export function humanize(s: string): string {
  return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function workflowChipColor(status: string): string {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "REJECTED") return "bg-rose-100 text-rose-800 border-rose-200";
  if (status === "IN_PROGRESS") return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}
