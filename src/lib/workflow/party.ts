// One Prisma select + one mapper for "who is this person?" across every
// workflow surface.
//
// The "Awaiting Action" callout and the audit trail must identify an actor by
// full name, designation, role, department and plant — a bare name is useless
// on role-shaped accounts (there is a "Process Operator" at every plant). These
// two helpers exist so a module can't accidentally ship a partial identity:
// spread PARTY_SELECT into the Prisma select, pipe the row through toParty(),
// and the tracker renders the full line.

/** Prisma `select` for a User joined as a workflow actor. */
export const PARTY_SELECT = {
  name: true,
  designation: true,
  role: true,
  department: true,
  plant: { select: { name: true } },
} as const;

/**
 * Prisma `include` for pages that pull the whole User row (`assignedTo: true`)
 * and only need the Plant relation added on top. Equivalent identity coverage
 * to PARTY_SELECT, without narrowing fields other code on the page may use.
 */
export const PARTY_INCLUDE = {
  plant: { select: { name: true } },
} as const;

/** A User row selected with PARTY_SELECT (or any superset, e.g. `include`). */
export type PartyRow = {
  name?: string | null;
  designation?: string | null;
  role?: string | null;
  department?: string | null;
  plant?: { name: string | null } | null;
};

export type Party = {
  name: string | null;
  designation: string | null;
  role: string | null;
  department: string | null;
  plantName: string | null;
};

/**
 * Flatten a joined User row into the shape `<WorkflowTracker>` renders.
 * Tolerates a null row — an unassigned or hard-deleted actor renders as
 * "Unassigned" rather than crashing the page.
 */
export function toParty(u: PartyRow | null | undefined): Party {
  return {
    name: u?.name ?? null,
    designation: u?.designation ?? null,
    role: u?.role ?? null,
    department: u?.department ?? null,
    plantName: u?.plant?.name ?? null,
  };
}
