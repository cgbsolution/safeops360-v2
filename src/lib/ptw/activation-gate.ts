// PTW activation gate — the full pre-flight before a permit leaves the
// receiver step (ASSIGNEE_TASK) and becomes ACTIVE.
//
// This file used to be a 446-line reimplementation of
// `app/services/ptw_activation_gate.py` + `app/services/ppe_gate.py`: FLRA
// sign-off state, crew training validity, mandatory-PPE issuance and
// acknowledgement, item serviceability, isolation verification. Two copies of
// a safety gate is one copy too many — the Python side is the enforcement
// point on transition, so a drift here would show the receiver a green light
// for work the backend would then refuse (or, worse, the reverse).
//
// It is now a thin read of that authoritative service. The response shape is
// unchanged, so the detail page's blockers panel renders exactly as before.

import { backendFetch } from "@/lib/backend/fetch";

export type GateBlocker = {
  code:
    | "PERMIT_NOT_FOUND"
    | "PERMIT_CLOSED"
    | "PERMIT_REJECTED"
    | "PERMIT_SUSPENDED"
    | "PERMIT_EXPIRED"
    | "FLRA_MISSING"
    | "FLRA_UNSIGNED"
    | "FLRA_REFUSED"
    | "CREW_VALIDITY"
    | "CREW_PPE"
    | "CREW_PPE_WARN"
    | "ISOLATIONS_PENDING";
  message: string;
  severity: "ERROR" | "WARN";
};

export type PtwActivationGateStatus = {
  ok: boolean;
  /** Closed-loop rebuild: FLRA blocks activation only when the permit was
   *  created with flraRequired (instance policy / wizard override). */
  flraRequired: boolean;
  blockers: GateBlocker[];
  flra: {
    id: string;
    number: string;
    status: "IN_PROGRESS" | "COMPLETED";
    signedCount: number;
    totalCrew: number;
  } | null;
  crewValidityIssues: string[];
  crewPpeIssues: string[];
  crewPpeWarnings: string[];
  isolations: { pending: number; total: number };
};

/** Fail-closed result: if we cannot reach the authoritative gate we must not
 *  imply the permit is clear to activate. */
function unavailable(reason: string): PtwActivationGateStatus {
  return {
    ok: false,
    flraRequired: false,
    blockers: [{ code: "PERMIT_NOT_FOUND", message: reason, severity: "ERROR" }],
    flra: null,
    crewValidityIssues: [],
    crewPpeIssues: [],
    crewPpeWarnings: [],
    isolations: { pending: 0, total: 0 }
  };
}

export async function getPtwActivationGate(
  permitId: string
): Promise<PtwActivationGateStatus> {
  try {
    return await backendFetch<PtwActivationGateStatus>(
      `/api/ptw/${encodeURIComponent(permitId)}/activation-gate`
    );
  } catch {
    return unavailable(
      "The activation checks could not be loaded. Reload the page — the permit cannot be activated until they pass."
    );
  }
}
