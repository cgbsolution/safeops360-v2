// Single source of truth for the PTW–FLRA gate.
//
// The gate decides whether a permit may transition APPROVED → ACTIVE.
// Three call sites use it:
//   1. Workflow engine — advanceFromExecution refuses to advance the receiver
//      task while the gate is closed.
//   2. Receiver ExecutionPanel — surfaces the gate reason in real-time so the
//      user understands why "Submit acknowledgement" is disabled.
//   3. PTW detail FLRA & Activation panel — drives the status-aware CTA.
//
// Keep enforcement here so the rules are testable in isolation.

import { prisma } from "@/lib/prisma";

export type FlraGateStatus = {
  ok: boolean;
  reason?: string;
  // The active FLRA, if one exists (latest non-superseded). Used by the UI to
  // deep-link to the right record.
  activeFlraId?: string;
  activeFlraNumber?: string;
  flraStatus?: "IN_PROGRESS" | "COMPLETED" | "SUPERSEDED" | "CANCELLED";
  // Crew sign-off rollup (only meaningful when activeFlraId is set).
  signedCount?: number;
  totalCrew?: number;
  unsignedNames?: string[];
};

// Returns the gate status for a permit. Pure function over DB state — no
// side-effects. Safe to call from server components.
export async function getFlraGateStatus(permitId: string): Promise<FlraGateStatus> {
  // Pull the most recent non-cancelled FLRA. There may be SUPERSEDED records
  // from prior re-do flows; we only consider the live one.
  const flra = await prisma.fLRA.findFirst({
    where: {
      permitId,
      status: { in: ["IN_PROGRESS", "COMPLETED"] }
    },
    orderBy: { createdAt: "desc" },
    include: {
      crewSignatures: { include: { user: { select: { id: true, name: true } } } }
    }
  });

  if (!flra) {
    return {
      ok: false,
      reason: "A completed FLRA is required before this permit can become ACTIVE. All crew members must sign the FLRA at the worksite."
    };
  }

  const totalCrew = flra.crewSignatures.length;
  const signedCount = flra.crewSignatures.filter((s) => s.signed).length;
  const unsignedNames = flra.crewSignatures
    .filter((s) => !s.signed)
    .map((s) => s.user.name);

  if (flra.status === "COMPLETED") {
    return {
      ok: true,
      activeFlraId: flra.id,
      activeFlraNumber: flra.number,
      flraStatus: "COMPLETED",
      signedCount,
      totalCrew
    };
  }

  // IN_PROGRESS — check that every required crew row is signed
  if (totalCrew === 0) {
    return {
      ok: false,
      activeFlraId: flra.id,
      activeFlraNumber: flra.number,
      flraStatus: "IN_PROGRESS",
      reason: `FLRA ${flra.number} has no crew sign-off rows. Add crew members and sign before activation.`,
      signedCount: 0,
      totalCrew: 0
    };
  }

  if (signedCount < totalCrew) {
    return {
      ok: false,
      activeFlraId: flra.id,
      activeFlraNumber: flra.number,
      flraStatus: "IN_PROGRESS",
      reason: `FLRA ${flra.number} is awaiting sign-off from: ${unsignedNames.join(", ")}.`,
      signedCount,
      totalCrew,
      unsignedNames
    };
  }

  // All signed but status is still IN_PROGRESS — race condition. Treat as ok
  // and let the next sign call flip status to COMPLETED.
  return {
    ok: true,
    activeFlraId: flra.id,
    activeFlraNumber: flra.number,
    flraStatus: "IN_PROGRESS",
    signedCount,
    totalCrew
  };
}

// Marks an FLRA as COMPLETED if every crew signature row is signed=true.
// Idempotent — safe to call after every sign event. Returns true if the
// transition happened.
export async function maybeCompleteFlra(flraId: string): Promise<boolean> {
  const flra = await prisma.fLRA.findUnique({
    where: { id: flraId },
    include: { crewSignatures: true }
  });
  if (!flra) return false;
  if (flra.status !== "IN_PROGRESS") return false;
  if (flra.crewSignatures.length === 0) return false;
  const allSigned = flra.crewSignatures.every((s) => s.signed);
  if (!allSigned) return false;

  await prisma.fLRA.update({
    where: { id: flraId },
    data: { status: "COMPLETED", completedAt: new Date() }
  });
  return true;
}

// Builds the initial set of crew signature rows when an FLRA is created.
// Picks the source set by priority:
//   1. PTW.workCrew if any rows exist (high-risk permits with named crew)
//   2. PTW.receiverId as a single-row fallback (always present on a real PTW)
//   3. FLRA.teamMembers (manually entered) — for standalone FLRA path
// Returns array of userIds to seed signature rows for.
export async function resolveCrewForFlra(opts: {
  permitId: string | null;
  fallbackTeamMemberIds: string[];
}): Promise<string[]> {
  if (opts.permitId) {
    const permit = await prisma.permit.findUnique({
      where: { id: opts.permitId },
      include: { workCrew: { select: { userId: true } } }
    });
    if (permit) {
      if (permit.workCrew.length > 0) {
        return Array.from(new Set(permit.workCrew.map((c) => c.userId)));
      }
      if (permit.receiverId) {
        return [permit.receiverId];
      }
    }
  }
  return Array.from(new Set(opts.fallbackTeamMemberIds));
}
