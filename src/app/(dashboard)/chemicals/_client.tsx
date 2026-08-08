"use client";

// Shared client-side pieces for the Chemical / Hazmat screens: the API helper
// every dialog posts through, and the small presentational bits that have to
// live on the client because they sit inside interactive components.
//
// One rule the whole module follows: an API failure is SHOWN, never swallowed.
// The backend returns real, actionable messages for the business rules that
// matter here — "cannot be activated without a Safety Data Sheet", "Incompatible
// co-storage: X cannot share a location with Y", "batch holds 380 KG". Those
// sentences are the product. A generic "Something went wrong" toast would throw
// away the most useful thing the server said.

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { hazardTone, prettyLabel, statusTone } from "@/lib/chemicals/types";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** POST/PATCH through the catch-all proxy (/api/* → Python backend).
 *  Surfaces FastAPI's `detail` verbatim — see the note above. */
export async function apiSend<T = any>(
  path: string,
  body: unknown,
  method: "POST" | "PATCH" = "POST"
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    /* empty or non-JSON body — handled below */
  }
  if (!res.ok) {
    const detail =
      payload?.detail ??
      payload?.error ??
      // A 409 with no body is still a rejection, and saying so beats a silent
      // no-op that looks like success.
      `Request failed (${res.status})`;
    throw new ApiError(
      typeof detail === "string" ? detail : JSON.stringify(detail),
      res.status
    );
  }
  return payload as T;
}

export function HazardBadges({ classes }: { classes: string[] }) {
  if (!classes?.length) {
    return (
      <span className="text-[11px] font-medium text-amber-600">Unclassified</span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {classes.map((c) => (
        <Badge key={c} className={hazardTone(c)}>
          {prettyLabel(c)}
        </Badge>
      ))}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={statusTone(status)}>{prettyLabel(status)}</Badge>;
}

/** Inline form error. Rendered in the dialog rather than as a toast, because a
 *  co-storage rejection is a paragraph the user needs to read and act on, and
 *  toasts disappear. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
      {message}
    </div>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
