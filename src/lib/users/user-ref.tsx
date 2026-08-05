// Shared helpers for rendering a person instead of a raw user id.
//
// The backend resolves user ids into display-ready refs (name + plant + role)
// — either inline on a payload (e.g. CapaOut.userDirectory) or via the generic
// /api/users/by-ids endpoint (use `resolveUsers` below). Render them with
// <UserRefLabel> for rich UI, or formatUserRefText() for plain-text contexts
// (print tables, CSV-like strings). Both fall back gracefully when an id can't
// be resolved so the UI never shows a bare cuid.

import { backendFetch } from "@/lib/backend/fetch";

export type UserRef = {
  id: string;
  name: string;
  role?: string | null;
  designation?: string | null;
  department?: string | null;
  plantId?: string | null;
  plantName?: string | null;
  plantCode?: string | null;
};

export type UserDirectory = Record<string, UserRef>;

/**
 * Humanise a role code for display: "HSE_MANAGER" → "HSE Manager",
 * "PLANT_HEAD" → "Plant Head". Short tokens (≤4 chars, e.g. HSE/CRO/QA) stay
 * upper-case as acronyms; longer ones are title-cased.
 */
export function formatRole(role?: string | null): string {
  if (!role) return "";
  return role
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) =>
      w.length <= 4 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ");
}

/**
 * A person as rendered by the workflow layer — "Awaiting Action", audit trail
 * rows, task cards. Unlike `UserRef` this is NOT keyed by id: the caller has
 * already joined the User row (Prisma `include: { assignedTo: … }`) or the
 * backend has inlined the fields on the payload.
 */
export type PartyIdentity = {
  name?: string | null;
  designation?: string | null;
  role?: string | null;
  department?: string | null;
  plantName?: string | null;
};

/**
 * Display name, with an explicit placeholder rather than a blank when the join
 * came back empty (an unassigned or deleted assignee).
 */
export function formatPartyName(p: PartyIdentity | null | undefined): string {
  const name = p?.name?.trim();
  return name ? name : "Unassigned";
}

/**
 * "Designation · Role · Department · Plant" — every identity fragment we hold
 * on User, in decreasing specificity. Deduped because designation and role are
 * frequently the same words on role-shaped accounts ("Process Operator"), and
 * a doubled-up suffix reads like a bug.
 *
 * Returns "" only when the User row carries none of the four fields; callers
 * render `formatPartyMetaOrHint()` instead so an incomplete profile is visible
 * as a data gap rather than silently collapsing to just the name.
 */
export function formatPartyMeta(
  p: PartyIdentity | null | undefined,
  opts: { showPlant?: boolean } = {}
): string {
  const { showPlant = true } = opts;
  const parts = [
    p?.designation,
    formatRole(p?.role),
    p?.department,
    showPlant ? p?.plantName : null,
  ]
    .map((x) => x?.trim())
    .filter((x): x is string => Boolean(x));
  const seen = new Set<string>();
  return parts
    .filter((x) => {
      const k = x.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(" · ");
}

/** As `formatPartyMeta`, but never empty — falls back to a fix-your-data hint. */
export function formatPartyMetaOrHint(
  p: PartyIdentity | null | undefined,
  opts: { showPlant?: boolean } = {}
): string {
  return formatPartyMeta(p, opts) || "Role & department not set on profile";
}

/** Single-line "Name · Designation · Role · Department · Plant" for plain-text
 *  contexts (PDF/XLSX exports, notification bodies, CSV columns). */
export function formatPartyText(p: PartyIdentity | null | undefined): string {
  const meta = formatPartyMeta(p);
  return meta ? `${formatPartyName(p)} · ${meta}` : formatPartyName(p);
}

/**
 * Plain-text "Name · Plant · Role" for non-JSX contexts (print tables, etc.).
 * Falls back to "Unknown user" when the id can't be resolved, or "—" when no
 * id is supplied.
 */
export function formatUserRefText(
  dir: UserDirectory | undefined,
  id: string | null | undefined
): string {
  if (!id) return "—";
  const u = dir?.[id];
  if (!u) return "Unknown user";
  return [u.name, u.plantName, formatRole(u.role)].filter(Boolean).join(" · ");
}

/**
 * Rich inline rendering: name emphasised, plant + role muted alongside.
 * Server-component-safe (no client hooks). Use anywhere a user id is shown.
 */
export function UserRefLabel({
  dir,
  id,
  className,
  showPlant = true,
  showRole = true,
}: {
  dir: UserDirectory | undefined;
  id: string | null | undefined;
  className?: string;
  showPlant?: boolean;
  showRole?: boolean;
}) {
  if (!id) return <span className={className}>—</span>;
  const u = dir?.[id];
  if (!u) {
    return <span className={className}>Unknown user</span>;
  }
  const meta = [showPlant ? u.plantName : null, showRole ? formatRole(u.role) : null].filter(
    Boolean
  );
  return (
    <span className={className}>
      <span className="font-medium text-slate-800">{u.name}</span>
      {meta.length > 0 && <span className="text-slate-500"> · {meta.join(" · ")}</span>}
    </span>
  );
}

/**
 * Server-side batch resolver for pages whose payload does NOT already embed a
 * user directory. Dedupes ids, no-ops on an empty set, and never throws —
 * resolution is best-effort decoration, so a backend hiccup degrades to the
 * id-fallback rather than blowing up the page.
 */
export async function resolveUsers(
  ids: (string | null | undefined)[]
): Promise<UserDirectory> {
  const unique = Array.from(new Set(ids.filter((x): x is string => Boolean(x))));
  if (unique.length === 0) return {};
  try {
    return await backendFetch<UserDirectory>("/api/users/by-ids", {
      query: { ids: unique.join(",") },
    });
  } catch {
    return {};
  }
}
