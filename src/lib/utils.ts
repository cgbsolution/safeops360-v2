import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function daysBetween(a: Date | string, b: Date | string = new Date()): number {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
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
